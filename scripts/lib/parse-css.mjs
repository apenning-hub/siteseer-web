/**
 * Deliberately small CSS reader, built around a depth-aware brace walk rather
 * than a `[^}]*` regex scan. It only needs to handle the shape of
 * src/styles/global.css: flat style rules, plus at-blocks (`@media`,
 * `@supports`, `@keyframes`, ...) that nest one level of rules inside them.
 * It is not a general CSS parser and should not become one.
 *
 * KNOWN LIMITATION: the walk tracks brace depth only — it is not string-aware.
 * An unbalanced `{` or `}` inside a quoted string (e.g. `content:"{"`)
 * desynchronises it and everything after that rule goes silently missing.
 * Fixing this needs string-aware tokenisation, which is past what this file
 * should be. No such value exists in the real stylesheet today; if one is
 * ever added, see the 'KNOWN LIMITATION' test in tests/parse-css.test.mjs.
 */

/** Strip comments so they can't produce phantom matches. */
function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * Yields every style rule in the sheet, descending one level into at-blocks so
 * their contents are visible. A regex cannot do this: `[^}]*` stops at the
 * first `}`, which silently discards the first rule inside every at-block
 * (including `@font-face`, `@media`, `@supports`, `@keyframes`, ...).
 *
 * Rules found inside an at-block carry it in `atRule`, so callers can report
 * which `@media` a declaration came from rather than showing two bare `.wrap`s.
 *
 * `@font-face` (and other at-rules whose body is declarations, not nested
 * rules: `@page`, `@property`, `@counter-style`) is yielded as a rule in its
 * own right rather than descended into, so its declarations don't leak out
 * under an unrelated property check.
 */
function* eachRule(css) {
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf('{', i);
    if (open === -1) return;
    // A leading at-statement (`@import url(...);`) has no block of its own —
    // it's terminated by `;`, not `{`/`}` — so it sits in the same span as
    // the next construct's prelude. Keep only what follows the last `;`, or
    // an @import glues onto the next rule's selector and that rule vanishes.
    const prelude = css.slice(i, open).split(';').pop().trim().replace(/\s+/g, ' ');

    let depth = 1;
    let j = open + 1;
    while (j < css.length && depth > 0) {
      if (css[j] === '{') depth += 1;
      else if (css[j] === '}') depth -= 1;
      j += 1;
    }
    // If input ran out before depth returned to 0, there is no closing brace
    // to trim — `j - 1` would eat a real character of an unterminated block.
    const body = css.slice(open + 1, depth === 0 ? j - 1 : j);

    if (prelude.startsWith('@')) {
      if (/^@(font-face|page|property|counter-style)\b/.test(prelude)) {
        yield { selector: prelude, body, atRule: null };
      } else {
        for (const rule of eachRule(body)) {
          yield { ...rule, atRule: rule.atRule ?? prelude };
        }
      }
    } else {
      yield { selector: prelude, body, atRule: null };
    }
    i = j;
  }
}

/** Returns { '--token': 'value' } for every custom property declared in :root. */
export function parseRootTokens(css) {
  const tokens = {};
  for (const { selector, body } of eachRule(stripComments(css))) {
    if (!selector.split(',').some((s) => s.trim() === ':root')) continue;
    for (const chunk of body.split(';')) {
      const m = chunk.match(/^\s*(--[\w-]+)\s*:\s*([\s\S]+?)\s*$/);
      if (m) tokens[m[1]] = m[2];
    }
  }
  return tokens;
}

/**
 * Returns [{ selector, property, value, atRule }] for declarations whose
 * property is in `properties` (shorthand or longhand, e.g. 'padding' matches
 * 'padding-top'). The :root block and at-rules whose body is declarations
 * rather than nested rules (`@font-face` and friends) are skipped — neither
 * is a CSS property declared on a selector.
 *
 * `atRule` is the enclosing at-rule's prelude (e.g. '@media (max-width:880px)')
 * for a declaration found inside one, or `null` for a top-level rule. Two
 * rules can legitimately share a selector (a base rule and its @media
 * override); use `atRule` to tell them apart when reporting a violation.
 */
export function parseDeclarations(css, properties) {
  const out = [];
  for (const { selector, body, atRule } of eachRule(stripComments(css))) {
    // Skip :root (its custom properties aren't spacing/colour declarations on
    // an element) and at-rules yielded as leaf rules (@font-face and friends:
    // their body is declarations like `src`/`font-weight`, not CSS properties
    // on a selector, and would otherwise leak through as false matches).
    if (selector.startsWith('@')) continue;
    if (selector.split(',').every((s) => s.trim() === ':root')) continue;
    for (const chunk of body.split(';')) {
      const m = chunk.match(/^\s*([a-zA-Z-]+)\s*:\s*([\s\S]+?)\s*$/);
      if (!m) continue;
      const [, property, value] = m;
      if (properties.some((p) => property === p || property.startsWith(`${p}-`))) {
        out.push({ selector, property, value, atRule });
      }
    }
  }
  return out;
}
