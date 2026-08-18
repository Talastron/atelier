# Flat-lay renderer — phase one

**Date:** 2026-08-18
**Branch:** `feat/flatlay-renderer`
**Follows:** `plans/2026-08-17-flatlay-composition.md` (the handoff that specified the engine)

## What this covers

The engine — `src/lib/flatlay.js`, merged in #70 — turns the pieces of a look into
placements. Nothing renders those placements, so nothing imports it and it is
tree-shaken out of the bundle entirely. This spec covers the renderer that makes
it real on two surfaces, and the measurement that decides whether phase two
happens at all.

In scope:

1. A measurement harness that answers the two questions gating phase two.
2. A shared `<Flatlay>` component.
3. The Lookbook card, composed rather than gridded.
4. The look detail's Flat-lay view, composed, with credits below.

Out of scope, and each blocked on the harness's verdict: the canvas renderer for
the share image, the alpha encoding change, the batch reprocessing of existing
items, and the `overlap: true` flip.

## Correction to the handoff's premise

The handoff says cut-outs are flattened onto white and re-encoded as JPEG because
"alpha meant PNG and PNG was 3–5× the size", against Firestore's 1MiB document
budget. That is true of one of the two cut-out paths, not both.

- **Add-item flow** (`App.jsx`, the paste handler, `addImageFiles`, and the
  per-thumb "Cut out" button) writes the cut-out data URL inline into
  `formData.images[i]`, and stores `imageMeta[i].original` — a second data URL —
  beside it. That document carries two copies of every photo, up to six photos.
  This is the path the 220,000-character cap in `removeImageBackground` exists
  for, and the only one where the size argument genuinely bites.
- **Polish flow** (`polishItemPrimary` in `polish.js`) uploads the cut-out to
  Firebase Storage and stores only its download URL. There is no 1MiB ceiling
  here. Size matters for bandwidth and storage cost, not for a hard limit.

The practical consequence: if the harness finds WebP-alpha expensive, phase two
is not necessarily dead — it could still proceed for Storage-backed cut-outs
while the inline path keeps flattening. The harness should therefore report
absolute byte counts, not just a ratio.

A second correction, cosmetic: the comment above the fill in `canvas.js` calls
`#FFFFFF` "a clean lookbook-flatlay background" and then, three lines later,
describes it as "the cream surface" that "blends with the app's wardrobe cards
(also cream)". The fill is white and the cards are white. Fix the comment while
we are in the file.

## 1. The measurement harness

**Files:** `apps/studio/tools/alpha-check.html`, `apps/studio/tools/alpha-check.js`

Dev-only by construction. Vite builds `index.html` and nothing else unless
`rollupOptions.input` says otherwise, so a second HTML file under the project
root is served by `pnpm dev` and never enters a production build. No route, no
import from `src/`, no bundle impact.

**Input.** A file picker taking many images at once. Real garment photographs,
around a dozen, chosen to span the hard cases: a pale garment against a pale
background, something with a fine edge (lace, fringe, a chain), something dark,
something with a hole through it (a handle, a strap).

**Per image, the harness:**

1. Runs `compressImageToDataUrl` so the input matches what the app would store.
2. Runs `@imgly/background-removal`'s `removeBackground` once. Exactly once —
   it is the slow step and every encoding below is measured from the same
   cut-out, so the comparison is like-for-like.
3. Encodes that one cut-out five ways and records the byte length of each:

   | Encoding | Why it is in the table |
   |---|---|
   | JPEG-on-white, adaptive quality | Today's baseline — the exact output of `removeImageBackground` |
   | WebP-on-white, q 0.8 | Control. Isolates WebP's codec gain from the cost of carrying alpha |
   | WebP-alpha, q 0.9 | The candidate, at quality that flatters |
   | WebP-alpha, q 0.8 | The candidate, at the quality we would probably ship |
   | WebP-alpha, q 0.7 | The candidate, pushed |
   | PNG-alpha | The option rejected in the original decision. Confirms the 3–5× claim still holds |

