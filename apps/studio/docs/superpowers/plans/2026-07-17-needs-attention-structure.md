# "Needs attention" Structure — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the Today "Needs attention" card so its contents are grouped by theme with the groups ranked by urgency, each row shows the actual piece, and severity is legible — without adding any new state.

**Architecture:** Extract the pure grouping/ordering into a new `lib/digest.js` (no React, no Firebase — mirroring `lib/outfit.js`) so it can be unit-tested; `DailyDigest` keeps deriving its cards inline and renders the grouped result. The two plan cards move out to `WeekStrip`, which already knows a day has a plan but never names the outfit. Rows swap their icon for the piece's photo, keeping the icon as the no-photo fallback.

**Tech Stack:** React 19 (Vite), Vitest, Tailwind v4.

**Spec:** `apps/studio/docs/superpowers/specs/2026-07-17-needs-attention-structure-design.md`

**Branch:** work continues on `feat/needs-attention-structure` (already cut from main; spec already committed).

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `apps/studio/src/lib/digest.js` | The ranked theme model + pure grouping of digest cards | **Create** |
| `apps/studio/src/lib/digest.test.js` | Unit tests for the above | **Create** |
| `apps/studio/src/views/TodayView.jsx` | `DailyDigest` — derive cards, group them, render with thumbnails | Modify |
| `apps/studio/src/components/WeekStrip.jsx` | Gains `outfits` + names today's/tomorrow's plan | Modify |

No new dependencies. No Firestore changes. No persisted state.

---

### Task 1: The pure theme model and grouping

**Files:**
- Create: `apps/studio/src/lib/digest.js`
- Create: `apps/studio/src/lib/digest.test.js`

- [ ] **Step 1: Write the failing tests**

