# Manual Image Editor — Phase 1 (Framing) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a manual image editor (Phase 1: crop/zoom/pan framing onto the grid's 3:4 aspect) launched from the item detail view, non-destructively baking a `framedUrl` to Storage while preserving the original.

**Architecture:** A pure geometry core (`framing.js`) computes the source crop rectangle from `{ zoom, offsetX, offsetY }`. A fullscreen React shell (`ImageFramer.jsx`) drives a WYSIWYG live preview whose CSS transform is derived from the *same* `computeCropRect`, so preview and baked output are pixel-identical. On save, a canvas helper bakes the crop to a compressed JPEG data URL, and `polish.js` uploads it to `framed/{uid}/…` and writes `imageMeta[i].framedUrl` + `frame`. Display resolves through the existing `itemImageDisplay` (now `framedUrl → cutoutUrl → original`), so every render surface benefits with zero extra wiring.

**Tech Stack:** React, Vite, Vitest (pure-function tests only — no jsdom), Firebase Storage (`uploadString`/`getDownloadURL`), existing `canvas.js`/`net.js` helpers.

---

## File Structure

- **Create `src/lib/framing.js`** — pure geometry: `FRAME_ASPECT`, `defaultFrame()`, `computeCropRect(...)`. No DOM, no Firebase. Unit-tested.
- **Create `src/lib/framing.test.js`** — Vitest tests for the geometry core.
- **Modify `src/lib/polish.js`** — extend `itemImageDisplay` (add `framedUrl` priority); add `frameItemPrimary(item, uid, dataUrl, frame)` (upload + meta write) and `revertFramePrimary(item)` (pure meta strip).
- **Modify `src/lib/polish.test.js`** — add `framedUrl`-priority cases and a `revertFramePrimary` test.
- **Modify `src/lib/canvas.js`** — add `renderFramedDataUrl(src, frame, opts)` (loads the base via `loadImageForCanvas`, crops via `computeCropRect`, bakes a compressed JPEG data URL).
- **Create `src/components/ImageFramer.jsx`** — the fullscreen editing shell (rehost base, live preview, drag-pan, zoom slider, Reset/Cancel/Save).
- **Modify `src/App.jsx`** — import `ImageFramer` + `frameItemPrimary`/`revertFramePrimary`; add editor open/close state; add an "Edit image" button and a "Framed · revert" button in `ItemDetailView`; render `ImageFramer`.
- **Modify `storage.rules`** — add a `framed/{uid}/{file}` rule mirroring `polish/{uid}/{file}`; deploy.

---

## Task 1: Framing geometry core (TDD)

**Files:**
- Create: `src/lib/framing.js`
- Test: `src/lib/framing.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/lib/framing.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { FRAME_ASPECT, defaultFrame, computeCropRect } from './framing.js';

describe('framing geometry', () => {
  it('FRAME_ASPECT is 3:4 portrait (width/height)', () => {
    expect(FRAME_ASPECT).toBeCloseTo(0.75, 5);
  });

  it('defaultFrame is centred at zoom 1', () => {
    expect(defaultFrame()).toEqual({ zoom: 1, offsetX: 0, offsetY: 0 });
  });

  it('zoom 1 on a square source yields the largest centred 3:4 crop', () => {
    const r = computeCropRect({ naturalW: 1000, naturalH: 1000, zoom: 1, offsetX: 0, offsetY: 0 });
    // square is wider than 3:4 → constrained by height: 750x1000, centred at x=125
    expect(r.sw).toBeCloseTo(750, 3);
    expect(r.sh).toBeCloseTo(1000, 3);
    expect(r.sx).toBeCloseTo(125, 3);
    expect(r.sy).toBeCloseTo(0, 3);
    expect(r.sw / r.sh).toBeCloseTo(FRAME_ASPECT, 5);
  });

  it('zoom 2 halves both crop dimensions and re-centres', () => {
    const r = computeCropRect({ naturalW: 1000, naturalH: 1000, zoom: 2, offsetX: 0, offsetY: 0 });
    expect(r.sw).toBeCloseTo(375, 3);
    expect(r.sh).toBeCloseTo(500, 3);
    expect(r.sx).toBeCloseTo(312.5, 3);
    expect(r.sy).toBeCloseTo(250, 3);
  });

  it('offsets clamp so the crop never leaves the image', () => {
    const r = computeCropRect({ naturalW: 1000, naturalH: 1000, zoom: 1, offsetX: 5, offsetY: -5 });
    // offsetX huge → right-aligned: sx = nw - sw = 250; offsetY very negative → top: sy = 0
    expect(r.sx).toBeCloseTo(250, 3);
    expect(r.sy).toBeCloseTo(0, 3);
    expect(r.sx + r.sw).toBeLessThanOrEqual(1000 + 1e-6);
  });

  it('a tall source resolves to a valid 3:4 crop constrained by width', () => {
    const r = computeCropRect({ naturalW: 600, naturalH: 1200, zoom: 1 });
    // narrower than 3:4 → constrained by width: 600 x 800, centred at y=200
    expect(r.sw).toBeCloseTo(600, 3);
    expect(r.sh).toBeCloseTo(800, 3);
    expect(r.sx).toBeCloseTo(0, 3);
    expect(r.sy).toBeCloseTo(200, 3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- framing`
