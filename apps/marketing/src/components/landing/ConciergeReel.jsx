import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Pic } from '@atelier/ui';

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
    kind: 'unworn',
    tiles: [
      ['claire-pleat-detail-dress', 'Pleat-detail dress', 'Bought in haste', '2×'],
      ['sequin-embellished-vest', 'Sequin vest', 'A gift', '1×'],
      ['marina-single-breasted-blazer', 'Single-breasted blazer', 'Inherited', '3×'],
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
      ['gael-wool-blend-trousers', 'Wool-blend trousers', '48 wears', '£2.29', false],
      ['robin-jumper', 'Fine-knit jumper', '36 wears', '£2.19', false],
      ['claire-pleat-detail-dress', 'Pleat-detail dress', '3 wears', '£75', true],
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
      <div style={{ flex: 1, minHeight: 0, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--atelier-stone-200)', background: 'var(--atelier-stone-100)' }}>
        <Pic src={W(file)} alt={name} loading="lazy" className="w-full h-full object-cover" style={{ objectPosition: 'center 32%' }} />
      </div>
      <figcaption style={{ flexShrink: 0, fontFamily: 'var(--atelier-font-display)', fontSize: 11.5, marginTop: 6, lineHeight: 1.15, color: 'var(--atelier-stone-800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</figcaption>
    </figure>
  );
}

// ── "What have I worn least?" — three photos that fill the card, each with a
// wear-count badge and its reason. Photo-forward, like the outfit grid.
function UnwornBody({ s }) {
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridAutoRows: '1fr', gap: 8 }}>
      {s.tiles.map(([file, name, reason, count], i) => (
        <figure key={file + i} className="cr-rv" style={{ '--cr-d': `${(BASE + 0.22 + i * STEP).toFixed(2)}s`, margin: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, minHeight: 0, position: 'relative', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--atelier-stone-200)', background: 'var(--atelier-stone-100)' }}>
            <Pic src={W(file)} alt={name} loading="lazy" className="w-full h-full object-cover" style={{ objectPosition: 'center 30%' }} />
            <span style={{ position: 'absolute', top: 6, right: 6, background: 'var(--atelier-ink)', color: '#fff', fontFamily: 'Arial, sans-serif', fontSize: 10, fontWeight: 700, letterSpacing: '0.03em', padding: '3px 7px', borderRadius: 999 }}>{count}</span>
          </div>
          <p style={{ flexShrink: 0, fontFamily: 'var(--atelier-font-display)', fontSize: 11.5, marginTop: 6, lineHeight: 1.15, color: 'var(--atelier-stone-800)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</p>
          <p style={{ flexShrink: 0, fontFamily: 'Arial, sans-serif', fontSize: 8.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--atelier-stone-500)', marginTop: 2 }}>{reason}</p>
        </figure>
      ))}
    </div>
  );
}

// ── "What's my wardrobe costing?" — a cost-per-wear leaderboard: framed rows
// with a real thumbnail and a bold brass figure; the poor performer flagged.
function CpwBody({ s }) {
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 9 }}>
      {s.rows.map(([file, name, wears, val, flag], i) => (
        <div key={file + i} className="cr-rv" style={{ '--cr-d': `${(BASE + 0.22 + i * 0.16).toFixed(2)}s`, display: 'flex', alignItems: 'center', gap: 12, padding: '9px 11px', borderRadius: 12, background: flag ? 'rgba(212,179,120,0.10)' : 'var(--atelier-stone-50)', border: `1px solid ${flag ? 'rgba(212,179,120,0.4)' : 'var(--atelier-stone-200)'}` }}>
          <div style={{ width: 44, height: 56, borderRadius: 8, flexShrink: 0, overflow: 'hidden', border: '1px solid var(--atelier-stone-200)' }}>
            <Pic src={W(file)} alt={name} loading="lazy" className="w-full h-full object-cover" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontFamily: 'var(--atelier-font-display)', fontSize: 15, lineHeight: 1.2, color: 'var(--atelier-stone-800)' }}>{name}</p>
            <p style={{ fontFamily: 'Arial, sans-serif', fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--atelier-stone-500)', marginTop: 2 }}>{wears}</p>
          </div>
          <p style={{ margin: 0, fontFamily: 'var(--atelier-font-display)', fontSize: '1.375rem', lineHeight: 1, color: flag ? 'var(--atelier-brass-text, #836A3A)' : 'var(--atelier-stone-900)', whiteSpace: 'nowrap' }}>
            {val}<span style={{ fontFamily: 'Arial, sans-serif', fontSize: 9, color: 'var(--atelier-stone-500)' }}>/wear</span>
          </p>
        </div>
      ))}
    </div>
  );
}

