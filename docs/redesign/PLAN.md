# Pixel gamification pass: plan

Branch: `redesign/pixel-gamify` (from `main` at `22decda`). `main` is never
pushed to or merged by this work.

Status: **all four phases built.** Read with `DESIGN.md` (repo root). Before
and after screens: `docs/redesign/before/` and `docs/redesign/after/`.

## Decisions (from your Phase 0 answers)

| Question | Decision | Done |
|---|---|---|
| Palette | Navy canvas, gold for buttons and highlights; indigo retired | Yes |
| `templvl` art | Run 6–10 are real levels (renamed `RUNLVL6–10.png`). Gym `templvl10` not mentioned, so Gym still caps at 9 | Yes |
| Quest verification | Strava-linked sessions only | Yes |
| Home rings | Replaced by segmented pixel meters | Yes |
| Day boundary | Whole app on the local date (`todayISO()` in `core/dates.js`) | Yes |
| Tab labels | Added: Home, Journal, Ranks, Shop, Profile | Yes |
| Tour de France boards | Kept for now | — |
| Bike | Keeps its animated layered scene; Run/Gym/Swim get code-driven motion | Yes |
| Publish | Merge to `main` once finished | At the end of this pass |

## What was built

- **Phase 1:** tokens, Silkscreen font (self-hosted, OFL), one framed-component
  system in `css/styles.css`, the pixel icon set (`core/icons.js`, 16×16
  bitmaps, same `svg()` API), Home (date header, weekly meters, quests,
  today's target, tomorrow, AI coach), docked tab bar with labels, gold FAB,
  dialogue toasts.
- **Phase 2:** Journal (opens on today), Leaderboards, Shop, workout sheet,
  editor, goals, settings, auth, AI onboarding, welcome, Fitness hub, cardio,
  activity, level carousel. Emoji scrubbed from the UI (`.ics` export text
  still uses discipline emoji, as before). Audit bugs fixed: clipped Settings
  buttons, FAB over the Journal "TODAY" tag, stacked "coming soon" toasts (the
  sports are real now), wrapping stat tile, the bike `BIKELVL` 404s.
- **Phase 3:** `core/scenes.js` manifest (tested), Run/Gym/Swim scenes with
  backdrop matching, corner covers, motion overlays; region nudge tried and
  dropped (seams); `ART-BRIEF.md`.
- **Phase 4:** `core/quests.js` (tested), account level (header chip + Fitness
  hub), Home quests panel with reset countdown, feedback moments (quest
  accepted, XP pop, quest complete, sport level-up sheet with a scene wipe,
  account level-up), pixel confetti, the coach in dialogue boxes
  (`core/coach-lines.js`, tested).

**Leaderboard note:** the `leaderboard` RPC is unchanged, so leaderboard XP
does **not** include quest XP. Adding it needs a Supabase migration, which is
out of scope without your go-ahead.

**Quest launch date:** quests count from `QUESTS_SINCE = 2026-10-05` (the
Monday of launch week), so nobody gets a pile of retroactive quest XP.

---

# Phase 0 plan (as approved)

Screenshots: `docs/redesign/before/*.png`, 390×844 at 2x, captured by
`node tools/shots.mjs docs/redesign/before` against `tools/serve.mjs`. The
same script produces the "after" set for each phase, so the pairs line up.

---

## 0. Inputs I did not have

These change what I can do, so they come first.

1. **Images A and B were not attached.** Nothing came through with the
   message. I took image A's interface language from your written description
   ("pixel display type… hard 2px borders with stepped corners, dialogue-box
   panels, the stat card with a level chip, chunky two-state buttons, small
   pixel icons with labels, one accent on a dark canvas"). For image B I used
   my own screenshot of Profile > Cycling (`before/06-profile-cycling-progressed.png`).
   Please re-attach A before Phase 1 so I can check the specimen against it.
2. **The trainer folder is not in the repo.** This session runs in a cloud
   container that clones `Suneson/triquest` from GitHub. It cannot see
   `D:\00_CLAUDE\…\triquest` on your PC. `icons/` on GitHub has only
   `Pixelart/{BIKE,GYM,RUN,SWIM}`. To give me the trainer art (and anything
   else that exists only locally), commit it to this branch, for example
   `icons/trainer/…`, or attach the files in chat.
3. **The design skills aren't installed here.** `redesign-existing-projects`,
   `image-to-code`, `playwright-cli` and `web-design-guidelines` don't exist in
   this session under any prefix. I followed their intent by hand: a
   vanilla-CSS audit of every screen (section 1), Playwright screenshots at
   390×844 through a repeatable script, and a guidelines review planned at the
   end of each phase. If you can enable them, I'll run them for real from
   Phase 1.

---

## 1. Audit (before)

| Screen | Shot |
|---|---|
| Home (fresh / progressed / scrolled) | `01-home`, `07-home-progressed`, `01b-home-scrolled` |
| Journal | `02-journal` |
| Leaderboards (offline here) | `03-leaderboards` |
| Shop (offline here) | `04-shop` |
| Profile > Cycling (fresh / levelled) | `05-profile-cycling`, `06-profile-cycling-progressed` |
| Profile > Swim / Run / Gym stubs | `06-profile-{swim,run,gym}-stub` |
| Level carousel + lightbox | `08-modal-level-carousel-gym`, `08b-level-lightbox` |
| Workout detail: bike / run / gym | `10-…`, `11-…`, `12-…` (+ `-scrolled`) |
| New-session editor | `13-modal-editor-new` |
| Weekly goals | `14-modal-goals` |
| Fitness hub, cardio, activity | `15-fitness-hub`, `15b-…`, `16-cardio-detail`, `17-activity-history` |
| Settings | `18-settings`, `18b-settings-scrolled` |
| Auth | `19-auth` |
| AI coach onboarding | `20-ai-onboarding-step1` |
| Toast | `21-toast` |
| First-run welcome | `22-welcome` |

Supabase, Shopify and the jsDelivr CDN can't be reached from this sandbox, so
Leaderboards and Shop show their offline state, and auth can't complete. No
page errors were thrown on any screen.

### What I found

**Palette is split three ways.** Home, Journal and the modals are charcoal
(`#121214`) with **indigo** primaries (`#5E5CE6`). Profile is **navy** with
bike-blue chips (`#3da9fc`). The focus ring and editor accents are **gold**.
The `theme-color` meta is navy (`#11182b`). You described the current look as
"navy/blue with the gold accent", which matches Profile and the meta tag but
not Home. See open question 1.

**Bugs and rough edges** (all fixed during the phase that touches the file):
- Settings: the Export / Import / Calendar buttons clip their labels ("JSON"
  is cut off) (`18-settings`).
- Journal: the FAB covers the "TODAY" tag on today's row (`02-journal`).
- Level carousel sheet: a large empty band above the strip (`08-…`).
- Profile: tapping Swim, Run, Gym stacks "work in progress" toasts on top of
  the HUD (`06-profile-gym-stub`).
- Fitness hub: "3 months" wraps onto two lines inside its stat tile (`15-…`).
- `ui.js` `SPORT_ART.bike` points at `BIKELVL{n}.png`, which doesn't exist.
  The bike level carousel and thumbs would be blank. Only the dead
  `renderProgress()` path reaches them today; Phase 3's manifest replaces
  both.
- Dead code: `renderProgress()` and everything only it calls (sport-level
  rows, load panel, weekly volume, body metrics, badge wall, reference cards)
  is not wired to any tab. It's left alone; I'll list it in HANDOFF rather
  than delete it unasked.
- Emoji still in Settings (⚙️🔊🌀⬇⬆📅📲☁️🔗↻), editor (➕, type select), Fitness
  hub (☁️ ⚙), toasts (🎉⭐📈🎯✅🛰️), welcome cards, badges. Scrubbed per file
  in Phase 2.
- `backdrop-filter: blur()` on the tab bar, header, modal backdrop, Profile
  HUD and sport buttons. That's costly on older iPhones and off-style for
  pixel art; it goes.
- The app's "today" is the **UTC** date (`new Date().toISOString().slice(0,10)`,
  14 call sites). In Spain or Sweden the day flips at 01:00 or 02:00 local.
  That matters for daily quests (open question 6).

---

## 2. Per-tab plan

"Stays" means behaviour and content; everything gets the new tokens.

### Phase 1: design system + Home
**Changes**
- Tokens, Silkscreen font files and `OFL.txt`, base components (panel,
  dialogue, buttons, chips, inputs, toast, sheet) in `css/styles.css`.
- `js/core/icons.js` redrawn on a 16-grid, same names and API, plus the new
  names listed in DESIGN.md §3. A unit test checks every name returns a valid
  `<svg>` and that unknown names still fall back.
- Header: MOSKE wordmark in the display font, square avatar frame.
- Event banner becomes a slim dialogue strip with the `flag` icon.
- "This week" hero: the three rings become three **segmented pixel meters**
  (10 segments each) with display-font percentages. Plan / Volume / Intensity
  and their targets stay, and so do Edit and the coaching line. Open
  question 5 if you'd rather keep rings.
- Focus card ("Today's target"), Tomorrow's glance and the session cards
  become panels: discipline colour as a 4px left edge, display-font numbers,
  pixel icons.
- AI coach card becomes a dialogue box with a primary button.
- Tab bar: docked panel, gold active cell, pixel icons.
- FAB: gold square, lifts above toasts.
- Toasts: dialogue style, icon via `svg()`, at most two stacked.
- SW `CACHE` bump; font files added to `ASSETS`; `tools/serve.mjs` gains
  `.woff2`, `.webp` and `.gif` MIME types.

**Stays**: section order, every data point, all actions, the goal editor.

### Phase 2: remaining screens
- **Journal**: week strip and day rows as panels; today's row in a `--line`
  border with a gold "TODAY" tag. Fix the FAB overlap.
- **Leaderboards**: season banner as a dialogue strip; Season / All-time as a
  two-cell segmented control; podium blocks as stepped panels with rank in the
  display font; rows as panels. The offline state becomes a dialogue box.
- **Shop**: product cards as panels with price in the display font; offline
  state as a dialogue box. No change to the Shopify query.
- **Workout detail**: meta chips, power bars as stepped columns (zone hue, no
  glow), structured blocks, exercises, packing (pixel checkbox),
  edit / duplicate / delete as secondary / ghost / danger.
- **Editor, goals, settings, auth, AI onboarding, welcome**: same system. Fix
  the clipped Settings buttons. Emoji scrubbed in `editor.js`, `auth.js`,
  `main.js` (settings, toasts, welcome cards), `profile-game.js` (hub). Badge
  icons in `badges.js` move to icon names, rendered via `svg()`.
- **Fitness hub, cardio, activity**: panels and display-font numbers. The
  charts keep their line style but lose glows. Fix the wrapping stat tile.

### Phase 3: Profile scenes for Run, Gym, Swim
See section 3.

### Phase 4: quests and feedback
See section 4.

---

## 3. Profile scenes (Phase 3 design)

### 3.1 Manifest: `js/core/scenes.js` (pure data, tested)

```js
export const SCENES = {
  bike: { kind: 'layered', label: 'Cycling', levels: [ /* 1..10 */
    { bg: '…/BIKE/BACKGROUND/background.png',
      platform: '…/BIKE/PLATFORMS/BIKE1BLUE_0009_Layer-1.png',
      char: '…/BIKE/CHARACTERS/bikelvl1_char.webp' }, … ] },
  gym:  { kind: 'still', label: 'Gym', levels: [ /* 1..9 real; 10 omitted */
    { src: 'icons/Pixelart/GYM/GYM_LVL1.png', w: 512, h: 512,
      backdrop: ['#343b42', '#373c42'],     // top / bottom edge colours
      hide: [/* stepped polygons, % of image */],
      fx: { glow: [{ x, y, w, h }], dust: [{ x, y, w, h }] },
      nudge: null }, … ] },
  run:  { kind: 'still', … 1..5 },
  swim: { kind: 'still', … 1 },
};
export function sceneFor(sport, level) // → { kind, level: clamped, entry, maxArt, real }
```

- Only real art is listed. `sceneFor` clamps the requested level to the
  highest listed entry, so a level 8 runner sees RUNLVL5 and the HUD still
  says LVL 8. Placeholders (`templvl*`) are never referenced.
- `src` is used only as an `<img src>`. A later `.webp` or `.gif` (animated)
  drops in by editing the manifest, with no code change.
- Tests: clamping (0, 1, max, above max, NaN), every entry has the fields its
  kind needs, every percentage is 0–100, every `fx` box is inside the image,
  no path contains `templvl`, every listed file exists on disk.
- `ui.js`'s `SPORT_ART` / `SPORT_FRAMES` / `sportArtSrc()` move onto the
  manifest, which fixes the bike `BIKELVL` 404.

### 3.2 The stage for stills

- The sport switcher works for all four sports (no more "coming soon"). The
  same HUD (stat card, chip, segmented XP) is driven by
  `sportProgress(workouts, type)`.
- **Stage**: a square frame, full width minus 16px gutters (358px on a
  390px phone), centred between the switcher and the HUD. Swim is 512×454,
  so its stage follows its own aspect ratio.
- **Backdrop**: the whole screen is a vertical blend from the still's
  top-edge colour to its bottom-edge colour, so the still melts into the
  phone. Sampled values: Gym `#343b42` → `#373c42`; Run 1–2 `#5c5f64` →
  `#3d3d3f`; Run 3–4 `#9fabab` → `#4c5054`; Run 5 `#a7bfc1` → `#444643`;
  Swim `#0f1626` → `#111727`. A hard 2-step pixel band joins the colours,
  not a smooth gradient.
- **Corners**: every still has a level label baked into the bottom-left and
  a generator sparkle in the bottom-right (about 12% of the width). The
  dioramas are hexagons, so the area below their lower iso edges is plain
  backdrop. The manifest's `hide` polygons cut both bottom corners along the
  iso slope (stepped, 2px stairs) and fill the cut with the backdrop colour.
  That removes the label and the mark without touching the diorama. If an
  image's island reaches further down, its own `hide` is tuned per level.
- Scale: 512 → 358 CSS px is 0.7×, about 2.1 device pixels per art pixel on a
  3x iPhone. `image-rendering: pixelated` keeps it sharp. Bigger screens get
  a bigger stage, capped at 512 CSS px (1×).

### 3.3 Motion overlays (CSS only, on top of the still)

Small absolutely-positioned elements inside the stage, positioned in % from
the manifest, animated with `transform` / `opacity` and `steps()`. No canvas
loop and at most about 20 elements per scene. Paused under reduced motion,
when the page is hidden, and removed when leaving Profile.

| Scene | Overlay | Placement (from the images) |
|---|---|---|
| Run | drifting clouds | sky band, y 0–14% |
| Run | falling leaves | from the bare trees, x 15–40% / 75–95%, y 10–40%, falling past the island edge |
| Run | lap-clock flicker | the clock panel, about x 45–54%, y 63–69% (moves per level) |
| Gym | ceiling-light glow pulse | the hanging lamps, y 10–22% along the back walls |
| Gym | dust motes | inside the light cones below each lamp |
| Swim | water shimmer | pool surface, x 12–88%, y 30–80%, masked to the pool's diamond |
| Swim | ripple rings | around the swimmer, about x 46–54%, y 52–58% |
| All | idle bob | the whole stage, 2px (one art pixel), `steps(2)` |

The exact boxes are measured per level in Phase 3. The values above come from
gridded crops of GYM_LVL1, RUNLVL3 and the swim still.

### 3.4 Region nudge (experiment)

`nudge: { x, y, w, h, dx: 1 }` on one Gym level and one Run level. The athlete
rectangle is shown twice: the still, and a copy clipped to the rectangle
(`clip-path: inset()`) shifted 1–2 px on a `steps(2)` loop. **Expected
problem:** there's no clean background under the athlete, so the shifted copy
leaves a 1–2 px sliver of the original athlete at the leading edge. I'll
screenshot it frame by frame. If any seam shows, the flag is dropped, as you
said.

### 3.5 Art brief
`docs/redesign/ART-BRIEF.md` lists what's missing (Swim 2–10, Run 6–10, Gym 10,
the trainer set if needed), one prompt per piece matching the scenes, file
names, and the animated spec (transparent animated WebP on the still's canvas
size). See open question 3: the `templvl*` frames may not be missing at all.

