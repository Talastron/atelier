# Branded Cutout Catalogue — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the item grid into a branded catalogue — clean cut-out items on **white cards** over the unchanged **ivory page** — by background-removing existing items onto white via a one-time "Polish my wardrobe" batch, stored **non-destructively** in Firebase Storage so every polish is one tap from revert.

**Architecture:** A new `src/lib/polish.js` runs the existing `removeImageBackground` on an item's primary photo and uploads the cut-out to Firebase Storage, recording its URL on `imageMeta[0].cutoutUrl` while the **original stays untouched** in `images[0]`. A pure `itemImageDisplay(item, index)` picks what to show (cut-out → contain on white; else original → bg-detection fallback). Tiles render white; the batch lives in Profile with progress/cancel/resume; revert clears `cutoutUrl`.

**Tech Stack:** React + Vite + Firebase (Firestore + Storage), `@imgly/background-removal` (client WASM, already used), Vitest for pure helpers.

**Spec:** `docs/superpowers/specs/2026-06-30-branded-cutout-catalogue-design.md` (Phase 1; new-item add-flow unification = Phase 2, noted at end).

**Palette (locked):** page ivory `#F7F5F2` (unchanged) · cards/tiles white `#FFFFFF` · cut-outs flattened on white (`canvas.js` unchanged).

---

## File Structure

| File | Responsibility | Create/Modify |
|------|----------------|---------------|
| `src/lib/polish.js` | `itemImageDisplay` (pure), `polishItemPrimary` (cutout + Storage upload), `revertItemPrimary` | **Create** |
| `src/lib/polish.test.js` | Vitest for `itemImageDisplay` | **Create** |
| `storage.rules` | add owner-scoped `polish/{uid}/**` path | Modify |
| `src/views/WardrobeView.jsx` | render via `itemImageDisplay` → white-card contain or bg-detection | Modify (`WardrobeCardImage`) |
| `src/App.jsx` | `ItemDetailView` render + **revert badge/button**; pass `user` to detail if needed | Modify (~3882) |
| `src/App.jsx` | `PublicShareView` grid white-card render | Modify (~8660) |
| `src/views/ProfileView.jsx` | "Polish my wardrobe" batch (progress/cancel/resume/summary); default toggle on; copy | Modify (`747–766`) |

**Manual prerequisite:** none new — Firebase Storage is already enabled (done earlier this session).

---

## Task 1: Storage rules for the polish path

**Files:** Modify `storage.rules`

- [ ] **Step 1: Add an owner-scoped polish path**

In `storage.rules`, inside `match /b/{bucket}/o {`, add this block **above** the catch-all deny:
```
    // Per-user cut-out images: written only by the owner; readable via the
    // download-token URL (unguessable) so <img> tags work without auth.
    match /polish/{uid}/{file} {
      allow read: if true;
      allow write: if request.auth != null
                   && request.auth.uid == uid
                   && request.resource.size < 5 * 1024 * 1024
                   && request.resource.contentType.matches('image/.*');
    }
```

- [ ] **Step 2: Deploy the rules**

Run: `firebase deploy --only storage`
Expected: "rules file storage.rules compiled successfully" + "Deploy complete!".

- [ ] **Step 3: Commit**
```bash
git add storage.rules
git commit -m "feat(polish): storage rules for per-user cut-out images"
```

---

## Task 2: `itemImageDisplay` — the pure display-source picker (TDD)

**Files:** Create `src/lib/polish.js`, `src/lib/polish.test.js`

- [ ] **Step 1: Write the failing test** — create `src/lib/polish.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { itemImageDisplay } from './polish.js';

const mk = (images, imageMeta) => ({ images, imageMeta });

describe('itemImageDisplay', () => {
  it('prefers the Storage cut-out URL and forces contain', () => {
    const item = mk(['orig0'], [{ cutoutUrl: 'https://s/cut0.png' }]);
    expect(itemImageDisplay(item, 0)).toEqual({ src: 'https://s/cut0.png', forceContain: true });
  });
  it('treats an inline cutout (cutout:true) as contain on the stored image', () => {
    const item = mk(['cut0'], [{ cutout: true }]);
    expect(itemImageDisplay(item, 0)).toEqual({ src: 'cut0', forceContain: true });
  });
  it('falls back to the original image with no forced fit', () => {
    const item = mk(['orig0'], [{}]);
    expect(itemImageDisplay(item, 0)).toEqual({ src: 'orig0', forceContain: false });
  });
  it('handles missing imageMeta and out-of-range index', () => {
    expect(itemImageDisplay(mk(['a'], undefined), 0)).toEqual({ src: 'a', forceContain: false });
    expect(itemImageDisplay(mk([], []), 0)).toEqual({ src: null, forceContain: false });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- polish`
