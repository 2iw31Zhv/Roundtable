const STORAGE_KEY = "roundtable.game.v1";

const COLORS = ["#167b73", "#be4b45", "#c78b25", "#725ca8", "#4f7fa8", "#8a6f2a"];
const PLAYER_COUNT_OPTIONS = [2, 3, 4];
const BUDGET_OPTIONS = [8, 12, 16, 20, 24];
const DEFAULT_BUDGET_CAP = 16;
const OUTPUT_TOKENS_PER_CREDIT = 800;

const lang = (() => {
  try {
    const fromUrl = new URL(location.href).searchParams.get("lang");
    if (fromUrl === "zh" || fromUrl === "en") return fromUrl;
    return localStorage.getItem("roundtable.lang.v1") || (navigator.language?.toLowerCase().startsWith("zh") ? "zh" : "en");
  } catch {
    return "en";
  }
})();
const IS_ZH = lang === "zh";
document.documentElement.lang = IS_ZH ? "zh-CN" : "en";

const UI = {
  loadingDeck: IS_ZH ? "正在加载卡组……" : "Loading card deck...",
  cardDeckError: IS_ZH ? "卡组加载错误" : "Card Deck Error",
  checkCards: IS_ZH ? "请检查 data/cards.json，然后刷新页面。" : "Check data/cards.json, then reload the page.",
  player: IS_ZH ? "玩家" : "Player",
  productIdea: IS_ZH ? "产品创意" : "Product Idea",
  productPlaceholder: IS_ZH ? "任意创意：辅导 App、游戏工具、记账工具……" : "Anything: a tutoring app, game tool, finance tracker...",
  creditCap: IS_ZH ? "AI 点数上限" : "AI Credit Cap",
  credits: IS_ZH ? "点" : "credits",
  tagline: IS_ZH ? "用于交付软件的策略卡牌。" : "Strategy cards for shipping software.",
  setupTitle: IS_ZH ? "构建、谈判、交付。" : "Build, bargain, ship.",
  setupCopy: IS_ZH
    ? "2 到 4 人同屏游玩。每位玩家输入任意软件产品，回合结束时自动消耗点数构建，在牌桌上谈判，最终得到可运行原型。"
    : "Play hot-seat with 2-4 people. Each player types any software product they want, automatically spends credits at turn end, negotiates with the table, and finishes with a runnable prototype.",
  ruleIdea: IS_ZH ? "输入任意产品创意" : "Type any product idea",
  ruleCards: IS_ZH ? "打出策略卡牌" : "Play strategy cards",
  ruleSprint: IS_ZH ? "投入 AI 点数交付" : "Spend AI credits to ship",
  newGame: IS_ZH ? "新游戏" : "New Game",
  players: IS_ZH ? "玩家数" : "Players",
  currencyNotice: IS_ZH
    ? "货币：AI 点数。开始游戏会洗混策略卡组，并给每位玩家随机发 5 张牌。"
    : "Currency: AI credits. Start Game shuffles the strategy deck and deals 5 random cards to every player.",
  startGame: IS_ZH ? "开始游戏" : "Start Game",
  quickStart: IS_ZH ? "快速开始" : "Quick Start",
  round: IS_ZH ? "回合" : "Round",
  turn: IS_ZH ? "轮次" : "Turn",
  thisRound: IS_ZH ? "本回合" : "This round",
  checkAi: IS_ZH ? "检查 AI 构建器" : "Check AI builder",
  exportGame: IS_ZH ? "导出游戏" : "Export game",
  otherPlayers: IS_ZH ? "其他玩家" : "Other players",
  productBoard: IS_ZH ? "产品牌桌" : "Product board",
  yourControls: IS_ZH ? "你的操作区" : "Your turn controls",
  nothingShipped: IS_ZH ? "尚未交付任何功能" : "Nothing shipped yet",
  features: IS_ZH ? "功能" : "Features",
  noFeatures: IS_ZH ? "暂无功能" : "No features yet",
  shipped: IS_ZH ? "已交付" : "Shipped",
  quality: IS_ZH ? "质量" : "Quality",
  market: IS_ZH ? "市场" : "Market",
  creditsStat: IS_ZH ? "点数" : "Credits",
  debt: IS_ZH ? "技术债" : "Debt",
  preview: IS_ZH ? "预览" : "Preview",
  nowBuilding: IS_ZH ? "正在构建" : "Now building",
  cardsInHand: IS_ZH ? "张手牌" : "cards in hand",
  latest: IS_ZH ? "最新" : "Latest",
  tableLog: IS_ZH ? "牌桌日志" : "Table log",
  alreadyPlayed: IS_ZH ? "你本回合已经出过牌。结束回合时会自动构建。" : "You already played a card this turn. End your turn to build automatically.",
  selectHint: IS_ZH ? "点选一张手牌再出牌；结束回合会自动构建。" : "Tap one of your cards, then Play it; ending your turn builds automatically.",
  cardPlayed: IS_ZH ? "已出牌" : "Card played",
  noCard: IS_ZH ? "未选择卡牌" : "No card selected",
  yourTurn: IS_ZH ? "轮到你" : "Your turn",
  playCard: IS_ZH ? "出牌" : "Play card",
  turnTokens: IS_ZH ? "本回合点数" : "Turn tokens",
  building: IS_ZH ? "构建中……" : "Building…",
  endTurn: IS_ZH ? "结束回合" : "End turn",
  discard: IS_ZH ? "弃牌堆" : "Discard",
  noCardPlayed: IS_ZH ? "还没有人出牌" : "No card played yet",
  downloadPrototype: IS_ZH ? "下载原型" : "Download prototype",
  demoResults: IS_ZH ? "演示日结算" : "Demo day results.",
  leaderboard: IS_ZH ? "排行榜" : "Leaderboard",
  final: IS_ZH ? "最终" : "Final",
  finalProduct: IS_ZH ? "最终产品" : "Final Product",
  download: IS_ZH ? "下载" : "Download",
  generatedPreview: IS_ZH ? "生成产品预览" : "Generated product preview",
  target: IS_ZH ? "目标" : "TGT",
  all: IS_ZH ? "所有人" : "All",
  newGameConfirm: IS_ZH ? "开始一局新的 Roundtable 游戏？" : "Start a new Roundtable game?",
};

const STARTER_IDEAS = [
  {
    name: "LaunchPad CRM",
    audience: "freelance operators",
    pitch: "A small-client pipeline with reminders, invoices, and relationship notes.",
    backlog: ["Contact pipeline", "Invoice generator", "Reminder inbox", "Client portal", "Revenue dashboard"],
  },
  {
    name: "KitchenFlow",
    audience: "busy home cooks",
    pitch: "Meal planning, pantry tracking, and automatic shopping lists in one calm workflow.",
    backlog: ["Recipe vault", "Pantry tracker", "Shopping list", "Weekly meal calendar", "Diet filters"],
  },
  {
    name: "HabitForge",
    audience: "self-improvement groups",
    pitch: "A habit tracker with streaks, group accountability, and lightweight coaching.",
    backlog: ["Habit board", "Streak engine", "Group check-ins", "Insight charts", "Reward system"],
  },
  {
    name: "OpsLens",
    audience: "small SaaS teams",
    pitch: "A status center for incidents, customer impact, and postmortem follow-through.",
    backlog: ["Incident timeline", "Customer impact map", "SLA dashboard", "Postmortem editor", "Alert routing"],
  },
  {
    name: "GrantPilot",
    audience: "nonprofit operators",
    pitch: "A grant pipeline that tracks deadlines, funder fit, drafts, and reporting obligations.",
    backlog: ["Grant pipeline", "Funder matcher", "Deadline alerts", "Draft workspace", "Impact report builder"],
  },
  {
    name: "StudioDesk",
    audience: "independent creators",
    pitch: "A project hub for client briefs, asset review, approvals, and delivery milestones.",
    backlog: ["Brief intake", "Asset review board", "Approval tracker", "Milestone calendar", "Delivery portal"],
  },
];

const STARTER_IDEAS_ZH = [
  {
    name: "客户关系管家",
    audience: "自由职业者",
    pitch: "一个管理小客户流程、提醒、发票和关系备注的软件。",
    backlog: ["客户管线", "发票生成器", "提醒收件箱", "客户门户", "收入看板"],
  },
  {
    name: "厨房计划助手",
    audience: "忙碌的家庭厨师",
    pitch: "把餐食计划、库存追踪和自动购物清单放在一个清爽流程里。",
    backlog: ["食谱库", "库存追踪", "购物清单", "每周餐历", "饮食筛选"],
  },
  {
    name: "习惯工坊",
    audience: "自我提升小组",
    pitch: "带有连续记录、小组监督和轻量教练的习惯追踪器。",
    backlog: ["习惯看板", "连续记录引擎", "小组打卡", "洞察图表", "奖励系统"],
  },
  {
    name: "运维透镜",
    audience: "小型 SaaS 团队",
    pitch: "集中管理事故、客户影响和复盘跟进的状态中心。",
    backlog: ["事故时间线", "客户影响地图", "SLA 看板", "复盘编辑器", "告警路由"],
  },
  {
    name: "基金申请助手",
    audience: "非营利组织运营者",
    pitch: "追踪截止日期、资助方匹配、草稿和报告义务的申请管线。",
    backlog: ["申请管线", "资助方匹配", "截止提醒", "草稿工作区", "影响报告生成器"],
  },
  {
    name: "创作工作台",
    audience: "独立创作者",
    pitch: "管理客户简报、素材评审、审批和交付里程碑的项目中心。",
    backlog: ["简报收集", "素材评审板", "审批追踪", "里程碑日历", "交付门户"],
  },
];

