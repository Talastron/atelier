import { initializeApp } from 'firebase/app';
import { initializeAppCheck, ReCaptchaV3Provider, getToken as getAppCheckToken } from 'firebase/app-check';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, signOut, onAuthStateChanged,
  isSignInWithEmailLink, signInWithEmailLink, sendSignInLinkToEmail,
} from 'firebase/auth';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  collection, doc, addDoc, setDoc, getDoc, serverTimestamp, increment,
  getCountFromServer,
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

// ─── Per-user daily Concierge cap ────────────────────────────────────────
// Firestore-backed daily call count per signed-in user. Two reasons this
// matters more than the client-side localStorage limiter above:
//
//   1. Project-wide protection at multi-user scale. Firebase AI Logic
//      quotas (RPM / RPD / TPM) are PROJECT-WIDE, not per-user. Without
//      a per-user cap, a single user's runaway browser (or a deliberate
//      abuser) can drain the project's RPD allocation, blocking AI for
//      EVERY other user. This cap means each user's blast radius is
//      capped at USER_DAILY_CAP — predictable, fair, billable.
//
//   2. Unit economics. At ~£0.0016 per call blended Gemini 2.5 Flash
//      pricing, USER_DAILY_CAP = 75 means worst-case £0.12/user/day,
//      or ~£43/user/year. Well under the £79 founding-tier revenue
//      after Lemon Squeezy fees + VAT. Without a cap, a power user
//      doing 500+ calls/day could wipe their entire subscription
//      margin in a single month.
//
// Hydrated once at auth-state-change from the existing aiUsageMonthly
// rollup doc (which logAiUsage already writes). No extra Firestore
// reads per AI call — count lives in module memory after first load,
// kept in sync by local increments. Worst case after a fresh login the
// in-memory count is stale by a few calls (if user had calls from
// another session same day); that's acceptable slop.
const USER_DAILY_CAP = 75;
let _userDailyCount = null;        // null = not hydrated yet → fail-open
let _userDailyCountDate = null;    // YYYY-MM-DD this count was scoped to
let _userDailyCountUid = null;     // uid the count belongs to

