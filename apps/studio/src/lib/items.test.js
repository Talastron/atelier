import { describe, it, expect } from 'vitest';
import { deriveShortName, itemDisplayName } from './items.js';
import { currentSeasonLabel } from './items.js';
import { summariseStyleProfile } from './items.js';

describe('currentSeasonLabel', () => {
  it('maps March, April, May to Spring', () => {
    expect(currentSeasonLabel(new Date('2026-03-15'))).toBe('Spring');
    expect(currentSeasonLabel(new Date('2026-04-01'))).toBe('Spring');
    expect(currentSeasonLabel(new Date('2026-05-31'))).toBe('Spring');
  });

  it('maps June, July, August to Summer', () => {
    expect(currentSeasonLabel(new Date(2026, 5, 1))).toBe('Summer'); // June 1
    expect(currentSeasonLabel(new Date('2026-07-13'))).toBe('Summer');
    expect(currentSeasonLabel(new Date('2026-08-31'))).toBe('Summer');
  });

  it('maps September, October, November to Autumn', () => {
    expect(currentSeasonLabel(new Date(2026, 8, 1))).toBe('Autumn'); // Sept 1
    expect(currentSeasonLabel(new Date('2026-11-30'))).toBe('Autumn');
  });

  it('maps December, January, February to Winter', () => {
    expect(currentSeasonLabel(new Date(2026, 11, 1))).toBe('Winter'); // Dec 1
    expect(currentSeasonLabel(new Date('2026-01-15'))).toBe('Winter');
    expect(currentSeasonLabel(new Date('2026-02-28'))).toBe('Winter');
  });

  it('defaults to the current date when called with no argument', () => {
    // Just confirms it returns one of the four valid labels without throwing.
    expect(['Spring', 'Summer', 'Autumn', 'Winter']).toContain(currentSeasonLabel());
  });
});


describe('deriveShortName', () => {
  it('drops the retailer metadata after a pipe', () => {
    expect(deriveShortName('Belt shirt dress | Whistles')).toBe('Belt shirt dress');
  });

  it('shortens a listing title to something sayable', () => {
    expect(deriveShortName('Molten Snow Triple Small Hoop Earrings | 18ct Gold Plated/Cubic Zirconia'))
      .toBe('Molten Snow Triple Small Hoop');
    expect(deriveShortName('Solitaire Diamond Mini Chain Necklace | Monica Vinader'))
      .toBe('Solitaire Diamond Mini Chain');
  });

  it('leaves a name that is already short alone', () => {
    expect(deriveShortName('Belt shirt dress')).toBe('Belt shirt dress');
  });

  // Never mid-word, never an ellipsis.
  it('cuts on a word boundary and leaves no trailing punctuation', () => {
    const out = deriveShortName('Merisa Gold, Wide-Fit Block-Heel Sandals | Dune London');
    expect(out).toBe('Merisa Gold, Wide-Fit Block-Heel');
    expect(out).not.toMatch(/[…,\s]$/);
  });

  it('leaves an over-long single word whole rather than mangling it', () => {
    const word = 'Supercalifragilisticexpialidociousgarment';
    expect(deriveShortName(word)).toBe(word);
  });

  it('handles nothing gracefully', () => {
    expect(deriveShortName('')).toBe('');
    expect(deriveShortName(null)).toBe('');
  });
});

describe('itemDisplayName', () => {
  it('prefers a shortName the wearer set themselves', () => {
    expect(itemDisplayName({ name: 'Slim Fit Stretch Chinos | Ralph Lauren', shortName: 'Navy chinos' }))
      .toBe('Navy chinos');
  });

  it('falls back to the derived name when no shortName is set', () => {
    expect(itemDisplayName({ name: 'Slim Fit Stretch Chinos | Ralph Lauren' }))
      .toBe('Slim Fit Stretch Chinos');
  });

  // A blank override must not blank the name on screen.
  it('ignores an empty or whitespace shortName', () => {
    expect(itemDisplayName({ name: 'Belt shirt dress', shortName: '   ' })).toBe('Belt shirt dress');
    expect(itemDisplayName({ name: 'Belt shirt dress', shortName: '' })).toBe('Belt shirt dress');
  });

  it('survives a missing item', () => {
    expect(itemDisplayName(null)).toBe('');
    expect(itemDisplayName({})).toBe('');
  });
});

describe('summariseStyleProfile — goals and budget', () => {
  it('says nothing at all for an untouched profile', () => {
    expect(summariseStyleProfile({})).toBe('');
    expect(summariseStyleProfile(null)).toBe('');
  });

  it('states the goals when only goals are set', () => {
    const s = summariseStyleProfile({ styleGoals: ['Buy less, wear more'] });
    expect(s).toContain('working toward: buy less, wear more');
  });

  it('joins two goals', () => {
    const s = summariseStyleProfile({
      styleGoals: ['Dress better for work', 'Buy less, wear more'],
    });
    expect(s).toContain('dress better for work; buy less, wear more');
  });

  it('states the budget when only budget is set', () => {
    const s = summariseStyleProfile({ budgetTypical: 80, budgetHigh: 400 });
    expect(s).toContain('typically spends around £80 a piece, £400 is a big buy');
  });

  it('carries both alongside the existing profile', () => {
    const s = summariseStyleProfile({
      styleUndertone: 'Cool',
      styleGoals: ['Build a capsule I actually wear'],
      budgetTypical: 80,
      budgetHigh: 400,
    });
    expect(s).toContain('undertone is cool');
    expect(s).toContain('working toward');
    expect(s).toContain('£80');
    expect(s.startsWith('Style profile:')).toBe(true);
    expect(s.endsWith('.')).toBe(true);
  });

  it('ignores an empty goals array and a half-set budget', () => {
    expect(summariseStyleProfile({ styleGoals: [] })).toBe('');
    // One number alone cannot say "typical, and this is a lot".
    expect(summariseStyleProfile({ budgetTypical: 80 })).toBe('');
    expect(summariseStyleProfile({ budgetHigh: 400 })).toBe('');
  });
});
