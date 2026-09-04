import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  weatherAppropriatenessScore, pickTodaysRecommendation, weatherToSeasons,
  seasonsForTemp, pickVeto, isPickableToday,
} from './weather.js';

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

describe('seasonsForTemp', () => {
  it('maps a bare temperature to the seasons it feels like', () => {
    expect(seasonsForTemp(2)).toEqual(['Winter']);
    expect(seasonsForTemp(10)).toEqual(['Autumn', 'Winter']);
    expect(seasonsForTemp(18)).toEqual(['Spring', 'Autumn']);
    expect(seasonsForTemp(24)).toEqual(['Summer']);
  });

  it('is null when the temperature is unknown', () => {
    expect(seasonsForTemp(null)).toBeNull();
    expect(seasonsForTemp(undefined)).toBeNull();
    expect(seasonsForTemp(NaN)).toBeNull();
  });

  // The boundaries, because they are the lever if the veto proves too strict.
  it('treats the band edges as the lower bound of the warmer band', () => {
    expect(seasonsForTemp(5)).toEqual(['Autumn', 'Winter']);
    expect(seasonsForTemp(14)).toEqual(['Spring', 'Autumn']);
    expect(seasonsForTemp(22)).toEqual(['Summer']);
  });

  // One source of truth: the object-shaped entry point must agree with the
  // temperature-shaped one at every boundary.
  it('agrees with weatherToSeasons', () => {
    for (const t of [-5, 0, 4, 5, 13, 14, 21, 22, 30]) {
      expect(weatherToSeasons({ temp: t }), `${t}C`).toEqual(seasonsForTemp(t));
    }
  });
});

describe('pickVeto', () => {
  it('vetoes a garment whose declared seasons contradict the day', () => {
    expect(pickVeto(FLEECE, 24)).toBe('wrong-season');
  });

  it('allows a garment whose declared seasons include the day', () => {
    expect(pickVeto(LINEN_SHIRT, 24)).toBeNull();
    expect(pickVeto(FLEECE, 8)).toBeNull();
  });

  // Silence is not a declaration. Vetoing on absent data would punish anything
  // that was never scanned, which is a data gap rather than a wrong garment.
  it('allows a garment that declares no seasons, at any temperature', () => {
    const untagged = { id: 'u', name: 'Plain Tee', category: 'Tops', status: 'owned' };
    for (const t of [-5, 8, 18, 24, 35]) {
      expect(pickVeto(untagged, t), `${t}C`).toBeNull();
    }
  });

  // Today's Pick answers "what should I wear", so it suggests something worn.
  // Also load-bearing for the veto: these categories rarely declare seasons, so
  // once cold-weather garments are vetoed they would be most of what remains
  // and would win on neglect alone.
  it('vetoes anything that is not a garment, at every temperature', () => {
    for (const category of ['Shoes', 'Bags', 'Accessories', 'Jewellery', 'Sportswear', 'Swimwear']) {
      const item = { id: category, name: category, category, status: 'owned', seasons: ['Summer'] };
      expect(pickVeto(item, 24), category).toBe('not-a-garment');
    }
  });

  it('allows all four garment categories', () => {
    for (const category of ['Tops', 'Bottoms', 'Dresses', 'Outerwear']) {
      const item = { id: category, name: category, category, status: 'owned', seasons: ['Summer'] };
      expect(pickVeto(item, 24), category).toBeNull();
    }
  });

  it('vetoes nothing on season when the temperature is unknown', () => {
    expect(pickVeto(FLEECE, null)).toBeNull();
  });

  it('still vetoes a non-garment when the temperature is unknown', () => {
    expect(pickVeto({ id: 'j', category: 'Jewellery', status: 'owned' }, null)).toBe('not-a-garment');
  });

  it('is falsy-safe', () => {
    expect(pickVeto(null, 24)).toBe('not-a-garment');
    expect(pickVeto({}, 24)).toBe('not-a-garment');
  });

  // The two must never disagree about the same item.
  it('isPickableToday is exactly the absence of a veto', () => {
    for (const item of [FLEECE, LINEN_SHIRT, { category: 'Jewellery' }]) {
      for (const t of [8, 24, null]) {
        expect(isPickableToday(item, t)).toBe(pickVeto(item, t) === null);
      }
    }
  });
});

