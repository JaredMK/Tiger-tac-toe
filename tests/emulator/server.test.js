'use strict';
// The server on the Firebase Emulator Suite: accounts, matchmaking, server-run matches, records,
// per-mini-game stats and history, and the security rules. (Ratings and the leaderboard are switched off.) Run with:  npm run test:emulators
// (Plain `node --test` skips this file: it needs the emulators.)
const test = require('node:test');
const assert = require('node:assert/strict');

const EMU = !!process.env.FIREBASE_AUTH_EMULATOR_HOST && !!process.env.FIREBASE_DATABASE_EMULATOR_HOST;
if (!EMU) { test('server tests (need the emulators: npm run test:emulators)', { skip: true }, () => {}); return; }

const E = require('../engine.js');
E.setPhysics(require('../physics.js'));   // Mini Golf, Pool and Bowling: the same physics the server runs
const { initializeApp, deleteApp } = require('firebase/app');
const A = require('firebase/auth');
const D = require('firebase/database');
const F = require('firebase/functions');

const PROJECT = 'demo-tic-tac-chaos', NS = `${PROJECT}-default-rtdb`;
const DB_HOST = process.env.FIREBASE_DATABASE_EMULATOR_HOST;           // 127.0.0.1:9000
const FN = `http://127.0.0.1:5001/${PROJECT}/us-central1`;
const config = { apiKey: 'demo-key', projectId: PROJECT, databaseURL: `https://${NS}.firebaseio.com` };

// ---------- the database as its owner (the tests' own setup and checks, past the rules) ----------
async function admin(method, path, body) {
  const r = await fetch(`http://${DB_HOST}/${path}.json?ns=${NS}`, { method, headers: { Authorization: 'Bearer owner' }, body: body === undefined ? undefined : JSON.stringify(body) });
  if (!r.ok) throw new Error(`${method} ${path}: ${r.status} ${await r.text()}`);
  return r.json();
}
const get = path => admin('GET', path);
const put = (path, v) => admin('PUT', path, v);
const patch = (path, v) => admin('PATCH', path, v);
const sweep = () => fetch(`${FN}/testSweep`).then(r => r.json());
const wait = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, ms = 10000, what = 'condition') {
  const t0 = Date.now();
  for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) throw new Error('timed out waiting for ' + what); await wait(150); }
}

// ---------- players: each its own app, signed in on the auth emulator ----------
let n = 0;
const apps = [];
async function player(username, opts = {}) {
  const app = initializeApp(config, 'p' + (++n));
  apps.push(app);
  const auth = A.getAuth(app); A.connectAuthEmulator(auth, 'http://' + process.env.FIREBASE_AUTH_EMULATOR_HOST, { disableWarnings: true });
  const db = D.getDatabase(app); D.connectDatabaseEmulator(db, DB_HOST.split(':')[0], Number(DB_HOST.split(':')[1]));
  const fns = F.getFunctions(app, 'us-central1'); F.connectFunctionsEmulator(fns, '127.0.0.1', 5001);
  const cred = opts.anonymous ? await A.signInAnonymously(auth) : await A.createUserWithEmailAndPassword(auth, `${(username || 'player').toLowerCase()}${n}@example.com`, 'secret-password');
  const p = { app, auth, db, uid: cred.user.uid, name: username };
  p.call = async (name, data) => (await F.httpsCallable(fns, name)(name === 'findMatch' ? Object.assign({ mode: 'classic' }, data) : data)).data;   // (Find Match is Super Chaos; these tests ask for the Classic queue, kept as code, unless they say otherwise)
  p.read = async path => (await D.get(D.ref(db, path))).val();
  p.write = (path, v) => D.set(D.ref(db, path), v);
  if (username && !opts.anonymous && !opts.noName) assert.deepEqual(await p.call('claimUsername', { username }), { ok: true, username });
  return p;
}
const denied = async (promise, what) => {
  await assert.rejects(promise, e => /permission[_ ]denied/i.test(String(e.code || e.message)), `${what} should be refused`);
};

// ---------- matches ----------
// Two players search until both are in the same game. (An older page's queue and timer are ignored:
// Find Match is one queue with 1 minute a turn.)
async function pairUp(a, b, queue = 'match', timer = 60) {
  let ra = { status: 'searching' }, rb = { status: 'searching' };
  for (let k = 0; k < 20 && (ra.status !== 'matched' || rb.status !== 'matched'); k++) {
    [ra, rb] = await Promise.all([a.call('findMatch', { queue, timer }), b.call('findMatch', { queue, timer })]);
  }
  assert.equal(ra.status, 'matched'); assert.equal(rb.status, 'matched');
  assert.equal(ra.game, rb.game, 'the same game');
  assert.notEqual(ra.side, rb.side, 'opposite sides');
  const by = { [ra.side]: a, [rb.side]: b };
  return { id: ra.game, X: by.X, O: by.O };
}
const gameState = async id => JSON.parse((await get(`games/${id}/pub/state`)));
// Rewrite a game as its owner: X owns squares 0 and 1, square 2 is Tic-Tac-Toe with X on 0 and 1,
// and it is `turn`'s move: X wins the match by playing cell 2 of square 2.
async function nearWin(id, turn = 'X') {
  const g = await get(`games/${id}`);
  const st = JSON.parse(g.pub.state);
  const ttt = cells => ({ type: 'ttt', cells, last: null });
  st.squares[0] = { owner: 'X', mini: ttt(['X', 'X', 'X', null, null, null, null, null, null]) };
  st.squares[1] = { owner: 'X', mini: ttt(['X', 'X', 'X', null, null, null, null, null, null]) };
  st.squares[2] = { owner: null, mini: ttt(['X', 'X', null, 'O', 'O', null, null, null, null]) };
  for (const k of [3, 4, 5, 6, 7, 8]) st.squares[k] = { owner: null, mini: ttt(Array(9).fill(null)) };
  const sec = JSON.parse(g.sec); for (const k of [0, 1, 2, 3, 4, 5, 6, 7, 8]) delete sec[k];
  st.turn = turn; st.lock = null;
  await patch(`games/${id}`, { pub: Object.assign(g.pub, { state: JSON.stringify(st) }), sec: JSON.stringify(sec) });
}
const recorded = id => until(async () => { const r = await get(`games/${id}/pub/recorded`); return r && r.done; }, 10000, 'the result to be recorded');

test.before(() => put('features/findMatch', true));            // Find Match starts off: on for the suite (its own test switches it off)
test.after(async () => { for (const app of apps) await deleteApp(app).catch(() => {}); });

/* ===================================== accounts ===================================== */
test('usernames: the format, the profanity filter, unique regardless of case, and only once', async () => {
  const p = await player('Alice_01');
  for (const [bad, why] of [['ab', /3 to 16/], ['abcdefghijklmnopq', /3 to 16/], ['no spaces', /letters, numbers/], ['dash-name', /letters, numbers/], ['émile', /letters, numbers/], ['admin', /reserved/], ['FuCkFace', /another/], ['sh1thead', /another/], ['big_ass', /another/]]) {
    const q = await player(null, { noName: true });
    const r = await q.call('claimUsername', { username: bad });
    assert.equal(r.ok, false, bad); assert.match(r.reason, why, bad);
  }
  for (const bad of ['sh1tlord', 'a55hole', 'xXfuckXx', 'BigAss', 'n4z1_99', 'P0rnStar']) {          // look-alikes, words inside longer names, CamelCase parts
    const q = await player(null, { noName: true });
    const r = await q.call('claimUsername', { username: bad });
    assert.equal(r.ok, false, bad); assert.match(r.reason, /another/, bad);
  }
  for (const fine of ['classic', 'Peacock_7', 'grapes', 'Scunthorpe', 'Button', 'Analyst']) {          // ordinary words that contain a listed one
    const q = await player(null, { noName: true });
    assert.equal((await q.call('claimUsername', { username: fine })).ok, true, fine);
  }
  const q = await player(null, { noName: true });
  assert.deepEqual(await q.call('claimUsername', { username: 'alice_01' }), { ok: false, reason: 'That username is taken' }, 'case does not make a name new');
  assert.equal((await p.call('claimUsername', { username: 'Alice_02' })).reason, 'You already have a username', 'a username is picked once');
  const prof = await p.read(`users/${p.uid}`);
  assert.equal(prof.username, 'Alice_01'); assert.equal(prof.rating, 1200);
  assert.deepEqual([prof.wins, prof.losses, prof.draws, prof.games], [0, 0, 0, 0]);
  assert.ok(Math.abs(prof.joined - Date.now()) < 60000, 'the join date');
  const anon = await player(null, { anonymous: true });
  await assert.rejects(anon.call('claimUsername', { username: 'Ghosty' }), /Log in first/, 'a guest cannot claim a name');
});

test('rules: a phone cannot write ratings, records, profiles, usernames, the leaderboard, history or games', async () => {
  const p = await player('Mallory');
  await denied(p.write(`users/${p.uid}/rating`, 3000), 'raising your own rating');
  await denied(p.write(`users/${p.uid}`, { username: 'Mallory', rating: 3000, wins: 99, losses: 0, draws: 0, games: 99 }), 'rewriting your profile');
  await denied(p.write(`users/${p.uid}/wins`, 50), 'changing your record');
  await denied(p.write('usernames/someone', p.uid), 'claiming a name directly');
  await denied(p.write(`leaderboard/${p.uid}`, { username: 'Mallory', rating: 3000 }), 'a leaderboard entry');
  await denied(p.write(`history/${p.uid}/x`, { result: 'win' }), 'history');
  await denied(p.write(`oppStats/${p.uid}/x`, { name: 'x', wins: 99 }), 'the record against an opponent');
  await denied(p.write(`queue/match/${p.uid}`, { since: 1 }), 'the queue');
  await denied(p.write(`users/${p.uid}/minis/ttt/won`, 99), 'the mini-game stats');
  await denied(p.write(`users/${p.uid}/friend/wins`, 99), 'the friends record');
  await denied(p.write(`active/${p.uid}`, { game: 'x' }), 'the active game');
  await denied(p.write('games/xxxxxxxxxx', { pub: { status: 'playing' } }), 'a game');
});

/* ===================================== matchmaking ===================================== */
test('matchmaking: two players searching at the same moment are paired exactly once', async () => {
  const a = await player('Ann'), b = await player('Ben');
  const [ra, rb] = await Promise.all([a.call('findMatch', {}), b.call('findMatch', {})]);
  assert.deepEqual([ra.status, rb.status].sort(), ['matched', 'searching'], 'whichever search lands second finds the first at once');
  const first = ra.status === 'matched' ? ra : rb;
  const g = await pairUp(a, b);
  assert.equal(g.id, first.game, 'the game found at once is the one they play');
  const all = (await get('games')) || {};
  const mine = Object.entries(all).filter(([, v]) => v.pub && [v.pub.players.X.uid, v.pub.players.O.uid].includes(a.uid)).map(([id]) => id);
  assert.deepEqual(mine, [g.id], 'one game for the pair');
  assert.equal(await get(`queue/match/${a.uid}`), null, 'out of the queue');
  assert.equal(await get(`queue/match/${b.uid}`), null);
  assert.deepEqual(await a.read(`active/${a.uid}`), { game: g.id, side: g.X === a ? 'X' : 'O', queue: 'match', mode: 'match' });
  await denied(a.read(`active/${b.uid}`), 'reading someone else\'s active game');
  await g.X.call('resign', { game: g.id }); await recorded(g.id);
});

test('matchmaking: six players at once make three games, each player in exactly one', async () => {
  const ps = await Promise.all(['Cal', 'Dee', 'Eve', 'Fay', 'Gus', 'Hal'].map(u => player(u)));
  const res = new Map();
  for (let k = 0; k < 15 && res.size < ps.length; k++) {
    const out = await Promise.all(ps.map((p, i) => (res.has(p.uid) ? null : p.call('findMatch', i % 2 ? { queue: 'casual', timer: 30 } : { queue: 'ranked' }))));   // what older pages asked for
    out.forEach((r, i) => { if (r && r.status === 'matched') res.set(ps[i].uid, r); });
  }
  assert.equal(res.size, 6, 'everyone was matched');
  const byGame = {};
  for (const [uid, r] of res) (byGame[r.game] = byGame[r.game] || []).push([uid, r.side]);
  assert.equal(Object.keys(byGame).length, 3, 'three games');
  for (const [id, two] of Object.entries(byGame)) {
    assert.equal(two.length, 2, 'two players per game');
    assert.deepEqual(two.map(x => x[1]).sort(), ['O', 'X']);
    const pub = await get(`games/${id}/pub`);
    assert.deepEqual([pub.players.X.uid, pub.players.O.uid].sort(), two.map(x => x[0]).sort());
    assert.equal(pub.mode, 'match'); assert.equal(pub.timer, 60, 'Find Match is always 1 minute a turn');
    assert.equal(JSON.parse(pub.state).timer.limit, 60);
  }
  for (const p of ps) await p.call('resign', { game: res.get(p.uid).game }).catch(() => {});
});

test('matchmaking: a check-in landing just as the other player\'s search pairs them never puts the player back in the queue', async () => {
  for (let k = 0; k < 8; k++) {
    const a = await player(`Racer_a${k}`), b = await player(`Racer_b${k}`);
    assert.equal((await a.call('findMatch', {})).status, 'searching');
    // b's search pairs them while a's check-ins land throughout: before, during and after the game is made
    await Promise.all([b.call('findMatch', {})].concat([0, 5, 10, 20, 35, 50, 80].map(ms => wait(ms).then(() => a.call('findMatch', {})))));
    const g = await pairUp(a, b);
    const q = (await get('queue/match')) || {};
    assert.ok(!q[a.uid] && !q[b.uid], `round ${k}: nobody left waiting in the queue while in a game`);
    await g.X.call('resign', { game: g.id }); await recorded(g.id);
  }
});

test('matchmaking: one queue, players paired by wait time only (ratings play no part)', async () => {
  const ps = await Promise.all(['W1200', 'W2400', 'W800', 'W1600'].map(u => player(u)));
  await Promise.all(ps.map((p, i) => patch(`users/${p.uid}`, { rating: [1200, 2400, 800, 1600][i] })));
  // they arrive one after another: 1200 waits longest, then 2400; far apart, they are paired all the same
  assert.equal((await ps[0].call('findMatch', {})).status, 'searching');
  await patch(`queue/match/${ps[0].uid}`, { since: Date.now() - 20000 });
  const r1 = await ps[1].call('findMatch', {});
  assert.equal(r1.status, 'matched', 'the longest-waiting player meets the next one, 1200 points apart');
  const g1 = await ps[0].call('findMatch', {});
  assert.equal(g1.game, r1.game);
  assert.equal((await ps[2].call('findMatch', {})).status, 'searching');
  const r3 = await ps[3].call('findMatch', {});
  assert.equal(r3.status, 'matched');
  const pub = await get(`games/${r1.game}/pub`);
  for (const s of ['X', 'O']) assert.equal(pub.players[s].rating, undefined, 'no rating in the game');
  assert.deepEqual(pub.players.X.record, { wins: 0, losses: 0, draws: 0 }, 'each player\'s record, for the intro');
  for (const [p, r] of [[ps[0], g1], [ps[3], r3]]) await p.call('resign', { game: r.game });
});

test('matchmaking: Cancel leaves the queue; one queue whatever is asked; a guest or a player without a name cannot search', async () => {
  const p = await player('Ivy');
  await put(`queue/casual60/${p.uid}`, { since: Date.now(), seen: Date.now(), name: 'Ivy' });   // left by an older page
  assert.equal((await p.call('findMatch', { queue: 'casual', timer: 45 })).status, 'searching', 'no queue or timer to pick');
  assert.ok(await get(`queue/match/${p.uid}`));
  assert.equal(await get(`queue/casual60/${p.uid}`), null, 'out of the old queues');
  assert.deepEqual(await p.call('cancelSearch', {}), { status: 'cancelled' });
  assert.equal(await get(`queue/match/${p.uid}`), null);
  const anon = await player(null, { anonymous: true });
  await assert.rejects(anon.call('findMatch', {}), /Log in/);
  const noName = await player(null, { noName: true });
  await assert.rejects(noName.call('findMatch', {}), /username/);
});

/* ===================================== server-run matches ===================================== */
test('a Find Match game: all mini-games, one minute a turn, hidden values hidden, moves checked by the server', async () => {
  const a = await player('Joe'), b = await player('Kim');
  const g = await pairUp(a, b);
  const pub = await g.X.read(`games/${g.id}/pub`);
  assert.equal(pub.mode, 'match'); assert.equal(pub.timer, 60); assert.equal(pub.status, 'playing');
  const st = JSON.parse(pub.state);
  assert.deepEqual(st.games.slice().sort(), E.releasedTypes((await get('releases')) || {}).sort(), 'every released mini-game on (the admin-only ones are not dealt by Find Match)');
  assert.equal(st.timer.limit, 60);
  assert.ok(st.timer.deadline > Date.now() + 60000, 'the first turn has its full minute, after the players\' intro');
  // hidden values: the phones cannot read the hidden node, and the public state has none of them
  await denied(g.X.read(`games/${g.id}/sec`), 'reading the hidden values');
  await denied(g.X.read(`games/${g.id}`), 'reading the whole game');
  const outsider = await player('Lou');
  await denied(outsider.read(`games/${g.id}/pub`), 'an outsider reading the game');
  for (const sq of st.squares) {
    const m = sq.mini;
    assert.ok(!('word' in m) || m.type === 'hangman', 'no Wordle word');
    if (m.type === 'hangman') assert.match(m.word, /^_+$/, 'only the Hangman pattern');
    for (const k of ['target', 'hidden', 'ship', 'treasure', 'code']) assert.ok(!(k in m) || (k === 'target' && m.type === 'pig'), `no ${k} in ${m.type}`);   // (Risky Rolls' target is the score to bank: public)
    if (m.type === 'memory') assert.ok(m.cards.every(c => c === null), 'no Memory card');
  }
  const sec = JSON.parse(await get(`games/${g.id}/sec`));
  assert.ok(Object.keys(sec).length >= 0);
  // a board where every rule can be tried: Wordle in square 3, Tic-Tac-Toe elsewhere
  await nearWin(g.id, 'X');
  const s2 = await gameState(g.id);
  s2.squares[3] = { owner: null, mini: { type: 'wordle', guesses: [] } };
  const sec2 = JSON.parse(await get(`games/${g.id}/sec`)); sec2[3] = { word: 'CRANE' };
  await patch(`games/${g.id}`, { 'pub/state': JSON.stringify(s2), sec: JSON.stringify(sec2) });
  const before = await get(`games/${g.id}/pub/state`);
  assert.deepEqual(await g.O.call('move', { game: g.id, square: 4, move: 0 }), { ok: false, reason: 'turn' }, 'out of turn');
  assert.equal((await g.X.call('move', { game: g.id, square: 2, move: 0 })).ok, false, 'a taken cell');
  assert.equal((await g.X.call('move', { game: g.id, square: 0, move: 5 })).ok, false, 'a claimed square');
  assert.equal((await g.X.call('move', { game: g.id, square: 4, move: 9 })).ok, false, 'off the board');
  assert.equal((await g.X.call('move', { game: g.id, square: 4, move: 'x' })).ok, false, 'nonsense');
  assert.equal((await g.X.call('move', { game: g.id, square: 11, move: 0 })).ok, false, 'no such square');
  assert.deepEqual(await g.X.call('move', { game: g.id, square: 3, move: 'QZXJV' }), { ok: false, reason: 'notword' }, 'not a word');
  assert.deepEqual(await outsider.call('move', { game: g.id, square: 4, move: 0 }), { ok: false, reason: 'not-player' });
  assert.equal(await get(`games/${g.id}/pub/state`), before, 'nothing changed');
  // a Wordle guess: the word stays hidden until it is guessed
  const w = await g.X.call('move', { game: g.id, square: 3, move: 'CRATE', rep: [[0, 'key', 'k=C'], [310, 'key', 'k=R'], [600, 'key', 'k=A'], [5000, 'key', 'k=T'], [5200, 'key', 'k=E'], [5500, 'enter']] });
  assert.equal(w.ok, true);
  let s3 = await gameState(g.id);
  assert.equal(s3.turn, 'O'); assert.ok(!('word' in s3.squares[3].mini), 'still hidden after a wrong guess');
  const ent = s3.recent[s3.recent.length - 1];   // the move's replay log rides its entry, normalized (a long pause cut to 1.5 s), for the other phone to play back
  assert.deepEqual(ent.rep, [[0, 'key', 'k=C'], [310, 'key', 'k=R'], [600, 'key', 'k=A'], [2100, 'key', 'k=T'], [2300, 'key', 'k=E'], [2600, 'enter']], 'the log on the entry');
  assert.equal(ent.m, 'CRATE', 'and the move itself');
  assert.deepEqual(s3.squares[3].mini.guesses[0].marks, ['g', 'g', 'g', 'x', 'g']);
  assert.ok(s3.timer.deadline == null && E.clockDeadline(s3.timer) > Date.now() + 55000, 'a fresh minute for the next player, starting once their phone has played the move back (at the latest after the playback)');
  assert.equal((await g.O.call('move', { game: g.id, square: 3, move: 'CRANE', rep: 'nonsense' })).ok, true);   // (a bad log is dropped, the move stands)
  s3 = await gameState(g.id);
  assert.ok(!('rep' in s3.recent[s3.recent.length - 1]), 'a malformed log is left off the entry');
  assert.equal(s3.squares[3].owner, 'O'); assert.equal(s3.squares[3].mini.word, 'CRANE', 'revealed once guessed');
  // X wins the match: three in a row
  const fin = await g.X.call('move', { game: g.id, square: 2, move: 2 });
  assert.equal(fin.ok, true);
  await recorded(g.id);
  const done = await g.X.read(`games/${g.id}/pub`);
  assert.equal(done.status, 'over'); assert.equal(done.result.winner, 'X'); assert.equal(done.result.how, 'line');
  assert.equal(done.result.ratings, undefined, 'no rating change: ratings are off');
  assert.deepEqual(done.result.records, { X: { wins: 1, losses: 0, draws: 0 }, O: { wins: 0, losses: 1, draws: 0 } }, 'both records after the game');
  assert.deepEqual(await g.O.call('move', { game: g.id, square: 4, move: 0 }), { ok: false, reason: 'over' }, 'no moves after the end');
  const final = JSON.parse(done.final);
  assert.equal(final.winner, 'X'); assert.deepEqual(final.names, { X: g.X.name, O: g.O.name });
  for (const sq of final.squares) if (sq.mini.type === 'wordle') assert.ok(sq.mini.word, 'the final state reveals every word');
  const px = await g.X.read(`users/${g.X.uid}`), po = await g.O.read(`users/${g.O.uid}`);
  assert.deepEqual([px.rating, px.wins, px.losses, px.draws, px.games], [1200, 1, 0, 0, 1], 'the record moves, the rating does not');
  assert.deepEqual([po.rating, po.wins, po.losses, po.draws, po.games], [1200, 0, 1, 0, 1]);
  assert.deepEqual(px.minis.ttt, { won: 3 }, 'X won three Tic-Tac-Toe squares');
  assert.deepEqual(px.minis.wordle, { lost: 1 }, 'and lost the Wordle square');
  assert.deepEqual(po.minis.ttt, { lost: 3 }); assert.deepEqual(po.minis.wordle, { won: 1 });
  const hx = await g.X.read(`history/${g.X.uid}/${g.id}`), ho = await g.O.read(`history/${g.O.uid}/${g.id}`);
  assert.equal(hx.result, 'win'); assert.equal(ho.result, 'loss');
  assert.equal(hx.mode, 'match'); assert.equal(hx.rated, false); assert.equal(hx.how, 'line');
  assert.deepEqual([hx.ratingBefore, hx.ratingAfter], [undefined, undefined], 'no rating in the history');
  assert.deepEqual(hx.opponent, { uid: g.O.uid, name: g.O.name });
  const ox = await g.X.read(`oppStats/${g.X.uid}/${g.O.uid}`), oo = await g.O.read(`oppStats/${g.O.uid}/${g.X.uid}`);
  assert.deepEqual([ox.wins, ox.losses, ox.draws, ox.name], [1, undefined, undefined, g.O.name], 'the record against that opponent (Top opponents)');
  assert.deepEqual([oo.wins, oo.losses, oo.name], [undefined, 1, g.X.name]);
  assert.equal(JSON.parse(hx.final).winner, 'X');
  assert.equal(await g.X.read(`active/${g.X.uid}`), null, 'no longer in a game');
  assert.equal(await get(`leaderboard/${g.X.uid}`), null, 'no leaderboard while ratings are off');
  // others can see a player's history and profile
  const peek = await player('Nosy');
  assert.equal((await peek.read(`history/${g.X.uid}/${g.id}`)).result, 'win');
  assert.equal((await peek.read(`users/${g.X.uid}`)).wins, 1, 'and their record');
  assert.equal((await peek.read(`oppStats/${g.X.uid}/${g.O.uid}`)).wins, 1, 'and their top opponents');
});

