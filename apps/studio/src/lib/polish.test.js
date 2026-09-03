import { describe, it, expect } from 'vitest';
import { itemImageDisplay, revertFramePrimary, revertItemPrimary, flatlayTreatment, promoteImageToMain, hasAlphaCutout, surveyAlphaMigration, withStorageCutout } from './polish.js';

const mk = (images, imageMeta) => ({ images, imageMeta });

describe('itemImageDisplay', () => {
  it('prefers the Storage cut-out URL and forces contain', () => {
    const item = mk(['orig0'], [{ cutoutUrl: 'https://s/cut0.png' }]);
    expect(itemImageDisplay(item, 0)).toEqual({ src: 'https://s/cut0.png', forceContain: true });
  });
  it('treats an inline cutout (cutout:true) as contain on the stored image', () => {
    const item = mk(['cut0'], [{ cutout: true }]);
    expect(itemImageDisplay(item, 0)).toEqual({ src: 'cut0', forceContain: true });
  });
  it('falls back to the original image with no forced fit', () => {
    const item = mk(['orig0'], [{}]);
    expect(itemImageDisplay(item, 0)).toEqual({ src: 'orig0', forceContain: false });
  });
  it('handles missing imageMeta and out-of-range index', () => {
    expect(itemImageDisplay(mk(['a'], undefined), 0)).toEqual({ src: 'a', forceContain: false });
    expect(itemImageDisplay(mk([], []), 0)).toEqual({ src: null, forceContain: false });
  });
  it('prefers framedUrl over cutoutUrl and original, forcing contain', () => {
    const item = mk(['orig0'], [{ framedUrl: 'https://s/framed0.jpg', cutoutUrl: 'https://s/cut0.png' }]);
    expect(itemImageDisplay(item, 0)).toEqual({ src: 'https://s/framed0.jpg', forceContain: true });
  });
  it('still prefers cutoutUrl over original when no framedUrl', () => {
    const item = mk(['orig0'], [{ cutoutUrl: 'https://s/cut0.png' }]);
    expect(itemImageDisplay(item, 0)).toEqual({ src: 'https://s/cut0.png', forceContain: true });
  });
});

describe('revertFramePrimary', () => {
  it('strips framedUrl and frame from index 0, leaving other meta intact', () => {
    const item = {
      images: ['orig0'],
      imageMeta: [{ framedUrl: 'https://s/f0.jpg', frame: { zoom: 2, offsetX: 0.1, offsetY: 0 }, angle: 'front', cutoutUrl: 'https://s/c0.png' }],
    };
    const meta = revertFramePrimary(item);
    expect(meta[0].framedUrl).toBeUndefined();
    expect(meta[0].frame).toBeUndefined();
    expect(meta[0].angle).toBe('front');
    expect(meta[0].cutoutUrl).toBe('https://s/c0.png');
  });
  it('is a no-op-safe copy when there is no imageMeta', () => {
    expect(revertFramePrimary({ images: ['a'] })).toEqual([]);
  });
});

describe('flatlayTreatment', () => {
  // A cut-out is white-backed and sits on a white ground invisibly, so it can
  // float. A raw photograph brings its own background and cannot — it gets a
  // plate, and reads as a photograph rather than a garment. Honest either way.
  it('floats a stored cut-out', () => {
    expect(flatlayTreatment({ images: ['a.jpg'], imageMeta: [{ cutoutUrl: 'c.jpg' }] })).toBe('bare');
  });

  it('floats a framed crop', () => {
    expect(flatlayTreatment({ images: ['a.jpg'], imageMeta: [{ framedUrl: 'f.jpg' }] })).toBe('bare');
  });

  it('floats an inline cut-out that has no separate URL', () => {
    expect(flatlayTreatment({ images: ['a.jpg'], imageMeta: [{ cutout: true }] })).toBe('bare');
  });

  it('plates a raw photograph', () => {
    expect(flatlayTreatment({ images: ['a.jpg'], imageMeta: [{}] })).toBe('plate');
  });

  it('plates an item with no imageMeta at all', () => {
    expect(flatlayTreatment({ images: ['a.jpg'] })).toBe('plate');
  });

  it('plates rather than throwing on a malformed item', () => {
    expect(flatlayTreatment(null)).toBe('plate');
    expect(flatlayTreatment({})).toBe('plate');
    expect(flatlayTreatment({ imageMeta: 'nonsense' })).toBe('plate');
  });
});

