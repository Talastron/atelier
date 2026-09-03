# Flat-lay phase two — overlapping composition on alpha cut-outs

**Date:** 2026-09-03
**Status:** design agreed, not yet planned
**Predecessors:** `2026-08-18-flatlay-renderer-design.md`, `2026-08-20-flatlay-adaptive-layout-design.md`,
`2026-08-20-share-card-redesign-design.md`. Handoff: `plans/2026-08-17-flatlay-composition.md`.

Phase one put the flat-lay on all three surfaces — Lookbook card, look detail, share image — using
the images the wardrobe already holds. Every one of those is a cut-out flattened onto white, so the
composition keeps pieces apart: two opaque rectangles that touch would show one painting a white box
over the other.

Phase two removes that constraint. Cut-outs keep their transparency, pieces overlap and tilt, and the
composition stops reading as a tidy arrangement of tiles.

---

## Three corrections to the record

The handoff and two code comments assert things that are no longer — or never were — true. They are
corrected here because the design depends on the real state, and each was written by this project
about itself.

### 1. `overlap: true` no longer overlaps anything

The handoff calls the flag "the whole phasing in one flag". It was, until the adaptive layout landed
(#75). That rewrite made the layout a tree of columns and rows which **partition** the frame, and its
design document celebrated the consequence:

> non-overlap stops being a property we test for and becomes one the structure cannot violate

It does exactly that — including when violation is what you want. Measured on a six-piece look:

| | box coverage | worst pairwise overlap |
|---|---|---|
| `overlap: false` | 92% | 0.0% |
| `overlap: true` | 95% | **0.0%** |

The flag still closes the gutters and still applies rotation (1.3°–1.8°). It cannot make two pieces
intersect. Nothing caught this: the flag is used by no surface, its two tests assert only that
rotation is non-zero and under 3°, and every other test in the suite asserts pieces do **not**
overlap — the suite was guarding the very thing phase two needs to undo.

**Phase two therefore needs a mechanism, not a boolean.**

### 2. The originals are not retained on the add path

The handoff states the originals are kept "(`imageMeta[i].original` on the add path, `images[0]` on
the polish path)". Only the second half holds. `imageMeta[i].original` is stripped before every save
— `App.jsx:3067`:

> Strip the bulky in-memory `original` base64 snapshot from imageMeta before save (risks 1MiB
> Firestore cap).

It is an in-memory undo affordance for the edit session and never becomes a stored asset.

| | cut-out lives in | original | migration source |
|---|---|---|---|
| **polish** (`imageMeta[0].cutoutUrl`) | Storage | `images[0]`, untouched | the real original |
| **add** (`imageMeta[0].cutout === true`) | inline in `images[0]` | **not stored** | the flattened cut-out |

Add-path items can still be migrated — a garment already sitting on flat white is the easiest input
the segmentation model will get, and the timing harness measured that exact case — but it is a second
pass over an image that has been through one. **The run is not lossless for add-path items**, and two
prior documents say that it is.

### 3. The canvas renderer has two defects that appear only under overlap

- `composeFlatlay` returns placements in **slot order, not z order** (`Tops:z3` precedes
  `Bottoms:z2`). `Flatlay.jsx` sets `zIndex` and the browser sorts; `canvas.js` draws in array order.
  Under overlap the share card would layer trousers over the shirt while the app layers the reverse.
- `canvas.js` ignores `placement.rotation` entirely.

Both are invisible while nothing overlaps, and both would make the share card disagree with the app
the moment phase two lands — on the one artefact that leaves the product.

---

## What is already measured and settled

Carried forward from the handoff. None of it needs redoing.

- **Alpha is affordable.** 32 real garments, deliberately awkward ones: WebP + alpha at q80 is
  **1.64×** today's JPEG-on-white by aggregate bytes. PNG is 10.2×; the original flatten-onto-white
  decision generalised correctly from PNG and wrongly to all formats carrying alpha.
- **The inline budget holds.** The largest of the 32 at q80 was 147K against a 161KB cap. Nothing
  exceeded it at q80 or q70.
