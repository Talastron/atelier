// apps/marketing/src/components/studio/Toolkit.jsx
//
// The Toolkit — editorial spread of six methods. ALL six cards have
// scroll-triggered micro-demos so the grid weight is equal: the bottom
// row no longer reads as supporting features. Brass palette throughout
// (no emerald). Hover lift on every card.
//
// Lives on /studio, beneath the embedded live app and above SurfaceIndex.
// This was components/Features.jsx and sat on the home page, where it was
// cut for reading SaaS-by-default in a column of editorial sections. That
// judgement held there; it does not hold here, where the visitor has just
// driven the real studio and is asking what else is in it. The six cards
// go deep on the methods that persuade, and SurfaceIndex below names all
// nine surfaces so nothing goes unmentioned.
//
// Two cards changed when it moved. "Add a piece, in seconds" and "A
// lookbook, read-only" each duplicated a home-page section that already
// does the job better at full width (WaysIn and ShareLooks). They gave
// their places to Today and the Styling Studio, which nothing on the
// site sold at all.

import React, { useState, useEffect, useRef } from 'react';
import { Pic } from '@atelier/ui';
import {
  Home,
  Camera,
  MapPin,
  TrendingUp,
  Sparkles,
  CalendarDays,
  Wand2,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────
// Shared bits
// ─────────────────────────────────────────────────────────────────────────

const BrassRule = ({ width = 24 }) => (
  <span
    aria-hidden="true"
    style={{
      display: 'inline-block',
      width,
      height: '1.5px',
      backgroundColor: 'var(--atelier-brass-300)',
    }}
  />
);

// Playback gate for the six demo loops. Returns two flags:
//
//   play    — start the timer choreography (scrolled into view, motion OK)
//   settled — skip the choreography and render the finished frame
//
// `settled` is the reduced-motion path and it matters that it is a separate
// flag rather than simply withholding `play`. Every demo starts from an
// empty state and fills in on a timer, so a demo that is never played shows
// dashed placeholders — the one frame that communicates nothing. Reduced
// motion should mean "show me the result, don't dance", so each demo reads
// `settled` and jumps straight to its last frame. Six cards animating at
// once, directly beneath an iframe running the whole studio, is exactly the
// case that browser setting exists for.
//
// `play` deliberately tracks visibility in BOTH directions and the observer
// stays connected. Each demo's effect depends on it, so when a card leaves
// the viewport the effect tears down and its cleanup clears that card's
// timer chain — six self-cycling demos stop doing work the moment you
// scroll past them, which is the whole reason this is cheap enough to sit
// under an embedded copy of the app. Disconnecting after the first
// intersection would strand six timer chains running for the life of the
// page. (An IntersectionObserver costs almost nothing to leave connected:
// it fires when the ratio crosses a threshold, not once per scroll frame.)
function useInView(ref, threshold = 0.3) {
  const [play, setPlay] = useState(false);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (!ref.current) return undefined;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setSettled(true);
      return undefined;
    }
    const obs = new IntersectionObserver(
      ([entry]) => setPlay(entry.isIntersecting),
      { threshold }
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [ref, threshold]);

  return { play, settled };
}

// ─────────────────────────────────────────────────────────────────────────
// Card chrome — hover-lift on every card so the section responds to cursor
// ─────────────────────────────────────────────────────────────────────────