describe('promoteImageToMain', () => {
  // The bug this exists to prevent: `images` and `imageMeta` are parallel
  // arrays, but imageMeta is written lazily — polishing pads it only to length
  // 1 — so on a three-photo item it is routinely SHORTER than images. Reorder
  // one without the other and imageMeta[0] describes a photo that is no longer
  // first, which is exactly what itemImageDisplay reads. The editor shows the
  // new main (it renders images[i] raw); the wardrobe and the detail page show
  // the old one, and the change looks like it silently failed to save.
  it('keeps imageMeta aligned when it is shorter than images', () => {
    const item = {
      images: ['photoA', 'photoB', 'photoC'],
      imageMeta: [{ cutoutUrl: 'cutout-of-A' }],
    };
    const next = promoteImageToMain(item, 2);
    expect(next.images).toEqual(['photoC', 'photoA', 'photoB']);
    // photoC had no metadata, so the promoted slot must be empty rather than
    // still carrying photoA's cut-out.
    expect(next.imageMeta[0]).toEqual({});
    expect(next.imageMeta[1]).toEqual({ cutoutUrl: 'cutout-of-A' });
  });

  // The property the user actually sees. Ties the two functions together:
  // whatever is promoted must be what the wardrobe renders.
  it('makes the promoted photo the one the wardrobe displays', () => {
    const item = {
      images: ['photoA', 'photoB', 'photoC'],
      imageMeta: [{ cutoutUrl: 'cutout-of-A' }],
    };
    expect(itemImageDisplay(item, 0).src).toBe('cutout-of-A');
    const next = promoteImageToMain(item, 2);
    expect(itemImageDisplay(next, 0).src).toBe('photoC');
  });

  it('carries a promoted photo’s own cut-out with it', () => {
    const item = {
      images: ['photoA', 'photoB', 'photoC'],
      imageMeta: [{ cutoutUrl: 'cutout-of-A' }, {}, { cutoutUrl: 'cutout-of-C' }],
    };
    const next = promoteImageToMain(item, 2);
    expect(itemImageDisplay(next, 0).src).toBe('cutout-of-C');
    expect(next.imageMeta).toEqual([
      { cutoutUrl: 'cutout-of-C' }, { cutoutUrl: 'cutout-of-A' }, {},
    ]);
  });

  it('handles an item with no imageMeta at all', () => {
    const next = promoteImageToMain({ images: ['a', 'b'] }, 1);
    expect(next.images).toEqual(['b', 'a']);
    expect(next.imageMeta).toEqual([{}, {}]);
  });

  it('does nothing for the first photo, a negative index, or one past the end', () => {
    const item = { images: ['a', 'b'], imageMeta: [{ cutout: true }, {}] };
    expect(promoteImageToMain(item, 0)).toBe(item);
    expect(promoteImageToMain(item, -1)).toBe(item);
    expect(promoteImageToMain(item, 5)).toBe(item);
  });

  it('does not mutate the item it is given', () => {
    const item = { images: ['a', 'b'], imageMeta: [{ cutout: true }, {}] };
    promoteImageToMain(item, 1);
    expect(item.images).toEqual(['a', 'b']);
    expect(item.imageMeta).toEqual([{ cutout: true }, {}]);
  });
});

describe('hasAlphaCutout', () => {
  it('is false for an item with no imageMeta at all', () => {
    expect(hasAlphaCutout({ images: ['a.jpg'] })).toBe(false);
  });
  it('is false for an empty imageMeta array', () => {
    expect(hasAlphaCutout(mk(['a.jpg'], []))).toBe(false);
  });
  it('is false for an inline cut-out with no alpha flag', () => {
    expect(hasAlphaCutout(mk(['cut0'], [{ cutout: true }]))).toBe(false);
  });
  it('is false for a Storage cut-out with no alpha flag', () => {
    expect(hasAlphaCutout(mk(['orig0'], [{ cutoutUrl: 'https://s/c.webp' }]))).toBe(false);
  });
  it('is true only when alpha is exactly true', () => {
    expect(hasAlphaCutout(mk(['orig0'], [{ cutoutUrl: 'https://s/c.webp', alpha: true }]))).toBe(true);
  });
  // Truthiness is not enough: a half-written migration record must not be
  // mistaken for a finished one, because the flag is also the resume checkpoint.
  it('is false for a truthy non-true alpha value', () => {
    expect(hasAlphaCutout(mk(['orig0'], [{ cutoutUrl: 'https://s/c.webp', alpha: 'yes' }]))).toBe(false);
  });
  it('is false for null and undefined items', () => {
    expect(hasAlphaCutout(null)).toBe(false);
    expect(hasAlphaCutout(undefined)).toBe(false);
  });
  // A framed crop takes display precedence over the cut-out (itemImageDisplay)
  // and is always an opaque JPEG, so its presence overrides the alpha flag.
  it('is false when framedUrl is set alongside alpha: true', () => {
    expect(hasAlphaCutout(mk(['orig0'], [{ cutoutUrl: 'https://s/c.webp', alpha: true, framedUrl: 'https://s/f.jpg' }]))).toBe(false);
  });
  it('is true again once framedUrl is removed', () => {
    expect(hasAlphaCutout(mk(['orig0'], [{ cutoutUrl: 'https://s/c.webp', alpha: true }]))).toBe(true);
  });
  // A record naming BOTH a Storage cut-out and an inline one is ambiguous:
  // itemImageDisplay draws cutoutUrl, but the flag may have been written for
  // either cut-out. This is the exact shape the editor's "Cut out" button
  // produced before it was fixed to clear cutoutUrl.
  it('is false when both cutoutUrl and inline cutout:true are set alongside alpha:true', () => {
    expect(hasAlphaCutout(mk(['orig0'], [{ cutoutUrl: 'https://s/c.webp', cutout: true, alpha: true }]))).toBe(false);
  });
  it('is false when alpha:true is set with no cut-out of either kind present', () => {
    expect(hasAlphaCutout(mk(['orig0'], [{ alpha: true }]))).toBe(false);
  });
  // The shape every newly added item carries when the alpha attempt succeeds
  // (see the add form in App.jsx), and which the survey's `already` bucket
  // depends on.
  it('is true for an inline cut-out with alpha:true and no cutoutUrl', () => {
    expect(hasAlphaCutout(mk(['cut0'], [{ cutout: true, alpha: true }]))).toBe(true);
  });
});

