# Two-audience SiteSeer sites: design

**Date:** 26 Oct 2026
**Status:** approved in conversation ("Go"), 26 Oct 2026

**Supersedes** the homepage section of `2026-08-25-siteseer-web-refinement-design.md`. That spec's tokens, checks and launch checklist (§9) still apply.

## 1. Why

A team meeting on 26 Oct reviewed the brainstorm prototype. It found three problems:

- The site only speaks to educators. Industry prospects (RFIs, defects, limitations) have nothing to read.
- "Students" is too narrow.
- The prototype is not yet publishable.

Agreed direction: one codebase serving two subdomains, `education.siteseer.education` and `industry.siteseer.education`. `siteseer.com` is not available.

## 2. Scope

**In scope**
- Rebuild the homepage from the prototype at `.superpowers/brainstorm/45556-1792966118/content/homepage.html`. That prototype is the visual reference.
- Build two audience variants from one repo.
- Carry the blog into the new design, with posts filtered by audience.
- Deploy both sites to Cloudflare Pages for a copy review.

**Out of scope**
- The real Vectary and site GLB exports. Dummies stand in.
- The root `siteseer.education` chooser. Webflow stays live until promotion.
- CMS OAuth setup, which is an existing open launch step.
- Pricing or pilot terms, because no facts exist yet.

## 3. Architecture

### Audience selection
- The `SITE_AUDIENCE` environment variable (`education` | `industry`) selects the audience, defaulting to `education`.
- `astro.config.mjs` reads it to set `site`:
  - `https://education.siteseer.education`
  - `https://industry.siteseer.education`
