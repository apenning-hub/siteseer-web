// Byline details for the blog's author card, keyed by the post's `author`.
export const AUTHORS: Record<string, { name: string; role: string }> = {
  'Andrew Lymn-Penning': { name: 'Andrew Lymn-Penning', role: 'Lecturer in Architecture, Adelaide University' },
  'Damian Madigan': { name: 'Associate Professor Damian Madigan', role: 'SiteSeer research team' },
  SiteSeer: { name: 'The SiteSeer team', role: 'SiteSeer Building Information' },
};
export const authorFor = (author: string) => AUTHORS[author] ?? { name: author, role: 'SiteSeer' };

// About 220 words a minute, rounded up.
export const readingMinutes = (body = '') => Math.max(1, Math.ceil(body.split(/\s+/).filter(Boolean).length / 220));
