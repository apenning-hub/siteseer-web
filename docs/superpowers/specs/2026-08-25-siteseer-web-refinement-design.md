# SiteSeer web — refinement, accessibility, CMS and beta launch

**Date:** 2026-08-25
**Repo:** `apenning-hub/siteseer-web`
**Status:** design approved, ready for planning

---

## 1. Purpose

The Astro marketing site and blog was built in June 2026 and deployed once, to a
GitHub Pages test subpath, where it has sat unchanged since. This spec covers the
work needed to make it the real thing: fix the motion and spacing defects, bring it
to WCAG 2.2 AA, move it to a proper beta domain, and hand blog and homepage content
over to a non-technical author so Andrew is out of the publishing loop.

The Webflow site at `siteseer.education` is not touched by any of this.

### Success criteria

1. No `translateY` hover motion anywhere; cursor-tracking spotlight in its place.
2. Entrance animations fire on scroll, not on a page-load timer.
3. Every spacing value in `global.css` is one of nine tokens.
4. Zero WCAG 2.2 AA failures, verified by axe and a committed contrast check.
5. Site live at `beta.siteseer.education`, `noindex`, deploying from Cloudflare Pages.
6. A non-technical author can publish a blog post and edit homepage copy without
   Andrew, without seeing markdown, YAML, git or a build log.

---

## 2. Approach

This spec is delivered as **two implementation plans**, sequenced. They split along the
line where the requirements changed, and each ships something whole:

| Plan | Covers | Spec sections |
|---|---|---|
| **A — the site itself** | Spacing scale, colour split and contrast fixes, focus states, mobile nav, marquee control, landmarks, heading order, motion rework | §3, §4, §5, §6, §11 (contrast + axe) |
| **B — authoring and launch** | Content collections, partners section, Sveltia CMS, OAuth broker, Cloudflare move, `noindex` | §7, §8, §9, §10, §11 (frontmatter validation), §12 |

Plan A is self-contained and verifiable on its own. Plan B depends on A only in that
restructuring `index.astro` is cheaper once the CSS has settled. Running them as one plan
would mean the hosting and CMS changes start moving underneath the visual work before it
has been reviewed.

### Within Plan A

Three sequenced passes in a single `global.css`. The stylesheet is 166 lines; splitting
it into layers would bury the real changes in move noise. Each pass is independently
reviewable:

| Pass | Scope | Expected visual delta |
|---|---|---|
| 1 | Tokens + spacing refactor | A few px in many places; nothing structural |
| 2 | Accessibility | Focus rings, mobile nav, marquee control |
| 3 | Motion | Hover lifts gone, spotlight in, entrances rewired |

The remaining work (content collections, CMS + hosting) is Plan B and is structural rather
than visual.

---

## 3. Spacing scale

Nine steps, all multiples of 4:

| Token | px | Absorbs existing values |
|---|---|---|
| `--s1` | 4 | 5, 6, 7 |
| `--s2` | 8 | 8, 9, 10 |
| `--s3` | 12 | 12 |
| `--s4` | 16 | 14, 15, 16, 18 |
| `--s5` | 24 | 22, 26, 28 |
| `--s6` | 32 | 30, 34, 36 |
| `--s7` | 48 | 40, 44, 48 |
| `--s8` | 72 | 60, 64, 70, 74 |
| `--s9` | 96 | 92, 96 |

All 25 distinct padding/margin values in `global.css` snap onto these. Deliberate,
accepted consequences:

- `.wrap` gutters 44px → 48px (`--s7`); mobile stays 24px (`--s5`)
- `.pill` padding 34px → 24px (loses 10px — the largest single shift on the site)
- `.fitem`, `.statc`, `.pc-body` all land on 24px, so card padding is finally uniform
- Grid gaps 18px → 16px
- Bands 92px → 96px at desktop width

### Vertical rhythm

`.band` gets `padding: var(--band-y) 0` with `--band-y: clamp(48px, 8vw, 96px)`.
A clamp rather than a breakpoint, so the rhythm scales smoothly instead of snapping
at 880px. This removes the 184px of fixed band padding currently eating a quarter of
every phone screen.

