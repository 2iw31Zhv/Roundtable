// In-memory room registry for online multiplayer.
//
// A room starts in a lobby where players join with a code, then the host starts
// the game. The server is authoritative (see engine.js); clients receive a
// redacted per-player view over Server-Sent Events and POST their intents.
import { randomUUID } from "node:crypto";
import {
  createGame,
  playCard,
  prepareAutomaticSprint,
  chargeFeatureSuggestion,
  commitSprintArtifact,
  endTurn,
  respondConsult,
  submitConsultFeedback,
  cancelConsult,
  viewFor,
  artifactFor,
  MIN_PLAYERS,
  MAX_PLAYERS,
  DEFAULT_BUDGET_CAP,
} from "./engine.js";
import { buildArtifact, suggestFeatures } from "./build.js";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
const ROOM_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours idle
const MAX_ROOMS = 200;

const rooms = new Map();

setInterval(pruneRooms, 10 * 60 * 1000).unref?.();

function generateCode() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    let code = "";
    for (let i = 0; i < 5; i += 1) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
    if (!rooms.has(code)) return code;
  }
  throw new Error("Could not allocate a room code.");
}

function sanitizeName(value, fallback) {
  const name = String(value || "").trim().replace(/\s+/g, " ").slice(0, 40);
  return name || fallback;
}

function sanitizeProduct(value) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 80);
}

function validateProductIdea(value) {
  const product = sanitizeProduct(value);
  const cjkCount = (product.match(/[\u4e00-\u9fff]/g) || []).length;
  if ((cjkCount > 0 && cjkCount < 2) || (cjkCount === 0 && product.length < 6)) {
    return { error: "Enter a specific product idea before joining." };
  }
  const compact = product.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, " ").trim();
  const generic = new Set([
    "app",
    "application",
    "web app",
    "website",
    "software",
    "tool",
    "product",
    "project",
    "startup",
    "idea",
    "test",
    "demo",
    "todo",
    "todo app",
    "untitled",
    "untitled product",
    "roundtable",
    "roundtable ai game builder",
    "产品",
    "项目",
    "应用",
    "软件",
    "工具",
    "测试",
    "演示",
  ]);
  if (generic.has(compact) || /\broundtable\b/i.test(product)) {
    return { error: "Use a real product idea, not Roundtable or a generic placeholder." };
  }
  return { product };
}

function sanitizeBudget(value) {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(99, Math.max(1, n)) : DEFAULT_BUDGET_CAP;
}

function makeSeat(body, index) {
  const validated = validateProductIdea(body?.product);
  if (validated.error) return { error: validated.error };
  return {
    seat: {
      id: randomUUID(),
      clientId: typeof body?.clientId === "string" ? body.clientId.slice(0, 64) : null,
      name: sanitizeName(body?.name, `Player ${index + 1}`),
      product: validated.product,
      budgetCap: sanitizeBudget(body?.budgetCap),
    },
  };
}

export function createRoom(body) {
  if (rooms.size >= MAX_ROOMS) return { error: "The server is at capacity. Try again later." };
  const code = generateCode();
  const made = makeSeat(body, 0);
  if (made.error) return { error: made.error };
  const seat = made.seat;
  const room = {
    code,
    hostId: seat.id,
    status: "lobby",
    createdAt: Date.now(),
    lastActivity: Date.now(),
    seats: [seat],
    game: null,
    clients: new Map(),
    lastSeen: new Map(),
  };
  rooms.set(code, room);
  return { room, playerId: seat.id };
}

// One-shot state fetch used by the polling client (SSE does not survive some
// tunnels/proxies). Records the player's presence and returns their view.
export function getState(code, playerId) {
  const room = getRoom(code);
  if (!room) return { error: "gone" };
  if (!room.seats.some((seat) => seat.id === playerId)) return { error: "not-member" };
  const wasConnected = isConnected(room, playerId);
  room.lastSeen.set(playerId, Date.now());
  touch(room);
  if (!wasConnected) broadcast(room); // presence just became active — let others know
  return { view: snapshotFor(room, playerId) };
}

