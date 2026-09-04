# Goals and budget — telling the Concierge what you are trying to do

**Date:** 2026-09-04
**Status:** design agreed, not yet planned
**Origin:** open decision 4 from the 2026-08-17 Studio UX review — *"Goals & budget capture at onboarding, to feed the Concierge. Agreed it's worth doing; needs wording that should be hers."*

The app knows what you own, what you wear, what suits you and what the weather is. It does not know what you are **trying to do**. So its wardrobe audit can tell you that you own fourteen tops and two pairs of trousers, and cannot tell you whether that is a problem.

---

## What exists already

**There is no onboarding to attach a question to.** `ONBOARD_STEPS` in `App.jsx` is a five-step *tour* — "Build your wardrobe", "Style with the Concierge", "A button with two minds" — gated on a `localStorage` key. It explains the app and collects nothing.

**But the pattern exists one level down, and it works.** The style profile — undertone, silhouette, formality, palette, principles — is a set of fields on `measurements`, edited as rows of pickers in Profile → Style, and `summariseStyleProfile()` in `items.js` turns them into one sentence appended to every Gemini prompt:

> Style profile: undertone is cool; body shape is pear; prefers polished dressing by default.

`taxonomy.js:22` calls these "populated by the quiz". There is no quiz. That comment describes an intention nobody built, which is worth noting because this design deliberately does not build one either.

**Two of the three surfaces are already wired.** `scorePurchaseWithGemini` receives `measurements`, so anything stored beside the style profile reaches purchase scoring with no new parameter. `generateOutfitWithGemini`, `generateItemFitWithGemini` and the Concierge all receive `styleProfile`. **`analyzeWardrobeGapsWithGemini` is the gap** — it receives items and inspirations and knows nothing whatever about the person, not even the style profile that already exists.

---

## Decisions

### It drives what the app surfaces, not how it sounds

Goals steer the wardrobe audit and the gap analysis — *"you said you want more for work, and you own two work-appropriate pieces"* — and budget prioritises which gap is worth filling first. This is wider than the review item implied: it reaches into Insights and the gap analysis, not only the Concierge.

Rejected: **shaping tone only** — knowing someone is building a capsule on a modest budget could make the stylist sound like it knows them, but nothing it *said* would be materially different, which makes the capture impossible to justify. Rejected: **arguing against purchases** — a strong version, and it belongs to the wardrobe-rotation decision still open from the same review rather than to this one.

### Goals are a short fixed list, one or two chosen

The same shape as the style principles already in Profile, which the Concierge handles well. A fixed set is what makes prioritisation possible: a stated goal of dressing better for work lets a work-appropriate gap outrank an evening one, and a model cannot rank a gap against a sentence it has never seen.

Rejected: **free text** — far more expressive and catches the goal no list anticipated, but it reduces to something the Concierge can only echo back sympathetically, so the prioritisation this design exists for would be softer than it sounds. Rejected: **both** — the most faithful to how people describe this, and two questions where the review implied one.

**The list is the feature, not decoration.** These become the fixed vocabulary the gap analysis reasons against, so "Buy less, wear more" and "Build a capsule I actually wear" must produce genuinely different advice from the same wardrobe — one argues against filling a gap, the other argues for filling it precisely. A list written to sound pleasant would give the model nothing to act on.

Working draft, **to be replaced with Sibylle's wording**:

```js
export const STYLE_GOALS = [
  'Build a capsule I actually wear',
  'Dress better for work',
  'Buy less, wear more',
  'Find my own style rather than trends',
  'Rebuild after a change — size, job, life',
  'Dress for something specific coming up',
];
```

### Budget is inferred from the wardrobe, shown back, and correctable

Every item carries a price. So the app derives what a typical and a top-end purchase look like for this person, shows it, and lets them adjust:

> You usually spend around **£80**, and **£400** is a big buy. Is that about right?

This turns a question nobody enjoys being asked at signup into a confirmation. It is also correct from the first day rather than after a guess, and it sharpens as the wardrobe grows.

**Median and 90th percentile, not mean and max.** This wardrobe contains a £3,500 Cartier watch among items at £49. A mean would report a typical spend nobody recognises, and a max would report a ceiling that describes one purchase. The median answers "what do you normally spend"; the 90th percentile answers "what counts as a lot for you" without letting a single outlier define it.

Rejected: **asking for a per-item ceiling** — unambiguous and entirely under the user's control, but a blunt question at signup, and one number describes a coat and a t-shirt equally badly. Rejected: **asking for a band** (modest / considered / unconstrained) — gentler to ask, but it cannot answer "is this too expensive" about a specific piece, which is exactly what purchase scoring exists to do.

### Captured in Profile → Style, reached by the tour

No new onboarding flow. The fields join the existing rows in Profile → Style, and the tour gains one step pointing at them — reusing `ONBOARD_STEPS`' existing `cta` and `target`, which already jump to a tab.