Expected: FAIL — `Failed to resolve import "./framing.js"` / functions not defined.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/framing.js`:

```js
// Pure framing geometry. No DOM, no Firebase — the single tested source of
// truth for "which source-pixel rectangle does the crop show". The live
// preview in ImageFramer and the baked output in canvas.js both derive from
// computeCropRect, so what you see is exactly what gets saved.

// Frame aspect as width / height. Wardrobe cards are Tailwind aspect-[3/4].
export const FRAME_ASPECT = 3 / 4;

// The initial crop: whole image fit to the frame, centred, no zoom.
export function defaultFrame() {
  return { zoom: 1, offsetX: 0, offsetY: 0 };
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// Largest FRAME_ASPECT rectangle that fits within the source (the zoom-1 crop).
function baseCrop(naturalW, naturalH, frameAspect) {
  const imgAspect = naturalW / naturalH;
  if (imgAspect > frameAspect) {
    // Image wider than the frame → the crop is limited by height.
    return { w: naturalH * frameAspect, h: naturalH };
  }
  // Image narrower/taller than the frame → limited by width.
  return { w: naturalW, h: naturalW / frameAspect };
}

// Given the source dimensions, the frame aspect, and a { zoom, offsetX, offsetY }
// frame, return the source-pixel crop rectangle { sx, sy, sw, sh }. zoom >= 1
// shrinks the crop (zooming in). offsetX/offsetY in [-1, 1] pan within the
// image; the result is always fully inside the image (full bleed, no gaps).
export function computeCropRect({
  naturalW,
  naturalH,
  frameAspect = FRAME_ASPECT,
  zoom = 1,
  offsetX = 0,
  offsetY = 0,
}) {
  const z = Math.max(1, zoom);
  const ox = clamp(offsetX, -1, 1);
  const oy = clamp(offsetY, -1, 1);
  const base = baseCrop(naturalW, naturalH, frameAspect);
  const sw = base.w / z;
  const sh = base.h / z;
  const sx = clamp((naturalW - sw) / 2 + (ox * (naturalW - sw)) / 2, 0, naturalW - sw);
  const sy = clamp((naturalH - sh) / 2 + (oy * (naturalH - sh)) / 2, 0, naturalH - sh);
  return { sx, sy, sw, sh };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- framing`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/framing.js src/lib/framing.test.js
git commit -m "feat(framing): pure crop geometry core (computeCropRect, defaultFrame)"
```

---

## Task 2: `framedUrl` display priority (TDD)

**Files:**
- Modify: `src/lib/polish.js:9-16` (`itemImageDisplay`)
- Test: `src/lib/polish.test.js`

- [ ] **Step 1: Write the failing test**

Append inside the `describe('itemImageDisplay', …)` block in `src/lib/polish.test.js` (before its closing `});`):

```js
  it('prefers framedUrl over cutoutUrl and original, forcing contain', () => {
    const item = mk(['orig0'], [{ framedUrl: 'https://s/framed0.jpg', cutoutUrl: 'https://s/cut0.png' }]);
    expect(itemImageDisplay(item, 0)).toEqual({ src: 'https://s/framed0.jpg', forceContain: true });
  });
  it('still prefers cutoutUrl over original when no framedUrl', () => {
    const item = mk(['orig0'], [{ cutoutUrl: 'https://s/cut0.png' }]);
    expect(itemImageDisplay(item, 0)).toEqual({ src: 'https://s/cut0.png', forceContain: true });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- polish`
Expected: FAIL — the framedUrl case returns `{ src: 'https://s/cut0.png', … }` (cutout wins) because `framedUrl` isn't handled yet.

- [ ] **Step 3: Write minimal implementation**

In `src/lib/polish.js`, replace the body of `itemImageDisplay` (currently starts at line 9) so the `framedUrl` branch comes first:

```js
export function itemImageDisplay(item, index = 0) {
  const images = Array.isArray(item?.images) ? item.images : [];
  const meta = Array.isArray(item?.imageMeta) ? item.imageMeta : [];
  const m = meta[index] || {};
  if (m.framedUrl) return { src: m.framedUrl, forceContain: true };
  if (m.cutoutUrl) return { src: m.cutoutUrl, forceContain: true };
  if (m.cutout === true) return { src: images[index] ?? null, forceContain: true };
  return { src: images[index] ?? null, forceContain: false };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- polish`
Expected: PASS (existing 4 + 2 new cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/polish.js src/lib/polish.test.js
git commit -m "feat(framing): itemImageDisplay prefers framedUrl"
```

---

## Task 3: Storage rules for the `framed/` path

**Files:**
- Modify: `storage.rules:14-20`

- [ ] **Step 1: Add the rule**

In `storage.rules`, immediately after the closing `}` of the `match /polish/{uid}/{file}` block (line 20), add:

```
    // Per-user framed (cropped) images: same policy as cut-outs — owner-write,
    // world-readable via the unguessable download-token URL.
    match /framed/{uid}/{file} {
      allow read: if true;
      allow write: if request.auth != null
                   && request.auth.uid == uid
                   && request.resource.size < 5 * 1024 * 1024
                   && request.resource.contentType.matches('image/.*');
    }
```

- [ ] **Step 2: Deploy the rules**

Run: `npx firebase deploy --only storage`
Expected: `+ storage: released rules storage.rules to firebase.storage`.

- [ ] **Step 3: Commit**

```bash
git add storage.rules
git commit -m "feat(framing): storage rules for framed image path"
```

---

## Task 4: Canvas bake helper

**Files:**
- Modify: `src/lib/canvas.js` (add `renderFramedDataUrl`; add an import from `./framing.js`)

This is DOM/canvas code (no jsdom in the test setup), so it is verified live in Task 7 rather than unit-tested. The tested logic it depends on (`computeCropRect`) is covered by Task 1.

- [ ] **Step 1: Add the framing import**

At the top of `src/lib/canvas.js`, add an import (place it beside the existing imports near line 1-3):

```js
import { computeCropRect, FRAME_ASPECT } from './framing.js';
```

- [ ] **Step 2: Add `renderFramedDataUrl`**

Append to `src/lib/canvas.js`:

```js
// Bake a framed crop to a compressed JPEG data URL. `src` is a same-origin or
// CORS-clean image URL/data URL (callers rehost external retailer URLs first —
// see ImageFramer). `frame` is { zoom, offsetX, offsetY }. The crop rectangle
// comes from computeCropRect so the output matches the editor's live preview
// exactly. Output is a 3:4 portrait JPEG (~675x900), adaptively compressed to
// stay well under the Storage/doc budget. Returns { url, ok } (ok:false on a
// load failure), mirroring removeImageBackground's shape.
export async function renderFramedDataUrl(src, frame, { frameAspect = FRAME_ASPECT, outputHeight = 900 } = {}) {
  const img = await loadImageForCanvas(src);
  if (!img) return { url: src, ok: false };
  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  const { sx, sy, sw, sh } = computeCropRect({ naturalW: nw, naturalH: nh, frameAspect, ...frame });
  const outH = outputHeight;
  const outW = Math.round(outH * frameAspect);
  const c = document.createElement('canvas');
  c.width = outW;
  c.height = outH;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#FFFFFF'; // JPEG has no alpha; crop is full-bleed so this only guards rounding edges
  ctx.fillRect(0, 0, outW, outH);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);
  let q = 0.86;
  let url = c.toDataURL('image/jpeg', q);
  while (url.length > 220_000 && q > 0.45) {
    q -= 0.1;
    url = c.toDataURL('image/jpeg', q);
  }
  return { url, ok: true };
}
```

- [ ] **Step 3: Verify it builds**

Run: `npm run build`
Expected: build completes, `files generated`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/canvas.js
git commit -m "feat(framing): renderFramedDataUrl canvas bake helper"
```

---

## Task 5: Persistence — `frameItemPrimary` + `revertFramePrimary`

**Files:**
- Modify: `src/lib/polish.js` (add two functions)
- Test: `src/lib/polish.test.js` (test the pure `revertFramePrimary`)

`frameItemPrimary` touches Firebase Storage (lazy-imported, DOM/network), so it is verified live in Task 7. `revertFramePrimary` is pure and is unit-tested here.

- [ ] **Step 1: Write the failing test**

Add a new `describe` block to `src/lib/polish.test.js` (after the `itemImageDisplay` block), and extend the import on line 2:

Change line 2 from:

```js
import { itemImageDisplay } from './polish.js';
```

to:

```js
import { itemImageDisplay, revertFramePrimary } from './polish.js';
```

Then append:

```js
describe('revertFramePrimary', () => {
  it('strips framedUrl and frame from index 0, leaving other meta intact', () => {
    const item = {
      images: ['orig0'],
      imageMeta: [{ framedUrl: 'https://s/f0.jpg', frame: { zoom: 2, offsetX: 0.1, offsetY: 0 }, angle: 'front', cutoutUrl: 'https://s/c0.png' }],
    };
    const meta = revertFramePrimary(item);
    expect(meta[0].framedUrl).toBeUndefined();
    expect(meta[0].frame).toBeUndefined();
    expect(meta[0].angle).toBe('front');       // untouched
    expect(meta[0].cutoutUrl).toBe('https://s/c0.png'); // untouched
  });
  it('is a no-op-safe copy when there is no imageMeta', () => {
    expect(revertFramePrimary({ images: ['a'] })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- polish`
Expected: FAIL — `revertFramePrimary is not a function` (import undefined).

- [ ] **Step 3: Write minimal implementation**

Append to `src/lib/polish.js`:

```js
// Frame item.images[0]: upload the already-baked crop data URL to Storage and
// record framedUrl + the frame params (so re-opening restores the crop). The
// original images[0] is untouched. Returns { ok, imageMeta } or { ok:false }.
// The canvas bake happens in the caller (ImageFramer via renderFramedDataUrl)
// so this stays a thin persistence seam, exactly like polishItemPrimary.
export async function frameItemPrimary(item, uid, dataUrl, frame) {
  if (!uid || !dataUrl || !dataUrl.startsWith('data:')) return { ok: false };
  const { storage } = await import('../firebase.js');
  const { ref, uploadString, getDownloadURL } = await import('firebase/storage');
  const path = `framed/${uid}/${safeId(item.id)}-0.jpg`;
  const r = ref(storage, path);
  await uploadString(r, dataUrl, 'data_url', { cacheControl: 'public, max-age=31536000' });
  const framedUrl = await getDownloadURL(r);
  const meta = Array.isArray(item.imageMeta) ? [...item.imageMeta] : [];
  while (meta.length < 1) meta.push({});
  meta[0] = { ...(meta[0] || {}), framedUrl, frame };
  return { ok: true, imageMeta: meta };
}

// Revert: drop the framed crop (framedUrl + frame). The original shows again.
// Pure — returns the updated imageMeta array. (We leave the Storage object; a
// re-frame overwrites it.)
export function revertFramePrimary(item) {
  const meta = Array.isArray(item.imageMeta) ? item.imageMeta.map((m) => ({ ...m })) : [];
  if (meta[0]) { delete meta[0].framedUrl; delete meta[0].frame; }
  return meta;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- polish`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/polish.js src/lib/polish.test.js
git commit -m "feat(framing): frameItemPrimary upload + revertFramePrimary"
```

---

## Task 6: The `ImageFramer` component

**Files:**
- Create: `src/components/ImageFramer.jsx`

DOM component (no jsdom) → verified live in Task 7. The preview transform derives `sx/sy` from `computeCropRect`, and drag deltas convert to offset deltas via the analytic inverse (`dox = -2·dx / (dispW - Fw)`), so the preview is a true WYSIWYG of the eventual bake.

- [ ] **Step 1: Create the component**

Create `src/components/ImageFramer.jsx`:

```jsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { computeCropRect, defaultFrame, FRAME_ASPECT } from '../lib/framing.js';
import { renderFramedDataUrl } from '../lib/canvas.js';

// Preview frame size (px). Portrait 3:4. The preview is a WYSIWYG window onto
// the same crop math the bake uses.
const FW = 264;
const FH = Math.round(FW / FRAME_ASPECT); // 352

// Resolve a canvas-safe editable source. Data URLs and Firebase Storage URLs
// export cleanly; external retailer URLs are rehosted server-side (imageProxy)
// to a data URL to dodge canvas taint — the same path that made polish reliable.
async function resolveEditableSrc(src) {
  if (!src) return null;
  if (src.startsWith('data:')) return src;
  if (src.includes('firebasestorage')) return src;
  try {
    const { imageUrlToCompressedDataUrl } = await import('../lib/net.js');
    const rehosted = await imageUrlToCompressedDataUrl(src);
    return rehosted && rehosted.startsWith('data:') ? rehosted : src;
  } catch {
    return src;
  }
}

// ImageFramer — fullscreen crop/zoom/pan editor.
//   baseSrc      the image to frame (cutoutUrl ?? images[0])
//   initialFrame stored { zoom, offsetX, offsetY } to restore, or defaultFrame()
//   onCommit({ dataUrl, frame })  called on Save with the baked crop
//   onClose()                     called on Cancel / backdrop
export default function ImageFramer({ baseSrc, initialFrame, onCommit, onClose }) {
  const [status, setStatus] = useState('loading'); // loading | ready | error | saving
  const [frame, setFrame] = useState(() => initialFrame || defaultFrame());
  const imgRef = useRef(null);          // the loaded HTMLImageElement (natural dims)
  const [editableSrc, setEditableSrc] = useState(null);
  const drag = useRef(null);            // { x, y } pointer origin during a pan

  // Resolve + load the base image once.
  useEffect(() => {
    let alive = true;
    (async () => {
      const safe = await resolveEditableSrc(baseSrc);
      if (!alive) return;
      if (!safe) { setStatus('error'); return; }
      const im = new Image();
      im.onload = () => { if (alive) { imgRef.current = im; setEditableSrc(safe); setStatus('ready'); } };
      im.onerror = () => { if (alive) setStatus('error'); };
      im.src = safe;
    })();
    return () => { alive = false; };
  }, [baseSrc]);

  // Derived display geometry for the <img> inside the frame. s0 maps the zoom-1
  // base crop to the frame; scale = s0 * zoom; left/top place the SAME sx/sy
  // that computeCropRect will crop, guaranteeing preview === output.
  const geom = (() => {
    const im = imgRef.current;
    if (!im) return null;
    const nw = im.naturalWidth, nh = im.naturalHeight;
    const imgAspect = nw / nh;
    const baseCropW = imgAspect > FRAME_ASPECT ? nh * FRAME_ASPECT : nw;
    const s0 = FW / baseCropW;
    const scale = s0 * frame.zoom;
    const { sx, sy } = computeCropRect({ naturalW: nw, naturalH: nh, ...frame });
    return { dispW: nw * scale, dispH: nh * scale, left: -sx * scale, top: -sy * scale };
  })();

  const onPointerDown = (e) => {
    if (status !== 'ready') return;
    drag.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!drag.current || !geom) return;
    const dx = e.clientX - drag.current.x;
    const dy = e.clientY - drag.current.y;
    drag.current = { x: e.clientX, y: e.clientY };
    // Analytic inverse of the preview mapping: moving the image by dx px changes
    // offsetX by -2·dx / (dispW - FW). Guard the degenerate no-overflow case.
    const spanX = geom.dispW - FW;
    const spanY = geom.dispH - FH;
    setFrame((f) => ({
      ...f,
      offsetX: spanX > 0 ? Math.max(-1, Math.min(1, f.offsetX - (2 * dx) / spanX)) : 0,
      offsetY: spanY > 0 ? Math.max(-1, Math.min(1, f.offsetY - (2 * dy) / spanY)) : 0,
    }));
  };
  const onPointerUp = () => { drag.current = null; };

  const onZoom = (e) => setFrame((f) => ({ ...f, zoom: Number(e.target.value) / 100 }));
  const onReset = () => setFrame(defaultFrame());

  const onSave = useCallback(async () => {
    if (status !== 'ready') return;
    setStatus('saving');
    try {
      const { url, ok } = await renderFramedDataUrl(editableSrc, frame);
      if (!ok) { setStatus('error'); return; }
      await onCommit({ dataUrl: url, frame });
    } catch {
      setStatus('error');
    }
  }, [status, editableSrc, frame, onCommit]);

  return (
    <div className="fixed inset-0 z-[120] bg-stone-900/80 backdrop-blur-sm flex items-center justify-center p-4"
         onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-[340px] max-w-full rounded-2xl bg-white overflow-hidden shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200">
          <button type="button" onClick={onClose}
            className="text-sm text-stone-500 hover:text-stone-800">Cancel</button>
          <span className="text-sm font-medium text-stone-800">Edit image</span>
          <button type="button" onClick={onSave} disabled={status !== 'ready'}
            className="text-sm font-medium text-emerald-700 disabled:opacity-40">
            {status === 'saving' ? 'Saving…' : 'Save'}
          </button>
        </div>

        <div className="bg-stone-800 p-5 flex items-center justify-center">
          <div className="relative overflow-hidden rounded-sm bg-stone-700 touch-none select-none"
               style={{ width: FW, height: FH }}
               onPointerDown={onPointerDown} onPointerMove={onPointerMove}
               onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
            {status === 'ready' && geom && editableSrc && (
              <img src={editableSrc} alt="" draggable={false}
                style={{ position: 'absolute', left: geom.left, top: geom.top, width: geom.dispW, height: geom.dispH, maxWidth: 'none' }} />
            )}
            {/* rule-of-thirds guides */}
            {status === 'ready' && (
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute top-0 bottom-0" style={{ left: '33.33%', width: 1, background: 'rgba(255,255,255,0.35)' }} />
                <div className="absolute top-0 bottom-0" style={{ left: '66.66%', width: 1, background: 'rgba(255,255,255,0.35)' }} />
                <div className="absolute left-0 right-0" style={{ top: '33.33%', height: 1, background: 'rgba(255,255,255,0.35)' }} />
                <div className="absolute left-0 right-0" style={{ top: '66.66%', height: 1, background: 'rgba(255,255,255,0.35)' }} />
              </div>
            )}
            {status === 'loading' && <div className="absolute inset-0 grid place-items-center text-xs text-stone-300">Loading…</div>}
            {status === 'error' && <div className="absolute inset-0 grid place-items-center text-xs text-red-200 px-4 text-center">Couldn’t load this image for editing.</div>}
          </div>
        </div>

        <div className="px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="text-xs text-stone-400">Zoom</span>
            <input type="range" min="100" max="300" step="1"
              value={Math.round(frame.zoom * 100)} onChange={onZoom}
              disabled={status !== 'ready'} className="flex-1" />
            <span className="text-xs font-medium text-stone-700 w-10 text-right">{frame.zoom.toFixed(2)}×</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[11px] text-stone-400">Frame 3:4 · matches your grid</span>
            <button type="button" onClick={onReset} disabled={status !== 'ready'}
              className="text-[11px] text-stone-500 hover:text-stone-800 disabled:opacity-40">Reset</button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify it builds**

Run: `npm run build`
Expected: build completes with no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ImageFramer.jsx
git commit -m "feat(framing): ImageFramer crop/zoom/pan editor component"
```

---

## Task 7: Wire the editor into the item detail view

**Files:**
- Modify: `src/App.jsx` (import; `ItemDetailView` open state, "Edit image" + "Framed · revert" buttons, `ImageFramer` render + save handler)

- [ ] **Step 1: Add imports**

In `src/App.jsx`, extend the polish import on line 73 from:

```js
import { itemImageDisplay, revertItemPrimary } from './lib/polish.js';
```

to:

```js
import { itemImageDisplay, revertItemPrimary, frameItemPrimary, revertFramePrimary } from './lib/polish.js';
```

Add near the other component imports (e.g. after the `ConciergePrompt` import ~line 27):

```js
import ImageFramer from './components/ImageFramer.jsx';
```

- [ ] **Step 2: Add editor open state inside `ItemDetailView`**

`ItemDetailView` begins at line 3652. Just after its existing state hooks near the top of the function body, add:

```js
  const [framerOpen, setFramerOpen] = useState(false);
```

(Confirm `useState` is already in the destructured React import at line 1 — it is, per the codebase convention.)

- [ ] **Step 3: Add the "Edit image" button and the framed-revert button**

In `ItemDetailView`, inside the image `<button>` block, the cut-out revert button sits at lines 3897-3909. Immediately AFTER that cut-out revert `)}` (line 3909) and BEFORE the `angle` badge block (line 3910), insert:

```jsx
                  {/* Framed · revert — mirrors the cut-out revert control */}
                  {item.imageMeta?.[Math.min(activePhoto, images.length - 1)]?.framedUrl && (
                    <button type="button"
                      onClick={async (e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        const nextMeta = revertFramePrimary(item);
                        await onUpdateItem({ ...item, imageMeta: nextMeta });
                        toast.show('Reverted to the un-cropped image', { kind: 'default' });
                      }}
                      className="absolute top-3 right-3 lg:top-4 lg:right-4 px-3 py-1.5 bg-white/90 backdrop-blur-md text-stone-700 hover:text-stone-900 text-[10px] tracking-widest uppercase rounded-full font-medium shadow-sm transition-colors mt-9">
                      Framed · revert
                    </button>
                  )}
                  {/* Edit image — opens the manual framer on the primary photo */}
                  <button type="button"
                    onClick={(e) => { e.stopPropagation(); e.preventDefault(); setFramerOpen(true); }}
                    className="absolute bottom-3 left-3 lg:bottom-4 lg:left-4 px-3 py-1.5 bg-white/90 backdrop-blur-md text-stone-700 hover:text-stone-900 text-[10px] tracking-widest uppercase rounded-full font-medium shadow-sm transition-colors">
                    Edit image
                  </button>
