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
const INTEGRATION_DOC = 'google_calendar';
const STATE_DOC = '_oauth_state';

// --- Secrets -----------------------------------------------------------------

const GOOGLE_OAUTH_CLIENT_ID = defineSecret('GOOGLE_OAUTH_CLIENT_ID');
const GOOGLE_OAUTH_CLIENT_SECRET = defineSecret('GOOGLE_OAUTH_CLIENT_SECRET');
const GOOGLE_OAUTH_REDIRECT_URI = defineSecret('GOOGLE_OAUTH_REDIRECT_URI');

// --- Helpers -----------------------------------------------------------------

function integrationRef(uid) {
  return admin.firestore().doc(`users/${uid}/integrations/${INTEGRATION_DOC}`);
}

function stateRef(uid) {
  return admin.firestore().doc(`users/${uid}/integrations/${STATE_DOC}`);
}

function isLocalHost(hostname) {
  return !!hostname && (hostname.includes('localhost') || hostname.includes('127.0.0.1'));
}

function isRevokedError(err) {
  const code = err?.code || err?.response?.status;
  const msg = String(err?.message || err?.response?.data?.error || '');
  return (
    code === 401 ||
    msg.includes('invalid_grant') ||
    msg.includes('Token has been expired or revoked')
  );
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

      await integrationRef(uid).set({
        refreshToken: tokens.refresh_token,
        accessToken: tokens.access_token,
        expiresAt: tokens.expiry_date,
        scope: tokens.scope,
        connectedAt: Date.now(),
      });

      await stateRef(uid).delete();

      const redirect = isLocalHost(req.hostname) ? LOCAL_REDIRECT : PROD_REDIRECT;
      res.redirect(redirect);
    } catch (err) {
      logger.error('calendarOAuthCallback failed', err);
      res.status(500).send('Calendar connection failed. Please try again.');
    }
  }
);

// --- 3. getCalendarEvents ----------------------------------------------------

exports.getCalendarEvents = onCall(
  {
    region: REGION,
    minInstances: 1,
    secrets: [GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REDIRECT_URI],
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }

    const { startISO, endISO } = request.data || {};
    if (!startISO || !endISO) {
      throw new HttpsError('invalid-argument', 'startISO and endISO are required.');
    }

    const snap = await integrationRef(uid).get();
    if (!snap.exists) {
      throw new HttpsError('failed-precondition', 'Calendar not connected.');
    }

    const stored = snap.data();
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
        timeMin: new Date(startISO + 'T00:00:00').toISOString(),
        timeMax: new Date(endISO + 'T23:59:59').toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 50,
      });
    } catch (err) {
      if (isRevokedError(err)) {
        logger.warn('Calendar access revoked; clearing integration', { uid });
        await integrationRef(uid).delete();
        return { events: [], reason: 'revoked' };
      }
      logger.error('events.list failed', err);
      throw new HttpsError('internal', 'Failed to fetch calendar events.');
    }

    // Persist refreshed access token if googleapis auto-refreshed it.
    const newAccessToken = oauth2.credentials.access_token;
    if (newAccessToken && newAccessToken !== stored.accessToken) {
      await integrationRef(uid).update({
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
