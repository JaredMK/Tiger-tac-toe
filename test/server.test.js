'use strict';
// The server on the Firebase Emulator Suite: accounts, matchmaking, server-run matches, ratings,
// the leaderboard and history, and the security rules. Run with:  npm run test:emulators
// (Plain `node --test` skips this file: it needs the emulators.)
const test = require('node:test');
const assert = require('node:assert/strict');

const EMU = !!process.env.FIREBASE_AUTH_EMULATOR_HOST && !!process.env.FIREBASE_DATABASE_EMULATOR_HOST;
if (!EMU) { test('server tests (need the emulators: npm run test:emulators)', { skip: true }, () => {}); return; }

const E = require('../engine.js');
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
  p.call = async (name, data) => (await F.httpsCallable(fns, name)(data)).data;
  p.read = async path => (await D.get(D.ref(db, path))).val();
  p.write = (path, v) => D.set(D.ref(db, path), v);
  if (username && !opts.anonymous && !opts.noName) assert.deepEqual(await p.call('claimUsername', { username }), { ok: true, username });
  return p;
}
const denied = async (promise, what) => {
  await assert.rejects(promise, e => /permission[_ ]denied/i.test(String(e.code || e.message)), `${what} should be refused`);
};

// ---------- matches ----------
// Two players search the same queue until both are in the same game.
async function pairUp(a, b, queue = 'ranked', timer = 60) {
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

test.after(async () => { for (const app of apps) await deleteApp(app).catch(() => {}); });

/* ===================================== accounts ===================================== */
test('usernames: the format, the profanity filter, unique regardless of case, and only once', async () => {
  const p = await player('Alice_01');
  for (const [bad, why] of [['ab', /3 to 16/], ['abcdefghijklmnopq', /3 to 16/], ['no spaces', /letters, numbers/], ['dash-name', /letters, numbers/], ['émile', /letters, numbers/], ['admin', /reserved/], ['FuCkFace', /another/], ['sh1thead', /another/], ['big_ass', /another/]]) {
    const q = await player(null, { noName: true });
    const r = await q.call('claimUsername', { username: bad });
    assert.equal(r.ok, false, bad); assert.match(r.reason, why, bad);
  }
  for (const fine of ['classic', 'Peacock_7', 'grapes']) {          // words that only contain a short bad word
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
  await denied(p.write(`queue/ranked/${p.uid}`, { rating: 1 }), 'the queue');
  await denied(p.write(`active/${p.uid}`, { game: 'x' }), 'the active game');
  await denied(p.write('games/xxxxxxxxxx', { pub: { status: 'playing' } }), 'a game');
});

/* ===================================== matchmaking ===================================== */
test('matchmaking: two players searching at the same moment are paired exactly once', async () => {
  const a = await player('Ann'), b = await player('Ben');
  const [ra, rb] = await Promise.all([a.call('findMatch', { queue: 'ranked' }), b.call('findMatch', { queue: 'ranked' })]);
  assert.deepEqual([ra.status, rb.status].sort(), ['matched', 'searching'], 'whichever search lands second finds the first at once');
  const first = ra.status === 'matched' ? ra : rb;
  const g = await pairUp(a, b);
  assert.equal(g.id, first.game, 'the game found at once is the one they play');
  const all = (await get('games')) || {};
  const mine = Object.entries(all).filter(([, v]) => v.pub && [v.pub.players.X.uid, v.pub.players.O.uid].includes(a.uid)).map(([id]) => id);
  assert.deepEqual(mine, [g.id], 'one game for the pair');
  assert.equal(await get(`queue/ranked/${a.uid}`), null, 'out of the queue');
  assert.equal(await get(`queue/ranked/${b.uid}`), null);
  assert.deepEqual(await a.read(`active/${a.uid}`), { game: g.id, side: g.X === a ? 'X' : 'O', queue: 'ranked', mode: 'ranked' });
  await denied(a.read(`active/${b.uid}`), 'reading someone else\'s active game');
  await g.X.call('resign', { game: g.id }); await recorded(g.id);
});

test('matchmaking: six players at once make three games, each player in exactly one', async () => {
  const ps = await Promise.all(['Cal', 'Dee', 'Eve', 'Fay', 'Gus', 'Hal'].map(u => player(u)));
  const res = new Map();
  for (let k = 0; k < 15 && res.size < ps.length; k++) {
    const out = await Promise.all(ps.map(p => (res.has(p.uid) ? null : p.call('findMatch', { queue: 'casual', timer: 30 }))));
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
    assert.equal(pub.mode, 'casual'); assert.equal(pub.timer, 30);
  }
  for (const p of ps) await p.call('resign', { game: res.get(p.uid).game }).catch(() => {});
});

test('matchmaking: closest rating first, and the range widens with the wait', async () => {
  const ps = await Promise.all(['R1200', 'R1210', 'R1800', 'R1790'].map(u => player(u)));
  const rating = [1200, 1210, 1800, 1790];
  await Promise.all(ps.map((p, i) => patch(`users/${p.uid}`, { rating: rating[i] })));
  // the two far apart search first: no match at a 600-point gap
  assert.equal((await ps[0].call('findMatch', { queue: 'casual', timer: 180 })).status, 'searching');
  assert.equal((await ps[2].call('findMatch', { queue: 'casual', timer: 180 })).status, 'searching', 'too far apart to pair yet');
  // the close ones arrive: each pairs with its nearest
  const r1 = await ps[1].call('findMatch', { queue: 'casual', timer: 180 });
  const r3 = await ps[3].call('findMatch', { queue: 'casual', timer: 180 });
  const g1 = (await ps[0].call('findMatch', { queue: 'casual', timer: 180 })), g3 = (await ps[2].call('findMatch', { queue: 'casual', timer: 180 }));
  assert.equal(r1.game, g1.game, '1210 meets 1200'); assert.equal(r3.game, g3.game, '1790 meets 1800');
  for (const [p, r] of [[ps[0], g1], [ps[2], g3]]) await p.call('resign', { game: r.game });
  // two far apart: not at first, then yes once they have waited
  const lo = await player('Low'), hi = await player('High');
  await patch(`users/${lo.uid}`, { rating: 1000 }); await patch(`users/${hi.uid}`, { rating: 1600 });
  assert.equal((await lo.call('findMatch', { queue: 'casual', timer: 60 })).status, 'searching');
  assert.equal((await hi.call('findMatch', { queue: 'casual', timer: 60 })).status, 'searching');
  await patch(`queue/casual60/${lo.uid}`, { since: Date.now() - 60000 });   // as if Low had searched for a minute
  const late = await hi.call('findMatch', { queue: 'casual', timer: 60 });
  assert.equal(late.status, 'matched', 'a long wait widens the range');
  await hi.call('resign', { game: late.game });
});

test('matchmaking: Cancel leaves the queue; one queue at a time; a guest or a player without a name cannot search', async () => {
  const p = await player('Ivy');
  assert.equal((await p.call('findMatch', { queue: 'casual', timer: 60 })).status, 'searching');
  assert.ok(await get(`queue/casual60/${p.uid}`));
  assert.equal((await p.call('findMatch', { queue: 'ranked' })).status, 'searching');
  assert.equal(await get(`queue/casual60/${p.uid}`), null, 'searching Ranked left Casual');
  assert.deepEqual(await p.call('cancelSearch', {}), { status: 'cancelled' });
  assert.equal(await get(`queue/ranked/${p.uid}`), null);
  await assert.rejects(p.call('findMatch', { queue: 'casual', timer: 45 }), /timer/, 'casual timers are 30s, 1 min or 3 min');
  const anon = await player(null, { anonymous: true });
  await assert.rejects(anon.call('findMatch', { queue: 'ranked' }), /Log in/);
  const noName = await player(null, { noName: true });
  await assert.rejects(noName.call('findMatch', { queue: 'ranked' }), /username/);
});

/* ===================================== server-run matches ===================================== */
test('a ranked match: all mini-games, one minute a turn, hidden values hidden, moves checked by the server', async () => {
  const a = await player('Joe'), b = await player('Kim');
  const g = await pairUp(a, b);
  const pub = await g.X.read(`games/${g.id}/pub`);
  assert.equal(pub.mode, 'ranked'); assert.equal(pub.timer, 60); assert.equal(pub.status, 'playing');
  const st = JSON.parse(pub.state);
  assert.deepEqual(st.games.slice().sort(), E.TYPES.slice().sort(), 'every mini-game on');
  assert.equal(st.timer.limit, 60);
  assert.ok(st.timer.deadline > Date.now() + 55000, 'the first turn has its full minute');
  // hidden values: the phones cannot read the hidden node, and the public state has none of them
  await denied(g.X.read(`games/${g.id}/sec`), 'reading the hidden values');
  await denied(g.X.read(`games/${g.id}`), 'reading the whole game');
  const outsider = await player('Lou');
  await denied(outsider.read(`games/${g.id}/pub`), 'an outsider reading the game');
  for (const sq of st.squares) {
    const m = sq.mini;
    assert.ok(!('word' in m) || m.type === 'hangman', 'no Wordle word');
    if (m.type === 'hangman') assert.match(m.word, /^_+$/, 'only the Hangman pattern');
    for (const k of ['target', 'hidden', 'treasure', 'code']) assert.ok(!(k in m), `no ${k} in ${m.type}`);
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
  const w = await g.X.call('move', { game: g.id, square: 3, move: 'CRATE' });
  assert.equal(w.ok, true);
  let s3 = await gameState(g.id);
  assert.equal(s3.turn, 'O'); assert.ok(!('word' in s3.squares[3].mini), 'still hidden after a wrong guess');
  assert.deepEqual(s3.squares[3].mini.guesses[0].marks, ['g', 'g', 'g', 'x', 'g']);
  assert.ok(s3.timer.deadline > Date.now() + 55000, 'a fresh minute for the next player (plus the playback)');
  assert.equal((await g.O.call('move', { game: g.id, square: 3, move: 'CRANE' })).ok, true);
  s3 = await gameState(g.id);
  assert.equal(s3.squares[3].owner, 'O'); assert.equal(s3.squares[3].mini.word, 'CRANE', 'revealed once guessed');
  // X wins the match: three in a row
  const fin = await g.X.call('move', { game: g.id, square: 2, move: 2 });
  assert.equal(fin.ok, true);
  await recorded(g.id);
  const done = await g.X.read(`games/${g.id}/pub`);
  assert.equal(done.status, 'over'); assert.equal(done.result.winner, 'X'); assert.equal(done.result.how, 'line');
  assert.deepEqual(done.result.ratings, { X: { before: 1200, after: 1216, delta: 16 }, O: { before: 1200, after: 1184, delta: -16 } }, 'Elo, K = 32');
  assert.deepEqual(await g.O.call('move', { game: g.id, square: 4, move: 0 }), { ok: false, reason: 'over' }, 'no moves after the end');
  const final = JSON.parse(done.final);
  assert.equal(final.winner, 'X'); assert.deepEqual(final.names, { X: g.X.name, O: g.O.name });
  for (const sq of final.squares) if (sq.mini.type === 'wordle') assert.ok(sq.mini.word, 'the final state reveals every word');
  const px = await g.X.read(`users/${g.X.uid}`), po = await g.O.read(`users/${g.O.uid}`);
  assert.deepEqual([px.rating, px.wins, px.losses, px.games], [1216, 1, 0, 1]);
  assert.deepEqual([po.rating, po.wins, po.losses, po.games], [1184, 0, 1, 1]);
  const hx = await g.X.read(`history/${g.X.uid}/${g.id}`), ho = await g.O.read(`history/${g.O.uid}/${g.id}`);
  assert.equal(hx.result, 'win'); assert.equal(ho.result, 'loss');
  assert.equal(hx.mode, 'ranked'); assert.equal(hx.rated, true); assert.equal(hx.how, 'line');
  assert.deepEqual([hx.ratingBefore, hx.ratingAfter, ho.ratingBefore, ho.ratingAfter], [1200, 1216, 1200, 1184]);
  assert.deepEqual(hx.opponent, { uid: g.O.uid, name: g.O.name });
  assert.equal(JSON.parse(hx.final).winner, 'X');
  assert.equal(await g.X.read(`active/${g.X.uid}`), null, 'no longer in a game');
  assert.equal(await get(`leaderboard/${g.X.uid}`), null, 'not on the leaderboard before five ranked games');
  // others can see a player's history and profile
  const peek = await player('Nosy');
  assert.equal((await peek.read(`history/${g.X.uid}/${g.id}`)).result, 'win');
  assert.equal((await peek.read(`users/${g.X.uid}`)).rating, 1216);
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

test('timeouts: the server checks the deadline; with both players away the sweep plays it out, two in a row lose', async () => {
  const a = await player('Ola'), b = await player('Pat');
  const g = await pairUp(a, b);
  assert.deepEqual(await g.O.call('timeout', { game: g.id }), { ok: false, reason: 'early' }, 'not before the deadline');
  assert.deepEqual(await sweep(), { timeouts: 0, finished: 0, deleted: 0 }, 'the sweep leaves games in time alone');
  const expire = async () => { const st = await gameState(g.id); st.timer.deadline = Date.now() - 1000; await patch(`games/${g.id}`, { 'pub/state': JSON.stringify(st), dl: st.timer.deadline }); };
  // both phones are gone: the sweep makes the random move for X...
  await expire();
  assert.equal((await sweep()).timeouts, 1);
  let st = await gameState(g.id);
  assert.equal(st.timer.timeouts.X, 1); assert.equal(st.turn, 'O', 'the turn passed');
  assert.equal(st.recent[st.recent.length - 1].timeout, true, 'marked as a timed-out move');
  // ...then for O, then X runs out again: two in a row for X loses the match
  await expire(); await sweep();
  st = await gameState(g.id);
  if (st.turn === 'O') { await expire(); await sweep(); st = await gameState(g.id); }   // (a Hangman hit or a Pig roll keeps the turn)
  assert.equal(st.turn, 'X');
  await expire();
  assert.equal((await sweep()).timeouts, 1);
  await recorded(g.id);
  const pub = await get(`games/${g.id}/pub`);
  assert.equal(pub.status, 'over'); assert.equal(pub.result.winner, 'O'); assert.equal(pub.result.how, 'timeout');
  assert.equal((await get(`history/${g.X.uid}/${g.id}`)).how, 'timeout');
  assert.equal(pub.result.ratings.X.delta, -16);
  // either phone may also call it, once the deadline has passed
  const c = await player('Quin'), d = await player('Rae');
  const h = await pairUp(c, d, 'casual', 30);
  const s2 = await gameState(h.id); s2.timer.deadline = Date.now() - 1; await patch(`games/${h.id}`, { 'pub/state': JSON.stringify(s2) });
  const r = await h.O.call('timeout', { game: h.id });
  assert.equal(r.ok, true, 'the waiting player\'s phone called time');
  assert.deepEqual(await h.X.call('timeout', { game: h.id }), { ok: false, reason: 'early' }, 'and only once');
  await h.X.call('resign', { game: h.id });
});

test('resigning: the other player wins; ranked ratings change; casual ratings never do', async () => {
  const a = await player('Sam'), b = await player('Tia');
  const g = await pairUp(a, b);
  assert.equal((await g.O.call('resign', { game: g.id })).ok, true);
  await recorded(g.id);
  const pub = await get(`games/${g.id}/pub`);
  assert.equal(pub.result.winner, 'X'); assert.equal(pub.result.how, 'resign');
  assert.equal((await get(`history/${g.O.uid}/${g.id}`)).result, 'loss');
  assert.equal((await get(`history/${g.O.uid}/${g.id}`)).how, 'resign');
  assert.deepEqual(await g.X.call('resign', { game: g.id }), { ok: false, reason: 'over' });
  assert.equal((await get(`users/${g.O.uid}`)).rating, 1184);
  // casual: played to the end, no rating change, no rating in the history
  const c = await player('Uma'), d = await player('Val');
  const h = await pairUp(c, d, 'casual', 60);
  await nearWin(h.id, 'X');
  assert.equal((await h.X.call('move', { game: h.id, square: 2, move: 2 })).ok, true);
  await recorded(h.id);
  const hp = await get(`games/${h.id}/pub`);
  assert.equal(hp.result.winner, 'X'); assert.equal(hp.result.ratings, undefined, 'no rating change');
  for (const p of [h.X, h.O]) {
    const prof = await get(`users/${p.uid}`);
    assert.deepEqual([prof.rating, prof.games, prof.wins, prof.losses], [1200, 0, 0, 0], 'casual leaves rating and ranked record alone');
    const hist = await get(`history/${p.uid}/${h.id}`);
    assert.equal(hist.mode, 'casual'); assert.equal(hist.rated, false); assert.equal(hist.ratingBefore, undefined);
  }
});

test('the leaderboard: a player appears after five ranked games, with rating and record', async () => {
  const star = await player('Star');
  const others = await Promise.all([1, 2, 3, 4, 5].map(k => player('Opp' + k)));
  for (let k = 0; k < 5; k++) {
    const g = await pairUp(star, others[k]);
    if (g.X === star) { await nearWin(g.id, 'X'); assert.equal((await star.call('move', { game: g.id, square: 2, move: 2 })).ok, true); }
    else await others[k].call('resign', { game: g.id });
    await recorded(g.id);
    const entry = await star.read(`leaderboard/${star.uid}`);
    if (k < 4) assert.equal(entry, null, `not listed after ${k + 1} ranked games`);
    else {
      const prof = await get(`users/${star.uid}`);
      assert.deepEqual(entry, { username: 'Star', rating: prof.rating, wins: 5, losses: 0, draws: 0, games: 5 }, 'listed after the fifth');
      assert.ok(prof.rating > 1200 + 60, 'five wins raise the rating');
    }
  }
  // the top of the board, read the way the page reads it
  const top = await star.read('leaderboard');
  assert.ok(top[star.uid]);
  const q = await D.get(D.query(D.ref(star.db, 'leaderboard'), D.orderByChild('rating'), D.limitToLast(100)));
  const list = []; q.forEach(c => { list.push(c.val()); });
  assert.equal(list[list.length - 1].username, 'Star', 'the best rating last in the query (first on screen)');
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
  assert.equal((await get(`users/${host.uid}`)).rating, 1200, 'friend games never change ratings');
  assert.equal(await get(`history/${anon.uid}`), null);
});