```

- [ ] **Step 4: Render `ImageFramer` and handle save**

Still in `ItemDetailView`, find the component's top-level returned JSX closing (the outermost wrapper). Add the framer just before the final closing tag of the returned fragment/div (co-located with other modals this view renders). Insert:

```jsx
      {framerOpen && (
        <ImageFramer
          baseSrc={(item.imageMeta?.[0]?.cutoutUrl) || item.images?.[0]}
          initialFrame={item.imageMeta?.[0]?.frame || undefined}
          onClose={() => setFramerOpen(false)}
          onCommit={async ({ dataUrl, frame }) => {
            const out = await frameItemPrimary(item, uid, dataUrl, frame);
            if (out.ok) {
              await onUpdateItem({ ...item, imageMeta: out.imageMeta });
              toast.show('Image framed ✓', { kind: 'success' });
            } else {
              toast.show('Could not frame this image', { kind: 'error' });
            }
            setFramerOpen(false);
          }}
        />
      )}
```

(`uid`, `onUpdateItem`, and `toast` are already available in `ItemDetailView`'s scope — `uid` and `onUpdateItem` are in its props signature at line 3652; `toast` via `useToast()` used by the existing revert button.)

- [ ] **Step 5: Build and verify live (the WYSIWYG loop)**

Run: `npm run build` → expect success.

Then, on the running dev server (localhost:5173, logged in), verify the full loop:
1. Open an item's detail → an "Edit image" chip shows on the photo.
2. Tap it → the framer opens; the photo fills the 3:4 frame.
3. Drag to pan and move the zoom slider → the image moves live; thirds guides show.
4. Tap Save → toast "Image framed ✓"; the detail photo now shows the cropped version, and a "Framed · revert" chip appears.
5. Re-open "Edit image" → your previous crop is restored (zoom + position).
6. Tap "Framed · revert" → the original returns; the chip disappears.
7. Check the wardrobe grid and a public share preview → the item shows the framed crop.
8. Test an item whose photo is an external retailer image (no cut-out) → it still loads into the framer (rehosted) and saves.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "feat(framing): Edit image entry point + framer wiring in item detail"
```

---

## Final review

After all tasks, dispatch a final code reviewer over the whole branch, then use superpowers:finishing-a-development-branch (verify tests → merge to main → `npm run build` → `npx firebase deploy --only hosting`).

**Manual QA checklist (live, logged in):**
- [ ] Frame a cut-out item → crop applies to the white-card version.
- [ ] Frame a plain-photo item → crop applies to the photo.
- [ ] Frame an external-CDN item with no cut-out → loads + saves (rehosted).
- [ ] Re-open restores the exact prior crop.
- [ ] Revert removes the crop everywhere (grid, detail, share).
- [ ] Zoom clamps at 3× and pan never shows empty gaps.
