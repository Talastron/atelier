import React, { useState, useEffect, useRef } from 'react';
import { Pic } from '@atelier/ui';
import {
  Search,
  SlidersHorizontal,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  Plus,
  Star,
  Sparkles,
  Wand2,
  Bookmark,
  Calendar,
  LayoutGrid,
  Camera,
  BookOpen,
  PoundSterling,
  Ruler,
  Store,
  LogOut,
  TrendingUp,
  Clock,
} from 'lucide-react';

/**
 * StudioFrame — a faithful, interactive replica of the Atelier studio app
 * rendered inside the marketing site. Matches the actual product screenshot
 * one for one: hanger logo, Wardrobe header, full toolbar (search, filters,
 * sort, add, select), segment tabs (All / Favourites / Owned / Wishlist),
 * category chips, three-column item grid with brass favourite badges, and
 * the right rail with TODAY weather, Needs Attention, and TODAY'S PICK.
 *
 * Click any sidebar nav item to switch views. Click any pill or chip to
 * filter the grid. Click "Suggest a look" on the TODAY card for the AI
 * styling demo.
 */

// ───────────────────────────────────────────────────────────────────────────
// ATELIER MARK — wire hanger silhouette with a brass charm
// (verbatim from studio src/App.jsx:182)
// ───────────────────────────────────────────────────────────────────────────

function AtelierMark({ size = 32 }) {
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

// ───────────────────────────────────────────────────────────────────────────
// SAMPLE DATA
// ───────────────────────────────────────────────────────────────────────────

const SAMPLE_ITEMS = [
  { src: '/wardrobe/jasmin-coat.jpg', name: 'Navy wool coat', cat: 'Outerwear', season: 'Autumn · Winter', price: 269, fav: true, segment: 'owned' },
  { src: '/wardrobe/marina-single-breasted-blazer.jpg', name: 'Single-breasted blazer', cat: 'Outerwear', season: 'Spring · Summer', price: 250, fav: false, segment: 'owned' },
  { src: '/wardrobe/mirabel-satin-blouse.jpg', name: 'Satin blouse', cat: 'Tops', season: 'Autumn · Winter', price: 110, fav: true, segment: 'owned' },
  { src: '/wardrobe/gene-silk-front-vest-top-in-champagne-si.jpg', name: 'Champagne silk vest', cat: 'Tops', season: 'Spring · Summer', price: 90, fav: false, segment: 'owned' },
  { src: '/wardrobe/gael-wool-blend-trousers.jpg', name: 'Wool-blend trousers', cat: 'Bottoms', season: 'All year', price: 110, fav: true, segment: 'owned' },
  { src: '/wardrobe/pleated-tailored-shorts.jpg', name: 'Pleated tailored shorts', cat: 'Bottoms', season: 'Spring · Summer', price: 138, fav: false, segment: 'owned' },
  { src: '/wardrobe/claire-pleat-detail-dress.jpg', name: 'Pleat-detail dress', cat: 'Dresses', season: 'Spring · Summer', price: 225, fav: false, segment: 'wishlist' },
  { src: '/wardrobe/merisa-gold-wide-fit-block-heel-sandals-.jpg', name: 'Gold block-heel sandals', cat: 'Shoes', season: 'Summer', price: 89, fav: true, segment: 'owned' },
  { src: '/wardrobe/gold-vermeil-baroque-pearl-pendant-pearl.jpg', name: 'Baroque pearl pendant', cat: 'Jewellery', season: 'All year', price: 75, fav: true, segment: 'owned' },
  { src: '/wardrobe/fine-chain-necklace-24-monica-vinader.jpg', name: 'Fine chain necklace', cat: 'Jewellery', season: 'All year', price: 95, fav: false, segment: 'owned' },
  { src: '/wardrobe/high-rise-denim-shorts.jpg', name: 'High-rise denim shorts', cat: 'Bottoms', season: 'Summer', price: 79, fav: false, segment: 'owned' },
  { src: '/wardrobe/england-elektra-ladies-leather-gloves.jpg', name: 'Leather gloves', cat: 'Accessories', season: 'Autumn · Winter', price: 69, fav: false, segment: 'owned' },
  { src: '/wardrobe/pippa-silk-front-colourblock-vest.jpg', name: 'Silk colourblock vest', cat: 'Tops', season: 'Spring · Summer', price: 98, fav: false, segment: 'owned' },
  { src: '/wardrobe/riley-pale-pink-silk-front-vest-top.jpg', name: 'Pale pink silk vest', cat: 'Tops', season: 'Summer', price: 88, fav: false, segment: 'owned' },
  { src: '/wardrobe/reg-classic-button-down-blouse.jpg', name: 'Button-down blouse', cat: 'Tops', season: 'Spring', price: 99, fav: false, segment: 'owned' },
  { src: '/wardrobe/robin-jumper.jpg', name: 'Fine-knit jumper', cat: 'Tops', season: 'Spring · Summer · Autumn', price: 79, fav: true, segment: 'owned' },
  { src: '/wardrobe/robin-stripe-cardigan.jpg', name: 'Striped cardigan', cat: 'Tops', season: 'Spring · Summer · Autumn', price: 59, fav: false, segment: 'owned' },
  { src: '/wardrobe/rosana-frill-trim-polka-dot-blouse.jpg', name: 'Polka-dot blouse', cat: 'Tops', season: 'Spring · Autumn · Winter', price: 69, fav: false, segment: 'owned' },
  { src: '/wardrobe/louisa-dobby-top.jpg', name: 'Dobby-weave top', cat: 'Tops', season: 'Spring · Autumn · Winter', price: 59, fav: false, segment: 'owned' },
  { src: '/wardrobe/sleeveless-amalfi-linen-shirt.jpg', name: 'Sleeveless linen shirt', cat: 'Tops', season: 'Summer', price: 79, fav: false, segment: 'owned' },
  { src: '/wardrobe/amalfi-linen-short.jpg', name: 'Linen shorts', cat: 'Bottoms', season: 'Summer', price: 99, fav: false, segment: 'owned' },
  { src: '/wardrobe/chessie-shorts.jpg', name: 'Tailored shorts', cat: 'Bottoms', season: 'Spring · Summer', price: 59, fav: false, segment: 'owned' },
  { src: '/wardrobe/belt-shirt-dress.jpg', name: 'Belted shirt dress', cat: 'Dresses', season: 'Summer', price: 49, fav: false, segment: 'owned' },
  { src: '/wardrobe/suedette-2-part-block-heel-sandals.jpg', name: 'Block-heel sandals', cat: 'Shoes', season: 'Summer', price: 30, fav: false, segment: 'owned' },
  { src: '/wardrobe/y-sparks-stick-gold-necklace.jpg', name: 'Gold stick necklace', cat: 'Jewellery', season: 'All year', price: 70, fav: false, segment: 'owned' },
  { src: '/wardrobe/moissanite-ring.jpg', name: 'Solitaire ring', cat: 'Jewellery', season: 'All year', price: 70, fav: false, segment: 'owned' },
  { src: '/wardrobe/moissanite-earrings.jpg', name: 'Stud earrings', cat: 'Jewellery', season: 'All year', price: 50, fav: false, segment: 'owned' },
  { src: '/wardrobe/mariam-jacket.jpg', name: 'Linen jacket', cat: 'Outerwear', season: 'Spring · Summer', price: 99, fav: false, segment: 'wishlist' },
];

// ───────────────────────────────────────────────────────────────────────────
// SHELL
// ───────────────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { id: 'wardrobe',    label: 'Wardrobe',       icon: LayoutGrid },
  { id: 'styling',     label: 'Styling Studio', icon: Camera },
  { id: 'lookbook',    label: 'Lookbook',       icon: BookOpen },
  { id: 'inspiration', label: 'Inspiration',    icon: Bookmark },
  { id: 'insights',    label: 'Insights',       icon: PoundSterling },
  { id: 'profile',     label: 'Profile',        icon: Ruler },
  { id: 'directory',   label: 'Directory',      icon: Store },
];

