# The Style Verdict — Design Spec

**Date:** 2026-07-13
**Status:** Spec — approved feature, P1 build
**Pillar:** the considered wardrobe · dressing from what you own · Inspiration → closet
**Related:** [[the-considered-purchase-spec]] (shares register, feeds it missing pieces)

---

## 1. The promise (user language)

> "You save a look because it's you. The studio should tell you how close you
> already are to actually wearing it — not just whether the colours match."

Inspiration analysis already matches each garment in a saved look against the
owned wardrobe (`analyzeInspirationWithGemini`). Today that surfaces as a flat
list: matched pieces with thumbnails, unmatched pieces with a shopping
suggestion. What's missing is the roll-up — one calm verdict on how much of
this look is already theirs to wear.

## 2. Why it is defensible

Same data moat as [[the-considered-purchase-spec]]: the match is only possible
because Atelier holds the real, owned wardrobe to compare against. A Pinterest
board or a generic styling app can show you a pretty photo; only Atelier can
say how many of those exact pieces are already in your closet.

## 3. The verdict — what it computes (no new AI call)

`analyzeInspirationWithGemini` already receives the full wardrobe and returns,
per garment, `matchedItemId` (or null) + `buyingNote` for anything unmatched.
The model has everything it needs, in the same call, to also return:

1. **`completionVerdict`** — one calm display-serif line in the same
   register as Considered Purchase's verdict line. E.g. *"Two pieces would
   complete this."* / *"You already own this look."* / *"A different
   direction for you, but three pieces in."*
2. **`piecesOwned`** — count of garments with a `matchedItemId` (the model
   states this directly rather than the UI deriving it, so the verdict line
   and the count can never contradict each other — the same discipline used
   for the Considered Purchase counts).
3. **`piecesMissing`** — count of garments with no match.

**No price, no cost-to-complete figure.** A guessed retail price for a
garment seen only in a photo is not reliable, and leading with a price tag
does not fit the brand's quiet-luxury register — money belongs at the point
of an actual, real-priced decision, which is what Considered Purchase is for.
This verdict speaks only in taste and completion terms.

## 4. Surfaces

- **Inspiration detail view:** a verdict card sits directly above the
  existing garment list (`App.jsx`, the "Garments identified" section) —
  verdict line + the two counts as quiet stat rows, visually consistent with
  the Considered Purchase card. The garment list below is unchanged.
- **Missing-piece → wishlist bridge:** each "Missing from wardrobe" garment
  keeps its existing Google Shopping link and gains an **"Add to wishlist"**
  button beside it. This creates a real wishlist item from that garment's
  `category` + `buyingNote` as name/description (no price, no `sourceUrl`).
  That item is now a normal wishlist item — open it later and "Is it worth
  it?" (Considered Purchase) scores it for real, with a real price once one
  is added. This is the one new piece of write logic in this feature;
  everything else is additive fields on an existing schema + a new render
  section using data that already exists.
- **Inspiration grid card** (`InspirationView.jsx`): unchanged for P1 — it
  already shows an "X / Y owned" chip, which is directionally the same
  signal in miniature. Not worth duplicating the verdict line at grid scale.

## 5. Data model changes

`analyzeInspirationWithGemini`'s response schema gains three fields
(`completionVerdict: string`, `piecesOwned: number`, `piecesMissing: number`)
alongside the existing `garments` array. Stored on `insp.analysis` exactly
where `garments` already lives — no new Firestore collection, no migration.
Existing saved inspirations without these fields simply don't show the
verdict card until re-analysed; the garment list still renders as it does
today (graceful degradation, same pattern as any other schema addition here).

## 6. Verdict card — editorial, consistent with Considered Purchase

Same visual language as the Considered Purchase card: verdict line in display
serif, two stat rows (Pieces owned / Pieces missing), no numeric score, no
progress bar, no red/green completion meter. The studio observes; it does not
grade.

## 7. Cost & guards

Zero new Gemini calls — rides the existing per-inspiration analysis call with
a marginally larger prompt and schema. The one new write path (add missing
garment to wishlist) reuses the existing wishlist-item creation used
elsewhere in the app; no new backend surface.

## 8. Success measures

- % of analysed inspirations where `piecesMissing` reaches 0 after a wishlist
  add + later purchase (an inspiration fully "achieved" from real purchases)
- "Add to wishlist" click-through rate on missing garments (does the bridge
  get used, or does it feel like friction)
- Whether Considered Purchase scoring volume increases from
  inspiration-sourced wishlist items vs. directly pasted links

## 9. What P1 deliberately does not do

No cost-to-complete estimate (see §3). No exact-price fetch for missing
pieces (only happens once a real link is pasted into the new wishlist item).
No cross-inspiration "taste-DNA" scoring — that is a separate, unspecced idea
about whether a look matches the user's established style, independent of
which exact pieces are owned. No Concierge chat integration.

Related: `lib/ai.js` (`analyzeInspirationWithGemini`, `scorePurchaseWithGemini`),
`views/InspirationView.jsx`, the "Garments identified" section in `App.jsx`,
the [[the-considered-purchase-spec]].
