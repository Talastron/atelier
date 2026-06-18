import { SignJWT, importPKCS8 } from 'jose';

export interface ServiceAccount {
  client_email: string;
  private_key: string;
}

export async function getGoogleAccessToken(
  serviceAccount: ServiceAccount,
  scopes: string[]
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const privateKey = await importPKCS8(serviceAccount.private_key, 'RS256');

  const jwt = await new SignJWT({ scope: scopes.join(' ') })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(serviceAccount.client_email)
    .setSubject(serviceAccount.client_email)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(privateKey);

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    throw new Error(`Google token exchange failed: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as { access_token: string; expires_in: number };
  return data.access_token;
}

/** Parses a base64-encoded service account JSON env var into a ServiceAccount object. */
export function parseServiceAccount(base64Json: string): ServiceAccount {
  const json = atob(base64Json);
  const obj = JSON.parse(json) as ServiceAccount;
  if (!obj.client_email) {
    throw new Error('Invalid service account: missing client_email');
  }
  if (!obj.private_key) {
    throw new Error('Invalid service account: missing private_key');
  }
  return obj;
}
