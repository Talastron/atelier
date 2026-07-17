# "Needs attention" — Structure and Presentation (Phase 1) — Design

**Date:** 2026-07-17
**Status:** Approved (design), pending implementation plan
**Component:** `DailyDigest` in `apps/studio/src/views/TodayView.jsx`, plus `apps/studio/src/components/WeekStrip.jsx`

## Problem

The "Needs attention" card on Today concatenates **seven unrelated card kinds** into one flat list:

| kind | what it is | nature |
|---|---|---|
| `planned-today` | today's planned outfit | a schedule, not a task |
| `planned-tomorrow` | tomorrow's planned outfit | a schedule, not a task |
| `care` (max 3) | care due on a piece | a chore |
| `stale-fav` | a favourite unworn 30+ days | wardrobe health |
| `price-drop` (max 3) | wishlist price drop in last 7 days | a shopping opportunity |
| `overdue` (max 3) | a lent piece past its return date | genuinely urgent |
| `inspo-unanalysed` | 3+ unanalysed inspirations | housekeeping |

Three concrete faults follow:

1. **No urgency ordering.** Cards are concatenated in fixed source order, so a lent piece three days overdue renders *below* three "8 wears since care" reminders. The most urgent item is pushed down by the least urgent.
2. **Identical visual weight.** Every kind renders through the same `Row` — same size, same layout — distinguished only by a small icon tint. "Someone still has your bag" looks exactly like "your shorts could use a wash".
3. **Off-palette, in a way already fixed elsewhere.** `overdue` uses `bg-red-100 text-red-700`; `index.css` introduced `--color-claret-*` explicitly to "replace saturated web-red … so the warning stays in the brass/stone luxury palette instead of shouting like an iOS notification". That fix reached Insights and missed this component. `price-drop` uses `bg-emerald-100 text-emerald-800` — emerald is not in the palette at all.

Additionally the rows are text-only, in an app that is otherwise entirely image-led.

## Goal

Keep the section's breadth — it remains the one morning glance — but give it structure: grouped by theme, with the groups ordered by urgency, richer per-row context, the actual piece shown, and visual weight that matches severity.

## Scope: Phase 1 of 3

This design covers **presentation only**. It introduces no new persisted state and no mutations.

- **Phase 2 (separate spec):** inline actions — "Mark as cleaned", "Returned" — which *resolve* cards rather than hide them.
- **Phase 3 (separate spec):** dismiss / snooze. Deliberately last: these cards are **derived, not stored** (a care card is computed from wear count; there is no card entity), so dismissal needs a card-identity key, an expiry rule, and local+Firestore persistence. Phase 2's actions resolve most cards, so Phase 3 may prove unnecessary — building it first risks building the wrong thing.

## Design

### 1. Plans move out of the digest

`planned-today` and `planned-tomorrow` are schedules, not attention. They leave `DailyDigest` and surface on `WeekStrip`, which sits directly beside it and already knows the day has a plan — but only renders it as an anonymous dash, never naming the outfit.

- `WeekStrip` gains an `outfits` prop and a compact line beneath the 7-day strip naming today's plan, and tomorrow's when present, each tappable to open that outfit. Copy follows the existing card format, e.g. `Today · Warm Cobbles, Afternoon Light`, using `schedules[iso].eventName` when set (matching the current `Today · {eventName}` label logic).
- The day cells are unchanged — at roughly 1/7 of the card width they cannot carry an outfit name.
- `DailyDigest` consequently sheds its `outfits` and `onOpenOutfit` props, narrowing its interface to the things it actually reports on.

### 2. Theme groups, ordered by urgency

The five remaining kinds map to five themes with a **fixed urgency rank**, so an urgent item can never be buried inside a low-priority theme:

| rank | theme | kinds | tone |
|---|---|---|---|
| 1 | On loan | `overdue` | claret (urgent) |
| 2 | Care | `care` | quiet |
| 3 | Wardrobe | `stale-fav` | quiet |
| 4 | Wishlist | `price-drop` | quiet |
| 5 | Inspiration | `inspo-unanalysed` | quiet |

- Empty themes are omitted entirely.
- If only **one** theme has content, its header is omitted too — a single header over a single group labels nothing.
- Within a theme, existing per-kind caps (3 care, 3 drops, 3 overdue) are unchanged.
- Header style reuses the existing eyebrow: `text-[10px] tracking-[0.2em] uppercase text-stone-400` — the same treatment as the card's own "5 ITEMS" count and "JEWELLERY · 3 PIECES" elsewhere. It costs ~14px, so grouping adds negligible height and reads as native.

### 3. Grouping pays for the thumbnails

Because the theme header now carries the *kind*, each row no longer needs its icon — which frees that exact slot for the piece itself.

- The leading visual becomes the item's photo via the existing `ItemTileImage` component (`components/ItemTileImage.jsx`), at the row's current `w-8 h-8` footprint with `rounded-lg`.
- `inspo-unanalysed` has no item; it uses the inspiration's own image, falling back to its current `Bookmark` icon when the inspiration has none.
- Net effect on density: neutral. The thumbnail occupies the slot the icon vacated.

