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
