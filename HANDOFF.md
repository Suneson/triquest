# MOSKE — AI Handoff (master context)

> **Pixel-art redesign (Oct 2026).** The UI is a pixel skin: navy canvas, gold
> accent, Silkscreen display font, stepped-corner frames, pixel icons, Run /
> Gym / Swim scenes, daily quests, an account level and a coach character.
> `DESIGN.md` is the spec; `docs/redesign/PLAN.md` records the decisions and
> `docs/redesign/ART-BRIEF.md` the art still to come. Screens are captured with
> `node tools/shots.mjs <out-dir>` (Playwright, 390×844) against
> `node tools/serve.mjs`.

> Gamified triathlon PWA. **Display name = MOSKE; all backend/repo names stay `triquest`** (user wants visible-only rebrand). Full source is in the repo — clone it; this file is the map + architecture + pending work, not a full code dump.

## Identity & infra
- **Repo**: https://github.com/Suneson/triquest (owner casing `Suneson`, user `suneson`). Local: `X:\z_PERSONAL\Claude workspace\triquest`.
- **Live**: https://suneson.github.io/triquest/ — GitHub Pages, branch `main` `/root`, no build step. Pure static HTML/CSS/vanilla ES modules.
- **Supabase**: project ref `vopzemijzoxezathmrai` (region eu-north-1, free tier; auto-pauses after ~7 idle days, restore from the dashboard or the connector). The ref in `js/app/config.js` is the source of truth. A Supabase **connector/MCP is configured** → use `apply_migration`, `deploy_edge_function`, `execute_sql`, etc. No Supabase CLI / Deno locally.
- **Tests**: `npm test` (node --test) → 111 passing. CI in `.github/workflows/ci.yml`. Logic in `js/core/` is DOM-free + unit-tested.
- **Service worker**: `sw.js`, **network-first for same-origin** (offline → cache). **Bump `const CACHE='triquest-vN'` on every asset change** (currently `v40`); add new JS/font files to its ASSETS list.
- **Dates**: the app's "today" is the athlete's **local** date — always use `todayISO()` from `js/core/dates.js`, never `toISOString().slice(0, 10)` (that is UTC and flips the day at 01:00/02:00 in Europe).

## Architecture
- **Store abstraction** (`js/app/store.js` facade): `LocalStore` (offline blob, localStorage key `triquest.v1`) ↔ `SupabaseStore` (signed-in: LocalStore write-through cache + Postgres truth, **last-write-wins by `updated_at`**, realtime). Swap on sign-in/out via `useStore()`.
- **Auth** (`js/app/auth.js`): Supabase v2, **flowType `implicit`** (magic links survive in-app browsers). Methods: magic link (`signInWithOtp`), email+password (`signInWithPassword`/`signUp`), forgot-password (`resetPasswordForEmail` → `PASSWORD_RECOVERY` → set-password modal → `updateUser`). **Google/Apple removed.** Email confirmation is OFF on the project. URL `type=recovery` is captured before client init.
- **Anti-cheat**: workout `completed` is **read-only in the UI** — only set by verified Strava activity (webhook/sync). No manual tick/swipe.
- **AI**: Groq, `response_format:{type:'json_object'}` → `{workouts:[…]}`. (Migrated off Gemini — its key had free-tier limit 0.) Model: `openai/gpt-oss-120b`, then `qwen/qwen3.6-27b`, then `llama-3.3-70b-versatile`; if all are rejected the function asks Groq's `/v1/models` for a live one. `GROQ_MODEL` pins a specific id. **`meta-llama/llama-4-scout-17b-16e-instruct` was decommissioned (deprecated 2026-06-17) and every plan request 502'd until this changed** — if the coach breaks again, check the model first.
- **Shop**: Shopify Storefront API `https://moskeshop.com/api/2026-04/graphql.json`, public token `f42b47288ec62ce928ff8dccf9e36ffb`, collection handle `ss-26`.

