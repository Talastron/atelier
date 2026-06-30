import { describe, it, expect } from 'vitest';
import {
  clamp01, fitTier, selectAspirationBasis, isFitStale,
  buildItemSummaryLine, buildItemFitPrompt, parseAndNormalizeFit,
} from './itemFit.js';

describe('clamp01', () => {
  it('clamps to [0,1] and coerces NaN to 0', () => {
    expect(clamp01(1.4)).toBe(1);
    expect(clamp01(-0.2)).toBe(0);
    expect(clamp01(0.5)).toBe(0.5);
    expect(clamp01(NaN)).toBe(0);
    expect(clamp01('x')).toBe(0);
  });
});

describe('fitTier (coherence floor)', () => {
  it('caps off-aesthetic items low regardless of aspiration', () => {
    expect(fitTier(0.2, 0.95)).toBe('A departure');
  });
  it('rewards coherent, gap-closing items', () => {
    expect(fitTier(0.95, 0.9)).toBe('Unmistakably you');
  });
  it('returns a middle tier for coherent-but-modest aspiration', () => {
    expect(fitTier(0.8, 0.3)).toBe('A considered reach');
  });
});

describe('selectAspirationBasis', () => {
  it('uses inspirations when at least one is analysed', () => {
    expect(selectAspirationBasis([{ analysis: { summary: 'x' } }])).toBe('inspirations');
  });
  it('falls back to profile when none are analysed', () => {
    expect(selectAspirationBasis([])).toBe('profile');
    expect(selectAspirationBasis([{ caption: 'no analysis' }])).toBe('profile');
    expect(selectAspirationBasis(null)).toBe('profile');
  });
});

describe('isFitStale', () => {
  it('is stale when no cached fit exists', () => {
    expect(isFitStale({}, '2026-06-01T00:00:00Z')).toBe(true);
  });
  it('is fresh when cached manifestoAt matches current', () => {
    expect(isFitStale({ manifestoFit: { manifestoAt: 'A' } }, 'A')).toBe(false);
  });
  it('is stale when the manifesto has been regenerated since', () => {
    expect(isFitStale({ manifestoFit: { manifestoAt: 'A' } }, 'B')).toBe(true);
  });
});

describe('buildItemSummaryLine', () => {
  it('formats name, brand, category and attributes', () => {
    const line = buildItemSummaryLine({
      name: 'Camel coat', brand: 'The Row', category: 'Outerwear', subCategory: 'Coats',
      colors: ['Camel'], styles: ['Smart', 'Minimal'],
    });
    expect(line).toContain('Camel coat');
    expect(line).toContain('The Row');
    expect(line).toContain('Outerwear/Coats');
    expect(line).toContain('colours=Camel');
    expect(line).toContain('styles=Smart,Minimal');
  });
  it('handles missing fields gracefully', () => {
    expect(buildItemSummaryLine({ name: 'Thing' })).toContain('Thing');
  });
});

describe('buildItemFitPrompt', () => {
  const base = { itemLine: '- Camel coat (The Row)', manifesto: 'You wear quiet tailoring.', styleProfile: 'Style profile: polished.' };
  it('includes the item, manifesto and adapts wording for inspirations basis', () => {
    const p = buildItemFitPrompt({ ...base, inspirationsSummary: '- editorial minimalism', basis: 'inspirations' });
    expect(p).toContain('Camel coat');
    expect(p).toContain('You wear quiet tailoring.');
    expect(p).toContain('what you save');
  });
  it('adapts wording for the profile basis', () => {
    const p = buildItemFitPrompt({ ...base, inspirationsSummary: '', basis: 'profile' });
    expect(p).toContain('the style you’ve described');
  });
});

describe('parseAndNormalizeFit', () => {
  it('parses, clamps and derives the tier', () => {
    const raw = JSON.stringify({ verdict: 'It belongs.', coherence: 1.3, aspiration: 0.9, dimensions: [{ label: 'Palette', state: 'Aligned', level: 0.92 }] });
    const out = parseAndNormalizeFit(raw, { basis: 'inspirations' });
    expect(out.verdict).toBe('It belongs.');
    expect(out.coherence).toBe(1);
    expect(out.tier).toBe('Unmistakably you');
    expect(out.dimensions).toHaveLength(1);
    expect(out.basis).toBe('inspirations');
  });
  it('throws a friendly error on invalid JSON', () => {
    expect(() => parseAndNormalizeFit('not json', {})).toThrow(/unexpected format/i);
  });
});