export function joinRoom(code, body) {
  const room = getRoom(code);
  if (!room) return { error: "No game found with that code." };

  // Returning player: if a seat already belongs to this person, resume it
  // instead of adding a new one. This lets the same player come back after a
  // refresh, a lost session, or even after the game has started, and collapses
  // duplicate joins from repeated taps into one seat. Identity is the persistent
  // per-browser clientId, falling back to a matching name.
  const clientId = typeof body?.clientId === "string" ? body.clientId.slice(0, 64) : null;
  const name = sanitizeName(body?.name, "");
  const existing =
    (clientId && room.seats.find((seat) => seat.clientId === clientId)) ||
    (name && room.seats.find((seat) => seat.name.toLowerCase() === name.toLowerCase()));
  if (existing) {
    if (clientId && !existing.clientId) existing.clientId = clientId;
    touch(room);
    broadcast(room);
    return { room, playerId: existing.id, resumed: true };
  }

  if (room.status !== "lobby") return { error: "That game has already started. Rejoin with the same name to resume." };
  if (room.seats.length >= MAX_PLAYERS) return { error: "That game is full." };
  const made = makeSeat(body, room.seats.length);
  if (made.error) return { error: made.error };
  const seat = made.seat;
  room.seats.push(seat);
  touch(room);
  broadcast(room);
  return { room, playerId: seat.id };
}

export function updateSeat(code, playerId, body) {
  const room = getRoom(code);
  if (!room) return { error: "No game found with that code." };
  if (room.status !== "lobby") return { error: "You can only edit before the game starts." };
  const seat = room.seats.find((s) => s.id === playerId);
  if (!seat) return { error: "You are not in this game." };
  if (body.name !== undefined) seat.name = sanitizeName(body.name, seat.name);
  if (body.product !== undefined) {
    const validated = validateProductIdea(body.product);
    if (validated.error) return { error: validated.error };
    seat.product = validated.product;
  }
  if (body.budgetCap !== undefined) seat.budgetCap = sanitizeBudget(body.budgetCap);
  touch(room);
  broadcast(room);
  return { ok: true };
}

export function kickPlayer(code, hostId, targetId) {
  const room = getRoom(code);
  if (!room) return { error: "No game found with that code." };
  if (room.hostId !== hostId) return { error: "Only the host can remove players." };
  if (room.status !== "lobby") return { error: "You can only remove players before the game starts." };
  if (targetId === hostId) return { error: "The host cannot remove themselves." };
  const index = room.seats.findIndex((s) => s.id === targetId);
  if (index === -1) return { error: "That player is not in the game." };
  room.seats.splice(index, 1);
  const set = room.clients.get(targetId);
  if (set) {
    for (const res of set) {
      try {
        res.write("event: kicked\ndata: {}\n\n");
        res.end();
      } catch {
        /* ignore */
      }
    }
    room.clients.delete(targetId);
  }
  touch(room);
  broadcast(room);
  return { ok: true };
}

export function restartGame(code, hostId) {
  const room = getRoom(code);
  if (!room) return { error: "No game found with that code." };
  if (room.hostId !== hostId) return { error: "Only the host can start a new game." };
  if (room.status === "lobby") return { error: "The game has not started yet." };
  room.game = createGame(room.seats);
  room.status = "playing";
  touch(room);
  broadcast(room);
  return { ok: true };
}

export function startGame(code, playerId) {
  const room = getRoom(code);
  if (!room) return { error: "No game found with that code." };
  if (room.hostId !== playerId) return { error: "Only the host can start the game." };
  if (room.status !== "lobby") return { error: "The game has already started." };
  if (room.seats.length < MIN_PLAYERS) return { error: `Need at least ${MIN_PLAYERS} players to start.` };
  room.game = createGame(room.seats);
  room.status = "playing";
  touch(room);
  broadcast(room);
  return { ok: true };
}

