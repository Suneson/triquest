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

### Next, most effective first

1. **Make the city's 3D sign and truck 2D. This is the biggest steady cost.** Today a whole-screen 3D render is copied every second to show a clock, and on every frame while you pan. Two ways to fix it:
   - **Make them 2D:** the sign is a picture with the clock as ordinary text over it, and the truck is a short sprite or a picture sliding along its road.
   - **Keep them 3D, but small:** give the sign and the truck each their own canvas, the size of the object rather than the whole screen.

   Either way, the island loses one of its two always-present canvases.
2. **Use lighter island pictures. This is the biggest memory cost.** The island holds 115 MB of pictures before you open anything, yet it's shown at about a quarter of its size most of the time.
   - Ship **half-size copies** of the ground tiles, the base and the buildings, and switch to full size only past a zoom level. That's about 4× less memory for the normal view.
   - **Bake the shadows** into the market pictures instead of using CSS drop-shadows.
   - Item pictures in the rooms are 3–6× larger than they're ever shown (from 2026-11-11). Smaller room copies would save about 20–30 MB.
3. **Draw 3D straight into the page when only one view shows.** One shared renderer is right (iPhone allows only a few WebGL contexts), but the copy into each view is costly. When a single 3D view is on screen (the stadium, the wardrobe, the run room), it can be drawn directly instead. This is a careful change: test it on an iPhone before merging.
4. **Let go of 3D models when their screen closes.** This is done for the stadium. The wardrobe (every outfit you try stays loaded) and the room mechanics should do the same. Only the athlete on the base needs to stay.
5. **Load less at launch.** Load only the language in use (−120 KB). Load the gym logger, onboarding, chat, challenges, wardrobe and chest screens when they're first opened, the way the markets and the stadium already are. This makes launch faster but isn't what crashes.
6. **If it's still not enough:** draw the island on one canvas (a game renderer) instead of web page elements, as native games do. This is a big job.

### Features to scale down if crashes continue

- **The 3D sign and truck on the island** (see 1): the highest cost for the least value. 2D would look almost the same.
- **The always-moving 3D athlete on the base.** It draws 30 times a second whenever the base shows. Options: run it at 20 frames a second, or keep it still until tapped and animate it only in the run room.
- **How far you can zoom into the island.** Full detail at every zoom keeps the big pictures loaded. A lower zoom limit lets the half-size pictures (see 2) cover everything.
- **One 3D scene on screen at a time, everywhere.** The stadium and the wardrobe already work this way, but the base has two: the athlete, and the sign with the truck.

### How to tell if it's better

- **Crashes:** use the app for 10 minutes, moving between the island, the markets, the shop, the stadium and the wardrobe. Before, it reloaded by itself. If it still does, item 2 is next.
- **Lag:** pan the island and open the markets. The first launch after an update still downloads pictures; from the second launch on, nothing should download again. If panning still lags, item 1 is next.
