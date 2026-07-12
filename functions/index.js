/**
 * Atelier Cloud Functions — Google Calendar integration.
 *
 * Three endpoints power the OAuth dance and the daily event fetch:
 *
 *   1. calendarOAuthStart    (callable)  — mints a state token, returns Google's consent URL.
 *   2. calendarOAuthCallback (onRequest) — Google redirects here with ?code&state; we exchange,
 *                                          persist the refresh token, then bounce the user back to
 *                                          the SPA.
 *   3. getCalendarEvents     (callable)  — uses the stored refresh token to fetch events for a
 *                                          date range, returning a minimal projection.
 *
 * All functions deploy to europe-west2 to sit alongside the eur3 Firestore instance.
 */

const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');
const crypto = require('crypto');
const { google } = require('googleapis');

admin.initializeApp();

// --- Constants ---------------------------------------------------------------

const REGION = 'europe-west2';
const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events.readonly';
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const PROD_REDIRECT = 'https://edit.myatelier.style/?calendarConnected=1';
const LOCAL_REDIRECT = 'http://localhost:5173/?calendarConnected=1';
const INTEGRATION_DOC = 'google_calendar';   // client-readable metadata, under users/{uid}/integrations
const PROVIDER = 'google_calendar';          // server-only secrets, under integrationSecrets/{uid}/providers
const STATE_DOC = '_oauth_state';            // server-only transient state, same subtree

// --- Secrets -----------------------------------------------------------------

const GOOGLE_OAUTH_CLIENT_ID = defineSecret('GOOGLE_OAUTH_CLIENT_ID');
const GOOGLE_OAUTH_CLIENT_SECRET = defineSecret('GOOGLE_OAUTH_CLIENT_SECRET');
const GOOGLE_OAUTH_REDIRECT_URI = defineSecret('GOOGLE_OAUTH_REDIRECT_URI');

// --- Helpers -----------------------------------------------------------------

// Client-readable metadata (scope, connectedAt) — the SPA reads this to show
// the "Connected" badge. Covered by the existing /users/{uid}/{document=**}
// rule, which is fine: it holds nothing sensitive.
function integrationRef(uid) {
  return admin.firestore().doc(`users/${uid}/integrations/${INTEGRATION_DOC}`);
}

// Server-only secrets. Stored OUTSIDE /users/{uid} on purpose: Firestore rules
// are additive, so the recursive /users/{uid}/{document=**} allow can't be
// narrowed by a more-specific deny. Keeping tokens under /integrationSecrets
// (no client allow rule → default-deny) is the only way to truly seal them.
// Functions reach them via the Admin SDK, which bypasses rules.
function tokensRef(uid) {
  return admin.firestore().doc(`integrationSecrets/${uid}/providers/${PROVIDER}`);
}

function stateRef(uid) {
  return admin.firestore().doc(`integrationSecrets/${uid}/providers/${STATE_DOC}`);
}

function isRunningInEmulator() {
  return process.env.FUNCTIONS_EMULATOR === 'true';
}

// Project an error down to non-sensitive fields before logging. googleapis /
// gaxios errors carry `.config.headers.Authorization` (the access token) and
// `.config.data` (the refresh token on revoke calls); logging the raw error
// would spill tokens into Cloud Logging. Only the code/status/message are safe.
function safeErr(err) {
  return {
    code: err?.code,
    status: err?.response?.status,
    googleError: err?.response?.data?.error,
    message: err?.message,
  };
}

function isRevokedError(err) {
  // Only treat as "revoked" when Google explicitly says `invalid_grant`.
  // Bare 401s or message-substring matches false-positive on transient errors,
  // SDK upgrades, or misconfigured client pairs — and deleting the integration
  // doc on a false positive forces the user through the OAuth dance again.
  return err?.response?.data?.error === 'invalid_grant';
}

// --- 1. calendarOAuthStart ---------------------------------------------------

exports.calendarOAuthStart = onCall(
  {
    region: REGION,
    secrets: [GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_REDIRECT_URI],
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }

    const state = crypto.randomBytes(32).toString('hex');
    await stateRef(uid).set({ state, createdAt: Date.now() });

    const oauth2 = new google.auth.OAuth2(
      GOOGLE_OAUTH_CLIENT_ID.value(),
      undefined,
      GOOGLE_OAUTH_REDIRECT_URI.value()
    );

    const authUrl = oauth2.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: [CALENDAR_SCOPE],
      state: `${uid}.${state}`,
    });

    return { authUrl };
  }
);

