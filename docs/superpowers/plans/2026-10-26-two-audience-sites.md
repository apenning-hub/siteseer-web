# Two-audience SiteSeer sites: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Astro site from the approved brainstorm prototype as two audience builds, education and industry. The blog carries over and is filtered by audience, and both builds deploy to Cloudflare Pages for a copy review.

**Architecture:** `SITE_AUDIENCE` picks the build. Each audience's copy is one CMS-editable JSON file. Section components are shared. The prototype's three.js hero becomes ES modules bundled by Vite, and the models come from scripts in `tools/models/`.

**Tech stack:**
- Astro 5.6 with content collections (zod)
- three@0.169.0 with meshopt
- Sveltia CMS
- Node's built-in test runner
- Cloudflare Pages, deployed with wrangler
- Python for the model generators, with glTF-Transform for compression

**Spec:** `docs/superpowers/specs/2026-10-26-two-audience-sites-design.md`

**Visual reference:** the prototype at `.superpowers/brainstorm/45556-1792966118/content/homepage.html`. Its sources are in the session scratchpad:
- `hero3/loop-template.html` (the hero)
- `hero3/page-template.html` (the page)
- `dummy-detail/` (the model pipeline)
- `logos/`

---

## File map

| Path | Responsibility |
|---|---|
| `src/lib/audience-core.mjs` | Pure: `audienceConfig(env)` → `{ audience, site, other }` |
| `src/lib/audience.ts` | Re-exports `audienceConfig(import.meta.env)` for pages |
| `src/lib/posts-core.mjs` | Pure: `postsFor(posts, audience)`, filters and sorts |
| `src/scripts/hero/sequence.js` | Pure step clock: `createSequence(steps, {hold})` → `{ at(t) }` |
| `src/scripts/hero/scene.js` | Renderer, camera, controls, lights, resize, off-screen pause |
| `src/scripts/hero/layers.js` | Layer discovery, clay/real material blend, build, pulls |
| `src/scripts/hero/site.js` | Finale site load, fade-in, fog |
| `src/scripts/hero/overlay.js` | Pins, info card, hierarchy panel |
| `src/scripts/hero/index.js` | Wires the above to the DOM from `#hero` data attributes |
| `src/scripts/stage.js` | The "Pause the build" tile |
| `src/components/*.astro` | Nav, Footer, Hero3D, Problem, HowItWorks, StageTile, WhereItRuns, Results, Partners, Contact, Upcoming |
| `src/content/sites/{education,industry}.json` | Per-audience copy |
| `src/content/partners.json` | Shared partner records |
| `tools/models/*` | `glb.py`, `make_detail.py`, `make_site.py`, `compress.mjs`, `textures/` |
| `public/models/{detail,site}.glb` | Compressed model outputs |
| `public/logos/*` | Partner and LMS marks |
| `src/images/renders/*.jpg` | Source renders for `<Picture>` |

---

### Task 1: Audience switch

**Files:**
- Create: `src/lib/audience-core.mjs`, `src/lib/audience.ts`, `tests/audience.test.mjs`
- Modify: `astro.config.mjs`, `package.json`

- [ ] **Step 1: Write the failing test.** Create `tests/audience.test.mjs`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { audienceConfig } from '../src/lib/audience-core.mjs';

test('defaults to education', () => {
  const c = audienceConfig({});
  assert.equal(c.audience, 'education');
  assert.equal(c.site, 'https://education.siteseer.education');
  assert.equal(c.other.audience, 'industry');
});

test('industry points across to education', () => {
  const c = audienceConfig({ SITE_AUDIENCE: 'industry' });
  assert.equal(c.site, 'https://industry.siteseer.education');
  assert.equal(c.other.href, 'https://education.siteseer.education/');
  assert.equal(c.other.label, 'SiteSeer for education');
});

test('rejects an unknown audience', () => {
  assert.throws(() => audienceConfig({ SITE_AUDIENCE: 'retail' }), /SITE_AUDIENCE/);
});
```

- [ ] **Step 2: Run it.** `node --test tests/audience.test.mjs`. Expected: FAIL (module not found).

- [ ] **Step 3: Implement.** Create `src/lib/audience-core.mjs`:
```js
// Which of the two SiteSeer sites this build is. Read once at build time from
// SITE_AUDIENCE; everything else asks this module, never the env directly.
const SITES = {
  education: { site: 'https://education.siteseer.education', label: 'SiteSeer for education' },
  industry: { site: 'https://industry.siteseer.education', label: 'SiteSeer for industry' },
};

