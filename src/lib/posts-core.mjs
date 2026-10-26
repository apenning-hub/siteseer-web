// The posts one site shows: tagged for its audience, newest first. Drafts
// appear in `astro dev` only, so a draft never ships at a guessable URL.
export function postsFor(posts, audience, { prod }) {
  return posts
    .filter((p) => p.data.audience.includes(audience) && (!prod || !p.data.draft))
    .sort((a, b) => b.data.pubDate - a.data.pubDate);
}