## Supabase schema (migrations in `supabase/migrations/`)
- `profiles(id uuid pk→auth.users, display_name text, settings jsonb, created_at, updated_at)` — auto-created by `handle_new_user` trigger. **All user prefs live in `settings`** (see below) and sync via profile.
- `workouts(id TEXT pk, user_id uuid, date, type, title, intensity, duration_min int, distance_km numeric, completed bool, completed_at, phase, deload, segments jsonb, exercises jsonb, packing jsonb, notes, actual jsonb, strava_activity_id bigint, source text 'plan|custom|strava', extra jsonb, updated_at)`. Unique `(user_id, strava_activity_id)`. **id is TEXT** (app ids like `seed-…`,`w-…`,uuid). In realtime publication.
- `strava_accounts(user_id pk, athlete_id, access_token, refresh_token, expires_at, scope, …)` — RLS: **no select/insert/update policies (service-role only)**; self-`delete` allowed (disconnect).
- **RLS**: profiles & workouts = self-only (`auth.uid()`). 
- **RPCs** (SECURITY DEFINER): `strava_status()`, `leaderboard(p_since timestamptz)` (aggregated XP, all-time when null), `public_profile(p_user uuid)` (display_name/completed/total_km/total_min/dates[]). Definer fns revoked from anon/public except where intended.
- **`extra` jsonb** round-trips app-only fields; `EXTRA_KEYS=['isRace','optional','phaseId','weekNum','seeded','hr_zone','ai','packed']` (see `supabase-store.js` `workoutToRow`/`rowToWorkout`).

## Edge Functions (`supabase/functions/`, deployed via connector)
- `strava-callback` (verify_jwt **false**) — OAuth code→tokens, state = user JWT.
- `strava-webhook` (false) — GET challenge + POST create/update/delete → match.
- `strava-sync` (true) — polling pull + match.
- `ai-plan` (true) — **current code below**.
- Secrets (Supabase dashboard → Edge Functions): `GROQ_API_KEY`✓, `STRAVA_CLIENT_ID`✓, `STRAVA_CLIENT_SECRET`✓, `STRAVA_WEBHOOK_VERIFY_TOKEN`, `APP_REDIRECT_URL`. (`SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` auto-injected.)

## Frontend config — `js/app/config.js`
```js
export const CONFIG = {
  supabaseUrl: 'https://vopzemijzoxezathmrai.supabase.co',
  supabaseAnonKey: 'sb_publishable_Swiz6YuHXjnjnE4fMqgIaw_S_f1Xvf3',
  stravaClientId: '258518',
};
export const SYNC_ENABLED = Boolean(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey);
export const STRAVA_ENABLED = Boolean(SYNC_ENABLED && CONFIG.stravaClientId);
export function functionsBaseUrl(){ return CONFIG.supabaseUrl.replace('.supabase.co', '.functions.supabase.co'); }
```

## `settings` jsonb shape (synced via profile)
```js
{ sound:false, units:'metric', weekStart:1, reduceMotion:false,
  goals:{ sessions:5, km:50, hours:8 },          // editable goal rings (Home)
  ftp:250,                                        // Bike FTP (watts) → power bars + AI
  events:[{ title, date }],                       // powers Home "NEXT EVENT" banner
  packing:{ run:[…], bike:[…], swim:[…], gym:[…], brick:[…], mobility:[…], other:[…] } } // preset packing matrix
```
Per-workout checked packing items live in `workout.packed` (string[]) inside `extra`.

