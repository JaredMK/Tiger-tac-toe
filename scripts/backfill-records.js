'use strict';
// Once, when records and per-mini-game stats arrived: every player's records recounted from their game
// history (the Find Match record from Find Match games, ranked and casual ones included; the friends
// record from friend-code games; squares won and lost per mini-game from both). The deploy workflow runs
// it after deploying; it does nothing once done (--force runs it again). It prints only counts.
//
//   node scripts/backfill-records.js [--force]      (GOOGLE_APPLICATION_CREDENTIALS: a service-account key)
const path = require('node:path');
const admin = require(path.join(__dirname, '..', 'functions', 'node_modules', 'firebase-admin'));
const R = require(path.join(__dirname, '..', 'functions', 'serverRules.js'));

const PROJECT = process.env.TTC_PROJECT || 'tic-tac-chaos';
const MARK = 'meta/backfill/records1';
(async () => {
  admin.initializeApp({ projectId: PROJECT, databaseURL: `https://${PROJECT}-default-rtdb.firebaseio.com` });
  const db = admin.database();
  if ((await db.ref(MARK).get()).val() && !process.argv.includes('--force')) { console.log('Records were back-filled already: nothing to do.'); await admin.app().delete(); return; }
  const users = (await db.ref('users').get()).val() || {};
  const history = (await db.ref('history').get()).val() || {};
  let up = {}, players = 0, games = 0;
  const flush = async () => { if (Object.keys(up).length) await db.ref().update(up); up = {}; };
  for (const [uid, u] of Object.entries(users)) {
    if (!u || !u.username) continue;
    const entries = Object.values(history[uid] || {});
    const r = R.recountHistory(entries);
    for (const k of ['wins', 'losses', 'draws', 'games']) up[`users/${uid}/${k}`] = r.main[k];
    up[`users/${uid}/friend`] = r.friend;
    up[`users/${uid}/minis`] = Object.keys(r.minis).length ? r.minis : null;
    players++; games += entries.length;
    if (Object.keys(up).length > 400) await flush();
  }
  await flush();
  await db.ref(MARK).set({ at: Date.now(), players });
  console.log(`Back-filled the records of ${players} player${players === 1 ? '' : 's'} from ${games} game${games === 1 ? '' : 's'} of history.`);
  await admin.app().delete();
})().catch(e => { console.log('::error::' + e.message); process.exit(1); });
