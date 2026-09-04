# Daily Brief Flat-Lay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the Daily Brief's outfit as a flat-lay with credits, using the same component the look detail already uses, instead of a grid of white tiles.

**Architecture:** `OutfitFlatLay` already exists inside `App.jsx` and already pairs the composition with a credits list. Task 1 moves it to `components/` unchanged so it can be imported; Task 2 swaps it into the Brief in place of the tile grid, the desktop tier widths and the jewellery strip, and deletes what that makes dead.

**Tech Stack:** React 18, Vite 6, vitest 4, Tailwind 4.

**Spec:** `apps/studio/docs/superpowers/specs/2026-09-04-brief-flatlay-design.md`

**Worktree:** `C:\Users\SibylleMoller-Sherwo\Documents\GitHub\atelier-wt-flatlay`, branch `brief-flatlay`. `cd` there and run every command from that directory — `pnpm --dir apps/studio ...` only resolves from the worktree root. It is a git worktree: do **not** `cd` to the main checkout at `...\GitHub\atelier`, and do **not** use `git stash` (the stack is shared with other live sessions).

Test: `pnpm --dir apps/studio test` (328 passing). Build: `pnpm --dir apps/studio build`.

---

## Read this before Task 1

**There are no tests for any of this, and that is expected.** Both files are React views, and no view in this codebase is tested — they need a DOM and none is set up. The verification is the build, the existing 328 tests staying green, and reading the diff.

**The look detail is the control.** Task 1 moves a component without changing it, and the look detail renders that component today. If the extraction alters anything, it shows there — on a surface whose current appearance is known-good — before it ever shows on the Brief. Check it first.

**Do not rewrite the component while moving it.** It is tempting to tidy something in a 100-line block being relocated. Don't: a move whose diff is pure relocation can be verified by eye in seconds, and one that also edits cannot.

---

## File structure

| File | Responsibility | Change |
|---|---|---|
| `src/components/OutfitFlatLay.jsx` | **New.** The composition plus its credits list | Moved verbatim from `App.jsx:8624-8728` |
| `src/App.jsx` | The look detail, among much else | Delete the local definition, import instead |
| `src/views/TodayView.jsx` | Today, including `DailyBriefCard` | Replace the tile block; delete what it orphans |

---

### Task 1: Move `OutfitFlatLay` out of `App.jsx`

**Files:**
- Create: `apps/studio/src/components/OutfitFlatLay.jsx`
- Modify: `apps/studio/src/App.jsx:8616-8728` (the comment and the function), and its import block

- [ ] **Step 1: Read the component and its comment**

Run: `sed -n '8616,8728p' apps/studio/src/App.jsx`

Lines 8616-8623 are its block comment; 8624-8728 the function. Both move.

- [ ] **Step 2: Create the new file**

Create `apps/studio/src/components/OutfitFlatLay.jsx` containing, in order:

```jsx
import React from 'react';
import { Shirt, ChevronRight } from 'lucide-react';
import Flatlay from './Flatlay.jsx';
import ItemTileImage from './ItemTileImage.jsx';
import { itemColors, itemImages } from '../lib/items.js';
```

then the block comment and the whole function body from `App.jsx:8616-8728`, **copied without modification**, with `function OutfitFlatLay(` changed to `export default function OutfitFlatLay(`.

**Read the block and list its dependencies yourself rather than trusting the five above.** An earlier draft of this plan claimed there were exactly three, "verified by scanning the block" — the scan was a regex matching names beginning `item`, or literally `Flatlay`, or `use`, so it could not match `ItemTileImage`, `Shirt` or `ChevronRight` and confidently reported their absence. Following it would have produced a component with three undefined references.

- [ ] **Step 3: Delete the definition from `App.jsx` and import instead**

Delete lines 8616-8728 from `apps/studio/src/App.jsx`.

Add to the import block at the top of `App.jsx`, beside the other component imports:

```js
import OutfitFlatLay from './components/OutfitFlatLay.jsx';
```

- [ ] **Step 4: Confirm the definition is gone and the import is in**