export async function handleAction(code, playerId, action) {
  const room = getRoom(code);
  if (!room || !room.game) return { error: "No active game." };
  if (room.status !== "playing") return { error: "The game is not in progress." };
  const type = action?.type;

  if (type === "play_card") {
    const result = playCard(room.game, playerId, action.instanceId, action.targetId, {
      featureText: action.featureText,
      selectedFeatureName: action.selectedFeatureName,
    });
    if (!result.ok) return result;
    touch(room);
    broadcast(room);
    // User Feedback funds the idea pool: generate AI proposals in the background
    // and prepend them to the player's pool (no inline dialog, no extra charge).
    if (room.game.turn.lastCard?.id === "user-feedback") {
      const player = room.game.players.find((p) => p.id === playerId);
      if (player) {
        const isZh = /[一-鿿]/.test(player.product?.name || "");
        suggestFeatures({
          lang: isZh ? "zh" : "en",
          cardId: "user-feedback",
          product: player.product,
          existingFeatures: player.features.map((f) => f.name),
          tokenBudget: 400,
        })
          .then((res) => {
            const ideas = Array.isArray(res.features) ? res.features : [];
            const merged = [];
            const seen = new Set();
            for (const name of [...ideas, ...player.featurePool]) {
              const clean = String(name || "").trim();
              if (!clean || seen.has(clean)) continue;
              seen.add(clean);
              merged.push(clean);
            }
            player.featurePool = merged.slice(0, 10);
            touch(room);
            broadcast(room);
          })
          .catch((error) => console.warn(`feature proposal failed: ${error.message}`));
      }
    }
    // Consultant opens a paid offer; arm an auto-decline timeout while it's open.
    if (room.game.turn.lastCard?.id === "consultant" && room.game.pendingConsult) {
      armConsultTimeout(room, action.lang);
    }
    return { ok: true };
  }

  if (type === "end_turn") {
    return finishTurn(room, playerId, action.lang);
  }

  if (type === "respond_consult") {
    const result = respondConsult(room.game, playerId, Boolean(action.accept));
    if (!result.ok) return result;
    clearTimeout(room.consultTimer);
    touch(room);
    broadcast(room);
    if (result.accepted) armConsultTimeout(room, action.lang); // give the consultant time to write feedback
    if (result.declined && result.fromId) return finishTurn(room, result.fromId, action.lang);
    return { ok: true };
  }

  if (type === "submit_consult_feedback") {
    const result = submitConsultFeedback(room.game, playerId, action.feature);
    if (!result.ok) return result;
    clearTimeout(room.consultTimer);
    touch(room);
    broadcast(room);
    if (result.fromId) return finishTurn(room, result.fromId, action.lang);
    return { ok: true };
  }

  return { error: "Unknown action." };
}

// Ends a player's turn: ships the committed feature + progress, advances, then
// builds the artifact in the background. Shared by end_turn and consult resolution.
async function finishTurn(room, playerId, lang) {
  const prepared = prepareAutomaticSprint(room.game, playerId);
  if (!prepared.ok) return prepared;
  const result = endTurn(room.game, playerId);
  if (!result.ok) return result;
  if (room.game.phase === "finished") room.status = "finished";
  touch(room);
  broadcast(room);
  if (!prepared.skipped) {
    prepared.payload.language = lang === "zh" ? "zh" : "en";
    room.game.building = playerId;
    broadcast(room);
    buildArtifact(prepared.payload)
      .then((artifact) => commitSprintArtifact(room.game, playerId, artifact))
      .catch((error) => console.warn(`background build failed: ${error.message}`))
      .finally(() => {
        if (room.game.building === playerId) room.game.building = null;
        touch(room);
        broadcast(room);
      });
  }
  return { ok: true };
}

// Auto-decline a consult offer (and end the consultant's turn) if it stalls.
function armConsultTimeout(room, lang) {
  clearTimeout(room.consultTimer);
  const offer = room.game.pendingConsult;
  if (!offer) return;
  const fromId = offer.fromId;
  room.consultTimer = setTimeout(() => {
    if (room.game.pendingConsult && room.game.pendingConsult.fromId === fromId) {
      cancelConsult(room.game);
      broadcast(room);
      finishTurn(room, fromId, lang);
    }
  }, 30000);
  room.consultTimer.unref?.();
}

