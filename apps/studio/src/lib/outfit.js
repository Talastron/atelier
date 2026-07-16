import { itemSeasons } from './items.js';

// The outfit-slot model — shared domain knowledge between the Styling Studio
// (OutfitBuilder) and the item detail view. Pure: no React, no Firebase.
//
// Strict 1:1 — items can ONLY fill a slot matching their actual category +
// subcategory where relevant. Jewellery is split into three slots so an outfit
// can carry earrings + a necklace + a bracelet at the same time without one
// piece evicting another. Outerwear is its own slot (was previously mixed into
// Tops, which produced incoherent looks like "Sport jacket + Smart trousers").
export const OUTFIT_SLOTS = ['Tops', 'Dresses', 'Bottoms', 'Outerwear', 'Shoes', 'Bags', 'Accessories', 'Belts', 'Earrings', 'Necklaces', 'Wrist'];
export const SLOT_FILTER = {
  Tops:        (i) => i.category === 'Tops',
  Dresses:     (i) => i.category === 'Dresses',
  Bottoms:     (i) => i.category === 'Bottoms',
  Outerwear:   (i) => i.category === 'Outerwear',
  Shoes:       (i) => i.category === 'Shoes',
  Bags:        (i) => i.category === 'Bags',
  Accessories: (i) => i.category === 'Accessories' && i.subCategory !== 'Belts' || (i.category === 'Jewellery' && i.subCategory === 'Brooches'),
  Belts:       (i) => i.category === 'Accessories' && i.subCategory === 'Belts',
  Earrings:    (i) => i.category === 'Jewellery' && i.subCategory === 'Earrings',
  Necklaces:   (i) => i.category === 'Jewellery' && (i.subCategory === 'Necklaces' || i.subCategory === 'Pendants'),
  Wrist:       (i) => i.category === 'Jewellery' && (i.subCategory === 'Bracelets' || i.subCategory === 'Watches' || i.subCategory === 'Rings'
                       || !i.subCategory || i.subCategory === 'Other'),
};
export const itemFitsSlot = (item, slot) => !!item && !!SLOT_FILTER[slot]?.(item);
export const slotForItem = (item) => OUTFIT_SLOTS.find((s) => itemFitsSlot(item, s)) || null;
// Slots that hold an array of items (layered looks) instead of a single piece.
// Earrings, necklaces, bracelets/watches/rings are stackable in real styling —
// "wear three pendants together", "stack a watch and two bracelets".
export const MULTI_SLOTS = new Set(['Earrings', 'Necklaces', 'Wrist']);
export const isMultiSlot = (slot) => MULTI_SLOTS.has(slot);
// Read all items from a slot value, regardless of single/array shape.
export const slotItems = (val) => Array.isArray(val) ? val : (val ? [val] : []);
// Backwards-compat shim for any old callers — returns the strict list of
// categories a slot can hold (jewellery slots all answer "Jewellery").
export const SLOT_CATEGORIES = {
  Tops: ['Tops'], Dresses: ['Dresses'], Bottoms: ['Bottoms'], Outerwear: ['Outerwear'],
  Shoes: ['Shoes'], Bags: ['Bags'], Accessories: ['Accessories'], Belts: ['Accessories'],
  Earrings: ['Jewellery'], Necklaces: ['Jewellery'], Wrist: ['Jewellery'],
};
export const emptyOutfit = () => Object.fromEntries(OUTFIT_SLOTS.map((s) => [s.toLowerCase(), null]));

// ── Clothing-base guarantee ────────────────────────────────────────────────
// A composed look MUST contain a real clothing base: a Dress, OR a Top AND a
// Bottom. The model intermittently names a garment in its prose but omits its
// id from itemIds, leaving a look of pure accessories (the "Daily Brief shows
// only sandals + jewellery" bug). These helpers are the deterministic backstop
// that runs AFTER the model's own retry, so an incomplete look never reaches
// the user. Pure — covered by scripts/test-outfit-base.mjs.

// The base taxonomy, split by how a category behaves rather than as one flat
// list — because two different questions get asked of it, and only the split
// answers both from one place:
//   • "is this piece part of a base?"      → flat membership (isClothingBase)
//   • "is this look's base complete?"      → a composition rule (hasClothingBase)
// A Dress stands alone; a Top and a Bottom need each other. Adding a category
// (e.g. Jumpsuits → STANDALONE) therefore flows to BOTH answers, and to every
// consumer below, instead of needing the same three strings updated in four
// places and one of them being missed.
const STANDALONE_BASE_CATEGORIES = ['Dresses'];
const PAIRED_BASE_CATEGORIES = ['Tops', 'Bottoms'];

// The single source of truth for "which categories make up a clothing base".
// Consumed by ai.js (to list the mandatory base block in the prompt) and
// TodayView (to record which pieces of a brief were its base).
export const CLOTHING_CATEGORIES = [...STANDALONE_BASE_CATEGORIES, ...PAIRED_BASE_CATEGORIES];

// Flat membership: is this piece part of a base at all? NOT the same question
// as hasClothingBase — a Top is a base category, but a Top alone is not a base.
export const isClothingBase = (item) => !!item && CLOTHING_CATEGORIES.includes(item.category);

