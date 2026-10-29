# MOSKE design system: pixel skin

Status: **implemented**. Pass 1 (the pixel skin) is live; pass 2 (fixes, feel,
game layer) is on `redesign/pixel-gamify`. The tokens live in
`css/styles.css`; the original proposal specimen is
`docs/redesign/specimen.html`, the before/after screens are in
`docs/redesign/before/` and `docs/redesign/after/` (`phase-a/`, `phase-b/`,
`phase-c/` for pass 2), and motion clips are in `docs/redesign/clips/`.
Image prompts for future concepts are in `docs/redesign/CONCEPTS.md`.

This is a reskin, not a rebuild. The five tabs, the information architecture
and every feature stay. What changes is the surface: pixel display type, hard
2px borders with stepped corners, dialogue-box panels, chunky two-state
buttons, pixel icons, and one accent (gold) on a dark navy canvas.

---

## 1. Principles

1. **The art is the hero.** The isometric scenes carry the game feel. The UI
   frames them and never competes: flat fills, no gradients, no glow.
2. **One accent.** Gold means "act here or you earned this": the primary
   button, the active tab, level chips, XP fill, quest rewards, focus rings.
   Nothing else is gold.
3. **Pixels stay square.** Borders, offsets and icon sizes are whole multiples
   of `--px` (2px). Icons render at 16, 24 or 32px only.
4. **Pixel type for display, system type for reading.** Headings, numbers,
   chips and button labels use the pixel font. Sentences, notes, form input
   and anything longer than about four words use the system font.
5. **Hard edges, no blur.** No `box-shadow` blur, no `backdrop-filter`. Depth
   comes from a hard offset edge in `--shade`. (This also takes the blur cost
   off older iPhones.)
6. **Motion is stepped.** Every animation uses `steps()` timing so it reads as
   sprite frames, and all of it turns off under reduced motion.

### Atmosphere

A dark, quiet game console: the navy night is the room, the gold is the only
light switch, the scenes are the windows. Dials (the taste-skill scale):

| Dial | Value | Reads as |
|---|---|---|
| Variance | 3 | predictable and symmetric: one column, the same card rhythm on every tab |
| Motion | 6 | lively but stepped: wipes, rolls and loops, all sprite-timed |
| Density | 3 | airy: one idea per panel, 16–32px between things |

Where the design skills' defaults disagree with this file (rounded corners,
soft shadows, blur, spring easing, always-on micro-motion, asymmetric heroes,
their fonts and palettes), this file wins.

---

## 2. Tokens

All tokens live on `:root` in `css/styles.css`. Existing names keep working
(`--bg`, `--bg-2`, `--fg`, `--muted`, `--accent`, `--c-*` discipline colours);
values change and new tokens are added.

### 2.1 Colour

| Token | Value | Use | Contrast |
|---|---|---|---|
| `--bg` | `#0B1222` | page canvas (navy) | |
| `--bg-2` | `#121C33` | panel / card fill | |
| `--bg-3` | `#1A2744` | raised element on a panel, secondary button | |
| `--bg-4` | `#24345A` | inputs, empty XP segments, chips | |
| `--line` | `#5372B5` | 2px border on anything interactive | 3.6:1 on `--bg-2` (meets 3:1 non-text) |
| `--line-soft` | `#2A3B63` | decorative dividers, non-interactive panel edge | decorative only |
| `--shade` | `#050912` | hard drop edge under panels and buttons, XP track | |
| `--fg` | `#F2F5FC` | primary text | 15.5:1 on `--bg-2` |
| `--muted` | `#9AA8C7` | secondary text, labels | 7.1:1 on `--bg-2` |
| `--brand` | `#0C4CAE` | MOSKE blue (from the logo): wordmark, brand moments | white on it 7.9:1 |
| `--brand-hi` | `#2F6FD6` | top highlight on brand fills | |
| `--accent` | `#F2C14E` | the one accent (see principle 2) | 10.1:1 on `--bg-2` |
| `--accent-lo` | `#B8892A` | drop edge under gold buttons and chips | |
| `--on-accent` | `#1A1205` | text and icons on gold | 11.1:1 on `--accent` |
| `--good` | `#5BD08A` | verified / done state | 8.7:1 |
| `--danger` | `#F06A6A` | destructive actions, errors | 5.6:1 |
| `--info` | `#6EA8FF` | links, Strava-verified mark | 7.0:1 |

Discipline colours (`--c-run`, `--c-bike`, `--c-swim`, `--c-gym`, `--c-brick`,
`--c-mobility`, `--c-other`) keep their current values. They identify a sport
(dot, left edge, icon tint) and are never used as a button fill.

