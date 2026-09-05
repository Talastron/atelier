import { describe, it, expect } from 'vitest';
import { amendBrief } from './brief.js';

const base = {
  itemIds: ['a', 'b', 'c'],
  reasoning: 'The Oxford Shirt with the Chinos.',
  intent: 'today',
  savedAt: 1757000000000,
};

describe('amendBrief', () => {
  it('replaces the item ids', () => {
    const next = amendBrief(base, ['a', 'b', 'z'], base.reasoning);
    expect(next.itemIds).toEqual(['a', 'b', 'z']);
  });

  it('keeps everything else on the brief', () => {
    const next = amendBrief(base, ['a'], null);
    expect(next.intent).toBe('today');
    expect(next.savedAt).toBe(1757000000000);
  });

  it('keeps a note that only names surviving pieces', () => {
    // referencedItemIds reads chip markup, so a note naming no ids at all
    // cannot contradict the look and is always safe to keep.
    const next = amendBrief(base, ['a', 'b', 'c'], 'A considered look for today.');
    expect(next.reasoning).toBe('A considered look for today.');
  });

  it('drops a note that names a piece the look no longer holds', () => {
    // The Brief renders its note with tappable item chips, so a stale note
    // does not merely read oddly — it offers a chip for a garment that is
    // no longer in the look.
    const note = 'Try the <<item:c|Chelsea Saddle Bag>> with it.';
    const next = amendBrief(base, ['a', 'b'], note);
    expect(next.reasoning).toBeUndefined();
  });

  it('leaves a brief with no note without one', () => {
    const noNote = { itemIds: ['a'], intent: 'today' };
    const next = amendBrief(noNote, ['a', 'b'], null);
    expect('reasoning' in next).toBe(false);
  });

  it('does not mutate the brief it was given', () => {
    const next = amendBrief(base, ['x'], null);
    expect(base.itemIds).toEqual(['a', 'b', 'c']);
    expect(next).not.toBe(base);
  });

  it('survives rubbish input', () => {
    expect(amendBrief(null, ['a'], null).itemIds).toEqual(['a']);
    expect(amendBrief(base, null, null).itemIds).toEqual([]);
  });
});
