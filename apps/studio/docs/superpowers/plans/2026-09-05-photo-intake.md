# Non-Blocking Photo Intake Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adding photos stops blocking the Add Item modal, and stops being able to hang it.

**Architecture:** Each photo appears as soon as it is compressed; background removal runs behind it through a sequential module-level queue and swaps the cut-out in when it lands. Per-photo status replaces the single `cutoutBusy` boolean, which is what makes one failure local instead of fatal. Saving does not wait — pending jobs outlive the modal and patch the saved item, exactly as the existing rehost path does.

**Tech Stack:** React 18, Vite 6, Tailwind 4, vitest 4, `@imgly/background-removal` (browser WASM), Firebase Firestore.

**Spec:** `apps/studio/docs/superpowers/specs/2026-09-05-photo-intake-design.md`

**Worktree:** `C:\Users\SibylleMoller-Sherwo\Documents\GitHub\atelier-wt-flatlay`, branch `brand-caption-fit`. Run every command from that directory. It is a git worktree: do **not** `cd` to the main checkout, and do **not** use `git stash` — the stack is shared with other live sessions.

PowerShell 5.1 does **not** accept `&&`. Run commands separately.

Test: `pnpm --dir apps/studio test` (**377 passing** at the start of this plan). Build: `pnpm --dir apps/studio build`.

---

## Read this before Task 1

**The bug is a shape mismatch, not a missing feature.** `cutoutBusy` is one boolean standing in for a per-photo operation. `setCutoutBusy(false)` sits inside the `try` after the loop, not in the `finally` — so if any photo throws, the spinner never stops and the Add control (`disabled={cutoutBusy}`) never re-enables. Per-photo status is the fix; the flag is deleted, not repaired.

**Three warnings this branch earned today, all from real breakage:**

1. **Never add a hook below an early return.** A hook placed beside the markup that used it crashed the app with "Rendered fewer hooks than expected". All hooks go at the top of the component.
2. **Always run the build, not just the tests.** No view in this codebase is tested; a JSX syntax error passed 367 tests here.
3. **Reset busy flags in `finally`.** That is the bug being fixed, and it was reintroduced in a different file the same day.

**Do not test the WASM.** `removeImageBackground` is a real model. The queue is designed so the work is passed in as a function, which makes the queue testable without ever running it.

---

## File structure

| File | Responsibility | Change |
|---|---|---|
| `src/lib/photoStatus.js` | **New.** Per-photo status, and applying a finished job | Create |
| `src/lib/photoStatus.test.js` | **New.** Its tests | Create |
| `src/lib/cutoutQueue.js` | **New.** Sequential queue that outlives the modal | Create |
| `src/lib/cutoutQueue.test.js` | **New.** Its tests | Create |
| `src/App.jsx` — `AddItemModal` (~line 2654) | Photo intake | Non-blocking; `cutoutBusy` deleted |
| `src/App.jsx` — the save path (~line 651) | Handing pending jobs over | Patch the saved item |

---

### Task 1: Per-photo status

**Files:**
- Create: `apps/studio/src/lib/photoStatus.js`
- Create: `apps/studio/src/lib/photoStatus.test.js`

The existing `imageMeta` entry looks like `{ cutout: true, original: '<dataUrl>', alpha: true }`. This adds one transient field, `processing: true`, set while a job is queued or running.

- [ ] **Step 1: Write the failing tests**

