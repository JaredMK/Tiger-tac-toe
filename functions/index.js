'use strict';
/* Tic Tac Chaos: the server. Cloud Functions (2nd gen) on the Realtime Database.
 *
 * Accounts: a username is claimed once, unique (case aside), through claimUsername; profiles,
 * ratings, records, the leaderboard and game history are written only here.
 *
 * Matchmaking games (ranked and casual) are run by the server alone. A phone asks for a move with
 * the `move` callable; the server checks that it is that player's turn and that the move is legal
 * (with engine.js, the same rules the page runs), makes every random choice, and writes the public
 * state. Hidden values (words, numbers, codes, cards, the treasure, the ship) stay in the game's
 * `sec` node, which no phone can read; the public state shows them only once the game reveals them.
 * The turn deadline is a server time; when it passes, either phone may ask for the timeout move
 * (`timeout`), and a scheduled sweep does it every minute for games nobody is watching.
 *
 * Database layout (see database.rules.json):
 *   users/{uid}            profile: username, joined; the Find Match record (wins, losses, draws, games), the
 *                          friend-code record (friend: { wins, losses, draws, games }), squares won and lost
 *                          per mini-game in all online games (minis: { type: { won, lost } }); rating (unused
 *                          while R.RATINGS_ENABLED is off)
 *   usernames/{lowercase}  uid
 *   leaderboard/{uid}      username, rating, record; only players with 5+ ranked games
 *   history/{uid}/{game}   one finished online game, from that player's side
 *   queue/match/{uid}      searching players (Find Match is one queue, 1 minute a turn)
 *   active/{uid}           the matchmaking game a player is in
 *   games/{id}/pub         the public game: players, mode, status, state (JSON), result, final (JSON)
 *   games/{id}/sec         the hidden values (JSON): never readable by a phone
 *   games/{id}/dl          the turn deadline (for the sweep); 1 once over and not yet recorded
 *   stats/...              anonymous game stats (see statsRules.js): readable by the admin only
 *   statsSeen/match/{id}   a match the stats have counted (its start time, whether start and end were counted)
 *   statsSeen/{d|w|m}/{period}/{hash}  a player counted as active in that day, week or month (never readable)
 *   localStats/{uid}       a logged-in player's local record and squares per mini-game (recordLocal; that player only)
 *   localHistory/{uid}/l_{id}  one local match, from player 1's side (that player only)
 *   review/flaggedNames    existing usernames the word list would refuse (scripts/check-usernames.js; admin only)
 *
 * Game stats: every match in every mode is counted. Phones report their local matches through the
 * `track` callable (which checks and trims what it is sent); online matches are counted here, where
 * they are run or saved. The admin is the account with the `admin` custom claim (scripts/make-admin.js).
 */
const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onValueWritten } = require('firebase-functions/v2/database');
const { setGlobalOptions } = require('firebase-functions/v2');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');
const { ServerValue } = require('firebase-admin/database');   // (not admin.database.ServerValue: the emulator wraps admin.database)
const crypto = require('node:crypto');
const E = require('./engine.js');
const R = require('./serverRules.js');
const S = require('./statsRules.js');
const B = require('./bots.js');

setGlobalOptions({ region: 'us-central1', maxInstances: 10, memory: '256MiB' });
const cfg = JSON.parse(process.env.FIREBASE_CONFIG || '{}');
const projectId = cfg.projectId || process.env.GCLOUD_PROJECT;
admin.initializeApp({ databaseURL: `https://${projectId}-default-rtdb.firebaseio.com` });   // the project's default database (the emulator too: same name)
const db = admin.database();

const STALE_MS = 15000;          // a searcher that has not checked in for this long has left the queue
const MATCH_GRACE_MS = 6000;     // the first turn's clock starts late: both phones load the board and show the players
const OLD_QUEUES = ['ranked', 'casual30', 'casual60', 'casual180'];   // before Find Match was one queue: left on cancel
const GAME_KEEP_MS = 24 * 3600 * 1000;   // finished games are deleted after a day (their history stays)
const CALL = { cors: true };

const now = () => Date.now();
const isAnon = req => !req.auth || !req.auth.token || !req.auth.token.firebase || req.auth.token.firebase.sign_in_provider === 'anonymous';
const seedRng = () => E.makeRng(crypto.randomBytes(16).toString('hex'));
function needUid(req) {
  if (!req.auth || !req.auth.uid) throw new HttpsError('unauthenticated', 'Log in first.');
  return req.auth.uid;
}
function needAdmin(req) {
  if (!req.auth || !req.auth.token || req.auth.token.admin !== true) throw new HttpsError('permission-denied', 'For the admin only.');
  return req.auth.uid;
}
// The admin's settings from the dashboard (admin/config): the bots and the empty-queue alert.
async function adminConfig() { return (await db.ref('admin/config').get()).val() || {}; }
function needAccount(req) {
  const uid = needUid(req);
  if (req.auth.token && req.auth.token.firebase && req.auth.token.firebase.sign_in_provider === 'anonymous') throw new HttpsError('unauthenticated', 'Log in first.');
  return uid;
}
function gameId(v) {
  if (typeof v !== 'string' || !/^[-\w]{8,40}$/.test(v)) throw new HttpsError('invalid-argument', 'No such game.');
  return v;
}
const sideOf = (pub, uid) => (pub.players.X.uid === uid ? 'X' : pub.players.O.uid === uid ? 'O' : null);
const parse = s => (typeof s === 'string' ? JSON.parse(s) : s || {});

