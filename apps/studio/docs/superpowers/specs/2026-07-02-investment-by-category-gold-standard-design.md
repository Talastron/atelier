# Investment by category — gold-standard editorial polish

**Date:** 2026-07-02
**Surface:** Insights → Signature → "Investment by category"
**Component:** `CategoryTreemap` in `src/views/InsightsView.jsx`
**Scope:** Visual craft only. No data changes, no new metrics, same squarify
treemap and click-to-wardrobe behaviour.

## North star

Make the section read like one curated magazine spread — a set of matted
plates — instead of a grid of mismatched item photos. Chosen direction:
**editorial polish** via a **unified tonal grade**, with tiny categories
**capped-and-folded** so no panel is ever an unreadable sliver.

## The four moves

### 1. Unified tonal grade (every tile, not just the hero)
Apply one consistent treatment to every tile image so clashing backgrounds
(white cyclorama tee, grey-studio jacket, skin-toned jewellery) land in the
same tonal family:
- A gentle warm-desaturation CSS `filter` on every `<img>`
  (~`sepia(.10) saturate(.94) contrast(1.03) brightness(.98)`), tuned so it
  reads as a grade, not an Instagram filter.
- A consistent **warm tonal ground** behind each image (stone gradient) so any
  letterboxing / cut-out margin is warm, never stark white.
- A consistent inner **vignette** (radial inset shadow) on all tiles so photos
  are framed, not floating.
- The **brass-thread inset frame** (currently hero-only) becomes a quiet
  hairline on every tile and stays gilded on the hero. This is the single move
  that turns a photo grid into a set of matted plates.

### 2. Better representative image — prefer the polished cut-out
The hero smear (skin + bangle edges) happens because the rep-picker grabs any
photo. Bias the representative pick to **prefer an item with a clean cut-out /
framed image** (`itemImageDisplay(i, 0).forceContain === true`), falling back to
most-worn then priciest as today. When the rep is a cut-out/framed image, render
it **`object-contain`** (whole subject) on the warm ground; lifestyle photos
stay **`object-cover`**. Both share frame + vignette + scrim, so the mix of
still-life and lifestyle reads as editorial, not inconsistent.

### 3. Cap-and-fold — no slivers
Show the top **6** categories as full plates. Fold the remainder into one
closing tile: `+ N more · £X`, rendered as a restrained brass-on-ink type-tile
(no clashing photo), clickable to open the full wardrobe. Squarify runs on ≤7
entries, so every panel is legibly sized and the clipped-sliver problem
disappears.

### 4. Type & legibility polish
- Tune the bottom scrim so white type always clears the graded photo /
  light cut-out ground.
- Keep the museum-label rhythm on the hero (brand → category → £ → count).
- Staggered fade-in-up on mount, gated on `prefers-reduced-motion` — the one
  motion touch, so the spread "develops" like a print.

## Explicitly out of scope
No new metrics, no duotone, no layout-engine change, no data changes,
no change to the surrounding card, eyebrow, or "tap a tile" affordance.

## Acceptance
- No unreadable sliver tiles at any container width ≥ 320px.
- Hero tile shows a clean subject whenever the category owns any cut-out/framed
  item.
- Every tile carries the same grade, ground, vignette, and frame; hero frame is
  visibly gilded.
- White labels legible on every tile.
- Motion respects `prefers-reduced-motion`.
- No behavioural change: tapping a plate still opens that category in the
  wardrobe; the "more" tile opens the full wardrobe.
