# Style Manifesto Fit-Score Implementation Plan (Phase 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Style Manifesto from a read-only artifact into a working "fit signal" — a shareable Verdict that judges how well any item suits the user — plus presentation refinements to the manifesto card.

**Architecture:** All pure scoring logic lives in a new dependency-free module `src/lib/itemFit.js` (unit-tested with Vitest). The single Gemini-calling function `generateItemFitWithGemini` is a thin orchestration in `src/lib/ai.js` mirroring the existing `geminiText` JSON pattern. The score is cached on each item (`item.manifestoFit`) via the existing `handleAddItem` upsert, invalidated when the manifesto is regenerated. UI surfaces (manifesto card refinements, item-detail Verdict, add-item candidate check, share-as-card) are verified by running the app.

**Tech Stack:** React + Vite + Firebase (Firestore + Firebase AI Logic / Gemini 2.5 Flash). New dev dependency: Vitest (first tests in the repo). Canvas 2D API for image export (already used by the Style DNA card).

**Spec:** `docs/superpowers/specs/2026-06-30-style-manifesto-fit-score-design.md`

---

## File Structure

| File | Responsibility | Create/Modify |
|------|----------------|---------------|
| `src/lib/itemFit.js` | Pure fit logic: paragraph helpers, prompt builder, response normaliser, coherence-floor tier, basis selection, cache-staleness, item summary line | **Create** |
| `src/lib/itemFit.test.js` | Vitest unit tests for `itemFit.js` | **Create** |
| `src/lib/manifesto.js` | Pure helper: split manifesto prose into its 3 labelled paragraphs | **Create** |
| `src/lib/manifesto.test.js` | Vitest unit tests for `manifesto.js` | **Create** |
| `src/lib/ai.js` | Add `generateItemFitWithGemini` orchestration + `FIT_RESPONSE_SCHEMA` | Modify |
| `src/lib/canvas.js` | Add `composeManifestoExportImage(manifesto, measurements)` | Modify (after line 486) |
| `src/views/FinanceView.jsx` | Refine `StyleManifestoCard` (labels, pull-quote, sign-off, Share); add `ManifestoShareModal` | Modify (16–111, 800–914) |
| `src/App.jsx` | Pass `inspirations` + `onSaveFit` to `ItemDetailView`; render Verdict section; add candidate check to `AddItemModal`; pass `measurements`/`inspirations` to `AddItemModal` | Modify (2048–2082, 2394+, 3524+) |
| `package.json` | Add Vitest dev dep + `test` script | Modify |

---

## Task 0: Scaffold Vitest

**Files:**
- Modify: `package.json`
- Create: `src/lib/smoke.test.js` (temporary, deleted in step 6)

- [ ] **Step 1: Install Vitest**

Run:
```bash
npm install -D vitest
```
Expected: `vitest` added to `devDependencies`, no errors.

- [ ] **Step 2: Add the test script**

In `package.json`, add to the `"scripts"` object (after `"preview": "vite preview",`):
```json
    "test": "vitest run",
    "test:watch": "vitest",
```

- [ ] **Step 3: Write a smoke test**

Create `src/lib/smoke.test.js`:
```js
import { describe, it, expect } from 'vitest';

describe('vitest smoke', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 4: Run the smoke test**

Run: `npm test`
Expected: PASS — 1 test passed. Vitest auto-detects `*.test.js` with no config needed (Vite project).

- [ ] **Step 5: Commit the scaffold**

```bash
git add package.json package-lock.json src/lib/smoke.test.js
git commit -m "test: scaffold Vitest for pure-logic unit tests"
```

- [ ] **Step 6: Remove the smoke test**

```bash
rm src/lib/smoke.test.js
git add -A && git commit -m "test: remove vitest smoke placeholder"
```

---

## Task 1: Manifesto paragraph split (pure + tested)

The generator (`generateStyleManifestoWithGemini`) always produces exactly 3 paragraphs in a fixed order: aesthetic, colour/texture, tension. This helper splits the stored string so the card can label each.

**Files:**
- Create: `src/lib/manifesto.js`
- Test: `src/lib/manifesto.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/lib/manifesto.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { splitManifestoParagraphs } from './manifesto.js';

