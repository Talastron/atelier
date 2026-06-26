# Atelier — Cost Model & Unit Economics

**Last updated:** 2026-06-26
**Purpose:** Map every recurring cost (AI, storage, data, payments) so pricing is provably profitable, and identify where caps are needed.

> ⚠️ **All third-party prices below are estimates as of mid-2026 and DO change.**
> Verify against the live pricing pages before relying on them for decisions:
> Gemini API <https://ai.google.dev/pricing> · Firebase <https://firebase.google.com/pricing> · Lemon Squeezy <https://www.lemonsqueezy.com/pricing>.

---

## 0. TL;DR

- **Per-user running cost is small for normal use** — roughly **£1–£6 / user / year** of Gemini + a few pence of Firebase. Against **£12/mo (£144/yr)** or **£108/yr annual**, the typical margin is healthy.
- **The tail risk is now capped.** ✅ DONE (2026-06-26): the per-user AI cap was switched from 75/day to **500 calls/MONTH** (`src/firebase.js`, `USER_MONTHLY_CAP`). Worst-case AI cost per user is now ~£2/month instead of ~£9. Invisible to real users (a heavy "power" user runs ~300/month).
- **✅ Paid Gemini tier — CONFIRMED.** The project is on the **Blaze** plan, billing account **"Talastron Ltd"**, and the Google Cloud billing report shows real Gemini ("AI spend") cost accruing (~£1.28 in June 2026). Real billing = paid tier = Google does **not** use prompts/photos to improve its models, so the privacy-policy claim holds. (The stale `// free tier` comment in `src/firebase.js` is just wrong wording.)
- **Storage is cheap but architected oddly** — images are base64 **inside Firestore docs**, not Cloud Storage. Works fine now; it inflates read/egress costs at scale and is the one structural lever worth revisiting later.

---

## 1. The AI surface — what actually costs money

The app makes **17 distinct Gemini features**, all on **`gemini-2.5-flash`** via Firebase AI Logic (`GoogleAIBackend` = Gemini Developer API). `gemini-2.5-pro` is wired as an optional override but not used by default.

**Gemini 2.5 Flash pricing (estimate):** input **$0.30 / 1M tokens**, output **$2.50 / 1M tokens**. Images are tokenised (an 800px photo ≈ 1,000–1,600 input tokens).

| # | Feature (`src/lib/ai.js`) | Trigger | Image? | Streams? | Est. $/call |
|---|---|---|---|---|---|
| 1 | `generateOutfitWithGemini` — compose an outfit | user clicks | no | no | ~$0.0028 |
| 2 | `identifyItemWithGemini` — auto-tag a photo | add item / Closet Sweep | **yes** | no | ~$0.0011 |
| 3 | `analyzeLabelWithGemini` — read a care label | scan label | **yes** | no | ~$0.0009 |
| 4 | `analyzeReceiptImageWithGemini` — parse a receipt | scan receipt | **yes** | no | ~$0.0010 |
| 5 | `analyzeWardrobeGapsWithGemini` — gap audit | Insights | no | no | ~$0.0010 |
| 6 | `analyzeInspirationWithGemini` — match a pin to wardrobe | open pin | **yes** | no | ~$0.0018 |
| 7 | `generateOutfitNameWithGemini` — name a look | save / button | no | no | ~$0.0003 |
| 8 | `generateOutfitTagsWithGemini` — tag a look | save / backfill | no | no | ~$0.0002 |
| 9 | `generateWearNarration` — caption a wear photo | log wear (photo) | no | no | ~$0.0002 |
| 10 | `generateStyleFitWithGemini` — "why this fits me" | outfit detail | no | no | ~$0.0003 |
| 11 | `generateFitEstimateWithGemini` — will it fit? | wishlist item | no | no | ~$0.0003 |
| 12 | `generateConciergeReply` — stylist chat | chat message | no | **yes** | ~$0.0033 |
| 13 | `generateStyleManifestoWithGemini` — taste brief | Insights | no | **yes** | ~$0.0020 |
| 14 | `narrateWearWithGemini` — one-line wear note | log wear | no | no | ~$0.0002 |
| 15 | `generateTravelCapsuleWithGemini` — pack a trip | Calendar | no | no | **~$0.0052** |
| 16 | `regenerateTravelDayWithGemini` — reroll one day | Calendar | no | no | ~$0.0024 |
| 17 | `findProductListingFromPhoto` — shopping query | add item | **yes** | no | ~$0.0005 |

**Most expensive calls:** travel capsule (~$0.005), Concierge chat (~$0.0033), outfit compose (~$0.0028). These stuff much of the wardrobe into the prompt, so **cost scales with wardrobe size**. Cheapest (naming/tagging/narration) are ~$0.0002.

**No runaway loops** — every call is user-initiated; the Daily Brief is cached to max once/day/slot; bulk operations (Closet Sweep, tag backfill) are user-triggered and ride the rate limiter.

---

## 2. AI cost per user — scenarios

Blended realistic cost ≈ **$0.0012/call** (mostly cheap calls, a few heavy). At ~£0.79/$ ≈ multiply USD by ~0.79 for GBP.