test('Memory over the server: the first card is turned up for both, the second completes the move', async () => {
  const a = await player('Mia'), b = await player('Ned');
  const g = await pairUp(a, b, 'casual', 60);
  const st = await gameState(g.id);
  const deck = E.memoryDeck(E.makeRng('deck'));
  const pair = [];
  deck.forEach((c, i) => deck.forEach((d, j) => { if (i < j && c.s === d.s && c.c === d.c) pair.push(i, j); }));
  st.squares[5] = { owner: null, mini: { type: 'memory', cards: Array(9).fill(null), flips: 0, seen: [], last: null } };
  st.turn = 'X';
  const sec = JSON.parse(await get(`games/${g.id}/sec`)); sec[5] = { cards: deck };
  await patch(`games/${g.id}`, { 'pub/state': JSON.stringify(st), sec: JSON.stringify(sec) });
  const other = [0, 1, 2, 3, 4, 5, 6, 7, 8].find(k => !pair.includes(k));
  assert.equal((await g.X.call('move', { game: g.id, square: 5, kind: 'pick', card: other })).ok, true);
  let s = await gameState(g.id);
  assert.deepEqual(s.squares[5].mini.cards[other], deck[other], 'the picked card is shown');
  assert.equal(s.squares[5].mini.cards.filter(Boolean).length, 1, 'and only that one');
  assert.equal((await g.O.call('move', { game: g.id, square: 5, kind: 'pick', card: pair[0] })).ok, false, 'not O\'s turn');
  assert.equal((await g.X.call('move', { game: g.id, square: 5, move: [other, pair[0]] })).ok, true);
  s = await gameState(g.id);
  assert.equal(s.turn, 'O'); assert.equal(s.squares[5].owner, null);
  await g.O.call('resign', { game: g.id }); await recorded(g.id);
});

test('timeouts: the server checks the deadline; with both players away the sweep misses the turn (nothing played), two in a row lose', async () => {
  const a = await player('Ola'), b = await player('Pat');
  const g = await pairUp(a, b);
  assert.deepEqual(await g.O.call('timeout', { game: g.id }), { ok: false, reason: 'early' }, 'not before the deadline');
  const sw0 = await sweep(); assert.deepEqual([sw0.timeouts, sw0.finished, sw0.deleted, sw0.botMoves], [0, 0, 0, 0], 'the sweep leaves games in time alone');
  const expire = async () => { const st = await gameState(g.id); st.timer.deadline = Date.now() - 1000; await patch(`games/${g.id}`, { 'pub/state': JSON.stringify(st), dl: st.timer.deadline }); };
  // both phones are gone: the sweep misses X's turn, nothing played for X...
  const st0 = await gameState(g.id);
  await expire();
  assert.equal((await sweep()).timeouts, 1);
  let st = await gameState(g.id);
  assert.equal(st.timer.timeouts.X, 1); assert.equal(st.turn, 'O', 'the turn passed');
  assert.deepEqual([st.seq, st.recent.length, st.timer.miss.by, st.timer.miss.kind, JSON.stringify(st.squares.map(q => q.mini.last || null)) === JSON.stringify(st0.squares.map(q => q.mini.last || null))], [st0.seq, st0.recent.length, 'X', 'missed', true], 'no move made: nothing to play back, the phones told by the timer');
  assert.ok(st.timer.deadline > Date.now() + 25000, 'O\'s clock at once (nothing to play back)');
  // ...then for O, then X runs out again: two in a row for X loses the match
  await expire(); await sweep();
  st = await gameState(g.id);
  if (st.turn === 'O') { await expire(); await sweep(); st = await gameState(g.id); }   // (a Hangman hit or a Risky Rolls roll keeps the turn)
  assert.equal(st.turn, 'X');
  await expire();
  assert.equal((await sweep()).timeouts, 1);
  await recorded(g.id);
  const pub = await get(`games/${g.id}/pub`);
  assert.equal(pub.status, 'over'); assert.equal(pub.result.winner, 'O'); assert.equal(pub.result.how, 'timeout');
  assert.equal((await get(`history/${g.X.uid}/${g.id}`)).how, 'timeout');
  assert.deepEqual(pub.result.records.X, { wins: 0, losses: 1, draws: 0 }, 'a loss on the record');
  // either phone may also call it, once the deadline has passed
  const c = await player('Quin'), d = await player('Rae');
  const h = await pairUp(c, d, 'casual', 30);
  const s2 = await gameState(h.id); s2.timer.deadline = Date.now() - 1; await patch(`games/${h.id}`, { 'pub/state': JSON.stringify(s2) });
  const r = await h.O.call('timeout', { game: h.id });
  assert.equal(r.ok, true, 'the waiting player\'s phone called time');
  assert.deepEqual(await h.X.call('timeout', { game: h.id }), { ok: false, reason: 'early' }, 'and only once');
  await h.X.call('resign', { game: h.id });
});

test('resigning: the other player wins; a loss and a win on the records, no rating change', async () => {
  const a = await player('Sam'), b = await player('Tia');
  const g = await pairUp(a, b);
  assert.equal((await g.O.call('resign', { game: g.id })).ok, true);
  await recorded(g.id);
  const pub = await get(`games/${g.id}/pub`);
  assert.equal(pub.result.winner, 'X'); assert.equal(pub.result.how, 'resign');
  assert.equal((await get(`history/${g.O.uid}/${g.id}`)).result, 'loss');
  assert.equal((await get(`history/${g.O.uid}/${g.id}`)).how, 'resign');
  assert.deepEqual(await g.X.call('resign', { game: g.id }), { ok: false, reason: 'over' });
  const po = await get(`users/${g.O.uid}`), px = await get(`users/${g.X.uid}`);
  assert.deepEqual([po.rating, po.wins, po.losses, po.games], [1200, 0, 1, 1]);
  assert.deepEqual([px.rating, px.wins, px.losses, px.games], [1200, 1, 0, 1]);
  assert.deepEqual([px.sides, po.sides], [{ X: { wins: 1, games: 1 } }, { O: { losses: 1, games: 1 } }], 'by side: a win as X, a loss as O');
  for (const p of [g.X, g.O]) assert.ok(Math.abs((await get(`lastSeen/${p.uid}`)) - Date.now()) < 60000, 'both players\' last activity: the match');
  assert.equal(po.minis, undefined, 'no square was won or lost');
});

test('ratings off: five wins in a row list nobody on the leaderboard and leave the rating alone', async () => {
  const star = await player('Star');
  const others = await Promise.all([1, 2, 3, 4, 5].map(k => player('Opp' + k)));
  for (let k = 0; k < 5; k++) {
    const g = await pairUp(star, others[k]);
    if (g.X === star) { await nearWin(g.id, 'X'); assert.equal((await star.call('move', { game: g.id, square: 2, move: 2 })).ok, true); }
    else await others[k].call('resign', { game: g.id });
    await recorded(g.id);
  }
  const prof = await get(`users/${star.uid}`);
  assert.deepEqual([prof.wins, prof.losses, prof.draws, prof.games, prof.rating], [5, 0, 0, 5, 1200]);
  assert.equal(await get(`leaderboard/${star.uid}`), null, 'not listed');
});

// A friend game whose players have both gone: the server alone misses their turns (Classic) or rounds (Super
// Chaos), and a second miss in a row ends the match as a forfeit, recorded, the room closed; a phone that comes
// back finds the result.
async function friendRoom(host, guest, code, setup, id) {
  const rec = E.newOnlineMatch(Object.assign({ names: { X: host.name, O: guest.name } }, setup), E.makeRng(code), id, Date.now());
  if (!setup.chaos) E.armClock(rec.state, [], Date.now());     // (the host's phone starts the first turn's clock, as the app does)
  await host.write(`rooms/${code}`, { created: Date.now(), host: host.uid, status: 'lobby', players: { X: { uid: host.uid, name: host.name, joined: Date.now() } }, setup: { hostSide: 'X', timer: setup.timer || 0, chaos: !!setup.chaos } });
  await guest.write(`rooms/${code}/players/O`, { uid: guest.uid, name: guest.name, joined: Date.now() });
  await host.write(`rooms/${code}/status`, 'playing');
  await host.write(`rooms/${code}/match`, E.packMatch(rec));
  return rec;
}
const roomRec = async code => E.parseMatch(await get(`rooms/${code}/match`));
// The owner sets the room's match (its due moment comes from the trigger, as for any write)
async function roomSet(code, fn) {
  const rec = await roomRec(code), full = E.fullState(rec);
  fn(full);
  await put(`rooms/${code}/match`, E.packMatch(E.matchRecord(full)));
  await until(async () => { const dl = await get(`rooms/${code}/dl`); return dl != null && dl <= Date.now(); }, 10000, 'the room due now');
}
test('friend games: with both players gone the server misses their turns; two in a row is a forfeit, recorded, the room closed (Classic)', async () => {
  const host = await player('Abby'), guest = await player('Bert');
  const code = 'GWNEC';
  await friendRoom(host, guest, code, { timer: 30, games: Object.fromEntries(E.TYPES.map(t => [t, t === 'hilo' || t === 'c4'])) }, 'gc1');
  const dl0 = await until(() => get(`rooms/${code}/dl`), 10000, 'the room\'s due moment from its first write');
  assert.ok(dl0 > Date.now(), 'not due yet: the first turn\'s clock runs');
  assert.equal((await sweep()).roomTimeouts, 0, 'nothing due: the sweep leaves it');
  // both phones closed: each turn runs out on the server alone
  let st = null, misses = 0;
  for (let k = 0; k < 6; k++) {
    await roomSet(code, f => { f.timer.deadline = Date.now() - 10000; f.timer.startBy = null; f.timer.for = f.turn; });
    const r = await sweep();
    assert.equal(r.roomTimeouts, 1, 'the sweep missed the turn');
    misses++;
    st = (await roomRec(code)).state;
    if (st.winner) break;
    assert.ok(st.timer.deadline > Date.now(), 'the next turn\'s clock runs at once (away is never a pause)');
  }
  assert.equal(st.winReason, 'timeout'); assert.equal(st.winner, 'O'); assert.equal(st.resigned, 'X', 'X missed two in a row first');
  assert.ok(misses <= 4, `ended after ${misses} misses`);
  await until(async () => (await get(`rooms/${code}/status`)) === 'over', 10000, 'the room closed');
  assert.equal(await get(`rooms/${code}/dl`), null, 'nothing more due');
  const id = 'f_' + code + '_gc1';
  const hx = await until(() => host.read(`history/${host.uid}/${id}`), 10000, 'the forfeit in the host\'s history');
  const ho = await until(() => guest.read(`history/${guest.uid}/${id}`), 10000, 'and the guest\'s');
  assert.deepEqual([hx.result, hx.how, ho.result, ho.how], ['loss', 'timeout', 'win', 'timeout']);
  // both come back: the room (its status, the match's result) is what each phone opens on
  for (const p of [host, guest]) {
    const room = await p.read(`rooms/${code}`), rec = E.parseMatch(room.match);
    assert.deepEqual([room.status, rec.state.winner, rec.state.winReason, rec.state.resigned], ['over', 'O', 'timeout', 'X'], `${p.name} sees the result`);
  }
});
test('friend games: Super Chaos with both phones gone: rounds settle on the server, a recap nobody finished begins the next, two misses in a row forfeit', async () => {
  await put('releases/superchaos', true);
  const host = await player('Cass'), guest = await player('Dree');
  const code = 'GWNES';
  await friendRoom(host, guest, code, { chaos: true, games: Object.fromEntries(E.TYPES.map(t => [t, t === 'hilo'])) }, 'gs1');
  // round 1: the host moves, then closes the app; the guest never comes back
  const r1 = await roomRec(code), mv = (() => {
    const st = E.fullState(r1); st.online = { role: 'host', code, me: 'X' };
    st.sc = Object.assign(JSON.parse(JSON.stringify(r1.state.sc)), { me: null, moved: null, start: null, steps: null, recap: null });
    st.turn = 'X'; st.lock = null;
    const i = st.squares.findIndex(q => q.mini.type === 'hilo');
    assert.ok(E.playMove(st, i, 15, E.makeRng('hm')).ok);
    return Object.assign(E.scMoveOf(st, 'X'), { at: Date.now() });
  })();
  await host.write(`rooms/${code}/match`, E.packMatch(E.applyChaosSubmit(r1, 'X', mv, E.makeRng('s'), Date.now(), 0).rec));
  for (let k = 0; k < 6; k++) {
    const before = (await roomRec(code)).state.seq;
    await roomSet(code, f => { if (f.sc.deadline != null) f.sc.deadline = Date.now() - 10000; else { f.sc.recap.at = Date.now() - 200000; f.sc.ready = null; } });
    const sw = await sweep();                                     // (a due moment already past: the room's tick, queued by the write, may have looked first; the sweep is the backup: one of them, once)
    assert.ok(sw.roomTimeouts <= 1, 'looked at once');
    const st = await until(async () => { const r = (await roomRec(code)).state; return r.seq > before ? r : null; }, 10000, 'the server moved the match on');
    if (st.winner) break;
  }
  const st = (await roomRec(code)).state;
  assert.deepEqual([st.winner, st.winReason, st.resigned, st.sc.miss], ['X', 'timeout', 'O', { X: 1, O: 2 }], 'the guest missed two rounds in a row (the host one): the host wins by forfeit');
  await until(async () => (await get(`rooms/${code}/status`)) === 'over', 10000, 'the room closed');
  const id = 'f_' + code + '_gs1';
  assert.deepEqual([(await until(() => host.read(`history/${host.uid}/${id}`), 10000, 'history')).result, (await until(() => guest.read(`history/${guest.uid}/${id}`), 10000, 'history')).result], ['win', 'loss']);
  for (const p of [host, guest]) { const rec = E.parseMatch((await p.read(`rooms/${code}`)).match); assert.equal(rec.state.winner, 'X', `${p.name} sees the result`); }
});

// The round's deadline is the server's to keep, whatever the phones show: the record's write queues the server's look
// at the room for the due moment (roomTick, a Cloud Task; the sweep each minute is the backup). Here no phone acts
// and no sweep runs: the task settles the round at its deadline.
test('friend games: Super Chaos round nobody settles: the server settles it at its deadline by the room\'s tick (queued by the round\'s write), no phone open, no sweep', async () => {
  await put('releases/superchaos', true);
  const host = await player('Tock'), guest = await player('Tick');
  const code = 'GTCKS';
  await friendRoom(host, guest, code, { chaos: true, games: Object.fromEntries(E.TYPES.map(t => [t, t === 'hilo'])) }, 'gt1');
  const r1 = await roomRec(code), mv = (() => {
    const st = E.fullState(r1); st.online = { role: 'host', code, me: 'X' };
    st.sc = Object.assign(JSON.parse(JSON.stringify(r1.state.sc)), { me: null, moved: null, start: null, steps: null, recap: null });
    st.turn = 'X'; st.lock = null;
    assert.ok(E.playMove(st, st.squares.findIndex(q => q.mini.type === 'hilo'), 15, E.makeRng('hm')).ok);
    return Object.assign(E.scMoveOf(st, 'X'), { at: Date.now() });
  })();
  await host.write(`rooms/${code}/match`, E.packMatch(E.applyChaosSubmit(r1, 'X', mv, E.makeRng('s'), Date.now(), 0).rec));
  // the host's move in; the guest never moves. The deadline brought close: this write queues the server's look at the room for the due moment
  const t0 = Date.now();
  await roomSet(code, f => { f.sc.deadline = t0 + 1500; });
  const due = await until(async () => { const v = await get(`rooms/${code}/dl`); return v === t0 + 1500 + E.SC_ONLINE.graceMs ? v : null; }, 10000, "the room's due moment");
  const st = await until(async () => { const r = await roomRec(code); return r.state.sc.recap && r.state.sc.recap.round === 1 ? r.state : null; }, 20000, 'the round settled by the server at its deadline');
  const at = Date.now();
  assert.deepEqual([st.sc.recap.mv.O, st.sc.recap.missed, st.sc.miss], [null, ['O'], { X: 0, O: 1 }], 'the guest missed the round; nothing played for them');
  assert.ok(at >= due - 1000 && at - due < 8000, `settled at its due moment, not before (${at - due} ms after it)`);
  assert.ok((await get(`rooms/${code}/dl`)) > at, 'the next look queued: the recap nobody finishes begins the next round');
});

