import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Pic } from '@atelier/ui';
import { ChevronRight } from 'lucide-react';

/**
 * ConciergeReel — the homepage hero.
 *
 * A live Concierge conversation: a chat bar types a question, then the answer
 * composes onto the foreground card of a three-card depth carousel that
 * shuffles (right → centre zooms up; centre → left zooms down; off-frame cards
 * clipped, never faded). Four real interactions cycle. See the design spec at
 * docs/superpowers/specs/2026-07-14-concierge-reel-hero-design.md.
 *
 * Motion is driven imperatively (transforms on slot refs) so the carousel
 * doesn't re-render every frame. Honours prefers-reduced-motion (static, no
 * auto-cycle) and pauses when the tab is hidden. The .cr-* classes + keyframes
 * live in styles/global.css.
 */

const W = (f) => `/wardrobe/${f}.jpg`;

// Four interactions, each grounded in a real feature and real photography.
const SLIDES = [
  {
    ask: 'What should I wear today?',
    reply: 'Here’s today — quiet glamour, one decision not four.',
    meta: 'Today’s proposal · 18–24°C',
    kind: 'grid',
    cols: 2,
    tiles: [
      ['gene-silk-front-vest-top-in-champagne-si', 'Champagne silk vest'],
      ['gael-wool-blend-trousers', 'Wool-blend trousers'],
      ['suedette-2-part-block-heel-sandals', 'Block-heel sandals'],
      ['fine-chain-necklace-24-monica-vinader', 'Fine chain necklace'],
    ],
    note: 'Champagne silk over sharp tailoring, warmed by gold.',
    stat: '94% confidence',
  },
  {
    ask: 'Pack me for Tokyo, 5 days',
    reply: 'Packed. Nine pieces, fourteen outfits — half for evening.',
    meta: 'Tokyo · April · cherry blossom',
    kind: 'grid',
    cols: 3,
    tiles: [
      ['pippa-silk-front-colourblock-vest', 'Silk vest'],
      ['belt-shirt-dress', 'Shirt dress'],
      ['gael-wool-blend-trousers', 'Trousers'],
      ['merisa-gold-wide-fit-block-heel-sandals-', 'Gold sandals'],
      ['hackness-jacket', 'Linen jacket'],
      ['robin-jumper', 'Fine knit'],
    ],
    note: 'Layerable, wrinkle-forgiving, and ready for rain.',
    stat: '9 pieces · 14 outfits',
  },
  {
    ask: 'What have I worn least?',
    reply: 'Three you’ve barely touched this year.',
    meta: 'Gathering dust',
    kind: 'rows',
    rows: [
      ['claire-pleat-detail-dress', 'Pleat-detail dress', 'bought in haste', '2×'],
      ['marina-single-breasted-blazer', 'Single-breasted blazer', 'inherited', '3×'],
    ],
    note: 'Wear them, or release them — your call, noted with reasons.',
    stat: '3 flagged',
  },
  {
    ask: 'What’s my wardrobe costing?',
    reply: 'Your returns, best to worst.',
    meta: 'Cost per wear · this year',
    kind: 'cpw',
    rows: [
      ['gael-wool-blend-trousers', 'Wool-blend trousers', '48 wears', '£2.29'],
      ['claire-pleat-detail-dress', 'Pleat-detail dress', '3 wears', '£75'],
    ],
    note: 'Two have paid for themselves. One owes you evenings.',
    stat: '£4.10 avg',
  },
  {
    // Style Manifesto — the Concierge's written reading of your aesthetic
    // (a real feature: a Gemini-written brief, refreshed each season).
    ask: 'What’s my style?',
    reply: 'Read from everything you own and wear.',
    meta: 'Your style manifesto',
    kind: 'dna',
    reading:
      'You dress in a tight tonal palette — champagne, stone and ink, warmed by gold. Tailored, never fussy. You buy rarely and keep what lasts.',
    traits: ['Tonal', 'Tailored', 'Quiet luxury', 'Gold-warmed'],
    palette: ['#e7d9be', '#c9b38a', '#a8a29e', '#A8884C', '#1c1917'],
    note: 'A private brief, composed from your wardrobe and refreshed each season.',
    stat: 'Volume I',
  },
];

const N = SLIDES.length;
const NEAR = 430;  // side-card offset — clear gap beside the ~420 centre card
const FAR = 1080;  // parked off-frame, clipped by the bounded stage
const BASE = 1.5;  // compose starts after the question types
const STEP = 0.14; // stagger between pieces
const HOLD = 7400; // ms per answer

