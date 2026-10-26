// The audience config is computed once in astro.config.mjs from SITE_AUDIENCE
// and SITE_REVIEW, and baked in at build time (vite.define).
import type { audienceConfig } from './audience-core.mjs';

declare const __AUDIENCE_CONFIG__: ReturnType<typeof audienceConfig>;

export const { audience: AUDIENCE, site: SITE, other: OTHER } = __AUDIENCE_CONFIG__;