/* ===================== stats ===================== */
// Counts to add, as one atomic multi-path update of increments (merged into `into` when given).
function statsUp(counts, into) {
  const up = into || {};
  for (const [k, n] of Object.entries(counts)) up['stats/' + k] = ServerValue.increment(n);
  return up;
}
// Players active today, this week and this month: each counted once per period (by a hash only).
async function markActive(ids, t) {
  const k = S.periodKeys(t), up = {};
  for (const id of new Set(ids.filter(Boolean))) {
    const h = S.hashId(id);
    for (const p of ['d', 'w', 'm']) {
      const r = await db.ref(`statsSeen/${p}/${k[p]}/${h}`).transaction(cur => (cur ? undefined : true), undefined, false);
      if (r.committed) up[`${S.PERIOD_NODE[p]}/${k[p]}/active`] = (up[`${S.PERIOD_NODE[p]}/${k[p]}/active`] || 0) + 1;
    }
  }
  if (Object.keys(up).length) await db.ref().update(statsUp(up));
}
// A match counted once: statsSeen/match/{id} holds its start time and whether its start and end were counted.
async function claimMatch(id, field, t) {
  let prev = null;
  const r = await db.ref(`statsSeen/match/${id}`).transaction(cur => {
    prev = cur;
    if (cur && (cur[field] || (field === 's' && cur.e))) return undefined;   // (an end counted first counted the start with it)
    return Object.assign({ t0: t }, cur || {}, { [field]: 1, s: 1 });
  }, undefined, false);
  return r.committed ? { prev } : null;
}
// A phone reports a local match (two people, vs the computer, computer vs computer) starting or
// ending, or an account logging in. Clients cannot write the stats themselves.
exports.track = onCall(CALL, async req => {
  const d = req.data || {}, t = now();
  const who = !isAnon(req) ? 'u:' + req.auth.uid : S.idOk(d.dev) ? 'd:' + d.dev : null;
  if (d.ev === 'login') {
    if (isAnon(req)) return { ok: false };
    await db.ref().update(statsUp(S.periodUpdates('logins', t)));
    await markActive([who], t);
    return { ok: true };
  }
  if (!S.CLIENT_MODES.includes(d.mode) || !S.idOk(d.id)) throw new HttpsError('invalid-argument', 'Not a match.');
  const id = 'l_' + d.id;
  if (d.ev === 'start') {
    if (!(await claimMatch(id, 's', t))) return { ok: true, seen: true };
    await db.ref().update(statsUp(S.startUpdates(d.mode, t)));
  } else if (d.ev === 'end') {
    const sum = S.checkEnd(d, E.TYPES.concat(E.OLD_TYPES));         // a match from before may still hold a Dice race
    if (!sum) throw new HttpsError('invalid-argument', 'Not a match.');
    const c = await claimMatch(id, 'e', t);
    if (!c) return { ok: true, seen: true };
    const started = !!(c.prev && c.prev.s), ms = started ? t - c.prev.t0 : Number(d.ms);
    await db.ref().update(statsUp(S.endUpdates(d.mode, sum, ms, t, !started)));   // a start never reported counts now
  } else throw new HttpsError('invalid-argument', 'Not an event.');
  await markActive([who], t);
  return { ok: true };
});

/* ===================== accounts ===================== */
exports.claimUsername = onCall(CALL, async req => {
  const uid = needAccount(req);
  const name = String((req.data && req.data.username) || '').trim();
  const problem = R.usernameProblem(name);
  if (problem) return { ok: false, reason: problem };
  const have = (await db.ref(`users/${uid}/username`).get()).val();
  if (have) return have === name ? { ok: true, username: have } : { ok: false, reason: 'You already have a username' };
  const lower = name.toLowerCase();
  const claim = await db.ref(`usernames/${lower}`).transaction(cur => (cur === null || cur === uid ? uid : undefined), undefined, false);
  if (!claim.committed) return { ok: false, reason: 'That username is taken' };
  const made = await db.ref(`users/${uid}`).transaction(cur => {
    if (cur && cur.username) return undefined;
    return { username: name, rating: R.START_RATING, wins: 0, losses: 0, draws: 0, games: 0, joined: now() };
  }, undefined, false);
  if (!made.committed) { await db.ref(`usernames/${lower}`).remove(); return { ok: false, reason: 'You already have a username' }; }
  await db.ref().update(statsUp(S.periodUpdates('newAccounts', now()))).catch(e => logger.error('stats', e));
  return { ok: true, username: name };
});

