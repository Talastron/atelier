# Atelier — A Digital Wardrobe

A private, AI-styled digital wardrobe. Build your collection, compose outfits with Gemini, plan a week (or a trip) on a calendar, share lookbooks read-only, and let an AI write a private style brief from what you actually wear.

Built solo, on the Firebase Spark (free) tier, with React + Vite + Tailwind v4 + Google Gemini 2.5 Flash.

> _Add 3–5 screenshots here once published — the Today tile, Identify-with-AI, Calendar in range mode, Style Manifesto card, and a shared lookbook are the strongest._

---

## What it does

**Capture** — six ways to add an item, ordered by speed:
- **Identify with AI** (fastest) — snap one photo, Gemini Vision fills category, brand, name, colours, materials, styles, seasons, description.
- **Closet sweep** — rapid multi-photo capture, each becomes a draft, save all in one batch.
- **Scan Label** — care/brand tag photo → brand, size, materials, care instructions.
- **Paste Receipt** — order email text or screenshot → line-items extracted.
- **Search & Bulk Import** — paste up to 25 product URLs, parallel-fetch all metadata.
- Plus traditional Add Photos / Manual Entry.

**Style** — drag-and-drop outfit builder (desktop) / tap-to-add (mobile) with strict slot validation; multi-pick jewellery for layered looks. AI styling with Gemini, mood presets, A/B compare, confidence scores, refinement loop.

**Plan** — schedule outfits to specific dates. Range mode for trips → generates a deduped packing list. AI Travel Planner: type a destination, get a per-day capsule based on the actual forecast.

**Track** — wear log with quick verdicts ("felt great", "too warm"), per-item wear count, cost-per-wear, "stale" detection, care reminders triggered by material thresholds, lent-to tracking with overdue alerts.

**Insights** — total value, wear timeline, colour profile, best/worst cost-per-wear leaderboards, Gemini-written gap analysis, Gemini-written style manifesto (a 3-paragraph aesthetic brief from your actual wear history).

**Inspiration** — save outfit photos, AI cross-references against your wardrobe to find matches + missing pieces, "Recreate this look" builds an outfit instantly, missing pieces convert to wishlist items.

**Share** — read-only public links for single outfits or curated lookbooks. WhatsApp / email / native share sheet / clipboard.

**Polish** — wax-seal monogram, hand-drawn brass-rule editorial header pattern, Playfair Display + Jost type pairing, iOS PWA support with safe-area handling, swipe-between-products on mobile, reduced-motion respect, screen-reader-friendly toasts, opt-in photo cutouts (@imgly background removal).

---

## Engineering highlights

Worth pointing out:

- **Single-file React (intentionally).** `src/App.jsx` is ~8,500 lines. Built as a solo iteration tool, each section commented like a tiny module. Splitting is on the roadmap — not before.
- **Single Firestore subtree per user.** `/users/{uid}/...` with rules enforcing `request.auth.uid == uid` cross-user isolation. Allowlist managed via `/allowlist/{email}` docs so owners can invite friends from inside the app without redeploying rules.
- **Soft-delete with 30-day auto-purge.** Items with `deletedAt` are hidden from every read site but stay in Firestore for 30 days. Auto-purge runs silently on app load.
- **Embedded base64 images in Firestore docs.** No Firebase Storage (Spark plan). The 1 MiB per-doc cap shapes the data model — outfits store `itemIds: string[]`, not embedded items.
- **Public share docs are self-contained.** `/public/{shareId}` embeds full item snapshots — no cross-doc reads from unauthenticated traffic, no auth/storage rules involved.
- **AI grammar across 9 distinct prompts** — style generation, refinement, gap analysis, identify-item, scan-label, scan-receipt, inspiration-analysis, manifesto, travel-capsule, post-wear narration. Each maps Gemini's free text to the app's controlled vocabularies (materials, colours, styles, seasons) via fuzzy matching so chips light up correctly.
- **iOS-PWA quirks handled.** Auto-zoom-out prevented via `minimum-scale=1.0` + locked `width: 100vw` on root. Auto-zoom-in on inputs prevented via `font-size: 16px` floor on touch devices. `safe-area-inset-top` on every sticky header.
- **Photo cutouts via `@imgly/background-removal`.** Lazy-imported (~5MB model), composited onto white + JPEG-recompressed for ~5× storage savings vs raw PNG-alpha. Per-thumb toggle to revert.
- **Two-layer swipe grammar on mobile.** Page-level swipe between products; image-level swipe between photos of one product. Each gesture on its own surface, never conflicts.

---

## Stack

- **React 18** + **Vite 6** + **Tailwind CSS v4**
- **Firebase** — Auth (Google) + Firestore + Hosting, runs entirely on the Spark (free) tier
- **Google Gemini 2.5 Flash** — free tier, generous quota
- **@dnd-kit/core** — drag-and-drop outfit builder
- **lucide-react** — icon system
- **vite-plugin-pwa** — installable PWA + service worker
- **@imgly/background-removal** — opt-in photo cutouts (lazy-loaded)

---

## Setup (self-host)

### 1. Clone and install

```bash
git clone https://github.com/<your-username>/digital-wardrobe.git
cd digital-wardrobe
npm install
```

### 2. Create a Firebase project (free)