### Blog gutter bug

`.post` currently sits outside `.wrap` and hardcodes `padding: 60px 44px 96px`, so it
never responds to the 880px breakpoint — blog posts render with 44px gutters on a
phone while every other page uses 24px. Fix: wrap `.post` in `.wrap`, drop its
horizontal padding, keep vertical padding as `--s8` / `--s9`.

---

## 4. Colour and contrast

Eight AA contrast failures all trace to `--red: #e6332a`. Resolution is a token split,
not a brand change — the brand red is untouched everywhere it is recognisably the brand.

| Token | Value | Used for | Ratio |
|---|---|---|---|
| `--red` | `#e6332a` | Logo, hero `h1` (44–80px), icon fills, card top bars, `◆` bullets | 4.31 vs 3.0 needed for large/graphic — passes |
| `--red-deep` | `#c5271f` | `.eyebrow`, `.tagpill`, `.prose a`, `.btn-red` background, `.btn-onred` text | 5.42 on paper, 5.70 white-on-it — passes |

`--red-deep` already exists in the palette. No new colours are introduced.

**Band gradient:** light stop `#ef3b30` → `#e5271e`. White body text on the band goes
from 3.93 (fail) to 4.53 (pass). The mid and deep stops are unchanged.

Greys are already clean — `--muted` on `--paper` is 5.11.

---

## 5. Accessibility

Every item below is a WCAG 2.2 AA failure or a direct enabler of one.

- **2.4.7 Focus Visible.** There is currently not one `:focus` or `:focus-visible` rule
  in the stylesheet; all interaction is `:hover`. Add a 2px `--red-deep` ring at 2px
  offset on every interactive element, with a white variant scoped to `.band-red`,
  `.band-ink` and `.foot` where a red ring would disappear into the background.
- **Mobile navigation.** `.navlinks { display: none }` below 880px with no replacement,
  so Platform / Evidence / Blog / Contact are unreachable on a phone. Add a disclosure
  button: `aria-expanded`, `aria-controls`, Escape closes, focus returns to the trigger.
- **2.2.2 Pause, Stop, Hide.** The roadmap marquee scrolls indefinitely. Hover-pause is
  not keyboard-operable and does not satisfy the criterion. Add a real pause/play toggle
  with `aria-pressed`; keep hover-pause as an extra.
- **2.4.1 Bypass Blocks.** Add a skip link as the first focusable element, visually
  hidden until focused.
- **1.3.1 Landmarks.** `Base.astro` has a bare `<slot />` between Nav and Footer.
  Wrap it in `<main id="main">`.
- **1.3.1 Heading order.** `index.astro` skips `h2 → h4` in the pillars and `h2 → h5`
  in both feature grids. Pillar `h4` → `h3`; feature-grid `h5` → `h3`.
- **Decorative glyphs.** The `.ic` icons (`▦ ◷ ✓ ◆ ⚡ ⇆`) are bare text in a div and are
  announced as meaningless characters. Add `aria-hidden="true"`.
- **Reduced motion.** `html { scroll-behavior: smooth }` is ungated. Wrap in
  `@media (prefers-reduced-motion: no-preference)`.

### Alt text and the image problem

Eight image slots point at only two files: `product-hero.png` is used seven times and
`product-process.jpg` once. The three "first look" phones are the same screenshot three
times, which is why the alt text reads `preview 1`, `preview 2`, `preview 3`.

Write honest descriptive alt for the two real images. **Do not invent distinct
descriptions for the six duplicate slots** — leave a code comment recording that the alt
text cannot be correct until real distinct images exist. This is a content gap for Andrew,
not a code defect.

---

## 6. Motion

One new module, `src/scripts/motion.js`, loaded from `Base.astro`. This is the first
JavaScript on the site; it is roughly 60 lines and ships nothing else.

### Hover: full stillness

Remove every `translateY` on `.btn-red`, `.btn-onred`, `.glass` and `.postcard`.
Buttons keep hover feedback through background and shadow only, so they still read as
pressable without moving.

