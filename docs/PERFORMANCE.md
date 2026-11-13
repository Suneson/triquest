# Performance

How the base is kept smooth, what was measured, and what makes the app lag and crash on iPhone.

## Rules

- **One screen update per frame.** Panning and zooming change the view at once, but the world's transform is written once a frame (`paint` in `js/app/diorama-view.js`). A phone sends up to 120 touch events a second.
- **Never read layout while moving.** The viewport's box is measured once, and again only on resize or when a touch starts. The room picture's on-screen width is worked out from numbers already known.
- **Inherited CSS values only when they change.** `--inv` (the labels' counter-scale) is set only when the zoom changes, not on every pan, because every label under it recalculates its style.
- **One redraw for many saves.** A data change asks for a redraw; changes in the same moment share it (`main.js`, `queueMicrotask`). Saving a drill used to redraw twice; three saves now redraw once.
- **Moving things move by transform.** The walking athlete moves with `transform`, not `left` and `top`, so no layout runs while it walks. The same goes for looping animations: never animate `left`, `width` or `background-position` forever.
- **Nothing under a full screen is drawn.** The base is hidden while a full screen covers it (`body.base-covered`), its loops pause, and its 3D views stop.
- **A 3D screen lets go of its models when it closes** (`forgetGltf` in `js/app/char3d.js`), unless the base still shows them.

## Measured on 2026-11-11 (demo, run room, 390 × 760, desktop Chrome; a phone is about 4 to 6 times slower)

| | Before | After |
|---|---|---|
| Redraws for 3 saves at once | 3 | 1 |
| One redraw of the base | about 10 ms | about 10 ms (but fewer of them) |
| Frames over 33 ms in a pan and zoom test | 4 | 2 |
| Idle on the base | 60 fps, no redraws | same |
| Pictures in memory, decoded | about 121 MB | same |

## The lag and crash audit, 2026-11-13 (demo, 375 × 812, the island)

### Why it crashes rather than just lags

A home-screen app on iPhone runs in one WebKit process with a memory limit. When the app goes over it, iOS kills the process, and you see the app reload or close: that is the "crash". JavaScript itself is light here (12 MB of script memory, no long tasks while idle). The heavy parts are **pictures held in memory**, **3D on the GPU**, and **things that redraw all the time**. These add up as you move between screens.

### What was measured

| What | Size | Why it matters |
|---|---|---|
| Pictures decoded on the island at launch | **51 pictures, ~115 MB** | A picture takes width × height × 4 bytes in memory, whatever its file size. The island's base picture (2690 × 1495) is 15 MB; the six ground tiles are 5.4 MB each; each building is 4–5 MB. |
| The island layer | **12,963 × 7,235 px**, one layer, scaled to ~0.26 | Panning and zooming composite one huge layer full of big pictures. |
| CSS drop-shadows | **50**, six on the 1,300 px market pictures in the island | A shadow filter on a big picture is drawn off screen at full size whenever it repaints (zooming). |
| The city's 3D sign and truck (`city3d.js`) | **one full-screen 3D canvas** (563 × 1218 px here, more on a 3× phone) | The whole screen's 3D is redrawn to tick the sign's clock once a second, and on every frame while you pan or the truck drives. |
| How 3D reaches the page (since PR 79) | rendered off screen, then **copied** into each view's canvas (`gl-shared.js`) | On iPhone the copy goes from the GPU back to the CPU: megabytes per frame for a full-screen view. |
| 3D models opened in a session | **kept on the GPU until the app closes** | Every character, outfit, boss or robot you've seen stays loaded. The stadium left 4 textures and 4 geometries behind. |
| Script files at launch | **148 files, 2.3 MB** | Includes three.js (675 KB), both languages (243 KB, one is used), and screens you may not open (gym logger, onboarding, chat, challenges, wardrobe, chests). |
| App updates | **every deploy emptied the picture and model cache** | After each update the phone downloaded every picture and model again as you used them: slow screens and pictures popping in. |
| Looping animations on the island | **20** | Most only move things (cheap). The stamina shine relaid out and repainted the page every frame, forever. |
| The island under full screens | **still painted and composited** | The markets, the shop and the stadium cover it completely. |

### Fixed in PR 84 (sw v141)

1. **The island isn't painted under a full screen** (it's hidden; its loops were already paused).
2. **Pictures and models keep their cache across updates** (`triquest-assets` in `sw.js`). Each one is checked with the server in the background once per launch. Changed art shows from the next launch, so new art can take two opens to appear.
3. **The stadium frees its boss and robot** when you close it. On a test run, geometries went 3 → 7 → 3 and textures 7 → 13 → 9. It also draws at most 1.5× sharp now that it fills the screen.
4. **The shared 3D canvas shrinks back** when a big 3D view closes.
5. **The stamina shine** moves by transform.

The markets and the stadium already loaded their code, pictures and models only when tapped, so they weren't the problem.

### Fixed in sw v142: the sign and the truck are 2D