let cardLibrary = [];
let cardLoadError = "";

const ROUND_EVENTS = [
  {
    title: "Enterprise Buyer",
    zhTitle: "企业买家",
    text: "Quality and admin-friendly features are worth more this round.",
    zhText: "本回合质量和便于管理的功能更值钱。",
  },
  {
    title: "Consumer Trend",
    zhTitle: "消费潮流",
    text: "Market pull and visual polish are worth more this round.",
    zhText: "本回合市场吸引力和视觉打磨更值钱。",
  },
  {
    title: "Cost Pressure",
    zhTitle: "成本压力",
    text: "Remaining credits matter more at the final scoring table.",
    zhText: "最终计分时，剩余点数更加重要。",
  },
  {
    title: "Platform Shift",
    zhTitle: "平台变迁",
    text: "Integrations and resilient architecture get extra credit.",
    zhText: "集成能力和稳健架构会获得额外加分。",
  },
  {
    title: "Demo Day",
    zhTitle: "演示日",
    text: "Progress and shipped features decide most of the room.",
    zhText: "进度和已交付功能将决定大部分结果。",
  },
];

let draftCount = 2;
if (new URL(location.href).searchParams.has("reset")) {
  localStorage.removeItem(STORAGE_KEY);
  history.replaceState(null, "", location.pathname);
}
let state = null;
let busy = false;

init();

async function init() {
  renderLoading(UI.loadingDeck);
  try {
    cardLibrary = validateCards(await loadCards());
    state = loadState();
    render();
  } catch (error) {
    cardLoadError = error?.message || UI.loadingDeck;
    render();
  }
}

document.addEventListener("click", async (event) => {
  const control = event.target.closest("[data-action]");
  if (!control) return;
  const action = control.dataset.action;
  const id = control.dataset.id;

  if (action === "start-game") startGameFromForm();
  if (action === "quick-start") startGame(defaultPlayers(draftCount));
  if (action === "reset-game") resetGame();
  if (action === "select-card") {
    if (event.detail > 1) return;
    selectCard(id);
  }
  if (action === "play-card") playSelectedCard();
  if (action === "end-turn") await endTurn();
  if (action === "select-preview") selectPreview(id);
  if (action === "download-artifact") downloadArtifact(id);
  if (action === "export-game") exportGame();
  if (action === "check-ai") await checkAi();
});

document.addEventListener("dblclick", (event) => {
  const cardControl = event.target.closest('[data-action="select-card"]');
  if (!cardControl) return;
  event.preventDefault();
  event.stopPropagation();
  playCardFromHand(cardControl.dataset.id);
});

