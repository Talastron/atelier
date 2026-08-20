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

  // The property that lets a look of opaque images be legible: NO piece may
  // overlap another, at all. Every stored cut-out is an opaque white rectangle,
  // so any overlap paints a white box across the garment underneath — visible
  // on any ground. An earlier version of this test allowed 25%, reasoning that
  // contain-fitted images would not really touch. They did: white shorts sat in
  // a white box over a tan blazer. The bound is zero.
  //
  // Runs over several look SHAPES, because the shapes are what expose this:
  // a five-piece look never puts accessories and jewellery in the frame
  // together, which is how the original 71% collision survived.
  const SHAPES = {
    'separates': ['Outerwear', 'Tops', 'Bottoms', 'Shoes', 'Bags', 'Accessories', 'Jewellery'],
    'a dress': ['Outerwear', 'Dresses', 'Shoes', 'Bags', 'Accessories', 'Jewellery'],
    'no coat': ['Tops', 'Bottoms', 'Shoes', 'Bags', 'Accessories', 'Jewellery'],
    'layered jewellery': ['Outerwear', 'Tops', 'Bottoms', 'Shoes', 'Jewellery', 'Jewellery', 'Jewellery'],
    'two tops and two bags': ['Outerwear', 'Tops', 'Tops', 'Bottoms', 'Bags', 'Bags', 'Accessories'],
    'an uncategorised piece': ['Outerwear', 'Tops', 'Bottoms', 'Shoes', 'Fragrance', 'Jewellery'],
  };

  for (const [shape, categories] of Object.entries(SHAPES)) {
    it(`never overlaps two pieces when overlap is off — ${shape}`, () => {
      const out = composeFlatlay(categories.map((c, i) => piece(`p${i}`, c)), { overlap: false });
      expect(out).toHaveLength(categories.length);
      for (let i = 0; i < out.length; i += 1) {
        for (let j = i + 1; j < out.length; j += 1) {
          const a = out[i];
          const b = out[j];
          const ox = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
          const oy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
          const share = (ox * oy) / Math.min(a.w * a.h, b.w * b.h);
          expect(
            share,
            `${a.item.category} covers ${(share * 100).toFixed(1)}% of ${b.item.category}`
          ).toBeLessThan(0.0001);
        }
      }
    });

    it(`keeps every piece inside the frame — ${shape}`, () => {
      for (const p of composeFlatlay(categories.map((c, i) => piece(`p${i}`, c)), { overlap: false })) {
        expect(p.x, `${p.item.category} left`).toBeGreaterThanOrEqual(0);
        expect(p.y, `${p.item.category} top`).toBeGreaterThanOrEqual(0);
        expect(p.x + p.w, `${p.item.category} right edge`).toBeLessThanOrEqual(1.0001);
        expect(p.y + p.h, `${p.item.category} bottom edge`).toBeLessThanOrEqual(1.0001);
      }
    });
  }

  it('tilts pieces within three degrees when overlap is on', () => {
    const out = composeFlatlay(LOOK, { overlap: true });
    expect(out.some((p) => p.rotation !== 0)).toBe(true);
    for (const p of out) expect(Math.abs(p.rotation)).toBeLessThanOrEqual(3);
  });

  // Two pieces in one zone tile it rather than stepping diagonally across each
  // other. Stepping was the old behaviour and it barely moved them: a second top
  // covered 96% of the first.
  //
  // Deliberately does NOT assert which axis they split along. The split follows
  // the zone's shape — a tall jewellery column stacks, a wide one sits side by
  // side — and an earlier version of this test hard-coded "side by side", so it
  // failed the moment the zone was retuned even though the behaviour was right.
  // The property that matters is that they are clear of each other.
  it('tiles a second piece in the same zone clear of the first, not on top of it', () => {
    const [first, second] = composeFlatlay(
      [piece('j1', 'Jewellery'), piece('j2', 'Jewellery')],
      { overlap: true }
    );
    const apartInX = second.x >= first.x + first.w || first.x >= second.x + second.w;
    const apartInY = second.y >= first.y + first.h || first.y >= second.y + second.h;
    expect(apartInX || apartInY, 'the two cells must not intersect').toBe(true);
    expect(second.z).toBeGreaterThan(first.z);
  });

  // Five necklaces is a real look, not a pathological one, and they must not
  // render as a single blob.
  it('gives five pieces in one zone five distinct places', () => {
    const out = composeFlatlay(
      Array.from({ length: 5 }, (_, i) => piece(`j${i}`, 'Jewellery')),
      { overlap: false, max: 8 }
    );
    expect(out).toHaveLength(5);
    const corners = new Set(out.map((p) => `${p.x.toFixed(4)},${p.y.toFixed(4)}`));
    expect(corners.size).toBe(5);
  });

  // Typical width/height of the real wardrobe photography, per category. This
  // lives in the test rather than in flatlay.js because it is a property of the
  // photographs, not of the geometry — the engine must not know about images.
  const ASPECT = {
    Outerwear: 0.62, Dresses: 0.55, Tops: 0.78, Bottoms: 0.50,
    Shoes: 1.25, Bags: 0.95, Accessories: 1.80, Jewellery: 1.00,
  };

  // The share of the frame that ends up as actual garment.
  //
  // Box area flatters badly and must not be used as the measure: a three-piece
  // look can cover 98% of the frame in boxes while painting 46% garment,
  // because object-contain fits a landscape shoe into a tall box and leaves the
  // rest as air. Ink is what the eye reads as full or sparse.
  const inkCoverage = (placements) => placements.reduce((total, p) => {
    const aspect = ASPECT[p.item.category] ?? 1;
    const boxAspect = p.w / p.h;
    const w = boxAspect > aspect ? p.h * aspect : p.w;
    const h = boxAspect > aspect ? p.h : p.w / aspect;
    return total + w * h;
  }, 0);

  const COVERAGE_SHAPES = {
    'separates': ['Outerwear', 'Tops', 'Bottoms', 'Shoes', 'Bags', 'Accessories', 'Jewellery'],
    'a dress look': ['Dresses', 'Shoes', 'Bags', 'Accessories', 'Jewellery'],
    'dress and shoes': ['Dresses', 'Shoes', 'Jewellery'],
    'no coat': ['Tops', 'Bottoms', 'Shoes', 'Bags', 'Accessories'],
    'minimal': ['Tops', 'Bottoms', 'Shoes'],
    'layered jewellery': ['Outerwear', 'Tops', 'Bottoms', 'Shoes', 'Jewellery', 'Jewellery', 'Jewellery'],
  };

  const inkFor = (categories) =>
    inkCoverage(composeFlatlay(categories.map((c, i) => piece(`p${i}`, c)), { overlap: false }));

  // A look must fill its card whatever it is made of. The fixed-zone engine
  // reserved space for garments a look did not contain, so a dress look sat at
  // 27% and a three-piece look at 21-23%.
  it('never leaves a look sparser than 30% ink', () => {
    for (const [shape, categories] of Object.entries(COVERAGE_SHAPES)) {
      expect(inkFor(categories), `${shape} is too sparse`).toBeGreaterThan(0.30);
    }
  });

  it('averages at least 45% ink across look shapes', () => {
    const shapes = Object.values(COVERAGE_SHAPES);
    const mean = shapes.reduce((t, c) => t + inkFor(c), 0) / shapes.length;
    expect(mean).toBeGreaterThan(0.45);
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
