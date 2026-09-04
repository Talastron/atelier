# Type Floor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Raise every text size in the Studio app to the 12px floor its own design system defines, and collapse eleven hand-rolled letter-spacings into three named ones.

**Architecture:** Wire the app to the design-token barrel it never consumed, register three letter-spacing tokens in `@theme`, then migrate 512 declarations across 21 files from arbitrary pixels to `text-xs` plus one of three `tracking-*` utilities. Task 1 proves the mechanism on a single site before anything is migrated in bulk.

**Tech Stack:** React 18, Vite 6, Tailwind 4, vitest 4, pnpm workspace.

**Spec:** `apps/studio/docs/superpowers/specs/2026-09-04-type-floor-design.md`

**Worktree:** `C:\Users\SibylleMoller-Sherwo\Documents\GitHub\atelier-wt-flatlay`, branch `type-floor` (stacked on `brief-flatlay`, which is stacked on `card-ground`). `cd` there and run every command from that directory. It is a git worktree: do **not** `cd` to the main checkout at `...\GitHub\atelier`, and do **not** use `git stash` — the stack is shared with other live sessions.

PowerShell 5.1 does **not** accept `&&`. Run commands separately.

Test: `pnpm --dir apps/studio test` (328 passing). Build: `pnpm --dir apps/studio build`.

---

## Read this before Task 1

**There are no tests for any of this, and that is expected.** This is CSS and JSX class strings. No view in this codebase is tested — they need a DOM and none is set up — and a test asserting a class string is present proves only that the string was typed twice. Verification is the build, the 328 existing tests staying green, mechanical greps, and the browser.

**Task 1 exists because one assumption is unproven.** The whole architecture rests on Tailwind 4 generating `tracking-meta` / `tracking-label` / `tracking-eyebrow` utilities from a `--tracking-*` namespace in `@theme`. That is believed to be true and has **not** been demonstrated in this repo. Task 1 proves it on a single site. If it turns out false, stop and report — do not migrate 512 sites against a mechanism that does not work.

**The single biggest footgun: tracking classes exist outside this migration.**

| class | uses app-wide | uses beside sub-12px type | **must not be touched** |
|---|---|---|---|
| `tracking-widest` | 265 | 215 | **50** |
| `tracking-wider` | 111 | 73 | **38** |
| `tracking-wide` | 97 | 66 | **31** |

A global find-and-replace on `tracking-widest` would restyle **119 sites that are not in scope** — labels at 12px and above, which this work explicitly does not touch. **Only rewrite a tracking class on a line where you are also rewriting the size.** If the line has no sub-12px size, leave its tracking exactly as it is.

**Work file by file, and read each line before changing it.** These are class strings inside JSX, sometimes inside template literals and ternaries. A regex sweep across the repo is not appropriate here.

---

## The mapping

Apply this at every site where a sub-12px size is present.

**Size — always:**

| current | becomes |
|---|---|
| `text-[8px]` | `text-xs` |
| `text-[9px]` | `text-xs` |
| `text-[10px]` | `text-xs` |
| `text-[11px]` | `text-xs` |

**Tracking — only on lines whose size you just changed:**

| current | becomes |
|---|---|
| `tracking-wide` | `tracking-meta` |
| `tracking-wider` | `tracking-meta` |
| `tracking-widest` | `tracking-label` |
| `tracking-[0.14em]` | `tracking-label` |
| `tracking-[0.18em]` | `tracking-eyebrow` |
| `tracking-[0.2em]` | `tracking-eyebrow` |
| `tracking-[0.22em]` | `tracking-eyebrow` |
| `tracking-[0.24em]` | `tracking-eyebrow` |
| `tracking-[0.25em]` | `tracking-eyebrow` |
| `tracking-[0.28em]` | `tracking-eyebrow` |
| `tracking-[0.3em]` | `tracking-eyebrow` |

