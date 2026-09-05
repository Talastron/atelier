# Goals and Budget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let someone tell Atelier what they are trying to do and roughly what they spend, so the wardrobe audit can rank gaps against a stated goal instead of listing them.

**Architecture:** Two new fields on `measurements`, beside the style profile that already works this way. Goals come from a fixed exported list; budget is *inferred* from prices already on the wardrobe and shown back as a correctable placeholder. `summariseStyleProfile()` gains two clauses, which carries both to every prompt that already receives the style profile — and `analyzeWardrobeGapsWithGemini`, which receives nothing about the person today, is given it.

**Tech Stack:** React 18, Vite 6, Tailwind 4, vitest 4, Firebase AI Logic (Gemini).

**Spec:** `apps/studio/docs/superpowers/specs/2026-09-04-goals-and-budget-design.md`

**Worktree:** `C:\Users\SibylleMoller-Sherwo\Documents\GitHub\atelier-wt-flatlay`, branch `goals-budget-build`. Run every command from that directory. It is a git worktree: do **not** `cd` to the main checkout, and do **not** use `git stash` — the stack is shared with other live sessions.

PowerShell 5.1 does **not** accept `&&`. Run commands separately.

Test: `pnpm --dir apps/studio test` (**349 passing** at the start of this plan). Build: `pnpm --dir apps/studio build`.

---

## Read this before Task 1

**Follow the style-profile pattern exactly; do not invent a parallel one.** Undertone, silhouette, formality, palette and principles are already fields on `measurements`, already edited by pill rows in `StyleProfileCard`, and already summarised into one sentence appended to every prompt. Goals and budget are two more of the same. If you find yourself adding a context, a hook, or a new storage location, stop — the answer is a key on `measurements`.

**The pure logic gets tests; the views do not.** No view in this codebase is tested — they need a DOM and none is set up. `inferBudget` and `summariseStyleProfile` are pure and get real coverage. A test asserting a button renders proves only that JSX was typed twice.

**Do not build a quiz.** `taxonomy.js:22` has promised one since before this work; the spec deliberately declines. The fields live in Profile → Style.

---

## File structure

| File | Responsibility | Change |
|---|---|---|
| `src/lib/taxonomy.js` | The fixed goal vocabulary | Add `STYLE_GOALS` |
| `src/lib/taxonomy.test.js` | **New.** Guards the goal list's shape | Create |
| `src/lib/budget.js` | **New.** Infer typical/high spend from prices | Create |
| `src/lib/budget.test.js` | **New.** Its tests | Create |
| `src/lib/items.js:95-107` | `summariseStyleProfile` | Two clauses |
| `src/lib/items.test.js` | Its tests | Add cases |
| `src/views/ProfileView.jsx:208` | `StyleProfileCard` | Goals picker + budget fields |
| `src/lib/ai.js:390` | `analyzeWardrobeGapsWithGemini` | Accept and use the profile |
| `src/lib/ai.js:840` | `scorePurchaseWithGemini` | Budget context in the prompt |
| `src/views/InsightsView.jsx:189` | The gap analyser's only caller | Pass `measurements` |
| `src/App.jsx:9123` | `ONBOARD_STEPS` | One step, key bumped |

---

### Task 1: The goal vocabulary

**Files:**
- Modify: `apps/studio/src/lib/taxonomy.js` (after `STYLE_PRINCIPLES`, which ends at line 34)

- [ ] **Step 1: Add the list**

Immediately after the `STYLE_PRINCIPLES` array in `apps/studio/src/lib/taxonomy.js`, add:

