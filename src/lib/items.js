// Pure item & outfit accessors and derivations — read garment fields, wear
// history, fit, cost-per-wear, price/date formatting, body-shape classification
// and the style-profile prompt summary. No React, no Firebase.
import { CARE_RULES, CURRENCY_SYMBOLS } from './taxonomy.js';

export const itemCondition = (item) => item?.condition || 'available';
export const isItemAvailable = (item) => itemCondition(item) === 'available';

export const newId = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 11));

// Items historically used `season` (string). New items use `seasons` (array).
// This normalises both shapes for read paths so we don't lose data.
export function itemStyles(item) {
  if (Array.isArray(item?.styles)) return item.styles;
  return [];
}

// Normalises legacy `imageUrl` (single) and new `images` (array) shapes.
export function itemImages(item) {
  if (Array.isArray(item?.images) && item.images.length > 0) return item.images;
  if (item?.imageUrl) return [item.imageUrl];
  return [];
}

export const todayISO = () => new Date().toISOString().slice(0, 10);

export function formatPrice(amount, currency = 'GBP') {
  const symbol = CURRENCY_SYMBOLS[currency] || '£';
  const n = Number(amount || 0);
  return `${symbol}${n.toLocaleString()}`;
}

// Soft-deleted items carry a `deletedAt`. They drop out of every read surface
// (wardrobe grid, insights, studio pickers, calendar, etc.) but still live in
// Firestore for 30 days so they can be restored from the Trash view in Profile.
export const isLive = (item) => !item?.deletedAt;
export const isDeleted = (item) => !!item?.deletedAt;
export const live = (items) => (items || []).filter(isLive);

// Fuzzy-map a free-text care phrase (often from Gemini or a label) to one of
// the fixed CARE_TAGS chips. Returns null if nothing matches; the caller can
// fall back to appending the raw phrase to the description.
export function matchCareTag(phrase) {
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

export function itemMaterials(item) {
  return Array.isArray(item?.materials) ? item.materials : [];
}

// Pick the strictest care rule that applies to this item's materials.
// Returns { material, everyN, action, wearsSince, due } or null when no
// fragile material is tagged. `wearsSince` counts wears since the user last
// marked the item cared-for (or since the wear log began).
export function itemCareReminder(item) {
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
export function resolveOutfitItems(outfit, allItems) {
  if (!outfit) return [];
  if (Array.isArray(outfit.itemIds) && outfit.itemIds.length > 0) {
    return outfit.itemIds
      .map((id) => allItems.find((i) => i.id === id))
      .filter(Boolean);
  }
  if (Array.isArray(outfit.items)) return outfit.items;
  return [];
}

// Compact one-paragraph style profile summary for prompt injection. Returns
// empty string when no fields are set so prompts stay clean.
export function summariseStyleProfile(measurements) {
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

export function itemColors(item) {
  return Array.isArray(item?.colors) ? item.colors : [];
}

export function itemWearHistory(item) {
  return Array.isArray(item?.wearHistory) ? item.wearHistory : [];
}

// wearNotes is a sparse map keyed by ISO date: { '2026-06-14': 'felt great' }.
// Kept separate from wearHistory so the array stays simple to sort & migrate.
export function itemWearNotes(item) {
  return (item && typeof item.wearNotes === 'object' && item.wearNotes !== null) ? item.wearNotes : {};
}

// Per-wear occasion text (e.g. "gallery opening", "client lunch", "Sunday").
// Sparse map keyed by ISO date, mirrors the wearNotes shape so existing
// wearHistory arrays stay simple and need no migration. Read sites that
// want the occasion for a specific wear look it up by date:
//   itemWearOccasions(item)['2026-06-14']  →  'gallery opening' or undefined
// The Concierge prompt walks the most recent wears and includes whichever
// occasions are present.
export function itemWearOccasions(item) {
  return (item && typeof item.wearOccasions === 'object' && item.wearOccasions !== null) ? item.wearOccasions : {};
}

export function itemWearCount(item) {
  return itemWearHistory(item).length;
}

export function itemLastWornISO(item) {
  const history = itemWearHistory(item);
  if (!history.length) return null;
  return [...history].sort().pop();
}

export function daysSinceLastWorn(item) {
  const last = itemLastWornISO(item);
  if (!last) return null;
  const lastMs = new Date(last + 'T00:00:00').getTime();
  const todayMs = new Date(todayISO() + 'T00:00:00').getTime();
  return Math.max(0, Math.floor((todayMs - lastMs) / 86_400_000));
}

export function itemCostPerWear(item) {
  const wears = itemWearCount(item);
  const price = Number(item?.price || 0);
  if (!wears || !price) return null;
  return price / wears;
}

export function formatLastWorn(item) {
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
export function computeFitAgainstChart({ item, shops, measurements }) {
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

// Classify body shape from chest/waist/hip measurements. Used only for
// general styling guidance, not per-item size prediction (that needs brand
// size charts, which is Phase 2). Returns null if measurements incomplete.
export function classifyBodyShape({ chest, waist, hips }) {
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

export function itemSeasons(item) {
  if (Array.isArray(item?.seasons)) return item.seasons;
  if (typeof item?.season === 'string' && item.season && item.season !== 'All Seasons') {
    return [item.season];
  }
  return [];
}