---

## 4. Quests and progression (Phase 4 design)

### 4.1 `js/core/quests.js` (pure, tested)

```js
export const QUEST_POOL = [ { id, kind: 'training' | 'app', xp, text, since,
  eligible(day) → bool, done(day) → bool }, … ];
export function questsFor(dateISO, workouts, settings) // → [{ id, text, xp, done }] × 3
export function questXpThrough(dateISO, workouts, settings) // → total quest XP to date
export function accountProgress(workouts, settings, today) // → levelFromTotalXp(training + quest XP)
```

**Verified** means `completed && (strava_activity_id || source === 'strava')`.
That's stricter than XP's `completed` on purpose. An imported JSON file can
mark sessions completed, so it can't earn quest XP (open question 4).

**Pool v1**

| id | kind | Quest | Eligible when | Done when | XP |
|---|---|---|---|---|---|
| `plan-done` | training | Finish today's planned session | a non-Strava session is planned today | one of today's planned sessions is verified | 40 |
| `min-45` | training | Train 45+ minutes today | always | verified minutes today ≥ 45 | 30 |
| `two-disc` | training | Two disciplines in one day | ≥ 2 types planned today | verified sessions of ≥ 2 types today | 50 |
| `streak` | training | Keep the streak alive | verified session yesterday | verified session today | 30 |
| `km-10` | training | Cover 10 km today | a run/bike/swim/brick is planned | verified distance today ≥ 10 km | 30 |
| `brick` | training | Nail the brick | a brick is planned today | a brick is verified today | 50 |
| `pack-bag` | app | Pack tomorrow's bag | tomorrow has a session with a packing preset | every preset item is ticked for tomorrow's sessions | 10 |

