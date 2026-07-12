# Wishlist Price-Watch — Design Spec

**Date:** 2026-07-12
**Status:** Spec — approved direction, phased build
**Builds on:** the link-import enrichment pipeline (App Check-gated `pageProxy`
Cloud Function + the Schema.org/OG price parser in `src/lib/net.js`). No new
third parties; every fetch is first-party, consistent with the 2026-07 privacy
hardening that removed anonymous CORS proxies.

---

## 1. The promise (user language)

> "Atelier watches the pieces you're considering, and tells you when waiting
> paid off."

The wishlist stops being a static list and becomes a **considered-purchase
instrument**: every wishlist item imported by link keeps its product URL; the
studio re-reads the retailer's own published price and surfaces movement —
quietly, in the brand's editorial voice. No urgency-marketing, no "BUY NOW":
the register is *patience rewarded*.

## 2. Why it fits the brand

- **Saving money is a core pillar** — this makes the wishlist demonstrably
  cheaper than impulse buying, with receipts.
- **Considered wardrobe** — a deliberate 'watch, then decide' ritual is the
  opposite of fast-fashion checkout urgency.
- **Data moat** — per-user price histories against their own wishlist compound
  into the "was it worth it" dataset nothing else has.

## 3. Data model

Extend the wishlist item (no new collection needed for P1/P2):

```js
item.priceWatch = {
  enabled: true,            // per-item toggle, default ON for link imports
  sourceUrl,                // already stored on the item
  listPrice: 128.00,        // price at import (baseline)
  currency: 'GBP',
  lastPrice: 96.00,         // most recent successful read
  lastCheckedAt: ISOString,
  drops: [                  // append-only, capped at ~24 entries
    { at: ISOString, price: 96.00 }
  ],
  status: 'ok' | 'unavailable' | 'parse-failed',  // page gone / no JSON-LD
}
```

Price history stays small (one entry per *change*, not per check) so item docs
stay comfortably under Firestore limits.

## 4. Phases

### P1 — "Check price now" (client-only, ~half a day)
A button on the wishlist item card / editor. Reuses the exact import path:
`pageProxy` fetch → JSON-LD/OG parse → compare against `listPrice` → write
`priceWatch`. UI: a quiet brass line on the card — *"£128 → £96 · checked
today"*. Failure states degrade politely ("the shop no longer lists this").

**This ships value immediately with zero backend work** and exercises the
parser across her real wishlist retailers before anything is scheduled.

### P2 — Scheduled sweep (server, ~1–2 days)
A scheduled Cloud Function (daily, 06:00 Europe/London) sweeps all
`priceWatch.enabled` wishlist items across users. Reuses the same fetch+parse
logic as `pageProxy` **directly in the function** (no HTTP hop, no App Check
needed server-side). Budget guards: max N items/user/day, jittered fetches,
per-domain rate limiting, and skip-after-3-consecutive-failures.

### P3 — Surfacing drops (in-app, ~1 day)
- **Needs Attention** card (the right-rail pattern already exists): *"The
  pleat-detail dress you're watching dropped 25% at Hobbs."*
- Wishlist segment badge and a small price-history line on the item sheet
  (sparkline only if ≥3 points — otherwise prose: "down £32 since June").
- Concierge awareness: drops join the context the stylist sees, so it can say
  "the coat you're watching is finally sensible."

### P4 — The letter (email, later)
A monthly "watching brief" folded into the newsletter infrastructure once
MailerLite is live — never per-drop emails; the register is a considered
digest, not alerts.

## 5. Edge cases & rules

- **Sale ends / price rises:** record it; show "back to £128" without drama.
  Never nudge urgency on rises.
- **Out of stock / page removed:** `status: 'unavailable'`, stop checking
  after 3 failures, surface once ("this piece has left the shop").
- **Currency changes** (retailer geo-redirects): if currency ≠ baseline
  currency, mark `parse-failed` rather than compare apples to pears.
- **JSON-LD missing:** fall back to OG price tags (parser already does);
  otherwise `parse-failed` quietly.
- **Owned items:** price-watch is wishlist-only. Watching prices of things you
  already bought is regret-farming; explicitly out of scope.

## 6. Cost & quotas

Fetch volume = wishlist items with URLs (typically < 30/user) × 1/day. At
current scale this is pennies of Cloud Functions time. The existing per-user
AI caps are untouched — this feature uses no LLM calls at all (P3's Concierge
mention rides existing context, adding ~50 tokens).

## 7. Success measures

- % of wishlist items with `priceWatch` data (target: all link imports)
- Drops surfaced → items purchased at lower price (the "saved £X" number —
  which itself becomes shareable, GTM-friendly proof)
- P1 button usage as the demand signal for scheduling P2