**A line with no tracking class gets none added.** There are 9 such lines; they take `text-xs` alone.

**Responsive variants.** Five sites carry a prefixed size (`sm:text-[10px]` ×3, `sm:text-[11px]` ×2) and several pair a base size with a responsive one. The rule:

- `sm:text-[10px]` → `sm:text-xs`
- **If the responsive value is also ≤12px, the pair collapses.** `text-[10px] sm:text-xs` → `text-xs`. `text-[9px] sm:text-[10px]` → `text-xs`. `text-[8px] sm:text-[12px]` → `text-xs`. Raising the floor removes the distinction they were drawing, which is intended — leaving `text-xs sm:text-xs` in the file is just noise.
- **If the responsive value is above 12px, keep it.** `text-[10px] sm:text-sm` → `text-xs sm:text-sm`. Do not collapse this one; the step up is still real.

---

## File structure

No files are created. 21 files are modified, plus the stylesheet.

| File | sub-12px lines | Task |
|---|---|---|
| `src/index.css` | — (import + `@theme`) | 1 |
| `src/App.jsx` | 240 | 7 |
| `src/views/Calendar.jsx` | 74 | 3 |
| `src/views/InsightsView.jsx` | 56 | 4 |
| `src/views/OutfitBuilder.jsx` | 54 | 5 |
| `src/views/ProfileView.jsx` | 27 | 6 |
| `src/views/WardrobeView.jsx` | 20 | 6 |
| `src/views/InspirationView.jsx` | 7 | 2 |
| `src/views/TodayView.jsx` | 5 | 2 |
| `src/nav/Sidebar.jsx` | 3 | 2 |
| `src/components/WeekStrip.jsx` | 3 | 2 |
| `src/components/OutfitFlatLay.jsx` | 3 | 2 |
| `src/views/ShoppingDirectory.jsx` | 2 | 2 |
| `src/nav/BottomBar.jsx` | 2 | 2 |
| `src/components/TodaysPick.jsx` | 2 | 2 |
| `src/ui/toast.jsx` | 1 | 2 |
| `src/ui/Input.jsx` | 1 | 2 |
| `src/ui/EditorialHeader.jsx` | 1 | 2 |
| `src/components/WhyThisPanel.jsx` | 1 | 2 |
| `src/components/ConciergePrompt.jsx` | 1 | 1 (the proof site) |
| `src/components/AIProgressModal.jsx` | 1 | 2 |
| `src/ErrorBoundary.jsx` | 1 | 2 |
| **total** | **505 lines / 512 declarations** | |

---

### Task 1: Prove the mechanism on one site

**Files:**
- Modify: `apps/studio/src/index.css`
- Modify: `apps/studio/src/components/ConciergePrompt.jsx` (its single site)

- [ ] **Step 1: Read the current import and the `@theme` block**

Run: `sed -n '1,40p' apps/studio/src/index.css`

You will see `@import '@atelier/design-tokens/colors.css';` on line 5, followed by `@import "tailwindcss";` and an `@theme` block whose colour entries reference tokens, e.g. `--color-brass-50: var(--atelier-brass-50);`.

- [ ] **Step 2: Swap the colours-only import for the barrel**

Replace lines 1-5 of `apps/studio/src/index.css`:

```css
/* Design tokens — the single source of truth for BOTH apps. Imported so the
   @theme below can REFERENCE them instead of mirroring hexes: edit
   packages/design-tokens/colors.css once and it flows through to the app.
   (apps/marketing consumes the same package the same way.) */
@import '@atelier/design-tokens/colors.css';
```

with:

```css
/* Design tokens — the single source of truth for BOTH apps. Imported so the
   @theme below can REFERENCE them instead of mirroring hexes: edit
   packages/design-tokens/colors.css once and it flows through to the app.

   This imports the BARREL (colours + type + space), which is what
   apps/marketing has always imported. Until now the Studio took colors.css
   alone, so type.css never reached the product: the app hardcoded 512 text
   sizes below --atelier-text-xs, the floor its own scale defines. All three
   token files declare nothing but :root custom properties, so importing them
   renders nothing differently on its own — it makes the values available. */
@import '@atelier/design-tokens/index.css';
```

