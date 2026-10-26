import { defineConfig } from 'astro/config';
import { audienceConfig } from './src/lib/audience-core.mjs';

// Two sites from one codebase. SITE_AUDIENCE (education | industry) picks the
// build; each deploys to its own Cloudflare Pages project and subdomain. See
// docs/superpowers/specs/2026-10-26-two-audience-sites-design.md.
const { audience, site } = audienceConfig(process.env);

export default defineConfig({
  site,
  build: { format: 'directory' },
  vite: {
    define: { 'import.meta.env.SITE_AUDIENCE': JSON.stringify(audience) },
  },
});
