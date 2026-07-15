import { useEffect, useRef, useState } from 'react';

/**
 * The Studio Chronicle — a short editorial heritage section on /about.
 *
 * Layout splits by viewport:
 *   - Desktop (md+): horizontal timeline. A brass rule runs across the
 *     top with a small brass diamond at each entry; date below the
 *     diamond in italic display brass, then the editorial line beneath.
 *     Reads as a printed chronology spread.
 *   - Mobile (<md): vertical ledger as before. Date on the left, line
 *     on the right, brass hairlines between entries. Horizontal scroll
 *     on a phone would be hostile; vertical works.
 *
 * Atelier is young, but heritage components are central to luxury
 * branding because they assert the brand exists IN TIME. The horizontal
 * timeline form makes that assertion more vivid than a vertical list.
 *
 * Update the ENTRIES array as the studio's milestones land. New entries
 * append at the bottom; the oldest stays at the top (chronological).
 * The dates here are brand-narrative — adjust to match real history
 * when ready.
 */
const ENTRIES = [
  { date: 'MMXXIV', line: 'A wardrobe begins keeping its own ledger.' },
  { date: 'MMXXV · VI', line: 'The Concierge writes its first manifesto.' },
  { date: 'MMXXV · X', line: 'The Lookbook learns to compose.' },
  { date: 'MMXXVI · I', line: 'The studio opens for membership.' },
];