Expected: FAIL — cannot resolve `./polish.js`.

- [ ] **Step 3: Implement** — create `src/lib/polish.js`:
```js
// Non-destructive cut-out polish. The original photo stays in item.images[i];
// the polished cut-out (if any) lives in Firebase Storage and its URL is held
// on item.imageMeta[i].cutoutUrl. `itemImageDisplay` is the single source of
// truth for what a tile shows and how it should be fitted. Firebase helpers are
// lazy-imported so this module's pure parts stay unit-testable.

// Pure: pick the display src + whether to force object-contain (a cut-out sits
// on a white card and must be shown whole). Returns { src, forceContain }.
export function itemImageDisplay(item, index = 0) {
  const images = Array.isArray(item?.images) ? item.images : [];
  const meta = Array.isArray(item?.imageMeta) ? item.imageMeta : [];
  const m = meta[index] || {};
  if (m.cutoutUrl) return { src: m.cutoutUrl, forceContain: true };
  if (m.cutout === true) return { src: images[index] ?? null, forceContain: true };
  return { src: images[index] ?? null, forceContain: false };
}

// URL-safe id for the Storage object.
function safeId(s) { return String(s || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 60) || 'x'; }

// Polish item.images[0]: remove its background (onto white), upload the cut-out
// to Storage, and return { imageMeta, ok } — the updated imageMeta array with
// cutoutUrl set on index 0. The original images[0] is left untouched. On
// failure returns { ok:false } and leaves imageMeta unchanged.
export async function polishItemPrimary(item, uid) {
  const original = (Array.isArray(item.images) ? item.images : [])[0];
  if (!original || !uid) return { ok: false };
  const { removeImageBackground } = await import('./canvas.js');
  const out = await removeImageBackground(original); // { url, ok }
  if (!out.ok) return { ok: false, error: out.error };
  const { storage } = await import('../firebase.js');
  const { ref, uploadString, getDownloadURL } = await import('firebase/storage');
  const path = `polish/${uid}/${safeId(item.id)}-0.jpg`;
  const r = ref(storage, path);
  await uploadString(r, out.url, 'data_url', { cacheControl: 'public, max-age=31536000' });
  const cutoutUrl = await getDownloadURL(r);
  const meta = Array.isArray(item.imageMeta) ? [...item.imageMeta] : [];
  while (meta.length < 1) meta.push({});
  meta[0] = { ...(meta[0] || {}), cutoutUrl };
  return { ok: true, imageMeta: meta };
}

// Revert: drop the cut-out (the original in images[0] shows again). Returns the
// updated imageMeta array. (We leave the Storage object; it's small and a
// re-polish overwrites it.)
export function revertItemPrimary(item) {
  const meta = Array.isArray(item.imageMeta) ? item.imageMeta.map((m) => ({ ...m })) : [];
  if (meta[0]) { delete meta[0].cutoutUrl; }
  return meta;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- polish`
Expected: PASS — 4 tests. (Only `itemImageDisplay` is tested; the Firebase helpers are exercised in-app.)

- [ ] **Step 5: Commit**
```bash
git add src/lib/polish.js src/lib/polish.test.js
git commit -m "feat(polish): non-destructive cut-out helpers + display picker (TDD)"
```

---

## Task 3: White-card rendering in the wardrobe grid

Render the wardrobe card via `itemImageDisplay`: cut-outs → `object-contain` on a **white** tile; everything else → the existing `useImageBg` fallback (never crops). This refines the in-progress `WardrobeCardImage`.

**Files:** Modify `src/views/WardrobeView.jsx` (`WardrobeCardImage`, ~8–94)

- [ ] **Step 1: Import the picker**

Add to the imports:
```js
import { itemImageDisplay } from "../lib/polish.js";
```

- [ ] **Step 2: Compute the display per active image and render accordingly**