document.addEventListener("change", (event) => {
  if (event.target.id === "player-count") {
    draftCount = cappedPlayerCount(event.target.value);
    render();
  }
  if (event.target.id === "target-select" && state) {
    state.selectedTargetId = event.target.value;
    saveState();
  }
});

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? migrateState(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function migrateState(parsed) {
  if (!parsed?.players) return parsed;
  parsed.players = parsed.players.slice(0, 4);
  parsed.currentPlayerIndex = clamp(Number(parsed.currentPlayerIndex || 0), 0, parsed.players.length - 1);
  parsed.players.forEach((player, index) => {
    player.product = normalizeProduct(player.product || player.productIdea || player.productIndex, index);
    if (player.budgetCap === undefined) player.budgetCap = Math.max(DEFAULT_BUDGET_CAP, Number(player.tokens || 0));
    if (player.spentCredits === undefined) {
      const priorCredits = Number(player.credits ?? player.tokens ?? player.budgetCap);
      player.spentCredits = clamp(player.budgetCap - priorCredits, 0, player.budgetCap);
    }
    if (player.earnedCredits === undefined) player.earnedCredits = 0;
    refreshCredits(player);
    player.hand = hydrateHand(player.hand);
  });
  if (parsed.turn) {
    delete parsed.turn.sprintSpend;
    parsed.turn.lastCard = parsed.turn.lastCard ? hydrateCard(parsed.turn.lastCard) : null;
  }
  return parsed;
}

function saveState() {
  if (state) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function render() {
  const app = document.querySelector("#app");
  if (cardLoadError) {
    app.innerHTML = renderLoadError();
    return;
  }
  if (!cardLibrary.length) {
    renderLoading(UI.loadingDeck);
    return;
  }
  if (!state) {
    app.innerHTML = renderSetup();
    return;
  }

  if (state.phase === "finished") {
    app.innerHTML = renderFinished();
    writePreviewFrame();
    return;
  }

  app.innerHTML = renderGame();
  writePreviewFrame();
}

function renderLoading(message) {
  const app = document.querySelector("#app");
  app.innerHTML = `
    <main class="setup">
      <section class="panel">
        <div class="panel-header"><h2>Roundtable</h2></div>
        <div class="panel-body"><div class="empty">${escapeHtml(message)}</div></div>
      </section>
    </main>
  `;
}

function renderLoadError() {
  return `
    <main class="setup">
      <section class="panel">
        <div class="panel-header"><h2>${escapeHtml(UI.cardDeckError)}</h2></div>
        <div class="panel-body">
          <div class="notice">${escapeHtml(cardLoadError)}</div>
          <p class="setup-copy">${escapeHtml(UI.checkCards)}</p>
        </div>
      </section>
    </main>
  `;
}

async function loadCards() {
  const response = await fetch("./data/cards.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`Could not load data/cards.json (${response.status}).`);
  return response.json();
}

function validateCards(cards) {
  if (!Array.isArray(cards) || cards.length === 0) throw new Error("data/cards.json must contain a non-empty array.");
  const seen = new Set();
  return cards.map((card) => {
    const required = ["id", "title", "type", "target", "cost", "icon", "tone", "text"];
    for (const field of required) {
      if (card[field] === undefined || card[field] === "") throw new Error(`Card is missing required field: ${field}`);
    }
    if (seen.has(card.id)) throw new Error(`Duplicate card id in data/cards.json: ${card.id}`);
    seen.add(card.id);
    if (!card.strategy?.summary) throw new Error(`Card ${card.id} needs strategy.summary.`);
    return {
      ...card,
      cost: Number(card.cost),
    };
  });
}

function cardById(id) {
  return cardLibrary.find((card) => card.id === id) || null;
}

function hydrateCard(savedCard) {
  const template = cardById(savedCard?.id);
  if (!template) return null;
  return {
    ...template,
    instanceId: savedCard.instanceId || crypto.randomUUID(),
  };
}

function hydrateHand(hand = []) {
  const hydrated = hand.map((card) => hydrateCard(card)).filter(Boolean);
  while (hydrated.length < 5) hydrated.push(drawCard());
  return hydrated.slice(0, 5);
}

function renderSetup() {
  const playerForms = Array.from({ length: draftCount }, (_, index) => {
    const product = starterIdea(index);
    return `
      <div class="player-form">
        <div class="field">
          <label for="player-name-${index}">${escapeHtml(UI.player)} ${index + 1}</label>
          <input id="player-name-${index}" value="${escapeHtml(defaultName(index))}" />
        </div>
        <div class="field">
          <label for="product-idea-${index}">${escapeHtml(UI.productIdea)}</label>
          <input id="product-idea-${index}" value="${escapeHtml(product.name)}" placeholder="${escapeAttribute(UI.productPlaceholder)}" />
        </div>
        <div class="field">
          <label for="budget-${index}">${escapeHtml(UI.creditCap)}</label>
          <select id="budget-${index}">
            ${BUDGET_OPTIONS.map(
              (amount) => `<option value="${amount}" ${amount === DEFAULT_BUDGET_CAP ? "selected" : ""}>${amount} ${escapeHtml(UI.credits)}</option>`,
            ).join("")}
          </select>
        </div>
      </div>
    `;
  }).join("");

  return `
    <main class="setup">
      <div class="setup-hero">
        <section>
          <div class="brand">
            <div class="mark">R</div>
            <div>
              <h1>Roundtable</h1>
              <p>${escapeHtml(UI.tagline)}</p>
            </div>
          </div>
          <h2 class="setup-title">${escapeHtml(UI.setupTitle)}</h2>
          <p class="setup-copy">${escapeHtml(UI.setupCopy)}</p>
          <div class="setup-rules">
            <div><strong>1</strong><span>${escapeHtml(UI.ruleIdea)}</span></div>
            <div><strong>2</strong><span>${escapeHtml(UI.ruleCards)}</span></div>
            <div><strong>3</strong><span>${escapeHtml(UI.ruleSprint)}</span></div>
          </div>
        </section>
        <section class="panel">
          <div class="panel-header">
            <h2>${escapeHtml(UI.newGame)}</h2>
            <div class="field" style="min-width:120px">
              <label for="player-count">${escapeHtml(UI.players)}</label>
              <select id="player-count">
                ${PLAYER_COUNT_OPTIONS
                  .map((count) => `<option value="${count}" ${count === draftCount ? "selected" : ""}>${count}</option>`)
                  .join("")}
              </select>
            </div>
          </div>
          <div class="panel-body setup-grid">
            <div class="notice">${escapeHtml(UI.currencyNotice)}</div>
            ${playerForms}
            <div class="two-col">
              <button class="button accent" data-action="start-game">${escapeHtml(UI.startGame)}</button>
              <button class="button secondary" data-action="quick-start">${escapeHtml(UI.quickStart)}</button>
            </div>
          </div>
        </section>
      </div>
    </main>
  `;
}

function renderGame() {
  const current = currentPlayer();
  const selected = selectedCard();
  return `
    <div class="game-app">
      <header class="game-hud">
        <div class="brand table-brand">
            <div class="mark">R</div>
            <div>
              <h1>Roundtable</h1>
              <p>${escapeHtml(UI.round)} ${state.round} / ${state.maxRounds} · ${escapeHtml(UI.turn)} ${state.currentPlayerIndex + 1} / ${state.players.length}</p>
            </div>
          </div>
        <div class="event-pill" title="${escapeAttribute(roundEventText(state.roundEvent))}">
          <span>${escapeHtml(UI.thisRound)}</span>
          <strong>${escapeHtml(roundEventTitle(state.roundEvent))}</strong>
        </div>
        <div class="hud-actions">
          <button class="icon-button" data-action="check-ai" title="${escapeAttribute(UI.checkAi)}">AI</button>
          <button class="icon-button" data-action="export-game" title="${escapeAttribute(UI.exportGame)}">⇩</button>
          <button class="icon-button danger" data-action="reset-game" title="${escapeAttribute(UI.newGame)}">↻</button>
        </div>
      </header>

      <main class="table-stage players-${state.players.length}" style="--player-color:${current.color}">
        <section class="opponent-rail seats-${state.players.length - 1}" aria-label="${escapeAttribute(UI.otherPlayers)}">
          ${state.players
            .filter((player) => player.id !== current.id)
            .map((player) => renderOpponentFan(player))
            .join("")}
        </section>

        <section class="felt-table" aria-label="${escapeAttribute(UI.productBoard)}">
          <div class="board-row seats-${state.players.length}">
            ${state.players.map((player) => renderBoardPlayer(player)).join("")}
          </div>
          <div class="felt-foot">
            ${renderDiscardPile()}
            ${renderActivityFeed()}
          </div>
          ${state.notice ? `<div class="table-toast">${escapeHtml(state.notice)}</div>` : ""}
        </section>
      </main>

      <section class="control-dock" aria-label="${escapeAttribute(UI.yourControls)}">
        ${renderActionBar(current, selected)}
        <div class="player-hand">
          ${current.hand.map((card) => renderCard(card, selected?.instanceId === card.instanceId)).join("")}
        </div>
      </section>
    </div>
  `;
}

function renderOpponentFan(player) {
  const cards = Math.min(player.hand.length, 5);
  const mid = (cards - 1) / 2;
  const fan = Array.from({ length: cards }, (_, index) => renderCardBack(index - mid)).join("");
  return `
    <div class="opp" style="--player-color:${player.color}" title="${escapeAttribute(`${player.name}: ${player.product.name}`)}">
      <div class="opp-fan" aria-label="${escapeAttribute(IS_ZH ? `${player.name} 持有 ${player.hand.length} 张牌` : `${player.name} holds ${player.hand.length} cards`)}">${fan}</div>
      <div class="opp-name">
        <span class="player-dot" style="--player-color:${player.color}">${escapeHtml(initials(player.name))}</span>
        <strong>${escapeHtml(player.name)}</strong>
      </div>
    </div>
  `;
}

function renderCardBack(offset) {
  const tilt = offset * 6;
  const lift = Math.abs(offset) * 7;
  return `<span class="card-back" style="--tilt:${tilt}deg;--lift:${lift}px"></span>`;
}

function renderBoardPlayer(player) {
  const isCurrent = player.id === currentPlayer().id;
  const isPreview = player.id === getPreviewPlayer().id;
  const shipped = player.features.length;
  const lastShipped = shipped ? featureText(player.features[shipped - 1].name) : UI.nothingShipped;
  const stats = [
    [UI.shipped, shipped, false],
    [UI.quality, player.quality, false],
    [UI.market, player.market, false],
    [UI.creditsStat, usableCredits(player), false],
    [UI.debt, player.techDebt, player.techDebt >= 6],
  ];
  return `
    <button class="board-player ${isCurrent ? "current" : ""} ${isPreview ? "previewing" : ""}" style="--player-color:${player.color}"
      data-action="select-preview" data-id="${player.id}" title="${escapeAttribute(`${UI.preview} ${player.product.name}`)}">
      <div class="bp-head">
        <span class="player-dot" style="--player-color:${player.color}">${escapeHtml(initials(player.name))}</span>
        <div class="bp-id">
          <strong>${escapeHtml(player.product.name)}</strong>
          <small>${escapeHtml(player.name)}</small>
        </div>
        ${isCurrent ? `<span class="bp-flag">${escapeHtml(UI.nowBuilding)}</span>` : `<span class="bp-hand" title="${player.hand.length} ${escapeAttribute(UI.cardsInHand)}">🂠 ${player.hand.length}</span>`}
      </div>
      <div class="bp-progress">
        <div class="bp-bar"><div style="width:${player.progress}%"></div></div>
        <span>${player.progress}%</span>
      </div>
      <div class="bp-stats">
        ${stats
          .map(([label, value, warn]) => `<div class="${warn ? "warn" : ""}"><strong>${value}</strong><span>${label}</span></div>`)
          .join("")}
      </div>
      ${renderFeatureList(player)}
      <div class="bp-latest" title="${escapeAttribute(lastShipped)}">${escapeHtml(UI.latest)}: ${escapeHtml(lastShipped)}</div>
    </button>
  `;
}

function renderFeatureList(player) {
  const features = (player.features || []).slice(-5).reverse();
  if (!features.length) {
    return `<div class="bp-features empty" title="${escapeAttribute(UI.features)}"><span>${escapeHtml(UI.noFeatures)}</span></div>`;
  }
  return `
    <div class="bp-features" title="${escapeAttribute(UI.features)}">
      ${features
        .map((feature) => {
          const name = featureText(feature.name);
          const polish = feature.polish ? ` P${feature.polish}` : "";
          const detail = feature.tokens ? `${name} - ${feature.tokens} ${UI.turnTokens}, P${feature.polish || "?"}` : name;
          return `<span class="bp-feature" title="${escapeAttribute(detail)}">${escapeHtml(`${name}${polish}`)}</span>`;
        })
        .join("")}
    </div>
  `;
}

function renderActivityFeed() {
  const items = (state.log || []).slice(0, 4);
  if (!items.length) return `<div class="activity-feed"></div>`;
  return `
    <div class="activity-feed">
      <span class="feed-label">${escapeHtml(UI.tableLog)}</span>
      ${items.map((line) => `<div class="feed-line">${escapeHtml(line)}</div>`).join("")}
    </div>
  `;
}

function renderActionBar(current, selected) {
  const hint = selected
    ? cardSummary(selected)
    : state.turn.cardPlayed
      ? UI.alreadyPlayed
      : UI.selectHint;
  const title = selected ? cardTitle(selected) : state.turn.cardPlayed ? UI.cardPlayed : UI.noCard;
  return `
    <div class="action-bar">
      <div class="ab-turn" style="--player-color:${current.color}">
        <span class="turn-pill">${escapeHtml(UI.yourTurn)}</span>
        <strong>${escapeHtml(current.name)}</strong>
        <small>${escapeHtml(current.product.name)}</small>
      </div>
      <div class="ab-selected" style="--tone:${selected?.tone || current.color}">
        <span class="ab-icon">${selected ? escapeHtml(selected.icon) : "·"}</span>
        <div class="ab-copy">
          <strong>${escapeHtml(title)}</strong>
          <small>${escapeHtml(hint)}</small>
        </div>
      </div>
      <div class="ab-controls">
        ${renderTargetOptions(selected)}
        ${renderTurnSpend(current)}
      </div>
      <div class="ab-buttons">
        <button class="game-button" data-action="play-card" ${!selected || state.turn.cardPlayed || busy ? "disabled" : ""}>${escapeHtml(UI.playCard)}</button>
        <button class="game-button accent" data-action="end-turn" ${busy ? "disabled" : ""}>${escapeHtml(busy ? UI.building : UI.endTurn)}</button>
      </div>
    </div>
  `;
}

function renderDiscardPile() {
  const top = state.discardTop;
  if (!top) {
    return `
      <div class="center-card discard-pile empty">
        <span class="discard-label">${escapeHtml(UI.discard)}</span>
        <div class="discard-empty">${escapeHtml(UI.noCardPlayed)}</div>
      </div>
    `;
  }
  const count = state.discardCount || 1;
  const title = cardTitle(top);
  return `
    <div class="center-card discard-pile" style="--tone:${top.tone}" title="${escapeAttribute(`${title} — ${top.by}`)}">
      <span class="discard-label">${escapeHtml(UI.discard)}${count > 1 ? ` · ${count}` : ""}</span>
      <div class="discard-card">
        <img class="discard-art" src="./assets/cards/${top.id}.png" alt="" />
        <div class="discard-meta">
          <span class="discard-icon">${escapeHtml(top.icon)}</span>
          <strong>${escapeHtml(title)}</strong>
        </div>
      </div>
    </div>
  `;
}

function renderProductMini(player) {
  const ringColor = player.color || "var(--teal)";
  const shipped = player.features.length;
  return `
    <div class="center-card product-mini" style="--ring:${ringColor}">
      <div class="mini-head">
        <strong title="${escapeAttribute(player.product.name)}">${escapeHtml(player.product.name)}</strong>
        <button class="icon-button small" data-action="download-artifact" data-id="${player.id}" title="${escapeAttribute(UI.downloadPrototype)}">⇩</button>
      </div>
      <div class="mini-body">
        <div class="mini-ring" style="--pct:${player.progress}">
          <span>${player.progress}%</span>
        </div>
        <div class="mini-facts">
          <div><strong>${shipped}</strong><span>${escapeHtml(UI.shipped)}</span></div>
          <div><strong>${player.backlog.length}</strong><span>${escapeHtml(IS_ZH ? "待开发" : "queued")}</span></div>
        </div>
      </div>
      <div class="preview-tabs">
        ${state.players
          .map(
            (candidate) =>
              `<button class="preview-chip ${candidate.id === player.id ? "active" : ""}" data-action="select-preview" data-id="${candidate.id}" title="${escapeAttribute(
                candidate.product.name,
              )}">${escapeHtml(initials(candidate.name))}</button>`,
          )
          .join("")}
      </div>
    </div>
  `;
}

function flyCardToDiscard(card, fromRect) {
  if (!fromRect || typeof document === "undefined") return;
  const dest = document.querySelector(".discard-pile");
  if (!dest) return;
  const toRect = dest.getBoundingClientRect();
  const ghost = document.createElement("div");
  ghost.className = "card-ghost";
  ghost.style.setProperty("--tone", card.tone);
  ghost.style.backgroundImage = `url("${cardArtPath(card)}")`;
  ghost.style.left = `${fromRect.left}px`;
  ghost.style.top = `${fromRect.top}px`;
  ghost.style.width = `${fromRect.width}px`;
  ghost.style.height = `${fromRect.height}px`;
  document.body.appendChild(ghost);
  const animation = ghost.animate(
    [
      { left: `${fromRect.left}px`, top: `${fromRect.top}px`, width: `${fromRect.width}px`, height: `${fromRect.height}px`, transform: "rotate(-4deg) scale(1)", opacity: 1, offset: 0 },
      { transform: "rotate(8deg) scale(1.04)", opacity: 1, offset: 0.55 },
      { left: `${toRect.left}px`, top: `${toRect.top}px`, width: `${toRect.width}px`, height: `${toRect.height}px`, transform: "rotate(12deg) scale(0.6)", opacity: 0.2, offset: 1 },
    ],
    { duration: 520, easing: "cubic-bezier(.55,.06,.4,1)" },
  );
  animation.onfinish = () => ghost.remove();
  animation.oncancel = () => ghost.remove();
}

function renderFinished() {
  const ranked = scorePlayers();
  const previewPlayer = getPreviewPlayer() || ranked[0];
  return `
    <div class="app">
      <header class="topbar">
        <div class="brand">
          <div class="mark">R</div>
          <div>
            <h1>Roundtable</h1>
            <p>${escapeHtml(UI.demoResults)}</p>
          </div>
        </div>
        <div class="top-actions">
          <button class="button secondary" data-action="export-game">${escapeHtml(UI.exportGame)}</button>
          <button class="button danger" data-action="reset-game">${escapeHtml(UI.newGame)}</button>
        </div>
      </header>
      <main class="shell" style="grid-template-columns:minmax(320px,.9fr) minmax(420px,1.1fr)">
        <section class="panel">
          <div class="panel-header"><h2>${escapeHtml(UI.leaderboard)}</h2><strong>${escapeHtml(UI.final)}</strong></div>
          <div class="panel-body leaderboard">
            ${ranked
              .map(
                (player, index) => `
                  <div class="leader">
                    <div class="rank">${index + 1}</div>
                    <div>
                      <h3 style="margin:0">${escapeHtml(player.name)}: ${escapeHtml(player.product.name)}</h3>
                      <p style="margin:4px 0 0;color:var(--muted)">${
                        IS_ZH
                          ? `${player.features.length} 项功能，进度 ${player.progress}%，质量 ${player.quality}，市场 ${player.market}`
                          : `${player.features.length} features, ${player.progress}% progress, quality ${player.quality}, market ${player.market}`
                      }</p>
                    </div>
                    <div class="score">${player.score}</div>
                  </div>
                `,
              )
              .join("")}
          </div>
        </section>
        <section class="panel">
          <div class="panel-header">
            <h2>${escapeHtml(UI.finalProduct)}</h2>
            <button class="button slim secondary" data-action="download-artifact" data-id="${previewPlayer.id}">${escapeHtml(UI.download)}</button>
          </div>
          <div class="panel-body">
            <div class="preview-list">
              ${ranked
                .map(
                  (player) =>
                    `<button class="button slim ${player.id === previewPlayer.id ? "accent" : "secondary"}" data-action="select-preview" data-id="${player.id}">${escapeHtml(
                      player.name,
                    )}</button>`,
                )
                .join("")}
            </div>
            <iframe class="preview-frame" id="preview-frame" title="${escapeAttribute(UI.generatedPreview)}"></iframe>
          </div>
        </section>
      </main>
    </div>
  `;
}

function renderCard(card, selected) {
  const title = cardTitle(card);
  return `
    <button class="card face-card ${selected ? "selected" : ""}" style="--tone:${card.tone}" data-action="select-card" data-id="${card.instanceId}" title="${escapeAttribute(
      `${title}: ${cardText(card)}`,
    )}">
      <img class="card-art" src="${cardArtPath(card)}" alt="" />
      <div class="card-top">
        <span class="card-icon">${escapeHtml(card.icon)}</span>
        <span class="card-cost">${card.cost}</span>
      </div>
      <h3>${escapeHtml(title)}</h3>
      <small>${escapeHtml(cardType(card))}</small>
    </button>
  `;
}

function cardArtPath(card) {
  return `./assets/cards/${card.id}.png`;
}

function renderTargetOptions(card) {
  if (!card || card.target === "self" || card.target === "global") {
    return `<div class="field compact-field"><label>${escapeHtml(UI.target)}</label><select disabled><option>${card?.target === "global" ? escapeHtml(UI.all) : escapeHtml(currentPlayer().name)}</option></select></div>`;
  }
  const players = ensureDefaultTarget(card);
  const selected = state.selectedTargetId;
  return `
    <div class="field">
      <label for="target-select">${escapeHtml(UI.target)}</label>
      <select id="target-select">
        ${players
          .map((player) => `<option value="${player.id}" ${player.id === selected ? "selected" : ""}>${escapeHtml(player.name)}</option>`)
          .join("")}
      </select>
    </div>
  `;
}

function ensureDefaultTarget(card) {
  if (!card || card.target === "self" || card.target === "global") {
    state.selectedTargetId = null;
    return [];
  }
  const players = state.players.filter((player) => card.target === "any" || player.id !== currentPlayer().id);
  if (!state.selectedTargetId || !players.some((player) => player.id === state.selectedTargetId)) {
    state.selectedTargetId = players[0]?.id || null;
  }
  return players;
}

function renderTurnSpend(player) {
  return `<div class="field compact-field"><label>${escapeHtml(UI.turnTokens)}</label><select disabled><option>${automaticSprintSpend(player)}</option></select></div>`;
}


function startGameFromForm() {
  const players = Array.from({ length: draftCount }, (_, index) => {
    const name = document.querySelector(`#player-name-${index}`)?.value.trim() || defaultName(index);
    const productIdea = document.querySelector(`#product-idea-${index}`)?.value.trim() || starterIdea(index).name;
    const budgetCap = Number(document.querySelector(`#budget-${index}`)?.value || DEFAULT_BUDGET_CAP);
    return { name, productIdea, budgetCap };
  });
  startGame(players);
}

