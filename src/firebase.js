import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider, getToken as getAppCheckToken } from 'firebase/app-check';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut, onAuthStateChanged,
  isSignInWithEmailLink, signInWithEmailLink, sendSignInLinkToEmail,
} from 'firebase/auth';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  collection, doc, addDoc, setDoc, serverTimestamp, increment,
} from 'firebase/firestore';
import { getAI, getGenerativeModel, GoogleAIBackend } from 'firebase/ai';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  // authDomain is intentionally hardcoded (not env-driven) and set to the app's
  // own custom domain rather than <project>.firebaseapp.com.
  //
  // Why: Safari's Intelligent Tracking Prevention (ITP) blocks third-party
  // cookies. With authDomain=firebaseapp.com (different origin from the app at
  // edit.myatelier.style), the Firebase Auth cookies set during Google sign-in's
  // redirect flow are treated as third-party and silently dropped. The auth
  // SUCCEEDS at Google's end but the SDK can't read the resulting session,
  // causing the "sign in → bounce back to sign-in screen" loop on mobile
  // Safari (and increasingly other browsers tightening cross-origin cookies).
  //
  // Using edit.myatelier.style as authDomain makes Firebase Auth a FIRST-PARTY
  // origin to the app. Cookies persist normally. Works in all browsers,
  // including private/incognito modes. The cost: edit.myatelier.style must
  // be in Firebase Auth's authorized domains (it is — added during Phase 1B).
  authDomain: 'edit.myatelier.style',
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

// Demo mode: visitors at ?demo=1 never authenticate or hit Firestore. We still
// have to call initializeApp (a few transitive imports reach `app`) but we
// skip the side-effects: no App Check / reCAPTCHA load (= less network noise
// + no exposure of the reCAPTCHA site key), no auth state subscription, no
// Firestore connection. Keeps the demo network-quiet and harder to abuse.
export const isDemoMode = typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('demo') === '1';

export const app = initializeApp(firebaseConfig);

// ─── App Check ───────────────────────────────────────────────────────────
// Verifies that requests to Firebase services (including AI Logic / Gemini)
// originate from our actual app — not a curl from someone's terminal who
// extracted credentials from the bundle. Backed by reCAPTCHA v3 on web.
//
// Local dev: set `self.FIREBASE_APPCHECK_DEBUG_TOKEN = true` in DevTools
// before page load, copy the printed debug token, and paste it into the
// Firebase Console → App Check → Manage debug tokens. See README.
// Dev: use a STABLE debug token (UUID stored in localStorage) instead of `= true`
// which generates a new random token each page load. With a stable token, you
// register it ONCE in Firebase Console → App Check → Manage debug tokens and it
// works forever — no more "AI broke after I cleared cookies" mystery.
//
// Why this matters: Firebase's `= true` shortcut tells the SDK to mint a fresh
// token at startup and print it to console. That token must be registered in
// the Console to be accepted. If the token is random per session, every fresh
// browser/incognito/cleared-state needs re-registration. A stable token in
// localStorage is registered once and survives.
if (import.meta.env.DEV) {
  const DEBUG_TOKEN_KEY = 'atelier.appCheckDebugToken';
  let debugToken = null;
  try { debugToken = localStorage.getItem(DEBUG_TOKEN_KEY); } catch { /* private mode */ }
  if (!debugToken) {
    debugToken = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `dev-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    try { localStorage.setItem(DEBUG_TOKEN_KEY, debugToken); } catch { /* swallow */ }
  }
  // eslint-disable-next-line no-undef
  self.FIREBASE_APPCHECK_DEBUG_TOKEN = debugToken;
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || '<project-id>';
  console.info(
    `%c[App Check] Debug token (stable, reused across reloads):%c\n  ${debugToken}\n\n` +
    `Register ONCE at: https://console.firebase.google.com/project/${projectId}/appcheck/apps\n` +
    `  → click your web app → ⋮ → Manage debug tokens → Add\n`,
    'font-weight: bold; color: #0a7;',
    'font-family: monospace; color: #444;'
  );
}

