import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parseRootTokens, parseDeclarations } from '../scripts/lib/parse-css.mjs';

// Deliberately hostile: a @font-face above :root, a comment containing the word
// "red", two declarations on one line, a non-hex token, and a data: URL whose
// percent-encoded SVG payload contains no literal braces or hash. Every one of
// these is in the real stylesheet.
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

test('parseRootTokens ignores a commented-out declaration', () => {
  // Without comment stripping the last match wins, so a commented-out value
  // silently REPLACES the live one and the checker measures a colour that is
  // not on the site. Task 4 rewrites :root and adds comments to it, so
  // "comment out the old value beside the new one" is a realistic edit.
  const css = ':root{ --red:#e6332a; /* was --red: #ff0000; */ }';
  assert.deepEqual(parseRootTokens(css), { '--red': '#e6332a' });
});

test('parseRootTokens ignores properties declared outside :root', () => {
  assert.deepEqual(parseRootTokens('.x{ --nope:#fff; }'), {});
});

test('parseRootTokens does not require a trailing semicolon', () => {
  // CSS makes it optional on the last declaration. Task 4 rewrites :root
  // wholesale; a dropped token is never checked and the report comes back clean.
  assert.deepEqual(parseRootTokens(':root{ --red:#e6332a; --ink:#15120f }'),
    { '--red': '#e6332a', '--ink': '#15120f' });
  assert.deepEqual(parseRootTokens(':root{ --red:#e6332a }'), { '--red': '#e6332a' });
});

test('parseRootTokens tolerates whitespace before the brace', () => {
  assert.deepEqual(parseRootTokens(':root {\n  --red: #e6332a;\n}'), { '--red': '#e6332a' });
});

test('parseRootTokens reads only the :root block, not the whole file', () => {
  // A mutant that scanned the whole file survived the old suite, because the
  // fixture had no :root block at all — it only proved "no :root, no tokens".
  const css = ':root{ --red:#e6332a; } .dark-panel{ --red:#000000; --panel:#111111; }';
  assert.deepEqual(parseRootTokens(css), { '--red': '#e6332a' });
});

test('parseDeclarations finds spacing declarations with their selector', () => {
  const values = parseDeclarations(SAMPLE, ['padding', 'margin']).map((d) => d.value);
  assert.ok(values.includes('96px 0'));
  assert.ok(values.includes('0 auto'));
  assert.ok(values.includes('var(--s5)'));
});

test('parseDeclarations survives a percent-encoded data: URL sitting between rules', () => {
  // The .grain rule sits between :root and .band. If the brace matcher trips on
  // the encoded SVG, everything after it is silently invisible to the checker.
  const selectors = parseDeclarations(SAMPLE, ['padding']).map((d) => d.selector);
  assert.ok(selectors.includes('.band'), 'rules after the data: URL were skipped');
  assert.ok(selectors.includes('.wrap'));
});

test('parseDeclarations survives a value containing literal braces and a hash', () => {
  const css = '.x{ content:"{}"; padding:8px; } .y{ color:#fff; margin:4px; }';
  const found = parseDeclarations(css, ['padding', 'margin']);
  assert.deepEqual(found.map((d) => `${d.selector}:${d.property}`), ['.x:padding', '.y:margin']);
});

test('parseDeclarations skips the :root block', () => {
  const decls = parseDeclarations(SAMPLE, ['padding', 'margin']);
  assert.ok(decls.every((d) => d.selector !== ':root'));
});

test('parseDeclarations does not match longhand as shorthand', () => {
  assert.equal(parseDeclarations('.a{ max-width:100px; }', ['width']).length, 0);
});

test('parseDeclarations exposes @keyframes steps with their prelude as atRule', () => {
  // Documented, not endorsed: `from`/`to` surface as bare selectors, but with
  // the depth-aware walk both steps are now visible (the old regex scan lost
  // `from` entirely). If a checker ever reports a violation against a
  // selector named `from` or `to`, this is why — check `atRule` too.
  const css = '@keyframes rise{ from{ margin-top:18px; } to{ margin-top:0; } }';
  const found = parseDeclarations(css, ['margin']);
  assert.deepEqual(found.map((d) => d.selector), ['from', 'to']);
  assert.ok(found.every((d) => d.atRule === '@keyframes rise'));
});

test('parseDeclarations sees the first rule inside an at-block', () => {
  // The regex scan discarded it. Whether a declaration was checked depended on
  // its position in the block — and Task 6 rewrites the mobile media query.
  const css = '@media (max-width:880px){ .hero{ padding:0 24px; } .wrap{ padding:0 16px; } }';
  const found = parseDeclarations(css, ['padding']);
  assert.deepEqual(found.map((d) => d.selector), ['.hero', '.wrap']);
  assert.equal(found[0].atRule, '@media (max-width:880px)');
});

test('parseDeclarations descends into @supports but not @font-face', () => {
  assert.equal(parseDeclarations('@supports (display:grid){ .g{ padding:9px; } }', ['padding']).length, 1);
  assert.equal(parseDeclarations("@font-face{ font-family:'X'; src:url('x.ttf'); }", ['src']).length, 0);
});

test('parseDeclarations returns every matching declaration in a rule', () => {
  // A `break`-after-first mutant survived: the real-file assertion was only
  // `> 20`, which cannot detect losing five of twenty-six.
  const found = parseDeclarations('.hero{ padding-top:70px; padding-bottom:0; }', ['padding']);
  assert.equal(found.length, 2);
  assert.deepEqual(found.map((d) => d.property), ['padding-top', 'padding-bottom']);
});

