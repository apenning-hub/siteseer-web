# Plan B — Authoring, partners section and beta launch

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move homepage copy into content collections, add a partners section, stand up Sveltia CMS with a GitHub OAuth broker, and launch the site at `beta.siteseer.education` on Cloudflare Pages — so a non-technical author can publish blog posts and edit homepage copy without Andrew and without ever seeing markdown, YAML, git or a build log.

**Architecture:** Hardcoded arrays in `index.astro` move into JSON files under `src/content/home/`, each backed by a Zod schema and surfaced as a Sveltia file collection. The CMS is two static files served from `public/admin/`; authentication is a GitHub OAuth handshake handled by a Cloudflare Pages Function in the same project, so no second service is involved. A schema-drift checker guards the one real maintenance hazard: `config.yml` and `content.config.ts` describe the same data twice.

**Tech Stack:** Astro 5.6 content collections (`file()` loader), Sveltia CMS, Cloudflare Pages + Pages Functions, `yaml` (devDependency, drift checker only), Node 25 built-in test runner.

**Spec:** `docs/superpowers/specs/2026-08-25-siteseer-web-refinement-design.md` §7, §8, §9, §10, §11, §12

**Prerequisite:** Plan A is complete and merged. Plan B restructures `index.astro`, which is cheaper once the CSS has settled.

---

## File Structure

| File | Responsibility | Status |
|---|---|---|
| `src/content/home/hero.json` | Hero kick, headline lines, lead, proof | Create |
| `src/content/home/pillars.json` | The three "expertise" pillars | Create |
| `src/content/home/capabilities.json` | The six capability cards | Create |
| `src/content/home/outcomes.json` | The three outcome cards | Create |
| `src/content/home/stats.json` | The four stat tiles | Create |
| `src/content/home/roadmap.json` | The two marquee rows | Create |
| `src/content/home/partners.json` | Partners and supporters (new) | Create |
| `src/content.config.ts` | Adds one collection per home content file | Modify |
| `src/pages/index.astro` | Reads collections instead of local consts; renders the partners band | Modify |
| `src/pages/blog/[...slug].astro` | Filters drafts out of production builds | Modify |
| `public/admin/index.html` | Sveltia CMS entry point | Create |
| `public/admin/config.yml` | CMS backend, collections and field definitions | Create |
| `public/robots.txt` | Disallow-all while in beta | Create |
| `functions/api/auth/index.js` | Starts the GitHub OAuth handshake | Create |
| `functions/api/auth/callback.js` | Exchanges the code for a token, hands it to the CMS | Create |
| `scripts/check-cms-schema.mjs` | Asserts `config.yml` fields match the Zod schemas | Create |
| `tests/cms-schema.test.mjs` | Unit tests for the drift checker | Create |
| `astro.config.mjs` | Points at `beta.siteseer.education`, drops `base` | Modify |
| `.github/workflows/deploy.yml` | Removed — Cloudflare builds on push | Delete |
| `docs/AUTHORING.md` | One-page guide for the blog author | Create |

---

## Task 1: Fix the draft bug

Drafts are currently hidden from the blog index but still built at a live, guessable URL. This must land before anyone is invited to write.

**Files:**
- Modify: `src/pages/blog/[...slug].astro:5-8`

- [ ] **Step 1: Confirm the bug exists**

```bash
npm run build
grep -c "getCollection('blog')" "src/pages/blog/[...slug].astro"
```

Expected: `1` — an unfiltered call in `getStaticPaths`.

- [ ] **Step 2: Filter drafts out of production builds**

Replace the `getStaticPaths` function in `src/pages/blog/[...slug].astro` with:

```astro
export async function getStaticPaths() {
  // Drafts still render in `npm run dev` so the author can preview them, but
  // are never built into a production deploy. Without this filter a draft is
  // hidden from the blog index while remaining live at a guessable URL.
  const posts = await getCollection('blog', ({ data }) =>
    import.meta.env.PROD ? !data.draft : true
  );
  return posts.map((post) => ({ params: { slug: post.id }, props: { post } }));
}
```

- [ ] **Step 3: Verify with a real draft**

