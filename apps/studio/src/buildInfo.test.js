import { describe, it, expect } from 'vitest';
import { formatBuildLabel } from './buildInfo.js';

describe('formatBuildLabel', () => {
  it('reads as a date and a commit', () => {
    expect(formatBuildLabel('2026-08-16T14:42:00.000Z', 'a1b2c3d')).toBe('16 August 2026 · a1b2c3d');
  });

  // The marker that matters most when deploying from a local machine: it says
  // this bundle holds work that exists in no commit.
  it('marks a dirty tree with a trailing +', () => {
    expect(formatBuildLabel('2026-08-16T14:42:00.000Z', 'a1b2c3d', true)).toBe(
      '16 August 2026 · a1b2c3d+'
    );
  });

  // Every degraded path still returns something renderable — the stamp must
  // never be the reason a profile page throws.
  it('falls back to the commit alone when the date is missing or unparseable', () => {
    expect(formatBuildLabel('', 'a1b2c3d')).toBe('a1b2c3d');
    expect(formatBuildLabel('not-a-date', 'a1b2c3d')).toBe('a1b2c3d');
  });

  it('says so plainly when git was unavailable at build time', () => {
    expect(formatBuildLabel('2026-08-16T14:42:00.000Z', 'unknown')).toBe(
      '16 August 2026 · unknown build'
    );
    expect(formatBuildLabel('', '')).toBe('unknown build');
  });
});
