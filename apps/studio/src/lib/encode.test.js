import { describe, it, expect } from 'vitest';
import { pickEncoding, WEBP_LADDER, JPEG_LADDER, CUTOUT_BUDGET_CHARS } from './encode.js';

// A fake encoder: produces a data URL whose LENGTH falls as quality falls, so
// the ladder's behaviour can be tested without a canvas.
const fakeEncoder = (sizeAtQuality) => {
  const calls = [];
  const encode = async (q) => {
    calls.push(q);
    return 'x'.repeat(sizeAtQuality(q));
  };
  return { encode, calls };
};

describe('pickEncoding', () => {
  it('takes the first encoding that fits, and stops there', async () => {
    // Everything fits, so the highest quality wins and nothing else is tried.
    const { encode, calls } = fakeEncoder(() => 100);
    const url = await pickEncoding(encode, [0.9, 0.8, 0.7], 1000);
    expect(url.length).toBe(100);
    expect(calls, 'must not keep encoding after one fits').toEqual([0.9]);
  });

  it('steps quality down until the result fits the budget', async () => {
    // 900 at q0.9, 600 at q0.8, 300 at q0.7 — only the last fits a 400 budget.
    const { encode, calls } = fakeEncoder((q) => (q > 0.85 ? 900 : q > 0.75 ? 600 : 300));
    const url = await pickEncoding(encode, [0.9, 0.8, 0.7], 400);
    expect(url.length).toBe(300);
    expect(calls).toEqual([0.9, 0.8, 0.7]);
  });

  // Better a slightly-too-large image than none: the caller stores what it gets,
  // and returning nothing would lose the cut-out entirely.
  it('returns the smallest attempt when nothing fits', async () => {
    const { encode } = fakeEncoder((q) => (q > 0.85 ? 900 : q > 0.75 ? 800 : 700));
    const url = await pickEncoding(encode, [0.9, 0.8, 0.7], 100);
    expect(url.length).toBe(700);
  });

  it('skips a quality the encoder could not produce', async () => {
    const encode = async (q) => (q > 0.85 ? null : 'x'.repeat(50));
    const url = await pickEncoding(encode, [0.9, 0.8], 1000);
    expect(url.length).toBe(50);
  });

  it('returns null when the encoder can produce nothing at all', async () => {
    expect(await pickEncoding(async () => null, [0.9, 0.8], 1000)).toBeNull();
  });

  // The ladders descend, or the loop would return a larger image than one it
  // had already rejected.
  it('ships ladders that only ever step down', () => {
    for (const ladder of [WEBP_LADDER, JPEG_LADDER]) {
      expect(ladder.length).toBeGreaterThan(1);
      for (let i = 1; i < ladder.length; i += 1) {
        expect(ladder[i]).toBeLessThan(ladder[i - 1]);
      }
      expect(Math.min(...ladder)).toBeGreaterThan(0);
      expect(Math.max(...ladder)).toBeLessThanOrEqual(1);
    }
  });

  // WebP reaches the same visual quality at a lower number than JPEG, and the
  // harness measured it at 0.56x JPEG on real garments — so it can afford to
  // start lower and still look better.
  it('starts the WebP ladder no higher than the JPEG one', () => {
    expect(WEBP_LADDER[0]).toBeLessThanOrEqual(JPEG_LADDER[0]);
  });

  // The budget is a data URL character count, not a byte count: base64 inflates
  // bytes by 4/3, and this string is what gets written into a Firestore
  // document alongside the original photo.
  it('keeps the cut-out budget inside the Firestore document limit', () => {
    const bytes = (CUTOUT_BUDGET_CHARS * 3) / 4;
    expect(bytes).toBeLessThan(1_048_576 / 4); // room for the original beside it
  });
});
