import { describe, it, expect } from 'vitest';
import { matchColorFamily, hexFromColorName } from './color.js';
import { COLOR_FAMILIES, COLOR_SWATCHES } from './taxonomy.js';

describe('matchColorFamily', () => {
  // Every family must recognise its own name. Without this, adding a family to
  // COLOR_FAMILIES without teaching the mapper about it produces a colour the
  // AI can return and the app cannot classify.
  it('round-trips every canonical family', () => {
    for (const family of COLOR_FAMILIES) {
      expect(matchColorFamily(family), family).toBe(family);
    }
  });

  it('is case- and whitespace-insensitive', () => {
    expect(matchColorFamily('  BURGUNDY ')).toBe('Burgundy');
    expect(matchColorFamily('Navy')).toBe('Navy');
  });

  it('is null for nothing recognisable', () => {
    expect(matchColorFamily('')).toBeNull();
    expect(matchColorFamily(null)).toBeNull();
    expect(matchColorFamily('quantum')).toBeNull();
  });

  // These words were recognised long before Burgundy and Plum existed as
  // families, and were folded into Red and Purple — so a burgundy trench was
  // not unclassified, it was confidently wrong. This is the assertion that
  // stops them being folded back.
  describe('the deep shades that used to be swallowed', () => {
    it('maps the deep reds to Burgundy, not Red', () => {
      for (const word of ['burgundy', 'wine', 'maroon', 'oxblood', 'claret', 'merlot']) {
        expect(matchColorFamily(word), word).toBe('Burgundy');
      }
    });

    it('maps the deep purples to Plum, not Purple', () => {
      for (const word of ['plum', 'aubergine', 'damson', 'mulberry']) {
        expect(matchColorFamily(word), word).toBe('Plum');
      }
    });

    // The line has to fall somewhere, and it falls on depth: crimson and
    // scarlet are bright, lilac and lavender are light. Only the deep shades
    // moved.
    it('leaves the bright reds and light purples where they were', () => {
      for (const word of ['crimson', 'scarlet']) expect(matchColorFamily(word), word).toBe('Red');
      for (const word of ['lilac', 'lavender', 'violet']) expect(matchColorFamily(word), word).toBe('Purple');
    });

    it('recognises a shade inside a longer phrase', () => {
      expect(matchColorFamily('deep burgundy')).toBe('Burgundy');
      expect(matchColorFamily('dark aubergine')).toBe('Plum');
    });
  });
});

describe('the colour taxonomy is complete', () => {
  // A family with no swatch renders as a blank chip in the picker and a
  // fallback grey on the share card.
  it('gives every family a swatch', () => {
    for (const family of COLOR_FAMILIES) {
      expect(COLOR_SWATCHES[family], family).toBeTruthy();
    }
  });

  it('gives every family a canvas-safe or gradient swatch', () => {
    for (const family of COLOR_FAMILIES) {
      const sw = COLOR_SWATCHES[family];
      expect(/^#[0-9A-Fa-f]{6}$/.test(sw) || sw.startsWith('linear-gradient'), `${family}: ${sw}`).toBe(true);
    }
  });

  it('resolves a hex for every new shade name', () => {
    for (const word of ['burgundy', 'wine', 'maroon', 'oxblood', 'claret', 'merlot', 'plum', 'aubergine', 'damson', 'mulberry']) {
      // #d6d3d1 is the stone-300 fallback — a name reaching it has no entry.
      expect(hexFromColorName(word), word).not.toBe('#d6d3d1');
    }
  });
});
