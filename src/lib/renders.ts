// Product renders in src/images/renders/, looked up by the file name the site
// copy uses (e.g. "render-20.jpg"), so <Picture> can size and convert them.
import type { ImageMetadata } from 'astro';

const files = import.meta.glob<{ default: ImageMetadata }>('../images/renders/*.jpg', { eager: true });

export function render(name: string): ImageMetadata {
  const file = files[`../images/renders/${name}`];
  if (!file) throw new Error(`No render called "${name}" in src/images/renders/`);
  return file.default;
}
