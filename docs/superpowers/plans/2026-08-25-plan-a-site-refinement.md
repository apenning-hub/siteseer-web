# Plan A — Site refinement, contrast and accessibility

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the existing SiteSeer Astro site to WCAG 2.2 AA, replace all hover motion with a cursor-tracking spotlight, rewire entrance animations to fire on scroll, and snap every spacing value onto a nine-step token scale.

**Architecture:** Three sequenced passes over a single `global.css` (tokens/spacing → accessibility → motion), each gated by an automated check that fails before the change and passes after. Two new check scripts (`scripts/check-contrast.mjs`, `scripts/check-spacing.mjs`) are built first so the rest of the plan has something to verify against. Three small browser modules are added under `src/scripts/`; this is the first JavaScript the site has ever shipped.

**Tech Stack:** Astro 5.6, vanilla CSS with custom properties, vanilla ES modules, Node 25 built-in test runner (`node:test`), `@axe-core/cli` via `npx`.

**Spec:** `docs/superpowers/specs/2026-08-25-siteseer-web-refinement-design.md` §3, §4, §5, §6, §11

---

## File Structure

| File | Responsibility | Status |
|---|---|---|
| `scripts/lib/contrast.mjs` | Pure WCAG colour maths — hex parsing, luminance, ratio, alpha blend, required-ratio lookup. No I/O. | Create |
| `scripts/lib/parse-css.mjs` | Reads `global.css` and extracts `:root` custom properties and declaration blocks. Shared by both checkers. | Create |
| `scripts/check-contrast.mjs` | Declares every text/background pair on the site and asserts each meets its AA threshold. Reads colours from `global.css`, so it cannot pass by hardcoding. | Create |
| `scripts/check-spacing.mjs` | Asserts every `padding`/`margin`/`gap` value in `global.css` is `0`, `auto`, a `var(--sN)` token, or an explicitly allowlisted hairline. | Create |
| `tests/contrast.test.mjs` | Unit tests for the colour maths. | Create |
| `tests/parse-css.test.mjs` | Unit tests for the CSS parser. | Create |
| `src/styles/global.css` | The whole design system. Every pass touches it. | Modify |
| `src/scripts/motion.js` | Scroll-triggered reveals, cursor spotlight, marquee pause/play. All motion concerns. | Create |
| `src/scripts/nav.js` | Mobile navigation disclosure. Not motion — separate responsibility, separate file. | Create |
| `src/layouts/Base.astro` | Adds `.js` class script, skip link, `<main>` landmark, module imports. | Modify |
| `src/components/Nav.astro` | Adds the disclosure button and panel wiring. | Modify |
| `src/pages/index.astro` | Heading levels, `aria-hidden` glyphs, alt text, marquee toggle button. | Modify |
| `src/pages/blog/[...slug].astro` | Wraps `.post` in `.wrap` to fix the mobile gutter bug. | Modify |
| `package.json` | Adds `test`, `check:contrast`, `check:spacing`, `check:a11y` scripts. | Modify |

---

## Task 1: Colour maths library

**Files:**
- Create: `scripts/lib/contrast.mjs`
- Test: `tests/contrast.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: Add the test script to package.json**

Replace the `"scripts"` block in `package.json` with:

```json
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "check": "astro check",
    "test": "node --test \"tests/**/*.test.mjs\""
  },
```

> Node 25.8.2 does not recurse into a bare directory: `node --test tests/` treats
> `tests` as a single test file and fails. The glob form keeps the same scoping and
> is verified working. Every later task invokes `npm test`, so nothing downstream
> depends on the bare-directory form.

- [ ] **Step 2: Write the failing test**

Create `tests/contrast.test.mjs`:

```js
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
  // Endpoints do not constrain the coefficients — a mid-tone does.
  assert.ok(Math.abs(relativeLuminance([128, 128, 128]) - 0.2159) < 0.0005);
});

