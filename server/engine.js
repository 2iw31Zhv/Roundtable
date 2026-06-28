// Authoritative Roundtable game engine (server side).
//
// This holds the full game state and rules. Clients never run rules; they send
// intents (play card, end turn) and render a redacted per-player
// view returned by viewFor().
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const CARD_LIBRARY = loadCardLibrary();

export const DEFAULT_BUDGET_CAP = 16;
export const BUDGET_OPTIONS = [8, 12, 16, 20, 24];
export const MAX_PLAYERS = 4;
export const MIN_PLAYERS = 2;

const COLORS = ["#167b73", "#be4b45", "#c78b25", "#725ca8", "#4f7fa8", "#8a6f2a"];
const HAND_SIZE = 5;
const MAX_ROUNDS = 7;
export const OUTPUT_TOKENS_PER_CREDIT = 800;
export const FEATURE_SUGGESTION_CREDIT_COST = 1;

// Flavor banner shown each round — one per round of a 7-round build-to-Demo-Day
// arc. No mechanical effect; purely atmosphere.
const ROUND_EVENTS = [
  { key: "kickoff", title: "Kickoff", text: "The idea is greenlit — start building." },
  { key: "firstbuild", title: "First Build", text: "Your first features take shape." },
  { key: "users", title: "Early Users", text: "Early users start trying your product." },
  { key: "growth", title: "Growth Spurt", text: "Word spreads and the product gains momentum." },
  { key: "crunch", title: "Crunch Time", text: "Heads down — ship as much as you can." },
  { key: "polish", title: "Polish", text: "Last refinements before the big reveal." },
  { key: "demo", title: "Demo Day", text: "Show the room what you built." },
];

const STARTER_IDEAS = [
  { name: "LaunchPad CRM", audience: "freelance operators", backlog: ["Contact pipeline", "Invoice generator", "Reminder inbox", "Client portal", "Revenue dashboard"] },
  { name: "KitchenFlow", audience: "busy home cooks", backlog: ["Recipe vault", "Pantry tracker", "Shopping list", "Weekly meal calendar", "Diet filters"] },
  { name: "HabitForge", audience: "self-improvement groups", backlog: ["Habit board", "Streak engine", "Group check-ins", "Insight charts", "Reward system"] },
  { name: "OpsLens", audience: "small SaaS teams", backlog: ["Incident timeline", "Customer impact map", "SLA dashboard", "Postmortem editor", "Alert routing"] },
];

function loadCardLibrary() {
  const path = fileURLToPath(new URL("../public/data/cards.json", import.meta.url));
  const cards = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(cards) || cards.length === 0) throw new Error("cards.json must be a non-empty array.");
  return cards.map((card) => ({ ...card, cost: Number(card.cost) }));
}

export function cardCatalog() {
  return CARD_LIBRARY.map((card) => ({ ...card }));
}

// ---- product helpers ---------------------------------------------------------

function inferAudience(idea) {
  const lower = idea.toLowerCase();
  if (/teacher|student|class|school|tutor|learn/.test(lower)) return "teachers and learners";
  if (/restaurant|food|recipe|kitchen|meal|cook/.test(lower)) return "food operators and home cooks";
  if (/client|crm|sales|lead|invoice/.test(lower)) return "sales and client teams";
  if (/fitness|habit|health|workout|wellness/.test(lower)) return "health-focused users";
  if (/finance|budget|expense|tax|money|grant/.test(lower)) return "finance operators";
  if (/game|stream|music|video|podcast|creator|art|studio/.test(lower)) return "creators and fans";
  if (/developer|api|code|bug|ops|incident|deploy/.test(lower)) return "software teams";
  return "the people who need this workflow";
}

