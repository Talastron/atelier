# P0 Marketing–Product Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the six P0 gaps between the `myatelier.style` marketing site and the shipped app so no headline promise on the site is unsupported by behavior in the app.

**Architecture:** Six independent task groups, each shippable as its own commit/PR. Two code/copy edits live in the marketing repo (`atelier-website`); four feature/UX changes live in the app repo (`Digital Wardrobe`). Persistence uses Firestore subcollections already governed by the existing `canSignIn()` rule. AI calls reuse the existing `geminiText` wrapper (auto rate-limits, logs usage, maps errors).

**Tech Stack:**
- App: React 18, Vite 6, Tailwind 4, Firebase 11 (Firestore + Auth + AI Logic / Gemini 2.5 Flash), lucide-react icons
- Marketing: Astro + React islands (under `apps/marketing` in the `atelier-website` monorepo)
- No test framework is installed in `digital-wardrobe`. Verification is **manual via `npm run dev`** unless a step says otherwise. Do not install a test framework as part of this plan — it is out of scope.

**Repo paths (Windows):**
- App repo: `C:\Users\SibylleMoller-Sherwo\Documents\Digital Wardrobe`
- Marketing repo: `C:\Users\SibylleMoller-Sherwo\Documents\atelier-website`

**Verification convention:** Each task ends with a manual smoke check in `npm run dev` against the demo wardrobe (`?demo=1`) where applicable. Use the demo seed so verification does not require live Firestore data.

---

## File Structure Overview

| File | Repo | Change | Why |
|---|---|---|---|
| `src/dailyBrief.js` | app | **create** | Module: pure functions for "today's outfit" caching key + cache read/write |
| `src/App.jsx` | app | **modify** | Wire in Daily Brief card, "Why this?" chip, Concierge persistence, subscription status badge, 90-day manifesto nudge |
| `src/conciergeStore.js` | app | **create** | Firestore-backed concierge thread persistence (`/users/{uid}/concierge/{threadId}`) |
| `src/subscriptionStatus.js` | app | **create** | Hook + helpers to read `/subscriberAccess/{uid}` and compute "trial ends in N days" |
| `firestore.rules` | app | **modify** | Add explicit rule for `/users/{uid}/concierge/{threadId}` (already covered by `/users/{uid}/{document=**}` but make explicit + document) |
| `apps/marketing/src/pages/index.astro` | marketing | **modify** | Change "your calendar" → "your day" in the "Sees the day" feature card |
| `apps/marketing/src/pages/manifesto.astro` | marketing | **modify** | Soften "arrives each season" cadence claim to match implemented quarterly nudge |
| `apps/marketing/src/pages/about.astro` | marketing | **modify** | Match the manifesto cadence wording softened above |
| `apps/marketing/src/components/PricingInsideList.jsx` | marketing | **modify** | Match the manifesto cadence wording softened above |

---

## Task Group 1 — Marketing Copy Softening (Risks #4, #11, #9)

**Goal:** Bring three asserted-but-unimplemented claims into truthful alignment without diluting the editorial voice. Ship these **first** — they are the lowest-effort risk reducers.

### Task 1.1: Soften "your calendar" on the home page

**Files:**
- Modify: `apps/marketing/src/pages/index.astro:78`

- [ ] **Step 1: Verify the current copy**

Run from `C:\Users\SibylleMoller-Sherwo\Documents\atelier-website`:
```bash
sed -n '75,82p' apps/marketing/src/pages/index.astro
```
Expected output (the offending line is line 78):
```
                roman: 'II',
                verb: 'Sees the day',
                text: 'The forecast, your calendar, what is and is not in the wash.',
              },
```

- [ ] **Step 2: Edit the copy**

Change line 78 from:
```
                text: 'The forecast, your calendar, what is and is not in the wash.',
```
to:
```
                text: 'The forecast, your day, what is and is not in the wash.',
```

(One-word change: `your calendar` → `your day`. Preserves rhythm and meaning; removes the implied OAuth integration.)

- [ ] **Step 3: Verify in the marketing dev server**

From `apps/marketing`:
```bash
pnpm dev
```
Open `http://localhost:4321/` (or whatever port Astro prints). Scroll to the "MEET THE CONCIERGE" section. Confirm the second editorial bullet reads "Sees the day — The forecast, your day, what is and is not in the wash."

- [ ] **Step 4: Commit**

```bash
cd "C:/Users/SibylleMoller-Sherwo/Documents/atelier-website"
git add apps/marketing/src/pages/index.astro
git commit -m "copy: soften 'your calendar' to 'your day' until OAuth integration ships"
```

---

### Task 1.2: Soften manifesto cadence claims

**Files:**
- Modify: `apps/marketing/src/pages/manifesto.astro:59`
- Modify: `apps/marketing/src/pages/manifesto.astro:272-274`
- Modify: `apps/marketing/src/pages/about.astro:342`
- Modify: `apps/marketing/src/components/PricingInsideList.jsx:43`

The current copy asserts an *automatic* quarterly delivery. Until the Cloud Function in P2-17 ships, we soften to "refresh whenever you like; we'll nudge you each season."

- [ ] **Step 1: Verify all four locations**

```bash
grep -nC1 "each season" apps/marketing/src/pages/manifesto.astro apps/marketing/src/pages/about.astro apps/marketing/src/components/PricingInsideList.jsx
```

- [ ] **Step 2: Edit `manifesto.astro:59`**

Change:
```
          A private brief, composed each season.
```
to:
```
          A private brief, refreshed at your pace.
```

- [ ] **Step 3: Edit `manifesto.astro:272-274`**

Change:
```
        A first reading is composed when you have logged thirty wears.
        A refreshed brief arrives each season after that — quarterly,
        unannounced, kept privately.
```
to:
```
        A first reading is composed once you have logged thirty wears.
        Refresh it whenever you like — the studio nudges you each season,
        unannounced, kept privately.
```