```js
// What the wearer is trying to DO. The app knows what you own, what you wear,
// what suits you and the weather; without this it can tell you that you own
// fourteen tops and two pairs of trousers, and not whether that is a problem.
//
// A fixed list rather than free text, because this is the vocabulary the gap
// analysis ranks against: "Buy less, wear more" and "Build a capsule I actually
// wear" have to produce genuinely different advice from the same wardrobe, and
// a model cannot rank a gap against a sentence it has never seen.
//
// The fifth deliberately names no cause. An earlier draft read "Rebuild after
// a change — size, job, life", which makes the app comment on the reader's
// body in a picker they see every time they open Profile. The analysis only
// needs to know THAT a wardrobe stopped suiting someone — that is what changes
// the advice, to structural gaps rather than incremental ones.
export const STYLE_GOALS = [
  'Build a capsule I actually wear',
  'Dress better for work',
  'Buy less, wear more',
  'Find my own style rather than trends',
  'Rebuild my wardrobe for who I am now',
  'Dress for something specific coming up',
];
```

- [ ] **Step 2: Guard the list's shape**

There is no `taxonomy.test.js` yet. Create `apps/studio/src/lib/taxonomy.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { STYLE_GOALS } from './taxonomy.js';

describe('STYLE_GOALS', () => {
  it('is a short list of distinct, non-empty goals', () => {
    // The picker stores the string verbatim and the summariser lowercases it
    // into a prompt, so a duplicate or a stray blank would round-trip into
    // something the gap analysis cannot rank.
    expect(STYLE_GOALS.length).toBeGreaterThan(2);
    expect(STYLE_GOALS.length).toBeLessThanOrEqual(8);
    expect(new Set(STYLE_GOALS).size).toBe(STYLE_GOALS.length);
    for (const g of STYLE_GOALS) {
      expect(typeof g).toBe('string');
      expect(g.trim()).toBe(g);
      expect(g.length).toBeGreaterThan(0);
      expect(g.length).toBeLessThan(45); // it renders as a pill, on mobile
    }
  });

  it('names no cause for the rebuild goal', () => {
    // An earlier draft read "Rebuild after a change — size, job, life".
    // Naming a cause makes the app comment on the reader's body or
    // circumstances in a picker they see every time they open Profile.
    const joined = STYLE_GOALS.join(' ').toLowerCase();
    expect(joined).not.toContain('size');
    expect(joined).not.toContain('weight');
  });
});
```

- [ ] **Step 3: Run it, and confirm the build**

```bash
pnpm --dir apps/studio test
```

Expected: green, **351 tests** (349 + 2).

```bash
pnpm --dir apps/studio build
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/studio/src/lib/taxonomy.js apps/studio/src/lib/taxonomy.test.js
```

```bash
git commit -m "feat(goals): the fixed vocabulary of what someone is trying to do

Six goals, the wording confirmed in review. A fixed list rather than free
text because this is what the gap analysis ranks against - a model cannot
rank a gap against a sentence it has never seen.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: `inferBudget`

**Files:**
- Create: `apps/studio/src/lib/budget.js`
- Create: `apps/studio/src/lib/budget.test.js`

- [ ] **Step 1: Write the failing tests**

Create `apps/studio/src/lib/budget.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { inferBudget, MIN_PRICED_ITEMS } from './budget.js';

const owned = (price) => ({ status: 'owned', price });

