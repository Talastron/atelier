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
}

export async function upsertSubscription(
  accessToken: string,
  projectId: string,
  sub: SubscriptionRecord
): Promise<void> {
  const docPath = `projects/${projectId}/databases/(default)/documents/subscriptions/${sub.subscriptionId}`;
  const updateMask = [
    'userId', 'email', 'status', 'productId', 'variantId',
    'currentPeriodEnd', 'cancelledAt', 'updatedAt',
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
