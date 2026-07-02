# Capture & Luxe-ify pipeline — design

**Date:** 2026-07-02
**Surface:** Item capture / add-to-wardrobe (all entry paths)
**Primary files:** `src/App.jsx` (add-item flows), `src/firebase.js`
(`findProductListingFromPhoto`), `src/lib/ai.js` (`identifyItemWithGemini`,
`analyzeReceiptImageWithGemini`), `src/lib/net.js` (`fetchProductFromUrl`,
`imageProxy`), `src/lib/polish.js` (`polishItemPrimary`), `functions/index.js`
(new `productSearch`).

## Problem

Cataloguing a wardrobe is the biggest obstacle to using the product, and it has
two compounding failures:

1. **Retailers block link-import.** Bot protection, JS-rendered pages, and
   consent walls defeat the `pageProxy` HTML scrape for a large slice of
   retailers. Chasing this is an arms race we lose.
2. **A wardrobe snap looks un-luxurious.** Even when capture succeeds via a
   phone photo, a crumpled-on-a-hanger shot undercuts the atelier feel. Today
   the identify flow stores the raw snap as the display image
   (`App.jsx` ~line 2664: `images: [dataUrl]`, `imageMeta: [{ cutout: false }]`).

These pull against each other: retailer-independent capture (snap your own item)
produces exactly the un-luxurious asset we don't want to display.

## Principle

Every item entering the wardrobe passes through **one pipeline** whose job is to
give it a catalogue-grade image. **A raw wardrobe snap never survives to the UI.**
The user's photo is treated as a *query*, not the asset.

## Decisions (locked in brainstorm)

- **Match-first, polish fallback** — try hardest to fetch the real catalogue
  image; fall back to polishing the user's snap.
- **Pick-from-candidates** fidelity gate — the user chooses the exact match from
  2–4 candidates, or "None — use my photo." Never a silent swap.
- **Universal coverage** — identify, receipt/bulk, manual, and link paths all
  run through the same pipeline.
- **Bulk = one grid review screen** — items import immediately with a best-guess
  image; a grid lets the user open a picker for any outlier. Progressive.
- **Match engine = shopping search from the AI query** — extend the half-built
  `findProductListingFromPhoto` to actually run a search and return candidates.
  Works for photo (Gemini `searchQuery`) and text (brand + name) inputs alike.

## The three image tiers (in order)

1. **Catalogue match** — real retailer packshot, user-picked.
2. **Polished snap** — background-removed + trimmed packshot via
   `polishItemPrimary` (already built).
3. **Graceful placeholder** — no photo and no match: a category glyph on the
   shared cream ground, item flagged `needsImage` so the grid review surfaces it.

## Components

### 1. `productSearch` Cloud Function (new, App Check-gated)
- Input: `{ query, limit }`. Output: `candidates: [{ title, imageUrl, price,
  currency, retailer, sourceUrl }]`.
- Calls a shopping-search API server-side (API key stays secret in the
  function). **Caches results by normalized query** (Firestore collection, TTL)
  so repeat and bulk lookups don't re-pay.
- **Vendor is a plan-phase decision.** Candidates: SerpAPI Google Shopping
  (richest product data, priciest), Google Programmable Search Engine (cheap,
  coarser), or grounded Gemini returning URLs then `imageProxy` for the image
  (single vendor, softest accuracy). Pick during planning against cost model.
- Finishes the path `findProductListingFromPhoto` already reserved
  (`candidates: []`, `searchAvailable: false`).

### 2. `findCandidatesFromText({ brand, name })`
- Text entry into the same function, for receipt/manual items with no photo.

### 3. Candidate picker UI
- Shows 2–4 candidates (image · retailer · price) + **"None — use my photo."**
- **Colour guard:** flags/deprioritises any candidate whose dominant colour
  disagrees with the identified colour, so wrong-variant matches don't surface.
- Used inline for single captures (add flow step 1.5) and from the grid review.

### 4. Image resolution & storage
- Chosen candidate's `imageUrl` rehosted via existing `imageProxy` (images sit
  on permissive CDNs even when the page is blocked).
- Stored as `images[0]`, `imageMeta[0] = { source: 'catalogue', sourceUrl,
  retailer }`. Price/brand/name may also flow in.
- **The user's snap is always retained** as a secondary image + provenance, so
  nothing is lost and "revert to my photo" always works.

### 5. Auto-polish fallback
- Replaces today's raw-snap storage in the identify flow (`App.jsx` ~2664).
- On "None" / no-match / no confident search: run `polishItemPrimary` on the
  snap → `imageMeta[0] = { cutoutUrl, source: 'polished' }`.

### 6. Grid review screen
- After any bulk import (receipt, multi-photo), a grid of items each showing
  best-guess image (top candidate / polished snap / placeholder). Tap any → its
  candidate picker. Import completes immediately; review is optional.

## Data flow

- **Photo:** file → `identifyItemWithGemini` (fields) +
  `findProductListingFromPhoto` (query) → `productSearch` → picker → catalogue
  **or** polish → save.
- **Receipt / manual (text):** brand + name → `findCandidatesFromText` →
  `productSearch` → candidates surface in the grid review → pick **or**
  placeholder.
- **Link:** existing `fetchProductFromUrl`; if blocked / no image →
  fall back to `productSearch(brand + name)`.

## Cost & fidelity rules (non-negotiable)

- **Gate the paid call:** only auto-search when confidence ≥ medium or brand
  known; low-confidence generic items skip straight to polish (a paid search
  there won't match). "Find online" stays available manually.
- **Cache** by normalized query; **respect `checkUserMonthlyCap`** and rate
  limits; bulk searches are capped and the UI *states* when some were skipped
  (no silent truncation).
- **Never swap silently** — catalogue images only via explicit pick.
- **Fidelity:** colour-disagreeing candidates flagged; the user's own item is
  always recoverable.

## Presentation consistency

All resolved images sit on the **shared white/cream ground** established in the
Investment-by-category work, so polished packshots and catalogue shots read as
one shoot across wardrobe, insights, and lookbook.

## Out of scope

Generative image enhancement (ghost-mannequin, de-wrinkle), reverse-image
search, Gmail auto-parsing of order confirmations, per-retailer scrape adapters.
(Reverse-image search is the most likely next increment.)

## Expected phasing (for the plan)

This is large; the implementation plan should phase it, e.g.:
- **Phase 1** — `productSearch` function + candidate picker + auto-polish
  fallback on the photo-identify path. Proves the pattern end-to-end.
- **Phase 2** — text/receipt path (`findCandidatesFromText`) + grid review
  screen for bulk.
- **Phase 3** — link-import fallback to candidate search + the graceful
  placeholder / `needsImage` surfacing.

## Testing

- Pure helpers unit-tested: query normalization, candidate colour-guard, cache
  key derivation, tier-selection logic.
- `productSearch` Cloud Function tested with the search API mocked.
- Manual QA: single-capture picker, bulk grid review, polish fallback,
  placeholder, revert-to-my-photo.

## Acceptance

- No add path stores a raw wardrobe snap as the display image.
- A photo capture surfaces catalogue candidates when confidence ≥ medium/brand
  known, and a "None — use my photo" escape that polishes the snap.
- Receipt/manual items (no photo) can acquire a catalogue image via text search
  from the grid review.
- Blocked link-imports fall back to candidate search instead of dead-ending.
- Wrong-colour candidates are flagged, never silently applied.
- Paid searches are cached, gated by confidence, capped in bulk, and never
  exceed the user monthly cap silently.
- The user's original photo is always retained and restorable.