// --- 2. calendarOAuthCallback ------------------------------------------------

exports.calendarOAuthCallback = onRequest(
  {
    region: REGION,
    secrets: [GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT_URI],
  },
  async (req, res) => {
    try {
      const { code, state } = req.query;
      if (!code || !state) {
        res.status(400).send('Missing code or state');
        return;
      }

      const [uid, stateToken] = String(state).split('.');
      if (!uid || !stateToken) {
        res.status(400).send('Malformed state');
        return;
      }

      const stateSnap = await stateRef(uid).get();
      if (!stateSnap.exists || stateSnap.data().state !== stateToken) {
        res.status(403).send('State mismatch');
        return;
      }

      const createdAt = stateSnap.data().createdAt || 0;
      if (Date.now() - createdAt > STATE_TTL_MS) {
        res.status(403).send('State expired');
        return;
      }

      const oauth2 = new google.auth.OAuth2(
        GOOGLE_OAUTH_CLIENT_ID.value(),
        GOOGLE_OAUTH_CLIENT_SECRET.value(),
        GOOGLE_OAUTH_REDIRECT_URI.value()
      );

      const { tokens } = await oauth2.getToken(String(code));

      if (!tokens.refresh_token) {
        logger.error('No refresh_token returned from Google', { uid });
        res
          .status(500)
          .send(
            'No refresh token received. Please revoke access at ' +
              'https://myaccount.google.com/permissions and try again.'
          );
        return;
      }

      // Split storage: tokens to a server-only doc (underscore-prefixed, rule
      // denies client reads); metadata to a client-readable doc so the SPA can
      // show "Connected since…" without ever loading the refresh token.
      await tokensRef(uid).set({
        refreshToken: tokens.refresh_token,
        accessToken: tokens.access_token,
        expiresAt: tokens.expiry_date,
      });
      await integrationRef(uid).set({
        scope: tokens.scope,
        connectedAt: Date.now(),
      });

      await stateRef(uid).delete();

      const redirect = isRunningInEmulator() ? LOCAL_REDIRECT : PROD_REDIRECT;
      res.redirect(redirect);
    } catch (err) {
      logger.error('calendarOAuthCallback failed', safeErr(err));
      res.status(500).send('Calendar connection failed. Please try again.');
    }
  }
);

// --- 3. getCalendarEvents ----------------------------------------------------

// minInstances: 0 — the daily-brief fetch happens once per session and is
// chained with a Gemini call that takes ~500-1500ms, so a 1-2s cold start
// is invisible. Revisit if usage patterns change.
exports.getCalendarEvents = onCall(
  {
    region: REGION,
    secrets: [GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT_URI],
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }

    // Contract: startISO/endISO must be full RFC3339 timestamps WITH timezone
    // offset (e.g. '2026-06-23T00:00:00+01:00'). The client is responsible for
    // producing these from the user's local midnight/end-of-day. If we built
    // them server-side from a YYYY-MM-DD date, they'd be interpreted in the
    // Function's UTC timezone and shift the day window for non-UTC users (UK
    // in BST is off by an hour). Forwarding the client's tz-aware values
    // straight to Google avoids the ambiguity entirely.
    const { startISO, endISO } = request.data || {};
    if (typeof startISO !== 'string' || typeof endISO !== 'string') {
      throw new HttpsError('invalid-argument', 'startISO and endISO must be RFC3339 strings.');
    }

    const tokensSnap = await tokensRef(uid).get();
    if (!tokensSnap.exists) {
      throw new HttpsError('failed-precondition', 'Calendar not connected.');
    }

    const stored = tokensSnap.data();
    const oauth2 = new google.auth.OAuth2(
      GOOGLE_OAUTH_CLIENT_ID.value(),
      GOOGLE_OAUTH_CLIENT_SECRET.value(),
      GOOGLE_OAUTH_REDIRECT_URI.value()
    );
    oauth2.setCredentials({
      refresh_token: stored.refreshToken,
      access_token: stored.accessToken,
      expiry_date: stored.expiresAt,
    });

    let listResp;
    try {
      listResp = await google.calendar({ version: 'v3', auth: oauth2 }).events.list({
        calendarId: 'primary',
        timeMin: startISO,
        timeMax: endISO,
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 50,
      });
    } catch (err) {
      if (isRevokedError(err)) {
        logger.warn('Calendar access revoked; clearing integration', { uid });
        await Promise.all([
          tokensRef(uid).delete(),
          integrationRef(uid).delete(),
        ]);
        return { events: [], reason: 'revoked' };
      }
      logger.error('events.list failed', { uid, ...safeErr(err) });
      throw new HttpsError('internal', 'Failed to fetch calendar events.');
    }

    // Persist refreshed access token if googleapis auto-refreshed it.
    const newAccessToken = oauth2.credentials.access_token;
    if (newAccessToken && newAccessToken !== stored.accessToken) {
      await tokensRef(uid).update({
        accessToken: newAccessToken,
        expiresAt: oauth2.credentials.expiry_date,
      });
    }

    const events = (listResp.data.items || []).map((e) => ({
      id: e.id,
      title: e.summary || '(untitled)',
      startISO: e.start?.dateTime || e.start?.date,
      endISO: e.end?.dateTime || e.end?.date,
      allDay: !!e.start?.date && !e.start?.dateTime,
      location: e.location || null,
    }));

    return { events };
  }
);

