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

// --- Reload backstop -----------------------------------------------------
// The in-flight Map below is in-memory, so a HARD PAGE RELOAD mid-compose loses
// it — and since the result is only cached on completion, the reload would fire
// a second (paid) compose. We also persist a lightweight "composing since"
// timestamp so the auto-compose effect can detect a compose that was in flight
// when the page reloaded and skip re-firing, until the marker goes stale (at
// which point the compose clearly never finished and a fresh one is fine).
const COMPOSING_PREFIX = 'atelier.dailyBrief.composing';
function composingKey(uid) { return `${COMPOSING_PREFIX}.${uid || 'anon'}`; }

// `now` is injectable so the staleness window is unit-testable without mocking
// the clock.
export function markComposing(uid, now = Date.now()) {
  try { localStorage.setItem(composingKey(uid), JSON.stringify({ at: now, dateKey: todayKey() })); } catch { /* swallow */ }
}

export function clearComposing(uid) {
  try { localStorage.removeItem(composingKey(uid)); } catch { /* swallow */ }
}

// True if a compose was marked within `windowMs` for TODAY. A marker older than
// the window — or from a previous day — returns false so a fresh compose runs.
export function isComposingRecent(uid, windowMs = 60000, now = Date.now()) {
  try {
    const raw = localStorage.getItem(composingKey(uid));
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (parsed.dateKey !== todayKey()) return false;
    return typeof parsed.at === 'number' && (now - parsed.at) < windowMs;
  } catch {
    return false;
  }
}

// Module-level in-flight tracker. The DailyBriefCard unmounts/remounts
// on every tab navigation (key={activeTab} in DigitalWardrobe), so if a
// compose is still running when the user navigates away, the next mount
// would normally fire a SECOND API call before the first writes to cache.
// This Map keys by uid → the in-flight Promise. New mounts await the
// existing promise; only one API call per (uid, day) ever fires.
const inflight = new Map();

export function getInflightCompose(uid) {
  return inflight.get(uid) || null;
}

// Register an in-flight compose. The returned promise resolves to the
// brief object on success (or rejects on failure); either way the
// inflight entry is cleared.
export function registerInflightCompose(uid, composeFn) {
  if (inflight.has(uid)) return inflight.get(uid);
  markComposing(uid); // persist a reload backstop for the life of this compose
  const p = (async () => {
    try {
      return await composeFn();
    } finally {
      inflight.delete(uid);
      clearComposing(uid);
    }
  })();
  inflight.set(uid, p);
  return p;
}