```bash
cat > src/content/blog/_draft-check.md <<'EOF'
---
title: Draft check
description: Temporary file to prove drafts are excluded from production builds.
pubDate: 2026-08-25
draft: true
---
Temporary.
EOF
npm run build
ls dist/blog/
```

Expected: **no** `_draft-check` directory in `dist/blog/`.

- [ ] **Step 4: Remove the probe and commit**

```bash
rm src/content/blog/_draft-check.md
git add "src/pages/blog/[...slug].astro"
git commit -m "fix: draft posts were published at live URLs despite being hidden from the index"
```

---

## Task 2: Home content collections — schemas

**Files:**
- Modify: `src/content.config.ts`
- Create: the seven JSON files under `src/content/home/`

- [ ] **Step 1: Create the content files**

Create `src/content/home/hero.json`:

```json
{
  "kick": "Construction digital learning",
  "headline": ["Walk the", "build before", "it exists"],
  "lead": "SiteSeer turns complex building information into immersive 3D worlds students can walk through — built in real game engines, on hardware they already own.",
  "proof": "Used in real classrooms for over a decade."
}
```

Create `src/content/home/pillars.json`:

```json
{
  "items": [
    { "no": "01", "h": "3D models", "p": "Real buildings, modelled to construction-grade detail and made explorable from any angle, at any stage of the build." },
    { "no": "02", "h": "Game engines & gamification", "p": "Unreal-powered, interactive and rewarding — learning that feels like play, not a lecture, on hardware students already own." },
    { "no": "03", "h": "Construction knowledge", "p": "Sequencing, structure and trade detail, encoded by the people who teach the discipline — not generic 3D." }
  ]
}
```

Create `src/content/home/capabilities.json`:

```json
{
  "items": [
    { "ic": "▦", "h": "Immersive by default", "p": "Walk an active build from any angle, and pause it at footings, frame, lock-up or fit-out." },
    { "ic": "◷", "h": "Construction knowledge", "p": "Sequencing, structure and trade detail, encoded by the educators who teach it — not generic 3D." },
    { "ic": "✓", "h": "Safe & repeatable", "p": "Zero site risk. No PPE or inductions — replay any stage as many times as it takes." },
    { "ic": "◆", "h": "On any device", "p": "Runs on the Windows & macOS laptops students already own. No headset required." },
    { "ic": "⚡", "h": "Gamified & engaging", "p": "Interactive and rewarding — learning that feels like play, not a lecture." },
    { "ic": "⇆", "h": "Tailored depth", "p": "Tune to any skill level, from first-years to final-year cohorts." }
  ]
}
```

Create `src/content/home/outcomes.json`:

```json
{
  "items": [
    { "ic": "★", "h": "Engaged students", "p": "Learning that feels like play, not a lecture." },
    { "ic": "⚙", "h": "Relevant skills", "p": "Real sites, real sequencing, from day one." },
    { "ic": "↗", "h": "Industry-ready", "p": "Confident entry into construction." }
  ]
}
```

Create `src/content/home/stats.json`:

```json
{
  "items": [
    { "num": "1,000+", "cap": "Students taught" },
    { "num": "10 yrs", "cap": "In real classrooms" },
    { "num": "2", "cap": "Platforms today" },
    { "num": "0", "cap": "Site-safety risk" }
  ]
}
```

Create `src/content/home/roadmap.json`:

```json
{
  "rowA": ["Augmented Reality","Learning Outcome Tracking","Customizable Analytics","Progress Monitoring","Data-Driven Insights","Curriculum Improvement","Content Library","Custom Curriculum Integration","Virtual Classrooms","Community & Forums","Interactive Building Phases"],
  "rowB": ["iOS & Android App","In-Environment Tutorials","Scenario-Based Modules","Assessment & Certification","Analytics Dashboard","Detailed Reporting","Feedback Tools","Modular Learning Paths","Real-Time Collaboration","Interactive Questing","Multiplayer Environments"]
}
```

Create `src/content/home/partners.json`. **The `blurb` for each entry is drafted and requires Andrew's sign-off before this section is published — see spec §8.**

