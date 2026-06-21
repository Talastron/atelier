// src/AppCheckDevBanner.jsx
//
// Dev-only floating banner that surfaces the App Check debug token + a
// direct registration link in the UI. Lets the user diagnose & fix App Check
// from any device (phone, tablet) without opening DevTools.
//
// Triggers when:
//   - DEV mode (NODE_ENV !== 'production')
//   - VITE_RECAPTCHA_SITE_KEY is configured (App Check is supposed to work)
//   - A `[App Check] ✗ token request failed` event was logged by the active
//     probe in firebase.js (we listen by hijacking console.error temporarily;
//     simpler than passing state across modules)
//
// Dismissible per-session (sessionStorage). Hidden entirely in prod builds.

import { useEffect, useState } from 'react';

const DISMISS_KEY = 'atelier.appCheckBannerDismissed';

export default function AppCheckDevBanner() {
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    if (!import.meta.env.VITE_RECAPTCHA_SITE_KEY) return;
    try { if (sessionStorage.getItem(DISMISS_KEY) === '1') return; } catch { /* swallow */ }

    // The App Check probe in firebase.js fires on module load — possibly BEFORE
    // this effect mounts. So we check both: (a) a flag set on window if the
    // probe already failed, and (b) a future event in case the probe is still
    // in-flight.
    if (typeof window !== 'undefined' && window.__atelierAppCheckFailed) {
      setVisible(true);
    }
    const onFail = () => setVisible(true);
    window.addEventListener('atelier:appcheck:failed', onFail);
    return () => window.removeEventListener('atelier:appcheck:failed', onFail);
  }, []);

  if (!import.meta.env.DEV) return null;
  if (!visible) return null;

  const token = (() => {
    try { return localStorage.getItem('atelier.appCheckDebugToken') || ''; }
    catch { return ''; }
  })();
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || '<project-id>';
  const consoleUrl = `https://console.firebase.google.com/project/${projectId}/appcheck/apps`;

  function copy() {
    if (!token) return;
    try {
      navigator.clipboard.writeText(token);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* swallow */ }
  }

  function dismiss() {
    try { sessionStorage.setItem(DISMISS_KEY, '1'); } catch { /* swallow */ }
    setVisible(false);
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: '#7f1d1d',
        color: '#fef2f2',
        padding: '10px 14px',
        fontSize: '12px',
        lineHeight: 1.45,
        fontFamily: 'system-ui, sans-serif',
        boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
      }}
      role="status"
      aria-live="polite"
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 280px', minWidth: 0 }}>
          <strong style={{ fontWeight: 700 }}>[dev] App Check failed</strong> — AI features won't work until this is fixed.
          <div style={{ marginTop: 6, fontFamily: 'monospace', fontSize: '11px', wordBreak: 'break-all' }}>
            Token: {token || '(none — check console)'}
          </div>
          <div style={{ marginTop: 6 }}>
            <a
              href={consoleUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#fef2f2', textDecoration: 'underline' }}
            >
              Open Firebase Console → App Check
            </a>
            <span style={{ marginLeft: 8, opacity: 0.85 }}>
              → your web app → ⋮ → Manage debug tokens → Add → paste token above
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {token && (
            <button
              type="button"
              onClick={copy}
              style={{
                background: '#fef2f2',
                color: '#7f1d1d',
                border: 'none',
                padding: '6px 10px',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: 600,
              }}
            >
              {copied ? '✓ Copied' : 'Copy token'}
            </button>
          )}
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss"
            style={{
              background: 'transparent',
              color: '#fef2f2',
              border: '1px solid #fca5a5',
              padding: '6px 10px',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: '11px',
            }}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