function localISODate(d) {
  // UTC date — matches what we write to byDay.{key} in the rollup, and
  // matches Google's quota reset window (midnight UTC).
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

async function loadUserDailyCount() {
  const user = auth.currentUser;
  if (!user?.uid) { _userDailyCount = 0; _userDailyCountUid = null; return; }
  const today = localISODate(new Date());
  const monthKey = today.slice(0, 7);
  try {
    const snap = await getDoc(doc(db, 'users', user.uid, 'aiUsageMonthly', monthKey));
    const data = snap.data() || {};
    _userDailyCount = data.byDay?.[today] || 0;
    _userDailyCountDate = today;
    _userDailyCountUid = user.uid;
  } catch (err) {
    // Failed read (offline, rules, etc.) — fail open with 0 count so a
    // logging glitch doesn't lock the user out entirely.
    console.warn('[ai-cap] could not load daily count:', err?.message || err);
    _userDailyCount = 0;
    _userDailyCountDate = today;
    _userDailyCountUid = user.uid;
  }
}

// Hydrate on every auth state change. Re-hydrates when user signs out + in,
// or switches accounts (incognito test pattern).
onAuthStateChanged(auth, (user) => {
  if (!user) {
    _userDailyCount = null;
    _userDailyCountDate = null;
    _userDailyCountUid = null;
    return;
  }
  loadUserDailyCount();
});

function checkUserDailyCap() {
  const user = auth.currentUser;
  if (!user?.uid) return; // demo / unsigned — fail open, client-side cap handles burst protection
  // Roll over at UTC midnight without needing another Firestore read
  const today = localISODate(new Date());
  if (_userDailyCountDate && _userDailyCountDate !== today) {
    _userDailyCount = 0;
    _userDailyCountDate = today;
  }
  // Different user logged in than we hydrated — re-hydrate next call
  if (_userDailyCountUid && _userDailyCountUid !== user.uid) {
    _userDailyCount = null;
    _userDailyCountUid = null;
    loadUserDailyCount(); // fire-and-forget, fail open this call
    return;
  }
  if (_userDailyCount === null) return; // not hydrated yet → fail open
  if (_userDailyCount >= USER_DAILY_CAP) {
    throw new Error(`You've used today's Concierge allocation (${USER_DAILY_CAP} compositions). It resets at midnight UTC.`);
  }
}

function recordUserCall() {
  if (_userDailyCount !== null) _userDailyCount += 1;
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
      return new Error(`Atelier has hit today's Concierge request limit. It resets at midnight UTC.${retryHint}`);
    }
    return new Error(`The Concierge is at its rate limit right now.${retryHint || ' Try again in a moment.'}`);
  }
  if (lower.includes('503') || lower.includes('unavailable')) {
    return new Error('The Concierge is briefly offline. Try again in a moment.');
  }
  if (lower.includes('app check') || lower.includes('app-check')) {
    return new Error('Could not verify the app with Firebase. Try refreshing the page.');
  }
  if (lower.includes('not configured') || lower.includes('ai logic') || lower.includes('not enabled')) {
    return new Error('Concierge is not yet set up for this Firebase project. Owner needs to enable Firebase AI Logic.');
  }
  if (lower.includes('permission') || lower.includes('403') || lower.includes('forbidden')) {
    return new Error('Concierge access denied. Check Firebase App Check and AI Logic configuration.');
  }
  if (lower.includes('model') && (lower.includes('not found') || lower.includes('404') || lower.includes('deprecated'))) {
    return new Error('The Concierge model is unavailable — it may have been deprecated. Update may be needed.');
  }
  if (lower.includes('network') || lower.includes('failed to fetch') || lower.includes('fetch failed') || lower.includes('offline')) {
    return new Error('Network error reaching the Concierge. Check your connection and try again.');
  }
  if (lower.includes('safety') || lower.includes('blocked')) {
    return new Error("The Concierge's safety filter rejected this request. Try rephrasing or a different image.");
  }
  // Fallback — pass through but prefix so the user knows it's a Concierge error.
  if (msg && msg.length < 200) return new Error(`Concierge error: ${msg}`);
  return new Error('The Concierge failed unexpectedly. Try again, or refresh the page.');
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
    //
    //    byDay.{YYYY-MM-DD} is also incremented — this is what the
    //    per-user daily cap (checkUserDailyCap) reads back on hydration
    //    after a fresh sign-in. Without this field the cap can't be
    //    enforced across browser sessions.
    const todayKey = localISODate(now);
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
        byDay: {
          [todayKey]: increment(1),
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
  checkRateLimit();      // per-browser burst limit
  checkUserDailyCap();   // per-user daily cap (Firestore-backed)
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
    recordCall();        // record only on successful API reach — config
                         // errors throw before this and don't burn budget
    recordUserCall();    // increment the per-user in-memory counter
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

// Streaming variant of geminiText. Calls onChunk(text) as fragments arrive
// from the model. Returns the fully-accumulated text after the stream
// completes. Use this for free-form text replies (Concierge, Manifesto,
// wardrobe audit narrative) — NOT for jsonMode calls (the JSON is only
// valid when whole; partial chunks aren't parseable). Single Firebase AI
// Logic round-trip; streaming just delivers the tokens incrementally as
// the model produces them, so first text appears in ~200ms instead of the
// 3-5s blocking wait of generateContent.
//
// `onChunk` is optional — if not provided, the function still returns the
// final string but with no per-chunk callback (degrades to "I waited for
// the whole reply" behaviour, useful for callers that want to opt out of
// streaming UI without changing the call site signature).
export async function geminiTextStream(prompt, opts = {}, feature = 'unlabeled', onChunk = null) {
  checkRateLimit();      // per-browser burst limit (same as geminiText)
  checkUserDailyCap();   // per-user daily cap (same as geminiText)
  try {
    const modelName = opts.model || 'gemini-2.5-flash';
    const ai = getAiSafe();
    const model = getGenerativeModel(ai, {
      model: modelName,
      generationConfig: {
        temperature: opts.temperature ?? 0.7,
        // Cap reply length. The Concierge / Manifesto / Wardrobe Audit
        // wrappers all use this stream; ~1024 tokens (~768 words) is plenty
        // for any of those surfaces and prevents runaway long replies.
        // Callers can override via opts.maxOutputTokens for narrative-heavier
        // calls (manifesto can use a higher cap if needed).
        maxOutputTokens: opts.maxOutputTokens ?? 1024,
        // Disable Gemini 2.5 Flash's thinking phase. Thinking emits ZERO
        // tokens for 20-60s on complex prompts, which reads to the user as
        // a frozen Concierge. Conversational replies don't need it; if a
        // caller specifically wants thinking (deep analysis), it can pass
        // opts.thinkingBudget explicitly.
        //
        // PLACEMENT NOTE: thinkingConfig belongs INSIDE generationConfig per
        // the Gemini API + Firebase AI Logic SDK shape. At top-level on the
        // model config it's silently ignored.
        thinkingConfig: {
          thinkingBudget: opts.thinkingBudget ?? 0,
        },
        // NOTE: jsonMode intentionally omitted — partial JSON chunks
        // aren't valid JSON. Use plain geminiText({jsonMode:true}) for
        // structured output.
      },
    });
    const t0 = performance.now();
    let tFirstChunk = 0;
    const result = await model.generateContentStream(prompt);
    let accumulated = '';
    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (!text) continue;
      if (!tFirstChunk) tFirstChunk = performance.now();
      accumulated += text;
      // Defensive: if the caller's UI callback throws (e.g. a stale React
      // setState reference, a missing DOM target), don't let it abort the
      // stream. We've already consumed the tokens — we want to finish
      // accumulating + record the call for usage tracking. Log so the bug
      // is visible in DevTools but keep streaming.
      if (onChunk) {
        try { onChunk(text); }
        catch (cbErr) { console.warn('[gemini-stream] onChunk threw:', cbErr?.message || cbErr); }
      }
    }
    const tEnd = performance.now();
    const firstChunkMs = tFirstChunk ? Math.round(tFirstChunk - t0) : null;
    const totalMs = Math.round(tEnd - t0);
    // Stream complete. Resolve the final response for token counting.
    const finalResponse = await result.response;
    recordCall();        // record only on successful API reach (matches geminiText pattern)
    recordUserCall();

    const promptStr = typeof prompt === 'string' ? prompt : JSON.stringify(prompt);
    console.log(`[gemini-stream:${feature}] prompt=${promptStr.length}ch  first-chunk=${firstChunkMs}ms  total=${totalMs}ms  output=${accumulated.length}ch`);
    const tokens = extractTokenCounts({ response: finalResponse }, promptStr.length, accumulated.length);
    logAiUsage({
      feature,
      model: modelName,
      hasVision: false,
      inputTokens: tokens.inputTokens,
      outputTokens: tokens.outputTokens,
      estimated: tokens.estimated,
    });
    return accumulated;
  } catch (err) {
    if (!isConfigError(err)) recordCall();
    throw mapGeminiError(err);
  }
}

