import { defineCollection, z } from 'astro:content';
import { file, glob } from 'astro/loaders';

export const AUDIENCES = ['education', 'industry'] as const;

// Blog posts live as Markdown in src/content/blog/*.md. Each post says which
// of the two sites lists it; the default is both.
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
    audience: z.array(z.enum(AUDIENCES)).min(1).default(['education', 'industry']),
    // A render from src/images/renders/ shown on the card and above the post.
    image: z.string().optional(),
    imageAlt: z.string().optional(),
  }),
});

const vec3 = z.tuple([z.number(), z.number(), z.number()]);
const point = z.object({ title: z.string(), text: z.string() });
const image = z.object({ image: z.string(), alt: z.string(), caption: z.string() });

// One step of the hero sequence. `cam` is an orbit round the model, in metres
// and degrees. `inspect` pins cards to points on the model; `pulls` slide
// layers out (dv is [dx, dz] metres) and back.
const heroStep = z.object({
  word: z.string(),
  line: z.string(),
  kind: z.enum(['build', 'focus', 'inspect', 'pull', 'finale']),
  cam: z.object({ t: vec3, az: z.number(), polar: z.number(), r: z.number() }),
  hold: z.number().optional(),
  // How the model looks during the step, changing at t ms: the white model,
  // building-system colours, or an x-ray with `focus` layers held solid.
  looks: z.array(z.object({ t: z.number(), look: z.enum(['white', 'systems', 'xray']), focus: z.array(z.number().int()).optional() })).optional(),
  inspect: z.array(z.object({ at: vec3, kicker: z.string(), title: z.string(), text: z.string() })).optional(),
  pulls: z.array(z.object({
    t: z.number(), dur: z.number(), layers: z.array(z.number().int()), dv: z.tuple([z.number(), z.number()]),
    kicker: z.string(), title: z.string(), text: z.string(), refs: z.string().optional(),
  })).optional(),
});

// Each site's homepage copy is one JSON file: src/content/sites/education.json
// and industry.json. The file name is the entry id, and the homepage throws if
// its entry is missing, so a malformed file can't ship a blank page.
const sites = defineCollection({
  loader: glob({ pattern: '*.json', base: './src/content/sites' }),
  schema: z.object({
    draft: z.boolean(),
    meta: z.object({ title: z.string(), description: z.string() }),
    nav: z.object({ cta: z.string(), ctaShort: z.string().optional() }),
    hero: z.object({ kicker: z.string(), statement: z.string(), primary: z.string(), secondary: z.string(), steps: z.array(heroStep).min(1) }),
    problem: z.object({ eyebrow: z.string(), heading: z.string(), lede: z.string(), points: z.array(point) }).merge(image),
    how: z.object({ eyebrow: z.string(), heading: z.string(), lede: z.string(), points: z.array(point), strip: z.array(image) }),
    access: z.object({
      eyebrow: z.string(), heading: z.string(), lede: z.string(), closing: z.string().optional(),
      ways: z.array(z.object({
        icon: z.enum(['lab', 'lms', 'laptop', 'phone', 'tablet', 'browser', 'office']),
        title: z.string(), text: z.string(), platforms: z.array(z.string()).optional(),
      })),
    }),
    uses: z.object({ eyebrow: z.string(), heading: z.string(), lede: z.string(), items: z.array(point.extend({ tag: z.string() })) }).optional(),
    results: z.object({
      eyebrow: z.string(), heading: z.string(), lede: z.string(),
      stats: z.array(z.object({ num: z.string(), suffix: z.string().optional(), cap: z.string() })),
      outcomes: z.array(point),
    }),
    team: z.object({
      eyebrow: z.string(), heading: z.string(), lede: z.string(),
      members: z.array(z.object({ name: z.string(), role: z.string(), text: z.string() })),
    }).optional(),
    partners: z.object({ eyebrow: z.string(), heading: z.string(), order: z.array(z.string()).min(1) }),
    contact: z.object({
      eyebrow: z.string(), heading: z.string(), lede: z.string(), email: z.string().email(),
      primary: z.object({ label: z.string(), subject: z.string() }),
      secondary: z.object({ label: z.string(), subject: z.string() }),
    }),
    upcoming: z.object({ heading: z.string(), intro: z.string(), groups: z.array(z.object({ title: z.string(), items: z.array(point) })) }),
  }),
});

/**
 * Partner records shared by both sites; each site's `partners.order` picks
 * which appear and in what order. Wrapped as { items: [...] } because that is
 * what the CMS list widget writes. `id` is the stable `slug`, not position.
 */
const partnersParser = (text: string) => {
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed?.items)) {
    throw new Error('Expected { "items": [...] } — got ' + JSON.stringify(parsed).slice(0, 80));
  }
  return parsed.items.map((item: Record<string, unknown>) => ({ ...item, id: String(item.slug) }));
};

export const PARTNER_GROUPS = ['Partner', 'Supported by'] as const;

const partners = defineCollection({
  loader: file('src/content/partners.json', { parser: partnersParser }),
  schema: z.object({
    slug: z.string(),
    name: z.string(),
    role: z.string(),
    group: z.enum(PARTNER_GROUPS),
    blurb: z.string(),
    logo: z.string(),
  }),
});

export const collections = { blog, sites, partners };
