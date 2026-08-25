# SiteSeer — website & blog

Marketing site + blog for **SiteSeer (Building Information)** — construction
digital learning. Built with **Astro** (static output) and bespoke CSS. No build
adapter needed; deploys straight to **Cloudflare Pages**.

## Develop

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # outputs static site to dist/
npm run preview  # preview the built site
```

## Structure

```
src/
  images/                     # swap these — see below
  styles/global.css           # the whole design system
  layouts/Base.astro          # html shell + Nav + Footer + SEO meta
  components/Nav.astro         # simplified header (Platform · Evidence · Blog · Contact)
  components/Footer.astro      # contact footer (reused everywhere)
  pages/index.astro            # homepage (all sections + data at top of frontmatter)
  pages/blog/index.astro       # blog listing
  pages/blog/[...slug].astro   # blog post template
  content/blog/*.md            # blog posts (Markdown)
  content.config.ts            # blog collection schema
```

## Swapping images

Drop the new file in **`src/images/`** — not `public/` — then `import` it at the
top of `src/pages/index.astro` and pass it to the `<Picture>` for that slot.
Slots are labelled **landscape** (desktop/window) or **portrait** (phone).

`src/` is the important part. Images there go through `astro:assets`, which emits
AVIF/WebP derivatives, a `srcset`, and intrinsic `width`/`height` on every
`<img>`. Anything referenced by URL string out of `public/` is shipped
byte-for-byte at full size with no dimensions — which is how the homepage came to
weigh 5.1 MB in two files.

The hero logo is inline SVG in `Nav.astro` — replace with the real vector when
ready.

## Writing blog posts

Add a Markdown file to `src/content/blog/`. Frontmatter:

```yaml
---
title: Your title
description: One-line summary (shows on the card + as the meta description)
pubDate: 2026-06-01
author: Your name
tags: ['Construction education', 'Policy']
draft: false
---
```

## Deploy to Cloudflare Pages

1. Push this repo to GitHub.
2. Cloudflare dashboard → **Pages → Create → Connect to Git**.
3. Build command: `npm run build` · Output directory: `dist`.
4. Add the custom domain `siteseer.education`.

(Or `npx wrangler pages deploy dist` after a local `npm run build`.)

## Typography

Display type is **Archivo** at width 125 (expanded), weight 800, loaded from
Google Fonts. It stands in for **Druk Wide Bold**, the brand's actual display
face — a commercial typeface from Commercial Type that cannot ship in a public
repository without redistributing it.

To restore the real face: drop `DrukWideBold.ttf` into `src/fonts/` (so Vite
bundles and hashes it — `public/` will not work with the `../fonts/` path a
`@font-face` in `src/styles/` resolves), re-add the `@font-face` block, and put
`'Druk Wide Bold'` at the front of the display stack. **Make the repository
private first.**
