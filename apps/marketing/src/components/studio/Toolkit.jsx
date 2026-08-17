// apps/marketing/src/components/studio/Toolkit.jsx
//
// The Toolkit — three full-width editorial spreads, each with a
// scroll-triggered demo, alternating down the page beneath the live embed
// on /studio. SurfaceIndex below is the actual feature list; this is the
// argument.
//
// This began as components/Features.jsx: six cards, three across, every
// one animating. It was cut from the home page for reading
// SaaS-by-default, revived here, and failed again for two reasons worth
// recording so it is not revived a third time in the same shape.
//
// Six demos were visible at once on desktop, each running its own timing
// chain with no shared clock, and the result read as chaotic rather than
// restrained. And equal-width cards forced unlike objects — a five-image
// capsule, a streaming paragraph, a price row — into one column, so
// descriptions of different lengths pushed each demo to a different
// height and the rows never lined up.
//
// The deeper fault was the selection. Three of the six re-enacted
// surfaces — Today, the Styling Studio, the Calendar — that the visitor
// can simply click on in the real app immediately above. That is the
// StudioFrame mistake in a smaller frame: a cartoon of the product next
// to the product. What survives is only what the embed cannot show,
// because it takes a season to happen: a cost-per-wear falling across
// fifty wears, a written brief composed from everything logged, a trip
// becoming a packed capsule. Today, the Styling Studio and the Calendar
// are named in SurfaceIndex instead, where naming is all they need.

import React, { useState, useEffect, useRef } from 'react';
import { Pic } from '@atelier/ui';
import { MapPin, TrendingUp, Sparkles } from 'lucide-react';

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
// Method row — a full-width editorial spread, copy on one side and the
// demo on the other, alternating down the page.
//
// This replaced a three-across card grid, which failed on two counts. Six
// demos sat visible at once, each on its own timing chain with no shared
// clock, and the effect was closer to a trading terminal than to anything
// this brand would print. And equal-width cards forced genuinely unlike
// objects — a five-image capsule, a streaming paragraph, a price row —
// into one column width, so descriptions of different lengths pushed each
// demo to a different height and the row never lined up.
//
// Rows fix both. Only one demo is near the centre of the viewport at a
// time, which is what makes the motion feel deliberate rather than
// competing, and the demo panel below has one fixed minimum height for
// all three, so the spreads share a rhythm without pretending their
// contents are the same shape.
// ─────────────────────────────────────────────────────────────────────────

