import { useEffect, useState } from 'react';

/**
 * Sticky chapter index for any long editorial page. Fixed to the right
 * side of the viewport on desktop, vertically centred. Shows the chapter
 * Roman numerals; the currently-visible chapter is marked with a brass
 * hairline that extends and reveals the chapter title on hover or when
 * active.
 *
 * Tracks the active chapter via IntersectionObserver with a rootMargin
 * that treats a section as "active" when its top is in the upper-third
 * of the viewport. This means the highlight moves cleanly as the reader
 * scrolls; the chapter that's currently being read is the highlighted one.
 *
 * Hidden on mobile (lg:hidden) — there's no room for a sidebar and the
 * pages are short enough on a phone that in-page chapter numerals do
 * the navigation work themselves.
 *
 * Clicking a chapter scroll-jumps smoothly to it.
 *
 * Takes a `chapters` prop so different pages can supply different lists.
 * Defaults to the /about chapters for backward compatibility.
 */

const ABOUT_CHAPTERS = [
  { id: 'question', label: 'Where we began', numeral: 'I' },
  { id: 'practice', label: 'The Practice', numeral: 'II' },
  { id: 'chronicle', label: 'The Chronicle', numeral: 'III' },
  { id: 'for-whom', label: 'For Whom', numeral: 'IV' },
  { id: 'manifesto', label: 'A Manifesto', numeral: 'V' },
  { id: 'standard', label: 'What we stand for', numeral: 'VI' },
  { id: 'maker', label: 'The Maker', numeral: 'VII' },
];

export function ChapterIndex({ chapters = ABOUT_CHAPTERS }) {
  const CHAPTERS = chapters;
  const [activeId, setActiveId] = useState(CHAPTERS[0].id);
  // The chapter index is position:fixed and stays vertically centred while
  // you scroll — perfect through the body of the article, but it would
  // overlap the footer's armoire + address signature on the right side of
  // the page. Fade out as the footer enters view, fade back in if the
  // reader scrolls up past it.
  const [footerVisible, setFooterVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Track which section's top is in the upper-third of the viewport.
    // rootMargin '-30% 0px -60% 0px' means: a section "intersects" when
    // its top edge is between 30% from the top and 40% from the top of
    // the viewport — narrow band so only one section is "active" at a
    // time and the highlight transitions cleanly between chapters.
    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the entry whose top is highest in the viewport (smallest
        // boundingClientRect.top) among intersecting entries.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: '-30% 0px -60% 0px', threshold: 0 }
    );

    CHAPTERS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });

    // Footer watcher — fades the index out as the footer approaches.
    // rootMargin '0px 0px 120px 0px' expands the viewport's bottom edge
    // by 120px, so the fade begins ~120px before the footer is technically
    // visible. Combined with the 300ms fade, the index is fully out by
    // the time the footer's signature artifact actually enters the frame.
    const footerEl = document.querySelector('footer#footer');
    let footerObserver;
    if (footerEl) {
      footerObserver = new IntersectionObserver(
        (entries) => setFooterVisible(entries[0].isIntersecting),
        { rootMargin: '0px 0px 120px 0px', threshold: 0 }
      );
      footerObserver.observe(footerEl);
    }

    return () => {
      observer.disconnect();
      footerObserver?.disconnect();
    };
  }, []);

  function handleClick(e, id) {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  return (
    <nav
      aria-label="Chapter index"
      /* Only from xl (≥1280px): below that the wide sections (Maker 1080px,
         Manifesto/Standard at container-max 1280px) have no room beside a
         fixed rail, so it would overlap the prose. */
      className="hidden xl:block"
      aria-hidden={footerVisible || undefined}
      style={{
        position: 'fixed',
        right: 'clamp(1.25rem, 2vw, 2rem)',
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 40,
        // Fade as the footer approaches so the chapter numerals never
        // collide with the armoire signature artifact. pointer-events
        // off too — a faded link shouldn't be tabbable or clickable.
        opacity: footerVisible ? 0 : 1,
        pointerEvents: footerVisible ? 'none' : 'auto',
        transition: 'opacity 300ms cubic-bezier(0.22, 1, 0.36, 1)',
      }}
    >
      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.875rem',
        }}
      >
        {CHAPTERS.map(({ id, label, numeral }) => {
          const isActive = activeId === id;
          return (
            <li key={id}>
              <a
                href={`#${id}`}
                onClick={(e) => handleClick(e, id)}
                className="chapter-link-item"
                data-active={isActive ? 'true' : 'false'}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.625rem',
                  textDecoration: 'none',
                  fontFamily: 'var(--atelier-font-display)',
                  fontStyle: 'italic',
                  fontSize: '0.875rem',
                  letterSpacing: '0.04em',
                  color: isActive
                    ? 'var(--atelier-stone-900)'
                    : 'var(--atelier-stone-400)',
                  transition: 'color 220ms cubic-bezier(0.22, 1, 0.36, 1)',
                  cursor: 'pointer',
                }}
              >
                {/* Brass hairline — short at rest, extends on hover/active */}
                <span
                  aria-hidden="true"
                  className="chapter-link-rule"
                  style={{
                    display: 'inline-block',
                    width: isActive ? '24px' : '12px',
                    height: '1px',
                    background: isActive
                      ? 'var(--atelier-brass-600)'
                      : 'var(--atelier-stone-300)',
                    transition: 'all 220ms cubic-bezier(0.22, 1, 0.36, 1)',
                  }}
                />

                {/* Roman numeral — always shown */}
                <span style={{ minWidth: '1.75ch' }}>{numeral}</span>

                {/* Label — revealed on hover only. It was previously shown
                    permanently for the active chapter, but that pushed the
                    rail ~160px into the page and overlapped the wide sections'
                    prose. The active chapter is still marked by the darkened
                    numeral and the extended brass hairline. */}
                <span
                  className="chapter-link-label"
                  style={{
                    fontSize: '0.6875rem',
                    fontStyle: 'normal',
                    textTransform: 'uppercase',
                    letterSpacing: '0.22em',
                    color: 'var(--atelier-stone-500)',
                    opacity: 0,
                    // Zero-width at rest so the label adds NOTHING to the rail's
                    // footprint (opacity alone still reserves its box); it grows
                    // on hover only.
                    maxWidth: 0,
                    overflow: 'hidden',
                    transform: 'translateX(-0.5rem)',
                    transition:
                      'opacity 220ms cubic-bezier(0.22, 1, 0.36, 1), transform 220ms cubic-bezier(0.22, 1, 0.36, 1), max-width 220ms cubic-bezier(0.22, 1, 0.36, 1)',
                    whiteSpace: 'nowrap',
                    pointerEvents: 'none',
                  }}
                >
                  {label}
                </span>
              </a>
            </li>
          );
        })}
      </ul>

      {/* Hover state — extends the hairline + reveals label for any
          non-active link too. Defined as a <style> tag because the
          inline styles can't express :hover. */}
      <style>{`
        .chapter-link-item:hover .chapter-link-rule {
          width: 24px !important;
          background: var(--atelier-brass-600) !important;
        }
        .chapter-link-item:hover .chapter-link-label {
          opacity: 1 !important;
          max-width: 12rem !important;
          transform: translateX(0) !important;
        }
        .chapter-link-item:hover {
          color: var(--atelier-stone-900) !important;
        }
      `}</style>
    </nav>
  );
}