### Cursor spotlight

A `::after` layer on `.glass` and `.postcard`, a radial gradient positioned by `--mx` /
`--my` custom properties. Updated from `pointermove`, throttled through
`requestAnimationFrame`, opacity fading in on enter and out on leave. Nothing translates,
rotates or scales.

### Entrances

`IntersectionObserver` at a 0.15 threshold adds `.in` and then unobserves. The existing
18px rise and fade are kept — this is the one place motion survives. `d1`–`d6` become
`transition-delay` rather than `animation-delay`.

**No-JS hazard.** `.reveal { opacity: 0 }` currently means that if the animation never
runs, the content is permanently invisible. Scope the `opacity: 0` behind a `.js` class
set by a tiny inline `<head>` script, so without JavaScript the content is simply visible.

### Guards

- `prefers-reduced-motion: reduce` — both behaviours disabled; `.reveal` renders visible
  with no transform.
- `(hover: none)` — spotlight disabled, so touch devices never run pointer tracking.

---

## 7. Homepage content moves into collections

Andrew is to be out of the loop for homepage copy as well as blog posts. The hardcoded
arrays in `index.astro` therefore move into a content collection the CMS can edit.

Moving to `src/content/home/`:

| Source | Becomes |
|---|---|
| `pillars` (3 items) | `pillars.json` |
| `capabilities` (6 items) | `capabilities.json` |
| `outcomes` (3 items) | `outcomes.json` |
| `roadmapA` / `roadmapB` (22 strings) | `roadmap.json` |
| `.statc` block (4 stats, currently inline markup) | `stats.json` |
| Hero kick / headline / lead / proof (inline markup) | `hero.json` |
| **Partners (new — see §8)** | `partners.json` |

Each gets a Zod schema in `content.config.ts` and a matching CMS collection.
`index.astro` reads from the collections instead of local consts.

Staying in code: the image slot map (`img`), layout, and all markup structure.

---

## 8. Partners section (new)

A new band on the homepage. Named cards with a role label, not a logo wall — you hold
usable logo files for only two of the organisations, the UniSA mark is likely stale now
that Andrew is at Adelaide University, and university marks carry an implied-endorsement
problem that would need written permission. Named cards also say what a logo cannot:
what the relationship actually is.

**Heading:** "Who we work with." — deliberately neutral. The earlier draft heading
"Backed by" overclaimed, flattening two different relationships into one implication of
funding or endorsement.

Two labelled groups:

**Partners**
- Adelaide University
- AU Online
- TAFE SA
- Unreal Engine Academic Partner

**Supported by**
- ICC
- Bates Smart
- CSIRO ON

UniSA is not listed.

Reuses the existing `.fgrid` grid and `.fitem` card, so no new layout primitives.
Content lives in `partners.json` so the author can maintain it.

> **Copy sign-off required.** The one-line description for each organisation must be
> written or approved by Andrew before the section is published. These are factual
> claims about real organisations and their relationship to SiteSeer; drafted copy is a
> starting point for correction, never something to publish unreviewed. The Unreal
> Engine Academic Partner entry is text only — the badge mark is not used, so its badge
> usage rules do not apply.

---

## 9. Hosting

Move to Cloudflare Pages at `beta.siteseer.education`. This is what the repo README
always intended; the GitHub Pages subpath was labelled a test deploy in
`astro.config.mjs` from the start.

- `astro.config.mjs`: `site: 'https://beta.siteseer.education'`, `base` deleted. Internal
  URLs shorten from `/siteseer-web/…` to `/…`. `Nav.astro` already reads
  `import.meta.env.BASE_URL`, so it follows automatically.
- **Delete `.github/workflows/deploy.yml`.** Cloudflare Pages builds on push itself;
  keeping both means two deploy targets silently diverging.
- **`noindex` while in beta.** A beta subdomain serving near-identical copy would compete
  with `siteseer.education` in search. Add `<meta name="robots" content="noindex,
  nofollow">` and a disallow-all `robots.txt`. Removing both is step one of the
  promote-to-main checklist.
