import { verifyLemonSqueezySignature } from '../lib/hmac.ts';
import { getGoogleAccessToken, parseServiceAccount } from '../lib/google-auth.ts';
import { findOrCreateUserByEmail, updateUserDisplayName, sendSignInLink } from '../lib/firebase-identity-toolkit.ts';
import { upsertSubscription, upsertSubscriberAccess, isEventProcessed, markEventProcessed, type SubscriptionRecord } from '../lib/firestore.ts';

interface Env {
  LEMONSQUEEZY_WEBHOOK_SECRET: string;
  FIREBASE_PROJECT_ID: string;
  FIREBASE_ADMIN_SERVICE_ACCOUNT: string;
  EDIT_URL: string;
}

interface PagesContext {
  request: Request;
  env: Env;
}

const SCOPES = [
  'https://www.googleapis.com/auth/datastore',
  'https://www.googleapis.com/auth/identitytoolkit',
  'https://www.googleapis.com/auth/firebase',
];

function mapStatus(lsStatus: string): SubscriptionRecord['status'] {
  switch (lsStatus) {
    case 'active':
    case 'on_trial':
      return 'active';
    case 'cancelled':
      return 'cancelled';
    case 'expired':
      return 'expired';
    case 'past_due':
    case 'unpaid':
      return 'past_due';
    case 'paused':
      return 'paused';
    default:
      return 'active';
  }
}

