# Branded cutout catalogue — white cards, ivory page

**Date:** 2026-06-30
**Status:** Design approved, pending written-spec review
**Scope:** A medium feature in `digital-wardrobe`: turn the item grid into a flawless, branded catalogue — clean cut-out items on white cards floating on the ivory page, nothing cropped.

---

## Goal

Every item should read like a luxury catalogue tile: the product as a clean cut-out on a **white card**, the card floating on the **ivory page** — fully on-brand, nothing cropped, no halos. Reached by background-removing product photos onto white (which the pipeline already does) and showing them whole.

## Locked palette

- **Page:** ivory `#F7F5F2` — unchanged.
- **Card / tile:** white `#FFFFFF` — distinct from the page (definition), and the surface cut-outs sit on.
- **Cutout flatten colour:** white `#FFFFFF` — **already what `canvas.js` does** (`canvas.js:654`); no change. White cut-outs sit seamlessly on white cards.

The rule that drives everything: *a cut-out item must sit on a tile the same colour it was flattened onto* — here, white on white.

---

## Background: what exists

- **Cutout pipeline:** background-removal (`@imgly/background-removal`, client-side WASM) → composite onto `#FFFFFF` → JPEG, storing the **original** alongside (`imageMeta[i] = { cutout: true, original }`) — `canvas.js` ~613–665. Output is already an item-on-white image.
- **Auto-cutout-on-add toggle:** Profile → "Photo cutouts (Beta)" (`ProfileView.jsx:747`), bound to `measurements.removeBackground`; when on, `AddItemModal` auto-cuts new items (`App.jsx:2688`). Currently **off by default**, and there is **no batch for existing items**.
- **bg-detection (built in this session, on the working branch):** `src/lib/imageBg.js` `useImageBg(src)` samples an image's border → `{ contain, color }`; `WardrobeView` uses it to contain uniform-light images on a colour-matched tile. This becomes the **graceful fallback** for un-polished items.

---

## Design

### 1. White card tiles, cut-outs shown whole
Tiles render white (`#FFFFFF`); the ivory page is unchanged, so cards have definition. Per item:
- **Polished item** (`imageMeta[i].cutout === true`) → `object-contain` on the white tile → whole item, seamless, no crop, no halo. The branded look.
- **Un-polished item** → fall back to `useImageBg` (match-own-background, `object-contain` when uniform-light, else `object-cover`) so it shows whole and **never crops** while waiting to be polished.

Applied across the three item surfaces: the **wardrobe grid** (`WardrobeView`), the **item-detail** image, and the **public share** grid (`PublicShareView`).

### 2. Auto-polish new items — on by default
Default `measurements.removeBackground` to **on** (new users + existing where unset), so newly-added/imported items are cut out onto white automatically. The toggle stays (users can turn it off). Update the section copy ("Atelier ivory / white card", not "transparent").

### 3. "Polish my wardrobe" — the one-time batch
A new button in the **existing Profile "Photo cutouts" section** (beside the toggle — no duplicate elsewhere). It:
- Walks the user's **owned** items whose primary image isn't yet a cutout.
- Runs the existing cutout function on each, client-side, **sequentially with UI yields** so the tab stays responsive.
- Saves each result (sets `imageMeta[0].cutout = true`, swaps the image, preserves `original`).
- Shows a **progress bar** (`n / total`), is **cancellable**, and is **resumable** — it skips already-cutout items, so stopping and restarting continues where it left off.
- **Skips failures**, keeping the original, and counts them.

### 4. Obvious fallback (explicit requirement)
Background-removal isn't perfect; when it fails or nibbles a light item, the original is kept and made **visible, never silent**:
- A small **"original photo"** badge on the card / detail of any item that isn't a clean cutout (failed or toggle-off).
- A prominent **"Revert to original"** action in item detail, using the stored `imageMeta[i].original` — one tap to undo a bad cutout.
- After the batch, a **summary**: *"42 polished · 3 kept their original — review them"*, with a one-tap filter/jump to those items.

---

## Out of scope
- Transparent-PNG storage / Firebase Storage migration (the flexible-colour route) — deferred; white-on-white needs none of it.
- Server-side background-removal — deferred (client-side chosen for cost/simplicity).
- Changing the global page colour (we keep ivory; Option X was declined).

## Testing
- **Pure logic (Vitest):** the `imageBg` decision (`contain` / `color`) is testable by feeding synthetic pixel arrays (uniform-light → contain+colour; dark/busy → cover). Extract the pixel-decision into a pure helper to test it.
- **App-run:** white tiles render; polished items contain seamlessly; un-polished fall back without cropping; auto-polish on add; the batch runs with progress/cancel/resume and a failure summary; revert restores the original. Verified locally first (localhost), then a preview before production — this is a visual change that bit us once.

## Risks
- **Batch is heavy** on a large wardrobe (client WASM): mitigate with sequential processing, UI yields, progress, cancel, resume. It's a one-time, user-initiated action.
- **Quality:** removal can damage light/translucent items → the visible revert + "original photo" badge are the safety net; auto-polish stays reversible.
- **Transitional look:** while polishing, the grid mixes white cutouts and bg-detection fallbacks — acceptable and temporary; fully uniform once polished.

## Success criteria
1. Polished items show **whole, uncropped**, as clean cut-outs on white cards over the ivory page — no halos.
2. Un-polished items show whole (bg-detection), never cropped.
3. New items auto-polish by default; the toggle still lets users opt out.
4. "Polish my wardrobe" processes the existing wardrobe with progress, cancel, resume, and a failure summary.
5. Every non-clean cutout is obviously flagged and one tap from "Revert to original".