describe('splitManifestoParagraphs', () => {
  it('splits three blank-line-separated paragraphs into labelled parts', () => {
    const text = 'Para one about aesthetic.\n\nPara two about colour.\n\nPara three about tension.';
    expect(splitManifestoParagraphs(text)).toEqual({
      signature: 'Para one about aesthetic.',
      colour: 'Para two about colour.',
      aspiration: 'Para three about tension.',
    });
  });

  it('tolerates multiple blank lines and trims whitespace', () => {
    const text = '  A. \n\n\n B. \n\n C. ';
    expect(splitManifestoParagraphs(text)).toEqual({ signature: 'A.', colour: 'B.', aspiration: 'C.' });
  });

  it('returns null when the text does not split into 3 paragraphs', () => {
    expect(splitManifestoParagraphs('Only one paragraph.')).toBeNull();
    expect(splitManifestoParagraphs('')).toBeNull();
    expect(splitManifestoParagraphs(null)).toBeNull();
  });

  it('merges extra paragraphs into the third part so nothing is lost', () => {
    const text = 'A.\n\nB.\n\nC.\n\nD.';
    expect(splitManifestoParagraphs(text)).toEqual({ signature: 'A.', colour: 'B.', aspiration: 'C.\n\nD.' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- manifesto`
Expected: FAIL — "Failed to resolve import './manifesto.js'" / function not defined.

- [ ] **Step 3: Implement the helper**

Create `src/lib/manifesto.js`:
```js
// Pure helpers for the Style Manifesto. No Firebase/React imports — unit-tested.

// Split the stored manifesto prose into its three fixed paragraphs.
// The generator promises exactly 3 (aesthetic / colour-texture / tension).
// Returns null if the text can't be split into at least 3, so callers can
// fall back to rendering the raw string.
export function splitManifestoParagraphs(manifesto) {
  if (!manifesto || typeof manifesto !== 'string') return null;
  const parts = manifesto
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length < 3) return null;
  const [signature, colour, ...rest] = parts;
  return { signature, colour, aspiration: rest.join('\n\n') };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- manifesto`
Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/manifesto.js src/lib/manifesto.test.js
git commit -m "feat(manifesto): pure paragraph-split helper for labelled rendering"
```

---

## Task 2: Manifesto card presentation refinements

Refine `StyleManifestoCard` ([src/views/FinanceView.jsx:800](src/views/FinanceView.jsx)): per-paragraph labels, aspiration pull-quote, Concierge sign-off. (Share button is added in Task 3.) Verified by running the app.

**Files:**
- Modify: `src/views/FinanceView.jsx` (the manifesto text render block, ~lines 905–912, inside `StyleManifestoCard`)

- [ ] **Step 1: Import the split helper**

At the top of `src/views/FinanceView.jsx`, add to the existing import block:
```js
import { splitManifestoParagraphs } from '../lib/manifesto.js';
```

- [ ] **Step 2: Add a labelled-paragraph sub-component**

Immediately above `function StyleManifestoCard(` in `src/views/FinanceView.jsx`, add:
```jsx
function ManifestoBody({ text }) {
  const parts = splitManifestoParagraphs(text);
  if (!parts) {
    // Fallback: render raw prose when it isn't cleanly 3 paragraphs.
    return <div className="whitespace-pre-line">{text}</div>;
  }
  const Label = ({ children }) => (
    <div className="font-sans text-[10px] tracking-[0.18em] uppercase text-[#9a7b4f] mb-1.5">{children}</div>
  );
  return (
    <div className="not-italic">
      <Label>Your signature</Label>
      <p className="italic mb-5">{parts.signature}</p>
      <Label>Colour and texture</Label>
      <p className="italic mb-5">{parts.colour}</p>
      <Label>What you’re reaching for</Label>
      <p className="italic text-[17px] leading-relaxed pl-4 border-l-2 border-[#c9a85f] text-stone-900 mb-4">{parts.aspiration}</p>
      <div className="font-display italic text-stone-500 text-right">— Your Concierge</div>
    </div>
  );
}
```

- [ ] **Step 3: Render `ManifestoBody` instead of raw text**

In `StyleManifestoCard`, find the manifesto text block (the `<div className="bg-[#F7F5F2] ...">` that renders `{isStreaming ? streamingText : manifesto}`). Replace the body so that streaming still shows raw text but the finished manifesto uses `ManifestoBody`:
```jsx
{(manifesto || isStreaming) && (
  <div className="relative z-10 mt-6 bg-[#F7F5F2] text-stone-800 rounded-2xl p-6 sm:p-8 text-sm sm:text-[15px] leading-[1.8] font-display">
    {isStreaming ? (
      <div className="whitespace-pre-line italic">{streamingText}<span className="inline-block w-0.5 h-4 align-middle ml-0.5 bg-stone-700 animate-pulse" /></div>
    ) : (
      <ManifestoBody text={manifesto} />
    )}
    {!isStreaming && generatedAt && (
      <p className="text-[10px] tracking-widest uppercase text-stone-400 mt-5 font-sans not-italic">
        Written {new Date(generatedAt).toLocaleDateString('en-GB')}
      </p>
    )}
  </div>
)}
```

- [ ] **Step 4: Verify in the app**

Run: `npm run dev`
Then use the preview tools: open the app, go to the Insights tab, and confirm a generated manifesto now shows three labelled paragraphs, the third as a brass-bordered pull-quote, and a "— Your Concierge" sign-off. Confirm streaming still shows the live cursor and raw text while writing. Screenshot to confirm.

- [ ] **Step 5: Commit**

```bash
git add src/views/FinanceView.jsx
git commit -m "feat(manifesto): labelled paragraphs, aspiration pull-quote, sign-off"
```

---

## Task 3: Share-as-card export

Clone the Style DNA export pipeline to render the manifesto as a 1080×1920 branded PNG, with a share/download modal and a Share button on the card.

**Files:**
- Modify: `src/lib/canvas.js` (add after line 486, before `shareOrDownloadImage`)
- Modify: `src/views/FinanceView.jsx` (`StyleManifestoCard` header buttons + new `ManifestoShareModal`)

- [ ] **Step 1: Add the canvas composer**

In `src/lib/canvas.js`, add this function (it reuses the same constants/idioms as `composeStyleDNAExportImage`):
```js
// Render the Style Manifesto as a shareable 1080x1920 PNG (Instagram Story).
export async function composeManifestoExportImage(manifesto, measurements = {}) {
  const text = (manifesto || measurements?.styleManifesto || '').trim();
  if (!text) throw new Error('Generate your Style Manifesto first.');

  if (document.fonts?.ready) {
    try { await document.fonts.ready; } catch { /* non-blocking */ }
  }

  const W = 1080, H = 1920, PAD = 96;
  const BRASS = '#C9A66B', PAGE = '#F7F5F2', INK = '#1c1917', MUTED = '#78716c';
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Background
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, H);

  // Header
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = BRASS;
  ctx.font = '600 28px Inter, system-ui, sans-serif';
  ctx.fillText('A PRIVATE BRIEF, BY THE CONCIERGE', PAD, PAD + 40);
  ctx.fillStyle = '#ffffff';
  ctx.font = "italic 64px 'Playfair Display', Georgia, serif";
  ctx.fillText('Style Manifesto', PAD, PAD + 130);

  // Ivory body panel
  const panelX = PAD, panelY = PAD + 190, panelW = W - PAD * 2, panelH = H - panelY - PAD - 70;
  roundRect(ctx, panelX, panelY, panelW, panelH, 36);
  ctx.fillStyle = PAGE;
  ctx.fill();

  // Body text — wrapped, italic serif
  ctx.fillStyle = '#3f3a36';
  ctx.font = "italic 38px 'Playfair Display', Georgia, serif";
  const lineHeight = 60;
  const innerX = panelX + 56;
  let y = panelY + 90;
  const maxTextW = panelW - 112;
  for (const paragraph of text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)) {
    y = wrapText(ctx, paragraph, innerX, y, maxTextW, lineHeight);
    y += lineHeight * 0.6; // paragraph gap
  }

  // Sign-off
  ctx.fillStyle = MUTED;
  ctx.font = "italic 32px 'Playfair Display', Georgia, serif";
  ctx.textAlign = 'right';
  ctx.fillText('— Your Concierge', panelX + panelW - 56, panelY + panelH - 50);
  ctx.textAlign = 'left';

  // Footer wordmark
  ctx.fillStyle = BRASS;
  ctx.font = '600 30px Inter, system-ui, sans-serif';
  ctx.fillText('myatelier.style', PAD, H - PAD + 20);

  const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
  if (!blob) throw new Error('Could not generate the image. Try again.');
  return blob;
}

// Draw `text` wrapped to `maxW`, return the new y after the last line.
function wrapText(ctx, text, x, y, maxW, lineHeight) {
  const words = text.split(/\s+/);
  let line = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y);
      y += lineHeight;
      line = word;
    } else {
      line = test;
    }
  }
  if (line) { ctx.fillText(line, x, y); y += lineHeight; }
  return y;
}

// Path a rounded rectangle (call ctx.fill()/stroke() after).
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
```
Note: if `canvas.js` already defines a `roundRect`/`wrapText` helper, reuse the existing one and delete the duplicate here (check before adding).

- [ ] **Step 2: Add the share modal in FinanceView**

In `src/views/FinanceView.jsx`, add the import:
```js
import { composeManifestoExportImage, shareOrDownloadImage } from '../lib/canvas.js';
```
(If `composeStyleDNAExportImage`/`shareOrDownloadImage` are already imported from `'../lib/canvas.js'`, extend that existing import line instead of adding a second.)

Then add, above `StyleManifestoCard`:
```jsx
function ManifestoShareModal({ manifesto, measurements, onClose }) {
  const [imageUrl, setImageUrl] = useState(null);
  const [imageBlob, setImageBlob] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    composeManifestoExportImage(manifesto, measurements)
      .then((blob) => {
        if (cancelled) return;
        setImageBlob(blob);
        setImageUrl(URL.createObjectURL(blob));
      })
      .catch((e) => setError(e?.message || 'Could not compose your manifesto card.'));
    return () => { cancelled = true; };
  }, [manifesto, measurements]);

  const handleShare = async () => {
    if (!imageBlob) return;
    await shareOrDownloadImage(imageBlob, 'style-manifesto-atelier.png', {
      title: 'My Style Manifesto',
      text: 'My Style Manifesto — written by Atelier.',
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl p-5 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
        {error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : imageUrl ? (
          <img src={imageUrl} alt="Style Manifesto card" className="w-full rounded-lg" />
        ) : (
          <p className="text-sm text-stone-500 py-10 text-center">Composing your card…</p>
        )}
        <div className="flex gap-2 mt-4">
          <button onClick={handleShare} disabled={!imageBlob} className="flex-1 bg-stone-900 text-white rounded-full py-2.5 text-sm disabled:opacity-40">Share</button>
          <button onClick={onClose} className="px-5 rounded-full border border-stone-300 text-sm">Close</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Wire a Share button into the card**

Inside `StyleManifestoCard`, add state near the other `useState` calls:
```js
const [showShare, setShowShare] = useState(false);
```
Then, in the header button row (next to the Generate/Refresh button), add a Share button that only appears once a manifesto exists:
```jsx
{manifesto && !isStreaming && (
  <button onClick={() => setShowShare(true)} className="text-xs tracking-wider uppercase px-4 py-2.5 rounded-full border border-stone-600 text-stone-200 inline-flex items-center gap-1.5">
    Share
  </button>
)}
```
And render the modal at the end of the component's returned JSX (before the closing `</div>` of the root card):
```jsx
{showShare && (
  <ManifestoShareModal manifesto={manifesto} measurements={measurements} onClose={() => setShowShare(false)} />
)}
```

- [ ] **Step 4: Verify in the app**

Run: `npm run dev`
With a generated manifesto on the Insights tab, click Share. Confirm the modal composes a 1080×1920 card showing the manifesto prose, "— Your Concierge", and the "myatelier.style" wordmark, and that Share/Download works. Screenshot the composed card.

- [ ] **Step 5: Commit**

```bash
git add src/lib/canvas.js src/views/FinanceView.jsx
git commit -m "feat(manifesto): share-as-card PNG export"
```

---

## Task 4: Fit-score pure logic (TDD)

All pure, dependency-free logic for the fit score. No Firebase imports, so it's fully unit-testable.

**Files:**
- Create: `src/lib/itemFit.js`
- Test: `src/lib/itemFit.test.js`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/itemFit.test.js`:
```js
import { describe, it, expect } from 'vitest';
import {
  clamp01, fitTier, selectAspirationBasis, isFitStale,
  buildItemSummaryLine, buildItemFitPrompt, parseAndNormalizeFit,
} from './itemFit.js';

describe('clamp01', () => {
  it('clamps to [0,1] and coerces NaN to 0', () => {
    expect(clamp01(1.4)).toBe(1);
    expect(clamp01(-0.2)).toBe(0);
    expect(clamp01(0.5)).toBe(0.5);
    expect(clamp01(NaN)).toBe(0);
    expect(clamp01('x')).toBe(0);
  });
});

describe('fitTier (coherence floor)', () => {
  it('caps off-aesthetic items low regardless of aspiration', () => {
    expect(fitTier(0.2, 0.95)).toBe('A departure');
  });
  it('rewards coherent, gap-closing items', () => {
    expect(fitTier(0.95, 0.9)).toBe('Unmistakably you');
  });
  it('returns a middle tier for coherent-but-modest aspiration', () => {
    expect(fitTier(0.8, 0.3)).toBe('A considered reach');
  });
});

describe('selectAspirationBasis', () => {
  it('uses inspirations when at least one is analysed', () => {
    expect(selectAspirationBasis([{ analysis: { summary: 'x' } }])).toBe('inspirations');
  });
  it('falls back to profile when none are analysed', () => {
    expect(selectAspirationBasis([])).toBe('profile');
    expect(selectAspirationBasis([{ caption: 'no analysis' }])).toBe('profile');
    expect(selectAspirationBasis(null)).toBe('profile');
  });
});

describe('isFitStale', () => {
  it('is stale when no cached fit exists', () => {
    expect(isFitStale({}, '2026-06-01T00:00:00Z')).toBe(true);
  });
  it('is fresh when cached manifestoAt matches current', () => {
    expect(isFitStale({ manifestoFit: { manifestoAt: 'A' } }, 'A')).toBe(false);
  });
  it('is stale when the manifesto has been regenerated since', () => {
    expect(isFitStale({ manifestoFit: { manifestoAt: 'A' } }, 'B')).toBe(true);
  });
});

describe('buildItemSummaryLine', () => {
  it('formats name, brand, category and attributes', () => {
    const line = buildItemSummaryLine({
      name: 'Camel coat', brand: 'The Row', category: 'Outerwear', subCategory: 'Coats',
      colors: ['Camel'], styles: ['Smart', 'Minimal'],
    });
    expect(line).toContain('Camel coat');
    expect(line).toContain('The Row');
    expect(line).toContain('Outerwear/Coats');
    expect(line).toContain('colours=Camel');
    expect(line).toContain('styles=Smart,Minimal');
  });
  it('handles missing fields gracefully', () => {
    expect(buildItemSummaryLine({ name: 'Thing' })).toContain('Thing');
  });
});

describe('buildItemFitPrompt', () => {
  const base = { itemLine: '- Camel coat (The Row)', manifesto: 'You wear quiet tailoring.', styleProfile: 'Style profile: polished.' };
  it('includes the item, manifesto and adapts wording for inspirations basis', () => {
    const p = buildItemFitPrompt({ ...base, inspirationsSummary: '- editorial minimalism', basis: 'inspirations' });
    expect(p).toContain('Camel coat');
    expect(p).toContain('You wear quiet tailoring.');
    expect(p).toContain('what you save');
  });
  it('adapts wording for the profile basis', () => {
    const p = buildItemFitPrompt({ ...base, inspirationsSummary: '', basis: 'profile' });
    expect(p).toContain('the style you’ve described');
  });
});

describe('parseAndNormalizeFit', () => {
  it('parses, clamps and derives the tier', () => {
    const raw = JSON.stringify({ verdict: 'It belongs.', coherence: 1.3, aspiration: 0.9, dimensions: [{ label: 'Palette', state: 'Aligned', level: 0.92 }] });
    const out = parseAndNormalizeFit(raw, { basis: 'inspirations' });
    expect(out.verdict).toBe('It belongs.');
    expect(out.coherence).toBe(1);
    expect(out.tier).toBe('Unmistakably you');
    expect(out.dimensions).toHaveLength(1);
    expect(out.basis).toBe('inspirations');
  });
  it('throws a friendly error on invalid JSON', () => {
    expect(() => parseAndNormalizeFit('not json', {})).toThrow(/unexpected format/i);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- itemFit`
Expected: FAIL — cannot resolve `./itemFit.js`.

- [ ] **Step 3: Implement the module**

Create `src/lib/itemFit.js`:
```js
// Pure fit-score logic. NO Firebase/React imports — fully unit-tested.
// The Gemini-calling orchestration lives in ai.js (generateItemFitWithGemini).

export function clamp01(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(1, x));
}

// Overall tier with a coherence floor: an item far outside the user's
// aesthetic can never score high just for being aspirational/different.
export function fitTier(coherence, aspiration) {
  const c = clamp01(coherence);
  const a = clamp01(aspiration);
  if (c < 0.4) return 'A departure';
  const overall = 0.55 * c + 0.45 * a;
  if (overall >= 0.78) return 'Unmistakably you';
  if (overall >= 0.58) return 'A strong fit';
  if (overall >= 0.42) return 'A considered reach';
  return 'A departure';
}

// Aspiration is measured against saved inspirations when any are analysed,
// otherwise against the declared style-profile quiz.
export function selectAspirationBasis(inspirations) {
  const analysed = (inspirations || []).filter((i) => i && i.analysis && i.analysis.summary);
  return analysed.length > 0 ? 'inspirations' : 'profile';
}

// A cached fit is stale if absent or computed against an older manifesto.
export function isFitStale(item, currentManifestoAt) {
  const fit = item && item.manifestoFit;
  if (!fit) return true;
  if (!currentManifestoAt) return false;
  return fit.manifestoAt !== currentManifestoAt;
}

// One-line item summary, mirroring the manifesto generator's format.
export function buildItemSummaryLine(item) {
  const i = item || {};
  const cat = i.subCategory ? `${i.category || '?'}/${i.subCategory}` : (i.category || '?');
  const colours = (i.colors || []).join(',') || '-';
  const styles = (i.styles || []).join(',') || '-';
  return `- ${i.name || 'Untitled'} (${i.brand || '?'}) · ${cat} · colours=${colours} · styles=${styles}`;
}

// Build the structured-JSON scoring prompt. Pure string assembly.
export function buildItemFitPrompt({ itemLine, manifesto, inspirationsSummary = '', styleProfile = '', basis = 'profile' }) {
  const aspirationSource = basis === 'inspirations'
    ? `What they SAVE as inspiration (their aspiration):\n${inspirationsSummary}`
    : `They have no saved inspirations yet, so judge aspiration against the style you’ve described below.`;
  const verdictGuidance = basis === 'inspirations'
    ? 'Tie the verdict to what they save — name the gap this piece closes.'
    : 'Tie the verdict to the style they’ve described.';
  return `You are a senior fashion editor judging, in private, how well ONE item fits a client.

The item under consideration:
${itemLine}

Their Style Manifesto:
${manifesto}

${styleProfile}

${aspirationSource}

Return ONLY JSON with this shape:
{
  "verdict": "one warm, specific sentence (max 30 words). ${verdictGuidance} No clichés, no the words 'stylish' or 'trendy'. UK English.",
  "coherence": 0.0-1.0,  // how well this sits within their EXISTING aesthetic universe
  "aspiration": 0.0-1.0,  // how much it moves them toward what they reach for
  "dimensions": [ {"label":"Palette","state":"Aligned|A reach|Off","level":0.0-1.0}, {"label":"Silhouette",...}, {"label":"Formality",...} ]
}`;
}

// Parse + normalise the model's JSON into the shape the UI consumes.
export function parseAndNormalizeFit(rawText, { basis = 'profile' } = {}) {
  let p;
  try { p = JSON.parse(rawText); } catch { throw new Error('The Concierge replied in an unexpected format.'); }
  const coherence = clamp01(p.coherence);
  const aspiration = clamp01(p.aspiration);
  const dimensions = Array.isArray(p.dimensions)
    ? p.dimensions.map((d) => ({ label: String(d?.label || ''), state: String(d?.state || ''), level: clamp01(d?.level) }))
    : [];
  return {
    verdict: String(p.verdict || '').trim(),
    coherence,
    aspiration,
    tier: fitTier(coherence, aspiration),
    dimensions,
    basis,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- itemFit`
Expected: PASS — all describe blocks green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/itemFit.js src/lib/itemFit.test.js
git commit -m "feat(fit): pure fit-score logic with coherence floor (TDD)"
```

---

## Task 5: `generateItemFitWithGemini` orchestration

Thin function in `ai.js` that builds the prompt, calls Gemini in JSON mode, and normalises the result. Verified in-app (Task 6); no unit test (mocking Firebase is out of scope per the chosen test strategy).

**Files:**
- Modify: `src/lib/ai.js`

- [ ] **Step 1: Add imports**

At the top of `src/lib/ai.js`, add (the `Schema` and `geminiText` symbols are already imported from the firebase module — do NOT re-import them; only add the itemFit import):
```js
import { buildItemFitPrompt, parseAndNormalizeFit, selectAspirationBasis, buildItemSummaryLine } from './itemFit.js';
```

- [ ] **Step 2: Define the response schema**

Near the other `Schema.object(...)` definitions in `ai.js` (e.g. beside `OUTFIT_RESPONSE_SCHEMA` ~line 14), add:
```js
const FIT_RESPONSE_SCHEMA = Schema.object({
  properties: {
    verdict: Schema.string(),
    coherence: Schema.number(),
    aspiration: Schema.number(),
    dimensions: Schema.array({
      items: Schema.object({
        properties: {
          label: Schema.string(),
          state: Schema.string(),
          level: Schema.number(),
        },
      }),
    }),
  },
});
```

- [ ] **Step 3: Add the function**

Add to `src/lib/ai.js` (near `generateStyleFitWithGemini`):
```js
// Judge how well a single item fits the user's style. Returns the normalised
// fit object: { verdict, coherence, aspiration, tier, dimensions, basis }.
export async function generateItemFitWithGemini({ item, manifesto, inspirations = [], styleProfile = '' }) {
  if (!manifesto) throw new Error('Generate your Style Manifesto first to unlock fit readings.');
  const basis = selectAspirationBasis(inspirations);
  const inspirationsSummary = basis === 'inspirations'
    ? inspirations
        .filter((i) => i && i.analysis && i.analysis.summary)
        .slice(0, 12)
        .map((i) => `- ${i.caption || 'saved'}: ${i.analysis.summary}`)
        .join('\n')
    : '';
  const prompt = buildItemFitPrompt({
    itemLine: buildItemSummaryLine(item),
    manifesto,
    inspirationsSummary,
    styleProfile,
    basis,
  });
  const text = await geminiText(prompt, { temperature: 0.6, jsonMode: true, responseSchema: FIT_RESPONSE_SCHEMA }, 'item-fit');
  return parseAndNormalizeFit(text, { basis });
}
```

- [ ] **Step 4: Verify it builds**

Run: `npm run build`
Expected: build succeeds with no import/reference errors. (Behaviour is exercised in Task 6.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/ai.js
git commit -m "feat(fit): generateItemFitWithGemini orchestration (Gemini JSON mode)"
```

---

## Task 6: Verdict in the item-detail view (wishlist items)

Surface the Verdict + expandable dimensional read in `ItemDetailView`, cached on the item and recomputed only when the manifesto changes.

**Files:**
- Modify: `src/App.jsx` — `ItemDetailView` render (props ~line 2048; component body ~line 3524; insert near the existing fit panels ~line 4087)

- [ ] **Step 1: Pass `inspirations` and an `onSaveFit` callback to `ItemDetailView`**

In `src/App.jsx` where `<ItemDetailView ... />` is rendered (~line 2048), add these props:
```jsx
  inspirations={inspirations}
  onSaveFit={(fit) => handleAddItem({
    ...selectedItem,
    manifestoFit: { ...fit, manifestoAt: measurements?.styleManifestoAt || null },
  })}
```
(`inspirations` and `measurements` are already in scope here; `handleAddItem` is the upsert at line 569.)

- [ ] **Step 2: Add imports the detail view needs**

Ensure `src/App.jsx` imports these (add any that are missing to the existing import lines):
```js
import { generateItemFitWithGemini } from './lib/ai.js';
import { isFitStale } from './lib/itemFit.js';
import { summariseStyleProfile } from './lib/items.js';
```

- [ ] **Step 3: Accept the new props in the component**

In the `ItemDetailView` function signature (~line 3524), add `inspirations = []` and `onSaveFit` to the destructured props.

- [ ] **Step 4: Add a Verdict section component**

Above `function ItemDetailView(` in `src/App.jsx`, add:
```jsx
function FitVerdictSection({ item, measurements, inspirations, onSaveFit }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const manifesto = measurements?.styleManifesto || '';
  const cached = item?.manifestoFit;
  const stale = isFitStale(item, measurements?.styleManifestoAt || null);

  if (!manifesto) {
    return (
      <div className="rounded-2xl border border-stone-200 p-5 text-sm text-stone-500">
        Generate your <span className="font-medium">Style Manifesto</span> on the Insights tab to unlock a fit reading for this piece.
      </div>
    );
  }

  const run = async () => {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      const fit = await generateItemFitWithGemini({
        item, manifesto, inspirations,
        styleProfile: summariseStyleProfile(measurements),
      });
      onSaveFit(fit);
    } catch (e) {
      setError(e?.message || 'Could not read this against your style.');
    } finally {
      setBusy(false);
    }
  };

  const fit = (!stale && cached) ? cached : null;

  return (
    <div className="rounded-2xl bg-stone-900 text-white p-5">
      <div className="text-[10px] tracking-[0.18em] uppercase text-[#c9a85f] mb-2">The Concierge’s read</div>
      {fit ? (
        <>
          <p className="font-display italic text-[15px] leading-relaxed text-[#F7F5F2]">{fit.verdict}</p>
          <div className="text-xs text-stone-400 mt-2">{fit.tier}</div>
          <button onClick={() => setExpanded((v) => !v)} className="text-xs underline text-stone-300 mt-3">
            {expanded ? 'Hide the detail' : 'Why?'}
          </button>
          {expanded && (
            <div className="mt-3 space-y-2">
              {fit.dimensions.map((d, idx) => (
                <div key={idx}>
                  <div className="flex justify-between text-[11px] text-stone-400"><span>{d.label}</span><span>{d.state}</span></div>
                  <div className="h-1 rounded-full bg-stone-700 overflow-hidden"><div className="h-full bg-[#c9a85f]" style={{ width: `${Math.round(d.level * 100)}%` }} /></div>
                </div>
              ))}
            </div>
          )}
          <button onClick={run} disabled={busy} className="text-[11px] uppercase tracking-wider text-stone-400 mt-4 disabled:opacity-40">{busy ? 'Reading…' : 'Re-read'}</button>
        </>
      ) : (
        <>
          <p className="text-sm text-stone-300">See how this piece sits with your style.</p>
          <button onClick={run} disabled={busy} className="mt-3 bg-[#c9a85f] text-stone-900 rounded-full px-5 py-2 text-xs uppercase tracking-wider disabled:opacity-40">
            {busy ? 'Reading…' : 'Read against my style'}
          </button>
        </>
      )}
      {error && <p className="text-xs text-red-300 mt-3">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 5: Render it for wishlist items**

In `ItemDetailView`'s content column, just before the existing "Will it fit?" panel (~line 4044), add:
```jsx
{item.status === 'wishlist' && (
  <FitVerdictSection item={item} measurements={measurements} inspirations={inspirations} onSaveFit={onSaveFit} />
)}
```

- [ ] **Step 6: Verify in the app**

Run: `npm run dev`. With a generated manifesto, open a wishlist item.
- Confirm the dark Verdict card appears with a "Read against my style" button.
- Click it: a one-sentence verdict + tier appears; "Why?" expands the dimensional bars.
- Close and re-open the item: the cached verdict shows immediately (no recompute).
- Regenerate the manifesto on Insights, re-open the item: it offers a fresh read (cache invalidated).
- Open an item with no manifesto generated: confirm the "Generate your Style Manifesto" hint shows instead.
Screenshot the verdict and the expanded dimensions.

- [ ] **Step 7: Commit**

```bash
git add src/App.jsx
git commit -m "feat(fit): Verdict + dimensional read on wishlist item detail, cached per manifesto"
```

---

## Task 7: Candidate "Should I buy this?" check in the add-item flow

Let the user score an item they're considering, before saving — reusing the same engine inside `AddItemModal` step 2.

**Files:**
- Modify: `src/App.jsx` — `AddItemModal` (component ~line 2394; rendered where `onSave`/`isAddItemModalOpen` are wired)

- [ ] **Step 1: Pass `measurements` and `inspirations` to `AddItemModal`**

Where `<AddItemModal ... />` is rendered in `src/App.jsx`, add:
```jsx
  measurements={measurements}
  inspirations={inspirations}
```
And add `measurements`, `inspirations = []` to the `AddItemModal` function's destructured props (~line 2394).

- [ ] **Step 2: Add fit state + a check handler inside `AddItemModal`**

Near the modal's other `useState` calls, add:
```js
const [fitCheck, setFitCheck] = useState(null);
const [fitBusy, setFitBusy] = useState(false);
const [fitError, setFitError] = useState(null);

const runFitCheck = async () => {
  if (fitBusy) return;
  setFitBusy(true); setFitError(null);
  try {
    const fit = await generateItemFitWithGemini({
      item: {
        name: formData.name, brand: formData.brand, category: formData.category,
        subCategory: formData.subCategory, colors: formData.colors, styles: formData.styles,
      },
      manifesto: measurements?.styleManifesto || '',
      inspirations,
      styleProfile: summariseStyleProfile(measurements),
    });
    setFitCheck(fit);
  } catch (e) {
    setFitError(e?.message || 'Could not check the fit.');
  } finally {
    setFitBusy(false);
  }
};
```
(`generateItemFitWithGemini` and `summariseStyleProfile` are imported in `App.jsx` from Task 6 — no new import needed.)

- [ ] **Step 3: Add the UI in step 2**

In the step-2 form area (before the submit/Save button), add:
```jsx
{measurements?.styleManifesto && (
  <div className="mt-4 rounded-xl border border-stone-200 p-4">
    {fitCheck ? (
      <>
        <div className="text-[10px] uppercase tracking-[0.18em] text-[#9a7b4f] mb-1">Should you buy this?</div>
        <p className="font-display italic text-sm text-stone-800">{fitCheck.verdict}</p>
        <div className="text-xs text-stone-500 mt-1">{fitCheck.tier}</div>
      </>
    ) : (
      <button type="button" onClick={runFitCheck} disabled={fitBusy || !formData.name} className="text-sm text-stone-700 underline disabled:opacity-40">
        {fitBusy ? 'Reading…' : 'Check this against my style'}
      </button>
    )}
    {fitError && <p className="text-xs text-red-600 mt-2">{fitError}</p>}
  </div>
)}
```

- [ ] **Step 4: Verify in the app**

Run: `npm run dev`. With a manifesto generated, open Add Item, fill in name/brand/category/colours/styles, and click "Check this against my style". Confirm a verdict + tier appears before saving, and that saving still works normally afterwards. Confirm the block is hidden when no manifesto exists. Screenshot.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "feat(fit): 'should I buy this?' style check in the add-item flow"
```

---

## Self-Review (completed by plan author)

**Spec coverage:**
- Presentation: per-paragraph labels, aspiration pull-quote, sign-off → Task 2. Share-as-card → Task 3. ✓
- Engine (coherence × aspiration → verdict + dimensions, Gemini JSON, cold-start basis) → Tasks 4–5. ✓
- Cold start (inspirations → profile fallback) → `selectAspirationBasis` (Task 4), wired in Task 5. ✓
- Coherence floor → `fitTier` (Task 4). ✓
- Caching against `styleManifestoAt` → `isFitStale` (Task 4), wired in Task 6. ✓
- In-app surfaces: wishlist verdict → Task 6; candidate check → Task 7. ✓
- Vitest for the engine → Task 0 + tests in Tasks 1, 4. ✓
- Phase 2 (public taste-test) intentionally excluded. ✓

**Placeholder scan:** No TBD/TODO; every code step has complete, runnable code.

**Type consistency:** The fit object shape `{ verdict, coherence, aspiration, tier, dimensions, basis }` is produced by `parseAndNormalizeFit` (Task 4) and consumed identically in Tasks 6–7. The cached shape adds `manifestoAt` (Task 6, written in `onSaveFit`; read by `isFitStale`). `generateItemFitWithGemini` signature is identical across Tasks 5–7.

**Note for implementer:** Verify before adding — if `canvas.js` already exports `wrapText`/`roundRect` helpers, reuse them rather than redefining (Task 3, Step 1).
