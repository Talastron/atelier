import { describe, it, expect, beforeEach } from 'vitest';
import { markComposing, clearComposing, isComposingRecent } from './dailyBrief.js';

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
