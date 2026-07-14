import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Pic } from '@atelier/ui';

/**
 * WhatAtelierDoes — the four capabilities (Catalogue / Log / Style / Track)
 * as an editorial tabbed showcase. The left rail is a numbered index whose
 * entries ARE the four plain-language statements (kept permanently in the
 * DOM — the Google OAuth homepage review requires the app's purpose stated
 * in plain text, so the tabs never hide the copy). The right stage renders
 * a miniature, truthful vignette of the actual studio for the active
 * capability, composed from the owner's real wardrobe tiles.
 *
 * Auto-advances every 7s with a brass progress line; pauses on hover and
 * focus; arrow keys move between tabs; prefers-reduced-motion disables the
 * rotation entirely.
 */

const ROTATE_MS = 7000;

const CAPABILITIES = [
  {
    numeral: 'I',
    title: 'Catalogue',
    claim: 'Add every piece by photo, by link, or by sweeping the whole closet. Atelier builds your private digital wardrobe.',
    caption: 'Every piece, catalogued once, and found in seconds.',
  },
  {
    numeral: 'II',
    title: 'Log',
    claim: 'Record what you actually wear, so the Concierge styles you from your real habits.',
    caption: 'One tap a day. The studio learns what you really reach for.',
  },
  {
    numeral: 'III',
    title: 'Style',
    claim: 'The AI composes outfits from your own clothes, plans your week, and packs your trips.',
    caption: "Tomorrow's look, composed from clothes you already love.",
  },
  {
    numeral: 'IV',
    title: 'Track',
    claim: 'See the cost-per-wear of every piece — and where your wardrobe has gaps.',
    caption: 'Your wardrobe, read as an investment — not a guess.',
  },
];

const W = (f) => `/wardrobe/${f}.jpg`;

// ── Shared vignette chrome ─────────────────────────────────────────────────

function Chrome({ children, label }) {
  return (
    <div
      className="rounded-[1.25rem] overflow-hidden flex flex-col"
      style={{
        // ONE fixed-size studio "window". Every view renders inside the same
        // frame, sized to fit the richest screen (the wardrobe grid); shorter
        // screens sit top-aligned like a real app screen. Sized to the richest
        // view (the wardrobe grid); the others carry a little natural space at
        // the foot. Switching tabs never changes the box size.
        height: 432,
        background: '#ffffff',
        border: '1px solid var(--atelier-stone-200)',
        boxShadow: '0 24px 48px -20px rgba(28,25,23,0.18), 0 4px 12px rgba(28,25,23,0.05)',
      }}
    >
      <div
        className="flex items-center gap-2 px-4 shrink-0"
        style={{ height: 34, borderBottom: '1px solid var(--atelier-stone-100)', background: 'var(--atelier-stone-50)' }}
      >
        <span className="flex gap-1.5" aria-hidden="true">
          {['#e4c1b5', '#d4b378', '#b5c9b0'].map((c) => (
            <span key={c} style={{ width: 7, height: 7, borderRadius: '50%', background: c, opacity: 0.9 }} />
          ))}
        </span>
        <span className="mx-auto text-[9px]" style={{ letterSpacing: '0.14em', color: 'var(--atelier-stone-500)' }}>
          edit.myatelier.style · {label}
        </span>
      </div>
      <div style={{ padding: '1.1rem 1.2rem 1.25rem', flex: 1, minHeight: 0, overflow: 'hidden' }}>{children}</div>
    </div>
  );
}

const EYEBROW = {
  fontSize: 8.5,
  letterSpacing: '0.24em',
  textTransform: 'uppercase',
  color: 'var(--atelier-stone-500)',
  fontWeight: 600,
};

function Tile({ src, ratio = '3/4', radius = 10 }) {
  return (
    <div style={{ aspectRatio: ratio, borderRadius: radius, overflow: 'hidden', background: '#fff', border: '1px solid var(--atelier-stone-200)' }}>
      <Pic src={src} alt="" loading="lazy" className="w-full h-full object-cover" />
    </div>
  );
}

