import { describe, it, expect } from 'vitest';
import { verifyLemonSqueezySignature } from '@functions/lib/hmac.ts';

// HMAC-SHA256 of the body `{"foo":"bar"}` with secret `test-secret`.
// Verify with:
//   node -e "console.log(require('crypto').createHmac('sha256','test-secret').update('{\"foo\":\"bar\"}').digest('hex'))"
const VALID_SIG = '9b1abf7d901bda91325d00f6b397fb0dc257937939b27d4dc67848ab9e08f6c0';

describe('verifyLemonSqueezySignature', () => {
  const secret = 'test-secret';
  const body = '{"foo":"bar"}';

  it('returns true for a valid signature', async () => {
    expect(await verifyLemonSqueezySignature(body, VALID_SIG, secret)).toBe(true);
  });

  it('returns false for an invalid signature', async () => {
    expect(await verifyLemonSqueezySignature(body, 'deadbeef', secret)).toBe(false);
  });

  it('returns false for a tampered body', async () => {
    expect(await verifyLemonSqueezySignature('{"foo":"baz"}', VALID_SIG, secret)).toBe(false);
  });

  it('returns false for an empty signature', async () => {
    expect(await verifyLemonSqueezySignature(body, '', secret)).toBe(false);
  });

  it('is case-insensitive on the hex signature', async () => {
    expect(await verifyLemonSqueezySignature(body, VALID_SIG.toUpperCase(), secret)).toBe(true);
  });
});
