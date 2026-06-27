import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { buildArtifact, aiMode } from "./build.js";
import { createRoom, joinRoom, updateSeat, kickPlayer, startGame, restartGame, suggestRoomFeatures, handleAction, addClient, getState, getArtifact, getPlayerArtifact } from "./rooms.js";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const publicRoot = fileURLToPath(new URL("../public/", import.meta.url));
loadDotEnv();
const preferredPort = Number(process.env.PORT || 5173);

const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", "http://localhost");
    const segments = url.pathname.split("/").filter(Boolean);

    if (url.pathname === "/api/health" && req.method === "GET") {
      const mode = aiMode();
      return sendJson(res, {
        ok: true,
        aiMode: mode, // "offline" | "cloud" | "local" | "custom"
        apiConfigured: mode !== "offline",
        model: process.env.AI_MODEL || null,
        baseUrl: process.env.AI_API_BASE || null,
      });
    }

    if (url.pathname === "/api/build" && req.method === "POST") {
      const payload = JSON.parse(await readBody(req));
      return sendJson(res, await buildArtifact(payload));
    }

    // Online multiplayer: /api/rooms ...
    if (segments[0] === "api" && segments[1] === "rooms") {
      return handleRoomRoute(req, res, url, segments);
    }

    // Hosted player apps: GET /app/:code/:playerId -> the built app as live HTML.
    if (segments[0] === "app" && req.method === "GET") {
      return serveHostedApp(req, res, segments[1], segments[2]);
    }

    if (req.method !== "GET") {
      res.writeHead(405);
      res.end("Method not allowed");
      return;
    }

    const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
    const safePath = normalize(pathname).replace(/^(\.\.[/\\])+/, "");
    const filePath = join(publicRoot, safePath);
    const data = await readFile(filePath);
    const ext = extname(filePath);
    const ct = types[ext] || "application/octet-stream";
    const cacheable = pathname.startsWith("/assets/") || [".png", ".jpg", ".jpeg", ".webp", ".gif", ".ico", ".svg"].includes(ext);
    const headers = {
      "Content-Type": ct,
      // Cache static art so phones don't re-download the card images on every
      // re-render; keep HTML/JS/CSS uncached so client updates apply immediately.
      "Cache-Control": cacheable ? "public, max-age=604800" : "no-store",
      Vary: "Accept-Encoding",
    };
    const gz = maybeGzip(req, data, ct);
    if (gz) headers["Content-Encoding"] = "gzip";
    res.writeHead(200, headers);
    res.end(gz || data);
  } catch (error) {
    if (error?.code === "ENOENT") {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    console.error(error);
    if (!res.headersSent) {
      res.writeHead(500);
      res.end("Server error");
    }
  }
});

async function handleRoomRoute(req, res, url, segments) {
  // POST /api/rooms                       -> create room (returns code + playerId)
  if (segments.length === 2 && req.method === "POST") {
    if (rateLimited(`create:${clientIp(req)}`, 10, 60000)) {
      return sendJson(res, { error: "Too many new games from your connection. Wait a minute and try again." }, 429);
    }
    const body = JSON.parse(await readBody(req));
    const result = createRoom(body);
    if (result.error) return sendJson(res, { error: result.error }, 400);
    return sendJson(res, { code: result.room.code, playerId: result.playerId });
  }

  const code = segments[2];
  const sub = segments[3];

  // POST /api/rooms/:code/join
  if (sub === "join" && req.method === "POST") {
    // Throttle join attempts per client so room codes can't be brute-forced.
    if (rateLimited(`join:${clientIp(req)}`, 15, 60000)) {
      return sendJson(res, { error: "Too many join attempts. Wait a minute and try again." }, 429);
    }
    const body = JSON.parse(await readBody(req));
    const result = joinRoom(code, body);
    if (result.error) return sendJson(res, { error: result.error }, 400);
    return sendJson(res, { code: result.room.code, playerId: result.playerId, resumed: Boolean(result.resumed) });
  }

  // POST /api/rooms/:code/update   (edit your own seat in the lobby)
  if (sub === "update" && req.method === "POST") {
    const body = JSON.parse(await readBody(req));
    const result = updateSeat(code, body.playerId, body);
    if (result.error) return sendJson(res, { error: result.error }, 400);
    return sendJson(res, { ok: true });
  }

  // POST /api/rooms/:code/kick   (host removes a lobby player)
  if (sub === "kick" && req.method === "POST") {
    const body = JSON.parse(await readBody(req));
    const result = kickPlayer(code, body.playerId, body.targetId);
    if (result.error) return sendJson(res, { error: result.error }, 400);
    return sendJson(res, { ok: true });
  }

  // POST /api/rooms/:code/start
  if (sub === "start" && req.method === "POST") {
    const body = JSON.parse(await readBody(req));
    const result = startGame(code, body.playerId);
    if (result.error) return sendJson(res, { error: result.error }, 400);
    return sendJson(res, { ok: true });
  }

  // POST /api/rooms/:code/restart   (host starts a fresh game, same players)
  if (sub === "restart" && req.method === "POST") {
    const body = JSON.parse(await readBody(req));
    const result = restartGame(code, body.playerId);
    if (result.error) return sendJson(res, { error: result.error }, 400);
    return sendJson(res, { ok: true });
  }

  // POST /api/rooms/:code/feature-suggestions
  if (sub === "feature-suggestions" && req.method === "POST") {
    const body = JSON.parse(await readBody(req));
    const result = await suggestRoomFeatures(code, body.playerId, body.payload || {});
    if (result.error) return sendJson(res, { error: result.error }, 400);
    return sendJson(res, result);
  }

  // POST /api/rooms/:code/action
  if (sub === "action" && req.method === "POST") {
    const body = JSON.parse(await readBody(req));
    const result = await handleAction(code, body.playerId, body.action);
    if (result.error) return sendJson(res, { error: result.error }, 400);
    return sendJson(res, { ok: true });
  }

  // GET /api/rooms/:code/state?playerId=...   (polling fallback for SSE)
  if (sub === "state" && req.method === "GET") {
    const playerId = url.searchParams.get("playerId");
    const result = getState(code, playerId);
    if (result.error) return sendJson(res, { error: result.error }, result.error === "not-member" ? 403 : 404);
    return sendJson(res, { view: result.view }, 200, req);
  }

  // GET /api/rooms/:code/events?playerId=...   (Server-Sent Events stream)
  if (sub === "events" && req.method === "GET") {
    const playerId = url.searchParams.get("playerId");
    const result = addClient(code, playerId, res);
    if (result.error) return sendJson(res, { error: result.error }, 404);
    return; // connection stays open
  }

  // GET /api/rooms/:code/artifact?playerId=...&targetId=...
  if (sub === "artifact" && req.method === "GET") {
    const playerId = url.searchParams.get("playerId");
    const targetId = url.searchParams.get("targetId");
    const artifact = getArtifact(code, playerId, targetId);
    if (!artifact) return sendJson(res, { error: "No artifact available." }, 404);
    return sendJson(res, artifact);
  }

  res.writeHead(404);
  res.end("Not found");
}