test('friend-code games are saved to the history of players with accounts, marked unrated', async () => {
  const host = await player('Host1'), guest = await player('Guest1');
  const anon = await player(null, { anonymous: true });
  const code = 'FRDGM';
  const rec = E.newOnlineMatch({ names: { X: 'Host1', O: 'Guest1' } }, E.makeRng(9), 'fm1');
  await host.write(`rooms/${code}`, { created: Date.now(), host: host.uid, status: 'lobby', players: { X: { uid: host.uid, name: 'Host1', joined: Date.now() } }, setup: { hostSide: 'X', timer: 0 } });
  await guest.write(`rooms/${code}/players/O`, { uid: guest.uid, name: 'Guest1', joined: Date.now() });
  await host.write(`rooms/${code}/status`, 'playing');
  await host.write(`rooms/${code}/match`, { state: JSON.stringify(rec.state), secrets: JSON.stringify(rec.secrets) });
  // the host wins on the board
  const full = E.fullState(rec);
  full.squares[0].owner = 'X'; full.squares[1].owner = 'X'; full.squares[2].owner = 'X';
  full.winner = 'X'; full.winLine = [0, 1, 2]; full.winReason = 'line';
  const end = E.matchRecord(full);
  await guest.write(`rooms/${code}/match`, { state: JSON.stringify(end.state), secrets: JSON.stringify(end.secrets) });
  const id = 'f_' + code + '_fm1';
  const hh = await until(() => host.read(`history/${host.uid}/${id}`), 10000, 'the friend game in the host\'s history');
  assert.equal(hh.mode, 'friend'); assert.equal(hh.rated, false); assert.equal(hh.result, 'win'); assert.equal(hh.how, 'line');
  assert.deepEqual(hh.opponent, { uid: guest.uid, name: 'Guest1' });
  const gh = await until(() => guest.read(`history/${guest.uid}/${id}`), 10000, 'the friend game in the guest\'s history');
  assert.equal(gh.result, 'loss'); assert.equal(gh.ratingBefore, undefined);
  const hu = await get(`users/${host.uid}`), gu = await get(`users/${guest.uid}`);
  assert.equal(hu.rating, 1200, 'friend games never change ratings');
  assert.deepEqual(hu.friend, { wins: 1, games: 1, sides: { X: { wins: 1, games: 1 } } }, 'a win on the host\'s vs-friends record, played as X');
  assert.deepEqual(gu.friend, { losses: 1, games: 1, sides: { O: { losses: 1, games: 1 } } }, 'a loss on the guest\'s, as O');
  assert.equal(hu.sides, undefined, 'the Find Match sides untouched');
  const oh = await get(`oppStats/${host.uid}/${guest.uid}`), og = await get(`oppStats/${guest.uid}/${host.uid}`);
  assert.deepEqual([oh.name, oh.wins, oh.losses, oh.draws], ['Guest1', 1, undefined, undefined], 'the host\'s record against the guest (Top opponents)');
  assert.deepEqual([og.name, og.wins, og.losses], ['Host1', undefined, 1]);
  assert.deepEqual([hu.wins, hu.games], [0, 0], 'the main record is Find Match games only');
  const sq = E.fullState(end).squares.slice(0, 3).map(q => q.mini.type), counts = {};
  for (const t of sq) counts[t] = (counts[t] || 0) + 1;
  for (const [t, n] of Object.entries(counts)) { assert.equal(hu.minis[t].won, n, `host won ${n} ${t}`); assert.equal(gu.minis[t].lost, n); }
  assert.equal(await get(`history/${anon.uid}`), null);
});

/* ===================================== game stats ===================================== */
const S = require('../../functions/statsRules.js');
const { execFile } = require('node:child_process');
const path = require('node:path');
const statsNow = async () => (await get('stats')) || {};
const at = (o, p) => p.split('/').reduce((v, k) => (v == null ? undefined : v[k]), o) || 0;
// How much each of these counters moved while `fn` ran (the counters are shared by every test).
async function delta(paths, fn) {
  const s0 = await statsNow();
  await fn();
  const s1 = await statsNow();
  return Object.fromEntries(paths.map(p => [p, at(s1, p) - at(s0, p)]));
}
const day = () => S.periodKeys(Date.now());

test('stats: a phone reports its local matches (each local mode), counted once; bad reports are refused', async () => {
  const guest = await player(null, { anonymous: true });
  const id = 'loc' + Date.now(), dev = 'dtest' + Date.now();
  const squares = [{ t: 'ttt', end: 'won', w: 'X', X: 3, O: 2 }, { t: 'ttt', end: 'draw', w: null, X: 4, O: 4 }, { t: 'coins', end: 'open', w: null, X: 2, O: 0 }];
  const d = day().d;
  const moved = await delta(['modes/cpu/started', 'modes/cpu/finished', 'modes/cpu/turns', 'modes/cpu/xWins', 'modes/cpu/timed', `days/${d}/started/cpu`, `days/${d}/finished/cpu`,
    'mini/cpu/ttt/played', 'mini/cpu/ttt/won', 'mini/cpu/ttt/draw', 'mini/cpu/ttt/winMoves', 'mini/cpu/ttt/loseMoves', 'mini/cpu/ttt/allMoves', 'mini/cpu/ttt/xWins', 'mini/cpu/coins/open', `days/${d}/active`], async () => {
    assert.deepEqual(await guest.call('track', { ev: 'start', mode: 'cpu', id, dev }), { ok: true });
    assert.deepEqual(await guest.call('track', { ev: 'start', mode: 'cpu', id, dev }), { ok: true, seen: true }, 'a repeated start is not counted again');
    assert.deepEqual(await guest.call('track', { ev: 'end', mode: 'cpu', id, dev, winner: 'X', reason: 'line', squares }), { ok: true });
    assert.deepEqual(await guest.call('track', { ev: 'end', mode: 'cpu', id, dev, winner: 'X', reason: 'line', squares }), { ok: true, seen: true }, 'nor a repeated end');
  });
  assert.deepEqual(moved, { 'modes/cpu/started': 1, 'modes/cpu/finished': 1, 'modes/cpu/turns': 15, 'modes/cpu/xWins': 1, 'modes/cpu/timed': 1, [`days/${d}/started/cpu`]: 1, [`days/${d}/finished/cpu`]: 1,
    'mini/cpu/ttt/played': 2, 'mini/cpu/ttt/won': 1, 'mini/cpu/ttt/draw': 1, 'mini/cpu/ttt/winMoves': 3, 'mini/cpu/ttt/loseMoves': 2, 'mini/cpu/ttt/allMoves': 13, 'mini/cpu/ttt/xWins': 1, 'mini/cpu/coins/open': 1, [`days/${d}/active`]: 1 });
  // the page without the SDK (a guest playing on one phone) posts the same call with no login at all
  const plain = async data => { const r = await fetch(`${FN}/track`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ data }) }); return { status: r.status, body: await r.json() }; };
  for (const mode of ['local', 'cvc']) {
    const mid = mode + Date.now();
    const m2 = await delta([`modes/${mode}/started`, `modes/${mode}/finished`], async () => {
      assert.equal((await plain({ ev: 'start', mode, id: mid, dev: 'dplain' + Date.now() })).status, 200);
      assert.equal((await plain({ ev: 'end', mode, id: mid, dev: 'dplain' + Date.now(), winner: 'O', reason: 'majority', squares: [{ t: 'pig', end: 'won', w: 'O', X: 1, O: 2 }] })).status, 200);
    });
    assert.deepEqual(m2, { [`modes/${mode}/started`]: 1, [`modes/${mode}/finished`]: 1 }, mode);
  }
  // refused: online modes (the server counts those), a broken match, nonsense
  const unchanged = await delta(['modes/ranked/finished', 'modes/local/finished'], async () => {
    for (const bad of [{ ev: 'end', mode: 'ranked', id: 'r' + Date.now(), squares: [] }, { ev: 'end', mode: 'local', id: 'b' + Date.now(), squares: [{ t: 'chess', end: 'won', w: 'X', X: 1, O: 1 }] },
      { ev: 'end', mode: 'local', id: 'c' + Date.now(), squares: [{ t: 'ttt', end: 'won', X: 1, O: 1 }] }, { ev: 'start', mode: 'local', id: 'x/y' }, { ev: 'boom', mode: 'local', id: 'z' + Date.now() }, {}]) {
      const r = await plain(bad);
      assert.equal(r.status, 400, JSON.stringify(bad)); assert.equal(r.body.error.status, 'INVALID_ARGUMENT');
    }
  });
  assert.deepEqual(unchanged, { 'modes/ranked/finished': 0, 'modes/local/finished': 0 });
});

test('stats: logins count accounts only; a new account counts on its day, week and month', async () => {
  const k = day();
  const moved = await delta([`days/${k.d}/logins`, `weeks/${k.w}/logins`, `months/${k.m}/logins`, `days/${k.d}/newAccounts`, `weeks/${k.w}/newAccounts`, `months/${k.m}/newAccounts`], async () => {
    const p = await player('Newbie');                               // claims a username: a new account
    assert.deepEqual(await p.call('track', { ev: 'login' }), { ok: true });
    const anon = await player(null, { anonymous: true });
    assert.deepEqual(await anon.call('track', { ev: 'login' }), { ok: false }, 'a guest session is not a login');
  });
  assert.deepEqual(Object.values(moved), [1, 1, 1, 1, 1, 1]);
});

test('stats: Find Match games are counted by the server, started when paired and finished with their mini-games', async () => {
  const d = day().d;
  let g;
  const moved = await delta(['modes/match/started', 'modes/match/finished', 'modes/match/xWins', 'modes/match/timed', `days/${d}/started/match`, `days/${d}/finished/match`,
    'mini/match/ttt/won', 'mini/match/ttt/winMoves', 'mini/match/ttt/xWins', 'modes/match/resigned'], async () => {
    g = await pairUp(await player('StatA'), await player('StatB'));
    await nearWin(g.id, 'X');
    assert.equal((await g.X.call('move', { game: g.id, square: 2, move: 2 })).ok, true);
    await recorded(g.id);
  });
  assert.deepEqual(moved, { 'modes/match/started': 1, 'modes/match/finished': 1, 'modes/match/xWins': 1, 'modes/match/timed': 1, [`days/${d}/started/match`]: 1, [`days/${d}/finished/match`]: 1,
    'mini/match/ttt/won': 1, 'mini/match/ttt/winMoves': 1, 'mini/match/ttt/xWins': 1, 'modes/match/resigned': 0 });
  const res = await delta(['modes/match/started', 'modes/match/finished', 'modes/match/resigned', 'modes/match/oWins'], async () => {
    const h = await pairUp(await player('StatC'), await player('StatD'), 'casual', 30);
    assert.equal((await h.X.call('resign', { game: h.id })).ok, true);
    await recorded(h.id);
  });
  assert.deepEqual(res, { 'modes/match/started': 1, 'modes/match/finished': 1, 'modes/match/resigned': 1, 'modes/match/oWins': 1 });
});

test('stats: friend-code matches are counted from the room, start and end once each', async () => {
  const host = await player(null, { anonymous: true }), guest = await player(null, { anonymous: true });
  const code = 'STATS', d = day().d;
  const moved = await delta(['modes/friend/started', 'modes/friend/finished', 'modes/friend/oWins', `days/${d}/finished/friend`, 'mini/friend/hilo/won'], async () => {
    const rec = E.newOnlineMatch({ names: { X: 'H', O: 'G' }, games: Object.fromEntries(E.TYPES.map(t => [t, t === 'hilo'])) }, E.makeRng(5), 'sm1');
    await host.write(`rooms/${code}`, { created: Date.now(), host: host.uid, status: 'lobby', players: { X: { uid: host.uid, name: 'H', joined: Date.now() } }, setup: { hostSide: 'X', timer: 0 } });
    await guest.write(`rooms/${code}/players/O`, { uid: guest.uid, name: 'G', joined: Date.now() });
    await host.write(`rooms/${code}/status`, 'playing');
    await host.write(`rooms/${code}/match`, { state: JSON.stringify(rec.state), secrets: JSON.stringify(rec.secrets) });
    await until(async () => at(await statsNow(), 'modes/friend/started'), 10000, 'the friend match counted as started');
    // O claims three squares in a row by guessing each number
    let r = { state: rec.state, secrets: rec.secrets };
    for (const i of [0, 1, 2]) {
      const target = r.secrets[i].target;
      r.state.turn = 'O';
      const m = E.applyOnlineMove(r, 'O', i, target, E.makeRng(i));
      assert.equal(m.ok, true); r = m.rec;
    }
    assert.equal(r.state.winner, 'O');
    await guest.write(`rooms/${code}/match`, { state: JSON.stringify(r.state), secrets: JSON.stringify(r.secrets) });
    await until(async () => at(await statsNow(), 'mini/friend/hilo/won') >= 3, 10000, 'the friend match counted as finished');
    await host.write(`rooms/${code}/match/seen`, 1);                 // another write to the finished match: not counted again
    await wait(1500);
  });
  assert.equal(moved['modes/friend/started'], 1); assert.equal(moved['modes/friend/finished'], 1); assert.equal(moved['modes/friend/oWins'], 1);
  assert.equal(moved[`days/${d}/finished/friend`], 1); assert.equal(moved['mini/friend/hilo/won'], 3);
});

test('stats: only the admin can read them, nobody can write them; make-admin.js gives and takes back the flag', async () => {
  const boss = await player('BossLady'), other = await player('Plain');
  await denied(other.read('stats'), 'a player reading the stats');
  await denied(boss.read('stats'), 'reading the stats before the flag');
  await denied(other.write('stats/modes/local/started', 999), 'a player writing the stats');
  const anon = await player(null, { anonymous: true });
  await denied(anon.read('stats/modes'), 'a guest reading the stats');
  const statsReq = await fetch(`http://${DB_HOST}/stats.json?ns=${NS}`);
  assert.equal(statsReq.status, 401, 'no reading without a login at all');
  const script = (...args) => new Promise((resolve, reject) => execFile(process.execPath, [path.join(__dirname, '..', '..', 'scripts', 'make-admin.js'), ...args],
    { env: Object.assign({}, process.env, { TTC_PROJECT: PROJECT, GCLOUD_PROJECT: PROJECT }) }, (e, out) => (e ? reject(new Error(out || e.message)) : resolve(out))));
  assert.match(await script('BossLady', 'grant'), /BossLady is now the admin/);
  await boss.auth.currentUser.getIdToken(true);                      // the flag comes with a fresh token
  const s = await boss.read('stats');
  assert.ok(s && s.modes, 'the admin reads the stats');
  await denied(boss.write('stats/modes/local/started', 999), 'even the admin cannot write them');
  await denied(other.read('stats'), 'still not the others');
  await assert.rejects(script('NoSuchPlayer', 'grant'), /No player has the username/);
  assert.match(await script('BossLady', 'revoke'), /no longer an admin/);
  await boss.auth.currentUser.getIdToken(true);
  await denied(boss.read('stats'), 'reading the stats once the flag is gone');
});

test('stats: the sweep forgets counted matches after three days (the counts stay)', async () => {
  await put('statsSeen/match/l_oldone', { t0: Date.now() - 4 * 86400000, s: 1 });
  await put('statsSeen/match/l_newone', { t0: Date.now() - 3600000, s: 1 });
  const before = await get('stats/modes');
  await sweep();
  assert.equal(await get('statsSeen/match/l_oldone'), null, 'a match from four days ago is forgotten');
  assert.ok(await get('statsSeen/match/l_newone'), 'an hour-old one is kept');
  assert.deepEqual(await get('stats/modes'), before, 'the counts are untouched');
});

test('records: a friend match is credited by the seats it was played in (the room may have swapped them for a Random rematch)', async () => {
  const host = await player('SeatHost'), guest = await player('SeatGuest');
  const code = 'SEATS';
  await host.write(`rooms/${code}`, { created: Date.now(), host: host.uid, status: 'lobby', players: { X: { uid: host.uid, name: 'SeatHost', joined: Date.now() } }, setup: { hostSide: 'X', hostPick: 'random', timer: 0 } });
  await guest.write(`rooms/${code}/players/O`, { uid: guest.uid, name: 'SeatGuest', joined: Date.now() });
  // the match was played with the guest as X; by the time its end is read the room says otherwise
  const seats = { X: { uid: guest.uid, name: 'SeatGuest' }, O: { uid: host.uid, name: 'SeatHost' } };
  const rec = E.newOnlineMatch({ names: { X: 'SeatGuest', O: 'SeatHost' }, games: Object.fromEntries(E.TYPES.map(t => [t, !E.TEST_TYPES.includes(t)])) }, E.makeRng(4), 'seat1');   // (released games only: the host is no admin)
  const full = E.fullState(rec);
  full.squares[0].owner = 'X'; full.squares[4].owner = 'X'; full.squares[8].owner = 'X'; full.winner = 'X'; full.winLine = [0, 4, 8]; full.winReason = 'line';
  const end = E.matchRecord(full);
  await host.write(`rooms/${code}/status`, 'playing');
  await guest.write(`rooms/${code}/match`, { state: JSON.stringify(end.state), secrets: JSON.stringify(end.secrets), seats });
  const id = 'f_' + code + '_seat1';
  const gh = await until(() => guest.read(`history/${guest.uid}/${id}`), 10000, 'the guest\'s history');
  assert.equal(gh.side, 'X'); assert.equal(gh.result, 'win', 'the guest played X and won');
  assert.equal((await host.read(`history/${host.uid}/${id}`)).result, 'loss');
  assert.deepEqual((await get(`users/${guest.uid}`)).friend, { wins: 1, games: 1, sides: { X: { wins: 1, games: 1 } } }, 'the side as played');
  assert.deepEqual((await get(`users/${host.uid}`)).friend, { losses: 1, games: 1, sides: { O: { losses: 1, games: 1 } } });
});

/* ===================================== local matches ===================================== */
// A local match as a phone reports it: player 1 on `side`; won on the board (X has the top row) or left.
function localReport(id, side, how) {
  const st = E.newMatch(E.makeRng('loc' + id), { games: ['ttt', 'bs', 'pig'] });
  if (how === 'resign') { E.resignLocal(st, side); st.squares[4].owner = side === 'X' ? 'O' : 'X'; }
  else { [0, 1, 2].forEach(i => { st.squares[i].owner = 'X'; }); st.squares[4].owner = 'O'; st.winner = 'X'; st.winLine = [0, 1, 2]; st.winReason = 'line'; }
  return { id, side, opponent: { name: 'Computer', cpu: true }, final: { squares: st.squares, winner: st.winner, winLine: st.winLine, winReason: st.winReason, resigned: st.resigned || null, counts: null, moves: 7, games: st.games, names: { X: side === 'X' ? 'LocalLou' : 'Computer', O: side === 'O' ? 'LocalLou' : 'Computer' } } };
}
test('local matches: a logged-in player\'s are recorded once, privately (record, mini-games, history); bad reports refused', async () => {
  const p = await player('LocalLou'), q = await player('Snoopy');
  const won = localReport('locwin01', 'X', 'line');
  assert.deepEqual(await p.call('recordLocal', won), { ok: true, result: 'win' });
  assert.deepEqual(await p.call('recordLocal', won), { ok: true, seen: true }, 'the same match counts once');
  const lost = localReport('locres01', 'O', 'resign');                 // left through the menu, as O: a loss
  assert.deepEqual(await p.call('recordLocal', lost), { ok: true, result: 'loss' });
  const ls = await get(`localStats/${p.uid}`);
  assert.deepEqual([ls.wins, ls.losses, ls.draws || 0, ls.games], [1, 1, 0, 2]);
  assert.deepEqual(ls.sides, { X: { wins: 1, games: 1 }, O: { losses: 1, games: 1 } }, 'won as X, left as O');
  assert.equal(ls.minis[won.final.squares[0].mini.type].won >= 1, true, 'squares won, by mini-game');
  const h = await get(`localHistory/${p.uid}`);
  assert.deepEqual(Object.keys(h).sort(), ['l_locres01', 'l_locwin01']);
  assert.equal(h.l_locwin01.mode, 'local'); assert.equal(h.l_locwin01.opponent.cpu, true); assert.equal(h.l_locwin01.how, 'line');
  assert.equal(h.l_locres01.result, 'loss'); assert.equal(h.l_locres01.how, 'resign');
  assert.ok(JSON.parse(h.l_locwin01.final).squares.length === 9, 'the final board, for the review');
  const u = await get(`users/${p.uid}`);
  assert.deepEqual([u.wins, u.losses, u.games], [0, 0, 0], 'the online record is untouched'); assert.equal(u.minis, undefined);
  // private: only the player reads them; nobody writes them
  assert.ok(await p.read(`localStats/${p.uid}`)); assert.ok(await p.read(`localHistory/${p.uid}`));
  await denied(q.read(`localStats/${p.uid}`), 'someone else\'s local record');
  await denied(q.read(`localHistory/${p.uid}`), 'someone else\'s local history');
  await denied(p.write(`localStats/${p.uid}/wins`, 99), 'writing your own local record');
  await denied(p.write(`localHistory/${p.uid}/x`, { result: 'win' }), 'writing your own local history');
  // reports that do not hold together
  const fake = localReport('locfake1', 'X', 'line'); fake.final.squares[2].owner = null;       // no line on the board
  const notMine = localReport('locfake2', 'X', 'resign'); notMine.final.resigned = 'O'; notMine.final.winner = 'X';   // "the other side left"
  const odd = localReport('locfake3', 'X', 'line'); odd.final.squares[5].mini.type = 'chess';
  for (const bad of [fake, notMine, odd, { id: 'x', side: 'X' }, Object.assign(localReport('locfake4', 'Q', 'line'))]) {
    await assert.rejects(p.call('recordLocal', bad), /Not a match/, JSON.stringify(bad).slice(0, 50));
  }
  const anon = await player(null, { anonymous: true });
  await assert.rejects(anon.call('recordLocal', localReport('locanon1', 'X', 'line')), /Log in first/);
  assert.equal((await get(`localStats/${p.uid}`)).games, 2, 'nothing more counted');
});