// App Check stays ENABLED in demo mode — reCAPTCHA v3 site keys are public by
// design (they ride in every page's DOM), and without an App Check token the
// Gemini calls in the demo Concierge would fail. The existing per-browser
// rate limiter (200 AI calls/day, see RATE_LIMIT_KEY below) is what protects
// the project from demo abuse, not hiding App Check.
let _appCheck = null;
if (import.meta.env.VITE_RECAPTCHA_SITE_KEY) {
  try {
    _appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(import.meta.env.VITE_RECAPTCHA_SITE_KEY),
      isTokenAutoRefreshEnabled: true,
    });

    // Active probe — surfaces config issues IMMEDIATELY at startup instead of
    // waiting for the first AI call to fail. The most common 403 causes are:
    //   1. Dev debug token not registered (dev only — see message above)
    //   2. reCAPTCHA v3 key not enrolled in Firebase Console App Check
    //   3. reCAPTCHA key's allowed domains don't include this origin
    //   4. App Check enforcement on Firebase AI Logic isn't toggled on
    // The probe error message routes the user to the right Console page.
    getAppCheckToken(_appCheck, false).then(
      () => {
        console.info('%c[App Check] ✓ token issued successfully — AI is ready', 'color: #0a7; font-weight: bold;');
        // Late-mounting UI (e.g. AppCheckDevBanner) can subscribe to this.
        try { window.dispatchEvent(new CustomEvent('atelier:appcheck:ok')); } catch { /* swallow */ }
      },
      (err) => {
        const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || '<project-id>';
        const origin = typeof window !== 'undefined' ? window.location.origin : '<unknown>';
        // Remember the failure so a banner mounting AFTER this event still sees it.
        try { window.__atelierAppCheckFailed = true; } catch { /* swallow */ }
        try {
          window.dispatchEvent(new CustomEvent('atelier:appcheck:failed', { detail: { message: err?.message || String(err) } }));
        } catch { /* swallow */ }
        console.error(
          `%c[App Check] ✗ token request failed%c\n  ${err?.message || err}\n\n` +
          `Origin: ${origin}\n\n` +
          `Check each of these in order (most common first):\n` +
          (import.meta.env.DEV
            ? `  1. Did you register the debug token above in Firebase Console?\n     https://console.firebase.google.com/project/${projectId}/appcheck/apps\n`
            : `  1. Is your production domain registered for the reCAPTCHA v3 key?\n     • Firebase Console: https://console.firebase.google.com/project/${projectId}/appcheck/apps → your web app → check the site key\n     • reCAPTCHA admin: https://www.google.com/recaptcha/admin → your key → "Allowed domains" must include "${new URL(origin).hostname}"\n`) +
          `  2. Is App Check enforcement enabled for Firebase AI Logic?\n     https://console.firebase.google.com/project/${projectId}/appcheck/apis\n     (toggle "Firebase AI Logic" to Enforced, or temporarily Unenforced while debugging)\n` +
          `  3. Is the reCAPTCHA v3 site key in .env.local the SAME one shown in App Check → Apps → Web → your app?\n` +
          `     Currently using: ${(import.meta.env.VITE_RECAPTCHA_SITE_KEY || '').slice(0, 12)}…\n` +
          `  4. Has the Firebase project been migrated to the new App Check setup? If your project is old, you may need to re-enroll the web app.\n`,
          'color: #c00; font-weight: bold;',
          'color: #444;'
        );
      }
    );
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