```json
{
  "items": [
    { "group": "Partner", "name": "Adelaide University", "role": "Teaching partner", "blurb": "Piloting SiteSeer in undergraduate architecture and construction courses." },
    { "group": "Partner", "name": "AU Online", "role": "Delivery partner", "blurb": "Bringing SiteSeer into fully online construction teaching." },
    { "group": "Partner", "name": "TAFE SA", "role": "Vocational partner", "blurb": "Demonstration program across vocational construction pathways." },
    { "group": "Partner", "name": "Unreal Engine Academic Partner", "role": "Technology", "blurb": "Built in Unreal Engine, under Epic's academic partner program." },
    { "group": "Supported by", "name": "ICC", "role": "Venture support", "blurb": "Backed through the Innovation & Collaboration Centre's venture programs." },
    { "group": "Supported by", "name": "Bates Smart", "role": "Industry support", "blurb": "Industry guidance on how practice actually documents and sequences a build." },
    { "group": "Supported by", "name": "CSIRO ON", "role": "Research translation", "blurb": "Research translation through the CSIRO ON program." }
  ]
}
```

- [ ] **Step 2: Add the collections**

Replace `src/content.config.ts` with:

```ts
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
  blog,
  hero,
  pillars,
  capabilities,
  outcomes,
  stats,
  roadmap,
  partners,
};
```

- [ ] **Step 3: Verify the collections load and validate**

Run: `npm run build`
Expected: exit 0. If a schema and its JSON disagree, Astro fails the build here with the offending file and field named — that is the desired behaviour.

- [ ] **Step 4: Commit**

```bash
git add src/content.config.ts src/content/home/
git commit -m "feat(content): move homepage copy into content collections"
```

---

## Task 3: Read the collections in index.astro

**Files:**
- Modify: `src/pages/index.astro:19-41` and the markup that consumes those arrays

- [ ] **Step 1: Replace the hardcoded arrays with collection reads**

Delete the `pillars`, `capabilities`, `outcomes`, `roadmapA` and `roadmapB` consts from the frontmatter. Add, directly under the existing imports:

```astro
import { getCollection, getEntry } from 'astro:content';

const byIndex = (a: { id: string }, b: { id: string }) => Number(a.id) - Number(b.id);

const hero = (await getEntry('hero', 'hero'))!.data;
const pillars = (await getCollection('pillars')).sort(byIndex).map((e) => e.data);
const capabilities = (await getCollection('capabilities')).sort(byIndex).map((e) => e.data);
const outcomes = (await getCollection('outcomes')).sort(byIndex).map((e) => e.data);
const stats = (await getCollection('stats')).sort(byIndex).map((e) => e.data);
const partners = (await getCollection('partners')).sort(byIndex).map((e) => e.data);
const roadmap = (await getEntry('roadmap', 'roadmap'))!.data;
const roadmapA = roadmap.rowA;
const roadmapB = roadmap.rowB;
```

The `byIndex` sort is required — `getCollection` does not guarantee order, and these are ordered lists.

- [ ] **Step 2: Drive the hero from the collection**

Replace the hero's hardcoded kick, headline, lead and proof markup with:

```astro
          <div class="kick"><span class="ln" aria-hidden="true"></span>{hero.kick}</div>
          <h1 class="h1 druk">
            {hero.headline.map((line) => <span>{line}</span>)}
          </h1>
          <p class="lead">{hero.lead}</p>
          <p class="proof">{hero.proof}</p>
```

- [ ] **Step 3: Drive the stat tiles from the collection**

Replace the four hardcoded `.statc` divs with:

```astro
          {stats.map((s) => (
            <div class="statc glass">
              <div class="num">{s.num}</div>
              <div class="cap">{s.cap}</div>
            </div>
          ))}
```

- [ ] **Step 4: Verify the page is byte-for-byte equivalent**

```bash
git stash && npm run build && cp dist/index.html /tmp/before.html
git stash pop && npm run build && diff <(sed 's/></>\n</g' /tmp/before.html) <(sed 's/></>\n</g' dist/index.html)
```

Expected: no differences, or only whitespace. This proves the refactor changed structure, not output.

