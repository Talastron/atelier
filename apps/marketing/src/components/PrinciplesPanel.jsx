import { useEffect, useRef, useState } from 'react';

/**
 * The Standard — three principles, scroll-revealed in sequence with a
 * brass hairline that draws beneath each title as the principle arrives.
 * Replaces the static <ul> grid that previously sat on /about; same
 * content and layout, but the moment of arrival becomes a small
 * composition rather than three static columns landing at once.
 *
 * Stagger: each principle delays 140ms after the previous. Total reveal
 * time ~1.1s from first to last — slow enough to feel deliberate, fast
 * enough that the visitor isn't kept waiting.
 *
 * Hairline draws via inline-style transition on width once the parent
 * observer fires; from centre outward, brass-600, 1.5px high. Matches
 * the same micro-interaction used on the nav active-link and the
 * mobile overlay link hover — keeps the brass-hairline vocabulary
 * consistent across the site.
 */
const PRINCIPLES = [
  {
    roman: 'N°. I',
    title: 'Your wardrobe is your data.',
    line: 'Your collection, your wears, your manifesto: they belong to you. We won’t sell them, rent them, or use them to train anyone else’s model.',
  },
  {
    roman: 'N°. II',
    title: 'The aim is not to acquire more.',
    line: 'Atelier sells nothing else. No affiliate links, no marketplace, no promoted pieces. The studio works in your favour because there is nothing else to serve.',
  },
  {
    roman: 'N°. III',
    title: 'Restraint is a feature.',
    line: "No notifications begging you back. No streaks, no gamification, no growth-team confetti. The studio is here when you arrive, quiet when you don't.",
  },
];

export function PrinciplesPanel() {
  const listRef = useRef(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setRevealed(true);
      return;
    }
    const el = listRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <ul
      ref={listRef}
      className="mx-auto grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-12"
      style={{
        maxWidth: 1000,
        listStyle: 'none',
        padding: 0,
        margin: '0 auto',
      }}
    >
      {PRINCIPLES.map((p, i) => (
        <li
          key={p.roman}
          className="text-center md:text-left"
          style={{
            opacity: revealed ? 1 : 0,
            transform: revealed ? 'translateY(0)' : 'translateY(1rem)',
            transition: `opacity 800ms cubic-bezier(0.22, 1, 0.36, 1) ${i * 140}ms, transform 800ms cubic-bezier(0.22, 1, 0.36, 1) ${i * 140}ms`,
          }}
        >
          {/* Numeral */}
          <p
            style={{
              fontSize: '10px',
              letterSpacing: '0.32em',
              textTransform: 'uppercase',
              color: 'var(--atelier-brass-text)',
              fontWeight: 600,
              margin: '0 0 1rem 0',
            }}
          >
            {p.roman}
          </p>

          {/* Title with brass hairline drawing from centre on reveal */}
          <h3
            style={{
              fontFamily: 'var(--atelier-font-display)',
              fontSize: '1.375rem',
              lineHeight: 1.2,
              color: 'var(--atelier-stone-900)',
              position: 'relative',
              display: 'inline-block',
              paddingBottom: '0.5rem',
              marginTop: 0,
              marginBottom: '0.875rem',
            }}
          >
            {p.title}
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                left: '50%',
                bottom: 0,
                transform: 'translateX(-50%)',
                width: revealed ? '40%' : 0,
                height: '1.5px',
                background: 'var(--atelier-brass-600)',
                transition: `width 700ms cubic-bezier(0.22, 1, 0.36, 1) ${i * 140 + 300}ms`,
              }}
            />
          </h3>

          {/* Body */}
          <p
            style={{
              fontSize: '0.9375rem',
              lineHeight: 1.65,
              color: 'var(--atelier-stone-600)',
              margin: 0,
            }}
          >
            {p.line}
          </p>
        </li>
      ))}
    </ul>
  );
}
