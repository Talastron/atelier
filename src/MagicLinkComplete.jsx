import React, { useState, useEffect, useRef } from 'react';
import { auth, signInWithEmailLink } from './firebase.js';

// LocalStorage key — matches what the marketing site / webhook handler can
// pre-set if the customer signed up on the same device. Most of the time the
// email isn't there (sign-up was on a different device than the magic-link
// click), so we just prompt for it.
const EMAIL_STORAGE_KEY = 'atelier.signInEmail';

// AtelierMark — duplicated from App.jsx so this component stands alone
// without dragging in the full App imports. Same SVG, same colors.
function AtelierMark({ size = 88 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="256" height="256" fill="#1c1917" rx="56" />
      <g fill="none" stroke="#F7F5F2" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M 160 60 Q 160 44 144 44 Q 128 44 128 58 L 128 110" />
        <path d="M 128 110 L 62 184 L 194 184 Z" />
      </g>
      <line x1="128" y1="184" x2="128" y2="206" stroke="#D4B378" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
      <circle cx="128" cy="212" r="5" fill="#D4B378" />
    </svg>
  );
}

/**
 * Completes a Firebase Auth magic-link sign-in.
 *
 * URL on entry looks like:
 *   https://edit.myatelier.style/?apiKey=…&oobCode=…&mode=signIn&continueUrl=…
 *
 * Firebase's signInWithEmailLink() needs the email the link was sent to
 * (anti-hijack safety net). If we have it in localStorage from the same
 * device, we sign in automatically; otherwise we prompt.
 *
 * On success: redirect to / so the main App.jsx loads fresh with the now
 * signed-in user (cleanest state-reset, no risk of stale magic-link params).
 */
export default function MagicLinkComplete() {
  const [email, setEmail] = useState(() => {
    try { return localStorage.getItem(EMAIL_STORAGE_KEY) || ''; } catch { return ''; }
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const autoTriedRef = useRef(false);

  // If email is already known from localStorage, try the sign-in automatically
  // on mount. Otherwise wait for the user to enter it.
  useEffect(() => {
    if (email && !autoTriedRef.current) {
      autoTriedRef.current = true;
      doSignIn(email);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function doSignIn(emailToUse) {
    setBusy(true);
    setError(null);
    try {
      await signInWithEmailLink(auth, emailToUse, window.location.href);
      try { localStorage.removeItem(EMAIL_STORAGE_KEY); } catch { /* swallow */ }
      // Replace (not push) so back button doesn't take user to an expired
      // magic-link URL. Forces a fresh load of App.jsx with signed-in state.
      window.location.replace('/');
    } catch (err) {
      const code = err?.code;
      let msg;
      if (code === 'auth/invalid-action-code') {
        msg = 'This sign-in link has expired or already been used. Open the most recent email we sent you, or write to contact@myatelier.style for a new one.';
      } else if (code === 'auth/invalid-email') {
        msg = "That doesn't look like the email this link was sent to. Please try again with the email you used at checkout.";
      } else if (code === 'auth/argument-error') {
        msg = 'This sign-in link is malformed. Please open it directly from your email rather than copy-pasting.';
      } else {
        msg = err?.message || 'Sign-in failed. Please try again or write to contact@myatelier.style.';
      }
      setError(msg);
      setBusy(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!email || busy) return;
    try { localStorage.setItem(EMAIL_STORAGE_KEY, email); } catch { /* swallow */ }
    doSignIn(email);
  }

  // Visual contract matches App.jsx's SignInScreen exactly — cream background,
  // hanger logo, Playfair "Atelier." wordmark, dark pill button.
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Jost:wght@300;400;500;600&family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400&display=swap');
        .font-display { font-family: 'Playfair Display', serif; }
        .font-sans { font-family: 'Jost', sans-serif; }
        body { background-color: #F7F5F2; }
      `}</style>
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F7F5F2] px-6 font-sans">
        <div className="mb-8"><AtelierMark size={88} /></div>
        <h1 className="text-5xl font-display font-medium tracking-wide mb-3 text-stone-900">Atelier.</h1>

        {busy && !error ? (
          <p className="text-stone-500 text-sm tracking-wide mt-4">Signing you in…</p>
        ) : (
          <>
            <p className="text-stone-500 text-sm tracking-wide mb-10 text-center max-w-sm">
              Confirm the email address this link was sent to.
            </p>

            <form onSubmit={handleSubmit} className="w-full max-w-sm flex flex-col gap-3">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                disabled={busy}
                autoFocus
                autoComplete="email"
                className="w-full px-5 py-4 bg-white border border-stone-200 rounded-full text-sm text-stone-900 placeholder:text-stone-400 focus:border-stone-900 focus:outline-none disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!email || busy}
                className="w-full bg-stone-900 text-white px-10 py-4 rounded-full font-medium hover:bg-stone-700 transition-all shadow-lg disabled:opacity-50"
              >
                {busy ? 'Signing in…' : 'Continue'}
              </button>
            </form>

            {error && (
              <p className="mt-6 text-xs text-red-700 max-w-sm text-center leading-relaxed">{error}</p>
            )}
          </>
        )}
      </div>
    </>
  );
}
