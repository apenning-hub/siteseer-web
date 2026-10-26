import { defineConfig } from 'astro/config';
import { audienceConfig } from './src/lib/audience-core.mjs';

// Two sites from one codebase. SITE_AUDIENCE (education | industry) picks the
// build; each deploys to its own Cloudflare Pages project and subdomain. See
// docs/superpowers/specs/2026-10-26-two-audience-sites-design.md.
const config = audienceConfig(process.env);
const { audience, site } = config;

export default defineConfig({
  site,
  build: { format: 'directory' },
  vite: {
    // The whole computed config, so pages never read the environment themselves.
    define: { __AUDIENCE_CONFIG__: JSON.stringify(config) },
  },
});
