// Online multiplayer client. The server is authoritative; this client renders a
// redacted per-player view delivered over Server-Sent Events and POSTs intents.
const SESSION_KEY = "roundtable.online.v1";
const BUDGET_OPTIONS = [8, 12, 16, 20, 24];
const DEFAULT_BUDGET = 16;

let session = loadSession(); // { code, playerId, name, product, budgetCap }
let draft = { name: session?.name || "", product: session?.product || "", budgetCap: session?.budgetCap || DEFAULT_BUDGET, code: session?.code || "" };
let view = null; // latest server view (lobby or game)
let pollTimer = null; // setTimeout handle for the polling loop
let pollFails = 0;
let lastViewSig = ""; // signature of the last rendered view, to skip no-op re-renders
let connectionError = "";
let connecting = false; // showing the connecting/joining spinner
let connectingLabel = "connecting"; // i18n key
let toast = "";
let toastTimer = null;

const clientId = getOrCreateClientId(); // persists across sessions so a returning player resumes their seat
const urlParams = new URL(location.href).searchParams;
const prefillCode = (urlParams.get("code") || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
if (prefillCode) draft.code = prefillCode; // a shared link's code always wins over a saved one
if (urlParams.get("name")) draft.name = urlParams.get("name").slice(0, 40);
if (urlParams.get("product")) draft.product = urlParams.get("product").slice(0, 80);

function getOrCreateClientId() {
  try {
    let id = localStorage.getItem("roundtable.clientId.v1");
    if (!id) {
      id = crypto?.randomUUID ? crypto.randomUUID() : `c${Date.now()}${Math.random().toString(36).slice(2)}`;
      localStorage.setItem("roundtable.clientId.v1", id);
    }
    return id;
  } catch {
    return `c${Date.now()}`;
  }
}
const ui = {
  selected: null,
  target: null,
  spend: 2,
  preview: null,
  editing: false,
  homeMode: "join",
  featurePick: "",
  featureText: "",
  featureSuggestionKey: "",
  featureSuggestions: [],
  featureSuggestionsLoading: false,
  consultFeature: "",
};

// ---- i18n (per-player, client-side; independent of other players) ------------

let lang = (() => {
  try {
    const fromUrl = new URL(location.href).searchParams.get("lang");
    if (fromUrl === "zh" || fromUrl === "en") return fromUrl;
    return localStorage.getItem("roundtable.lang.v1") || (navigator.language?.toLowerCase().startsWith("zh") ? "zh" : "en");
  } catch {
    return "en";
  }
})();
document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";

const STR = {
  en: {
    tagline: "Build software products with AI, together.",
    join: "Join a game",
    host: "Host a game",
    yourName: "Your name",
    yourProduct: "Your product idea",
    gameCode: "Game code",
    creditCap: "AI credit cap",
    credits: "{n} credits",
    joinBtn: "Join game",
    createBtn: "Create game",
    hostHint: "You'll get a code to share so friends can join.",
    playLocal: "Play on one device instead →",
    phName: "e.g. Alex",
    phProduct: "e.g. AI meal planner for busy families",
    productRequired: "Enter a specific product idea before joining.",
    productGeneric: "Use a real product idea, not Roundtable or a generic placeholder.",
    phCode: "5-letter code",
    lobby: "Game lobby",
    leave: "Leave",
    shareCode: "Share this code",
    copyCode: "Copy code",
    codeCopied: "Game code copied.",
    inRoom: "Players in the room ({n}/{max}):",
    you: "you",
    hostBadge: "Host",
    noIdeaYet: "Still choosing an idea…",
    startGame: "Start game",
    needPlayers: "Need {n}+ players",
    waitingHost: "Waiting for the host to start the game…",
    save: "Save",
    cancel: "Cancel",
    connecting: "Connecting…",
    joiningGame: "Joining game…",
    creatingGame: "Creating game…",
    reconnecting: "Reconnecting…",
    connectHint: "This can take a few seconds over a shared link.",
    enterCode: "Enter a game code to join.",
    noLongerIn: "You're no longer in this game.",
    cantReach: "Couldn't reach that game. It may have ended — try the link again.",
    roundOf: "Round {round} / {max} · Code {code}",
    thisRound: "This round",
    nowBuilding: "Now building",
    offline: "offline",
    now: "now",
    shipped: "Shipped",
    creditsStat: "Credits",
    latest: "Latest: {x}",
    nothingShipped: "Nothing shipped yet",
    features: "Features",
    noFeatures: "No features yet",
    featureChoice: "Feature",
    aiIdeas: "AI ideas",
    generateIdeas: "AI ideas -1",
    ideasLoading: "Thinking…",
    ideasCharged: "AI ideas cost 1 credit.",
    needIdeaCredit: "Need 1 credit for AI ideas.",
    noIdeasYet: "Generate ideas",
    customFeature: "Custom",
    featurePlaceholder: "Type feature…",
    yourTurn: "Your turn",
    waiting: "Waiting",
    waitingFor: "Waiting for {name}",
    watchHint: "Watch the board. You can preview any product while you wait.",
    cardPlayed: "Card played",
    cardPlayedHint: "End your turn to spend this turn's tokens and build.",
    selectHint: "Tap a card to select it; ending your turn builds automatically.",
    noCard: "No card selected",
    target: "Target",
    spend: "Turn tokens",
    everyone: "Everyone",
    nothingToAcquire: "No features to acquire",
    consultTitle: "Consulting",
    consultOffer: "{name} offers to consult for {price} credits.",
    consultAccept: "Accept · pay {price}",
    consultDecline: "Decline",
    consultCantAfford: "You need {price} credits to accept.",
    consultWaitingResponse: "Waiting for {name} to respond…",
    consultWaitingFeature: "Waiting for {name} to write your feature…",
    consultWriteFeature: "{name} accepted — type a feature idea for their product:",
    consultSend: "Send",
    "log.consultOffer": "{name} offered {target} a paid consult ({price}).",
    "log.consultDeclined": "{name} declined {consultant}'s consult.",
    "log.consultAccepted": "{name} paid {consultant} {price} for a consult.",
    "log.consultFeature": "{name} suggested {feature} for {target}.",
    playCard: "Play card",
    building: "Building…",
    endTurn: "End turn",
    skip: "Skip turn",
    discard: "Discard",
    noCardPlayed: "No card played yet",
    tableLog: "Table log",
    demoResults: "Demo Day results",
    playAgain: "Play again",
    openApp: "Open app",
    noApp: "No app shipped",
    language: "Language",
    noPrototype: "No prototype to download yet.",
    requestFailed: "Request failed ({status}).",
    networkError: "Network error. Check the connection.",
    disconnected: "disconnected",
    otherPlayers: "Other players",
    productBoard: "Product board",
    yourControls: "Your controls",
    leaderLine: "{shipped} shipped · {progress}% progress · {credits} credits left",
    "award.cashed-out": "Cashed Out",
    "award.conservative": "The Conservative",
    "award.machine": "The Machine",
    "award.finisher": "The Finisher",
    "award.all-in": "All-In",
    "award.lean": "Lean Founder",
    "award.steady": "Steady Builder",
    "type.engineering": "Engineering",
    "type.market": "Market",
    "type.table": "Table",
    "type.resource": "Resource",
    // round events
    "ev.kickoff": "Kickoff",
    "ev.firstbuild": "First Build",
    "ev.users": "Early Users",
    "ev.growth": "Growth Spurt",
    "ev.crunch": "Crunch Time",
    "ev.polish": "Polish",
    "ev.demo": "Demo Day",
    // notices
    "n.dealt": "Dealt hands to {count} players.",
    "n.shippedList": "{name} shipped {list}.",
    polishPass: "a polish pass",
    // log templates
    "shuffled": "The table shuffled the deck and dealt 5 cards to each player.",
    "sprintLog": "{name} spent {spend} tokens on {product}: {features} feature(s), {perFeature} tokens each, {progress}% progress.",
    "featureIdeas": "{name} spent {cost} credit on AI feature ideas.",
    "buildSkipped": "{name} had no tokens left to build.",
    "roundOpen": "Round {round} opened: {event}.",
    "demoDay": "Demo day finished. The table scored every product.",
    "log.reprioritize": "{name} reprioritized {product}'s backlog.",
    "log.vendor": "{name} sold a vendor API to {target} for 2 credits.",
    "log.refactor": "{name} invested in a refactor pass.",
    "log.fastPrototype": "{name} chose a fast prototype path.",
    "log.scopeCut": "{name} cut {removed} from scope and freed 3 credits.",
    "log.premium": "{name} added a premium feature.",
    "log.feedback": "{name} gathered user feedback for new ideas.",
    "log.newFeature": "{name} added the feature {feature}.",
    "log.security": "{name} exposed a security incident at {target}'s product.",
    "log.integration": "{name} and {target} signed an integration deal.",
    "log.consultantFor": "{name} consulted for {target}.",
    "log.consultantInternal": "{name} used consulting time internally.",
    "log.dependency": "{name} made a dependency bet.",
    "log.regulation": "{name} triggered a new regulation across the table.",
    "log.outage": "{name} forced {target} through an outage drill.",
    "log.investorDemo": "{name} prepared an investor demo.",
    "log.acquire": "{name} acquired a feature idea from {target}.",
    "log.acquireEmpty": "{name} found nothing to acquire from {target}.",
    "log.designSystem": "{name} created a design system.",
    "log.cloudCredits": "{name} claimed cloud credits.",
  },
  zh: {
    tagline: "和朋友一起用 AI 打造软件产品。",
    join: "加入游戏",
    host: "创建游戏",
    yourName: "你的名字",
    yourProduct: "你的产品创意",
    gameCode: "房间号",
    creditCap: "AI 点数上限",
    credits: "{n} 点",
    joinBtn: "加入游戏",
    createBtn: "创建游戏",
    hostHint: "创建后会得到一个房间号，分享给朋友即可加入。",
    playLocal: "改为在同一台设备上玩 →",
    phName: "例如：小明",
    phProduct: "例如：给忙碌家庭用的 AI 菜谱助手",
    productRequired: "加入前请输入一个具体的产品创意。",
    productGeneric: "请输入真实产品创意，不要使用 Roundtable 或通用占位词。",
    phCode: "5 位房间号",
    lobby: "游戏大厅",
    leave: "离开",
    shareCode: "分享这个房间号",
    copyCode: "复制房间号",
    codeCopied: "已复制房间号。",
    inRoom: "房间内玩家（{n}/{max}）：",
    you: "你",
    hostBadge: "房主",
    noIdeaYet: "还在想点子……",
    startGame: "开始游戏",
    needPlayers: "至少需要 {n} 名玩家",
    waitingHost: "正在等待房主开始游戏……",
    save: "保存",
    cancel: "取消",
    connecting: "连接中……",
    joiningGame: "正在加入游戏……",
    creatingGame: "正在创建游戏……",
    reconnecting: "正在重新连接……",
    connectHint: "通过共享链接连接可能需要几秒钟。",
    enterCode: "请输入房间号以加入。",
    noLongerIn: "你已不在这局游戏中。",
    cantReach: "无法连接到该游戏，可能已经结束——请重新打开链接。",
    roundOf: "第 {round} / {max} 回合 · 房间号 {code}",
    thisRound: "本回合",
    nowBuilding: "正在构建",
    offline: "离线",
    now: "当前",
    shipped: "已交付",
    creditsStat: "点数",
    latest: "最新：{x}",
    nothingShipped: "尚未交付任何功能",
    features: "功能",
    noFeatures: "暂无功能",
    featureChoice: "功能",
    aiIdeas: "AI 建议",
    generateIdeas: "AI 建议 -1",
    ideasLoading: "思考中……",
    ideasCharged: "AI 建议消耗 1 点。",
    needIdeaCredit: "需要 1 点才能生成 AI 建议。",
    noIdeasYet: "生成建议",
    customFeature: "自定义",
    featurePlaceholder: "输入功能……",
    yourTurn: "轮到你了",
    waiting: "等待中",
    waitingFor: "正在等待 {name}",
    watchHint: "看着牌桌吧，等待时你可以预览任意玩家的产品。",
    cardPlayed: "已出牌",
    cardPlayedHint: "结束回合时会自动消耗本回合点数并构建。",
    selectHint: "点选一张牌再出牌；结束回合会自动构建。",
    noCard: "未选择卡牌",
    target: "目标",
    spend: "本回合点数",
    everyone: "所有人",
    nothingToAcquire: "对方暂无可收购的功能",
    consultTitle: "顾问咨询",
    consultOffer: "{name} 想为你提供有偿咨询，价格 {price} 点。",
    consultAccept: "接受 · 支付 {price}",
    consultDecline: "拒绝",
    consultCantAfford: "你需要 {price} 点才能接受。",
    consultWaitingResponse: "等待 {name} 回应……",
    consultWaitingFeature: "等待 {name} 撰写功能建议……",
    consultWriteFeature: "{name} 接受了——为其产品输入一个功能点子：",
    consultSend: "发送",
    "log.consultOffer": "{name} 向 {target} 发起有偿咨询（{price} 点）。",
    "log.consultDeclined": "{name} 拒绝了 {consultant} 的咨询。",
    "log.consultAccepted": "{name} 为咨询向 {consultant} 支付了 {price} 点。",
    "log.consultFeature": "{name} 为 {target} 提议了功能：{feature}。",
    playCard: "出牌",
    building: "构建中……",
    endTurn: "结束回合",
    skip: "跳过本回合",
    discard: "弃牌堆",
    noCardPlayed: "还没有人出牌",
    tableLog: "牌桌日志",
    demoResults: "演示日结算",
    playAgain: "再来一局",
    openApp: "打开应用",
    noApp: "未交付应用",
    language: "语言",
    noPrototype: "还没有可下载的原型。",
    requestFailed: "请求失败（{status}）。",
    networkError: "网络错误，请检查连接。",
    disconnected: "已断线",
    otherPlayers: "其他玩家",
    productBoard: "产品牌桌",
    yourControls: "你的操作区",
    leaderLine: "已交付 {shipped} 项 · 进度 {progress}% · 剩余 {credits} 点",
    "award.cashed-out": "套现离场",
    "award.conservative": "保守派",
    "award.machine": "卷王",
    "award.finisher": "收官大师",
    "award.all-in": "孤注一掷",
    "award.lean": "精打细算",
    "award.steady": "稳健创业者",
    "type.engineering": "工程",
    "type.market": "市场",
    "type.table": "牌桌",
    "type.resource": "资源",
    "ev.kickoff": "项目启动",
    "ev.firstbuild": "首次构建",
    "ev.users": "早期用户",
    "ev.growth": "增长期",
    "ev.crunch": "冲刺阶段",
    "ev.polish": "打磨阶段",
    "ev.demo": "演示日",
    "n.dealt": "已向 {count} 位玩家发牌。",
    "n.shippedList": "{name} 交付了 {list}。",
    polishPass: "一次打磨",
    "shuffled": "牌桌洗好了牌，给每位玩家各发了 5 张牌。",
    "sprintLog": "{name} 为「{product}」消耗 {spend} 点：{features} 项功能，每项 {perFeature} 点，进度 +{progress}%。",
    "featureIdeas": "{name} 消耗 {cost} 点生成了 AI 功能建议。",
    "buildSkipped": "{name} 已没有点数可用于构建。",
    "roundOpen": "第 {round} 回合开始：{event}。",
    "demoDay": "演示日结束，牌桌为每个产品打了分。",
    "log.reprioritize": "{name} 重新排序了「{product}」的待办列表。",
    "log.vendor": "{name} 以 2 点把供应商 API 卖给了 {target}。",
    "log.refactor": "{name} 投入了一次重构改造。",
    "log.fastPrototype": "{name} 选择了快速原型路线。",
    "log.scopeCut": "{name} 砍掉了「{removed}」，释放了 3 点。",
    "log.premium": "{name} 增加了一个高级功能。",
    "log.feedback": "{name} 收集用户反馈，获得新功能点子。",
    "log.newFeature": "{name} 新增了功能：{feature}。",
    "log.security": "{name} 揭露了 {target} 产品的一个安全事件。",
    "log.integration": "{name} 与 {target} 签订了集成协议。",
    "log.consultantFor": "{name} 为 {target} 做了咨询。",
    "log.consultantInternal": "{name} 把咨询时间用在了内部。",
    "log.dependency": "{name} 做了一次依赖押注。",
    "log.regulation": "{name} 在牌桌上触发了新法规。",
    "log.outage": "{name} 让 {target} 经历了一次故障演练。",
    "log.investorDemo": "{name} 准备了一次投资人演示。",
    "log.acquire": "{name} 从 {target} 收购了一个功能点子。",
    "log.acquireEmpty": "{name} 没能从 {target} 收购到任何功能。",
    "log.designSystem": "{name} 建立了一套设计系统。",
    "log.cloudCredits": "{name} 领取了云额度。",
  },
};

function t(key, params) {
  let s = (STR[lang] && STR[lang][key] != null ? STR[lang][key] : STR.en[key]) ?? key;
  if (params) for (const k in params) s = s.split(`{${k}}`).join(params[k]);
  return s;
}

function setLang(next) {
  lang = next;
  document.documentElement.lang = next === "zh" ? "zh-CN" : "en";
  try {
    localStorage.setItem("roundtable.lang.v1", next);
  } catch {}
  lastViewSig = ""; // force a re-render even if the view is unchanged
  render();
}

function roundEventTitle(ev) {
  return ev?.key ? t(`ev.${ev.key}`) : ev?.title || "";
}

function tNotice(notice) {
  if (!notice || typeof notice !== "object") return typeof notice === "string" ? notice : "";
  if (notice.key === "dealt") return t("n.dealt", { count: notice.params?.count ?? 0 });
  if (notice.key === "shipped") {
    const feats = notice.params?.features || [];
    const list = feats.length ? feats.map(featureText).join(lang === "zh" ? "、" : ", ") : t("polishPass");
    return t("n.shippedList", { name: notice.params?.name, list });
  }
  return "";
}

function tLog(entry) {
  if (!entry || typeof entry !== "object") return String(entry || "");
  const p = { ...(entry.params || {}) };
  if (entry.key === "roundOpen" && p.event) p.event = t(`ev.${p.event}`);
  if (entry.key === "sprintLog" && p.perFeature == null) p.perFeature = p.features ? Number(p.spend / Math.max(1, p.features)).toFixed(1) : 0;
  if (p.removed) p.removed = featureText(p.removed);
  if (p.feature) p.feature = featureText(p.feature);
  return t(entry.key, p);
}

function featureText(value) {
  const name = String(value || "");
  if (lang !== "zh") return name;
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

function localizeError(message) {
  const text = String(message || "");
  if (lang !== "zh") return text;
  const exact = {
    "No prototype to download yet.": t("noPrototype"),
    "Enter a specific product idea before joining.": t("productRequired"),
    "Use a real product idea, not Roundtable or a generic placeholder.": t("productGeneric"),
    "The server is at capacity. Try again later.": "服务器房间已满，请稍后再试。",
    "Could not allocate a room code.": "无法分配房间号。",
    "No game found with that code.": "没有找到这个房间号对应的游戏。",
    "That game has already started. Rejoin with the same name to resume.": "这局游戏已经开始，请用同一个名字重新加入以恢复座位。",
    "That game is full.": "这局游戏人数已满。",
    "You can only edit before the game starts.": "只能在游戏开始前编辑。",
    "You are not in this game.": "你不在这局游戏中。",
    "Only the host can remove players.": "只有房主可以移除玩家。",
    "You can only remove players before the game starts.": "只能在游戏开始前移除玩家。",
    "The host cannot remove themselves.": "房主不能移除自己。",
    "That player is not in the game.": "该玩家不在这局游戏中。",
    "Only the host can start a new game.": "只有房主可以开始新游戏。",
    "The game has not started yet.": "游戏还没有开始。",
    "Only the host can start the game.": "只有房主可以开始游戏。",
    "The game has already started.": "游戏已经开始。",
    "No active game.": "没有正在进行的游戏。",
    "The game is not in progress.": "游戏当前不在进行中。",
    "It is not your turn.": "还没轮到你。",
    "You already played a card this turn.": "你本回合已经出过牌。",
    "Card not in hand.": "这张牌不在你的手牌中。",
    "You already built this turn.": "你本回合已经构建过了。",
    "Need 1 credit for AI ideas.": "需要 1 点才能生成 AI 建议。",
    "Unknown action.": "未知操作。",
    "You are not a member of this game.": "你不是这局游戏的成员。",
  };
  if (exact[text]) return exact[text];
  let match = text.match(/^Need at least (\d+) players to start\.$/);
  if (match) return `至少需要 ${match[1]} 名玩家才能开始。`;
  match = text.match(/^Need (\d+) credits to play (.+)\.$/);
  if (match) return `需要 ${match[1]} 点才能打出「${cardTextByTitle(match[2])}」。`;
  return text;
}

function cardTextByTitle(title) {
  const found = Object.values(CARDS).find((card) => card.title === title);
  return found?.zh?.title || title;
}

// Card display text, localized. Cards arrive in the view with English fields;
// CARDS holds the full catalog (incl. zh) fetched from data/cards.json.
let CARDS = {};

async function loadCardCatalog() {
  try {
    const res = await fetch("./data/cards.json", { cache: "no-store" });
    const arr = await res.json();
    CARDS = Object.fromEntries(arr.map((c) => [c.id, c]));
  } catch {
    CARDS = {};
  }
}

function cardText(card, field) {
  const id = typeof card === "string" ? card : card?.id;
  const def = CARDS[id];
  if (def) {
    if (lang === "zh" && def.zh) {
      if (field === "title") return def.zh.title || def.title;
      if (field === "text") return def.zh.text || def.text;
      if (field === "summary") return def.zh.strategy?.summary || def.strategy?.summary || def.text;
      if (field === "type") return def.zh.type || t(`type.${String(def.type || "").toLowerCase()}`);
    }
    if (field === "title") return def.title;
    if (field === "text") return def.text;
    if (field === "summary") return def.strategy?.summary || def.text;
    if (field === "type") return def.type;
  }
  if (card && typeof card === "object") {
    if (field === "summary") return card.strategy?.summary || card.text || "";
    if (field === "type" && lang === "zh") return t(`type.${String(card.type || "").toLowerCase()}`);
    return card[field] || "";
  }
  return "";
}

function renderLangToggle(extraClass = "") {
  return `
    <div class="lang-toggle ${extraClass}" role="group" aria-label="${escapeAttribute(t("language"))}">
      <button class="${lang === "en" ? "active" : ""}" data-action="set-lang" data-id="en">EN</button>
      <button class="${lang === "zh" ? "active" : ""}" data-action="set-lang" data-id="zh">中文</button>
    </div>
  `;
}

init();

function init() {
  loadCardCatalog().then(render); // localize card text once the catalog is in
  // A shared join link (?code=XXXXX) for a different room than the saved
  // session means the player is joining a new game — drop the stale session
  // so the link lands on a clean join screen instead of reconnecting old.
  if (prefillCode && session && session.code !== prefillCode) {
    clearSession();
  }
  if (session?.code && session?.playerId) {
    connecting = true;
    connectingLabel = "reconnecting";
    connect();
    render();
  } else {
    render();
  }
}

// ---- session -----------------------------------------------------------------

function loadSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

function saveSession() {
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else localStorage.removeItem(SESSION_KEY);
}

function clearSession() {
  session = null;
  localStorage.removeItem(SESSION_KEY);
}

// ---- networking --------------------------------------------------------------

// The client polls for state rather than using Server-Sent Events: SSE is
// buffered to death by some tunnels/proxies (e.g. Cloudflare quick tunnels),
// whereas short polling requests survive any proxy. For a turn-based game a
// ~1.5s cadence feels live enough.
const POLL_INTERVAL = 1500;

function connect() {
  stopPolling();
  connectionError = "";
  lastViewSig = "";
  pollState();
}

function stopPolling() {
  if (pollTimer) clearTimeout(pollTimer);
  pollTimer = null;
}

async function pollState() {
  if (!session?.code || !session?.playerId) return;
  try {
    const res = await fetch(`/api/rooms/${encodeURIComponent(session.code)}/state?playerId=${encodeURIComponent(session.playerId)}`, { cache: "no-store" });
    if (res.status === 403) {
      // Seat removed (kicked) or no longer a member.
      stopPolling();
      clearSession();
      view = null;
      connecting = false;
      connectionError = t("noLongerIn");
      render();
      return;
    }
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    pollFails = 0;
    const wasConnecting = connecting;
    connecting = false;
    connectionError = "";
    const sig = JSON.stringify(data.view);
    view = data.view;
    if (ui.preview === null && view.players?.length) ui.preview = view.youId;
    if (sig !== lastViewSig || wasConnecting) {
      lastViewSig = sig;
      render();
    }
  } catch {
    pollFails += 1;
    if (!view && pollFails > 8) {
      stopPolling();
      clearSession();
      view = null;
      connecting = false;
      connectionError = t("cantReach");
      render();
      return;
    }
    // Transient blip: keep the current view (if any) and keep trying.
    if (!view) {
      connecting = true;
      render();
    }
  }
  if (session) pollTimer = setTimeout(pollState, POLL_INTERVAL);
}

async function postJson(url, body) {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      showToast(data.error ? localizeError(data.error) : t("requestFailed", { status: res.status }));
      return { error: data.error || "failed" };
    }
    return data;
  } catch (error) {
    showToast(t("networkError"));
    return { error: error.message };
  }
}

