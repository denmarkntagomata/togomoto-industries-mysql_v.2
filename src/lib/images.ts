// R2 image delivery helper (AGENTS.md §8, spec §8/§9). Originals live in R2 and
// are served through the /media/* route (src/pages/media/[...key].ts) so that
// Cloudflare Image Transformations has a same-origin source to resize. Always
// render <img> with the variant's explicit width/height to avoid CLS.

export type ImageVariant = 'card' | 'carousel' | 'thumb';

// Sized variants per layout. Width/height are the intrinsic dimensions to set on
// the <img> element; Image Transformations produces a matching cover crop.
export const IMAGE_VARIANTS: Record<ImageVariant, { width: number; height: number }> = {
  card: { width: 400, height: 300 },
  carousel: { width: 1200, height: 800 },
  thumb: { width: 160, height: 120 },
};

const MEDIA_PREFIX = '/media/';

// Encode each path segment so keys with spaces/special chars stay valid, while
// the "/" separators in an R2 key are preserved.
function mediaPath(r2Key: string): string {
  const key = r2Key.replace(/^\/+/, '');
  return MEDIA_PREFIX + key.split('/').map(encodeURIComponent).join('/');
}

// Build the delivery URL for a stored image. The Node.js version serves the
// original file from the /media route; the <img> width/height (IMAGE_VARIANTS)
// and CSS object-fit handle sizing. (The Cloudflare version resized images with
// Image Transformations, which is not available on a local server.)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function imageUrl(r2Key: string, _variant: ImageVariant = 'card'): string {
  return mediaPath(r2Key);
}
