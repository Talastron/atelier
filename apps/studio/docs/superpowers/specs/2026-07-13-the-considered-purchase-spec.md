# The Considered Purchase — Design Spec

**Date:** 2026-07-13
**Status:** Spec — approved feature, phased build
**Pillar:** the considered wardrobe · saving money · dressing from what you own
**Companion content:** the Journal essay *On the pause before buying*

---

## 1. The promise (user language)

> "Before you buy it, ask the studio. Paste the link, and Atelier tells you
> what this piece would actually do in *your* wardrobe — before your money leaves."

This is the moat feature. Every recommendation engine can style a photo. Only
Atelier can answer *"should I buy this, given everything I already own and
actually wear?"* — because only Atelier holds that person's real wardrobe, wear
history, measurements, and cost-per-wear. The output is a verdict with reasons,
delivered in the brand's calm register, ending in a suggested **72-hour pause**.

## 2. Why it is defensible

- **Data no one else has.** The score is computed against the user's owned
  wardrobe, logged wears, fit profile, and price history. A competitor starting
  today cannot reproduce it without years of the user's data.
- **Switching cost compounds.** The more you log, the sharper the verdict, the
  more irreplaceable the studio becomes.
- **It is anti-consumption, which is the brand.** The feature that most helps you
  *not* buy is the one that most earns trust — and trust is what sells the
  subscription.

## 3. The verdict — what it computes (all from existing data)

Paste a product URL → `pageProxy` returns price/brand/category/description
(the import pipeline already does this). Then, against the wardrobe:

1. **Outfits unlocked** — run the existing outfit logic (`lib/outfit.js` +
   `lib/ai.js` suggest-look) counting how many *new* complete looks this piece
   makes possible with items already owned. "Unlocks 6 new outfits" vs "Unlocks 1."
2. **Duplication / overlap** — nearest neighbours in the owned wardrobe by
   category + colour family + silhouette. "You own 3 close relatives of this"
   (reuses the matching logic already in the inspiration cross-reference).
3. **Predicted cost-per-wear** — estimate wears from category baseline × how well
   it fits the user's logged habits (a coat vs an occasion dress), divide the
   imported price. Show the honest figure the essay describes.
4. **Fit risk** — compare against measurements + the per-brand size chart work
   already sketched in `itemFit.js`. "Fits your profile" / "This brand runs small
   on you." Skips gracefully when no measurements.
5. **Gap fill** — does it answer a known gap (from the wardrobe-gap analysis) or
   duplicate a saturation? "This fills your 'transitional outerwear' gap."

These roll into a single calm verdict line + the five supporting facts, and a
**"Hold for 72 hours"** action that saves it to the wishlist with a review date
(links straight into the [[wishlist price-watch]] feature — if you wait, we also
watch the price).

## 4. Surfaces

- **Primary:** an "Is it worth it?" action on the link-import flow — the moment a
  URL is pasted, before the item is saved. Verdict shown inline.
- **Wishlist:** a "Score this purchase" button on any wishlist item (P1 — reuses
  the stored `sourceUrl`, no new fetch UI).
- **Concierge:** the user can paste a link in chat and ask "should I buy this?" —
  the Concierge answers with the same verdict, in prose.

## 5. Phases

- **P1 (client-only, ~1 day):** "Score this purchase" on a wishlist item.
  Reuse pageProxy enrichment + one `geminiText` call that receives the enriched
  product + the wardrobe summary (the same `summarize()` context the stylist
  uses) and returns the structured verdict (JSON schema: verdictLine, outfits
  unlocked, overlaps[], predictedCpw, fitNote, gapNote, recommendation). Render
  as an editorial verdict card. Thinking disabled (fast).
- **P2:** wire into the link-import flow (pre-save "Is it worth it?").
- **P3:** Concierge intent — detect a pasted URL + purchase question, run the
  verdict, answer in prose with item chips.
- **P4:** track outcomes — "you paused, then bought at a lower price, saving £X"
  → the shareable proof number (GTM).

## 6. Verdict card — editorial, not a score-out-of-100

Register matters. No aggressive "BUY / DON'T BUY" badge. Instead: a one-line
verdict in display serif ("A considered yes." / "Worth the wait." / "You may
already own this."), the five facts as quiet stat rows, and the 72-hour hold as
the single ink button. Cost-per-wear and overlaps carry the argument; the studio
advises, it does not command.

## 7. Cost & guards

One `geminiText` call per scored purchase (budget 0 thinking, ~1–2k tokens).
Covered by existing per-user AI caps. No new external services (pageProxy is
first-party + App Check-gated). Fails gracefully to "we couldn't read that page —
add the price yourself and we'll still score it."

## 8. Success measures

- Purchases scored per active user (engagement with the wedge feature)
- Paused → not-bought rate (money saved, the anti-consumption proof)
- Paused → bought-cheaper (with price-watch) → the shareable "£X saved" figure
- Qualitative: does it become the thing users tell friends about?

Related: [[wishlist-price-watch]], `lib/ai.js` (`summarize`, suggest-look),
`lib/itemFit.js`, `lib/outfit.js`, the wardrobe-gap analysis.
