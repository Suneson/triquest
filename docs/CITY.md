# The city tower (plan and first test)

**Status:** test art only. Nothing here is wired into the app yet. House style: docs/ART-DIRECTION.md.

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
- **The street (locker floor only):** later, cars drive past. A MOSKE delivery truck arrives with each shop purchase and waits at the delivery bay, and tapping it brings the parcel into the inventory.

## What was tested

All made with `tools/gen-city.mjs`, Gemini's image model at its largest size (16:9 at 5504 × 3072).

| File | What |
| --- | --- |
| `icons/City/floor-0-locker.webp` | Street level: the slab on the tower's glass lobby, a delivery bay with a roller door, the street with crossings, bus stops and shops. |
| `icons/City/floor-1-gym.webp` | One storey up, made with the locker floor as its reference: the same slab in the same place, an office storey under it instead of the lobby, and rooftops below. |
| `icons/City/truck.webp` | The delivery truck, keyed from its green screen (source in `src/truck.jpg`). |
| `icons/City/clouds.png` | The cloud band that covers the move between floors. |
| `docs/city-lift-test.gif` | The move from the locker to the gym, as it would look on a phone. |

**What worked:**
- The look: modern, clean, cartoony, no wood.
- The flat slab, about half the picture wide, which holds a 16 × 16 floor with room to spare.
- A phone sees about a quarter of the picture's width, so there's plenty to swipe across.
- The truck.

**What didn't:** an image model can't be trusted to redraw *the same* city with the camera exactly one storey higher.
- The first gym attempt stood a new tower on the slab.
- The second only slid a band of windows under it.
- The third (the one kept) changed the storey under the slab but redrew the rooftops around it.
- So five separate pictures will never latch onto each other perfectly. A transition has to hide the join, which the clouds do well (see the GIF).

## Recommendation: build the tower from layers, not from five pictures

Make the art in pieces and let the app stack them:

1. **The sky and far skyline:** one wide picture, which barely moves.
2. **The city:** two or three pictures of the surroundings at different heights (street, mid-rise, rooftops), with no MOSKE tower in them.
3. **The tower:** one picture of a single storey of facade that tiles vertically, one lobby storey for the street floor, and the slab. The app stacks as many storeys as it needs.
4. **The room** on the slab, as today.

Going up a floor then becomes a real, continuous camera move:
- The tower slides down by exactly one storey, which joins perfectly because the storeys tile.
- The city layers slide at different speeds (parallax), so you feel the height.
- The far skyline barely moves.

There's no seam to hide, though a few clouds drifting past at the higher floors still sell it. This is also what lets cars and the truck move on the street layer independently, and it's how the rooms can grow to 16 × 16 without new backgrounds.

**If you'd rather keep one picture per floor** (simpler art, five images), the test shows the fallback works:
1. The old floor drops away, blurred and stretched.
2. A band of clouds rises through the screen and covers the swap.
3. The new floor settles in from above.

The whole move takes about 0.9 s. The prompts for all five floors are in `tools/gen-city.mjs` (`floor-0` to `floor-4`). Each is made with the floor below it as a reference, and each will need a few tries and some touching up.

## The prompts

All in `tools/gen-city.mjs`, built from the house `STYLE`, the `CAMERA` (the rooms' isometric angle, floor edges at about 29°) and the `SLAB` description.

```
GEMINI_API_KEY=… node tools/gen-city.mjs <out-dir> truck floor-0-locker floor-1-gym
```

The remaining floors are `floor-2-bike`, `floor-3-run` and `floor-4-pool`. Run them in order, because each one uses the previous floor as its reference.

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
   - For the truck: one GLB with a `Drive` clip, plus a `Stop`/`Idle` clip. The app moves it along the street, and the clip only animates the wheels and body.
4. **Scene layout:** today each room is its own view.
   - A painted 2D room picture sits on a 2D backdrop in one pannable, zoomable layer (`diorama-view.js`).
   - The 3D canvas sits inside that layer, on top of its item, so it pans and zooms with it.
   - There's no single continuous 3D world. With the layered tower above, the floors stay 2D art, and only the moving things (runner, truck, cars) are 3D or animated sprites placed on the layers. That stays light on a phone.
5. **UI and media:** the interface is ordinary HTML/CSS over the scene.
   - The top bar, side buttons, dock and sheets.
   - **The chests:**
     - an HTML video (WebM with transparency) with its sound;
     - a still WebP to rest on;
     - CSS animation for the shake, the rays and the coin spray.
   - On iPhone, Safari ignores WebM transparency, so the chest falls back to its still and shake. Exporting the clips as HEVC-with-alpha `.mov` would give iPhone the full clip.
   - See docs/REWARDS.md.
