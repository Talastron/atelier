# Today's Pick Weather Appropriateness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop Today's Pick suggesting a garment that is wrong for the day, by making the item's own season declaration a veto rather than a score term it can outvote.

**Architecture:** One set of temperature bands (`seasonsForTemp`) with two entry points. A pure `pickVeto` decides eligibility before any scoring: garments only, and no item whose declared seasons contradict what today's temperature feels like. `pickTodaysRecommendation` filters by that veto, drops its calendar-derived season term, and ranks only what survived. Where nothing survives, the card says so.

**Tech Stack:** Vanilla ES modules, vitest 4, React 18. All new logic is pure — no DOM, no network.

**Spec:** `apps/studio/docs/superpowers/specs/2026-09-03-todays-pick-weather-design.md`

**Worktree:** `C:\Users\SibylleMoller-Sherwo\Documents\GitHub\atelier-wt-flatlay`, branch `weather-todays-pick`. `cd` there and run every command from that directory. It is a git worktree — do **not** `cd` to the main checkout at `...\GitHub\atelier`, and do **not** use `git stash` (the stack is shared with other live sessions).

Test: `pnpm --dir apps/studio test` (290 passing). Build: `pnpm --dir apps/studio build`.

---

## Read this before Task 1

**`apps/studio/src/lib/weather.js` has no test file at all.** Every other pure module in `src/lib` has one — 15 of them. This module holds two pure functions that are both wrong, and that absence is most of why. Task 1 creates `weather.test.js` and pins the *current* behaviour of the bug before changing anything, so the fix is demonstrably a fix rather than a different guess.

**The bug in one line:** `seasonFit` contributes a flat 0.25 to the score while `weatherFit` contributes at most `0.45 × 1.0 = 0.225`, so a calendar match always beats a weather match. On 3 September at 24°C the calendar says Autumn and the thermometer says Summer, and an Autumn/Winter fleece won.

**Do not widen the keyword lists as the fix.** The keyword patterns are a crude re-derivation of something each item already declares in `seasons`. They are repaired in Task 4 because they are the only signal for items that declare nothing, but they are not what makes this correct — the veto is.

---

## File structure

| File | Responsibility | Change |
|---|---|---|
| `src/lib/weather.js` | Weather fetch, labelling, appropriateness scoring, the pick | `seasonsForTemp`, `pickVeto`, `isPickableToday`; veto in the picker; name + patterns in the score |
| `src/lib/weather.test.js` | **New.** Tests for the pure half of that module | Created in Task 1 |
| `src/views/WardrobeView.jsx` | Wardrobe page, incl. the Today's Pick card | Empty state; drop the `fits`/`for` hedge |

`weather.js` keeps its existing shape. The three new exports are pure and sit beside `weatherToSeasons`, which already holds the bands they share.

---

### Task 1: Pin the bug before changing it

**Files:**
- Create: `apps/studio/src/lib/weather.test.js`

No production code changes in this task. The point is a test that fails *after* the fix, proving the fix did something.

- [ ] **Step 1: Write the characterisation test**

Create `apps/studio/src/lib/weather.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { weatherAppropriatenessScore, pickTodaysRecommendation, weatherToSeasons } from './weather.js';

// The real item that prompted this work: Today's Pick offered it on a 24C day.
const FLEECE = {
  id: 'fleece',
  name: 'Ladies Country Fleece Quarter Zip',
  brand: 'Holland Cooper',
  category: 'Tops',
  subCategory: '',
  status: 'owned',
  seasons: ['Autumn', 'Winter'],
};

const LINEN_SHIRT = {
  id: 'linen',
  name: 'Linen Shirt',
  category: 'Tops',
  subCategory: 'Shirt',
  status: 'owned',
  seasons: ['Spring', 'Summer'],
  materials: ['Linen'],
  lastWorn: '2026-08-01',
};

describe('weatherToSeasons', () => {
  // The bands that already existed. 24C is Summer — which is the whole point:
  // the wardrobe already had a function that knew the fleece was wrong.
  it('maps a temperature to the seasons it feels like', () => {
    expect(weatherToSeasons({ temp: 2 })).toEqual(['Winter']);
    expect(weatherToSeasons({ temp: 10 })).toEqual(['Autumn', 'Winter']);
    expect(weatherToSeasons({ temp: 18 })).toEqual(['Spring', 'Autumn']);
    expect(weatherToSeasons({ temp: 24 })).toEqual(['Summer']);
  });

  it('is null with no weather', () => {
    expect(weatherToSeasons(null)).toBeNull();
  });
});

describe('the fleece at 24C — characterisation of the bug', () => {
  // Documents CURRENT behaviour so the fix is provably a change. Both of these
  // assertions are inverted in Task 3.
  it('currently scores the fleece as neutral, having no opinion', () => {
    expect(weatherAppropriatenessScore(FLEECE, 24)).toBe(0.5);
  });

  it('currently picks the fleece over a linen shirt on a 24C day', () => {
    const pick = pickTodaysRecommendation([FLEECE, LINEN_SHIRT], 24);
    expect(pick?.id).toBe('fleece');
  });
});
```

