# 3D runner on the treadmill

Branch `feature/3d-runner`. A test of 3D characters in the compound. The rooms
and items stay painted art. The athlete is a rigged 3D model, so its kit can be
swapped later without repainting every pose.

## What's on screen

- **The treadmill** (`treadmill` in `js/core/placement.js`) is a 1 × 2 gift item.
  Every runner gets one, in the run room (`home: 'run'`, `needsRoom: 'run'`).
  It moves, stacks and saves like any other item.
- **The runner** is drawn into a transparent WebGL canvas inside the treadmill's
  item element. It pans, zooms and moves with the treadmill, and plays the
  model's *Running* clip on the belt, facing the console (down and to the left,
  towards you).
- **Turn left / Turn right** (run room, admins and `?demo=1` only) turn the
  runner 45° at a time. This is for checking the model from every side; the
  angle is remembered on the device (`moske-runner-yaw`).
- No WebGL, or the model fails to load: the treadmill simply stands empty.
  Reduced motion: one still frame, no loop.

## How it lines up with the painted floor (`js/app/runner3d.js`)

- **Camera.** Orthographic, so nothing grows with distance, like the art.
  - It looks from the floor's front corner, 45° round.
  - It's tilted down by `ISO_TILT = asin(34.8 / 61.9)`, the run room's tile
    rise over run, so a tile's edge comes out at the art's own slant.
- **Units.** One scene unit is one floor tile.
  - X runs along u (towards the right corner), Z along v (towards the left
    corner), Y is up.
  - The canvas is sized from the tile's on-screen size (`tile.ux`) and anchored
    on the footprint's centre. Zooming the stage scales it with everything else.
- **Placing the runner.** `RUNNER_SPOT` sets where the runner stands and how big
  it is: `u` across the belt, `v` along it, `y` the belt's height, and the
  scale. Tune it there.
- **Lighting:** ambient 1.5; a warm key (`#fff5e6`, 2.5) from the top left; a
  cool rim (`#6ea8ff`, 1.8) from the right rear.
- **Cost.**
  - three.js loads only when a runner is on screen.
  - It draws at 30 fps and pauses when the app is hidden.
  - On another tab it pauses and keeps everything, so HOME picks up
    mid-stride with no reload. It frees the GPU only when the treadmill leaves
    the room (another room shown, or the item moved away).

## The files

| File | What |
| --- | --- |
| `models/runner.glb` | The model: one skinned mesh, a 44-joint Mixamo-style rig, *Running* and *Walking* clips. |
| `vendor/three/` | three.js r170 (MIT), `GLTFLoader`, `BufferGeometryUtils` and the meshopt decoder. They're served from the app, not a CDN, so the app works offline. |
| `icons/Pixelart/NEW/ITEMS/treadmill.webp` | The treadmill, keyed from `src/treadmill.jpg` by `python3 tools/cut-treadmill.py`. |

**The model was optimised from the 17.5 MB export to 1.28 MB:**

```
npx @gltf-transform/cli optimize in.glb models/runner.glb \
  --simplify-ratio 0.5 --texture-compress webp --texture-size 1024 --compress meshopt
```

The steps:
- halve the triangles, to 85k vertices;
- shrink the textures to 1024 px WebP;
- compress the mesh with meshopt.

**Keying the treadmill.** The green-screen image had stray painted art under the
machine. `cut-treadmill.py` keys the green, and the green showing through gaps
in the frame. It keeps only the biggest connected shape (the treadmill), which
drops the stray art.

## Changing the kit later

The kit is the model's textures. Swap or retint them in a 3D tool, re-export,
and run the optimise command above. Several kits could also share one rig.

To make the model the default athlete beyond the treadmill:
1. Load the GLB once (`loadModel` already caches it).
2. Mount it anywhere with `mountRunner`.
