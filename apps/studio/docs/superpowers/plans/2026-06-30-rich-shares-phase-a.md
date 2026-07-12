# Rich Shareable Links — Phase A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Pinterest (and any image-share) use the *real* 1080×1920 card image, across all three cards (outfit · Style DNA · Manifesto), by hosting each card PNG publicly and passing it to Pinterest as `media`.

**Architecture:** Add Firebase Storage (greenfield). A new dependency-light module `src/lib/publicShare.js` holds a pure Pinterest-URL builder (Vitest-tested) plus Storage/Firestore helpers. Outfit sharing gains an image upload; Style DNA and Manifesto gain a lightweight `kind:'card'` public-share path. Each share doc carries a `cardImageUrl` (public Storage URL) used as Pinterest's `media`.

**Tech Stack:** React + Vite + Firebase (Firestore, **Storage [new]**, Hosting). Vitest for the pure URL builder.

**Spec:** `docs/superpowers/specs/2026-06-30-rich-shareable-links-pinterest-design.md` (Phase A only; Phase B = separate plan).

---

## File Structure

| File | Responsibility | Create/Modify |
|------|----------------|---------------|
| `src/lib/publicShare.js` | Pure `buildPinterestUrl`; `uploadShareCardImage`; `createCardShare` | **Create** |
| `src/lib/publicShare.test.js` | Vitest for `buildPinterestUrl` | **Create** |
| `src/firebase.js` | Initialise + export `storage`; export `createCardShareDoc` helper deps | Modify (imports + init + exports) |
| `storage.rules` | Public read for `public-shares/**`, owner-only write | **Create** |
| `firebase.json` | Register `storage` rules | Modify |
| `src/App.jsx` | `handleShareOutfit` uploads image → `cardImageUrl`; `ShareLookModal` passes its blob to `onCreateLink` and pins with `media` | Modify (`98–300`, `893–919`, render `1776–1783`) |
| `src/views/InsightsView.jsx` | Add shared "Pin to Pinterest" to `StyleDNAShareModal` + `ManifestoShareModal` via `createCardShare` | Modify (`17–112`, `822–872`) |

**Manual prerequisite (owner, one-time, in the Firebase console):** Build → Storage → "Get started" to provision the default bucket for project `my-digital-wardrobe-444d0` (region `europe-west2` to match Firestore). Without this, uploads fail. This cannot be done from code.

---

## Task 1: Pinterest URL builder (pure, TDD)

**Files:**
- Create: `src/lib/publicShare.js`
- Test: `src/lib/publicShare.test.js`

- [ ] **Step 1: Write the failing test** — create `src/lib/publicShare.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { buildPinterestUrl } from './publicShare.js';

describe('buildPinterestUrl', () => {
  it('builds a create-pin URL with url, media and description, all encoded', () => {
    const out = buildPinterestUrl({
      url: 'https://edit.myatelier.style/?share=abc',
      media: 'https://storage.example.com/public-shares/abc.png',
      description: 'A look from Atelier & co',
    });
    expect(out).toContain('https://www.pinterest.com/pin/create/button/?');
    expect(out).toContain('url=https%3A%2F%2Fedit.myatelier.style%2F%3Fshare%3Dabc');
    expect(out).toContain('media=https%3A%2F%2Fstorage.example.com%2Fpublic-shares%2Fabc.png');
    expect(out).toContain('description=A%20look%20from%20Atelier%20%26%20co');
  });

  it('omits media when not provided', () => {
    const out = buildPinterestUrl({ url: 'https://x.test/', description: 'hi' });
    expect(out).not.toContain('media=');
    expect(out).toContain('url=https%3A%2F%2Fx.test%2F');
  });

  it('throws when url is missing', () => {
    expect(() => buildPinterestUrl({ description: 'no url' })).toThrow(/url is required/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- publicShare`
Expected: FAIL — cannot resolve `./publicShare.js`.

