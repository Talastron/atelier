import { describe, it, expect } from 'vitest';
import { itemImageDisplay } from './polish.js';

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