Run: `grep -c "^function OutfitFlatLay" apps/studio/src/App.jsx`
Expected: `0`

Run: `grep -c "import OutfitFlatLay" apps/studio/src/App.jsx`
Expected: `1`

Run: `grep -n "<OutfitFlatLay" apps/studio/src/App.jsx`
Expected: one hit, around line 7979 — the look detail's use, unchanged.

- [ ] **Step 5: Remove the import the move orphans**

`OutfitFlatLay` was the **only** thing in `App.jsx` using `Flatlay` — one use, at what is now line 8645. Once the component leaves, the import on line 30 is dead:

```js
import Flatlay from './components/Flatlay.jsx';
```

Delete that line. Confirm first, and confirm after:

```bash
grep -c "Flatlay" apps/studio/src/App.jsx
```

Before deleting the import this should be `2` — the import and the new `<OutfitFlatLay` usage. After, `1`.

**`itemColors` and `itemImages` stay.** Both are used throughout `App.jsx` and only once each inside the moved block — 10 and 14 mentions respectively, one apiece here. Removing either would break the file. Do not "tidy" them.

- [ ] **Step 6: Build and test**

Run: `pnpm --dir apps/studio build && pnpm --dir apps/studio test`

Expected: build clean, 328 tests passing. A green build here proves the module parses; it does not prove the component renders.

- [ ] **Step 7: Read the diff**

Run: `git diff apps/studio/src/App.jsx`

The diff should be a deletion and an added import — nothing else. If it shows a modification inside the moved block, the move was not a move.

- [ ] **Step 8: Commit**

```bash
git add apps/studio/src/components/OutfitFlatLay.jsx apps/studio/src/App.jsx
git commit -m "refactor(flatlay): move OutfitFlatLay where a second surface can use it

Its own comment says a look is arranged identically here and on the
Lookbook card. It could not be, because it lived inside App.jsx and could
not be imported - so the Daily Brief drew its own grid of tiles instead.
Moved unmodified; the look detail is the control and should be pixel
identical.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Render the Brief as a flat-lay

**Files:**
- Modify: `apps/studio/src/views/TodayView.jsx` — the tile block at 580-625, and the code it orphans

- [ ] **Step 1: Import the component**

In `apps/studio/src/views/TodayView.jsx`, beside the existing component imports (near line 12):

```js
import OutfitFlatLay from "../components/OutfitFlatLay.jsx";
```

- [ ] **Step 2: Replace the tile block**

Replace lines **580-625** — from `<div className="mt-5">` through its closing `</div>`, which includes the mobile grid, the desktop flex row and the jewellery strip — with:

```jsx
      {/* The look, composed the way every other surface composes one.
          
          This was three separate hierarchies: a two-column grid on mobile, a
          centred row on desktop with garments at one width and accessories at
          another, and a full-width jewellery strip underneath. All three
          existed to stop small pieces being lost among large ones — which
          composeFlatlay already handles, anatomically, with per-piece caps so
          jewellery never renders coat-sized. Keeping both would be two
          hierarchies disagreeing.
          
          The credits list is what the tiles were also doing: naming the pieces.
          On a card telling you what to wear this morning, knowing the third
          item is your Chelsea Saddle Bag rather than a brown shape is
          information, so the composition alone would not have been enough. */}
      <div className="mt-5">
        <OutfitFlatLay pieces={briefItems} onOpenItem={onOpenItem} />
      </div>