test('a draw: once neither player can still make a line, a Find Match game ends there, a draw on both records; local draws are recorded too', async () => {
  const a = await player('Dana_D'), b = await player('Drew_D');
  const g = await pairUp(a, b);
  await rewrite(g.id, full => {                                   // O O X / X O O / O X [X X _]: O could still win at 8, X takes it
    tttBoard(full);
    ['O', 'O', 'X', 'X', 'O', 'O', 'O', 'X'].forEach((o, i) => { full.squares[i].owner = o; });
    full.squares[8].mini.cells = ['X', 'X', null, 'O', 'O', null, null, null, null];
    full.turn = 'X'; full.lock = null; full.timer.deadline = Date.now() + 600000;
  });
  assert.equal((await g.X.call('move', { game: g.id, square: 8, move: 2 })).ok, true);
  await recorded(g.id);
  const pub = await get(`games/${g.id}/pub`), st = JSON.parse(pub.state);
  assert.deepEqual([st.winner, st.winReason, pub.status], ['draw', 'blocked', 'over']);
  assert.equal(pub.result.winner, undefined, 'no winner (the database keeps no nulls)'); assert.equal(pub.result.how, 'draw');
  for (const p of [g.X, g.O]) {
    const h = await get(`history/${p.uid}/${g.id}`), u = await get(`users/${p.uid}`);
    assert.deepEqual([h.result, h.how], ['draw', 'draw']);
    assert.deepEqual([u.wins, u.losses, u.draws, u.games], [0, 0, 1, 1], 'a draw on the record');
    assert.deepEqual(u.sides, { [p === g.X ? 'X' : 'O']: { draws: 1, games: 1 } }, 'and on the side played');
  }
  assert.deepEqual(await g.O.call('move', { game: g.id, square: 8, move: 0 }), { ok: false, reason: 'over' });
  // a local match that ended the same way, and one from before the rule (most squares)
  const lp = await player('LocalDee');
  const sq = owners => owners.map(o => ({ owner: o, mini: E.newMini('ttt', E.makeRng('d')) }));
  const report = (id, owners, winner, reason) => ({ id, side: 'X', opponent: { name: 'Computer', cpu: true },
    final: { squares: sq(owners), winner, winLine: null, winReason: reason, resigned: null, counts: null, moves: 20, games: ['ttt'], names: { X: 'LocalDee', O: 'Computer' } } });
  assert.deepEqual(await lp.call('recordLocal', report('locdraw1', [null, 'X', 'O', 'O', 'X', 'X', 'X', 'O', 'O'], 'draw', 'blocked')), { ok: true, result: 'draw' });
  assert.deepEqual(await lp.call('recordLocal', report('locmaj01', ['O', 'O', 'X', 'X', 'O', 'O', 'O', 'X', 'X'], 'O', 'majority')), { ok: true, result: 'loss' }, 'an old "most squares" result still counts');
  await assert.rejects(lp.call('recordLocal', report('locdraw2', [null, 'X', 'X', 'O', 'O', null, null, null, null], 'draw', 'blocked')), /Not a match/, 'a draw while a line is still open: refused');
  const ls = await get(`localStats/${lp.uid}`);
  assert.deepEqual([ls.wins || 0, ls.losses, ls.draws, ls.games], [0, 1, 1, 2]);
  assert.deepEqual(ls.sides, { X: { losses: 1, draws: 1, games: 2 } });
  assert.equal((await get(`localHistory/${lp.uid}/l_locdraw1`)).how, 'draw');
});

test('friend games: leaving a match under way ends it as a loss for the one who left, recorded for both', async () => {
  const host = await player('LeaveHost'), guest = await player('LeaveGuest');
  const code = 'LEAVE';
  await host.write(`rooms/${code}`, { created: Date.now(), host: host.uid, status: 'lobby', players: { X: { uid: host.uid, name: 'LeaveHost', joined: Date.now() } }, setup: { hostSide: 'X', timer: 0 } });
  await guest.write(`rooms/${code}/players/O`, { uid: guest.uid, name: 'LeaveGuest', joined: Date.now() });
  const rec = E.newOnlineMatch({ names: { X: 'LeaveHost', O: 'LeaveGuest' } }, E.makeRng(9), 'lv1');
  await host.write(`rooms/${code}/status`, 'playing');
  await host.write(`rooms/${code}/match`, { state: JSON.stringify(rec.state), secrets: JSON.stringify(rec.secrets) });
  // the guest leaves through the menu: the page resigns the match first (as index.html's leaveRoom does), then says it left
  const r = E.applyOnlineResign(rec, 'O');
  assert.equal(r.ok, true);
  await guest.write(`rooms/${code}/match`, { state: JSON.stringify(r.rec.state), secrets: JSON.stringify(r.rec.secrets) });
  await guest.write(`rooms/${code}/left`, { side: 'O', name: 'LeaveGuest', at: Date.now() });
  const id = 'f_' + code + '_lv1';
  const gh = await until(() => guest.read(`history/${guest.uid}/${id}`), 10000, 'the leaver\'s history');
  assert.equal(gh.result, 'loss'); assert.equal(gh.how, 'resign');
  assert.equal((await host.read(`history/${host.uid}/${id}`)).result, 'win');
  assert.deepEqual((await get(`users/${guest.uid}`)).friend, { losses: 1, games: 1, sides: { O: { losses: 1, games: 1 } } }, 'a loss on the leaver\'s record');
  assert.deepEqual((await get(`users/${host.uid}`)).friend, { wins: 1, games: 1, sides: { X: { wins: 1, games: 1 } } });
});

test('usernames already taken are checked against the word list once: the ones that fail are listed for the admin, none changed', async () => {
  const boss = await player('ReviewBoss'), other = await player('Bystander');
  await put('users/legacy1', { username: 'Sh1tHead', joined: 1 });
  await put('users/legacy2', { username: 'Grape_Fan', joined: 1 });
  await put('meta/nameCheck', null);
  const run = (file, ...args) => new Promise((resolve, reject) => execFile(process.execPath, [path.join(__dirname, '..', '..', 'scripts', file), ...args],
    { env: Object.assign({}, process.env, { TTC_PROJECT: PROJECT, GCLOUD_PROJECT: PROJECT }) }, (e, out) => (e ? reject(new Error(out || e.message)) : resolve(out))));
  const out = await run('check-usernames.js');
  assert.match(out, /Checked \d+ usernames: 1 would be refused today/);
  assert.ok(!/Sh1tHead/i.test(out), 'the log names nobody');
  const f = await get('review/flaggedNames');
  assert.deepEqual(Object.keys(f.names), ['legacy1']); assert.equal(f.names.legacy1.username, 'Sh1tHead'); assert.equal(f.names.legacy1.word, 'shit');
  assert.equal((await get('users/legacy1')).username, 'Sh1tHead', 'not changed');
  assert.match(await run('check-usernames.js'), /already/, 'once per version of the rules');
  await denied(other.read('review/flaggedNames'), 'a player reading the list');
  assert.match(await run('make-admin.js', 'ReviewBoss', 'grant'), /now the admin/);
  await boss.auth.currentUser.getIdToken(true);
  assert.ok((await boss.read('review/flaggedNames')).names.legacy1, 'the admin reads it');
  await run('make-admin.js', 'ReviewBoss', 'revoke');
  await put('users/legacy1', null); await put('users/legacy2', null);
});

test('back-fill: records and per-mini-game stats recounted from game history, once', async () => {
  const p = await player('Backfill');
  const sq = (type, owner) => ({ owner, mini: { type } });
  const final = sqs => JSON.stringify({ squares: sqs, winner: null });
  await put(`users/${p.uid}`, { username: 'Backfill', rating: 1300, wins: 2, losses: 0, draws: 0, games: 2, joined: 1 });   // ranked games only, as before
  await put(`history/${p.uid}`, {
    a: { mode: 'ranked', side: 'X', result: 'win', how: 'line', date: 1, final: final([sq('ttt', 'X'), sq('ttt', 'X'), sq('pig', 'O')]) },
    b: { mode: 'casual', side: 'O', result: 'loss', how: 'line', date: 2, final: final([sq('ttt', 'X'), sq('bs', 'O')]) },
    c: { mode: 'casual', side: 'O', result: 'draw', how: 'draw', date: 3, final: final([]) },
    d: { mode: 'friend', side: 'X', result: 'win', how: 'line', date: 4, final: final([sq('hex', 'X')]) },
    e: { mode: 'ranked', side: 'X', result: 'win', how: 'resign', date: 5, final: final([]) },
  });
  await put('meta/backfill', null);
  const run = (...args) => new Promise((resolve, reject) => execFile(process.execPath, [path.join(__dirname, '..', '..', 'scripts', 'backfill-records.js'), ...args],
    { env: Object.assign({}, process.env, { TTC_PROJECT: PROJECT, GCLOUD_PROJECT: PROJECT }) }, (e, out) => (e ? reject(new Error(out || e.message)) : resolve(out))));
  assert.match(await run(), /Back-filled the records of \d+ players?/);
  const u = await get(`users/${p.uid}`);
  assert.deepEqual([u.wins, u.losses, u.draws, u.games], [2, 1, 1, 4], 'the main record: every Find Match game, ranked and casual');
  assert.deepEqual(u.friend, { wins: 1, losses: 0, draws: 0, games: 1 }, 'the friends record apart');
  assert.deepEqual(u.minis, { ttt: { won: 2, lost: 1 }, pig: { won: 0, lost: 1 }, bs: { won: 1, lost: 0 }, hex: { won: 1, lost: 0 } }, 'squares from all online games');
  assert.equal(u.rating, 1300, 'the rating is left as it was');
  await patch(`users/${p.uid}`, { wins: 7 });
  assert.match(await run(), /already/, 'it runs once');
  assert.equal((await get(`users/${p.uid}`)).wins, 7);
});

/* ===================================== bots and the empty-queue alert ===================================== */
const B = require('../../functions/bots.js');
const runScript = (file, ...args) => new Promise((resolve, reject) => execFile(process.execPath, [path.join(__dirname, '..', '..', 'scripts', file), ...args],
  { env: Object.assign({}, process.env, { TTC_PROJECT: PROJECT, GCLOUD_PROJECT: PROJECT }) }, (e, out) => (e ? reject(new Error(out || e.message)) : resolve(out))));
const botsOn = (o = {}) => put('admin/config/bots', Object.assign({ enabled: true, waitMin: 40, waitMax: 70, countInRecords: true }, o));
const clearQueue = () => Promise.all([put('queue/match', null), put('queue/chaos', null)]);
// A game rewritten as its owner through the engine (hidden values kept apart, as the server keeps them).
async function rewrite(id, fn) {
  const g = await get(`games/${id}`);
  const full = E.fullState({ state: JSON.parse(g.pub.state), secrets: JSON.parse(g.sec) });
  fn(full);
  const rec = E.matchRecord(full);
  await patch(`games/${id}`, { pub: Object.assign(g.pub, { state: JSON.stringify(rec.state) }), sec: JSON.stringify(rec.secrets), dl: rec.state.timer.deadline });
}
const tttBoard = full => { for (const sq of full.squares) { sq.owner = null; sq.mini = E.newMini('ttt', E.makeRng('t')); } };
// A lone searcher's bot comes once their wait is over: here, by moving their wait into the past.
async function soloUntilBot(p) {
  assert.equal((await p.call('findMatch', {})).status, 'searching');
  await patch(`queue/match/${p.uid}`, { botAt: Date.now() - 1 });
  const r = await p.call('findMatch', {});
  assert.equal(r.status, 'matched', 'a bot once the wait is over');
  return r;
}

test('back-fill: games played as X and as O recounted from the history (Find Match, friends, local), once; bot matches as the admin chose', async () => {
  const p = await player('SideFill'), botUid = 'botSideFill';
  await put(`bots/${botUid}`, { key: 'test', username: 'BotSide', created: 1 });
  await put(`users/${botUid}`, { username: 'BotSide', joined: 1 });
  await put('admin/config/bots', { enabled: false, countInRecords: false });
  await patch(`users/${p.uid}`, { friend: { wins: 1, losses: 1, draws: 0, games: 2 } });
  const h = (mode, side, result, opp) => ({ mode, side, result, how: result === 'draw' ? 'draw' : 'line', date: 1, opponent: { uid: opp || null, name: 'Someone' }, final: '{"squares":[]}' });
  await put(`history/${p.uid}`, {
    a: Object.assign(h('ranked', 'X', 'win'), { date: Date.now() + 5000 }), b: h('casual', 'O', 'loss'), c: h('match', 'O', 'draw'),
    d: h('friend', 'X', 'win'), e: h('friend', 'O', 'loss'),
    f: h('match', 'X', 'win', botUid),                                  // against a bot: left out (the switch is off)
  });
  await put(`history/${botUid}`, { f: h('match', 'O', 'loss', p.uid) });
  await put(`localHistory/${p.uid}`, { l_1: h('local', 'X', 'win'), l_2: h('local', 'O', 'draw'), l_3: h('local', 'X', 'loss') });
  await put('meta/backfill/accounts1', null); await put(`lastSeen/${p.uid}`, null);
  assert.match(await runScript('backfill-accounts.js'), /Back-filled the games by side and last activity of \d+ players?/);
  const rec = (wins, losses, draws) => ({ wins, losses, draws, games: wins + losses + draws });
  const u = await get(`users/${p.uid}`);
  assert.deepEqual(u.sides, { X: rec(1, 0, 0), O: rec(0, 1, 1) }, 'Find Match: a win as X; a loss and a draw as O; not the bot match');
  assert.deepEqual(u.friend.sides, { X: rec(1, 0, 0), O: rec(0, 1, 0) }, 'friends apart');
  assert.deepEqual([u.friend.wins, u.friend.losses, u.friend.games], [1, 1, 2], 'the friends record itself untouched');
  assert.deepEqual((await get(`localStats/${p.uid}`)).sides, { X: rec(1, 1, 0), O: rec(0, 0, 1) }, 'local games: player 1\'s side');
  assert.deepEqual((await get(`users/${botUid}`)).sides, { X: rec(0, 0, 0), O: rec(0, 1, 0) }, 'the bot\'s own record counts every game');
  for (const s of ['X', 'O']) assert.equal(u.sides[s].games + u.friend.sides[s].games + (await get(`localStats/${p.uid}`)).sides[s].games, { X: 4, O: 4 }[s], `every counted game as ${s}`);
  const a = await get(`history/${p.uid}/a`);
  assert.equal(await get(`lastSeen/${p.uid}`), a.date, 'last active: the latest game in the history');
  assert.equal(await get(`lastSeen/${botUid}`), null, 'not for the bots');
  await patch(`users/${p.uid}/sides/X`, { wins: 9 });
  assert.match(await runScript('backfill-accounts.js'), /already/, 'it runs once');
  assert.equal((await get(`users/${p.uid}`)).sides.X.wins, 9);
  await put('admin/config', null); await put(`bots/${botUid}`, null); await put(`users/${botUid}`, null); await put(`history/${botUid}`, null);
  await put(`history/${p.uid}`, null); await put(`localHistory/${p.uid}`, null);
});

/* ===================================== playtest activity and accounts ===================================== */
test('playtest: a device\'s opens and matches are logged under a hash of its random id, each once; the tester tag is kept from its first link; nothing personal', async () => {
  const guest = await player(null, { anonymous: true }), acct = await player('Tester_Tam');
  const dev = 'd' + Date.now().toString(16) + 'aa11', h = S.devHash(dev);
  assert.notEqual(h, dev); assert.ok(!h.includes(dev));
  assert.deepEqual(await guest.call('devlog', { dev, ev: 'open', o: 'open0001', tag: 'sam' }), { ok: true });
  assert.deepEqual(await guest.call('devlog', { dev, ev: 'open', o: 'open0001', tag: 'sam' }), { ok: true, seen: true }, 'the same open, sent again: kept once');
  assert.deepEqual(await guest.call('devlog', { dev, ev: 'start', mode: 'cpu', g: 'lgame0001' }), { ok: true });
  assert.deepEqual(await guest.call('devlog', { dev, ev: 'start', mode: 'cpu', g: 'lgame0001' }), { ok: true, seen: true }, 'a reload: the same start once');
  assert.deepEqual(await acct.call('devlog', { dev, ev: 'finish', mode: 'cpu', g: 'lgame0001', tag: 'bob' }), { ok: true });
  assert.deepEqual(await guest.call('devlog', { dev, ev: 'leave', mode: 'cpu', g: 'lgame0001' }), { ok: true, seen: true }, 'one end per match');
  assert.deepEqual(await guest.call('devlog', { dev, ev: 'live', mode: 'match', g: 'mgame0001', o: 'live0001' }), { ok: true }, 'still playing a long match');
  assert.deepEqual(await guest.call('devlog', { dev, ev: 'live', mode: 'match', g: 'mgame0001', o: 'live0001' }), { ok: true, seen: true });
  const d = await get(`devices/${h}`), log = await get(`devlog/${h}`);
  assert.equal(d.tag, 'sam', 'the first tag stays');
  assert.equal(d.n, 4); assert.ok(d.first <= d.last);
  assert.deepEqual(Object.keys(d).sort(), ['first', 'last', 'n', 'tag'], 'only times, a count and the tag');
  assert.deepEqual(Object.keys(log).sort(), ['elgame0001', 'oopen0001', 'plive0001', 'slgame0001'], 'an open, a start, an end and a live');
  for (const e of Object.values(log)) assert.ok(Object.keys(e).every(k => ['t', 'ev', 'm', 'g'].includes(k)), 'an event: its time, kind, mode and match only');
  assert.deepEqual([log.slgame0001.ev, log.slgame0001.m, log.slgame0001.g, log.elgame0001.ev], ['start', 'cpu', 'lgame0001', 'finish']);
  assert.ok(!JSON.stringify([d, log]).includes(acct.uid) && !JSON.stringify([d, log]).includes(dev), 'no account and no raw id with the device');
  assert.ok(Math.abs((await get(`lastSeen/${acct.uid}`)) - Date.now()) < 60000, 'the logged-in player\'s last activity moved on');
  assert.equal(await get(`lastSeen/${guest.uid}`), null, 'not for a guest');
  // a tag that is not one is ignored; a later good one is kept, once
  const dev2 = 'd' + Date.now().toString(16) + 'bb22', h2 = S.devHash(dev2);
  await guest.call('devlog', { dev: dev2, ev: 'open', o: 'open0002', tag: 'Sam Smith <x>' });
  assert.equal((await get(`devices/${h2}`)).tag, undefined);
  await guest.call('devlog', { dev: dev2, ev: 'open', o: 'open0003', tag: 'tester-2' });
  await guest.call('devlog', { dev: dev2, ev: 'open', o: 'open0004', tag: 'tester-3' });
  assert.equal((await get(`devices/${h2}`)).tag, 'tester-2');
  // refused: no device, an unknown event, a match without its mode or key
  for (const bad of [{ ev: 'open', o: 'open0005' }, { dev, ev: 'login', o: 'open0006' }, { dev, ev: 'start', g: 'lgame0002' }, { dev, ev: 'start', mode: 'cpu' }, { dev, ev: 'start', mode: 'chess', g: 'lgame0003' }, { dev: 'x', ev: 'open', o: 'open0007' }, { dev, ev: 'live', mode: 'match', g: 'mgame0002' }]) {
    await assert.rejects(guest.call('devlog', bad), /Not an event/, JSON.stringify(bad));
  }
  // only the admin reads them; nobody writes them
  await denied(acct.read(`devices/${h}`), 'a player reading the devices');
  await denied(acct.read(`devlog/${h}`), 'a player reading the activity');
  await denied(acct.read(`lastSeen/${acct.uid}`), 'reading even your own last activity');
  await denied(guest.write(`devices/${h}/tag`, 'eve'), 'writing a tag');
  await denied(guest.write(`devlog/${h}/x`, { t: 1, ev: 'open' }), 'writing an event');
  assert.match(await runScript('make-admin.js', 'Tester_Tam', 'grant'), /now the admin/);
  await acct.auth.currentUser.getIdToken(true);
  assert.equal((await acct.read(`devices/${h}`)).tag, 'sam');
  assert.ok(await acct.read('devlog'));
  assert.ok(await acct.read('lastSeen'));
  assert.ok((await acct.read('localStats')) !== undefined, 'and every player\'s local record, for the Accounts table');
  await runScript('make-admin.js', 'Tester_Tam', 'revoke');
});

