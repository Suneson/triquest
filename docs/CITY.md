# The city tower (plan and first test)

**Status:** test art for the first two floors. Nothing here is wired into the app yet. House style: docs/ART-DIRECTION.md.

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
| `icons/City/clouds.webp` | A chunky cloud bank, transparent, for the move between floors. |
| `icons/UI/ref/city-floor0-ref.jpg` | The picture chosen as floor 0's look. |
| `docs/city-lift-test.gif` | Locker → gym on a phone, then a swipe out to the slab's corners. |
| `docs/city-floor-1-preview.jpg` | The gym's whole picture with the phone's frame drawn on, and what the phone shows. |

**Each floor shows one storey more than the floor below.** It is made with the floor below as its reference, and the prompt says exactly how many storeys show under the slab.
- Gemini tends to frame the next floor a little wider, so the slab comes out smaller. The gym was scaled ×1.27 and shifted so its slab lands exactly on the locker's. Measure the slab and do the same for each new floor.
- Don't ask Gemini to pin the slab's position: when we tried, it added a smaller setback storey on top instead.

**Moving between floors (about 0.9 s):**
1. The old floor drops down and blurs.
2. A cloud bank about one and a half screens tall (`clouds.webp` twice, the second one mirrored) sweeps in from the top of the screen and out at the bottom. It covers the screen while the floors swap.
3. The new floor settles in from above.

The clouds hide the jump, so a floor only has to be one storey taller than the one below.

**Making them:**

```
GEMINI_API_KEY=… node tools/gen-city.mjs <gen-dir> sky clouds-a floor-0
GEMINI_API_KEY=… node tools/gen-city.mjs <gen-dir> floor-1      # needs floor-0 in <gen-dir>
python3 tools/cut-city.py <gen-dir> <out-dir>                    # keys the sky, writes the previews
```

**Still to touch up:**
- The gym's slab edge has a thin gold trim line.
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