export function StudioFrame({ defaultView = 'wardrobe' }) {
  const [activeView, setActiveView] = useState(defaultView);

  return (
    <div
      className="flex"
      style={{
        minHeight: '720px',
        maxHeight: '880px',
        background: 'var(--atelier-cream)',
      }}
    >
      <Sidebar activeView={activeView} setActiveView={setActiveView} />
      <main
        className="flex-1 overflow-y-auto overflow-x-hidden"
        style={{ background: 'var(--atelier-cream)' }}
      >
        {activeView === 'wardrobe'    && <WardrobeView />}
        {activeView === 'styling'     && <StylingView />}
        {activeView === 'insights'    && <InsightsView />}
        {activeView === 'lookbook'    && <PlaceholderView title="Lookbook"     hint="Curated boards of saved looks, ready to share or wear." />}
        {activeView === 'inspiration' && <PlaceholderView title="Inspiration"  hint="Photos you saved, cross-referenced with your closet." />}
        {activeView === 'profile'     && <PlaceholderView title="Profile"      hint="Measurements, style profile, fit guidance." />}
        {activeView === 'directory'   && <PlaceholderView title="Directory"    hint="A working address book of tailors, cobblers, and ateliers." />}
      </main>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// SIDEBAR
// ───────────────────────────────────────────────────────────────────────────

function Sidebar({ activeView, setActiveView }) {
  return (
    <aside
      className="hidden md:flex flex-col shrink-0"
      style={{
        width: '232px',
        background: 'var(--atelier-cream)',
        borderRight: '1px solid var(--atelier-stone-200)',
        padding: '1.5rem 1.25rem 1.25rem',
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-7 px-2">
        <AtelierMark size={32} />
        <h2
          className="text-lg"
          style={{
            fontFamily: 'var(--atelier-font-display)',
            color: 'var(--atelier-stone-900)',
            fontWeight: 500,
          }}
        >
          Atelier<span style={{ color: 'var(--atelier-brass-text)' }}>.</span>
        </h2>
      </div>

      {/* STUDIO eyebrow */}
      <div className="flex items-center gap-2 mb-3 px-2">
        <BrassRule />
        <p
          className="text-[9px] uppercase font-medium"
          style={{ letterSpacing: '0.24em', color: 'var(--atelier-stone-500)' }}
        >
          Studio
        </p>
      </div>

      {/* Concierge */}
      <button
        type="button"
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-colors mb-1.5"
        style={{ color: 'var(--atelier-stone-700)', background: 'transparent' }}
        onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(212, 179, 120, 0.12)')}
        onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <Sparkles size={15} strokeWidth={1.5} style={{ color: 'var(--atelier-brass-text)' }} />
        <span className="text-[13px] font-medium">Concierge</span>
        <span
          className="ml-auto text-[9px] uppercase font-semibold"
          style={{ letterSpacing: '0.2em', color: 'var(--atelier-brass-text)' }}
        >
          Ask
        </span>
      </button>

      {/* Nav */}
      <nav className="space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveView(item.id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-colors"
              style={{
                background: isActive ? '#ffffff' : 'transparent',
                color: isActive ? 'var(--atelier-stone-900)' : 'var(--atelier-stone-600)',
                cursor: 'pointer',
                boxShadow: isActive ? '0 1px 2px rgba(28,25,23,0.04)' : 'none',
              }}
              onMouseOver={(e) => {
                if (!isActive) e.currentTarget.style.background = 'rgba(168, 162, 158, 0.12)';
              }}
              onMouseOut={(e) => {
                if (!isActive) e.currentTarget.style.background = 'transparent';
              }}
            >
              <Icon size={15} strokeWidth={1.5} />
              <span className="text-[13px] font-medium">{item.label}</span>
              {isActive && (
                <ChevronRight
                  size={13}
                  strokeWidth={1.5}
                  className="ml-auto"
                  style={{ color: 'var(--atelier-stone-500)' }}
                />
              )}
            </button>
          );
        })}
      </nav>

      {/* User row */}
      <div
        className="mt-auto pt-4"
        style={{ borderTop: '1px solid var(--atelier-stone-200)' }}
      >
        <div className="flex items-center gap-3 px-2 py-1.5">
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--atelier-brass-300), var(--atelier-brass-600))',
              color: 'var(--atelier-stone-900)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--atelier-font-display)',
              fontSize: '14px',
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            S
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-medium truncate" style={{ color: 'var(--atelier-stone-900)' }}>
              Sibylle Sherwood
            </p>
            <p className="text-[10px] truncate" style={{ color: 'var(--atelier-stone-500)' }}>
              sibylle.sherwood@gma…
            </p>
          </div>
        </div>
        <button
          type="button"
          className="w-full flex items-center gap-2 mt-1 px-2 py-2 rounded-xl text-[10px] uppercase transition-colors"
          style={{ letterSpacing: '0.22em', color: 'var(--atelier-stone-500)' }}
          onMouseOver={(e) => (e.currentTarget.style.background = 'rgba(168, 162, 158, 0.12)')}
          onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <span style={{ width: 34, display: 'flex', justifyContent: 'center' }}>
            <LogOut size={12} strokeWidth={1.5} />
          </span>
          Sign out
        </button>
      </div>
    </aside>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// WARDROBE VIEW — matches the screenshot 1:1
