// bike-rider.js: the athlete pedalling a bike, in 3D (the bike fit editor, js/app/bike-fit.js).
//
// The bike (models/bikes/bike-lv<N>.glb, tools/export-bike.py) stands still; only its `crank` turns,
// with the pedals turned back so they stay level. The rider is a wardrobe character (char3d.js)
// with no clip playing: each frame it goes back to its rest pose and is posed from the fit
// (js/core/bike-fit.js): hips on the saddle, the back leant forward, the hands on the brake hoods
// and the feet on the pedals by two-bone IK, the fingers closed round the bar.

import { loadGltf } from './char3d.js';
import { DEFAULT_POSE } from '../core/bike-fit.js';

const D2R = Math.PI / 180;

/** A bike, ready to turn: { root, crank, pedals: [right, left], marks: { saddle, hoodL, hoodR }, spin(angle) }. */
export async function loadBike(L, level) {
  const gltf = await loadGltf(L, `models/bikes/bike-lv${level}.glb`);
  const root = gltf.scene.clone(true);
  const get = (n) => root.getObjectByName(n);
  const crank = get('crank'), pedals = [get('pedalR'), get('pedalL')];
  root.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.roughness = 0.6; o.material.metalness = 0; } });
  return {
    root, crank, pedals,
    marks: { saddle: get('saddle'), hoodL: get('hoodL'), hoodR: get('hoodR') },
    /** Turn the cranks to `a` radians (forward, the top pedal moving towards the front). */
    spin(a) { crank.rotation.x = a; for (const p of pedals) p.rotation.x = -a; },
  };
}

/** Bones by their Mixamo name without the prefix ("Hips", "LeftForeArm"...), and their rest pose. */
function rig(root) {
  if (root.userData.bikeRig) return root.userData.bikeRig;
  const bones = {};
  root.traverse((o) => { if (o.isBone) bones[o.name.replace(/^mixamorig:?/, '')] = o; });
  const rest = Object.values(bones).map((b) => [b, b.quaternion.clone(), b.position.clone()]);
  return (root.userData.bikeRig = { bones, rest, base: root.position.clone() });
}

/**
 * Pose the figure `root` on `bike` from the fit `p` (DEFAULT_POSE's keys). Call after the bike has
 * turned (spin) and its matrices are up to date.
 */
export function poseRider(THREE, root, bike, p = DEFAULT_POSE) {
  p = { ...DEFAULT_POSE, ...p };
  const { bones: B, rest, base } = rig(root);
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const wp = (o) => o.getWorldPosition(V());
  const q0 = new THREE.Quaternion(), q1 = new THREE.Quaternion();
  // turn `bone` so the point `from` (world, moved with it) heads for `to`
  const aim = (bone, from, to) => {
    const at = wp(bone);
    const a = from.clone().sub(at).normalize(), b = to.clone().sub(at).normalize();
    if (a.lengthSq() < 1e-8 || b.lengthSq() < 1e-8) return;
    const turn = new THREE.Quaternion().setFromUnitVectors(a, b);
    bone.getWorldQuaternion(q0); bone.parent.getWorldQuaternion(q1);
    bone.quaternion.copy(q1.invert().multiply(turn.multiply(q0)));
    bone.updateMatrixWorld(true);
  };
  // turn `bone` so its own length (+Y) points along `dir` (world)
  const aimDir = (bone, dir) => {
    bone.getWorldQuaternion(q0);
    aim(bone, wp(bone).add(V(0, 1, 0).applyQuaternion(q0)), wp(bone).add(dir));
  };
  // upper -> lower -> end reaching `target`, the middle joint bending towards `hint`
  const reach = (upper, lower, end, target, hint) => {
    const A = wp(upper), la = A.distanceTo(wp(lower)), lb = wp(lower).distanceTo(wp(end));
    const dir = target.clone().sub(A); let d = dir.length(); dir.normalize();
    d = Math.min(Math.max(d, Math.abs(la - lb) * 1.01), (la + lb) * 0.999);
    const bend = hint.clone().sub(dir.clone().multiplyScalar(hint.dot(dir))).normalize();
    const c = (la * la + d * d - lb * lb) / (2 * la * d), s = Math.sqrt(Math.max(0, 1 - c * c));
    aim(upper, wp(lower), A.clone().add(dir.clone().multiplyScalar(la * c)).add(bend.multiplyScalar(la * s)));
    aim(lower, wp(end), A.clone().add(dir.multiplyScalar(d)));
  };

  // back to the rest pose, then the hips onto the saddle
  for (const [b, q, pos] of rest) { b.quaternion.copy(q); b.position.copy(pos); }
  root.position.copy(base); root.updateMatrixWorld(true);
  bike.root.updateMatrixWorld(true);
  const seat = wp(bike.marks.saddle).add(V(0, p.seatU, p.seatF));
  root.position.add(seat.sub(wp(B.Hips))); root.updateMatrixWorld(true);

  // the back, the neck and the head
  const lean = p.lean * D2R;
  aimDir(B.Spine, V(0, Math.cos(lean), Math.sin(lean)));
  const look = (p.lean - p.headUp) * D2R;
  if (B.Neck) aimDir(B.Neck, V(0, Math.cos((lean + look) / 2), Math.sin((lean + look) / 2)));
  if (B.Head) aimDir(B.Head, V(0, Math.cos(look), Math.sin(look)));

  for (const [side, sx] of [['Left', 1], ['Right', -1]]) {
    // the shoulder: drop the top of the arm and roll it forward
    const sh = B[`${side}Shoulder`], arm = B[`${side}Arm`], fore = B[`${side}ForeArm`], hand = B[`${side}Hand`];
    if (sh) aim(sh, wp(arm), wp(arm).add(V(0, -p.shDown, p.shFwd)));
    // the hand on the hood (the rider's left hand on the left hood, at +X)
    const hood = wp(sx > 0 ? bike.marks.hoodL : bike.marks.hoodR).add(V(sx * p.handW, p.handU, p.handF));
    reach(arm, fore, hand, hood, V(sx * p.elbowOut, -p.elbowDown, -0.6));
    // the wrist straight on from the forearm, then turned by hand
    hand.quaternion.copy(rest.find(([b]) => b === hand)[1]);
    hand.rotateX(p.wristB * D2R); hand.rotateY(sx * p.wristT * D2R); hand.rotateZ(sx * p.wristS * D2R);
    hand.updateMatrixWorld(true);
    // the fingers closed round the bar: each joint bends about its own X
    for (const f of ['Index', 'Middle', 'Ring', 'Pinky']) {
      for (let j = 1; j <= 3; j++) { const b = B[`${side}Hand${f}${j}`]; if (b) b.rotateX(p.grip * (j === 1 ? 70 : 85) * D2R); }
    }
    for (let j = 1; j <= 3; j++) { const b = B[`${side}HandThumb${j}`]; if (b) b.rotateX(p.thumb * (j === 1 ? 20 : 45) * D2R); }
    hand.updateMatrixWorld(true);

    // the foot on the pedal (the left foot on the left pedal, at +X)
    const ped = wp(sx > 0 ? bike.pedals[1] : bike.pedals[0]);
    const up = B[`${side}UpLeg`], leg = B[`${side}Leg`], foot = B[`${side}Foot`], toe = B[`${side}ToeBase`];
    reach(up, leg, foot, ped.clone().add(V(0, p.footU, p.footF)), V(sx * p.kneeOut, 0.3, 1));
    if (toe) aim(foot, wp(toe), ped.clone().add(V(0, -p.toeU, 0.04)));
  }
  root.updateMatrixWorld(true);
}