- [ ] **Step 5: Commit**

```bash
git add src/pages/index.astro
git commit -m "refactor: read homepage copy from collections instead of inline consts"
```

---

## Task 4: Partners section

**Files:**
- Modify: `src/pages/index.astro`
- Modify: `src/styles/global.css`

- [ ] **Step 1: Add the band**

Insert this section immediately before the `#roadmap` band in `src/pages/index.astro`:

```astro
      <section class="band" id="partners">
        <div class="wrap">
          <div class="eyebrow reveal d1">Partners</div>
          <h2 class="sh druk reveal d1">Who we work with<span class="dot">.</span></h2>

          {['Partner', 'Supported by'].map((group) => (
            <div class="pgroup">
              <h3 class="pgroup-label">{group === 'Partner' ? 'Partners' : 'Supported by'}</h3>
              <div class="fgrid">
                {partners.filter((p) => p.group === group).map((p) => (
                  <div class="fitem glass-light reveal d2">
                    <div class="prole">{p.role}</div>
                    <h4>{p.name}</h4>
                    <p>{p.blurb}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
```

Note the heading levels: the band's `h2` is followed by `h3` group labels and `h4` card names — a correct outline with no skips, matching the Plan A fix.

- [ ] **Step 2: Add the styles**

Add to `global.css` after the feature-grid section:

```css
/* ===== partners ===== */
.pgroup{ margin-top:var(--s6); }
.pgroup-label{
  font-size:11.5px; letter-spacing:.20em; text-transform:uppercase;
  font-weight:700; color:var(--muted); margin-bottom:var(--s4);
}
.prole{
  font-size:10px; letter-spacing:.16em; text-transform:uppercase;
  font-weight:700; color:var(--red-deep);
}
.fitem h4{ font-size:15.5px; font-weight:600; margin:var(--s2) 0 var(--s1); letter-spacing:-.01em; }
```

`.fitem p` already exists and needs no change.

- [ ] **Step 3: Add "Partners" to the nav**

In `src/components/Nav.astro`, add to the `links` array between Evidence and Blog:

```js
  { label: 'Partners', href: `${base}#partners` },
```

- [ ] **Step 4: Verify**

```bash
npm run check:spacing && npm run check:contrast && npm run build
```

Expected: all three exit 0. Then `npm run preview` and confirm the band renders two labelled groups — four partner cards and three supporter cards.

- [ ] **Step 5: Commit**

```bash
git add src/pages/index.astro src/components/Nav.astro src/styles/global.css
git commit -m "feat: add partners section with Partner / Supported by grouping"
```

---

## Task 5: Cloudflare config and beta noindex

**Files:**
- Modify: `astro.config.mjs`
- Modify: `src/layouts/Base.astro`
- Create: `public/robots.txt`
- Delete: `.github/workflows/deploy.yml`

- [ ] **Step 1: Repoint Astro at the beta domain**

Replace `astro.config.mjs` with:

```js
import { defineConfig } from 'astro/config';

// Beta deploy on Cloudflare Pages. When promoting to the main domain, change
// `site` to https://siteseer.education and follow the checklist in
// docs/superpowers/specs/2026-08-25-siteseer-web-refinement-design.md §9.
export default defineConfig({
  site: 'https://beta.siteseer.education',
  build: { format: 'directory' },
});
```

`base` is deleted — internal URLs shorten from `/siteseer-web/…` to `/…`. `Nav.astro` reads `import.meta.env.BASE_URL`, which becomes `/`, so it follows automatically with no edit.

- [ ] **Step 2: Add the noindex meta**

Add to `<head>` in `src/layouts/Base.astro`, directly after the `<meta name="description">` line:

```astro
    <!-- BETA ONLY. A beta subdomain serving near-identical copy would compete
         with siteseer.education in search. Remove this line and public/robots.txt
         when promoting to the main domain — spec §9. -->
    <meta name="robots" content="noindex, nofollow" />