/* ===================== matchmaking ===================== */
// Find Match: joins the queue (or stays in it), pairs whoever can be paired, and answers with the
// game once there is one. The phone calls it every few seconds while searching, which keeps its place
// and lets the rating range widen; Cancel leaves the queue.
// Searching alone (no other live searcher): after a few seconds the admin is alerted (when alerts are on),
// and once the player's own randomized wait is over (40 to 70 seconds by default), a free bot is paired
// with them (when bots are on). Anyone else searching meanwhile is paired with them as usual first.
exports.findMatch = onCall(CALL, async req => {
  const uid = needAccount(req);
  const key = R.queueKey();                                     // one queue: whatever an older page asks for
  const prof = (await db.ref(`users/${uid}`).get()).val();
  if (!prof || !prof.username) throw new HttpsError('failed-precondition', 'Pick a username first.');
  const act = await activeGame(uid);
  if (act) return { status: 'matched', game: act.game, side: act.side };
  for (const other of OLD_QUEUES) await leaveQueue(other, uid);                // (from an older page)
  const conf = await adminConfig(), bc = B.botConfig(conf), ac = B.alertConfig(conf);
  const prev = (await db.ref(`queue/${key}/${uid}`).get()).val();
  const free = bc.enabled && prev && !prev.game && prev.botAt && now() >= prev.botAt ? await freeBots() : [];   // only looked up once a bot could be due
  let made = [], mine = null, alone = false, entry = null, botGame = null;
  await db.ref(`queue/${key}`).transaction(cur => {
    made = []; mine = null; alone = false; botGame = null;
    const t = now(), q = cur || {};
    for (const [u, e] of Object.entries(q)) if (!e || (!e.game && t - e.seen > STALE_MS)) delete q[u];
    const me = q[uid] || { since: t, botAt: t + B.waitMs(bc, Math.random) };
    if (!me.botAt) me.botAt = me.since + B.waitMs(bc, Math.random);
    q[uid] = Object.assign(me, { name: prof.username, seen: t, rec: recordOf(prof) }, R.RATINGS_ENABLED ? { rating: prof.rating } : {});
    for (const [a, b] of R.pairQueue(q, t)) {
      const id = db.ref('games').push().key, xFirst = crypto.randomInt(2) === 0;
      q[a] = Object.assign(q[a], { game: id, side: xFirst ? 'X' : 'O', vs: b, at: t });
      q[b] = Object.assign(q[b], { game: id, side: xFirst ? 'O' : 'X', vs: a, at: t });
      made.push({ id, a, b });
    }
    if (!q[uid].game) {
      alone = !Object.entries(q).some(([u, e]) => u !== uid && e && !e.game);
      if (alone && bc.enabled && t >= q[uid].botAt && free.length) {      // a bot takes the lone searcher on
        const bot = free[crypto.randomInt(free.length)], id = db.ref('games').push().key;
        q[uid] = Object.assign(q[uid], { game: id, side: crypto.randomInt(2) === 0 ? 'X' : 'O', vs: bot.uid, at: t });
        botGame = { id, bot };
      }
    }
    entry = Object.assign({}, q[uid]);
    mine = q[uid].game ? { game: q[uid].game, side: q[uid].side } : null;
    return q;
  }, undefined, false);
  for (const p of made) await createGame(key, p.id).catch(e => logger.error('createGame', p.id, e));
  if (botGame) await createBotGame(key, uid, botGame.id, botGame.bot).catch(e => logger.error('createBotGame', botGame.id, e));
  if (!mine) {
    const isAdmin = !!(req.auth.token && req.auth.token.admin === true);   // (the admin's own searches never alert the admin)
    if (alone && ac.enabled && !isAdmin) await maybeAlert(key, uid, entry, prof, ac).catch(e => logger.error('alert', e));
    return { status: 'searching' };
  }
  if (botGame && botGame.id === mine.game) return { status: 'matched', game: mine.game, side: mine.side };
  await createGame(key, mine.game).catch(() => {});   // made by another call: make sure it exists (it is made once)
  return { status: 'matched', game: mine.game, side: mine.side };
});
exports.cancelSearch = onCall(CALL, async req => {
  const uid = needUid(req);
  let game = null;
  for (const key of Object.keys(R.QUEUES).concat(OLD_QUEUES)) {
    await db.ref(`queue/${key}/${uid}`).transaction(cur => {
      if (cur && cur.game) { game = { game: cur.game, side: cur.side }; return undefined; }   // already paired: too late to cancel
      return null;
    }, undefined, false);
  }
  return game ? Object.assign({ status: 'matched' }, game) : { status: 'cancelled' };
});
async function leaveQueue(key, uid) {
  await db.ref(`queue/${key}/${uid}`).transaction(cur => (cur && cur.game ? undefined : null), undefined, false);
}
// The game a player is in, if it is still being played.
async function activeGame(uid) {
  const a = (await db.ref(`active/${uid}`).get()).val();
  if (!a || !a.game) return null;
  const status = (await db.ref(`games/${a.game}/pub/status`).get()).val();
  if (status === 'playing') return a;
  if (status !== 'over') await db.ref(`active/${uid}`).remove();
  return null;
}
// A player's Find Match record, as the intro and the results show it.
function recordOf(p) { return { wins: (p && p.wins) || 0, losses: (p && p.losses) || 0, draws: (p && p.draws) || 0 }; }
// A finished match added to one player's records (as increments, so nothing else written to the profile
// meanwhile is lost): the result to the Find Match or friends record, the squares to the mini-game stats.
function recordUp(up, uid, result, squares, side, friend) {
  const base = `users/${uid}/${friend ? 'friend/' : ''}`;
  for (const [k, n] of Object.entries(R.recordDelta(result))) if (n) up[base + k] = ServerValue.increment(n);
  for (const [t, v] of Object.entries(R.squaresFor(squares, side))) {
    if (v.won) up[`users/${uid}/minis/${t}/won`] = ServerValue.increment(v.won);
    if (v.lost) up[`users/${uid}/minis/${t}/lost`] = ServerValue.increment(v.lost);
  }
}
// A paired game, made exactly once from the two queue entries: the random board, the sides as drawn,
// all mini-games on, the queue's time per turn. Then both players are pointed at it.
async function createGame(key, id) {
  const q = (await db.ref(`queue/${key}`).get()).val() || {};
  const pair = Object.entries(q).filter(([, e]) => e && e.game === id);
  if (pair.length !== 2) return false;                       // made already (the entries are gone) or not a pair
  const [[ua, ea], [ub, eb]] = pair;
  const X = ea.side === 'X' ? { uid: ua, e: ea } : { uid: ub, e: eb }, O = X.uid === ua ? { uid: ub, e: eb } : { uid: ua, e: ea };
  return makeGame(key, id, X, O, null);
}
// A lone searcher and a bot: the same game, the bot in the other seat, online (its presence says so)
// and looked after by runBot. Nothing in the game itself says it is a bot.
async function createBotGame(key, uid, id, bot) {
  const e = (await db.ref(`queue/${key}/${uid}`).get()).val();
  if (!e || e.game !== id) return false;
  const p = (await db.ref(`users/${bot.uid}`).get()).val() || {};
  const human = { uid, e }, me = { uid: bot.uid, e: { name: p.username || bot.username, rec: recordOf(p) } };
  return makeGame(key, id, e.side === 'X' ? human : me, e.side === 'X' ? me : human, { bot });
}
// The game itself, made exactly once; then the players are pointed at it.
async function makeGame(key, id, X, O, opts) {
  const bot = opts && opts.bot;
  const Q = R.QUEUES[key], t = now();
  const rng = seedRng();
  const rec = E.newOnlineMatch({ names: { X: X.e.name, O: O.e.name }, games: Object.fromEntries(E.TYPES.map(g => [g, true])), timer: Q.timer }, rng, id);
  E.armClock(rec.state, [], t + MATCH_GRACE_MS);
  const seat = p => Object.assign({ uid: p.uid, name: p.e.name, record: p.e.rec || { wins: 0, losses: 0, draws: 0 } }, R.RATINGS_ENABLED ? { rating: p.e.rating } : {});   // the record for the players' intro
  const players = { X: seat(X), O: seat(O) };
  const pub = { mode: Q.mode, queue: key, timer: Q.timer, players, status: 'playing', created: t, updated: t, state: JSON.stringify(rec.state) };
  const made = await db.ref(`games/${id}`).transaction(cur => (cur ? undefined : { pub, sec: JSON.stringify(rec.secrets), dl: rec.state.timer.deadline }), undefined, false);
  if (made.committed) {
    const up = {
      [`active/${X.uid}`]: { game: id, side: 'X', queue: key, mode: Q.mode },
      [`active/${O.uid}`]: { game: id, side: 'O', queue: key, mode: Q.mode },
      [`queue/${key}/${X.uid}`]: null, [`queue/${key}/${O.uid}`]: null,
    };
    if (bot) {
      const side = X.uid === bot.uid ? 'X' : 'O', human = side === 'X' ? O.uid : X.uid;
      up[`botGames/${id}`] = { bot: bot.uid, key: bot.key, side, human, live: true, created: t };
      up[`gpresence/${id}/${side}`] = { online: true, away: false, at: t };
      up['botStats/started'] = ServerValue.increment(1);
    }
    await db.ref().update(up);
    await db.ref().update(statsUp(S.startUpdates(bot ? 'bot' : Q.mode, t))).catch(e => logger.error('stats', e));
    await markActive([X, O].filter(p => !bot || p.uid !== bot.uid).map(p => 'u:' + p.uid), t).catch(e => logger.error('stats', e));
  }
  return made.committed;
}

