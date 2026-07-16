// apps/marketing/src/components/landing/InsideAtelier.jsx
//
// "Inside Atelier" — a faithful, interactive tour of the real app surfaces.
// One app shell (sidebar + main on desktop; top bar + bottom nav on mobile)
// whose main pane switches between the three workhorse views the user spends
// their time in: Wardrobe, Styling Studio, Lookbook. Mirrors the live app at
// edit.myatelier.style — same nav (src/nav/Sidebar.jsx), same editorial
// palette/typography, same card language. The mobile frame renders the app's
// mobile layout, not a shrunk desktop, so a phone visitor sees the phone app.
//
// Source of truth = the wardrobe repo (deployed). The docs/creative
// screenshots are pre-redesign and used only for per-view visual style.

import React, { useState } from 'react';
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
  Search,
  Plus,
  Star,
} from 'lucide-react';

// ── Brand sentinel — verbatim from Hero.jsx / src/App.jsx:182 ──────────────
function AtelierMark({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="256" height="256" fill="#1c1917" rx="56" />
      <g fill="none" stroke="#F7F5F2" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M 160 60 Q 160 44 144 44 Q 128 44 128 58 L 128 110" />
        <path d="M 128 110 L 62 184 L 194 184 Z" />
      </g>
      <line x1="128" y1="184" x2="128" y2="206" stroke="#D4B378" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
      <circle cx="128" cy="212" r="5" fill="#D4B378" />
    </svg>
  );
}

// ── Real studio nav (mirrors src/nav/Sidebar.jsx) ─────────────────────────
const NAV = [
  { id: 'concierge', icon: Sparkles, label: 'Concierge', brass: true, ask: true },
  { id: 'today', icon: Home, label: 'Today' },
  { id: 'wardrobe', icon: LayoutGrid, label: 'Wardrobe', view: true },
  { id: 'outfits', icon: Camera, label: 'Styling Studio', view: true },
  { id: 'calendar', icon: Calendar, label: 'Calendar' },
  { id: 'lookbook', icon: BookOpen, label: 'Lookbook', view: true },
  { id: 'inspiration', icon: Bookmark, label: 'Inspiration', divider: true },
  { id: 'finance', icon: PoundSterling, label: 'Insights' },
  { id: 'shops', icon: Store, label: 'Directory' },
];

const BOTTOM_NAV = [
  { id: 'today', icon: Home, label: 'Today' },
  { id: 'wardrobe', icon: LayoutGrid, label: 'Wardrobe', view: true },
  { id: 'concierge', icon: Sparkles, fab: true },
  { id: 'calendar', icon: Calendar, label: 'Calendar' },
  { id: 'outfits', icon: Camera, label: 'Studio', view: true },
];

const TABS = [
  { id: 'wardrobe', label: 'Wardrobe' },
  { id: 'outfits', label: 'Styling Studio' },
  { id: 'lookbook', label: 'Lookbook' },
];

// Map the card/lookbook slug vocabulary onto the real wardrobe tiles
// (public/wardrobe). Same products as the studio grid and hero.
const REAL = {
  dress: 'belt-shirt-dress',
  'blazer-pink': 'marina-single-breasted-blazer',
  jeans: 'high-rise-denim-shorts',
  'silk-vest': 'gene-silk-front-vest-top-in-champagne-si',
  'trench-coat': 'jasmin-coat',
  boots: 'merisa-gold-wide-fit-block-heel-sandals-',
  sandals: 'suedette-2-part-block-heel-sandals',
  'navy-top': 'riley-pale-pink-silk-front-vest-top',
  top: 'louisa-top',
  shirt: 'sleeveless-amalfi-linen-shirt',
  chinos: 'gael-wool-blend-trousers',
  wedges: 'merisa-gold-wide-fit-block-heel-sandals-',
  'linen-shorts': 'amalfi-linen-short',
};
const IMG = (slug) => `/wardrobe/${REAL[slug] ?? slug}.jpg`;