test('parseDeclarations strips comments before reading selectors', () => {
  // Untested stripping here corrupted 10 real selectors into
  // '/* ===== buttons ===== */ .btn' — counts right, selectors unusable.
  const css = '/* ===== buttons ===== */\n.btn{ padding:13px 22px; }';
  assert.equal(parseDeclarations(css, ['padding'])[0].selector, '.btn');
});

test('parseRootTokens is not derailed by an at-statement before :root', () => {
  // global.css line 1 is @import url(...). The prelude spans everything since
  // the last close brace, so the @import was being glued onto the next rule's
  // selector and that rule silently vanished. Task 3 would have seen {} and
  // reported a clean sweep having checked nothing.
  assert.deepEqual(parseRootTokens("@import url('x.css');\n:root{ --red:#e6332a; }"),
    { '--red': '#e6332a' });
});

test('an unterminated block does not fabricate a truncated value', () => {
  // Regression guard: slicing j-1 assumed a closing brace was there to trim.
  assert.deepEqual(parseDeclarations('.a{ padding:8px', ['padding']).map((d) => d.value), ['8px']);
  assert.deepEqual(parseRootTokens(':root{ --red:#e6332a'), { '--red': '#e6332a' });
});

test('a later declaration of a token wins, as the cascade requires', () => {
  // A first-wins mutant passes the whole suite. It would report a colour that
  // is not on the site, straight into hexToRgb.
  assert.deepEqual(parseRootTokens(':root{ --red:#ff0000; --red:#e6332a; }'), { '--red': '#e6332a' });
});

test('parseDeclarations ignores spacing declared inside :root', () => {
  // The :root guard is currently vacuous — the fixture's :root declares nothing
  // the property filter would match, so removing the guard is undetectable.
  assert.deepEqual(parseDeclarations(':root{ padding:0; --red:#e6332a; }', ['padding']), []);
});

test('parseDeclarations handles a minified rule', () => {
  // No fixture omits whitespace before the closing brace, leaving the whole
  // off-by-one region around it unpinned.
  const found = parseDeclarations('.a{padding:8px}.b{margin:4px}', ['padding', 'margin']);
  assert.deepEqual(found.map((d) => [d.selector, d.value]), [['.a', '8px'], ['.b', '4px']]);
});

test('atRule is null, not undefined, for a top-level rule', () => {
  // The JSDoc promises null. Task 5 branching on === null would mis-branch on
  // undefined, and nothing currently asserts which it is.
  assert.strictEqual(parseDeclarations('.a{ padding:8px; }', ['padding'])[0].atRule, null);
});

test('KNOWN LIMITATION: an unbalanced brace inside a string desynchronises the walk', () => {
  // Documented, not endorsed. Fixing it needs string-aware tokenisation, which
  // is more parser than this file should be. No such value exists in the real
  // stylesheet; if one is ever added, rules after it go silently missing.
  const css = '.x{ content:"{"; padding:8px; } .y{ margin:4px; }';
  assert.deepEqual(parseDeclarations(css, ['padding', 'margin']).map((d) => d.selector), ['.x']);
});

test('parseRootTokens refuses a second palette rather than guessing', () => {
  // Taking the top-level :root leaves a dark palette unchecked; taking the last
  // one measures a pairing that never renders. Both are confident wrong answers.
  const css = ':root{ --red:#e6332a; }\n@media (prefers-color-scheme:dark){ :root{ --red:#ff8a80; } }';
  assert.throws(() => parseRootTokens(css), /declared inside "@media/);
});

test('parseRootTokens reads a minified :root', () => {
  // Asymmetric coverage: the minified test added last round only exercised
  // parseDeclarations, so the equivalent path here was unpinned.
  assert.deepEqual(parseRootTokens(':root{--red:#e6332a}'), { '--red': '#e6332a' });
});

test('parseDeclarations reports a selector containing a semicolon, mangled but present', () => {
  // Known trade: splitting the prelude on ';' truncates an attribute-selector
  // string. The declaration is still found with the right property and value —
  // only the selector text is wrong, which is visible in a report. The
  // alternative was a rule vanishing entirely, which is not.
  const found = parseDeclarations('a[title="x;y"]{ padding:8px; }', ['padding']);
  assert.equal(found.length, 1);
  assert.equal(found[0].value, '8px');
});

test('it works on the real stylesheet, not just the fixture', () => {
  // A fixture proves the walk works. This proves it works on the file Task 3
  // will actually run against. The exact count matters: a loose `> N`
  // threshold let a `break`-after-first-match mutant survive undetected.
  //
  // Still 26, not more: the depth-aware walk now correctly sees the one rule
  // the old regex scan discarded in this file (`.navlinks{ display:none; }`,
  // the first rule inside the sole @media block) — but that rule doesn't
  // declare padding, so this particular count is unchanged. The defect was
  // real regardless (`.navlinks` was invisible to every checker, not just
  // this one), and Task 6 rewrites this exact block, so the fix still
  // matters even though this assertion can't show it.
  const here = dirname(fileURLToPath(import.meta.url));
  const css = readFileSync(resolve(here, '../src/styles/global.css'), 'utf8');
  const tokens = parseRootTokens(css);
  assert.equal(Object.keys(tokens).length, 7);
  assert.equal(tokens['--red'], '#e6332a');
  assert.equal(tokens['--ink'], '#15120f');
  assert.equal(parseDeclarations(css, ['padding']).length, 26);
});
