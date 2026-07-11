import React, { useState, useEffect, useRef } from 'react';
import { Pic } from '@atelier/ui';
import { Cloud, Sparkles } from 'lucide-react';

/**
 * TravelCapsuleDemo — a magazine-spread style demo of the studio's
 * Travel Capsule feature. Visually distinct from the Concierge (chat
 * panel) and Suggest-a-Look (modal-over-wardrobe) demos so the home
 * page reads as three different surfaces of the same studio, not three
 * variants of the same surface.
 *
 * Auto-rotates between three destinations (Tokyo / Paris / New York),
 * each with its own weather strip, brief stylist's note, and a curated
 * nine-piece capsule from the seed wardrobe. Smooth cross-fade between
 * destinations — items fade with cascading delays so the new capsule
 * feels composed rather than dumped.
 *
 * Each destination holds for ~8 seconds — long enough to read the
 * narrative, short enough to keep the rotation alive.
 *
 * IntersectionObserver-gated: the loop only runs when the section is
 * visible. Idle when offscreen.
 */

const BrassRule = () => (
  <span
    aria-hidden="true"
    style={{
      display: 'inline-block',
      width: 24,
      height: '1.5px',
      backgroundColor: 'var(--atelier-brass-300)',
    }}
  />
);

// Three destinations, each a curated nine-piece capsule pulled from
// /public/wardrobe. Each set composed to match the season and the
// dressing register of the city — Tokyo dresses softer and trans-
// seasonal, Paris layers into autumn dressier, NYC carries weight
// against the cold.
const DESTINATIONS = [
  {
    city: 'Tokyo',
    season: 'April · five days',
    weather: '12–22°C · Cherry blossom · light rain expected',
    note: "Tokyo in April sits between cherry blossom and unpredictable rain. Nine pieces give you fourteen outfits, half of them dressed for the evening.",
    items: [
      { name: 'Champagne silk vest', src: '/wardrobe/gene-silk-front-vest-top-in-champagne-si.jpg' },
      { name: 'Silk colourblock vest', src: '/wardrobe/pippa-silk-front-colourblock-vest.jpg' },
      { name: 'Belted shirt dress', src: '/wardrobe/belt-shirt-dress.jpg' },
      { name: 'Wool-blend trousers', src: '/wardrobe/gael-wool-blend-trousers.jpg' },
      { name: 'High-rise denim shorts', src: '/wardrobe/high-rise-denim-shorts.jpg' },
      { name: 'Linen jacket', src: '/wardrobe/mariam-jacket.jpg' },
      { name: 'Block-heel sandals', src: '/wardrobe/suedette-2-part-block-heel-sandals.jpg' },
      { name: 'Gold block-heel sandals', src: '/wardrobe/merisa-gold-wide-fit-block-heel-sandals-.jpg' },
      { name: 'Fine chain necklace', src: '/wardrobe/fine-chain-necklace-24-monica-vinader.jpg' },
    ],
  },
  {
    city: 'Paris',
    season: 'October · four days',
    weather: '11–18°C · Golden autumn · dressier evenings',
    note: "Paris in October calls for layers that hold their tailoring through dinner. The wool coat in, the trench out. Loafers carry the days; boots the nights.",
    items: [
      { name: 'Satin blouse', src: '/wardrobe/mirabel-satin-blouse.jpg' },
      { name: 'Champagne silk vest', src: '/wardrobe/gene-silk-front-vest-top-in-champagne-si.jpg' },
      { name: 'Pleat-detail dress', src: '/wardrobe/claire-pleat-detail-dress.jpg' },
      { name: 'Wool-blend trousers', src: '/wardrobe/gael-wool-blend-trousers.jpg' },
      { name: 'High-rise denim shorts', src: '/wardrobe/high-rise-denim-shorts.jpg' },
      { name: 'Navy wool coat', src: '/wardrobe/jasmin-coat.jpg' },
      { name: 'Block-heel sandals', src: '/wardrobe/suedette-2-part-block-heel-sandals.jpg' },
      { name: 'Gold block-heel sandals', src: '/wardrobe/merisa-gold-wide-fit-block-heel-sandals-.jpg' },
      { name: 'Fine chain necklace', src: '/wardrobe/fine-chain-necklace-24-monica-vinader.jpg' },
    ],
  },
  {
    city: 'New York',
    season: 'January · three days',
    weather: '−2 to 5°C · Cold, dry · indoor heat',
    note: "Manhattan in January moves between cold streets and overheated rooms. Cashmere as the base layer; the coat does all the public-facing work.",
    items: [
      { name: 'Champagne silk vest', src: '/wardrobe/gene-silk-front-vest-top-in-champagne-si.jpg' },
      { name: 'Button-down blouse', src: '/wardrobe/reg-classic-button-down-blouse.jpg' },
      { name: 'Pleat-detail dress', src: '/wardrobe/claire-pleat-detail-dress.jpg' },
      { name: 'Wool-blend trousers', src: '/wardrobe/gael-wool-blend-trousers.jpg' },
      { name: 'High-rise denim shorts', src: '/wardrobe/high-rise-denim-shorts.jpg' },
      { name: 'Navy wool coat', src: '/wardrobe/jasmin-coat.jpg' },
      { name: 'Gold block-heel sandals', src: '/wardrobe/merisa-gold-wide-fit-block-heel-sandals-.jpg' },
      { name: 'Block-heel sandals', src: '/wardrobe/suedette-2-part-block-heel-sandals.jpg' },
      { name: 'Fine chain necklace', src: '/wardrobe/fine-chain-necklace-24-monica-vinader.jpg' },
    ],
  },
];

