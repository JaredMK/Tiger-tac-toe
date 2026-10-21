'use strict';
// Super Chaos in a friend room, two clients on the Realtime Database emulator (npm test): the record is the
// round's one truth. Each client is the Firebase SDK signed in as its own player, under the security rules,
// with a listener on the room as the app keeps, and each move goes in as the app sends it (core/records.js
// matchTxn with applyChaosSubmit, in a transaction). Two rounds; a second move from the same side in a round
// (refused, the record untouched); a move from someone not in the room (refused by the rules); a timeout
// round (the deadline settles it with the rule's move for the side not in); both clients see every round.
// The emulator: the one the Firebase Emulator Suite runs (npm run test:emulators), else the database
// emulator's jar from firebase-tools' cache, started here (needs Java). Without either, the test is skipped
// and says so.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { spawn, spawnSync } = require('node:child_process');

const E = require('../engine.js');
const { initializeApp, deleteApp } = require('firebase/app');
const D = require('firebase/database');

const ROOT = path.join(__dirname, '..', '..');
const T0 = Date.now();
const wait = ms => new Promise(r => setTimeout(r, ms));
async function until(fn, ms = 10000, what = 'condition') {
  const t0 = Date.now();
  for (;;) { const v = await fn(); if (v) return v; if (Date.now() - t0 > ms) throw new Error('timed out waiting for ' + what); await wait(100); }
}
// ---------- the emulator: the suite's, or the jar started here ----------
function emulatorJar() {
  if (process.env.FIREBASE_DATABASE_EMULATOR_JAR && fs.existsSync(process.env.FIREBASE_DATABASE_EMULATOR_JAR)) return process.env.FIREBASE_DATABASE_EMULATOR_JAR;
  const dir = path.join(os.homedir(), '.cache', 'firebase', 'emulators');
  if (!fs.existsSync(dir)) return null;
  const jars = fs.readdirSync(dir).filter(f => /^firebase-database-emulator.*\.jar$/.test(f)).sort();
  return jars.length ? path.join(dir, jars[jars.length - 1]) : null;
}
const hasJava = () => { try { return spawnSync('java', ['-version'], { stdio: 'ignore' }).status === 0; } catch (e) { return false; } };
const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); }); s.on('error', rej); });
const suite = process.env.FIREBASE_DATABASE_EMULATOR_HOST || null;   // the Emulator Suite's database (its rules loaded by firebase-tools)
const jar = suite ? null : emulatorJar();
if (!suite && !(jar && hasJava())) {
  test(`Super Chaos online on the database emulator (skipped: ${jar ? 'Java is not installed' : 'no database emulator jar in ~/.cache/firebase/emulators (firebase setup:emulators:database)'})`, { skip: true }, () => {});
  return;
}
const PROJECT = suite ? 'demo-tic-tac-chaos' : 'ttc-sc-test', NS = `${PROJECT}-default-rtdb`;
let HOST = '127.0.0.1', PORT = 0, proc = null;
async function owner(method, p, body) {
  const r = await fetch(`http://${HOST}:${PORT}${p}${p.includes('?') ? '&' : '?'}ns=${NS}`, { method, headers: { Authorization: 'Bearer owner', 'content-type': 'application/json' }, body });
  if (!r.ok) throw new Error(`${method} ${p}: ${r.status} ${await r.text()}`);
  return r.text();
}
test.before(async () => {
  if (suite) { [HOST, PORT] = [suite.split(':')[0], Number(suite.split(':')[1])]; }
  else {
    PORT = await freePort();
    proc = spawn('java', ['-jar', jar, '--host', HOST, '--port', String(PORT), '--single_project_mode', 'Warning'], { stdio: 'ignore' });
    await until(() => fetch(`http://${HOST}:${PORT}/.json?ns=${NS}`).then(() => true, () => false), 30000, 'the database emulator');
    await owner('PUT', '/.settings/rules.json', fs.readFileSync(path.join(ROOT, 'database.rules.json')));   // the live rules
  }
  await owner('PUT', '/releases/superchaos.json', 'true');       // Super Chaos released: a room may have it on
});
test.after(async () => {
  for (const c of clients) await deleteApp(c.app).catch(() => {});
  if (proc) proc.kill();
});
// ---------- a client: the SDK as one player, a listener on the room, moves sent as the app sends them ----------
const clients = [];
let n = 0;
function client(uid) {
  const app = initializeApp({ apiKey: 'test', projectId: PROJECT, databaseURL: `https://${NS}.firebaseio.com`, appId: '1:1:web:1' }, 'c' + (++n));
  const db = D.getDatabase(app);
  D.connectDatabaseEmulator(db, HOST, PORT, { mockUserToken: { sub: uid, user_id: uid } });
  const c = { app, db, uid, room: null, seen: [] };
  c.follow = code => D.onValue(D.ref(db, `rooms/${code}`), s => { c.room = s.val(); const rec = E.parseMatch(c.room && c.room.match); if (rec) c.seen.push({ seq: rec.state.seq, round: rec.state.sc.round, recap: !!rec.state.sc.recap, moves: Object.keys(rec.state.sc.moves || {}).sort().join('') }); });
  c.rec = () => E.parseMatch(c.room && c.room.match);
  c.write = (p, v) => D.set(D.ref(db, p), v);
  c.read = async p => (await D.get(D.ref(db, p))).val();
  // a change to the match as the app makes it (net/moves.js matchTransaction): { committed, reason }
  c.txn = async (code, fn) => { let reason = null; const res = await D.runTransaction(D.ref(db, `rooms/${code}/match`), E.matchTxn(rec => { const r = fn(rec); if (!r.ok) { reason = r.reason; return null; } return r.rec; }), { applyLocally: false }); return { committed: res.committed, reason }; };
  clients.push(c);
  return c;
}
// This player's move for the round, made on their own copy of the record (as the phone plays it: core/chaos.js chaosPlay)
function moveOf(rec, me, i, moves) {
  const st = E.fullState(rec);
  st.online = { role: me === 'X' ? 'host' : 'guest', code: 'SCEMU', me };
  st.sc = Object.assign(JSON.parse(JSON.stringify(rec.state.sc)), { me: null, moved: null, start: null, steps: null, recap: null });
  st.turn = me; st.lock = null;
  for (const m of moves) { const r = E.playMove(st, i, m, E.makeRng('p' + me + i)); assert.ok(r.ok, JSON.stringify(r)); st.flash = null; }
  assert.ok(st.sc.me, 'the move is in on this phone');
  return Object.assign(E.scMoveOf(st, me), { at: Date.now() });
}
const submit = (c, code, side, mv) => c.txn(code, rec => E.applyChaosSubmit(rec, side, mv, E.makeRng('s' + side), Date.now(), 0));
const wordle = word => ({ type: 'wordle', word, guesses: [] }), hilo = target => ({ type: 'hilo', target, lo: 1, hi: 30, guesses: [] });

