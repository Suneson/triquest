// The single-room stage (js/core/diorama.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { ENV, MAX_ZOOM, STAGE_ROOMS, stageGeom, roomPlacement, roomPctToWorld, worldToRoomPct, minZoom, clampView, homeView } from '../js/core/diorama.js';
import { ROOM_GEOMETRY, ROOM_SIZE } from '../js/core/placement.js';

test('the terrain exists and every room has art geometry', () => {
  assert.ok(existsSync(ENV.src));
  assert.ok(existsSync('icons/Pixelart/NEW/stamina-bolt.png'));
  for (const r of STAGE_ROOMS) assert.ok(ROOM_GEOMETRY[stageGeom(r)], r);
});

test('each room stands centred in the plot, unskewed, inside the terrain', () => {
  for (const r of STAGE_ROOMS) {
    const g = stageGeom(r);
    const [s, b, c, d] = roomPlacement(g);
    assert.equal(b, 0); assert.equal(c, 0); assert.equal(s, d, 'uniform scale');
    const G = ROOM_GEOMETRY[g];
    const [mx, my] = roomPctToWorld(g, (G.right[0] + G.left[0]) / 2, (G.right[1] + G.left[1]) / 2);
    assert.ok(Math.abs(mx - 428) < 1 && Math.abs(my - 730) < 1, `${r} floor centred on the plot`);
    const [x0, y0] = roomPctToWorld(g, 0, 0); const [x1, y1] = roomPctToWorld(g, 100, 100);
    assert.ok(x0 >= 0 && y0 >= 0 && x1 <= ENV.w && y1 <= ENV.h, `${r} inside the terrain`);
    const back = worldToRoomPct(g, ...roomPctToWorld(g, 30, 70));
    assert.ok(Math.abs(back.x - 30) < 1e-9 && Math.abs(back.y - 70) < 1e-9);
    assert.ok(ROOM_SIZE[g]);
  }
});

test('zoom and pan never show past the terrain', () => {
  for (const [vw, vh] of [[390, 640], [320, 560], [430, 700], [800, 600]]) {
    const lo = minZoom(vw, vh);
    assert.ok(ENV.w * lo >= vw - 1e-9 && ENV.h * lo >= vh - 1e-9, 'the smallest zoom covers the viewport');
    const tooFar = clampView({ s: lo / 3, tx: 500, ty: 500 }, vw, vh);
    assert.equal(tooFar.s, lo);
    assert.ok(tooFar.tx <= 0 && tooFar.ty <= 0);
    assert.ok(tooFar.tx + ENV.w * tooFar.s >= vw - 1e-9 && tooFar.ty + ENV.h * tooFar.s >= vh - 1e-9);
    assert.equal(clampView({ s: lo * 10, tx: 0, ty: 0 }, vw, vh).s, lo * MAX_ZOOM);
    const h = homeView(vw, vh);
    assert.equal(h.s, lo);
  }
});
