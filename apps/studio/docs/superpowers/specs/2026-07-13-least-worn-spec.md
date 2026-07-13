# Least Worn — Design Spec

**Date:** 2026-07-13
**Status:** Spec — approved feature, P1 build
**Pillar:** wear what you own · a considered, not accumulating, wardrobe
**Related:** the existing "Best/Worst value · cost per wear" panels in `InsightsView.jsx`

---

## 1. The promise (user language)

> "What have I worn least?" should mean *"what should I actually reach for
> next"* — not a list padded with the winter coat you can't wear in July, or
> the dress you bought last week and haven't had an occasion for yet.

Today, this question has two different, both-incomplete answers depending on
where it's asked. In the Concierge chat, the model is only ever given the
**top 8 most-worn** items (`ai.js`, `generateConciergeReply`) — it has no
wear-count data for anything else, so a "least worn" question is answered
from a bare name list with zero wear signal, effectively a guess. In
Insights, the closest existing feature is "Worst value · cost per wear"
(`InsightsView.jsx:1220-1226`), which is price-driven (items over £50) and
already excludes anything bought in the last 6 months — but has no concept
of season, so an out-of-season item looks exactly as "wasted" as a genuinely
neglected one.

## 2. Computation (deterministic — no AI call)

Filter owned, non-deleted items to those that are:

1. **Owned 60+ days** — `item.createdAt` older than 60 days. Reuses the exact
   convention already established by Worst Value's 6-month cutoff, shortened
   because this is a gentler "you should wear this" nudge, not a waste
   callout on money spent.
2. **Currently in-season** — `itemSeasons(item)` is empty (meaning "any
   season," always eligible) OR its seasons list includes the current
   season. An item that fails this check is excluded from the list entirely,
   not shown with a caveat — the list should only ever contain genuine
   "wear this soon" candidates.

Sort survivors by wear count ascending. Break ties (commonly several
"never worn" items) by days-owned descending — an item owned a year and
never worn is a more useful flag than one bought two months ago that simply
hasn't come up yet. Cap at 5, matching Worst Value's existing cap.

**Shared season helper.** The "what season is it right now" calculation
(`month >= 2 && month <= 4 ? 'Spring' : …`) is currently duplicated inline in
four places (`App.jsx` ×2, `OutfitBuilder.jsx` ×2, `weather.js`). This
feature is a fifth/sixth consumer of that same calculation, so it gets
extracted into one shared helper in `lib/items.js` (e.g.
`currentSeasonLabel()`) rather than adding a seventh copy. The four existing
call sites are not touched or migrated — that's out of scope here; this only
stops the count from growing.

## 3. Surfaces

- **Insights panel:** a new "Least worn" card in `InsightsView.jsx`, sitting
  alongside the existing Best/Worst value cards, in the same visual language
  (thumbnail, name, brand, "never worn" / "N wears", "owned Xmo"). Fully
  deterministic — computed client-side from data already loaded, same as its
  neighbouring panels.
- **Concierge chat:** the same computed list (name × wear count, capped at
  5–8 items) is passed into `generateConciergeReply`'s prompt in `ai.js`,
  as a new `LEAST WORN (in season, owned 60+ days): …` line sitting next to
  the existing `MOST WORN PIECES` line. This is additive prompt context only
  — no change to the AI's reasoning behaviour otherwise.

## 4. What this deliberately does not do

- No AI judgment in computing the list — the model only narrates it in chat
  when asked, exactly as it already narrates `MOST WORN PIECES` today.
- No changes to the existing Worst Value panel, its 6-month cutoff, or its
  price-based framing — this is a separate, complementary panel.
- No migration of the four pre-existing inline season calculations to the
  new shared helper — only new code uses it.
- No "wears per month owned" rate-based ranking (considered and rejected in
  favour of the simpler hard-cutoff approach, for consistency with the
  existing Worst Value convention).

## 5. Success measure

Qualitative: does a typed "what have I worn least" question in the
Concierge chat produce a grounded, specific answer (naming actual low-wear,
in-season, not-brand-new pieces) instead of a generic non-answer.

Related: `lib/items.js` (`itemWearCount`, `itemSeasons`, `daysSinceLastWorn`),
`views/InsightsView.jsx` (Best/Worst value panels), `lib/ai.js`
(`generateConciergeReply`).