function buildProductBacklog(idea) {
  const compact = idea.replace(/[<>]/g, "").trim() || "product";
  const lower = compact.toLowerCase();
  if (hasCjk(compact)) return chineseBacklog(compact);
  if (/draw|paint|sketch|image|photo|design|art|canvas|diagram/.test(lower)) {
    return ["Add brush and eraser tools", "Add color palette selector", "Add canvas size presets", "Add saved drawing gallery", "Add PNG export and share"];
  }
  if (/language|learn|study|tutor|class|school|lesson|quiz/.test(lower)) {
    return ["Add learner profile setup", "Add daily study schedule", "Add lesson progress tracker", "Add quiz review cards", "Add Chinese language option"];
  }
  if (/restaurant|food|recipe|kitchen|meal|cook|pantry/.test(lower)) {
    return ["Add recipe import form", "Add weekly meal calendar", "Add pantry inventory list", "Add shopping list export", "Add diet filter settings"];
  }
  if (/client|crm|sales|lead|invoice/.test(lower)) {
    return ["Add lead capture form", "Add client detail page", "Add invoice status tracker", "Add follow-up reminders", "Add revenue dashboard"];
  }
  return ["Add guided setup wizard", `Add ${compact} workspace`, "Add saved project history", "Add share link and export", "Add settings and notifications"];
}

function hasCjk(value) {
  return /[\u4e00-\u9fff]/.test(value);
}

function chineseBacklog(idea) {
  if (/画|图|绘|设计|照片|图片/.test(idea)) {
    return ["添加中文界面与导航", "添加画笔和橡皮工具", "添加颜色选择器", "添加作品保存列表", "添加图片导出与分享"];
  }
  if (/学|语言|课程|复习|单词|考试/.test(idea)) {
    return ["添加中文界面与导航", "添加学习目标设置", "添加每日学习计划", "添加复习卡片列表", "添加进度统计页面"];
  }
  if (/菜|食|餐|饭|厨房|食谱/.test(idea)) {
    return ["添加中文界面与导航", "添加食谱录入表单", "添加每周餐历", "添加购物清单", "添加口味筛选设置"];
  }
  return ["添加中文界面与导航", `添加「${idea}」主操作页`, "添加项目列表和详情页", "添加保存与历史记录", "添加分享与导出"];
}

// Concrete fallback "polish" features used when a player's backlog runs out, so
// shipped features stay itemized instead of an abstract "Launch polish N".
const POLISH_FEATURES_EN = [
  "Add empty-state guidance",
  "Add export settings",
  "Add notification preferences",
  "Add onboarding tips",
  "Add accessibility options",
  "Add dark mode toggle",
  "Add search and filters",
  "Add quick share sheet",
];
const POLISH_FEATURES_ZH = [
  "添加空状态引导",
  "添加导出设置",
  "添加通知偏好",
  "添加新手引导提示",
  "添加无障碍选项",
  "添加深色模式开关",
  "添加搜索与筛选",
  "添加快捷分享面板",
];

function sanitizeFeatureName(value) {
  return String(value || "")
    .replace(/[<>]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 80);
}

function productFromIdea(value, index = 0) {
  const fallback = STARTER_IDEAS[index % STARTER_IDEAS.length];
  const idea = String(value || fallback.name).trim().replace(/\s+/g, " ");
  const audience = inferAudience(idea);
  return {
    name: idea,
    audience,
    pitch: `A focused software product for ${audience} built around ${idea.toLowerCase()}.`,
    backlog: buildProductBacklog(idea),
  };
}

// ---- deck --------------------------------------------------------------------

