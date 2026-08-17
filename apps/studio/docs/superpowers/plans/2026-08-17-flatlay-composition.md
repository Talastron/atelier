# Flat-lay composition — handoff

**Status at 2026-08-17:** layout engine built and tested. No renderer. Nothing calls it.
**Branch:** `feat/flatlay-engine` (safe to merge — tree-shaken out of the bundle, zero live impact).

## The problem

A Lookbook card shows a look as a 2×2 grid of equal white plates. It reads as an
inventory rather than an outfit, and on a twelve-piece look it can only show four
of them. The look detail has a "Flat-lay" toggle, but it renders a column of
individually-framed white cards — a catalogue page, not a flat-lay.

Decisions taken (2026-08-17, with Sibylle):

- **Anatomical layout** — pieces sit roughly where they are worn.
- **Slight overlap and rotation** — within ±3°, enough to break the grid feel.
- **Everywhere a look appears** — Lookbook card, look detail, share image.
- **Silhouette large, finishing small** — jewellery and sunglasses do not compete
  with the garments.
- **Virtual try-on rejected.** Expensive per image, inconsistent on real bodies,
  and storing photographs of subscribers' bodies is a materially heavier privacy
  posture than storing photographs of their clothes.

## What exists

`src/lib/flatlay.js` — pure geometry, no DOM, no canvas, no images. Takes the
pieces of a look, returns `{ item, x, y, w, h, rotation, z }` per piece in
normalised 0–1 coordinates. 12 tests in `flatlay.test.js`.

The `overlap` option is the whole phasing in one flag:

- `false` — pieces separate and upright. Correct for the images stored today.
- `true` — pieces tilt and overlap. **Requires transparency.**

## The blocker for phase two

`canvas.js` → `removeImageBackground` produces a transparent PNG from
`@imgly/background-removal` and then **composites it onto white and re-encodes as
JPEG**, because alpha meant PNG and PNG was 3–5× the size. So the stored
"cut-outs" are opaque. Overlapping them means a white rectangle covering the
garment beneath — worse than the grid being replaced.

**The proposed fix:** encode WebP with alpha instead. WebP holds transparency at
roughly JPEG size, which is what makes phase two affordable. That option did not
exist in the same way when the flatten-onto-white decision was made.

**Unvalidated assumption — measure this before building anything.** If WebP with
alpha lands 3× larger on real garment photos, the storage reason returns and
phase two is off. Sample a dozen real items and compare encoded sizes.

## Remaining work

1. **DOM renderer.** Placements → positioned elements (percentages) in the
   Lookbook card and look detail. Works today with `overlap: false`.
2. **Canvas renderer.** Same placements × pixel dimensions, for the share image.
   See `composeOutfitExportImage` in `canvas.js`.
3. **Alpha encoding.** Change `removeImageBackground` to keep alpha and encode
   WebP; add a flag on `imageMeta[i]` (e.g. `alpha: true`) so old and new coexist;
   reprocess existing items with the batch re-trim runner already in Profile
   (`retrimItemPrimary` in `polish.js`).
4. **Graceful degradation.** Overlap only where alpha exists, so a part-migrated
   wardrobe never shows white boxes over garments.
5. **Cut-out quality check.** On a white plate a ragged edge is invisible;
   floating on cream it is not. This needs human eyes on real garments — it is
   the most likely reason to abandon phase two, and it is cheap to check first.

## Reference

Visual comparison of the three states (today / phase one / phase two):
https://claude.ai/code/artifact/a331dafd-7164-4288-ac00-df1ae558ed9c

Note the mockup uses drawn silhouettes, not real photographs. It shows the
arrangement, not the rendering quality.
