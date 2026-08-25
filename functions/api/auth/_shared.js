/**
 * Shared logic for the GitHub OAuth broker used by Sveltia CMS.
 *
 * Ported from the official Sveltia CMS Authenticator (Cloudflare Workers script):
 *   https://github.com/sveltia/sveltia-cms-auth/blob/main/src/index.js
 *   commit 25f56e1ed4a96cb25fcb96469c9c99fb6d3713bc (main branch, 2026-08-22)
 *
 * Adapted for Cloudflare Pages Functions in the same project as the static site,
 * instead of deploying the upstream script as a separate Cloudflare Worker. The
 * upstream file is a single `fetch()` handler that switches on `pathname`; here
 * the same logic is split across two files that Pages Functions route to by file
 * path instead: functions/api/auth/index.js (`/api/auth`, was handleAuth) and
 * functions/api/auth/callback.js (`/api/auth/callback`, was handleCallback).
 * Everything below — domain matching, scope selection, the CSRF cookie shape,
 * and the postMessage handshake in outputHTML — is the upstream logic, not a
 * reimplementation from the protocol description. Do not "clean up" divergences
 * from upstream without recording the reason here: the point of a port is that
 * it stays diffable against the source it was taken from.
 *
 * File names starting with `_` are ignored for Pages Functions routing, so this
 * module is importable by the two route files without itself becoming a route.
 */

/** List of supported OAuth providers. Unchanged from upstream. */
export const supportedProviders = ['github', 'gitlab'];

/**
 * OAuth scopes for each provider: the scope to request when the client doesn't ask for one, the
 * separator the provider expects between multiple scopes, and the scopes that may be requested.
 * Unchanged from upstream — see the upstream file's own comment for the full rationale (a client
 * can narrow scope via Sveltia's `auth_scope` option, but only to something in this list; the
 * endpoint is reachable by anyone, so a requested scope isn't taken on trust).
 * @type {Record<string, { default: string, separator: string, allowed: string[] }>}
 */
export const providerScopes = {
  github: {
    default: 'repo,user',
    separator: ',',
    allowed: ['repo', 'public_repo', 'user', 'read:user', 'user:email'],
  },
  gitlab: {
    default: 'api',
    separator: ' ',
    allowed: ['api', 'read_api', 'read_user', 'read_repository', 'write_repository'],
  },
};

/**
 * Work out the OAuth scope to request from the given provider. Unchanged from upstream.
 * @param {string} provider - Backend name, e.g. `github`.
 * @param {string} [requested] - The `scope` parameter from the request, if any.
 * @returns {string} Scope to request.
 */
export const getScope = (provider, requested) => {
  const { default: fallback, separator, allowed } = providerScopes[provider];
  const scopes = (requested ?? '').split(/[\s,]+/).filter(Boolean);

  if (!scopes.length) {
    return fallback;
  }

  if (scopes.every((scope) => allowed.includes(scope))) {
    return scopes.join(separator);
  }

  // eslint-disable-next-line no-console
  console.warn(
    `Ignoring the unsupported "${requested}" scope for ${provider}; requesting "${fallback}".`,
  );

  return fallback;
};

/**
 * Escape the given string for safe use in a regular expression. Unchanged from upstream.
 * @param {string} str - Original string.
 * @returns {string} Escaped string.
 */
export const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Default value for the ALLOWED_DOMAINS setting, used when the env var isn't configured.
 *
 * Upstream ships with no default (unset ALLOWED_DOMAINS means "accept any origin"); this port
 * pins a default instead, covering both this site's current domain and its planned production
 * domain:
 *
 *  - beta.siteseer.education — the site as deployed today.
 *  - siteseer.education — not live yet, listed pre-emptively. If it were left out, promoting
 *    the site from the beta subdomain to the apex domain would silently break CMS sign-in at
 *    that point: the popup's token postMessage would be dropped by the isTrusted() check below
 *    with no error surfaced anywhere obvious, since the failure only shows up the first time
 *    someone tries to sign in from the new domain. Listing it now costs nothing — an unmatched
 *    pattern never matches anything — and removes that promotion-day trap.
 *
 * Override with the ALLOWED_DOMAINS env var (same comma-separated, wildcard-capable format as
 * upstream) if this list ever needs to change without a code deploy.
 */
