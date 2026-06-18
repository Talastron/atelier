import { verifyLemonSqueezySignature } from '../lib/hmac.ts';
import { getGoogleAccessToken, parseServiceAccount } from '../lib/google-auth.ts';
import { findOrCreateUserByEmail, sendSignInLink } from '../lib/firebase-identity-toolkit.ts';
import { upsertSubscription, isEventProcessed, markEventProcessed, type SubscriptionRecord } from '../lib/firestore.ts';

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
  if (!valid) return new Response('invalid signature', { status: 401 });

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response('invalid json', { status: 400 });
  }

  const eventName: string = payload.meta?.event_name;
  if (!eventName) return new Response('missing event_name', { status: 400 });

  const sa = parseServiceAccount(env.FIREBASE_ADMIN_SERVICE_ACCOUNT);
  const token = await getGoogleAccessToken(sa, SCOPES);

  if (eventId && (await isEventProcessed(token, env.FIREBASE_PROJECT_ID, eventId))) {
    return new Response('already processed', { status: 200 });
  }

  const attrs = payload.data?.attributes;
  const subscriptionId = String(payload.data?.id ?? '');
  const email = attrs?.user_email;

  if (!attrs || !subscriptionId || !email) {
    return new Response('missing required fields', { status: 400 });
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
  };

  switch (eventName) {
    case 'subscription_created': {
      const user = await findOrCreateUserByEmail(token, env.FIREBASE_PROJECT_ID, email);
      subscriptionRecord.userId = user.uid;
      await upsertSubscription(token, env.FIREBASE_PROJECT_ID, subscriptionRecord);
      await sendSignInLink(token, env.FIREBASE_PROJECT_ID, email, `${env.EDIT_URL}/auth`);
      break;
    }
    case 'subscription_updated':
    case 'subscription_resumed':
    case 'subscription_payment_success': {
      const user = await findOrCreateUserByEmail(token, env.FIREBASE_PROJECT_ID, email);
      subscriptionRecord.userId = user.uid;
      await upsertSubscription(token, env.FIREBASE_PROJECT_ID, subscriptionRecord);
      break;
    }
    case 'subscription_cancelled': {
      const user = await findOrCreateUserByEmail(token, env.FIREBASE_PROJECT_ID, email);
      subscriptionRecord.userId = user.uid;
      subscriptionRecord.status = 'cancelled';
      subscriptionRecord.cancelledAt = new Date().toISOString();
      await upsertSubscription(token, env.FIREBASE_PROJECT_ID, subscriptionRecord);
      break;
    }
    case 'subscription_expired':
    case 'subscription_payment_failed': {
      const user = await findOrCreateUserByEmail(token, env.FIREBASE_PROJECT_ID, email);
      subscriptionRecord.userId = user.uid;
      subscriptionRecord.status = eventName === 'subscription_expired' ? 'expired' : 'past_due';
      await upsertSubscription(token, env.FIREBASE_PROJECT_ID, subscriptionRecord);
      break;
    }
    default:
      console.log(`Unhandled LS event: ${eventName}`);
  }

  if (eventId) await markEventProcessed(token, env.FIREBASE_PROJECT_ID, eventId);

  return new Response('ok', { status: 200 });
}
