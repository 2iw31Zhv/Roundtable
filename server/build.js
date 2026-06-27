// Turns a turn-build payload into a runnable single-file phone-app prototype.
// The product players build in Roundtable is a mobile app, so the artifact is a
// self-contained mobile UI (status bar, app header, primary action, list rows,
// bottom tab bar) that adapts its skin to iOS vs Android at runtime.
//
// AI source is host-provided and OpenAI-compatible. The AI path is used when
// either AI_API_KEY (a hosted/cloud key) or AI_API_BASE (e.g. a local model
// server such as Ollama/LM Studio) is set; otherwise the built-in offline
// builder runs. Shared by the legacy /api/build route and room builds.

export function aiMode() {
  if (process.env.AI_API_KEY && process.env.AI_API_BASE) return "custom";
  if (process.env.AI_API_KEY) return "cloud";
  if (process.env.AI_API_BASE) return "local";
  return "offline";
}

export async function buildArtifact(payload) {
  return aiMode() === "offline" ? buildFallbackArtifact(payload) : buildWithAi(payload);
}

export async function suggestFeatures(payload = {}) {
  const fallback = fallbackFeatureSuggestions(payload).slice(0, 1);
  if (aiMode() === "offline") return { mode: "offline", features: fallback };

  const baseUrl = process.env.AI_API_BASE || "https://api.openai.com/v1";
  const model = process.env.AI_MODEL || "gpt-4o-mini";
  const maxTokens = modelTokenBudget(payload.tokenBudget, 800);
  const lang = normalizedLanguage(payload.lang);
  const headers = { "Content-Type": "application/json" };
  if (process.env.AI_API_KEY) headers.Authorization = `Bearer ${process.env.AI_API_KEY}`;

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        temperature: 0.7,
        max_tokens: maxTokens,
        messages: [
          {
            role: "system",
            content:
              lang === "zh"
                ? "你是产品经理。根据给定产品的名称、定位和受众，提出该产品真实用户最想要的一个具体功能。用动词开头（例如“添加图层”“添加撤销重做”），必须是该产品本身的功能；不要写“添加反馈表单/评分/调查/通知”等与产品无关的通用功能，也不要重复已有功能。只返回 JSON：{\"features\":[\"功能\"]}，正好 1 项，最多 14 个汉字，不要解释。"
                : "You are a product manager. Given the product's name, pitch, and audience, propose the single concrete feature its real users would most want. Start with an action verb (e.g. 'Add layers') and make it a feature OF THE PRODUCT ITSELF — never a generic feedback/rating/survey/notification feature, and never a duplicate of an existing one. Return only JSON: {\"features\":[\"Feature\"]} with exactly 1 item, 2-5 words. No explanation.",
          },
          {
            role: "user",
            content: JSON.stringify({
              product: payload.product,
              existingFeatures: payload.existingFeatures || [],
              language: lang,
            }),
          },
        ],
      }),
    });

    if (!response.ok) return { mode: "fallback", features: fallback };
    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "";
    const parsed = extractJson(text);
    const raw = Array.isArray(parsed) ? parsed : parsed?.features;
    return { mode: "ai", features: sanitizeFeatureSuggestions(raw, fallback).slice(0, 1) };
  } catch {
    return { mode: "fallback", features: fallback };
  }
}

