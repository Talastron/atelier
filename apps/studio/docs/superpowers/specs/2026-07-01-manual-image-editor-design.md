# Manual Image Editor — Design Spec

**Date:** 2026-07-01
**Status:** Approved design, pre-planning
**Scope:** Phase 1 of 3 (Framing). Phases 2 (colour) and 3 (mask brush) are sketched at the end but are separate spec → plan → ship cycles.

---

## Goal

Give the user a manual image editor to fine-tune wardrobe item photos, launched from an
"Edit image" button in the item detail view. Phase 1 delivers **framing** — crop / zoom /
pan onto the grid's 3:4 aspect ratio — so items sit consistently on their cards. It is
non-destructive: the original photo is never altered.

## Why phased

The three requested tools differ enormously in build cost and payoff:

| Tool | Effort | Payoff |
| --- | --- | --- |
| Framing (crop/zoom/pan) | Low | High — fixes whole-grid consistency, every item benefits |
| Colour / saturation | Low–Med | Medium — polish; auto-enhance already does a subtle version |
| Mask brush | High | High but narrow — only when auto-cutout gets it wrong |

Building all three at once holds the two cheap wins hostage to the expensive one. We ship one
editor **shell** and add tools into it phase by phase. Phase 1 proves the shell + save
pipeline while delivering the biggest consistency win.

---

## Architecture

### Components & files

- **`src/components/ImageFramer.jsx`** (new) — fullscreen editing surface. Interaction shell
  only: renders the base image behind a fixed 3:4 crop frame, handles drag-to-pan and the
  zoom slider, and calls back with the chosen frame params on save. Thin and reusable for
  Phases 2–3.
- **`src/lib/framing.js`** (new) — pure, unit-tested geometry. No DOM, no Firebase, so it
  stays fast to test.
- **`src/lib/polish.js`** (modify) — extend `itemImageDisplay` for `framedUrl` priority; add
  a `frameItemPrimary` save orchestrator (canvas bake + Storage upload + imageMeta
  write) alongside the existing `polishItemPrimary`. Add `revertFramePrimary`.
- **`src/App.jsx`** (modify) — add the "Edit image" button in `ItemDetailView` next to the
  existing "Cut-out · revert" control; mount `ImageFramer` and wire its save through the
  existing `onUpdateItem` path.
- **`storage.rules`** (modify) — add a `framed/{uid}/{file}` match mirroring the existing
  `polish/{uid}/{file}` rule (owner-write, public-read).

### Non-destructive storage model (hybrid: bake for display + params for re-edit)

Each item already carries parallel `images[]` and `imageMeta[]` arrays, where `imageMeta[i]`
holds `{ cutoutUrl, cutout, angle, original }`. We extend `imageMeta[i]` with:

- **`framedUrl`** — Storage URL of the baked, cropped image (the display artefact).
- **`frame`** — `{ zoom, offsetX, offsetY }`, the crop state, so re-opening the editor
  restores the exact crop instead of starting over.

Rules:

- **The original in `images[i]` is never modified.** Revert = delete `framedUrl` + `frame`.
- **Editing base = `cutoutUrl ?? images[i]`** — never a previously-baked `framedUrl`. This
  prevents crops from compounding or recompressing across edits; `framedUrl` is always
  derived fresh from the base + params.
- **Framing composes with cut-outs.** If an item is polished, the editor frames the clean
  white-card `cutoutUrl`.

### Display priority

`itemImageDisplay(item, i)` becomes the single source of truth, resolving:

```
framedUrl ?? cutoutUrl ?? images[i]
```

`forceContain` stays true when a cut-out or framed image is shown (they sit whole on a white
card). Because every render surface (wardrobe grid, item detail, and all canvas exports —
Style DNA, outfit collage, Pinterest) reads through `itemImageDisplay`, framing needs **zero
extra render wiring**: baking into a URL means each surface just picks the URL. This is why we
bake rather than store params-only (which would force the crop transform to be replicated into
every canvas export, risking framing that looks right in the grid but wrong in a shared card).

### External images (CORS)

Cropping draws to a canvas and exports it, which **taints** on cross-origin retailer URLs
(e.g. `cdn.endource.com`). Before loading an external base, the editor rehosts it via
`imageUrlToCompressedDataUrl` → the deployed `imageProxy` Cloud Function, reusing the exact
plumbing that made batch polish reliable.

