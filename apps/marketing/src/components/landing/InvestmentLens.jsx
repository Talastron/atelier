import React, { useState, useEffect, useRef } from 'react';

/**
 * InvestmentLens — "The Annual Report, by way of example."
 *
 * Reframed from a dashboard-style stats grid (which read as "this is your
 * live data") into a printed annual-report extract for a fictional member,
 * Lena. Each figure now sits in a long-form row with rich narrative
 * microcopy that tells her specific story — what the number is, what it
 * cost, what the studio did about it.
 *
 * Same fictional-member device as the Style Manifesto on /about — keeps
 * the demo honest while making the figures land as composed criticism
 * rather than a SaaS metrics screen.
 *
 * Visual format: vellum-style certificate (cream-on-cream with brass
 * border-rule and corner ornaments), so the section reads as a printed
 * page from a yearly report rather than a live dashboard surface. The
 * existing animated count-up is preserved; only the framing and layout
 * have changed.
 */

const BrassRule = () => (
  <span
    aria-hidden="true"
    style={{
      display: 'inline-block',
      width: 24,
      height: '1.5px',
      backgroundColor: 'var(--atelier-brass-300)',
    }}
  />
);

// Four figures from Lena's first twelve months. Each pairs a number with
// a one-paragraph story that names what the number is, what it cost, and
// what the studio did about it.
const FIGURES = [
  {
    numeral: 'N°. I',
    prefix: '£',
    value: 2.84,
    decimals: 2,
    suffix: '',
    label: 'Cost per wear',
    body:
      "Lena's camel cashmere rollneck. Worn forty-seven times since she bought it in October — a piece that has, by the numbers, paid for itself nine times over. The studio flagged it as her highest-returning garment at the end of the first quarter.",
  },
  {
    numeral: 'N°. II',
    prefix: '',
    value: 18,
    decimals: 0,
    suffix: '%',
    label: 'Unworn in twelve months',
    body:
      'Seven garments. Four of them inherited, two bought in haste, one a gift that never fit. The studio flagged them in March; Lena released three by July. The remaining four she has chosen to keep, with reasons noted.',
  },
  {
    numeral: 'N°. III',
    prefix: '',
    value: 247,
    decimals: 0,
    suffix: '',
    label: 'Outfits composed',
    body:
      "From a forty-two-piece collection. The Concierge composed 184 of them in response to a question; the Lookbook holds the 63 Lena composed herself and chose to keep. Every composition is searchable, copyable, replayable.",
  },
  {
    numeral: 'N°. IV',
    prefix: '',
    value: 5.3,
    decimals: 1,
    suffix: '×',
    label: 'Wears unlocked, per piece',
    body:
      'The annual stewardship return. Every garment in her collection has, on average, been worn five-and-a-third times more than it would have been in the year before she joined. The compounding return of attention paid.',
  },
];

function useCountUp(target, decimals, inView, durationMs = 1800) {
  const [value, setValue] = useState(0);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!inView || startedRef.current) return;
    startedRef.current = true;

    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setValue(target);
      return;
    }

    const start = performance.now();
    let rafId;
    const tick = (now) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / durationMs, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(eased * target);
      if (t < 1) rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [inView, target, durationMs]);

  return value.toFixed(decimals);
}

