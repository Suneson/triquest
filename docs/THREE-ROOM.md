# Moving the base to three.js

The base is moving from web page pictures to a game renderer (docs/PERFORMANCE.md, item 6), one part at a time, behind a switch until it's checked on an iPhone.

## The switch

- Open the app with `?three=1` once. It stays on for that device; `?three=0` turns it off.
- With it off, the base is exactly as before.

## Stage 1 (done): the items and the athlete

`js/app/base-gl.js` draws what stands in the room: every item's picture, and your athlete as a real 3D figure among them.

- **Its own canvas, drawn straight into.** The athlete used to be drawn off screen and copied into the page every frame, the costly part on iPhone. Now it has a WebGL canvas of its own (the stadium and the wardrobe keep the shared one, `gl-shared.js`).
- **The page still lays the base out:** the city, the room's picture, the floor's lines, the pan and zoom, and the item buttons. The buttons are what you tap and drag, and carry the tags (timers, counts). With three.js on, their pictures are see-through and three.js draws the item in their place.
- **The canvas sits inside the items layer**, under the buttons and over the floor, counter-scaled so it's the size of the screen. It moves with the world, so the two can't drift apart, even while the view eases.
- **The camera** is orthographic, tilted to the painted floor's slant, and its projection is worked out so each point of the floor lands on exactly the pixel the page puts it on. Checked by showing the old pictures over the new ones: they match.
- **Each item** is its picture on a card facing the camera, standing at its footprint's middle (`data-uv` on its button), so the athlete walks in front of and behind it. It bounces when picked up, lifts while dragged, turns red where it can't stand, springs back and drops when set down, as the page's pictures did. Its drop shadow is a dark copy of it, a little lower.
- **The athlete** walks the floor (`walker.js` drives it through `body`) and runs on the treadmill during a drill (`machine`).
- It draws when the view moves (in the same frame), when an item changes, and 30 times a second while the athlete moves. It stops under a full screen and when the base isn't shown.

The test room from PR 92 is gone: the base itself is the test now.

## Stage 2 (done): the room and its floor

three.js now also draws the room's picture, the tape round an unexpanded room and the dimmed floor beyond it, the soft shadows under the items, the held item's footprint and its four arrows.

- **Read from the page as it lays them out:** the room's art element (its size, its matrix in the world and its picture, half size or sharp), the floor's SVG, the tape's strips and the shadows layer. A change to any of them builds the floor again.
- **Drawn in a pass of their own** before the items and the athlete, in the page's order: picture, dimmed floor, tape, footprint, arrows, shadows.
- **Lines stay the same width on screen** as the page's (2 px round a tile, 2.5 px round an arrow): they're built again once the zoom changes by a sixth.
- **The page's copies are hidden** once the room's picture is drawn here, so the room never shows empty. The page's picture isn't drawn at all (`display: none`), so the browser doesn't keep it decoded. Its arrows stay, unseen, so tapping one still moves the item.
- Checked by laying the page's picture, inverted, over the three.js one: they cancel to flat grey.
- Not drawn yet: the arrows' slow pulse and the glow round the footprint.

## Next stages

3. **The city, the tower and the island**, then tapping by three.js instead of see-through buttons. Then the page draws only the HUD and the menus.
4. **Items as 3D models** where a Tripo model exists, in the same scene.

## What to check on an iPhone

1. Pan and pinch the base with the athlete walking: is it smoother than with `?three=0`?
2. Pick an item up, drag it, set it down; train on the treadmill.
3. Use the app for 10 minutes (the stadium, the wardrobe, the markets) and come back: is the base still drawn, and does the app stay up?
