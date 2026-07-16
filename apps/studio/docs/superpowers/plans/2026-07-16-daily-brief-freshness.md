# Daily Brief Freshness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the Daily Brief recommending the same clothing base every day, by feeding the last 3 days' bases back into the Gemini compose as a soft anti-repetition nudge.

**Architecture:** Add a rolling 3-day history of each brief's *clothing base* (Dress, or Top+Bottom) to `dailyBrief.js` — localStorage as the fast cache, `users/{uid}/state/dailyBriefHistory` in Firestore as the cross-device source of truth, mirroring the dual-store pattern the brief itself already uses. `TodayView` loads that history, resolves the ids to items, and passes them to `generateOutfitWithGemini`, which emits a "build on a different base" block. A second, always-on prompt line reserves Occasion/eveningwear pieces for days whose calendar events call for them. Both are preferences — they never override the existing non-negotiable weather / complete-the-look rules.

**Tech Stack:** React 19 (Vite), Firebase AI Logic SDK (Gemini), Firestore, Vitest.

**Spec:** `apps/studio/docs/superpowers/specs/2026-07-16-daily-brief-freshness-design.md`

**Branch:** work continues on `feat/daily-brief-freshness` (already cut, already merged up to date with `main`).

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `apps/studio/src/dailyBrief.js` | Per-day brief cache + (new) rolling base history, local + Firestore | Modify — add history helpers alongside the existing ones |
| `apps/studio/src/dailyBrief.test.js` | Unit tests for the pure/localStorage helpers | Modify — add a `describe` block |
| `apps/studio/src/lib/ai.js` | Gemini prompt assembly | Modify — new `recentLooks` param + two prompt blocks |
| `apps/studio/src/views/TodayView.jsx` | Loads history, wires compose, records the base after | Modify — `DailyBriefCard` + the `onGenerateOutfit` prop |

No new files. No Firestore rules change: `firestore.rules:63` already grants the owner read/write on `users/{uid}/{document=**}`, which covers `users/{uid}/state/dailyBriefHistory`.

---

### Task 1: Rolling base-history helpers (local)

