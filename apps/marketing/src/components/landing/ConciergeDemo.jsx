import React, { useState, useEffect, useRef } from 'react';
import { Pic } from '@atelier/ui';
import { Sparkles, Send, X } from 'lucide-react';

/**
 * ConciergeDemo — an auto-playing, screen-recording-style demo of the
 * Atelier Concierge. Replicates the right-slide panel from the studio
 * (src/App.jsx:11984). Runs the full flow without user input:
 *
 *   1. Panel slides in with greeting + starter prompt pills
 *   2. One starter prompt pulses, then auto-fills the input
 *   3. User message appears as a chat bubble
 *   4. AI "typing" dots appear
 *   5. AI response streams in letter-by-letter with embedded item thumbnails
 *   6. After idle, the chat resets and the loop restarts
 *
 * Triggered by IntersectionObserver — animations only run when the section
 * is in viewport, so the demo isn't already burning cycles before the
 * visitor sees it.
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

const STARTER_PROMPTS = [
  'What should I wear today?',
  'Help me pack for a 4-day trip.',
  'Suggest something for a dinner out.',
  'Which pieces have I worn least?',
];

// Pre-written assistant reply. Inline tokens like [[name|src]] mark places
// where an item thumbnail should render alongside the streaming text.
// Kept tight (one sentence) so the whole reply fits the panel without scrolling.
const ASSISTANT_REPLY = `For today's 15–27°C: the [[Champagne silk vest|/wardrobe/gene-silk-front-vest-top-in-champagne-si.jpg]], [[Wool-blend trousers|/wardrobe/gael-wool-blend-trousers.jpg]], [[Block-heel sandals|/wardrobe/suedette-2-part-block-heel-sandals.jpg]], and the [[Fine chain necklace|/wardrobe/fine-chain-necklace-24-monica-vinader.jpg]]. An outfit you've worn twelve times this season.`;

// Stages of the demo loop
const STAGE = {
  IDLE: 'idle',
  GREETING: 'greeting',
  TYPING_INPUT: 'typing-input',
  SENDING: 'sending',
  ASSISTANT_TYPING: 'assistant-typing',
  STREAMING: 'streaming',
  COMPLETE: 'complete',
};

export function ConciergeDemo() {
  const containerRef = useRef(null);
  const [inView, setInView] = useState(false);

  const [stage, setStage] = useState(STAGE.GREETING);
  const [inputText, setInputText] = useState('');
  const [userMessage, setUserMessage] = useState('');
  const [assistantText, setAssistantText] = useState('');
  const [highlightedPrompt, setHighlightedPrompt] = useState(null);

  // All running timers, so we can cancel cleanly when re-running or
  // when the component unmounts.
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

  // IntersectionObserver — only run the demo when the user can see it.
  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting && entry.intersectionRatio > 0.3),
      { threshold: [0, 0.3, 0.6] }
    );
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  // The main animation loop — kicks off whenever the section becomes
  // visible, fully resets between iterations.
  useEffect(() => {
    if (!inView) {
      clearAllTimers();
      return;
    }
    let cancelled = false;

    const runOnce = () => {
      if (cancelled) return;
      // 0. Reset
      setStage(STAGE.GREETING);
      setInputText('');
      setUserMessage('');
      setAssistantText('');
      setHighlightedPrompt(null);

      const prompt = STARTER_PROMPTS[0]; // "What should I wear today?"

      // 1. Pulse the starter prompt
      addTimer(() => {
        if (cancelled) return;
        setHighlightedPrompt(0);
      }, 1800);

      // 2. Type the prompt into the input (character by character).
      // 55ms/char gives a deliberate, human-paced typing feel.
      addTimer(() => {
        if (cancelled) return;
        setStage(STAGE.TYPING_INPUT);
        let chars = 0;
        const typeNext = () => {
          if (cancelled) return;
          chars += 1;
          setInputText(prompt.slice(0, chars));
          if (chars < prompt.length) addTimer(typeNext, 55);
        };
        typeNext();
      }, 2600);

      // 3. Send → user bubble + clear input + typing dots
      const sendAt = 2600 + STARTER_PROMPTS[0].length * 55 + 600;
      addTimer(() => {
        if (cancelled) return;
        setStage(STAGE.SENDING);
        setUserMessage(prompt);
        setInputText('');
        setHighlightedPrompt(null);
      }, sendAt);

      addTimer(() => {
        if (cancelled) return;
        setStage(STAGE.ASSISTANT_TYPING);
      }, sendAt + 400);

      // 4. After thinking dots (1.8s — long enough to feel "considered"),
      // stream the reply at ~115 chars/sec (4 chars per 35ms).
      // This is half the speed of typical SaaS so each item thumbnail
      // and each piece of reasoning lands legibly.
      addTimer(() => {
        if (cancelled) return;
        setStage(STAGE.STREAMING);
        let chars = 0;
        const streamNext = () => {
          if (cancelled) return;
          chars += 4;
          if (chars >= ASSISTANT_REPLY.length) {
            setAssistantText(ASSISTANT_REPLY);
            setStage(STAGE.COMPLETE);
            // 5. After idle, restart loop
            addTimer(() => !cancelled && runOnce(), 8000);
          } else {
            setAssistantText(ASSISTANT_REPLY.slice(0, chars));
            addTimer(streamNext, 35);
          }
        };
        streamNext();
      }, sendAt + 400 + 1800);
    };

    runOnce();

    return () => {
      cancelled = true;
      clearAllTimers();
    };
  }, [inView]);

  // Parse the assistant text, splitting on [[label|src]] tokens so we can
  // render thumbnails inline alongside the streaming text.
  const renderAssistantText = (text) => {
    const parts = [];
    const regex = /\[\[([^\]|]+)\|([^\]]+)\]\]/g;
    let last = 0;
    let m;
    while ((m = regex.exec(text)) !== null) {
      if (m.index > last) parts.push({ type: 'text', text: text.slice(last, m.index) });
      parts.push({ type: 'item', label: m[1], src: m[2] });
      last = regex.lastIndex;
    }
    if (last < text.length) parts.push({ type: 'text', text: text.slice(last) });
    return parts;
  };

  const isBusy = stage === STAGE.STREAMING || stage === STAGE.ASSISTANT_TYPING || stage === STAGE.TYPING_INPUT;

  return (
    <div
      ref={containerRef}
      className="concierge-demo-panel relative mx-auto"
      style={{
        width: 'min(100%, 600px)',
        height: '560px',
        background: 'var(--atelier-cream)',
        boxShadow:
          '0 12px 36px -10px rgba(28, 25, 23, 0.10), 0 2px 4px rgba(28, 25, 23, 0.04)',
        borderRadius: '20px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid var(--atelier-stone-200)',
      }}
    >
      {/* Header */}
      <header
        className="concierge-demo-header"
        style={{
          padding: '1.5rem 1.5rem 1.25rem',
          borderBottom: '1px solid rgba(168, 162, 158, 0.18)',
        }}
      >
        <div className="flex items-start justify-between gap-4 mb-2">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <BrassRule />
              <span
                className="text-[10px] uppercase font-medium"
                style={{ letterSpacing: '0.3em', color: 'var(--atelier-stone-500)' }}
              >
                The Concierge
              </span>
            </div>
            <h3
              className="concierge-demo-title text-2xl"
              style={{
                fontFamily: 'var(--atelier-font-display)',
                color: 'var(--atelier-stone-900)',
                letterSpacing: '-0.01em',
                lineHeight: 1.1,
              }}
            >
              Your private stylist
            </h3>
          </div>
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            className="p-2 rounded-full transition-colors"
            style={{ color: 'var(--atelier-stone-400)' }}
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>
      </header>

      {/* Messages scroll area */}
      <div
        className="flex-1 overflow-y-auto"
        style={{ padding: '1.5rem 1.5rem' }}
      >
        {/* Greeting (always visible as first assistant message) */}
        <div className="mb-4">
          <p
            className="text-[10px] uppercase mb-1.5"
            style={{ letterSpacing: '0.2em', color: 'var(--atelier-stone-400)', fontWeight: 600 }}
          >
            Concierge
          </p>
          <div
            className="inline-block rounded-2xl px-3.5 py-2.5"
            style={{
              background: '#ffffff',
              border: '1px solid var(--atelier-stone-200)',
              maxWidth: '92%',
              fontFamily: 'var(--atelier-font-display)',
              fontSize: '13px',
              lineHeight: 1.5,
              color: 'var(--atelier-stone-800)',
            }}
          >
            Good morning, Sibylle. What's the day asking of you?
          </div>
        </div>

        {/* User message bubble */}
        {userMessage && (
          <div className="mb-4 flex flex-col items-end" style={{ animation: 'bubble-in 320ms ease' }}>
            <p
              className="text-[10px] uppercase mb-1.5"
              style={{ letterSpacing: '0.2em', color: 'var(--atelier-stone-400)', fontWeight: 600 }}
            >
              You
            </p>
            <div
              className="inline-block rounded-2xl px-3.5 py-2.5"
              style={{
                background: 'var(--atelier-ink)',
                color: '#ffffff',
                maxWidth: '85%',
                fontSize: '12.5px',
                lineHeight: 1.5,
              }}
            >
              {userMessage}
            </div>
          </div>
        )}

        {/* Assistant typing indicator */}
        {stage === STAGE.ASSISTANT_TYPING && (
          <div className="mb-4" style={{ animation: 'bubble-in 320ms ease' }}>
            <p
              className="text-[10px] uppercase mb-1.5"
              style={{ letterSpacing: '0.2em', color: 'var(--atelier-stone-400)', fontWeight: 600 }}
            >
              Concierge
            </p>
            <div
              className="inline-flex items-center gap-1.5 rounded-2xl px-4 py-3.5"
              style={{
                background: '#ffffff',
                border: '1px solid var(--atelier-stone-200)',
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: 'var(--atelier-brass-600)',
                  animation: 'dot-bounce 1.2s ease-in-out infinite',
                }}
              />
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: 'var(--atelier-brass-600)',
                  animation: 'dot-bounce 1.2s ease-in-out 0.15s infinite',
                }}
              />
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: 'var(--atelier-brass-600)',
                  animation: 'dot-bounce 1.2s ease-in-out 0.3s infinite',
                }}
              />
            </div>
          </div>
        )}

        {/* Assistant streaming response */}
        {(stage === STAGE.STREAMING || stage === STAGE.COMPLETE) && (
          <div className="mb-4" style={{ animation: 'bubble-in 320ms ease' }}>
            <p
              className="text-[10px] uppercase mb-1.5"
              style={{ letterSpacing: '0.2em', color: 'var(--atelier-stone-400)', fontWeight: 600 }}
            >
              Concierge
            </p>
            <div
              className="rounded-2xl px-3.5 py-2.5"
              style={{
                background: '#ffffff',
                border: '1px solid var(--atelier-stone-200)',
                fontFamily: 'var(--atelier-font-display)',
                fontSize: '13px',
                lineHeight: 1.6,
                color: 'var(--atelier-stone-800)',
                whiteSpace: 'pre-line',
              }}
            >
              {renderAssistantText(assistantText).map((part, i) => {
                if (part.type === 'text') return <span key={i}>{part.text}</span>;
                return (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 mx-0.5 px-1.5 py-0.5 rounded-md align-middle"
                    style={{
                      background: 'var(--atelier-stone-100)',
                      animation: 'item-pop 300ms ease',
                      fontSize: '13px',
                    }}
                  >
                    <Pic
                      src={part.src}
                      alt=""
                      loading="lazy"
                      style={{
                        width: 18,
                        height: 22,
                        objectFit: 'cover',
                        borderRadius: '3px',
                      }}
                    />
                    <span
                      style={{
                        fontFamily: 'var(--atelier-font-sans)',
                        fontWeight: 500,
                        color: 'var(--atelier-stone-800)',
                      }}
                    >
                      {part.label}
                    </span>
                  </span>
                );
              })}
              {stage === STAGE.STREAMING && (
                <span
                  aria-hidden="true"
                  style={{
                    display: 'inline-block',
                    width: '0.55ch',
                    marginLeft: '0.05ch',
                    color: 'var(--atelier-brass-600)',
                    animation: 'cursor-blink 1s steps(2, start) infinite',
                    fontStyle: 'normal',
                  }}
                >
                  ▍
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Starter prompts (only visible when no conversation yet) */}
      {!userMessage && (
        <div
          className="px-6 py-4"
          style={{ borderTop: '1px solid rgba(168, 162, 158, 0.18)' }}
        >
          <p
            className="text-[9px] uppercase mb-2.5"
            style={{ letterSpacing: '0.24em', color: 'var(--atelier-stone-400)', fontWeight: 600 }}
          >
            Try
          </p>
          <div className="flex flex-wrap gap-1.5">
            {STARTER_PROMPTS.map((p, i) => (
              <button
                key={p}
                type="button"
                tabIndex={-1}
                aria-hidden="true"
                className="text-[12px] px-3 py-1.5 rounded-full transition-all"
                style={{
                  background: highlightedPrompt === i ? 'var(--atelier-brass-300)' : '#ffffff',
                  color: highlightedPrompt === i ? 'var(--atelier-stone-900)' : 'var(--atelier-stone-700)',
                  border: `1px solid ${
                    highlightedPrompt === i ? 'var(--atelier-brass-300)' : 'var(--atelier-stone-200)'
                  }`,
                  fontWeight: highlightedPrompt === i ? 600 : 400,
                  transform: highlightedPrompt === i ? 'scale(1.04)' : 'scale(1)',
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input bar */}
      <div
        className="flex items-center gap-2 px-5 py-4"
        style={{
          borderTop: '1px solid rgba(168, 162, 158, 0.18)',
          background: 'var(--atelier-cream)',
        }}
      >
        <div
          className="flex-1 flex items-center px-4 rounded-full"
          style={{
            background: '#ffffff',
            border: '1px solid var(--atelier-stone-200)',
            height: '40px',
            minWidth: 0,
          }}
        >
          <Sparkles
            size={14}
            strokeWidth={1.5}
            style={{ color: 'var(--atelier-brass-600)', flexShrink: 0, marginRight: 8 }}
          />
          <span
            className="flex-1 text-[13px] truncate"
            style={{
              color: inputText ? 'var(--atelier-stone-800)' : 'var(--atelier-stone-400)',
              fontStyle: inputText ? 'normal' : 'italic',
              fontFamily: inputText ? 'var(--atelier-font-sans)' : 'var(--atelier-font-display)',
            }}
          >
            {inputText || 'Ask the Concierge…'}
            {stage === STAGE.TYPING_INPUT && (
              <span
                aria-hidden="true"
                style={{
                  display: 'inline-block',
                  width: '1px',
                  height: '14px',
                  background: 'var(--atelier-stone-800)',
                  verticalAlign: 'middle',
                  marginLeft: '1px',
                  animation: 'cursor-blink 1s steps(2, start) infinite',
                }}
              />
            )}
          </span>
        </div>
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          className="rounded-full flex items-center justify-center"
          style={{
            width: 40,
            height: 40,
            background: isBusy ? 'var(--atelier-stone-300)' : 'var(--atelier-ink)',
            color: '#ffffff',
            flexShrink: 0,
          }}
        >
          <Send size={14} strokeWidth={1.75} />
        </button>
      </div>

      <style>{`
        @keyframes bubble-in {
          from { opacity: 0; transform: translateY(0.5rem); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes item-pop {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes cursor-blink { 50% { opacity: 0; } }
        @keyframes dot-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-3px); opacity: 1; }
        }
        /* Mobile breakpoint — tighter header, smaller title */
        @media (max-width: 640px) {
          .concierge-demo-header {
            padding: 1rem 1.125rem 0.875rem !important;
          }
          .concierge-demo-title {
            font-size: 1.25rem !important;
          }
        }
      `}</style>
    </div>
  );
}
