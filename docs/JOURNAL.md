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
- **The tray:** a chunky (80 px) slate tray floating on a bottle-green strip, rounded all round, with a milled top lip and recessed grooves between its segments.
  - The strip, and the page behind everything, is bottle green on every tab. So the strip iPhone can leave under the page (it paints that strip with the page's colour, over anything drawn there) is the same green.
  - The tray floats just above the screen's bottom edge.
- **Tab changes:** a carousel (`motion.js`). A still copy of the old view slides out one side while the new one slides in from the other, the way along the dock you moved.
- **Swipe between tabs** (`js/app/tab-swipe.js`):
  - A sideways drag in the middle of the screen takes the tab with your finger, and the next tab's card (its icon and name) comes in beside it.
  - Let go past a third of the screen, or flick, and it carries on into the tab change. Otherwise it springs back.
  - It leaves alone: vertical scrolls, anything open, the left edge (back), inputs, sideways scrollers, and HOME's stage. On the stage a drag still moves the camera, so on HOME swipe from the room buttons or the HUD.
- **Inactive tabs:** only the 3D icon, 46 px. Their label stays readable to screen readers.
- **The active tab:**
  - the whole segment becomes the house's baby-blue button (the shop's open-tab plate);
  - its icon grows to 56 px and pops up over the button's top edge;
  - its label shows underneath.
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

## Chat in the same look (`css/chat.css`)

The Chat tab is bottle green too, scoped to `body.chat-mode`, and takes its colours from the dock's chat icon.
- **Messages:** other people's are beige bubbles and yours are MOSKE blue.
- **General | Direct | Club:** the shop's tab plates, beige with baby blue for the one you're on, pinned to the top while the conversation scrolls. Each has its 3D icon:
  - General: a globe with a speech bubble (`icons/UI/chat/chat-general.webp`);
  - Direct: the dock's chat bubbles;
  - Club: a wooden-framed shield with the MOSKE bird (`chat-club.webp`).
- **Conversations and friend requests:** beige rows.
- **A challenge posted in General:** a beige quest card with a gold rim (blue while it's running).
- **The composer:** a beige well with the Journal's button as Send.

## The base's round buttons (`diorama-view.js` `orb`, `css/styles.css` `.dg-orb`)

| Where | Buttons | Ring |
| --- | --- | --- |
| A row under the name and the gauges | Shop, kit bag | Gold |
| The same row | Next up (the target), this room's trophies (with the count) | Navy |
| Up the right side, about mid-screen | The elevator: pool, run, bike, gym, locker room | Baby blue |

- **The look:** like the buttons round a game's home screen. Each is a glossy ring (`icons/UI/side/ring-gold|navy|sky.webp`, keyed off green) over a face of its own colour, a shade darker, in a gradient. The 3D icon fills the face: its lower half sits inside the rim, its top rises out past it.
- **The floor you're on:** its ring is a touch bigger and its face lights up. Its icon grows and pops further out over the rim.
- **The trophies** moved here from the chip next to the room's name.
- **The art:** the trophy and the target come from `tools/gen-shop-ui.mjs` (`side-*`). They're cut by `python3 tools/cut-shop-ui.py icons/UI/side/src`. The rings were made by hand, on green.

## Colours: what's open or "go" is baby blue

What's selected (a tab, a day, a room button, a switch) and the main action (Start workout, Send, Calendar) use the baby blue of the shop's gear cards. The tokens are in `theme.css`:
- `--act-grad`: the fill;
- `--act-rim`: the lit top edge;
- `--act-edge`: the pressed-in bottom edge;
- `--act-ink`: outlined white type on it.

They replace the seafoam green. The Run sport tag keeps its own colour.

## The backdrop and the framed panels (`css/backdrop.css`)

- **The backdrop:** the Journal and Chat sit on quilted baby-blue leather (`icons/UI/bg/quilt.webp`, from `quilt-src.jpg`). It's held still behind the scrolling view, and the header and Chat's pinned bars are frosted over it.
- **The frame** round the Journal's panels: `icons/UI/frames/frame-panel.webp`.
  - It's a glossy baby-blue rim from Gemini (`frame-panel` in `tools/gen-shop-ui.mjs`), cut by `cut-shop-ui.py` and drawn as a 9-slice border image.
  - Panels wear it round two fills: the reward card's blue (This week, Daily quests, the plan offer) or the house beige (the day's session, Tomorrow).
- **Depth:** everything on the backdrop has deep, soft shadows (`--deep` for panels, `--lift` for buttons), so it sits forward and the backdrop reads as far away.
- **Dock icons:** the Shop and Home icons are now the modern renders `icons/UI/ref/modern-shop.jpg` and `modern-building.jpg`. Those two images are also the style references for all new art (docs/ART-DIRECTION.md).
