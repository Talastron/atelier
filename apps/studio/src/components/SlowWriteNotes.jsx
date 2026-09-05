import React from 'react';
import { writeTimings, clearWriteTimings, describeWriteTiming, SLOW_WRITE_MS } from '../lib/writeTiming.js';

// What a slow save actually looked like.
//
// Sits beside the build stamp, in the same quiet register and for the same
// reason: nobody comes looking for it, but when something is wrong it answers a
// question that otherwise needs DevTools — and this happens on a phone, where
// there are none.
//
// It exists because a save reported "still syncing" for an item with no photos,
// which the document-size explanation cannot account for. The honest position
// is that the cause is unknown, so this reports measurements and offers no
// diagnosis; the line it renders is deliberately facts-only.
//
// A separate component, not a block inside ProfileView, so its hook cannot end
// up below one of that view's early returns. That is not hypothetical: the same
// mistake with useLookView crashed the Daily Brief this week.
export default function SlowWriteNotes() {
  // Read once per mount. Records only change when a write completes, and by
  // then this screen is not the one you are looking at.
  const [records, setRecords] = React.useState(() => writeTimings());
  if (records.length === 0) return null;

  return (
    <div className="text-center pt-4">
      <p className="text-xs text-stone-400">
        {records.length} slow save{records.length === 1 ? '' : 's'} recorded
        {' '}(over {SLOW_WRITE_MS / 1000}s)
      </p>
      <ul className="mt-1 space-y-0.5">
        {records.slice(0, 5).map((r) => (
          // select-text because the next step is pasting it to whoever is
          // trying to work out what happened.
          <li key={r.at + r.label} className="text-xs text-stone-400 select-text">
            {describeWriteTiming(r)}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => { clearWriteTimings(); setRecords([]); }}
        className="text-xs text-stone-400 underline underline-offset-2 mt-1 hover:text-stone-600"
      >
        Clear
      </button>
    </div>
  );
}