describe('inferBudget', () => {
  it('reports the median and the 90th percentile', () => {
    const items = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(owned);
    const b = inferBudget(items);
    expect(b.typical).toBe(60);
    expect(b.high).toBe(100);
    expect(b.sampleSize).toBe(10);
  });

  it('is not dragged by one extraordinary purchase', () => {
    // The real wardrobe this was designed against holds a £3,500 Cartier
    // watch among items at £49. A mean would report a typical spend nobody
    // recognises; the median must not move.
    const items = [40, 45, 50, 55, 60, 65, 70, 75, 80, 3500].map(owned);
    const b = inferBudget(items);
    const mean = (40+45+50+55+60+65+70+75+80+3500) / 10;
    expect(mean).toBeGreaterThan(390);      // what we are avoiding
    expect(b.typical).toBeLessThan(100);    // what we report
  });

  it('ignores items with no usable price rather than counting them as zero', () => {
    const items = [
      ...[10, 20, 30, 40, 50, 60, 70, 80].map(owned),
      { status: 'owned', price: null },
      { status: 'owned', price: '' },
      { status: 'owned', price: 'ask' },
      { status: 'owned', price: 0 },
    ];
    expect(inferBudget(items).sampleSize).toBe(8);
  });

  it('counts what you have spent, not what you might', () => {
    const items = [
      ...[10, 20, 30, 40, 50, 60, 70, 80].map(owned),
      { status: 'wishlist', price: 5000 },
      { status: 'owned', price: 5000, deletedAt: '2026-01-01' },
    ];
    expect(inferBudget(items).sampleSize).toBe(8);
  });

  it('says nothing rather than guessing from too few prices', () => {
    const items = [10, 20, 30, 40].map(owned);
    expect(items.length).toBeLessThan(MIN_PRICED_ITEMS);
    expect(inferBudget(items)).toBeNull();
  });

  it('survives rubbish input', () => {
    expect(inferBudget(null)).toBeNull();
    expect(inferBudget(undefined)).toBeNull();
    expect(inferBudget([])).toBeNull();
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

```bash
pnpm --dir apps/studio test
```

Expected: `Cannot find module './budget.js'`.

- [ ] **Step 3: Implement**

Create `apps/studio/src/lib/budget.js`:

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
    .filter((i) => i && i.status === 'owned' && !i.deletedAt)
    .map((i) => Number(i.price))
    .filter((p) => Number.isFinite(p) && p > 0)   // a missing price is not £0
    .sort((a, b) => a - b);
  if (prices.length < MIN_PRICED_ITEMS) return null;
  const at = (q) => prices[Math.min(prices.length - 1, Math.floor(q * prices.length))];
  return { typical: at(0.5), high: at(0.9), sampleSize: prices.length };
}
```

- [ ] **Step 4: Run them and watch them pass**

```bash
pnpm --dir apps/studio test
```

Expected: all green, **357 tests** (351 + 6).

- [ ] **Step 5: Commit**

```bash
git add apps/studio/src/lib/budget.js apps/studio/src/lib/budget.test.js
```

```bash
git commit -m "feat(budget): infer typical and top-end spend from the wardrobe

Median and p90, not mean and max: this wardrobe holds a £3,500 watch
among items at £49, so a mean reports a spend nobody recognises and a max
reports a ceiling describing one purchase.

Returns null below eight priced items rather than guessing.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Carry goals and budget into every prompt

**Files:**
- Modify: `apps/studio/src/lib/items.js:95-107` (`summariseStyleProfile`)
- Modify: `apps/studio/src/lib/items.test.js`

This is the change that does the work. Everything already receiving `styleProfile` — outfit generation, item fit, the Concierge — inherits goals and budget with no signature change anywhere.

- [ ] **Step 1: Write the failing tests**

Add to `apps/studio/src/lib/items.test.js`:

```js
describe('summariseStyleProfile — goals and budget', () => {
  it('says nothing at all for an untouched profile', () => {
    expect(summariseStyleProfile({})).toBe('');
    expect(summariseStyleProfile(null)).toBe('');
  });

  it('states the goals when only goals are set', () => {
    const s = summariseStyleProfile({ styleGoals: ['Buy less, wear more'] });
    expect(s).toContain('working toward: buy less, wear more');
  });

  it('joins two goals', () => {
    const s = summariseStyleProfile({
      styleGoals: ['Dress better for work', 'Buy less, wear more'],
    });
    expect(s).toContain('dress better for work; buy less, wear more');
  });

  it('states the budget when only budget is set', () => {
    const s = summariseStyleProfile({ budgetTypical: 80, budgetHigh: 400 });
    expect(s).toContain('typically spends around £80 a piece, £400 is a big buy');
  });

  it('carries both alongside the existing profile', () => {
    const s = summariseStyleProfile({
      styleUndertone: 'Cool',
      styleGoals: ['Build a capsule I actually wear'],
      budgetTypical: 80,
      budgetHigh: 400,
    });
    expect(s).toContain('undertone is cool');
    expect(s).toContain('working toward');
    expect(s).toContain('£80');
    expect(s.startsWith('Style profile:')).toBe(true);
    expect(s.endsWith('.')).toBe(true);
  });

  it('ignores an empty goals array and a half-set budget', () => {
    expect(summariseStyleProfile({ styleGoals: [] })).toBe('');
    // One number alone cannot say "typical, and this is a lot".
    expect(summariseStyleProfile({ budgetTypical: 80 })).toBe('');
    expect(summariseStyleProfile({ budgetHigh: 400 })).toBe('');
  });
});
```

Check the top of `items.test.js` already imports `summariseStyleProfile`; if not, add it to the existing import from `./items.js`.

- [ ] **Step 2: Run them and watch them fail**

```bash
pnpm --dir apps/studio test
```

Expected: the new cases fail; the existing suite still passes.

- [ ] **Step 3: Implement**

In `apps/studio/src/lib/items.js`, inside `summariseStyleProfile`, after the `stylePrinciples` block and before `if (bits.length === 0)`:

```js
  if (Array.isArray(measurements.styleGoals) && measurements.styleGoals.length) {
    // Goals steer WHAT the app surfaces, not how it sounds: the gap analysis
    // ranks a work-appropriate hole above an evening one when work is stated.
    bits.push(`working toward: ${measurements.styleGoals.join('; ').toLowerCase()}`);
  }
  const typical = Number(measurements.budgetTypical);
  const high = Number(measurements.budgetHigh);
  if (Number.isFinite(typical) && typical > 0 && Number.isFinite(high) && high > 0) {
    // Both or neither — one number alone cannot say "this is typical, and
    // this is a lot", which is the comparison the purchase scorer needs.
    bits.push(`typically spends around £${typical} a piece, £${high} is a big buy`);
  }
```

- [ ] **Step 4: Run them and watch them pass**

```bash
pnpm --dir apps/studio test
```

Expected: all green, **363 tests** (357 + 6).

- [ ] **Step 5: Commit**

```bash
git add apps/studio/src/lib/items.js apps/studio/src/lib/items.test.js
```

```bash
git commit -m "feat(goals): summarise goals and budget into the style profile

Two clauses on summariseStyleProfile, so everything already receiving the
style profile - outfit generation, item fit, the Concierge - gets goals
and budget with no signature change anywhere.

Budget needs both numbers or neither: one alone cannot say 'this is
typical, and this is a lot', which is the comparison that makes it useful.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: The fields in Profile → Style

**Files:**
- Modify: `apps/studio/src/views/ProfileView.jsx` — `StyleProfileCard`, which starts at line 208

- [ ] **Step 1: Import what the card needs**

`ProfileView.jsx` already imports several names from `../lib/taxonomy.js`. Add `STYLE_GOALS` to that existing import. Then add:

```js
import { inferBudget } from "../lib/budget.js";
```

- [ ] **Step 2: Accept the wardrobe so budget can be inferred**

`StyleProfileCard` currently reads:

```js
function StyleProfileCard({ measurements, saveMeasurements }) {
```

Change to:

```js
function StyleProfileCard({ measurements, saveMeasurements, items = [] }) {
```

Then find where `<StyleProfileCard` is rendered inside `ProfileView` and pass `items={items}` — `ProfileView` already receives `items` as a prop, so nothing new is threaded from above.

- [ ] **Step 3: Add the goal toggle and the inferred budget**

Inside `StyleProfileCard`, beside the existing `togglePrinciple`:

```js
  const toggleGoal = (g) => {
    const cur = Array.isArray(m.styleGoals) ? m.styleGoals : [];
    // Capped at two. A list of six goals all selected ranks nothing.
    set('styleGoals', cur.includes(g) ? cur.filter((x) => x !== g) : [...cur, g].slice(0, 2));
  };
  const inferred = inferBudget(items);
```

- [ ] **Step 4: Render the goals row**

After the closing `</div>` of the existing "Style principles" block and before the card's final `</div>`, add:

```jsx
      <div className="mt-6">
        <p className="text-xs tracking-label uppercase text-stone-500 font-bold mb-2">
          What you're working toward <span className="font-normal normal-case tracking-normal text-stone-400 ml-1">(pick up to 2)</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {STYLE_GOALS.map((g) => {
            const active = Array.isArray(m.styleGoals) && m.styleGoals.includes(g);
            return (
              <button key={g} type="button" onClick={() => toggleGoal(g)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  active ? 'bg-stone-900 border-stone-900 text-white' : 'bg-white border-stone-200 text-stone-700 hover:border-stone-500'
                }`}>
                {g}
              </button>
            );
          })}
        </div>
      </div>
```

- [ ] **Step 5: Render the budget row**

Immediately after the goals block:

```jsx
      <div className="mt-6">
        <p className="text-xs tracking-label uppercase text-stone-500 font-bold mb-2">
          What you spend <span className="font-normal normal-case tracking-normal text-stone-400 ml-1">(optional)</span>
        </p>
        {/* Inferred from prices already on the wardrobe and shown as the
            placeholder, so this is a correction rather than a blank to fill.
            Below eight priced items inferBudget returns null and we say so
            rather than printing a number derived from four prices. */}
        <p className="text-sm text-stone-500 leading-relaxed mb-3">
          {inferred
            ? `From your wardrobe, you usually spend around £${inferred.typical}, and £${inferred.high} is a big buy. Correct it here if that's not right.`
            : 'Once a few more pieces have prices, Atelier will work this out from your wardrobe. You can also set it yourself.'}
        </p>
        <div className="flex flex-wrap gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-stone-500">Typical piece</span>
            <input
              type="number" inputMode="numeric" min="0"
              value={m.budgetTypical ?? ''}
              placeholder={inferred ? String(inferred.typical) : '—'}
              onChange={(e) => set('budgetTypical', e.target.value === '' ? '' : Number(e.target.value))}
              className="w-32 px-3 py-2 rounded-xl bg-white border border-stone-200 focus:border-stone-900 outline-none text-sm"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-stone-500">A big buy</span>
            <input
              type="number" inputMode="numeric" min="0"
              value={m.budgetHigh ?? ''}
              placeholder={inferred ? String(inferred.high) : '—'}
              onChange={(e) => set('budgetHigh', e.target.value === '' ? '' : Number(e.target.value))}
              className="w-32 px-3 py-2 rounded-xl bg-white border border-stone-200 focus:border-stone-900 outline-none text-sm"
            />
          </label>
        </div>
      </div>
```

- [ ] **Step 6: Widen the "Active in prompts" badge**

The card's `populated` flag currently ignores the new fields, so setting only a goal would still read "Not set yet". Change:

```js
  const populated = !!(m.styleUndertone || m.styleSilhouette || m.styleFormality || m.stylePalette);
```

to:

```js
  const populated = !!(
    m.styleUndertone || m.styleSilhouette || m.styleFormality || m.stylePalette
    || (Array.isArray(m.styleGoals) && m.styleGoals.length)
    || (m.budgetTypical && m.budgetHigh)
  );
```

- [ ] **Step 7: Build and test**

```bash
pnpm --dir apps/studio build
```

```bash
pnpm --dir apps/studio test
```

Expected: clean, **363 passing** (this task adds no tests — it is a view).

- [ ] **Step 8: Commit**

```bash
git add apps/studio/src/views/ProfileView.jsx
```

```bash
git commit -m "feat(profile): capture goals and budget beside the style profile

Two rows in Profile -> Style, following the pattern the style principles
already use. Goals cap at two, because six goals all selected rank
nothing.

Budget is inferred from prices already on the wardrobe and shown as the
field's placeholder, so it is a correction rather than a blank to fill -
and correct from the first day rather than after a guess.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Give the wardrobe audit the person

**Files:**
- Modify: `apps/studio/src/lib/ai.js:390` (`analyzeWardrobeGapsWithGemini`)
- Modify: `apps/studio/src/views/InsightsView.jsx:189` (its only caller)

This is the change the whole design exists for. The gap analysis currently receives items and inspirations and knows *nothing whatever* about the person — not even the style profile that has existed for months.

- [ ] **Step 1: Widen the signature**

In `apps/studio/src/lib/ai.js`, change:

```js
export async function analyzeWardrobeGapsWithGemini({ items, inspirations = [] }) {
```

to:

```js
export async function analyzeWardrobeGapsWithGemini({ items, inspirations = [], styleProfile = '' }) {
```

- [ ] **Step 2: Put it in the prompt**

Find the template literal that builds this function's prompt. Immediately before the line that asks for the analysis, insert:

```js
${styleProfile ? `\n${styleProfile}\n\nRank the gaps against what they are working toward: a gap that serves a stated goal outranks one that does not. Do NOT hide gaps outside the stated goals — an unstated goal should still surface a genuine hole — but say which gap to close first, and why, in the words of their goal. If a typical spend is given, keep suggestions near it and flag anything that is a big buy for this person.\n` : ''}
```

The prompt is a template literal, so this interpolates directly. When no profile is set the string is empty and the prompt is byte-identical to today's.

- [ ] **Step 3: Pass it from the caller**

In `apps/studio/src/views/InsightsView.jsx` at line 189, change:

```js
const data = await analyzeWardrobeGapsWithGemini({ items, inspirations });
```

to:

```js
const data = await analyzeWardrobeGapsWithGemini({
  items,
  inspirations,
  styleProfile: summariseStyleProfile(measurements),
});
```

`InsightsView` must now receive `measurements` and import `summariseStyleProfile` from `../lib/items.js`. Check whether both are already available:

```bash
grep -n "summariseStyleProfile\|measurements" apps/studio/src/views/InsightsView.jsx
```

If `measurements` is not a prop of `InsightsView`, add it, and pass it at the `<InsightsView` render site in `App.jsx` — `App.jsx` already holds `measurements` and passes it to `ProfileView` and `TodayView`, so the value exists and only needs threading.

- [ ] **Step 4: Budget context for the purchase scorer**

`scorePurchaseWithGemini` at `apps/studio/src/lib/ai.js:840` already receives `measurements`, so it needs no new parameter. Find where it builds its `body` line from `measurements` (around line 853) and add, after it:

```js
  const budgetLine = (Number(m.budgetTypical) > 0 && Number(m.budgetHigh) > 0)
    ? `They typically spend around £${Number(m.budgetTypical)} a piece, and £${Number(m.budgetHigh)} is a big buy for them. Say plainly if this piece is well above that.`
    : '';
```

Then interpolate `${budgetLine}` into the prompt beside the body line. When unset it is empty and the prompt is unchanged.

- [ ] **Step 5: Build and test**

```bash
pnpm --dir apps/studio build
```

```bash
pnpm --dir apps/studio test
```

Expected: clean, **363 passing**.

- [ ] **Step 6: Confirm the no-profile path is untouched**

```bash
grep -n "styleProfile = ''" apps/studio/src/lib/ai.js
```

Expected: one hit — the default. This matters: a user who sets nothing must get exactly the audit they get today, not a subtly different one.

- [ ] **Step 7: Commit**

```bash
git add apps/studio/src/lib/ai.js apps/studio/src/views/InsightsView.jsx apps/studio/src/App.jsx
```

```bash
git commit -m "feat(insights): the wardrobe audit finally knows who it is advising

analyzeWardrobeGapsWithGemini received items and inspirations and nothing
whatever about the person - not even the style profile that has existed
for months. It now receives it, and is told to RANK gaps by the stated
goals rather than filter to them: an unstated goal should still surface a
genuine hole.

scorePurchaseWithGemini needed no new parameter - it already receives
measurements - so it just gains the budget comparison in its prompt.

With nothing set, both prompts are byte-identical to today's.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: One step on the tour

**Files:**
- Modify: `apps/studio/src/App.jsx:9123` (`ONBOARD_STEPS`) and the `STORAGE_KEY` just below it

- [ ] **Step 1: Add the step**

In `ONBOARD_STEPS`, insert before the final "A button with two minds" entry:

```js
  { title: 'Tell it what you want', body: 'In Profile → Style, say what you are working toward and roughly what you spend. It is two taps, and it changes what the wardrobe audit tells you: gaps get ranked against your goal instead of just listed.', cta: 'Open Profile', target: 'profile' },
```

- [ ] **Step 2: Bump the storage key so existing users see it**

Immediately below `ONBOARD_STEPS`, in `OnboardingTour`, change:

```js
  const STORAGE_KEY = 'atelier-onboard-done-v2';
```

to:

```js
  // Bumped to v3 for the goals step. This re-shows the whole tour once to
  // everyone who has already seen it — accepted deliberately: the fields are
  // the only thing that makes the wardrobe audit personal, and the tour is
  // their only discovery mechanism.
  const STORAGE_KEY = 'atelier-onboard-done-v3';
```

- [ ] **Step 3: Confirm the target is a real tab**

```bash
grep -n "target: 'profile'\|activeTab === 'profile'" apps/studio/src/App.jsx
```

Expected: at least one hit showing `profile` is a tab the tour's `onJumpTo` can reach. **If `profile` is not a valid target, use the value the Profile tab actually uses** — read the other steps' `target` values and the tab switcher rather than guessing.

- [ ] **Step 4: Build and test**

```bash
pnpm --dir apps/studio build
```

```bash
pnpm --dir apps/studio test
```

Expected: clean, **363 passing**.

- [ ] **Step 5: Commit**

```bash
git add apps/studio/src/App.jsx
```

```bash
git commit -m "feat(onboarding): point the tour at goals and budget

Six steps now. The storage key bumps to v3, which re-shows the tour once
to everyone who has seen it - accepted deliberately, because the fields
are the only thing that makes the wardrobe audit personal and the tour is
their only discovery mechanism.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Sibylle looks at it

**Files:** none — her review, and the only verification that matters for whether the advice actually improves.

- [ ] **Step 1: Serve the branch from the worktree**

Run from `atelier-wt-flatlay`, and check the path Vite prints on startup — the port does not tell you which tree is being served.

```bash
pnpm --dir apps/studio dev
```

- [ ] **Step 2: Set the fields**

Profile → Style. Pick one or two goals. Check the budget line reads back numbers that look like her wardrobe — this wardrobe has ~164 owned pieces so `inferBudget` will have plenty to work with, and the £3,500 watch is the case the median exists to survive.

- [ ] **Step 3: The test that matters**

Insights → "Analyse my wardrobe", **before and after** setting a goal. The audit should visibly change: the same gaps, ranked differently, with the reason given in the words of the stated goal. If the two audits read the same, the prompt change is not landing and that is the thing to report.

- [ ] **Step 4: Check the honest-nothing path**

Clear both fields. The audit should return to exactly what it said before this work — no leftover phrasing about goals nobody set.

- [ ] **Step 5: Report before tuning**

Say what the audit said, not what to change. If goals are ranking weakly the lever is the prompt's ranking instruction; if the budget reads wrong the lever is `inferBudget`'s percentiles. They are different fixes and the wording of the complaint tells us which.

---

## Notes for whoever executes this

- **Follow the style-profile pattern.** Every question this plan does not answer is answered by looking at how `stylePrinciples` does it.
- **Do not add view tests.** `inferBudget` and `summariseStyleProfile` carry the coverage; no view in this codebase is tested.
- **With nothing set, every prompt must be byte-identical to today's.** Both new clauses are empty strings when unset, and Task 5 Step 6 checks it.
- **Do not merge or deploy.** This branch is stacked on `brief-view-toggle`, which is stacked on `designed-dialogs`. Commit and stop.
- **Report counts, not adjectives.** Every verification step here produces a number.
