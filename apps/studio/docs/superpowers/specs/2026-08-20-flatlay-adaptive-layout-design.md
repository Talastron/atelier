# Flat-lay adaptive layout

**Date:** 2026-08-20
**Branch:** `feat/flatlay-adaptive-layout`
**Follows:** `specs/2026-08-18-flatlay-renderer-design.md` (phase one, shipped in #73/#74)
**Precedes:** phase two, overlap — deliberately a separate project, see "Why not overlap first"

## The problem

The compositions read small. Not because the images are loose — they are not — and
not because the frame is badly proportioned. Because **zones are fixed addresses,
not a packing**.

`Outerwear` owns the left third of every frame whether or not the look has a
coat. A dress look has no outerwear, no top and no trousers, so three of the
eight zones are reserved for garments that do not exist and stay blank. The
remaining pieces sit wherever their own zone happens to be, and the card looks
half empty.

## What was measured first

Two hypotheses were tested and killed before designing anything, which is the
only reason the design targets what it does.

**Loose cut-outs — false.** Sampled stored cut-outs fill 82–100% of their own
image. "Tighten cut-outs" in Profile would gain about 1%, not the 1.5× hoped for.

**Dead margin at the frame's edge — false.** A bounding-box "scale to fill" pass
gains 4% on typical looks. Accessories bottom-left and bag bottom-right anchor
the corners even when the middle is hollow, so the arrangement already spans the
frame. The emptiness is interior.

**Ink, not boxes, is the metric.** Box coverage flatters badly: a three-piece
look measures 98% covered under one candidate design but only 46% ink, because
`object-contain` fits a landscape shoe into a tall box and leaves half of it air.
Every figure in this spec is ink — the share of the frame that ends up as actual
garment — computed with a table of typical width/height per category taken from
the real wardrobe photography.

**Current engine, measured:**

| Look | Ink |
|---|---|
| separates, 7 pieces | 46% |
| a dress look, 5 | 27% |
| dress and shoes, 3 | 21% |
| no coat, 5 | 30% |
| minimal, 3 | 23% |
| layered jewellery, 7 | 40% |
| **average** | **31%** |

## The design

### 1. A weighted tree replaces the zone table

`ZONES` — eight hard-coded rectangles — becomes a small tree of columns and
rows. Nothing in it is a position; positions are computed.

```
left   (36)   Outerwear 46 · Accessories 18 · Jewellery 18
centre (40)   Dresses 84 · Tops 38 · Bottoms 46
right  (36)   Shoes 40 · Bags 60 · uncategorised 30
```

Caps: `Accessories`, `Jewellery` and `uncategorised` are capped at **0.20** of the
frame per axis. Nothing else is capped. Gutter between siblings: **0.012**, the
same value the old `inset` used, so the composition's breathing room is unchanged.

Weights are relative within their parent only, which is why they need not sum to
anything in particular — `Dresses 84` and `Tops 38` never compete unless a look
somehow contains both, in which case they simply share the column.

### 2. The algorithm

1. Order and cap the pieces — `orderForFlatlay`, unchanged.
2. Count pieces per category.
3. **Prune.** Drop rows whose slot has no pieces; drop columns left with no rows.
4. **Renormalise.** Surviving column weights divide the frame width; within each
   column, surviving row weights divide its height. Gutters between siblings.
5. **Cap.** A capped slot shrinks to its ceiling, centred in its allocation.
6. **Tile.** Multiples within a slot tile it, orientation-aware, as they do today.

Non-overlap and frame-containment stop being properties we test for and become
properties the structure cannot violate: columns and rows partition the frame.

### 3. Caps, and why they cost ink deliberately

Accessories, jewellery and uncategorised pieces stop at a fifth of the frame per
axis. The slack stays empty rather than being absorbed by a neighbour.

This is a deliberate loss. An unconstrained sweep of the weights reaches **55.8%**
average ink — by making the shoes-and-bag column the widest in the frame, because
landscape photography fills a wide box efficiently. That inverts the rule the
composition rests on: the garments are what a look *is*; the shoe and the bag are
how it is finished. Constraining neither silhouette column to be narrower than
the finishing column gives **51.1%**.

**Holding the hierarchy costs 4.7 points of ink. Pay it.**

Worth noting the constrained optimum (51.1%) barely beats the hand-picked first
guess (50.0%). The sweep's value was not finding better numbers; it was pricing
the trade-off and confirming the instinct.

### 4. Expected result

| Look | Today | After | Change |
|---|---|---|---|
| separates, 7 pieces | 46% | 71% | +25 |
| a dress look, 5 | 27% | 47% | +20 |
| dress and shoes, 3 | 21% | 34% | +13 |
| no coat, 5 | 30% | 51% | +21 |
| minimal, 3 | 23% | 48% | +25 |
| layered jewellery, 7 | 40% | 57% | +17 |
| **average** | **31%** | **51%** | **+65% relative** |

### 5. The API does not change

`composeFlatlay(pieces, { overlap, max })` returns the same
`{ item, x, y, w, h, rotation, z }`. `orderForFlatlay` stays exported for the
Lookbook's grid view. **`<Flatlay>`, the Lookbook card and the look detail need
no changes at all** — this is entirely internal to `flatlay.js`.

`overlap: true` keeps working: gutters collapse to zero and rotation applies.

### 6. A known limitation, recorded rather than hidden

Garments are portrait; shoes, bags and sunglasses are landscape. In a roughly
square frame those two families cannot both get well-shaped boxes. Under this
design shoes still lose about half their box to air, bags about 40%.

An alternative structure was tried — garments across the top, finishing along a
bottom strip, which gives the landscape items landscape boxes. It measured
**45%** average, worse, because it squashes the garments instead: trousers lost
67% of their box and tops 59%. Trading garment air for accessory air is a bad
trade when garments are the subject.

This is the ceiling of a non-overlapping layout. Closing it is what phase two is
for — overlap removes the gutters and lets pieces sit over one another, which is
how a real flat-lay fills a frame.

### 7. Testing

- The six existing look-shape tests must pass untouched. This is the main safety
  net: the no-overlap invariant is what caught the last two rounds of defects.
- **Coverage.** Two assertions, both chosen to fail against the current engine
  and pass with margin against the design: **no look shape falls below 30% ink**
  (worst measured is 34%, the three-piece dress look; today three shapes sit at
  21%, 23% and 27%), and **the average across the six shapes is at least 45%**
  (measured 51%; today 31%). This encodes the actual goal as an assertion rather
  than a hope.
- **Caps.** A jewellery-heavy look must not give a necklace a garment-sized box.
- **Order.** Outerwear stays left of tops; shoes stay right of bottoms. The
  anatomy is the reason this is a weighted tree and not a treemap, so it is worth
  asserting.
- **Pruning.** A look with no outerwear must place nothing in the left third.

The ink calculation used in tests carries the same aspect table as the analysis,
kept in the test file rather than in `flatlay.js` — it is a property of the
photography, not of the geometry.

## Why not overlap first

Overlap changes how pieces relate; it does not change where the slots are. A
dress look would still reserve three empty zones. Overlapping five pieces in the
middle of a frame does not fill its corners.

Doing layout first also means phase two lands on a dense composition rather than
a sparse one, where the tilt and layering will read as intent rather than as an
attempt to disguise gaps. And this project needs no image migration at all,
so it ships without touching a single stored cut-out.

## Out of scope

Overlap, alpha encoding, the `imageMeta.alpha` flag, batch reprocessing, and the
cream-versus-white ground decision. All belong to phase two, which is unblocked
— alpha measured at 1.64× aggregate — but separate.
