'use strict';
// Once, when the games played as X and as O and the admin's Accounts table arrived: every player's
// records by side recounted from their game history (users/{uid}/sides: Find Match games;
// users/{uid}/friend/sides: friend-code games; localStats/{uid}/sides: local games), and their last
// activity (lastSeen/{uid}) set from it where nothing later is known: the latest game in their history, or
// when they joined. A match against a bot is left out of the player's count when the admin keeps bot
// matches out of the records (as now set). The deploy workflow runs it after deploying; it does nothing
// once done (--force runs it again). It prints only counts.
//
//   node scripts/backfill-accounts.js [--force]      (GOOGLE_APPLICATION_CREDENTIALS: a service-account key)
const path = require('node:path');
const admin = require(path.join(__dirname, '..', 'functions', 'node_modules', 'firebase-admin'));
const R = require(path.join(__dirname, '..', 'functions', 'serverRules.js'));
const B = require(path.join(__dirname, '..', 'functions', 'bots.js'));

const PROJECT = process.env.TTC_PROJECT || 'tic-tac-chaos';
const MARK = 'meta/backfill/accounts1';
const empty = s => !(s.X.games + s.O.games);
(async () => {
  admin.initializeApp({ projectId: PROJECT, databaseURL: `https://${PROJECT}-default-rtdb.firebaseio.com` });
  const db = admin.database();
  if ((await db.ref(MARK).get()).val() && !process.argv.includes('--force')) { console.log('Accounts were back-filled already: nothing to do.'); await admin.app().delete(); return; }
  const [users, history, local, bots, config] = await Promise.all(['users', 'history', 'localHistory', 'bots', 'admin/config'].map(p => db.ref(p).get().then(s => s.val() || {})));
  const counted = B.botConfig(config).countInRecords;
  let up = {}, players = 0, games = 0;
  const flush = async () => { if (Object.keys(up).length) await db.ref().update(up); up = {}; };
  for (const [uid, u] of Object.entries(users)) {
    if (!u || !u.username) continue;
    const mine = !bots[uid];
    const skip = h => !counted && mine && h.mode !== 'friend' && h.mode !== 'local' && !!(h.opponent && h.opponent.uid && bots[h.opponent.uid]);
    const entries = Object.values(history[uid] || {}).concat(Object.values(local[uid] || {}));
    const r = R.recountSides(entries, skip);
    up[`users/${uid}/sides`] = empty(r.main) ? null : r.main;
    up[`users/${uid}/friend/sides`] = empty(r.friend) ? null : r.friend;
    if (local[uid] || !empty(r.local)) up[`localStats/${uid}/sides`] = empty(r.local) ? null : r.local;
    const latest = Math.max(Number(u.joined) || 0, ...entries.map(h => Number(h && h.date) || 0));
    if (latest && !bots[uid]) await db.ref(`lastSeen/${uid}`).transaction(cur => (Number(cur) >= latest ? undefined : latest), undefined, false);   // (never back from a later one)
    players++; games += entries.length;
    if (Object.keys(up).length > 400) await flush();
  }
  await flush();
  await db.ref(MARK).set({ at: Date.now(), players });
  console.log(`Back-filled the games by side and last activity of ${players} player${players === 1 ? '' : 's'} from ${games} game${games === 1 ? '' : 's'} of history.`);
  await admin.app().delete();
})().catch(e => { console.log('::error::' + e.message); process.exit(1); });