listen(preferredPort);

function listen(port) {
  server.once("error", (error) => {
    if (error.code === "EADDRINUSE" && port < preferredPort + 20) {
      listen(port + 1);
      return;
    }
    throw error;
  });
  server.listen(port, () => {
    console.log(`Roundtable is running at http://localhost:${port}`);
    console.log(`AI builder: ${describeAiMode()}`);
  });
}

function serveHostedApp(req, res, code, playerId) {
  const artifact = getPlayerArtifact(code, playerId);
  if (!artifact?.html) {
    res.writeHead(404, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    res.end(
      "<!doctype html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'></head>" +
        "<body style='font-family:system-ui,sans-serif;padding:40px;color:#333'><h2>App not built yet</h2>" +
        "<p>This product hasn't finished building. Play a turn and refresh.</p></body></html>",
    );
    return;
  }
  const buf = Buffer.from(artifact.html);
  const headers = { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", Vary: "Accept-Encoding" };
  const gz = maybeGzip(req, buf, "text/html");
  if (gz) headers["Content-Encoding"] = "gzip";
  res.writeHead(200, headers);
  res.end(gz || buf);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy();
        reject(new Error("Request body too large"));
      }
    });
    req.on("end", () => resolve(body || "{}"));
    req.on("error", reject);
  });
}

function sendJson(res, body, status = 200, req = null) {
  const buf = Buffer.from(JSON.stringify(body));
  const headers = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", Vary: "Accept-Encoding" };
  const gz = req ? maybeGzip(req, buf, "application/json") : null;
  if (gz) headers["Content-Encoding"] = "gzip";
  res.writeHead(status, headers);
  res.end(gz || buf);
}

// Gzip compressible text responses for clients that accept it (skips already
// compressed images and tiny bodies). Big win for the ~100KB of JS/CSS on first
// load and the state JSON polled every 1.5s on slow/WeChat connections.
function maybeGzip(req, buf, contentType) {
  if (!/\bgzip\b/.test(String(req.headers["accept-encoding"] || ""))) return null;
  if (!/text\/|json|javascript|svg|xml/i.test(contentType)) return null;
  if (buf.length < 600) return null;
  try {
    return gzipSync(buf, { level: 6 });
  } catch {
    return null;
  }
}

// Simple in-memory per-key rate limiting (brute-force protection for room codes).
const rateBuckets = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of rateBuckets) if (now > bucket.reset) rateBuckets.delete(key);
}, 60000).unref?.();

function clientIp(req) {
  const forwarded = req.headers["cf-connecting-ip"] || req.headers["x-forwarded-for"];
  if (forwarded) return String(forwarded).split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}

function rateLimited(key, max, windowMs) {
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || now > bucket.reset) {
    rateBuckets.set(key, { count: 1, reset: now + windowMs });
    return false;
  }
  bucket.count += 1;
  return bucket.count > max;
}

function describeAiMode() {
  const mode = aiMode();
  const model = process.env.AI_MODEL || "gpt-4o-mini";
  const base = process.env.AI_API_BASE || "https://api.openai.com/v1";
  if (mode === "offline") {
    return "offline built-in builder (set AI_API_KEY for a cloud model, or AI_API_BASE for a local model)";
  }
  if (mode === "local") return `local model "${model}" at ${base} (no key)`;
  if (mode === "cloud") return `cloud model "${model}" at ${base}`;
  return `custom model "${model}" at ${base} (with key)`;
}

function loadDotEnv() {
  try {
    const text = readFileSync(join(projectRoot, ".env"), "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const index = trimmed.indexOf("=");
      if (index === -1) continue;
      const key = trimmed.slice(0, index).trim();
      const raw = trimmed.slice(index + 1).trim();
      const value = raw.replace(/^['"]|['"]$/g, "");
      if (key && process.env[key] === undefined) process.env[key] = value;
    }
  } catch (error) {
    if (error.code !== "ENOENT") console.warn(`Could not load .env: ${error.message}`);
  }
}
