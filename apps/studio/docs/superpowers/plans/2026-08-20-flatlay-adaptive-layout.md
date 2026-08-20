# Flat-lay Adaptive Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a look fill its card by replacing eight fixed zones with a weighted tree that prunes slots for garments the look does not contain.

**Architecture:** `ZONES` — a table of hard-coded rectangles — becomes `LAYOUT`, a tree of columns and rows carrying weights rather than positions. Slots with no pieces are pruned, surviving weights renormalise over the freed space, and finishing pieces are capped so they cannot grow to garment size. Non-overlap and frame-containment become properties of the structure rather than things we test for.

**Tech Stack:** Plain ES modules, vitest 4. No new dependencies. No DOM, no images — `flatlay.js` stays pure geometry.

**Spec:** `apps/studio/docs/superpowers/specs/2026-08-20-flatlay-adaptive-layout-design.md`

**Working directory:** `C:\Users\SibylleMoller-Sherwo\Documents\GitHub\atelier-wt-flatlay`, branch `feat/flatlay-adaptive-layout`. Run commands from `apps/studio`.

---

## File Structure

| File | Responsibility |
|---|---|
| `apps/studio/src/lib/flatlay.js` | **Rewrite the internals.** `LAYOUT` tree, allocation, caps, tiling. Exported API unchanged. |
| `apps/studio/src/lib/flatlay.test.js` | **Add to.** Ink measurement, coverage floors, cap and pruning assertions. |

Nothing else changes. `<Flatlay>`, the Lookbook card and the look detail all consume
`composeFlatlay`'s return value, whose shape is identical before and after.

**Do not touch** `src/components/Flatlay.jsx`, `src/views/OutfitBuilder.jsx` or
`src/App.jsx`. If you find yourself needing to, stop and report — it means the
return shape has drifted, which is a bug in this plan.

---

## Task 1: Measure ink, and prove today's engine falls short

TDD in the truest sense: this task's tests must FAIL against the current engine.
That failure is the evidence the work is worth doing.

**Files:** Modify `apps/studio/src/lib/flatlay.test.js`

- [ ] **Step 1: Add the ink helper and the coverage test**

Append inside the existing `describe('composeFlatlay', ...)` block, after the
`'gives five pieces in one zone five distinct places'` test:

```js
  // Typical width/height of the real wardrobe photography, per category. This
  // lives in the test rather than in flatlay.js because it is a property of the
  // photographs, not of the geometry — the engine must not know about images.
  const ASPECT = {
    Outerwear: 0.62, Dresses: 0.55, Tops: 0.78, Bottoms: 0.50,
    Shoes: 1.25, Bags: 0.95, Accessories: 1.80, Jewellery: 1.00,
  };

  // The share of the frame that ends up as actual garment.
  //
  // Box area flatters badly and must not be used as the measure: a three-piece
  // look can cover 98% of the frame in boxes while painting 46% garment,
  // because object-contain fits a landscape shoe into a tall box and leaves the
  // rest as air. Ink is what the eye reads as full or sparse.
  const inkCoverage = (placements) => placements.reduce((total, p) => {
    const aspect = ASPECT[p.item.category] ?? 1;
    const boxAspect = p.w / p.h;
    const w = boxAspect > aspect ? p.h * aspect : p.w;
    const h = boxAspect > aspect ? p.h : p.w / aspect;
    return total + w * h;
  }, 0);

  const COVERAGE_SHAPES = {
    'separates': ['Outerwear', 'Tops', 'Bottoms', 'Shoes', 'Bags', 'Accessories', 'Jewellery'],
    'a dress look': ['Dresses', 'Shoes', 'Bags', 'Accessories', 'Jewellery'],
    'dress and shoes': ['Dresses', 'Shoes', 'Jewellery'],
    'no coat': ['Tops', 'Bottoms', 'Shoes', 'Bags', 'Accessories'],
    'minimal': ['Tops', 'Bottoms', 'Shoes'],
    'layered jewellery': ['Outerwear', 'Tops', 'Bottoms', 'Shoes', 'Jewellery', 'Jewellery', 'Jewellery'],
  };

  const inkFor = (categories) =>
    inkCoverage(composeFlatlay(categories.map((c, i) => piece(`p${i}`, c)), { overlap: false }));

  // A look must fill its card whatever it is made of. The fixed-zone engine
  // reserved space for garments a look did not contain, so a dress look sat at
  // 27% and a three-piece look at 21-23%.
  it('never leaves a look sparser than 30% ink', () => {
    for (const [shape, categories] of Object.entries(COVERAGE_SHAPES)) {
      expect(inkFor(categories), `${shape} is too sparse`).toBeGreaterThan(0.30);
    }
  });

  it('averages at least 45% ink across look shapes', () => {
    const shapes = Object.values(COVERAGE_SHAPES);
    const mean = shapes.reduce((t, c) => t + inkFor(c), 0) / shapes.length;
    expect(mean).toBeGreaterThan(0.45);
  });
```

