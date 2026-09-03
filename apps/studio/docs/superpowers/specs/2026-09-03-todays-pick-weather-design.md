# Today's Pick — what it should refuse to suggest

**Date:** 2026-09-03
**Status:** design agreed, not yet planned
**Trigger:** Today's Pick offered a *Ladies Country Fleece Quarter Zip* on a 24°C day.

Today's Pick is the weather-aware nudge in the Wardrobe rail: one owned piece, chosen daily,
stable through the day. It suggested a fleece at 24°C, and the interesting part is that nothing
about that was accidental — every component behaved as written.

---

## Why the fleece won

**The calendar outvoted the thermometer, structurally.** `pickTodaysRecommendation` scores:

```js
const score = weatherFit * 0.45 + seasonFit * 0.25 + recency * 0.15 + favouriteBoost * 0.15;
```

`seasonFit` contributes a flat **0.25** for a match. `weatherFit` contributes `fit × 0.45`, which
maxes out at **0.225**. So a perfect season match beats a perfect weather match, always. The fleece
is an Autumn/Winter piece on 3 September — which *is* Autumn — so it scored 1.0 on season while
the day was 24°C. Measured, across every plausible `subCategory` for that item:

| subCategory | weatherFit | → weather | season | recency | total |
|---|---|---|---|---|---|
| *(none)* | 0.50 | 0.225 | **0.250** | 0.150 | 0.625 |
| Fleece | 0.50 | 0.225 | **0.250** | 0.150 | 0.625 |
| Sweatshirt | 0.50 | 0.225 | **0.250** | 0.150 | 0.625 |
| Sweater | 0.25 | 0.113 | **0.250** | 0.150 | 0.512 |
| Jumper | 0.25 | 0.113 | **0.250** | 0.150 | 0.512 |

Season contributes more than weather in every row.

**And in the likely cases the scorer has no opinion at all.** `weatherAppropriatenessScore` returns
a neutral 0.50 for a fleece at 24°C, for two independent reasons:

- `HEAVY_PATTERNS` lists coat, jacket, blazer, sweater, jumper, knit, wool, cashmere, puffer, parka,
  trench, turtleneck. **`fleece` is not there**, nor sweatshirt, sherpa, quilted, padded, down or
  thermal.
- The text it matches against is built from `category`, `subCategory` and `styles` only. **The item's
  name is never read**, and "Ladies Country **Fleece** Quarter Zip" carries the decisive word there.

**So the hard filter was never the last line of defence.** Its comment justifies the 0.2 threshold
with "wool jumper on a 34°C day = never Today's Pick" — and at 34°C the *hot* bucket subtracts 0.45,
giving 0.05, correctly blocked. But 24°C is the *warm* bucket, which subtracts only 0.25, giving 0.25
and clearing the filter by five hundredths. **The threshold was tuned against the extreme case and
never checked against the moderate one.**

**The card then hid it.** `WardrobeView` says `fits today's 24°C` when the score is ≥ 0.5 and
`for today's 24°C` below that. The code knew the pick was poor and changed a preposition. The
distinction exists only in the source; to a reader both phrasings endorse the garment.

---

## The finding that reframes the fix

The wardrobe already holds the answer, and there are **two competing notions of season** in the same
file:

```js
// what today FEELS like — temperature-derived
export function weatherToSeasons(weather) {
  const t = weather.temp;
  if (t < 5)  return ['Winter'];
  if (t < 14) return ['Autumn', 'Winter'];
  if (t < 22) return ['Spring', 'Autumn'];
  return ['Summer'];                            // 24°C → Summer
}
```

`WardrobeView.jsx:378` uses this. `pickTodaysRecommendation` derives its own season from
`new Date().getMonth()` instead. On 3 September at 24°C they disagree — **calendar says Autumn,
thermometer says Summer** — and the recommender consulted the calendar.

The fleece declares `seasons: ['Autumn', 'Winter']`. Intersect that with `['Summer']` and it is
empty: **the item already declared itself unsuitable.** The AI that tagged it was instructed
"a wool coat = Autumn + Winter; a linen dress = Spring + Summer", so `seasons` is a *warmth
declaration*, not a calendar note. The recommender asked it "is it the right month?" when it answers
"what temperatures is this for?"

This is why the fix is not "add fleece to a keyword list". The keyword patterns are a crude
re-derivation of something each item already states about itself, and they were consulted *instead
of* the declaration rather than as a fallback to it.

---

## Decisions

### Today's Pick is "what to wear today". Weather decides.

The code answered this two ways at once: a 0.45 weather weight says advice, while the reasons copy
("never worn", "not worn in 3 months") says rediscovery. Advice wins. A piece that is wrong for the
day is never suggested, whatever else is in its favour; neglect and favourites only break ties among
pieces that all suit the day.