4. Renders the alpha cut-out at flat-lay scale **on the app's cream**
   (`#F4F0E8`), beside the same cut-out on white. This is the edge-quality
   check: on a white plate a ragged edge is invisible, floating on cream it is
   not.

**WebP support detection.** `canvas.toDataURL` does not throw on an unsupported
MIME type — per spec it falls back to `image/png` silently. A naïve
`toDataURL('image/webp')` on a browser without WebP encoding therefore returns a
PNG, which is precisely the 3–5× blow-up the original decision avoided, and it
would do so invisibly. The harness detects support by encoding a 1×1 canvas and
asserting the result starts with `data:image/webp`, and refuses to report numbers
if it does not. The same guard is required in any production encoder that
follows.

**Output.** A table, plus one headline figure: WebP-alpha at q 0.8 divided by
JPEG-on-white, averaged across the sample, with the per-image spread shown so a
single pathological garment cannot hide behind a mean. Absolute byte counts are
reported alongside, for the reason given above.

**Verdict, recorded back into the handoff document.** Near 1× and phase two is
affordable. Near 3× and it is off for the inline path, and a judgement call for
the Storage path. Independently: if the cream renders show ragged edges on real
garments, phase two is off regardless of what the numbers say.

## 2. The white ground

`ItemTileImage` paints `#FFFFFF` behind every cut-out, because every stored
cut-out is an opaque white JPEG. Composing onto the current cream backdrop with
no plates would therefore show a set of white rectangles on cream —
non-overlapping, but plainly rectangles, and no more like a flat-lay than the
grid it replaced.

So phase one composes onto a **white ground with no per-piece plates**. An
opaque white-backed cut-out on white is indistinguishable from a transparent
one. The garments appear to float, which is the entire effect, and it needs no
image migration at all.

Phase two then changes one thing: the ground goes cream, and the transparency
starts earning its keep. That is the whole reason the ground is a named constant
rather than a literal.

## 3. Degradation, built at the start

Not every piece has a cut-out. A raw photograph carries its own background and
cannot float on anything. So each piece gets one of two treatments:

- **cut-out or framed** — bare `<img>` with `object-contain`, no background.
  Floats on the ground.
- **raw photograph only** — a small rounded white plate behind it, as the grid
  does today. It reads as a photograph rather than a garment, which is honest.

`itemImageDisplay` already computes exactly this distinction as its
`forceContain` flag, so the branch costs nothing. Building it now rather than
retrofitting it means a part-migrated wardrobe never renders wrongly — which is
item 4 of the handoff's remaining work, satisfied one release early.

**Pure helper.** The decision is extracted as `flatlayTreatment(item)` returning
`'bare'` or `'plate'`, exported from `src/lib/flatlay.js` beside the geometry.
It is the one piece of this work with branching logic worth testing directly.

## 4. `<Flatlay>`

**File:** `src/components/Flatlay.jsx`. Presentational; no data fetching, no
state beyond what React needs for hover.

| Prop | Default | Meaning |
|---|---|---|
| `pieces` | `[]` | Resolved wardrobe items, any order |
| `max` | `8` | Cap on pieces placed; silhouette wins |
| `overlap` | `false` | Passed through to the engine. The phase-two flip |
| `aspect` | none | CSS aspect ratio. When omitted the component fills its container instead — see below |
| `onOpenItem` | — | When given, each piece becomes a button |
| `paletteFilter` | `null` | When given, non-matching pieces dim to 30% |
| `ground` | white | The surface colour. Cream in phase two |

It calls `composeFlatlay(pieces, { overlap, max })` and renders each placement as
an absolutely-positioned box:

```
left:   x * 100 %
top:    y * 100 %
width:  w * 100 %
height: h * 100 %
zIndex: z
transform: rotate(rotation deg)     // 0 while overlap is false
```

Every dimension is a percentage of the container, so one component serves a
180px card and a 900px spread with no second code path and no media queries.
That is the same property that lets the engine drive a canvas export later at
arbitrary pixel dimensions.

