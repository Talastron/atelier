import { describe, it, expect, vi } from 'vitest';
import { enqueueCutout, pendingCount, retarget } from './cutoutQueue.js';

const settled = () => new Promise((r) => setTimeout(r, 0));

describe('cutoutQueue', () => {
  it('runs jobs one at a time, in order', async () => {
    const order = [];
    let releaseFirst;
    const first = new Promise((r) => { releaseFirst = r; });

    enqueueCutout({ run: async () => { order.push('start-1'); await first; order.push('end-1'); return { ok: true }; }, onDone: () => order.push('done-1') });
    enqueueCutout({ run: async () => { order.push('start-2'); return { ok: true }; }, onDone: () => order.push('done-2') });

    await settled();
    // The second job must not have started while the first is in flight.
    expect(order).toEqual(['start-1']);

    releaseFirst();
    await settled();
    await settled();
    expect(order).toEqual(['start-1', 'end-1', 'done-1', 'start-2', 'done-2']);
  });

  it('hands the result to onDone', async () => {
    const onDone = vi.fn();
    enqueueCutout({ run: async () => ({ ok: true, alpha: true }), onDone });
    await settled();
    await settled();
    expect(onDone).toHaveBeenCalledWith({ ok: true, alpha: true });
  });

  it('keeps going after a job throws', async () => {
    const onError = vi.fn();
    const onDone = vi.fn();
    enqueueCutout({ run: async () => { throw new Error('model exploded'); }, onError });
    enqueueCutout({ run: async () => ({ ok: true }), onDone });
    await settled();
    await settled();
    await settled();
    expect(onError).toHaveBeenCalled();
    // The whole point: one bad photo must not strand the rest.
    expect(onDone).toHaveBeenCalledWith({ ok: true });
  });

  it('counts what is still outstanding', async () => {
    let release;
    const held = new Promise((r) => { release = r; });
    enqueueCutout({ run: async () => { await held; return { ok: true }; }, onDone: () => {} });
    enqueueCutout({ run: async () => ({ ok: true }), onDone: () => {} });
    await settled();
    expect(pendingCount()).toBe(2);
    release();
    await settled();
    await settled();
    await settled();
    expect(pendingCount()).toBe(0);
  });

  it('lets a pending job be re-pointed at a new handler', async () => {
    // Used when the modal saves: its remaining jobs stop updating form state
    // and start patching the saved item instead.
    let release;
    const held = new Promise((r) => { release = r; });
    const original = vi.fn();
    const replacement = vi.fn();
    enqueueCutout({ run: async () => { await held; return { ok: true }; }, onDone: original });
    const id = enqueueCutout({ run: async () => ({ ok: true }), onDone: original });
    retarget(id, { onDone: replacement });
    release();
    await settled();
    await settled();
    await settled();
    expect(replacement).toHaveBeenCalled();
  });
});