// --- 4. disconnectCalendar --------------------------------------------------
//
// Client cannot delete the tokens doc directly (Firestore rules deny client
// writes on _-prefixed integration docs). Funnel disconnect through here so
// both the metadata and tokens docs are cleaned up atomically.

exports.disconnectCalendar = onCall(
  {
    region: REGION,
    secrets: [GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT_URI],
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }

    // Best-effort: revoke at Google so the refresh token can't be re-used
    // even if the Firestore delete fails. Failure here is non-fatal — the
    // tokens being deleted from our side is the load-bearing step.
    try {
      const tokensSnap = await tokensRef(uid).get();
      if (tokensSnap.exists && tokensSnap.data().refreshToken) {
        const oauth2 = new google.auth.OAuth2(
          GOOGLE_OAUTH_CLIENT_ID.value(),
          GOOGLE_OAUTH_CLIENT_SECRET.value(),
          GOOGLE_OAUTH_REDIRECT_URI.value()
        );
        await oauth2.revokeToken(tokensSnap.data().refreshToken);
      }
    } catch (err) {
      logger.warn('Failed to revoke refresh token at Google; proceeding with local delete', { uid, ...safeErr(err) });
    }

    await Promise.all([
      tokensRef(uid).delete(),
      integrationRef(uid).delete(),
    ]);

    return { ok: true };
  }
);

// Permanent account deletion — GDPR right-to-erasure. Removes ALL of the user's
// data (Firestore subtree, server-only integration secrets, subscriber index,
// Storage objects) and the Firebase Auth account itself. Irreversible.
//
// Does NOT cancel a Lemon Squeezy subscription (that lives in the marketing
// repo / LS and needs the LS API key we don't hold here) — the client warns
// the user to cancel billing first. Order matters: data first (the
// privacy-critical part), auth account last (once gone the client token dies).
exports.deleteAccount = onCall(
  { region: REGION },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }

    const db = admin.firestore();

    // 1. Firestore — recursive delete of the private subtree + server-only
    //    integration secrets, plus the subscriber-access index doc and any
    //    subscription cache rows for this user. This is the load-bearing step.
    try {
      await db.recursiveDelete(db.doc(`users/${uid}`));
      await db.recursiveDelete(db.doc(`integrationSecrets/${uid}`));
      await db.doc(`subscriberAccess/${uid}`).delete();
      const subs = await db.collection('subscriptions').where('userId', '==', uid).get();
      await Promise.all(subs.docs.map((d) => d.ref.delete()));
    } catch (err) {
      logger.error('deleteAccount: Firestore delete failed', { uid, ...safeErr(err) });
      throw new HttpsError('internal', 'Could not delete your data — nothing was removed. Please try again.');
    }

    // 2. Storage — every object under the user's prefix. Best-effort: a storage
    //    failure must not strand a half-deleted account.
    try {
      await admin.storage().bucket().deleteFiles({ prefix: `users/${uid}/` });
    } catch (err) {
      logger.warn('deleteAccount: storage cleanup failed (continuing)', { uid, ...safeErr(err) });
    }

    // 3. Auth account — last, because it invalidates the caller's token.
    try {
      await admin.auth().deleteUser(uid);
    } catch (err) {
      logger.error('deleteAccount: auth deleteUser failed', { uid, ...safeErr(err) });
      throw new HttpsError('internal', 'Your data was removed but the account record could not be deleted. Please contact support.');
    }

    logger.info('deleteAccount: account fully deleted', { uid });
    return { ok: true };
  }
);

