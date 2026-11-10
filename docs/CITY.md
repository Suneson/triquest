# The city tower (plan and first test)

**Status:** all five floors are in the app (locker, gym, bike, run, pool).

**On screen:**
- The city fills the whole screen, down behind the dock.
- The rooms are an elevator's buttons on the right, the pool at the top and the locker room at the bottom: baby-blue rings with light faces. The floor you're on turns blue and a size bigger (docs/JOURNAL.md).
- In a row under the name: what's next and the room's trophies. Down the left: the shop and the inventory. Nothing here is wired into the app yet. House style: docs/ART-DIRECTION.md.

## The island (read this first: it replaces the city below)

The base now stands in the middle of an island of nine 2 x 2 plots.

- **Pictures:** `tools/cut-island.py` keys the art and cuts `icons/Island/*.webp`, and writes where each goes to `js/core/island-art.js`. Don't edit that file by hand.
- **The tower:** `js/core/diorama.js` stacks the upper floors on the base by `FLOOR_OF`, one `storey.webp` per floor, and works out each room's slab.
- **Plots:** `js/app/island-view.js` draws them and handles taps. The Mall opens the shop and a built club base opens the club screen.
- **Rebuilds:** the rules are in `js/core/island.js` and the server keeps the same ones (`supabase/migrations/0033_island.sql`, held together by `tests/island-sql.test.js`). The club, the pool and the market start in ruins. Under works, the club shows its own picture and the pool and the market show their ruin, until the construction box exists. A timer floats over each one.
- **Taps:** the viewport takes the finger only once it moves (`TAP_TARGETS` in `js/app/diorama-view.js`), so a tap reaches a building's button and a drag still pans the map.
- **The van:** while driving, it's covered by the Mall and the market, in whatever state they're in (`islandFront`).

## The idea

The base becomes one tall MOSKE tower in a modern city. Each room is a floor of the tower, standing on the tower's flat concrete roof slab, with sky above it:

| Floor | Room |
| --- | --- |
| 4 (top) | Pool |
| 3 | Run room |
| 2 | Bike room |
| 1 | Gym |
| 0 (street level) | Locker room / inventory |

- **The slab** is big enough for a 16 × 16 floor, so rooms can grow from 8 × 8.
- **Panning:** you can swipe much further left and right to look round the city.
- **Moving between floors:** going from one room to another moves the camera up or down the tower.
- **The street (locker floor only):** later, cars drive past.

## How the floors are made

