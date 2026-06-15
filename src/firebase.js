import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getAI, getGenerativeModel, GoogleAIBackend } from 'firebase/ai';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const missing = Object.entries(firebaseConfig).filter(([, v]) => !v).map(([k]) => k);
if (missing.length) {
  console.warn(
    `[firebase] Missing config keys: ${missing.join(', ')}. ` +
    `Copy .env.example to .env.local and fill in values from your Firebase project settings.`
  );
}

export const app = initializeApp(firebaseConfig);

// ─── App Check ───────────────────────────────────────────────────────────
// Verifies that requests to Firebase services (including AI Logic / Gemini)
// originate from our actual app — not a curl from someone's terminal who
// extracted credentials from the bundle. Backed by reCAPTCHA v3 on web.
//
// Local dev: set `self.FIREBASE_APPCHECK_DEBUG_TOKEN = true` in DevTools
// before page load, copy the printed debug token, and paste it into the
// Firebase Console → App Check → Manage debug tokens. See README.
if (import.meta.env.DEV) {
  // eslint-disable-next-line no-undef
  self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}
if (import.meta.env.VITE_RECAPTCHA_SITE_KEY) {
  try {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(import.meta.env.VITE_RECAPTCHA_SITE_KEY),
      isTokenAutoRefreshEnabled: true,
    });
  } catch (err) {
    console.warn('[firebase] App Check init failed — AI features will be unavailable:', err?.message);
  }
} else {
  console.warn(
    '[firebase] No VITE_RECAPTCHA_SITE_KEY configured. App Check is disabled — ' +
    'AI features will fail until you set up reCAPTCHA v3. See README for steps.'
  );
}

export const auth = getAuth(app);

// Offline persistence + multi-tab handling. Lets the app load the cached
// wardrobe instantly (no spinner) and queues writes when offline.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

const googleProvider = new GoogleAuthProvider();
export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);
export const signOutUser = () => signOut(auth);
export { onAuthStateChanged };

// ─── Gemini via Firebase AI Logic ────────────────────────────────────────
// Uses the Google AI (Gemini Developer API) backend — free tier, no API key
// in the client bundle. App Check guarantees only our real app can call it.
// Falls back to throwing a clear error if AI Logic isn't enabled in the
// Firebase Console (which users see as "AI is not configured").
let _ai = null;
function getAiSafe() {
  if (_ai) return _ai;
  try {
    _ai = getAI(app, { backend: new GoogleAIBackend() });
    return _ai;
  } catch (err) {
    throw new Error(
      'Firebase AI Logic is not configured. In the Firebase Console go to ' +
      'Build → AI Logic → Get started, choose the Google AI (Gemini Developer API) backend.'
    );
  }
}

export const isAIEnabled = () => !!import.meta.env.VITE_RECAPTCHA_SITE_KEY;

// Plain text generation. Returns the model's response string.
// `opts`: { temperature, jsonMode, model }
export async function geminiText(prompt, opts = {}) {
  const ai = getAiSafe();
  const model = getGenerativeModel(ai, {
    model: opts.model || 'gemini-2.5-flash',
    generationConfig: {
      temperature: opts.temperature ?? 0.7,
      ...(opts.jsonMode ? { responseMimeType: 'application/json' } : {}),
    },
  });
  const result = await model.generateContent(prompt);
  return result.response.text();
}

// Multimodal: prompt + a single image (data URL). Same options as geminiText.
export async function geminiTextVision(prompt, imageDataUrl, opts = {}) {
  const ai = getAiSafe();
  const match = imageDataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error('Image format not recognised.');
  const [, mimeType, data] = match;
  const model = getGenerativeModel(ai, {
    model: opts.model || 'gemini-2.5-flash',
    generationConfig: {
      temperature: opts.temperature ?? 0.4,
      ...(opts.jsonMode ? { responseMimeType: 'application/json' } : {}),
    },
  });
  const result = await model.generateContent([
    prompt,
    { inlineData: { mimeType, data } },
  ]);
  return result.response.text();
}
