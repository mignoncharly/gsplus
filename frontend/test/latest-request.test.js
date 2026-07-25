import assert from 'node:assert/strict';
import test from 'node:test';

import { createLatestRequestGate } from '../src/lib/latest-request.js';

test('invalidates a pending slot verification when booking mode changes', () => {
  const gate = createLatestRequestGate();
  const calendarRequest = gate.begin();

  gate.invalidate();

  assert.equal(gate.isCurrent(calendarRequest), false);
});

test('only the newest slot verification may update booking state', () => {
  const gate = createLatestRequestGate();
  const firstRequest = gate.begin();
  const secondRequest = gate.begin();

  assert.equal(gate.isCurrent(firstRequest), false);
  assert.equal(gate.isCurrent(secondRequest), true);
});
