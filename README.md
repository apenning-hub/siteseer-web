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
public/
  fonts/DrukWideBold.ttf      # display font (headlines)
  images/                     # swap these — see below
src/
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

Open `src/pages/index.astro`. The `img = { … }` object at the top of the
frontmatter maps each slot to a file in `/public/images`. Drop a new file in
`public/images/` and point the slot at it. Slots are labelled **landscape**
(desktop/window) or **portrait** (phone). The hero logo is inline SVG in
`Nav.astro` — replace with the real vector when ready.

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