Create `apps/studio/src/lib/photoStatus.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { imageStatus, applyCutoutResult } from './photoStatus.js';

describe('imageStatus', () => {
  it('reports a queued or running photo as processing', () => {
    expect(imageStatus({ processing: true })).toBe('processing');
  });

  it('reports a finished cut-out', () => {
    expect(imageStatus({ cutout: true, original: 'data:x' })).toBe('cutout');
    expect(imageStatus({ cutout: true, alpha: true, original: 'data:x' })).toBe('cutout');
  });

  it('reports anything else as the original photo', () => {
    // Removal declined, failed, or never requested all land here. The photo
    // is perfectly usable; it simply has its background.
    expect(imageStatus({})).toBe('original');
    expect(imageStatus({ cutout: false })).toBe('original');
    expect(imageStatus(undefined)).toBe('original');
    expect(imageStatus(null)).toBe('original');
  });

  it('does not report processing once a result has landed', () => {
    expect(imageStatus({ processing: true, cutout: true })).toBe('cutout');
  });
});

describe('applyCutoutResult', () => {
  const meta = [
    { processing: true },
    { cutout: true, original: 'data:a' },
  ];

  it('records a successful cut-out and clears processing', () => {
    const next = applyCutoutResult(meta, 0, { ok: true, alpha: true, original: 'data:b' });
    expect(next[0]).toEqual({ cutout: true, alpha: true, original: 'data:b' });
    expect(imageStatus(next[0])).toBe('cutout');
  });

  it('omits alpha when the cut-out could not keep it', () => {
    const next = applyCutoutResult(meta, 0, { ok: true, alpha: false, original: 'data:b' });
    expect('alpha' in next[0]).toBe(false);
    expect(next[0].cutout).toBe(true);
  });

  it('leaves a failed photo as an ordinary original', () => {
    const next = applyCutoutResult(meta, 0, { ok: false });
    expect(imageStatus(next[0])).toBe('original');
    expect(next[0].processing).toBeUndefined();
  });

  it('leaves the other entries untouched', () => {
    const next = applyCutoutResult(meta, 0, { ok: true, alpha: true, original: 'data:b' });
    expect(next[1]).toEqual(meta[1]);
  });

  it('does not mutate the array it was given', () => {
    const next = applyCutoutResult(meta, 0, { ok: true, alpha: true, original: 'data:b' });
    expect(meta[0]).toEqual({ processing: true });
    expect(next).not.toBe(meta);
  });

  it('ignores a result for a photo that no longer exists', () => {
    // The user can delete a photo while its cut-out is still running. That
    // must not throw, and must not resurrect the deleted entry.
    const next = applyCutoutResult(meta, 9, { ok: true, alpha: true, original: 'data:b' });
    expect(next).toEqual(meta);
    expect(applyCutoutResult(undefined, 0, { ok: true })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

```bash
pnpm --dir apps/studio test
```

Expected: `Cannot find module './photoStatus.js'`.

- [ ] **Step 3: Implement**

Create `apps/studio/src/lib/photoStatus.js`:

```js
// The state of one photo in the Add Item modal.
//
// This exists because a single `cutoutBusy` boolean was standing in for a
// per-photo operation: one photo failing left the flag set, the spinner
// running and the Add control disabled for good. Status per photo makes a
// failure local to the photo it happened to.
//
// 'original' is not an error state. Removal declined, removal failed and
// removal never requested all land there, and the photo is perfectly usable —
// it simply still has its background.
export function imageStatus(meta) {
  if (!meta) return 'original';
  if (meta.cutout === true) return 'cutout';
  if (meta.processing) return 'processing';
  return 'original';
}

// Apply a finished job to the imageMeta array, returning a new array.
//
// A result for an index that no longer exists is dropped rather than throwing:
// the user can delete a photo while its cut-out is still running, and a
// background job must never resurrect it.
export function applyCutoutResult(meta, index, result) {
  const list = Array.isArray(meta) ? meta : [];
  if (index < 0 || index >= list.length) return list;
  const next = [...list];
  next[index] = result?.ok
    ? {
        cutout: true,
        original: result.original,
        ...(result.alpha === true ? { alpha: true } : {}),
      }
    : { cutout: false };
  return next;
}
```

- [ ] **Step 4: Run them and watch them pass**

```bash
pnpm --dir apps/studio test
```

Expected: green, **387 tests** (377 + 10).

```bash
pnpm --dir apps/studio build
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add apps/studio/src/lib/photoStatus.js apps/studio/src/lib/photoStatus.test.js
```

```bash
git commit -m "feat(wardrobe): per-photo status, replacing one boolean for six photos

cutoutBusy was a single flag standing in for a per-photo operation, which
is why one photo failing left the spinner running and the Add control
disabled for good. Status per photo makes a failure local to the photo it
happened to.

A result for an index that no longer exists is dropped rather than
throwing: a photo can be deleted while its cut-out is still running.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: The queue

