// Run only against the isolated demo Firestore emulator, never production.
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase/app';
import { connectFirestoreEmulator, deleteDoc, doc, getDoc, getDocs, getFirestore, collection, increment, runTransaction, setDoc, terminate, writeBatch } from 'firebase/firestore';

const host = process.env.FIRESTORE_EMULATOR_HOST;
if (host !== '127.0.0.1:8180') throw new Error('Start the isolated demo emulator on 127.0.0.1:8180 first.');
const projectId = 'demo-tarot-square';
const base = `http://${host}/v1/projects/${projectId}/databases/(default)/documents`;
const apps = [];
const databases = [];
function client(uid) {
  const app = initializeApp({ projectId }, uid || 'guest'); apps.push(app);
  const db = getFirestore(app); databases.push(db);
  connectFirestoreEmulator(db, '127.0.0.1', 8180, uid ? { mockUserToken: { sub: uid, user_id: uid } } : {});
  return db;
}
const alice = client('alice'); const bob = client('bob'); const guest = client();
const total = db => doc(db, 'publicReadingReactions', 'reading-1');
const mine = (db, uid, id = 'reading-1') => doc(db, 'users', uid, 'publicLikes', id);
const denied = promise => assert.rejects(promise, error => error.code === 'permission-denied');
let checks = 0;
async function check(name, run) { await run(); checks++; console.log(`PASS ${name}`); }
async function seed(id, visible = true) {
  const response = await fetch(`${base}/publicReadings/${id}`, {
    method: 'PATCH', headers: { authorization: 'Bearer owner', 'content-type': 'application/json' },
    body: JSON.stringify({ fields: { isPublic: { booleanValue: visible }, question: { stringValue: '模拟器测试' }, date: { stringValue: '2026-09-18' }, cards: { arrayValue: { values: [] } } } }),
  });
  if (!response.ok) throw new Error(`Seed failed: ${response.status}`);
}
async function like(db, uid, desired, id = 'reading-1') {
  const countRef = doc(db, 'publicReadingReactions', id); const userRef = mine(db, uid, id);
  await runTransaction(db, async transaction => {
    const own = await transaction.get(userRef);
    if (own.exists() === desired) return;
    if (desired) transaction.set(userRef, { active: true }); else transaction.delete(userRef);
    transaction.set(countRef, { count: increment(desired ? 1 : -1) }, { merge: true });
  });
  try { return (await getDoc(countRef)).data().count; } catch { return undefined; }
}
try {
  const cleared = await fetch(`http://${host}/emulator/v1/projects/${projectId}/databases/(default)/documents`, { method: 'DELETE' });
  if (!cleared.ok) throw new Error(`Demo reset failed: ${cleared.status}`);
  await seed('reading-1'); await seed('hidden', false);
  await check('guest cannot like', () => denied(setDoc(mine(guest, 'alice'), { active: true })));
  await check('like record alone is rejected', () => denied(setDoc(mine(alice, 'alice'), { active: true })));
  await check('counter alone is rejected', () => denied(setDoc(total(alice), { count: 1 })));
  await check('first like creates one public total and one private record', async () => assert.equal(await like(alice, 'alice', true), 1));
  await check('repeat desired state does not increment twice', async () => assert.equal(await like(alice, 'alice', true), 1));
  await check('guests can read the total', async () => assert.equal((await getDoc(total(guest))).data().count, 1));
  await check('another user cannot read a private like', () => denied(getDoc(mine(bob, 'alice'))));
  await check('another user cannot list private likes', () => denied(getDocs(collection(bob, 'users', 'alice', 'publicLikes'))));
  await check('another user cannot remove a like', () => denied(deleteDoc(mine(bob, 'alice'))));
  await check('second user cannot inflate the total', async () => {
    const batch = writeBatch(bob); batch.set(mine(bob, 'bob'), { active: true }); batch.set(total(bob), { count: 20 }); await denied(batch.commit());
  });
  await check('second user adds exactly one', async () => assert.equal(await like(bob, 'bob', true), 2));
  await check('deleting a record without decrement is rejected', () => denied(deleteDoc(mine(alice, 'alice'))));
  await check('cancelling removes only one vote', async () => assert.equal(await like(alice, 'alice', false), 1));
  await check('private reading cannot be liked', () => denied(like(alice, 'alice', true, 'hidden')));
  await check('missing reading cannot be liked', () => denied(like(alice, 'alice', true, 'missing')));
  await check('concurrent cancellation and like keep a consistent total', async () => {
    await Promise.all([like(alice, 'alice', true), like(bob, 'bob', false)]);
    assert.equal((await getDoc(total(guest))).data().count, 1);
  });
  await seed('reading-1', false);
  await check('hidden reading total is no longer public', () => denied(getDoc(total(guest))));
  await check('account cleanup can unlike after a reading is hidden', async () => {
    await like(alice, 'alice', false);
    assert.equal((await getDoc(mine(alice, 'alice'))).exists(), false);
  });
  console.log(`${checks} security checks passed; production was not contacted.`);
} finally {
  await Promise.all(databases.map(db => terminate(db)));
  await Promise.all(apps.map(app => deleteApp(app)));
}
