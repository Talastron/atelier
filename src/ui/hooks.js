import { useState, useEffect } from 'react';

// Closes a modal when the user hits Escape. Mount once per modal — the
// outermost-rendered closes last. Skipped when typing in an input field if
// the user is mid-edit (avoids ejecting them out of a date picker etc).
export function useEscapeKey(onClose) {
  useEffect(() => {
    if (!onClose) return;
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      const t = e.target;
      const tag = t?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      e.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
}

// useCountUp — animates a numeric value from 0 → `target` over `duration` ms
// using requestAnimationFrame + an ease-out curve. Returns the current
// in-flight value (an integer) for direct rendering.
//
// The single most luxury-feeling micro-interaction in the app: stat
// numbers in the Diary header, Insights cards, anywhere they appear
// will count up instead of just snapping into place on view-mount. The
// brain perceives this as 'careful' rather than 'static data'.
//
// Respects prefers-reduced-motion: when the user has opted out of motion,
// the hook returns the target instantly with no animation.
export function useCountUp(target, duration = 800) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const t = Number(target) || 0;
    // Reduced-motion: snap to final value, no animation.
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(t);
      return;
    }
    let raf = 0;
    let start = null;
    const step = (ts) => {
      if (start === null) start = ts;
      const elapsed = ts - start;
      const progress = Math.min(1, elapsed / duration);
      // ease-out cubic — fast at first, settles softly at target
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(t * eased));
      if (progress < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}