```

`briefItems` is already resolved at line 441. `onOpenItem` is already a prop of `DailyBriefCard` (line 115) — it is what the stylist's-note chips use — so nothing new is threaded.

Note this also changes what a tap does. Every tile called `openBrief`, so tapping the shoes and tapping the coat did the same thing; `OutfitFlatLay` opens the piece that was tapped.

- [ ] **Step 3: Delete what that orphans**

Four things are now unused. Verify each is unreferenced before deleting it, then delete:

```bash
grep -n "mainTiles\|jewelleryPieces\|renderLookCard\|GARMENT_CATS\|imgOf" apps/studio/src/views/TodayView.jsx
```

Expected after Step 2: each name appears only at its own definition.

- `GARMENT_CATS` — the `const` at line 452
- `imgOf` — the helper at line 453
- `mainTiles` — line 457
- `jewelleryPieces` — line 458
- `renderLookCard` — the whole function, lines 477-505

Delete all five. Keep `briefItems` (line 441) — it is used by the new call and by the wear toast at line 528.

- [ ] **Step 4: Fix the imports the deletions orphan**

`itemDisplayName` was used only by `renderLookCard`. Confirm and remove it from the import on line 4:

```bash
grep -c "itemDisplayName" apps/studio/src/views/TodayView.jsx
```

Expected `1` after Step 3 — the import alone. Remove it from that import statement.

**`ItemTileImage` stays.** It is still used by `DailyDigest` at lines 744 and 759. Confirm with:

```bash
grep -c "ItemTileImage" apps/studio/src/views/TodayView.jsx
```

Expected `3` — the import plus those two uses. If it is `1`, something else was deleted by mistake.

- [ ] **Step 5: Build and test**

Run: `pnpm --dir apps/studio build && pnpm --dir apps/studio test`

Expected: build clean, 328 passing.

- [ ] **Step 6: Read the diff for names that resolve**

Run: `git diff apps/studio/src/views/TodayView.jsx`

Confirm `briefItems` and `onOpenItem` are both in scope at the new element — `briefItems` is a `const` in `DailyBriefCard`, `onOpenItem` is one of its props. Vite bundles unresolved identifiers happily and they fail only at runtime, so the build passing proves nothing about either.

- [ ] **Step 7: Commit**

```bash
git add apps/studio/src/views/TodayView.jsx
git commit -m "feat(today): the Daily Brief shows a look, not a list of it

Phase one put the flat-lay everywhere a look appears - Lookbook card,
look detail, share image. The Brief is a fourth surface and was not on
the list, so the app's centrepiece still drew rounded-2xl white tiles at
aspect-3/4: phase one's own problem statement word for word.

Three hierarchies go with it - a mobile grid, a desktop row with two tier
widths, and a jewellery strip - all of which existed to stop small pieces
being lost among large ones, which composeFlatlay already does with
per-piece caps.

Tapping a piece now opens that piece. Every tile called openBrief, so
tapping the shoes and tapping the coat did the same thing.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Look at it

**Files:** none — this is Sibylle's review, and it is the only verification that means anything here.

- [ ] **Step 1: Serve the branch**

The dev server must run from the worktree, not the main checkout — the main checkout is a separate, older tree and serving it has already caused confusion once today. In a terminal:

```bash
cd C:/Users/SibylleMoller-Sherwo/Documents/GitHub/atelier-wt-flatlay
```

```bash
pnpm --dir apps/studio dev
```

PowerShell 5.1 does not accept `&&`, so these are two commands.

- [ ] **Step 2: Check the control first**

Open a saved look from the Lookbook. **It must be unchanged.** Task 1 moved a component without editing it, and this is the surface that proves it. If the look detail differs at all, stop — the extraction was not clean, and the Brief will have inherited whatever went wrong.

- [ ] **Step 3: Check the Brief**

On Today, the Daily Brief should show one composition with credits beneath, on both desktop and a narrow window. Look for:

- the composition reading as an outfit rather than a row of plates
- every piece named in the credits — nothing lost with the jewellery strip
- tapping a piece opening **that** piece
- how much taller the card is, and whether the concierge bar, week strip and digest below still sit comfortably

- [ ] **Step 4: Report before tuning**

The card growing taller is the known cost and was accepted in the spec. If it is too much, the lever is the credits list's density, not the composition — say what you see rather than what to change.

---

## Notes for whoever executes this

- **The look detail is the control and must be checked first.** A clean extraction is invisible there; a dirty one shows up there before the Brief.
- **Do not add tests.** Both files are views, no view here is tested, and a test that fakes a DOM to assert a component was called proves nothing.
- **Do not merge or deploy.** Open the PR and stop.