export const DEFAULT_ALLOWED_DOMAINS = 'beta.siteseer.education, siteseer.education';

/**
 * Convert an ALLOWED_DOMAINS-style value into a list of anchored regular expression sources.
 * The sources are used both for the server-side domain check in index.js and in the
 * client-side script embedded by {@link outputHTML}, so a hostname is matched by the exact
 * same rules on either side. Unchanged from upstream.
 * @param {string} [allowedDomains] - Comma-separated list of hostnames, which may contain a
 * wildcard (`*`).
 * @returns {string[]} Regular expression sources. Empty if the value is empty/unset.
 */
export const getDomainPatterns = (allowedDomains) =>
  (allowedDomains ?? '')
    .split(/,/)
    .map((str) => str.trim())
    .filter(Boolean)
    .map((str) => `^${escapeRegExp(str).replaceAll('\\*', '.+')}$`);

/**
 * Serialize the given value for safe embedding in an inline `<script>` block. Unchanged from
 * upstream.
 * @param {string | boolean | string[]} value - Value to be serialized.
 * @returns {string} JavaScript literal.
 */
export const serialize = (value) => JSON.stringify(value ?? null).replaceAll('<', '\\u003c');

/**
 * Output the HTML response that communicates with the window opener. Unchanged from upstream,
 * except that it takes `allowedDomains` (already resolved against DEFAULT_ALLOWED_DOMAINS by
 * the caller) as an explicit argument instead of reading `env.ALLOWED_DOMAINS` itself — this
 * keeps the one place that applies the default in the two route files, rather than duplicating
 * it inside this shared helper too.
 *
 * The postMessage handshake below is the security-critical part of the whole broker: the popup
 * does NOT send the token to a hardcoded or wildcard origin. It first announces itself to the
 * opener (`authorizing:${provider}` to `'*'`, which carries no secret), waits for the opener to
 * echo that same string back, and only then sends the token — addressed to the `origin` of that
 * echo, which the browser sets and the sender cannot forge. `ALLOWED_DOMAINS` is an additional,
 * optional layer on top of that already-safe mechanism, not a replacement for it.
 * @param {object} args - Options.
 * @param {string} [args.provider] - Backend name, e.g. `github`.
 * @param {string} [args.token] - OAuth token.
 * @param {string} [args.error] - Error message when an OAuth token is not available.
 * @param {string} [args.errorCode] - Error code to be used to localize the error message in
 * Sveltia CMS.
 * @param {string} [args.allowedDomains] - Resolved ALLOWED_DOMAINS value (env var or default).
 * @returns {Response} Response with HTML.
 */
export const outputHTML = ({ provider = 'unknown', token, error, errorCode, allowedDomains }) => {
  const state = error ? 'error' : 'success';
  const content = error ? { provider, error, errorCode } : { provider, token };

  return new Response(
    `
      <!doctype html><html><body><script>
        (() => {
          const trustedPatterns = ${serialize(getDomainPatterns(allowedDomains))};
          const hasToken = ${serialize(!!token)};

          const isTrusted = (origin) => {
            try {
              const { hostname } = new URL(origin);

              return trustedPatterns.some((pattern) => new RegExp(pattern).test(hostname));
            } catch {
              return false;
            }
          };

          window.addEventListener('message', ({ data, origin }) => {
            if (data !== 'authorizing:${provider}') {
              return;
            }

            // Unlike the site_id parameter, which the caller supplies, the origin of a message
            // event is set by the browser and cannot be forged by the sender, so it's the only
            // reliable indication of who opened this popup. An error carries no secret, so it's
            // always passed through to keep the sign-in screen informative
            if (hasToken && trustedPatterns.length && !isTrusted(origin)) {
              return;
            }

            window.opener?.postMessage(
              'authorization:${provider}:${state}:${JSON.stringify(content)}',
              origin
            );
          });
          window.opener?.postMessage('authorizing:${provider}', '*');
        })();
      </script></body></html>
    `,
    {
      headers: {
        'Content-Type': 'text/html;charset=UTF-8',
        // Delete CSRF token
        'Set-Cookie': `csrf-token=deleted; HttpOnly; Max-Age=0; Path=/; SameSite=Lax; Secure`,
      },
    },
  );
};