function FigureRow({ figure, inView, isLast, index }) {
  // Each row starts its count-up with a small cascade delay so the figures
  // arrive in sequence — gives the page a "report being read out" rhythm.
  const [rowInView, setRowInView] = useState(false);
  useEffect(() => {
    if (!inView) return;
    const t = setTimeout(() => setRowInView(true), 200 + index * 350);
    return () => clearTimeout(t);
  }, [inView, index]);

  const formatted = useCountUp(figure.value, figure.decimals, rowInView);

  return (
    <div
      className="relative"
      style={{
        paddingBlock: 'clamp(2rem, 4vw, 2.75rem)',
        borderBottom: isLast ? 'none' : '1px solid var(--atelier-stone-200)',
      }}
    >
      {/* Numeral eyebrow */}
      <p
        className="text-[10px] uppercase mb-5"
        style={{
          letterSpacing: '0.4em',
          color: 'var(--atelier-brass-text)',
          fontWeight: 600,
        }}
      >
        {figure.numeral}
      </p>

      {/* Body — figure on the left, label + narrative on the right.
          Stacks on mobile so the figure lands as a separate beat. */}
      <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-y-4 gap-x-10 items-baseline">
        {/* The figure itself */}
        <p
          style={{
            fontFamily: 'var(--atelier-font-display)',
            fontSize: 'clamp(2.75rem, 5.5vw, 4rem)',
            lineHeight: 1,
            letterSpacing: '-0.02em',
            color: 'var(--atelier-stone-900)',
            fontVariantNumeric: 'tabular-nums',
            minWidth: '4ch',
          }}
        >
          {figure.prefix}{formatted}{figure.suffix}
        </p>

        {/* Label + body */}
        <div>
          <h3
            className="mb-3 text-[10px] uppercase"
            style={{
              letterSpacing: '0.32em',
              color: 'var(--atelier-stone-900)',
              fontWeight: 600,
            }}
          >
            {figure.label}
          </h3>
          <p
            style={{
              fontSize: 'clamp(0.9375rem, 1.15vw, 1rem)',
              lineHeight: 1.7,
              color: 'var(--atelier-stone-600)',
              maxWidth: '52ch',
            }}
          >
            {figure.body}
          </p>
        </div>
      </div>
    </div>
  );
}

