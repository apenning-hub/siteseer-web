/**
 * `/api/auth` — step 1 of the GitHub OAuth broker for Sveltia CMS.
 *
 * Ported from `handleAuth()` in the official Sveltia CMS Authenticator:
 *   https://github.com/sveltia/sveltia-cms-auth/blob/main/src/index.js
 *   commit 25f56e1ed4a96cb25fcb96469c9c99fb6d3713bc (main branch, 2026-08-22)
 *
 * See _shared.js for the full porting note. Deviations from upstream in this file:
 *
 *  - Routing: Pages Functions dispatch by file path, so this file only ever serves
 *    `/api/auth` — upstream's pathname switch (`/auth` or `/oauth/authorize`) has
 *    nothing left to switch on and is dropped.
 *  - Path itself: the route is `/api/auth`, not upstream's default `/auth`. This is
 *    fixed, not a style choice — it matches `auth_endpoint: api/auth`, which a later
 *    task will add to public/admin/config.yml (a real, documented Sveltia config
 *    field, but that file doesn't exist in this worktree/commit yet), and the
 *    callback URL the site owner has already registered with GitHub per
 *    docs/LAUNCH-CHECKLIST.md (on `main`, not present here either). Renaming either
 *    side without updating both the config and the GitHub OAuth App breaks sign-in
 *    with a redirect mismatch.
 *  - ALLOWED_DOMAINS: falls back to DEFAULT_ALLOWED_DOMAINS instead of upstream's
 *    "unset means unrestricted" (see _shared.js for why) — and, unlike upstream,
 *    refuses to start at all if the resolved value has zero usable patterns, so a
 *    blank or comma-only env var can't silently reopen the broker (see below).
 *
 * Everything else — scope resolution, the CSRF cookie, and which query params are
 * read — is upstream's logic unchanged.
 *
 * GITHUB_CLIENT_SECRET is never read here (only needed at the callback/token-exchange
 * step) and GITHUB_CLIENT_ID, being a public identifier, is safe to place in the
 * redirect URL as upstream does.
 */
import {
  supportedProviders,
  getScope,
  getDomainPatterns,
  outputHTML,
  DEFAULT_ALLOWED_DOMAINS,
} from './_shared.js';

/**
 * @param {object} context - Cloudflare Pages Function context.
 * @param {Request} context.request - Incoming request.
 * @param {{ [key: string]: string }} context.env - Environment variables / secrets.
 * @returns {Promise<Response>} HTTP response.
 */
export const onRequestGet = async ({ request, env }) => {
  const { origin, searchParams } = new URL(request.url);
  const { provider, site_id: domain, scope: requestedScope } = Object.fromEntries(searchParams);
  // `env.ALLOWED_DOMAINS` may be present but blank — the Cloudflare Pages dashboard saves an
  // empty value without complaint — so a blank or whitespace-only value is treated as unset,
  // same as a truly missing one.
  const allowedDomains = env.ALLOWED_DOMAINS?.trim() || DEFAULT_ALLOWED_DOMAINS;

  if (!provider || !supportedProviders.includes(provider)) {
    return outputHTML({
      allowedDomains,
      error: 'Your Git backend is not supported by the authenticator.',
      errorCode: 'UNSUPPORTED_BACKEND',
    });
  }

  // Upstream treats an empty allow-list as "accept any origin" — a deliberate opt-in for its
  // own operators. This port promises a safe default instead (DEFAULT_ALLOWED_DOMAINS above), so
  // a resolved value with zero usable patterns (e.g. "," or " , ", which survive the blank check
  // above but parse to nothing) is a misconfiguration, not permission to run open. Refuse rather
  // than continue: outputHTML's own postMessage trust check silently no-ops when its
  // trustedPatterns list is empty, and that check is upstream's and is not touched here — the
  // only way to keep it meaningful is to guarantee a non-empty allow-list before reaching it.
  if (getDomainPatterns(allowedDomains).length === 0) {
    return outputHTML({
      provider,
      error: 'ALLOWED_DOMAINS is set but empty. Refusing to run without an origin allow-list.',
      errorCode: 'MISCONFIGURED_CLIENT',
      allowedDomains: DEFAULT_ALLOWED_DOMAINS,
    });
  }

  const scope = getScope(provider, requestedScope);

  const {
    GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET,
    GITHUB_HOSTNAME = 'github.com',
    GITLAB_CLIENT_ID,
    GITLAB_CLIENT_SECRET,
    GITLAB_HOSTNAME = 'gitlab.com',
  } = env;

  const domainPatterns = getDomainPatterns(allowedDomains);

  // Check if the domain is whitelisted
  if (
    domainPatterns.length &&
    !domainPatterns.some((pattern) => new RegExp(pattern).test(domain ?? ''))
  ) {
    return outputHTML({
      allowedDomains,
      provider,
      error: 'Your domain is not allowed to use the authenticator.',
      errorCode: 'UNSUPPORTED_DOMAIN',
    });
  }

  // Generate a random string for CSRF protection
  const csrfToken = globalThis.crypto.randomUUID().replaceAll('-', '');
  let authURL = '';

  // GitHub
  if (provider === 'github') {
    if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
      return outputHTML({
        allowedDomains,
        provider,
        error: 'OAuth app client ID or secret is not configured.',
        errorCode: 'MISCONFIGURED_CLIENT',
      });
    }

    const params = new URLSearchParams({
      client_id: GITHUB_CLIENT_ID,
      scope,
      state: csrfToken,
    });

    authURL = `https://${GITHUB_HOSTNAME}/login/oauth/authorize?${params.toString()}`;
  }

  // GitLab (kept for parity with upstream; unused unless GITLAB_CLIENT_ID/SECRET are ever set —
  // this site only configures GitHub)
  if (provider === 'gitlab') {
    if (!GITLAB_CLIENT_ID || !GITLAB_CLIENT_SECRET) {
      return outputHTML({
        allowedDomains,
        provider,
        error: 'OAuth app client ID or secret is not configured.',
        errorCode: 'MISCONFIGURED_CLIENT',
      });
    }

    const params = new URLSearchParams({
      client_id: GITLAB_CLIENT_ID,
      // Fixed to this port's callback path, not upstream's `/callback` — see the path note above.
      redirect_uri: `${origin}/api/auth/callback`,
      response_type: 'code',
      scope,
      state: csrfToken,
    });

    authURL = `https://${GITLAB_HOSTNAME}/oauth/authorize?${params.toString()}`;
  }

  // Redirect to the authorization server
  return new Response('', {
    status: 302,
    headers: {
      Location: authURL,
      // Cookie expires in 10 minutes; Use `SameSite=Lax` to make sure the cookie is sent by the
      // browser after redirect
      'Set-Cookie':
        `csrf-token=${provider}_${csrfToken}; ` +
        `HttpOnly; Path=/; Max-Age=600; SameSite=Lax; Secure`,
    },
  });
};