- [ ] **Step 3: Register the three letter-spacings in `@theme`**

Inside the existing `@theme { ... }` block in `apps/studio/src/index.css`, after the font entries, add:

```css
  /* Editorial label tracking, in three roles. The app had ELEVEN values across
     496 sites — tracking-wide through tracking-[0.3em] — which sampling showed
     were three roles that had drifted, not eleven intentions.
     --atelier-tracking-eyebrow described 45 of those 496; it captured one
     instance of the convention rather than the convention. */
  --tracking-meta:    0.05em;   /* helper text, quiet metadata */
  --tracking-label:   0.1em;    /* buttons, field labels, controls */
  --tracking-eyebrow: var(--atelier-tracking-eyebrow);  /* 0.28em — section headings */
```

- [ ] **Step 4: Migrate exactly one site**

Run: `grep -n "text-\[8px\]\|text-\[9px\]\|text-\[10px\]\|text-\[11px\]" apps/studio/src/components/ConciergePrompt.jsx`

That file has exactly one. Apply the mapping to it: the size becomes `text-xs`, and its tracking class becomes whichever of the three the mapping table dictates. Change nothing else on the line.

- [ ] **Step 5: Verify the utilities actually exist — this is the point of the task**

Start the dev server if it is not already running (check first: something may already be serving this worktree on 5173):

```bash
pnpm --dir apps/studio dev
```

Open the app, find the Concierge prompt on Today, and inspect that element. Confirm **both**:

- `font-size` computes to `12px`
- `letter-spacing` computes to the expected em value (`0.05em`, `0.1em` or `0.28em` — whichever the mapping gave it), **not** `normal`

If `letter-spacing` is `normal`, Tailwind did not generate the utility from `--tracking-*`. **STOP and report BLOCKED.** Do not proceed to Task 2. The architecture needs rethinking and finding that out here costs one site instead of 512.

- [ ] **Step 6: Build and test**

```bash
pnpm --dir apps/studio build
```

```bash
pnpm --dir apps/studio test
```

Expected: build clean, 328 tests passing.

- [ ] **Step 7: Commit**

```bash
git add apps/studio/src/index.css apps/studio/src/components/ConciergePrompt.jsx
```

