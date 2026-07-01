import { describe, it, expect } from 'vitest';
import { FRAME_ASPECT, defaultFrame, computeCropRect } from './framing.js';

describe('framing geometry', () => {
  it('FRAME_ASPECT is 3:4 portrait (width/height)', () => {
    expect(FRAME_ASPECT).toBeCloseTo(0.75, 5);
  });

  it('defaultFrame is centred at zoom 1', () => {
    expect(defaultFrame()).toEqual({ zoom: 1, offsetX: 0, offsetY: 0 });
  });

  it('zoom 1 on a square source yields the largest centred 3:4 crop', () => {
    const r = computeCropRect({ naturalW: 1000, naturalH: 1000, zoom: 1, offsetX: 0, offsetY: 0 });
    expect(r.sw).toBeCloseTo(750, 3);
    expect(r.sh).toBeCloseTo(1000, 3);
    expect(r.sx).toBeCloseTo(125, 3);
    expect(r.sy).toBeCloseTo(0, 3);
    expect(r.sw / r.sh).toBeCloseTo(FRAME_ASPECT, 5);
  });

  it('zoom 2 halves both crop dimensions and re-centres', () => {
    const r = computeCropRect({ naturalW: 1000, naturalH: 1000, zoom: 2, offsetX: 0, offsetY: 0 });
    expect(r.sw).toBeCloseTo(375, 3);
    expect(r.sh).toBeCloseTo(500, 3);
    expect(r.sx).toBeCloseTo(312.5, 3);
    expect(r.sy).toBeCloseTo(250, 3);
  });

  it('offsets clamp so the crop never leaves the image', () => {
    const r = computeCropRect({ naturalW: 1000, naturalH: 1000, zoom: 1, offsetX: 5, offsetY: -5 });
    expect(r.sx).toBeCloseTo(250, 3);
    expect(r.sy).toBeCloseTo(0, 3);
    expect(r.sx + r.sw).toBeLessThanOrEqual(1000 + 1e-6);
  });

  it('a tall source resolves to a valid 3:4 crop constrained by width', () => {
    const r = computeCropRect({ naturalW: 600, naturalH: 1200, zoom: 1 });
    expect(r.sw).toBeCloseTo(600, 3);
    expect(r.sh).toBeCloseTo(800, 3);
    expect(r.sx).toBeCloseTo(0, 3);
    expect(r.sy).toBeCloseTo(200, 3);
  });
});