// Sign in with Google.
//
// Try popup first — smooth in-page experience on desktop with popups enabled.
// If the browser blocks the popup (incognito mode, mobile Safari, strict
// ad-blockers, or stricter cross-window policies), fall back to a full-page
// redirect. signInWithRedirect navigates away from the app; after Google
// auth completes the user lands back here and onAuthStateChanged fires with
// the signed-in user — no extra handling needed in the app code.
//
// The fallback covers:
//   auth/popup-blocked            — browser blocked the popup pre-emptively
//   auth/popup-closed-by-user     — user closed the popup before completing
//   auth/cancelled-popup-request  — multiple popups raced; happens on double-click
export const signInWithGoogle = async () => {
  try {
    return await signInWithPopup(auth, googleProvider);
  } catch (err) {
    const fallbackCodes = [
      'auth/popup-blocked',
      'auth/popup-closed-by-user',
      'auth/cancelled-popup-request',
    ];
    if (fallbackCodes.includes(err?.code)) {
      // Returns void (the navigation away kills the promise chain), so the
      // caller's `await` never resolves — the page just navigates.
      return signInWithRedirect(auth, googleProvider);
    }
    throw err;
  }
};

// Magic-link sign-in initiated FROM the app (vs the LS webhook flow).
//
// Used when a paid customer lost their original magic-link email or wants to
// sign in from a fresh device. Pre-stores the email in localStorage so that
// MagicLinkComplete can auto-complete sign-in if they click the link on the
// same browser; otherwise (different device) MagicLinkComplete will prompt
// for the email at click time, which is fine.
//
// Anyone can request a link to any email — that's safe because:
//   1. The link is sent to the email address (only that mailbox owner can click)
//   2. Even if signed in, access to the wardrobe still gates on Firestore rules
//      (isOwner / isInvited / hasActiveSubscription) — random sign-ups land on
//      AccessDenied with a "Start your trial" CTA.
const EMAIL_STORAGE_KEY = 'atelier.signInEmail';
export const sendMagicLink = async (email) => {
  const actionCodeSettings = {
    url: window.location.origin + '/',
    handleCodeInApp: true,
  };
  await sendSignInLinkToEmail(auth, email, actionCodeSettings);
  try { localStorage.setItem(EMAIL_STORAGE_KEY, email); } catch { /* swallow */ }
};

export const signOutUser = () => signOut(auth);
export { onAuthStateChanged, isSignInWithEmailLink, signInWithEmailLink };

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

// ─── Client-side rate limiter ────────────────────────────────────────────
// Per-browser cap on Gemini calls to protect the project's budget from
// runaway loops (e.g. a bug retriggering geminiText on every render) and
// from heavy bursts. Two windows enforced together:
//   - MAX_PER_MINUTE: short burst limit (10 calls/min)
//   - MAX_PER_DAY:    daily ceiling (200 calls/day)
//
// At Gemini 2.5 Flash blended pricing (~$0.005/call), 200/day caps the
// absolute worst-case cost around $1/day even with a runaway loop —
// before Firebase's per-project budget alert ever fires.
//
// Call timestamps live in localStorage so the limit survives reloads.
// Multiple browser tabs share the same log (same origin). Each invited
// user has their own browser, so this is per-browser, not per-project —
// the project-level budget alert is the global ceiling.
const RATE_LIMIT_KEY = 'atelier.aiCallLog';
const MAX_PER_MINUTE = 10;
const MAX_PER_DAY = 200;
const MINUTE_MS = 60_000;
const DAY_MS = 24 * 3600_000;