```bash
git commit -m "feat(type): connect the Studio to the type scale it already had

packages/design-tokens ships a barrel of colours, type and space, and
apps/marketing has always imported it. The Studio imported colors.css
alone, so the rem-based scale - whose floor is --atelier-text-xs, 12px -
never reached the product.

Registers three letter-spacing roles in @theme and migrates one site to
prove Tailwind generates utilities from the --tracking-* namespace before
511 more depend on it.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: The fourteen small files (33 lines)

`ConciergePrompt.jsx`'s single site is **not** here — Task 1 migrated it as its proof.

**Files (modify):**
- `apps/studio/src/views/InspirationView.jsx` (7)
- `apps/studio/src/views/TodayView.jsx` (5)
- `apps/studio/src/nav/Sidebar.jsx` (3)
- `apps/studio/src/components/WeekStrip.jsx` (3)
- `apps/studio/src/components/OutfitFlatLay.jsx` (3)
- `apps/studio/src/views/ShoppingDirectory.jsx` (2)
- `apps/studio/src/nav/BottomBar.jsx` (2)
- `apps/studio/src/components/TodaysPick.jsx` (2)
- `apps/studio/src/ui/toast.jsx` (1)
- `apps/studio/src/ui/Input.jsx` (1)
- `apps/studio/src/ui/EditorialHeader.jsx` (1)
- `apps/studio/src/components/WhyThisPanel.jsx` (1)
- `apps/studio/src/components/AIProgressModal.jsx` (1)
- `apps/studio/src/ErrorBoundary.jsx` (1)

- [ ] **Step 1: List every site you are about to change**

```bash
grep -rn "text-\[8px\]\|text-\[9px\]\|text-\[10px\]\|text-\[11px\]" apps/studio/src/views/InspirationView.jsx apps/studio/src/views/TodayView.jsx apps/studio/src/nav/Sidebar.jsx apps/studio/src/components/WeekStrip.jsx apps/studio/src/components/OutfitFlatLay.jsx apps/studio/src/views/ShoppingDirectory.jsx apps/studio/src/nav/BottomBar.jsx apps/studio/src/components/TodaysPick.jsx apps/studio/src/ui/toast.jsx apps/studio/src/ui/Input.jsx apps/studio/src/ui/EditorialHeader.jsx apps/studio/src/components/WhyThisPanel.jsx apps/studio/src/components/AIProgressModal.jsx apps/studio/src/ErrorBoundary.jsx
```

Expected: 33 lines.

- [ ] **Step 2: Apply the mapping to each, file by file**

Use the mapping table at the top of this plan. For each line: change the size to `text-xs`; change the tracking class *on that line only*, per the table; add no tracking where there was none; handle responsive pairs per the collapse rule.

`OutfitFlatLay.jsx:96` is one of the 22 truncation-exposed sites (`truncate` on a brand line). Migrate it normally here — Task 8 checks whether it clips.

- [ ] **Step 3: Confirm none remain in these files**

Re-run the Step 1 command.
Expected: no output.

- [ ] **Step 4: Confirm no stray tracking values remain in them**

```bash
grep -rn "tracking-\[0\." apps/studio/src/views/InspirationView.jsx apps/studio/src/views/TodayView.jsx apps/studio/src/nav/Sidebar.jsx apps/studio/src/components/WeekStrip.jsx apps/studio/src/components/OutfitFlatLay.jsx apps/studio/src/views/ShoppingDirectory.jsx apps/studio/src/nav/BottomBar.jsx apps/studio/src/components/TodaysPick.jsx apps/studio/src/ui/toast.jsx apps/studio/src/ui/Input.jsx apps/studio/src/ui/EditorialHeader.jsx apps/studio/src/components/WhyThisPanel.jsx apps/studio/src/components/AIProgressModal.jsx apps/studio/src/ErrorBoundary.jsx
```

Any hit here is a bespoke tracking on a line whose size was **12px or above** — legitimate, out of scope, and must be left alone. Confirm by reading each hit that it has no sub-12px size. Do not "tidy" it.

- [ ] **Step 5: Build and test**

```bash
pnpm --dir apps/studio build
```

```bash
pnpm --dir apps/studio test
```

Expected: build clean, 328 passing.

- [ ] **Step 6: Commit**

```bash
git add apps/studio/src/views/InspirationView.jsx apps/studio/src/views/TodayView.jsx apps/studio/src/nav apps/studio/src/components apps/studio/src/ui apps/studio/src/ErrorBoundary.jsx apps/studio/src/views/ShoppingDirectory.jsx
```

```bash
git commit -m "feat(type): raise the small files to the 12px floor

34 sites across fifteen components and views. Sizes become text-xs, which
is 0.75rem - exactly --atelier-text-xs - so these stop being frozen
against the reader's browser text setting.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: `Calendar.jsx` (74 lines)

**Files:**
- Modify: `apps/studio/src/views/Calendar.jsx`

- [ ] **Step 1: List the sites**

```bash
grep -n "text-\[8px\]\|text-\[9px\]\|text-\[10px\]\|text-\[11px\]" apps/studio/src/views/Calendar.jsx
```

Expected: 74 lines.

- [ ] **Step 2: Note the three that need judgement**

