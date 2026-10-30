# three.js r170 (vendored)

three.js 0.170.0 (MIT, see LICENSE), shipped with the app so the 3D runner
works offline like everything else, with no CDN. Loaded only when a 3D scene is
on screen (js/app/runner3d.js).

- `three.module.min.js`: `build/three.module.min.js`
- `GLTFLoader.js`, `BufferGeometryUtils.js`: from `examples/jsm/`, with their
  `'three'` import pointed at `./three.module.min.js` (no import map needed)
- `meshopt_decoder.module.js`: from `examples/jsm/libs/`, for the
  meshopt-compressed models in `models/`

To update: `npm pack three@<version>`, copy the same files, and repeat the
two import rewrites.
