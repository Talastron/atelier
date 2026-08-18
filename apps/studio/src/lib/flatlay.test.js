import { describe, it, expect } from 'vitest';
import { composeFlatlay, rotationFor } from './flatlay.js';

const piece = (id, category) => ({ id, category, name: `${category} ${id}` });

// A twelve-piece look of the kind that broke the old 2x2 preview.
const LOOK = [
  piece('j1', 'Jewellery'),
  piece('b1', 'Bottoms'),
  piece('o1', 'Outerwear'),
  piece('j2', 'Jewellery'),
  piece('s1', 'Shoes'),
  piece('t1', 'Tops'),
  piece('g1', 'Bags'),
];

describe('composeFlatlay', () => {
  it('places every piece it is given, up to the cap', () => {
    const out = composeFlatlay(LOOK);
    expect(out).toHaveLength(LOOK.length);
    expect(out.map((p) => p.item.id).sort()).toEqual(['b1', 'g1', 'j1', 'j2', 'o1', 's1', 't1']);
  });

  // Silhouette before finishing: the garments that define the look are placed
  // first, so a cap drops jewellery rather than the trousers.
  it('orders silhouette ahead of finishing regardless of input order', () => {
    const out = composeFlatlay(LOOK);
    expect(out.map((p) => p.item.category)).toEqual([
      'Outerwear', 'Tops', 'Bottoms', 'Shoes', 'Bags', 'Jewellery', 'Jewellery',
    ]);
  });

  it('drops finishing first when capped', () => {
    const out = composeFlatlay(LOOK, { max: 4 });
    expect(out.map((p) => p.item.category)).toEqual(['Outerwear', 'Tops', 'Bottoms', 'Shoes']);
  });

  it('keeps every placement inside the frame', () => {
    for (const p of composeFlatlay(LOOK, { overlap: true })) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.w).toBeLessThanOrEqual(1);
      expect(p.h).toBeLessThanOrEqual(1);
    }
  });

  // The distinction the whole phasing rests on: overlap needs transparency,
  // so without it nothing tilts and the pieces are inset apart.
  it('does not tilt anything when overlap is off', () => {
    const out = composeFlatlay(LOOK, { overlap: false });
    expect(out.every((p) => p.rotation === 0)).toBe(true);
  });

  // The property that lets a look composed of opaque images be legible: no
  // piece may sit on top of another. Garments are allowed to overlap at the
  // edges — a coat and a trouser share a corner by design, and closing every
  // gap would spread the composition back out into the grid we are escaping.
  // What must never happen is one piece essentially covering another, which is
  // what Accessories and Jewellery did at 71% before this test existed.
  it('does not stack one piece on top of another when overlap is off', () => {
    const worn = [
      piece('o1', 'Outerwear'), piece('t1', 'Tops'), piece('b1', 'Bottoms'),
      piece('s1', 'Shoes'), piece('g1', 'Bags'), piece('a1', 'Accessories'),
      piece('j1', 'Jewellery'),
    ];
    const out = composeFlatlay(worn, { overlap: false });
    for (let i = 0; i < out.length; i += 1) {
      for (let j = i + 1; j < out.length; j += 1) {
        const a = out[i];
        const b = out[j];
        const ox = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
        const oy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
        const share = (ox * oy) / Math.min(a.w * a.h, b.w * b.h);
        expect(
          share,
          `${a.item.category} covers ${(share * 100).toFixed(0)}% of ${b.item.category}`
        ).toBeLessThan(0.25);
      }
    }
  });

  it('tilts pieces within three degrees when overlap is on', () => {
    const out = composeFlatlay(LOOK, { overlap: true });
    expect(out.some((p) => p.rotation !== 0)).toBe(true);
    for (const p of out) expect(Math.abs(p.rotation)).toBeLessThanOrEqual(3);
  });

  it('steps a second piece in the same zone away from the first, and shrinks it', () => {
    const [first, second] = composeFlatlay(
      [piece('j1', 'Jewellery'), piece('j2', 'Jewellery')],
      { overlap: true }
    );
    expect(second.x).toBeGreaterThan(first.x);
    expect(second.y).toBeGreaterThan(first.y);
    expect(second.w).toBeLessThan(first.w);
    expect(second.z).toBeGreaterThan(first.z);
  });

  it('gives an unknown category a place rather than dropping it', () => {
    const out = composeFlatlay([piece('x1', 'Fragrance')]);
    expect(out).toHaveLength(1);
    expect(out[0].w).toBeGreaterThan(0);
  });

  it('handles an empty or malformed look', () => {
    expect(composeFlatlay([])).toEqual([]);
    expect(composeFlatlay(null)).toEqual([]);
    expect(composeFlatlay([null, undefined])).toEqual([]);
  });
});

describe('rotationFor', () => {
  // Math.random would reshuffle the composition on every render — a look would
  // never sit still. Rotation is keyed on the item id instead.
  it('is stable for the same id', () => {
    expect(rotationFor('i_abc')).toBe(rotationFor('i_abc'));
  });

  it('differs across ids', () => {
    const angles = new Set(['a', 'b', 'c', 'd', 'e', 'f'].map(rotationFor));
    expect(angles.size).toBeGreaterThan(1);
  });

  it('stays within bounds even for odd input', () => {
    for (const id of ['', null, undefined, 'a'.repeat(200)]) {
      expect(Math.abs(rotationFor(id))).toBeLessThanOrEqual(3);
    }
  });
});
