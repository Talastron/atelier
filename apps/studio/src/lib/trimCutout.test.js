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

describe('contentBounds with an alpha mask', () => {
  // Build RGBA pixels: a `size` square that is fully transparent except for an
  // opaque red block at (bx, by, bw, bh). Transparent pixels are (0,0,0,0) —
  // which is what getImageData returns and why a colour-only test reads them as
  // BLACK, i.e. as subject.
  const alphaPixels = (size, bx, by, bw, bh) => {
    const data = new Uint8ClampedArray(size * size * 4); // all zeroes: transparent
    for (let y = by; y < by + bh; y++) {
      for (let x = bx; x < bx + bw; x++) {
        const i = (y * size + x) * 4;
        data[i] = 220; data[i + 1] = 40; data[i + 2] = 40; data[i + 3] = 255;
      }
    }
    return { data, width: size, height: size };
  };

  it('finds the subject by alpha, not by colour, when the image has transparency', () => {
    expect(contentBounds(alphaPixels(20, 5, 6, 4, 3))).toEqual({ x: 5, y: 6, w: 4, h: 3 });
  });

  it('still finds a subject on a white ground when there is no transparency', () => {
    const size = 20;
    const data = new Uint8ClampedArray(size * size * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255; data[i + 1] = 255; data[i + 2] = 255; data[i + 3] = 255;
    }
    for (let y = 6; y < 9; y++) {
      for (let x = 5; x < 9; x++) {
        const i = (y * size + x) * 4;
        data[i] = 220; data[i + 1] = 40; data[i + 2] = 40; data[i + 3] = 255;
      }
    }
    expect(contentBounds({ data, width: size, height: size })).toEqual({ x: 5, y: 6, w: 4, h: 3 });
  });

  it('returns null for a fully transparent image', () => {
    const size = 8;
    expect(contentBounds({ data: new Uint8ClampedArray(size * size * 4), width: size, height: size })).toBeNull();
  });
});
