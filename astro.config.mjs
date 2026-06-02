import { defineConfig } from 'astro/config';

// Static output (default) — deploys straight to Cloudflare Pages, no adapter needed.
// Cloudflare Pages settings:  Build command: `npm run build`   Output dir: `dist`
export default defineConfig({
  site: 'https://siteseer.education',
  build: { format: 'directory' },
});
