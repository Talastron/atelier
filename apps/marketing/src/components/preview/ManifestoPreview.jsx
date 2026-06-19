import React, { useState, useEffect, useRef } from 'react';
import { Wand2 } from 'lucide-react';
import { BrassRule } from '@atelier/ui';

/**
 * ManifestoPreview — interactive marketing demo of the studio's Style
 * Manifesto. Cycles through three pre-written manifestos of distinct
 * wardrobe types (quiet, colour-forward, tailored), revealing the next
 * via a streaming animation that simulates real AI generation.
 *
 * NOT a screenshot. The text streams character-by-character at ~500
 * chars/sec, mimicking the experience of the actual product writing a
 * brief from your wardrobe in real time.
 */

const VARIANTS = [
  {
    label: 'Quiet, considered',
    date: '18 June 2026',
    text: `You dress in the colours of considered absence: stone, ink, cream, with brass at the wrist as the only ornament. The silhouettes you reach for are quiet ones, a tailored shoulder, an unfussy trouser, a coat that holds its line. You are not minimalist, exactly; you simply trust that less, well-chosen, says more.

The pieces you wear most are the ones whose construction you can feel. The cashmere rollneck has been worn seventy times this year; the silk blouse has not. Your wardrobe knows the difference between aspiration and habit, and is, on the whole, in favour of habit.

What you are missing, judging by your saved inspirations rather than your closet, is one piece of softness against the structure. A wool wrap. A velvet jacket. Something that catches the light without asking for it.`,
  },
  {
    label: 'Colour-forward',
    date: '2 May 2026',
    text: `You wear colour the way other people wear neutrals. Emerald, plum, ochre, the occasional cobalt; none of it accidental. The silhouettes that flatter you most are also the boldest: a wide trouser, a voluminous sleeve, a coat that announces itself before you do. There is conviction in your wardrobe that the photographs alone do not communicate.

The pieces logged most this year tell a consistent story. The green silk dress has earned its keep five times over. The plum knit has become a near-uniform on autumn Tuesdays. Items that arrived without colour, by contrast, have a notably shorter half-life in your week.

The gap, if there is one, is in what holds the colour together. Your wardrobe could carry one more anchoring piece in cream or stone, a quiet base note that makes the saturation feel intentional rather than relentless.`,
  },
  {
    label: 'Tailored classic',
    date: '14 March 2026',
    text: `Your wardrobe reads as a long argument with itself, won by the side of restraint. Navy, charcoal, ivory, with grey wool in winter and crisp poplin in summer; every fabric chosen for the body it would hold a year from now, not the moment of its purchase. The cut matters here in the way it might to a tailor. The shoulder is precise; the hem sits where it should.

The items most worn this year are unsurprising, and that is the point. The wool trousers have been worn forty-eight times. The white shirt fifty-two. The pieces that haven't moved have a single thing in common: they are the ones that asked to be styled rather than worn.

There is room, in this wardrobe, for one well-chosen piece of softness. A camel coat. A loose cashmere. Something that suggests the precision is a choice rather than a default.`,
  },
];

