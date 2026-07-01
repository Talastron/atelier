import { describe, it, expect } from 'vitest';
import { itemImageDisplay, revertFramePrimary } from './polish.js';

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