- [ ] **Step 2: Run it and confirm the bug reproduces**

Run: `pnpm --dir apps/studio test -- weather`

Expected: PASS, all 4. If `currently picks the fleece` does **not** pass, stop and report — the reproduction is wrong and the rest of the plan is built on it.

Note the fleece wins here partly because it is never worn (`recency` 1.0) while the linen shirt was worn recently. That is deliberate: it is the real shape of the bug, where neglect plus a calendar match beat the thermometer.

- [ ] **Step 3: Commit**

```bash
git add apps/studio/src/lib/weather.test.js
git commit -m "test(weather): pin the fleece-at-24C bug before fixing it

weather.js had no test file at all - the only pure module in src/lib
without one, and it holds the two functions this bug lives in. These
assertions document current behaviour so the fix is provably a change:
the scorer returns a neutral 0.5 for a fleece at 24C, and the picker
prefers it to a linen shirt.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: One set of temperature bands

**Files:**
- Modify: `apps/studio/src/lib/weather.js:171-178` (`weatherToSeasons`)
- Test: `apps/studio/src/lib/weather.test.js`

`weatherToSeasons` takes a weather **object**, but `pickTodaysRecommendation` is called with a bare `tempC` (`WardrobeView.jsx:395`). The veto needs the bands from a temperature. Copying them would create a second set — and two sets of season thresholds drifting apart is exactly how the calendar and the thermometer came to disagree.

- [ ] **Step 1: Write the failing test**

Append to `apps/studio/src/lib/weather.test.js`:

```js
describe('seasonsForTemp', () => {
  it('maps a bare temperature to the seasons it feels like', () => {
    expect(seasonsForTemp(2)).toEqual(['Winter']);
    expect(seasonsForTemp(10)).toEqual(['Autumn', 'Winter']);
    expect(seasonsForTemp(18)).toEqual(['Spring', 'Autumn']);
    expect(seasonsForTemp(24)).toEqual(['Summer']);
  });

  it('is null when the temperature is unknown', () => {
    expect(seasonsForTemp(null)).toBeNull();
    expect(seasonsForTemp(undefined)).toBeNull();
    expect(seasonsForTemp(NaN)).toBeNull();
  });

  // The boundaries, because they are the lever if the veto proves too strict.
  it('treats the band edges as the lower bound of the warmer band', () => {
    expect(seasonsForTemp(5)).toEqual(['Autumn', 'Winter']);
    expect(seasonsForTemp(14)).toEqual(['Spring', 'Autumn']);
    expect(seasonsForTemp(22)).toEqual(['Summer']);
  });

  // One source of truth: the object-shaped entry point must agree with the
  // temperature-shaped one at every boundary.
  it('agrees with weatherToSeasons', () => {
    for (const t of [-5, 0, 4, 5, 13, 14, 21, 22, 30]) {
      expect(weatherToSeasons({ temp: t }), `${t}C`).toEqual(seasonsForTemp(t));
    }
  });
});
```

Add `seasonsForTemp` to the import at the top of the file:

```js
import { weatherAppropriatenessScore, pickTodaysRecommendation, weatherToSeasons, seasonsForTemp } from './weather.js';
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --dir apps/studio test -- weather`

Expected: FAIL with `seasonsForTemp is not a function`.

- [ ] **Step 3: Extract the bands**

In `apps/studio/src/lib/weather.js`, replace the whole `weatherToSeasons` function:

```js
// Given weather, suggest which item seasons fit.
export function weatherToSeasons(weather) {
  if (!weather) return null;
  const t = weather.temp;
  if (t < 5) return ['Winter'];
  if (t < 14) return ['Autumn', 'Winter'];
  if (t < 22) return ['Spring', 'Autumn'];
  return ['Summer'];
}
```

with:

```js
// Which seasons a temperature FEELS like. The bands live here once, with two
// entry points onto them, because there used to be two competing notions of
// season in this file: this one, and a calendar month inside
// pickTodaysRecommendation. On 3 September at 24C they disagreed — calendar
// Autumn, thermometer Summer — and the picker consulted the calendar, so an
// Autumn/Winter fleece was offered on a warm day.
//
// If the veto in pickVeto proves too strict for a British autumn, THIS is the
// lever rather than the veto: 22C currently reads as Summer-only, which is a
// warm reading of September. Widening the Spring/Autumn band upward admits more
// of the wardrobe without weakening the rule.
export function seasonsForTemp(tempC) {
  if (tempC == null || Number.isNaN(tempC)) return null;
  if (tempC < 5) return ['Winter'];
  if (tempC < 14) return ['Autumn', 'Winter'];
  if (tempC < 22) return ['Spring', 'Autumn'];
  return ['Summer'];
}

