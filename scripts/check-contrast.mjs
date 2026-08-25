#!/usr/bin/env node
/**
 * WCAG 2.2 AA contrast checker for src/styles/global.css.
 *
 * This script is deliberately allowed to fail. It is the executable spec for
 * the "fix the palette" task: every pair below is the colour combination that
 * actually renders on the site, at its actual rendered size, and it either
 * meets its AA threshold or it doesn't. The only way to turn a red row green
 * is to change a value in :root (or add a missing token) — nothing in this
 * file should ever be adjusted to make a result more favourable.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';

import { hexToRgb, relativeLuminance, contrastRatio, blend, requiredRatio } from './lib/contrast.mjs';
import { parseRootTokens, parseDeclarations } from './lib/parse-css.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSS_PATH = resolve(__dirname, '../src/styles/global.css');

/**
 * The parser is not string-aware, so an unbalanced brace inside a quoted value
 * would desynchronise the walk and silently swallow every rule after it. A
 * checker reporting "all pass" having read a third of the file is the exact
 * failure this script exists to prevent, so refuse to run on a sheet whose
 * rule count is wildly out of step with its brace count.
 */
function assertSheetFullyRead(css, ruleCount) {
  const openBraces = (css.match(/\{/g) ?? []).length;
  if (ruleCount < openBraces * 0.8) {
    throw new Error(
      `Read only ${ruleCount} rules from a stylesheet with ${openBraces} opening braces. ` +
      `The parser has probably desynchronised — check for an unbalanced brace inside a quoted value.`
    );
  }
}

/**
 * parseDeclarations(css, []) is NOT a usable rule count: an empty `properties`
 * array makes its `.some()` filter false for every declaration, so it always
 * returns zero — which would trip the sanity alarm on every healthy run.
 *
 * Passing every matching declaration also isn't right on its own: a rule with
 * several matched declarations (e.g. `display`, `color`, `padding` all in one
 * selector) would be counted several times, inflating the count far past the
 * true rule count and making the alarm insensitive to a real desync (verified
 * below).
 *
 * What we actually want is "how many distinct rules did the parser manage to
 * read", so: run parseDeclarations with a broad list of common CSS property
 * names (enough that virtually every rule in a hand-written stylesheet has at
 * least one match), then de-duplicate by (atRule, selector) pair. Verified
 * against this file: gives 141/147 open braces (the shortfall is `:root`,
 * which parseDeclarations deliberately skips, plus each at-block's own
 * wrapping brace, which yields no rule of its own) — comfortably over the 0.8
 * ratio. Verified against a synthetic desync (an unbalanced `{` inside a
 * `content:'...'` value, mirroring the documented failure mode): de-duplicated
 * count collapses to 9/148 (ratio 0.06, trips the alarm), while the raw
 * (non-deduplicated) declaration count perversely rises to 2.36x the brace
 * count and would never trip it. So: de-duplicated count it is.
 */
const COMMON_PROPERTIES = [
  'align-items', 'animation', 'aspect-ratio', 'backdrop-filter', 'background',
  'border', 'bottom', 'box-shadow', 'box-sizing', 'color', 'content', 'cursor',
  'display', 'flex', 'font', 'gap', 'grid-template-columns', 'height', 'inset',
  'justify-content', 'left', 'letter-spacing', 'line-height', 'margin',
  'mask-image', 'max-width', 'mix-blend-mode', 'object-fit', 'opacity',
  'overflow', 'padding', 'pointer-events', 'position', 'scroll-behavior', 'src',
  'text', 'top', 'transform', 'transition', 'white-space', 'width', 'z-index',
  '-webkit-backdrop-filter', '-webkit-font-smoothing', '-webkit-mask-image',
];

function countRules(css) {
  const decls = parseDeclarations(css, COMMON_PROPERTIES);
  const rules = new Set(decls.map((d) => `${d.atRule ?? ''}||${d.selector}`));
  return rules.size;
}

/**
 * The pairs below were cross-checked against src/styles/global.css directly
 * (not trusted from the spec table as-is). Findings:
 *
 * - Every alpha and every rendered px size in the spec table matches the
 *   stylesheet exactly (checked each rgba()/opacity value and font-size by
 *   hand against the relevant rule).
 * - `.eyebrow`, `.prose a`, `.btn-onred label` and the `.btn-red label`
 *   background currently read `var(--red)` in the stylesheet, not
 *   `var(--red-deep)`. This is expected, not a table error: the fixture
 *   comment in tests/parse-css.test.mjs already documents "--red ... Passes
 *   AA only at large sizes — never use --red for body text", i.e. the palette
 *   fix is expected to repoint these onto --red-deep (which already exists).
 *   These pairs intentionally test the target token, not today's declaration.
 * - `.stext` on an `--ink` background is ambiguous: `.band-ink .stext` and
 *   `.band-red .stext` share one rule at alpha .90, while `.foot .stext` is a
 *   separate rule at alpha .78. The spec's 0.90 matches the `.band-ink`
 *   variant exactly, so that's the pairing implemented below; `.foot .stext`
 *   (alpha .78) is a distinct, uncovered pair, not a wrong value in this one.
 */
const PAIRS = [
  { label: '.eyebrow',           fg: '--red-deep',   bg: '--paper', px: 11.5, bold: true },
  { label: '.prose a',           fg: '--red-deep',   bg: '--paper', px: 16.5, bold: false },
  { label: '.stext',             fg: '--muted',      bg: '--paper', px: 16,   bold: false },
  { label: '.pill p',            fg: '--muted',      bg: '--paper', px: 14.5, bold: false },
  { label: '.pc-desc',           fg: '--muted',      bg: '--paper', px: 14,   bold: false },
  { label: '.pc-meta',           fg: '--muted',      bg: '--paper', px: 12.5, bold: false },
  { label: '.post .lede',        fg: '--muted',      bg: '--paper', px: 19,   bold: false },
  { label: '.prose (body)',      fg: '--prose-ink',  bg: '--paper', px: 16.5, bold: false },
  { label: '.navlinks a',        fg: '--ink',        bg: '--paper', px: 14,   bold: false, alpha: 0.62 },
  { label: '.btn-onred label',   fg: '--red-deep',   bg: '#ffffff', px: 14,   bold: true },
  { label: '.chip',              fg: '--ink',        bg: '#ffffff', px: 13.5, bold: true },
  { label: '.btn-red label',     fg: '#ffffff',      bg: '--red-deep',        px: 14,   bold: true },
  { label: '.lead (on band)',    fg: '#ffffff',      bg: '--band-red-light',  px: 18.5, bold: false, alpha: 0.94 },
  { label: '.stext (on band)',   fg: '#ffffff',      bg: '--band-red-light',  px: 16,   bold: false, alpha: 0.90 },
  { label: '.proof (on band)',   fg: '#ffffff',      bg: '--band-red-light',  px: 12.5, bold: false, alpha: 0.82 },
  { label: '.h1 (on band)',      fg: '#ffffff',      bg: '--band-red-light',  px: 44,   bold: false },
  { label: '.stext (on ink)',    fg: '#ffffff',      bg: '--ink',             px: 16,   bold: false, alpha: 0.90 },
  { label: '.statc .cap',        fg: '#ffffff',      bg: '--ink',             px: 12,   bold: false, alpha: 0.65 },
  { label: '.credits',           fg: '#ffffff',      bg: '--ink',             px: 13,   bold: false, alpha: 0.60 },
  { label: '.fpartners',         fg: '#ffffff',      bg: '--ink',             px: 13,   bold: false, alpha: 0.80 },
];

/** Resolve a pair's colour spec (a `--token` name or a literal `#hex`) to RGB. */
function resolveRgb(spec, tokens) {
  if (spec.startsWith('--')) {
    const value = tokens[spec];
    if (value === undefined) {
      throw new Error(`missing token ${spec} (not declared in :root — expected from the palette fix)`);
    }
    return hexToRgb(value);
  }
  return hexToRgb(spec);
}

function main() {
  const css = readFileSync(CSS_PATH, 'utf8');
  assertSheetFullyRead(css, countRules(css));

  // Let this throw uncaught: a :root split across two at-blocks means two
  // palettes, and there is no safe guess between them.
  const tokens = parseRootTokens(css);

  const rows = [];
  let anyFailed = false;

  for (const pair of PAIRS) {
    try {
      const bgRgb = resolveRgb(pair.bg, tokens);
      let fgRgb = resolveRgb(pair.fg, tokens);
      if (pair.alpha !== undefined) {
        fgRgb = blend(fgRgb, bgRgb, pair.alpha);
      }
      const ratio = contrastRatio(fgRgb, bgRgb);
      const required = requiredRatio({ px: pair.px, bold: pair.bold });
      const pass = ratio >= required;
      if (!pass) anyFailed = true;
      rows.push({
        label: pair.label,
        ratio: ratio.toFixed(2),
        required: required.toFixed(2),
        status: pass ? 'PASS' : 'FAIL',
      });
    } catch (err) {
      anyFailed = true;
      rows.push({
        label: pair.label,
        ratio: 'ERROR',
        required: requiredRatio({ px: pair.px, bold: pair.bold }).toFixed(2),
        status: `FAIL (${err.message})`,
      });
    }
  }

  const labelWidth = Math.max(...rows.map((r) => r.label.length), 'Element'.length);
  const header = `${'Element'.padEnd(labelWidth)}  Ratio   Required  Status`;
  console.log(header);
  console.log('-'.repeat(header.length));
  for (const row of rows) {
    console.log(
      `${row.label.padEnd(labelWidth)}  ${String(row.ratio).padEnd(6)}  ${String(row.required).padEnd(8)}  ${row.status}`
    );
  }

  const failCount = rows.filter((r) => r.status !== 'PASS').length;
  console.log('');
  console.log(anyFailed
    ? `${failCount}/${rows.length} pair(s) failed AA.`
    : `All ${rows.length} pairs meet AA.`);

  process.exit(anyFailed ? 1 : 0);
}

main();