- [ ] **Step 3: Implement** — create `src/lib/publicShare.js`:
```js
// Public-share helpers: a pure Pinterest-URL builder + Storage/Firestore
// helpers for hosting a shareable card image. The URL builder is pure and
// unit-tested; the upload/createCardShare helpers touch Firebase and are
// verified by running the app.
import { storage, db } from '../firebase.js';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, setDoc } from 'firebase/firestore';

const PIN_BASE = 'https://www.pinterest.com/pin/create/button/';

// Pure: assemble Pinterest's create-pin URL. `media` (a public image URL) is
// what makes Pinterest use the exact image instead of scraping the page.
export function buildPinterestUrl({ url, media, description = '' }) {
  if (!url) throw new Error('buildPinterestUrl: url is required');
  const params = new URLSearchParams();
  params.set('url', url);
  if (media) params.set('media', media);
  if (description) params.set('description', description);
  return `${PIN_BASE}?${params.toString()}`;
}

// URL-safe share id (mirrors App.jsx newShareId): 11 chars base36.
export function newShareId() {
  return [...crypto.getRandomValues(new Uint32Array(2))].map((n) => n.toString(36)).join('').slice(0, 11);
}

// Upload a composed card PNG to public Storage; return its public download URL.
export async function uploadShareCardImage(shareId, blob) {
  const r = ref(storage, `public-shares/${shareId}.png`);
  await uploadBytes(r, blob, { contentType: 'image/png', cacheControl: 'public, max-age=31536000, immutable' });
  return getDownloadURL(r);
}

// Create a lightweight `kind:'card'` public share (Style DNA / Manifesto):
// upload the image, write the public doc, return { shareId, url, cardImageUrl }.
export async function createCardShare({ cardType, name, sharedByName, blob }) {
  const shareId = newShareId();
  const cardImageUrl = await uploadShareCardImage(shareId, blob);
  const snapshot = {
    v: 1,
    kind: 'card',
    cardType,                       // 'styleDNA' | 'manifesto'
    name: name || 'Atelier',
    cardImageUrl,
    sharedAt: new Date().toISOString(),
    sharedByName: sharedByName || 'Atelier',
  };
  await setDoc(doc(db, 'public', shareId), snapshot);
  const url = `${window.location.origin}/?share=${shareId}`;
  return { shareId, url, cardImageUrl };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- publicShare`
Expected: PASS — 3 tests. (Only `buildPinterestUrl` is tested; the Firebase helpers are exercised in later tasks via the app.)

- [ ] **Step 5: Commit**
```bash
git add src/lib/publicShare.js src/lib/publicShare.test.js
git commit -m "feat(share): pure Pinterest-URL builder + public-share helpers"
```

---

## Task 2: Initialise Firebase Storage

**Files:**
- Modify: `src/firebase.js`
- Create: `storage.rules`
- Modify: `firebase.json`

- [ ] **Step 1: Add the Storage import + init + export in `src/firebase.js`**

Near the other Firebase SDK imports at the top, add:
```js
import { getStorage } from 'firebase/storage';
```
After the line that creates `db` (search for `export const db`), add:
```js
export const storage = getStorage(app);
```

- [ ] **Step 2: Create `storage.rules`** (public read for shared cards, authenticated owner write):
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    // Shared card images are public artifacts: world-readable, written only
    // by signed-in users, PNG only, capped at 5 MB.
    match /public-shares/{file} {
      allow read: if true;
      allow write: if request.auth != null
                   && request.resource.size < 5 * 1024 * 1024
                   && request.resource.contentType == 'image/png';
    }
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

- [ ] **Step 3: Register storage rules in `firebase.json`**

In `firebase.json`, add a top-level `"storage"` key (sibling of `"firestore"`):
```json
  "storage": {
    "rules": "storage.rules"
  },
```

- [ ] **Step 4: Verify build still compiles**

Run: `npm run build`
Expected: success (the new `storage` export is unused so far but must not break the build).

- [ ] **Step 5: Deploy the storage rules** (requires the manual bucket-enable prerequisite above)

Run: `firebase deploy --only storage`
Expected: "Deploy complete!" If it errors with "bucket does not exist", the owner must enable Storage in the console first (see prerequisite), then re-run.

- [ ] **Step 6: Commit**
```bash
git add src/firebase.js storage.rules firebase.json
git commit -m "feat(share): initialise Firebase Storage with public-shares rules"
```

---

## Task 3: Outfit pin uses the real image (upload + `media`)

Make the existing outfit "Pin to Pinterest" upload its composed image and pin with `media`.

**Files:**
- Modify: `src/App.jsx` — `handleShareOutfit` (893–919), `ShareLookModal` (98–300), render site (1776–1783)

- [ ] **Step 1: Import the helpers in `src/App.jsx`**

Add to the existing import block:
```js
import { buildPinterestUrl, uploadShareCardImage } from './lib/publicShare.js';
```

- [ ] **Step 2: Make `handleShareOutfit` accept an optional image blob, upload it, store `cardImageUrl`**