export function audienceConfig(env) {
  const audience = env.SITE_AUDIENCE ?? 'education';
  if (!SITES[audience]) throw new Error(`SITE_AUDIENCE must be education or industry, got "${audience}"`);
  const otherKey = audience === 'education' ? 'industry' : 'education';
  return {
    audience,
    site: SITES[audience].site,
    other: { audience: otherKey, href: `${SITES[otherKey].site}/`, label: SITES[otherKey].label },
  };
}
```

Create `src/lib/audience.ts`:
```ts
import { audienceConfig } from './audience-core.mjs';
export const { audience: AUDIENCE, site: SITE, other: OTHER } = audienceConfig({ SITE_AUDIENCE: import.meta.env.SITE_AUDIENCE });
```

- [ ] **Step 4: Wire it into the config.** In `astro.config.mjs`:
  - import `audienceConfig`
  - set `site: audienceConfig(process.env).site`
  - add `vite: { define: { 'import.meta.env.SITE_AUDIENCE': JSON.stringify(audienceConfig(process.env).audience) } }`
  - update the header comment

- [ ] **Step 5: Add the scripts.** Add to `package.json`:
```json
"build:education": "SITE_AUDIENCE=education astro build",
"build:industry": "SITE_AUDIENCE=industry astro build",
"deploy:education": "npm run build:education && wrangler pages deploy dist --project-name siteseer-education --branch main",
"deploy:industry": "npm run build:industry && wrangler pages deploy dist --project-name siteseer-industry --branch main",
"models": "python3 tools/models/make_detail.py tools/models/out/detail.glb && python3 tools/models/make_site.py tools/models/out/site.glb && node tools/models/compress.mjs tools/models/out/detail.glb public/models/detail.glb && node tools/models/compress.mjs tools/models/out/site.glb public/models/site.glb"
```
Then: `npm i three@0.169.0 && npm i -D wrangler@4 @gltf-transform/core@4.1.1 @gltf-transform/extensions@4.1.1 @gltf-transform/functions@4.1.1 meshoptimizer@0.22.0 sharp@0.33.5 mikktspace@1.1.1 gltf-validator@2`

- [ ] **Step 6: Verify.** Run `npm test`. Expected: all pass, including 3 new tests.

- [ ] **Step 7: Commit.** `feat: SITE_AUDIENCE build switch for the two sites`

---

### Task 2: Model pipeline in the repo

**Files:**
- Create:
  - `tools/models/glb.py`, `make_detail.py`, `make_site.py`, `compress.mjs`, `validate.mjs`
  - `tools/models/textures/*`, `tools/models/README.md`
  - `public/models/detail.glb`, `public/models/site.glb`
- Modify: `.gitignore` (add `tools/models/out/`)

- [ ] **Step 1: Copy the scratchpad sources across.** From `scratchpad/dummy-detail/`, copy:
  - `glb.py`
  - `make_dummy_detail.py` → `make_detail.py`
  - `make_dummy_site.py` → `make_site.py`, with its import changed to `from make_detail import box`
  - `compress.mjs`
  - `validate.mjs`
  - `textures/`

  `README.md` documents:
  - the `Lnn_` / `S_` naming rule and `Lnn_pin` markers
  - `npm run models`
  - texture credits ("CC0, Poly Haven: brown_mud_dry, concrete_floor_worn_001, fine_grained_wood, sand_01, clay_plaster, metal_plate, white_plaster_02")
  - how to swap in the real Vectary export: rename its nodes to the rule, then run `compress.mjs`

- [ ] **Step 2: Build.** Run `mkdir -p tools/models/out public/models && npm run models`. Expected: two "→" lines, detail ≈ 226 KB and site ≈ 920 KB.

- [ ] **Step 3: Validate.** Run `node tools/models/validate.mjs public/models/detail.glb && node tools/models/validate.mjs public/models/site.glb`. Expected: `errors 0` for both.

- [ ] **Step 4: Commit.** `feat: model pipeline (dummy detail + site, CC0 textures, meshopt)`

---

### Task 3: Content model, CMS and schema check

**Files:**
- Modify: `src/content.config.ts`, `public/admin/config.yml`, `scripts/check-cms-schema.mjs`, `tests/cms-schema.test.mjs`
- Create: `src/content/sites/education.json`, `src/content/sites/industry.json`, `src/content/partners.json`
- Delete: `src/content/home/`

- [ ] **Step 1: Write the failing test.** Add to `tests/cms-schema.test.mjs`:
```js
import { COLLECTIONS } from '../scripts/check-cms-schema.mjs';
test('both site files are checked against the one sites schema', () => {
  assert.deepEqual(COLLECTIONS.filter(([, zod]) => zod === 'sites').map(([cms]) => cms), ['education', 'industry']);
});
```
- [ ] **Step 2: Run it.** `npm test`. Expected: FAIL (`COLLECTIONS` is not exported).
- [ ] **Step 3: Update the checker.** In `scripts/check-cms-schema.mjs`:
  - export `COLLECTIONS` as `[cmsName, zodName]` pairs: `[['blog','blog'],['education','sites'],['industry','sites'],['partners','partners']]`
  - change the loop to `for (const [cms, zod] of COLLECTIONS)`, calling `fieldNamesFor(configYaml, cms)` and `zodKeysFor(schemas, zod)`
- [ ] **Step 4: Rewrite the content config.** In `src/content.config.ts`:
  - **blog:** add `audience: z.array(z.enum(['education','industry'])).default(['education','industry'])`.
  - **sites:** use the loader `file('src/content/sites/{audience}.json')`. Use the glob loader with pattern `*.json` and base `./src/content/sites`, so `id` is the audience. The schema's top-level keys are:
    - `draft`: boolean
    - `meta`: title, description
    - `hero`: kicker, statement, steps[]
      - each step: word, line, kind enum `build|focus|inspect|pull|finale`, `cam` {t:[x,y,z], az, polar, r}, optional `hold` (ms) and `focus` (layer number to highlight)
      - optional `inspect[]`: at [x,y,z], kicker, title, text
      - optional `pulls[]`: t, dur, layers[], dv [dx,dz], kicker, title, text, refs?
    - `problem`: eyebrow, heading, lede, points[] (title, text), image, alt, caption
    - `how`: eyebrow, heading, lede, points[] (title, text), strip[] (image, alt, caption)
    - `access`: eyebrow, heading, lede, ways[] (icon enum `lab|lms|laptop|phone|tablet|browser`, title, text, platforms?: string[]), closing
    - `results`: eyebrow, heading, lede, stats[] (num, suffix?, cap), outcomes[] (title, text)
    - `partners`: string[] of partner ids in display order, plus `groups` labels
    - `contact`: eyebrow, heading, lede, primary {label, subject}, secondary {label, subject}, email
    - `upcoming`: heading, intro, groups[] (title, items[] (title, text))
  - **partners:** loader `file('src/content/partners.json')` with `listParser`; schema: id, name, role, group enum `Partner|Supported by`, blurb, logo.
  - Remove the eight `home` collections and their parsers. Keep `listParser` for partners.
- [ ] **Step 5: Write `src/content/sites/education.json`.** Use the prototype copy with the meeting fixes:
  - learners and cohort wording
  - LMS platforms `["Canvas","Moodle","Blackboard","Daymap","SEQTA"]`
  - upcoming in three groups
  - "iOS and Android App" dropped
  - `"draft": false`
- [ ] **Step 6: Write `src/content/sites/industry.json`.** Use the spec §5 copy with `"draft": true`.
- [ ] **Step 7: Write `src/content/partners.json`.** Six records: adelaide-university (merged with AU Online), tafe-sa, unreal-academic-partner, icc, bates-smart and csiro-on, with logo filenames.
- [ ] **Step 8: Update the CMS.** In `public/admin/config.yml`:
  - replace the `home` collection with a `sites` file collection holding two files (`education`, `industry`), with field trees mirroring the schema (object and list widgets)
  - add a `partners` file collection
  - add `audience` (select, multiple) to blog
- [ ] **Step 9: Run checks.** `npm test && npm run check:cms`. Expected: PASS; check:cms prints `ok` for all four.
- [ ] **Step 10: Commit.** `feat: per-audience site copy, shared partners, blog audience field`

---

### Task 4: Blog filtered by audience

**Files:**
- Create: `src/lib/posts-core.mjs`, `tests/posts.test.mjs`
- Modify: `src/pages/blog/index.astro`, `src/pages/blog/[...slug].astro`, blog frontmatter in `src/content/blog/*.md`

- [ ] **Step 1: Write the failing test.** Create `tests/posts.test.mjs`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { postsFor } from '../src/lib/posts-core.mjs';
const p = (id, audience, d, draft = false) => ({ id, data: { audience, pubDate: new Date(d), draft } });
const all = [p('a', ['education'], '2026-01-01'), p('b', ['industry'], '2026-03-01'), p('c', ['education','industry'], '2026-02-01'), p('d', ['education'], '2026-04-01', true)];
test('keeps posts for this audience, newest first, without drafts', () => {
  assert.deepEqual(postsFor(all, 'education', { prod: true }).map((x) => x.id), ['c', 'a']);
  assert.deepEqual(postsFor(all, 'industry', { prod: true }).map((x) => x.id), ['b', 'c']);
});
test('drafts show in dev', () => {
  assert.deepEqual(postsFor(all, 'education', { prod: false }).map((x) => x.id), ['d', 'c', 'a']);
});
```
- [ ] **Step 2: Run it.** `node --test tests/posts.test.mjs`. Expected: FAIL.
- [ ] **Step 3: Implement.** Create `src/lib/posts-core.mjs`:
```js
// The posts one site shows: tagged for its audience, newest first. Drafts
// appear in `astro dev` only, so a draft never ships at a guessable URL.
export function postsFor(posts, audience, { prod }) {
  return posts
    .filter((p) => p.data.audience.includes(audience) && (!prod || !p.data.draft))
    .sort((a, b) => b.data.pubDate - a.data.pubDate);
}
```
- [ ] **Step 4: Use it in the blog pages.** In both blog pages, `postsFor(await getCollection('blog'), AUDIENCE, { prod: import.meta.env.PROD })`. The index heading and lede come from the audience:
  - education: "Construction education, in focus."
  - industry: "Building, in focus."
- [ ] **Step 5: Tag the posts.** Add `audience: ['education']` to the three posts' frontmatter.
- [ ] **Step 6: Verify.** `npm test`. Expected: PASS.
- [ ] **Step 7: Commit.** `feat: blog lists only posts for this site's audience`

---

### Task 5: Hero sequence clock (pure, tested)

**Files:**
- Create: `src/scripts/hero/sequence.js`, `tests/sequence.test.mjs`

- [ ] **Step 1: Write the failing test.** Create `tests/sequence.test.mjs`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSequence } from '../src/scripts/hero/sequence.js';
const steps = [{ hold: 1000 }, {}, { hold: 3000 }];
test('walks the steps once with per-step holds', () => {
  const s = createSequence(steps, { hold: 2000 });
  assert.deepEqual(s.at(0), { step: 0, t: 0, done: false });
  assert.deepEqual(s.at(1500), { step: 1, t: 500, done: false });
  assert.deepEqual(s.at(3200), { step: 2, t: 200, done: false });
  assert.deepEqual(s.at(99999), { step: 2, t: 3000, done: true });
});
test('starting part-way', () => {
  const s = createSequence(steps, { hold: 2000 });
  assert.equal(s.startOf(2), 3000);
});
```
- [ ] **Step 2: Run it.** `node --test tests/sequence.test.mjs`. Expected: FAIL.
- [ ] **Step 3: Implement.** Create `src/scripts/hero/sequence.js`:
```js
// The hero plays its steps once, in order. Given the time since the sequence
// started, this answers which step is showing and how far into it we are.
export function createSequence(steps, { hold }) {
  const holds = steps.map((s) => s.hold ?? hold);
  const starts = holds.map((_, i) => holds.slice(0, i).reduce((a, b) => a + b, 0));
  const total = holds.reduce((a, b) => a + b, 0);
  return {
    startOf: (i) => starts[i],
    holdOf: (i) => holds[i],
    at(elapsed) {
      if (elapsed >= total) return { step: steps.length - 1, t: holds.at(-1), done: true };
      let step = 0;
      while (step < steps.length - 1 && elapsed >= starts[step + 1]) step += 1;
      return { step, t: elapsed - starts[step], done: false };
    },
  };
}
```
- [ ] **Step 4: Verify.** `npm test`. Expected: PASS.
- [ ] **Step 5: Commit.** `feat: pure step clock for the hero sequence`

---

### Task 6: Hero 3D modules

**Files:**
- Create: `src/scripts/hero/{scene,layers,site,overlay,index}.js`, `src/components/Hero3D.astro`

The source is `scratchpad/hero3/loop-template.html`: its `<style>`, its `<section class="hero">` markup, and its module script. Port it as follows:

- [ ] **Step 1: `scene.js`.** Take the renderer, scene, lights, fog, shadow floor, camera, OrbitControls, `resize()` (canvas-sized) and `applyCam`/`camTo`/`ease`, plus the off-screen IntersectionObserver.
  - Export `createScene(host) → { renderer, scene, camera, controls, cam, camTo, applyCam, tickCamera(dt, playing) }`.
  - three is imported from `'three'` and `'three/examples/jsm/...'` (npm), not the importmap.
- [ ] **Step 2: `layers.js`.** Take `withTextureMix`, layer discovery (`LAYER` regex, `baseX/Y/Z`), `paint(focus)`, `lerpReal(k)`, `setLayer`, `stepBuild`, the pull state, and `ORDER`.
  - Export `createLayers(gltf, scene) → { layers, paint, lerpReal, setLayer, startBuild(dir), stepBuild(now), stepPulls(dt, pulling) }`.
- [ ] **Step 3: `site.js`.** Take the lazy site load, `setPart`/`stepSite`/`showSite` and the fog near/far switch.
  - Export `createSite(loader, url, scene, { sun, ground }) → { show(on, instant), step(now) }`.
- [ ] **Step 4: `overlay.js`.** Take `toScreen`, `setCard` (docked and pinned), the pins and the hierarchy-panel toggles.
  - Export `createOverlay({ hero, canvas, camera, card, pinsEl, panel, layers }) → { update(step, t, settled) }`.
- [ ] **Step 5: `index.js`.** Read the steps JSON from `<script type="application/json" id="hero-steps">` and build the word, line and pill DOM, using `createSequence` for timing (replacing `stepT0` arithmetic).
  - Wire pause/play/replay, drag-pauses with a 6 s resume, and `prefers-reduced-motion` (jump to last step, no autoplay).
  - Dynamically import three after `requestIdleCallback` (falling back to `setTimeout(…, 200)`).
- [ ] **Step 6: `Hero3D.astro`.** Props: `hero` (from site JSON).
  - Server-render the kicker as `<h1>`, the statement as `<p class="what">`, the buttons, and an `<ul class="sr">` of all step words and lines (so the content works without JS).
  - Add the `hero-steps` JSON script, the `#icard`, `#pins3d` and `#lpanel` (Hierarchy · Layers/Objects/Tags) markup, and a `<noscript>` still image of the detail (generate `src/images/hero-still.png` with `shoot.mjs` in poster mode).
  - Models load from `/models/detail.glb` and `/models/site.glb`.
- [ ] **Step 7: Verify.** `npm run build:education` builds, and `npx astro preview --port 4321` shows the hero in Chrome. Capture each of the five beats with `node scratchpad/hero3/shootmany.mjs http://localhost:4321/ /tmp/h 1440 860 '[...]'` and check them by eye.
- [ ] **Step 8: Commit.** `feat: 3D hero as bundled modules driven by site JSON`

---

### Task 7: Page styles

**Files:**
- Modify: `src/styles/global.css` (replace the section styles; keep `:root` tokens), `scripts/check-spacing.mjs` (allowlist `--gut`)

- [ ] **Step 1: Write the new styles.** From the prototype's page `<style>`, write the section styles into `global.css`:
  - nav, `.band`, `.red`, `.eyebrow`, `.h2`, `.lede`
  - `.two`, `.points`, `.shot`, `.stagecard`, `.seg`, `.strip`
  - `.ways`, `.way`, `.lms`
  - `.stats`, `.stat`, `.outcomes`
  - `.pgroup`, `.plist`, `.partner`
  - `.upcoming`
  - `.cta-row`, footer
  - blog list and post

  Rules:
  - Every padding, margin and gap uses `var(--sN)`, `--band-y` or a new `--gut:clamp(16px,5vw,72px)` allowlisted in `check-spacing.mjs` with its reason.
  - Radii use `--r*` tokens. Add `--r6:28px` for cards.
- [ ] **Step 2: LMS treatment.** All marks use `filter:brightness(0) saturate(100%)` at `opacity:.75`, height 20px, in one row. Text fallbacks use the same ink at `font:700 14px Inter`.
- [ ] **Step 3: Run checks.** `npm run check:spacing && npm run check:contrast`. Expected: PASS. Add contrast rows for:
  - white on `--band-red-mid` at 16px
  - `--red-deep` on `#fff` at 11px bold
  - `#3d3832` on `#fff`
- [ ] **Step 4: Commit.** `style: page styles for the two-audience homepage`

---

### Task 8: Section components and pages

**Files:**
- Create: `src/components/{Problem,HowItWorks,StageTile,WhereItRuns,Results,Partners,Contact,Upcoming}.astro`, `src/scripts/stage.js`
- Modify: `src/components/Nav.astro`, `src/components/Footer.astro`, `src/layouts/Base.astro`, `src/pages/index.astro`

- [ ] **Step 1: Write the components.** Each takes its slice of the site JSON as props and renders the markup from `page-template.html`, with copy from props.
  - `StageTile` mounts `stage.js` (ported from the page's stage module, models at `/models/*.glb`).
  - `Partners` takes ids and the shared partner list, and renders `<img src="/logos/…">`.
  - `WhereItRuns` renders the LMS strip from `platforms[]`, using a logo if `public/logos/<slug>.svg` exists, else the name.
- [ ] **Step 2: Nav.** Links: How it works, Where it runs, Results, Partners, Blog. CTA: "Start a pilot" (education) or "Talk to us" (industry). The red/paper state is kept. The wordmark keeps the existing brand SVG mark.
- [ ] **Step 3: Footer.** Copyright, a link to the blog, the cross-link `OTHER.label →` to `OTHER.href`, and "Draft copy" when `site.draft`.
- [ ] **Step 4: Base layout.** Title and description come from `site.meta`; noindex is kept.
- [ ] **Step 5: Homepage.** `src/pages/index.astro` does `getEntry('sites', AUDIENCE)` and composes Hero3D → Problem → HowItWorks → WhereItRuns → Results → Partners → Contact → Upcoming.
- [ ] **Step 6: Copy the assets.**
  - Logos: from `scratchpad/logos/` into `public/logos/`, using the filenames in partners.json. Recolour ICC to ink.
  - Blackboard: get its official SVG; if none is found, use the text fallback.
  - Renders 20, 49, 51, 58 and 63: from Dropbox `03_marketing/website/product images/screen capture/` into `src/images/renders/` at 2000 px JPG.
- [ ] **Step 7: Build both.** `npm run build:education && npm run build:industry`. Expected: both succeed.
- [ ] **Step 8: Commit.** `feat: section components and audience homepages`

---

### Task 9: Verification

- [ ] **Step 1: Code checks.** `npm test && npm run check:cms && npm run check:spacing && npm run check:contrast && npx astro check`. Expected: all pass with 0 errors.
- [ ] **Step 2: Accessibility, for each audience.** Build, preview, then:
```
npx --yes @axe-core/cli http://localhost:4321/ http://localhost:4321/blog/ http://localhost:4321/blog/the-site-access-bottleneck/ --chromedriver-path <scratchpad>/cd155/node_modules/chromedriver/lib/chromedriver/chromedriver --exit
```
Expected: 0 violations.
- [ ] **Step 3: Screenshots, for each audience.** Capture every section at 1440×900 and 500×900 with `shootmany.mjs`, and check by eye that:
  - no copy sits over the model
  - nothing overflows its tile
  - the LMS row is even
- [ ] **Step 4: Fresh review.** Run an unanchored first-time-visitor review of the industry site (subagent with screenshots only), then apply its fixes.
- [ ] **Step 5: Commit.** Commit any fixes.

---

### Task 10: Publish for review

- [ ] **Step 1: Log in.** Andrew runs `! npx wrangler login` (interactive).
- [ ] **Step 2: Create the projects.** `npx wrangler pages project create siteseer-education --production-branch main` and the same for `siteseer-industry`.
- [ ] **Step 3: Deploy.** `npm run deploy:education && npm run deploy:industry`. Expected: two `https://<hash>.siteseer-*.pages.dev` URLs.
- [ ] **Step 4: Smoke-test the live builds.** Load both URLs with `shootmany.mjs`, confirming the hero loads and the models fetch with status 200.
- [ ] **Step 5: Update the launch checklist.** In `docs/LAUNCH-CHECKLIST.md`, add:
  - IONOS CNAMEs `education` → `siteseer-education.pages.dev` and `industry` → `siteseer-industry.pages.dev`
  - the custom domains on each Pages project
  - the OAuth callback URL per domain
- [ ] **Step 6: Commit.** `docs: two-site launch steps`. Report the two URLs to Andrew for the copy review.