test('accounts: last activity moves on with a login or a local match (online matches: in the resign and bot tests)', async () => {
  const p = await player('Seen_Sal');
  assert.equal(await get(`lastSeen/${p.uid}`), null);
  await p.call('track', { ev: 'login', dev: 'dseen0001' });
  const t1 = await get(`lastSeen/${p.uid}`);
  assert.ok(Math.abs(t1 - Date.now()) < 60000, 'a login');
  await wait(20);
  await p.call('track', { ev: 'start', mode: 'cpu', id: 'seen' + Date.now(), dev: 'dseen0001' });
  assert.ok((await get(`lastSeen/${p.uid}`)) > t1, 'a local match');
});

test('bots: off by default; on, a lone searcher gets one only after their own randomized 40-70 s wait, and two people play each other', async () => {
  await clearQueue(); await put('admin/config', null);
  const a = await player('Lonely_A');
  assert.equal((await a.call('findMatch', {})).status, 'searching');
  await patch(`queue/match/${a.uid}`, { botAt: Date.now() - 1 });
  assert.equal((await a.call('findMatch', {})).status, 'searching', 'bots off (the default): the player keeps waiting');
  assert.equal(await get('bots'), null, 'no bot accounts made while bots are off');
  assert.equal((await a.call('cancelSearch', {})).status, 'cancelled');
  await botsOn();
  const waits = [];
  for (let k = 0; k < 4; k++) {
    assert.equal((await a.call('findMatch', {})).status, 'searching', 'not before the wait');
    const q = await get(`queue/match/${a.uid}`);
    waits.push(q.botAt - q.since);
    await a.call('cancelSearch', {});
  }
  assert.ok(waits.every(w => w >= 40000 && w <= 70000), `each wait drawn from 40 to 70 s (${waits})`);
  assert.ok(new Set(waits).size > 1, 'a new wait each time');
  // someone else searching: the two people are paired, whatever the waits
  assert.equal((await a.call('findMatch', {})).status, 'searching');
  await patch(`queue/match/${a.uid}`, { botAt: Date.now() - 1 });
  const b = await player('Lonely_B');
  const g = await pairUp(b, a);
  assert.equal(await get(`botGames/${g.id}`), null, 'two people: no bot');
  await a.call('resign', { game: g.id }); await recorded(g.id);
  await put('admin/config', null);
});

test('bots: the match is an ordinary one against an ordinary-looking, online account; it thinks before each move and never runs out of time', async () => {
  await clearQueue(); await botsOn();
  const h = await player('VsBot_One'), other = await player('Onlooker');
  const r = await soloUntilBot(h);
  const id = r.game, botSide = r.side === 'X' ? 'O' : 'X';
  const pub = await h.read(`games/${id}/pub`), bot = pub.players[botSide];
  const bg = await get(`botGames/${id}`);
  assert.deepEqual([bg.bot, bg.human, bg.side, bg.live], [bot.uid, h.uid, botSide, true]);
  const bots = await get('bots');
  assert.equal(Object.keys(bots).length, 5, 'five bot accounts, made when first needed');
  assert.deepEqual(Object.values(bots).map(b => b.key).sort(), ['b1', 'b2', 'b3', 'b4', 'b5']);
  const bu = await get(`users/${bot.uid}`);
  assert.equal(require('../../functions/serverRules.js').usernameProblem(bu.username), null, 'a username within the rules, made up like anyone\'s');
  assert.equal(new Set(Object.values(bots).map(b => b.username.toLowerCase())).size, 5, 'five different usernames');
  assert.equal(bot.name, bu.username);
  assert.match(bot.uid, /^[A-Za-z0-9]{28}$/, 'an id shaped like any account\'s');
  assert.equal(await get(`usernames/${bu.username.toLowerCase()}`), bot.uid, 'its username is taken like anyone\'s');
  assert.ok(bu.joined < Date.now() - 3600000 && bu.rating === 1200, 'a profile like any other');
  assert.deepEqual(Object.keys(pub).sort(), ['created', 'mode', 'players', 'queue', 'state', 'status', 'timer', 'updated'], 'nothing in the game says bot');
  assert.deepEqual(Object.keys(bot).sort(), ['name', 'record', 'uid']);
  assert.equal(pub.mode, 'match');
  await denied(h.read(`botGames/${id}`), 'the bot record'); await denied(h.read('bots'), 'the bot list'); await denied(h.read('botStats'), 'the bot numbers');
  await denied(other.read(`active/${bot.uid}`), 'the bot\'s active game');
  const pres = await h.read(`gpresence/${id}`);
  assert.deepEqual([pres[botSide].online, pres[botSide].away], [true, false], 'the bot shows as online, never away');
  // its turn: a tick from the player makes the plan (from when the turn starts on the phone), not the move
  await rewrite(id, full => { tttBoard(full); full.turn = botSide; full.lock = null; full.timer.deadline = Date.now() + 60000; full.timer.for = botSide; });
  await patch(`botGames/${id}`, { next: null });               // (a bot playing X planned its first move on the board as it was dealt: not this one)
  const seq0 = (await gameState(id)).seq;
  const tTick = Date.now();
  await h.call('tick', { game: id });
  const plan = (await get(`botGames/${id}`)).next, start = Math.max((await gameState(id)).timer.deadline - 60000, tTick);
  assert.ok(plan && plan.seq === seq0 && plan.due - start >= 1000 && plan.due - start <= B.MAX_THINK_MS + 2500, `it thinks a while first (the planning reads take a moment on the emulator) (${plan && plan.due - start} ms)`);
  assert.equal((await gameState(id)).seq, seq0, 'no move yet');
  assert.deepEqual(await other.call('tick', { game: id }), { ok: true }, 'someone else\'s tick: the same answer, nothing done');
  await h.call('tick', { game: id });
  assert.equal((await get(`botGames/${id}`)).next.due, plan.due, 'the same plan: one think per turn');
  await patch(`botGames/${id}/next`, { due: Date.now() - 10 });
  await h.call('tick', { game: id });
  const s1 = await gameState(id);
  assert.equal(s1.seq, seq0 + 1, 'then it moves');
  assert.equal(s1.turn, r.side, 'and the turn passes');
  // the player away: the sweep plans the bot's move and makes it once due, before the clock runs out
  await rewrite(id, full => { full.turn = botSide; full.lock = null; full.timer.deadline = Date.now() + 60000; full.timer.for = botSide; });
  await patch(`botGames/${id}`, { next: null });
  const before = await gameState(id);
  await sweep();
  assert.equal((await gameState(id)).seq, before.seq, 'the sweep plans the bot\'s move: it does not move before it is due');
  await patch(`botGames/${id}/next`, { due: Date.now() - 10 });
  const sw = await sweep(), after = await gameState(id);
  assert.ok(sw.botMoves >= 1 && after.seq === before.seq + 1, 'the bot moved once due');
  assert.equal(after.timer.timeouts[botSide], 0, 'no timeout counted against it');
  // the player's phone calls time on the bot: it moves instead
  await rewrite(id, full => { full.turn = botSide; full.lock = null; full.timer.deadline = Date.now() - 1000; full.timer.for = botSide; });
  const b2 = await gameState(id);
  assert.equal((await h.call('timeout', { game: id })).ok, true);
  const a2 = await gameState(id);
  assert.equal(a2.seq, b2.seq + 1); assert.equal(a2.timer.timeouts[botSide], 0);
  // Memory: the first card, then a moment later the second
  await rewrite(id, full => {
    const owners = [null, 'X', 'O', 'O', 'X', 'X', 'X', 'O', 'O'];
    full.squares.forEach((sq, i) => { sq.owner = owners[i]; if (i) sq.mini = E.newMini('ttt', E.makeRng('m' + i)); });
    full.squares[0].mini = E.newMini('memory', E.makeRng('mem'));
    full.turn = botSide; full.lock = null; full.pick = null; full.pickSq = null; full.timer.deadline = Date.now() + 60000; full.timer.for = botSide;
  });
  await patch(`botGames/${id}`, { next: null });
  const m0 = await gameState(id);
  await h.call('tick', { game: id });
  await patch(`botGames/${id}/next`, { due: Date.now() - 10 });
  await h.call('tick', { game: id });
  const m1 = await gameState(id), n1 = (await get(`botGames/${id}`)).next;
  assert.equal(m1.seq, m0.seq, 'the first card is not a move yet');
  assert.ok(m1.pickSq === 0 && Number.isInteger(m1.pick), 'the first card is turned up for the player to see');
  assert.equal(n1.step, 'second'); assert.ok(n1.due - Date.now() <= 2700, 'the second card a moment later');
  await patch(`botGames/${id}/next`, { due: Date.now() - 10 });
  await h.call('tick', { game: id });
  const m2 = await gameState(id);
  assert.equal(m2.seq, m0.seq + 1, 'then the pair is played');
  assert.equal(m2.squares[0].mini.flips + 0 >= 0, true);
  await h.call('resign', { game: id }); await recorded(id);
  await put('admin/config', null);
});

test('bots: after a player\'s move, the bot\'s move is planned inside its own window in every mini-game (3 to 8 s for the word games and Mastermind)', async () => {
  await clearQueue(); await botsOn();
  const h = await player('Window_Who');
  const r = await soloUntilBot(h);
  const id = r.game, botSide = r.side === 'X' ? 'O' : 'X';
  const bg0 = await get(`botGames/${id}`), bot = B.byKey(bg0.key) || B.BOTS[0];
  const WORD = ['wordle', 'hangman', 'mastermind'];
  const [pa, pb] = B.PACES[bot.pace].turn;
  const planned = {};
  for (const type of E.TYPES) {
    await rewrite(id, full => {
      full.squares.forEach((sq, i) => { sq.owner = null; sq.mini = E.newMini(type, E.makeRng(type + i)); });
      full.turn = botSide; full.lock = null; full.winner = null; full.timer.deadline = Date.now() + 60000; full.timer.for = botSide;
      full.seq = (full.seq || 0) + 100;                        // a move number of its own: a bot task queued for an earlier board finds it stale
    });
    await patch(`botGames/${id}`, { next: null, live: true });
    const t0 = Date.now();
    await h.call('tick', { game: id });
    const next = (await get(`botGames/${id}`)).next;
    await patch(`botGames/${id}`, { live: false });           // the planned task (queued for later) finds the game off, and does nothing
    if (!next) { planned[type] = null; continue; }
    const [lo, hi] = WORD.includes(type) ? [3, 8] : [pa, pb];
    const d = (next.due - t0) / 1000;
    assert.ok(d >= lo - 0.1 && d <= hi + 5, `${type}: the bot's move is due ${d.toFixed(2)} s after its turn starts (window ${lo}-${hi} s)`);   // (the slack: the plan is made from the server's own now, a few seconds on under a loaded CI runner)
    planned[type] = Math.round(d * 10) / 10;
  }
  const made = Object.values(planned).filter(x => x != null).length;
  assert.ok(made >= E.TYPES.length - 2, `a plan for nearly every mini-game (${made} of ${E.TYPES.length})`);
  await patch(`botGames/${id}`, { live: true });
});

test('bots: the result is recorded for both; the player\'s record as the admin chose; bot matches counted apart in the stats', async () => {
  await clearQueue(); await botsOn();
  const statsBefore = (await get('stats/modes')) || {}, botStats0 = (await get('botStats')) || {};
  const h = await player('VsBot_Two');
  const finishWin = async () => {
    const r = await soloUntilBot(h), id = r.game, me = r.side;
    await rewrite(id, full => {
      tttBoard(full);
      full.squares[0].owner = me; full.squares[1].owner = me;
      full.squares[2].mini.cells = [me, me, null, null, null, null, null, null, null];
      full.turn = me; full.lock = null; full.timer.deadline = Date.now() + 60000; full.timer.for = me;
    });
    assert.equal((await h.call('move', { game: id, square: 2, move: 2 })).ok, true);
    await recorded(id);
    return { id, me, botSide: me === 'X' ? 'O' : 'X' };
  };
  const u0 = await get(`users/${h.uid}`);
  const g1 = await finishWin();
  const pub1 = await get(`games/${g1.id}/pub`), botUid = pub1.players[g1.botSide].uid;
  const u1 = await get(`users/${h.uid}`), b1 = await get(`users/${botUid}`);
  assert.deepEqual([u1.wins - (u0.wins || 0), u1.games - (u0.games || 0)], [1, 1], 'counted in the player\'s record (the default)');
  assert.equal(pub1.result.records[g1.me].wins, u1.wins, 'the results screen shows the new record');
  assert.ok(b1.losses >= 1, 'the bot\'s own record counts every game, like anyone\'s');
  const hist = await get(`history/${h.uid}/${g1.id}`);
  assert.deepEqual([hist.mode, hist.result, hist.opponent.uid, hist.opponent.name], ['match', 'win', botUid, b1.username], 'an ordinary Find Match game in the history');
  assert.ok(await get(`history/${botUid}/${g1.id}`), 'and in the bot\'s');
  const bg = await get(`botGames/${g1.id}`);
  assert.deepEqual([bg.live, bg.done, bg.winner], [undefined, true, g1.me]);
  assert.equal(await get(`active/${botUid}`), null, 'the bot is free again');
  assert.equal(await get(`lastSeen/${botUid}`), null, 'a bot has no last activity (it is not in the Accounts table)');
  // the switch: left out of the player's record
  await botsOn({ countInRecords: false });
  const g2 = await finishWin();
  const u2 = await get(`users/${h.uid}`), pub2 = await get(`games/${g2.id}/pub`);
  assert.deepEqual([u2.wins, u2.games, u2.minis], [u1.wins, u1.games, u1.minis], 'not counted: the record and mini-game stats as they were');
  assert.deepEqual(u2.sides, u1.sides, 'nor the games by side');
  assert.equal(u1.sides[g1.me].wins, 1, 'the counted one is on the side played');
  assert.deepEqual(pub2.result.records[g2.me], { wins: u1.wins, losses: u1.losses || 0, draws: u1.draws || 0 }, 'the results screen shows the record unchanged');
  assert.ok(await get(`history/${h.uid}/${g2.id}`), 'still in the history');
  // the stats: a mode of their own; the bot matches counted for the dashboard
  const m = (await get('stats/modes')) || {};
  assert.equal(((m.bot || {}).finished || 0) - ((statsBefore.bot || {}).finished || 0), 2, 'counted as bot matches');
  assert.equal(((m.match || {}).finished || 0), ((statsBefore.match || {}).finished || 0), 'not as Find Match between people');
  const bs = await get('botStats');
  assert.deepEqual([bs.started - (botStats0.started || 0), bs.finished - (botStats0.finished || 0), bs.playerWins - (botStats0.playerWins || 0)], [2, 2, 2]);
  await put('admin/config', null);
});

test('alerts: someone searching alone alerts the admin by text and email, once, within the limits; never for the admin\'s own search', async () => {
  await clearQueue(); await put('admin/config', null); await put('test/alertsSent', null); await put('alertState', null); await put('alertLog', null); await put('alertStats', null);
  await put('admin/secrets', { twilioSid: 'ACtest', twilioToken: 'tok', twilioFrom: '+15550001111', resendKey: 're_test' });
  const alerts = { enabled: true, sms: true, email: true, phone: '914-555-0100', to: 'alerts@example.com', after: 0, cooldownMin: 30, gapMin: 0, dailyCap: 4 };
  await put('admin/config/alerts', alerts);
  const sent = async () => Object.values((await get('test/alertsSent')) || {});
  const count = async (want, what) => {                      // the outbox, given a moment to settle
    let got = 0;
    for (let k = 0; k < 15; k++) { got = (await sent()).length; if (got === want && k >= 2) break; await wait(150); }
    assert.equal(got, want, what);
  };
  const p1 = await player('Waiting_1');
  assert.equal((await p1.call('findMatch', {})).status, 'searching');
  await count(2, 'a text and an email');
  const s = await sent();
  const sms = s.find(m => m.ch === 'sms'), mail = s.find(m => m.ch === 'email');
  assert.equal(sms.to, '+19145550100', 'the number as Twilio wants it');
  assert.equal(mail.to, 'alerts@example.com');
  assert.match(sms.text, /Waiting_1 \(0-0-0\) is searching .* https:\/\/jaredmk\.github\.io\/Tiger-tac-toe\/\?play=find$/);
  assert.match(mail.subject, /Waiting_1 is waiting for a match/);
  const log = Object.values(await get('alertLog'));
  assert.deepEqual(log[0].channels, { sms: 'sent', email: 'sent' });
  await p1.call('findMatch', {}); await p1.call('findMatch', {});
  await count(2, 'once per search');
  await p1.call('cancelSearch', {});
  await p1.call('findMatch', {});
  await count(2, 're-queueing within the player\'s cooldown: no new alert');
  assert.equal(await get('alertStats/held'), 1);
  await p1.call('cancelSearch', {});
  // someone else, alone: alerted (no gap set)
  const p2 = await player('Waiting_2');
  await p2.call('findMatch', {});
  await count(4, '');
  await p2.call('cancelSearch', {});
  // a gap between alerts
  await patch('admin/config/alerts', { gapMin: 5 });
  const p3 = await player('Waiting_3');
  await p3.call('findMatch', {});
  await count(4, 'too soon after the last alert');
  await p3.call('cancelSearch', {});
  // the daily cap (4 alerts today: two players' text and email count as one alert each)
  await patch('admin/config/alerts', { gapMin: 0, dailyCap: 2 });
  const p4 = await player('Waiting_4');
  await p4.call('findMatch', {});
  await count(4, 'the daily cap');
  await p4.call('cancelSearch', {});
  // "alone": not before the set number of seconds; two searching are paired and nobody is alerted
  await put('alertState', null);
  await patch('admin/config/alerts', { dailyCap: 20, after: 30 });
  const p5 = await player('Waiting_5'), p6 = await player('Waiting_6');
  await p5.call('findMatch', {});
  await count(4, 'not in the first seconds');
  const g = await pairUp(p6, p5);
  await count(4, 'paired: no alert');
  await p5.call('resign', { game: g.id }); await recorded(g.id);
  const p7 = await player('Waiting_7');
  await p7.call('findMatch', {});
  await patch(`queue/match/${p7.uid}`, { since: Date.now() - 31000 });
  await p7.call('findMatch', {});
  await count(6, 'alone for the set time: alerted');
  await p7.call('cancelSearch', {});
  // the admin's own search: never
  await patch('admin/config/alerts', { after: 0 });
  const boss = await player('AlertBoss');
  assert.match(await runScript('make-admin.js', 'AlertBoss', 'grant'), /now the admin/);
  await boss.auth.currentUser.getIdToken(true);
  await boss.call('findMatch', {});
  await count(6, 'the admin searching: no alert');
  await boss.call('cancelSearch', {});
  // off: nothing
  await patch('admin/config/alerts', { enabled: false });
  const p8 = await player('Waiting_8');
  await p8.call('findMatch', {});
  await count(6, 'alerts off');
  await p8.call('cancelSearch', {});
  // the order with bots on: the alert first, the bot only after the player's wait
  await put('alertState', null);
  await patch('admin/config/alerts', { enabled: true });
  await botsOn();
  const p9 = await player('Waiting_9');
  assert.equal((await p9.call('findMatch', {})).status, 'searching');
  await count(8, 'the alert at once');
  const q9 = await get(`queue/match/${p9.uid}`);
  assert.ok(q9.alerted && q9.botAt - q9.alerted >= 40000, 'the bot is at least 40 s behind it: time to join');
  await patch(`queue/match/${p9.uid}`, { botAt: Date.now() - 1 });
  const r9 = await p9.call('findMatch', {});
  assert.equal(r9.status, 'matched', 'then the bot');
  await count(8, 'no second alert');
  await p9.call('resign', { game: r9.game }); await recorded(r9.game);
  await put('admin/config/bots', null);
  // the dashboard's test: the admin only; says what went wrong
  await assert.rejects(p8.call('testAlert', {}), e => /permission/i.test(String(e.code || e.message)), 'not for a player');
  assert.deepEqual(await boss.call('testAlert', {}), { sms: 'sent', email: 'sent' });
  await put('admin/secrets/twilioToken', null);
  assert.deepEqual(await boss.call('testAlert', {}), { sms: 'error: Twilio keys not set', email: 'sent' });
  // the keys: the admin writes them, nobody reads them; the settings are the admin's
  await boss.write('admin/secrets/twilioToken', 'tok2');
  await denied(boss.read('admin/secrets'), 'the admin reading the keys back');
  await denied(p8.write('admin/secrets/resendKey', 'x'), 'a player writing a key');
  await denied(p8.read('admin/config'), 'a player reading the settings');
  await denied(p8.write('admin/config/bots/enabled', true), 'a player switching bots on');
  await denied(p8.read('alertLog'), 'a player reading the alert log');
  assert.ok(await boss.read('admin/config'), 'the admin reads the settings');
  await boss.write('admin/config/bots/enabled', false);
  await runScript('make-admin.js', 'AlertBoss', 'revoke');
  await put('admin/config', null); await put('admin/secrets', null); await put('test/alertsSent', null);
});

