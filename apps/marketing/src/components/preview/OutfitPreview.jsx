import React, { useState, useEffect, useRef } from 'react';
import { Wand2 } from 'lucide-react';
import { BrassRule } from '@atelier/ui';

/**
 * OutfitPreview — interactive marketing demo of the studio's Styling Studio.
 * Three occasion pills above a 4-slot grid; clicking a pill animates the
 * outfit items into the slots one by one, ~280ms apart, and reveals a short
 * stylist's note at the bottom. Simulates the real app's "AI styling" act.
 */

const OUTFITS = [
  {
    key: 'office',
    label: 'A morning meeting',
    items: [
      { slot: 'Top', name: 'Cashmere rollneck',  image: '/seed-wardrobe/cashmere-rollneck-camel.jpg' },
      { slot: 'Bottom', name: 'Charcoal wool trouser', image: '/seed-wardrobe/wool-trouser-charcoal.jpg' },
      { slot: 'Footwear', name: 'Tan penny loafers',   image: '/seed-wardrobe/penny-loafers-tan.jpg' },
      { slot: 'Accessory', name: 'Structured tote',    image: '/seed-wardrobe/structured-tote-tan.jpg' },
    ],
    note: 'Soft volume on top, sharp tailoring below. The tan ties the loafers and the bag, so the outfit reads as one decision rather than four.',
    confidence: 0.94,
  },
  {
    key: 'evening',
    label: 'Drinks tonight',
    items: [
      { slot: 'Dress', name: 'Champagne silk midi', image: '/seed-wardrobe/silk-midi-dress-champagne.jpg' },
      { slot: 'Outerwear', name: 'Camel wool coat', image: '/seed-wardrobe/camel-wool-coat.jpg' },
      { slot: 'Footwear', name: 'Black knee boots', image: '/seed-wardrobe/leather-knee-boots-black.jpg' },
      { slot: 'Accessory', name: 'Gold layered necklaces', image: '/seed-wardrobe/gold-layered-necklaces.jpg' },
    ],
    note: 'The champagne silk against the camel coat reads warmer than either alone. The boots and gold give the look its evening register without trying.',
    confidence: 0.89,
  },
  {
    key: 'weekend',
    label: 'A Saturday in town',
    items: [
      { slot: 'Top', name: 'Breton stripe tee',    image: '/seed-wardrobe/breton-stripe-tee.jpg' },
      { slot: 'Bottom', name: 'Dark wash jeans',  image: '/seed-wardrobe/dark-wash-jeans.jpg' },
      { slot: 'Footwear', name: 'White sneakers', image: '/seed-wardrobe/leather-sneakers-white.jpg' },
      { slot: 'Accessory', name: 'Silk twill scarf', image: '/seed-wardrobe/silk-twill-scarf.jpg' },
    ],
    note: 'Classic stripes and denim, lifted by the silk scarf knotted at the bag handle. Quietly intentional rather than effortlessly thrown together.',
    confidence: 0.91,
  },
];