// Multimodal: prompt + a single image (data URL). Same options as geminiText.
// `feature`: short identifier for usage tracking.
export async function geminiTextVision(prompt, imageDataUrl, opts = {}, feature = 'unlabeled') {
  checkRateLimit();
  checkUserDailyCap();
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
    recordCall();        // record only on successful API reach
    recordUserCall();    // increment per-user in-memory counter
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

// Photo-to-listing search. Given a garment photo, asks Gemini Vision to
// identify the exact product and return a concise search query the user
// can run on Google Shopping to find the real listing.
//
// Google Search grounding (tools: [{ googleSearch: {} }]) is NOT yet
// available in the firebase/ai SDK — it only exists in the raw Gemini
// API. We therefore use a vision-only prompt that produces a search query
// + brand + description, and the caller opens Google Shopping for the user
// or accepts a pasted URL, then routes through the existing fetchProductFromUrl
// import path to pull the real data (name, brand, official image, price).
//
// Returns:
//   { description, searchQuery, brand, confidence, searchAvailable: false }
// `searchAvailable` is always false (SDK doesn't yet support grounding).
// When the SDK gains tools support, flip the logic inside this function
// to try grounded mode first and fall back here.
export async function findProductListingFromPhoto(imageDataUrl, opts = {}, feature = 'find-listing') {
  checkRateLimit();
  checkUserDailyCap();
  try {
    const ai = getAiSafe();
    const match = imageDataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) throw new Error('Image format not recognised.');
    const [, mimeType, data] = match;
    const modelName = opts.model || 'gemini-2.5-flash';

    const model = getGenerativeModel(ai, {
      model: modelName,
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 600,
      },
    });

    const prompt = `You are looking at a photograph of a single garment or fashion accessory. Your job is to identify the product precisely enough that a Google Shopping search will surface the exact listing.

Look carefully for:
- Brand logos, labels, or text visible on the item or tag
- Distinctive design signatures (e.g. Burberry check, Bottega woven leather, Gucci GG canvas, LV monogram, Cartier's red leather cord)
- Product shape, silhouette, cut (e.g. "belted trench", "mule", "biker jacket")
- Dominant colour(s)
- Hardware, stitching, or pattern details that make this identifiable

Return ONLY JSON — no markdown, no fences, no extra text:
{
  "description": "one-sentence description of what you see (e.g. 'beige Burberry-check double-breasted trench coat, mid-length, belted')",
  "searchQuery": "the best short Google Shopping query to find this exact item (e.g. 'Burberry Heritage Trench Coat beige')",
  "confidence": "high | medium | low",
  "brand": "Brand name if there is a visible logo or unmistakably signature design element, otherwise null"
}

Rules:
- confidence 'high' = you can clearly see a brand logo / label or a uniquely identifiable brand signature design
- confidence 'medium' = you believe you recognise the brand or style but are not certain
- confidence 'low' = you can describe the item but cannot identify the brand or specific product
- Do NOT invent brand names without visible evidence — better to set brand null and confidence low than to hallucinate
- searchQuery should be 3–8 words, brand-first when known`;

    const result = await model.generateContent({
      contents: [{
        role: 'user',
        parts: [
          { text: prompt },
          { inlineData: { mimeType, data } },
        ],
      }],
    });

    const text = result.response.text();
    recordCall();
    recordUserCall();

    const promptLen = prompt.length;
    const tokens = extractTokenCounts(result, promptLen, text.length);
    if (tokens.estimated) tokens.inputTokens += 258; // flat image-token estimate
    logAiUsage({
      feature,
      model: modelName,
      hasVision: true,
      inputTokens: tokens.inputTokens,
      outputTokens: tokens.outputTokens,
      estimated: tokens.estimated,
    });

    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    let parsed;
    try { parsed = JSON.parse(cleaned); }
    catch (parseErr) {
      console.warn('[find-listing] JSON parse failed:', parseErr?.message, '|', cleaned.slice(0, 200));
      return { description: '', searchQuery: '', brand: null, confidence: 'low', searchAvailable: false };
    }

    return {
      description: typeof parsed.description === 'string' ? parsed.description : '',
      searchQuery: typeof parsed.searchQuery === 'string' ? parsed.searchQuery : (parsed.description || ''),
      brand: typeof parsed.brand === 'string' ? parsed.brand : null,
      confidence: ['high', 'medium', 'low'].includes(parsed.confidence) ? parsed.confidence : 'low',
      searchAvailable: false,
      candidates: [], // reserved for future grounded-search path
    };
  } catch (err) {
    if (!isConfigError(err)) recordCall();
    throw mapGeminiError(err);
  }
}

// Founder-cohort counter for the Profile privacy section. Counts
// distinct users in the /users collection. One-shot read, cached
// in-memory for the session so navigation away/back doesn't re-fetch.
// Uses Firestore's server-side aggregation count — cheap (~1 read per
// 1000 documents), does NOT download document data.
let _founderCountCache = null;
let _founderCountInflight = null;

export async function getFounderCount() {
  if (_founderCountCache !== null) return _founderCountCache;
  if (_founderCountInflight) return _founderCountInflight;
  _founderCountInflight = (async () => {
    try {
      const snap = await getCountFromServer(collection(db, 'users'));
      _founderCountCache = snap.data().count;
      return _founderCountCache;
    } catch (err) {
      console.warn('[founder-count] read failed:', err?.message);
      return null;
    } finally {
      _founderCountInflight = null;
    }
  })();
  return _founderCountInflight;
}
