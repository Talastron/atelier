// src/UpdatePrompt.jsx
//
// Tells the wearer when a newer version of the app is waiting, and lets them
// take it when it suits.
//
// Background: the service worker is registered with `registerType: 'prompt'`
// (vite.config.js). A new worker installs in the background and then waits
// rather than activating, so the running session is never swapped out from
// underneath someone mid-edit. Nothing changes until the wearer accepts here.

import { useRegisterSW } from 'virtual:pwa-register/react';

// How often a long-lived session re-checks for a new worker.
//
// This interval is the whole reason the prompt is reachable on a phone. An
// installed PWA is backgrounded rather than closed, so it can run for days
// without a page load — and without a page load the browser never re-fetches
// sw.js on its own. The users most likely to be running stale code are exactly
// the ones who would otherwise never be told.
const UPDATE_CHECK_MS = 60 * 60 * 1000;

export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      setInterval(() => {
        // A failed check is not worth surfacing — offline is the usual cause,
        // and the next tick will try again.
        registration.update().catch(() => {});
      }, UPDATE_CHECK_MS);
    },
  });

  if (!needRefresh) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      // bottom-24 clears the fixed bottom nav on mobile; sm:bottom-6 sits it
      // back down on wider screens where the nav isn't anchored there.
      className="fixed inset-x-0 bottom-24 sm:bottom-6 z-[60] flex justify-center px-4 pointer-events-none"
    >
      <div className="pointer-events-auto flex items-center gap-4 rounded-full bg-stone-900 text-white pl-5 pr-2 py-2 shadow-lg">
        <p className="text-sm">A new version is ready.</p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => updateServiceWorker(true)}
            className="rounded-full bg-white text-stone-900 text-sm font-medium px-4 py-1.5 hover:bg-stone-100 transition-colors"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setNeedRefresh(false)}
            // Dismissal lasts for this session only. There is no "don't show
            // again": the cost of running old code compounds quietly, so the
            // prompt returns next time the app starts.
            className="rounded-full text-stone-400 hover:text-white text-sm px-3 py-1.5 transition-colors"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
}