async function buildWithAi(payload) {
  const baseUrl = process.env.AI_API_BASE || "https://api.openai.com/v1";
  const model = process.env.AI_MODEL || "gpt-4o-mini";
  const maxTokens = Math.max(modelTokenBudget(payload.tokenBudget, 8000), 6000);
  const outputLanguage = normalizedLanguage(payload.language) === "zh" ? "Simplified Chinese" : "English";
  // A local model server (Ollama, LM Studio, llama.cpp) usually needs no key;
  // only attach Authorization when the host actually provided one.
  const headers = { "Content-Type": "application/json" };
  if (process.env.AI_API_KEY) headers.Authorization = `Bearer ${process.env.AI_API_KEY}`;
  // Send the model a clean product spec (no game state) so it builds the actual app.
  const player = payload.player || {};
  const product = player.product || {};
  const appSpec = {
    appName: product.name || "App",
    whatItDoes: product.pitch || product.name || "",
    audience: product.audience || "",
    features: (player.features || []).map((feature) => feature.name).filter(Boolean),
    language: outputLanguage,
  };
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        temperature: 0.5,
        max_tokens: maxTokens,
        messages: [
          {
            role: "system",
            content:
              `You are a senior front-end engineer. Build a REAL, working, self-contained single-file HTML mobile web app that genuinely implements the product in \`app\` — NOT a mockup, NOT a dashboard, NOT a list of feature names. Hard requirements: (1) It must actually WORK and be usable: every control does something real. A drawing app needs a real <canvas> you can draw on with touch and mouse (brush, eraser, colors); a flashcards app needs real cards you can flip and move between; a tracker stores entries (in memory or localStorage) and shows them. Implement each item in app.features as actual working functionality. (2) One self-contained HTML file: inline CSS and JS only, no external assets, no frameworks, no network calls. (3) Touch-friendly and phone-sized, clean and modern. (4) Do NOT include any game or meta concepts — no rounds, scores, quality, market, credits, "features shipped" counters, strategy cards, or status dashboards. It is the END-USER PRODUCT, not a game screen. (5) No alert() or placeholder click handlers and no dead buttons — write real behavior. (6) All visible text in ${outputLanguage}. Return ONLY the complete self-contained HTML document — start with <!DOCTYPE html> and end with </html>. No JSON, no markdown code fences, no commentary.`,
          },
          {
            role: "user",
            content: JSON.stringify({
              task:
                "Build the working app described in `app`. Implement every feature in app.features as real, usable functionality so a real person could open the file and actually use the app. Prioritize working interactivity over decorative chrome.",
              app: appSpec,
            }),
          },
        ],
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.warn(`AI build failed: ${response.status} ${detail}`);
      return buildFallbackArtifact(payload, fallbackNote(payload, "aiCallFailed"));
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "";

    // Models (especially local ones) often wrap JSON in ``` fences or add prose.
    const parsed = extractJson(text);
    if (parsed && (parsed.html || parsed.files)) {
      const html = parsed.html || parsed.files?.["index.html"] || fallbackHtml(payload);
      return {
        mode: "ai",
        html,
        notes: parsed.notes || (normalizedLanguage(payload.language) === "zh" ? "AI 构建完成。" : "AI build complete."),
        files: parsed.files || { "index.html": html },
      };
    }

    // JSON that didn't fully parse (e.g. truncated output): pull the html field out and unescape it.
    const fieldHtml = extractHtmlField(text);
    if (fieldHtml) {
      return {
        mode: "ai",
        html: fieldHtml,
        notes: normalizedLanguage(payload.language) === "zh" ? "AI 构建完成。" : "AI build complete.",
        files: { "index.html": fieldHtml },
      };
    }

    // Some models skip JSON and just return the HTML document directly.
    const rawHtml = extractHtmlDocument(text);
    if (rawHtml) {
      return {
        mode: "ai-html",
        html: rawHtml,
        notes: normalizedLanguage(payload.language) === "zh" ? "AI 返回了原始 HTML。" : "AI returned raw HTML.",
        files: { "index.html": rawHtml },
      };
    }

    // Last resort: wrap whatever text we got into the phone-app shell.
    return {
      mode: "ai-text",
      html: fallbackHtml(payload, text),
      notes:
        normalizedLanguage(payload.language) === "zh"
          ? "AI 返回了非结构化文本，Roundtable 已将其包装成手机应用页面。"
          : "AI returned unstructured text, so Roundtable wrapped it into a phone-app page.",
      files: { "index.html": fallbackHtml(payload, text), "ai-output.txt": text },
    };
  } catch (error) {
    console.warn(`AI build error: ${error.message}`);
    return buildFallbackArtifact(payload, fallbackNote(payload, "aiCallErrored"));
  }
}

