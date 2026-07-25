import test from 'node:test';
import assert from 'node:assert/strict';
import { createScrollPositionStore } from '../src/lib/scroll-restoration.js';

test('forward navigation always targets the top', () => {
  const store = createScrollPositionStore();
  store.save('destination', { x: 12, y: 900 });

  assert.deepEqual(store.target('destination', 'PUSH'), { x: 0, y: 0 });
  assert.deepEqual(store.target('destination', 'REPLACE'), { x: 0, y: 0 });
});

test('history navigation restores the saved position for its location key', () => {
  const store = createScrollPositionStore();
  store.save('home-key', { x: 0, y: 1240 });

  assert.deepEqual(store.target('home-key', 'POP'), { x: 0, y: 1240 });
  assert.deepEqual(store.target('unknown-key', 'POP'), { x: 0, y: 0 });
});

test('invalid coordinates are normalized safely', () => {
  const store = createScrollPositionStore();
  store.save('key', { x: Number.NaN, y: undefined });

  assert.deepEqual(store.target('key', 'POP'), { x: 0, y: 0 });
});
