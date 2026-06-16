import React, { useState, useEffect, useMemo, createContext, useContext, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Shirt, LayoutGrid, Plus, Link as LinkIcon, Trash2,
  Heart, PoundSterling, Ruler, Store, CheckCircle2, AlertCircle, X, Camera, Save,
  Wand2, ChevronRight, ChevronDown, ChevronUp, LogOut, Calendar, TrendingDown, Star, Download, Sparkles, GripVertical, SlidersHorizontal, Bookmark, Check, Copy, ArrowUpDown, Search, Share2
} from 'lucide-react';
import {
  DndContext, useDraggable, useDroppable, PointerSensor, TouchSensor, KeyboardSensor,
  useSensor, useSensors, DragOverlay, closestCenter,
} from '@dnd-kit/core';
import { doc, setDoc, deleteDoc, onSnapshot, collection, writeBatch, getDocs, getDoc } from 'firebase/firestore';
import { auth, db, onAuthStateChanged, signInWithGoogle, signOutUser, geminiText, geminiTextVision, isAIEnabled } from './firebase.js';

const SEASONS = ['All Seasons', 'Spring', 'Summer', 'Autumn', 'Winter'];
const TOP_SUBCATEGORIES = ['T-Shirts', 'Blouses', 'Shirts', 'Sleeveless', 'Jumpers', 'Sweaters', 'Cardigans', 'Hoodies', 'Sweatshirts', 'Vests', 'Other'];
const OUTERWEAR_SUBCATEGORIES = ['Blazers', 'Coats', 'Jackets', 'Trench Coats', 'Puffer Jackets', 'Parkas', 'Capes', 'Gilets', 'Leather Jackets', 'Other'];
const DRESS_SUBCATEGORIES = ['Mini', 'Midi', 'Maxi', 'Wrap', 'Shift', 'Bodycon', 'Shirt Dress', 'Knit Dress', 'Cocktail', 'Evening / Gown', 'Sundress', 'Slip Dress', 'Other'];
const ACCESSORY_SUBCATEGORIES = ['Sunglasses', 'Sun Hats', 'Hats', 'Belts', 'Scarves', 'Gloves', 'Other'];
const JEWELLERY_SUBCATEGORIES = ['Necklaces', 'Pendants', 'Earrings', 'Rings', 'Bracelets', 'Watches', 'Brooches', 'Other'];
const SPORTSWEAR_SUBCATEGORIES = ['Running', 'Gym', 'Yoga', 'Hiking', 'Swimming', 'Cycling', 'Tennis', 'Other'];
const BAG_SUBCATEGORIES = ['Handbag', 'Crossbody', 'Tote', 'Clutch', 'Backpack', 'Weekend', 'Wallet', 'Other'];
const SHOE_SUBCATEGORIES = ['Sneakers', 'Sandals', 'Wedges', 'Loafers', 'Heels', 'Ankle Boots', 'Boots', 'Flats', 'Other'];
const SWIMWEAR_SUBCATEGORIES = ['Bikini', 'Swimsuit', 'Tankini', 'Bandeau', 'Swim Shorts', 'Cover-up', 'Kaftan', 'Sarong', 'Beach Dress', 'Rash Vest', 'Other'];
const STYLES = ['Smart', 'Casual', 'Work', 'Occasion', 'Leisure', 'Sport'];
const MOOD_PRESETS = [
  'Weekend brunch', 'Office day', 'Important meeting', 'Dinner date',
  'Wedding guest', 'Travel day', 'Lazy Sunday', 'Cocktail evening',
];

const INITIAL_MEASUREMENTS = { height: '', weight: '', chest: '', waist: '', hips: '', shoeSize: '' };
// Style profile — populated by the quiz; fed into every Gemini prompt.
const STYLE_UNDERTONES = ['Cool', 'Warm', 'Neutral'];
const STYLE_SILHOUETTES = ['Hourglass', 'Pear', 'Apple', 'Rectangle', 'Inverted triangle', 'Athletic'];
const STYLE_FORMALITY = ['Casual-leaning', 'Smart-casual', 'Polished', 'Formal'];
const STYLE_SEASONS = ['Spring', 'Summer', 'Autumn', 'Winter']; // Seasonal colour analysis
const STYLE_PRINCIPLES = [
  'Neutral base with a single statement colour',
  'Tonal layering · monochrome stories',
  'Bold prints and pattern mixing',
  'Soft romantic · texture-led',
  'Sharp tailoring · architectural',
  'Effortless coastal · linen / cotton',
];

// Owners can invite/revoke other users. Must match the rules file exactly.
// (The rules are the real security boundary — this is just so the UI knows
//  whether to show the Invite panel.)
// Set via VITE_OWNER_EMAILS in .env.local — comma-separated list of emails.
// Empty by default so a fresh fork doesn't unintentionally trust anyone.
const OWNER_EMAILS = (import.meta.env.VITE_OWNER_EMAILS || '')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

// Seeded into a new user's directory on first sign-in, and available via
// "Restore preset brands" in the Directory page for existing users.
// Edit / extend whenever you want different defaults.
const SHOP_SEEDS = [
  // Designer brands
  { name: '& Other Stories', url: 'https://www.stories.com', category: 'Trend-led' },
  { name: 'Adidas', url: 'https://www.adidas.co.uk', category: 'Sportswear' },
  { name: 'All Saints', url: 'https://www.allsaints.com', category: 'Modern Edgy' },
  { name: 'Barbour', url: 'https://www.barbour.com', category: 'British Heritage Country' },
  { name: 'Cartier', url: 'https://www.cartier.com', category: 'Luxury Jewellery & Watches' },
  { name: 'Chanel', url: 'https://www.chanel.com', category: 'Luxury Couture' },
  { name: 'COS', url: 'https://www.cos.com', category: 'Minimalist Modern' },
  { name: 'Hobbs', url: 'https://www.hobbs.com', category: 'British Workwear' },
  { name: 'Holland Cooper', url: 'https://www.hollandcooper.com', category: 'Luxury Heritage' },
  { name: 'Mango', url: 'https://shop.mango.com/gb', category: 'Trend-led High Street' },
  { name: 'ME+EM', url: 'https://www.meandem.com', category: 'British Modern' },
  { name: 'Monica Vinader', url: 'https://www.monicavinader.com', category: 'Fine Jewellery' },
  { name: 'Mountain Warehouse', url: 'https://www.mountainwarehouse.com', category: 'Outdoor Activewear' },
  { name: 'Nike', url: 'https://www.nike.com/gb', category: 'Sportswear' },
  { name: 'Ralph Lauren', url: 'https://www.ralphlauren.co.uk', category: 'American Heritage Preppy' },
  { name: 'Reformation', url: 'https://www.thereformation.com', category: 'Sustainable' },
  { name: 'Reiss', url: 'https://www.reiss.com', category: 'Modern Tailoring' },
  { name: 'Sézane', url: 'https://www.sezane.com', category: 'French Romantic' },
  { name: 'Sweaty Betty', url: 'https://www.sweatybetty.com', category: 'Activewear Premium' },
  { name: 'Tommy Hilfiger', url: 'https://uk.tommy.com', category: 'American Preppy' },
  { name: 'Topshop', url: 'https://www.topshop.com', category: 'Trend-led High Street' },
  { name: 'Veja', url: 'https://www.veja-store.com', category: 'Sustainable Sneakers' },

  // Multi-brand boutiques & department stores
  { name: 'Debenhams', url: 'https://www.debenhams.com', category: 'Department Store' },
  { name: 'Fenwick', url: 'https://www.fenwick.co.uk', category: 'Department Store' },
  { name: 'John Lewis', url: 'https://www.johnlewis.com', category: 'Department Store' },
  { name: 'Lodgeway Countrywear', url: 'https://www.lodgewaycountrywear.co.uk', category: 'Countrywear Multi-brand' },
  { name: 'Net-a-Porter', url: 'https://www.net-a-porter.com', category: 'Luxury Multi-brand' },
  { name: 'Norton Barrie', url: 'https://www.nortonbarrie.co.uk', category: 'Designer Multi-brand' },
  { name: 'Oxygen Clothing', url: 'https://www.oxygenclothing.co.uk', category: 'Designer Multi-brand' },
  { name: 'Zalando', url: 'https://www.zalando.co.uk', category: 'Online Multi-brand' },
];
const CATEGORIES = ['All', 'Tops', 'Bottoms', 'Dresses', 'Outerwear', 'Sportswear', 'Swimwear', 'Shoes', 'Bags', 'Accessories', 'Jewellery'];

const newId = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 11));

// Items historically used `season` (string). New items use `seasons` (array).
// This normalises both shapes for read paths so we don't lose data.
function itemStyles(item) {
  if (Array.isArray(item?.styles)) return item.styles;
  return [];
}

// Normalises legacy `imageUrl` (single) and new `images` (array) shapes.
function itemImages(item) {
  if (Array.isArray(item?.images) && item.images.length > 0) return item.images;
  if (item?.imageUrl) return [item.imageUrl];
  return [];
}

const todayISO = () => new Date().toISOString().slice(0, 10);

const CURRENCY_SYMBOLS = { GBP: '£', USD: '$', EUR: '€', JPY: '¥', AUD: 'A$', CAD: 'C$' };
function formatPrice(amount, currency = 'GBP') {
  const symbol = CURRENCY_SYMBOLS[currency] || '£';
  const n = Number(amount || 0);
  return `${symbol}${n.toLocaleString()}`;
}

const AI_TEMPERATURE_PRESETS = { safe: 0.3, balanced: 0.7, surprise: 1.0 };

// Tiny a11y hook: closes a modal when the user hits Escape. Mount once per
// modal — multiple stacked modals receive the event in mount order, so the
// outermost-rendered closes last. Skipped when typing in an input field if
// the user is mid-edit (avoids ejecting them out of a date picker etc).
function useEscapeKey(onClose) {
  useEffect(() => {
    if (!onClose) return;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      const t = e.target;
      const tag = t?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      e.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
}

// Brief vibration on confirmable actions (save, log-wear, favourite, scan).
// Skipped if the OS reports reduced motion, if the Vibration API isn't
// available, or on desktop where there's no haptic motor. `kind` selects a
// pattern; defaults to a single short tap.
function haptic(kind = 'tap') {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const patterns = {
      tap: 15,
      success: [18, 40, 18],
      error: [50, 80, 50],
    };
    navigator.vibrate(patterns[kind] || patterns.tap);
  } catch { /* iOS Safari may throw — swallow */ }
}

// Atelier monogram — wire-hanger silhouette with a brass charm hanging from
// the bar. Universal wardrobe-app vocabulary plus the brass-detail signature.
// Mirrors /public/icon.svg exactly so the brand mark reads the same
// everywhere (favicon, sidebar, sign-in, public share viewer).
function AtelierMark({ size = 40 }) {
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

// Editorial section header. Pattern: brass rule + small-caps eyebrow + Playfair
// title + optional muted subtitle. Used at the top of every primary tab view
// to give the app a unified printed-magazine voice.
function EditorialHeader({ eyebrow, title, subtitle, right, className = '' }) {
  return (
    <header className={`flex flex-col md:flex-row md:items-end justify-between gap-4 md:gap-6 ${className}`}>
      <div className="min-w-0">
        {eyebrow && (
          <div className="flex items-center gap-3 mb-3">
            <span className="brass-rule" aria-hidden="true"></span>
            <span className="text-[10px] tracking-[0.28em] uppercase text-stone-500 font-medium">{eyebrow}</span>
          </div>
        )}
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-display text-stone-900 tracking-tight leading-[1.05]">{title}</h2>
        {subtitle && <p className="text-stone-500 mt-3 text-sm tracking-wide max-w-xl leading-relaxed">{subtitle}</p>}
      </div>
      {right && <div className="shrink-0 self-start md:self-auto">{right}</div>}
    </header>
  );
}

// --- Toast notifications -------------------------------------------------
const ToastContext = createContext({ show: () => {} });
function useToast() { return useContext(ToastContext); }

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const show = useCallback((message, opts = {}) => {
    const id = Math.random().toString(36).slice(2);
    const toast = { id, message, kind: opts.kind || 'default', duration: opts.duration ?? 2600 };
    setToasts((prev) => [...prev, toast]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), toast.duration);
  }, []);
  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="fixed left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 items-center pointer-events-none"
           style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 6rem)' }}
           aria-live="polite" aria-atomic="true" role="status">
        {toasts.map((t) => (
          <div key={t.id}
            className={`pointer-events-auto px-5 py-3 rounded-full text-sm shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-4 fade-in duration-300 border ${
              t.kind === 'error' ? 'bg-red-50/95 text-red-900 border-red-200'
              : t.kind === 'success' ? 'bg-stone-900/95 text-white border-stone-700'
              : 'bg-white/95 text-stone-900 border-stone-200'
            }`}
            role={t.kind === 'error' ? 'alert' : undefined}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
// ------------------------------------------------------------------------

// Soft-delete: items with `deletedAt` are hidden from every read site
// (wardrobe grid, insights, studio pickers, calendar, etc.) but still live in
// Firestore for 30 days so they can be restored from the Trash view in Profile.
const isLive = (item) => !item?.deletedAt;
const isDeleted = (item) => !!item?.deletedAt;
const live = (items) => (items || []).filter(isLive);

const CARE_TAGS = ['Dry clean', 'Hand wash', 'Cool wash', 'No tumble', 'Iron low', 'Steam only', 'Delicate'];

// Fuzzy-map a free-text care phrase (often from Gemini or a label) to one of
// the fixed CARE_TAGS chips. Returns null if nothing matches; the caller can
// fall back to appending the raw phrase to the description.
function matchCareTag(phrase) {
  const p = (phrase || '').toLowerCase();
  if (!p) return null;
  if (/dry[\s-]?clean/.test(p)) return 'Dry clean';
  if (/hand[\s-]?wash/.test(p)) return 'Hand wash';
  if (/(cool|cold|30\s?°?c?|machine wash)/.test(p) && !/no machine/.test(p)) return 'Cool wash';
  if (/no\s+tumble|do not tumble|don'?t tumble|line dry/.test(p)) return 'No tumble';
  if (/iron\s+(low|cool)|low.*iron/.test(p)) return 'Iron low';
  if (/steam/.test(p)) return 'Steam only';
  if (/delicate|gentle\s+cycle/.test(p)) return 'Delicate';
  return null;
}

// Fuzzy-map a free-text colour name to the closest COLOR_FAMILIES entry.
// Handles "navy blue", "off-white", "dusty rose", etc.
function matchColorFamily(raw) {
  const c = (raw || '').toLowerCase().trim();
  if (!c) return null;
  // Quick passthrough for exact matches
  const direct = (typeof COLOR_FAMILIES !== 'undefined' ? COLOR_FAMILIES : []).find((x) => x.toLowerCase() === c);
  if (direct) return direct;
  const map = [
    ['navy', 'Navy'], ['midnight', 'Navy'], ['marine', 'Navy'],
    ['off-white', 'White'], ['off white', 'White'], ['ivory', 'Cream'], ['ecru', 'Cream'],
    ['stone', 'Beige'], ['sand', 'Beige'], ['camel', 'Tan'], ['nude', 'Beige'], ['taupe', 'Beige'],
    ['charcoal', 'Grey'], ['slate', 'Grey'], ['silver', 'Silver'],
    ['mustard', 'Yellow'], ['ochre', 'Yellow'],
    ['olive', 'Green'], ['forest', 'Green'], ['emerald', 'Green'], ['sage', 'Green'], ['mint', 'Green'],
    ['sky', 'Blue'], ['cobalt', 'Blue'], ['azure', 'Blue'], ['denim', 'Blue'], ['teal', 'Blue'],
    ['burgundy', 'Red'], ['wine', 'Red'], ['maroon', 'Red'], ['crimson', 'Red'], ['scarlet', 'Red'],
    ['fuchsia', 'Pink'], ['rose', 'Pink'], ['blush', 'Pink'], ['coral', 'Pink'], ['salmon', 'Pink'],
    ['plum', 'Purple'], ['lilac', 'Purple'], ['lavender', 'Purple'], ['violet', 'Purple'],
    ['chocolate', 'Brown'], ['cocoa', 'Brown'], ['espresso', 'Brown'], ['mocha', 'Brown'],
    ['tangerine', 'Orange'], ['peach', 'Orange'], ['rust', 'Orange'], ['terracotta', 'Orange'],
  ];
  for (const [needle, family] of map) {
    if (c.includes(needle)) return family;
  }
  // Last-resort: substring match against the canonical list
  const canon = (typeof COLOR_FAMILIES !== 'undefined' ? COLOR_FAMILIES : [])
    .find((x) => c.includes(x.toLowerCase()) || x.toLowerCase().includes(c));
  return canon || null;
}
const MATERIALS = ['Cotton', 'Linen', 'Silk', 'Wool', 'Cashmere', 'Leather', 'Suede', 'Denim', 'Velvet', 'Lace', 'Knit', 'Sequins', 'Tweed', 'Synthetic', 'Other'];

// Care reminders: when wears-since-last-care crosses these thresholds, the
// item detail page surfaces a gentle nudge with the suggested action. Pick the
// rule for the item's most-fragile material (lowest threshold wins).
const CARE_RULES = {
  Cashmere: { everyN: 5, action: 'wash gently with cashmere shampoo or dry-clean' },
  Silk:     { everyN: 3, action: 'spot-clean and steam to refresh' },
  Suede:    { everyN: 4, action: 'brush with a suede brush to restore the nap' },
  Wool:     { everyN: 4, action: 'brush down and air out to keep the fibres fresh' },
  Linen:    { everyN: 3, action: 'steam or press — linen rumples fast' },
  Leather:  { everyN: 8, action: 'condition with a leather balm to prevent cracking' },
  Velvet:   { everyN: 5, action: 'steam from inside-out to lift the pile' },
  Tweed:    { everyN: 6, action: 'brush gently to release lint and debris' },
};

const NEUTRAL_COLORS = ['Black', 'White', 'Cream', 'Beige', 'Brown', 'Tan', 'Grey', 'Navy', 'Gold', 'Silver', 'Rose Gold'];

// Pragmatic colour-harmony check used by the Studio's smart generator.
// Returns true if two items' colour sets visually work together.
function colorsHarmonize(colorsA, colorsB) {
  if (!colorsA?.length || !colorsB?.length) return true;
  // Neutrals harmonise with anything
  if (colorsA.some((c) => NEUTRAL_COLORS.includes(c))) return true;
  if (colorsB.some((c) => NEUTRAL_COLORS.includes(c))) return true;
  // Same colour = always works (monochromatic)
  if (colorsA.some((c) => colorsB.includes(c))) return true;
  // Common clashes to avoid
  const clashes = [['Red', 'Pink'], ['Red', 'Orange'], ['Pink', 'Orange'], ['Green', 'Red'], ['Red', 'Purple'], ['Yellow', 'Pink']];
  for (const [a, b] of clashes) {
    if ((colorsA.includes(a) && colorsB.includes(b)) || (colorsA.includes(b) && colorsB.includes(a))) return false;
  }
  return true;
}

function itemMaterials(item) {
  return Array.isArray(item?.materials) ? item.materials : [];
}

// Pick the strictest care rule that applies to this item's materials.
// Returns { material, everyN, action, wearsSince, due } or null when no
// fragile material is tagged. `wearsSince` counts wears since the user last
// marked the item cared-for (or since the wear log began).
function itemCareReminder(item) {
  const mats = itemMaterials(item);
  const rules = mats
    .filter((m) => CARE_RULES[m])
    .map((m) => ({ material: m, ...CARE_RULES[m] }))
    .sort((a, b) => a.everyN - b.everyN);
  if (rules.length === 0) return null;
  const rule = rules[0];
  const totalWears = itemWearCount(item);
  const caredAtWear = Number.isFinite(item?.caredAtWear) ? item.caredAtWear : 0;
  const wearsSince = Math.max(0, totalWears - caredAtWear);
  return { ...rule, wearsSince, due: wearsSince >= rule.everyN, totalWears };
}

// Resolve an outfit's item references to live item objects.
// New outfits store only `itemIds: string[]` (tiny doc size).
// Legacy outfits stored full `items: Item[]` (broke the 1 MiB doc limit).
// This helper handles both transparently.
function resolveOutfitItems(outfit, allItems) {
  if (!outfit) return [];
  if (Array.isArray(outfit.itemIds) && outfit.itemIds.length > 0) {
    return outfit.itemIds
      .map((id) => allItems.find((i) => i.id === id))
      .filter(Boolean);
  }
  if (Array.isArray(outfit.items)) return outfit.items;
  return [];
}

// Gemini AI is wired via Firebase AI Logic — calls go through the firebase
// SDK with App Check verification, no API key in the client bundle. The
// `geminiText` / `geminiTextVision` helpers live in src/firebase.js. The
// `isAIEnabled()` import below gates UI on whether reCAPTCHA is configured.

// Compact one-paragraph style profile summary for prompt injection. Returns
// empty string when no fields are set so prompts stay clean.
function summariseStyleProfile(measurements) {
  if (!measurements) return '';
  const bits = [];
  if (measurements.styleUndertone) bits.push(`undertone is ${measurements.styleUndertone.toLowerCase()}`);
  if (measurements.styleSilhouette) bits.push(`body shape is ${measurements.styleSilhouette.toLowerCase()}`);
  if (measurements.styleFormality) bits.push(`prefers ${measurements.styleFormality.toLowerCase()} dressing by default`);
  if (measurements.stylePalette) bits.push(`palette leans ${measurements.stylePalette.toLowerCase()}`);
  if (Array.isArray(measurements.stylePrinciples) && measurements.stylePrinciples.length) {
    bits.push(`stated principles: ${measurements.stylePrinciples.join('; ')}`);
  }
  if (bits.length === 0) return '';
  return `Style profile: ${bits.join('; ')}.`;
}

async function generateOutfitWithGemini({ items, intent, weather, season, previousOutfit = null, temperature = 0.7, styleProfile = '' }) {
  if (!isAIEnabled()) {
    throw new Error('AI is not configured. Add VITE_RECAPTCHA_SITE_KEY + Firebase AI Logic to .env.local to enable Gemini outfit suggestions.');
  }
  if (!items.length) throw new Error('Add some items first.');

  const summarize = (i) =>
    `${i.id}|${i.name}|${i.brand || '?'}|${i.category}${i.subCategory ? '/' + i.subCategory : ''}` +
    `${i.favorite ? '|★FAVOURITE' : ''}` +
    `|styles=${itemStyles(i).join(',') || '-'}` +
    `|colors=${itemColors(i).join(',') || '-'}` +
    `|seasons=${itemSeasons(i).join(',') || 'any'}` +
    `|materials=${itemMaterials(i).join(',') || '-'}`;

  const refinementBlock = previousOutfit && previousOutfit.length > 0
    ? `\n\nThe user currently has this outfit assembled:\n${previousOutfit.map((i) => `- ${i.category}: ${i.name} by ${i.brand || '?'}`).join('\n')}\n\nThey want a REFINEMENT: "${intent}". Build a NEW outfit that addresses their refinement request — keep elements that aren't being changed, swap elements that are.\n`
    : '';

  const prompt = `You are an expert personal stylist. From the user's wardrobe below, build ONE coherent outfit that genuinely works together visually.${refinementBlock}

User context:
- Intent: ${intent || 'an everyday look'}
- Today's weather: ${weather ? `${weather.temp}°C, ${weatherLabel(weather.code)}` : 'unknown'}
- Current season: ${season}
${styleProfile ? `- ${styleProfile}` : ''}

Stylist rules:
- Pick AT MOST one item per category slot for: Tops, Outerwear, Bottoms, Dresses, Shoes, Bags, Accessories.
- Jewellery is layered — you MAY pick MULTIPLE items per jewellery slot (Earrings, Necklaces, Wrist). A complete look can carry two stacked necklaces, layered bracelets, or both pearl studs and a small drop earring. Compose jewellery as a curated stack, not a single piece — but only when the items genuinely work together.
- A Dress REPLACES Tops + Bottoms — never include all three.
- Pick ONLY items whose category matches the slot — never put a bag in the shoes slot.
- All chosen items must be season-appropriate.
- Colour palette must be cohesive: neutrals + 1-2 accent colours, avoid clashes (red+pink, red+orange, etc.).
- Style cohesion: a smart blazer doesn't go with sports leggings.
- Skip Outerwear unless the weather/season warrants it.
- Skip optional slots (Bags, Accessories, Jewellery) if nothing genuinely complements the look — better empty than wrong.
- ★FAVOURITE items are pieces the user loves — give them meaningful preference when they fit the intent and palette. Don't force a favourite that clashes; do prefer one over an equally-suitable non-favourite.

Reasoning rules:
- The reasoning is saved with the look long-term — write it as a STANDALONE description of the final outfit. Describe why this combination works as a complete look (palette, silhouette, occasion). Do NOT reference the user's previous outfit, what was swapped, replaced, or kept — that context is meaningless when the user opens the saved look weeks later.

Available items (id|name|brand|category|attributes):
${items.map(summarize).join('\n')}

Respond ONLY with valid JSON in this exact shape:
{"itemIds": ["id1", "id2", ...], "reasoning": "one elegant sentence explaining why this combination works", "confidence": 0-100}

Confidence reflects how strongly the available wardrobe matches the intent (100 = perfect fit, 50 = workable but not ideal, low = thin matches).`;

  const text = await geminiText(prompt, { temperature, jsonMode: true });
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error('Gemini returned invalid JSON'); }
  if (!parsed.itemIds?.length) throw new Error('Gemini could not compose a look from this wardrobe');
  return parsed;
}

// Gemini Vision: read a care/composition label photo. Pulls brand, materials,
// size, colour, care instructions, and any barcode digits. Used by the "Scan
// Label" entry point on Add Item to pre-fill the form before the user reviews.
// Materials are mapped to the app's MATERIALS vocabulary so chips light up.
// Gemini Vision: look at a photo of a clothing item (as you'd shoot it
// hanging in your wardrobe or laid flat) and identify everything visible.
// Returns a draft suitable for pre-filling the Add Item form. The single
// highest-leverage import path — one tap, one photo, form ready.
async function identifyItemWithGemini({ imageDataUrl, knownBrands = [] }) {
  if (!isAIEnabled()) throw new Error('AI is not configured.');
  const knownMaterials = MATERIALS.filter((m) => m !== 'Other').join(', ');
  const knownColors = (typeof COLOR_FAMILIES !== 'undefined' ? COLOR_FAMILIES : []).join(', ');
  const knownStyles = (typeof STYLES !== 'undefined' ? STYLES : []).join(', ');
  const cats = ['Tops', 'Bottoms', 'Dresses', 'Outerwear', 'Sportswear', 'Swimwear', 'Shoes', 'Bags', 'Accessories', 'Jewellery'];

  const prompt = `You are a personal stylist's assistant identifying a single clothing item from a photograph. The user wants to add it to their digital wardrobe — pre-fill as many fields as you confidently can.

Look at the photo and identify:
- The item's CATEGORY — must be exactly one of: ${cats.join(', ')}.
- Sub-category (only if clearly identifiable). For tops: T-Shirts, Blouses, Shirts, Sleeveless, Jumpers, Sweaters, Cardigans, Hoodies, Sweatshirts, Vests. For outerwear: Blazers, Coats, Jackets, Trench Coats, Puffer Jackets, Parkas, Capes, Gilets, Leather Jackets. For dresses: Mini, Midi, Maxi, Wrap, Shift, Bodycon, Shirt Dress, Knit Dress, Cocktail, Evening / Gown, Sundress, Slip Dress. For shoes: Sneakers, Sandals, Wedges, Loafers, Heels, Ankle Boots, Boots, Flats. For bags: Handbag, Crossbody, Tote, Clutch, Backpack, Weekend, Wallet. For accessories: Sunglasses, Sun Hats, Hats, Belts, Scarves, Gloves. For jewellery: Necklaces, Pendants, Earrings, Rings, Bracelets, Watches, Brooches. For swimwear: Bikini, Swimsuit, Tankini, Bandeau, Swim Shorts, Cover-up, Kaftan, Sarong, Beach Dress, Rash Vest.
- Brand — if a logo or visible tag identifies it. Prefer matches from: ${knownBrands.slice(0, 20).join(', ') || 'any known brand'}. Leave empty if uncertain.
- Suggested name — short, descriptive: "[colour] [silhouette/cut] [item type]", e.g. "Navy wool blazer", "Cream silk slip dress", "Tan leather crossbody".
- Colours visible — array, mapped to: ${knownColors}. Include 1-3 dominant colours. If a colour is unusual ("sage", "rust"), pick its closest family ("Green", "Orange").
- Material best guess from: ${knownMaterials}. Only include if highly confident from visual texture (knit, denim weave, leather sheen, silk drape, etc).
- Style tags from: ${knownStyles}. Pick the 1-3 best-fitting moods.
- Season suitability: array from Spring, Summer, Autumn, Winter. Include all that genuinely fit (a wool coat = Autumn + Winter; a linen dress = Spring + Summer).
- A 1-sentence description noting silhouette, fit, or distinctive detail.
- Confidence score 0-100 — your overall certainty about the identification.

Respond ONLY with valid JSON in this exact shape:
{
  "category": "string",
  "subCategory": "string or empty",
  "brand": "string or empty",
  "name": "string",
  "colors": ["array of canonical colour names"],
  "materials": ["array of canonical material names"],
  "styles": ["array of canonical style names"],
  "seasons": ["array of season names"],
  "description": "string",
  "confidence": 0
}`;

  const text = await geminiTextVision(prompt, imageDataUrl, { temperature: 0.2, jsonMode: true });
  if (!text) throw new Error('Gemini returned no response');
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error('Gemini returned invalid JSON'); }
  return parsed;
}

async function analyzeLabelWithGemini({ imageDataUrl }) {
  if (!isAIEnabled()) throw new Error('AI is not configured.');
  const knownMaterials = MATERIALS.filter((m) => m !== 'Other').join(', ');
  const knownColors = (typeof COLOR_FAMILIES !== 'undefined' ? COLOR_FAMILIES : []).join(', ');

  const prompt = `You are reading a clothing care label, brand tag, or product barcode label.

Extract everything visible:
- Brand name (often the largest text or the logo).
- Product name if present on a hang-tag (e.g. "Sienna Cropped Blazer"). Empty if not visible.
- Material composition — translate to one or more of these known materials: ${knownMaterials}. Use exact spelling. Include only materials clearly present (≥10% composition or main fibre).
- Size (e.g. "M", "10", "EU 38", "32R").
- Colour name if printed. Prefer one of these canonical families when possible: ${knownColors || 'any short name'}. If the label says "Navy Blue" return "Navy"; if it says "Stone" return "Beige".
- Care symbols / instructions. For each, output the closest match from this fixed list when applicable: ${CARE_TAGS.join(', ')}. If a phrase has no good match, include the original short text. One short phrase per array entry.
- Barcode digits if a barcode (UPC/EAN) is visible — digits only, no formatting.
- Product code / style number if visible (e.g. "1234567-001").

Respond ONLY with valid JSON in this exact shape:
{
  "brand": "string or empty",
  "productName": "string or empty",
  "size": "string or empty",
  "color": "string or empty",
  "materials": ["array of known materials, exact spelling"],
  "care": ["array of short instruction phrases"],
  "barcode": "digits only or empty",
  "productCode": "string or empty",
  "notes": "anything else worth keeping, or empty"
}`;

  const text = await geminiTextVision(prompt, imageDataUrl, { temperature: 0.1, jsonMode: true });
  if (!text) throw new Error('Gemini returned no response');
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error('Gemini returned invalid JSON'); }
  return parsed;
}

// Gemini Vision: extract line-items from a receipt screenshot or order
// confirmation. Returns the same { brand, purchasedDate, purchasedFrom, items }
// shape as the text-based parseReceiptText, so the modal flow stays unified.
async function analyzeReceiptImageWithGemini({ imageDataUrl }) {
  if (!isAIEnabled()) throw new Error('AI is not configured.');
  const prompt = `You are reading a clothing-purchase receipt or order confirmation screenshot.

Extract:
- Each line-item purchased: the product name, the brand if shown (often the same as the retailer), and the price as a plain number (no currency symbol).
- The retailer/brand name overall (e.g. "COS", "Holland Cooper", "Net-a-Porter").
- The purchase date in YYYY-MM-DD if visible.

Ignore: postage / shipping / discount / tax lines.

Respond ONLY with valid JSON in this exact shape:
{
  "brand": "string or empty",
  "purchasedDate": "YYYY-MM-DD or empty",
  "purchasedFrom": "string or empty",
  "items": [
    { "name": "string", "brand": "string or empty", "price": number }
  ]
}`;

  const text = await geminiTextVision(prompt, imageDataUrl, { temperature: 0.2, jsonMode: true });
  if (!text) throw new Error('Gemini returned no response');
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error('Gemini returned invalid JSON'); }
  if (!Array.isArray(parsed.items) || parsed.items.length === 0) throw new Error('No items found in this image.');
  return parsed;
}

// Gemini wardrobe-gap audit. Distils items into category/style/colour/season
// counts and asks Gemini for a balance critique: what's over-represented,
// what's missing, and the 3 highest-leverage additions to buy next.
// Returns { strengths, gaps, recommendations, missingPieces }.
async function analyzeWardrobeGapsWithGemini({ items, inspirations = [] }) {
  if (!isAIEnabled()) throw new Error('AI is not configured.');
  const owned = items.filter((i) => i.status === 'owned');
  if (owned.length === 0) throw new Error('Add some owned items first.');

  // Compact aggregate summary (counts only — never send full inventory).
  const count = (key, getter) => {
    const m = {};
    for (const i of owned) {
      const v = getter(i);
      if (Array.isArray(v)) for (const x of v) m[x] = (m[x] || 0) + 1;
      else if (v) m[v] = (m[v] || 0) + 1;
    }
    return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}:${n}`).join(', ') || 'none';
  };
  const byCategory = count('category', (i) => i.category);
  const bySubCategory = count('subCategory', (i) => i.subCategory);
  const byStyle = count('style', (i) => itemStyles(i));
  const byColor = count('color', (i) => itemColors(i));
  const bySeason = count('season', (i) => itemSeasons(i));
  const byMaterial = count('material', (i) => itemMaterials(i));
  const wornNever = owned.filter((i) => itemWearCount(i) === 0).length;
  const priceTotal = owned.reduce((s, i) => s + Number(i.price || 0), 0);
  const wishlistReasons = items
    .filter((i) => i.status === 'wishlist' && i.wishlistReason)
    .map((i) => `- ${i.name}${i.brand ? ` (${i.brand})` : ''}: ${i.wishlistReason}`)
    .slice(0, 15);

  const prompt = `You are a senior personal stylist auditing a client's wardrobe for balance and gaps.

The client has ${owned.length} owned items (total spend £${priceTotal.toLocaleString()}), of which ${wornNever} have never been worn.

Wardrobe composition:
- By category: ${byCategory}
- By sub-category: ${bySubCategory}
- By style: ${byStyle}
- By colour: ${byColor}
- By season: ${bySeason}
- By material: ${byMaterial}
${wishlistReasons.length ? `\nWishlist intent (purposes the client has set):\n${wishlistReasons.join('\n')}` : ''}
${(inspirations || []).filter((i) => i.analysis?.summary).slice(0, 8).length
  ? `\nSaved inspirations (looks the client is drawn to — recommendations should align with these):\n${(inspirations || []).filter((i) => i.analysis?.summary).slice(0, 8).map((i) => `- ${i.caption || 'Untitled'}: ${i.analysis.summary}`).join('\n')}`
  : ''}

Audit rules:
- Be specific and quantitative ("11 tops vs 2 bottoms suggests…") — never generic.
- Identify 2-3 STRENGTHS (well-built parts of the wardrobe).
- Identify 2-4 GAPS (imbalances or missing essentials), each with a one-line reason grounded in the numbers.
- Suggest 3 high-leverage RECOMMENDATIONS — specific pieces to add (category + colour + style hint, e.g. "a tailored navy blazer in wool"). Avoid duplicates of what's already over-represented.
- Tone: warm, direct, premium-stylist. UK English.

Respond ONLY with valid JSON in this exact shape:
{
  "strengths": [{"title": "string", "detail": "string"}],
  "gaps": [{"title": "string", "detail": "string"}],
  "recommendations": [{"piece": "string", "why": "string"}]
}`;

  const text = await geminiText(prompt, { temperature: 0.5, jsonMode: true });
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error('Gemini returned invalid JSON'); }
  return parsed;
}

// Gemini Vision: analyze an inspiration outfit photo and cross-reference against
// the user's wardrobe. Returns garments visible, matching items, and gaps.
async function analyzeInspirationWithGemini({ imageDataUrl, items }) {
  if (!isAIEnabled()) throw new Error('AI is not configured.');
  if (!imageDataUrl) throw new Error('No image to analyze.');

  const wardrobeSummary = items.slice(0, 100).map((i) =>
    `${i.id}|${i.name}|${i.brand || '?'}|${i.category}${i.subCategory ? '/' + i.subCategory : ''}|colors=${itemColors(i).join(',') || '-'}`
  ).join('\n');

  const prompt = `You are an expert stylist analyzing an inspiration outfit photo.

Look at the image and:
1. Identify every visible garment with its category, brief description, and dominant colour.
2. From the user's wardrobe below, find any items that closely match each garment (similar category + similar colour + similar style).
3. List any garments shown in the inspiration that the user is missing from their wardrobe.

User's wardrobe (id|name|brand|category|attrs):
${wardrobeSummary}

Respond ONLY with valid JSON in this exact shape:
{
  "garments": [
    {"category": "Tops|Bottoms|Outerwear|Dresses|Shoes|Bags|Accessories|Jewellery", "description": "white silk blouse", "color": "white"}
  ],
  "wardrobeMatchIds": ["id1", "id2"],
  "missingPieces": ["a tailored navy blazer", "white slip-on trainers"],
  "summary": "one elegant sentence describing the overall look"
}`;

  const text = await geminiTextVision(prompt, imageDataUrl, { temperature: 0.4, jsonMode: true });
  if (!text) throw new Error('Gemini returned no analysis');
  return JSON.parse(text);
}

const COLOR_FAMILIES = [
  'Black', 'White', 'Cream', 'Beige', 'Brown', 'Tan', 'Grey',
  'Red', 'Pink', 'Orange', 'Yellow', 'Olive', 'Green', 'Teal',
  'Blue', 'Navy', 'Purple',
  'Gold', 'Silver', 'Rose Gold',
  'Multicolor',
];

const COLOR_SWATCHES = {
  Black: '#1c1917', White: '#FAFAF9', Cream: '#F5EFE6', Beige: '#D5C3A1',
  Brown: '#6B4226', Tan: '#B89570', Grey: '#9CA3AF',
  Red: '#DC2626', Pink: '#EC4899', Orange: '#F97316', Yellow: '#EAB308',
  Olive: '#65731F', Green: '#16A34A', Teal: '#0D9488',
  Blue: '#2563EB', Navy: '#1E3A8A', Purple: '#9333EA',
  Gold: 'linear-gradient(135deg, #F4D27A, #C9A961 45%, #E6C870 70%, #B8860B)',
  Silver: 'linear-gradient(135deg, #ECECEC, #B8B8B8 45%, #DADADA 70%, #9C9C9C)',
  'Rose Gold': 'linear-gradient(135deg, #F4D0CB, #C97F73 50%, #E8B4A6)',
  Multicolor: 'linear-gradient(135deg, #DC2626, #EAB308, #16A34A, #2563EB, #9333EA)',
};

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) { h = 0; s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return [h * 360, s, l];
}

function classifyColorFromRgb(r, g, b) {
  const [h, s, l] = rgbToHsl(r, g, b);
  if (l < 0.12) return 'Black';
  if (l > 0.94 && s < 0.08) return 'White';
  if (l > 0.82 && s < 0.18) return 'Cream';
  if (l > 0.7 && s < 0.28 && h > 25 && h < 60) return 'Beige';
  if (s < 0.12) return 'Grey';
  if (h < 15 || h >= 345) return 'Red';
  if (h < 30) return l < 0.35 ? 'Brown' : 'Orange';
  if (h < 45) return l < 0.4 ? 'Brown' : (s < 0.4 ? 'Tan' : 'Orange');
  if (h < 65) return l < 0.45 && s > 0.35 ? 'Olive' : 'Yellow';
  if (h < 85) return l < 0.45 ? 'Olive' : 'Yellow';
  if (h < 165) return 'Green';
  if (h < 200) return 'Teal';
  if (h < 240 && l < 0.32) return 'Navy';
  if (h < 255) return 'Blue';
  if (h < 295) return 'Purple';
  if (h < 335) return 'Pink';
  return 'Red';
}

async function extractDominantColors(dataUrl, maxResults = 2) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      try {
        const size = 80;
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);
        const buckets = {};
        let totalCounted = 0;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 200) continue;
          const family = classifyColorFromRgb(data[i], data[i + 1], data[i + 2]);
          buckets[family] = (buckets[family] || 0) + 1;
          totalCounted++;
        }
        const sorted = Object.entries(buckets)
          .filter(([, n]) => n / totalCounted > 0.06)
          .sort((a, b) => b[1] - a[1]);
        const colors = sorted.slice(0, maxResults).map(([f]) => f);
        // If 4+ distinct significant families, tag as Multicolor
        if (sorted.length >= 4 && sorted[3][1] / totalCounted > 0.1) {
          resolve(['Multicolor']);
        } else {
          resolve(colors);
        }
      } catch (e) { reject(e); }
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

function itemColors(item) {
  return Array.isArray(item?.colors) ? item.colors : [];
}

// Weather: fetched via browser geolocation + Open-Meteo (no API key needed).
// Cached for 1 hour in localStorage so subsequent visits don't re-prompt.
async function fetchTodaysWeather() {
  try {
    const cached = JSON.parse(localStorage.getItem('atelier-weather') || 'null');
    if (cached && Date.now() - cached.ts < 3600_000) return cached.data;
  } catch { /* ignore */ }
  if (!navigator.geolocation) return null;
  try {
    const pos = await new Promise((res, rej) =>
      navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000, maximumAge: 600_000 })
    );
    const { latitude, longitude } = pos.coords;
    const resp = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&temperature_unit=celsius`
    );
    if (!resp.ok) return null;
    const json = await resp.json();
    const w = json.current_weather;
    if (!w) return null;
    const data = { temp: Math.round(w.temperature), code: w.weathercode };
    localStorage.setItem('atelier-weather', JSON.stringify({ ts: Date.now(), data }));
    return data;
  } catch { return null; }
}

// Gemini: distil the user's wear history into a 3-line style manifesto. Reads
// the most-worn / favourite items and what they've actually paired together.
// Cached on the profile doc; user re-runs on demand.
async function generateStyleManifestoWithGemini({ items, outfits, inspirations = [] }) {
  if (!isAIEnabled()) throw new Error('AI is not configured.');
  const owned = items.filter((i) => i.status === 'owned' && !i.deletedAt);
  if (owned.length < 5) throw new Error('Add at least a few items first.');

  // Top 15 most-worn pieces
  const topWorn = [...owned]
    .map((i) => ({ ...i, _w: itemWearCount(i) }))
    .filter((i) => i._w > 0)
    .sort((a, b) => b._w - a._w)
    .slice(0, 15);
  // Recent outfit pairings (last 10)
  const recentOutfits = [...(outfits || [])]
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    .slice(0, 10);

  const lines = [];
  if (topWorn.length) {
    lines.push('Most-worn pieces:');
    for (const i of topWorn) lines.push(`- ${i._w}× · ${i.name} (${i.brand || '?'}) · ${i.category}${i.subCategory ? '/' + i.subCategory : ''} · colours=${itemColors(i).join(',') || '-'} · styles=${itemStyles(i).join(',') || '-'}`);
  }
  if (recentOutfits.length) {
    lines.push('\nRecent outfits:');
    for (const o of recentOutfits) {
      const ps = resolveOutfitItems(o, items);
      lines.push(`- ${o.name}: ${ps.map((p) => p.name).join(' + ')}`);
    }
  }
  // Inspirations: the looks they SAVE that aren't theirs are pure aspiration
  // signal — feed in summaries so the manifesto captures the gap between what
  // they own and what they reach for.
  const analysed = (inspirations || []).filter((i) => i.analysis?.summary).slice(0, 12);
  if (analysed.length) {
    lines.push('\nSaved inspirations (aspirational):');
    for (const ins of analysed) {
      lines.push(`- ${ins.caption || 'Untitled'}: ${ins.analysis.summary}`);
    }
  }

  const prompt = `You are a senior fashion editor writing a private style brief for one client. Read the data below and write exactly 3 short paragraphs (1-2 sentences each):

1. The client's recurring aesthetic — what their wardrobe is genuinely *about*.
2. The colour and texture story they keep returning to.
3. The TENSION between what they actually wear and what they SAVE as inspiration — what they reach for that they don't yet have. If no inspirations are saved, describe what they avoid by absence instead.

UK English. Warm, observational, specific. No platitudes. No bullet points.

Data:
${lines.join('\n')}`;

  const text = await geminiText(prompt, { temperature: 0.7 });
  if (!text) throw new Error('Gemini returned no response');
  return text.trim();
}

// Gemini: one-line observation on a freshly-logged wear. Cheap and cheerful —
// notes the choice in context (weather, recent history, novelty). Fire & forget;
// if the AI is down, the wear still saves.
async function narrateWearWithGemini({ outfit, items, recentLog, weather }) {
  if (!isAIEnabled()) return '';
  const pieces = resolveOutfitItems(outfit, items);
  if (pieces.length === 0) return '';
  const summary = pieces.map((p) => `${p.name} (${p.category}${p.subCategory ? '/' + p.subCategory : ''}, ${itemColors(p).join('/') || '-'})`).join(' + ');
  const recent = (recentLog || []).slice(-5).map((r) => `${r.date}: ${r.name}`).join('; ') || 'none';

  const prompt = `You are a personal stylist commenting on the user's outfit choice today, in one short observational sentence (under 20 words). UK English. No platitudes ("great look!"). Notice something specific — colour pairing, weather fit, a fresh combination, or a return to a favourite.

Today's outfit: ${summary}
Weather: ${weather ? `${weather.temp}°C, ${weatherLabel(weather.code)}` : 'unknown'}
Recent wears: ${recent}

Respond with the sentence only, no quotes.`;

  try {
    const text = await geminiText(prompt, { temperature: 0.8 });
    return (text || '').trim();
  } catch { return ''; }
}

// Per-retailer search URL patterns. For known domains we go straight to the
// site's own search page; for everything else we fall back to a Google
// site-restricted query so the user still gets relevant results.
const BRAND_SEARCH_PATTERNS = {
  'reiss.com': 'https://www.reiss.com/search?q={q}',
  'cos.com': 'https://www.cos.com/en_gbp/search?textsearch={q}',
  'hollandcooper.com': 'https://hollandcooper.com/search?q={q}',
  'net-a-porter.com': 'https://www.net-a-porter.com/en-gb/shop/search?keywords={q}',
  'asos.com': 'https://www.asos.com/search/?q={q}',
  'johnlewis.com': 'https://www.johnlewis.com/search?search-term={q}',
  'whistles.com': 'https://www.whistles.com/uk/search?q={q}',
  'marksandspencer.com': 'https://www.marksandspencer.com/l/search?q={q}',
  'zara.com': 'https://www.zara.com/uk/en/search?searchTerm={q}',
  'arket.com': 'https://www.arket.com/en_gbp/search-results.html?q={q}',
  'mango.com': 'https://shop.mango.com/gb/search?q={q}',
  'massimodutti.com': 'https://www.massimodutti.com/uk/search?q={q}',
  'theoutnet.com': 'https://www.theoutnet.com/en-gb/shop/search?keywords={q}',
  'matchesfashion.com': 'https://www.matchesfashion.com/search?q={q}',
  'mytheresa.com': 'https://www.mytheresa.com/en-gb/search.html?q={q}',
  'farfetch.com': 'https://www.farfetch.com/uk/shopping/search?q={q}',
  'selfridges.com': 'https://www.selfridges.com/GB/en/search/products?searchTerm={q}',
  'harrods.com': 'https://www.harrods.com/en-gb/results?q={q}',
};

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return null; }
}

function brandSearchUrl(website, query) {
  const host = hostOf(website);
  if (host && BRAND_SEARCH_PATTERNS[host]) {
    return BRAND_SEARCH_PATTERNS[host].replace('{q}', encodeURIComponent(query));
  }
  if (host) return `https://www.google.com/search?q=${encodeURIComponent(`${query} site:${host}`)}`;
  return `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(query)}`;
}

// Travel forecast: geocode a place name + fetch a daily forecast window via
// Open-Meteo (no API key). Returns { lat, lon, name, country, daily[] } where
// each daily entry is { date, tmax, tmin, code }. Used by the travel-packing
// generator. Both endpoints are free + don't require auth.
async function fetchTravelForecast(query, startISO, endISO) {
  const geo = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1`
  );
  if (!geo.ok) throw new Error('Could not look up that place.');
  const g = await geo.json();
  const loc = g.results?.[0];
  if (!loc) throw new Error('Place not found — try a different name.');
  const fc = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}` +
    `&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto` +
    `&start_date=${startISO}&end_date=${endISO}`
  );
  if (!fc.ok) throw new Error('Could not fetch forecast — Open-Meteo only goes 16 days out.');
  const j = await fc.json();
  const d = j.daily;
  if (!d?.time?.length) throw new Error('No forecast returned for that range.');
  const daily = d.time.map((date, i) => ({
    date,
    tmax: Math.round(d.temperature_2m_max[i]),
    tmin: Math.round(d.temperature_2m_min[i]),
    code: d.weathercode[i],
  }));
  return { lat: loc.latitude, lon: loc.longitude, name: loc.name, country: loc.country, daily };
}

// Gemini: compose a per-day outfit capsule from the user's wardrobe for a
// travel forecast. Returns { days: [{date, outfitId, itemIds, reasoning}],
// summary }. Uses itemIds the user already owns; doesn't invent items.
async function generateTravelCapsuleWithGemini({ items, destination, daily, styleProfile = '' }) {
  if (!isAIEnabled()) throw new Error('AI is not configured.');
  if (!items.length) throw new Error('Add some owned items first.');

  const summarize = (i) =>
    `${i.id}|${i.name}|${i.brand || '?'}|${i.category}${i.subCategory ? '/' + i.subCategory : ''}` +
    `${i.favorite ? '|★FAVOURITE' : ''}` +
    `|styles=${itemStyles(i).join(',') || '-'}` +
    `|colors=${itemColors(i).join(',') || '-'}` +
    `|seasons=${itemSeasons(i).join(',') || 'any'}` +
    `|materials=${itemMaterials(i).join(',') || '-'}`;

  const forecastLines = daily.map((d) => `- ${d.date}: ${d.tmin}-${d.tmax}°C · ${weatherLabel(d.code)}`).join('\n');

  const prompt = `You are a personal stylist packing a travel capsule from the user's wardrobe.

Destination: ${destination}
Daily forecast:
${forecastLines}

${styleProfile ? `${styleProfile}\n\n` : ''}Packing rules:
- Compose ONE outfit per forecast day (every date above).
- Reuse pieces across days where it makes sense — that's the point of a capsule. Aim to keep TOTAL distinct pieces under 1.5× the number of days.
- Each outfit follows the standard slot rules: at most one item per category, dresses replace tops+bottoms, season/weather-appropriate.
- Skip a slot rather than force a wrong item.
- A short reasoning line per day (max 12 words).
- One summary line about the overall capsule choices.

Available items (id|name|brand|category|attributes):
${items.map(summarize).join('\n')}

Respond ONLY with valid JSON in this exact shape:
{
  "days": [
    { "date": "YYYY-MM-DD", "itemIds": ["id1", "id2"], "reasoning": "string" }
  ],
  "summary": "one short paragraph"
}`;

  const text = await geminiText(prompt, { temperature: 0.6, jsonMode: true });
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error('Gemini returned invalid JSON'); }
  if (!Array.isArray(parsed.days) || parsed.days.length === 0) throw new Error('Gemini could not compose a capsule.');
  return parsed;
}

// --- Receipt parser ------------------------------------------------------
// Best-effort extraction from pasted order confirmations / receipts.
// Designed for UK retailer formats (Holland Cooper, COS, John Lewis, ASOS etc).
// Returns { brand, purchasedDate, items: [{ name, price, brand }] }.

const RECEIPT_PRICE_RE = /(?:£|GBP\s*|\$|€|EUR\s*)\s*(\d+(?:[.,]\d{1,2})?)/;
const RECEIPT_BLOCKLIST = /^\s*(total|subtotal|sub-total|grand\s+total|order\s+(total|summary)|shipping|delivery|postage|tax|vat|discount|gift\s*card|promo|payment|paid|amount(?:\s+(due|paid))?|estimated|balance)/i;

function parseReceiptText(rawText) {
  const text = (rawText || '').replace(/\r/g, '');
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return { brand: '', purchasedDate: '', purchasedFrom: '', items: [] };

  const brand = detectReceiptBrand(lines, text);
  const purchasedDate = detectReceiptDate(lines) || todayISO();
  const items = extractReceiptItems(lines, brand);
  return { brand, purchasedDate, purchasedFrom: brand, items };
}

function detectReceiptBrand(lines, fullText) {
  // 1. From email address pattern
  const emailMatch = fullText.match(/(?:noreply|orders?|hello|info|contact|customerservice|support)@([a-z0-9][a-z0-9-]*)\.[a-z.]+/i);
  if (emailMatch) {
    const slug = emailMatch[1];
    return slug.split(/[-_]/).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ');
  }
  // 2. ALL-CAPS short line at top (brand logos in plain-text emails)
  for (const line of lines.slice(0, 15)) {
    if (line.length < 3 || line.length > 40) continue;
    if (/^(order|receipt|confirmation|thank|welcome|hello|hi|dear|invoice|subject|to)/i.test(line)) continue;
    if (/^[A-Z][A-Z\s&'.-]{2,30}$/.test(line)) return line.trim();
  }
  // 3. "from BRAND" or "at BRAND" phrasing
  for (const line of lines.slice(0, 30)) {
    const m = line.match(/(?:from|at|with|shopping at)\s+([A-Z][\w&'.\s-]{1,30})(?:\.|!|,|\s*$)/);
    if (m) return m[1].trim();
  }
  return '';
}

function detectReceiptDate(lines) {
  const MONTHS = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
  const pad = (s) => String(s).padStart(2, '0');
  for (const line of lines) {
    // "12 May 2026" or "12th May 2026"
    let m = line.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})\b/i);
    if (m) return `${m[3]}-${MONTHS[m[2].slice(0, 3).toLowerCase()]}-${pad(m[1])}`;
    // "May 12, 2026"
    m = line.match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/i);
    if (m) return `${m[3]}-${MONTHS[m[1].slice(0, 3).toLowerCase()]}-${pad(m[2])}`;
    // ISO "2026-05-12"
    m = line.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
    if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
    // UK "12/05/2026"
    m = line.match(/\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/);
    if (m) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
  }
  return '';
}

function extractReceiptItems(lines, brand) {
  const items = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const priceMatch = line.match(RECEIPT_PRICE_RE);
    if (!priceMatch) continue;

    const price = parseFloat(priceMatch[1].replace(',', '.'));
    if (!isFinite(price) || price < 5 || price > 50000) continue;
    if (RECEIPT_BLOCKLIST.test(line)) continue;

    // Try same-line: "Amalfi Linen Short   £99.00"
    let name = line.replace(RECEIPT_PRICE_RE, '').replace(/\s{2,}/g, ' ').trim();
    name = name.replace(/^[-*•·\d.\s)]+/, '').trim();
    if (name.length < 3 || RECEIPT_BLOCKLIST.test(name) || /^(qty|quantity|size|color|colour|sku|item\s*#|x?\d+\s*$)/i.test(name)) {
      name = '';
    }

    // Otherwise look back up to 5 lines for the likely name
    if (!name) {
      for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
        const cand = lines[j];
        if (!cand) continue;
        if (RECEIPT_PRICE_RE.test(cand)) break; // hit previous item block
        if (RECEIPT_BLOCKLIST.test(cand)) continue;
        if (/^(qty|quantity|size|color|colour|sku|item\s*#)/i.test(cand)) continue;
        if (/^\s*\d+\s*x?\s*$/i.test(cand)) continue; // bare qty
        if (cand.length < 3 || cand.length > 80) continue;
        name = cand;
        break;
      }
    }

    if (!name) continue;
    // Skip exact duplicate name+price (some receipts list line items twice)
    if (items.some((it) => it.name === name && it.price === price)) continue;
    items.push({ name, price, brand });
  }
  return items;
}

// Translate Open-Meteo weather codes to friendly labels.
function weatherLabel(code) {
  if (code === 0) return 'Clear';
  if (code <= 2) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if (code <= 48) return 'Foggy';
  if (code <= 67) return 'Rain';
  if (code <= 77) return 'Snow';
  if (code <= 82) return 'Showers';
  if (code <= 86) return 'Snow showers';
  return 'Stormy';
}

// Given weather, suggest which item seasons fit.
function weatherToSeasons(weather) {
  if (!weather) return null;
  const t = weather.temp;
  if (t < 5) return ['Winter'];
  if (t < 14) return ['Autumn', 'Winter'];
  if (t < 22) return ['Spring', 'Autumn'];
  return ['Summer'];
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 5) return 'Late night styling';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  if (hour < 22) return 'Good evening';
  return 'Burning the midnight oil';
}

function firstName(user) {
  if (!user) return '';
  if (user.displayName) return user.displayName.split(' ')[0];
  if (user.email) return user.email.split('@')[0];
  return '';
}

function itemWearHistory(item) {
  return Array.isArray(item?.wearHistory) ? item.wearHistory : [];
}

// wearNotes is a sparse map keyed by ISO date: { '2026-06-14': 'felt great' }.
// Kept separate from wearHistory so the array stays simple to sort & migrate.
function itemWearNotes(item) {
  return (item && typeof item.wearNotes === 'object' && item.wearNotes !== null) ? item.wearNotes : {};
}

function itemWearCount(item) {
  return itemWearHistory(item).length;
}

function itemLastWornISO(item) {
  const history = itemWearHistory(item);
  if (!history.length) return null;
  return [...history].sort().pop();
}

function daysSinceLastWorn(item) {
  const last = itemLastWornISO(item);
  if (!last) return null;
  const lastMs = new Date(last + 'T00:00:00').getTime();
  const todayMs = new Date(todayISO() + 'T00:00:00').getTime();
  return Math.max(0, Math.floor((todayMs - lastMs) / 86_400_000));
}

function itemCostPerWear(item) {
  const wears = itemWearCount(item);
  const price = Number(item?.price || 0);
  if (!wears || !price) return null;
  return price / wears;
}

// Smart recommendation: prefers items you OWNED + haven't worn in 14+ days +
// match current season. Picks one item. Returns null if nothing eligible.
function pickTodaysRecommendation(items) {
  const owned = live(items).filter((i) => i.status === 'owned');
  if (owned.length === 0) return null;
  const month = new Date().getMonth();
  const season = month >= 2 && month <= 4 ? 'Spring'
    : month >= 5 && month <= 7 ? 'Summer'
    : month >= 8 && month <= 10 ? 'Autumn'
    : 'Winter';
  const scored = owned.map((item) => {
    const days = daysSinceLastWorn(item);
    const seasonFit = itemSeasons(item).length === 0 ? 0.4 : itemSeasons(item).includes(season) ? 1 : 0;
    const recency = days === null ? 1 : Math.min(days / 60, 1);
    // Favourites get a meaningful boost — pieces the user has explicitly
    // starred should surface more often as Today's Pick than equally-suitable
    // unstarred items.
    const favouriteBoost = item.favorite ? 0.25 : 0;
    const score = seasonFit * 0.55 + recency * 0.2 + favouriteBoost;
    return { item, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, Math.max(3, Math.floor(scored.length * 0.2)));
  if (top.length === 0) return null;
  // Seed pick by today's date so it stays stable through the day, then rotates.
  const todayKey = new Date().toISOString().slice(0, 10);
  let h = 0; for (let i = 0; i < todayKey.length; i++) h = ((h << 5) - h + todayKey.charCodeAt(i)) | 0;
  return top[Math.abs(h) % top.length].item;
}

function formatLastWorn(item) {
  const days = daysSinceLastWorn(item);
  if (days === null) return 'Not worn yet';
  if (days === 0) return 'Worn today';
  if (days === 1) return 'Worn yesterday';
  if (days < 7) return `Worn ${days} days ago`;
  if (days < 30) return `Worn ${Math.floor(days / 7)} week${days < 14 ? '' : 's'} ago`;
  if (days < 365) return `Worn ${Math.floor(days / 30)} month${days < 60 ? '' : 's'} ago`;
  return `Worn ${Math.floor(days / 365)} year${days < 730 ? '' : 's'} ago`;
}


// Phase 2 of MyFit: compare a wishlist item against the matching brand's size chart.
// Returns { deltas, summary } or null if any required data is missing.
function computeFitAgainstChart({ item, shops, measurements }) {
  const targetSize = item?.size?.trim();
  const brand = item?.brand?.toLowerCase().trim();
  if (!targetSize || !brand) return null;
  const matchedShop = (shops || []).find((s) => s.name?.toLowerCase().trim() === brand);
  const chart = matchedShop?.sizes || [];
  const row = chart.find((r) => r.label?.toLowerCase().trim() === targetSize.toLowerCase());
  if (!row) return null;
  const m = { chest: parseFloat(measurements?.chest), waist: parseFloat(measurements?.waist), hips: parseFloat(measurements?.hips) };
  const axis = (rowVal, myVal) => {
    const r = parseFloat(rowVal), v = parseFloat(myVal);
    if (!r || !v) return null;
    const delta = r - v;
    return { delta, verdict: delta > 2 ? 'loose' : delta < -2 ? 'tight' : 'good' };
  };
  const deltas = { bust: axis(row.bust, m.chest), waist: axis(row.waist, m.waist), hips: axis(row.hips, m.hips) };
  if (!deltas.bust && !deltas.waist && !deltas.hips) return null;
  const anyTight = Object.values(deltas).some((d) => d?.verdict === 'tight');
  const anyLoose = Object.values(deltas).some((d) => d?.verdict === 'loose');
  const summary = anyTight && anyLoose ? 'Mixed fit — review' : anyTight ? 'Likely tight' : anyLoose ? 'Likely loose' : 'Should fit well';
  return { deltas, summary, brand: matchedShop.name, size: targetSize };
}

// Apply a subtle "auto-enhance" pass via CSS filters on canvas — slight contrast
// + saturation boost + tiny sharpen via brightness curve. Mimics what a phone
// photo would look like after a one-tap "auto" enhance in Photos.
function autoEnhanceCanvas(canvas) {
  const ctx = canvas.getContext('2d');
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  // Soft contrast + saturation lift (subtle: ~6%)
  const contrast = 1.08;
  const intercept = 128 * (1 - contrast);
  for (let i = 0; i < data.length; i += 4) {
    // Apply contrast curve to each channel
    data[i]     = Math.max(0, Math.min(255, data[i]     * contrast + intercept));
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] * contrast + intercept));
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] * contrast + intercept));
    // Saturation boost: nudge each channel away from the luminance
    const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const sat = 1.1;
    data[i]     = Math.max(0, Math.min(255, lum + (data[i]     - lum) * sat));
    data[i + 1] = Math.max(0, Math.min(255, lum + (data[i + 1] - lum) * sat));
    data[i + 2] = Math.max(0, Math.min(255, lum + (data[i + 2] - lum) * sat));
  }
  ctx.putImageData(new ImageData(data, canvas.width, canvas.height), 0, 0);
}

// Background removal via @imgly/background-removal. Lazy-imported (the model
// weights are ~5MB) so it only loads when the user has opted in AND added an
// image. Wrapped in try/catch with a hard fallback to the original data URL —
// the previous integration broke rendering, so failures must be silent.
async function removeImageBackground(dataUrl) {
  try {
    const { removeBackground } = await import('@imgly/background-removal');
    const blob = await (await fetch(dataUrl)).blob();
    const outBlob = await removeBackground(blob);

    // The raw output is a PNG with alpha — often ~3-5x the size of the source
    // JPEG. We composite onto a clean off-white background and re-encode as
    // JPEG so the saved image stays under Firestore's 1MiB doc budget. The
    // cream surface blends with the app's wardrobe cards (also cream) so the
    // visual difference vs. true transparency is invisible in context.
    const cutoutImg = await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = (e) => {
        const im = new Image();
        im.onload = () => resolve(im);
        im.onerror = reject;
        im.src = e.target.result;
      };
      fr.onerror = reject;
      fr.readAsDataURL(outBlob);
    });
    const maxW = 900;
    const scale = Math.min(1, maxW / cutoutImg.naturalWidth);
    const w = Math.round(cutoutImg.naturalWidth * scale);
    const h = Math.round(cutoutImg.naturalHeight * scale);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#FFFFFF'; // clean lookbook-flatlay background
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(cutoutImg, 0, 0, w, h);
    // Adaptive JPEG quality — keep under ~180KB to leave room in the doc.
    let q = 0.86;
    let cutoutUrl = c.toDataURL('image/jpeg', q);
    while (cutoutUrl.length > 220_000 && q > 0.45) {
      q -= 0.1;
      cutoutUrl = c.toDataURL('image/jpeg', q);
    }
    return { url: cutoutUrl, ok: true };
  } catch (e) {
    console.warn('[wardrobe] background removal failed, keeping original:', e?.message);
    return { url: dataUrl, ok: false, error: e?.message || 'unknown error' };
  }
}

// Adaptive image compression: tries decreasing quality until size budget is hit.
// Multi-photo items must fit under Firestore's ~1 MiB doc limit, so per-image
// budget is tight. Falls back through several quality levels before giving up.
// Optionally applies a subtle auto-enhance pass before compression.
async function compressImageToDataUrl(file, { maxWidth = 800, maxBytes = 150_000, enhance = true } = {}) {
  const img = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = (e) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = e.target.result; };
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  const canvas = document.createElement('canvas');
  const scale = img.width > maxWidth ? maxWidth / img.width : 1;
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  if (enhance) {
    try { autoEnhanceCanvas(canvas); } catch (e) { /* fall through to plain compression */ }
  }
  for (const quality of [0.75, 0.65, 0.55, 0.45, 0.35]) {
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    if (dataUrl.length <= maxBytes) return dataUrl;
  }
  throw new Error('Image is very complex — try a simpler shot or fewer photos.');
}

// Body shape classification from bust/waist/hips ratios.
// Same approach used by M&S "Find My Fit", ASOS, Stitch Fix etc. The result is
// general styling guidance, not per-item size prediction (that needs brand
// size charts, which is Phase 2). Returns null if measurements incomplete.
function classifyBodyShape({ chest, waist, hips }) {
  const b = parseFloat(chest), w = parseFloat(waist), h = parseFloat(hips);
  if (!b || !w || !h) return null;
  const bhDiff = Math.abs(b - h) / Math.max(b, h);
  const waistDefined = w < Math.min(b, h) * 0.78;
  if (w >= b - 2 && w >= h - 2) return 'Apple';
  if (bhDiff < 0.05 && waistDefined) return 'Hourglass';
  if (h - b >= 5) return 'Pear';
  if (b - h >= 5) return 'Inverted Triangle';
  return 'Rectangle';
}

// Widely accepted stylist guidance per body shape.
const BODY_SHAPE_GUIDES = {
  Hourglass: {
    blurb: 'Bust and hips are roughly balanced, with a clearly defined waist.',
    flatter: ['Wrap dresses and tops', 'Belted waists and high-rise bottoms', 'Pencil skirts and tailored trousers', 'V- and sweetheart necklines'],
    avoid: ['Boxy, shapeless cuts that hide the waist', 'Drop-waist silhouettes'],
  },
  Pear: {
    blurb: 'Hips are noticeably wider than the bust; a defined waist.',
    flatter: ['Structured shoulders and statement sleeves', 'Boat necks and off-shoulder tops', 'A-line skirts and dresses', 'Dark, sleek bottoms with brighter tops'],
    avoid: ['Tapered or skinny bottoms in light colours', 'Hip-pocket detailing that adds bulk'],
  },
  Apple: {
    blurb: 'Fuller around the midsection; bust and hips similar widths.',
    flatter: ['V-necks and open necklines to elongate', 'Empire waist or wrap dresses', 'A-line and flared bottoms', 'Structured jackets that skim the waist'],
    avoid: ['Clingy fabrics across the waist', 'High-waist bottoms with tucked-in tops', 'Belts that cinch tightly at the natural waist'],
  },
  Rectangle: {
    blurb: 'Bust, waist and hips are similar widths — long, lean lines.',
    flatter: ['Peplum tops and belted dresses to create curves', 'Ruffles, layers and texture', 'Wide-leg trousers paired with fitted tops', 'Wrap silhouettes and bias-cut skirts'],
    avoid: ['Box-cut shifts in heavy fabrics that flatten further', 'Very loose, tent-like dresses'],
  },
  'Inverted Triangle': {
    blurb: 'Shoulders or bust wider than the hips.',
    flatter: ['Full and A-line skirts to balance shoulders', 'Wide-leg trousers and bootcuts', 'V-necks and scoop necklines', 'Detail on the lower half: pockets, prints, texture'],
    avoid: ['Shoulder pads and puff sleeves', 'Boat necks and halters that widen further'],
  },
};

function itemSeasons(item) {
  if (Array.isArray(item?.seasons)) return item.seasons;
  if (typeof item?.season === 'string' && item.season && item.season !== 'All Seasons') {
    return [item.season];
  }
  return [];
}

// Public CORS proxies — tried in order until one works.
// Some block in mobile/PWA contexts; the fallback chain keeps the feature alive.
const CORS_PROXIES = [
  (u) => `https://corsproxy.io/?${encodeURIComponent(u)}`,
  (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
  (u) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
  (u) => `https://api.cors.lol/?url=${encodeURIComponent(u)}`,
  (u) => `https://corsproxy.org/?${encodeURIComponent(u)}`,
];

function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  return Promise.race([
    fetch(url, options),
    new Promise((_, rej) => setTimeout(() => rej(new Error('proxy timed out')), timeoutMs)),
  ]);
}

// Domain-level circuit breaker for the proxy chain. Scraper-hostile sites
// (e.g. Holland Cooper) block all 5 public proxies; without this, the wishlist
// watcher and bulk URL importer re-attack the same dead hosts every session
// and flood DevTools with CORS errors. After a full-chain failure we record
// the host with exponential backoff (1d → 2d → 4d → … capped at 30d) and
// short-circuit further attempts. Success clears the entry.
const BLOCKED_HOSTS_KEY = 'atelier.blockedHosts';
const HOST_BACKOFF_BASE_MS = 24 * 3600_000;
const HOST_BACKOFF_MAX_MS = 30 * 86_400_000;

function readBlockedHosts() {
  try {
    const raw = localStorage.getItem(BLOCKED_HOSTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}
function writeBlockedHosts(map) {
  try { localStorage.setItem(BLOCKED_HOSTS_KEY, JSON.stringify(map)); }
  catch { /* quota / private mode — fail open */ }
}
function isHostBlocked(host) {
  if (!host) return false;
  const entry = readBlockedHosts()[host];
  return !!entry && entry.nextRetryAt > Date.now();
}
function markHostFailed(host) {
  if (!host) return;
  const map = readBlockedHosts();
  const failCount = (map[host]?.failCount || 0) + 1;
  const wait = Math.min(HOST_BACKOFF_BASE_MS * 2 ** (failCount - 1), HOST_BACKOFF_MAX_MS);
  map[host] = { failCount, nextRetryAt: Date.now() + wait };
  writeBlockedHosts(map);
}
function clearHostBlock(host) {
  if (!host) return;
  const map = readBlockedHosts();
  if (!map[host]) return;
  delete map[host];
  writeBlockedHosts(map);
}

async function fetchViaProxy(url, options = {}) {
  const host = hostOf(url);
  if (isHostBlocked(host)) {
    throw new Error(`Skipped — ${host} is in cooldown after repeated proxy failures`);
  }
  const errors = [];
  for (const buildUrl of CORS_PROXIES) {
    try {
      const resp = await fetchWithTimeout(buildUrl(url), options);
      if (resp.ok) {
        clearHostBlock(host);
        return resp;
      }
      errors.push(`HTTP ${resp.status}`);
    } catch (err) {
      errors.push(err?.message || 'fetch failed');
    }
  }
  markHostFailed(host);
  throw new Error(`All ${CORS_PROXIES.length} proxies failed (${errors.slice(0, 3).join(' · ')})`);
}

// Download an image (through a public CORS proxy to bypass hotlink-block headers),
// resize it, and return a small base64 data URL we can persist inside Firestore.
async function imageUrlToCompressedDataUrl(url) {
  try {
    const resp = await fetchViaProxy(url);
    const blob = await resp.blob();
    if (!blob.type.startsWith('image/')) throw new Error('not an image');
    const file = new File([blob], 'product.jpg', { type: blob.type });
    return await compressImageToDataUrl(file, { maxWidth: 800, maxBytes: 150_000 });
  } catch (err) {
    console.warn('[wardrobe] image proxy fetch failed:', err);
    return null;
  }
}

// Parse Schema.org Product / Offer data out of a page's JSON-LD blocks.
// This is the most reliable place to find price, brand, and full descriptions —
// Open Graph rarely exposes price; Schema.org almost always does for e-commerce.
function extractSchemaFromHtml(html) {
  const out = {};
  const blocks = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const block of blocks) {
    const jsonText = block.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '').trim();
    let parsed;
    try { parsed = JSON.parse(jsonText); } catch { continue; }
    const items = Array.isArray(parsed) ? parsed : [parsed];
    const flat = items.flatMap((n) => (n && n['@graph'] ? n['@graph'] : [n]));
    for (const node of flat) {
      if (!node || typeof node !== 'object') continue;
      const type = Array.isArray(node['@type']) ? node['@type'].join(',') : (node['@type'] || '');
      if (!/Product/i.test(type)) continue;
      out.name = out.name || node.name;
      out.description = out.description || node.description;
      out.brand = out.brand || (typeof node.brand === 'string' ? node.brand : node.brand?.name);
      if (node.image) out.image = out.image || (Array.isArray(node.image) ? node.image[0] : node.image);
      const offers = Array.isArray(node.offers) ? node.offers[0] : node.offers;
      if (offers) {
        const price = offers.price ?? offers.lowPrice ?? offers.highPrice;
        if (price != null && !out.price) out.price = String(price);
        if (offers.priceCurrency && !out.currency) out.currency = offers.priceCurrency;
      }
    }
  }
  // Open Graph fallback for price.
  if (!out.price) {
    const m = html.match(/<meta\s+[^>]*?(?:property|name)=["'](?:og:price:amount|product:price:amount)["'][^>]*?content=["']([^"']+)["']/i);
    if (m) out.price = m[1];
  }
  return out;
}

// Strip tracking params + unwrap common search-engine redirect URLs so links
// from emails / Google / Bing / DuckDuckGo / Pinterest etc. extract cleanly.
// Real-world links often have 200+ chars of utm_/gclid/srsltid junk that
// proxies sometimes choke on.
function cleanProductUrl(rawUrl) {
  let working = (rawUrl || '').trim();
  if (!working) return '';

  // Sometimes URLs come URL-encoded (e.g. from copy-paste from a redirect param)
  if (/^https?%3A/i.test(working)) {
    try { working = decodeURIComponent(working); } catch { /* ignore */ }
  }

  // Some apps wrap URLs in newlines / quotes when shared
  working = working.replace(/^["'\s]+|["'\s]+$/g, '');

  // Iteratively unwrap redirects (some links double-wrap)
  for (let i = 0; i < 3; i++) {
    let changed = false;
    try {
      const u = new URL(working);
      const host = u.hostname.toLowerCase();
      // Google search: google.*/url?q=ACTUAL
      if (/^(www\.)?google\./.test(host) && u.pathname === '/url') {
        const target = u.searchParams.get('q') || u.searchParams.get('url');
        if (target) { working = target; changed = true; continue; }
      }
      // Google Shopping redirect
      if (host === 'www.google.com' && u.pathname === '/aclk') {
        const target = u.searchParams.get('adurl');
        if (target) { working = target; changed = true; continue; }
      }
      // Bing redirect: bing.com/ck/a?...&u=BASE64
      if (/bing\./.test(host)) {
        const target = u.searchParams.get('u');
        if (target) {
          try {
            // Bing encodes the target as base64 with a "a1" prefix
            const stripped = target.replace(/^a1/, '');
            const padded = stripped + '='.repeat((4 - stripped.length % 4) % 4);
            const decoded = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
            if (/^https?:\/\//i.test(decoded)) { working = decoded; changed = true; continue; }
          } catch { /* not base64, ignore */ }
        }
      }
      // DuckDuckGo: duckduckgo.com/l/?uddg=URL_ENCODED_ACTUAL
      if (/duckduckgo\./.test(host)) {
        const target = u.searchParams.get('uddg');
        if (target) { try { working = decodeURIComponent(target); changed = true; continue; } catch {} }
      }
      // Yahoo: r.search.yahoo.com/.../RU=URL/RK=...
      if (/yahoo\./.test(host) && u.pathname.includes('/RU=')) {
        const m = u.pathname.match(/\/RU=([^/]+)/);
        if (m) { try { working = decodeURIComponent(m[1]); changed = true; continue; } catch {} }
      }
      // Pinterest pin-out redirect
      if (/pinterest\./.test(host)) {
        const target = u.searchParams.get('url');
        if (target) { working = target; changed = true; continue; }
      }
      // Facebook l.facebook.com redirect
      if (host === 'l.facebook.com' || host === 'lm.facebook.com') {
        const target = u.searchParams.get('u');
        if (target) { try { working = decodeURIComponent(target); changed = true; continue; } catch {} }
      }
    } catch { /* not a URL, stop */ }
    if (!changed) break;
  }

  // Strip tracking params from the final URL
  try {
    const u = new URL(working);
    const TRACKING_PARAMS = new Set([
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'utm_id', 'utm_name',
      'fbclid', 'gclid', 'msclkid', 'dclid', 'gbraid', 'wbraid', 'twclid', 'yclid', 'srsltid',
      'mc_cid', 'mc_eid', 'mc_tc', '_ga', '_gl', 'igshid', 'cm_mmc',
      'ref', 'referrer', 'referer', 'source', 'campaign', 'cmpid', 'ICID', 'iclid', 'sscid',
      'sa', 'ved', 'usg', 'opi', 'rct', // Google trailing junk
      'ei', 'oq', 'esrc', 'biw', 'bih',
      'cvid', 'aqs', 'sourceid', 'ie', // Bing/MSN
      'epik', 'rd', // Pinterest
    ]);
    const TRACKING_PREFIXES = ['utm_', 'pk_', 'piwik_', 'matomo_', 'oly_'];
    for (const key of [...u.searchParams.keys()]) {
      if (TRACKING_PARAMS.has(key) || TRACKING_PREFIXES.some((p) => key.toLowerCase().startsWith(p))) {
        u.searchParams.delete(key);
      }
    }
    const cleaned = u.toString();
    if (cleaned !== rawUrl) console.log('[wardrobe] URL cleaned:', rawUrl.slice(0, 60) + '...', '→', cleaned);
    return cleaned;
  } catch {
    return working;
  }
}

// Best-effort metadata extraction from any product URL.
// Pipeline: Microlink (title/image/description) + raw HTML via proxy chain
// (JSON-LD price/brand/full desc). Each step is logged on failure so console
// shows which stage failed when a user reports issues.
async function fetchProductFromUrl(rawUrl) {
  const url = cleanProductUrl(rawUrl);
  let microlinkData = {};
  let microlinkError = null;
  try {
    const resp = await fetchWithTimeout(`https://api.microlink.io/?url=${encodeURIComponent(url)}`, {}, 10_000);
    if (resp.ok) {
      const json = await resp.json();
      if (json.status === 'success') microlinkData = json.data || {};
      else microlinkError = json.message || `Microlink ${json.status}`;
    } else {
      microlinkError = `Microlink HTTP ${resp.status}`;
    }
  } catch (err) {
    microlinkError = err?.message || 'Microlink network error';
  }
  if (microlinkError) console.warn('[wardrobe] microlink failed:', microlinkError);

  let schema = {};
  let schemaError = null;
  try {
    const htmlResp = await fetchViaProxy(url);
    const html = await htmlResp.text();
    schema = extractSchemaFromHtml(html);
  } catch (err) {
    schemaError = err?.message || 'Proxy network error';
    console.warn('[wardrobe] schema fetch failed:', schemaError);
  }

  if (!microlinkData.title && !schema.name) {
    const detail = [microlinkError, schemaError].filter(Boolean).join(' · ');
    throw new Error(
      `Couldn't read this link${detail ? ` (${detail})` : ''}. ` +
      `Try Manual Entry — you can paste the product image directly.`
    );
  }

  const rawImage = microlinkData.image?.url || schema.image || microlinkData.logo?.url || '';
  const localImage = rawImage ? await imageUrlToCompressedDataUrl(rawImage) : null;

  return {
    name: microlinkData.title || schema.name || '',
    brand: microlinkData.publisher || schema.brand || microlinkData.author || '',
    description: schema.description || microlinkData.description || '',
    price: schema.price || '',
    imageUrl: localImage || rawImage,
    sourceUrl: url,
  };
}

const userItemsRef = (uid) => collection(db, 'users', uid, 'items');
const userOutfitsRef = (uid) => collection(db, 'users', uid, 'outfits');
const userShopsRef = (uid) => collection(db, 'users', uid, 'shops');
const userInspirationRef = (uid) => collection(db, 'users', uid, 'inspiration');
const userAIHistoryRef = (uid) => collection(db, 'users', uid, 'aiHistory');
const userScheduleRef = (uid) => collection(db, 'users', uid, 'schedule');
const userScheduleDoc = (uid, dateISO) => doc(db, 'users', uid, 'schedule', dateISO);
const userProfileDoc = (uid) => doc(db, 'users', uid, 'profile', 'measurements');
const allowlistRef = () => collection(db, 'allowlist');
const allowlistDoc = (email) => doc(db, 'allowlist', email.toLowerCase().trim());
const publicShareDoc = (shareId) => doc(db, 'public', shareId);

// Short, URL-safe, lowly-collision share ID. 11 chars of base36 → ~57 bits.
function newShareId() {
  return [...crypto.getRandomValues(new Uint32Array(2))]
    .map((n) => n.toString(36)).join('').slice(0, 11);
}

export default function DigitalWardrobeRoot() {
  // Public share routing: if ?share=ID is in the URL, render the read-only
  // share viewer and skip auth entirely. The share doc is publicly readable.
  const shareId = (() => {
    try { return new URLSearchParams(window.location.search).get('share'); }
    catch { return null; }
  })();
  if (shareId) {
    return <ToastProvider><PublicShareView shareId={shareId} /></ToastProvider>;
  }
  return <ToastProvider><DigitalWardrobe /></ToastProvider>;
}

function DigitalWardrobe() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('wardrobe');
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);
  const [items, setItems] = useState([]);
  const [measurements, setMeasurements] = useState(INITIAL_MEASUREMENTS);
  const [shops, setShops] = useState([]);
  const [outfits, setOutfits] = useState([]);
  const [allowlist, setAllowlist] = useState([]);
  const [inspirations, setInspirations] = useState([]);
  const [selectedInspirationId, setSelectedInspirationId] = useState(null);
  const [isInspirationModalOpen, setIsInspirationModalOpen] = useState(false);
  const [aiHistory, setAiHistory] = useState([]);
  const [schedules, setSchedules] = useState({}); // { 'YYYY-MM-DD': { outfitId } }
  const selectedInspiration = selectedInspirationId ? inspirations.find((i) => i.id === selectedInspirationId) : null;
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isBulkImportModalOpen, setIsBulkImportModalOpen] = useState(false);
  const [isSweepModalOpen, setIsSweepModalOpen] = useState(false);
  const [inspirationDefaultFilter, setInspirationDefaultFilter] = useState('all');
  // When jumping to the Wardrobe tab from Insights (or anywhere else), seed
  // the filter/category so the user lands on a pre-filtered view instead of
  // having to drill down a second time. {nonce} forces re-application when
  // the same filter is re-requested.
  const [wardrobeJump, setWardrobeJump] = useState({ filter: null, category: null, nonce: 0 });
  const jumpToWardrobe = ({ filter = null, category = null } = {}) => {
    setWardrobeJump((p) => ({ filter, category, nonce: p.nonce + 1 }));
    setActiveTab('wardrobe');
  };
  const [shareTarget, setShareTarget] = useState(null); // { url, title, kind }
  const [editingItem, setEditingItem] = useState(null);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const liveItems = items.filter(isLive);
  const deletedItems = items.filter(isDeleted);
  const mainScrollRef = React.useRef(null);
  // Show a floating ↑ button once the user has scrolled. Universal fallback
  // for the safe-area top-tap (which is 0-height in non-PWA browsers where
  // env(safe-area-inset-top) reports 0). Deps include the auth state because
  // <main> only mounts after auth completes — without these, the effect runs
  // once at the auth-loading splash, finds no main element, and never
  // re-attaches the listener.
  const [showScrollTop, setShowScrollTop] = useState(false);
  useEffect(() => {
    const el = mainScrollRef.current;
    if (!el) return;
    const onScroll = () => setShowScrollTop(el.scrollTop > 200);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [authReady, user, accessDenied]);
  const scrollMainToTop = () => mainScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  useEffect(() => { mainScrollRef.current?.scrollTo({ top: 0, behavior: 'instant' }); }, [activeTab]);
  const selectedItem = selectedItemId ? items.find((i) => i.id === selectedItemId) : null;
  const [openOutfitId, setOpenOutfitId] = useState(null);
  const openOutfit = openOutfitId ? outfits.find((o) => o.id === openOutfitId) : null;

  const isOwner = !!(user?.email && OWNER_EMAILS.includes(user.email.toLowerCase()));

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
      setAccessDenied(false);
      if (!u) setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    setAccessDenied(false);

    const seedShopsIfEmpty = async () => {
      const snap = await getDocs(userShopsRef(user.uid));
      if (snap.empty) {
        const batch = writeBatch(db);
        SHOP_SEEDS.forEach((shop) => {
          const id = newId();
          batch.set(doc(userShopsRef(user.uid), id), { ...shop, id });
        });
        await batch.commit();
      }
    };
    seedShopsIfEmpty().catch((err) => {
      if (err?.code === 'permission-denied') { setAccessDenied(true); setLoading(false); }
      else console.error('shop seed failed', err);
    });

    const onPermErr = (err) => {
      if (err?.code === 'permission-denied') setAccessDenied(true);
      else console.error(err);
      setLoading(false);
    };

    const unsubItems = onSnapshot(userItemsRef(user.uid),
      (snap) => { setItems(snap.docs.map((d) => ({ ...d.data(), id: d.id }))); setLoading(false); },
      onPermErr
    );
    const unsubOutfits = onSnapshot(userOutfitsRef(user.uid),
      (snap) => setOutfits(snap.docs.map((d) => ({ ...d.data(), id: d.id }))),
      onPermErr
    );
    const unsubShops = onSnapshot(userShopsRef(user.uid),
      (snap) => setShops(snap.docs.map((d) => ({ ...d.data(), id: d.id }))),
      onPermErr
    );
    const unsubInspiration = onSnapshot(userInspirationRef(user.uid),
      (snap) => setInspirations(snap.docs.map((d) => ({ ...d.data(), id: d.id }))),
      onPermErr
    );
    const unsubAIHistory = onSnapshot(userAIHistoryRef(user.uid),
      (snap) => setAiHistory(snap.docs.map((d) => ({ ...d.data(), id: d.id }))),
      onPermErr
    );
    const unsubSchedule = onSnapshot(userScheduleRef(user.uid),
      (snap) => {
        const map = {};
        for (const d of snap.docs) map[d.id] = d.data();
        setSchedules(map);
      },
      onPermErr
    );
    const unsubProfile = onSnapshot(userProfileDoc(user.uid),
      (snap) => { if (snap.exists()) setMeasurements({ ...INITIAL_MEASUREMENTS, ...snap.data() }); },
      onPermErr
    );

    return () => { unsubItems(); unsubOutfits(); unsubShops(); unsubInspiration(); unsubAIHistory(); unsubSchedule(); unsubProfile(); };
  }, [user]);

  // Only owners can list the whole allowlist; everyone else just gets [].
  useEffect(() => {
    if (!isOwner) { setAllowlist([]); return; }
    return onSnapshot(allowlistRef(),
      (snap) => setAllowlist(snap.docs.map((d) => ({ email: d.id, ...d.data() }))),
      (err) => console.error('allowlist subscribe failed', err)
    );
  }, [isOwner]);

  const handleAddItem = async (newItem) => {
    if (!user) return;
    await setDoc(doc(userItemsRef(user.uid), newItem.id), newItem);
  };
  const handleBulkUpdateItems = async (ids, partial) => {
    if (!user || !ids.length) return;
    const batch = writeBatch(db);
    for (const id of ids) {
      const item = items.find((i) => i.id === id);
      if (!item) continue;
      batch.set(doc(userItemsRef(user.uid), id), { ...item, ...partial });
    }
    await batch.commit();
    toast.show(`Updated ${ids.length} item${ids.length === 1 ? '' : 's'}`, { kind: 'success' });
  };
  const handleBulkDeleteItems = async (ids) => {
    if (!user || !ids.length) return;
    const batch = writeBatch(db);
    const now = new Date().toISOString();
    for (const id of ids) {
      const item = items.find((i) => i.id === id);
      if (!item) continue;
      batch.set(doc(userItemsRef(user.uid), id), { ...item, deletedAt: now });
    }
    await batch.commit();
    toast.show(`Moved ${ids.length} item${ids.length === 1 ? '' : 's'} to Trash`, { kind: 'default' });
  };

  const handleBulkAddItems = async (newItems) => {
    if (!user || !newItems.length) return;
    const batch = writeBatch(db);
    for (const item of newItems) batch.set(doc(userItemsRef(user.uid), item.id), item);
    await batch.commit();
    toast.show(`${newItems.length} item${newItems.length === 1 ? '' : 's'} added from receipt`, { kind: 'success' });
  };
  const handleDeleteItem = async (id) => {
    if (!user) return;
    const item = items.find((i) => i.id === id);
    if (!item) return;
    // Soft delete: 30-day grace period (restorable from Profile → Trash).
    await setDoc(doc(userItemsRef(user.uid), id), { ...item, deletedAt: new Date().toISOString() });
    toast.show('Moved to Trash · restore from Profile', { kind: 'default' });
  };
  const handleRestoreItem = async (id) => {
    if (!user) return;
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const { deletedAt, ...rest } = item;
    await setDoc(doc(userItemsRef(user.uid), id), rest);
    toast.show('Restored to your wardrobe', { kind: 'success' });
  };
  const handleHardDeleteItem = async (id) => {
    if (!user) return;
    await deleteDoc(doc(userItemsRef(user.uid), id));
    toast.show('Permanently removed', { kind: 'default' });
  };

  // Auto-purge items soft-deleted more than 30 days ago. Runs once when
  // the user's items first load; quietly batches up to 50 per pass so a
  // huge backlog doesn't blow the writeBatch limit.
  const purgedRef = React.useRef(false);
  useEffect(() => {
    if (!user || purgedRef.current || items.length === 0) return;
    purgedRef.current = true;
    const cutoff = Date.now() - 30 * 86_400_000;
    const stale = items.filter((i) => i.deletedAt && new Date(i.deletedAt).getTime() < cutoff).slice(0, 50);
    if (stale.length === 0) return;
    (async () => {
      const batch = writeBatch(db);
      for (const it of stale) batch.delete(doc(userItemsRef(user.uid), it.id));
      try { await batch.commit(); } catch { /* silent — not user-blocking */ }
    })();
  }, [user, items.length]);

  // Wishlist price watcher. Once per app session, scan wishlist items with a
  // sourceUrl whose last check was > 24h ago. Re-fetch via Microlink+schema,
  // append to priceHistory[], toast on >5% drop. Stops after 6 refreshes per
  // session to be polite to free APIs.
  const priceWatchRef = React.useRef(false);
  useEffect(() => {
    if (!user || priceWatchRef.current || items.length === 0) return;
    priceWatchRef.current = true;
    (async () => {
      const dayAgo = Date.now() - 24 * 3600_000;
      const candidates = items
        .filter((i) => i.status === 'wishlist' && i.sourceUrl && !i.deletedAt)
        .filter((i) => !i.priceCheckedAt || new Date(i.priceCheckedAt).getTime() < dayAgo)
        .slice(0, 6);
      if (candidates.length === 0) return;
      for (const it of candidates) {
        try {
          const data = await fetchProductFromUrl(it.sourceUrl);
          const newPrice = Number(data.price);
          if (!Number.isFinite(newPrice) || newPrice <= 0) {
            await setDoc(doc(userItemsRef(user.uid), it.id), { ...it, priceCheckedAt: new Date().toISOString() });
            continue;
          }
          const oldPrice = Number(it.price) || 0;
          const history = Array.isArray(it.priceHistory) ? it.priceHistory : [];
          const lastLogged = history[history.length - 1]?.price ?? oldPrice;
          const next = lastLogged === newPrice ? history : [...history, { date: new Date().toISOString().slice(0, 10), price: newPrice }].slice(-30);
          await setDoc(doc(userItemsRef(user.uid), it.id), {
            ...it, price: newPrice, priceHistory: next, priceCheckedAt: new Date().toISOString(),
          });
          if (oldPrice > 0 && newPrice < oldPrice * 0.95) {
            const drop = Math.round((1 - newPrice / oldPrice) * 100);
            toast.show(`${it.name}: ${drop}% off · now £${newPrice}`, { kind: 'success', duration: 6000 });
          }
        } catch {
          // Persist the attempt timestamp so a permanently failing URL doesn't
          // get re-scanned on every app load. Without this, the 24h gate above
          // never engages for failing items and the proxy chain runs forever.
          try {
            await setDoc(doc(userItemsRef(user.uid), it.id), { ...it, priceCheckedAt: new Date().toISOString() });
          } catch { /* offline / firestore down — accept the retry next time */ }
        }
      }
    })();
  }, [user, items.length]);
  const handleSaveOutfit = async (outfit) => {
    if (!user) return;
    await setDoc(doc(userOutfitsRef(user.uid), outfit.id), outfit);
    // Capsule generator handles its own summary toast — don't spam per-look here.
    if (!outfit.capsule) {
      toast.show(`Look "${outfit.name}" saved`, { kind: 'success' });
    }
  };
  const handleDeleteOutfit = async (id) => {
    if (!user) return;
    await deleteDoc(doc(userOutfitsRef(user.uid), id));
  };
  // Snapshot a collection of outfits as a lookbook. Same /public/{shareId}
  // shape as single shares; the public viewer renders kind === 'lookbook'
  // as a vertical list of outfits with a sticky contents nav.
  const handleShareLookbook = async ({ name, outfitIds }) => {
    if (!user) return null;
    const picked = outfitIds.map((id) => outfits.find((o) => o.id === id)).filter(Boolean);
    if (picked.length === 0) return null;
    const looks = picked.map((outfit) => ({
      id: outfit.id,
      name: outfit.name || 'Untitled look',
      reasoning: outfit.reasoning || '',
      pieces: resolveOutfitItems(outfit, items).map((p) => ({
        id: p.id,
        name: p.name,
        brand: p.brand || '',
        category: p.category || '',
        subCategory: p.subCategory || '',
        images: (Array.isArray(p.images) ? p.images : (p.image ? [p.image] : [])).slice(0, 1),
        colors: itemColors(p),
      })),
    }));
    const shareId = newShareId();
    const title = (name || '').trim() || `Lookbook · ${picked.length} looks`;
    const snapshot = {
      v: 1,
      kind: 'lookbook',
      name: title,
      sharedAt: new Date().toISOString(),
      sharedByName: user.displayName || 'Atelier',
      looks,
    };
    await setDoc(publicShareDoc(shareId), snapshot);
    const url = `${window.location.origin}/?share=${shareId}`;
    setShareTarget({ url, title, kind: 'lookbook' });
    return url;
  };

  // Snapshot the outfit (+ resolved item summaries) into /public/{shareId} so
  // anyone with the link can view, even unauthenticated. Embeds image data URLs
  // directly — the share doc is self-contained, no follow-up reads required.
  const handleShareOutfit = async (outfit) => {
    if (!user) return null;
    const pieces = resolveOutfitItems(outfit, items).map((p) => ({
      id: p.id,
      name: p.name,
      brand: p.brand || '',
      category: p.category || '',
      subCategory: p.subCategory || '',
      images: (Array.isArray(p.images) ? p.images : (p.image ? [p.image] : [])).slice(0, 1),
      colors: itemColors(p),
    }));
    const shareId = newShareId();
    const title = outfit.name || 'Untitled look';
    const snapshot = {
      v: 1,
      kind: 'outfit',
      name: title,
      reasoning: outfit.reasoning || '',
      sharedAt: new Date().toISOString(),
      sharedByName: user.displayName || 'Atelier',
      pieces,
    };
    await setDoc(publicShareDoc(shareId), snapshot);
    const url = `${window.location.origin}/?share=${shareId}`;
    setShareTarget({ url, title, kind: 'outfit' });
    return url;
  };

  // Single wishlist/owned item shared as a self-contained public page.
  // Mirrors handleShareOutfit: snapshots image + key metadata into
  // /public/{shareId} so the page is viewable by anyone with the link,
  // unauthenticated. Useful for "should I buy this?" texts to friends.
  const handleShareItem = async (item) => {
    if (!user) return null;
    const shareId = newShareId();
    const title = item.name || 'A piece';
    const snapshot = {
      v: 1,
      kind: 'item',
      name: title,
      brand: item.brand || '',
      category: item.category || '',
      subCategory: item.subCategory || '',
      price: Number(item.price) || 0,
      status: item.status || 'owned',
      colors: itemColors(item),
      materials: itemMaterials(item),
      styles: itemStyles(item),
      seasons: itemSeasons(item),
      description: item.description || '',
      wishlistReason: item.wishlistReason || '',
      images: (Array.isArray(item.images) ? item.images : (item.image ? [item.image] : [])).slice(0, 3),
      sourceUrl: item.sourceUrl || '',
      sharedAt: new Date().toISOString(),
      sharedByName: user.displayName || 'Atelier',
    };
    await setDoc(publicShareDoc(shareId), snapshot);
    const url = `${window.location.origin}/?share=${shareId}`;
    setShareTarget({ url, title, kind: 'item' });
    return url;
  };

  const handleSaveProfile = async (newMeasurements) => {
    if (!user) return;
    await setDoc(userProfileDoc(user.uid), newMeasurements);
  };
  const handleSaveShop = async (shop) => {
    if (!user) return;
    await setDoc(doc(userShopsRef(user.uid), shop.id), shop);
  };
  const handleDeleteShop = async (id) => {
    if (!user) return;
    await deleteDoc(doc(userShopsRef(user.uid), id));
  };
  const handleAddInvite = async (rawEmail, displayName = '') => {
    const email = rawEmail?.trim().toLowerCase();
    if (!email || !email.includes('@')) throw new Error('Please enter a valid email.');
    await setDoc(allowlistDoc(email), {
      addedBy: user.email,
      addedAt: new Date().toISOString(),
      ...(displayName ? { displayName } : {}),
    });
  };
  const handleRemoveInvite = async (email) => {
    if (OWNER_EMAILS.includes(email)) throw new Error('Owners cannot be revoked from the allowlist.');
    await deleteDoc(allowlistDoc(email));
  };
  const handleSaveAIHistory = async (entry) => {
    if (!user) return;
    await setDoc(doc(userAIHistoryRef(user.uid), entry.id), entry);
    // Auto-prune to keep most recent 50
    if (aiHistory.length >= 50) {
      const sorted = [...aiHistory].sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
      const toDelete = sorted.slice(0, aiHistory.length - 49);
      for (const old of toDelete) {
        deleteDoc(doc(userAIHistoryRef(user.uid), old.id)).catch(() => {});
      }
    }
  };
  const handleDeleteAIHistory = async (id) => {
    if (!user) return;
    await deleteDoc(doc(userAIHistoryRef(user.uid), id));
  };
  const handleToggleAIHistoryFavorite = async (entry) => {
    if (!user) return;
    await setDoc(doc(userAIHistoryRef(user.uid), entry.id), { ...entry, favorite: !entry.favorite });
  };
  const handleScheduleOutfit = async (dateISO, outfitId) => {
    if (!user) return;
    if (!outfitId) {
      await deleteDoc(userScheduleDoc(user.uid, dateISO));
      toast.show('Removed from schedule', { kind: 'default' });
    } else {
      await setDoc(userScheduleDoc(user.uid, dateISO), { outfitId, scheduledAt: new Date().toISOString() });
      toast.show('Scheduled', { kind: 'success' });
    }
  };

  const handleSaveInspiration = async (insp) => {
    if (!user) return;
    await setDoc(doc(userInspirationRef(user.uid), insp.id), insp);
  };
  const handleDeleteInspiration = async (id) => {
    if (!user) return;
    await deleteDoc(doc(userInspirationRef(user.uid), id));
    toast.show('Inspiration removed', { kind: 'default' });
  };
  const handleAnalyzeInspiration = async (insp) => {
    if (!user) return;
    const analysis = await analyzeInspirationWithGemini({ imageDataUrl: insp.image, items: liveItems });
    await setDoc(doc(userInspirationRef(user.uid), insp.id), { ...insp, analysis });
    toast.show('Analysis complete', { kind: 'success' });
  };

  const handleDuplicateItem = async (item) => {
    if (!user) return;
    const copy = {
      ...item,
      id: newId(),
      name: `${item.name} (copy)`,
      createdAt: new Date().toISOString(),
      wearHistory: [], // fresh wear log for the duplicate
    };
    delete copy.deletedAt;
    await handleAddItem(copy);
    toast.show('Duplicated — edit colour/photos', { kind: 'success' });
    setSelectedItemId(null);
    setEditingItem(copy);
    setIsAddItemModalOpen(true);
  };

  const handleToggleFavorite = async (item) => {
    if (!user) return;
    haptic('tap');
    await handleAddItem({ ...item, favorite: !item.favorite });
    toast.show(item.favorite ? 'Removed from favourites' : 'Added to favourites', { kind: 'success', duration: 1400 });
  };
  const handleLogWear = async (item, dateISO = todayISO()) => {
    if (!user) return;
    const history = itemWearHistory(item);
    if (history.includes(dateISO)) return; // already logged for this date
    await handleAddItem({ ...item, wearHistory: [...history, dateISO].sort() });
    const newCount = history.length + 1;
    const cpw = itemCostPerWear({ ...item, wearHistory: [...history, dateISO] });
    haptic('success');
    toast.show(
      `Logged · ${newCount} ${newCount === 1 ? 'wear' : 'wears'}${cpw !== null ? ` · £${cpw < 10 ? cpw.toFixed(2) : Math.round(cpw)}/wear` : ''}`,
      { kind: 'success' }
    );
  };
  const handleUnlogWear = async (item, dateISO) => {
    if (!user) return;
    const history = itemWearHistory(item).filter((d) => d !== dateISO);
    const notes = { ...itemWearNotes(item) };
    delete notes[dateISO];
    await handleAddItem({ ...item, wearHistory: history, wearNotes: notes });
  };
  const handleMarkCared = async (item) => {
    if (!user) return;
    await handleAddItem({ ...item, caredAtWear: itemWearCount(item), caredAt: new Date().toISOString() });
    toast.show('Marked as cared for — next reminder when due', { kind: 'success' });
  };

  // Cascade a single wear-log across every item in an outfit. One batch write,
  // optional shared verdict written to each item's wearNotes. Skips items
  // already logged for that date (idempotent if user taps twice).
  const handleLogOutfitWear = async (outfit, dateISO = todayISO(), verdict = '') => {
    if (!user || !outfit) return;
    const pieces = resolveOutfitItems(outfit, items);
    if (pieces.length === 0) return;
    const batch = writeBatch(db);
    let touched = 0;
    for (const p of pieces) {
      const hist = itemWearHistory(p);
      if (hist.includes(dateISO)) continue;
      const notes = { ...itemWearNotes(p) };
      const v = (verdict || '').trim();
      if (v) notes[dateISO] = v;
      batch.set(doc(userItemsRef(user.uid), p.id), {
        ...p,
        wearHistory: [...hist, dateISO].sort(),
        wearNotes: notes,
      });
      touched++;
    }
    if (touched === 0) { toast.show('Already logged for today', { kind: 'default' }); return; }
    await batch.commit();
    haptic('success');
    toast.show(`Logged "${outfit.name}" · ${touched} ${touched === 1 ? 'piece' : 'pieces'}`, { kind: 'success' });
    // Fire-and-forget Gemini narration. Won't block the wear log.
    try {
      const weather = (() => { try { return JSON.parse(localStorage.getItem('atelier-weather') || 'null')?.data; } catch { return null; } })();
      const recentLog = pieces.flatMap((p) => (itemWearHistory(p) || []).map((d) => ({ date: d, name: p.name }))).slice(-5);
      const line = await narrateWearWithGemini({ outfit, items, recentLog, weather });
      if (line) toast.show(line, { kind: 'default', duration: 6500 });
    } catch { /* AI offline — no problem */ }
  };
  const handleSetWearNote = async (item, dateISO, note) => {
    if (!user) return;
    const notes = { ...itemWearNotes(item) };
    const trimmed = (note || '').trim();
    if (trimmed) notes[dateISO] = trimmed; else delete notes[dateISO];
    await handleAddItem({ ...item, wearNotes: notes });
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Jost:wght@300;400;500;600&family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400&display=swap');
        .font-display { font-family: 'Playfair Display', serif; }
        .font-sans { font-family: 'Jost', sans-serif; }
        .glass-panel { background: rgba(255, 255, 255, 0.65); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.4); }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .smooth-shadow { box-shadow: 0 10px 40px -10px rgba(0,0,0,0.08); }
        body { background-color: #F7F5F2; }
      `}</style>

      {!authReady ? (
        <FullScreenLoader label="Opening your atelier" />
      ) : !user ? (
        <SignInScreen onSignIn={signInWithGoogle} />
      ) : accessDenied ? (
        <AccessDeniedScreen user={user} onSignOut={signOutUser} />
      ) : (
        <div className="flex font-sans text-stone-900 overflow-hidden bg-[#F7F5F2] w-full"
             style={{ height: 'var(--app-vh, 100dvh)' }}>
          <aside className="hidden lg:flex flex-col w-72 bg-[#F7F5F2] border-r border-stone-200/60 px-8 pb-8 h-full" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 3rem)' }}>
            {/* Logo block height + this margin is tuned so the first nav pill
                (Wardrobe) sits at the same Y as the search bar in the main
                column. Math: main scroll-container has the page header
                (~144px tall) + 8px gap; sidebar has 48px top padding +
                ~42px logo. So mb ≈ 144 + 8 - 48 - 42 ≈ 62px → mb-[3.875rem]
                rounded to mb-16 (4rem) for the cleanest visual baseline. */}
            <div className="flex items-center gap-3 mb-16">
              <AtelierMark size={42} />
              <h1 className="text-3xl font-display font-medium tracking-wide">Atelier.</h1>
            </div>

            <nav className="space-y-2 flex-1">
              <DesktopNavItem id="wardrobe" icon={LayoutGrid} label="Wardrobe" activeTab={activeTab} setTab={setActiveTab} />
              <DesktopNavItem id="outfits" icon={Camera} label="Styling Studio" activeTab={activeTab} setTab={setActiveTab} />
              <DesktopNavItem id="inspiration" icon={Bookmark} label="Inspiration" activeTab={activeTab} setTab={(id) => { setInspirationDefaultFilter('all'); setActiveTab(id); }} />
              <DesktopNavItem id="finance" icon={PoundSterling} label="Insights" activeTab={activeTab} setTab={setActiveTab} />
              <DesktopNavItem id="profile" icon={Ruler} label="Profile" activeTab={activeTab} setTab={setActiveTab} />
              <DesktopNavItem id="shops" icon={Store} label="Directory" activeTab={activeTab} setTab={setActiveTab} />
            </nav>

            <div className="border-t border-stone-200/60 pt-5 mt-6">
              <button onClick={() => setActiveTab('profile')}
                className="w-full flex items-center gap-3.5 px-2 py-2.5 rounded-2xl hover:bg-white hover:smooth-shadow transition-all group"
              >
                {user.photoURL ? (
                  <img src={user.photoURL} alt="" className="w-12 h-12 rounded-full ring-2 ring-stone-100 shrink-0" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-stone-900 text-white flex items-center justify-center font-display text-base shrink-0">
                    {(user.displayName || user.email || '?').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium text-stone-900 truncate">{user.displayName || 'Account'}</p>
                  <p className="text-[11px] text-stone-500 truncate">{user.email}</p>
                </div>
                <ChevronRight size={14} className="text-stone-300 group-hover:text-stone-500 transition-colors shrink-0" strokeWidth={1.5} />
              </button>
              {/* Sign out — left-aligned with profile-row content above (matches
                  the 12px avatar + 14px gap so the icon lines up under the name). */}
              <button onClick={signOutUser} className="w-full flex items-center gap-2 mt-2 px-2 py-2 rounded-xl text-[10px] tracking-widest uppercase text-stone-400 hover:bg-stone-200/50 hover:text-stone-700 transition-colors">
                <span className="w-12 flex items-center justify-center shrink-0">
                  <LogOut size={12} strokeWidth={1.5} />
                </span>
                <span>Sign out</span>
              </button>
            </div>
          </aside>

          <main ref={mainScrollRef} className="flex-1 overflow-y-auto overflow-x-hidden lg:pb-0 relative scroll-smooth hide-scrollbar"
                style={{
                  paddingTop: 'env(safe-area-inset-top, 0px)',
                  paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 7rem)',
                }}>
            <div className="p-4 sm:p-6 lg:p-12 max-w-6xl mx-auto min-h-full w-full lg:pb-0">
              {loading ? (
                <WardrobeSkeleton />
              ) : (
                <div key={activeTab} className="animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
                  {activeTab === 'wardrobe' && <WardrobeView items={liveItems} deleteItem={handleDeleteItem} openAddModal={() => setIsAddItemModalOpen(true)} measurements={measurements} onItemClick={setSelectedItemId} user={user} onToggleFavorite={handleToggleFavorite} schedules={schedules} outfits={outfits} onOpenOutfit={setOpenOutfitId} onBulkUpdate={handleBulkUpdateItems} onBulkDelete={handleBulkDeleteItems} onScheduleOutfit={handleScheduleOutfit} onSaveOutfit={handleSaveOutfit} onLogOutfitWear={handleLogOutfitWear} inspirations={inspirations} onOpenInspiration={setSelectedInspirationId} onOpenInspirationTab={() => { setInspirationDefaultFilter('unanalysed'); setActiveTab('inspiration'); }} aiTemperature={AI_TEMPERATURE_PRESETS[measurements?.aiTemperaturePreset] ?? 0.7} onScrollTop={scrollMainToTop} jumpFilter={wardrobeJump.filter} jumpCategory={wardrobeJump.category} jumpNonce={wardrobeJump.nonce} />}
                  {activeTab === 'outfits' && (
                    <OutfitBuilder
                      items={liveItems}
                      outfits={outfits}
                      saveOutfit={handleSaveOutfit}
                      deleteOutfit={handleDeleteOutfit}
                      onOpenOutfit={setOpenOutfitId}
                      aiHistory={aiHistory}
                      saveAIHistory={handleSaveAIHistory}
                      deleteAIHistory={handleDeleteAIHistory}
                      toggleAIHistoryFavorite={handleToggleAIHistoryFavorite}
                      schedules={schedules}
                      scheduleOutfit={handleScheduleOutfit}
                      aiTemperature={AI_TEMPERATURE_PRESETS[measurements?.aiTemperaturePreset] ?? 0.7}
                      styleProfile={summariseStyleProfile(measurements)}
                      onCreateLookbook={handleShareLookbook}
                    />
                  )}
                  {activeTab === 'finance' && <FinanceView items={liveItems} inspirations={inspirations} onJumpToWardrobe={jumpToWardrobe} />}
                  {activeTab === 'profile' && (
                    <ProfileView
                      user={user}
                      measurements={measurements}
                      saveMeasurements={handleSaveProfile}
                      isOwner={isOwner}
                      allowlist={allowlist}
                      addInvite={handleAddInvite}
                      removeInvite={handleRemoveInvite}
                      items={liveItems}
                      deletedItems={deletedItems}
                      outfits={outfits}
                      inspirations={inspirations}
                      shops={shops}
                      onRestoreItem={handleRestoreItem}
                      onHardDeleteItem={handleHardDeleteItem}
                      onUpdateItem={handleAddItem}
                    />
                  )}
                  {activeTab === 'shops' && (
                    <ShoppingDirectory
                      shops={shops}
                      saveShop={handleSaveShop}
                      deleteShop={handleDeleteShop}
                    />
                  )}
                  {activeTab === 'inspiration' && (
                    <InspirationView
                      inspirations={inspirations}
                      onOpenInspiration={setSelectedInspirationId}
                      onAddInspiration={() => setIsInspirationModalOpen(true)}
                      defaultFilter={inspirationDefaultFilter}
                      wishlistCount={liveItems.filter((i) => i.status === 'wishlist').length}
                      onJumpToWishlist={() => jumpToWardrobe({ filter: 'wishlist' })}
                    />
                  )}
                </div>
              )}
            </div>
          </main>

          {/* iOS-style "tap the status bar to scroll to top". The safe-area
              inset is the notch / Dynamic-Island strip on iPhone PWA, where
              this element gets its tap height. In normal mobile browsers the
              inset is 0 — so we ALSO render a visible ↑ button below as a
              universal fallback once the user has scrolled past a screen. */}
          <button
            type="button"
            onClick={scrollMainToTop}
            className="lg:hidden fixed top-0 left-0 right-0 z-30"
            style={{ height: 'env(safe-area-inset-top, 0px)' }}
            aria-label="Scroll to top"
            tabIndex={-1}
          />
          {showScrollTop && (
            <button
              type="button"
              onClick={scrollMainToTop}
              className="lg:hidden fixed right-4 z-30 w-11 h-11 rounded-full bg-stone-900 text-white shadow-2xl flex items-center justify-center active:scale-90 hover:bg-stone-800 transition-all animate-in fade-in slide-in-from-bottom-2 duration-200"
              style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)' }}
              aria-label="Scroll to top"
            >
              <ChevronUp size={20} strokeWidth={2} />
            </button>
          )}

          <div className="lg:hidden fixed bottom-0 left-0 right-0 glass-panel border-t border-white/50 px-2 sm:px-6 pt-2 z-40 smooth-shadow"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.5rem)' }}>
            <div className="flex justify-between items-center max-w-md mx-auto py-1">
              <MobileNavItem id="wardrobe" icon={LayoutGrid} label="Wardrobe" activeTab={activeTab} setTab={setActiveTab} onScrollTop={scrollMainToTop} />
              <MobileNavItem id="inspiration" icon={Bookmark} label="Inspire" activeTab={activeTab} setTab={(id) => { setInspirationDefaultFilter('all'); setActiveTab(id); }} onScrollTop={scrollMainToTop} />
              <div className="relative -top-7">
                <button onClick={() => setIsAddItemModalOpen(true)}
                  className="w-16 h-16 shrink-0 bg-stone-900 rounded-full flex items-center justify-center text-white transition-all active:scale-90 hover:scale-105 ring-4 ring-[#F7F5F2]"
                  style={{ boxShadow: '0 10px 30px -8px rgba(28, 25, 23, 0.45)' }}
                  aria-label="Add item"
                >
                  <Plus size={26} strokeWidth={1.5} />
                </button>
              </div>
              <MobileNavItem id="outfits" icon={Camera} label="Styling" activeTab={activeTab} setTab={setActiveTab} onScrollTop={scrollMainToTop} />
              <MobileNavItem id="profile" icon={Ruler} label="Profile" activeTab={activeTab} setTab={setActiveTab} onScrollTop={scrollMainToTop} />
            </div>
          </div>

          <PwaInstallNudge hasContent={liveItems.length > 0} />
          <NotificationManager items={liveItems} outfits={outfits} schedules={schedules} />
          <OnboardingTour onJumpTo={(tab) => setActiveTab(tab)} />

          {shareTarget && (
            <ShareLinkModal
              url={shareTarget.url}
              title={shareTarget.title}
              kind={shareTarget.kind}
              onClose={() => setShareTarget(null)}
            />
          )}

          {isAddItemModalOpen && (
            <AddItemModal
              user={user}
              shops={shops}
              existingItem={editingItem}
              removeBackground={!!measurements?.removeBackground}
              onClose={() => { setIsAddItemModalOpen(false); setEditingItem(null); }}
              onSave={async (item) => { await handleAddItem(item); setIsAddItemModalOpen(false); setEditingItem(null); }}
              onOpenReceiptModal={() => { setIsAddItemModalOpen(false); setIsReceiptModalOpen(true); }}
              onOpenBulkImport={() => { setIsAddItemModalOpen(false); setIsBulkImportModalOpen(true); }}
              onOpenSweep={() => { setIsAddItemModalOpen(false); setIsSweepModalOpen(true); }}
            />
          )}

          {isReceiptModalOpen && (
            <ReceiptImportModal
              onClose={() => setIsReceiptModalOpen(false)}
              onBulkSave={async (newItems) => {
                await handleBulkAddItems(newItems);
                setIsReceiptModalOpen(false);
              }}
            />
          )}

          {isBulkImportModalOpen && (
            <BulkImportModal
              shops={shops}
              onClose={() => setIsBulkImportModalOpen(false)}
              onBulkSave={async (newItems) => {
                await handleBulkAddItems(newItems);
                setIsBulkImportModalOpen(false);
              }}
            />
          )}

          {isSweepModalOpen && (
            <ClosetSweepModal
              shops={shops}
              onClose={() => setIsSweepModalOpen(false)}
              onBulkSave={async (newItems) => {
                await handleBulkAddItems(newItems);
                setIsSweepModalOpen(false);
              }}
            />
          )}

          {isInspirationModalOpen && (
            <AddInspirationModal
              onClose={() => setIsInspirationModalOpen(false)}
              onSave={async (insp) => { await handleSaveInspiration(insp); setIsInspirationModalOpen(false); toast.show('Saved to Inspiration', { kind: 'success' }); }}
            />
          )}

          {selectedInspiration && (
            <InspirationDetailView
              inspiration={selectedInspiration}
              items={liveItems}
              shops={shops}
              onClose={() => setSelectedInspirationId(null)}
              onAnalyze={() => handleAnalyzeInspiration(selectedInspiration)}
              onDelete={async () => { await handleDeleteInspiration(selectedInspiration.id); setSelectedInspirationId(null); }}
              onOpenItem={(id) => { setSelectedInspirationId(null); setSelectedItemId(id); }}
              onRecreateLook={async () => {
                const ins = selectedInspiration;
                const ids = (ins.analysis?.wardrobeMatchIds || []).filter((id) => liveItems.some((i) => i.id === id));
                if (ids.length === 0) { toast.show('No wardrobe matches to compose from', { kind: 'default' }); return; }
                const outfit = {
                  id: newId(),
                  name: ins.caption ? `Like · ${ins.caption.slice(0, 40)}` : `Like · Inspiration ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`,
                  itemIds: ids,
                  createdAt: new Date().toISOString(),
                  reasoning: ins.analysis?.summary || '',
                  intent: 'recreated from inspiration',
                  inspirationId: ins.id,
                };
                await handleSaveOutfit(outfit);
                setSelectedInspirationId(null);
                setOpenOutfitId(outfit.id);
              }}
              onAddMissingToWishlist={async (piece) => {
                const ins = selectedInspiration;
                const newItem = {
                  id: newId(),
                  name: piece,
                  brand: '',
                  price: 0,
                  category: 'Tops',
                  subCategory: '',
                  status: 'wishlist',
                  seasons: [], styles: [], images: ins.image ? [ins.image] : [], colors: [], care: [], materials: [],
                  description: '',
                  sourceUrl: '',
                  wishlistReason: ins.caption ? `From inspiration: ${ins.caption}` : 'From an inspiration',
                  inspirationId: ins.id,
                  createdAt: new Date().toISOString(),
                };
                await handleAddItem(newItem);
                toast.show(`Added "${piece}" to wishlist`, { kind: 'success' });
              }}
              onSaveAsWishlist={async () => {
                const ins = selectedInspiration;
                const sourceHost = (() => { try { return new URL(ins.sourceUrl).hostname.replace(/^www\./, ''); } catch { return ''; } })();
                const newItem = {
                  id: newId(),
                  name: ins.caption?.trim() || `Inspiration · ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`,
                  brand: '',
                  price: 0,
                  category: 'Tops',
                  subCategory: '',
                  status: 'wishlist',
                  seasons: [], styles: [], colors: [], care: [], materials: [],
                  images: ins.image ? [ins.image] : [],
                  description: ins.notes || '',
                  sourceUrl: ins.sourceUrl || '',
                  wishlistReason: sourceHost
                    ? `Saved from inspiration · ${sourceHost}`
                    : 'Saved from an inspiration',
                  inspirationId: ins.id,
                  createdAt: new Date().toISOString(),
                };
                await handleAddItem(newItem);
                toast.show('Added to wishlist · review category in the wardrobe', { kind: 'success', duration: 4500 });
              }}
            />
          )}

          {openOutfit && (
            <OutfitDetailView
              outfit={openOutfit}
              items={liveItems}
              onClose={() => setOpenOutfitId(null)}
              onDelete={async () => { await handleDeleteOutfit(openOutfit.id); setOpenOutfitId(null); }}
              onSaveOutfit={handleSaveOutfit}
              onShare={() => handleShareOutfit(openOutfit)}
              onLogWear={(verdict) => handleLogOutfitWear(openOutfit, todayISO(), verdict)}
              onOpenItem={(id) => setSelectedItemId(id)}
              onDuplicate={async () => {
                // If legacy outfit had embedded items, migrate to itemIds
                const itemIds = Array.isArray(openOutfit.itemIds)
                  ? openOutfit.itemIds
                  : (openOutfit.items || []).map((i) => i.id).filter(Boolean);
                const newOutfit = {
                  id: newId(),
                  name: `${openOutfit.name} (copy)`,
                  itemIds,
                  createdAt: new Date().toISOString(),
                  ...(openOutfit.reasoning ? { reasoning: openOutfit.reasoning } : {}),
                  ...(openOutfit.intent ? { intent: openOutfit.intent } : {}),
                };
                await handleSaveOutfit(newOutfit);
                setOpenOutfitId(newOutfit.id);
              }}
            />
          )}

          {selectedItem && (() => {
            // Build prev/next from the live wardrobe order for swipe nav.
            const idx = liveItems.findIndex((i) => i.id === selectedItem.id);
            const prev = idx > 0 ? liveItems[idx - 1] : null;
            const next = idx >= 0 && idx < liveItems.length - 1 ? liveItems[idx + 1] : null;
            return (
            <ItemDetailView
              item={selectedItem}
              shops={shops}
              measurements={measurements}
              items={liveItems}
              outfits={outfits}
              onPrev={prev ? () => setSelectedItemId(prev.id) : null}
              onNext={next ? () => setSelectedItemId(next.id) : null}
              positionLabel={idx >= 0 ? `${idx + 1} / ${liveItems.length}` : null}
              onOpenOutfit={(id) => { setSelectedItemId(null); setOpenOutfitId(id); }}
              onLogWear={(dateISO) => handleLogWear(selectedItem, dateISO)}
              onUnlogWear={(dateISO) => handleUnlogWear(selectedItem, dateISO)}
              onSetWearNote={(dateISO, note) => handleSetWearNote(selectedItem, dateISO, note)}
              onMarkCared={() => handleMarkCared(selectedItem)}
              onToggleFavorite={() => handleToggleFavorite(selectedItem)}
              onDuplicate={() => handleDuplicateItem(selectedItem)}
              onShare={() => handleShareItem(selectedItem)}
              onOpenItem={(id) => setSelectedItemId(id)}
              onClose={() => setSelectedItemId(null)}
              onEdit={() => { setEditingItem(selectedItem); setIsAddItemModalOpen(true); setSelectedItemId(null); }}
              onDelete={async () => { await handleDeleteItem(selectedItem.id); setSelectedItemId(null); }}
              onMarkOwned={async () => {
                await handleAddItem({
                  ...selectedItem,
                  status: 'owned',
                  purchasedDate: selectedItem.purchasedDate || new Date().toISOString().slice(0, 10),
                });
              }}
              onMarkWishlist={async () => {
                await handleAddItem({ ...selectedItem, status: 'wishlist' });
              }}
            />
            );
          })()}
        </div>
      )}
    </>
  );
}

function PhotoLightbox({ images, startIndex = 0, alt = '', onClose }) {
  const [index, setIndex] = useState(Math.min(startIndex, images.length - 1));
  const [touchStart, setTouchStart] = useState(null);
  const [zoom, setZoom] = useState(1);

  const goPrev = () => { setIndex((i) => (i - 1 + images.length) % images.length); setZoom(1); };
  const goNext = () => { setIndex((i) => (i + 1) % images.length); setZoom(1); };

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft' && images.length > 1) goPrev();
      else if (e.key === 'ArrowRight' && images.length > 1) goNext();
      else if (e.key === '+' || e.key === '=') setZoom((z) => Math.min(z + 0.5, 4));
      else if (e.key === '-' || e.key === '_') setZoom((z) => Math.max(z - 0.5, 1));
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
    // eslint-disable-next-line
  }, [images.length]);

  const handleTouchStart = (e) => {
    if (e.touches.length === 1) setTouchStart(e.touches[0].clientX);
    else setTouchStart(null); // ignore swipe during pinch
  };
  const handleTouchEnd = (e) => {
    if (touchStart === null || zoom !== 1) { setTouchStart(null); return; }
    const end = e.changedTouches[0].clientX;
    const diff = touchStart - end;
    if (Math.abs(diff) > 50 && images.length > 1) {
      if (diff > 0) goNext(); else goPrev();
    }
    setTouchStart(null);
  };
  const handleWheel = (e) => {
    if (e.deltaY < 0) setZoom((z) => Math.min(z + 0.2, 4));
    else setZoom((z) => Math.max(z - 0.2, 1));
  };
  const handleDoubleClick = () => setZoom((z) => (z > 1 ? 1 : 2));

  if (!images?.length) return null;

  return (
    <div className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center animate-in fade-in duration-200"
         onClick={onClose}>
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 flex justify-between items-center px-4 py-4 sm:px-6 sm:py-5 z-10"
           style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)' }}
           onClick={(e) => e.stopPropagation()}>
        <span className="text-white/70 text-xs tracking-[0.2em] uppercase">
          {images.length > 1 ? `${index + 1} / ${images.length}` : 'Detail view'}
        </span>
        <div className="flex gap-2">
          {zoom > 1 && (
            <button onClick={() => setZoom(1)} className="px-3 py-2 text-white/80 hover:text-white text-xs tracking-widest uppercase bg-white/10 hover:bg-white/20 rounded-full transition-colors">
              Reset zoom
            </button>
          )}
          <button onClick={onClose} className="p-2.5 text-white hover:bg-white/10 rounded-full transition-colors" aria-label="Close">
            <X size={22} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Image */}
      <div className="w-full h-full flex items-center justify-center overflow-hidden"
           style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 4rem)', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 4rem)' }}
           onClick={(e) => e.stopPropagation()}
           onTouchStart={handleTouchStart}
           onTouchEnd={handleTouchEnd}
           onWheel={handleWheel}
           onDoubleClick={handleDoubleClick}>
        <img src={images[index]} alt={alt}
          className="max-w-full max-h-full object-contain select-none transition-transform duration-200"
          style={{ touchAction: 'pinch-zoom', transform: `scale(${zoom})`, cursor: zoom > 1 ? 'zoom-out' : 'zoom-in' }}
          draggable={false}
        />
      </div>

      {/* Arrows (desktop / accessible) */}
      {images.length > 1 && (
        <>
          <button onClick={(e) => { e.stopPropagation(); goPrev(); }}
            className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors active:scale-90"
            aria-label="Previous photo">
            <ChevronRight size={22} strokeWidth={1.5} className="rotate-180" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); goNext(); }}
            className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors active:scale-90"
            aria-label="Next photo">
            <ChevronRight size={22} strokeWidth={1.5} />
          </button>
        </>
      )}

      {/* Thumbnail strip at bottom */}
      {images.length > 1 && (
        <div className="absolute left-1/2 -translate-x-1/2 flex gap-1.5 max-w-[90vw] overflow-x-auto px-3 hide-scrollbar"
             style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
             onClick={(e) => e.stopPropagation()}>
          {images.map((src, i) => (
            <button key={i} onClick={() => { setIndex(i); setZoom(1); }}
              className={`w-12 h-16 rounded-lg overflow-hidden border-2 transition-all shrink-0 ${
                index === i ? 'border-white scale-105' : 'border-transparent opacity-50 hover:opacity-80'
              }`}>
              <img src={src} className="w-full h-full object-cover" alt="" />
            </button>
          ))}
        </div>
      )}

      {/* Hint */}
      <div className="absolute bottom-2 right-3 hidden sm:block text-white/30 text-[10px] tracking-widest uppercase pointer-events-none"
           style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}>
        {images.length > 1 ? 'Swipe or ← → · double-click to zoom' : 'Double-click to zoom · scroll to zoom in'}
      </div>
    </div>
  );
}

function WardrobeCardImage({ item }) {
  const [failed, setFailed] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);
  const touchStartRef = React.useRef(null);
  const images = itemImages(item);

  if (images.length === 0 || failed) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center text-stone-300 bg-stone-100">
        <Shirt size={48} strokeWidth={1} />
        <span className="text-[10px] uppercase tracking-widest mt-2">No photo</span>
      </div>
    );
  }

  const safeIndex = Math.min(photoIndex, images.length - 1);
  const hasMulti = images.length > 1;

  const handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };
  const handleTouchEnd = (e) => {
    if (!touchStartRef.current || e.changedTouches.length !== 1) {
      touchStartRef.current = null;
      return;
    }
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
    touchStartRef.current = null;
    // Significant horizontal swipe, dominantly horizontal — navigate photos.
    if (hasMulti && Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      e.stopPropagation();
      if (dx < 0) setPhotoIndex((i) => Math.min(images.length - 1, i + 1));
      else setPhotoIndex((i) => Math.max(0, i - 1));
    }
  };

  return (
    <div className="w-full h-full relative" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      <img
        src={images[safeIndex]}
        alt={item.name}
        onError={() => setFailed(true)}
        className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105 pointer-events-none"
        loading="lazy"
        draggable={false}
      />

      {hasMulti && (
        <>
          {/* Dot indicators — universal "swipeable" affordance */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10 px-2 py-1 rounded-full bg-stone-900/30 backdrop-blur-sm">
            {images.map((_, i) => (
              <span key={i}
                className={`block rounded-full transition-all duration-300 ${
                  i === safeIndex ? 'bg-white w-1.5 h-1.5' : 'bg-white/60 w-1 h-1'
                }`} />
            ))}
          </div>

          {/* Desktop hover chevrons */}
          <button type="button"
            onClick={(e) => { e.stopPropagation(); setPhotoIndex((i) => Math.max(0, i - 1)); }}
            disabled={safeIndex === 0}
            className="hidden lg:flex absolute left-2 top-1/2 -translate-y-1/2 p-1.5 bg-white/85 hover:bg-white text-stone-800 rounded-full opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-30 disabled:cursor-default shadow-md z-10"
            aria-label="Previous photo"
          >
            <ChevronRight size={14} strokeWidth={1.5} className="rotate-180" />
          </button>
          <button type="button"
            onClick={(e) => { e.stopPropagation(); setPhotoIndex((i) => Math.min(images.length - 1, i + 1)); }}
            disabled={safeIndex === images.length - 1}
            className="hidden lg:flex absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-white/85 hover:bg-white text-stone-800 rounded-full opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-30 disabled:cursor-default shadow-md z-10"
            aria-label="Next photo"
          >
            <ChevronRight size={14} strokeWidth={1.5} />
          </button>
        </>
      )}
    </div>
  );
}

function WardrobeFiltersSheet({
  open, onClose,
  subCategories, subCategoryFilter, setSubCategoryFilter,
  seasonFilter, setSeasonFilter,
  allBrands, brandFilter, setBrandFilter,
  styleFilter, setStyleFilter,
  usedColors, colorFilter, setColorFilter,
}) {
  if (!open) return null;
  const ChipRow = ({ items, value, set, getSwatch }) => (
    <div className="flex flex-wrap gap-2">
      {items.map((it) => {
        const active = value === it;
        const swatch = getSwatch?.(it);
        return (
          <button key={it} onClick={() => set(it)}
            className={`px-3 py-2 rounded-full text-xs transition-all border whitespace-nowrap flex items-center gap-2 ${
              active ? 'bg-stone-900 border-stone-900 text-white' : 'bg-white border-stone-200 text-stone-600 hover:border-stone-400'
            }`}>
            {swatch && <span className="w-3 h-3 rounded-full border border-stone-300/50"
              style={swatch.startsWith?.('linear') ? { background: swatch } : { backgroundColor: swatch }} />}
            {it}
          </button>
        );
      })}
    </div>
  );
  return createPortal(
    <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-6" onClick={onClose}>
      <div className="bg-[#F7F5F2] w-full sm:max-w-lg sm:rounded-[2rem] rounded-t-[2rem] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-300 flex flex-col max-h-[92vh] sm:max-h-[90vh]"
           onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center px-4 sm:px-6 py-4 sm:py-5 border-b border-stone-200/60 bg-white shrink-0">
          <h3 className="text-xl sm:text-2xl font-display font-medium text-stone-900">Filters</h3>
          <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-full transition-colors">
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>
        <div className="p-4 sm:p-6 lg:p-8 flex-1 min-h-0 overflow-y-auto space-y-6">
          {subCategories && (
            <div>
              <h4 className="text-[10px] tracking-widest uppercase text-stone-500 font-semibold mb-3">Sub-type</h4>
              <ChipRow items={['All Types', ...subCategories]} value={subCategoryFilter} set={setSubCategoryFilter} />
            </div>
          )}
          <div>
            <h4 className="text-[10px] tracking-widest uppercase text-stone-500 font-semibold mb-3">Season</h4>
            <ChipRow items={SEASONS} value={seasonFilter} set={setSeasonFilter} />
          </div>
          <div>
            <h4 className="text-[10px] tracking-widest uppercase text-stone-500 font-semibold mb-3">Style</h4>
            <ChipRow items={['All Styles', ...STYLES]} value={styleFilter} set={setStyleFilter} />
          </div>
          {usedColors.length > 0 && (
            <div>
              <h4 className="text-[10px] tracking-widest uppercase text-stone-500 font-semibold mb-3">Colour</h4>
              <ChipRow items={['All Colours', ...usedColors]} value={colorFilter} set={setColorFilter} getSwatch={(c) => c !== 'All Colours' ? COLOR_SWATCHES[c] : null} />
            </div>
          )}
          {allBrands.length > 1 && (
            <div>
              <h4 className="text-[10px] tracking-widest uppercase text-stone-500 font-semibold mb-3">Brand</h4>
              <ChipRow items={allBrands} value={brandFilter} set={setBrandFilter} />
            </div>
          )}
        </div>
        <div className="px-4 sm:px-6 py-4 border-t border-stone-200/60 bg-white/95 backdrop-blur shrink-0"
             style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}>
          <button onClick={onClose} className="w-full bg-stone-900 text-white py-3.5 rounded-xl font-medium hover:bg-stone-800 transition-all shadow-lg active:scale-[0.98]">
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function WardrobeSkeleton() {
  return (
    <div className="space-y-6 md:space-y-10 animate-pulse">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="h-10 w-48 bg-stone-200 rounded-xl" />
          <div className="h-3 w-32 bg-stone-200 rounded mt-3" />
        </div>
      </div>
      <div className="h-12 bg-stone-200/50 rounded-2xl" />
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-8 md:gap-x-8 md:gap-y-12">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-3">
            <div className="aspect-[3/4] rounded-2xl bg-stone-200" />
            <div className="space-y-2 px-1">
              <div className="h-2 w-1/3 bg-stone-200 rounded" />
              <div className="h-4 w-3/4 bg-stone-200 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FullScreenLoader({ label }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F7F5F2] text-stone-400">
      <Shirt size={40} className="mb-4 opacity-30 animate-pulse" strokeWidth={1} />
      <p className="font-display text-xl">{label}…</p>
    </div>
  );
}

function SignInScreen({ onSignIn }) {
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const handle = async () => {
    setBusy(true); setError(null);
    try { await onSignIn(); }
    catch (e) { setError(e?.message || 'Sign-in failed.'); }
    finally { setBusy(false); }
  };
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F7F5F2] px-6 font-sans">
      <div className="mb-8"><AtelierMark size={88} /></div>
      <h1 className="text-5xl font-display font-medium tracking-wide mb-3">Atelier.</h1>
      <p className="text-stone-500 text-sm tracking-wide mb-12 text-center max-w-sm">Your private digital wardrobe. Sign in to access your collection from any device.</p>
      <button onClick={handle} disabled={busy} className="bg-stone-900 text-white px-10 py-4 rounded-full font-medium hover:bg-stone-800 transition-all shadow-lg disabled:opacity-50">
        {busy ? 'Signing in…' : 'Sign in with Google'}
      </button>
      {error && <p className="mt-6 text-xs text-red-700 max-w-sm text-center">{error}</p>}
    </div>
  );
}

function AccessDeniedScreen({ user, onSignOut }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F7F5F2] px-6 font-sans text-center">
      <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mb-8">
        <AlertCircle className="text-stone-900" size={26} strokeWidth={1.5} />
      </div>
      <h1 className="text-3xl font-display font-medium tracking-wide mb-3">Atelier is private.</h1>
      <p className="text-stone-500 text-sm leading-relaxed max-w-sm mb-2">
        You're signed in as <span className="text-stone-800 font-medium">{user.email}</span>, but this email hasn't been invited yet.
      </p>
      <p className="text-stone-500 text-sm leading-relaxed max-w-sm mb-10">
        Ask the wardrobe owner to invite you, then refresh — or sign in with a different account.
      </p>
      <button onClick={onSignOut} className="bg-stone-900 text-white px-8 py-3 rounded-full font-medium hover:bg-stone-800 transition-all shadow-lg">
        Sign out
      </button>
    </div>
  );
}

function DesktopNavItem({ icon: Icon, label, id, activeTab, setTab }) {
  const isActive = activeTab === id;
  return (
    <button
      onClick={() => setTab(id)}
      className={`w-full h-12 flex items-center justify-between px-5 rounded-2xl transition-all duration-300 ${
        isActive ? 'bg-white smooth-shadow text-stone-900' : 'text-stone-500 hover:bg-stone-200/50 hover:text-stone-800'
      }`}
    >
      <div className="flex items-center gap-4">
        <Icon size={20} strokeWidth={isActive ? 2 : 1.5} />
        <span className={`text-sm tracking-wide ${isActive ? 'font-medium' : 'font-normal'}`}>{label}</span>
      </div>
      {isActive && <ChevronRight size={16} className="text-stone-400" strokeWidth={1.5} />}
    </button>
  );
}

function MobileNavItem({ icon: Icon, label, id, activeTab, setTab, onScrollTop }) {
  const isActive = activeTab === id;
  return (
    <button
      onClick={() => {
        // iOS pattern: tapping the active tab again scrolls that view to top.
        if (isActive) onScrollTop?.();
        else setTab(id);
      }}
      className="flex flex-col items-center gap-1 px-3 py-2 w-[68px] min-h-[56px] transition-all active:scale-95 relative"
      aria-label={label}
      aria-current={isActive ? 'page' : undefined}
    >
      <Icon size={22} strokeWidth={isActive ? 2 : 1.5} className={`transition-all duration-200 ${isActive ? 'text-stone-900 scale-110' : 'text-stone-400'}`} />
      <span className={`text-[10px] tracking-wide transition-colors ${isActive ? 'text-stone-900 font-medium' : 'text-stone-400'}`}>{label}</span>
      {isActive && <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-stone-900" />}
    </button>
  );
}

// Home-screen tile: condenses today/tomorrow into a single actionable card.
// Three states surface:
//   - Tomorrow has a planned outfit → show it; tap to open.
//   - No plan but Gemini available → "Suggest a look" CTA; result has accept/skip/regen.
//   - No items / AI disabled → nothing renders (don't pollute the wardrobe top).
function TodayTile({ items, outfits, schedules, weather, weatherSeasons, aiTemperature, measurements, onOpenOutfit, onScheduleOutfit, onSaveOutfit, onLogOutfitWear }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [suggestion, setSuggestion] = useState(null); // { itemIds, reasoning, confidence }
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [pickDate, setPickDate] = useState(null); // ISO string when scheduling

  const buildOutfitFromSuggestion = () => {
    if (!suggestion?.itemIds?.length) return null;
    const validIds = suggestion.itemIds.filter((id) => items.some((i) => i.id === id));
    if (!validIds.length) return null;
    const today = new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    return {
      id: newId(),
      name: `Today's pick · ${today}`,
      itemIds: validIds,
      createdAt: new Date().toISOString(),
      reasoning: suggestion.reasoning || '',
      intent: 'today',
    };
  };

  const saveAsLook = async () => {
    const outfit = buildOutfitFromSuggestion();
    if (!outfit || !onSaveOutfit) return;
    setSaving(true);
    try { await onSaveOutfit(outfit); setSuggestion(null); }
    finally { setSaving(false); }
  };

  const wearToday = async () => {
    const outfit = buildOutfitFromSuggestion();
    if (!outfit || !onSaveOutfit) return;
    setSaving(true);
    try {
      await onSaveOutfit(outfit);
      if (onLogOutfitWear) await onLogOutfitWear(outfit, todayISO(), '');
      setSuggestion(null);
    } finally { setSaving(false); }
  };

  const scheduleFor = async (dateISO) => {
    const outfit = buildOutfitFromSuggestion();
    if (!outfit || !onSaveOutfit || !onScheduleOutfit) return;
    setSaving(true);
    try {
      await onSaveOutfit(outfit);
      await onScheduleOutfit(dateISO, outfit.id);
      toast.show(`Scheduled for ${new Date(dateISO + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}`, { kind: 'success' });
      setSuggestion(null);
      setPickDate(null);
    } finally { setSaving(false); }
  };

  const owned = items.filter((i) => i.status === 'owned');
  if (owned.length < 4) return null;

  const tomorrow = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); })();
  const tomorrowSched = schedules?.[tomorrow];
  const tomorrowOutfit = tomorrowSched?.outfitId ? outfits.find((o) => o.id === tomorrowSched.outfitId) : null;
  const tomorrowPieces = tomorrowOutfit ? resolveOutfitItems(tomorrowOutfit, items) : [];
  const tomorrowLabel = new Date(tomorrow + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long' });

  const generate = async () => {
    setBusy(true); setError(null);
    try {
      const season = (weatherSeasons && weatherSeasons[0]) || 'Spring';
      const result = await generateOutfitWithGemini({
        items: owned, intent: 'a balanced everyday look for now', weather, season, temperature: aiTemperature,
        styleProfile: summariseStyleProfile(measurements),
      });
      setSuggestion(result);
    } catch (e) {
      setError(e?.message || 'AI is offline right now.');
    } finally {
      setBusy(false);
    }
  };

  const suggestedPieces = suggestion?.itemIds?.map((id) => items.find((i) => i.id === id)).filter(Boolean) || [];

  return (
    <div className="bg-gradient-to-br from-stone-900 to-stone-800 text-white rounded-3xl p-5 shadow-2xl relative overflow-hidden">
      <div className="absolute -right-12 -top-12 opacity-[0.06] rotate-12 pointer-events-none">
        <Sparkles size={220} strokeWidth={0.8} />
      </div>

      <div className="relative z-10 flex items-start justify-between gap-4 mb-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-[10px] tracking-[0.25em] uppercase text-stone-400 font-bold">Today</p>
          <p className="font-display text-lg sm:text-xl text-white mt-0.5">
            {weather ? `${weather.temp}°C · ${weatherLabel(weather.code)}` : 'How are you styling today?'}
          </p>
        </div>
      </div>

      {tomorrowOutfit && (
        <button onClick={() => onOpenOutfit?.(tomorrowOutfit.id)}
          className="relative z-10 w-full bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-3 sm:p-4 flex items-center gap-4 transition-colors mb-3">
          <div className="grid grid-cols-2 grid-rows-2 gap-0.5 w-16 h-16 rounded-xl overflow-hidden bg-stone-700 shrink-0">
            {tomorrowPieces.slice(0, 4).map((p) => (
              <div key={p.id}><img src={itemImages(p)[0]} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" /></div>
            ))}
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-[10px] tracking-widest uppercase text-stone-400">{tomorrowLabel} · planned</p>
            <p className="text-sm font-medium truncate mt-0.5">{tomorrowOutfit.name}</p>
            <p className="text-[10px] text-stone-400 mt-0.5">{tomorrowPieces.length} pieces · ready to wear</p>
          </div>
          <ChevronRight size={16} strokeWidth={1.5} className="text-stone-400 shrink-0" />
        </button>
      )}

      {!suggestion && (
        <div className="relative z-10 flex flex-col gap-2">
          <button onClick={generate} disabled={busy || !isAIEnabled()}
            className="w-full text-xs tracking-widest uppercase px-4 py-3 rounded-full bg-brass-300 text-stone-900 hover:bg-brass-200 disabled:opacity-40 transition-colors flex items-center justify-center gap-2 font-medium">
            <Wand2 size={14} strokeWidth={1.5} /> {busy ? 'Composing…' : 'Suggest a look'}
          </button>
          {!isAIEnabled() && <span className="text-[10px] tracking-widest uppercase text-stone-400 text-center">AI needs a Gemini key</span>}
          {error && <span className="text-[10px] text-brass-300 text-center">{error}</span>}
        </div>
      )}

      {/* Suggestion rendering moved to a portal modal below — the sidebar
          TodayTile is too narrow to host a generated outfit + 3 action
          buttons + a regenerate/dismiss row. Modal gives the result the
          space it deserves, including progress feedback while AI composes. */}

      {(busy || (suggestion && suggestedPieces.length > 0)) && createPortal(
        <div
          className="fixed inset-0 z-[60] bg-stone-900/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            // Dismiss on backdrop click only — but not during AI work to
            // avoid losing the in-flight call (Gemini still resolves, but
            // user expects the result they're waiting for).
            if (e.target === e.currentTarget && !busy && !saving) {
              setSuggestion(null);
              setPickDate(null);
            }
          }}
        >
          <div className="bg-gradient-to-br from-stone-900 to-stone-800 text-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto overflow-x-hidden relative animate-in zoom-in-95 slide-in-from-bottom-4 duration-300">
            {/* Decorative sparkles, same flavour as the TodayTile card */}
            <div className="absolute -right-16 -top-16 opacity-[0.06] rotate-12 pointer-events-none">
              <Sparkles size={280} strokeWidth={0.8} />
            </div>

            <div className="relative p-6 sm:p-8">
              {/* Header — title + close. Close hidden while composing. */}
              <div className="flex items-start justify-between gap-3 mb-5">
                <div>
                  <p className="text-[10px] tracking-[0.25em] uppercase text-brass-300 font-bold">
                    {busy ? 'Composing' : `Suggested · ${suggestion?.confidence ?? '–'}/100 confidence`}
                  </p>
                  <h2 className="font-display text-2xl sm:text-3xl mt-1">
                    {busy ? 'Atelier is styling you…' : "Today's proposal"}
                  </h2>
                </div>
                {!busy && !saving && (
                  <button
                    onClick={() => { setSuggestion(null); setPickDate(null); }}
                    aria-label="Close"
                    className="shrink-0 -mt-1 -mr-1 p-2 rounded-full hover:bg-white/10 transition-colors"
                  >
                    <X size={18} strokeWidth={1.5} />
                  </button>
                )}
              </div>

              {busy ? (
                /* Progress state — animated bar + thumbnails fading in */
                <div className="py-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="h-1 flex-1 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-brass-300 rounded-full animate-pulse" style={{ width: '40%' }} />
                    </div>
                    <span className="text-xs text-stone-400 tracking-wide">Reading the room…</span>
                  </div>
                  <p className="text-sm text-stone-400 leading-relaxed">
                    Pulling your owned pieces, weighing what fits today's {weather?.temp}°C and the season,
                    leaning on your style profile.
                  </p>
                </div>
              ) : (
                <>
                  {/* The proposed outfit — wraps to a grid so the modal never
                      scrolls sideways. 3 cols on mobile, 4 on small/medium,
                      5 on larger screens. Most outfits are 5-7 pieces. */}
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                    {suggestedPieces.map((p) => (
                      <div key={p.id} className="min-w-0">
                        <div className="aspect-[3/4] rounded-xl overflow-hidden bg-stone-700 mb-2">
                          {itemImages(p)[0] && <img src={itemImages(p)[0]} alt={p.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />}
                        </div>
                        <p className="text-[11px] text-stone-300 truncate">{p.name}</p>
                        <p className="text-[10px] text-stone-500 truncate uppercase tracking-wider">{p.brand}</p>
                      </div>
                    ))}
                  </div>

                  {suggestion?.reasoning && (
                    <p className="text-sm text-stone-300 italic mt-5 leading-relaxed bg-white/5 border border-white/10 rounded-xl p-4">
                      "{suggestion.reasoning}"
                    </p>
                  )}

                  {/* Actions */}
                  {pickDate === null ? (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-6">
                        <button onClick={wearToday} disabled={saving || !onLogOutfitWear}
                          className="text-xs tracking-widest uppercase px-4 py-3 rounded-full bg-brass-300 text-stone-900 hover:bg-brass-200 disabled:opacity-40 transition-colors flex items-center justify-center gap-2 font-medium">
                          <Calendar size={14} strokeWidth={1.5} /> Wear today
                        </button>
                        <button onClick={saveAsLook} disabled={saving || !onSaveOutfit}
                          className="text-xs tracking-widest uppercase px-4 py-3 rounded-full bg-white text-stone-900 hover:bg-stone-100 disabled:opacity-40 transition-colors flex items-center justify-center gap-2 font-medium">
                          <Bookmark size={14} strokeWidth={1.5} /> Save look
                        </button>
                        <button onClick={() => setPickDate(todayISO())} disabled={saving || !onScheduleOutfit}
                          className="text-xs tracking-widest uppercase px-4 py-3 rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-40 transition-colors flex items-center justify-center gap-2 font-medium">
                          <Calendar size={14} strokeWidth={1.5} /> Schedule…
                        </button>
                      </div>
                      <div className="flex justify-between items-center mt-5 pt-5 border-t border-white/10">
                        <button onClick={generate} disabled={busy || saving}
                          className="text-[11px] tracking-widest uppercase text-stone-400 hover:text-white disabled:opacity-40 transition-colors inline-flex items-center gap-1.5">
                          ↻ Try a different look
                        </button>
                        <button onClick={() => { setSuggestion(null); setPickDate(null); }} disabled={saving}
                          className="text-[11px] tracking-widest uppercase text-stone-400 hover:text-white transition-colors">
                          Discard
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="mt-6 bg-white/5 border border-white/10 rounded-2xl p-4">
                      <p className="text-[10px] tracking-widest uppercase text-stone-300 mb-3">Schedule for</p>
                      <div className="flex items-center gap-3 flex-wrap">
                        <input type="date" value={pickDate} min={todayISO()}
                          onChange={(e) => setPickDate(e.target.value)}
                          className="bg-stone-800 text-white text-sm px-4 py-2.5 rounded-xl border border-white/10 focus:border-brass-300 outline-none" />
                        <div className="flex gap-2 ml-auto">
                          <button onClick={() => setPickDate(null)} disabled={saving}
                            className="text-xs tracking-widest uppercase px-4 py-2.5 rounded-full text-stone-400 hover:text-white">
                            Cancel
                          </button>
                          <button onClick={() => scheduleFor(pickDate)} disabled={saving || !pickDate}
                            className="text-xs tracking-widest uppercase px-5 py-2.5 rounded-full bg-brass-300 text-stone-900 hover:bg-brass-200 disabled:opacity-40 font-medium">
                            {saving ? 'Saving…' : 'Confirm'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// In-app digest — surfaces the same items that drive OS notifications, plus
// recent price drops + lent-out overdue. Always present (no permission gate),
// so the user never misses a nudge even when push is off.
function DailyDigest({ items, outfits, schedules, inspirations = [], onOpenItem, onOpenOutfit, onOpenInspiration, onOpenInspirationTab }) {
  const owned = items.filter((i) => i.status === 'owned');
  const todayKey = todayISO();
  const tomorrow = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); })();

  // Care due
  const careDue = owned.map((i) => ({ i, r: itemCareReminder(i) })).filter((x) => x.r?.due).slice(0, 3);

  // Tomorrow's planned outfit (today's, if not yet logged)
  const todaySched = schedules?.[todayKey];
  const tomorrowSched = schedules?.[tomorrow];
  const todayOutfit = todaySched?.outfitId ? outfits.find((o) => o.id === todaySched.outfitId) : null;
  const tomorrowOutfit = tomorrowSched?.outfitId ? outfits.find((o) => o.id === tomorrowSched.outfitId) : null;

  // Stale favourite (worn 30+ days ago, or never)
  const staleFav = owned.find((i) => i.favorite && (daysSinceLastWorn(i) === null || daysSinceLastWorn(i) >= 30));

  // Recent price drops (last 7 days)
  const weekAgo = Date.now() - 7 * 86_400_000;
  const drops = items.filter((i) => {
    if (i.status !== 'wishlist' || !Array.isArray(i.priceHistory) || i.priceHistory.length < 2) return false;
    const last = i.priceHistory[i.priceHistory.length - 1];
    const prev = i.priceHistory[i.priceHistory.length - 2];
    return last.price < prev.price && new Date(last.date).getTime() > weekAgo;
  }).slice(0, 3);

  // Lent out & overdue
  const overdueLent = owned.filter((i) => i.lentTo && i.lentReturnBy && i.lentReturnBy < todayKey).slice(0, 3);

  // Unanalysed inspirations — surface once you've collected 3+ raw images
  // sitting in the board without an AI cross-reference yet.
  const unanalysedInspos = (inspirations || []).filter((i) => !i.analysis);
  const showInspoNudge = unanalysedInspos.length >= 3;

  const cards = [];
  if (todayOutfit) cards.push({ kind: 'planned-today', outfit: todayOutfit, label: "Today's plan" });
  if (tomorrowOutfit) cards.push({ kind: 'planned-tomorrow', outfit: tomorrowOutfit, label: 'Planned tomorrow' });
  for (const { i, r } of careDue) cards.push({ kind: 'care', item: i, reminder: r });
  if (staleFav) cards.push({ kind: 'stale-fav', item: staleFav });
  for (const i of drops) cards.push({ kind: 'price-drop', item: i });
  for (const i of overdueLent) cards.push({ kind: 'overdue', item: i });
  if (showInspoNudge) cards.push({ kind: 'inspo-unanalysed', inspiration: unanalysedInspos[0], total: unanalysedInspos.length });

  if (cards.length === 0) return null;

  return (
    <div className="bg-white border border-stone-200/60 rounded-3xl p-4 sm:p-5 smooth-shadow">
      <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
        <h3 className="font-display text-base sm:text-lg text-stone-900">Needs attention</h3>
        <span className="text-[10px] tracking-widest uppercase text-stone-500">{cards.length} item{cards.length === 1 ? '' : 's'}</span>
      </div>
      <ul className="space-y-1">
        {cards.map((c, i) => {
          const Row = ({ icon, accent, title, sub, onClick }) => (
            <li>
              <button onClick={onClick}
                className="w-full flex items-center gap-3 text-left py-2 px-2 -mx-2 rounded-xl hover:bg-stone-50 transition-colors">
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${accent}`}>{icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-stone-900 truncate">{title}</p>
                  <p className="text-[11px] text-stone-500 truncate">{sub}</p>
                </div>
                <ChevronRight size={14} strokeWidth={1.5} className="text-stone-300 shrink-0" />
              </button>
            </li>
          );
          if (c.kind === 'planned-today' || c.kind === 'planned-tomorrow') {
            return <Row key={i} icon={<Calendar size={16} strokeWidth={1.5} />} accent="bg-brass-100 text-brass-700"
              title={c.outfit.name} sub={c.label} onClick={() => onOpenOutfit?.(c.outfit.id)} />;
          }
          if (c.kind === 'care') {
            return <Row key={i} icon={<Sparkles size={16} strokeWidth={1.5} />} accent="bg-brass-100 text-brass-700"
              title={c.item.name} sub={`${c.reminder.material} care · ${c.reminder.wearsSince} wears`} onClick={() => onOpenItem?.(c.item.id)} />;
          }
          if (c.kind === 'stale-fav') {
            const d = daysSinceLastWorn(c.item);
            return <Row key={i} icon={<Star size={16} strokeWidth={1.5} />} accent="bg-stone-100 text-stone-700"
              title={c.item.name} sub={d === null ? 'Favourite · never worn' : `Favourite · ${d} days since last wear`} onClick={() => onOpenItem?.(c.item.id)} />;
          }
          if (c.kind === 'price-drop') {
            const h = c.item.priceHistory;
            const drop = Math.round((1 - h[h.length - 1].price / h[h.length - 2].price) * 100);
            return <Row key={i} icon={<TrendingDown size={16} strokeWidth={1.5} />} accent="bg-emerald-100 text-emerald-800"
              title={c.item.name} sub={`Price dropped ${drop}% · now £${h[h.length - 1].price}`} onClick={() => onOpenItem?.(c.item.id)} />;
          }
          if (c.kind === 'overdue') {
            const daysOver = Math.floor((new Date(todayKey) - new Date(c.item.lentReturnBy)) / 86_400_000);
            return <Row key={i} icon={<AlertCircle size={16} strokeWidth={1.5} />} accent="bg-red-100 text-red-700"
              title={c.item.name} sub={`Lent to ${c.item.lentTo} · ${daysOver} day${daysOver === 1 ? '' : 's'} overdue`} onClick={() => onOpenItem?.(c.item.id)} />;
          }
          if (c.kind === 'inspo-unanalysed') {
            return <Row key={i} icon={<Bookmark size={16} strokeWidth={1.5} />} accent="bg-stone-100 text-stone-700"
              title={`${c.total} inspiration${c.total === 1 ? '' : 's'} waiting`} sub="Open the board to analyse them with AI"
              onClick={() => onOpenInspirationTab ? onOpenInspirationTab() : onOpenInspiration?.(c.inspiration.id)} />;
          }
          return null;
        })}
      </ul>
    </div>
  );
}

// Wardrobe sort options. Each defines a stable comparator over items.
// Default "recent" surfaces newly-added pieces first — the psychological
// reward of seeing your latest acquisitions when you open the app, also how
// Indyx, Whering and Stylebook default. Other modes are chosen via a sort menu.
// Favourites always float to the top within whichever mode is active — a small
// curated touch that mirrors how most native gallery apps treat starred items.
const WARDROBE_SORT_OPTIONS = [
  { key: 'recent', label: 'Recently added', hint: 'Newest first' },
  { key: 'oldest', label: 'Oldest first', hint: 'By date added' },
  { key: 'worn-recent', label: 'Recently worn', hint: 'Last wear first' },
  { key: 'most-worn', label: 'Most worn', hint: 'By wear count' },
  { key: 'least-worn', label: 'Least worn', hint: 'Surfaces neglected pieces' },
  { key: 'cpw-best', label: 'Best cost-per-wear', hint: 'Most-justified buys' },
  { key: 'cpw-worst', label: 'Worst cost-per-wear', hint: 'Wear-them-more list' },
  { key: 'price-desc', label: 'Highest value', hint: 'Priciest first' },
  { key: 'name', label: 'A → Z', hint: 'Alphabetical' },
  { key: 'color', label: 'By colour', hint: 'Grouped palette' },
];
const WARDROBE_SORT_KEY = 'atelier.wardrobeSort';

function sortWardrobeItems(items, sortBy) {
  const arr = [...items];
  const cmpDate = (a, b) => (b.createdAt || '').localeCompare(a.createdAt || '');
  // Favourites always pinned to top within the chosen sort.
  const favBoost = (a, b) => (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0);
  const lastWornDate = (it) => {
    const h = itemWearHistory(it);
    return h.length > 0 ? h[h.length - 1] : '';
  };
  let comparator;
  switch (sortBy) {
    case 'oldest':
      comparator = (a, b) => (a.createdAt || '').localeCompare(b.createdAt || '');
      break;
    case 'worn-recent':
      comparator = (a, b) => lastWornDate(b).localeCompare(lastWornDate(a));
      break;
    case 'most-worn':
      comparator = (a, b) => itemWearCount(b) - itemWearCount(a);
      break;
    case 'least-worn':
      comparator = (a, b) => itemWearCount(a) - itemWearCount(b);
      break;
    case 'cpw-best': {
      // Lowest CPW (best value) first; items never-worn sink to the end.
      const score = (it) => itemCostPerWear(it) ?? Number.POSITIVE_INFINITY;
      comparator = (a, b) => score(a) - score(b);
      break;
    }
    case 'cpw-worst': {
      // Highest CPW first; never-worn items pushed to the top because
      // they're the "haven't justified the price yet" set you'd want to action.
      const score = (it) => itemCostPerWear(it) ?? Number.POSITIVE_INFINITY;
      comparator = (a, b) => score(b) - score(a);
      break;
    }
    case 'price-desc':
      comparator = (a, b) => Number(b.price || 0) - Number(a.price || 0);
      break;
    case 'name':
      comparator = (a, b) => (a.name || '').localeCompare(b.name || '');
      break;
    case 'color': {
      // Stable group by first colour, then alphabetical within group.
      const first = (it) => (itemColors(it)[0] || 'zzz');
      comparator = (a, b) => first(a).localeCompare(first(b)) || (a.name || '').localeCompare(b.name || '');
      break;
    }
    case 'recent':
    default:
      comparator = cmpDate;
  }
  // Apply primary sort, then favourites pin. The favourites pin is applied
  // second so it overrides the primary order, putting starred items on top.
  return arr.sort((a, b) => favBoost(a, b) || comparator(a, b));
}

function WardrobeView({ items, deleteItem, openAddModal, measurements, onItemClick, user, onToggleFavorite, schedules = {}, outfits = [], onOpenOutfit, onBulkUpdate, onBulkDelete, onScheduleOutfit, onSaveOutfit, onLogOutfitWear, inspirations = [], onOpenInspiration, onOpenInspirationTab, aiTemperature = 0.7, onScrollTop, jumpFilter = null, jumpCategory = null, jumpNonce = 0 }) {
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const enterSelectMode = (firstId = null) => {
    setSelectMode(true);
    setSelectedIds(firstId ? new Set([firstId]) : new Set());
  };
  const exitSelectMode = () => { setSelectMode(false); setSelectedIds(new Set()); };
  const toggleSelected = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const tomorrow = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); })();
  const tomorrowSched = schedules[tomorrow];
  const tomorrowOutfit = tomorrowSched ? outfits.find((o) => o.id === tomorrowSched.outfitId) : null;
  const tomorrowPieces = tomorrowOutfit ? resolveOutfitItems(tomorrowOutfit, items) : [];
  const [filter, setFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [seasonFilter, setSeasonFilter] = useState('All Seasons');
  // Apply any pending jump from Insights (or another tab). nonce changes on
  // every jump request so identical { filter, category } combinations also
  // re-fire. We scroll to top so the user lands on the filtered grid head.
  useEffect(() => {
    if (!jumpNonce) return;
    if (jumpFilter !== null) setFilter(jumpFilter);
    if (jumpCategory !== null) setCategoryFilter(jumpCategory);
    onScrollTop?.();
  }, [jumpNonce, jumpFilter, jumpCategory]);
  const [sortBy, setSortBy] = useState(() => {
    try { return localStorage.getItem(WARDROBE_SORT_KEY) || 'recent'; }
    catch { return 'recent'; }
  });
  useEffect(() => {
    try { localStorage.setItem(WARDROBE_SORT_KEY, sortBy); } catch { /* private mode — fine */ }
  }, [sortBy]);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [weather, setWeather] = useState(null);
  useEffect(() => { fetchTodaysWeather().then(setWeather); }, []);
  const weatherSeasons = weatherToSeasons(weather);

  // Recommendation factors in weather when available — prefers items whose
  // seasons match the day's temperature band.
  const pickRec = () => {
    const owned = items.filter((i) => i.status === 'owned');
    if (owned.length === 0) return null;
    const weatherMatched = weatherSeasons
      ? owned.filter((i) => itemSeasons(i).some((s) => weatherSeasons.includes(s)) || itemSeasons(i).length === 0)
      : owned;
    return pickTodaysRecommendation(weatherMatched.length ? weatherMatched : owned);
  };
  const [recommendation, setRecommendation] = useState(() => pickRec());
  useEffect(() => { setRecommendation(pickRec()); /* eslint-disable-next-line */ }, [items.length, weather]);
  const [brandFilter, setBrandFilter] = useState('All Brands');
  const [subCategoryFilter, setSubCategoryFilter] = useState('All Types');
  const [styleFilter, setStyleFilter] = useState('All Styles');
  const [searchQuery, setSearchQuery] = useState('');
  const [colorFilter, setColorFilter] = useState('All Colours');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const usedColors = Array.from(new Set(items.flatMap((i) => itemColors(i)))).sort();

  const allBrands = ['All Brands', ...Array.from(new Set(items.map((i) => i.brand).filter(Boolean))).sort((a, b) => a.localeCompare(b))];

  // Sub-categories only make sense when a category that defines them is selected.
  const subCategoriesForCategory =
    categoryFilter === 'Tops' ? TOP_SUBCATEGORIES :
    categoryFilter === 'Outerwear' ? OUTERWEAR_SUBCATEGORIES :
    categoryFilter === 'Dresses' ? DRESS_SUBCATEGORIES :
    categoryFilter === 'Accessories' ? ACCESSORY_SUBCATEGORIES :
    categoryFilter === 'Jewellery' ? JEWELLERY_SUBCATEGORIES :
    categoryFilter === 'Sportswear' ? SPORTSWEAR_SUBCATEGORIES :
    categoryFilter === 'Bags' ? BAG_SUBCATEGORIES :
    categoryFilter === 'Shoes' ? SHOE_SUBCATEGORIES :
    categoryFilter === 'Swimwear' ? SWIMWEAR_SUBCATEGORIES :
    null;

  const selectCategory = (cat) => {
    setCategoryFilter(cat);
    setSubCategoryFilter('All Types');
  };

  const filteredItems = items.filter(item => {
    // Status pills are 'all' | 'owned' | 'wishlist' | 'stale' | 'favorites' | 'lent'.
    // Stale = owned + never worn OR last worn 90+ days ago.
    const passesStatus =
      filter === 'all' ? true
      : filter === 'stale' ? (item.status === 'owned' && (daysSinceLastWorn(item) === null || daysSinceLastWorn(item) >= 90))
      : filter === 'favorites' ? !!item.favorite
      : filter === 'lent' ? !!item.lentTo
      : item.status === filter;
    const matchCategory = categoryFilter === 'All' || item.category === categoryFilter;
    const itemS = itemSeasons(item);
    const matchSeason = seasonFilter === 'All Seasons' || itemS.length === 0 || itemS.includes(seasonFilter);
    const matchBrand = brandFilter === 'All Brands' || item.brand === brandFilter;
    const matchSubCategory = !subCategoriesForCategory || subCategoryFilter === 'All Types' || item.subCategory === subCategoryFilter;
    const itemSt = itemStyles(item);
    const matchStyle = styleFilter === 'All Styles' || itemSt.includes(styleFilter);
    const q = searchQuery.trim().toLowerCase();
    const matchSearch = !q
      || item.name?.toLowerCase().includes(q)
      || item.brand?.toLowerCase().includes(q)
      || item.description?.toLowerCase().includes(q)
      || item.purchasedFrom?.toLowerCase().includes(q)
      || item.subCategory?.toLowerCase().includes(q);
    const matchColor = colorFilter === 'All Colours' || itemColors(item).includes(colorFilter);
    return passesStatus && matchCategory && matchSeason && matchBrand && matchSubCategory && matchStyle && matchSearch && matchColor;
  });

  const sortedItems = useMemo(
    () => sortWardrobeItems(filteredItems, sortBy),
    [filteredItems, sortBy]
  );

  const activeSort = WARDROBE_SORT_OPTIONS.find((o) => o.key === sortBy) || WARDROBE_SORT_OPTIONS[0];

  return (
    <div className="space-y-6 md:space-y-10 lg:space-y-2">
      {/* Page header. On lg+ sticks at top: 0 of the main scroll container.
          The lg:-mt-12 cancels the parent's lg:p-12 top padding so the header
          starts AT the top of the scroll container from initial render —
          eliminating the "scroll up before sticking" effect users notice when
          the natural position differs from the sticky offset. lg:pt-12 puts
          the padding back inside the header so content stays where it was. */}
      <header
        className="flex flex-col md:flex-row md:items-end justify-between gap-4 md:gap-6 lg:sticky lg:top-0 lg:z-30 lg:-mt-12 lg:pt-12 lg:pb-3 lg:-mx-12 lg:px-12 lg:bg-[#F7F5F2]/90 lg:backdrop-blur-md lg:border-b lg:border-stone-200/50"
      >
        <div>
          {user && (
            <div className="flex items-center gap-3 flex-wrap mb-2 lg:mb-1">
              <span className="brass-rule" aria-hidden="true"></span>
              <p className="text-stone-500 text-[10px] sm:text-xs tracking-[0.28em] uppercase font-medium">
                {getGreeting()}{firstName(user) ? `, ${firstName(user)}` : ''}
              </p>
              {weather && (
                <span className="text-[10px] tracking-widest uppercase text-stone-500 px-2.5 py-1 bg-white rounded-full border border-stone-200">
                  {weather.temp}°C · {weatherLabel(weather.code)}
                </span>
              )}
            </div>
          )}
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-3xl xl:text-4xl font-display text-stone-900 tracking-tight leading-[1.05]">Your Collection</h2>
          <p className="text-stone-500 mt-2 md:mt-3 lg:mt-1 text-xs md:text-sm tracking-wide uppercase font-medium">
            {items.length} Pieces Curated
          </p>
        </div>
        {/* Select button kept in header on mobile (the bottom nav has no Select).
            On desktop, Select has moved into the sticky aside next to Add — kept
            here on mobile only via lg:hidden so the header stays clean on lg+. */}
        <div className="flex items-center gap-3 self-start md:self-auto lg:hidden">
          {items.length > 0 && (
            selectMode ? (
              <button onClick={exitSelectMode} className="text-xs tracking-widest uppercase text-stone-500 hover:text-stone-900 px-4 py-2 border border-stone-200 rounded-full hover:border-stone-400 transition-colors">
                Cancel
              </button>
            ) : (
              <button onClick={() => enterSelectMode()} className="text-xs tracking-widest uppercase text-stone-500 hover:text-stone-900 px-4 py-2 border border-stone-200 rounded-full hover:border-stone-400 transition-colors">
                Select
              </button>
            )
          )}
        </div>
      </header>

      {/* Mobile-only Today strip: TodayTile + DailyDigest rendered at TOP of
          the wardrobe view on small screens. The full sidebar is hidden on
          mobile (was rendering at the bottom, which felt buried). Keeps the
          most useful daily actions one tap away without burying search. */}
      <div className="lg:hidden space-y-4">
        <TodayTile
          items={items}
          outfits={outfits}
          schedules={schedules}
          weather={weather}
          weatherSeasons={weatherSeasons}
          aiTemperature={aiTemperature}
          measurements={measurements}
          onOpenOutfit={onOpenOutfit}
          onScheduleOutfit={onScheduleOutfit}
          onSaveOutfit={onSaveOutfit}
          onLogOutfitWear={onLogOutfitWear}
        />
        <DailyDigest
          items={items}
          outfits={outfits}
          schedules={schedules}
          inspirations={inspirations}
          onOpenItem={onItemClick}
          onOpenOutfit={onOpenOutfit}
          onOpenInspiration={onOpenInspiration}
          onOpenInspirationTab={onOpenInspirationTab}
        />
      </div>

      {/* Two-column dashboard on lg+: wardrobe LEFT (col-span-8), Today panel RIGHT
          (col-span-4 sticky). DOM order = wardrobe first, today second — so on
          mobile users hit search/filters/grid immediately and today cards drop
          below. Explicit lg:row-start-1 on both children keeps them on the
          same row on desktop despite the DOM ordering. */}
      <div className="lg:grid lg:grid-cols-12 lg:gap-8 xl:gap-10 lg:items-start space-y-8 lg:space-y-0">

      {/* ─── MAIN COLUMN: search, filters, grid ─── */}
      <div className="lg:col-span-8 lg:col-start-1 lg:row-start-1 space-y-6 md:space-y-8 min-w-0">

      <div className="flex flex-col gap-4 md:gap-6">
        <div className="relative">
          <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, brand, description…"
            className="w-full h-12 pl-12 pr-4 bg-white border border-stone-200 rounded-2xl text-sm focus:border-stone-900 outline-none transition-colors"
          />
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 text-lg pointer-events-none">⌕</span>
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-stone-400 hover:text-stone-900 hover:bg-stone-100 rounded-full transition-colors" aria-label="Clear search">
              <X size={14} strokeWidth={1.5} />
            </button>
          )}
        </div>
        <div className="flex bg-stone-200/50 p-1.5 rounded-full w-fit overflow-x-auto hide-scrollbar max-w-full">
          {[['all', 'All'], ['favorites', '★ Favourites'], ['owned', 'Owned'], ['wishlist', 'Wishlist'], ['lent', 'Lent out'], ['stale', 'Stale 90+d']].map(([f, label]) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`whitespace-nowrap px-4 sm:px-5 py-3 sm:py-2 rounded-full text-[10px] sm:text-xs tracking-wider uppercase transition-all duration-300 ${
                filter === f ? 'bg-white text-stone-900 shadow-sm font-medium' : 'text-stone-500 hover:text-stone-800'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 hide-scrollbar -mx-4 px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
          {CATEGORIES.map((cat) => (
            <button key={cat} onClick={() => selectCategory(cat)}
              className={`shrink-0 px-4 sm:px-5 py-3 sm:py-2 rounded-full text-xs sm:text-sm transition-all duration-300 border whitespace-nowrap ${
                categoryFilter === cat ? 'bg-stone-900 border-stone-900 text-white' : 'bg-transparent border-stone-300 text-stone-600 hover:border-stone-400'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Filter button + active filter badges */}
        <div className="flex flex-wrap items-center gap-2">
          {(() => {
            const activeBadges = [];
            if (subCategoryFilter !== 'All Types') activeBadges.push({ label: subCategoryFilter, clear: () => setSubCategoryFilter('All Types') });
            if (seasonFilter !== 'All Seasons') activeBadges.push({ label: seasonFilter, clear: () => setSeasonFilter('All Seasons') });
            if (brandFilter !== 'All Brands') activeBadges.push({ label: brandFilter, clear: () => setBrandFilter('All Brands') });
            if (styleFilter !== 'All Styles') activeBadges.push({ label: styleFilter, clear: () => setStyleFilter('All Styles') });
            if (colorFilter !== 'All Colours') activeBadges.push({ label: colorFilter, clear: () => setColorFilter('All Colours'), swatch: COLOR_SWATCHES[colorFilter] });
            const count = activeBadges.length;
            return (
              <>
                <button onClick={() => setFiltersOpen(true)}
                  className={`shrink-0 inline-flex items-center gap-2 px-4 py-2.5 sm:py-2 rounded-full text-xs sm:text-sm transition-all border ${
                    count > 0 ? 'bg-stone-900 border-stone-900 text-white' : 'bg-white border-stone-300 text-stone-700 hover:border-stone-500'
                  }`}>
                  <SlidersHorizontal size={14} strokeWidth={1.5} />
                  Filters
                  {count > 0 && (
                    <span className="bg-white/20 text-[10px] tracking-widest uppercase px-1.5 py-0.5 rounded-full">{count}</span>
                  )}
                </button>

                {/* Sort menu — popover-style dropdown matching the filter aesthetic.
                    Closes on selection, on outside click (via the backdrop), or Escape. */}
                <div className="relative shrink-0">
                  <button onClick={() => setSortMenuOpen((o) => !o)}
                    className={`inline-flex items-center gap-2 px-4 py-2.5 sm:py-2 rounded-full text-xs sm:text-sm transition-all border bg-white border-stone-300 text-stone-700 hover:border-stone-500`}>
                    <ArrowUpDown size={14} strokeWidth={1.5} />
                    <span className="hidden sm:inline">{activeSort.label}</span>
                    <span className="sm:hidden">Sort</span>
                    <ChevronDown size={12} strokeWidth={2} className={`transition-transform ${sortMenuOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {sortMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setSortMenuOpen(false)} aria-hidden="true" />
                      <div className="absolute z-40 mt-2 left-0 sm:left-auto sm:right-0 min-w-[15rem] bg-white rounded-2xl shadow-2xl border border-stone-200 py-2 animate-in fade-in slide-in-from-top-2 duration-150" role="menu">
                        <p className="px-4 pt-1 pb-2 text-[10px] tracking-widest uppercase text-stone-400 font-medium">Sort by</p>
                        {WARDROBE_SORT_OPTIONS.map((o) => {
                          const isActive = o.key === sortBy;
                          return (
                            <button key={o.key} onClick={() => { setSortBy(o.key); setSortMenuOpen(false); }}
                              className={`w-full text-left px-4 py-2.5 flex items-start justify-between gap-3 transition-colors ${
                                isActive ? 'bg-stone-100' : 'hover:bg-stone-50'
                              }`}
                              role="menuitemradio" aria-checked={isActive}
                            >
                              <div className="min-w-0">
                                <p className={`text-sm ${isActive ? 'text-stone-900 font-medium' : 'text-stone-800'}`}>{o.label}</p>
                                <p className="text-[11px] text-stone-500 mt-0.5">{o.hint}</p>
                              </div>
                              {isActive && <Check size={16} strokeWidth={2} className="shrink-0 text-stone-900 mt-0.5" />}
                            </button>
                          );
                        })}
                        <div className="border-t border-stone-200 mt-2 pt-2 px-4 pb-1">
                          <p className="text-[10px] text-stone-400 italic">★ Favourites always pin to the top</p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
                {activeBadges.map((b, i) => (
                  <button key={i} onClick={b.clear}
                    className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs bg-white border border-stone-200 text-stone-700 hover:border-stone-400 hover:text-stone-900 transition-colors group">
                    {b.swatch && <span className="w-2.5 h-2.5 rounded-full border border-stone-300/50"
                      style={b.swatch.startsWith('linear') ? { background: b.swatch } : { backgroundColor: b.swatch }} />}
                    {b.label}
                    <X size={12} strokeWidth={1.5} className="text-stone-400 group-hover:text-stone-900" />
                  </button>
                ))}
                {count > 1 && (
                  <button onClick={() => {
                    setSubCategoryFilter('All Types');
                    setSeasonFilter('All Seasons');
                    setBrandFilter('All Brands');
                    setStyleFilter('All Styles');
                    setColorFilter('All Colours');
                  }} className="text-[10px] tracking-widest uppercase text-stone-500 hover:text-stone-900 underline underline-offset-2 transition-colors px-2">
                    Clear all
                  </button>
                )}
              </>
            );
          })()}
        </div>
      </div>

      <WardrobeFiltersSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        subCategories={subCategoriesForCategory}
        subCategoryFilter={subCategoryFilter}
        setSubCategoryFilter={setSubCategoryFilter}
        seasonFilter={seasonFilter}
        setSeasonFilter={setSeasonFilter}
        allBrands={allBrands}
        brandFilter={brandFilter}
        setBrandFilter={setBrandFilter}
        styleFilter={styleFilter}
        setStyleFilter={setStyleFilter}
        usedColors={usedColors}
        colorFilter={colorFilter}
        setColorFilter={setColorFilter}
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-3 gap-x-4 gap-y-8 md:gap-x-6 md:gap-y-10">
        {sortedItems.map(item => {
          const isSelected = selectedIds.has(item.id);
          return (
          <div
            key={item.id}
            onClick={() => selectMode ? toggleSelected(item.id) : onItemClick?.(item.id)}
            onContextMenu={(e) => { e.preventDefault(); if (!selectMode) enterSelectMode(item.id); }}
            className={`group relative flex flex-col gap-4 cursor-pointer transition-all duration-300 active:scale-[0.97] lg:hover:-translate-y-1 ${selectMode && isSelected ? 'ring-2 ring-stone-900 rounded-2xl' : ''}`}
          >
            <div className={`aspect-[3/4] rounded-2xl bg-stone-100 relative overflow-hidden smooth-shadow lg:group-hover:shadow-xl transition-shadow duration-300 ${selectMode && isSelected ? 'opacity-90' : ''}`}>
              <div className="absolute top-4 left-4 z-20 flex items-center gap-2 flex-wrap max-w-[calc(100%-3.5rem)]">
                {item.status === 'wishlist' && (
                  <span className="glass-panel text-stone-900 text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-full font-medium flex items-center gap-1.5">
                    <Heart size={12} className="fill-stone-900" strokeWidth={0} /> Wishlist
                  </span>
                )}
                {item.lentTo && (() => {
                  const overdue = item.lentReturnBy && item.lentReturnBy < todayISO();
                  return (
                    <span className={`text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-full font-medium flex items-center gap-1.5 ${
                      overdue ? 'bg-red-600 text-white' : 'glass-panel text-stone-900'
                    }`}>
                      {overdue ? 'Overdue' : `Lent · ${item.lentTo}`}
                    </span>
                  );
                })()}
              </div>
              {selectMode ? (
                <div
                  className={`absolute top-4 right-4 z-20 w-7 h-7 rounded-full flex items-center justify-center transition-all shadow-sm ${
                    isSelected ? 'bg-stone-900 text-white' : 'bg-white/90 border border-stone-300 text-transparent'
                  }`}
                  aria-label={isSelected ? 'Selected' : 'Not selected'}
                >
                  <Check size={16} strokeWidth={2.5} />
                </div>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleFavorite?.(item); }}
                  className={`absolute top-4 right-4 z-20 p-2.5 rounded-full transition-all active:scale-90 shadow-sm ${
                    item.favorite
                      ? 'bg-brass-300 text-stone-900 opacity-100'
                      : 'bg-white/80 backdrop-blur-md text-stone-400 opacity-70 sm:opacity-0 sm:group-hover:opacity-100 hover:text-amber-500'
                  }`}
                  aria-label={item.favorite ? 'Remove favourite' : 'Mark as favourite'}
                >
                  <Star size={16} strokeWidth={1.5} className={item.favorite ? 'fill-stone-900' : ''} />
                </button>
              )}

              <WardrobeCardImage item={item} />
            </div>

            <div className="px-1">
              <div className="flex justify-between items-start mb-1.5 gap-4">
                <p className="text-[10px] font-semibold text-stone-500 tracking-[0.2em] uppercase truncate">
                  {item.brand}{itemSeasons(item).length > 0 && ` • ${itemSeasons(item).join(' · ')}`}
                </p>
                <p className="text-sm font-medium text-stone-900 shrink-0">£{item.price}</p>
              </div>
              <h3 className="font-display text-lg text-stone-800 leading-snug">{item.name}</h3>
              <div className="flex items-center gap-2 mt-1">
                {item.subCategory && (
                  <p className="text-xs text-stone-500">{item.category} • {item.subCategory}</p>
                )}
                {itemColors(item).length > 0 && (
                  <div className="flex gap-1">
                    {itemColors(item).slice(0, 3).map((c) => {
                      const swatch = COLOR_SWATCHES[c];
                      return <span key={c} title={c} className="w-2.5 h-2.5 rounded-full border border-stone-300/50"
                        style={swatch?.startsWith('linear') ? { background: swatch } : { backgroundColor: swatch }} />;
                    })}
                  </div>
                )}
              </div>
              {item.status === 'owned' && (() => {
                const w = itemWearCount(item);
                const cpw = itemCostPerWear(item);
                const days = daysSinceLastWorn(item);
                const stale = days === null || days >= 90;
                return (
                  <p className={`text-[11px] mt-1.5 tracking-wide ${stale ? 'text-stone-400' : 'text-stone-600'}`}>
                    {w === 0 ? 'Not worn yet'
                      : `${w} ${w === 1 ? 'wear' : 'wears'}${cpw !== null ? ` · £${cpw < 10 ? cpw.toFixed(2) : Math.round(cpw)}/wear` : ''}`}
                  </p>
                );
              })()}

              {item.status === 'wishlist' && (
                <div className="mt-3 text-[11px] py-2 px-3 rounded-lg flex items-start gap-2 bg-stone-100 text-stone-600">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" strokeWidth={1.5} />
                  <span>
                    {measurements.waist
                      ? 'Cross-check the brand\'s size chart against your Profile measurements before buying.'
                      : 'Add measurements in Profile to make size comparison easier before buying.'}
                  </span>
                </div>
              )}
            </div>
          </div>
          );
        })}

        {filteredItems.length === 0 && (
          <div className="col-span-full py-20 md:py-28 flex flex-col items-center justify-center text-center bg-white/50 border border-dashed border-stone-300 rounded-3xl px-6">
            <svg width="80" height="80" viewBox="0 0 80 80" fill="none" className="mb-6 text-stone-300">
              <circle cx="40" cy="40" r="36" stroke="currentColor" strokeWidth="0.6" strokeDasharray="2 3" />
              <path d="M28 28 L24 32 L20 30 L24 46 H56 L60 30 L56 32 L52 28 Z" fill="none" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
              <path d="M32 28 Q40 34 48 28" stroke="currentColor" strokeWidth="0.8" fill="none" strokeLinecap="round" />
              <line x1="36" y1="52" x2="44" y2="60" stroke="currentColor" strokeWidth="0.6" />
              <line x1="44" y1="52" x2="36" y2="60" stroke="currentColor" strokeWidth="0.6" />
            </svg>
            <p className="font-display text-2xl text-stone-700 tracking-tight">Nothing here yet</p>
            <p className="text-sm text-stone-500 mt-3 max-w-sm">
              {items.length === 0
                ? 'Tap + to add your first piece — by link, photo, or manual entry.'
                : 'Try a different filter, or clear the search.'}
            </p>
            {items.length === 0 && (
              <button onClick={openAddModal} className="mt-8 bg-stone-900 text-white px-6 py-3 rounded-full text-sm font-medium hover:bg-stone-800 transition-all shadow-lg active:scale-[0.98] inline-flex items-center gap-2">
                <Plus size={16} strokeWidth={1.5} /> Add your first item
              </button>
            )}
          </div>
        )}
      </div>

      </div>
      {/* ─── /MAIN COLUMN ─── */}

      {/* ─── ASIDE: Today panel (desktop-only sticky right column) ─── */}
      {/* Hidden on mobile (`hidden lg:flex`) — mobile gets a compact
          TodayTile + DailyDigest at the TOP of the wardrobe view instead,
          so daily actions stay one tap away without burying search/filters
          or stacking under the grid. The top offset (lg:top-36) sits the
          aside just below the sticky page header. */}
      {/* Sticky aside — truly fixed once stuck. No internal overflow scroller.
          Top padding intentionally omitted so the Add/Select command row's
          top edge aligns horizontally with the search bar in the main column. */}
      <aside className="hidden lg:flex lg:col-span-4 lg:col-start-9 lg:row-start-1 lg:sticky lg:top-[9rem] flex-col gap-3 lg:pr-1 lg:pb-6">
        {/* Always-visible primary CTA + Select toggle. All controls share
            h-12 with the search bar in the main column so they sit on the
            same horizontal baseline. */}
        <div className="flex items-stretch gap-2">
          <button
            onClick={openAddModal}
            className="flex-1 h-12 bg-stone-900 text-white px-5 rounded-2xl text-sm font-medium flex items-center justify-center gap-2 hover:bg-stone-800 transition-all smooth-shadow"
          >
            <Plus size={18} strokeWidth={1.5} /> Add to Collection
          </button>
          {items.length > 0 && (
            <button
              onClick={selectMode ? exitSelectMode : () => enterSelectMode()}
              className={`shrink-0 h-12 px-4 rounded-2xl text-[10px] tracking-widest uppercase border transition-colors ${
                selectMode
                  ? 'bg-stone-900 text-white border-stone-900'
                  : 'bg-white text-stone-700 border-stone-300 hover:border-stone-500'
              }`}
              title={selectMode ? 'Cancel selection' : 'Select multiple items'}
            >
              {selectMode ? 'Cancel' : 'Select'}
            </button>
          )}
        </div>

        <TodayTile
          items={items}
          outfits={outfits}
          schedules={schedules}
          weather={weather}
          weatherSeasons={weatherSeasons}
          aiTemperature={aiTemperature}
          measurements={measurements}
          onOpenOutfit={onOpenOutfit}
          onScheduleOutfit={onScheduleOutfit}
          onSaveOutfit={onSaveOutfit}
          onLogOutfitWear={onLogOutfitWear}
        />

        <DailyDigest
          items={items}
          outfits={outfits}
          schedules={schedules}
          inspirations={inspirations}
          onOpenItem={onItemClick}
          onOpenOutfit={onOpenOutfit}
          onOpenInspiration={onOpenInspiration}
          onOpenInspirationTab={onOpenInspirationTab}
        />

        {recommendation && (() => {
          const reasons = [];
          const seasons = itemSeasons(recommendation);
          if (weather && weatherSeasons && seasons.some((s) => weatherSeasons.includes(s))) {
            reasons.push(`fits today's ${weather.temp}°C`);
          } else if (weather) {
            reasons.push(`for today's ${weather.temp}°C · ${weatherLabel(weather.code)}`);
          }
          const days = daysSinceLastWorn(recommendation);
          if (days === null) reasons.push("you haven't worn it yet");
          else if (days >= 60) reasons.push(`unworn for ${days} days`);
          else if (days >= 14) reasons.push(`not worn in ${days} days`);
          return (
            <button onClick={() => onItemClick?.(recommendation.id)}
              className="text-left w-full bg-stone-900 text-white rounded-2xl lg:rounded-3xl p-4 sm:p-5 flex items-center gap-4 group hover:bg-stone-800 transition-all shadow-2xl active:scale-[0.98]">
              <div className="w-16 h-20 sm:w-20 sm:h-24 rounded-xl overflow-hidden bg-stone-800 shrink-0">
                {itemImages(recommendation)[0] && <img src={itemImages(recommendation)[0]} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] tracking-[0.25em] uppercase text-stone-400 mb-1.5 flex items-center gap-2">
                  <span className="brass-rule" aria-hidden="true"></span> Today's pick
                </p>
                <p className="font-display text-base sm:text-lg text-white leading-tight truncate">{recommendation.name}</p>
                <p className="text-[11px] text-stone-400 mt-1 truncate">
                  {recommendation.brand}{seasons.length > 0 && ` · ${seasons.join(' · ')}`}
                </p>
                {reasons.length > 0 && (
                  <p className="text-[10px] text-emerald-300/90 mt-2 tracking-wide italic truncate" title={reasons.join(' · ')}>
                    Suggested · {reasons.join(' · ')}
                  </p>
                )}
              </div>
            </button>
          );
        })()}

        {tomorrowOutfit && (
          <button onClick={() => onOpenOutfit?.(tomorrowOutfit.id)}
            className="text-left w-full bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3 hover:bg-amber-100/70 transition-all active:scale-[0.99]">
            <div className="flex gap-1 shrink-0">
              {tomorrowPieces.slice(0, 3).map((p) => (
                <div key={p.id} className="w-10 h-12 rounded-md overflow-hidden bg-white border border-amber-100">
                  {itemImages(p)[0] && <img src={itemImages(p)[0]} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />}
                </div>
              ))}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] tracking-[0.2em] uppercase text-brass-700 font-semibold">✦ Tomorrow</p>
              <p className="font-display text-sm text-stone-900 truncate mt-0.5">{tomorrowOutfit.name}</p>
              <p className="text-[11px] text-stone-500">{tomorrowPieces.length} pieces · tap to view</p>
            </div>
            <ChevronRight size={18} className="text-brass-600 shrink-0" />
          </button>
        )}
      </aside>
      {/* ─── /ASIDE ─── */}

      </div>
      {/* ─── /two-column grid ─── */}

      {selectMode && createPortal(
        <div className="fixed left-0 right-0 z-[60] flex justify-center px-4 pointer-events-none"
             style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 88px)' }}>
          <div className="pointer-events-auto bg-stone-900 text-white rounded-full shadow-2xl flex items-center gap-1 sm:gap-2 pl-5 pr-2 py-2 max-w-full overflow-x-auto hide-scrollbar">
            <span className="text-xs tracking-widest uppercase text-stone-300 shrink-0 pr-2 border-r border-stone-700">
              {selectedIds.size} selected
            </span>
            <button
              disabled={selectedIds.size === 0}
              onClick={async () => {
                const ids = [...selectedIds];
                const allFav = ids.every((id) => items.find((i) => i.id === id)?.favorite);
                await onBulkUpdate?.(ids, { favorite: !allFav });
                exitSelectMode();
              }}
              className="text-xs tracking-wider uppercase px-3 py-2 rounded-full hover:bg-stone-800 disabled:opacity-40 flex items-center gap-1.5 shrink-0"
            >
              <Star size={14} strokeWidth={1.5} /> Favourite
            </button>
            <button
              disabled={selectedIds.size === 0}
              onClick={async () => {
                const ids = [...selectedIds];
                const allWish = ids.every((id) => items.find((i) => i.id === id)?.status === 'wishlist');
                await onBulkUpdate?.(ids, { status: allWish ? 'owned' : 'wishlist' });
                exitSelectMode();
              }}
              className="text-xs tracking-wider uppercase px-3 py-2 rounded-full hover:bg-stone-800 disabled:opacity-40 flex items-center gap-1.5 shrink-0"
            >
              <Heart size={14} strokeWidth={1.5} /> Wishlist
            </button>
            <button
              disabled={selectedIds.size === 0}
              onClick={async () => {
                const ids = [...selectedIds];
                if (!window.confirm(`Move ${ids.length} item${ids.length === 1 ? '' : 's'} to Trash?`)) return;
                await onBulkDelete?.(ids);
                exitSelectMode();
              }}
              className="text-xs tracking-wider uppercase px-3 py-2 rounded-full hover:bg-red-900/40 disabled:opacity-40 flex items-center gap-1.5 shrink-0"
            >
              <Trash2 size={14} strokeWidth={1.5} /> Delete
            </button>
            <button
              onClick={exitSelectMode}
              className="text-xs tracking-wider uppercase px-4 py-2 rounded-full bg-white text-stone-900 ml-1 shrink-0"
            >
              Done
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// Resize an image File to a small JPEG data URL we can safely embed in a
// Firestore document (Spark plan has no Storage; the 1 MiB per-doc limit
// is the constraint). 800px max + quality 0.75 gives ~50–150 KB per image.
function resizeImageToDataUrl(file, maxWidth = 800, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        // Firestore doc size cap is 1,048,487 bytes; base64 inflates by ~33%.
        // Reject anything over 900 KB so we never hit that wall.
        if (dataUrl.length > 900_000) {
          reject(new Error('Image is too large after compression. Try a simpler photo.'));
          return;
        }
        resolve(dataUrl);
      };
      img.onerror = reject;
      img.src = event.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function AddItemModal({ user, shops = [], existingItem = null, removeBackground = false, onClose, onSave, onOpenReceiptModal, onOpenBulkImport, onOpenSweep }) {
  const isEdit = !!existingItem;
  const toast = useToast();
  const [step, setStep] = useState(isEdit ? 2 : 1);
  const [linkInput, setLinkInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [cutoutBusy, setCutoutBusy] = useState(false);
  const [editingPhoto, setEditingPhoto] = useState(null); // { index, src }
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState(existingItem ? {
    name: existingItem.name || '',
    brand: existingItem.brand || '',
    price: existingItem.price?.toString() || '',
    category: existingItem.category || 'Tops',
    subCategory: existingItem.subCategory || '',
    seasons: Array.isArray(existingItem.seasons)
      ? existingItem.seasons
      : (existingItem.season && existingItem.season !== 'All Seasons' ? [existingItem.season] : []),
    styles: Array.isArray(existingItem.styles) ? existingItem.styles : [],
    status: existingItem.status || 'owned',
    images: itemImages(existingItem),
    imageMeta: Array.isArray(existingItem.imageMeta) ? existingItem.imageMeta : [],
    description: existingItem.description || '',
    sourceUrl: existingItem.sourceUrl || '',
    purchasedDate: existingItem.purchasedDate || '',
    purchasedFrom: existingItem.purchasedFrom || '',
    size: existingItem.size || '',
    lentTo: existingItem.lentTo || '',
    lentReturnBy: existingItem.lentReturnBy || '',
    wishlistReason: existingItem.wishlistReason || '',
    care: Array.isArray(existingItem.care) ? existingItem.care : [],
    colors: Array.isArray(existingItem.colors) ? existingItem.colors : [],
    materials: Array.isArray(existingItem.materials) ? existingItem.materials : [],
  } : {
    name: '', brand: '', price: '', category: 'Tops', subCategory: '',
    seasons: [], styles: [], status: 'owned', images: [], imageMeta: [],
    description: '', sourceUrl: '', purchasedDate: '', purchasedFrom: '', size: '', care: [], colors: [], materials: [], lentTo: '', lentReturnBy: '', wishlistReason: '',
  });

  // Scan a care label / brand tag / barcode → Gemini Vision pre-fills the form.
  // Materials/care/colour are mapped to the app's known vocabularies (chips light
  // up correctly). Unmapped care phrases get appended to the description so they
  // aren't lost. The user always lands on step 2 to review.
  const [scanSummary, setScanSummary] = useState(null);
  const handleScanLabel = async (file) => {
    if (!file) return;
    if (!isAIEnabled()) { setError('Label scanning needs Gemini configured (VITE_RECAPTCHA_SITE_KEY + Firebase AI Logic).'); return; }
    setIsLoading(true); setError(null); setScanSummary(null);
    try {
      const dataUrl = await compressImageToDataUrl(file, { maxWidth: 1400, maxBytes: 600_000, enhance: false });
      const result = await analyzeLabelWithGemini({ imageDataUrl: dataUrl });

      const validMaterials = Array.isArray(result.materials)
        ? result.materials.filter((m) => MATERIALS.includes(m))
        : [];

      // Care: map each phrase to a chip when possible; collect unmapped phrases
      // so we can append them to the description (nothing gets lost).
      const careIn = Array.isArray(result.care) ? result.care.filter(Boolean) : [];
      const careChips = []; const careUnmapped = [];
      for (const phrase of careIn) {
        const tag = matchCareTag(phrase);
        if (tag && !careChips.includes(tag)) careChips.push(tag);
        else if (!tag) careUnmapped.push(phrase);
      }

      // Colour fuzzy-map → known family
      const mappedColor = matchColorFamily(result.color);

      const noteBits = [
        result.productCode ? `Product code: ${result.productCode}` : '',
        result.barcode ? `Barcode: ${result.barcode}` : '',
        careUnmapped.length ? `Care: ${careUnmapped.join(' · ')}` : '',
        result.notes || '',
      ].filter(Boolean);

      setFormData((prev) => ({
        ...prev,
        name: prev.name || result.productName || '',
        brand: prev.brand || result.brand || '',
        size: prev.size || result.size || '',
        colors: prev.colors.length ? prev.colors : (mappedColor ? [mappedColor] : prev.colors),
        materials: prev.materials.length ? prev.materials : validMaterials,
        care: prev.care.length ? prev.care : careChips,
        description: [prev.description, noteBits.join('\n')].filter(Boolean).join('\n').trim(),
      }));

      setScanSummary({
        brand: result.brand || '',
        productName: result.productName || '',
        size: result.size || '',
        color: mappedColor || result.color || '',
        materialsCount: validMaterials.length,
        careCount: careChips.length,
        unmappedColor: result.color && !mappedColor ? result.color : null,
      });
      setStep(2);
    } catch (err) {
      setError(err?.message || 'Could not read this label.');
    } finally {
      setIsLoading(false);
    }
  };
  const handleScanInput = (e) => {
    const f = e.target.files?.[0];
    if (f) handleScanLabel(f);
    // reset value so picking the same file twice re-fires onChange
    e.target.value = '';
  };

  // Identify-with-AI: one photo of the item → Gemini Vision returns a draft
  // → form opens with category, brand, name, colours, materials, styles,
  // seasons, description pre-filled. The single biggest import accelerator.
  const handleIdentifyItem = async (file) => {
    if (!file) return;
    if (!isAIEnabled()) { setError('Identify needs Gemini configured (VITE_RECAPTCHA_SITE_KEY + Firebase AI Logic).'); return; }
    setIsLoading(true); setError(null);
    try {
      const dataUrl = await compressImageToDataUrl(file, { maxWidth: 1200, maxBytes: 350_000, enhance: false });
      const knownBrands = Array.from(new Set((shops || []).map((s) => s.name).filter(Boolean)));
      const result = await identifyItemWithGemini({ imageDataUrl: dataUrl, knownBrands });

      const validMaterials = (result.materials || []).filter((m) => MATERIALS.includes(m));
      const validColours = (result.colors || []).map((c) => matchColorFamily(c)).filter(Boolean);
      const validStyles = (result.styles || []).filter((s) => STYLES.includes(s));
      const validSeasons = (result.seasons || []).filter((s) => ['Spring', 'Summer', 'Autumn', 'Winter'].includes(s));

      // Pre-fill the form. Always set category (required). For other fields,
      // only overwrite if currently empty so partial work isn't lost.
      setFormData((prev) => ({
        ...prev,
        category: result.category || prev.category || 'Tops',
        subCategory: prev.subCategory || result.subCategory || '',
        brand: prev.brand || result.brand || '',
        name: prev.name || result.name || '',
        colors: prev.colors.length ? prev.colors : validColours,
        materials: prev.materials.length ? prev.materials : validMaterials,
        styles: prev.styles.length ? prev.styles : validStyles,
        seasons: prev.seasons.length ? prev.seasons : validSeasons,
        description: prev.description || result.description || '',
        // Use the same photo as the item's main image — that's what the user
        // identified, after all.
        images: prev.images.length ? prev.images : [dataUrl],
        imageMeta: prev.images.length ? prev.imageMeta : [{ cutout: false }],
      }));

      toast.show(`Identified · ${result.confidence ?? '–'}/100 confidence`, { kind: 'success', duration: 3500 });
      setScanSummary({
        brand: result.brand || '',
        productName: result.name || '',
        size: '',
        color: validColours[0] || result.colors?.[0] || '',
        materialsCount: validMaterials.length,
        careCount: 0,
        unmappedColor: result.colors?.find((c) => !matchColorFamily(c)) || null,
      });
      setStep(2);
    } catch (err) {
      setError(err?.message || 'Could not identify this item.');
    } finally {
      setIsLoading(false);
    }
  };
  const handleIdentifyInput = (e) => {
    const f = e.target.files?.[0];
    if (f) handleIdentifyItem(f);
    e.target.value = '';
  };

  // Paste-an-image-from-clipboard: works while the modal is open on desktop.
  useEffect(() => {
    const onPaste = async (e) => {
      const item = Array.from(e.clipboardData?.items || []).find((it) => it.type?.startsWith('image/'));
      if (!item) return;
      const file = item.getAsFile();
      if (!file) return;
      e.preventDefault();
      setIsLoading(true); setError(null);
      try {
        const originalDataUrl = await compressImageToDataUrl(file);
        let dataUrl = originalDataUrl;
        let cutoutOk = null;
        if (removeBackground) {
          setCutoutBusy(true);
          const out = await removeImageBackground(originalDataUrl);
          dataUrl = out.url; cutoutOk = out.ok;
          setCutoutBusy(false);
          toast.show(out.ok ? 'Background removed ✓ · tap to revert' : 'Cutout failed — kept original photo', { kind: out.ok ? 'success' : 'default', duration: 3500 });
        }
        setFormData((prev) => {
          if ((prev.images || []).length >= 6) return prev;
          const meta = Array.isArray(prev.imageMeta) ? prev.imageMeta : [];
          return {
            ...prev,
            images: [...(prev.images || []), dataUrl],
            imageMeta: [...meta, { cutout: cutoutOk === true, original: cutoutOk === true ? originalDataUrl : undefined }],
          };
        });
        setStep((s) => (s === 1 ? 2 : s));
      } catch (err) {
        setError(err?.message || 'Could not paste image.');
      } finally {
        setIsLoading(false);
        setCutoutBusy(false);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [removeBackground]);

  const addImageFiles = async (files) => {
    const list = Array.from(files || []).slice(0, 6 - (formData.images?.length || 0));
    if (!list.length) return;
    setIsLoading(true); setError(null);
    let firstNewDataUrl = null;
    try {
      let okCount = 0; let failCount = 0;
      for (const file of list) {
        const originalDataUrl = await compressImageToDataUrl(file);
        let dataUrl = originalDataUrl;
        let cutoutOk = null;
        if (removeBackground) {
          setCutoutBusy(true);
          const out = await removeImageBackground(originalDataUrl);
          dataUrl = out.url; cutoutOk = out.ok;
          if (out.ok) okCount++; else failCount++;
        }
        if (!firstNewDataUrl) firstNewDataUrl = dataUrl;
        setFormData((prev) => {
          const meta = Array.isArray(prev.imageMeta) ? prev.imageMeta : [];
          return {
            ...prev,
            images: [...(prev.images || []), dataUrl].slice(0, 6),
            imageMeta: [...meta, { cutout: cutoutOk === true, original: cutoutOk === true ? originalDataUrl : undefined }].slice(0, 6),
          };
        });
      }
      setCutoutBusy(false);
      if (removeBackground && (okCount || failCount)) {
        if (okCount && !failCount) toast.show(`Background removed ✓ on ${okCount} photo${okCount === 1 ? '' : 's'}`, { kind: 'success', duration: 3500 });
        else if (failCount && !okCount) toast.show(`Cutout failed on ${failCount} — kept originals`, { kind: 'default', duration: 4000 });
        else toast.show(`${okCount} cut out · ${failCount} kept original`, { kind: 'default', duration: 4000 });
      }
      setStep((s) => (s === 1 ? 2 : s));
      // Auto-extract colours from the first added photo IF no colour set yet.
      if (firstNewDataUrl && (!formData.colors || formData.colors.length === 0)) {
        try {
          const detected = await extractDominantColors(firstNewDataUrl);
          if (detected.length > 0) {
            setFormData((prev) => prev.colors?.length ? prev : { ...prev, colors: detected });
          }
        } catch (e) { console.warn('[wardrobe] colour extraction failed:', e); }
      }
    } catch (err) {
      setError(err?.message || 'Could not process one of the images.');
    } finally {
      setIsLoading(false);
    }
  };

  const removeImage = (index) => {
    setFormData((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
      imageMeta: (prev.imageMeta || []).filter((_, i) => i !== index),
    }));
  };

  const promoteToMain = (index) => {
    if (index === 0) return;
    setFormData((prev) => {
      const next = [...prev.images];
      const [moved] = next.splice(index, 1);
      next.unshift(moved);
      const meta = [...(prev.imageMeta || [])];
      const [movedMeta] = meta.splice(index, 1);
      if (movedMeta !== undefined) meta.unshift(movedMeta);
      return { ...prev, images: next, imageMeta: meta };
    });
  };

  const toggleSeason = (s) => {
    setFormData((prev) => {
      const current = prev.seasons || [];
      if (s === 'All Seasons') return { ...prev, seasons: [] };
      return {
        ...prev,
        seasons: current.includes(s) ? current.filter((x) => x !== s) : [...current, s],
      };
    });
  };

  const toggleStyle = (s) => {
    setFormData((prev) => {
      const current = prev.styles || [];
      return {
        ...prev,
        styles: current.includes(s) ? current.filter((x) => x !== s) : [...current, s],
      };
    });
  };

  const toggleCare = (c) => {
    setFormData((prev) => {
      const current = prev.care || [];
      return {
        ...prev,
        care: current.includes(c) ? current.filter((x) => x !== c) : [...current, c],
      };
    });
  };

  const toggleColor = (c) => {
    setFormData((prev) => {
      const current = prev.colors || [];
      return {
        ...prev,
        colors: current.includes(c) ? current.filter((x) => x !== c) : [...current, c],
      };
    });
  };

  const toggleMaterial = (m) => {
    setFormData((prev) => {
      const current = prev.materials || [];
      return {
        ...prev,
        materials: current.includes(m) ? current.filter((x) => x !== m) : [...current, m],
      };
    });
  };

  const handleImageUpload = (e) => addImageFiles(e.target.files);

  const importFromLink = async (e) => {
    e.preventDefault();
    if (!linkInput) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchProductFromUrl(linkInput);
      setFormData((prev) => ({
        ...prev,
        name: data.name || prev.name,
        brand: data.brand || prev.brand,
        images: data.imageUrl ? [...(prev.images || []), data.imageUrl].slice(0, 6) : prev.images,
        description: data.description || prev.description,
        price: data.price || prev.price,
        sourceUrl: data.sourceUrl || prev.sourceUrl || linkInput,
        status: 'wishlist',
      }));
      setStep(2);
    } catch (err) {
      setError(err?.message || 'Import failed. Try Manual Entry instead.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) return;
    setIsLoading(true); setError(null);
    try {
      // Strip the in-memory `original` snapshot from imageMeta before save.
      // We keep originals around in the modal so the user can revert a cutout,
      // but persisting both versions doubles per-image storage and risks the
      // 1MiB Firestore doc cap for items with 6 cut-out photos.
      const slimMeta = Array.isArray(formData.imageMeta)
        ? formData.imageMeta.map((m) => m ? { cutout: !!m.cutout, ...(m.angle ? { angle: m.angle } : {}) } : null)
        : [];
      const raw = {
        ...formData,
        imageMeta: slimMeta,
        id: existingItem?.id || newId(),
        price: Number(formData.price) || 0,
        images: (formData.images || []).filter(Boolean),
        createdAt: existingItem?.createdAt || new Date().toISOString(),
      };
      // Firestore rejects undefined values silently in some SDK paths.
      // Strip them defensively so saves never hang.
      const payload = {};
      for (const [k, v] of Object.entries(raw)) {
        if (v !== undefined && k !== 'imageUrl') payload[k] = v;
      }
      await onSave(payload);
    } catch (err) {
      console.error('[wardrobe] item save failed:', err);
      setError(err?.message || 'Save failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-6 transition-all">
      <div className="bg-[#F7F5F2] w-full sm:max-w-xl sm:rounded-[2rem] rounded-t-[2rem] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-300 flex flex-col max-h-[92vh] sm:max-h-[90vh]">
        <div className="flex justify-between items-center px-4 sm:px-6 py-4 sm:py-5 border-b border-stone-200/60 bg-white shrink-0">
          <h3 className="text-xl sm:text-2xl font-display font-medium text-stone-900">{isEdit ? 'Edit Item' : 'Add to Atelier'}</h3>
          <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-full transition-colors">
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        {step === 1 ? (
          <div className="p-4 sm:p-6 lg:p-10 flex-1 overflow-y-auto overflow-x-hidden">
            <div className="space-y-8">
              <p className="text-stone-500 text-sm leading-relaxed">
                Add items to your digital wardrobe via a product link from your favorite store, or capture an item you already own.
              </p>

              <form onSubmit={importFromLink} className="space-y-3">
                <label className="block text-[10px] tracking-widest font-semibold text-stone-500 uppercase">Import via Link</label>
                <div className="relative flex items-center">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <LinkIcon size={18} className="text-stone-400" strokeWidth={1.5} />
                  </div>
                  <input
                    type="url" value={linkInput} onChange={(e) => setLinkInput(e.target.value)}
                    placeholder="Paste URL (e.g. hollandcooper.com/...)"
                    className="block w-full pl-12 pr-32 py-4 bg-white border border-stone-200 rounded-2xl focus:ring-1 focus:ring-stone-900 focus:border-stone-900 transition-all text-sm"
                    required
                  />
                  <button
                    type="submit" disabled={isLoading}
                    className="absolute right-2 top-2 bottom-2 bg-stone-900 text-white px-6 rounded-xl text-sm font-medium hover:bg-stone-800 transition-colors disabled:opacity-50"
                  >
                    {isLoading ? 'Scanning...' : 'Extract'}
                  </button>
                </div>
              </form>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-stone-200"></div>
                <span className="flex-shrink-0 mx-4 text-stone-400 text-xs tracking-widest uppercase">Or</span>
                <div className="flex-grow border-t border-stone-200"></div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <label className="group relative flex flex-col items-center justify-center p-5 sm:p-6 bg-stone-900 border border-stone-900 rounded-2xl cursor-pointer hover:bg-stone-800 transition-all col-span-2 sm:col-span-3 text-center">
                  <span className="absolute top-2 right-2 text-[9px] tracking-widest uppercase text-brass-300 font-medium">Fastest</span>
                  <Sparkles size={26} strokeWidth={1} className="mb-2 text-brass-300 group-hover:scale-110 transition-transform duration-300" />
                  <span className="font-display text-base sm:text-lg text-white">Identify with AI</span>
                  <span className="text-[10px] text-stone-400 mt-1 tracking-wide uppercase">Snap any item · category, brand, colours, name — auto-filled</span>
                  <input type="file" accept="image/*" capture="environment" onChange={handleIdentifyInput} className="hidden" />
                </label>
                {onOpenSweep && (
                  <button type="button" onClick={onOpenSweep} className="group flex flex-col items-center justify-center p-4 sm:p-5 bg-brass-50 border border-brass-300 rounded-2xl cursor-pointer hover:border-brass-500 transition-all col-span-2 sm:col-span-3">
                    <Camera size={22} strokeWidth={1} className="mb-2 text-brass-700 group-hover:scale-110 transition-transform duration-300" />
                    <span className="font-medium text-xs sm:text-sm text-stone-900 text-center">Closet sweep</span>
                    <span className="text-[10px] text-stone-500 mt-1 tracking-wide uppercase text-center">Take many photos in a row · AI identifies each · save them all</span>
                  </button>
                )}
                {onOpenBulkImport && (
                  <button type="button" onClick={onOpenBulkImport} className="group flex flex-col items-center justify-center p-4 sm:p-5 bg-white border border-stone-200 rounded-2xl cursor-pointer hover:border-stone-900 transition-all col-span-2 sm:col-span-3">
                    <LinkIcon size={22} strokeWidth={1} className="mb-2 text-stone-900 group-hover:scale-110 transition-transform duration-300" />
                    <span className="font-medium text-xs sm:text-sm text-stone-900 text-center">Search & Bulk Import</span>
                    <span className="text-[10px] text-stone-400 mt-1 tracking-wide uppercase text-center">Find on the web · paste many URLs at once</span>
                  </button>
                )}
                <label className="group flex flex-col items-center justify-center p-4 sm:p-5 bg-white border border-stone-200 rounded-2xl cursor-pointer hover:border-stone-900 transition-all">
                  <Camera size={24} strokeWidth={1} className="mb-2 text-stone-900 group-hover:scale-110 transition-transform duration-300" />
                  <span className="font-medium text-xs sm:text-sm text-stone-900 text-center">Add Photos</span>
                  <span className="text-[10px] text-stone-400 mt-1 tracking-wide uppercase text-center">Up to 6</span>
                  <input type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
                </label>
                <label className="group flex flex-col items-center justify-center p-4 sm:p-5 bg-white border border-stone-200 rounded-2xl cursor-pointer hover:border-stone-900 transition-all">
                  <Wand2 size={24} strokeWidth={1} className="mb-2 text-stone-900 group-hover:scale-110 transition-transform duration-300" />
                  <span className="font-medium text-xs sm:text-sm text-stone-900 text-center">Scan Label</span>
                  <span className="text-[10px] text-stone-400 mt-1 tracking-wide uppercase text-center">Care tag · barcode</span>
                  <input type="file" accept="image/*" capture="environment" onChange={handleScanInput} className="hidden" />
                </label>
                {onOpenReceiptModal && (
                  <button type="button" onClick={onOpenReceiptModal} className="group flex flex-col items-center justify-center p-4 sm:p-5 bg-white border border-stone-200 rounded-2xl cursor-pointer hover:border-stone-900 transition-all">
                    <Sparkles size={24} strokeWidth={1} className="mb-2 text-stone-900 group-hover:scale-110 transition-transform duration-300" />
                    <span className="font-medium text-xs sm:text-sm text-stone-900 text-center">Paste Receipt</span>
                    <span className="text-[10px] text-stone-400 mt-1 tracking-wide uppercase text-center">Order email</span>
                  </button>
                )}
                <button type="button" onClick={() => setStep(2)} className="group flex flex-col items-center justify-center p-4 sm:p-5 bg-white border border-stone-200 rounded-2xl cursor-pointer hover:border-stone-900 transition-all">
                  <Plus size={24} strokeWidth={1} className="mb-2 text-stone-900 group-hover:scale-110 transition-transform duration-300" />
                  <span className="font-medium text-xs sm:text-sm text-stone-900 text-center">Manual Entry</span>
                  <span className="text-[10px] text-stone-400 mt-1 tracking-wide uppercase text-center">Type details</span>
                </button>
              </div>
              <p className="text-[10px] text-stone-400 tracking-wide text-center">
                Tip: on desktop, copy an image and press <span className="font-medium text-stone-600">Ctrl+V</span> anywhere in this dialog to paste it in.
              </p>
              {error && <p className="text-xs text-red-700">{error}</p>}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
            <div className="p-4 sm:p-6 lg:p-10 flex-1 min-h-0 overflow-y-auto overflow-x-hidden space-y-6">
              {scanSummary && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 flex items-start gap-3">
                  <Wand2 size={16} className="text-emerald-700 mt-0.5 shrink-0" strokeWidth={1.5} />
                  <div className="flex-1 min-w-0 text-xs leading-relaxed">
                    <p className="font-medium text-emerald-900">Read from label</p>
                    <p className="text-emerald-800/80 mt-0.5">
                      {[
                        scanSummary.brand && `Brand: ${scanSummary.brand}`,
                        scanSummary.productName && `Name: ${scanSummary.productName}`,
                        scanSummary.size && `Size: ${scanSummary.size}`,
                        scanSummary.color && `Colour: ${scanSummary.color}`,
                        scanSummary.materialsCount && `${scanSummary.materialsCount} material${scanSummary.materialsCount === 1 ? '' : 's'}`,
                        scanSummary.careCount && `${scanSummary.careCount} care chip${scanSummary.careCount === 1 ? '' : 's'}`,
                      ].filter(Boolean).join(' · ') || 'No details — try a clearer photo.'}
                    </p>
                    {scanSummary.unmappedColor && (
                      <p className="text-brass-700 mt-1">Colour "{scanSummary.unmappedColor}" didn't match a palette family — set it manually below.</p>
                    )}
                    <p className="text-emerald-800/60 mt-1">Review the fields below and add a category before saving.</p>
                  </div>
                  <button type="button" onClick={() => setScanSummary(null)} className="text-emerald-700/60 hover:text-emerald-900 shrink-0" aria-label="Dismiss">
                    <X size={14} strokeWidth={1.5} />
                  </button>
                </div>
              )}
              <div>
                <div className="flex items-baseline justify-between mb-3 gap-3 flex-wrap">
                  <label className="block text-[10px] tracking-widest font-semibold text-stone-500 uppercase">
                    Photos <span className="text-stone-400 font-normal normal-case tracking-normal ml-1">{formData.images.length} / 6</span>
                  </label>
                  {formData.images.length === 0 && (formData.brand || formData.name) && (
                    <a
                      href={`https://www.google.com/search?tbm=shop&q=${encodeURIComponent([formData.brand, formData.name].filter(Boolean).join(' '))}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] tracking-wider uppercase px-3 py-1.5 rounded-full bg-stone-900 text-white hover:bg-stone-800 transition-colors inline-flex items-center gap-1.5"
                    >
                      Find product photo ↗
                    </a>
                  )}
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {formData.images.map((img, i) => (
                    <div key={i} className="aspect-square rounded-xl overflow-hidden bg-stone-100 border border-stone-200 relative group">
                      <img src={img} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                      {formData.imageMeta?.[i]?.cutout && (
                        <button type="button"
                          onClick={() => {
                            // Revert this thumb to the saved original. Original
                            // moves into images[], cutout is dropped.
                            const original = formData.imageMeta[i]?.original;
                            if (!original) return;
                            setFormData((prev) => {
                              const nextImages = [...prev.images]; nextImages[i] = original;
                              const nextMeta = [...(prev.imageMeta || [])];
                              nextMeta[i] = { ...nextMeta[i], cutout: false };
                              return { ...prev, images: nextImages, imageMeta: nextMeta };
                            });
                            toast.show('Reverted to original photo', { kind: 'default', duration: 2500 });
                          }}
                          className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-emerald-600 text-white text-[9px] tracking-widest uppercase rounded-full font-medium shadow-sm hover:bg-emerald-700 transition-colors"
                          title="Revert to original photo">
                          Cutout · revert
                        </button>
                      )}
                      {!formData.imageMeta?.[i]?.cutout && (
                        <button type="button"
                          disabled={cutoutBusy}
                          onClick={async () => {
                            // Apply cutout to this thumb. Keeps a copy of the
                            // currently-displayed photo as the new "original"
                            // for future reverts.
                            const src = formData.images[i];
                            setCutoutBusy(true);
                            try {
                              const out = await removeImageBackground(src);
                              if (out.ok) {
                                setFormData((prev) => {
                                  const nextImages = [...prev.images]; nextImages[i] = out.url;
                                  const nextMeta = [...(prev.imageMeta || [])];
                                  while (nextMeta.length <= i) nextMeta.push({});
                                  nextMeta[i] = { ...nextMeta[i], cutout: true, original: src };
                                  return { ...prev, images: nextImages, imageMeta: nextMeta };
                                });
                                toast.show('Background removed ✓', { kind: 'success', duration: 2500 });
                              } else {
                                toast.show('Cutout failed — kept original', { kind: 'default', duration: 3000 });
                              }
                            } finally { setCutoutBusy(false); }
                          }}
                          className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-white/90 backdrop-blur text-stone-700 text-[9px] tracking-widest uppercase rounded-full font-medium shadow-sm hover:text-stone-900 transition-colors opacity-0 sm:group-hover:opacity-100"
                          title="Remove background">
                          Cut out
                        </button>
                      )}
                      <button type="button" onClick={() => setEditingPhoto({ index: i, src: img })}
                        className="absolute top-1.5 right-9 p-1.5 bg-white/90 backdrop-blur text-stone-900 rounded-full opacity-70 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity hover:bg-stone-100 shadow-sm"
                        title="Crop or rotate">
                        <Wand2 size={12} strokeWidth={2} />
                      </button>
                      <select
                        value={formData.imageMeta?.[i]?.angle || ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          setFormData((prev) => {
                            const meta = [...(prev.imageMeta || [])];
                            while (meta.length <= i) meta.push({});
                            meta[i] = { ...meta[i], angle: v };
                            return { ...prev, imageMeta: meta };
                          });
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="absolute bottom-1.5 right-1.5 text-[9px] tracking-widest uppercase bg-white/90 backdrop-blur text-stone-900 rounded-full px-2 py-0.5 border border-stone-200 outline-none cursor-pointer">
                        <option value="">—</option>
                        <option value="Front">Front</option>
                        <option value="Back">Back</option>
                        <option value="Styled">Styled</option>
                        <option value="Detail">Detail</option>
                      </select>
                      <button type="button" onClick={() => removeImage(i)} className="absolute top-1.5 right-1.5 p-1.5 bg-white/90 backdrop-blur text-stone-900 rounded-full opacity-70 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity hover:bg-red-50 hover:text-red-600 shadow-sm">
                        <X size={12} strokeWidth={2} />
                      </button>
                      {i === 0 ? (
                        <span className="absolute bottom-1.5 left-1.5 px-2 py-0.5 bg-stone-900 text-white text-[9px] tracking-widest uppercase rounded-full">Main</span>
                      ) : (
                        <button type="button" onClick={() => promoteToMain(i)}
                          className="absolute bottom-1.5 left-1.5 px-2 py-1 bg-white/90 backdrop-blur text-stone-900 text-[9px] tracking-widest uppercase rounded-full opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity hover:bg-stone-100 shadow-sm flex items-center gap-1"
                          title="Set as main photo">
                          <Star size={10} strokeWidth={2} /> Make main
                        </button>
                      )}
                    </div>
                  ))}
                  {cutoutBusy && (
                    <div className="aspect-square rounded-xl border-2 border-dashed border-emerald-300 bg-emerald-50/40 flex flex-col items-center justify-center text-emerald-700">
                      <div className="w-5 h-5 border-2 border-emerald-300 border-t-emerald-700 rounded-full animate-spin mb-2" />
                      <span className="text-[10px] tracking-wider uppercase">Removing bg…</span>
                    </div>
                  )}
                  {formData.images.length < 6 && (
                    <label className="aspect-square rounded-xl border-2 border-dashed border-stone-300 flex flex-col items-center justify-center cursor-pointer hover:border-stone-900 transition-all text-stone-400 hover:text-stone-900">
                      <Plus size={22} strokeWidth={1.5} />
                      <span className="text-[10px] tracking-wider uppercase mt-1">Add</span>
                      <input type="file" accept="image/*" multiple onChange={handleImageUpload} className="hidden" />
                    </label>
                  )}
                </div>
                <p className="text-[10px] text-stone-400 mt-2">Or paste with Ctrl+V. First photo is shown on the card — tap "Make main" on any other to promote it.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <Input label="Product Name" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} type="text" required />
                <Input label="Brand Designer" value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} type="text" required />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <Input label="Price (£)" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} type="number" step="0.01" required />
                <div>
                  <label className="block text-[10px] tracking-widest font-semibold text-stone-500 uppercase mb-2">Category</label>
                  <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value, subCategory: ''})} className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm focus:border-stone-900 outline-none transition-colors">
                    {CATEGORIES.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              {['Tops', 'Outerwear', 'Dresses', 'Accessories', 'Jewellery', 'Sportswear', 'Swimwear', 'Bags', 'Shoes'].includes(formData.category) && (
                <div>
                  <label className="block text-[10px] tracking-widest font-semibold text-stone-500 uppercase mb-2">
                    {formData.category === 'Tops' ? 'Top Type'
                      : formData.category === 'Outerwear' ? 'Outerwear Type'
                      : formData.category === 'Dresses' ? 'Dress Type'
                      : formData.category === 'Jewellery' ? 'Jewellery Type'
                      : formData.category === 'Sportswear' ? 'Sport / Activity'
                      : formData.category === 'Bags' ? 'Bag Type'
                      : formData.category === 'Shoes' ? 'Shoe Type'
                      : formData.category === 'Swimwear' ? 'Swimwear Type'
                      : 'Accessory Type'}
                  </label>
                  <select value={formData.subCategory} onChange={e => setFormData({...formData, subCategory: e.target.value})} className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm focus:border-stone-900 outline-none transition-colors">
                    <option value="">Select type...</option>
                    {(formData.category === 'Tops' ? TOP_SUBCATEGORIES
                      : formData.category === 'Outerwear' ? OUTERWEAR_SUBCATEGORIES
                      : formData.category === 'Dresses' ? DRESS_SUBCATEGORIES
                      : formData.category === 'Jewellery' ? JEWELLERY_SUBCATEGORIES
                      : formData.category === 'Sportswear' ? SPORTSWEAR_SUBCATEGORIES
                      : formData.category === 'Bags' ? BAG_SUBCATEGORIES
                      : formData.category === 'Shoes' ? SHOE_SUBCATEGORIES
                      : formData.category === 'Swimwear' ? SWIMWEAR_SUBCATEGORIES
                      : ACCESSORY_SUBCATEGORIES
                    ).map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[10px] tracking-widest font-semibold text-stone-500 uppercase mb-2">
                  Seasons <span className="text-stone-400 font-normal normal-case tracking-normal ml-1">(select any number)</span>
                </label>
                <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2">
                  {SEASONS.map((season) => {
                    const isAllSeasons = season === 'All Seasons';
                    const selected = formData.seasons || [];
                    const isActive = isAllSeasons ? selected.length === 0 : selected.includes(season);
                    return (
                      <button key={season} type="button" onClick={() => toggleSeason(season)}
                        className={`flex-none px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                          isActive ? 'bg-stone-900 border-stone-900 text-white' : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'
                        }`}
                      >
                        {season}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-[10px] tracking-widest font-semibold text-stone-500 uppercase mb-2">
                  Styles <span className="text-stone-400 font-normal normal-case tracking-normal ml-1">(select any)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {STYLES.map((s) => {
                    const isActive = (formData.styles || []).includes(s);
                    return (
                      <button key={s} type="button" onClick={() => toggleStyle(s)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                          isActive ? 'bg-stone-700 border-stone-700 text-white' : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'
                        }`}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-[10px] tracking-widest font-semibold text-stone-500 uppercase mb-3">Collection Status</label>
                <div className="flex gap-4">
                  <button type="button" onClick={() => setFormData({ ...formData, status: 'owned' })}
                    className={`flex-1 py-4 px-3 rounded-xl text-sm font-medium transition-all border text-center ${
                      formData.status === 'owned' ? 'bg-stone-900 border-stone-900 text-white' : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'
                    }`}>
                    <div>Owned</div>
                    <div className={`text-[10px] mt-1 ${formData.status === 'owned' ? 'text-stone-300' : 'text-stone-400'}`}>It's in my wardrobe</div>
                  </button>
                  <button type="button" onClick={() => setFormData({ ...formData, status: 'wishlist' })}
                    className={`flex-1 py-4 px-3 rounded-xl text-sm font-medium transition-all border text-center ${
                      formData.status === 'wishlist' ? 'bg-stone-900 border-stone-900 text-white' : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'
                    }`}>
                    <div>Wishlist</div>
                    <div className={`text-[10px] mt-1 ${formData.status === 'wishlist' ? 'text-stone-300' : 'text-stone-400'}`}>I want this</div>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] tracking-widest font-semibold text-stone-500 uppercase mb-2">
                  Size <span className="text-stone-400 font-normal normal-case tracking-normal ml-1">(unlocks fit comparison when the brand has a size chart)</span>
                </label>
                <input list="size-suggestions" value={formData.size} onChange={(e) => setFormData({ ...formData, size: e.target.value })} type="text" placeholder="e.g. 10, M, EU 39"
                  className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm focus:border-stone-900 outline-none transition-colors"
                />
                <datalist id="size-suggestions">
                  {['XS', 'S', 'M', 'L', 'XL', 'XXL',
                    '6', '8', '10', '12', '14', '16', '18', '20',
                    'EU 36', 'EU 37', 'EU 38', 'EU 39', 'EU 40', 'EU 41', 'EU 42',
                    'UK 3', 'UK 3.5', 'UK 4', 'UK 4.5', 'UK 5', 'UK 5.5', 'UK 6', 'UK 6.5', 'UK 7', 'UK 7.5', 'UK 8',
                    'One Size'].map((s) => <option key={s} value={s} />)}
                </datalist>
              </div>

              <div>
                <label className="block text-[10px] tracking-widest font-semibold text-stone-500 uppercase mb-2">
                  Care <span className="text-stone-400 font-normal normal-case tracking-normal ml-1">(optional)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {CARE_TAGS.map((c) => {
                    const isActive = (formData.care || []).includes(c);
                    return (
                      <button key={c} type="button" onClick={() => toggleCare(c)}
                        className={`px-3 py-2.5 sm:py-1.5 rounded-full text-xs font-medium transition-all border ${
                          isActive ? 'bg-stone-700 border-stone-700 text-white' : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'
                        }`}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-[10px] tracking-widest font-semibold text-stone-500 uppercase mb-2">
                  Materials <span className="text-stone-400 font-normal normal-case tracking-normal ml-1">(optional)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {MATERIALS.map((m) => {
                    const isActive = (formData.materials || []).includes(m);
                    return (
                      <button key={m} type="button" onClick={() => toggleMaterial(m)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${
                          isActive ? 'bg-stone-700 border-stone-700 text-white' : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'
                        }`}
                      >
                        {m}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-[10px] tracking-widest font-semibold text-stone-500 uppercase mb-2">
                  Colours <span className="text-stone-400 font-normal normal-case tracking-normal ml-1">{(formData.colors || []).length > 0 ? '(auto-detected — adjust if wrong)' : '(auto-detects from photos)'}</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_FAMILIES.map((c) => {
                    const isActive = (formData.colors || []).includes(c);
                    const swatch = COLOR_SWATCHES[c];
                    return (
                      <button key={c} type="button" onClick={() => toggleColor(c)}
                        className={`px-3 py-2.5 sm:py-1.5 rounded-full text-xs font-medium transition-all border flex items-center gap-2 ${
                          isActive ? 'bg-stone-900 border-stone-900 text-white' : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'
                        }`}
                      >
                        <span className="w-3 h-3 rounded-full border border-stone-300/50" style={swatch.startsWith('linear') ? { background: swatch } : { backgroundColor: swatch }} />
                        {c}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-[10px] tracking-widest font-semibold text-stone-500 uppercase mb-2">Description</label>
                <textarea value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})}
                  rows={3}
                  placeholder="Notes, fabric, fit, styling thoughts…"
                  className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm focus:border-stone-900 outline-none transition-colors resize-y"
                />
              </div>

              <Input
                label="Source URL (where you found / bought it)"
                type="url"
                value={formData.sourceUrl}
                onChange={(e) => setFormData({ ...formData, sourceUrl: e.target.value })}
                placeholder="https://"
              />

              {formData.status === 'owned' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[10px] tracking-widest font-semibold text-stone-500 uppercase mb-2">Purchased On</label>
                    <input type="date" value={formData.purchasedDate}
                      onChange={(e) => setFormData({ ...formData, purchasedDate: e.target.value })}
                      className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm focus:border-stone-900 outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] tracking-widest font-semibold text-stone-500 uppercase mb-2">Purchased From</label>
                    <input list="purchased-from-suggestions" type="text" value={formData.purchasedFrom}
                      onChange={(e) => setFormData({ ...formData, purchasedFrom: e.target.value })}
                      placeholder="Shop name"
                      className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm focus:border-stone-900 outline-none transition-colors"
                    />
                    <datalist id="purchased-from-suggestions">
                      {shops.map((s) => <option key={s.id} value={s.name} />)}
                    </datalist>
                  </div>
                </div>
              )}

              {formData.status === 'owned' && (
                <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4">
                  <p className="text-[10px] tracking-widest uppercase text-stone-500 font-semibold mb-3">Lent out <span className="font-normal normal-case tracking-normal text-stone-400 ml-1">(optional)</span></p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input type="text" value={formData.lentTo}
                      onChange={(e) => setFormData({ ...formData, lentTo: e.target.value })}
                      placeholder="Lent to (e.g. Anna)"
                      className="w-full px-3 py-2.5 bg-white border border-stone-200 rounded-lg text-sm focus:border-stone-900 outline-none transition-colors" />
                    <input type="date" value={formData.lentReturnBy}
                      onChange={(e) => setFormData({ ...formData, lentReturnBy: e.target.value })}
                      placeholder="Return by"
                      disabled={!formData.lentTo}
                      className="w-full px-3 py-2.5 bg-white border border-stone-200 rounded-lg text-sm focus:border-stone-900 outline-none transition-colors disabled:opacity-50" />
                  </div>
                </div>
              )}

              {formData.status === 'wishlist' && (
                <div>
                  <label className="block text-[10px] tracking-widest font-semibold text-stone-500 uppercase mb-2">Why? <span className="font-normal normal-case tracking-normal text-stone-400 ml-1">(optional — feeds AI gap analysis)</span></label>
                  <input type="text" value={formData.wishlistReason || ''}
                    onChange={(e) => setFormData({ ...formData, wishlistReason: e.target.value })}
                    placeholder="e.g. for a wedding · to replace my black blazer · need a winter coat"
                    className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm focus:border-stone-900 outline-none transition-colors" />
                </div>
              )}

              {error && <p className="text-xs text-red-700">{error}</p>}
            </div>
            <div className="px-4 sm:px-6 lg:px-10 py-3 sm:py-4 border-t border-stone-200/60 bg-white/95 backdrop-blur shrink-0"
                 style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}>
              <button type="submit" disabled={isLoading}
                className="w-full bg-stone-900 text-white py-3.5 rounded-xl font-medium hover:bg-stone-800 transition-all shadow-lg disabled:opacity-50 active:scale-[0.98]">
                {isLoading ? 'Saving…' : (isEdit ? 'Save Changes' : 'Save to Collection')}
              </button>
            </div>
          </form>
        )}
      </div>
      {editingPhoto && (
        <PhotoEditorModal
          src={editingPhoto.src}
          onClose={() => setEditingPhoto(null)}
          onSave={(dataUrl) => {
            setFormData((prev) => {
              const next = [...prev.images];
              next[editingPhoto.index] = dataUrl;
              return { ...prev, images: next };
            });
            setEditingPhoto(null);
            toast.show('Photo updated', { kind: 'success' });
          }}
        />
      )}
    </div>
  );
}

function ItemDetailView({ item, shops, measurements, items: allItems = [], outfits = [], onOpenOutfit, onClose, onEdit, onDelete, onMarkOwned, onMarkWishlist, onLogWear, onUnlogWear, onSetWearNote, onMarkCared, onToggleFavorite, onDuplicate, onShare, onOpenItem, onPrev, onNext, positionLabel }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [activePhoto, setActivePhoto] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const images = itemImages(item);
  // Touch swipe between items in the wardrobe list. Only horizontal gestures
  // (≥60px) on the page background trigger nav — vertical scrolls and gestures
  // inside the photo carousel / inputs are ignored.
  const swipeRef = React.useRef(null);
  useEffect(() => {
    let startX = 0; let startY = 0; let armed = false;
    const onStart = (e) => {
      const t = e.touches?.[0]; if (!t) return;
      const tag = e.target?.tagName;
      if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'IMG'].includes(tag)) { armed = false; return; }
      startX = t.clientX; startY = t.clientY; armed = true;
    };
    const onEnd = (e) => {
      if (!armed) return;
      const t = e.changedTouches?.[0]; if (!t) return;
      const dx = t.clientX - startX; const dy = t.clientY - startY;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        if (dx < 0 && onNext) { haptic('tap'); onNext(); }
        else if (dx > 0 && onPrev) { haptic('tap'); onPrev(); }
      }
    };
    const el = swipeRef.current;
    if (!el) return;
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchend', onEnd, { passive: true });
    return () => { el.removeEventListener('touchstart', onStart); el.removeEventListener('touchend', onEnd); };
  }, [onPrev, onNext]);

  // Image-level swipe: flip activePhoto when the user swipes on the main image.
  // Tap (no movement) still opens the lightbox. Movement > 40px cancels the
  // synthetic click so swipe never accidentally fullscreens the gallery.
  const photoRef = React.useRef(null);
  const photoSwipeRef = React.useRef({ startX: 0, startY: 0, swiped: false });
  useEffect(() => {
    const el = photoRef.current;
    if (!el || images.length < 2) return;
    const onStart = (e) => {
      const t = e.touches?.[0]; if (!t) return;
      photoSwipeRef.current = { startX: t.clientX, startY: t.clientY, swiped: false };
    };
    const onEnd = (e) => {
      const t = e.changedTouches?.[0]; if (!t) return;
      const { startX, startY } = photoSwipeRef.current;
      const dx = t.clientX - startX; const dy = t.clientY - startY;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        photoSwipeRef.current.swiped = true;
        if (dx < 0) setActivePhoto((i) => Math.min(images.length - 1, i + 1));
        else setActivePhoto((i) => Math.max(0, i - 1));
        haptic('tap');
      }
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchend', onEnd, { passive: true });
    return () => { el.removeEventListener('touchstart', onStart); el.removeEventListener('touchend', onEnd); };
  }, [images.length]);

  // Navigating to a different item (via Wear-with, Appears-in, prev/next) should
  // land on that item from the top, not preserve the previous item's scroll.
  // Also reset the photo carousel so we don't open the new item on photo #3.
  useEffect(() => {
    swipeRef.current?.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    setActivePhoto(0);
  }, [item.id]);

  const seasons = itemSeasons(item);
  const fit = computeFitAgainstChart({ item, shops, measurements });
  const wears = itemWearCount(item);
  const cpw = itemCostPerWear(item);
  const wornToday = itemWearHistory(item).includes(todayISO());
  const sourceHost = (() => {
    try { return new URL(item.sourceUrl).host.replace(/^www\./, ''); } catch { return null; }
  })();
  const formattedDate = item.purchasedDate
    ? new Date(item.purchasedDate).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  return (
    <div ref={swipeRef} className="fixed inset-0 bg-[#F7F5F2] z-50 overflow-y-auto overflow-x-hidden animate-in fade-in duration-300">
      <div className="sticky top-0 z-10 bg-[#F7F5F2]/80 backdrop-blur-md border-b border-stone-200/60 pt-safe">
        <div className="max-w-6xl mx-auto flex justify-between items-center p-3 sm:p-4 lg:p-6">
          <button onClick={onClose} className="flex items-center gap-2 pl-2 pr-3 sm:pl-3 sm:pr-4 py-2 rounded-full text-sm text-stone-600 hover:text-stone-900 hover:bg-stone-200/50 transition-colors">
            <ChevronRight size={18} strokeWidth={1.5} className="rotate-180" />
            <span className="hidden sm:inline">Back to Wardrobe</span>
            <span className="sm:hidden">Back</span>
          </button>
          {(onPrev || onNext) && (
            <div className="hidden sm:flex items-center gap-1.5 text-stone-400">
              <button onClick={onPrev} disabled={!onPrev} aria-label="Previous item"
                className="p-2 rounded-full hover:bg-stone-200/50 disabled:opacity-30 disabled:hover:bg-transparent transition-colors">
                <ChevronRight size={16} strokeWidth={1.5} className="rotate-180" />
              </button>
              {positionLabel && <span className="text-[10px] tracking-widest uppercase">{positionLabel}</span>}
              <button onClick={onNext} disabled={!onNext} aria-label="Next item"
                className="p-2 rounded-full hover:bg-stone-200/50 disabled:opacity-30 disabled:hover:bg-transparent transition-colors">
                <ChevronRight size={16} strokeWidth={1.5} />
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={onToggleFavorite}
              className={`p-2.5 rounded-full transition-all active:scale-90 ${
                item.favorite
                  ? 'bg-brass-300 text-stone-900 border border-brass-400'
                  : 'bg-white border border-stone-200 text-stone-400 hover:border-brass-400 hover:text-brass-500'
              }`}
              aria-label={item.favorite ? 'Remove from favourites' : 'Add to favourites'}
            >
              <Star size={16} strokeWidth={1.5} className={item.favorite ? 'fill-stone-900' : ''} />
            </button>
            <button onClick={onEdit} className="p-2.5 sm:px-5 sm:py-2.5 rounded-full text-sm bg-white border border-stone-200 text-stone-800 hover:border-stone-900 transition-all">
              <span className="hidden sm:inline">Edit</span>
              <span className="sm:hidden text-xs font-medium px-1">Edit</span>
            </button>
            {onShare && (
              <button
                onClick={onShare}
                className="p-2.5 sm:px-4 sm:py-2.5 rounded-full text-sm bg-white border border-stone-200 text-stone-700 hover:border-stone-900 transition-all inline-flex items-center gap-2"
                title={item.status === 'wishlist' ? 'Share this wishlist item for second opinions' : 'Share this piece'}
                aria-label="Share item"
              >
                <Share2 size={16} strokeWidth={1.5} />
                <span className="hidden sm:inline">Share</span>
              </button>
            )}
            <button
              onClick={onDuplicate}
              className="p-2.5 sm:px-4 sm:py-2.5 rounded-full text-sm bg-white border border-stone-200 text-stone-700 hover:border-stone-900 transition-all inline-flex items-center gap-2"
              title="Duplicate (e.g. same item in a different colour)"
              aria-label="Duplicate item"
            >
              <Copy size={16} strokeWidth={1.5} className="sm:hidden" />
              <span className="hidden sm:inline">Duplicate</span>
            </button>
            {!confirmDelete ? (
              <button onClick={() => setConfirmDelete(true)} className="p-2.5 rounded-full bg-white border border-stone-200 text-stone-400 hover:border-red-300 hover:text-red-600 transition-all" aria-label="Delete">
                <Trash2 size={16} strokeWidth={1.5} />
              </button>
            ) : (
              <>
                <button onClick={onDelete} className="px-4 sm:px-5 py-2.5 rounded-full text-xs sm:text-sm bg-red-600 text-white hover:bg-red-700 transition-all whitespace-nowrap">
                  Delete forever
                </button>
                <button onClick={() => setConfirmDelete(false)} className="px-3 sm:px-4 py-2.5 rounded-full text-xs sm:text-sm text-stone-500 hover:text-stone-900 transition-all">
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-12 py-6 sm:py-10 lg:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16">
          {/* Image column stays sticky just below the page top bar. Top
              offset matches the column's natural Y position (top-bar ~82px +
              parent lg:py-16 = ~146px) so the image is already AT its sticky
              position from initial render — no "scroll up then snap" effect. */}
          <div className="lg:col-span-6 lg:sticky lg:top-[9rem] lg:self-start space-y-3">
            <button
              ref={photoRef}
              onClick={() => {
                // A swipe just happened — don't open the lightbox.
                if (photoSwipeRef.current.swiped) { photoSwipeRef.current.swiped = false; return; }
                if (images.length > 0) setLightboxOpen(true);
              }}
              disabled={images.length === 0}
              className="aspect-[3/4] w-full max-h-[65vh] lg:max-h-[calc(100vh-13rem)] rounded-2xl lg:rounded-[2rem] overflow-hidden bg-stone-100 smooth-shadow relative group disabled:cursor-default border border-brass-300"
              style={{ touchAction: images.length > 1 ? 'pan-y' : undefined }}
              aria-label={images.length > 1 ? 'Swipe to flip photos, tap to view fullscreen' : 'View photo in fullscreen'}
            >
              {images.length > 0 ? (
                <>
                  <img src={images[Math.min(activePhoto, images.length - 1)]} alt={item.name} className="w-full h-full object-contain transition-transform duration-500 lg:group-hover:scale-[1.02]" />
                  {item.imageMeta?.[Math.min(activePhoto, images.length - 1)]?.angle && (
                    <span className="absolute top-3 left-3 lg:top-4 lg:left-4 px-3 py-1.5 bg-white/90 backdrop-blur-md text-stone-900 text-[10px] tracking-widest uppercase rounded-full font-medium">
                      {item.imageMeta[Math.min(activePhoto, images.length - 1)].angle}
                    </span>
                  )}
                  <span className="absolute bottom-3 right-3 lg:bottom-4 lg:right-4 px-3 py-1.5 bg-stone-900/70 backdrop-blur-md text-white text-[10px] tracking-widest uppercase rounded-full opacity-80 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity flex items-center gap-1.5">
                    <Plus size={12} strokeWidth={2} /> Zoom
                  </span>
                  {images.length > 1 && (
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 lg:hidden">
                      {images.map((_, i) => (
                        <span key={i} className={`block w-1.5 h-1.5 rounded-full transition-all ${
                          i === Math.min(activePhoto, images.length - 1) ? 'bg-white w-4' : 'bg-white/50'
                        }`} />
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-stone-300">
                  <Shirt size={64} strokeWidth={1} />
                </div>
              )}
            </button>
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto hide-scrollbar">
                {images.map((src, i) => (
                  <button key={i} onClick={() => setActivePhoto(i)}
                    aria-label={`Photo ${i + 1}`}
                    className={`flex-none w-16 aspect-square rounded-lg overflow-hidden border transition-all ${
                      activePhoto === i ? 'border-brass-400 shadow-sm' : 'border-stone-200 opacity-60 hover:opacity-100 hover:border-stone-400'
                    }`}
                  >
                    <img src={src} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-6 space-y-8 lg:space-y-10">
            <div>
              <p className="text-[11px] font-semibold text-stone-500 tracking-[0.25em] uppercase mb-3">{item.brand}</p>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-display text-stone-900 leading-tight">{item.name}</h1>
              <div className="flex items-center gap-4 mt-6 flex-wrap">
                <p className="text-3xl font-display font-medium">£{Number(item.price || 0).toLocaleString()}</p>
                {item.status === 'wishlist' && (
                  <span className="text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-full font-medium flex items-center gap-1.5 bg-stone-100 text-stone-900">
                    <Heart size={12} className="fill-stone-900" strokeWidth={0} /> Wishlist
                  </span>
                )}
                {item.status === 'owned' && (
                  <span className="text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-full font-medium bg-stone-900 text-white">In Collection</span>
                )}
              </div>
              <div className="mt-5">
                {item.status === 'wishlist' ? (
                  <button onClick={onMarkOwned} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm bg-stone-900 text-white hover:bg-stone-800 transition-all">
                    <CheckCircle2 size={16} strokeWidth={1.5} /> I bought this — move to wardrobe
                  </button>
                ) : (
                  <button onClick={onMarkWishlist} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm bg-white border border-stone-200 text-stone-700 hover:border-stone-900 transition-all">
                    <Heart size={16} strokeWidth={1.5} /> Move back to wishlist
                  </button>
                )}
              </div>
              {item.status === 'wishlist' && item.createdAt && (() => {
                const days = Math.floor((Date.now() - new Date(item.createdAt).getTime()) / 86_400_000);
                if (days < 30) return null;
                return (
                  <div className="mt-4 bg-orange-50 border border-orange-200 text-orange-900 rounded-2xl p-4 text-sm">
                    <p className="font-medium">On your wishlist for {days} days.</p>
                    <p className="text-orange-800 text-xs mt-1">Still want this? Buy it or remove it — wishlists work best when curated.</p>
                  </div>
                );
              })()}
            </div>

            {item.status === 'owned' && (
              <div className="bg-white border border-stone-200/60 rounded-2xl p-5 lg:p-6 smooth-shadow">
                <div className="flex items-baseline justify-between gap-3 mb-4 flex-wrap">
                  <h2 className="text-[10px] font-bold text-stone-500 tracking-[0.2em] uppercase">Wear Log</h2>
                  <button onClick={() => setShowHistory((v) => !v)} className="text-[10px] tracking-widest uppercase text-stone-500 hover:text-stone-900 transition-colors">
                    {showHistory ? 'Hide' : 'History'}
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-stone-50 rounded-xl p-3">
                    <p className="text-[10px] uppercase tracking-widest text-stone-500">Wears</p>
                    <p className="text-2xl font-display font-medium mt-1">{wears}</p>
                  </div>
                  <div className="bg-stone-50 rounded-xl p-3">
                    <p className="text-[10px] uppercase tracking-widest text-stone-500">Last worn</p>
                    <p className="text-sm font-medium mt-1.5">{formatLastWorn(item)}</p>
                  </div>
                  <div className="bg-stone-900 text-white rounded-xl p-3">
                    <p className="text-[10px] uppercase tracking-widest text-stone-400">Cost / wear</p>
                    <p className="text-2xl font-display font-medium mt-1">
                      {cpw !== null ? `£${cpw < 10 ? cpw.toFixed(2) : Math.round(cpw)}` : '—'}
                    </p>
                  </div>
                </div>
                <button onClick={() => !wornToday && onLogWear()} disabled={wornToday}
                  className={`w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all ${
                    wornToday ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 cursor-default'
                              : 'bg-stone-900 text-white hover:bg-stone-800'
                  }`}>
                  {wornToday ? <><CheckCircle2 size={16} strokeWidth={1.5} /> Logged for today</> : <><Calendar size={16} strokeWidth={1.5} /> I wore this today</>}
                </button>
                {wornToday && onSetWearNote && (
                  <WearVerdictInput
                    initial={itemWearNotes(item)[todayISO()] || ''}
                    onSave={(note) => onSetWearNote(todayISO(), note)}
                  />
                )}
                {(() => {
                  const reminder = itemCareReminder(item);
                  if (!reminder || !reminder.due || !onMarkCared) return null;
                  return (
                    <div className="mt-4 pt-4 border-t border-stone-100 flex items-start gap-3 bg-amber-50/60 -mx-3 px-3 py-3 rounded-xl border border-amber-200/60">
                      <Sparkles size={16} className="text-brass-600 shrink-0 mt-0.5" strokeWidth={1.5} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-brass-800">
                          {reminder.material} care · worn {reminder.wearsSince} {reminder.wearsSince === 1 ? 'time' : 'times'}
                        </p>
                        <p className="text-[11px] text-brass-700/80 mt-0.5 leading-relaxed">Suggested: {reminder.action}.</p>
                      </div>
                      <button onClick={onMarkCared}
                        className="text-[10px] tracking-wider uppercase px-3 py-1.5 rounded-full bg-stone-900 text-white hover:bg-stone-800 transition-colors shrink-0">
                        Done
                      </button>
                    </div>
                  );
                })()}
                {showHistory && (
                  <div className="mt-4 pt-4 border-t border-stone-100">
                    {itemWearHistory(item).length === 0 ? (
                      <p className="text-xs text-stone-400 italic">No wear history yet.</p>
                    ) : (
                      <ul className="space-y-2">
                        {[...itemWearHistory(item)].sort().reverse().map((d) => {
                          const note = itemWearNotes(item)[d];
                          return (
                            <li key={d} className="flex items-start gap-2 group">
                              <button onClick={() => onUnlogWear(d)} className="px-3 py-1.5 bg-stone-100 hover:bg-red-50 hover:text-red-700 text-xs rounded-full text-stone-700 transition-colors shrink-0" title="Click to remove this entry">
                                {new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                              </button>
                              {note && <span className="text-xs text-stone-500 italic leading-relaxed pt-1.5">"{note}"</span>}
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}

            {item.lentTo && (() => {
              const overdue = item.lentReturnBy && item.lentReturnBy < todayISO();
              return (
                <div className={`rounded-2xl p-5 border ${overdue ? 'bg-red-50 border-red-200' : 'bg-stone-50 border-stone-200'}`}>
                  <h2 className={`text-[10px] font-bold tracking-[0.2em] uppercase mb-1 ${overdue ? 'text-red-800' : 'text-stone-500'}`}>
                    {overdue ? 'Overdue · please chase' : 'Lent out'}
                  </h2>
                  <p className="text-sm text-stone-900 mt-2">
                    Currently with <span className="font-medium">{item.lentTo}</span>
                    {item.lentReturnBy && (
                      <span className={`ml-2 ${overdue ? 'text-red-700 font-medium' : 'text-stone-600'}`}>
                        · {overdue ? 'was due' : 'due back'} {new Date(item.lentReturnBy + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                  </p>
                </div>
              );
            })()}

            {item.status === 'wishlist' && item.wishlistReason && (
              <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5">
                <h2 className="text-[10px] font-bold text-stone-500 tracking-[0.2em] uppercase mb-1">Why this is on your wishlist</h2>
                <p className="text-sm text-stone-700 mt-2 italic">"{item.wishlistReason}"</p>
              </div>
            )}

            {item.status === 'owned' && (() => {
              const q = encodeURIComponent([item.brand, item.name].filter(Boolean).join(' '));
              const stale = daysSinceLastWorn(item);
              return (
                <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5">
                  <h2 className="text-[10px] font-bold text-stone-500 tracking-[0.2em] uppercase mb-2">Resell or donate</h2>
                  <p className="text-xs text-stone-500 leading-relaxed mb-3">
                    {stale === null || stale >= 180
                      ? "Haven't worn it in a while — list it for resale or pass it on."
                      : 'Move it on when you\'re ready.'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <a href={`https://www.vinted.co.uk/catalog?search_text=${q}`} target="_blank" rel="noopener noreferrer"
                      className="text-xs tracking-wider uppercase px-3 py-2 rounded-full bg-white border border-stone-200 text-stone-700 hover:border-stone-900 hover:text-stone-900">Vinted ↗</a>
                    <a href={`https://www.vestiairecollective.com/search/?q=${q}`} target="_blank" rel="noopener noreferrer"
                      className="text-xs tracking-wider uppercase px-3 py-2 rounded-full bg-white border border-stone-200 text-stone-700 hover:border-stone-900 hover:text-stone-900">Vestiaire ↗</a>
                    <a href={`https://www.ebay.co.uk/sh/lst/active?q=${q}`} target="_blank" rel="noopener noreferrer"
                      className="text-xs tracking-wider uppercase px-3 py-2 rounded-full bg-white border border-stone-200 text-stone-700 hover:border-stone-900 hover:text-stone-900">eBay ↗</a>
                    <a href={`https://www.oxfam.org.uk/shop/donate-clothes/`} target="_blank" rel="noopener noreferrer"
                      className="text-xs tracking-wider uppercase px-3 py-2 rounded-full bg-white border border-stone-200 text-stone-700 hover:border-stone-900 hover:text-stone-900">Donate (Oxfam) ↗</a>
                  </div>
                </div>
              );
            })()}

            {item.status === 'wishlist' && Array.isArray(item.priceHistory) && item.priceHistory.length > 0 && (() => {
              const history = item.priceHistory;
              const first = history[0]?.price ?? item.price;
              const latest = history[history.length - 1]?.price ?? item.price;
              const peak = Math.max(...history.map((h) => h.price), first, item.price);
              const dropFromPeak = peak > 0 ? Math.round((1 - latest / peak) * 100) : 0;
              return (
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
                  <h2 className="text-[10px] font-bold text-emerald-800 tracking-[0.2em] uppercase mb-2">Price watch</h2>
                  <div className="flex items-baseline gap-3 flex-wrap">
                    <p className="font-display text-2xl text-stone-900">£{latest}</p>
                    {dropFromPeak >= 5 && (
                      <span className="text-xs tracking-wider uppercase text-emerald-800 font-medium">
                        {dropFromPeak}% off peak (£{peak})
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-stone-500 mt-2">
                    Tracking since {new Date(history[0].date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })} · {history.length} observation{history.length === 1 ? '' : 's'}
                  </p>
                </div>
              );
            })()}

            {!fit && item.status === 'wishlist' && item.brand && (() => {
              const matchingShop = (shops || []).find((s) => s.name?.toLowerCase().trim() === item.brand?.toLowerCase().trim());
              const hasChart = !!matchingShop?.sizes?.length;
              const hasMeasurements = measurements?.chest || measurements?.waist || measurements?.hips;
              const hasSize = !!item.size?.trim();
              return (
                <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5">
                  <h2 className="text-[10px] font-bold text-stone-500 tracking-[0.2em] uppercase mb-2">Fit prediction</h2>
                  {!hasMeasurements ? (
                    <p className="text-sm text-stone-700">Add your <span className="font-medium">chest, waist and hips</span> in Profile to unlock fit predictions.</p>
                  ) : !hasSize ? (
                    <p className="text-sm text-stone-700">Add a <span className="font-medium">size</span> on this item (Edit → Size) to see fit predictions.</p>
                  ) : !hasChart ? (
                    <p className="text-sm text-stone-700">
                      Add a size chart for <span className="font-medium">{item.brand}</span> in the Directory to see bust/waist/hip deltas vs your measurements.
                    </p>
                  ) : (
                    <p className="text-sm text-stone-700">
                      No matching size row in {item.brand}'s chart for "<span className="font-medium">{item.size}</span>". Try editing the chart or the item's size label.
                    </p>
                  )}
                </div>
              );
            })()}

            {fit && (
              <div className="bg-stone-900 text-white rounded-2xl p-5 lg:p-6">
                <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
                  <h2 className="text-[10px] font-bold tracking-[0.2em] uppercase text-stone-400">Fit vs your measurements</h2>
                  <span className="text-xs text-stone-300">{fit.brand} · size {fit.size}</span>
                </div>
                <p className="text-lg font-display font-medium mb-4">{fit.summary}</p>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  {[['Bust', fit.deltas.bust], ['Waist', fit.deltas.waist], ['Hips', fit.deltas.hips]].map(([label, d]) => (
                    <div key={label} className="bg-stone-800 rounded-lg p-3">
                      <p className="text-[10px] tracking-widest uppercase text-stone-400">{label}</p>
                      <p className="mt-1 font-medium">
                        {d ? `${d.delta > 0 ? '+' : ''}${d.delta.toFixed(1)}cm` : '—'}
                      </p>
                      {d && <p className={`text-[10px] uppercase tracking-wider mt-0.5 ${d.verdict === 'good' ? 'text-emerald-300' : d.verdict === 'tight' ? 'text-orange-300' : 'text-sky-300'}`}>{d.verdict}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {item.description && (
              <div>
                <h2 className="text-[10px] font-bold text-stone-500 tracking-[0.2em] uppercase mb-3">Description</h2>
                <p className="text-stone-700 leading-relaxed whitespace-pre-wrap text-sm">{item.description}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-x-6 sm:gap-x-8 gap-y-6">
              <DetailField label="Category" value={item.category} />
              {item.subCategory && <DetailField label="Sub-type" value={item.subCategory} />}
              {item.size && <DetailField label="Size" value={item.size} />}
              {seasons.length > 0 && <DetailField label="Seasons" value={seasons.join(' · ')} />}
              {itemStyles(item).length > 0 && <DetailField label="Styles" value={itemStyles(item).join(' · ')} />}
              {formattedDate && <DetailField label="Purchased on" value={formattedDate} />}
              {item.purchasedFrom && <DetailField label="Purchased from" value={item.purchasedFrom} />}
              {Array.isArray(item.care) && item.care.length > 0 && <DetailField label="Care" value={item.care.join(' · ')} />}
              {itemMaterials(item).length > 0 && <DetailField label="Materials" value={itemMaterials(item).join(' · ')} />}
              {itemColors(item).length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-stone-500 tracking-[0.2em] uppercase mb-2">Colours</p>
                  <div className="flex gap-2 flex-wrap">
                    {itemColors(item).map((c) => {
                      const swatch = COLOR_SWATCHES[c];
                      return (
                        <span key={c} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-stone-100 rounded-full text-xs">
                          <span className="w-3 h-3 rounded-full border border-stone-300/60"
                            style={swatch?.startsWith('linear') ? { background: swatch } : { backgroundColor: swatch }} />
                          {c}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {item.sourceUrl && (
              <div className="pt-6 border-t border-stone-200">
                <h2 className="text-[10px] font-bold text-stone-500 tracking-[0.2em] uppercase mb-3">Source</h2>
                <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-stone-900 underline decoration-stone-300 underline-offset-4 hover:decoration-stone-900 transition-colors break-all"
                >
                  <LinkIcon size={14} strokeWidth={1.5} />
                  {sourceHost || item.sourceUrl}
                </a>
              </div>
            )}

            {/* Shop-around shortcuts — open the item on price-comparison
                surfaces in a new tab. No backend, no API costs; just a
                one-tap path to compare prices yourself. Especially useful
                for wishlist items (find a better deal) and owned items
                (check resale value or replacement cost). */}
            {(item.name || item.brand) && (() => {
              const query = encodeURIComponent(`${item.brand || ''} ${item.name || ''}`.trim());
              const shops = [
                { label: 'Google Shopping', url: `https://www.google.com/search?tbm=shop&q=${query}`, hint: 'Compare new prices' },
                { label: 'eBay', url: `https://www.ebay.co.uk/sch/?_nkw=${query}`, hint: 'New + pre-loved' },
                { label: 'Vinted', url: `https://www.vinted.co.uk/catalog?search_text=${query}`, hint: 'Second-hand' },
                { label: 'Vestiaire', url: `https://www.vestiairecollective.com/search/?q=${query}`, hint: 'Luxury resale' },
              ];
              return (
                <div className="pt-6 border-t border-stone-200">
                  <h2 className="text-[10px] font-bold text-stone-500 tracking-[0.2em] uppercase mb-3">Shop around</h2>
                  <div className="flex flex-wrap gap-2">
                    {shops.map((s) => (
                      <a key={s.label} href={s.url} target="_blank" rel="noopener noreferrer"
                        title={s.hint}
                        className="inline-flex items-center gap-2 text-xs px-3 py-2 rounded-full bg-white border border-stone-200 text-stone-700 hover:border-stone-900 hover:text-stone-900 transition-colors">
                        <Search size={12} strokeWidth={1.5} /> {s.label}
                      </a>
                    ))}
                  </div>
                  <p className="text-[10px] text-stone-400 italic mt-2">Searches open in a new tab — Atelier doesn't track or compare prices itself.</p>
                </div>
              );
            })()}

            <AppearsInSection item={item} outfits={outfits} allItems={allItems} onOpenOutfit={onOpenOutfit} />
            <WearWithSection item={item} allItems={allItems} outfits={outfits} onOpenItem={onOpenItem} />
          </div>
        </div>
      </div>

      {lightboxOpen && (
        <PhotoLightbox
          images={images}
          startIndex={activePhoto}
          alt={item.name}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  );
}

function WearWithSection({ item, allItems, outfits = [], onOpenItem }) {
  if (!allItems?.length) return null;

  // Slots to suggest = OUTFIT_SLOTS minus the slot this item occupies
  const myCategory = item.category;
  const mySlot = slotForItem(item);
  const targetSlots = OUTFIT_SLOTS.filter((s) => s !== mySlot);

  // Mutually-exclusive categories: a dress replaces tops+bottoms, so don't
  // suggest them with a dress — and don't suggest a dress alongside a top or
  // bottom either (you wear separates OR a dress, never both).
  const isDress = myCategory === 'Dresses';
  const isTopOrBottom = myCategory === 'Tops' || myCategory === 'Bottoms';
  const blockedSlots = isDress ? ['Tops', 'Bottoms'] : (isTopOrBottom ? ['Dresses'] : []);
  const filteredSlots = targetSlots.filter((s) => !blockedSlots.includes(s));

  const myStyles = itemStyles(item);
  const mySeasons = itemSeasons(item);
  const myColors = itemColors(item);
  const myBrand = (item.brand || '').trim().toLowerCase();
  const NEUTRAL_SET = new Set(NEUTRAL_COLORS);

  // Build a "co-pair" map: candidate.id → count of saved outfits where this
  // candidate appears together with `item`. Stronger signal than scoring —
  // the user already endorsed this pairing.
  const coPairCounts = new Map();
  for (const o of outfits) {
    const ids = Array.isArray(o.itemIds) ? o.itemIds : (Array.isArray(o.items) ? o.items.map((x) => x.id) : []);
    if (!ids.includes(item.id)) continue;
    for (const id of ids) {
      if (id === item.id) continue;
      coPairCounts.set(id, (coPairCounts.get(id) || 0) + 1);
    }
  }

  const scoreCandidate = (candidate) => {
    let score = 1;
    const reasons = [];

    // Same brand — strong signal: brands ship coordinated collections (a pink
    // Reiss blazer + pink Reiss shorts is almost certainly designed together).
    const cBrand = (candidate.brand || '').trim().toLowerCase();
    if (myBrand && cBrand && myBrand === cBrand) { score += 4; reasons.push('same brand'); }

    // Already paired by the user in a saved outfit — endorse it explicitly.
    const coCount = coPairCounts.get(candidate.id) || 0;
    if (coCount > 0) { score += 3 + Math.min(coCount - 1, 2); reasons.push(coCount === 1 ? 'worn together' : `worn together × ${coCount}`); }

    if (myStyles.length > 0) {
      const cStyles = itemStyles(candidate);
      if (cStyles.length > 0 && cStyles.some((s) => myStyles.includes(s))) { score += 4; reasons.push('same style'); }
      else if (cStyles.length > 0) score -= 3;
    }
    if (mySeasons.length > 0) {
      const cSeasons = itemSeasons(candidate);
      if (cSeasons.length === 0) score += 0.5;
      else if (cSeasons.some((s) => mySeasons.includes(s))) score += 2.5;
      else score -= 2;
    }
    if (myColors.length > 0) {
      const cColors = itemColors(candidate);
      if (cColors.length > 0) {
        const exactShared = cColors.filter((c) => myColors.includes(c) && !NEUTRAL_SET.has(c));
        const harmonises = colorsHarmonize(cColors, myColors);
        if (exactShared.length > 0) {
          // Strong: shares a non-neutral colour → coordinated palette.
          score += 4; reasons.push(`matches ${exactShared[0].toLowerCase()}`);
        } else if (harmonises) {
          score += 2;
        } else {
          score -= 3;
        }
      }
    }
    if (candidate.favorite) score += 1;
    return { score, reasons };
  };

  // Top 2 candidates per slot — keep a stretch suggestion so the user always
  // sees options, not a blank space. Threshold loosened to 1.5 (was 2).
  const suggestions = filteredSlots.flatMap((slot) => {
    const candidates = allItems.filter(
      (c) => c.id !== item.id && itemFitsSlot(c, slot)
    );
    if (candidates.length === 0) return [];
    const scored = candidates
      .map((c) => ({ c, ...scoreCandidate(c) }))
      .filter((x) => x.score >= 1.5)
      .sort((a, b) => b.score - a.score);
    return scored.slice(0, 2).map((x) => ({ item: x.c, reasons: x.reasons }));
  });

  if (suggestions.length === 0) return null;

  return (
    <div className="pt-6 border-t border-stone-200">
      <h2 className="text-[10px] font-bold text-stone-500 tracking-[0.2em] uppercase mb-4">Wear with</h2>
      <div className="flex gap-3 overflow-x-auto hide-scrollbar -mx-4 px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0 pb-3">
        {suggestions.map(({ item: s, reasons }) => (
          <button key={s.id} onClick={() => onOpenItem?.(s.id)}
            className="flex-none w-28 sm:w-32 text-left group transition-transform active:scale-[0.97]">
            <div className="aspect-[3/4] rounded-xl overflow-hidden bg-stone-100 mb-2 relative">
              {itemImages(s)[0] ? (
                <img src={itemImages(s)[0]} alt={s.name} loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-stone-300"><Shirt size={28} strokeWidth={1} /></div>
              )}
              {s.status === 'wishlist' && (
                <span className="absolute top-1.5 left-1.5 text-[8px] tracking-widest uppercase px-1.5 py-0.5 bg-white/90 backdrop-blur text-stone-900 rounded-full font-medium">Wish</span>
              )}
            </div>
            <p className="text-xs font-medium text-stone-900 truncate px-1">{s.name}</p>
            <p className="text-[10px] text-stone-500 uppercase tracking-wider truncate px-1 mt-0.5">{s.brand}</p>
            {reasons?.[0] && (
              <p className="text-[10px] text-brass-600 px-1 mt-0.5 truncate" title={reasons.join(' · ')}>
                {reasons[0]}
              </p>
            )}
          </button>
        ))}
      </div>
      <p className="text-[10px] text-stone-400 italic mt-2">Suggested by brand, palette, style, season and what you've already paired.</p>
    </div>
  );
}

// Outfits this item is part of. Useful for "what looks already use this?" —
// click jumps straight to the look. Surfaced above Wear-with so the user sees
// real-history pairings before algorithmic ones.
function AppearsInSection({ item, outfits = [], allItems = [], onOpenOutfit }) {
  const matching = (outfits || []).filter((o) => {
    const ids = Array.isArray(o.itemIds) ? o.itemIds : (Array.isArray(o.items) ? o.items.map((x) => x.id) : []);
    return ids.includes(item.id);
  });
  if (matching.length === 0) return null;

  return (
    <div className="pt-6 border-t border-stone-200">
      <h2 className="text-[10px] font-bold text-stone-500 tracking-[0.2em] uppercase mb-4">
        Appears in {matching.length} {matching.length === 1 ? 'look' : 'looks'}
      </h2>
      <div className="flex gap-3 overflow-x-auto hide-scrollbar -mx-4 px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0 pb-3">
        {matching.map((o) => {
          const pieces = resolveOutfitItems(o, allItems);
          const previews = pieces.slice(0, 4).map((p) => itemImages(p)[0]).filter(Boolean);
          return (
            <button key={o.id} onClick={() => onOpenOutfit?.(o.id)}
              className="flex-none w-32 sm:w-36 text-left group transition-transform active:scale-[0.97]">
              <div className="aspect-square rounded-xl overflow-hidden bg-stone-100 mb-2 grid grid-cols-2 grid-rows-2 gap-0.5">
                {previews.length === 0 && <div className="col-span-2 row-span-2 flex items-center justify-center text-stone-300"><Shirt size={24} strokeWidth={1} /></div>}
                {previews.map((src, i) => (
                  <div key={i} className={previews.length === 1 ? 'col-span-2 row-span-2' : previews.length === 2 ? 'col-span-1 row-span-2' : (previews.length === 3 && i === 0 ? 'col-span-2 row-span-1' : '')}>
                    <img src={src} alt="" className="w-full h-full object-cover" loading="lazy" />
                  </div>
                ))}
              </div>
              <p className="text-xs font-medium text-stone-900 truncate px-1 group-hover:text-stone-600">{o.name}</p>
              <p className="text-[10px] text-stone-500 uppercase tracking-wider px-1 mt-0.5">{pieces.length} pieces</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DetailField({ label, value }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-stone-500 tracking-[0.2em] uppercase mb-1">{label}</p>
      <p className="text-sm text-stone-900 font-medium">{value}</p>
    </div>
  );
}

// Tiny in-app photo editor. Rotate (90° steps) + crop to a draggable square.
// Output goes back through compressImageToDataUrl-ish quality control so the
// edited image stays within the Firestore-friendly size budget. No deps.
function PhotoEditorModal({ src, onClose, onSave }) {
  useEscapeKey(onClose);
  const [rotation, setRotation] = useState(0);
  // Crop rect in NATURAL image coords once the image loads, normalized [0,1].
  const [crop, setCrop] = useState({ x: 0.05, y: 0.05, w: 0.9, h: 0.9 });
  const [drag, setDrag] = useState(null); // { kind: 'move' | corner, startX, startY, startCrop }
  const [imgEl, setImgEl] = useState(null);
  const [busy, setBusy] = useState(false);
  const containerRef = React.useRef(null);

  const handlePointerDown = (e, kind) => {
    e.preventDefault();
    const startX = e.clientX, startY = e.clientY;
    setDrag({ kind, startX, startY, startCrop: { ...crop } });
  };
  useEffect(() => {
    if (!drag) return;
    const onMove = (e) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const dx = (e.clientX - drag.startX) / rect.width;
      const dy = (e.clientY - drag.startY) / rect.height;
      setCrop((c) => {
        let { x, y, w, h } = drag.startCrop;
        if (drag.kind === 'move') {
          x = Math.max(0, Math.min(1 - w, x + dx));
          y = Math.max(0, Math.min(1 - h, y + dy));
        } else if (drag.kind === 'br') {
          w = Math.max(0.1, Math.min(1 - x, w + dx));
          h = Math.max(0.1, Math.min(1 - y, h + dy));
        } else if (drag.kind === 'tl') {
          const nx = Math.max(0, Math.min(x + w - 0.1, x + dx));
          const ny = Math.max(0, Math.min(y + h - 0.1, y + dy));
          w = w + (x - nx); h = h + (y - ny);
          x = nx; y = ny;
        }
        return { x, y, w, h };
      });
    };
    const onUp = () => setDrag(null);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
  }, [drag]);

  const apply = async () => {
    if (!imgEl) return;
    setBusy(true);
    try {
      // Step 1: rotate the source to an offscreen canvas at full size.
      const radians = (rotation * Math.PI) / 180;
      const rotSwapped = rotation % 180 !== 0;
      const rw = rotSwapped ? imgEl.naturalHeight : imgEl.naturalWidth;
      const rh = rotSwapped ? imgEl.naturalWidth : imgEl.naturalHeight;
      const c1 = document.createElement('canvas');
      c1.width = rw; c1.height = rh;
      const ctx1 = c1.getContext('2d');
      ctx1.translate(rw / 2, rh / 2);
      ctx1.rotate(radians);
      ctx1.drawImage(imgEl, -imgEl.naturalWidth / 2, -imgEl.naturalHeight / 2);

      // Step 2: crop relative to the rotated canvas.
      const cx = crop.x * rw, cy = crop.y * rh, cw = crop.w * rw, ch = crop.h * rh;
      const targetMax = 900;
      const scale = Math.min(1, targetMax / Math.max(cw, ch));
      const outW = Math.round(cw * scale), outH = Math.round(ch * scale);
      const c2 = document.createElement('canvas');
      c2.width = outW; c2.height = outH;
      const ctx2 = c2.getContext('2d');
      ctx2.drawImage(c1, cx, cy, cw, ch, 0, 0, outW, outH);

      // Step 3: compress to fit Firestore-friendly budget (~150KB).
      let q = 0.85;
      let out = c2.toDataURL('image/jpeg', q);
      while (out.length > 200_000 && q > 0.4) {
        q -= 0.1;
        out = c2.toDataURL('image/jpeg', q);
      }
      await onSave(out);
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-stone-900/80 backdrop-blur-md z-[70] flex items-end sm:items-center justify-center sm:p-6" onClick={onClose}>
      <div className="bg-[#F7F5F2] w-full sm:max-w-lg sm:rounded-[2rem] rounded-t-[2rem] overflow-hidden shadow-2xl flex flex-col max-h-[92vh]" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center px-5 py-4 border-b border-stone-200/60 bg-white shrink-0 pt-safe">
          <h3 className="text-lg font-display text-stone-900">Edit photo</h3>
          <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-full transition-colors">
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div className="p-5 flex-1 overflow-y-auto">
          <div ref={containerRef} className="relative w-full bg-stone-200 rounded-2xl overflow-hidden" style={{ aspectRatio: '1' }}>
            <img src={src} alt="" onLoad={(e) => setImgEl(e.target)}
              className="absolute inset-0 w-full h-full object-contain pointer-events-none transition-transform duration-200"
              style={{ transform: `rotate(${rotation}deg)` }} />
            {/* Crop overlay */}
            <div
              className="absolute border-2 border-amber-300 cursor-move"
              style={{
                left: `${crop.x * 100}%`,
                top: `${crop.y * 100}%`,
                width: `${crop.w * 100}%`,
                height: `${crop.h * 100}%`,
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
              }}
              onPointerDown={(e) => handlePointerDown(e, 'move')}
            >
              <div className="absolute -top-2 -left-2 w-4 h-4 bg-amber-300 rounded-full cursor-nwse-resize"
                onPointerDown={(e) => { e.stopPropagation(); handlePointerDown(e, 'tl'); }} />
              <div className="absolute -bottom-2 -right-2 w-4 h-4 bg-amber-300 rounded-full cursor-nwse-resize"
                onPointerDown={(e) => { e.stopPropagation(); handlePointerDown(e, 'br'); }} />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-center gap-2">
            <button type="button" onClick={() => setRotation((r) => (r - 90 + 360) % 360)}
              className="text-xs tracking-widest uppercase px-4 py-2 rounded-full bg-white border border-stone-200 text-stone-700 hover:border-stone-900 inline-flex items-center gap-2">
              ↺ 90°
            </button>
            <button type="button" onClick={() => setRotation((r) => (r + 90) % 360)}
              className="text-xs tracking-widest uppercase px-4 py-2 rounded-full bg-white border border-stone-200 text-stone-700 hover:border-stone-900 inline-flex items-center gap-2">
              ↻ 90°
            </button>
            <button type="button" onClick={() => setCrop({ x: 0.05, y: 0.05, w: 0.9, h: 0.9 })}
              className="text-xs tracking-widest uppercase px-4 py-2 rounded-full bg-white border border-stone-200 text-stone-700 hover:border-stone-900">
              Reset crop
            </button>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-stone-200/60 bg-white shrink-0 flex gap-2 justify-end pb-safe">
          <button onClick={onClose} className="text-xs tracking-wider uppercase px-4 py-2 rounded-full text-stone-500 hover:text-stone-900">
            Cancel
          </button>
          <button onClick={apply} disabled={busy}
            className="text-xs tracking-wider uppercase px-5 py-2.5 rounded-full bg-stone-900 text-white hover:bg-stone-800 disabled:opacity-40">
            {busy ? 'Applying…' : 'Apply'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// Closet Sweep: rapid multi-photo capture → background Vision identification
// → batch review/save. The fastest way to digitise an existing wardrobe.
// Each photo runs through identifyItemWithGemini independently; the user can
// take the next photo while the previous is still being analysed.
function ClosetSweepModal({ shops = [], onClose, onBulkSave }) {
  useEscapeKey(onClose);
  const toast = useToast();
  // Drafts: [{ id, dataUrl, status: 'pending'|'done'|'error', result?, error? }]
  const [drafts, setDrafts] = useState([]);
  const [includeMap, setIncludeMap] = useState({});
  const [savingAll, setSavingAll] = useState(false);
  const knownBrands = useMemo(
    () => Array.from(new Set((shops || []).map((s) => s.name).filter(Boolean))),
    [shops]
  );

  const captureFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    // Add as pending immediately so the UI updates.
    const next = await Promise.all(files.map(async (f) => {
      const dataUrl = await compressImageToDataUrl(f, { maxWidth: 1100, maxBytes: 280_000, enhance: false });
      return { id: newId(), dataUrl, status: 'pending' };
    }));
    setDrafts((prev) => [...prev, ...next]);
    setIncludeMap((prev) => ({ ...prev, ...Object.fromEntries(next.map((n) => [n.id, true])) }));
    // Identify in parallel (Gemini Flash is happy with concurrent reqs at this volume).
    next.forEach(async (d) => {
      try {
        const result = await identifyItemWithGemini({ imageDataUrl: d.dataUrl, knownBrands });
        setDrafts((prev) => prev.map((x) => x.id === d.id ? { ...x, status: 'done', result } : x));
      } catch (e) {
        setDrafts((prev) => prev.map((x) => x.id === d.id ? { ...x, status: 'error', error: e?.message || 'failed' } : x));
      }
    });
  };

  const onPick = (e) => captureFiles(e.target.files);
  const updateField = (id, field, value) => {
    setDrafts((prev) => prev.map((d) => d.id === id ? { ...d, result: { ...d.result, [field]: value } } : d));
  };
  const includedCount = drafts.filter((d) => d.status === 'done' && includeMap[d.id]).length;
  const pendingCount = drafts.filter((d) => d.status === 'pending').length;

  const saveAll = async () => {
    setSavingAll(true);
    try {
      const newItems = drafts
        .filter((d) => d.status === 'done' && includeMap[d.id])
        .map((d) => {
          const r = d.result || {};
          const validMaterials = (r.materials || []).filter((m) => MATERIALS.includes(m));
          const validColours = (r.colors || []).map((c) => matchColorFamily(c)).filter(Boolean);
          const validStyles = (r.styles || []).filter((s) => STYLES.includes(s));
          const validSeasons = (r.seasons || []).filter((s) => ['Spring', 'Summer', 'Autumn', 'Winter'].includes(s));
          return {
            id: newId(),
            name: r.name || 'Untitled piece',
            brand: r.brand || '',
            price: 0,
            category: r.category || 'Tops',
            subCategory: r.subCategory || '',
            status: 'owned',
            seasons: validSeasons,
            styles: validStyles,
            care: [],
            colors: validColours,
            materials: validMaterials,
            images: [d.dataUrl],
            imageMeta: [{ cutout: false }],
            description: r.description || '',
            sourceUrl: '',
            createdAt: new Date().toISOString(),
          };
        });
      if (newItems.length === 0) { setSavingAll(false); return; }
      await onBulkSave(newItems);
      toast.show(`Added ${newItems.length} item${newItems.length === 1 ? '' : 's'} from sweep`, { kind: 'success' });
    } catch (e) {
      toast.show(e?.message || 'Save failed', { kind: 'error' });
      setSavingAll(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-6" onClick={onClose}>
      <div className="bg-[#F7F5F2] w-full sm:max-w-2xl sm:rounded-[2rem] rounded-t-[2rem] overflow-hidden shadow-2xl flex flex-col max-h-[92vh]" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start px-5 sm:px-6 py-4 sm:py-5 border-b border-stone-200/60 bg-white shrink-0 pt-safe">
          <div>
            <p className="text-[10px] tracking-widest uppercase text-stone-500">Closet sweep</p>
            <h3 className="text-xl sm:text-2xl font-display text-stone-900 mt-1">Snap many · save all</h3>
            <p className="text-stone-500 text-xs mt-1">Take a photo of each piece. AI identifies in the background.</p>
          </div>
          <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-full transition-colors">
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div className="p-5 sm:p-6 flex-1 min-h-0 overflow-y-auto space-y-4">
          <label className="block w-full bg-stone-900 text-white py-4 rounded-2xl text-center cursor-pointer hover:bg-stone-800 transition-colors">
            <span className="text-sm font-medium flex items-center justify-center gap-2">
              <Camera size={16} strokeWidth={1.5} /> {drafts.length === 0 ? 'Start sweep · take a photo' : 'Take another'}
            </span>
            <input type="file" accept="image/*" capture="environment" multiple onChange={onPick} className="hidden" />
          </label>

          {drafts.length > 0 && (
            <div className="flex items-center justify-between text-[10px] tracking-widest uppercase text-stone-500">
              <span>{drafts.length} captured · {includedCount} ready · {pendingCount} analysing</span>
            </div>
          )}

          {drafts.length === 0 && (
            <p className="text-stone-500 text-sm italic text-center py-8">
              Tip: stand in front of your wardrobe, take a photo per piece. Each one becomes a draft ready to save.
            </p>
          )}

          <div className="space-y-2">
            {drafts.map((d) => (
              <div key={d.id} className={`p-3 rounded-xl border transition-all flex gap-3 ${
                d.status === 'error' ? 'bg-red-50 border-red-200'
                : d.status === 'pending' ? 'bg-white border-stone-200'
                : includeMap[d.id] ? 'bg-white border-stone-200'
                : 'bg-stone-50 border-stone-100 opacity-60'
              }`}>
                <input type="checkbox" disabled={d.status !== 'done'}
                  checked={!!includeMap[d.id]} onChange={() => setIncludeMap((p) => ({ ...p, [d.id]: !p[d.id] }))}
                  className="w-4 h-4 rounded border-stone-300 text-stone-900 focus:ring-stone-900 shrink-0 self-center" />
                <div className="w-14 h-16 rounded-lg overflow-hidden bg-stone-100 shrink-0">
                  <img src={d.dataUrl} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  {d.status === 'pending' && (
                    <div className="flex items-center gap-2 text-xs text-stone-500 h-full">
                      <div className="w-3 h-3 border-2 border-stone-300 border-t-stone-900 rounded-full animate-spin" />
                      Analysing…
                    </div>
                  )}
                  {d.status === 'error' && (
                    <p className="text-xs text-red-700">Couldn't identify · {d.error}. <button type="button" onClick={() => setDrafts((p) => p.filter((x) => x.id !== d.id))} className="underline">remove</button></p>
                  )}
                  {d.status === 'done' && d.result && (
                    <>
                      <input value={d.result.name || ''} onChange={(e) => updateField(d.id, 'name', e.target.value)}
                        type="text" placeholder="Name"
                        className="w-full px-2 py-1 bg-stone-50 border border-stone-200 rounded text-sm focus:border-stone-900 outline-none mb-1" />
                      <div className="flex items-center gap-2">
                        <input value={d.result.brand || ''} onChange={(e) => updateField(d.id, 'brand', e.target.value)}
                          type="text" placeholder="Brand"
                          className="flex-1 min-w-0 px-2 py-1 bg-stone-50 border border-stone-200 rounded text-[11px] tracking-wider uppercase focus:border-stone-900 outline-none" />
                        <select value={d.result.category || 'Tops'} onChange={(e) => updateField(d.id, 'category', e.target.value)}
                          className="px-2 py-1 bg-stone-50 border border-stone-200 rounded text-xs focus:border-stone-900 outline-none">
                          {['Tops','Bottoms','Dresses','Outerwear','Sportswear','Swimwear','Shoes','Bags','Accessories','Jewellery'].map((c) => <option key={c}>{c}</option>)}
                        </select>
                      </div>
                      <p className="text-[10px] text-stone-400 mt-1">
                        {(d.result.colors || []).slice(0, 3).join(' · ')}
                        {d.result.confidence != null && <span className="ml-2">{d.result.confidence}/100</span>}
                      </p>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {drafts.length > 0 && (
          <div className="px-5 sm:px-6 py-4 border-t border-stone-200/60 bg-white shrink-0 flex gap-3 justify-end pb-safe">
            <button onClick={onClose} className="text-xs tracking-wider uppercase px-4 py-2 rounded-full text-stone-500 hover:text-stone-900">
              Cancel
            </button>
            <button onClick={saveAll} disabled={includedCount === 0 || savingAll}
              className="text-xs tracking-wider uppercase px-5 py-2.5 rounded-full bg-stone-900 text-white hover:bg-stone-800 disabled:opacity-40">
              {savingAll ? 'Saving…' : `Save ${includedCount} item${includedCount === 1 ? '' : 's'}`}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

// Bulk URL importer + brand-aware web search. Two paths in one modal:
//   1. SEARCH: type a query → buttons open each brand's own search page (or
//      Google site-restricted as fallback). User clicks through, copies the
//      product URL back into the textarea below.
//   2. PASTE: drop multiple product URLs (one per line) → parallel-fetch via
//      the existing link-import pipeline → review/edit/save in one batch.
// This is the lowest-friction route from "I own this Reiss thing" to "it's in
// my wardrobe with photo, price, brand, description filled in."
function BulkImportModal({ shops = [], onClose, onBulkSave }) {
  useEscapeKey(onClose);
  const [query, setQuery] = useState('');
  const [urlsText, setUrlsText] = useState('');
  const [stage, setStage] = useState('input'); // input | fetching | review | saving
  const [fetched, setFetched] = useState([]); // [{ url, ok, data | error }]
  const [include, setInclude] = useState({});
  const [status, setStatus] = useState('owned');
  const [size, setSize] = useState('');
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const toast = useToast();

  const sortedShops = [...shops].filter((s) => s.website).slice(0, 16);

  const parseUrls = (text) =>
    Array.from(new Set(
      (text || '')
        .split(/\s+/)
        .map((s) => s.trim())
        .filter((s) => /^https?:\/\//i.test(s))
    ));

  const fetchAll = async () => {
    const urls = parseUrls(urlsText);
    if (urls.length === 0) { setError('Paste at least one URL.'); return; }
    if (urls.length > 25) { setError('Up to 25 URLs at a time.'); return; }
    setStage('fetching'); setError(null);
    setProgress({ done: 0, total: urls.length });
    const results = [];
    for (let i = 0; i < urls.length; i++) {
      const u = urls[i];
      try {
        const data = await fetchProductFromUrl(u);
        results.push({ url: u, ok: true, data });
      } catch (e) {
        results.push({ url: u, ok: false, error: e?.message || 'Fetch failed' });
      }
      setProgress({ done: i + 1, total: urls.length });
    }
    setFetched(results);
    setInclude(Object.fromEntries(results.map((r, i) => [i, r.ok])));
    setStage('review');
  };

  const updateField = (i, field, value) => {
    setFetched((prev) => prev.map((r, idx) => idx === i ? { ...r, data: { ...r.data, [field]: value } } : r));
  };

  const includedCount = fetched.filter((_, i) => include[i]).length;

  const saveAll = async () => {
    setStage('saving');
    const newItems = fetched
      .filter((r, i) => include[i] && r.ok)
      .map((r) => ({
        id: newId(),
        name: r.data.name || '',
        brand: r.data.brand || '',
        price: Number(r.data.price) || 0,
        category: 'Tops',
        subCategory: '',
        status,
        size: size || '',
        purchasedDate: status === 'owned' ? todayISO() : '',
        purchasedFrom: r.data.brand || '',
        seasons: [], styles: [], care: [], colors: [], materials: [],
        images: r.data.imageUrl ? [r.data.imageUrl] : [],
        description: r.data.description || '',
        sourceUrl: r.data.sourceUrl || '',
        createdAt: new Date().toISOString(),
      }));
    if (newItems.length === 0) { setStage('review'); return; }
    try {
      await onBulkSave(newItems);
      toast.show(`Imported ${newItems.length} item${newItems.length === 1 ? '' : 's'} · category set to Tops by default — edit each from the wardrobe`, { kind: 'success', duration: 6000 });
    } catch (e) {
      setError(e?.message || 'Save failed');
      setStage('review');
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-6" onClick={onClose}>
      <div className="bg-[#F7F5F2] w-full sm:max-w-2xl sm:rounded-[2rem] rounded-t-[2rem] overflow-hidden shadow-2xl flex flex-col max-h-[92vh]" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start px-5 sm:px-6 py-4 sm:py-5 border-b border-stone-200/60 bg-white shrink-0 pt-safe">
          <div>
            <p className="text-[10px] tracking-widest uppercase text-stone-500">Bulk import</p>
            <h3 className="text-xl sm:text-2xl font-display text-stone-900 mt-1">Find & import many at once</h3>
          </div>
          <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-full transition-colors">
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1 min-h-0">
          {stage === 'input' && (
            <>
              <div className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5">
                <p className="text-[10px] tracking-widest uppercase text-stone-500 font-bold mb-2">1 · Find it</p>
                <p className="text-stone-600 text-sm leading-relaxed mb-3">
                  Type what you're looking for, then tap a brand below to open their search. Copy the product URL when you find it, then paste below.
                </p>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  type="search"
                  placeholder="e.g. pink shorts, navy blazer, white sandals…"
                  className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:bg-white focus:border-stone-900 outline-none"
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  {sortedShops.map((s) => (
                    <a key={s.id || s.name}
                      href={brandSearchUrl(s.website, query || ' ')}
                      target="_blank" rel="noopener noreferrer"
                      className={`text-xs tracking-wider uppercase px-3 py-1.5 rounded-full border transition-colors ${
                        query.trim() ? 'bg-white border-stone-200 text-stone-700 hover:border-stone-900 hover:text-stone-900' : 'bg-stone-50 border-stone-100 text-stone-300 cursor-not-allowed pointer-events-none'
                      }`}>
                      {s.name} ↗
                    </a>
                  ))}
                  <a href={`https://www.google.com/search?tbm=shop&q=${encodeURIComponent(query)}`}
                    target="_blank" rel="noopener noreferrer"
                    className={`text-xs tracking-wider uppercase px-3 py-1.5 rounded-full border transition-colors ${
                      query.trim() ? 'bg-stone-900 border-stone-900 text-white hover:bg-stone-800' : 'bg-stone-50 border-stone-100 text-stone-300 cursor-not-allowed pointer-events-none'
                    }`}>
                    Google Shopping ↗
                  </a>
                </div>
                {sortedShops.length === 0 && (
                  <p className="text-[11px] text-stone-400 mt-3 italic">Add some brands in Profile → Shops to surface them here.</p>
                )}
              </div>

              <div className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5">
                <p className="text-[10px] tracking-widest uppercase text-stone-500 font-bold mb-2">2 · Paste URLs</p>
                <p className="text-stone-600 text-sm leading-relaxed mb-3">
                  One per line. Up to 25 at a time. Each one gets parsed for brand, name, price, image, and description automatically.
                </p>
                <textarea
                  value={urlsText}
                  onChange={(e) => setUrlsText(e.target.value)}
                  rows={6}
                  placeholder={`https://www.reiss.com/...\nhttps://www.cos.com/...\nhttps://hollandcooper.com/...`}
                  className="w-full px-3 py-3 bg-stone-50 border border-stone-200 rounded-xl text-xs font-mono leading-relaxed focus:bg-white focus:border-stone-900 outline-none"
                />
                <div className="grid grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="block text-[10px] tracking-widest uppercase text-stone-500 font-semibold mb-1">Default status</label>
                    <select value={status} onChange={(e) => setStatus(e.target.value)}
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:bg-white focus:border-stone-900 outline-none">
                      <option value="owned">Owned</option>
                      <option value="wishlist">Wishlist</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] tracking-widest uppercase text-stone-500 font-semibold mb-1">Default size <span className="font-normal normal-case tracking-normal text-stone-400">(optional)</span></label>
                    <input value={size} onChange={(e) => setSize(e.target.value)} type="text"
                      placeholder="e.g. 10, M, 38"
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:bg-white focus:border-stone-900 outline-none" />
                  </div>
                </div>
                {error && <p className="text-xs text-red-700 mt-3">{error}</p>}
                <button onClick={fetchAll} disabled={!parseUrls(urlsText).length}
                  className="w-full mt-4 bg-stone-900 text-white py-3.5 rounded-xl font-medium hover:bg-stone-800 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                  <LinkIcon size={16} strokeWidth={1.5} /> Fetch {parseUrls(urlsText).length || ''} item{parseUrls(urlsText).length === 1 ? '' : 's'}
                </button>
              </div>
            </>
          )}

          {stage === 'fetching' && (
            <div className="flex flex-col items-center gap-4 py-16 text-stone-500 text-sm">
              <div className="w-8 h-8 border-2 border-stone-300 border-t-stone-900 rounded-full animate-spin" />
              <p>Fetching {progress.done} / {progress.total}…</p>
              <div className="w-64 h-1 bg-stone-200 rounded-full overflow-hidden">
                <div className="h-full bg-stone-900 transition-all" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
              </div>
            </div>
          )}

          {stage === 'review' && (
            <div>
              <div className="flex items-baseline justify-between mb-3">
                <h4 className="text-[10px] font-bold text-stone-500 tracking-[0.2em] uppercase">Review · {includedCount} of {fetched.length} selected</h4>
                <button type="button" onClick={() => { setStage('input'); setFetched([]); }}
                  className="text-[10px] tracking-wider uppercase text-stone-500 hover:text-stone-900">← Back</button>
              </div>
              <div className="space-y-2">
                {fetched.map((r, i) => (
                  <div key={i} className={`p-3 rounded-xl border transition-all ${
                    !r.ok ? 'bg-red-50 border-red-200'
                    : include[i] ? 'bg-white border-stone-200'
                    : 'bg-stone-50 border-stone-100 opacity-50'
                  }`}>
                    <div className="flex items-center gap-3">
                      <input type="checkbox" disabled={!r.ok}
                        checked={!!include[i]} onChange={() => setInclude((p) => ({ ...p, [i]: !p[i] }))}
                        className="w-4 h-4 rounded border-stone-300 text-stone-900 focus:ring-stone-900 shrink-0" />
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-stone-100 shrink-0 flex items-center justify-center">
                        {r.ok && r.data.imageUrl
                          ? <img src={r.data.imageUrl} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                          : <Shirt size={16} strokeWidth={1} className="text-stone-300" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        {r.ok ? (
                          <>
                            <input value={r.data.name || ''} onChange={(e) => updateField(i, 'name', e.target.value)} type="text"
                              placeholder="Product name"
                              className="w-full px-2 py-1 bg-stone-50 border border-stone-200 rounded text-sm focus:border-stone-900 outline-none mb-1" />
                            <div className="flex items-center gap-2">
                              <input value={r.data.brand || ''} onChange={(e) => updateField(i, 'brand', e.target.value)} type="text"
                                placeholder="Brand"
                                className="flex-1 min-w-0 px-2 py-1 bg-stone-50 border border-stone-200 rounded text-[11px] tracking-wider uppercase focus:border-stone-900 outline-none" />
                              <span className="text-stone-400 text-xs">£</span>
                              <input value={r.data.price || ''} onChange={(e) => updateField(i, 'price', e.target.value)} type="text"
                                className="w-16 px-2 py-1 bg-stone-50 border border-stone-200 rounded text-xs focus:border-stone-900 outline-none" />
                            </div>
                          </>
                        ) : (
                          <>
                            <p className="text-sm text-red-800 truncate">{r.url}</p>
                            <p className="text-[10px] text-red-700 mt-0.5">{r.error}</p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {error && <p className="text-xs text-red-700 mt-3">{error}</p>}
            </div>
          )}

          {stage === 'saving' && (
            <div className="flex items-center justify-center gap-3 py-16 text-stone-500 text-sm">
              <div className="w-5 h-5 border-2 border-stone-300 border-t-stone-900 rounded-full animate-spin" />
              Saving {includedCount} item{includedCount === 1 ? '' : 's'}…
            </div>
          )}
        </div>

        {stage === 'review' && (
          <div className="px-5 sm:px-6 py-4 border-t border-stone-200/60 bg-white shrink-0 flex gap-3 justify-end pb-safe">
            <button onClick={onClose} className="text-xs tracking-wider uppercase px-4 py-2 rounded-full text-stone-500 hover:text-stone-900">
              Cancel
            </button>
            <button onClick={saveAll} disabled={includedCount === 0}
              className="text-xs tracking-wider uppercase px-5 py-2.5 rounded-full bg-stone-900 text-white hover:bg-stone-800 disabled:opacity-40">
              Save {includedCount} item{includedCount === 1 ? '' : 's'}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

function ReceiptImportModal({ onClose, onBulkSave }) {
  useEscapeKey(onClose);
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState(null);
  const [include, setInclude] = useState({}); // index → bool
  const [brand, setBrand] = useState('');
  const [purchasedDate, setPurchasedDate] = useState('');
  const [purchasedFrom, setPurchasedFrom] = useState('');
  const [status, setStatus] = useState('owned');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const acceptParsed = (result) => {
    setParsed(result);
    setBrand(result.brand || '');
    setPurchasedDate(result.purchasedDate || todayISO());
    setPurchasedFrom(result.purchasedFrom || result.brand || '');
    setInclude(Object.fromEntries(result.items.map((_, i) => [i, true])));
  };

  const handleParse = () => {
    setError(null);
    const result = parseReceiptText(text);
    if (result.items.length === 0) {
      setError('No items detected. Try pasting more of the email, or use Manual Entry.');
      setParsed(null);
      return;
    }
    acceptParsed(result);
  };

  const handleImageFile = async (file) => {
    if (!file) return;
    if (!isAIEnabled()) {
      setError('Image receipts need Gemini configured — add VITE_RECAPTCHA_SITE_KEY + Firebase AI Logic to .env.local.');
      return;
    }
    setBusy(true); setError(null);
    try {
      const dataUrl = await compressImageToDataUrl(file, { maxWidth: 1400, maxBytes: 600_000, enhance: false });
      const result = await analyzeReceiptImageWithGemini({ imageDataUrl: dataUrl });
      acceptParsed(result);
    } catch (e) {
      setError(e?.message || 'Could not read this image.');
    } finally {
      setBusy(false);
    }
  };
  const handleImageInput = (e) => {
    const f = e.target.files?.[0];
    if (f) handleImageFile(f);
  };

  useEffect(() => {
    const onPaste = (e) => {
      if (parsed) return;
      const item = Array.from(e.clipboardData?.items || []).find((it) => it.type?.startsWith('image/'));
      if (!item) return;
      const f = item.getAsFile();
      if (f) { e.preventDefault(); handleImageFile(f); }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [parsed]);

  const toggleItem = (i) => setInclude((p) => ({ ...p, [i]: !p[i] }));
  const updateItem = (i, field, value) => setParsed((p) => ({
    ...p,
    items: p.items.map((it, idx) => (idx === i ? { ...it, [field]: value } : it)),
  }));

  const includedCount = parsed ? parsed.items.filter((_, i) => include[i]).length : 0;

  const [enrichBusyIdx, setEnrichBusyIdx] = useState(null);
  const enrichOne = async (i) => {
    const it = parsed?.items?.[i];
    if (!it?.sourceUrl) return;
    setEnrichBusyIdx(i); setError(null);
    try {
      const data = await fetchProductFromUrl(it.sourceUrl);
      setParsed((p) => ({
        ...p,
        items: p.items.map((row, idx) => idx === i ? {
          ...row,
          name: row.name || data.name || '',
          imageUrl: data.imageUrl || row.imageUrl || '',
          description: row.description || data.description || '',
          price: row.price || (data.price ? parseFloat(data.price) : row.price) || 0,
        } : row),
      }));
    } catch (e) {
      setError(`Couldn't fetch image for "${it.name}": ${e?.message || 'failed'}`);
    } finally {
      setEnrichBusyIdx(null);
    }
  };
  const enrichAll = async () => {
    if (!parsed) return;
    for (let i = 0; i < parsed.items.length; i++) {
      if (!include[i]) continue;
      const it = parsed.items[i];
      if (it.imageUrl || !it.sourceUrl) continue;
      await enrichOne(i);
    }
  };
  const searchUrlFor = (it) => {
    const q = encodeURIComponent([brand || it.brand || '', it.name].filter(Boolean).join(' '));
    return `https://www.google.com/search?tbm=shop&q=${q}`;
  };

  const handleSaveAll = async () => {
    if (!parsed || includedCount === 0) return;
    setBusy(true);
    try {
      const newItems = parsed.items
        .filter((_, i) => include[i])
        .map((it) => ({
          id: newId(),
          name: it.name,
          brand: brand || it.brand || '',
          price: Number(it.price) || 0,
          category: 'Tops', // default — user can edit later from detail view
          subCategory: '',
          status,
          purchasedDate: status === 'owned' ? purchasedDate : '',
          purchasedFrom: status === 'owned' ? purchasedFrom : '',
          seasons: [],
          styles: [],
          images: it.imageUrl ? [it.imageUrl] : [],
          colors: [],
          care: [],
          size: '',
          description: it.description || '',
          sourceUrl: it.sourceUrl || '',
          createdAt: new Date().toISOString(),
        }));
      await onBulkSave(newItems);
    } catch (err) {
      setError(err?.message || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-6">
      <div className="bg-[#F7F5F2] w-full sm:max-w-2xl sm:rounded-[2rem] rounded-t-[2rem] overflow-hidden shadow-2xl flex flex-col max-h-[92vh]">
        <div className="flex justify-between items-center px-4 sm:px-6 py-4 sm:py-5 border-b border-stone-200/60 bg-white shrink-0">
          <h3 className="text-xl sm:text-2xl font-display font-medium text-stone-900">Paste a receipt</h3>
          <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-full transition-colors">
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-5 overflow-y-auto">
          {!parsed && (
            <>
              <p className="text-stone-500 text-sm leading-relaxed">
                Two ways: paste the order email text below, or drop in a screenshot of the order confirmation page. Atelier extracts brand, items, prices, and purchase date — you'll review each one before saving.
              </p>

              <label className="block w-full p-5 bg-white border border-stone-200 rounded-2xl cursor-pointer hover:border-stone-900 transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-stone-100 flex items-center justify-center shrink-0">
                    {busy ? <div className="w-5 h-5 border-2 border-stone-300 border-t-stone-900 rounded-full animate-spin" /> : <Camera size={20} strokeWidth={1.5} className="text-stone-700" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-stone-900">{busy ? 'Reading receipt…' : 'Upload or paste a screenshot'}</p>
                    <p className="text-[10px] text-stone-400 mt-1 tracking-wider uppercase">Order confirmation pages, app screenshots, photos of paper receipts</p>
                  </div>
                </div>
                <input type="file" accept="image/*" onChange={handleImageInput} className="hidden" disabled={busy} />
              </label>

              <div className="flex items-center gap-3 text-[10px] tracking-widest uppercase text-stone-400">
                <span className="flex-1 h-px bg-stone-200" /> Or paste text <span className="flex-1 h-px bg-stone-200" />
              </div>

              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste the entire receipt or order confirmation email here…"
                rows={8}
                className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm focus:border-stone-900 outline-none transition-colors font-mono leading-relaxed"
                disabled={busy}
              />
              {error && <p className="text-xs text-red-700">{error}</p>}
              <button onClick={handleParse} disabled={!text.trim() || busy}
                className="w-full bg-stone-900 text-white py-4 rounded-xl font-medium hover:bg-stone-800 transition-colors shadow-lg disabled:opacity-50">
                Parse text receipt
              </button>
            </>
          )}

          {parsed && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] tracking-widest font-semibold text-stone-500 uppercase mb-2">Brand</label>
                  <input value={brand} onChange={(e) => setBrand(e.target.value)} type="text"
                    className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm focus:border-stone-900 outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] tracking-widest font-semibold text-stone-500 uppercase mb-2">Purchased on</label>
                  <input value={purchasedDate} onChange={(e) => setPurchasedDate(e.target.value)} type="date"
                    className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm focus:border-stone-900 outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] tracking-widest font-semibold text-stone-500 uppercase mb-2">Purchased from</label>
                  <input value={purchasedFrom} onChange={(e) => setPurchasedFrom(e.target.value)} type="text"
                    className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm focus:border-stone-900 outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] tracking-widest font-semibold text-stone-500 uppercase mb-2">Status</label>
                  <div className="flex gap-2">
                    {['owned', 'wishlist'].map((s) => (
                      <button key={s} onClick={() => setStatus(s)}
                        className={`flex-1 py-3 rounded-xl text-sm capitalize transition-all border ${
                          status === s ? 'bg-stone-900 border-stone-900 text-white' : 'bg-white border-stone-200 text-stone-600'
                        }`}>{s}</button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
                  <h4 className="text-[10px] font-bold text-stone-500 tracking-[0.2em] uppercase">Detected items</h4>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-stone-500">{includedCount} of {parsed.items.length} selected</span>
                    <button
                      type="button"
                      onClick={enrichAll}
                      disabled={enrichBusyIdx !== null || parsed.items.every((it, i) => !include[i] || !it.sourceUrl || it.imageUrl)}
                      className="text-[10px] tracking-widest uppercase px-3 py-1.5 rounded-full bg-stone-900 text-white hover:bg-stone-800 disabled:opacity-40 disabled:cursor-not-allowed">
                      {enrichBusyIdx !== null ? `Fetching ${enrichBusyIdx + 1}/${parsed.items.length}…` : 'Fetch all images'}
                    </button>
                  </div>
                </div>
                <div className="space-y-2 max-h-[28rem] overflow-y-auto pr-1">
                  {parsed.items.map((it, i) => (
                    <div key={i} className={`p-3 rounded-xl border transition-all ${
                      include[i] ? 'bg-white border-stone-200' : 'bg-stone-50 border-stone-100 opacity-50'
                    }`}>
                      <div className="flex items-center gap-3">
                        <input type="checkbox" checked={!!include[i]} onChange={() => toggleItem(i)}
                          className="w-4 h-4 rounded border-stone-300 text-stone-900 focus:ring-stone-900 shrink-0" />
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-stone-100 shrink-0 flex items-center justify-center">
                          {it.imageUrl
                            ? <img src={it.imageUrl} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                            : <Shirt size={16} strokeWidth={1} className="text-stone-300" />}
                        </div>
                        <input value={it.name} onChange={(e) => updateItem(i, 'name', e.target.value)} type="text"
                          className="flex-1 min-w-0 px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:border-stone-900 outline-none" />
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-stone-400 text-sm">£</span>
                          <input value={it.price} onChange={(e) => updateItem(i, 'price', parseFloat(e.target.value) || 0)} type="number" step="0.01"
                            className="w-20 px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:border-stone-900 outline-none" />
                        </div>
                      </div>
                      {include[i] && (
                        <div className="flex items-center gap-2 mt-2 pl-7">
                          <input
                            value={it.sourceUrl || ''}
                            onChange={(e) => updateItem(i, 'sourceUrl', e.target.value.trim())}
                            type="url"
                            placeholder="Paste product URL for auto-image…"
                            className="flex-1 min-w-0 px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs focus:border-stone-900 outline-none placeholder:text-stone-400"
                          />
                          {it.sourceUrl ? (
                            <button
                              type="button"
                              onClick={() => enrichOne(i)}
                              disabled={enrichBusyIdx !== null}
                              className="text-[10px] tracking-wider uppercase px-3 py-1.5 rounded-full bg-stone-900 text-white hover:bg-stone-800 disabled:opacity-40 shrink-0">
                              {enrichBusyIdx === i ? '…' : 'Fetch'}
                            </button>
                          ) : (
                            <a
                              href={searchUrlFor(it)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] tracking-wider uppercase px-3 py-1.5 rounded-full bg-white border border-stone-200 text-stone-600 hover:border-stone-900 hover:text-stone-900 transition-colors shrink-0">
                              Find on web ↗
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {error && <p className="text-xs text-red-700">{error}</p>}

              <div className="flex gap-2">
                <button onClick={() => { setParsed(null); setError(null); }}
                  className="px-5 py-3 rounded-xl text-sm bg-white border border-stone-200 text-stone-700 hover:border-stone-900 transition-colors">
                  Back
                </button>
                <button onClick={handleSaveAll} disabled={busy || includedCount === 0}
                  className="flex-1 bg-stone-900 text-white py-3 rounded-xl font-medium hover:bg-stone-800 transition-colors shadow-lg disabled:opacity-50">
                  {busy ? 'Saving…' : `Save ${includedCount} item${includedCount === 1 ? '' : 's'}`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Input({ label, ...props }) {
  return (
    <div>
      <label className="block text-[10px] tracking-widest font-semibold text-stone-500 uppercase mb-2">{label}</label>
      <input className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm focus:border-stone-900 outline-none transition-colors" {...props} />
    </div>
  );
}

// Strict 1:1 — items can ONLY fill a slot matching their actual category +
// subcategory where relevant. Jewellery is split into three slots so an outfit
// can carry earrings + a necklace + a bracelet at the same time without one
// piece evicting another. Outerwear is its own slot (was previously mixed into
// Tops, which produced incoherent looks like "Sport jacket + Smart trousers").
const OUTFIT_SLOTS = ['Tops', 'Dresses', 'Bottoms', 'Outerwear', 'Shoes', 'Bags', 'Accessories', 'Earrings', 'Necklaces', 'Wrist'];
const SLOT_FILTER = {
  Tops:        (i) => i.category === 'Tops',
  Dresses:     (i) => i.category === 'Dresses',
  Bottoms:     (i) => i.category === 'Bottoms',
  Outerwear:   (i) => i.category === 'Outerwear',
  Shoes:       (i) => i.category === 'Shoes',
  Bags:        (i) => i.category === 'Bags',
  Accessories: (i) => i.category === 'Accessories' || (i.category === 'Jewellery' && i.subCategory === 'Brooches'),
  Earrings:    (i) => i.category === 'Jewellery' && i.subCategory === 'Earrings',
  Necklaces:   (i) => i.category === 'Jewellery' && (i.subCategory === 'Necklaces' || i.subCategory === 'Pendants'),
  Wrist:       (i) => i.category === 'Jewellery' && (i.subCategory === 'Bracelets' || i.subCategory === 'Watches' || i.subCategory === 'Rings'
                       || !i.subCategory || i.subCategory === 'Other'),
};
const itemFitsSlot = (item, slot) => !!item && !!SLOT_FILTER[slot]?.(item);
const slotForItem = (item) => OUTFIT_SLOTS.find((s) => itemFitsSlot(item, s)) || null;
// Slots that hold an array of items (layered looks) instead of a single piece.
// Earrings, necklaces, bracelets/watches/rings are stackable in real styling —
// "wear three pendants together", "stack a watch and two bracelets".
const MULTI_SLOTS = new Set(['Earrings', 'Necklaces', 'Wrist']);
const isMultiSlot = (slot) => MULTI_SLOTS.has(slot);
// Read all items from a slot value, regardless of single/array shape.
const slotItems = (val) => Array.isArray(val) ? val : (val ? [val] : []);
// Backwards-compat shim for any old callers — returns the strict list of
// categories a slot can hold (jewellery slots all answer "Jewellery").
const SLOT_CATEGORIES = {
  Tops: ['Tops'], Dresses: ['Dresses'], Bottoms: ['Bottoms'], Outerwear: ['Outerwear'],
  Shoes: ['Shoes'], Bags: ['Bags'], Accessories: ['Accessories'],
  Earrings: ['Jewellery'], Necklaces: ['Jewellery'], Wrist: ['Jewellery'],
};
const emptyOutfit = () => Object.fromEntries(OUTFIT_SLOTS.map((s) => [s.toLowerCase(), null]));

function OutfitBuilder({ items, outfits, saveOutfit, deleteOutfit, onOpenOutfit, aiHistory = [], saveAIHistory, deleteAIHistory, toggleAIHistoryFavorite, schedules = {}, scheduleOutfit, aiTemperature = 0.7, styleProfile = '', onCreateLookbook }) {
  const [tab, setTab] = useState('create');
  const [currentOutfit, setCurrentOutfit] = useState(emptyOutfit);
  const [outfitName, setOutfitName] = useState('');
  const [capsuleOpen, setCapsuleOpen] = useState(false);
  const [activeDragItem, setActiveDragItem] = useState(null);
  const [styleIntent, setStyleIntent] = useState('Any');
  const [customIntent, setCustomIntent] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedOutfits, setSelectedOutfits] = useState(() => new Set());
  const [lookbookNamerOpen, setLookbookNamerOpen] = useState(false);
  const [lookbookBusy, setLookbookBusy] = useState(false);
  const [outfitsFilter, setOutfitsFilter] = useState('all');
  const filteredOutfits = outfitsFilter === 'favorites' ? outfits.filter((o) => o.favorite) : outfits;
  const toast = useToast();

  // Desktop: PointerSensor for click-and-drag. We omit TouchSensor by design —
  // on mobile, drag-from-stacked-layout is genuinely awkward (slots scroll above
  // the source). Tap-to-assign is the mobile path, with haptic + toast feedback.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const handleDragStart = (event) => {
    const data = event.active.data.current;
    if (data?.item) setActiveDragItem(data.item);
  };

  const handleDragEnd = (event) => {
    setActiveDragItem(null);
    const { active, over } = event;
    if (!over || !active.data.current?.item) return;
    const slot = String(over.id).startsWith('slot-') ? String(over.id).replace('slot-', '') : null;
    if (slot) handleSelect(slot, active.data.current.item);
  };

  const handleSelect = (slot, item) => {
    const key = slot.toLowerCase();
    if (isMultiSlot(slot)) {
      // Tap toggles membership; pieces stack. Tap again to remove.
      setCurrentOutfit((prev) => {
        const existing = slotItems(prev[key]);
        const has = existing.some((x) => x.id === item.id);
        const next = has ? existing.filter((x) => x.id !== item.id) : [...existing, item];
        return { ...prev, [key]: next };
      });
      haptic('tap');
      toast.show(`${slot}: ${item.name}`, { kind: 'default', duration: 1400 });
    } else {
      setCurrentOutfit((prev) => ({ ...prev, [key]: item }));
      if (item) { haptic('tap'); toast.show(`Added to ${slot}`, { kind: 'default', duration: 1400 }); }
    }
  };

  const handleSave = () => {
    const picked = OUTFIT_SLOTS.flatMap((s) => slotItems(currentOutfit[s.toLowerCase()]));
    if (!outfitName.trim() || picked.length === 0) return;
    saveOutfit({
      id: newId(),
      name: outfitName,
      itemIds: picked.map((p) => p.id),
      createdAt: new Date().toISOString(),
      ...(aiNote ? { reasoning: aiNote } : {}),
      ...(customIntent.trim() || styleIntent !== 'Any' ? { intent: customIntent.trim() || styleIntent } : {}),
    });
    setOutfitName(''); setCurrentOutfit(emptyOutfit());
    setAiNote(null);
    setTab('saved');
  };

  // Gold-standard generator: strict 1:1 category/slot, hard filters BEFORE
  // scoring (items that actively conflict are removed, not just penalised),
  // then anchor on first pick to lock style + season + colour palette.
  const generateOneLook = (styleFilter = null, used = new Set()) => {
    const next = emptyOutfit();
    const pickedItems = [];
    const month = new Date().getMonth();
    const currentSeason = month >= 2 && month <= 4 ? 'Spring'
      : month >= 5 && month <= 7 ? 'Summer'
      : month >= 8 && month <= 10 ? 'Autumn' : 'Winter';

    let anchorStyle = styleFilter || null;
    let anchorSeasons = null;
    let anchorColors = null;

    // Dress or separates? A dress replaces a Top+Bottoms pair — never both.
    // 35% chance of dress look when dresses exist (so dresses surface but
    // separates remain the dominant pattern). If user has no dresses, always separates.
    const hasDresses = items.some((i) => i.category === 'Dresses');
    const goDressLook = hasDresses && Math.random() < 0.35;

    // Slots picked in defining order so anchor is set early
    const slotOrder = goDressLook
      ? ['Dresses', 'Outerwear', 'Shoes', 'Bags', 'Accessories', 'Jewellery']
      : ['Tops', 'Outerwear', 'Bottoms', 'Shoes', 'Bags', 'Accessories', 'Jewellery'];

    for (const slot of slotOrder) {
      // Strict category + sub-category match (e.g. Earrings slot only gets earrings)
      const all = items.filter((i) => itemFitsSlot(i, slot));
      if (!all.length) continue;

      // HARD FILTERS first — remove items that actively conflict with anchor
      let eligible = all;

      if (anchorStyle) {
        const styleMatched = eligible.filter((i) => {
          const s = itemStyles(i);
          return s.length === 0 || s.includes(anchorStyle); // untagged OK, matching OK; explicit mismatch out
        });
        if (styleMatched.length > 0) eligible = styleMatched;
      }

      if (anchorSeasons) {
        const seasonMatched = eligible.filter((i) => {
          const s = itemSeasons(i);
          return s.length === 0 || s.some((x) => anchorSeasons.includes(x));
        });
        if (seasonMatched.length > 0) eligible = seasonMatched;
      } else {
        // No anchor yet — bias toward current season
        const seasonMatched = eligible.filter((i) => {
          const s = itemSeasons(i);
          return s.length === 0 || s.includes(currentSeason);
        });
        if (seasonMatched.length > 0) eligible = seasonMatched;
      }

      if (anchorColors && anchorColors.length > 0) {
        const colorMatched = eligible.filter((i) => {
          const c = itemColors(i);
          return c.length === 0 || colorsHarmonize(c, anchorColors);
        });
        if (colorMatched.length > 0) eligible = colorMatched;
      }

      // Outerwear: skip if no eligible items for the current weather/season anchor
      // (you don't want a parka in a summer look just because there's no other Outerwear)
      if (slot === 'Outerwear' && eligible.length === 0) continue;

      // Now score the survivors
      const scored = eligible.map((item) => {
        let score = 1;
        if (anchorStyle && itemStyles(item).includes(anchorStyle)) score += 4;
        if (anchorColors && itemColors(item).length > 0 && colorsHarmonize(itemColors(item), anchorColors)) score += 3;
        if (item.favorite) score += 2.5;
        const days = daysSinceLastWorn(item);
        if (days === null || days > 30) score += 0.5;
        if (used.has(item.id)) score -= 8;
        score += Math.random() * 0.4;
        return { item, score };
      });

      scored.sort((a, b) => b.score - a.score);
      // Pick from top 3 — coherent but with some variety on retap
      const top = scored.slice(0, Math.min(3, scored.length));
      const pick = top[Math.floor(Math.random() * top.length)].item;
      if (!pick) continue;

      next[slot.toLowerCase()] = pick;
      pickedItems.push(pick);
      used.add(pick.id);

      // Lock the anchor from the FIRST tagged item
      if (!anchorStyle) {
        const s = itemStyles(pick);
        if (s.length > 0) anchorStyle = s[0];
      }
      if (!anchorSeasons) {
        const ss = itemSeasons(pick);
        if (ss.length > 0) anchorSeasons = ss;
      }
      if (!anchorColors) {
        const c = itemColors(pick);
        if (c.length > 0) anchorColors = c;
      }
    }
    return next;
  };

  const generateSuggestion = (styleFilter = null) => {
    setCurrentOutfit(generateOneLook(styleFilter));
  };

  const [aiBusy, setAiBusy] = useState(false);
  const [aiStage, setAiStage] = useState('');
  const [aiNote, setAiNote] = useState(null);
  const [aiConfidence, setAiConfidence] = useState(null);
  const [abComparing, setAbComparing] = useState(false);
  const [abPair, setAbPair] = useState(null); // { a: { outfit, reasoning, confidence }, b: {...} }

  const AI_STAGES = [
    'Reading your wardrobe…',
    'Considering today\'s weather and season…',
    'Finding pieces that harmonise…',
    'Composing colour and shape…',
    'Adding finishing touches…',
    'Almost there…',
  ];

  const buildIntent = () => {
    const custom = customIntent.trim();
    if (custom) return custom;
    if (styleIntent === 'Any') return 'a coherent everyday look';
    return `a ${styleIntent.toLowerCase()} outfit`;
  };

  const handleQuickStyle = () => {
    const style = styleIntent === 'Any' ? null : styleIntent;
    setCurrentOutfit(generateOneLook(style));
    setAiNote(null);
  };

  // Generate two AI looks in parallel for side-by-side comparison.
  const handleABCompare = async () => {
    if (!isAIEnabled()) { toast.show('AI not configured', { kind: 'error' }); return; }
    setAbComparing(true); setAiStage(AI_STAGES[0]);
    let stageIndex = 0;
    const stageTimer = setInterval(() => { stageIndex = Math.min(stageIndex + 1, AI_STAGES.length - 1); setAiStage(AI_STAGES[stageIndex]); }, 1200);
    try {
      const month = new Date().getMonth();
      const season = month >= 2 && month <= 4 ? 'Spring' : month >= 5 && month <= 7 ? 'Summer' : month >= 8 && month <= 10 ? 'Autumn' : 'Winter';
      const cached = (() => { try { return JSON.parse(localStorage.getItem('atelier-weather') || 'null')?.data; } catch { return null; } })();
      const intent = buildIntent();
      // Run two parallel — second slightly higher temperature for variety
      const [resultA, resultB] = await Promise.all([
        generateOutfitWithGemini({ items, intent, weather: cached, season, temperature: aiTemperature, styleProfile }),
        generateOutfitWithGemini({ items, intent, weather: cached, season, temperature: Math.min(1, aiTemperature + 0.3), styleProfile }),
      ]);
      const buildOutfit = (result) => {
        const next = emptyOutfit();
        for (const id of result.itemIds || []) {
          const item = items.find((i) => i.id === id);
          if (!item) continue;
          const slot = slotForItem(item);
          if (!slot) continue;
          const key = slot.toLowerCase();
          if (isMultiSlot(slot)) {
            next[key] = Array.isArray(next[key]) ? [...next[key], item] : [item];
          } else if (!next[key]) {
            next[key] = item;
          }
        }
        return next;
      };
      setAbPair({
        intent,
        a: { outfit: buildOutfit(resultA), reasoning: resultA.reasoning, confidence: resultA.confidence },
        b: { outfit: buildOutfit(resultB), reasoning: resultB.reasoning, confidence: resultB.confidence },
      });
    } catch (err) {
      toast.show(err?.message || 'AB compare failed', { kind: 'error', duration: 4000 });
    } finally {
      clearInterval(stageTimer);
      setAbComparing(false);
      setAiStage('');
    }
  };

  const handleAIStyle = async (intentOverride = null, { refine = false } = {}) => {
    setAiBusy(true); setAiNote(null);
    setAiStage(AI_STAGES[0]);
    // Cycle stage labels every 1.2s so the user sees forward motion
    let stageIndex = 0;
    const stageTimer = setInterval(() => {
      stageIndex = Math.min(stageIndex + 1, AI_STAGES.length - 1);
      setAiStage(AI_STAGES[stageIndex]);
    }, 1200);
    try {
      const month = new Date().getMonth();
      const season = month >= 2 && month <= 4 ? 'Spring'
        : month >= 5 && month <= 7 ? 'Summer'
        : month >= 8 && month <= 10 ? 'Autumn' : 'Winter';
      const cached = (() => { try { return JSON.parse(localStorage.getItem('atelier-weather') || 'null')?.data; } catch { return null; } })();
      const intent = intentOverride || buildIntent();
      const previousOutfit = refine
        ? OUTFIT_SLOTS.flatMap((s) => slotItems(currentOutfit[s.toLowerCase()]))
        : null;
      const result = await generateOutfitWithGemini({ items, intent, weather: cached, season, previousOutfit, temperature: aiTemperature, styleProfile });
      const next = emptyOutfit();
      for (const id of result.itemIds) {
        const item = items.find((i) => i.id === id);
        if (!item) continue;
        const slot = slotForItem(item);
        if (!slot) continue;
        const key = slot.toLowerCase();
        if (isMultiSlot(slot)) {
          next[key] = Array.isArray(next[key]) ? [...next[key], item] : [item];
        } else if (!next[key]) {
          next[key] = item;
        }
      }
      setCurrentOutfit(next);
      setAiNote(result.reasoning || 'AI-styled look ready');
      setAiConfidence(typeof result.confidence === 'number' ? result.confidence : null);
      toast.show(refine ? 'Refined' : 'AI styled this look', { kind: 'success' });
      // Save to AI prompt history
      if (saveAIHistory) {
        try {
          await saveAIHistory({
            id: newId(),
            intent,
            itemIds: Object.values(next).filter(Boolean).map((i) => i.id),
            reasoning: result.reasoning || '',
            confidence: typeof result.confidence === 'number' ? result.confidence : null,
            refined: refine,
            createdAt: new Date().toISOString(),
          });
        } catch (e) { console.warn('[wardrobe] could not save AI history:', e); }
      }
    } catch (err) {
      toast.show(err?.message || 'AI styling failed', { kind: 'error', duration: 4000 });
    } finally {
      clearInterval(stageTimer);
      setAiBusy(false);
      setAiStage('');
    }
  };

  const generateCapsule = async (count, styleFilter, trip) => {
    const used = new Set();
    const baseName = trip || 'Capsule';
    const created = [];
    for (let i = 0; i < count; i++) {
      const look = generateOneLook(styleFilter, used);
      const pieces = OUTFIT_SLOTS.map((s) => look[s.toLowerCase()]).filter(Boolean);
      if (pieces.length === 0) break;
      const outfit = {
        id: newId(),
        name: `${baseName} · Day ${i + 1}`,
        itemIds: pieces.map((p) => p.id),
        createdAt: new Date().toISOString(),
        capsule: baseName,
      };
      await saveOutfit(outfit);
      created.push(outfit);
    }
    toast.show(`${created.length} capsule looks saved`, { kind: 'success' });
    setCapsuleOpen(false);
    setTab('saved');
  };

  const OutfitSlot = ({ slot }) => {
    const value = currentOutfit[slot.toLowerCase()];
    const pieces = slotItems(value);
    const multi = isMultiSlot(slot);
    const { setNodeRef, isOver } = useDroppable({ id: `slot-${slot}` });
    const clearOne = (it) => {
      if (multi) {
        setCurrentOutfit((prev) => {
          const key = slot.toLowerCase();
          const cur = slotItems(prev[key]);
          return { ...prev, [key]: cur.filter((x) => x.id !== it.id) };
        });
      } else {
        handleSelect(slot, null);
      }
    };
    return (
      <div
        ref={setNodeRef}
        className={`border-2 rounded-xl lg:rounded-2xl flex flex-col items-center justify-center relative overflow-hidden transition-all duration-200 aspect-square lg:aspect-[3/4] group ${
          isOver
            ? 'border-stone-900 ring-4 ring-stone-900/20 scale-[1.02]'
            : pieces.length > 0 ? 'bg-white smooth-shadow border-stone-200' : 'bg-stone-100 border-dashed border-stone-300'
        }`}>
        {pieces.length === 0 ? (
          <span className="text-[9px] lg:text-xs font-medium tracking-widest uppercase text-stone-400 text-center px-1 leading-tight">{slot}</span>
        ) : pieces.length === 1 ? (
          <>
            <img src={itemImages(pieces[0])[0]} alt={pieces[0].name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
            <button
              onClick={() => clearOne(pieces[0])}
              className="absolute top-1.5 right-1.5 lg:top-3 lg:right-3 bg-white/95 backdrop-blur text-stone-900 p-1.5 lg:p-2 rounded-full opacity-100 lg:opacity-70 group-hover:opacity-100 transition-all hover:bg-red-50 hover:text-red-500 shadow-md active:scale-90"
              aria-label={`Clear ${slot}`}
            >
              <X size={12} strokeWidth={2} className="lg:w-3.5 lg:h-3.5" />
            </button>
          </>
        ) : (
          // Multi-pick stacked thumbs (jewellery layering). Up to 4 in a 2×2.
          <div className="w-full h-full grid grid-cols-2 grid-rows-2 gap-0.5 p-0.5 relative">
            {pieces.slice(0, 4).map((it) => (
              <div key={it.id} className="relative bg-stone-100 rounded overflow-hidden">
                {itemImages(it)[0] && <img src={itemImages(it)[0]} alt={it.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />}
                <button onClick={(e) => { e.stopPropagation(); clearOne(it); }}
                  className="absolute top-0.5 right-0.5 bg-white/90 backdrop-blur text-stone-900 p-0.5 rounded-full opacity-90 hover:bg-red-50 hover:text-red-500 shadow-sm" aria-label={`Remove ${it.name}`}>
                  <X size={9} strokeWidth={2.5} />
                </button>
              </div>
            ))}
            {pieces.length > 4 && (
              <span className="absolute bottom-1 right-1 bg-stone-900 text-white text-[9px] tracking-wider px-1.5 py-0.5 rounded-full">+{pieces.length - 4}</span>
            )}
          </div>
        )}
      </div>
    );
  };

  const DraggableArchiveItem = ({ slot, item }) => {
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
      id: `archive-${slot}-${item.id}`,
      data: { item, slot },
    });
    const style = transform
      ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, touchAction: 'none' }
      : { touchAction: 'manipulation' };
    const isSelected = slotItems(currentOutfit[slot.toLowerCase()]).some((p) => p.id === item.id);
    // On coarse-pointer (touch) devices, omit the dnd listeners entirely.
    // PointerSensor's 6px activation distance was firing on every scroll → an
    // accidental drag → ghost item lands when the finger lifts. Tap-to-add via
    // onClick is the mobile contract; drag is desktop-only.
    const isTouch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
    const dndProps = isTouch ? {} : { ...attributes, ...listeners };
    return (
      <div
        ref={setNodeRef}
        style={style}
        {...dndProps}
        onClick={() => !isDragging && handleSelect(slot, item)}
        className={`flex-none w-28 sm:w-32 md:w-36 cursor-pointer group transition-opacity ${isDragging ? 'opacity-30' : ''}`}
      >
        <div className={`aspect-[3/4] rounded-2xl overflow-hidden mb-3 border-[3px] transition-all duration-300 relative ${
          isSelected ? 'border-stone-900 shadow-xl' : 'border-transparent group-hover:border-stone-300'
        }`}>
          <img src={itemImages(item)[0]} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 pointer-events-none" loading="lazy" />
          <div className="hidden lg:block absolute top-1.5 left-1.5 p-1 bg-white/85 backdrop-blur rounded-full text-stone-400 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <GripVertical size={11} strokeWidth={1.5} />
          </div>
        </div>
        <p className="text-xs font-medium text-stone-900 truncate px-1">{item.name}</p>
        <p className="text-[10px] text-stone-500 uppercase tracking-wider px-1 mt-0.5">{item.brand}</p>
      </div>
    );
  };

  return (
    <div className="space-y-6 md:space-y-10">
      <EditorialHeader eyebrow="Studio" title="Styling Studio" subtitle="Compose, save, and revisit editorial looks." />

      {tab === 'create' && (
        <div className="bg-white border border-stone-200/60 rounded-[2rem] p-4 sm:p-6 smooth-shadow space-y-4">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Wand2 size={14} strokeWidth={1.5} className="text-stone-500" />
              <span className="text-[10px] tracking-[0.2em] uppercase text-stone-500 font-semibold">Style intent</span>
            </div>
            <button onClick={() => setShowCustom((s) => !s)} className="text-[10px] tracking-widest uppercase text-stone-500 hover:text-stone-900 transition-colors">
              {showCustom ? 'Hide custom' : '+ Custom intent'}
            </button>
          </div>

          {/* Style intent chips */}
          <div className="flex flex-wrap gap-2">
            {['Any', ...STYLES].map((s) => (
              <button key={s} onClick={() => setStyleIntent(s)}
                className={`px-4 py-2 rounded-full text-xs transition-all border ${
                  styleIntent === s
                    ? 'bg-stone-900 border-stone-900 text-white font-medium'
                    : 'bg-white border-stone-300 text-stone-700 hover:border-stone-900'
                }`}>
                {s}
              </button>
            ))}
          </div>

          {/* Optional custom intent for richer AI prompting */}
          {showCustom && (
            <input
              type="text"
              value={customIntent}
              onChange={(e) => setCustomIntent(e.target.value)}
              placeholder='e.g. "office presentation Tuesday" or "dinner with friends"'
              className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:border-stone-900 outline-none transition-colors"
            />
          )}

          {/* Two engines, same intent */}
          <div className="grid grid-cols-2 gap-2">
            <button onClick={handleQuickStyle} disabled={aiBusy || abComparing}
              className="px-4 py-3 rounded-xl text-sm bg-white border border-stone-300 text-stone-900 hover:border-stone-900 transition-all inline-flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50">
              <Wand2 size={14} strokeWidth={1.5} /> Quick
            </button>
            <button onClick={handleAIStyle} disabled={aiBusy || abComparing || !isAIEnabled()}
              className="px-4 py-3 rounded-xl text-sm bg-stone-900 text-white hover:bg-stone-800 transition-all inline-flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50">
              <Sparkles size={14} strokeWidth={1.5} />
              {aiBusy ? 'Styling…' : isAIEnabled() ? 'AI Style' : 'AI — setup'}
            </button>
          </div>

          {/* Compare two AI suggestions side-by-side */}
          {isAIEnabled() && (
            <button onClick={handleABCompare} disabled={aiBusy || abComparing}
              className="w-full px-4 py-2.5 rounded-xl text-xs bg-white border border-stone-200 text-stone-700 hover:border-stone-900 transition-all inline-flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50">
              <Sparkles size={12} strokeWidth={1.5} className="text-amber-500" />
              {abComparing ? 'Generating two looks…' : 'Compare two AI suggestions side-by-side'}
            </button>
          )}

          {/* Quick mood presets — tap any to instantly AI-style for that scenario */}
          {isAIEnabled() && (
            <div>
              <p className="text-[10px] tracking-[0.2em] uppercase text-stone-400 mb-2">Or try a mood</p>
              <div className="flex flex-wrap gap-2">
                {MOOD_PRESETS.map((mood) => (
                  <button key={mood} disabled={aiBusy}
                    onClick={() => { setCustomIntent(mood); setShowCustom(true); handleAIStyle(mood); }}
                    className="px-3 py-2 rounded-full text-xs bg-stone-50 border border-stone-200 text-stone-700 hover:border-stone-900 hover:bg-white transition-all disabled:opacity-50 inline-flex items-center gap-1.5">
                    <Sparkles size={11} strokeWidth={1.5} className="text-amber-500" /> {mood}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Reasoning banner from AI with refinement options */}
          {aiNote && (
            <div className="bg-stone-900 text-white rounded-2xl p-4 text-sm leading-relaxed animate-in fade-in duration-300">
              <div className="flex items-start gap-3">
                <Sparkles size={14} strokeWidth={1.5} className="shrink-0 mt-0.5 text-brass-300" />
                <p className="flex-1 italic">{aiNote}</p>
                <button onClick={() => setAiNote(null)} className="text-stone-400 hover:text-white shrink-0"><X size={14} /></button>
              </div>
              {typeof aiConfidence === 'number' && (
                <div className="mt-3 ml-7 flex items-center gap-2 text-[10px] tracking-widest uppercase">
                  <span className="text-stone-400">Confidence</span>
                  <div className="flex-1 max-w-[120px] h-1 bg-stone-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${aiConfidence >= 75 ? 'bg-emerald-400' : aiConfidence >= 50 ? 'bg-amber-300' : 'bg-orange-400'}`}
                      style={{ width: `${Math.max(5, Math.min(100, aiConfidence))}%` }} />
                  </div>
                  <span className="text-stone-300 font-medium">{aiConfidence}%</span>
                </div>
              )}
              <div className="mt-4 ml-7 space-y-2">
                <p className="text-[10px] tracking-widest uppercase text-stone-400 font-semibold">Refine</p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: 'Try another', intent: null, refine: false },
                    { label: 'More casual', intent: 'make it more casual / relaxed', refine: true },
                    { label: 'More smart', intent: 'make it more polished / smart', refine: true },
                    { label: 'Swap shoes', intent: 'swap the shoes for something different that still works', refine: true },
                    { label: 'Different colours', intent: 'try a different colour palette while keeping the silhouette', refine: true },
                    { label: 'Swap top', intent: 'swap the top while keeping the rest', refine: true },
                    { label: 'Swap bottoms', intent: 'swap the bottoms while keeping the rest', refine: true },
                  ].map((r) => (
                    <button key={r.label} onClick={() => handleAIStyle(r.intent, { refine: r.refine })} disabled={aiBusy}
                      className="text-[11px] tracking-wide text-stone-200 hover:text-white border border-stone-700 hover:border-stone-400 rounded-full px-3 py-1.5 transition-colors disabled:opacity-50">
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Capsule generator — separate intent, uses same style */}
          <div className="pt-3 border-t border-stone-100 flex items-center justify-between gap-3 flex-wrap">
            <span className="text-[10px] tracking-widest uppercase text-stone-500">Multiple looks at once</span>
            <button onClick={() => setCapsuleOpen(true)}
              className="px-4 py-2 rounded-full text-xs bg-stone-100 hover:bg-stone-200 text-stone-800 transition-all inline-flex items-center gap-2">
              <Sparkles size={14} strokeWidth={1.5} /> Build a capsule
            </button>
          </div>

          {!isAIEnabled() && (
            <p className="text-[10px] text-stone-400 tracking-wide italic">
              AI styling uses Google's Gemini (free tier). Add <code>VITE_RECAPTCHA_SITE_KEY + Firebase AI Logic</code> to <code>.env.local</code> from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="underline">aistudio.google.com</a> to enable.
            </p>
          )}
        </div>
      )}

      {capsuleOpen && <CapsuleBuilder onClose={() => setCapsuleOpen(false)} onGenerate={generateCapsule} />}
      <AIProgressModal open={aiBusy || abComparing} stage={aiStage} title={abComparing ? 'Composing two looks' : 'Putting together your outfit'} />
      {abPair && (
        <ABCompareModal
          pair={abPair}
          onClose={() => setAbPair(null)}
          onPick={(choice) => {
            setCurrentOutfit(choice.outfit);
            setAiNote(choice.reasoning);
            setAiConfidence(typeof choice.confidence === 'number' ? choice.confidence : null);
            if (saveAIHistory) {
              saveAIHistory({
                id: newId(),
                intent: abPair.intent,
                itemIds: Object.values(choice.outfit).filter(Boolean).map((i) => i.id),
                reasoning: choice.reasoning || '',
                confidence: choice.confidence ?? null,
                createdAt: new Date().toISOString(),
              }).catch(() => {});
            }
            setAbPair(null);
            toast.show('Look applied', { kind: 'success' });
          }}
        />
      )}

      <div className="flex bg-stone-200/50 p-1.5 rounded-full w-fit overflow-x-auto hide-scrollbar max-w-full">
        {[['create', 'Create'], ['saved', `Saved${outfits.length ? ` · ${outfits.length}` : ''}`], ['calendar', 'Calendar'], ['history', `AI History${aiHistory.length ? ` · ${aiHistory.length}` : ''}`]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`whitespace-nowrap px-4 sm:px-6 py-2 rounded-full text-xs sm:text-sm tracking-wider uppercase transition-all duration-300 ${
              tab === id ? 'bg-white text-stone-900 shadow-sm font-medium' : 'text-stone-500 hover:text-stone-800'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'calendar' ? (
        <WearCalendar items={items} outfits={outfits} schedules={schedules} onScheduleOutfit={scheduleOutfit} onOpenOutfit={onOpenOutfit} onSaveOutfit={saveOutfit} styleProfile={styleProfile} />
      ) : tab === 'history' ? (
        <AIHistoryView
          history={aiHistory}
          items={items}
          onApply={(entry) => {
            const next = emptyOutfit();
            for (const id of entry.itemIds || []) {
              const item = items.find((i) => i.id === id);
              if (!item) continue;
              const slot = slotForItem(item);
              if (!slot) continue;
              const key = slot.toLowerCase();
              if (isMultiSlot(slot)) {
                next[key] = Array.isArray(next[key]) ? [...next[key], item] : [item];
              } else if (!next[key]) {
                next[key] = item;
              }
            }
            setCurrentOutfit(next);
            setAiNote(entry.reasoning);
            setTab('create');
            toast.show('Restored from history', { kind: 'success' });
          }}
          onToggleFavorite={toggleAIHistoryFavorite}
          onDelete={deleteAIHistory}
        />
      ) : tab === 'create' ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          {(() => {
            // Sticky mobile summary: floats above bottom nav, visible while
            // scrolling the Wardrobe Archives so the user never loses sight of
            // what they've picked. Renders only on lg:hidden + when 1+ slot
            // is filled. Tap a thumb → remove it. Save CTA inline.
            const picked = OUTFIT_SLOTS.flatMap((s) => slotItems(currentOutfit[s.toLowerCase()]).map((item) => ({ slot: s, item })));
            if (picked.length === 0) return null;
            return createPortal(
              <div className="lg:hidden fixed left-0 right-0 z-30 px-3 pointer-events-none"
                   style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 86px)' }}>
                <div className="pointer-events-auto mx-auto max-w-md bg-stone-900 text-white rounded-2xl shadow-2xl px-3 py-2.5 flex items-center gap-2">
                  <div className="flex-1 flex gap-1.5 overflow-x-auto hide-scrollbar">
                    {picked.map(({ slot, item }) => (
                      <button key={slot} onClick={() => handleSelect(slot, item)}
                        title={`Remove ${item.name}`}
                        className="flex-none w-9 h-12 rounded-lg overflow-hidden bg-stone-700 ring-1 ring-white/10 relative active:scale-95 transition-transform">
                        {itemImages(item)[0] && <img src={itemImages(item)[0]} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />}
                      </button>
                    ))}
                  </div>
                  <span className="text-[10px] tracking-widest uppercase text-stone-400 shrink-0">{picked.length}/{OUTFIT_SLOTS.length}</span>
                  {outfitName.trim() ? (
                    <button onClick={handleSave}
                      className="text-[10px] tracking-widest uppercase px-3 py-2 rounded-full bg-amber-300 text-stone-900 font-medium shrink-0">
                      Save
                    </button>
                  ) : (
                    <button onClick={() => document.querySelector('input[placeholder="Name this look…"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                      className="text-[10px] tracking-widest uppercase px-3 py-2 rounded-full bg-white text-stone-900 font-medium shrink-0">
                      Name…
                    </button>
                  )}
                </div>
              </div>,
              document.body
            );
          })()}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-5 bg-white rounded-[2rem] p-4 sm:p-6 md:p-8 border border-stone-200/60 smooth-shadow flex flex-col">
              <div className="flex items-baseline justify-between mb-3 sm:mb-6">
                <h3 className="font-display text-lg md:text-2xl text-stone-900">Current Look</h3>
                <span className="hidden lg:inline text-[10px] uppercase tracking-widest text-stone-400">Drag or tap</span>
              </div>
              <div className="grid grid-cols-3 lg:grid-cols-2 gap-2 lg:gap-3 mb-5 lg:mb-8">
                {OUTFIT_SLOTS.map((slot) => <OutfitSlot key={slot} slot={slot} />)}
              </div>
              <div className="mt-auto">
                <input type="text" placeholder="Name this look…" value={outfitName} onChange={(e) => setOutfitName(e.target.value)}
                  className="w-full px-5 py-4 rounded-xl bg-stone-50 border border-stone-200 mb-4 focus:border-stone-900 outline-none transition-colors"
                />
                <button onClick={handleSave} disabled={!outfitName.trim() || OUTFIT_SLOTS.every((s) => slotItems(currentOutfit[s.toLowerCase()]).length === 0)}
                  className="w-full bg-stone-900 text-white py-4 rounded-xl font-medium flex justify-center items-center gap-2 hover:bg-stone-800 transition-all disabled:opacity-50 shadow-lg active:scale-[0.98]"
                >
                  <Save size={18} strokeWidth={1.5} /> Save Look
                </button>
              </div>
            </div>

            <div className="lg:col-span-7">
              <div className="flex items-baseline justify-between mb-4 sm:mb-6 px-2">
                <h3 className="font-display text-xl md:text-2xl text-stone-900">Wardrobe Archives</h3>
                <span className="text-[10px] uppercase tracking-widest text-stone-400 hidden lg:inline">Tap or drag to a slot</span>
              </div>
              <div className="space-y-8 sm:space-y-10">
                {OUTFIT_SLOTS.map((slot) => {
                  const pool = items.filter((i) => itemFitsSlot(i, slot));
                  return (
                    <div key={slot}>
                      <h4 className="text-[11px] font-bold text-stone-500 uppercase tracking-[0.2em] mb-3 md:mb-4 px-2">{slot} · {pool.length}</h4>
                      <div className="flex gap-3 md:gap-4 overflow-x-auto pb-4 hide-scrollbar px-2">
                        {pool.map((item) => <DraggableArchiveItem key={item.id} slot={slot} item={item} />)}
                        {pool.length === 0 && (
                          <div className="w-full py-8 text-center text-stone-400 text-sm border border-dashed border-stone-300 rounded-2xl">No pieces in {slot.toLowerCase()} yet.</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <DragOverlay dropAnimation={{ duration: 200, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
            {activeDragItem && (
              <div className="w-32 aspect-[3/4] rounded-2xl overflow-hidden shadow-2xl border-2 border-stone-900 rotate-3 pointer-events-none">
                <img src={itemImages(activeDragItem)[0]} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      ) : (
        <div className="space-y-4">
          {outfits.length > 0 && (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                {[['all','All'],['favorites','★ Favourites']].map(([f, label]) => (
                  <button key={f} onClick={() => setOutfitsFilter(f)}
                    className={`text-xs tracking-widest uppercase px-3 py-1.5 rounded-full transition-all border ${
                      outfitsFilter === f ? 'bg-stone-900 text-white border-stone-900' : 'bg-white border-stone-200 text-stone-600 hover:border-stone-400'
                    }`}>{label}</button>
                ))}
                <span className="text-xs text-stone-500 ml-2">{filteredOutfits.length} {filteredOutfits.length === 1 ? 'look' : 'looks'}</span>
              </div>
              {!selectMode ? (
                <button onClick={() => setSelectMode(true)} className="text-xs tracking-widest uppercase text-stone-500 hover:text-stone-900 transition-colors">
                  Select
                </button>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-stone-500">{selectedOutfits.size} selected</span>
                  <button onClick={() => { setSelectMode(false); setSelectedOutfits(new Set()); }}
                    className="text-xs tracking-widest uppercase text-stone-500 hover:text-stone-900 transition-colors">
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {filteredOutfits.length === 0 && (
            <div className="col-span-full py-24 flex flex-col items-center justify-center text-stone-400 bg-white/50 border border-dashed border-stone-300 rounded-3xl">
              <Camera size={40} strokeWidth={1} className="mb-4 opacity-50" />
              <p className="text-lg font-display tracking-wide">{outfitsFilter === 'favorites' ? 'No favourites yet.' : 'No saved looks yet.'}</p>
              <p className="text-sm mt-1">{outfitsFilter === 'favorites' ? 'Star a look from its detail page.' : 'Create one in the Create tab.'}</p>
            </div>
          )}
          {filteredOutfits.map((outfit) => {
            const resolvedItems = resolveOutfitItems(outfit, items);
            const previewImages = resolvedItems.slice(0, 4).map((it) => itemImages(it)[0]).filter(Boolean);
            const isSelected = selectedOutfits.has(outfit.id);
            const handleCardClick = () => {
              if (selectMode) {
                setSelectedOutfits((prev) => {
                  const next = new Set(prev);
                  if (next.has(outfit.id)) next.delete(outfit.id); else next.add(outfit.id);
                  return next;
                });
              } else {
                onOpenOutfit?.(outfit.id);
              }
            };
            return (
              <button key={outfit.id} onClick={handleCardClick}
                onContextMenu={(e) => { e.preventDefault(); if (!selectMode) { setSelectMode(true); setSelectedOutfits(new Set([outfit.id])); } }}
                className="text-left group transition-transform active:scale-[0.97] relative">
                {selectMode && (
                  <span className={`absolute top-2 left-2 z-10 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                    isSelected ? 'bg-stone-900 border-stone-900' : 'bg-white/90 border-stone-300'
                  }`}>
                    {isSelected && <CheckCircle2 size={14} strokeWidth={2.5} className="text-white" />}
                  </span>
                )}
                <div className={`aspect-square rounded-2xl overflow-hidden bg-stone-100 smooth-shadow grid grid-cols-2 grid-rows-2 gap-0.5 mb-3 transition-all ${isSelected ? 'ring-4 ring-stone-900 scale-95' : ''}`}>
                  {previewImages.length === 0 && <div className="col-span-2 row-span-2 flex items-center justify-center text-stone-300"><Shirt size={32} strokeWidth={1} /></div>}
                  {previewImages.map((src, i) => (
                    <div key={i} className={previewImages.length === 1 ? 'col-span-2 row-span-2' : previewImages.length === 2 ? 'col-span-1 row-span-2' : previewImages.length === 3 && i === 0 ? 'col-span-2 row-span-1' : ''}>
                      <img src={src} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                    </div>
                  ))}
                </div>
                <p className="font-display text-lg text-stone-900 truncate group-hover:text-stone-700 flex items-center gap-1.5">
                  {outfit.favorite && <Star size={12} strokeWidth={1.5} className="fill-amber-400 text-amber-500 shrink-0" />}
                  {outfit.name}
                </p>
                <p className="text-[10px] text-stone-500 uppercase tracking-wider mt-0.5">{resolvedItems.length} pieces</p>
              </button>
            );
          })}
          </div>
          {selectMode && selectedOutfits.size > 0 && (
            <div className="fixed bottom-24 lg:bottom-6 left-1/2 -translate-x-1/2 z-30 bg-stone-900 text-white rounded-full shadow-2xl flex items-center gap-2 px-3 py-2 animate-in slide-in-from-bottom-4 duration-200 max-w-[calc(100vw-1rem)]">
              <span className="text-xs px-3 shrink-0">{selectedOutfits.size} selected</span>
              {onCreateLookbook && selectedOutfits.size >= 2 && (
                <button onClick={() => setLookbookNamerOpen(true)}
                  className="px-4 py-2 rounded-full bg-white text-stone-900 hover:bg-stone-100 text-xs font-medium transition-colors inline-flex items-center gap-1.5 shrink-0">
                  <Bookmark size={12} strokeWidth={1.5} /> Share as lookbook
                </button>
              )}
              <button onClick={async () => {
                const ids = Array.from(selectedOutfits);
                if (!window.confirm(`Delete ${ids.length} look${ids.length === 1 ? '' : 's'}?`)) return;
                for (const id of ids) await deleteOutfit(id);
                toast.show(`${ids.length} look${ids.length === 1 ? '' : 's'} deleted`, { kind: 'success' });
                setSelectMode(false); setSelectedOutfits(new Set());
              }} className="px-4 py-2 rounded-full bg-red-600 hover:bg-red-700 text-xs font-medium transition-colors inline-flex items-center gap-1.5 shrink-0">
                <Trash2 size={12} strokeWidth={1.5} /> Delete
              </button>
            </div>
          )}
          {lookbookNamerOpen && (
            <LookbookNamerModal
              count={selectedOutfits.size}
              busy={lookbookBusy}
              onCancel={() => setLookbookNamerOpen(false)}
              onCreate={async (name) => {
                setLookbookBusy(true);
                try {
                  await onCreateLookbook?.({ name, outfitIds: Array.from(selectedOutfits) });
                  setLookbookNamerOpen(false);
                  setSelectMode(false); setSelectedOutfits(new Set());
                } finally {
                  setLookbookBusy(false);
                }
              }}
            />
          )}
        </div>
      )}

    </div>
  );
}

function AIProgressModal({ open, stage, title = 'Putting together your outfit' }) {
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 bg-stone-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-6 animate-in fade-in duration-200">
      <div className="bg-[#F7F5F2] rounded-[2rem] max-w-md w-full p-8 sm:p-12 shadow-2xl text-center animate-in slide-in-from-bottom-4 zoom-in-95 duration-300">
        <div className="relative w-20 h-20 mx-auto mb-6">
          <span className="absolute inset-0 rounded-full bg-amber-300/40 animate-ping" />
          <span className="absolute inset-2 rounded-full bg-amber-200/40 animate-ping" style={{ animationDelay: '0.4s' }} />
          <div className="relative w-full h-full rounded-full bg-stone-900 flex items-center justify-center shadow-2xl">
            <Sparkles size={32} strokeWidth={1.5} className="text-brass-300" />
          </div>
        </div>
        <h3 className="font-display text-2xl text-stone-900 mb-3">{title}</h3>
        <p className="text-stone-500 text-sm leading-relaxed min-h-[2rem] transition-opacity duration-500" key={stage}>
          {stage || 'Just a moment…'}
        </p>
        <div className="mt-8 flex justify-center gap-2">
          <span className="w-2 h-2 rounded-full bg-stone-900 animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 rounded-full bg-stone-700 animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 rounded-full bg-stone-500 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
        <p className="text-[10px] text-stone-400 tracking-widest uppercase mt-6">Powered by Gemini</p>
      </div>
    </div>,
    document.body
  );
}

function InspirationView({ inspirations, onOpenInspiration, onAddInspiration, defaultFilter = 'all', wishlistCount = 0, onJumpToWishlist }) {
  // Filter: 'all' or 'unanalysed'. Initialised from defaultFilter so the
  // digest can target the user straight to unanalysed inspirations.
  const [filter, setFilter] = useState(defaultFilter);
  useEffect(() => { setFilter(defaultFilter); }, [defaultFilter]);
  const unanalysed = inspirations.filter((i) => !i.analysis);
  const visible = filter === 'unanalysed' ? unanalysed : inspirations;

  return (
    <div className="space-y-6 md:space-y-10">
      <EditorialHeader
        eyebrow="Mood board"
        title="Inspiration"
        subtitle={`${inspirations.length} ${inspirations.length === 1 ? 'look' : 'looks'} saved${unanalysed.length > 0 ? ` · ${unanalysed.length} unanalysed` : ''}`}
        right={
          <button onClick={onAddInspiration}
            className="bg-stone-900 text-white px-6 py-3 rounded-full text-sm font-medium inline-flex items-center gap-2 hover:bg-stone-800 transition-all shadow-lg active:scale-[0.98]">
            <Plus size={16} strokeWidth={1.5} /> Save inspiration
          </button>
        }
      />

      {inspirations.length === 0 ? (
        <div className="py-24 flex flex-col items-center justify-center text-center bg-white/50 border border-dashed border-stone-300 rounded-3xl px-6">
          <Bookmark size={48} strokeWidth={1} className="mb-6 text-stone-300" />
          <p className="font-display text-2xl text-stone-700">Save looks you love</p>
          <p className="text-sm text-stone-500 mt-3 max-w-md">
            Paste a Pinterest, Instagram or magazine URL — or upload a screenshot. Atelier's AI identifies the garments and finds matches in your wardrobe.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            {unanalysed.length > 0 && [['all', `All · ${inspirations.length}`], ['unanalysed', `Unanalysed · ${unanalysed.length}`]].map(([f, label]) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`text-xs tracking-widest uppercase px-4 py-2 rounded-full transition-all border ${
                  filter === f ? 'bg-stone-900 text-white border-stone-900' : 'bg-white border-stone-200 text-stone-600 hover:border-stone-400'
                }`}>{label}</button>
            ))}
            {/* Cross-link to wishlist — inspirations often feed wishlist items;
                surfacing the count here gives the user a one-tap path to action
                what they've earmarked from their saved looks. */}
            {wishlistCount > 0 && onJumpToWishlist && (
              <button onClick={onJumpToWishlist}
                className="text-xs tracking-widest uppercase px-4 py-2 rounded-full transition-all border bg-white border-stone-200 text-stone-600 hover:border-stone-900 hover:text-stone-900 inline-flex items-center gap-2 ml-auto">
                <Heart size={12} strokeWidth={1.5} /> Wishlist · {wishlistCount}
                <ChevronRight size={12} strokeWidth={1.5} className="-mr-1" />
              </button>
            )}
            {filter === 'unanalysed' && unanalysed.length > 0 && (
              <span className="text-[10px] tracking-widest uppercase text-stone-500 ml-2 w-full sm:w-auto">Tap any to analyse with AI</span>
            )}
          </div>

          {visible.length === 0 ? (
            <div className="py-16 text-center text-stone-500 text-sm italic">
              All inspirations have been analysed. Nice.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {visible.map((insp) => (
                <button key={insp.id} onClick={() => onOpenInspiration(insp.id)}
                  className="text-left group transition-transform active:scale-[0.97] lg:hover:-translate-y-1">
                  <div className="aspect-[3/4] rounded-2xl overflow-hidden bg-stone-100 smooth-shadow lg:group-hover:shadow-xl transition-shadow duration-300 relative">
                    {insp.image ? (
                      <img src={insp.image} alt={insp.caption || 'inspiration'} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-stone-300"><Bookmark size={40} strokeWidth={1} /></div>
                    )}
                    {insp.analysis ? (
                      <span className="absolute top-3 left-3 px-2.5 py-1 bg-stone-900/80 backdrop-blur text-white text-[10px] tracking-widest uppercase rounded-full inline-flex items-center gap-1">
                        <Sparkles size={10} strokeWidth={2} className="text-brass-300" /> Analysed
                      </span>
                    ) : (
                      <span className="absolute top-3 left-3 px-2.5 py-1 bg-brass-300 text-stone-900 text-[10px] tracking-widest uppercase rounded-full inline-flex items-center gap-1 font-medium">
                        <Sparkles size={10} strokeWidth={2} /> Analyse
                      </span>
                    )}
                  </div>
                  {insp.caption && (
                    <p className="mt-3 text-xs text-stone-700 truncate px-1">{insp.caption}</p>
                  )}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function AddInspirationModal({ onClose, onSave }) {
  useEscapeKey(onClose);
  const [step, setStep] = useState('choose'); // choose | url | preview
  const [linkInput, setLinkInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState({ image: '', caption: '', sourceUrl: '', notes: '' });

  // Ctrl+V to paste an image (desktop power-user shortcut)
  useEffect(() => {
    const onPaste = async (e) => {
      if (step === 'preview') return; // don't intercept on the review step
      const item = Array.from(e.clipboardData?.items || []).find((it) => it.type?.startsWith('image/'));
      if (!item) return;
      const file = item.getAsFile();
      if (!file) return;
      e.preventDefault();
      setBusy(true); setError(null);
      try {
        const dataUrl = await compressImageToDataUrl(file, { maxWidth: 900, maxBytes: 200_000, enhance: false });
        setData({ image: dataUrl, caption: '', sourceUrl: '', notes: '' });
        setStep('preview');
      } catch (err) {
        setError(err?.message || 'Could not paste image.');
      } finally {
        setBusy(false);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [step]);

  const handleFromUrl = async (e) => {
    e.preventDefault();
    if (!linkInput.trim()) return;
    setBusy(true); setError(null);
    try {
      const meta = await fetchProductFromUrl(linkInput);
      if (!meta.imageUrl) throw new Error('No image found at that URL.');
      // If imageUrl is already a data URL from the proxy, use it; otherwise try to compress
      let image = meta.imageUrl;
      if (!image.startsWith('data:')) {
        const compressed = await imageUrlToCompressedDataUrl(image);
        if (compressed) image = compressed;
      }
      setData({ image, caption: meta.name || '', sourceUrl: meta.sourceUrl || linkInput, notes: '' });
      setStep('preview');
    } catch (err) {
      setError(err?.message || 'Could not load that link.');
    } finally {
      setBusy(false);
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setError(null);
    try {
      const dataUrl = await compressImageToDataUrl(file, { maxWidth: 900, maxBytes: 200_000, enhance: false });
      setData({ image: dataUrl, caption: '', sourceUrl: '', notes: '' });
      setStep('preview');
    } catch (err) {
      setError(err?.message || 'Could not load that image.');
    } finally {
      setBusy(false);
    }
  };

  const handleSave = async () => {
    setBusy(true);
    try {
      await onSave({
        id: newId(),
        image: data.image,
        caption: data.caption.trim(),
        sourceUrl: data.sourceUrl.trim(),
        notes: data.notes.trim(),
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      setError(err?.message || 'Save failed.');
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-6" onClick={onClose}>
      <div className="bg-[#F7F5F2] w-full sm:max-w-lg sm:rounded-[2rem] rounded-t-[2rem] overflow-hidden shadow-2xl flex flex-col max-h-[92vh]" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center px-4 sm:px-6 py-4 sm:py-5 border-b border-stone-200/60 bg-white shrink-0">
          <h3 className="text-xl sm:text-2xl font-display font-medium text-stone-900">Save inspiration</h3>
          <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-full transition-colors">
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div className="p-4 sm:p-6 flex-1 min-h-0 overflow-y-auto space-y-5">
          {step === 'choose' && (
            <>
              <p className="text-stone-500 text-sm leading-relaxed">
                Save looks you love from anywhere — Pinterest, Instagram, magazine sites, or your camera roll. Later you can have Gemini analyse the look and find matches in your wardrobe.
              </p>
              <form onSubmit={handleFromUrl} className="space-y-3">
                <label className="block text-[10px] tracking-widest font-semibold text-stone-500 uppercase">Import via URL</label>
                <div className="relative flex items-center">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <LinkIcon size={18} className="text-stone-400" strokeWidth={1.5} />
                  </div>
                  <input type="url" value={linkInput} onChange={(e) => setLinkInput(e.target.value)}
                    placeholder="Paste a Pinterest / Instagram / blog URL"
                    className="block w-full pl-12 pr-32 py-4 bg-white border border-stone-200 rounded-2xl focus:ring-1 focus:ring-stone-900 focus:border-stone-900 transition-all text-sm" required />
                  <button type="submit" disabled={busy} className="absolute right-2 top-2 bottom-2 bg-stone-900 text-white px-6 rounded-xl text-sm font-medium hover:bg-stone-800 transition-colors disabled:opacity-50">
                    {busy ? 'Loading…' : 'Fetch'}
                  </button>
                </div>
              </form>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-stone-200"></div>
                <span className="flex-shrink-0 mx-4 text-stone-400 text-xs tracking-widest uppercase">Or</span>
                <div className="flex-grow border-t border-stone-200"></div>
              </div>

              <label className="block w-full p-8 bg-white border border-stone-200 rounded-2xl cursor-pointer hover:border-stone-900 transition-all text-center">
                <Camera size={28} strokeWidth={1} className="mx-auto mb-3 text-stone-900" />
                <p className="font-medium text-sm text-stone-900">Upload an image</p>
                <p className="text-[10px] text-stone-400 mt-1 tracking-wide uppercase">From camera roll or screenshot</p>
                <input type="file" accept="image/*" onChange={handleUpload} className="hidden" />
              </label>

              <p className="text-[10px] text-stone-400 tracking-wide text-center">
                Tip: copy an image and press <span className="font-medium text-stone-600">Ctrl+V</span> anywhere in this dialog to paste it in.
              </p>

              {error && <p className="text-xs text-red-700">{error}</p>}
            </>
          )}

          {step === 'preview' && (
            <>
              <div className="aspect-[3/4] rounded-2xl overflow-hidden bg-stone-100 smooth-shadow max-w-xs mx-auto">
                {data.image && <img src={data.image} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />}
              </div>
              <Input label="Caption / Title (optional)" value={data.caption} onChange={(e) => setData({ ...data, caption: e.target.value })} type="text" placeholder="e.g. Neutral autumn layers" />
              <div>
                <label className="block text-[10px] tracking-widest font-semibold text-stone-500 uppercase mb-2">Notes (optional)</label>
                <textarea value={data.notes} onChange={(e) => setData({ ...data, notes: e.target.value })} rows={3}
                  placeholder="What you love about this look, where you saw it, etc."
                  className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm focus:border-stone-900 outline-none transition-colors resize-y" />
              </div>
              {error && <p className="text-xs text-red-700">{error}</p>}
            </>
          )}
        </div>

        {step === 'preview' && (
          <div className="px-4 sm:px-6 py-4 border-t border-stone-200/60 bg-white/95 backdrop-blur shrink-0 flex gap-2"
               style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}>
            <button onClick={() => setStep('choose')} className="px-4 py-3 rounded-xl text-sm bg-white border border-stone-200 text-stone-700 hover:border-stone-900 transition-colors">
              Back
            </button>
            <button onClick={handleSave} disabled={busy || !data.image}
              className="flex-1 bg-stone-900 text-white py-3.5 rounded-xl font-medium hover:bg-stone-800 transition-all shadow-lg active:scale-[0.98] disabled:opacity-50">
              {busy ? 'Saving…' : 'Save inspiration'}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

function InspirationDetailView({ inspiration, items = [], shops = [], onClose, onAnalyze, onDelete, onOpenItem, onRecreateLook, onAddMissingToWishlist, onSaveAsWishlist }) {
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeStage, setAnalyzeStage] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState(null);
  const toast = useToast();
  const matches = (inspiration.analysis?.wardrobeMatchIds || []).map((id) => items.find((i) => i.id === id)).filter(Boolean);

  const ANALYSE_STAGES = [
    'Examining the photograph…',
    'Identifying each garment…',
    'Reading colour and silhouette…',
    'Searching your wardrobe for matches…',
    'Noting what\'s missing…',
    'Almost there…',
  ];

  const handleAnalyze = async () => {
    setAnalyzing(true); setError(null);
    setAnalyzeStage(ANALYSE_STAGES[0]);
    let i = 0;
    const t = setInterval(() => { i = Math.min(i + 1, ANALYSE_STAGES.length - 1); setAnalyzeStage(ANALYSE_STAGES[i]); }, 1200);
    try { await onAnalyze(); }
    catch (err) { setError(err?.message || 'Analysis failed.'); toast.show(err?.message || 'Analysis failed', { kind: 'error', duration: 4000 }); }
    finally { clearInterval(t); setAnalyzing(false); setAnalyzeStage(''); }
  };

  return createPortal(
    <div className="fixed inset-0 bg-[#F7F5F2] z-50 overflow-y-auto overflow-x-hidden animate-in fade-in duration-300">
      <div className="sticky top-0 z-10 bg-[#F7F5F2]/80 backdrop-blur-md border-b border-stone-200/60 pt-safe">
        <div className="max-w-6xl mx-auto flex justify-between items-center p-3 sm:p-4 lg:p-6">
          <button onClick={onClose} className="flex items-center gap-2 pl-2 pr-3 py-2 rounded-full text-sm text-stone-600 hover:text-stone-900 hover:bg-stone-200/50 transition-colors">
            <ChevronRight size={18} strokeWidth={1.5} className="rotate-180" />
            <span className="hidden sm:inline">Back to Inspiration</span>
            <span className="sm:hidden">Back</span>
          </button>
          {!confirmDelete ? (
            <div className="flex items-center gap-2">
              {onSaveAsWishlist && (
                <button onClick={onSaveAsWishlist}
                  className="text-xs tracking-widest uppercase px-3 sm:px-4 py-2.5 rounded-full bg-white border border-stone-200 text-stone-800 hover:border-stone-900 transition-all inline-flex items-center gap-1.5"
                  title="Save this inspiration as a wishlist item">
                  <Heart size={13} strokeWidth={1.5} />
                  <span className="hidden sm:inline">Save to wishlist</span>
                  <span className="sm:hidden">Wishlist</span>
                </button>
              )}
              <button onClick={() => setConfirmDelete(true)} className="p-2.5 rounded-full bg-white border border-stone-200 text-stone-400 hover:border-red-300 hover:text-red-600 transition-all" aria-label="Delete">
                <Trash2 size={16} strokeWidth={1.5} />
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button onClick={onDelete} className="px-4 py-2.5 rounded-full text-xs sm:text-sm bg-red-600 text-white hover:bg-red-700 transition-all">Delete</button>
              <button onClick={() => setConfirmDelete(false)} className="px-3 py-2.5 rounded-full text-xs sm:text-sm text-stone-500 hover:text-stone-900 transition-all">Cancel</button>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-12 py-6 sm:py-10 lg:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16">
          <div className="lg:col-span-6">
            <div className="aspect-[3/4] rounded-2xl lg:rounded-[2rem] overflow-hidden bg-stone-100 smooth-shadow">
              <img src={inspiration.image} alt={inspiration.caption || 'inspiration'} loading="lazy" decoding="async" className="w-full h-full object-cover" />
            </div>
            {inspiration.sourceUrl && (
              <a href={inspiration.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-2 text-xs tracking-wider uppercase text-stone-500 hover:text-stone-900 transition-colors">
                <LinkIcon size={12} strokeWidth={2} /> View source
              </a>
            )}
          </div>

          <div className="lg:col-span-6 space-y-8">
            <div>
              {inspiration.caption && <h1 className="text-3xl sm:text-4xl font-display text-stone-900 leading-tight">{inspiration.caption}</h1>}
              {inspiration.notes && <p className="text-stone-600 mt-4 leading-relaxed text-sm whitespace-pre-wrap">{inspiration.notes}</p>}
            </div>

            {!inspiration.analysis && (
              <div className="bg-stone-900 text-white rounded-2xl p-5 lg:p-6">
                <h2 className="font-display text-xl mb-3 flex items-center gap-2">
                  <Sparkles size={16} strokeWidth={1.5} className="text-brass-300" /> Analyse with AI
                </h2>
                <p className="text-stone-300 text-sm mb-5 leading-relaxed">
                  Gemini will identify the garments in this look and cross-reference against your wardrobe to find matches and gaps.
                </p>
                <button onClick={handleAnalyze} disabled={analyzing || !isAIEnabled()}
                  className="bg-white text-stone-900 px-5 py-3 rounded-full text-sm font-medium hover:bg-stone-100 transition-all shadow-lg active:scale-[0.98] disabled:opacity-50 inline-flex items-center gap-2">
                  <Sparkles size={14} strokeWidth={1.5} /> {analyzing ? 'Analysing…' : isAIEnabled() ? 'Analyse this look' : 'AI not configured'}
                </button>
                {error && <p className="mt-3 text-xs text-red-300">{error}</p>}
              </div>
            )}

            {inspiration.analysis && (
              <>
                <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5">
                  <h2 className="text-[10px] tracking-[0.2em] uppercase text-stone-500 font-bold mb-3">AI summary</h2>
                  <p className="text-stone-800 italic leading-relaxed">{inspiration.analysis.summary}</p>
                  <button onClick={handleAnalyze} disabled={analyzing} className="mt-4 text-[10px] tracking-widest uppercase text-stone-500 hover:text-stone-900 transition-colors inline-flex items-center gap-1.5">
                    <Sparkles size={11} strokeWidth={1.5} /> {analyzing ? 'Re-analysing…' : 'Re-analyse'}
                  </button>
                </div>

                {inspiration.analysis.garments?.length > 0 && (
                  <div>
                    <h2 className="text-[10px] tracking-[0.2em] uppercase text-stone-500 font-bold mb-3">Garments identified</h2>
                    <div className="space-y-2">
                      {inspiration.analysis.garments.map((g, i) => (
                        <div key={i} className="flex items-center gap-3 p-3 bg-white border border-stone-200 rounded-xl">
                          <span className="text-[10px] uppercase tracking-widest text-stone-500 font-medium shrink-0 w-20">{g.category}</span>
                          <span className="text-sm text-stone-800 flex-1">{g.description}</span>
                          {g.color && <span className="text-xs text-stone-500 capitalize">{g.color}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {matches.length > 0 && (
                  <div>
                    <div className="flex items-baseline justify-between mb-3 gap-3 flex-wrap">
                      <h2 className="text-[10px] tracking-[0.2em] uppercase text-stone-500 font-bold">From your wardrobe ({matches.length} match{matches.length === 1 ? '' : 'es'})</h2>
                      {onRecreateLook && (
                        <button onClick={onRecreateLook}
                          className="text-[10px] tracking-widest uppercase px-3 py-1.5 rounded-full bg-stone-900 text-white hover:bg-stone-800 transition-colors inline-flex items-center gap-1.5">
                          <Sparkles size={11} strokeWidth={1.5} /> Recreate this look
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {matches.map((item) => (
                        <button key={item.id} onClick={() => onOpenItem?.(item.id)} className="text-left group">
                          <div className="aspect-[3/4] rounded-xl overflow-hidden bg-stone-100 mb-2">
                            {itemImages(item)[0] && <img src={itemImages(item)[0]} alt={item.name} loading="lazy" decoding="async" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />}
                          </div>
                          <p className="text-xs text-stone-900 truncate">{item.name}</p>
                          <p className="text-[10px] text-stone-500 uppercase tracking-wider truncate">{item.brand}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {inspiration.analysis.missingPieces?.length > 0 && (
                  <div>
                    <h2 className="text-[10px] tracking-[0.2em] uppercase text-stone-500 font-bold mb-3">Missing from your wardrobe</h2>
                    <ul className="space-y-3">
                      {inspiration.analysis.missingPieces.map((piece, i) => {
                        const googleShop = `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(piece)}`;
                        // Build a Google search restricted to user's Directory hosts
                        const shopHosts = shops.map((s) => {
                          try { return new URL(s.url).hostname.replace(/^www\./, ''); } catch { return null; }
                        }).filter(Boolean);
                        const yourShops = shopHosts.length > 0
                          ? `https://www.google.com/search?q=${encodeURIComponent(piece + ' (' + shopHosts.map((h) => `site:${h}`).join(' OR ') + ')')}`
                          : null;
                        return (
                          <li key={i} className="p-4 bg-orange-50 border border-orange-200/50 rounded-2xl">
                            <div className="flex gap-3 items-start mb-3">
                              <AlertCircle size={16} strokeWidth={1.5} className="shrink-0 mt-0.5 text-orange-700" />
                              <span className="text-sm text-orange-900 flex-1">{piece}</span>
                            </div>
                            <div className="flex flex-wrap gap-2 ml-7">
                              {onAddMissingToWishlist && (
                                <button onClick={() => onAddMissingToWishlist(piece)}
                                  className="inline-flex items-center gap-1.5 text-[11px] tracking-wider uppercase px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-full transition-colors">
                                  <Heart size={11} strokeWidth={1.5} /> Add to wishlist
                                </button>
                              )}
                              <a href={googleShop} target="_blank" rel="noopener noreferrer"
                                 className="inline-flex items-center gap-1.5 text-[11px] tracking-wider uppercase px-3 py-1.5 bg-white border border-stone-200 hover:border-stone-900 text-stone-800 rounded-full transition-colors">
                                <Store size={11} strokeWidth={1.5} /> Shop on Google
                              </a>
                              {yourShops && (
                                <a href={yourShops} target="_blank" rel="noopener noreferrer"
                                   className="inline-flex items-center gap-1.5 text-[11px] tracking-wider uppercase px-3 py-1.5 bg-white border border-stone-200 hover:border-stone-900 text-stone-800 rounded-full transition-colors">
                                  <Bookmark size={11} strokeWidth={1.5} /> Search your shops
                                </a>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
      <AIProgressModal open={analyzing} stage={analyzeStage} title="Analysing your inspiration" />
    </div>,
    document.body
  );
}

function ABCompareModal({ pair, onClose, onPick }) {
  const renderSide = (label, side) => {
    const pieces = Object.values(side.outfit).filter(Boolean);
    return (
      <div className="flex flex-col bg-white border border-stone-200/60 rounded-2xl p-4 sm:p-5 smooth-shadow">
        <div className="flex items-baseline justify-between mb-3">
          <span className="font-display text-2xl text-stone-900">{label}</span>
          {typeof side.confidence === 'number' && (
            <span className={`text-[10px] tracking-widest uppercase font-medium px-2 py-1 rounded-full ${
              side.confidence >= 75 ? 'bg-emerald-100 text-emerald-800' : side.confidence >= 50 ? 'bg-brass-100 text-brass-700' : 'bg-orange-100 text-orange-800'
            }`}>{side.confidence}%</span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2 mb-3 flex-1">
          {pieces.slice(0, 9).map((p) => (
            <div key={p.id} className="aspect-[3/4] rounded-lg overflow-hidden bg-stone-100">
              {itemImages(p)[0] && <img src={itemImages(p)[0]} alt={p.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />}
            </div>
          ))}
        </div>
        {side.reasoning && <p className="text-xs text-stone-600 italic leading-relaxed mb-4">{side.reasoning}</p>}
        <button onClick={() => onPick(side)} className="mt-auto w-full bg-stone-900 text-white py-3 rounded-xl font-medium hover:bg-stone-800 transition-all active:scale-[0.98]">
          Pick {label}
        </button>
      </div>
    );
  };
  return createPortal(
    <div className="fixed inset-0 bg-stone-900/70 backdrop-blur-md z-[90] overflow-y-auto p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6 text-white">
          <div>
            <p className="text-[10px] tracking-[0.2em] uppercase text-stone-400">Pick the look you prefer</p>
            <h2 className="text-2xl sm:text-3xl font-display mt-1">A or B?</h2>
          </div>
          <button onClick={onClose} className="p-2.5 text-stone-300 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors" aria-label="Close">
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {renderSide('A', pair.a)}
          {renderSide('B', pair.b)}
        </div>
      </div>
    </div>,
    document.body
  );
}

function AIHistoryView({ history, items, onApply, onToggleFavorite, onDelete }) {
  const [filter, setFilter] = useState('all');
  const filtered = filter === 'favorites' ? history.filter((h) => h.favorite) : history;
  const sorted = [...filtered].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  if (history.length === 0) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-center bg-white/50 border border-dashed border-stone-300 rounded-3xl px-6">
        <Sparkles size={40} strokeWidth={1} className="mb-6 text-stone-300" />
        <p className="font-display text-2xl text-stone-700">No AI history yet</p>
        <p className="text-sm text-stone-500 mt-3 max-w-md">
          Every AI-styled look gets saved here automatically. Re-apply, favourite, or remove past suggestions.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex bg-stone-200/50 p-1.5 rounded-full w-fit">
        {[['all', 'All'], ['favorites', '★ Favourites']].map(([f, label]) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-5 py-2 rounded-full text-xs tracking-wider uppercase transition-all duration-300 ${
              filter === f ? 'bg-white text-stone-900 shadow-sm font-medium' : 'text-stone-500 hover:text-stone-800'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {sorted.length === 0 ? (
        <p className="text-stone-500 italic text-sm py-8 text-center">No favourites yet — star past suggestions to keep them here.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sorted.map((entry) => {
            const resolvedItems = (entry.itemIds || []).map((id) => items.find((i) => i.id === id)).filter(Boolean);
            const date = entry.createdAt ? new Date(entry.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
            return (
              <div key={entry.id} className="bg-white border border-stone-200/60 rounded-2xl p-4 sm:p-5 smooth-shadow">
                <div className="flex items-baseline justify-between mb-3 gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] tracking-widest uppercase text-stone-400">{date}{entry.refined ? ' · refinement' : ''}</p>
                    <p className="text-sm text-stone-900 font-medium mt-1 truncate">{entry.intent || 'Everyday look'}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => onToggleFavorite(entry)}
                      className={`p-2 rounded-full transition-all ${
                        entry.favorite ? 'bg-amber-100 text-amber-600' : 'text-stone-300 hover:text-amber-500 hover:bg-amber-50'
                      }`}
                      aria-label="Toggle favourite">
                      <Star size={14} strokeWidth={1.5} className={entry.favorite ? 'fill-amber-500' : ''} />
                    </button>
                    <button onClick={() => onDelete(entry.id)}
                      className="p-2 rounded-full text-stone-300 hover:text-red-500 hover:bg-red-50 transition-all" aria-label="Delete">
                      <X size={14} strokeWidth={1.5} />
                    </button>
                  </div>
                </div>

                {entry.reasoning && (
                  <p className="text-xs text-stone-600 italic leading-relaxed mb-3">{entry.reasoning}</p>
                )}

                {resolvedItems.length > 0 ? (
                  <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-2 mb-3">
                    {resolvedItems.map((it) => (
                      <div key={it.id} className="flex-none w-14 aspect-[3/4] rounded-lg overflow-hidden bg-stone-100">
                        {itemImages(it)[0] && <img src={itemImages(it)[0]} alt={it.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-stone-400 italic mb-3">Some items have been deleted from your wardrobe.</p>
                )}

                <button onClick={() => onApply(entry)} disabled={resolvedItems.length === 0}
                  className="w-full px-4 py-2.5 rounded-xl text-xs tracking-wider uppercase font-medium bg-stone-900 text-white hover:bg-stone-800 transition-all active:scale-[0.98] disabled:opacity-50">
                  Re-apply to Current Look
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CapsuleBuilder({ onClose, onGenerate }) {
  const [count, setCount] = useState(5);
  const [styleFilter, setStyleFilter] = useState(null);
  const [tripName, setTripName] = useState('');
  const [busy, setBusy] = useState(false);

  const handleGenerate = async () => {
    setBusy(true);
    try { await onGenerate(count, styleFilter, tripName.trim() || 'Capsule'); }
    finally { setBusy(false); }
  };

  return createPortal(
    <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-6">
      <div className="bg-[#F7F5F2] w-full sm:max-w-lg sm:rounded-[2rem] rounded-t-[2rem] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-300 flex flex-col max-h-[92vh]">
        <div className="flex justify-between items-center px-4 sm:px-6 py-4 sm:py-5 border-b border-stone-200/60 bg-white shrink-0">
          <h3 className="text-xl sm:text-2xl font-display font-medium text-stone-900">Build a capsule</h3>
          <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-full transition-colors">
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>
        <div className="p-4 sm:p-6 space-y-6 overflow-y-auto">
          <p className="text-stone-500 text-sm leading-relaxed">
            Generate several outfits at once, drawing from your wardrobe — useful for trips, work weeks, or when you want a coordinated rotation.
          </p>

          <div>
            <label className="block text-[10px] tracking-widest font-semibold text-stone-500 uppercase mb-2">Trip / Capsule name (optional)</label>
            <input value={tripName} onChange={(e) => setTripName(e.target.value)}
              placeholder="e.g. Lisbon, Work week, Long weekend"
              className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm focus:border-stone-900 outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-[10px] tracking-widest font-semibold text-stone-500 uppercase mb-3">Number of looks</label>
            <div className="flex flex-wrap gap-2">
              {[3, 4, 5, 6, 7].map((n) => (
                <button key={n} type="button" onClick={() => setCount(n)}
                  className={`w-12 h-12 rounded-xl text-sm font-medium border transition-all ${
                    count === n ? 'bg-stone-900 border-stone-900 text-white' : 'bg-white border-stone-200 text-stone-700 hover:border-stone-300'
                  }`}>
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[10px] tracking-widest font-semibold text-stone-500 uppercase mb-3">Style focus (optional)</label>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setStyleFilter(null)}
                className={`px-3 py-2.5 sm:py-1.5 rounded-full text-xs font-medium transition-all border ${
                  styleFilter === null ? 'bg-stone-900 border-stone-900 text-white' : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'
                }`}>Any</button>
              {STYLES.map((s) => (
                <button key={s} type="button" onClick={() => setStyleFilter(s)}
                  className={`px-3 py-2.5 sm:py-1.5 rounded-full text-xs font-medium transition-all border ${
                    styleFilter === s ? 'bg-stone-900 border-stone-900 text-white' : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'
                  }`}>{s}</button>
              ))}
            </div>
          </div>

          <button onClick={handleGenerate} disabled={busy}
            className="w-full bg-stone-900 text-white py-4 rounded-xl font-medium hover:bg-stone-800 transition-colors shadow-lg disabled:opacity-50 flex items-center justify-center gap-2">
            <Sparkles size={16} strokeWidth={1.5} /> {busy ? 'Generating…' : `Generate ${count} looks`}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function WearCalendar({ items, outfits = [], schedules = {}, onScheduleOutfit, onOpenOutfit, onSaveOutfit, styleProfile = '' }) {
  const today = new Date();
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [selectedDate, setSelectedDate] = useState(null);
  const [schedulingDate, setSchedulingDate] = useState(null);
  const [rangeMode, setRangeMode] = useState(false);
  const [rangeStart, setRangeStart] = useState(null);
  const [rangeEnd, setRangeEnd] = useState(null);
  const [packingOpen, setPackingOpen] = useState(false);
  const [travelOpen, setTravelOpen] = useState(false);
  const toast = useToast();

  const toggleRangeMode = () => {
    setRangeMode((on) => !on);
    setRangeStart(null); setRangeEnd(null);
    setSelectedDate(null);
  };
  const pickRangeDate = (iso) => {
    if (!rangeStart || (rangeStart && rangeEnd)) {
      setRangeStart(iso); setRangeEnd(null);
    } else if (iso < rangeStart) {
      setRangeStart(iso);
    } else {
      setRangeEnd(iso);
    }
  };
  const inRange = (iso) => rangeStart && (iso === rangeStart || (rangeEnd && iso >= rangeStart && iso <= rangeEnd));

  const handleCopyPrev = async () => {
    if (!selectedDate) return;
    const prev = new Date(selectedDate + 'T00:00:00');
    prev.setDate(prev.getDate() - 1);
    const prevISO = prev.toISOString().slice(0, 10);
    const prevSched = schedules[prevISO];
    if (!prevSched?.outfitId) { toast.show('Nothing planned yesterday', { kind: 'default' }); return; }
    await onScheduleOutfit(selectedDate, prevSched.outfitId);
  };
  const handleRepeatWeek = async () => {
    if (!selectedDate) return;
    const base = new Date(selectedDate + 'T00:00:00');
    const sched = schedules[selectedDate];
    if (!sched?.outfitId) { toast.show('Plan a look for this day first', { kind: 'default' }); return; }
    for (let i = 1; i <= 6; i++) {
      const next = new Date(base);
      next.setDate(next.getDate() + i);
      const iso = next.toISOString().slice(0, 10);
      if (!schedules[iso]) await onScheduleOutfit(iso, sched.outfitId);
    }
    toast.show('Repeated for the week', { kind: 'success' });
  };

  // Map each ISO date → items worn that day.
  const wearsByDate = {};
  for (const item of items) {
    for (const d of itemWearHistory(item)) {
      (wearsByDate[d] = wearsByDate[d] || []).push(item);
    }
  }

  const monthStart = new Date(cursor.year, cursor.month, 1);
  const firstWeekday = (monthStart.getDay() + 6) % 7; // shift so Monday=0
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
  const monthLabel = monthStart.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  const goPrev = () => setCursor((c) => ({ year: c.month === 0 ? c.year - 1 : c.year, month: c.month === 0 ? 11 : c.month - 1 }));
  const goNext = () => setCursor((c) => ({ year: c.month === 11 ? c.year + 1 : c.year, month: c.month === 11 ? 0 : c.month + 1 }));

  const selectedISO = selectedDate;
  const selectedWears = selectedISO ? wearsByDate[selectedISO] || [] : [];
  const monthPrefix = `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}`;
  const totalWearsInMonth = Object.entries(wearsByDate).filter(([d]) => d.startsWith(monthPrefix)).reduce((sum, [, list]) => sum + list.length, 0);
  const plannedInMonth = Object.keys(schedules).filter((d) => d.startsWith(monthPrefix) && schedules[d]?.outfitId).length;

  return (
    <div className="space-y-6">
      <div className="bg-white border border-stone-200/60 rounded-[2rem] p-4 sm:p-6 smooth-shadow">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <button onClick={goPrev} className="p-2.5 rounded-full text-stone-500 hover:bg-stone-100 transition-colors" aria-label="Previous month">
            <ChevronRight size={18} strokeWidth={1.5} className="rotate-180" />
          </button>
          <div className="text-center">
            <p className="font-display text-xl sm:text-2xl text-stone-900">{monthLabel}</p>
            <p className="text-[10px] tracking-widest uppercase text-stone-500 mt-1">
              {totalWearsInMonth} wears · {plannedInMonth} planned
            </p>
          </div>
          <button onClick={goNext} className="p-2.5 rounded-full text-stone-500 hover:bg-stone-100 transition-colors" aria-label="Next month">
            <ChevronRight size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div className="flex items-center justify-end mb-3 gap-2 flex-wrap">
          <button onClick={() => downloadIcs(`atelier-calendar-${todayISO()}.ics`, schedules, outfits, items)}
            disabled={Object.values(schedules || {}).filter((s) => s?.outfitId).length === 0}
            className="text-[10px] tracking-widest uppercase px-3 py-1.5 rounded-full bg-white border border-stone-200 text-stone-600 hover:border-stone-400 transition-all disabled:opacity-40 inline-flex items-center gap-1.5">
            <Download size={12} strokeWidth={1.5} /> Export .ics
          </button>
          <button onClick={toggleRangeMode}
            className={`text-[10px] tracking-widest uppercase px-3 py-1.5 rounded-full transition-all border ${
              rangeMode ? 'bg-stone-900 text-white border-stone-900' : 'bg-white border-stone-200 text-stone-600 hover:border-stone-400'
            }`}>
            {rangeMode ? '× Cancel range' : '✦ Pack for trip'}
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[10px] tracking-widest uppercase text-stone-400 mb-2">
          {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d) => <div key={d}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {Array.from({ length: firstWeekday }).map((_, i) => <div key={`pad-${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const iso = `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const list = wearsByDate[iso] || [];
            const scheduled = schedules[iso];
            const isToday = iso === todayISO();
            const isSelected = iso === selectedISO;
            const isFuture = iso > todayISO();
            const inRng = inRange(iso);
            const isRangeStart = iso === rangeStart;
            const isRangeEnd = iso === rangeEnd;
            return (
              <button key={iso}
                onClick={() => rangeMode ? pickRangeDate(iso) : setSelectedDate(iso)}
                className={`aspect-square rounded-xl p-1 sm:p-2 flex flex-col items-center justify-center transition-all border relative ${
                  isRangeStart || isRangeEnd ? 'bg-stone-900 text-white border-stone-900'
                  : inRng ? 'bg-stone-200 border-stone-300 text-stone-900'
                  : isSelected ? 'bg-stone-900 text-white border-stone-900'
                  : isToday ? 'bg-stone-100 border-stone-300 text-stone-900'
                  : scheduled ? 'bg-amber-50 border-amber-200 hover:border-amber-400 text-stone-900'
                  : list.length > 0 ? 'bg-stone-50 border-stone-200 hover:border-stone-400 text-stone-900'
                  : 'bg-white border-stone-100 text-stone-400 hover:border-stone-300'
                }`}>
                <span className="text-xs sm:text-sm">{day}</span>
                {list.length > 0 && (
                  <span className={`text-[8px] sm:text-[10px] mt-0.5 ${isSelected ? 'text-stone-300' : 'text-stone-500'}`}>
                    {list.length} wear{list.length === 1 ? '' : 's'}
                  </span>
                )}
                {scheduled && !list.length && (
                  <span className={`text-[8px] sm:text-[10px] mt-0.5 ${isSelected ? 'text-amber-200' : 'text-brass-600'}`}>
                    ✦ planned
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {rangeMode && rangeStart && (() => {
        const startLabel = new Date(rangeStart + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
        const endLabel = rangeEnd ? new Date(rangeEnd + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : null;
        const days = rangeEnd
          ? Math.floor((new Date(rangeEnd) - new Date(rangeStart)) / 86_400_000) + 1
          : 1;
        const plannedDays = Object.keys(schedules).filter((d) => d >= rangeStart && d <= (rangeEnd || rangeStart) && schedules[d]?.outfitId).length;
        return (
          <div className="bg-stone-900 text-white rounded-[2rem] p-5 sm:p-6 flex items-center justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <p className="text-[10px] tracking-widest uppercase text-stone-400">Trip range</p>
              <p className="font-display text-lg sm:text-xl mt-1">
                {startLabel}{endLabel ? ` → ${endLabel}` : ' — tap end date'}
              </p>
              <p className="text-[10px] tracking-wider uppercase text-stone-400 mt-1">{days} day{days === 1 ? '' : 's'} · {plannedDays} planned</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {onSaveOutfit && isAIEnabled() && (
                <button
                  disabled={!rangeEnd}
                  onClick={() => setTravelOpen(true)}
                  className="text-xs tracking-wider uppercase px-5 py-2.5 rounded-full bg-brass-300 text-stone-900 hover:bg-brass-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Wand2 size={14} strokeWidth={1.5} /> Plan with AI
                </button>
              )}
              <button
                disabled={!rangeEnd || plannedDays === 0}
                onClick={() => setPackingOpen(true)}
                className="text-xs tracking-wider uppercase px-5 py-2.5 rounded-full bg-white text-stone-900 hover:bg-stone-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Generate packing list
              </button>
            </div>
          </div>
        );
      })()}

      {selectedDate && (() => {
        const scheduled = schedules[selectedDate];
        const scheduledOutfit = scheduled ? outfits.find((o) => o.id === scheduled.outfitId) : null;
        const scheduledPieces = scheduledOutfit ? resolveOutfitItems(scheduledOutfit, items) : [];
        const isFutureOrToday = selectedDate >= todayISO();
        const formattedDate = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        return (
          <div className="bg-white border border-stone-200/60 rounded-[2rem] p-6 smooth-shadow space-y-5">
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <h3 className="font-display text-xl sm:text-2xl text-stone-900">{formattedDate}</h3>
              {isFutureOrToday && onScheduleOutfit && (
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setSchedulingDate(selectedDate)}
                    className="text-xs tracking-widest uppercase text-stone-500 hover:text-stone-900 transition-colors px-3 py-1.5 border border-stone-200 rounded-full hover:border-stone-400">
                    {scheduled ? 'Change look' : '＋ Plan a look'}
                  </button>
                  {!scheduled && (
                    <button onClick={handleCopyPrev}
                      className="text-xs tracking-widest uppercase text-stone-500 hover:text-stone-900 transition-colors px-3 py-1.5 border border-stone-200 rounded-full hover:border-stone-400">
                      ↩ Copy yesterday
                    </button>
                  )}
                  {scheduled && (
                    <button onClick={handleRepeatWeek}
                      className="text-xs tracking-widest uppercase text-stone-500 hover:text-stone-900 transition-colors px-3 py-1.5 border border-stone-200 rounded-full hover:border-stone-400">
                      ↪ Repeat all week
                    </button>
                  )}
                </div>
              )}
            </div>

            {scheduledOutfit && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
                  <p className="text-[10px] tracking-widest uppercase text-brass-700 font-bold">Planned · {scheduledOutfit.name}</p>
                  <div className="flex gap-2">
                    <button onClick={() => onOpenOutfit?.(scheduledOutfit.id)} className="text-[10px] tracking-widest uppercase text-stone-700 hover:text-stone-900">View</button>
                    <button onClick={() => onScheduleOutfit(selectedDate, null)} className="text-[10px] tracking-widest uppercase text-stone-500 hover:text-red-600">Unschedule</button>
                  </div>
                </div>
                <div className="flex gap-2 overflow-x-auto hide-scrollbar">
                  {scheduledPieces.map((p) => (
                    <div key={p.id} className="flex-none w-14 aspect-[3/4] rounded-lg overflow-hidden bg-white">
                      {itemImages(p)[0] && <img src={itemImages(p)[0]} alt={p.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="text-[10px] tracking-widest uppercase text-stone-500 mb-3">{selectedWears.length > 0 ? 'Actually worn' : 'Wear log'}</p>
              {selectedWears.length === 0 ? (
                <p className="text-stone-400 italic text-sm">{isFutureOrToday ? 'Nothing logged yet — log wears from any item\'s detail view.' : 'Nothing was logged for this day.'}</p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                  {selectedWears.map((item) => (
                    <div key={item.id} className="flex flex-col gap-2">
                      <div className="aspect-[3/4] rounded-xl overflow-hidden bg-stone-100">
                        {itemImages(item)[0] && <img src={itemImages(item)[0]} alt={item.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />}
                      </div>
                      <p className="text-xs text-stone-900 truncate">{item.name}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {schedulingDate && (
        <SchedulePickerModal
          date={schedulingDate}
          outfits={outfits}
          items={items}
          onClose={() => setSchedulingDate(null)}
          onPick={async (outfitId) => { await onScheduleOutfit(schedulingDate, outfitId); setSchedulingDate(null); }}
        />
      )}
      {packingOpen && rangeStart && rangeEnd && (
        <PackingListModal
          startISO={rangeStart}
          endISO={rangeEnd}
          schedules={schedules}
          outfits={outfits}
          items={items}
          onClose={() => setPackingOpen(false)}
        />
      )}
      {travelOpen && rangeStart && rangeEnd && (
        <TravelPlannerModal
          startISO={rangeStart}
          endISO={rangeEnd}
          items={items}
          onSaveOutfit={onSaveOutfit}
          onScheduleOutfit={onScheduleOutfit}
          styleProfile={styleProfile}
          onClose={() => setTravelOpen(false)}
        />
      )}
    </div>
  );
}

// Travel planner: type a destination, hit forecast → Gemini → one outfit per
// day of the range. Saves each as a "Trip · Date" outfit + schedules it. After
// it runs, the user can immediately tap "Generate packing list" right next to
// this button to get the deduped list.
function TravelPlannerModal({ startISO, endISO, items, onSaveOutfit, onScheduleOutfit, styleProfile, onClose }) {
  useEscapeKey(onClose);
  const [destination, setDestination] = useState('');
  const [stage, setStage] = useState('input'); // input | forecasting | generating | done | error
  const [forecast, setForecast] = useState(null);
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState(null);
  const toast = useToast();
  const days = Math.floor((new Date(endISO) - new Date(startISO)) / 86_400_000) + 1;

  const run = async (e) => {
    e?.preventDefault?.();
    if (!destination.trim()) return;
    setError(null);
    setStage('forecasting');
    try {
      const fc = await fetchTravelForecast(destination.trim(), startISO, endISO);
      setForecast(fc);
      setStage('generating');
      const owned = items.filter((i) => i.status === 'owned' && !i.deletedAt);
      const result = await generateTravelCapsuleWithGemini({
        items: owned,
        destination: `${fc.name}${fc.country ? ', ' + fc.country : ''}`,
        daily: fc.daily,
        styleProfile,
      });
      setPlan(result);
      setStage('done');
    } catch (e) {
      setError(e?.message || 'Failed.');
      setStage('error');
    }
  };

  const apply = async () => {
    if (!plan?.days?.length) return;
    for (const day of plan.days) {
      const itemIds = (day.itemIds || []).filter((id) => items.some((i) => i.id === id));
      if (itemIds.length === 0) continue;
      const outfit = {
        id: newId(),
        name: `Trip · ${new Date(day.date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}`,
        itemIds,
        createdAt: new Date().toISOString(),
        reasoning: day.reasoning || '',
        intent: forecast?.name ? `travel · ${forecast.name}` : 'travel',
      };
      await onSaveOutfit?.(outfit);
      await onScheduleOutfit?.(day.date, outfit.id);
    }
    toast.show(`Travel capsule saved · ${plan.days.length} days scheduled`, { kind: 'success' });
    onClose?.();
  };

  return createPortal(
    <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-6" onClick={onClose}>
      <div className="bg-[#F7F5F2] w-full sm:max-w-lg sm:rounded-[2rem] rounded-t-[2rem] overflow-hidden shadow-2xl flex flex-col max-h-[92vh]" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start px-6 py-5 border-b border-stone-200/60 bg-white shrink-0">
          <div>
            <p className="text-[10px] tracking-widest uppercase text-stone-500">Travel capsule</p>
            <h3 className="text-xl font-display text-stone-900 mt-1">Plan {days} day{days === 1 ? '' : 's'} with AI</h3>
          </div>
          <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-full transition-colors">
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div className="p-6 flex-1 min-h-0 overflow-y-auto space-y-5">
          {stage === 'input' && (
            <form onSubmit={run} className="space-y-4">
              <p className="text-stone-500 text-sm leading-relaxed">
                Type a destination — anywhere in the world. Atelier will fetch the forecast for {new Date(startISO + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} → {new Date(endISO + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} and let Gemini build a per-day capsule from your wardrobe.
              </p>
              <input
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                placeholder="e.g. Lisbon, Edinburgh, Marrakech…"
                className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm focus:border-stone-900 outline-none"
                autoFocus
              />
              <button type="submit" disabled={!destination.trim()}
                className="w-full bg-stone-900 text-white py-3 rounded-xl font-medium hover:bg-stone-800 disabled:opacity-50">
                Fetch forecast & compose
              </button>
              <p className="text-[10px] text-stone-400 leading-relaxed">
                Forecast is via Open-Meteo (free, no API key). Capsule is generated by Gemini and uses items you already own. Dates beyond ~16 days out won't have a forecast yet.
              </p>
            </form>
          )}

          {(stage === 'forecasting' || stage === 'generating') && (
            <div className="flex flex-col items-center gap-4 py-10 text-stone-500 text-sm">
              <div className="w-8 h-8 border-2 border-stone-300 border-t-stone-900 rounded-full animate-spin" />
              <p>{stage === 'forecasting' ? `Fetching forecast for ${destination}…` : 'Gemini is composing your capsule…'}</p>
            </div>
          )}

          {stage === 'error' && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3 rounded-xl">
              {error}
              <button onClick={() => setStage('input')} className="block mt-3 text-xs tracking-wider uppercase text-stone-500 hover:text-stone-900">
                Try again
              </button>
            </div>
          )}

          {stage === 'done' && plan && (
            <>
              <div className="bg-stone-900 text-white rounded-2xl p-4">
                <p className="text-[10px] tracking-widest uppercase text-stone-400 mb-1">{forecast?.name}{forecast?.country ? `, ${forecast.country}` : ''}</p>
                <p className="text-sm italic text-stone-200">{plan.summary}</p>
              </div>
              <div className="space-y-3">
                {plan.days.map((d, idx) => {
                  const fcDay = forecast?.daily?.find((f) => f.date === d.date);
                  const pieces = (d.itemIds || []).map((id) => items.find((i) => i.id === id)).filter(Boolean);
                  return (
                    <div key={idx} className="bg-white border border-stone-200 rounded-2xl p-4">
                      <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
                        <p className="text-sm font-medium text-stone-900">
                          {new Date(d.date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </p>
                        {fcDay && (
                          <span className="text-[10px] tracking-wider uppercase text-stone-500">
                            {fcDay.tmin}-{fcDay.tmax}°C · {weatherLabel(fcDay.code)}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2 overflow-x-auto hide-scrollbar pb-1 mb-2">
                        {pieces.map((p) => (
                          <div key={p.id} className="flex-none w-12 aspect-[3/4] rounded-lg overflow-hidden bg-stone-100">
                            {itemImages(p)[0] && <img src={itemImages(p)[0]} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />}
                          </div>
                        ))}
                      </div>
                      {d.reasoning && <p className="text-[11px] text-stone-500 italic leading-relaxed">{d.reasoning}</p>}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {stage === 'done' && (
          <div className="px-6 py-4 border-t border-stone-200/60 bg-white shrink-0 flex gap-2 justify-end">
            <button onClick={() => { setPlan(null); setStage('input'); }} className="text-xs tracking-wider uppercase px-4 py-2 rounded-full text-stone-500 hover:text-stone-900">
              Discard
            </button>
            <button onClick={apply} className="text-xs tracking-wider uppercase px-5 py-2.5 rounded-full bg-stone-900 text-white hover:bg-stone-800 flex items-center gap-2">
              <Calendar size={14} strokeWidth={1.5} /> Save & schedule all
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

// Aggregate every piece across a date-range of planned outfits, dedupe by
// item id, group by category, and print a clean checklist. Optional CSV/PDF
// export skipped — print works as PDF on every modern browser via "Save as PDF".
// Share sheet: native Web Share (iOS/Android) + WhatsApp/email deep links +
// explicit Copy button. The inline URL field is selectable so even when
// clipboard.writeText is blocked (Safari outside user-gesture, some PWAs),
// the user can long-press → copy manually.
function ShareLinkModal({ url, title, kind, onClose }) {
  useEscapeKey(onClose);
  const [copied, setCopied] = useState(false);
  const inputRef = React.useRef(null);
  const label = kind === 'lookbook' ? 'lookbook' : 'look';
  const shareText = `Have a look at "${title}" on Atelier`;

  const tryCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select the input so the user can copy with the system menu.
      inputRef.current?.select();
      inputRef.current?.setSelectionRange?.(0, url.length);
    }
  };

  const tryNativeShare = async () => {
    if (!navigator.share) return;
    try { await navigator.share({ title, text: shareText, url }); }
    catch { /* user cancelled or unsupported; ignore */ }
  };

  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${url}`)}`;
  const emailHref = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${shareText}\n\n${url}`)}`;
  const hasNative = typeof navigator !== 'undefined' && !!navigator.share;

  return createPortal(
    <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center sm:p-6" onClick={onClose}>
      <div className="bg-[#F7F5F2] w-full sm:max-w-md sm:rounded-[2rem] rounded-t-[2rem] overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-stone-200/60 bg-white flex justify-between items-start">
          <div className="min-w-0">
            <p className="text-[10px] tracking-widest uppercase text-stone-500">Share {label}</p>
            <h3 className="text-xl font-display text-stone-900 truncate mt-1">{title}</h3>
          </div>
          <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-full transition-colors shrink-0 ml-3" aria-label="Close">
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {hasNative && (
            <button onClick={tryNativeShare}
              className="w-full bg-stone-900 text-white py-4 rounded-2xl font-medium hover:bg-stone-800 transition-colors flex items-center justify-center gap-2 shadow-lg">
              <Download size={16} strokeWidth={1.5} className="rotate-180" /> Share via…
            </button>
          )}

          <div className="grid grid-cols-2 gap-3">
            <a href={whatsappHref} target="_blank" rel="noopener noreferrer"
              className="bg-white border border-stone-200 hover:border-stone-900 rounded-2xl py-4 flex flex-col items-center gap-2 transition-colors">
              <span className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-base font-bold">W</span>
              <span className="text-xs tracking-wider uppercase text-stone-700">WhatsApp</span>
            </a>
            <a href={emailHref}
              className="bg-white border border-stone-200 hover:border-stone-900 rounded-2xl py-4 flex flex-col items-center gap-2 transition-colors">
              <span className="w-9 h-9 rounded-full bg-stone-100 text-stone-700 flex items-center justify-center">@</span>
              <span className="text-xs tracking-wider uppercase text-stone-700">Email</span>
            </a>
          </div>

          <div>
            <label className="block text-[10px] tracking-widest uppercase text-stone-500 mb-2">Or copy the link</label>
            <div className="flex gap-2">
              <input
                ref={inputRef}
                value={url}
                readOnly
                onFocus={(e) => { e.target.select(); e.target.setSelectionRange?.(0, url.length); }}
                className="flex-1 min-w-0 px-3 py-3 bg-white border border-stone-200 rounded-xl text-xs text-stone-700 outline-none font-mono"
              />
              <button onClick={tryCopy}
                className={`px-4 py-3 rounded-xl text-xs tracking-wider uppercase font-medium transition-colors shrink-0 ${
                  copied ? 'bg-emerald-600 text-white' : 'bg-stone-900 text-white hover:bg-stone-800'
                }`}>
                {copied ? 'Copied ✓' : 'Copy'}
              </button>
            </div>
            <p className="text-[10px] text-stone-400 mt-2 leading-relaxed">Tip: tap the URL above to select, then long-press → Copy if the button doesn't work in your browser.</p>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

// Tiny name-this-lookbook prompt. Submit → onCreate(name); cancel closes.
function LookbookNamerModal({ count, busy, onCancel, onCreate }) {
  useEscapeKey(onCancel);
  const [name, setName] = useState('');
  const submit = (e) => { e?.preventDefault?.(); if (busy) return; onCreate?.(name); };
  return createPortal(
    <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-6" onClick={onCancel}>
      <form onSubmit={submit} className="bg-[#F7F5F2] w-full sm:max-w-md sm:rounded-[2rem] rounded-t-[2rem] overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-stone-200/60 bg-white flex justify-between items-center">
          <h3 className="text-xl font-display text-stone-900">Create lookbook</h3>
          <button type="button" onClick={onCancel} className="p-2 text-stone-400 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-full transition-colors" aria-label="Cancel">
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-stone-500 text-sm leading-relaxed">
            {count} look{count === 1 ? '' : 's'} will be bundled into a single shareable URL. Anyone with the link can view — no sign-in needed.
          </p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            type="text"
            autoFocus
            placeholder="Lookbook name · e.g. Italy 2026"
            className="w-full px-4 py-3 bg-white border border-stone-200 rounded-xl text-sm focus:border-stone-900 outline-none"
            maxLength={80}
            disabled={busy}
          />
        </div>
        <div className="px-6 pb-6 flex gap-2 justify-end">
          <button type="button" onClick={onCancel} disabled={busy}
            className="px-5 py-3 text-sm text-stone-500 hover:text-stone-900 rounded-full">Cancel</button>
          <button type="submit" disabled={busy}
            className="px-6 py-3 rounded-full bg-stone-900 text-white text-sm font-medium hover:bg-stone-800 disabled:opacity-50 flex items-center gap-2">
            {busy ? 'Creating…' : 'Create & copy link'}
          </button>
        </div>
      </form>
    </div>,
    document.body
  );
}

function PackingListModal({ startISO, endISO, schedules, outfits, items, onClose }) {
  useEscapeKey(onClose);
  const startLabel = new Date(startISO + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const endLabel = new Date(endISO + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const dayCount = Math.floor((new Date(endISO) - new Date(startISO)) / 86_400_000) + 1;

  // Walk every day in range, collect scheduled outfits, expand to pieces,
  // dedupe by item id, group by category.
  const dayList = [];
  const seen = new Map();
  for (let i = 0; i < dayCount; i++) {
    const d = new Date(startISO + 'T00:00:00');
    d.setDate(d.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    const sched = schedules[iso];
    const outfit = sched ? outfits.find((o) => o.id === sched.outfitId) : null;
    const pieces = outfit ? resolveOutfitItems(outfit, items) : [];
    dayList.push({ iso, label: d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' }), outfit, pieces });
    for (const p of pieces) {
      if (!seen.has(p.id)) seen.set(p.id, { item: p, days: [] });
      seen.get(p.id).days.push(iso);
    }
  }
  const byCategory = {};
  for (const { item, days } of seen.values()) {
    const cat = item.category || 'Other';
    (byCategory[cat] = byCategory[cat] || []).push({ item, days });
  }
  const categoryOrder = ['Tops', 'Dresses', 'Bottoms', 'Outerwear', 'Shoes', 'Bags', 'Accessories', 'Jewellery', 'Other'];
  const orderedCategories = Object.keys(byCategory).sort((a, b) => categoryOrder.indexOf(a) - categoryOrder.indexOf(b));
  const totalPieces = seen.size;

  return createPortal(
    <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-6 print:bg-white print:relative print:p-0" onClick={onClose}>
      <div className="bg-[#F7F5F2] w-full sm:max-w-2xl sm:rounded-[2rem] rounded-t-[2rem] overflow-hidden shadow-2xl flex flex-col max-h-[92vh] print:max-h-none print:rounded-none print:shadow-none print:bg-white" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start px-5 sm:px-8 py-5 border-b border-stone-200/60 bg-white shrink-0 print:border-0">
          <div>
            <p className="text-[10px] tracking-widest uppercase text-stone-500">Packing list</p>
            <h3 className="font-display text-xl sm:text-2xl text-stone-900 mt-1">{startLabel} → {endLabel}</h3>
            <p className="text-xs text-stone-500 mt-1">{dayCount} day{dayCount === 1 ? '' : 's'} · {totalPieces} piece{totalPieces === 1 ? '' : 's'} to pack</p>
          </div>
          <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-full transition-colors print:hidden">
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>

        <div className="p-5 sm:p-8 flex-1 min-h-0 overflow-y-auto print:overflow-visible print:flex-none">
          {totalPieces === 0 ? (
            <p className="text-stone-500 text-sm italic">No outfits planned in this range yet — go back and plan some looks first.</p>
          ) : (
            <div className="space-y-8">
              {orderedCategories.map((cat) => (
                <div key={cat}>
                  <h4 className="text-[10px] tracking-widest uppercase text-stone-500 mb-3 font-bold">{cat} · {byCategory[cat].length}</h4>
                  <ul className="space-y-2">
                    {byCategory[cat].map(({ item, days }) => (
                      <li key={item.id} className="flex items-center gap-3 py-2 border-b border-stone-200/50 last:border-0">
                        <span className="w-5 h-5 rounded border border-stone-400 shrink-0 print:border-stone-600" aria-hidden></span>
                        <div className="w-10 h-12 rounded-lg overflow-hidden bg-stone-100 shrink-0 print:hidden">
                          {itemImages(item)[0] && <img src={itemImages(item)[0]} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-stone-900 truncate">{item.name}</p>
                          <p className="text-[10px] uppercase tracking-wider text-stone-500 truncate">
                            {item.brand}{days.length > 1 ? ` · for ${days.length} days` : ''}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}

              <div className="pt-6 border-t border-stone-200">
                <h4 className="text-[10px] tracking-widest uppercase text-stone-500 mb-3 font-bold">Day by day</h4>
                <ul className="space-y-2">
                  {dayList.map((d) => (
                    <li key={d.iso} className="flex items-baseline gap-3 text-sm">
                      <span className="text-stone-500 w-20 text-[11px] tracking-wider uppercase shrink-0">{d.label}</span>
                      <span className="text-stone-900">{d.outfit ? d.outfit.name : <span className="text-stone-400 italic">— not planned —</span>}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        <div className="px-5 sm:px-8 py-4 border-t border-stone-200/60 bg-white shrink-0 flex gap-3 justify-end print:hidden">
          <button onClick={onClose} className="text-xs tracking-wider uppercase px-4 py-2 rounded-full text-stone-500 hover:text-stone-900">
            Close
          </button>
          <button onClick={() => window.print()} disabled={totalPieces === 0}
            className="text-xs tracking-wider uppercase px-5 py-2.5 rounded-full bg-stone-900 text-white hover:bg-stone-800 disabled:opacity-40 flex items-center gap-2">
            <Download size={14} strokeWidth={1.5} /> Print / Save PDF
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function SchedulePickerModal({ date, outfits, items, onClose, onPick }) {
  useEscapeKey(onClose);
  const formatted = new Date(date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  if (outfits.length === 0) {
    return createPortal(
      <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6" onClick={onClose}>
        <div className="bg-[#F7F5F2] rounded-[2rem] max-w-sm w-full p-8 text-center" onClick={(e) => e.stopPropagation()}>
          <p className="text-stone-500 text-sm">No saved looks yet — go to <span className="font-medium">Styling Studio → Create</span> to save one, then come back to schedule it.</p>
          <button onClick={onClose} className="mt-6 bg-stone-900 text-white px-6 py-3 rounded-full text-sm font-medium">Got it</button>
        </div>
      </div>,
      document.body
    );
  }
  return createPortal(
    <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-6" onClick={onClose}>
      <div className="bg-[#F7F5F2] w-full sm:max-w-lg sm:rounded-[2rem] rounded-t-[2rem] overflow-hidden shadow-2xl flex flex-col max-h-[92vh]" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center px-4 sm:px-6 py-4 sm:py-5 border-b border-stone-200/60 bg-white shrink-0">
          <div>
            <p className="text-[10px] tracking-widest uppercase text-stone-500">Schedule for</p>
            <h3 className="text-xl font-display font-medium text-stone-900">{formatted}</h3>
          </div>
          <button onClick={onClose} className="p-2 text-stone-400 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-full transition-colors">
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>
        <div className="p-4 sm:p-6 flex-1 min-h-0 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            {outfits.map((outfit) => {
              const pieces = resolveOutfitItems(outfit, items);
              const previewImages = pieces.slice(0, 4).map((it) => itemImages(it)[0]).filter(Boolean);
              return (
                <button key={outfit.id} onClick={() => onPick(outfit.id)} className="text-left group active:scale-[0.97] transition-transform">
                  <div className="aspect-square rounded-2xl overflow-hidden bg-stone-100 smooth-shadow grid grid-cols-2 grid-rows-2 gap-0.5 mb-2 group-hover:smooth-shadow-lg">
                    {previewImages.length === 0 && <div className="col-span-2 row-span-2 flex items-center justify-center text-stone-300"><Shirt size={32} strokeWidth={1} /></div>}
                    {previewImages.map((src, i) => (
                      <div key={i} className={previewImages.length === 1 ? 'col-span-2 row-span-2' : previewImages.length === 2 ? 'col-span-1 row-span-2' : (previewImages.length === 3 && i === 0 ? 'col-span-2 row-span-1' : '')}>
                        <img src={src} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                  <p className="text-xs font-medium text-stone-900 truncate px-1">{outfit.name}</p>
                  <p className="text-[10px] text-stone-500 uppercase tracking-wider px-1">{pieces.length} pieces</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function OutfitDetailView({ outfit, items = [], onClose, onDelete, onDuplicate, onSaveOutfit, onShare, onLogWear, onOpenItem }) {
  const [logVerdict, setLogVerdict] = useState('');
  const [logBusy, setLogBusy] = useState(false);
  const [view, setView] = useState('flatlay'); // 'flatlay' | 'grid'
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const toast = useToast();
  const pieces = resolveOutfitItems(outfit, items);
  const total = pieces.reduce((sum, it) => sum + Number(it.price || 0), 0);
  const wornPhotos = Array.isArray(outfit.wornPhotos) ? outfit.wornPhotos : [];

  const handleAddWornPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !onSaveOutfit) return;
    if (wornPhotos.length >= 6) { toast.show('6 photos max per look', { kind: 'error' }); return; }
    setPhotoBusy(true);
    try {
      const dataUrl = await compressImageToDataUrl(file, { maxWidth: 700, maxBytes: 80_000, enhance: false });
      const next = [...wornPhotos, { date: todayISO(), image: dataUrl }];
      await onSaveOutfit({ ...outfit, wornPhotos: next });
      toast.show('Photo added', { kind: 'success' });
    } catch (err) {
      toast.show(err?.message || 'Could not add photo', { kind: 'error' });
    } finally {
      setPhotoBusy(false);
    }
  };

  const removeWornPhoto = async (idx) => {
    if (!onSaveOutfit) return;
    const next = wornPhotos.filter((_, i) => i !== idx);
    await onSaveOutfit({ ...outfit, wornPhotos: next });
  };
  return (
    <div className="fixed inset-0 bg-[#F7F5F2] z-50 overflow-y-auto overflow-x-hidden animate-in fade-in duration-300">
      <div className="sticky top-0 z-10 bg-[#F7F5F2]/80 backdrop-blur-md border-b border-stone-200/60 pt-safe">
        <div className="max-w-6xl mx-auto flex justify-between items-center p-3 sm:p-4 lg:p-6">
          <button onClick={onClose} className="flex items-center gap-2 pl-2 pr-3 sm:pl-3 sm:pr-4 py-2 rounded-full text-sm text-stone-600 hover:text-stone-900 hover:bg-stone-200/50 transition-colors">
            <ChevronRight size={18} strokeWidth={1.5} className="rotate-180" />
            <span className="hidden sm:inline">Back to Saved Looks</span>
            <span className="sm:hidden">Back</span>
          </button>
          {!confirmDelete ? (
            <div className="flex gap-2">
              {onSaveOutfit && (
                <button
                  onClick={() => onSaveOutfit({ ...outfit, favorite: !outfit.favorite })}
                  className={`p-2.5 rounded-full transition-all active:scale-90 ${
                    outfit.favorite
                      ? 'bg-brass-300 text-stone-900 border border-brass-400'
                      : 'bg-white border border-stone-200 text-stone-400 hover:border-brass-400 hover:text-brass-500'
                  }`}
                  aria-label={outfit.favorite ? 'Remove favourite' : 'Add to favourites'}
                  title={outfit.favorite ? 'Remove favourite' : 'Add to favourites'}
                >
                  <Star size={16} strokeWidth={1.5} className={outfit.favorite ? 'fill-stone-900' : ''} />
                </button>
              )}
              {onShare && (
                <button onClick={onShare}
                  className="p-2.5 sm:px-4 sm:py-2.5 rounded-full text-xs sm:text-sm bg-white border border-stone-200 text-stone-800 hover:border-stone-900 transition-all inline-flex items-center gap-2 whitespace-nowrap"
                  title="Create a read-only link to share this look">
                  <Download size={16} strokeWidth={1.5} className="sm:hidden rotate-180" />
                  <span className="hidden sm:inline">Share</span>
                </button>
              )}
              <button onClick={async () => { await onDuplicate?.(); toast.show('Duplicated · edit anytime', { kind: 'success' }); }}
                className="px-4 py-2.5 rounded-full text-xs sm:text-sm bg-white border border-stone-200 text-stone-800 hover:border-stone-900 transition-all whitespace-nowrap">
                Duplicate
              </button>
              <button onClick={() => setConfirmDelete(true)} className="p-2.5 rounded-full bg-white border border-stone-200 text-stone-400 hover:border-red-300 hover:text-red-600 transition-all" aria-label="Delete look">
                <Trash2 size={16} strokeWidth={1.5} />
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button onClick={async () => { await onDelete(); toast.show('Look deleted', { kind: 'success' }); }} className="px-4 sm:px-5 py-2.5 rounded-full text-xs sm:text-sm bg-red-600 text-white hover:bg-red-700 transition-all whitespace-nowrap">Delete look</button>
              <button onClick={() => setConfirmDelete(false)} className="px-3 sm:px-4 py-2.5 rounded-full text-xs sm:text-sm text-stone-500 hover:text-stone-900 transition-all">Cancel</button>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-12 py-6 sm:py-12">
        <header className="mb-10">
          <p className="text-[11px] font-semibold text-stone-500 tracking-[0.25em] uppercase mb-3">Saved Look</p>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-display text-stone-900">{outfit.name}</h1>
          <p className="text-stone-500 mt-4 text-sm">
            {pieces.length} pieces · total value £{total.toLocaleString()}
            {outfit.intent && <span className="ml-3 text-stone-400">· styled for "{outfit.intent}"</span>}
          </p>
          {outfit.reasoning && (
            <div className="mt-6 bg-stone-900 text-white rounded-2xl p-4 sm:p-5 text-sm leading-relaxed flex items-start gap-3 max-w-3xl">
              <Sparkles size={14} strokeWidth={1.5} className="shrink-0 mt-0.5 text-brass-300" />
              <p className="italic">{outfit.reasoning}</p>
            </div>
          )}

          {onLogWear && (
            <div className="mt-6 bg-white border border-stone-200 rounded-2xl p-5 max-w-3xl">
              <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                <div>
                  <p className="text-[10px] tracking-widest uppercase text-stone-500 font-bold">Wear this look</p>
                  <p className="text-xs text-stone-500 mt-1">Logs every piece in one tap — counts toward each item's wear history.</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  {wornPhotos.length < 6 && (
                    <label className="text-xs tracking-widest uppercase px-4 py-2.5 rounded-full bg-white border border-stone-200 text-stone-800 hover:border-stone-900 transition-colors flex items-center gap-2 cursor-pointer" title="Snap a selfie wearing this look">
                      <Camera size={14} strokeWidth={1.5} /> Snap fit
                      <input type="file" accept="image/*" capture="user" onChange={handleAddWornPhoto} className="hidden" disabled={photoBusy} />
                    </label>
                  )}
                  <button
                    type="button"
                    disabled={logBusy}
                    onClick={async () => {
                      setLogBusy(true);
                      try { await onLogWear(logVerdict); setLogVerdict(''); }
                      finally { setLogBusy(false); }
                    }}
                    className="text-xs tracking-widest uppercase px-5 py-2.5 rounded-full bg-stone-900 text-white hover:bg-stone-800 transition-colors disabled:opacity-40 flex items-center gap-2"
                  >
                    <Calendar size={14} strokeWidth={1.5} /> {logBusy ? 'Logging…' : 'I wore this today'}
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {QUICK_VERDICT_CHIPS.map((c) => (
                  <button key={c} type="button"
                    onClick={() => setLogVerdict((cur) => cur.trim() ? `${cur.trim()}, ${c.toLowerCase()}` : c)}
                    className="text-[10px] tracking-wider uppercase px-2.5 py-1 rounded-full bg-stone-50 border border-stone-200 text-stone-600 hover:border-stone-900 hover:text-stone-900 transition-all">
                    {c}
                  </button>
                ))}
              </div>
              <input
                value={logVerdict}
                onChange={(e) => setLogVerdict(e.target.value)}
                placeholder="Optional verdict — applies to every piece…"
                maxLength={120}
                className="w-full text-sm px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:bg-white focus:border-stone-900 outline-none transition-all"
              />
            </div>
          )}

          {/* Worn photos — actual photos of when you wore this look */}
          <div className="mt-8">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-[10px] font-bold text-stone-500 tracking-[0.2em] uppercase">Wore this · {wornPhotos.length}/6</h2>
              {wornPhotos.length < 6 && (
                <label className="text-[10px] tracking-widest uppercase text-stone-500 hover:text-stone-900 cursor-pointer transition-colors">
                  {photoBusy ? 'Adding…' : '＋ Add photo'}
                  <input type="file" accept="image/*" onChange={handleAddWornPhoto} className="hidden" disabled={photoBusy} />
                </label>
              )}
            </div>
            {wornPhotos.length === 0 ? (
              <p className="text-xs text-stone-400 italic">Snap a photo when you wear this look — track what actually got worn vs styled.</p>
            ) : (
              <div className="flex gap-3 overflow-x-auto hide-scrollbar pb-2">
                {wornPhotos.map((p, i) => (
                  <div key={i} className="flex-none w-24 sm:w-28 group relative">
                    <div className="aspect-[3/4] rounded-xl overflow-hidden bg-stone-100 smooth-shadow">
                      <img src={p.image} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
                    </div>
                    <p className="text-[10px] text-stone-500 mt-1.5 tracking-wider">
                      {new Date(p.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </p>
                    <button onClick={() => removeWornPhoto(i)} className="absolute top-1.5 right-1.5 p-1.5 bg-white/90 backdrop-blur text-stone-400 hover:text-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-md">
                      <X size={11} strokeWidth={2} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </header>

        <div className="flex items-center justify-between mb-4 sm:mb-6 gap-3 flex-wrap">
          <h2 className="text-[10px] font-bold text-stone-500 tracking-[0.2em] uppercase">The Pieces</h2>
          <div className="flex bg-stone-200/50 p-1 rounded-full text-[10px] tracking-wider uppercase">
            <button onClick={() => setView('flatlay')}
              className={`px-3 py-1.5 rounded-full transition-all ${view === 'flatlay' ? 'bg-white text-stone-900 shadow-sm font-medium' : 'text-stone-500 hover:text-stone-800'}`}>
              Flat-lay
            </button>
            <button onClick={() => setView('grid')}
              className={`px-3 py-1.5 rounded-full transition-all ${view === 'grid' ? 'bg-white text-stone-900 shadow-sm font-medium' : 'text-stone-500 hover:text-stone-800'}`}>
              Grid
            </button>
          </div>
        </div>

        {view === 'flatlay' ? (
          <OutfitFlatLay pieces={pieces} onOpenItem={onOpenItem} />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {pieces.map((piece, i) => {
              const openable = !!(onOpenItem && piece.id);
              const Tag = openable ? 'button' : 'div';
              return (
                <Tag
                  key={piece.id || i}
                  {...(openable ? { type: 'button', onClick: () => onOpenItem(piece.id), 'aria-label': `Open ${piece.name}` } : {})}
                  className={`flex flex-col gap-3 text-left ${openable ? 'group cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 rounded-2xl' : ''}`}
                >
                  <div className={`aspect-[3/4] rounded-2xl overflow-hidden bg-stone-100 smooth-shadow ${openable ? 'transition-transform group-hover:scale-[1.02] group-active:scale-[0.98]' : ''}`}>
                    {itemImages(piece)[0] ? (
                      <img src={itemImages(piece)[0]} alt={piece.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-stone-300"><Shirt size={40} strokeWidth={1} /></div>
                    )}
                  </div>
                  <div className="px-1">
                    <p className="text-[10px] font-semibold text-stone-500 tracking-[0.2em] uppercase truncate">{piece.brand}</p>
                    <p className={`font-display text-base text-stone-800 leading-snug ${openable ? 'group-hover:text-brass-600 transition-colors' : ''}`}>{piece.name}</p>
                    <p className="text-xs text-stone-500 mt-1">£{Number(piece.price || 0).toLocaleString()}</p>
                  </div>
                </Tag>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Styled flat-lay: items get deterministic-by-id transforms (rotation, scale,
// vertical offset) so the same outfit always renders identically but each
// look feels uniquely composed. Names render below in a clean list to keep the
// canvas itself uncluttered. Uses category-aware sizing — outerwear larger,
// jewellery smaller — mimicking a real flat-lay arrangement.
function OutfitFlatLay({ pieces, onOpenItem }) {
  // Cheap deterministic hash → pseudo-random number in [0, 1) per piece id.
  const seeded = (id, salt) => {
    let h = 5381;
    const s = `${id || ''}-${salt}`;
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i);
    return (Math.abs(h) % 10000) / 10000;
  };
  const CATEGORY_WEIGHT = { Outerwear: 1.2, Dresses: 1.2, Tops: 1.0, Bottoms: 1.0, Shoes: 0.85, Bags: 0.85, Accessories: 0.7, Jewellery: 0.6, Swimwear: 0.95 };

  // Order: Outerwear, Dresses, Tops, Bottoms, Shoes, Bags, Accessories, Jewellery, Others
  const ORDER = ['Outerwear', 'Dresses', 'Tops', 'Bottoms', 'Shoes', 'Bags', 'Accessories', 'Jewellery', 'Swimwear'];
  const sorted = [...pieces].sort((a, b) => {
    const ai = ORDER.indexOf(a.category); const bi = ORDER.indexOf(b.category);
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
  });

  return (
    <div>
      <div className="relative bg-gradient-to-br from-stone-100 via-stone-50 to-brass-50/30 rounded-[2rem] overflow-hidden border border-brass-300">
        <div className="relative" style={{ height: 'min(70vh, 540px)' }}>
          {sorted.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-stone-300">
              <Shirt size={64} strokeWidth={1} />
            </div>
          )}
          {sorted.map((p, i) => {
            const total = sorted.length;
            const col = (i + 0.5) / total;
            const rotation = (seeded(p.id, 'r') - 0.5) * 12; // -6° to +6°
            const yOffset = (seeded(p.id, 'y') - 0.5) * 30;   // -15px to +15px
            const weight = CATEGORY_WEIGHT[p.category] ?? 1.0;
            const baseSize = total <= 4 ? 38 : total <= 6 ? 30 : 24; // % of container
            const size = baseSize * weight;
            const left = `${col * 100}%`;
            const z = 10 + Math.floor(weight * 10); // outerwear in front
            const openable = !!(onOpenItem && p.id);
            const Tag = openable ? 'button' : 'div';
            return (
              <Tag
                key={p.id || i}
                {...(openable ? { type: 'button', onClick: () => onOpenItem(p.id), 'aria-label': `Open ${p.name}` } : {})}
                className={`absolute ${openable ? 'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brass-500 focus-visible:ring-offset-2 rounded-2xl' : ''}`}
                style={{
                  left,
                  top: '50%',
                  width: `${size}%`,
                  transform: `translate(-50%, calc(-50% + ${yOffset}px)) rotate(${rotation}deg)`,
                  zIndex: z,
                }}
              >
                <div className={`aspect-[3/4] rounded-2xl overflow-hidden bg-white shadow-2xl ring-1 ring-black/5 ${openable ? 'transition-transform hover:scale-[1.05] active:scale-[0.97]' : ''}`}>
                  {itemImages(p)[0] ? (
                    <img src={itemImages(p)[0]} alt={p.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-stone-300"><Shirt size={28} strokeWidth={1} /></div>
                  )}
                </div>
              </Tag>
            );
          })}
        </div>
      </div>

      <ul className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
        {sorted.map((p, i) => {
          const openable = !!(onOpenItem && p.id);
          return (
            <li key={p.id || i} className="border-b border-stone-200/60 last:border-0">
              {openable ? (
                <button
                  type="button"
                  onClick={() => onOpenItem(p.id)}
                  aria-label={`Open ${p.name}`}
                  className="w-full flex items-baseline gap-3 py-2 text-left rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brass-500 hover:bg-stone-100/60 transition-colors group"
                >
                  <span className="text-[10px] tracking-widest uppercase text-stone-400 w-16 shrink-0">{p.category}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-stone-900 truncate group-hover:text-brass-700 transition-colors">{p.name}</p>
                    <p className="text-[10px] tracking-wider uppercase text-stone-500 truncate">{p.brand}</p>
                  </div>
                  <span className="text-xs text-stone-500 shrink-0">£{Number(p.price || 0).toLocaleString()}</span>
                  <ChevronRight size={14} strokeWidth={1.5} className="text-stone-300 shrink-0 group-hover:text-brass-500 transition-colors" />
                </button>
              ) : (
                <div className="flex items-baseline gap-3 py-2">
                  <span className="text-[10px] tracking-widest uppercase text-stone-400 w-16 shrink-0">{p.category}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-stone-900 truncate">{p.name}</p>
                    <p className="text-[10px] tracking-wider uppercase text-stone-500 truncate">{p.brand}</p>
                  </div>
                  <span className="text-xs text-stone-500 shrink-0">£{Number(p.price || 0).toLocaleString()}</span>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// Heuristic gap analysis: counts owned items per category and flags the
// underrepresented ones plus missing season coverage. Returns up to 5 gaps.
function computeWardrobeGaps(ownedItems) {
  const desiredCategories = ['Tops', 'Bottoms', 'Outerwear', 'Shoes', 'Bags', 'Accessories'];
  const counts = Object.fromEntries(desiredCategories.map((c) => [c, 0]));
  for (const item of ownedItems) if (counts[item.category] !== undefined) counts[item.category]++;
  const gaps = [];
  for (const cat of desiredCategories) {
    if (counts[cat] === 0) gaps.push({ kind: 'missing-category', label: `No ${cat.toLowerCase()} yet`, detail: `Even a single piece anchors the rest of the wardrobe.`, priority: 3 });
    else if (counts[cat] < 3) gaps.push({ kind: 'sparse-category', label: `Only ${counts[cat]} ${cat.toLowerCase()}`, detail: `Common rule of thumb is 3+ to give yourself outfit choice.`, priority: 1 });
  }
  // Seasonal coverage of owned outerwear
  const outerwearBySeason = { Spring: 0, Summer: 0, Autumn: 0, Winter: 0 };
  for (const item of ownedItems.filter((i) => i.category === 'Outerwear')) {
    const seasons = itemSeasons(item);
    if (seasons.length === 0) ['Spring', 'Summer', 'Autumn', 'Winter'].forEach((s) => outerwearBySeason[s]++);
    else for (const s of seasons) if (outerwearBySeason[s] !== undefined) outerwearBySeason[s]++;
  }
  for (const [season, n] of Object.entries(outerwearBySeason)) {
    if (n === 0) gaps.push({ kind: 'season-gap', label: `No outerwear for ${season}`, detail: `Wishlist a layer suited to ${season.toLowerCase()} weather.`, priority: 2 });
  }
  return gaps.sort((a, b) => b.priority - a.priority).slice(0, 5);
}

// Gemini-driven gap audit panel. Idle until the user taps Analyse — keeps the
// Insights tab fast on load and avoids a Gemini call every time it mounts.
// Caches the result in component state; the user can re-analyse anytime.
function GapAnalysisPanel({ items, inspirations = [] }) {
  const [state, setState] = useState({ status: 'idle', data: null, error: null });
  const toast = useToast();

  const run = async () => {
    if (!isAIEnabled()) { setState({ status: 'error', data: null, error: 'AI is not configured — add VITE_RECAPTCHA_SITE_KEY + Firebase AI Logic.' }); return; }
    setState({ status: 'running', data: null, error: null });
    try {
      const data = await analyzeWardrobeGapsWithGemini({ items, inspirations });
      setState({ status: 'done', data, error: null });
    } catch (e) {
      setState({ status: 'error', data: null, error: e?.message || 'Analysis failed' });
      toast.show('Gap analysis failed', { kind: 'error' });
    }
  };

  return (
    <div className="bg-white border border-stone-200/60 rounded-[2rem] p-6 md:p-10 smooth-shadow">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <span className="brass-rule" aria-hidden="true"></span>
            <span className="text-[10px] tracking-[0.25em] uppercase text-brass-600 font-medium">AI audit</span>
          </div>
          <h3 className="font-display text-xl md:text-2xl text-stone-900">Gap analysis &amp; recommendations</h3>
          <p className="text-stone-500 text-sm mt-2 leading-relaxed max-w-xl">
            Gemini reviews the shape of your wardrobe — categories, colours, styles, seasons — and tells you what's strong, what's missing, and what would unlock the most outfits.
          </p>
        </div>
        {state.status !== 'running' && (
          <button onClick={run}
            className="text-xs tracking-wider uppercase px-5 py-2.5 rounded-full bg-stone-900 text-white hover:bg-stone-800 transition-colors flex items-center gap-2 shrink-0">
            <Wand2 size={14} strokeWidth={1.5} /> {state.status === 'done' ? 'Re-analyse' : 'Analyse my wardrobe'}
          </button>
        )}
      </div>

      {state.status === 'running' && (
        <div className="mt-6 flex items-center gap-3 text-sm text-stone-600">
          <div className="w-4 h-4 border-2 border-stone-300 border-t-stone-900 rounded-full animate-spin" />
          Reviewing balance across {items.length} pieces…
        </div>
      )}
      {state.status === 'error' && (
        <p className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3 rounded-xl">{state.error}</p>
      )}

      {state.status === 'done' && state.data && (
        <div className="mt-8 grid md:grid-cols-3 gap-6">
          <div>
            <h4 className="text-[10px] tracking-widest uppercase text-emerald-800 font-bold mb-3">Strengths</h4>
            <ul className="space-y-3">
              {(state.data.strengths || []).map((s, i) => (
                <li key={i} className="border-l-2 border-emerald-300 pl-3">
                  <p className="text-sm font-medium text-stone-900">{s.title}</p>
                  <p className="text-xs text-stone-600 mt-1 leading-relaxed">{s.detail}</p>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-[10px] tracking-widest uppercase text-brass-700 font-bold mb-3">Gaps</h4>
            <ul className="space-y-3">
              {(state.data.gaps || []).map((g, i) => (
                <li key={i} className="border-l-2 border-amber-300 pl-3">
                  <p className="text-sm font-medium text-stone-900">{g.title}</p>
                  <p className="text-xs text-stone-600 mt-1 leading-relaxed">{g.detail}</p>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-[10px] tracking-widest uppercase text-stone-700 font-bold mb-3">Buy next</h4>
            <ul className="space-y-3">
              {(state.data.recommendations || []).map((r, i) => (
                <li key={i} className="border-l-2 border-stone-400 pl-3">
                  <p className="text-sm font-medium text-stone-900">{r.piece}</p>
                  <p className="text-xs text-stone-600 mt-1 leading-relaxed">{r.why}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function FinanceView({ items, inspirations = [], onJumpToWardrobe }) {
  const ownedItems = items.filter(i => i.status === 'owned');
  const wishlistItems = items.filter(i => i.status === 'wishlist');
  const ownedTotal = ownedItems.reduce((sum, i) => sum + i.price, 0);
  const wishlistTotal = wishlistItems.reduce((sum, i) => sum + i.price, 0);
  const categoryBreakdown = ownedItems.reduce((acc, item) => { acc[item.category] = (acc[item.category] || 0) + item.price; return acc; }, {});

  // Cost-per-wear leaderboard: best value (lowest CPW), only items actually worn
  const bestCpw = ownedItems
    .map((i) => ({ ...i, _cpw: itemCostPerWear(i), _wears: itemWearCount(i) }))
    .filter((i) => i._cpw !== null && i._wears > 0)
    .sort((a, b) => a._cpw - b._cpw)
    .slice(0, 5);

  // Most worn
  const mostWorn = ownedItems
    .map((i) => ({ ...i, _wears: itemWearCount(i) }))
    .filter((i) => i._wears > 0)
    .sort((a, b) => b._wears - a._wears)
    .slice(0, 5);

  // Stale items: owned, not worn in 90+ days (or never)
  const stale = ownedItems
    .map((i) => ({ ...i, _days: daysSinceLastWorn(i) }))
    .filter((i) => i._days === null || i._days >= 90)
    .sort((a, b) => (b._days ?? Infinity) - (a._days ?? Infinity))
    .slice(0, 6);

  // Worst value: owned 6+ months, priced > £50, low or zero wear. Sorted by
  // "wasted spend" (price ÷ max(wears, 1)) so a £400 unworn coat beats a
  // £60 dress worn twice. Cap the surface to 5 — this is sensitive feedback.
  const sixMonthsAgo = Date.now() - 180 * 86_400_000;
  const worstValue = ownedItems
    .map((i) => ({ ...i, _wears: itemWearCount(i), _cpw: itemCostPerWear(i) }))
    .filter((i) => i.price > 50 && i.createdAt && new Date(i.createdAt).getTime() < sixMonthsAgo)
    .map((i) => ({ ...i, _waste: i.price / Math.max(i._wears, 1) }))
    .sort((a, b) => b._waste - a._waste)
    .slice(0, 5);

  const totalWears = ownedItems.reduce((sum, i) => sum + itemWearCount(i), 0);
  const wornPieces = ownedItems.filter((i) => itemWearCount(i) > 0).length;
  const gaps = computeWardrobeGaps(ownedItems);

  // Wear timeline: counts per month for the last 12 months
  const now = new Date();
  const timeline = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    timeline.push({ ym, label: d.toLocaleDateString('en-GB', { month: 'short' }), count: 0 });
  }
  for (const item of ownedItems) {
    for (const d of itemWearHistory(item)) {
      const ym = d.slice(0, 7);
      const entry = timeline.find((t) => t.ym === ym);
      if (entry) entry.count++;
    }
  }
  const maxBar = Math.max(1, ...timeline.map((t) => t.count));

  // Wardrobe colour profile — count colour-family occurrences across owned items.
  const colorCounts = {};
  for (const item of ownedItems) {
    for (const c of itemColors(item)) colorCounts[c] = (colorCounts[c] || 0) + 1;
  }
  const sortedColors = Object.entries(colorCounts).sort((a, b) => b[1] - a[1]);
  const colorTotal = sortedColors.reduce((s, [, n]) => s + n, 0);
  const taggedItemsCount = ownedItems.filter((i) => itemColors(i).length > 0).length;

  return (
    <div className="space-y-10 md:space-y-12 max-w-5xl">
      <EditorialHeader eyebrow="The Ledger" title="Insights" subtitle="Value, wear data, and gaps across your collection." />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-stone-900 text-white p-10 rounded-[2rem] shadow-2xl relative overflow-hidden">
          <div className="absolute -right-6 -bottom-6 opacity-5 rotate-12"><PoundSterling size={240} strokeWidth={1} /></div>
          <p className="text-stone-400 text-xs font-semibold tracking-[0.2em] uppercase mb-4 relative z-10">Current Archive Value</p>
          <h3 className="text-6xl font-display relative z-10 font-medium">£{ownedTotal.toLocaleString()}</h3>
          <p className="text-sm text-stone-400 mt-8 relative z-10 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-stone-500"></span>
            Across {ownedItems.length} curated items
          </p>
        </div>

        {/* Wishlist Target — clickable. Jumps to Wardrobe filtered to wishlist. */}
        <button
          onClick={() => onJumpToWardrobe?.({ filter: 'wishlist' })}
          disabled={!onJumpToWardrobe || wishlistItems.length === 0}
          className="text-left bg-white border border-stone-200/60 p-10 rounded-[2rem] smooth-shadow transition-all enabled:hover:border-stone-900 enabled:hover:-translate-y-0.5 enabled:active:scale-[0.99] disabled:cursor-default group"
        >
          <div className="flex items-baseline justify-between gap-3 mb-4">
            <p className="text-stone-500 text-xs font-semibold tracking-[0.2em] uppercase">Wishlist Target</p>
            {wishlistItems.length > 0 && (
              <span className="text-[10px] tracking-widest uppercase text-stone-400 group-hover:text-stone-900 transition-colors inline-flex items-center gap-1">
                View <ChevronRight size={12} strokeWidth={1.5} />
              </span>
            )}
          </div>
          <h3 className="text-5xl font-display text-stone-900">£{wishlistTotal.toLocaleString()}</h3>
          <p className="text-sm text-stone-500 mt-8 flex items-center gap-2">
            <Heart size={14} className="text-stone-400" />
            {wishlistItems.length} items desired
          </p>
        </button>
      </div>

      <div className="bg-white border border-stone-200/60 rounded-[2rem] p-10 smooth-shadow">
        <div className="flex items-baseline justify-between gap-3 mb-8 flex-wrap">
          <h3 className="font-display text-2xl text-stone-900">Investment by Category</h3>
          {Object.keys(categoryBreakdown).length > 0 && onJumpToWardrobe && (
            <span className="text-[10px] tracking-widest uppercase text-stone-400">Tap a row to view in your wardrobe</span>
          )}
        </div>
        <div className="space-y-4">
          {Object.entries(categoryBreakdown).map(([category, value]) => {
            const percentage = ownedTotal > 0 ? (value / ownedTotal) * 100 : 0;
            const clickable = !!onJumpToWardrobe;
            const RowTag = clickable ? 'button' : 'div';
            return (
              <RowTag
                key={category}
                {...(clickable ? { type: 'button', onClick: () => onJumpToWardrobe({ filter: 'all', category }), 'aria-label': `View ${category} in wardrobe` } : {})}
                className={`group block w-full text-left rounded-xl p-3 -mx-3 transition-colors ${clickable ? 'hover:bg-stone-50 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-900' : ''}`}
              >
                <div className="flex justify-between items-baseline text-sm mb-2 gap-3">
                  <span className={`font-medium tracking-wide uppercase text-xs transition-colors ${clickable ? 'text-stone-700 group-hover:text-stone-900' : 'text-stone-800'}`}>{category}</span>
                  <span className="text-stone-500 shrink-0">
                    £{value.toLocaleString()} <span className="text-stone-300 ml-2">({percentage.toFixed(0)}%)</span>
                    {clickable && <ChevronRight size={12} strokeWidth={1.5} className="inline-block ml-1.5 -mt-0.5 text-stone-300 group-hover:text-stone-700 transition-colors" />}
                  </span>
                </div>
                <div className="w-full bg-stone-100 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-stone-900 h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${percentage}%` }}></div>
                </div>
              </RowTag>
            );
          })}
          {Object.keys(categoryBreakdown).length === 0 && <p className="text-stone-400 italic">No items owned yet.</p>}
        </div>
      </div>

      {sortedColors.length > 0 && (
        <div className="bg-white border border-stone-200/60 rounded-[2rem] p-6 md:p-10 smooth-shadow">
          <div className="flex items-baseline justify-between mb-6 flex-wrap gap-2">
            <h3 className="font-display text-xl md:text-2xl text-stone-900">Colour profile</h3>
            <span className="text-[10px] tracking-widest uppercase text-stone-500">
              {taggedItemsCount} of {ownedItems.length} pieces tagged
            </span>
          </div>

          {/* Stacked horizontal bar — visual ratio of every colour family at a glance */}
          <div className="flex h-10 rounded-full overflow-hidden mb-8 border border-stone-200/60">
            {sortedColors.map(([color, count]) => {
              const pct = colorTotal > 0 ? (count / colorTotal) * 100 : 0;
              const swatch = COLOR_SWATCHES[color];
              return (
                <div key={color} title={`${color} · ${pct.toFixed(0)}%`}
                  style={{
                    width: `${pct}%`,
                    background: swatch?.startsWith('linear') ? swatch : swatch,
                  }} />
              );
            })}
          </div>

          {/* Top 8 colours as a labeled list */}
          <div className="space-y-3">
            {sortedColors.slice(0, 8).map(([color, count]) => {
              const pct = colorTotal > 0 ? (count / colorTotal) * 100 : 0;
              const swatch = COLOR_SWATCHES[color];
              return (
                <div key={color}>
                  <div className="flex justify-between items-center text-sm mb-1.5">
                    <span className="flex items-center gap-2 font-medium text-stone-800">
                      <span className="w-3 h-3 rounded-full border border-stone-300/60"
                        style={swatch?.startsWith('linear') ? { background: swatch } : { backgroundColor: swatch }} />
                      {color}
                    </span>
                    <span className="text-stone-500 text-xs">
                      {count} {count === 1 ? 'piece' : 'pieces'} <span className="text-stone-300 ml-2">{pct.toFixed(0)}%</span>
                    </span>
                  </div>
                  <div className="w-full bg-stone-100 rounded-full h-1.5 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-1000 ease-out"
                      style={{
                        width: `${pct}%`,
                        background: swatch?.startsWith('linear') ? swatch : swatch,
                      }} />
                  </div>
                </div>
              );
            })}
          </div>

          {taggedItemsCount < ownedItems.length && (
            <p className="text-[11px] text-stone-400 mt-6 italic">
              {ownedItems.length - taggedItemsCount} item{ownedItems.length - taggedItemsCount === 1 ? '' : 's'} without colour tags — open them and save to auto-detect colours from photos.
            </p>
          )}
        </div>
      )}

      {totalWears > 0 && (
        <div className="bg-white border border-stone-200/60 rounded-[2rem] p-6 md:p-10 smooth-shadow">
          <div className="flex items-baseline justify-between mb-6 flex-wrap gap-2">
            <h3 className="font-display text-xl md:text-2xl text-stone-900">Wears over time</h3>
            <span className="text-[10px] tracking-widest uppercase text-stone-500">Last 12 months</span>
          </div>
          <div className="flex items-end justify-between gap-1.5 h-32 sm:h-40">
            {timeline.map((t) => (
              <div key={t.ym} className="flex-1 flex flex-col items-center gap-2 min-w-0 group">
                <span className="text-[9px] text-stone-400 opacity-0 group-hover:opacity-100 transition-opacity">{t.count}</span>
                <div className="w-full flex flex-col justify-end h-full">
                  <div className={`w-full rounded-t transition-all duration-500 ${t.count > 0 ? 'bg-stone-900' : 'bg-stone-100'}`}
                    style={{ height: `${(t.count / maxBar) * 100}%`, minHeight: t.count > 0 ? '4px' : '4px' }}
                    title={`${t.count} wear${t.count === 1 ? '' : 's'}`} />
                </div>
                <span className="text-[10px] text-stone-500 tracking-wider">{t.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
        <div className="bg-white border border-stone-200/60 rounded-2xl p-5 smooth-shadow">
          <p className="text-[10px] uppercase tracking-[0.2em] text-stone-500 font-semibold">Total wears</p>
          <p className="font-display text-3xl md:text-4xl text-stone-900 mt-2">{totalWears}</p>
          <p className="text-xs text-stone-500 mt-1">across all owned items</p>
        </div>
        <div className="bg-white border border-stone-200/60 rounded-2xl p-5 smooth-shadow">
          <p className="text-[10px] uppercase tracking-[0.2em] text-stone-500 font-semibold">Items in rotation</p>
          <p className="font-display text-3xl md:text-4xl text-stone-900 mt-2">{wornPieces}<span className="text-stone-300 text-xl"> / {ownedItems.length}</span></p>
          <p className="text-xs text-stone-500 mt-1">pieces worn at least once</p>
        </div>
        <div className="bg-white border border-stone-200/60 rounded-2xl p-5 smooth-shadow">
          <p className="text-[10px] uppercase tracking-[0.2em] text-stone-500 font-semibold">Stale (90+ days)</p>
          <p className="font-display text-3xl md:text-4xl text-stone-900 mt-2">{stale.length}</p>
          <p className="text-xs text-stone-500 mt-1">filterable in the wardrobe</p>
        </div>
      </div>

      {bestCpw.length > 0 && (
        <div className="bg-white border border-stone-200/60 rounded-[2rem] p-6 md:p-10 smooth-shadow">
          <div className="flex items-baseline justify-between mb-6 flex-wrap gap-2">
            <h3 className="font-display text-xl md:text-2xl text-stone-900">Best value · cost per wear</h3>
            <TrendingDown size={18} className="text-stone-400" />
          </div>
          <div className="space-y-4">
            {bestCpw.map((item, idx) => (
              <div key={item.id} className="flex items-center gap-4">
                <span className="font-display text-stone-300 text-xl w-6 text-right">{idx + 1}</span>
                <div className="w-12 h-16 rounded-lg overflow-hidden bg-stone-100 shrink-0">
                  {itemImages(item)[0] && <img src={itemImages(item)[0]} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-stone-900 truncate">{item.name}</p>
                  <p className="text-[10px] uppercase tracking-wider text-stone-500 mt-0.5 truncate">{item.brand} · {item._wears} {item._wears === 1 ? 'wear' : 'wears'}</p>
                </div>
                <p className="font-display text-lg text-stone-900 whitespace-nowrap">£{item._cpw < 10 ? item._cpw.toFixed(2) : Math.round(item._cpw)}<span className="text-stone-400 text-xs">/wear</span></p>
              </div>
            ))}
          </div>
        </div>
      )}

      {worstValue.length > 0 && (
        <div className="bg-white border border-stone-200/60 rounded-[2rem] p-6 md:p-10 smooth-shadow">
          <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
            <h3 className="font-display text-xl md:text-2xl text-stone-900">Worst value · still paying for these</h3>
            <span className="text-[10px] uppercase tracking-widest text-stone-400">Owned 6+ months</span>
          </div>
          <p className="text-stone-500 text-xs mb-6">High-spend pieces with little wear so far — fair game for restyling, re-selling, or returning to rotation.</p>
          <div className="space-y-4">
            {worstValue.map((item, idx) => (
              <div key={item.id} className="flex items-center gap-4">
                <span className="font-display text-stone-300 text-xl w-6 text-right">{idx + 1}</span>
                <div className="w-12 h-16 rounded-lg overflow-hidden bg-stone-100 shrink-0">
                  {itemImages(item)[0] && <img src={itemImages(item)[0]} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-stone-900 truncate">{item.name}</p>
                  <p className="text-[10px] uppercase tracking-wider text-stone-500 mt-0.5 truncate">
                    {item.brand} · {item._wears === 0 ? 'never worn' : `${item._wears} ${item._wears === 1 ? 'wear' : 'wears'}`} · £{item.price}
                  </p>
                </div>
                <p className="font-display text-lg text-stone-900 whitespace-nowrap">
                  {item._cpw === null
                    ? <span className="text-stone-400">unworn</span>
                    : <>£{item._cpw < 10 ? item._cpw.toFixed(2) : Math.round(item._cpw)}<span className="text-stone-400 text-xs">/wear</span></>}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {mostWorn.length > 0 && (
        <div className="bg-white border border-stone-200/60 rounded-[2rem] p-6 md:p-10 smooth-shadow">
          <h3 className="font-display text-xl md:text-2xl text-stone-900 mb-6">Most worn</h3>
          <div className="space-y-4">
            {mostWorn.map((item, idx) => (
              <div key={item.id} className="flex items-center gap-4">
                <span className="font-display text-stone-300 text-xl w-6 text-right">{idx + 1}</span>
                <div className="w-12 h-16 rounded-lg overflow-hidden bg-stone-100 shrink-0">
                  {itemImages(item)[0] && <img src={itemImages(item)[0]} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-stone-900 truncate">{item.name}</p>
                  <p className="text-[10px] uppercase tracking-wider text-stone-500 mt-0.5 truncate">{item.brand}</p>
                </div>
                <p className="font-display text-lg text-stone-900 whitespace-nowrap">{item._wears}<span className="text-stone-400 text-xs"> wears</span></p>
              </div>
            ))}
          </div>
        </div>
      )}

      <GapAnalysisPanel items={ownedItems} inspirations={inspirations} />

      {gaps.length > 0 && (
        <div className="bg-stone-900 text-white rounded-[2rem] p-6 md:p-10">
          <h3 className="font-display text-xl md:text-2xl mb-2">Wardrobe gaps</h3>
          <p className="text-stone-400 text-sm mb-6">Where your collection is thin. Grounded in your data, not Instagram's.</p>
          <ul className="space-y-4">
            {gaps.map((gap, i) => (
              <li key={i} className="flex gap-4 border-t border-stone-800 pt-4 first:border-t-0 first:pt-0">
                <span className="font-display text-stone-500 text-xl w-6">{i + 1}</span>
                <div className="flex-1">
                  <p className="font-medium text-stone-100">{gap.label}</p>
                  <p className="text-xs text-stone-400 mt-1 leading-relaxed">{gap.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {stale.length > 0 && (
        <div className="bg-white border border-stone-200/60 rounded-[2rem] p-6 md:p-10 smooth-shadow">
          <h3 className="font-display text-xl md:text-2xl text-stone-900 mb-2">Stale — wear or part with?</h3>
          <p className="text-stone-500 text-sm mb-6">Owned items not worn in 90+ days. Wear deliberately this week, or move on.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {stale.map((item) => (
              <div key={item.id} className="flex flex-col gap-2">
                <div className="aspect-[3/4] rounded-xl overflow-hidden bg-stone-100">
                  {itemImages(item)[0] && <img src={itemImages(item)[0]} alt={item.name} className="w-full h-full object-cover" loading="lazy" />}
                </div>
                <p className="text-xs text-stone-900 truncate">{item.name}</p>
                <p className="text-[10px] uppercase tracking-wider text-stone-400">
                  {item._days === null ? 'Never worn' : `${item._days}d ago`}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Style manifesto card — Gemini-written 3-paragraph aesthetic brief from the
// user's actual wear history. Cached on the profile doc. User regenerates when
// they feel their taste has shifted.
// Complete-my-data backfill: scan the wardrobe for items missing key fields
// (category set to generic "Tops" with no other tags, or no colour, or no
// material), re-analyse the main photo via Gemini Vision, and fill the gaps.
// One-tap enrichment for sparse legacy items.
function BackfillCard({ items = [], shops = [], onUpdateItem }) {
  const [stage, setStage] = useState('idle'); // idle | running | done
  const [progress, setProgress] = useState({ done: 0, total: 0, updated: 0 });
  const toast = useToast();

  const isSparse = (i) => {
    const hasImage = (Array.isArray(i.images) && i.images.length > 0) || i.image;
    if (!hasImage) return false; // can't analyse without a photo
    const noColours = !Array.isArray(i.colors) || i.colors.length === 0;
    const noMaterials = !Array.isArray(i.materials) || i.materials.length === 0;
    const noStyles = !Array.isArray(i.styles) || i.styles.length === 0;
    return noColours || noMaterials || noStyles;
  };
  const candidates = items.filter(isSparse);

  const run = async () => {
    if (!isAIEnabled() || candidates.length === 0) return;
    setStage('running');
    setProgress({ done: 0, total: candidates.length, updated: 0 });
    const knownBrands = Array.from(new Set((shops || []).map((s) => s.name).filter(Boolean)));
    let updated = 0;
    for (const it of candidates) {
      try {
        const src = (Array.isArray(it.images) ? it.images : [it.image]).filter(Boolean)[0];
        if (!src) { setProgress((p) => ({ ...p, done: p.done + 1 })); continue; }
        const r = await identifyItemWithGemini({ imageDataUrl: src, knownBrands });
        const validMaterials = (r.materials || []).filter((m) => MATERIALS.includes(m));
        const validColours = (r.colors || []).map((c) => matchColorFamily(c)).filter(Boolean);
        const validStyles = (r.styles || []).filter((s) => STYLES.includes(s));
        const validSeasons = (r.seasons || []).filter((s) => ['Spring', 'Summer', 'Autumn', 'Winter'].includes(s));
        const next = {
          ...it,
          colors: (it.colors && it.colors.length) ? it.colors : validColours,
          materials: (it.materials && it.materials.length) ? it.materials : validMaterials,
          styles: (it.styles && it.styles.length) ? it.styles : validStyles,
          seasons: (it.seasons && it.seasons.length) ? it.seasons : validSeasons,
        };
        await onUpdateItem(next);
        updated++;
      } catch { /* skip failures silently — backfill is best-effort */ }
      setProgress((p) => ({ ...p, done: p.done + 1, updated }));
    }
    setStage('done');
    toast.show(`Backfill complete · ${updated} of ${candidates.length} enriched`, { kind: 'success', duration: 4500 });
  };

  return (
    <div className="bg-white border border-stone-200/60 rounded-[2rem] p-6 md:p-8 smooth-shadow">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <span className="brass-rule" aria-hidden="true"></span>
            <span className="text-[10px] tracking-[0.25em] uppercase text-brass-600 font-medium">Data hygiene</span>
          </div>
          <h3 className="font-display text-xl md:text-2xl text-stone-900">Complete my data</h3>
          <p className="text-stone-500 text-sm mt-2 leading-relaxed max-w-xl">
            {candidates.length === 0
              ? 'Every item has at least one colour, material, and style tagged. Nothing to backfill.'
              : `${candidates.length} item${candidates.length === 1 ? '' : 's'} ${candidates.length === 1 ? 'is' : 'are'} missing colours, materials, or styles. Atelier can analyse each one's photo and fill the gaps — won't overwrite anything you've already set.`}
          </p>
        </div>
        {candidates.length > 0 && stage !== 'running' && (
          <button onClick={run} disabled={!isAIEnabled()}
            className="text-xs tracking-wider uppercase px-5 py-2.5 rounded-full bg-stone-900 text-white hover:bg-stone-800 disabled:opacity-40 flex items-center gap-2 shrink-0">
            <Sparkles size={14} strokeWidth={1.5} /> {stage === 'done' ? 'Run again' : `Enrich ${candidates.length}`}
          </button>
        )}
      </div>

      {stage === 'running' && (
        <div className="mt-4 flex items-center gap-3 text-sm text-stone-600">
          <div className="w-4 h-4 border-2 border-stone-300 border-t-stone-900 rounded-full animate-spin" />
          Analysing {progress.done}/{progress.total} · {progress.updated} enriched so far
        </div>
      )}
    </div>
  );
}

function StyleManifestoCard({ measurements, saveMeasurements, items = [], outfits = [], inspirations = [] }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const toast = useToast();
  const manifesto = measurements?.styleManifesto || '';
  const generatedAt = measurements?.styleManifestoAt || null;

  const run = async () => {
    setBusy(true); setError(null);
    try {
      const text = await generateStyleManifestoWithGemini({ items, outfits, inspirations });
      await saveMeasurements({ ...measurements, styleManifesto: text, styleManifestoAt: new Date().toISOString() });
      toast.show('Manifesto refreshed', { kind: 'success' });
    } catch (e) { setError(e?.message || 'Failed.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="bg-stone-900 text-white rounded-[2rem] p-6 md:p-10 shadow-2xl relative overflow-hidden">
      <div className="absolute -right-10 -bottom-10 opacity-[0.04] pointer-events-none">
        <Sparkles size={220} strokeWidth={0.8} />
      </div>
      <div className="relative z-10 flex items-start justify-between gap-4 flex-wrap mb-2">
        <div className="min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <span className="brass-rule" aria-hidden="true"></span>
            <span className="text-[10px] tracking-[0.25em] uppercase text-brass-300 font-medium">A private brief, by AI</span>
          </div>
          <h3 className="font-display text-2xl md:text-3xl text-white">Style manifesto</h3>
          <p className="text-stone-400 text-sm leading-relaxed max-w-xl mt-3">
            Gemini reads your most-worn pieces, outfit pairings, and saved inspirations — and writes a private three-paragraph brief of your aesthetic. Refresh when your taste shifts.
          </p>
        </div>
        <button onClick={run} disabled={busy} className="text-xs tracking-wider uppercase px-5 py-2.5 rounded-full bg-brass-300 text-stone-900 hover:bg-brass-200 disabled:opacity-40 flex items-center gap-2 shrink-0 font-medium">
          <Wand2 size={14} strokeWidth={1.5} /> {busy ? 'Writing…' : (manifesto ? 'Refresh' : 'Generate')}
        </button>
      </div>

      {error && <p className="relative z-10 mt-4 text-sm text-red-200 bg-red-950/40 border border-red-900/40 px-4 py-3 rounded-xl">{error}</p>}

      {manifesto && (
        <div className="relative z-10 mt-6 bg-[#F7F5F2] text-stone-800 rounded-2xl p-6 sm:p-8 text-sm sm:text-[15px] leading-[1.8] whitespace-pre-line font-display italic">
          {manifesto}
          {generatedAt && (
            <p className="text-[10px] tracking-widest uppercase text-stone-400 mt-5 font-sans not-italic flex items-center gap-3">
              <span className="brass-rule" aria-hidden="true"></span>
              Written {new Date(generatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// Style profile editor card. Compact chip-based UI, no separate quiz modal —
// the choices ARE the quiz. Saving each chip writes immediately so there's no
// "save" friction. Feeds summariseStyleProfile() which goes into Gemini prompts.
function StyleProfileCard({ measurements, saveMeasurements }) {
  const m = measurements || {};
  const set = (key, value) => saveMeasurements({ ...m, [key]: value });
  const togglePrinciple = (p) => {
    const cur = Array.isArray(m.stylePrinciples) ? m.stylePrinciples : [];
    set('stylePrinciples', cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p].slice(0, 3));
  };
  const populated = !!(m.styleUndertone || m.styleSilhouette || m.styleFormality || m.stylePalette);

  const Row = ({ label, options, value, onPick }) => (
    <div>
      <p className="text-[10px] tracking-widest uppercase text-stone-500 font-bold mb-2">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button key={opt} type="button" onClick={() => onPick(value === opt ? '' : opt)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              value === opt ? 'bg-stone-900 border-stone-900 text-white' : 'bg-white border-stone-200 text-stone-700 hover:border-stone-400'
            }`}>
            {opt}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="bg-white border border-stone-200/60 rounded-[2rem] p-6 md:p-8 smooth-shadow">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-2">
        <div className="min-w-0">
          <h3 className="font-display text-xl md:text-2xl text-stone-900">Style profile</h3>
          <p className="text-stone-500 text-sm leading-relaxed max-w-xl mt-2">
            Tell the AI how you actually dress. Every Gemini suggestion (Today tile, Styling Studio, Travel packing) gets sharper when these are set.
          </p>
        </div>
        <span className={`text-[10px] tracking-widest uppercase ${populated ? 'text-emerald-700' : 'text-brass-600'}`}>
          {populated ? 'Active in prompts' : 'Not set yet'}
        </span>
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        <Row label="Skin undertone" options={STYLE_UNDERTONES} value={m.styleUndertone || ''} onPick={(v) => set('styleUndertone', v)} />
        <Row label="Silhouette" options={STYLE_SILHOUETTES} value={m.styleSilhouette || ''} onPick={(v) => set('styleSilhouette', v)} />
        <Row label="Formality default" options={STYLE_FORMALITY} value={m.styleFormality || ''} onPick={(v) => set('styleFormality', v)} />
        <Row label="Seasonal palette" options={STYLE_SEASONS} value={m.stylePalette || ''} onPick={(v) => set('stylePalette', v)} />
      </div>

      <div className="mt-6">
        <p className="text-[10px] tracking-widest uppercase text-stone-500 font-bold mb-2">
          Style principles <span className="font-normal normal-case tracking-normal text-stone-400 ml-1">(pick up to 3)</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {STYLE_PRINCIPLES.map((p) => {
            const active = Array.isArray(m.stylePrinciples) && m.stylePrinciples.includes(p);
            return (
              <button key={p} type="button" onClick={() => togglePrinciple(p)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  active ? 'bg-stone-900 border-stone-900 text-white' : 'bg-white border-stone-200 text-stone-700 hover:border-stone-400'
                }`}>
                {p}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function FitProfileCard({ measurements }) {
  const shape = classifyBodyShape(measurements);
  if (!shape) {
    return (
      <div className="bg-white border border-stone-200/60 rounded-[2rem] p-6 md:p-8 smooth-shadow">
        <h3 className="font-display text-xl md:text-2xl text-stone-900 mb-3">Your Fit Profile</h3>
        <p className="text-stone-500 text-sm leading-relaxed">
          Add your <strong>chest, waist, and hips</strong> below to unlock body-shape-based styling guidance — the same approach M&S, ASOS and Stitch Fix use as the foundation of their fit tools.
        </p>
      </div>
    );
  }
  const guide = BODY_SHAPE_GUIDES[shape];
  return (
    <div className="bg-stone-900 text-white rounded-[2rem] p-6 md:p-10 smooth-shadow">
      <div className="flex items-baseline gap-3 mb-2 flex-wrap">
        <h3 className="font-display text-xl md:text-2xl">Your Fit Profile</h3>
        <span className="text-[10px] uppercase tracking-[0.2em] text-stone-400">Body shape based</span>
      </div>
      <p className="text-4xl md:text-5xl font-display font-medium mt-4 mb-2">{shape}</p>
      <p className="text-stone-300 text-sm leading-relaxed mb-8 max-w-2xl">{guide.blurb}</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h4 className="text-[10px] font-semibold tracking-[0.2em] uppercase text-stone-400 mb-4">Styles that flatter</h4>
          <ul className="space-y-2 text-sm text-stone-100 leading-relaxed">
            {guide.flatter.map((tip) => <li key={tip} className="flex gap-3"><span className="text-stone-500">·</span>{tip}</li>)}
          </ul>
        </div>
        <div>
          <h4 className="text-[10px] font-semibold tracking-[0.2em] uppercase text-stone-400 mb-4">Worth avoiding</h4>
          <ul className="space-y-2 text-sm text-stone-100 leading-relaxed">
            {guide.avoid.map((tip) => <li key={tip} className="flex gap-3"><span className="text-stone-500">·</span>{tip}</li>)}
          </ul>
        </div>
      </div>
      <p className="text-[10px] text-stone-500 mt-8 uppercase tracking-widest">
        General stylist guidance — not a per-item size recommendation. Brand size charts coming next.
      </p>
    </div>
  );
}

// Generate a minimal but spec-compliant .ics file from scheduled outfits.
// Each schedule becomes a 1-day all-day event. The user opens the file in
// Apple Calendar / Google Calendar (import) → events land in a separate
// calendar they can toggle. Includes the outfit name + pieces in description.
function downloadIcs(filename, schedules, outfits, items) {
  const events = [];
  for (const [date, sched] of Object.entries(schedules || {})) {
    if (!sched?.outfitId) continue;
    const outfit = outfits.find((o) => o.id === sched.outfitId);
    if (!outfit) continue;
    const pieces = resolveOutfitItems(outfit, items).map((p) => `${p.name} (${p.brand || '?'})`).join('\\, ');
    const d = date.replace(/-/g, '');
    const next = new Date(date + 'T00:00:00'); next.setDate(next.getDate() + 1);
    const dEnd = next.toISOString().slice(0, 10).replace(/-/g, '');
    const uid = `atelier-${sched.outfitId}-${date}@my-digital-wardrobe`;
    const stamp = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';
    events.push([
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${d}`,
      `DTEND;VALUE=DATE:${dEnd}`,
      `SUMMARY:👗 ${outfit.name}`,
      `DESCRIPTION:${pieces || 'Planned outfit'}\\n— from Atelier`,
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
    ].join('\r\n'));
  }
  const cal = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Atelier//Digital Wardrobe//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Atelier · Planned outfits',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n');
  const blob = new Blob([cal], { type: 'text/calendar' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 100);
}

function downloadJson(filename, payload) {
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 100);
}

function ProfileView({ user, measurements, saveMeasurements, isOwner, allowlist, addInvite, removeInvite, items, deletedItems = [], outfits, inspirations = [], shops, onRestoreItem, onHardDeleteItem, onUpdateItem }) {
  const currency = measurements?.currency || 'GBP';
  const aiTempPreset = measurements?.aiTemperaturePreset || 'balanced';
  const setCurrency = (v) => saveMeasurements({ ...measurements, currency: v });
  const setAITempPreset = (v) => saveMeasurements({ ...measurements, aiTemperaturePreset: v });
  const [localMeasurements, setLocalMeasurements] = useState(measurements || INITIAL_MEASUREMENTS);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState(null);

  useEffect(() => { if (measurements) setLocalMeasurements({ ...INITIAL_MEASUREMENTS, ...measurements }); }, [measurements]);
  const handleChange = (e) => setLocalMeasurements({ ...localMeasurements, [e.target.name]: e.target.value });

  const handleInviteSubmit = async (e) => {
    e.preventDefault();
    setInviteBusy(true); setInviteError(null);
    try {
      await addInvite(inviteEmail, inviteName);
      setInviteEmail(''); setInviteName('');
    } catch (err) {
      setInviteError(err?.message || 'Could not add invite.');
    } finally {
      setInviteBusy(false);
    }
  };

  return (
    <div className="space-y-12 max-w-3xl">
      <EditorialHeader eyebrow="Your atelier" title="Profile" subtitle="Account, measurements, style, and preferences." />

      {user && (
        <div className="bg-white border border-stone-200/60 rounded-[2rem] p-6 md:p-8 smooth-shadow flex items-center gap-5">
          {user.photoURL ? (
            <img src={user.photoURL} alt="" className="w-16 h-16 rounded-full ring-2 ring-stone-100" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-stone-900 text-white flex items-center justify-center font-display text-2xl">
              {(user.displayName || user.email || '?').charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="font-display text-xl text-stone-900 truncate">{user.displayName || 'Signed in'}</p>
            <p className="text-stone-500 text-xs tracking-wide mt-1 truncate">{user.email}</p>
          </div>
          <button onClick={signOutUser} className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl border border-stone-200 text-stone-600 hover:border-stone-400 hover:text-stone-900 text-xs tracking-wide transition-colors">
            <LogOut size={14} strokeWidth={1.5} /> Sign out
          </button>
        </div>
      )}

      {isOwner && (
        <div className="bg-white border border-stone-200/60 rounded-[2rem] p-8 md:p-10 smooth-shadow">
          <div className="flex items-baseline justify-between mb-6">
            <h3 className="font-display text-2xl text-stone-900">Invited Friends</h3>
            <span className="text-xs text-stone-400 tracking-widest uppercase">{allowlist.length} {allowlist.length === 1 ? 'person' : 'people'}</span>
          </div>
          <p className="text-stone-500 text-sm leading-relaxed mb-8">
            Add someone's Google email to give them access. They'll get their own private wardrobe inside this app — they won't see yours, you won't see theirs.
          </p>

          <form onSubmit={handleInviteSubmit} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end mb-8">
            <div className="sm:col-span-5">
              <Input label="Google email" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="friend@gmail.com" required />
            </div>
            <div className="sm:col-span-4">
              <Input label="Name (optional)" type="text" value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Anna" />
            </div>
            <div className="sm:col-span-3">
              <button type="submit" disabled={inviteBusy} className="w-full bg-stone-900 text-white py-3 rounded-xl font-medium hover:bg-stone-800 transition-all disabled:opacity-50">
                {inviteBusy ? 'Adding…' : 'Invite'}
              </button>
            </div>
            {inviteError && <p className="sm:col-span-12 text-xs text-red-700">{inviteError}</p>}
          </form>

          <div className="space-y-2">
            {allowlist.length === 0 && (
              <p className="text-stone-400 italic text-sm py-6 text-center border border-dashed border-stone-200 rounded-2xl">
                No invited friends yet. Owners ({OWNER_EMAILS.join(', ')}) always have access.
              </p>
            )}
            {allowlist.map((entry) => (
              <div key={entry.email} className="flex items-center justify-between py-3 px-4 bg-stone-50 border border-stone-200/60 rounded-xl group">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-stone-900 truncate">{entry.displayName || entry.email}</p>
                  {entry.displayName && <p className="text-[10px] text-stone-500 uppercase tracking-wider mt-0.5 truncate">{entry.email}</p>}
                </div>
                <button onClick={() => removeInvite(entry.email).catch((e) => alert(e.message))}
                  className="text-stone-300 hover:text-red-500 p-2 rounded-full hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                  aria-label={`Revoke access for ${entry.email}`}
                >
                  <X size={16} strokeWidth={1.5} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white border border-stone-200/60 rounded-[2rem] p-6 md:p-8 smooth-shadow">
        <h3 className="font-display text-xl md:text-2xl text-stone-900 mb-6">Settings</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-[10px] tracking-widest font-semibold text-stone-500 uppercase mb-2">Currency</label>
            <div className="flex flex-wrap gap-2">
              {['GBP', 'USD', 'EUR'].map((c) => (
                <button key={c} onClick={() => setCurrency(c)}
                  className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                    currency === c ? 'bg-stone-900 border-stone-900 text-white' : 'bg-white border-stone-200 text-stone-700 hover:border-stone-400'
                  }`}>
                  {CURRENCY_SYMBOLS[c]} {c}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-stone-400 mt-2">Display only — existing prices keep their numbers.</p>
          </div>

          <div>
            <label className="block text-[10px] tracking-widest font-semibold text-stone-500 uppercase mb-2">AI styling temperament</label>
            <div className="flex flex-wrap gap-2">
              {[
                { v: 'safe', label: 'Safe', sub: 'Consistent' },
                { v: 'balanced', label: 'Balanced', sub: 'Default' },
                { v: 'surprise', label: 'Surprise', sub: 'Adventurous' },
              ].map((p) => (
                <button key={p.v} onClick={() => setAITempPreset(p.v)}
                  className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all border text-left ${
                    aiTempPreset === p.v ? 'bg-stone-900 border-stone-900 text-white' : 'bg-white border-stone-200 text-stone-700 hover:border-stone-400'
                  }`}>
                  <div>{p.label}</div>
                  <div className={`text-[10px] mt-0.5 ${aiTempPreset === p.v ? 'text-stone-300' : 'text-stone-400'}`}>{p.sub}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <StyleProfileCard measurements={measurements} saveMeasurements={saveMeasurements} />
      <StyleManifestoCard measurements={measurements} saveMeasurements={saveMeasurements} items={items} outfits={outfits} inspirations={inspirations} />

      <div className="bg-white border border-stone-200/60 rounded-[2rem] p-6 md:p-8 smooth-shadow">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <h3 className="font-display text-xl md:text-2xl text-stone-900 mb-2">Photo cutouts <span className="text-[10px] tracking-widest uppercase text-brass-600 ml-2 align-middle">Beta</span></h3>
            <p className="text-stone-500 text-sm leading-relaxed max-w-xl">
              Auto-remove the background from item photos so pieces sit on a clean transparent surface. Heavy in-browser model — first use will be slow while it downloads (~5MB). If anything fails, the original photo is kept.
            </p>
          </div>
          <label className="inline-flex items-center gap-3 cursor-pointer shrink-0">
            <span className="text-xs tracking-widest uppercase text-stone-500">{measurements?.removeBackground ? 'On' : 'Off'}</span>
            <input type="checkbox" className="sr-only peer"
              checked={!!measurements?.removeBackground}
              onChange={(e) => saveMeasurements({ ...measurements, removeBackground: e.target.checked })} />
            <span className="w-11 h-6 bg-stone-200 rounded-full peer-checked:bg-stone-900 relative transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-transform peer-checked:after:translate-x-5"></span>
          </label>
        </div>
      </div>

      <FitProfileCard measurements={measurements} />

      <BackfillCard items={items} shops={shops} onUpdateItem={onUpdateItem} />

      <div className="bg-white border border-stone-200/60 rounded-[2rem] p-6 md:p-8 smooth-shadow">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <h3 className="font-display text-xl md:text-2xl text-stone-900 mb-2">Backup &amp; export</h3>
            <p className="text-stone-500 text-sm leading-relaxed max-w-xl">
              Download your entire wardrobe — items, photos, outfits, shops, size charts, measurements — as a single JSON file. Portable to any database, future-proof against vendor changes.
            </p>
          </div>
          <button onClick={() => downloadJson(
            `atelier-wardrobe-${todayISO()}.json`,
            { exportedAt: new Date().toISOString(), version: 1, user: { email: user?.email, displayName: user?.displayName }, measurements, items, outfits, shops }
          )} className="bg-stone-900 text-white px-5 py-3 rounded-full font-medium text-sm flex items-center gap-2 hover:bg-stone-800 transition-all shadow-lg shrink-0">
            <Download size={16} strokeWidth={1.5} /> Download backup
          </button>
        </div>
      </div>

      {deletedItems.length > 0 && (
        <div className="bg-white border border-stone-200/60 rounded-[2rem] p-6 md:p-8 smooth-shadow">
          <div className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
            <h3 className="font-display text-xl md:text-2xl text-stone-900">Trash</h3>
            <span className="text-[10px] tracking-widest uppercase text-stone-500">{deletedItems.length} item{deletedItems.length === 1 ? '' : 's'}</span>
          </div>
          <p className="text-stone-500 text-sm mb-6">Deleted items live here for 30 days. Restore anything, or remove forever.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {deletedItems.map((item) => {
              const days = item.deletedAt ? Math.floor((Date.now() - new Date(item.deletedAt).getTime()) / 86_400_000) : 0;
              return (
                <div key={item.id} className="flex flex-col gap-2">
                  <div className="aspect-[3/4] rounded-xl overflow-hidden bg-stone-100 opacity-60">
                    {itemImages(item)[0] && <img src={itemImages(item)[0]} alt={item.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />}
                  </div>
                  <p className="text-xs text-stone-900 truncate">{item.name}</p>
                  <p className="text-[10px] uppercase tracking-wider text-stone-400">Deleted {days}d ago</p>
                  <div className="flex gap-1">
                    <button onClick={() => onRestoreItem?.(item.id)} className="flex-1 px-2 py-1.5 text-[10px] tracking-widest uppercase rounded-full bg-stone-900 text-white hover:bg-stone-800 transition-colors">
                      Restore
                    </button>
                    <button onClick={() => onHardDeleteItem?.(item.id)} className="px-2 py-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors" title="Delete forever">
                      <X size={12} strokeWidth={2} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="bg-white border border-stone-200/60 rounded-[2rem] p-6 md:p-12 smooth-shadow">
        <div className="bg-stone-50 border border-stone-200 text-stone-600 p-5 rounded-2xl text-sm flex gap-4 mb-10 leading-relaxed">
          <AlertCircle className="shrink-0 mt-0.5 text-stone-900" size={20} strokeWidth={1.5} />
          <p>Recording your measurements here makes it quick to <strong>cross-check brand size charts</strong> before buying anything on your wishlist. Stored privately under your account.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
          {[
            { id: 'height', label: 'Height (cm)' }, { id: 'weight', label: 'Weight (kg)' },
            { id: 'chest', label: 'Chest (cm)' }, { id: 'waist', label: 'Waist (cm)' },
            { id: 'hips', label: 'Hips (cm)' }, { id: 'shoeSize', label: 'Shoe Size (EU)' },
          ].map(field => (
            <div key={field.id} className="relative">
              <label className="block text-[10px] tracking-widest font-semibold text-stone-500 uppercase mb-2 ml-1">{field.label}</label>
              <input type="number" name={field.id} value={localMeasurements[field.id] || ''} onChange={handleChange}
                className="w-full px-5 py-4 bg-stone-50 border border-stone-200 rounded-xl focus:bg-white focus:border-stone-900 outline-none transition-all text-stone-900"
              />
            </div>
          ))}
        </div>

        <div className="mt-12 pt-8 border-t border-stone-100 flex justify-end">
          <button onClick={() => saveMeasurements(localMeasurements)} className="bg-stone-900 text-white px-8 py-4 rounded-xl font-medium flex items-center gap-3 hover:bg-stone-800 transition-all shadow-lg hover:shadow-xl">
            <Save size={18} strokeWidth={1.5} /> Update Profile
          </button>
        </div>
      </div>
    </div>
  );
}

function ShopRow({ shop, saveShop, deleteShop }) {
  const [editingChart, setEditingChart] = useState(false);
  const [rows, setRows] = useState(shop.sizes || []);
  const chartCount = (shop.sizes || []).length;

  const updateRow = (i, field, value) => setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  const addRow = () => setRows((prev) => [...prev, { label: '', bust: '', waist: '', hips: '' }]);
  const removeRow = (i) => setRows((prev) => prev.filter((_, idx) => idx !== i));
  const saveChart = async () => {
    const cleaned = rows.filter((r) => r.label?.trim()).map((r) => ({
      label: r.label.trim(),
      bust: r.bust ? Number(r.bust) : null,
      waist: r.waist ? Number(r.waist) : null,
      hips: r.hips ? Number(r.hips) : null,
    }));
    await saveShop({ ...shop, sizes: cleaned });
    setEditingChart(false);
  };

  return (
    <div className="bg-white border border-stone-200/60 rounded-2xl p-6 hover:shadow-lg transition-all group duration-300">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h4 className="font-display text-xl text-stone-900">{shop.name}</h4>
          <div className="flex items-center gap-4 mt-2 flex-wrap">
            <a href={shop.url} target="_blank" rel="noopener noreferrer" className="text-xs tracking-wider uppercase font-semibold text-stone-500 hover:text-stone-900 transition-colors flex items-center gap-1.5">
              <LinkIcon size={12} strokeWidth={2} /> Visit Store
            </a>
            {shop.category && (<>
              <span className="w-1 h-1 rounded-full bg-stone-300"></span>
              <span className="text-stone-500 text-xs tracking-widest uppercase">{shop.category}</span>
            </>)}
            {chartCount > 0 && (<>
              <span className="w-1 h-1 rounded-full bg-stone-300"></span>
              <span className="text-emerald-700 text-xs tracking-widest uppercase font-medium">{chartCount} sizes</span>
            </>)}
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <button onClick={() => { setRows(shop.sizes || []); setEditingChart((v) => !v); }}
            className="px-3 py-2 rounded-full text-xs tracking-widest uppercase text-stone-500 hover:bg-stone-100 hover:text-stone-900 transition-colors"
          >
            {editingChart ? 'Cancel' : 'Sizes'}
          </button>
          <button onClick={() => deleteShop(shop.id)} className="text-stone-300 hover:text-red-500 p-2 rounded-full hover:bg-red-50 transition-colors">
            <Trash2 size={16} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {editingChart && (
        <div className="mt-6 pt-6 border-t border-stone-100">
          <div className="flex items-baseline justify-between mb-4">
            <p className="text-[10px] font-bold text-stone-500 tracking-[0.2em] uppercase">Size Chart (cm)</p>
            <p className="text-[10px] text-stone-400">Enter what you can — partial rows are fine.</p>
          </div>
          <div className="hidden sm:grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 mb-2 text-[10px] tracking-widest uppercase text-stone-400 font-semibold">
            <span>Size</span><span>Bust</span><span>Waist</span><span>Hips</span><span></span>
          </div>
          <div className="space-y-3 sm:space-y-2">
            {rows.map((row, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 items-center">
                <input value={row.label || ''} onChange={(e) => updateRow(i, 'label', e.target.value)} placeholder="Size" aria-label="Size label" className="min-w-0 px-2 sm:px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:border-stone-900 outline-none transition-colors" />
                <input value={row.bust || ''} onChange={(e) => updateRow(i, 'bust', e.target.value)} placeholder="Bust" aria-label="Bust cm" type="number" inputMode="decimal" className="min-w-0 px-2 sm:px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:border-stone-900 outline-none transition-colors" />
                <input value={row.waist || ''} onChange={(e) => updateRow(i, 'waist', e.target.value)} placeholder="Waist" aria-label="Waist cm" type="number" inputMode="decimal" className="min-w-0 px-2 sm:px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:border-stone-900 outline-none transition-colors" />
                <input value={row.hips || ''} onChange={(e) => updateRow(i, 'hips', e.target.value)} placeholder="Hips" aria-label="Hips cm" type="number" inputMode="decimal" className="min-w-0 px-2 sm:px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-sm focus:border-stone-900 outline-none transition-colors" />
                <button onClick={() => removeRow(i)} className="text-stone-300 hover:text-red-500 p-2 rounded-full hover:bg-red-50 transition-colors"><X size={14} strokeWidth={1.5} /></button>
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={addRow} className="flex-1 px-4 py-3 rounded-xl text-sm bg-white border border-dashed border-stone-300 text-stone-500 hover:border-stone-900 hover:text-stone-900 transition-all flex items-center justify-center gap-2">
              <Plus size={14} strokeWidth={1.5} /> Add size row
            </button>
            <button onClick={saveChart} className="px-6 py-3 rounded-xl text-sm bg-stone-900 text-white hover:bg-stone-800 transition-all font-medium">
              Save chart
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ShoppingDirectory({ shops, saveShop, deleteShop }) {
  const [newShop, setNewShop] = useState({ name: '', url: '', category: '' });
  const [restoring, setRestoring] = useState(false);

  const existingShopNames = new Set(shops.map((s) => (s.name || '').toLowerCase()));
  const missingPresets = SHOP_SEEDS.filter((s) => !existingShopNames.has(s.name.toLowerCase()));

  const addShop = async (e) => {
    e.preventDefault();
    if (!newShop.name || !newShop.url) return;
    const id = newId();
    await saveShop({ ...newShop, id });
    setNewShop({ name: '', url: '', category: '' });
  };

  const restorePresets = async () => {
    setRestoring(true);
    try {
      for (const preset of missingPresets) {
        const id = newId();
        await saveShop({ ...preset, id });
      }
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="space-y-12 max-w-5xl">
      <EditorialHeader
        eyebrow="Curated houses"
        title="Directory"
        subtitle="Your trusted designers and boutiques."
        right={missingPresets.length > 0 ? (
          <button onClick={restorePresets} disabled={restoring}
            className="bg-white border border-stone-300 text-stone-800 px-5 py-3 rounded-full text-xs tracking-widest uppercase font-medium hover:border-stone-900 transition-all disabled:opacity-50"
          >
            {restoring ? 'Adding…' : `Add ${missingPresets.length} preset ${missingPresets.length === 1 ? 'brand' : 'brands'}`}
          </button>
        ) : null}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-5">
          <div className="bg-white border border-stone-200/60 rounded-[2rem] p-8 smooth-shadow sticky top-8">
            <h3 className="font-display text-2xl mb-6 text-stone-900">Add Boutique</h3>
            <form onSubmit={addShop} className="space-y-5">
              <Input label="Boutique Name" value={newShop.name} onChange={e => setNewShop({...newShop, name: e.target.value})} type="text" required />
              <Input label="Website Link" value={newShop.url} onChange={e => setNewShop({...newShop, url: e.target.value})} type="url" placeholder="https://" required />
              <Input label="Aesthetic / Category" value={newShop.category} onChange={e => setNewShop({...newShop, category: e.target.value})} type="text" placeholder="e.g. Minimalist Basics" />
              <button type="submit" className="w-full bg-stone-900 text-white py-4 rounded-xl font-medium hover:bg-stone-800 transition-all mt-4">Save to Directory</button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-7 grid gap-4 align-top content-start">
          {shops.map(shop => (
            <ShopRow key={shop.id} shop={shop} saveShop={saveShop} deleteShop={deleteShop} />
          ))}
          {shops.length === 0 && <p className="text-stone-400 italic text-center py-10 border border-dashed border-stone-300 rounded-2xl">No boutiques added yet.</p>}
        </div>
      </div>
    </div>
  );
}

// Quick verdict on today's wear — chips for common reactions plus free-text.
// Debounces saves so typing doesn't write to Firestore on every keystroke.
const QUICK_VERDICT_CHIPS = ['Felt great', 'Too warm', 'Too cold', 'Restyle', 'Waistband loose', 'Compliments'];
function WearVerdictInput({ initial, onSave }) {
  const [text, setText] = useState(initial || '');
  const [saved, setSaved] = useState(!!initial);
  const lastSentRef = React.useRef(initial || '');

  useEffect(() => { setText(initial || ''); lastSentRef.current = initial || ''; }, [initial]);
  useEffect(() => {
    if (text === lastSentRef.current) return;
    const t = setTimeout(() => {
      lastSentRef.current = text;
      onSave?.(text);
      setSaved(true);
    }, 600);
    return () => clearTimeout(t);
  }, [text, onSave]);

  const addChip = (c) => {
    setSaved(false);
    setText((cur) => cur.trim() ? `${cur.trim()}, ${c.toLowerCase()}` : c);
  };

  return (
    <div className="mt-4 pt-4 border-t border-stone-100">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-[10px] tracking-widest uppercase text-stone-500">Today's verdict <span className="text-stone-400 normal-case tracking-normal">(optional)</span></p>
        {saved && text && <span className="text-[10px] text-emerald-700 tracking-wider uppercase">Saved</span>}
      </div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {QUICK_VERDICT_CHIPS.map((c) => (
          <button key={c} type="button" onClick={() => addChip(c)}
            className="text-[10px] tracking-wider uppercase px-2.5 py-1 rounded-full bg-stone-50 border border-stone-200 text-stone-600 hover:border-stone-900 hover:text-stone-900 transition-all">
            {c}
          </button>
        ))}
      </div>
      <input
        type="text"
        value={text}
        onChange={(e) => { setSaved(false); setText(e.target.value); }}
        placeholder="e.g. felt great, restyle next time…"
        className="w-full text-sm px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg focus:bg-white focus:border-stone-900 outline-none transition-all text-stone-900 placeholder:text-stone-400"
        maxLength={120}
      />
    </div>
  );
}

// One-time prompt to install Atelier as a PWA. Two paths:
//   - Chrome/Edge/Android: the browser fires `beforeinstallprompt`; we capture
//     the event and trigger the native prompt on tap.
//   - iOS Safari: no event exists. We sniff (iPhone/iPad + Safari + not in
//     standalone mode) and show the manual Share → Add to Home Screen guide.
// Dismissal persists in localStorage so the user never sees it twice.
// Public read-only viewer for a shared outfit. Reads /public/{shareId}; no auth
// required. Self-contained — uses only the embedded snapshot, no further reads.
function PublicShareView({ shareId }) {
  const [state, setState] = useState({ status: 'loading', data: null });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const d = await getDoc(publicShareDoc(shareId));
        if (cancelled) return;
        if (!d.exists()) { setState({ status: 'not-found', data: null }); return; }
        setState({ status: 'ok', data: d.data() });
      } catch (e) {
        if (!cancelled) setState({ status: 'error', data: null, error: e?.message });
      }
    })();
    return () => { cancelled = true; };
  }, [shareId]);

  if (state.status === 'loading') return <FullScreenLoader label="Loading shared look" />;
  if (state.status === 'not-found') {
    return (
      <div className="min-h-screen bg-[#F7F5F2] flex items-center justify-center p-6">
        <div className="bg-white border border-stone-200 rounded-[2rem] p-10 max-w-md text-center smooth-shadow">
          <Shirt size={48} strokeWidth={1} className="mx-auto text-stone-300 mb-4" />
          <h1 className="font-display text-2xl text-stone-900">Look unavailable</h1>
          <p className="text-stone-500 text-sm mt-2">This share link has expired or was removed.</p>
          <a href="/" className="inline-block mt-6 text-xs tracking-widest uppercase text-stone-500 hover:text-stone-900">Visit Atelier</a>
        </div>
      </div>
    );
  }
  if (state.status === 'error') {
    return (
      <div className="min-h-screen bg-[#F7F5F2] flex items-center justify-center p-6">
        <p className="text-sm text-red-700">{state.error || 'Could not load this look.'}</p>
      </div>
    );
  }

  const { kind, name, reasoning, sharedByName, sharedAt, pieces = [], looks = [] } = state.data;
  const sharedDate = sharedAt ? new Date(sharedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  const isLookbook = kind === 'lookbook';
  const isItem = kind === 'item';

  // Dedicated single-item view — when a wishlist piece is shared for opinions.
  if (isItem) {
    const data = state.data;
    const itemImages = Array.isArray(data.images) ? data.images : [];
    return (
      <div className="min-h-screen bg-[#F7F5F2] font-sans text-stone-900">
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Jost:wght@300;400;500;600&family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400&display=swap');
          .font-display { font-family: 'Playfair Display', serif; }
          .font-sans { font-family: 'Jost', sans-serif; }
          .smooth-shadow { box-shadow: 0 10px 40px -10px rgba(0,0,0,0.08); }
        `}</style>
        <header className="border-b border-stone-200/60 bg-white">
          <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AtelierMark size={36} />
              <span className="font-display text-2xl">Atelier.</span>
            </div>
            <a href="/" className="text-[10px] tracking-widest uppercase text-stone-500 hover:text-stone-900">Visit</a>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-6 py-10 sm:py-16">
          <p className="text-[10px] font-semibold text-stone-500 tracking-[0.25em] uppercase mb-3">
            {data.status === 'wishlist' ? 'Wishlist · ' : ''}Shared by {sharedByName || 'a friend'}{sharedDate ? ` · ${sharedDate}` : ''}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 mt-6">
            <div className="space-y-3">
              <div className="aspect-[3/4] rounded-3xl bg-stone-100 overflow-hidden smooth-shadow border border-brass-300">
                {itemImages[0] ? (
                  <img src={itemImages[0]} alt={name} className="w-full h-full object-contain" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-stone-300"><Shirt size={64} strokeWidth={1} /></div>
                )}
              </div>
              {itemImages.length > 1 && (
                <div className="grid grid-cols-3 gap-2">
                  {itemImages.slice(1).map((img, i) => (
                    <div key={i} className="aspect-square rounded-xl overflow-hidden bg-stone-100">
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              {data.brand && <p className="text-xs font-semibold text-stone-500 tracking-[0.25em] uppercase mb-3">{data.brand}</p>}
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-display text-stone-900 leading-tight">{name}</h1>
              <div className="flex items-center gap-3 mt-5 flex-wrap">
                {data.price > 0 && <p className="text-2xl font-display font-medium">£{Number(data.price).toLocaleString()}</p>}
                {data.status === 'wishlist' && (
                  <span className="text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-full font-medium bg-stone-100 text-stone-900 inline-flex items-center gap-1.5">
                    <Heart size={12} className="fill-stone-900" strokeWidth={0} /> Wishlist
                  </span>
                )}
              </div>

              {data.wishlistReason && (
                <p className="mt-6 text-stone-700 italic leading-relaxed bg-white border border-stone-200/60 rounded-2xl p-4">"{data.wishlistReason}"</p>
              )}

              <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5 text-sm">
                {data.category && <div><p className="text-[10px] font-bold text-stone-500 tracking-[0.2em] uppercase mb-1">Category</p><p>{data.category}{data.subCategory ? ` · ${data.subCategory}` : ''}</p></div>}
                {Array.isArray(data.colors) && data.colors.length > 0 && <div><p className="text-[10px] font-bold text-stone-500 tracking-[0.2em] uppercase mb-1">Colours</p><p>{data.colors.join(' · ')}</p></div>}
                {Array.isArray(data.materials) && data.materials.length > 0 && <div><p className="text-[10px] font-bold text-stone-500 tracking-[0.2em] uppercase mb-1">Materials</p><p>{data.materials.join(' · ')}</p></div>}
                {Array.isArray(data.seasons) && data.seasons.length > 0 && <div><p className="text-[10px] font-bold text-stone-500 tracking-[0.2em] uppercase mb-1">Seasons</p><p>{data.seasons.join(' · ')}</p></div>}
              </div>

              {data.description && (
                <div className="mt-8">
                  <p className="text-[10px] font-bold text-stone-500 tracking-[0.2em] uppercase mb-2">About</p>
                  <p className="text-stone-700 leading-relaxed text-sm whitespace-pre-wrap">{data.description}</p>
                </div>
              )}

              {data.sourceUrl && (
                <a href={data.sourceUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 mt-8 text-sm text-stone-900 underline decoration-stone-300 underline-offset-4 hover:decoration-stone-900 transition-colors break-all">
                  <LinkIcon size={14} strokeWidth={1.5} />
                  View at source
                </a>
              )}
            </div>
          </div>
          <footer className="mt-20 pt-8 border-t border-stone-200 text-center text-xs tracking-wider uppercase text-stone-400">
            Read-only view · made with Atelier
          </footer>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F7F5F2] font-sans text-stone-900">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Jost:wght@300;400;500;600&family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400&display=swap');
        .font-display { font-family: 'Playfair Display', serif; }
        .font-sans { font-family: 'Jost', sans-serif; }
        .smooth-shadow { box-shadow: 0 10px 40px -10px rgba(0,0,0,0.08); }
      `}</style>

      <header className="border-b border-stone-200/60 bg-white">
        <div className="max-w-5xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AtelierMark size={36} />
            <span className="font-display text-2xl">Atelier.</span>
          </div>
          <a href="/" className="text-[10px] tracking-widest uppercase text-stone-500 hover:text-stone-900">Visit</a>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12 sm:py-16">
        <p className="text-[10px] font-semibold text-stone-500 tracking-[0.25em] uppercase mb-3">
          {isLookbook ? 'Lookbook · ' : ''}Shared by {sharedByName || 'a friend'}{sharedDate ? ` · ${sharedDate}` : ''}
        </p>
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-display text-stone-900">{name || (isLookbook ? 'A lookbook' : 'A look')}</h1>
        {reasoning && (
          <p className="mt-4 text-stone-600 italic max-w-2xl leading-relaxed">"{reasoning}"</p>
        )}

        {isLookbook ? (
          <div className="mt-10">
            <nav className="flex flex-wrap gap-2 mb-12 sticky top-2 z-10 bg-[#F7F5F2]/80 backdrop-blur-md py-2 -mx-2 px-2 rounded-xl">
              {looks.map((l, i) => (
                <a key={l.id || i} href={`#look-${i}`}
                  className="text-[10px] tracking-widest uppercase px-3 py-1.5 rounded-full bg-white border border-stone-200 text-stone-600 hover:border-stone-900 hover:text-stone-900 transition-colors">
                  {i + 1}. {l.name}
                </a>
              ))}
            </nav>
            <div className="space-y-20">
              {looks.map((l, i) => (
                <section key={l.id || i} id={`look-${i}`} className="scroll-mt-24">
                  <div className="flex items-baseline justify-between gap-3 flex-wrap mb-2">
                    <h2 className="font-display text-2xl sm:text-3xl text-stone-900">{l.name}</h2>
                    <span className="text-[10px] tracking-widest uppercase text-stone-400">{(l.pieces || []).length} pieces</span>
                  </div>
                  {l.reasoning && <p className="text-stone-600 italic max-w-2xl mb-6 leading-relaxed">"{l.reasoning}"</p>}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {(l.pieces || []).map((p) => (
                      <div key={p.id} className="flex flex-col gap-3">
                        <div className="aspect-[3/4] rounded-2xl bg-stone-100 overflow-hidden smooth-shadow">
                          {(p.images || [])[0] ? (
                            <img src={p.images[0]} alt={p.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-stone-300"><Shirt size={32} strokeWidth={1} /></div>
                          )}
                        </div>
                        <div className="px-1">
                          <p className="text-[10px] font-semibold text-stone-500 tracking-[0.2em] uppercase truncate">{p.brand}</p>
                          <p className="font-display text-base text-stone-800 leading-snug mt-1">{p.name}</p>
                          <p className="text-xs text-stone-500 mt-1">{p.category}{p.subCategory ? ` · ${p.subCategory}` : ''}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        ) : (
          <div className="mt-10 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {pieces.map((p) => (
              <div key={p.id} className="flex flex-col gap-3">
                <div className="aspect-[3/4] rounded-2xl bg-stone-100 overflow-hidden smooth-shadow">
                  {(p.images || [])[0] ? (
                    <img src={p.images[0]} alt={p.name} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-stone-300"><Shirt size={32} strokeWidth={1} /></div>
                  )}
                </div>
                <div className="px-1">
                  <p className="text-[10px] font-semibold text-stone-500 tracking-[0.2em] uppercase truncate">{p.brand}</p>
                  <p className="font-display text-base text-stone-800 leading-snug mt-1">{p.name}</p>
                  <p className="text-xs text-stone-500 mt-1">{p.category}{p.subCategory ? ` · ${p.subCategory}` : ''}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <footer className="mt-20 pt-8 border-t border-stone-200 text-center text-xs tracking-wider uppercase text-stone-400">
          Read-only view · made with Atelier
        </footer>
      </main>
    </div>
  );
}

// "Notify-on-open" — without a backend we can't deliver true background push.
// On each app open: if Notifications are granted, fire OS notifications for
// items the user genuinely should know about right now (planned outfit for
// tomorrow, care reminders due, stale favourites). Throttled to once per kind
// per day via localStorage to avoid spamming. The user can permission once.
function NotificationManager({ items, outfits, schedules }) {
  const [showAsk, setShowAsk] = useState(false);

  useEffect(() => {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'default') {
      // Offer the permission prompt once the user has some content
      const dismissed = localStorage.getItem('atelier-notif-asked') === '1';
      if (items.length > 2 && !dismissed) setShowAsk(true);
    } else if (Notification.permission === 'granted') {
      maybeFireOpenNotifications({ items, outfits, schedules });
    }
  }, [items.length, outfits.length, Object.keys(schedules || {}).length]);

  const requestPermission = async () => {
    try {
      const result = await Notification.requestPermission();
      localStorage.setItem('atelier-notif-asked', '1');
      setShowAsk(false);
      if (result === 'granted') maybeFireOpenNotifications({ items, outfits, schedules });
    } catch { setShowAsk(false); }
  };
  const dismiss = () => { localStorage.setItem('atelier-notif-asked', '1'); setShowAsk(false); };

  if (!showAsk) return null;
  return createPortal(
    <div className="fixed left-0 right-0 z-[55] flex justify-center px-4 pointer-events-none"
         style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 168px)' }}>
      <div className="pointer-events-auto bg-white border border-stone-200 rounded-2xl shadow-2xl max-w-sm w-full p-4 flex gap-3 items-start">
        <div className="w-9 h-9 rounded-xl bg-amber-100 text-brass-600 flex items-center justify-center shrink-0">
          <Sparkles size={16} strokeWidth={1.5} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-stone-900">Reminders?</p>
          <p className="text-[11px] text-stone-500 mt-0.5 leading-relaxed">
            Get a heads-up about tomorrow's planned outfit and care reminders the next time you open Atelier.
          </p>
          <div className="flex gap-2 mt-2">
            <button onClick={requestPermission} className="text-[10px] tracking-wider uppercase px-3 py-1.5 rounded-full bg-stone-900 text-white">
              Enable
            </button>
            <button onClick={dismiss} className="text-[10px] tracking-wider uppercase px-3 py-1.5 rounded-full text-stone-500 hover:text-stone-900">
              Not now
            </button>
          </div>
        </div>
        <button onClick={dismiss} className="text-stone-400 hover:text-stone-900 shrink-0" aria-label="Dismiss">
          <X size={14} strokeWidth={1.5} />
        </button>
      </div>
    </div>,
    document.body
  );
}

// Fires OS-level notifications once per kind per day. No backend; works as long
// as Notifications API permission is 'granted' AND the page has been opened.
function maybeFireOpenNotifications({ items, outfits, schedules }) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const todayKey = `atelier-notif-fired-${new Date().toISOString().slice(0, 10)}`;
  let fired;
  try { fired = JSON.parse(localStorage.getItem(todayKey) || '{}'); } catch { fired = {}; }
  const mark = (key) => { fired[key] = 1; localStorage.setItem(todayKey, JSON.stringify(fired)); };

  // 1) Tomorrow's planned outfit
  if (!fired['tomorrow-plan']) {
    const tomorrow = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); })();
    const sched = schedules?.[tomorrow];
    const outfit = sched?.outfitId ? outfits.find((o) => o.id === sched.outfitId) : null;
    if (outfit) {
      new Notification("Tomorrow's look · Atelier", {
        body: `${outfit.name} is planned. Lay it out tonight.`,
        tag: 'atelier-tomorrow',
        icon: '/icon.svg',
      });
      mark('tomorrow-plan');
    }
  }

  // 2) Care due
  if (!fired['care']) {
    const dueCare = (items || [])
      .filter((i) => i.status === 'owned')
      .map((i) => ({ i, r: itemCareReminder(i) }))
      .filter((x) => x.r?.due);
    if (dueCare.length > 0) {
      const example = dueCare[0];
      new Notification('Care reminder · Atelier', {
        body: dueCare.length === 1
          ? `${example.i.name}: ${example.r.action}.`
          : `${dueCare.length} pieces are due care — including ${example.i.name}.`,
        tag: 'atelier-care',
        icon: '/icon.svg',
      });
      mark('care');
    }
  }

  // 3) Stale favourite (haven't worn in 30+ days)
  if (!fired['stale-fav']) {
    const staleFav = (items || []).find((i) => {
      if (!i.favorite || i.status !== 'owned') return false;
      const d = daysSinceLastWorn(i);
      return d === null || d >= 30;
    });
    if (staleFav) {
      const d = daysSinceLastWorn(staleFav);
      new Notification('Bring it back · Atelier', {
        body: `${staleFav.name} is a favourite but ${d === null ? "hasn't been worn yet" : `hasn't been worn in ${d} days`}.`,
        tag: 'atelier-stale',
        icon: '/icon.svg',
      });
      mark('stale-fav');
    }
  }
}

// 4-screen first-run walkthrough. Shown once, persisted via localStorage flag.
// "Show me" links jump the user to the relevant tab and dismiss the tour.
const ONBOARD_STEPS = [
  { title: 'Build your wardrobe', body: 'Add pieces by photo, by pasting a product link, by scanning a care label, or by importing a receipt. Tag colours, materials and styles so the AI gets sharper over time.', cta: 'Add an item', target: 'wardrobe' },
  { title: 'Style with AI', body: 'In the Styling Studio, drag pieces into slots or let Gemini compose a look for an intent ("dinner date", "office day"). A/B compare two suggestions, refine in plain English, save the winner.', cta: 'Open Styling Studio', target: 'outfits' },
  { title: 'Plan, pack, and wear', body: 'Use the Calendar to schedule outfits per day, switch to range mode to plan a trip, and generate a deduped packing list. Log wears in one tap; the data feeds Insights.', cta: 'See the calendar', target: 'outfits' },
  { title: 'Insights & gaps', body: 'Best/worst cost-per-wear, your most-worn pieces, what your wardrobe is missing. Tap "Analyse my wardrobe" for a Gemini-written audit of strengths and gaps.', cta: 'Open Insights', target: 'insights' },
];
function OnboardingTour({ onJumpTo }) {
  const [step, setStep] = useState(() => {
    try { return localStorage.getItem('atelier-onboard-done') === '1' ? -1 : 0; }
    catch { return -1; }
  });
  if (step < 0 || step >= ONBOARD_STEPS.length) return null;
  const s = ONBOARD_STEPS[step];
  const last = step === ONBOARD_STEPS.length - 1;
  const finish = () => {
    try { localStorage.setItem('atelier-onboard-done', '1'); } catch { /* noop */ }
    setStep(-1);
  };
  const jump = () => { finish(); onJumpTo?.(s.target); };

  return createPortal(
    <div className="fixed inset-0 z-[80] bg-stone-900/80 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-6">
      <div className="bg-[#F7F5F2] w-full sm:max-w-md sm:rounded-[2rem] rounded-t-[2rem] overflow-hidden shadow-2xl">
        <div className="bg-stone-900 text-white px-6 py-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] tracking-[0.25em] uppercase text-stone-400">Welcome to Atelier</p>
            <span className="text-[10px] tracking-wider uppercase text-stone-400">{step + 1} / {ONBOARD_STEPS.length}</span>
          </div>
          <h3 className="font-display text-2xl">{s.title}</h3>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-stone-700 leading-relaxed">{s.body}</p>
          <div className="flex gap-1.5">
            {ONBOARD_STEPS.map((_, i) => (
              <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-stone-900' : 'bg-stone-200'}`} />
            ))}
          </div>
        </div>
        <div className="px-6 pb-6 flex gap-2 justify-between flex-wrap">
          <button onClick={finish} className="text-xs tracking-widest uppercase text-stone-500 hover:text-stone-900 px-3 py-2">
            Skip
          </button>
          <div className="flex gap-2">
            <button onClick={jump} className="text-xs tracking-widest uppercase px-4 py-2.5 rounded-full bg-white border border-stone-200 text-stone-800 hover:border-stone-900">
              {s.cta} ↗
            </button>
            <button onClick={() => last ? finish() : setStep((s) => s + 1)}
              className="text-xs tracking-widest uppercase px-5 py-2.5 rounded-full bg-stone-900 text-white hover:bg-stone-800">
              {last ? 'Done' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function PwaInstallNudge({ hasContent }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showIos, setShowIos] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      if (localStorage.getItem('atelier-pwa-nudge-dismissed') === '1') return;
    } catch { return; }
    setDismissed(false);

    const ua = navigator.userAgent || '';
    const isIos = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
    const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(ua);
    const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (standalone) return;
    if (isIos && isSafari) setShowIos(true);

    const onBeforeInstall = (e) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  const dismiss = () => {
    try { localStorage.setItem('atelier-pwa-nudge-dismissed', '1'); } catch { /* noop */ }
    setDismissed(true);
  };
  const installNow = async () => {
    if (!deferredPrompt) return;
    try {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
    } finally {
      dismiss();
      setDeferredPrompt(null);
    }
  };

  if (dismissed || !hasContent) return null;
  if (!deferredPrompt && !showIos) return null;

  return createPortal(
    <div className="fixed left-0 right-0 z-[55] flex justify-center px-4 pointer-events-none"
         style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)' }}>
      <div className="pointer-events-auto bg-stone-900 text-white rounded-2xl shadow-2xl max-w-sm w-full p-5 flex gap-4 items-start">
        <div className="w-10 h-10 rounded-xl bg-stone-800 flex items-center justify-center shrink-0">
          <Shirt size={18} strokeWidth={1.5} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">Install Atelier</p>
          {showIos ? (
            <p className="text-xs text-stone-300 mt-1 leading-relaxed">
              Tap the <span className="font-semibold">Share</span> icon, then{' '}
              <span className="font-semibold">Add to Home Screen</span> — opens like a native app.
            </p>
          ) : (
            <p className="text-xs text-stone-300 mt-1 leading-relaxed">
              Add it to your home screen for one-tap access, with offline support.
            </p>
          )}
          <div className="flex gap-2 mt-3">
            {deferredPrompt && (
              <button onClick={installNow} className="text-[11px] tracking-wider uppercase px-4 py-2 rounded-full bg-white text-stone-900 font-medium">
                Install
              </button>
            )}
            <button onClick={dismiss} className="text-[11px] tracking-wider uppercase px-4 py-2 rounded-full text-stone-300 hover:text-white">
              {deferredPrompt ? 'Not now' : 'Got it'}
            </button>
          </div>
        </div>
        <button onClick={dismiss} className="text-stone-500 hover:text-white shrink-0" aria-label="Dismiss">
          <X size={16} strokeWidth={1.5} />
        </button>
      </div>
    </div>,
    document.body
  );
}
