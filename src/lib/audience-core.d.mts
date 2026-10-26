export type Audience = 'education' | 'industry';
export function audienceConfig(env: { SITE_AUDIENCE?: string; SITE_REVIEW?: string }): {
  audience: Audience;
  site: string;
  other: { audience: Audience; href: string; label: string };
};
