import { defineConfig } from 'astro/config';

// Beta deploy on Cloudflare Pages. When promoting to the main domain, change
// `site` to https://siteseer.education and follow the checklist in
// docs/superpowers/specs/2026-08-25-siteseer-web-refinement-design.md §9.
export default defineConfig({
  site: 'https://beta.siteseer.education',
  build: { format: 'directory' },
});