Rejected: *rediscovery, weather vetoes only the absurd* — honest about being a prompt, but it keeps
suggesting things you cannot wear, just less absurd ones. And *season leads, temperature adjusts* —
closest to how people think about a wardrobe, and precisely what produced this bug.

### One notion of season: the thermometer

`new Date().getMonth()` is deleted from `pickTodaysRecommendation`, which calls `weatherToSeasons`
instead — the same function the rest of the wardrobe view already uses.

### Season is a veto, not a score

This is the structural fix. A score term can be outvoted, and was. A gate cannot.

Eligibility is decided before any scoring. A candidate must be:

1. **owned and live** — as now;
2. **a garment** — `Tops`, `Bottoms`, `Dresses`, `Outerwear`;
3. **not contradicted by its own declaration** — if the item declares seasons, at least one must
   appear in `weatherToSeasons(weather)`.

An item declaring **no** seasons passes: silence is not a declaration, and vetoing on absent data
would punish items that were never scanned.

**Garments only, and why it matters here.** Today's Pick answers "what should I wear", so it should
suggest something worn. It is also a direct consequence of the veto: jewellery and bags rarely carry
a meaningful season declaration, so with cold-weather garments removed on a warm day, the pieces
that declare nothing would be disproportionately what remains. Never-worn earrings would win on
neglect, and the card would drift to jewellery without anyone deciding it should. Shoes are a real
judgement call and are excluded for now — including them opens the rain question, which is out of
scope below.

`Sportswear` and `Swimwear` are garments and are also excluded, for a different reason: both are
driven by an activity rather than by the weather, so "wear your swimsuit, it's 24°C" is wrong even
when the temperature agrees. They are excluded by omission from `PICKABLE_CATEGORIES`, and the
comment there says so, since an omission that looks like an oversight will eventually be
"corrected".

### Scoring only ranks what survived

With season promoted to a gate, its 0.25 leaves the score and the rest renormalise:

| term | was | becomes |
|---|---|---|
| `weatherFit` | 0.45 | **0.60** |
| `seasonFit` | 0.25 | *removed — now a veto* |
| `recency` | 0.15 | 0.20 |
| `favouriteBoost` | 0.15 | 0.20 |

Weather keeps the majority share rather than an equal one, because the two remaining terms are
tie-breakers among pieces that already suit the day. Both still sum to 1.0, so the numbers stay
comparable with anything logged against the old scale.

### The keyword score keeps its job and loses its faults

It is now the *only* weather signal for an item that declares no seasons, so it has to work:

- **read the item's `name`** alongside category, subCategory and styles;
- **add the missing family** to `HEAVY_PATTERNS`: `fleece`, `sweatshirt`, `sherpa`, `shearling`,
  `quilted`, `padded`, `down`, `thermal`, `flannel`.

It is no longer load-bearing for correctness — the veto is — so its remaining job is ranking: a
camisole should beat a long-sleeved linen shirt on a hot day even though both are tagged Summer.

### Nothing eligible is a real answer, not a fallback

If the veto empties the set, the card says so: *"Nothing in your collection suits 24°C."* It does
not pick the least-bad piece with a caveat. A caveat is the same move as the `fits`/`for` hedge, and
it is what let this ship.

### The card stops hedging

Everything displayed has passed the veto, so the `fit >= 0.5` branch goes and the card always reads
**"fits today's 24°C"**. The hedge existed to soften a claim the code could not stand behind. It can
now.

---

## Architecture

### `src/lib/weather.js`

Two new exported pure functions, so the rules are testable without a DOM or a network call:

```js
// Which categories Today's Pick may suggest. It answers "what should I wear",
// so it suggests something worn. Also load-bearing for the veto: jewellery and
// bags rarely declare seasons, so once cold-weather garments are vetoed on a
// warm day they would be most of what remains and would win on neglect alone.
// Sportswear and Swimwear are garments and are deliberately absent: both are
// driven by an activity rather than the weather, so suggesting a swimsuit
// because it is 24C is wrong even when the temperature agrees. Shoes are absent
// pending the rain question. None of these omissions is an oversight.
const PICKABLE_CATEGORIES = new Set(['Tops', 'Bottoms', 'Dresses', 'Outerwear']);

// The temperature bands, extracted so there is exactly one copy of them.
// weatherToSeasons already held these and takes a weather OBJECT, but
// pickTodaysRecommendation is called with a bare tempC
// (WardrobeView.jsx:395), so the bands need a temp-shaped entry point too.
// Duplicating them is how the calendar and the thermometer came to disagree in
// the first place.
export function seasonsForTemp(tempC) {
  if (tempC == null || Number.isNaN(tempC)) return null;
  if (tempC < 5) return ['Winter'];
  if (tempC < 14) return ['Autumn', 'Winter'];
  if (tempC < 22) return ['Spring', 'Autumn'];
  return ['Summer'];
}

// Unchanged signature, now delegating.
export function weatherToSeasons(weather) {
  return weather ? seasonsForTemp(weather.temp) : null;
}

/**
 * Why this item may not be Today's Pick, or null if it may. A veto, evaluated
 * before any scoring — a score term can be outvoted and was: season contributed
 * a flat 0.25 while weather contributed at most 0.225, so an Autumn fleece beat
 * the thermometer on a 24C day in September.
 *
 * Returns a reason rather than a boolean so the empty state can say something
 * true instead of guessing: 'not-a-garment' | 'wrong-season' | null.
 */
export function pickVeto(item, tempC) {
  if (!PICKABLE_CATEGORIES.has(item?.category)) return 'not-a-garment';
  const felt = seasonsForTemp(tempC);
  if (!felt) return null;                   // no temperature known — veto nothing
  const declared = itemSeasons(item);
  if (declared.length === 0) return null;   // silence is not a declaration
  return declared.some((s) => felt.includes(s)) ? null : 'wrong-season';
}

// Defined in terms of pickVeto, deliberately, so the two can never disagree
// about the same item — the flat-lay work spent five review rounds on a
// predicate and its writers drifting apart.
export function isPickableToday(item, tempC) {
  return pickVeto(item, tempC) === null;
}
```

`weatherAppropriatenessScore` gains the item name in its matched text and the missing heavy
patterns. Its signature does not change.

`pickTodaysRecommendation` filters by `isPickableToday` first, drops the `seasonFit` term and the
`new Date().getMonth()` block, and keeps its date-seeded stable selection over the top slice.

### `src/views/WardrobeView.jsx`

The card renders only when a pick exists. When `pickTodaysRecommendation` returns `null` **and the
wardrobe is not empty**, it renders the empty state naming the temperature. The `fits`/`for` branch
is replaced by the single `fits` phrasing.

---

## Testing

All of this is pure, and the existing `weather.test.js` covers the module already.

- **The fleece, as a named regression test.** `{ name: 'Ladies Country Fleece Quarter Zip',
  category: 'Tops', seasons: ['Autumn','Winter'] }` at 24°C must be vetoed, and must not be
  returned by `pickTodaysRecommendation` from a wardrobe where it is the only never-worn piece.
- A garment declaring no seasons is **not** vetoed at any temperature.
- Jewellery, bags, accessories, shoes are vetoed at every temperature.
- `weatherAppropriatenessScore` reads the name: the same item with an empty `subCategory` scores
  below neutral at 24°C on the strength of "Fleece" in its name alone.
- Each new heavy pattern is penalised in the warm and hot buckets.
- `pickTodaysRecommendation` returns `null` when every garment declares a non-matching season, and
  the veto reason is available for the empty state.
- The calendar is gone: the same wardrobe and temperature produce the same pick regardless of the
  current month. This is the property that failed, so it is asserted directly by stubbing the clock.

---

## Non-goals

- **Rain.** `precipProb` is fetched and unused. Garments-only removes the cases that matter most —
  suede shoes on a wet day — and linen in the rain is not a *wrong* suggestion. Worth its own change
  if it bites.
- **No re-tagging of seasons.** The design trusts the declarations already on the items. If they are
  wrong, that is a data problem with its own fix, and the veto makes wrong ones visible rather than
  hiding them.
- **No warmth rating.** Deriving a 1–5 warmth per item from the photo would be more robust than
  either seasons or keywords, and would need an AI pass over 160 items. `seasons` already carries
  the signal; spend that only if it proves insufficient.
- **Shoes stay out.** Adding them is a small change once the rain question is answered.

---

## The risk worth measuring

**The empty state may fire more often than expected.** Every Autumn/Winter-tagged piece is vetoed at
24°C, and a British wardrobe skews cold. If most of 160 items are tagged Autumn/Winter, September
afternoons will often have nothing eligible.

That is *correct* behaviour — the honest version of what the fleece was papering over — but a feature
that shows an empty state most days reads as broken rather than careful. **Count the season
distribution across the wardrobe immediately after implementing, before concluding the veto is
right.** One query answers it; no amount of specification does.

If it fires too often, the lever is `weatherToSeasons`' bands rather than the veto: `< 22 →
['Spring','Autumn']` means 22°C already counts as Summer-only, which is a warm reading of a British
September. Widening the Spring/Autumn band upward would admit more of the wardrobe without weakening
the rule.
