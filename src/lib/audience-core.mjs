// Which of the two SiteSeer sites this build is. Read once at build time from
// SITE_AUDIENCE; everything else asks this module, never the env directly.
const SITES = {
  education: { site: 'https://education.siteseer.education', label: 'SiteSeer for education' },
  industry: { site: 'https://industry.siteseer.education', label: 'SiteSeer for industry' },
};

export function audienceConfig(env) {
  const audience = env.SITE_AUDIENCE || 'education';
  if (!SITES[audience]) throw new Error(`SITE_AUDIENCE must be education or industry, got "${audience}"`);
  const otherKey = audience === 'education' ? 'industry' : 'education';
  // Review deploys (SITE_REVIEW=1) live on Cloudflare's pages.dev addresses
  // until the subdomains' DNS exists, so links between the two sites resolve.
  const url = (key) => (env.SITE_REVIEW === '1' ? `https://siteseer-${key}.pages.dev` : SITES[key].site);
  return {
    audience,
    site: url(audience),
    other: { audience: otherKey, href: `${url(otherKey)}/`, label: SITES[otherKey].label },
  };
}
