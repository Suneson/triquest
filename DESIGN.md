# MOSKE design system: pixel skin

Status: **implemented** on `redesign/pixel-gamify` (all four phases). The tokens
live in `css/styles.css`; the original proposal specimen is
`docs/redesign/specimen.html`, and the before/after screens are in
`docs/redesign/before/` and `docs/redesign/after/`.

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

### 2.3 Spacing

4px base: `--sp-1` 4px, `--sp-2` 8px, `--sp-3` 12px, `--sp-4` 16px, `--sp-5`
24px, `--sp-6` 32px, `--sp-7` 48px. Side gutter on phones is 16px (today it is
18px; 16 is a whole multiple of the pixel grid).

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
| `--t-ui` | `160ms steps(4)` | tab switch, toggles, chip state |
| `--t-enter` | `240ms steps(6)` | modal slide-up, toast enter |
| meter fill | `160ms steps(2)` per segment, staggered 40ms | XP and goal meters fill left to right |
| `--t-pop` | `720ms steps(9)` | "+40 XP" pop rise and fade |
| `--t-type` | `28ms` per character | dialogue typewriter reveal |
| `--loop-bob` | `1.2s steps(2) infinite` | idle bob of the profile stage (1 art pixel) |
| `--loop-ambient` | 2.4–40s, `steps(n)` | scene overlays (clouds, glow, shimmer) |

Reduced motion (`settings.reduceMotion` or `prefers-reduced-motion: reduce`):
loops do not run, the typewriter shows the full line at once, the XP bar jumps
to its value, and modals and toasts appear without moving. Implemented once:
`main.js` puts a `body.rm` class on when either is set, and a single CSS block
under `body.rm` zeroes animations. JS effects already check
`prefersReducedMotion()`.

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
A docked panel (no floating pill, no blur) with five equal cells: Home,
Journal, Ranks, Shop, Profile. Each cell is a 24px pixel icon over a small body
label. The active cell is a gold fill with `--on-accent` icon and label, and
carries `aria-current="page"`.

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

### Modal sheet
Slides up from the bottom (`--t-enter`). Panel with large stepped top corners,
title in the display font at 24px, close button as a secondary icon button
with the pixel `close` icon.

### Profile scenes
- **Cycling** keeps its layered world (background, platform, animated
  character).
- **Run, Gym, Swim** frame a single still on a stage between the sport switcher
  and the HUD. The screen around it is painted with the image's own edge
  colours: flat for Gym and Swim, and 24 sampled bands for Run, whose sky and
  ground are gradients. The still's outer 4% fades out in four steps so it
  dissolves into that backdrop. Iso-angled stepped covers hide each still's
  baked-in corner label and generator mark.
- **Motion** is CSS only, positioned in % from the manifest: drifting clouds,
  falling leaves and a flickering lap clock (Run), pulsing ceiling light and
  dust in the light (Gym), water shimmer and ripple rings (Swim), and a 1-pixel
  idle bob on every still. About a dozen elements per scene, transform and
  opacity only, paused while the page is hidden, removed under reduced motion.
- The "region nudge" experiment (shifting a clipped copy of the athlete) was
  dropped: it broke the track lines and dragged the gym equipment along. The
  evidence is in `docs/redesign/experiments/`.

---

## 4. Do and don't

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
