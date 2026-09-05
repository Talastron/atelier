# Editing today's look, rather than recomposing it

**Date:** 2026-09-05
**Status:** design agreed, not yet planned
**Origin:** *"on the daily outfit look, in addition to Compose another, can we also have an edit button? Sometimes I only want to swap one piece…!"*

The Daily Brief offers one way to change its mind: **Compose another**, which discards the whole look and spends an AI call to build a new one. There is no way to keep four pieces you like and change the fifth.

---

## What exists already

**The route is already built, and its only caller was removed.** `DailyBriefCard` still declares `onOpenOutfit` (line 114) and `TodayView` still passes it (line 902) from `onOpenBrief`, which does:

```js
onOpenBrief={(brief) => { setStudioSeed({ ...brief, id: brief.savedAt ?? Date.now() }); setActiveTab('outfits'); }}
```

Every tile in the old grid called it. When the tiles became a flat-lay the route lost its button, and the plumbing was left in place deliberately, pending this decision.

**The Studio already loads a brief into per-category slots.** `OutfitBuilder` consumes `seedOutfit` at lines 309-326: it fills the slots from `seedOutfit.itemIds` and adopts its reasoning as the AI note. That *is* a swap-one-piece interface — drag a piece out of a slot, put another in.

**But nothing writes back.** The Studio saves a look into the Lookbook. Today's brief lives in `dailyBrief.js` (`readDailyBrief` / `writeDailyBrief`, with `writeRemoteDailyBrief` for sync) and nothing in the Studio touches it. Without a write-back you would swap the trousers, save, return to Today and find the original composition unchanged — which is not what "swap one piece" means.

**The stale-note guard already exists.** `noteIsStale` in `lookNote.js` stops the Studio persisting a `reasoning` that names a garment the look no longer contains, with a comment observing that otherwise "the falsehood outlives the edit".

---

## Decisions

### Edit opens the Studio, seeded — it does not build a new picker

The Studio is the piece-swapping tool, it already accepts the brief, and it brings drag-and-drop, the Concierge and A/B compare with it.

Rejected: **swapping in place on the Brief** — tap a piece, choose a replacement from the same category, never leave Today. Lighter for the single-swap case, which is the case that was asked for. Rejected because it means a second piece-picker in an app that already has one, plus a new rule for what counts as a valid alternative, and the two would drift the way the two view toggles did. If the Studio proves too heavy a trip for one swap, that is worth learning from use rather than pre-empting.

### The seed carries its origin, and that marker is the whole mechanism

`setStudioSeed({ ...brief, id: …, fromBrief: true })`. Without it the Studio cannot tell this session from opening any saved look, and every behaviour below hangs off it.

### Save updates today's brief, and only that

When the session came from the Brief, the Studio's save action becomes **"Update today's look"**: it amends the brief and returns to Today. It does not also file a copy in the Lookbook.

Saving to the Lookbook remains what it has always been — a separate, deliberate act, still available from the Brief's own "Save as a Look" button.

Rejected: **doing both on one press** — nothing is lost and the user never has to think, but it quietly creates a Lookbook entry every time a piece is tweaked, filling the Lookbook with near-duplicates of one day. Rejected: **two buttons** — the most explicit and most flexible, at the cost of another control in a toolbar that already has several, and it turns the common case into a decision.

### The Studio does not learn where briefs are stored

The write-back is a callback. `OutfitBuilder` gains an optional `onUpdateBrief(payload)` and calls it instead of `saveOutfit` when `seedOutfit.fromBrief` was set. `App.jsx` supplies it, because `App` already owns `studioSeed`, the user, and the tab.

### The stale note is dropped, and it matters more here than in the Lookbook

The Brief's stylist's note names pieces **by name** and renders them as tappable chips via `renderTextWithChips`. Swap the chinos and an unguarded note still reads "paired with Chinos", with a chip pointing at a garment no longer in the look.

So the amendment reuses `noteIsStale`: if the note names a piece the amended look no longer contains, the note is dropped rather than shown. A brief with no note is a known, handled state; a brief with a lying note is not.

---

## Architecture

### `src/lib/brief.js` — new, pure

```js
/**
 * The brief as it stands after an edit in the Studio.
 *
 * Drops the stylist's note when it names a piece the look no longer holds.
 * The note is rendered with tappable item chips, so a stale one does not just
 * read oddly — it offers a chip for a garment that is no longer there.
 */
export function amendBrief(brief, itemIds, note) { … }
```

Returns a new brief object: `itemIds` replaced, `reasoning` kept only when `!noteIsStale(note, itemIds)`, everything else on the brief preserved (`intent`, `savedAt`, and any fields added later).

### `src/views/OutfitBuilder.jsx`

Gains `onUpdateBrief = null`. When `seedOutfit.fromBrief` was consumed, the save button's label becomes "Update today's look" and its handler calls `onUpdateBrief({ itemIds, note })` rather than `saveOutfit`. The existing save path is untouched for every other session.

**The name requirement does not apply on this path.** Saving a look refuses to proceed on `!outfitName.trim()`, because a look in the Lookbook needs a name to be findable. A brief is not a saved look — it is today's suggestion, and it has never had a name. Requiring one here would make the user title something they are not filing. The update path checks only that at least one piece is present.

### `src/App.jsx`

- The seed gains `fromBrief: true` at line 1634.
- A new `onUpdateBrief` handler: `amendBrief` the stored brief, `writeDailyBrief(uid, next)`, `writeRemoteDailyBrief(uid, next)`, then `setActiveTab('today')`.

### `src/views/TodayView.jsx`

One **Edit** button beside "Compose another", calling `onOpenOutfit(brief)`.

No refresh plumbing: `TodayView` reads the brief on mount and the view wrapper is keyed on `activeTab`, so returning to Today remounts it and re-reads storage. **The plan verifies this rather than assuming it** — if the key does not remount, the brief would show stale until reload.

---

## Testing

`amendBrief` is pure and carries the coverage:

- item ids are replaced
- a note naming only surviving pieces is kept
- a note naming a removed piece is dropped
- `intent` and other fields survive the amendment
- a brief with no note stays without one
- rubbish input (null brief, empty ids) does not throw

No view tests — no view in this codebase is tested, and asserting a button renders proves only that JSX was typed twice.

The rest is verified by using it: edit, swap one piece, update, and confirm Today shows the amended look with a note that does not name the piece you removed.

---

## Non-goals

- **No in-place swapping on the Brief.** See the rejected option above.
- **No new picker, and no rule for "valid alternatives".** The Studio's existing wardrobe picker is the picker.
- **No change to Compose another**, or to the Brief's Save / Wear this / share actions.
- **No change to how the Studio behaves for any session not seeded from the Brief.**
- **No undo.** Compose another has none either; the brief is a day's suggestion, not a document.

---

## Risks

| Risk | Handling |
|---|---|
| Editing feels like too big a trip for one swap | It reuses the tool that exists; if it proves heavy, in-place swapping is the known alternative and this design records why it was not built first |
| The amended brief does not appear on return | `TodayView` re-reads on mount and the wrapper is keyed on `activeTab`; the plan verifies this rather than assuming |
| A stale note survives the edit | `noteIsStale` already exists and is reused; a test covers the dropped-note case |
| Save's changed meaning confuses | The label changes with it — "Update today's look", not "Save" — and it only differs when arriving via Edit |
| The remote brief and local brief diverge | Both are written, as the compose path already does |
