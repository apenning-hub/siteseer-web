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
 * Every text/background pair on the two-audience homepage and the blog
 * (Oct 2026 redesign). Red is kept for the logo and key text; the grounds are
 * --paper, --soft (the `.alt` sections) and white cards, so text is tested on
 * each ground it actually appears on.
 *
 * The hero's ground is a radial gradient from near-white to #efe9e0 at its
 * edges; its copy sits at the left, so the darker edge stop is the worst case
 * and is what the hero rows test against.
 *
 * Translucent fills (pill tracks, tag tints) are composited with blend() over
 * the ground they sit on rather than guessed.
 */
const HERO_EDGE = '#efe9e0';
const tint = (fgToken, alpha, over) => (tokens) => blend(resolveSimple(fgToken, tokens), resolveSimple(over, tokens), alpha);
const PAIRS = [
  // nav and buttons
  { label: '.navlinks a',            fg: '--ink',       bg: '--paper',  px: 14, bold: false },
  { label: '.nav-cta',               fg: '#ffffff',     bg: '--ink', px: 14, bold: true },
  { label: '.btn.r',                 fg: '#ffffff',     bg: '--ink', px: 16, bold: true },
  { label: '.btn.g',                 fg: '--ink',       bg: HERO_EDGE,  px: 16, bold: true },
  // hero copy, against the gradient's darkest stop
  { label: '.hero h1',               fg: '--ink',  bg: HERO_EDGE,  px: 15, bold: true },
  { label: '.line',                  fg: '--ink',       bg: HERO_EDGE,  px: 18, bold: false },
  { label: '.what',                  fg: '--card-ink',  bg: HERO_EDGE,  px: 16, bold: false },
  { label: '.pill[aria-current]',    fg: '#ffffff',     bg: '--ink',    px: 12, bold: true },
  { label: '.pill', px: 12, bold: true, compute: (t) => ({ fg: resolveSimple('--ink', t), bg: tint('--ink', 0.06, HERO_EDGE)(t) }) },
  // the hero's floating cards and Hierarchy panel
  { label: '.icard .k',              fg: '--ink',  bg: '#ffffff',  px: 11, bold: true },
  { label: '.icard p',               fg: '--card-ink',  bg: '#ffffff',  px: 14, bold: false },
  { label: '.icard .rf',             fg: '--muted',     bg: '#ffffff',  px: 12, bold: true },
  { label: '.lpanel .tabs span',     fg: '--muted',     bg: '--soft',   px: 11, bold: true },
  { label: '.lpanel .tabs span.on',  fg: '#ffffff',     bg: '--ink', px: 11, bold: true },
  { label: '.lpanel li.off',         fg: '--muted',     bg: '--soft',   px: 13, bold: true },
  // section text, on paper and on the soft .alt ground
  { label: '.eyebrow',               fg: '--ink',  bg: '--paper',  px: 13, bold: true },
  { label: '.alt .eyebrow',          fg: '--ink',  bg: '--soft',   px: 13, bold: true },
  { label: '.lede',                  fg: '--card-ink',  bg: '--paper',  px: 18, bold: false },
  { label: '.alt .lede',             fg: '--card-ink',  bg: '--soft',   px: 18, bold: false },
  { label: '.points li',             fg: '--card-ink',  bg: '--soft',   px: 17, bold: false },
  { label: '.points .n',             fg: '--ink',  bg: '#ffffff',  px: 14, bold: true },
  { label: '.shot figcaption',       fg: '--muted',     bg: '--soft',   px: 14, bold: false },
  { label: '.seg button',            fg: '--ink',       bg: '#f1ece4',  px: 14, bold: true },
  { label: '.seg button[pressed]',   fg: '#ffffff',     bg: '--ink',    px: 14, bold: true },
  // white cards
  { label: '.card p',                fg: '--card-ink',  bg: '#ffffff',  px: 15, bold: false },
  { label: '.card .tag',             fg: '--ink',       bg: '--soft',   px: 11, bold: true },
  { label: '.lms span',              fg: '--ink',       bg: '#ffffff',  px: 14, bold: true, alpha: 0.75 },
  // Logo red (#FF0000) only where it is large: 3:1 is the bar there.
  { label: '.stat .num',             fg: '--red',       bg: '#ffffff',  px: 40, bold: true },
  { label: '.closing',               fg: '--red',       bg: '--soft',   px: 22, bold: true },
  { label: '.stat .cap',             fg: '--card-ink',  bg: '#ffffff',  px: 15, bold: true },
  { label: '.outcomes p',            fg: '--card-ink',  bg: '--soft',   px: 16, bold: false },
  { label: '.partner .role',         fg: '--ink',  bg: '#ffffff',  px: 11, bold: true },
  { label: '.partner p',             fg: '--card-ink',  bg: '#ffffff',  px: 14, bold: false },
  { label: '.upcoming h3',           fg: '--ink',  bg: '#ffffff',  px: 11, bold: true },
  { label: '.upcoming li span',      fg: '--muted',     bg: '#ffffff',  px: 14, bold: false },
  // footer
  { label: '.site-foot',             fg: '--muted',     bg: '--paper',  px: 14, bold: false },
  { label: '.site-foot a',           fg: '--ink',  bg: '--paper',  px: 14, bold: true },
  { label: '.site-foot .draft',       fg: '--ink',       bg: '--soft',   px: 11, bold: true },
  // blog
  { label: '.pc-desc',               fg: '--muted',     bg: '#ffffff',  px: 14, bold: false },
  { label: '.pc-meta',               fg: '--muted',     bg: '#ffffff',  px: 12, bold: false },
  { label: '.pc-cat',                fg: '--ink',  bg: '#ffffff',  px: 11, bold: true },
  { label: '.pc-cat (on soft)',      fg: '--ink',  bg: '--soft',   px: 11, bold: true },
  { label: '.post .lede',            fg: '--ink',       bg: '--paper',  px: 20, bold: false },
  { label: '.byline',                fg: '--muted',     bg: '--paper',  px: 14, bold: false },
  { label: '.author-card span',      fg: '--card-ink',  bg: '--soft',   px: 14, bold: false },
  { label: '.prose blockquote',      fg: '--ink',       bg: '--paper',  px: 24, bold: true },
  { label: '.prose (body)',          fg: '--prose-ink', bg: '--paper',  px: 18, bold: false },
  { label: '.prose a',               fg: '--ink',  bg: '--paper',  px: 18, bold: false },
  { label: '.back-link',             fg: '--ink',  bg: '--paper',  px: 14, bold: true },
];

/** Resolve a pair's colour spec (a `--token` name or a literal `#hex`) to RGB. */
function resolveSimple(spec, tokens) {
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
      let fgRgb, bgRgb;
      if (pair.compute) {
        ({ fg: fgRgb, bg: bgRgb } = pair.compute(tokens));
      } else {
        bgRgb = resolveSimple(pair.bg, tokens);
        fgRgb = resolveSimple(pair.fg, tokens);
        if (pair.alpha !== undefined) {
          fgRgb = blend(fgRgb, bgRgb, pair.alpha);
        }
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