function showToast(message) {
  toast = message;
  render();
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast = "";
    render();
  }, 3200);
}

function validateProductDraft(product) {
  const clean = String(product || "").trim().replace(/\s+/g, " ");
  const cjkCount = (clean.match(/[\u4e00-\u9fff]/g) || []).length;
  if ((cjkCount > 0 && cjkCount < 2) || (cjkCount === 0 && clean.length < 6)) return t("productRequired");
  const compact = clean.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, " ").trim();
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
  if (generic.has(compact) || /\broundtable\b/i.test(clean)) return t("productGeneric");
  return "";
}

function rememberHomeDraft(form) {
  draft = {
    ...draft,
    name: form.name || "",
    product: form.product || "",
    budgetCap: form.budgetCap || draft.budgetCap || DEFAULT_BUDGET,
    code: form.code || draft.code || "",
  };
}

// ---- actions -----------------------------------------------------------------

async function createGame(form) {
  rememberHomeDraft(form);
  const productError = validateProductDraft(form.product);
  if (productError) return showToast(productError);
  connecting = true;
  connectingLabel = "creatingGame";
  render();
  const data = await postJson("/api/rooms", form);
  if (data.error) {
    connecting = false;
    render();
    return;
  }
  session = { code: data.code, playerId: data.playerId, name: form.name, product: form.product, budgetCap: form.budgetCap };
  saveSession();
  resetUi();
  connectingLabel = "connecting";
  connect();
}