Create `apps/studio/src/lib/digest.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { groupDigestCards, DIGEST_THEMES } from './digest.js';

const card = (kind) => ({ kind });
const labels = (groups) => groups.map((g) => g.label);
const kinds = (groups) => groups.map((g) => g.cards.map((c) => c.kind));

describe('groupDigestCards', () => {
  it('returns [] when there are no cards', () => {
    expect(groupDigestCards([])).toEqual([]);
    expect(groupDigestCards(undefined)).toEqual([]);
  });

  // The reported bug: an overdue lent piece rendered BELOW three care nudges
  // because cards were concatenated in source order. Its theme must rank first
  // however late the card arrives.
  it('ranks On loan first even when the overdue card comes last', () => {
    const groups = groupDigestCards([card('care'), card('care'), card('care'), card('overdue')]);
    expect(labels(groups)).toEqual(['On loan', 'Care']);
  });

  it('ranks every theme by urgency regardless of input order', () => {
    const groups = groupDigestCards([
      card('inspo-unanalysed'), card('price-drop'), card('stale-fav'), card('care'), card('overdue'),
    ]);
    expect(labels(groups)).toEqual(['On loan', 'Care', 'Wardrobe', 'Wishlist', 'Inspiration']);
  });

  it('omits themes with no cards', () => {
    const groups = groupDigestCards([card('price-drop')]);
    expect(labels(groups)).toEqual(['Wishlist']);
  });

  it('groups multiple cards of the same kind together', () => {
    const groups = groupDigestCards([card('care'), card('price-drop'), card('care')]);
    expect(labels(groups)).toEqual(['Care', 'Wishlist']);
    expect(kinds(groups)).toEqual([['care', 'care'], ['price-drop']]);
  });

  it('preserves input order within a theme', () => {
    const a = { kind: 'care', id: 'a' };
    const b = { kind: 'care', id: 'b' };
    expect(groupDigestCards([a, b])[0].cards.map((c) => c.id)).toEqual(['a', 'b']);
  });

  // An unknown kind must never crash Today.
  it('drops cards whose kind matches no theme', () => {
    const groups = groupDigestCards([card('care'), card('not-a-real-kind'), null]);
    expect(labels(groups)).toEqual(['Care']);
    expect(kinds(groups)).toEqual([['care']]);
  });

  it('every kind in DIGEST_THEMES is reachable and unique', () => {
    const all = DIGEST_THEMES.flatMap((t) => t.kinds);
    expect(new Set(all).size).toBe(all.length);
    for (const kind of all) {
      expect(groupDigestCards([card(kind)])).toHaveLength(1);
    }
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd apps/studio && pnpm test digest`
Expected: FAIL — cannot resolve `./digest.js` (the module doesn't exist yet).

- [ ] **Step 3: Implement `lib/digest.js`**

Create `apps/studio/src/lib/digest.js`:

```js
// The Today "Needs attention" card reports on several unrelated concerns. It
// used to concatenate them into one flat list in source order, so a lent piece
// three days overdue rendered BELOW three "8 wears since care" nudges — the
// most urgent thing pushed down by the least urgent.
//
// Themes give the card the structure it lacked, and the RANK is what fixes the
// bug: a theme's position is fixed by its urgency, so an urgent card can never
// be buried by arriving late. Pure — no React, no Firebase — so the ordering is
// unit-testable, unlike anything left inside the component.
export const DIGEST_THEMES = [
  { id: 'loan',        label: 'On loan',     kinds: ['overdue'] },
  { id: 'care',        label: 'Care',        kinds: ['care'] },
  { id: 'wardrobe',    label: 'Wardrobe',    kinds: ['stale-fav'] },
  { id: 'wishlist',    label: 'Wishlist',    kinds: ['price-drop'] },
  { id: 'inspiration', label: 'Inspiration', kinds: ['inspo-unanalysed'] },
];

// Groups a flat card list into ranked, non-empty themes:
//   [{ id, label, cards }]
// Input order is preserved WITHIN a theme (the caller's per-kind caps and
// severity order already decide that). Cards matching no theme are dropped
// rather than thrown on, so an unknown or future kind can never crash Today.
export function groupDigestCards(cards) {
  const list = Array.isArray(cards) ? cards.filter(Boolean) : [];
  return DIGEST_THEMES
    .map(({ id, label, kinds }) => ({
      id,
      label,
      cards: list.filter((c) => kinds.includes(c.kind)),
    }))
    .filter((group) => group.cards.length > 0);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd apps/studio && pnpm test digest`
Expected: PASS — 8 tests.

- [ ] **Step 5: Run the full suite**

Run: `cd apps/studio && pnpm test`
Expected: all pass (92 before this task + 8 new = 100; the exact prior count may have shifted — the point is zero failures).

- [ ] **Step 6: Commit**

```bash
git add apps/studio/src/lib/digest.js apps/studio/src/lib/digest.test.js
git commit -m "feat(today): rank the digest's themes by urgency, pure and tested"
```

---

### Task 2: Move the plan cards to the week strip

**Files:**
- Modify: `apps/studio/src/components/WeekStrip.jsx`
- Modify: `apps/studio/src/views/TodayView.jsx` (the `<WeekStrip …>` call site)

No tests: `WeekStrip` is a React component and this project has no component-test harness — consistent with every other view.

- [ ] **Step 1: Give WeekStrip the outfits it needs**

In `apps/studio/src/components/WeekStrip.jsx`, find this exact existing block:

```js
// events: array of { startISO, allDay, ... } for the coming week (may be []).
// schedules: { 'YYYY-MM-DD': { outfitId } }
export default function WeekStrip({ events = [], schedules = {}, onSelectDay }) {
  const days = nextSevenDays();
  const today = days[0];
```

Replace it with:

```js
// events: array of { startISO, allDay, ... } for the coming week (may be []).
// schedules: { 'YYYY-MM-DD': { outfitId, eventName } }
// outfits: the live outfit list, so a planned day can NAME its look. The strip
// has always known a day has a plan, but only rendered it as an anonymous dash;
// "Needs attention" carried the name, which is a schedule rather than something
// needing attention. The name belongs here, beside the day it happens on.
export default function WeekStrip({ events = [], schedules = {}, outfits = [], onSelectDay, onOpenOutfit }) {
  const days = nextSevenDays();
  const today = days[0];
  const tomorrow = days[1];
```

- [ ] **Step 2: Resolve today's and tomorrow's planned outfit**

In the same file, find this exact existing block:

```js
  const first = new Date(days[0] + 'T00:00:00');
  const last = new Date(days[6] + 'T00:00:00');
  const range = `${first.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${last.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`;
```

Insert immediately after it:

```js
  // Resolve defensively: a schedule can outlive the outfit it points at.
  const planFor = (iso, label) => {
    const outfitId = schedules[iso]?.outfitId;
    if (!outfitId) return null;
    const outfit = outfits.find((o) => o.id === outfitId);
    if (!outfit) return null;
    const eventName = schedules[iso]?.eventName;
    return { outfit, label: eventName ? `${label} · ${eventName}` : label };
  };
  const plans = [planFor(today, 'Today'), planFor(tomorrow, 'Tomorrow')].filter(Boolean);
```

- [ ] **Step 3: Render the plan line beneath the strip**

In the same file, find this exact existing block (the end of the day-button map and the component's closing markup):

```js
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

Replace it with:

```js
            </button>
          );
        })}
      </div>
      {plans.length > 0 && (
        <ul className="mt-4 space-y-1 border-t border-stone-200/60 pt-3">
          {plans.map(({ outfit, label }) => (
            <li key={label}>
              <button
                type="button"
                onClick={() => onOpenOutfit?.(outfit.id)}
                className="w-full flex items-center gap-2 text-left py-1 px-2 -mx-2 rounded-lg hover:bg-stone-100 transition-colors"
              >
                <span className="text-[10px] tracking-[0.2em] uppercase text-stone-400 shrink-0">{label}</span>
                <span className="text-sm text-stone-900 truncate">{outfit.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Pass the new props at the call site**

In `apps/studio/src/views/TodayView.jsx`, find this exact existing line:

```js
        <WeekStrip events={weekEvents} schedules={schedules} onSelectDay={onSelectCalendarDay} />
```

Replace it with:

```js
        <WeekStrip events={weekEvents} schedules={schedules} outfits={outfits} onSelectDay={onSelectCalendarDay} onOpenOutfit={onOpenBrief} />
```

(`outfits` and `onOpenBrief` are already props of the enclosing `TodayView` — `onOpenBrief` is what `DailyDigest` currently uses to open an outfit, passed as its `onOpenOutfit`.)

- [ ] **Step 5: Run the build**

Run: `cd apps/studio && pnpm build`
Expected: `✓ built in` with no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/studio/src/components/WeekStrip.jsx apps/studio/src/views/TodayView.jsx
git commit -m "feat(today): name the planned look on the week strip"
```

---

### Task 3: Drop the plan cards from the digest

**Files:**
- Modify: `apps/studio/src/views/TodayView.jsx` (`DailyDigest`)

- [ ] **Step 1: Narrow the component's props**

In `apps/studio/src/views/TodayView.jsx`, find this exact existing line:

```js
function DailyDigest({ items, outfits, schedules, inspirations = [], onOpenItem, onOpenOutfit, onOpenInspiration, onOpenInspirationTab }) {
```

Replace it with (the card kinds that needed `outfits`/`onOpenOutfit` now live on the week strip, so the interface narrows to what this card actually reports on):

```js
function DailyDigest({ items, schedules, inspirations = [], onOpenItem, onOpenInspiration, onOpenInspirationTab }) {
```

- [ ] **Step 2: Remove the plan derivation**

Find this exact existing block:

```js
  // Tomorrow's planned outfit (today's, if not yet logged)
  const todaySched = schedules?.[todayKey];
  const tomorrowSched = schedules?.[tomorrow];
  const todayOutfit = todaySched?.outfitId ? outfits.find((o) => o.id === todaySched.outfitId) : null;
  const tomorrowOutfit = tomorrowSched?.outfitId ? outfits.find((o) => o.id === tomorrowSched.outfitId) : null;

```

Delete it entirely (the week strip now names the planned look).

- [ ] **Step 3: Remove the plan cards from the card list**

Find this exact existing block:

```js
  const cards = [];
  if (todayOutfit) cards.push({ kind: 'planned-today', outfit: todayOutfit, label: todaySched?.eventName ? `Today · ${todaySched.eventName}` : "Today's plan", eventName: todaySched?.eventName });
  if (tomorrowOutfit) cards.push({ kind: 'planned-tomorrow', outfit: tomorrowOutfit, label: tomorrowSched?.eventName ? `Tomorrow · ${tomorrowSched.eventName}` : 'Planned tomorrow', eventName: tomorrowSched?.eventName });
  for (const { i, r } of careDue) cards.push({ kind: 'care', item: i, reminder: r });
```

Replace it with:

```js
  const cards = [];
  for (const { i, r } of careDue) cards.push({ kind: 'care', item: i, reminder: r });
```

- [ ] **Step 4: Remove the now-dead plan row renderer**

Find this exact existing block inside the render map:

```js
          if (c.kind === 'planned-today' || c.kind === 'planned-tomorrow') {
            return <Row key={i} icon={<Calendar size={16} strokeWidth={1.5} />} accent="bg-brass-100 text-brass-700"
              title={c.outfit.name} sub={c.label} onClick={() => onOpenOutfit?.(c.outfit.id)} />;
          }
```

Delete it entirely.

- [ ] **Step 5: Update the call site**

Find this exact existing block:

```js
        <DailyDigest
          items={items}
          outfits={outfits}
          schedules={schedules}
          inspirations={inspirations}
          onOpenItem={onItemClick}
          onOpenOutfit={onOpenBrief}
          onOpenInspiration={onOpenInspiration}
          onOpenInspirationTab={onOpenInspirationTab}
        />
```

Replace it with:

```js
        <DailyDigest
          items={items}
          schedules={schedules}
          inspirations={inspirations}
          onOpenItem={onItemClick}
          onOpenInspiration={onOpenInspiration}
          onOpenInspirationTab={onOpenInspirationTab}
        />
```

- [ ] **Step 6: Leave the lucide `Calendar` import alone**

Deleting the plan row removes one of two `<Calendar>` usages, but the other lives at `TodayView.jsx:706` (outside `DailyDigest`), so the icon is still needed. **Do not** remove `Calendar` from the lucide-react import at line 2.

Confirm with: `cd apps/studio && grep -c "<Calendar" src/views/TodayView.jsx`
Expected: `1` (was 2). If it prints `0`, something else was deleted by mistake — stop and report.

- [ ] **Step 7: Run the build**

Run: `cd apps/studio && pnpm build`
Expected: `✓ built in` with no errors. (A stale reference to `outfits`, `onOpenOutfit`, `todayOutfit` or `tomorrowOutfit` inside `DailyDigest` would surface here.)

- [ ] **Step 8: Commit**

```bash
git add apps/studio/src/views/TodayView.jsx
git commit -m "refactor(today): the digest reports attention, not the schedule"
```

---

### Task 4: Render themed groups with thumbnails

**Files:**
- Modify: `apps/studio/src/views/TodayView.jsx` (`DailyDigest` render + imports)

- [ ] **Step 1: Import the grouping helper and the image check**

In `apps/studio/src/views/TodayView.jsx`, find this exact existing line:

```js
import ItemTileImage from "../components/ItemTileImage.jsx";
```

Insert immediately after it:

```js
import { groupDigestCards } from "../lib/digest.js";
```

Then find this exact existing line (`TodayView.jsx:4`):

```js
import { summariseStyleProfile, todayISO, itemCareReminder, daysSinceLastWorn } from "../lib/items.js";
```

Replace it with:

```js
import { summariseStyleProfile, todayISO, itemCareReminder, daysSinceLastWorn, itemImages } from "../lib/items.js";
```

(`itemImages` returns `[]` for a piece with no photo — that is the check the row's fallback uses. The local `imgOf` at `TodayView.jsx:429` does the same job but is component-scoped; do NOT reuse or duplicate it.)

- [ ] **Step 2: Rewrite the digest's render**

Find this exact existing block — the whole render from the wrapper `div` to the component's close:

```js
  if (cards.length === 0) return null;

  return (
    <div className="rounded-3xl border border-stone-200/70 bg-white p-6 sm:p-7 smooth-shadow">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-lg sm:text-xl text-stone-900">Needs attention</h3>
        <span className="text-[10px] tracking-[0.2em] uppercase text-stone-400">{cards.length} item{cards.length === 1 ? '' : 's'}</span>
      </div>
      <ul className="space-y-1">
```

Replace it with:

```js
  if (cards.length === 0) return null;

  // Ranked, non-empty themes. The rank is what stops an urgent card being
  // buried by arriving late — see lib/digest.js.
  const groups = groupDigestCards(cards);
  // A single header over a single group labels nothing, so drop it.
  const showHeaders = groups.length > 1;

  return (
    <div className="rounded-3xl border border-stone-200/70 bg-white p-6 sm:p-7 smooth-shadow">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-lg sm:text-xl text-stone-900">Needs attention</h3>
        <span className="text-[10px] tracking-[0.2em] uppercase text-stone-400">{cards.length} item{cards.length === 1 ? '' : 's'}</span>
      </div>
      <div className="space-y-4">
```

Then find this exact existing block — the end of the map and the close:

```js
          return null;
        })}
      </ul>
    </div>
  );
}
```

Replace it with:

```js
          return null;
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Wrap the rows in their groups and swap icon for photo**

Find this exact existing block (the opening of the map and the `Row` definition):

```js
        {cards.map((c, i) => {
          const Row = ({ icon, accent, title, sub, onClick }) => (
            <li>
              <button onClick={onClick}
                className="w-full flex items-center gap-3 text-left py-2 px-2 -mx-2 rounded-xl hover:bg-stone-100 transition-colors">
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${accent}`}>{icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-stone-900 truncate">{title}</p>
                  <p className="text-[11px] text-stone-500 truncate">{sub}</p>
                </div>
                <ChevronRight size={14} strokeWidth={1.5} className="text-stone-300 shrink-0" />
              </button>
            </li>
          );
```

Replace it with (the group header carries the KIND, so the icon is no longer the row's job — the photo takes that slot, and the icon becomes the fallback for a piece with no photo):

```js
        {groups.map((group) => (
        <div key={group.id}>
          {showHeaders && (
            <p className="mb-1 text-[10px] tracking-[0.2em] uppercase text-stone-400">{group.label}</p>
          )}
          <ul className="space-y-1">
          {group.cards.map((c, i) => {
          // `item` is the piece a row is about, when it has one. ItemTileImage
          // returns null for a piece with no photo, which would leave a blank
          // slot — so the icon stays as the fallback rather than being deleted.
          const Row = ({ icon, accent, title, sub, onClick, item }) => (
            <li>
              <button onClick={onClick}
                className="w-full flex items-center gap-3 text-left py-2 px-2 -mx-2 rounded-xl hover:bg-stone-100 transition-colors">
                {item && itemImages(item).length > 0 ? (
                  <span className="w-8 h-8 rounded-lg overflow-hidden shrink-0 bg-stone-100">
                    <ItemTileImage item={item} alt={item.name} />
                  </span>
                ) : (
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${accent}`}>{icon}</span>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-stone-900 truncate">{title}</p>
                  <p className="text-[11px] text-stone-500 truncate">{sub}</p>
                </div>
                <ChevronRight size={14} strokeWidth={1.5} className="text-stone-300 shrink-0" />
              </button>
            </li>
          );
```

- [ ] **Step 4: Close the new group wrapper**

Find this exact existing block (the end of the map, as left by Task 4 Step 2):

```js
          return null;
        })}
      </div>
    </div>
  );
}
```

Replace it with:

```js
          return null;
          })}
          </ul>
        </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Pass the item to each row, and enrich the care sub-line**

Each `Row` now takes an `item` prop. Find and update each remaining row renderer in the map.

Find:

```js
          if (c.kind === 'care') {
            return <Row key={i} icon={<Sparkles size={16} strokeWidth={1.5} />} accent="bg-brass-100 text-brass-700"
              title={c.item.name} sub={`${c.reminder.material} care · ${c.reminder.wearsSince} wears`} onClick={() => onOpenItem?.(c.item.id)} />;
          }
```

Replace with (`itemCareReminder` already returns `everyN`, so the row can say WHY it is flagged, not just that it is):

```js
          if (c.kind === 'care') {
            return <Row key={i} item={c.item} icon={<Sparkles size={16} strokeWidth={1.5} />} accent="bg-brass-100 text-brass-700"
              title={c.item.name} sub={`${c.reminder.material} · ${c.reminder.wearsSince} wears since care · usually every ${c.reminder.everyN}`} onClick={() => onOpenItem?.(c.item.id)} />;
          }
```

Find:

```js
          if (c.kind === 'stale-fav') {
            const d = daysSinceLastWorn(c.item);
            return <Row key={i} icon={<Star size={16} strokeWidth={1.5} />} accent="bg-stone-100 text-stone-700"
              title={c.item.name} sub={d === null ? 'Favourite · never worn' : `Favourite · ${d} days since last wear`} onClick={() => onOpenItem?.(c.item.id)} />;
          }
```

Replace with:

```js
          if (c.kind === 'stale-fav') {
            const d = daysSinceLastWorn(c.item);
            return <Row key={i} item={c.item} icon={<Star size={16} strokeWidth={1.5} />} accent="bg-stone-100 text-stone-700"
              title={c.item.name} sub={d === null ? 'Favourite · never worn' : `Favourite · ${d} days since last wear`} onClick={() => onOpenItem?.(c.item.id)} />;
          }
```

Find (note the emerald accent — see Task 5):

```js
          if (c.kind === 'price-drop') {
            const h = c.item.priceHistory;
            const drop = Math.round((1 - h[h.length - 1].price / h[h.length - 2].price) * 100);
            return <Row key={i} icon={<TrendingDown size={16} strokeWidth={1.5} />} accent="bg-emerald-100 text-emerald-800"
              title={c.item.name} sub={`Price dropped ${drop}% · now £${h[h.length - 1].price}`} onClick={() => onOpenItem?.(c.item.id)} />;
          }
```

Replace with:

```js
          if (c.kind === 'price-drop') {
            const h = c.item.priceHistory;
            const drop = Math.round((1 - h[h.length - 1].price / h[h.length - 2].price) * 100);
            return <Row key={i} item={c.item} icon={<TrendingDown size={16} strokeWidth={1.5} />} accent="bg-brass-100 text-brass-700"
              title={c.item.name} sub={`Price dropped ${drop}% · now £${h[h.length - 1].price}`} onClick={() => onOpenItem?.(c.item.id)} />;
          }
```

Find:

```js
          if (c.kind === 'overdue') {
            const daysOver = Math.floor((new Date(todayKey) - new Date(c.item.lentReturnBy)) / 86_400_000);
            return <Row key={i} icon={<AlertCircle size={16} strokeWidth={1.5} />} accent="bg-red-100 text-red-700"
              title={c.item.name} sub={`Lent to ${c.item.lentTo} · ${daysOver} day${daysOver === 1 ? '' : 's'} overdue`} onClick={() => onOpenItem?.(c.item.id)} />;
          }
```

Replace with:

```js
          if (c.kind === 'overdue') {
            const daysOver = Math.floor((new Date(todayKey) - new Date(c.item.lentReturnBy)) / 86_400_000);
            return <Row key={i} item={c.item} icon={<AlertCircle size={16} strokeWidth={1.5} />} accent="bg-claret-50 text-claret-700"
              title={c.item.name} sub={`Lent to ${c.item.lentTo} · ${daysOver} day${daysOver === 1 ? '' : 's'} overdue`} onClick={() => onOpenItem?.(c.item.id)} />;
          }
```

The `inspo-unanalysed` row is NOT given an `item` — it is about a board, not a piece, so it keeps its `Bookmark` icon via the fallback. Leave it exactly as it is.

- [ ] **Step 6: Run the build**

Run: `cd apps/studio && pnpm build`
Expected: `✓ built in` with no errors. (An unbalanced JSX tag from the group wrapper would surface here.)

- [ ] **Step 7: Run the full suite**

Run: `cd apps/studio && pnpm test`
Expected: all pass, zero new failures.

- [ ] **Step 8: Commit**

```bash
git add apps/studio/src/views/TodayView.jsx
git commit -m "feat(today): group the digest by theme and lead each row with the piece"
```

---

### Task 5: Verify in the running app, then open the PR

**Files:** none (verification + git/GitHub operations only)

- [ ] **Step 1: Confirm the palette is on-brand**

Run: `cd apps/studio && grep -n "bg-red-100\|bg-emerald-100" src/views/TodayView.jsx`
Expected: no hits inside `DailyDigest`. (`index.css` introduced `--color-claret-*` specifically to replace saturated web-red so warnings stay in the brass/stone palette; Insights already uses `text-claret-700`. Other emerald usages elsewhere in `TodayView.jsx` belong to a different component and are out of scope — do not touch them.)

- [ ] **Step 2: Verify in the running app**

Run: `cd apps/studio && pnpm dev`, sign in, and open Today:

1. With both an overdue lent piece and care-due pieces present, confirm **On loan renders first**, above Care — this is the reported bug.
2. Confirm the overdue row reads claret (a restrained wine), not a shouty iOS red.
3. Confirm rows lead with the actual piece's photo; a piece with no photo still shows its icon rather than a blank gap.
4. Confirm a care row reads e.g. `Linen · 8 wears since care · usually every 5`.
5. With only ONE theme present, confirm no group header renders.
6. Confirm today's planned outfit is now NAMED under the week strip, is tappable, and no longer appears in "Needs attention".
7. With nothing to report, confirm the card disappears entirely and the week strip grows to full width (the existing flex behaviour).

- [ ] **Step 3: Push the branch**

```bash
git push -u origin feat/needs-attention-structure
```

- [ ] **Step 4: Open the PR**

```bash
gh pr create --title "Today: give \"Needs attention\" structure" --body "$(cat <<'EOF'
## Summary
- "Needs attention" concatenated seven unrelated card kinds into one flat list in source order, so a lent piece three days overdue rendered BELOW three "8 wears since care" nudges — the most urgent thing pushed down by the least urgent. Every kind also rendered at identical visual weight.
- Plans (today's / tomorrow's outfit) are a schedule, not attention: they move to the week strip, which already knew a day had a plan but only drew an anonymous dash. It now names the look.
- The five remaining kinds group into themes ranked by urgency — On loan, Care, Wardrobe, Wishlist, Inspiration — so an urgent card can never be buried by arriving late. Empty themes are omitted; a lone theme drops its header.
- Because the header now carries the KIND, each row's icon slot is freed for the piece's own photo (the icon stays as the fallback for a piece with no photo). Care rows gain their threshold, from data `itemCareReminder` already returned.
- Palette: overdue moves off `bg-red-100/text-red-700` to claret — the ramp `index.css` introduced precisely to "replace saturated web-red … so the warning stays in the brass/stone luxury palette instead of shouting like an iOS notification", a fix that reached Insights and missed this card. Price drops move off emerald, which isn't in the palette at all.

Presentation only — no new state, no mutations, no Firestore change. Inline actions and dismiss/snooze are Phases 2 and 3.

Spec: `apps/studio/docs/superpowers/specs/2026-07-17-needs-attention-structure-design.md`
Plan: `apps/studio/docs/superpowers/plans/2026-07-17-needs-attention-structure.md`

## Test plan
- [x] `pnpm test` — 8 new unit tests for the pure grouping, including one that pins the reported bug directly (an `overdue` card supplied AFTER three `care` cards still ranks first). Zero regressions.
- [x] `pnpm build` — clean
- [ ] Founder to verify live: On loan ranks first and reads claret; rows lead with the piece's photo; a single-theme day shows no header; today's plan is named on the week strip and gone from the digest

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR URL printed. **Stop here and report the PR URL — do not merge or deploy.**

---

## Self-review

**Spec coverage:** Plans move to `WeekStrip` (§1) → Task 2 + Task 3. Theme groups ranked by urgency, empty themes omitted, lone header dropped (§2) → Task 1 + Task 4. Thumbnails with the icon demoted to fallback (§3) → Task 4. Richer care context from `everyN` (§4) → Task 4 Step 5. Palette + weight (§5) → Task 4 Step 5 + Task 5 Step 1. Pure, testable grouping (Architecture) → Task 1. Non-goals (no actions, no dismiss, no Insights change, no new state) → nothing in Tasks 1–5 touches them.

**Placeholder scan:** No TBD/TODO. Every code step carries exact before/after, verified against the file rather than approximated — including the two that would otherwise have been guesses: the lucide `Calendar` import must STAY (a second `<Calendar>` lives at `TodayView.jsx:706`, outside the digest — removing it would break the build), and the `lib/items.js` import line is quoted exactly as it reads at `TodayView.jsx:4`.

**Type consistency:** `groupDigestCards` returns `[{ id, label, cards }]` — the same shape consumed in Task 4 (`group.id` as the React key, `group.label` in the header, `group.cards` mapped). `DIGEST_THEMES` kinds (`overdue`, `care`, `stale-fav`, `price-drop`, `inspo-unanalysed`) match the `kind` strings `DailyDigest` pushes, with `planned-today`/`planned-tomorrow` deliberately absent since Task 3 removes them. `Row`'s new `item` prop is optional throughout — `inspo-unanalysed` omits it by design and falls back to its icon.
