# Flat-lay Phase One Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the already-merged `composeFlatlay` engine as an anatomical composition on the Lookbook card and the look detail, and measure whether WebP-with-alpha makes phase two affordable.

**Architecture:** One presentational `<Flatlay>` component turns engine placements into absolutely-positioned percentage boxes, so a 180px card and a 900px spread share one code path. It composes onto a **white** ground, because every cut-out stored today is an opaque white JPEG and white-on-white is indistinguishable from transparency. A dev-only harness page, never part of the production bundle, answers the two questions gating phase two.

**Tech Stack:** React 18, Vite 6, Tailwind 4, vitest 4, `@imgly/background-removal` 1.7.

**Spec:** `apps/studio/docs/superpowers/specs/2026-08-18-flatlay-renderer-design.md`

**Working directory:** `C:\Users\SibylleMoller-Sherwo\Documents\GitHub\atelier-wt-flatlay`, branch `feat/flatlay-phase-one`. All commands below assume `apps/studio` unless stated.

---

## Two deviations from the spec, decided while reading the code

**1. `flatlayTreatment` lives in `polish.js`, not `flatlay.js`.** The spec (§4) put it beside the geometry. But it is a question about *image display*, and `polish.js` already owns that question via `itemImageDisplay`. Putting it in `flatlay.js` would force that module — which documents itself as knowing nothing about images — to import `polish.js`. `polish.test.js` already exists for the tests.

**2. The look detail's credits list already exists.** The spec (§7) said credits would "move from captions-under-cells to a list". Reading `OutfitFlatLay` shows a credits list is *already there* at `App.jsx:8707-8778` — grouped by category, with thumbnails, prices and palette dimming — sitting below the spread. So Task 6 only deletes the spread (`App.jsx:8655-8705`) and leaves the list untouched. Less work, and nothing is lost.

---

## File Structure

| File | Responsibility |
|---|---|
| `apps/studio/tools/alpha-check.html` | Dev-only harness shell. Never built — Vite builds `index.html` only. |
| `apps/studio/tools/alpha-check.js` | Runs background removal once per image, encodes five ways, tables the bytes, renders cut-outs on cream. |
| `apps/studio/src/lib/flatlay.js` | **Modify.** Separate the Accessories/Jewellery zones. Geometry only, no new imports. |
| `apps/studio/src/lib/flatlay.test.js` | **Modify.** Add the missing no-intersection invariant test. |
| `apps/studio/src/lib/polish.js` | **Modify.** Add `flatlayTreatment(item)` beside `itemImageDisplay`. |
| `apps/studio/src/lib/polish.test.js` | **Modify.** Tests for `flatlayTreatment`. |
| `apps/studio/src/components/Flatlay.jsx` | **Create.** Placements → positioned elements. Presentational only. |
| `apps/studio/src/views/OutfitBuilder.jsx` | **Modify.** `LookbookSortableCard`: grid → composition. |
| `apps/studio/src/App.jsx` | **Modify.** `OutfitFlatLay`: spread → composition, credits list kept. |

---

## Task 1: The measurement harness

Runs first because it is cheap and a negative result changes what we build afterwards. It is not test-driven — it *is* the test, of an assumption rather than of code.

**Files:**
- Create: `apps/studio/tools/alpha-check.html`
- Create: `apps/studio/tools/alpha-check.js`

- [ ] **Step 1: Create the harness shell**

