# Atelier — Go-To-Market Strategy

_Last updated: 2026-06-28_

## Context (the constraints this strategy is built for)

- **Stage:** Pre-launch (~0 external users; product built, payments wired via Lemon Squeezy, free trial live).
- **Beachhead audience:** Affluent style enthusiasts — women ~32–55 with real disposable fashion budgets who treat style as identity, not utility.
- **Budget:** Bootstrapped / organic (~£0–200/mo). Success = first paying subscribers via content, community, and founder-led effort.
- **Geography:** Global, no hard preference (£ pricing, UK-anchored).
- **Founder commitment:** Fully founder-led (on-camera + writing in public).

## The strategic bet

> **With no ad budget, the product must be its own top-of-funnel.** We don't buy attention — we manufacture artifacts so flattering and beautiful that affluent style enthusiasts share them unprompted, wrapped in a founder-led editorial voice.

## 1. Positioning (Wedge C — chosen)

**One line:**
> Atelier is the private atelier for your wardrobe — it turns the clothes you own into a beautiful archive and writes the manifesto of your personal style.

- **Lead with:** the curated-wardrobe / Style DNA / Style Manifesto angle (taste as identity).
- **Retention engine:** the Concierge Daily Brief (a reason to open the app every morning).
- **Supporting message, never the headline:** cost-per-wear / "smart money" (affluent enthusiasts want to feel *curated*, not *frugal*).

## 2. Beachhead customer

Woman, ~32–55, buys £150+ pieces without flinching. Thinks in taste and identity. Reads fashion Substacks, saves to Pinterest, follows quiet-luxury / capsule creators. Owns a lot, quietly guilty about under-wearing it, wants to feel curated. Organiser personality (enjoyed Pinterest boards / capsule spreadsheets).

**Copy test:** write to one such woman. If a 19-year-old fast-fashion shopper would also nod, it's off-target.

## 3. Pricing & packaging

- **One simple paid tier.** Free **trial → paid**. No free/pro matrix pre-launch (it splits a tiny funnel).
- **Annual-forward.** Suggest monthly ~£8–10 _or_ annual ~£70–80 (annual clearly better). Anchor: "less than one impulse top a year." _Validate exact number; structure matters more._
- **Founding Member offer** (pre-launch weapon): first ~100–250 subscribers lock a permanent discount + a "Founding Member" badge + invite passes to give away. Scarcity + status + referral in one move.
- **Referral rails already exist:** `subscriptionStatus.js` handles an `'invited'` path (`isInvited` rule) — friends get access without a `/subscriberAccess` doc. Invite-passes can ship on existing rails.

## 4. The growth engine — the shareable-artifact loop

**Loop:** Catalogue wardrobe → product generates a beautiful artifact → user shares it → viewers want their own → waitlist/trial → repeat.

Artifacts ranked by shareability:
1. **Style DNA card** (Colour Wheel + treemap + dominant palette) — works **day one**, no wear data. *Primary share unit.*
2. **Style Manifesto** — AI-written portrait of taste. Most ego-flattering thing the app makes. *Day-30 deepening hook.*
3. **Lookbook / outfit cards** — ongoing content fuel.

**Timing trap → turned into an advantage:** the Manifesto gates behind `WEARS_THRESHOLD = 30` wears (`FinanceView.jsx`), so it *can't* be the first-session share. Fix by sequencing:
- **Style DNA card = the instant share** (renders after ~10–15 items catalogued).
- **Manifesto = a reward "unlocked" at 30 wears** → doubles as a 30-day retention quest and a *second* share event near the trial→paid decision.