export function ManifestoPreview() {
  const [activeIdx, setActiveIdx] = useState(0);
  const [displayText, setDisplayText] = useState(VARIANTS[0].text);
  const [busy, setBusy] = useState(false);
  const streamRef = useRef(null);

  // Clean up any in-flight stream on unmount
  useEffect(() => () => streamRef.current && clearInterval(streamRef.current), []);

  const refresh = () => {
    if (busy) return;
    setBusy(true);
    // Fade out current text
    setDisplayText('');

    // Brief pause, then stream new manifesto in character by character
    setTimeout(() => {
      const nextIdx = (activeIdx + 1) % VARIANTS.length;
      setActiveIdx(nextIdx);
      const fullText = VARIANTS[nextIdx].text;
      let chars = 0;

      streamRef.current = setInterval(() => {
        chars += 9;
        if (chars >= fullText.length) {
          setDisplayText(fullText);
          clearInterval(streamRef.current);
          streamRef.current = null;
          setBusy(false);
        } else {
          setDisplayText(fullText.slice(0, chars));
        }
      }, 18);
    }, 450);
  };

  const current = VARIANTS[activeIdx];
  const showingFullText = displayText === current.text;

  return (
    <div
      className="rounded-[2rem] relative overflow-hidden"
      style={{
        backgroundColor: 'var(--atelier-ink)',
        color: '#ffffff',
        maxWidth: '900px',
        marginInline: 'auto',
        padding: 'clamp(2rem, 4vw, 3.5rem)',
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <BrassRule />
        <span
          className="text-[10px] font-medium uppercase"
          style={{
            letterSpacing: 'var(--atelier-tracking-eyebrow)',
            color: 'var(--atelier-brass-300)',
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
          color: '#ffffff',
        }}
      >
        Style manifesto
      </h3>

      <p
        className="text-sm md:text-base mt-4"
        style={{
          color: 'var(--atelier-stone-400)',
          lineHeight: 'var(--atelier-leading-body)',
          maxWidth: '52ch',
        }}
      >
        Atelier reads your most-worn pieces, outfit pairings, and saved inspirations, then writes a
        private three-paragraph brief of your aesthetic. Refresh whenever your taste shifts.
      </p>

      {/* Embedded cream card with the manifesto itself */}
      <div
        className="mt-10 rounded-2xl relative"
        style={{
          backgroundColor: 'var(--atelier-cream)',
          color: 'var(--atelier-stone-800)',
          padding: 'clamp(1.75rem, 3vw, 2.75rem)',
          minHeight: '24rem',
        }}
      >
        {/* The streaming italic prose */}
        <div
          style={{
            fontFamily: 'var(--atelier-font-display)',
            fontStyle: 'italic',
            fontSize: 'clamp(0.95rem, 1.1vw, 1.0625rem)',
            lineHeight: 1.85,
            whiteSpace: 'pre-line',
            maxWidth: '62ch',
          }}
        >
          {displayText}
          {busy && (
            <span
              aria-hidden="true"
              style={{
                display: 'inline-block',
                width: '0.55ch',
                marginLeft: '0.05ch',
                color: 'var(--atelier-brass-600)',
                animation: 'blink 1s steps(2, start) infinite',
                fontStyle: 'normal',
              }}
            >
              ▍
            </span>
          )}
        </div>

        {/* Footer of the cream card — date stamp (only when complete) */}
        <p
          className="text-[10px] uppercase mt-7 flex items-center gap-3"
          style={{
            letterSpacing: 'var(--atelier-tracking-eyebrow)',
            color: 'var(--atelier-stone-400)',
            fontFamily: 'var(--atelier-font-sans)',
            opacity: showingFullText ? 1 : 0,
            transition: 'opacity 350ms ease',
          }}
        >
          <BrassRule />
          Written {current.date} · {current.label}
        </p>
      </div>

      {/* Refresh control */}
      <div className="mt-8 flex justify-end">
        <button
          type="button"
          onClick={refresh}
          disabled={busy}
          className="text-xs uppercase px-5 py-2.5 rounded-full flex items-center gap-2 font-medium transition-all"
          style={{
            backgroundColor: 'var(--atelier-brass-300)',
            color: 'var(--atelier-stone-900)',
            letterSpacing: '0.12em',
            opacity: busy ? 0.5 : 1,
            cursor: busy ? 'default' : 'pointer',
          }}
        >
          <Wand2
            size={14}
            strokeWidth={1.5}
            style={{ animation: busy ? 'spin 1.4s linear infinite' : 'none' }}
          />
          {busy ? 'Writing…' : 'Refresh manifesto'}
        </button>
      </div>

      {/* Inline keyframes — no external CSS needed */}
      <style>{`
        @keyframes blink { 50% { opacity: 0; } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