- [ ] **Step 2: Run the tests and confirm they FAIL**

Run: `pnpm test -- flatlay`

Expected: two failures.
- `never leaves a look sparser than 30% ink` — fails on `a dress look is too sparse`, roughly `0.27 to be greater than 0.3`.
- `averages at least 45% ink across look shapes` — roughly `0.31 to be greater than 0.45`.

If either PASSES, stop and report: the engine is not in the state this plan assumes.

- [ ] **Step 3: Commit the failing tests**

```bash
git add apps/studio/src/lib/flatlay.test.js
git commit -m "test(flatlay): measure ink, and record that today's engine falls short"
```

---

## Task 2: Replace the zone table with a weighted tree

**Files:** Modify `apps/studio/src/lib/flatlay.js`

- [ ] **Step 1: Replace the header comment and the constants**

Replace everything from the top of the file down to and including the
`ZONE_GUTTER` constant — that is, **lines 1 to 66**, ending with the line
reading `const ZONE_GUTTER = 0.003;` — with:

```js
// src/lib/flatlay.js
//
// Where each garment sits when a look is composed as a flat-lay.
//
// Pure geometry: takes the pieces of a look, returns a placement per piece in
// normalised 0–1 coordinates. It draws nothing and knows nothing about the
// DOM, canvas or images — which is the point. The same placements drive the
// Lookbook card and the look detail, so a look is composed identically
// wherever it appears, and the arrangement can be tested without rendering
// anything.
//
// The arrangement is anatomical: pieces sit roughly where they are worn.
// Outerwear down the left, the top-and-bottom (or a dress) up the centre,
// shoes and bag in the right margin, finishing pieces below the coat.
//
// It is expressed as a TREE OF WEIGHTS rather than a table of rectangles, and
// that is the whole design. Fixed rectangles are addresses: `Outerwear` owned
// the left third of every frame whether or not the look had a coat, so a dress
// look reserved three zones for garments it did not contain and left them
// blank — 27% of the frame as garment, against 46% for a full look. Weights
// are shares: a slot with no pieces is pruned and its siblings renormalise
// over the space it would have held.

// Slot for anything uncategorised — finishing rather than silhouette, so it
// gets a small capped place instead of competing with the garments.
const FALLBACK_SLOT = '*';

// Columns left to right; rows top to bottom within each. `weight` is relative
// to siblings only, so the numbers need not sum to anything. `cap` is the
// largest share of the frame a slot may take on either axis. `z` orders the
// stack when pieces overlap.
//
// The weights are tuned, not guessed: a sweep over the plausible range found
// this the best average ink subject to neither silhouette column being
// narrower than the finishing column. Unconstrained, the sweep makes the
// shoes-and-bag column the widest thing in the frame — landscape photography
// fills a wide box efficiently — which reads as a catalogue of objects rather
// than an outfit. Holding the hierarchy costs about 5 points of ink.
const LAYOUT = {
  dir: 'row',
  children: [
    { weight: 36, dir: 'col', children: [
      { slot: 'Outerwear',   weight: 46, z: 1 },
      { slot: 'Accessories', weight: 18, z: 5, cap: 0.20 },
      { slot: 'Jewellery',   weight: 18, z: 5, cap: 0.20 },
    ] },
    { weight: 40, dir: 'col', children: [
      { slot: 'Dresses', weight: 84, z: 2 },
      { slot: 'Tops',    weight: 38, z: 3 },
      { slot: 'Bottoms', weight: 46, z: 2 },
    ] },
    { weight: 36, dir: 'col', children: [
      { slot: 'Shoes',        weight: 40, z: 4 },
      { slot: 'Bags',         weight: 60, z: 4 },
      { slot: FALLBACK_SLOT,  weight: 30, z: 5, cap: 0.20 },
    ] },
  ],
};

// Every slot the tree knows by name. Anything else falls to FALLBACK_SLOT.
const SLOT_KEYS = new Set(
  LAYOUT.children.flatMap((column) => column.children.map((row) => row.slot))
);

// Silhouette before finishing. Shared with the Lookbook's grid view so the two
// readings of a look agree about which pieces make the cut.
const SLOT_PRIORITY = ['Dresses', 'Outerwear', 'Tops', 'Bottoms', 'Shoes', 'Bags', 'Accessories', 'Jewellery'];

// Degrees. Small on purpose: enough to break the mechanical feel of a grid,
// not so much that a garment reads as fallen over.
const MAX_ROTATION = 3;

// Space between neighbouring slots, and between pieces sharing one slot.
const GUTTER = 0.012;
const INNER_GUTTER = 0.006;
```