- **Lines 523 and 528** are `text-[8px] sm:text-[12px]`. Both values are at or below the floor, so the pair **collapses to `text-xs`** — the mobile/desktop distinction they drew disappears, which is the intended consequence of the floor. Neither line has a tracking class; add none.
- **Line 1454** is `text-[9px] font-bold` on an absolutely-positioned count badge (`absolute top-1 right-1 ... rounded-full`). It has no tracking; it takes `text-xs` alone. A badge growing from 9px to 12px inside a small pill is a shape change — flag it in your report so it gets looked at.
- **Lines 1640 and 1830** are truncation-exposed (Task 8 revisits them).

- [ ] **Step 3: Apply the mapping to all 74**

- [ ] **Step 4: Confirm none remain**

Re-run Step 1's command. Expected: no output.

- [ ] **Step 5: Build and test**

```bash
pnpm --dir apps/studio build
```

```bash
pnpm --dir apps/studio test
```

Expected: build clean, 328 passing.

- [ ] **Step 6: Commit**

```bash
git add apps/studio/src/views/Calendar.jsx
```

```bash
git commit -m "feat(type): raise Calendar to the 12px floor

74 sites. The two text-[8px] sm:text-[12px] pairs collapse: both values
sit at or below the floor, so the responsive step they described no
longer exists.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: `InsightsView.jsx` (56 lines)

**Files:**
- Modify: `apps/studio/src/views/InsightsView.jsx`

- [ ] **Step 1: List the sites**

```bash
grep -n "text-\[8px\]\|text-\[9px\]\|text-\[10px\]\|text-\[11px\]" apps/studio/src/views/InsightsView.jsx
```

Expected: 56 lines.

- [ ] **Step 2: Handle the three sizes that live in variables, not `className`**

These are the only places in the whole migration where a size sits in a `const` rather than inline, so a reader scanning for `className=` will miss them. Lines 504, 505 and 507 read:

```jsx
const catCls = heroish ? 'text-xs sm:text-sm' : 'text-[9px] sm:text-[10px]';
const pctCls = heroish ? 'text-[10px] sm:text-xs' : 'text-[9px]';
const pieceCls = heroish ? 'text-[10px] sm:text-xs' : 'text-[9px]';
```

They become:

```jsx
const catCls = heroish ? 'text-xs sm:text-sm' : 'text-xs';
const pctCls = heroish ? 'text-xs' : 'text-xs';
const pieceCls = heroish ? 'text-xs' : 'text-xs';
```

Both branches of `pctCls` and `pieceCls` are now identical, so simplify each to the bare string and drop the ternary:

```jsx
const catCls = heroish ? 'text-xs sm:text-sm' : 'text-xs';
const pctCls = 'text-xs';
const pieceCls = 'text-xs';
```

Check whether `heroish` is still referenced elsewhere in that scope before assuming it is now unused — `catCls` still uses it, so it stays.

- [ ] **Step 3: Note the two responsive truncating sites**

Lines 554 and 605 are `text-[10px] sm:text-[11px] tracking-[0.25em]`. Both sizes are below the floor, so they collapse to `text-xs`, and the tracking becomes `tracking-eyebrow`.

- [ ] **Step 4: Apply the mapping to the remaining sites**

- [ ] **Step 5: Confirm none remain**

Re-run Step 1's command. Expected: no output.

- [ ] **Step 6: Build and test**

```bash
pnpm --dir apps/studio build
```

```bash
pnpm --dir apps/studio test
```

Expected: build clean, 328 passing.

- [ ] **Step 7: Commit**

```bash
git add apps/studio/src/views/InsightsView.jsx
```

```bash
git commit -m "feat(type): raise Insights to the 12px floor

56 sites, including the only three in the app where a size lives in a
const ternary rather than inline. Two of those ternaries had both
branches collapse to the same value once the floor applied, so they are
no longer ternaries.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: `OutfitBuilder.jsx` (54 lines)

