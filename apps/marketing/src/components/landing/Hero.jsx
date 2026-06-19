import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronRight,
  Sparkles,
  LayoutGrid,
  Camera,
  BookOpen,
  Bookmark,
  PoundSterling,
  Ruler,
  Wand2,
} from 'lucide-react';

/**
 * Hero — editorial typography sitting above a live, interactive studio
 * surface that runs the actual Suggest-a-Look flow as a screen recording.
 *
 *   - Sidebar matches the real studio app exactly (icons, labels, order
 *     from src/App.jsx:3174). Hanger AtelierMark at the top, just as
 *     it appears in the actual sidebar header (src/App.jsx:3143).
 *   - Main pane shows the Today card. The brass "Suggest a look" button
 *     auto-glows, auto-presses, then the Concierge composes an outfit:
 *     items reveal one at a time at ~500ms intervals, slow enough to
 *     read as considered rather than slapped down. Stylist's note
 *     appears underneath. Hold for 6s. Cross-fade to next outfit.
 *   - Same shadow/radius/border vocabulary as the Concierge and
 *     Suggest-a-Look demos in sections 2 and 3, so the three demos
 *     read as one product seen from three angles.
 */

const OUTFITS = [
  {
    label: 'A morning meeting',
    weather: '15–27°C · Partly cloudy',
    note: 'Soft volume on top, sharp tailoring below. One decision, not four.',
    confidence: 94,
    items: [
      { name: 'Cashmere rollneck',    src: '/seed-wardrobe/cashmere-rollneck-camel.jpg' },
      { name: 'Charcoal wool trouser', src: '/seed-wardrobe/wool-trouser-charcoal.jpg' },
      { name: 'Tan penny loafers',    src: '/seed-wardrobe/penny-loafers-tan.jpg' },
      { name: 'Structured tote',      src: '/seed-wardrobe/structured-tote-tan.jpg' },
    ],
  },
  {
    label: 'Drinks tonight',
    weather: '12–18°C · Clear',
    note: 'Champagne silk against the camel coat. Quiet glamour, no shouting.',
    confidence: 89,
    items: [
      { name: 'Silk midi dress',       src: '/seed-wardrobe/silk-midi-dress-champagne.jpg' },
      { name: 'Camel wool coat',       src: '/seed-wardrobe/camel-wool-coat.jpg' },
      { name: 'Black knee boots',      src: '/seed-wardrobe/leather-knee-boots-black.jpg' },
      { name: 'Gold layered necklaces', src: '/seed-wardrobe/gold-layered-necklaces.jpg' },
    ],
  },
  {
    label: 'A Saturday in town',
    weather: '18–22°C · Bright',
    note: 'Breton and denim, lifted by a silk scarf at the bag handle.',
    confidence: 91,
    items: [
      { name: 'Breton stripe tee',     src: '/seed-wardrobe/breton-stripe-tee.jpg' },
      { name: 'Dark wash jeans',       src: '/seed-wardrobe/dark-wash-jeans.jpg' },
      { name: 'White leather sneakers', src: '/seed-wardrobe/leather-sneakers-white.jpg' },
      { name: 'Silk twill scarf',      src: '/seed-wardrobe/silk-twill-scarf.jpg' },
    ],
  },
];

// Sidebar icons + labels match src/App.jsx:3174 — the real studio nav.
// Wardrobe stays the active route because the Today card lives there.
const NAV_ITEMS = [
  { icon: Sparkles,       label: 'Concierge',       brass: true },
  { icon: LayoutGrid,     label: 'Wardrobe',        active: true },
  { icon: Camera,         label: 'Styling Studio' },
  { icon: BookOpen,       label: 'Lookbook' },
  { icon: Bookmark,       label: 'Inspiration' },
  { icon: PoundSterling,  label: 'Insights' },
  { icon: Ruler,          label: 'Profile' },
];