- [ ] **Step 4: Edit `about.astro:342`**

Change:
```
        looks you've saved. Members receive a refreshed brief each season.
```
to:
```
        looks you've saved. The studio nudges you for a refresh each season.
```

- [ ] **Step 5: Edit `PricingInsideList.jsx:43`**

Change:
```js
    line: 'True cost per wear. The gaps in your collection. A private brief of your aesthetic, refreshed each season.',
```
to:
```js
    line: 'True cost per wear. The gaps in your collection. A private brief of your aesthetic, refreshed at your pace.',
```

- [ ] **Step 6: Verify in marketing dev server**

Reload the manifesto page, the about page, and the pricing page. Confirm each updated phrase reads as edited and no leftover "each season" appears in those three sections (the founder copy on `about.astro:489` "replace each season" stays — it's about clothing, not the manifesto).

- [ ] **Step 7: Commit**

```bash
cd "C:/Users/SibylleMoller-Sherwo/Documents/atelier-website"
git add apps/marketing/src/pages/manifesto.astro apps/marketing/src/pages/about.astro apps/marketing/src/components/PricingInsideList.jsx
git commit -m "copy: soften manifesto cadence — refresh at your pace, seasonal nudge"
```

---

## Task Group 2 — Daily Brief Card (Gap #6)

**Goal:** Add the "tap once, get styled for today" surface as the hero card of the Wardrobe tab. Replaces the current single-item "Today's Pick" with a full head-to-toe outfit, cached per day, regeneratable on demand.

### File Structure for Task Group 2

| File | Change | Responsibility |
|---|---|---|
| `src/dailyBrief.js` | create | Pure functions: cache key (`YYYY-MM-DD`), read/write to `localStorage`, freshness check |
| `src/App.jsx` | modify | Replace `TodaysPickCard` (or render alongside) with `<DailyBriefCard />`. Wire to existing `generateOutfitWithGemini`. |

### Task 2.1: Build the daily brief cache module

**Files:**
- Create: `src/dailyBrief.js`

- [ ] **Step 1: Create the cache module**

Create `src/dailyBrief.js` with:

```javascript
// src/dailyBrief.js
//
// Per-day cache for the Daily Brief outfit. Keyed by uid + local date so that:
//   - generation runs at most once per day per user without the user asking
//   - "Compose another" forces a fresh generation by bumping the slot index
//   - signing out / switching demo↔live wardrobes does not leak briefs across uids
//
// Stored in localStorage so it survives reloads but never persists to Firestore
// (the brief is ephemeral — only the outfit the user explicitly *saves* lands
// in /users/{uid}/outfits).

const KEY_PREFIX = 'atelier.dailyBrief';

function todayKey() {
  // Use the user's *local* date (not UTC). The brief should roll over at the
  // user's midnight, not Greenwich's.
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function storageKey(uid) {
  return `${KEY_PREFIX}.${uid || 'anon'}`;
}

export function readDailyBrief(uid) {
  try {
    const raw = localStorage.getItem(storageKey(uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.dateKey !== todayKey()) return null; // stale (yesterday)
    return parsed;
  } catch {
    return null;
  }
}

export function writeDailyBrief(uid, brief) {
  // brief shape: { itemIds: [...], reasoning, confidence, intent, slotIndex }
  try {
    const payload = {
      ...brief,
      dateKey: todayKey(),
      savedAt: Date.now(),
    };
    localStorage.setItem(storageKey(uid), JSON.stringify(payload));
    return payload;
  } catch {
    return null;
  }
}

export function clearDailyBrief(uid) {
  try { localStorage.removeItem(storageKey(uid)); } catch { /* swallow */ }
}

// Used by "Compose another" — bumps the slot so the cached version doesn't
// short-circuit the next render.
export function nextSlotIndex(uid) {
  const existing = readDailyBrief(uid);
  return (existing?.slotIndex ?? 0) + 1;
}
```

- [ ] **Step 2: Quick sanity check from a browser console**

After saving the file, in the running `npm run dev` browser console:
```js
const m = await import('/src/dailyBrief.js');
m.writeDailyBrief('test-uid', { itemIds: ['a','b','c'], reasoning: 'test', confidence: 90, intent: 'office', slotIndex: 0 });
console.log(m.readDailyBrief('test-uid')); // should print the object with today's dateKey
m.clearDailyBrief('test-uid');
console.log(m.readDailyBrief('test-uid')); // should print null
```

- [ ] **Step 3: Commit**

```bash
cd "C:/Users/SibylleMoller-Sherwo/Documents/Digital Wardrobe"
git add src/dailyBrief.js
git commit -m "feat(daily-brief): per-day localStorage cache module"
```

---

### Task 2.2: Render the Daily Brief card on the Wardrobe tab

**Files:**
- Modify: `src/App.jsx` — locate the Wardrobe tab render path. (Search for `activeTab === 'wardrobe'` and the existing "Today's Pick" hero card.)

- [ ] **Step 1: Locate the wardrobe hero card render location**

Run:
```bash
cd "C:/Users/SibylleMoller-Sherwo/Documents/Digital Wardrobe"
grep -n "Today's Pick\|todays-pick\|TodaysPick" src/App.jsx
```
Note the line numbers. The Daily Brief card should render **above** the existing Today's Pick, not replace it (Today's Pick targets a single under-worn item; the Brief is a full outfit — they complement each other).

If the file has no `TodaysPickCard` hit, locate by:
```bash
grep -n "activeTab === 'wardrobe'" src/App.jsx
```
Pick the render block that contains the wardrobe hero/header area.

- [ ] **Step 2: Add the import at the top of `src/App.jsx`**

Find the existing import block (top of file). Add:
```javascript
import { readDailyBrief, writeDailyBrief, clearDailyBrief, nextSlotIndex } from './dailyBrief';
```

- [ ] **Step 3: Add the `DailyBriefCard` component**

