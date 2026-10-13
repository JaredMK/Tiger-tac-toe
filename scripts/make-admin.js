'use strict';
// Gives (or takes back) the admin flag that opens the stats dashboard (admin.html). The flag is a
// custom claim on the account (`admin: true`); the database rules let only that account read the stats.
//
//   node scripts/make-admin.js <username> [grant|revoke]
//
// It needs a service-account key for the project in GOOGLE_APPLICATION_CREDENTIALS (the "Make admin"
// workflow sets that up from the FIREBASE_SERVICE_ACCOUNT secret). It prints nothing secret.
const path = require('node:path');
const admin = require(path.join(__dirname, '..', 'functions', 'node_modules', 'firebase-admin'));

const PROJECT = process.env.TTC_PROJECT || 'tic-tac-chaos';
(async () => {
  const name = String(process.argv[2] || '').trim(), action = process.argv[3] || 'grant';
  if (!/^[A-Za-z0-9_]{3,16}$/.test(name)) throw new Error('Give the username: 3 to 16 letters, numbers or underscores.');
  if (!['grant', 'revoke'].includes(action)) throw new Error('The action is grant or revoke.');
  admin.initializeApp({ projectId: PROJECT, databaseURL: `https://${PROJECT}-default-rtdb.firebaseio.com` });
  const uid = (await admin.database().ref(`usernames/${name.toLowerCase()}`).get()).val();
  if (!uid) throw new Error(`No player has the username ${name}. Log in to the game and pick it first.`);
  const user = await admin.auth().getUser(uid);
  const claims = Object.assign({}, user.customClaims || {});
  if (action === 'grant') claims.admin = true; else delete claims.admin;
  await admin.auth().setCustomUserClaims(uid, claims);
  console.log(action === 'grant'
    ? `${name} is now the admin. Open admin.html and log in with that account (if it was open, sign out and in again).`
    : `${name} is no longer an admin.`);
  await admin.app().delete();
})().catch(e => { console.log('::error::' + e.message); process.exit(1); });
