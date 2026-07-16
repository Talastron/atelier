import { describe, it, expect, beforeEach } from 'vitest';
import {
  markComposing, clearComposing, isComposingRecent,
  mergeRecent, readRecentBases, appendRecentBase,
} from './dailyBrief.js';

// dailyBrief.js reads/writes localStorage; the Vitest env is node (no DOM), so
// stub a minimal in-memory localStorage before each test. `now` is injectable
// on the helpers so the staleness window is deterministic without mocking time.
beforeEach(() => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    clear: () => { store.clear(); },
  };
});

describe('daily-brief composing marker (reload backstop)', () => {
  it('reports a compose marked within the window as recent', () => {
    markComposing('u1', 1_000);
    expect(isComposingRecent('u1', 60_000, 30_000)).toBe(true); // 29s elapsed
  });

  it('treats a marker older than the window as not recent (allows a fresh compose)', () => {
    markComposing('u1', 1_000);
    expect(isComposingRecent('u1', 60_000, 100_000)).toBe(false); // 99s elapsed
  });

  it('clearComposing removes the marker', () => {
    markComposing('u1', 1_000);
    clearComposing('u1');
    expect(isComposingRecent('u1', 60_000, 2_000)).toBe(false);
  });

  it('is not recent when nothing was marked', () => {
    expect(isComposingRecent('u-none', 60_000, 5_000)).toBe(false);
  });

  it('scopes the marker by uid', () => {
    markComposing('u1', 1_000);
    expect(isComposingRecent('u2', 60_000, 2_000)).toBe(false);
  });
});

describe('daily-brief freshness history (recent clothing bases)', () => {
  const e = (dateKey, ...baseIds) => ({ dateKey, baseIds });

  it('mergeRecent orders newest-first', () => {
    const out = mergeRecent([e('2026-07-14', 'a'), e('2026-07-16', 'c'), e('2026-07-15', 'b')]);
    expect(out.map((x) => x.dateKey)).toEqual(['2026-07-16', '2026-07-15', '2026-07-14']);
  });

  it('mergeRecent caps at 3 days', () => {
    const out = mergeRecent([
      e('2026-07-16', 'd'), e('2026-07-15', 'c'), e('2026-07-14', 'b'), e('2026-07-13', 'a'),
    ]);
    expect(out).toHaveLength(3);
    expect(out.map((x) => x.dateKey)).toEqual(['2026-07-16', '2026-07-15', '2026-07-14']);
  });

  it('mergeRecent keeps one entry per day, earlier argument wins the tie', () => {
    const out = mergeRecent([e('2026-07-16', 'new')], [e('2026-07-16', 'old')]);
    expect(out).toHaveLength(1);
    expect(out[0].baseIds).toEqual(['new']);
  });

  it('mergeRecent drops malformed entries', () => {
    const out = mergeRecent([null, { dateKey: '2026-07-16' }, { baseIds: ['x'] }, e('2026-07-15', 'ok')]);
    expect(out).toEqual([e('2026-07-15', 'ok')]);
  });

  it('readRecentBases returns [] when nothing stored', () => {
    expect(readRecentBases('u-none')).toEqual([]);
  });

  it('readRecentBases returns [] on unparseable stored data', () => {
    localStorage.setItem('atelier.dailyBrief.recent.u1', '{not json');
    expect(readRecentBases('u1')).toEqual([]);
  });

  it('readRecentBases returns [] when stored data is valid JSON but not an array', () => {
    localStorage.setItem('atelier.dailyBrief.recent.u1', JSON.stringify({ not: 'an array' }));
    expect(readRecentBases('u1')).toEqual([]);
  });

  it('appendRecentBase stores todays base and reads it back', () => {
    appendRecentBase('u1', ['top1', 'bottom1'], '2026-07-16');
    expect(readRecentBases('u1')).toEqual([e('2026-07-16', 'top1', 'bottom1')]);
  });

  it('appendRecentBase prepends newer days and caps the window at 3', () => {
    appendRecentBase('u1', ['a'], '2026-07-13');
    appendRecentBase('u1', ['b'], '2026-07-14');
    appendRecentBase('u1', ['c'], '2026-07-15');
    appendRecentBase('u1', ['d'], '2026-07-16');
    expect(readRecentBases('u1').map((x) => x.dateKey)).toEqual(['2026-07-16', '2026-07-15', '2026-07-14']);
  });

  it('appendRecentBase replaces the entry for the same day (re-roll), not duplicates it', () => {
    appendRecentBase('u1', ['first'], '2026-07-16');
    appendRecentBase('u1', ['second'], '2026-07-16');
    const out = readRecentBases('u1');
    expect(out).toHaveLength(1);
    expect(out[0].baseIds).toEqual(['second']);
  });

  it('scopes history by uid', () => {
    appendRecentBase('u1', ['a'], '2026-07-16');
    expect(readRecentBases('u2')).toEqual([]);
  });
});
