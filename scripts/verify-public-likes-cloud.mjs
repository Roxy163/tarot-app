// Explicitly opt in to a temporary like/unlike check on an existing public reading.
// No public posts, profiles, or private readings are created or changed.
import assert from 'node:assert/strict';
import { createSign, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const projectId = 'tarot-pavilion';
if (process.env.VERIFY_PUBLIC_LIKES_CLOUD !== projectId) throw new Error('Explicit production verification opt-in is required.');
const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!credentialPath) throw new Error('GOOGLE_APPLICATION_CREDENTIALS is required.');
const credential = JSON.parse(await readFile(credentialPath, 'utf8'));
if (credential.type !== 'service_account' || credential.project_id !== projectId) throw new Error('Wrong credential project.');
const env = Object.fromEntries((await readFile('.env', 'utf8')).split(/\r?\n/).filter(line => line && !line.startsWith('#') && line.includes('='))
  .map(line => { const at = line.indexOf('='); return [line.slice(0, at), line.slice(at + 1).replace(/^["']|["']$/g, '')]; }));
if (env.VITE_FIREBASE_PROJECT_ID !== projectId || !env.VITE_FIREBASE_API_KEY) throw new Error('Wrong frontend project.');
const authBase = `https://identitytoolkit.googleapis.com/v1/accounts:`;
const database = `projects/${projectId}/databases/(default)/documents`;
const base = `https://firestore.googleapis.com/v1/${database}`;
const accounts = [];
const b64 = value => Buffer.from(JSON.stringify(value)).toString('base64url');
const headers = token => ({ 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) });
async function request(url, options = {}, expected = [200]) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(15000) });
  const body = await response.json().catch(() => ({}));
  if (!expected.includes(response.status)) throw new Error(`${response.status}: ${body?.error?.message || response.statusText}`);
  return { status: response.status, body };
}
async function createAccount() {
  const uid = `codex-like-check-${randomUUID()}`;
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ iss: credential.client_email, sub: credential.client_email,
    aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit', iat: now, exp: now + 3600, uid })}`;
  const signer = createSign('RSA-SHA256'); signer.update(unsigned); signer.end();
  const result = await request(`${authBase}signInWithCustomToken?key=${encodeURIComponent(env.VITE_FIREBASE_API_KEY)}`, {
    method: 'POST', headers: headers(), body: JSON.stringify({ token: `${unsigned}.${signer.sign(credential.private_key, 'base64url')}`, returnSecureToken: true }),
  });
  const account = { uid, token: result.body.idToken };
  accounts.push(account);
  assert.equal(JSON.parse(Buffer.from(account.token.split('.')[1], 'base64url').toString('utf8')).sub, uid);
  return account;
}
const results = await request(`${base}:runQuery`, { method: 'POST', headers: headers(), body: JSON.stringify({ structuredQuery: {
  from: [{ collectionId: 'publicReadings' }], where: { fieldFilter: { field: { fieldPath: 'isPublic' }, op: 'EQUAL', value: { booleanValue: true } } }, limit: 10,
} }) });
const target = results.body.find(row => row.document && row.document.fields?.moderationStatus?.stringValue !== 'hidden')?.document;
if (!target) throw new Error('No existing public reading available; no test accounts were created.');
const readingId = target.name.split('/').at(-1);
const totalPath = `publicReadingReactions/${readingId}`;
const ownPath = uid => `users/${uid}/publicLikes/${readingId}`;
const read = (path, token, expected = [200, 404]) => request(`${base}/${path}`, { headers: headers(token) }, expected);
const commit = (writes, token, expected = [200]) => request(`${base}:commit`, { method: 'POST', headers: headers(token), body: JSON.stringify({ writes }) }, expected);
const counterWrite = delta => ({ update: { name: `${database}/${totalPath}`, fields: {} }, updateMask: { fieldPaths: [] }, updateTransforms: [{ fieldPath: 'count', increment: { integerValue: String(delta) } }] });
const likeWrite = account => ({ update: { name: `${database}/${ownPath(account.uid)}`, fields: { active: { booleanValue: true } } }, currentDocument: { exists: false } });
async function setLike(account, desired) {
  const own = await read(ownPath(account.uid), account.token);
  if ((own.status === 200) === desired) return;
  await commit([desired ? likeWrite(account) : { delete: `${database}/${ownPath(account.uid)}`, currentDocument: { updateTime: own.body.updateTime } }, counterWrite(desired ? 1 : -1)], account.token);
}
const count = async () => Number((await read(totalPath)).body.fields?.count?.integerValue || 0);
let checks = 0;
async function check(label, run) { await run(); checks++; console.log(`PASS ${label}`); }
let cleanupFailed = false;
try {
  const alice = await createAccount();
  const bob = await createAccount();
  // Allow bounded propagation of the newly published rules before performing writes.
  for (let attempt = 0; ; attempt++) {
    const ready = await read(ownPath(alice.uid), alice.token, [200, 403, 404]);
    if (ready.status !== 403) break;
    if (attempt === 11) throw new Error('New rules have not propagated.');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  const baseline = await count();
  await check('guest like is rejected', () => commit([likeWrite(alice), counterWrite(1)], undefined, [403]));
  await check('counter cannot be increased alone', () => commit([counterWrite(1)], alice.token, [403]));
  await check('like succeeds and is readable by its owner', async () => {
    await setLike(alice, true);
    assert.equal((await read(ownPath(alice.uid), alice.token)).body.fields?.active?.booleanValue, true);
    assert.equal(await count(), baseline + 1);
  });
  await check('repeat desired state is idempotent', async () => { await setLike(alice, true); assert.equal(await count(), baseline + 1); });
  await check('another account cannot read the private like', () => read(ownPath(alice.uid), bob.token, [403]));
  await check('another account cannot remove the private like', () => commit([{ delete: `${database}/${ownPath(alice.uid)}` }, counterWrite(-1)], bob.token, [403]));
  await check('a second reader adds only one vote', async () => { await setLike(bob, true); assert.equal(await count(), baseline + 2); });
  await check('cancelling both likes restores the original total', async () => {
    await Promise.all([setLike(alice, false), setLike(bob, false)]);
    assert.equal(await count(), baseline);
    assert.equal((await read(ownPath(alice.uid), alice.token)).status, 404);
    assert.equal((await read(ownPath(bob.uid), bob.token)).status, 404);
  });
  console.log(`${checks} real cloud checks passed.`);
} finally {
  for (const account of accounts) {
    try {
      await setLike(account, false);
      assert.equal((await read(ownPath(account.uid), account.token)).status, 404);
      await request(`${authBase}delete?key=${encodeURIComponent(env.VITE_FIREBASE_API_KEY)}`, {
        method: 'POST', headers: headers(), body: JSON.stringify({ idToken: account.token }),
      });
      console.log(`Temporary account and like removed: ${account.uid}`);
    } catch (error) {
      cleanupFailed = true;
      console.error(`Cleanup requires attention for ${account.uid}: ${error.message}`);
    }
  }
  if (cleanupFailed) throw new Error('Temporary verification cleanup did not complete.');
}
