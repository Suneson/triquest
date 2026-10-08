# Interface review of the changed files

The `web-design-guidelines` skill isn't installed in the session that built
this, so the same checklist was run by hand over every changed file
(`css/styles.css`, `index.html`, `js/app/*.js`, `js/core/icons.js`), plus
browser checks at 320, 390 and 430 px wide.

## Fixed during the review

| Area | Finding | Fix |
|---|---|---|
| Keyboard | Session cards, Today's target, Tomorrow, leaderboard rows and activity rows were click-only `<article>`/`<li>`/`<div>` elements | `role="button" tabindex="0"`, plus one Enter/Space handler in `main.js` |
| Screen readers | The typewriter changed a line's text letter by letter | The full line sits in a visually hidden span; the typing is `aria-hidden` |
| Screen readers | Quest state was only a green box | Visually hidden "(done)" in the row text; the box is `aria-hidden` |
| Screen readers | Tabs relied on `aria-label`; no "current page" | Visible labels, `aria-current="page"` on the active tab |
| Layout | Journal overflowed horizontally on a 320px phone (a grid track sized to a long nowrap title) | `grid-template-columns: minmax(0, 1fr)` on day rows and sheet bodies; metrics wrap |
| Layout | Settings Export / Import / Calendar labels clipped | Shorter labels with icons; the row wraps |
| Layout | The FAB covered Journal's "TODAY" tag | Journal opens scrolled to today; the tag sits next to the date; the FAB lifts above toasts |
| Motion | Several animations ignored the in-app Reduce motion setting | One `body.rm` switch (set from the setting or the OS preference) turns every animation and transition off; scene overlays are removed |
| Motion | Scene loops kept running in a background tab | Paused on `visibilitychange` |
| Contrast | Indigo buttons and neon zone glows on charcoal | Every text pair ≥ 4.5:1 and every interactive border ≥ 3:1 (table in DESIGN.md §2.1) |
| Forms | Inputs below 16px made iOS zoom on focus | All inputs 16px |
| Emoji | Emoji used as icons in buttons, toasts, headings, badges | Pixel `svg()` icons everywhere in the UI |

## Checked and fine

- `lang="en"`, the viewport allows zoom, safe-area insets respected (header,
  tab bar, sheets, Profile HUD).
- Every icon-only button has an `aria-label`; decorative SVGs and scene
  overlays are `aria-hidden`.
- Meters are `role="img"` with a percentage label.
- Toasts live in an `aria-live="polite"` region with `role="status"`.
- The quest countdown updates once every 30 seconds and isn't a live region.
- Focus is visible on every control (2px gold outline; inputs turn their
  border gold).
- Tap targets are 44px or more, except `btn tiny` (36px) used for secondary
  actions in dense sheets, which is still above the 24px WCAG 2.2 minimum.
- No horizontal scroll on any tab at 320, 390 or 430 px.
- Works offline: the service worker precaches all 41 assets including the
  fonts, and an offline reload renders Home in the pixel font.

## Known and left as-is

- Leaderboard and Shop can't be exercised in the build sandbox (no network to
  Supabase or Shopify); their loading, empty and error states were checked,
  not live data.
- The Fitness hub charts keep smooth lines and areas. Redrawing them as pixel
  charts would be a separate piece of work.
- The `.ics` export still writes discipline emoji into calendar titles (a
  downloaded file, not the UI).

## Pass 2, Phase A (web-design-guidelines skill, fetched live)

The skill ran over every file changed in Phase A, plus browser checks in
playwright-cli (Chromium with the iPhone 15 profile; WebKit isn't installed in
the sandbox) at 320, 390 and 430 px. Screens are in `after/phase-a/`, a clip of
tab and stage switching in `clips/phase-a-shell.webm`.

| Area | Finding | Fix |
|---|---|---|
| Touch | `.btn.tiny` (36px) and `.icon-btn.tiny` (32px) under 44px | Invisible `::after` grows the hit area to 44px, look unchanged (measured: a tap 3px above the Edit button lands on it) |
| Images | Profile still had no `width`/`height` | Sized from the manifest, `fetchpriority="high"` (it's the screen's main image) |
| Overscroll | Sheet bodies chained scroll into the page | `overscroll-behavior: contain` on `.modal-body` |
| Layout | Tab bar left a gap on iPhone PWA | Fixed grid shell, bar through the safe area; with `?safe=34` the bar ends at the viewport's bottom pixel |