async function joinGame(form) {
  rememberHomeDraft(form);
  if (!form.code) return showToast(t("enterCode"));
  const productError = validateProductDraft(form.product);
  if (productError) return showToast(productError);
  connecting = true;
  connectingLabel = "joiningGame";
  render();
  const data = await postJson(`/api/rooms/${encodeURIComponent(form.code)}/join`, form);
  if (data.error) {
    connecting = false;
    render();
    return;
  }
  session = { code: data.code, playerId: data.playerId, name: form.name, product: form.product, budgetCap: form.budgetCap };
  saveSession();
  resetUi();
  connectingLabel = "connecting";
  connect();
}

async function startGame() {
  await postJson(`/api/rooms/${session.code}/start`, { playerId: session.playerId });
}

async function saveSeat() {
  const name = (document.querySelector("#edit-name")?.value || "").trim();
  const product = (document.querySelector("#edit-product")?.value || "").trim();
  const budgetCap = Number(document.querySelector("#edit-budget")?.value || DEFAULT_BUDGET);
  const productError = validateProductDraft(product);
  if (productError) return showToast(productError);
  const result = await postJson(`/api/rooms/${session.code}/update`, { playerId: session.playerId, name, product, budgetCap });
  if (result.error) return;
  session = { ...session, name, product, budgetCap };
  saveSession();
  ui.editing = false;
  render();
}