**Selection**: seed = FNV-1a hash of the date string → mulberry32 PRNG →
shuffle the pool → take the first three that are eligible, with at most one
`app` quest. The same date and plan always give the same three quests, on
every device. If fewer than three are eligible, the day shows fewer.

**Stability trade-off**: eligibility reads the day's planned sessions, so
editing today's plan can swap a quest. The alternative is freezing the set in
`settings.questDays[date]` the first time it renders. I've left that out to
stay derived-only; tell me if you'd rather freeze.

**Pool versioning**: quests carry `since` dates. The pool is append-only, so
past days never re-roll and past quest XP never changes.

### 4.2 Account level
- Account XP = training XP (the existing `computeStats().totalXp`) + quest XP
  derived over every day from the first workout to today. Nothing new is
  stored for training quests.
- `pack-bag` reads `workout.packed`, which already persists and syncs. If
  someone un-ticks after the day passes, that past quest flips back. It's
  10 XP and I'd accept it rather than add storage.
- The account level replaces the "Level" tile in the Fitness hub (it's already
  the total-XP level) and shows as a chip in the Home header. Per-sport
  levels stay separate and drive the scenes.
- **Leaderboards**: the `leaderboard` RPC is unchanged, so leaderboard XP does
  **not** include quest XP yet. Adding it needs a migration, and you said to
  stop and ask before any of those.

