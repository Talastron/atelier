// apps/marketing/src/components/Features.jsx
//
// The Toolkit — editorial spread of six methods. ALL six cards have
// scroll-triggered micro-demos so the grid weight is equal: the bottom
// row no longer reads as supporting features. Brass palette throughout
// (no emerald). Hover lift on every card.

import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  MapPin,
  TrendingUp,
  Sparkles,
  BookOpen,
  CalendarDays,
  Link2,
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

function useInView(ref, threshold = 0.3) {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold }
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [ref, threshold]);
  return inView;
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
          <Icon size={15} strokeWidth={1.5} style={{ color: 'var(--atelier-brass-600)' }} />
        </span>
        <p
          className="text-[9.5px] uppercase font-semibold"
          style={{
            letterSpacing: '0.28em',
            color: 'var(--atelier-brass-600)',
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
// Card 1: Identify — restructured: image left (larger), chips right
// ─────────────────────────────────────────────────────────────────────────

const IDENTIFY_SAMPLES = [
  {
    src: '/seed-wardrobe/camel-wool-coat.jpg',
    chips: ['OUTERWEAR', 'WOOL · CASHMERE', 'CAMEL', 'COS · £225'],
  },
  {
    src: '/seed-wardrobe/silk-twill-scarf.jpg',
    chips: ['ACCESSORIES', 'SILK TWILL', 'AUTUMN PALETTE', 'HERMÈS · £395'],
  },
];

function IdentifyDemo() {
  const ref = useRef(null);
  const inView = useInView(ref);
  const [activeIdx, setActiveIdx] = useState(0);
  const [revealed, setRevealed] = useState(0);
  const timerRef = useRef([]);

  useEffect(() => {
    if (!inView) return;
    let cancelled = false;
    const sample = IDENTIFY_SAMPLES[activeIdx];

    setRevealed(0);
    sample.chips.forEach((_, i) => {
      const t = setTimeout(() => {
        if (!cancelled) setRevealed(i + 1);
      }, 500 + i * 380);
      timerRef.current.push(t);
    });

    const cycleTimer = setTimeout(() => {
      if (!cancelled) setActiveIdx((i) => (i + 1) % IDENTIFY_SAMPLES.length);
    }, 500 + sample.chips.length * 380 + 3000);
    timerRef.current.push(cycleTimer);

    return () => {
      cancelled = true;
      timerRef.current.forEach(clearTimeout);
      timerRef.current = [];
    };
  }, [inView, activeIdx]);

  const sample = IDENTIFY_SAMPLES[activeIdx];

  return (
    <div ref={ref} className="flex gap-3.5 items-start">
      <div
        style={{
          width: 88,
          aspectRatio: '3/4',
          borderRadius: 8,
          overflow: 'hidden',
          background: 'var(--atelier-stone-100)',
          flexShrink: 0,
        }}
      >
        <img
          key={activeIdx}
          src={sample.src}
          alt=""
          loading="lazy"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            animation: 'identify-image-in 600ms ease',
          }}
        />
      </div>

      <div className="flex flex-col gap-1.5 flex-1 min-w-0 pt-1">
        {sample.chips.map((chip, i) => {
          const isOn = i < revealed;
          return (
            <span
              key={`${activeIdx}-${i}`}
              style={{
                display: 'inline-block',
                fontSize: 9,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                fontWeight: 600,
                color: isOn ? 'var(--atelier-stone-800)' : 'var(--atelier-stone-300)',
                background: isOn ? '#ffffff' : 'transparent',
                border: isOn
                  ? '1px solid var(--atelier-stone-200)'
                  : '1px dashed var(--atelier-stone-200)',
                borderRadius: 999,
                padding: '0.25rem 0.625rem',
                alignSelf: 'flex-start',
                opacity: isOn ? 1 : 0.45,
                transition: 'all 320ms ease',
              }}
            >
              {chip}
            </span>
          );
        })}
      </div>

      <style>{`
        @keyframes identify-image-in {
          from { opacity: 0; transform: scale(1.03); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Card 2: Travel capsule
// ─────────────────────────────────────────────────────────────────────────

const DESTINATIONS = [
  { name: 'Lisbon', items: ['/seed-wardrobe/breton-stripe-tee.jpg', '/seed-wardrobe/dark-wash-jeans.jpg', '/seed-wardrobe/silk-twill-scarf.jpg', '/seed-wardrobe/leather-sneakers-white.jpg', '/seed-wardrobe/silk-midi-dress-champagne.jpg'] },
  { name: 'Edinburgh', items: ['/seed-wardrobe/cashmere-rollneck-camel.jpg', '/seed-wardrobe/wool-trouser-charcoal.jpg', '/seed-wardrobe/camel-wool-coat.jpg', '/seed-wardrobe/leather-knee-boots-black.jpg', '/seed-wardrobe/structured-tote-tan.jpg'] },
];

function TravelDemo() {
  const ref = useRef(null);
  const inView = useInView(ref);
  const [activeIdx, setActiveIdx] = useState(0);
  const [typedName, setTypedName] = useState('');
  const [revealed, setRevealed] = useState(0);
  const timerRef = useRef([]);

  useEffect(() => {
    if (!inView) return;
    let cancelled = false;
    const dest = DESTINATIONS[activeIdx];

    setTypedName('');
    setRevealed(0);

    dest.name.split('').forEach((_, i) => {
      const t = setTimeout(() => {
        if (!cancelled) setTypedName(dest.name.slice(0, i + 1));
      }, 600 + i * 90);
      timerRef.current.push(t);
    });

    const typingDuration = 600 + dest.name.length * 90;
    dest.items.forEach((_, i) => {
      const t = setTimeout(() => {
        if (!cancelled) setRevealed(i + 1);
      }, typingDuration + 600 + i * 240);
      timerRef.current.push(t);
    });

    const cycleTimer = setTimeout(() => {
      if (!cancelled) setActiveIdx((i) => (i + 1) % DESTINATIONS.length);
    }, typingDuration + 600 + dest.items.length * 240 + 3000);
    timerRef.current.push(cycleTimer);

    return () => {
      cancelled = true;
      timerRef.current.forEach(clearTimeout);
      timerRef.current = [];
    };
  }, [inView, activeIdx]);

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
        <MapPin size={11} strokeWidth={1.6} style={{ color: 'var(--atelier-brass-600)' }} />
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
                <img
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
  { name: 'Cashmere rollneck', brand: 'Pringle of Scotland', src: '/seed-wardrobe/cashmere-rollneck-camel.jpg', price: 280, maxWears: 70 },
  { name: 'White poplin shirt', brand: 'The White Company', src: '/seed-wardrobe/poplin-shirt-white.jpg', price: 95, maxWears: 52 },
];

function CPWDemo() {
  const ref = useRef(null);
  const inView = useInView(ref);
  const [activeIdx, setActiveIdx] = useState(0);
  const [wears, setWears] = useState(1);
  const timerRef = useRef([]);

  useEffect(() => {
    if (!inView) return;
    let cancelled = false;
    const sample = CPW_SAMPLES[activeIdx];

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
  }, [inView, activeIdx]);

  const sample = CPW_SAMPLES[activeIdx];
  const cpw = (sample.price / wears).toFixed(2);

  return (
    <div ref={ref} className="flex items-center gap-3">
      <img
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
          {sample.brand} · {wears} wears
        </p>
      </div>
      <p
        style={{
          fontFamily: 'var(--atelier-font-display)',
          fontSize: 22,
          color: 'var(--atelier-brass-600)',
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
  'The cashmere rollneck has been worn seventy times this year. The silk blouse has not.',
];

function ManifestoDemo() {
  const ref = useRef(null);
  const inView = useInView(ref);
  const [activeIdx, setActiveIdx] = useState(0);
  const [displayText, setDisplayText] = useState('');
  const timerRef = useRef([]);

  useEffect(() => {
    if (!inView) return;
    let cancelled = false;
    const snippet = MANIFESTO_SNIPPETS[activeIdx];

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
  }, [inView, activeIdx]);

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
                color: 'var(--atelier-brass-600)',
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

const LOOKBOOK_SAMPLES = [
  { url: 'atelier.co/sh/3kF9p', items: ['/seed-wardrobe/cashmere-rollneck-camel.jpg', '/seed-wardrobe/wool-trouser-charcoal.jpg', '/seed-wardrobe/penny-loafers-tan.jpg'] },
  { url: 'atelier.co/sh/M2qZx', items: ['/seed-wardrobe/silk-midi-dress-champagne.jpg', '/seed-wardrobe/camel-wool-coat.jpg', '/seed-wardrobe/leather-knee-boots-black.jpg'] },
];

function LookbookDemo() {
  const ref = useRef(null);
  const inView = useInView(ref);
  const [activeIdx, setActiveIdx] = useState(0);
  const [revealed, setRevealed] = useState(0);
  const timerRef = useRef([]);

  useEffect(() => {
    if (!inView) return;
    let cancelled = false;
    const sample = LOOKBOOK_SAMPLES[activeIdx];

    setRevealed(0);

    sample.items.forEach((_, i) => {
      const t = setTimeout(() => {
        if (!cancelled) setRevealed(i + 1);
      }, 500 + i * 280);
      timerRef.current.push(t);
    });

    const cycleTimer = setTimeout(() => {
      if (!cancelled) setActiveIdx((i) => (i + 1) % LOOKBOOK_SAMPLES.length);
    }, 500 + sample.items.length * 280 + 3500);
    timerRef.current.push(cycleTimer);

    return () => {
      cancelled = true;
      timerRef.current.forEach(clearTimeout);
      timerRef.current = [];
    };
  }, [inView, activeIdx]);

  const sample = LOOKBOOK_SAMPLES[activeIdx];

  return (
    <div ref={ref}>
      <div
        className="flex items-center gap-2 mb-2.5"
        style={{
          padding: '0.4rem 0.75rem',
          background: 'var(--atelier-cream)',
          border: '1px solid var(--atelier-stone-200)',
          borderRadius: 8,
          fontFamily: 'monospace',
          fontSize: 10.5,
          color: 'var(--atelier-stone-700)',
        }}
      >
        <Link2 size={10} strokeWidth={1.6} style={{ color: 'var(--atelier-brass-600)' }} />
        <span key={activeIdx} style={{ animation: 'toolkit-fade 400ms ease' }}>
          {sample.url}
        </span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 8,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            fontFamily: 'var(--atelier-font-sans)',
            fontWeight: 600,
            color: 'var(--atelier-brass-600)',
            background: 'rgba(212, 179, 120, 0.12)',
            padding: '0.15rem 0.4rem',
            borderRadius: 4,
          }}
        >
          Read-only
        </span>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
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
                <img
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
// Card 6: Calendar — mini week view, items drop into days
// ─────────────────────────────────────────────────────────────────────────

const WEEK_DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const CALENDAR_SAMPLES = [
  {
    plan: [
      { day: 0, src: '/seed-wardrobe/cashmere-rollneck-camel.jpg' },
      { day: 2, src: '/seed-wardrobe/silk-midi-dress-champagne.jpg' },
      { day: 4, src: '/seed-wardrobe/wool-trouser-charcoal.jpg' },
      { day: 6, src: '/seed-wardrobe/breton-stripe-tee.jpg' },
    ],
    today: 2, // Wed highlighted
  },
  {
    plan: [
      { day: 1, src: '/seed-wardrobe/poplin-shirt-white.jpg' },
      { day: 3, src: '/seed-wardrobe/camel-wool-coat.jpg' },
      { day: 5, src: '/seed-wardrobe/silk-twill-scarf.jpg' },
    ],
    today: 3, // Thu
  },
];

function CalendarDemo() {
  const ref = useRef(null);
  const inView = useInView(ref);
  const [activeIdx, setActiveIdx] = useState(0);
  const [revealed, setRevealed] = useState(0);
  const timerRef = useRef([]);

  useEffect(() => {
    if (!inView) return;
    let cancelled = false;
    const sample = CALENDAR_SAMPLES[activeIdx];

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
  }, [inView, activeIdx]);

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
                <img
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
    icon: Camera,
    eyebrow: 'Identify',
    title: 'Add a piece, in',
    titleEm: 'seconds.',
    description:
      'A single photograph tells Atelier the brand, category, materials, and colour. Six routes from the wardrobe shelf to the digital one.',
    demo: <IdentifyDemo />,
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
    icon: BookOpen,
    eyebrow: 'Shared, never given',
    title: 'A lookbook,',
    titleEm: 'read-only.',
    description:
      'Compose a saved look. Send a private link. The recipient sees the curation; your wardrobe stays yours. No login required.',
    demo: <LookbookDemo />,
  },
  {
    icon: CalendarDays,
    eyebrow: 'Plan your week',
    title: 'A wardrobe with a',
    titleEm: 'calendar.',
    description:
      'Schedule outfits to days. Repeat what worked, vary what didn’t. The week ahead becomes a quiet act of editing.',
    demo: <CalendarDemo />,
  },
];

// ─────────────────────────────────────────────────────────────────────────
// Section
// ─────────────────────────────────────────────────────────────────────────

export function Features() {
  return (
    <section
      id="features"
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
              color: 'var(--atelier-brass-600)',
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
          Beyond the Concierge, the studio brings together six considered tools for the everyday
          work of stewardship.
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
