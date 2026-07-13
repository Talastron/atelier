import { describe, it, expect } from 'vitest';
import { currentSeasonLabel } from './items.js';

describe('currentSeasonLabel', () => {
  it('maps March, April, May to Spring', () => {
    expect(currentSeasonLabel(new Date('2026-03-15'))).toBe('Spring');
    expect(currentSeasonLabel(new Date('2026-04-01'))).toBe('Spring');
    expect(currentSeasonLabel(new Date('2026-05-31'))).toBe('Spring');
  });

  it('maps June, July, August to Summer', () => {
    expect(currentSeasonLabel(new Date('2026-06-01'))).toBe('Summer');
    expect(currentSeasonLabel(new Date('2026-07-13'))).toBe('Summer');
    expect(currentSeasonLabel(new Date('2026-08-31'))).toBe('Summer');
  });

  it('maps September, October, November to Autumn', () => {
    expect(currentSeasonLabel(new Date('2026-09-01'))).toBe('Autumn');
    expect(currentSeasonLabel(new Date('2026-11-30'))).toBe('Autumn');
  });

  it('maps December, January, February to Winter', () => {
    expect(currentSeasonLabel(new Date('2026-12-01'))).toBe('Winter');
    expect(currentSeasonLabel(new Date('2026-01-15'))).toBe('Winter');
    expect(currentSeasonLabel(new Date('2026-02-28'))).toBe('Winter');
  });

  it('defaults to the current date when called with no argument', () => {
    // Just confirms it returns one of the four valid labels without throwing.
    expect(['Spring', 'Summer', 'Autumn', 'Winter']).toContain(currentSeasonLabel());
  });
});
