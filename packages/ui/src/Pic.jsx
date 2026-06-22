import React from 'react';

/**
 * Drop-in <img> replacement that serves a WebP version to browsers that
 * support it (~97% of global traffic) and falls back to the original
 * JPEG/PNG for the rest. The WebP path is auto-derived from the source
 * path by swapping the extension — the prebuild image optimizer
 * (apps/marketing/scripts/optimize-images.mjs) guarantees a matching
 * .webp exists for every .jpg/.png in public/seed-wardrobe/.
 *
 * Usage is a verbatim swap:
 *   <img    src="/seed-wardrobe/silk-blouse-ivory.jpg" alt="..." className="..."  style={...} />
 *   <Pic    src="/seed-wardrobe/silk-blouse-ivory.jpg" alt="..." className="..."  style={...} />
 *
 * All <img>-style props (className, style, loading, alt, etc.) pass
 * through to the inner <img>. The <picture> wrapper is layout-neutral —
 * the rendered element is still the <img> inside.
 *
 * For images that don't have a matching .webp (anything outside the
 * auto-optimized seed-wardrobe folder), this component still works:
 * the <source> 404s and the browser silently uses the <img> fallback.
 */
export function Pic({ src, ...imgProps }) {
  const webpSrc = src.replace(/\.(jpe?g|png)$/i, '.webp');
  return (
    <picture>
      <source srcSet={webpSrc} type="image/webp" />
      <img src={src} {...imgProps} />
    </picture>
  );
}