describe('pickTodaysRecommendation', () => {
  // The inversion of the characterisation test. "Never, on any date" is the
  // property that matters and the one a single-date assertion cannot express —
  // the date hash chooses among the top candidates, so one date proves nothing.
  it('never offers the fleece on a 24C day, whatever the date', () => {
    const offered = offeredAcrossSeptember([FLEECE, LINEN_SHIRT], 24);
    expect(offered).not.toContain('fleece');
    expect(offered).toEqual(new Set(['linen']));
  });

  it('offers the fleece on a cold day, and never the linen shirt', () => {
    const offered = offeredAcrossSeptember([FLEECE, LINEN_SHIRT], 8);
    expect(offered).toEqual(new Set(['fleece']));
  });

  it('returns null when every garment contradicts the day', () => {
    expect(pickTodaysRecommendation([FLEECE], 24)).toBeNull();
  });

  it('returns null for a wardrobe with no garments in it', () => {
    const jewellery = { id: 'j', name: 'Hoops', category: 'Jewellery', status: 'owned' };
    expect(pickTodaysRecommendation([jewellery], 24)).toBeNull();
  });

  it('ignores items that are not owned', () => {
    const wishlist = { ...LINEN_SHIRT, id: 'w', status: 'wishlist' };
    expect(pickTodaysRecommendation([wishlist], 24)).toBeNull();
  });

  // THE property that failed. The calendar month must not affect the pick at
  // all — the same wardrobe at the same temperature must give the same answer
  // in September as in June.
  it('gives the same pick whatever the month', () => {
    const wardrobe = [FLEECE, LINEN_SHIRT];
    const picks = new Set();
    for (const month of [0, 3, 6, 8, 11]) {
      vi.setSystemTime(new Date(2026, month, 15));
      picks.add(pickTodaysRecommendation(wardrobe, 24)?.id);
    }
    vi.useRealTimers();
    expect(picks).toEqual(new Set(['linen']));
  });
});

describe('weatherAppropriatenessScore', () => {
  // The word "Fleece" is in the item's NAME. The function used to build its
  // matched text from category, subCategory and styles only, so it returned a
  // neutral 0.5 and had no opinion about a fleece on a warm day.
  it('reads the item name, not just its category and tags', () => {
    const fleece = { name: 'Ladies Country Fleece Quarter Zip', category: 'Tops', subCategory: '' };
    expect(weatherAppropriatenessScore(fleece, 24)).toBeLessThan(0.5);
  });

  it('penalises each heavy pattern on a warm day', () => {
    for (const word of ['fleece', 'sweatshirt', 'sherpa', 'shearling', 'quilted', 'padded', 'down', 'thermal', 'flannel']) {
      const item = { name: `A ${word} thing`, category: 'Tops', subCategory: '' };
      expect(weatherAppropriatenessScore(item, 24), word).toBeLessThan(0.5);
    }
  });

  it('penalises each heavy pattern harder on a hot day', () => {
    for (const word of ['fleece', 'sweatshirt', 'sherpa', 'shearling', 'quilted', 'padded', 'down', 'thermal', 'flannel']) {
      const item = { name: `A ${word} thing`, category: 'Tops', subCategory: '' };
      expect(weatherAppropriatenessScore(item, 30), word)
        .toBeLessThan(weatherAppropriatenessScore(item, 24));
    }
  });

  it('rewards each heavy pattern on a cold day', () => {
    for (const word of ['fleece', 'sweatshirt', 'sherpa', 'shearling', 'quilted', 'padded', 'down', 'thermal', 'flannel']) {
      const item = { name: `A ${word} thing`, category: 'Tops', subCategory: '' };
      expect(weatherAppropriatenessScore(item, 2), word).toBeGreaterThan(0.5);
    }
  });

  it('is neutral when the temperature is unknown', () => {
    expect(weatherAppropriatenessScore({ name: 'Fleece', category: 'Tops' }, null)).toBe(0.5);
  });

  it('stays within 0..1', () => {
    const worst = { name: 'quilted padded down thermal fleece wool cashmere', category: 'Outerwear', subCategory: 'Puffer coat' };
    expect(weatherAppropriatenessScore(worst, 35)).toBeGreaterThanOrEqual(0);
    expect(weatherAppropriatenessScore(worst, 35)).toBeLessThanOrEqual(1);
    const best = { name: 'linen sleeveless cotton camisole tank', category: 'Tops' };
    expect(weatherAppropriatenessScore(best, 35)).toBeLessThanOrEqual(1);
  });

  it('is falsy-safe', () => {
    expect(weatherAppropriatenessScore({}, 24)).toBe(0.5);
  });
});
