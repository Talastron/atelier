// src/lib/brief.js
import { noteIsStale } from './lookNote.js';

/**
 * The brief as it stands after an edit in the Styling Studio.
 *
 * Drops the stylist's note when it names a piece the look no longer holds.
 * The Brief renders that note with tappable item chips, so a stale one does
 * not just read oddly — it offers a chip for a garment that is not there.
 * The Studio already applies this rule when saving a look; the Brief needs it
 * more, for that reason.
 *
 * Everything else on the brief is preserved, including fields added later:
 * this amends a brief, it does not rebuild one.
 */
export function amendBrief(brief, itemIds, note) {
  const ids = Array.isArray(itemIds) ? itemIds : [];
  const next = { ...(brief || {}), itemIds: ids };
  if (note && !noteIsStale(note, ids)) next.reasoning = note;
  else delete next.reasoning;
  return next;
}