function MethodRow({ index, icon: Icon, eyebrow, title, titleEm, description, demo }) {
  return (
    <article className="method-row">
      <div className="method-copy">
        <div className="flex items-center gap-3 mb-4">
          <span className="method-numeral" aria-hidden="true">
            {['I', 'II', 'III'][index]}
          </span>
          <BrassRule />
          <p
            className="text-[9.5px] uppercase font-semibold"
            style={{ letterSpacing: '0.28em', color: 'var(--atelier-brass-text)' }}
          >
            {eyebrow}
          </p>
        </div>

        <h3 className="method-title">
          {title}
          {titleEm && (
            <>
              {' '}
              <em style={{ fontWeight: 400 }}>{titleEm}</em>
            </>
          )}
        </h3>

        <p className="method-description">{description}</p>

        <span className="method-icon" aria-hidden="true">
          <Icon size={16} strokeWidth={1.4} style={{ color: 'var(--atelier-brass-text)' }} />
        </span>
      </div>

      {/* The stage. One minimum height across all three so the spreads keep
          a shared rhythm; the demo centres inside whatever room it needs. */}
      <div className="method-stage">
        <div className="method-stage-inner">{demo}</div>
      </div>
    </article>
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
// THE THREE METHODS
//
// Not a feature list — SurfaceIndex below is the feature list. These are
// the three things the studio COMPOSES rather than displays, and they are
// the three chosen precisely because the live embed above cannot show
// them. A visitor can click every surface in the app in thirty seconds;
// they cannot watch a coat's cost-per-wear fall across fifty wears, see a
// season of logged wears condensed into a written brief, or watch a trip
// become a packed capsule. Everything that IS visible by clicking around
// up there was cut, because re-enacting it in miniature directly beneath
// the real thing is the StudioFrame mistake in a smaller frame.
// ─────────────────────────────────────────────────────────────────────────

const METHODS = [
  {
    icon: TrendingUp,
    eyebrow: 'The honest reckoning',
    title: 'Know what it',
    titleEm: 'costs.',
    description:
      'Every garment carries its updating cost-per-wear. The expensive piece worn a hundred times is cheaper than the bargain worn twice — and the studio keeps the tally so you can stop guessing which is which.',
    demo: <CPWDemo />,
  },
  {
    icon: Sparkles,
    eyebrow: 'The private brief',
    title: 'Your taste,',
    titleEm: 'written back.',
    description:
      'The Concierge reads every piece you own and every wear you log, and writes a brief of your aesthetic — the palette you actually buy, the shapes you actually reach for, refreshed as the year turns.',
    demo: <ManifestoDemo />,
  },
  {
    icon: MapPin,
    eyebrow: 'Pack with care',
    title: 'A capsule for',
    titleEm: 'every trip.',
    description:
      'Name a destination. The Concierge reads the forecast, the length of the stay and the kind of trip you take, then packs it from the wardrobe you already own — and prints the list.',
    demo: <TravelDemo />,
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
          Three things it <em style={{ fontWeight: 400 }}>composes</em>.
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
          You have just had the run of every room. These three are the work the studio does on
          its own, from everything you have logged — the parts that take a season to appear, and
          so cannot be found by clicking about above.
        </p>
      </div>

      <div className="method-list">
        {METHODS.map((m, i) => (
          <MethodRow key={m.eyebrow} index={i} {...m} />
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

        .method-list {
          display: flex;
          flex-direction: column;
          gap: clamp(3.5rem, 7vw, 6rem);
        }

        .method-row {
          display: grid;
          grid-template-columns: minmax(0, 0.95fr) minmax(0, 1fr);
          gap: clamp(2rem, 5vw, 4.5rem);
          align-items: center;
        }

        /* Alternate the spread. The stage leads on even-numbered rows, which
           is what stops three identical spreads reading as a template.

           The template is mirrored alongside the order swap, and it has to
           be: order changes where an item is painted but not which track it
           occupies, so swapping order alone dropped the stage into the
           narrower 0.95fr column on reversed rows and the three stages came
           out 517 / 492 / 517px wide. Mirroring the tracks keeps the stage
           on the 1fr side whichever way round the row is set.

           (No backticks anywhere in this block: the whole stylesheet is a
           JS template literal, so one would end the string mid-comment.) */
        .method-row:nth-child(even) {
          grid-template-columns: minmax(0, 1fr) minmax(0, 0.95fr);
        }
        .method-row:nth-child(even) .method-copy { order: 2; }

        .method-copy { min-width: 0; }

        .method-numeral {
          font-family: var(--atelier-font-display);
          font-style: italic;
          font-size: 0.9375rem;
          color: var(--atelier-brass-600);
          letter-spacing: 0.04em;
        }

        .method-title {
          font-family: var(--atelier-font-display);
          font-size: clamp(1.75rem, 3vw, 2.5rem);
          line-height: 1.08;
          color: var(--atelier-stone-900);
          letter-spacing: -0.012em;
          margin-bottom: 1rem;
        }

        .method-description {
          font-size: clamp(0.9375rem, 1.1vw, 1.0625rem);
          line-height: 1.65;
          color: var(--atelier-stone-500);
          max-width: 46ch;
        }

        /* A quiet brass mark closing the copy column — the same role the
           icon played in the old card header, without reintroducing a
           badge at the top of every block. */
        .method-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 34px;
          height: 34px;
          margin-top: 1.75rem;
          border-radius: 50%;
          border: 1px solid var(--atelier-brass-300);
          background: rgba(212, 179, 120, 0.08);
        }

        .method-stage { min-width: 0; }

        .method-stage-inner {
          background: #ffffff;
          border: 1px solid var(--atelier-stone-200);
          border-radius: 18px;
          padding: clamp(1.5rem, 2.5vw, 2.25rem);
          box-shadow:
            0 18px 44px -22px rgba(28, 25, 23, 0.16),
            0 2px 6px rgba(28, 25, 23, 0.03);
          min-height: 268px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        @media (max-width: 900px) {
          /* The :nth-child(even) selector must be repeated here, not just
             .method-row. A media query adds no specificity, so the two-column
             even-row rule above (0,2,0) outranks a bare .method-row (0,1,0)
             inside this block — which left the middle row still split in two
             on a phone, with its stage crushed to 122px. */
          .method-row,
          .method-row:nth-child(even) {
            grid-template-columns: 1fr;
            gap: 1.75rem;
          }
          /* Copy always leads when stacked — an unexplained animation
             arriving before its heading is just decoration. */
          .method-row:nth-child(even) .method-copy { order: 0; }
          .method-icon { margin-top: 1.25rem; }
          .method-stage-inner { min-height: 232px; }
        }
      `}</style>
    </section>
  );
}