// ── Wardrobe content — the owner's real pieces (public/wardrobe). The card
// mirrors the app's editorial product card: category • £price / name /
// sub-category / cost-per-wear. No brand names shown. ────────────────────────
const WARDROBE_ITEMS = [
  { slug: 'dress', name: 'Belted shirt dress', cat: 'Dresses', sub: 'Midi', price: 49, wears: 14, cpw: '3.50', fav: true },
  { slug: 'blazer-pink', name: 'Single-breasted blazer', cat: 'Outerwear', sub: 'Tailored', price: 250, wears: 9, cpw: '27.78', fav: true },
  { slug: 'jeans', name: 'High-rise denim shorts', cat: 'Bottoms', sub: 'Denim', price: 79, wears: 31, cpw: '2.55' },
  { slug: 'silk-vest', name: 'Champagne silk vest', cat: 'Tops', sub: 'Camisole', price: 90, wears: 22, cpw: '4.09', fav: true },
  { slug: 'trench-coat', name: 'Navy wool coat', cat: 'Outerwear', sub: 'Coat', price: 269, wears: 40, cpw: '6.73' },
  { slug: 'boots', name: 'Gold block-heel sandals', cat: 'Shoes', sub: 'Sandals', price: 89, wears: 18, cpw: '4.94' },
  { slug: 'sandals', name: 'Block-heel sandals', cat: 'Shoes', sub: 'Sandals', price: 30, wears: 27, cpw: '1.11', fav: true },
  { slug: 'navy-top', name: 'Pale pink silk vest', cat: 'Tops', sub: 'Vest', price: 88, wears: 12, cpw: '7.33' },
];

const WARDROBE_SCOPES = ['All', 'Favourites', 'Owned', 'Wishlist'];
const WARDROBE_CATS = ['All', 'Tops', 'Bottoms', 'Dresses', 'Outerwear', 'Shoes', 'Bags', 'Accessories'];

// ── Styling Studio content ────────────────────────────────────────────────
const STYLE_INTENTS = ['Any', 'Smart', 'Casual', 'Work', 'Occasion', 'Leisure', 'Sport'];
const MOODS = ['Weekend brunch', 'Office day', 'Important meeting', 'Dinner date', 'Wedding guest', 'Travel day', 'Lazy Sunday', 'Cocktail evening'];
const ARCHIVE_TOPS = ['silk-vest', 'navy-top', 'top', 'shirt', 'blazer-pink'];

// ── Lookbook content — saved outfits (collage + name + piece count) ────────
const LOOKS = [
  { name: 'A Saturday in town', count: 12, items: ['dress', 'blazer-pink', 'sandals'], more: 9 },
  { name: 'Gallery opening', count: 10, items: ['trench-coat', 'navy-top', 'boots'], more: 7 },
  { name: 'Sunday market', count: 8, items: ['shirt', 'chinos', 'wedges'], more: 5 },
  { name: 'Champagne supper', count: 9, items: ['silk-vest', 'linen-shorts', 'sandals'], more: 6 },
];

// ── Small shared primitives ───────────────────────────────────────────────
const EYEBROW = {
  fontSize: 9,
  letterSpacing: '0.26em',
  textTransform: 'uppercase',
  color: 'var(--atelier-stone-500)',
  fontWeight: 600,
};

function BrassRule({ w = 18 }) {
  return <span aria-hidden="true" style={{ display: 'inline-block', width: w, height: '1.5px', background: 'var(--atelier-brass-300)', flexShrink: 0 }} />;
}

function Chip({ children, active, soft }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '0.32rem 0.7rem',
        borderRadius: 999,
        fontSize: 10.5,
        whiteSpace: 'nowrap',
        fontWeight: active ? 600 : 500,
        background: active ? 'var(--atelier-stone-900)' : soft ? 'rgba(212,179,120,0.10)' : '#fff',
        color: active ? '#fff' : 'var(--atelier-stone-600)',
        border: active ? '1px solid var(--atelier-stone-900)' : '1px solid var(--atelier-stone-200)',
      }}
    >
      {children}
    </span>
  );
}