Add a new component definition. Place it near the other top-level wardrobe components (search for `function TodaysPickCard` or similar and add immediately above/below).

```javascript
function DailyBriefCard({
  user,
  items,
  styleProfile,
  weather,
  season,
  aiTemperature,
  onGenerateOutfit,        // wraps generateOutfitWithGemini
  onOpenOutfit,            // navigates to Studio with the brief loaded
  onSaveBrief,             // saves as a Look
  onLogWear,               // logs as worn today
  isAiEnabled,
}) {
  const uid = user?.uid || 'anon';
  const [brief, setBrief] = useState(() => readDailyBrief(uid));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [whyOpen, setWhyOpen] = useState(false);

  // Auto-compose on first mount of the day if we have enough items and AI is on.
  useEffect(() => {
    if (brief) return;                    // already have today's brief
    if (!isAiEnabled) return;             // AI off — silent skip
    if ((items?.length ?? 0) < 5) return; // not enough wardrobe to compose
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const out = await onGenerateOutfit({
          intent: 'a considered look for today',
          temperature: aiTemperature,
          slotIndex: 0,
        });
        if (cancelled) return;
        const saved = writeDailyBrief(uid, { ...out, intent: 'a considered look for today', slotIndex: 0 });
        setBrief(saved);
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Could not compose today\'s brief.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [uid, isAiEnabled, items?.length]); // deliberately omit weather/profile — first-of-day shot uses whatever's current

  async function composeAnother() {
    setLoading(true);
    setError(null);
    try {
      const slot = nextSlotIndex(uid);
      const out = await onGenerateOutfit({
        intent: 'a different considered look for today',
        temperature: aiTemperature,
        slotIndex: slot,
        previous: brief, // pass prior so the prompt can avoid repeating it
      });
      const saved = writeDailyBrief(uid, { ...out, intent: 'a different considered look for today', slotIndex: slot });
      setBrief(saved);
    } catch (err) {
      setError(err?.message || 'Could not compose another brief.');
    } finally {
      setLoading(false);
    }
  }

  // Empty state — wardrobe too small to compose
  if ((items?.length ?? 0) < 5) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-6 text-stone-700">
        <p className="text-sm uppercase tracking-widest text-stone-500">The Daily Brief</p>
        <h3 className="mt-2 text-xl font-serif">Add a few more pieces, and the brief begins.</h3>
        <p className="mt-2 text-sm text-stone-600">
          The Concierge composes today's outfit once your wardrobe has at least five pieces.
        </p>
      </div>
    );
  }

  // Loading state
  if (loading && !brief) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-stone-50 p-6 animate-pulse">
        <p className="text-sm uppercase tracking-widest text-stone-400">The Daily Brief</p>
        <div className="mt-3 h-7 w-3/4 rounded bg-stone-200" />
        <div className="mt-4 grid grid-cols-4 gap-2">
          {[0,1,2,3].map(i => <div key={i} className="aspect-square rounded-lg bg-stone-200" />)}
        </div>
      </div>
    );
  }

  // Error state
  if (error && !brief) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-6">
        <p className="text-sm uppercase tracking-widest text-stone-500">The Daily Brief</p>
        <p className="mt-2 text-sm text-stone-700">{error}</p>
        <button
          onClick={composeAnother}
          className="mt-3 rounded-full border border-stone-300 px-4 py-1.5 text-sm hover:bg-stone-50"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!brief) return null;

  const briefItems = (brief.itemIds || [])
    .map(id => items.find(it => it.id === id))
    .filter(Boolean);

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-6">
      <div className="flex items-baseline justify-between">
        <p className="text-sm uppercase tracking-widest text-stone-500">The Daily Brief</p>
        <p className="text-xs text-stone-400">{brief.confidence ?? '—'}% confidence</p>
      </div>
      <h3 className="mt-2 text-2xl font-serif text-stone-900">
        Styled for today.
      </h3>
      <p className="mt-2 text-sm italic text-stone-700">{brief.reasoning}</p>

      <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-5">
        {briefItems.map(it => (
          <button
            key={it.id}
            onClick={() => onOpenOutfit?.(brief)}
            className="aspect-square overflow-hidden rounded-lg border border-stone-200 bg-stone-50"
          >
            {(it.images?.[0] || it.imageUrl) ? (
              <img src={it.images?.[0] || it.imageUrl} alt={it.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-stone-400">{it.category}</div>
            )}
          </button>
        ))}
      </div>

      <button
        onClick={() => setWhyOpen(o => !o)}
        className="mt-3 text-xs uppercase tracking-widest text-stone-500 underline-offset-4 hover:underline"
      >
        {whyOpen ? 'Hide reasoning' : 'Why this?'}
      </button>
      {whyOpen && (
        <WhyThisPanel
          weather={weather}
          season={season}
          styleProfile={styleProfile}
          temperature={aiTemperature}
          itemCount={items?.length ?? 0}
        />
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={() => onLogWear?.(brief)}
          className="rounded-full bg-stone-900 px-4 py-2 text-sm text-white hover:bg-stone-800"
        >
          Wear this
        </button>
        <button
          onClick={composeAnother}
          disabled={loading}
          className="rounded-full border border-stone-300 px-4 py-2 text-sm hover:bg-stone-50 disabled:opacity-50"
        >
          {loading ? 'Composing…' : 'Compose another'}
        </button>
        <button
          onClick={() => onSaveBrief?.(brief)}
          className="rounded-full border border-stone-300 px-4 py-2 text-sm hover:bg-stone-50"
        >
          Save as a Look
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Wire `DailyBriefCard` into the Wardrobe tab render**

In the wardrobe-tab JSX (the block from Step 1), render the `<DailyBriefCard ... />` immediately above the existing "Today's Pick" card. Pass in:

```jsx
<DailyBriefCard
  user={user}
  items={items.filter(it => it.status === 'owned' && !it.deletedAt && it.condition !== 'in_wash' && it.condition !== 'damaged')}
  styleProfile={styleProfile}
  weather={weather}
  season={currentSeason}
  aiTemperature={aiTemperatureFromPreset(styleProfile?.aiTemperaturePreset)}
  isAiEnabled={isAiEnabled()}
  onGenerateOutfit={async ({ intent, temperature, slotIndex, previous }) => {
    // wraps existing generateOutfitWithGemini — pass `previous` only when present
    return generateOutfitWithGemini({
      items,
      intent,
      weather,
      season: currentSeason,
      styleProfile,
      temperature,
      previous, // existing fn already accepts this for refinement mode
    });
  }}
  onOpenOutfit={(brief) => {
    // Switch to Studio with the brief preloaded for editing
    setActiveTab('outfits');
    setStudioPreloadedOutfit(brief);
  }}
  onLogWear={(brief) => {
    // Reuse the existing wear-log flow used by the Studio "Log wear" button
    logWearForItemIds(brief.itemIds, todayISO());
    clearDailyBrief(user?.uid || 'anon'); // brief is "used up"
  }}
  onSaveBrief={(brief) => {
    // Reuse the existing save-as-look flow
    saveOutfitAsLook({
      name: 'Today',
      intent: brief.intent,
      reasoning: brief.reasoning,
      itemIds: brief.itemIds,
      confidence: brief.confidence,
    });
  }}