```

- [ ] **Step 3: Add robots.txt**

Create `public/robots.txt`:

```
# BETA ONLY — remove this file when promoting to siteseer.education (spec §9).
User-agent: *
Disallow: /
```

- [ ] **Step 4: Remove the GitHub Pages workflow**

```bash
git rm .github/workflows/deploy.yml
```

Cloudflare Pages builds on push. Keeping both means two deploy targets silently diverging.

- [ ] **Step 5: Verify the base path is gone**

```bash
npm run build
grep -c "/siteseer-web/" dist/index.html || echo "0 occurrences — correct"
```

Expected: `0 occurrences — correct`.

- [ ] **Step 6: Verify noindex is present on every page**

```bash
grep -L 'name="robots"' dist/index.html dist/blog/index.html dist/blog/*/index.html
```

Expected: no output — every page carries the tag.

- [ ] **Step 7: Commit**

```bash
git add astro.config.mjs src/layouts/Base.astro public/robots.txt
git commit -m "feat: target beta.siteseer.education on Cloudflare Pages, noindex while in beta"
```

---

## Task 6: OAuth broker

> **Verify before building.** The Decap/Sveltia popup handshake below is written from the documented protocol, but the exact message format has changed between major versions. Before writing code, check the current Sveltia CMS authentication docs. **If they differ from what is written here, deploy the official `sveltia-cms-auth` Cloudflare Worker instead of these two functions** and skip to Task 7 — an official broker is preferable to a hand-rolled one that must track upstream changes.

**Files:**
- Create: `functions/api/auth/index.js`
- Create: `functions/api/auth/callback.js`

- [ ] **Step 1: Write the authorize endpoint**

Create `functions/api/auth/index.js`:

```js
/**
 * Starts the GitHub OAuth handshake for Sveltia CMS.
 * The CMS opens this in a popup; we redirect to GitHub, which redirects back
 * to ./callback. A random state value is round-tripped in an HttpOnly cookie
 * to prevent CSRF on the callback.
 */
export async function onRequest({ request, env }) {
  const url = new URL(request.url);

  if (!env.GITHUB_CLIENT_ID) {
    return new Response('GITHUB_CLIENT_ID is not configured', { status: 500 });
  }

  const state = crypto.randomUUID();
  const authorize = new URL('https://github.com/login/oauth/authorize');
  authorize.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
  authorize.searchParams.set('redirect_uri', `${url.origin}/api/auth/callback`);
  authorize.searchParams.set('scope', url.searchParams.get('scope') || 'repo,user');
  authorize.searchParams.set('state', state);

  return new Response(null, {
    status: 302,
    headers: {
      Location: authorize.toString(),
      'Set-Cookie': `oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`,
    },
  });
}
```

- [ ] **Step 2: Write the callback endpoint**

Create `functions/api/auth/callback.js`:

```js
/**
 * Completes the GitHub OAuth handshake and hands the token to the CMS popup
 * via postMessage, then the popup closes itself.
 */
function respond(status, payload, origin) {
  const message = `authorization:github:${status}:${JSON.stringify(payload)}`;
  const body = `<!doctype html><meta charset="utf-8"><title>Signing in…</title><body>
<script>
  (function () {
    var message = ${JSON.stringify(message)};
    var origin = ${JSON.stringify(origin)};
    function send() { window.opener && window.opener.postMessage(message, origin); }
    window.addEventListener('message', send, { once: true });
    send();
    setTimeout(function () { window.close(); }, 1000);
  })();
</script>
<p>Signing in…</p></body>`;
  return new Response(body, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const expected = (request.headers.get('Cookie') || '').match(/oauth_state=([^;]+)/)?.[1];

  if (!code || !state || state !== expected) {
    return respond('error', { message: 'Invalid or expired OAuth state' }, url.origin);
  }

  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });

  const data = await response.json();
  if (!data.access_token) {
    return respond('error', { message: data.error_description || 'Token exchange failed' }, url.origin);
  }

  return respond('success', { token: data.access_token, provider: 'github' }, url.origin);
}
```

- [ ] **Step 3: Verify locally**

```bash
npx --yes wrangler pages dev dist --compatibility-date=2026-08-25
```

Then: `curl -sI 'http://localhost:8788/api/auth?scope=repo' | head -3`
Expected: `HTTP/1.1 302` with a `Location:` header pointing at `github.com/login/oauth/authorize`. Without secrets configured locally it will instead return `500 GITHUB_CLIENT_ID is not configured` — also a correct result, and proof the function is routed.

- [ ] **Step 4: Commit**

```bash
git add functions/
git commit -m "feat(cms): add GitHub OAuth broker as a Cloudflare Pages Function"
```

---

## Task 7: Sveltia CMS

**Files:**
- Create: `public/admin/index.html`
- Create: `public/admin/config.yml`

- [ ] **Step 1: Create the CMS entry point**

Create `public/admin/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex, nofollow" />
    <title>SiteSeer — content</title>
  </head>
  <body>
    <script src="https://unpkg.com/@sveltia/cms/dist/sveltia-cms.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Create the CMS config**

