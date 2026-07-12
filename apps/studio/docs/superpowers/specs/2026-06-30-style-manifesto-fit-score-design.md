# Style Manifesto — evolution & fit-score (Phase 1)

**Date:** 2026-06-30
**Status:** Design approved, pending written-spec review
**Scope:** Phase 1 of a two-phase concept. Phase 2 (public taste-test) is documented here but **not** built in this cycle.

---

## North star

**Depth & delight is the quality bar; shareability / acquisition is the outcome.**

The decision filter for every choice in this spec: *would someone screenshot this and send it to a friend?*

This matters because the project's bottleneck is demand, not build (per GTM notes: the site, Studio, trial, and payments are all live). A Style Manifesto so accurate and well-written that people share it is, by its nature, the most shareable artifact the product can produce. The fit-score is the same magic pointed at a purchase decision.

---

## Background: how the Manifesto works today

- **Generation:** `generateStyleManifestoWithGemini()` in `src/lib/ai.js` (~line 832). Gemini 2.5 Flash, streamed, temperature 0.7.
- **Inputs:** top 15 most-worn pieces, last 10 outfit pairings, up to 12 analysed inspirations.
- **The clever bit:** paragraph 3 of the prompt names the *tension* between what the user wears and what they save as inspiration — the "aspiration gap."
- **Output:** exactly 3 short paragraphs (aesthetic / colour-texture / tension), in that fixed order.
- **Storage:** `measurements.styleManifesto` + `measurements.styleManifestoAt` in Firestore. User-initiated only; ≥5 owned items required; 90-day staleness nudge.
- **Display:** `StyleManifestoCard` in `src/views/FinanceView.jsx` (~line 800), on the **Insights / The Dossier** tab (the tab's internal id is the legacy `'finance'`; its label is "Insights").
- **No scoring exists today.** No item, wishlist or owned, is currently measured against the manifesto. This spec introduces that.

---

## The concept in one line

Turn the Manifesto from a **terminal artifact** (beautiful, then it just sits there) into a **working signal** that judges how well any item fits the user — surfaced as a shareable *Verdict*.

---

## Part 1 — Manifesto presentation refinements

Enhance the existing `StyleManifestoCard`. No change to generation logic; the static labels map onto the generator's existing fixed paragraph order.

1. **Per-paragraph labels** — uppercase eyebrows above each paragraph: *Your signature* · *Colour and texture* · *What you're reaching for*. Adds rhythm and scannability; signposts the aspiration paragraph as the payoff. Static labels, no prompt change.
2. **Aspiration pull-quote** — paragraph 3 renders larger (≈17px) with a brass left-border, making the most shareable sentence the visual climax.
3. **Concierge sign-off** — a "— Your Concierge" line at the end, turning the brief into a personal letter.
4. **Share as card** — export the manifesto to a branded image, mirroring the existing Style DNA card. This is the literal vehicle for the shareability goal: without it, the brief cannot leave the app.

## Part 2 — The fit-score engine (reusable core)

New function in `src/lib/ai.js`:

```
generateItemFitWithGemini({ item, manifesto, inspirations, styleProfile, items }) → {
  verdict:    string,            // the screenshot line, in the Concierge voice
  coherence:  number (0–1),      // is this within the user's aesthetic universe?
  aspiration: number (0–1),      // does it close the wear-vs-save gap?
  dimensions: [ { label, state, level } ],  // e.g. Palette/Silhouette/Formality + aspiration
  basis:      "inspirations" | "profile"    // which aspiration source was used
}
```

**Scoring method (decided): a single Gemini judgment call returning structured JSON — not embeddings.**
Rationale:
- Reuses existing Gemini 2.5 Flash infrastructure and prompt patterns.
- Lets the model derive structure from freeform manifesto prose *at scoring time*, so the prose stays the single source of truth — no separate "structured manifesto" data model to maintain or keep in sync.
- Produces the verdict sentence and the dimension scores in one shot.

**Coherence floor × aspiration lift.** Both values come back from the model. A low coherence caps the headline verdict, so an off-style item cannot score highly merely for being *different* from the wardrobe. A great score = coherent **and** gap-closing. The aspiration line leads the verdict (it's the delightful part); the coherence floor keeps it honest.

**Cold start (decided: bootstrap from quiz).**
- If analysed `inspirations` exist → `basis = "inspirations"`, measure aspiration against saved inspirations.
- Else → `basis = "profile"`, use the declared style-profile quiz (undertone, silhouette, formality, palette, principles) as the aspiration stand-in.
- The verdict wording adapts: "based on what you save" vs. "based on the style you've described." No cold-start cliff; the read gets more magical as inspirations accrue.

**Caching.**
- Score computed on demand, cached on the item as `item.manifestoFit` (including the `styleManifestoAt` it was computed against).
- Invalidated when the manifesto is refreshed (cached `styleManifestoAt` ≠ current). Keeps Gemini spend bounded and makes Phase 2's public version cheap.

## Part 3 — In-app surfaces

- **Wishlist** — each wishlist item shows its **Verdict** (one-line judgement). Tapping expands to the **Dimensional read** (palette / silhouette / formality / aspiration, shown qualitatively). Verdict = the delight; dimensions = the depth on demand.
- **Any candidate ("Should I buy this?")** — score an item not yet in the wardrobe, using the same engine. The in-the-moment decision-support surface.

Both live on wardrobe/shopping surfaces, **not** on Insights. The Manifesto stays on Insights (a reflective output); the fit-score lives where purchase decisions happen. They share one engine.

---

## Out of scope for Phase 1 (Phase 2 — documented, not built)

**Public taste-test (growth play).** Wrap the proven engine in an anonymous, public-facing experience: a non-user drops in an item, gets a taste of the Verdict, and is invited to sign up for their full Manifesto.

**Why it's deferred, not dropped:**
- The public version is only as persuasive as the Verdict behind it — the engine must be proven to give people chills first.
- It feeds a signup funnel whose #1 known leak is that the Journal has no email capture. Pouring strangers into a leaky funnel wastes the demand it creates.
- Anonymous users hitting Gemini is a cost/abuse surface requiring rate-limiting and caching — wasted work if the engine underneath isn't validated.

Phase 2 gets its own spec → plan → build cycle, gated on (a) a validated engine and (b) the email-capture leak being fixed.

**Also out of scope:** renaming the legacy `'finance'` tab id / £ icon to `'insights'` (tracked as a separate cleanup task).

---

## Open items / decisions deferred to the implementation plan

- Exact JSON prompt wording for `generateItemFitWithGemini` (voice, anti-cliché constraints, UK English — mirror the existing manifesto/style-fit prompts).
- Precise dimension set and how `level` maps to qualitative `state` labels ("Aligned" / "A reach" / etc.).
- Share-card layout and export mechanism (reuse the Style DNA card's image pipeline).
- Where the "Should I buy this?" entry point sits in the wardrobe/wishlist navigation, and how a not-yet-owned candidate is captured (manual entry vs. existing add-item flow).

---

## Success criteria

- A user with a generated manifesto sees a Verdict on every wishlist item, expandable to a dimensional read.
- A user with **no** saved inspirations still gets a coherent verdict (profile-based), with wording that reflects the basis.
- Off-style items score low even when novel (coherence floor works).
- The refined manifesto card can be exported as a branded shareable image.
- Scores do not recompute on every view (caching against `styleManifestoAt` works).