function readCallLog() {
  try {
    const raw = localStorage.getItem(RATE_LIMIT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function writeCallLog(timestamps) {
  try { localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(timestamps)); }
  catch { /* quota / private mode — fail open */ }
}
function pruneCallLog(timestamps, now) {
  // Only keep entries within the past 24h — that's all we need for the
  // daily count, and prevents the log growing unbounded.
  const dayAgo = now - DAY_MS;
  return timestamps.filter((t) => t > dayAgo);
}
function formatWait(ms) {
  const sec = Math.max(1, Math.ceil(ms / 1000));
  if (sec < 60) return `${sec}s`;
  const min = Math.ceil(sec / 60);
  if (min < 60) return `${min} min`;
  return `${Math.ceil(min / 60)}h`;
}
function checkRateLimit() {
  const now = Date.now();
  const log = pruneCallLog(readCallLog(), now);
  if (log.length >= MAX_PER_DAY) {
    const retryAt = log[0] + DAY_MS;
    throw new Error(`You've reached today's AI limit (${MAX_PER_DAY} calls). It resets in ${formatWait(retryAt - now)}.`);
  }
  const minuteAgo = now - MINUTE_MS;
  const inWindow = log.filter((t) => t > minuteAgo);
  if (inWindow.length >= MAX_PER_MINUTE) {
    const retryAt = inWindow[0] + MINUTE_MS;
    throw new Error(`Slow down — Atelier paces AI calls to keep costs low. Try again in ${formatWait(retryAt - now)}.`);
  }
}
function recordCall() {
  const now = Date.now();
  const log = pruneCallLog(readCallLog(), now);
  log.push(now);
  writeCallLog(log);
}

// ─── Friendly error mapping ──────────────────────────────────────────────
// Gemini SDK errors are dumped as raw HTTP/JSON strings — not what we want
// to put in a toast. This maps the common failure modes to one-sentence
// user-facing messages. Anything unrecognised passes through unchanged so
// we don't accidentally swallow useful info.
function mapGeminiError(err) {
  const msg = String(err?.message || err || '');
  const lower = msg.toLowerCase();

  // Try to pull out Google's retryDelay (e.g. "Please retry in 37.5s." or "retryDelay":"37s")
  const retryMatch = msg.match(/retry in ([\d.]+)\s*s/i)
    || msg.match(/retryDelay["\s:]+["']?(\d+)\s*s/i);
  const retrySec = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) : null;
  const retryHint = retrySec ? ` Try again in ${retrySec}s.` : '';

  if (lower.includes('429') || lower.includes('rate_limit') || lower.includes('quota')) {
    if (lower.includes('per day') || lower.includes('perday')) {
      return new Error(`AI hit today's project-wide request limit. It resets at midnight UTC.${retryHint}`);
    }
    return new Error(`AI is at its rate limit right now.${retryHint || ' Try again in a moment.'}`);
  }
  if (lower.includes('503') || lower.includes('unavailable')) {
    return new Error('AI is briefly offline. Try again in a moment.');
  }
  if (lower.includes('app check') || lower.includes('app-check')) {
    return new Error('Could not verify the app with Firebase. Try refreshing the page.');
  }
  if (lower.includes('not configured') || lower.includes('ai logic') || lower.includes('not enabled')) {
    return new Error('AI is not enabled for this Firebase project. Owner needs to enable Firebase AI Logic.');
  }
  if (lower.includes('permission') || lower.includes('403') || lower.includes('forbidden')) {
    return new Error('AI access denied. Check Firebase App Check and AI Logic configuration.');
  }
  if (lower.includes('model') && (lower.includes('not found') || lower.includes('404') || lower.includes('deprecated'))) {
    return new Error('The AI model is unavailable — it may have been deprecated. Update may be needed.');
  }
  if (lower.includes('network') || lower.includes('failed to fetch') || lower.includes('fetch failed') || lower.includes('offline')) {
    return new Error('Network error reaching AI. Check your connection and try again.');
  }
  if (lower.includes('safety') || lower.includes('blocked')) {
    return new Error("Gemini's safety filter rejected this request. Try rephrasing or a different image.");
  }
  // Fallback — pass through but prefix so the user knows it's an AI error.
  if (msg && msg.length < 200) return new Error(`AI error: ${msg}`);
  return new Error('AI failed unexpectedly. Try again, or refresh the page.');
}

// ─── AI usage tracking ──────────────────────────────────────────────────
// Per-user spend tracking so we can see real cost-per-active-user numbers
// instead of estimating from competitor pricing. Each Gemini call writes:
//   1. A detail doc at /users/{uid}/aiUsage/{autoId} — immutable audit log
//   2. An increment to the monthly rollup at /users/{uid}/aiUsageMonthly/{YYYY-MM}
//      — fast aggregate reads for the admin dashboard
//
// Fire-and-forget — logging failures must never break the user-facing AI
// response. We catch and console.warn so a permission-denied or network
// blip doesn't surface as an error toast.
//
// Token counts come from Firebase AI Logic's usageMetadata if exposed, or
// are estimated at ~4 chars/token (Gemini's typical text ratio). The
// estimate is 80–90% accurate for text and good enough to spot the
// cost outliers, which is the point.

// Gemini pricing per 1M tokens, USD. Source: Google AI pricing, June 2026.
// Update if Google revises rates; existing logged docs keep their original
// estCostUsd values (we don't backfill).
const GEMINI_PRICING = {
  'gemini-2.5-flash': { input: 0.30, output: 2.50 },
  'gemini-2.5-pro':   { input: 1.25, output: 5.00 },
  'gemini-2.0-flash': { input: 0.10, output: 0.40 },
};

function computeAiCost(model, inputTokens, outputTokens) {
  const pricing = GEMINI_PRICING[model] || GEMINI_PRICING['gemini-2.5-flash'];
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
}

function extractTokenCounts(result, promptCharLen, responseCharLen) {
  // Real counts from Gemini if exposed
  const usage = result?.response?.usageMetadata;
  if (usage && Number.isFinite(usage.promptTokenCount) && Number.isFinite(usage.candidatesTokenCount)) {
    return {
      inputTokens: usage.promptTokenCount,
      outputTokens: usage.candidatesTokenCount,
      estimated: false,
    };
  }
  // Fallback estimate (~4 chars/token for text; vision images aren't
  // counted by length — they're handled separately below)
  return {
    inputTokens: Math.ceil(promptCharLen / 4),
    outputTokens: Math.ceil(responseCharLen / 4),
    estimated: true,
  };
}

// Fire-and-forget logger. Never throws — failures are logged to console only.
async function logAiUsage({ feature, model, hasVision, inputTokens, outputTokens, estimated }) {
  const uid = auth.currentUser?.uid;
  if (!uid) return; // not signed in (e.g. App Check trial or local dev) — skip

  const estCostUsd = computeAiCost(model, inputTokens, outputTokens);
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  try {
    // 1. Per-call detail doc
    await addDoc(collection(db, 'users', uid, 'aiUsage'), {
      ts: serverTimestamp(),
      feature,
      model,
      hasVision,
      inputTokens,
      outputTokens,
      estCostUsd,
      estimated,
    });

    // 2. Monthly rollup. setDoc with merge:true deep-merges and applies
    //    FieldValue.increment at any nesting depth, so the byFeature map
    //    builds up correctly across calls.
    await setDoc(
      doc(db, 'users', uid, 'aiUsageMonthly', monthKey),
      {
        totalCalls: increment(1),
        totalInputTokens: increment(inputTokens),
        totalOutputTokens: increment(outputTokens),
        totalEstCostUsd: increment(estCostUsd),
        byFeature: {
          [feature]: {
            calls: increment(1),
            inputTokens: increment(inputTokens),
            outputTokens: increment(outputTokens),
            estCostUsd: increment(estCostUsd),
          },
        },
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    // Never break the AI response on logging failure. Most likely cause
    // is a Firestore rules mismatch (deploy aiUsage rules) or an offline
    // queue. Warn once per session.
    console.warn('[ai-usage] logging failed:', err?.message || err);
  }
}

// Errors that indicate a CONFIG issue (not a real Gemini attempt) — these
// should NOT count toward the rate limit, since the call never reached the
// Gemini API. Without this, a misconfigured App Check causes the auto-compose
// to burn the user's 10/min budget in seconds, locking them out even AFTER
// they fix the config.
function isConfigError(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  return msg.includes('app check') || msg.includes('app-check')
      || msg.includes('not configured') || msg.includes('not enabled')
      || msg.includes('ai logic')
      || /\b(401|403)\b/.test(msg) // pre-mapped HTTP status codes
      || msg.includes('permission') || msg.includes('forbidden')
      || msg.includes('unauthenticated') || msg.includes('unauthorized');
}

// Plain text generation. Returns the model's response string.
// `opts`: { temperature, jsonMode, model }
// `feature`: short identifier for usage tracking (e.g. 'concierge',
// 'suggest-look'). Defaults to 'unlabeled' so existing call sites keep
// working; pass the real label to enable per-feature cost breakdown.
export async function geminiText(prompt, opts = {}, feature = 'unlabeled') {
  checkRateLimit();  // throws with friendly message if exceeded
  try {
    const modelName = opts.model || 'gemini-2.5-flash';
    const ai = getAiSafe();
    const model = getGenerativeModel(ai, {
      model: modelName,
      generationConfig: {
        temperature: opts.temperature ?? 0.7,
        ...(opts.jsonMode ? { responseMimeType: 'application/json' } : {}),
      },
    });
    const result = await model.generateContent(prompt);
    recordCall();  // record only on successful API reach — config errors
                   // throw before this and don't burn rate-limit budget
    const text = result.response.text();

    // Track usage (fire-and-forget — no await, no rejection bubble)
    const promptStr = typeof prompt === 'string' ? prompt : JSON.stringify(prompt);
    const tokens = extractTokenCounts(result, promptStr.length, text.length);
    logAiUsage({
      feature,
      model: modelName,
      hasVision: false,
      inputTokens: tokens.inputTokens,
      outputTokens: tokens.outputTokens,
      estimated: tokens.estimated,
    });

    return text;
  } catch (err) {
    // Real API failures (timeout, 5xx, safety reject) still count — prevents
    // a buggy loop from looking "free". Config errors do NOT count.
    if (!isConfigError(err)) recordCall();
    throw mapGeminiError(err);
  }
}

// Multimodal: prompt + a single image (data URL). Same options as geminiText.
// `feature`: short identifier for usage tracking.
export async function geminiTextVision(prompt, imageDataUrl, opts = {}, feature = 'unlabeled') {
  checkRateLimit();
  try {
    const ai = getAiSafe();
    const match = imageDataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) throw new Error('Image format not recognised.');
    const [, mimeType, data] = match;
    const modelName = opts.model || 'gemini-2.5-flash';
    const model = getGenerativeModel(ai, {
      model: modelName,
      generationConfig: {
        temperature: opts.temperature ?? 0.4,
        ...(opts.jsonMode ? { responseMimeType: 'application/json' } : {}),
      },
    });
    const result = await model.generateContent([
      prompt,
      { inlineData: { mimeType, data } },
    ]);
    recordCall();  // record only on successful API reach
    const text = result.response.text();

    // Track usage. Vision adds non-trivial image tokens — Gemini's
    // usageMetadata accounts for them when present; the estimate
    // fallback adds a flat 258 (Gemini's documented per-image token cost
    // for images up to 384px) to the prompt-char estimate.
    const promptStr = typeof prompt === 'string' ? prompt : JSON.stringify(prompt);
    const tokens = extractTokenCounts(result, promptStr.length, text.length);
    if (tokens.estimated) tokens.inputTokens += 258;
    logAiUsage({
      feature,
      model: modelName,
      hasVision: true,
      inputTokens: tokens.inputTokens,
      outputTokens: tokens.outputTokens,
      estimated: tokens.estimated,
    });

    return text;
  } catch (err) {
    if (!isConfigError(err)) recordCall();
    throw mapGeminiError(err);
  }
}