// Given weather, suggest which item seasons fit. Unchanged signature — several
// callers pass the weather object — now delegating so there is one set of bands.
export function weatherToSeasons(weather) {
  return weather ? seasonsForTemp(weather.temp) : null;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm --dir apps/studio test -- weather`

Expected: PASS. The `agrees with weatherToSeasons` case is the one that matters — it is the assertion that stops the bands being copied again.

- [ ] **Step 6: Commit**

```bash
git add apps/studio/src/lib/weather.js apps/studio/src/lib/weather.test.js
git commit -m "refactor(weather): one set of temperature bands, two entry points

pickTodaysRecommendation is called with a bare tempC, weatherToSeasons
takes a weather object, and the veto needs the bands from a temperature.
Copying them would make a second set - and two sets of season thresholds
drifting apart is how the calendar and the thermometer came to disagree
in the first place.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: The veto, and deleting the calendar

**Files:**
- Modify: `apps/studio/src/lib/weather.js` (add `PICKABLE_CATEGORIES`, `pickVeto`, `isPickableToday`; rewrite `pickTodaysRecommendation`)
- Test: `apps/studio/src/lib/weather.test.js`

This is the task that fixes the bug. Both characterisation assertions from Task 1 get inverted here.

- [ ] **Step 1: Write the failing tests**

Append to `apps/studio/src/lib/weather.test.js`:

```js
describe('pickVeto', () => {
  it('vetoes a garment whose declared seasons contradict the day', () => {
    expect(pickVeto(FLEECE, 24)).toBe('wrong-season');
  });

  it('allows a garment whose declared seasons include the day', () => {
    expect(pickVeto(LINEN_SHIRT, 24)).toBeNull();
    expect(pickVeto(FLEECE, 8)).toBeNull();
  });

  // Silence is not a declaration. Vetoing on absent data would punish anything
  // that was never scanned, which is a data gap rather than a wrong garment.
  it('allows a garment that declares no seasons, at any temperature', () => {
    const untagged = { id: 'u', name: 'Plain Tee', category: 'Tops', status: 'owned' };
    for (const t of [-5, 8, 18, 24, 35]) {
      expect(pickVeto(untagged, t), `${t}C`).toBeNull();
    }
  });

  // Today's Pick answers "what should I wear", so it suggests something worn.
  // Also load-bearing for the veto: these categories rarely declare seasons, so
  // once cold-weather garments are vetoed they would be most of what remains
  // and would win on neglect alone.
  it('vetoes anything that is not a garment, at every temperature', () => {
    for (const category of ['Shoes', 'Bags', 'Accessories', 'Jewellery', 'Sportswear', 'Swimwear']) {
      const item = { id: category, name: category, category, status: 'owned', seasons: ['Summer'] };
      expect(pickVeto(item, 24), category).toBe('not-a-garment');
    }
  });

  it('allows all four garment categories', () => {
    for (const category of ['Tops', 'Bottoms', 'Dresses', 'Outerwear']) {
      const item = { id: category, name: category, category, status: 'owned', seasons: ['Summer'] };
      expect(pickVeto(item, 24), category).toBeNull();
    }
  });

  it('vetoes nothing on season when the temperature is unknown', () => {
    expect(pickVeto(FLEECE, null)).toBeNull();
  });

  it('still vetoes a non-garment when the temperature is unknown', () => {
    expect(pickVeto({ id: 'j', category: 'Jewellery', status: 'owned' }, null)).toBe('not-a-garment');
  });

  it('is falsy-safe', () => {
    expect(pickVeto(null, 24)).toBe('not-a-garment');
    expect(pickVeto({}, 24)).toBe('not-a-garment');
  });

  // The two must never disagree about the same item.
  it('isPickableToday is exactly the absence of a veto', () => {
    for (const item of [FLEECE, LINEN_SHIRT, { category: 'Jewellery' }]) {
      for (const t of [8, 24, null]) {
        expect(isPickableToday(item, t)).toBe(pickVeto(item, t) === null);
      }
    }
  });
});

describe('pickTodaysRecommendation', () => {
  it('no longer picks the fleece on a 24C day', () => {
    const pick = pickTodaysRecommendation([FLEECE, LINEN_SHIRT], 24);
    expect(pick?.id).toBe('linen');
  });

  it('picks the fleece on a cold day', () => {
    expect(pickTodaysRecommendation([FLEECE, LINEN_SHIRT], 8)?.id).toBe('fleece');
  });

  it('returns null when every garment contradicts the day', () => {
    expect(pickTodaysRecommendation([FLEECE], 24)).toBeNull();
  });

  it('returns null for a wardrobe with no garments in it', () => {
    const jewellery = { id: 'j', name: 'Hoops', category: 'Jewellery', status: 'owned' };
    expect(pickTodaysRecommendation([jewellery], 24)).toBeNull();
  });

  it('ignores items that are not owned', () => {
    const wishlist = { ...LINEN_SHIRT, id: 'w', status: 'wishlist' };
    expect(pickTodaysRecommendation([wishlist], 24)).toBeNull();
  });

  // THE property that failed. The calendar month must not affect the pick at
  // all — the same wardrobe at the same temperature must give the same answer
  // in September as in June.
  it('gives the same pick whatever the month', () => {
    const wardrobe = [FLEECE, LINEN_SHIRT];
    const picks = new Set();
    for (const month of [0, 3, 6, 8, 11]) {
      vi.setSystemTime(new Date(2026, month, 15));
      picks.add(pickTodaysRecommendation(wardrobe, 24)?.id);
    }
    vi.useRealTimers();
    expect(picks).toEqual(new Set(['linen']));
  });
});
```

Replace the import line at the top of the test file with:

```js
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  weatherAppropriatenessScore, pickTodaysRecommendation, weatherToSeasons,
  seasonsForTemp, pickVeto, isPickableToday,
} from './weather.js';
```

and add, directly after the imports:

```js
// pickTodaysRecommendation seeds its choice from today's date, and one test
// below drives the clock deliberately. Reset it so no other test inherits a
// frozen one.
afterEach(() => { vi.useRealTimers(); });
```

Finally, **delete** the `describe('the fleece at 24C — characterisation of the bug', …)` block added in Task 1. Its two assertions are now false by design, and both are replaced above — `currently picks the fleece` by `no longer picks the fleece on a 24C day`, and `currently scores the fleece as neutral` by the name-reading test in Task 4.

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --dir apps/studio test -- weather`

Expected: FAIL with `pickVeto is not a function`.

- [ ] **Step 3: Add the veto**

In `apps/studio/src/lib/weather.js`, directly above `weatherAppropriatenessScore`:

```js
// Which categories Today's Pick may suggest.
//
// Sportswear and Swimwear are garments and are deliberately absent: both are
// driven by an activity rather than the weather, so suggesting a swimsuit
// because it is 24C is wrong even when the temperature agrees. Shoes are absent
// pending the rain question — sandals and boots are genuinely useful picks, but
// including footwear without considering precipitation would suggest suede on a
// wet day. None of these omissions is an oversight.
const PICKABLE_CATEGORIES = new Set(['Tops', 'Bottoms', 'Dresses', 'Outerwear']);

/**
 * Why this item may not be Today's Pick, or null if it may.
 *
 * A veto, evaluated before any scoring, because a score term can be outvoted
 * and was: season contributed a flat 0.25 while weather contributed at most
 * 0.225, so an Autumn/Winter fleece beat the thermometer on a 24C day.
 *
 * Returns a reason rather than a boolean so the card's empty state can say
 * something true instead of guessing.
 *
 * @returns {'not-a-garment'|'wrong-season'|null}
 */
export function pickVeto(item, tempC) {
  if (!PICKABLE_CATEGORIES.has(item?.category)) return 'not-a-garment';
  const felt = seasonsForTemp(tempC);
  if (!felt) return null;                   // no temperature known — veto nothing
  const declared = itemSeasons(item);
  // Silence is not a declaration. Vetoing on absent data would punish an item
  // that was never scanned, which is a data gap and not a wrong garment.
  if (declared.length === 0) return null;
  return declared.some((s) => felt.includes(s)) ? null : 'wrong-season';
}

// Defined in terms of pickVeto, deliberately, so the two can never disagree
// about the same item.
export function isPickableToday(item, tempC) {
  return pickVeto(item, tempC) === null;
}
```

- [ ] **Step 4: Rewrite the picker**

In the same file, replace the whole body of `pickTodaysRecommendation` — from `const owned = live(items)` to the closing `}` — with:

```js
export function pickTodaysRecommendation(items, tempC = null) {
  // The veto runs first, and season is part of it rather than part of the
  // score. That is the fix: a score term can be outvoted, and this one was.
  const eligible = live(items)
    .filter((i) => i.status === 'owned')
    .filter((i) => isPickableToday(i, tempC));
  if (eligible.length === 0) return null;

  const scored = eligible.map((item) => {
    const days = daysSinceLastWorn(item);
    const recency = days === null ? 1 : Math.min(days / 60, 1);
    const favouriteBoost = item.favorite ? 1 : 0;
    const weatherFit = weatherAppropriatenessScore(item, tempC);
    // Weather keeps the majority share. The other two are tie-breakers among
    // pieces that already suit the day — they are not competing signals, which
    // is what the removed seasonFit term had become. Sums to 1.0, so these
    // numbers stay comparable with the old scale.
    const score = weatherFit * 0.60 + recency * 0.20 + favouriteBoost * 0.20;
    return { item, score };
  });
  scored.sort((a, b) => b.score - a.score);

  // Seed the pick by today's date so it stays stable through the day, then
  // rotates. This is the ONLY remaining use of the current date, and it must
  // not influence WHICH items are eligible — the calendar month used to decide
  // that, and disagreed with the thermometer.
  const top = scored.slice(0, Math.max(3, Math.floor(scored.length * 0.2)));
  const todayKey = new Date().toISOString().slice(0, 10);
  let h = 0; for (let i = 0; i < todayKey.length; i++) h = ((h << 5) - h + todayKey.charCodeAt(i)) | 0;
  return top[Math.abs(h) % top.length].item;
}
```

Note `favouriteBoost` is now `1` or `0` and weighted at 0.20, where it was `0.25` weighted at 0.15. Same intent, expressed as a normal 0..1 term like the others.

Update the JSDoc comment above the function — it currently says the pick is "appropriate for today's actual temperature band", which is now enforced rather than preferred:

```js
// Smart recommendation: prefers items you OWN + haven't worn recently, from
// the garments that suit today's temperature. Season appropriateness is a
// VETO applied before scoring, not a preference — see pickVeto. Returns null
// when nothing is eligible, which the caller must render as an honest empty
// state rather than falling back to a poor pick.
```

- [ ] **Step 5: Run it to verify it passes**

Run: `pnpm --dir apps/studio test -- weather`

Expected: PASS. If `gives the same pick whatever the month` fails, a calendar reference survives somewhere in the picker — search for `getMonth` in the file.

- [ ] **Step 6: Confirm the calendar is gone from the picker**

Run: `grep -n "getMonth" apps/studio/src/lib/weather.js`

Expected: no output. (`WardrobeView.jsx` still has its own `currentSeason` for the Daily Brief — that is a different feature and stays.)

- [ ] **Step 7: Run the whole suite**

Run: `pnpm --dir apps/studio test`

Expected: PASS. 290 before; expect roughly 310 after.

- [ ] **Step 8: Commit**

```bash
git add apps/studio/src/lib/weather.js apps/studio/src/lib/weather.test.js
git commit -m "fix(weather): make season a veto, and delete the calendar

