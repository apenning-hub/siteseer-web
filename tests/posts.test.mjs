import test from 'node:test';
import assert from 'node:assert/strict';
import { postsFor } from '../src/lib/posts-core.mjs';

const p = (id, audience, d, draft = false) => ({ id, data: { audience, pubDate: new Date(d), draft } });
const all = [
  p('a', ['education'], '2026-01-01'),
  p('b', ['industry'], '2026-03-01'),
  p('c', ['education', 'industry'], '2026-02-01'),
  p('d', ['education'], '2026-04-01', true),
];

test('keeps posts for this audience, newest first, without drafts', () => {
  assert.deepEqual(postsFor(all, 'education', { prod: true }).map((x) => x.id), ['c', 'a']);
  assert.deepEqual(postsFor(all, 'industry', { prod: true }).map((x) => x.id), ['b', 'c']);
});

test('drafts show in dev', () => {
  assert.deepEqual(postsFor(all, 'education', { prod: false }).map((x) => x.id), ['d', 'c', 'a']);
});
