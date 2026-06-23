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