seasonFit contributed a flat 0.25 to the score while weatherFit
contributed at most 0.225, so a calendar match always beat a weather
match. On 3 September at 24C the calendar says Autumn and the thermometer
says Summer, and an Autumn/Winter fleece won.

Season is now a veto evaluated before scoring - a gate cannot be
outvoted - and the picker reads the thermometer via seasonsForTemp
instead of new Date().getMonth(). The item already declared itself
unsuitable; the picker had been asking its declaration 'is it the right
month?' when the declaration answers 'what temperatures is this for?'.

Garments only, because jewellery and bags rarely declare a season and
would otherwise be most of what survives the veto on a warm day, winning
on neglect alone.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Let the scorer read the name

**Files:**
- Modify: `apps/studio/src/lib/weather.js` (`weatherAppropriatenessScore`)
- Test: `apps/studio/src/lib/weather.test.js`

The veto now handles correctness. This task repairs the keyword score, whose remaining job is *ranking* — and which is the only weather signal for an item that declares no seasons.

- [ ] **Step 1: Write the failing tests**

Append to `apps/studio/src/lib/weather.test.js`:

```js
describe('weatherAppropriatenessScore', () => {
  // The word "Fleece" is in the item's NAME. The function used to build its
  // matched text from category, subCategory and styles only, so it returned a
  // neutral 0.5 and had no opinion about a fleece on a warm day.
  it('reads the item name, not just its category and tags', () => {
    const fleece = { name: 'Ladies Country Fleece Quarter Zip', category: 'Tops', subCategory: '' };
    expect(weatherAppropriatenessScore(fleece, 24)).toBeLessThan(0.5);
  });

  it('penalises each heavy pattern on a warm day', () => {
    for (const word of ['fleece', 'sweatshirt', 'sherpa', 'shearling', 'quilted', 'padded', 'down', 'thermal', 'flannel']) {
      const item = { name: `A ${word} thing`, category: 'Tops', subCategory: '' };
      expect(weatherAppropriatenessScore(item, 24), word).toBeLessThan(0.5);
    }
  });

  it('penalises each heavy pattern harder on a hot day', () => {
    for (const word of ['fleece', 'sweatshirt', 'sherpa', 'shearling', 'quilted', 'padded', 'down', 'thermal', 'flannel']) {
      const item = { name: `A ${word} thing`, category: 'Tops', subCategory: '' };
      expect(weatherAppropriatenessScore(item, 30), word)
        .toBeLessThan(weatherAppropriatenessScore(item, 24));
    }
  });

  it('rewards each heavy pattern on a cold day', () => {
    for (const word of ['fleece', 'sweatshirt', 'sherpa', 'shearling', 'quilted', 'padded', 'down', 'thermal', 'flannel']) {
      const item = { name: `A ${word} thing`, category: 'Tops', subCategory: '' };
      expect(weatherAppropriatenessScore(item, 2), word).toBeGreaterThan(0.5);
    }
  });

  it('is neutral when the temperature is unknown', () => {
    expect(weatherAppropriatenessScore({ name: 'Fleece', category: 'Tops' }, null)).toBe(0.5);
  });

  it('stays within 0..1', () => {
    const worst = { name: 'quilted padded down thermal fleece wool cashmere', category: 'Outerwear', subCategory: 'Puffer coat' };
    expect(weatherAppropriatenessScore(worst, 35)).toBeGreaterThanOrEqual(0);
    expect(weatherAppropriatenessScore(worst, 35)).toBeLessThanOrEqual(1);
    const best = { name: 'linen sleeveless cotton camisole tank', category: 'Tops' };
    expect(weatherAppropriatenessScore(best, 35)).toBeLessThanOrEqual(1);
  });

  it('is falsy-safe', () => {
    expect(weatherAppropriatenessScore({}, 24)).toBe(0.5);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --dir apps/studio test -- weather`

