// The delivery truck's timing (js/app/city2d.js truckAt).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { truckAt, TRUCK_AFTER } from '../js/app/city2d.js';
import { deliveryEnds, deliveriesComing } from '../js/core/deliveries.js';

test('the truck drives in before a delivery ends, waits at the door, then leaves', () => {
  assert.equal(truckAt(-600), null, 'not on screen long before');
  const arriving = truckAt(-2);
  assert.ok(arriving && arriving.moving, 'driving in just before the end');
  const parked = truckAt(1);
  assert.ok(parked && !parked.moving, 'waiting at the door just after');
  assert.deepEqual(truckAt(0).p, truckAt(3).p, 'it stops where it arrives');
  assert.ok(truckAt(TRUCK_AFTER - 0.5)?.moving, 'driving off at the end');
  assert.equal(truckAt(TRUCK_AFTER + 1), null, 'gone after');
});

test('deliveries: the ones coming are listed soonest first; ends include ones just come', () => {
  const now = Date.parse('2026-11-02T12:00:00Z');
  const iso = (m) => new Date(now + m * 60e3).toISOString();
  const jobs = [
    { item_id: 'b', started_at: iso(-10), finishes_at: iso(30), state: 'queued' },
    { item_id: 'a', started_at: iso(-10), finishes_at: iso(5), state: 'queued' },
    { item_id: 'c', started_at: iso(-60), finishes_at: iso(-0.2), state: 'queued' },
    { item_id: 'd', started_at: iso(-60), finishes_at: iso(20), state: 'cancelled' },
  ];
  assert.deepEqual(deliveriesComing(jobs, now).map((j) => j.item_id), ['a', 'b']);
  assert.equal(deliveryEnds(jobs, now, 60e3).length, 3, 'the two coming and the one that came 12 s ago');
});
