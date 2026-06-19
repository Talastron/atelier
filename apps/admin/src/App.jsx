// apps/admin/src/App.jsx
//
// Top-level admin app. Three states:
//
//   1. Loading   — auth state hasn't resolved yet (brief flash)
//   2. SignIn    — no user yet, show Google sign-in
//   3. Denied    — signed in but not in the owner list (defensive UI;
//                  Firestore rules already block reads, but a friendly
//                  message beats a silent black page)
//   4. Dashboard — signed in as owner, render the operator panels
//
// All four states share the same editorial chrome (cream background,
// brand mast). Sign-out is always available top-right once signed in.

import React, { useState, useEffect } from 'react';
import { LogOut, KeyRound, ShieldAlert } from 'lucide-react';
import { auth, signInWithGoogle, signOut, onAuthStateChanged } from './firebase.js';
import { AdminAiUsage } from './AdminAiUsage.jsx';

const OWNER_EMAILS = (import.meta.env.VITE_OWNER_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

function isOwner(user) {
  return !!(user?.email && OWNER_EMAILS.includes(user.email.toLowerCase()));
}

// ─── Top-level app ────────────────────────────────────────────────────
export function App() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState(null);

  useEffect(() => onAuthStateChanged((u) => {
    setUser(u);
    setReady(true);
  }), []);

  async function handleSignIn() {
    setSigningIn(true);
    setSignInError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      // Popup-closed-by-user isn't really an error — quietly reset.
      const msg = String(err?.code || err?.message || err);
      if (!msg.includes('popup-closed') && !msg.includes('cancelled')) {
        setSignInError(err?.message || String(err));
      }
    } finally {
      setSigningIn(false);
    }
  }

  async function handleSignOut() {
    try { await signOut(); } catch { /* ignore */ }
  }

  if (!ready) return <LoadingFrame />;
  if (!user) return <SignInScreen onSignIn={handleSignIn} loading={signingIn} error={signInError} />;
  if (!isOwner(user)) return <AccessDeniedScreen email={user.email} onSignOut={handleSignOut} />;

  return (
    <Shell user={user} onSignOut={handleSignOut}>
      <AdminAiUsage />
    </Shell>
  );
}

// ─── Shared chrome ────────────────────────────────────────────────────
function BrandMast() {
  return (
    <div className="flex items-center justify-center gap-4 mb-6">
      <span aria-hidden="true" className="inline-block" style={{ width: 24, height: '1.5px', background: 'var(--atelier-brass-300)' }} />
      <p
        className="text-[10px] uppercase font-semibold"
        style={{ letterSpacing: '0.32em', color: 'var(--atelier-brass-600)' }}
      >
        Atelier · Operator
      </p>
      <span aria-hidden="true" className="inline-block" style={{ width: 24, height: '1.5px', background: 'var(--atelier-brass-300)' }} />
    </div>
  );
}

// ─── States ───────────────────────────────────────────────────────────
function LoadingFrame() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <p className="text-sm" style={{ color: 'var(--atelier-stone-500)' }}>Loading…</p>
    </main>
  );
}

