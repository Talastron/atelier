# Editing Today's Look Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let someone change one piece of today's look instead of discarding it and recomposing the whole thing.

**Architecture:** An Edit button on the Daily Brief opens the Styling Studio seeded with today's look — a route that already exists and lost its button when the tile grid became a flat-lay. The seed gains a `fromBrief` marker; when it is set, the Studio's save becomes "Update today's look", which writes the amended brief back rather than filing a Lookbook copy.

**Tech Stack:** React 18, Vite 6, Tailwind 4, vitest 4, Firebase (Firestore).

**Spec:** `apps/studio/docs/superpowers/specs/2026-09-05-edit-todays-look-design.md`

**Worktree:** `C:\Users\SibylleMoller-Sherwo\Documents\GitHub\atelier-wt-flatlay`, branch `brand-caption-fit`. Run every command from that directory. It is a git worktree: do **not** `cd` to the main checkout, and do **not** use `git stash` — the stack is shared with other live sessions.

PowerShell 5.1 does **not** accept `&&`. Run commands separately.

Test: `pnpm --dir apps/studio test` (**370 passing** at the start of this plan). Build: `pnpm --dir apps/studio build`.

---

## Read this before Task 1

**Most of this already exists.** `DailyBriefCard` still declares `onOpenOutfit` and `TodayView` still passes it from `onOpenBrief`, which seeds the Studio and switches tab. `OutfitBuilder` already fills its slots from `seedOutfit`. The work is the marker, the changed save, and the write-back — not a new editor.

**A hook rule this branch has already broken once.** `DailyBriefCard` returns early when there is no brief. A hook added below those returns crashed the app with "Rendered fewer hooks than expected" earlier today. **No task here adds a hook**, but if you find yourself reaching for one, it goes at the top of the component with the others, never beside the markup that uses it.

**The views are not tested and that is expected.** No view in this codebase is tested — they need a DOM and none is set up. `amendBrief` is pure and carries the coverage. A green test run says nothing about whether the markup parses: a JSX syntax error passed 367 tests on this branch. Always run the build too.

---

## File structure

| File | Responsibility | Change |
|---|---|---|
| `src/lib/brief.js` | **New.** Amend a brief after an edit | Create |
| `src/lib/brief.test.js` | **New.** Its tests | Create |
| `src/views/TodayView.jsx` | The Daily Brief card | One Edit button |
| `src/App.jsx` | Owns `studioSeed`, the user, the tab | Seed marker + write-back handler |
| `src/views/OutfitBuilder.jsx` | The Styling Studio | Update path when seeded from the brief |

---

### Task 1: `amendBrief`

**Files:**
- Create: `apps/studio/src/lib/brief.js`
- Create: `apps/studio/src/lib/brief.test.js`

- [ ] **Step 1: Write the failing tests**

Create `apps/studio/src/lib/brief.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { amendBrief } from './brief.js';

const base = {
  itemIds: ['a', 'b', 'c'],
  reasoning: 'The Oxford Shirt with the Chinos.',
  intent: 'today',
  savedAt: 1757000000000,
};

describe('amendBrief', () => {
  it('replaces the item ids', () => {
    const next = amendBrief(base, ['a', 'b', 'z'], base.reasoning);
    expect(next.itemIds).toEqual(['a', 'b', 'z']);
  });

  it('keeps everything else on the brief', () => {
    const next = amendBrief(base, ['a'], null);
    expect(next.intent).toBe('today');
    expect(next.savedAt).toBe(1757000000000);
  });

  it('keeps a note that only names surviving pieces', () => {
    // referencedItemIds reads chip markup, so a note naming no ids at all
    // cannot contradict the look and is always safe to keep.
    const next = amendBrief(base, ['a', 'b', 'c'], 'A considered look for today.');
    expect(next.reasoning).toBe('A considered look for today.');
  });

  it('drops a note that names a piece the look no longer holds', () => {
    // The Brief renders its note with tappable item chips, so a stale note
    // does not merely read oddly — it offers a chip for a garment that is
    // no longer in the look.
    const note = 'Try the [[item:c|Chelsea Saddle Bag]] with it.';
    const next = amendBrief(base, ['a', 'b'], note);
    expect(next.reasoning).toBeUndefined();
  });

  it('leaves a brief with no note without one', () => {
    const noNote = { itemIds: ['a'], intent: 'today' };
    const next = amendBrief(noNote, ['a', 'b'], null);
    expect('reasoning' in next).toBe(false);
  });

  it('does not mutate the brief it was given', () => {
    const next = amendBrief(base, ['x'], null);
    expect(base.itemIds).toEqual(['a', 'b', 'c']);
    expect(next).not.toBe(base);
  });

  it('survives rubbish input', () => {
    expect(amendBrief(null, ['a'], null).itemIds).toEqual(['a']);
    expect(amendBrief(base, null, null).itemIds).toEqual([]);
  });
});
```

