import test from 'node:test';
import assert from 'node:assert/strict';
import { createSequence } from '../src/scripts/hero/sequence.js';

const steps = [{ hold: 1000 }, {}, { hold: 3000 }];

test('walks the steps once with per-step holds', () => {
  const s = createSequence(steps, { hold: 2000 });
  assert.deepEqual(s.at(0), { step: 0, t: 0, done: false });
  assert.deepEqual(s.at(1500), { step: 1, t: 500, done: false });
  assert.deepEqual(s.at(3200), { step: 2, t: 200, done: false });
  assert.deepEqual(s.at(99999), { step: 2, t: 3000, done: true });
});

test('knows where each step starts and how long it holds', () => {
  const s = createSequence(steps, { hold: 2000 });
  assert.equal(s.startOf(2), 3000);
  assert.equal(s.holdOf(1), 2000);
});