**Two sizing modes, because the two surfaces size differently.** The look detail
places the composition in normal flow and needs it to declare its own height, so
it passes `aspect`. The Lookbook card's image area is a `flex-1` region whose
height is whatever the card's aspect ratio leaves after the caption strip — it
cannot declare an aspect without fighting the card. So when `aspect` is omitted
the component renders `absolute inset-0` and fills whatever box it is given.
One prop, two behaviours, no second component.

Empty `pieces` renders the existing `Shirt` placeholder, matching both surfaces
today.

## 5. Lookbook card

**File:** `src/views/OutfitBuilder.jsx`, `LookbookSortableCard`.

The `gridPieces` slice and the `grid-cols-2 / grid-cols-3` block become a single
`<Flatlay>` mounted in the existing `flex-1` image area with no `aspect` prop,
so it fills that region as the grid does today.

Counts: **6 on a secondary card**, up from the 4 it shows now — more of the look,
still legible at 180px, with the engine's own priority dropping finishing pieces
first. **8 on a hero card**, up from 6, since the hero is physically larger on
both mobile and desktop. If 8 proves cluttered when we look at it, the hero
drops to 6 and both cards share one number.

`SLOT_PRIORITY` in this file becomes a duplicate of the engine's ordering, so it
is deleted and the engine owns the question of what a look "is".

Untouched: worn-photo covers (they bypass the grid entirely and still should),
the N° chrome, the piece count, the favourite chip, the drag handle, the caption
strip, and the hero card's larger proportions.

## 6. Look detail

**File:** `src/App.jsx`, `OutfitFlatLay` and its call site.

The magazine spread — hero cell, N° badges, per-cell brand and name captions,
accessories strip — is replaced by `<Flatlay max={8} onOpenItem paletteFilter>`,
followed by a numbered credits list beneath the composition:

```
N°01 · BRAND · Item name
```

Each row is a button that opens the item, and each row dims under the palette
filter exactly as the cells do today. Nothing available today is lost: the
credits move from captions-under-cells to a list, which is what `OutfitFlatLay`'s
own header comment says was intended in the first place ("Names render below in a
clean list to keep the canvas itself uncluttered").

The Grid toggle is untouched. Anyone who prefers the catalogue view still has it,
which also gives us a fallback if the composition disappoints on a real wardrobe.

## 7. Testing

The repository has vitest but neither jsdom nor testing-library. The established
convention is unit tests over pure functions in `src/lib/`, with rendering
verified by running the app. This work follows it rather than introducing a
component-testing stack for one feature.

- `flatlayTreatment` gets unit tests in the existing `flatlay.test.js`: cut-out,
  framed, `cutout: true` with no URL, raw photo, no images at all, malformed
  item.
- The 12 existing geometry tests continue to cover the placements.
- The components are verified by running the app against a real wardrobe.
- The harness is verified by its own output — if its WebP detection or its
  encoders were broken, the table would show it.

## 8. Risks

**The composition may be worse than the grid at card size.** Eight garments
anatomically arranged in a 200px box could read as clutter where four plates read
as order. This cannot be settled from a spec; it needs eyes on a real wardrobe.
Hence the branch, and hence keeping the Grid toggle.

**The white ground constrains the card's design.** The Lookbook card currently
sits on `bg-stone-100/70`. A white composition box inside it will read as a
plate of its own unless the card's own background changes. Resolve this while
implementing rather than by guessing now.

**The harness depends on a 5MB model download** and takes a few seconds per
image. That is acceptable for a dozen images run once, but it means the harness
is not something to run casually.

## 9. Order of work

1. Harness, then run it and record the verdict in the handoff document.
2. `flatlayTreatment` plus its tests.
3. `<Flatlay>`.
4. Lookbook card.
5. Look detail.

Steps 2–5 do not depend on the harness's verdict — they ship with
`overlap: false` whatever it says. The harness goes first because it is cheap
and because a negative result changes what we build afterwards.