// Atelier hanger sentinel — verbatim from src/App.jsx:182. The brass charm
// is the brand's signature; matches what users see when they sign in.
function AtelierMark({ size = 28 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 256 256"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="256" height="256" fill="#1c1917" rx="56" />
      <g
        fill="none"
        stroke="#F7F5F2"
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M 160 60 Q 160 44 144 44 Q 128 44 128 58 L 128 110" />
        <path d="M 128 110 L 62 184 L 194 184 Z" />
      </g>
      <line x1="128" y1="184" x2="128" y2="206" stroke="#D4B378" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
      <circle cx="128" cy="212" r="5" fill="#D4B378" />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// The interactive studio surface — runs the Suggest-a-Look flow
// ─────────────────────────────────────────────────────────────────────────

const STAGE = {
  IDLE: 'idle',                   // Today card visible, button waiting
  BUTTON_GLOW: 'button-glow',     // Button glows, about to press
  COMPOSING: 'composing',         // Spinning wand, "Composing"
  REVEALING: 'revealing',         // Items appear one by one
  COMPLETE: 'complete',           // All items + note + confidence
  TRANSITION: 'transition',       // Cross-fade to next outfit
};

function StudioFrame() {
  const [outfitIdx, setOutfitIdx] = useState(0);
  const [stage, setStage] = useState(STAGE.IDLE);
  const [revealedSlots, setRevealedSlots] = useState(0);
  const [confidence, setConfidence] = useState(0);
  const containerRef = useRef(null);
  const [inView, setInView] = useState(true);

  const timersRef = useRef([]);
  const addTimer = (fn, ms) => {
    const id = setTimeout(fn, ms);
    timersRef.current.push(id);
    return id;
  };
  const clearAllTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.1 }
    );
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  // Main animation loop. Slow, considered timing throughout.
  useEffect(() => {
    if (!inView) {
      clearAllTimers();
      return;
    }
    let cancelled = false;
    let localIdx = outfitIdx;

    const runOnce = () => {
      if (cancelled) return;
      setStage(STAGE.IDLE);
      setRevealedSlots(0);
      setConfidence(0);

      // 1. Pause on idle so visitors see the button as a CTA
      addTimer(() => !cancelled && setStage(STAGE.BUTTON_GLOW), 1800);

      // 2. Composing — spinning wand, brass eyebrow turns to "Composing"
      addTimer(() => !cancelled && setStage(STAGE.COMPOSING), 2600);

      // 3. Items reveal one at a time, 600ms between each.
      //    600ms is slow enough to feel "laid out one piece at a time"
      //    rather than dumped in a batch. Total reveal time: 2.4s.
      addTimer(() => !cancelled && setStage(STAGE.REVEALING), 4100);
      for (let i = 1; i <= 4; i += 1) {
        addTimer(() => !cancelled && setRevealedSlots(i), 4100 + i * 600);
      }

      // 4. Confidence count-up while last items reveal — finishes at ~7s
      const confidenceBase = 6200;
      const targetConfidence = OUTFITS[localIdx].confidence;
      for (let pct = 0; pct <= targetConfidence; pct += 2) {
        addTimer(() => !cancelled && setConfidence(pct), confidenceBase + pct * 10);
      }

      // 5. Complete state
      addTimer(() => !cancelled && setStage(STAGE.COMPLETE), 7400);

      // 6. Hold for 6s so visitors can read the stylist's note
      addTimer(() => !cancelled && setStage(STAGE.TRANSITION), 13400);

      // 7. Cross-fade to next outfit
      addTimer(() => {
        if (cancelled) return;
        localIdx = (localIdx + 1) % OUTFITS.length;
        setOutfitIdx(localIdx);
        runOnce();
      }, 14200);
    };

    runOnce();
    return () => {
      cancelled = true;
      clearAllTimers();
    };
    // Intentionally only depend on inView; outfit index is managed internally
    // via localIdx so the effect doesn't restart every time we advance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView]);

  const current = OUTFITS[outfitIdx];
  const showingOutfit =
    stage === STAGE.REVEALING ||
    stage === STAGE.COMPLETE;
  const buttonGlowing = stage === STAGE.BUTTON_GLOW;
  const composing = stage === STAGE.COMPOSING;
  const fading = stage === STAGE.TRANSITION;

  return (
    <div
      ref={containerRef}
      className="mx-auto"
      style={{
        marginTop: 'clamp(2.5rem, 4vw, 4rem)',
        width: 'min(100%, 980px)',
        background: '#ffffff',
        border: '1px solid var(--atelier-stone-200)',
        borderRadius: 20,
        overflow: 'hidden',
        boxShadow:
          '0 60px 140px -30px rgba(40, 28, 12, 0.22), 0 22px 60px -20px rgba(28, 25, 23, 0.14)',
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 188px) 1fr',
        textAlign: 'left',
      }}
    >
      {/* ── Sidebar — matches the actual studio shell ─────────────────── */}
      <aside
        style={{
          background: 'var(--atelier-cream)',
          borderRight: '1px solid var(--atelier-stone-200)',
          padding: '1.25rem 0.875rem 1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.125rem',
        }}
      >
        {/* Atelier sentinel — hanger logo + wordmark, matches App.jsx:3143 */}
        <div
          style={{
            padding: '0.25rem 0.5rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: 9,
          }}
        >
          <AtelierMark size={26} />
          <span
            style={{
              fontFamily: 'var(--atelier-font-display)',
              fontSize: 17,
              color: 'var(--atelier-stone-900)',
              letterSpacing: '-0.01em',
              lineHeight: 1,
            }}
          >
            Atelier.
          </span>
        </div>

        {/* "STUDIO" eyebrow with brass rule — matches App.jsx:3152 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '0 0.5rem 0.625rem',
          }}
        >
          <span
            aria-hidden="true"
            style={{
              display: 'inline-block',
              width: 18,
              height: '1.5px',
              background: 'var(--atelier-brass-300)',
            }}
          />
          <span
            style={{
              fontSize: 8.5,
              letterSpacing: '0.28em',
              color: 'var(--atelier-stone-400)',
              fontWeight: 600,
              textTransform: 'uppercase',
            }}
          >
            Studio
          </span>
        </div>

        {/* Nav items */}
        {NAV_ITEMS.map(({ icon: Icon, label, active, brass }) => (
          <div
            key={label}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 11,
              padding: '0.5rem 0.625rem',
              borderRadius: 10,
              background: active ? '#ffffff' : 'transparent',
              color: active ? 'var(--atelier-stone-900)' : 'var(--atelier-stone-600)',
              fontWeight: active ? 500 : 500,
              fontSize: 12,
              boxShadow: active ? '0 1px 2px rgba(28, 25, 23, 0.04)' : 'none',
              border: active
                ? '1px solid var(--atelier-stone-200)'
                : '1px solid transparent',
            }}
          >
            <Icon
              size={13}
              strokeWidth={1.6}
              style={{
                color: brass
                  ? 'var(--atelier-brass-600)'
                  : active
                  ? 'var(--atelier-stone-700)'
                  : 'var(--atelier-stone-400)',
                flexShrink: 0,
              }}
            />
            <span style={{ flex: 1 }}>{label}</span>
            {brass && (
              <span
                style={{
                  fontSize: 8.5,
                  letterSpacing: '0.22em',
                  color: 'var(--atelier-brass-600)',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                }}
              >
                Ask
              </span>
            )}
          </div>
        ))}
      </aside>

      {/* ── Main pane — the live Suggest-a-Look flow ──────────────────── */}
      <div
        style={{
          padding: 'clamp(1.25rem, 2vw, 1.75rem)',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          minWidth: 0,
          minHeight: 380,
        }}
      >
        {/* Header — Today eyebrow + outfit label + brass action */}
        <div className="flex items-start justify-between gap-4">
          <div style={{ minWidth: 0, flex: 1 }}>
            <p
              className="text-[9px] uppercase font-semibold"
              style={{
                letterSpacing: '0.28em',
                color: 'var(--atelier-stone-500)',
                marginBottom: 6,
              }}
            >
              Today · {current.weather}
            </p>
            <h3
              key={`${outfitIdx}-${stage}`}
              style={{
                fontFamily: 'var(--atelier-font-display)',
                fontSize: 'clamp(1.125rem, 1.6vw, 1.5rem)',
                lineHeight: 1.15,
                color: 'var(--atelier-stone-900)',
                letterSpacing: '-0.005em',
                animation: 'hero-label-fade 600ms ease',
              }}
            >
              {composing
                ? 'Atelier is styling you…'
                : showingOutfit && stage === STAGE.COMPLETE
                ? `Today's proposal · ${current.label}`
                : showingOutfit
                ? `Today's proposal · ${current.label}`
                : `Compose for ${current.label.toLowerCase()}.`}
            </h3>
          </div>

          {/* Brass Suggest button — fixed width so the label switch
              ("Suggest a look" → "Composing") doesn't resize the button */}
          <button
            type="button"
            tabIndex={-1}
            aria-hidden="true"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '0.55rem 1rem',
              minWidth: 148,
              borderRadius: 999,
              background: 'var(--atelier-brass-300)',
              color: 'var(--atelier-stone-900)',
              fontSize: 10.5,
              fontWeight: 600,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              flexShrink: 0,
              boxShadow: buttonGlowing
                ? '0 0 0 4px rgba(212, 179, 120, 0.35), 0 0 22px rgba(212, 179, 120, 0.5)'
                : '0 1px 2px rgba(28, 25, 23, 0.06)',
              transform: buttonGlowing ? 'scale(1.04)' : 'scale(1)',
              transition: 'all 350ms ease',
              opacity: composing || showingOutfit ? 0.35 : 1,
            }}
          >
            <Wand2
              size={11}
              strokeWidth={1.6}
              style={{
                animation: composing ? 'hero-wand-spin 1.4s linear infinite' : 'none',
              }}
            />
            {composing ? 'Composing' : 'Suggest a look'}
          </button>
        </div>

        {/* Outfit grid — empty slots when idle, filled when revealing */}
        <div
          className="grid grid-cols-4 gap-2.5 sm:gap-3"
          style={{
            opacity: fading ? 0 : 1,
            transition: 'opacity 500ms ease',
          }}
        >
          {current.items.map((item, i) => {
            const isRevealed = showingOutfit && i < revealedSlots;
            const isPlaceholder = !showingOutfit && stage !== STAGE.COMPOSING;
            return (
              <div key={`${outfitIdx}-${i}`} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div
                  style={{
                    aspectRatio: '3/4',
                    borderRadius: 10,
                    overflow: 'hidden',
                    background: isRevealed
                      ? 'var(--atelier-stone-100)'
                      : 'transparent',
                    border: isRevealed
                      ? 'none'
                      : '1.5px dashed var(--atelier-stone-200)',
                    position: 'relative',
                  }}
                >
                  {!isRevealed && (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 8.5,
                        letterSpacing: '0.24em',
                        color: 'var(--atelier-stone-300)',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                      }}
                    >
                      {composing ? '· · ·' : ['Top', 'Bottom', 'Footwear', 'Accessory'][i]}
                    </div>
                  )}
                  {isRevealed && (
                    <img
                      src={item.src}
                      alt={item.name}
                      loading="lazy"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        animation: 'hero-slot-rise 700ms cubic-bezier(0.22, 1, 0.36, 1)',
                      }}
                    />
                  )}
                </div>
                {/* Caption — ALWAYS rendered (reserved height) so the grid
                    doesn't grow when items reveal. Text fades in via opacity. */}
                <p
                  style={{
                    fontFamily: 'var(--atelier-font-display)',
                    fontSize: 11,
                    color: 'var(--atelier-stone-800)',
                    lineHeight: 1.3,
                    minHeight: '1.3em',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    opacity: isRevealed ? 1 : 0,
                    transform: isRevealed ? 'translateY(0)' : 'translateY(0.15rem)',
                    transition: 'opacity 400ms ease 120ms, transform 400ms ease 120ms',
                  }}
                >
                  {isRevealed ? item.name : ' '}
                </p>
              </div>
            );
          })}
        </div>

        {/* Stylist's note + confidence — appears at COMPLETE */}
        <div
          style={{
            marginTop: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '0.75rem 1rem',
            borderRadius: 10,
            background: 'var(--atelier-cream)',
            border: '1px solid var(--atelier-stone-200)',
            opacity: stage === STAGE.COMPLETE ? 1 : 0,
            transform: stage === STAGE.COMPLETE ? 'translateY(0)' : 'translateY(0.25rem)',
            transition: 'opacity 500ms ease, transform 500ms ease',
          }}
        >
          <Wand2
            size={14}
            strokeWidth={1.4}
            style={{ color: 'var(--atelier-brass-600)', flexShrink: 0 }}
          />
          <p
            style={{
              fontFamily: 'var(--atelier-font-display)',
              fontStyle: 'italic',
              fontSize: 12.5,
              lineHeight: 1.4,
              color: 'var(--atelier-stone-700)',
              flex: 1,
              minWidth: 0,
            }}
          >
            {current.note}
          </p>
          <p
            style={{
              fontSize: 10,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: 'var(--atelier-brass-600)',
              fontWeight: 600,
              flexShrink: 0,
              fontFeatureSettings: '"onum" on',
            }}
          >
            {confidence}% confidence
          </p>
        </div>
      </div>

      <style>{`
        @keyframes hero-label-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes hero-wand-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes hero-slot-rise {
          from { opacity: 0; transform: scale(1.04); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes hero-caption-fade {
          from { opacity: 0; transform: translateY(0.2rem); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Hero — typography + interactive studio
// ─────────────────────────────────────────────────────────────────────────

export function Hero() {
  return (
    <section
      className="relative text-center flex flex-col items-center justify-center"
      style={{
        minHeight: '100vh',
        paddingTop: 'clamp(6rem, 9vw, 8rem)',
        paddingBottom: 'clamp(3rem, 5vw, 4rem)',
        paddingInline: 'var(--atelier-page-padding)',
      }}
    >
      {/* Soft brass atmosphere */}
      <div
        aria-hidden="true"
        className="absolute pointer-events-none"
        style={{
          top: '4%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '70%',
          height: '50%',
          background:
            'radial-gradient(ellipse at center, rgba(212, 179, 120, 0.06) 0%, transparent 65%)',
        }}
      />

      <div
        className="relative w-full"
        style={{ maxWidth: 'var(--atelier-container-max)', margin: '0 auto' }}
      >
        {/* Masthead band */}
        <div className="flex items-center justify-center gap-4 mb-6">
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
            className="text-[10px] uppercase font-medium"
            style={{
              letterSpacing: '0.32em',
              color: 'var(--atelier-brass-600)',
            }}
          >
            The Atelier Studio · MMXXVI
          </p>
          <span
            aria-hidden="true"
            style={{
              display: 'inline-block',
              width: '24px',
              height: '1.5px',
              background: 'var(--atelier-brass-300)',
            }}
          />
        </div>

        {/* Headline */}
        <h1
          className="mx-auto"
          style={{
            fontFamily: 'var(--atelier-font-display)',
            fontSize: 'clamp(2.25rem, 5vw, 4.75rem)',
            lineHeight: 1.05,
            letterSpacing: '-0.015em',
            color: 'var(--atelier-stone-900)',
            maxWidth: '20ch',
            marginBottom: 'clamp(1.25rem, 2vw, 1.75rem)',
          }}
        >
          An AI stylist that knows{' '}
          <em style={{ fontWeight: 400 }}>what's actually in</em> your wardrobe.
        </h1>

        {/* Subhead */}
        <p
          className="mx-auto"
          style={{
            color: 'var(--atelier-stone-500)',
            fontSize: 'clamp(1rem, 1.3vw, 1.125rem)',
            lineHeight: 1.65,
            maxWidth: '52ch',
            marginBottom: 'clamp(1.75rem, 2.5vw, 2.25rem)',
          }}
        >
          Atelier reads every piece you own, every wear you log, every look you save, and styles
          you from your closet, not someone else's.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a
            href="/pricing"
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full text-sm font-medium transition-all"
            style={{
              background: 'var(--atelier-ink)',
              color: '#ffffff',
              letterSpacing: '0.04em',
              boxShadow: '0 4px 24px -8px rgba(28, 25, 23, 0.3)',
            }}
          >
            Begin curating
            <ChevronRight size={16} strokeWidth={1.75} />
          </a>
          <a
            href="/studio"
            className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors group"
            style={{ color: 'var(--atelier-stone-600)' }}
          >
            See the studio
            <span
              className="transition-transform group-hover:translate-x-1"
              style={{ color: 'var(--atelier-brass-600)', display: 'inline-block' }}
            >
              →
            </span>
          </a>
        </div>

        {/* Live interactive studio surface */}
        <StudioFrame />
      </div>
    </section>
  );
}