- Webflow at `siteseer.education` is untouched. Promotion to the main domain is a
  separate, later decision and is out of scope here.

---

## 10. CMS

**Sveltia CMS**, not Decap. Same `config.yml` format and same GitHub backend, but Decap
is barely maintained and its editor is poor; Sveltia is a lighter, actively developed
drop-in with a far better writing experience.

Two static files: `public/admin/index.html` and `public/admin/config.yml`.

- **Backend:** GitHub. OAuth broker as a Cloudflare Pages Function at
  `functions/api/auth/`, reading `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` from
  Pages secrets. Same platform as the site — no second service.
- **Publish mode:** direct commit to `main`. **Editorial workflow is explicitly off** —
  Andrew asked to be out of the loop, so there is no PR gate and no review step.
- **Media:** `media_folder: public/images/blog`, `public_folder: /images/blog`. No post
  currently uses an image; this is new capability.
- **Collections:** `blog` (as today) plus one collection per file in `src/content/home/`.
- **Author account:** the author needs a GitHub account to authenticate. After the
  one-time signup and collaborator invite they only ever see `/admin`.

### Why direct publishing is safe without a review gate

1. The CMS's typed fields mean the author never writes YAML, so malformed frontmatter
   is not reachable through the editor.
2. A failed Cloudflare build does not take the site down — the previous successful
   deploy stays live.
3. The `draft` fix below means parking an unfinished post genuinely keeps it private.

### Draft bug — must fix

`blog/index.astro` filters `!data.draft` out of the listing, but `[...slug].astro` calls
`getCollection('blog')` unfiltered in `getStaticPaths`. A draft is therefore hidden from
the blog index while still being built and published at a live, guessable URL. Gate the
`getStaticPaths` filter on `import.meta.env.PROD` — drafts still render in `npm run dev`
so the author can preview them, but are never built into a production deploy. `draft: true`
then means what it says.

### Principal maintenance risk

`public/admin/config.yml` and the Zod schemas in `content.config.ts` describe the same
data in two places. If they drift, the CMS starts writing content that fails the build —
and the author, who never sees a build log, will not know why their post did not appear.

**Rule: any edit to a schema in `content.config.ts` must be paired with the matching edit
to `config.yml`, in the same commit.** The frontmatter validation in §11 is the backstop
that catches a drift that slips through.

---

## 11. Verification

- `npm run build` clean, and the Cloudflare Pages deploy succeeds.
- **`scripts/check-contrast.mjs` committed to the repo.** Asserts every palette pair
  passes its AA threshold, so a future palette edit cannot silently regress contrast.
  This is the script already used to produce the ratios in §4, made permanent.
- **Frontmatter validation** run against every file in `src/content/` — the backstop for
  CMS/schema drift described in §10.
- One `npx @axe-core/cli` pass over the three page types: homepage, blog index, blog post.
- Manual keyboard pass: tab the full page, confirm every stop has a visible focus
  indicator, and that the mobile nav disclosure and the marquee toggle both operate by
  keyboard alone.

---

## 12. Steps only Andrew can do

These are outside what can be automated from the repo and block the beta launch:

1. Create the Cloudflare Pages project and connect the `siteseer-web` repo.
2. Add the DNS record for `beta.siteseer.education`.
3. Register a GitHub OAuth App with the callback URL, and set `GITHUB_CLIENT_ID` and
   `GITHUB_CLIENT_SECRET` as Cloudflare Pages secrets.
4. Invite the blog author to the repo as a collaborator (they create a free GitHub
   account first).
5. Write or approve the partner one-liners in §8 before that section is published.
6. Supply real, distinct images for the six duplicate slots in §5, or accept that their
   alt text stays inaccurate.

---

## 13. Explicitly out of scope

- Promoting the site to `siteseer.education`, and retiring or reconciling the Webflow
  site. A separate decision once the beta has been assessed.
- Reconciling the Astro site's marketing copy against the Webflow site's — they currently
  make different pitches.
- Splitting `global.css` into layered files.
- Any change to the SiteSeer brand red itself.
