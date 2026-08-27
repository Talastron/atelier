import { describe, it, expect } from 'vitest';
import { fitContain } from './shareCard.js';

describe('fitContain', () => {
  // The bug this replaces: the share card used cover-fit, which takes a centred
  // slice sized to FILL the box. That suits a landscape photograph, where the
  // edges are expendable, and ruins a garment, where the hem and the shoulder
  // are the subject. At five pieces the cell inverted to landscape 1.27 and a
  // dress rendered with 43% of itself visible.
  it('shows a tall garment whole, letterboxed left and right', () => {
    // A dress at aspect 0.55 in a landscape box.
    const box = fitContain(550, 1000, 400, 300);
    expect(box.h).toBe(300);                 // limited by height
    expect(box.w).toBeCloseTo(165, 0);       // 300 * 0.55
    expect(box.x).toBeCloseTo(117.5, 0);     // centred: (400 - 165) / 2
    expect(box.y).toBe(0);
  });

  it('shows a wide garment whole, letterboxed top and bottom', () => {
    // A shoe at aspect 1.25 in a portrait box.
    const box = fitContain(1250, 1000, 400, 600);
    expect(box.w).toBe(400);                 // limited by width
    expect(box.h).toBeCloseTo(320, 0);       // 400 / 1.25
    expect(box.x).toBe(0);
    expect(box.y).toBeCloseTo(140, 0);       // (600 - 320) / 2
  });

  it('fills the box exactly when the aspects match', () => {
    const box = fitContain(800, 600, 400, 300);
    expect(box).toEqual({ x: 0, y: 0, w: 400, h: 300 });
  });

  // The whole point: nothing is ever cut off.
  it('never returns a box larger than the one it was given', () => {
    const aspects = [[550, 1000], [500, 1000], [1250, 1000], [780, 1000], [1000, 1000]];
    for (const [iw, ih] of aspects) {
      const box = fitContain(iw, ih, 400, 300);
      expect(box.w).toBeLessThanOrEqual(400 + 1e-9);
      expect(box.h).toBeLessThanOrEqual(300 + 1e-9);
      // and it keeps the image's own proportions
      expect(box.w / box.h).toBeCloseTo(iw / ih, 5);
    }
  });

  it('returns an empty box rather than NaN for degenerate input', () => {
    expect(fitContain(0, 100, 400, 300)).toEqual({ x: 0, y: 0, w: 0, h: 0 });
    expect(fitContain(100, 0, 400, 300)).toEqual({ x: 0, y: 0, w: 0, h: 0 });
    expect(fitContain(100, 100, 0, 300)).toEqual({ x: 0, y: 0, w: 0, h: 0 });
  });
});