Create `public/admin/config.yml`. Every field name here must match the Zod schemas in `src/content.config.ts` — Task 8 adds a checker that enforces it.

```yaml
backend:
  name: github
  repo: apenning-hub/siteseer-web
  branch: main
  base_url: https://beta.siteseer.education
  auth_endpoint: api/auth

# Direct commits to main. Editorial workflow is deliberately OFF — see spec §10.
publish_mode: simple

media_folder: public/images/blog
public_folder: /images/blog

collections:
  - name: blog
    label: Blog posts
    label_singular: Blog post
    folder: src/content/blog
    create: true
    slug: '{{slug}}'
    extension: md
    format: yaml-frontmatter
    summary: '{{title}} — {{pubDate | date("DD MMM YYYY")}}'
    fields:
      - { name: title, label: Title, widget: string }
      - { name: description, label: Summary, widget: text, hint: One or two sentences. Shown on the blog listing and in search results. }
      - { name: pubDate, label: Publish date, widget: datetime, format: 'YYYY-MM-DD', date_format: 'DD MMM YYYY', time_format: false }
      - { name: updatedDate, label: Updated date, widget: datetime, required: false, format: 'YYYY-MM-DD', date_format: 'DD MMM YYYY', time_format: false }
      - { name: author, label: Author, widget: string, default: SiteSeer }
      - { name: tags, label: Tags, widget: list, default: [], hint: Press Enter after each tag. }
      - { name: draft, label: Draft, widget: boolean, default: true, hint: Drafts are never published. Untick when the post is ready to go live. }
      - { name: body, label: Body, widget: markdown }

  - name: homepage
    label: Homepage
    files:
      - name: hero
        label: Hero
        file: src/content/home/hero.json
        fields:
          - { name: kick, label: Eyebrow, widget: string }
          - { name: headline, label: Headline lines, widget: list, hint: One entry per line of the big headline. }
          - { name: lead, label: Lead paragraph, widget: text }
          - { name: proof, label: Proof line, widget: string }

      - name: partners
        label: Partners
        file: src/content/home/partners.json
        fields:
          - name: items
            label: Organisations
            widget: list
            fields:
              - { name: group, label: Group, widget: select, options: ['Partner', 'Supported by'] }
              - { name: name, label: Name, widget: string }
              - { name: role, label: Role, widget: string }
              - { name: blurb, label: Description, widget: text }

      - name: pillars
        label: Pillars
        file: src/content/home/pillars.json
        fields:
          - name: items
            label: Pillars
            widget: list
            fields:
              - { name: no, label: Number, widget: string }
              - { name: h, label: Heading, widget: string }
              - { name: p, label: Body, widget: text }

      - name: capabilities
        label: Capabilities
        file: src/content/home/capabilities.json
        fields:
          - name: items
            label: Capabilities
            widget: list
            fields:
              - { name: ic, label: Icon glyph, widget: string }
              - { name: h, label: Heading, widget: string }
              - { name: p, label: Body, widget: text }

      - name: outcomes
        label: Outcomes
        file: src/content/home/outcomes.json
        fields:
          - name: items
            label: Outcomes
            widget: list
            fields:
              - { name: ic, label: Icon glyph, widget: string }
              - { name: h, label: Heading, widget: string }
              - { name: p, label: Body, widget: text }

      - name: stats
        label: Stats
        file: src/content/home/stats.json
        fields:
          - name: items
            label: Stats
            widget: list
            fields:
              - { name: num, label: Figure, widget: string }
              - { name: cap, label: Caption, widget: string }

      - name: roadmap
        label: Roadmap marquee
        file: src/content/home/roadmap.json
        fields:
          - { name: rowA, label: Top row, widget: list }
          - { name: rowB, label: Bottom row, widget: list }
```