/* ===================== the bots ===================== */
// The bot accounts (functions/bots.js), made the first time they are needed: an ordinary profile and
// username each, listed for the admin in bots/{uid}.
async function listBots() {
  const v = (await db.ref('bots').get()).val() || {};
  return Object.entries(v).filter(([, b]) => b && b.key).map(([uid, b]) => ({ uid, key: b.key, username: b.username, about: b.about }));
}
async function ensureBots() {
  let have = await listBots();
  const stale = {};                                          // a style described differently in bots.js since: the dashboard's description follows
  for (const b of have) { const c = B.byKey(b.key); if (c && c.about !== b.about) stale[`bots/${b.uid}/about`] = c.about; }
  if (Object.keys(stale).length) await db.ref().update(stale);
  if (B.BOTS.every(c => have.some(b => b.key === c.key))) return have;
  const lock = await db.ref('botsLock').transaction(cur => (cur && now() - cur < 60000 ? undefined : now()), undefined, false);
  if (!lock.committed) return have;                           // another call is making them
  try {
    for (const c of B.BOTS) {
      if (have.some(b => b.key === c.key)) continue;
      const uid = B.newUid(n => crypto.randomInt(n));
      let name = null;
      for (let k = 0; k < 20 && !name; k++) {                  // a made-up ordinary username, free and within the rules
        const tryName = B.randomName(n => crypto.randomInt(n));
        if (R.usernameProblem(tryName)) continue;
        const claim = await db.ref(`usernames/${tryName.toLowerCase()}`).transaction(cur => (cur === null ? uid : undefined), undefined, false);
        if (claim.committed && claim.snapshot.val() === uid) name = tryName;
      }
      if (!name) continue;
      const t = now(), joined = t - crypto.randomInt(6 * 3600000, 5 * 86400000);   // joined a while ago, not all at once
      await db.ref().update({
        [`users/${uid}`]: { username: name, rating: R.START_RATING, wins: 0, losses: 0, draws: 0, games: 0, joined },
        [`bots/${uid}`]: { key: c.key, username: name, about: c.about, created: t },
      });
    }
  } finally { await db.ref('botsLock').remove(); }
  return listBots();
}
// The bots not in a game right now.
async function freeBots() {
  const bots = await ensureBots(), out = [];
  for (const b of bots) if (!(await activeGame(b.uid))) out.push(b);
  return out;
}
// The bot's next step, when it is the bot's turn: a plan (how long it thinks: from when its turn starts
// on the player's phone, after the last move has played) made once per position, then the move once the
// time is up. Memory is two steps, as a person plays it: the first card, then the second a moment later.
// Called from the player's phone (tick, every few seconds while waiting), and by the sweep and a timeout
// as a fallback, so a bot never runs out of time. `force`: move now if it is the bot's turn.
const BOT_EARLY_MS = 1000;                                   // a tick lands up to a second early
async function runBot(id, opts) {
  const force = !!(opts && opts.force);
  const [bgs, gs] = await Promise.all([db.ref(`botGames/${id}`).get(), db.ref(`games/${id}`).get()]);
  const bg = bgs.val(), g = gs.val();
  if (!bg || !bg.live || !g || !g.pub || g.pub.status !== 'playing') return false;
  const st = parse(g.pub.state);
  if (st.winner || st.turn !== bg.side) return false;
  const bot = B.byKey(bg.key) || B.BOTS[0], rng = seedRng(), t = now();
  let next = bg.next && bg.next.seq === st.seq ? bg.next : null;
  if (!next) {
    const limit = ((st.timer && st.timer.limit) || 60) * 1000;
    const start = st.timer && st.timer.deadline ? st.timer.deadline - limit : t;
    next = { seq: st.seq, due: start + B.thinkMs(bot, st.lock != null ? 'again' : 'turn', rng), step: 'move' };
    await db.ref(`botGames/${id}/next`).set(next);
  }
  if (!force && t < next.due - BOT_EARLY_MS) return false;
  if (next.step === 'second') {                              // Memory: the second card
    const r = await changeGame(id, bg.bot, (rec, side) => (rec.state.seq !== next.seq || rec.state.pickSq !== next.square ? { ok: false, reason: 'stale' }
      : E.applyOnlineMove(rec, side, next.square, next.move, seedRng())));
    return r.ok;
  }
  const plan = E.cpuMove(E.fullState({ state: st, secrets: parse(g.sec) }), rng, bot.style);
  if (!plan) return false;
  if (st.squares[plan.square].mini.type === 'memory' && Array.isArray(plan.move) && !force) {
    const r = await changeGame(id, bg.bot, (rec, side) => (rec.state.seq !== next.seq || rec.state.pickSq != null ? { ok: false, reason: 'stale' }
      : E.applyOnlinePick(rec, side, plan.square, plan.move[0])));
    if (r.ok) await db.ref(`botGames/${id}/next`).set({ seq: next.seq, due: now() + B.thinkMs(bot, 'second', rng), step: 'second', square: plan.square, move: plan.move });
    return r.ok;
  }
  const r = await changeGame(id, bg.bot, (rec, side) => (rec.state.seq !== next.seq ? { ok: false, reason: 'stale' }
    : E.applyOnlineMove(rec, side, plan.square, plan.move, seedRng())));
  return r.ok;
}
// Every matchmaking game's phones call this every few seconds while the other side is on the move; it
// answers the same whoever the other side is. In a game against a bot, it moves the bot when it is time.
exports.tick = onCall(CALL, async req => {
  const uid = needUid(req), id = gameId((req.data || {}).game);
  const bg = (await db.ref(`botGames/${id}`).get()).val();
  if (bg && bg.live && bg.human === uid) await runBot(id).catch(e => logger.error('bot', id, e));
  return { ok: true };
});

