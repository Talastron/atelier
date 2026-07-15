import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronRight,
  Sparkles,
  Home,
  LayoutGrid,
  Camera,
  Calendar,
  BookOpen,
  Bookmark,
  PoundSterling,
  Store,
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
      { name: 'Champagne silk vest', src: '/wardrobe/gene-silk-front-vest-top-in-champagne-si.jpg' },
      { name: 'Wool-blend trousers', src: '/wardrobe/gael-wool-blend-trousers.jpg' },
      { name: 'Block-heel sandals', src: '/wardrobe/suedette-2-part-block-heel-sandals.jpg' },
      { name: 'Fine chain necklace', src: '/wardrobe/fine-chain-necklace-24-monica-vinader.jpg' },
    ],
  },
  {
    label: 'Drinks tonight',
    weather: '12–18°C · Clear',
    note: 'Champagne silk against the charcoal coat. Quiet glamour, no shouting.',
    confidence: 89,
    items: [
      { name: 'Pleat-detail dress', src: '/wardrobe/claire-pleat-detail-dress.jpg' },
      { name: 'Navy wool coat', src: '/wardrobe/jasmin-coat.jpg' },
      { name: 'Gold block-heel sandals', src: '/wardrobe/merisa-gold-wide-fit-block-heel-sandals-.jpg' },
      { name: 'Fine chain necklace', src: '/wardrobe/fine-chain-necklace-24-monica-vinader.jpg' },
    ],
  },
  {
    label: 'A Saturday in town',
    weather: '18–22°C · Bright',
    note: 'Colour-blocked silk and denim, lifted by a fine gold necklace.',
    confidence: 91,
    items: [
      { name: 'Silk colourblock vest', src: '/wardrobe/pippa-silk-front-colourblock-vest.jpg' },
      { name: 'High-rise denim shorts', src: '/wardrobe/high-rise-denim-shorts.jpg' },
      { name: 'Block-heel sandals', src: '/wardrobe/suedette-2-part-block-heel-sandals.jpg' },
      { name: 'Gold stick necklace', src: '/wardrobe/y-sparks-stick-gold-necklace.jpg' },
    ],
  },
];

// The small (~480px, ~12KB) JPEG variant of a wardrobe photo. The grid slots
// render at ~150px, so this is ample even at 2x — and it loads far faster than
// the full 900px source, so revealed items appear crisply instead of popping in.
const SM = (src) => src.replace(/\.(jpe?g|png)$/i, '-sm.jpg');