**One picture per floor.** Each is 3:4 at Gemini's largest size (3584 × 4800). That is a little wider than a phone, so the whole slab is in it, left and right corners included:
- The phone shows the middle 9:16.
- Swiping sideways reveals the corners.
- The sky in every floor is flat green (#00FF00) and is keyed out.

| File | What |
| --- | --- |
| `icons/City/sky.webp` | The sky, behind every floor. |
| `icons/City/floor-0.webp` | Locker room, street level: the slab sits on the glass lobby, with the street and tall towers round it. The sky is transparent. |
| `icons/City/floor-1.webp` | Gym: the same slab in the same place, with exactly two storeys under it (an office storey plus the lobby), the street a storey lower and taller buildings around. |
| `icons/City/floor-2.webp` | Bike room: three rows of office windows under the slab. |
| `icons/City/floor-3.webp` | Run room: four rows of office windows under the slab. |
| `icons/City/floor-4.webp` | Pool, the top floor: five rows of office windows under the slab. |
| `icons/City/clouds.webp` | A chunky cloud bank, transparent, for the move between floors. |
| `icons/City/app/` | What the app loads: each floor at 1792 × 2400 with the sky baked in, and the clouds at 768 × 1376. |
| `icons/UI/ref/city-floor0-ref.jpg` | The picture chosen as floor 0's look. |
| `docs/city-lift-test.gif` | Locker → gym on a phone, then a swipe out to the slab's corners. |
| `docs/city-floor-1-preview.jpg` | The gym's whole picture with the phone's frame drawn on, and what the phone shows. |

**Each floor shows one storey more than the floor below.** It is made with the two floors below as references, and the prompt counts the rows of office windows between the lobby canopy and the slab: the gym has 2, the bike room 3, the run room 4. Asking for "storeys" didn't work, because the bike room came back with the same two rows as the gym.
- Gemini tends to frame the next floor a little wider, so the slab comes out smaller or higher.
  - The gym and bike room were scaled with `tools/cut-city.py align` so their slab lands on the locker's.
  - The run room's slab sits too high to scale into place without cutting off the towers' tops, so it was left as made.
- **In the app (`js/core/diorama.js`):** each floor's slab corners are measured in its app picture (`SLABS`).
  - The room's 8 × 8 floor is centred on the slab at half its width (the slab is made for 16 × 16).
  - The opening view is zoomed so the slab is a little wider than the screen (`slabView`), and you swipe to see its corners.
- Don't ask Gemini to pin the slab's position: when we tried, it added a smaller setback storey on top instead.

**Moving between floors (1 s, `cloudMove` in `js/app/diorama-view.js`; skipped under reduced motion):**
1. The old floor drops down and blurs.
2. A cloud bank about one and a half screens tall (`clouds.webp` twice, the second one mirrored) sweeps in from the top of the screen and out at the bottom. It covers the screen while the floors swap.
3. The new floor settles in from above.

The clouds hide the jump, so a floor only has to be one storey taller than the one below.

**Making them:**

```
GEMINI_API_KEY=… node tools/gen-city.mjs <gen-dir> sky clouds-a floor-0
GEMINI_API_KEY=… node tools/gen-city.mjs <gen-dir> floor-1      # needs floor-0 in <gen-dir>
python3 tools/cut-city.py align <gen-dir>/floor-1.png <gen-dir>/floor-0.png
GEMINI_API_KEY=… node tools/gen-city.mjs <gen-dir> floor-2      # then floor-3, each after the one below
python3 tools/cut-city.py <gen-dir> <out-dir>                    # keys the sky, writes the previews
```

**Still to come:**
- A cut-out of the slab's navy and gold rim, to lay over a room's floor so the room sits in the slab.
- 16 × 16 rooms.
- One rooftop at the gym's top right is smeared.

## How the app is built (for the 3D pipeline)

1. **Framework and runtime:** a plain web app, with no Unity, React, Swift or Capacitor.
   - It's HTML, CSS and vanilla JavaScript modules with no build step, served from GitHub Pages.
   - It installs on iPhone as a home-screen web app (PWA) and runs in Safari's engine, with a service worker caching it for offline use.
   - The backend is Supabase (Postgres, auth and edge functions).
   - Wrapping it for the App Store later (Capacitor) is possible without a rewrite.
2. **3D:** three.js (r170), stored in the app (`vendor/three/`) and only loaded when a 3D model is on screen.
   - Today that's the runner on the treadmill, drawn into a transparent WebGL canvas over the painted room.
   - The camera is orthographic, matched to the rooms' isometric angle.
   - See docs/RUNNER3D.md.
3. **Asset format:** **.glb** (binary glTF 2.0).
   - Export from Meshy as GLB with the animations embedded, then optimise with gltf-transform: meshopt compression, WebP textures at 1024 px, and simplifying the mesh if it's heavy. The 17.5 MB runner became 1.3 MB.
   - Animations are clips inside the GLB, played by three.js's AnimationMixer (`Running`, `Walking`).
   - FBX and USDZ aren't used. Convert FBX to GLB first, in Blender or Meshy's export.
   - Keep each model to about 50–100k triangles, about three 1024 px textures and one rig.
   - For a car: one GLB with a `Drive` clip. The app moves it along the street, and the clip only animates the wheels and body.
4. **Scene layout:** today each room is its own view.
   - A painted 2D room picture sits on a 2D backdrop in one pannable, zoomable layer (`diorama-view.js`).
   - The 3D canvas sits inside that layer, on top of its item, so it pans and zooms with it.
   - There's no single continuous 3D world. The floors stay 2D art, and only the moving things (runner, cars) are 3D or animated sprites placed on the layers. That stays light on a phone.
5. **UI and media:** the interface is ordinary HTML/CSS over the scene.
   - The top bar, side buttons, dock and sheets.
   - **The chests:**
     - an HTML video (WebM with transparency) with its sound;
     - a still WebP to rest on;
     - CSS animation for the shake, the rays and the coin spray.
   - On iPhone, Safari ignores WebM transparency, so the chest falls back to its still and shake. Exporting the clips as HEVC-with-alpha `.mov` would give iPhone the full clip.
   - See docs/REWARDS.md.

## The big base (read this first: it replaces the sizes below)

The base is 2 × 2 city blocks. It keeps its old pixels exactly (slab, tower, railing, markets, sign, all in the old 5376 × 4980 coordinates), and only the street grid around it is redrawn, at 0.436 of the old size: two new blocks and a road equal one old block.

- **The world** is 7000 × 8600 with its top-left at (-800, -2300): `CITY` in `diorama.js`. `clampView` and `homeView` take that origin into account.
- **Pictures:** `tools/compose-big-base.py` makes the city and the base's own sharper block (`icons/City/layers/base.webp`, 1.5 px per world px, no AI upscale: detail comes from `layers/plate.webp`). `tools/cut-big-city.py` cuts 6 × 7 tiles, sharper within 2400 px of the base than beyond, for the same memory as the old city, and the van's cover pieces.
- **The van's road** didn't move: the new roads run through the old road lines. The van is shorter.
- **Zoom:** out until the world covers the screen (the base is under half the width), in until a tile of the room is 68 px across (`maxZoom`).
- **The stadium** is a 2 × 2 landmark behind and to the right of the base.

## The layered city (next)

Separate pictures per floor drift in colour and detail, so the city is being rebuilt from layers. Nothing in the app uses this yet.

- **The plate** (`icons/City/layers/plate.webp`) is the street floor itself. In an orthographic picture a taller tower only ever covers more of the city behind it, so nothing has to be taken out of it.
  - Expand it once in Photoshop: canvas **10752 × 8600**, anchored bottom centre.
  - The top storeys and the sky need the extra height, and the markets, the public pool and the track go in the extra width.
- **The tower:**
  - Its pieces are `icons/City/layers/tower-cap.webp` (the slab with the top storey under it) and `tower-storey.webp` (one office storey, which stacks on itself without a seam).
  - Both are cut by `tools/cut-tower.py` from `icons/City/src/tower.webp` (Gemini, `gen-city.mjs tower`).
  - Floor N stands N storeys tall: the cap with N − 1 storeys under it, on the plate's lobby. `tower.json` says where each piece goes.
- **One slope for everything:** 0.489, the ground falling 0.489 px per px across, which is the slope of the new room pictures.
  - The plate is squashed a little to get there.
  - The tower's right face is evened up with its left (Gemini drew its storeys 339 px apart on the left and 350 on the right), then stretched.
  - The tower's colours are matched to the plate on the slab concrete.
- **Preview:** `docs/city-layers-preview.jpg` shows floors 0 to 4 put together.

### The city plate (`tools/compose-city.py`)

The plate is built like a game map rather than expanded by an image model.

- **The street grid:** a lattice of square blocks at the slope. Its first two roads are the ones that leave the street floor on the left and the right, measured on their lane dashes, so the roads carry straight on.
  - Blocks are 2150 px across, roads 632 px wide, and the pitch is 2782 px, all at full size.
  - The road and pavement colours are sampled from the street floor.
- **The plots** (`icons/City/plots/`) each stand on one block: the market and café, the public pool, the stadium, and the apartments (used four times for now).
  - Each plot is one city block on green screen, made in Gemini with the street floor as the style reference.
  - It is squashed to the slope and scaled so its base is exactly one block wide.
  - `PLOTS` says which block each one stands on.
  - Each is clipped at its block's two front edges and side corners (a kerb's depth under them, a 1 px edge). The pictures carry a little of Gemini's own road round the block, which showed as soft ghosts of kerb on the road, cut off square.
