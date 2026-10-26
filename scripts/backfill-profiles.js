'use strict';
// Once, when the public profiles arrived (profiles/{uid}: what other players may read of an account, now that
// users/{uid}, history and oppStats are the owner's alone; security review F9/F11/F15): every account's public
// profile written from its users/{uid} (functions/serverRules.js publicProfile, the same shape the server keeps
// from then on: claimUsername, finishGame, the profileSync trigger). The deploy workflow runs it after deploying
// (both environments); it does nothing once done (--force runs it again). It prints only counts.
//
//   node scripts/backfill-profiles.js [--force]      (GOOGLE_APPLICATION_CREDENTIALS: a service-account key)
const path = require('node:path');
const admin = require(path.join(__dirname, '..', 'functions', 'node_modules', 'firebase-admin'));
const R = require(path.join(__dirname, '..', 'functions', 'serverRules.js'));

const PROJECT = process.env.TTC_PROJECT || 'tic-tac-chaos';
const MARK = 'meta/backfill/profiles1';
(async () => {
  admin.initializeApp({ projectId: PROJECT, databaseURL: `https://${PROJECT}-default-rtdb.firebaseio.com` });
  const db = admin.database();
  if ((await db.ref(MARK).get()).val() && !process.argv.includes('--force')) { console.log('Profiles were back-filled already: nothing to do.'); await admin.app().delete(); return; }
  const users = (await db.ref('users').get()).val() || {};
  const have = (await db.ref('profiles').get()).val() || {};
  let up = {}, written = 0, removed = 0;
  const flush = async () => { if (Object.keys(up).length) await db.ref().update(up); up = {}; };
  for (const [uid, u] of Object.entries(users)) {
    const p = R.publicProfile(u);
    if (!p) continue;                                            // (no username yet: nothing to show)
    up[`profiles/${uid}`] = p; written++;
    if (Object.keys(up).length > 200) await flush();
  }
  for (const uid of Object.keys(have)) if (!users[uid]) { up[`profiles/${uid}`] = null; removed++; }   // a profile whose account is gone
  await flush();
  await db.ref(MARK).set({ at: Date.now(), written, removed });
  console.log(`Wrote the public profile of ${written} account${written === 1 ? '' : 's'}${removed ? `, removed ${removed} without an account` : ''}.`);
  await admin.app().delete();
})().catch(e => { console.log('::error::' + e.message); process.exit(1); });
