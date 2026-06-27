# Roundtable Handoff

## Current State

The local server and Cloudflare tunnel have been intentionally stopped at the
user's request. There is no active live room, and any previous trycloudflare URL
or room code should be treated as dead. Start a fresh server/tunnel and create a
new room before asking the user to join.

The latest game implementation is committed through:

```text
6a9195e Make shipped features concrete
```

This handoff file may be committed after that.

## Product Goal

Roundtable is a browser-based playing-card game about building software products
with AI. It should feel like a game scene, not a form-heavy app:

- 2 to 4 players.
- Each player joins with a name and a free-text product idea.
- Each player receives random strategy cards.
- The current player sees their own cards face-up.
- Other players' cards render as card backs.
- Cards represent software-building strategies.
- Ending a turn automatically spends that turn's allocated AI credits and builds
  a phone-app product artifact.

## Important User Preferences

Do not reintroduce:

- Multi-choice product selection.
- Placeholder names like Ada, Ben, Cora.
- A right-side "Pick a card" explanation box.
- Text-heavy board instructions.
- Abstract shipped features like "core workflow" or "User onboarding".
- A manual "AI sprint" button.

The user wants shipped features to be concrete, itemized product features, for
example `添加中文界面与导航`, `添加画笔和橡皮工具`, or
`Add Chinese language option`.

## Current Rules

- Product ideas are required when hosting or joining.
- Generic placeholders and any Roundtable-themed product idea are rejected.
- Short Chinese ideas are allowed: `画图` is valid, while one-character Chinese
  ideas and placeholders like `产品` still fail.
- Join/create form values are preserved on failed validation or failed join.
- Feature suggestions cost 1 credit.
- Game credits convert to model output caps at 800 output tokens per credit.
- Every turn automatically consumes credits on end turn.
- If multiple features ship in a turn, the credit allocation is divided among
  the features, so each feature receives less polish.
- `Fast Prototype` now costs 3 credits because it can ship multiple features.

## Code Map

- `public/index.html`: online multiplayer entry.
- `public/local.html`: single-device pass-and-play entry.
- `public/online.js`: online UI, join/create flow, localized text, feature
  choices, form preservation, SSE/polling client behavior.
- `public/app.js`: local pass-and-play UI and local rules copy.
- `public/data/cards.json`: card definitions, cost, strategy text, and localized
  card text.
- `public/assets/cards/*.png`: text-free card art.
- `server/index.js`: HTTP server, static file serving, room routes, health route.
- `server/rooms.js`: in-memory rooms, lobby, joins, starts, actions, SSE clients.
- `server/engine.js`: authoritative online game rules.
- `server/build.js`: OpenAI-compatible build and feature suggestion logic plus
  fallback mobile-app artifact builder.

Keep `server/engine.js` and `public/app.js` behavior aligned when changing core
rules. Online is authoritative through `server/engine.js`; local mode still has
its own copy.

## Recent Implementation Notes

The recent work added or changed:

- Online room hosting over a Cloudflare quick tunnel.
- Meaningful product validation on server and client.
- Chinese validation fix so `画图` can join.
- Form preservation after join validation errors.
- Feature lists visible on player boards.
- Paid AI feature suggestions.
- Automatic end-turn builds.
- `Fast Prototype` cost increased from 1 to 3.
- Default backlog generation changed from abstract labels to concrete features.

For a Chinese drawing product like `画图`, the initial backlog now includes:

- `添加中文界面与导航`
- `添加画笔和橡皮工具`
- `添加颜色选择器`
- `添加作品保存列表`
- `添加图片导出与分享`

For an English language-learning product, backlog examples include:

- `Add learner profile setup`
- `Add daily study schedule`
- `Add lesson progress tracker`
- `Add quiz review cards`
- `Add Chinese language option`

## Resolved: Concrete Polish Fallback

The abstract `Launch polish ${n}` fallback is fixed. When the backlog is
exhausted, `advanceProduct()` (in both `server/engine.js` and `public/app.js`)
now ships concrete, localized, cycling polish features from `POLISH_FEATURES_EN`
/ `POLISH_FEATURES_ZH` (e.g. `Add empty-state guidance` / `添加空状态引导`),
chosen by product language (`hasCjk` online, `IS_ZH` locally) and tracked per
player via `player.polishCount` so successive items differ. Verified: a full
bilingual game ships 0 `Launch polish` names.

Minor follow-up seen in testing: the `acquire` card can copy a feature across
languages, producing a mixed name like `Adapt 添加上手检查清单`. Low priority —
consider translating the adapted feature to the acquirer's product language.

## Last Playtest Before Kill

The killed live room was `R5LZM`. It is gone because the server was stopped.
State just before kill:

- Round 3.
- AI Host product: `AI study planner for language learners`.
- User `小明` product: `画图`.
- AI Host had shipped concrete features including:
  - `Add spaced repetition cards`
  - `Add learner profile setup`
  - `Add daily study schedule`
  - `Add lesson feedback form`
  - `Add lesson progress tracker`
  - `Add quiz review cards`
  - `Add Chinese language option`
- The remaining issue seen there was the abstract `Launch polish 8` fallback.

Do not try to resume that game; create a fresh room.

## Run And Check

Install dependencies if needed, then:

```sh
npm start
```

The local app runs at:

```text
http://localhost:5173
```

Syntax check:

```sh
npm run check
```

Quick tunnel for remote play:

```sh
cloudflared tunnel --url http://localhost:5173 --no-autoupdate
```

After starting a tunnel, create a fresh room from the UI or by POSTing
`/api/rooms`, then give the user only the public URL and 5-character room code
when they ask to play.

## Hosting Cleanup

If a previous hosted session is running, stop it before rehosting:

```sh
screen -S roundtable-server -X quit 2>/dev/null || true
screen -S roundtable-tunnel -X quit 2>/dev/null || true
for pid in $(lsof -tiTCP:5173 -sTCP:LISTEN 2>/dev/null); do kill "$pid" 2>/dev/null || true; done
pkill -f "cloudflared tunnel --url http://localhost:5173" 2>/dev/null || true
```

Verify cleanup:

```sh
screen -ls || true
lsof -nP -iTCP:5173 -sTCP:LISTEN || true
ps -axo pid,command | rg 'cloudflared|roundtable-server|roundtable-tunnel|node server/index.js' | rg -v rg || true
```

## Git

Remote:

```text
https://github.com/2iw31Zhv/Roundtable.git
```

The user expects regular check-ins after meaningful work:

```sh
git status --short --branch
git add <changed files>
git commit -m "<clear message>"
git push
```

## UX Priorities

Keep improving the game feel:

- Large table scene.
- Strong active-player highlighting.
- Card backs for opponents.
- Large face-up current-player hand at the bottom.
- Played/discard area on the table.
- Minimal board text.
- Card art and icons over explanatory panels.

Mobile screenshots from the user showed that log text can feel cramped and
truncated. Prefer tighter summaries and game-like visual cues over long text.
