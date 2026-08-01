import { describe, it, expect } from 'vitest';
import {
  normalizeInspirationGarments,
  cleanSuggestion,
  wishlistCategoryFor,
  MAX_SUGGESTION_CHARS,
} from './inspiration.js';

const WARDROBE = [
  { id: 'i1', name: 'Amalfi Linen Shirt', category: 'Tops' },
  { id: 'i2', name: 'Bayswater Tote', category: 'Bags' },
  { id: 'i3', name: 'Siren Cuff', category: 'Jewellery' },
];

const garment = (over = {}) => ({
  category: 'Tops',
  description: 'white linen shirt',
  matchedItemId: null,
  matchConfidence: null,
  buyingNote: null,
  betterMatch: null,
  ...over,
});

describe('normalizeInspirationGarments', () => {
  it('returns empty results for anything that is not a garment array', () => {
    for (const input of [undefined, null, 'nope', {}, 42]) {
      expect(normalizeInspirationGarments(input, WARDROBE)).toEqual({
        garments: [], wardrobeMatchIds: [], missingPieces: [],
      });
    }
  });

  it('skips malformed entries instead of throwing', () => {
    const { garments } = normalizeInspirationGarments([null, 'shirt', 7, garment()], WARDROBE);
    expect(garments).toHaveLength(1);
  });

  it('keeps a match whose category agrees with the owned item', () => {
    const result = normalizeInspirationGarments(
      [garment({ matchedItemId: 'i1', matchConfidence: 'high' })],
      WARDROBE
    );
    expect(result.wardrobeMatchIds).toEqual(['i1']);
    expect(result.missingPieces).toEqual([]);
    expect(result.garments[0].matchedItemId).toBe('i1');
  });

  // Telling someone they own a piece they don't is the failure mode worth
  // spending code on — the prompt asks for this, but the model can't be trusted
  // with it alone.
  it('rejects a cross-category match and rewrites the garment as missing', () => {
    const result = normalizeInspirationGarments(
      [garment({ category: 'Accessories', description: 'tan leather belt', matchedItemId: 'i2', matchConfidence: 'low' })],
      WARDROBE
    );
    expect(result.wardrobeMatchIds).toEqual([]);
    expect(result.missingPieces).toEqual(['tan leather belt']);
    // The detail view renders from `garments` — a rejected match left in place
    // there would show "in your wardrobe" under a verdict counting it missing.
    expect(result.garments[0].matchedItemId).toBeNull();
    expect(result.garments[0].matchConfidence).toBeNull();
  });

  it('rejects a match against an id that is not in the wardrobe', () => {
    const result = normalizeInspirationGarments(
      [garment({ matchedItemId: 'ghost', buyingNote: 'a white linen shirt' })],
      WARDROBE
    );
    expect(result.wardrobeMatchIds).toEqual([]);
    expect(result.missingPieces).toEqual(['a white linen shirt']);
  });

  it('compares categories case- and whitespace-insensitively', () => {
    const result = normalizeInspirationGarments(
      [garment({ category: ' bags ', description: 'tan tote', matchedItemId: 'i2', matchConfidence: 'medium' })],
      WARDROBE
    );
    expect(result.wardrobeMatchIds).toEqual(['i2']);
  });

  it('prefers buyingNote over description for a missing piece', () => {
    const result = normalizeInspirationGarments(
      [garment({ description: 'a coat', buyingNote: 'a tailored navy blazer with peak lapels' })],
      WARDROBE
    );
    expect(result.missingPieces).toEqual(['a tailored navy blazer with peak lapels']);
  });

  it('dedupes match ids but counts every garment as its own missing piece', () => {
    const result = normalizeInspirationGarments(
      [
        garment({ matchedItemId: 'i1', matchConfidence: 'high' }),
        garment({ matchedItemId: 'i1', matchConfidence: 'medium' }),
        garment({ description: 'a belt' }),
        garment({ description: 'a scarf' }),
      ],
      WARDROBE
    );
    expect(result.wardrobeMatchIds).toEqual(['i1']);
    expect(result.missingPieces).toEqual(['a belt', 'a scarf']);
  });

  describe('betterMatch', () => {
    it('is kept on a verified match', () => {
      const result = normalizeInspirationGarments(
        [garment({ matchedItemId: 'i1', matchConfidence: 'medium', betterMatch: 'a boxy cropped poplin shirt in ivory' })],
        WARDROBE
      );
      expect(result.garments[0].betterMatch).toBe('a boxy cropped poplin shirt in ivory');
    });

    it('is stripped when the match itself was rejected', () => {
      const result = normalizeInspirationGarments(
        [garment({ category: 'Accessories', matchedItemId: 'i2', betterMatch: 'a woven tan belt' })],
        WARDROBE
      );
      // The garment is missing now; buyingNote carries the suggestion, so a
      // second one would render as two competing recommendations.
      expect(result.garments[0].betterMatch).toBeNull();
    });

    it('is dropped when it only parrots the garment description', () => {
      const result = normalizeInspirationGarments(
        [garment({ matchedItemId: 'i1', matchConfidence: 'high', betterMatch: 'White Linen Shirt ' })],
        WARDROBE
      );
      expect(result.garments[0].betterMatch).toBeNull();
    });

    it('is null when the model omits it entirely', () => {
      const result = normalizeInspirationGarments(
        [garment({ matchedItemId: 'i1', matchConfidence: 'high' })],
        WARDROBE
      );
      expect(result.garments[0].betterMatch).toBeNull();
    });
  });
});

describe('cleanSuggestion', () => {
  it('trims usable text', () => {
    expect(cleanSuggestion('  a slouchy tan hobo  ')).toBe('a slouchy tan hobo');
  });

  it('rejects empties and non-strings', () => {
    for (const v of ['', '   ', null, undefined, 42, {}]) expect(cleanSuggestion(v)).toBeNull();
  });

  // Models write the word rather than the value often enough that rendering it
  // literally would put "null" in front of the user as a recommendation.
  it('rejects stringified absence', () => {
    for (const v of ['null', 'None', 'N/A', 'na', '-']) expect(cleanSuggestion(v)).toBeNull();
  });

  it('truncates an over-long suggestion to fit the card', () => {
    const out = cleanSuggestion('x'.repeat(MAX_SUGGESTION_CHARS + 50));
    expect(out).toHaveLength(MAX_SUGGESTION_CHARS);
    expect(out.endsWith('…')).toBe(true);
  });
});

describe('wishlistCategoryFor', () => {
  it('maps a garment category onto the wardrobe taxonomy', () => {
    expect(wishlistCategoryFor('Bags')).toBe('Bags');
    expect(wishlistCategoryFor('jewellery')).toBe('Jewellery');
    expect(wishlistCategoryFor(' Shoes ')).toBe('Shoes');
  });

  it('falls back to Tops for anything unrecognised', () => {
    for (const v of ['Hats', '', null, undefined, 'All']) expect(wishlistCategoryFor(v)).toBe('Tops');
  });
});
