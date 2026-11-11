# Performance

How the base is kept smooth, and what was measured (demo, run room, 390 x 760, desktop Chrome on 2026-11-11; a phone is about 4 to 6 times slower).

## Rules

- **One screen update per frame.** Panning and zooming change the view at once, but the world's transform is written once a frame (`paint` in `js/app/diorama-view.js`). A phone sends up to 120 touch events a second.
- **Never read layout while moving.** The viewport's box is measured once, and again only on resize or when a touch starts. The room picture's on-screen width is worked out from numbers already known.
- **Inherited CSS values only when they change.** `--inv` (the labels' counter-scale) is set only when the zoom changes, not on every pan, because every label under it recalculates its style.
- **One redraw for many saves.** A data change asks for a redraw; changes in the same moment share it (`main.js`, `queueMicrotask`). Saving a drill used to redraw twice; three saves now redraw once.
- **Moving things move by transform.** The walking athlete moves with `transform`, not `left` and `top`, so no layout runs while it walks.

## Measured

| | Before | After |
|---|---|---|
| Redraws for 3 saves at once | 3 | 1 |
| One redraw of the base | about 10 ms | about 10 ms (but fewer of them) |
| Frames over 33 ms in a pan and zoom test | 4 | 2 |
| Idle on the base | 60 fps, no redraws | same |
| Pictures in memory, decoded | about 121 MB | same |

## Next, in order of value

1. **Item pictures are 3 to 6 times bigger than they're ever shown.** For example, the treadmill is 720 px wide but at most about 240 px on screen at full zoom. Smaller copies for the room (the full size stays for the shop and inventory) would save about 20 to 30 MB of memory.
2. **Don't rebuild the whole base for a change it doesn't show.** A redraw rebuilds the HUD and rewires the stage. Updating only what changed would cut the 10 ms.
3. **One 3D canvas.** The city (clouds, truck) and the athlete each have their own. Sharing one saves memory on iPhone, which allows only a few.
4. **The big step, if it's still not enough:** draw the base on one canvas (a game renderer) instead of web page elements, as native games do.
