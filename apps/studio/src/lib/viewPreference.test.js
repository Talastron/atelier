import { describe, it, expect } from 'vitest';
import { normaliseLookView, LOOK_VIEW_KEY, LOOKBOOK_COVER_KEY } from './viewPreference.js';

describe('normaliseLookView', () => {
  it('accepts the two real views', () => {
    expect(normaliseLookView('flatlay')).toBe('flatlay');
    expect(normaliseLookView('grid')).toBe('grid');
  });

  it('falls back to flat-lay for anything else', () => {
    // localStorage returns null when unset, and can hold junk from an older
    // build or another tab. Anything unrecognised means "the default", which
    // is the composition — the arrangement the app is built around.
    expect(normaliseLookView(null)).toBe('flatlay');
    expect(normaliseLookView(undefined)).toBe('flatlay');
    expect(normaliseLookView('')).toBe('flatlay');
    expect(normaliseLookView('GRID')).toBe('flatlay');
    expect(normaliseLookView('list')).toBe('flatlay');
    expect(normaliseLookView(0)).toBe('flatlay');
  });
});

describe('storage keys', () => {
  it('keeps the single-look preference separate from the Lookbook cover style', () => {
    // They answer different questions: "how do I read ONE look?" versus
    // "how do the covers on a grid of many looks render?". Sharing a key
    // would make choosing grid covers silently change the Daily Brief.
    expect(LOOK_VIEW_KEY).not.toBe(LOOKBOOK_COVER_KEY);
  });

  it('does not change the Lookbook key, which is already in users browsers', () => {
    expect(LOOKBOOK_COVER_KEY).toBe('atelier-lookbook-cover');
  });
});