function startGame(players) {
  const tablePlayers = players.slice(0, 4);
  const dealer = createDealer();
  state = {
    phase: "playing",
    round: 1,
    maxRounds: 7,
    currentPlayerIndex: 0,
    selectedCardId: null,
    selectedTargetId: null,
    selectedPreviewId: null,
    roundEvent: ROUND_EVENTS[0],
    turn: freshTurn(),
    discardTop: null,
    discardCount: 0,
    notice: IS_ZH ? `已向 ${tablePlayers.length} 位玩家随机发了 5 张策略牌。` : `Dealt 5 random strategy cards to ${tablePlayers.length} player${tablePlayers.length === 1 ? "" : "s"}.`,
    apiStatus: null,
    log: [IS_ZH ? "牌桌洗混了策略卡组，并给每位玩家发了 5 张牌。" : `The table shuffled the strategy deck and dealt 5 random cards to each player.`],
    players: tablePlayers.map((player, index) =>
      createPlayer(index, player.name, player.productIdea ?? player.product?.name ?? player.productIndex, player.budgetCap, dealer),
    ),
  };
  state.selectedPreviewId = state.players[0].id;
  saveState();
  render();
}

function defaultPlayers(count) {
  return Array.from({ length: cappedPlayerCount(count) }, (_, index) => ({
    name: defaultName(index),
    productIdea: starterIdea(index).name,
    budgetCap: DEFAULT_BUDGET_CAP,
  }));
}