Replace the `images.map(...)` block in `WardrobeCardImage` with the version below. It keeps the crossfade carousel but, per layer, uses `itemImageDisplay` for the **src + forced contain**, and only falls back to `useImageBg` when not a cut-out:
```jsx
      {images.map((src, i) => {
        const disp = itemImageDisplay(item, i);
        const showSrc = disp.src || src;
        // Cut-outs: contain on a white card. Otherwise let bg-detection decide
        // (it paints the tile the image's own colour, or covers busy photos).
        const detected = (i === safeIndex && !disp.forceContain && bg?.contain) ? bg.color : null;
        const contain = disp.forceContain || !!detected;
        const tileBg = disp.forceContain ? '#FFFFFF' : detected;
        return (
        <div
          key={i}
          style={tileBg ? { background: tileBg } : undefined}
          className={`absolute inset-0 transition-opacity duration-300 ease-out ${
            i === safeIndex ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <img
            src={showSrc}
            alt={i === safeIndex ? item.name : ''}
            onError={() => setFailed(true)}
            className={`w-full h-full transition-transform duration-700 ease-out group-hover:scale-105 pointer-events-none ${contain ? 'object-contain' : 'object-cover'}`}
            loading="lazy"
            decoding="async"
            draggable={false}
          />
        </div>
        );
      })}
```
Note: `bg = useImageBg(activeSrcForBg)` is already wired at the top of the component; keep it. The active image's bg is only consulted for non-cut-out items.

- [ ] **Step 3: Verify it compiles + locally**

Run: `npm run build` (must succeed) and `npm test` (all pass). Then `npm run dev` and view the Wardrobe at localhost:5173 — un-polished items behave as now (bg-detection, no crop). (Polished items appear after Task 6's batch.)

- [ ] **Step 4: Commit**
```bash
git add src/views/WardrobeView.jsx
git commit -m "feat(catalogue): wardrobe cards render cut-outs contain-on-white"
```

---

## Task 4: White-card rendering + revert in item detail

The detail main image already uses `object-contain`. Make it (a) show the cut-out when present, on a white surface, and (b) carry the **obvious revert** affordance.

**Files:** Modify `src/App.jsx` — `ItemDetailView` main image (~3882) and its container; add a revert handler. `ItemDetailView` already receives `onSaveFit`/`measurements`; confirm it can update the item — it has access to `onMarkOwned`-style `handleAddItem` via a new `onUpdateItem` prop.

- [ ] **Step 1: Pass an item-update + uid to ItemDetailView**

At the `<ItemDetailView ... />` render (~App.jsx:2048), add:
```jsx
  uid={user?.uid}
  onUpdateItem={(updated) => handleAddItem(updated)}
```
And add `uid`, `onUpdateItem` to the `ItemDetailView` destructured props (~App.jsx:3647).

- [ ] **Step 2: Import the picker + revert helper in App.jsx**
```js
import { itemImageDisplay, revertItemPrimary } from './lib/polish.js';
```

- [ ] **Step 3: Render the main image via the picker, on a white surface**

Replace the main detail `<img ... object-contain ...>` (~3882) with:
```jsx
                  {(() => {
                    const idx = Math.min(activePhoto, images.length - 1);
                    const disp = itemImageDisplay(item, idx);
                    return (
                      <div className="w-full h-full bg-white flex items-center justify-center">
                        <img src={disp.src || images[idx]} alt={item.name}
                          className="w-full h-full object-contain transition-transform duration-500 lg:group-hover:scale-[1.02]" />
                      </div>
                    );
                  })()}
```

- [ ] **Step 4: Add the cut-out badge + one-tap revert**

Just after that image block, add (only when the primary is a Storage cut-out):
```jsx
                  {item.imageMeta?.[Math.min(activePhoto, images.length - 1)]?.cutoutUrl && (
                    <button type="button"
                      onClick={async () => {
                        const nextMeta = revertItemPrimary(item);
                        await onUpdateItem({ ...item, imageMeta: nextMeta });
                        toast.show('Reverted to your original photo', { kind: 'default' });
                      }}
                      className="absolute top-3 right-3 lg:top-4 lg:right-4 px-3 py-1.5 bg-white/90 backdrop-blur-md text-stone-700 hover:text-stone-900 text-[10px] tracking-widest uppercase rounded-full font-medium shadow-sm transition-colors">
                      Cut-out · revert
                    </button>
                  )}