// Sidebar icons + labels mirror the real studio nav (src/nav/Sidebar.jsx):
// Concierge · Today · Wardrobe · Styling Studio · Calendar · Lookbook, then a
// hairline and the quieter trio Inspiration · Insights · Directory. Today is
// the active route because the mock shows the Daily Brief landing view.
const NAV_ITEMS = [
  { icon: Sparkles,       label: 'Concierge',       brass: true },
  { icon: Home,           label: 'Today',           active: true },
  { icon: LayoutGrid,     label: 'Wardrobe' },
  { icon: Camera,         label: 'Styling Studio' },
  { icon: Calendar,       label: 'Calendar' },
  { icon: BookOpen,       label: 'Lookbook' },
  { icon: Bookmark,       label: 'Inspiration',     divider: true },
  { icon: PoundSterling,  label: 'Insights' },
  { icon: Store,          label: 'Directory' },
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
  // Two reasons to suspend the perpetual demo loop: the visitor prefers
  // reduced motion, or the tab is backgrounded (where the setTimeout chain
  // would otherwise keep firing and draining a phone battery). Reduced-motion
  // additionally settles the frame on one finished outfit (see effect below),
  // so those visitors still see the product's output, just without the reveal.
  const [reduced, setReduced] = useState(false);
  const [docHidden, setDocHidden] = useState(false);

  const timersRef = useRef([]);
  const rafRef = useRef(null);
  const addTimer = (fn, ms) => {
    const id = setTimeout(fn, ms);
    timersRef.current.push(id);
    return id;
  };
  const clearAllTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };
  const cancelRaf = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  };

  // Eagerly preload the small variant actually shown (matches the grid's
  // <img src={SM(...)}>, so no wasted fetch). Without this, slots would load as
  // they reveal and visitors would see a brief empty slot pop-fill — the source
  // of the "delay until images render" feel. At ~12KB each these prime the cache
  // almost instantly, so every reveal is crisp.
  useEffect(() => {
    OUTFITS.forEach((outfit) => {
      outfit.items.forEach(({ src }) => {
        const img = new Image();
        img.src = SM(src);
      });
    });
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.1 }
    );
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  // Watch the visitor's motion preference (live, so it responds if they change
  // it in OS settings while the page is open).
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    setReduced(mq.matches);
    const onChange = (e) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Suspend the loop while the tab is hidden. rAF self-throttles in background
  // tabs, but the setTimeout chain does not, so we stop it explicitly.
  useEffect(() => {
    const onVis = () => setDocHidden(document.hidden);
    onVis();
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // Reduced-motion: don't animate at all. Cancel any scheduled work and pin
  // the frame to one finished proposal (a fully-composed outfit with the
  // stylist's note and confidence), so the hero still shows what the product
  // produces without the reveal choreography.
  useEffect(() => {
    if (!reduced) return;
    clearAllTimers();
    cancelRaf();
    setOutfitIdx(0);
    setStage(STAGE.COMPLETE);
    setRevealedSlots(4);
    setConfidence(OUTFITS[0].confidence);
  }, [reduced]);

  // Main animation loop. Slow, considered timing throughout. Suspended when out
  // of view, when the tab is hidden, or when reduced motion is preferred.
  useEffect(() => {
    if (!inView || docHidden || reduced) {
      clearAllTimers();
      cancelRaf();
      return;
    }
    let cancelled = false;
    let localIdx = outfitIdx;

    // Drive the confidence count-up with a single requestAnimationFrame
    // loop instead of N separate setTimeouts. The old code scheduled ~48
    // setTimeouts per cycle (one per even percent from 0 to target), each
    // subject to setTimeout's 4ms minimum + main-thread jitter — that was
    // the source of the visible "jumpy" count. rAF is V-synced to the
    // display, so the count progresses one frame at a time (16.67ms on
    // 60Hz, 8.33ms on 120Hz) for a continuously smooth ramp. We keep the
    // original even-percent quantization so the displayed value reads
    // identical to the previous behaviour. Functional setState bails out
    // of re-renders on frames where the integer hasn't advanced.
    const startConfidenceCount = () => {
      if (cancelled) return;
      const target = OUTFITS[localIdx].confidence;
      const startMs = performance.now();
      const DURATION_MS = 940; // matches old: pct goes 0→target at pct·10ms
      const tick = (now) => {
        if (cancelled) { rafRef.current = null; return; }
        const t = Math.min(1, (now - startMs) / DURATION_MS);
        const next = Math.min(target, Math.floor((t * target) / 2) * 2);
        setConfidence((prev) => (prev === next ? prev : next));
        if (t < 1) rafRef.current = requestAnimationFrame(tick);
        else rafRef.current = null;
      };
      rafRef.current = requestAnimationFrame(tick);
    };

    const runOnce = () => {
      if (cancelled) return;
      // Reset the timer ID array at the start of each cycle. runOnce is
      // called recursively every 14.2s and addTimer only ever appends —
      // without this reset, the array would grow by ~10 IDs per cycle and
      // clearAllTimers would iterate the entire history on every cleanup.
      timersRef.current = [];

      setStage(STAGE.IDLE);
      setRevealedSlots(0);
      setConfidence(0);

      // 1. Brief idle so visitors register the button as a CTA
      addTimer(() => !cancelled && setStage(STAGE.BUTTON_GLOW), 800);

      // 2. Composing — spinning wand, brass eyebrow turns to "Composing"
      addTimer(() => !cancelled && setStage(STAGE.COMPOSING), 1500);

      // 3. Items reveal one at a time, 460ms between each — still reads as
      //    "laid out piece by piece", but the first item now lands at ~3s
      //    (was ~4.7s), so the proposal doesn't feel like it stalls.
      addTimer(() => !cancelled && setStage(STAGE.REVEALING), 2600);
      for (let i = 1; i <= 4; i += 1) {
        addTimer(() => !cancelled && setRevealedSlots(i), 2600 + i * 460);
      }

      // 4. Confidence count-up — kicks off the rAF loop
      addTimer(startConfidenceCount, 4100);

      // 5. Complete state
      addTimer(() => !cancelled && setStage(STAGE.COMPLETE), 4700);

      // 6. Hold so visitors can read the stylist's note
      addTimer(() => !cancelled && setStage(STAGE.TRANSITION), 10600);

      // 7. Cross-fade to next outfit
      addTimer(() => {
        if (cancelled) return;
        localIdx = (localIdx + 1) % OUTFITS.length;
        setOutfitIdx(localIdx);
        runOnce();
      }, 11300);
    };

    runOnce();
    return () => {
      cancelled = true;
      clearAllTimers();
      cancelRaf();
    };
    // Depend only on the three suspend/resume gates; outfit index is managed
    // internally via localIdx so the effect doesn't restart every time we
    // advance the carousel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, docHidden, reduced]);

  const current = OUTFITS[outfitIdx];
  const showingOutfit =
    stage === STAGE.REVEALING ||
    stage === STAGE.COMPLETE;
  const buttonGlowing = stage === STAGE.BUTTON_GLOW;
  const composing = stage === STAGE.COMPOSING;
  const fading = stage === STAGE.TRANSITION;

  // The heading's three distinct texts. Keying the <h3> on this (rather than on
  // `stage`) means its fade-in only replays when the words actually change —
  // not on every idle→glow→revealing→complete step, which read as a flicker.
  const headingText = composing
    ? 'Atelier is styling you…'
    : showingOutfit
    ? `Today's proposal · ${current.label}`
    : `Compose for ${current.label.toLowerCase()}.`;

  return (
    <div
      ref={containerRef}
      className="mx-auto"
      // Decorative product mockup — the loop (cycling garment names, "Composing",
      // confidence %) carries no information the H1/subhead/CTAs don't already
      // state, so hide the whole surface from assistive tech.
      aria-hidden="true"
      style={{
        marginTop: 'clamp(2.5rem, 4vw, 4rem)',
        // Full content width — matches the sections below and aligns to the
        // Nav logo/CTA. (Was capped at 980px, which left it looking inset.)
        width: '100%',
        background: '#ffffff',
        border: '1px solid var(--atelier-stone-200)',
        borderRadius: 20,
        overflow: 'hidden',
        // Quiet luxury shadow — paper-like depth, not a SaaS hover-cast.
        // 12px spread, 8% opacity; the brand reads as Loro Piana not Linear.
        boxShadow:
          '0 12px 36px -10px rgba(28, 25, 23, 0.10), 0 2px 4px rgba(28, 25, 23, 0.04)',
        textAlign: 'left',
      }}
    >
      {/* ═══════════════════════════════════════════════════════════════════
          MOBILE LAYOUT — faithfully mirrors the app's Today / Daily Brief view:
          top bar + greeting ("Good morning, Sibylle.") + standfirst + TodayTile
          + outfit reveal + stylist note + bottom nav with brass Concierge FAB.
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="lg:hidden flex flex-col">
        {/* Mobile top bar — Atelier mark left, brass profile circle right */}
        <div
          className="flex items-center justify-between"
          style={{
            padding: '0.875rem 1rem',
            borderBottom: '1px solid var(--atelier-stone-200)',
            background: 'var(--atelier-cream)',
          }}
        >
          <div className="flex items-center gap-2">
            <AtelierMark size={22} />
            <span
              style={{
                fontFamily: 'var(--atelier-font-display)',
                fontSize: 15,
                color: 'var(--atelier-stone-900)',
                letterSpacing: '-0.005em',
              }}
            >
              Atelier<span style={{ color: 'var(--atelier-brass-text)' }}>.</span>
            </span>
          </div>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background:
                'linear-gradient(135deg, var(--atelier-brass-300), var(--atelier-brass-600))',
              color: 'var(--atelier-stone-900)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--atelier-font-display)',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            S
          </div>
        </div>

        {/* Mobile main content — vertical stack like the real app */}
        <div
          style={{
            padding: '1rem 1rem 0.875rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.875rem',
            flex: 1,
          }}
        >
          {/* Today eyebrow + greeting + standfirst — mirrors the app's
              EditorialHeader on the Today / Daily Brief landing view. */}
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span
                aria-hidden="true"
                style={{
                  display: 'inline-block',
                  width: 18,
                  height: '1.5px',
                  background: 'var(--atelier-brass-300)',
                }}
              />
              <p
                style={{
                  fontSize: 9,
                  letterSpacing: '0.28em',
                  textTransform: 'uppercase',
                  color: 'var(--atelier-stone-500)',
                  fontWeight: 600,
                }}
              >
                Today
              </p>
            </div>
            <h2
              style={{
                fontFamily: 'var(--atelier-font-display)',
                fontSize: '1.625rem',
                lineHeight: 1.05,
                color: 'var(--atelier-stone-900)',
                letterSpacing: '-0.01em',
                marginBottom: 4,
              }}
            >
              Good morning, Sibylle.
            </h2>
            <p
              style={{
                fontSize: 9,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: 'var(--atelier-stone-500)',
                fontWeight: 600,
              }}
            >
              Your day, considered
            </p>
          </div>

          {/* TodayTile — editorial cream card matching the app's warm
              'Styled for today' surface. Ink is reserved for the action
              button only (dark = action, not container). */}
          <div
            style={{
              background: '#F4EFE6',
              border: '1px solid var(--atelier-stone-200)',
              borderRadius: 18,
              padding: '1rem 1.1rem 1.1rem',
            }}
          >
            {/* brass rule + eyebrow */}
            <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
              <span
                aria-hidden="true"
                style={{ display: 'inline-block', width: 18, height: 1.5, background: 'var(--atelier-brass-300)' }}
              />
              <p style={{ fontSize: 9, letterSpacing: '0.24em', textTransform: 'uppercase', color: 'var(--atelier-stone-500)', fontWeight: 700 }}>
                Today
              </p>
            </div>

            {/* temperature in display numerals, condition beneath */}
            {(() => {
              const [temp, ...cond] = String(current.weather).split('·');
              return (
                <div style={{ marginBottom: 14 }}>
                  <p style={{ fontFamily: 'var(--atelier-font-display)', fontSize: 26, lineHeight: 1, color: 'var(--atelier-stone-900)', fontFeatureSettings: '"onum" on' }}>
                    {temp.trim()}
                  </p>
                  {cond.length > 0 && (
                    <p style={{ fontSize: 11, color: 'var(--atelier-stone-500)', marginTop: 4 }}>{cond.join('·').trim()}</p>
                  )}
                </div>
              );
            })()}

            <button
              type="button"
              tabIndex={-1}
              aria-hidden="true"
              style={{
                width: '100%',
                background: 'var(--atelier-ink)',
                color: '#F7F5F2',
                fontSize: 10.5,
                fontWeight: 600,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                padding: '0.7rem 1rem',
                borderRadius: 999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                boxShadow: buttonGlowing
                  ? '0 0 0 4px rgba(212, 179, 120, 0.4), 0 0 20px rgba(212, 179, 120, 0.4)'
                  : '0 1px 2px rgba(28, 25, 23, 0.12)',
                transform: buttonGlowing ? 'scale(1.02)' : 'scale(1)',
                transition: 'all 350ms ease',
                opacity: composing || showingOutfit ? 0.4 : 1,
              }}
            >
              <Wand2
                size={12}
                strokeWidth={1.5}
                style={{ color: 'var(--atelier-brass-300)', animation: composing ? 'hero-wand-spin 1.4s linear infinite' : 'none' }}
              />
              {composing ? 'Composing' : 'Suggest a look'}
            </button>
          </div>

          {/* Outfit reveal card — ALWAYS rendered (placeholders when idle)
              so the mobile hero doesn't jump in height. Content swaps based
              on stage; container stays the same shape from frame one. */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid var(--atelier-stone-200)',
              borderRadius: 16,
              padding: '0.875rem',
              opacity: fading ? 0 : 1,
              transition: 'opacity 500ms ease',
            }}
          >
              <div className="flex items-center gap-2 mb-2.5">
                <span
                  aria-hidden="true"
                  style={{
                    display: 'inline-block',
                    width: 14,
                    height: '1.5px',
                    background: 'var(--atelier-brass-300)',
                  }}
                />
                <p
                  style={{
                    fontSize: 8.5,
                    letterSpacing: '0.24em',
                    textTransform: 'uppercase',
                    color: 'var(--atelier-brass-text)',
                    fontWeight: 700,
                  }}
                >
                  {stage === STAGE.COMPLETE
                    ? `Today's proposal · ${current.label}`
                    : composing
                    ? 'Composing'
                    : current.label}
                </p>
              </div>

              {/* 2x2 outfit grid */}
              <div className="grid grid-cols-2 gap-2">
                {current.items.map((item, i) => {
                  const isRevealed = showingOutfit && i < revealedSlots;
                  return (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div
                        style={{
                          aspectRatio: '3/4',
                          borderRadius: 8,
                          overflow: 'hidden',
                          background: isRevealed ? 'var(--atelier-stone-100)' : 'transparent',
                          border: isRevealed ? 'none' : '1.5px dashed var(--atelier-stone-200)',
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
                              fontSize: 8,
                              letterSpacing: '0.2em',
                              color: 'var(--atelier-stone-300)',
                              textTransform: 'uppercase',
                              fontWeight: 600,
                            }}
                          >
                            {composing ? '· · ·' : ['Top', 'Bottom', 'Footwear', 'Accessory'][i]}
                          </div>
                        )}
                        {isRevealed && (
                          <img
                            src={SM(item.src)}
                            alt={item.name}
                            decoding="async"
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                              animation: 'hero-slot-rise 700ms cubic-bezier(0.22, 1, 0.36, 1)',
                            }}
                          />
                        )}
                      </div>
                      <p
                        style={{
                          fontFamily: 'var(--atelier-font-display)',
                          fontSize: 10.5,
                          lineHeight: 1.2,
                          color: 'var(--atelier-stone-800)',
                          // Two-line clamp with the full height reserved: names
                          // like "Single-breasted blazer" wrap instead of dying
                          // as "Single-brea…", and the grid never reflows.
                          minHeight: '2.4em',
                          overflow: 'hidden',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          opacity: isRevealed ? 1 : 0,
                          transition: 'opacity 400ms ease 120ms',
                        }}
                      >
                        {isRevealed ? item.name : ' '}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Stylist's note + confidence — fades in at COMPLETE */}
              <div
                style={{
                  marginTop: 12,
                  padding: '0.625rem 0.75rem',
                  background: 'var(--atelier-cream)',
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  opacity: stage === STAGE.COMPLETE ? 1 : 0,
                  transform:
                    stage === STAGE.COMPLETE ? 'translateY(0)' : 'translateY(0.25rem)',
                  transition: 'opacity 500ms ease, transform 500ms ease',
                }}
              >
                <Wand2
                  size={12}
                  strokeWidth={1.4}
                  style={{ color: 'var(--atelier-brass-text)', flexShrink: 0 }}
                />
                <p
                  style={{
                    fontFamily: 'var(--atelier-font-display)',
                    fontStyle: 'italic',
                    fontSize: 11,
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
                    fontSize: 9,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    color: 'var(--atelier-brass-text)',
                    fontWeight: 700,
                    flexShrink: 0,
                    fontFeatureSettings: '"onum" on',
                  }}
                >
                  {confidence}%
                </p>
              </div>
            </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          DESKTOP LAYOUT — sidebar + main pane with Today header
          ═══════════════════════════════════════════════════════════════════ */}
      <div className="hidden lg:grid lg:grid-cols-[minmax(0,188px)_1fr]">
        {/* Desktop sidebar — full studio nav */}
        <aside
          className="flex"
          style={{
            background: 'var(--atelier-cream)',
            borderRight: '1px solid var(--atelier-stone-200)',
            padding: '1.25rem 0.875rem 1rem',
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
            Atelier<span style={{ color: 'var(--atelier-brass-text)' }}>.</span>
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
              color: 'var(--atelier-stone-500)',
              fontWeight: 600,
              textTransform: 'uppercase',
            }}
          >
            Studio
          </span>
        </div>

        {/* Nav items */}
        {NAV_ITEMS.map(({ icon: Icon, label, active, brass, divider }) => (
          <React.Fragment key={label}>
            {divider && (
              <div
                aria-hidden="true"
                style={{
                  borderTop: '1px solid var(--atelier-stone-200)',
                  margin: '0.375rem 0.25rem',
                }}
              />
            )}
            <div
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
                  color: 'var(--atelier-brass-text)',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                }}
              >
                Ask
              </span>
            )}
            </div>
          </React.Fragment>
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
              key={headingText}
              style={{
                fontFamily: 'var(--atelier-font-display)',
                fontSize: 'clamp(1.125rem, 1.6vw, 1.5rem)',
                lineHeight: 1.15,
                color: 'var(--atelier-stone-900)',
                letterSpacing: '-0.005em',
                animation: 'hero-label-fade 600ms ease',
              }}
            >
              {headingText}
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
              background: 'var(--atelier-ink)',
              color: '#F7F5F2',
              fontSize: 10.5,
              fontWeight: 600,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              flexShrink: 0,
              boxShadow: buttonGlowing
                ? '0 0 0 4px rgba(212, 179, 120, 0.35), 0 0 22px rgba(212, 179, 120, 0.5)'
                : '0 1px 2px rgba(28, 25, 23, 0.12)',
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
                      src={SM(item.src)}
                      alt={item.name}
                      decoding="async"
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
                    // Two lines reserved (same grid-stability rule as above):
                    // names wrap rather than truncating to "Pewter sil…".
                    minHeight: '2.6em',
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
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
            style={{ color: 'var(--atelier-brass-text)', flexShrink: 0 }}
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
              color: 'var(--atelier-brass-text)',
              fontWeight: 600,
              flexShrink: 0,
              fontFeatureSettings: '"onum" on',
            }}
          >
            {confidence}% confidence
          </p>
        </div>
      </div>
      </div>

      {/* ── Mobile bottom nav (hidden on lg+) — mirrors src/nav/BottomBar.jsx:
          Today · Wardrobe · [Concierge FAB] · Calendar · Studio ───── */}
      <div
        className="lg:hidden grid grid-cols-5 items-center"
        style={{
          padding: '0.5rem 0.5rem 0.625rem',
          borderTop: '1px solid var(--atelier-stone-200)',
          background: 'rgba(247, 245, 242, 0.92)',
          backdropFilter: 'blur(8px)',
        }}
      >
        {[
          { icon: Home,       label: 'Today', active: true },
          { icon: LayoutGrid, label: 'Wardrobe' },
          { icon: Sparkles,   label: '',        fab: true },
          { icon: Calendar,   label: 'Calendar' },
          { icon: Camera,     label: 'Studio' },
        ].map(({ icon: Icon, label, active, fab }, i) => {
          if (fab) {
            return (
              <div key={i} className="flex justify-center">
                <div
                  style={{
                    width: 46,
                    height: 46,
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--atelier-brass-300), var(--atelier-brass-600))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 6px 16px -4px rgba(168, 136, 76, 0.45), 0 2px 4px rgba(28, 25, 23, 0.08)',
                    transform: 'translateY(-6px)',
                  }}
                >
                  <Icon
                    size={20}
                    strokeWidth={1.5}
                    style={{ color: 'var(--atelier-stone-900)' }}
                  />
                </div>
              </div>
            );
          }
          return (
            <div
              key={i}
              className="flex flex-col items-center gap-1 relative"
              style={{ padding: '0.25rem' }}
            >
              <Icon
                size={18}
                strokeWidth={active ? 2 : 1.5}
                style={{
                  color: active ? 'var(--atelier-stone-900)' : 'var(--atelier-stone-400)',
                  transform: active ? 'scale(1.06)' : 'scale(1)',
                  transition: 'all 200ms',
                }}
              />
              <span
                style={{
                  fontSize: 9,
                  letterSpacing: '0.04em',
                  color: active ? 'var(--atelier-stone-900)' : 'var(--atelier-stone-400)',
                  fontWeight: active ? 500 : 400,
                }}
              >
                {label}
              </span>
              {active && (
                <span
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    bottom: -2,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 3,
                    height: 3,
                    borderRadius: '50%',
                    background: 'var(--atelier-stone-900)',
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes hero-label-fade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes hero-wand-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes hero-slot-rise {
          from { opacity: 0; transform: scale(1.04); }
          to { opacity: 1; transform: scale(1); }
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
        style={{ maxWidth: 'var(--atelier-content-max)', margin: '0 auto' }}
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
              color: 'var(--atelier-brass-text)',
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

        {/* Kicker — small italic line above the headline that disambiguates
            the product category immediately. Without it, first-time visitors
            spend 2-3 seconds parsing "AI stylist / wardrobe" and could
            mistake Atelier for a clothing brand or a styling service. The
            kicker tells them "this is software" before they read anything
            else. Set in stone-500 italic display serif so it reads as
            editorial subtitle rather than utility caption. */}
        <p
          className="mx-auto italic"
          style={{
            fontFamily: 'var(--atelier-font-display)',
            fontSize: 'clamp(0.9375rem, 1.1vw, 1.0625rem)',
            color: 'var(--atelier-stone-500)',
            marginBottom: 'clamp(1rem, 1.5vw, 1.25rem)',
            letterSpacing: '0.005em',
          }}
        >
          A digital studio for your wardrobe.
        </p>

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
            See the Studio
            <span
              className="transition-transform group-hover:translate-x-1"
              style={{ color: 'var(--atelier-brass-text)', display: 'inline-block' }}
            >
              →
            </span>
          </a>
        </div>

        {/* Early-access line — honest exclusivity in place of social proof
            (there are no members to quote yet). Frames "no crowd" as "be
            among the first" and points at the founding tier on /pricing. A
            quiet invitation, not a countdown — the live founding count lives
            on /pricing and isn't restated here. */}
        <p
          className="mx-auto italic"
          style={{
            fontFamily: 'var(--atelier-font-display)',
            fontSize: 'clamp(0.875rem, 1vw, 0.9375rem)',
            color: 'var(--atelier-stone-500)',
            marginTop: 'clamp(1.25rem, 2vw, 1.5rem)',
          }}
        >
          Now welcoming its founding members.
        </p>

        {/* Live interactive studio surface */}
        <StudioFrame />
      </div>
    </section>
  );
}
