# Daily Brief Freshness — Design

**Date:** 2026-07-16
**Status:** Approved (design), pending implementation plan

## Problem

The Daily Brief ("what to wear today") recommends essentially the same outfit
every day — the same top and trousers, with only minor variance in shoes and
jewellery. Root cause: the daily auto-compose calls `generateOutfitWithGemini`
with near-identical inputs each day (same wardrobe, same intent "a considered
look for today", same style profile, same season) and the prompt tells the
model to *prefer ★favourite pieces* and build "the most coherent look". With
stable inputs and a "pick the best" instruction, the model deterministically
anchors to the same clothing base. Nothing in the daily compose signals that
the look should differ from recent days: `previousOutfit` is only populated for
the within-day "Compose another" action, never for the daily auto-compose.

## Goal

The daily brief should **feel fresh each day** — specifically, a *different
clothing base* (a different top+bottom, or a different dress) from the last few
days — while remaining coherent, weather-appropriate, and everyday-appropriate.
Freshness is the objective; wardrobe utilisation ("wear my least-worn pieces")
is explicitly *not* a goal here (that would surface occasion pieces such as a
rarely-worn cocktail dress, which is wrong for an everyday brief).

## Non-goals (YAGNI)

- No hard candidate exclusion (removing recent bases from the list the model
  sees). Rejected: risks empty or incoherent looks on small wardrobes.
- No least-worn / utilisation rotation. Rejected: wrong goal; surfaces
  occasion pieces.
- No cranked temperature. Variety comes from the shifting recent-set + nudge,
  not from added randomness; the existing 0.7 stays.

## Approach — soft anti-repetition nudge

Keep a short rolling history of the last **3 days'** brief *base* garments, and
pass those recent bases to the model with an instruction to build today's look
on a different base. The nudge is a *preference*, subordinate to the existing
non-negotiable weather and complete-the-look rules.

### Components

1. **Rolling brief history (new).** Helpers in `dailyBrief.js`:
   - Local cache: `localStorage` key `atelier.dailyBrief.recent.{uid}` holding
     `[{ dateKey, baseIds }]`, most-recent-first, capped at 3 entries and
     pruned of entries whose `dateKey` is not among the last 3 distinct days.
   - Shared source of truth: Firestore doc
     `users/{uid}/state/dailyBriefHistory` → `{ recent: [{dateKey, baseIds}],
     savedAt }`, same shape and cap. Mirrors the existing local↔Firestore
     dual-store pattern already used for the brief itself
     (`readDailyBrief`/`readRemoteDailyBrief`).
   - `baseIds` = the item ids of the composed look whose category is a clothing
     base (`Dresses`, `Tops`, `Bottoms`). Accessories/shoes/bags are not
     tracked — they are allowed to repeat.

   New functions (pure list logic is unit-tested with an injectable clock):
   - `readRecentBases(uid)` — local read, returns `[{dateKey, baseIds}]`.
   - `appendRecentBase(uid, baseIds, now?)` — prepend today's entry (replacing
     any existing entry for today's `dateKey`), cap to 3, write local; returns
     the new list.
   - `readRemoteRecentBases(uid)` — async Firestore read.
   - `writeRemoteRecentBases(uid, list)` — async Firestore write.
   - A pure merge helper `mergeRecent(a, b, todayKey)` — dedupe by `dateKey`,
     most-recent-first, cap 3 — used to combine remote + local before compose.

2. **Wire into compose (`views/TodayView.jsx`).**
   - Before composing: gather recent bases (remote merged with local), resolve
     the ids to item objects against `ownedAvailable`, and pass them as a new
     `recentLooks` argument to `onGenerateOutfit` → `generateOutfitWithGemini`.
     Unresolvable ids (item deleted since) are dropped.
   - After a successful compose (both the daily auto-compose and "Compose
     another"): compute the base ids of the result (filter `itemIds` to items
     whose category is a clothing base), then `appendRecentBase(uid, baseIds)`
     locally and `writeRemoteRecentBases(uid, merged)`.

3. **Prompt additions (`lib/ai.js`, `generateOutfitWithGemini`).** New optional
   param `recentLooks = []`. Two additions to the prompt string:
   - **Freshness block** — emitted only when `recentLooks.length > 0`:
     lists the recent base garments and instructs: build today's look on a
     *different* clothing base (a different top+bottom or dress); shoes, bags
     and jewellery may repeat if they genuinely complete the new look, but the
     core garments should differ from those recent looks; if the wardrobe is
     too small to avoid all of them, differ at least from the most recent day.
   - **Everyday-appropriateness line** — always emitted: default to
     everyday-appropriate pieces; reserve Occasion-tagged / eveningwear
     (Cocktail, Evening / Gown) pieces for days whose calendar events call for
     them. This leans on the `styles=` and sub-category data already present in
     each item summary (`STYLES` includes `Occasion`; dress sub-categories
     include `Cocktail` and `Evening / Gown`). It is the guard against the
     "occasion dress on a normal Tuesday" failure mode.
   - Both blocks are phrased as preferences and placed so they do not override
     the existing NON-NEGOTIABLE weather rules or the complete-the-look
     (base-garment) requirement.

### Data flow

```
DailyBriefCard mount (new day)
  → read recent bases: mergeRecent(readRemoteRecentBases, readRecentBases)
  → resolve baseIds → items (drop missing)
  → onGenerateOutfit({ ..., recentLooks })
      → generateOutfitWithGemini({ ..., recentLooks })   // freshness + everyday blocks
  → writeDailyBrief(local) + writeRemoteDailyBrief(Firestore)   // unchanged
  → baseIds = itemIds ∩ base categories
  → appendRecentBase(local) + writeRemoteRecentBases(Firestore)  // NEW
```

`readDailyBrief` / per-day brief caching is unchanged — the freshness history
is a separate, additive store.

### Error handling

- All Firestore reads/writes are best-effort (try/catch → fall back to local),
  matching the existing `readRemoteDailyBrief`/`writeRemoteDailyBrief`. Offline
  or permission failure degrades to local-only history; the brief still
  composes.
- Empty history (first days, or history unavailable) → no freshness block →
  normal compose. No error path.
- `localStorage` failures are swallowed (matching the existing helpers).

### Testing

- **Unit (`dailyBrief.test.js`):** `appendRecentBase` caps at 3 and replaces a
  same-day entry rather than duplicating it; `mergeRecent` dedupes by `dateKey`,
  orders most-recent-first, and caps at 3; `readRecentBases` returns `[]` when
  empty or on parse failure. Uses the existing injectable-`now` pattern.
- **Not unit-tested (consistent with `ai.js`):** the prompt string assembly —
  guarded structurally by the `recentLooks.length > 0` condition.
- **Manual:** compose, then use "Compose another" / simulate day rollover 3+
  times and confirm the clothing base changes each time; confirm an occasion
  dress is not chosen for an ordinary (no-event) day.

### Files touched

- `apps/studio/src/dailyBrief.js` — new recent-history helpers (local +
  Firestore) and `mergeRecent`.
- `apps/studio/src/dailyBrief.test.js` — tests for the pure helpers.
- `apps/studio/src/views/TodayView.jsx` — read recent bases before compose,
  pass `recentLooks`, append base after compose (both compose paths).
- `apps/studio/src/lib/ai.js` — `recentLooks` param + freshness block +
  everyday-appropriateness line in `generateOutfitWithGemini`.

## Open questions

None outstanding. History depth = 3 days; history synced across devices via
Firestore (both confirmed with the user).
