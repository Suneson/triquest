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
