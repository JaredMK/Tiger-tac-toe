'use strict';
// Once, when Top opponents arrived: every player's record against each opponent with an account
// (oppStats/{uid}/{opp}) counted from their game history (Find Match and friend games; never a match
// against a bot, from either side). The server keeps it up from then on. The deploy workflow runs it after
// deploying; it does nothing once done (--force counts it again from scratch). It prints only counts.
//
//   node scripts/backfill-opponents.js [--force]      (GOOGLE_APPLICATION_CREDENTIALS: a service-account key)
const path = require('node:path');
const admin = require(path.join(__dirname, '..', 'functions', 'node_modules', 'firebase-admin'));
const { oppTally } = require(path.join(__dirname, '..', 'src', 'core', 'stats.js'));

const PROJECT = process.env.TTC_PROJECT || 'tic-tac-chaos';
const MARK = 'meta/backfill/opponents1';
(async () => {
  admin.initializeApp({ projectId: PROJECT, databaseURL: `https://${PROJECT}-default-rtdb.firebaseio.com` });
  const db = admin.database();
  if ((await db.ref(MARK).get()).val() && !process.argv.includes('--force')) { console.log('Opponents were back-filled already: nothing to do.'); await admin.app().delete(); return; }
  const [users, history, bots] = await Promise.all(['users', 'history', 'bots'].map(p => db.ref(p).get().then(s => s.val() || {})));
  const skip = h => !!bots[h.opponent.uid];
  let up = {}, players = 0, pairs = 0;
  const flush = async () => { if (Object.keys(up).length) await db.ref().update(up); up = {}; };
  for (const [uid, u] of Object.entries(users)) {
    if (!u || !u.username || bots[uid]) continue;
    const t = oppTally(Object.values(history[uid] || {}), skip), n = Object.keys(t).length;
    up[`oppStats/${uid}`] = n ? t : null;
    if (n) { players++; pairs += n; }
    if (Object.keys(up).length > 400) await flush();
  }
  await flush();
  await db.ref(MARK).set({ at: Date.now(), players });
  console.log(`Back-filled the opponents of ${players} player${players === 1 ? '' : 's'} (${pairs} pair${pairs === 1 ? '' : 's'}) from their game history.`);
  await admin.app().delete();
})().catch(e => { console.log('::error::' + e.message); process.exit(1); });