**Before writing the implementation, check the chip syntax.** The fourth test assumes `referencedItemIds` recognises `[[item:c|Name]]`. Confirm against the real parser:

```bash
sed -n '1,40p' apps/studio/src/lib/lookNote.js
```

If the syntax differs, **fix the test to match the code**, not the other way round — and say so in your report.

- [ ] **Step 2: Run them and watch them fail**

```bash
pnpm --dir apps/studio test
```

Expected: `Cannot find module './brief.js'`.

- [ ] **Step 3: Implement**

Create `apps/studio/src/lib/brief.js`:

```js
import { noteIsStale } from './lookNote.js';

/**
 * The brief as it stands after an edit in the Styling Studio.
 *
 * Drops the stylist's note when it names a piece the look no longer holds.
 * The Brief renders that note with tappable item chips, so a stale one does
 * not just read oddly — it offers a chip for a garment that is not there.
 * The Studio already applies this rule when saving a look; the Brief needs it
 * more, for that reason.
 *
 * Everything else on the brief is preserved, including fields added later:
 * this amends a brief, it does not rebuild one.
 */
export function amendBrief(brief, itemIds, note) {
  const ids = Array.isArray(itemIds) ? itemIds : [];
  const next = { ...(brief || {}), itemIds: ids };
  if (note && !noteIsStale(note, ids)) next.reasoning = note;
  else delete next.reasoning;
  return next;
}
```

- [ ] **Step 4: Run them and watch them pass**

```bash
pnpm --dir apps/studio test
```

Expected: green, **377 tests** (370 + 7).

```bash
pnpm --dir apps/studio build
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add apps/studio/src/lib/brief.js apps/studio/src/lib/brief.test.js
```

```bash
git commit -m "feat(today): amend a brief after an edit, dropping a stale note

The Brief renders its stylist's note with tappable item chips, so a note
naming a piece that has been swapped out does not merely read oddly - it
offers a chip for a garment no longer in the look. noteIsStale already
guards saved looks; this applies the same rule to the brief.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: The Edit button

**Files:**
- Modify: `apps/studio/src/views/TodayView.jsx` — the actions row, which begins `{/* Actions */}` followed by `<div className="mt-6 flex flex-wrap gap-2.5">`

- [ ] **Step 1: Read the row**

```bash
sed -n '611,650p' apps/studio/src/views/TodayView.jsx
```

The actions row begins `{/* Actions */}` followed by `<div className="mt-6 flex flex-wrap gap-2.5">`, and holds "Wear this" (primary, solid stone-900), "Compose another" (secondary, outlined), then the save/share controls.

Note there is a **second** `composeAnother` button higher in the file, around line 413, in the auto-failed error state. That one is not the actions row — do not add Edit beside it.

- [ ] **Step 2: Add the button directly after "Compose another"**

`onOpenOutfit` is already a prop of `DailyBriefCard` (line ~114) and is already supplied by `TodayView` from `onOpenBrief`. Nothing new is threaded.

Insert immediately after the closing `</button>` of "Compose another":

```jsx
        {/* Edit — the route this uses already existed and lost its button when
            the tile grid became a flat-lay: every tile used to call
            onOpenOutfit, which seeds the Styling Studio with today's look.
            Compose another discards the whole look for a fresh AI call; this
            keeps the pieces you like and lets you change the rest.

            Secondary styling, matching Compose another exactly: they are the
            two ways to change your mind about the same look, and one should
            not shout louder than the other. */}
        <button
          type="button"
          onClick={() => onOpenOutfit?.(brief)}
          className="rounded-full border border-stone-300 px-5 py-2.5 text-sm transition-colors hover:bg-stone-50"
        >
          Edit
        </button>
```

That className is "Compose another"'s, minus its `disabled:` variant — Edit has no disabled state.

- [ ] **Step 3: Build and test**

```bash
pnpm --dir apps/studio build
```

```bash
pnpm --dir apps/studio test
```

Expected: clean, **377 passing** — this task adds none.

- [ ] **Step 4: Check it in the browser**

Something is likely already serving this worktree on port 5173. Confirm the path Vite printed rather than trusting the port. If not:

```bash
pnpm --dir apps/studio dev
```

On Today, press Edit. Expected: the Styling Studio opens with today's pieces already in their slots. At this point saving there still creates a Lookbook look — the update path is Task 4.

- [ ] **Step 5: Commit**

```bash
git add apps/studio/src/views/TodayView.jsx
```

```bash
git commit -m "feat(today): an Edit button beside Compose another