/>
```

If any of the helper names above (`aiTemperatureFromPreset`, `setStudioPreloadedOutfit`, `logWearForItemIds`, `saveOutfitAsLook`, `todayISO`, `isAiEnabled`, `currentSeason`) don't exist verbatim, grep for the actual names used elsewhere in `App.jsx` and substitute — every one of these capabilities exists already (the inventory in the gap analysis confirmed them). Do **not** invent new helpers; reuse what's there.

- [ ] **Step 5: Add the `WhyThisPanel` component**

Add this near `DailyBriefCard`:

```javascript
function WhyThisPanel({ weather, season, styleProfile, temperature, itemCount }) {
  const tempLabel = temperature <= 0.4 ? 'Safe' : temperature >= 0.9 ? 'Surprise' : 'Balanced';
  return (
    <div className="mt-3 rounded-lg border border-stone-200 bg-stone-50 p-4 text-sm text-stone-700">
      <p className="mb-2 text-xs uppercase tracking-widest text-stone-500">What the Concierge saw</p>
      <ul className="space-y-1">
        <li>· {itemCount} owned, in-wardrobe pieces</li>
        {weather && (
          <li>· {weather.temp != null ? `${Math.round(weather.temp)}°C` : 'no forecast'} · {season}</li>
        )}
        {styleProfile?.styleFormality && <li>· Formality: {styleProfile.styleFormality}</li>}
        {styleProfile?.stylePalette && <li>· Palette: {styleProfile.stylePalette}</li>}
        <li>· Temperature: {tempLabel}</li>
      </ul>
      <p className="mt-2 text-xs italic text-stone-500">
        Composed from your closet. Your data stays with you.
      </p>
    </div>
  );
}
```

- [ ] **Step 6: Verify the daily brief renders end-to-end**

Run from the app repo:
```bash
cd "C:/Users/SibylleMoller-Sherwo/Documents/Digital Wardrobe"
npm run dev
```

Open `http://localhost:5173/?demo=1` (or whatever port Vite prints; demo mode has seed wardrobe so AI calls will run against a real Gemini key — see `firebase.js:174` `isAIEnabled()`). On the Wardrobe tab confirm:
- The Daily Brief card appears above Today's Pick.
- On first load, it shows a loading skeleton, then an outfit with reasoning.
- "Why this?" toggles open and lists weather + season + temperature.
- "Compose another" generates a new outfit; the prior is replaced.
- "Wear this" closes the brief (the card disappears or empties — both acceptable).
- Reload — the brief is the same one (cache hit, no second AI call).
- Open DevTools → Application → Local Storage → confirm an entry under `atelier.dailyBrief.<uid>`.

If `isAIEnabled()` returns false in your local env, the card will silently skip auto-compose — that is the documented behavior and not a bug. Use a full `.env.local` with the reCAPTCHA key for a true end-to-end run.

- [ ] **Step 7: Commit**

```bash
git add src/App.jsx
git commit -m "feat(daily-brief): render DailyBriefCard + WhyThisPanel on wardrobe home"
```

---

## Task Group 3 — Cross-Cutting "Why this?" Chip (UX lever)

**Goal:** The `WhyThisPanel` shipped in Task Group 2 is the prototype. This task group adds the same chip to **two more AI surfaces** so the pattern lands consistently: the Studio outfit result, and the Concierge reply.

### Task 3.1: "Why this?" on the Studio outfit result

**Files:**
- Modify: `src/App.jsx` (in the Studio render path where the generated outfit + reasoning sentence are shown)

- [ ] **Step 1: Locate the Studio outfit render block**

```bash
grep -n "Suggest a Look\|generateOutfitWithGemini\|composedOutfit\|currentOutfit" src/App.jsx | head -20
```
Find the JSX block that renders the AI-composed outfit (items + reasoning sentence) after a Generate click.

- [ ] **Step 2: Add the "Why this?" chip below the reasoning sentence**

In the existing reasoning-display JSX, immediately under the reasoning line, add:
```jsx
<details className="mt-2">
  <summary className="cursor-pointer text-xs uppercase tracking-widest text-stone-500 hover:underline">
    Why this?
  </summary>
  <WhyThisPanel
    weather={weather}
    season={currentSeason}
    styleProfile={styleProfile}
    temperature={aiTemperatureFromPreset(styleProfile?.aiTemperaturePreset)}
    itemCount={items.filter(it => it.status === 'owned').length}
  />
</details>
```

`<details>` is native HTML — no extra state to wire, accessible by default, keyboard-toggleable.