1. Go to https://console.firebase.google.com → **Add project**. No credit card required.
2. **Authentication** → **Sign-in method** → enable **Google**.
3. **Firestore Database** → **Create database** → Native mode → start in production.
4. **Project settings** → **General** → **Your apps** → **Add web app** → copy the config.

### 3. Configure locally

```bash
cp .env.example .env.local
cp .firebaserc.example .firebaserc
cp firestore.rules.example firestore.rules
```

Then edit all three:
- `.env.local` — paste your Firebase config, your owner email(s), and (optional) your Gemini API key.
- `.firebaserc` — set the `default` project ID to your Firebase project ID.
- `firestore.rules` — replace `replace-with-your-email@example.com` near the top with your Google account email. Must match `VITE_OWNER_EMAILS` in `.env.local`.

All three are gitignored so you can edit them freely without ever committing personal data.

### 4. Enable AI features (Firebase AI Logic + App Check)

The Gemini key is **not** in the client bundle. Instead the app calls Gemini via Firebase AI Logic, gated by App Check. Two Firebase Console steps:

**a) Enable AI Logic**
1. Firebase Console → **Build** → **AI Logic** → **Get started**
2. Choose **Gemini Developer API** (free tier — no Blaze needed)
3. Wait ~30 seconds for provisioning

**b) Enable App Check with reCAPTCHA v3**
1. Firebase Console → **Build** → **App Check** → **Get started**
2. Select your web app → choose **reCAPTCHA v3** provider
3. Either use Firebase's auto-generated reCAPTCHA site key, or create one at https://www.google.com/recaptcha/admin (v3, your domain)
4. Copy the **site key** (public, starts with `6L...`) into `VITE_RECAPTCHA_SITE_KEY` in `.env.local`
5. In App Check → **APIs** tab → enforce **Firebase AI Logic** (sets Gemini calls to require valid App Check tokens)

**c) Local dev debug token (one-time)**
For local development with `npm run dev`, App Check needs a debug token:
1. Open http://localhost:5173 in a browser, open DevTools console
2. Look for `[App Check] Debug Token: xxxxxxxx-xxxx-...` in the console
3. Copy that token → Firebase Console → App Check → your web app → ⋮ menu → **Manage debug tokens** → **Add debug token** → paste
4. Reload — AI features now work locally

Without these steps the app still works — AI features simply throw a clear "AI is not configured" message.

### 5. Run locally

```bash
npm run dev
```

Open http://localhost:5173 and sign in with the Google account you added as owner.

### 6. Deploy

```bash
firebase login          # one-time
firebase deploy --only firestore:rules
npm run deploy          # builds + deploys hosting
```

Your app is live at `https://<your-project-id>.web.app`.

### 7. Install on phone (optional)

Open the URL in mobile Safari (iOS) or Chrome (Android) → Share / menu → **Add to Home Screen**. It runs as a standalone PWA with a wax-seal monogram icon.

---

## Inviting friends

Once deployed and signed in as owner:
- **Profile** tab → scroll to the **Invite a friend** panel → add a Google email.
- They sign in with Google on the same URL using that email and get full personal-wardrobe access.
- Each user lives in their own `/users/{uid}/...` Firestore subtree — no cross-user reads.

You stay in control: owners can revoke an invite at any time from the same panel.

---

## Free-tier limits

| Service | Free tier | Realistic use for a personal wardrobe |
|---|---|---|
| Firestore | 1 GiB storage, 50k reads/day, 20k writes/day | ~7,000 items at ~150 KB each |
| Firebase Auth | Unlimited | ✓ |
| Firebase Hosting | 10 GB storage, 360 MB/day egress | A few MB/day |
| Gemini 2.5 Flash | 1500 requests/day (free tier) | Plenty for personal styling |

No credit card required. The app is designed to never push you off the free tier.

---

## Roadmap

Things to do next if you (or I) keep iterating:

- **Split `App.jsx` into modules.** Currently monolithic by design (rapid solo iteration). Natural breaks: `lib/ai/`, `lib/firebase/`, `components/wardrobe/`, `components/outfits/`, `components/modals/`, `screens/`.
- **Move the Gemini key server-side.** Currently in the client bundle (`import.meta.env.VITE_GEMINI_API_KEY`). For any public deploy, proxy via a Cloud Function so the key isn't extractable and you can rate-limit per user.
- **True background push notifications.** Requires Firebase Cloud Messaging (Blaze plan). Current implementation is "notify on app open".
- **Sale-watcher cron** for wishlist items. Needs scheduled Cloud Function (Blaze plan).
- **Co-edit shared wardrobes.** Current rules give each user an isolated subtree; sharing requires rules redesign + a separate `/wardrobes/{id}` collection.
- **Tests.** Particularly for the prompt-mapping helpers (`matchCareTag`, `matchColorFamily`, `parseReceiptText`, slot filters).
- **App Store / Play Store wrapping** via PWABuilder.

---

## Licence

MIT — see [LICENSE](LICENSE). Use it, fork it, learn from it, ship your own.

---

## Acknowledgements

- **Playfair Display** + **Jost** — Google Fonts.
- **lucide.dev** — icon system.
- **@imgly/background-removal** — the cutout magic.
- **Open-Meteo** — free weather forecast API used by the travel planner.
- **Microlink** — URL metadata fetcher used by link import.
- Competitors I learned from by watching: **Whering**, **Stylebook**, **Acloset**, **Indyx**, **Save Your Wardrobe**. Each made deliberate choices worth studying.
