# Rich shareable links + Pinterest, across all cards

**Date:** 2026-06-30
**Status:** Design approved, pending written-spec review
**Scope:** Two phases in this repo (`digital-wardrobe`). Phase A ships reliable pinning on its own; Phase B adds all-platform rich previews + a converting landing.

---

## North star

**Turn the share-loop into a discovery engine.** Every shared card (outfit · Style DNA · Manifesto) should pin/link with its *real* 1080×1920 image and a preview that converts a stranger's tap into a 14-day trial. The bottleneck is demand/distribution, not build — Pinterest is a search engine where the audience already is, and the app already produces ideal (tall) pin imagery.

Decision filter for every choice: *will a stranger who taps this pinned card see the actual artifact and a clear path to making their own?*

---

## Background: what already exists

- **Three card composers** (all → PNG blob, ~1080×1920): `composeOutfitExportImage(outfit, items)`, `composeStyleDNAExportImage(items, measurements)`, `composeManifestoExportImage(manifesto, measurements)` in `src/lib/canvas.js`; shared via `shareOrDownloadImage(blob, filename, shareText)`.
- **Outfit Pinterest button already exists** in `ShareLookModal` (`src/App.jsx` ~242–277), desktop-only row. It calls `onCreateLink()` for a public URL and opens Pinterest's create-pin page — but passes only `url` (no `media`).
- **Public share system:** `handleShareOutfit` / `handleShareLookbook` write a self-contained snapshot to `public/{shareId}` (Firestore), embedding item thumbnail **data-URLs**. Share URL is **query-param based**: `/?share={shareId}`. `PublicShareView` (rendered when `?share=` present) shows the snapshot to anyone, unauthenticated.
- **Functions:** Gen2 (`firebase-functions/v2`), e.g. `calendarOAuthCallback` is an `onRequest`. `firebase.json` hosting has a single catch-all rewrite `** → /index.html`.

## Why the current pinning is broken

Pinterest is given only the page `url`, so it must **scrape `og:image`** off `/?share=…`. That page is a client-rendered SPA on Firebase Hosting with no per-share server rendering, and Hosting **can't route a query-param URL to a function** (it matches on path). So Pinterest's crawler (no JS) sees only the static `index.html` `og:image` — a generic image, never the user's card. And the Style DNA + Manifesto modals have no pin button at all.

---

## Phase A — Reliable pinning foundation

Ships the win with **no new function or rewrite** — just Storage + frontend.

### A1. Upload the card PNG to public Storage
On share creation (outfit, Style DNA, Manifesto), upload the composed PNG to `public-shares/{shareId}.png` (public-read) and record its public download URL as `cardImageUrl` on the share doc.
- New helper `uploadShareCardImage(shareId, blob) → publicUrl` in a focused module (e.g. `src/lib/publicShare.js`), using Firebase Storage.
- Storage rule: public read for `public-shares/**`, writes restricted to authenticated owners.

### A2. Pass the image to Pinterest as `media`
Update pin links to `https://www.pinterest.com/pin/create/button/?url={shareUrl}&media={cardImageUrl}&description={text}`. With `media` set, Pinterest uses that exact image — no scraping. This makes pinning correct **before** Phase B exists.

### A3. One shared "Share to social" helper, used by all three modals
Extract the outfit modal's social row into a reusable component/helper (`ShareToSocial` or `pinToPinterest({ shareUrl, cardImageUrl, description })`) and add it to `StyleDNAShareModal` (`src/views/InsightsView.jsx`) and `ManifestoShareModal` (`src/views/InsightsView.jsx`). All three behave identically; description defaults per card type.

**Phase A acceptance:** from any of the three cards, "Pin to Pinterest" opens a pin pre-filled with the *actual* card image.

## Phase B — Server-rendered rich previews + converting landing

Makes **every** platform (Pinterest, Facebook, iMessage, WhatsApp, LinkedIn) show the right preview, and turns the landing into a trial funnel.

### B1. Path-based share URL
Introduce `/s/{shareId}`. Update share-link generation to produce `/s/{shareId}`. Keep `/?share={id}` working via a client redirect to `/s/{id}` (old links survive). `PublicShareView` reads the id from the path.

### B2. `ogShare` Cloud Function (Gen2 `onRequest`)
For `/s/{shareId}`: read `public/{shareId}`; if missing → serve the normal SPA shell. If present → serve the built `index.html` with injected `<head>` tags: `og:image`=`cardImageUrl`, `og:title`=share name, `og:description`, `og:url`, `twitter:card=summary_large_image`. Humans get the SPA (hydrates → `PublicShareView`); crawlers get the meta. The HTML/meta injection is a **pure function** `buildShareHead({ title, description, imageUrl, url })` → testable.

### B3. Hosting rewrite
In `firebase.json`, add **before** the catch-all: `{ "source": "/s/**", "function": "ogShare" }`.

### B4. Converting landing
`PublicShareView` shows the shared card prominently + a clear CTA: **"Create your own — start a free trial"** → the 14-day trial (`edit.myatelier.style` trial entry). Self-contained; does not depend on the marketing repo.

**Phase B acceptance:** pasting a `/s/{id}` link into Pinterest/FB/iMessage shows the real card image + title; a human visitor sees the card + a trial CTA.

---

## Out of scope (deliberate)

- **Outfit naming gap** — the "Style with this" save hardcodes `name: \`Styled with ${item.name}\`` (`src/App.jsx` ~1031) with no input. Separate small UX fix (name input + optional AI-suggest), tracked to do **after** this feature.
- **Marketing-site email capture** (the GTM "#1 leak") — different repo (`atelier-website`). This feature's converting surface is the in-app `/s/` page, which ships independently.
- **Instagram** beyond the existing "save image" affordance (no public posting API worth the cost).

## Testing

- **Pure logic (Vitest):** `buildShareHead(...)` (correct, escaped og/twitter tags); the Pinterest URL builder (`pinToPinterest` query assembly + encoding).
- **Emulator:** `ogShare` + the `/s/**` rewrite via the Firebase emulator; assert injected meta for a seeded share doc, and SPA fallback for a missing id.
- **App-run:** the three share modals show the pin affordance and open a correctly pre-filled pin; `/s/{id}` renders the card + trial CTA; old `/?share=` redirects.
- **Post-deploy smoke:** a real pin from each card; a link-preview check (e.g. Pinterest URL debugger / paste into iMessage).

## Risks & sequencing

- **Phase B touches deploy infra** (a new function + hosting rewrite + storage rules) — higher-stakes than frontend. Deploy and smoke-test Phase A and Phase B **separately**; the hosting rewrite ordering (specific `/s/**` before catch-all) is the main footgun.
- **Public Storage images** are world-readable by design (they're shared artifacts) — acceptable, but the path is non-guessable (`shareId`) and contains only what the user chose to share.
- **Storage growth/cleanup:** share PNGs accumulate. Out of scope to auto-prune now; note it (a TTL/cleanup job is a future nicety).

## Success criteria

1. From outfit, Style DNA, and Manifesto cards, a user can pin to Pinterest and the pin shows the **real** card image (Phase A).
2. A `/s/{id}` link pasted into Pinterest/Facebook/iMessage shows the right image + title (Phase B).
3. A stranger landing on `/s/{id}` sees the shared card and a working "start a trial" CTA (Phase B).
4. Old `/?share=` links still resolve.
5. Pure builders are unit-tested; the function is emulator-verified before deploy.
