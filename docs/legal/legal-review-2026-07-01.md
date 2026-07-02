# Legal & Privacy Review — Atelier (Talastron Ltd)

**Date:** 1 July 2026
**Scope:** Privacy Policy, Terms of Service, cookie/PECR position, GDPR disclosures
**Repos reviewed:** `Digital Wardrobe` (the app), `atelier-website` (marketing + Studio + payments)
**Reviewer:** Claude Code (engineering review — **not legal advice**; see note at end)

---

## 1. Summary

The existing Privacy Policy and Terms of Service (`apps/marketing/src/pages/legal/{privacy,terms}.mdx`)
were already substantive and UK-GDPR-aware. The main issue was **drift**: the app has gained
features (Firebase Storage, weather/location, link import, reCAPTCHA/App Check, indefinite
Concierge history, per-user AI cost logging) that the policies did not describe, plus two
statements that did not match the code.

All document-level fixes have been applied to the two `.mdx` files. Section 4 lists items that
are **not** document text and need an action or a decision from you.

---

## 2. Data-flow facts confirmed from code

- **Controller:** Talastron Ltd. **ICO:** ZB804967 (reg. 29 Oct 2024, expires 28 Oct 2026, Tier 1).
- **Auth:** Firebase Auth — Google OAuth **and** email magic link (both real).
- **Data residency:** Firestore, Firebase Storage, and Cloud Functions all in Google **`europe-west2` (UK) / EU** — a genuine strength; now stated positively in the policy.
- **AI:** Google **Gemini** via **Firebase AI Logic** (no client key). Photos, wardrobe summaries, style
  profile/measurements, Concierge messages, and (if connected) calendar snippets are sent to Gemini.
  Not used to train Google's models under the Firebase AI Logic terms.
- **Payments:** **Lemon Squeezy** as Merchant of Record (independent controller for payment/tax);
  webhook (HMAC-verified) provisions the Firebase user and sends the magic-link email.
- **Other sub-processors found:** Open-Meteo (weather — receives geolocation), Microlink.io (link
  metadata), public CORS image proxies (fallback image fetch), Cloudflare (marketing CDN),
  Microsoft 365 (contact@ mailbox), Firebase App Check / reCAPTCHA (bot protection).
- **Erasure:** in-app `deleteAccount` recursively deletes the user subtree, storage, auth, and
  subscription records. **Caveats:** public shares are not auto-deleted; Lemon Squeezy billing must
  be cancelled separately.
- **No analytics/advertising trackers** in either repo (confirmed — no GA, Segment, Mixpanel,
  PostHog, Sentry, Meta Pixel, cookie-consent libraries).

---

## 3. Document fixes applied (1 July 2026)

### Privacy Policy
1. ICO registration number **ZB804967** now cited (was "where required").
2. "Service usage data" corrected — the "anonymised feature-usage counts" claim was **inaccurate**
   (AI usage is logged per-user by `uid`, kept indefinitely). Now described as per-account AI
   usage/cost records for rate-limiting and cost control.
3. Removed the unsubstantiated "email logs retained 90 days" line (no dedicated email provider exists).
4. New **Location data** subsection (Open-Meteo, geolocation, browser permission, not stored server-side).
5. New **How AI features use your data** subsection (explicit list of what is sent to Gemini via
   Firebase AI Logic; no training; Concierge history stored/clearable; no PII/payment data sent).
6. Sub-processor list expanded: Open-Meteo, Microlink, image proxy, App Check/reCAPTCHA;
   Firebase entry now covers Storage + magic-link emails + UK/EU region; Lemon Squeezy reframed as
   **independent controller / Merchant of Record**.
7. International-transfer wording made specific (UK IDTA/Addendum, SCCs, UK Extension to EU–US DPF).
8. Storage section now covers **Firebase Storage** and flags **public share links** as world-readable.
9. Retention section adds Concierge history, AI usage records, and public shares.
10. New **Deleting your account** block under rights (cancel billing first; public shares persist).
11. Cookies section rewritten — reCAPTCHA/App Check, location/notification/camera permissions,
    and an explicit statement of why **no cookie banner** is required.
12. `lastUpdated` → 1 July 2026.

### Terms of Service
1. AI fair-use limits corrected (≈200/browser/day **and** 500/account/month; adjustable) + link to Privacy.
2. New public-share warning under "Your content".
3. Minimum age raised **16 → 18** (account holder must be an adult able to contract). Privacy children's clause updated to match.
4. `lastUpdated` → 1 July 2026.

