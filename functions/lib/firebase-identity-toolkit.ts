const ID_TOOLKIT_BASE = 'https://identitytoolkit.googleapis.com/v1';

export interface UserResult {
  uid: string;
  email: string;
  created: boolean;
  /** Whether the user has a displayName set on their Firebase Auth profile. */
  hasDisplayName: boolean;
}

export async function findOrCreateUserByEmail(
  accessToken: string,
  projectId: string,
  email: string,
  displayName?: string
): Promise<UserResult> {
  const lookupResp = await fetch(
    `${ID_TOOLKIT_BASE}/projects/${projectId}/accounts:lookup`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: [email] }),
    }
  );
  if (!lookupResp.ok) throw new Error(`Lookup failed: ${lookupResp.status} ${await lookupResp.text()}`);
  const lookupData = (await lookupResp.json()) as {
    users?: Array<{ localId: string; email: string; displayName?: string }>;
  };

  if (lookupData.users && lookupData.users.length > 0) {
    const existing = lookupData.users[0];
    return {
      uid: existing.localId,
      email: existing.email,
      created: false,
      hasDisplayName: !!existing.displayName,
    };
  }

  const createBody: Record<string, unknown> = { email, emailVerified: true };
  if (displayName) createBody.displayName = displayName;

  const createResp = await fetch(
    `${ID_TOOLKIT_BASE}/projects/${projectId}/accounts`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(createBody),
    }
  );
  if (!createResp.ok) throw new Error(`Create user failed: ${createResp.status} ${await createResp.text()}`);
  const createData = (await createResp.json()) as { localId: string };
  return { uid: createData.localId, email, created: true, hasDisplayName: !!displayName };
}

/**
 * Set or update the Firebase Auth displayName for an existing user.
 * Used by the webhook to backfill names for users whose accounts were
 * created before displayName was being captured from LS payloads.
 */
export async function updateUserDisplayName(
  accessToken: string,
  projectId: string,
  uid: string,
  displayName: string
): Promise<void> {
  const resp = await fetch(
    `${ID_TOOLKIT_BASE}/projects/${projectId}/accounts:update`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ localId: uid, displayName }),
    }
  );
  if (!resp.ok) throw new Error(`updateUserDisplayName failed: ${resp.status} ${await resp.text()}`);
}

export async function sendSignInLink(
  accessToken: string,
  projectId: string,
  email: string,
  continueUrl: string
): Promise<void> {
  const resp = await fetch(
    `${ID_TOOLKIT_BASE}/projects/${projectId}/accounts:sendOobCode`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestType: 'EMAIL_SIGNIN', email, continueUrl }),
    }
  );
  if (!resp.ok) throw new Error(`sendSignInLink failed: ${resp.status} ${await resp.text()}`);
}
