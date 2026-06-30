# Edit & rename saved looks + share-card polish

**Date:** 2026-06-30
**Status:** Design approved, pending written-spec review
**Scope:** Small UX feature + two share-modal polish fixes, in `digital-wardrobe`. One branch, one deploy.

---

## Problem

On the saved-look page (`OutfitDetailView`), users can't:
- **Rename a look** — the name (e.g. "Daily Brief · Sun 21 Jun") is display-only; nothing renames an individual look (only collections can be renamed).
- **Find "Edit"** — composition editing exists (`handleEditOutfit`, App.jsx:1142, opens the look in the Studio) but is buried in the "..." overflow menu (App.jsx:7397), so users think it's missing.

Plus two share-card polish issues the user reported:
- The look's **name is shown twice** in the share modal (the modal's big header *and* inside the composed card image).
- The **Pinterest/Instagram buttons use fake "P"/"i" circles**, not the real brand marks — looks off for a luxury product.

## Goal

Make a saved look's name editable, make "Edit" findable, and clean up the share modal — so managing saved looks feels obvious and the share UI looks legitimate.

---

## Design

### 1. Rename — inline-editable title (core)
In `OutfitDetailView` (`src/App.jsx:7174`), the look's title becomes click-to-edit:
- Tapping the title swaps it for a text input pre-filled with the current name.
- **Enter** or **blur** commits; **Esc** cancels.
- Commit calls the existing `onSaveOutfit({ ...outfit, name: trimmedName })` (already wired to `handleSaveOutfit` → `setDoc` upsert at App.jsx:749). Empty/whitespace name is rejected (keeps the old name).
- A subtle affordance (e.g. a small pencil icon on hover, or `cursor: text` + underline-on-hover) signals it's editable.
- *Rejected alternative:* a "Rename" item in the "..." menu — repeats the discoverability problem.

### 2. Surface "Edit" in the toolbar
Move the **Edit** action out of the "..." overflow menu (App.jsx:7397) into a **visible toolbar button** next to "Vary look" (~App.jsx:7366). It still calls `onEdit` (`handleEditOutfit` → opens the Studio). Result: the toolbar reads "Edit · Vary look · Share · …" — manual edit and AI restyle both one tap. Duplicate, Export, Delete, etc. stay in "...".

### 3. Name a look at save (the parked naming gap)
The "Style with this" save hardcodes `name: \`Styled with ${item.name}\`` (App.jsx ~1031). In `StyleAroundItemModal`, add an **editable name field** in the save area, pre-filled with `Styled with {item.name}`, so the user can name it before saving. Light touch — rename-after-the-fact (#1) is the safety net, so this is a small input, not a flow.

### 4. Share-card polish (`ShareLookModal`, src/App.jsx:98–300)
- **Remove the duplicate title:** drop the large look-name header rendered in the modal chrome (keep the "Share this look" eyebrow and the composed card, which already carries the name). The name then appears once — on the card.
- **Official brand icons:** replace the fake `<span>P</span>` (Pinterest, ~line 275) and `<span>i</span>` (Instagram, ~line 287) with the real brand marks as inline SVG (standard single-path Pinterest + Instagram logos), each in its brand colour. Apply the same in the `PinToPinterestButton` shared component (`src/views/InsightsView.jsx`) so Style DNA / Manifesto pins match. Extract a tiny `PinterestGlyph` / `InstagramGlyph` so the SVG lives in one place.

---

## Out of scope
- Editing the AI "stylist's note" text by hand (user chose rename-only for content; the note stays AI-generated/regeneratable).
- Any change to the composition-edit Studio flow itself (only its discoverability).

## Testing
- No new pure logic worth a unit test (rename is a trimmed-string update; the name-trim guard is trivial). Verified by running the app: rename a look (persists + reflects in Lookbook), Edit button visible and opens Studio, name-at-save works, share modal shows the name once with real brand icons.
- `npm run build` + existing 22-test suite stay green.

## Success criteria
1. A saved look can be renamed from its detail page; the new name persists and shows in the Lookbook.
2. "Edit" is visible in the saved-look toolbar (not hidden in "...") and opens the Studio.
3. Saving a "Style with this" look lets the user set the name first.
4. The share modal shows the look name once, with real Pinterest/Instagram icons (matching across all three card modals).
