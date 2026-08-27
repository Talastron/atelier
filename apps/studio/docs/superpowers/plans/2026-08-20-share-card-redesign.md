# Share Card Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the share card show whole garments, composed as a flat-lay, with less furniture around them.

**Architecture:** Two pure helpers carry the parts that were wrong — `fitContain` (the crop) and `shareCardLayout` (the geometry) — and are unit-tested. `composeOutfitExportImage` becomes thin drawing code over them, driven by the same `composeFlatlay` engine as every other surface.

**Tech Stack:** Plain ES modules, Canvas 2D, vitest 4. No new dependencies.

**Spec:** `apps/studio/docs/superpowers/specs/2026-08-20-share-card-redesign-design.md`

**Working directory:** `C:\Users\SibylleMoller-Sherwo\Documents\GitHub\atelier-wt-flatlay`, branch `feat/share-card`. Run commands from `apps/studio`.

---

## File Structure

| File | Responsibility |
|---|---|
| `apps/studio/src/lib/shareCard.js` | **Create.** `fitContain` and `shareCardLayout` — the two pieces of maths the bugs lived in. Pure, no Canvas, no DOM. |
| `apps/studio/src/lib/shareCard.test.js` | **Create.** Tests for both, at the aspects that actually broke. |
| `apps/studio/src/lib/canvas.js` | **Modify.** `composeOutfitExportImage` only: header, palette, and the grid → composition. |
| `apps/studio/src/App.jsx` | **Modify.** Two lines of the share modal's header. |

A new file rather than adding to `canvas.js`, which is already 750 lines and mixes
export composition, compression, background removal and sharing. The new maths is
pure and testable; `canvas.js` is neither.

**Do not touch** `flatlay.js`. The share card consumes `composeFlatlay` exactly as
the other two surfaces do. If it seems to need changing, stop and report.

---

## Task 1: `fitContain` — show the whole garment

The reported bug. Cover-fit takes a centred slice sized to fill the cell; at five
or six pieces the cell inverts to landscape 1.27 and a dress loses 57% of itself.

**Files:**
- Create: `apps/studio/src/lib/shareCard.js`
- Create: `apps/studio/src/lib/shareCard.test.js`

- [ ] **Step 1: Write the failing tests**

Create `apps/studio/src/lib/shareCard.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { fitContain } from './shareCard.js';

describe('fitContain', () => {
  // The bug this replaces: the share card used cover-fit, which takes a centred
  // slice sized to FILL the box. That suits a landscape photograph, where the
  // edges are expendable, and ruins a garment, where the hem and the shoulder
  // are the subject. At five pieces the cell inverted to landscape 1.27 and a
  // dress rendered with 43% of itself visible.
  it('shows a tall garment whole, letterboxed left and right', () => {
    // A dress at aspect 0.55 in a landscape box.
    const box = fitContain(550, 1000, 400, 300);
    expect(box.h).toBe(300);                 // limited by height
    expect(box.w).toBeCloseTo(165, 0);       // 300 * 0.55
    expect(box.x).toBeCloseTo(117.5, 0);     // centred: (400 - 165) / 2
    expect(box.y).toBe(0);
  });

  it('shows a wide garment whole, letterboxed top and bottom', () => {
    // A shoe at aspect 1.25 in a portrait box.
    const box = fitContain(1250, 1000, 400, 600);
    expect(box.w).toBe(400);                 // limited by width
    expect(box.h).toBeCloseTo(320, 0);       // 400 / 1.25
    expect(box.x).toBe(0);
    expect(box.y).toBeCloseTo(140, 0);       // (600 - 320) / 2
  });

  it('fills the box exactly when the aspects match', () => {
    const box = fitContain(800, 600, 400, 300);
    expect(box).toEqual({ x: 0, y: 0, w: 400, h: 300 });
  });

  // The whole point: nothing is ever cut off.
  it('never returns a box larger than the one it was given', () => {
    const aspects = [[550, 1000], [500, 1000], [1250, 1000], [780, 1000], [1000, 1000]];
    for (const [iw, ih] of aspects) {
      const box = fitContain(iw, ih, 400, 300);
      expect(box.w).toBeLessThanOrEqual(400 + 1e-9);
      expect(box.h).toBeLessThanOrEqual(300 + 1e-9);
      // and it keeps the image's own proportions
      expect(box.w / box.h).toBeCloseTo(iw / ih, 5);
    }
  });

  it('returns an empty box rather than NaN for degenerate input', () => {
    expect(fitContain(0, 100, 400, 300)).toEqual({ x: 0, y: 0, w: 0, h: 0 });
    expect(fitContain(100, 0, 400, 300)).toEqual({ x: 0, y: 0, w: 0, h: 0 });
    expect(fitContain(100, 100, 0, 300)).toEqual({ x: 0, y: 0, w: 0, h: 0 });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test -- shareCard`