test('Super Chaos online, two clients on the emulator: one move a side a round, the rest refused; the round settles for both; a timeout round', async () => {
  const code = 'SCEMU';
  const host = client('uid-host-sc'), guest = client('uid-guest-sc'), stranger = client('uid-stranger-sc');
  // the room as the app makes it: the host opens it, the guest takes the free seat, the host starts a Super Chaos match
  await host.write(`rooms/${code}`, { created: Date.now(), host: host.uid, status: 'lobby', players: { X: { uid: host.uid, name: 'Hosty', joined: Date.now() } }, setup: { hostSide: 'X', timer: 0, chaos: true } });
  await guest.write(`rooms/${code}/players/O`, { uid: guest.uid, name: 'Guesty', joined: Date.now() });
  host.follow(code); guest.follow(code); stranger.follow(code);   // (anyone signed in may read a room; only its players may write it)
  const games = Object.fromEntries(E.TYPES.map(t => [t, t === 'wordle' || t === 'hilo']));
  const fresh = E.newOnlineMatch({ names: { X: 'Hosty', O: 'Guesty' }, games, timer: 0, chaos: true }, E.makeRng('sc-emu'), 'm1', Date.now());   // (server time: the emulator runs on this clock)
  assert.ok(fresh && fresh.state.sc && fresh.state.sc.online, 'a Super Chaos match');
  const full = E.fullState(fresh); full.sc = JSON.parse(JSON.stringify(fresh.state.sc));
  full.squares = [{ owner: null, mini: wordle('CRANE') }, { owner: null, mini: hilo(20) }, { owner: null, mini: wordle('SLATE') }].concat(Array.from({ length: 6 }, (_, k) => ({ owner: null, mini: hilo(10 + k) }))).map(q => Object.assign(q, { mv: { X: 0, O: 0 } }));
  await host.write(`rooms/${code}/status`, 'playing');
  await host.write(`rooms/${code}/match`, E.packMatch(E.matchRecord(full)));
  for (const c of [host, guest, stranger]) await until(() => c.rec() && c.rec().state.sc.round === 1, 10000, 'every client sees round 1');
  assert.equal(typeof host.rec().state.sc.deadline, 'number', "the record carries round 1's deadline");
  assert.equal(guest.rec().state.squares[0].mini.word, undefined, 'the word stays in the secrets');

  // ---- round 1: X's move goes in; X's second move is refused and changes nothing; a stranger's is refused by the rules; O's settles the round ----
  const mx = moveOf(host.rec(), 'X', 0, ['CRANE']);
  assert.deepEqual(await submit(host, code, 'X', mx), { committed: true, reason: null });
  await until(() => host.rec() && host.rec().state.sc.moves && host.rec().state.sc.moves.X, 10000, "X's move on the record");
  const seq1 = host.rec().state.seq;
  assert.deepEqual(await submit(host, code, 'X', moveOf(host.rec(), 'X', 1, [10])), { committed: false, reason: 'moved' }, 'a second move the same round: refused');
  assert.deepEqual(await submit(host, code, 'X', mx), { committed: false, reason: 'moved' }, 'the same move sent twice: refused');
  await assert.rejects(submit(stranger, code, 'O', moveOf(host.rec(), 'O', 1, [10])), e => /permission[_ ]denied/i.test(String(e.code || e.message)), "someone not in the room: refused by the rules");
  await wait(300);
  assert.equal(host.rec().state.seq, seq1, 'nothing changed on the record');
  assert.deepEqual(Object.keys(host.rec().state.sc.moves), ['X']);
  await until(() => guest.rec() && guest.rec().state.sc.moves && guest.rec().state.sc.moves.X, 10000, "the guest sees X's move is in");
  const mo = moveOf(guest.rec(), 'O', 1, [10]);
  assert.deepEqual(await submit(guest, code, 'O', mo), { committed: true, reason: null });
  for (const c of [host, guest]) await until(() => c.rec() && c.rec().state.sc.recap && c.rec().state.sc.recap.round === 1, 10000, 'both see round 1 settled');
  const rc1 = host.rec().state;
  assert.equal(rc1.squares[0].owner, 'X', 'X takes the Wordle square');
  assert.deepEqual([rc1.sc.round, rc1.sc.deadline, rc1.sc.moves], [2, null, {}], 'round 2 on the record, not begun until a recap is over');
  assert.deepEqual([rc1.sc.recap.mv.X.square, rc1.sc.recap.mv.O.square], [0, 1], 'both moves kept for the replays');
  assert.deepEqual(JSON.stringify(guest.rec().state), JSON.stringify(rc1), 'both clients hold the same record');
  assert.deepEqual(await submit(guest, code, 'O', Object.assign({}, mo, { round: 2 })), { committed: false, reason: 'recap' }, 'no move until the next round has begun');
  // the first client through the recap begins round 2; the other finds it begun
  assert.deepEqual(await guest.txn(code, rec => E.applyChaosBegin(rec, Date.now())), { committed: true, reason: null });
  assert.deepEqual(await host.txn(code, rec => E.applyChaosBegin(rec, Date.now())), { committed: false, reason: 'begun' });
  for (const c of [host, guest]) await until(() => c.rec() && c.rec().state.sc.round === 2 && c.rec().state.sc.deadline != null, 10000, 'both see round 2 begun');

  // ---- round 2: O first this time, then X; settled again ----
  assert.deepEqual(await submit(guest, code, 'O', moveOf(guest.rec(), 'O', 2, ['SLATE'])), { committed: true, reason: null });
  await until(() => host.rec() && host.rec().state.sc.moves && host.rec().state.sc.moves.O, 10000, "the host sees O's move is in");
  assert.deepEqual(await submit(guest, code, 'O', moveOf(guest.rec(), 'O', 3, [10])), { committed: false, reason: 'moved' });
  assert.deepEqual(await submit(host, code, 'X', moveOf(host.rec(), 'X', 3, [5])), { committed: true, reason: null });   // (square 3's number is 10: a guess, not a win)
  for (const c of [host, guest]) await until(() => c.rec() && c.rec().state.sc.recap && c.rec().state.sc.recap.round === 2, 10000, 'both see round 2 settled');
  assert.equal(host.rec().state.squares[2].owner, 'O', 'O takes the second Wordle square');
  assert.equal(host.rec().state.squares[3].mini.guesses.length, 1, "X's guess is on the board");
  assert.deepEqual(await host.txn(code, rec => E.applyChaosBegin(rec, Date.now())), { committed: true, reason: null });
  for (const c of [host, guest]) await until(() => c.rec() && c.rec().state.sc.round === 3 && c.rec().state.sc.deadline != null, 10000, 'both see round 3 begun');

  // ---- round 3, a timeout: X moves, O does not; the deadline (plus the grace) settles the round with the rule's move for O ----
  assert.deepEqual(await submit(host, code, 'X', moveOf(host.rec(), 'X', 4, [11])), { committed: true, reason: null });   // (square 4's number: a win)
  await until(() => host.rec() && host.rec().state.sc.moves && host.rec().state.sc.moves.X, 10000, "X's move on the record");
  const dl = host.rec().state.sc.deadline;
  assert.deepEqual(await host.txn(code, rec => E.applyChaosDeadline(rec, dl + E.SC_ONLINE.graceMs - 1, E.makeRng('d'))), { committed: false, reason: 'early' }, 'not before the grace is past');
  assert.deepEqual(await host.txn(code, rec => E.applyChaosDeadline(rec, dl + E.SC_ONLINE.graceMs + 1, E.makeRng('d'))), { committed: true, reason: null });
  for (const c of [host, guest]) await until(() => c.rec() && c.rec().state.sc.recap && c.rec().state.sc.recap.round === 3, 10000, 'both see round 3 settled');
  const rc3 = guest.rec().state;
  assert.equal(rc3.squares[4].owner, 'X', "X's guess took its square");
  assert.equal(rc3.sc.recap.mv.O.auto, true, "the rule's move stood for O");
  assert.deepEqual(await host.txn(code, rec => E.applyChaosDeadline(rec, dl + 99999, E.makeRng('d'))), { committed: false, reason: 'recap' }, 'settled once');
  assert.deepEqual(await submit(guest, code, 'O', moveOf(guest.rec(), 'O', 5, [10])), { committed: false, reason: 'recap' }, "O's late move: the round is settled");
  // every record both clients saw, in order: the same sequence of rounds on both
  const seen = c => c.seen.filter((s, k, l) => !k || s.seq !== l[k - 1].seq).map(s => `${s.round}${s.recap ? 'r' : ''}:${s.moves}`);
  assert.deepEqual(seen(host).slice(-4), seen(guest).slice(-4), `both clients followed the same rounds (host ${seen(host)}; guest ${seen(guest)})`);
});
