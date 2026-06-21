import { useEffect, useRef, useState } from 'react';

/**
 * Signature reveal — animates the signature image as if a hand is
 * drawing it across the page, left to right. Uses CSS clip-path to
 * progressively reveal the image; the image itself is unchanged.
 *
 * NOTE: this is a clip-path REVEAL, not a true stroke-by-stroke draw.
 * A true draw animation requires SVG paths (each stroke gets its own
 * stroke-dasharray + stroke-dashoffset animation). The current signature
 * is a PNG raster image with no path data, so we use the closest visual
 * approximation: progressive horizontal reveal at a natural writing
 * cadence (~2.5s). For most viewers this reads as "drawn".
 *
 * To upgrade to true stroke animation later: open sibylle-signature.png
 * in Inkscape, Trace Bitmap to SVG, save as sibylle-signature.svg.
 * Replace this component's <img> with the inline SVG and apply
 * stroke-dasharray / stroke-dashoffset transitions to each path.
 *
 * Honours prefers-reduced-motion: appears instantly with no animation.
 *
 * IntersectionObserver fires the reveal when 40% of the signature is in
 * view — by the time the reader's eye reaches it, the draw is mid-flight.
 * Once revealed, stays revealed; observer disconnects.
 */
export function SignatureDraw({ src, alt, style = {} }) {
  const ref = useRef(null);
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDrawn(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    // Walk up to find a layout-bearing ancestor (img.closest works on
    // any selector; here we want the nearest real layout box). Reason:
    // Chrome's IntersectionObserver computes visible area honouring
    // clip-path — the img starts with clip-path: inset(0 100% 0 0)
    // (zero visible area) so it would ALWAYS report intersectionRatio
    // 0 and the observer would never fire. Also, el.parentElement
    // returns the Astro hydration wrapper (<astro-island>) which has
    // display: contents and a zero-size bounding rect. We need the
    // nearest section/figure/div that has real layout.
    const target = el.closest('section') || el.parentElement || el;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Short delay before drawing starts — feels like the writer
          // briefly considers the page before putting pen down.
          setTimeout(() => setDrawn(true), 250);
          observer.disconnect();
        }
      },
      { threshold: 0.4 }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  return (
    <img
      ref={ref}
      src={src}
      alt={alt}
      style={{
        ...style,
        // clip-path inset(top right bottom left) — when right is 100%,
        // the entire image is hidden. Animating to 0% reveals it
        // left-to-right at the natural writing direction.
        clipPath: drawn ? 'inset(0 0 0 0)' : 'inset(0 100% 0 0)',
        WebkitClipPath: drawn ? 'inset(0 0 0 0)' : 'inset(0 100% 0 0)',
        transition:
          'clip-path 2.5s cubic-bezier(0.65, 0, 0.35, 1), -webkit-clip-path 2.5s cubic-bezier(0.65, 0, 0.35, 1)',
      }}
    />
  );
}