### 4.3 Home "Daily quests" panel
A dialogue box below "This week": title, reset countdown ("RESETS 06:12",
ticking once a minute, not every second), three rows (pixel checkbox, body
text, gold `+XP`). Done rows tick green with a strike-through. When the
trainer art exists, the coach portrait sits in the panel header with one line
of encouragement.

### 4.4 Feedback moments (`js/app/effects.js`)
| Moment | Trigger | Feedback |
|---|---|---|
| Quest accepted | editor saves a new session | dialogue toast "Quest accepted" + short blip |
| Verified completion | `render()` diffs completed ids before and after a sync | "+NN XP" pop at the session card, XP bar fills segment by segment |
| Quest complete | quest done set grows | toast with `scroll` icon, "+40 XP", chime |
| Level up (sport) | `sportProgress().level` rises | full-screen sheet: old scene → stepped wipe → new level art, "LVL 8", fanfare. On Profile the stage swaps the same way |
| Level up (account) | account level rises | toast + pixel confetti (square, no rotation, stepped) |

Sound only when `settings.sound` is on. Motion is skipped under reduced
motion (the toast still appears).

---

## 5. Trainer (your addition)

The idea: one recognisable coach character who "speaks" the app's
training-specific messages in the dialogue box, so there's a face telling you
what to do.

