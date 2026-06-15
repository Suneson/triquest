# 🔱 TriQuest

> A gamified, offline-first triathlon training tracker. Tick off sessions, earn XP, hold your streak, unlock badges — all in a single static page that lives on your phone.

**Live app:** https://suneson.github.io/triquest/

TriQuest is a **pure static site** — HTML, CSS and vanilla ES modules, **zero runtime dependencies**, no build step, no backend. It ships pre-loaded with a full periodized triathlon plan (1 Jul → 6 Dec 2026) building to an IRONMAN 70.3 and a marathon, and it works offline as an installable PWA.

---

## ✨ Features

### Gamification
- **Satisfying completion** — a big tap target with a pop animation, a confetti burst, and an optional generated sound effect (Web Audio, no asset files; off by default).
- **XP & levels** — XP per session scaled by discipline, duration, intensity and distance, with an ever-lengthening level curve and a progress bar in the header.
- **Streaks** — consecutive days with ≥1 completed session, with a **one-day grace** so an unfinished *today* doesn't break a streak that was alive yesterday. Shows current + longest.
- **17 triathlon-flavoured badges** — first workout, 3/7/14-day streaks, 100/500 km bike, 100 km run, complete a brick, run+bike+swim in a day, reach level 5/10, 12+ hours trained, 50 workouts, a 200 km bike week, and more. New unlocks celebrate with a toast.

### Always-on HUD
Current level + XP bar, streak, total training hours, total distance, and sessions completed — visible on every screen.

### Three tabs
- **Today** — today's sessions, plus a **🎒 Pack for tomorrow** panel that aggregates tomorrow's packing items into one checklist so you can prep your bag the night before.
- **Week** — the 7-day plan with prev/next navigation, the current day highlighted, rest days shown, and deload / taper / race weeks flagged with the phase name.
- **Progress** — lifetime totals, an 8-week volume bar chart, discipline breakdown, a 16-week consistency heatmap, the pace/zone reference card, the plan principles, and the full badge wall (locked + unlocked).

### Session detail
- **Plan-ahead notes** that save as you type.
- **Per-session packing checklists** (add / remove / check items).
- **Interval / Fartlek visualizer** — structured sessions draw their work/rest/effort blocks as a colour-coded segment bar with a legend (easy / moderate / threshold / VO₂ / steady).
- **Gym exercise illustrations** — every exercise renders an **original inline-SVG movement demonstration** (themed line-art, instant, offline-proof) with 2–3 coaching cues and sets×reps. Tick off each exercise and log actual weight / reps / RPE. Each exercise also has a **custom image URL** escape hatch that overrides the drawing.
- **Duration slider** with a live "1 h 30 m" label that drives XP and volume.
- **Fuelling reminder** on long runs/rides (≥ 90 min): *practice 60–90 g carbs/h*.

### Create & edit
A clear **+ FAB** opens an editor supporting title, type, date, duration slider, distance, intensity, notes, interval structure, gym exercises and a packing list. Edit, delete, duplicate or swap any session — planned or improvised.

### Extras
- **PWA** — web manifest + service worker. "Add to Home Screen", launches fullscreen, works fully offline.
- **Backup** — export your data to JSON and import it back. (Data is stored *per-device in this browser*; it does not sync between phone and laptop — use export/import.)
- **Race countdown banner** — days until the next race.
- **Settings** — sound on/off, units (km/mi), week-start day, reduce-motion, and a confirm-gated reset/reseed.
- **Accessibility** — keyboard-operable, visible focus styles, `prefers-reduced-motion` respected, large tap targets, ARIA labels, sensible contrast.
- **Dark theme** with a distinct colour per discipline.

---

## 🏃 The plan it ships with

A 3-phase periodized build, generated across real calendar dates from **weekly templates** (not hand-typed), with deload weeks (every 4th week in phases 1–2, ~40% volume), a taper window, and the two races inserted as milestone cards:

| Phase | Dates | Focus | Hours/wk |
|---|---|---|---|
| 1 — Base + Strength | Jul 1 → Aug 31 | Strength, aerobic engine, run base, swim | 10–12 |
| 2 — 70.3 Specific | Sep 1 → Oct 19 | Bike sharpening, bricks, race pace, taper | 10–12 |
| 3 — Marathon Bridge | Oct 20 → Dec 6 | Run durability, long-run build, taper | 7–9 |

> 🏆 IRONMAN 70.3 — **19 Oct 2026** &nbsp;·&nbsp; 🥇 Marathon — **6 Dec 2026**

*(The original phase map left Aug 31 uncovered between phases 1 and 2; Base is extended one day to keep the calendar contiguous.)*

---

## 🚀 Run it locally

No build, no dependencies. Any static server works — for example:

```bash
# zero-dependency dev server included in the repo
node tools/serve.mjs 8744
# → http://localhost:8744

# or use anything else you like
python -m http.server 8080
npx serve .
```

Then open the printed URL. Opening `index.html` via `file://` will **not** work because the app uses ES modules (the browser blocks module loading over `file://`); serve it over HTTP.

---

## 🧪 Tests

The core logic (XP, levels, streaks, badges, plan expansion, date math) lives in pure modules under [`js/core/`](js/core) with **no DOM or storage dependencies**, so it runs straight in Node's built-in test runner — no install needed:

```bash
npm test          # node --test
```

36 tests cover scoring/levels, the streak grace rule, badge thresholds (including week-boundary logic), and the full plan expansion (phase boundaries, deloads, race days, the long-run progression, unique ids). CI runs them on every push and PR — see [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

---

## 🏗️ Architecture

```
triquest/
├── index.html              # app shell (stable containers only)
├── css/styles.css          # dark, discipline-coloured, mobile-first
├── js/
│   ├── core/               # PURE, framework-free, unit-tested
│   │   ├── dates.js        #   ISO-date helpers (DST-safe)
│   │   ├── plan.js         #   phases + weekly templates → expandPlan()
│   │   ├── scoring.js      #   XP, level curve, volume stats
│   │   ├── streaks.js      #   streak + one-day grace
│   │   ├── badges.js       #   17 achievements + evaluation
│   │   └── poses.js        #   inline-SVG exercise figures + cues
│   └── app/                # browser layer (DOM + storage)
│       ├── store.js        #   defensive localStorage + state + mutations
│       ├── ui.js           #   HTML rendering for HUD / tabs / cards / charts
│       ├── editor.js       #   session editor modal
│       ├── effects.js      #   confetti, generated sound, toasts
│       └── main.js         #   bootstrap, derived state, event delegation
├── tools/
│   ├── gen-icons.mjs       # procedural PNG icon generator (pure JS PNG encoder)
│   └── serve.mjs           # zero-dep static dev server
├── icons/                  # app icons (SVG + generated PNG)
├── sw.js                   # offline-first service worker
├── manifest.webmanifest    # PWA manifest
└── tests/                  # node --test suites
```

**Design principle:** the `js/core` modules know nothing about the browser. Rendering and persistence are isolated in `js/app`. State flows one way — mutations write to the store, the store emits, and `main.js` re-renders from derived data. UI interactivity is wired with **event delegation** (`data-action` attributes) so re-rendering never leaves dangling listeners.

### Data model

A single JSON object in `localStorage` (`triquest.v1`). **Level, XP, streak and all stats are derived from the workouts on every render** — the workouts are the single source of truth. Only unlocked-badge ids and settings are stored explicitly.

```jsonc
{
  "version": 1,
  "settings": { "sound": false, "units": "metric", "weekStart": 1, "reduceMotion": false },
  "unlockedBadges": ["first-workout", "..."],
  "workouts": [
    {
      "id": "seed-2026-07-06-0",
      "date": "2026-07-06",
      "type": "run",                       // run|bike|swim|gym|brick|mobility|other
      "title": "Run quality — Fartlek",
      "intensity": "quality",              // easy|steady|moderate|threshold|quality|vo2|race
      "durationMin": 60,
      "completed": false,
      "completedAt": null,
      "phase": "Base + Strength",
      "deload": false,
      "metrics": { "distanceKm": 12 },
      "segments": [ { "label": "Hard", "kind": "work", "value": 3, "intensity": "threshold" } ],
      "exercises": [ { "name": "Back squat", "sets": 4, "reps": "5", "done": false, "weight": "", "rpe": "", "actualReps": "", "imageUrl": "" } ],
      "packing": [ { "item": "Running shoes", "checked": false } ],
      "notes": ""
    }
  ]
}
```

If `localStorage` is unavailable (private mode, storage blocked), the app transparently falls back to an in-memory store and shows a warning banner — your data simply won't persist past the tab.

---

## 📦 Dependencies

**None at runtime.** No frameworks, no charting library, no confetti library, no icon CDN. Everything — confetti, sound, charts, exercise illustrations, the PNG icon generator — is written from scratch in vanilla JS/SVG/Canvas. The only "tooling" is Node itself (for the built-in test runner and the icon/serve scripts). This keeps the site fast, offline-proof, license-clean, and trivial for GitHub Pages to serve.

---

## 🌐 Deploy (GitHub Pages)

The repo root **is** the site, so Pages serves it directly:

1. Push to `main`.
2. Repo **Settings → Pages → Build and deployment → Deploy from a branch → `main` / `/ (root)`**.
3. The site goes live at `https://<user>.github.io/triquest/`.

No build step and no `gh-pages` branch are required.

---

## 📄 License

MIT © 2026 Alberto Marrero Suneson — see [LICENSE](LICENSE).