The city's sign and truck were a 3D canvas the size of the screen, redrawn every second for the clock and every frame while panning. They're now pictures in the world (`js/app/city2d.js`), drawn once from the same 3D models by the city's camera (`tools/bake-street.js`; 39 KB for all three).
- **The sign:** a picture, with the countdown as ordinary text skewed onto its panel. Only the text changes each second.
- **The truck:** one picture for each way it faces on its road. It moves by transform, and only while it drives. Driving, the mall and the market still cover it.
- **What's gone:** the full-screen canvas, its copy from the GPU every second and every pan frame, and the 3D models' memory on the base. Panning moves the sign and the truck with the island at no extra cost.
- **What's left:** the island's one always-present 3D view is the athlete.

### Fixed in sw v143: lighter pictures on the base

A closer look changed the plan for item 2. The island's buildings and ground are already stored *smaller* than they're drawn: a building is 1,291 px wide and drawn 2,152 world px wide, a ground tile 1,376 px for 3,242. At the normal zoom on a 3× iPhone (0.27 × 3 = 0.8 screen px per world px), half-size copies would be visibly blurry. So they stay as they are, and two other changes save memory without losing sharpness:
- **Room copies of the item pictures.** An item in a room is drawn at most about 200 world px wide, and the base zooms in to about 2 screen px per world px. So 384 px on the longer side is as sharp as an item is ever shown. The originals are 500–1,000 px, because the shop and the sheets show them big. `tools/make-room-items.py` writes the 79 copies to `icons/room-items/` and lists them in `js/core/room-art.js`. Decoded, all item pictures go from 123 MB to 35 MB, and each item on the base from about 1.8 MB to 0.4 MB.
- **Pictures far off the screen aren't drawn** (`cull` in `js/app/diorama-view.js`). Ground tiles, the tower and the island's plots more than half a screen outside the view get `display: none`, so they aren't painted and the browser can let their decoded pixels go. In the demo:

| View | Pictures drawn | Not drawn |
|---|---|---|
| The normal view | 16 of 24 | the sea edges, the hall and the arena |
| Zoomed into a room | 3 of 24 | 21 |
| Zoomed all the way out | 24 of 24 | none |

At every zoom tested, no picture that's on screen was culled.

### Next, most effective first

1. ~~**Make the city's 3D sign and truck 2D.**~~ Done (above).
2. **Lighter island pictures.** The item copies and culling are done (above). What's left:
   - **The base picture** (2,690 px wide, drawn 2,152 wide; 15 MB). Use a smaller copy when zoomed out and the full one when zoomed in, the way the big rooms already do (`midArt`).
   - ~~**Bake the shadows** into the market pictures.~~ Done (sw v145).
     - `tools/bake-market-shadows.py` draws the same shadow, `drop-shadow(0 10px 8px rgba(10, 30, 20, .25))` scaled to the picture, into padded copies in `icons/Market/island/` (548 KB for all eight).
     - The island takes the padding back off when it places them (`SHADOW_PAD` in `js/app/island-view.js`), so each market stands where it did, to within 0.1 px.
     - The island's markets now have no filter. The market screen still uses the plain pictures.
3. **Draw 3D straight into the page when only one view shows.** One shared renderer is right (iPhone allows only a few WebGL contexts), but the copy into each view is costly. When a single 3D view is on screen (the stadium, the wardrobe, the run room), it can be drawn directly instead. This is a careful change: test it on an iPhone before merging.
4. ~~**Let go of 3D models when their screen closes.**~~ Done for the stadium (sw v141) and the wardrobe (sw v144).
   - `js/app/char3d.js` counts how many figures use each model file, from the moment one starts loading it.
   - When the wardrobe swaps an outfit, body, hair or hat, the old one's files are freed (`letGo`). When it closes, so is everything it opened.
   - A file still in use is never freed. The athlete on the base wearing an outfit keeps it loaded.
   - In the demo, trying five outfits kept one loaded at a time. After closing, only the athlete's body and clips were left.
   - The cost: going back to an outfit you just tried reads it again from the phone's cache, a moment's wait.
5. **Load less at launch.** Load only the language in use (−120 KB). Load the gym logger, onboarding, chat, challenges, wardrobe and chest screens when they're first opened, the way the markets and the stadium already are. This makes launch faster but isn't what crashes.
6. **If it's still not enough:** draw the island on one canvas (a game renderer) instead of web page elements, as native games do. This is a big job.

### Features to scale down if crashes continue

- **The always-moving 3D athlete on the base.** It draws 30 times a second whenever the base shows. Options: run it at 20 frames a second, or keep it still until tapped and animate it only in the run room.
- **How far you can zoom out on the island.** Zoomed all the way out, every island picture is drawn at once (about 95 MB decoded). A higher lowest zoom would keep the sea edges and far buildings off screen.
- **One 3D scene on screen at a time, everywhere.** The stadium, the wardrobe and now the base (only the athlete) work this way.

### How to tell if it's better

- **Crashes:** use the app for 10 minutes, moving between the island, the markets, the shop, the stadium and the wardrobe. Before, it reloaded by itself. If it still does, item 2 is next.
- **Lag:** pan the island and open the markets. The first launch after an update still downloads pictures; from the second launch on, nothing should download again. If panning still lags, item 3 is next.