Retired: indigo `#5E5CE6` (primary buttons, FAB, focus outlines), the ring
gradients (`--ring-*`), the chart accents (`--acc-*`) as UI colours (they stay
for the fitness-hub charts only), and the neon zone glows.

### 2.2 Type

**Display font: Silkscreen** (Jason Kottke, SIL Open Font License 1.1),
self-hosted as `fonts/silkscreen-400.woff2` (8 KB) and
`fonts/silkscreen-700.woff2` (8 KB), with `OFL.txt` alongside. Both files go in
the service worker's `ASSETS`.

Why Silkscreen: its digits are unambiguous. Pixelify Sans was the first
candidate, but its 5 is drawn the same as S and its 2 the same as Z, which
breaks an app made of numbers (see the specimen). Press Start 2P is too wide
for a 390px screen.

Silkscreen is caps-only and built on an 8px grid, so it is crisp at 8, 16, 24
and 32px. Use no other sizes.

| Token | Value | Use |
|---|---|---|
| `--font-display` | `'Silkscreen', ui-monospace, monospace` | headings, numbers, chips, button labels |
| `--font-body` | system stack (unchanged) | everything people read |
| `--fs-d1` | 32px | big stat numbers (focus card, HUD level) |
| `--fs-d2` | 24px | screen titles (Journal, Shop) |
| `--fs-d3` | 16px | section headings, chips, buttons, XP text, eyebrows |
| `--fs-body` | 16px | body copy (never smaller on inputs: iOS zooms below 16) |
| `--fs-small` | 14px | secondary body |
| `--fs-tiny` | 12px | captions, legal (`Powered by Strava`) |

Rules:
- Numbers in the display font always use **weight 400**. Silkscreen Bold draws
  the 4 as a block that reads as a symbol.
- Weight 700 is for short caps words only: screen titles, section headings,
  button labels, the wordmark.
- Tab-bar labels and the Profile sport switcher use the **body** font (11px,
  600): the pixel font at 11px would be off-grid and blurry.
- Display text is always uppercase (`text-transform: uppercase`), with
  `letter-spacing: 0`.
- Keep display strings short: about 24 characters per line at 16px on a 390px
  screen. Longer titles (workout names) use the body font.
- Workout titles, notes, quest text, coach lines and form fields stay in the
  body font.

**Which font for which number** (rule since pass 2):

| Kind of text | Font | Examples |
|---|---|---|
| Labels, headings, buttons, chips | pixel (`--font-display`) | `THIS WEEK`, `EDIT`, `LVL 4` |
| Game numbers: XP, levels, ranks, streaks, countdowns, prices | pixel | `540 / 919 XP`, `#3`, `25 days left` |
| Training data: minutes, hours, km, kcal, pace, watts, FTP, logged sets | system (`--font-data`, 700, tabular) | `35 min`, `6.6 km`, `385 kcal` |
| Sentences: coach lines, quest text, notes, workout titles | system (`--font-body`) | |

`--font-data` is the body stack at weight 700 with `tabular-nums`. Units sit
next to the number in `.data-unit` (12px, muted). Use `.data-num` on any new
training number; the existing selectors (`.bm b`, `.tg-min`, `.chip.data`,
`.ex-prescribed`, `.pwr-bar span` and friends) already map to it. Training
numbers are things you read and compare, and the pixel digits are slower to
read at a glance; game numbers stay pixel because they're part of the game.

### 2.3 Spacing

4px base: `--sp-1` 4px, `--sp-2` 8px, `--sp-3` 12px, `--sp-4` 16px, `--sp-5`
24px, `--sp-6` 32px, `--sp-7` 48px. Side gutter on phones is 16px.

Rhythm tokens (pass 2 spacing audit):

| Token | Value | Use |
|---|---|---|
| `--sp-section` | 32px | between sections of a screen (the `.view` gap) |
| `--sp-group` | 16px | between cards in one group, rows in a list |
| `--sp-panel` | 20px | inside a panel, card, dialogue box |
| `--sp-day` | 40px | between days in the Journal |

Two bordered boxes are never closer than 16px, counting the drop edge.
`node tools/gap-audit.mjs <width>` measures that on every tab. Things that
don't need a frame, like the signed-in row and the Journal's today marker,
don't get one: today is a 2px gold rule above the day plus the `TODAY` tag.

### 2.3b Shell