## File map (key changed/added)
```
index.html            tabs: Home | Leaderboards | Shop | Profile (SVG icons, no emoji)
sw.js                 v19, network-first, ASSETS list
css/styles.css        pixel skin: tokens, shared stepped-corner frame selector (--b/--e/--eo), components, scenes + fx, body.rm reduced-motion switch
fonts/                Silkscreen 400/700 woff2 + OFL.txt (self-hosted, precached)
js/core/
  icons.js            svg(name) pixel icons: 16×16 bitmaps → crisp rects (same API)
  scenes.js           Profile scene manifest (art per sport+level, overlay boxes, backdrop bands, COACH frames)
  quests.js           daily quests (date-seeded, Strava-verified only) + accountProgress()
  coach-lines.js      what the coach says (session / day / moments), rule-based
  disciplines.js      DISCIPLINES, INTENSITIES, paceHint
  scoring.js streaks.js badges.js plan.js poses.js dates.js
  strava.js sync.js load.js calendar.js   (pure, tested)
js/app/
  store.js            facade; useStore/commit/save/touchWorkout/upsert/delete/setSetting
  stores/local-store.js   defaultSettings() (goals/ftp/packing), migrate, LocalStore
  stores/supabase-store.js  SupabaseStore + workoutToRow/rowToWorkout (EXTRA_KEYS)
  stores/supabase-client.js getSupabase() lazy CDN import, flowType implicit
  auth.js             dual auth + forgot-pw + store swap
  ui.js               renderHud/Home/Today/Week/Progress, sessionCard(bento), renderWorkoutDetail, powerChart, packingChecklist, zoneBadge, structuredBlocks, eventBanner, goalRings
  main.js             routing, onClick/onChange/onInput/onSubmit delegation, openWorkoutDetail, openGoalEditor, openAIWizard, openSettings, onboarding
  leaderboard.js      seasonInfo(monthly), leaderboardShell, loadLeaderboard (podium+list+banner)
  profile.js          fetchPublicUserProfile, openPublicProfile (modal)
  shop.js             Shopify ss-26 grid
  ai.js               generateAIWorkoutPlan(wizardData, stravaHistory), stravaSummary
supabase/migrations/  0001_init, 0002_leaderboard, 0003_public_profile
supabase/functions/   strava-callback|webhook|sync, ai-plan, _shared, _scripts/register-webhook.ts
```

## Icons — `js/core/icons.js`
Each icon is a 16×16 ASCII bitmap (`#` = ink) converted once into `<path>` rects;
`svg(name, cls)` returns `<svg viewBox="0 0 16 16" class="ic …" fill="currentColor" shape-rendering="crispEdges">`.
Unknown names fall back to `other`. Render at 16/24/32 px. `ICON_NAMES` lists them;
`tests/icons.test.js` checks every bitmap is 16×16. Add an icon by adding a bitmap.

## EXACT — `supabase/functions/ai-plan/index.ts` (Groq)
> Snapshot only — the file in the repo is the source of truth. The model call
> below is the pre-2026-09 version and names a decommissioned model; the live
> function selects a model as described under **AI** above.
```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const CORS = { "Access-Control-Allow-Origin":"*", "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods":"POST, OPTIONS" };
const json = (b,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{"Content-Type":"application/json",...CORS}});
const TYPES = ["run","bike","swim","gym","brick","mobility","other"];
const INTEN = ["easy","steady","moderate","threshold","quality","vo2","race"];
const SYSTEM = `You are an elite endurance & strength coach in the style of Whoop and Bevel. NEVER output generic descriptions. Every workout's "notes" MUST be specific and split into bracketed segments: "[Warmup] ... [Main Set] ... [Cooldown] ...".
RUNNING: Fartlek, track intervals (e.g. 6x400m), tempo, VO2 max (e.g. 5x3min @ 3k pace) with paces/reps in [Main Set].
CYCLING: explicit CADENCE or POWER blocks (Sweet Spot, Over-Unders, Cadence Ladders, threshold). ALWAYS express power targets as ABSOLUTE WATTS scaled to the athlete's FTP from the questionnaire, formatted like "4x8min @ 250W" (always the letter W). Put them in [Main Set].
GYM/OTHER: specific movements with sets x reps and RPE (1-10), e.g. "Back Squat 4x5 @ RPE 8" in [Main Set].
Return ONLY a JSON object {"workouts": [ ... ]}. Each item: "title", "type" (one of ${TYPES.join("|")}), "intensity" (one of ${INTEN.join("|")}), "date" ("YYYY-MM-DD", future), "duration_min" (int), "hr_zone" (int 1-5), "notes" (structured).`;
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const auth = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!auth) return json({ error: "missing auth" }, 401);
  const admin = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false } });
  const { data: u, error: uErr } = await admin.auth.getUser(auth);
  if (uErr || !u?.user) return json({ error: "invalid token" }, 401);
  const userId = u.user.id;
  const key = Deno.env.get("GROQ_API_KEY");
  if (!key) return json({ error: "GROQ_API_KEY not configured" }, 500);
  const body = await req.json().catch(() => ({}));
  const maxDoubles = Math.max(0, Math.min(5, parseInt(body.wizard?.max_double_days) || 0));
  const ftp = Math.max(50, Math.min(600, parseInt(body.wizard?.ftp) || 250));
  const prompt = `Today is ${new Date().toISOString().slice(0,10)}.