- [ ] **Step 3: Verify**

In the Studio tab, generate an outfit. Confirm "Why this?" appears under the reasoning. Click it → panel expands. Tab into it with the keyboard → it's focusable.

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat(why-this): add Why this? chip to Studio outfit result"
```

---

### Task 3.2: "Why this?" capsule on the Concierge

**Files:**
- Modify: `src/App.jsx` (Concierge panel — search for `generateConciergeReply` and the message thread render)

- [ ] **Step 1: Locate the Concierge panel render**

```bash
grep -n "generateConciergeReply\|conciergeMessages\|Atelier Concierge\|Ask the Concierge" src/App.jsx | head -20
```

- [ ] **Step 2: Add a pinned "context capsule" at the top of the Concierge panel**

Inside the Concierge panel, immediately above the message thread, render:
```jsx
<div className="border-b border-stone-200 bg-stone-50 px-4 py-2">
  <details>
    <summary className="cursor-pointer text-[10px] uppercase tracking-widest text-stone-500 hover:underline">
      What the Concierge knows
    </summary>
    <ul className="mt-2 space-y-0.5 text-xs text-stone-600">
      <li>· {items.filter(it => it.status === 'owned' && !it.deletedAt).length} pieces in your wardrobe</li>
      <li>· {savedLooks?.length ?? 0} saved looks</li>
      <li>· Most-worn: {mostWornItems.slice(0, 3).map(it => it.name).join(', ') || '—'}</li>
      {weather && <li>· {weather.temp != null ? `${Math.round(weather.temp)}°C` : 'no forecast'} · {currentSeason}</li>}
      {styleProfile?.stylePalette && <li>· Palette: {styleProfile.stylePalette}</li>}
    </ul>
  </details>
</div>
```

Variable names again: use whatever the Concierge panel already pulls from props/closure. The pattern is the point — surface the same inputs the prompt sees.

- [ ] **Step 3: Verify**

Open the Concierge. Confirm "What the Concierge knows" capsule sits at the top, expandable, accurate to the wardrobe.

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "feat(concierge): add 'What the Concierge knows' context capsule"
```

---

## Task Group 4 — Persistent Concierge Memory (Risk #2)

**Goal:** Concierge conversations currently die on refresh. The marketing site says "reads every wear you've logged, every look you've saved" — a Concierge that forgets the *previous reply* directly undermines that. Persist threads to Firestore so a returning member can continue where they left off.

### File Structure for Task Group 4

| File | Change | Responsibility |
|---|---|---|
| `src/conciergeStore.js` | create | Firestore CRUD for `/users/{uid}/concierge/{threadId}` |
| `src/App.jsx` | modify | Replace in-memory message state with `useConciergeThread()` hook |
| `firestore.rules` | modify | Document the existing wildcard rule covers it (no new rule needed) |

### Task 4.1: Create the concierge persistence module

**Files:**
- Create: `src/conciergeStore.js`

- [ ] **Step 1: Create the module**

```javascript
// src/conciergeStore.js
//
// Persistence for Concierge conversations. Each user has one or more threads.
// In v1 we maintain a single "current" thread per user — multi-thread is a
// nice-to-have that can ship later without a schema change (just write a new
// threadId doc).
//
// Schema:
//   /users/{uid}/concierge/{threadId} {
//     createdAt: serverTimestamp,
//     updatedAt: serverTimestamp,
//     messages: [
//       { role: 'client' | 'stylist', text: string, ts: ISO string }
//     ]
//   }
//
// The full transcript lives in an array on a single doc. Firestore caps a doc
// at 1 MiB; at ~500 chars/turn that is ~2000 turns — far more than any human
// conversation. If we ever approach the cap we'll move to a subcollection
// of message docs; for now array-on-doc is simpler and gives atomic snapshots.

import { db, auth } from './firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

const CURRENT_THREAD_ID = 'current'; // v1: one active thread per user

function threadRef(uid) {
  return doc(db, 'users', uid, 'concierge', CURRENT_THREAD_ID);
}

export async function loadCurrentThread() {
  const uid = auth.currentUser?.uid;
  if (!uid) return { messages: [] };
  try {
    const snap = await getDoc(threadRef(uid));
    if (!snap.exists()) return { messages: [] };
    const data = snap.data();
    return { messages: Array.isArray(data.messages) ? data.messages : [] };
  } catch (err) {
    console.warn('[concierge] load failed:', err?.message || err);
    return { messages: [] };
  }
}

export async function saveCurrentThread(messages) {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  try {
    await setDoc(
      threadRef(uid),
      {
        messages,
        updatedAt: serverTimestamp(),
        createdAt: serverTimestamp(), // setDoc with merge keeps the original if already set
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('[concierge] save failed:', err?.message || err);
  }
}

export async function clearCurrentThread() {
  const uid = auth.currentUser?.uid;
  if (!uid) return;
  try {
    await setDoc(threadRef(uid), { messages: [], updatedAt: serverTimestamp() }, { merge: true });
  } catch (err) {
    console.warn('[concierge] clear failed:', err?.message || err);
  }
}
```

- [ ] **Step 2: Verify the file parses by running the dev server**

```bash
cd "C:/Users/SibylleMoller-Sherwo/Documents/Digital Wardrobe"
npm run dev
```
Vite will surface any syntax error immediately. Stop the server (Ctrl+C) once it boots clean.

- [ ] **Step 3: Commit**

```bash
git add src/conciergeStore.js
git commit -m "feat(concierge): Firestore persistence module for conversation threads"
```

---

### Task 4.2: Wire Concierge UI to the persistent store

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Add the import**

At the top of `src/App.jsx`, add:
```javascript
import { loadCurrentThread, saveCurrentThread, clearCurrentThread } from './conciergeStore';
```

- [ ] **Step 2: Replace in-memory message state**