export async function suggestRoomFeatures(code, playerId, payload = {}) {
  const room = getRoom(code);
  if (!room || !room.game) return { error: "No active game." };
  if (room.status !== "playing") return { error: "The game is not in progress." };

  const charged = chargeFeatureSuggestion(room.game, playerId);
  if (!charged.ok) return charged;
  touch(room);
  broadcast(room);
  const result = await suggestFeatures({ ...payload, tokenBudget: charged.tokenBudget });
  touch(room);
  broadcast(room);
  return { ok: true, cost: charged.cost, tokenBudget: charged.tokenBudget, ...result };
}

export function addClient(code, playerId, res) {
  const room = getRoom(code);
  if (!room) return { error: "No game found with that code." };
  if (!room.seats.some((seat) => seat.id === playerId)) return { error: "You are not a member of this game." };

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-store",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write(": connected\n\n");

  if (!room.clients.has(playerId)) room.clients.set(playerId, new Set());
  room.clients.get(playerId).add(res);
  touch(room);
  sendState(res, snapshotFor(room, playerId));
  broadcast(room); // refresh lobby connection indicators for everyone

  const heartbeat = setInterval(() => {
    try {
      res.write(": ping\n\n");
    } catch {
      /* ignore */
    }
  }, 25000);
  heartbeat.unref?.();

  const cleanup = () => {
    clearInterval(heartbeat);
    const set = room.clients.get(playerId);
    if (set) {
      set.delete(res);
      if (!set.size) room.clients.delete(playerId);
    }
    broadcast(room);
  };
  res.on("close", cleanup);
  return { ok: true };
}

export function getArtifact(code, playerId, targetId) {
  const room = getRoom(code);
  if (!room || !room.game) return null;
  if (!room.seats.some((seat) => seat.id === playerId)) return null;
  return artifactFor(room.game, targetId || playerId);
}

// Serve a player's built app by id (for the hosted /app/:code/:playerId URL),
// viewable by anyone the host shares the link with.
export function getPlayerArtifact(code, playerId) {
  const room = getRoom(code);
  if (!room || !room.game) return null;
  return artifactFor(room.game, playerId);
}

function getRoom(code) {
  return rooms.get(String(code || "").toUpperCase()) || null;
}

function touch(room) {
  room.lastActivity = Date.now();
}

function isConnected(room, playerId) {
  const set = room.clients.get(playerId);
  if (set && set.size) return true; // active SSE stream
  const seen = room.lastSeen?.get(playerId) || 0;
  return Date.now() - seen < 6000; // polled within the last 6s
}

function snapshotFor(room, playerId) {
  if (room.status === "lobby" || !room.game) {
    return {
      status: "lobby",
      code: room.code,
      youId: playerId,
      hostId: room.hostId,
      isHost: room.hostId === playerId,
      canStart: room.seats.length >= MIN_PLAYERS,
      minPlayers: MIN_PLAYERS,
      maxPlayers: MAX_PLAYERS,
      players: room.seats.map((seat) => ({
        id: seat.id,
        name: seat.name,
        product: seat.product,
        isHost: seat.id === room.hostId,
        connected: isConnected(room, seat.id),
      })),
    };
  }
  return {
    status: room.status,
    code: room.code,
    isHost: room.hostId === playerId,
    ...viewFor(room.game, playerId),
    connected: Object.fromEntries(room.seats.map((seat) => [seat.id, isConnected(room, seat.id)])),
  };
}

function sendState(res, view) {
  try {
    res.write(`event: state\ndata: ${JSON.stringify(view)}\n\n`);
  } catch {
    /* client gone */
  }
}

function broadcast(room) {
  for (const [playerId, set] of room.clients) {
    const view = snapshotFor(room, playerId);
    for (const res of set) sendState(res, view);
  }
}

function pruneRooms() {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (now - room.lastActivity > ROOM_TTL_MS) {
      for (const set of room.clients.values()) {
        for (const res of set) {
          try {
            res.end();
          } catch {
            /* ignore */
          }
        }
      }
      rooms.delete(code);
    }
  }
}
