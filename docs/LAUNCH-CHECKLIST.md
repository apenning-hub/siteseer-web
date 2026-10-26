# Launch checklist: the parts only Andrew can do

## Two sites (October 2026): read this first

The site now builds as **two sites from one repo**: `SITE_AUDIENCE=education`
and `SITE_AUDIENCE=industry` (see `docs/superpowers/specs/2026-10-26-two-audience-sites-design.md`).
That replaces the single `beta.siteseer.education` described in steps 1–2 below.
The OAuth (step 3) and author invite (step 4) still apply, on the education domain.

### A. Review deploys (done from the terminal)

1. `npx wrangler login`, once. This opens a browser to sign in to Cloudflare.
2. `npx wrangler pages project create siteseer-education --production-branch main`
   and `npx wrangler pages project create siteseer-industry --production-branch main`, once each.
3. `npm run deploy:education` and `npm run deploy:industry`. Each prints its
   `*.pages.dev` URL. Re-run them to publish changes.

### B. Subdomains (at IONOS, where siteseer.education's DNS lives)

In each Pages project, go to **Custom domains → Set up a custom domain**, then add the matching CNAME at IONOS:

| Pages project | Custom domain | IONOS record |
|---|---|---|
| `siteseer-education` | `education.siteseer.education` | CNAME `education` → `siteseer-education.pages.dev` |
| `siteseer-industry` | `industry.siteseer.education` | CNAME `industry` → `siteseer-industry.pages.dev` |

Check with `dig +short education.siteseer.education` and `curl -sI https://industry.siteseer.education | head -1`.

### C. CMS sign-in

The OAuth broker (`functions/api/auth`) is served from the **education** site. In step 3 below:
- the Homepage URL is `https://education.siteseer.education`
- the callback is `https://education.siteseer.education/api/auth/callback`
- the encrypted env vars go on the `siteseer-education` Pages project

The industry site's `/admin` signs in through the same broker (`base_url` in `public/admin/config.yml`).

### D. Before promoting either site off review

- **Druk Wide web licence.** The display font is git-ignored (public repo). Deploys must run from a machine that has `public/fonts/druk-wide-bold.woff2`; recreate it from `01_brand/graphics/fonts/Druk Wide Bold.ttf` (Latin subset, woff2) if needed. Without it the site falls back to Archivo. Confirm the web licence (about US$60 for one style at type.today) covers both domains.

- Remove `<meta name="robots" content="noindex, nofollow">` from `src/layouts/Base.astro` and delete `public/robots.txt`.
- Set the industry copy's `"draft": false` (`src/content/sites/industry.json`) once its wording has been reviewed. That removes the "Draft copy" note in the footer.

---

## Original single-site steps (beta.siteseer.education)

Four setup steps that no amount of code can do from inside the repo. They block
`beta.siteseer.education` going live, and they're independent of both Plan A and
Plan B — do them whenever.

Steps 1 and 2 can be done right now. Step 3 needs the domain to resolve first.
Step 4 can be done any time.

**None of this touches `siteseer.education`.** The Webflow site keeps serving the
main domain throughout.

---

## 1. Cloudflare Pages project

Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git.

| Setting | Value |
|---|---|
| Repository | `apenning-hub/siteseer-web` |
| Production branch | `main` |
| Framework preset | Astro |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node version | `22` (set env var `NODE_VERSION` = `22`) |

The first build will fail or produce the current GitHub Pages version until Plan B
Task 5 lands — that's expected and harmless. Nothing is public yet at this point.

---

## 2. DNS record for `beta.siteseer.education`

In the Cloudflare project → Custom domains → Set up a custom domain →
`beta.siteseer.education`.

If `siteseer.education` uses Cloudflare for DNS, Cloudflare adds the CNAME itself
and this is a two-click job. If DNS lives elsewhere, add:

```
Type:   CNAME
Name:   beta
Target: <your-project>.pages.dev
Proxy:  on (orange cloud), if the zone is on Cloudflare
```

Verify before moving on:

```bash
dig +short beta.siteseer.education
curl -sI https://beta.siteseer.education | head -1
```

Expect a CNAME resolving to `pages.dev` and a `200` or `404` — anything that isn't
a DNS failure means the domain is wired up.

---

## 3. GitHub OAuth App

**Do this after step 2**, because the callback URL must match the live domain exactly
or the CMS sign-in fails with a redirect mismatch.

github.com → Settings → Developer settings → OAuth Apps → New OAuth App.

| Field | Value |
|---|---|
| Application name | `SiteSeer CMS` |
| Homepage URL | `https://beta.siteseer.education` |
| Authorization callback URL | `https://beta.siteseer.education/api/auth/callback` |

The callback path must be exactly `/api/auth/callback` — that's the Pages Function
built in Plan B Task 6. A trailing slash will break it.

> **When you later promote off the beta subdomain, this callback must be
> re-registered.** GitHub returns the user to whatever is registered here. If the
> site moves to `siteseer.education` and this still says `beta.`, GitHub sends the
> author back to the beta domain while their sign-in cookie was set on the apex —
> the cookie isn't sent, and the flow dies with an error that points nowhere near
> the cause. The origin allow-list already covers both domains and needs no edit;
> this field does.

Then copy the two credentials into the Pages project → Settings → Environment
variables → **Production**:

| Variable | Value | Type |
|---|---|---|
| `GITHUB_CLIENT_ID` | the Client ID | Plaintext |
| `GITHUB_CLIENT_SECRET` | Generate a new client secret, copy immediately | **Encrypted** |

`GITHUB_CLIENT_SECRET` must be set to **Encrypted**, not Plaintext. The secret is
shown once — if you navigate away before copying it, generate another.

---

## 4. Invite the author

They create a free account at github.com/signup first. Then:

github.com/apenning-hub/siteseer-web → Settings → Collaborators → Add people →
their username → **Write** access.

Write is the minimum that works: the CMS commits directly to `main` on their behalf.
Read access will let them sign in and then fail on save, which is a confusing failure
to debug from the editor.

They need to accept the emailed invitation before the CMS will work for them.

---

## Then

Once all four are done and Plan B has landed, hand them:

- The URL: **https://beta.siteseer.education/admin**
- The guide: `docs/AUTHORING.md`

And do the end-to-end check yourself before they touch it — create a draft, confirm
it is *not* reachable at its URL, untick Draft, confirm it goes live.

---

## Two more things, not blockers

These don't stop the launch but do need you:

- **Approve the partner copy** in `src/content/home/partners.json`. The one-line
  description for each of the seven organisations is drafted, not verified. They are
  factual claims about real organisations and their relationship to SiteSeer.
- **Supply real images.** Six of the eight image slots on the homepage point at the
  same `product-hero.png`. Their alt text cannot be made accurate until distinct
  images exist.
