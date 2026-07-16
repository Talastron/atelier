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

// --- Cross-device persistence (Firestore) --------------------------------
// The brief also lives at users/{uid}/state/dailyBrief so every device shows
// the SAME look for the day, and we compose at most once per user per day (not
// once per device). localStorage stays the fast local cache; Firestore is the
// shared source of truth. Firebase is lazy-imported so the pure helpers above
// stay unit-testable without pulling Firebase into the test graph.

export async function readRemoteDailyBrief(uid) {
  if (!uid) return null;
  try {
    const { db } = await import('./firebase.js');
    const { doc, getDoc } = await import('firebase/firestore');
    const snap = await getDoc(doc(db, 'users', uid, 'state', 'dailyBrief'));
    if (!snap.exists()) return null;
    const data = snap.data();
    if (data?.dateKey !== todayKey()) return null; // stale (a previous day)
    return data;
  } catch {
    return null; // offline / permission — caller falls back to a local compose
  }
}

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