function modelTokenBudget(value, fallback) {
  const n = Math.round(Number(value || fallback));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(20000, Math.max(64, n));
}

function fallbackFeatureSuggestions(payload = {}) {
  const lang = normalizedLanguage(payload.lang);
  const product = sanitizeFeatureText(payload.product?.name) || (lang === "zh" ? "产品" : "Product");
  const targetProduct = sanitizeFeatureText(payload.target?.product?.name) || (lang === "zh" ? "对方产品" : "their product");
  const targetFeatures = Array.isArray(payload.target?.features) ? payload.target.features.map(sanitizeFeatureText).filter(Boolean) : [];

  if (payload.cardId === "acquire") {
    return targetFeatures.length
      ? targetFeatures.slice(0, 5)
      : lang === "zh"
        ? [`添加${targetProduct}导入`, "添加同步状态页", "添加数据映射步骤"]
        : [`Add ${targetProduct} import`, "Add sync status panel", "Add data mapping step"];
  }
  if (payload.cardId === "user-feedback") {
    return lang === "zh" ? ["添加上手检查清单", "添加反馈表单", "添加结果解释页"] : ["Add first-run checklist", "Add feedback form", "Add result explanation panel"];
  }
  return lang === "zh" ? ["添加引导设置", "添加列表详情页", "添加导出按钮"] : ["Add guided setup", "Add list detail view", "Add export button"];
}

function sanitizeFeatureSuggestions(values, fallback) {
  const seen = new Set();
  const clean = [];
  for (const value of Array.isArray(values) ? values : []) {
    const item = sanitizeFeatureText(value);
    if (!item || seen.has(item)) continue;
    seen.add(item);
    clean.push(item);
    if (clean.length >= 5) break;
  }
  return clean.length ? clean : fallback;
}

function sanitizeFeatureText(value) {
  return String(value || "")
    .replace(/[<>]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 80);
}

function buildFallbackArtifact(payload, note = null) {
  const lang = normalizedLanguage(payload.language);
  const html = fallbackHtml(payload);
  const notes = note || fallbackNote(payload, "offline");
  return {
    mode: "offline",
    html,
    notes,
    files: {
      "index.html": html,
      "README.md":
        lang === "zh"
          ? `# ${payload.player.product.name}\n\n这是 Roundtable 第 ${payload.round} 回合构建的移动应用。\n\n在手机上打开 index.html，或添加到主屏幕后使用。\n\n功能：\n${payload.player.features
              .map((feature) => `- ${localizeFeature(feature.name, lang)}`)
              .join("\n")}\n`
          : `# ${payload.player.product.name}\n\nA mobile app built during Roundtable round ${payload.round}.\n\nOpen index.html on a phone (or add it to your home screen) to use the app.\n\nFeatures:\n${payload.player.features
        .map((feature) => `- ${feature.name}`)
        .join("\n")}\n`,
      "product-state.json": JSON.stringify(payload.player, null, 2),
    },
  };
}

function fallbackHtml(payload, aiText = "") {
  const player = payload.player;
  const lang = normalizedLanguage(payload.language);
  return phoneAppHtml({
    language: lang,
    color: player.color || "#3f7d5a",
    name: player.product.name,
    pitch: localizePitch(player.product, lang),
    audience: localizeAudience(player.product.audience, lang),
    progress: player.progress,
    quality: player.quality,
    market: player.market,
    credits: player.credits ?? "—",
    features: player.features.map((feature) => localizeFeature(feature.name, lang)),
    backlog: player.backlog.slice(0, 4).map((item) => localizeFeature(item, lang)),
    noteText: aiText,
  });
}

function normalizedLanguage(value) {
  return value === "zh" ? "zh" : "en";
}

function fallbackNote(payload, key) {
  const lang = normalizedLanguage(payload.language);
  const notes = {
    en: {
      offline: "Offline builder used.",
      aiCallFailed: "AI call failed; offline builder used.",
      aiCallErrored: "AI call errored; offline builder used.",
    },
    zh: {
      offline: "已使用离线构建器。",
      aiCallFailed: "AI 调用失败，已使用离线构建器。",
      aiCallErrored: "AI 调用出错，已使用离线构建器。",
    },
  };
  return notes[lang][key] || notes[lang].offline;
}