export function OutfitPreview() {
  const [activeIdx, setActiveIdx] = useState(0);
  const [revealed, setRevealed] = useState(4); // Start fully revealed on load
  const [busy, setBusy] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => () => timerRef.current && clearInterval(timerRef.current), []);

  const pickOccasion = (idx) => {
    if (busy || idx === activeIdx) return;
    setBusy(true);
    setActiveIdx(idx);
    setRevealed(0);

    let count = 0;
    timerRef.current = setInterval(() => {
      count += 1;
      setRevealed(count);
      if (count >= 4) {
        clearInterval(timerRef.current);
        timerRef.current = null;
        setBusy(false);
      }
    }, 280);
  };

  const current = OUTFITS[activeIdx];

  return (
    <div
      className="rounded-[2rem] relative"
      style={{
        backgroundColor: '#ffffff',
        border: '1px solid var(--atelier-stone-200)',
        boxShadow: 'var(--atelier-shadow-smooth)',
        maxWidth: '1100px',
        marginInline: 'auto',
        padding: 'clamp(2rem, 4vw, 3rem)',
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-6 flex-wrap mb-8">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <BrassRule />
            <span
              className="text-[10px] font-medium uppercase"
              style={{
                letterSpacing: 'var(--atelier-tracking-eyebrow)',
                color: 'var(--atelier-brass-600)',
              }}
            >
              By Atelier Concierge
            </span>
          </div>
          <h3
            className="text-3xl md:text-4xl"
            style={{
              fontFamily: 'var(--atelier-font-display)',
              lineHeight: 'var(--atelier-leading-display)',
              color: 'var(--atelier-stone-900)',
            }}
          >
            Style for the occasion
          </h3>
          <p
            className="text-sm md:text-base mt-3"
            style={{
              color: 'var(--atelier-stone-500)',
              lineHeight: 'var(--atelier-leading-body)',
              maxWidth: '52ch',
            }}
          >
            Atelier composes an outfit from your wardrobe in seconds, with the stylist's reasoning underneath.
          </p>
        </div>
      </div>

      {/* Occasion picker pills */}
      <div
        className="flex flex-wrap gap-2 mb-10 pb-6"
        style={{ borderBottom: '1px solid var(--atelier-stone-200)' }}
      >
        <span
          className="text-[10px] uppercase font-semibold mr-3 self-center"
          style={{ letterSpacing: 'var(--atelier-tracking-eyebrow)', color: 'var(--atelier-stone-500)' }}
        >
          STYLE FOR
        </span>
        {OUTFITS.map((o, i) => {
          const active = i === activeIdx;
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => pickOccasion(i)}
              disabled={busy}
              className="text-xs px-4 py-2 rounded-full transition-all"
              style={{
                backgroundColor: active ? 'var(--atelier-ink)' : '#ffffff',
                color: active ? '#ffffff' : 'var(--atelier-stone-700)',
                border: `1px solid ${active ? 'var(--atelier-ink)' : 'var(--atelier-stone-200)'}`,
                cursor: busy ? 'default' : 'pointer',
                opacity: busy && !active ? 0.5 : 1,
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>

      {/* Outfit slots — 2x2 grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8">
        {current.items.map((item, i) => {
          const isRevealed = i < revealed;
          return (
            <div key={`${current.key}-${i}`} className="flex flex-col gap-3">
              <div
                className="aspect-[3/4] rounded-2xl relative overflow-hidden"
                style={{
                  backgroundColor: isRevealed ? '#f5f5f4' : 'transparent',
                  border: isRevealed ? 'none' : '1.5px dashed var(--atelier-stone-300)',
                }}
              >
                {/* Slot label — visible when empty */}
                {!isRevealed && (
                  <div
                    className="absolute inset-0 flex items-center justify-center text-[10px] uppercase"
                    style={{
                      letterSpacing: 'var(--atelier-tracking-eyebrow)',
                      color: 'var(--atelier-stone-400)',
                      fontWeight: 500,
                    }}
                  >
                    {item.slot}
                  </div>
                )}

                {/* Item image — fades and lifts in */}
                {isRevealed && (
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-cover"
                    style={{
                      animation: 'slotIn 450ms ease-out',
                    }}
                  />
                )}
              </div>

              {/* Caption — only when revealed */}
              {isRevealed && (
                <div
                  style={{ animation: 'fadeIn 500ms ease-out 80ms both' }}
                >
                  <p
                    className="text-[10px] uppercase font-semibold"
                    style={{
                      letterSpacing: 'var(--atelier-tracking-eyebrow)',
                      color: 'var(--atelier-stone-500)',
                    }}
                  >
                    {item.slot}
                  </p>
                  <p
                    className="text-sm mt-1"
                    style={{
                      fontFamily: 'var(--atelier-font-display)',
                      color: 'var(--atelier-stone-800)',
                      lineHeight: 1.3,
                    }}
                  >
                    {item.name}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Stylist's note + confidence — appears after all slots filled */}
      <div
        className="mt-10 rounded-2xl flex flex-col md:flex-row md:items-center gap-6 md:gap-8"
        style={{
          backgroundColor: 'var(--atelier-cream)',
          padding: 'clamp(1.25rem, 2vw, 1.75rem) clamp(1.5rem, 2.5vw, 2.25rem)',
          opacity: revealed >= 4 ? 1 : 0,
          transform: revealed >= 4 ? 'translateY(0)' : 'translateY(0.5rem)',
          transition: 'opacity 500ms ease, transform 500ms ease',
        }}
      >
        <Wand2
          size={28}
          strokeWidth={1.3}
          style={{ color: 'var(--atelier-brass-600)', flexShrink: 0 }}
        />
        <div className="flex-1">
          <p
            className="text-[10px] uppercase mb-2"
            style={{
              letterSpacing: 'var(--atelier-tracking-eyebrow)',
              color: 'var(--atelier-stone-500)',
              fontWeight: 600,
            }}
          >
            Stylist's note
          </p>
          <p
            className="text-sm md:text-[15px]"
            style={{
              fontFamily: 'var(--atelier-font-display)',
              fontStyle: 'italic',
              color: 'var(--atelier-stone-800)',
              lineHeight: 1.6,
              maxWidth: '52ch',
            }}
          >
            {current.note}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p
            className="text-[10px] uppercase"
            style={{
              letterSpacing: 'var(--atelier-tracking-eyebrow)',
              color: 'var(--atelier-stone-500)',
              fontWeight: 600,
            }}
          >
            Confidence
          </p>
          <p
            className="text-3xl mt-1"
            style={{
              fontFamily: 'var(--atelier-font-display)',
              color: 'var(--atelier-stone-900)',
              fontFeatureSettings: '"onum" on',
              lineHeight: 1,
            }}
          >
            {Math.round(current.confidence * 100)}<span style={{ fontSize: '0.6em', color: 'var(--atelier-stone-500)' }}>%</span>
          </p>
        </div>
      </div>

      <style>{`
        @keyframes slotIn { from { opacity: 0; transform: scale(1.04); } to { opacity: 1; transform: scale(1); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(0.25rem); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