Expected: FAIL. `reads the item name` gets `0.5`, not less — the function has no opinion about a fleece.

- [ ] **Step 3: Read the name, and add the missing family**

In `apps/studio/src/lib/weather.js`, inside `weatherAppropriatenessScore`, replace:

```js
  const cat = (item.category || '').toLowerCase();
  const sub = (item.subCategory || '').toLowerCase();
  const styles = (itemStyles(item) || []).map((s) => (s || '').toLowerCase());
  const text = `${cat} ${sub} ${styles.join(' ')}`;
```

with:

```js
  const cat = (item.category || '').toLowerCase();
  const sub = (item.subCategory || '').toLowerCase();
  const styles = (itemStyles(item) || []).map((s) => (s || '').toLowerCase());
  // The NAME is in here for a reason. It used to be category + subCategory +
  // styles only, and "Ladies Country Fleece Quarter Zip" carries the decisive
  // word in its name — so the function returned a neutral 0.5 and Today's Pick
  // offered it on a 24C day. Brand names occasionally collide with a pattern
  // (a "Wool & The Gang" cardigan), which costs a little ranking accuracy and
  // is worth it: the alternative is having no opinion at all about most items.
  const name = (item.name || '').toLowerCase();
  const text = `${name} ${cat} ${sub} ${styles.join(' ')}`;
```

