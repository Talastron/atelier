# Flat-lay Phase Two Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let flat-lay pieces overlap and cast shadows by keeping the transparency in cut-outs, and migrate the existing wardrobe to alpha without destroying anything.

**Architecture:** `composeFlatlay` gains a `bleed` predicate: an accepted piece is scaled about its own centre and slid back inside the frame; a rejected piece keeps its exact box and is demoted below every accepted one. That single rule is the safety property — an opaque piece never grows, so it can never paint over a garment. The predicate is `hasAlphaCutout`, reading a new `imageMeta[0].alpha` flag, which doubles as the migration's resume checkpoint.

**Tech Stack:** React 18, Vite 6, Tailwind 4, vitest 4, Firebase (Firestore + Storage), `@imgly/background-removal` (browser WASM), Canvas 2D.

**Spec:** `apps/studio/docs/superpowers/specs/2026-09-03-flatlay-phase-two-design.md`

**Worktree:** `C:\Users\SibylleMoller-Sherwo\Documents\GitHub\atelier-wt-flatlay`, branch `phase-two-base`. Run everything from `apps/studio`. Do **not** `cd` to the main checkout.

---

## Read this before Task 1

**The wardrobe has no alpha images in it.** Every task up to Task 8 is therefore inert in production: `hasAlphaCutout` returns false for every stored item, so no piece bleeds and every surface renders exactly as it does today. This is deliberate. It means Tasks 1–7 can be merged and reviewed before a single stored image is touched. Do not "helpfully" backfill the flag.

**`pnpm build` will not catch a `ReferenceError`.** Vite bundles unresolved identifiers happily; they fail at runtime. A green build and a green test run do not mean a renderer works. Where a task changes rendering, the check is the test **plus** reading the diff for names that exist.

