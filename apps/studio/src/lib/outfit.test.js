import { describe, it, expect } from 'vitest';
import { trimToOnePerSlot } from './outfit.js';

// outfit.js is pure (no React, no Firebase), so the AI path's deterministic
// guards are testable here even though ai.js itself isn't.
const item = (id, category, subCategory) => ({ id, category, subCategory, name: id });

const WARDROBE = [
  item('top1', 'Tops'),
  item('top2', 'Tops'),
  item('short1', 'Bottoms'),
  item('short2', 'Bottoms'),
  item('short3', 'Bottoms'),
  item('dress1', 'Dresses'),
  item('shoe1', 'Shoes'),
  item('bag1', 'Bags'),
  item('sunnies', 'Accessories', 'Sunglasses'),
  item('belt1', 'Accessories', 'Belts'),
  item('hoops', 'Jewellery', 'Earrings'),
  item('chain', 'Jewellery', 'Necklaces'),
  item('pendant', 'Jewellery', 'Pendants'),
  item('watch', 'Jewellery', 'Watches'),
  item('bracelet', 'Jewellery', 'Bracelets'),
  item('gymtop', 'Sportswear'),
];

const ids = (r) => r.kept;

describe('trimToOnePerSlot', () => {
  it('keeps a well-formed look untouched', () => {
    const look = ['top1', 'short1', 'shoe1', 'bag1'];
    const r = trimToOnePerSlot(look, WARDROBE);
    expect(ids(r)).toEqual(look);
    expect(r.dropped).toEqual([]);
  });

  // The reported bug: the Daily Brief returned a look carrying three pairs of
  // shorts. hasClothingBase is satisfied by top+bottom, so nothing else caught it.
  it('drops the extra bottoms when the model returns three pairs of shorts', () => {
    const r = trimToOnePerSlot(['top1', 'short1', 'short2', 'short3'], WARDROBE);
    expect(ids(r)).toEqual(['top1', 'short1']);
    expect(r.dropped).toEqual(['short2', 'short3']);
  });

  it('keeps the FIRST pick per slot, not the last', () => {
    const r = trimToOnePerSlot(['short2', 'short1'], WARDROBE);
    expect(ids(r)).toEqual(['short2']);
    expect(r.dropped).toEqual(['short1']);
  });

  it('caps every single slot independently', () => {
    const r = trimToOnePerSlot(['top1', 'top2', 'short1', 'short2', 'shoe1', 'bag1'], WARDROBE);
    expect(ids(r)).toEqual(['top1', 'short1', 'shoe1', 'bag1']);
  });

  // Stacking is real styling and the prompt asks for a curated jewellery stack —
  // these slots must survive the trim untouched.
  it('never trims stackable jewellery (earrings / necklaces / wrist)', () => {
    const look = ['top1', 'short1', 'hoops', 'chain', 'pendant', 'watch', 'bracelet'];
    const r = trimToOnePerSlot(look, WARDROBE);
    expect(ids(r)).toEqual(look);
    expect(r.dropped).toEqual([]);
  });

  // Belts are their own slot, so a belt and sunglasses can coexist — a
  // category-based trim would wrongly have dropped one of them.
  it('treats Belts as a slot distinct from Accessories', () => {
    const look = ['top1', 'short1', 'sunnies', 'belt1'];
    const r = trimToOnePerSlot(look, WARDROBE);
    expect(ids(r)).toEqual(look);
    expect(r.dropped).toEqual([]);
  });

  it('leaves items that map to no slot alone rather than dropping them', () => {
    const r = trimToOnePerSlot(['gymtop', 'top1', 'short1'], WARDROBE);
    expect(ids(r)).toEqual(['gymtop', 'top1', 'short1']);
    expect(r.dropped).toEqual([]);
  });

  it('ignores ids that no longer resolve to an item', () => {
    const r = trimToOnePerSlot(['ghost', 'top1', 'short1'], WARDROBE);
    expect(ids(r)).toEqual(['ghost', 'top1', 'short1']);
    expect(r.dropped).toEqual([]);
  });

  it('tolerates empty and missing input', () => {
    expect(trimToOnePerSlot([], WARDROBE)).toEqual({ kept: [], dropped: [] });
    expect(trimToOnePerSlot(undefined, WARDROBE)).toEqual({ kept: [], dropped: [] });
    expect(trimToOnePerSlot(['top1'], undefined)).toEqual({ kept: ['top1'], dropped: [] });
  });

  // A Dress and a Top+Bottom occupy different slots, so the trim alone can't
  // resolve "a Dress REPLACES Tops + Bottoms" — that stays the prompt's job.
  // Pinned so the limitation is a known property, not a surprise.
  it('does not resolve dress-vs-top+bottom (different slots, prompt rule)', () => {
    const look = ['dress1', 'top1', 'short1'];
    expect(ids(trimToOnePerSlot(look, WARDROBE))).toEqual(look);
  });
});