// --- Image proxy -------------------------------------------------------------
// Fetches an external (retailer-CDN) image server-side — where browser CORS
// doesn't exist — and returns the bytes with permissive CORS so the client can
// read them (for background-removal cut-outs and image rehosting). The public
// CORS proxies the client used are unreliable; this is the dependable path.
// Basic SSRF guards: http(s) only, no internal hosts, image content-type, cap.
exports.imageProxy = onRequest({ region: REGION, cors: true, memory: '256MiB' }, async (req, res) => {
  const url = String(req.query.url || '');
  if (!/^https?:\/\//i.test(url)) { res.status(400).send('bad url'); return; }
  let host;
  try { host = new URL(url).hostname; } catch { res.status(400).send('bad url'); return; }
  if (/^(localhost$|127\.|10\.|192\.168\.|169\.254\.|0\.0\.0\.0$|\[?::1\]?$)/i.test(host)) {
    res.status(400).send('blocked host'); return;
  }
  try {
    const upstream = await fetch(url, {
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AtelierBot/1.0)' },
      signal: AbortSignal.timeout(12000),
    });
    if (!upstream.ok) { res.status(502).send(`upstream ${upstream.status}`); return; }
    const ct = upstream.headers.get('content-type') || '';
    if (!ct.startsWith('image/')) { res.status(415).send('not an image'); return; }
    const buf = Buffer.from(await upstream.arrayBuffer());
    if (buf.length > 10 * 1024 * 1024) { res.status(413).send('too large'); return; }
    res.set('Content-Type', ct);
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(buf);
  } catch (e) {
    logger.warn('[imageProxy] failed', { url, err: e?.message });
    res.status(502).send('fetch failed');
  }
});

// --- Page proxy (first-party, App Check-gated) -------------------------------
// Fetches a product page's HTML server-side so the client can parse JSON-LD
// (price/brand/description) for link import — the enrichment we used to get from
// anonymous public CORS proxies before removing them for privacy. Because this
// returns arbitrary HTML (a far more abusable capability than an image proxy),
// it is gated behind Firebase App Check so only the genuine app can call it.
// SSRF guards mirror imageProxy: http(s) only, no internal hosts, size + time caps.
exports.pageProxy = onRequest({ region: REGION, cors: true, memory: '256MiB' }, async (req, res) => {
  // App Check: reject anything that isn't the genuine app (skipped in emulator).
  if (!isRunningInEmulator()) {
    const token = req.get('X-Firebase-AppCheck');
    if (!token) { res.status(401).send('missing app check token'); return; }
    try {
      await admin.appCheck().verifyToken(token);
    } catch {
      res.status(401).send('invalid app check token'); return;
    }
  }

  const url = String(req.query.url || '');
  if (!/^https?:\/\//i.test(url)) { res.status(400).send('bad url'); return; }
  let host;
  try { host = new URL(url).hostname; } catch { res.status(400).send('bad url'); return; }
  if (/^(localhost$|127\.|10\.|192\.168\.|169\.254\.|0\.0\.0\.0$|\[?::1\]?$)/i.test(host)) {
    res.status(400).send('blocked host'); return;
  }
  try {
    const upstream = await fetch(url, {
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AtelierBot/1.0)' },
      signal: AbortSignal.timeout(12000),
    });
    if (!upstream.ok) { res.status(502).send(`upstream ${upstream.status}`); return; }
    const ct = upstream.headers.get('content-type') || '';
    if (!/text\/html|application\/xhtml\+xml/i.test(ct)) { res.status(415).send('not html'); return; }
    // Cap the body: we only need the <head> JSON-LD, and an unbounded page could
    // exhaust memory. Read to a 3 MB cap and hand back UTF-8 text.
    const buf = Buffer.from(await upstream.arrayBuffer());
    const html = buf.subarray(0, 3 * 1024 * 1024).toString('utf8');
    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(html);
  } catch (e) {
    logger.warn('[pageProxy] failed', { url, err: e?.message });
    res.status(502).send('fetch failed');
  }
});