function phoneLabels(lang) {
  return lang === "zh"
    ? {
        everyone: "所有用户",
        pitch: "一个新的移动应用。",
        conceptValidated: "概念已验证",
        roadmapClear: "路线图已明确",
        notes: "AI 说明",
        open: "打开",
        workflowComplete: "流程已完成，面向用户交付。",
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
        everyone: "everyone",
        pitch: "A new mobile app.",
        conceptValidated: "Concept validated",
        roadmapClear: "Roadmap is clear",
        notes: "AI notes",
        open: "Open",
        workflowComplete: "Workflow complete — built for your users.",
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

function localizeAudience(value, lang) {
  if (lang !== "zh") return value;
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

function localizePitch(product, lang) {
  if (lang !== "zh") return product.pitch;
  return `一个面向${localizeAudience(product.audience, lang)}的移动应用，围绕「${product.name}」打造核心流程。`;
}

function localizeFeature(value, lang) {
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
  if (match) return `改造：${localizeFeature(match[1], lang)}`;
  match = name.match(/^(.+) workflow$/);
  if (match) return `「${match[1]}」工作流`;
  match = name.match(/^Launch polish(?: (\d+))?$/);
  if (match) return `发布打磨${match[1] ? ` ${match[1]}` : ""}`;
  return name;
}

// Shared phone-app template. Produces a single self-contained mobile screen that
// detects iOS vs Android at runtime and switches typography, corner radius, and
// chrome to match. Kept in sync with the local builder in public/app.js.
function phoneAppHtml(o) {
  const lang = normalizedLanguage(o.language);
  const labels = phoneLabels(lang);
  const accent = o.color;
  const name = escapeHtml(o.name || "Untitled app");
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
  const ctaEcho = jsString(lang === "zh" ? `流程已完成，面向${o.audience || labels.everyone}交付。` : `Workflow complete — built for ${o.audience || "your users"}.`);
  const ctaLabel = lang === "zh" ? `${labels.open}${name}` : `${labels.open} ${name}`;
  return `<!doctype html>
<html lang="${lang === "zh" ? "zh-CN" : "en"}" data-os="web">
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

// Pull a JSON object out of a model response that may be fenced or padded.
function extractJson(text) {
  if (!text) return null;
  const candidates = [];
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) candidates.push(fence[1]);
  candidates.push(text);
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first !== -1 && last > first) candidates.push(text.slice(first, last + 1));
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate.trim());
    } catch {
      /* try next */
    }
  }
  return null;
}

// Extract a full HTML document if the model returned one (optionally fenced).
// Pull a JSON "html" field value (handling escapes) when the full JSON could
// not be parsed — e.g. the model's JSON got truncated mid-string.
function extractHtmlField(text) {
  if (!text) return null;
  const opener = text.match(/"html"\s*:\s*"/);
  if (!opener) return null;
  let out = "";
  for (let i = opener.index + opener[0].length; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === "\\") {
      out += ch + (text[i + 1] ?? "");
      i += 1;
      continue;
    }
    if (ch === '"') break;
    out += ch;
  }
  try {
    const html = JSON.parse(`"${out}"`);
    return /<\w/.test(html) ? html : null;
  } catch {
    return null;
  }
}

function extractHtmlDocument(text) {
  if (!text) return null;
  const fence = text.match(/```(?:html)?\s*([\s\S]*?)```/i);
  const body = fence ? fence[1] : text;
  const match = body.match(/<!doctype html[\s\S]*<\/html>/i) || body.match(/<html[\s\S]*<\/html>/i);
  return match ? match[0] : null;
}

// Encode a string as a safe JS string literal for embedding inside <script>.
function jsString(value) {
  return JSON.stringify(String(value ?? "")).replace(/</g, "\\u003c");
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
  });
}