**Files:**
- Create: `apps/studio/src/lib/cutoutQueue.js`
- Create: `apps/studio/src/lib/cutoutQueue.test.js`

Module-level **on purpose**: the work has to outlive the Add Item modal, which unmounts on save.

The job carries its own work function. That keeps the queue pure orchestration, and means these tests never touch the WASM model.

- [ ] **Step 1: Write the failing tests**

Create `apps/studio/src/lib/cutoutQueue.test.js`:

```js
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
```

- [ ] **Step 2: Run them and watch them fail**

```bash
pnpm --dir apps/studio test
```

Expected: `Cannot find module './cutoutQueue.js'`.

- [ ] **Step 3: Implement**

Create `apps/studio/src/lib/cutoutQueue.js`:

```js
// A sequential queue for background removal.
//
// Module-level on purpose: the work has to outlive the Add Item modal, which
// unmounts on save. A queue owned by the component would be torn down mid-job
// and the user would lose the cut-out they had already waited part-way for.
//
// Sequential on purpose too. Background removal is heavy WASM; several at once
// risks exhausting memory on a phone, which is exactly where photo intake
// hurts most. Non-blocking is not the same as concurrent — the user is simply
// no longer waiting on the queue.
//
// The job carries its own work function rather than the queue importing the
// model. That keeps this file pure orchestration, and lets its tests run
// without ever loading the WASM.
const queue = [];
let running = false;
let nextId = 1;

function pump() {
  if (running) return;
  const job = queue[0];
  if (!job) return;
  running = true;
  Promise.resolve()
    .then(() => job.run())
    .then(
      (result) => { try { job.onDone?.(result); } catch { /* a handler must not stall the queue */ } },
      (err) => { try { job.onError?.(err); } catch { /* nor must its error path */ } },
    )
    .then(() => {
      queue.shift();
      running = false;
      pump();
    });
}

// job: { run: () => Promise<result>, onDone?, onError? } → job id
export function enqueueCutout(job) {
  const id = nextId++;
  queue.push({ ...job, id });
  pump();
  return id;
}

// Re-point a job that has not finished yet. Used when the modal saves and
// hands its remaining work over to the item-patching path.
export function retarget(id, handlers) {
  const job = queue.find((j) => j.id === id);
  if (!job) return false;
  Object.assign(job, handlers);
  return true;
}

export function pendingCount() {
  return queue.length;
}
```

- [ ] **Step 4: Run them and watch them pass**

```bash
pnpm --dir apps/studio test
```

Expected: green, **392 tests** (387 + 5).

**If the ordering test is flaky**, the cause is the number of `await settled()` hops, not the queue. Add hops rather than changing the queue, and say so in your report.

```bash
pnpm --dir apps/studio build
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add apps/studio/src/lib/cutoutQueue.js apps/studio/src/lib/cutoutQueue.test.js
```

