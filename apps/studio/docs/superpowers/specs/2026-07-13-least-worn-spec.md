# Least Worn — Design Spec

**Date:** 2026-07-13
**Status:** Spec — approved feature, P1 build
**Pillar:** wear what you own · a considered, not accumulating, wardrobe
**Related:** the existing "Stale — wear or part with?" panel and "Unworn this
season" panel in `InsightsView.jsx`

---

## 1. The promise (user language)

> "What have I worn least?" should mean *"what should I actually reach for
> next"* — not a list padded with the winter coat you can't wear in July, or
> the dress you bought last week and haven't had an occasion for yet.

**Revised premise (superseded the original draft of this spec):** Insights
already has a panel built for exactly this question —
"Stale — wear or part with?" (`InsightsView.jsx:1211-1216`, rendered at
`:1742-1760`), "Owned items not worn in 90+ days." It has two real bugs that
match this complaint precisely:

1. **No purchase-date awareness.** A never-worn item satisfies the filter
   (`_days === null`) the moment it exists, regardless of whether it was
   bought yesterday or three years ago. A coat bought this week and a coat
   neglected for years show up identically.
2. **No season awareness.** The filter is a pure "not worn in 90+ days"
   lifetime check — a winter coat reads as "stale" every single summer.

There is a *separate* "Unworn this season · try one" panel
(`InsightsView.jsx:1286-1310`, rendered `:1500-1545`) that is already
season-aware, but it doesn't check purchase date either, and it answers a
different question (season rotation, not overall neglect).

The original draft of this spec proposed a brand-new "Least worn" panel.
That would have sat right next to "Stale" showing a near-identical list —
confusing, not additive. **The correct fix is to patch the two bugs in the
existing "Stale" panel in place**, not add a third overlapping one. In the
Concierge chat, the model is separately only ever given the **top 8
most-worn** items (`ai.js`, `generateConciergeReply`) — no least-worn signal
at all — so a typed "what have I worn least" question there is answered from
a bare name list with zero wear data, effectively a guess. That half of the
fix (feeding real data into chat) is unaffected by this revision.

## 2. The fix — two added guards on the existing `stale` filter

Current filter (`InsightsView.jsx:1212-1216`):

```js
const stale = ownedItems
  .map((i) => ({ ...i, _days: daysSinceLastWorn(i) }))
  .filter((i) => i._days === null || i._days >= 90)
  .sort((a, b) => (b._days ?? Infinity) - (a._days ?? Infinity))
  .slice(0, 6);
```

Add two guards to the `.filter(...)`, keeping the existing sort and cap of 6
unchanged:

1. **Owned 90+ days** — `item.createdAt` older than 90 days. Deliberately
   the SAME threshold as the panel's own "not worn in 90+ days" language
   (not a different, arbitrary number) — it would be incoherent to call
   something "not worn in 90 days" when it hasn't even been owned that long.
2. **Currently in-season** — `itemSeasons(item)` is empty (meaning "any
   season," always eligible) OR its seasons list includes the current
   season. An item that fails this check is excluded entirely, not shown
   with a caveat — everything left in the list should be a genuine
   "wear this soon" candidate.

**Shared season helper.** The "what season is it right now" calculation
(`month >= 2 && month <= 4 ? 'Spring' : …`) is currently duplicated inline in
four places (`App.jsx` ×2, `OutfitBuilder.jsx` ×2, `weather.js`). This fix is
a fifth/sixth consumer of that same calculation (both `InsightsView.jsx`,
which already computes a season name for the separate "Unworn this season"
panel — reuse that existing local computation directly rather than adding a
new import there — and `ai.js`'s Concierge prompt, which does not yet have
one), so `ai.js`'s use gets one shared helper in `lib/items.js` (e.g.
`currentSeasonLabel()`) rather than adding another inline copy. The four
existing call sites in `App.jsx`/`OutfitBuilder.jsx`/`weather.js` are not
touched or migrated — out of scope; this only stops the count from growing.

No title/copy change to the panel — "Stale — wear or part with?" already
describes the fixed behaviour accurately; it just stops being wrong.

## 3. Surfaces

- **Insights panel:** the existing "Stale" panel, patched in place per §2.
  No new panel, no visual change beyond the list now containing correct
  items.
- **Concierge chat:** the same (now-fixed) stale list — item names plus
  "never worn" / days-since-worn — is passed into `generateConciergeReply`'s
  prompt in `ai.js`, as a new `LEAST WORN (in season, owned 90+ days): …`
  line sitting next to the existing `MOST WORN PIECES` line. Purely additive
  prompt context; no change to the AI's reasoning behaviour otherwise.

## 4. What this deliberately does not do

- No new UI panel or component.
- No AI judgment in computing the list — the model only narrates it in chat
  when asked, exactly as it already narrates `MOST WORN PIECES` today.
- No changes to "Worst value · cost per wear" or "Unworn this season" — both
  are separate, already-working panels, untouched by this fix.
- No migration of the four pre-existing inline season calculations to the
  new shared helper — only the new `ai.js` use adopts it.

## 5. Success measure

Qualitative: the "Stale" panel stops surfacing brand-new or out-of-season
items; a typed "what have I worn least" question in the Concierge chat
produces a grounded, specific answer instead of a generic non-answer.

Related: `lib/items.js` (`itemWearCount`, `itemSeasons`, `daysSinceLastWorn`),
`views/InsightsView.jsx` (`stale`, `seasonName`), `lib/ai.js`
(`generateConciergeReply`).