Expected: FAIL — `Failed to resolve import "./shareCard.js"`.

- [ ] **Step 3: Create the module**

Create `apps/studio/src/lib/shareCard.js`:

```js
// src/lib/shareCard.js
//
// The two pieces of geometry the share card gets wrong when they are written
// inline. Pure functions: no Canvas, no DOM, no images — so the maths that
// actually broke can be tested, and canvas.js is left as drawing code.

/**
 * Fit an image wholly inside a box, centred, keeping its proportions.
 *
 * The share card previously used cover-fit — a centred slice sized to FILL the
 * box. That is right for a landscape photograph, whose edges are expendable,
 * and wrong for a garment, where the hem and the shoulder are the subject. At
 * five pieces the cell inverted to landscape and a dress showed 43% of itself.
 *
 * @param {number} imgW  natural width
 * @param {number} imgH  natural height
 * @param {number} boxW
 * @param {number} boxH
 * @returns {{x: number, y: number, w: number, h: number}} offsets relative to
 *   the box's own origin, so a caller adds the box's x and y.
 */
export function fitContain(imgW, imgH, boxW, boxH) {
  const empty = { x: 0, y: 0, w: 0, h: 0 };
  if (!(imgW > 0) || !(imgH > 0) || !(boxW > 0) || !(boxH > 0)) return empty;

  const scale = Math.min(boxW / imgW, boxH / imgH);
  const w = imgW * scale;
  const h = imgH * scale;
  return { x: (boxW - w) / 2, y: (boxH - h) / 2, w, h };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test -- shareCard`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/studio/src/lib/shareCard.js apps/studio/src/lib/shareCard.test.js