function createPlayer(index, name, productInput, budgetCap = DEFAULT_BUDGET_CAP, dealer = null) {
  const product = normalizeProduct(productInput, index);
  const player = {
    id: `p${index + 1}`,
    name,
    color: COLORS[index % COLORS.length],
    product: clone(product),
    budgetCap,
    spentCredits: 0,
    earnedCredits: 0,
    credits: budgetCap,
    progress: 0,
    quality: 5,
    market: 5,
    velocity: 5,
    techDebt: 0,
    morale: 5,
    features: [],
    backlog: [...product.backlog],
    hand: [],
    artifact: null,
    score: 0,
  };
  player.hand = dealer ? dealHand(dealer, 5) : drawCards(5);
  player.artifact = localArtifact(player, { completed: [], summary: IS_ZH ? "初始概念。" : "Initial concept." });
  return player;
}

function freshTurn() {
  return {
    cardPlayed: false,
    sprinted: false,
    lastCard: null,
    modifiers: {
      progress: 0,
      quality: 0,
      market: 0,
      extraFeature: 0,
    },
  };
}

function selectCard(instanceId) {
  if (state.turn.cardPlayed) {
    notice(IS_ZH ? "本回合已经使用过一张策略牌。" : "This turn already used a strategy card.");
    return;
  }
  state.selectedCardId = instanceId;
  state.selectedTargetId = null;
  saveState();
  render();
}

function playCardFromHand(instanceId) {
  if (!state || busy) return;
  if (state.turn.cardPlayed) {
    notice(IS_ZH ? "本回合已经使用过一张策略牌。" : "This turn already used a strategy card.");
    return;
  }
  const actor = currentPlayer();
  const card = actor.hand.find((candidate) => candidate.instanceId === instanceId);
  if (!card) return;
  state.selectedCardId = instanceId;
  ensureDefaultTarget(card);
  playSelectedCard();
}

function playSelectedCard() {
  if (busy) return;
  const actor = currentPlayer();
  const card = selectedCard();
  if (!card) return;
  const target = resolveTarget(card);
  if (usableCredits(actor) < card.cost) {
    notice(
      IS_ZH
        ? `${actor.name} 需要 ${card.cost} 点才能打出「${cardTitle(card)}」。`
        : `${actor.name} needs ${card.cost} credit${card.cost === 1 ? "" : "s"} to play ${card.title}.`,
    );
    return;
  }

  const sourceEl = document.querySelector(`.player-hand [data-id="${card.instanceId}"]`);
  const fromRect = sourceEl ? sourceEl.getBoundingClientRect() : null;

  spendCredits(actor, card.cost);
  actor.hand = actor.hand.filter((candidate) => candidate.instanceId !== card.instanceId);
  actor.hand.push(drawCard());
  applyCard(card, actor, target);
  clampPlayer(actor);
  if (target && target.id !== actor.id) clampPlayer(target);
  state.turn.cardPlayed = true;
  state.turn.lastCard = card;
  pushDiscard(card, actor);
  state.selectedCardId = null;
  state.selectedTargetId = null;
  saveState();
  render();
  flyCardToDiscard(card, fromRect);
}

function pushDiscard(card, actor) {
  state.discardTop = {
    id: card.id,
    title: card.title,
    icon: card.icon,
    tone: card.tone,
    by: actor.name,
  };
  state.discardCount = (state.discardCount || 0) + 1;
}