- **Edges are clean.** The feared ragged-edge failure did not appear, including on a fine chain and a
  strapped bag. The real risk is *contrast*, not raggedness.
- **Reprocessing costs 8.8s per item** in steady state (23.1s for the first, which pays a one-off
  ~5MB model load). Encoding is 50ms of that — **0.6%** — so the encoder work adds nothing measurable
  to a migration. 150 items is roughly 30 minutes including Storage writes.
- **The encoder is shipped and proven.** `encode.js` — `WEBP_LADDER`, `pickEncoding`, `canEncodeWebp`
  — went live in #78 and needs no change. `toDataURL` silently returns PNG for a type it cannot
  write, so the feature-detect is load-bearing and already in place.

---

## Decisions

### Overlap: grow each piece about its own centre

The layout tree stays exactly as it is. When `overlap` is on, each placement is scaled by a constant
about its own centre, so neighbours encroach and the existing `z` decides who sits on top. The
anatomy, the per-piece caps, the aspect clamp and the surplus redistribution all survive untouched.

Rejected: a bespoke overlapping layout (most editorial, but discards a tree that took three rounds to
settle), and bleeding garments while holding finishing pieces clear (more rules to reason about, and
the accessories would still float in their own gaps).

### The growth must slide back inside the frame, not clip

Growing a box pushes it past the frame edge, and both stages clip. On a six-piece look **five of six
pieces** leave the frame at any bleed above 1.0 — which is the "a dress and jacket appear completely
cropped" fault, reintroduced by construction.

So a grown box is **translated back inside the unit square, never resized**: nothing is squashed and
nothing is clipped. This also concentrates the overlap inward, roughly doubling it for the same
growth:

| bleed | worst pair | overlapping pairs | past frame edge |
|---|---|---|---|
| 1.06 | 14.2% | 8 | 0 |
| **1.08** | **18.5%** | **8** | **0** |
| 1.10 | 22.7% | 8 | 0 |
| 1.20 | 51.3% | 9 | 0 |

`BLEED` starts at **1.08** and is a single tunable constant, subject to visual review.

### Ground: cream, with a soft shadow under every bleeding piece

Overlap introduces a second adjacency the handoff did not account for. It records the pale-garment
risk as *garment against ground* — a white dress fading into cream. Once pieces overlap there is also
*garment against garment*: a white shirt lying on a cream coat has no gutter and no plate edge between
them, and the two merge into one shape.

**And the ground is worse than the one that raised the alarm.** The alpha harness rendered its 32
garments on `#F4F0E8`. The app's page cream — the one this composition will actually sit on — is
`#F7F5F2`, which is lighter, so a white garment separates from it *less*:

| ground | contrast with a white garment |
|---|---|
| `#F4F0E8` (what the harness tested) | 1.137 : 1 |
| `#F7F5F2` (the app's actual page) | **1.088 : 1** |

Both are so far below any legibility threshold that the comparison is really making a different
point: **no cream in the brand palette can separate a white garment on its own.** Darkening the
ground until it could would stop it being cream. The shadow is therefore not a refinement on top of a
colour choice — it is the only mechanism available, and the colour is free to stay on brand because
of it.

A soft drop shadow answers both, and **the alpha channel is what makes it possible**: CSS
`filter: drop-shadow()` and the canvas shadow both follow the alpha, so the shadow traces the garment
rather than its bounding box. On today's opaque cut-outs the same rule draws a shadow around a
rectangle. The transparency that permits overlap is the transparency that permits separation.

Rejected: staying near-white (safe, but abandons the warm ground and does nothing for pale-on-pale),
and a hairline outline (more reliable and cheaper, but reads as a sticker and draws the eye to any
raggedness rather than softening it).

**This applies to the in-app surfaces, not to the share card.** `ground` has always been a prop, and
the two surfaces have always differed: in the app the ground is the card itself, while on the share
card the composition sits on a white panel drawn over the cream page. That panel stays white — see
the canvas section. What must match across the two is the *composition* — geometry, layering,
rotation — which is what the shared engine exists to guarantee. The ground never was part of that.

**Correction, made during implementation: the cream ground is per composition, not a new default.**
This section originally specified changing `Flatlay.jsx`'s default `ground` to `#F7F5F2` outright.
That is wrong, and it would have reintroduced the #73 fault on every look in the wardrobe. Every
cut-out stored before phase two is a JPEG flattened onto `#FFFFFF` and drawn `object-contain`, so it
**is** an opaque white rectangle: on white it passes for a transparent one, and on cream it reads as
a white box across the page.

Gating bleed per piece does not cover this, and the reasoning that said it did conflated two
different clashes. Not bleeding stops a piece covering its **neighbour**; it says nothing about that
piece against the **ground**. So the ground is resolved per composition — `#FFFFFF` while any piece
is a bare cut-out without alpha, `#F7F5F2` once none is. A part-migrated look therefore renders
exactly as it does today and warms up only when it can carry it. A plated piece (a raw photograph)
does not count against it: `ItemTileImage` paints that photo's own sampled background behind it, so
it settles on either ground.

### Degrading: per piece, not per look

The handoff states graceful degradation as a per-look rule — overlap only where every piece has
alpha. That hides a multiplier:

| coverage | look of 4 | look of 6 | look of 8 |
|---|---|---|---|
| 95% | 81% | 74% | 66% |
| 90% | 66% | 53% | 43% |
| 80% | 41% | 26% | 17% |

At 90% migrated, barely half of six-piece looks would overlap — and the failure is silent, because a
non-overlapping look is indistinguishable from today's.

The per-piece rule avoids the compounding and is simpler to state. The danger was never overlap; it
is an **opaque** piece drawn over something. So:

1. A piece bleeds only if its cut-out has alpha.
2. A piece that cannot bleed is demoted below every piece that can.

An opaque piece then never grows, so it has nothing beneath it to spoil; and nothing that grew can be
covered by one. An alpha piece lying over an opaque one is precisely the intended effect. Coverage
becomes linear: 90% migrated means 90% of pieces bleed.

### Migration writes to Storage, never over `images[0]`

The two paths have opposite safety profiles under the same operation. Overwriting a polish-path
cut-out is harmless — it lives in Storage and `images[0]` still holds the untouched photograph.
Overwriting an add-path cut-out destroys the only copy the account has, because `images[0]` *is* the
cut-out. Nothing in the code marks the difference.

Rather than guard the asymmetry, remove it. Every migrated cut-out is written to **Storage as
`cutoutUrl`**, and `images[0]` is left exactly as found. `itemImageDisplay` already prefers
`cutoutUrl` over `images[0]`, so add-path items simply become polish-path items:

- one shape in the database instead of two
- the previous cut-out survives as a fallback
- the 220,000-character inline budget stops applying to those items
- Firestore documents get **smaller**, as a side effect of a migration that adds transparency
- undo is deleting one field

Rejected: overwriting in place (smallest change, but irreversible on the add path, and it keeps two
shapes behaving differently under one button), and clearing `images[0]` after the Storage write
(tidiest end state, but arrives at the same irreversibility more neatly).

---

## Architecture

### `lib/flatlay.js` — the engine

Gains one option and one constant. It stays pure geometry: it takes a **predicate**, not knowledge of
image formats.

```js
export const BLEED = 1.08;

// Every accepted piece keeps its own z (1–5 plus a within-slot index). Subtracting
// this puts a rejected piece below all of them however the slots are numbered, and
// leaves the accepted pieces' order among themselves untouched.
const Z_DEMOTE = 100;

/**
 * @param {object[]} pieces
 * @param {{ overlap?: boolean, max?: number, bleed?: (item: object) => boolean }} options
 *   bleed — which pieces may grow into their neighbours. Defaults to () => false,
 *   which is the safe answer: without it, an opaque piece would paint over a garment.
 */
export function composeFlatlay(pieces, { overlap = false, max = 8, bleed = () => false } = {})
```

When `overlap` is true, for each placement:

- **accepted** by `bleed` — scale `w`/`h` by `BLEED` about the centre, then slide back into frame:
  `x = min(max(x, 0), max(0, 1 - w))`, and the same for `y`. The outer `max(0, …)` matters: a piece
  grown wider than the frame would otherwise get a negative upper bound and be pushed off the left
  edge — the exact fault being avoided. `z` unchanged.
- **rejected** — geometry untouched; `z` becomes `z - Z_DEMOTE`, below every accepted piece.

When `overlap` is false nothing changes at all, and the predicate is not consulted.

### `lib/polish.js` — the data-model question

```js
// Whether this item's cut-out carries real transparency, and so may overlap its
// neighbours. Written by the migration and by every new polish; absent on
// everything cut out before phase two, which is why the test is for `true` and
// not merely truthiness — an item with no imageMeta at all must answer false.
export function hasAlphaCutout(item) {
  return item?.imageMeta?.[0]?.alpha === true;
}
```

One place asks the question; the engine and both renderers pass it in. It sits beside
`flatlayTreatment`, which answers the adjacent question — plate or bare — for the same reasons.

### `components/Flatlay.jsx` — DOM renderer

- `ground` becomes an unset prop resolved per composition: `#FFFFFF` while any piece is a bare
  cut-out without alpha, `#F7F5F2` — the page cream `canvas.js` already calls `PAGE` — once none is.
  See the correction under the ground decision above for why an unconditional default is wrong.
- Passes `bleed: hasAlphaCutout` to `composeFlatlay`.
- A bleeding piece gets `filter: drop-shadow(0 6px 14px rgba(28, 25, 23, 0.16))` — the ink already
  used for text, at a sixth opacity, offset down and blurred as if lit from above. These three numbers
  are the visual-review dial. Plated and opaque pieces keep exactly today's treatment.
- The stale comment claiming phase two "changes `ground` to cream and flips `overlap`; nothing else"
  is corrected.

### `lib/canvas.js` — canvas renderer

- **Sort placements by `z` before drawing.** Correctness, not cosmetics.
- **Apply `rotation`** — `save` / `translate` to the cell centre / `rotate` / `drawImage` / `restore`.
- Set `shadowColor = 'rgba(28, 25, 23, 0.16)'`, `shadowBlur`, `shadowOffsetY` for bleeding pieces,
  and clear them (`shadowColor = 'transparent'`) for the rest — canvas shadow state is sticky and
  would otherwise leak onto the next piece drawn. Blur and offset are scaled from the CSS values by
  the stage's pixel width, so the two surfaces match at 1080px rather than only in the source.
- **The share panel stays `#FFFFFF`.** The comment there says "phase two recolours this one
  rectangle", and it should not: the page behind it is already `#F7F5F2`, so recolouring the panel to
  cream would make it the same colour as the page and erase the panel from a card that was
  deliberately composed with one (#77). The panel's white existed for two reasons — it hid the
  opaque cut-outs' white boxes, *and* it is a design element. Alpha retires the first reason only.
  Nothing is lost by keeping it: a white garment has no useful contrast against cream either
  (1.088 : 1), so the shadow is carrying that separation on both surfaces regardless. The comment is
  corrected to say so.
- Passes the same `bleed: hasAlphaCutout`.

Both surfaces then compose identically, which is the property the shared engine exists to provide.

### `lib/canvas.js` — `removeImageBackground`

Gains an alpha mode: skip the white `fillRect`, encode WebP with transparency, and let the caller
record `alpha: true`. The ladder, the budget and `canEncodeWebp` are unchanged — but an alpha encode
that cannot be written as WebP must **not** fall back to JPEG, which would flatten the transparency
with no error raised. Where WebP is unavailable the item is left unmigrated and reported.

### The migration runner

Lives in Profile beside "Tighten cut-outs", and is deliberately not that runner: `retrimItemPrimary`
skips any item it finds nothing safe to trim in, and a skipped item is never re-uploaded, so it would
convert an unmeasured subset — and it re-encodes an already-lossy JPEG in place.

**Survey, then run.** It first counts what it will do and reports it — how many items are eligible,
how many are already migrated, how many have no usable source — before spending half an hour.

**Per item:** read `images[0]` → re-segment → encode WebP with alpha → upload to Storage → write
`cutoutUrl` and `alpha: true`. `images[0]` untouched.

**Resumability comes free.** The `alpha` flag *is* the checkpoint: "done" means "has `alpha: true`".
There is no separate progress document, and so nothing that can drift out of step with what actually
happened. A laptop closed at item 60 costs items 61 onward, not the run. This matters because the work
is single-threaded in a foreground tab for around thirty minutes, and browsers throttle background
tabs.

**Failures are per item.** One item that cannot be fetched, segmented or encoded is reported and
skipped; it stays unmigrated, its piece simply does not bleed, and a later run retries it.

---

## Testing

The existing suite asserts pieces **never** overlap. Those assertions become conditional on
`overlap: false` — they remain exactly as strong for the non-overlapping case, which is still what
most looks render as during and after the migration.

New coverage:

- a piece the predicate rejects has identical geometry with `overlap` on and off
- every rejected piece's `z` is strictly below every accepted piece's `z`
- no placement leaves `[0, 1]` on either axis, at any bleed value, for every look shape already
  covered by the layout tests
- a grown box keeps its aspect ratio — it is translated, never resized, to stay in frame
- with all pieces accepted, at least one pair overlaps (the regression `overlap: true` currently
  fails)
- with no pieces accepted, no pair overlaps
- placements sorted by `z` for canvas drawing match the DOM's `zIndex` ordering
- `hasAlphaCutout` is false for absent `imageMeta`, an empty array, `cutout: true` without `alpha`,
  and a `cutoutUrl` without `alpha`

---

## Non-goals

- **No change to `compressImageToDataUrl`**, which encodes the original photographs. WebP would
  likely help there too, but that is the critical add-item path and the measurement in hand is for
  cut-outs.
- **No re-photography prompt.** An item whose re-segmentation comes out poorly is a manual re-polish,
  not a feature.
- **No server-side migration.** `@imgly/background-removal` is browser WASM; moving it is a separate
  project with its own cost model.
- **No change to Storage object names.** They keep `.jpg`; `uploadString` reads the MIME from the data
  URL, so `contentType` is correct and nothing reads the extension.

---

## Risks

| Risk | Handling |
|---|---|
| Re-segmenting an add-path cut-out comes out worse than what it replaces | `images[0]` is preserved, so the previous cut-out remains; undo is deleting `cutoutUrl` and `alpha` |
| A pale garment is still lost on cream despite the shadow | Shadow opacity and blur are tunable constants; visual review before merge, on real garments rather than drawn silhouettes |
| `BLEED` looks wrong at 1.08 | One constant in one place, with the measured table above to pick from |
| A browser without WebP | The item is not migrated and is reported; it must never fall back to a JPEG encode, which would flatten the alpha silently |
| Storage cost rises 1.64× | Measured and accepted; add-path items partly offset it by leaving Firestore |
| The run is abandoned halfway | Per-piece degradation means a half-migrated wardrobe looks progressively better rather than broken, and the flag resumes the run |

---

## Sequence

1. Engine: `bleed` predicate, growth, frame clamp, z demotion — pure, fully testable, renders nothing.
2. `hasAlphaCutout` and the `alpha` flag.
3. Encoder alpha mode.
4. Renderers: DOM and canvas, including the z-sort and rotation fixes.
5. Migration runner.
6. Visual review on real garments, then tune `BLEED` and the shadow.

Steps 1–4 are inert without step 5: nothing in the wardrobe has alpha, so no piece bleeds and every
surface renders exactly as it does today. That is the intended safety property, and it means the
risky half can be reviewed before a single stored image is touched.