git commit -m "feat(share): fit garments whole instead of cropping them"
```

---

## Task 2: `shareCardLayout` — where the panel sits

Pins the geometry so the dead space cannot return and a two-line title cannot
collide with the composition.

**Files:**
- Modify: `apps/studio/src/lib/shareCard.js`
- Modify: `apps/studio/src/lib/shareCard.test.js`

- [ ] **Step 1: Write the failing tests**

First extend the existing import at the top of
`apps/studio/src/lib/shareCard.test.js` — do not add a second import statement
below the tests:

```js
import { fitContain, shareCardLayout, SHARE_CARD } from './shareCard.js';
```

Then append this describe block to the end of the file:

```js
describe('shareCardLayout', () => {
  it('starts the panel below the title and palette', () => {
    const { panel } = shareCardLayout({ titleLines: 1, hasNote: true });
    expect(panel.y).toBe(330);
    expect(panel.x).toBe(56);
    expect(panel.w).toBe(968);   // 1080 - 56 * 2
  });

  // A two-line title pushes everything under it down by one line height. The
  // old card did this too; it is retained because a long look name is common.
  it('drops the panel by one line when the title wraps', () => {
    const one = shareCardLayout({ titleLines: 1, hasNote: true });
    const two = shareCardLayout({ titleLines: 2, hasNote: true });
    expect(two.panel.y - one.panel.y).toBe(88);
    expect(two.paletteY - one.paletteY).toBe(88);
    expect(two.panel.h).toBe(one.panel.h - 88);  // the panel absorbs it
  });

  // The dead space: with no stylist's note the old card stopped the images at
  // 1520 and put the footer at 1760, leaving 240px empty.
  it('extends the panel into the space a stylist\u2019s note would have used', () => {
    const withNote = shareCardLayout({ titleLines: 1, hasNote: true });
    const without = shareCardLayout({ titleLines: 1, hasNote: false });
    expect(withNote.panel.y + withNote.panel.h).toBe(1520);
    expect(without.panel.y + without.panel.h).toBe(1700);
  });

  // The composition is drawn for a roughly square frame. Too wide and the
  // columns drift apart; too tall and the pieces stretch and thin. The Lookbook
  // card guarded only the wide side — this is the general form.
  it('keeps the composition inside the aspect band, centred in the panel', () => {
    const { panel, composition } = shareCardLayout({ titleLines: 1, hasNote: false });
    const aspect = composition.w / composition.h;
    expect(aspect).toBeGreaterThanOrEqual(SHARE_CARD.MIN_ASPECT - 1e-9);
    expect(aspect).toBeLessThanOrEqual(SHARE_CARD.MAX_ASPECT + 1e-9);
    // centred within the panel
    expect(composition.x + composition.w / 2).toBeCloseTo(panel.x + panel.w / 2, 6);
    expect(composition.y + composition.h / 2).toBeCloseTo(panel.y + panel.h / 2, 6);
    // and never larger than it
    expect(composition.w).toBeLessThanOrEqual(panel.w + 1e-9);
    expect(composition.h).toBeLessThanOrEqual(panel.h + 1e-9);
  });

  it('leaves a panel already inside the band untouched', () => {
    const { panel, composition } = shareCardLayout({ titleLines: 1, hasNote: true });
    // 968 x 1190 is 0.81 — inside the band, so it should fill the panel
    expect(composition.w).toBeCloseTo(panel.w, 6);
    expect(composition.h).toBeCloseTo(panel.h, 6);
  });

  it('never lets the panel reach the footer', () => {
    for (const titleLines of [1, 2]) {
      for (const hasNote of [true, false]) {
        const { panel } = shareCardLayout({ titleLines, hasNote });
        expect(panel.y + panel.h).toBeLessThan(SHARE_CARD.FOOTER_Y);
        expect(panel.h).toBeGreaterThan(0);
      }
    }
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test -- shareCard`
Expected: FAIL — `shareCardLayout is not a function` (the `fitContain` tests still pass).

- [ ] **Step 3: Implement it**

Append to `apps/studio/src/lib/shareCard.js`:

```js
// The card's fixed geometry. 1080x1920 is the Instagram Story frame; every
// other number is expressed against it.
export const SHARE_CARD = {
  W: 1080,
  H: 1920,
  PAD: 56,              // was 88 — the composition is width-limited, so the
                        // side margin is the one lever that grows the garments
  RULE_Y: 140,
  TITLE_BASELINE: 210,
  TITLE_LINE_HEIGHT: 88,
  PALETTE_Y: 250,       // swatch row; no label above it
  PANEL_TOP: 330,
  PANEL_BOTTOM_WITH_NOTE: 1520,
  PANEL_BOTTOM_NO_NOTE: 1700,
  PANEL_RADIUS: 32,
  NOTE_Y: 1580,
  FOOTER_Y: 1760,
  // The composition is drawn for a roughly square frame. Outside this band it
  // distorts: too wide and the columns drift apart, too tall and the pieces
  // stretch and thin.
  MIN_ASPECT: 0.8,
  MAX_ASPECT: 1.2,
};

/**
 * Where everything sits on the share card.
 *
 * Exported and tested because two faults lived here: a look with no stylist's
 * note left 240px of dead space above the footer, and the composition's frame
 * was never checked against the aspect its layout assumes.
 *
 * @param {object}  options
 * @param {number}  options.titleLines  1 or 2 — a wrapped title shifts what follows
 * @param {boolean} options.hasNote     whether a stylist's note will be drawn
 * @returns {{paletteY: number, panel: {x,y,w,h}, composition: {x,y,w,h}, noteY: number|null}}
 */
export function shareCardLayout({ titleLines = 1, hasNote = false } = {}) {
  const S = SHARE_CARD;
  const offset = titleLines > 1 ? S.TITLE_LINE_HEIGHT : 0;

  const panel = {
    x: S.PAD,
    y: S.PANEL_TOP + offset,
    w: S.W - S.PAD * 2,
    h: (hasNote ? S.PANEL_BOTTOM_WITH_NOTE : S.PANEL_BOTTOM_NO_NOTE) - (S.PANEL_TOP + offset),
  };

  // Clamp the composition into the aspect band and centre it in the panel. The
  // panel keeps its full size — what is reclaimed is breathing room around the
  // composition, not empty page.
  const aspect = panel.w / panel.h;
  let cw = panel.w;
  let ch = panel.h;
  if (aspect < S.MIN_ASPECT) ch = panel.w / S.MIN_ASPECT;
  else if (aspect > S.MAX_ASPECT) cw = panel.h * S.MAX_ASPECT;

  return {
    paletteY: S.PALETTE_Y + offset,
    panel,
    composition: {
      x: panel.x + (panel.w - cw) / 2,
      y: panel.y + (panel.h - ch) / 2,
      w: cw,
      h: ch,
    },
    noteY: hasNote ? S.NOTE_Y : null,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test -- shareCard`
Expected: PASS, 11 tests.

- [ ] **Step 5: Run the whole suite**

Run: `pnpm test`
Expected: `Test Files 17 passed (17)`, `Tests 217 passed (217)`. That is 206 before this plan, plus 5 from Task 1 and 6 here.

- [ ] **Step 6: Commit**

```bash
git add apps/studio/src/lib/shareCard.js apps/studio/src/lib/shareCard.test.js
git commit -m "feat(share): pin the card's geometry, including the aspect band"
```

---

## Task 3: Strip the header to one gesture

Three brass-rule-and-eyebrow devices appear before a single garment. Two say what
something else already says.

**Files:**
- Modify: `apps/studio/src/lib/canvas.js`, inside `composeOutfitExportImage`

- [ ] **Step 1: Import the helpers**

At the top of `apps/studio/src/lib/canvas.js`, after the existing
`import { computeCropRect, FRAME_ASPECT } from './framing.js';` line, add:

```js
import { composeFlatlay } from './flatlay.js';
import { itemImageDisplay } from './polish.js';
import { fitContain, shareCardLayout, SHARE_CARD } from './shareCard.js';
```

- [ ] **Step 2: Replace the header block**

Replace this, in `composeOutfitExportImage`:

```js
  // === HEADER ===
  // brass-rule
  ctx.fillStyle = BRASS;
  ctx.fillRect(PAD, 142, 56, 3);
  // eyebrow
  ctx.font = '500 22px Jost, sans-serif';
  ctx.fillStyle = MUTED;
  ctx.textBaseline = 'middle';
  ctx.fillText('A LOOK · COMPOSED IN ATELIER', PAD + 76, 144);
  // title
  ctx.font = '500 76px "Playfair Display", Georgia, serif';
  ctx.fillStyle = INK;
  ctx.textBaseline = 'alphabetic';
  // wrapCanvasText returns the number of lines it drew. A two-line title's
  // second baseline reaches y≈336, which would collide with the palette and
  // grid pinned below — so shift everything under the title down by one line
  // height (88) when the title wraps. The stylist note and footer stay
  // anchored to the bottom; the grid simply gets a little shorter.
  const titleLines = wrapCanvasText(ctx, outfit?.name || 'A composed look', PAD, 248, W - PAD * 2, 88, 2);
  const titleOffset = titleLines > 1 ? 88 : 0;
```

with:

```js
  // === HEADER ===
  // One brass rule, then the name. The eyebrow that sat here read
  // "A LOOK · COMPOSED IN ATELIER", which is what myatelier.style says in the
  // footer 1,600px below; and the same rule-and-eyebrow device appeared three
  // times before a single garment. It works because it is rare.
  ctx.fillStyle = BRASS;
  ctx.fillRect(PAD, SHARE_CARD.RULE_Y, 56, 3);
  ctx.font = '500 76px "Playfair Display", Georgia, serif';
  ctx.fillStyle = INK;
  ctx.textBaseline = 'alphabetic';
  // wrapCanvasText returns the number of lines it drew; a wrapped title shifts
  // the palette and panel down by one line, which shareCardLayout works out.
  const titleLines = wrapCanvasText(
    ctx, outfit?.name || 'A composed look',
    PAD, SHARE_CARD.TITLE_BASELINE, W - PAD * 2, SHARE_CARD.TITLE_LINE_HEIGHT, 2,
  );
  const hasNote = !!(outfit?.reasoning && outfit.reasoning.trim());
  const layout = shareCardLayout({ titleLines, hasNote });
```

- [ ] **Step 3: Point PAD at the shared constant**

The side margin narrows from 88 to 56, which is what actually grows the
garments. Replace:

```js
  const PAD = 88;
```

with:

```js
  const PAD = SHARE_CARD.PAD;
```

- [ ] **Step 4: Verify the build still compiles**

Run: `pnpm build`
Expected: succeeds. The palette and grid below still reference `titleOffset`,
which no longer exists — if the build fails with `titleOffset is not defined`,
that is expected and Task 4 removes those references. Note it and continue.

- [ ] **Step 5: Commit**

```bash
git add apps/studio/src/lib/canvas.js
git commit -m "refactor(share): one brass rule at the top, not three"
```

---

## Task 4: Drop the palette label and its rule

**Files:**
- Modify: `apps/studio/src/lib/canvas.js`

- [ ] **Step 1: Replace the palette position and label**

Replace:

```js
  const paletteY = 320 + titleOffset;
```

with:

```js
  const paletteY = layout.paletteY;
```

Then replace:

```js
  if (palette.length > 0) {
    // brass-rule + "PALETTE" eyebrow
    ctx.fillStyle = BRASS;
    ctx.fillRect(PAD, paletteY, 36, 2);
    ctx.font = '500 18px Jost, sans-serif';
    ctx.fillStyle = MUTED;
    ctx.textBaseline = 'middle';
    ctx.fillText('PALETTE', PAD + 52, paletteY + 1);

    // Swatches
    const swatchY = paletteY + 36;
```

with:

```js
  if (palette.length > 0) {
    // No "PALETTE" label. It named a row of coloured dots that already carry
    // their names beside them, and it was the second of three identical
    // rule-and-eyebrow devices stacked above the garments.
    const swatchY = paletteY;
```

- [ ] **Step 2: Verify**

Run: `pnpm build`
Expected: succeeds if Task 5 has been done; if not, still fails on `titleOffset`
in the grid block. Either way, no NEW errors beyond that one.

- [ ] **Step 3: Commit**

```bash
git add apps/studio/src/lib/canvas.js
git commit -m "refactor(share): the swatches label themselves"
```

---

## Task 5: The composition replaces the grid

**Files:**
- Modify: `apps/studio/src/lib/canvas.js`

- [ ] **Step 1: Replace the whole grid block**

Replace everything from `// === ITEMS GRID ===` down to (but NOT including)
`// === STYLIST'S NOTE ===` with:

```js
  // === THE COMPOSITION ===
  // The same flat-lay engine that draws the Lookbook card and the look detail,
  // so a look is arranged identically wherever it appears — and phase two's
  // overlap reaches this card for free.
  //
  // Six pieces, not the eight used elsewhere: a share card is read at a glance,
  // on a phone, among other people's posts. The engine drops finishing first,
  // so what goes is a cuff rather than the coat.
  const placements = composeFlatlay(pieces, { overlap: false, max: 6 });

  // The polished cut-out, not the raw photo. Every background the user has had
  // removed was previously absent from the one artefact that leaves the app —
  // and a loosely-framed raw photo also loses more to fitting than a tight
  // cut-out does. Falls back to the raw image when there is no cut-out, and
  // loadImageForCanvas falls back again (weserv proxy) when a Storage URL is
  // not canvas-safe, returning null rather than throwing.
  const sources = placements.map((p) => itemImageDisplay(p.item, 0).src || itemImages(p.item)[0]);
  const imgs = await Promise.all(sources.map((src) => loadImageForCanvas(src)));

  // A white panel. Every stored cut-out is an opaque white JPEG, so floating
  // them onto the cream page would paint white boxes across it — the fault
  // fixed on the Lookbook card. Phase two recolours this one rectangle.
  ctx.fillStyle = '#FFFFFF';
  drawRoundedRect(ctx, layout.panel.x, layout.panel.y, layout.panel.w, layout.panel.h, SHARE_CARD.PANEL_RADIUS);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.06)';
  ctx.lineWidth = 1.5;
  drawRoundedRect(ctx, layout.panel.x, layout.panel.y, layout.panel.w, layout.panel.h, SHARE_CARD.PANEL_RADIUS);
  ctx.stroke();

  const stage = layout.composition;
  placements.forEach((placement, i) => {
    const cellX = stage.x + placement.x * stage.w;
    const cellY = stage.y + placement.y * stage.h;
    const cellW = placement.w * stage.w;
    const cellH = placement.h * stage.h;
    const img = imgs[i];

    if (img) {
      // Contain, not cover. Cover took a centred slice sized to fill the cell,
      // which cost a dress 57% of itself.
      const fit = fitContain(img.width, img.height, cellW, cellH);
      ctx.drawImage(img, cellX + fit.x, cellY + fit.y, fit.w, fit.h);
      return;
    }

    // The image failed to load (dead URL, or blocked even through the proxy).
    // Credit the piece typographically rather than leaving a hole.
    const p = placement.item;
    const cx = cellX + cellW / 2;
    const cy = cellY + cellH / 2;
    ctx.beginPath();
    ctx.arc(cx, cy - 18, 14, 0, Math.PI * 2);
    ctx.strokeStyle = BRASS;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (p?.brand) {
      ctx.font = '500 16px Jost, sans-serif';
      ctx.fillStyle = MUTED;
      ctx.fillText(String(p.brand).toUpperCase().slice(0, 22), cx, cy + 14);
    }
    if (p?.name) {
      ctx.font = 'italic 500 20px "Playfair Display", Georgia, serif';
      ctx.fillStyle = INK;
      ctx.fillText(String(p.name).slice(0, 28), cx, cy + 40);
    }
    ctx.textAlign = 'left';
  });

```

- [ ] **Step 2: Point the stylist's note at the layout**

Replace:

```js
    const noteY = H - 340;
```

with:

```js
    const noteY = layout.noteY;
```

- [ ] **Step 3: Run the whole suite**

Run: `pnpm test`
Expected: `Tests 217 passed (217)` — unchanged; this task adds no tests, and
breaks none.

- [ ] **Step 4: Verify the build**

Run: `pnpm build`
Expected: succeeds, with no `titleOffset is not defined` — the last reference is
gone.

- [ ] **Step 5: Commit**

```bash
git add apps/studio/src/lib/canvas.js
git commit -m "feat(share): compose the card as a flat-lay, from the polished images"
```

---

## Task 6: Tidy the modal

**Files:**
- Modify: `apps/studio/src/App.jsx`

- [ ] **Step 1: Remove the duplicated subheading**

The modal header already says "Share this look", and the card itself carries the
piece count in its footer. Replace:

```jsx
        <div className="px-6 pt-6 pb-4 overflow-y-auto flex-1">
          <p className="text-[10px] tracking-widest uppercase text-stone-500 mb-5">
            {(outfit?.itemIds || []).length} {(outfit?.itemIds || []).length === 1 ? 'piece' : 'pieces'} · Composed for sharing
          </p>
```

with:

```jsx
        {/* No subheading. The header above already says "Share this look" and
            the card itself carries the piece count, so the line that sat here
            pushed the preview down to repeat what was on either side of it. */}
        <div className="px-6 pt-5 pb-4 overflow-y-auto flex-1">
```

- [ ] **Step 2: Verify**

Run: `pnpm build`
Expected: succeeds.

Run: `pnpm test`
Expected: `Tests 217 passed (217)`.

- [ ] **Step 3: Commit**

```bash
git add apps/studio/src/App.jsx
git commit -m "refactor(share): let the preview sit higher in the modal"
```

---

## Task 7: Look at it

**Files:** none — this task changes nothing.

- [ ] **Step 1: Run the app**

Run: `pnpm dev --port 5199` from `apps/studio`, and open `http://localhost:5199`.

`apps/studio/.env.local` must exist or the app loads without Firebase config. If
missing, copy it from
`C:\Users\SibylleMoller-Sherwo\Documents\GitHub\atelier\apps\studio\.env.local`.

- [ ] **Step 2: Open a look and press Share**

Check, in this order:

1. **Nothing is cropped.** Every garment is whole. This is the reported bug — a
   dress or a coat losing its hem means the fix did not take.
2. **The images are the polished ones.** Pieces that have had their backgrounds
   removed should show as cut-outs, not as original photographs with backgrounds.
3. **A look with no stylist's note** has no empty band above the footer.
4. **A look with a long name** (wrapping to two lines) does not collide with the
   palette or the panel.
5. **A look of ten or more pieces** shows six, silhouette first — a coat and
   trousers present, a cuff absent.
6. **Save the image** and view it at full size. The card is composed at 1080×1920
   and judged at thumbnail size; both matter.

- [ ] **Step 3: Report before changing anything**

Report what you see. Do not retune `SHARE_CARD`'s numbers in response to one
look — they are a compromise across title lengths, note presence and piece
counts. If a change is wanted, say which of those cases it breaks.

---

## Task 8: Ship it

- [ ] **Step 1: Push**

```bash
git push
```

- [ ] **Step 2: Open the pull request**

```bash
gh pr create --title "The share card, composed" --body "The only artefact that leaves the app, and the last surface still using the grid of white plates.

**Garments were being cropped.** Cover-fit takes a centred slice sized to fill the cell — right for a landscape, wrong for a dress. Worst at five or six pieces, where the row-height cap silently inverted the cell to landscape 1.27: trousers 39% visible, dress 43%, jacket 49%. Now fitted whole.

**It ignored the cut-outs.** It read raw photos, so every background removed in the app was absent from the most public thing the app makes — and a loosely-framed raw photo loses more to fitting than the tight cut-out sitting unused beside it.

**It is now composed by the flat-lay engine**, like every other surface, capped at six pieces because a share card is read at a glance. Phase two's overlap will reach it for free.

**Forty-three per cent of the card was furniture** — the same brass-rule-and-eyebrow device three times before a single garment. Now one rule at the top; the swatches carry their own names; the footer keeps the signature.

Chrome falls to 38% with a stylist's note and 29% without. The composition grows about 16% in area — from narrowing the side margin, since it is width-limited and vertical space was never the constraint.

Two pure helpers carry the maths the bugs lived in — \`fitContain\` and \`shareCardLayout\` — with 11 tests. \`composeOutfitExportImage\` is left as drawing code.

Spec: \`apps/studio/docs/superpowers/specs/2026-08-20-share-card-redesign-design.md\`

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

- [ ] **Step 3: Hold**

Do not merge or deploy without the owner's say-so. Task 7's judgement is hers.

---

## Self-review notes

**Spec coverage.** §1 engine → Task 5. §2 contain → Task 1, used in Task 5. §3
polished image → Task 5. §4 white panel → Task 5. §5 aspect band → Task 2. §6
reclaimed furniture → Tasks 3, 4 and the constants in Task 2. §7 modal → Task 6.
§8 testing → Tasks 1 and 2.

**Placeholder scan.** No "TBD", no "handle edge cases", no "similar to Task N".
Every code step carries its code; every command carries expected output.

**Type consistency.** `shareCardLayout` returns `{paletteY, panel, composition,
noteY}` in Task 2 and exactly those fields are read in Tasks 3, 4 and 5.
`fitContain` returns `{x, y, w, h}` relative to the box, and Task 5 adds `cellX`
and `cellY` to it, as its docstring requires. `SHARE_CARD` is imported once in
Task 3 and used in Tasks 3 and 5.

**A deliberately broken intermediate state — and the plan was wrong about how it
would show.** Tasks 3 and 4 leave `canvas.js` referencing `titleOffset`, which
Task 3 deletes and Task 5 removes the last use of. The steps above say to expect
`pnpm build` to fail with `titleOffset is not defined`.

**It does not.** In plain JavaScript that is a runtime `ReferenceError`, not a
bundler error, and esbuild does not perform the check. Both intermediate commits
build clean and pass all 217 tests while the share card would throw the moment
anyone exported one — no test exercises the canvas.

So those two commits are genuinely broken and nothing catches it. They are
harmless here only because the branch is squash-merged, which collapses them.
Anyone reworking this plan should either combine Tasks 3–5 into one commit, or
verify the intermediate state by grep rather than by build.

The lesson generalises: "the build will fail" is only a safety gate in a language
whose compiler checks that. Here it was a fiction, and asserting it made the plan
look safer than it was.
