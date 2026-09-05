import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  settleWhenLocallyWritten,
  docSizeBytes,
  docTooLargeMessage,
  LOCAL_WRITE_GRACE_MS,
  DOC_SIZE_WARN_BYTES,
  looksOffline,
  pendingSyncNote,
} from './persist.js';

describe('settleWhenLocallyWritten', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('reports synced when the server acknowledges in time', async () => {
    const result = await settleWhenLocallyWritten(Promise.resolve());
    expect(result).toEqual({ synced: true });
  });

  // The bug this module exists for: Firestore's write promise never settles
  // while offline, so the caller's `finally { setLoading(false) }` never runs.
  it('settles as unsynced when the write never resolves', async () => {
    const never = new Promise(() => {});
    const pending = settleWhenLocallyWritten(never, { graceMs: 1000 });
    await vi.advanceTimersByTimeAsync(1000);
    await expect(pending).resolves.toEqual({ synced: false });
  });

  it('does not settle before the grace window elapses', async () => {
    const spy = vi.fn();
    settleWhenLocallyWritten(new Promise(() => {}), { graceMs: 1000 }).then(spy);
    await vi.advanceTimersByTimeAsync(999);
    expect(spy).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(spy).toHaveBeenCalledWith({ synced: false });
  });

  it('rejects when the write fails inside the window, so the caller can show the error', async () => {
    const boom = new Error('permission-denied');
    await expect(settleWhenLocallyWritten(Promise.reject(boom))).rejects.toBe(boom);
  });

  it('routes a failure arriving after the grace window to onLateError, not an unhandled rejection', async () => {
    const boom = new Error('rejected by the server');
    const onLateError = vi.fn();
    let fail;
    const write = new Promise((_, rej) => { fail = rej; });

    const result = settleWhenLocallyWritten(write, { graceMs: 1000, onLateError });
    await vi.advanceTimersByTimeAsync(1000);
    await expect(result).resolves.toEqual({ synced: false });

    fail(boom);
    await vi.advanceTimersByTimeAsync(0);
    expect(onLateError).toHaveBeenCalledWith(boom);
  });

  it('stays resolved-once when the write lands after the grace window', async () => {
    const onLateError = vi.fn();
    let ack;
    const write = new Promise((res) => { ack = res; });

    const result = settleWhenLocallyWritten(write, { graceMs: 1000, onLateError });
    await vi.advanceTimersByTimeAsync(1000);
    expect(await result).toEqual({ synced: false });

    ack();
    await vi.advanceTimersByTimeAsync(0);
    expect(onLateError).not.toHaveBeenCalled();
  });

  it('survives a throwing onLateError reporter', async () => {
    const onLateError = vi.fn(() => { throw new Error('toast blew up'); });
    let fail;
    const write = new Promise((_, rej) => { fail = rej; });

    const result = settleWhenLocallyWritten(write, { graceMs: 1000, onLateError });
    await vi.advanceTimersByTimeAsync(1000);
    await expect(result).resolves.toEqual({ synced: false });

    expect(() => fail(new Error('nope'))).not.toThrow();
    await vi.advanceTimersByTimeAsync(0);
    expect(onLateError).toHaveBeenCalled();
  });

  it('defaults to a grace window that outlasts a merely slow write', () => {
    expect(LOCAL_WRITE_GRACE_MS).toBeGreaterThanOrEqual(3000);
  });
});

describe('docSizeBytes', () => {
  it('measures the serialised payload', () => {
    expect(docSizeBytes({ a: 1 })).toBe(JSON.stringify({ a: 1 }).length);
  });

  it('counts multi-byte characters by their encoded length', () => {
    expect(docSizeBytes({ n: '£' })).toBeGreaterThan(JSON.stringify({ n: '' }).length + 1);
  });

  it('returns 0 rather than throwing on an unserialisable value', () => {
    const circular = {};
    circular.self = circular;
    expect(docSizeBytes(circular)).toBe(0);
  });
});

describe('docTooLargeMessage', () => {
  it('passes a normal item', () => {
    expect(docTooLargeMessage({ name: 'Wool coat', images: ['data:image/jpeg;base64,AAAA'] })).toBeNull();
  });

  it('flags a payload over the warning threshold', () => {
    const huge = { images: ['x'.repeat(DOC_SIZE_WARN_BYTES + 1)] };
    const msg = docTooLargeMessage(huge);
    expect(msg).toMatch(/too close to the 1 MB/);
    expect(msg).toMatch(/Remove a photo/);
  });

  // We block below the real ceiling on purpose. Reporting a 0.9 MB payload as
  // "over the 1 MB limit" reads as an app bug rather than a real constraint,
  // so the message states the measured size and calls the gap headroom.
  it('reports the measured size honestly rather than claiming the limit was passed', () => {
    const huge = { blob: 'x'.repeat(DOC_SIZE_WARN_BYTES + 1) };
    const msg = docTooLargeMessage(huge);
    expect(msg).not.toMatch(/over the 1 MB/);
    expect(msg).toMatch(/\d+ KB/);
  });

  it('names what is being saved', () => {
    const huge = { blob: 'x'.repeat(DOC_SIZE_WARN_BYTES + 1) };
    expect(docTooLargeMessage(huge, 'look')).toMatch(/This look is/);
  });

  // An unmeasurable payload must not block a save that Firestore might accept.
  it('does not block when the size cannot be measured', () => {
    const circular = {};
    circular.self = circular;
    expect(docTooLargeMessage(circular)).toBeNull();
  });
});

describe('pendingSyncNote', () => {
  // globalThis.navigator is getter-only in this environment, so it has to be
  // stubbed rather than assigned.
  const setOnLine = (value) => vi.stubGlobal('navigator', { onLine: value });
  afterEach(() => vi.unstubAllGlobals());

  it('claims offline only when the browser says so outright', () => {
    setOnLine(false);
    expect(looksOffline()).toBe(true);
    expect(pendingSyncNote()).toBe("syncing when you're back online");
  });

  it('does not claim offline for a write that is merely slow', () => {
    // The reported bug: an item carrying base64 photos takes longer than the
    // six-second grace to be acknowledged, and the user — who is online — was
    // told their work would sync "when you're back online".
    setOnLine(true);
    expect(looksOffline()).toBe(false);
    expect(pendingSyncNote()).toBe('still syncing');
  });

  it('does not claim offline when it cannot tell', () => {
    // navigator.onLine true does not prove connectivity, and a navigator with
    // no onLine at all proves nothing. Neither is grounds for asserting a
    // network state to the user.
    vi.stubGlobal('navigator', {});
    expect(looksOffline()).toBe(false);
    expect(pendingSyncNote()).toBe('still syncing');
  });
});
