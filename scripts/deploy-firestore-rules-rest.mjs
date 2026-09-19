import { createHash, createSign } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const projectId = process.env.FIREBASE_PROJECT_ID || 'tarot-pavilion';
const credentialPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const rulesPath = process.env.FIRESTORE_RULES_PATH || 'firestore.rules';
const expectedCurrentHash = process.env.FIRESTORE_EXPECTED_CURRENT_HASH;

if (!credentialPath) {
  throw new Error('GOOGLE_APPLICATION_CREDENTIALS must point to a service-account JSON file outside the repository.');
}

const base64url = (value) => Buffer.from(value).toString('base64url');
const hash = (value) => createHash('sha256').update(value).digest('hex');
const requestJson = async (url, options = {}) => {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = body?.error?.message || `${response.status} ${response.statusText}`;
    throw new Error(message);
  }
  return body;
};

const credential = JSON.parse(await readFile(credentialPath, 'utf8'));
if (credential.type !== 'service_account' || credential.project_id !== projectId) {
  throw new Error(`The service account does not belong to ${projectId}.`);
}

const now = Math.floor(Date.now() / 1000);
const encodedHeader = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
const encodedClaim = base64url(JSON.stringify({
  iss: credential.client_email,
  scope: 'https://www.googleapis.com/auth/firebase',
  aud: 'https://oauth2.googleapis.com/token',
  iat: now,
  exp: now + 3600,
}));
const unsignedJwt = `${encodedHeader}.${encodedClaim}`;
const signer = createSign('RSA-SHA256');
signer.update(unsignedJwt);
signer.end();
const assertion = `${unsignedJwt}.${signer.sign(credential.private_key, 'base64url')}`;
const token = await requestJson('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  }),
});
const authorization = { authorization: `Bearer ${token.access_token}` };
const apiBase = `https://firebaserules.googleapis.com/v1/projects/${projectId}`;
const releaseUrl = `${apiBase}/releases/cloud.firestore`;
const rulesContent = await readFile(rulesPath, 'utf8');

const currentRelease = await requestJson(releaseUrl, { headers: authorization });
const currentRuleset = await requestJson(`https://firebaserules.googleapis.com/v1/${currentRelease.rulesetName}`, { headers: authorization });
const currentContent = currentRuleset.source?.files?.find((file) => file.name === 'firestore.rules')?.content || '';
console.log(`Current ruleset: ${currentRelease.rulesetName} (${hash(currentContent).slice(0, 12)})`);

if (currentContent === rulesContent) {
  console.log(`Firestore rules already match ${hash(rulesContent).slice(0, 12)}; no release change needed.`);
  process.exit(0);
}

if (expectedCurrentHash && !hash(currentContent).startsWith(expectedCurrentHash)) {
  throw new Error('Live rules changed since the recorded release; compare them before publishing.');
}

const recentRulesets = await requestJson(`${apiBase}/rulesets?pageSize=10`, { headers: authorization });
let created = null;
for (const candidate of recentRulesets.rulesets || []) {
  const fullRuleset = await requestJson(`https://firebaserules.googleapis.com/v1/${candidate.name}`, { headers: authorization });
  const candidateContent = fullRuleset.source?.files?.find((file) => file.name === 'firestore.rules')?.content || '';
  if (candidateContent === rulesContent) {
    created = fullRuleset;
    break;
  }
}
created ||= await requestJson(`${apiBase}/rulesets`, {
  method: 'POST',
  headers: { ...authorization, 'content-type': 'application/json' },
  body: JSON.stringify({ source: { files: [{ name: 'firestore.rules', content: rulesContent }] } }),
});
await requestJson(releaseUrl, {
  method: 'PATCH',
  headers: { ...authorization, 'content-type': 'application/json' },
  body: JSON.stringify({
    release: { name: currentRelease.name, rulesetName: created.name },
    updateMask: 'rulesetName',
  }),
});

const verifiedRelease = await requestJson(releaseUrl, { headers: authorization });
const verifiedRuleset = await requestJson(`https://firebaserules.googleapis.com/v1/${verifiedRelease.rulesetName}`, { headers: authorization });
const verifiedContent = verifiedRuleset.source?.files?.find((file) => file.name === 'firestore.rules')?.content || '';
if (verifiedRelease.rulesetName !== created.name || verifiedContent !== rulesContent) {
  throw new Error('Firestore rules were updated but the read-back verification did not match.');
}
console.log(`Published ruleset: ${created.name} (${hash(verifiedContent).slice(0, 12)})`);