**Files:**
- Modify: `apps/studio/src/views/OutfitBuilder.jsx`

- [ ] **Step 1: List the sites**

```bash
grep -n "text-\[8px\]\|text-\[9px\]\|text-\[10px\]\|text-\[11px\]" apps/studio/src/views/OutfitBuilder.jsx
```

Expected: 54 lines.

- [ ] **Step 2: Update the comment at line 2099, which documents the old sizes**

Line 2099 is not code — it is a comment describing the tab styling:

```jsx
          and Studio tabs (px-4 sm:px-5 py-3 sm:py-2 text-[10px] sm:text-xs). */}
```

It documents a class string that Task 5 is about to change, so leaving it makes the comment a lie. Update it to match whatever the tabs end up as (`text-xs` after the collapse rule):

```jsx
          and Studio tabs (px-4 sm:px-5 py-3 sm:py-2 text-xs). */}
```

- [ ] **Step 3: Note the tab buttons**

Lines 1034 and 2103 are `whitespace-nowrap ... text-[10px] sm:text-xs`. Both sizes are ≤12px, so they collapse to `text-xs`. They are `whitespace-nowrap`, so Task 8 checks them for overflow.

- [ ] **Step 4: Note lines 188 and 211**

Both are `text-[10px] tracking-[0.28em] uppercase ... truncate`. They become `text-xs tracking-eyebrow`. At 0.28em these are the widest labels in the app and they truncate — the likeliest place in the whole migration to clip. Flag them for Task 8.

- [ ] **Step 5: Apply the mapping to all 54**

- [ ] **Step 6: Confirm none remain**

Re-run Step 1's command. Expected: no output.

- [ ] **Step 7: Build and test**

```bash
pnpm --dir apps/studio build
```

```bash
pnpm --dir apps/studio test
```

Expected: build clean, 328 passing.

- [ ] **Step 8: Commit**

```bash
git add apps/studio/src/views/OutfitBuilder.jsx
```

```bash
git commit -m "feat(type): raise the Styling Studio to the 12px floor

54 sites. The tab buttons' text-[10px] sm:text-xs collapses to text-xs,
and the comment documenting that class string is updated with it rather
than left describing sizes that no longer exist.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: `ProfileView.jsx` and `WardrobeView.jsx` (47 lines)

**Files:**
- Modify: `apps/studio/src/views/ProfileView.jsx` (27)
- Modify: `apps/studio/src/views/WardrobeView.jsx` (20)

- [ ] **Step 1: List the sites**

```bash
grep -n "text-\[8px\]\|text-\[9px\]\|text-\[10px\]\|text-\[11px\]" apps/studio/src/views/ProfileView.jsx apps/studio/src/views/WardrobeView.jsx
```

Expected: 47 lines.

- [ ] **Step 2: Apply the mapping**

Three of these are truncation-exposed and revisited in Task 8: `ProfileView.jsx:1170`, `WardrobeView.jsx:766` (a `whitespace-nowrap` tab, `text-[10px] sm:text-xs` → collapses to `text-xs`), and `WardrobeView.jsx:907`.

- [ ] **Step 3: Confirm none remain**

Re-run Step 1's command. Expected: no output.

- [ ] **Step 4: Build and test**

```bash
pnpm --dir apps/studio build
```

```bash
pnpm --dir apps/studio test
```

Expected: build clean, 328 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/studio/src/views/ProfileView.jsx apps/studio/src/views/WardrobeView.jsx
```

