import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  beginWrite, endWrite, writeTimings, pendingWrites, clearWriteTimings,
  describeWriteTiming, SLOW_WRITE_MS,
} from './writeTiming.js';

// A minimal localStorage. The module must work without one too — see the last
// block — but most tests want to prove records survive a reload.
const memoryStorage = () => {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
};

beforeEach(() => {
  globalThis.localStorage = memoryStorage();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-05T09:00:00Z'));
  clearWriteTimings();
});

afterEach(() => {
  vi.useRealTimers();
  delete globalThis.localStorage;
});

describe('beginWrite / endWrite', () => {
  it('keeps a record of a slow write', () => {
    const t = beginWrite('Blue Shirt', 4096);
    vi.advanceTimersByTime(8400);
    const record = endWrite(t);

    expect(record.ms).toBe(8400);
    expect(record.label).toBe('Blue Shirt');
    expect(record.bytes).toBe(4096);
    expect(writeTimings()).toHaveLength(1);
  });

  // The point of the threshold: a wardrobe of ordinary writes must not fill
  // the buffer and push out the one write that was actually strange.
  it('ignores a write that was quick', () => {
    const t = beginWrite('Quick', 100);
    vi.advanceTimersByTime(SLOW_WRITE_MS - 1);
    expect(endWrite(t)).toBeNull();
    expect(writeTimings()).toHaveLength(0);
  });

  it('records a write exactly at the threshold', () => {
    const t = beginWrite('Borderline');
    vi.advanceTimersByTime(SLOW_WRITE_MS);
    expect(endWrite(t)?.ms).toBe(SLOW_WRITE_MS);
  });

  // The leading hypothesis for the photo-less item: Firestore commits a
  // connection's mutations in order, so a 2 KB document can wait out a 900 KB
  // one queued ahead of it. Nothing measured this before.
  it('counts how many writes were already in flight', () => {
    const first = beginWrite('Photo item', 900_000);
    const second = beginWrite('Tiny item', 2048);

    expect(pendingWrites()).toBe(2);
    vi.advanceTimersByTime(7000);
    endWrite(first);
    const record = endWrite(second);

    expect(record.queuedBehind).toBe(1);
    expect(record.bytes).toBe(2048);
    expect(pendingWrites()).toBe(0);
  });

  it('does not count itself as queued behind anything', () => {
    const t = beginWrite('Alone');
    vi.advanceTimersByTime(3000);
    expect(endWrite(t).queuedBehind).toBe(0);
  });

  it('records the size as null when the caller does not know it', () => {
    const t = beginWrite('Unsized');
    vi.advanceTimersByTime(3000);
    expect(endWrite(t).bytes).toBeNull();
  });

  it('records a failure outcome', () => {
    const t = beginWrite('Doomed');
    vi.advanceTimersByTime(3000);
    expect(endWrite(t, { outcome: 'rejected' }).outcome).toBe('rejected');
  });

  // A save must never be brought down by the thing measuring it.
  it('ignores an unknown or repeated ticket', () => {
    const t = beginWrite('Once');
    vi.advanceTimersByTime(3000);
    expect(endWrite(t)).not.toBeNull();
    expect(endWrite(t)).toBeNull();
    expect(endWrite(9999)).toBeNull();
    expect(writeTimings()).toHaveLength(1);
  });
});

describe('storage', () => {
  it('survives a reload', () => {
    const t = beginWrite('Persisted');
    vi.advanceTimersByTime(5000);
    endWrite(t);

    // Simulate a fresh module load by resetting the in-memory cache the only
    // way a consumer can: reading it back out of storage.
    const raw = JSON.parse(globalThis.localStorage.getItem('atelier:write-timings:v1'));
    expect(raw).toHaveLength(1);
    expect(raw[0].label).toBe('Persisted');
  });

  it('keeps newest first and caps the buffer', () => {
    for (let i = 0; i < 30; i += 1) {
      const t = beginWrite(`w${i}`);
      vi.advanceTimersByTime(3000);
      endWrite(t);
    }
    const kept = writeTimings();
    expect(kept).toHaveLength(25);
    expect(kept[0].label).toBe('w29');
  });

  // Private browsing, blocked site data, and the thumbnail renderer all throw
  // on localStorage access. Diagnostics must degrade to nothing.
  it('works with no storage at all', () => {
    delete globalThis.localStorage;
    const t = beginWrite('No storage');
    vi.advanceTimersByTime(4000);
    expect(() => endWrite(t)).not.toThrow();
  });

  it('works when storage throws', () => {
    globalThis.localStorage = {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
    };
    clearWriteTimings();
    const t = beginWrite('Blocked');
    vi.advanceTimersByTime(4000);
    expect(() => endWrite(t)).not.toThrow();
  });
});

describe('describeWriteTiming', () => {
  it('reads as facts, not a diagnosis', () => {
    const line = describeWriteTiming({
      label: 'Blue Shirt', ms: 8400, bytes: 2048, queuedBehind: 1,
      hidden: false, offline: false, outcome: 'ok',
    });
    expect(line).toBe('8.4s · Blue Shirt · 2 KB · behind 1');
  });

  it('omits what it does not know or does not apply', () => {
    const line = describeWriteTiming({
      label: 'Item', ms: 3000, bytes: null, queuedBehind: 0,
      hidden: false, offline: false, outcome: 'ok',
    });
    expect(line).toBe('3.0s · Item');
  });

  it('names the conditions that make a slow write look like something else', () => {
    const line = describeWriteTiming({
      label: 'Item', ms: 9000, bytes: null, queuedBehind: 0,
      hidden: true, offline: true, outcome: 'rejected',
    });
    expect(line).toBe('9.0s · Item · tab hidden · offline · rejected');
  });

  it('is falsy-safe', () => {
    expect(describeWriteTiming(null)).toBe('');
  });
});