```bash
git commit -m "feat(wardrobe): a cut-out queue that outlives the modal

Module-level on purpose - the work must survive the Add Item modal
unmounting on save, or the user loses a cut-out they already waited
part-way for.

Sequential on purpose too: background removal is heavy WASM and several
at once risks exhausting memory on a phone. Non-blocking is not the same
as concurrent.

The job carries its own work function, so this file is pure orchestration
and its tests never load the model.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Non-blocking intake

**Files:**
- Modify: `apps/studio/src/App.jsx` — `AddItemModal` (starts ~line 2654), `addImageFiles` (~line 2977), the `cutoutBusy` declaration (~2660) and its two uses (~3487, ~3578)

- [ ] **Step 1: Read the whole of `addImageFiles` first**

```bash
sed -n '2977,3045p' apps/studio/src/App.jsx
```

Note its shape: a sequential `for` loop that awaits `compressImageToDataUrl`, then `removeImageBackground` (twice on failure — the retry drops alpha), then `setFormData`. Note also the toasts it fires after the loop, and the colour extraction at the end.

- [ ] **Step 2: Rewrite the loop so it never awaits removal**

Replace the body of `addImageFiles` so that, for each file:

1. `await compressImageToDataUrl(file)` — this is fast and stays awaited.
2. Push the photo into `formData.images` immediately, with meta `{ processing: removeBackground }`.
3. If `removeBackground`, enqueue the removal rather than awaiting it.

```js
  const addImageFiles = async (files) => {
    const list = Array.from(files || []).slice(0, 6 - (formData.images?.length || 0));
    if (!list.length) return;
    setIsLoading(true); setError(null);
    let firstNewDataUrl = null;
    try {
      for (const file of list) {
        const originalDataUrl = await compressImageToDataUrl(file);
        if (!firstNewDataUrl) firstNewDataUrl = originalDataUrl;

        // The photo appears NOW, at its original. Removal runs behind it and
        // swaps the cut-out in when it lands. The index is captured here
        // because later deletions can shift it — applyCutoutResult drops a
        // result whose index no longer exists.
        let index = -1;
        setFormData((prev) => {
          const images = [...(prev.images || []), originalDataUrl].slice(0, 6);
          const meta = [...(Array.isArray(prev.imageMeta) ? prev.imageMeta : []), { processing: !!removeBackground }].slice(0, 6);
          index = images.length - 1;
          return { ...prev, images, imageMeta: meta };
        });

        if (removeBackground) {
          const at = index;
          enqueueCutout({
            run: async () => {
              let out = await removeImageBackground(originalDataUrl, { alpha: true });
              // A browser that cannot write WebP cannot keep the alpha, and
              // JPEG has none to fall back on. Take the flattened cut-out
              // rather than lose it — it simply will not overlap.
              if (!out.ok) out = await removeImageBackground(originalDataUrl);
              return { ok: !!out.ok, url: out.url, alpha: out.alpha === true, original: originalDataUrl };
            },
            onDone: (result) => {
              setFormData((prev) => {
                const meta = applyCutoutResult(prev.imageMeta, at, result);
                if (meta === prev.imageMeta) return prev;
                const images = [...(prev.images || [])];
                if (result.ok && images[at] !== undefined) images[at] = result.url;
                return { ...prev, images, imageMeta: meta };
              });
            },
            onError: (err) => {
              console.warn('[cutout] failed, keeping the original:', err?.message);
              setFormData((prev) => ({ ...prev, imageMeta: applyCutoutResult(prev.imageMeta, at, { ok: false }) }));
            },
          });
        }
      }
      setStep((s) => (s === 1 ? 2 : s));
      if (firstNewDataUrl && (!formData.colors || formData.colors.length === 0)) {
        try {
          const detected = await extractDominantColors(firstNewDataUrl);
          if (detected.length > 0) {
            setFormData((prev) => prev.colors?.length ? prev : { ...prev, colors: detected });
          }
        } catch (e) { console.warn('[wardrobe] colour extraction failed:', e); }
      }
    } catch (err) {
      setError(err?.message || 'Could not process one of the images.');
    } finally {
      setIsLoading(false);
    }
  };
```

**Note what is gone:** the batch toasts ("Background removed ✓ on N photos"). They summarised a batch that no longer completes together. Per-photo status on the thumbnails replaces them.

**Reading `index` back out of a `setFormData` updater is the fragile part of this.** Verify it works — React may call the updater more than once in StrictMode. If it proves unreliable, compute the index before the update instead, from `formData.images?.length || 0` plus a counter for this batch, and say in your report which you used and why.

- [ ] **Step 3: Add the imports**

At the top of `App.jsx`, add to the existing import block:

```js
import { enqueueCutout } from './lib/cutoutQueue.js';
import { applyCutoutResult, imageStatus } from './lib/photoStatus.js';
```

- [ ] **Step 4: Delete `cutoutBusy`**

Remove the declaration (~line 2660) and both uses:

- ~3487: `disabled={cutoutBusy}` — delete the attribute entirely. The Add control must never be disabled by another photo's work; that was the hang.
- ~3578: the `{cutoutBusy && (…)}` placeholder tile — delete the whole block. Its replacement is per-thumbnail status in the next step.

```bash
grep -n "cutoutBusy" apps/studio/src/App.jsx
```

Expected afterwards: no output.

- [ ] **Step 5: Show status on the thumbnail itself**

Find where `formData.images` is mapped to thumbnails in the modal (near the deleted placeholder). Inside each thumbnail, add a small overlay driven by that photo's own status:

```jsx
                    {imageStatus(formData.imageMeta?.[i]) === 'processing' && (
                      <div className="absolute inset-0 rounded-xl bg-white/70 backdrop-blur-[1px] flex flex-col items-center justify-center pointer-events-none">
                        <div className="w-4 h-4 border-2 border-emerald-300 border-t-emerald-700 rounded-full animate-spin" />
                        <span className="mt-1.5 text-xs tracking-meta uppercase text-stone-600">Removing bg…</span>
                      </div>
                    )}