| User type | AI calls/month | Est. AI cost/month | /year |
|---|---|---|---|
| **Light** (browses, logs wears) | ~20 | ~$0.03 | ~$0.35 / **£0.28** |
| **Typical** (composes, chats, adds items) | ~60 | ~$0.08 | ~$1.00 / **£0.79** |
| **Power** (heavy chat + travel + Closet Sweep) | ~300 | ~$0.45 | ~$5.40 / **£4.30** |
| **Worst case @ current cap** (75/day, all heavy) | ~2,250 | ~$11.30 | ~$135 / **£107** |

The first three are comfortably profitable. **The last row is the problem** — see §5.

---

## 3. Firebase costs (storage, database, functions, hosting)

**Architecture note:** photos are compressed to **≤150 KB** (max 800px, JPEG q0.75→0.35) and stored as **base64 inside the Firestore item document** (`src/lib/canvas.js:404-420`), not in Cloud Storage. Up to **6 photos/item**; docs are kept under Firestore's 1 MiB limit. **Cloud Storage is effectively unused.**

Footprint for a **200-item** user ≈ **~128 MB in Firestore** (images dominate).

| Service | Free (Blaze) allowance | Typical user draw | Cost driver to watch |
|---|---|---|---|
| **Firestore storage** | 1 GiB free, then **~$0.18/GiB/mo** | ~0.13 GiB | base64-in-doc inflates this ~7× vs Cloud Storage |
| **Firestore reads** | 50k/day free, then $0.06/100k | ~50–100/session | cold load reads *all* item docs (image bytes included) |
| **Firestore egress** | (network) ~$0.12/GiB | low after first load | offline cache means only deltas sync after first hydrate |
| **Cloud Functions** | 2M calls/mo free | calendar fetch + delete | negligible |
| **Hosting bandwidth** | 10 GB/mo free | ~bundle + 23 MB ONNX (cached once) | background-removal assets, cached by browser |
| **Auth** | free at this scale | — | — |
| **Weather (Open-Meteo)** | free, no key | 1/session | £0 |

**Net Firebase cost per typical user: a few pence/year.** Even a 300-item user over a few years stays in low-single-digit £/year. The base64-in-Firestore choice is the one thing that makes storage/egress ~7× pricier than it needs to be — **not urgent, but the obvious optimisation if storage ever shows up on the bill** (migrate images to Cloud Storage, store URLs in Firestore).

---

## 4. Payment & other fixed costs

- **Lemon Squeezy (Merchant of Record): ~5% + $0.50/transaction.** On **£12/mo**: ≈ £0.60 + £0.40 ≈ **£1.00/mo fee → ~£11 net**. On **£108/yr**: ≈ £5.40 + £0.40 ≈ **£5.80 fee → ~£102 net** (one transaction/year — annual is much more fee-efficient).
- **Domain + Cloudflare:** ~£10/yr domain; Cloudflare Pages free tier covers the marketing site.
- **Firebase project baseline:** no fixed fee on Blaze — you pay only for usage above the free allowances.

---

## 5. Margin & the cap problem

**Typical user, monthly plan:** £12 revenue − £1.00 LS fee − ~£0.10 AI − ~£0.05 Firebase ≈ **~£10.85 net/month**. Excellent.

**The per-user AI cap (now fixed).** `src/firebase.js`:
- Browser cap: **10/min, 200/day** (per browser, anti-runaway).
- Per-user cap: ✅ **`USER_MONTHLY_CAP = 500`/month** (Firestore-backed, the binding limit) — *was* 75/day.

The old 75/day allowed ~£9/month worst case (basically a whole subscription). The new 500/month bounds worst-case AI cost to **~£2/month / ~£24/year** — invisible to real users (heavy "power" user ≈ 300/month) but a hard ceiling on a scripted abuser. The daily/minute browser caps remain the burst guard.

**Also add a project-level budget alert** (Firebase Console → Billing → Budgets & alerts) at, say, £50/month so any systemic blow-up pages you before it's a surprise on the invoice.

---

## 6. Action checklist

1. ✅ **DONE — Paid Gemini tier confirmed.** Project is Blaze, billing account "Talastron Ltd", real Gemini cost accruing (~£1.28 in June 2026). Paid = not used for training. (Stale `// free tier` comment in `src/firebase.js` is just wrong wording; harmless.)
2. ✅ **DONE — per-user AI cap is now 500/month** (`USER_MONTHLY_CAP` in `src/firebase.js`), replacing 75/day. Worst case ~£2/user/mo.
3. **🟠 TODO — Set a project budget alert** (~£50/mo) in the Google Cloud / Firebase Console → Billing → Budgets & alerts, so runaway usage pages you before it's a surprise on the invoice. *(One-click form was visible on the billing Overview.)*
4. **🟢 (Later) Migrate images to Cloud Storage** if Firestore storage/egress ever shows on the bill — ~7× cheaper per GB and removes image bytes from every doc read. Not urgent at current scale.
5. **🟢 Re-check this model after 1 month of real usage** — replace the per-user call-count estimates with the actuals from `aiUsageMonthly` (byFeature/byDay are already recorded).

---

## 7. One-line verdict

At realistic usage the product is **comfortably profitable** (≈£10–£11 net/month on the monthly plan). The two things that could have quietly eroded that — an over-generous AI cap and the free-vs-paid Gemini tier — are now both closed (✅). The only open money task is a belt-and-braces budget alert.