- [ ] **Step 2: Run the tests to see the expected breakage**

Run: `pnpm test -- flatlay`
Expected: FAIL with `ZONES is not defined` (and/or `FALLBACK_ZONE is not defined`) — `composeFlatlay` still refers to the constants just deleted. This confirms you removed the right block.

- [ ] **Step 3: Replace the body of `composeFlatlay` and add its helpers**

Replace the whole of `composeFlatlay` — from its JSDoc comment through its
closing brace — with the following. Leave `rotationFor`, `orderForFlatlay`,
`hashCode` and `clamp01` exactly as they are.

```js
/**
 * Does this branch of the tree hold any pieces?
 * @param {object} node
 * @param {Map<string, number>} counts
 * @returns {boolean}
 */
function hasContent(node, counts) {
  return node.slot
    ? (counts.get(node.slot) ?? 0) > 0
    : node.children.some((child) => hasContent(child, counts));
}

/**
 * Shrink a box to its slot's ceiling, centred in the space it was given.
 *
 * The slack stays empty rather than passing to a neighbour. That is deliberate:
 * a necklace given a whole freed column would render coat-sized, which inverts
 * silhouette-large-finishing-small.
 */
function applyCap(node, box) {
  if (!node.cap) return box;
  let { x, y, w, h } = box;
  if (w > node.cap) { x += (w - node.cap) / 2; w = node.cap; }
  if (h > node.cap) { y += (h - node.cap) / 2; h = node.cap; }
  return { x, y, w, h };
}

/**
 * Walk the tree, dividing `box` among the children that hold pieces.
 *
 * Because columns and rows partition the frame, two slots cannot overlap and
 * nothing can leave the frame. Those stop being properties to test for and
 * become properties the structure cannot violate.
 */
function allocate(node, counts, box, gutter, out) {
  if (node.slot) {
    out.set(node.slot, { box: applyCap(node, box), z: node.z });
    return;
  }
  const live = node.children.filter((child) => hasContent(child, counts));
  if (live.length === 0) return;

  const totalWeight = live.reduce((total, child) => total + child.weight, 0);
  const along = node.dir === 'row' ? box.w : box.h;
  const available = along - gutter * (live.length - 1);
  let cursor = node.dir === 'row' ? box.x : box.y;

  for (const child of live) {
    const size = (child.weight / totalWeight) * available;
    allocate(child, counts, node.dir === 'row'
      ? { x: cursor, y: box.y, w: size, h: box.h }
      : { x: box.x, y: cursor, w: box.w, h: size }, gutter, out);
    cursor += size + gutter;
  }
}

/**
 * One cell of a slot shared by several pieces.
 *
 * Orientation-aware: splitting purely by column would halve the WIDTH of two
 * necklaces in a tall slot, and width is what a contained image is already
 * limited by there. Factoring in the slot's own shape keeps each cell as
 * square as it can be.
 */
function tile(box, index, total, gutter) {
  const cols = Math.max(1, Math.min(total, Math.round(Math.sqrt(total * (box.w / box.h)))));
  const rows = Math.ceil(total / cols);
  const cellW = box.w / cols;
  const cellH = box.h / rows;
  const g = total > 1 ? gutter / 2 : 0;
  return {
    x: box.x + (index % cols) * cellW + g,
    y: box.y + Math.floor(index / cols) * cellH + g,
    w: cellW - g * 2,
    h: cellH - g * 2,
  };
}

/** Which slot a piece belongs to. */
const slotFor = (item) => (SLOT_KEYS.has(item?.category) ? item.category : FALLBACK_SLOT);

/**
 * Compose a look into placements.
 *
 * @param {object[]} pieces            Resolved wardrobe items, any order.
 * @param {object}   [options]
 * @param {boolean}  [options.overlap] Allow pieces to overlap and tilt.
 *   True needs cut-outs with transparency: overlapping opaque images means a
 *   white rectangle covering the garment beneath, which is worse than a grid.
 *   False keeps every piece upright and stops any piece touching another — the
 *   honest arrangement for the images stored today.
 * @param {number}   [options.max]     Cap on pieces placed. Silhouette wins.
 * @returns {Array<{item: object, x: number, y: number, w: number, h: number, rotation: number, z: number}>}
 */
export function composeFlatlay(pieces, { overlap = false, max = 8 } = {}) {
  const ordered = orderForFlatlay(pieces, max);
  if (ordered.length === 0) return [];

  const counts = new Map();
  for (const item of ordered) {
    const slot = slotFor(item);
    counts.set(slot, (counts.get(slot) ?? 0) + 1);
  }

  // Overlap closes the gaps: the gutters are the one geometric difference
  // between the two modes, alongside rotation.
  const gutter = overlap ? 0 : GUTTER;
  const innerGutter = overlap ? 0 : INNER_GUTTER;

  const allocations = new Map();
  allocate(LAYOUT, counts, { x: 0, y: 0, w: 1, h: 1 }, gutter, allocations);

  const taken = new Map();
  return ordered.map((item) => {
    const slot = slotFor(item);
    const allocation = allocations.get(slot);
    const total = counts.get(slot) ?? 1;
    const index = taken.get(slot) ?? 0;
    taken.set(slot, index + 1);

    const cell = tile(allocation.box, index, total, innerGutter);
    return {
      item,
      x: clamp01(cell.x),
      y: clamp01(cell.y),
      w: clamp01(cell.w),
      h: clamp01(cell.h),
      rotation: overlap ? rotationFor(item?.id) : 0,
      z: allocation.z + index,
    };
  });
}
```

