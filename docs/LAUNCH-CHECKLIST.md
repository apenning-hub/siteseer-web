# Beta launch checklist — the parts only Andrew can do

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