The app is a fixed grid that fills the screen (`.app`, `position: fixed;
inset: 0`), with rows for the banners, header, the scrolling view and the
tab bar. No `100vh`/`100dvh`: iOS standalone mode measures those differently
from the visible area, which left a gap under the tab bar. The tab bar's
background runs through the home-indicator area, and the page background
below the app is the bar colour, so overscroll never shows a seam.

| Token | Value | Use |
|---|---|---|
| `--tabs-row` | 58px | tab bar content height |
| `--tabs-pb` | `max(6px, safe-area-bottom − 12px)` | tab bar bottom padding |
| `--tabs-h` | row + padding | anything floating above the bar: FAB, toasts, Profile HUD and stage |
| `--fab-size` | 56px | FAB |
| `--gap-float` | 16px | gap between the bar and a floating element |
| `--pg-top-h`, `--pg-hud-h` | 84px, 124px | Profile switcher and HUD heights the stage sits between |

Nothing uses a magic bottom offset any more. `?safe=34` fakes the iPhone
home-indicator inset in a desktop browser.

### 2.4 Border and corners

- `--px: 2px`, one art pixel. Every border is exactly `--px`.
- **Stepped corners**: every framed element (panels, cards, sheets, buttons,
  chips, inputs, toasts) has a one-pixel notch at each corner. It's drawn with
  four zero-blur `box-shadow` layers (offset 4px, spread −2px) instead of
  `border`, which leaves the corner pixel empty, plus a fifth layer for the hard
  drop edge. Three variables drive it: `--b` (border colour), `--e` (edge
  colour) and `--eo` (edge offset; `4px` hides the edge). One shared selector
  in `css/styles.css` applies it, so components only set those variables.
  (The two-step 4px corner from the proposal was dropped: it needed clip-path
  layers on every panel, and the one-step notch already reads as pixel art.)
- `border-radius` is retired everywhere except the circular avatar and the
  status dot.

### 2.5 Shadow (depth)

Hard offsets only, no blur:

| Token | Value | Use |
|---|---|---|
| `--edge-1` | `0 2px 0 0 var(--shade)` | chips, inputs |
| `--edge-2` | `0 4px 0 0 var(--shade)` | buttons at rest, cards |
| `--edge-3` | `0 6px 0 0 var(--shade)` | panels, modals, the tab bar |

### 2.6 Motion

All timings use `steps(n)`. The frame count gives the stepped feel; durations
are short so the app still feels fast.

| Token | Value | Use |
|---|---|---|
| `--t-press` | `80ms steps(2)` | button press / release |
| `--t-ui` | `160ms steps(4)` | toggles, chip state (the active tab cell swaps in one frame, no transition) |
| tab wipe | `240ms steps(4, jump-start)` | View Transition on tab change: the new view wipes in over the old one from the side the tab bar moved toward |
| `--t-enter` | `240ms steps(6)` | modal slide-up, toast enter |
| meter fill | `120ms steps(2)` per segment, staggered 50ms | only segments that are new since the meter was last on screen light up, one at a time; first sight fills from empty |
| number roll | 6 steps × 60ms | XP, levels and goal numbers count from their last shown value to the new one (tabular digits, gold while rolling) |
| loading wave | `1.2s steps(2)` per tile, staggered 150ms | skeleton tiles blink in a wave down the list |
| busy dots | `1s steps(4)` | `...` revealed 0–3 dots after a busy button's label |
| `--t-pop` | `720ms steps(9)` | "+40 XP" pop rise and fade |
| `--t-type` | `28ms` per character | dialogue typewriter reveal |
| `--loop-bob` | `1.2s steps(2) infinite` | idle bob of the cycling character only (the stills no longer bob) |
| `--loop-ambient` | 2.4–40s, `steps(n)` | scene overlays (clouds, glow, shimmer) |

Reduced motion (`settings.reduceMotion` or `prefers-reduced-motion: reduce`):
loops do not run, the typewriter shows the full line at once, the XP bar jumps
to its value, and modals and toasts appear without moving. Implemented once:
`main.js` puts a `body.rm` class on when either is set, and a single CSS block
under `body.rm` zeroes animations. JS effects already check
`prefersReducedMotion()`.

The feel layer lives in `js/app/motion.js`: `withTabTransition()` (feature
detected; never starts under reduced motion), `rollNum()` + `animateIn()` (run
at the end of every `render()`; values are remembered per key for the session,
so nothing animates on a re-render that changed nothing), and `busy(btn, work)`.

