import { describe, it, expect } from 'vitest';
import { itemImageDisplay, revertFramePrimary, flatlayTreatment, promoteImageToMain } from './polish.js';

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
