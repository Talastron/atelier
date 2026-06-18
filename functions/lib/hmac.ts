/**
 * Verify a Lemon Squeezy webhook signature.
 *
 * LS signs every webhook with HMAC-SHA256 over the raw request body, using the
 * signing secret configured in the LS dashboard. The signature arrives in the
 * `X-Signature` header as a lowercase hex string.
 */
export async function verifyLemonSqueezySignature(
  body: string,
  signature: string,
  secret: string
): Promise<boolean> {
  if (!signature) return false;

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signed = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
    const expectedHex = Array.from(new Uint8Array(signed))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return constantTimeEquals(expectedHex, signature.toLowerCase());
  } catch {
    return false;
  }
}

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