- [ ] **Step 4: Run the tests**

Run: `pnpm test -- flatlay`
Expected: PASS, all of them — including the two ink tests from Task 1, which
should now report roughly 51% average and nothing below 34%.

If `never leaves a look sparser than 30% ink` still fails, the weights in
`LAYOUT` do not match the spec — check them character by character against
§1 of the design document before changing anything else.

- [ ] **Step 5: Run the whole suite**

Run: `pnpm test`
Expected: `Test Files 16 passed (16)`, `Tests 196 passed (196)`. The count is
194 before this plan plus the two ink tests from Task 1.

- [ ] **Step 6: Commit**

```bash
git add apps/studio/src/lib/flatlay.js
git commit -m "feat(flatlay): let the composition close up around the look"
```

---

## Task 3: Assert the hierarchy the caps exist to protect

The caps are already implemented. These tests pin the behaviour so a later
weight change cannot quietly undo it.

**Files:** Modify `apps/studio/src/lib/flatlay.test.js`

- [ ] **Step 1: Write the tests**

Append inside `describe('composeFlatlay', ...)`, after the ink tests:

```js
  // The composition's founding rule: the garments are what a look IS, the
  // shoe and the cuff are how it is finished. Pruning frees space, and without
  // a ceiling a necklace would expand into it and render coat-sized.
  it('never lets a finishing piece grow to garment size', () => {
    const out = composeFlatlay([
      piece('t1', 'Tops'),
      piece('j1', 'Jewellery'), piece('j2', 'Jewellery'),
      piece('j3', 'Jewellery'), piece('j4', 'Jewellery'),
    ], { overlap: false });
    const top = out.find((p) => p.item.category === 'Tops');
    for (const jewel of out.filter((p) => p.item.category === 'Jewellery')) {
      expect(jewel.w).toBeLessThanOrEqual(0.20);
      expect(jewel.h).toBeLessThanOrEqual(0.20);
      expect(jewel.w * jewel.h).toBeLessThan(top.w * top.h);
    }
  });

  // Anatomy is the reason this is a weighted tree and not a packing algorithm.
  // A treemap would fill the frame better and put shoes wherever they fitted.
  it('keeps the anatomical order left to right', () => {
    const out = composeFlatlay(
      ['Outerwear', 'Tops', 'Bottoms', 'Shoes', 'Bags'].map((c, i) => piece(`p${i}`, c)),
      { overlap: false },
    );
    const mid = (category) => {
      const p = out.find((q) => q.item.category === category);
      return p.x + p.w / 2;
    };
    expect(mid('Outerwear')).toBeLessThan(mid('Tops'));
    expect(mid('Tops')).toBeLessThan(mid('Shoes'));
    expect(mid('Bottoms')).toBeLessThan(mid('Bags'));
  });

  // The point of the whole exercise: a look with no coat must not reserve the
  // coat's third of the frame.
  it('leaves no gap where an absent garment would have been', () => {
    const out = composeFlatlay(
      ['Tops', 'Bottoms', 'Shoes'].map((c, i) => piece(`p${i}`, c)),
      { overlap: false },
    );
    // Nothing should start beyond a third of the way in — with the left column
    // pruned, the remaining columns begin at the frame's edge.
    expect(Math.min(...out.map((p) => p.x))).toBeLessThan(0.02);
    // And the composition should reach the far edge.
    expect(Math.max(...out.map((p) => p.x + p.w))).toBeGreaterThan(0.98);
  });
```