export function InvestmentLens() {
  const containerRef = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && entry.intersectionRatio > 0.15) {
          setInView(true);
        }
      },
      { threshold: [0, 0.15, 0.5] }
    );
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  return (
    <section
      ref={containerRef}
      style={{
        paddingBlock: 'clamp(5rem, 9vw, 7rem)',
        paddingInline: 'var(--atelier-page-padding)',
        background: 'var(--atelier-cream)',
      }}
    >
      <div
        className="mx-auto"
        style={{ maxWidth: 'var(--atelier-content-max)' }}
      >
        {/* Section header */}
        <div className="text-center mb-14 lg:mb-16">
          <div className="flex items-center justify-center gap-3 mb-5">
            <BrassRule />
            <p
              className="text-[10px] uppercase font-medium"
              style={{ letterSpacing: '0.32em', color: 'var(--atelier-brass-text)' }}
            >
              The Annual Report &middot; By way of example
            </p>
            <BrassRule />
          </div>
          <h2
            className="mx-auto mb-5"
            style={{
              fontFamily: 'var(--atelier-font-display)',
              fontSize: 'clamp(2.25rem, 4vw, 3.25rem)',
              lineHeight: 1.05,
              letterSpacing: '-0.01em',
              color: 'var(--atelier-stone-900)',
              maxWidth: '22ch',
            }}
          >
            A year inside Atelier, <em style={{ fontWeight: 400 }}>in figures</em>.
          </h2>
          <p
            className="mx-auto"
            style={{
              fontSize: 'clamp(0.95rem, 1.1vw, 1.0625rem)',
              lineHeight: 1.65,
              color: 'var(--atelier-stone-500)',
              maxWidth: '54ch',
            }}
          >
            These are the figures from one member's first twelve months. Yours
            are computed live inside the studio, and stay only with you.
          </p>
        </div>

        {/* Vellum certificate frame — the printed-report container that
            holds the figures. Same border-rule + corner-ornament vocabulary
            as the Style Manifesto on /about, so the two sample artefacts
            read as belonging to the same publication. */}
        <article
          className="relative mx-auto"
          style={{
            maxWidth: 820,
            background: '#ffffff',
            border: '1px solid var(--atelier-stone-200)',
            borderRadius: 4,
            padding: 'clamp(2rem, 5vw, 3.5rem) clamp(1.75rem, 4vw, 3.5rem)',
            boxShadow:
              '0 50px 120px -30px rgba(28, 25, 23, 0.12), 0 18px 40px -16px rgba(28, 25, 23, 0.08)',
          }}
        >
          {/* Brass border-rule inside the card */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 18,
              border: '1px solid rgba(212, 179, 120, 0.35)',
              pointerEvents: 'none',
              borderRadius: 2,
            }}
          />

          {/* Corner ornaments — small brass squares at each inner corner */}
          <span aria-hidden="true" style={cornerStyle('top', 'left')} />
          <span aria-hidden="true" style={cornerStyle('top', 'right')} />
          <span aria-hidden="true" style={cornerStyle('bottom', 'left')} />
          <span aria-hidden="true" style={cornerStyle('bottom', 'right')} />

          <div className="relative">
            {/* Report title + frontispiece intro */}
            <header className="text-center mb-2">
              <p
                className="text-[10px] uppercase mb-2"
                style={{
                  letterSpacing: '0.4em',
                  color: 'var(--atelier-brass-text)',
                  fontWeight: 600,
                }}
              >
                The Annual Report
              </p>
              <p
                className="italic"
                style={{
                  fontFamily: 'var(--atelier-font-display)',
                  fontSize: '0.875rem',
                  color: 'var(--atelier-stone-500)',
                }}
              >
                composed for L — , Volume I, MMXXVI
              </p>
            </header>

            {/* Intro paragraph — Lena's setup, italic display serif */}
            <p
              className="italic text-center mx-auto"
              style={{
                fontFamily: 'var(--atelier-font-display)',
                fontSize: 'clamp(1rem, 1.3vw, 1.125rem)',
                lineHeight: 1.7,
                color: 'var(--atelier-stone-700)',
                maxWidth: '50ch',
                margin: 'clamp(1.5rem, 3vw, 2rem) auto clamp(2rem, 4vw, 2.75rem)',
              }}
            >
              This is Lena. She joined in October last year with thirty-two
              pieces in her wardrobe, added ten more by spring, and has been
              logging wears ever since. The figures below are the first
              reading of her closet.
            </p>

            {/* Hairline divider before the figures */}
            <div
              aria-hidden="true"
              style={{
                height: 1,
                background:
                  'linear-gradient(to right, transparent, var(--atelier-stone-200) 15%, var(--atelier-stone-200) 85%, transparent)',
              }}
            />

            {/* The four figures, stacked vertically as a printed-report list */}
            <div>
              {FIGURES.map((figure, i) => (
                <FigureRow
                  key={figure.numeral}
                  figure={figure}
                  inView={inView}
                  isLast={i === FIGURES.length - 1}
                  index={i}
                />
              ))}
            </div>

            {/* Sign-off */}
            <div className="flex flex-col items-center mt-10 gap-3">
              <div className="flex items-center gap-2" aria-hidden="true">
                <span style={{ display: 'inline-block', width: 3, height: 3, borderRadius: '50%', background: 'var(--atelier-brass-300)' }} />
                <span style={{ display: 'inline-block', width: 3, height: 3, borderRadius: '50%', background: 'var(--atelier-brass-600)' }} />
                <span style={{ display: 'inline-block', width: 3, height: 3, borderRadius: '50%', background: 'var(--atelier-brass-300)' }} />
              </div>
              <p
                className="text-center italic"
                style={{
                  fontFamily: 'var(--atelier-font-display)',
                  fontSize: '0.9375rem',
                  color: 'var(--atelier-stone-500)',
                  lineHeight: 1.55,
                  maxWidth: '42ch',
                }}
              >
                Your figures, your story. Computed live. Kept private.
              </p>
              <p
                className="text-center text-[10px] uppercase mt-1"
                style={{
                  letterSpacing: '0.32em',
                  color: 'var(--atelier-stone-500)',
                  fontWeight: 500,
                }}
              >
                Atelier &mdash; The Long Barn, Surrey
              </p>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}

// Small helper — corner ornament absolute-position style. Avoids
// repeating the same five property lines four times in the JSX.
function cornerStyle(vertical, horizontal) {
  return {
    position: 'absolute',
    [vertical]: 14,
    [horizontal]: 14,
    width: 6,
    height: 6,
    background: 'var(--atelier-brass-600)',
    borderRadius: 1,
  };
}
