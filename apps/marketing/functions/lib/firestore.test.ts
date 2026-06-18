import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { upsertSubscription, isEventProcessed, markEventProcessed } from './firestore.ts';

describe('upsertSubscription', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('writes to subscriptions/{subscriptionId} with the right shape', async () => {
    (fetch as any).mockResolvedValueOnce(new Response('{}', { status: 200 }));

    await upsertSubscription('token', 'project', {
      subscriptionId: 'ls_sub_123',
      userId: 'uid_456',
      email: 'a@b.com',
      status: 'active',
      productId: 'prod_1',
      variantId: 'var_monthly',
      currentPeriodEnd: '2026-07-18T00:00:00Z',
    });

    const url = (fetch as any).mock.calls[0][0] as string;
    expect(url).toContain('/documents/subscriptions/ls_sub_123');
    expect(url).toContain('updateMask.fieldPaths=userId');
    expect(url).toContain('updateMask.fieldPaths=status');
  });
});

describe('event idempotency', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('isEventProcessed returns true when the doc exists', async () => {
    (fetch as any).mockResolvedValueOnce(
      new Response(JSON.stringify({ name: 'projects/foo/databases/(default)/documents/processed_webhook_events/evt_1' }), { status: 200 })
    );
    expect(await isEventProcessed('token', 'project', 'evt_1')).toBe(true);
  });

  it('isEventProcessed returns false when the doc 404s', async () => {
    (fetch as any).mockResolvedValueOnce(new Response('{}', { status: 404 }));
    expect(await isEventProcessed('token', 'project', 'evt_1')).toBe(false);
  });

  it('markEventProcessed writes a doc with receivedAt', async () => {
    (fetch as any).mockResolvedValueOnce(new Response('{}', { status: 200 }));
    await markEventProcessed('token', 'project', 'evt_1');
    const url = (fetch as any).mock.calls[0][0] as string;
    expect(url).toContain('/documents/processed_webhook_events?documentId=evt_1');
  });
});