**Do not add a fallback that silently discards alpha.** This hazard has already bitten this codebase once (#78, where a trim quietly re-encoded every WebP cut-out back to JPEG) and Tasks 3 and 4 each disarm another instance of it. If an alpha encode cannot be written, the correct outcome is to leave the item unmigrated and report it — never to write a flattened image and call it success.

---

## File structure

| File | Responsibility | Change |
|---|---|---|
| `src/lib/flatlay.js` | Pure geometry. Placements from pieces. Knows nothing about images. | Add `BLEED`, `Z_DEMOTE`, `bleed` option |
| `src/lib/flatlay.test.js` | Engine tests | Add cases; one existing tilt test updated |
| `src/App.jsx`, `src/views/OutfitBuilder.jsx` | The two DOM call sites | Pass `overlap` — without this nothing ships |
| `src/lib/polish.js` | The single place that answers questions about an item's images | Add `hasAlphaCutout`; `polishItemPrimary` writes `alpha` |
| `src/lib/polish.test.js` | Pure-helper tests | Add `hasAlphaCutout` cases |
| `src/lib/trimCutout.js` | Trim a cut-out to its subject | Alpha-aware bounds; stop flattening onto white |
| `src/lib/trimCutout.test.js` | Trim tests | Add alpha cases |
| `src/lib/canvas.js` | Background removal, encoding, share-card drawing | Alpha mode; z-sort; rotation; shadow |
| `src/components/Flatlay.jsx` | DOM renderer | Cream ground, shadow, pass predicate |
| `src/views/ProfileView.jsx` | Wardrobe batch runners | Add the migration runner |
| `docs/superpowers/plans/2026-08-17-flatlay-composition.md` | Handoff | Correct the false claims |

`flatlay.js` stays pure geometry and takes a **predicate**, never an item's image format. `polish.js` stays the only module that knows what `imageMeta` means. That boundary is why the engine remains testable with plain objects.

---

### Task 1: The bleed predicate in the engine

**Files:**
- Modify: `apps/studio/src/lib/flatlay.js:300` (`composeFlatlay`)
- Test: `apps/studio/src/lib/flatlay.test.js`

**`overlap: true` must become a no-op on an unmigrated wardrobe.** Today it does two things besides nothing-much: it zeroes the gutters and it tilts every piece. Both are wrong now that bleeding is decided per piece.

- **Gutters.** Closing them was how the old design made pieces touch. Bleeding produces the overlap directly, so it is redundant — and harmful, because it shifts every piece in a look where nothing has alpha. Measured: it moves 6 of 6 pieces. Keeping the gutters costs almost nothing (15.7% worst overlap at `BLEED` 1.08 instead of 18.5%). So the gutters stop depending on `overlap` entirely.
- **Rotation.** A tilted *opaque* cut-out shows a slanted white edge against the cream ground — worse than leaving it upright. Rotation follows the same per-piece rule as bleeding.

Together these mean a look with no alpha renders **identically** to today with `overlap: true`, which is what makes turning it on at the call sites (Tasks 5 and 6) risk-free.

One existing test changes as a result: `tilts pieces within three degrees when overlap is on` (`flatlay.test.js:102`) must now pass a predicate. The other `overlap: true` test (`:38`) is untouched.

- [ ] **Step 1: Write the failing tests**

Append inside the existing `describe('composeFlatlay', …)` block in `apps/studio/src/lib/flatlay.test.js`:

```js
  // Phase two. A piece may grow into its neighbours only if its cut-out has
  // transparency; an opaque one that grew would paint a white box over the
  // garment beneath. The engine takes a predicate rather than reading images,
  // so it stays pure geometry.
  describe('bleed', () => {
    const overlapFrac = (a, b) => {
      const ox = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
      const oy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
      return (ox * oy) / Math.min(a.w * a.h, b.w * b.h);
    };
    const worstOverlap = (out) => {
      let worst = 0;
      for (let i = 0; i < out.length; i++) {
        for (let j = i + 1; j < out.length; j++) worst = Math.max(worst, overlapFrac(out[i], out[j]));
      }
      return worst;
    };

    it('overlaps nothing when no piece is allowed to bleed', () => {
      const out = composeFlatlay(LOOK, { overlap: true, bleed: () => false });
      expect(worstOverlap(out)).toBe(0);
    });

    it('defaults to no piece bleeding, so overlap alone cannot paint over a garment', () => {
      const out = composeFlatlay(LOOK, { overlap: true });
      expect(worstOverlap(out)).toBe(0);
    });

    it('overlaps pieces when every piece may bleed', () => {
      const out = composeFlatlay(LOOK, { overlap: true, bleed: () => true });
      expect(worstOverlap(out)).toBeGreaterThan(0.05);
    });

    it('does not bleed when overlap is off, whatever the predicate says', () => {
      const off = composeFlatlay(LOOK, { overlap: false, bleed: () => true });
      expect(worstOverlap(off)).toBe(0);
    });

    it('leaves a rejected piece exactly where it would otherwise sit', () => {
      const none = composeFlatlay(LOOK, { overlap: true, bleed: () => false });
      const some = composeFlatlay(LOOK, { overlap: true, bleed: (item) => item.category === 'Tops' });
      for (let i = 0; i < none.length; i++) {
        if (none[i].item.category === 'Tops') continue;
        expect(some[i].x).toBeCloseTo(none[i].x, 10);
        expect(some[i].y).toBeCloseTo(none[i].y, 10);
        expect(some[i].w).toBeCloseTo(none[i].w, 10);
        expect(some[i].h).toBeCloseTo(none[i].h, 10);
      }
    });

    // The safety property. An opaque piece never grows, so it has nothing
    // beneath it to spoil; sinking it below every bleeding piece means nothing
    // that DID grow can be covered by one.
    it('demotes every rejected piece below every accepted one', () => {
      const out = composeFlatlay(LOOK, { overlap: true, bleed: (item) => item.category === 'Tops' });
      const accepted = out.filter((p) => p.item.category === 'Tops');
      const rejected = out.filter((p) => p.item.category !== 'Tops');
      expect(accepted.length).toBeGreaterThan(0);
      expect(rejected.length).toBeGreaterThan(0);
      const lowestAccepted = Math.min(...accepted.map((p) => p.z));
      const highestRejected = Math.max(...rejected.map((p) => p.z));
      expect(highestRejected).toBeLessThan(lowestAccepted);
    });

    // A grown box is SLID back inside the frame, never resized to fit. Resizing
    // would squash the piece; letting it hang over the edge would crop it, which
    // is the "a dress and jacket appear completely cropped" fault.
    it('keeps every bled piece inside the frame', () => {
      const out = composeFlatlay(LOOK, { overlap: true, bleed: () => true });
      for (const p of out) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeGreaterThanOrEqual(0);
        expect(p.x + p.w).toBeLessThanOrEqual(1 + 1e-9);
        expect(p.y + p.h).toBeLessThanOrEqual(1 + 1e-9);
      }
    });

    it('keeps a bled piece the same shape it grew into', () => {
      const none = composeFlatlay(LOOK, { overlap: true, bleed: () => false });
      const all = composeFlatlay(LOOK, { overlap: true, bleed: () => true });
      for (let i = 0; i < none.length; i++) {
        expect(all[i].w / all[i].h).toBeCloseTo(none[i].w / none[i].h, 10);
        expect(all[i].w).toBeCloseTo(none[i].w * BLEED, 10);
      }
    });

    it('keeps a piece grown wider than the frame flush to the left edge', () => {
      const out = composeFlatlay([piece('o1', 'Outerwear')], { overlap: true, bleed: () => true });
      for (const p of out) {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.y).toBeGreaterThanOrEqual(0);
      }
    });

    // Every look shape, not just LOOK: a five-piece look never puts accessories
    // and jewellery in the frame together, which is how an earlier 71% collision
    // survived review.
    for (const [shape, categories] of Object.entries(SHAPES)) {
      it(`keeps every bled piece inside the frame — ${shape}`, () => {
        const out = composeFlatlay(categories.map((c, i) => piece(`p${i}`, c)), { overlap: true, bleed: () => true });
        for (const p of out) {
          expect(p.x).toBeGreaterThanOrEqual(0);
          expect(p.y).toBeGreaterThanOrEqual(0);
          expect(p.x + p.w).toBeLessThanOrEqual(1 + 1e-9);
          expect(p.y + p.h).toBeLessThanOrEqual(1 + 1e-9);
        }
      });
    }

    // The canvas draws in array order and has to sort by z to match the DOM.
    // That sort is only well-defined if no two pieces share a z — a tie would
    // let the share card and the app layer differently on the same look.
    it('gives every piece a distinct z so the draw order is unambiguous', () => {
      const out = composeFlatlay(LOOK, { overlap: true, bleed: (item) => item.category !== 'Bags' });
      const zs = out.map((p) => p.z);
      expect(new Set(zs).size).toBe(zs.length);
    });

    // An unmigrated wardrobe must look exactly as it does today. Turning overlap
    // on at the call sites is only safe because of this.
    it('renders a look with no alpha identically whether overlap is on or off', () => {
      const off = composeFlatlay(LOOK, { overlap: false });
      const on = composeFlatlay(LOOK, { overlap: true, bleed: () => false });
      for (let i = 0; i < off.length; i++) {
        expect(on[i].x).toBeCloseTo(off[i].x, 10);
        expect(on[i].y).toBeCloseTo(off[i].y, 10);
        expect(on[i].w).toBeCloseTo(off[i].w, 10);
        expect(on[i].h).toBeCloseTo(off[i].h, 10);
        expect(on[i].rotation).toBe(0);
      }
    });

    // A tilted opaque cut-out shows a slanted white edge against the cream
    // ground. Only a piece that carries transparency may tilt.
    it('tilts only the pieces that may bleed', () => {
      const out = composeFlatlay(LOOK, { overlap: true, bleed: (item) => item.category === 'Tops' });
      for (const p of out) {
        if (p.item.category === 'Tops') expect(Math.abs(p.rotation)).toBeGreaterThan(0);
        else expect(p.rotation).toBe(0);
      }
    });
  });
```

`SHAPES` is already declared in this file at line 64; the new loop reuses it. If the new `describe` block is placed outside the scope where `SHAPES` and `LOOK` are visible, move it inside — do not redeclare them.

Change the import at `apps/studio/src/lib/flatlay.test.js:2` to bring in `BLEED`:

```js
import { composeFlatlay, rotationFor, BLEED } from './flatlay.js';
```

And update the one existing test that assumed `overlap` alone tilts. Replace the body of `tilts pieces within three degrees when overlap is on` at `apps/studio/src/lib/flatlay.test.js:102`:

```js
  it('tilts pieces within three degrees when overlap is on', () => {
    const out = composeFlatlay(LOOK, { overlap: true, bleed: () => true });
```

leaving the rest of that test exactly as it is.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --dir apps/studio test -- flatlay`

Expected: FAIL. `BLEED` is `undefined`, and `overlaps pieces when every piece may bleed` fails with `0` not greater than `0.05` — which is the phase-two regression: `overlap: true` currently overlaps nothing.

- [ ] **Step 3: Add the constants**

In `apps/studio/src/lib/flatlay.js`, immediately after the `INNER_GUTTER` declaration:

```js
// How far a piece grows into its neighbours when it is allowed to bleed. Scaled
// about the piece's own centre, so the anatomy, the caps and the aspect clamp
// are all untouched. Measured on a six-piece look with the gutters retained:
// 1.08 gives a 15.7% worst pairwise overlap across 8 overlapping pairs, with
// nothing leaving the frame. This is the visual dial — 1.12 gives 24.1%.
export const BLEED = 1.08;

// Every accepted piece keeps its own z (a slot's 1-5 plus its within-slot
// index). Subtracting this puts a rejected piece below all of them however the
// slots are numbered, and leaves the accepted pieces' order among themselves
// untouched.
const Z_DEMOTE = 100;
```

- [ ] **Step 4: Add the growth helper**

In `apps/studio/src/lib/flatlay.js`, immediately above `export function composeFlatlay`:

```js
// Grow a cell about its own centre, then SLIDE it back inside the frame — never
// resize it to fit. Resizing would squash the piece; leaving it hanging over the
// edge would crop it, and both stages clip. On a six-piece look, five of six
// pieces leave the frame at any growth above 1.0, so this clamp is not an edge
// case: it is the common path.
//
// The outer Math.max(0, ...) matters. A piece grown wider than the frame gives a
// negative upper bound, and without it the piece would be pushed off the LEFT
// edge — the exact fault being avoided.
function bleedCell(cell, factor) {
  const w = cell.w * factor;
  const h = cell.h * factor;
  const x = cell.x - cell.w * (factor - 1) / 2;
  const y = cell.y - cell.h * (factor - 1) / 2;
  return {
    x: Math.min(Math.max(x, 0), Math.max(0, 1 - w)),
    y: Math.min(Math.max(y, 0), Math.max(0, 1 - h)),
    w,
    h,
  };
}
```

- [ ] **Step 5: Wire the predicate into `composeFlatlay`**

In `apps/studio/src/lib/flatlay.js`, replace the signature at line 300 and the mapping at the end of the function.

Signature — replace:

```js
export function composeFlatlay(pieces, { overlap = false, max = 8 } = {}) {
```

with:

```js
export function composeFlatlay(pieces, { overlap = false, max = 8, bleed = () => false } = {}) {
```

Gutters — replace:

```js
  // Overlap closes the gaps: the gutters are the one geometric difference
  // between the two modes, alongside rotation.
  const gutter = overlap ? 0 : GUTTER;
  const innerGutter = overlap ? 0 : INNER_GUTTER;
```

with:

```js
  // The gutters no longer depend on `overlap`. Closing them was how the old
  // design made pieces touch; bleeding produces the overlap directly, so closing
  // them as well is redundant — and harmful, because it would shift every piece
  // in a look where nothing has alpha (measured: 6 of 6). Keeping them costs
  // 15.7% worst pairwise overlap instead of 18.5%, which buys the far more
  // valuable property that an unmigrated look renders exactly as it does today.
  const gutter = GUTTER;
  const innerGutter = INNER_GUTTER;
```

Mapping — replace the `return ordered.map((item) => { … })` body's final `return { … }` object with:

```js
    const cell = tile(allocation.box, index, total, innerGutter, allocation.grid);
    // Only a piece with real transparency may grow into its neighbours. An
    // opaque one that grew would paint a white rectangle across the garment
    // beneath — worse than the grid this replaced. A piece that cannot bleed
    // keeps its exact box AND sinks below every piece that can, so nothing
    // which grew can be covered by one.
    const mayBleed = overlap && bleed(item) === true;
    const box = mayBleed ? bleedCell(cell, BLEED) : cell;
    return {
      item,
      x: clamp01(box.x),
      y: clamp01(box.y),
      w: clamp01(box.w),
      h: clamp01(box.h),
      // Tilt follows the same per-piece rule. A tilted opaque cut-out shows a
      // slanted white edge against the cream ground — worse than upright.
      rotation: mayBleed ? rotationFor(item?.id) : 0,
      z: allocation.z + index - (overlap && !mayBleed ? Z_DEMOTE : 0),
    };
```

Also update the JSDoc block above `composeFlatlay` — replace the `@param {number} [options.max]` line's following `@returns` line so the block reads, after the existing `options.max` entry:

```js
 * @param {(item: object) => boolean} [options.bleed] Which pieces may grow into
 *   their neighbours. Defaults to () => false, which is the safe answer: a piece
 *   without transparency that grew would paint a white box over the garment
 *   beneath. Only consulted when `overlap` is true.
 * @returns {Array<{item: object, x: number, y: number, w: number, h: number, rotation: number, z: number}>}
```

Delete the now-stale sentence in the same JSDoc block that reads `True needs cut-outs with transparency: overlapping opaque images means a white rectangle covering the garment beneath, which is worse than a grid.` and replace it with:

```js
 *   True permits bleeding and tilting, but decides neither: `bleed` does, per
 *   piece. With no piece accepted, true and false produce identical geometry,
 *   which is what lets it be switched on before any image has been migrated.
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm --dir apps/studio test -- flatlay`

Expected: PASS, all of them, including the existing 23.

- [ ] **Step 7: Run the whole suite**

Run: `pnpm --dir apps/studio test`

Expected: PASS. 231 before, 240 after.

- [ ] **Step 8: Commit**

```bash
git add apps/studio/src/lib/flatlay.js apps/studio/src/lib/flatlay.test.js
git commit -m "feat(flatlay): let pieces with transparency bleed into their neighbours

overlap: true stopped overlapping anything when the adaptive layout made
the frame a partition. It closed gutters and tilted; worst pairwise
overlap was 0.0%. Overlap now comes from growing each accepted placement
about its own centre and sliding it back inside the frame.

The predicate defaults to rejecting everything, so overlap alone still
cannot paint an opaque piece over a garment.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: `hasAlphaCutout`

**Files:**
- Modify: `apps/studio/src/lib/polish.js` (after `flatlayTreatment`, around line 27)
- Test: `apps/studio/src/lib/polish.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `apps/studio/src/lib/polish.test.js`:

```js
describe('hasAlphaCutout', () => {
  it('is false for an item with no imageMeta at all', () => {
    expect(hasAlphaCutout({ images: ['a.jpg'] })).toBe(false);
  });
  it('is false for an empty imageMeta array', () => {
    expect(hasAlphaCutout(mk(['a.jpg'], []))).toBe(false);
  });
  it('is false for an inline cut-out with no alpha flag', () => {
    expect(hasAlphaCutout(mk(['cut0'], [{ cutout: true }]))).toBe(false);
  });
  it('is false for a Storage cut-out with no alpha flag', () => {
    expect(hasAlphaCutout(mk(['orig0'], [{ cutoutUrl: 'https://s/c.webp' }]))).toBe(false);
  });
  it('is true only when alpha is exactly true', () => {
    expect(hasAlphaCutout(mk(['orig0'], [{ cutoutUrl: 'https://s/c.webp', alpha: true }]))).toBe(true);
  });
  // Truthiness is not enough: a half-written migration record must not be
  // mistaken for a finished one, because the flag is also the resume checkpoint.
  it('is false for a truthy non-true alpha value', () => {
    expect(hasAlphaCutout(mk(['orig0'], [{ cutoutUrl: 'https://s/c.webp', alpha: 'yes' }]))).toBe(false);
  });
  it('is false for null and undefined items', () => {
    expect(hasAlphaCutout(null)).toBe(false);
    expect(hasAlphaCutout(undefined)).toBe(false);
  });
});
```

Update the import at `apps/studio/src/lib/polish.test.js:2`:

```js
import { itemImageDisplay, revertFramePrimary, flatlayTreatment, promoteImageToMain, hasAlphaCutout } from './polish.js';
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --dir apps/studio test -- polish`

Expected: FAIL with `hasAlphaCutout is not a function`.

- [ ] **Step 3: Implement it**

In `apps/studio/src/lib/polish.js`, directly after the `flatlayTreatment` function:

```js
// Whether this item's cut-out carries real transparency, and so may overlap its
// neighbours in a flat-lay. Written by the migration and by every new polish;
// absent on everything cut out before phase two.
//
// The test is for `true` and not merely truthiness because this flag doubles as
// the migration's resume checkpoint — "done" means "has alpha: true", and there
// is no separate progress record to drift out of step with it. A half-written
// value must read as not-done so the next run retries the item.
export function hasAlphaCutout(item) {
  const meta = Array.isArray(item?.imageMeta) ? item.imageMeta : [];
  return meta[0]?.alpha === true;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --dir apps/studio test -- polish`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/studio/src/lib/polish.js apps/studio/src/lib/polish.test.js
git commit -m "feat(polish): add hasAlphaCutout, the predicate that gates bleeding

One place asks whether an item's cut-out has transparency; the engine and
both renderers pass it in. Tests for true rather than truthiness because
the same flag is the migration's resume checkpoint.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Stop the trim from destroying alpha

**Files:**
- Modify: `apps/studio/src/lib/trimCutout.js:15` (`contentBounds`), `:83-84` (the white fill)
- Test: `apps/studio/src/lib/trimCutout.test.js`

**Why this task exists.** It is not in the spec; it was found while planning. `polishItemPrimary` removes the background and **then** trims the result, so `trimCutoutDataUrl` is what actually gets stored on the polish path. It breaks alpha in two independent ways:

1. `contentBounds` detects the subject by colour: `255 - Math.min(r, g, b)`. A fully transparent pixel reads from `getImageData` as `(0,0,0,0)`, so `dev = 255` — far above the threshold of 14. **Every transparent pixel counts as subject.** The box becomes the whole image, coverage hits 1.0, and the trim bails out. Alpha items would silently lose the "fills its tile" behaviour.
2. If it did trim, `octx.fillStyle = '#FFFFFF'; octx.fillRect(...)` **flattens the alpha back onto white**, one line after removal produced it.

This is the third appearance of this exact hazard in this function: #78 caught it re-encoding WebP straight back to JPEG. Leaving it would make the entire migration a no-op on the path most items use.

- [ ] **Step 1: Write the failing tests**

Append to `apps/studio/src/lib/trimCutout.test.js`:

```js
describe('contentBounds with an alpha mask', () => {
  // Build RGBA pixels: a `size` square that is fully transparent except for an
  // opaque red block at (bx, by, bw, bh). Transparent pixels are (0,0,0,0) —
  // which is what getImageData returns and why a colour-only test reads them as
  // BLACK, i.e. as subject.
  const alphaPixels = (size, bx, by, bw, bh) => {
    const data = new Uint8ClampedArray(size * size * 4); // all zeroes: transparent
    for (let y = by; y < by + bh; y++) {
      for (let x = bx; x < bx + bw; x++) {
        const i = (y * size + x) * 4;
        data[i] = 220; data[i + 1] = 40; data[i + 2] = 40; data[i + 3] = 255;
      }
    }
    return { data, width: size, height: size };
  };

  it('finds the subject by alpha, not by colour, when the image has transparency', () => {
    expect(contentBounds(alphaPixels(20, 5, 6, 4, 3))).toEqual({ x: 5, y: 6, w: 4, h: 3 });
  });

  it('still finds a subject on a white ground when there is no transparency', () => {
    const size = 20;
    const data = new Uint8ClampedArray(size * size * 4);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 255; data[i + 1] = 255; data[i + 2] = 255; data[i + 3] = 255;
    }
    for (let y = 6; y < 9; y++) {
      for (let x = 5; x < 9; x++) {
        const i = (y * size + x) * 4;
        data[i] = 220; data[i + 1] = 40; data[i + 2] = 40; data[i + 3] = 255;
      }
    }
    expect(contentBounds({ data, width: size, height: size })).toEqual({ x: 5, y: 6, w: 4, h: 3 });
  });

  it('returns null for a fully transparent image', () => {
    const size = 8;
    expect(contentBounds({ data: new Uint8ClampedArray(size * size * 4), width: size, height: size })).toBeNull();
  });
});
```

Ensure `contentBounds` is imported at the top of `apps/studio/src/lib/trimCutout.test.js`. If the existing import line does not already include it, add it.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --dir apps/studio test -- trimCutout`

Expected: FAIL. `finds the subject by alpha` returns the whole 20×20 frame (`{x:0,y:0,w:20,h:20}`) because transparent pixels read as black. `returns null for a fully transparent image` also fails, for the same reason.

- [ ] **Step 3: Make `contentBounds` alpha-aware**

In `apps/studio/src/lib/trimCutout.js`, replace the whole `contentBounds` function with:

```js
// Pure: given raw RGBA pixels, return the bounding box of "content" pixels as
// { x, y, w, h }, or null if there is none.
//
// Two detection modes, because the input can be either kind of cut-out. When the
// image carries transparency, ALPHA is the truth and colour is irrelevant — a
// white shirt on a transparent ground is entirely subject. When it does not, the
// subject is what is not white, and `threshold` is how far the darkest channel
// must fall below 255 to count: high enough to ignore off-white JPEG noise, low
// enough to catch cream and pale subjects.
//
// Getting this wrong is silent and total. getImageData returns a fully
// transparent pixel as (0, 0, 0, 0), so a colour-only test reads it as BLACK and
// therefore as subject — the box becomes the whole frame, coverage hits 1.0, and
// the caller concludes the cut-out is already tight and leaves it alone.
export function contentBounds({ data, width, height }, threshold = 14) {
  let hasAlpha = false;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) { hasAlpha = true; break; }
  }

  let minX = width, minY = height, maxX = -1, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const isContent = hasAlpha
        ? data[i + 3] > 8
        : 255 - Math.min(data[i], data[i + 1], data[i + 2]) >= threshold;
      if (!isContent) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < 0) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --dir apps/studio test -- trimCutout`

Expected: PASS, including every existing trim test — the white-ground path is unchanged when no pixel has alpha below 255.

- [ ] **Step 5: Stop the white fill when the source has alpha**

In `apps/studio/src/lib/trimCutout.js`, replace:

```js
  const octx = out.getContext('2d');
  octx.fillStyle = '#FFFFFF';
  octx.fillRect(0, 0, cw, ch);
  octx.drawImage(src, x0, y0, cw, ch, 0, 0, cw, ch);
```

with:

```js
  const octx = out.getContext('2d');
  // Only paint a ground under a cut-out that HAS one. polishItemPrimary removes
  // the background and then trims the result, so this function is what actually
  // gets stored on the polish path — filling white here would flatten the alpha
  // one line after removal produced it, and the migration would be a silent
  // no-op on the path most items use. (#78 caught the same shape of bug when
  // this function re-encoded WebP straight back to JPEG.)
  const keepAlpha = hasAlphaPixels(pixels);
  if (!keepAlpha) {
    octx.fillStyle = '#FFFFFF';
    octx.fillRect(0, 0, cw, ch);
  }
  octx.drawImage(src, x0, y0, cw, ch, 0, 0, cw, ch);
```

Add this helper directly below `contentBounds`:

```js
// Whether any pixel is less than fully opaque. Exported so the trim and the
// encode agree about which kind of image they are handling.
export function hasAlphaPixels({ data }) {
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) return true;
  }
  return false;
}
```

- [ ] **Step 6: Keep the encoding lossless of alpha**

Still in `apps/studio/src/lib/trimCutout.js`, replace the encode block:

```js
  const webp = await canEncodeWebp();
  const url = await pickEncoding(
    async (quality) => out.toDataURL(webp ? 'image/webp' : 'image/jpeg', quality),
    webp ? WEBP_LADDER : JPEG_LADDER,
```

with:

```js
  const webp = await canEncodeWebp();
  // JPEG has no alpha. Trimming an alpha cut-out on a browser that cannot write
  // WebP would flatten it silently, so we return the input untrimmed instead —
  // a slightly loose cut-out is a far better outcome than a destroyed one.
  if (keepAlpha && !webp) return { url: dataUrl, ok: false };
  const url = await pickEncoding(
    async (quality) => out.toDataURL(webp ? 'image/webp' : 'image/jpeg', quality),
    webp ? WEBP_LADDER : JPEG_LADDER,
```

- [ ] **Step 7: Run the whole suite**

Run: `pnpm --dir apps/studio test`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/studio/src/lib/trimCutout.js apps/studio/src/lib/trimCutout.test.js
git commit -m "fix(trim): detect the subject by alpha, and stop flattening it onto white

polishItemPrimary removes the background and then trims, so this function
is what gets stored on the polish path. It broke alpha twice over: a
transparent pixel reads from getImageData as (0,0,0,0), so a colour-only
test counted it as subject and the trim bailed out as already-tight; and
the output canvas was filled white before drawing, flattening whatever
survived.

Third time this function has sprung this trap - #78 caught it re-encoding
WebP back to JPEG. Where WebP cannot be written, an alpha cut-out is now
returned untrimmed rather than flattened.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Alpha mode in `removeImageBackground`

**Files:**
- Modify: `apps/studio/src/lib/canvas.js:660` (`removeImageBackground`)
- Modify: `apps/studio/src/lib/polish.js:70` (`polishItemPrimary`)

There is no unit test here: the function needs a DOM canvas, `@imgly` WASM and a real encoder, none of which exist under vitest. Its correctness is established by the alpha harness (`tools/alpha-check.html`) and by visual review in Task 8. Do not fake a test that asserts nothing.

- [ ] **Step 1: Add the alpha option**

In `apps/studio/src/lib/canvas.js`, replace the signature:

```js
export async function removeImageBackground(dataUrl) {
```

with:

```js
// `alpha: true` keeps the transparency @imgly produces instead of compositing
// onto white. Measured across 32 real garments, WebP with alpha at q80 is 1.64x
// JPEG-on-white by aggregate bytes, and the largest was 147K against a 161KB
// cap — the reason phase two is affordable at all. PNG with alpha is 10.2x,
// which is what made the original flatten-onto-white decision correct at the
// time and wrong to generalise.
export async function removeImageBackground(dataUrl, { alpha = false } = {}) {
```

- [ ] **Step 2: Skip the white fill and force WebP when alpha is wanted**

In the same function, replace:

```js
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(cutoutImg, 0, 0, w, h);
```

with:

```js
    // Flattened onto white unless alpha was asked for. Discarding the alpha is
    // what makes the file small, and what phase two undoes.
    if (!alpha) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, w, h);
    }
    ctx.drawImage(cutoutImg, 0, 0, w, h);
```

Then replace the encoder selection:

```js
    const webp = await canEncodeWebp();
    const type = webp ? 'image/webp' : 'image/jpeg';
    const ladder = webp ? WEBP_LADDER : JPEG_LADDER;
```

with:

```js
    const webp = await canEncodeWebp();
    // JPEG cannot carry alpha. Falling back to it here would flatten the
    // transparency with nothing in the logs to say so — the same silent class of
    // failure the toDataURL feature-detect exists to prevent. An alpha request
    // that cannot be honoured must FAIL, so the caller leaves the item
    // unmigrated and reports it, rather than storing a flattened image and
    // recording alpha: true against it.
    if (alpha && !webp) throw new Error('this browser cannot write WebP, so alpha cannot be kept');
    const type = webp ? 'image/webp' : 'image/jpeg';
    const ladder = webp ? WEBP_LADDER : JPEG_LADDER;
```

Finally, replace the success return:

```js
    if (!cutoutUrl) throw new Error('could not encode the cut-out');
    return { url: cutoutUrl, ok: true };
```

with:

```js
    if (!cutoutUrl) throw new Error('could not encode the cut-out');
    return { url: cutoutUrl, ok: true, alpha };
```

- [ ] **Step 3: Let `polishItemPrimary` ask for alpha and record it**

In `apps/studio/src/lib/polish.js`, replace the signature:

```js
export async function polishItemPrimary(item, uid) {
```

with:

```js
export async function polishItemPrimary(item, uid, { alpha = false } = {}) {
```

Replace the removal call:

```js
  const out = await removeImageBackground(original); // { url, ok }
  if (!out.ok) return { ok: false, error: out.error };
```

with:

```js
  const out = await removeImageBackground(original, { alpha }); // { url, ok, alpha }
  if (!out.ok) return { ok: false, error: out.error };
```

Replace the meta write:

```js
  meta[0] = { ...(meta[0] || {}), cutoutUrl };
```

with:

```js
  // The alpha flag is also the migration's resume checkpoint, so it is only ever
  // written alongside a cut-out that actually carries transparency.
  meta[0] = { ...(meta[0] || {}), cutoutUrl };
  if (out.alpha === true) meta[0].alpha = true;
  else delete meta[0].alpha;
```

Update the comment above `polishItemPrimary` — replace `remove its background (onto white)` with `remove its background (onto white, or keeping the alpha when asked)`.

- [ ] **Step 4: Verify the build and suite**

Run: `pnpm --dir apps/studio build && pnpm --dir apps/studio test`

Expected: both PASS. Note that a green build here proves only that the module parses — it cannot exercise `@imgly`.

- [ ] **Step 5: Read the diff for undefined names**

Run: `git diff apps/studio/src/lib/canvas.js apps/studio/src/lib/polish.js`

Check by eye that `alpha`, `webp`, `out.alpha` and `meta[0]` are all names that exist in their scope. Vite bundles unresolved identifiers without complaint; they fail at runtime.

- [ ] **Step 6: Commit**

```bash
git add apps/studio/src/lib/canvas.js apps/studio/src/lib/polish.js
git commit -m "feat(images): keep the alpha when asked, and refuse to fake it

removeImageBackground gains alpha: true, which skips the white composite.
Where WebP cannot be written the call now throws rather than falling back
to JPEG - a fallback would flatten the transparency silently and record
alpha: true against a flattened image, corrupting the resume checkpoint.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: The DOM renderer

**Files:**
- Modify: `apps/studio/src/components/Flatlay.jsx`

- [ ] **Step 1: Import the predicate**

In `apps/studio/src/components/Flatlay.jsx`, replace line 4:

```js
import { flatlayTreatment, itemImageDisplay } from '../lib/polish.js';
```

with:

```js
import { flatlayTreatment, hasAlphaCutout, itemImageDisplay } from '../lib/polish.js';
```

- [ ] **Step 2: Add the shadow constant and correct the stale block comment**

Replace the `MAX_STAGE_ASPECT` declaration and the block comment above the component (the paragraph beginning `// The ground is WHITE, and that is load-bearing.` through `// Phase two changes 'ground' to cream and flips 'overlap'; nothing else.`) with:

```js
const MAX_STAGE_ASPECT = 1.2;

// The shadow under a piece that carries transparency. It is drawn with
// filter: drop-shadow, which follows the ALPHA CHANNEL rather than the element
// box — so it traces the garment, not a rectangle. On an opaque cut-out the same
// rule would outline a box, which is why only bleeding pieces get it.
//
// It is doing more work than it looks. A white garment has essentially no
// contrast against any cream in the palette (1.088:1 against the page), so once
// pieces overlap there is nothing separating a white shirt from the cream coat
// beneath it. The shadow is the separation, not a flourish on top of one.
const PIECE_SHADOW = 'drop-shadow(0 6px 14px rgba(28, 25, 23, 0.16))';
```

Then, above the component, replace the removed paragraph with:

```js
// The default ground is the page cream. It used to be white, and that was
// load-bearing: every cut-out stored before phase two is a JPEG flattened onto
// #FFFFFF, so on white it was indistinguishable from a transparent one. That is
// no longer what keeps them from clashing — a piece without alpha simply does
// not bleed, and sits below everything that does. See composeFlatlay's `bleed`.
```

- [ ] **Step 3: Change the default ground and pass the predicate**

Replace:

```js
  ground = '#FFFFFF',
```

with:

```js
  ground = '#F7F5F2',
```

Replace:

```js
  const placements = composeFlatlay(pieces, { overlap, max });
```

with:

```js
  const placements = composeFlatlay(pieces, { overlap, max, bleed: hasAlphaCutout });
```

- [ ] **Step 4: Apply the shadow to bleeding pieces**

Inside the `placements.map(...)` callback, directly after `const plated = flatlayTreatment(item) === 'plate';`, add:

```js
        const bleeding = overlap && hasAlphaCutout(item);
```

Then in the `style` object of the `<Tag>` element, after the `transform` line, add:

```js
              filter: bleeding ? PIECE_SHADOW : undefined,
```

- [ ] **Step 5: Turn overlap on at both DOM call sites**

Without this the whole mechanism is built and never switched on. Neither call site passes `overlap` today, so both take the default `false`.

In `apps/studio/src/App.jsx:8575`, add the prop to the `<Flatlay>` element:

```jsx
        <Flatlay
          pieces={pieces}
          max={8}
          overlap
          aspect="1 / 1"
          onOpenItem={onOpenItem}
          paletteFilter={paletteFilter}
        />
```

In `apps/studio/src/views/OutfitBuilder.jsx:113`:

```jsx
              <Flatlay
                pieces={resolvedItems}
                max={maxPieces}
                overlap
                padding={isHero ? '3rem 1.25rem 1rem' : '2.6rem 0.9rem 0.8rem'}
              />
```

This is safe before any migration because `overlap: true` with no accepted piece now produces geometry identical to `overlap: false` — the property asserted by `renders a look with no alpha identically whether overlap is on or off` in Task 1.

- [ ] **Step 6: Verify the build and suite**

Run: `pnpm --dir apps/studio build && pnpm --dir apps/studio test`

Expected: both PASS.

- [ ] **Step 7: Read the diff for undefined names**

Run: `git diff apps/studio/src/components/Flatlay.jsx apps/studio/src/App.jsx apps/studio/src/views/OutfitBuilder.jsx`

Confirm `hasAlphaCutout`, `PIECE_SHADOW` and `bleeding` are all defined where used. `bleeding` in particular must be declared inside the map callback, not outside it.

- [ ] **Step 8: Commit**

```bash
git add apps/studio/src/components/Flatlay.jsx apps/studio/src/App.jsx apps/studio/src/views/OutfitBuilder.jsx
git commit -m "feat(flatlay): cream ground, and a shadow that follows the garment

drop-shadow follows the alpha channel, so a cut-out with transparency
casts a shadow shaped like the garment rather than its box. That is the
only thing separating a white shirt from a cream coat once pieces
overlap - no cream in the palette manages it on contrast alone.

Inert until items carry alpha: nothing bleeds, so nothing gets a shadow.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: The canvas renderer

**Files:**
- Modify: `apps/studio/src/lib/canvas.js:259` onwards (`composeOutfitExportImage`)

Two of these three changes are bug fixes, not features. `composeFlatlay` returns placements in **slot order, not z order** — `Tops:z3` comes back before `Bottoms:z2`. The DOM sets `zIndex` and the browser sorts; the canvas draws in array order, so under overlap the share card would layer trousers over the shirt while the app layers the reverse. And the canvas ignores `placement.rotation` entirely. Both are invisible while nothing overlaps.

- [ ] **Step 1: Import the predicate**

In `apps/studio/src/lib/canvas.js`, replace line 10:

```js
import { itemImageDisplay } from './polish.js';
```

with:

```js
import { hasAlphaCutout, itemImageDisplay } from './polish.js';
```

- [ ] **Step 2: Add the shadow reference width**

In `apps/studio/src/lib/canvas.js`, directly above `export function composeOutfitExportImage` (or above the `const placements = …` line if the function is not exported at that point), add:

```js
// The CSS pixel width PIECE_SHADOW in Flatlay.jsx was tuned against — roughly a
// Lookbook card's stage. The canvas stage is measured in export pixels (1080
// wide overall), so the shadow's offset and blur are scaled by the ratio. Both
// surfaces then cast the same shadow relative to the garment, rather than the
// same number of pixels.
const REFERENCE_STAGE_PX = 400;
```

- [ ] **Step 3: Pass the predicate and sort by z**

Replace line 259:

```js
  const placements = composeFlatlay(pieces, { overlap: false, max: 6 });
```

with:

```js
  // Sorted by z, which the DOM gets for free from zIndex and the canvas does
  // not: composeFlatlay returns placements in SLOT order (Tops:z3 before
  // Bottoms:z2), and ctx.drawImage paints in call order. Unsorted, the share
  // card would layer the opposite way from the app the moment pieces overlap.
  const placements = composeFlatlay(pieces, { overlap: true, max: 6, bleed: hasAlphaCutout })
    .slice()
    .sort((a, b) => a.z - b.z);
```

`overlap` becomes `true` here for the same reason as the two DOM call sites: with no accepted piece it produces geometry identical to `false`, and without it the share card would be the one surface that never overlaps.

- [ ] **Step 4: Correct the stale panel comment**

Replace the comment above the panel fill:

```js
  // A white panel. Every stored cut-out is an opaque white JPEG, so floating
  // them onto the cream page would paint white boxes across it — the fault
  // fixed on the Lookbook card. Phase two recolours this one rectangle.
```

with:

```js
  // A white panel, and it stays white. Its original justification — that every
  // stored cut-out is an opaque white JPEG — is retired by alpha, but the panel
  // is also a design element: the page behind it is already #F7F5F2, so
  // recolouring it to cream would make it the same colour as the page and erase
  // it from the card. Nothing is lost by keeping it. A white garment has no
  // useful contrast against cream either (1.088:1), so the shadow is carrying
  // that separation on both surfaces regardless.
```

- [ ] **Step 5: Draw with rotation and a shadow**

Replace the whole `if (img) { … }` block inside `placements.forEach`:

```js
    if (img) {
      // Contain, not cover. Cover took a centred slice sized to fill the cell,
      // which cost a dress 57% of itself.
      const fit = fitContain(img.width, img.height, cellW, cellH);
      ctx.drawImage(img, cellX + fit.x, cellY + fit.y, fit.w, fit.h);
      return;
    }
```

with:

```js
    if (img) {
      // Contain, not cover. Cover took a centred slice sized to fill the cell,
      // which cost a dress 57% of itself.
      const fit = fitContain(img.width, img.height, cellW, cellH);
      const bleeding = hasAlphaCutout(placement.item);

      ctx.save();
      if (placement.rotation) {
        // Rotate about the cell's centre, as the DOM's transform does. Without
        // this the share card renders every piece upright while the app tilts
        // them.
        ctx.translate(cellX + cellW / 2, cellY + cellH / 2);
        ctx.rotate((placement.rotation * Math.PI) / 180);
        ctx.translate(-(cellX + cellW / 2), -(cellY + cellH / 2));
      }
      if (bleeding) {
        // Matches PIECE_SHADOW in Flatlay.jsx. Its 6px/14px are CSS pixels on a
        // stage about REFERENCE_STAGE_PX wide, so they are scaled by this stage's
        // actual width — otherwise a shadow tuned on a 400px card would be a
        // hairline on a 1080px export. Canvas shadow state is sticky and would
        // leak onto the next piece drawn, which is why it is cleared below.
        const k = stage.w / REFERENCE_STAGE_PX;
        ctx.shadowColor = 'rgba(28, 25, 23, 0.16)';
        ctx.shadowBlur = 14 * k;
        ctx.shadowOffsetY = 6 * k;
      }
      ctx.drawImage(img, cellX + fit.x, cellY + fit.y, fit.w, fit.h);
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.restore();
      return;
    }
```

- [ ] **Step 6: Verify the build and suite**

Run: `pnpm --dir apps/studio build && pnpm --dir apps/studio test`

Expected: both PASS.

- [ ] **Step 7: Read the diff for undefined names**

Run: `git diff apps/studio/src/lib/canvas.js`

Confirm `stage` is in scope where `k` is computed (it is declared as `const stage = layout.composition;` above the `forEach`), that `REFERENCE_STAGE_PX` is declared at module scope, and that `placement` is the callback's parameter name.

- [ ] **Step 8: Commit**

```bash
git add apps/studio/src/lib/canvas.js
git commit -m "fix(share): draw the flat-lay in z order, and apply the tilt

composeFlatlay returns placements in slot order - Tops:z3 arrives before
Bottoms:z2 - and ctx.drawImage paints in call order, so the share card
would layer trousers over the shirt while the app layers the reverse.
Rotation was ignored outright.

Both were invisible while nothing overlapped. Neither would have been,
from the first alpha item onward, on the one artefact that leaves the
product.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: The migration runner

**Files:**
- Modify: `apps/studio/src/views/ProfileView.jsx` (a runner beside `runRetrimWardrobe` at :425, and a button beside "Tighten cut-outs" at :833)

Follow the shape of `runRetrimWardrobe` exactly: same cancel ref, same `polishState` progress object, same `await new Promise((r) => setTimeout(r, 0))` yield so the UI paints between items.

- [ ] **Step 1: Add the runner**

In `apps/studio/src/views/ProfileView.jsx`, directly after the closing brace of `runRetrimWardrobe`, add:

```js
  // Re-cut every item to a cut-out that keeps its transparency, so its pieces
  // can overlap in a flat-lay. Deliberately NOT the re-trim runner: that one
  // skips any item it finds nothing safe to trim in, and a skipped item is never
  // re-uploaded, so it would convert an unmeasured subset - and it re-encodes an
  // already-lossy JPEG in place.
  //
  // Always writes to Storage as cutoutUrl and NEVER over images[0]. On the
  // polish path images[0] is the untouched original; on the add path it IS the
  // cut-out and is the only copy the account has. Writing to Storage either way
  // makes add-path items into polish-path items - one shape in the database
  // instead of two, the previous cut-out kept as a fallback, and undo is
  // deleting one field.
  //
  // The alpha flag IS the resume state. "Done" means "has alpha: true", so there
  // is no separate progress record that can drift out of step with what actually
  // happened. At ~9s an item this run needs a foregrounded tab for around half an
  // hour, and browsers throttle background tabs, so a closed laptop must cost the
  // remaining items rather than the whole run.
  const runAlphaMigration = async () => {
    if (!user) return;
    polishCancelRef.current = false;
    try { const net = await import("../lib/net.js"); net.clearAllHostBlocks(); } catch { /* non-blocking */ }

    const all = (polishItems || items) || [];
    const targets = all.filter((it) => !hasAlphaCutout(it) && !!(it.images || [])[0]);
    const already = all.filter((it) => hasAlphaCutout(it)).length;
    const noSource = all.length - targets.length - already;

    setPolishState({ done: 0, total: targets.length, failed: 0, alpha: true, already, noSource });
    let done = 0, failed = 0;
    const failedItems = [];
    for (const it of targets) {
      if (polishCancelRef.current) break;
      try {
        const res = await polishItemPrimary(it, user.uid, { alpha: true });
        if (res.ok) { await onUpdateItem({ ...it, imageMeta: res.imageMeta }); }
        else { failed += 1; failedItems.push(it); }
      } catch { failed += 1; failedItems.push(it); }
      done += 1;
      setPolishState({ done, total: targets.length, failed, alpha: true, already, noSource });
      await new Promise((r) => setTimeout(r, 0));
    }
    setPolishState({ summary: { done, total: targets.length, failed, cancelled: polishCancelRef.current, failedItems, alpha: true, already, noSource } });
  };
```

- [ ] **Step 2: Import the predicate**

Replace line 8 of `apps/studio/src/views/ProfileView.jsx`:

```js
import { itemImageDisplay, polishItemPrimary, retrimItemPrimary } from "../lib/polish.js";
```

with:

```js
import { hasAlphaCutout, itemImageDisplay, polishItemPrimary, retrimItemPrimary } from "../lib/polish.js";
```

- [ ] **Step 3: Add the button**

Find the button labelled `Tighten cut-outs` at `apps/studio/src/views/ProfileView.jsx:833`. Copy its enclosing element verbatim to sit directly after it, changing only the click handler to `runAlphaMigration` and the label to:

```jsx
                Re-cut for overlap
```

- [ ] **Step 4: Verify the build and suite**

Run: `pnpm --dir apps/studio build && pnpm --dir apps/studio test`

Expected: both PASS.

- [ ] **Step 5: Read the diff for undefined names**

Run: `git diff apps/studio/src/views/ProfileView.jsx`

Confirm `hasAlphaCutout`, `polishItems`, `items`, `onUpdateItem`, `polishCancelRef`, `setPolishState` and `user` are all in scope in the new function — they are all used by `runRetrimWardrobe` directly above it, so compare against that.

- [ ] **Step 6: Commit**

```bash
git add apps/studio/src/views/ProfileView.jsx
git commit -m "feat(profile): re-cut the wardrobe to cut-outs that keep their alpha

Writes to Storage as cutoutUrl and never over images[0], which on the add
path is the only copy of that cut-out the account has. Add-path items
become polish-path items as a side effect: one shape in the database
instead of two, and the previous cut-out survives as an undo.

The alpha flag is the resume state, so there is no progress record to
drift out of step with reality. A closed laptop costs the remaining
items, not the run.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Correct the handoff, then review visually

**Files:**
- Modify: `apps/studio/docs/superpowers/plans/2026-08-17-flatlay-composition.md`

- [ ] **Step 1: Correct the two false claims**

In `apps/studio/docs/superpowers/plans/2026-08-17-flatlay-composition.md`, replace the section headed `The `overlap` option is the whole phasing in one flag:` and its bullet list with:

```markdown
The `overlap` option was described here as "the whole phasing in one flag". It
is not, and has not been since the adaptive layout landed (#75): that rewrite
made the frame a partition, so `overlap: true` closes the gutters and tilts the
pieces but **cannot make two of them intersect** — measured worst pairwise
overlap, 0.0%. Overlapping is now decided per piece by a `bleed` predicate.
See `specs/2026-09-03-flatlay-phase-two-design.md`.
```

Then replace the sentence beginning `The originals are retained (`imageMeta[i].original` on the add path` with:

```markdown
The originals are retained **on the polish path only** — `images[0]`, untouched.
`imageMeta[i].original` is an in-memory undo snapshot for the edit session and is
stripped before every save (`App.jsx:3067`), so an add-path item's `images[0]`
IS its cut-out and there is no original behind it. Those items migrate from the
flattened cut-out itself, which the segmentation model handles well but which
makes the run **not lossless for them** — contrary to what this document and the
#78 notes both said.
```

- [ ] **Step 2: Commit**

```bash
git add apps/studio/docs/superpowers/plans/2026-08-17-flatlay-composition.md
git commit -m "docs(flatlay): correct the handoff's two load-bearing claims

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 3: Deploy the branch for review**

Nothing so far changes a pixel: no stored item has `alpha: true`, so no piece bleeds and every surface renders as it does today. The visual review therefore has to run the migration first.

Build and deploy the branch, then in Profile press **Re-cut for overlap** and leave the tab foregrounded. Expect roughly 9 seconds an item after the first (which pays a one-off ~5MB model load), so about half an hour for 150 items.

**Build with the env file** — `apps/studio/.env.local` must be present or the deployed app has no Firebase config and breaks on load. Confirm `projectId` appears in the bundle before deploying.

- [ ] **Step 4: Review, then tune**

Check, in this order, and report back before changing anything:

1. **A pale garment overlapping another pale garment.** This is the case the whole shadow design exists for. If a white shirt still merges into a cream coat, raise the opacity in `PIECE_SHADOW` (`Flatlay.jsx`) and the matching `shadowColor` in `canvas.js` together — they must stay in step.
2. **Is anything cropped?** Nothing should be. If it is, the frame clamp in `bleedCell` is wrong, not `BLEED`.
3. **Is the overlap the right amount?** `BLEED` is one constant in `flatlay.js`. 1.06 gives a 14.2% worst pair, 1.08 gives 18.5%, 1.10 gives 22.7%, 1.20 gives 51.3%.
4. **Does the share card match the app?** Same layering, same tilt. If it does not, the z-sort or the rotation in Task 6 is wrong.
5. **Any item the runner reported as failed.** Those keep their old cut-out and simply do not bleed.

---

## Notes for whoever executes this

- **Tasks 1–7 are safe to merge before the migration is run.** Nothing has alpha, so nothing bleeds. If review goes badly, the fix is tuning two constants, not a revert.
- **The user does the visual review.** Coverage numbers and overlap fractions do not establish that a composition looks right; four rounds of this work have turned on things no measurement caught.
- **Do not merge or deploy without being asked.** Open the PR and stop.
