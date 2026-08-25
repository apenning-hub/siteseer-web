import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hexToRgb,
  relativeLuminance,
  contrastRatio,
  blend,
  requiredRatio,
} from '../scripts/lib/contrast.mjs';

test('hexToRgb parses with and without a leading hash', () => {
  assert.deepEqual(hexToRgb('#e6332a'), [230, 51, 42]);
  assert.deepEqual(hexToRgb('e6332a'), [230, 51, 42]);
});

test('relativeLuminance hits the known endpoints', () => {
  assert.equal(relativeLuminance([0, 0, 0]), 0);
  assert.equal(relativeLuminance([255, 255, 255]), 1);
});

test('contrastRatio returns 21 for black on white', () => {
  assert.equal(Math.round(contrastRatio([0, 0, 0], [255, 255, 255])), 21);
});

test('contrastRatio returns 1 for a colour against itself', () => {
  assert.equal(contrastRatio([230, 51, 42], [230, 51, 42]), 1);
});

test('contrastRatio is order-independent', () => {
  const a = contrastRatio([230, 51, 42], [251, 249, 245]);
  const b = contrastRatio([251, 249, 245], [230, 51, 42]);
  assert.equal(a, b);
});

test('contrastRatio matches the audited value for brand red on paper', () => {
  const ratio = contrastRatio(hexToRgb('#e6332a'), hexToRgb('#fbf9f5'));
  assert.ok(Math.abs(ratio - 4.1) < 0.02, `expected ~4.10, got ${ratio}`);
});

test('blend composites a translucent foreground over a background', () => {
  assert.deepEqual(blend([255, 255, 255], [0, 0, 0], 0.5), [128, 128, 128]);
  assert.deepEqual(blend([255, 255, 255], [0, 0, 0], 1), [255, 255, 255]);
  assert.deepEqual(blend([255, 255, 255], [0, 0, 0], 0), [0, 0, 0]);
});

test('requiredRatio applies the WCAG large-text thresholds', () => {
  assert.equal(requiredRatio({ px: 16 }), 4.5);
  assert.equal(requiredRatio({ px: 24 }), 3);
  assert.equal(requiredRatio({ px: 19, bold: true }), 3);
  assert.equal(requiredRatio({ px: 18, bold: true }), 4.5);
});
