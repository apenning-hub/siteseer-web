# Homepage content

Edited by a non-technical author through a CMS. The CMS admin UI does not
exist in this repo yet — it is coming in a later task — but these files and
the schemas in `src/content.config.ts` are already the CMS's target format.

Field names here must stay in step with those Zod schemas. Drift does **not**
reliably fail the build:

- **List files** (`pillars.json`, `capabilities.json`, `outcomes.json`,
  `stats.json`, `partners.json`) are wrapped as `{ "items": [...] }`. The
  `file()` loader's parser throws if `items` is missing or not an array — but
  Astro's file loader catches that throw, logs
  `[file-loader] Error reading data from …`, and returns. **The build still
  exits 0, with that collection silently empty.** Zod never runs in this case,
  because there is no data to validate. A CI guard that asserts each
  collection is non-empty (or that the built page actually contains this
  content) is what catches this class of break — not the schema.
- **Field-level mistakes inside a well-formed item** (wrong type, missing
  required key, wrong `group` value) *do* fail the build, because Zod runs
  against real per-item data in that case.

## hero.lead contains markdown

`lead` carries `**bold**` emphasis. Two consequences:

- **Rendering:** whatever renders the hero must convert the emphasis rather than
  interpolating the string as plain text, or `**building information**` appears
  literally on the page. It is inline emphasis only — bold, nothing else.
- **CMS:** the `lead` field must be a rich-text/markdown widget, not a plain
  string widget, so the author gets a Bold button instead of asterisks.

No other field in this directory contains markup. Keep it that way — the
author should never need to type a symbol to get a visual effect.
