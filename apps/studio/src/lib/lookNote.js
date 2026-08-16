// src/lib/lookNote.js
//
// The Concierge's note about a look is prose written for one particular set of
// garments, and it names them with <<item:ID|Name>> markers that ItemChip
// resolves at render time. Swap a piece and the prose does not follow — it goes
// on describing a garment that has left the look, and the chip renders that
// garment as though it were still there.
//
// The staleness test here is deliberately narrow: a note is stale when it names
// a garment that is no longer present, not merely when the look has changed
// at all. Adding a scarf leaves the note incomplete but still true; replacing
// the shorts makes it false. Only falsehood is worth interrupting someone over,
// and a marker that fires on every edit would quickly be ignored.

// Must stay in step with the marker syntax parsed in components/ItemChip.jsx.
// If one changes, the other has to.
const ITEM_MARKER_RE = /<<item:([^|>]+)\|([^>]+)>>/g;

/**
 * The item IDs a note explicitly names.
 * @param {string} note  Concierge prose, possibly containing item markers.
 * @returns {string[]}   IDs in order of appearance; empty for prose with none.
 */
export function referencedItemIds(note) {
  if (!note || typeof note !== 'string') return [];
  // matchAll clones the regex, so the module-level `g` flag carries no
  // lastIndex state between calls.
  return Array.from(note.matchAll(ITEM_MARKER_RE), (match) => match[1]);
}

/**
 * Does this note describe a look that no longer exists?
 *
 * @param {string} note              Concierge prose.
 * @param {string[]} presentItemIds  IDs currently in the look.
 * @returns {boolean}                True when the note names an absent garment.
 */
export function noteIsStale(note, presentItemIds = []) {
  const referenced = referencedItemIds(note);
  // Prose naming nothing specific cannot contradict the look it sits under.
  if (referenced.length === 0) return false;
  const present = new Set(presentItemIds);
  return referenced.some((id) => !present.has(id));
}