```
(`toast` is available in `ItemDetailView` via `useToast()`; if not already called there, add `const toast = useToast();` near its other hooks.)

- [ ] **Step 5: Verify**

Run `npm run build` + `npm test`. (Live revert is exercised after the batch in Task 6.)

- [ ] **Step 6: Commit**
```bash
git add src/App.jsx
git commit -m "feat(catalogue): item-detail shows cut-out on white + one-tap revert"
```

---

## Task 5: White-card rendering in the public share grid

**Files:** Modify `src/App.jsx` — `PublicShareView` outfit/lookbook item grid (~8660–8667)

- [ ] **Step 1: Make the shared item tiles white + contain**

The share snapshot stores `pieces[].images` (originals) but no `imageMeta`, so we can't know cut-out state there. Treat shared tiles uniformly: white tile + `object-contain` (shared items are product shots, and contain-on-white avoids cropping). Replace the piece image block (~8661–8666) with:
```jsx
                <div className="aspect-[3/4] rounded-2xl bg-white overflow-hidden smooth-shadow">
                  {(p.images || [])[0] ? (
                    <img src={p.images[0]} alt={p.name} loading="lazy" decoding="async" className="w-full h-full object-contain p-2" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-stone-300"><Shirt size={32} strokeWidth={1} /></div>
                  )}
                </div>
```

- [ ] **Step 2: Verify**: `npm run build` + `npm test`.

- [ ] **Step 3: Commit**
```bash
git add src/App.jsx
git commit -m "feat(catalogue): public share grid uses white-card contain"
```

---

## Task 6: "Polish my wardrobe" batch + default toggle (ProfileView)

**Files:** Modify `src/views/ProfileView.jsx` — the "Photo cutouts" section (`747–766`)

`ProfileView` already receives `items`, `onUpdateItem` (= `handleAddItem` upsert), `user`, `measurements`, `saveMeasurements`.

- [ ] **Step 1: Imports + state**

At the top of `src/views/ProfileView.jsx` add:
```js
import { polishItemPrimary } from "../lib/polish.js";
```
Inside the `ProfileView` component body (near its other hooks), add:
```js
  const [polishState, setPolishState] = React.useState(null); // null | { done, total, cancel } | { summary }
  const polishCancelRef = React.useRef(false);
```
(`React` is imported in this file; if only named hooks are imported, use `useState`/`useRef` directly to match the file's style.)

- [ ] **Step 2: The batch runner**

Add this handler in the component body:
```js
  const runPolishWardrobe = async () => {
    if (!user) return;
    polishCancelRef.current = false;
    // Owned items whose primary photo isn't already a cut-out.
    const targets = (items || []).filter((it) =>
      it.status !== 'wishlist' &&
      (it.images || []).length > 0 &&
      !(it.imageMeta?.[0]?.cutoutUrl) &&
      it.imageMeta?.[0]?.cutout !== true
    );
    setPolishState({ done: 0, total: targets.length, failed: 0 });
    let done = 0, failed = 0;
    for (const it of targets) {
      if (polishCancelRef.current) break;
      try {
        const res = await polishItemPrimary(it, user.uid);
        if (res.ok) { await onUpdateItem({ ...it, imageMeta: res.imageMeta }); }
        else { failed += 1; }
      } catch { failed += 1; }
      done += 1;
      setPolishState({ done, total: targets.length, failed });
      await new Promise((r) => setTimeout(r, 0)); // yield so the UI stays responsive
    }
    setPolishState({ summary: { done, total: targets.length, failed, cancelled: polishCancelRef.current } });
  };
