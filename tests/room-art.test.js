// The rooms' smaller item pictures (tools/make-room-items.py, js/core/room-art.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { ROOM_COPIES, roomCopy } from '../js/core/room-art.js';

test('every listed room copy exists, next to an original that exists', () => {
  assert.ok(ROOM_COPIES.size > 0);
  for (const src of ROOM_COPIES) {
    assert.ok(existsSync(src), `original ${src}`);
    assert.ok(existsSync(roomCopy(src)), `copy of ${src}`);
  }
});

test('a picture with no room copy is drawn as it is', () => {
  assert.equal(roomCopy('icons/Items/nothing-here.webp'), 'icons/Items/nothing-here.webp');
  const [one] = ROOM_COPIES;
  assert.equal(roomCopy(one), one.replace('icons/', 'icons/room-items/'));
});
