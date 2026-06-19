import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock jose so tests don't need a real RSA private key — just verify that
// the JWT-then-fetch flow calls Google's token endpoint correctly.
vi.mock('jose', () => ({
  importPKCS8: vi.fn().mockResolvedValue({ type: 'private-key-mock' }),
  SignJWT: class MockSignJWT {
    constructor(_payload: any) {}
    setProtectedHeader() { return this; }
    setIssuer() { return this; }
    setSubject() { return this; }
    setAudience() { return this; }
    setIssuedAt() { return this; }
    setExpirationTime() { return this; }
    async sign() { return 'fake-jwt-token'; }
  },
}));

import { getGoogleAccessToken, parseServiceAccount } from '@functions/lib/google-auth.ts';

const TEST_SA = {
  client_email: 'test@example.iam.gserviceaccount.com',
  private_key: '-----BEGIN PRIVATE KEY-----\nFAKE\n-----END PRIVATE KEY-----\n',
};

describe('getGoogleAccessToken', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify({ access_token: 'fake-token', expires_in: 3600 }),
      { status: 200, headers: { 'content-type': 'application/json' } }
    )));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('exchanges a signed JWT for an access token at the Google token endpoint', async () => {
    const token = await getGoogleAccessToken(TEST_SA, ['https://www.googleapis.com/auth/firebase']);
    expect(token).toBe('fake-token');
    expect(fetch).toHaveBeenCalledWith(
      'https://oauth2.googleapis.com/token',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/x-www-form-urlencoded' }),
      })
    );
  });

  it('throws when the token endpoint returns non-2xx', async () => {
    (fetch as any).mockResolvedValueOnce(new Response('upstream error', { status: 500 }));
    await expect(getGoogleAccessToken(TEST_SA, ['scope'])).rejects.toThrow('Google token exchange failed');
  });
});

describe('parseServiceAccount', () => {
  it('decodes valid base64 JSON', () => {
    const json = JSON.stringify({ client_email: 'x@y.com', private_key: 'PEM' });
    const b64 = Buffer.from(json).toString('base64');
    const sa = parseServiceAccount(b64);
    expect(sa.client_email).toBe('x@y.com');
    expect(sa.private_key).toBe('PEM');
  });

  it('throws when client_email is missing', () => {
    const json = JSON.stringify({ private_key: 'PEM' });
    const b64 = Buffer.from(json).toString('base64');
    expect(() => parseServiceAccount(b64)).toThrow('missing client_email');
  });

  it('throws when private_key is missing', () => {
    const json = JSON.stringify({ client_email: 'x@y.com' });
    const b64 = Buffer.from(json).toString('base64');
    expect(() => parseServiceAccount(b64)).toThrow('missing private_key');
  });
});
