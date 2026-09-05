import { describe, it, expect } from 'vitest';
import { inferBudget, MIN_PRICED_ITEMS } from './budget.js';

const owned = (price) => ({ status: 'owned', price });

describe('inferBudget', () => {
  it('reports the median and the 90th percentile', () => {
    const items = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(owned);
    const b = inferBudget(items);
    expect(b.typical).toBe(60);
    expect(b.high).toBe(100);
    expect(b.sampleSize).toBe(10);
  });

  it('is not dragged by one extraordinary purchase', () => {
    // The real wardrobe this was designed against holds a £3,500 Cartier
    // watch among items at £49. A mean would report a typical spend nobody
    // recognises; the median must not move.
    const items = [40, 45, 50, 55, 60, 65, 70, 75, 80, 3500].map(owned);
    const b = inferBudget(items);
    const mean = (40+45+50+55+60+65+70+75+80+3500) / 10;
    expect(mean).toBeGreaterThan(390);      // what we are avoiding
    expect(b.typical).toBeLessThan(100);    // what we report
  });

  it('ignores items with no usable price rather than counting them as zero', () => {
    const items = [
      ...[10, 20, 30, 40, 50, 60, 70, 80].map(owned),
      { status: 'owned', price: null },
      { status: 'owned', price: '' },
      { status: 'owned', price: 'ask' },
      { status: 'owned', price: 0 },
    ];
    expect(inferBudget(items).sampleSize).toBe(8);
  });

  it('counts what you have spent, not what you might', () => {
    const items = [
      ...[10, 20, 30, 40, 50, 60, 70, 80].map(owned),
      { status: 'wishlist', price: 5000 },
      { status: 'owned', price: 5000, deletedAt: '2026-01-01' },
    ];
    expect(inferBudget(items).sampleSize).toBe(8);
  });

  it('says nothing rather than guessing from too few prices', () => {
    const items = [10, 20, 30, 40].map(owned);
    expect(items.length).toBeLessThan(MIN_PRICED_ITEMS);
    expect(inferBudget(items)).toBeNull();
  });

  it('survives rubbish input', () => {
    expect(inferBudget(null)).toBeNull();
    expect(inferBudget(undefined)).toBeNull();
    expect(inferBudget([])).toBeNull();
  });
});