function shuffle(cards) {
  const out = [...cards];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function instantiate(template) {
  return { ...template, instanceId: randomUUID() };
}

// Relative draw frequency per card. New Feature is the most common (it's the
// build engine); Acquire is the rarest, tuned so it shows up roughly twice per
// 7-round game across the table. Every draw — the weighted opening slots and
// every replacement — uses these weights.
const CARD_WEIGHTS = {
  "new-feature": 8,
  "user-feedback": 5,
  "cloud-credits": 5,
  consultant: 4,
  acquire: 2,
};
const WEIGHT_TOTAL = CARD_LIBRARY.reduce((sum, card) => sum + (CARD_WEIGHTS[card.id] || 1), 0);

function weightedCard() {
  let roll = Math.random() * WEIGHT_TOTAL;
  for (const card of CARD_LIBRARY) {
    roll -= CARD_WEIGHTS[card.id] || 1;
    if (roll < 0) return instantiate(card);
  }
  return instantiate(CARD_LIBRARY[CARD_LIBRARY.length - 1]);
}

function makeNewFeatureCard() {
  return instantiate(CARD_LIBRARY.find((card) => card.id === "new-feature"));
}

// Opening hand: one guaranteed New Feature (so you can always ship) plus the rest
// drawn by weight, shuffled so New Feature isn't always first.
function dealStartingHand() {
  const hand = [makeNewFeatureCard()];
  for (let i = 1; i < HAND_SIZE; i += 1) hand.push(weightedCard());
  return shuffle(hand);
}

function drawCard() {
  return weightedCard();
}

// ---- credits -----------------------------------------------------------------

function refreshCredits(player) {
  player.budgetCap = Number(player.budgetCap ?? DEFAULT_BUDGET_CAP);
  player.spentCredits = clamp(Number(player.spentCredits ?? 0), 0, player.budgetCap);
  player.earnedCredits = clamp(Number(player.earnedCredits ?? 0), 0, 99);
  player.credits = clamp(player.budgetCap - player.spentCredits + player.earnedCredits, 0, 999);
}

function usableCredits(player) {
  refreshCredits(player);
  return player.credits;
}

function spendCredits(player, amount) {
  const cost = Math.max(0, Math.round(amount));
  if (cost === 0) return true;
  refreshCredits(player);
  if (player.credits < cost) return false;
  const earnedSpend = Math.min(player.earnedCredits, cost);
  player.earnedCredits -= earnedSpend;
  player.spentCredits += cost - earnedSpend;
  refreshCredits(player);
  return true;
}

function grantCredits(player, amount) {
  player.earnedCredits = clamp(Math.round(player.earnedCredits + amount), 0, 99);
  refreshCredits(player);
}

export function tokenBudgetForCredits(credits) {
  return clamp(Math.round(Number(credits || 0) * OUTPUT_TOKENS_PER_CREDIT), 1, 20000);
}

export function chargeFeatureSuggestion(game, playerId) {
  const player = currentPlayer(game);
  if (!player || player.id !== playerId) return { ok: false, error: "It is not your turn." };
  if (usableCredits(player) < FEATURE_SUGGESTION_CREDIT_COST) return { ok: false, error: `Need ${FEATURE_SUGGESTION_CREDIT_COST} credit for AI ideas.` };
  spendCredits(player, FEATURE_SUGGESTION_CREDIT_COST);
  addLog(game, "featureIdeas", { name: player.name, cost: FEATURE_SUGGESTION_CREDIT_COST });
  return { ok: true, cost: FEATURE_SUGGESTION_CREDIT_COST, tokenBudget: tokenBudgetForCredits(FEATURE_SUGGESTION_CREDIT_COST), playerId: player.id };
}

function clampPlayer(player) {
  player.budgetCap = clamp(Math.round(player.budgetCap), 1, 99);
  player.spentCredits = clamp(Math.round(player.spentCredits), 0, player.budgetCap);
  player.earnedCredits = clamp(Math.round(player.earnedCredits), 0, 99);
  refreshCredits(player);
  player.progress = clamp(Math.round(player.progress), 0, 100);
  player.quality = clamp(Math.round(player.quality), 1, 10);
  player.market = clamp(Math.round(player.market), 1, 10);
  player.velocity = clamp(Math.round(player.velocity), 1, 10);
  player.techDebt = clamp(Math.round(player.techDebt), 0, 10);
  player.morale = clamp(Math.round(player.morale), 1, 10);
}

// ---- game lifecycle ----------------------------------------------------------

export function createGame(seats) {
  const players = seats.slice(0, MAX_PLAYERS).map((seat, index) => createPlayer(seat, index));
  const game = {
    phase: "playing",
    round: 1,
    maxRounds: MAX_ROUNDS,
    currentPlayerIndex: 0,
    roundEvent: ROUND_EVENTS[0],
    turn: freshTurn(),
    discardTop: null,
    discardCount: 0,
    building: null,
    pendingConsult: null,
    notice: { key: "dealt", params: { count: players.length } },
    log: [{ round: 1, key: "shuffled", params: {} }],
    players,
  };
  return game;
}

function createPlayer(seat, index) {
  const product = productFromIdea(seat.product, index);
  const player = {
    id: seat.id || `p${index + 1}`,
    seatId: seat.id || `p${index + 1}`,
    name: seat.name || `Player ${index + 1}`,
    color: COLORS[index % COLORS.length],
    product,
    budgetCap: clamp(Number(seat.budgetCap || DEFAULT_BUDGET_CAP), 1, 99),
    spentCredits: 0,
    earnedCredits: 0,
    credits: 0,
    progress: 0,
    quality: 5,
    market: 5,
    velocity: 5,
    techDebt: 0,
    morale: 5,
    features: [],
    backlog: [...product.backlog],
    featurePool: [],
    polishCount: 0,
    hand: dealStartingHand(),
    artifact: null,
    score: 0,
  };
  refreshCredits(player);
  return player;
}

function freshTurn() {
  return {
    cardPlayed: false,
    sprinted: false,
    lastCard: null,
    featureToShip: null,
    modifiers: { progress: 0, quality: 0, market: 0, extraFeature: 0 },
  };
}

function currentPlayer(game) {
  return game.players[game.currentPlayerIndex];
}

function playerById(game, id) {
  return game.players.find((player) => player.id === id) || null;
}

// ---- intents -----------------------------------------------------------------

export function playCard(game, playerId, instanceId, targetId, options = {}) {
  const actor = currentPlayer(game);
  if (!actor || actor.id !== playerId) return { ok: false, error: "It is not your turn." };
  if (game.turn.cardPlayed) return { ok: false, error: "You already played a card this turn." };
  const card = actor.hand.find((c) => c.instanceId === instanceId);
  if (!card) return { ok: false, error: "Card not in hand." };

  const target = resolveTarget(game, card, targetId);
  if (usableCredits(actor) < card.cost) return { ok: false, error: `Need ${card.cost} credits to play ${card.title}.` };

  spendCredits(actor, card.cost);
  actor.hand = actor.hand.filter((c) => c.instanceId !== card.instanceId);
  actor.hand.push(drawCard());
  applyCard(game, card, actor, target, options);
  clampPlayer(actor);
  if (target && target.id !== actor.id) clampPlayer(target);
  game.turn.cardPlayed = true;
  game.turn.lastCard = { id: card.id, title: card.title, icon: card.icon, tone: card.tone };
  game.discardTop = { id: card.id, title: card.title, icon: card.icon, tone: card.tone, by: actor.name };
  game.discardCount = (game.discardCount || 0) + 1;
  return { ok: true };
}

function resolveTarget(game, card, targetId) {
  if (card.target === "self") return currentPlayer(game);
  if (card.target === "global") return null;
  const explicit = targetId ? playerById(game, targetId) : null;
  if (explicit && (card.target === "any" || explicit.id !== currentPlayer(game).id)) return explicit;
  const fallback = game.players.find((p) => card.target === "any" || p.id !== currentPlayer(game).id);
  return fallback || currentPlayer(game);
}

export function prepareAutomaticSprint(game, playerId) {
  const player = currentPlayer(game);
  if (!player || player.id !== playerId) return { ok: false, error: "It is not your turn." };
  if (game.turn.sprinted) return { ok: false, error: "You already built this turn." };

  // Only build when a feature was committed this turn (via New Feature / Acquire).
  // A turn with just a strategy card (or nothing) does not rebuild the app.
  if (!game.turn.featureToShip) {
    game.turn.sprinted = true;
    return { ok: true, skipped: true, playerId: player.id };
  }

  const sprintSpend = automaticSprintSpend(game, player);
  if (sprintSpend < 1) {
    game.turn.sprinted = true;
    addLog(game, "buildSkipped", { name: player.name });
    return { ok: true, skipped: true, playerId: player.id };
  }
  return prepareSprintWithSpend(game, player, sprintSpend);
}

export function nextAutomaticSpend(game) {
  const player = currentPlayer(game);
  return player ? automaticSprintSpend(game, player) : 0;
}

function prepareSprintWithSpend(game, player, sprintSpend) {
  spendCredits(player, sprintSpend);
  const sprint = advanceProduct(game, player, sprintSpend);
  game.turn.sprinted = true;
  game.notice = { key: "shipped", params: { name: player.name, features: sprint.completed.map((f) => f.name) } };
  addLog(game, "sprintLog", {
    name: player.name,
    spend: sprintSpend,
    product: player.product.name,
    features: sprint.completed.length,
    perFeature: sprint.tokensPerFeature,
    progress: sprint.progressGain,
  });

  const payload = {
    round: game.round,
    roundEvent: game.roundEvent,
    currentCard: game.turn.lastCard,
    sprintSpend,
    tokenBudget: tokenBudgetForCredits(sprintSpend),
    sprint,
    player: clone(player),
    table: game.players.map((p) => ({ name: p.name, product: p.product.name, features: p.features.map((f) => f.name) })),
  };
  return { ok: true, sprint, sprintSpend, payload, playerId: player.id };
}

function automaticSprintSpend(game, player) {
  const credits = usableCredits(player);
  if (credits < 1) return 0;
  const remainingTurns = Math.max(1, game.maxRounds - game.round + 1);
  return clamp(Math.ceil(credits / remainingTurns), 1, credits);
}

export function commitSprintArtifact(game, playerId, artifact) {
  const player = playerById(game, playerId);
  if (player && artifact) player.artifact = artifact;
}

function advanceProduct(game, player, sprintSpend) {
  // Progress is driven only by the credits poured into this build: a small base
  // for shipping at all, plus 5 per credit, capped so one big turn can't finish
  // the product on its own.
  const progressGain = clamp(20 + sprintSpend * 5, 6, 45);
  player.progress = clamp(player.progress + progressGain, 0, 100);

  // Features are no longer invented by the build. A turn ships exactly the one
  // feature the player committed via New Feature / Acquire (turn.featureToShip),
  // or none. The whole turn's tokens go into that single feature.
  const completed = [];
  const tokensPerFeature = sprintSpend;
  if (game.turn.featureToShip) {
    const polish = clamp(Math.round(tokensPerFeature * 2 + player.quality / 3 - player.techDebt / 3), 1, 10);
    const feature = { name: game.turn.featureToShip, round: game.round, source: game.turn.lastCard?.title || game.roundEvent.title, tokens: tokensPerFeature, polish };
    player.features.push(feature);
    completed.push(feature);
  }

  player.quality = clamp(player.quality + game.turn.modifiers.quality + (completed[0]?.polish >= 8 ? 1 : 0) - (player.techDebt >= 7 ? 1 : 0), 1, 10);
  player.market = clamp(player.market + game.turn.modifiers.market, 1, 10);
  player.morale = clamp(player.morale + (player.progress >= 100 ? 1 : 0), 1, 10);
  clampPlayer(player);

  return {
    completed,
    progressGain,
    spend: sprintSpend,
    tokensPerFeature,
    summary: `${completed.length} feature${completed.length === 1 ? "" : "s"} shipped, ${progressGain}% progress`,
  };
}

export function endTurn(game, playerId) {
  const player = currentPlayer(game);
  if (!player || player.id !== playerId) return { ok: false, error: "It is not your turn." };

  if (game.currentPlayerIndex === game.players.length - 1) {
    if (game.round >= game.maxRounds) {
      game.phase = "finished";
      scorePlayers(game);
      assignAwards(game);
      addLog(game, "demoDay", {});
    } else {
      game.round += 1;
      game.currentPlayerIndex = 0;
      game.roundEvent = ROUND_EVENTS[(game.round - 1) % ROUND_EVENTS.length];
      addLog(game, "roundOpen", { round: game.round, event: game.roundEvent.key });
    }
  } else {
    game.currentPlayerIndex += 1;
  }
  game.turn = freshTurn();
  game.notice = null;
  return { ok: true };
}

function scorePlayers(game) {
  game.players.forEach((player) => {
    // Score is built only from the three stats players actually see:
    // progress, shipped features, and leftover credits.
    const thriftBonus = Math.min(10, usableCredits(player));
    player.score = Math.round(player.progress + player.features.length * 8 + thriftBonus);
  });
}

// End-of-game founder archetype per player, from the visible stats (shipped,
// progress, leftover credits vs starting budget). First match wins; the matching
// art lives in public/assets/awards/<id>.png.
function assignAwards(game) {
  const maxShipped = game.players.reduce((m, p) => Math.max(m, p.features.length), 0);
  game.players.forEach((player) => {
    player.award = pickAward(player, maxShipped);
  });
}

function pickAward(player, maxShipped) {
  const shipped = player.features.length;
  const credits = usableCredits(player);
  const start = player.budgetCap;
  if (shipped === 0 && credits > start) return "cashed-out"; // made money, built nothing
  if (shipped === 0) return "conservative"; // sat on the starting budget
  if (shipped >= 2 && shipped === maxShipped) return "machine"; // out-shipped everyone
  if (player.progress >= 100) return "finisher"; // took it to 100%
  if (credits <= 1) return "all-in"; // spent everything
  if (credits >= start / 2) return "lean"; // shipped while keeping half the budget
  return "steady";
}

// ---- card effects (ported verbatim from the original client) -----------------

function applyCard(game, card, actor, target, options = {}) {
  const featureText = sanitizeFeatureName(options.featureText);
  const selectedFeatureName = sanitizeFeatureName(options.selectedFeatureName);

  switch (card.id) {
    case "user-feedback":
      // No inline dialog: playing this just funds the idea pool. rooms.js runs
      // the AI proposal in the background and appends to actor.featurePool.
      addLog(game, "log.feedback", { name: actor.name });
      break;
    case "new-feature": {
      // Type your own, or pick from the pool (filled by User Feedback). With an
      // empty pool and nothing typed, no feature is added (no invented fallback).
      const fromPool = actor.featurePool.find((name) => name === selectedFeatureName);
      const name = featureText || fromPool || actor.featurePool[0] || "";
      if (name) {
        game.turn.featureToShip = name;
        actor.featurePool = actor.featurePool.filter((entry) => entry !== name);
        addLog(game, "log.newFeature", { name: actor.name, feature: name });
      }
      break;
    }
    case "consultant":
      // Open a paid-consult offer to the target; resolved via respond/submit.
      if (target && target.id !== actor.id) {
        game.pendingConsult = { fromId: actor.id, toId: target.id, price: 2, stage: "awaiting-response", createdAt: Date.now() };
        addLog(game, "log.consultOffer", { name: actor.name, target: target.name, price: 2 });
      }
      break;
    case "acquire": {
      // Acquire takes a feature the target has shipped — it DISAPPEARS from the
      // target and you ship an adapted copy. No typing; nothing to copy = no-op.
      let idx = target.features.findIndex((feature) => feature.name === selectedFeatureName);
      if (idx === -1 && target.features.length) idx = 0; // default to their first feature
      const taken = idx >= 0 ? target.features[idx] : null;
      if (taken) {
        target.features.splice(idx, 1);
        game.turn.featureToShip = `Adapt ${taken.name}`;
        actor.market += 1;
        grantCredits(target, 2);
        // The victim's built app no longer matches their features, so drop it.
        // It rebuilds on their next New Feature turn (or stays gone if they have
        // nothing left to ship).
        target.artifact = null;
        addLog(game, "log.acquire", { name: actor.name, target: target.name });
      } else {
        addLog(game, "log.acquireEmpty", { name: actor.name, target: target.name });
      }
      break;
    }
    case "cloud-credits":
      grantCredits(actor, 4);
      addLog(game, "log.cloudCredits", { name: actor.name });
      break;
  }

  clampPlayer(actor);
  if (target) clampPlayer(target);
}

function feedbackFeatureName(player) {
  return hasCjk(player.product?.name || "") ? "添加上手检查清单" : "Add first-run checklist";
}

// Fallback when New Feature is played with an empty pool and no typed name.
function newFeatureFallback(player) {
  const list = hasCjk(player.product?.name || "") ? POLISH_FEATURES_ZH : POLISH_FEATURES_EN;
  const used = player.polishCount || 0;
  player.polishCount = used + 1;
  return list[used % list.length];
}

function acquireFallbackFeature(target) {
  const product = target.product?.name || "their product";
  return hasCjk(product) ? `添加${product}导入` : `Add ${product} import`;
}

function addLog(game, key, params = {}) {
  game.log.unshift({ round: game.round, key, params });
  game.log = game.log.slice(0, 80);
}

// ---- consultant negotiation --------------------------------------------------

// Target accepts/declines a pending consult offer. Accept transfers the price
// from the client to the consultant and moves to the feedback stage.
export function respondConsult(game, playerId, accept) {
  const offer = game.pendingConsult;
  if (!offer || offer.stage !== "awaiting-response") return { ok: false, error: "No consult to respond to." };
  if (offer.toId !== playerId) return { ok: false, error: "This consult offer is not for you." };
  const consultant = playerById(game, offer.fromId);
  const client = playerById(game, offer.toId);
  if (!consultant || !client) {
    game.pendingConsult = null;
    return { ok: true, declined: true, fromId: offer.fromId };
  }
  if (!accept) {
    game.pendingConsult = null;
    addLog(game, "log.consultDeclined", { name: client.name, consultant: consultant.name });
    return { ok: true, declined: true, fromId: offer.fromId };
  }
  if (usableCredits(client) < offer.price) return { ok: false, error: `You need ${offer.price} credits to accept.` };
  spendCredits(client, offer.price);
  grantCredits(consultant, offer.price);
  clampPlayer(client);
  clampPlayer(consultant);
  offer.stage = "awaiting-feedback";
  addLog(game, "log.consultAccepted", { name: client.name, consultant: consultant.name, price: offer.price });
  return { ok: true, accepted: true, fromId: offer.fromId };
}

// Consultant submits the feature feedback, which lands in the client's pool.
export function submitConsultFeedback(game, playerId, feature) {
  const offer = game.pendingConsult;
  if (!offer || offer.stage !== "awaiting-feedback") return { ok: false, error: "No consult awaiting feedback." };
  if (offer.fromId !== playerId) return { ok: false, error: "Not your consult to write." };
  const consultant = playerById(game, offer.fromId);
  const client = playerById(game, offer.toId);
  const name = sanitizeFeatureName(feature);
  if (client && name) {
    client.featurePool = [name, ...client.featurePool.filter((entry) => entry !== name)].slice(0, 10);
    addLog(game, "log.consultFeature", { name: consultant?.name || "", target: client.name, feature: name });
  }
  game.pendingConsult = null;
  return { ok: true, fromId: offer.fromId };
}

// Drop a stale offer (e.g. timeout); returns the consultant id whose turn to end.
export function cancelConsult(game) {
  const offer = game.pendingConsult;
  if (!offer) return null;
  const client = playerById(game, offer.toId);
  const consultant = playerById(game, offer.fromId);
  // If the client already paid (the offer was accepted) but the consultant never
  // delivered the feature, refund the client and reclaim the fee from the consultant.
  if (offer.stage === "awaiting-feedback" && client && consultant) {
    grantCredits(client, offer.price);
    grantCredits(consultant, -offer.price);
    clampPlayer(client);
    clampPlayer(consultant);
  }
  addLog(game, "log.consultDeclined", { name: client?.name || "", consultant: consultant?.name || "" });
  game.pendingConsult = null;
  return offer.fromId;
}

// ---- views (redacted per player) ---------------------------------------------

export function viewFor(game, viewerId) {
  const current = currentPlayer(game);
  return {
    phase: game.phase,
    round: game.round,
    maxRounds: game.maxRounds,
    roundEvent: game.roundEvent,
    currentPlayerId: current ? current.id : null,
    isYourTurn: Boolean(current && current.id === viewerId),
    turn: { cardPlayed: game.turn.cardPlayed, sprinted: game.turn.sprinted, autoSpend: nextAutomaticSpend(game) },
    building: game.building,
    pendingConsult: game.pendingConsult,
    discardTop: game.discardTop,
    discardCount: game.discardCount,
    notice: game.notice,
    log: game.log.slice(0, 6),
    youId: viewerId,
    players: game.players.map((player) => publicPlayer(player, player.id === viewerId)),
    ranking: game.phase === "finished" ? [...game.players].sort((a, b) => b.score - a.score).map((p) => p.id) : null,
  };
}

function publicPlayer(player, isViewer) {
  const base = {
    id: player.id,
    name: player.name,
    color: player.color,
    product: { name: player.product.name, audience: player.product.audience, pitch: player.product.pitch },
    progress: player.progress,
    credits: usableCredits(player),
    handCount: player.hand.length,
    shipped: player.features.length,
    features: player.features.map((feature) => ({ name: feature.name, round: feature.round, source: feature.source, tokens: feature.tokens, polish: feature.polish })),
    backlogCount: player.backlog.length,
    latestFeature: player.features.length ? player.features[player.features.length - 1].name : null,
    score: player.score,
    appReady: Boolean(player.artifact) && player.features.length > 0,
    award: player.award || null,
  };
  if (isViewer) {
    base.hand = player.hand.map((card) => ({ ...card }));
    base.artifactReady = Boolean(player.artifact);
    base.featurePool = [...player.featurePool];
  }
  return base;
}

export function artifactFor(game, playerId) {
  const player = playerById(game, playerId);
  return player ? player.artifact : null;
}

// ---- utils -------------------------------------------------------------------

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