function ItemTile({ slug, name, brand, cat, sub, price, wears, cpw, fav, dense }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ position: 'relative', aspectRatio: '3 / 4', borderRadius: 16, overflow: 'hidden', background: 'var(--atelier-stone-100, #efece8)', boxShadow: '0 1px 3px rgba(28,25,23,0.05)' }}>
        <img src={IMG(slug)} alt={name || ''} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        {fav && (
          <span style={{ position: 'absolute', top: 9, right: 9, width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,255,255,0.92)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 3px rgba(28,25,23,0.12)' }}>
            <Star size={12} strokeWidth={1.6} style={{ color: 'var(--atelier-brass-text)', fill: 'var(--atelier-brass-300)' }} />
          </span>
        )}
      </div>
      <div style={{ marginTop: 9 }}>
        <div className="flex items-baseline justify-between gap-2">
          <p style={{ fontSize: 8.5, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--atelier-stone-500)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cat}</p>
          <p style={{ fontSize: 11, fontWeight: 500, color: 'var(--atelier-stone-900)', flexShrink: 0 }}>£{price}</p>
        </div>
        <h4 style={{ fontFamily: 'var(--atelier-font-display)', fontSize: dense ? '0.95rem' : '1.05rem', color: 'var(--atelier-stone-800)', lineHeight: 1.2, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</h4>
        {!dense && <p style={{ fontSize: 10, color: 'var(--atelier-stone-500)', marginTop: 3 }}>{cat} • {sub}</p>}
        <p style={{ fontSize: 10, color: 'var(--atelier-stone-500)', marginTop: dense ? 2 : 3, letterSpacing: '0.01em' }}>{wears} wears · £{cpw}/wear</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// VIEW CONTENT — each returns just the main pane (no shell). `dense` trims
// padding/columns for the narrower mobile frame.
// ─────────────────────────────────────────────────────────────────────────

function WardrobeContent({ dense }) {
  return (
    <div style={{ padding: dense ? '1rem 1rem 0' : '1.4rem 1.6rem 0', minWidth: 0 }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4" style={{ marginBottom: dense ? 14 : 18 }}>
        <div style={{ minWidth: 0 }}>
          <div className="flex items-center gap-2" style={{ marginBottom: 7 }}>
            <BrassRule />
            <span style={EYEBROW}>Your Wardrobe</span>
          </div>
          <h3 style={{ fontFamily: 'var(--atelier-font-display)', fontSize: dense ? '1.6rem' : '2rem', lineHeight: 1.02, color: 'var(--atelier-stone-900)', letterSpacing: '-0.01em' }}>
            Your Collection
          </h3>
          <p style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--atelier-stone-500)', fontWeight: 500, marginTop: 7 }}>
            146 Pieces Curated <span style={{ textTransform: 'none', letterSpacing: 0, color: 'var(--atelier-stone-500)', fontWeight: 400 }}>· 12 on wishlist</span>
          </p>
          {/* Ask the Concierge — the inline CTA under the header */}
          <span className="inline-flex items-center gap-2" style={{ marginTop: 12, padding: '0.4rem 0.85rem', borderRadius: 999, background: '#fff', border: '1px solid var(--atelier-stone-200)' }}>
            <Sparkles size={12} strokeWidth={1.5} style={{ color: 'var(--atelier-brass-text)' }} />
            <span style={{ fontSize: 9.5, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--atelier-stone-600)', fontWeight: 500 }}>Ask the Concierge</span>
          </span>
        </div>
        {!dense && (
          <button style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '0.55rem 1rem', borderRadius: 999, background: 'var(--atelier-stone-900)', color: '#fff', fontSize: 11, fontWeight: 500, flexShrink: 0 }}>
            <Plus size={13} strokeWidth={2} /> Add to Collection
          </button>
        )}
      </div>

      {/* Command toolbar — search + filter pills */}
      <div className="flex items-center gap-2" style={{ marginBottom: 14, flexWrap: 'nowrap', overflow: 'hidden' }}>
        <div className="flex items-center gap-2" style={{ width: dense ? '100%' : 248, flexShrink: 0, padding: '0.55rem 0.85rem', borderRadius: 999, background: '#fff', border: '1px solid var(--atelier-stone-300)' }}>
          <Search size={13} strokeWidth={1.7} style={{ color: 'var(--atelier-stone-500)', flexShrink: 0 }} />
          <span style={{ fontSize: 11, color: 'var(--atelier-stone-500)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Search by name, brand, description…</span>
        </div>
        {!dense && WARDROBE_SCOPES.map((s, i) => (
          <Chip key={s} active={i === 0}>{i === 1 ? '★ ' : ''}{s}</Chip>
        ))}
      </div>

      {/* Category chips */}
      <div className="flex items-center gap-1.5" style={{ marginBottom: dense ? 14 : 18, flexWrap: 'nowrap', overflow: 'hidden' }}>
        {WARDROBE_CATS.slice(0, dense ? 4 : 8).map((c, i) => (
          <Chip key={c} active={i === 0}>{c}</Chip>
        ))}
      </div>

      {/* Full-width product grid (Daily Brief now lives on Today) */}
      <div className="grid" style={{ gridTemplateColumns: dense ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', columnGap: dense ? 12 : 18, rowGap: dense ? 16 : 22 }}>
        {WARDROBE_ITEMS.slice(0, dense ? 4 : 8).map((it) => (
          <ItemTile key={it.slug} {...it} dense={dense} />
        ))}
      </div>
    </div>
  );
}

function StudioContent({ dense }) {
  return (
    <div style={{ padding: dense ? '1rem 1rem 0' : '1.4rem 1.6rem 0', minWidth: 0 }}>
      {/* Header */}
      <div style={{ marginBottom: dense ? 12 : 16 }}>
        <div className="flex items-center gap-2" style={{ marginBottom: 6 }}>
          <BrassRule />
          <span style={EYEBROW}>Studio</span>
        </div>
        <h3 style={{ fontFamily: 'var(--atelier-font-display)', fontSize: dense ? '1.5rem' : '1.9rem', lineHeight: 1.02, color: 'var(--atelier-stone-900)', letterSpacing: '-0.01em' }}>
          Styling Studio
        </h3>
        <p style={{ fontSize: 11.5, color: 'var(--atelier-stone-500)', marginTop: 5 }}>Compose new looks from your wardrobe.</p>
      </div>

      {/* Compose / AI History tabs */}
      <div className="flex items-center gap-2" style={{ marginBottom: 14 }}>
        <Chip active>Compose</Chip>
        <span style={{ fontSize: 10.5, color: 'var(--atelier-stone-500)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          AI History <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 999, background: 'var(--atelier-stone-100,#efece8)' }}>4</span>
        </span>
      </div>

      {/* Style intent card */}
      <div style={{ borderRadius: 16, border: '1px solid var(--atelier-stone-200)', background: '#fff', padding: dense ? '0.9rem' : '1.1rem 1.2rem', marginBottom: dense ? 12 : 16 }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
          <span style={EYEBROW}>Style intent</span>
          {!dense && <span style={{ fontSize: 9.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--atelier-brass-text)', fontWeight: 600 }}>+ Custom intent</span>}
        </div>
        <div className="flex items-center gap-1.5" style={{ flexWrap: 'wrap', marginBottom: 14 }}>
          {STYLE_INTENTS.slice(0, dense ? 5 : 7).map((s, i) => (
            <Chip key={s} active={i === 0}>{s}</Chip>
          ))}
        </div>
        <button style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '0.7rem', borderRadius: 12, background: 'var(--atelier-stone-900)', color: '#fff', fontSize: 12.5, fontWeight: 600 }}>
          <Sparkles size={14} strokeWidth={1.7} style={{ color: 'var(--atelier-brass-300)' }} /> Style with Concierge
        </button>
        <div className="flex items-center justify-center gap-4" style={{ marginTop: 10 }}>
          <span style={{ fontSize: 10, color: 'var(--atelier-stone-500)' }}>⌁ Quick pick</span>
          <span style={{ fontSize: 10, color: 'var(--atelier-stone-500)' }}>⇄ Compare two looks</span>
        </div>
      </div>

      {/* Mood chips */}
      <div style={{ marginBottom: dense ? 8 : 4 }}>
        <p style={{ ...EYEBROW, marginBottom: 9 }}>Or try a mood</p>
        <div className="flex items-center gap-1.5" style={{ flexWrap: 'wrap' }}>
          {MOODS.slice(0, dense ? 5 : 8).map((m) => (
            <Chip key={m} soft>✦ {m}</Chip>
          ))}
        </div>
      </div>

      {!dense && (
        <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 18, marginTop: 18 }}>
          <div>
            <p style={{ ...EYEBROW, marginBottom: 8 }}>Current Look</p>
            <div className="grid grid-cols-3 gap-2">
              {[0, 1, 2].map((i) => (
                <div key={i} style={{ aspectRatio: '3/4', borderRadius: 10, border: '1.5px dashed var(--atelier-stone-200)', background: 'rgba(28,25,23,0.015)' }} />
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
              <p style={EYEBROW}>Wardrobe Archives</p>
              <span style={{ fontSize: 9.5, color: 'var(--atelier-stone-500)' }}>Tops · 33</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {ARCHIVE_TOPS.slice(0, 3).map((s) => (
                <div key={s} style={{ aspectRatio: '3/4', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--atelier-stone-200)' }}>
                  <img src={IMG(s)} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LookbookContent({ dense }) {
  return (
    <div style={{ padding: dense ? '1rem 1rem 0' : '1.4rem 1.6rem 0', minWidth: 0 }}>
      {/* Header */}
      <div style={{ marginBottom: dense ? 12 : 16 }}>
        <div className="flex items-center gap-2" style={{ marginBottom: 7 }}>
          <BrassRule />
          <span style={EYEBROW}>Curated archive</span>
        </div>
        <h3 style={{ fontFamily: 'var(--atelier-font-display)', fontSize: dense ? '1.6rem' : '2rem', lineHeight: 1.02, color: 'var(--atelier-stone-900)', letterSpacing: '-0.01em' }}>
          Lookbook
        </h3>
        <p style={{ fontSize: 11.5, color: 'var(--atelier-stone-500)', marginTop: 6 }}>Your saved looks · 15, scheduled wears, and AI history.</p>
      </div>

      {/* Outfits / Diary toggle */}
      <div className="inline-flex items-center" style={{ gap: 4, padding: 4, borderRadius: 999, background: 'rgba(28,25,23,0.06)', marginBottom: dense ? 14 : 18 }}>
        <span style={{ padding: '0.32rem 0.85rem', borderRadius: 999, background: '#fff', fontSize: 10.5, fontWeight: 600, color: 'var(--atelier-stone-900)', boxShadow: '0 1px 2px rgba(28,25,23,0.06)' }}>Outfits · 15</span>
        <span style={{ padding: '0.32rem 0.85rem', fontSize: 10.5, color: 'var(--atelier-stone-500)' }}>Diary</span>
      </div>

      {/* Saved-outfit cards — collage + name + piece count */}
      <div className="grid" style={{ gridTemplateColumns: dense ? '1fr' : '1fr 1fr', gap: dense ? 16 : 22 }}>
        {LOOKS.slice(0, dense ? 2 : 4).map((look) => (
          <div key={look.name}>
            <div className="grid grid-cols-2 gap-1.5" style={{ borderRadius: 16, overflow: 'hidden' }}>
              {look.items.slice(0, 3).map((s) => (
                <div key={s} style={{ aspectRatio: '1', overflow: 'hidden', background: 'var(--atelier-stone-100,#efece8)' }}>
                  <img src={IMG(s)} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              ))}
              <div style={{ aspectRatio: '1', background: 'var(--atelier-stone-800)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'var(--atelier-font-display)', fontSize: '1.15rem' }}>
                +{look.more}
              </div>
            </div>
            <div className="flex items-baseline justify-between gap-2" style={{ marginTop: 10 }}>
              <p style={{ fontFamily: 'var(--atelier-font-display)', fontSize: '1.1rem', color: 'var(--atelier-stone-900)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{look.name}</p>
              <span style={{ fontSize: 9.5, letterSpacing: '0.06em', color: 'var(--atelier-stone-500)', flexShrink: 0 }}>{look.count} pieces</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const VIEWS = {
  wardrobe: WardrobeContent,
  outfits: StudioContent,
  lookbook: LookbookContent,
};

// ─────────────────────────────────────────────────────────────────────────
// SHELLS
// ─────────────────────────────────────────────────────────────────────────

function DesktopFrame({ active, setActive }) {
  const View = VIEWS[active];
  return (
    <div
      className="hidden lg:grid"
      style={{
        gridTemplateColumns: 'minmax(0,196px) 1fr',
        borderRadius: 22,
        overflow: 'hidden',
        border: '1px solid var(--atelier-stone-200)',
        background: '#fff',
        boxShadow: '0 30px 60px -28px rgba(28,25,23,0.22), 0 8px 20px -12px rgba(28,25,23,0.12)',
        height: 560,
      }}
    >
      {/* Sidebar */}
      <aside style={{ background: 'var(--atelier-cream)', borderRight: '1px solid var(--atelier-stone-200)', padding: '1.25rem 0.875rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.125rem' }}>
        <div style={{ padding: '0.25rem 0.5rem 1.1rem', display: 'flex', alignItems: 'center', gap: 9 }}>
          <AtelierMark size={26} />
          <span style={{ fontFamily: 'var(--atelier-font-display)', fontSize: 17, color: 'var(--atelier-stone-900)', letterSpacing: '-0.01em', lineHeight: 1 }}>
            Atelier<span style={{ color: 'var(--atelier-brass-text)' }}>.</span>
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 0.5rem 0.625rem' }}>
          <BrassRule />
          <span style={{ ...EYEBROW, fontSize: 8.5, color: 'var(--atelier-stone-500)' }}>Studio</span>
        </div>
        {NAV.map(({ id, icon: Icon, label, brass, ask, divider, view }) => {
          const isActive = id === active;
          const clickable = !!view;
          return (
            <React.Fragment key={id}>
              {divider && <div aria-hidden="true" style={{ borderTop: '1px solid var(--atelier-stone-200)', margin: '0.375rem 0.25rem' }} />}
              <button
                onClick={clickable ? () => setActive(id) : undefined}
                style={{
                  display: 'flex', alignItems: 'center', gap: 11, padding: '0.5rem 0.625rem', borderRadius: 10,
                  background: isActive ? '#fff' : 'transparent',
                  color: isActive ? 'var(--atelier-stone-900)' : 'var(--atelier-stone-600)',
                  fontSize: 12, fontWeight: 500, textAlign: 'left', width: '100%',
                  cursor: clickable ? 'pointer' : 'default',
                  boxShadow: isActive ? '0 1px 2px rgba(28,25,23,0.04)' : 'none',
                  border: isActive ? '1px solid var(--atelier-stone-200)' : '1px solid transparent',
                }}
              >
                <Icon size={13} strokeWidth={1.6} style={{ color: brass ? 'var(--atelier-brass-600)' : isActive ? 'var(--atelier-stone-700)' : 'var(--atelier-stone-400)', flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{label}</span>
                {ask && <span style={{ fontSize: 8.5, letterSpacing: '0.22em', color: 'var(--atelier-brass-text)', fontWeight: 600, textTransform: 'uppercase' }}>Ask</span>}
              </button>
            </React.Fragment>
          );
        })}
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '0.5rem', borderTop: '1px solid var(--atelier-stone-200)', marginTop: 6 }}>
          <span style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--atelier-stone-900)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--atelier-font-display)', fontSize: 13, flexShrink: 0 }}>S</span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ fontSize: 11, fontWeight: 500, color: 'var(--atelier-stone-900)', lineHeight: 1.1 }}>Sibylle Sherwood</p>
            <p style={{ fontSize: 9, color: 'var(--atelier-stone-500)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>The founding member</p>
          </div>
          <ChevronRight size={13} style={{ color: 'var(--atelier-stone-300)', flexShrink: 0 }} />
        </div>
      </aside>

      {/* Main */}
      <div key={active} style={{ position: 'relative', overflow: 'hidden', background: '#fff', animation: 'ia-fade 500ms ease' }}>
        <View dense={false} />
        <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 72, background: 'linear-gradient(to bottom, rgba(255,255,255,0) 0%, #fff 92%)', pointerEvents: 'none' }} />
      </div>
    </div>
  );
}

function MobileFrame({ active, setActive }) {
  const View = VIEWS[active];
  return (
    <div
      className="lg:hidden mx-auto flex flex-col"
      style={{
        maxWidth: 380,
        borderRadius: 30,
        overflow: 'hidden',
        border: '1px solid var(--atelier-stone-200)',
        background: '#fff',
        boxShadow: '0 24px 50px -24px rgba(28,25,23,0.28)',
        height: 660,
      }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between" style={{ padding: '0.85rem 1rem', borderBottom: '1px solid var(--atelier-stone-200)', background: 'rgba(247,245,242,0.7)' }}>
        <div className="flex items-center gap-2">
          <AtelierMark size={22} />
          <span style={{ fontFamily: 'var(--atelier-font-display)', fontSize: 15, color: 'var(--atelier-stone-900)' }}>Atelier<span style={{ color: 'var(--atelier-brass-text)' }}>.</span></span>
        </div>
        <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--atelier-brass-300)', color: 'var(--atelier-stone-900)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--atelier-font-display)', fontSize: 12 }}>S</span>
      </div>

      {/* View */}
      <div key={active} style={{ position: 'relative', flex: 1, overflow: 'hidden', animation: 'ia-fade 500ms ease' }}>
        <View dense />
        <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 56, background: 'linear-gradient(to bottom, rgba(255,255,255,0) 0%, #fff 92%)', pointerEvents: 'none' }} />
      </div>

      {/* Bottom nav */}
      <div className="grid grid-cols-5 items-center" style={{ padding: '0.5rem 0.5rem 0.65rem', borderTop: '1px solid var(--atelier-stone-200)', background: 'rgba(247,245,242,0.92)' }}>
        {BOTTOM_NAV.map(({ id, icon: Icon, label, fab, view }) => {
          if (fab) {
            return (
              <div key={id} className="flex justify-center">
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg, var(--atelier-brass-300), var(--atelier-brass-600))', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 6px 16px -4px rgba(168,136,76,0.45)', transform: 'translateY(-6px)' }}>
                  <Icon size={19} strokeWidth={1.5} style={{ color: 'var(--atelier-stone-900)' }} />
                </div>
              </div>
            );
          }
          const isActive = id === active;
          return (
            <button key={id} onClick={view ? () => setActive(id) : undefined} className="flex flex-col items-center gap-1" style={{ padding: '0.25rem', cursor: view ? 'pointer' : 'default' }}>
              <Icon size={17} strokeWidth={isActive ? 2 : 1.5} style={{ color: isActive ? 'var(--atelier-stone-900)' : 'var(--atelier-stone-400)' }} />
              <span style={{ fontSize: 8.5, color: isActive ? 'var(--atelier-stone-900)' : 'var(--atelier-stone-400)', fontWeight: isActive ? 500 : 400 }}>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// SECTION
// ─────────────────────────────────────────────────────────────────────────

export function InsideAtelier() {
  // Starts on Wardrobe; the view only changes when the visitor picks a tab
  // (or a clickable sidebar item). No auto-advance — calmer, less disorienting.
  const [active, setActive] = useState('wardrobe');
  const choose = (id) => setActive(id);

  return (
    <section
      id="inside-atelier"
      style={{ background: 'var(--atelier-stone-50)', padding: 'clamp(4rem, 8vw, 7rem) var(--atelier-page-padding)' }}
    >
      <div className="mx-auto" style={{ maxWidth: 'var(--atelier-content-max)' }}>
        {/* Header */}
        <div className="text-center" style={{ marginBottom: 'clamp(2rem, 4vw, 3rem)' }}>
          <div className="flex items-center justify-center gap-3" style={{ marginBottom: 18 }}>
            <BrassRule />
            <span style={{ ...EYEBROW, letterSpacing: '0.28em', color: 'var(--atelier-brass-text)' }}>Inside Atelier</span>
            <BrassRule />
          </div>
          <h2 style={{ fontFamily: 'var(--atelier-font-display)', fontSize: 'clamp(2rem, 3.6vw, 3.25rem)', lineHeight: 1.04, letterSpacing: '-0.01em', color: 'var(--atelier-stone-900)', maxWidth: '20ch', margin: '0 auto 1rem' }}>
            A studio, <em style={{ fontWeight: 400 }}>not a spreadsheet.</em>
          </h2>
          <p style={{ fontSize: 'clamp(0.95rem, 1.1vw, 1.0625rem)', lineHeight: 1.6, color: 'var(--atelier-stone-500)', maxWidth: '52ch', margin: '0 auto' }}>
            The same surfaces you'll live in — your wardrobe, the styling studio, your lookbook — exactly as they appear when you sign in.
          </p>
        </div>

        {/* View tabs */}
        <div className="flex items-center justify-center gap-2" style={{ marginBottom: 'clamp(1.75rem, 3vw, 2.5rem)' }}>
          {TABS.map((t) => {
            const on = t.id === active;
            return (
              <button
                key={t.id}
                onClick={() => choose(t.id)}
                style={{
                  padding: '0.5rem 1.05rem', borderRadius: 999, fontSize: 12.5, fontWeight: on ? 600 : 500,
                  background: on ? 'var(--atelier-stone-900)' : '#fff',
                  color: on ? '#fff' : 'var(--atelier-stone-600)',
                  border: on ? '1px solid var(--atelier-stone-900)' : '1px solid var(--atelier-stone-200)',
                  transition: 'all 200ms ease', cursor: 'pointer',
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Frames */}
        <div>
          <DesktopFrame active={active} setActive={choose} />
          <MobileFrame active={active} setActive={choose} />
        </div>
      </div>

      <style>{`@keyframes ia-fade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }`}</style>
    </section>
  );
}

export default InsideAtelier;
