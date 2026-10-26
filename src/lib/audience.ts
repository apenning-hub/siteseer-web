// The audience is baked in at build time by astro.config.mjs (vite.define).
import { audienceConfig } from './audience-core.mjs';

export const { audience: AUDIENCE, site: SITE, other: OTHER } = audienceConfig({
  SITE_AUDIENCE: import.meta.env.SITE_AUDIENCE,
});