Replace the body of `handleShareOutfit` (lines 893–919) so it takes `(outfit, cardBlob)` and, when a blob is given, uploads it before writing the doc:
```js
  const handleShareOutfit = async (outfit, cardBlob = null) => {
    if (!user) return null;
    const pieces = resolveOutfitItems(outfit, items).map((p) => ({
      id: p.id,
      name: p.name,
      brand: p.brand || '',
      category: p.category || '',
      subCategory: p.subCategory || '',
      images: (Array.isArray(p.images) ? p.images : (p.image ? [p.image] : [])).slice(0, 1),
      colors: itemColors(p),
    }));
    const shareId = newShareId();
    const title = outfit.name || 'Untitled look';
    let cardImageUrl = null;
    if (cardBlob) {
      try { cardImageUrl = await uploadShareCardImage(shareId, cardBlob); }
      catch (e) { console.warn('[share] card image upload failed:', e?.message); }
    }
    const snapshot = {
      v: 1,
      kind: 'outfit',
      name: title,
      reasoning: outfit.reasoning || '',
      cardImageUrl,
      sharedAt: new Date().toISOString(),
      sharedByName: user.displayName || 'Atelier',
      pieces,
    };
    await setDoc(publicShareDoc(shareId), snapshot);
    const url = `${window.location.origin}/?share=${shareId}`;
    setShareTarget({ url, title, kind: 'outfit' });
    return { url, cardImageUrl };
  };
```
Note: this changes the return from a bare `url` string to `{ url, cardImageUrl }`. The render-site callback and the modal are updated in the next steps to match.

- [ ] **Step 3: Update the `ShareLookModal` render to pass the blob through `onCreateLink`**

At the render site (lines 1776–1783), change `onCreateLink` to accept a blob:
```jsx
{shareModalOutfit && (
  <ShareLookModal
    outfit={shareModalOutfit}
    items={items}
    onClose={() => setShareModalOutfit(null)}
    onCreateLink={(cardBlob) => handleShareOutfit(shareModalOutfit, cardBlob)}
  />
)}
```

- [ ] **Step 4: Update `ShareLookModal`'s "Public link" + Pinterest handlers to pass the blob and pin with `media`**

In `ShareLookModal` (src/App.jsx ~98–300): the component already has `imageBlob` in state (from composing the outfit image). 

(a) The "Public link" button (line 228) calls `onCreateLink()` with no arg — update to pass the blob:
```jsx
<button onClick={() => { onCreateLink(imageBlob); onClose(); }}
```

(b) Replace the Pinterest button's `onClick` (lines 244–271) with the `media`-aware version:
```jsx
                onClick={async () => {
                  if (!imageBlob || busy) return;
                  setBusy(true);
                  try {
                    if (onCreateLink) {
                      try {
                        const res = await onCreateLink(imageBlob);
                        const publicUrl = typeof res === 'string' ? res : res?.url;
                        const cardImageUrl = typeof res === 'object' ? res?.cardImageUrl : null;
                        if (publicUrl) {
                          const pinterestUrl = buildPinterestUrl({
                            url: publicUrl,
                            media: cardImageUrl || undefined,
                            description: outfit?.name || 'A look from Atelier',
                          });
                          window.open(pinterestUrl, '_blank', 'noopener,noreferrer,width=750,height=600');
                          return;
                        }
                      } catch (linkErr) {
                        console.warn('[share] onCreateLink failed:', linkErr?.message);
                      }
                    }
                    handleDownload();
                    window.open('https://www.pinterest.com/pin-builder/', '_blank', 'noopener,noreferrer');
                    toast.show('Image saved — drag it into Pinterest', { kind: 'default', eyebrow: 'TIP' });
                  } finally {
                    setBusy(false);
                  }
                }}
```
The `buildPinterestUrl` import must be available in `ShareLookModal`'s scope — it's imported at the top of `src/App.jsx` (Step 1), same module, so it's in scope.

- [ ] **Step 5: Verify in the app**

Run: `npm run dev`. Open a saved outfit → Share → "Pin to Pinterest" (desktop). Confirm: a Pinterest create-pin tab opens whose pre-filled image is the actual outfit card (not generic). Check `preview_network`/devtools that the pin URL contains a `media=` param pointing at a `public-shares/...png` URL. Also confirm "Public link" still works.

- [ ] **Step 6: Commit**
```bash
git add src/App.jsx
git commit -m "feat(share): outfit pin uploads the card image and pins via media param"
```

---

## Task 4: "Pin to Pinterest" on Style DNA + Manifesto cards

Both modals lack any public-share/pin path. Add a shared affordance backed by `createCardShare`.

**Files:**
- Modify: `src/views/InsightsView.jsx` — imports, `StyleDNAShareModal` (17–112), `ManifestoShareModal` (822–872)

- [ ] **Step 1: Add imports + a reusable PinToPinterest button in `src/views/InsightsView.jsx`**

