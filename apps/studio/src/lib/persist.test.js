import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  settleWhenLocallyWritten,
  docSizeBytes,
  docTooLargeMessage,
  LOCAL_WRITE_GRACE_MS,
  DOC_SIZE_WARN_BYTES,
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
    expect(msg).toMatch(/over the 1 MB/);
    expect(msg).toMatch(/Remove a photo/);
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