// ── "What's my style?" — the Style Manifesto: an editorial, typography-led
// card (large italic reading, brass trait chips, a bold palette strip).
function DnaBody({ s }) {
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <p className="cr-rv" style={{ '--cr-d': `${(BASE + 0.22).toFixed(2)}s`, fontFamily: 'var(--atelier-font-display)', fontStyle: 'italic', fontSize: 'clamp(1rem, 1.5vw, 1.1875rem)', lineHeight: 1.55, color: 'var(--atelier-stone-800)', margin: '0 0 20px' }}>
        “{s.reading}”
      </p>
      <div className="cr-rv" style={{ '--cr-d': `${(BASE + 0.4).toFixed(2)}s`, display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 22 }}>
        {s.traits.map((t) => (
          <span key={t} style={{ fontFamily: 'Arial, sans-serif', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, padding: '6px 13px', borderRadius: 999, background: 'var(--atelier-cream)', border: '1px solid #eee7da', color: 'var(--atelier-brass-text, #836A3A)' }}>{t}</span>
        ))}
      </div>
      <div className="cr-rv" style={{ '--cr-d': `${(BASE + 0.58).toFixed(2)}s` }}>
        <p style={{ fontFamily: 'Arial, sans-serif', fontSize: 9, letterSpacing: '0.24em', textTransform: 'uppercase', color: 'var(--atelier-stone-500)', margin: '0 0 9px' }}>Your palette</p>
        <div style={{ display: 'flex', gap: 7 }}>
          {s.palette.map((c, i) => (
            <span key={i} style={{ flex: 1, height: 50, borderRadius: 8, background: c, border: '1px solid var(--atelier-stone-200)' }} />
          ))}
        </div>
      </div>
    </div>
  );
}

function CardBody({ s }) {
  if (s.kind === 'dna') return <DnaBody s={s} />;
  if (s.kind === 'unworn') return <UnwornBody s={s} />;
  if (s.kind === 'cpw') return <CpwBody s={s} />;
  // grid (outfit / capsule) — fills the flex body; tiles crop to fit.
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: `repeat(${s.cols}, 1fr)`, gridAutoRows: '1fr', gap: 8 }}>
      {s.tiles.map(([file, name], i) => (
        <Tile key={file + i} file={file} name={name} delay={(BASE + 0.22 + i * STEP).toFixed(2)} />
      ))}
    </div>
  );
}