async function kickPlayer(targetId) {
  await postJson(`/api/rooms/${session.code}/kick`, { playerId: session.playerId, targetId });
}

async function restartGame() {
  await postJson(`/api/rooms/${session.code}/restart`, { playerId: session.playerId });
}

async function sendAction(action) {
  return postJson(`/api/rooms/${session.code}/action`, { playerId: session.playerId, action });
}

function leaveGame() {
  stopPolling();
  view = null;
  connecting = false;
  pollFails = 0;
  connectionError = "";
  clearSession();
  resetUi();
  render();
}

function resetUi() {
  ui.selected = null;
  ui.target = null;
  ui.spend = 2;
  ui.preview = null;
}

function openHostedApp(targetId) {
  if (!session?.code) return;
  window.open(`/app/${encodeURIComponent(session.code)}/${encodeURIComponent(targetId)}`, "_blank", "noopener");
}

// ---- form reading ------------------------------------------------------------

function readForm() {
  const codeInput = document.querySelector("#online-code");
  return {
    name: (document.querySelector("#online-name")?.value || "").trim(),
    product: (document.querySelector("#online-product")?.value || "").trim(),
    budgetCap: Number(document.querySelector("#online-budget")?.value || DEFAULT_BUDGET),
    code: codeInput ? codeInput.value.trim().toUpperCase() : draft.code || "",
    clientId,
  };
}

// ---- event wiring ------------------------------------------------------------

document.addEventListener("click", (event) => {
  const control = event.target.closest("[data-action]");
  if (!control) return;
  const action = control.dataset.action;
  const id = control.dataset.id;

  if (action === "set-lang") {
    if (view && view.status !== "lobby") {
      // keep the in-progress form values when toggling on the home screen only
    } else if (!view) {
      Object.assign(draft, readForm());
    }
    setLang(id);
  }
  if (action === "home-mode") {
    Object.assign(draft, readForm());
    ui.homeMode = id;
    render();
  }
  if (action === "create-game") createGame(readForm());
  if (action === "join-game") joinGame(readForm());
  if (action === "start-game") startGame();
  if (action === "restart-game") restartGame();
  if (action === "leave-game") leaveGame();
  if (action === "copy-code") copyCode();
  if (action === "edit-seat") {
    ui.editing = true;
    render();
  }
  if (action === "cancel-edit") {
    ui.editing = false;
    render();
  }
  if (action === "save-seat") saveSeat();
  if (action === "kick-player") kickPlayer(id);
  if (action === "select-card") {
    if (event.detail > 1) return;
    const nextSelected = ui.selected === id ? null : id;
    if (ui.selected !== nextSelected) resetFeatureChoice();
    ui.selected = nextSelected;
    ui.target = null;
    render();
  }
  if (action === "close-detail") {
    ui.selected = null;
    ui.target = null;
    resetFeatureChoice();
    render();
  }
  if (action === "play-card") playSelected();
  if (action === "generate-features") requestFeatureSuggestions();
  if (action === "end-turn") sendAction({ type: "end_turn", lang });
  if (action === "consult-accept") sendAction({ type: "respond_consult", accept: true, lang });
  if (action === "consult-decline") sendAction({ type: "respond_consult", accept: false, lang });
  if (action === "consult-submit") {
    sendAction({ type: "submit_consult_feedback", feature: ui.consultFeature || "", lang });
    ui.consultFeature = "";
  }
  if (action === "select-preview") {
    ui.preview = id;
    render();
  }
  if (action === "open-app") openHostedApp(id);
});

