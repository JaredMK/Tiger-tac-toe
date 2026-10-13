'use strict';
// The server on the Firebase Emulator Suite: accounts, matchmaking, server-run matches, records,
// per-mini-game stats and history, and the security rules. (Ratings and the leaderboard are switched off.) Run with:  npm run test:emulators
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
  assert.deepEqual(st.games.slice().sort(), E.TYPES.slice().sort(), 'every mini-game on');
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
    for (const k of ['target', 'hidden', 'ship', 'treasure', 'code']) assert.ok(!(k in m), `no ${k} in ${m.type}`);
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
  assert.equal(JSON.parse(hx.final).winner, 'X');
  assert.equal(await g.X.read(`active/${g.X.uid}`), null, 'no longer in a game');
  assert.equal(await get(`leaderboard/${g.X.uid}`), null, 'no leaderboard while ratings are off');
  // others can see a player's history and profile
  const peek = await player('Nosy');
  assert.equal((await peek.read(`history/${g.X.uid}/${g.id}`)).result, 'win');
  assert.equal((await peek.read(`users/${g.X.uid}`)).wins, 1, 'and their record');
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
  assert.deepEqual(hu.friend, { wins: 1, games: 1 }, 'a win on the host\'s vs-friends record');
  assert.deepEqual(gu.friend, { losses: 1, games: 1 }, 'a loss on the guest\'s');
  assert.deepEqual([hu.wins, hu.games], [0, 0], 'the main record is Find Match games only');
  const sq = E.fullState(end).squares.slice(0, 3).map(q => q.mini.type), counts = {};
  for (const t of sq) counts[t] = (counts[t] || 0) + 1;
  for (const [t, n] of Object.entries(counts)) { assert.equal(hu.minis[t].won, n, `host won ${n} ${t}`); assert.equal(gu.minis[t].lost, n); }
  assert.equal(await get(`history/${anon.uid}`), null);
});

/* ===================================== game stats ===================================== */
const S = require('../functions/statsRules.js');
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
  const script = (...args) => new Promise((resolve, reject) => execFile(process.execPath, [path.join(__dirname, '..', 'scripts', 'make-admin.js'), ...args],
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
  const rec = E.newOnlineMatch({ names: { X: 'SeatGuest', O: 'SeatHost' } }, E.makeRng(4), 'seat1');
  const full = E.fullState(rec);
  full.squares[0].owner = 'X'; full.squares[4].owner = 'X'; full.squares[8].owner = 'X'; full.winner = 'X'; full.winLine = [0, 4, 8]; full.winReason = 'line';
  const end = E.matchRecord(full);
  await host.write(`rooms/${code}/status`, 'playing');
  await guest.write(`rooms/${code}/match`, { state: JSON.stringify(end.state), secrets: JSON.stringify(end.secrets), seats });
  const id = 'f_' + code + '_seat1';
  const gh = await until(() => guest.read(`history/${guest.uid}/${id}`), 10000, 'the guest\'s history');
  assert.equal(gh.side, 'X'); assert.equal(gh.result, 'win', 'the guest played X and won');
  assert.equal((await host.read(`history/${host.uid}/${id}`)).result, 'loss');
  assert.deepEqual((await get(`users/${guest.uid}`)).friend, { wins: 1, games: 1 });
  assert.deepEqual((await get(`users/${host.uid}`)).friend, { losses: 1, games: 1 });
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
  assert.deepEqual((await get(`users/${guest.uid}`)).friend, { losses: 1, games: 1 }, 'a loss on the leaver\'s record');
  assert.deepEqual((await get(`users/${host.uid}`)).friend, { wins: 1, games: 1 });
});

test('usernames already taken are checked against the word list once: the ones that fail are listed for the admin, none changed', async () => {
  const boss = await player('ReviewBoss'), other = await player('Bystander');
  await put('users/legacy1', { username: 'Sh1tHead', joined: 1 });
  await put('users/legacy2', { username: 'Grape_Fan', joined: 1 });
  await put('meta/nameCheck', null);
  const run = (file, ...args) => new Promise((resolve, reject) => execFile(process.execPath, [path.join(__dirname, '..', 'scripts', file), ...args],
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
  const run = (...args) => new Promise((resolve, reject) => execFile(process.execPath, [path.join(__dirname, '..', 'scripts', 'backfill-records.js'), ...args],
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
