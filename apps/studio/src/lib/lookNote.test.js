import { describe, it, expect } from 'vitest';
import { referencedItemIds, noteIsStale } from './lookNote.js';

const NOTE = 'The <<item:top1|linen shirt>> softens the <<item:bot1|navy shorts>>.';

describe('referencedItemIds', () => {
  it('pulls every item id the prose names, in order', () => {
    expect(referencedItemIds(NOTE)).toEqual(['top1', 'bot1']);
  });

  it('returns nothing for prose without markers, or for no prose at all', () => {
    expect(referencedItemIds('A quiet look for a warm morning.')).toEqual([]);
    expect(referencedItemIds('')).toEqual([]);
    expect(referencedItemIds(null)).toEqual([]);
  });

  // The regex lives at module scope with a /g flag; matchAll must not leave
  // lastIndex behind or the second call would start mid-string.
  it('does not carry regex state between calls', () => {
    expect(referencedItemIds(NOTE)).toEqual(referencedItemIds(NOTE));
  });
});

describe('noteIsStale', () => {
  // The reported bug: swap the shorts, and the note still names the old pair.
  it('is stale when a named garment has left the look', () => {
    expect(noteIsStale(NOTE, ['top1', 'bot2'])).toBe(true);
  });

  it('is not stale while every named garment is still present', () => {
    expect(noteIsStale(NOTE, ['top1', 'bot1'])).toBe(false);
  });

  // Adding a piece leaves the note incomplete but not untrue — firing here
  // would train people to ignore the marker.
  it('tolerates additions the note does not mention', () => {
    expect(noteIsStale(NOTE, ['top1', 'bot1', 'shoe9'])).toBe(false);
  });

  it('treats prose naming no specific garment as always valid', () => {
    expect(noteIsStale('A quiet look for a warm morning.', [])).toBe(false);
    expect(noteIsStale(null, ['top1'])).toBe(false);
  });

  it('is stale when the look has been emptied', () => {
    expect(noteIsStale(NOTE, [])).toBe(true);
  });
});
