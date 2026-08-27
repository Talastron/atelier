# The share card, redesigned

**Date:** 2026-08-20
**Branch:** `feat/share-card`
**Touches:** `composeOutfitExportImage` in `src/lib/canvas.js`, and the share modal's header in `App.jsx`

The share card is the only artefact Atelier produces that leaves the app. It is
what appears on Instagram and Pinterest, and it is the last surface still using
the grid of white plates that every other surface replaced.

## What is wrong, measured

**1. Cover-fit crops the garment.** The draw call takes a centred slice sized to
fill the cell. That is right for a landscape and wrong for a dress, where the hem
and the shoulder *are* the subject. Worst at five and six pieces, which is the
common case:

| Garment | Visible at 5–6 pieces |
|---|---|
| trousers | **39%** |
| dress | **43%** |
| coat or jacket | **49%** |
| top | 62% |

**2. The cell silently inverts.** The code says "prefer 3:4 portrait but cap at
the available row height". At three rows the cap (343px) overrides the preferred
height (579px) while the width stays 434px, so the cell becomes **landscape at
1.27** — and cover-fit then crops a portrait garment to fit it. A clamp that
changes the meaning of what it clamps.

**3. It ignores the cut-outs.** It reads `itemImages(p)[0]`, the raw photo, not
`itemImageDisplay`. Every background the user has had removed is absent from the
most public thing the app makes. A raw photo is also more loosely framed, so
cover-fit crops *more* of it than it would a tight cut-out — the two faults
compound.

**4. It is still a grid of plates.** Driving it from the flat-lay engine was
always the intent: "Canvas renderer. Same placements × pixel dimensions, for the
share image" is item 2 of the original handoff's remaining work.

**5. Odd counts orphan a cell.** Five pieces in two columns leaves one alone.

**6. Forty-three per cent of the card is furniture.** Of 1920px: 420 of chrome
above the images, 1100 of images, 400 below. Within the top 420 there are three
separate brass-rule-and-eyebrow devices — "A LOOK · COMPOSED IN ATELIER", then
"PALETTE", then "5 PIECES" below the images. The same gesture three times in one
image stops being a signature and becomes a texture. It works because it is rare.

Two of those labels are redundant outright: "A LOOK · COMPOSED IN ATELIER" says
what `myatelier.style` says in the footer, and "PALETTE" labels a row of coloured
dots that already have their names written beside them.

**7. Dead space with no stylist's note.** The images stop at y=1520 and the
footer begins at 1760. When a look has no reasoning, 240px sits empty.

## The design

### 1. Composition from the shared engine

`composeFlatlay(pieces, { overlap: false, max: 6 })` returns placements in 0–1;
multiply by the composition box and draw. A look then composes identically on the
Lookbook card, the look detail and the share image — and phase two's `overlap`
flip reaches the share card for free, with no further work here.

**Six, not the eight used elsewhere.** A share card is read at a glance on a
phone, at a fraction of the size it is composed at, and among other people's
posts. Six pieces each get more of the frame than eight would, and the engine's
own priority drops finishing pieces first, so what goes is a cuff rather than the
coat. The look detail and the Lookbook card keep eight — they are read
deliberately, by someone who already owns the wardrobe.

### 2. Contain, not cover

Each piece is fitted whole inside its placement and centred. This is the fix for
finding 1, and it makes findings 2 and 5 moot: placements are no longer uniform
cells, so nothing needs to be clamped into a shape it does not want, and there is
no last row to orphan.

### 3. Draw the polished image

`itemImageDisplay(p, 0).src`, falling back to `itemImages(p)[0]` when there is no
metadata. The one caveat: `itemImageDisplay` returns Firebase Storage URLs for
polished cut-outs, and those are not canvas-safe cross-origin. The existing
`loadImageForCanvas` already handles the proxying the rest of the app relies on,
so this must go through it and fall back to the raw image if a fetch fails —
never leave a piece blank.

### 4. A white panel

Every stored cut-out is an opaque white JPEG. Floating them onto the card's cream
page (`#F7F5F2`) would paint white boxes across it — the exact fault fixed on the
Lookbook card. The composition therefore sits on a **white rounded panel**, as it
does in the look detail. When phase two lands, this panel is the one thing whose
colour changes.

### 5. An aspect band, not a ceiling