document.addEventListener("dblclick", (event) => {
  const card = event.target.closest('[data-action="select-card"]');
  if (!card || !view?.isYourTurn) return;
  event.preventDefault();
  if (ui.selected !== card.dataset.id) resetFeatureChoice();
  ui.selected = card.dataset.id;
  playSelected();
});

document.addEventListener("change", (event) => {
  if (event.target.id === "target-select") {
    ui.target = event.target.value;
    resetFeatureChoice();
    render();
  }
  if (event.target.id === "feature-pick") {
    ui.featurePick = event.target.value;
  }
});

document.addEventListener("input", (event) => {
  if (event.target.id === "feature-text") {
    ui.featureText = event.target.value;
  }
  if (event.target.id === "consult-feature") {
    ui.consultFeature = event.target.value;
  }
});

function selectedCard() {
  const me = myPlayer();
  if (!me?.hand || !ui.selected) return null;
  return me.hand.find((card) => card.instanceId === ui.selected) || null;
}

async function playSelected() {
  const card = selectedCard();
  if (!card || !view.isYourTurn || view.turn.cardPlayed) return;
  const needsTarget = card.target === "other" || card.target === "any";
  const targetId = needsTarget ? ui.target || defaultTargetId(card) : null;
  const featureChoice = featureChoiceFor(card);
  ui.selected = null;
  ui.target = null;
  resetFeatureChoice();
  // Playing a card is the whole turn: end it automatically. The product builds
  // in the background, so there is no separate "end turn" step.
  const result = await sendAction({ type: "play_card", instanceId: card.instanceId, targetId, ...featureChoice });
  // Consultant opens a negotiation that ends the turn itself; everything else auto-ends.
  if (!result.error && card.id !== "consultant") await sendAction({ type: "end_turn", lang });
}

function defaultTargetId(card) {
  const others = view.players.filter((p) => card.target === "any" || p.id !== view.youId);
  return others[0]?.id || null;
}

function copyCode() {
  navigator.clipboard?.writeText(session.code).then(
    () => showToast(t("codeCopied")),
    () => showToast(`${t("gameCode")}: ${session.code}`),
  );
}

function myPlayer() {
  return view?.players?.find((p) => p.id === view.youId) || null;
}

function resetFeatureChoice() {
  ui.featurePick = "";
  ui.featureText = "";
  ui.featureSuggestionKey = "";
  ui.featureSuggestions = [];
  ui.featureSuggestionsLoading = false;
}

// ---- render ------------------------------------------------------------------

function render() {
  const app = document.querySelector("#app");
  // Preserve the board's scroll position across re-renders (polling rebuilds
  // the DOM ~every 1.5s, which would otherwise snap back to the top).
  const prevStage = app.querySelector(".table-stage");
  const prevScroll = prevStage ? prevStage.scrollTop : null;

  let html;
  if (!view) {
    html = connecting ? renderConnecting() : renderHome(connectionError);
  } else if (view.status === "lobby") {
    html = renderLobby();
  } else {
    html = renderGame();
  }
  app.innerHTML = html;

  if (prevScroll != null) {
    const stage = app.querySelector(".table-stage");
    if (stage) stage.scrollTop = prevScroll;
  }
}

function renderLobbyPlayer(player) {
  const isMe = player.id === view.youId;
  if (isMe && ui.editing) {
    return `
      <div class="lobby-player editing">
        <div class="seat-edit">
          <div class="field">
            <label for="edit-name">${escapeHtml(t("yourName"))}</label>
            <input id="edit-name" value="${escapeAttribute(session.name || player.name)}" maxlength="40" />
          </div>
          <div class="field">
            <label for="edit-product">${escapeHtml(t("yourProduct"))}</label>
            <input id="edit-product" value="${escapeAttribute(session.product || player.product)}" minlength="6" maxlength="80" required />
          </div>
          <div class="field">
            <label for="edit-budget">${escapeHtml(t("creditCap"))}</label>
            <select id="edit-budget">
              ${BUDGET_OPTIONS.map((amount) => `<option value="${amount}" ${amount === (session.budgetCap || DEFAULT_BUDGET) ? "selected" : ""}>${escapeHtml(t("credits", { n: amount }))}</option>`).join("")}
            </select>
          </div>
          <div class="seat-edit-actions">
            <button class="button accent slim" data-action="save-seat">${escapeHtml(t("save"))}</button>
            <button class="button secondary slim" data-action="cancel-edit">${escapeHtml(t("cancel"))}</button>
          </div>
        </div>
      </div>
    `;
  }
  return `
    <div class="lobby-player ${player.connected ? "online" : "offline"}">
      <span class="conn-dot"></span>
      <div>
        <strong>${escapeHtml(player.name)}${isMe ? ` (${t("you")})` : ""}</strong>
        ${renderLobbyProduct(player.product)}
      </div>
      <div class="lobby-player-actions">
        ${player.isHost ? `<span class="host-badge">${escapeHtml(t("hostBadge"))}</span>` : ""}
        ${isMe ? `<button class="icon-pill" data-action="edit-seat" title="${escapeAttribute(t("yourName"))}">✎</button>` : ""}
        ${!isMe && view.isHost ? `<button class="icon-pill danger" data-action="kick-player" data-id="${player.id}">✕</button>` : ""}
      </div>
    </div>
  `;
}

// The product idea every player typed, shown to everyone in the lobby. Falls
// back to a clear placeholder when someone hasn't entered one yet.
function renderLobbyProduct(product) {
  const real = product && product.trim() && product.trim().toLowerCase() !== "untitled product";
  return real
    ? `<small class="lobby-product">${escapeHtml(product)}</small>`
    : `<small class="lobby-product none">${escapeHtml(t("noIdeaYet"))}</small>`;
}

function renderConnecting() {
  return `
    <main class="home">
      <div class="home-card connecting-card">
        <div class="spinner" aria-hidden="true"></div>
        <strong>${escapeHtml(t(connectingLabel))}</strong>
        <p class="home-hint">${escapeHtml(t("connectHint"))}</p>
        <button class="button secondary" data-action="leave-game">${escapeHtml(t("cancel"))}</button>
      </div>
    </main>
  `;
}

function renderHome(notice) {
  const mode = ui.homeMode;
  const name = escapeAttribute(draft.name || "");
  const product = escapeAttribute(draft.product || "");
  const code = escapeAttribute(draft.code || prefillCode || "");
  return `
    <main class="home">
      <div class="home-card">
        <div class="home-brand">
          <div class="mark">R</div>
          <div>
            <h1>Roundtable</h1>
            <p>${escapeHtml(t("tagline"))}</p>
          </div>
          ${renderLangToggle()}
        </div>

        <div class="home-toggle" role="tablist">
          <button class="${mode === "join" ? "active" : ""}" data-action="home-mode" data-id="join">${escapeHtml(t("join"))}</button>
          <button class="${mode === "host" ? "active" : ""}" data-action="home-mode" data-id="host">${escapeHtml(t("host"))}</button>
        </div>

        ${notice ? `<div class="notice">${escapeHtml(notice)}</div>` : ""}

        <div class="home-form">
          <div class="field">
            <label for="online-name">${escapeHtml(t("yourName"))}</label>
            <input id="online-name" value="${name}" placeholder="${escapeAttribute(t("phName"))}" maxlength="40" autocomplete="off" />
          </div>
          <div class="field">
            <label for="online-product">${escapeHtml(t("yourProduct"))}</label>
            <input id="online-product" value="${product}" placeholder="${escapeAttribute(t("phProduct"))}" minlength="6" maxlength="80" autocomplete="off" required />
          </div>
          ${
            mode === "join"
              ? `
                <div class="field">
                  <label for="online-code">${escapeHtml(t("gameCode"))}</label>
                  <input id="online-code" value="${code}" class="code-input" placeholder="${escapeAttribute(t("phCode"))}" maxlength="5" autocomplete="off" autocapitalize="characters" />
                </div>
                <button class="button accent big" data-action="join-game">${escapeHtml(t("joinBtn"))}</button>
              `
              : `
                <div class="field">
                  <label for="online-budget">${escapeHtml(t("creditCap"))}</label>
                  <select id="online-budget">
                    ${BUDGET_OPTIONS.map((amount) => `<option value="${amount}" ${amount === (draft.budgetCap || DEFAULT_BUDGET) ? "selected" : ""}>${escapeHtml(t("credits", { n: amount }))}</option>`).join("")}
                  </select>
                </div>
                <button class="button accent big" data-action="create-game">${escapeHtml(t("createBtn"))}</button>
                <p class="home-hint">${escapeHtml(t("hostHint"))}</p>
              `
          }
        </div>

        <p class="home-foot"><a class="text-link" href="./local.html?lang=${escapeAttribute(lang)}">${escapeHtml(t("playLocal"))}</a></p>
      </div>
      ${toast ? `<div class="floating-toast">${escapeHtml(toast)}</div>` : ""}
    </main>
  `;
}