### App code (Digital Wardrobe)
- **Removed the anonymous public CORS proxies** (corsproxy.io, allorigins, codetabs, cors.lol, corsproxy.org) from `src/lib/net.js`. Retailer images are now rehosted **only** through our own first-party Cloud Function proxy (`imageProxy`, europe-west2, SSRF-guarded). Build verified.
- **Added a first-party `pageProxy` Cloud Function** (`functions/index.js`) that returns product-page HTML, **gated on Firebase App Check** (verifies `X-Firebase-AppCheck`), with the same SSRF guards + a 3 MB / 12 s cap. `net.js` now fetches page HTML through it (attaching an App Check token) and re-enables `extractSchemaFromHtml`, so **link-import price auto-fill is restored** first-party — no anonymous proxies. This is "Path 2" from the earlier review.
- **Widened the self-serve data export** (`ProfileView.jsx`) to include **inspirations** and **Concierge chat history** (payload `version: 2`), completing the UK GDPR Art. 20 export.
- ✅ **Deployed & verified (2026-07-02):** `pageProxy` created in europe-west2 and hosting released. Verified live — link-import price auto-filled (£109.65 on a test dress), and a fresh export confirmed `version: 2` with `inspirations` (18) and `concierge` (3) present. No Gen2 invoker / CORS issues on first call.

---

## 4. Residual actions & decisions (NOT document text)

### Actions to complete off-page
- **ICO fee currency** — registration expires **28 Oct 2026**; keep the annual data-protection fee paid.
- **Sub-processor DPAs on file** — confirm you can evidence data-processing terms for Google/Firebase,
  Lemon Squeezy, Open-Meteo, Microlink, and any public image proxy actually used in production.
  The public CORS proxies (corsproxy.io, allorigins, etc.) are the weakest link — consider making the
  first-party `imageProxy` the only path and dropping anonymous third-party fallbacks, or accept and
  document the residual exposure (only image URLs are sent, no account data).
- **DSAR / export process** — *self-serve export already exists* (Profile → Your Data → "Backup &
  export" → `downloadJson`), covering user, measurements, items, outfits, and shops. **Gap:** it omits
  **inspirations** and **Concierge chat history**, so it is not quite a complete UK GDPR Art. 20 export.
  Widen the export payload to include those two collections and it fully satisfies portability.
- **Breach process** — have a short internal note on the 72-hour ICO notification duty (UK GDPR Art. 33).
- **ROPA** — as a controller you should keep a short Record of Processing Activities; Section 2 above is
  effectively its content.

### Implications of removing the public image proxies (done)
- **Images:** rehosting now goes through the first-party function only. Most retailer CDNs block on
  hotlink *referer*, which the server-side function already bypasses — so day-to-day rehosting is
  unaffected. The only regression is CDNs that block Google Cloud's egress IPs *and* were previously
  reachable via a public proxy; those images now stay as external URLs (graceful fallback, same as before).
- **Link import price auto-fill — restored via `pageProxy`.** Price is parsed from page HTML (JSON-LD),
  which needs a proxy that returns HTML. Rather than lose it, we added the App-Check-gated first-party
  `pageProxy` (see §3 App code), so price/brand/description enrichment is back — now first-party instead
  of via anonymous proxies. **Requires the function to be deployed.** If `pageProxy` is ever unavailable,
  import degrades gracefully to Microlink title/image and the user sets price manually.
- **Cross-contamination bug fixed** as a side effect: HTML-scrape failures could previously poison the
  per-host cooldown cache and skip *image* fetches for the same host. Image and HTML paths are now separate.
- **Optional follow-up (Path 2):** to restore price auto-fill fully first-party, add a dedicated
  `pageProxy` Cloud Function that returns `text/html` (same SSRF guards + size cap, ideally App Check
  enforced), and re-enable `extractSchemaFromHtml` (kept in `net.js` for this purpose). Trade-off: it
  widens the function from an image proxy to a general page fetcher — enforce App Check to avoid an open proxy.

### Business decisions (your call — not changed)
- **Journal / newsletter email capture:** when the Journal email capture goes live, add a
  newsletter-marketing entry to the Privacy Policy (consent basis under PECR, the email provider used,
  and an unsubscribe route). Not present yet.
- **Google Fonts on the marketing site** are loaded from Google's CDN (sends visitor IP to Google).
  Low risk, but self-hosting the two fonts (Playfair, Jost) removes even that transfer. Optional.
- **Solicitor sign-off:** the limitation-of-liability and consumer-cancellation clauses in particular
  benefit from a UK solicitor's eye before you rely on them at scale.

---

## 5. Cookie-banner position (PECR)

No cookie consent banner is legally required today: all cookies/local storage are either
**strictly necessary** (auth session, security via App Check/reCAPTCHA) or **user-initiated**
(location, notifications, camera). There are no advertising or analytics cookies. This holds **only
while** no analytics/advertising SDK is added — introducing one (even privacy-friendly) would trigger
a consent requirement. The Privacy Policy now records this reasoning.

---

> **Note:** This is an engineering and compliance-hygiene review by an AI assistant, not legal advice.
> For a regulated launch, have a qualified UK data-protection solicitor review the final wording.