/* ===================================== Find Match on and off ===================================== */
test('Find Match off (missing means off): searches refused and taken out of the queue, a match under way carries on; only the admin switches it', async () => {
  await clearQueue();
  const a = await player('OffAlice'), b = await player('OffBob'), c = await player('OffCarl');
  const g = await pairUp(a, b);
  assert.equal((await c.call('findMatch', {})).status, 'searching');
  assert.ok(await get(`queue/match/${c.uid}`));
  await put('features/findMatch', null);                          // never switched on: off
  const off = e => e.code === 'functions/failed-precondition' && e.details && e.details.off === true && /not available at this time/i.test(e.message);
  await assert.rejects(c.call('findMatch', {}), off, 'the search is refused');
  assert.equal(await get(`queue/match/${c.uid}`), null, 'and the searcher is out of the queue');
  await put('features/findMatch', false);
  await assert.rejects(c.call('findMatch', {}), off, 'off as well');
  assert.deepEqual(await a.call('findMatch', {}), { status: 'matched', game: g.id, side: g.X === a ? 'X' : 'O' }, 'a match under way: still there to go back to');
  assert.equal(await get(`games/${g.id}/pub/status`), 'playing');
  // The switch: anyone (even with no login) reads it; only the admin changes it, and only to true or false.
  const pub = await fetch(`http://${DB_HOST}/features/findMatch.json?ns=${NS}`);
  assert.equal(pub.status, 200); assert.equal(await pub.json(), false);
  assert.equal(await c.read('features/findMatch'), false);
  await denied(c.write('features/findMatch', true), 'a player switching Find Match on');
  const boss = await player('SwitchBoss');
  await runScript('make-admin.js', 'SwitchBoss', 'grant');
  await boss.auth.currentUser.getIdToken(true);
  await denied(boss.write('features/findMatch', 'yes'), 'a value that is not true or false');
  await denied(boss.write('features/somethingElse', true), 'a switch that does not exist');
  await boss.write('features/findMatch', true);
  assert.equal((await c.call('findMatch', {})).status, 'searching', 'switched on: searching again');
  await c.call('cancelSearch', {});
  await runScript('make-admin.js', 'SwitchBoss', 'revoke');
  await put('features/findMatch', true);
});

/* ===================================== game releases ===================================== */
test('release control: an admin-only game exists for nobody but the admin: not in Find Match, not in a room\'s setup, not in a match; only the admin switches it; its stats kept apart', async () => {
  const boss = await player('Rel_Boss'), a = await player('Rel_A'), b = await player('Rel_B'), guest = await player('Rel_G');
  const only = (...ts) => Object.fromEntries(E.TYPES.map(t => [t, ts.includes(t)]));
  await put('releases', null);
  await denied(a.write('releases/ttt', false), 'a player switching a game to admin only');
  await denied(a.write('releases/ttt', true), 'a player releasing a game');
  await runScript('make-admin.js', 'Rel_Boss', 'grant');
  await boss.auth.currentUser.getIdToken(true);
  await boss.write('releases/ttt', false);                       // Tic-tac-toe is admin only now
  await denied(boss.write('releases/c4', 'yes'), 'a release that is not a boolean');
  await denied(boss.write('releases/Bad Type', true), 'a release of a name that is not a game\'s');
  assert.equal(await a.read('releases/ttt'), false, 'everyone can read the releases (the game reads them at every start)');
  assert.equal(await guest.read('releases/ttt'), false);
  // Find Match: released games only, even with the admin playing
  const g = await pairUp(boss, a);
  const st = await gameState(g.id);
  assert.ok(!st.games.includes('ttt') && st.squares.every(sq => sq.mini.type !== 'ttt'), 'no Tic-tac-toe in a Find Match game');
  assert.equal(st.games.length, E.releasedTypes({ ttt: false }).length, 'every other released game is dealt');
  assert.equal((await a.call('resign', { game: g.id })).ok, true);
  await recorded(g.id);
  // a room: a non-admin host cannot deal it (the rules refuse the setup); off is fine; the admin's room may
  const code = 'RELNA';
  await a.write(`rooms/${code}`, { created: Date.now(), host: a.uid, status: 'lobby', players: { X: { uid: a.uid, name: 'Rel_A', joined: Date.now() } }, setup: { games: only('c4', 'hilo'), timer: 0, hostSide: 'X' } });
  await denied(a.write(`rooms/${code}/setup/games/ttt`, true), 'a non-admin host putting an admin-only game in the room');
  await denied(a.write(`rooms/${code}/setup/games`, only('ttt', 'c4')), 'nor in the whole list');
  await a.write(`rooms/${code}/setup/games/ttt`, false);
  await a.write(`rooms/${code}/setup/games/hex`, true);
  // the match itself, tampered to hold it: the server takes it out of the room, which goes back to its lobby
  await guest.write(`rooms/${code}/players/O`, { uid: guest.uid, name: 'Rel_G', joined: Date.now() });
  const tampered = E.newOnlineMatch({ names: { X: 'Rel_A', O: 'Rel_G' }, games: only('ttt', 'c4') }, E.makeRng(21), 'rel1');
  assert.ok(tampered.state.squares.some(sq => sq.mini.type === 'ttt'), '(the tampered match holds Tic-tac-toe squares)');
  await a.write(`rooms/${code}/status`, 'playing');
  await a.write(`rooms/${code}/match`, { state: JSON.stringify(tampered.state), secrets: JSON.stringify(tampered.secrets) });
  const refused = await until(async () => { const r = await get(`rooms/${code}`); return r && !r.match && r.status === 'lobby' && r.refused ? r : null; }, 10000, 'the tampered match taken out of the room');
  assert.deepEqual(refused.refused.games, ['ttt']);
  assert.equal(await get(`history/${a.uid}/f_${code}_rel1`), null, 'nothing of it recorded');
  // the admin's room: the game may be dealt, the guest plays it in that match, and its squares are counted apart
  const ac = 'RELAD';
  await boss.write(`rooms/${ac}`, { created: Date.now(), host: boss.uid, status: 'lobby', players: { X: { uid: boss.uid, name: 'Rel_Boss', joined: Date.now() } }, setup: { games: only('ttt', 'c4'), timer: 0, hostSide: 'X' } });
  await b.write(`rooms/${ac}/players/O`, { uid: b.uid, name: 'Rel_B', joined: Date.now() });
  const rec = E.newOnlineMatch({ names: { X: 'Rel_Boss', O: 'Rel_B' }, games: only('ttt', 'c4') }, E.makeRng(22), 'rel2');
  await boss.write(`rooms/${ac}/status`, 'playing');
  await boss.write(`rooms/${ac}/match`, { state: JSON.stringify(rec.state), secrets: JSON.stringify(rec.secrets) });
  await wait(1500);
  const kept = await get(`rooms/${ac}`);
  assert.ok(kept.match && kept.status === 'playing' && !kept.refused, 'the admin\'s match stays');
  const full = E.fullState(rec);
  full.squares.forEach((sq, i) => { sq.mini = E.newMini(i < 3 ? 'ttt' : 'c4', E.makeRng('r' + i)); sq.mv = { X: 2, O: 1 }; });
  full.squares[0].owner = 'X'; full.squares[1].owner = 'X'; full.squares[2].owner = 'X'; full.squares[4].owner = 'O';
  full.winner = 'X'; full.winLine = [0, 1, 2]; full.winReason = 'line';
  full.sqlog = [{ t: 'ttt', end: 'won', w: 'X', X: 2, O: 1 }, { t: 'ttt', end: 'won', w: 'X', X: 2, O: 1 }, { t: 'ttt', end: 'won', w: 'X', X: 2, O: 1 }, { t: 'c4', end: 'won', w: 'O', X: 1, O: 2 }];
  const end = E.matchRecord(full);
  const d = await delta(['mini/testing/ttt/won', 'mini/friend/ttt/won', 'mini/friend/c4/won', 'mini/testing/c4/won'], async () => {
    await b.write(`rooms/${ac}/match`, { state: JSON.stringify(end.state), secrets: JSON.stringify(end.secrets) });
    await until(() => b.read(`history/${b.uid}/f_${ac}_rel2`), 10000, 'the admin\'s friend match recorded');
  });
  assert.deepEqual(d, { 'mini/testing/ttt/won': 3, 'mini/friend/ttt/won': 0, 'mini/friend/c4/won': 1, 'mini/testing/c4/won': 0 }, 'the admin-only game\'s squares under testing, the released one\'s under the mode');
  assert.deepEqual((await get(`users/${b.uid}`)).minis.ttt, { lost: 3 }, 'the players\' own records count them like any square');
  // a local match reported by a phone: the same split
  const dl = await delta(['mini/testing/ttt/won', 'mini/cpu/ttt/won', 'mini/cpu/hilo/won'], async () => {
    await guest.call('track', { ev: 'end', mode: 'cpu', id: 'relloc' + Date.now(), dev: 'drel1', winner: 'X', reason: 'line', squares: [{ t: 'ttt', end: 'won', w: 'X', X: 3, O: 2 }, { t: 'hilo', end: 'won', w: 'O', X: 1, O: 2 }] });
  });
  assert.deepEqual(dl, { 'mini/testing/ttt/won': 1, 'mini/cpu/ttt/won': 0, 'mini/cpu/hilo/won': 1 });
  // released again: back in Find Match at once (new matches only)
  await boss.write('releases/ttt', true);
  const g2 = await pairUp(a, b);
  assert.ok((await gameState(g2.id)).games.includes('ttt'), 'released: dealt again');
  assert.equal((await a.call('resign', { game: g2.id })).ok, true);
  await recorded(g2.id);
  await runScript('make-admin.js', 'Rel_Boss', 'revoke');
  await put('releases', null);
});

test('runners (Dash, Lane Rush): the difficulty config is public, the admin alone sets it, within bounds; a run the course or the clock would not allow is refused; runs and crashes reach the stats', async () => {
  const boss = await player('RunBoss'), a = await player('Runner_A'), b = await player('Runner_B');
  const script = (...args) => new Promise((resolve, reject) => execFile(process.execPath, [path.join(__dirname, '..', '..', 'scripts', 'make-admin.js'), ...args],
    { env: Object.assign({}, process.env, { TTC_PROJECT: PROJECT, GCLOUD_PROJECT: PROJECT }) }, (e, out) => (e ? reject(new Error(out || e.message)) : resolve(out))));
  assert.match(await script('RunBoss', 'grant'), /RunBoss is now the admin/);
  await boss.auth.currentUser.getIdToken(true);
  // the config: readable by everyone (the game reads it at every start), written by the admin alone, checked
  const cfg = { target: 600, v0: 10, ramp: 2, gapMin: 30, gapMax: 50, mix: { rock: 40, crate: 20, spike: 20, flyer: 10, pair: 10 } };
  await denied(a.write('config/run/dash', cfg), 'a player setting the difficulty');
  await boss.write('config/run/dash', cfg);
  assert.deepEqual(await a.read('config/run/dash'), cfg, 'everyone can read it');
  assert.equal((await fetch(`http://${DB_HOST}/config/run/dash/target.json?ns=${NS}`)).status, 200, 'without a login too');
  await denied(boss.write('config/run/dash/target', 9999), 'a target off its range');
  await denied(boss.write('config/run/dash/v0', 'fast'), 'a speed that is not a number');
  await denied(boss.write('config/run/dash/mix/Rock Monster', 5), 'a kind with a name that is not one');
  await denied(boss.write('config/run/dash/other', 1), 'anything else');
  await denied(boss.write('config/bowling', { x: 1 }), 'any other config');
  await boss.write('config/run/dash', null);
  // a Find Match game turned into a Dash board: the server checks every run against the course and the clock
  const g = await pairUp(a, b);
  const seeds = {};
  await rewrite(g.id, full => {
    full.squares.forEach((sq, i) => { sq.owner = null; sq.mini = E.newMini('dash', E.makeRng('srv' + i)); });
    full.turn = 'X'; full.lock = null; full.winner = null; full.timer.deadline = Date.now() + 45000; full.timer.for = 'X';   // (the turn began 15 s ago: a run of up to that long fits the clock)
    seeds.mini = JSON.parse(JSON.stringify(full.squares[4].mini));
  });
  const st = await gameState(g.id);
  assert.ok(Number.isInteger(st.squares[4].mini.seed.X), 'the course seed is in the public state: the server sends it');
  const m = seeds.mini, course = E.runCourse(m, 'X'), okMs = (x, y) => Math.round(E.runSecs(m.cfg, x, y) * 1000);
  const move = mv => g.X.call('move', { game: g.id, square: 4, move: mv });
  assert.deepEqual(await move({ dist: m.cfg.target - 50, ms: 1000 }), { ok: false, reason: 'fast' }, 'more distance than the time allows at the course speeds');
  const far = course[course.length - 1];
  assert.deepEqual(await move({ dist: far.at, ms: okMs(0, far.at) + 100 }), { ok: false, reason: 'fast' }, 'more time than the turn has lasted');
  const mid = (course[0].at + course[1].at) / 2;
  assert.deepEqual(await move({ dist: mid, ms: okMs(0, mid) + 100 }), { ok: false, reason: 'course' }, 'a crash where there is nothing to crash into');
  assert.deepEqual(await move({ dist: m.cfg.target + 1, ms: 1000 }), { ok: false, reason: 'bad' }, 'past the target');
  assert.deepEqual(await move('auto'), { ok: false, reason: 'bad' }, 'a timed-out run is the server\'s to make, not a phone\'s to claim');
  const first = course.find(o => o.at >= E.runGrace(m.cfg, 0));
  const r = await move({ dist: first.at + 0.2, ms: okMs(0, first.at + 0.2) + 150 });
  assert.equal(r.ok, true, `a crash at the first hazard in the time it takes (${JSON.stringify(r)})`);
  const after = await gameState(g.id);
  assert.equal(after.squares[4].mini.dist.X, Math.round((first.at + 0.2) * 100) / 100); assert.equal(after.squares[4].mini.runs.X, 1); assert.equal(after.turn, 'O');
  // the clock runs out on O: no run made for them; the turn missed
  await patch(`games/${g.id}`, { dl: Date.now() - 1000 });
  await rewrite(g.id, full => { full.timer.deadline = Date.now() - 1000; });
  assert.equal((await g.O.call('timeout', { game: g.id })).ok, true);
  const to = await gameState(g.id);
  assert.deepEqual([to.squares.filter(sq => sq.mini.runs && sq.mini.runs.O).length, to.turn, to.timer.miss.by], [0, 'X', 'O'], 'no run for O');
  // the end: resigned by O, so the match is abandoned: its squares, runs and crashes are not counted
  // (statsRules' unit tests cover what a finished match's runner squares add)
  const before = JSON.stringify((await get('stats/mini/testing/dash')) || {});
  assert.equal((await g.O.call('resign', { game: g.id })).ok, true);
  await recorded(g.id);
  assert.equal(JSON.stringify((await get('stats/mini/testing/dash')) || {}), before, 'an abandoned match adds nothing to the mini-game stats');
  assert.match(await script('RunBoss', 'revoke'), /no longer an admin/);
});

test('physics (Mini Golf, Pool, Bowling): a shot is played out on the server and its recording rides the move to both phones; the same shot run here gives the same recording; the square itself carries no recording; a bad shot is refused', async () => {
  const a = await player('Golf_A'), b = await player('Golf_B');
  const g = await pairUp(a, b);
  let dealt;
  await rewrite(g.id, full => {
    full.squares.forEach((sq, i) => { sq.owner = null; sq.mini = E.newMini(['golf', 'pool', 'bowling'][i % 3], E.makeRng('phys' + i)); });
    full.turn = 'X'; full.lock = null; full.winner = null;
    dealt = JSON.parse(JSON.stringify(full.squares.map(sq => sq.mini)));
  });
  const move = (side, sq, mv) => g[side].call('move', { game: g.id, square: sq, move: mv });
  for (const bad of [{ aim: 9, power: 0.5 }, { aim: 0, power: 1.5 }, { aim: 0, power: -0.1 }, 'up', { aim: 'a', power: 0.5 }, null]) assert.deepEqual(await move('X', 0, bad), { ok: false, reason: 'bad' }, `refused: ${JSON.stringify(bad)}`);
  const same = (i, p, shot) => { const m = JSON.parse(JSON.stringify(dealt[i])); const r = E.applyMove(m, p, shot, E.makeRng('x')); return { m, r }; };
  // golf: X's shot from the tee
  const golf = { aim: 0.02, power: 0.8 };
  assert.equal((await move('X', 0, golf)).ok, true);
  let st = await gameState(g.id), sq = st.squares[0], entry = st.recent[st.recent.length - 1], mine = same(0, 'X', golf);
  assert.equal(sq.mini.last.by, 'X'); assert.equal(sq.mini.shots.X, 1); assert.equal(sq.mini.last.rec, undefined, 'the square carries no recording (publicMini)');
  assert.ok(entry.phys && entry.phys.rec && entry.phys.rec.frames.length > 10, 'the recording rides the entry');
  assert.deepEqual(entry.phys.rec, mine.m.last.rec, 'the same shot: the same recording here and on the server');
  assert.deepEqual(sq.mini.balls, mine.m.balls); assert.deepEqual(entry.phys.events, mine.m.last.events);
  assert.equal(st.turn, mine.r.outcome === 'win' ? st.turn : 'O');
  // bowling: O rolls; the pins go on O's total, the rack is fresh next time
  const roll = { aim: -0.01, power: 0.9 };
  assert.equal((await move('O', 2, roll)).ok, true);
  st = await gameState(g.id); sq = st.squares[2]; entry = st.recent[st.recent.length - 1]; mine = same(2, 'O', roll);
  assert.equal(sq.mini.pins.O, mine.m.pins.O); assert.ok(sq.mini.pins.O > 0, `pins down (${sq.mini.pins.O})`); assert.equal(sq.mini.rolls.O, 1);
  assert.deepEqual(entry.phys.rec, mine.m.last.rec); assert.equal(entry.phys.knocked, mine.m.last.knocked); assert.deepEqual(entry.phys.down, mine.m.last.down);
  assert.equal(st.recent[st.recent.length - 2].phys.rec, null, 'the entry before it has let its recording go (the record stays small)');
  // pool: X shoots; whatever went down, the rules here and there agree
  const shot = { aim: -0.12, power: 0.55 };
  assert.equal((await move('X', 1, shot)).ok, true);
  st = await gameState(g.id); sq = st.squares[1]; entry = st.recent[st.recent.length - 1]; mine = same(1, 'X', shot);
  assert.deepEqual(sq.mini.balls, mine.m.balls); assert.deepEqual(sq.mini.down, mine.m.down); assert.deepEqual(sq.mini.pocketed, mine.m.pocketed);
  assert.deepEqual(entry.phys.rec, mine.m.last.rec);
  assert.equal(st.lock, mine.r.again ? 1 : null, 'an own ball down: X shoots again, on the same square');
  assert.ok(JSON.stringify(st).length < 120000, `the record stays small (${JSON.stringify(st).length} bytes)`);
  assert.equal((await g.O.call('resign', { game: g.id })).ok, true);
  await recorded(g.id);
});