Find the Concierge panel (`grep -n "conciergeMessages\|conciergeHistory\|setConciergeMessages" src/App.jsx`). Replace the in-memory `useState([])` initializer with a hydrating effect:

```javascript
const [conciergeMessages, setConciergeMessages] = useState([]);
const [conciergeHydrated, setConciergeHydrated] = useState(false);

useEffect(() => {
  if (!user?.uid) return;
  let cancelled = false;
  (async () => {
    const { messages } = await loadCurrentThread();
    if (!cancelled) {
      setConciergeMessages(messages);
      setConciergeHydrated(true);
    }
  })();
  return () => { cancelled = true; };
}, [user?.uid]);
```

- [ ] **Step 3: Persist on every send**

Find where the Concierge appends a new message after Gemini replies. Wrap the state update so each change writes back:

```javascript
async function sendConciergeMessage(text) {
  const userMsg = { role: 'client', text, ts: new Date().toISOString() };
  const optimistic = [...conciergeMessages, userMsg];
  setConciergeMessages(optimistic);
  await saveCurrentThread(optimistic);

  try {
    const reply = await generateConciergeReply({ history: optimistic, /* ...other args... */ });
    const stylistMsg = { role: 'stylist', text: reply, ts: new Date().toISOString() };
    const next = [...optimistic, stylistMsg];
    setConciergeMessages(next);
    await saveCurrentThread(next);
  } catch (err) {
    const errMsg = { role: 'stylist', text: err?.message || 'Sorry — try that again.', ts: new Date().toISOString(), error: true };
    const next = [...optimistic, errMsg];
    setConciergeMessages(next);
    await saveCurrentThread(next);
  }
}
```

The exact signature of `generateConciergeReply` is the one at `src/App.jsx:1335-1401` — pass whatever args it already accepts; the only new thing is `await saveCurrentThread(...)` after every state change.

- [ ] **Step 4: Add a "Start a new thread" affordance**

In the Concierge panel header, add a small button:
```jsx
{conciergeMessages.length > 0 && (
  <button
    onClick={async () => {
      if (!window.confirm('Clear the conversation? This cannot be undone.')) return;
      setConciergeMessages([]);
      await clearCurrentThread();
    }}
    className="text-xs uppercase tracking-widest text-stone-400 hover:text-stone-700"
  >
    New thread
  </button>
)}
```

- [ ] **Step 5: Verify persistence end-to-end**

Run `npm run dev` and sign in (NOT demo mode — demo skips Firestore).
1. Open Concierge. Send "What should I wear today?" → wait for reply.
2. Refresh the page. Reopen Concierge → both messages are still there.
3. Click "New thread" → confirm → messages clear locally.
4. Refresh — thread stays empty.
5. In Firestore console, open `/users/<your-uid>/concierge/current` → confirm the doc exists with the messages array.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "feat(concierge): persist conversation threads to Firestore"
```

---

### Task 4.3: Document the firestore rule coverage

**Files:**
- Modify: `firestore.rules` (only a comment — the existing wildcard already covers the new path)

- [ ] **Step 1: Add a documenting comment near `/users/{uid}/{document=**}`**

Open `firestore.rules`. Find line 52 (`match /users/{uid}/{document=**}`). Above it, append the existing comment with one extra line:

```
    // Each user (owner, invited, or subscriber) gets a private subtree at
    // /users/{uid}/...  Cross-user access is denied.
    //
    // Covers (non-exhaustive): items/, outfits/, inspirations/, schedule/,
    // profile/measurements, aiUsage/, aiUsageMonthly/, concierge/{threadId}.
    match /users/{uid}/{document=**} {
      allow read, write: if canSignIn() && request.auth.uid == uid;
    }
```

No deploy needed (the rule itself is unchanged — only the comment).

- [ ] **Step 2: Commit**

```bash
git add firestore.rules
git commit -m "docs(rules): note concierge/{threadId} is covered by /users/{uid} wildcard"
```

---

## Task Group 5 — Surface Subscription / Trial Status (Risks #18, #19)

**Goal:** The Firestore rules already gate access; what's missing is the UX that tells the user *where they are* in the trial/subscription lifecycle. Add a small status badge and a low-key expiring-soon nudge.

### File Structure for Task Group 5

| File | Change | Responsibility |
|---|---|---|
| `src/subscriptionStatus.js` | create | Hook + helpers: `useSubscriptionStatus()` reads `/subscriberAccess/{uid}` and returns `{ status, currentPeriodEnd, daysRemaining, isTrial }` |
| `src/App.jsx` | modify | Render a status pill in the Profile tab + an in-app banner when `daysRemaining <= 3` |

### Task 5.1: Build the subscription-status hook

**Files:**
- Create: `src/subscriptionStatus.js`

- [ ] **Step 1: Create the file**

```javascript
// src/subscriptionStatus.js
//
// Reads /subscriberAccess/{uid} (written by the Lemon Squeezy webhook in the
// atelier-website repo) and exposes a small reactive hook so the app can
// render trial/subscription state inline.
//
// Owners (sibylle, martin) bypass — they have permanent access via firestore
// rules' isOwner() and don't have a /subscriberAccess doc.
//
// Schema of /subscriberAccess/{uid}:
//   {
//     status: 'trialing' | 'active' | 'cancelled' | 'expired' | 'past_due',
//     currentPeriodEnd: Timestamp,    // when the current paid period ends
//     trialEndsAt?: Timestamp,        // present while status === 'trialing'
//     plan?: 'monthly' | 'annual' | 'founding',
//   }
//
// If the schema in subscriberAccess is different from the above (the webhook
// is authoritative — read it from the atelier-website repo's functions/
// directory), adjust the field names here. The hook structure stays the same.

import { useEffect, useState } from 'react';
import { db, auth } from './firebase';
import { doc, onSnapshot } from 'firebase/firestore';

const OWNER_EMAILS = (import.meta.env.VITE_OWNER_EMAILS || '')
  .split(',')
  .map(s => s.trim().toLowerCase())
  .filter(Boolean);