```

- [ ] **Step 3: Default the toggle on + replace the section UI**

Replace the "Photo cutouts (Beta)" section JSX (`ProfileView.jsx:747–766`) with the version below — updated copy, **default-on** semantics (`measurements?.removeBackground !== false` ⇒ treat unset as on), the batch button, progress, and summary:
```jsx
      <div id="profile-cutouts" className="scroll-mt-24 bg-white border border-stone-200/60 rounded-[2rem] p-6 md:p-8 smooth-shadow">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <span className="brass-rule shrink-0" aria-hidden="true"></span>
              <h3 className="font-display text-xl md:text-2xl text-stone-900">Photo cutouts <span className="text-[10px] tracking-widest uppercase text-brass-600 ml-2 align-middle">Beta</span></h3>
            </div>
            <p className="text-stone-500 text-sm leading-relaxed max-w-xl">
              Remove the background from item photos so each piece sits on a clean white card. New items are polished automatically; if a cut-out ever looks wrong, the original is kept and one tap reverts it. Heavy in-browser model — first run downloads ~5MB.
            </p>
          </div>
          <label className="inline-flex items-center gap-3 cursor-pointer shrink-0">
            <span className="text-xs tracking-widest uppercase text-stone-500">{measurements?.removeBackground !== false ? 'On' : 'Off'}</span>
            <input type="checkbox" className="sr-only peer"
              checked={measurements?.removeBackground !== false}
              onChange={(e) => saveMeasurements({ ...measurements, removeBackground: e.target.checked })} />
            <span className="w-11 h-6 bg-stone-200 rounded-full peer-checked:bg-stone-900 relative transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-transform peer-checked:after:translate-x-5"></span>
          </label>
        </div>

        <div className="mt-6 pt-5 border-t border-stone-100">
          {!polishState && (
            <button type="button" onClick={runPolishWardrobe}
              className="text-xs tracking-widest uppercase px-5 py-3 rounded-full bg-stone-900 text-white hover:bg-stone-700 transition-colors">
              Polish my wardrobe
            </button>
          )}
          {polishState && !polishState.summary && (
            <div className="max-w-sm">
              <div className="flex items-center justify-between text-xs text-stone-500 mb-2">
                <span>Polishing… {polishState.done} / {polishState.total}{polishState.failed ? ` · ${polishState.failed} kept original` : ''}</span>
                <button type="button" onClick={() => { polishCancelRef.current = true; }} className="underline hover:text-stone-900">Stop</button>
              </div>
              <div className="h-1.5 rounded-full bg-stone-100 overflow-hidden">
                <div className="h-full bg-brass-400 transition-all" style={{ width: `${polishState.total ? Math.round((polishState.done / polishState.total) * 100) : 0}%` }} />
              </div>
            </div>
          )}
          {polishState?.summary && (
            <div className="text-sm text-stone-700">
              <p className="mb-2">
                {polishState.summary.done - polishState.summary.failed} polished
                {polishState.summary.failed ? ` · ${polishState.summary.failed} kept their original (review them)` : ''}
                {polishState.summary.cancelled ? ' · stopped — run again to continue' : ''}.
              </p>
              <button type="button" onClick={() => setPolishState(null)} className="text-xs tracking-widest uppercase underline text-stone-500 hover:text-stone-900">Done</button>
            </div>
          )}
        </div>
      </div>
```

- [ ] **Step 4: Verify (locally, with real data)**

Run `npm run build` + `npm test`. Then `npm run dev`, open Profile → Photo cutouts → "Polish my wardrobe" with a few items. Confirm: progress advances; items become clean cut-outs on white cards in the Wardrobe grid; "Stop" halts and "run again" resumes (skips done ones); the summary reports failures; opening a polished item shows "Cut-out · revert" and reverting restores the original.

- [ ] **Step 5: Commit**
```bash
git add src/views/ProfileView.jsx
git commit -m "feat(catalogue): Polish-my-wardrobe batch + default auto-polish on"
```

---

## Self-Review (completed by plan author)

**Spec coverage:** white cards/ivory page (Tasks 3–5); polished items contain seamless + un-polished never crop (Task 3 via `itemImageDisplay` + `useImageBg`); auto-polish default on (Task 6); "Polish my wardrobe" with progress/cancel/resume/summary (Task 6); obvious revert badge + one-tap (Task 4); non-destructive Storage-backed originals (Tasks 1–2); bg-detection retained as fallback (Task 3). ✓

**Placeholder scan:** none — every step has complete code.

**Type consistency:** `itemImageDisplay(item, index) → { src, forceContain }` is produced in Task 2 and consumed identically in Tasks 3–4. `polishItemPrimary(item, uid) → { ok, imageMeta }` produced in Task 2, consumed in Task 6. `revertItemPrimary(item) → imageMeta[]` produced in Task 2, consumed in Task 4. `imageMeta[0].cutoutUrl` is the single contract across all surfaces.

**Note for implementer:** resume works because the batch's `targets` filter excludes items that already have `imageMeta[0].cutoutUrl` — a re-run naturally continues where a cancel stopped.

---

## Phase 2 (separate plan, noted not built)

Unify the **new-item add-flow** onto the same non-destructive Storage model: instead of replacing `images[0]` inline and discarding the original at save (`App.jsx:2875`), keep the original in `images[0]` and store the cut-out via `polishItemPrimary` → `cutoutUrl`. This makes newly-added items revertible after save too (today they're one-way once saved). Small, isolated follow-up once Phase 1 is proven.