// ── One-per-slot guarantee ─────────────────────────────────────────────────
// The Styling Studio enforces the strict 1:1 slot model above by construction —
// you physically can't drop two pairs of shorts into Bottoms. The AI path had no
// such enforcement: "Pick AT MOST one item per category slot" was a prompt rule
// only, and the model does ignore it (it has returned a look carrying THREE
// pairs of shorts). hasClothingBase can't catch it either — a top + three
// bottoms satisfies "has a base", so it sails through the retry and
// ensureClothingBase untouched. This gives the AI path the same guarantee the
// builder already has, using the same slot model rather than a second opinion
// about what a slot is.
//
// MULTI_SLOTS (Earrings/Necklaces/Wrist) are deliberately exempt — stacking is
// real styling, and the prompt asks for a curated jewellery stack. Items in no
// slot at all (e.g. Sportswear) are left alone rather than silently dropped.
// Keeps the model's FIRST pick per slot: the one its reasoning leads with.
export function trimToOnePerSlot(itemIds, items) {
  const used = new Set();
  const kept = [];
  const dropped = [];
  for (const id of itemIds || []) {
    const item = (items || []).find((i) => i.id === id);
    const slot = item ? slotForItem(item) : null;
    if (slot && !isMultiSlot(slot)) {
      if (used.has(slot)) { dropped.push(id); continue; }
      used.add(slot);
    }
    kept.push(id);
  }
  return { kept, dropped };
}

// True iff the resolved ids contain a Dress, or BOTH a Top and a Bottom.
// Derived from the standalone/paired split above rather than restating those
// category names, so the rule can't drift out of step with CLOTHING_CATEGORIES.
export function hasClothingBase(itemIds, items) {
  const picked = (itemIds || []).map((id) => (items || []).find((i) => i.id === id)).filter(Boolean);
  const has = (cat) => picked.some((i) => i.category === cat);
  return STANDALONE_BASE_CATEGORIES.some(has) || PAIRED_BASE_CATEGORIES.every(has);
}

// Highest-fidelity recovery: the model named a garment in its reasoning prose
// but left it out of itemIds. The accessories were chosen to complement that
// exact piece, so re-attaching it is far better than injecting a random base.
// Returns the ids of clothing items whose name appears verbatim in the prose
// and that aren't already selected.
export function recoverBaseFromProse(reasoning, itemIds, items) {
  const prose = (reasoning || '').toLowerCase();
  if (!prose) return [];
  const already = new Set(itemIds || []);
  return items
    .filter((i) => isClothingBase(i) && !already.has(i.id))
    .filter((i) => typeof i.name === 'string' && i.name.trim().length >= 4)
    .filter((i) => prose.includes(i.name.trim().toLowerCase()))
    .map((i) => i.id);
}

// Deterministic last resort: pick a sensible clothing base from the wardrobe.
// No randomness (stable across re-renders). Prefers favourites, then
// season-appropriate pieces, then alphabetical for a stable tie-break. Honours
// weather only enough to avoid an obviously wrong choice (a dress in the cold).
export function pickFallbackBase(items, { weather, season } = {}, excludeIds = []) {
  const exclude = new Set(excludeIds);
  const temp = weather && typeof weather.temp === 'number' ? weather.temp : null;
  const cold = temp != null && temp < 12;
  const warm = temp != null && temp >= 22;
  const seasonMatch = (i) => (season && itemSeasons(i).includes(season) ? 1 : 0);
  const rank = (a, b) =>
    (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0) ||
    seasonMatch(b) - seasonMatch(a) ||
    String(a.name || '').localeCompare(String(b.name || ''));
  const byCat = (cat) => items.filter((i) => i.category === cat && !exclude.has(i.id)).sort(rank);
  const dresses = byCat('Dresses');
  const tops = byCat('Tops');
  const bottoms = byCat('Bottoms');
  const pair = () => (tops.length && bottoms.length ? [tops[0].id, bottoms[0].id] : []);

  // Cold favours a covered top+bottom over a bare dress; otherwise a dress is
  // the simplest complete base. Fall back across whatever the wardrobe has.
  if (cold) return pair().length ? pair() : (dresses.length ? [dresses[0].id] : []);
  if (warm && dresses.length) return [dresses[0].id];
  if (dresses.length) return [dresses[0].id];
  return pair();
}

// The guarantee. Given the model's { itemIds, reasoning }, returns a corrected
// itemIds that is certain to contain a clothing base — recovering from prose
// first, then injecting a deterministic fallback. `ok` is false ONLY when the
// wardrobe genuinely contains no clothing (caller should show an honest empty
// state rather than an accessories-only look).
export function ensureClothingBase({ itemIds = [], reasoning = '' } = {}, items = [], context = {}) {
  const start = [...itemIds];
  if (hasClothingBase(start, items)) {
    return { itemIds: start, recovered: false, injected: false, ok: true };
  }

  const recoveredIds = recoverBaseFromProse(reasoning, start, items);
  let next = [...start, ...recoveredIds];
  if (hasClothingBase(next, items)) {
    return { itemIds: next, recovered: true, injected: false, ok: true };
  }

  const injectIds = pickFallbackBase(items, context, next);
  next = [...next, ...injectIds];
  return {
    itemIds: next,
    recovered: recoveredIds.length > 0,
    injected: injectIds.length > 0,
    ok: hasClothingBase(next, items),
  };
}
