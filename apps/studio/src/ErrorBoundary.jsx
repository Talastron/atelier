import React from 'react';

// Top-level safety net. A render error anywhere in the tree would otherwise
// white-screen the whole app (esbuild compiles undefined refs green, so a stray
// reference only throws at runtime — exactly the class of bug this catches).
// We show a calm branded recovery screen instead of a blank page, and a Reload
// that re-mounts from scratch.
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Surfaced in console + (once wired) any error monitor. Kept lightweight —
    // no PII, just the error and the component stack.
    console.error('[ErrorBoundary] render crash:', error, info?.componentStack);
    try { window.__atelierLastError = { message: error?.message, stack: error?.stack }; } catch { /* swallow */ }
  }

  render() {
    if (!this.state.error) return this.props.children;

    const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV;
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center p-6 text-stone-900">
        <div className="max-w-md w-full text-center">
          <div className="h-1 w-16 mx-auto mb-8 rounded-full bg-gradient-to-r from-brass-200 via-brass-400 to-brass-200" aria-hidden="true" />
          <p className="text-[10px] tracking-[0.3em] uppercase text-stone-400 mb-3">Atelier</p>
          <h1 className="font-display text-3xl md:text-4xl tracking-tight mb-4">Something slipped</h1>
          <p className="text-stone-500 text-sm leading-relaxed mb-8">
            An unexpected error interrupted the page. Your wardrobe is safe — nothing was changed. Reloading usually sets it right.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center px-7 py-3.5 rounded-full bg-stone-900 text-white text-sm font-medium hover:bg-stone-700 transition-colors active:scale-[0.98]"
          >
            Reload Atelier
          </button>
          {isDev && this.state.error && (
            <pre className="mt-8 text-left text-[11px] leading-relaxed text-claret-700 bg-white border border-stone-200 rounded-xl p-4 overflow-auto max-h-60 whitespace-pre-wrap">
              {this.state.error.message}
              {'\n\n'}
              {this.state.error.stack}
            </pre>
          )}
        </div>
      </div>
    );
  }
}
