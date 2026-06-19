# Atelier · Admin

Operator dashboard at **admin.myatelier.style**. Owner-only. Total separation from the consumer studio at edit.myatelier.style.

## What it does

Single-page React app for the founder to monitor business/cost data. v1 surface:

- **AI spend dashboard** — per-month spend across all users, with feature breakdown and top-user ranking. Reads the per-call audit log that the consumer app writes to `/users/{uid}/aiUsage*` on every Gemini call.

Future surfaces (likely):
- Subscription / member list
- Revenue and churn
- Founding-member counter (track how many of the 500 keys have been claimed)

## Local development

```bash
# From the monorepo root
cp apps/admin/.env.example apps/admin/.env.local
# Fill in the Firebase config values (same project as wardrobe app)
pnpm install
pnpm --filter admin dev   # http://localhost:5174
```

## Deploying to Cloudflare Pages

1. **Create a new Pages project** in the Cloudflare dashboard, separate from the marketing site project.
2. **Connect the GitHub repo** (`Talastron/atelier`).
3. **Build settings:**
   - Framework preset: *None*
   - Build command: `pnpm install && pnpm --filter admin build`
   - Build output directory: `apps/admin/dist`
   - Root directory: `/` (monorepo root)
4. **Environment variables** — set the same `VITE_*` values as in `.env.local`:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
   - `VITE_OWNER_EMAILS`
5. **Custom domain** — add `admin.myatelier.style` in Pages → Custom domains. Cloudflare will provision the cert automatically.
6. **Firebase Auth authorized domains** — in Firebase Console → Authentication → Settings → Authorized domains, add `admin.myatelier.style`. Without this, Google sign-in fails with `auth/unauthorized-domain`.

## Security model

- **Firebase Auth** gates sign-in. Google sign-in only — no magic link, no email/password.
- **OWNER_EMAILS** env var gates UI access after sign-in. Anyone not on the list sees the *"This room isn't for you"* screen.
- **Firestore Security Rules** are the actual security boundary. Even if the client check is bypassed, the rules block reads for non-owners. The relevant rule (already deployed):
  ```
  match /{path=**}/aiUsageMonthly/{monthKey} {
    allow read: if isOwner();
  }
  ```
- **No App Check.** Not needed: admin traffic is owner-only, low volume, and the rules already enforce isOwner. Skipping App Check keeps the bundle small and avoids needing a separate reCAPTCHA key for this domain.

## Structure

```
apps/admin/
├── index.html
├── package.json
├── vite.config.js
├── .env.example
└── src/
    ├── main.jsx           # React entry
    ├── App.jsx            # Sign-in flow + owner gate + shell
    ├── firebase.js        # Firebase Auth + Firestore (no App Check)
    ├── AdminAiUsage.jsx   # AI spend dashboard panel
    └── styles.css         # Tailwind v4 + brand tokens
```