test('Risk Wheels tuning (config/wheels): public to read, the admin alone sets it, within bounds; the server deals and spins Risk Wheels squares by it', async () => {
  const boss = await player('WheelBoss'), a = await player('Wheel_A'), b = await player('Wheel_B');
  const script = (...args) => new Promise((resolve, reject) => execFile(process.execPath, [path.join(__dirname, '..', '..', 'scripts', 'make-admin.js'), ...args],
    { env: Object.assign({}, process.env, { TTC_PROJECT: PROJECT, GCLOUD_PROJECT: PROJECT }) }, (e, out) => (e ? reject(new Error(out || e.message)) : resolve(out))));
  assert.match(await script('WheelBoss', 'grant'), /WheelBoss is now the admin/);
  await boss.auth.currentUser.getIdToken(true);
  const cfg = { target: 24, tensMin: 2, tensMax: 2, smallMax: 0, smallTop: 1, midLo: 1, midHi: 6, lowLo: 2, lowHi: 3, gap: 0.4 };   // (high: two 10s, the rest 0s)
  await denied(a.write('config/wheels', cfg), 'a player setting the difficulty');
  await boss.write('config/wheels', cfg);
  assert.deepEqual(await a.read('config/wheels'), cfg, 'everyone can read it');
  assert.equal((await fetch(`http://${DB_HOST}/config/wheels/target.json?ns=${NS}`)).status, 200, 'without a login too');
  await denied(boss.write('config/wheels', Object.assign({}, cfg, { target: 100 })), 'a target off its range');
  await denied(boss.write('config/wheels', Object.assign({}, cfg, { tensMin: 5 })), 'more 10s than a wheel allows');
  await denied(boss.write('config/wheels', Object.assign({}, cfg, { midHi: 20 })), 'a medium value off its range');
  await denied(boss.write('config/wheels', Object.assign({}, cfg, { gap: 0 })), 'no gap between the wheels\' averages');
  await denied(boss.write('config/wheels', Object.assign({}, cfg, { high: { a: 12, pa: 40, b: 0 } })), 'the old fixed wheels');
  await denied(boss.write('config/wheels/huge', 1), 'anything else');
  // a match dealt with only Risk Wheels released: every square carries the config (read before dealing; kept 20 s)
  await Promise.all(E.TYPES.map(t => boss.write(`releases/${t}`, t === 'wheels')));
  let g;
  try {
    await new Promise(r => setTimeout(r, 21000));
    g = await pairUp(a, b);
  } finally { await Promise.all(E.TYPES.map(t => boss.write(`releases/${t}`, null))); }
  const st = await gameState(g.id);
  assert.ok(st.squares.every(q => q.mini.type === 'wheels'), 'only the released game');
  for (const q of st.squares) {
    assert.equal(q.mini.target, 24, 'dealt with the admin\'s target');
    assert.deepEqual(E.wheelsCheck(q.mini.wheels, cfg), [], 'and wheels within the admin\'s settings');
    assert.deepEqual(q.mini.wheels.high.slice().sort((x, y) => x - y), [0, 0, 0, 0, 0, 0, 0, 0, 10, 10], 'two 10s, no small values');
  }
  // a spin over the server: the server's spin, from the square's wheels
  const turn = st.turn;
  assert.deepEqual(await g[turn].call('move', { game: g.id, square: 4, move: 'spin' }), { ok: false, reason: 'bad' }, 'not a wheel');
  assert.equal((await g[turn].call('move', { game: g.id, square: 4, move: 'high' })).ok, true);
  const after = (await gameState(g.id)).squares[4].mini;
  assert.ok([10, 0].includes(after.last.v) && after.pts[turn] === after.last.v && after.wheels.high[after.last.seg] === after.last.v, `the high wheel's points, from the segment it stopped on (${JSON.stringify(after.last)})`);
  await boss.write('config/wheels', null);
  assert.equal((await g.O.call('resign', { game: g.id })).ok, true);
  assert.match(await script('WheelBoss', 'revoke'), /no longer an admin/);
});
test('Odd One Out tuning (config/oddone): public to read, the admin alone sets it, within bounds; the server draws new grids by it', async () => {
  const boss = await player('OddBoss'), a = await player('Odd_A'), b = await player('Odd_B');
  assert.match(await runScript('make-admin.js', 'OddBoss', 'grant'), /OddBoss is now the admin/);
  await boss.auth.currentUser.getIdToken(true);
  const cfg = { d1: 7, d2: 3, d3: 1.5 };
  await denied(a.write('config/oddone', cfg), 'a player setting the difficulty');
  await boss.write('config/oddone', cfg);
  assert.deepEqual(await a.read('config/oddone'), cfg, 'everyone can read it');
  assert.equal((await fetch(`http://${DB_HOST}/config/oddone/d1.json?ns=${NS}`)).status, 200, 'without a login too');
  await denied(boss.write('config/oddone', Object.assign({}, cfg, { d1: 40 })), 'a difference off its range');
  await denied(boss.write('config/oddone', Object.assign({}, cfg, { d2: 'small' })), 'not a number');
  await denied(boss.write('config/oddone/other', 1), 'anything else');
  await new Promise(r => setTimeout(r, 21000));                 // (the server keeps the config 20 s)
  const g = await pairUp(a, b);
  await rewrite(g.id, full => { full.squares[4].owner = null; full.squares[4].mini = E.newMini('oddone', E.makeRng('srv-odd')); full.turn = 'X'; full.lock = null; });
  const sec = JSON.parse(await get(`games/${g.id}/sec`)), wrong = (sec[4].pos.X + 1) % 9;
  assert.equal((await g.X.call('move', { game: g.id, square: 4, move: wrong })).ok, true);
  const grid = (await gameState(g.id)).squares[4].mini.grid.X, hsl = c => c.match(/hsl\(([\d.]+) ([\d.]+)% ([\d.]+)%\)/).slice(1).map(Number);
  const d = E.oddDelta(hsl(grid.base), hsl(grid.odd));
  assert.ok(Math.abs(d - 7) < 0.25, `the next grid (level 1, by the server) at the admin's difference: ${d.toFixed(2)}`);
  await boss.write('config/oddone', null);
  assert.equal((await g.O.call('resign', { game: g.id })).ok, true);
  assert.match(await runScript('make-admin.js', 'OddBoss', 'revoke'), /no longer an admin/);
});

test('Headcount, Flash and Snapshot tuning (config/headcount, config/flash, config/snapshot): public to read, the admin alone sets them, within bounds; the server judges each answer and draws the next round by them', async () => {
  const boss = await player('AttBoss'), a = await player('Att_A'), b = await player('Att_B');
  assert.match(await runScript('make-admin.js', 'AttBoss', 'grant'), /AttBoss is now the admin/);
  await boss.auth.currentUser.getIdToken(true);
  const head = Object.assign({}, E.HEAD_DEFAULTS, { n1lo: 4, n1hi: 4, cross1: 2500 }), flash = { n1: 6, n2: 7, n3: 9, ms1: 1200, ms2: 600, ms3: 450 }, snap = Object.assign({}, E.SNAP_DEFAULTS, { c1: 3, r1: 4, k1: 5, show: 4000, wait: 2000 });
  for (const [k, cfg] of [['headcount', head], ['flash', flash], ['snapshot', snap]]) {
    await denied(a.write(`config/${k}`, cfg), `${k}: a player setting the difficulty`);
    await boss.write(`config/${k}`, cfg);
    assert.deepEqual(await a.read(`config/${k}`), cfg, `${k}: everyone can read it`);
    await denied(boss.write(`config/${k}/other`, 1), `${k}: anything else`);
  }
  assert.equal((await fetch(`http://${DB_HOST}/config/flash/n1.json?ns=${NS}`)).status, 200, 'without a login too');
  await denied(boss.write('config/headcount', Object.assign({}, head, { cross1: 99999 })), 'a crossing time off its range');
  await denied(boss.write('config/flash', Object.assign({}, flash, { ms2: 'fast' })), 'not a number');
  await denied(boss.write('config/snapshot', Object.assign({}, snap, { show: 0 })), 'no time on show');
  await new Promise(r => setTimeout(r, 21000));                 // (the server keeps the config 20 s)
  const g = await pairUp(a, b);
  for (const [type, wrongOf, check] of [
    ['headcount', r => E.attTruth('headcount', r) + 1, r => { assert.equal(E.attTruth('headcount', r), 4, 'Headcount: the admin\'s count (decoys aside)'); assert.ok(r.items.every(it => { const m = it.k.includes('mouse') ? 0.85 : 1; return it.d >= Math.round(2500 * 0.85 * m) && it.d <= Math.round(2500 * 1.15 * m); }), 'and crossing time (about even at level 1; mice a little quicker)'); }],
    ['flash', r => (r.ans + 1) % 4, r => { assert.equal(r.items.length, 6, 'Flash: the admin\'s number of items'); assert.equal(r.ms, 1200, 'and time per item'); }],
    ['snapshot', r => E.attWrong('snapshot', r, E.makeRng('w')), r => { assert.deepEqual([r.c, r.r, r.cells.length, r.show, r.wait], [3, 4, 5, 4000, 2000], 'Snapshot: the admin\'s grid, cells, time on show and countdown'); }],
  ]) {
    await rewrite(g.id, full => { full.squares[4].owner = null; full.squares[4].mini = E.newMini(type, E.makeRng('srv-' + type)); full.turn = 'X'; full.lock = null; });
    const r0 = (await gameState(g.id)).squares[4].mini.round.X;
    assert.equal((await g.X.call('move', { game: g.id, square: 4, move: type === 'flash' ? 7 : type === 'headcount' ? -1 : [99] })).ok, false, `${type}: an answer that cannot be is refused`);
    assert.equal((await g.O.call('move', { game: g.id, square: 4, kind: 'start' })).ok, false, 'Start: only the player to move');
    assert.equal((await g.X.call('move', { game: g.id, square: 4, kind: 'start' })).ok, true);
    assert.equal((await gameState(g.id)).lock, 4, `${type}: Start holds the player to the square on the server`);
    assert.equal((await g.X.call('move', { game: g.id, square: 2, kind: 'start' })).ok, false, 'no second round elsewhere');
    assert.equal((await g.X.call('move', { game: g.id, square: 4, move: wrongOf(r0) })).ok, true);
    assert.equal((await gameState(g.id)).lock, null, 'answered: the hold is over');
    let m = (await gameState(g.id)).squares[4].mini;
    assert.deepEqual([m.right.X, m.last.correct, m.last.by], [0, false, 'X'], `${type}: wrong, no step`);
    assert.deepEqual(m.last.truth, E.attTruth(type, r0), 'the right answer, for the result');
    check(m.round.X);
    const r1 = m.round.X;
    assert.equal((await g.O.call('move', { game: g.id, square: 4, move: E.attTruth(type, m.round.O) })).ok, true);
    m = (await gameState(g.id)).squares[4].mini;
    assert.deepEqual([m.right.O, m.last.correct, m.round.O.level], [1, true, 1], `${type}: right, a step up and the next level`);
    assert.deepEqual(m.round.X, r1, 'the other player\'s round untouched');
  }
  for (const k of ['headcount', 'flash', 'snapshot']) await boss.write(`config/${k}`, null);
  assert.equal((await g.O.call('resign', { game: g.id })).ok, true);
  assert.match(await runScript('make-admin.js', 'AttBoss', 'revoke'), /no longer an admin/);
});

test('Sky Hop, Scoop Stack and Pinball over the server: the tuning is public, the admin alone sets it, within bounds; Start holds the player; an attempt is played through again (or its recording checked) and against the clock; a faked or too-long one is refused', async () => {
  const boss = await player('FingBoss'), a = await player('Fing_A'), b = await player('Fing_B');
  assert.match(await runScript('make-admin.js', 'FingBoss', 'grant'), /FingBoss is now the admin/);
  await boss.auth.currentUser.getIdToken(true);
  const cfgs = { skyhop: Object.assign({}, E.HOP_DEFAULTS, { target: 300 }), scoop: Object.assign({}, E.SCOOP_DEFAULTS, { target: 20 }), pinball: Object.assign({}, E.PINB_DEFAULTS, { size: 1.5 }) };
  for (const [k, cfg] of Object.entries(cfgs)) {
    await denied(a.write(`config/${k}`, cfg), `${k}: a player setting the difficulty`);
    await boss.write(`config/${k}`, cfg);
    assert.deepEqual(await a.read(`config/${k}`), cfg, `${k}: everyone can read it`);
    await denied(boss.write(`config/${k}/other`, 1), `${k}: anything else`);
  }
  assert.equal((await fetch(`http://${DB_HOST}/config/skyhop/target.json?ns=${NS}`)).status, 200, 'without a login too');
  await denied(boss.write('config/skyhop', Object.assign({}, cfgs.skyhop, { target: 99999 })), 'a height off its range');
  await denied(boss.write('config/scoop', Object.assign({}, cfgs.scoop, { cone: 'fast' })), 'not a number');
  // Bowling's two taps' speeds (config/bowling): the same, in its own range
  await denied(a.write('config/bowling', E.BOWL_DEFAULTS), 'bowling: a player setting its speeds');
  await boss.write('config/bowling', E.BOWL_DEFAULTS);
  assert.deepEqual(await a.read('config/bowling'), E.BOWL_DEFAULTS, 'bowling: everyone can read it');
  await denied(boss.write('config/bowling', { aimMs: 100, meterMs: 600 }), 'bowling: faster than its range');
  await denied(boss.write('config/bowling/other', 500), 'bowling: anything else');
  await boss.write('config/bowling', null);
  for (const k of Object.keys(cfgs)) await boss.write(`config/${k}`, null);
  const g = await pairUp(a, b);
  const at = (type, mini, p) => (type === 'skyhop' ? mini.height[p] : type === 'scoop' ? mini.stack[p].length : mini.lit[p].filter(Boolean).length);
  for (const type of ['skyhop', 'scoop', 'pinball']) {
    // the turn began long ago (so a real attempt is within the time it has lasted)
    await rewrite(g.id, full => { full.squares[4].owner = null; full.squares[4].mini = E.newMini(type, E.makeRng('srv-' + type)); full.turn = 'X'; full.lock = null; full.timer.deadline = Date.now() + 5000; });
    let mini = (await gameState(g.id)).squares[4].mini;
    const real = E.fingAi(mini, 'X', E.makeRng('srv-ai-' + type));
    assert.equal((await g.X.call('move', { game: g.id, square: 4, move: { fing: true } })).reason, 'bad', `${type}: the computer's placeholder is no attempt`);
    assert.equal((await g.X.call('move', { game: g.id, square: 4, move: 'auto' })).reason, 'bad', `${type}: a timed-out attempt is the server's to make`);
    assert.equal((await g.O.call('move', { game: g.id, square: 4, kind: 'start' })).ok, false, 'Start: only the player to move');
    assert.equal((await g.X.call('move', { game: g.id, square: 4, kind: 'start' })).ok, true);
    assert.equal((await gameState(g.id)).lock, 4, `${type}: Start holds the player to the square on the server`);
    assert.equal((await g.X.call('move', { game: g.id, square: 2, kind: 'start' })).ok, false, 'no second attempt elsewhere');
    const fake = type !== 'pinball' ? Object.assign({}, real, { steps: real.steps + 240 }) : Object.assign({}, real, { hits: real.hits.concat(E.PHYSICS.lib.PIN.targets.filter(t => !real.hits.some(h => h[0] === t.id)).slice(0, 1).map(t => [t.id, 0.2])) });
    assert.equal((await g.X.call('move', { game: g.id, square: 4, move: fake })).ok, false, `${type}: more than the attempt did is refused`);
    assert.equal((await g.X.call('move', { game: g.id, square: 4, move: real })).ok, true, `${type}: the real attempt goes in`);
    let st = await gameState(g.id);
    mini = st.squares[4].mini;
    assert.equal(st.lock, null, 'the hold is over');
    assert.ok(at(type, mini, 'X') > 0 || real.end !== 'top', `${type}: progress kept (${at(type, mini, 'X')})`);
    assert.equal(mini.last.by, 'X');
    assert.ok(type === 'pinball' ? mini.last.rec === real.rec : mini.last.log === real.log, 'the inputs or the recording ride the move, for the other phone\'s replay');
    // O's turn, just begun: an attempt longer than the turn has lasted is refused
    if (st.turn === 'O' && !st.squares[4].owner) {
      await rewrite(g.id, full => { full.timer.deadline = Date.now() + full.timer.limit * 1000; });
      const long = E.fingAi(mini, 'O', E.makeRng('srv-long-' + type)), ms = type === 'pinball' ? long.ms : long.steps * E.FING.step * 1000;
      if (ms > E.FING.slackMs + 3000) assert.equal((await g.O.call('move', { game: g.id, square: 4, move: long })).reason, 'fast', `${type}: ${Math.round(ms)} ms of attempt in a turn of a second or two`);
      await rewrite(g.id, full => { full.turn = 'X'; full.lock = null; });
    }
  }
  assert.equal((await g.O.call('resign', { game: g.id })).ok, true);
  assert.match(await runScript('make-admin.js', 'FingBoss', 'revoke'), /no longer an admin/);
});

test('Trivia over the server: a new question is face down (the question itself only in the hidden node); the player to move turns it up, and is then held to the square; the pick made', async () => {
  const a = await player('Triv_A'), b = await player('Triv_B'), g = await pairUp(a, b);
  E.setTriviaBank(require('../../trivia.json'));
  await rewrite(g.id, full => { full.squares[4].owner = null; full.squares[4].mini = E.newMini('trivia', E.makeRng('srv-t')); E.triviaDeal(full, full.squares[4], E.makeRng('srv-tq')); full.squares[2].owner = null; full.squares[2].mini = E.newMini('ttt', E.makeRng('t')); full.turn = 'X'; full.lock = null; });
  let st = await gameState(g.id), sec = JSON.parse(await get(`games/${g.id}/sec`));
  assert.deepEqual(st.squares[4].mini.ask, { down: true, n: 4 }, 'face down for the phones');
  assert.ok(sec[4].ask.q && !JSON.stringify(st).includes(sec[4].ask.q), 'the question kept apart');
  assert.equal((await g.O.call('move', { game: g.id, square: 4, kind: 'reveal' })).reason, 'turn', 'only the player to move');
  const seq0 = st.seq;
  assert.equal((await g.X.call('move', { game: g.id, square: 4, kind: 'reveal' })).ok, true);
  st = await gameState(g.id);
  assert.deepEqual([st.squares[4].mini.shown, st.squares[4].mini.ask.q, st.lock, st.turn, st.seq], [true, sec[4].ask.q, 4, 'X', seq0], 'up for both, X held to it, the same turn');
  assert.equal((await g.X.call('move', { game: g.id, square: 2, move: 0 })).reason, 'locked', 'no other square this turn');
  const wrong = (sec[4].answer + 1) % 4;
  assert.equal((await g.X.call('move', { game: g.id, square: 4, move: wrong })).ok, true);
  st = await gameState(g.id);
  assert.deepEqual([st.squares[4].mini.crossed, st.squares[4].mini.shown, st.squares[4].mini.last.fresh, st.lock, st.turn], [[wrong], true, true, null, 'O'], 'crossed out, still up, the turn passed');
  assert.equal((await g.O.call('move', { game: g.id, square: 4, kind: 'reveal' })).reason, 'shown', 'up already: nothing to reveal');
  assert.equal((await g.O.call('resign', { game: g.id })).ok, true);
});

test('Bullseye tuning (config/bulls): public to read, the admin alone sets it, within bounds; the server deals new Bullseye squares by it', async () => {
  const boss = await player('BullBoss'), a = await player('Bull_A'), b = await player('Bull_B');
  const script = (...args) => new Promise((resolve, reject) => execFile(process.execPath, [path.join(__dirname, '..', '..', 'scripts', 'make-admin.js'), ...args],
    { env: Object.assign({}, process.env, { TTC_PROJECT: PROJECT, GCLOUD_PROJECT: PROJECT }) }, (e, out) => (e ? reject(new Error(out || e.message)) : resolve(out))));
  assert.match(await script('BullBoss', 'grant'), /BullBoss is now the admin/);
  await boss.auth.currentUser.getIdToken(true);
  const cfg = { board: 14, bull: 4, sweep: 1700, ramp: 1.05 };
  await denied(a.write('config/bulls', cfg), 'a player setting the difficulty');
  await boss.write('config/bulls', cfg);
  assert.deepEqual(await a.read('config/bulls'), cfg, 'everyone can read it');
  assert.equal((await fetch(`http://${DB_HOST}/config/bulls/board.json?ns=${NS}`)).status, 200, 'without a login too');
  await denied(boss.write('config/bulls', Object.assign({}, cfg, { board: 50 })), 'a board off its range');
  await denied(boss.write('config/bulls', Object.assign({}, cfg, { bull: 20 })), 'a bullseye as big as the board');
  await denied(boss.write('config/bulls', Object.assign({}, cfg, { sweep: 'fast' })), 'a sweep that is not a number');
  await denied(boss.write('config/bulls/other', 1), 'anything else');
  // a new match: its Bullseye squares carry the config (the server reads it before dealing; it keeps it 20 s)
  await new Promise(r => setTimeout(r, 21000));
  const g = await pairUp(a, b);
  const st = await gameState(g.id);
  const bulls = st.squares.filter(q => q.mini.type === 'bullseye');
  for (const q of bulls) assert.deepEqual(q.mini.cfg, cfg, 'dealt with the admin\'s values');
  // a throw over the server: scored from the two stopped lines, the board moved on by the server
  let i = st.squares.findIndex(q => q.mini.type === 'bullseye');
  if (i < 0) { await rewrite(g.id, full => { full.squares[4].owner = null; full.squares[4].mini = E.newMini('bullseye', E.makeRng('srv-b')); full.turn = 'X'; full.lock = null; }); i = 4; }
  const before = (await gameState(g.id)).squares[i].mini, turn = (await gameState(g.id)).turn;
  const mv = { x: before.pos[0] / E.BULLS.w, y: before.pos[1] / E.BULLS.h };
  assert.equal((await g[turn].call('move', { game: g.id, square: i, move: mv })).ok, true);
  const after = (await gameState(g.id)).squares[i].mini;
  assert.equal(after.last.pts, 3, 'dead centre: the bullseye'); assert.deepEqual(after.last.pos, before.pos); assert.notDeepEqual(after.pos, before.pos);
  assert.deepEqual(await g[turn === 'X' ? 'O' : 'X'].call('move', { game: g.id, square: i, move: 0.5 }), { ok: false, reason: 'bad' }, 'the old one-number throw is refused');
  await boss.write('config/bulls', null);
  assert.equal((await g.O.call('resign', { game: g.id })).ok, true);
  assert.match(await script('BullBoss', 'revoke'), /no longer an admin/);
});

