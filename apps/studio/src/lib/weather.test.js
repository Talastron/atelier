import { describe, it, expect, vi, afterEach } from 'vitest';
import { weatherAppropriatenessScore, pickTodaysRecommendation, weatherToSeasons } from './weather.js';

// pickTodaysRecommendation does NOT return the top-scoring item. It takes the
// top max(3, 20%) and then picks among them by hashing today's date, so the
// choice is stable through a day and rotates across days. With a small
// candidate pool that rotation IS the decision, so any assertion about a single
// date is a coin flip. Every test here that exercises the picker drives the
// clock across a range of dates instead.
afterEach(() => { vi.useRealTimers(); });

const offeredAcrossSeptember = (wardrobe, tempC) => {
  const offered = new Set();
  for (let day = 1; day <= 28; day += 1) {
    vi.setSystemTime(new Date(2026, 8, day));
    offered.add(pickTodaysRecommendation(wardrobe, tempC)?.id);
  }
  vi.useRealTimers();
  return offered;
};

// The real item that prompted this work: Today's Pick offered it on a 24C day.
const FLEECE = {
  id: 'fleece',
  name: 'Ladies Country Fleece Quarter Zip',
  brand: 'Holland Cooper',
  category: 'Tops',
  subCategory: '',
  status: 'owned',
  seasons: ['Autumn', 'Winter'],
};

const LINEN_SHIRT = {
  id: 'linen',
  name: 'Linen Shirt',
  category: 'Tops',
  subCategory: 'Shirt',
  status: 'owned',
  seasons: ['Spring', 'Summer'],
  materials: ['Linen'],
  lastWorn: '2026-08-01',
};

describe('weatherToSeasons', () => {
  // The bands that already existed. 24C is Summer — which is the whole point:
  // the wardrobe already had a function that knew the fleece was wrong.
  it('maps a temperature to the seasons it feels like', () => {
    expect(weatherToSeasons({ temp: 2 })).toEqual(['Winter']);
    expect(weatherToSeasons({ temp: 10 })).toEqual(['Autumn', 'Winter']);
    expect(weatherToSeasons({ temp: 18 })).toEqual(['Spring', 'Autumn']);
    expect(weatherToSeasons({ temp: 24 })).toEqual(['Summer']);
  });

  it('is null with no weather', () => {
    expect(weatherToSeasons(null)).toBeNull();
  });
});

describe('the fleece at 24C — characterisation of the bug', () => {
  // Documents CURRENT behaviour so the fix is provably a change. Both of these
  // assertions are inverted in Task 3.
  it('currently scores the fleece as neutral, having no opinion', () => {
    expect(weatherAppropriatenessScore(FLEECE, 24)).toBe(0.5);
  });

  // Across a month of dates rather than one: the date hash decides which of the
  // top candidates is surfaced, so a single date proves nothing either way.
  // What matters is that the fleece is offered AT ALL on a 24C day.
  it('currently offers the fleece on some 24C days', () => {
    expect(offeredAcrossSeptember([FLEECE, LINEN_SHIRT], 24)).toContain('fleece');
  });
});
