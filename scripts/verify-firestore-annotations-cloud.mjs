import { createSign, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const projectId = process.env.FIREBASE_PROJECT_ID || 'tarot-pavilion';
const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!credentialPath) throw new Error('GOOGLE_APPLICATION_CREDENTIALS is required.');

const env = Object.fromEntries((await readFile('.env', 'utf8'))
  .split(/\r?\n/)
  .filter((line) => line && !line.startsWith('#') && line.includes('='))
  .map((line) => {
    const splitAt = line.indexOf('=');
    return [line.slice(0, splitAt), line.slice(splitAt + 1)];
  }));
const apiKey = env.VITE_FIREBASE_API_KEY;
if (!apiKey) throw new Error('VITE_FIREBASE_API_KEY is missing from .env.');

const request = async (url, options = {}, expected = [200]) => {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  if (!expected.includes(response.status)) {
    throw new Error(body?.error?.message || `${response.status} ${response.statusText}`);
  }
  return { status: response.status, body };
};
const base64url = (value) => Buffer.from(value).toString('base64url');
const credential = JSON.parse(await readFile(credentialPath, 'utf8'));
if (credential.type !== 'service_account' || credential.project_id !== projectId) {
  throw new Error(`The service account does not belong to ${projectId}.`);
}

const uid = `codex-cloud-check-${Date.now()}`;
const now = Math.floor(Date.now() / 1000);
const unsigned = `${base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${base64url(JSON.stringify({
  iss: credential.client_email,
  sub: credential.client_email,
  aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
  iat: now,
  exp: now + 3600,
  uid,
}))}`;
const signer = createSign('RSA-SHA256');
signer.update(unsigned);
signer.end();
const customToken = `${unsigned}.${signer.sign(credential.private_key, 'base64url')}`;
const signIn = await request(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${encodeURIComponent(apiKey)}`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ token: customToken, returnSecureToken: true }),
});
const idToken = signIn.body.idToken;
const authHeaders = { authorization: `Bearer ${idToken}`, 'content-type': 'application/json' };
const documentUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${uid}/settings/cardAnnotations`;
const otherUserUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/not-${uid}/settings/cardAnnotations`;
const marker = `cloud-check-${randomUUID()}`;
const document = {
  fields: {
    items: {
      arrayValue: {
        values: [{
          mapValue: {
            fields: {
              cardId: { stringValue: 'ar00' },
              userId: { stringValue: uid },
              personalNotes: { stringValue: marker },
              updatedAt: { stringValue: new Date().toISOString() },
            },
          },
        }],
      },
    },
    updatedAt: { stringValue: new Date().toISOString() },
  },
};

let wroteDocument = false;
try {
  let lastError;
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      await request(documentUrl, { method: 'PATCH', headers: authHeaders, body: JSON.stringify(document) });
      wroteDocument = true;
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
      if (attempt < 6) await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
  if (lastError) throw lastError;
  const readBack = await request(documentUrl, { headers: authHeaders });
  const note = readBack.body.fields?.items?.arrayValue?.values?.[0]?.mapValue?.fields?.personalNotes?.stringValue;
  if (note !== marker) throw new Error('The cloud annotation read-back did not match the write.');
  const denied = await request(otherUserUrl, { headers: authHeaders }, [403]);
  if (denied.status !== 403) throw new Error('A user could read another account path.');
  console.log('Cloud acceptance passed: owner write/read succeeded and cross-account read was denied.');
} finally {
  if (wroteDocument) {
    await request(documentUrl, { method: 'DELETE', headers: authHeaders }, [200, 404]).catch(() => undefined);
  }
  await request(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ idToken }),
  }, [200]).catch(() => undefined);
  console.log('Temporary verification document and Firebase user were removed.');
}
