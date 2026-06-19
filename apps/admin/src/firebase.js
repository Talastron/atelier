// apps/admin/src/firebase.js
//
// Firebase client for the admin app. Same project as the consumer app
// (my-digital-wardrobe-444d0), but a much smaller surface area:
//
//   - Auth only (Google sign-in popup) — no magic link, no email/password
//   - Firestore for reads — no writes, ever
//   - NO App Check / reCAPTCHA — admin traffic is owner-only, low volume,
//     and the Firestore rules (isOwner) are the actual security boundary
//   - NO AI / Gemini wrappers — the admin app never calls AI
//   - NO offline persistence — admin sessions are short and online
//
// authDomain: set to edit.myatelier.style for first-party-cookie consistency
// with the consumer app (same Safari ITP trick — see consumer app's
// firebase.js for the full reasoning). admin.myatelier.style must be added
// to Firebase Auth's authorized domains.

import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged as fbOnAuthStateChanged,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: 'edit.myatelier.style',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Warn early if config is missing — admin sessions usually start from a
// cold browser tab and a missing env var would otherwise fail with an
// opaque Firebase error.
const missing = Object.entries(firebaseConfig).filter(([, v]) => !v).map(([k]) => k);
if (missing.length) {
  console.error(
    `[admin firebase] Missing config keys: ${missing.join(', ')}. ` +
    `Copy .env.example to .env.local and fill in values from your Firebase project settings.`
  );
}

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

const googleProvider = new GoogleAuthProvider();
// "select_account" forces the Google account picker every time — useful
// for an operator UI where the founder might have multiple Google accounts
// signed into the browser and needs to choose the right one.
googleProvider.setCustomParameters({ prompt: 'select_account' });

export async function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

export function signOut() {
  return fbSignOut(auth);
}

export function onAuthStateChanged(callback) {
  return fbOnAuthStateChanged(auth, callback);
}
