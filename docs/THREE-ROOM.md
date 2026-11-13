# The three.js test room

A first step towards drawing the base with a game renderer (docs/PERFORMANCE.md, item 6). The room on the stage, drawn by three.js on one canvas instead of as web page pictures, to compare how it feels on a phone.

## How to open it

- Open the app with `?three=1` once. The setting stays on that device (`?three=0` turns it off).
- A blue **3D test** button shows on the base, under the room's name. It opens the room you're looking at.
- It looks best with the 32 × 32 rooms (`?rooms32=1`), the rooms all of this is heading for.

## What it does

- **One canvas, drawn straight into the page.** It borrows the app's one WebGL renderer (`borrow` in `js/app/gl-shared.js`), so there's no copy from the GPU into a 2D canvas, the step that made 3D costly on iPhone. The base's other 3D views wait until it's closed; they're under it anyway.
- **The painted room** is a picture stuck to the camera, far back, laid so its floor's three corners fall exactly on the scene's floor corners. It comes at half size first and swaps to the sharp one once you zoom in far enough, as on the base.
- **Items** are their room pictures on cards facing the camera, standing at the middle of their footprint, with a soft shadow on the floor. Size and placement follow the base's rules (`itemBox`, `js/core/item-fit.js`). Rugs and other flat items lie under everything.
- **Your athlete** is the wardrobe's character in the same scene, wandering the floor as on the base (`js/core/walk.js`). It walks in front of and behind items with no special sorting code.
- **Touch:** drag to pan, pinch or wheel to zoom, tap an item to pick it up (it bounces and shows its footprint), drag it tile by tile (the footprint turns red where it can't stand) and let go to set it down. Moves are saved as on the base.
- **The top bar** shows frames a second and draw calls. It draws at most 60 frames a second.

## What it doesn't do yet

- No item menu (rotate, stash, open), arrows, tags or the athlete training on a machine.
- No city, tower or island round the room.
- Items are still pictures. When the Tripo models arrive, an item can be its 3D model in the same scene instead of a card.

## What to check on an iPhone

1. Pan and pinch: does it feel smoother than the base?
2. The frame counter while the athlete walks and you pan: does it stay near 60?
3. Open and close it a few times, then use the app: does the base's 3D still show, and does it stay stable?

If it's clearly smoother, the next step is moving the base itself onto this renderer, room first, then the city round it.