---

## Interaction model

- **Fixed 3:4 frame; the image moves behind it.** The crop window is locked to the grid's
  aspect ratio, so an off-ratio result is impossible. The user **drags to pan** and uses a
  **zoom slider (1×–3×)** to fill the frame. Rule-of-thirds gridlines show while adjusting.
- **Clamping:** the image cannot be panned or zoomed to expose empty gaps inside the frame;
  every save is a full bleed.
- **Zoom capped at 3×** because sources are compressed to ~800px wide; beyond that the crop
  degrades. The cap keeps quality honest.
- **Controls:** Cancel (discard), Save (bake + upload), Reset (return to whole-image fit,
  zoom 1×).
- **Re-open** restores the last crop from stored `frame` params — refine, don't restart.
- **Input:** drag = one-finger pan (touch) / mouse drag; zoom = slider. Pinch-to-zoom is
  explicitly out of scope for Phase 1 and can be added later.

---

## Data flow (save pipeline)

1. **Open:** load base `cutoutUrl ?? images[i]` (external → rehost first) + saved `frame`
   params to restore state.
2. **Adjust:** component tracks `{ zoom, offsetX, offsetY }` live.
3. **Save:** `computeCropRect({ naturalW, naturalH, frameAspect, zoom, offsetX, offsetY })`
   returns the clamped source rect `{ sx, sy, sw, sh }`. Draw that rect to a 3:4 output canvas,
   compress with the existing adaptive-JPEG logic, upload to Storage
   `framed/{uid}/{safeId(itemId)}-{i}.jpg`, then write `imageMeta[i].framedUrl` +
   `imageMeta[i].frame` and call `onUpdateItem`.
4. **Revert:** delete `framedUrl` + `frame` from `imageMeta[i]`; original returns.

**Output size:** 3:4 portrait, height ~900px (e.g. 675×900) to match the card and stay within
the adaptive-JPEG budget used for cut-outs (~180–220KB).

**Budget:** `framedUrl` is a short Storage URL; `frame` is three numbers. Negligible Firestore
weight; the original never leaves `images[i]`.

---

## Error handling

- **Rehost failure** (external image can't be fetched even via the proxy): show a
  non-blocking message ("Couldn't load this image for editing") and close the editor without
  changing the item. Same silent-fallback philosophy as background removal.
- **Upload failure:** keep the editor open, surface a retry-able error, do not mutate
  `imageMeta`.
- **Canvas/export failure:** abort the save, leave the item untouched.

No path may leave the item in a half-edited state — either the full `{ framedUrl, frame }`
pair is written or nothing changes.

---

## Testing (TDD, existing Vitest setup)

Pure logic in `src/lib/framing.js` and `polish.js`:

- **`computeCropRect(...)`** — geometry core:
  - zoom 1× fits the whole image centred to frame aspect
  - zoom 2× halves the crop dimensions
  - offsets clamp so the crop never runs past image edges
  - wide source and tall source both resolve to a valid 3:4 crop
- **`defaultFrame(naturalW, naturalH, frameAspect)`** — initial fit params.
- **`itemImageDisplay`** — extend with `framedUrl`-priority cases:
  - `framedUrl` wins over `cutoutUrl` and original
  - `cutoutUrl` still wins over original when no `framedUrl`
  - `forceContain` true when framed

The canvas-bake + Storage-upload orchestrator stays an integration seam (thin, verified live),
exactly as `polishItemPrimary` is today. Tested logic lives in the pure geometry.

---

## Out of scope (Phase 1)

- Colour / saturation adjustment (Phase 2).
- Background mask brush (Phase 3).
- Pinch-to-zoom.
- Editing images other than by framing (rotate, straighten, filters).
- Batch framing across the wardrobe.

---

## Later phases (sketch only — not part of this plan)

- **Phase 2 — Colour.** Brightness / contrast / saturation / warmth sliders with live
  preview, reusing the `autoEnhanceCanvas` pixel loop. Stored the same way (bake to
  `framedUrl`/a sibling field + params), built into the same `ImageFramer` shell as a second
  tool tab.
- **Phase 3 — Mask brush.** Paint-to-erase / restore background over an existing cut-out, with
  brush size and undo/redo. Built last, on the proven shell, on top of a cut-out.
