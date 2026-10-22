import { defineCollection, z } from 'astro:content';
import { file, glob } from 'astro/loaders';

// Blog posts live as Markdown in src/content/blog/*.md
const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
    author: z.string().default('SiteSeer'),
    draft: z.boolean().default(false),
  }),
});

/**
 * Homepage copy lives in src/content/home/*.json so the CMS can edit it.
 * Astro's file() loader wants a top-level array of { id, ... }; the JSON is
 * shaped as { items: [...] } because that is what the CMS list widget writes,
 * so these parsers bridge the two.
 *
 * `id` is POSITIONAL, not identity — it changes when the author reorders items
 * in the CMS. Never link to it, persist it, or use it in a URL.
 */
const listParser = (text: string) => {
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed?.items)) {
    throw new Error('Expected { "items": [...] } — got ' + JSON.stringify(parsed).slice(0, 80));
  }
  return parsed.items.map((item: Record<string, unknown>, index: number) => ({
    ...item,
    id: String(index),
  }));
};

const singletonParser = (id: string) => (text: string) => [{ ...JSON.parse(text), id }];

// hero.lead carries inline bold and nothing else. The renderer converts only
// double-asterisk emphasis, so any other construct the CMS might emit would
// print as literal source in the most-read sentence on the site. Strip the
// well-formed bold spans, then nothing markup-ish may remain.
const BOLD_ONLY = /[*_`~\[\]<>#|]/;
const boldOnlyMarkdown = (s: string) => !BOLD_ONLY.test(s.replace(/\*\*[^*\n]+\*\*/g, ''));

const hero = defineCollection({
  loader: file('src/content/home/hero.json', { parser: singletonParser('hero') }),
  schema: z.object({
    kick: z.string(),
    headline: z.array(z.string()),
    lead: z.string().refine(boldOnlyMarkdown, {
      message:
        'hero.lead supports inline bold (double asterisks) only. Remove italics, links, headings, code or raw HTML — the hero renderer prints them literally.',
    }),
    proof: z.string(),
  }),
});

const pillars = defineCollection({
  loader: file('src/content/home/pillars.json', { parser: listParser }),
  schema: z.object({ no: z.string(), h: z.string(), p: z.string() }),
});

const capabilities = defineCollection({
  loader: file('src/content/home/capabilities.json', { parser: listParser }),
  schema: z.object({ ic: z.string(), h: z.string(), p: z.string() }),
});

const outcomes = defineCollection({
  loader: file('src/content/home/outcomes.json', { parser: listParser }),
  schema: z.object({ ic: z.string(), h: z.string(), p: z.string() }),
});

const stats = defineCollection({
  loader: file('src/content/home/stats.json', { parser: listParser }),
  schema: z.object({ num: z.string(), cap: z.string() }),
});

const roadmap = defineCollection({
  loader: file('src/content/home/roadmap.json', { parser: singletonParser('roadmap') }),
  schema: z.object({ rowA: z.array(z.string()), rowB: z.array(z.string()) }),
});

export const PARTNER_GROUPS = ['Partner', 'Supported by'] as const;

const partners = defineCollection({
  loader: file('src/content/home/partners.json', { parser: listParser }),
  schema: z.object({
    group: z.enum(PARTNER_GROUPS),
    name: z.string(),
    role: z.string(),
    blurb: z.string(),
  }),
});

export const collections = {
  blog, hero, pillars, capabilities, outcomes, stats, roadmap, partners,
};