**Where the coach appears**
1. Workout detail: a top line of guidance built from the session
   ("Z2, 75 minutes. Keep it conversational, hold 180–200 W on the climbs.").
2. Home quests panel header: one line for the day (rest day, streak at risk,
   all quests done).
3. Quest accepted / quest complete / level-up toasts and the level-up sheet.
4. First-run welcome: replaces the three emoji cards.
5. Strava not connected: a nudge explaining that verified sessions are what
   earn XP.

**Lines**: `js/core/coach-lines.js`, pure and tested. Rule-based picks from
type, intensity, `hr_zone`, the `[Main Set]` block, streak and quest state.
No AI calls, no network.

**Animation, honestly**: I can't create or redraw art. With the files you
supply I can:
- crop portraits from full-body stills and export them at exact pixel scale;
- assemble frames you provide (for example idle / blink / talk) into a
  looping transparent animated WebP with Pillow, or loop them in code;
- add code-side motion: a 1px idle bob, mouth or blink frame swaps if two
  frames exist, a jump on level-up.

I can't produce new poses, a talking mouth from a single still, or smooth
video. If the folder has one still, the coach is a still portrait with a code
bob. The art brief will list the extra frames that would make him talk and
blink.

**Art needed**: square portrait ≥ 64×64 (96×96 ideal) on transparency, same
pixel scale as the scenes (the coach on the bench in every scene looks like
the same character, so matching him is ideal). Optional frames: `idle`,
`blink`, `talk`, `cheer`.

