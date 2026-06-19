import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Wand2, X, Calendar, BookmarkPlus, ShirtIcon } from 'lucide-react';

/**
 * SuggestALookDemo — an auto-playing demo of the studio's "Suggest a look"
 * flow. Replicates the actual modal at src/App.jsx:4370:
 *
 *   1. Today card sits in viewport with weather and a brass CTA button
 *   2. The button auto-glows when the section enters viewport
 *   3. Backdrop blur fades in over the page
 *   4. Dark gradient modal slides up from below
 *   5. "Composing…" with spinning wand
 *   6. 4 outfit pieces reveal one by one (280ms apart) with images
 *   7. Confidence counts up to 94%
 *   8. Stylist's note fades in
 *   9. Action buttons fade in (Wear today / Save / Schedule)
 *  10. Idle pause, then modal closes and demo restarts
 */

const BrassRule = () => (
  <span
    aria-hidden="true"
    style={{
      display: 'inline-block',
      width: '24px',
      height: '1.5px',
      backgroundColor: 'var(--atelier-brass-300)',
    }}
  />
);

// The "proposed" outfit — deliberately different from anything visible in the
// faux background (which shows casual everyday pieces). The contrast is what
// sells the intelligence: "the Concierge composed something fresh, it didn't
// just point at what was already on screen."
const OUTFIT = [
  { slot: 'Top',       name: 'Ivory tweed blazer',      src: '/seed-wardrobe/tweed-blazer-ivory.jpg' },
  { slot: 'Bottom',    name: 'Pewter silk slip',        src: '/seed-wardrobe/silk-slip-pewter.jpg' },
  { slot: 'Footwear',  name: 'Black knee boots',        src: '/seed-wardrobe/leather-knee-boots-black.jpg' },
  { slot: 'Accessory', name: 'Quilted crossbody',       src: '/seed-wardrobe/quilted-crossbody-black.jpg' },
];

const STYLIST_NOTE =
  "Tweed softens the silk; the boots ground it. Tonight tilts cooler — this carries you from a 7pm dinner into a colder cab home without a change of plan.";

// The faux background — different items entirely, so the modal looks like it
// composed something rather than recycled what was visible.
const FAUX_WARDROBE = [
  '/seed-wardrobe/breton-stripe-tee.jpg',
  '/seed-wardrobe/dark-wash-jeans.jpg',
  '/seed-wardrobe/leather-sneakers-white.jpg',
  '/seed-wardrobe/trench-coat-beige.jpg',
  '/seed-wardrobe/poplin-shirt-white.jpg',
  '/seed-wardrobe/silk-twill-scarf.jpg',
];

const STAGE = {
  CLOSED: 'closed',
  BUTTON_GLOW: 'button-glow',
  OPENING: 'opening',
  COMPOSING: 'composing',
  REVEALING: 'revealing',
  COMPLETE: 'complete',
  CLOSING: 'closing',
};