### 4. Richer context — from data already returned

No new computation or data is needed.

- **Care:** `itemCareReminder(item)` already returns `everyN` alongside `material` and `wearsSince`. Sub-line becomes `{material} · {wearsSince} wears since care · usually every {everyN}` — stating *why* it is flagged, not just that it is.
- **Overdue:** unchanged — `Lent to {lentTo} · {n} days overdue`.
- **Stale favourite:** unchanged — `Favourite · {n} days since last wear` / `Favourite · never worn`.
- **Price drop:** unchanged — `Price dropped {n}% · now £{price}`.
- **Inspiration:** unchanged.

### 5. Palette and visual weight

- `overdue` moves from `bg-red-100 text-red-700` to the claret ramp (`bg-claret-50 text-claret-700`), the treatment `index.css` defines for restrained alerts and which Insights already uses.
- `price-drop` moves from `bg-emerald-100 text-emerald-800` to the brass ramp, matching the palette.
- Only the rank-1 theme (On loan) carries a tint; every other theme stays stone/brass and quiet. Severity is legible at a glance without any row shouting.
- Out of scope: the other emerald usages elsewhere in `TodayView.jsx` (a different component, unrelated to this card).

## Architecture

The grouping and ordering logic is **pure** and must be extracted so it can be tested — `DailyDigest` is a React component in a project with no component-test harness, so logic left inside it is untestable by construction.

- **New:** `apps/studio/src/lib/digest.js` — exports `DIGEST_THEMES` (the ranked theme list, each with its `id`, `label`, and the kinds it holds) and `groupDigestCards(cards)`, a pure function taking the existing flat `cards` array and returning `[{ theme, label, cards }]`, ranked, with empty themes omitted. No React, no Firebase — mirroring `lib/outfit.js`.
- **New:** `apps/studio/src/lib/digest.test.js` — unit tests for the above.
- **Modified:** `TodayView.jsx` — `DailyDigest` builds its `cards` array as it does today (minus the two plan kinds), passes it through `groupDigestCards`, and renders groups. Row rendering gains the thumbnail and the care sub-line.
- **Modified:** `WeekStrip.jsx` — new `outfits` prop and the plan footer.

`DailyDigest` keeps deriving its cards inline; only the grouping is extracted. Moving the whole derivation would be a larger refactor than this goal warrants.

## Data flow

```
TodayView
  ├─ WeekStrip({ events, schedules, outfits, onSelectDay, onOpenOutfit })
  │    └─ names today's / tomorrow's planned outfit beneath the strip
  └─ DailyDigest({ items, schedules, inspirations, onOpenItem, onOpenInspiration, onOpenInspirationTab })
       ├─ derive cards (care, stale-fav, price-drop, overdue, inspo) — unchanged
       ├─ groupDigestCards(cards) → ranked, non-empty groups   ← pure, tested
       └─ render group header (omitted if only one group) + rows with thumbnails
```

## Error handling

- `groupDigestCards` ignores cards whose `kind` matches no theme rather than throwing, so an unknown or future kind can never crash Today. Unknown kinds are dropped; the pure helper is the single place this is decided.
- `ItemTileImage` already handles a missing image internally; rows do not add their own fallback.
- `WeekStrip`'s plan line renders nothing when `schedules[iso]` is absent or its `outfitId` no longer resolves against `outfits` — the same defensive resolve `DailyDigest` does today.
- `DailyDigest` continues to return `null` when there are no cards at all, so the two-up layout still collapses to a full-width week strip.

## Testing

- **Unit (`lib/digest.test.js`):** `groupDigestCards` ranks On loan above Care above Wardrobe above Wishlist above Inspiration regardless of input order; omits empty themes; preserves within-theme input order; drops unknown kinds; returns `[]` for no cards. Crucially, a test pins the reported bug directly: given an `overdue` card supplied *after* three `care` cards, On loan still ranks first.
- **Not unit-tested:** the rendering, `WeekStrip`, and the thumbnail — no React component harness exists in this project, consistent with every other view.
- **Manual:** with a wardrobe carrying an overdue lent piece plus care-due pieces, confirm On loan renders first with claret; confirm thumbnails show the actual pieces; confirm a single-theme day shows no header; confirm today's plan now names the outfit under the week strip and no longer appears in the digest.

## Non-goals (YAGNI)

- No inline actions (Phase 2), no dismiss/snooze (Phase 3).
- No change to which cards are derived, or to the existing per-kind caps.
- No change to the Insights view, despite `stale-fav` overlapping its Stale panel — Insights is reflective ("The Dossier"), Today is actionable. The duplication is intentional framing, not an accident.
- No new persisted state, no Firestore schema change, no new dependencies.

## Open questions

None. Structure (theme groups ranked by urgency), plan relocation (to `WeekStrip`), and Phase 1 scope (presentation only) are all confirmed with the user.
