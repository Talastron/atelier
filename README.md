# Atelier · Digital Wardrobe

A private digital wardrobe — your collection, wishlist, outfit builder, and measurements, synced across phone and laptop.

**Stack:** React + Vite + Tailwind v4 · Firebase (Auth + Firestore + Hosting) · PWA installable on iOS / Android.

Images are compressed to ~50–150 KB and stored as base64 inside each Firestore item document, so the whole app runs entirely on the **Firebase Spark (free) plan** with no credit card. If you later want Firebase Storage for higher-resolution images, see the "Upgrading later" section at the end.

---

## 1. Run it locally

```powershell
npm install
copy .env.example .env.local
# fill in .env.local with your Firebase config (instructions in section 2)
npm run dev
```

Then open http://localhost:5173.

You will see the sign-in screen. Sign in with Google → your wardrobe is created automatically in Firestore + Storage.

---

## 2. One-time Firebase setup

You will do this in a browser on a Google account. **It is free and does not require a credit card.**

### 2.1 Create the project

1. Go to **<https://console.firebase.google.com/>** → click **"Add project"**.
2. Project name: anything you like (e.g. *atelier-wardrobe*). Disable Google Analytics (not needed for a personal app).
3. Wait ~30 seconds for the project to be provisioned.

### 2.2 Register your web app

1. From the project dashboard, click the **`</>` (Web)** icon under *"Get started by adding Firebase to your app"*.
2. App nickname: *Atelier Web*. You may tick "Also set up Firebase Hosting" or skip it — we configure Hosting separately in section 4.
3. Firebase will show you a config object that looks like:
   ```js
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "atelier-wardrobe.firebaseapp.com",
     projectId: "atelier-wardrobe",
     storageBucket: "atelier-wardrobe.firebasestorage.app",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abc..."
   };
   ```
4. **Copy each value into `.env.local`** in this project, matching the `VITE_FIREBASE_*` names. These are not secrets — they are public identifiers. Security comes from the rules in section 2.5.

### 2.3 Enable Google sign-in

1. Left sidebar → **Build → Authentication** → **Get started**.
2. **Sign-in method** tab → click **Google** → toggle on → set a project support email (your own) → **Save**.

### 2.4 Create Firestore

1. Left sidebar → **Databases and storage → Firestore Database** → **Create database** → **Production mode** → pick a location close to you (e.g. `eur3` for Europe) → Enable.

**Do NOT create Storage** — it now requires upgrading to the Blaze (pay-as-you-go) plan with a credit card. This project stores compressed images directly inside Firestore item documents instead.

### 2.5 Apply security rules

This locks your data to your account only. **Do not skip this.**

You can either paste them into the console UI, or deploy them from the CLI after section 4.

**Option A — Console UI (one-time setup):**
- Firestore Database → **Rules** tab → paste the contents of [`firestore.rules`](./firestore.rules) → **Publish**.

**Option B — CLI (recommended once Firebase CLI is set up in section 4):**
```powershell
npm run deploy:rules
```
This reads `firestore.rules` from this repo and publishes it. Edit and re-run any time.

---

## 3. Push to GitHub

```powershell
git init
git add .
git commit -m "Initial commit"
# Create a new repo at https://github.com/new (private)
git remote add origin https://github.com/<your-username>/digital-wardrobe.git
git branch -M main
git push -u origin main
```

`.env.local` is in `.gitignore` and will not be committed.

---

## 4. Deploy to Firebase Hosting

The Firebase CLI is already installed as a dev dependency, and `firebase.json` is pre-configured. You just need to log in once and point it at your project.

### 4.1 Tell the CLI which project to use

Open `.firebaserc` and replace `REPLACE_WITH_YOUR_PROJECT_ID` with your Firebase project ID (the `projectId` value from `.env.local` — e.g. `my-digital-wardrobe-abc12`).

Or, do it interactively:
```powershell
npx firebase login
npx firebase use --add
```
(pick your project, alias it as `default`).

### 4.2 Deploy

```powershell
npm run deploy
```

This runs `vite build` (configured as a `predeploy` hook in `firebase.json`) and uploads `dist/` to Firebase Hosting. Takes ~30 seconds.

You'll get two URLs:
- `https://<project-id>.web.app`
- `https://<project-id>.firebaseapp.com`

Both work. Both are auto-added to Firebase Auth's authorized domains — **Google sign-in just works**, no extra step.

### 4.3 Deploy security rules (if you skipped section 2.5 option A)

```powershell
npm run deploy:rules
```

### 4.4 Updating later

Every time you change code:
```powershell
npm run deploy
```
Every time you change `firestore.rules` or `storage.rules`:
```powershell
npm run deploy:rules
```

If you want push-to-deploy via GitHub later, run `npx firebase init hosting:github` — it generates a GitHub Action so `git push` to `main` redeploys.

---

## 5. Install on your phone

1. Open your `*.web.app` URL in **Safari (iOS)** or **Chrome (Android)**.
2. Sign in with Google.
3. **iOS:** Share → *Add to Home Screen*. **Android:** menu → *Install app*.
4. The icon launches in full-screen mode, no browser chrome.

---

## 6. Project layout

```
src/
  App.jsx       — all UI components
  firebase.js   — config, auth helpers, image upload/delete
  main.jsx      — entry
  index.css     — Tailwind + a few utilities
firestore.rules — Firestore security rules (paste into console)
storage.rules   — Storage security rules (paste into console)
vite.config.js  — Vite + Tailwind v4 plugin + PWA plugin
.env.example    — template for your Firebase config
```

Data model in Firestore:
- `users/{uid}/items/{itemId}` — wardrobe item documents
- `users/{uid}/outfits/{outfitId}` — saved outfit documents
- `users/{uid}/profile/measurements` — single doc with your measurements

Images live in Storage at `users/{uid}/items/{itemId}.jpg`.

---

## 7. Free-tier limits at a glance

| Service | Free tier | What you would use |
|---|---|---|
| Firebase Firestore | 1 GiB storage, 50k reads/day, 20k writes/day | ~7,000 items max (each ~150 KB) |
| Firebase Auth | Unlimited | 1 user |
| Firebase Hosting | 10 GB storage, 360 MB/day egress | A few MB/day |

You will not see a bill, and no credit card is required.

---

## 8. Upgrading later (optional)

**If you ever want higher-resolution images** (currently capped at 800px to fit Firestore docs), upgrade the project to the **Blaze (pay-as-you-go) plan** in the Firebase Console. The 5 GiB Storage free tier becomes accessible, and you can set a budget alert at $0.01/month — for a private app you will never trigger it.

Then re-enable Storage in code:
1. In `src/firebase.js`, re-add the Storage imports and the `uploadWardrobeImage` / `deleteWardrobeImage` helpers.
2. In `src/App.jsx`, switch `resizeImageToDataUrl` back to returning a Blob, call `uploadWardrobeImage` in the modal submit, and restore the Storage cleanup in `handleDeleteItem`.
3. Add `"storage": { "rules": "storage.rules" }` back to `firebase.json`.
4. Run `npm run deploy:rules` then `npm run deploy`.

The git history of this repo shows the exact diff if you ever want to revisit.
