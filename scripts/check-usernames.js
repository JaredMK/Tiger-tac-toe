'use strict';
// Every existing username checked against the username rules (the word list included), once per
// version of the rules: names that would be refused today are listed for the admin, in review/flaggedNames
// (readable by the admin only, shown on the stats dashboard). Nothing is changed. The deploy workflow
// runs it after deploying; the log shows only counts, never a name (the log of a public repository is
// public). --force checks again.
//
//   node scripts/check-usernames.js [--force]      (GOOGLE_APPLICATION_CREDENTIALS: a service-account key)
const path = require('node:path');
const admin = require(path.join(__dirname, '..', 'functions', 'node_modules', 'firebase-admin'));
const R = require(path.join(__dirname, '..', 'functions', 'serverRules.js'));

const PROJECT = process.env.TTC_PROJECT || 'tic-tac-chaos';
const VERSION = 'ldnoobw-5faf2ba-1';                         // the rules this check used: a new version checks every name again
const MARK = 'meta/nameCheck/' + VERSION;
(async () => {
  admin.initializeApp({ projectId: PROJECT, databaseURL: `https://${PROJECT}-default-rtdb.firebaseio.com` });
  const db = admin.database();
  if ((await db.ref(MARK).get()).val() && !process.argv.includes('--force')) { console.log('Usernames were checked against these rules already: nothing to do.'); await admin.app().delete(); return; }
  const users = (await db.ref('users').get()).val() || {};
  const names = {};
  let checked = 0;
  for (const [uid, u] of Object.entries(users)) {
    if (!u || typeof u.username !== 'string') continue;
    checked++;
    const why = R.usernameProblem(u.username);
    if (why) names[uid] = { username: u.username, why, word: R.badWordIn(u.username) || null };
  }
  const count = Object.keys(names).length, at = Date.now();
  await db.ref('review/flaggedNames').set({ at, rules: VERSION, checked, count, names: count ? names : null });
  await db.ref(MARK).set({ at, checked, count });
  console.log(`Checked ${checked} username${checked === 1 ? '' : 's'}: ${count} would be refused today (listed for the admin on the dashboard; none changed).`);
  await admin.app().delete();
})().catch(e => { console.log('::error::' + e.message); process.exit(1); });