Athlete FTP: ${ftp}W (use for cycling watt targets).
HARD SCHEDULING RULE: at most ${maxDoubles} day(s) per week may contain two sessions (two-a-day). Every other day has at most one session.
Questionnaire: ${JSON.stringify(body.wizard || {})}
Recent Strava history (most recent first): ${JSON.stringify(body.strava || [])}`;
  const gRes = await fetch("https://api.groq.com/openai/v1/chat/completions", { method:"POST", headers:{ "Content-Type":"application/json", Authorization:`Bearer ${key}` }, body: JSON.stringify({ model:"meta-llama/llama-4-scout-17b-16e-instruct", messages:[{role:"system",content:SYSTEM},{role:"user",content:prompt}], response_format:{type:"json_object"}, temperature:0.7 }) });
  if (!gRes.ok) return json({ error: `Groq ${gRes.status}`, detail: (await gRes.text()).slice(0,500) }, 502);
  const g = await gRes.json();
  let parsed; try { parsed = JSON.parse(g.choices?.[0]?.message?.content || "{}"); } catch { return json({ error:"AI returned invalid JSON" }, 502); }
  const plan = Array.isArray(parsed) ? parsed : (parsed.workouts || parsed.plan || parsed.sessions || []);
  if (!Array.isArray(plan) || !plan.length) return json({ error:"AI returned no sessions" }, 502);
  const now = new Date().toISOString();
  const rows = plan.slice(0,120).filter(p=>p?.date&&p?.type).map(p=>({ id: crypto.randomUUID(), user_id: userId, date: String(p.date).slice(0,10), type: TYPES.includes(p.type)?p.type:"other", title: String(p.title||"AI session").slice(0,120), intensity: INTEN.includes(p.intensity)?p.intensity:"moderate", duration_min: Math.max(10,Math.min(360, parseInt(p.duration_min ?? p.duration)||45)), notes: String(p.notes||""), completed:false, source:"custom", segments:[], exercises:[], packing:[], extra:{ ai:true, hr_zone: Math.max(1,Math.min(5, parseInt(p.hr_zone)||2)) }, updated_at: now }));
  if (!rows.length) return json({ error:"no valid sessions" }, 502);
  const { error: insErr } = await admin.from("workouts").insert(rows);
  if (insErr) return json({ error: insErr.message }, 500);
  return json({ inserted: rows.length });
});
```

