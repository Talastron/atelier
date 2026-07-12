// Brief vibration on confirmable actions (save, log-wear, favourite, scan).
// Skipped if the OS reports reduced motion, if the Vibration API isn't
// available, or on desktop where there's no haptic motor. `kind` selects a
// pattern; defaults to a single short tap.
export function haptic(kind = 'tap') {
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  try {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const patterns = {
      tap: 15,
      success: [18, 40, 18],
      error: [50, 80, 50],
    };
    navigator.vibrate(patterns[kind] || patterns.tap);
  } catch { /* iOS Safari may throw — swallow */ }
}
