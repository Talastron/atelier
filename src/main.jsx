import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import MagicLinkComplete from './MagicLinkComplete.jsx';
import { auth, isSignInWithEmailLink, isDemoMode } from './firebase.js';

// Mobile viewport fix: pin --app-vh to the actual visible pixel height so
// position:fixed bottom-anchored elements (bottom nav) sit above iOS Safari's
// address bar, not behind it. dvh handles most cases; this is a hard guarantee.
function syncAppVh() {
  const h = window.visualViewport?.height ?? window.innerHeight;
  document.documentElement.style.setProperty('--app-vh', `${h}px`);
}
syncAppVh();
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', syncAppVh);
  window.visualViewport.addEventListener('scroll', syncAppVh);
} else {
  window.addEventListener('resize', syncAppVh);
}

// Detect arrival via a Firebase Auth magic-link email. The webhook handler
// (in the Atelier marketing repo) sends customers a sign-in link after they
// subscribe via Lemon Squeezy; clicking it lands them here with Firebase
// Auth query params. We render the completion view instead of the main App
// so the user can confirm their email and complete sign-in. After success,
// MagicLinkComplete redirects to / which loads App with the signed-in user.
//
// Demo mode short-circuits this — we never want to evaluate the magic link
// for a visitor exploring with ?demo=1 (no auth involved at all).
const isMagicLink = !isDemoMode && isSignInWithEmailLink(auth, window.location.href);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isMagicLink ? <MagicLinkComplete /> : <App />}
  </StrictMode>
);