**Files:**
- Modify: `apps/studio/src/dailyBrief.js` (append after the existing `nextSlotIndex`, before the `--- Cross-device persistence (Firestore) ---` comment block)
- Modify: `apps/studio/src/dailyBrief.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `apps/studio/src/dailyBrief.test.js` (leave the existing import line and `beforeEach` in place; add `mergeRecent`, `readRecentBases`, `appendRecentBase` to the existing import from `./dailyBrief.js`):

```js
import { describe, it, expect, beforeEach } from 'vitest';
import {
  markComposing, clearComposing, isComposingRecent,
  mergeRecent, readRecentBases, appendRecentBase,
} from './dailyBrief.js';
```

Then add this block at the end of the file:

```js
describe('daily-brief freshness history (recent clothing bases)', () => {
  const e = (dateKey, ...baseIds) => ({ dateKey, baseIds });

  it('mergeRecent orders newest-first', () => {
    const out = mergeRecent([e('2026-07-14', 'a'), e('2026-07-16', 'c'), e('2026-07-15', 'b')]);
    expect(out.map((x) => x.dateKey)).toEqual(['2026-07-16', '2026-07-15', '2026-07-14']);
  });

  it('mergeRecent caps at 3 days', () => {
    const out = mergeRecent([
      e('2026-07-16', 'd'), e('2026-07-15', 'c'), e('2026-07-14', 'b'), e('2026-07-13', 'a'),
    ]);
    expect(out).toHaveLength(3);
    expect(out.map((x) => x.dateKey)).toEqual(['2026-07-16', '2026-07-15', '2026-07-14']);
  });

  it('mergeRecent keeps one entry per day, earlier argument wins the tie', () => {
    const out = mergeRecent([e('2026-07-16', 'new')], [e('2026-07-16', 'old')]);
    expect(out).toHaveLength(1);
    expect(out[0].baseIds).toEqual(['new']);
  });

  it('mergeRecent drops malformed entries', () => {
    const out = mergeRecent([null, { dateKey: '2026-07-16' }, { baseIds: ['x'] }, e('2026-07-15', 'ok')]);
    expect(out).toEqual([e('2026-07-15', 'ok')]);
  });

  it('readRecentBases returns [] when nothing stored', () => {
    expect(readRecentBases('u-none')).toEqual([]);
  });

  it('readRecentBases returns [] on unparseable stored data', () => {
    localStorage.setItem('atelier.dailyBrief.recent.u1', '{not json');
    expect(readRecentBases('u1')).toEqual([]);
  });

  it('appendRecentBase stores todays base and reads it back', () => {
    appendRecentBase('u1', ['top1', 'bottom1'], '2026-07-16');
    expect(readRecentBases('u1')).toEqual([e('2026-07-16', 'top1', 'bottom1')]);
  });

  it('appendRecentBase prepends newer days and caps the window at 3', () => {
    appendRecentBase('u1', ['a'], '2026-07-13');
    appendRecentBase('u1', ['b'], '2026-07-14');
    appendRecentBase('u1', ['c'], '2026-07-15');
    appendRecentBase('u1', ['d'], '2026-07-16');
    expect(readRecentBases('u1').map((x) => x.dateKey)).toEqual(['2026-07-16', '2026-07-15', '2026-07-14']);
  });

  it('appendRecentBase replaces the entry for the same day (re-roll), not duplicates it', () => {
    appendRecentBase('u1', ['first'], '2026-07-16');
    appendRecentBase('u1', ['second'], '2026-07-16');
    const out = readRecentBases('u1');
    expect(out).toHaveLength(1);
    expect(out[0].baseIds).toEqual(['second']);
  });

  it('scopes history by uid', () => {
    appendRecentBase('u1', ['a'], '2026-07-16');
    expect(readRecentBases('u2')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd apps/studio && pnpm test dailyBrief`
Expected: FAIL — `mergeRecent is not a function` (and similar), since `dailyBrief.js` doesn't export them yet. The 5 pre-existing "composing marker" tests still pass.

- [ ] **Step 3: Implement the helpers**

In `apps/studio/src/dailyBrief.js`, find this exact existing block:

```js
// Used by "Compose another" — bumps the slot so the cached version doesn't
// short-circuit the next render.
export function nextSlotIndex(uid) {
  const existing = readDailyBrief(uid);
  return (existing?.slotIndex ?? 0) + 1;
}
```

Insert immediately after it:

```js
// --- Freshness history (recent clothing bases) ---------------------------
// The daily compose otherwise sends near-identical inputs every day (same
// wardrobe, same intent, same style profile) and the model deterministically
// re-picks the same base, so the brief reads as "the same outfit again".
// We keep a short rolling record of the CLOTHING BASE (a Dress, or a Top +
// Bottom) of recent briefs and feed it back into the prompt as an
// anti-repetition nudge. Only bases are tracked — shoes, bags and jewellery
// are free to repeat, and are what naturally vary anyway.
const RECENT_PREFIX = 'atelier.dailyBrief.recent';
export const RECENT_DAYS = 3;
function recentKey(uid) { return `${RECENT_PREFIX}.${uid || 'anon'}`; }

// Pure. Newest-first, at most one entry per dateKey, capped at RECENT_DAYS.
// Array.prototype.sort is stable, so for two entries sharing a dateKey the one
// from the EARLIER argument wins — callers rely on this to let a freshly
// composed base replace the stored one for the same day, and to let the
// Firestore copy win over the local one. Malformed entries are dropped so a
// half-written or hand-edited record can never crash a compose.
export function mergeRecent(...lists) {
  const seen = new Set();
  return lists
    .flat()
    .filter((entry) => entry && typeof entry.dateKey === 'string' && Array.isArray(entry.baseIds))
    .sort((a, b) => (a.dateKey < b.dateKey ? 1 : a.dateKey > b.dateKey ? -1 : 0))
    .filter((entry) => {
      if (seen.has(entry.dateKey)) return false;
      seen.add(entry.dateKey);
      return true;
    })
    .slice(0, RECENT_DAYS);
}

export function readRecentBases(uid) {
  try {
    const raw = localStorage.getItem(recentKey(uid));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? mergeRecent(parsed) : [];
  } catch {
    return [];
  }
}

// `dateKey` is injectable so the rolling window is unit-testable without
// mocking the clock (same rationale as `now` on markComposing above).
// Returns the new list so callers can push it straight to Firestore.
export function appendRecentBase(uid, baseIds, dateKey = todayKey()) {
  const next = mergeRecent([{ dateKey, baseIds: [...(baseIds || [])] }], readRecentBases(uid));
  try { localStorage.setItem(recentKey(uid), JSON.stringify(next)); } catch { /* swallow */ }
  return next;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd apps/studio && pnpm test dailyBrief`
Expected: PASS — the 10 new tests plus the 5 pre-existing ones.

- [ ] **Step 5: Run the full suite for regressions**

Run: `cd apps/studio && pnpm test`
Expected: all pass (57 before this task + 10 new = 67; the exact prior count may have shifted — the point is zero failures).

- [ ] **Step 6: Commit**

```bash
git add apps/studio/src/dailyBrief.js apps/studio/src/dailyBrief.test.js
git commit -m "feat(daily-brief): rolling 3-day history of recent clothing bases"
```

---

### Task 2: Cross-device sync for the history (Firestore)

**Files:**
- Modify: `apps/studio/src/dailyBrief.js` (append after `writeRemoteDailyBrief`)

No tests: the existing `readRemoteDailyBrief` / `writeRemoteDailyBrief` have none either — there is no Firestore test harness in this project, and these are thin best-effort wrappers. The pure merge logic they lean on is already covered by Task 1.

- [ ] **Step 1: Implement the remote helpers**

In `apps/studio/src/dailyBrief.js`, find this exact existing function (the end of the Firestore section):

```js
export async function writeRemoteDailyBrief(uid, brief) {
  if (!uid || !brief) return;
  try {
    const { db } = await import('./firebase.js');
    const { doc, setDoc } = await import('firebase/firestore');
    await setDoc(doc(db, 'users', uid, 'state', 'dailyBrief'), {
      ...brief,
      dateKey: todayKey(),
      savedAt: Date.now(),
    });
  } catch {
    // Non-fatal: the local cache still works; we just miss cross-device sync.
  }
}
```

Insert immediately after it:

```js
// The freshness history is shared too, so the nudge is consistent no matter
// which device composes the day's look. Same best-effort contract as the brief
// helpers above: on failure we fall back to the local-only history rather than
// blocking a compose. Covered by firestore.rules' users/{uid}/{document=**}.
export async function readRemoteRecentBases(uid) {
  if (!uid) return [];
  try {
    const { db } = await import('./firebase.js');
    const { doc, getDoc } = await import('firebase/firestore');
    const snap = await getDoc(doc(db, 'users', uid, 'state', 'dailyBriefHistory'));
    if (!snap.exists()) return [];
    return mergeRecent(snap.data()?.recent ?? []);
  } catch {
    return []; // offline / permission — the local history still nudges this device
  }
}

export async function writeRemoteRecentBases(uid, list) {
  if (!uid || !Array.isArray(list)) return;
  try {
    const { db } = await import('./firebase.js');
    const { doc, setDoc } = await import('firebase/firestore');
    await setDoc(doc(db, 'users', uid, 'state', 'dailyBriefHistory'), {
      recent: list,
      savedAt: Date.now(),
    });
  } catch {
    // Non-fatal: this device's local history still works.
  }
}
```

- [ ] **Step 2: Run the build to catch syntax errors**

Run: `cd apps/studio && pnpm build`
Expected: `✓ built in` with no errors.

- [ ] **Step 3: Run the full suite**

Run: `cd apps/studio && pnpm test`
Expected: all pass, zero new failures.

- [ ] **Step 4: Commit**

```bash
git add apps/studio/src/dailyBrief.js
git commit -m "feat(daily-brief): sync freshness history across devices"
```

---

### Task 3: Prompt — freshness nudge + everyday-appropriateness guard

**Files:**
- Modify: `apps/studio/src/lib/ai.js:41` (signature)
- Modify: `apps/studio/src/lib/ai.js:65-70` (insert the freshness block after `eventsHint`)
- Modify: `apps/studio/src/lib/ai.js:91` (interpolate the block into the prompt)
- Modify: `apps/studio/src/lib/ai.js:114` (add the everyday-appropriateness rule)

No tests: `ai.js` has no Gemini test harness anywhere in the project, consistent with the existing `generateOutfitWithGemini` / `generateConciergeReply`. The block is guarded structurally by `recentLooks.length > 0`.

- [ ] **Step 1: Add the `recentLooks` parameter**

Find this exact existing line (`apps/studio/src/lib/ai.js:41`):

```js
export async function generateOutfitWithGemini({ items, intent, weather, season, previousOutfit = null, temperature = 0.7, styleProfile = '', mustIncludeItem = null, calendarEvents = [] }) {
```

Replace it with:

```js
export async function generateOutfitWithGemini({ items, intent, weather, season, previousOutfit = null, temperature = 0.7, styleProfile = '', mustIncludeItem = null, calendarEvents = [], recentLooks = [] }) {
```

- [ ] **Step 2: Build the freshness block**

Find this exact existing block (`apps/studio/src/lib/ai.js:65-70`):

```js
  const eventsHint = calendarEvents.length > 0
    ? `\n\nWHAT THE USER HAS ON TODAY:
${calendarEvents.map((e) => `- ${e.allDay ? 'All day' : new Date(e.startISO).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}: ${e.title}${e.location ? ` (${e.location})` : ''}`).join('\n')}

Dress for the most demanding event of the day — if there's a board meeting AND a casual lunch, dress for the board meeting. Reflect this in the reasoning sentence.\n`
    : '';
```

Insert immediately after it:

```js
  // Freshness. Without this the daily brief sends identical inputs every day
  // and the model re-picks the same base, so the same shirt and trousers come
  // back each morning (only the optional slots jitter). Naming the recent bases
  // is a soft steer: it never forces a piece IN — which is exactly why a
  // rarely-worn occasion dress can't get dragged into an ordinary day — and it
  // is deliberately subordinate to the NON-NEGOTIABLE weather and
  // complete-the-look rules below.
  const freshnessBlock = recentLooks.length > 0
    ? `\n\nRECENT DAILY LOOKS were built on these pieces:
${recentLooks.map((i) => `- ${i.category}: ${i.name}`).join('\n')}

Build today's look on a DIFFERENT clothing base — a different Top + Bottom pair, or a different Dress. Shoes, bags and jewellery MAY repeat if they genuinely finish the new look. If the wardrobe is too small to avoid every piece above, differ at least from the most recent one.\n`
    : '';
```

- [ ] **Step 3: Interpolate the block into the prompt**

Find this exact existing line (`apps/studio/src/lib/ai.js:91`):

```js
${styleProfile ? `- ${styleProfile}` : ''}${eventsHint}
```

Replace it with:

```js
${styleProfile ? `- ${styleProfile}` : ''}${eventsHint}${freshnessBlock}
```

- [ ] **Step 4: Add the everyday-appropriateness rule**

Find this exact existing line in the `Stylist rules:` list (`apps/studio/src/lib/ai.js:114`):

```js
- ★FAVOURITE items are pieces the user loves — give them meaningful preference when they fit the intent and palette. Don't force a favourite that clashes; do prefer one over an equally-suitable non-favourite.
```

Replace it with (keeps the favourite rule, adds the guard immediately after — the two interact, since blanket favourite-preference is part of what makes the brief repeat):

```js
- ★FAVOURITE items are pieces the user loves — give them meaningful preference when they fit the intent and palette. Don't force a favourite that clashes; do prefer one over an equally-suitable non-favourite.
- Default to everyday-appropriate pieces. Reserve Occasion-tagged pieces and eveningwear (styles=Occasion, or Dresses/Cocktail and Dresses/Evening / Gown) for days whose events call for them — on an ordinary day with no matching event, do not choose them.
```

- [ ] **Step 5: Run the build**

Run: `cd apps/studio && pnpm build`
Expected: `✓ built in` with no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/studio/src/lib/ai.js
git commit -m "feat(ai): freshness nudge and everyday-appropriateness guard in the outfit prompt"
```

---

### Task 4: Wire the history through TodayView

**Files:**
- Modify: `apps/studio/src/views/TodayView.jsx:7` (import)
- Modify: `apps/studio/src/views/TodayView.jsx` (module-level helpers, above `function DailyBriefCard({`)
- Modify: `apps/studio/src/views/TodayView.jsx:127` (state + effect)
- Modify: `apps/studio/src/views/TodayView.jsx:220-253` (auto-compose)
- Modify: `apps/studio/src/views/TodayView.jsx:255-275` (composeAnother)
- Modify: `apps/studio/src/views/TodayView.jsx:815` (the `onGenerateOutfit` prop)

- [ ] **Step 1: Extend the dailyBrief import**

Find this exact existing line (`apps/studio/src/views/TodayView.jsx:7`):

```js
import { readDailyBrief, writeDailyBrief, clearDailyBrief, nextSlotIndex, registerInflightCompose, getInflightCompose, isComposingRecent, readRemoteDailyBrief, writeRemoteDailyBrief } from "../dailyBrief";
```

Replace it with:

```js
import { readDailyBrief, writeDailyBrief, clearDailyBrief, nextSlotIndex, registerInflightCompose, getInflightCompose, isComposingRecent, readRemoteDailyBrief, writeRemoteDailyBrief, readRecentBases, appendRecentBase, readRemoteRecentBases, writeRemoteRecentBases, mergeRecent } from "../dailyBrief";
```

- [ ] **Step 2: Add the module-level helpers**

Find this exact existing line:

```js
function DailyBriefCard({
```

Insert immediately BEFORE it:

```js
// The freshness nudge tracks only a look's CLOTHING BASE — shoes, bags and
// jewellery are free to repeat day to day (and are what already vary). Mirrors
// the isClothingBase categories used by the prompt in lib/ai.js.
const BASE_CATEGORIES = ['Dresses', 'Tops', 'Bottoms'];

function baseIdsOf(itemIds = [], items = []) {
  return (itemIds || []).filter((id) => BASE_CATEGORIES.includes(items.find((it) => it.id === id)?.category));
}

// Flatten the stored history to the actual item objects the prompt names.
// Ids that no longer resolve (piece deleted since) are dropped.
function resolveRecentItems(recent = [], items = []) {
  const ids = [...new Set(recent.flatMap((entry) => entry.baseIds || []))];
  return ids.map((id) => items.find((it) => it.id === id)).filter(Boolean);
}

```

- [ ] **Step 3: Add history state, loader, and the recorder**

Find this exact existing line (`apps/studio/src/views/TodayView.jsx:127`):

```js
  const [remoteChecked, setRemoteChecked] = useState(false);
```

Insert immediately after it:

```js
  // Freshness history — the recent clothing bases, so the compose can steer off
  // them. Local first (instant), then merged with the Firestore copy so the
  // nudge is consistent whichever device composes. `historyChecked` gates the
  // auto-compose below for the same reason `remoteChecked`/`calendarReady` do:
  // composing before the shared history lands would nudge off an incomplete
  // picture and repeat a base another device already used today.
  const [recentBases, setRecentBases] = useState(() => readRecentBases(uid));
  const [historyChecked, setHistoryChecked] = useState(false);
  useEffect(() => {
    if (!user) { setHistoryChecked(true); return; }
    let alive = true;
    (async () => {
      try {
        const remote = await readRemoteRecentBases(uid);
        // Remote first — Firestore wins a same-day tie (see mergeRecent).
        if (alive && remote.length) setRecentBases((local) => mergeRecent(remote, local));
      } finally {
        if (alive) setHistoryChecked(true);
      }
    })();
    return () => { alive = false; };
  }, [uid, user]);

  // Record a composed look's base so tomorrow steers away from it. Local write
  // is synchronous and authoritative for this device; the Firestore push is
  // best-effort and shares it with the user's other devices.
  const recordBase = (out) => {
    const next = appendRecentBase(uid, baseIdsOf(out?.itemIds, items));
    setRecentBases(next);
    writeRemoteRecentBases(uid, next);
  };
```

- [ ] **Step 4: Gate and feed the auto-compose**

Find this exact existing line (start of the auto-compose guard block, `apps/studio/src/views/TodayView.jsx:220`):

```js
    if (isComposingRecent(uid) && !getInflightCompose(uid)) return;
```

Insert immediately BEFORE it:

```js
    if (!historyChecked) return; // wait for the shared freshness history
```

Then find this exact existing block (`apps/studio/src/views/TodayView.jsx:229-239`):

```js
    registerInflightCompose(uid, async () => {
      const out = await onGenerateOutfit({
        intent: 'a considered look for today',
        temperature: aiTemperature,
        slotIndex: 0,
        calendarEvents,
      });
      const saved = writeDailyBrief(uid, { ...out, intent: 'a considered look for today', slotIndex: 0 });
      writeRemoteDailyBrief(uid, saved); // publish to Firestore so other devices show the same look (best-effort)
      return saved;
    })
```

Replace it with:

```js
    registerInflightCompose(uid, async () => {
      const out = await onGenerateOutfit({
        intent: 'a considered look for today',
        temperature: aiTemperature,
        slotIndex: 0,
        calendarEvents,
        recentLooks: resolveRecentItems(recentBases, items),
      });
      const saved = writeDailyBrief(uid, { ...out, intent: 'a considered look for today', slotIndex: 0 });
      writeRemoteDailyBrief(uid, saved); // publish to Firestore so other devices show the same look (best-effort)
      recordBase(out);
      return saved;
    })
```

- [ ] **Step 5: Add `historyChecked` to the auto-compose dependencies**

Find this exact existing line (`apps/studio/src/views/TodayView.jsx:253`):

```js
  }, [uid, isAiEnabled, items?.length, weatherSettled, calendarReady, remoteChecked]); // re-fires when weather, calendar AND the shared-brief check resolve
```

Replace it with (the effect closes over `recentBases`, so it must re-run once the shared history lands — `historyChecked` flipping is what re-runs it with the merged list):

```js
  }, [uid, isAiEnabled, items?.length, weatherSettled, calendarReady, remoteChecked, historyChecked]); // re-fires when weather, calendar, the shared-brief check AND the freshness history resolve
```

- [ ] **Step 6: Feed "Compose another" too**

Find this exact existing block (`apps/studio/src/views/TodayView.jsx:261-270`):

```js
      const out = await onGenerateOutfit({
        intent: 'a different considered look for today',
        temperature: aiTemperature,
        slotIndex: slot,
        previous: brief,
        calendarEvents,
      });
      const saved = writeDailyBrief(uid, { ...out, intent: 'a different considered look for today', slotIndex: slot });
      writeRemoteDailyBrief(uid, saved); // a re-roll becomes the new shared look across devices
      setBrief(saved);
```

Replace it with:

```js
      const out = await onGenerateOutfit({
        intent: 'a different considered look for today',
        temperature: aiTemperature,
        slotIndex: slot,
        previous: brief,
        calendarEvents,
        recentLooks: resolveRecentItems(recentBases, items),
      });
      const saved = writeDailyBrief(uid, { ...out, intent: 'a different considered look for today', slotIndex: slot });
      writeRemoteDailyBrief(uid, saved); // a re-roll becomes the new shared look across devices
      recordBase(out); // a re-roll replaces today's recorded base (same dateKey)
      setBrief(saved);
```

- [ ] **Step 7: Forward `recentLooks` to Gemini**

Find this exact existing line (`apps/studio/src/views/TodayView.jsx:815`):

```js
        onGenerateOutfit={async ({ intent, temperature, previous, calendarEvents }) => {
```

Replace it with:

```js
        onGenerateOutfit={async ({ intent, temperature, previous, calendarEvents, recentLooks }) => {
```

Then find this exact existing line inside that call (the last argument before the closing brace):

```js
            calendarEvents,
          });
        }}
```

Replace it with:

```js
            calendarEvents,
            recentLooks,
          });
        }}
```

- [ ] **Step 8: Run the build**

Run: `cd apps/studio && pnpm build`
Expected: `✓ built in` with no errors.

- [ ] **Step 9: Run the full suite**

Run: `cd apps/studio && pnpm test`
Expected: all pass, zero new failures.

- [ ] **Step 10: Commit**

```bash
git add apps/studio/src/views/TodayView.jsx
git commit -m "feat(daily-brief): steer each day's compose off the recent bases"
```

---

### Task 5: Verify in the running app, then open the PR

**Files:** none (verification + git/GitHub operations only)

- [ ] **Step 1: Verify the freshness nudge end-to-end**

Run: `cd apps/studio && pnpm dev`, open the app signed in (a wardrobe of 5+ items with at least two distinct Top+Bottom pairs or Dresses), go to Today, and:

1. Let the Daily Brief compose. Note the clothing base (the top+bottom, or the dress).
2. Tap **Compose another**. Expected: a DIFFERENT clothing base from step 1 — not merely different shoes or jewellery.
3. Tap **Compose another** again. Expected: a base different from both previous ones (until the wardrobe runs out of distinct bases, at which point repeats are acceptable — the nudge is soft by design).
4. In DevTools → Application → Local Storage, confirm `atelier.dailyBrief.recent.<uid>` holds at most 3 entries, newest first, each with only Dress/Top/Bottom ids.
5. In the Firebase console, confirm `users/<uid>/state/dailyBriefHistory` exists with a matching `recent` array.

- [ ] **Step 2: Verify the occasion guard**

With no calendar events today, compose a few briefs. Expected: no Occasion-tagged piece or eveningwear (Cocktail / Evening / Gown) is chosen for an ordinary day.

- [ ] **Step 3: Verify graceful degradation**

In DevTools, set `atelier.dailyBrief.recent.<uid>` to `{not json` and reload Today. Expected: the brief still composes normally (no freshness block, no crash) — `readRecentBases` swallows the parse failure.

- [ ] **Step 4: Push the branch**

```bash
git push -u origin feat/daily-brief-freshness
```

- [ ] **Step 5: Open the PR**

```bash
gh pr create --title "Daily Brief: a different look each day" --body "$(cat <<'EOF'
## Summary
- The Daily Brief recommended the same clothing base every day: the daily auto-compose sent Gemini near-identical inputs (same wardrobe, intent, style profile) and the prompt asked it to prefer ★favourites and build "the most coherent look", so it deterministically re-picked the same top+trousers — only the optional slots jittered. `previousOutfit` only ever populated for the within-day "Compose another", never for the daily compose.
- Adds a rolling 3-day history of each brief's clothing base (localStorage + `users/{uid}/state/dailyBriefHistory` so it is consistent across devices) and feeds it back into the compose as a soft "build on a different base" nudge.
- Adds an always-on prompt line reserving Occasion-tagged pieces and eveningwear for days whose calendar events call for them — this is why the fix is anti-repetition rather than "suggest least-worn pieces", which would have surfaced a rarely-worn occasion dress on an ordinary Tuesday.
- Both blocks are preferences, subordinate to the existing non-negotiable weather and complete-the-look rules. Temperature is unchanged (0.7) — variety comes from the shifting recent-set, not added randomness. No hard candidate exclusion, so a small wardrobe degrades to a soft repeat rather than an incoherent or empty look.

Spec: `apps/studio/docs/superpowers/specs/2026-07-16-daily-brief-freshness-design.md`
Plan: `apps/studio/docs/superpowers/plans/2026-07-16-daily-brief-freshness.md`

## Test plan
- [x] `pnpm test` — 10 new unit tests for the history helpers (ordering, 3-day cap, same-day replace, malformed data, uid scoping), zero regressions
- [x] `pnpm build` — clean
- [ ] Founder to verify live: "Compose another" yields a different clothing base (not just different shoes); no occasion dress on an ordinary day

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR URL printed. **Stop here and report the PR URL — do not merge or deploy.**

---

## Self-review

**Spec coverage:** Rolling 3-day local history → Task 1. Firestore-shared history → Task 2. `recentLooks` param + freshness block + everyday-appropriateness line, both subordinate to the hard rules → Task 3. Read-before-compose, resolve ids to items, append after BOTH compose paths → Task 4. Testing (unit for pure helpers; manual for the prompt, consistent with `ai.js` having no Gemini harness) → Tasks 1 and 5. Non-goals (no hard exclusion, no least-worn rotation, no temperature change) → nothing in Tasks 1–5 touches them.

**Placeholder scan:** No TBD/TODO. Every code step shows the exact before/after, including the two easy-to-miss ones: adding `historyChecked` to the auto-compose dependency array (Task 4 Step 5 — without it the effect keeps a stale `recentBases` closure) and the `recentLooks` forward in the `onGenerateOutfit` prop (Task 4 Step 7).

**Type consistency:** `mergeRecent`, `readRecentBases`, `appendRecentBase`, `readRemoteRecentBases`, `writeRemoteRecentBases` are named identically in `dailyBrief.js`, the test file, and the `TodayView.jsx` import. The entry shape `{ dateKey: string, baseIds: string[] }` is used consistently across storage, merge, Firestore, and `resolveRecentItems`. The prompt param is `recentLooks` (item objects) everywhere — `DailyBriefCard` → `onGenerateOutfit` → `generateOutfitWithGemini` — while the stored form is `baseIds` (strings); `resolveRecentItems` is the single conversion point.