function daysBetween(future, now) {
  if (!future) return null;
  const ms = future.getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / (24 * 3600 * 1000)));
}

export function useSubscriptionStatus(user) {
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    if (!user?.uid) {
      setState({ loading: false, kind: 'signed-out' });
      return;
    }
    if (OWNER_EMAILS.includes(user.email?.toLowerCase())) {
      setState({ loading: false, kind: 'owner' });
      return;
    }
    const unsub = onSnapshot(
      doc(db, 'subscriberAccess', user.uid),
      (snap) => {
        if (!snap.exists()) {
          // No subscriber doc → must be an invited friend (isInvited rule path)
          setState({ loading: false, kind: 'invited' });
          return;
        }
        const data = snap.data();
        const periodEnd = data.currentPeriodEnd?.toDate?.() || null;
        const trialEnd = data.trialEndsAt?.toDate?.() || null;
        const now = new Date();
        const isTrial = data.status === 'trialing';
        const relevantEnd = isTrial ? trialEnd : periodEnd;
        setState({
          loading: false,
          kind: 'subscriber',
          status: data.status,
          plan: data.plan,
          isTrial,
          trialEndsAt: trialEnd,
          currentPeriodEnd: periodEnd,
          daysRemaining: daysBetween(relevantEnd, now),
        });
      },
      (err) => {
        console.warn('[subscriptionStatus] subscribe failed:', err?.message || err);
        setState({ loading: false, kind: 'unknown' });
      }
    );
    return () => unsub();
  }, [user?.uid, user?.email]);

  return state;
}
```

- [ ] **Step 2: Confirm `.env.local` has `VITE_OWNER_EMAILS`**

```bash
grep VITE_OWNER_EMAILS .env.local 2>/dev/null || grep VITE_OWNER_EMAILS .env.example
```
If neither exists, document in a follow-up — the hook will simply never match `owner` and fall through to the subscriber path. Not a blocker.

- [ ] **Step 3: Commit**

```bash
git add src/subscriptionStatus.js
git commit -m "feat(subscription): useSubscriptionStatus hook reading /subscriberAccess"
```

---

### Task 5.2: Render the subscription pill in Profile

**Files:**
- Modify: `src/App.jsx` (Profile tab render)

- [ ] **Step 1: Locate the Profile tab**

```bash
grep -n "activeTab === 'profile'\|function ProfileView\|Account & subscription" src/App.jsx | head
```

- [ ] **Step 2: Add the import**

At the top of `src/App.jsx`:
```javascript
import { useSubscriptionStatus } from './subscriptionStatus';
```

- [ ] **Step 3: Call the hook + render the pill**

In the top-level App component, near the other hooks:
```javascript
const subStatus = useSubscriptionStatus(user);
```

In the Profile view, add a small "Account" section (if one doesn't already exist near sign-out):

```jsx
<section className="rounded-2xl border border-stone-200 bg-white p-6">
  <p className="text-xs uppercase tracking-widest text-stone-500">Membership</p>
  <SubscriptionPill state={subStatus} />
</section>
```

Add the `SubscriptionPill` component:

```javascript
function SubscriptionPill({ state }) {
  if (state.loading) return <p className="mt-2 text-sm text-stone-400">Checking…</p>;
  if (state.kind === 'owner') {
    return <p className="mt-2 text-sm text-stone-700">Founder access · no renewal.</p>;
  }
  if (state.kind === 'invited') {
    return <p className="mt-2 text-sm text-stone-700">Invited member · access granted by the owner.</p>;
  }
  if (state.kind === 'subscriber') {
    const planLabel = state.plan === 'founding' ? 'Founding member' : state.plan === 'annual' ? 'Annual' : state.plan === 'monthly' ? 'Monthly' : 'Member';
    if (state.isTrial) {
      return (
        <p className="mt-2 text-sm text-stone-700">
          {planLabel} · trial · {state.daysRemaining ?? '—'} day{state.daysRemaining === 1 ? '' : 's'} remaining.
        </p>
      );
    }
    if (state.status === 'cancelled') {
      return (
        <p className="mt-2 text-sm text-stone-700">
          {planLabel} · cancelled · access until {state.currentPeriodEnd?.toLocaleDateString() || '—'}.
        </p>
      );
    }
    return (
      <p className="mt-2 text-sm text-stone-700">
        {planLabel} · active · renews {state.currentPeriodEnd?.toLocaleDateString() || '—'}.
      </p>
    );
  }
  return <p className="mt-2 text-sm text-stone-400">Membership status unavailable.</p>;
}
```

- [ ] **Step 4: Add the expiring-soon banner**

In the top-level app render (above the tab content, or below the header), render a single-line nudge **only** when trial is ending in ≤3 days:

```jsx
{subStatus.kind === 'subscriber' && subStatus.isTrial && subStatus.daysRemaining !== null && subStatus.daysRemaining <= 3 && (
  <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
    Your trial ends in {subStatus.daysRemaining} day{subStatus.daysRemaining === 1 ? '' : 's'}. <a href="https://myatelier.style/pricing" className="underline">Keep your keys.</a>
  </div>
)}
```

This is the **only** trial nudge anywhere in the app. It respects the "no notifications begging you back" promise (no push, no toast spam — one quiet line, dismissible by upgrading).

- [ ] **Step 5: Verify**

If you have a test subscriber account with a near-expiry trial in Firestore, run `npm run dev` and confirm:
- Profile → Membership shows the right line for owner / invited / trial / active / cancelled.
- The amber banner only appears when `isTrial && daysRemaining <= 3`.

If you don't have such an account, manually edit your `/subscriberAccess/{your-uid}` doc in the Firestore console: set `status: 'trialing'`, `trialEndsAt` to 2 days from now → reload the app → banner appears.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "feat(subscription): membership pill + trial-ending nudge"
```

---