**States every tappable has:** pressed (moves down 2–4px and drops its edge;
text links dim), focus (`:focus-visible` 2px outline, white on gold surfaces),
disabled (`--bg-4` fill, muted label, no press, `not-allowed` cursor) and busy
(`aria-busy="true"`, disabled, muted label plus stepped dots). Use `busy()` for
anything that waits on the network.

**Loading:** never a spinner or a "Loading…" line. Render the real component
with `.is-sk` and `.sk-line` / `.sk-tile` blocks where text and images go, so
the layout doesn't move when data lands (Ranks rows land on the exact same
pixels). A visually hidden "Loading…" span carries the state for screen
readers and the container has `aria-busy="true"` until it's filled.

Scene loops also pause when the page is hidden (`visibilitychange`) and are
only in the DOM while the Profile tab is showing.

---

## 3. Components

### Panel (`.px-panel`)
The base surface for cards, modals and sections. `--bg-2` fill, 2px
`--line-soft` border, large stepped corners, `--edge-3`. When the whole panel
is tappable (session card, focus card) the border becomes `--line`, and the
pressed state moves it down 2px and drops the edge to `--edge-1`.

### Coach (the trainer)
Training messages are spoken by one character, "Coach", through dialogue boxes:
the workout sheet, the daily quest panel, the level-up sheet, empty and offline
states, the first-run welcome. His frames are `COACH` in `js/core/scenes.js`
(`portrait`, `blink`, `talk`, `cheer`), all `null` until art lands; until then
he shows as a whistle icon and his name. Lines come from `js/core/coach-lines.js`
(rule-based, no network). In sheets the line types out at 28ms per character
(the full text is in the accessibility tree at once); with `talk` art his mouth
flaps while typing, and with `blink` art he blinks every 3.6s.

### Dialogue box (`.dlg`)
A panel with a `--line` border, an optional 64×64 speaker portrait slot on the
left, a gold speaker name in the display font, and the line itself in the body
font. A gold ▼ in the corner when there is more to read. Used for coach
guidance, toasts, the Home quest panel, empty and offline states (Leaderboards,
Shop), and confirmation sheets. The portrait slot only renders when real art
exists. With no art it collapses and the text takes the full width. It never
shows a stand-in drawing.

### Stat card + level chip
Display-font sport name with its pixel icon; a gold level chip (`LVL 7`) top
right; a **segmented XP bar** (20 segments, gold on `--bg-4`, inside a 2px
`--shade` track) that fills one segment per step; the XP line underneath in the
display font at 16px. The Profile HUD for every sport uses this card.

### Buttons
Every button has a 44px touch target. `.btn.tiny` (36px) and `.icon-btn.tiny`
(32px) keep their size and get the rest from an invisible `::after`.
| Variant | Fill | Border | Text |
|---|---|---|---|
| primary | `--accent` | `--accent` | `--on-accent` |
| secondary | `--bg-3` | `--line` | `--fg` |
| ghost | transparent | `--line-soft` | `--muted` |
| danger | `--bg-3` | `--danger` | `--danger` |

Two states only: **rest** (with `--edge-2`) and **pressed** (shifted down 4px,
no edge, `--t-press`). Disabled: `--bg-4` fill, `--muted` text, no edge.
Minimum tap target 44×44. Labels in the display font, uppercase, 16px. One
primary button per screen or sheet.

### Chips and tags
Small stepped corners, display font 16px. Status tags (`NEXT`, `TAPER`,
`RACE`, `STRAVA`) are outlined; only the level chip is gold-filled. HR-zone
badges (`Z1`–`Z5`) keep their zone hue as text colour on `--bg-4`, no glow.

### Pixel icons (`js/core/icons.js`)
Redrawn on a 16×16 grid as filled rectangles (`fill="currentColor"`,
`shape-rendering="crispEdges"`). Same names, same `svg(name, cls)` API, same
`.ic` class, so no caller changes. Rendered at 16, 24 or 32px only. New names
for the emoji scrub: `gear`, `cloud`, `sound`, `motion`, `download`, `upload`,
`calendar`, `install`, `link`, `sync`, `star`, `xp`, `close`, `chevron`,
`back`, `scroll` (quests), `coach`, `bolt`.

### Tab bar
Pinned to the bottom of the shell (see 2.3b), never floating. A docked panel (no floating pill, no blur) with five equal cells: Home,
Shop, Ranks, Chat, Profile (the Calendar opens from Home). Each cell is a 24px pixel icon over a small body
label. The gold cell is one cursor behind the five cells that slides to the
new tab in four steps; the tab you enter gives its icon a single 2px hop. The
active tab carries `aria-current="page"`.

