const ID_TOOLKIT_BASE = 'https://identitytoolkit.googleapis.com/v1';

export interface UserResult {
  uid: string;
  email: string;
  created: boolean;
}

export async function findOrCreateUserByEmail(
  accessToken: string,
  projectId: string,
  email: string
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
  const lookupData = (await lookupResp.json()) as { users?: Array<{ localId: string; email: string }> };

  if (lookupData.users && lookupData.users.length > 0) {
    return { uid: lookupData.users[0].localId, email: lookupData.users[0].email, created: false };
  }

  const createResp = await fetch(
    `${ID_TOOLKIT_BASE}/projects/${projectId}/accounts`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, emailVerified: true }),
    }
  );
  if (!createResp.ok) throw new Error(`Create user failed: ${createResp.status} ${await createResp.text()}`);
  const createData = (await createResp.json()) as { localId: string };
  return { uid: createData.localId, email, created: true };
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