test('hexToRgb rejects anything that is not a 6-digit hex', () => {
  // Task 3 feeds raw :root token strings straight into hexToRgb. If this
  // throw ever became a silent [0,0,0], an unparseable token would score
  // ~19:1 against --paper — a fabricated pass on the check the whole
  // accessibility effort is gated on.
  assert.throws(() => hexToRgb('rgba(21,18,15,.10)'), /6-digit hex/);
  assert.throws(() => hexToRgb('#fff'), /6-digit hex/);
  assert.throws(() => hexToRgb(''), /6-digit hex/);
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
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '.../scripts/lib/contrast.mjs'`

- [ ] **Step 4: Write the implementation**

Create `scripts/lib/contrast.mjs`:

```js
/**
 * WCAG 2.2 colour maths. Pure functions, no I/O.
 * Formulae: https://www.w3.org/TR/WCAG22/#dfn-relative-luminance
 */

export function hexToRgb(hex) {
  const h = String(hex).replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(h)) {
    throw new Error(`Not a 6-digit hex colour: ${hex}`);
  }
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
}

function srgbToLinear(channel) {
  const s = channel / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance([r, g, b]) {
  return (
    0.2126 * srgbToLinear(r) +
    0.7152 * srgbToLinear(g) +
    0.0722 * srgbToLinear(b)
  );
}

export function contrastRatio(fg, bg) {
  const a = relativeLuminance(fg);
  const b = relativeLuminance(bg);
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  return (hi + 0.05) / (lo + 0.05);
}

/** Composite a translucent foreground over an opaque background. */
export function blend(fg, bg, alpha) {
  return fg.map((c, i) => Math.round(c * alpha + bg[i] * (1 - alpha)));
}

/**
 * AA threshold for a given text size. "Large" is >=24px, or >=18.66px bold.
 */
export function requiredRatio({ px, bold = false }) {
  const large = px >= 24 || (bold && px >= 18.66);
  return large ? 3 : 4.5;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — 9 tests, 0 failures

- [ ] **Step 6: Commit**

```bash
git add package.json scripts/lib/contrast.mjs tests/contrast.test.mjs
git commit -m "test: add WCAG contrast maths library"
```

---

## Task 2: CSS token parser

**Files:**
- Create: `scripts/lib/parse-css.mjs`
- Test: `tests/parse-css.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `tests/parse-css.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRootTokens, parseDeclarations } from '../scripts/lib/parse-css.mjs';

const SAMPLE = `
:root{
  --red:#e6332a; --red-deep:#c5271f;
  --s1:4px; --s2:8px;
}
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

test('parseRootTokens ignores properties declared outside :root', () => {
  const tokens = parseRootTokens('.x{ --nope:#fff; }');
  assert.deepEqual(tokens, {});
});

test('parseDeclarations finds spacing declarations with their selector', () => {
  const decls = parseDeclarations(SAMPLE, ['padding', 'margin']);
  const values = decls.map((d) => d.value);
  assert.ok(values.includes('96px 0'));
  assert.ok(values.includes('0 auto'));
  assert.ok(values.includes('var(--s5)'));
});

test('parseDeclarations skips the :root block', () => {
  const decls = parseDeclarations(SAMPLE, ['padding', 'margin']);
  assert.ok(decls.every((d) => d.selector !== ':root'));
});

test('parseDeclarations does not match longhand as shorthand', () => {
  const decls = parseDeclarations('.a{ max-width:100px; }', ['width']);
  assert.equal(decls.length, 0);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '.../scripts/lib/parse-css.mjs'`

- [ ] **Step 3: Write the implementation**

Create `scripts/lib/parse-css.mjs`:

```js
/**
 * Deliberately small, regex-based CSS reader. It only needs to handle the
 * shape of src/styles/global.css — a flat stylesheet with no nesting beyond
 * @media blocks. It is not a general CSS parser and should not become one.
 */

/** Strip /* ... *​/ comments so they can't produce phantom matches. */
function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Returns { '--token': 'value' } for every custom property declared in :root. */
export function parseRootTokens(css) {
  const src = stripComments(css);
  const tokens = {};
  const rootBlocks = src.matchAll(/:root\s*\{([^}]*)\}/g);
  for (const [, body] of rootBlocks) {
    for (const [, name, value] of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+)\s*;/g)) {
      tokens[name] = value.trim();
    }
  }
  return tokens;
}

/**
 * Returns [{ selector, property, value }] for declarations whose property is
 * in `properties` (shorthand or longhand, e.g. 'padding' matches
 * 'padding-top'). The :root block is skipped.
 */
export function parseDeclarations(css, properties) {
  const src = stripComments(css);
  const out = [];
  for (const [, selector, body] of src.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const sel = selector.trim().replace(/\s+/g, ' ');
    if (sel === ':root' || sel.startsWith('@')) continue;
    for (const [, property, value] of body.matchAll(/([a-z-]+)\s*:\s*([^;]+)\s*;?/g)) {
      const prop = property.trim();
      const matches = properties.some(
        (p) => prop === p || prop.startsWith(`${p}-`)
      );
      if (matches) out.push({ selector: sel, property: prop, value: value.trim() });
    }
  }
  return out;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — 14 tests total, 0 failures

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/parse-css.mjs tests/parse-css.test.mjs
git commit -m "test: add a minimal CSS token parser for the check scripts"
```

---

## Task 3: Contrast checker — make it fail

This task deliberately ends **red**. The checker is the failing test for Task 4.

**Files:**
- Create: `scripts/check-contrast.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write the checker**

Create `scripts/check-contrast.mjs`:

```js
#!/usr/bin/env node
/**
 * Asserts every text/background pair on the site meets its WCAG 2.2 AA
 * threshold. Colours are read from src/styles/global.css, so this cannot be
 * satisfied by editing the checker — only by editing the stylesheet.
 *
 * Run: npm run check:contrast
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { hexToRgb, contrastRatio, blend, requiredRatio } from './lib/contrast.mjs';
import { parseRootTokens } from './lib/parse-css.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const cssPath = resolve(here, '../src/styles/global.css');
const tokens = parseRootTokens(readFileSync(cssPath, 'utf8'));

function token(name) {
  const value = tokens[name];
  if (!value) throw new Error(`Token ${name} is not declared in :root`);
  return hexToRgb(value);
}

const WHITE = [255, 255, 255];

/**
 * Each pair: what it is, the foreground, the background, the rendered size.
 * `alpha` composites a translucent foreground over the background first.
 */
const PAIRS = [
  // --- on paper ---
  { name: '.eyebrow',            fg: '--red-deep', bg: '--paper', px: 11.5, bold: true },
  { name: '.prose a',            fg: '--red-deep', bg: '--paper', px: 16.5 },
  { name: '.stext',              fg: '--muted',    bg: '--paper', px: 16 },
  { name: '.pill p',             fg: '--muted',    bg: '--paper', px: 14.5 },
  { name: '.pc-desc',            fg: '--muted',    bg: '--paper', px: 14 },
  { name: '.pc-meta',            fg: '--muted',    bg: '--paper', px: 12.5 },
  { name: '.post .lede',         fg: '--muted',    bg: '--paper', px: 19 },
  { name: '.prose body text',    fg: '--prose-ink', bg: '--paper', px: 16.5 },
  { name: '.navlinks a',         fg: '--ink',      bg: '--paper', px: 14, alpha: 0.62 },

  // --- on white cards ---
  { name: '.btn-onred label',    fg: '--red-deep', bg: '--white', px: 14, bold: true },
  { name: '.chip',               fg: '--ink',      bg: '--white', px: 13.5, bold: true },

  // --- white on solid red button ---
  { name: '.btn-red label',      fg: '--white',    bg: '--red-deep', px: 14, bold: true },

  // --- on the red band: check the LIGHTEST gradient stop, the worst case ---
  { name: '.lead on band',       fg: '--white', bg: '--band-red-light', px: 18.5, alpha: 0.94 },
  { name: '.stext on band',      fg: '--white', bg: '--band-red-light', px: 16, alpha: 0.90 },
  { name: '.proof on band',      fg: '--white', bg: '--band-red-light', px: 12.5, alpha: 0.82 },
  { name: '.h1 on band',         fg: '--white', bg: '--band-red-light', px: 44 },

  // --- on ink ---
  { name: '.stext on ink',       fg: '--white', bg: '--ink', px: 16, alpha: 0.90 },
  { name: '.statc .cap',         fg: '--white', bg: '--ink', px: 12, alpha: 0.65 },
  { name: '.credits',            fg: '--white', bg: '--ink', px: 13, alpha: 0.60 },
  { name: '.fpartners',          fg: '--white', bg: '--ink', px: 13, alpha: 0.80 },
];

let failures = 0;
console.log('WCAG 2.2 AA contrast check\n');
console.log('  element                    ratio   needs   result');
console.log('  ' + '-'.repeat(52));

for (const pair of PAIRS) {
  const bg = pair.bg === '--white' ? WHITE : token(pair.bg);
  let fg = pair.fg === '--white' ? WHITE : token(pair.fg);
  if (pair.alpha != null) fg = blend(fg, bg, pair.alpha);

  const ratio = contrastRatio(fg, bg);
  const needs = requiredRatio(pair);
  const ok = ratio >= needs;
  if (!ok) failures += 1;

  console.log(
    `  ${pair.name.padEnd(26)} ${ratio.toFixed(2).padStart(5)}   ${needs.toFixed(1).padStart(5)}   ${ok ? 'pass' : 'FAIL'}`
  );
}

console.log('');
if (failures > 0) {
  console.error(`${failures} contrast failure(s). See spec §4.`);
  process.exit(1);
}
console.log('All pairs pass AA.');
```

- [ ] **Step 2: Add the script to package.json**

Add to `"scripts"`:

```json
    "check:contrast": "node scripts/check-contrast.mjs",
```

- [ ] **Step 3: Run it and confirm it fails for the right reasons**

Run: `npm run check:contrast`
Expected: FAIL. It will first throw `Token --prose-ink is not declared in :root` — the tokens `--prose-ink`, `--band-red-light` do not exist yet. That is correct: Task 4 introduces them.

- [ ] **Step 4: Commit the red checker**

```bash
git add package.json scripts/check-contrast.mjs
git commit -m "test: add contrast checker (currently failing, see spec section 4)"
```

---

## Task 4: Fix the palette — contrast goes green

**Files:**
- Modify: `src/styles/global.css:9-12` (the `:root` block), and the rules listed below

- [ ] **Step 1: Hoist every colour into `:root`**

Replace the `:root` block in `src/styles/global.css` with:

```css
:root{
  /* Brand red. Passes AA only at large/graphic sizes (3.0). Use for the logo,
     the hero h1, icon fills, card top bars and bullets — never for body text. */
  --red:#e6332a;
  /* Accessible red. Passes AA at body size on paper and as a button ground. */
  --red-deep:#c5271f;

  /* Red band gradient stops. --band-red-light is the worst case for white text
     on the band, so scripts/check-contrast.mjs tests against it. */
  --band-red-light:#e5271e; --band-red-mid:#e6332a; --band-red-deep:#c5271f;

  --ink:#15120f; --paper:#fbf9f5;
  --soft:#f3efe8; --muted:#6f6a61; --line:rgba(21,18,15,.10);
  --prose-ink:#262019;
}
```

- [ ] **Step 2: Point the band gradient at the new tokens**

Replace:

```css
.band-red{ background:linear-gradient(160deg,#ef3b30,var(--red) 55%,var(--red-deep)); color:#fff; }
```

with:

```css
.band-red{ background:linear-gradient(160deg,var(--band-red-light),var(--band-red-mid) 55%,var(--band-red-deep)); color:#fff; }
```

- [ ] **Step 3: Switch every body-size use of red to `--red-deep`**

Make these five replacements in `src/styles/global.css`:

```css
/* .eyebrow — was color:var(--red) */
.eyebrow{ font-size:11.5px; letter-spacing:.20em; text-transform:uppercase; font-weight:700; color:var(--red-deep); margin-bottom:16px; }

/* .btn-red — was background:var(--red) */
.btn-red{ background:var(--red-deep); color:#fff; box-shadow:0 6px 18px rgba(230,51,42,.28); }

/* .btn-onred — was color:var(--red) */
.btn-onred{ background:#fff; color:var(--red-deep); }

/* .tagpill — was color:var(--red) */
.tagpill{ font-size:10.5px; letter-spacing:.06em; text-transform:uppercase; font-weight:700; color:var(--red-deep); background:rgba(230,51,42,.08); border-radius:20px; padding:5px 11px; }

/* .prose a — was color:var(--red) */
.prose a{ color:var(--red-deep); text-decoration:underline; text-underline-offset:2px; }
```

Leave `--red` in place for `.sh .dot`, `.pill .no`, `.fitem .ic`, `.postcard .pc-top`, `.mrow span::before` and the SVG logo — those are large or graphic and pass at 3.0.

- [ ] **Step 4: Use the prose token**

Replace `.prose{ ... color:#262019; }` with:

```css
.prose{ font-size:16.5px; line-height:1.7; color:var(--prose-ink); }
```

- [ ] **Step 5: Run the checker**

Run: `npm run check:contrast`
Expected: PASS — every row reads `pass`, final line `All pairs pass AA.`

- [ ] **Step 6: Confirm the site still builds**

Run: `npm run build`
Expected: exit 0, `5 page(s) built`

- [ ] **Step 7: Commit**

```bash
git add src/styles/global.css
git commit -m "fix(a11y): resolve 8 WCAG AA contrast failures via a red token split"
```

---

## Task 5: Spacing checker — make it fail

Ends **red** on purpose. This is the failing test for Task 6.

**Files:**
- Create: `scripts/check-spacing.mjs`
- Modify: `package.json`

- [ ] **Step 1: Write the checker**

Create `scripts/check-spacing.mjs`:

```js
#!/usr/bin/env node
/**
 * Asserts every padding/margin/gap value in global.css is 0, auto, a var(--sN)
 * spacing token, or one of a small set of allowlisted hairline values.
 *
 * Run: npm run check:spacing
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parseRootTokens, parseDeclarations } from './lib/parse-css.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const cssPath = resolve(here, '../src/styles/global.css');
const css = readFileSync(cssPath, 'utf8');
const tokens = parseRootTokens(css);

/**
 * Values below the 4px base step that no token can express. Each entry needs a
 * reason. Keep this list short — it is an escape hatch, not a second scale.
 */
const ALLOWED_RAW = new Map([
  ['2px 6px', 'inline .prose code padding — 4px would break the line box'],
  ['5px 12px', '.win-pill — sits inside a 10px-tall mock browser chrome'],
  ['5px 11px', '.tagpill — must stay smaller than the 24px card gutter'],
]);

const SPACING_PROPS = ['padding', 'margin', 'gap', 'row-gap', 'column-gap'];
const declarations = parseDeclarations(css, SPACING_PROPS);

const violations = [];
for (const decl of declarations) {
  const value = decl.value.trim();
  if (ALLOWED_RAW.has(value)) continue;

  const parts = value.split(/\s+/);
  const bad = parts.filter(
    (part) => part !== '0' && part !== 'auto' && !/^var\(--s\d\)$/.test(part)
  );
  if (bad.length) {
    violations.push({ ...decl, bad });
  }
}

// Every --sN referenced must actually exist.
const missing = [];
for (const decl of declarations) {
  for (const [, name] of decl.value.matchAll(/var\((--s\d)\)/g)) {
    if (!tokens[name]) missing.push(`${decl.selector} references undeclared ${name}`);
  }
}

console.log('Spacing token check\n');
if (violations.length === 0 && missing.length === 0) {
  console.log(`All ${declarations.length} spacing declarations use tokens.`);
  process.exit(0);
}

for (const v of violations) {
  console.log(`  ${v.selector}\n    ${v.property}: ${v.value}   -> raw: ${v.bad.join(', ')}`);
}
for (const m of missing) console.log(`  ${m}`);
console.error(`\n${violations.length + missing.length} spacing violation(s). See spec §3.`);
process.exit(1);
```

- [ ] **Step 2: Add the script to package.json**

Add to `"scripts"`:

```json
    "check:spacing": "node scripts/check-spacing.mjs",
```

- [ ] **Step 3: Run it and confirm it fails**

Run: `npm run check:spacing`
Expected: FAIL — roughly 45 violations listed, one per raw-px spacing declaration.

- [ ] **Step 4: Commit the red checker**

```bash
git add package.json scripts/check-spacing.mjs
git commit -m "test: add spacing token checker (currently failing, see spec section 3)"
```

---

## Task 6: Introduce the scale and snap every value

**Files:**
- Modify: `src/styles/global.css` (throughout)

- [ ] **Step 1: Add the spacing tokens to `:root`**

Append these two lines inside the `:root` block, after the colour tokens:

```css
  /* Spacing scale — spec §3. Every padding/margin/gap uses one of these. */
  --s1:4px; --s2:8px; --s3:12px; --s4:16px; --s5:24px;
  --s6:32px; --s7:48px; --s8:72px; --s9:96px;
  /* Band rhythm: a clamp, not a breakpoint, so it scales smoothly. */
  --band-y:clamp(48px, 8vw, 96px);
```

- [ ] **Step 2: Snap the layout and nav rules**

```css
.wrap{ max-width:1200px; margin:0 auto; padding:0 var(--s7); }
.nav-in{ display:flex; align-items:center; justify-content:space-between; height:70px; }
.wm .t{ font-size:8px; letter-spacing:.30em; color:var(--muted); margin-top:var(--s1); font-weight:600; }
.navlinks{ display:flex; gap:var(--s6); font-size:14px; }
.navlinks a{ color:var(--ink); opacity:.62; text-decoration:none; position:relative; padding-bottom:var(--s1); }
```

- [ ] **Step 3: Snap the buttons**

```css
.btn{ font-family:inherit; font-weight:600; font-size:14px; padding:var(--s3) var(--s5); border-radius:11px; border:none; cursor:pointer; transition:transform .18s ease, box-shadow .18s ease; text-decoration:none; display:inline-block; }
.btn-lg{ font-size:15px; padding:var(--s4) var(--s6); }
```

- [ ] **Step 4: Snap the bands and headings**

```css
.band{ padding:var(--band-y) 0; position:relative; overflow:hidden; }
.eyebrow{ font-size:11.5px; letter-spacing:.20em; text-transform:uppercase; font-weight:700; color:var(--red-deep); margin-bottom:var(--s4); }
.stext{ font-size:16px; line-height:1.6; color:var(--muted); margin-top:var(--s4); }
```

- [ ] **Step 5: Snap hero, devices, pillars, stats, chips**

```css
.hero{ padding-top:70px; padding-bottom:0; }
.kick{ display:inline-flex; align-items:center; gap:var(--s2); font-size:11.5px; letter-spacing:.22em; text-transform:uppercase; font-weight:700; margin-bottom:var(--s5); }
.lead{ font-size:clamp(16px,1.6vw,18.5px); line-height:1.5; color:rgba(255,255,255,.94); max-width:52ch; margin:var(--s5) auto var(--s6); }
.proof{ font-size:12.5px; color:rgba(255,255,255,.82); margin-top:var(--s5); }
.win-bar{ display:flex; align-items:center; gap:var(--s1); padding:var(--s3) var(--s4); background:#161618; }
.devices{ display:flex; align-items:center; justify-content:center; gap:var(--s6); margin-top:var(--s7); flex-wrap:wrap; }
.pillars{ display:grid; grid-template-columns:repeat(3,1fr); gap:var(--s4); margin-top:var(--s2); }
.pill{ padding:var(--s5); border-radius:20px; }
.pill h4{ font-size:19px; margin:var(--s4) 0 var(--s2); font-weight:600; letter-spacing:-.01em; }
.statstrip{ display:grid; grid-template-columns:1fr 1fr; gap:var(--s4); }
.statc{ padding:var(--s5); border-radius:18px; }
.statc .cap{ font-size:12px; letter-spacing:.1em; text-transform:uppercase; color:rgba(255,255,255,.65); margin-top:var(--s2); }
.chips{ display:flex; gap:var(--s3); justify-content:center; flex-wrap:wrap; margin-top:var(--s5); }
.chip{ border:1px solid var(--line); background:#fff; border-radius:30px; padding:var(--s2) var(--s4); font-size:13.5px; font-weight:600; display:flex; align-items:center; gap:var(--s1); }
```

- [ ] **Step 6: Snap the feature grids, first look, marquee and footer**

```css
.split{ display:grid; grid-template-columns:1.05fr .95fr; gap:var(--s7); align-items:center; }
.fgrid{ display:grid; grid-template-columns:repeat(3,1fr); gap:var(--s4); margin-top:var(--s6); text-align:left; }
.fitem{ padding:var(--s5); border-radius:18px; }
.fitem .ic{ width:38px; height:38px; border-radius:11px; background:var(--red); color:#fff; display:flex; align-items:center; justify-content:center; font-size:16px; margin-bottom:var(--s4); }
.fitem h5{ font-size:16px; font-weight:600; margin-bottom:var(--s1); }
.phonerow{ display:flex; gap:var(--s6); justify-content:center; align-items:flex-end; margin-top:var(--s7); flex-wrap:wrap; }
.marquee{ position:relative; margin-top:var(--s6); -webkit-mask-image:linear-gradient(90deg,transparent,#000 11%,#000 89%,transparent); mask-image:linear-gradient(90deg,transparent,#000 11%,#000 89%,transparent); }
.mrow.rev{ animation-direction:reverse; animation-duration:72s; margin-top:var(--s1); }
.mrow span{ font-size:clamp(17px,2.1vw,25px); font-weight:500; color:var(--muted); padding:var(--s2) var(--s5); display:inline-flex; align-items:center; gap:var(--s4); }
.foot{ background:var(--ink); color:#fff; padding:var(--s8) 0 var(--s7); text-align:center; }
.credits{ margin-top:var(--s7); padding-top:var(--s5); border-top:1px solid rgba(255,255,255,.12); font-size:13px; color:rgba(255,255,255,.6); }
.fpartners{ display:flex; gap:var(--s4); justify-content:center; align-items:center; flex-wrap:wrap; margin:var(--s4) 0; font-size:13px; color:rgba(255,255,255,.8); }
```

- [ ] **Step 7: Snap the blog rules**

```css
.page-head{ padding:var(--s8) 0 var(--s2); text-align:center; }
.bloglist{ display:grid; grid-template-columns:repeat(3,1fr); gap:var(--s5); padding:var(--s7) 0 var(--s9); }
.postcard .pc-body{ padding:var(--s5); display:flex; flex-direction:column; gap:var(--s2); flex:1; }
.postcard .pc-tags{ display:flex; gap:var(--s2); flex-wrap:wrap; }
.postcard .pc-meta{ font-size:12.5px; color:var(--muted); margin-top:var(--s1); }

.post{ max-width:760px; margin:0 auto; padding:var(--s8) 0 var(--s9); }
.post-meta{ font-size:13px; color:var(--muted); margin-bottom:var(--s4); display:flex; gap:var(--s2); align-items:center; flex-wrap:wrap; }
.post h1{ font-family:'Druk Wide Bold',sans-serif; text-transform:uppercase; font-size:clamp(28px,4.4vw,46px); line-height:.96; letter-spacing:-.01em; margin-bottom:var(--s4); }
.post .lede{ font-size:19px; line-height:1.55; color:var(--muted); margin-bottom:var(--s6); }
.prose h2{ font-size:24px; font-weight:600; letter-spacing:-.01em; margin:var(--s6) 0 var(--s3); }
.prose h3{ font-size:19px; font-weight:600; margin:var(--s5) 0 var(--s2); }
.prose p{ margin:0 0 var(--s4); }
.prose ul,.prose ol{ margin:0 0 var(--s4) var(--s5); }
.prose li{ margin-bottom:var(--s1); }
.prose blockquote{ border-left:3px solid var(--red-deep); padding-left:var(--s4); margin:0 0 var(--s4); color:var(--muted); font-style:italic; }
.back-link{ display:inline-block; margin-bottom:var(--s5); font-size:13.5px; font-weight:600; color:var(--red-deep); text-decoration:none; }
```

Note `.post` loses its horizontal padding entirely — Task 7 wraps it in `.wrap`, which supplies the gutters.

- [ ] **Step 8: Update the mobile breakpoint**

```css
@media (max-width:880px){
  .pillars,.fgrid,.statstrip,.split,.bloglist{ grid-template-columns:1fr; }
  .wrap{ padding:0 var(--s5); }
}
```

`.navlinks{ display:none }` is removed here — Task 11 replaces it with the disclosure panel.

- [ ] **Step 9: Run the spacing checker**

Run: `npm run check:spacing`
Expected: PASS — `All N spacing declarations use tokens.`

- [ ] **Step 10: Run the contrast checker and build**

Run: `npm run check:contrast && npm run build`
Expected: both exit 0

- [ ] **Step 11: Commit**

```bash
git add src/styles/global.css
git commit -m "refactor(css): snap all spacing onto a nine-step token scale"
```

---

## Task 7: Fix the blog gutter bug

**Files:**
- Modify: `src/pages/blog/[...slug].astro:16`

- [ ] **Step 1: Wrap the article in `.wrap`**

Replace:

```astro
  <article class="post">
```

with:

```astro
  <div class="wrap">
  <article class="post">
```

and replace the closing:

```astro
  </article>
```

with:

```astro
  </article>
  </div>
```

- [ ] **Step 2: Verify the gutters now match**

Run: `npm run build && npm run preview`

Open `http://localhost:4321/blog/the-site-access-bottleneck/` and narrow the window below 880px. Expected: the post's left edge lines up with the homepage's — both 24px. Before this change the post sat at 44px.

- [ ] **Step 3: Commit**

```bash
git add "src/pages/blog/[...slug].astro"
git commit -m "fix(css): blog posts now respect the mobile gutter breakpoint"
```

---

## Task 8: Focus indicators

**Files:**
- Modify: `src/styles/global.css`

- [ ] **Step 1: Add the focus rules**

Add a new section immediately after the `.btn` block:

```css
/* ===== focus (WCAG 2.4.7) ===== */
/* Default ring: red-deep on light grounds. */
:where(a, button, input, textarea, select, [tabindex]):focus-visible{
  outline:2px solid var(--red-deep);
  outline-offset:2px;
  border-radius:4px;
}
/* On dark and red grounds a red ring disappears — invert it. */
.band-red :where(a, button, [tabindex]):focus-visible,
.band-ink :where(a, button, [tabindex]):focus-visible,
.foot :where(a, button, [tabindex]):focus-visible{
  outline-color:#fff;
}
/* Never remove the ring for keyboard users; mouse users don't see it anyway. */
:where(a, button):focus:not(:focus-visible){ outline:none; }
```

- [ ] **Step 2: Verify by keyboard**

Run: `npm run build && npm run preview`

Press Tab repeatedly from the top of the page. Expected: every link and button shows a visible ring; the ring is white inside the red hero band and the dark footer, red elsewhere.

- [ ] **Step 3: Commit**

```bash
git add src/styles/global.css
git commit -m "feat(a11y): add visible focus indicators (WCAG 2.4.7)"
```

---

## Task 9: Skip link and `<main>` landmark

**Files:**
- Modify: `src/layouts/Base.astro:31-35`
- Modify: `src/styles/global.css`

- [ ] **Step 1: Add the skip link styles**

Add after the focus section in `global.css`:

```css
/* ===== skip link (WCAG 2.4.1) ===== */
.skip{
  position:absolute; left:var(--s2); top:var(--s2); z-index:100;
  background:var(--ink); color:#fff; font-size:14px; font-weight:600;
  padding:var(--s3) var(--s4); border-radius:8px; text-decoration:none;
  transform:translateY(-200%);
}
.skip:focus{ transform:translateY(0); }
```

- [ ] **Step 2: Add the skip link and landmark to the layout**

Replace the `<body>` block in `src/layouts/Base.astro` with:

```astro
  <body>
    <a class="skip" href="#main">Skip to content</a>
    <Nav />
    <main id="main">
      <slot />
    </main>
    <Footer />
  </body>
```

- [ ] **Step 3: Verify**

Run: `npm run build && npm run preview`

Load the homepage and press Tab once. Expected: "Skip to content" slides into the top-left. Press Enter; focus moves past the nav.

- [ ] **Step 4: Commit**

```bash
git add src/layouts/Base.astro src/styles/global.css
git commit -m "feat(a11y): add skip link and main landmark (WCAG 2.4.1, 1.3.1)"
```

---

## Task 10: Heading order, decorative glyphs, alt text

**Files:**
- Modify: `src/pages/index.astro`

- [ ] **Step 1: Fix the heading levels**

In the pillars loop, change `<h4>{p.h}</h4>` to `<h3>{p.h}</h3>`.
In both the capabilities and outcomes loops, change `<h5>{c.h}</h5>` to `<h3>{c.h}</h3>`.

- [ ] **Step 2: Update the matching CSS selectors**

In `src/styles/global.css`:

```css
.pill h3{ font-size:19px; margin:var(--s4) 0 var(--s2); font-weight:600; letter-spacing:-.01em; }
.fitem h3{ font-size:16px; font-weight:600; margin-bottom:var(--s1); }
```

Delete the now-unused `.pill h4` and `.fitem h5` rules.

- [ ] **Step 3: Hide the decorative glyphs from screen readers**

Every `.ic` element renders a bare glyph (`▦ ◷ ✓ ◆ ⚡ ⇆`) that is announced as meaningless text. Change each occurrence of:

```astro
<div class="ic">{c.ic}</div>
```

to:

```astro
<div class="ic" aria-hidden="true">{c.ic}</div>
```

- [ ] **Step 4: Fix the alt text on the two real images**

```astro
<img class="win-shot" src={img.heroProduct} alt="A SiteSeer construction environment on desktop, showing a partially framed building with its structure exposed" />

<img src={img.groundUp} alt="A residential build shown at successive construction stages, from footings through frame to lock-up" />
```

- [ ] **Step 5: Record the duplicate-image problem honestly**

Add this comment directly above the `img` object in the frontmatter:

```astro
// NOTE (a11y, spec §5): six of the eight slots below point at product-hero.png.
// The three "first look" phones and the two "every device" phones are the same
// screenshot repeated, so their alt text cannot be accurate until real distinct
// images exist. Do not invent descriptions — replace the images.
```

Leave the six duplicate slots' alt attributes describing what is genuinely shown:

```astro
<img src={img.lookPhone1} alt="SiteSeer running on a phone" />
<img src={img.lookPhone2} alt="SiteSeer running on a phone" />
<img src={img.lookPhone3} alt="SiteSeer running on a phone" />
```

- [ ] **Step 6: Verify the heading outline**

Run: `npm run build`
Then: `grep -oE '<h[1-6]' dist/index.html | sort | uniq -c`
Expected: one `<h1`, several `<h2`, several `<h3`, and **no `<h4`, `<h5` or `<h6`**.

- [ ] **Step 7: Commit**

```bash
git add src/pages/index.astro src/styles/global.css
git commit -m "fix(a11y): heading order, decorative glyphs, and honest alt text"
```

---

## Task 11: Mobile navigation disclosure

**Files:**
- Create: `src/scripts/nav.js`
- Modify: `src/components/Nav.astro`
- Modify: `src/styles/global.css`

- [ ] **Step 1: Add the disclosure button and panel id**

Replace the `<nav class="navlinks">` element and the CTA in `src/components/Nav.astro` with:

```astro
    <button
      class="navtoggle"
      type="button"
      aria-expanded="false"
      aria-controls="navmenu"
    >
      <span class="navtoggle-box" aria-hidden="true">
        <span></span><span></span><span></span>
      </span>
      Menu
    </button>
    <nav class="navlinks" id="navmenu">
      {links.map((l) => <a href={l.href}>{l.label}</a>)}
      <a class="btn btn-red navlinks-cta" href={`${base}#contact`}>Start a pilot</a>
    </nav>
    <a class="btn btn-red nav-cta" href={`${base}#contact`}>Start a pilot</a>
```

- [ ] **Step 2: Add the styles**

Add after the nav section in `global.css`:

```css
/* ===== mobile nav disclosure ===== */
.navtoggle{
  display:none; align-items:center; gap:var(--s2);
  background:none; border:none; cursor:pointer;
  font-family:inherit; font-size:14px; font-weight:600; color:var(--ink);
  padding:var(--s2);
}
.navtoggle-box{ display:flex; flex-direction:column; gap:var(--s1); width:18px; }
.navtoggle-box span{ display:block; height:2px; background:var(--ink); border-radius:2px; }
.navlinks-cta{ display:none; }

@media (max-width:880px){
  .navtoggle{ display:flex; }
  .nav-cta{ display:none; }
  .navlinks{
    display:none; position:absolute; left:0; right:0; top:70px;
    flex-direction:column; align-items:flex-start; gap:var(--s4);
    background:var(--paper); border-bottom:1px solid var(--line);
    padding:var(--s5) var(--s5) var(--s6);
  }
  .nav[data-open='true'] .navlinks{ display:flex; }
  .navlinks a{ opacity:1; font-size:17px; }
  .navlinks-cta{ display:inline-block; margin-top:var(--s2); }
}
```

- [ ] **Step 3: Write the behaviour**

Create `src/scripts/nav.js`:

```js
/**
 * Mobile navigation disclosure. Below 880px the nav links collapse behind a
 * Menu button; above it the button is hidden by CSS and this is inert.
 */
const header = document.querySelector('.nav');
const toggle = document.querySelector('.navtoggle');
const panel = document.getElementById('navmenu');

if (header && toggle && panel) {
  const setOpen = (open) => {
    header.dataset.open = String(open);
    toggle.setAttribute('aria-expanded', String(open));
  };

  setOpen(false);

  toggle.addEventListener('click', () => {
    setOpen(header.dataset.open !== 'true');
  });

  // Escape closes and returns focus to the trigger.
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (header.dataset.open !== 'true') return;
    setOpen(false);
    toggle.focus();
  });

  // Following a link closes the panel.
  panel.addEventListener('click', (event) => {
    if (event.target.closest('a')) setOpen(false);
  });

  // Returning to desktop width must not leave a stale open state behind.
  window.matchMedia('(min-width: 881px)').addEventListener('change', (event) => {
    if (event.matches) setOpen(false);
  });
}
```

- [ ] **Step 4: Load it from the layout**

Add before `</body>` in `src/layouts/Base.astro`:

```astro
    <script>
      import '../scripts/nav.js';
    </script>
```

- [ ] **Step 5: Verify**

Run: `npm run build && npm run preview`

Narrow the window below 880px. Expected: a "Menu" button appears; clicking opens a panel with all four links plus the CTA; Escape closes it and returns focus to the button; Tab reaches every link while open. Widen past 880px with the panel open — expected: it closes cleanly and the desktop nav returns.

- [ ] **Step 6: Commit**

```bash
git add src/components/Nav.astro src/scripts/nav.js src/layouts/Base.astro src/styles/global.css
git commit -m "feat(a11y): mobile nav disclosure — links were unreachable below 880px"
```

---

## Task 12: Marquee pause control

**Files:**
- Create: `src/scripts/motion.js`
- Modify: `src/pages/index.astro`
- Modify: `src/styles/global.css`
- Modify: `src/layouts/Base.astro`

- [ ] **Step 1: Add the toggle button to the marquee**

In `src/pages/index.astro`, immediately after the closing `</div>` of the `.marquee` element, add:

```astro
        <button class="marquee-toggle" type="button" aria-pressed="false" data-marquee-toggle>
          Pause scrolling
        </button>
```

- [ ] **Step 2: Style the toggle**

Add to `global.css` after the marquee section:

```css
.marquee-toggle{
  display:block; margin:var(--s4) auto 0;
  background:none; border:1px solid var(--line); border-radius:20px;
  font-family:inherit; font-size:12.5px; font-weight:600; color:var(--muted);
  padding:var(--s2) var(--s4); cursor:pointer;
}
.marquee-toggle:hover{ color:var(--ink); border-color:var(--muted); }
.marquee.is-paused .mrow{ animation-play-state:paused; }
```

- [ ] **Step 3: Write the motion module with the marquee behaviour**

Create `src/scripts/motion.js`:

```js
/**
 * All motion behaviour for the site: marquee pause control, scroll-triggered
 * reveals, and the cursor spotlight. Every behaviour is off under
 * prefers-reduced-motion; the spotlight is additionally off without a fine
 * pointer, so touch devices never run pointer tracking.
 */
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');

/* ---------- marquee pause/play (WCAG 2.2.2) ---------- */
function initMarquee() {
  const toggle = document.querySelector('[data-marquee-toggle]');
  const marquee = document.querySelector('.marquee');
  if (!toggle || !marquee) return;

  // Under reduced motion the animation never runs, so the control is redundant.
  if (reduceMotion.matches) {
    toggle.hidden = true;
    return;
  }

  toggle.addEventListener('click', () => {
    const paused = marquee.classList.toggle('is-paused');
    toggle.setAttribute('aria-pressed', String(paused));
    toggle.textContent = paused ? 'Resume scrolling' : 'Pause scrolling';
  });
}

initMarquee();
```

- [ ] **Step 4: Load it from the layout**

Change the script block in `src/layouts/Base.astro` to:

```astro
    <script>
      import '../scripts/nav.js';
      import '../scripts/motion.js';
    </script>
```

- [ ] **Step 5: Verify**

Run: `npm run build && npm run preview`

Tab to the "Pause scrolling" button and press Enter. Expected: both marquee rows stop, the label becomes "Resume scrolling", and `aria-pressed` flips to `true`. Press Enter again to resume.

Then enable "Reduce motion" in macOS System Settings → Accessibility → Display and reload. Expected: the marquee is static and the button is hidden.

- [ ] **Step 6: Commit**

```bash
git add src/pages/index.astro src/scripts/motion.js src/layouts/Base.astro src/styles/global.css
git commit -m "feat(a11y): add marquee pause control (WCAG 2.2.2)"
```

---

## Task 13: Remove every hover lift

**Files:**
- Modify: `src/styles/global.css`

- [ ] **Step 1: Strip the transforms, keep the feedback**

Replace the four rules:

```css
.btn-red{ background:var(--red-deep); color:#fff; box-shadow:0 6px 18px rgba(230,51,42,.28); transition:background .2s ease, box-shadow .2s ease; }
.btn-red:hover{ background:#b52119; box-shadow:0 3px 10px rgba(230,51,42,.34); }
.btn-onred{ background:#fff; color:var(--red-deep); transition:background .2s ease; }
.btn-onred:hover{ background:var(--soft); }
```

Change `.btn` so it no longer transitions transform:

```css
.btn{ font-family:inherit; font-weight:600; font-size:14px; padding:var(--s3) var(--s5); border-radius:11px; border:none; cursor:pointer; transition:background .2s ease, box-shadow .2s ease; text-decoration:none; display:inline-block; }
```

Replace the `.glass` and `.postcard` hover rules:

```css
.glass:hover{ background:rgba(255,255,255,.13); }
.postcard:hover{ box-shadow:0 18px 40px rgba(21,18,15,.1); }
```

And change their transitions to drop `transform`:

```css
/* in .glass */ transition:background .22s ease;
/* in .postcard */ transition:box-shadow .2s ease;
```

- [ ] **Step 2: Verify nothing translates on hover**

Run: `grep -n "translateY" src/styles/global.css`
Expected: only two matches remain — `.phone::before` (a static notch offset) and `.devices .phone` / `.phonerow .phone:nth-child(2)` (static layout offsets). **No match inside a `:hover` rule.**

- [ ] **Step 3: Commit**

```bash
git add src/styles/global.css
git commit -m "feat(motion): remove all hover lifts in favour of full stillness"
```

---

## Task 14: Cursor spotlight

**Files:**
- Modify: `src/styles/global.css`
- Modify: `src/scripts/motion.js`

- [ ] **Step 1: Add the spotlight layer**

Add to `global.css` after the `.glass` block:

```css
/* ===== cursor spotlight ===== */
/* .glass and .postcard already clip with overflow:hidden. The ::before layer
   sits at z-index 0 and children are lifted to 1 so text is never washed. */
.postcard{ position:relative; }
.glass::before,
.postcard::before{
  content:''; position:absolute; inset:0; z-index:0; pointer-events:none;
  opacity:0; transition:opacity .3s ease;
  background:radial-gradient(220px circle at var(--mx,50%) var(--my,50%),
             rgba(255,255,255,.22), transparent 60%);
}
/* On white cards a white spotlight is invisible — use a faint brand wash. */
.postcard::before{
  background:radial-gradient(220px circle at var(--mx,50%) var(--my,50%),
             rgba(230,51,42,.10), transparent 60%);
}
.glass:hover::before,
.postcard:hover::before{ opacity:1; }
.glass::after{ z-index:0; }
.glass > *,
.postcard > *{ position:relative; z-index:1; }

@media (prefers-reduced-motion:reduce){
  .glass::before, .postcard::before{ display:none; }
}
```

- [ ] **Step 2: Add the pointer tracking**

Append to `src/scripts/motion.js`:

```js
/* ---------- cursor spotlight ---------- */
function initSpotlight() {
  if (reduceMotion.matches || !finePointer.matches) return;

  const cards = document.querySelectorAll('.glass, .postcard');
  for (const card of cards) {
    let frame = null;
    let latest = null;

    card.addEventListener('pointermove', (event) => {
      latest = event;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        const rect = card.getBoundingClientRect();
        const x = ((latest.clientX - rect.left) / rect.width) * 100;
        const y = ((latest.clientY - rect.top) / rect.height) * 100;
        card.style.setProperty('--mx', `${x.toFixed(1)}%`);
        card.style.setProperty('--my', `${y.toFixed(1)}%`);
      });
    });

    card.addEventListener('pointerleave', () => {
      if (frame) {
        cancelAnimationFrame(frame);
        frame = null;
      }
      card.style.removeProperty('--mx');
      card.style.removeProperty('--my');
    });
  }
}

initSpotlight();
```

- [ ] **Step 3: Verify**

Run: `npm run build && npm run preview`

Move the cursor across a glass card in the hero and across a blog post card. Expected: a soft light follows the pointer, the card itself does not move, and the light fades out on leave. Text stays fully legible with the light behind it.

Enable "Reduce motion" and reload. Expected: no spotlight at all.

- [ ] **Step 4: Commit**

```bash
git add src/styles/global.css src/scripts/motion.js
git commit -m "feat(motion): cursor-tracking spotlight on glass and post cards"
```

---

## Task 15: Scroll-triggered entrances

**Files:**
- Modify: `src/styles/global.css`
- Modify: `src/scripts/motion.js`
- Modify: `src/layouts/Base.astro`

- [ ] **Step 1: Rewrite the reveal rules**

Replace the entire `/* ===== entrance animation ===== */` section in `global.css` with:

```css
/* ===== entrance animation ===== */
/* Content is visible by default. The opacity:0 starting state only applies
   when JS is present, so a failed script can never hide the page. */
.reveal{ opacity:1; transform:none; }
.js .reveal{
  opacity:0; transform:translateY(18px);
  transition:opacity .7s cubic-bezier(.2,.7,.2,1),
             transform .7s cubic-bezier(.2,.7,.2,1);
}
.js .reveal.in{ opacity:1; transform:none; }
.d1{transition-delay:.05s}.d2{transition-delay:.14s}.d3{transition-delay:.24s}
.d4{transition-delay:.34s}.d5{transition-delay:.46s}.d6{transition-delay:.58s}

@media (prefers-reduced-motion:reduce){
  .js .reveal{ opacity:1; transform:none; transition:none; }
  .mrow{ animation:none; }
}
```

The `@keyframes rise` block is now unused — delete it.

- [ ] **Step 2: Gate `opacity:0` behind a `.js` class**

Add as the last element in `<head>` in `src/layouts/Base.astro`:

```astro
    <script is:inline>document.documentElement.classList.add('js');</script>
```

`is:inline` is required — without it Astro bundles the script and it runs too late, causing a flash of hidden content.

- [ ] **Step 3: Add the observer**

Append to `src/scripts/motion.js`:

```js
/* ---------- scroll-triggered entrances ---------- */
function initReveals() {
  const items = document.querySelectorAll('.reveal');
  if (!items.length) return;

  // No observer support, or motion is unwanted: show everything immediately.
  if (reduceMotion.matches || !('IntersectionObserver' in window)) {
    for (const item of items) item.classList.add('in');
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('in');
        observer.unobserve(entry.target);
      }
    },
    { threshold: 0.15, rootMargin: '0px 0px -5% 0px' }
  );

  for (const item of items) observer.observe(item);
}

initReveals();
```

- [ ] **Step 4: Verify the fix**

Run: `npm run build && npm run preview`

Load the homepage and scroll slowly. Expected: each section rises and fades **as it comes into view**, not before. Previously everything below the fold had already finished animating on page load.

- [ ] **Step 5: Verify the no-JS safety net**

Disable JavaScript in the browser (Chrome DevTools → Command Palette → "Disable JavaScript") and reload. Expected: the full page is visible with no animation. Before this change the content would have stayed at `opacity:0` forever.

- [ ] **Step 6: Commit**

```bash
git add src/styles/global.css src/scripts/motion.js src/layouts/Base.astro
git commit -m "feat(motion): fire entrances on scroll instead of a page-load timer"
```

---

## Task 16: Full verification pass

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add an a11y script**

Add to `"scripts"`:

```json
    "check:a11y": "npx --yes @axe-core/cli http://localhost:4321/ http://localhost:4321/blog/ http://localhost:4321/blog/the-site-access-bottleneck/ --exit"
```

- [ ] **Step 2: Run every automated check**

```bash
npm test
npm run check:contrast
npm run check:spacing
npm run build
```

Expected: all four exit 0.

- [ ] **Step 3: Run axe against the built site**

In one terminal: `npm run preview`
In another: `npm run check:a11y`

Expected: `0 violations` on all three URLs. If axe reports anything, fix it before continuing — do not record a known violation as acceptable.

- [ ] **Step 4: Manual keyboard pass**

With `npm run preview` running, confirm each of these by keyboard alone:

- [ ] Tab once from page load reveals "Skip to content"; Enter jumps past the nav
- [ ] Every link and button shows a visible focus ring
- [ ] The ring is white inside the red hero band and the dark footer
- [ ] Below 880px, the Menu button opens the nav; Escape closes it and returns focus
- [ ] The marquee toggle pauses and resumes both rows, and `aria-pressed` flips
- [ ] No element moves on hover anywhere on the site
- [ ] Sections animate in as they scroll into view, not before

- [ ] **Step 5: Wire the checks into CI**

Every check in this plan is currently manual — nothing runs them on push. This
must be a **separate workflow** from deployment: Plan B deletes
`.github/workflows/deploy.yml` when the site moves to Cloudflare Pages, and the
checks have to survive that.

Create `.github/workflows/checks.yml`:

```yaml
name: Checks

on:
  push:
    branches: [main]
  pull_request:

jobs:
  checks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run check:contrast
      - run: npm run check:spacing
      - run: npm run build
```

Node 22 rather than 25: the `node --test` glob in `package.json` works on both,
and CI should track an LTS release rather than the local machine's version.

- [ ] **Step 6: Verify the workflow parses**

Run: `npx --yes js-yaml .github/workflows/checks.yml > /dev/null && echo "workflow parses"`
Expected: `workflow parses`

- [ ] **Step 7: Commit**

```bash
git add package.json .github/workflows/checks.yml
git commit -m "chore: add axe check script and run all checks in CI"
```

---

## Self-Review Notes

**Spec coverage:** §3 spacing → Tasks 5–7. §4 colour → Tasks 1–4. §5 accessibility → Tasks 8–12 (focus, skip link, landmark, headings, glyphs, alt text, mobile nav, marquee) plus §5 reduced-motion scroll gating, which is folded into Task 15's media query. §6 motion → Tasks 13–15. §11 verification → Task 16.

**One spec item deliberately deferred:** `html { scroll-behavior: smooth }` gating is listed in spec §5 but is not its own task — it is a one-line change. Add it in Task 15 Step 1 alongside the other reduced-motion rules:

```css
@media (prefers-reduced-motion:no-preference){ html{ scroll-behavior:smooth; } }
```

and remove `scroll-behavior:smooth` from the bare `html` rule at the top of the file.

**Out of scope for Plan A:** everything in spec §7–§10 and §12 — content collections, the partners section, the CMS, the Cloudflare move and `noindex`. Those are Plan B.
