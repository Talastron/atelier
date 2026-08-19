# Flat-lay composition — handoff

**Status at 2026-08-18:** phase one built and open as a PR — the engine now
renders on the Lookbook card and the look detail. The two questions gating phase
two have both been answered, and both answers are favourable. See the measured
verdict below and `plans/2026-08-18-flatlay-phase-one.md`.

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

**Measured, 2026-08-18. Verdict: alpha is affordable. Phase two is on.**

32 real garments through `tools/alpha-check.html`, deliberately awkward — pale
on pale, fine chain, dark wool, strapped bags, and some already-`.avif`/`.webp`
sources. Totals across the sample, against today's JPEG-on-white:

| Encoding | Total | vs today |
|---|---|---|
| JPEG-on-white (today) | 1095K | baseline |
| **WebP-on-white** | **618K** | **0.56×** |
| WebP + alpha, q90 | 2152K | 1.97× |
| **WebP + alpha, q80** | **1794K** | **1.64×** |
| WebP + alpha, q70 | 1650K | 1.51× |
| PNG + alpha | 11166K | 10.20× |

The original decision was right about PNG and wrong to generalise from it. PNG
with alpha really is catastrophic — 10× here, worse than the 3–5× remembered.
WebP with alpha is 1.64×, an entirely different proposition.

**Read the aggregate, not the mean.** The harness's headline figure is 1.88×,
the mean of per-image ratios. The table above is the ratio of the sums, which is
what storage actually costs. The gap is small-file skew: the worst ratios are all
small pale garments (a white dress 11K→51K = 4.6×, pale shorts 14K→60K = 4.3×)
where JPEG squeezes a mostly-white frame to almost nothing, so encoding a real
alpha mask multiplies a tiny baseline. The absolute cost stays around +40K.

**The inline path fits.** Its cap is a 220,000-character data URL ≈ 161KB of
bytes. At q80 the largest of the 32 was 147K; at q70, 130K. **Nothing exceeded
the budget at either quality.** The Storage-backed polish path has no such limit.

**Free win, independent of phase two.** WebP-on-white is **0.56×** — switching
the existing flatten-onto-white encode from JPEG to WebP would nearly halve
image storage with no visual change and no alpha involved. Worth doing whether or
not phase two proceeds. Requires the same encoder feature-detect: `toDataURL`
falls back to PNG silently on an unsupported type, so an undetected miss would
turn a 0.56× win into a 10× loss.

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
5. ~~**Cut-out quality check.**~~ **Done 2026-08-18. Edges pass; contrast is the
   real risk.** All 32 rendered on cream beside white. The feared failure —
   ragged edges that a white plate hides — did not appear; `@imgly` cuts cleanly
   on real garment photography, including a fine chain and a strapped bag.

   The problem is a different one. **Pale garments lose themselves on cream.** A
   white collar, a cream linen short and a white dress read as faint shapes
   against `#F4F0E8` when they were crisp against white. Phase two's ground
   colour therefore is not a free choice: either it stays near-white and the
   overlap alone carries the effect, or a pale garment needs something to sit
   against — a soft shadow under each piece would do it, and would suit the
   flat-lay idiom anyway. Decide this before migrating any images, because it
   changes nothing about the encoding and everything about whether it looks good.

## Reference

Visual comparison of the three states (today / phase one / phase two):
https://claude.ai/code/artifact/a331dafd-7164-4288-ac00-df1ae558ed9c

Note the mockup uses drawn silhouettes, not real photographs. It shows the
arrangement, not the rendering quality.
