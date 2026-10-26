export function postsFor<T extends { data: { audience: readonly string[]; pubDate: Date; draft: boolean } }>(
  posts: T[],
  audience: string,
  opts: { prod: boolean },
): T[];