```bash
git commit -m "feat(type): raise Profile and Wardrobe to the 12px floor

47 sites.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: `App.jsx` (240 lines)

**Files:**
- Modify: `apps/studio/src/App.jsx`

This is 47% of the migration in one file. It is mechanical, but it is long — work through it in order and do not skip ahead.

- [ ] **Step 1: List the sites**

```bash
grep -n "text-\[8px\]\|text-\[9px\]\|text-\[10px\]\|text-\[11px\]" apps/studio/src/App.jsx
```

Expected: 240 lines.

- [ ] **Step 2: Apply the mapping in passes, by size**

Work one size at a time so you can check your progress against a falling count:

```bash
grep -c "text-\[8px\]" apps/studio/src/App.jsx
```

Repeat for `[9px]`, `[10px]`, `[11px]`. Migrate one size's sites, re-run its count, confirm it reads `0`, then move to the next. This gives you four checkpoints inside a 240-site edit instead of one at the end.

- [ ] **Step 3: Note the six truncation-exposed sites**

Lines 4957, 6658, 6781, 7999, 8947 and 8970 all carry `truncate` on a brand caption. Migrate them normally; Task 8 checks them.

- [ ] **Step 4: Confirm none remain**

```bash
grep -c "text-\[8px\]\|text-\[9px\]\|text-\[10px\]\|text-\[11px\]" apps/studio/src/App.jsx
```

Expected: `0`.

- [ ] **Step 5: Confirm you did not touch out-of-scope tracking**

```bash
grep -c "tracking-widest" apps/studio/src/App.jsx
```

`tracking-widest` legitimately survives on lines whose size is 12px or above. A `0` here means you replaced them all indiscriminately — including sites this work does not cover. If it is `0`, revert and redo the tracking edits line by line.

- [ ] **Step 6: Build and test**

```bash
pnpm --dir apps/studio build
```

```bash
pnpm --dir apps/studio test
```

Expected: build clean, 328 passing.

- [ ] **Step 7: Commit**

```bash
git add apps/studio/src/App.jsx
```

```bash
git commit -m "feat(type): raise App.jsx to the 12px floor

240 sites - 47% of the migration in one file. Sizes to text-xs, and the
tracking classes on those lines only: tracking-widest survives on labels
at 12px and above, which this work does not touch.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: The truncation sweep

**Files:** whichever of the 22 sites actually clip.

Every migrated label is now roughly 20% wider. These 22 combine that with `truncate` or `whitespace-nowrap`, so they are where it shows.

- [ ] **Step 1: Confirm the list is still 22 and now uses the new classes**

```bash
grep -rn "text-xs" apps/studio/src --include=*.jsx | grep "truncate\|whitespace-nowrap" | grep "tracking-"
```

The 22 known sites are:

| file | lines |
|---|---|
| `App.jsx` | 4957, 6658, 6781, 7999, 8947, 8970 |
| `views/InsightsView.jsx` | 554, 605, 1580, 1682, 1707, 1734 |
| `views/OutfitBuilder.jsx` | 188, 211, 1034, 2103 |
| `views/Calendar.jsx` | 1640, 1830 |
| `views/WardrobeView.jsx` | 766, 907 |
| `views/ProfileView.jsx` | 1170 |
| `components/OutfitFlatLay.jsx` | 96 |

Line numbers will have shifted slightly if any edit changed line counts — locate them by content, not by number.

**Fourteen of these are the same thing**: a brand name in a card caption (`{p.brand}`, `{item.brand}`, `{s.brand}`). If it clips, it likely clips in all fourteen, and the fix belongs in whatever they share rather than fourteen separate patches.

- [ ] **Step 2: Look at each in the browser**

With the dev server running, visit each surface and check whether the label now shows an ellipsis where it did not before, or overflows its pill.

- [ ] **Step 3: Fix at the container, not the label**

Where one clips, widen or re-flow the container. **Do not** exempt the label back to a sub-12px size — that reintroduces the bespoke number this whole change removes, and the next person will find it and wonder why one label disagrees with 511 others.

If a particular label genuinely cannot fit at 12px, say so in your report rather than quietly shrinking it. That is a design decision for Sibylle.

- [ ] **Step 4: Build and test**

```bash
pnpm --dir apps/studio build
```

```bash
pnpm --dir apps/studio test
```