The panel is taller than it is wide — 968×1190 with a stylist's note, 968×1370
without. The engine's zones are drawn for a roughly square frame, and the
Lookbook card already showed what happens when that is ignored: in a frame too
wide, columns drift apart. A frame too tall is the same fault inverted — pieces
stretch and thin.

So the composition takes the largest box within the panel whose aspect lies in
**0.8 to 1.2**, centred. A ceiling alone would not have caught this; the band is
the general form of the clamp already used on the Lookbook card, which only
guarded the wide side.

With a note the panel is 0.81 and passes through untouched. Without one it is
0.71, so the composition clamps to 968×1210 and centres, leaving the extra height
as margin rather than stretched garments. The white panel still fills the space —
what is reclaimed is breathing room around the composition, not dead air between
it and the footer.

The panel's corner radius is 32px, matching the `rounded-[2rem]` the look detail
uses for the same surface.

### 6. Reclaim the furniture

| | now | after |
|---|---|---|
| brass rule | y=142 | y=140 |
| top eyebrow | y=144 | **removed** |
| title baseline | y=248 | y=210 |
| palette label | y=320 | **removed** |
| palette swatches | y=356 | y=250 |
| composition top | y=420 + titleOffset | **y=330 + titleOffset** |
| composition bottom | y=1520 | 1520, or **1700 with no note** |
| side padding | 88 | **56** |
| footer | y=1760 | unchanged |

`titleOffset` is the existing 88px shift applied when the title wraps to two
lines; both the palette row and the composition top carry it, as they do now.

The footer keeps its full treatment — brass rule, piece count, `myatelier.style`
in Playfair. It is the one place the signature belongs and the last thing read.

**Vertical chrome was not the constraint, and saying so was wrong in an earlier
draft of this spec.** The composition is limited by WIDTH: at 904px across, the
aspect band caps its height at 904 / 0.8 = 1130, so extending the panel downward
past that gains nothing. Reclaiming vertical space buys balance and removes the
dead area — both worth having — but not garment size.

Garment size comes from two other places:

- **Contain instead of cover**, which is the real win. A dress goes from 43% of
  itself visible to 100%. Nothing else in this document comes close.
- **Side padding 88 → 56**, widening the panel from 904 to 968. With the top
  reclaimed, the composition becomes 968×1190 where it was 904×1100 — about
  **16% more area**, and the aspect (0.81) sits inside the band without clamping.

Chrome falls from 43% of the card to 38% with a stylist's note and 29% without.

### 7. The modal

The modal header says "Share this look"; the line beneath it says "5 pieces ·
Composed for sharing"; the card below says the count again. The middle line is
removed and the body's top padding reduced, so the preview sits higher and more
of the card is visible without scrolling. This changes nothing about the exported
image.

### 8. Testing

The canvas cannot be unit-tested here — no jsdom, and the repository's convention
is pure functions in `src/lib/` verified by eye in the app. So the two things
that were actually *wrong* become pure functions that can be:

- **`fitContain(imgW, imgH, boxW, boxH)`** → the centred rectangle showing the
  whole image. Tested at the aspects that broke: a dress at 0.55, trousers at
  0.50, a landscape shoe at 1.25, a square, and degenerate zero inputs. The
  cover-fit version of this maths is the bug, so its replacement is where the
  tests belong.
- **`shareCardLayout({ titleLines, hasNote })`** → where the panel sits and how
  tall it is. Tested so the dead space cannot come back, and so a two-line title
  still cannot collide with the panel.

That leaves `composeOutfitExportImage` as thin drawing code over two tested
helpers, which is the right shape for something that cannot be tested directly.

## Out of scope

`overlap: true` and the cream ground — both belong to phase two. The public-link
share page. The Pinterest and Instagram buttons. The stylist's note, palette
computation, and footer content, which are all good as they are.

## Risks

**The piece cap is now decided: six.** It differs from the eight used on the
other two surfaces, which is a deliberate divergence rather than an oversight —
recorded here so a later reader does not "correct" it into consistency. A look of
twelve pieces will show half of itself on the share card; the credits are not
part of this artefact, so those pieces are simply absent rather than listed.

**Storage URLs on canvas.** Point 3's fallback is the guard, but if proxying
proves unreliable for polished cut-outs the card would quietly revert to raw
photos for some pieces and look inconsistent. Worth checking against a real
wardrobe rather than one item.