Then replace the `HEAVY_PATTERNS` line:

```js
  const HEAVY_PATTERNS = ['coat', 'jacket', 'blazer', 'sweater', 'jumper', 'knit', 'wool', 'cashmere', 'puffer', 'parka', 'trench', 'leather jacket', 'turtleneck'];
```

with:

```js
  // The second group was missing entirely, which is why a fleece scored neutral
  // even once the name was read. All of them are cold-weather constructions.
  const HEAVY_PATTERNS = [
    'coat', 'jacket', 'blazer', 'sweater', 'jumper', 'knit', 'wool', 'cashmere',
    'puffer', 'parka', 'trench', 'leather jacket', 'turtleneck',
    'fleece', 'sweatshirt', 'sherpa', 'shearling', 'quilted', 'padded', 'down', 'thermal', 'flannel',
  ];
```

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm --dir apps/studio test -- weather`

Expected: PASS. If `penalises each heavy pattern harder on a hot day` fails for `down`, check that the hot branch subtracts more than the warm branch — the warm branch is `-0.25`, the hot branch `-0.45`.

- [ ] **Step 5: Run the whole suite**

Run: `pnpm --dir apps/studio test`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/studio/src/lib/weather.js apps/studio/src/lib/weather.test.js
git commit -m "fix(weather): read the item name, and know what a fleece is

The matched text was category + subCategory + styles, never the name -
and 'Ladies Country Fleece Quarter Zip' carries the decisive word in its
name, so the scorer returned a neutral 0.5. fleece was also absent from
HEAVY_PATTERNS entirely, along with sweatshirt, sherpa, shearling,
quilted, padded, down, thermal and flannel.

The veto handles correctness now, so this score's job is ranking - and it
is the only weather signal for an item that declares no seasons, which
is why it has to actually work.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: The card stops hedging, and says so when nothing fits

**Files:**
- Modify: `apps/studio/src/views/WardrobeView.jsx:1009-1030` (the reasons block and the `fits`/`for` branch)
- Modify: `apps/studio/src/views/WardrobeView.jsx:1008` (the `{recommendation && …}` render guard)

There is no unit test here — it is a React view needing a DOM, and none of the views in this codebase are tested. The verification is the diff plus your own eyes in the browser.

- [ ] **Step 1: Replace the hedge with a single honest phrasing**

In `apps/studio/src/views/WardrobeView.jsx`, find the reasons block inside the Today's Pick render and replace:

```js
          const reasons = [];
          const tempC = weather?.temp ?? null;
          if (tempC != null) {
            const fit = weatherAppropriatenessScore(recommendation, tempC);
            // Only show the weather note when the item genuinely passes
            // temperature appropriateness (fit >= 0.5 = neutral-to-good).
            // Below that it still surfaces as Today's Pick (no hard block at
            // the card level — the hard filter is inside pickTodaysRecommendation),
            // but we don't mislead with "fits today's 34°C" for a borderline pick.
            if (fit >= 0.5) {
              reasons.push(`fits today's ${Math.round(tempC)}°C`);
            } else {
              reasons.push(`for today's ${Math.round(tempC)}°C`);
            }
          }