// ── content renderers ──────────────────────────────────────────────────────

// A tile fills its grid cell (photo crops with object-cover) so the grid can
// flex to the card's available height rather than driving a too-tall layout.
function Tile({ file, name, delay }) {
  return (
    <figure className="cr-rv" style={{ '--cr-d': `${delay}s`, margin: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, minHeight: 0, borderRadius: 9, overflow: 'hidden', border: '1px solid var(--atelier-stone-200)', background: 'var(--atelier-stone-100)' }}>
        <Pic src={W(file)} alt={name} loading="lazy" className="w-full h-full object-cover" style={{ objectPosition: 'center 32%' }} />
      </div>
      <figcaption style={{ flexShrink: 0, fontFamily: 'var(--atelier-font-display)', fontSize: 11, marginTop: 4, lineHeight: 1.15, color: 'var(--atelier-stone-800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</figcaption>
    </figure>
  );
}

function Row({ file, name, sub, val, cpw, delay }) {
  return (
    <div className="cr-rv" style={{ '--cr-d': `${delay}s`, display: 'flex', alignItems: 'center', gap: 12, padding: '9px 3px', borderBottom: '1px solid #f2f0ec' }}>
      <div style={{ width: 32, height: 40, borderRadius: 6, flexShrink: 0, overflow: 'hidden', border: '1px solid var(--atelier-stone-200)' }}>
        <Pic src={W(file)} alt={name} loading="lazy" className="w-full h-full object-cover" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: 'var(--atelier-font-display)', fontSize: 14, color: 'var(--atelier-stone-800)' }}>{name}</p>
        <p style={{ fontFamily: 'Arial, sans-serif', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--atelier-stone-500)' }}>{sub}</p>
      </div>
      <p style={{ fontSize: 14.5, color: 'var(--atelier-brass-text, #836A3A)' }}>
        {val}{cpw && <span style={{ fontSize: 9, color: 'var(--atelier-stone-500)' }}>/wear</span>}
      </p>
    </div>
  );
}

function DnaBody({ s }) {
  return (
    <div>
      <p className="cr-rv" style={{ '--cr-d': `${(BASE + 0.22).toFixed(2)}s`, fontFamily: 'var(--atelier-font-display)', fontStyle: 'italic', fontSize: 15, lineHeight: 1.55, color: 'var(--atelier-stone-700)', margin: '0 0 14px' }}>
        {s.reading}
      </p>
      <div className="cr-rv" style={{ '--cr-d': `${(BASE + 0.4).toFixed(2)}s`, display: 'flex', flexWrap: 'wrap', gap: 7, marginBottom: 14 }}>
        {s.traits.map((t) => (
          <span key={t} style={{ fontFamily: 'Arial, sans-serif', fontSize: 11, letterSpacing: '0.04em', padding: '5px 11px', borderRadius: 999, background: 'var(--atelier-cream)', border: '1px solid #eee7da', color: 'var(--atelier-stone-700)' }}>{t}</span>
        ))}
      </div>
      <div className="cr-rv" style={{ '--cr-d': `${(BASE + 0.58).toFixed(2)}s` }}>
        <p style={{ fontFamily: 'Arial, sans-serif', fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--atelier-stone-500)', margin: '0 0 7px' }}>Your palette</p>
        <div style={{ display: 'flex', gap: 6 }}>
          {s.palette.map((c, i) => (
            <span key={i} style={{ flex: 1, height: 34, borderRadius: 7, background: c, border: '1px solid rgba(28,25,23,0.08)' }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function CardBody({ s }) {
  if (s.kind === 'dna') return <DnaBody s={s} />;
  if (s.kind === 'grid') {
    // grid fills the flex body: equal auto-rows, tiles crop to fit — so the
    // outfit/capsule never overflows the card, whatever the card height.
    return (
      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: `repeat(${s.cols}, 1fr)`, gridAutoRows: '1fr', gap: s.cols === 3 ? 7 : 9 }}>
        {s.tiles.map(([file, name], i) => (
          <Tile key={file + i} file={file} name={name} delay={(BASE + 0.22 + i * STEP).toFixed(2)} />
        ))}
      </div>
    );
  }
  return (
    <div style={{ flex: 1, minHeight: 0 }}>
      {s.rows.map(([file, name, sub, val], i) => (
        <Row key={file + i} file={file} name={name} sub={sub} val={val} cpw={s.kind === 'cpw'} delay={(BASE + 0.22 + i * 0.18).toFixed(2)} />
      ))}
    </div>
  );
}

function Card({ s }) {
  return (
    <div style={{ height: '100%', background: '#fff', border: '1px solid var(--atelier-stone-200)', borderRadius: 24, overflow: 'hidden', boxShadow: '0 34px 74px -30px rgba(28,25,23,0.34)' }}>
      <div style={{ padding: '16px 16px 18px', height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {/* Concierge reply */}
        <div className="cr-rv" style={{ '--cr-d': `${BASE}s`, display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 11, flexShrink: 0 }}>
          <span aria-hidden="true" style={{ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg, var(--atelier-brass-300), var(--atelier-brass-600))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12 }}>✦</span>
          <span style={{ background: 'var(--atelier-cream)', border: '1px solid #eee7da', borderRadius: '4px 15px 15px 15px', padding: '7px 11px', fontFamily: 'var(--atelier-font-display)', fontStyle: 'italic', fontSize: 12.5, color: 'var(--atelier-stone-700)', lineHeight: 1.35 }}>{s.reply}</span>
        </div>
        <p className="cr-rv" style={{ '--cr-d': `${(BASE + 0.1).toFixed(2)}s`, fontFamily: 'Arial, sans-serif', fontSize: 9.5, letterSpacing: '0.24em', textTransform: 'uppercase', color: 'var(--atelier-brass-text, #836A3A)', fontWeight: 700, margin: '0 0 9px', flexShrink: 0 }}>{s.meta}</p>
        {/* answer body — flexes to fill the remaining height */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <CardBody s={s} />
        </div>
        <div className="cr-rv" style={{ '--cr-d': '2.6s', display: 'flex', alignItems: 'center', gap: 10, marginTop: 11, flexShrink: 0 }}>
          <p style={{ margin: 0, flex: 1, fontFamily: 'var(--atelier-font-display)', fontStyle: 'italic', fontSize: 12, lineHeight: 1.35, color: 'var(--atelier-stone-700)', padding: '9px 12px', background: 'var(--atelier-cream)', border: '1px solid #eee7da', borderRadius: 11 }}>{s.note}</p>
          <span style={{ fontFamily: 'Arial, sans-serif', fontSize: 9.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--atelier-brass-text, #836A3A)', fontWeight: 700, whiteSpace: 'nowrap' }}>{s.stat}</span>
        </div>
      </div>
    </div>
  );
}

// ── the hero ────────────────────────────────────────────────────────────────

export function ConciergeReel() {
  const [idx, setIdx] = useState(0);
  const idxRef = useRef(0);
  const slotRefs = useRef([]);
  const typedRef = useRef(null);
  const stageRef = useRef(null);
  const timerRef = useRef(null);
  const typeTimerRef = useRef(null);
  const pausedRef = useRef(false);
  const [reduced, setReduced] = useState(false);
  const [docHidden, setDocHidden] = useState(false);

  // preload outfit imagery (webp variant). Some slides (Style DNA) have no
  // photography, so guard for missing tiles/rows.
  useEffect(() => {
    SLIDES.forEach((s) => {
      const files = s.tiles ? s.tiles.map((t) => t[0]) : (s.rows ? s.rows.map((r) => r[0]) : []);
      files.forEach((f) => { const img = new Image(); img.src = `/wardrobe/${f}.webp`; });
    });
  }, []);

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    setReduced(mq.matches);
    const on = (e) => setReduced(e.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  useEffect(() => {
    const on = () => setDocHidden(document.hidden);
    on();
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);

  // Position every slot by its offset from the current index.
  const place = useCallback((i) => {
    slotRefs.current.forEach((slot, k) => {
      if (!slot) return;
      const raw = (k - i + N) % N;
      let x, s, z;
      if (raw === 0) { x = 0; s = 1; z = 5; }          // centre (front)
      else if (raw === 1) { x = NEAR; s = 0.8; z = 3; } // right (set back)
      else if (raw === N - 1) { x = -NEAR; s = 0.8; z = 3; } // left (set back)
      else { x = -FAR; s = 0.7; z = 1; }               // parked off-frame, clipped
      const prev = slot._crx;
      if (!reduced && prev !== undefined && Math.abs(x - prev) > NEAR * 1.8) {
        slot.style.transition = 'none';
        slot.style.transform = `translate(${FAR}px,-50%) scale(0.7)`;
        slot.getBoundingClientRect();
        slot.style.transition = '';
      }
      slot.style.transform = `translate(${x}px,-50%) scale(${s})`;
      slot.style.zIndex = z;
      slot._crx = x;
      const isC = raw === 0;
      if (isC && !slot.classList.contains('is-center')) {
        slot.classList.remove('is-center'); void slot.offsetWidth; slot.classList.add('is-center');
      } else {
        slot.classList.toggle('is-center', isC);
      }
    });
  }, [reduced]);

  const typeQuestion = useCallback((text) => {
    clearInterval(typeTimerRef.current);
    if (!typedRef.current) return;
    if (reduced) { typedRef.current.textContent = text; return; }
    typedRef.current.textContent = '';
    let k = 0;
    typeTimerRef.current = setInterval(() => {
      if (!typedRef.current) return;
      typedRef.current.textContent = text.slice(0, k);
      k += 1;
      if (k > text.length) clearInterval(typeTimerRef.current);
    }, 40);
  }, [reduced]);

  // Drive placement + typing whenever the index changes.
  useEffect(() => {
    idxRef.current = idx;
    place(idx);
    typeQuestion(SLIDES[idx].ask);
  }, [idx, place, typeQuestion]);

  // Auto-advance (suspended for reduced motion, hidden tab, or hover).
  useEffect(() => {
    if (reduced || docHidden) { clearTimeout(timerRef.current); return; }
    const tick = () => {
      if (pausedRef.current) { timerRef.current = setTimeout(tick, 1200); return; }
      setIdx((v) => (v + 1) % N);
      timerRef.current = setTimeout(tick, HOLD);
    };
    timerRef.current = setTimeout(tick, HOLD);
    return () => clearTimeout(timerRef.current);
  }, [reduced, docHidden]);

  const onKeyDots = (e) => {
    if (e.key === 'ArrowRight') setIdx((v) => (v + 1) % N);
    else if (e.key === 'ArrowLeft') setIdx((v) => (v - 1 + N) % N);
  };

  return (
    <section
      className="relative flex flex-col items-center"
      style={{ minHeight: '100vh', paddingTop: 'clamp(4.75rem, 5vw, 5.75rem)', paddingBottom: 'clamp(0.75rem, 1.5vw, 1.5rem)', paddingInline: 'var(--atelier-page-padding)', overflow: 'hidden' }}
    >
      {/* soft brass atmosphere */}
      <div aria-hidden="true" className="absolute pointer-events-none" style={{ top: '3%', left: '50%', transform: 'translateX(-50%)', width: '70%', height: '46%', background: 'radial-gradient(ellipse at center, rgba(212,179,120,0.06) 0%, transparent 65%)' }} />

      <div className="relative w-full mx-auto flex flex-col items-center" style={{ maxWidth: 'var(--atelier-content-max)', flex: 1, minHeight: 0 }}>
        {/* masthead */}
        <div className="flex items-center justify-center gap-4 mb-4">
          <span aria-hidden="true" style={{ display: 'inline-block', width: 24, height: '1.5px', background: 'var(--atelier-brass-300)' }} />
          <p className="text-[10px] uppercase font-medium" style={{ letterSpacing: '0.32em', color: 'var(--atelier-brass-text, #836A3A)' }}>The Atelier Studio · MMXXVI</p>
          <span aria-hidden="true" style={{ display: 'inline-block', width: 24, height: '1.5px', background: 'var(--atelier-brass-300)' }} />
        </div>

        {/* headline + plain-purpose kicker (kept short for SEO / OAuth) */}
        <h1 className="text-center mx-auto" style={{ fontFamily: 'var(--atelier-font-display)', fontSize: 'clamp(1.75rem, 3vw, 2.875rem)', lineHeight: 1.03, letterSpacing: '-0.015em', color: 'var(--atelier-stone-900)', maxWidth: '16ch', marginBottom: '0.4rem' }}>
          Ask your closet <em style={{ fontWeight: 400 }}>anything</em>.
        </h1>
        <p className="text-center mx-auto" style={{ fontSize: 'clamp(0.85rem, 1vw, 1rem)', color: 'var(--atelier-stone-600)', maxWidth: '48ch', marginBottom: 'clamp(0.7rem, 1.3vh, 1.05rem)' }}>
          A private AI stylist that dresses you from the clothes you already own.
        </p>

        {/* chat bar */}
        <div className="w-full" style={{ display: 'flex', alignItems: 'center', gap: 11, width: 'min(600px, 92%)', margin: '0 auto 8px', background: '#fff', border: '1px solid var(--atelier-stone-200)', borderRadius: 999, padding: '8px 8px 8px 14px', boxShadow: '0 14px 34px -18px rgba(28,25,23,0.2)', position: 'relative', zIndex: 6 }}>
          <span aria-hidden="true" style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg, var(--atelier-brass-300), var(--atelier-brass-600))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 15 }}>✦</span>
          <span style={{ flex: 1, minWidth: 0, fontFamily: 'Arial, sans-serif', fontSize: 15, color: 'var(--atelier-stone-900)', whiteSpace: 'nowrap', overflow: 'hidden' }}>
            <span ref={typedRef} /><span className="cr-cursor" aria-hidden="true" />
          </span>
          {/* the CTA lives in the chat bar (no separate CTA row below → saves height) */}
          <a href="/pricing" className="inline-flex items-center gap-1.5 transition-all hover:opacity-90 active:scale-[0.98]" style={{ flexShrink: 0, background: 'var(--atelier-ink)', color: '#fff', fontFamily: 'Arial, sans-serif', fontSize: 13, fontWeight: 600, letterSpacing: '0.02em', padding: '9px 15px 9px 17px', borderRadius: 999 }}>
            Begin curating<ChevronRight size={15} strokeWidth={2} />
          </a>
        </div>

        {/* depth carousel */}
        <div className="relative w-full" style={{ flex: 1, minHeight: 0 }}>
          {/* stage fills the (flex-sized) parent via inset:0 — height:100% would
              collapse to 0 because the flex parent's height isn't "definite". */}
          <div ref={stageRef} className="cr-stage" style={{ position: 'absolute', inset: 0, maxWidth: 1500, margin: '0 auto' }}>
            {SLIDES.map((s, i) => (
              <div
                key={i}
                ref={(el) => { slotRefs.current[i] = el; }}
                className="cr-slot"
                /* height fills the available stage space (bounded, capped) so the
                   card never grows taller than the gap between chat bar and dots
                   and overlaps them; leaves ~8px breathing room top and bottom. */
                style={{ width: 'min(420px, 84vw)', marginLeft: 'calc(min(210px, 42vw) * -1)', height: 'min(calc(100% - 16px), 470px)' }}
                aria-hidden={i !== idx}
              >
                <Card s={s} />
              </div>
            ))}
          </div>
        </div>

        {/* dots + a quiet secondary link (the primary CTA is in the chat bar) */}
        <div className="flex flex-col items-center" style={{ gap: 'clamp(0.5rem, 1.1vh, 0.85rem)', marginTop: 'clamp(0.55rem, 1.3vh, 1rem)' }}>
          <div className="flex items-center justify-center gap-2.5" role="tablist" aria-label="Concierge examples" onKeyDown={onKeyDots}>
            {SLIDES.map((s, i) => (
              <button key={i} type="button" role="tab" aria-selected={i === idx} aria-label={s.ask}
                className={`cr-dot${i === idx ? ' is-on' : ''}`} onClick={() => setIdx(i)} tabIndex={i === idx ? 0 : -1} />
            ))}
          </div>
          <a href="/studio" className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors group" style={{ color: 'var(--atelier-stone-600)' }}>
            See the studio<span className="transition-transform group-hover:translate-x-1" style={{ color: 'var(--atelier-brass-text, #836A3A)', display: 'inline-block' }}>→</span>
          </a>
        </div>
      </div>

      {/* pause on hover of the whole stage */}
      <PauseBinder stageRef={stageRef} pausedRef={pausedRef} />
    </section>
  );
}

// Binds hover pause without re-rendering the carousel.
function PauseBinder({ stageRef, pausedRef }) {
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const enter = () => { pausedRef.current = true; };
    const leave = () => { pausedRef.current = false; };
    el.addEventListener('mouseenter', enter);
    el.addEventListener('mouseleave', leave);
    return () => { el.removeEventListener('mouseenter', enter); el.removeEventListener('mouseleave', leave); };
  }, [stageRef, pausedRef]);
  return null;
}

export default ConciergeReel;