Create `apps/studio/tools/alpha-check.html`:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Alpha encoding check</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 0; padding: 28px; background: #FAF9F7; color: #1c1917; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    p.sub { color: #78716c; font-size: 13px; margin: 0 0 20px; max-width: 70ch; line-height: 1.55; }
    #warn { display: none; background: #fdf3f3; border-left: 3px solid #c05a5a; padding: 12px 16px; margin-bottom: 18px; font-size: 13px; }
    #warn.show { display: block; }
    table { border-collapse: collapse; font-size: 12px; background: #fff; border: 1px solid #e7e5e4; margin-top: 18px; width: 100%; }
    th, td { padding: 6px 10px; text-align: right; border-bottom: 1px solid #e7e5e4; white-space: nowrap; }
    th:first-child, td:first-child { text-align: left; }
    th { font-size: 9px; letter-spacing: .16em; text-transform: uppercase; color: #78716c; font-weight: 500; }
    tfoot td { font-weight: 700; background: #faf9f7; }
    .cream-strip { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 22px; }
    .cream-strip figure { margin: 0; width: 200px; }
    .cream-strip .on-cream { background: #F4F0E8; border-radius: 12px; height: 200px; display: flex; align-items: center; justify-content: center; }
    .cream-strip .on-white { background: #fff; border-radius: 12px; height: 200px; display: flex; align-items: center; justify-content: center; border: 1px solid #e7e5e4; }
    .cream-strip img { max-width: 100%; max-height: 100%; }
    .cream-strip figcaption { font-size: 10px; color: #78716c; margin-top: 5px; text-align: center; }
    #status { font-size: 13px; color: #78716c; margin-top: 14px; }
  </style>
</head>
<body>
  <h1>Alpha encoding check</h1>
  <p class="sub">
    Pick a dozen real garment photographs. Span the hard cases: a pale garment on a pale
    background, a fine edge (lace, fringe, a chain), something dark, and something with a hole
    through it (a handle, a strap). Each image runs background removal once, then that one
    cut-out is encoded five ways. The verdict is the ratio at the bottom, and your own eyes on
    the cream strip below it.
  </p>
  <div id="warn"></div>
  <input type="file" id="files" multiple accept="image/*">
  <div id="status"></div>
  <table id="table" hidden>
    <thead>
      <tr>
        <th>Image</th><th>JPEG/white</th><th>WebP/white</th>
        <th>WebP+α q90</th><th>WebP+α q80</th><th>WebP+α q70</th><th>PNG+α</th><th>α80 ÷ JPEG</th>
      </tr>
    </thead>
    <tbody id="rows"></tbody>
    <tfoot id="foot"></tfoot>
  </table>
  <div class="cream-strip" id="strip"></div>
  <script type="module" src="./alpha-check.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create the harness logic**

Create `apps/studio/tools/alpha-check.js`:

```js
// Dev-only. Vite builds index.html only, so this never enters a production
// bundle. Answers the two questions gating phase two of the flat-lay work:
// does WebP-with-alpha cost more than today's JPEG-on-white, and do real
// cut-outs look acceptable floating on cream rather than sitting on white.
import { removeBackground } from '@imgly/background-removal';
import { compressImageToDataUrl } from '../src/lib/canvas.js';

// toDataURL/toBlob do NOT throw on an unsupported MIME type — per spec they
// fall back to image/png. A naive toBlob('image/webp') on a browser without
// WebP encoding therefore returns a PNG, which is exactly the 3-5x blow-up the
// original flatten-onto-white decision was avoiding, and it would do so
// invisibly. So detect properly before reporting any number.
async function webpEncodingSupported() {
  const c = document.createElement('canvas');
  c.width = c.height = 1;
  const blob = await new Promise((r) => c.toBlob(r, 'image/webp', 0.8));
  return !!blob && blob.type === 'image/webp';
}

const encode = (canvas, type, quality) =>
  new Promise((resolve) => canvas.toBlob((b) => resolve(b ? b.size : 0), type, quality));

function canvasFor(img, { flattenOnWhite }) {
  // 900px cap matches removeImageBackground, so the baseline column is the
  // real baseline rather than a differently-sized approximation.
  const scale = Math.min(1, 900 / img.naturalWidth);
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * scale);
  c.height = Math.round(img.naturalHeight * scale);
  const ctx = c.getContext('2d');
  if (flattenOnWhite) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, c.width, c.height);
  }
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

const loadImage = (src) => new Promise((resolve, reject) => {
  const im = new Image();
  im.onload = () => resolve(im);
  im.onerror = reject;
  im.src = src;
});

const kb = (bytes) => (bytes / 1024).toFixed(0) + 'K';

const els = {
  files: document.getElementById('files'),
  rows: document.getElementById('rows'),
  foot: document.getElementById('foot'),
  table: document.getElementById('table'),
  strip: document.getElementById('strip'),
  status: document.getElementById('status'),
  warn: document.getElementById('warn'),
};

els.files.addEventListener('change', async (e) => {
  const files = Array.from(e.target.files || []);
  if (!files.length) return;

  if (!(await webpEncodingSupported())) {
    els.warn.className = 'show';
    els.warn.textContent =
      'This browser cannot encode WebP from a canvas. toBlob would silently return PNG, so any '
      + 'number here would be a lie. Re-run in a browser with canvas WebP encoding.';
    return;
  }

  els.table.hidden = false;
  const ratios = [];

  for (const [i, file] of files.entries()) {
    els.status.textContent = `Removing background ${i + 1} of ${files.length} — ${file.name}`;

    const sourceDataUrl = await compressImageToDataUrl(file);
    const sourceBlob = await (await fetch(sourceDataUrl)).blob();
    const cutoutBlob = await removeBackground(sourceBlob);
    const cutout = await loadImage(URL.createObjectURL(cutoutBlob));

    const alpha = canvasFor(cutout, { flattenOnWhite: false });
    const white = canvasFor(cutout, { flattenOnWhite: true });

    const sizes = {
      jpegWhite: await encode(white, 'image/jpeg', 0.86),
      webpWhite: await encode(white, 'image/webp', 0.8),
      webp90: await encode(alpha, 'image/webp', 0.9),
      webp80: await encode(alpha, 'image/webp', 0.8),
      webp70: await encode(alpha, 'image/webp', 0.7),
      png: await encode(alpha, 'image/png'),
    };
    const ratio = sizes.webp80 / sizes.jpegWhite;
    ratios.push(ratio);

    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${file.name}</td><td>${kb(sizes.jpegWhite)}</td><td>${kb(sizes.webpWhite)}</td>`
      + `<td>${kb(sizes.webp90)}</td><td>${kb(sizes.webp80)}</td><td>${kb(sizes.webp70)}</td>`
      + `<td>${kb(sizes.png)}</td><td>${ratio.toFixed(2)}x</td>`;
    els.rows.appendChild(tr);

    // The edge-quality check: on a white plate a ragged edge is invisible,
    // floating on cream it is not. This is the most likely reason to abandon
    // phase two, and no number can answer it.
    const fig = document.createElement('figure');
    const url = alpha.toDataURL('image/webp', 0.8);
    fig.innerHTML = `<div class="on-cream"><img src="${url}"></div>`
      + `<div class="on-white" style="margin-top:6px"><img src="${url}"></div>`
      + `<figcaption>${file.name}<br>cream above, white below</figcaption>`;
    els.strip.appendChild(fig);
  }

  const mean = ratios.reduce((a, b) => a + b, 0) / ratios.length;
  const lo = Math.min(...ratios).toFixed(2);
  const hi = Math.max(...ratios).toFixed(2);
  els.foot.innerHTML =
    `<tr><td colspan="7">WebP+α q80 ÷ JPEG-on-white — mean across ${ratios.length} images `
    + `(spread ${lo}x to ${hi}x)</td><td>${mean.toFixed(2)}x</td></tr>`;
  els.status.textContent = 'Done.';
});
```

- [ ] **Step 3: Verify the harness is not in the production build**

Run: `pnpm build`
Then: `grep -rl "alpha-check" dist/ ; echo "exit=$?"`
Expected: no files listed, `exit=1`. Vite builds `index.html` only, so `tools/` is never entered. If anything matches, stop — the harness must not ship.

- [ ] **Step 4: Run the harness**

Run: `pnpm dev`
Open: `http://localhost:5173/tools/alpha-check.html`
Select roughly a dozen real garment photographs.

Expected: a table with one row per image and a mean ratio in the footer; below it, each cut-out shown on cream and on white.

This step needs a human. Record two things:
- the mean ratio and its spread,
- whether the cream renders show ragged edges.

- [ ] **Step 5: Record the verdict in the handoff document**

Edit `apps/studio/docs/superpowers/plans/2026-08-17-flatlay-composition.md`. Under "The blocker for phase two", replace the "Unvalidated assumption" paragraph with the measured result: the mean ratio, the spread, the sample size, and a one-line judgement on edge quality on cream.

Near 1x and phase two is affordable. Near 3x and it is off for the inline add-item path, and a judgement call for the Storage-backed polish path — those have different limits, which is why absolute bytes are in the table and not just the ratio. Ragged edges on cream means phase two is off regardless of the numbers.

- [ ] **Step 6: Commit**

```bash
git add apps/studio/tools/alpha-check.html apps/studio/tools/alpha-check.js apps/studio/docs/superpowers/plans/2026-08-17-flatlay-composition.md
git commit -m "tools(flatlay): measure whether alpha is affordable, and record the verdict"
```

---

## Task 2: Separate the colliding zones

The engine promises `overlap: false` keeps pieces "separate and upright". Six zone pairs intersect; Accessories and Jewellery overlap by **71%**, so the pendant draws on top of the sunglasses. Write the test that should have caught it first.

**Files:**
- Modify: `apps/studio/src/lib/flatlay.test.js`
- Modify: `apps/studio/src/lib/flatlay.js:29-30`

- [ ] **Step 1: Write the failing test**

In `apps/studio/src/lib/flatlay.test.js`, add this inside the `describe('composeFlatlay', ...)` block, after the `'does not tilt anything when overlap is off'` test:

```js
  // The property that lets a look composed of opaque images be legible: no
  // piece may sit on top of another. Garments are allowed to overlap at the
  // edges — a coat and a trouser share a corner by design, and closing every
  // gap would spread the composition back out into the grid we are escaping.
  // What must never happen is one piece essentially covering another, which is
  // what Accessories and Jewellery did at 71% before this test existed.
  it('does not stack one piece on top of another when overlap is off', () => {
    const worn = [
      piece('o1', 'Outerwear'), piece('t1', 'Tops'), piece('b1', 'Bottoms'),
      piece('s1', 'Shoes'), piece('g1', 'Bags'), piece('a1', 'Accessories'),
      piece('j1', 'Jewellery'),
    ];
    const out = composeFlatlay(worn, { overlap: false });
    for (let i = 0; i < out.length; i += 1) {
      for (let j = i + 1; j < out.length; j += 1) {
        const a = out[i];
        const b = out[j];
        const ox = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
        const oy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
        const share = (ox * oy) / Math.min(a.w * a.h, b.w * b.h);
        expect(
          share,
          `${a.item.category} covers ${(share * 100).toFixed(0)}% of ${b.item.category}`
        ).toBeLessThan(0.25);
      }
    }
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test -- flatlay`
Expected: FAIL — `Accessories covers 71% of Jewellery`, `expected 0.71… to be less than 0.25`.

- [ ] **Step 3: Move the two zones apart**

In `apps/studio/src/lib/flatlay.js`, replace these two lines:

```js
  Accessories: { x: 0.06, y: 0.64, w: 0.17, h: 0.17, z: 5 },
  Jewellery:   { x: 0.10, y: 0.68, w: 0.15, h: 0.15, z: 5 },
```

with:

```js
  // Stacked, not nested. These two sat almost on top of each other (71% of the
  // jewellery box was inside the accessories box) because the zone numbers were
  // tuned on a five-piece look, and a five-piece look has no accessories AND
  // jewellery. They stay in the left margin: Bottoms starts at x 0.26, so the
  // strip below Outerwear is the only clear space in the frame.
  Accessories: { x: 0.04, y: 0.60, w: 0.17, h: 0.17, z: 5 },
  Jewellery:   { x: 0.04, y: 0.79, w: 0.15, h: 0.15, z: 5 },
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm test -- flatlay`
Expected: PASS. All 13 tests in the file pass. The worst remaining intersection is 16.3% (Outerwear/Bottoms), which is the deliberate garment overlap the tolerance permits.

- [ ] **Step 5: Correct the docstring that made the false promise**

In `apps/studio/src/lib/flatlay.js`, in the `composeFlatlay` JSDoc, replace:

```js
 *   False keeps every piece separate and upright — the honest arrangement for
 *   the images stored today.
```

with:

```js
 *   False keeps every piece upright and stops any piece sitting on top of
 *   another — the honest arrangement for the images stored today. Garments may
 *   still share an edge; see the no-stacking test for the exact bound.
```

- [ ] **Step 6: Commit**

```bash
git add apps/studio/src/lib/flatlay.js apps/studio/src/lib/flatlay.test.js
git commit -m "fix(flatlay): stop the pendant drawing on top of the sunglasses"
```

---

## Task 3: `flatlayTreatment`

A cut-out can float on the ground. A raw photograph carries its own background and cannot — it needs a plate. Building this now means a part-migrated wardrobe never renders wrongly.

**Files:**
- Modify: `apps/studio/src/lib/polish.test.js`
- Modify: `apps/studio/src/lib/polish.js`

- [ ] **Step 1: Write the failing tests**

In `apps/studio/src/lib/polish.test.js`, add a new `describe` block at the end of the file:

```js
describe('flatlayTreatment', () => {
  // A cut-out is white-backed and sits on a white ground invisibly, so it can
  // float. A raw photograph brings its own background and cannot — it gets a
  // plate, and reads as a photograph rather than a garment. Honest either way.
  it('floats a stored cut-out', () => {
    expect(flatlayTreatment({ images: ['a.jpg'], imageMeta: [{ cutoutUrl: 'c.jpg' }] })).toBe('bare');
  });

  it('floats a framed crop', () => {
    expect(flatlayTreatment({ images: ['a.jpg'], imageMeta: [{ framedUrl: 'f.jpg' }] })).toBe('bare');
  });

  it('floats an inline cut-out that has no separate URL', () => {
    expect(flatlayTreatment({ images: ['a.jpg'], imageMeta: [{ cutout: true }] })).toBe('bare');
  });

  it('plates a raw photograph', () => {
    expect(flatlayTreatment({ images: ['a.jpg'], imageMeta: [{}] })).toBe('plate');
  });

  it('plates an item with no imageMeta at all', () => {
    expect(flatlayTreatment({ images: ['a.jpg'] })).toBe('plate');
  });

  it('plates rather than throwing on a malformed item', () => {
    expect(flatlayTreatment(null)).toBe('plate');
    expect(flatlayTreatment({})).toBe('plate');
    expect(flatlayTreatment({ imageMeta: 'nonsense' })).toBe('plate');
  });
});
```

Then add `flatlayTreatment` to the existing import at the top of the file. If the current line reads:

```js
import { itemImageDisplay } from './polish.js';
```

change it to:

```js
import { itemImageDisplay, flatlayTreatment } from './polish.js';
```

(If the file imports a different set, add `flatlayTreatment` to that list rather than replacing it.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test -- polish`
Expected: FAIL with `flatlayTreatment is not a function`.

- [ ] **Step 3: Implement it**

In `apps/studio/src/lib/polish.js`, add immediately after the `itemImageDisplay` function:

```js
// How a piece is drawn in a flat-lay composition. A cut-out or a framed crop is
// white-backed, so on the composition's white ground it is indistinguishable
// from a transparent one and can float. A raw photograph carries its own
// background and cannot — it gets a plate behind it, exactly as the grid gives
// it today. This is what lets a part-migrated wardrobe compose without ever
// showing a photograph's background floating loose on the ground.
export function flatlayTreatment(item) {
  return itemImageDisplay(item, 0).forceContain ? 'bare' : 'plate';
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test -- polish`
Expected: PASS, including the six new tests.

- [ ] **Step 5: Commit**

```bash
git add apps/studio/src/lib/polish.js apps/studio/src/lib/polish.test.js
git commit -m "feat(flatlay): decide whether a piece floats or sits on a plate"
```

---

## Task 4: The `<Flatlay>` component

**Files:**
- Create: `apps/studio/src/components/Flatlay.jsx`

- [ ] **Step 1: Create the component**

Create `apps/studio/src/components/Flatlay.jsx`:

```jsx
import React from 'react';
import { Shirt } from 'lucide-react';
import { composeFlatlay } from '../lib/flatlay.js';
import { flatlayTreatment, itemImageDisplay } from '../lib/polish.js';
import { itemColors, itemImages } from '../lib/items.js';

// A look composed as a flat-lay: pieces sit roughly where they are worn, rather
// than in a grid of equal plates that reads as an inventory. The arrangement
// comes from composeFlatlay, so a look composes identically wherever it appears.
//
// The ground is WHITE, and that is load-bearing. Every cut-out stored today is
// a JPEG flattened onto #FFFFFF, so on white it is indistinguishable from a
// transparent one and the garments appear to float — with no image migration at
// all. Phase two changes `ground` to cream and flips `overlap`; nothing else.
//
// Sizing has two modes because the two surfaces size differently. Pass `aspect`
// and the composition declares its own height (the look detail, which places it
// in normal flow). Omit it and the composition fills its container absolutely
// (the Lookbook card, whose image area is a flex-1 region sized by what the
// caption strip leaves over, and which cannot declare an aspect without
// fighting the card's own proportions).
export default function Flatlay({
  pieces = [],
  max = 8,
  overlap = false,
  aspect,
  ground = '#FFFFFF',
  onOpenItem,
  paletteFilter = null,
}) {
  const placements = composeFlatlay(pieces, { overlap, max });

  const matchesFilter = (item) => {
    if (!paletteFilter) return true;
    const colours = (itemColors(item) || []).map((c) => (c || '').toLowerCase().trim());
    return colours.includes(paletteFilter);
  };

  const frame = aspect
    ? { position: 'relative', aspectRatio: aspect, background: ground }
    : { position: 'absolute', inset: 0, background: ground };

  if (placements.length === 0) {
    return (
      <div style={frame} className="flex items-center justify-center text-stone-300">
        <Shirt size={56} strokeWidth={0.8} />
      </div>
    );
  }

  return (
    <div style={frame} className="overflow-hidden">
      {placements.map((placement) => {
        const item = placement.item;
        const plated = flatlayTreatment(item) === 'plate';
        const src = itemImageDisplay(item, 0).src || itemImages(item)[0] || null;
        const openable = !!(onOpenItem && item?.id);
        const Tag = openable ? 'button' : 'div';
        return (
          <Tag
            key={item?.id}
            {...(openable
              ? { type: 'button', onClick: () => onOpenItem(item.id), 'aria-label': `Open ${item.name}` }
              : {})}
            className={[
              'absolute transition-opacity duration-300',
              plated ? 'bg-white rounded-lg shadow-sm ring-1 ring-black/5 p-1' : '',
              matchesFilter(item) ? 'opacity-100' : 'opacity-30',
              openable
                ? 'cursor-pointer rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-brass-500'
                : '',
            ].filter(Boolean).join(' ')}
            style={{
              left: `${(placement.x * 100).toFixed(2)}%`,
              top: `${(placement.y * 100).toFixed(2)}%`,
              width: `${(placement.w * 100).toFixed(2)}%`,
              height: `${(placement.h * 100).toFixed(2)}%`,
              zIndex: placement.z,
              transform: placement.rotation ? `rotate(${placement.rotation}deg)` : undefined,
            }}
          >
            {src ? (
              <img
                src={src}
                alt={item?.name || ''}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-contain"
              />
            ) : (
              <span className="w-full h-full flex items-center justify-center text-stone-300">
                <Shirt size={20} strokeWidth={1} />
              </span>
            )}
          </Tag>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles and nothing regressed**

Run: `pnpm build`
Expected: build succeeds.

Run: `pnpm test`
Expected: all tests pass (nothing imports the component yet, so this is a regression check only).

- [ ] **Step 3: Commit**

```bash
git add apps/studio/src/components/Flatlay.jsx
git commit -m "feat(flatlay): the renderer, shared by the card and the look detail"
```

---

## Task 5: The Lookbook card

**Files:**
- Modify: `apps/studio/src/views/OutfitBuilder.jsx` (`LookbookSortableCard`, lines ~26-120)

- [ ] **Step 1: Import the component**

In `apps/studio/src/views/OutfitBuilder.jsx`, add after the existing `ItemTileImage` import:

```jsx
import Flatlay from "../components/Flatlay.jsx";
```

- [ ] **Step 2: Delete the duplicated ordering and the grid geometry**

The engine now owns what a look "is", so the card's own copy of the priority list goes. Replace this block:

```jsx
  // Silhouette first, finishing last. A look of twelve pieces is not twelve
  // equal things: the jacket, shirt, trouser and shoe are what it *is*, and
  // the cuff, watch and sunglasses are how it is finished. The preview has
  // room for four, so it spends them on the garments that define the look.
  const SLOT_PRIORITY = ['Dresses', 'Outerwear', 'Tops', 'Bottoms', 'Shoes', 'Bags', 'Accessories', 'Jewellery'];
  const orderedPieces = [...resolvedItems].sort((a, b) => {
    const ai = SLOT_PRIORITY.indexOf(a.category);
    const bi = SLOT_PRIORITY.indexOf(b.category);
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
  });
  const gridPieces = orderedPieces.slice(0, isHero ? 6 : 4);
```

with:

```jsx
  // Silhouette first, finishing last — but composeFlatlay already orders and
  // caps by exactly that rule, so the card passes the whole look and a limit
  // rather than keeping a second copy of the priority list that could drift.
  // Six on a secondary card (up from four) and eight on the hero, which is
  // physically larger on both breakpoints.
  const maxPieces = isHero ? 8 : 6;
```

- [ ] **Step 3: Replace the grid with the composition**

Replace this block:

```jsx
            {!wornPhoto && gridPieces.length > 0 && (
              <div className={`absolute inset-0 ${isHero ? 'px-9 pt-12 pb-3 md:px-12 md:pt-14 md:pb-4' : 'px-7 pt-10 pb-3 sm:px-9 sm:pt-12 sm:pb-4'} grid ${gridCols} gap-4 sm:gap-5`}>
                {Array.from({ length: isHero ? 6 : 4 }).map((_, slotIdx) => {
                  const piece = gridPieces[slotIdx];
                  if (!piece) return <div key={slotIdx} aria-hidden="true" />;
                  return (
                    <div key={piece.id} className="relative bg-white rounded-lg overflow-hidden shadow-sm ring-1 ring-black/5">
                      {itemImages(piece)[0] ? (
                        <ItemTileImage item={piece} alt={piece.name} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-stone-300"><Shirt size={24} strokeWidth={1} /></div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {!wornPhoto && gridPieces.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-stone-300">
                <Shirt size={56} strokeWidth={0.8} />
              </div>
            )}
```

with:

```jsx
            {!wornPhoto && (
              <Flatlay pieces={resolvedItems} max={maxPieces} />
            )}
```

`<Flatlay>` renders the same `Shirt` placeholder when a look has no pieces, so the second block above is no longer needed.

- [ ] **Step 4: Give the card shell a white ground**

The composition is white. Inside a `bg-stone-100/70` card it would read as a plate-within-a-plate — the exact risk recorded in spec §9. Replace:

```jsx
        } ${wornPhoto ? 'bg-stone-900' : 'bg-stone-100/70'}`}>
```

with:

```jsx
        } ${wornPhoto ? 'bg-stone-900' : 'bg-white'}`}>
```

- [ ] **Step 5: Remove the now-unused grid variable**

Delete this line, left over from the grid:

```jsx
  const gridCols = isHero ? 'grid-cols-2 grid-rows-3 md:grid-cols-3 md:grid-rows-2' : 'grid-cols-2 grid-rows-2';
```

Keep `aspect` — the card still uses it.

**Do not remove the `ItemTileImage`, `itemImages` or `Shirt` imports at the top of the file.** `LookbookSortableCard` no longer uses them, but the multi-pick stacked thumbnails further down the same file (around line 888) still do. Removing them breaks that component.

- [ ] **Step 6: Verify**

Run: `pnpm build`
Expected: build succeeds with no "declared but never read" warnings for `gridPieces`, `gridCols` or `SLOT_PRIORITY`.

Run: `pnpm test`
Expected: all tests pass.

Run: `pnpm dev` and open the Lookbook.
Expected: each card shows an anatomical composition rather than a 2×2 grid — coat upper-left, top upper-centre, trousers below, shoes and bag lower-right, sunglasses and jewellery down the left margin. No white rectangles visible against the card. Nothing sits on top of anything.

- [ ] **Step 7: Commit**

```bash
git add apps/studio/src/views/OutfitBuilder.jsx
git commit -m "feat(lookbook): compose the card as a flat-lay, not a grid of plates"
```

---

## Task 6: The look detail

Only the spread is replaced. The credits list below it already does everything wanted — grouped by category, thumbnails, prices, palette dimming — so it stays exactly as it is.

**Files:**
- Modify: `apps/studio/src/App.jsx` (`OutfitFlatLay`, lines ~8556-8781)

- [ ] **Step 1: Import the component**

In `apps/studio/src/App.jsx`, add near the other component imports:

```jsx
import Flatlay from './components/Flatlay.jsx';
```

- [ ] **Step 2: Replace the spread with the composition**

In `OutfitFlatLay`, delete the whole atmospheric-backdrop block — `App.jsx:8657` through `App.jsx:8705` inclusive. It starts at this comment:

```jsx
      {/* Atmospheric backdrop — warm radial highlight from upper-left
          like soft window light raking across a styled surface. */}
      <div
        className="relative rounded-[2rem] border border-stone-200/60 px-3 sm:px-5 md:px-7 lg:px-8 py-5 sm:py-7 md:py-8 overflow-hidden"
        style={{
          background: 'radial-gradient(ellipse 90% 70% at 20% 0%, #FBFAF7 0%, #F4F0E8 55%, #ECE6D8 100%)',
        }}
      >
```

and ends with these three lines, which close the accessories strip, the ternary and the backdrop div — the next line after them is the `{/* Credits list — items grouped by category ... */}` comment:

```jsx
          </div>
        )}
      </div>
```

Replace the entire block with:

```jsx
      <div className="relative rounded-[2rem] border border-stone-200/60 overflow-hidden">
        <Flatlay
          pieces={pieces}
          max={8}
          aspect="1 / 1"
          onOpenItem={onOpenItem}
          paletteFilter={paletteFilter}
        />
      </div>
```

The warm radial gradient goes with it: the composition needs a white ground so today's opaque cut-outs disappear into it, and a gradient would defeat that.

- [ ] **Step 3: Delete what the spread used and nothing else**

Inside `OutfitFlatLay`, delete these — all were used only by the spread:

- the `Cell` component definition,
- `const HERO_PRIORITY = [...]`,
- `const ACCESSORY_CATEGORIES = ...`,
- the `hero` selection loop and `let hero = null;`,
- `const rest = ...`, `const garments = ...`, `const accessories = ...`,
- `const numberOf = new Map(...)`.

Keep these — the credits list still uses them:

- `pieceMatchesFilter`,
- `const ORDER = [...]` and `sortByOrder`,
- `orderedAll`.

`orderedAll` is currently built as `[hero, ...garments, ...accessories]`. With `hero` gone, rebuild it from the pieces directly:

```jsx
  // Ordering for the credits list below the composition. (The composition
  // itself is ordered by composeFlatlay, which applies the same
  // silhouette-before-finishing rule.)
  const orderedAll = [...pieces].sort(sortByOrder);
```

- [ ] **Step 4: Verify**

Run: `pnpm build`
Expected: build succeeds.

Run: `pnpm test`
Expected: all tests pass.

Run: `pnpm dev`, open a saved look, and select the "Flat-lay" toggle.
Expected: a square composition on white, with the credits list beneath it unchanged. Clicking a piece in the composition opens that item. Clicking a colour in the palette strip dims non-matching pieces in *both* the composition and the credits list. The "Grid" toggle still shows the catalogue view.

- [ ] **Step 5: Commit**

```bash
git add apps/studio/src/App.jsx
git commit -m "feat(look): compose the flat-lay view, and keep the credits list"
```

---

## Task 7: Final verification

- [ ] **Step 1: Full test run**

Run: `pnpm test`
Expected: 16 files, 182 tests, 0 failures. Baseline before this work was 175; Task 2 adds 1 and Task 3 adds 6.

- [ ] **Step 2: Full build**

Run: `pnpm -r build` from the repo root.
Expected: EXIT=0, both apps print "Done".

- [ ] **Step 3: Confirm the harness never shipped**

Run: `grep -rl "alpha-check\|background-removal" apps/studio/dist/index.html`
Expected: no match for `alpha-check`. (`background-removal` may legitimately appear as a lazy chunk reference — it is a real app dependency. Only `alpha-check` must be absent.)

- [ ] **Step 4: Look at it against a real wardrobe**

This is the step that decides whether the work merges. Spec §9 records the risk plainly: eight garments anatomically arranged in a 200px box could read as clutter where four plates read as order, and no test settles it.

Check on both a phone-width and a laptop-width viewport:
- Does a twelve-piece look read as an outfit, or as a mess?
- Is a piece with no cut-out (on a plate) jarring beside pieces that float?
- Is the hero card's eight too many? If so, change `maxPieces` to `6` for both and re-look.

- [ ] **Step 5: Open the pull request**

```bash
git push -u origin feat/flatlay-phase-one
gh pr create --title "Compose looks as flat-lays, not grids of plates" --body "Renders the composeFlatlay engine merged in #70, which until now nothing called.

Phase one composes onto a white ground: every cut-out stored today is an opaque white JPEG, and on white it is indistinguishable from a transparent one. Phase two changes the ground to cream and flips overlap — nothing else.

Also fixes a defect the mockup exposed: overlap:false promised pieces that were separate, but Accessories and Jewellery overlapped by 71%, so the pendant drew on top of the sunglasses. The zones were tuned on a five-piece look, which has neither. The invariant is now tested.

Includes a dev-only harness measuring whether WebP-with-alpha makes phase two affordable. It is not part of the production bundle.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

---

## Self-review notes

**Spec coverage.** §1 harness → Task 1. §2 zone collision → Task 2. §3 white ground → Task 4 (`ground` default) and Task 5 step 4 (card shell). §4 degradation → Task 3 and Task 4. §5 `<Flatlay>` → Task 4. §6 Lookbook card → Task 5. §7 look detail → Task 6. §8 testing → Tasks 2, 3, 7. §9 risks → Task 7 step 4. §10 order → task order.

**Placeholder scan.** Three issues found and fixed inline: Task 6 step 2 described the block to delete rather than showing its exact start and end lines; Task 5 step 5 could have led to deleting imports still used elsewhere in the same file; Task 7 step 1 gave a vague test count. No "TBD", no "handle edge cases", no "similar to Task N".

**Type consistency.** `flatlayTreatment` returns `'bare' | 'plate'` in Task 3 and is consumed as that in Task 4. `Flatlay` is a default export in Task 4 and imported as one in Tasks 5 and 6. `maxPieces` is defined in Task 5 step 2 and used in step 3. The `ground` prop defaults to white in Task 4 and is never overridden in phase one.

**Out of scope, unchanged from the spec.** The canvas/share-image renderer, the alpha encoding change, the batch reprocessing, and the `overlap: true` flip. All wait on Task 1's verdict.