function ToolkitCard({ icon: Icon, eyebrow, title, titleEm, description, demo }) {
  const [hovered, setHovered] = useState(false);
  return (
    <article
      className="flex flex-col cursor-default"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#ffffff',
        border: '1px solid var(--atelier-stone-200)',
        borderRadius: 18,
        padding: 'clamp(1.25rem, 2vw, 1.75rem)',
        boxShadow: hovered
          ? '0 8px 24px -6px rgba(28, 25, 23, 0.10), 0 2px 4px rgba(28, 25, 23, 0.04)'
          : '0 4px 14px -4px rgba(28, 25, 23, 0.06), 0 1px 2px rgba(28, 25, 23, 0.03)',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        transition: 'transform 320ms ease, box-shadow 320ms ease',
        height: '100%',
      }}
    >
      <div className="flex items-center gap-2.5 mb-4">
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            borderRadius: 8,
            background: 'var(--atelier-stone-50)',
            border: '1px solid var(--atelier-stone-200)',
          }}
        >
          <Icon size={15} strokeWidth={1.5} style={{ color: 'var(--atelier-brass-text)' }} />
        </span>
        <p
          className="text-[9.5px] uppercase font-semibold"
          style={{
            letterSpacing: '0.28em',
            color: 'var(--atelier-brass-text)',
          }}
        >
          {eyebrow}
        </p>
      </div>

      <h3
        className="mb-3"
        style={{
          fontFamily: 'var(--atelier-font-display)',
          fontSize: 'clamp(1.25rem, 1.8vw, 1.5rem)',
          lineHeight: 1.15,
          color: 'var(--atelier-stone-900)',
          letterSpacing: '-0.01em',
        }}
      >
        {title}
        {titleEm && (
          <>
            {' '}
            <em style={{ fontWeight: 400 }}>{titleEm}</em>
          </>
        )}
      </h3>

      <p
        style={{
          fontSize: '0.875rem',
          lineHeight: 1.6,
          color: 'var(--atelier-stone-500)',
          flex: 1,
        }}
      >
        {description}
      </p>

      {demo && <div style={{ marginTop: '1rem' }}>{demo}</div>}
    </article>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Card 1: Today — the weather line resolves, then the day's look fills in
// four slots and the stylist's note lands underneath. Same choreography the
// hero uses at full size (compose → reveal → note), compressed to a card.
// No confidence figure: the studio removed that in d4d9bf8 and the note is
// what the daily brief actually shows.
// ─────────────────────────────────────────────────────────────────────────

const TODAY_SAMPLES = [
  {
    weather: '18–24°C · Bright',
    items: [
      '/wardrobe/gene-silk-front-vest-top-in-champagne-si.jpg',
      '/wardrobe/gael-wool-blend-trousers.jpg',
      '/wardrobe/suedette-2-part-block-heel-sandals.jpg',
      '/wardrobe/fine-chain-necklace-24-monica-vinader.jpg',
    ],
    note: 'Champagne silk over sharp tailoring, warmed by gold.',
  },
  {
    weather: '9–14°C · Rain later',
    items: [
      '/wardrobe/reg-classic-button-down-blouse.jpg',
      '/wardrobe/gael-wool-blend-trousers.jpg',
      '/wardrobe/jasmin-coat.jpg',
      '/wardrobe/england-elektra-ladies-leather-gloves.jpg',
    ],
    note: 'Wool and a proper coat. Dressed for the walk, not the office.',
  },
];