// The invariant that broke in five consecutive reviews: a record a writer
// produces must be one the predicate accepts. Previously this block asserted
// hand-written literals that resembled the writers' output — deleting the
// writers' marker-clearing left every test green. It now drives the real
// shaping function, so it fails if that changes.
describe('withStorageCutout round-trips through hasAlphaCutout', () => {
  const accepts = (meta) => hasAlphaCutout({ images: ['photo'], imageMeta: [meta] });

  it('accepts what a fresh polish produces', () => {
    expect(accepts(withStorageCutout({}, { cutoutUrl: 'https://s/c.webp', alpha: true }))).toBe(true);
  });

  // The add-path shape. This is the case that shipped broken: the inline marker
  // survived alongside the new Storage URL, and the guard refused the record,
  // so the item never bled and every migration run re-cut it.
  it('accepts what migrating an inline cut-out produces', () => {
    expect(accepts(withStorageCutout({ cutout: true }, { cutoutUrl: 'https://s/c.webp', alpha: true }))).toBe(true);
  });

  it('clears the inline marker a Storage cut-out supersedes', () => {
    expect(withStorageCutout({ cutout: true }, { cutoutUrl: 'u', alpha: true })).not.toHaveProperty('cutout');
  });

  it('clears a crop taken from the image it replaces', () => {
    const out = withStorageCutout({ framedUrl: 'f', frame: { x: 1 } }, { cutoutUrl: 'u', alpha: true });
    expect(out).not.toHaveProperty('framedUrl');
    expect(out).not.toHaveProperty('frame');
  });

  it('does not claim alpha when the encode did not keep it', () => {
    const out = withStorageCutout({ alpha: true }, { cutoutUrl: 'u', alpha: false });
    expect(out).not.toHaveProperty('alpha');
    expect(accepts(out)).toBe(false);
  });

  it('does not mutate the meta it is given', () => {
    const before = { cutout: true, alpha: true };
    withStorageCutout(before, { cutoutUrl: 'u', alpha: true });
    expect(before).toEqual({ cutout: true, alpha: true });
  });
});

describe('revertItemPrimary', () => {
  it('drops the Storage cut-out and records the decline', () => {
    const item = mk(['orig0'], [{ cutoutUrl: 'https://s/c.webp', cutout: true, alpha: true, angle: 'front' }]);
    const meta = revertItemPrimary(item);
    expect(meta[0].cutoutUrl).toBeUndefined();
    expect(meta[0].alpha).toBe(false);
    expect(meta[0].angle).toBe('front');
    expect(hasAlphaCutout({ ...item, imageMeta: meta })).toBe(false);
  });

  // `cutout` is a statement of FACT — images[0] is a cut-out — and stays true
  // through a revert. Deleting it made the app forget, so the item rendered as a
  // raw photograph on a plate rather than as the bare cut-out it still is.
  it('keeps the inline marker, which is still true of images[0]', () => {
    const meta = revertItemPrimary(mk(['inline-cutout'], [{ cutoutUrl: 'https://s/c.webp', cutout: true, alpha: true }]));
    expect(meta[0].cutout).toBe(true);
    expect(itemImageDisplay({ images: ['inline-cutout'], imageMeta: meta }, 0))
      .toEqual({ src: 'inline-cutout', forceContain: true });
  });

  // The durability property. A garment the segmentation cannot handle - a white
  // top on white - is reverted deliberately, and the next re-cut run must leave
  // it alone rather than spend nine seconds undoing the choice.
  it('survives the next migration run', () => {
    const item = mk(['inline-cutout'], [{ cutoutUrl: 'https://s/c.webp', cutout: true, alpha: true }]);
    const reverted = { ...item, imageMeta: revertItemPrimary(item) };
    const survey = surveyAlphaMigration([reverted]);
    expect(survey.targets).toEqual([]);
    expect(survey.declined).toBe(1);
  });

  it('is a no-op-safe copy when there is no imageMeta', () => {
    expect(revertItemPrimary({ images: ['a'] })).toEqual([]);
  });

  it('does not mutate the item it is given', () => {
    const item = mk(['orig0'], [{ cutoutUrl: 'https://s/c.webp', alpha: true }]);
    revertItemPrimary(item);
    expect(item.imageMeta[0]).toEqual({ cutoutUrl: 'https://s/c.webp', alpha: true });
  });
});

