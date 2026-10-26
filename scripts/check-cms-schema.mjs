#!/usr/bin/env node
/**
 * Asserts that every field in public/admin/config.yml has a matching key in the
 * Zod schema in src/content.config.ts, and vice versa.
 *
 * Drift here is invisible to the author: the CMS happily writes a field the
 * schema rejects, the build fails, and the post silently never appears.
 *
 * Run: npm run check:cms
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parse } from 'yaml';

/** Fields the CMS owns that never appear in frontmatter. */
const NOT_FRONTMATTER = new Set(['body']);

/** Field names the CMS declares for a given collection name. */
export function fieldNamesFor(configYaml, collectionName) {
  const config = parse(configYaml);
  for (const collection of config.collections ?? []) {
    if (collection.name === collectionName && collection.fields) {
      return collection.fields
        .map((f) => f.name)
        .filter((n) => !NOT_FRONTMATTER.has(n));
    }
    for (const entry of collection.files ?? []) {
      if (entry.name !== collectionName) continue;
      // A file collection whose single field is a list of objects describes a
      // repeated item — the schema applies to the item, not the wrapper.
      if (entry.fields.length === 1 && entry.fields[0].widget === 'list' && entry.fields[0].fields) {
        return entry.fields[0].fields.map((f) => f.name);
      }
      return entry.fields.map((f) => f.name).filter((n) => !NOT_FRONTMATTER.has(n));
    }
  }
  return null;
}

/**
 * Splits a z.object({...}) body into its top-level, comma-separated field
 * entries, ignoring commas nested inside parens/braces/brackets (e.g. a
 * `.refine(fn, { message: '...' })` clause attached to a field).
 */
function splitTopLevel(text) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const ch of text) {
    if (ch === '(' || ch === '{' || ch === '[') depth += 1;
    if (ch === ')' || ch === '}' || ch === ']') depth -= 1;
    if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current);
  return parts;
}

/** Top-level keys of the z.object({...}) belonging to a named collection. */
export function zodKeysFor(source, collectionName) {
  const start = source.indexOf(`const ${collectionName} = defineCollection(`);
  if (start === -1) return null;
  const objectStart = source.indexOf('z.object({', start);
  if (objectStart === -1) return null;

  let depth = 0;
  let end = objectStart + 'z.object('.length;
  for (let i = end; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) { end = i; break; }
    }
  }

  const body = source.slice(objectStart + 'z.object({'.length, end);
  const keys = [];
  for (const part of splitTopLevel(body)) {
    const match = part.match(/^\s*([A-Za-z_][\w]*)\s*:/);
    if (match) keys.push(match[1]);
  }
  return keys;
}

/**
 * [CMS collection or file name, Zod collection name]. The two site files are
 * separate entries in the CMS but share one `sites` schema.
 */
export const COLLECTIONS = [
  ['blog', 'blog'],
  ['education', 'sites'],
  ['industry', 'sites'],
  ['partners', 'partners'],
];

// Running as a script rather than being imported by the tests.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const here = dirname(fileURLToPath(import.meta.url));
  const configYaml = readFileSync(resolve(here, '../public/admin/config.yml'), 'utf8');
  const schemas = readFileSync(resolve(here, '../src/content.config.ts'), 'utf8');

  let failures = 0;
  console.log('CMS / schema drift check\n');

  for (const [name, zodName] of COLLECTIONS) {
    const cmsFields = fieldNamesFor(configYaml, name);
    const zodKeys = zodKeysFor(schemas, zodName);

    if (!cmsFields) { console.log(`  ${name}: FAIL — no CMS collection`); failures += 1; continue; }
    if (!zodKeys) { console.log(`  ${name}: FAIL — no Zod schema`); failures += 1; continue; }

    const missingInCms = zodKeys.filter((k) => !cmsFields.includes(k));
    const missingInZod = cmsFields.filter((k) => !zodKeys.includes(k));

    if (missingInCms.length || missingInZod.length) {
      failures += 1;
      console.log(`  ${name}: FAIL`);
      if (missingInCms.length) console.log(`    in schema but not in CMS: ${missingInCms.join(', ')}`);
      if (missingInZod.length) console.log(`    in CMS but not in schema: ${missingInZod.join(', ')}`);
    } else {
      console.log(`  ${name}: ok (${zodKeys.length} fields)`);
    }
  }

  console.log('');
  if (failures) {
    console.error(`${failures} collection(s) out of sync. Edit config.yml and content.config.ts together — spec §10.`);
    process.exit(1);
  }
  console.log('CMS config and content schemas agree.');
}
