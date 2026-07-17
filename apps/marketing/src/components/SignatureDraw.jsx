import { useEffect, useRef } from 'react';

/**
 * Signature reveal — a true stroke-traced draw. The signature PNG sits
 * behind an SVG mask; three invisible "spine" paths (hand-fitted to the
 * pen's actual route through the raster: the big S, the connected
 * "ibylle", the i-dot) are stroked white at 34px and animated with
 * stroke-dashoffset, so the ink appears pen-stroke by pen-stroke in
 * writing order. A finishing white rect fades in once the pen lifts,
 * guaranteeing the final frame is the pixel-perfect signature even
 * where the spine bands miss a sliver.
 *
 * The spine coordinates are specific to /about/sibylle-signature.png
 * (600x500). If the signature image is ever replaced, the spines must
 * be re-fitted (skeletonise the new PNG, chart the pen route).
 *
 * Honours prefers-reduced-motion: appears instantly with no animation.
 * IntersectionObserver fires the draw when 40% of the section is in
 * view; once drawn, stays drawn.
 */

// Pen strokes in writing order: [path, duration ms].
const SPINES = [
  // The big S
  ['M 228 140 L 248 122 L 265 102 L 274 85 L 277 68 L 268 46 L 250 32 L 226 28 L 198 36 L 168 52 L 138 76 L 114 104 L 104 150 L 110 170 L 126 187 L 146 204 L 166 222 L 186 236 L 210 252 L 232 267 L 252 287 L 263 320 L 261 352 L 250 385 L 228 408 L 200 428 L 175 446 L 137 460 L 90 465 L 52 462 L 38 442 L 34 415 L 36 391 L 44 372 L 60 345 L 80 325 L 98 308 L 115 294 L 145 272 L 175 255 L 205 246 L 235 238 L 252 230', 1300],
  // "ibylle", one continuous stroke
  ['M 243 282 L 252 270 L 263 230 L 270 190 L 273 220 L 277 252 L 284 264 L 295 252 L 308 215 L 325 160 L 342 110 L 336 150 L 330 175 L 316 230 L 305 258 L 310 270 L 325 270 L 342 258 L 357 233 L 356 258 L 363 270 L 377 273 L 388 268 L 393 230 L 388 252 L 385 270 L 368 330 L 352 362 L 330 388 L 311 388 L 314 360 L 321 338 L 335 318 L 362 290 L 392 262 L 412 250 L 425 242 L 432 200 L 442 163 L 456 128 L 462 120 L 466 158 L 463 205 L 469 248 L 472 274 L 480 252 L 488 205 L 494 155 L 506 126 L 511 122 L 515 157 L 507 175 L 498 195 L 492 235 L 489 262 L 493 273 L 500 258 L 507 240 L 515 222 L 527 210 L 537 207 L 543 218 L 539 234 L 526 248 L 514 258 L 531 260 L 550 254 L 563 241 L 572 233', 1600],
  // The i-dot
  ['M 270 155 L 274 155 L 275 159 L 271 160 L 270 156', 160],
];
const PEN_LIFT = 130;   // pause between strokes
const PEN_DOWN = 250;   // pause before the first stroke
const SETTLE = 450;     // finishing fade

export function SignatureDraw({ src, alt, style = {} }) {
  const svgRef = useRef(null);
  const maskId = useRef('sig-reveal-' + Math.random().toString(36).slice(2, 8));

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const svg = svgRef.current;
    if (!svg) return;
    const strokes = [...svg.querySelectorAll('[data-spine]')];
    const settle = svg.querySelector('[data-settle]');

    const showInstantly = () => {
      strokes.forEach((p) => { p.style.strokeDasharray = 'none'; p.style.strokeDashoffset = '0'; });
      settle.style.opacity = '1';
    };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      showInstantly();
      return;
    }

    const draw = () => {
      let t = PEN_DOWN;
      strokes.forEach((p, i) => {
        const L = p.getTotalLength();
        p.style.strokeDasharray = String(L);
        p.style.strokeDashoffset = String(L);
        p.animate(
          [{ strokeDashoffset: L }, { strokeDashoffset: 0 }],
          { duration: SPINES[i][1], delay: t, easing: 'cubic-bezier(0.45, 0.05, 0.55, 0.95)', fill: 'forwards' }
        );
        t += SPINES[i][1] + PEN_LIFT;
      });
      settle.animate(
        [{ opacity: 0 }, { opacity: 1 }],
        { duration: SETTLE, delay: t - PEN_LIFT, fill: 'forwards' }
      );
    };

    // Observe the SVG itself. (The old clip-path version had to watch
    // the whole section because clip-path zeroed the img's intersectable
    // area — and section-relative thresholds silently never fired on
    // short viewports. A mask doesn't shrink the SVG's layout box, so
    // the signature can watch for itself.)
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          draw();
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 600 500"
      role="img"
      aria-label={alt}
      style={{ aspectRatio: '600 / 500', ...style }}
    >
      <defs>
        <mask id={maskId.current} maskUnits="userSpaceOnUse" x="0" y="0" width="600" height="500">
          <rect width="600" height="500" fill="black" />
          {SPINES.map(([d], i) => (
            <path
              key={i}
              data-spine
              d={d}
              fill="none"
              stroke="#fff"
              strokeWidth="34"
              strokeLinecap="round"
              strokeLinejoin="round"
              // Hidden until JS measures the real length; 4000 exceeds
              // the longest spine so dashoffset = fully undrawn.
              style={{ strokeDasharray: 4000, strokeDashoffset: 4000 }}
            />
          ))}
          <rect data-settle width="600" height="500" fill="white" style={{ opacity: 0 }} />
        </mask>
      </defs>
      <image href={src} width="600" height="500" mask={`url(#${maskId.current})`} />
    </svg>
  );
}
