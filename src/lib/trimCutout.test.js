import { describe, it, expect } from 'vitest';
import { contentBounds } from './trimCutout.js';

// Build a fake RGBA buffer: opaque white, with an optional dark rect painted in.
function makeImage(width, height, rect) {
  const data = new Uint8ClampedArray(width * height * 4).fill(255); // white, opaque
  if (rect) {
    for (let y = rect.y; y < rect.y + rect.h; y++) {
      for (let x = rect.x; x < rect.x + rect.w; x++) {
        const i = (y * width + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = 0; // black subject pixel
      }
    }
  }
  return { data, width, height };
}

describe('contentBounds', () => {
  it('returns null for an all-white image', () => {
    expect(contentBounds(makeImage(10, 10, null))).toBeNull();
  });

  it('finds a centred subject rect exactly', () => {
    expect(contentBounds(makeImage(10, 10, { x: 3, y: 4, w: 2, h: 3 })))
      .toEqual({ x: 3, y: 4, w: 2, h: 3 });
  });

  it('finds a subject touching the top-left edge', () => {
    expect(contentBounds(makeImage(10, 10, { x: 0, y: 0, w: 4, h: 2 })))
      .toEqual({ x: 0, y: 0, w: 4, h: 2 });
  });

  it('ignores off-white noise below the threshold', () => {
    const img = makeImage(6, 6, null);
    const i = (2 * 6 + 2) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = 250; // deviation 5 < 14
    expect(contentBounds(img)).toBeNull();
  });

  it('detects a pale/cream subject whose deviation clears the threshold', () => {
    const img = makeImage(6, 6, null);
    const i = (2 * 6 + 2) * 4;
    img.data[i] = 235; img.data[i + 1] = 235; img.data[i + 2] = 220; // deviation 35
    expect(contentBounds(img)).toEqual({ x: 2, y: 2, w: 1, h: 1 });
  });
});