- [ ] **Step 2: Run the tests**

Run: `pnpm test -- flatlay`
Expected: PASS. These describe behaviour Task 2 already built; a failure means
`applyCap` or the pruning in `allocate` is wrong, not that the tests are.

- [ ] **Step 3: Run the whole suite**

Run: `pnpm test`
Expected: `Tests 199 passed (199)`.

- [ ] **Step 4: Commit**

```bash
git add apps/studio/src/lib/flatlay.test.js
git commit -m "test(flatlay): pin the hierarchy and the pruning"
```

---

## Task 4: Look at it

**Files:** none — this task changes nothing.

- [ ] **Step 1: Build and run the full suite once more**

Run: `pnpm build` — expected: succeeds.
Run: `pnpm test` — expected: `Test Files 16 passed (16)`, `Tests 199 passed (199)`.

- [ ] **Step 2: Run the app**

Run: `pnpm dev --port 5199` from `apps/studio`, and open
`http://localhost:5199` → Lookbook.

`apps/studio/.env.local` must exist or the app will load without Firebase
config and show a sign-in screen that cannot work. If it is missing, copy it
from the main checkout at
`C:\Users\SibylleMoller-Sherwo\Documents\GitHub\atelier\apps\studio\.env.local`.

- [ ] **Step 3: Check the shapes this work targets**

