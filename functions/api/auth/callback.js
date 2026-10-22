/**
 * `/api/auth/callback` — step 2 of the GitHub OAuth broker for Sveltia CMS.
 *
 * Ported from `handleCallback()` in the official Sveltia CMS Authenticator:
 *   https://github.com/sveltia/sveltia-cms-auth/blob/main/src/index.js
 *   commit 25f56e1ed4a96cb25fcb96469c9c99fb6d3713bc (main branch, 2026-08-22)
 *
 * See _shared.js for the full porting note, and index.js for why the path is fixed
 * at `/api/auth/callback` rather than upstream's default `/callback` — this is the
 * exact URL the site owner has been told to register as the OAuth App's callback,
 * per docs/LAUNCH-CHECKLIST.md (on `main`, not present in this worktree/commit).
 *
 * Deviations from upstream in this file:
 *  - Routing: Pages Functions dispatch by file path, so upstream's pathname switch
 *    (`/callback` or `/oauth/redirect`) is dropped — this file only ever serves
 *    `/api/auth/callback`.
 *  - ALLOWED_DOMAINS: falls back to DEFAULT_ALLOWED_DOMAINS (see _shared.js), and
 *    refuses to start if the resolved value has zero usable patterns — this is the
 *    file that can actually issue a token, so a silently-open allow-list matters
 *    most right here (see the guard below).
 *
 * Everything else is unchanged, including the parts that matter most for security:
 *  - No `redirect_uri` is sent to GitHub at either the authorize or token-exchange
 *    step (upstream only sends it for GitLab). This relies on the GitHub OAuth App
 *    having exactly one registered callback URL — GitHub then requires no explicit
 *    redirect_uri and won't accept a request that supplies a mismatched one, so
 *    omitting it here isn't a laxer check, it's what upstream does deliberately.
 *  - The CSRF cookie is read back with upstream's exact regex and shape
 *    (`csrf-token=${provider}_${csrfToken}`) and compared to the `state` query
 *    param before any token exchange happens.
 *
 * GITHUB_CLIENT_SECRET is read from env, sent to GitHub's token endpoint over HTTPS
 * in the POST body, and never logged, echoed, or placed in any response returned
 * from this function — including the error paths below, none of which include env
 * values in their message text.
 */
import {
  supportedProviders,
  outputHTML,
  getDomainPatterns,
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
  const { code, state } = Object.fromEntries(searchParams);
  // `env.ALLOWED_DOMAINS` may be present but blank — the Cloudflare Pages dashboard saves an
  // empty value without complaint — so a blank or whitespace-only value is treated as unset,
  // same as a truly missing one.
  const allowedDomains = env.ALLOWED_DOMAINS?.trim() || DEFAULT_ALLOWED_DOMAINS;

  const [, provider, csrfToken] =
    request.headers.get('Cookie')?.match(/\bcsrf-token=([a-z-]+?)_([0-9a-f]{32})\b/) ?? [];

  if (!provider || !supportedProviders.includes(provider)) {
    return outputHTML({
      allowedDomains,
      error: 'Your Git backend is not supported by the authenticator.',
      errorCode: 'UNSUPPORTED_BACKEND',
    });
  }

  // Upstream treats an empty allow-list as "accept any origin" — a deliberate opt-in for its
  // own operators. This port promises a safe default instead (DEFAULT_ALLOWED_DOMAINS in
  // _shared.js), so a resolved value with zero usable patterns (e.g. "," or " , ", which survive
  // the blank check above but parse to nothing) is a misconfiguration, not permission to hand a
  // token to whatever origin echoes the handshake. Refuse rather than continue: this is the file
  // that can actually issue a token, and outputHTML's own postMessage trust check — upstream's,
  // not touched here — silently no-ops once its trustedPatterns list is empty. The only way to
  // keep that check meaningful is to guarantee a non-empty allow-list before ever reaching it.
  if (getDomainPatterns(allowedDomains).length === 0) {
    return outputHTML({
      provider,
      error: 'ALLOWED_DOMAINS is set but empty. Refusing to run without an origin allow-list.',
      errorCode: 'MISCONFIGURED_CLIENT',
      allowedDomains: DEFAULT_ALLOWED_DOMAINS,
    });
  }

  if (!code || !state) {
    return outputHTML({
      allowedDomains,
      provider,
      error: 'Failed to receive an authorization code. Please try again later.',
      errorCode: 'AUTH_CODE_REQUEST_FAILED',
    });
  }

  if (!csrfToken || state !== csrfToken) {
    return outputHTML({
      allowedDomains,
      provider,
      error: 'Potential CSRF attack detected. Authentication flow aborted.',
      errorCode: 'CSRF_DETECTED',
    });
  }

  const {
    GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET,
    GITHUB_HOSTNAME = 'github.com',
    GITLAB_CLIENT_ID,
    GITLAB_CLIENT_SECRET,
    GITLAB_HOSTNAME = 'gitlab.com',
  } = env;

  let tokenURL = '';
  let requestBody = {};

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

    tokenURL = `https://${GITHUB_HOSTNAME}/login/oauth/access_token`;
    requestBody = {
      code,
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
    };
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

    tokenURL = `https://${GITLAB_HOSTNAME}/oauth/token`;
    requestBody = {
      code,
      client_id: GITLAB_CLIENT_ID,
      client_secret: GITLAB_CLIENT_SECRET,
      grant_type: 'authorization_code',
      // Fixed to this port's callback path, not upstream's `/callback` — see the path note above.
      redirect_uri: `${origin}/api/auth/callback`,
    };
  }

  let response;
  let token = '';
  let error = '';

  try {
    response = await fetch(tokenURL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });
  } catch {
    //
  }

  if (!response) {
    return outputHTML({
      allowedDomains,
      provider,
      error: 'Failed to request an access token. Please try again later.',
      errorCode: 'TOKEN_REQUEST_FAILED',
    });
  }

  try {
    ({ access_token: token, error } = await response.json());
  } catch {
    return outputHTML({
      allowedDomains,
      provider,
      error: 'Server responded with malformed data. Please try again later.',
      errorCode: 'MALFORMED_RESPONSE',
    });
  }

  return outputHTML({ allowedDomains, provider, token, error });
};
