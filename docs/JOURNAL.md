# The dock and the Journal

## The dock (`index.html` `.tabs`, `css/styles.css`)

The tab bar is one tray across the bottom of the screen. Its five segments, from left to right:

| Tab | View key | What |
| --- | --- | --- |
| Journal | `home` | The training plan (below). The calendar (`journal`) opens from it, so it stays lit there too. |
| Shop | `shop` | The merch shop. |
| **Home** | `progress` | The base: the compound with the 3D runner. The app opens here until you pick another tab. |
| Chat | `chat` | |
| Ranks | `leaderboards` | |

- **View keys:** they're unchanged from before the dock. Saved tabs, deep links and the tab-change animation keep working.
- **The tray:** a slate gradient (`#223243` to `#15222E`), a milled top lip (`#3B4E63`) with an inner highlight, and rounded top corners. Recessed grooves divide the segments.
- **Inactive tabs:** only the 3D icon, 32 px. Their label stays readable to screen readers.
- **The active tab:**
  - its icon grows to 40 px and pops 8 px up out of the dock;
  - its label shows underneath;
  - a seafoam glow rises from the bottom of its segment.
- **Feedback:** tapping a tab gives its icon a small hop. A press squeezes the icon (scale .92).
- **Icons:** `icons/UI/nav/nav-*.webp`, cut from the green-screen renders in `icons/UI/nav/src/` by `python3 tools/cut-shop-ui.py icons/UI/nav/src`.

## The Journal (`renderHome` in `js/app/ui.js`, `css/journal.css`)

Bottle green, like the shop. From the top:

1. **The date header and Calendar**, as before.
2. **The week:** seven beige day tokens, Monday to Sunday.
   - The day you're looking at is seafoam and raised; today has a seafoam rim.
   - A day with a finished session wears a green check; a planned day has a dot.
   - Tap a day to see its session. Coming back to the tab returns to today.
3. **The day's session:** a beige quest card.
   - It shows a sport tag (cycling `#0C4CAE`, run `#39A672`, gym `#F2C14E`, swim `#4EA8DE`), the title and minutes, the targets (time, distance, heart-rate zone, kcal) and the target pace.
   - **Start workout** opens the session sheet; for gym sessions that sheet holds the logger. A finished session reads *View session*.
   - A rest day offers *Add a session*.
4. **This week:** the week's sessions against the goal, on a deep-forest track with a seafoam-to-mint fill. It also has one line on what to do next, *Edit goals* and the *Season path*.
5. **Then, as before:**
   - the waiting chests card;
   - the daily quests;
   - tomorrow's glance (only while you're looking at today);
   - the coach's plan offer.

The week path card and the old one-line week summary are gone: the day strip and the progress panel replace them.

## The runner between tabs

The base's DOM is kept aside while another tab is showing (`diorama-view.js`), and the 3D runner only pauses. Coming back to Home carries on mid-stride, with no reload and no new WebGL context. The runner is freed only when its treadmill leaves the room. See `docs/RUNNER3D.md`.