Compare against the previous behaviour, look by look:

- A **dress look** — no coat, no top, no trousers. Its left column should now
  hold the accessories and jewellery at full height rather than leaving the
  top-left quarter of the card blank.
- A **short look** of three or four pieces. This is where the largest gain is
  predicted (23% → 48% ink); it should look markedly fuller.
- A **full separates look** of seven or more pieces. This should change least —
  it already filled its frame.
- The **hero card**, which is wider than the others.

What would mean this failed: garments touching or overlapping (the invariant is
supposed to make that impossible), a necklace rendering as large as a garment,
or shoes appearing left of the trousers.

- [ ] **Step 4: Report before deciding anything**

Report what the four shapes look like. Do not tune the weights in response to a
single look — the weights are a compromise across shapes, and moving them to
suit one will cost another. If a change is wanted, re-run the sweep rather than
hand-adjusting.

---

## Task 5: Ship it

- [ ] **Step 1: Push**

```bash
git push
```

- [ ] **Step 2: Open the pull request**

```bash
gh pr create --title "Let a look fill its card" --body "Replaces the flat-lay's eight fixed zones with a weighted tree.

Zones were addresses, not a packing: \`Outerwear\` owned the left third of every frame whether or not the look had a coat, so a dress look reserved three zones for garments it did not contain and left them blank. Slots with no pieces are now pruned and their siblings renormalise over the freed space.

Measured in ink — the share of the frame that is actually garment, not box area, which flatters badly: one candidate design measured 98% covered and 46% ink, the difference being air where object-contain fits a landscape shoe into a tall box.

Average ink 31% to 51%. Every look shape improves; the sparsest go furthest (a three-piece look 23% to 48%).

Non-overlap and frame-containment are now guaranteed by construction rather than tested for — columns and rows partition the frame.

The exported API is unchanged, so \`<Flatlay>\`, the Lookbook card and the look detail are untouched, and no stored image is migrated.

Spec: \`apps/studio/docs/superpowers/specs/2026-08-20-flatlay-adaptive-layout-design.md\`

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

- [ ] **Step 3: Hold**

Do not merge or deploy without the owner's say-so. The visual judgement in
Task 4 is hers, and it is the thing that decides whether this ships.

---

## Self-review notes

**Spec coverage.** §1 the tree → Task 2 step 1. §2 the algorithm → Task 2 step 3.
§3 caps → Task 2 step 3 (`applyCap`) and Task 3 (assertions). §4 expected result
→ Task 1's floors, verified in Task 2 step 4. §5 API unchanged → stated in File
Structure with an explicit stop-and-report instruction. §6 known limitation →
nothing to build; it is the reason phase two exists. §7 testing → Tasks 1 and 3.

**Placeholder scan.** No "TBD", no "handle edge cases", no "similar to Task N".
Every code step carries its code; every command carries its expected output.

**Type consistency.** `slotFor` returns a slot key used by `counts`,
`allocations` and `SLOT_KEYS` alike. `allocate` writes `{ box, z }` into a Map
keyed by slot and `composeFlatlay` reads exactly that. `tile` takes and returns
plain `{x, y, w, h}`. `applyCap` takes and returns the same. The placement shape
returned is identical to the current one — `{item, x, y, w, h, rotation, z}` —
which is what lets the consumers stay untouched.

**One existing test checked and cleared.** `'tiles a second piece in the same
zone clear of the first'` was a worry: with only two necklaces in the frame the
jewellery slot becomes square, so they tile vertically rather than side by side.
An earlier version of that test hard-coded side-by-side and would have broken.
It has already been made axis-agnostic — it asserts the two cells do not
intersect, on either axis — so it survives this change untouched. No other
existing test depends on where a slot sits.

**One deliberate ordering choice.** Task 1's tests are committed while failing.
That is unusual and intentional: the failure is the measurement that justifies
the work, and committing it means the improvement is visible in the history as a
red-to-green transition rather than asserted in a message.
