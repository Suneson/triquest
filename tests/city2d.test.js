// The delivery bike's and boat's timing (js/app/city2d.js truckAt).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { truckAt, TRUCK_AFTER, VEHICLES } from '../js/app/city2d.js';
import { deliveryEnds, deliveriesComing } from '../js/core/deliveries.js';

for (const kind of ['bike', 'boat']) {
  test(`the ${kind} comes in before a delivery ends, waits at its stop, then leaves`, () => {
    const after = 8 + VEHICLES[kind].outS;
    assert.equal(truckAt(-600, kind), null, 'not on screen long before');
    const arriving = truckAt(-2, kind);
    assert.ok(arriving && arriving.moving && !arriving.out, 'coming in just before the end');
    const parked = truckAt(1, kind);
    assert.ok(parked && !parked.moving, 'waiting just after');
    assert.deepEqual(truckAt(0, kind).p, VEHICLES[kind].stop, 'it stops at its stop');
    assert.deepEqual(truckAt(0, kind).p, truckAt(3, kind).p, 'and stays there');
    assert.ok(truckAt(after - 0.5, kind)?.out, 'leaving at the end');
    assert.equal(truckAt(after + 1, kind), null, 'gone after');
    assert.ok(after <= TRUCK_AFTER);
  });
}

test('the bike goes back the way it came; the boat carries on', () => {
  const { bike, boat } = VEHICLES;
  assert.deepEqual(bike.routeOut.at(-1), bike.routeIn[0]);
  assert.notDeepEqual(boat.routeOut.at(-1), boat.routeIn[0]);
  assert.deepEqual(boat.routeOut[0], boat.stop);
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