export function StudioChronicle() {
  // Observe the section element (always visible) rather than one of the
  // ol lists (one is display:none per viewport). Previously the ref was
  // on the desktop ol; on mobile that ol is display:none so the observer
  // never fired, `revealed` stayed false, and the mobile entries rendered
  // at opacity 0 — appearing empty. The section is the always-visible
  // wrapper that works for both layouts.
  const sectionRef = useRef(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setRevealed(true);
      return;
    }
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      id="chronicle"
      style={{
        maxWidth: 1080,
        margin: '0 auto',
        paddingInline: 'var(--atelier-page-padding)',
        paddingBottom: 'clamp(4rem, 7vw, 6rem)',
        scrollMarginTop: '6rem',
      }}
    >
      {/* Chapter numeral — italic display serif, brass, matching the
          .chapter-numeral pattern in about.astro's <style> block.
          Inline styles here because this component is rendered from
          /about and the page's scoped styles don't reach into it. */}
      <p
        style={{
          fontFamily: 'var(--atelier-font-display)',
          fontStyle: 'italic',
          fontSize: 'clamp(1.5rem, 2.2vw, 1.875rem)',
          color: 'var(--atelier-brass-text)',
          lineHeight: 1,
          margin: '0 0 0.5rem 0',
          letterSpacing: '0.02em',
        }}
      >
        III
      </p>

      {/* Eyebrow — brass rule + small-caps, matches the other section
          eyebrows on /about (Where we began, The Practice, For Whom). */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          marginBottom: '1.5rem',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            display: 'inline-block',
            width: '24px',
            height: '1.5px',
            background: 'var(--atelier-brass-300)',
          }}
        />
        <p
          style={{
            fontSize: '10px',
            letterSpacing: '0.28em',
            textTransform: 'uppercase',
            color: 'var(--atelier-stone-500)',
            fontWeight: 600,
            margin: 0,
          }}
        >
          The Chronicle
        </p>
      </div>

      {/* Headline */}
      <h2
        style={{
          fontFamily: 'var(--atelier-font-display)',
          fontSize: 'clamp(1.75rem, 3vw, 2.5rem)',
          lineHeight: 1.15,
          letterSpacing: '-0.01em',
          color: 'var(--atelier-stone-900)',
          maxWidth: '24ch',
          marginBottom: '2.5rem',
          marginTop: 0,
        }}
      >
        How the studio came to be.
      </h2>

      {/* ── Desktop: horizontal timeline (md+) ──────────────────────────
          A brass rule runs across the top with diamond tick marks at
          each entry. The diamond is the same shape used in the
          SectionOrnament and the closing masthead — recurring brand
          mark across the page. */}
      <ol
        className="hidden md:grid"
        style={{
          gridTemplateColumns: `repeat(${ENTRIES.length}, 1fr)`,
          gap: '1.5rem',
          listStyle: 'none',
          padding: 0,
          margin: 0,
          position: 'relative',
          paddingTop: '3rem',
        }}
      >
        {/* The horizontal brass rule. Starts at the centre of the first
            column, ends at the centre of the last — so the tick marks
            sit on the rule cleanly without overshoot. */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: '0.875rem',
            left: `${100 / (ENTRIES.length * 2)}%`,
            right: `${100 / (ENTRIES.length * 2)}%`,
            height: '1px',
            background: 'var(--atelier-brass-300)',
            opacity: revealed ? 1 : 0,
            transition: 'opacity 800ms cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        />

        {ENTRIES.map((entry, i) => (
          <li
            key={`${entry.date}-h`}
            style={{
              position: 'relative',
              textAlign: 'center',
              opacity: revealed ? 1 : 0,
              transform: revealed ? 'translateY(0)' : 'translateY(0.75rem)',
              transition: `opacity 700ms cubic-bezier(0.22, 1, 0.36, 1) ${i * 140}ms, transform 700ms cubic-bezier(0.22, 1, 0.36, 1) ${i * 140}ms`,
            }}
          >
            {/* Brass diamond, centred ON the timeline rule. The rule sits at
                top:0.875rem of the <ol>; the <li> content starts at the ol's
                3rem padding-top, so the rule is at -2.125rem relative to the
                li. translate(-50%,-50%) centres the diamond on that point so it
                straddles the line instead of floating above it. */}
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: '-2.125rem',
                left: '50%',
                transform: 'translate(-50%, -50%) rotate(45deg)',
                width: '7px',
                height: '7px',
                background: 'var(--atelier-brass-600)',
              }}
            />

            {/* Date */}
            <p
              style={{
                fontFamily: 'var(--atelier-font-display)',
                fontStyle: 'italic',
                fontSize: '0.9375rem',
                color: 'var(--atelier-brass-text)',
                letterSpacing: '0.04em',
                whiteSpace: 'nowrap',
                margin: '0 0 0.75rem 0',
              }}
            >
              {entry.date}
            </p>

            {/* Editorial line */}
            <p
              style={{
                fontFamily: 'var(--atelier-font-display)',
                fontSize: '1rem',
                lineHeight: 1.45,
                color: 'var(--atelier-stone-800)',
                margin: 0,
                maxWidth: '20ch',
                marginInline: 'auto',
              }}
            >
              {entry.line}
            </p>
          </li>
        ))}
      </ol>

      {/* ── Mobile: vertical ledger (<md) ───────────────────────────
          Horizontal scroll on a phone would be hostile; the vertical
          ledger reads cleanly on a narrow viewport. Same observer
          (listRef above) triggers the reveal regardless of layout. */}
      <ol
        className="md:hidden"
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
        }}
      >
        {ENTRIES.map((entry, i) => (
          <li
            key={`${entry.date}-v`}
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(6rem, max-content) 1fr',
              gap: '1.75rem',
              alignItems: 'baseline',
              paddingTop: '1.5rem',
              paddingBottom: '1.5rem',
              borderTop:
                i === 0
                  ? '1px solid rgba(212, 179, 120, 0.4)'
                  : '1px solid rgba(212, 179, 120, 0.22)',
              borderBottom:
                i === ENTRIES.length - 1
                  ? '1px solid rgba(212, 179, 120, 0.4)'
                  : 'none',
              opacity: revealed ? 1 : 0,
              transform: revealed ? 'translateY(0)' : 'translateY(0.75rem)',
              transition: `opacity 700ms cubic-bezier(0.22, 1, 0.36, 1) ${i * 140}ms, transform 700ms cubic-bezier(0.22, 1, 0.36, 1) ${i * 140}ms`,
            }}
          >
            <span
              style={{
                fontFamily: 'var(--atelier-font-display)',
                fontStyle: 'italic',
                fontSize: '0.9375rem',
                color: 'var(--atelier-brass-text)',
                letterSpacing: '0.04em',
                whiteSpace: 'nowrap',
              }}
            >
              {entry.date}
            </span>
            <p
              style={{
                fontFamily: 'var(--atelier-font-display)',
                fontSize: '1.0625rem',
                lineHeight: 1.55,
                color: 'var(--atelier-stone-800)',
                margin: 0,
              }}
            >
              {entry.line}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