/* ===================== the empty-queue alert ===================== */
// Someone has been searching alone for a few seconds: a text and/or an email to the admin, with a link
// straight into Find Match. Once per queue entry, and within the limits (B.alertAllowed): one per player
// per cooldown, a gap between alerts, a daily cap. Every alert sent is logged for the dashboard.
async function maybeAlert(key, uid, entry, prof, ac) {
  const t = now();
  if (!entry || entry.alerted || t - entry.since < ac.after * 1000) return null;
  const mark = await db.ref(`queue/${key}/${uid}`).transaction(cur => {
    if (cur === null) return null;                           // (a first guess from an empty cache: retried with the real value)
    return cur.game || cur.alerted ? undefined : Object.assign(cur, { alerted: t });
  }, undefined, false);
  const marked = mark.committed && mark.snapshot.val();
  if (!marked || marked.alerted !== t) return null;          // alerted already, paired meanwhile, or gone
  let held = null;
  const gate = await db.ref('alertState').transaction(cur => {
    const d = B.alertAllowed(cur, uid, t, ac);
    held = d.ok ? null : d.why;
    return d.ok ? d.next : undefined;
  }, undefined, false);
  if (!gate.committed) { await db.ref('alertStats/held').set(ServerValue.increment(1)); return null; }
  const rec = recordOf(prof), link = ac.site + '?play=find';
  const res = await sendAlert(ac, {
    subject: `${prof.username} is waiting for a match`,
    text: `Tic Tac Chaos: ${prof.username} (${rec.wins}-${rec.losses}-${rec.draws}) is searching for a match and nobody else is. Play them: ${link}`,
  });
  await db.ref('alertLog').push({ at: t, uid, username: prof.username, channels: res });
  await db.ref('alertStats/sent').set(ServerValue.increment(1));
  return res;
}
// Sends the alert on the channels switched on: SMS through Twilio, email through Resend, with the keys
// the admin saved (admin/secrets, which no phone can read). In the emulator nothing leaves: the message
// is written to test/alertsSent instead. Answers with each channel's outcome.
async function sendAlert(ac, msg) {
  const out = { sms: 'off', email: 'off' };
  const keys = (await db.ref('admin/secrets').get()).val() || {};
  const fake = process.env.FUNCTIONS_EMULATOR === 'true';
  const go = async (ch, fn) => { try { out[ch] = await fn(); } catch (e) { out[ch] = 'error: ' + String(e && e.message || e).slice(0, 160); } };
  const jobs = [];
  if (ac.sms) jobs.push(go('sms', async () => {
    const to = B.e164(ac.phone);
    if (!to) return 'error: no phone number';
    if (!keys.twilioSid || !keys.twilioToken || !keys.twilioFrom) return 'error: Twilio keys not set';
    if (fake) { await db.ref('test/alertsSent').push({ ch: 'sms', to, text: msg.text }); return 'sent'; }
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(keys.twilioSid)}/Messages.json`, {
      method: 'POST', signal: AbortSignal.timeout(10000),
      headers: { Authorization: 'Basic ' + Buffer.from(`${keys.twilioSid}:${keys.twilioToken}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: to, From: keys.twilioFrom, Body: msg.text }).toString(),
    });
    if (r.ok) return 'sent';
    const j = await r.json().catch(() => ({}));
    return `error: Twilio ${r.status}${j.code ? ' ' + j.code : ''} ${j.message || ''}`.trim();
  }));
  if (ac.email) jobs.push(go('email', async () => {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(ac.to)) return 'error: no email address';
    if (!keys.resendKey) return 'error: Resend key not set';
    const from = keys.emailFrom || 'Tic Tac Chaos <onboarding@resend.dev>';
    if (fake) { await db.ref('test/alertsSent').push({ ch: 'email', to: ac.to, subject: msg.subject, text: msg.text }); return 'sent'; }
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST', signal: AbortSignal.timeout(10000),
      headers: { Authorization: `Bearer ${keys.resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [ac.to], subject: msg.subject, text: msg.text }),
    });
    if (r.ok) return 'sent';
    const j = await r.json().catch(() => ({}));
    return `error: Resend ${r.status} ${j.message || j.name || ''}`.trim();
  }));
  await Promise.all(jobs);
  return out;
}
// The dashboard's "Send a test alert": the channels as set (or as asked), whatever the limits.
exports.testAlert = onCall(CALL, async req => {
  needAdmin(req);
  const ac = B.alertConfig(await adminConfig()), d = req.data || {};
  const use = Object.assign({}, ac, d.sms !== undefined || d.email !== undefined ? { sms: !!d.sms, email: !!d.email } : {});
  const res = await sendAlert(use, { subject: 'Tic Tac Chaos: test alert', text: `Tic Tac Chaos: a test alert. When someone searches alone, the alert comes here. ${ac.site}?play=find` });
  await db.ref('alertLog').push({ at: now(), test: true, channels: res });
  return res;
});

/* ===================== the game: moves, timeouts, resigning ===================== */
// One change to a game, run as a transaction on games/{id} (public and hidden parts together).
// `step(rec, side, pub)` returns the engine's answer; on success the new record is written, the turn
// clock started and, if the match is over, the result recorded afterwards.
async function changeGame(id, uid, step) {
  let out = { ok: false, reason: 'missing' }, over = false;
  const res = await db.ref(`games/${id}`).transaction(cur => {
    if (cur === null) { out = { ok: false, reason: 'missing' }; return cur; }   // (a first guess from an empty cache: retried with the real value)
    const pub = cur.pub;
    if (!pub || pub.status !== 'playing') { out = { ok: false, reason: 'over' }; return undefined; }
    const side = uid ? sideOf(pub, uid) : null;
    if (uid && !side) { out = { ok: false, reason: 'not-player' }; return undefined; }
    const rec = { state: parse(pub.state), secrets: parse(cur.sec) };
    const r = step(rec, side, pub);
    if (!r.ok) { out = { ok: false, reason: r.reason }; return undefined; }
    const t = now();
    if (r.entries) E.armClock(r.rec.state, r.entries, t);
    pub.state = JSON.stringify(r.rec.state); cur.sec = JSON.stringify(r.rec.secrets || {});
    pub.updated = t;
    over = !!r.rec.state.winner;
    if (over) { pub.status = 'over'; pub.ended = t; cur.dl = 1; }      // 1: over, the result still to record
    else cur.dl = r.rec.state.timer && r.rec.state.timer.deadline || null;
    out = { ok: true, seq: r.rec.state.seq };
    return cur;
  }, undefined, false);
  if (!res.committed && out.ok) out = { ok: false, reason: 'busy' };
  if (res.committed && over) await finishGame(id).catch(e => logger.error('finishGame', id, e));
  return out;
}
// A move (or Memory's first card, kind 'pick') from the player on the move.
exports.move = onCall(CALL, async req => {
  const uid = needUid(req), d = req.data || {}, id = gameId(d.game);
  const i = d.square;
  if (!Number.isInteger(i) || i < 0 || i > 8) return { ok: false, reason: 'bad' };
  if (d.kind === 'pick') {
    const card = d.card == null ? null : d.card;
    return changeGame(id, uid, (rec, side) => E.applyOnlinePick(rec, side, i, card));
  }
  if (d.move === undefined) return { ok: false, reason: 'bad' };
  return changeGame(id, uid, (rec, side) => E.applyOnlineMove(rec, side, i, d.move, seedRng()));
});
// The turn's time is up: the random move for the player on the move (or the match, on a second
// timeout in a row). Only once the deadline has really passed, by the server's clock.
function timeoutStep(rec) {
  const t = rec.state.timer;
  if (rec.state.winner) return { ok: false, reason: 'over' };
  if (!t || !t.limit || t.deadline == null || now() < t.deadline) return { ok: false, reason: 'early' };
  return E.applyOnlineTimeout(rec, seedRng());
}
exports.timeout = onCall(CALL, async req => {
  const uid = needUid(req), id = gameId((req.data || {}).game);
  if (await runBot(id, { force: true }).catch(() => false)) return { ok: true };   // a bot on the move moves instead (it never times out)
  return changeGame(id, uid, timeoutStep);
});
// Leaving a matchmaking game through the menu: a resignation, which loses the match.
exports.resign = onCall(CALL, async req => {
  const uid = needUid(req), id = gameId((req.data || {}).game);
  return changeGame(id, uid, (rec, side) => E.applyOnlineResign(rec, side));
});

/* ===================== the result: ratings, records, leaderboard, history ===================== */
// Runs once per finished game (a claim on the game makes sure of it; a claim older than a minute that
// never finished is taken over by the sweep).
async function finishGame(id) {
  let fresh = false;
  await db.ref(`games/${id}/pub/recorded`).transaction(cur => {
    if (cur && (cur.done || now() - cur.at < 60000)) { fresh = false; return undefined; }
    fresh = true; return { at: now() };
  }, undefined, false);
  if (!fresh) return false;
  const g = (await db.ref(`games/${id}`).get()).val();
  if (!g || !g.pub || g.pub.status !== 'over') return false;
  const pub = g.pub, st = parse(pub.state);
  const bg = (await db.ref(`botGames/${id}`).get()).val();      // a game against a bot: its own stats; the player's record as the admin chose
  const counted = !bg || B.botConfig(await adminConfig()).countInRecords;
  const final = finalOf({ state: st, secrets: parse(g.sec) }, { X: pub.players.X.name, O: pub.players.O.name });
  const how = R.howEnded(st), t = pub.ended || now();
  const up = {};
  const result = { winner: st.winner || null, how, records: {} };
  const [px, po] = await Promise.all(['X', 'O'].map(s => db.ref(`users/${pub.players[s].uid}`).get().then(v => v.val() || {})));
  for (const [s, p] of [['X', px], ['O', po]]) {                 // every Find Match game: both records and the mini-game stats
    const res = R.resultFor(st, s), d = R.recordDelta(res), r0 = recordOf(p);
    if (!counted && pub.players[s].uid === bg.human) { result.records[s] = r0; continue; }   // left out of the record: as it was
    recordUp(up, pub.players[s].uid, res, final.squares, s, false);
    result.records[s] = { wins: r0.wins + d.wins, losses: r0.losses + d.losses, draws: r0.draws + d.draws };   // as the results screen shows it
  }
  if (R.RATINGS_ENABLED && pub.mode === 'ranked' && !bg) {        // (switched off for now; never for a game against a bot)
    const scoreX = st.winner === 'X' ? 1 : st.winner === 'O' ? 0 : 0.5;
    const next = R.elo(px.rating || R.START_RATING, po.rating || R.START_RATING, scoreX);
    result.ratings = {};
    for (const [s, p] of [['X', px], ['O', po]]) {
      const uid = pub.players[s].uid, before = p.rating || R.START_RATING;
      result.ratings[s] = { before, after: next[s], delta: next[s] - before };
      up[`users/${uid}/rating`] = next[s];
      const games = (p.games || 0) + 1;
      up[`leaderboard/${uid}`] = games >= R.LEADERBOARD_MIN_GAMES ? Object.assign({ username: p.username, rating: next[s], games }, result.records[s]) : null;
    }
  }
  for (const s of ['X', 'O']) {
    const me = pub.players[s], them = pub.players[E.other(s)];
    up[`history/${me.uid}/${id}`] = historyRecord(pub.mode, s, them, st, final, t, result.ratings && result.ratings[s]);
    up[`active/${me.uid}`] = null;
  }
  up[`games/${id}/pub/result`] = result;
  up[`games/${id}/pub/final`] = JSON.stringify(final);
  up[`games/${id}/pub/recorded`] = { at: now(), done: true };
  up[`games/${id}/dl`] = null;
  statsUp(S.endUpdates(bg ? 'bot' : pub.mode, E.matchStats(st), t - (pub.created || t), t, false), up);
  if (bg) {
    Object.assign(up, { [`botGames/${id}/live`]: null, [`botGames/${id}/next`]: null, [`botGames/${id}/done`]: true, [`botGames/${id}/winner`]: st.winner || null });
    up['botStats/finished'] = ServerValue.increment(1);
    up[`botStats/${!st.winner ? 'draws' : st.winner === bg.side ? 'botWins' : 'playerWins'}`] = ServerValue.increment(1);
  }
  await db.ref().update(up);                                   // all of it at once: both ratings, records, leaderboard, history, stats
  await markActive(['X', 'O'].filter(s => !bg || pub.players[s].uid !== bg.bot).map(s => 'u:' + pub.players[s].uid), t).catch(e => logger.error('stats', e));
  return true;
}
// The final state with every hidden value revealed, for history and the review board.
function finalOf(rec, names) {
  const f = E.fullState(rec);
  const keep = {};
  for (const k of ['id', 'squares', 'winner', 'winLine', 'winReason', 'resigned', 'counts', 'moves', 'games', 'lastSquare', 'lastBy']) if (f[k] !== undefined) keep[k] = f[k];
  keep.names = names;
  return keep;
}
function historyRecord(mode, side, them, st, final, at, rating) {
  const h = {
    mode, side, rated: mode === 'ranked', date: at,
    opponent: { uid: them.uid || null, name: them.name || E.other(side) },
    result: R.resultFor(st, side), how: R.howEnded(st),
    final: JSON.stringify(final),
  };
  if (rating) { h.ratingBefore = rating.before; h.ratingAfter = rating.after; }
  return h;
}

/* ===================== local matches: a logged-in player's own record ===================== */
// Reported by the phone once a local match is over (won, lost, or left): kept once per match, private
// to the player. localStats/{uid}: the record and squares won and lost per mini-game; localHistory/{uid}:
// the match, its final board included, as in the game history.
exports.recordLocal = onCall(CALL, async req => {
  const uid = needAccount(req);
  const rep = R.checkLocal(req.data, E.TYPES.concat(E.OLD_TYPES), E.mainResult);
  if (!rep) throw new HttpsError('invalid-argument', 'Not a match.');
  if (!(await db.ref(`users/${uid}/username`).get()).val()) throw new HttpsError('failed-precondition', 'Pick a username first.');
  const h = historyRecord('local', rep.side, { uid: null, name: rep.opponent }, rep.final, rep.final, now(), null);
  h.opponent.cpu = rep.cpu;
  const tx = await db.ref(`localHistory/${uid}/l_${rep.id}`).transaction(cur => (cur ? undefined : h));
  if (!tx.committed) return { ok: true, seen: true };          // reported already
  const up = {};
  for (const [k, n] of Object.entries(R.recordDelta(h.result))) if (n) up[`localStats/${uid}/${k}`] = ServerValue.increment(n);
  for (const [t, v] of Object.entries(R.squaresFor(rep.final.squares, rep.side))) {
    if (v.won) up[`localStats/${uid}/minis/${t}/won`] = ServerValue.increment(v.won);
    if (v.lost) up[`localStats/${uid}/minis/${t}/lost`] = ServerValue.increment(v.lost);
  }
  if (Object.keys(up).length) await db.ref().update(up);
  return { ok: true, result: h.result };
});

/* ===================== friend-code games: history for logged-in players ===================== */
// A room's match (played by the two phones, unrated) is saved to the history of each player who has
// an account, once, when it ends.
exports.friendGameDone = onValueWritten({ ref: '/rooms/{code}/match' }, async event => {
  const after = event.data.after.val(), before = event.data.before.val();
  if (!after || typeof after.state !== 'string') return;
  const st = parse(after.state);
  const b = before && typeof before.state === 'string' ? parse(before.state) : null;
  const sid = 'f_' + event.params.code + '_' + String(st.id || 'm').replace(/[^-\w]/g, '');
  if (!b || b.id !== st.id) {                                  // a new match in the room: counted as started
    const t = now();
    if (await claimMatch(sid, 's', t)) {
      await db.ref().update(statsUp(S.startUpdates('friend', t)));
      const room0 = (await db.ref(`rooms/${event.params.code}/players`).get()).val() || {};
      await markActive(['X', 'O'].map(s => room0[s] && room0[s].uid ? 'u:' + room0[s].uid : null), t);
    }
  }
  if (!st.winner) return;
  if (b && b.id === st.id && b.winner) return;                 // the end was seen already
  // who played which side: as the match itself says (the seats can swap for a rematch, with Random
  // sides, before this runs), else as the room says (a match written by an older page)
  const seats = after.seats && after.seats.X && after.seats.O ? after.seats : null;
  const room = seats ? { players: seats } : (await db.ref(`rooms/${event.params.code}`).get()).val();
  if (!room || !room.players) return;
  const t1 = now(), done = await claimMatch(sid, 'e', t1);
  if (done) {
    const started = !!(done.prev && done.prev.s);
    await db.ref().update(statsUp(S.endUpdates('friend', E.matchStats(st), started ? t1 - done.prev.t0 : null, t1, !started)));
  }
  const names = { X: room.players.X ? room.players.X.name : 'X', O: room.players.O ? room.players.O.name : 'O' };
  const final = finalOf({ state: st, secrets: parse(after.secrets) }, names);
  const id = 'f_' + event.params.code + '_' + (st.id || st.seq);
  const up = {};
  for (const s of ['X', 'O']) {
    const p = room.players[s];
    if (!p || !p.uid) continue;
    const prof = (await db.ref(`users/${p.uid}/username`).get()).val();
    if (!prof) continue;                                       // played without an account: no history
    const o = room.players[E.other(s)] || {};
    const ouser = o.uid ? (await db.ref(`users/${o.uid}/username`).get()).val() : null;
    up[`history/${p.uid}/${id}`] = historyRecord('friend', s, { uid: ouser ? o.uid : null, name: o.name || E.other(s) }, st, final, now(), null);
    if (done) recordUp(up, p.uid, R.resultFor(st, s), final.squares, s, true);   // the friends record and the mini-game stats (once: the end's claim)
  }
  if (Object.keys(up).length) await db.ref().update(up);
});

/* ===================== the sweep: every minute ===================== */
// Timeouts for games nobody is watching, results not yet recorded, and finished games past a day.
async function sweep() {
  const t = now();
  const bots = (await db.ref('botGames').orderByChild('live').equalTo(true).get()).val() || {};
  let botMoves = 0;
  for (const id of Object.keys(bots)) if (await runBot(id).catch(() => false)) botMoves++;   // a player who is away: the bot still plays its turn
  const due = (await db.ref('games').orderByChild('dl').startAt(1).endAt(t).limitToFirst(50).get()).val() || {};
  let timeouts = 0, finished = 0;
  for (const [id, g] of Object.entries(due)) {
    if (g.pub && g.pub.status === 'over') { if (await finishGame(id).catch(() => false)) finished++; continue; }
    if (bots[id] && await runBot(id, { force: true }).catch(() => false)) { botMoves++; continue; }   // a bot never times out
    const r = await changeGame(id, null, timeoutStep).catch(() => ({ ok: false }));
    if (r.ok) timeouts++;
  }
  const old = (await db.ref('games').orderByChild('pub/ended').startAt(1).endAt(t - GAME_KEEP_MS).limitToFirst(50).get()).val() || {};
  const up = {};
  for (const [id, g] of Object.entries(old)) if (g.pub && g.pub.recorded && g.pub.recorded.done) { up[`games/${id}`] = null; up[`gpresence/${id}`] = null; up[`botGames/${id}`] = null; }
  const deleted = Object.keys(up).length / 3;
  await pruneSeen(t, up).catch(e => logger.error('stats prune', e));
  if (Object.keys(up).length) await db.ref().update(up);
  return { timeouts, finished, deleted, botMoves };
}
// What the stats have seen, once it can no longer matter: matches after three days, players once their
// day, week or month is well over (the counts stay).
async function pruneSeen(t, up) {
  const D = 86400000;
  const old = (await db.ref('statsSeen/match').orderByChild('t0').startAt(1).endAt(t - 3 * D).limitToFirst(200).get()).val() || {};
  for (const id of Object.keys(old)) up[`statsSeen/match/${id}`] = null;
  if (new Date(t).getUTCMinutes() !== 7) return;               // the periods: once an hour is plenty, and no reading needed
  for (let k = 4; k <= 9; k++) up[`statsSeen/d/${S.periodKeys(t - k * D).d}`] = null;          // days gone by
  for (const k of [21, 28, 35, 42]) up[`statsSeen/w/${S.periodKeys(t - k * D).w}`] = null;    // weeks
  for (const k of [62, 93]) up[`statsSeen/m/${S.periodKeys(t - k * D).m}`] = null;            // months
}
exports.sweep = onSchedule({ schedule: 'every 1 minutes', timeZone: 'Etc/UTC', retryCount: 0 }, async () => {
  const r = await sweep();
  if (r.timeouts || r.finished || r.deleted || r.botMoves) logger.info('sweep', r);
});
// The emulator cannot fire schedules: the tests run the same sweep through this hook, which exists
// only in the emulator.
if (process.env.FUNCTIONS_EMULATOR === 'true') exports.testSweep = onRequest(async (req, res) => { res.json(await sweep()); });