export function SuggestALookDemo() {
  const containerRef = useRef(null);
  const [inView, setInView] = useState(false);

  const [stage, setStage] = useState(STAGE.CLOSED);
  const [revealedSlots, setRevealedSlots] = useState(0);
  const [confidence, setConfidence] = useState(0);
  const [showNote, setShowNote] = useState(false);
  const [showActions, setShowActions] = useState(false);

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
      ([entry]) => setInView(entry.isIntersecting && entry.intersectionRatio > 0.4),
      { threshold: [0, 0.4, 0.6] }
    );
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!inView) {
      clearAllTimers();
      return;
    }
    let cancelled = false;

    const runOnce = () => {
      if (cancelled) return;
      // Reset
      setStage(STAGE.CLOSED);
      setRevealedSlots(0);
      setConfidence(0);
      setShowNote(false);
      setShowActions(false);

      // 1. After a beat, the button glows
      addTimer(() => !cancelled && setStage(STAGE.BUTTON_GLOW), 1200);

      // 2. Modal opens
      addTimer(() => !cancelled && setStage(STAGE.OPENING), 2200);

      // 3. Composing state
      addTimer(() => !cancelled && setStage(STAGE.COMPOSING), 2600);

      // 4. Begin revealing slots
      addTimer(() => !cancelled && setStage(STAGE.REVEALING), 3800);
      for (let i = 1; i <= 4; i += 1) {
        addTimer(() => !cancelled && setRevealedSlots(i), 3800 + i * 280);
      }

      // 5. Confidence count-up
      const baseConfidence = 4900;
      for (let pct = 0; pct <= 94; pct += 2) {
        addTimer(() => !cancelled && setConfidence(pct), baseConfidence + pct * 12);
      }

      // 6. Stylist's note
      addTimer(() => !cancelled && setShowNote(true), 6200);

      // 7. Action buttons
      addTimer(() => !cancelled && setShowActions(true), 6900);

      // 8. Mark complete
      addTimer(() => !cancelled && setStage(STAGE.COMPLETE), 7200);

      // 9. Idle pause, then close
      addTimer(() => !cancelled && setStage(STAGE.CLOSING), 12500);

      // 10. Loop
      addTimer(() => !cancelled && runOnce(), 13500);
    };

    runOnce();
    return () => {
      cancelled = true;
      clearAllTimers();
    };
  }, [inView]);

  const modalVisible =
    stage === STAGE.OPENING ||
    stage === STAGE.COMPOSING ||
    stage === STAGE.REVEALING ||
    stage === STAGE.COMPLETE;
  const modalClosing = stage === STAGE.CLOSING;
  const buttonGlowing = stage === STAGE.BUTTON_GLOW;

  return (
    <div
      ref={containerRef}
      className="relative mx-auto"
      style={{
        width: 'min(100%, 920px)',
        height: '560px',
        background: 'var(--atelier-cream)',
        boxShadow:
          '0 60px 140px -30px rgba(40, 28, 12, 0.22), 0 22px 60px -20px rgba(28, 25, 23, 0.14)',
        borderRadius: '20px',
        overflow: 'hidden',
        border: '1px solid var(--atelier-stone-200)',
      }}
    >
      {/* Background — the wardrobe screen behind the modal */}
      <div
        className="absolute inset-0 grid"
        style={{
          gridTemplateColumns: '180px 1fr 240px',
          gap: '1rem',
          padding: '1.25rem 1.25rem',
          opacity: modalVisible || modalClosing ? 0.5 : 1,
          filter: modalVisible || modalClosing ? 'blur(2px)' : 'none',
          transition: 'opacity 400ms ease, filter 400ms ease',
        }}
      >
        {/* Faux sidebar */}
        <aside
          className="rounded-xl"
          style={{
            background: 'var(--atelier-cream)',
            borderRight: '1px solid var(--atelier-stone-200)',
            padding: '0.75rem',
          }}
        >
          <div className="space-y-1.5">
            {['Concierge', 'Wardrobe', 'Styling', 'Lookbook', 'Insights'].map((s, i) => (
              <div
                key={s}
                style={{
                  height: 14,
                  background:
                    i === 1
                      ? '#ffffff'
                      : 'rgba(168, 162, 158, 0.08)',
                  borderRadius: 6,
                }}
              />
            ))}
          </div>
        </aside>

        {/* Faux content */}
        <div className="flex flex-col gap-2">
          <div style={{ height: 28, width: '40%', background: 'var(--atelier-stone-200)', borderRadius: 4 }} />
          <div style={{ height: 14, width: '20%', background: 'var(--atelier-stone-100)', borderRadius: 3, marginBottom: 4 }} />
          <div className="grid grid-cols-3 gap-2 mt-1">
            {FAUX_WARDROBE.map((src, i) => (
              <img
                key={i}
                src={src}
                alt=""
                loading="lazy"
                className="rounded-md"
                style={{
                  aspectRatio: '3/4',
                  objectFit: 'cover',
                  width: '100%',
                }}
              />
            ))}
          </div>
        </div>

        {/* The TODAY card — the action surface */}
        <div className="flex flex-col gap-2">
          <div
            className="rounded-xl relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, var(--atelier-ink) 0%, #292524 100%)',
              color: '#ffffff',
              padding: '0.9rem 1rem',
            }}
          >
            <p
              className="text-[9px] uppercase font-bold mb-0.5"
              style={{ letterSpacing: '0.24em', color: 'var(--atelier-stone-400)' }}
            >
              Today
            </p>
            <p
              className="text-sm"
              style={{ fontFamily: 'var(--atelier-font-display)', lineHeight: 1.3 }}
            >
              15–27°C · Partly cloudy
            </p>
            <button
              type="button"
              tabIndex={-1}
              aria-hidden="true"
              className="w-full mt-2.5 text-[10px] uppercase px-3 py-2 rounded-full flex items-center justify-center gap-2 font-medium"
              style={{
                background: 'var(--atelier-brass-300)',
                color: 'var(--atelier-stone-900)',
                letterSpacing: '0.18em',
                boxShadow: buttonGlowing
                  ? '0 0 0 4px rgba(212, 179, 120, 0.4), 0 0 24px rgba(212, 179, 120, 0.5)'
                  : 'none',
                transform: buttonGlowing ? 'scale(1.03)' : 'scale(1)',
                transition: 'all 400ms ease',
              }}
            >
              <Wand2 size={11} strokeWidth={1.5} />
              Suggest a look
            </button>
          </div>
        </div>
      </div>

      {/* Modal scrim */}
      {(modalVisible || modalClosing) && (
        <div
          className="absolute inset-0"
          style={{
            background: 'rgba(28, 25, 23, 0.55)',
            backdropFilter: 'blur(8px)',
            animation: modalClosing ? 'scrim-out 400ms ease forwards' : 'scrim-in 350ms ease forwards',
          }}
        />
      )}

      {/* The modal itself */}
      {(modalVisible || modalClosing) && (
        <div
          className="absolute left-1/2 bottom-4 rounded-3xl overflow-hidden"
          style={{
            transform: 'translateX(-50%)',
            width: 'min(94%, 680px)',
            background: 'linear-gradient(135deg, var(--atelier-ink) 0%, #292524 100%)',
            color: '#ffffff',
            boxShadow: '0 30px 80px -10px rgba(0,0,0,0.5)',
            animation: modalClosing
              ? 'modal-slide-out 400ms ease forwards'
              : 'modal-slide-in 450ms cubic-bezier(0.22, 1, 0.36, 1) forwards',
          }}
        >
          {/* Sparkles decorative */}
          <div
            className="absolute -right-10 -top-10 pointer-events-none"
            style={{ opacity: 0.05, transform: 'rotate(12deg)' }}
          >
            <Sparkles size={220} strokeWidth={0.8} />
          </div>

          <div className="relative px-6 pt-5 pb-5">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <p
                  className="text-[10px] uppercase font-bold mb-1.5"
                  style={{
                    letterSpacing: '0.24em',
                    color: 'var(--atelier-brass-300)',
                  }}
                >
                  {stage === STAGE.COMPOSING ? (
                    <span className="flex items-center gap-2">
                      <Wand2
                        size={11}
                        strokeWidth={1.5}
                        style={{ animation: 'wand-spin 1.4s linear infinite' }}
                      />
                      Composing
                    </span>
                  ) : stage === STAGE.OPENING ? (
                    <>Composing</>
                  ) : (
                    <>Suggested · {confidence}/100 confidence</>
                  )}
                </p>
                <h2
                  className="text-xl"
                  style={{
                    fontFamily: 'var(--atelier-font-display)',
                    color: '#ffffff',
                    lineHeight: 1.1,
                  }}
                >
                  {stage === STAGE.COMPOSING || stage === STAGE.OPENING
                    ? 'Atelier is styling you…'
                    : "Today's proposal"}
                </h2>
              </div>
              <button
                type="button"
                tabIndex={-1}
                aria-hidden="true"
                className="p-2 rounded-full"
                style={{ color: 'var(--atelier-stone-400)' }}
              >
                <X size={16} strokeWidth={1.5} />
              </button>
            </div>

            {/* Outfit grid */}
            <div className="grid grid-cols-4 gap-2 mb-3">
              {OUTFIT.map((item, i) => {
                const isRevealed = i < revealedSlots;
                return (
                  <div key={i} className="flex flex-col gap-1.5">
                    <div
                      className="rounded-lg relative overflow-hidden"
                      style={{
                        aspectRatio: '3/4',
                        background: isRevealed
                          ? 'rgba(255,255,255,0.05)'
                          : 'transparent',
                        border: isRevealed
                          ? '1px solid rgba(255,255,255,0.08)'
                          : '1.5px dashed rgba(255,255,255,0.15)',
                      }}
                    >
                      {!isRevealed && (
                        <div
                          className="absolute inset-0 flex items-center justify-center text-[8px] uppercase"
                          style={{
                            letterSpacing: '0.22em',
                            color: 'rgba(255,255,255,0.3)',
                            fontWeight: 500,
                          }}
                        >
                          {item.slot}
                        </div>
                      )}
                      {isRevealed && (
                        <img
                          src={item.src}
                          alt={item.name}
                          className="w-full h-full object-cover"
                          style={{ animation: 'slot-pop 450ms ease-out' }}
                        />
                      )}
                    </div>
                    {isRevealed && (
                      <div style={{ animation: 'fade-up 400ms ease 80ms both' }}>
                        <p
                          className="text-[8px] uppercase truncate"
                          style={{
                            letterSpacing: '0.18em',
                            color: 'var(--atelier-stone-400)',
                            fontWeight: 600,
                          }}
                        >
                          {item.slot}
                        </p>
                        <p
                          className="text-[11px] truncate mt-0.5"
                          style={{ fontFamily: 'var(--atelier-font-display)' }}
                        >
                          {item.name}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Stylist's note — always rendered to reserve height; opacity gates the reveal */}
            <div
              className="rounded-xl px-4 py-3 mb-3 flex items-start gap-3"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                opacity: showNote ? 1 : 0,
                transform: showNote ? 'translateY(0)' : 'translateY(0.5rem)',
                transition: 'opacity 500ms ease, transform 500ms ease',
                minHeight: '76px',
              }}
            >
              <Wand2
                size={14}
                strokeWidth={1.3}
                style={{
                  color: 'var(--atelier-brass-300)',
                  flexShrink: 0,
                  marginTop: 2,
                }}
              />
              <div className="flex-1 min-w-0">
                <p
                  className="text-[9px] uppercase mb-1"
                  style={{
                    letterSpacing: '0.22em',
                    color: 'var(--atelier-stone-400)',
                    fontWeight: 600,
                  }}
                >
                  Stylist's note
                </p>
                <p
                  className="text-[12px]"
                  style={{
                    fontFamily: 'var(--atelier-font-display)',
                    fontStyle: 'italic',
                    lineHeight: 1.5,
                    color: 'rgba(255,255,255,0.85)',
                  }}
                >
                  {STYLIST_NOTE}
                </p>
              </div>
            </div>

            {/* Action buttons — always rendered to reserve height */}
            <div
              className="grid grid-cols-3 gap-2"
              style={{
                opacity: showActions ? 1 : 0,
                transform: showActions ? 'translateY(0)' : 'translateY(0.5rem)',
                transition: 'opacity 500ms ease, transform 500ms ease',
              }}
            >
                <button
                  type="button"
                  tabIndex={-1}
                  aria-hidden="true"
                  className="rounded-full px-3 py-2.5 text-[10px] uppercase flex items-center justify-center gap-1.5"
                  style={{
                    background: 'var(--atelier-brass-300)',
                    color: 'var(--atelier-stone-900)',
                    letterSpacing: '0.16em',
                    fontWeight: 600,
                  }}
                >
                  <ShirtIcon size={11} strokeWidth={1.5} />
                  Wear today
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  aria-hidden="true"
                  className="rounded-full px-3 py-2.5 text-[10px] uppercase flex items-center justify-center gap-1.5"
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    color: '#ffffff',
                    border: '1px solid rgba(255,255,255,0.12)',
                    letterSpacing: '0.16em',
                    fontWeight: 500,
                  }}
                >
                  <BookmarkPlus size={11} strokeWidth={1.5} />
                  Save
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  aria-hidden="true"
                  className="rounded-full px-3 py-2.5 text-[10px] uppercase flex items-center justify-center gap-1.5"
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    color: '#ffffff',
                    border: '1px solid rgba(255,255,255,0.12)',
                    letterSpacing: '0.16em',
                    fontWeight: 500,
                  }}
                >
                  <Calendar size={11} strokeWidth={1.5} />
                  Schedule
                </button>
              </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes scrim-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes scrim-out { from { opacity: 1; } to { opacity: 0; } }
        @keyframes modal-slide-in {
          from { opacity: 0; transform: translateX(-50%) translateY(2rem); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes modal-slide-out {
          from { opacity: 1; transform: translateX(-50%) translateY(0); }
          to { opacity: 0; transform: translateX(-50%) translateY(1rem); }
        }
        @keyframes slot-pop {
          from { opacity: 0; transform: scale(1.05); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(0.5rem); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes wand-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