- `src/lib/audience.ts` exports `AUDIENCE` and `OTHER` (the other site's URL and label). Pages import from here, never from `import.meta.env` directly.

### Builds and scripts
- Builds output to `dist/` as now.
- New scripts:
  - `build:education` and `build:industry` set the variable and build.
  - `deploy:education` and `deploy:industry` run `wrangler pages deploy dist --project-name siteseer-<audience>`.
- `wrangler` is a devDependency.

### Copy
- Each site's copy is one CMS-editable JSON file:
  - `src/content/sites/education.json`
  - `src/content/sites/industry.json`
- Both share one zod schema, the `sites` collection in `content.config.ts`, holding:
  - hero: kicker, statement, five beats of word, line and optional inspection/pull data
  - problem
  - how
  - access (ways)
  - results (stats and outcomes)
  - partners (ordering and featured set)
  - contact
  - upcoming groups
- The old `home/*.json` collections are removed. `public/admin/config.yml` and `scripts/check-cms-schema.mjs` are updated to match.
- Partner records stay one shared list (`src/content/partners.json`) with logo file and blurb. Each site's JSON chooses which ones it shows and in what order.

### Components
All in `src/components/`:

| Component | Job |
|---|---|
| `Hero3D.astro` | Copy markup, server-rendered from site JSON (works without JS); mounts `src/scripts/hero/` |
| `StageTile.astro` | The "Pause the build" tile; mounts `src/scripts/stage.js` |
| `Problem.astro` | Problem section |
| `HowItWorks.astro` | How it works section |
| `WhereItRuns.astro` | Where it runs section |
| `Results.astro` | Stats and outcomes |
| `Partners.astro` | Partner logo cards |
| `Contact.astro` | Contact section |
| `Upcoming.astro` | Upcoming features |
| `Nav.astro` / `Footer.astro` | Rewritten |

The footer carries the cross-link ("SiteSeer for industry →").

### 3D code
`src/scripts/hero/` is split by job:

| File | Job |
|---|---|
| `scene.js` | Renderer, camera, controls, loading |
| `layers.js` | Clay/real materials, build, pulls |
| `sequence.js` | Step timing, play-once, pause |
| `overlay.js` | Pins, card, hierarchy panel |
| `site.js` | Finale site and fog |

- `sequence.js` stays DOM-free so it can be unit-tested.
- three.js is an npm dependency (`three@0.169.0`), dynamically imported after first paint.
- Rendering pauses off-screen.
- `prefers-reduced-motion` jumps to the final state, with no autoplay.

### Assets
- `public/models/detail.glb` and `public/models/site.glb` are the compressed outputs.
- `tools/models/` holds the generators, `glb.py`, `compress.mjs` and `textures/` (CC0, from Poly Haven).
- `npm run models` rebuilds both models.
- Renders go in `src/images/renders/`, served through `<Picture>` as AVIF/WebP with srcset.
- Logos go in `public/logos/`.

## 4. Education site

The copy follows the prototype, with these changes:

- **Wording:** people using SiteSeer are **learners**; the educator's group is **your cohort**. "Students" does not appear in site copy.
  - The hero statement becomes: "A 3D construction site your learners walk through at any stage of the build, from footings to fit-out. For construction and architecture courses, from high school to degree."
- **LMS treatment:** a single monochrome strip, with all marks forced to one ink tone and one height. It covers Canvas, Moodle, Blackboard, Daymap and SEQTA, the platforms named in the meeting.
  - Where no logo file exists (Daymap, SEQTA), the platform name is set in the same weight, so the row stays even.
- **Upcoming features:** three groups (For learners / For educators / Platform). Each item gets a one-line description, drawn from the existing list.
  - "iOS and Android App" is dropped, because SiteSeer runs on phones now. This needs Andrew to confirm.

## 5. Industry site (draft copy, marked for review)

**Hero beats.** Same model and engine, re-pitched:

| Beat | Line | Detail |
|---|---|---|
| Fast | Find the detail in seconds, at the stage it matters. | |
| Accurate | Modelled to the last flashing. | |
| **Clear** | Raise an RFI against the exact element. | Pin and card: "RFI · Head flashing lap"; the layer is highlighted |
| **Traceable** | Walk a defect back to where it started. | Layer pull: brick off to show the cavity tray and weep holes |
| Immersive | The whole site, before anyone sets foot on it. | |

**Sections**
1. **The problem:** "Drawings don't show the sequence." Points cover RFIs, defects found late, and limitations that aren't written down.
2. **How it works:** the same `StageTile`.
3. **Use cases**, four cards:
   - **RFIs:** pin a question to an element at its stage.
   - **Defects:** step back through the stages to where it went wrong.
   - **Limitations:** record what a detail can't do, against the model.
   - **Inductions:** walk crews through the site before day one.
4. **Where it runs:** office desktops, tablets and phones on site, and the browser viewer.
5. **Partners:** Bates Smart and Unreal first, then the rest.
6. **Contact**, then the blog teaser (industry posts).

All industry copy carries a `draft: true` flag in the JSON. While it is set, a small "Draft copy" note shows in the footer.

## 6. Blog

- Blog frontmatter gains `audience: ['education'] | ['industry'] | ['education','industry']`, defaulting to both.
- Each site's `/blog` and post pages list only posts that include its audience.
- The three existing posts are tagged education.
- The post layout is restyled to the new type and colour.
- The CMS gains the `audience` field.
- The posts' own prose still says "students". That is flagged to Andrew, not rewritten.

## 7. Publishing

- Andrew runs `npx wrangler login` once.
- Two Pages projects are created: `siteseer-education` and `siteseer-industry`.
- Direct-upload deploys give `*.pages.dev` review URLs.
- `noindex` and `robots.txt` stay on.
- The custom subdomains need CNAMEs at IONOS; those are added to `LAUNCH-CHECKLIST.md`.

## 8. Verification

- `npm test` passes, including new tests for the sequence timing and the audience/blog filter.
- `check:cms`, `check:contrast` and `check:spacing` pass.
- `astro check` passes.
- Both audience builds succeed.
- axe reports 0 violations on both homepages and a blog post.
- Headless screenshots of every section at 1440 and 500 px are checked by eye.
- An unanchored first-time-visitor review of the industry site is run before the links go to Andrew.