```

The thumbnail's wrapper needs `relative` for this to sit over it — check whether it already has it and add it if not. Use the map's existing index variable; if it is not named `i`, use whatever it is.

- [ ] **Step 6: Warm the model when the modal opens**

With the other `useEffect` calls in `AddItemModal`:

```js
  // Warm the model so photo one does not pay for the download. The import is
  // dynamic and inside removeImageBackground, so without this the first photo
  // waits for the module and the WASM init before any pixels are touched.
  useEffect(() => {
    if (!removeBackground) return;
    import('@imgly/background-removal').catch(() => { /* the first photo will retry */ });
  }, [removeBackground]);
```

**Hooks go at the top of the component with the others.** A hook below an early return crashed this app today.

- [ ] **Step 7: Build and test**

```bash
pnpm --dir apps/studio build
```

```bash
pnpm --dir apps/studio test
```

Expected: clean, **392 passing** — this task adds none.

- [ ] **Step 8: Commit**

```bash
git add apps/studio/src/App.jsx
```

```bash
git commit -m "feat(wardrobe): photos appear at once, cut-outs land behind them

Adding six photos with background removal blocked the modal for about
fifty seconds behind a spinner whose label never changed, and a photo
that threw left cutoutBusy set for good - the spinner never stopped and
the Add control never re-enabled.

Now each photo appears as soon as it is compressed and removal runs
through a queue behind it. cutoutBusy is deleted rather than repaired:
per-photo status is what makes a failure local.

The model is warmed when the modal opens, so photo one no longer pays for
the module download and WASM init before any pixels are touched.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Saving does not wait

**Files:**
- Modify: `apps/studio/src/App.jsx` — the item save path, near the existing rehost block (~line 651)

- [ ] **Step 1: Read the rehost block, which is the pattern to copy**

```bash
sed -n '645,710p' apps/studio/src/App.jsx
```

It saves the item, then patches it in the background as each image is rehosted. **Note two details you must carry over:**

1. It re-checks `docTooLargeMessage(patch, 'item')` before writing, because a background patch can push an item over Firestore's 1MB ceiling *after* it saved fine. A cut-out is a new data URL and has exactly the same hazard.
2. It uses `settleWhenLocallyWritten(..., { onLateError })` rather than a bare `await`, because a bare await never settles offline and pins the closure — holding up to 1MB of base64 — until reload.

- [ ] **Step 2: Have the modal report its pending jobs on save**

`AddItemModal` calls `onSave` with the item. It also needs to hand over any cut-out jobs still in flight, so the save path can patch the item as they land.

In `AddItemModal`, keep both the job id **and the image index** for each job enqueued for this item — Task 4 Step 3 needs the index to know which image to patch:

```js
  const pendingJobsRef = useRef([]);
```

**With the other refs at the top of the component.** In Task 3's enqueue code, capture both:

```js
          const jobId = enqueueCutout({ /* run, onDone, onError as in Task 3 */ });
          pendingJobsRef.current.push({ jobId, index: at });
```

Then pass that array to `onSave` alongside the item. Read how `onSave` is currently called and extend it in the same style — if it takes a single item argument, add a second:

```js
    onSave(newItem, pendingJobsRef.current);
```

and widen the receiving handler's signature in `App.jsx` to match. The receiving name used in Step 3 below is `pendingCutouts`.

- [ ] **Step 3: Retarget those jobs after the item is saved**

In the save handler in `App.jsx`, after the item write settles and beside the rehost block:

```js
      // Cut-outs still running when the user saved. They keep going and patch
      // the item as each lands — the same fire-and-forget shape the rehost
      // above uses, for the same reason: the user should not wait, and the
      // work should not be thrown away.
      for (const { jobId, index } of pendingCutouts || []) {
        retarget(jobId, {
          onDone: async (result) => {
            if (!result?.ok) return;
            try {
              const fresh = (await getDoc(doc(userItemsRef(uid), newItem.id))).data();
              if (!fresh) return; // deleted while the cut-out ran
              const images = [...(fresh.images || [])];
              if (images[index] === undefined) return;
              images[index] = result.url;
              const meta = applyCutoutResult(fresh.imageMeta, index, result);
              const patch = { ...fresh, images, imageMeta: meta };
              // Same guard as the rehost: a background patch can push an item
              // that saved fine over the document ceiling.
              const tooLarge = docTooLargeMessage(patch, 'item');
              if (tooLarge) { console.warn('[cutout] skipped patch for item', newItem.id, '—', tooLarge); return; }
              await settleWhenLocallyWritten(setDoc(doc(userItemsRef(uid), newItem.id), patch), {
                onLateError: (err) => console.warn('[cutout] patch rejected after settling:', err?.message),
              });
            } catch (err) {
              console.warn('[cutout] patch failed for item', newItem.id, '—', err?.message);
            }
          },
          onError: () => { /* the original photo stands; the polish flow can cut it out later */ },
        });
      }
```

**Check what is already imported** — `getDoc`, `setDoc`, `doc`, `userItemsRef`, `docTooLargeMessage`, `settleWhenLocallyWritten` are all used by the rehost block, so most or all will be. Add `retarget` from `./lib/cutoutQueue.js` and `applyCutoutResult` from `./lib/photoStatus.js` if not already there from Task 3.

- [ ] **Step 4: Build and test**

```bash
pnpm --dir apps/studio build
```

```bash
pnpm --dir apps/studio test
```

Expected: clean, **392 passing**.

- [ ] **Step 5: Commit**

```bash
git add apps/studio/src/App.jsx
```

```bash
git commit -m "feat(wardrobe): saving does not wait for cut-outs to finish

The item saves with its originals and the queue keeps running; each
cut-out patches the item as it lands. This is the shape the rehost path
in the same file already uses, and for the same reason - the user should
not wait, and half-finished work should not be discarded.

Carries over two things the rehost learned the hard way: re-check the
document size before patching, because a background write can push an
item that saved fine over Firestore's ceiling; and use
settleWhenLocallyWritten rather than a bare await, which never settles
offline and pins a closure holding up to 1MB of base64 until reload.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Sibylle looks at it

**Files:** none — her review, and the only test of whether it feels right.

- [ ] **Step 1: Serve the branch from the worktree**

Read the path Vite prints on startup. The `.claude/launch.json` config resolves to the **main checkout**, not this worktree — it has caught three agents today. If in doubt:

```bash
pnpm --dir apps/studio exec vite --port 5180 --strictPort
```

- [ ] **Step 2: Add several photos at once, with background removal on**

Expect: every photo appears more or less immediately, each with its own small spinner, and cut-outs replace them one at a time. The form stays usable throughout — name, tag and scroll while it works.

- [ ] **Step 3: Save before it finishes**

Add photos, then save while spinners are still running. Expect: the item saves at once with its originals, and the cut-outs appear on the item shortly afterwards.

- [ ] **Step 4: The thing that was broken**

If a photo fails, only that thumbnail should say so. The Add control must stay usable and the other photos must carry on. Previously one failure left the modal spinning for good.

- [ ] **Step 5: Report before tuning**

Say what you saw. Two things accepted in the spec: the queue is still sequential, so six photos take as long as before — you are simply not waiting on it; and pending cut-outs die if the app is closed right after saving, with the polish flow as the recovery.

---

## Notes for whoever executes this

- **`cutoutBusy` is deleted, not repaired.** Per-photo status is the fix.
- **Do not add hooks below early returns.** This branch shipped that crash today.
- **Always run the build, not just the tests.** A JSX syntax error passed 367 tests here.
- **Do not test the WASM.** The queue takes its work as a function so it never has to.
- **Do not merge, push, or open a PR.** This branch has an open PR (#89). Commit and stop.
