// src/lib/aiSession.js
//
// A gentle, session-scoped "you've regenerated a lot" nudge. This is NOT a cost
// control — the per-user MONTHLY cap (firebase.js) is the real ceiling. This
// only steers heavy re-rollers toward SAVING a look they like instead of
// composing endlessly. In-memory and per page-session: a reload starts fresh,
// which is deliberately forgiving (a premium product should never feel stingy).
//
// Counts user-initiated REGENERATIONS — "Compose another", "Suggest another",
// travel re-rolls — not the first compose a user explicitly asks for.

let _regen = 0;

// After this many regenerations in one session, regenerate buttons surface a
// quiet "save one you love?" hint. Tuned high enough that normal exploration
// never sees it; low enough to catch the 20th identical re-roll.
export const REGEN_SOFT_LIMIT = 8;

export function bumpRegen() {
  _regen += 1;
  return _regen;
}

export function regenCount() {
  return _regen;
}

export function softNudgeActive() {
  return _regen >= REGEN_SOFT_LIMIT;
}