- [ ] **Step 3: Verify the config is valid YAML and ships**

```bash
npm run build
test -f dist/admin/config.yml && test -f dist/admin/index.html && echo "CMS files present"
npx --yes js-yaml dist/admin/config.yml > /dev/null && echo "config.yml parses"
```

Expected: both lines print.

- [ ] **Step 4: Commit**

```bash
git add public/admin/
git commit -m "feat(cms): add Sveltia CMS for blog and homepage content"
```

---

## Task 8: Schema drift checker

The one real maintenance hazard: `config.yml` and `content.config.ts` describe the same data twice. If they drift, the CMS writes content that fails the build, and the author — who never sees a build log — has no way to know why their post vanished.

**Files:**
- Create: `scripts/check-cms-schema.mjs`
- Test: `tests/cms-schema.test.mjs`
- Modify: `package.json`

- [ ] **Step 1: Add the YAML devDependency**

```bash
npm install --save-dev yaml
```

- [ ] **Step 2: Write the failing test**

Create `tests/cms-schema.test.mjs`:

```js
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
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '.../scripts/check-cms-schema.mjs'`

- [ ] **Step 4: Write the checker**

Create `scripts/check-cms-schema.mjs`:

```js
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
  let nesting = 0;
  for (const line of body.split('\n')) {
    const match = line.match(/^\s*([A-Za-z_][\w]*)\s*:/);
    if (match && nesting === 0) keys.push(match[1]);
    nesting += (line.match(/\(/g) ?? []).length - (line.match(/\)/g) ?? []).length;
  }
  return keys;
}

const COLLECTIONS = [
  'blog', 'hero', 'pillars', 'capabilities', 'outcomes', 'stats', 'roadmap', 'partners',
];

// Running as a script rather than being imported by the tests.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const here = dirname(fileURLToPath(import.meta.url));
  const configYaml = readFileSync(resolve(here, '../public/admin/config.yml'), 'utf8');
  const schemas = readFileSync(resolve(here, '../src/content.config.ts'), 'utf8');

  let failures = 0;
  console.log('CMS / schema drift check\n');

  for (const name of COLLECTIONS) {
    const cmsFields = fieldNamesFor(configYaml, name);
    const zodKeys = zodKeysFor(schemas, name);

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
```

- [ ] **Step 5: Run the tests**

Run: `npm test`
Expected: PASS — 4 new tests pass.

- [ ] **Step 6: Add the script and run it for real**

Add to `"scripts"` in `package.json`:

```json
    "check:cms": "node scripts/check-cms-schema.mjs",
```

Run: `npm run check:cms`
Expected: every collection reports `ok`. If any reports FAIL, fix `config.yml` or `content.config.ts` until they agree — do not relax the checker.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json scripts/check-cms-schema.mjs tests/cms-schema.test.mjs
git commit -m "test: assert CMS config and content schemas cannot drift apart"
```

---

## Task 9: Author handover guide

**Files:**
- Create: `docs/AUTHORING.md`

- [ ] **Step 1: Write the guide**

Create `docs/AUTHORING.md`:

```markdown
# Writing for the SiteSeer blog

You don't need to install anything, and you never need to touch code.

## Signing in

1. Go to **https://beta.siteseer.education/admin**
2. Click **Login with GitHub**
3. Approve the access request the first time only

## Writing a post

1. Click **Blog posts**, then **New Blog post**
2. Fill in the fields:
   - **Title** — the headline
   - **Summary** — one or two sentences. Shown on the blog listing and in Google results
   - **Publish date** — pick a date
   - **Author** — your name
   - **Tags** — press Enter after each one
   - **Draft** — leave this **ticked** while you're still working
   - **Body** — write here. The toolbar handles headings, bold, quotes, lists and links