- **The street floor** is clipped in front of its block's two front faces, part way across the road before the lane line, keeping the two roads along those faces with their zebras. It ran on down the side roads with kerbs of its own that didn't line up, faded out at its left and right edges: more soft ghosts.
  - Never clip it behind or beside those faces. The lobby, kiosks and slab rise up the picture over the ground behind the block, so a clip there cuts them away (it did once, and the road showed through the street floor).
- **Draw order, back to front:** sky, street grid, the plots behind, the tower's block (the street floor: lobby, slab and crossroads), then the plots in front. The tower's storeys go on top in the app.
- **The street floor's own background towers are left out.** The band painted on above them (`icons/City/src/plate-top.jpg`) ended at its top edge, so they stopped in mid-air.
- **The kiosk at each side of the lobby** was cut in half where the street floor ends. Each was finished with one small Gemini inpaint: a 1400 px crop with just the cut strip in magenta.
  - Outpainting whole strips didn't work: Gemini drew a second building or redrew the lobby.
  - The four kiosks have since been painted out again (bare wall and pavement): the app stands its own 3D markets there, which you buy (docs/MARKETS.md).
  - The pavement ends past those kiosks came out soft (the left one yellow), fading into the road. Each was painted again crisp the same way (`kerb-left.webp`, `kerb-right.webp`), kept as a patch with its own alpha: the painted area and a few px round it.