**Sharing infrastructure already exists (extend, don't build):** `lib/canvas.js` composes a 1080×1920 PNG (IG Story / Pinterest) in the editorial language, with `navigator.share` + file attach, download fallback, and a Pinterest create-pin fallback (`App.jsx`). It is wired only for **outfits**. The key GTM build is to point this pipeline at the **Style DNA card** and **Manifesto** (+ a "made with Atelier" watermark/link).

## 5. Channels (organic, founder-led, sequenced)

**Tier 1 — ~70% of effort:**
- **Pinterest** — perfect fit, high intent, pins compound for years. Style DNA cards, capsule guides, palette boards, CPW infographics; every pin → waitlist. Evergreen engine.
- **Instagram + TikTok** — founder-led build-in-public + Style DNA reveals, wardrobe tours, the "30 days of tracking taught me about my £2k of unworn clothes" arc.

**Tier 2 — owned audience:**
- **Newsletter (Substack)** — editorial voice matches the brand exactly. Weekly: one styling idea, one reader Style DNA feature, behind-the-build notes. Becomes the launch list; nobody can throttle email.

**Tier 3 — seeding / community:**
- **Creator gifting (not paying)** — free Founding Member access + invites to ~15–30 mid-tier (10k–80k) quiet-luxury/capsule creators. Genuine, no contract.
- **Communities** — r/femalefashionadvice, r/capsulewardrobe, capsule Facebook groups, niche Discords. Show up helpful, never spam.

## 6. Pre-launch (current focus)

- **Waitlist landing page** with the Wedge-C promise + email capture. Offer: "First 200 become Founding Members — locked price, badge, invites."
- **Style DNA lead magnet** before signups open (mini quiz / "drop your 5 most-worn pieces → palette read") that outputs a shareable card. Seeds the loop pre-launch.
- **Build in public from today** — the road-to-launch story *is* content and earns the first few hundred followers who become the launch cohort.

## 7. The 90-day plan

| Phase | Weeks | Goal | Key moves |
|---|---|---|---|
| **Tease** | 1–3 | Waitlist live, voice established | Landing page, Style DNA lead magnet, Pinterest + daily build-in-public, open Substack |
| **Seed** | 4–7 | Trust + creator advocates | Gift 15–30 creators, publish their Style DNAs, weekly newsletter, grow waitlist |
| **Launch** | 8–10 | Convert waitlist → Founding Members | Open trials in batches (scarcity + feedback control), Founding Member offer, ask every user to share Style DNA |
| **Compound** | 11–13 | Find the repeatable loop | Double down on best channel, turn on invite-passes, ship 30-day Manifesto unlock as re-share moment |

## 8. Activation & retention

- **Aha #1 (first session):** reach the **Style DNA reveal** fast → first-10-items onboarding must be quick and delightful (bulk add, photo capture, smart defaults). The reveal is the payoff.
- **Aha #2 (daily habit):** the **Concierge Daily Brief** — ensure trial users experience it daily, with a gentle notification.
- **30-day quest:** "Wear-track your way to your Style Manifesto" — converts the gating limit into a retention narrative + a second share event at the trial→paid moment.

## 9. Metrics

- **North Star:** weekly active wardrobes that logged a wear.
- **Pre-launch:** waitlist size + waitlist→trial conversion.
- **Funnel:** share/impression → waitlist → trial start → activated (generated a Style DNA) → paid → retained 30/90d.
- **Two numbers that decide everything:** trial→paid (target ≥25–30%) and **share rate** (% who export a Style DNA = the viral coefficient). If share rate is low, fix it before scaling effort.
- **Credible 6-month outcome:** a few hundred to ~1,000 paying subscribers _if_ the share loop + one channel click. Slower than paid, but durable and profitable.

## 10. Risks & de-risking

| Risk | De-risk |
|---|---|
| Share artifacts not share-worthy enough | Invest design polish in the export cards before launch — the linchpin |
| Activation friction (cataloguing is a chore) | Fast, rewarding first-10-items onboarding |
| Founder burnout (organic grind) | Front-load evergreen Pinterest + newsletter that keep working while you rest |
| Premium price vs unproven value | Founding Member scarcity + a trial that guarantees the aha |

## Decisions locked

- Wedge **C** (private atelier / Style Manifesto), Concierge as retention, CPW as support.
- Fully founder-led, organic, Pinterest + IG/TikTok + Substack as the channel spine.
- Founding Member offer on existing invite rails.
- Primary share unit = **Style DNA card** (instant); Manifesto = 30-day unlock + second share.