async function runSprint() {
  if (busy || state.turn.sprinted) return;
  const player = currentPlayer();
  const sprintSpend = automaticSprintSpend(player);
  if (usableCredits(player) < 1) {
    state.turn.sprinted = true;
    addLog(IS_ZH ? `${player.name} 已没有点数可用于构建。` : `${player.name} had no tokens left to build.`);
    return true;
  }

  busy = true;
  state.notice = IS_ZH ? `${player.name} 的 AI 团队正在消耗 ${sprintSpend} 点构建……` : `${player.name}'s AI team is building with ${sprintSpend} token${sprintSpend === 1 ? "" : "s"}...`;
  render();

  spendCredits(player, sprintSpend);
  const sprint = advanceProduct(player, sprintSpend);
  const payload = {
    round: state.round,
    roundEvent: state.roundEvent,
    currentCard: state.turn.lastCard,
    sprintSpend,
    tokenBudget: sprintSpend * OUTPUT_TOKENS_PER_CREDIT,
    sprint,
    language: lang,
    player,
    table: state.players.map((candidate) => ({
      name: candidate.name,
      product: candidate.product.name,
      features: candidate.features.map((feature) => feature.name),
    })),
  };

  let artifact;
  try {
    const response = await fetch("/api/build", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(`Build endpoint returned ${response.status}`);
    artifact = await response.json();
  } catch {
    artifact = localArtifact(player, sprint);
  }

  player.artifact = normalizeArtifact(player, artifact);
  state.turn.sprinted = true;
  state.selectedPreviewId = player.id;
  state.notice = IS_ZH
    ? `${player.name} 交付了${sprint.completed.length ? sprint.completed.map((item) => `「${featureText(item.name)}」`).join("、") : "一次打磨"}。`
    : `${player.name} shipped ${sprint.completed.length ? sprint.completed.map((item) => item.name).join(", ") : "a polish pass"}.`;
  addLog(
    IS_ZH
      ? `${player.name} 为「${player.product.name}」消耗 ${sprintSpend} 点：${sprint.completed.length} 项功能，每项 ${sprint.tokensPerFeature} 点，进度 +${sprint.progressGain}%。`
      : `${player.name} spent ${sprintSpend} token${sprintSpend === 1 ? "" : "s"} on ${player.product.name}: ${sprint.summary}`,
  );
  busy = false;
  saveState();
  render();
  return true;
}

function automaticSprintSpend(player) {
  const credits = usableCredits(player);
  if (credits < 1) return 0;
  const remainingTurns = Math.max(1, state.maxRounds - state.round + 1);
  return clamp(Math.ceil(credits / remainingTurns), 1, credits);
}

// Concrete fallback "polish" features when the backlog runs out, so shipped
// features stay itemized instead of an abstract "Launch polish N".
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

function advanceProduct(player, sprintSpend) {
  const progressGain = clamp(
    8 + sprintSpend * 5 + player.velocity * 2 + player.morale - player.techDebt * 2 + state.turn.modifiers.progress,
    6,
    46,
  );
  player.progress = clamp(player.progress + progressGain, 0, 100);

  const slots =
    1 +
    state.turn.modifiers.extraFeature +
    (sprintSpend >= 4 ? 1 : 0) +
    (player.velocity >= 8 && player.techDebt < 6 ? 1 : 0);
  const completed = [];
  const tokensPerFeature = Number((sprintSpend / Math.max(1, slots)).toFixed(1));
  let polishUsed = player.polishCount || 0;
  for (let index = 0; index < slots; index += 1) {
    let name = player.backlog.shift();
    if (!name) {
      const list = IS_ZH ? POLISH_FEATURES_ZH : POLISH_FEATURES_EN;
      name = list[polishUsed % list.length];
      polishUsed += 1;
    }
    const polish = clamp(Math.round(tokensPerFeature * 2 + player.quality / 3 - player.techDebt / 3), 1, 10);
    const feature = {
      name,
      round: state.round,
      source: state.turn.lastCard?.title || state.roundEvent.title,
      tokens: tokensPerFeature,
      polish,
    };
    player.features.push(feature);
    completed.push(feature);
  }
  player.polishCount = polishUsed;

  const averagePolish = completed.length ? completed.reduce((sum, feature) => sum + feature.polish, 0) / completed.length : 0;
  player.quality = clamp(player.quality + state.turn.modifiers.quality + (averagePolish >= 8 ? 1 : 0) - (averagePolish <= 3 && completed.length > 1 ? 1 : 0) - (player.techDebt >= 7 ? 1 : 0), 1, 10);
  player.market = clamp(player.market + state.turn.modifiers.market + (completed.length > 1 ? 1 : 0), 1, 10);
  player.techDebt = clamp(player.techDebt + (completed.length > 1 && tokensPerFeature < 2.5 ? 1 : 0), 0, 10);
  player.morale = clamp(player.morale + (player.progress >= 100 ? 1 : 0), 1, 10);
  clampPlayer(player);

  return {
    completed,
    progressGain,
    spend: sprintSpend,
    tokensPerFeature,
    summary: IS_ZH
      ? `完成 ${completed.length} 项功能，每项 ${tokensPerFeature} 点，进度 +${progressGain}%`
      : `${completed.length} feature${completed.length === 1 ? "" : "s"} completed, ${tokensPerFeature} tokens/feature, ${progressGain}% progress gained`,
  };
}

function applyCard(card, actor, target) {
  switch (card.id) {
    case "user-feedback":
      actor.backlog.unshift(feedbackFeatureName(actor));
      actor.quality += 1;
      actor.market += 1;
      state.turn.modifiers.quality += 1;
      addLog(IS_ZH ? `${actor.name} 把用户反馈纳入了路线图。` : `${actor.name} folded user feedback into the roadmap.`);
      break;
    case "consultant":
      if (target.id !== actor.id && usableCredits(target) >= 2) {
        spendCredits(target, 2);
        grantCredits(actor, 2);
        target.quality += 2;
        addLog(IS_ZH ? `${actor.name} 为 ${target.name} 做了咨询。` : `${actor.name} consulted for ${target.name}.`);
      } else {
        actor.quality += 1;
        actor.techDebt -= 1;
        addLog(IS_ZH ? `${actor.name} 把咨询时间用在了内部。` : `${actor.name} used consulting time internally.`);
      }
      break;
    case "acquire": {
      const copied = target.features[0]?.name || target.backlog[0] || acquireFallbackFeature(target);
      actor.backlog.unshift(IS_ZH ? `改造：${featureText(copied)}` : `Adapt ${copied}`);
      actor.market += 1;
      grantCredits(target, 2);
      addLog(IS_ZH ? `${actor.name} 从 ${target.name} 收购了一个功能点子。` : `${actor.name} acquired a feature idea from ${target.name}.`);
      break;
    }
    case "cloud-credits":
      grantCredits(actor, 4);
      addLog(IS_ZH ? `${actor.name} 领取了云额度。` : `${actor.name} claimed cloud credits.`);
      break;
  }

  clampPlayer(actor);
  if (target) clampPlayer(target);
}

function feedbackFeatureName(player) {
  return IS_ZH || /[\u4e00-\u9fff]/.test(player.product?.name || "") ? "添加上手检查清单" : "Add first-run checklist";
}

function acquireFallbackFeature(target) {
  const product = target.product?.name || "their product";
  return IS_ZH || /[\u4e00-\u9fff]/.test(product) ? `添加${product}导入` : `Add ${product} import`;
}

async function endTurn() {
  if (busy) return;
  if (!state.turn.sprinted) {
    const built = await runSprint();
    if (!built && busy) return;
  }
  if (state.currentPlayerIndex === state.players.length - 1) {
    if (state.round >= state.maxRounds) {
      state.phase = "finished";
      scorePlayers();
      addLog(IS_ZH ? "演示日结束，牌桌为每个产品打了分。" : "Demo day finished. The table scored every product.");
    } else {
      state.round += 1;
      state.currentPlayerIndex = 0;
      state.roundEvent = ROUND_EVENTS[(state.round - 1) % ROUND_EVENTS.length];
      addLog(IS_ZH ? `第 ${state.round} 回合开始：${roundEventTitle(state.roundEvent)}。` : `Round ${state.round} opened: ${state.roundEvent.title}.`);
    }
  } else {
    state.currentPlayerIndex += 1;
  }
  state.turn = freshTurn();
  state.selectedCardId = null;
  state.selectedTargetId = null;
  state.notice = "";
  saveState();
  render();
}

function scorePlayers() {
  state.players.forEach((player) => {
    const integrationBonus = player.features.filter((feature) => /integration|api|vendor/i.test(feature.name)).length * 4;
    const thriftBonus = Math.min(10, usableCredits(player));
    player.score = Math.round(
      player.progress +
        player.features.length * 8 +
        player.quality * 6 +
        player.market * 6 +
        player.morale * 2 +
        thriftBonus -
        player.techDebt * 5 +
        integrationBonus,
    );
  });
  return [...state.players].sort((a, b) => b.score - a.score);
}

function selectedCard() {
  if (!state?.selectedCardId) return null;
  return currentPlayer().hand.find((card) => card.instanceId === state.selectedCardId) || null;
}

function currentPlayer() {
  return state.players[state.currentPlayerIndex];
}

function resolveTarget(card) {
  if (card.target === "self") return currentPlayer();
  if (card.target === "global") return null;
  return state.players.find((player) => player.id === state.selectedTargetId) || currentPlayer();
}

function selectPreview(id) {
  state.selectedPreviewId = id;
  saveState();
  render();
}

function getPreviewPlayer() {
  return state.players.find((player) => player.id === state.selectedPreviewId) || state.players[0];
}

function writePreviewFrame() {
  const frame = document.querySelector("#preview-frame");
  if (!frame || !state) return;
  const player = getPreviewPlayer();
  frame.srcdoc = player.artifact?.html || localArtifact(player, { completed: [], summary: "" }).html;
}

async function checkAi() {
  try {
    const response = await fetch("/api/health");
    state.apiStatus = await response.json();
  } catch {
    state.apiStatus = { apiConfigured: false };
  }
  saveState();
  render();
}

function downloadArtifact(id) {
  const player = state.players.find((candidate) => candidate.id === id);
  if (!player) return;
  const artifact = player.artifact || localArtifact(player, { completed: [], summary: "" });
  const blob = new Blob([artifact.html], { type: "text/html" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${slug(player.product.name)}.html`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function exportGame() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "roundtable-game.json";
  link.click();
  URL.revokeObjectURL(link.href);
}

function resetGame() {
  if (!confirm(UI.newGameConfirm)) return;
  localStorage.removeItem(STORAGE_KEY);
  state = null;
  render();
}

function normalizeArtifact(player, artifact) {
  if (!artifact?.html) return localArtifact(player, { completed: [], summary: "" });
  return {
    mode: artifact.mode || "offline",
    html: artifact.html,
    notes: artifact.notes || "",
    files: artifact.files || { "index.html": artifact.html },
  };
}

function localArtifact(player, sprint) {
  const html = phoneAppHtml({
    color: player.color,
    name: player.product.name,
    pitch: localizePitch(player.product),
    audience: localizeAudience(player.product.audience),
    progress: player.progress,
    quality: player.quality,
    market: player.market,
    credits: usableCredits(player),
    features: player.features.map((feature) => featureText(feature.name)),
    backlog: player.backlog.slice(0, 4).map(featureText),
    noteText: "",
  });
  void sprint;
  return {
    mode: "offline",
    html,
    notes: IS_ZH ? "由本地 Roundtable 构建器生成。" : "Generated by the local Roundtable builder.",
    files: {
      "index.html": html,
      "README.md": IS_ZH ? `# ${player.product.name}\n\n这是在 Roundtable 中构建的移动应用。\n\n${localizePitch(player.product)}\n` : `# ${player.product.name}\n\nA mobile app built in Roundtable.\n\n${player.product.pitch}\n`,
      "product.json": JSON.stringify(player, null, 2),
    },
  };
}

function phoneLabels() {
  return IS_ZH
    ? {
        untitled: "未命名应用",
        everyone: "所有用户",
        pitch: "一个新的移动应用。",
        conceptValidated: "概念已验证",
        roadmapClear: "路线图已明确",
        notes: "说明",
        workflowComplete: "流程已完成，面向用户交付。",
        open: "打开",
        build: "构建",
        quality: "质量",
        market: "市场",
        credits: "点数",
        shipped: "已交付",
        comingSoon: "待开发",
        home: "首页",
        stats: "数据",
        you: "我的",
      }
    : {
        untitled: "Untitled app",
        everyone: "everyone",
        pitch: "A new mobile app.",
        conceptValidated: "Concept validated",
        roadmapClear: "Roadmap is clear",
        notes: "Notes",
        workflowComplete: "Workflow complete — built for your users.",
        open: "Open",
        build: "Build",
        quality: "Quality",
        market: "Market",
        credits: "Credits",
        shipped: "Shipped",
        comingSoon: "Coming soon",
        home: "Home",
        stats: "Stats",
        you: "You",
      };
}

// Shared phone-app template. Mirrors server/build.js: a single self-contained
// mobile screen that detects iOS vs Android at runtime and switches typography,
// corner radius, and chrome to match. Keep both copies in sync.
function phoneAppHtml(o) {
  const labels = phoneLabels();
  const accent = o.color;
  const name = escapeHtml(o.name || labels.untitled);
  const audience = escapeHtml(o.audience || labels.everyone);
  const pitch = escapeHtml(o.pitch || labels.pitch);
  const shipped = o.features.length
    ? o.features.map((f) => `<div class="row"><span class="tick">✓</span>${escapeHtml(f)}</div>`).join("")
    : `<div class="row"><span class="tick">✓</span>${labels.conceptValidated}</div>`;
  const backlog = o.backlog.length
    ? o.backlog.map((f) => `<div class="row todo"><span class="tick">+</span>${escapeHtml(f)}</div>`).join("")
    : `<div class="row todo"><span class="tick">+</span>${labels.roadmapClear}</div>`;
  const note = o.noteText
    ? `<section class="block"><h2>${labels.notes}</h2><div class="note">${escapeHtml(o.noteText)}</div></section>`
    : "";
  const ctaEcho = jsString(IS_ZH ? `流程已完成，面向${o.audience || labels.everyone}交付。` : `Workflow complete — built for ${o.audience || "your users"}.`);
  const ctaLabel = IS_ZH ? `${labels.open}${name}` : `${labels.open} ${name}`;
  return `<!doctype html>
<html lang="${IS_ZH ? "zh-CN" : "en"}" data-os="web">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="${accent}" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="apple-mobile-web-app-title" content="${name}" />
  <title>${name}</title>
  <style>
    :root{--accent:${accent};--card:#fff;--ink:#10160f;--muted:#7b857a;--line:#e7ebe5;--radius:22px;
      --font:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
    *{box-sizing:border-box}
    html,body{margin:0;height:100%}
    body{font-family:var(--font);color:var(--ink);background:#c6cfc7;display:flex;align-items:flex-start;
      justify-content:center;min-height:100vh;min-height:100dvh}
    .phone{position:relative;width:100%;max-width:430px;min-height:100vh;min-height:100dvh;background:#f4f7f3;
      display:flex;flex-direction:column;overflow:hidden}
    @media(min-width:520px){
      body{padding:28px;align-items:center;background:radial-gradient(circle at 50% -10%,#eef2ed,#bcc6bd)}
      .phone{min-height:auto;height:860px;max-height:92vh;border-radius:46px;
        box-shadow:0 30px 80px rgba(10,20,12,.35),0 0 0 12px #0c100d,0 0 0 13px #2c332c}
    }
    .statusbar{height:46px;display:flex;align-items:center;justify-content:space-between;
      padding:0 22px;font-size:.78rem;font-weight:800}
    .statusbar .sig{display:flex;gap:5px;align-items:center}
    .statusbar .sig i{width:7px;height:7px;border-radius:50%;background:var(--ink);display:block}
    .statusbar .sig i:nth-child(3){opacity:.35}
    .appbar{padding:4px 22px 12px}
    .appbar .eyebrow{font-size:.68rem;letter-spacing:.16em;text-transform:uppercase;color:var(--accent);font-weight:800}
    .appbar h1{margin:5px 0 0;font-size:1.7rem;line-height:1.05;font-weight:850;letter-spacing:-.02em}
    .screen{flex:1;min-height:0;overflow:auto;padding:2px 16px 18px;-webkit-overflow-scrolling:touch}
    .hero{background:linear-gradient(150deg,var(--accent),#11150f);color:#fff;border-radius:var(--radius);
      padding:20px;margin:6px 2px 16px;box-shadow:0 16px 30px rgba(17,21,15,.22)}
    .hero p{margin:0 0 16px;line-height:1.5;font-size:.98rem;opacity:.96}
    .cta{appearance:none;-webkit-appearance:none;border:0;cursor:pointer;background:#fff;color:var(--ink);
      font-weight:850;font-size:1rem;font-family:inherit;padding:13px 18px;border-radius:14px;width:100%}
    .cta:active{transform:translateY(1px)}
    .said{margin:12px 2px 0;min-height:18px;font-weight:700;font-size:.9rem}
    .stats{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin:0 2px 18px}
    .stat{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:14px 16px}
    .stat b{display:block;font-size:1.55rem;font-weight:900;color:var(--accent);line-height:1}
    .stat span{display:block;margin-top:6px;font-size:.68rem;letter-spacing:.05em;text-transform:uppercase;
      color:var(--muted);font-weight:800}
    .block{margin:0 2px 18px}
    .block h2{font-size:.74rem;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);
      margin:0 6px 8px;font-weight:800}
    .rows{background:var(--card);border:1px solid var(--line);border-radius:18px;overflow:hidden}
    .row{display:flex;align-items:center;gap:12px;padding:13px 16px;border-top:1px solid var(--line);
      font-size:.95rem;font-weight:600}
    .row:first-child{border-top:0}
    .row .tick{width:22px;height:22px;border-radius:50%;background:#eef3ee;color:var(--accent);display:grid;
      place-items:center;font-size:.8rem;font-weight:900;flex:none}
    .row.todo{color:var(--muted);font-weight:500}
    .row.todo .tick{background:#eef1ec;color:var(--muted)}
    .note{background:#11160f;color:#e7efe3;border-radius:18px;padding:14px 16px;font-size:.84rem;
      white-space:pre-wrap;line-height:1.5}
    .tabbar{display:flex;justify-content:space-around;align-items:center;
      padding:9px 8px calc(9px + env(safe-area-inset-bottom));background:rgba(255,255,255,.92);
      backdrop-filter:blur(12px);border-top:1px solid var(--line)}
    .tab{display:flex;flex-direction:column;align-items:center;gap:3px;font-size:.6rem;font-weight:700;
      color:var(--muted);flex:1}
    .tab.on{color:var(--accent)}
    .tab .ic{font-size:1.15rem;line-height:1}
    html[data-os=ios]{--font:-apple-system,"SF Pro Text",system-ui,sans-serif;--radius:22px}
    html[data-os=ios] .appbar h1{letter-spacing:-.03em}
    html[data-os=ios] .cta{border-radius:980px}
    html[data-os=android]{--font:Roboto,"Google Sans","Segoe UI",system-ui,sans-serif;--radius:14px}
    html[data-os=android] .hero,html[data-os=android] .stat,html[data-os=android] .rows,
    html[data-os=android] .note{border-radius:14px}
    html[data-os=android] .cta{border-radius:10px;text-transform:uppercase;letter-spacing:.05em;font-size:.9rem}
    html[data-os=android] .appbar h1{font-weight:800}
    html[data-os=android] .tabbar{background:#fff}
  </style>
</head>
<body>
  <div class="phone">
    <div class="statusbar"><span id="clock">9:41</span>
      <span class="sig"><i></i><i></i><i></i><b style="margin-left:4px">5G</b></span></div>
    <div class="appbar"><div class="eyebrow">${audience}</div><h1>${name}</h1></div>
    <main class="screen">
      <section class="hero">
        <p>${pitch}</p>
        <button class="cta" id="cta">${ctaLabel}</button>
        <div class="said" id="said"></div>
      </section>
      <div class="stats">
        <div class="stat"><b>${escapeHtml(o.progress)}%</b><span>${labels.build}</span></div>
        <div class="stat"><b>${escapeHtml(o.quality)}</b><span>${labels.quality}</span></div>
        <div class="stat"><b>${escapeHtml(o.market)}</b><span>${labels.market}</span></div>
        <div class="stat"><b>${escapeHtml(o.credits)}</b><span>${labels.credits}</span></div>
      </div>
      <section class="block"><h2>${labels.shipped}</h2><div class="rows">${shipped}</div></section>
      <section class="block"><h2>${labels.comingSoon}</h2><div class="rows">${backlog}</div></section>
      ${note}
    </main>
    <nav class="tabbar">
      <div class="tab on"><span class="ic">⌂</span>${labels.home}</div>
      <div class="tab"><span class="ic">✦</span>${labels.build}</div>
      <div class="tab"><span class="ic">▦</span>${labels.stats}</div>
      <div class="tab"><span class="ic">◍</span>${labels.you}</div>
    </nav>
  </div>
  <script>
    (function(){
      var ua=navigator.userAgent||"";
      var os=/android/i.test(ua)?"android":(/iphone|ipad|ipod/i.test(ua)||(/Macintosh/.test(ua)&&navigator.maxTouchPoints>1))?"ios":"web";
      document.documentElement.setAttribute("data-os",os);
      try{var d=new Date();document.getElementById("clock").textContent=d.getHours()+":"+String(d.getMinutes()).padStart(2,"0");}catch(e){}
      var cta=document.getElementById("cta"),said=document.getElementById("said");
      if(cta)cta.addEventListener("click",function(){if(said)said.textContent=${ctaEcho};});
    })();
  </script>
</body>
</html>`;
}

// Encode a string as a safe JS string literal for embedding inside <script>.
function jsString(value) {
  return JSON.stringify(String(value ?? "")).replace(/</g, "\\u003c");
}

function drawCards(count) {
  return Array.from({ length: count }, () => drawCard());
}

function drawCard() {
  const template = cardLibrary[Math.floor(Math.random() * cardLibrary.length)];
  return { ...template, instanceId: crypto.randomUUID() };
}

function createDealer() {
  return {
    deck: shuffleCards(cardLibrary),
  };
}

function dealHand(dealer, count) {
  return Array.from({ length: count }, () => dealCard(dealer));
}

function dealCard(dealer) {
  if (!dealer.deck.length) dealer.deck = shuffleCards(cardLibrary);
  const template = dealer.deck.pop();
  return { ...template, instanceId: crypto.randomUUID() };
}

function shuffleCards(cards) {
  const shuffled = [...cards];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function addLog(message) {
  state.log.unshift(`R${state.round}: ${message}`);
  state.log = state.log.slice(0, 80);
}

function notice(message) {
  state.notice = message;
  saveState();
  render();
}

function clampPlayer(player) {
  if (player.budgetCap === undefined) player.budgetCap = DEFAULT_BUDGET_CAP;
  if (player.spentCredits === undefined) player.spentCredits = 0;
  if (player.earnedCredits === undefined) player.earnedCredits = 0;
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

function refreshCredits(player) {
  player.budgetCap = Number(player.budgetCap ?? DEFAULT_BUDGET_CAP);
  player.spentCredits = clamp(Number(player.spentCredits ?? 0), 0, player.budgetCap);
  player.earnedCredits = clamp(Number(player.earnedCredits ?? 0), 0, 99);
  player.credits = clamp(player.budgetCap - player.spentCredits + player.earnedCredits, 0, 999);
}

function prioritizeBacklog(backlog) {
  const priorityWords = ["dashboard", "portal", "revenue", "security", "privacy", "integration", "premium", "insight"];
  return [...backlog].sort((a, b) => scoreBacklog(b, priorityWords) - scoreBacklog(a, priorityWords));
}

function scoreBacklog(item, words) {
  const lower = item.toLowerCase();
  return words.reduce((score, word) => score + (lower.includes(word) ? 1 : 0), 0);
}

function marketFeature(player) {
  const options = ["analytics", "automation", "collaboration", "export", "admin controls"];
  return `${player.product.name} ${options[player.features.length % options.length]}`;
}

function normalizeProduct(input, index = 0) {
  if (typeof input === "object" && input?.name) {
    const product = productFromIdea(input.name, index);
    return {
      ...product,
      ...input,
      backlog: Array.isArray(input.backlog) && input.backlog.length ? [...input.backlog] : product.backlog,
    };
  }
  if (typeof input === "number") return clone(starterIdea(input));
  return productFromIdea(input, index);
}

function productFromIdea(value, index = 0) {
  const fallback = starterIdea(index);
  const idea = String(value || fallback.name).trim().replace(/\s+/g, " ");
  const audience = inferAudience(idea);
  return {
    name: idea,
    audience: localizeAudience(audience),
    pitch: IS_ZH ? `一个面向${localizeAudience(audience)}的软件产品，围绕「${idea}」打造核心流程。` : `A focused software product for ${audience} built around ${idea.toLowerCase()}.`,
    backlog: buildProductBacklog(idea),
  };
}

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
  const compact = idea.replace(/[<>]/g, "").trim() || (IS_ZH ? "产品" : "product");
  const lower = compact.toLowerCase();
  if (IS_ZH || /[\u4e00-\u9fff]/.test(compact)) return chineseBacklog(compact);
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

function starterIdea(index) {
  const ideas = IS_ZH ? STARTER_IDEAS_ZH : STARTER_IDEAS;
  return ideas[index % ideas.length];
}

function roundEventTitle(event) {
  return IS_ZH ? event?.zhTitle || event?.title || "" : event?.title || "";
}

function roundEventText(event) {
  return IS_ZH ? event?.zhText || event?.text || "" : event?.text || "";
}

function cardTitle(card) {
  const base = cardById(card?.id) || card;
  return IS_ZH ? base?.zh?.title || base?.title || "" : base?.title || "";
}

function cardText(card) {
  const base = cardById(card?.id) || card;
  return IS_ZH ? base?.zh?.text || base?.text || "" : base?.text || "";
}

function cardSummary(card) {
  const base = cardById(card?.id) || card;
  return IS_ZH ? base?.zh?.strategy?.summary || base?.strategy?.summary || cardText(base) : base?.strategy?.summary || base?.text || "";
}

function cardType(card) {
  const base = cardById(card?.id) || card;
  if (IS_ZH) {
    const types = { Engineering: "工程", Market: "市场", Table: "牌桌", Resource: "资源" };
    return base?.zh?.type || types[base?.type] || base?.type || "";
  }
  return base?.type || "";
}

function featureText(value) {
  const name = String(value || "");
  if (!IS_ZH) return name;
  const direct = {
    "User onboarding": "用户上手",
    "Data model and dashboard": "数据模型与看板",
    "Sharing or collaboration": "分享与协作",
    "Launch polish": "发布打磨",
    "Onboarding friction fix": "上手摩擦修复",
    "Concept validated": "概念已验证",
    "Roadmap is clear": "路线图已明确",
    "Add guided setup wizard": "添加引导设置向导",
    "Add learner profile setup": "添加学习者档案设置",
    "Add daily study schedule": "添加每日学习计划",
    "Add lesson progress tracker": "添加课程进度追踪",
    "Add quiz review cards": "添加测验复习卡片",
    "Add Chinese language option": "添加中文语言选项",
    "Add first-run checklist": "添加首次使用清单",
    "Add feedback form": "添加反馈表单",
    "Add result explanation panel": "添加结果解释面板",
    "Add main workspace": "添加主工作区",
    "Add saved history": "添加保存历史",
    "Add share export": "添加分享导出",
    "Add saved project history": "添加项目保存历史",
    "Add share link and export": "添加分享链接与导出",
    "Add settings and notifications": "添加设置与通知",
  };
  if (direct[name]) return direct[name];
  let match = name.match(/^Add guided setup for (.+)$/);
  if (match) return `为「${match[1]}」添加引导设置`;
  match = name.match(/^Add (.+) workspace$/);
  if (match) return `添加「${match[1]}」工作区`;
  match = name.match(/^(.+) core workflow$/);
  if (match) return `「${match[1]}」核心流程`;
  match = name.match(/^Adapt (.+)$/);
  if (match) return `改造：${featureText(match[1])}`;
  match = name.match(/^(.+) workflow$/);
  if (match) return `「${match[1]}」工作流`;
  match = name.match(/^Launch polish(?: (\d+))?$/);
  if (match) return `发布打磨${match[1] ? ` ${match[1]}` : ""}`;
  return name;
}

function localizeAudience(value) {
  if (!IS_ZH) return value;
  const audiences = {
    "teachers and learners": "教师和学习者",
    "food operators and home cooks": "餐饮经营者和家庭厨师",
    "sales and client teams": "销售与客户团队",
    "health-focused users": "关注健康的用户",
    "finance operators": "财务与预算管理者",
    "creators and fans": "创作者和粉丝",
    "software teams": "软件团队",
    "the people who need this workflow": "需要这个流程的人",
  };
  return audiences[value] || value || "所有用户";
}

function localizePitch(product) {
  if (!IS_ZH) return product.pitch;
  return `一个面向${localizeAudience(product.audience)}的移动应用，围绕「${product.name}」打造核心流程。`;
}

function defaultName(index) {
  return IS_ZH ? `玩家 ${index + 1}` : `Player ${index + 1}`;
}

function cappedPlayerCount(count) {
  return clamp(Number(count) || 2, 2, 4);
}

function initials(value) {
  return String(value || "?")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "product";
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[char];
  });
}

function escapeAttribute(value) {
  return escapeHtml(String(value ?? "").replace(/\\/g, ""));
}