- **Output:** the app draws the city at half the master's size (5376 × 4980) in 4 × 4 tiles stored at three-quarter resolution (`icons/City/layers/tiles/`). The two all-sky tiles are left out. The full 10752 × 9960 is made by the script.
- **The sky** (`icons/City/sky.webp`) is a plain gradient in the painted band's colours.
  - The earlier "sky" was an old blurred city picture saved under the wrong name.
  - Every floor had been composited over it, which made the soft, faded patches. The floor pictures are now rebuilt over the real sky.

**Still to do:**
- More plots, so the apartments aren't repeated: tall towers for behind the tower, offices and a park.
- The yellow kerb that the left kiosk fix added.

### In the app

- **The world:** the base's stage is the city picture (5376 × 4980), drawn in tiles (`icons/City/layers/tiles/`).
  - One picture that size was more than an iPhone would keep decoded next to the 3D layers: the city vanished.
- **The tower:** stacked on the street floor for the room's floor, from half-size pieces in `icons/City/layers/app/`.
  - The locker room is the street floor as it is.
  - The gym has the cap.
  - The bike room, run room and pool add one office storey each.
- **The code:** `towerPieces(n)` and `slabOf(n)` in `js/core/diorama.js` place the pieces and the slab, and the room's 8 × 8 floor stands in the middle of the slab at half its width.
- **Swiping:** you can swipe across the whole city.
- **Moving between floors:** still covered by the cloud bank.

### What moves (`js/app/city3d.js`)

Two transparent WebGL canvases cover the stage.
- **The back canvas** sits under the city picture, whose sky is transparent (`compose-city.py … nosky`). What it draws shows only through the sky, so its clouds pass behind the buildings.
- **The front canvas** sits over the city picture.
- **The camera:** orthographic and tied to the stage's pan and zoom. The 3D ground is the city's own: X runs along e1 = (1, 0.489) world px, Z along e2 = (−1, 0.489), and Y up.

What's on them:
- **Far clouds:** six flat clouds (`icons/City/sky-clouds/`, keyed from your two green-screen pictures). They drift right to left in screen space, slowest of all.
- **3D clouds:** the three cloud models (`models/city/cloud-*.glb`), with their textures dropped for a soft white material of their own and their normals recomputed. They fly high above every roof (`CLOUD_UP`), turned with their long side square to the screen, and drift right to left across it like the far clouds: six behind the buildings and two in front.
- **The delivery sign** (`models/city/sign.glb`) stands on the pavement left of the garage door, its panel facing out.
  - Its white panel counts down to the next delivery: every shop order is a workshop job with a finish time (`js/core/deliveries.js`).
  - Tapping it opens the list of deliveries on their way (`js/app/delivery-view.js`), as beige cards like the Journal's.
- **The MOSKE truck** (`models/city/truck.glb`) brings whichever delivery is ending (`truckAt`).
  - It drives in from the right along the road between the stadium and the pool, turns at the stadium's crossing onto the road past the garage, and arrives at the door as the countdown ends.
  - It waits at the door, under its parcel bubble, for as long as a parcel is waiting there or being opened. Once you've opened it and closed the screen, it carries on down the same road and out at the bottom left.
  - The route is `ROUTE_IN` and `ROUTE_OUT`, given as street-grid coordinates (`lat(a, b)`).
- **Reduced motion:** the clouds stand still and the truck only appears parked.

**Models:** export GLB from Meshy, then run `npx @gltf-transform/cli optimize in.glb out.glb --texture-compress webp --texture-size 1024 --compress meshopt`. The five models went from 42 MB to under 0.9 MB.

### The row below

The city has one more row of blocks below the street floor's crossroads, so you can scroll down to the market and the pool. The canvas is now 10752 × 9960.
- Straight below: `apartments-green`.
- Far left: `apartments-small`.
- Far right: `apartments`.
- Under them, only their tops show at the bottom edge: the market and the pool again.