function renderLobby() {
  const isHost = view.isHost;
  return `
    <main class="setup">
      <section class="panel lobby-panel">
        <div class="panel-header">
          <h2>${escapeHtml(t("lobby"))}</h2>
          <div class="top-actions">
            ${renderLangToggle("dark")}
            <button class="button slim danger" data-action="leave-game">${escapeHtml(t("leave"))}</button>
          </div>
        </div>
        <div class="panel-body">
          <div class="code-banner">
            <div>
              <span>${escapeHtml(t("shareCode"))}</span>
              <strong>${escapeHtml(view.code)}</strong>
            </div>
            <button class="button secondary" data-action="copy-code">${escapeHtml(t("copyCode"))}</button>
          </div>
          <p class="setup-copy">${escapeHtml(t("inRoom", { n: view.players.length, max: view.maxPlayers }))}</p>
          <div class="lobby-players">
            ${view.players.map((player) => renderLobbyPlayer(player)).join("")}
          </div>
          ${
            isHost
              ? `<button class="button accent lobby-start" data-action="start-game" ${view.canStart ? "" : "disabled"}>${
                  view.canStart ? escapeHtml(t("startGame")) : escapeHtml(t("needPlayers", { n: view.minPlayers }))
                }</button>`
              : `<div class="notice">${escapeHtml(t("waitingHost"))}</div>`
          }
        </div>
      </section>
      ${toast ? `<div class="floating-toast">${escapeHtml(toast)}</div>` : ""}
    </main>
  `;
}

function renderGame() {
  if (view.status === "finished") return renderFinished();
  const me = myPlayer();
  const current = view.players.find((p) => p.id === view.currentPlayerId);
  const opponents = view.players.filter((p) => p.id !== view.youId);
  return `
    <div class="game-app">
      <header class="game-hud">
        <div class="brand table-brand">
          <div class="mark">R</div>
          <div>
            <h1>Roundtable</h1>
            <p>${escapeHtml(t("roundOf", { round: view.round, max: view.maxRounds, code: view.code }))}</p>
          </div>
        </div>
        <div class="event-pill">
          <span>${escapeHtml(t("thisRound"))}</span>
          <strong>${escapeHtml(roundEventTitle(view.roundEvent))}</strong>
        </div>
        <div class="hud-actions">
          ${renderLangToggle("hud")}
          ${
            view.players.find((p) => p.id === (ui.preview || view.youId))?.appReady
              ? `<button class="icon-button" data-action="open-app" data-id="${ui.preview || view.youId}" title="${escapeAttribute(t("openApp"))}">↗</button>`
              : ""
          }
          <button class="icon-button danger" data-action="leave-game" title="${escapeAttribute(t("leave"))}">⏏</button>
        </div>
      </header>

      <main class="table-stage players-${view.players.length}" style="--player-color:${me?.color || "#167b73"}">
        <section class="opponent-rail seats-${opponents.length}" aria-label="${escapeAttribute(t("otherPlayers"))}">
          ${opponents.map((player) => renderOpponentFan(player)).join("")}
        </section>

        <section class="felt-table" aria-label="${escapeAttribute(t("productBoard"))}">
          <div class="board-row seats-${view.players.length}">
            ${view.players.map((player) => renderBoardPlayer(player, current)).join("")}
          </div>
          <div class="felt-foot">
            ${renderDiscardPile()}
            ${renderActivityFeed()}
          </div>
          ${view.notice ? `<div class="table-toast">${escapeHtml(tNotice(view.notice))}</div>` : ""}
        </section>
      </main>

      <section class="control-dock" aria-label="${escapeAttribute(t("yourControls"))}">
        ${renderActionBar(me, current)}
        <div class="player-hand">
          ${(me?.hand || []).map((card) => renderCard(card)).join("")}
        </div>
      </section>
      ${toast ? `<div class="floating-toast">${escapeHtml(toast)}</div>` : ""}
      ${renderConsultPrompt()}
      ${renderCardDetail()}
    </div>
  `;
}

function renderOpponentFan(player) {
  const cards = Math.min(player.handCount, 5);
  const mid = (cards - 1) / 2;
  const fan = Array.from({ length: cards }, (_, index) => {
    const offset = index - mid;
    return `<span class="card-back" style="--tilt:${offset * 6}deg;--lift:${Math.abs(offset) * 7}px"></span>`;
  }).join("");
  const waiting = player.id === view.currentPlayerId;
  const offline = view.connected && view.connected[player.id] === false;
  const title = `${player.name}: ${player.product.name}${offline ? ` (${t("disconnected")})` : ""}`;
  return `
    <div class="opp ${waiting ? "opp-active" : ""} ${offline ? "opp-offline" : ""}" style="--player-color:${player.color}" title="${escapeAttribute(title)}">
      <div class="opp-fan">${fan}</div>
      <div class="opp-name">
        <span class="player-dot" style="--player-color:${player.color}">${escapeHtml(initials(player.name))}</span>
        <strong>${escapeHtml(player.name)}${offline ? ` · ${t("offline")}` : waiting ? ` · ${t("now")}` : ""}</strong>
      </div>
    </div>
  `;
}

function renderBoardPlayer(player, current) {
  const isCurrent = current && player.id === current.id;
  const isPreview = player.id === ui.preview;
  const isYou = player.id === view.youId;
  const offline = !isYou && view.connected && view.connected[player.id] === false;
  const stats = [
    [t("shipped"), player.shipped, false],
    [t("creditsStat"), player.credits, false],
  ];
  const latest = player.latestFeature ? featureText(player.latestFeature) : t("nothingShipped");
  return `
    <button class="board-player ${isCurrent ? "current" : ""} ${isPreview ? "previewing" : ""} ${offline ? "offline" : ""}" style="--player-color:${player.color}"
      data-action="select-preview" data-id="${player.id}" title="${escapeAttribute(player.product.name)}">
      <div class="bp-head">
        <span class="player-dot" style="--player-color:${player.color}">${escapeHtml(initials(player.name))}</span>
        <div class="bp-id">
          <strong>${escapeHtml(player.product.name)}</strong>
          <small>${escapeHtml(player.name)}${isYou ? ` (${t("you")})` : ""}</small>
        </div>
        ${
          offline
            ? `<span class="bp-offline">⚠ ${escapeHtml(t("offline"))}</span>`
            : player.id === view.building
              ? `<span class="bp-flag">${escapeHtml(t("nowBuilding"))}</span>`
              : `<span class="bp-hand">🂠 ${player.handCount}</span>`
        }
      </div>
      <div class="bp-progress">
        <div class="bp-bar"><div style="width:${player.progress}%"></div></div>
        <span>${player.progress}%</span>
      </div>
      <div class="bp-stats">
        ${stats.map(([label, value, warn]) => `<div class="${warn ? "warn" : ""}"><strong>${value}</strong><span>${escapeHtml(label)}</span></div>`).join("")}
      </div>
      ${renderFeatureList(player)}
      <div class="bp-latest" title="${escapeAttribute(latest)}">${escapeHtml(t("latest", { x: latest }))}</div>
    </button>
  `;
}

