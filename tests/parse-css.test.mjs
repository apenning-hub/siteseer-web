import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parseRootTokens, parseDeclarations } from '../scripts/lib/parse-css.mjs';

// Deliberately hostile: a @font-face above :root, a comment containing the word
// "red", two declarations on one line, a non-hex token, and a data: URL carrying
// braces, quotes and a # character. Every one of these is in the real stylesheet.
const SAMPLE = `
@font-face{ font-family:'Druk Wide Bold'; src:url('../fonts/DrukWideBold.ttf'); }
:root{
  /* Brand red. Passes AA only at large sizes — never use --red for body text. */
  --red:#e6332a; --red-deep:#c5271f;
  --ink:#15120f; --paper:#fbf9f5;
  --line:rgba(21,18,15,.10);
  --s1:4px; --s2:8px;
}
.grain::before{ background-image:url("data:image/svg+xml,%3Csvg%3E%3Cfilter id='n'%3E%3C/filter%3E%3C/svg%3E"); }
.band{ padding:96px 0; }
.wrap{ max-width:1200px; margin:0 auto; padding:0 48px; }
.pill{ padding:var(--s5); }
`;

test('parseRootTokens extracts every custom property in :root', () => {
  const tokens = parseRootTokens(SAMPLE);
  assert.equal(tokens['--red'], '#e6332a');
  assert.equal(tokens['--red-deep'], '#c5271f');
  assert.equal(tokens['--s1'], '4px');
  assert.equal(tokens['--s2'], '8px');
});

test('parseRootTokens returns non-hex tokens intact rather than dropping them', () => {
  // --line is the canary. It is NOT a hex colour and lives in the same block.
  // A parser that silently skipped it would turn hexToRgb's loud throw into a
  // missing check — the same false-pass shape the Task 1 sweep was built to catch.
  assert.equal(parseRootTokens(SAMPLE)['--line'], 'rgba(21,18,15,.10)');
});

test('parseRootTokens is not fooled by a comment mentioning a token', () => {
  const tokens = parseRootTokens(SAMPLE);
  assert.equal(Object.keys(tokens).length, 7);
  assert.ok(!Object.keys(tokens).some((k) => k.includes(' ')));
});

test('parseRootTokens ignores properties declared outside :root', () => {
  assert.deepEqual(parseRootTokens('.x{ --nope:#fff; }'), {});
});

test('parseDeclarations finds spacing declarations with their selector', () => {
  const values = parseDeclarations(SAMPLE, ['padding', 'margin']).map((d) => d.value);
  assert.ok(values.includes('96px 0'));
  assert.ok(values.includes('0 auto'));
  assert.ok(values.includes('var(--s5)'));
});

test('parseDeclarations survives a data: URL containing braces and a hash', () => {
  // The .grain rule sits between :root and .band. If the brace matcher trips on
  // the encoded SVG, everything after it is silently invisible to the checker.
  const selectors = parseDeclarations(SAMPLE, ['padding']).map((d) => d.selector);
  assert.ok(selectors.includes('.band'), 'rules after the data: URL were skipped');
  assert.ok(selectors.includes('.wrap'));
});

test('parseDeclarations skips the :root block', () => {
  const decls = parseDeclarations(SAMPLE, ['padding', 'margin']);
  assert.ok(decls.every((d) => d.selector !== ':root'));
});

test('parseDeclarations does not match longhand as shorthand', () => {
  assert.equal(parseDeclarations('.a{ max-width:100px; }', ['width']).length, 0);
});

test('it works on the real stylesheet, not just the fixture', () => {
  // A fixture proves the regex works. This proves it works on the file Task 3
  // will actually run against.
  const here = dirname(fileURLToPath(import.meta.url));
  const css = readFileSync(resolve(here, '../src/styles/global.css'), 'utf8');
  const tokens = parseRootTokens(css);
  assert.equal(tokens['--red'], '#e6332a');
  assert.equal(tokens['--ink'], '#15120f');
  assert.ok(parseDeclarations(css, ['padding']).length > 20);
});