describe('surveyAlphaMigration', () => {
  const already = mk(['orig0'], [{ cutoutUrl: 'https://s/c.webp', alpha: true }]);
  // Inline-shaped already/target fixtures cover the arm where the Critical
  // this branch fixes actually lived: polishItemPrimary migrating exactly
  // this shape without clearing the inline marker.
  const alreadyInline = mk(['cut0'], [{ cutout: true, alpha: true }]);
  const framed = mk(['orig0'], [{ cutoutUrl: 'https://s/c.webp', framedUrl: 'https://s/f.jpg', frame: {} }]);
  const noCutout = mk(['orig0'], [{}]);
  const noSource = mk([], [{ cutoutUrl: 'https://s/c.webp' }]);
  const target = mk(['orig0'], [{ cutoutUrl: 'https://s/c.webp' }]);
  const targetInline = mk(['cut0'], [{ cutout: true }]);

  // A sum-only assertion can't fail on its own: surveyAlphaMigration is an
  // if/else if chain, so every item lands in exactly one bucket for ANY
  // bucketing logic, correct or not — the sum holds even if every item were
  // miscategorised. This pins down the counts AND the identities, so it can
  // actually fail; the sum is kept only alongside them, as a redundant check.
  it('sorts a mixed wardrobe into exact per-bucket counts and identifies the targets precisely', () => {
    const items = [already, alreadyInline, framed, noCutout, noSource, target, targetInline];
    const result = surveyAlphaMigration(items);
    expect(result.already).toBe(2);
    expect(result.framed).toBe(1);
    expect(result.noCutout).toBe(1);
    expect(result.noSource).toBe(1);
    expect(result.targets).toEqual([target, targetInline]);
    expect(result.targets.length + result.already + result.framed + result.noCutout + result.noSource)
      .toBe(items.length);
  });

  it('is empty and all-zero for an empty wardrobe', () => {
    expect(surveyAlphaMigration([])).toEqual({ targets: [], already: 0, framed: 0, noCutout: 0, noSource: 0, declined: 0 });
  });

  it('treats a non-array input as an empty wardrobe rather than throwing', () => {
    expect(surveyAlphaMigration(null)).toEqual({ targets: [], already: 0, framed: 0, noCutout: 0, noSource: 0, declined: 0 });
    expect(surveyAlphaMigration(undefined)).toEqual({ targets: [], already: 0, framed: 0, noCutout: 0, noSource: 0, declined: 0 });
  });

  it('counts an already-migrated item as already, not a target', () => {
    const result = surveyAlphaMigration([already]);
    expect(result).toMatchObject({ targets: [], already: 1, framed: 0, noCutout: 0, noSource: 0 });
  });

  it('counts an already-migrated inline cut-out as already, not a target', () => {
    const result = surveyAlphaMigration([alreadyInline]);
    expect(result).toMatchObject({ targets: [], already: 1, framed: 0, noCutout: 0, noSource: 0 });
  });

  it('counts a framed item as framed, not a target, even though it has a cut-out', () => {
    const result = surveyAlphaMigration([framed]);
    expect(result).toMatchObject({ targets: [], already: 0, framed: 1, noCutout: 0, noSource: 0 });
  });

  it('counts an item with no cut-out at all as noCutout, distinct from noSource', () => {
    const result = surveyAlphaMigration([noCutout]);
    expect(result).toMatchObject({ targets: [], already: 0, framed: 0, noCutout: 1, noSource: 0 });
  });

  it('counts a cut-out item with no source photo as noSource', () => {
    const result = surveyAlphaMigration([noSource]);
    expect(result).toMatchObject({ targets: [], already: 0, framed: 0, noCutout: 0, noSource: 1 });
  });

  it('targets an inline cut-out with no alpha, same as a Storage one', () => {
    const result = surveyAlphaMigration([targetInline]);
    expect(result.targets).toEqual([targetInline]);
  });
});