const ROTATION_MS = 8000;     // How long each destination holds
const CROSSFADE_MS = 700;     // The fade between destinations

export function TravelCapsuleDemo() {
  const containerRef = useRef(null);
  const [inView, setInView] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [phase, setPhase] = useState('in'); // 'in' | 'out'

  // Run the rotation only when visible. Standard "pause when not on
  // screen" pattern shared with the other demos.
  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting && entry.intersectionRatio > 0.25),
      { threshold: [0, 0.25, 0.5] }
    );
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!inView) return;
    let cancelled = false;
    let outTimer, idxTimer, inTimer;

    const cycle = () => {
      if (cancelled) return;
      // Hold the current destination
      outTimer = setTimeout(() => {
        if (cancelled) return;
        setPhase('out');
        // After the fade-out completes, swap destination and fade in
        idxTimer = setTimeout(() => {
          if (cancelled) return;
          setActiveIdx((i) => (i + 1) % DESTINATIONS.length);
          setPhase('in');
          // Schedule the next cycle
          inTimer = setTimeout(cycle, ROTATION_MS);
        }, CROSSFADE_MS);
      }, ROTATION_MS);
    };

    cycle();
    return () => {
      cancelled = true;
      clearTimeout(outTimer);
      clearTimeout(idxTimer);
      clearTimeout(inTimer);
    };
  }, [inView]);

  const active = DESTINATIONS[activeIdx];
  const fadeOpacity = phase === 'in' ? 1 : 0;
  const fadeTransform = phase === 'in' ? 'translateY(0)' : 'translateY(0.5rem)';

  return (
    <section
      ref={containerRef}
      style={{
        paddingBlock: 'clamp(4rem, 7vw, 6rem)',
        paddingInline: 'var(--atelier-page-padding)',
        background: 'var(--atelier-cream)',
      }}
    >
      <div
        className="mx-auto"
        style={{ maxWidth: 'var(--atelier-container-max)' }}
      >
        {/* Section header */}
        <div className="text-center mb-10 lg:mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <BrassRule />
            <p
              className="text-[10px] uppercase font-medium"
              style={{ letterSpacing: '0.32em', color: 'var(--atelier-brass-600)' }}
            >
              The Travel Capsule
            </p>
            <BrassRule />
          </div>
          <h2
            className="mx-auto mb-3"
            style={{
              fontFamily: 'var(--atelier-font-display)',
              fontSize: 'clamp(2rem, 3.5vw, 3rem)',
              lineHeight: 1.05,
              letterSpacing: '-0.01em',
              color: 'var(--atelier-stone-900)',
              maxWidth: '22ch',
            }}
          >
            Name a city. <em style={{ fontWeight: 400 }}>Pack the bag.</em>
          </h2>
          <p
            className="mx-auto"
            style={{
              fontSize: 'clamp(0.95rem, 1.1vw, 1rem)',
              lineHeight: 1.6,
              color: 'var(--atelier-stone-500)',
              maxWidth: '54ch',
            }}
          >
            The Concierge reads the destination, the forecast, and your wardrobe,
            then composes a capsule from pieces you already own. No shopping.
            No spreadsheet. No forgotten shoes.
          </p>
        </div>

        {/* The spread — a single editorial card that holds the destination
            on the left and the capsule grid on the right. Same shadow /
            radius / border vocabulary as the Concierge and Suggest-a-Look
            panels, so the three demos read as one product surface. */}
        <div
          className="relative mx-auto"
          style={{
            maxWidth: 1040,
            background: '#ffffff',
            border: '1px solid var(--atelier-stone-200)',
            borderRadius: 20,
            overflow: 'hidden',
            boxShadow:
              '0 60px 140px -30px rgba(40, 28, 12, 0.18), 0 22px 60px -20px rgba(28, 25, 23, 0.12)',
          }}
        >
          <div
            className="grid grid-cols-1 md:grid-cols-[5fr_7fr]"
            style={{
              opacity: fadeOpacity,
              transform: fadeTransform,
              transition: `opacity ${CROSSFADE_MS}ms ease, transform ${CROSSFADE_MS}ms ease`,
            }}
          >
            {/* ── Left — destination card ─────────────────────────── */}
            <div
              className="flex flex-col"
              style={{
                padding: 'clamp(1.75rem, 3vw, 2.75rem)',
                background: 'var(--atelier-stone-50)',
                borderRight: '1px solid var(--atelier-stone-200)',
                minHeight: 360,
              }}
            >
              <p
                className="text-[10px] uppercase font-semibold mb-5"
                style={{ letterSpacing: '0.28em', color: 'var(--atelier-stone-500)' }}
              >
                Your trip
              </p>

              {/* Big destination name — display serif, italic moment on city */}
              <h3
                style={{
                  fontFamily: 'var(--atelier-font-display)',
                  fontSize: 'clamp(2.5rem, 4.5vw, 3.5rem)',
                  lineHeight: 1,
                  letterSpacing: '-0.015em',
                  color: 'var(--atelier-stone-900)',
                  marginBottom: '0.5rem',
                }}
              >
                {active.city}.
              </h3>

              <p
                className="text-[11px] uppercase mb-7"
                style={{
                  letterSpacing: '0.28em',
                  color: 'var(--atelier-stone-500)',
                  fontWeight: 500,
                }}
              >
                {active.season}
              </p>

              {/* Weather strip */}
              <div
                className="flex items-start gap-3 mb-7 px-4 py-3 rounded-lg"
                style={{
                  background: '#ffffff',
                  border: '1px solid var(--atelier-stone-200)',
                }}
              >
                <Cloud
                  size={16}
                  strokeWidth={1.5}
                  style={{ color: 'var(--atelier-brass-600)', flexShrink: 0, marginTop: 2 }}
                />
                <p
                  style={{
                    fontSize: '0.8125rem',
                    lineHeight: 1.5,
                    color: 'var(--atelier-stone-700)',
                  }}
                >
                  {active.weather}
                </p>
              </div>

              {/* Stylist's note */}
              <div className="flex-1">
                <p
                  className="text-[10px] uppercase mb-2.5"
                  style={{
                    letterSpacing: '0.28em',
                    color: 'var(--atelier-stone-400)',
                    fontWeight: 600,
                  }}
                >
                  Stylist's note
                </p>
                <p
                  className="italic"
                  style={{
                    fontFamily: 'var(--atelier-font-display)',
                    fontSize: '0.9375rem',
                    lineHeight: 1.6,
                    color: 'var(--atelier-stone-700)',
                  }}
                >
                  {active.note}
                </p>
              </div>

              {/* Footer signature line */}
              <div
                className="flex items-center gap-2.5 mt-7 pt-5"
                style={{ borderTop: '1px solid var(--atelier-stone-200)' }}
              >
                <Sparkles
                  size={12}
                  strokeWidth={1.5}
                  style={{ color: 'var(--atelier-brass-600)' }}
                />
                <p
                  className="text-[10px] uppercase"
                  style={{
                    letterSpacing: '0.28em',
                    color: 'var(--atelier-stone-500)',
                    fontWeight: 500,
                  }}
                >
                  9 pieces · 14 outfits
                </p>
              </div>
            </div>

            {/* ── Right — the capsule grid ───────────────────────── */}
            <div
              style={{
                padding: 'clamp(1.5rem, 2.5vw, 2.25rem)',
                background: '#ffffff',
              }}
            >
              <p
                className="text-[10px] uppercase font-semibold mb-5"
                style={{ letterSpacing: '0.28em', color: 'var(--atelier-stone-500)' }}
              >
                The capsule
              </p>

              {/* 3x3 grid of items. Each item fades in with a cascading
                  delay during the 'in' phase so the capsule feels composed
                  piece-by-piece rather than dumped as a block. */}
              <div
                className="grid grid-cols-3"
                style={{ gap: 'clamp(8px, 1vw, 12px)' }}
              >
                {active.items.map((item, i) => (
                  <div
                    key={`${activeIdx}-${i}`}
                    className="flex flex-col gap-1.5"
                    style={{
                      animation: `capsule-item-in 700ms cubic-bezier(0.22, 1, 0.36, 1) ${i * 80}ms both`,
                    }}
                  >
                    <div
                      style={{
                        aspectRatio: '3/4',
                        borderRadius: 8,
                        overflow: 'hidden',
                        background: 'var(--atelier-stone-100)',
                        border: '1px solid var(--atelier-stone-200)',
                      }}
                    >
                      <Pic
                        src={item.src}
                        alt=""
                        loading="lazy"
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />
                    </div>
                    <p
                      className="text-[10px] truncate"
                      style={{
                        fontFamily: 'var(--atelier-font-display)',
                        color: 'var(--atelier-stone-600)',
                        letterSpacing: '-0.005em',
                      }}
                    >
                      {item.name}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Rotation indicator — three small dots showing which
              destination is currently active. Quietly anchored bottom
              centre so visitors know the spread is rotating. */}
          <div
            className="absolute flex items-center gap-2"
            style={{ bottom: 14, left: '50%', transform: 'translateX(-50%)' }}
            aria-hidden="true"
          >
            {DESTINATIONS.map((_, i) => (
              <span
                key={i}
                style={{
                  display: 'inline-block',
                  width: i === activeIdx ? 16 : 4,
                  height: 4,
                  borderRadius: 2,
                  background:
                    i === activeIdx
                      ? 'var(--atelier-brass-600)'
                      : 'var(--atelier-stone-300)',
                  transition: 'width 400ms ease, background 400ms ease',
                }}
              />
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes capsule-item-in {
          from { opacity: 0; transform: translateY(0.5rem); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </section>
  );
}