### FAB
56×56, gold primary button, square with small stepped corners, a 32px display
`+`. Moves up when a toast is showing so the two never overlap.

### Toast
A dialogue box pinned above the tab bar. Enters with `--t-enter`, stays
3.8s, and stacks at most two (newer ones replace the oldest). Several quests
finishing in one sync become one toast. Icon from `svg()`, never an emoji. The
FAB lifts while a toast is up.

### Inputs
`--bg-4` fill, 2px `--line` border, small stepped corners, body font 16px.
Focus: border turns `--accent`. Checkbox: a 20×20 `--shade` square with a
`--line` border; checked fills `--good` and shows the pixel `check` icon.

### Navigation: the layer stack (`js/app/nav.js`)
Tabs are roots; everything that opens over them is a **layer** on one stack:
sheets, full screens, the workout sheet and gym logger, pickers, the bell.
- One way back, four ways in: the header's back/close button, Android or
  browser back (one history entry guards the whole stack), Escape, and the
  **edge swipe**: a drag from the left 24px follows the finger, the screen
  beneath sits 20% behind under a dark scrim and slides in as the layer
  leaves; past 40% or a 0.5 px/ms flick it pops, otherwise it springs back in
  four steps. Reduced motion: no follow, the swipe still pops.
- Focus moves into a new layer (the dialog, never a text field) and returns
  to what opened it; everything beneath is `inert`.
- A chat thread is a **route**: no layer is drawn, but back, Escape and the
  swipe return to the list.
- Swiping on a root tab does nothing; each tab remembers its scroll.

### Sheet and screen header (`js/app/sheet.js`)
One component, one row at `--sh-h` (60px): the way back on the left (an
arrow on a full screen, a cross on a partial sheet), the title, and **at most
one** action on the right. No eyebrow rows above it. A person's header adds
their avatar before the name and their level chip after it, and the action is
an icon button. On full screens the header is sticky and owns the status-bar
band (`--safe-t`), so nothing scrolls under the clock.

### Sheet
Full height (`.fh-screen`) or partial (`.modal`), the same header and the
same entry and exit: in from the right in six steps (`--t-enter`), out to the
right in four, which is also the direction the edge swipe sends it. Full
screens put their gutter on their children, so a card can go full bleed
without a matching negative margin.

### Profile scenes
- **Cycling** keeps its layered world (background, platform, animated
  character).
- **Run, Gym, Swim** fill a full-width stage between the sport switcher and
  the HUD: edge to edge, no side margin, up to 116% of the screen width tall.
  The art keeps its aspect ratio and is centred, so on narrow phones its sides
  crop rather than shrink. Overlays sit in the same box as the art, so they
  stay registered at every width. The screen around it is painted with the image's own edge
  colours: flat for Gym and Swim, and 24 sampled bands for Run, whose sky and
  ground are gradients. The still's outer 4% fades out in four steps so it
  dissolves into that backdrop. Iso-angled stepped covers hide each still's
  baked-in corner label and generator mark.
- **Motion** is CSS only, positioned in % from the manifest: drifting clouds,
  falling leaves and a flickering lap clock (Run), pulsing ceiling light and
  dust in the light (Gym), water shimmer and ripple rings (Swim),. (The 1-pixel idle bob was removed in pass 2: it made
  the stills look unsteady rather than alive.) About a dozen elements per scene, transform and
  opacity only, paused while the page is hidden, removed under reduced motion.
- The "region nudge" experiment (shifting a clipped copy of the athlete) was
  dropped: it broke the track lines and dragged the gym equipment along. The
  evidence is in `docs/redesign/experiments/`.
- **Time of day** (pass 2): the scene follows the athlete's local clock. Dawn
  5–7, day 8–16, dusk 17–19, night 20–4 (`timeOfDay()` in `core/scenes.js`).
  One flat `multiply` layer tints the art and one the screen backdrop; overlays
  sit above it so lamps and stars stay bright. Night adds a dozen twinkling
  stars where the scene has open sky (Run's cloud band, the top of the bike
  world), dims clouds and leaves, and turns lamps and the lap clock up. Indoor
  scenes (Gym, Swim) darken less: their lights are on.
- **Animated athletes** (pass 2): a still may carry `plate` (no athlete) and
  `char` (transparent animated WebP of the athlete, same canvas). Profile then
  draws both; everything else keeps the full `src`. See the art brief.

---