On the base the page's own colour is the roads' asphalt (#877688), so the strip iPhone paints under the dock reads as street.

- **The far clouds** are sized as a share of the screen from the start and drift on their own loop. If WebGL isn't available they still move, and they never show at their pictures' natural size.
- **The 3D layers** draw at most 1.5 px per CSS pixel, without antialiasing.

### Parcels

When the truck has brought a delivery, its parcel waits at the garage door: a bobbing bubble over where the truck stops, with a count when there are several.
- **Tapping it** (`openParcel` in `js/app/delivery-view.js`): the parcel (`icons/City/parcel/`, made with Gemini) sits on the chest's stage. Two taps shake it, and the third bursts it open, with what was in it rising out under its name.
- **Next parcel:** Collect moves on to the next parcel.
- **Which parcels wait:** deliveries from the last 3 days that haven't been opened (`parcelsWaiting` in `js/core/deliveries.js`). Opened ones are remembered on the device.
- **A real opening animation** can replace the two stills later: same place, same timing.

### The front layer

The plots in front of the van's road are also drawn on their own: the right-hand column of blocks, from the pool's row down (`FRONT` in `tools/compose-city.py`, written by `… front` and cut into the tile grid as `icons/City/layers/front/front-<row>-<col>.webp`). The app doesn't show those tiles. `tools/cut-front.py` keeps only what lies within 300 px of the van's road out and crops each tile to that, giving `van-front-*.webp` (about 4.7 MB decoded in all) and the `VAN_FRONT` list for `js/core/diorama.js`.

The 3D layer draws those pieces as flat pictures on the ground, after everything else in the front scene and through its depth, so they cover the van where they stand in front of it. They load when the van is about (arriving, parked or leaving) and are let go once it's gone.

Don't put a city-sized layer over a 3D canvas, the city's or the runner's on the run room's treadmill (inside `.dg-items`). The layers over the room (`.dg-shadows`, `.dg-items`, `.dg-mks`) have no size of their own; their pieces stand out of them. Also, `webglOk()` asks for WebGL once and remembers the answer, since each test makes a context. That was the first version, and iPhone Safari ran out of memory and kept reloading the page ("A problem repeatedly occurred").

The parcel bubble sits on a small layer of its own over the 3D canvas, `.dg-front`, with no size of its own, so it shows over the 3D sign at the cost of the bubble only.

## The island's stadium and construction box

Both are cut by `tools/island-extras.py`. Its `level` command stretches every plot's picture so its front kerbs lie on the ground's slope, and `despill` takes out green screen left along outlines and in glass (`despill()` in `tools/cut-island.py`, which new cuts get anyway). While a club, pool or market is being rebuilt, one picture of a giant MOSKE box (`icons/Island/box.webp`) stands on its plot in place of the ruin, with the timer over it. The pool, the Mall and the market stand in front of the base's collectors, so they're drawn over them.

## Previewing the 32 x 32 rooms

All five rooms have all ten levels (`icons/Pixelart/NEW/<ROOM>/big-1.webp` to `big-10.webp`), and an expanded or taped room shows the picture for its own level (`bigArt()` in `js/core/expansions.js`). The locker uses the same set; its old `model-32.webp` is no longer used. They still stay hidden from players until the expansions go live. Open the app with `?rooms32=1` to see them on that device, and `?rooms32=0` to turn them off. Admins can also buy the real upgrade for any room from the Expand window.

`tools/cut-rooms-32.py` cuts them and writes `js/core/room32-art.js`. Level 10 sets the frame and the floor corners. Levels 1 to 9 come from the x2 upscales in each room's `upscaled/` folder. Their frames came out at slightly different shapes, so each one is fitted onto level 10's outline before it's cut, and one set of floor corners works for every level. The key also removes the green screen in shadow under a room's base and the green-tinted light along its walls.

## Editing the lobby

The lobby round the tower's base is four city tiles: `city-1-1`, `city-1-2`, `city-2-1` and `city-2-2`. Laid out 2 × 2 they make a 2016 × 1868 px picture.

- To retouch it, put those four tiles side by side, edit the result (keeping its size and transparency), and cut it back with `tools/lobby-tiles.py`.
- The seams left where the kiosks were painted out were cleaned up this way, in Photoshop with Generative Fill.

## The railing

Each floor's roof slab has a railing round it: a navy kerb with gold rails (`icons/City/rail/`, cut by `tools/cut-rail.py`).

- **Fitting:** the picture is warped so its kerb's outer top corners land on the slab's corners. There are two versions: the street floor's slab, and the roof slab every floor above stands on. The second moves up a storey with each floor (`railOf()` in `js/core/diorama.js`).
- **Splitting:** it's cut along the line between its left and right corners. The back half goes behind the room. The front half, with its rails, goes over the room and what stands in it, so the room stands inside the railing.
- **The old railing:** the one painted into the floor pictures sits under the new kerb, which hides it.

