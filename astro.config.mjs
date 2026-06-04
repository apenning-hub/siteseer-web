import { defineConfig } from 'astro/config';

// TESTING on GitHub Pages → served from a subpath: apenning-hub.github.io/siteseer-web/
// For the production siteseer.education deploy: set `site` to that and delete `base`.
export default defineConfig({
  site: 'https://apenning-hub.github.io',
  base: '/siteseer-web/',
  build: { format: 'directory' },
});