function renderFeatureList(player) {
  const features = (player.features || []).slice(-5).reverse();
  if (!features.length) {
    return `<div class="bp-features empty" title="${escapeAttribute(t("features"))}"><span>${escapeHtml(t("noFeatures"))}</span></div>`;
  }
  return `
    <div class="bp-features" title="${escapeAttribute(t("features"))}">
      ${features
        .map((feature) => {
          const name = featureText(feature.name);
          const polish = feature.polish ? ` P${feature.polish}` : "";
          const detail = feature.tokens ? `${name} - ${feature.tokens} ${t("spend")}, P${feature.polish || "?"}` : name;
          return `<span class="bp-feature" title="${escapeAttribute(detail)}">${escapeHtml(`${name}${polish}`)}</span>`;
        })
        .join("")}
    </div>
  `;
}

function renderDiscardPile() {
  const top = view.discardTop;
  if (!top) {
    return `<div class="center-card discard-pile empty"><span class="discard-label">${escapeHtml(t("discard"))}</span><div class="discard-empty">${escapeHtml(t("noCardPlayed"))}</div></div>`;
  }
  const count = view.discardCount || 1;
  const title = cardText(top.id, "title");
  return `
    <div class="center-card discard-pile" style="--tone:${top.tone}" title="${escapeAttribute(`${title} — ${top.by}`)}">
      <span class="discard-label">${escapeHtml(t("discard"))}${count > 1 ? ` · ${count}` : ""}</span>
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

function renderActivityFeed() {
  const items = (view.log || []).slice(0, 4);
  if (!items.length) return `<div class="activity-feed"></div>`;
  return `
    <div class="activity-feed">
      <span class="feed-label">${escapeHtml(t("tableLog"))}</span>
      ${items.map((line) => `<div class="feed-line">${escapeHtml(tLog(line))}</div>`).join("")}
    </div>
  `;
}

// Tap a hand card to pop it up enlarged and centered, with full name + description
// and the play controls — much easier to read on a phone than the tiny hand card.
function renderCardDetail() {
  const card = selectedCard();
  if (!card) return "";
  const yourTurn = Boolean(view?.isYourTurn);
  return `
    <div class="card-detail-overlay" data-action="close-detail">
      <div class="card-detail" data-action="noop">
        <div class="cd-card" style="--tone:${card.tone}">
          <img class="cd-art" src="./assets/cards/${card.id}.png" alt="" decoding="async" />
          <span class="cd-cost">${card.cost}</span>
          <button class="cd-close" data-action="close-detail" aria-label="${escapeAttribute(t("cancel"))}">✕</button>
        </div>
        <span class="cd-type">${escapeHtml(cardText(card, "type"))}</span>
        <h2 class="cd-name">${escapeHtml(cardText(card, "title"))}</h2>
        <p class="cd-text">${escapeHtml(cardText(card, "text"))}</p>
        ${
          yourTurn
            ? `
              <div class="cd-controls">
                ${renderTargetPicker(card, true)}
                ${renderFeatureChooser(card, true)}
              </div>
              <div class="cd-buttons">
                <button class="button secondary" data-action="close-detail">${escapeHtml(t("cancel"))}</button>
                <button class="button accent" data-action="play-card" ${view.turn?.cardPlayed ? "disabled" : ""}>${escapeHtml(t("playCard"))}</button>
              </div>
            `
            : `<div class="cd-buttons"><button class="button secondary" data-action="close-detail">${escapeHtml(t("cancel"))}</button></div>`
        }
      </div>
    </div>
  `;
}

function renderConsultPrompt() {
  const pc = view?.pendingConsult;
  if (!pc) return "";
  const me = myPlayer();
  const consultant = view.players.find((p) => p.id === pc.fromId);
  const client = view.players.find((p) => p.id === pc.toId);
  const iAmTarget = pc.toId === view.youId;
  const iAmConsultant = pc.fromId === view.youId;
  if (!iAmTarget && !iAmConsultant) return ""; // bystander in a 3-4 player game

  let body = "";
  if (iAmTarget && pc.stage === "awaiting-response") {
    const canAfford = (me?.credits || 0) >= pc.price;
    body = `
      <p>${escapeHtml(t("consultOffer", { name: consultant?.name || "", price: pc.price }))}</p>
      <div class="consult-actions">
        <button class="button accent" data-action="consult-accept" ${canAfford ? "" : "disabled"}>${escapeHtml(t("consultAccept", { price: pc.price }))}</button>
        <button class="button secondary" data-action="consult-decline">${escapeHtml(t("consultDecline"))}</button>
      </div>
      ${canAfford ? "" : `<p class="consult-note">${escapeHtml(t("consultCantAfford", { price: pc.price }))}</p>`}
    `;
  } else if (iAmTarget) {
    body = `<p>${escapeHtml(t("consultWaitingFeature", { name: consultant?.name || "" }))}</p>`;
  } else if (iAmConsultant && pc.stage === "awaiting-response") {
    body = `<p>${escapeHtml(t("consultWaitingResponse", { name: client?.name || "" }))}</p>`;
  } else {
    body = `
      <p>${escapeHtml(t("consultWriteFeature", { name: client?.name || "" }))}</p>
      <div class="consult-actions">
        <input id="consult-feature" class="feature-input" maxlength="80" value="${escapeAttribute(ui.consultFeature || "")}" placeholder="${escapeAttribute(t("featurePlaceholder"))}" autocomplete="off" />
        <button class="button accent" data-action="consult-submit">${escapeHtml(t("consultSend"))}</button>
      </div>
    `;
  }
  return `<div class="consult-overlay"><div class="consult-card"><h3>${escapeHtml(t("consultTitle"))}</h3>${body}</div></div>`;
}

function renderActionBar(me, current) {
  const yourTurn = view.isYourTurn;
  const card = selectedCard();
  let title;
  let hint;
  if (!yourTurn) {
    title = t("waitingFor", { name: current ? current.name : "" });
    hint = t("watchHint");
  } else if (card) {
    title = cardText(card, "title");
    hint = cardText(card, "summary");
  } else if (view.turn.cardPlayed) {
    title = t("cardPlayed");
    hint = t("cardPlayedHint");
  } else {
    title = t("yourTurn");
    hint = t("selectHint");
  }
  return `
    <div class="action-bar">
      <div class="ab-turn" style="--player-color:${me?.color || "#167b73"}">
        <span class="turn-pill">${escapeHtml(yourTurn ? t("yourTurn") : t("waiting"))}</span>
        <strong>${escapeHtml(me?.name || "")}</strong>
        <small>${escapeHtml(me?.product?.name || "")}</small>
      </div>
      <div class="ab-selected" style="--tone:${card?.tone || me?.color || "#167b73"}">
        <span class="ab-icon">${card ? escapeHtml(card.icon) : yourTurn ? "·" : "⏳"}</span>
        <div class="ab-copy">
          <strong>${escapeHtml(title)}</strong>
          <small>${escapeHtml(hint)}</small>
        </div>
      </div>
      <div class="ab-controls">
        ${renderTurnSpend(me, yourTurn)}
      </div>
      <div class="ab-buttons">
        ${
          card
            ? `<button class="game-button accent" data-action="play-card" ${!yourTurn || view.turn.cardPlayed ? "disabled" : ""}>${escapeHtml(t("playCard"))}</button>`
            : `<button class="game-button" data-action="end-turn" ${!yourTurn ? "disabled" : ""}>${escapeHtml(t("skip"))}</button>`
        }
      </div>
    </div>
  `;
}

function renderTargetPicker(card, yourTurn) {
  // Self/global cards act on you (or everyone) — no target picker needed.
  if (!yourTurn || !card || card.target === "self" || card.target === "global") return "";
  const options = view.players.filter((p) => card.target === "any" || p.id !== view.youId);
  if (!ui.target || !options.some((p) => p.id === ui.target)) ui.target = options[0]?.id || null;
  return `
    <div class="field">
      <label for="target-select">${escapeHtml(t("target"))}</label>
      <select id="target-select">
        ${options.map((p) => `<option value="${p.id}" ${p.id === ui.target ? "selected" : ""}>${escapeHtml(p.name)}</option>`).join("")}
      </select>
    </div>
  `;
}

function renderTurnSpend(me, yourTurn) {
  const spend = yourTurn ? view.turn?.autoSpend || 0 : 0;
  return `<div class="field compact-field"><label>${escapeHtml(t("spend"))}</label><select disabled><option>${spend}</option></select></div>`;
}

function renderFeatureChooser(card, yourTurn) {
  if (!yourTurn || !cardNeedsFeatureChoice(card)) return "";
  const suggestions = featureSuggestions(card);
  if ((!ui.featurePick || !suggestions.includes(ui.featurePick)) && suggestions[0]) ui.featurePick = suggestions[0];
  // Only New Feature lets you type your own; Acquire can only pick an opponent's feature.
  const allowType = card.id === "new-feature";
  return `
    <div class="field feature-choice">
      <label for="feature-pick">${escapeHtml(t("featureChoice"))}</label>
      <div class="feature-pick-row">
        <select id="feature-pick" ${suggestions.length ? "" : "disabled"}>
          ${
            suggestions.length
              ? suggestions.map((feature) => `<option value="${escapeAttribute(feature)}" ${feature === ui.featurePick ? "selected" : ""}>${escapeHtml(featureText(feature))}</option>`).join("")
              : `<option value="">${escapeHtml(card.id === "acquire" ? t("nothingToAcquire") : t("noIdeasYet"))}</option>`
          }
        </select>
        ${allowType ? `<input id="feature-text" class="feature-input" value="${escapeAttribute(ui.featureText)}" maxlength="80" placeholder="${escapeAttribute(t("featurePlaceholder"))}" autocomplete="off" />` : ""}
      </div>
    </div>
  `;
}

function cardNeedsFeatureChoice(card) {
  return Boolean(card && ["acquire", "new-feature"].includes(card.id));
}

function targetPlayerFor(card) {
  if (!card) return null;
  const needsTarget = card.target === "other" || card.target === "any";
  const id = needsTarget ? ui.target || defaultTargetId(card) : view.youId;
  return view.players.find((player) => player.id === id) || null;
}

function featureSuggestions(card) {
  if (!card) return [];
  if (card.id === "acquire") {
    const target = targetPlayerFor(card);
    return uniqueStrings((target?.features || []).map((feature) => feature.name)).slice(0, 8);
  }
  // new-feature: draw from your idea pool (seeded from your roadmap, grown by User Feedback).
  return uniqueStrings(myPlayer()?.featurePool || []).slice(0, 10);
}

function fallbackFeatureSuggestions(card) {
  const me = myPlayer();
  const target = targetPlayerFor(card);
  if (card.id === "acquire") {
    const shipped = (target?.features || []).map((feature) => feature.name).filter(Boolean);
    if (shipped.length) return shipped;
    const product = target?.product?.name || (lang === "zh" ? "对方产品" : "their product");
    return lang === "zh" ? [`添加${product}导入`, "添加同步状态页", "添加数据映射步骤"] : [`Add ${product} import`, "Add sync status panel", "Add data mapping step"];
  }
  const product = me?.product?.name || (lang === "zh" ? "产品" : "Product");
  if (card.id === "user-feedback") {
    return lang === "zh" ? ["添加上手检查清单", "添加反馈表单", "添加结果解释页"] : ["Add first-run checklist", "Add feedback form", "Add result explanation panel"];
  }
  return [];
}

async function requestFeatureSuggestions() {
  const card = selectedCard();
  if (!card || !cardNeedsFeatureChoice(card) || ui.featureSuggestionsLoading) return;
  if ((myPlayer()?.credits || 0) < 1) return showToast(t("needIdeaCredit"));
  const context = featureSuggestionContext(card);
  if (!context.key) return;
  ui.featureSuggestionKey = context.key;
  ui.featureSuggestions = [];
  ui.featureSuggestionsLoading = true;
  render();
  const data = await postJson(`/api/rooms/${session.code}/feature-suggestions`, { playerId: session.playerId, payload: context.payload });
  if (ui.featureSuggestionKey !== context.key) return;
  ui.featureSuggestionsLoading = false;
  if (data.error) {
    ui.featureSuggestions = [];
    render();
    return;
  }
  ui.featureSuggestions = Array.isArray(data.features) ? data.features.filter(Boolean) : [];
  if (ui.featureSuggestions[0]) ui.featurePick = ui.featureSuggestions[0];
  showToast(t("ideasCharged"));
  render();
}

function featureSuggestionContext(card) {
  const me = myPlayer();
  const target = targetPlayerFor(card);
  const targetFeatures = (target?.features || []).map((feature) => feature.name).filter(Boolean);
  const payload = {
    lang,
    cardId: card?.id,
    cardTitle: cardText(card, "title"),
    product: me?.product || null,
    target: target ? { name: target.name, product: target.product, features: targetFeatures } : null,
    existingFeatures: (me?.features || []).map((feature) => feature.name).filter(Boolean),
  };
  const key = JSON.stringify({
    lang,
    cardId: payload.cardId,
    product: payload.product?.name,
    target: target?.id,
    targetFeatures,
    existingFeatures: payload.existingFeatures,
  });
  return { key, payload };
}

function uniqueStrings(values) {
  const seen = new Set();
  const out = [];
  for (const value of values) {
    const clean = String(value || "").trim().replace(/\s+/g, " ");
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    out.push(clean);
  }
  return out;
}

function featureChoiceFor(card) {
  if (!cardNeedsFeatureChoice(card)) return {};
  const typed = String(ui.featureText || "").trim().replace(/\s+/g, " ");
  const picked = String(ui.featurePick || "").trim();
  if (typed) return { featureText: typed };
  if (!picked) return {};
  return { selectedFeatureName: picked };
}

function renderCard(card) {
  const selected = ui.selected === card.instanceId;
  const title = cardText(card, "title");
  return `
    <button class="card face-card ${selected ? "selected" : ""}" style="--tone:${card.tone}" data-action="select-card" data-id="${card.instanceId}" title="${escapeAttribute(`${title}: ${cardText(card, "text")}`)}">
      <img class="card-art" src="./assets/cards/${card.id}.png" alt="" decoding="async" />
      <div class="card-top">
        <span class="card-icon">${escapeHtml(card.icon)}</span>
        <span class="card-cost">${card.cost}</span>
      </div>
      <h3>${escapeHtml(title)}</h3>
      <small>${escapeHtml(cardText(card, "type"))}</small>
    </button>
  `;
}

function renderFinished() {
  const ranked = (view.ranking || view.players.map((p) => p.id))
    .map((id) => view.players.find((p) => p.id === id))
    .filter(Boolean);
  return `
    <main class="setup">
      <section class="panel">
        <div class="panel-header">
          <h2>${escapeHtml(t("demoResults"))}</h2>
          <div class="top-actions">
            ${renderLangToggle("dark")}
            <button class="button slim danger" data-action="leave-game">${escapeHtml(t("leave"))}</button>
          </div>
        </div>
        <div class="panel-body leaderboard">
          ${ranked
            .map(
              (player) => `
                <div class="leader">
                  <div class="leader-row1">
                    <h3>${escapeHtml(player.name)}: ${escapeHtml(player.product.name)}</h3>
                    <div class="score">${player.score}</div>
                  </div>
                  <div class="leader-row2">
                    <img class="award-badge" src="./assets/awards/${player.award || "steady"}.png" alt="" decoding="async" />
                    <div class="award-title">${escapeHtml(t("award." + (player.award || "steady")))}</div>
                    ${player.appReady ? `<button class="button slim secondary" data-action="open-app" data-id="${player.id}">${escapeHtml(t("openApp"))}</button>` : `<span class="no-app">${escapeHtml(t("noApp"))}</span>`}
                  </div>
                  <p class="leader-line">${escapeHtml(t("leaderLine", { shipped: player.shipped, progress: player.progress, credits: player.credits }))}</p>
                </div>
              `,
            )
            .join("")}
        </div>
      </section>
      ${toast ? `<div class="floating-toast">${escapeHtml(toast)}</div>` : ""}
    </main>
  `;
}

// ---- utils -------------------------------------------------------------------

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

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

function escapeAttribute(value) {
  return escapeHtml(String(value ?? "").replace(/\\/g, ""));
}