3. Click **Save** whenever you like. Saving does not publish.

## Publishing

Untick **Draft**, then **Save**. The site rebuilds itself and the post appears
within a couple of minutes.

A ticked draft is never published — it isn't on the site at all, not even at a
hidden address.

## Adding images

Drag an image into the body, or use the image button. Keep them under about 1MB.

## Editing the homepage

Click **Homepage** in the sidebar. Each section is a form: Hero, Partners,
Pillars, Capabilities, Outcomes, Stats, Roadmap. Edit and Save the same way.

## If something goes wrong

Nothing you do in this editor can take the site down. If a save doesn't appear
after five minutes, tell Andrew — don't try to fix it here.
```

- [ ] **Step 2: Commit**

```bash
git add docs/AUTHORING.md
git commit -m "docs: add a plain-English authoring guide for the blog author"
```

---

## Task 10: Full verification

- [ ] **Step 1: Run every automated check**

```bash
npm test
npm run check:contrast
npm run check:spacing
npm run check:cms
npm run build
```

Expected: all five exit 0.

- [ ] **Step 2: Run axe**

In one terminal `npm run preview`, in another `npm run check:a11y`.
Expected: `0 violations`, including on the new partners section.

- [ ] **Step 3: End-to-end CMS check (after Andrew completes Task 11)**

- [ ] Sign in at `https://beta.siteseer.education/admin` with the author's account
- [ ] Create a post, leave Draft ticked, Save. Confirm it does **not** appear at its URL
- [ ] Untick Draft, Save. Confirm the Cloudflare build runs and the post goes live
- [ ] Edit a Partners entry and confirm the homepage updates
- [ ] Deliberately sign in as a user without repo access and confirm the CMS refuses

---

## Task 11: Steps only Andrew can do

These block the beta launch and cannot be automated from the repo.

- [ ] **1. Cloudflare Pages project.** Create it, connect the `apenning-hub/siteseer-web` repo, set build command `npm run build` and output directory `dist`.
- [ ] **2. DNS.** Add the `beta.siteseer.education` record pointing at the Pages project. Leave `siteseer.education` on Webflow untouched.
- [ ] **3. GitHub OAuth App.** Register at github.com/settings/developers with homepage `https://beta.siteseer.education` and callback `https://beta.siteseer.education/api/auth/callback`. Add `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` as **encrypted** Pages environment variables.
- [ ] **4. Invite the author** to the repo as a collaborator with write access. They create a free GitHub account first.
- [ ] **5. Approve the partner copy** in `src/content/home/partners.json`. The `blurb` for each of the seven organisations is drafted, not verified. These are factual claims about real organisations — spec §8.
- [ ] **6. Supply real images** for the six duplicate slots flagged in `index.astro`, or accept that their alt text stays inaccurate.

---

## Self-Review Notes

**Spec coverage:** §7 collections → Tasks 2–3. §8 partners → Task 4 (copy sign-off is Task 11 item 5). §9 hosting and noindex → Task 5. §10 CMS, draft fix, drift rule → Tasks 1, 6, 7, 8. §11 frontmatter validation → Task 8 (the drift checker is the mechanism; Astro's own schema validation at build time is the backstop). §12 manual steps → Task 11.

**Type consistency:** collection names are identical across `content.config.ts` (Task 2), `index.astro` reads (Task 3), `config.yml` (Task 7) and the `COLLECTIONS` array in the drift checker (Task 8) — `blog`, `hero`, `pillars`, `capabilities`, `outcomes`, `stats`, `roadmap`, `partners`. Task 8 fails loudly if any of them fall out of step.

**Known uncertainty, flagged rather than hidden:** the Sveltia OAuth popup handshake in Task 6 is written from the documented Decap-compatible protocol but has not been verified against a running instance. Task 6 opens with an instruction to check the current docs first and fall back to the official `sveltia-cms-auth` worker if they differ. Do not skip that check.

**Deliberately out of scope:** promoting to `siteseer.education`, retiring the Webflow site, and reconciling the two sets of marketing copy — spec §13.