Expected: build clean, 328 passing.

- [ ] **Step 5: Commit (only if something changed)**

```bash
git add -u apps/studio/src
```

```bash
git commit -m "fix(type): give the wider labels room rather than shrinking them

A 12px label at 0.28em is about a fifth wider than the 10px it replaced.
Fixed at the containers; no label goes back below the floor.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

If nothing clipped, skip the commit and say so.

---

### Task 9: Final verification

**Files:** none.

- [ ] **Step 1: No sub-12px sizes remain anywhere**

```bash
grep -rn "text-\[8px\]\|text-\[9px\]\|text-\[10px\]\|text-\[11px\]" apps/studio/src --include=*.jsx --include=*.js
```

Expected: no output.

- [ ] **Step 2: The three new utilities are actually used**

```bash
grep -rho "tracking-meta\|tracking-label\|tracking-eyebrow" apps/studio/src --include=*.jsx | sort | uniq -c
```

Expected, approximately: `tracking-meta` ~139, `tracking-label` ~216, `tracking-eyebrow` ~141. Small deviations are fine — the band counts were measured per declaration and some lines carry two. A count near zero for any of them means a whole band was mapped wrongly.

- [ ] **Step 3: Out-of-scope tracking survived**

```bash
grep -rho "tracking-widest\|tracking-wider\|tracking-wide\b" apps/studio/src --include=*.jsx | sort | uniq -c
```

Expected: roughly 50 `tracking-widest`, 38 `tracking-wider`, 31 `tracking-wide` — the 119 uses that sit on type at 12px and above. **Zero would mean the migration overreached** into sites it was never meant to touch.

- [ ] **Step 4: Build and test**

```bash
pnpm --dir apps/studio build
```

```bash
pnpm --dir apps/studio test
```

Expected: build clean, 328 passing.

- [ ] **Step 5: Report the numbers**

State the final counts from Steps 1-3 explicitly. Do not say "verified" without them.

---

### Task 10: Sibylle looks at it

**Files:** none — this is the review, and it is the only verification that means anything for a change of this kind.

- [ ] **Step 1: Serve the branch from the worktree**

The dev server must run from `atelier-wt-flatlay`, not the main checkout. Serving the wrong tree has already caused confusion twice in this project — and note that the port tells you nothing about which tree is being served. Check the path Vite prints on startup.

```bash
pnpm --dir apps/studio dev
```

- [ ] **Step 2: Walk the app**

Today, Wardrobe, the Styling Studio, Calendar, Insights, Profile, a look detail, the Daily Brief. Roughly 496 labels have changed size and spacing, so nearly every screen differs.

Look for:
- labels that now clip or wrap where they did not
- badges and pills that have lost their shape around bigger text
- anywhere the new tracking looks wrong for the role — a button that reads like a section heading, or vice versa
- whether the app still reads as the same product

- [ ] **Step 3: Test the thing this was really about**

Raise the browser's text size (Chrome: Settings → Appearance → Font size, or Ctrl+`+` for full zoom). Before this change, 512 sizes ignored that setting entirely. They should now grow with it.

- [ ] **Step 4: Report before tuning**

Say what you see rather than what to change. The band-to-role mapping is an approximation and some sites will be misfiled; those are individual corrections, not a reason to revisit the three roles.

---

## Notes for whoever executes this

- **Task 1 is a gate, not a warm-up.** If `letter-spacing` computes to `normal`, stop.
- **Never rewrite a tracking class on a line you are not also resizing.** 119 legitimate uses sit on larger type and are out of scope.
- **Do not add tests.** Views and CSS; no view here is tested, and asserting a class string proves only that it was typed twice.
- **Do not merge, push, or deploy.** This branch is stacked on `brief-flatlay`, which is stacked on `card-ground`, and all three are held for review together.
- **Report counts, not adjectives.** Every verification step in this plan produces a number. Give the number.