## Task Group 6 — Quarterly Manifesto Nudge (Risk #11 part 2)

**Goal:** The marketing copy (after Task 1.2) says "the studio nudges you each season." Implement the in-app side of that promise as a low-key banner on the Profile/Insights screen when the existing manifesto is >90 days old.

### Task 6.1: Render the seasonal nudge

**Files:**
- Modify: `src/App.jsx` (Profile or Insights tab — wherever the manifesto already renders)

- [ ] **Step 1: Locate the manifesto render block**

```bash
grep -n "manifesto\|generateManifestoWithGemini" src/App.jsx | head -15
```
Find where the profile screen shows the manifesto text and the "Generate" / "Regenerate" button.

- [ ] **Step 2: Compute manifesto age**

Near the manifesto render, add:
```javascript
const manifestoUpdatedAt = styleProfile?.manifestoUpdatedAt
  ? (styleProfile.manifestoUpdatedAt.toDate?.() || new Date(styleProfile.manifestoUpdatedAt))
  : null;
const manifestoAgeDays = manifestoUpdatedAt
  ? Math.floor((Date.now() - manifestoUpdatedAt.getTime()) / (24 * 3600 * 1000))
  : null;
const manifestoStale = manifestoAgeDays !== null && manifestoAgeDays >= 90;
```

If `manifestoUpdatedAt` is not yet stored: in `generateManifestoWithGemini` (around `src/App.jsx:1413-1455`), find the line that writes the manifesto field to Firestore. Add `manifestoUpdatedAt: serverTimestamp()` alongside it. Without this field, the nudge will never fire — confirm the write before assuming the banner works.

- [ ] **Step 3: Render the nudge inline**

Above the manifesto text, conditionally render:
```jsx
{manifestoStale && (
  <div className="mb-3 rounded-lg border border-stone-300 bg-stone-50 px-4 py-2 text-sm text-stone-700">
    Your manifesto is {Math.floor(manifestoAgeDays / 30)} months old. A fresh reading?{' '}
    <button
      onClick={() => regenerateManifesto()} // existing handler
      className="font-medium underline hover:no-underline"
    >
      Refresh it
    </button>
  </div>
)}
```

- [ ] **Step 4: Verify**

In Firestore, edit `/users/<your-uid>/profile/measurements` and set `manifestoUpdatedAt` to a date 100 days ago (use the console's date picker). Reload the app → the banner appears. Click "Refresh it" → manifesto regenerates → banner disappears.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "feat(manifesto): 90-day seasonal refresh nudge"
```

---

## Final Verification & Sign-off

### Smoke test — full flow

- [ ] **Step 1: Run both dev servers**

```bash
# Terminal 1
cd "C:/Users/SibylleMoller-Sherwo/Documents/Digital Wardrobe" && npm run dev

# Terminal 2
cd "C:/Users/SibylleMoller-Sherwo/Documents/atelier-website/apps/marketing" && pnpm dev
```

- [ ] **Step 2: Marketing site checks**

Visit the marketing site:
- Home page hero → "Sees the day" reads "The forecast, your day, what is and is not in the wash."
- Manifesto page → cadence section reads "Refresh it whenever you like — the studio nudges you each season."
- About page → "The studio nudges you for a refresh each season."
- Pricing page → "refreshed at your pace."

- [ ] **Step 3: App checks (signed in, NOT demo)**

- Wardrobe tab → Daily Brief card appears, composes on first visit of the day, "Why this?" expands.
- Concierge → send a message, refresh page, message persists. "What the Concierge knows" capsule shows accurate counts.
- Studio → generate an outfit → "Why this?" details element under the reasoning works.
- Profile → "Membership" section shows the correct pill for your account.
- If your subscription status is `trialing` with `trialEndsAt` within 3 days, the amber banner is visible at the top.
- If your manifesto is >90 days old, the seasonal nudge appears above it.

- [ ] **Step 4: Final commit (if any leftover changes)**

```bash
cd "C:/Users/SibylleMoller-Sherwo/Documents/Digital Wardrobe"
git status
# If clean: done.
```

### Out of scope for this plan (deferred to P1/P2)

- Streaming Gemini responses (P1-7) — bigger refactor across multiple AI surfaces
- Per-slot reroll on outfits (P1-8) — needs UI work on the outfit detail
- Travel Capsule promotion (P1-9) — needs a new tab or restructured nav
- Bounding boxes on inspiration analysis (P1-10) — needs prompt schema change
- 30-wears manifesto gating (P1-11) — needs progress meter UI
- Rich wear-event log (P1-12) — schema migration on `wearHistory`
- Quarterly Cloud Function (P2-17) — server-side cron, separate plan
- Google/Apple Calendar OAuth (P2-16) — significant; do **not** undo the copy softening in Task 1.1 until OAuth ships
- Annual Report artefact (P2-15)
- Privacy page wording (P2-18)
- Founder-cohort counter (P2-19)

---

## Self-Review Notes

This plan's six task groups close the four 🔴 risks and the two highest-leverage 🟠 gaps identified in the gap analysis (`Part 1`, items #4, #6, #8 partial, #9, #10 partial, #11, #18, #19, #2). The remaining 🟠 gaps and all 🟡 partials are explicitly deferred above.

Variable names referenced in code blocks (`generateOutfitWithGemini`, `regenerateManifesto`, `aiTemperatureFromPreset`, `setStudioPreloadedOutfit`, `logWearForItemIds`, `saveOutfitAsLook`, `todayISO`, `currentSeason`, `weather`, `styleProfile`, `mostWornItems`, `savedLooks`) all correspond to functionality the gap-analysis explore agent found in `src/App.jsx`. If a name doesn't match exactly, grep for the closest equivalent — every capability is confirmed to exist.

The plan does not introduce a new test framework because none is installed; each task ends with a manual verification step instead. Adding `vitest` would be a worthwhile P2 task on its own but is out of scope here.