export async function onRequestPost(context: PagesContext): Promise<Response> {
  const { request, env } = context;

  const rawBody = await request.text();
  const signature = request.headers.get('X-Signature') || '';
  const eventId = request.headers.get('X-Event-Id') || '';

  const valid = await verifyLemonSqueezySignature(rawBody, signature, env.LEMONSQUEEZY_WEBHOOK_SECRET);
  if (!valid) {
    console.warn(`[webhook] rejected: invalid HMAC signature (event_id=${eventId || 'none'})`);
    return new Response('invalid signature', { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    console.warn('[webhook] rejected: body is not valid JSON');
    return new Response('invalid json', { status: 400 });
  }

  const eventName: string = payload.meta?.event_name;
  if (!eventName) {
    console.warn('[webhook] rejected: missing meta.event_name');
    return new Response('missing event_name', { status: 400 });
  }

  console.log(`[webhook] received event=${eventName} id=${eventId || 'none'}`);

  let sa;
  let token;
  try {
    sa = parseServiceAccount(env.FIREBASE_ADMIN_SERVICE_ACCOUNT);
    token = await getGoogleAccessToken(sa, SCOPES);
  } catch (err: any) {
    console.error(`[webhook] auth setup failed: ${err?.message || err}`);
    return new Response('auth setup failed', { status: 500 });
  }

  if (eventId && (await isEventProcessed(token, env.FIREBASE_PROJECT_ID, eventId))) {
    console.log(`[webhook] event ${eventId} already processed — skipping`);
    return new Response('already processed', { status: 200 });
  }

  const attrs = payload.data?.attributes;
  const subscriptionId = String(payload.data?.id ?? '');
  const email = attrs?.user_email;
  // LS sends customer's full name as `user_name`; we use it as the Firebase
  // Auth displayName so the app greeting reads "Good morning, Sibylle"
  // instead of "Good morning, sibylle.moeller".
  const userName: string | undefined = attrs?.user_name;

  if (!attrs || !subscriptionId || !email) {
    console.warn(`[webhook] rejected: missing required fields (subId=${subscriptionId}, hasAttrs=${!!attrs}, hasEmail=${!!email})`);
    return new Response('missing required fields', { status: 400 });
  }

  console.log(`[webhook] processing ${eventName} for email=${email} subId=${subscriptionId}`);

  // Helper: provision the user AND backfill displayName if the existing user
  // doesn't have one. New users get displayName at creation time via
  // findOrCreateUserByEmail; existing users (pre-displayName-feature) get
  // theirs set on the next subscription event of any kind.
  async function findOrCreateUserWithName(em: string): Promise<{ uid: string; created: boolean }> {
    const user = await findOrCreateUserByEmail(token, env.FIREBASE_PROJECT_ID, em, userName);
    if (!user.created && userName && !user.hasDisplayName) {
      try {
        await updateUserDisplayName(token, env.FIREBASE_PROJECT_ID, user.uid, userName);
        console.log(`[webhook] backfilled displayName for uid=${user.uid}`);
      } catch (err: any) {
        // Non-fatal — the user still gets access; greeting just falls back to
        // the email-parsing logic in the app until next event.
        console.warn(`[webhook] displayName backfill failed for uid=${user.uid}: ${err?.message || err}`);
      }
    }
    return { uid: user.uid, created: user.created };
  }

  const subscriptionRecord: SubscriptionRecord = {
    subscriptionId,
    userId: '',
    email,
    status: mapStatus(attrs.status),
    productId: String(attrs.product_id ?? ''),
    variantId: String(attrs.variant_id ?? ''),
    currentPeriodEnd: attrs.renews_at ?? attrs.ends_at ?? new Date().toISOString(),
    cancelledAt: attrs.cancelled ? new Date().toISOString() : undefined,
    // Only set while on trial; cleared automatically once it converts.
    trialEndsAt: attrs.trial_ends_at ?? undefined,
  };

  try {
    switch (eventName) {
      case 'subscription_created': {
        const user = await findOrCreateUserWithName(email);
        subscriptionRecord.userId = user.uid;
        console.log(`[webhook] ${user.created ? 'created' : 'found'} Firebase user uid=${user.uid}`);
        await upsertSubscription(token, env.FIREBASE_PROJECT_ID, subscriptionRecord);
        await upsertSubscriberAccess(token, env.FIREBASE_PROJECT_ID, subscriptionRecord);
        await sendSignInLink(token, env.FIREBASE_PROJECT_ID, email, `${env.EDIT_URL}/auth`);
        console.log(`[webhook] sent magic-link email to ${email}`);
        break;
      }
      case 'subscription_updated':
      case 'subscription_resumed':
      case 'subscription_payment_success': {
        const user = await findOrCreateUserWithName(email);
        subscriptionRecord.userId = user.uid;
        await upsertSubscription(token, env.FIREBASE_PROJECT_ID, subscriptionRecord);
        await upsertSubscriberAccess(token, env.FIREBASE_PROJECT_ID, subscriptionRecord);
        console.log(`[webhook] updated subscription for uid=${user.uid} status=${subscriptionRecord.status}`);
        break;
      }
      case 'subscription_cancelled': {
        const user = await findOrCreateUserWithName(email);
        subscriptionRecord.userId = user.uid;
        subscriptionRecord.status = 'cancelled';
        subscriptionRecord.cancelledAt = new Date().toISOString();
        await upsertSubscription(token, env.FIREBASE_PROJECT_ID, subscriptionRecord);
        await upsertSubscriberAccess(token, env.FIREBASE_PROJECT_ID, subscriptionRecord);
        console.log(`[webhook] cancelled subscription for uid=${user.uid} access until=${subscriptionRecord.currentPeriodEnd}`);
        break;
      }
      case 'subscription_expired':
      case 'subscription_payment_failed': {
        const user = await findOrCreateUserWithName(email);
        subscriptionRecord.userId = user.uid;
        subscriptionRecord.status = eventName === 'subscription_expired' ? 'expired' : 'past_due';
        await upsertSubscription(token, env.FIREBASE_PROJECT_ID, subscriptionRecord);
        await upsertSubscriberAccess(token, env.FIREBASE_PROJECT_ID, subscriptionRecord);
        console.log(`[webhook] ${eventName} for uid=${user.uid} — access revoked`);
        break;
      }
      default:
        console.log(`[webhook] unhandled event type: ${eventName}`);
    }
  } catch (err: any) {
    // Log full context so Cloudflare real-time logs can be used to debug
    // without resending the webhook. Rethrow so Cloudflare returns 500 and
    // LS retries (idempotent: next attempt with same event_id is a no-op).
    console.error(`[webhook] failed processing ${eventName} for ${email}: ${err?.message || err}`);
    throw err;
  }

  if (eventId) await markEventProcessed(token, env.FIREBASE_PROJECT_ID, eventId);

  console.log(`[webhook] ok event=${eventName} id=${eventId || 'none'}`);
  return new Response('ok', { status: 200 });
}
