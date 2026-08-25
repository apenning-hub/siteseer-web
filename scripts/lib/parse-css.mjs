/**
 * Deliberately small, regex-based CSS reader. It only needs to handle the
 * shape of src/styles/global.css — a flat stylesheet with no nesting beyond
 * @media blocks. It is not a general CSS parser and should not become one.
 */

/** Strip comments so they can't produce phantom matches. */
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