/* ===================================== match logs ===================================== */
// functions/matchLogRules.js: every online match's log, written by the server (Find Match moves, a friend
// room's record, presence) and by the phones through devlog (a report, an mlog event); the admin alone reads
// them; a log 30 days past its last event is deleted by the sweep.
test('match logs: a Find Match game (its start, a refused move with its reason, the moves, the end), a friend room (start, moves, a phone dropping off and back, the end), a report; admin-only; deleted after 30 days', async () => {
  const a = await player('LogAnn'), b = await player('LogBob');
  const g = await pairUp(a, b);
  await nearWin(g.id, 'X');
  const notYours = await g.O.call('move', { game: g.id, square: 2, move: 2 });
  assert.equal(notYours.ok, false, "O's move on X's turn: refused");
  assert.equal((await g.X.call('move', { game: g.id, square: 2, move: 2 })).ok, true);
  await recorded(g.id);
  const key = 'm' + g.id;
  const ix = await until(() => get(`matchLogIndex/${key}`), 10000, "the game's log");
  assert.deepEqual([ix.mode, ix.players.X.uid, ix.players.O.uid], ['match', g.X.uid, g.O.uid]);
  const evs = Object.values(await until(async () => { const v = await get(`matchLogs/${key}`); return v && Object.values(v).some(e => e.k === 'end') ? v : null; }, 10000, 'the end in the log')).sort((x, y) => x.t - y.t);
  const ks = evs.map(e => e.k);
  assert.equal(ks[0], 'start');
  const rej = evs.find(e => e.k === 'reject');
  assert.ok(rej && rej.s === 'O' && rej.why === notYours.reason, `the refused move and why (${JSON.stringify(rej)})`);
  assert.ok(evs.some(e => e.k === 'move' && e.s === 'X' && e.q === 2 && e.g === 'ttt'), 'the winning move');
  assert.equal(evs.find(e => e.k === 'end').w, 'X');
  assert.ok(evs.every(e => Number.isFinite(e.t) && e.src === 'srv'));

  // a friend room: the record's start and moves, presence off and on again, the end
  const host = await player(null, { anonymous: true }), guest = await player(null, { anonymous: true });
  const code = 'LGGDX';                                       // (a room code: no I or O)
  const rec = E.newOnlineMatch({ names: { X: 'H', O: 'G' }, games: Object.fromEntries(E.TYPES.map(t => [t, t === 'hilo'])) }, E.makeRng(7), 'lm1');
  await host.write(`rooms/${code}`, { created: Date.now(), host: host.uid, status: 'lobby', players: { X: { uid: host.uid, name: 'H', joined: Date.now() } }, setup: { hostSide: 'X', timer: 0 } });
  await guest.write(`rooms/${code}/players/O`, { uid: guest.uid, name: 'G', joined: Date.now() });
  await host.write(`rooms/${code}/status`, 'playing');
  await host.write(`rooms/${code}/match`, E.packMatch(rec));
  const fkey = `f${code}_lm1`;
  await until(() => get(`matchLogRoom/${code}`), 10000, "the room pointed at its match's log");
  const logged = k => until(async () => { const v = await get(`matchLogs/${fkey}`); return v && Object.values(v).some(e => e.k === k) ? v : null; }, 10000, `${k} in the log`);
  await guest.write(`presence/${code}/O`, { online: true, away: false, at: Date.now() }); await logged('online');   // (each logged before the next: the emulator's triggers can overlap)
  await guest.write(`presence/${code}/O`, { online: false, at: Date.now() }); await logged('offline');
  await guest.write(`presence/${code}/O`, { online: true, away: false, at: Date.now() });
  let r = rec;
  for (const i of [0, 1, 2]) { r.state.turn = 'O'; r = E.applyOnlineMove(r, 'O', i, r.secrets[i].target, E.makeRng(i)).rec; await guest.write(`rooms/${code}/match`, E.packMatch(r)); }
  const fev = Object.values(await until(async () => { const v = await get(`matchLogs/${fkey}`); return v && Object.values(v).some(e => e.k === 'end') && Object.values(v).some(e => e.k === 'reconnect') ? v : null; }, 15000, "the friend match's log")).sort((x, y) => x.t - y.t);
  const fk = fev.map(e => e.k);
  assert.equal(fk[0], 'start');
  for (const k of ['online', 'offline', 'reconnect', 'move', 'end']) assert.ok(fk.includes(k), `${k} in ${fk}`);
  assert.equal(fev.filter(e => e.k === 'move').length, 3);
  const fix = await get(`matchLogIndex/${fkey}`);
  assert.deepEqual([fix.mode, fix.room, fix.players.X.name, fix.players.O.uid], ['friend', code, 'H', guest.uid]);

  // a phone's report (and an mlog event) through devlog: the match flagged, the moment stamped
  const dev = 'dlogtest0123456789abcdef';
  assert.equal((await guest.call('devlog', { dev, ev: 'report', o: 'rep0000001', g: fkey, mode: 'friend', note: 'The board froze', v: 'abc1234', s: 'O' })).ok, true);
  assert.equal((await guest.call('devlog', { dev, ev: 'mlog', o: 'mlg0000001', g: fkey, mode: 'friend', e: { k: 'reject', q: 3, why: 'turn' }, v: 'abc1234', s: 'O' })).ok, true);
  const rix = await until(async () => { const v = await get(`matchLogIndex/${fkey}`); return v && v.reported ? v : null; }, 10000, 'the match flagged');
  assert.deepEqual([rix.note, rix.reports, rix.vers], ['The board froze', 1, 'abc1234']);
  const after = Object.values(await get(`matchLogs/${fkey}`));
  assert.ok(after.some(e => e.k === 'report' && e.note === 'The board froze' && e.s === 'O' && e.dev), 'the report in the log');
  assert.ok(after.some(e => e.k === 'reject' && e.src === 'cli' && e.why === 'turn'), "the phone's own event");
  assert.equal(await get(`devlog/${S.devHash(dev)}/lmlg0000001`), null, "an mlog event is for the match's log only");
  // the phone's sound going down (devlog audio): in the device's log and the match's
  assert.equal((await guest.call('devlog', { dev, ev: 'audio', o: 'aud0000001', g: fkey, mode: 'friend', msg: 'state interrupted', v: 'abc1234', s: 'O' })).ok, true);
  assert.equal((await get(`devlog/${S.devHash(dev)}/aaud0000001`)).msg, 'state interrupted');
  await until(async () => Object.values(await get(`matchLogs/${fkey}`)).some(e => e.k === 'audio' && e.msg === 'state interrupted' && e.s === 'O') || null, 10000, "the sound's event in the match's log");

  // the admin alone reads them; nobody writes them
  await denied(guest.read(`matchLogs/${fkey}`), 'a player reading a match log');
  await denied(guest.read('matchLogIndex'), 'a player reading the index');
  await denied(guest.write(`matchLogIndex/${fkey}/reported`, null), 'a player clearing a report');

  // 30 days after its last event: deleted by the sweep
  await patch(`matchLogIndex/${fkey}`, { last: Date.now() - 31 * 86400000 });
  await sweep();
  assert.equal(await get(`matchLogIndex/${fkey}`), null);
  assert.equal(await get(`matchLogs/${fkey}`), null);
  assert.ok(await get(`matchLogIndex/${key}`), 'a recent one stays');
});

// Find Match is Super Chaos, run by the server (core/scgame.js): every move a request checked and made there,
// every secret and every draw the server's, each side shown only its own square until the recap; the round
// settled once both are in, or at the deadline (a side not in misses the round); the next round begun once
// both phones are through the recap (a bot is at once); the result on both Find Match records, in the history and the stats; a lone
// searcher given a bot that plays by the computer's Super Chaos play, counted apart.
const scRig = async (id, minis) => {   // the match's squares set as given (the rest Higher/Lower squares nobody plays), on the server's record and what the phones see
  const g = await get(`games/${id}`), full = JSON.parse(g.sec.full), prog = JSON.parse(g.sec.prog);
  full.squares = Array.from({ length: 9 }, (_, i) => ({ owner: null, mini: minis[i] || { type: 'hilo', target: 20, lo: 1, hi: 30, guesses: [] }, mv: { X: 0, O: 0 } }));
  const rec = { full, prog };
  await patch(`games/${id}`, { 'sec/full': JSON.stringify(full), 'pub/state': JSON.stringify(E.scPublicState(rec)), 'sides/X': JSON.stringify(E.scSideView(rec, 'X')), 'sides/O': JSON.stringify(E.scSideView(rec, 'O')) });
};
const scPast = async id => {           // the round's deadline moved back past its grace (as time would)
  const g = await get(`games/${id}`), full = JSON.parse(g.sec.full), st = JSON.parse(g.pub.state), dl = Date.now() - E.SC_ONLINE.graceMs - 1000;
  full.sc.deadline = dl; st.sc.deadline = dl;
  await patch(`games/${id}`, { 'sec/full': JSON.stringify(full), 'pub/state': JSON.stringify(st), 'pub/deadline': dl, dl: dl + E.SC_ONLINE.graceMs });
};
const scState = async id => JSON.parse(await get(`games/${id}/pub/state`));
test('Super Chaos Find Match, two clients: paired into a match the server runs; a move a request at a time, checked, hidden; the round settled once both are in, the recap for both; the deadline: a missed round; the next round begun once both are through the recap; the win recorded as Find Match', async () => {
  await clearQueue();
  const a = await player('ScAnn'), b = await player('ScBob'), c = await player('ScCal');
  let ra = { status: 'searching' }, rb = ra;
  for (let k = 0; k < 20 && (ra.status !== 'matched' || rb.status !== 'matched'); k++) [ra, rb] = await Promise.all([a.call('findMatch', { mode: 'chaos' }), b.call('findMatch', { mode: 'chaos' })]);
  assert.deepEqual([ra.status, rb.status], ['matched', 'matched']); assert.equal(ra.game, rb.game); assert.notEqual(ra.side, rb.side);
  const id = ra.game, by = { [ra.side]: a, [rb.side]: b }, X = by.X, O = by.O;
  const pub = await X.read(`games/${id}/pub`);
  assert.deepEqual([pub.chaos, pub.queue, pub.mode, pub.timer, pub.status, pub.round], [true, 'chaos', 'match', 0, 'playing', 1]);
  assert.deepEqual(await get(`active/${X.uid}`), { game: id, side: 'X', queue: 'chaos', mode: 'match' });
  assert.deepEqual(await get(`queue/chaos`), null, 'out of the queue');
  const st0 = JSON.parse(pub.state);
  assert.ok(st0.sc && st0.sc.online && st0.sc.round === 1 && st0.sc.deadline > Date.now() + 60000, 'round 1 timed from the server, with a grace for the intro');
  assert.ok(st0.squares.every(q => E.scTypes().includes(q.mini.type)), 'Super Chaos games only');
  const full0 = JSON.parse(await get(`games/${id}/sec/full`));
  assert.ok(st0.squares.every((q, i) => { const sec = E.secretOf(full0.squares[i].mini); return !sec || Object.keys(sec).every(k => q.mini[k] === undefined || JSON.stringify(q.mini[k]) !== JSON.stringify(sec[k])); }), 'no secret in what the phones see');
  await denied(X.read(`games/${id}/sec`), 'the server\'s record'); await denied(X.read(`games/${id}/sides/O`), 'the other side\'s node'); await denied(c.read(`games/${id}/pub`), 'an onlooker');
  assert.equal(JSON.parse(await X.read(`games/${id}/sides/X`)).round, 1, 'its own node');
  await scRig(id, [{ type: 'wordle', word: 'CRANE', guesses: [] }, { type: 'wordle', word: 'SLATE', guesses: [] }, { type: 'wordle', word: 'BREAD', guesses: [] }, { type: 'hangman', word: 'ZEBRA', letters: [] }]);
  // round 1: X wins square 0 with a word; O's Hangman hit keeps its move going, the next letter ends it: settled
  assert.deepEqual(await c.call('scMove', { game: id, square: 0, move: 'CRANE' }), { ok: false, reason: 'not-player' }, 'an onlooker');
  const mx = await X.call('scMove', { game: id, square: 0, move: 'CRANE', rep: [[0, 'key', 'C']] });
  assert.deepEqual([mx.ok, mx.me.win, mx.moved, mx.lock, mx.resolved, mx.mini.guesses.length], [true, true, 0, null, false, 1], JSON.stringify(mx));
  assert.notEqual(mx.mini.word, 'CRANE', 'the word stays on the server');
  assert.deepEqual(await X.call('scMove', { game: id, square: 1, move: 'SLATE' }), { ok: false, reason: 'moved' }, 'one move a round');
  let st = await scState(id);
  assert.deepEqual(st.sc.moves, { X: true, O: false }); assert.equal(st.squares[0].mini.guesses.length, 0, 'nothing of X\'s move on the board yet');
  assert.equal(JSON.parse(await X.read(`games/${id}/sides/X`)).me.square, 0, 'X\'s own move, in its node');
  const o1 = await O.call('scMove', { game: id, square: 3, move: 'Z' });
  assert.deepEqual([o1.ok, o1.lock, o1.me, o1.mini.letters.length], [true, 3, null, 1], JSON.stringify(o1));
  assert.deepEqual(await O.call('scMove', { game: id, square: 4, move: 10 }), { ok: false, reason: 'locked' }, 'held to its square');
  assert.equal(JSON.parse(await O.read(`games/${id}/sides/O`)).prog.square, 3, 'its progress, for a reload');
  const o2 = await O.call('scMove', { game: id, square: 3, move: 'Q' });
  assert.ok(o2.ok && o2.me && o2.resolved, JSON.stringify(o2));
  st = await scState(id);
  assert.deepEqual([st.sc.round, st.sc.deadline, st.squares[0].owner], [2, null, 'X'], 'settled: round 2 waits for a phone through the recap');
  const rc = st.sc.recap;
  assert.deepEqual([rc.round, rc.claims.map(x => x.square + x.by), rc.mv.X.square, rc.mv.O.square, rc.mv.O.steps.length], [1, ['0X'], 0, 3, 2]);
  assert.ok(rc.at > Date.now() - 5000 && rc.mv.O.steps[1].after.word !== 'ZEBRA', 'the shared start; the recap hidden too');
  assert.deepEqual(await O.call('scMove', { game: id, square: 4, move: 10 }), { ok: false, reason: 'recap' });
  assert.deepEqual(await X.call('scBegin', { game: id }), { ok: true, begun: false }, 'X through the recap: round 2 waits for O');
  assert.equal((await scState(id)).sc.deadline, null);
  assert.deepEqual(await X.call('scBegin', { game: id }), { ok: false, reason: 'waiting' }, 'said again: nothing changes');
  assert.deepEqual(await O.call('scBegin', { game: id }), { ok: true, begun: true });
  assert.deepEqual(await X.call('scBegin', { game: id }), { ok: false, reason: 'begun' });
  st = await scState(id); assert.ok(st.sc.deadline > Date.now() + 55000, 'round 2 begun, timed from then');
  // round 2: X in, O never: the deadline past its grace: O missed the round, nothing played for O (a phone asks; the sweep would)
  assert.ok((await X.call('scMove', { game: id, square: 1, move: 'SLATE' })).me.win);
  assert.deepEqual(await X.call('scTick', { game: id }), { ok: true, settled: false }, 'too early');
  await scPast(id);
  assert.deepEqual(await X.call('scTick', { game: id }), { ok: true, settled: true });
  st = await scState(id);
  assert.deepEqual([st.sc.round, st.squares[1].owner, st.sc.recap.mv.O, st.sc.recap.missed, st.sc.miss], [3, 'X', null, ['O'], { X: 0, O: 1 }], 'O missed it: no move played for O');
  assert.deepEqual(await O.call('scBegin', { game: id }), { ok: true, begun: false });
  assert.deepEqual(await X.call('scBegin', { game: id }), { ok: true, begun: true });
  // round 3: X's third word makes the line; the match ends when O's move is in; recorded as Find Match for both
  assert.ok((await X.call('scMove', { game: id, square: 2, move: 'BREAD' })).me.win);
  const last = await O.call('scMove', { game: id, square: 4, move: 10 });
  assert.ok(last.ok && last.resolved, JSON.stringify(last));
  st = await scState(id); assert.equal(st.winner, 'X');
  assert.deepEqual(await X.call('scMove', { game: id, square: 5, move: 10 }), { ok: false, reason: 'over' });
  await recorded(id);
  const g = await get(`games/${id}`);
  assert.equal(g.pub.status, 'over'); assert.deepEqual(g.pub.result.records, { X: { wins: 1, losses: 0, draws: 0 }, O: { wins: 0, losses: 1, draws: 0 } });
  assert.deepEqual([(await get(`users/${X.uid}`)).wins, (await get(`users/${O.uid}`)).losses, await get(`active/${X.uid}`), await get(`active/${O.uid}`)], [1, 1, null, null]);
  const hx = await get(`history/${X.uid}/${id}`), ho = await get(`history/${O.uid}/${id}`);
  assert.deepEqual([hx.mode, hx.result, hx.opponent.uid, ho.mode, ho.result, JSON.parse(hx.final).squares[0].mini.word], ['match', 'win', O.uid, 'match', 'loss', 'CRANE'], 'Find Match in the history, the final board revealed');
  assert.equal((await get(`oppStats/${X.uid}/${O.uid}`)).wins, 1, 'Top opponents');
  const log = Object.values(await get(`matchLogs/m${id}`) || {}).map(e => e.k);
  for (const k of ['start', 'move', 'resolve', 'round', 'timeout', 'end']) assert.ok(log.includes(k), `${k} in the match's log (${log})`);
});
test('Super Chaos Find Match against a bot: a lone searcher gets a bot after their wait; it moves by the computer\'s Super Chaos play once its think is over; the round settles; counted apart', async () => {
  await clearQueue(); await botsOn();
  const h = await player('ScSolo');
  assert.equal((await h.call('findMatch', { mode: 'chaos' })).status, 'searching');
  await patch(`queue/chaos/${h.uid}`, { botAt: Date.now() - 1 });
  const r = await h.call('findMatch', { mode: 'chaos' });
  assert.equal(r.status, 'matched', 'a bot once the wait is over');
  const id = r.game, botSide = r.side === 'X' ? 'O' : 'X';
  const pub = await h.read(`games/${id}/pub`), bg = await get(`botGames/${id}`);
  assert.equal(pub.chaos, true); assert.deepEqual([bg.side, bg.human, bg.live], [botSide, h.uid, true]);
  assert.ok(bg.next && bg.next.round === 1 && bg.next.due > Date.now(), 'its move for round 1 planned, due after a think');
  assert.deepEqual(Object.keys(pub).sort(), ['chaos', 'created', 'deadline', 'mode', 'players', 'queue', 'round', 'state', 'status', 'timer', 'updated'], 'nothing in the game says bot');
  assert.deepEqual(await h.call('scTick', { game: id }), { ok: true, settled: false }, 'not due yet: the bot waits');
  assert.equal((await scState(id)).sc.moves[botSide], false);
  await scRig(id, [{ type: 'wordle', word: 'CRANE', guesses: [] }]);   // (the human's square, set before the bot moves: its move stands on this board)
  await patch(`botGames/${id}/next`, { due: Date.now() - 1 });
  await h.call('scTick', { game: id });
  let st = await scState(id);
  assert.equal(st.sc.moves[botSide], true, 'the bot\'s move in once due');
  const m = await h.call('scMove', { game: id, square: 0, move: 'CRANE' });
  assert.ok(m.ok && m.resolved, JSON.stringify(m));
  st = await scState(id);
  assert.equal(st.sc.round, 2); assert.ok(st.sc.recap.mv[botSide].steps.length >= 1, 'the bot\'s move, for the replay');
  assert.deepEqual(await h.call('scBegin', { game: id }), { ok: true, begun: true }, 'the bot is through the recap at once: the round begins with the human');
  assert.equal((await get(`botGames/${id}/next`)).round, 2, 'its move for round 2 planned as the round began');
  assert.equal((await h.call('resign', { game: id })).ok, true);
  await recorded(id);
  const done = await get(`botGames/${id}`);
  assert.deepEqual([done.done, done.live, done.winner], [true, undefined, botSide]);
  assert.equal((await get(`history/${h.uid}/${id}`)).mode, 'match');
  assert.ok((await get('botStats/finished')) >= 1, 'bot matches counted apart');
});
