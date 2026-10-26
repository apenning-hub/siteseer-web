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

/**
 * Named tokens that are not --sN but are built from the scale. Same rule as
 * above: each one needs a reason, and the token must still be declared.
 */
const ALLOWED_TOKENS = new Map([
  ['--band-y', 'fluid band rhythm — clamp() between --s7 (48px) and --s9 (96px)'],
  ['--gut', 'fluid page gutter — clamp() from 16px on phones (the 16px gutter floor) to 72px'],
  ['--edge', 'content edge — the gutter, or the centred 1240px column edge on wide screens'],
  ['--below-nav', 'first section under the fixed header — --nav-h (64px) + --s7'],
]);

const SPACING_PROPS =['padding', 'margin', 'gap', 'row-gap', 'column-gap'];
const declarations = parseDeclarations(css, SPACING_PROPS);

const violations = [];
for (const decl of declarations) {
  const value = decl.value.trim();
  if (ALLOWED_RAW.has(value)) continue;

  const parts = value.split(/\s+/);
  const bad = parts.filter(
    (part) =>
      part !== '0' &&
      part !== 'auto' &&
      !/^var\(--s\d\)$/.test(part) &&
      !ALLOWED_TOKENS.has(part.match(/^var\((--[\w-]+)\)$/)?.[1])
  );
  if (bad.length) {
    violations.push({ ...decl, bad });
  }
}

// Every --sN (or allowlisted token) referenced must actually exist.
const missing = [];
for (const decl of declarations) {
  for (const [, name] of decl.value.matchAll(/var\((--[\w-]+)\)/g)) {
    if (!/^--s\d$/.test(name) && !ALLOWED_TOKENS.has(name)) continue;
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
