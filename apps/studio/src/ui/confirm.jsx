import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

// --- Confirmation dialogs ------------------------------------------------
// EDITORIAL CONFIRMS — the app used window.confirm in six places, which draws
// the browser's own grey box: the wrong typeface, the wrong buttons, the
// origin printed above the message, and no relation to anything else on the
// screen. It reads as a system error rather than as this product asking a
// question.
//
// The shape deliberately mirrors ui/toast.jsx — brass-rule eyebrow, display
// serif for the sentence, warm-white surface, layered shadow — because a
// confirmation and a confirmation-of-completion are the same voice at two
// moments, and they should look it.
//
// The API is promise-based on purpose. Every call site read
//     if (!window.confirm('...')) return;
// so a promise lets them become
//     if (!(await confirm({ ... }))) return;
// keeping the control flow, the early return and the diff small. A callback
// API would have inverted all six.
const ConfirmContext = createContext({ confirm: async () => false });
export function useConfirm() { return useContext(ConfirmContext).confirm; }

export function ConfirmProvider({ children }) {
  // { opts, resolve } while a question is on screen, null otherwise. Holding
  // the resolver here is what lets the buttons settle the promise the caller
  // is awaiting.
  const [pending, setPending] = useState(null);
  const cancelRef = useRef(null);
  const restoreFocusRef = useRef(null);

  const confirm = useCallback(
    (opts = {}) => new Promise((resolve) => setPending({ opts, resolve })),
    []
  );

  const settle = useCallback((value) => {
    setPending((p) => {
      if (p) p.resolve(value);
      return null;
    });
  }, []);

  // Escape cancels, and the background stops scrolling while a question is up.
  // Both are things window.confirm gave us for free and a custom dialog has to
  // put back deliberately.
  useEffect(() => {
    if (!pending) return undefined;
    restoreFocusRef.current = document.activeElement;
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); settle(false); }
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Focus lands on Cancel, not Confirm. A keyboard user who hits Enter by
    // reflex should not delete their looks — the safe choice is the one under
    // the finger.
    const t = setTimeout(() => cancelRef.current?.focus(), 0);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      clearTimeout(t);
      if (restoreFocusRef.current instanceof HTMLElement) restoreFocusRef.current.focus();
    };
  }, [pending, settle]);

  const o = pending?.opts || {};
  const destructive = o.tone === 'destructive';

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {pending && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center px-4 animate-in fade-in duration-200"
          // The scrim is the same ink the app uses for text, at low alpha, so
          // the page recedes rather than being greyed out.
          style={{ background: 'rgba(28, 25, 23, 0.42)', backdropFilter: 'blur(2px)' }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) settle(false); }}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            aria-describedby={o.body ? 'confirm-body' : undefined}
            className="w-full sm:max-w-[26rem] rounded-2xl bg-white/97 backdrop-blur-md ring-1 ring-stone-200/70 px-6 py-6 sm:px-7 sm:py-7 animate-in slide-in-from-bottom-3 fade-in duration-300 shadow-[0_2px_8px_rgba(28,25,23,0.06),0_24px_56px_-16px_rgba(28,25,23,0.28)]"
          >
            <div className="flex items-center gap-2.5 mb-2">
              <span
                className={`inline-block w-4 h-px ${destructive ? 'bg-claret-400' : 'bg-brass-400'}`}
                aria-hidden="true"
              />
              <span
                className={`text-xs tracking-eyebrow uppercase font-medium ${destructive ? 'text-claret-700' : 'text-stone-500'}`}
              >
                {o.eyebrow || (destructive ? 'Confirm' : 'One moment')}
              </span>
            </div>

            <h2 id="confirm-title" className="font-display text-xl sm:text-2xl leading-snug text-stone-900">
              {o.title}
            </h2>

            {o.body && (
              <p id="confirm-body" className="mt-2.5 text-sm leading-relaxed text-stone-600">
                {o.body}
              </p>
            )}

            {/* Cancel first in the DOM so tab order reaches the safe action
                first, but visually right-aligned with confirm last — the
                position the eye expects to commit from. */}
            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                ref={cancelRef}
                type="button"
                onClick={() => settle(false)}
                className="px-4 py-2.5 rounded-full text-xs tracking-label uppercase font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-400"
              >
                {o.cancelLabel || 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => settle(true)}
                className={`px-5 py-2.5 rounded-full text-xs tracking-label uppercase font-medium text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                  destructive
                    ? 'bg-claret-700 hover:bg-claret-800 focus-visible:ring-claret-500'
                    : 'bg-stone-900 hover:bg-stone-700 focus-visible:ring-stone-500'
                }`}
              >
                {o.confirmLabel || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
