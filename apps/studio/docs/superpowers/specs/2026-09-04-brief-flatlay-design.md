# The Daily Brief should show a look the way every other surface does

**Date:** 2026-09-04
**Status:** design agreed, not yet planned
**Predecessors:** `2026-08-18-flatlay-renderer-design.md`, `2026-09-03-flatlay-phase-two-design.md`

---

## The finding

Phase one set out to put the flat-lay "everywhere a look appears — **Lookbook card, look detail, share image**." Three surfaces, all done.

**The Daily Brief is a fourth surface showing a look, and it was not on the list.** So the app's centrepiece — the card on Today, the one seen every morning — still renders an outfit the way the flat-lay was built to replace:

```jsx
<div className="rounded-2xl bg-white smooth-shadow border border-stone-200/50 p-2.5 sm:p-3">
  <div className="aspect-[3/4] overflow-hidden rounded-xl bg-white">
```

That is, word for word, the thing phase one's problem statement described: *"a 2×2 grid of equal white plates… it reads as an inventory rather than an outfit."* It survived because the list of surfaces was written before this card existed in its current form, and nobody re-read it.

**And the component to fix it already exists.** `OutfitFlatLay` in `App.jsx:8624` is flat-lay plus credits, used by the look detail, and its own comment says *"a look is arranged identically here and on the Lookbook card."* The Brief is the surface that sentence forgot.

---

## Decisions

### Flat-lay, with the credits beneath

The composition reads as an outfit; a credits list below names every piece, grouped by category. Exactly the look detail's pattern, because it is exactly the same component.

**The tiles were doing something real and it must not be lost.** Each carries a brass eyebrow — subcategory or category — and the piece's display name. On a card telling you what to wear this morning, knowing the third item is your Chelsea Saddle Bag rather than a brown shape is information, not decoration. The credits list is what preserves it.

Rejected: **flat-lay alone**, as on the Lookbook card. The boldest and most editorial option, and it keeps the Brief compact — but it removes the only place the outfit's pieces are named, turning "what is that bag" from a read into a tap. Rejected: **keeping the tiles** on the argument that the Brief is instructional rather than editorial — defensible, and it leaves the most-seen card in the app as the one place that still looks like what the flat-lay replaced.

### Extract `OutfitFlatLay` rather than copy it

It lives inside `App.jsx` and cannot be imported. Moving it to `src/components/OutfitFlatLay.jsx` lets the Brief and the look detail render the *same component* — which is the only way "a look is arranged identically wherever it appears" becomes true rather than aspirational.

A second copy would be the cheaper change and the reason this problem exists: the tile grid is itself a second way of drawing a look, written when there was only one.

### The Brief's own tiering goes

The Brief currently sorts pieces into a garment tier at `w-[clamp(180px,20vw,244px)]`, an accessory tier at `w-[clamp(150px,16vw,200px)]`, and a separate full-width jewellery strip below. All three exist to stop small pieces being lost among large ones.

`composeFlatlay` already solves that, and better — anatomical placement, per-piece caps so jewellery never renders coat-sized, and silhouette-before-finishing ordering. Keeping both would be two hierarchies disagreeing.

### Tapping a piece opens that piece

Today every tile calls `openBrief`, so tapping the shoes and tapping the coat do the same thing. `OutfitFlatLay` takes `onOpenItem`, which the look detail already uses to open the tapped item. The Brief adopts that: it is what the tiles look like they should do.

---

## Architecture

### `src/components/OutfitFlatLay.jsx` — moved, not rewritten

Lifted from `App.jsx:8624` unchanged: props `{ pieces, onOpenItem, paletteFilter }`, the `ORDER`/`sortByOrder` credits grouping, and the palette-filter coupling that dims the same garments in the composition and the list. `App.jsx` imports it in place of its local definition.

Its dependencies are exactly three — `Flatlay`, `itemColors`, `itemImages` — all already module imports, so the move needs no new plumbing and pulls nothing else out of `App.jsx` with it. That is worth checking before extracting rather than after: a component that reaches into its file's closure looks portable and is not.

### `src/views/TodayView.jsx` — `DailyBriefCard`

The mobile grid, the desktop flex row, the jewellery strip, `renderLookCard`, `GARMENT_CATS` and the tier width classes are all replaced by one `<OutfitFlatLay>`. `briefItems` is already resolved and is what gets passed. `onItemClick` is already a prop of `TodayView` and is threaded through.

The card grows taller. That is the cost of the credits list and is accepted: the Brief is the hero of that screen, and the concierge bar, week strip and digest below it all move down.

---

## Testing

No new unit tests. `OutfitFlatLay` is a move, not a change, and the geometry beneath it is covered by `flatlay.test.js`'s 37 cases. Views are not tested in this codebase — none is, they need a DOM, and this design does not change that.

The verification is the diff plus the screen:

- `App.jsx` renders the imported component and no longer defines one — asserted by `grep -c "function OutfitFlatLay" src/App.jsx` returning 0.
- The look detail is visually unchanged. It is the control: if the extraction altered anything, it shows there first, on a surface whose current appearance is known-good.
- The Brief shows a composition with named credits, on mobile and desktop.
- Tapping a piece opens that piece, not the brief.

---

## Non-goals

- **No change to the composition itself.** Same engine, same anatomy, same `max`.
- **No change to the look detail** beyond importing what it used to define.
- **No change to the Brief's other parts** — the eyebrow, the title, "Wear this", the share and save actions, the "what the Concierge saw" capsule.
- **The flat-lay/grid toggle is not brought along.** The Lookbook has one because a grid is a genuinely denser reading of many looks; the Brief shows one look and has no such tension.

---

## Risks

| Risk | Handling |
|---|---|
| The extraction changes the look detail | It is the control surface and is checked first; the component moves unmodified |
| The card becomes too tall on mobile | Accepted deliberately, and visible immediately on the screen it affects. If it is wrong the answer is the credits list's density, not the composition |
| Losing the jewellery strip loses small pieces | `composeFlatlay` caps jewellery per piece so several necklaces stay distinct — the behaviour the strip was working around |
| A brief with very few pieces looks sparse | The same engine and the same look shapes the Lookbook already renders; nothing here is new geometry |