Checked and fine: no `transition: all`; every `outline: none` has a
replacement (inputs turn their border gold; tabs use `:focus-visible`); icon
buttons have `aria-label`; toasts are `aria-live="polite"`; `color-scheme:
dark` and `theme-color` set; zoom not blocked; reduced motion kills every
animation.

Left as is: images inside fixed-ratio boxes (level cards, lightbox, level-up)
have no `width`/`height`, but the box already reserves the space, so there's
no layout shift.

## Pass 2, Phase B (feel)

Dials from design-taste-frontend: variance 3, motion 6, density 3. Taken from
it: full state cycles (loading shaped like the result, tactile press, busy),
transform/opacity/clip-path only, every motion gated on reduced motion.
Ignored: its rounded/blurred defaults and its eased "fluid" curves (we step).

| Check | Result |
|---|---|
| Tab wipe runs | `startViewTransition` fires once per tab change in Chromium; skipped when unsupported or under reduced motion |
| Tab bar mid-wipe | Was ghosting two gold cells: the tab's own 160ms colour transition, caught halfway. Tabs now swap in one frame |
| Wipe overprint | New view snapshot was transparent and printed over the old one. `.view` has its own background now |
| Number roll | Verifying a session rolled Plan `0 → 1` with `.rolling` on, then settled |
| Meter fill | First sight lights segments one by one; a re-render with no change lights none |
| Skeleton jump | Ranks skeleton rows sit at y = 428 / 530 / 632, same as the real rows. Shop skeleton has two title lines to match most product titles |
| Busy | `aria-busy` + disabled during the request, both cleared after; dots step 0→3 without moving the label |

Clips: `clips/phase-b-tab-wipe.webm`, `clips/phase-b-roll-and-fill.webm`,
`clips/phase-b-busy-and-loading.webm`. Screens: `after/phase-b/`.

## Pass 2, Phase C (game layer)

Checked in playwright-cli (Chromium, iPhone 15 profile) at 320, 390 and 430 px;
screens in `after/phase-c/`, clips in `clips/phase-c-*.webm`.

| Area | Finding | Fix |
|---|---|---|
| Week path | At 320px the card was 37px too wide: its grid track sized to the event label | `grid-template-columns: minmax(0, 1fr)`; tiles `calc(100% - 4px)` |
| Race banner (older) | Flex split "Next event: Half Ironman — Sun 1 Nov" into three columns at 320px | One text span inside the flex row |
| Scenes at dawn/dusk | A coloured line along the stage's top and bottom: the stage bands and the art's faded edge were both tinted | Tint only via the art layer (it spans the stage) and the screen backdrop |
| Scene strip | Bike rider missing: `inset: auto` after `left/top` reset them. Gym crop above the lifter | Order fixed; per-sport `--fy` focus |
| Scene strip | Container and image shared the class `fs-still`, so the strip collapsed to 0px | Container uses `is-still` / `is-layered` |
| Ranks skeleton | After the podium landed, the old row skeleton no longer matched | Skeleton draws podium (with trophy), rival (two-line gap text) and rows; lands on the same pixels (477 / 718 / 882) |
| Fitness calendar | Square tiles at `1fr` grew to 40px and stacked the months | 16px tiles on a 4px gap; months side by side at 390, stacked at 320 |
| Share card | Feed post drew the scene at 1× (2× didn't fit); the generator sparkle showed; the date overlapped the numbers | Whole-number 2× with a crop around the athlete; corner covers drawn on canvas; date moved into the label line |
| Share sheet | Download links styled as buttons were underlined and wrapped | `a.btn { text-decoration: none; white-space: nowrap; }` |

Guidelines pass (web-design-guidelines) over `game.js`, `share.js`,
`leaderboard.js`, `profile-game.js`, `ui.js`, `motion.js`: no `transition: all`,
no unlabeled icon buttons, every `role="button"` is focusable, all new loops
stop under reduced motion. Images without `width`/`height` all sit in fixed-size
boxes (avatars, the layered world, the strip), so there's no layout shift.
Gap audit: all framed boxes ≥ 16px apart at 320, 390 and 430.

Not verifiable here: Web Share with files (desktop Chromium can't share files,
so the sheet shows Save; on iPhone it shows Share), and WebKit rendering.