function TodayDemo() {
  const ref = useRef(null);
  const { play, settled } = useInView(ref);
  const [activeIdx, setActiveIdx] = useState(0);
  const [revealed, setRevealed] = useState(0);
  const timerRef = useRef([]);

  useEffect(() => {
    const sample = TODAY_SAMPLES[activeIdx];
    // Reduced motion: skip the reveal, show the composed look.
    if (settled) { setRevealed(sample.items.length); return undefined; }
    if (!play) return undefined;

    let cancelled = false;
    setRevealed(0);

    sample.items.forEach((_, i) => {
      const t = setTimeout(() => {
        if (!cancelled) setRevealed(i + 1);
      }, 600 + i * 320);
      timerRef.current.push(t);
    });

    const cycleTimer = setTimeout(() => {
      if (!cancelled) setActiveIdx((i) => (i + 1) % TODAY_SAMPLES.length);
    }, 600 + sample.items.length * 320 + 4200);
    timerRef.current.push(cycleTimer);

    return () => {
      cancelled = true;
      timerRef.current.forEach(clearTimeout);
      timerRef.current = [];
    };
  }, [play, settled, activeIdx]);

  const sample = TODAY_SAMPLES[activeIdx];
  const complete = revealed >= sample.items.length;

  return (
    <div ref={ref}>
      {/* Weather strip — the studio's Today header in miniature */}
      <div
        className="flex items-center gap-2 mb-2.5"
        style={{
          padding: '0.4rem 0.75rem',
          background: 'var(--atelier-cream)',
          border: '1px solid var(--atelier-stone-200)',
          borderRadius: 8,
        }}
      >
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: 'var(--atelier-brass-600)',
            flexShrink: 0,
          }}
        />
        <span
          key={activeIdx}
          style={{
            fontSize: 8.5,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            fontWeight: 600,
            color: 'var(--atelier-stone-500)',
            animation: 'toolkit-fade 400ms ease',
          }}
        >
          Today · {sample.weather}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {sample.items.map((src, i) => {
          const isRevealed = i < revealed;
          return (
            <div
              key={`${activeIdx}-${i}`}
              style={{
                aspectRatio: '3/4',
                borderRadius: 6,
                overflow: 'hidden',
                background: isRevealed ? 'var(--atelier-stone-100)' : 'transparent',
                border: isRevealed ? 'none' : '1px dashed var(--atelier-stone-200)',
                opacity: isRevealed ? 1 : 0.4,
                transform: isRevealed ? 'translateY(0)' : 'translateY(0.25rem)',
                transition: 'all 400ms ease',
              }}
            >
              {isRevealed && (
                <Pic
                  src={src}
                  alt=""
                  loading="lazy"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    animation: 'toolkit-drop-in 500ms cubic-bezier(0.22, 1, 0.36, 1)',
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* The stylist's note, once the look is composed */}
      <div
        className="flex items-start gap-2"
        style={{
          marginTop: 10,
          minHeight: '2.4em',
          opacity: complete ? 1 : 0,
          transform: complete ? 'translateY(0)' : 'translateY(0.25rem)',
          transition: 'opacity 450ms ease, transform 450ms ease',
        }}
      >
        <Wand2
          size={11}
          strokeWidth={1.4}
          style={{ color: 'var(--atelier-brass-text)', flexShrink: 0, marginTop: 3 }}
        />
        <p
          style={{
            fontFamily: 'var(--atelier-font-display)',
            fontStyle: 'italic',
            fontSize: 11.5,
            lineHeight: 1.45,
            color: 'var(--atelier-stone-700)',
          }}
        >
          {sample.note}
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Card 2: Travel capsule
// ─────────────────────────────────────────────────────────────────────────

const DESTINATIONS = [
  { name: 'Lisbon', items: ['/wardrobe/pippa-silk-front-colourblock-vest.jpg', '/wardrobe/high-rise-denim-shorts.jpg', '/wardrobe/fine-chain-necklace-24-monica-vinader.jpg', '/wardrobe/suedette-2-part-block-heel-sandals.jpg', '/wardrobe/claire-pleat-detail-dress.jpg'] },
  { name: 'Edinburgh', items: ['/wardrobe/gene-silk-front-vest-top-in-champagne-si.jpg', '/wardrobe/gael-wool-blend-trousers.jpg', '/wardrobe/jasmin-coat.jpg', '/wardrobe/merisa-gold-wide-fit-block-heel-sandals-.jpg', '/wardrobe/fine-chain-necklace-24-monica-vinader.jpg'] },
];

function TravelDemo() {
  const ref = useRef(null);
  const { play, settled } = useInView(ref);
  const [activeIdx, setActiveIdx] = useState(0);
  const [typedName, setTypedName] = useState('');
  const [revealed, setRevealed] = useState(0);
  const timerRef = useRef([]);

  useEffect(() => {
    const dest = DESTINATIONS[activeIdx];
    // Reduced motion: the destination is already typed and the capsule packed.
    if (settled) {
      setTypedName(dest.name);
      setRevealed(dest.items.length);
      return undefined;
    }
    if (!play) return undefined;
    let cancelled = false;

    setTypedName('');
    setRevealed(0);

    dest.name.split('').forEach((_, i) => {
      const t = setTimeout(() => {
        if (!cancelled) setTypedName(dest.name.slice(0, i + 1));
      }, 400 + i * 70);
      timerRef.current.push(t);
    });

    // Tightened the cycle: faster typing (70ms/char), faster item reveals
    // (180ms apart), shorter hold (1500ms) so destinations visibly cycle
    // and visitors notice the change before scrolling past.
    const typingDuration = 400 + dest.name.length * 70;
    dest.items.forEach((_, i) => {
      const t = setTimeout(() => {
        if (!cancelled) setRevealed(i + 1);
      }, typingDuration + 400 + i * 180);
      timerRef.current.push(t);
    });

    const cycleTimer = setTimeout(() => {
      if (!cancelled) setActiveIdx((i) => (i + 1) % DESTINATIONS.length);
    }, typingDuration + 400 + dest.items.length * 180 + 1500);
    timerRef.current.push(cycleTimer);

    return () => {
      cancelled = true;
      timerRef.current.forEach(clearTimeout);
      timerRef.current = [];
    };
  }, [play, settled, activeIdx]);

  const dest = DESTINATIONS[activeIdx];

  return (
    <div ref={ref}>
      <div
        className="flex items-center gap-2 mb-2.5"
        style={{
          padding: '0.5rem 0.75rem',
          background: 'var(--atelier-cream)',
          border: '1px solid var(--atelier-stone-200)',
          borderRadius: 999,
        }}
      >
        <MapPin size={11} strokeWidth={1.6} style={{ color: 'var(--atelier-brass-text)' }} />
        <span
          style={{
            fontSize: 11,
            fontFamily: 'var(--atelier-font-display)',
            color: 'var(--atelier-stone-700)',
            fontStyle: typedName ? 'normal' : 'italic',
            opacity: typedName ? 1 : 0.5,
          }}
        >
          {typedName || 'Where to?'}
          {typedName && typedName !== dest.name && (
            <span
              aria-hidden="true"
              style={{
                display: 'inline-block',
                width: 1,
                height: 11,
                background: 'var(--atelier-stone-800)',
                verticalAlign: 'middle',
                marginLeft: 1,
                animation: 'toolkit-blink 1s steps(2, start) infinite',
              }}
            />
          )}
        </span>
      </div>

      <div className="grid grid-cols-5 gap-1.5">
        {dest.items.map((src, i) => {
          const isRevealed = i < revealed;
          return (
            <div
              key={`${activeIdx}-${i}`}
              style={{
                aspectRatio: '3/4',
                borderRadius: 6,
                overflow: 'hidden',
                background: isRevealed ? 'var(--atelier-stone-100)' : 'transparent',
                border: isRevealed ? 'none' : '1px dashed var(--atelier-stone-200)',
                opacity: isRevealed ? 1 : 0.4,
                transform: isRevealed ? 'translateY(0)' : 'translateY(0.25rem)',
                transition: 'all 400ms ease',
              }}
            >
              {isRevealed && (
                <Pic
                  src={src}
                  alt=""
                  loading="lazy"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Card 3: Cost-per-wear — now in brass instead of emerald
// ─────────────────────────────────────────────────────────────────────────

const CPW_SAMPLES = [
  { name: 'Champagne silk vest', src: '/wardrobe/gene-silk-front-vest-top-in-champagne-si.jpg', price: 90, maxWears: 70 },
  { name: 'Button-down blouse', src: '/wardrobe/reg-classic-button-down-blouse.jpg', price: 99, maxWears: 52 },
];

function CPWDemo() {
  const ref = useRef(null);
  const { play, settled } = useInView(ref);
  const [activeIdx, setActiveIdx] = useState(0);
  const [wears, setWears] = useState(1);
  const timerRef = useRef([]);

  useEffect(() => {
    const sample = CPW_SAMPLES[activeIdx];
    // Reduced motion: land on the settled cost per wear, not the £-per-one
    // opening figure, which would misstate the piece.
    if (settled) { setWears(sample.maxWears); return undefined; }
    if (!play) return undefined;
    let cancelled = false;

    setWears(1);

    for (let n = 2; n <= sample.maxWears; n += 1) {
      const t = setTimeout(() => {
        if (!cancelled) setWears(n);
      }, 600 + (n - 2) * 50);
      timerRef.current.push(t);
    }

    const cycleTimer = setTimeout(() => {
      if (!cancelled) setActiveIdx((i) => (i + 1) % CPW_SAMPLES.length);
    }, 600 + sample.maxWears * 50 + 2500);
    timerRef.current.push(cycleTimer);

    return () => {
      cancelled = true;
      timerRef.current.forEach(clearTimeout);
      timerRef.current = [];
    };
  }, [play, settled, activeIdx]);

  const sample = CPW_SAMPLES[activeIdx];
  const cpw = (sample.price / wears).toFixed(2);

  return (
    <div ref={ref} className="flex items-center gap-3">
      <Pic
        key={activeIdx}
        src={sample.src}
        alt=""
        loading="lazy"
        style={{
          width: 48,
          height: 60,
          objectFit: 'cover',
          borderRadius: 6,
          background: 'var(--atelier-stone-100)',
          flexShrink: 0,
          animation: 'cpw-img-in 500ms ease',
        }}
      />
      <div className="flex-1 min-w-0">
        <p
          style={{
            fontFamily: 'var(--atelier-font-display)',
            fontSize: 13,
            color: 'var(--atelier-stone-800)',
            lineHeight: 1.2,
          }}
        >
          {sample.name}
        </p>
        <p
          style={{
            fontSize: 9,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            fontWeight: 500,
            color: 'var(--atelier-stone-500)',
            marginTop: 2,
          }}
        >
          {/* The counter starts at one, so this needs the singular or the
              card opens on "1 wears" for the first half-second. */}
          {sample.brand} · {wears} {wears === 1 ? 'wear' : 'wears'}
        </p>
      </div>
      <p
        style={{
          fontFamily: 'var(--atelier-font-display)',
          fontSize: 22,
          color: 'var(--atelier-brass-text)',
          fontFeatureSettings: '"onum" on',
          letterSpacing: '-0.01em',
          flexShrink: 0,
        }}
      >
        £{cpw}
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Card 4: Style Manifesto — streaming italic Playfair preview
// ─────────────────────────────────────────────────────────────────────────

const MANIFESTO_SNIPPETS = [
  'You dress in the colours of considered absence: stone, ink, cream.',
  'Your wardrobe runs on quiet conviction — every piece earns its keep.',
  'The champagne silk vest has been worn seventy times this year. Some pieces, barely at all.',
];

function ManifestoDemo() {
  const ref = useRef(null);
  const { play, settled } = useInView(ref);
  const [activeIdx, setActiveIdx] = useState(0);
  const [displayText, setDisplayText] = useState('');
  const timerRef = useRef([]);

  useEffect(() => {
    const snippet = MANIFESTO_SNIPPETS[activeIdx];
    // Reduced motion: the brief is written, not typing. Setting the full
    // snippet also clears isStreaming below, so the caret does not blink.
    if (settled) { setDisplayText(snippet); return undefined; }
    if (!play) return undefined;
    let cancelled = false;

    setDisplayText('');

    let chars = 0;
    const stream = () => {
      if (cancelled) return;
      chars += 3;
      if (chars >= snippet.length) {
        setDisplayText(snippet);
        const t = setTimeout(() => {
          if (!cancelled) setActiveIdx((i) => (i + 1) % MANIFESTO_SNIPPETS.length);
        }, 4000);
        timerRef.current.push(t);
      } else {
        setDisplayText(snippet.slice(0, chars));
        const t = setTimeout(stream, 30);
        timerRef.current.push(t);
      }
    };
    const start = setTimeout(stream, 400);
    timerRef.current.push(start);

    return () => {
      cancelled = true;
      timerRef.current.forEach(clearTimeout);
      timerRef.current = [];
    };
  }, [play, settled, activeIdx]);

  const isStreaming = displayText !== MANIFESTO_SNIPPETS[activeIdx];

  return (
    <div ref={ref}>
      <div
        style={{
          padding: '0.75rem 0.875rem',
          background: 'var(--atelier-cream)',
          borderLeft: '2px solid var(--atelier-brass-300)',
          borderRadius: '0 6px 6px 0',
          minHeight: 86,
        }}
      >
        <p
          style={{
            fontFamily: 'var(--atelier-font-display)',
            fontStyle: 'italic',
            fontSize: 13,
            lineHeight: 1.6,
            color: 'var(--atelier-stone-800)',
          }}
        >
          {displayText}
          {isStreaming && (
            <span
              aria-hidden="true"
              style={{
                display: 'inline-block',
                width: '0.45ch',
                marginLeft: 1,
                color: 'var(--atelier-brass-text)',
                animation: 'toolkit-blink 1s steps(2, start) infinite',
                fontStyle: 'normal',
              }}
            >
              ▍
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Card 5: Lookbook — share URL + 3 thumbnails reveal
// ─────────────────────────────────────────────────────────────────────────

// Occasion pills over a four-slot grid — the Styling Studio's own
// arrangement, borrowed from the (now unused) preview/OutfitPreview.jsx.
// The pill for the active occasion lights in brass and the slots refill
// beneath it, which is the point of the card: the same four slots, a
// different answer per occasion, all of it from one wardrobe.
const OCCASIONS = [
  {
    label: 'A morning meeting',
    items: [
      '/wardrobe/mirabel-satin-blouse.jpg',
      '/wardrobe/gael-wool-blend-trousers.jpg',
      '/wardrobe/marina-single-breasted-blazer.jpg',
      '/wardrobe/y-sparks-stick-gold-necklace.jpg',
    ],
  },
  {
    label: 'Drinks tonight',
    items: [
      '/wardrobe/claire-pleat-detail-dress.jpg',
      '/wardrobe/jasmin-coat.jpg',
      '/wardrobe/merisa-gold-wide-fit-block-heel-sandals-.jpg',
      '/wardrobe/gold-vermeil-baroque-pearl-pendant-pearl.jpg',
    ],
  },
  {
    label: 'A Saturday in town',
    items: [
      '/wardrobe/pippa-silk-front-colourblock-vest.jpg',
      '/wardrobe/high-rise-denim-shorts.jpg',
      '/wardrobe/suedette-2-part-block-heel-sandals.jpg',
      '/wardrobe/fine-chain-necklace-24-monica-vinader.jpg',
    ],
  },
];

function StylingDemo() {
  const ref = useRef(null);
  const { play, settled } = useInView(ref);
  const [activeIdx, setActiveIdx] = useState(0);
  const [revealed, setRevealed] = useState(0);
  const timerRef = useRef([]);

  useEffect(() => {
    const sample = OCCASIONS[activeIdx];
    if (settled) { setRevealed(sample.items.length); return undefined; }
    if (!play) return undefined;

    let cancelled = false;
    setRevealed(0);

    sample.items.forEach((_, i) => {
      const t = setTimeout(() => {
        if (!cancelled) setRevealed(i + 1);
      }, 420 + i * 240);
      timerRef.current.push(t);
    });

    const cycleTimer = setTimeout(() => {
      if (!cancelled) setActiveIdx((i) => (i + 1) % OCCASIONS.length);
    }, 420 + sample.items.length * 240 + 3200);
    timerRef.current.push(cycleTimer);

    return () => {
      cancelled = true;
      timerRef.current.forEach(clearTimeout);
      timerRef.current = [];
    };
  }, [play, settled, activeIdx]);

  const sample = OCCASIONS[activeIdx];

  return (
    <div ref={ref}>
      {/* Occasion pills. Presentational only — the real thing is a click
          away in the embed above, so these are not buttons and carry no
          keyboard affordance they could not honour. */}
      <div className="flex flex-wrap gap-1.5 mb-2.5" aria-hidden="true">
        {OCCASIONS.map((o, i) => {
          const isActive = i === activeIdx;
          return (
            <span
              key={o.label}
              style={{
                fontSize: 8.5,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                fontWeight: 600,
                padding: '0.25rem 0.6rem',
                borderRadius: 999,
                color: isActive ? 'var(--atelier-stone-900)' : 'var(--atelier-stone-400)',
                background: isActive ? 'rgba(212, 179, 120, 0.16)' : 'transparent',
                border: isActive
                  ? '1px solid var(--atelier-brass-300)'
                  : '1px solid var(--atelier-stone-200)',
                transition: 'all 320ms ease',
              }}
            >
              {o.label}
            </span>
          );
        })}
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {sample.items.map((src, i) => {
          const isRevealed = i < revealed;
          return (
            <div
              key={`${activeIdx}-${i}`}
              style={{
                aspectRatio: '3/4',
                borderRadius: 6,
                overflow: 'hidden',
                background: isRevealed ? 'var(--atelier-stone-100)' : 'transparent',
                border: isRevealed ? 'none' : '1px dashed var(--atelier-stone-200)',
                opacity: isRevealed ? 1 : 0.4,
                transform: isRevealed ? 'translateY(0)' : 'translateY(0.25rem)',
                transition: 'all 400ms ease',
              }}
            >
              {isRevealed && (
                <Pic
                  src={src}
                  alt=""
                  loading="lazy"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    animation: 'toolkit-drop-in 450ms cubic-bezier(0.22, 1, 0.36, 1)',
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Card 6: Calendar — mini week view, items drop into days
// ─────────────────────────────────────────────────────────────────────────

const WEEK_DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const CALENDAR_SAMPLES = [
  {
    plan: [
      { day: 0, src: '/wardrobe/gene-silk-front-vest-top-in-champagne-si.jpg' },
      { day: 2, src: '/wardrobe/claire-pleat-detail-dress.jpg' },
      { day: 4, src: '/wardrobe/gael-wool-blend-trousers.jpg' },
      { day: 6, src: '/wardrobe/pippa-silk-front-colourblock-vest.jpg' },
    ],
    today: 2, // Wed highlighted
  },
  {
    plan: [
      { day: 1, src: '/wardrobe/reg-classic-button-down-blouse.jpg' },
      { day: 3, src: '/wardrobe/jasmin-coat.jpg' },
      { day: 5, src: '/wardrobe/fine-chain-necklace-24-monica-vinader.jpg' },
    ],
    today: 3, // Thu
  },
];

function CalendarDemo() {
  const ref = useRef(null);
  const { play, settled } = useInView(ref);
  const [activeIdx, setActiveIdx] = useState(0);
  const [revealed, setRevealed] = useState(0);
  const timerRef = useRef([]);

  useEffect(() => {
    const sample = CALENDAR_SAMPLES[activeIdx];
    // Reduced motion: the week is already planned.
    if (settled) { setRevealed(sample.plan.length); return undefined; }
    if (!play) return undefined;
    let cancelled = false;

    setRevealed(0);

    sample.plan.forEach((_, i) => {
      const t = setTimeout(() => {
        if (!cancelled) setRevealed(i + 1);
      }, 500 + i * 320);
      timerRef.current.push(t);
    });

    const cycleTimer = setTimeout(() => {
      if (!cancelled) setActiveIdx((i) => (i + 1) % CALENDAR_SAMPLES.length);
    }, 500 + sample.plan.length * 320 + 3500);
    timerRef.current.push(cycleTimer);

    return () => {
      cancelled = true;
      timerRef.current.forEach(clearTimeout);
      timerRef.current = [];
    };
  }, [play, settled, activeIdx]);

  const sample = CALENDAR_SAMPLES[activeIdx];

  return (
    <div ref={ref} className="grid grid-cols-7 gap-1">
      {WEEK_DAYS.map((d, i) => {
        const plannedItem = sample.plan.find((p) => p.day === i);
        const itemIdx = sample.plan.indexOf(plannedItem);
        const isRevealed = plannedItem && itemIdx < revealed;
        const isToday = i === sample.today;
        return (
          <div key={i} className="flex flex-col items-center gap-1">
            <span
              style={{
                fontSize: 8.5,
                letterSpacing: '0.16em',
                fontWeight: isToday ? 700 : 500,
                color: isToday ? 'var(--atelier-brass-600)' : 'var(--atelier-stone-400)',
              }}
            >
              {d}
            </span>
            <div
              style={{
                width: '100%',
                aspectRatio: '3/4',
                borderRadius: 5,
                overflow: 'hidden',
                background: isRevealed ? 'var(--atelier-stone-100)' : 'transparent',
                border: isRevealed
                  ? 'none'
                  : isToday
                  ? '1px solid var(--atelier-brass-300)'
                  : '1px dashed var(--atelier-stone-200)',
                opacity: isRevealed ? 1 : 0.6,
                transition: 'all 400ms ease',
              }}
            >
              {isRevealed && (
                <Pic
                  src={plannedItem.src}
                  alt=""
                  loading="lazy"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    animation: 'toolkit-drop-in 500ms cubic-bezier(0.22, 1, 0.36, 1)',
                  }}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// FEATURE DATA — six methods, varied title rhythm
// ─────────────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: Home,
    eyebrow: 'Every morning',
    title: 'The day, decided',
    titleEm: 'before you ask.',
    description:
      'Atelier reads the forecast and — if you connect it — your diary, then has a look waiting when you open the app. One decision, made, with the reasoning attached.',
    demo: <TodayDemo />,
  },
  {
    icon: Camera,
    eyebrow: 'Compose',
    title: 'Style it yourself,',
    titleEm: 'or ask.',
    description:
      'Build a look slot by slot from your own pieces, or name the occasion and let the Concierge compose it. Keep what works to the Lookbook.',
    demo: <StylingDemo />,
  },
  {
    icon: MapPin,
    eyebrow: 'Pack with care',
    title: 'A capsule for',
    titleEm: 'every trip.',
    description:
      'Type a destination. The Concierge reads the forecast, the length, the kind of trip you take, and packs from your existing wardrobe.',
    demo: <TravelDemo />,
  },
  {
    icon: TrendingUp,
    eyebrow: 'The honest reckoning',
    title: 'Know what it',
    titleEm: 'costs.',
    description:
      'Every garment carries its updating cost-per-wear. The expensive piece worn a hundred times is cheaper than the bargain worn twice.',
    demo: <CPWDemo />,
  },
  {
    icon: Sparkles,
    eyebrow: 'The private brief',
    title: 'Your taste,',
    titleEm: 'written back.',
    description:
      'The Concierge reads every piece you own and every wear you log, and writes a three-paragraph brief of your aesthetic.',
    demo: <ManifestoDemo />,
  },
  {
    icon: CalendarDays,
    eyebrow: 'Plan your week',
    title: 'A wardrobe with a',
    titleEm: 'calendar.',
    description:
      'Schedule outfits to days, and — if you choose — connect your Google Calendar so Atelier reads your upcoming events to suggest outfits suited to your day: a board meeting, a long lunch, a quiet day in. Read-only: we never edit, delete, or share anything on your calendar.',
    demo: <CalendarDemo />,
  },
];

// ─────────────────────────────────────────────────────────────────────────
// Section
// ─────────────────────────────────────────────────────────────────────────

export function Toolkit() {
  return (
    <section
      id="toolkit"
      style={{
        paddingBlock: 'clamp(4rem, 7vw, 7rem)',
        paddingInline: 'var(--atelier-page-padding)',
        maxWidth: 'var(--atelier-container-max)',
        margin: '0 auto',
      }}
    >
      <div className="text-center" style={{ marginBottom: 'clamp(2.5rem, 5vw, 4rem)' }}>
        <div className="flex items-center justify-center gap-3 mb-5">
          <BrassRule />
          <p
            className="text-[10px] uppercase font-medium"
            style={{
              letterSpacing: '0.28em',
              color: 'var(--atelier-brass-text)',
            }}
          >
            The Toolkit
          </p>
          <BrassRule />
        </div>
        <h2
          className="mx-auto mb-4"
          style={{
            fontFamily: 'var(--atelier-font-display)',
            fontSize: 'clamp(2rem, 3.5vw, 3.25rem)',
            lineHeight: 1.05,
            color: 'var(--atelier-stone-900)',
            letterSpacing: '-0.01em',
            maxWidth: '20ch',
          }}
        >
          Six methods, <em style={{ fontWeight: 400 }}>one wardrobe</em>.
        </h2>
        <p
          className="mx-auto"
          style={{
            color: 'var(--atelier-stone-500)',
            fontSize: 'clamp(0.95rem, 1.15vw, 1.0625rem)',
            lineHeight: 1.6,
            maxWidth: '54ch',
          }}
        >
          You have just had the run of the studio. These are the six it is built around — the
          everyday work of stewardship, each one drawing on the same wardrobe.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
        {FEATURES.map((f, i) => (
          <ToolkitCard key={i} {...f} />
        ))}
      </div>

      <style>{`
        @keyframes toolkit-blink { 50% { opacity: 0; } }
        @keyframes toolkit-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes toolkit-drop-in {
          from { opacity: 0; transform: translateY(-4px) scale(0.96); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes cpw-img-in {
          from { opacity: 0; transform: scale(1.04); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </section>
  );
}
