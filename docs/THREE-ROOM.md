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

## Stage 3 (done): the city, the tower and the island

three.js now draws every other picture in the base too: the city's ground, the tower, the railing, the island's plots, the pool, the mall, the markets, the port, the sign and the truck.

- **Read from the page as it places them:** each picture's inline left, top and size (the truck's translate, the sign's box). A change to one moves just that one; anything else (a picture added, swapped or culled) collects them all again.
- **In the page's own order:** what the page paints under the room is drawn before the floor, and the layers it paints over the items (the pool, the mall, the markets, the railing's front, the sign, the truck) in a pass after the items and the athlete.
- **Only what's on the screen holds a picture.** A culled picture lets its texture go after 4 seconds, so panning back and forth doesn't load it again. Pictures are decoded off the main thread where the browser can (`ImageBitmapLoader`).
- **The page's copy of each is hidden** (`.gl-on`) once it's drawn here. Its tap areas and its words (the sign's countdown, the market timers and coins) stay on top.
- A tap on a plot squeezes it here as on the page.
- Checked the same way: the page's pictures, inverted, cancel to flat grey over the three.js ones, under and over the room.

## Stage 4 (done): tapping by three.js

A finger now finds its item by the pixels three.js draws, not by the item's button.

- **A tap through a picture's see-through corner** reaches what's behind it: the floor, another item, or a plot of the island. Before, the button's whole box caught it.
- **How:** `base-gl.js` keeps each picture's alpha, small (64 px across), read the first time a tap needs it. `pick(x, y)` tries the cards front to back, in the order they're drawn. A finger gets 8 screen px of slack, a mouse 2, when nothing is right under it.
- **The buttons stay** (`pointer-events: none` under `.is-gl`) for keyboard focus and their tags. A tag (a timer, a count) still takes a tap and picks its item.
- **The city keeps its own tap areas.** One painted over the items (a market, the mall, the sign) wins over an item behind it. Under the items (a plot), the item drawn over it wins, and the plot doesn't get the tap as well.
- A mouse over an item shows the hand, as before.
- Checked in the browser: tap to pick up, a see-through corner puts it down, drag and drop, arrow nudge, and the mall opening its shop.

## Stage 5 (done): items as 3D models

With `?models=1` as well (it stays on for that device; `?models=0` turns it off), the 21 items with a Tripo model stand in the room as real 3D models: the treadmills t1 to t3, the coffee machines, the lockers, the fridge, the racks, the ice bath, the massage table, the workstand, the podium, the bag, the rower, the shoe rack, the trophy and its cabinets, and the bike stand.

- **The models:** `tools/build-items.mjs` makes them from `art/items/glb` (the models the pictures were rendered from) into `models/items/<name>.glb`, named like the picture without its facing. Each is about 14,000 triangles with one 1024 px texture, about 230 KB. A model loads only once its item is in a room.
- **Placed by its picture:** each model stands on its footprint's middle, turned for its facing (a, or b turned 90°), and sized so it's as wide on screen as its picture. Laid over the picture, the two match.
- **Painted with its picture.** The pictures were repainted after rendering, and the models still have Tripo's plain textures. But the base's camera never turns, so a model only ever shows the side its picture shows. Each point of the model takes the colour of the picture's pixel in front of it: it looks just as before.
- **What changes is depth.** The athlete is hidden behind the treadmill's console rail as it walks past, and runs on the belt behind the console. A picture could only be all in front or all behind.
- Picking a model is by a ray from the camera, so taps follow its real shape.
- `?models=raw` shows the models as Tripo made them, lit by the room, for comparing.
- The treadmill t4, the bike on rollers, the start block and the stall's items have no model yet and stay pictures.

## Stage 6 (done): the page draws only the HUD, the menus and the words

Once three.js draws a picture, the page no longer lays it out or paints it (`display: none`, not just see-through), so the browser needn't keep it decoded. That was the last of the page's copies: the items, the city's pictures, the tape and the floor shadows.

- **What the page still draws:** the HUD, the menus, and the words in the world: the item tags, the sign's countdown, the market timers and coins.
- **What it keeps, unseen, for taps:** the tap areas of the city and the floor's lines (the arrows).
- **An item's button keeps its picture's shape** (`--ar`, set as its picture loads), so its tags still sit on its top. Its picture still loads: three.js reads its address, and the size of a picture still places a market.
- Checked in the browser: no page picture is laid out, and the tags, the city, the markets and their coins are all in place.

## What to check on an iPhone

1. Pan and pinch the base with the athlete walking: is it smoother than with `?three=0`?
2. Pick an item up, drag it, set it down; train on the treadmill.
3. Use the app for 10 minutes (the stadium, the wardrobe, the markets) and come back: is the base still drawn, and does the app stay up?