// ───────────────────────────────────────────────────────────────────────────

const SEGMENTS = [
  { id: 'all',         label: 'All' },
  { id: 'favourites',  label: 'Favourites', star: true },
  { id: 'owned',       label: 'Owned' },
  { id: 'wishlist',    label: 'Wishlist' },
];

const CATEGORIES = ['All', 'Tops', 'Bottoms', 'Dresses', 'Outerwear', 'Sportswear', 'Swimwear', 'Shoes', 'Bags', 'Accessories', 'Jewellery'];

function WardrobeView() {
  const [segment, setSegment] = useState('all');
  const [category, setCategory] = useState('All');

  const filtered = SAMPLE_ITEMS.filter((item) => {
    if (segment === 'favourites' && !item.fav) return false;
    if (segment === 'owned' && item.segment !== 'owned') return false;
    if (segment === 'wishlist' && item.segment !== 'wishlist') return false;
    if (category !== 'All' && item.cat !== category) return false;
    return true;
  });

  return (
    <div
      className="grid grid-cols-1 lg:grid-cols-[1fr_310px] gap-7"
      style={{ padding: '1.75rem 2rem' }}
    >
      {/* ── LEFT: header + toolbar + filters + grid ────────────────────── */}
      <div>
        {/* Editorial header */}
        <header className="flex items-end justify-between gap-6 flex-wrap mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1.5">
              <BrassRule />
              <p
                className="text-[10px] uppercase font-medium"
                style={{ letterSpacing: '0.28em', color: 'var(--atelier-stone-500)' }}
              >
                Good morning, Sibylle
              </p>
            </div>
            <h2
              style={{
                fontFamily: 'var(--atelier-font-display)',
                fontSize: 'clamp(1.75rem, 2.6vw, 2.5rem)',
                lineHeight: 1.05,
                color: 'var(--atelier-stone-900)',
                letterSpacing: '-0.01em',
              }}
            >
              Your Collection
            </h2>
            <p
              className="mt-2 text-[11px] uppercase font-medium"
              style={{ letterSpacing: '0.18em', color: 'var(--atelier-stone-500)' }}
            >
              {SAMPLE_ITEMS.length} Pieces Curated
            </p>
            {/* Ask the Concierge — matches the app's header CTA */}
            <button
              type="button"
              className="flex items-center gap-2 mt-4 px-4 rounded-full"
              style={{
                background: '#ffffff',
                border: '1px solid var(--atelier-stone-200)',
                height: '38px',
                color: 'var(--atelier-stone-800)',
                fontSize: '10px',
                fontWeight: 600,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
              }}
            >
              <Sparkles size={13} strokeWidth={1.75} style={{ color: 'var(--atelier-brass-500)' }} />
              Ask the Concierge
            </button>
          </div>
        </header>

        {/* Toolbar — search + filters + sort + add + select */}
        <div className="flex items-center gap-2.5 mb-5 flex-wrap">
          {/* Search */}
          <div
            className="flex items-center gap-2 px-4 rounded-full flex-1 min-w-[200px]"
            style={{
              background: '#ffffff',
              border: '1px solid var(--atelier-stone-200)',
              height: '40px',
              maxWidth: '320px',
            }}
          >
            <Search size={14} strokeWidth={1.75} style={{ color: 'var(--atelier-stone-500)' }} />
            <input
              type="text"
              placeholder="Search by name, brand, description"
              className="flex-1 bg-transparent outline-none text-[12px]"
              style={{ color: 'var(--atelier-stone-700)' }}
            />
          </div>

          {/* Filters */}
          <button
            type="button"
            className="flex items-center gap-2 px-4 rounded-full"
            style={{
              background: '#ffffff',
              border: '1px solid var(--atelier-stone-200)',
              height: '40px',
              color: 'var(--atelier-stone-700)',
              fontSize: '12px',
              fontWeight: 500,
            }}
          >
            <SlidersHorizontal size={13} strokeWidth={1.75} />
            Filters
          </button>

          {/* Sort */}
          <button
            type="button"
            className="flex items-center gap-2 px-4 rounded-full"
            style={{
              background: '#ffffff',
              border: '1px solid var(--atelier-stone-200)',
              height: '40px',
              color: 'var(--atelier-stone-700)',
              fontSize: '12px',
              fontWeight: 500,
            }}
          >
            <ArrowUpDown size={13} strokeWidth={1.75} />
            Recently added
            <ChevronDown size={13} strokeWidth={1.75} style={{ color: 'var(--atelier-stone-500)' }} />
          </button>

          <div className="flex-1" />

          {/* Add to Collection */}
          <button
            type="button"
            className="flex items-center gap-2 px-5 rounded-full"
            style={{
              background: 'var(--atelier-ink)',
              color: '#ffffff',
              height: '40px',
              fontSize: '12px',
              fontWeight: 500,
            }}
          >
            <Plus size={14} strokeWidth={1.75} />
            Add to Collection
          </button>

          {/* Select */}
          <button
            type="button"
            className="flex items-center px-4 rounded-full text-[10px] uppercase"
            style={{
              background: '#ffffff',
              border: '1px solid var(--atelier-stone-300)',
              height: '40px',
              color: 'var(--atelier-stone-700)',
              letterSpacing: '0.18em',
              fontWeight: 500,
            }}
          >
            Select
          </button>
        </div>

        {/* Segment tab pills — wrapped in a single rounded pill container */}
        <div
          className="inline-flex items-center gap-1 p-1 rounded-full mb-3"
          style={{
            background: '#ffffff',
            border: '1px solid var(--atelier-stone-200)',
          }}
        >
          {SEGMENTS.map((s) => {
            const isActive = segment === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSegment(s.id)}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[10px] uppercase transition-all"
                style={{
                  background: isActive ? 'var(--atelier-stone-100)' : 'transparent',
                  color: isActive ? 'var(--atelier-stone-900)' : 'var(--atelier-stone-500)',
                  letterSpacing: '0.18em',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {s.star && (
                  <Star
                    size={10}
                    strokeWidth={1.75}
                    style={{
                      fill: isActive ? 'var(--atelier-stone-900)' : 'transparent',
                      color: isActive ? 'var(--atelier-stone-900)' : 'var(--atelier-stone-500)',
                    }}
                  />
                )}
                {s.label}
              </button>
            );
          })}
        </div>

        {/* Category chips */}
        <div className="flex flex-wrap gap-1.5 mb-5">
          {CATEGORIES.map((c) => {
            const isActive = category === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className="px-3.5 py-1.5 rounded-full text-[11px] transition-colors"
                style={{
                  background: isActive ? 'var(--atelier-ink)' : '#ffffff',
                  color: isActive ? '#ffffff' : 'var(--atelier-stone-700)',
                  border: `1px solid ${isActive ? 'var(--atelier-ink)' : 'var(--atelier-stone-200)'}`,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                {c}
              </button>
            );
          })}
        </div>

        {/* Item grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-7">
          {filtered.slice(0, 12).map((item, i) => (
            <ItemCard key={i} item={item} />
          ))}
        </div>

        {filtered.length === 0 && (
          <div
            className="rounded-2xl py-12 text-center"
            style={{
              background: '#ffffff',
              border: '1px dashed var(--atelier-stone-300)',
            }}
          >
            <p
              className="text-sm"
              style={{
                fontFamily: 'var(--atelier-font-display)',
                fontStyle: 'italic',
                color: 'var(--atelier-stone-500)',
              }}
            >
              Nothing matches this filter yet.
            </p>
          </div>
        )}
      </div>

      {/* ── RIGHT RAIL: THE DAILY BRIEF (matches the app) ─────────────── */}
      <aside className="hidden lg:flex flex-col gap-3.5">
        <DailyBriefCard />
      </aside>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// THE DAILY BRIEF — right-rail card, matches the app's Wardrobe view
// ───────────────────────────────────────────────────────────────────────────

const BRIEF_PIECES = [
  '/wardrobe/gene-silk-front-vest-top-in-champagne-si.jpg',
  '/wardrobe/pleated-tailored-shorts.jpg',
  '/wardrobe/merisa-gold-wide-fit-block-heel-sandals-.jpg',
  '/wardrobe/gold-vermeil-baroque-pearl-pendant-pearl.jpg',
  '/wardrobe/fine-chain-necklace-24-monica-vinader.jpg',
  '/wardrobe/mirabel-satin-blouse.jpg',
  '/wardrobe/claire-pleat-detail-dress.jpg',
  '/wardrobe/y-sparks-stick-gold-necklace.jpg',
  '/wardrobe/moissanite-earrings.jpg',
  '/wardrobe/riley-pale-pink-silk-front-vest-top.jpg',
];

function DailyBriefCard() {
  return (
    <div
      className="rounded-2xl"
      style={{
        background: '#ffffff',
        border: '1px solid var(--atelier-stone-200)',
        padding: '1.25rem 1.35rem',
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <p
          className="text-[9px] uppercase font-bold"
          style={{ letterSpacing: '0.22em', color: 'var(--atelier-stone-500)' }}
        >
          The Daily Brief
        </p>
        <p className="text-[9px]" style={{ letterSpacing: '0.04em', color: 'var(--atelier-stone-500)' }}>
          100% confidence
        </p>
      </div>

      <h3
        style={{
          fontFamily: 'var(--atelier-font-display)',
          fontSize: '1.5rem',
          lineHeight: 1.1,
          color: 'var(--atelier-stone-900)',
          marginBottom: 10,
        }}
      >
        Styled for today.
      </h3>

      <p
        style={{
          fontFamily: 'var(--atelier-font-display)',
          fontStyle: 'italic',
          fontSize: '12.5px',
          lineHeight: 1.6,
          color: 'var(--atelier-stone-500)',
          marginBottom: 14,
        }}
      >
        A champagne silk vest over pleated tailored shorts — a quiet neutral base lifted
        by gold block-heel sandals and a stack of fine gold and pearl jewellery.
        Composed for today's warm, dry afternoon.
      </p>

      <div className="grid grid-cols-5 gap-1.5">
        {BRIEF_PIECES.map((src, i) => (
          <div
            key={i}
            style={{
              aspectRatio: '1',
              borderRadius: 8,
              overflow: 'hidden',
              background: 'var(--atelier-stone-100)',
              border: '1px solid var(--atelier-stone-200)',
            }}
          >
            <Pic src={src} alt="" loading="lazy" className="w-full h-full object-cover" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// ITEM CARD (in the wardrobe grid)
// ───────────────────────────────────────────────────────────────────────────

function ItemCard({ item }) {
  return (
    <article className="group cursor-pointer">
      <div
        className="aspect-[3/4] rounded-2xl relative overflow-hidden mb-3"
        style={{
          background: '#ffffff',
          boxShadow: '0 4px 16px -6px rgba(28,25,23,0.06), 0 1px 2px rgba(28,25,23,0.04)',
        }}
      >
        {/* Brass circle favourite badge */}
        {item.fav && (
          <div
            className="absolute top-2.5 right-2.5 z-10 flex items-center justify-center"
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: 'var(--atelier-brass-300)',
              boxShadow: '0 1px 3px rgba(28,25,23,0.12)',
            }}
          >
            <Star
              size={12}
              strokeWidth={1.5}
              style={{
                fill: 'var(--atelier-stone-900)',
                color: 'var(--atelier-stone-900)',
              }}
            />
          </div>
        )}
        <Pic
          src={item.src}
          alt={item.name}
          loading="lazy"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {/* Photo dots affordance */}
        <div
          className="absolute bottom-2.5 left-1/2 flex gap-1 px-2 py-1 rounded-full"
          style={{
            transform: 'translateX(-50%)',
            background: 'rgba(28,25,23,0.28)',
            backdropFilter: 'blur(4px)',
          }}
        >
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              style={{
                width: 4,
                height: 4,
                borderRadius: '50%',
                background: i === 0 ? '#ffffff' : 'rgba(255,255,255,0.45)',
              }}
            />
          ))}
        </div>
      </div>

      {/* Caption */}
      <div className="flex justify-between items-start gap-2 mb-1">
        <p
          className="text-[9px] uppercase truncate flex-1 font-semibold"
          style={{ letterSpacing: '0.18em', color: 'var(--atelier-stone-500)' }}
        >
          {item.season}
        </p>
        <p
          className="text-[11px] font-medium shrink-0"
          style={{ color: 'var(--atelier-stone-900)' }}
        >
          £{item.price}
        </p>
      </div>
      <h3
        className="text-[14px] leading-snug truncate"
        style={{ fontFamily: 'var(--atelier-font-display)', color: 'var(--atelier-stone-800)' }}
      >
        {item.name}
      </h3>
      <p className="text-[10px] mt-0.5" style={{ color: 'var(--atelier-stone-500)' }}>
        {item.cat}
      </p>
    </article>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// RIGHT RAIL CARDS
// ───────────────────────────────────────────────────────────────────────────

function TodayCard() {
  const [busy, setBusy] = useState(false);
  const [suggested, setSuggested] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => () => timerRef.current && clearTimeout(timerRef.current), []);

  const handleSuggest = () => {
    if (busy) return;
    setBusy(true);
    setSuggested(false);
    timerRef.current = setTimeout(() => {
      setBusy(false);
      setSuggested(true);
    }, 1300);
  };

  return (
    <div
      className="rounded-2xl relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, var(--atelier-ink) 0%, #292524 100%)',
        color: '#ffffff',
        padding: '1.1rem 1.25rem',
      }}
    >
      <div
        className="absolute -right-10 -top-10 pointer-events-none"
        style={{ opacity: 0.06, transform: 'rotate(12deg)' }}
      >
        <Sparkles size={180} strokeWidth={0.8} />
      </div>

      <div className="relative">
        <p
          className="text-[9px] uppercase font-bold mb-0.5"
          style={{ letterSpacing: '0.24em', color: 'var(--atelier-stone-500)' }}
        >
          Today
        </p>
        <p
          className="text-base"
          style={{
            fontFamily: 'var(--atelier-font-display)',
            color: '#ffffff',
            lineHeight: 1.3,
          }}
        >
          15&ndash;27°C &nbsp;·&nbsp; Partly cloudy
        </p>

        <button
          type="button"
          onClick={handleSuggest}
          disabled={busy}
          className="w-full mt-3 text-[10px] uppercase px-4 py-2.5 rounded-full flex items-center justify-center gap-2 font-medium transition-colors"
          style={{
            background: 'var(--atelier-brass-300)',
            color: 'var(--atelier-stone-900)',
            letterSpacing: '0.18em',
            opacity: busy ? 0.6 : 1,
            cursor: busy ? 'default' : 'pointer',
          }}
        >
          <Wand2
            size={12}
            strokeWidth={1.5}
            style={{ animation: busy ? 'spin-tw 1.4s linear infinite' : 'none' }}
          />
          {busy ? 'Composing…' : suggested ? 'Refresh suggestion' : 'Suggest a look'}
        </button>

        {suggested && (
          <div
            className="mt-2.5 rounded-xl p-2.5 flex items-center gap-2.5"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.08)',
              animation: 'fade-up-tw 400ms ease',
            }}
          >
            <div className="grid grid-cols-2 grid-rows-2 gap-0.5 shrink-0 rounded-md overflow-hidden" style={{ width: 36, height: 36 }}>
              {[SAMPLE_ITEMS[1].src, SAMPLE_ITEMS[3].src, SAMPLE_ITEMS[11].src, SAMPLE_ITEMS[13].src].map((src, i) => (
                <Pic key={i} src={src} alt="" loading="lazy" className="w-full h-full object-cover" />
              ))}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[8px] uppercase" style={{ letterSpacing: '0.2em', color: 'var(--atelier-stone-500)' }}>
                4 pieces · 92% confidence
              </p>
              <p className="text-[11px] mt-0.5 truncate" style={{ fontFamily: 'var(--atelier-font-display)' }}>
                Soft volume, sharp below
              </p>
            </div>
            <ChevronRight size={12} strokeWidth={1.5} style={{ color: 'var(--atelier-stone-500)' }} />
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin-tw { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fade-up-tw { from { opacity: 0; transform: translateY(0.4rem); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}

function NeedsAttentionCard() {
  const rows = [
    {
      icon: Star,
      iconBg: 'var(--atelier-stone-100)',
      iconFg: 'var(--atelier-stone-700)',
      title: 'Fine-knit jumper',
      sub: 'Favourite · 18 days since last wear',
    },
    {
      icon: Bookmark,
      iconBg: 'var(--atelier-stone-100)',
      iconFg: 'var(--atelier-stone-700)',
      title: '11 inspirations waiting',
      sub: 'Open the board to analyse them with AI',
    },
  ];

  return (
    <div
      className="rounded-2xl"
      style={{
        background: '#ffffff',
        border: '1px solid var(--atelier-stone-200)',
        padding: '1rem 1.1rem',
      }}
    >
      <div className="flex items-baseline justify-between mb-2">
        <h3
          className="text-[14px]"
          style={{ fontFamily: 'var(--atelier-font-display)', color: 'var(--atelier-stone-900)' }}
        >
          Needs attention
        </h3>
        <span
          className="text-[9px] uppercase"
          style={{ letterSpacing: '0.22em', color: 'var(--atelier-stone-500)' }}
        >
          {rows.length} items
        </span>
      </div>
      <ul className="space-y-0.5">
        {rows.map((row, i) => {
          const Icon = row.icon;
          return (
            <li key={i}>
              <button
                type="button"
                className="w-full flex items-center gap-2.5 py-1.5 px-1.5 rounded-xl text-left transition-colors"
                onMouseOver={(e) => (e.currentTarget.style.background = 'var(--atelier-stone-50)')}
                onMouseOut={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <span
                  className="shrink-0 flex items-center justify-center rounded-lg"
                  style={{
                    width: 28,
                    height: 28,
                    background: row.iconBg,
                    color: row.iconFg,
                  }}
                >
                  <Icon size={13} strokeWidth={1.5} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] truncate" style={{ color: 'var(--atelier-stone-900)' }}>
                    {row.title}
                  </p>
                  <p className="text-[10px] truncate" style={{ color: 'var(--atelier-stone-500)' }}>
                    {row.sub}
                  </p>
                </div>
                <ChevronRight
                  size={12}
                  strokeWidth={1.5}
                  style={{ color: 'var(--atelier-stone-300)', flexShrink: 0 }}
                />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function TodaysPickCard() {
  const pick = SAMPLE_ITEMS.find((i) => i.fav) || SAMPLE_ITEMS[0];
  return (
    <div
      className="rounded-2xl overflow-hidden flex items-stretch"
      style={{
        background: 'linear-gradient(135deg, var(--atelier-ink) 0%, #1f1c1a 100%)',
        color: '#ffffff',
      }}
    >
      <Pic
        src={pick.src}
        alt={pick.name}
        loading="lazy"
        style={{
          width: 110,
          height: 'auto',
          objectFit: 'cover',
          flexShrink: 0,
        }}
      />
      <div className="flex-1 px-4 py-3.5 flex flex-col justify-center min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <BrassRule />
          <p
            className="text-[9px] uppercase font-bold"
            style={{ letterSpacing: '0.24em', color: 'var(--atelier-brass-300)' }}
          >
            Today's Pick
          </p>
        </div>
        <p
          className="text-[15px] mb-0.5 truncate"
          style={{ fontFamily: 'var(--atelier-font-display)', lineHeight: 1.2 }}
        >
          {pick.name}
        </p>
        <p
          className="text-[10px] truncate"
          style={{ color: 'var(--atelier-stone-500)' }}
        >
          {pick.cat} · {pick.season}
        </p>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// STYLING VIEW (preserved from the previous build — interactive composer)
// ───────────────────────────────────────────────────────────────────────────

const OUTFITS = [
  {
    key: 'lunch',
    label: 'A summer lunch',
    items: [
      { slot: 'Top',       name: 'Champagne silk vest',   src: '/wardrobe/gene-silk-front-vest-top-in-champagne-si.jpg' },
      { slot: 'Bottom',    name: 'Linen shorts',          src: '/wardrobe/amalfi-linen-short.jpg' },
      { slot: 'Footwear',  name: 'Gold block-heel sandals', src: '/wardrobe/merisa-gold-wide-fit-block-heel-sandals-.jpg' },
      { slot: 'Accessory', name: 'Fine chain necklace',   src: '/wardrobe/fine-chain-necklace-24-monica-vinader.jpg' },
    ],
    note: 'Champagne silk against pale linen, warmed by the gold of the sandals and the necklace. One tonal family, read as a single decision.',
    confidence: 93,
  },
  {
    key: 'evening',
    label: 'An evening out',
    items: [
      { slot: 'Dress',     name: 'Pleat-detail dress',    src: '/wardrobe/claire-pleat-detail-dress.jpg' },
      { slot: 'Outerwear', name: 'Single-breasted blazer', src: '/wardrobe/marina-single-breasted-blazer.jpg' },
      { slot: 'Footwear',  name: 'Block-heel sandals',    src: '/wardrobe/suedette-2-part-block-heel-sandals.jpg' },
      { slot: 'Accessory', name: 'Baroque pearl pendant', src: '/wardrobe/gold-vermeil-baroque-pearl-pendant-pearl.jpg' },
    ],
    note: 'The blazer sharpens the dress; the pearl keeps it soft. Tailoring and silk in the same breath.',
    confidence: 90,
  },
  {
    key: 'weekend',
    label: 'A Saturday in town',
    items: [
      { slot: 'Top',       name: 'Striped cardigan',      src: '/wardrobe/robin-stripe-cardigan.jpg' },
      { slot: 'Bottom',    name: 'High-rise denim shorts', src: '/wardrobe/high-rise-denim-shorts.jpg' },
      { slot: 'Footwear',  name: 'Gold block-heel sandals', src: '/wardrobe/merisa-gold-wide-fit-block-heel-sandals-.jpg' },
      { slot: 'Accessory', name: 'Gold stick necklace',   src: '/wardrobe/y-sparks-stick-gold-necklace.jpg' },
    ],
    note: 'Denim lifted by a fine-knit cardigan and a little gold. Easy, but considered.',
    confidence: 88,
  },
];

function StylingView() {
  const [activeIdx, setActiveIdx] = useState(0);
  const [revealed, setRevealed] = useState(4);
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
    }, 260);
  };

  const current = OUTFITS[activeIdx];

  return (
    <div style={{ padding: '1.75rem 2rem' }}>
      <ViewHeader eyebrow="By Atelier Concierge" title="Style for the occasion." />

      <div className="flex flex-wrap gap-2 mb-7">
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
                background: active ? 'var(--atelier-ink)' : '#ffffff',
                color: active ? '#ffffff' : 'var(--atelier-stone-700)',
                border: `1px solid ${active ? 'var(--atelier-ink)' : 'var(--atelier-stone-200)'}`,
                cursor: busy ? 'default' : 'pointer',
                opacity: busy && !active ? 0.5 : 1,
                fontWeight: 500,
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        {current.items.map((item, i) => {
          const isRevealed = i < revealed;
          return (
            <div key={`${current.key}-${i}`} className="flex flex-col gap-2">
              <div
                className="aspect-[3/4] rounded-xl relative overflow-hidden"
                style={{
                  background: isRevealed ? 'var(--atelier-stone-100)' : 'transparent',
                  border: isRevealed ? 'none' : '1.5px dashed var(--atelier-stone-300)',
                }}
              >
                {!isRevealed && (
                  <div
                    className="absolute inset-0 flex items-center justify-center text-[9px] uppercase"
                    style={{ letterSpacing: '0.22em', color: 'var(--atelier-stone-500)', fontWeight: 500 }}
                  >
                    {item.slot}
                  </div>
                )}
                {isRevealed && (
                  <Pic
                    src={item.src}
                    alt={item.name}
                    className="w-full h-full object-cover"
                    style={{ animation: 'slot-in-tw 450ms ease-out' }}
                  />
                )}
              </div>
              {isRevealed && (
                <div style={{ animation: 'fade-in-tw 500ms ease-out 80ms both' }}>
                  <p
                    className="text-[9px] uppercase font-semibold"
                    style={{ letterSpacing: '0.2em', color: 'var(--atelier-stone-500)' }}
                  >
                    {item.slot}
                  </p>
                  <p
                    className="text-xs mt-0.5 truncate"
                    style={{ fontFamily: 'var(--atelier-font-display)', color: 'var(--atelier-stone-800)' }}
                  >
                    {item.name}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div
        className="rounded-xl flex flex-col md:flex-row md:items-center gap-5 md:gap-6"
        style={{
          background: '#ffffff',
          border: '1px solid var(--atelier-stone-200)',
          padding: '1.1rem 1.5rem',
          opacity: revealed >= 4 ? 1 : 0,
          transform: revealed >= 4 ? 'translateY(0)' : 'translateY(0.5rem)',
          transition: 'opacity 500ms ease, transform 500ms ease',
        }}
      >
        <Wand2 size={20} strokeWidth={1.3} style={{ color: 'var(--atelier-brass-text)', flexShrink: 0 }} />
        <div className="flex-1">
          <p
            className="text-[9px] uppercase mb-1"
            style={{ letterSpacing: '0.22em', color: 'var(--atelier-stone-500)', fontWeight: 600 }}
          >
            Stylist's note
          </p>
          <p
            className="text-xs md:text-sm"
            style={{
              fontFamily: 'var(--atelier-font-display)',
              fontStyle: 'italic',
              color: 'var(--atelier-stone-800)',
              lineHeight: 1.55,
              maxWidth: '58ch',
            }}
          >
            {current.note}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p
            className="text-[9px] uppercase"
            style={{ letterSpacing: '0.22em', color: 'var(--atelier-stone-500)', fontWeight: 600 }}
          >
            Confidence
          </p>
          <p
            className="text-2xl mt-0.5"
            style={{
              fontFamily: 'var(--atelier-font-display)',
              color: 'var(--atelier-stone-900)',
              fontFeatureSettings: '"onum" on',
              lineHeight: 1,
            }}
          >
            {current.confidence}
            <span style={{ fontSize: '0.6em', color: 'var(--atelier-stone-500)' }}>%</span>
          </p>
        </div>
      </div>

      <style>{`
        @keyframes slot-in-tw { from { opacity: 0; transform: scale(1.04); } to { opacity: 1; transform: scale(1); } }
        @keyframes fade-in-tw { from { opacity: 0; transform: translateY(0.25rem); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// INSIGHTS VIEW (manifesto + cost-per-wear)
// ───────────────────────────────────────────────────────────────────────────

const MANIFESTO_VARIANTS = [
  {
    label: 'Quiet, considered',
    date: '18 June 2026',
    text: `You dress in the colours of considered absence: stone, ink, cream, with brass at the wrist as the only ornament. The silhouettes you reach for are quiet ones, a tailored shoulder, an unfussy trouser, a coat that holds its line.

The pieces you wear most are the ones whose construction you can feel. The wool-blend trousers have been worn seventy times this year; the pleat-detail dress has not.

What you are missing, judging by your saved inspirations, is one piece of softness against the structure.`,
  },
  {
    label: 'Colour-forward',
    date: '2 May 2026',
    text: `You wear colour the way other people wear neutrals. Emerald, plum, ochre, the occasional cobalt; none of it accidental. The silhouettes that flatter you most are also the boldest.

The green silk dress has earned its keep five times over. The plum knit has become a near-uniform on autumn Tuesdays.

The gap, if there is one, is in what holds the colour together. Your wardrobe could carry one more anchoring piece in cream or stone.`,
  },
  {
    label: 'Tailored classic',
    date: '14 March 2026',
    text: `Your wardrobe reads as a long argument with itself, won by the side of restraint. Navy, charcoal, ivory, with grey wool in winter and crisp poplin in summer.

The wool trousers have been worn forty-eight times this year. The white shirt fifty-two.

There is room here for one well-chosen piece of softness. A camel coat. A loose cashmere.`,
  },
];

function InsightsView() {
  const [variantIdx, setVariantIdx] = useState(0);
  const [displayText, setDisplayText] = useState(MANIFESTO_VARIANTS[0].text);
  const [busy, setBusy] = useState(false);
  const streamRef = useRef(null);

  useEffect(() => () => streamRef.current && clearInterval(streamRef.current), []);

  const refresh = () => {
    if (busy) return;
    setBusy(true);
    setDisplayText('');
    setTimeout(() => {
      const nextIdx = (variantIdx + 1) % MANIFESTO_VARIANTS.length;
      setVariantIdx(nextIdx);
      const fullText = MANIFESTO_VARIANTS[nextIdx].text;
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

  const current = MANIFESTO_VARIANTS[variantIdx];

  const bestCPW = [
    { src: '/wardrobe/gael-wool-blend-trousers.jpg', name: 'Wool-blend trousers', cat: 'Bottoms', wears: 48, cpw: 2.29 },
    { src: '/wardrobe/reg-classic-button-down-blouse.jpg', name: 'Button-down blouse', cat: 'Tops', wears: 40, cpw: 2.48 },
    { src: '/wardrobe/robin-jumper.jpg', name: 'Fine-knit jumper', cat: 'Tops', wears: 36, cpw: 2.19 },
  ];
  const worstCPW = [
    { src: '/wardrobe/claire-pleat-detail-dress.jpg', name: 'Pleat-detail dress', cat: 'Dresses', wears: 3, cpw: 75.0 },
    { src: '/wardrobe/gold-vermeil-baroque-pearl-pendant-pearl.jpg', name: 'Baroque pearl pendant', cat: 'Jewellery', wears: 2, cpw: 37.5 },
  ];

  return (
    <div style={{ padding: '1.75rem 2rem' }}>
      <ViewHeader greeting="Good morning, Sibylle." eyebrow="Insights" title="What your wardrobe is telling you." />

      <div
        className="rounded-2xl overflow-hidden relative mb-6"
        style={{
          background: 'var(--atelier-ink)',
          color: '#ffffff',
          padding: 'clamp(1.25rem, 2vw, 1.75rem)',
        }}
      >
        <div className="flex items-start justify-between gap-4 flex-wrap mb-1">
          <div>
            <div className="flex items-center gap-2.5 mb-2">
              <BrassRule />
              <span className="text-[10px] uppercase font-medium" style={{ letterSpacing: '0.24em', color: 'var(--atelier-brass-300)' }}>
                By Atelier Concierge
              </span>
            </div>
            <h3 className="text-2xl" style={{ fontFamily: 'var(--atelier-font-display)', lineHeight: 1.1 }}>
              Style manifesto
            </h3>
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={busy}
            className="text-[11px] uppercase px-4 py-2 rounded-full flex items-center gap-2 font-medium shrink-0"
            style={{
              background: 'var(--atelier-brass-300)',
              color: 'var(--atelier-stone-900)',
              letterSpacing: '0.12em',
              opacity: busy ? 0.5 : 1,
              cursor: busy ? 'default' : 'pointer',
            }}
          >
            <Wand2 size={12} strokeWidth={1.5} style={{ animation: busy ? 'spin-iw 1.4s linear infinite' : 'none' }} />
            {busy ? 'Writing…' : 'Refresh'}
          </button>
        </div>
        <div
          className="mt-4 rounded-xl"
          style={{
            background: 'var(--atelier-cream)',
            color: 'var(--atelier-stone-800)',
            padding: '1.25rem 1.5rem',
            minHeight: '12rem',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--atelier-font-display)',
              fontStyle: 'italic',
              fontSize: '0.9rem',
              lineHeight: 1.75,
              whiteSpace: 'pre-line',
              maxWidth: '58ch',
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
                  color: 'var(--atelier-brass-text)',
                  animation: 'blink-iw 1s steps(2, start) infinite',
                  fontStyle: 'normal',
                }}
              >
                ▍
              </span>
            )}
          </div>
          {!busy && (
            <p
              className="text-[9px] uppercase mt-3 flex items-center gap-2"
              style={{ letterSpacing: '0.24em', color: 'var(--atelier-stone-500)', fontWeight: 500 }}
            >
              <BrassRule />
              Written {current.date} · {current.label}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <CPWCard icon={TrendingUp} title="Best value · cost per wear" accent="#047857" items={bestCPW} />
        <CPWCard icon={Clock}      title="Wear them more"             accent="var(--atelier-brass-600)" items={worstCPW} />
      </div>

      <style>{`
        @keyframes blink-iw { 50% { opacity: 0; } }
        @keyframes spin-iw { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function CPWCard({ icon: Icon, title, accent, items }) {
  return (
    <div
      className="rounded-2xl"
      style={{
        background: '#ffffff',
        border: '1px solid var(--atelier-stone-200)',
        padding: '1.1rem 1.25rem',
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <Icon size={14} strokeWidth={1.5} style={{ color: accent }} />
        <h4 className="text-sm" style={{ fontFamily: 'var(--atelier-font-display)', color: 'var(--atelier-stone-900)' }}>
          {title}
        </h4>
      </div>
      <ul className="space-y-2.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-2.5">
            <Pic
              src={item.src}
              alt={item.name}
              loading="lazy"
              style={{ width: 36, height: 46, borderRadius: '6px', objectFit: 'cover', background: 'var(--atelier-stone-100)' }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] truncate" style={{ fontFamily: 'var(--atelier-font-display)', color: 'var(--atelier-stone-800)' }}>
                {item.name}
              </p>
              <p className="text-[9px] uppercase" style={{ letterSpacing: '0.16em', color: 'var(--atelier-stone-500)', fontWeight: 500 }}>
                {item.cat} · {item.wears} wears
              </p>
            </div>
            <p className="text-[15px] shrink-0" style={{ fontFamily: 'var(--atelier-font-display)', color: accent, fontFeatureSettings: '"onum" on' }}>
              £{item.cpw.toFixed(2)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// SHARED
// ───────────────────────────────────────────────────────────────────────────

function ViewHeader({ greeting, eyebrow, title }) {
  return (
    <div className="mb-6">
      {greeting && (
        <p
          className="mb-2"
          style={{
            fontFamily: 'var(--atelier-font-display)',
            fontStyle: 'italic',
            fontSize: '0.9rem',
            color: 'var(--atelier-stone-500)',
          }}
        >
          {greeting}
        </p>
      )}
      <div className="flex items-center gap-3 mb-2">
        <BrassRule />
        <p className="text-[10px] uppercase font-semibold" style={{ letterSpacing: '0.24em', color: 'var(--atelier-stone-500)' }}>
          {eyebrow}
        </p>
      </div>
      <h2
        className="text-3xl md:text-4xl"
        style={{ fontFamily: 'var(--atelier-font-display)', lineHeight: 1.05, color: 'var(--atelier-stone-900)' }}
      >
        {title}
      </h2>
    </div>
  );
}

function PlaceholderView({ title, hint }) {
  return (
    <div style={{ padding: '1.75rem 2rem' }}>
      <ViewHeader eyebrow="Coming soon in this preview" title={title} />
      <div
        className="rounded-2xl p-12 text-center"
        style={{ background: '#ffffff', border: '1px dashed var(--atelier-stone-300)' }}
      >
        <p
          className="text-sm"
          style={{
            fontFamily: 'var(--atelier-font-display)',
            fontStyle: 'italic',
            color: 'var(--atelier-stone-500)',
            maxWidth: '52ch',
            marginInline: 'auto',
          }}
        >
          {hint}
        </p>
      </div>
    </div>
  );
}
