import test from 'node:test';
import assert from 'node:assert/strict';
import { fieldNamesFor, zodKeysFor } from '../scripts/check-cms-schema.mjs';

const CONFIG = `
collections:
  - name: blog
    folder: src/content/blog
    fields:
      - { name: title, widget: string }
      - { name: body, widget: markdown }
  - name: homepage
    files:
      - name: pillars
        file: src/content/home/pillars.json
        fields:
          - name: items
            widget: list
            fields:
              - { name: h, widget: string }
              - { name: p, widget: text }
`;

const SCHEMAS = `
const blog = defineCollection({
  schema: z.object({
    title: z.string(),
    draft: z.boolean().default(false),
  }),
});
const pillars = defineCollection({
  schema: z.object({ h: z.string(), p: z.string() }),
});
`;

test('fieldNamesFor reads a folder collection, ignoring the body field', () => {
  assert.deepEqual(fieldNamesFor(CONFIG, 'blog'), ['title']);
});

test('fieldNamesFor unwraps a file collection list widget', () => {
  assert.deepEqual(fieldNamesFor(CONFIG, 'pillars'), ['h', 'p']);
});

test('zodKeysFor extracts the keys of a named schema', () => {
  assert.deepEqual(zodKeysFor(SCHEMAS, 'blog'), ['title', 'draft']);
  assert.deepEqual(zodKeysFor(SCHEMAS, 'pillars'), ['h', 'p']);
});

test('zodKeysFor returns null for a collection it cannot find', () => {
  assert.equal(zodKeysFor(SCHEMAS, 'nope'), null);
});