## Custom UI (signatures — full bodies in `js/app/ui.js`)
- `sessionCard(w,units,{isNext})` → single-line **bento** card: `<article class="card bento type-${type}" data-action="open-workout" data-id>` with status-dot, title, NEXT tag, `zoneBadge(hr_zone)`, and `.bento-metrics` (clock/min, route/km, flame/kcal via `kcalEst`).
- `renderWorkoutDetail(w,units,ctx)` (modal body): `metaChips` + `fuellingChip` + (`powerChart(w,ftp)` for bike else `structuredBlocks`) + segmentBar + exercises + actuals(`actualsBlock`|`actualEntry`) + `packingChecklist(w,settings)` + foot(edit/duplicate/delete). Opened by `main.openWorkoutDetail(id)`.
- `powerChart(w,ftp)` — regex `/(\d{2,4})\s*w\b/gi` from notes → `.pwr .pwr-bar.zcol-{1|3|4|5}` height = watts/max%, zone = watts/ftp.
- `packingChecklist(w,settings)` — read-only checkboxes from `settings.packing[w.type]`, checked from `w.packed`, `data-action="toggle-preset-pack"`.
- `zoneBadge(z)` → `.zone.zone-${1..5}` neon (cyan/cyan/lime/amber/crimson).
- `structuredBlocks(w)` — parses `[Label] text` → labelled rows.
- `eventBanner(ctx)` — closest future `settings.events` → "NEXT EVENT", else hidden.
- `goalRings(ctx,ws)` — 3 rings vs `settings.goals` + Edit (`data-action="edit-goals"`).
- `leaderboard.js`: `leaderboardShell(view,today)` (sticky `.lb-banner`, Season/All-time toggle `data-action="lb-toggle"`, monthly countdown) + `loadLeaderboard()` → `rpc('leaderboard',{p_since})` → `podium()` (rows clickable `data-action="open-profile"`) + `list()`.
- `profile.js`: `openPublicProfile({uid,name,rank,xp})` → modal w/ skeleton → `rpc('public_profile')` → stats + milestones.
- `shop.js`: `loadShop()` → Shopify POST → `.shop-grid` cards `data-action="shop-open"` → `window.open(url,'_blank')`.
- `ai.js`: `generateAIWorkoutPlan(wizard, strava)` → POST `${functionsBaseUrl()}/ai-plan` with JWT → `{inserted}`.