function Card({ s }) {
  return (
    <div style={{ height: '100%', background: '#fff', border: '1px solid var(--atelier-stone-200)', borderRadius: 22, overflow: 'hidden', boxShadow: '0 34px 74px -30px rgba(28,25,23,0.34)' }}>
      <div style={{ padding: '18px', height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
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
          <p style={{ margin: 0, flex: 1, fontFamily: 'var(--atelier-font-display)', fontStyle: 'italic', fontSize: 12, lineHeight: 1.35, color: 'var(--atelier-stone-700)', padding: '9px 12px', background: 'var(--atelier-cream)', border: '1px solid #eee7da', borderRadius: 12 }}>{s.note}</p>
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
  const stageWrapRef = useRef(null);
  const timerRef = useRef(null);
  const typeTimerRef = useRef(null);
  const pausedRef = useRef(false);
  const nearRef = useRef(NEAR); // side-card offset, recomputed to fit the stage width
  const farRef = useRef(FAR);   // off-frame parking offset
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

  // Fit the side-card offsets to the actual stage width so the left/right
  // cards are never clipped by the page margins, at any viewport.
  const computeOffsets = useCallback(() => {
    const stage = stageRef.current;
    const card = slotRefs.current[0];
    const stageW = stage ? stage.clientWidth : 0;
    if (!stageW) return;
    const cardW = card ? card.offsetWidth : 420;
    const sideHalf = (cardW * 0.8) / 2; // visual half-width of a scaled side card
    const maxNear = stageW / 2 - sideHalf - 14; // keep the side card inside the stage width
    nearRef.current = Math.max(150, Math.min(NEAR, maxNear));
    // Park off-frame cards beyond the VIEWPORT edge so the section clips them
    // (the stage no longer clips). Based on viewport width so it holds on any size.
    farRef.current = (typeof window !== 'undefined' ? window.innerWidth : stageW) / 2 + cardW + 40;
  }, []);

  // Position every slot by its offset from the current index.
  //
  // Three cards are ever visible: centre (front), left and right (set back).
  // The two hidden cards sit *at* the left/right slots but at opacity 0. On
  // advance the featured cards physically move + zoom, while the departing
  // left card simply FADES OUT in place and the next card FADES IN at the
  // right — nothing slides off the frame. Poses by offset (raw):
  //   0        centre, front, visible
  //   1        right slot, visible
  //   2        right slot, hidden (about to fade in)
  //   N-1      left slot, visible
  //   3..N-2   left slot, hidden (has faded out)
  const place = useCallback((i) => {
    const nearV = nearRef.current;
    slotRefs.current.forEach((slot, k) => {
      if (!slot) return;
      const raw = (k - i + N) % N;
      let x, s, o, z;
      if (raw === 0) { x = 0; s = 1; o = 1; z = 5; }
      else if (raw === 1) { x = nearV; s = 0.8; o = 1; z = 3; }
      else if (raw === N - 1) { x = -nearV; s = 0.8; o = 1; z = 3; }
      else if (raw === 2) { x = nearV; s = 0.8; o = 0; z = 2; }
      else { x = -nearV; s = 0.8; o = 0; z = 2; }
      const prev = slot._crx;
      // The hidden card that hops from the left slot to the right slot travels
      // while invisible — snap it (no transition) so nothing slides underneath.
      if (!reduced && prev !== undefined && Math.abs(x - prev) > nearV * 1.5) {
        slot.style.transition = 'none';
        slot.style.transform = `translate(${x}px,-50%) scale(${s})`;
        slot.getBoundingClientRect();
        slot.style.transition = '';
      }
      slot.style.transform = `translate(${x}px,-50%) scale(${s})`;
      slot.style.opacity = o;
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

  // Fit the offsets to the stage width on mount and on resize, so the left
  // and right cards are never clipped by the page margins.
  useEffect(() => {
    computeOffsets();
    place(idxRef.current);
    const onResize = () => { computeOffsets(); place(idxRef.current); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [computeOffsets, place]);

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
      id="concierge-reel"
      className="relative overflow-hidden"
      style={{ background: 'var(--atelier-stone-50)', paddingBlock: 'clamp(3.5rem, 7vw, 6rem)', paddingInline: 'var(--atelier-page-padding)', borderTop: '1px solid rgba(212,179,120,0.18)' }}
    >
      <div className="relative mx-auto" style={{ maxWidth: 'var(--atelier-content-max)' }}>
        {/* section header */}
        <div className="text-center" style={{ marginBottom: 'clamp(1.5rem, 3vw, 2.25rem)' }}>
          <div className="flex items-center justify-center gap-3 mb-4">
            <span aria-hidden="true" style={{ display: 'inline-block', width: 24, height: '1.5px', background: 'var(--atelier-brass-300)' }} />
            <p className="text-[10px] uppercase font-medium" style={{ letterSpacing: '0.28em', color: 'var(--atelier-brass-text, #836A3A)' }}>The Concierge at work</p>
            <span aria-hidden="true" style={{ display: 'inline-block', width: 24, height: '1.5px', background: 'var(--atelier-brass-300)' }} />
          </div>
          <h2 className="mx-auto" style={{ fontFamily: 'var(--atelier-font-display)', fontSize: 'clamp(1.875rem, 3.4vw, 2.875rem)', lineHeight: 1.05, letterSpacing: '-0.01em', color: 'var(--atelier-stone-900)', maxWidth: '20ch' }}>
            Ask. It answers from <em style={{ fontWeight: 400 }}>your</em> closet.
          </h2>
        </div>

        {/* the "ask" — the conversation panel, now ABOVE the cards so the
            answers below are fully visible. Light, wide, brass border-rule. */}
        <div className="mx-auto" style={{ width: 'min(780px, 100%)' }}>
          <div style={{ position: 'relative', background: '#fff', border: '1px solid var(--atelier-stone-200)', borderRadius: 20, padding: 'clamp(1.1rem, 2vw, 1.5rem) clamp(1.3rem, 2.6vw, 2rem)', boxShadow: '0 30px 70px -30px rgba(28,25,23,0.22), 0 8px 20px -12px rgba(28,25,23,0.1)' }}>
            <div aria-hidden="true" style={{ position: 'absolute', inset: 8, border: '1px solid rgba(212,179,120,0.35)', borderRadius: 14, pointerEvents: 'none' }} />
            <div className="relative">
              <div className="flex items-center gap-2" style={{ marginBottom: 11 }}>
                <span aria-hidden="true" style={{ width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg, var(--atelier-brass-300), var(--atelier-brass-600))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12 }}>✦</span>
                <span style={{ fontFamily: 'Arial, sans-serif', fontSize: 10, letterSpacing: '0.26em', textTransform: 'uppercase', color: 'var(--atelier-brass-text, #836A3A)', fontWeight: 700 }}>Ask the Concierge</span>
              </div>
              <div className="flex items-center justify-between gap-6" style={{ flexWrap: 'wrap' }}>
                {/* fixed one-line height + nowrap so the panel never resizes as
                    the question types or changes length */}
                <p style={{ flex: '1 1 300px', minWidth: 0, fontFamily: 'var(--atelier-font-display)', fontSize: 'clamp(1.0625rem, 1.7vw, 1.4375rem)', lineHeight: 1.4, letterSpacing: '-0.005em', color: 'var(--atelier-stone-900)', margin: 0, textAlign: 'left', height: '1.4em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <span ref={typedRef} /><span className="cr-cursor" aria-hidden="true" />
                </p>
                <div className="flex items-center gap-3 shrink-0">
                  <a href="/pricing" className="inline-flex items-center px-6 py-3 rounded-full text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.98]" style={{ background: 'var(--atelier-ink)', color: '#fff', letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>
                    Begin curating
                  </a>
                  <a href="/studio" className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors group" style={{ color: 'var(--atelier-stone-600)', whiteSpace: 'nowrap' }}>
                    See the Studio<span className="transition-transform group-hover:translate-x-1" style={{ color: 'var(--atelier-brass-text, #836A3A)', display: 'inline-block' }}>→</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* the answers — the depth carousel, fully visible below the ask */}
        <div ref={stageWrapRef} className="relative w-full" style={{ height: 'clamp(460px, 64vh, 660px)', marginTop: 'clamp(1.75rem, 3.5vw, 3rem)' }}>
          <div ref={stageRef} className="cr-stage" style={{ position: 'absolute', inset: 0, maxWidth: 1500, margin: '0 auto' }}>
            {SLIDES.map((s, i) => (
              <div
                key={i}
                ref={(el) => { slotRefs.current[i] = el; }}
                className="cr-slot"
                style={{ width: 'min(440px, 82vw)', marginLeft: 'calc(min(220px, 41vw) * -1)', height: 'min(calc(100% - 12px), 660px)' }}
                aria-hidden="true"
              >
                <Card s={s} />
              </div>
            ))}
          </div>
        </div>

        {/* dots */}
        <div className="flex items-center justify-center gap-2.5" role="tablist" aria-label="Concierge examples" onKeyDown={onKeyDots} style={{ marginTop: 'clamp(0.9rem, 2vh, 1.5rem)' }}>
          {SLIDES.map((s, i) => (
            <button key={i} type="button" role="tab" aria-selected={i === idx} aria-label={s.ask}
              className={`cr-dot${i === idx ? ' is-on' : ''}`} onClick={() => setIdx(i)} tabIndex={i === idx ? 0 : -1} />
          ))}
        </div>
      </div>

      {/* pause on hover of the cards */}
      <PauseBinder stageRef={stageWrapRef} pausedRef={pausedRef} />
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