function SignInScreen({ onSignIn, loading, error }) {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md text-center">
        <BrandMast />
        <h1
          className="mb-3"
          style={{
            fontFamily: 'var(--atelier-font-display)',
            fontSize: 'clamp(1.875rem, 4vw, 2.5rem)',
            lineHeight: 1.05,
            letterSpacing: '-0.015em',
            color: 'var(--atelier-stone-900)',
          }}
        >
          <em style={{ fontWeight: 400 }}>Operator</em> sign-in.
        </h1>
        <p
          className="mb-8 mx-auto"
          style={{ color: 'var(--atelier-stone-500)', maxWidth: '36ch', lineHeight: 1.6 }}
        >
          Founders only. The consumer studio is at{' '}
          <a
            href="https://edit.myatelier.style"
            className="underline"
            style={{ textDecorationColor: 'var(--atelier-brass-300)', color: 'var(--atelier-stone-700)' }}
          >
            edit.myatelier.style
          </a>.
        </p>

        <button
          type="button"
          onClick={onSignIn}
          disabled={loading}
          className="inline-flex items-center gap-2 px-8 py-4 rounded-full text-sm font-semibold transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
          style={{
            background: 'var(--atelier-stone-900)',
            color: '#ffffff',
            letterSpacing: '0.04em',
            boxShadow: '0 12px 32px -10px rgba(28, 25, 23, 0.3)',
          }}
        >
          <KeyRound size={16} strokeWidth={1.75} />
          {loading ? 'Opening…' : 'Sign in with Google'}
        </button>

        {error && (
          <div
            className="mt-6 mx-auto rounded-lg px-4 py-3 text-left"
            style={{
              maxWidth: '40ch',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#991b1b',
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}
      </div>
    </main>
  );
}

function AccessDeniedScreen({ email, onSignOut }) {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md text-center">
        <BrandMast />
        <div className="flex justify-center mb-4">
          <ShieldAlert size={32} strokeWidth={1.5} style={{ color: 'var(--atelier-brass-600)' }} />
        </div>
        <h1
          className="mb-3"
          style={{
            fontFamily: 'var(--atelier-font-display)',
            fontSize: 'clamp(1.625rem, 3.5vw, 2.25rem)',
            lineHeight: 1.1,
            letterSpacing: '-0.01em',
            color: 'var(--atelier-stone-900)',
          }}
        >
          This room isn't for you.
        </h1>
        <p
          className="mb-8 mx-auto"
          style={{ color: 'var(--atelier-stone-500)', maxWidth: '38ch', lineHeight: 1.65 }}
        >
          Signed in as <strong style={{ color: 'var(--atelier-stone-700)' }}>{email}</strong>.
          That email isn't on the operator list. The consumer studio is at{' '}
          <a
            href="https://edit.myatelier.style"
            className="underline"
            style={{ textDecorationColor: 'var(--atelier-brass-300)', color: 'var(--atelier-stone-700)' }}
          >
            edit.myatelier.style
          </a>.
        </p>
        <button
          type="button"
          onClick={onSignOut}
          className="inline-flex items-center gap-2 px-6 py-3 text-sm transition-colors"
          style={{ color: 'var(--atelier-stone-500)' }}
        >
          Sign out <LogOut size={14} strokeWidth={1.6} />
        </button>
      </div>
    </main>
  );
}

function Shell({ user, onSignOut, children }) {
  return (
    <div className="min-h-screen">
      {/* Top bar — slim, brass-accented, operator identity right-aligned */}
      <header
        className="sticky top-0 z-20"
        style={{
          background: 'rgba(247, 245, 242, 0.92)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid var(--atelier-stone-200)',
        }}
      >
        <div className="mx-auto flex items-center justify-between h-16 px-6" style={{ maxWidth: 1280 }}>
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="inline-block" style={{ width: 18, height: '1.5px', background: 'var(--atelier-brass-300)' }} />
            <p
              className="text-[10px] uppercase font-semibold"
              style={{ letterSpacing: '0.32em', color: 'var(--atelier-brass-600)' }}
            >
              Atelier · Operator
            </p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs" style={{ color: 'var(--atelier-stone-500)' }} title={user.email}>
              {user.email}
            </span>
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex items-center gap-1.5 text-xs transition-colors hover:opacity-80"
              style={{ color: 'var(--atelier-stone-700)' }}
              aria-label="Sign out"
            >
              <LogOut size={13} strokeWidth={1.6} />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Content area — centered, generous padding so the dashboard sits
          comfortably on a wide screen */}
      <main className="mx-auto px-6 py-10" style={{ maxWidth: 1280 }}>
        {children}
      </main>
    </div>
  );
}
