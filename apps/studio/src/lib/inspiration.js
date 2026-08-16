// Inspiration analysis — the pure, mechanically-verifiable half.
//
// Gemini returns one object per garment it sees in the photo, each either
// matched to a wardrobe id or marked missing. Everything in this module is
// the part we do NOT trust the model with: verifying its matches against the
// real wardrobe, and keeping the persisted analysis internally consistent so
// every surface that reads it tells the same story.

import { CATEGORIES } from './taxonomy.js';

// Suggestions are chips in a card, not paragraphs. The prompt asks for <=90
// characters; this is the backstop for when the model runs long.
export const MAX_SUGGESTION_CHARS = 120;

const norm = (v) => String(v ?? '').trim().toLowerCase();

/**
 * A model-written suggestion, or null if there isn't a usable one.
 * Models reach for the string "null"/"none"/"n/a" often enough to be worth
 * catching — rendered literally, they read as a real recommendation.
 */
export function cleanSuggestion(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (['null', 'none', 'n/a', 'na', '-'].includes(trimmed.toLowerCase())) return null;
  return trimmed.length > MAX_SUGGESTION_CHARS
    ? `${trimmed.slice(0, MAX_SUGGESTION_CHARS - 1).trimEnd()}…`
    : trimmed;
}

/**
 * The wardrobe category a suggested piece should file under, from the
 * garment category the model reported. Falls back to Tops — the same default
 * the manual add form uses — for anything outside our taxonomy.
 */
export function wishlistCategoryFor(garmentCategory) {
  const wanted = norm(garmentCategory);
  const hit = CATEGORIES.find((c) => c !== 'All' && norm(c) === wanted);
  return hit || 'Tops';
}

/**
 * Verify the model's matches and derive the analysis's list fields.
 *
 * A match survives only when the id exists in the wardrobe AND the owned
 * item's category equals the garment's. Category is the one dimension that is
 * mechanically checkable, and the prompt's "be generous" instruction pushes
 * the model across it (a belt offered as a bag) — telling someone they own
 * something they don't is the failure mode worth spending code on.
 *
 * Rejected matches are rewritten in the returned `garments` array, not just
 * excluded from the derived lists. The array is what the detail view renders
 * from, so leaving a rejected match in place there would show "✓ In your
 * wardrobe" on a garment the verdict above it counts as missing.
 *
 * Returns { garments, wardrobeMatchIds, missingPieces, missingCount }.
 *
 * `missingCount` counts unmatched GARMENTS; `missingPieces` collects the
 * suggestion text for them, and a garment can be missing without yielding any
 * usable text. Counting the text would let a garment render as "◯ Missing from
 * wardrobe" while the verdict above it counted that garment as owned.
 */
export function normalizeInspirationGarments(rawGarments, items = []) {
  const list = Array.isArray(rawGarments) ? rawGarments : [];
  const byId = new Map((Array.isArray(items) ? items : []).map((i) => [i?.id, i]));

  const garments = [];
  const wardrobeMatchIds = [];
  const missingPieces = [];
  let missingCount = 0;

  for (const g of list) {
    if (!g || typeof g !== 'object') continue;

    const matchedItem = typeof g.matchedItemId === 'string' ? byId.get(g.matchedItemId) : null;
    const sameCategory = !!matchedItem && norm(matchedItem.category) === norm(g.category);

    if (sameCategory) {
      // A suggestion that only parrots the garment we're already looking at
      // is noise dressed as advice.
      const better = cleanSuggestion(g.betterMatch);
      garments.push({
        ...g,
        // Cleaned on this branch too — the card renders buyingNote verbatim as
        // the difference note, so a model-written "N/A" would read as advice.
        buyingNote: cleanSuggestion(g.buyingNote),
        betterMatch: better && norm(better) !== norm(g.description) ? better : null,
      });
      wardrobeMatchIds.push(g.matchedItemId);
      continue;
    }

    const note = cleanSuggestion(g.buyingNote) || cleanSuggestion(g.description);
    garments.push({
      ...g,
      matchedItemId: null,
      matchConfidence: null,
      buyingNote: note,
      betterMatch: null, // a missing garment's suggestion IS its buyingNote
    });
    missingCount += 1;
    if (note) missingPieces.push(note);
  }

  return { garments, wardrobeMatchIds: [...new Set(wardrobeMatchIds)], missingPieces, missingCount };
}
