import { describe, it, expect } from 'vitest';
import { STYLE_GOALS } from './taxonomy.js';

describe('STYLE_GOALS', () => {
  it('is a short list of distinct, non-empty goals', () => {
    // The picker stores the string verbatim and the summariser lowercases it
    // into a prompt, so a duplicate or a stray blank would round-trip into
    // something the gap analysis cannot rank.
    expect(STYLE_GOALS.length).toBeGreaterThan(2);
    expect(STYLE_GOALS.length).toBeLessThanOrEqual(8);
    expect(new Set(STYLE_GOALS).size).toBe(STYLE_GOALS.length);
    for (const g of STYLE_GOALS) {
      expect(typeof g).toBe('string');
      expect(g.trim()).toBe(g);
      expect(g.length).toBeGreaterThan(0);
      expect(g.length).toBeLessThan(45); // it renders as a pill, on mobile
    }
  });

  it('names no cause for the rebuild goal', () => {
    // An earlier draft read "Rebuild after a change — size, job, life".
    // Naming a cause makes the app comment on the reader's body or
    // circumstances in a picker they see every time they open Profile.
    const joined = STYLE_GOALS.join(' ').toLowerCase();
    expect(joined).not.toContain('size');
    expect(joined).not.toContain('weight');
  });
});
