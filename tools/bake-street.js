// bake-street.js — draws the city's sign and truck (models/city/*.glb) as flat pictures, from the
// city's own camera, for js/app/city2d.js.
//
// Run it in the browser's console on the app (node tools/serve.mjs, then open localhost:8744),
// with a small server on port 8745 that saves what's POSTed to it (?name=file). It saves sign.png,
// truck-in.png (facing up the screen), truck-out.png (facing down it) at 2 px per px of the city,
// and meta.json: each picture's size, where its foot on the ground is, and the sign's panel corners.
// Then trim each to its pixels, save as webp in icons/City/street/, and copy the sizes, feet (less
// the trim) and panel into SIGN_PIC, PANEL and TRUCK_PIC in city2d.js.

const L = await (await import('/js/app/runner3d.js')).loadThree();
const { THREE } = L;
const { SIGN_HEIGHT } = await import('/js/app/city2d.js');
const SLOPE = 0.489; const EL = Math.asin(SLOPE); const SIGMA = Math.SQRT2; const UP = Math.cos(EL) * SIGMA;
const R = 2;           // picture px per px of the city
const TRUCK_LEN = 150; // px along the road
const loader = new L.GLTFLoader(); loader.setMeshoptDecoder(L.MeshoptDecoder);
const load = (n) => new Promise((res, rej) => loader.load(`/models/city/${n}.glb`, (g) => res(g.scene), undefined, rej));
const canvas = document.createElement('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
renderer.setClearColor(0, 0); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping;
// the city's camera: orthographic, a ground edge falling SLOPE px per px across
const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 40000);
const D = 20000;
cam.position.set(D * Math.cos(EL) * Math.SQRT1_2, D * Math.sin(EL), D * Math.cos(EL) * Math.SQRT1_2);
cam.lookAt(0, 0, 0); cam.updateMatrixWorld();
const ground = ([wx, wy]) => ({ x: (wx + wy / SLOPE) / 2, z: (wy / SLOPE - wx) / 2 });
const size = (g) => new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3());
const toCam = (v) => v.clone().applyMatrix4(cam.matrixWorldInverse);

async function shoot(obj, name, extra = []) {
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0xa9c2ea, 2.1));
  const sun = new THREE.DirectionalLight(0xfff4e6, 1.6); sun.position.set(-3, 6, 2); scene.add(sun);
  scene.add(obj); obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj);
  let x0 = Infinity; let x1 = -Infinity; let y0 = Infinity; let y1 = -Infinity;
  for (const cx of [box.min.x, box.max.x]) for (const cy of [box.min.y, box.max.y]) for (const cz of [box.min.z, box.max.z]) {
    const p = toCam(new THREE.Vector3(cx, cy, cz));
    x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
  }
  const pad = 4 / SIGMA; x0 -= pad; x1 += pad; y0 -= pad; y1 += pad;
  const W = Math.ceil((x1 - x0) * SIGMA * R); const H = Math.ceil((y1 - y0) * SIGMA * R);
  x1 = x0 + W / SIGMA / R; y0 = y1 - H / SIGMA / R;
  cam.left = x0; cam.right = x1; cam.top = y1; cam.bottom = y0; cam.updateProjectionMatrix();
  renderer.setSize(W, H, false); renderer.render(scene, cam);
  const px = (v) => { const p = toCam(v); return [+((p.x - x0) * SIGMA).toFixed(2), +((y1 - p.y) * SIGMA).toFixed(2)]; };
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
  await fetch(`http://localhost:8745/?name=${name}.png`, { method: 'POST', body: blob });
  return { name, w: W / R, h: H / R, anchor: px(new THREE.Vector3(0, 0, 0)), extra: extra.map((v) => px(v)) };
}

const out = {};
// the sign: its panel facing out from the lobby (+X); its panel's corners, for the countdown
const sign = await load('sign');
{
  const s = size(sign); const k = SIGN_HEIGHT / UP / s.y;
  sign.scale.setScalar(k); sign.rotation.y = Math.PI / 2; sign.position.set(0, (s.y / 2) * k, 0);
  sign.updateMatrixWorld(true);
  const corners = [[-0.35, 0.175], [0.35, 0.175], [0.35, -0.175], [-0.35, -0.175]]
    .map(([x, y]) => new THREE.Vector3(x, s.y * 0.37 + y, s.z / 2 + 0.012).applyMatrix4(sign.matrixWorld));
  out.sign = await shoot(sign, 'sign', corners);
}
// the truck, facing up the screen (along −e1) and down it (along −e2); the model faces −X
const truck = await load('truck');
const ts = size(truck); const tk = TRUCK_LEN / ts.x; truck.scale.setScalar(tk);
for (const [name, dir] of [['truck-in', [-1, -SLOPE]], ['truck-out', [-1, SLOPE]]]) {
  const t = truck.clone(true);
  const d = ground(dir); t.rotation.y = Math.atan2(d.z, -d.x); t.position.set(0, (ts.y / 2) * tk, 0);
  out[name] = await shoot(t, name);
}
await fetch('http://localhost:8745/?name=meta.json', { method: 'POST', body: JSON.stringify(out, null, 1) });
console.log(out);
