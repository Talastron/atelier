import React, { createContext, useContext, useState, useCallback } from 'react';

// --- Toast notifications -------------------------------------------------
// EDITORIAL CARD TOASTS — a luxury app's confirmations shouldn't read
// as utility chrome. Each toast is a small floating card:
//   • brass-rule eyebrow with a short tag (e.g., SAVED, WORN, ERROR)
//   • serif message (display font), display: italic for soft messages
//   • soft layered shadow + warm-white surface
// The shape is the same as a polaroid frame in the rest of the app —
// the toast reads as the same product, not a system alert.
export const ToastContext = createContext({ show: () => {} });
export function useToast() { return useContext(ToastContext); }

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const show = useCallback((message, opts = {}) => {
    const id = Math.random().toString(36).slice(2);
    // opts.eyebrow overrides the auto-derived eyebrow; lets call sites
    // pass 'WORN' or 'SHARED' instead of the default kind-based label.
    const toast = { id, message, kind: opts.kind || 'default', eyebrow: opts.eyebrow || null, duration: opts.duration ?? 2800 };
    setToasts((prev) => [...prev, toast]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), toast.duration);
  }, []);
  // Default eyebrow per kind. Call sites that want something more
  // specific (WORN, SCHEDULED, SAVED) pass { eyebrow: '...' }.
  const eyebrowFor = (t) => t.eyebrow || (
    t.kind === 'error' ? 'ATTENTION'
    : t.kind === 'success' ? 'CONFIRMED'
    : 'NOTED'
  );
  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="fixed left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2.5 items-center pointer-events-none w-full px-4 sm:px-0 sm:w-auto sm:max-w-md"
           style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 6rem)' }}
           aria-live="polite" aria-atomic="true" role="status">
        {toasts.map((t) => {
          const isError = t.kind === 'error';
          return (
            <div key={t.id}
              className={`pointer-events-auto w-full sm:w-auto sm:min-w-[280px] sm:max-w-md rounded-2xl px-5 py-4 backdrop-blur-md animate-in slide-in-from-bottom-3 fade-in duration-300 ring-1 ${
                isError
                  ? 'bg-red-50/95 ring-red-200/70 shadow-[0_2px_8px_rgba(127,29,29,0.08),0_16px_36px_-12px_rgba(127,29,29,0.18)]'
                  : 'bg-white/95 ring-stone-200/70 shadow-[0_2px_8px_rgba(28,25,23,0.06),0_16px_36px_-12px_rgba(28,25,23,0.22)]'
              }`}
              role={isError ? 'alert' : undefined}>
              <div className="flex items-center gap-2.5 mb-1">
                <span className={`inline-block w-4 h-px ${isError ? 'bg-red-400' : 'bg-brass-400'}`} aria-hidden="true" />
                <span className={`text-[9px] tracking-[0.28em] uppercase font-medium ${isError ? 'text-red-600' : 'text-stone-500'}`}>
                  {eyebrowFor(t)}
                </span>
              </div>
              <p className={`font-display text-base leading-tight ${isError ? 'text-red-900' : 'text-stone-900'}`}>
                {t.message}
              </p>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
