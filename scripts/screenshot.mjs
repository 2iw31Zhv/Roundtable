// Regenerates the README hero screenshot (docs/screenshot.png).
//
// It boots the local server, drives a short demo game in headless Chrome
// via the DevTools Protocol, and captures the main board scene. Run it
// whenever the UI changes so the README stays current:
//
//   npm run screenshot
//
// Requires Google Chrome (or Chromium). Override the binary with
// CHROME_PATH if it lives somewhere unusual.
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const outPath = fileURLToPath(new URL("../docs/screenshot.png", import.meta.url));
const PORT = Number(process.env.SCREENSHOT_PORT || 5188);
const DEBUG_PORT = 9242;
const SCALE = Number(process.env.SCREENSHOT_SCALE || 1.5);

const CHROME = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
].find((candidate) => candidate && existsSync(candidate));

if (!CHROME) {
  console.error("Could not find Chrome/Chromium. Set CHROME_PATH to its binary.");
  process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Page-side script: start a 4-player game and play one full round so the
// board shows real progress and shipped features.
const driveGame = `(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const pc = document.querySelector('#player-count');
  if (pc) { pc.value = '4'; pc.dispatchEvent(new Event('change', { bubbles: true })); }
  await sleep(150);
  document.querySelector('[data-action="quick-start"]').click();
  await sleep(300);
  for (let turn = 0; turn < 4; turn++) {
    const card = document.querySelector('.player-hand [data-action="select-card"]');
    if (card) {
      card.click();
      await sleep(120);
      const play = document.querySelector('[data-action="play-card"]');
      if (play && !play.disabled) { play.click(); await sleep(260); }
    }
    const sprint = document.querySelector('[data-action="run-sprint"]');
    if (sprint && !sprint.disabled) { sprint.click(); await sleep(700); }
    const end = document.querySelector('[data-action="end-turn"]');
    if (end) { end.click(); await sleep(200); }
  }
  return 'ok';
})()`;

async function cdpVersion() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://localhost:${DEBUG_PORT}/json/version`);
      const data = await res.json();
      if (data.webSocketDebuggerUrl) return data.webSocketDebuggerUrl;
    } catch {}
    await sleep(100);
  }
  throw new Error("Chrome DevTools endpoint did not come up.");
}

async function waitForServer() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://localhost:${PORT}/api/health`);
      if (res.ok) return;
    } catch {}
    await sleep(100);
  }
  throw new Error("Server did not start in time.");
}

function connect(ws) {
  let id = 0;
  const pending = new Map();
  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg.result);
      pending.delete(msg.id);
    }
  });
  return (method, params = {}, sessionId) =>
    new Promise((resolve) => {
      const mid = ++id;
      pending.set(mid, resolve);
      ws.send(JSON.stringify({ id: mid, method, params, sessionId }));
    });
}

const server = spawn("node", ["server/index.js"], {
  cwd: projectRoot,
  env: { ...process.env, PORT: String(PORT) },
  stdio: "ignore",
});

const chrome = spawn(CHROME, [
  "--headless=new",
  "--disable-gpu",
  "--hide-scrollbars",
  `--force-device-scale-factor=${SCALE}`,
  `--remote-debugging-port=${DEBUG_PORT}`,
  "--window-size=1440,900",
  "--user-data-dir=/tmp/roundtable-screenshot-profile",
  "about:blank",
], { stdio: "ignore" });

function cleanup() {
  try { chrome.kill(); } catch {}
  try { server.kill(); } catch {}
}

try {
  await waitForServer();
  const wsUrl = await cdpVersion();
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve) => (ws.onopen = resolve));
  const browser = connect(ws);

  const { targetId } = await browser("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await browser("Target.attachToTarget", { targetId, flatten: true });
  const send = (method, params) => browser(method, params, sessionId);

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Page.navigate", { url: `http://localhost:${PORT}/local.html?reset` });
  await sleep(1300);
  await send("Runtime.evaluate", { expression: driveGame, awaitPromise: true });
  await sleep(600);

  const { data } = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  mkdirSync(fileURLToPath(new URL("../docs", import.meta.url)), { recursive: true });
  writeFileSync(outPath, Buffer.from(data, "base64"));
  console.log(`Saved ${outPath}`);
  ws.close();
} catch (error) {
  console.error(error.message || error);
  process.exitCode = 1;
} finally {
  cleanup();
  process.exit(process.exitCode || 0);
}
