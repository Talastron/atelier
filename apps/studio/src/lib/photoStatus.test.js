import { describe, it, expect } from 'vitest';
import { imageStatus, applyCutoutResult, prefersBackgroundRemoval } from './photoStatus.js';

describe('prefersBackgroundRemoval', () => {
  it('defaults to on for a setting nobody has touched', () => {
    // The bug this exists for: Profile showed "On" for undefined while
    // App.jsx read it as false, so the feature was silently inert for
    // everyone who never opened the toggle.
    expect(prefersBackgroundRemoval({})).toBe(true);
    expect(prefersBackgroundRemoval(undefined)).toBe(true);
    expect(prefersBackgroundRemoval(null)).toBe(true);
  });

  it('respects an explicit choice either way', () => {
    expect(prefersBackgroundRemoval({ removeBackground: false })).toBe(false);
    expect(prefersBackgroundRemoval({ removeBackground: true })).toBe(true);
  });
});

describe('imageStatus', () => {
  it('reports a queued or running photo as processing', () => {
    expect(imageStatus({ processing: true })).toBe('processing');
  });

  it('reports a finished cut-out', () => {
    expect(imageStatus({ cutout: true, original: 'data:x' })).toBe('cutout');
    expect(imageStatus({ cutout: true, alpha: true, original: 'data:x' })).toBe('cutout');
  });

  it('reports anything else as the original photo', () => {
    // Removal declined, failed, or never requested all land here. The photo
    // is perfectly usable; it simply has its background.
    expect(imageStatus({})).toBe('original');
    expect(imageStatus({ cutout: false })).toBe('original');
    expect(imageStatus(undefined)).toBe('original');
    expect(imageStatus(null)).toBe('original');
  });

  it('does not report processing once a result has landed', () => {
    expect(imageStatus({ processing: true, cutout: true })).toBe('cutout');
  });
});

describe('applyCutoutResult', () => {
  const meta = [
    { processing: true },
    { cutout: true, original: 'data:a' },
  ];

  it('records a successful cut-out and clears processing', () => {
    const next = applyCutoutResult(meta, 0, { ok: true, alpha: true, original: 'data:b' });
    expect(next[0]).toEqual({ cutout: true, alpha: true, original: 'data:b' });
    expect(imageStatus(next[0])).toBe('cutout');
  });

  it('omits alpha when the cut-out could not keep it', () => {
    const next = applyCutoutResult(meta, 0, { ok: true, alpha: false, original: 'data:b' });
    expect('alpha' in next[0]).toBe(false);
    expect(next[0].cutout).toBe(true);
  });

  it('leaves a failed photo as an ordinary original', () => {
    const next = applyCutoutResult(meta, 0, { ok: false });
    expect(imageStatus(next[0])).toBe('original');
    expect(next[0].processing).toBeUndefined();
  });

  it('leaves the other entries untouched', () => {
    const next = applyCutoutResult(meta, 0, { ok: true, alpha: true, original: 'data:b' });
    expect(next[1]).toEqual(meta[1]);
  });

  it('does not mutate the array it was given', () => {
    const next = applyCutoutResult(meta, 0, { ok: true, alpha: true, original: 'data:b' });
    expect(meta[0]).toEqual({ processing: true });
    expect(next).not.toBe(meta);
  });

  it('ignores a result for a photo that no longer exists', () => {
    // The user can delete a photo while its cut-out is still running. That
    // must not throw, and must not resurrect the deleted entry.
    const next = applyCutoutResult(meta, 9, { ok: true, alpha: true, original: 'data:b' });
    expect(next).toEqual(meta);
    expect(applyCutoutResult(undefined, 0, { ok: true })).toEqual([]);
  });
});
