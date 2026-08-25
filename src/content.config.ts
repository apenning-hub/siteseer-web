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
 */
const listParser = (text: string) =>
  JSON.parse(text).items.map((item: Record<string, unknown>, index: number) => ({
    id: String(index),
    ...item,
  }));

const singletonParser = (id: string) => (text: string) => [{ id, ...JSON.parse(text) }];

const hero = defineCollection({
  loader: file('src/content/home/hero.json', { parser: singletonParser('hero') }),
  schema: z.object({
    kick: z.string(),
    headline: z.array(z.string()),
    lead: z.string(),
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

const partners = defineCollection({
  loader: file('src/content/home/partners.json', { parser: listParser }),
  schema: z.object({
    group: z.enum(['Partner', 'Supported by']),
    name: z.string(),
    role: z.string(),
    blurb: z.string(),
  }),
});

export const collections = {
  blog, hero, pillars, capabilities, outcomes, stats, roadmap, partners,
};