Add to the imports:
```js
import { buildPinterestUrl, createCardShare } from '../lib/publicShare.js';
```
Then add a small shared component above `StyleDNAShareModal`:
```jsx
function PinToPinterestButton({ imageBlob, busy, setBusy, cardType, name, sharedByName, description }) {
  const toast = useToast();
  return (
    <button
      type="button"
      disabled={!imageBlob || busy}
      onClick={async () => {
        if (!imageBlob || busy) return;
        setBusy(true);
        try {
          const { url, cardImageUrl } = await createCardShare({ cardType, name, sharedByName, blob: imageBlob });
          const pin = buildPinterestUrl({ url, media: cardImageUrl, description });
          window.open(pin, '_blank', 'noopener,noreferrer,width=750,height=600');
        } catch (e) {
          toast.show('Could not open Pinterest. Try “Save image” and pin it manually.', { kind: 'error' });
        } finally {
          setBusy(false);
        }
      }}
      className="w-full h-11 bg-white border border-stone-300 text-stone-700 rounded-full text-[10px] tracking-widest uppercase font-medium hover:border-stone-500 hover:text-stone-900 transition-colors duration-200 inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
    >
      <span className="w-4 h-4 rounded-full bg-[#E60023] text-white text-[9px] font-bold flex items-center justify-center" aria-hidden="true">P</span>
      Pin to Pinterest
    </button>
  );
}
```
(`useToast` is already imported in this file.)

- [ ] **Step 2: Add the button to `StyleDNAShareModal`'s footer**

In `StyleDNAShareModal` (lines 96–107), after the "Save image" button and inside the same footer `div`, add:
```jsx
          <PinToPinterestButton
            imageBlob={imageBlob} busy={busy} setBusy={setBusy}
            cardType="styleDNA" name="My Style DNA"
            sharedByName={measurements?.displayName || ''}
            description="My Style DNA — read by Atelier"
          />
```
`StyleDNAShareModal` already has `imageBlob`, `busy`, `setBusy`, and `measurements` in scope (it composes via `composeStyleDNAExportImage(items, measurements)`).

- [ ] **Step 3: Add the button to `ManifestoShareModal`'s footer**

`ManifestoShareModal` (lines 822–872) currently has no `busy` state. Add it near its other `useState` calls:
```js
  const [busy, setBusy] = useState(false);
```
Then in its footer row (lines 865–868), add the button above the Share/Close row:
```jsx
        <PinToPinterestButton
          imageBlob={imageBlob} busy={busy} setBusy={setBusy}
          cardType="manifesto" name="My Style Manifesto"
          sharedByName="" description="My Style Manifesto — written by Atelier"
        />
```

- [ ] **Step 4: Verify in the app**

Run: `npm run dev`. On Insights: open the Style DNA share modal → "Pin to Pinterest" → a pin opens with the Style DNA image. Repeat for the Manifesto share modal. Confirm (devtools) each pin URL has `media=` pointing at a `public-shares/...png` URL, and that a `public/{shareId}` doc with `kind:'card'` was written (Firestore).

- [ ] **Step 5: Commit**
```bash
git add src/views/InsightsView.jsx
git commit -m "feat(share): pin Style DNA and Manifesto cards to Pinterest with real image"
```

---

## Self-Review (completed by plan author)

**Spec coverage (Phase A):**
- A1 upload card PNG to public Storage → Task 2 (init) + Task 1 (`uploadShareCardImage`) + wired in Tasks 3–4. ✓
- A2 pass image as Pinterest `media` → `buildPinterestUrl` (Task 1), used in Tasks 3–4. ✓
- A3 extend pin to all three modals via a shared helper → Task 3 (outfit) + Task 4 (`PinToPinterestButton` for Style DNA + Manifesto). ✓
- Storage rules / firebase.json → Task 2. ✓
- Vitest on the pure builder → Task 1. ✓
- Phase B (function, `/s/`, landing) intentionally excluded — separate plan.

**Placeholder scan:** none — every code step has complete, runnable code.

**Type consistency:** `handleShareOutfit` now returns `{ url, cardImageUrl }` (Task 3 Step 2); the modal handler (Step 4) handles both the object and a legacy string. `createCardShare` returns `{ shareId, url, cardImageUrl }` (Task 1) and is consumed as `{ url, cardImageUrl }` in Task 4. `uploadShareCardImage(shareId, blob)` signature is identical across Task 1, 3. `buildPinterestUrl({ url, media, description })` identical across Tasks 1, 3, 4.

**Note for implementer:** the manual *Enable Storage* prerequisite (top of plan) must be done before Task 2 Step 5 and before any in-app upload test (Tasks 3–4 Step "Verify").