Compose another discards the whole look and spends an AI call. This keeps
the pieces you like and opens the Studio to change the rest.

The route already existed: onOpenOutfit is still declared and still
supplied, and seeds the Studio with today's look. Every tile in the old
grid called it, and it lost its only caller when the tiles became a
flat-lay.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: The seed marker and the write-back

**Files:**
- Modify: `apps/studio/src/App.jsx` — the `onOpenBrief` prop passed to `TodayView` (around line 1634), and a new handler beside it

- [ ] **Step 1: Mark the seed**

Find the line (there is one for `TodayView` and a second for `WardrobeView`; **change only the `TodayView` one** — the Wardrobe's Brief link is not an edit):

```bash
grep -n "onOpenBrief={(brief)" apps/studio/src/App.jsx
```

Change the `TodayView` occurrence from:

```js
onOpenBrief={(brief) => { setStudioSeed({ ...brief, id: brief.savedAt ?? Date.now() }); setActiveTab('outfits'); }}
```

to:

```js
// fromBrief is the whole mechanism: without it the Studio cannot tell this
// session from opening any saved look, and Save would file a Lookbook copy
// instead of updating today.
onOpenBrief={(brief) => { setStudioSeed({ ...brief, id: brief.savedAt ?? Date.now(), fromBrief: true }); setActiveTab('outfits'); }}
```

- [ ] **Step 2: Add the write-back handler**

`App.jsx` already imports `readDailyBrief` / `writeDailyBrief` — confirm, and add `writeRemoteDailyBrief` if it is not already imported:

```bash
grep -n "readDailyBrief\|writeDailyBrief\|writeRemoteDailyBrief" apps/studio/src/App.jsx | head
```

Add `amendBrief` to the imports:

```js
import { amendBrief } from './lib/brief.js';
```

Then, near the other handlers in the same component that owns `studioSeed`:

```js
  // Called by the Studio when a session that began as "Edit today's look" is
  // saved. Updates the brief in place rather than filing a Lookbook copy —
  // saving a look stays the separate, deliberate act it already is.
  const handleUpdateBrief = async ({ itemIds, note }) => {
    const uid = user?.uid;
    if (!uid) return;
    const current = readDailyBrief(uid);
    if (!current) return;
    const next = amendBrief(current, itemIds, note);
    writeDailyBrief(uid, next);
    try { await writeRemoteDailyBrief(uid, next); }
    catch (e) { console.warn('[brief] remote update failed, local stands:', e?.message); }
    setStudioSeed(null);
    setActiveTab('today');
    toast.show('Today\'s look updated', { kind: 'success' });
  };
```

**The remote write is allowed to fail quietly.** The local brief is what Today reads on mount; a failed sync should not block the user or lose their edit. The compose path treats it the same way — check how it handles `writeRemoteDailyBrief` and match it.

- [ ] **Step 3: Pass it to the Studio**

Find where `<OutfitBuilder` is rendered in `App.jsx` and add:

```jsx
onUpdateBrief={handleUpdateBrief}
```

The prop is unused until Task 4 — that is fine and harmless.

- [ ] **Step 4: Build and test**

```bash
pnpm --dir apps/studio build
```

```bash
pnpm --dir apps/studio test
```

Expected: clean, **377 passing**.

- [ ] **Step 5: Commit**

```bash
git add apps/studio/src/App.jsx
```

```bash
git commit -m "feat(today): mark a brief-seeded studio session, and write the edit back

The seed gains fromBrief, which is the whole mechanism - without it the
Studio cannot tell this session from opening any saved look.

handleUpdateBrief amends the stored brief, writes it locally and syncs
remotely, then returns to Today. The remote write is allowed to fail
quietly: the local brief is what Today reads on mount, and a failed sync
must not lose the edit.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: The Studio's update path

**Files:**
- Modify: `apps/studio/src/views/OutfitBuilder.jsx` — the component signature (line ~238), the seed effect (~309-326), `canSave` (~1343), `handleSave` (~535), and the two save buttons (~1308, ~1465)

- [ ] **Step 1: Accept the prop and remember the origin**

Add `onUpdateBrief = null` to `OutfitBuilder`'s props.

The seed effect at lines 309-326 consumes `seedOutfit` and then calls `onSeedConsumed()`. The `fromBrief` flag must survive that, so record it in state:

```js
  const [editingBrief, setEditingBrief] = useState(false);
```

and inside the seed effect, alongside the existing slot-filling:

```js
    setEditingBrief(!!seedOutfit.fromBrief);
```

Add the state declaration **with the other `useState` calls at the top of the component**, not beside the effect.

- [ ] **Step 2: Let the update path save without a name**

`handleSave` begins:

```js
    if (!outfitName.trim() || picked.length === 0) return;
```

A brief has never had a name, and requiring one would make the user title something they are not filing. Change to:

```js
    // A brief has no name and never has. Requiring one here would make the
    // user title something they are not filing in the Lookbook.
    if (picked.length === 0) return;
    if (!editingBrief && !outfitName.trim()) return;
```

- [ ] **Step 3: Branch the save**

Immediately after the guard above, before the `const orig = …` line:

```js
    if (editingBrief && onUpdateBrief) {
      // The note the Studio is holding, which amendBrief will drop if the
      // edit has made it name a piece that is no longer in the look.
      await onUpdateBrief({ itemIds: picked.map((p) => p.id), note: aiNote || null });
      setEditingBrief(false);
      return;
    }
```

Confirm `handleSave` is `async` before adding an `await`; if it is not, make it so and check its callers do not depend on a synchronous return.

- [ ] **Step 4: Change what the button says**

`canSave` at line ~1343 reads:

```js
              const canSave = outfitName.trim() && pieceCount > 0;
```

Change to:

```js
              const canSave = pieceCount > 0 && (editingBrief || outfitName.trim());
```

Both save buttons (~1308 and ~1465) should read **"Update today's look"** when `editingBrief` is true, and keep their current label otherwise. For the primary one at ~1465:

```jsx
                      <Save size={18} strokeWidth={1.5} /> {editingBrief ? 'Update today\'s look' : 'Save Look'}
```

Read the button at ~1308 and apply the same conditional to its label.

- [ ] **Step 5: Build and test**

```bash
pnpm --dir apps/studio build
```

```bash
pnpm --dir apps/studio test
```

Expected: clean, **377 passing**.

- [ ] **Step 6: Confirm the ordinary path is untouched**

Open the Styling Studio directly (not via Edit) and confirm: the button still says "Save Look", it is still disabled without a name, and saving still creates a Lookbook entry. **If any of that changed, the branch is leaking into normal sessions.**

- [ ] **Step 7: Commit**

```bash
git add apps/studio/src/views/OutfitBuilder.jsx
```

```bash
git commit -m "feat(studio): update today's look instead of filing a copy

When the session was seeded from the Daily Brief, Save becomes 'Update
today's look': it amends the brief and returns to Today rather than
creating a Lookbook entry. Saving a look stays the separate act it
already is, still available from the Brief's own button.

The name requirement does not apply on this path. A brief has never had a
name, and demanding one would make the user title something they are not
filing.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Sibylle looks at it

**Files:** none — her review, and the only check that matters for whether this feels right.

- [ ] **Step 1: Serve the branch from the worktree**

Check the path Vite prints on startup; the port does not tell you which tree is being served.

- [ ] **Step 2: The round trip**

Today → **Edit** → the Studio opens with today's pieces in their slots → swap one → **Update today's look** → you land back on Today.

Confirm:

- the Brief shows the amended look, not the original
- the piece you swapped in is there and the one you removed is gone
- **the stylist's note does not name the piece you removed** — this is the case `amendBrief` exists for. If the note is gone entirely, that is correct behaviour, not a bug
- no new Lookbook entry was created

- [ ] **Step 3: Check the ordinary Studio still behaves**

Open the Styling Studio from the nav, compose something, and confirm Save still says "Save Look", still needs a name, and still files it in the Lookbook.

- [ ] **Step 4: Report before tuning**

Say what you saw. Two known open questions from the spec: the Studio may be a big trip for one swap, and there is no undo — Compose another has none either.

---

## Notes for whoever executes this

- **Most of this exists.** The Studio already accepts the brief and fills its slots; the button already had a caller once. Do not build an editor.
- **Do not add hooks below early returns.** This branch already shipped that crash once.
- **Always run the build, not just the tests.** A JSX syntax error passed 367 tests on this branch.
- **The ordinary Studio path must be untouched.** Task 4 Step 6 checks it.
- **Do not merge, push, or open a PR.** This branch already has an open PR (#89); commit and stop.