## Key delegated actions (main.js onClick/onChange/onSubmit)
`tab`, `open-workout`, `open-profile`, `lb-toggle`, `edit-goals`, `ai-onboard`, `clear-future` / `reset-plan` (prescribed = not completed and not Strava-linked), `pg-sport` (switch the Profile scene), `open-sport-levels` (HUD level chip → level carousel), `shop-open`, `open-auth`, `dismiss-sync`, `open-editor-new`, `jr-week`, `edit|duplicate|delete`, `toggle-exercise`, `toggle-preset-pack`, `toggle-tomorrow-pack`, `log-metric`, settings `data-set` / `data-pack-preset`. **Tab switch always `scrollTo(0,0)`** (Journal then jumps to today's row). Focusable cards (`role="button" tabindex="0"`) activate on Enter/Space.

## Quests, account level, feedback (main.js)
- `buildCtx()` adds `ctx.quests = questsFor(today, …)` and `ctx.acct = accountProgress(…)` (training XP + quest XP). Nothing new is stored: quests derive from workouts (+ `workout.packed` for the bag quest). Quests start `QUESTS_SINCE = 2026-10-05`. Leaderboard XP excludes quest XP (RPC unchanged).
- `feedbackMoments(ctx)` diffs each render against the last: newly Strava-verified sessions → `xpPop`; newly done quests → one toast; a sport level rising → `openLevelUp(sport, level)` (scene wipe). `appState.seen = null` on sign-in/import/reseed so data swaps don't fire moments. New sessions from the editor → "Quest accepted".

## CSS tokens (`:root`) — full table in DESIGN.md §2
`--bg:#0B1222; --bg-2:#121C33; --bg-3:#1A2744; --bg-4:#24345A; --line:#5372B5; --line-soft:#2A3B63; --shade:#050912; --fg:#F2F5FC; --muted:#9AA8C7; --brand:#0C4CAE; --accent:#F2C14E; --on-accent:#1A1205; --good:#5BD08A; --danger:#F06A6A; --info:#6EA8FF`, discipline `--c-*` unchanged. No blur, no radius (except avatars), no glow. Framed elements share one selector in styles.css and set `--b` / `--e` / `--eo`.

## ⚠️ Gotchas
- **Bump SW `CACHE` + add new JS to ASSETS** every asset change, else stale.
- Connector `deploy_edge_function` needs **self-contained** files (inline shared code; can't `../_shared` import). Repo keeps `_shared/` for CLI parity.
- **Real users — DO NOT delete**: `albertosuneson@gmail.com`, `javiermarrerosuneson@gmail.com`, `ejaenmarrero@hotmail.com`, `jaen.osc@gmail.com`. Test users: create via `signUp` (confirmation off), always clean up `delete from auth.users where email like 'PREFIX.%@gmail.com'`.
- Live-verify flow: preview server via `.claude/launch.json` name `triquest` (port 8744); after edits unregister SW + clear caches in eval, reload. Use `Date` monkeypatch to simulate in-plan dates (plan seed is 1 Jul–6 Dec 2026; real "today" ~mid-2026).
- Seed plan (`core/plan.js`) still seeds 221 `source:'plan'` workouts on first load/sign-in (deterministic ids → not duplicated across devices). AI plans are `source:'custom'`.
- `.ics` export still uses emoji in DISCIPLINES.icon (file download text only; harmless).

## ✅ Done (recent)
Accounts+sync, Strava OAuth/webhook/polling/matching + actual-vs-planned, UX pass (undo/auto-focus/onboarding), load/ACWR + run-volume guardrail, body metrics, .ics, race checklist, MOSKE rebrand + real logo, leaderboards (monthly season + all-time + public profile), Shop, AI wizard (Groq) + FTP + double-day cap, editable goal rings, dynamic event banner, plan-state CTAs + clear-future, emoji→SVG, keyboard-free wizard (native date + event capsules + Other), Bevel blue theme + bento cards + detail modal + power bars + packing-preset matrix, forgot-password.
**Structured power + 3D level cards (pending #5 done):** ai-plan now emits a `power:[{min,watts}]` array for bike sessions (in `extra`, round-tripped via `EXTRA_KEYS`+`'power'`); `powerChart` renders width=duration / height=watts Zwift bars from it (regex-from-notes kept as legacy fallback). New `levelForType(workouts,type)` in `scoring.js` (per-discipline XP via existing curve). Detail modal shows a pressable `.isometric-card-btn --{bike|gym|run}` 3D card with pixel-art `icons/Pixelart/{BIKE|GYM|RUN}/…` — filenames are **non-uniform** (BIKELVL{n}, GYM_LVL{n}, RUN: RUNGENERAL_LVL1 then RUNLVL{2-5}); `sportArtSrc()` resolves+clamps to highest real art (bike 10/gym 9/run 5), swim+other get no card. `structuredBlocks` explodes comma/`;`/` / `-separated movements into one `.move-pill` per line. SW→v20. **ai-plan redeployed v15** (connector, verify_jwt true) — now emitting structured `power`; frontend stays back-compat with old `…W`-in-notes plans via the regex fallback.

## ⏳ PENDING / not built
1. **Strava webhook registration** for instant push — function deployed but subscription not registered. Polling ("Sync now" + on-connect) works. Run `supabase/functions/_scripts/register-webhook.ts` (or curl in SETUP.md §4) once `STRAVA_WEBHOOK_VERIFY_TOKEN` is set.
2. **Multiple plans / seasons + read-only coach SHARE LINK** — not built (needs a share table/RLS + read-only viewer route).
3. **PWA push reminders** (iOS 16.4+ installed PWA) — not built (needs VAPID + push sender Edge Function + SW push handler). Note: iOS Safari has no vibrate API.
4. ✅ Emoji scrub done (Oct 2026 redesign). Only the `.ics` export text and `RACES[].emoji` in `plan.js` still carry emoji (not shown in the UI).
4b. ✅ Every tab and sheet restyled in the pixel system.
5. ✅ **DONE** — AI power chart uses structured `power:[{min,watts}]`; ai-plan deployed v15 (see Done section).
6. Optional: store per-workout packing-checked state UI is `extra.packed`; pack-for-tomorrow toggles across tomorrow sessions — verify multi-session edge cases.
7. Art: Run 1–10 real (6–10 renamed from `templvl*`), Gym 1–9 (`GYM/templvl10.png` unapproved), Swim 1 only (`SWIM_LVL1.png`), trainer art not yet supplied. See `docs/redesign/ART-BRIEF.md`; new art is one manifest line in `js/core/scenes.js`.
8. Dead code: `ui.renderProgress()` and the panels only it calls (load, volume, body metrics, badge wall, reference cards) aren't wired to any tab. Left in place; restyled so they work if re-wired.
```
