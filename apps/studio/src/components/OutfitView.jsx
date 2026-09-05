import React, { useState, useCallback } from 'react';
import ViewToggle from '../ui/ViewToggle.jsx';
import OutfitFlatLay from './OutfitFlatLay.jsx';
import OutfitGrid from './OutfitGrid.jsx';
import { normaliseLookView, LOOK_VIEW_KEY } from '../lib/viewPreference.js';

// One look, shown the way the reader prefers — composition or grid — with the
// control that switches between them.
//
// The look detail owned this arrangement inline and the Daily Brief had no
// choice at all. Both now render the same component, so the two surfaces
// cannot drift apart the way the two toggles already had.
//
// The preference is remembered, and shared between the two single-look
// surfaces. The Lookbook keeps its own key: see lib/viewPreference.js for why
// those are different questions.
export function useLookView() {
  const [view, setView] = useState(() => {
    try {
      return normaliseLookView(localStorage.getItem(LOOK_VIEW_KEY));
    } catch {
      return 'flatlay'; // private browsing, or storage disabled
    }
  });
  const choose = useCallback((next) => {
    setView(normaliseLookView(next));
    try { localStorage.setItem(LOOK_VIEW_KEY, next); } catch { /* not worth surfacing */ }
  }, []);
  return [view, choose];
}

export default function OutfitView({ pieces = [], onOpenItem, paletteFilter = null, toggleLabel = 'Look view' }) {
  const [view, choose] = useLookView();

  return (
    <div>
      <div className="flex justify-end mb-3">
        <ViewToggle value={view} onChange={choose} label={toggleLabel} />
      </div>
      {view === 'flatlay' ? (
        <OutfitFlatLay pieces={pieces} onOpenItem={onOpenItem} paletteFilter={paletteFilter} />
      ) : (
        <OutfitGrid pieces={pieces} onOpenItem={onOpenItem} />
      )}
    </div>
  );
}