---

## 6. Open questions

1. **Palette**: GitHub `main` has a charcoal Home with indigo buttons; only
   Profile is navy. My plan moves the whole app to the navy canvas, with gold
   as the one accent, retiring indigo. Is that what you mean by "the current
   look", or is your local copy different and not pushed yet?
2. **Image A and the trainer folder**: please re-attach A and commit the
   trainer art (section 0).
3. **The `templvl*` frames look finished to me.** `RUN/templvl6–10` have
   distinct runners, the coach, level signs and progressing scenery;
   `GYM/templvl10` has a "LEVEL 10" label like the others. Are they rejected
   drafts? If they're usable, renaming them unlocks Run 6–10 and Gym 10 now and
   shrinks the art brief to Swim 2–10.
4. **Verified = Strava-linked** for quests (stricter than XP today), because
   Import JSON can set `completed`. OK?
5. **Rings → segmented meters** on Home. You said you like the current look.
   Keep the rings (restyled flat) or switch to meters?
6. **Day boundary**: the app's "today" is UTC, so quests would reset at 01:00
   or 02:00 your time. Switch the whole app to the local date? It's a small,
   app-wide change; I'd do it as its own commit in Phase 4.
7. **Tab labels**: add small labels under the five tab icons (shown in the
   specimen), or stay icons-only?
8. **Bike art branding**: the cycling scenes show "Tour de France" boards. On
   a public site that's a trademark risk. It's your art and your call; I only
   flag it.

---

## 7. Done criteria per phase
`npm test` green (83 today, plus new tests), no console errors across
`tools/shots.mjs`, SW `CACHE` bumped whenever an app asset changes, before and
after screenshots in `docs/redesign/`, a guidelines review of changed files
with findings fixed or listed, HANDOFF.md updated, and a short summary.

Phase 0 changed no app files (only `DESIGN.md`, `docs/redesign/*`,
`tools/shots.mjs`, `HANDOFF.md`), so there's no SW bump and no guidelines
review this phase.


---

## Pass 2 (fixes, feel, game layer): status

| Item | Status | Where |
|---|---|---|
| A1 full-bleed stage, A2 no bob | done | `profile-game.js`, `styles.css` |
| A3 training data in the system font | done | `--font-data`, DESIGN.md §2.2 |
| A4 tab bar pinned (fixed grid shell, `--tabs-h`, `?safe=N`) | done | `index.html`, `styles.css` §shell |
| A5 spacing tokens + gap audit | done | `tools/gap-audit.mjs` |
| A6 quest XP in Supabase | done, live | `0006_quest_xp.sql` (applied in seven parts), `quest-claims.js`, `quest-sync.js` |
| A7 guidelines, 44px targets, `?demo=1`, iPhone 15 run | done (Chromium; WebKit not installable) | REVIEW.md |
| B1 tab wipe (View Transitions) | done | `motion.js` |
| B2 rolling numbers, stepped meters | done | `motion.js`, `meter()` |
| B3 skeleton tiles | done | Ranks, Shop, public profiles |
| B4 pressed/focus/disabled/busy | done | `busy()` |
| C1 living scenes | done | `timeOfDay()`, `.pg-tod` |
| C2 week path + season sheet | done | `core/path.js`, `game.js` |
| C3 podium, movement, rival | done | `core/ranks.js`, `leaderboard.js` |
| C4 trophy cabinet | done | `profile-game.js` |
| C5 pixel charts | done | `profile-game.js` (stepped `wavePath`, `blockBars`) |
| C6 share card | done | `share.js` |
| C7 rest days | client done; server **waits for 0007** | `core/rest.js`, `0007_rest_quest.sql` |
| C8 scene strip on Today's target | done | `ui.js` `sceneStrip()` |
| D1 art brief | done | ART-BRIEF.md |
| D2 concept prompts | done | CONCEPTS.md |
| D3 docs | done | DESIGN.md, REVIEW.md, HANDOFF.md, this file |