```

with:

```js
          const reasons = [];
          const tempC = weather?.temp ?? null;
          if (tempC != null) {
            // No hedge. Everything reaching this card has passed pickVeto, so
            // its declared seasons genuinely include what today feels like.
            //
            // This used to say "fits" above a 0.5 score and "for" below it —
            // softening the claim rather than changing the pick, and the
            // distinction was invisible to anyone reading the card. That is how
            // a fleece came to be recommended on a 24°C day with the code's own
            // wording admitting it did not fit.
            reasons.push(`fits today's ${Math.round(tempC)}°C`);
          }
```

- [ ] **Step 2: Fix the import**

`weatherAppropriatenessScore` was used in the view only by the hedge Step 1 removed, and `pickVeto` is needed by Step 3. Replace line 7 of `apps/studio/src/views/WardrobeView.jsx`:

```js
import { fetchTodaysWeather, pickTodaysRecommendation, weatherToSeasons, weatherAppropriatenessScore } from "../lib/weather.js";
```

with:

```js
import { fetchTodaysWeather, pickTodaysRecommendation, weatherToSeasons, pickVeto } from "../lib/weather.js";
```

Also update the now-stale comment at `WardrobeView.jsx:392`, which says "weatherAppropriatenessScore inside pickTodaysRecommendation handles null gracefully (neutral 0.5)". Replace that sentence with: `pickTodaysRecommendation vetoes on season before scoring and returns null when nothing is eligible; a null tempC vetoes nothing.`

- [ ] **Step 3: Add the empty state**

`pickTodaysRecommendation` now returns `null` when nothing is eligible, so the card must say so rather than silently disappearing. There are two distinct reasons for nothing being eligible, and telling them apart is the whole point of `pickVeto` returning a reason rather than a boolean — a collection with no clothes in it needs a different sentence from one whose clothes are tagged for other seasons.

Immediately **after** the closing `)}` of the `{recommendation && (() => { … })()}` block, add:

```jsx
        {/* Nothing eligible is a real answer, not a gap. Every cold-weather
            piece is vetoed on a warm day, so this will fire for a wardrobe
            that skews Autumn/Winter — which is honest, and the reason Task 6
            measures the season distribution before calling the veto right.
            Rendered only when there IS a wardrobe: a brand-new account should
            see the empty-collection state, not a weather note. */}
        {!recommendation && items.length > 0 && weather?.temp != null && (() => {
          // Which of the two empty states this is. pickVeto returns a reason
          // rather than a boolean precisely so this sentence can be true: a
          // collection of jewellery and bags has nothing to suggest for a
          // different reason than one full of winter coats in July.
          const ownsAGarment = items.some(
            (i) => i.status === 'owned' && pickVeto(i, weather.temp) !== 'not-a-garment',
          );
          return (
            <div className="text-left w-full bg-stone-100 text-stone-600 rounded-2xl lg:rounded-3xl p-4 sm:p-5">
              <p className="text-[10px] tracking-[0.25em] uppercase text-stone-400 mb-1.5 flex items-center gap-2">
                <span className="brass-rule" aria-hidden="true"></span> Today's pick
              </p>
              <p className="font-display text-base sm:text-lg text-stone-800 leading-tight">
                {ownsAGarment
                  ? `Nothing in your collection suits ${Math.round(weather.temp)}°C.`
                  : 'No clothes in your collection yet.'}
              </p>
              <p className="text-[11px] text-stone-500 mt-1">
                {ownsAGarment
                  ? 'Your pieces are tagged for other seasons — add a warm-weather piece, or check the season tags on what you own.'
                  : "Today's pick suggests something to wear, so it needs a top, a dress, trousers or a coat."}
              </p>
            </div>
          );
        })()}
