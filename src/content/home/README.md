# Homepage content

Edited through the CMS at `/admin` by a non-technical author. Field names here
must stay in step with the Zod schemas in `src/content.config.ts` — if the two
drift, the CMS writes content that fails the build, and the author never sees a
build log.

## hero.lead contains markdown

`lead` carries `**bold**` emphasis. Two consequences:

- **Rendering:** whatever renders the hero must convert the emphasis rather than
  interpolating the string as plain text, or `**building information**` appears
  literally on the page. It is inline emphasis only — bold, nothing else.
- **CMS:** the `lead` field must be a rich-text/markdown widget, not a plain
  string widget, so the author gets a Bold button instead of asterisks.

No other field in this directory contains markup. Keep it that way — the
author should never need to type a symbol to get a visual effect.