// ── I. Catalogue — the wardrobe grid ───────────────────────────────────────

const CATALOGUE_TILES = [
  'jasmin-coat', 'mirabel-satin-blouse', 'gael-wool-blend-trousers', 'marina-single-breasted-blazer',
  'claire-pleat-detail-dress', 'merisa-gold-wide-fit-block-heel-sandals-', 'gold-vermeil-baroque-pearl-pendant-pearl', 'riley-pale-pink-silk-front-vest-top',
];

function CatalogueVignette() {
  return (
    <Chrome label="Wardrobe">
      <div className="flex items-baseline justify-between mb-2.5">
        <p style={{ fontFamily: 'var(--atelier-font-display)', fontSize: '1.05rem', color: 'var(--atelier-stone-900)' }}>Your Collection</p>
        <p style={EYEBROW}>146 pieces curated</p>
      </div>
      <div className="flex gap-1.5 mb-3" aria-hidden="true">
        {['All', 'Tops', 'Outerwear', 'Jewellery'].map((c, i) => (
          <span
            key={c}
            className="px-2.5 py-1 rounded-full text-[9.5px]"
            style={{
              background: i === 0 ? 'var(--atelier-ink)' : '#fff',
              color: i === 0 ? '#fff' : 'var(--atelier-stone-600)',
              border: `1px solid ${i === 0 ? 'var(--atelier-ink)' : 'var(--atelier-stone-200)'}`,
              fontWeight: 500,
            }}
          >
            {c}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {CATALOGUE_TILES.map((f) => <Tile key={f} src={W(f)} ratio="1" />)}
      </div>
    </Chrome>
  );
}

// ── II. Log — the wear diary week ──────────────────────────────────────────

const LOG_DAYS = [
  { d: 'Mon', src: 'gene-silk-front-vest-top-in-champagne-si' },
  { d: 'Tue', src: 'gael-wool-blend-trousers' },
  { d: 'Wed', src: null },
  { d: 'Thu', src: 'mirabel-satin-blouse' },
  { d: 'Fri', src: 'claire-pleat-detail-dress' },
  // Was 'high-rise-denim-shorts', whose source photo carries a wide white
  // margin — at object-fit: cover it rendered noticeably smaller/zoomed-out
  // than the tightly-framed neighbours and broke the row's rhythm. The
  // pleated-tailored-shorts photo fills the frame like the rest of the week.
  { d: 'Sat', src: 'pleated-tailored-shorts' },
  { d: 'Sun', src: null },
];

function LogVignette() {
  return (
    <Chrome label="Lookbook · Diary">
      <div className="flex items-baseline justify-between mb-3">
        <p style={{ fontFamily: 'var(--atelier-font-display)', fontSize: '1.05rem', color: 'var(--atelier-stone-900)' }}>This week, worn</p>
        <p style={EYEBROW}>5 of 7 days logged</p>
      </div>
      <div className="grid grid-cols-7 gap-1.5 mb-3.5">
        {LOG_DAYS.map(({ d, src }) => (
          <div key={d} className="text-center">
            <p className="mb-1" style={{ ...EYEBROW, fontSize: 8 }}>{d}</p>
            {src ? (
              <Tile src={W(src)} ratio="3/4" radius={8} />
            ) : (
              <div style={{ aspectRatio: '3/4', borderRadius: 8, border: '1px dashed var(--atelier-stone-200)' }} aria-hidden="true" />
            )}
          </div>
        ))}
      </div>
      <div
        className="flex items-center gap-2.5 rounded-xl px-3 py-2.5"
        style={{ background: 'var(--atelier-stone-50)', border: '1px solid var(--atelier-stone-100)' }}
      >
        <span
          style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--atelier-brass-300)', color: 'var(--atelier-ink)', fontSize: 11, lineHeight: '20px', textAlign: 'center', fontWeight: 700 }}
          aria-hidden="true"
        >
          ✓
        </span>
        <p className="text-[11px]" style={{ color: 'var(--atelier-stone-600)' }}>
          Worn today · <em style={{ fontFamily: 'var(--atelier-font-display)' }}>Champagne silk vest</em> — 23rd wear this year
        </p>
      </div>

      {/* Most-worn strip — gives the diary a second beat and fills the frame */}
      <div className="mt-4">
        <p className="mb-2" style={EYEBROW}>Most worn this week</p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { src: 'gene-silk-front-vest-top-in-champagne-si', n: 'Champagne silk vest', w: '3 wears' },
            { src: 'gael-wool-blend-trousers', n: 'Wool-blend trousers', w: '2 wears' },
            { src: 'mirabel-satin-blouse', n: 'Satin blouse', w: '2 wears' },
          ].map((m) => (
            <div key={m.src} className="flex items-center gap-2 rounded-xl px-2 py-1.5" style={{ background: 'var(--atelier-stone-50)', border: '1px solid var(--atelier-stone-100)' }}>
              <div style={{ width: 26, height: 32, borderRadius: 6, overflow: 'hidden', flexShrink: 0, border: '1px solid var(--atelier-stone-200)' }}>
                <Pic src={W(m.src)} alt="" loading="lazy" className="w-full h-full object-cover" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] truncate" style={{ fontFamily: 'var(--atelier-font-display)', color: 'var(--atelier-stone-800)' }}>{m.n}</p>
                <p style={{ ...EYEBROW, fontSize: 7.5 }}>{m.w}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Chrome>
  );
}

// ── III. Style — today's proposal ──────────────────────────────────────────

const STYLE_SLOTS = [
  { slot: 'Top', name: 'Champagne silk vest', src: 'gene-silk-front-vest-top-in-champagne-si' },
  { slot: 'Bottom', name: 'Pleated tailored shorts', src: 'pleated-tailored-shorts' },
  { slot: 'Footwear', name: 'Gold block-heel sandals', src: 'merisa-gold-wide-fit-block-heel-sandals-' },
  { slot: 'Accessory', name: 'Fine chain necklace', src: 'fine-chain-necklace-24-monica-vinader' },
];

function StyleVignette() {
  return (
    <Chrome label="Styling Studio">
      <div
        className="flex items-center justify-between rounded-xl px-3.5 py-2.5 mb-3"
        style={{ background: 'var(--atelier-ink)', color: '#fff' }}
      >
        <p className="text-[10px]" style={{ letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--atelier-brass-300)', fontWeight: 700 }}>
          Today's proposal
        </p>
        <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.75)' }}>18–24°C · clear</p>
      </div>
      <div className="grid grid-cols-4 gap-2 mb-3">
        {STYLE_SLOTS.map(({ slot, name, src }) => (
          <div key={slot}>
            <Tile src={W(src)} />
            <p className="mt-1" style={{ ...EYEBROW, fontSize: 7.5 }}>{slot}</p>
            <p
              className="text-[10px]"
              style={{
                fontFamily: 'var(--atelier-font-display)',
                lineHeight: 1.25,
                minHeight: '2.5em',
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                color: 'var(--atelier-stone-800)',
              }}
            >
              {name}
            </p>
          </div>
        ))}
      </div>
      <p className="text-[11px] italic" style={{ fontFamily: 'var(--atelier-font-display)', color: 'var(--atelier-stone-500)', lineHeight: 1.55 }}>
        "Champagne silk over pleated tailoring — one tonal family, warmed by gold at the ankle and the collarbone."
      </p>
    </Chrome>
  );
}

// ── IV. Track — cost-per-wear leaderboard ──────────────────────────────────

const TRACK_ROWS = [
  { name: 'Wool-blend trousers', wears: 48, cpw: '2.29', src: 'gael-wool-blend-trousers' },
  { name: 'Fine-knit jumper', wears: 36, cpw: '2.19', src: 'robin-jumper' },
  { name: 'Pleat-detail dress', wears: 3, cpw: '75.00', src: 'claire-pleat-detail-dress', flag: true },
];

function TrackVignette() {
  return (
    <Chrome label="Insights">
      <div className="flex items-baseline justify-between mb-3">
        <p style={{ fontFamily: 'var(--atelier-font-display)', fontSize: '1.05rem', color: 'var(--atelier-stone-900)' }}>Cost per wear</p>
        <p style={EYEBROW}>This year</p>
      </div>
      <ul className="space-y-2 mb-3">
        {TRACK_ROWS.map((r) => (
          <li
            key={r.name}
            className="flex items-center gap-2.5 rounded-xl px-2.5 py-2"
            style={{ background: r.flag ? 'rgba(212,179,120,0.10)' : 'var(--atelier-stone-50)', border: '1px solid var(--atelier-stone-100)' }}
          >
            <div style={{ width: 30, height: 38, borderRadius: 7, overflow: 'hidden', flexShrink: 0, border: '1px solid var(--atelier-stone-200)' }}>
              <Pic src={W(r.src)} alt="" loading="lazy" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] truncate" style={{ fontFamily: 'var(--atelier-font-display)', color: 'var(--atelier-stone-800)' }}>{r.name}</p>
              <p style={{ ...EYEBROW, fontSize: 8 }}>{r.wears} wears</p>
            </div>
            <p style={{ fontFamily: 'var(--atelier-font-display)', fontSize: '0.95rem', color: r.flag ? 'var(--atelier-brass-text)' : 'var(--atelier-stone-900)' }}>
              £{r.cpw}<span style={{ fontSize: 9, color: 'var(--atelier-stone-500)' }}>/wear</span>
            </p>
          </li>
        ))}
      </ul>
      {/* The studio's generated insight, verbatim register — the numbers do
          the convincing. */}
      <div
        className="flex items-baseline justify-between rounded-xl px-3 py-2.5 mb-2.5"
        style={{ border: '1px solid rgba(212,179,120,0.35)', background: 'rgba(212,179,120,0.06)' }}
      >
        <div>
          <p style={{ ...EYEBROW, fontSize: 7.5, color: 'var(--atelier-brass-text)' }}>Wardrobe investment</p>
          <p style={{ fontFamily: 'var(--atelier-font-display)', fontSize: '1.05rem', color: 'var(--atelier-stone-900)' }}>
            £2,791 <span style={{ fontSize: 10, color: 'var(--atelier-stone-500)' }}>across 28 pieces</span>
          </p>
        </div>
        <div className="text-right">
          <p style={{ ...EYEBROW, fontSize: 7.5 }}>Average</p>
          <p style={{ fontFamily: 'var(--atelier-font-display)', fontSize: '1.05rem', color: 'var(--atelier-brass-text)' }}>£4.10<span style={{ fontSize: 9, color: 'var(--atelier-stone-500)' }}>/wear</span></p>
        </div>
      </div>
      <p className="text-[10.5px]" style={{ color: 'var(--atelier-stone-500)' }}>
        The dress wants three more evenings — or a resale listing. Atelier will say which.
      </p>
    </Chrome>
  );
}

const VIGNETTES = [CatalogueVignette, LogVignette, StyleVignette, TrackVignette];

// ── The tabbed section ─────────────────────────────────────────────────────

export function WhatAtelierDoes() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const tabRefs = useRef([]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const onChange = (e) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (paused || reduced) return;
    const t = setTimeout(() => setActive((a) => (a + 1) % CAPABILITIES.length), ROTATE_MS);
    return () => clearTimeout(t);
  }, [active, paused, reduced]);

  const onKeyDown = useCallback((e) => {
    const delta = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = (active + delta + CAPABILITIES.length) % CAPABILITIES.length;
    setActive(next);
    tabRefs.current[next]?.focus();
  }, [active]);

  return (
    <div
      className="grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] gap-10 lg:gap-16 items-start"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {/* Index — the four statements, always in the DOM, acting as tabs */}
      <div role="tablist" aria-label="What Atelier does" aria-orientation="vertical" onKeyDown={onKeyDown}>
        {CAPABILITIES.map((c, i) => {
          const isActive = i === active;
          return (
            <button
              key={c.title}
              ref={(el) => { tabRefs.current[i] = el; }}
              type="button"
              role="tab"
              id={`wad-tab-${i}`}
              aria-selected={isActive}
              aria-controls="wad-stage"
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActive(i)}
              className="block w-full text-left group"
              style={{
                padding: '1.15rem 0 1.2rem',
                borderTop: '1px solid rgba(28,25,23,0.08)',
                cursor: 'pointer',
                background: 'transparent',
                position: 'relative',
              }}
            >
              {/* brass progress line along the top edge of the active entry */}
              <span
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  top: -1,
                  left: 0,
                  height: 1.5,
                  background: 'var(--atelier-brass-400, #C9A55E)',
                  width: isActive ? '100%' : 0,
                  transition: isActive && !paused && !reduced ? `width ${ROTATE_MS}ms linear` : 'width 300ms ease',
                }}
              />
              <span className="flex items-baseline gap-4">
                <span
                  style={{
                    fontFamily: 'var(--atelier-font-display)',
                    fontSize: '0.8rem',
                    color: isActive ? 'var(--atelier-brass-text)' : 'var(--atelier-stone-500)',
                    minWidth: 22,
                    transition: 'color 300ms ease',
                  }}
                >
                  {c.numeral}
                </span>
                <span className="flex-1">
                  <span
                    className="block"
                    style={{
                      fontFamily: 'var(--atelier-font-display)',
                      fontSize: '1.35rem',
                      lineHeight: 1.1,
                      color: isActive ? 'var(--atelier-stone-900)' : 'var(--atelier-stone-500)',
                      transition: 'color 300ms ease',
                    }}
                  >
                    {c.title}
                  </span>
                  <span
                    className="block mt-1.5"
                    style={{
                      fontSize: '0.875rem',
                      lineHeight: 1.55,
                      color: isActive ? 'var(--atelier-stone-600)' : 'var(--atelier-stone-500)',
                      transition: 'color 300ms ease',
                      maxWidth: '42ch',
                    }}
                  >
                    {c.claim}
                  </span>
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Stage — all four vignettes render stacked in ONE grid cell, so the
          stage permanently holds the height of the tallest and switching tabs
          is a pure crossfade: zero layout shift, no content "jump" on rotation. */}
      <div
        id="wad-stage"
        role="tabpanel"
        aria-labelledby={`wad-tab-${active}`}
        className="lg:sticky lg:top-24"
      >
        <div style={{ display: 'grid' }}>
          {VIGNETTES.map((V, i) => {
            const isOn = i === active;
            return (
              <div
                key={CAPABILITIES[i].title}
                aria-hidden={!isOn}
                style={{
                  gridArea: '1 / 1',
                  opacity: isOn ? 1 : 0,
                  visibility: isOn ? 'visible' : 'hidden',
                  transform: isOn || reduced ? 'translateY(0)' : 'translateY(0.6rem)',
                  transition: reduced
                    ? 'opacity 200ms ease, visibility 200ms'
                    : 'opacity 480ms cubic-bezier(0.22,1,0.36,1), transform 480ms cubic-bezier(0.22,1,0.36,1), visibility 480ms',
                  pointerEvents: isOn ? 'auto' : 'none',
                }}
              >
                <V />
                <p
                  className="mt-4 text-center text-[11px] italic"
                  style={{ fontFamily: 'var(--atelier-font-display)', color: 'var(--atelier-stone-500)' }}
                >
                  {CAPABILITIES[i].caption}
                </p>
              </div>
            );
          })}
        </div>
        <p className="mt-1.5 text-center">
          <a
            href="/studio"
            className="text-[10px] uppercase"
            style={{ letterSpacing: '0.22em', color: 'var(--atelier-brass-text)', fontWeight: 600, textDecoration: 'none' }}
          >
            See the full studio →
          </a>
        </p>
      </div>

    </div>
  );
}
