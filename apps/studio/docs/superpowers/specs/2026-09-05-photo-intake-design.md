# Adding photos should not make you wait, and should never look stuck

**Date:** 2026-09-05
**Status:** design agreed, not yet planned
**Origin:** *"When I add photos it takes forever and I never know if it's stuck!"*

---

## The finding

`addImageFiles` in `App.jsx:2944` processes photos one at a time, and blocks the modal for the whole run:

```
for each file (up to 6, sequential):
  compressImageToDataUrl(file)
  if removeBackground:
    removeImageBackground(dataUrl, { alpha: true })   // @imgly WASM, ~8.8s
    if (!out.ok) removeImageBackground(dataUrl)       // a SECOND full run
  photo appears
```

**Six photos with background removal is roughly 54 seconds**, behind a spinner whose label never changes.

### Sometimes it genuinely is stuck

`setCutoutBusy(false)` sits **inside the `try`**, after the loop — not in the `finally`, which only resets `isLoading`. If any photo throws, `cutoutBusy` stays `true` for good: the spinner keeps spinning and the Add control, `disabled={cutoutBusy}`, never re-enables. The only escape is closing the modal.

So "I never know if it's stuck" is not a perception problem on the failure path. It is stuck.

The cause is a shape mismatch: **one global boolean is standing in for a per-photo operation.** One photo failing takes down the whole modal because there is nowhere to record that only *that* photo failed.

### Three more things the measurement showed

- **A failed cut-out silently re-runs the entire model.** `if (!out.ok)` retries without alpha, so a difficult photo costs ~18s with no indication a retry is happening.
- **The first photo is worst, structurally.** `@imgly/background-removal` is dynamically imported *inside* the function (`canvas.js:733`), so photo one pays the module download and WASM init before any pixels are touched.
- **The indicator cannot express progress.** It is `{cutoutBusy && <spinner/>}` with the fixed label "Removing bg…" — no count, no photo number, no stage. A minute of honest work and a hang render identically.

---

## Decisions

### The photo appears immediately; removal happens behind it

Compression is fast. The photo is added to the form as soon as it is compressed, and background removal runs afterwards, swapping the cut-out in when it lands. Naming, tagging and saving all stay available throughout.

Rejected: **making the wait honest** — a real count and stage ("Photo 2 of 5 · removing background"), keeping the blocking flow. Much smaller, and it would fix the "is it stuck" question outright. Rejected because a six-photo batch still costs a minute of standing still, and the wait is the complaint. Rejected: **running photos in parallel** — background removal is heavy WASM and several at once risks exhausting memory on a phone, which is exactly where this hurts most.

### Status is per photo, not one boolean for the batch

Each image carries its own state: `processing`, `cutout`, or `original` (removal declined, failed, or not requested). The thumbnail shows its own state.

This is what makes a failure local. It also means **the stuck bug cannot recur by construction** — there is no shared flag left to strand, and a photo that throws marks itself `original` while its neighbours carry on.

### Removal still runs one photo at a time

Non-blocking is not the same as concurrent. Jobs queue and run sequentially, for the memory reason above. The user is simply no longer waiting on the queue.

### Saving does not wait, and does not lose work

If photos are still processing when the item is saved, the item saves immediately with the originals, and the queue keeps running. As each cut-out completes it patches the saved item.

**This is a pattern the file already uses.** The rehost path comments: *"Fire-and-forget… the initial save above is already done — the user sees the item immediately. When the rehost completes, a second write patches the item."* Cut-outs follow it.

Rejected: **abandoning pending cut-outs on save** — simplest, and not a dead end because the existing polish flow (`polishItemPrimary`) can cut them out later from the item. Rejected because it silently discards work already half-done. Rejected: **asking** — explicit and lossless, but it puts a decision in front of the user at the moment they were trying to finish.

### The model is warmed when the modal opens

If background removal is enabled, the `@imgly` import is kicked off when the Add Item modal mounts, so the download and WASM init overlap with the user choosing a photo rather than landing on the first one.

---

## Architecture

### `src/lib/cutoutQueue.js` — new

A module-level queue, module-level **on purpose**: the work has to outlive the Add Item modal, which unmounts on save.

```js
// enqueue(job) → jobId. Jobs run one at a time, in order.
// job: { dataUrl, onDone(result), onError(err) }
// result: { url, cutout: boolean, alpha: boolean, original }
export function enqueueCutout(job) { … }

// Re-point a pending job's handlers — used when the modal saves and hands
// its remaining jobs over to the item-patching path.
export function retarget(jobId, handlers) { … }

export function pendingCount() { … }
```

The queue is a thin wrapper around the existing `removeImageBackground` in `canvas.js`, which is unchanged.

### `src/lib/photoStatus.js` — new, pure

The status reducer, kept out of the component so it can be tested:

```js
// The status of one image, given its meta. 'processing' | 'cutout' | 'original'
export function imageStatus(meta) { … }

// Apply a completed job to an imageMeta array, returning a new array.
export function applyCutoutResult(meta, index, result) { … }
```

This is where the real logic lives: which photos are still working, what a finished job does to the meta, and what a failure leaves behind.

### `src/App.jsx` — `AddItemModal`

- `addImageFiles` compresses, adds the photo, and enqueues removal rather than awaiting it.
- `cutoutBusy` is deleted. The Add control is never disabled by another photo's work.
- Each thumbnail renders its own status.
- On mount, warm the model if `removeBackground` is on.
- On save, remaining jobs are retargeted to patch the saved item.

### `src/App.jsx` — the save path

Gains a patch function mirroring the existing rehost patch: given an item id, an image index and a result, write the cut-out into the saved item.

---

## Testing

`photoStatus.js` is pure and carries the coverage:

- a meta entry mid-flight reports `processing`
- a completed cut-out reports `cutout`, with and without alpha
- a failed job reports `original` and keeps the original url
- applying a result leaves other indices untouched
- applying a result to an index that no longer exists (the user deleted the photo while it processed) does not throw and changes nothing

The queue gets ordering tests: jobs run one at a time, in order, and a job that throws does not stop the queue.

No view tests — no view in this codebase is tested. The modal is verified by using it.

---

## Non-goals

- **No parallel processing.** See above.
- **No change to `removeImageBackground` itself**, its alpha handling, or the WebP ladder.
- **No progress bar inside a single photo's removal.** `@imgly` is called as one `await`; a percentage would be invented.
- **No change to the polish flow**, which remains the way to cut out photos on an item saved earlier.
- **No retry UI.** A failed cut-out keeps the original, as now.

---

## Risks

| Risk | Handling |
|---|---|
| Work outliving the modal leaks or writes to a deleted item | Patches are keyed on the saved item id; a patch for an item that no longer exists is dropped, and the test suite covers applying a result to a missing index |
| The user saves, closes the app, and pending cut-outs die | Accepted. They keep their originals, and the polish flow exists precisely for this |
| Sequential queue still feels slow for six photos | The user is no longer waiting on it — the complaint was the wait, not the duration |
| Per-photo status makes the grid noisy | Each thumbnail shows a small spinner rather than a separate placeholder tile, so the grid does not change shape as jobs land |
| Warming the model wastes bandwidth for someone who adds no photo | Only when background removal is enabled, and it is the same download the first photo would have paid for |