### Week path (Home)
Seven 36px tiles, Monday to Sunday, on a dashed 2px trail. A tile's border
says its state: green verified (with a pennant), line-blue planned, dimmed
missed, borderless rest (moon) or empty. Today's tile is gold-bordered with a
stepping gold marker above it. The next event is a gold gate: on its day when
it's this week, else an eighth column with the days left. The whole card opens
the season path sheet: a vertical dashed trail of weeks with a 10-cell meter
each, a gold gate on the event week. Data comes from `core/path.js`.

### Ranks: podium, rival, movement
The top three stand on blocks (gold 72px, silver 52px, bronze 40px) in 2-1-3
order. Under it, a gold-bordered "Your rival" panel: the athlete directly above
you, the XP gap in the pixel font, and a 16-cell meter of how close you are (at
#1 it's "Your chaser"). Movement since your last visit is a pixel arrow and a
number (green up, red down, `=` same, blue `New`), on your row and on the rival
panel. Data comes from `core/ranks.js`; the last rank is kept per view in
`localStorage`.

### Trophy cabinet (Fitness hub)
Every badge on wooden shelves, four per shelf (4px plank, hard shadow). Earned:
gold glyph on a gold plinth. Locked: a `--shade` silhouette with a 1px
`--line-soft` outline. Tapping one fills the line under the shelves with its
name, state and how to earn it (`aria-live`).

### Trophy board (Profile scene)
A physical object in each sport's diorama, at the scene's `board` hotspot
(`js/core/scenes.js`, % of the art, at least 9% in from the sides because
stills crop on narrow phones). Until its art lands it's a framed pixel board:
gold frame (`--accent`), a trophy glyph and the number of that sport's feats
won. Pressed, it sinks onto its edge (3px, no transition). A light glint
crosses it every 7s in 14 steps (transform only); reduced motion removes it.
When a feat is won, the board of that sport flashes three times in hard steps
(an accent overlay, opacity only) beside the *Feat unlocked* toast; reduced
motion keeps the toast and drops the flash. Your own scene
only; another athlete's embedded scene has no board.

### Trophy case
An instant layer (no slide, like the shop) opened from the board. Sport tabs in
one row of five (Bike, Swim, Run, Gym, Cross). Each feat is a framed card:
- **Won:** gold frame, the trophy in its tier's metal (bronze, silver, gold),
  turned to the season's colourway, the number in `--font-data` at `--fs-d2`,
  the date, the proof tag, and *See the session*.
- **Not yet:** `--line-soft` frame, a silhouette, the exact target and a
  12-cell meter of how close your best has come ("Your best: 21:14 · target
  20:00").

Gym adds the bodyweight field and the check-in line on top.

### Shop and inventory cards (`js/app/shop-ui.js`, `css/shop.css`)
The gear shop and the inventory are a two-column card store on a bottle green
canvas. The tokens are in `css/theme.css`, the styles are scoped to
`.gw-screen.is-shop`, and the design notes are in `docs/SHOP.md`.
- **Header and tabs:** a warm beige header and beige tab plates with painted
  icons. The open tab is seafoam with a mint rim.
  - The shop has five tabs: Stall, Gear, Base, Kit, Fuel.
  - The inventory has three: Fuel, Kit, Gear.
  - Arrow keys, Home and End move along a tab row and open the tab.
- **Card:** a painted plate, two to a row. It is itself the button: a
  transparent hit area covers it, so touching anywhere does what the tray
  says.
  - **Plates:** blue for gear, clothes, base and the stall; seafoam green for
    fuel. The art is in `icons/UI/cards/src/`, fitted by
    `tools/cut-card-art.py`.
  - **Name:** top left, white Franklin Heavy in capitals, outlined in the
    plate's ink, at most two lines.
  - **(i):** top right, the painted square button in the plate's colour. It
    sits above the hit area, so it opens the sheet and never buys.
  - **Picture and counter:** the picture sits on the plate's light. The
    counter (`Storage 1/3`, `Tier 2/3`, build points, fragments, a size) is
    bottom right of the picture.
- **Tray:** the plate's dark bar says what a touch does:
  - **Price:** white, with the coin (gear, clothes, base) or carbs (fuel).
  - **Can't afford:** the price turns red `#D9443B`. A touch shakes the card
    and buys nothing. The shortfall is never printed; a screen reader hears
    "not enough coins yet".
  - **Full, yours or locked:** the whole card goes grey (`filter:
    grayscale(1)`), touches pass through it, and the tray says `MAX`, *Owned*,
    *Built* or *Locked*. The (i) still works.
  - **Wear, Use, Aim, Build:** the word in capitals. *Wearing* and *Build* are
    gold.
  - **In the workshop, fitted, or fuel that can't go on yet:** the card keeps
    its colour but doesn't act; the tray shows the countdown, *Fitted*, or a
    word on why (*Fuel on*, *Week's limit*).
- **The (i) sheet:** the picture on the plate's colour, the facts as
  label/value rows, the story, a note, and the card's tap again as a button
  (the price in the card's tray colours). Long labels (a feat's name) stack above
  their text. Closing the sheet returns focus to the card's `(i)`, even after
  a purchase redraws the grid.
- **Currency bar:** the open tab's currency is pinned to the bottom, carbs on
  Fuel and coins elsewhere, as a filling track with the amount and the cap.
- **Motion:** a pressed card shrinks to 97%, a just-bought card's picture
  pops once, and an unaffordable one shakes. Reduced motion (the OS setting or
  `body.rm`) turns all three off.

### Challenge card (Room and Challenges)### Challenge card (Room and Challenges)
A challenge travels as a card, never as a plain message. In the Room it's a
card row (`rm-card`) posted by the server, not the sender: the sport glyph, the
rule in one line ("Most riding km, Tue 20 Oct – Mon 26 Oct"), the stake as a
coin chip in `--font-data`, who's in, and one action (*Join*, *See it*). A
settled card shows the winner and the payout instead. Cards obey the room's
caps (3 a day each, 6 open in the room).

The challenge layer (slides like any layer) shows *When*, *Stake*, *Pot* and
*Who's in* as a 2×2 grid, then standings: place in the accent colour, name,
score right-aligned in `--font-data`. A score held by a ceiling carries a small
*ceiling reached* tag; nobody with no session has a place. *How it works* is a
closed disclosure under it.

Joining a staked challenge is never one tap: a sheet spells out the stake, the
fee, the payout split and the refund rules, and *Join* stays disabled until
*I'm sure* is ticked. A stake the server would refuse is said before the sheet,
in words, not as a disabled button. Coins never show a money symbol.

When a challenge you're in settles, one toast says it: where you finished and
what came back ("Settled: you finished 2 of 4 and won 68 coins"), or that a
void or a cancellation returned your stake. A win also plays the accept sound
and haptic. Each result is said once per device.

Toasts sit above layers (`.toast-wrap` z-index 10200, over `.modal-root`
10000), so anything said while a layer is open is seen.

### Workshop card (Gear shop)
A beige panel under the cards on the shop's Gear and Base tabs whenever
something is in the workshop. One row per bay:
- the bay number set vertically;
- the item's tile;
- its name, a countdown in `--font-data`, and a stepped progress bar (24 hard steps, no smooth fill);
- *Finish with a gel* (gold) and *Cancel* (outlined) underneath.

Cancelling mid-fit asks first and says what comes back; removing a queued job
doesn't ask, because it's free. The waiting queue lists under the bays with
*Remove*, and today's finished jobs with a check. Countdowns follow the server's
clock and are not announced to screen readers every second.

### Scene props and the quadrant plate (Profile scene)
Props are drawn into the diorama, never as UI: no frame, no hover, not
tappable. Floodlights carry a stepped pool of warm light at dusk and night
only. The quadrant plate ("VELODROME LV 3") sits between the inventory and shop
buttons; it opens the shop's Base tab. A finished job puts a gold count on the
shop button until the shop is opened.

### Telemetry charts (Fitness hub)
Lines are stepped (hold, then jump) on a 2px grid; markers are 4px squares (8px
for the latest); bars are blocks with a 2px gap; bands are dashed outlines with
a 14% fill. Every plot has dashed quarter gridlines and `+` ticks at its
corners. The calendar is 16px square tiles on a 4px gap. All in our palette;
the plot labels stay in the pixel font, the totals in the data font.

### Scene strip (Today's target)
An 88px letterbox crop of the sport's scene at your current level, across the
top of the focus card, centred on the athlete (`--fy` per sport), with a gold
level chip bottom-right and a 2px `--shade` rule under it.

### Share card
Canvas, 1080×1350 (post) and 1080×1920 (story), smoothing off. Top: the MOSKE
wordmark and a gold level chip. Middle: the scene at a whole-number scale (2×),
cropped around the athlete, with the corner covers drawn. Bottom: a framed
panel with the sport, date, title (system font), minutes and km (data font) and
`+XP` (pixel font). Shared as files through the Web Share API; downloads where
that isn't available. Only verified sessions get the button.

### Loading, empty and error
Loading is never a spinner or a lone "Loading…": draw the real component with
`.is-sk` and `.sk-line` / `.sk-tile` blocks, sized so the real content lands on
the same pixels. Empty and error states are a dialogue box from whoever owns the
screen (the Coach for training, Ranks for the leaderboard, Shop for the shop)
saying what happened and what to do next.

---

### Gold
Gold fill means **act here** (the one primary button, the FAB, the active tab
cursor, an invitation like Accept) or **you earned this on its own stage** (the
level chip on the Profile scene, the #1 podium block, XP fill, the XP chip
that lands at the end of a session). A level, a count or a tag shown as
status is quiet: `--bg-3` with gold digits, or an outline. One gold element
competes for the eye per screen. `tools/gap-audit.mjs` counts gold fills above
the fold on every tab.

### Motion vocabulary
Stepped, `transform`/`opacity`/`clip-path` only, off under reduced motion
(the end state shows at once). Each moment answers "what does this tell
you?" and no screen has more than two things moving on its own.
| Moment | Motion | Tells you |
|---|---|---|
| Layer in / out | from/to the right, 6 / 4 steps | where back is |
| Edge swipe | follows the finger; beneath at 20% under a scrim | you're going back |
| Shared element | avatar, level, exercise picture or session title travels into the new header, 6 steps (View Transitions) | it's the same thing, closer |
| Tab change | view wipes 4 steps; gold cursor slides 4 steps; icon hops 2px | which way you moved |
| Set ticked | row fills gold in 4 steps; "+1 set" chip flies to Finish | it counted |
| Rest | ring of 12 pixel blocks drains; last 3 s pulse gold; next set blinks on twice at zero | when to lift |
| Finish | sets, volume, time step in; the XP chip lands last | what the session earned |
| Record | plaque drops, two-frame squash, dust puff, settles into the set; once per record | a new best |
| Level up | old scene parts on a stepped curtain, new art behind, number rolls; the scene's own motion waits | you moved up |
| Pull to refresh | sprite winds one notch per step, meter fills; spins while loading | how far to pull |
Haptics (`js/app/haptics.js`): named patterns (tick, restOver, record,
levelUp, request, message). Android only: iOS has no Vibration API.

## 4. Layout and responsive rules

- **One column, three widths.** Everything is checked at 320, 390 and 430px.
  No horizontal scroll at 320: grid tracks that hold text are
  `minmax(0, 1fr)`, never `auto` or bare `1fr`.
- **Spacing is tokens.** 32px between sections, 16px within a group, 20px
  inside panels, 40px between Journal days. No two framed boxes closer than
  16px (`node tools/gap-audit.mjs <width>`).
- **The shell is a fixed grid** (§2.3b). Nothing floats on a magic number;
  floating things use `--tabs-h`.
- **Touch targets are 44px.** Small buttons get the rest from an invisible
  `::after`.
- **Bars and grids squeeze, they don't wrap.** The week path keeps seven tiles
  at 320px (36px max, shrinking); the calendar's two months sit side by side
  when they fit and stack when they don't.

---

## 5. Do and don't

**Do**
- Use `--px` multiples for every border, offset and icon size.
- Put long text in the body font inside a dialogue box.
- Use a discipline colour to say which sport, and gold to say what to do.
- Let the scene art fill the Profile screen. The HUD panel sits on top of it.
- Check every new colour pair for 4.5:1 (text) or 3:1 (borders and icons).

**Don't**
- Don't use `border-radius` on new UI (only the avatar and status dot).
- Don't use blurred shadows, glows, gradients or `backdrop-filter`.
- Don't use emoji in the UI. Use `svg()` icons (`.ics` export text is exempt).
- Don't set the pixel font below 16px or at sizes that aren't multiples of 8.
- Don't use bold Silkscreen for digits.
- Don't scale pixel art by non-integer factors where it can be avoided. Always
  set `image-rendering: pixelated`.
- Don't draw characters in CSS or SVG, and don't ship stand-in art that looks
  final. If art is missing, the slot collapses.
- Don't animate anything without a `steps()` timing and a reduced-motion
  off-switch.
- Don't take image A's characters, artwork, purple palette or copy. Only its
  interface language.
- Don't ship a spinner or a text-only "Loading…" state; draw the skeleton.
- Don't let the Coach speak for non-training screens (Ranks, Shop).
- Don't use pure black. The darkest colour is `--shade` (`#050912`).
- Don't write AI-brochure copy ("elevate", "seamless", "unleash"). Short,
  plain, second person.