```

- [ ] **Step 4: Verify the build and the suite**

Run: `pnpm --dir apps/studio build && pnpm --dir apps/studio test`

Expected: both PASS. A green build proves the module parses and nothing more — Vite bundles unresolved identifiers happily and they fail at runtime.

- [ ] **Step 5: Read the diff for names that resolve**

Run: `git diff apps/studio/src/views/WardrobeView.jsx`

Confirm `items`, `weather` and `recommendation` are all in scope where the new block sits, and that the new element is a sibling of the `{recommendation && …}` block rather than nested inside it.

- [ ] **Step 6: Commit**

```bash
git add apps/studio/src/views/WardrobeView.jsx
git commit -m "fix(wardrobe): say nothing fits, instead of hedging the wording

The card said 'fits today's 24C' above a 0.5 score and 'for today's 24C'
below it - softening the claim rather than changing the pick, with a
distinction invisible to anyone reading it. Everything now reaching the
card has passed the veto, so it always says fits, and means it.

When the veto leaves nothing eligible the card says so rather than
disappearing. That will fire for a wardrobe tagged mostly Autumn/Winter
on a warm day, which is the honest version of what the fleece hid.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Measure the season distribution

**Files:** none — this is a measurement, and its result decides whether Task 2's bands need moving.

The spec names this as the one risk worth measuring: if most of the 160-item wardrobe is tagged Autumn/Winter, the empty state fires most days in a British September and the feature reads as broken rather than careful.

- [ ] **Step 1: Deploy the branch for review**

Build and run the dev server from the worktree root:

```bash
pnpm --dir apps/studio dev
```

Open `http://localhost:5173`. Do **not** use a Firebase preview channel — App Check validates against a reCAPTCHA domain allowlist that preview subdomains are not on, so every Firestore read is denied and the app reports it as "this account doesn't have access". `localhost` is allowlisted.

- [ ] **Step 2: Count the distribution**

In the browser console on the Wardrobe page, with the app loaded:

```js
// The app holds items in React state, so read them from Firestore directly.
const { getFirestore, collection, getDocs } = await import('firebase/firestore');
const { getAuth } = await import('firebase/auth');
const uid = getAuth().currentUser.uid;
const snap = await getDocs(collection(getFirestore(), 'users', uid, 'items'));
const seasonsOf = (d) => Array.isArray(d.seasons) ? d.seasons : (d.season ? [d.season] : []);
const GARMENTS = new Set(['Tops', 'Bottoms', 'Dresses', 'Outerwear']);
const tally = { total: 0, untagged: 0, summerOK: 0, winterOnly: 0 };
snap.forEach((doc) => {
  const d = doc.data();
  if (d.status !== 'owned' || !GARMENTS.has(d.category)) return;
  tally.total += 1;
  const s = seasonsOf(d);
  if (s.length === 0) tally.untagged += 1;
  else if (s.includes('Summer')) tally.summerOK += 1;
  else tally.winterOnly += 1;
});
console.table(tally);
```

`summerOK + untagged` is how many garments are eligible on a 24°C day. Report all four numbers verbatim — `total`, `untagged`, `summerOK`, `winterOnly` — rather than summarising them, because the decision in Step 3 turns on the size of `untagged` as much as on the eligible count. A large `untagged` means the veto is passing items on silence rather than on agreement, which is a data-quality answer rather than a bands answer.

- [ ] **Step 3: Decide, and report before changing anything**

- **More than ~20 eligible:** the veto is fine. Nothing to change.
- **Under ~10 eligible:** the empty state will dominate a British September. The lever is `seasonsForTemp`'s bands, **not** the veto — currently `< 22 → ['Spring','Autumn']`, so 22°C already reads as Summer-only. Raising that boundary (e.g. `< 25`) admits Spring/Autumn pieces on a warm day without weakening the rule that a Winter-only piece is never suggested at 24°C.
- **Zero eligible:** stop and report. Either the season tags are wrong across the wardrobe, which is a data problem with its own fix, or the bands are badly mismatched to the climate.

Report the counts and your recommendation rather than adjusting the bands unilaterally — the right boundary is a judgement about a British autumn, not a number derivable from the data.

---

## Notes for whoever executes this

- **Tasks 1–4 are pure and fully tested.** Task 5 is a view with no test coverage; Task 6 is a measurement. The risk is concentrated in the last two.
- **Do not widen the keyword lists further** to make a case pass. If an item is wrongly picked or wrongly vetoed, the question is whether its `seasons` declaration is right — the keywords are for ranking, not correctness.
- **Do not merge or deploy without being asked.** Open the PR and stop.