That keeps a working five-step tour working, puts the fields where the rest of the profile lives, and avoids building the quiz that `taxonomy.js` has been promising since before this review.

---

## Architecture

### `src/lib/taxonomy.js`

`STYLE_GOALS` as above — the fixed vocabulary, exported so the picker, the summariser and the prompts all read one list.

### `src/lib/budget.js` — new, pure

```js
/**
 * What this person typically spends, and what counts as a lot, derived from
 * the prices already on their owned items.
 *
 * Median and p90 rather than mean and max, because a wardrobe mixes a £3,500
 * watch with £49 dresses: a mean reports a typical spend nobody recognises,
 * and a max reports a ceiling that describes a single purchase.
 *
 * Returns null below MIN_PRICED_ITEMS — an inference from four prices is a
 * guess wearing a number's clothes, and it is better to say nothing.
 */
export const MIN_PRICED_ITEMS = 8;

export function inferBudget(items) {
  const prices = (Array.isArray(items) ? items : [])
    .filter((i) => i.status === 'owned' && !i.deletedAt)
    .map((i) => Number(i.price))
    .filter((p) => Number.isFinite(p) && p > 0)   // a missing price is not £0
    .sort((a, b) => a - b);
  if (prices.length < MIN_PRICED_ITEMS) return null;
  const at = (q) => prices[Math.min(prices.length - 1, Math.floor(q * prices.length))];
  return { typical: at(0.5), high: at(0.9), sampleSize: prices.length };
}
```

Stored overrides live on `measurements` beside the style profile: `budgetTypical` and `budgetHigh`, both optional. When present they win; when absent the inference is used. The UI shows the inferred figures as the field's placeholder so the user is correcting a real number rather than filling a blank.

### `src/lib/items.js` — `summariseStyleProfile`

Gains two clauses, so everything already receiving `styleProfile` gets goals and budget with no signature change:

> Style profile: undertone is cool; body shape is pear; **working toward: build a capsule I actually wear; buy less, wear more; typically spends around £80 a piece, £400 is a big buy.**

### `src/lib/ai.js` — the surfaces

- **`analyzeWardrobeGapsWithGemini`** gains a `styleProfile` parameter and is told to rank gaps against the stated goals and to keep suggestions within the stated budget. This is the change that makes goals do something: the audit currently knows nothing about the person.
- **`scorePurchaseWithGemini`** needs no new parameter — it already receives `measurements`. Its prompt gains the budget context so it can say a piece is well above what this person normally spends.
- Everything else — the Concierge, outfit generation, item fit — inherits the change through `summariseStyleProfile`.

### `src/views/ProfileView.jsx` and `src/App.jsx`

Two rows in Profile → Style: goals as a multi-select capped at two, budget as two optional number fields with the inferred values as placeholders. One added tour step whose CTA jumps to Profile.

---

## Testing

`inferBudget` is pure and gets the coverage:

- median and p90 on a known set, including the £3,500-among-£49s case, asserting a mean would have been wrong
- items with no price, zero price, and non-numeric price are excluded rather than counted as £0
- wishlist and deleted items are excluded — this is what you *have* spent, not what you might
- returns `null` below `MIN_PRICED_ITEMS`, and the caller renders no placeholder rather than a fabricated one
- a single item priced £0 does not produce a £0 budget

`summariseStyleProfile` gets cases for goals only, budget only, both, and neither — the last returning `''` exactly as now, so an untouched profile still adds nothing to any prompt.

`STYLE_GOALS` entries are asserted to round-trip through the picker's value handling, so a goal cannot be stored that the list does not contain.

---

## Non-goals

- **No quiz.** `taxonomy.js` has promised one since before this review; building one is a bigger change than this decision, and the fields work without it.
- **No spend tracking over time.** Items carry a price but no purchase date, so "£X this year" is not derivable. Inference describes the wardrobe, not a period.
- **No budget enforcement.** Nothing is blocked or hidden. The Concierge gains context, not a veto — the version that argues against purchases belongs to the open wardrobe-rotation decision.
- **No change to the tour's other five steps.**

---

## Risks

| Risk | Handling |
|---|---|
| The goal list is wrong, so nobody picks anything useful | The wording is Sibylle's, and it is one exported array. The failure is visible the first time the audit gives advice that ignores a stated goal |
| Inferred budget is wrong for someone whose wardrobe predates their means | It is a placeholder in an editable field, not a stored fact. Correcting it is one number |
| A sparse wardrobe infers nonsense | `MIN_PRICED_ITEMS = 8`, below which it says nothing rather than guessing |
| Goals make the audit worse by narrowing it | The prompt asks it to *rank* gaps by the goals, not to ignore gaps outside them — an unstated goal should still surface a genuine hole |
| Nobody finds the fields | The tour step is the only discovery mechanism, and it fires once. If uptake is poor the answer is the quiz this design deliberately did not build |
