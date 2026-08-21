# Atelier Keyholders — The Ambassador Program

_Last updated: 2026-07-12_
_Companion to [atelier-gtm-strategy.md](./atelier-gtm-strategy.md) and [outreach-kit-first-cohort.md](./outreach-kit-first-cohort.md). This is how you turn your first delighted users into a self-widening circle — without ads, discounts, or affiliate spam._

---

## The one-line idea

> A **Keyholder** is someone you trust with keys to Atelier. They hold a small number of invitations to give to friends whose taste they vouch for — and in return they get status, recognition, and the pleasure of being the one who "let you in."

The reward is **belonging, not cash.** For a premium taste product, that's the only currency that doesn't cheapen the aura.

**Why "Keyholder":** you already call the founding code a *key* (`KYMDE3NG` = the founding key; the site surfaces "keys claimed"). A Keyholder is simply someone entrusted to pass keys on. The mechanic and the name are the same object — nothing to explain.

_(Alt names if you prefer: **The Founding Circle**, **The House**. Pick one and never rename it — the name is the status.)_

---

## Why gifting beats a paid affiliate program

| | **Keyholders (gift/invite)** | **Paid affiliate (avoid)** |
|---|---|---|
| **What's rewarded** | Trusted taste — "your eye is exactly who this is for" | Incentive — "I get £X if you sign up" |
| **Who it attracts** | The right friends, vouched for | Volume, spam, the wrong crowd |
| **Conversion** | Rates no paid channel touches | Low intent, high churn |
| **Brand effect** | Reinforces exclusivity | Cheapens a £79–108 product |
| **Cost to you** | ~£0 (metered AI/Firebase only) | Real payouts + tracking overhead |

> A founding key handed over by a friend who says *"your taste is exactly who I built this for"* is a taste endorsement. Cash referrals convert on incentive — which is the wrong signal for a taste product. (See [outreach-kit:135](./outreach-kit-first-cohort.md).)

---

## It rides rails you already have

**Nothing to build for v1.** Two existing pieces of infrastructure are the whole program:

1. **Invite access** — `subscriptionStatus.js` has an `isInvited` path (`'invited'` rule): an invited friend gets full access with **no card, no 14-day clock**, granted from **Profile → Invited Friends**.
2. **The share pipeline** — `lib/canvas.js` composes the 1080×1920 Style DNA card with a "made with Atelier" watermark. Every Keyholder share is branded, trackable traffic.

> ⚠️ **Constraint that shapes v1:** `firestore.rules` allows invites **only from owners** (you + Martin) — invited/paying users *cannot* invite anyone (`allow write: if isOwner()`). So **v1 runs through you by hand**: a Keyholder tells you who to let in; you grant it. That's fine at this scale (it keeps the list intentional and gives you a human touchpoint). **Self-serve invite passes are a deliberate, small future build** — don't ship them until the manual version proves the loop turns.

---

## The offer (what a Keyholder gets and gives)

**They give:**
- **3–5 keys** to friends whose taste they'd vouch for (you grant each one via Invited Friends, or issue the founding key `KYMDE3NG` for friends who should pay-to-belong).
- **One public Style DNA card** posted to their story/grid, tagging Atelier — asked for **only after they're visibly delighted**, never before.

**They get:**
- **The Keyholder status itself** — named, acknowledged, "one of the first." For this ICP, being *let in early* is the reward.
- **Recognition** — their Style DNA card (with permission) featured in the Journal / newsletter, credited. Public flattery is the pull.
- **The pleasure of generosity** — keys let *them* look like the tastemaker to their friends. You're not asking them to sell; you're handing them a gift to give.
- **A direct line to you** — early access to new features, their feedback visibly shipped. Founders' attention is a luxury; spend it here.

**They never get:** cash, commission, or a discount code to spray. Keep it clean.

---

## Who to make a Keyholder

Draw from two pools (both already tiered in the outreach kit):

- **Tier-A inner circle** who activated and *loved* it — the friends whose taste you trust. Natural first Keyholders.
- **Founding Members** (the paying first 100) who show advocacy — they've already put money behind belief; give them keys to widen it.

**The test:** would this person's endorsement make a stylish friend *lean in*? If yes, they're a Keyholder. If they're just supportive but off-ICP (a kind colleague, not a clothes person), they're a lovely user — not a key-carrier. Don't dilute the circle to be polite.

**Start tiny.** 5–10 Keyholders done well beats 40 who never use a key. This is the same "unscalable on purpose" logic as the first cohort.

---

## How to run it (manual v1, this month)

1. **Anoint privately, one at a time.** No launch announcement. A personal message: *"I'm letting a handful of people I trust carry keys to Atelier — you're one. You've got 3 to give to friends whose taste you'd vouch for. Want them?"* Private + selective = the status lands.
2. **Grant each invited friend by hand** — Profile → Invited Friends → their Google sign-in email. (Tier-A style, free/permanent.) For pay-to-belong friends, send the founding key instead.
3. **Ask for the share only after delight** — reuse the outreach kit's share ask ([outreach-kit:96](./outreach-kit-first-cohort.md)).
4. **Feature and thank publicly** — every Keyholder or their friend who posts a card gets re-featured. This *is* the reward loop; don't skip it.
5. **Track it** (columns below). The number that matters is **keys → activated wardrobes**, not keys handed out.

---

## Tracking sheet (one row per key issued)

| Keyholder | Friend invited | Date | Free or Founding? | Activated? (≥15 items + Style DNA) | Posted a card? | Notes |
|---|---|---|---|---|---|---|

Keep it beside your first-cohort sheet. **"Activated?" is the column that decides everything** — a key that never becomes a catalogued wardrobe taught you nothing.

---

## The metric that tells you it's working

This program exists to move **one number: the referral coefficient** — how many *new activated wardrobes* each Keyholder produces.

- **≥1 activated friend per Keyholder** → the loop compounds; widen the circle and, when ready, build self-serve invite passes.
- **<1** → the invite isn't converting. Fix *activation* (the first-15-items → Style DNA reveal) before handing out more keys. More keys won't fix a leaky reveal.

> This is the human, hand-run version of the share loop in [atelier-gtm-strategy.md:50](./atelier-gtm-strategy.md). Prove it turns by hand with 5–10 Keyholders **before** you automate or scale it.

---

## Do / Don't

**Do:** anoint privately and selectively · reward with status + recognition, not cash · grant keys by hand while `isOwner()` is the rule · ask for the share only after delight · feature every card publicly · keep the circle ICP-tight.

**Don't:** announce it like a campaign · pay commissions · issue discount codes · make everyone a Keyholder · hand out more keys before activation converts · build self-serve invites before the manual loop proves out.
