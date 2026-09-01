# MOSKE — AI Handoff (master context)

> Gamified triathlon PWA. **Display name = MOSKE; all backend/repo names stay `triquest`** (user wants visible-only rebrand). Full source is in the repo — clone it; this file is the map + architecture + pending work, not a full code dump.

## Identity & infra
- **Repo**: https://github.com/Suneson/triquest (owner casing `Suneson`, user `suneson`). Local: `X:\z_PERSONAL\Claude workspace\triquest`.
- **Live**: https://suneson.github.io/triquest/ — GitHub Pages, branch `main` `/root`, no build step. Pure static HTML/CSS/vanilla ES modules.
- **Supabase**: project ref `kmanszmqgmyninoplwbt` (region eu-west-3, free tier). A Supabase **connector/MCP is configured** → use `apply_migration`, `deploy_edge_function`, `execute_sql`, etc. No Supabase CLI / Deno locally.
- **Tests**: `npm test` (node --test) → 78 passing. CI in `.github/workflows/ci.yml`. Logic in `js/core/` is DOM-free + unit-tested.
- **Service worker**: `sw.js`, **network-first for same-origin** (offline → cache). **Bump `const CACHE='triquest-vN'` on every asset change** (currently `v19`); add new JS files to its ASSETS list.

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
  supabaseUrl: 'https://kmanszmqgmyninoplwbt.supabase.co',
  supabaseAnonKey: 'sb_publishable_43Vs_xVwx_uY9vRZZNTG9w_SQt-YWKe',
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
css/styles.css        blue Bevel palette vars; glass cards; .zone neon; .bento; .pwr bars; .cap wizard; .lb-*; .pp-*; mono numerics
js/core/
  icons.js            svg(name) line-icon suite (stroke 1.75)        [FULL below]
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

## EXACT — `js/core/icons.js`
```js
const P = {
  run:'<circle cx="13.5" cy="4" r="1.6"/><path d="M7 21l3-5v-4l4 2 2 4"/><path d="M10 12 8 9l4-1 3 2 2-1"/>',
  bike:'<circle cx="6" cy="17" r="3.2"/><circle cx="18" cy="17" r="3.2"/><path d="M6 17l4-7h5M9.5 7H13l3.5 10"/>',
  swim:'<circle cx="8" cy="8.5" r="1.5"/><path d="M5 13l5-3 3 2 4-3"/><path d="M3 17c2 1.4 3.6 1.4 5.5 0M14.5 17c2 1.4 3.6 1.4 5.5 0"/>',
  gym:'<path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10"/>', brick:'<rect x="3" y="4" width="18" height="7" rx="1.5"/><rect x="3" y="13" width="18" height="7" rx="1.5"/>',
  mobility:'<circle cx="12" cy="4.5" r="1.6"/><path d="M12 7v6l-5 7M12 13l5 7M7 10h10"/>', other:'<circle cx="12" cy="12" r="7"/>',
  plus:'<path d="M12 5v14M5 12h14"/>', regen:'<path d="M3 11a9 9 0 0 1 15-5l3 3M21 13a9 9 0 0 1-15 5l-3-3"/><path d="M21 4v5h-5M3 20v-5h5"/>',
  trash:'<path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/>', edit:'<path d="M4 20h16M14 4l4 4-9 9-4 1 1-4 8-8Z"/>',
  bag:'<path d="M6 8h12l-1 12H7L6 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  trophy:'<path d="M7 4h10v4a5 5 0 0 1-10 0V4Z"/><path d="M7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3M9 20h6M12 14v6"/>',
  medal:'<circle cx="12" cy="15" r="5"/><path d="M9 10 7 3h10l-2 7"/>', clock:'<circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/>',
  spark:'<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/>',
  flame:'<path d="M12 3c4 4 5 7 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 1 1 2 2 2 0-3-1-5 1-8Z"/>',
  route:'<circle cx="6" cy="6" r="2"/><circle cx="18" cy="18" r="2"/><path d="M8 6h7a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h7"/>',
  check:'<path d="M5 13l4 4L19 7"/>', flag:'<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  moon:'<path d="M20 14a8 8 0 1 1-10-10 7 7 0 0 0 10 10Z"/>', warn:'<path d="M12 3 2 20h20L12 3Z"/><path d="M12 10v4M12 17h.01"/>',
};
export function svg(name, cls=''){ return `<svg viewBox="0 0 24 24" class="ic ${cls}" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name]||P.other}</svg>`; }
```

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
`tab`, `open-workout`, `open-profile`, `lb-toggle`, `edit-goals`, `ai-wizard`, `clear-future` (delete source=custom & date>=today), `shop-open`, `open-auth`, `dismiss-sync`, `open-editor-new`, `prev/next-week`, `edit|duplicate|delete`, `toggle-exercise`, `toggle-preset-pack`, `toggle-tomorrow-pack`, `log-metric`, settings `data-set` / `data-pack-preset`. **Tab switch always `scrollTo(0,0)`.**

## CSS palette (`:root`)
`--bg:#070a12; --bg-2:#0d1322; --bg-3:#141c30; --bg-4:#1e2842; --fg:#eaeefa; --muted:#828ea8; --border:#1a2236; --accent:#ffd166; --good:#2ec4b6;` discipline `--c-run/bike/swim/gym/brick/mobility`. FAB & lb-active = `#0047AB`. Cards = `rgba(13,19,34,.7)`+blur12+radius16. Zone neon: Z1/2 `#00f0ff`, Z3 `#39ff14`, Z4 `#ffaa00`, Z5 `#ff0055`.

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
4. **Emoji scrub incomplete** outside Home/Leaderboard/Wizard: emojis remain in `editor.js`, `auth.js` (toasts), `main.js` settings buttons (↻⬇⬆📅📲), badge wall icons (Profile), `plan.js`/`badges.js`, toast icons. Replace with `svg()` for full consistency.
4b. Profile/Settings tabs not yet given the full Bevel facelift pass (Home/cards done).
5. ✅ **DONE** — AI power chart uses structured `power:[{min,watts}]`; ai-plan deployed v15 (see Done section).
6. Optional: store per-workout packing-checked state UI is `extra.packed`; pack-for-tomorrow toggles across tomorrow sessions — verify multi-session edge cases.
7. RUN levels 6-10 + GYM level 10 are placeholder `templvl*.png` art — `sportArtSrc()` clamps below them, so high-level runners/lifters cap at the last finished frame until real art lands.
```
