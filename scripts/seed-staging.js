'use strict';
// Seeds staging with its people: a few test accounts and the admin's account (with the admin flag), each with a
// username and on the staging allowlist. No production data is copied, and it refuses to run on production.
// It is idempotent (an account already there is left as it is, its flags and list entry made sure of), so the
// staging deploy runs it every time. It prints the accounts' emails and usernames, never a password.
//   TTC_PROJECT=<staging project> node scripts/seed-staging.js
// From the workflow's secrets and variables:
//   STAGING_TEST_PASSWORD     the test accounts' password (they are skipped without it)
//   STAGING_ADMIN_EMAIL       the admin's email: they log in to staging with Google (or a password reset) as that address
//   STAGING_ADMIN_USERNAME    the admin's username on staging
const path = require('node:path');
const admin = require(path.join(__dirname, '..', 'functions', 'node_modules', 'firebase-admin'));
const { START_RATING } = require(path.join(__dirname, '..', 'functions', 'serverRules.js'));
const { PRODUCTION_PROJECT } = require('./build-site.js');

const PROJECT = process.env.TTC_PROJECT;
const TESTERS = [1, 2, 3].map(n => ({ email: `tester${n}@tictacchaos.com`, username: `Tester${n}` }));
const allowKey = email => String(email || '').trim().toLowerCase().replace(/[.#$[\]/]/g, ',');   // (functions/index.js allowKey)

async function seed(db, auth, who, { password, admin: isAdmin }) {
  let u;
  try { u = await auth.getUserByEmail(who.email); }
  catch (e) {
    if (e.code !== 'auth/user-not-found') throw e;
    u = await auth.createUser(Object.assign({ email: who.email, emailVerified: true, displayName: who.username }, password ? { password } : {}));
  }
  if (password && !u.providerData.some(p => p.providerId === 'password')) await auth.updateUser(u.uid, { password });   // (set once: changing it would sign the account out)
  const claims = Object.assign({}, u.customClaims || {}, { staging: true }, isAdmin ? { admin: true } : {});
  if (JSON.stringify(claims) !== JSON.stringify(u.customClaims || {})) await auth.setCustomUserClaims(u.uid, claims);
  if (!u.emailVerified) await auth.updateUser(u.uid, { emailVerified: true });
  const have = (await db.ref(`users/${u.uid}/username`).get()).val();
  let name = have;
  if (!have) {
    const lower = who.username.toLowerCase();
    const got = await db.ref(`usernames/${lower}`).transaction(cur => (cur === null || cur === u.uid ? u.uid : undefined));
    if (!got.committed) throw new Error(`The username ${who.username} is taken on staging by another account.`);
    await db.ref(`users/${u.uid}`).update({ username: who.username, rating: START_RATING, wins: 0, losses: 0, draws: 0, games: 0, joined: Date.now() });
    name = who.username;
  }
  await db.ref(`admin/staging/allow/${allowKey(who.email)}`).set({ email: who.email.toLowerCase(), by: 'seed' });
  console.log(`${isAdmin ? 'admin ' : 'tester'} ${who.email} as ${name}${isAdmin ? ' (admin flag)' : ''}: ready`);
}

(async () => {
  if (!PROJECT || PROJECT === PRODUCTION_PROJECT || /PASTE_/.test(PROJECT)) throw new Error(`Refusing to seed "${PROJECT || '(no project)'}": this is for staging only.`);
  admin.initializeApp({ projectId: PROJECT, databaseURL: `https://${PROJECT}-default-rtdb.firebaseio.com` });
  const db = admin.database(), auth = admin.auth();
  const pass = process.env.STAGING_TEST_PASSWORD || '';
  if (pass.length >= 8) for (const t of TESTERS) await seed(db, auth, t, { password: pass });
  else console.log('::warning::STAGING_TEST_PASSWORD is not set (8 characters or more): the test accounts are not seeded.');
  const email = String(process.env.STAGING_ADMIN_EMAIL || '').trim().toLowerCase(), uname = String(process.env.STAGING_ADMIN_USERNAME || '').trim();
  if (email && /^[A-Za-z0-9_]{3,16}$/.test(uname)) await seed(db, auth, { email, username: uname }, { admin: true });
  else console.log('::warning::STAGING_ADMIN_EMAIL and STAGING_ADMIN_USERNAME are not both set: the admin account is not seeded.');
  await admin.app().delete();
})().catch(e => { console.log('::error::' + e.message); process.exit(1); });
