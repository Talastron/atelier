const FIRESTORE_BASE = 'https://firestore.googleapis.com/v1';

export interface SubscriptionRecord {
  subscriptionId: string;
  userId: string;
  email: string;
  status: 'active' | 'cancelled' | 'expired' | 'past_due' | 'paused';
  productId: string;
  variantId: string;
  currentPeriodEnd: string;
  cancelledAt?: string;
  // Present only while the subscription is in its free trial (Lemon Squeezy
  // `trial_ends_at`). Lets the app show a trial countdown — status is
  // normalised to 'active' during trial, so this is the only trial signal.
  trialEndsAt?: string;
}

export async function upsertSubscription(
  accessToken: string,
  projectId: string,
  sub: SubscriptionRecord
): Promise<void> {
  const docPath = `projects/${projectId}/databases/(default)/documents/subscriptions/${sub.subscriptionId}`;
  const updateMask = [
    'userId', 'email', 'status', 'productId', 'variantId',
    'currentPeriodEnd', 'cancelledAt', 'trialEndsAt', 'updatedAt',
  ];

  const fields: Record<string, unknown> = {
    userId: { stringValue: sub.userId },
    email: { stringValue: sub.email },
    status: { stringValue: sub.status },
    productId: { stringValue: sub.productId },
    variantId: { stringValue: sub.variantId },
    currentPeriodEnd: { timestampValue: sub.currentPeriodEnd },
    updatedAt: { timestampValue: new Date().toISOString() },
  };
  if (sub.cancelledAt) fields.cancelledAt = { timestampValue: sub.cancelledAt };
  // trialEndsAt is in updateMask but omitted from fields when absent, so
  // Firestore clears it the moment a trial converts to paid.
  if (sub.trialEndsAt) fields.trialEndsAt = { timestampValue: sub.trialEndsAt };

  const url = `${FIRESTORE_BASE}/${docPath}?${
    updateMask.map((f) => `updateMask.fieldPaths=${f}`).join('&')
  }`;

  const resp = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  if (!resp.ok) throw new Error(`upsertSubscription failed: ${resp.status} ${await resp.text()}`);
}

/**
 * Write/update the lookup-index doc at /subscriberAccess/{uid}.
 *
 * Firestore Security Rules cannot query collections — they can only do direct
 * doc lookups by ID. The canonical /subscriptions/{lsSubId} doc is keyed by
 * Lemon Squeezy subscription ID, which the rules can't look up from the
 * signed-in user's uid alone. This denormalized index, keyed by Firebase uid,
 * lets rules check subscription status in one direct `get()` call.
 *
 * Always written alongside upsertSubscription() — never as a substitute.
 */
export async function upsertSubscriberAccess(
  accessToken: string,
  projectId: string,
  sub: SubscriptionRecord
): Promise<void> {
  const docPath = `projects/${projectId}/databases/(default)/documents/subscriberAccess/${sub.userId}`;
  const updateMask = [
    'subscriptionId', 'email', 'status',
    'currentPeriodEnd', 'cancelledAt', 'trialEndsAt', 'updatedAt',
  ];

  const fields: Record<string, unknown> = {
    subscriptionId: { stringValue: sub.subscriptionId },
    email: { stringValue: sub.email },
    status: { stringValue: sub.status },
    currentPeriodEnd: { timestampValue: sub.currentPeriodEnd },
    updatedAt: { timestampValue: new Date().toISOString() },
  };
  if (sub.cancelledAt) fields.cancelledAt = { timestampValue: sub.cancelledAt };
  // trialEndsAt is in updateMask but omitted from fields when absent, so
  // Firestore clears it the moment a trial converts to paid.
  if (sub.trialEndsAt) fields.trialEndsAt = { timestampValue: sub.trialEndsAt };

  const url = `${FIRESTORE_BASE}/${docPath}?${
    updateMask.map((f) => `updateMask.fieldPaths=${f}`).join('&')
  }`;

  const resp = await fetch(url, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  if (!resp.ok) throw new Error(`upsertSubscriberAccess failed: ${resp.status} ${await resp.text()}`);
}

export async function isEventProcessed(
  accessToken: string,
  projectId: string,
  eventId: string
): Promise<boolean> {
  const url = `${FIRESTORE_BASE}/projects/${projectId}/databases/(default)/documents/processed_webhook_events/${eventId}`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  return resp.ok;
}

export async function markEventProcessed(
  accessToken: string,
  projectId: string,
  eventId: string
): Promise<void> {
  const url = `${FIRESTORE_BASE}/projects/${projectId}/databases/(default)/documents/processed_webhook_events?documentId=${eventId}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: { receivedAt: { timestampValue: new Date().toISOString() } },
    }),
  });
  if (!resp.ok && resp.status !== 409) {
    throw new Error(`markEventProcessed failed: ${resp.status} ${await resp.text()}`);
  }
}
