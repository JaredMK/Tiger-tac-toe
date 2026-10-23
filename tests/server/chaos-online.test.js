'use strict';
// Super Chaos in a friend room, two clients on the Realtime Database emulator (npm test): the record is the
// round's one truth. Each client is the Firebase SDK signed in as its own player, under the security rules,
// with a listener on the room as the app keeps, and each move goes in as the app sends it (core/records.js
// matchTxn with applyChaosSubmit, in a transaction). Two rounds; a second move from the same side in a round
// (refused, the record untouched); a move from someone not in the room (refused by the rules); the next round
// once both clients are through the recap; a timeout round (the side not in misses it); both clients see every round.
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
  // round 2 begins once both clients are through the recap: the first waits for the other
  assert.deepEqual(await guest.txn(code, rec => E.applyChaosBegin(rec, Date.now(), 'O')), { committed: true, reason: null });
  await until(() => host.rec() && host.rec().state.sc.ready && host.rec().state.sc.ready.O, 10000, 'the host sees O through');
  assert.equal(host.rec().state.sc.deadline, null, 'not begun with one through');
  assert.deepEqual(await guest.txn(code, rec => E.applyChaosBegin(rec, Date.now(), 'O')), { committed: false, reason: 'waiting' }, 'said again: nothing written');
  assert.deepEqual(await host.txn(code, rec => E.applyChaosBegin(rec, Date.now(), 'X')), { committed: true, reason: null });
  assert.deepEqual(await host.txn(code, rec => E.applyChaosBegin(rec, Date.now(), 'X')), { committed: false, reason: 'begun' });
  for (const c of [host, guest]) await until(() => c.rec() && c.rec().state.sc.round === 2 && c.rec().state.sc.deadline != null, 10000, 'both see round 2 begun');

  // ---- round 2: O first this time, then X; settled again ----
  assert.deepEqual(await submit(guest, code, 'O', moveOf(guest.rec(), 'O', 2, ['SLATE'])), { committed: true, reason: null });
  await until(() => host.rec() && host.rec().state.sc.moves && host.rec().state.sc.moves.O, 10000, "the host sees O's move is in");
  assert.deepEqual(await submit(guest, code, 'O', moveOf(guest.rec(), 'O', 3, [10])), { committed: false, reason: 'moved' });
  assert.deepEqual(await submit(host, code, 'X', moveOf(host.rec(), 'X', 3, [5])), { committed: true, reason: null });   // (square 3's number is 10: a guess, not a win)
  for (const c of [host, guest]) await until(() => c.rec() && c.rec().state.sc.recap && c.rec().state.sc.recap.round === 2, 10000, 'both see round 2 settled');
  assert.equal(host.rec().state.squares[2].owner, 'O', 'O takes the second Wordle square');
  assert.equal(host.rec().state.squares[3].mini.guesses.length, 1, "X's guess is on the board");
  assert.deepEqual(await host.txn(code, rec => E.applyChaosBegin(rec, Date.now(), 'X')), { committed: true, reason: null });
  await until(() => guest.rec() && guest.rec().state.sc.ready && guest.rec().state.sc.ready.X, 10000, 'the guest sees X through');
  assert.deepEqual(await guest.txn(code, rec => E.applyChaosBegin(rec, Date.now(), 'O')), { committed: true, reason: null });
  for (const c of [host, guest]) await until(() => c.rec() && c.rec().state.sc.round === 3 && c.rec().state.sc.deadline != null, 10000, 'both see round 3 begun');

  // ---- round 3, a timeout: X moves, O does not; the deadline (plus the grace) settles the round; O missed it, nothing played for O ----
  assert.deepEqual(await submit(host, code, 'X', moveOf(host.rec(), 'X', 4, [11])), { committed: true, reason: null });   // (square 4's number: a win)
  await until(() => host.rec() && host.rec().state.sc.moves && host.rec().state.sc.moves.X, 10000, "X's move on the record");
  const dl = host.rec().state.sc.deadline;
  assert.deepEqual(await host.txn(code, rec => E.applyChaosDeadline(rec, dl + E.SC_ONLINE.graceMs - 1, E.makeRng('d'))), { committed: false, reason: 'early' }, 'not before the grace is past');
  assert.deepEqual(await host.txn(code, rec => E.applyChaosDeadline(rec, dl + E.SC_ONLINE.graceMs + 1, E.makeRng('d'))), { committed: true, reason: null });
  for (const c of [host, guest]) await until(() => c.rec() && c.rec().state.sc.recap && c.rec().state.sc.recap.round === 3, 10000, 'both see round 3 settled');
  const rc3 = guest.rec().state;
  assert.equal(rc3.squares[4].owner, 'X', "X's guess took its square");
  assert.deepEqual([rc3.sc.recap.mv.O, rc3.sc.recap.missed, rc3.sc.miss], [null, ['O'], { X: 0, O: 1 }], 'O missed the round: no move played for O');
  assert.deepEqual(await host.txn(code, rec => E.applyChaosDeadline(rec, dl + 99999, E.makeRng('d'))), { committed: false, reason: 'recap' }, 'settled once');
  assert.deepEqual(await submit(guest, code, 'O', moveOf(guest.rec(), 'O', 5, [10])), { committed: false, reason: 'recap' }, "O's late move: the round is settled");
  // every record both clients saw, in order: the same sequence of rounds on both
  const seen = c => c.seen.filter((s, k, l) => !k || s.seq !== l[k - 1].seq).map(s => `${s.round}${s.recap ? 'r' : ''}:${s.moves}`);
  assert.deepEqual(seen(host).slice(-4), seen(guest).slice(-4), `both clients followed the same rounds (host ${seen(host)}; guest ${seen(guest)})`);
});

// Each player's own outcome first (core/chaos.js scRecapOrder, as ui/chaos.js plays a settled round): a Mini Golf
// shot locked in plays out on its player's phone before the other's replay; both at one hole, both shots play
// together and neither phone replays the other's; both walking their dogs in one Sniff square, likewise.
test('Super Chaos online, two clients on the emulator: each phone shows its own outcome first, then the other\'s replay; one square both played shows them together, no replay', async () => {
  E.setPhysics(require('../physics.js'));
  for (const t of ['golf', 'sniff']) await owner('PUT', `/releases/${t}.json`, 'true');   // (released: the server's check takes a room's match off it when it holds a game its host may not deal)
  const code = 'SCGLF';
  const host = client('uid-host-glf'), guest = client('uid-guest-glf');
  await host.write(`rooms/${code}`, { created: Date.now(), host: host.uid, status: 'lobby', players: { X: { uid: host.uid, name: 'Hosty', joined: Date.now() } }, setup: { hostSide: 'X', timer: 0, chaos: true } });
  await guest.write(`rooms/${code}/players/O`, { uid: guest.uid, name: 'Guesty', joined: Date.now() });
  host.follow(code); guest.follow(code);
  const fresh = E.newOnlineMatch({ names: { X: 'Hosty', O: 'Guesty' }, games: Object.fromEntries(E.TYPES.map(t => [t, t === 'hilo'])), timer: 0, chaos: true }, E.makeRng('sc-glf'), 'g1', Date.now());
  const full = E.fullState(fresh); full.sc = JSON.parse(JSON.stringify(fresh.state.sc));
  const golf = E.newMini('golf', E.makeRng('glf')), sniff = Object.assign(E.sniffScCreate('sniff', E.makeRng('snf')), { treasure: 8 });
  full.squares = Array.from({ length: 9 }, (_, i) => ({ owner: null, mini: i === 6 ? golf : i === 2 ? sniff : hilo(10 + i), mv: { X: 0, O: 0 } }));
  await host.write(`rooms/${code}/status`, 'playing');
  await host.write(`rooms/${code}/match`, E.packMatch(E.matchRecord(full)));
  for (const c of [host, guest]) await until(() => c.rec(), 10000, 'the match on both clients');
  // a round: X's move and O's go in from each phone; once settled, the order each phone plays it in
  async function round(r, mx, mo) {
    for (const c of [host, guest]) await until(() => c.rec() && c.rec().state.sc.round === r && c.rec().state.sc.deadline != null, 10000, `round ${r} on both`);
    assert.deepEqual(await submit(host, code, 'X', moveOf(host.rec(), 'X', ...mx)), { committed: true, reason: null });
    await until(() => guest.rec().state.sc.moves && guest.rec().state.sc.moves.X, 10000, "X's move on the guest's client");
    assert.deepEqual(await submit(guest, code, 'O', moveOf(guest.rec(), 'O', ...mo)), { committed: true, reason: null });
    const order = {};
    for (const [c, side] of [[host, 'X'], [guest, 'O']]) {
      const rc = (await until(() => { const v = c.rec(); return v && v.state.sc.recap && v.state.sc.recap.round === r ? v.state.sc.recap : null; }, 10000, `round ${r} settled on ${side}'s client`));
      order[side] = E.scRecapOrder(rc, rc.mv[side].square, rc.mv[side === 'X' ? 'O' : 'X']).map(o => o.kind + ':' + o.square + (o.own ? ':own' : ''));
    }
    assert.deepEqual(await guest.txn(code, rec => E.applyChaosBegin(rec, Date.now(), 'O')), { committed: true, reason: null });
    await until(() => host.rec().state.sc.ready && host.rec().state.sc.ready.O, 10000, 'the host sees O through the recap');
    assert.deepEqual(await host.txn(code, rec => E.applyChaosBegin(rec, Date.now(), 'X')), { committed: true, reason: null });
    return order;
  }
  // 1. the host shoots at the Mini Golf hole, the guest guesses elsewhere: the host's shot first on the host's phone, then the guest's replay; the guest sees the host's square lit, then the shot
  const o1 = await round(1, [6, [{ aim: 0.05, power: 0.55 }]], [1, [15]]);
  assert.deepEqual(o1.X, ['replay:6:own', 'spot:1', 'popup:1'], "the host: its own shot, then the guest's move");
  assert.deepEqual(o1.O, ['spot:6', 'replay:6'], "the guest (its own guess shown as it made it): the host's square, then the shot");
  // 2. both shoot at the same hole: both shots play together on each phone, and neither replays the other's
  const o2 = await round(2, [6, [{ aim: 0.05, power: 0.55 }]], [6, [{ aim: 3.1, power: 0.4 }]]);
  assert.deepEqual([o2.X, o2.O], [['replay:6:own'], ['replay:6:own']]);
  // 3. both walk their dogs in the Sniff square: both steps together on each phone, no replay
  const o3 = await round(3, [2, ['NW']], [2, ['SE']]);
  assert.deepEqual([o3.X, o3.O], [['resolve:2:own'], ['resolve:2:own']]);
  const rc3 = host.rec().state.sc.recap;
  assert.deepEqual([rc3.resolve[0].joint, rc3.resolve[0].flash.scr.steps.X.t, rc3.resolve[0].flash.scr.steps.O.t], [true, 16, 32], 'both steps, from where the round began');
  // 4. both spin in the same Risk Wheels square (each their own progress, nothing settled jointly): each phone still replays the other's spin, its steps on the record
  await host.txn(code, rec => { const f = E.fullState(rec); f.squares[4] = { owner: null, mini: E.newMini('wheels', E.makeRng('whl')), mv: { X: 0, O: 0 } }; return { ok: true, rec: E.matchRecord(f) }; });
  for (const c of [host, guest]) await until(() => c.rec() && c.rec().state.squares[4].mini.type === 'wheels', 10000, 'the Risk Wheels square on both');
  const o4 = await round(4, [4, ['high']], [4, ['low']]);
  assert.deepEqual([o4.X, o4.O], [['spot:4', 'popup:4'], ['spot:4', 'popup:4']], 'one square, each their own progress: each sees the other\'s replay');
  const rc4 = host.rec().state.sc.recap;
  for (const side of ['X', 'O']) assert.ok(rc4.mv[side].steps.length === 1 && rc4.mv[side].steps[0].type === 'wheels' && rc4.mv[side].start, `${side}'s spin kept for the other's replay`);
  // 5-7. Bump: a spin plays at once on the spinner's own phone (its step on the record is the other phone's replay); the round's end settles the knocks
  const bumpAt = async (X, O) => {
    await host.txn(code, rec => { const f = E.fullState(rec); const mini = { type: 'bump', pos: { X, O }, last: null }; f.squares[5] = { owner: null, mini, mv: { X: 0, O: 0 } }; if (Array.isArray(f.sc.base)) f.sc.base[5] = JSON.parse(JSON.stringify(mini)); return { ok: true, rec: E.matchRecord(f) }; });   // (the square, and the round's own start of it)
    for (const c of [host, guest]) await until(() => { const q = c.rec() && c.rec().state.squares[5].mini; return q && q.type === 'bump' && q.pos.X === X && q.pos.O === O; }, 10000, 'the Bump square on both');
  };
  // 5. the opponent elsewhere: X spins from 2 (nothing to settle at the round's end); O guesses in Higher/Lower; each phone replays the other's move
  await bumpAt(2, 7);
  const sX = moveOf(host.rec(), 'X', 5, ['spin']).mini.last.spin, sO = moveOf(guest.rec(), 'O', 5, ['spin']).mini.last.spin;   // (each side's spin: its own stream of draws)
  assert.ok(sX >= 1 && sX <= 3 && sO >= 1 && sO <= 3);
  const o5 = await round(5, [5, ['spin']], [1, [12]]);
  const rc5 = host.rec().state.sc.recap;
  assert.deepEqual([o5.X, o5.O], [['spot:1', 'popup:1'], ['spot:5', 'popup:5']], "the opponent elsewhere: each phone's own move as it made it, then the other's replay");
  assert.deepEqual([rc5.mv.X.steps.length, rc5.mv.X.steps[0].type, rc5.mv.X.steps[0].from, rc5.mv.X.steps[0].to, rc5.mv.X.steps[0].spin], [1, 'bump', 2, 2 + sX, sX], "X's spin on the record: the step O's phone replays (the piece hopping from 2)");
  assert.deepEqual([rc5.resolve, host.rec().state.squares[5].mini.pos], [[], { X: 2 + sX, O: 7 }], 'nothing to settle together; the piece where the spin took it');
  // 6. both spin in the Bump square and nobody is bumped: both pieces hop together on each phone, from where the round began; no replay after
  await bumpAt(0, 5);
  const o6 = await round(6, [5, ['spin']], [5, ['spin']]);
  const rc6 = host.rec().state.sc.recap;
  assert.deepEqual([o6.X, o6.O], [['resolve:5:own'], ['resolve:5:own']], 'both in one Bump square: the joint resolution in each player\'s own view, no replay');
  assert.deepEqual([rc6.resolve[0].joint, rc6.resolve[0].flash.scr.knocked, rc6.resolve[0].flash.scr.moves, rc6.pre[5].pos], [true, [], { X: { from: 0, to: sX, spin: sX }, O: { from: 5, to: 5 + sO, spin: sO } }, { X: 0, O: 5 }], 'both spins, played from where the round began');
  assert.deepEqual(host.rec().state.squares[5].mini.pos, { X: sX, O: 5 + sO }, 'the board settles to the final positions');
  assert.deepEqual(guest.rec().state.squares[5].mini.pos, { X: sX, O: 5 + sO });
  // 7. both spin and land on the same space: both pieces hop together, then both go home
  await bumpAt(4, 4 + sX - sO);
  const o7 = await round(7, [5, ['spin']], [5, ['spin']]);
  const rc7 = host.rec().state.sc.recap;
  assert.deepEqual([o7.X, o7.O], [['resolve:5:own'], ['resolve:5:own']]);
  assert.deepEqual([rc7.resolve[0].joint, rc7.resolve[0].flash.scr.knocked, rc7.resolve[0].flash.scr.at, rc7.pre[5].pos], [true, ['X', 'O'], { X: 4 + sX, O: 4 + sX }, { X: 4, O: 4 + sX - sO }], 'the same space: both knocked, from where they landed');
  for (const c of [host, guest]) assert.deepEqual(c.rec().state.squares[5].mini.pos, { X: 0, O: 0 }, 'both home on both phones');
});

// The match log of a two-phone test (room ACVJL, round 9): X's move went in; O's phone finished its move and showed
// "Waiting for…" while its send sat on a connection that was dead without the SDK knowing (it gave up only 40 s
// later: 'disconnect'); nothing on either phone read the record afresh meanwhile. The record is the one truth: a
// phone waiting more than a few seconds reads it again past its connection (net/chaos.js scResync; core/records.js
// scResyncPlan says what to do), a send unconfirmed that long is sent again, and the server settles a round at its
// deadline whatever either phone believes (functions/index.js roomTick, and the sweep: applyRoomSweep).
test('Super Chaos online, two clients: a move sent on a dead connection never reaches the record; the fresh read says send it again, the late copy is refused, both see the round settled; a round nobody settles, the server settles at its deadline', async () => {
  const code = 'SCDLK';
  const host = client('uid-host-dlk'), guest = client('uid-guest-dlk');
  await host.write(`rooms/${code}`, { created: Date.now(), host: host.uid, status: 'lobby', players: { X: { uid: host.uid, name: 'Hosty', joined: Date.now() } }, setup: { hostSide: 'X', timer: 0, chaos: true } });
  await guest.write(`rooms/${code}/players/O`, { uid: guest.uid, name: 'Guesty', joined: Date.now() });
  host.follow(code); guest.follow(code);
  const fresh = E.newOnlineMatch({ names: { X: 'Hosty', O: 'Guesty' }, games: Object.fromEntries(E.TYPES.map(t => [t, t === 'hilo'])), timer: 0, chaos: true }, E.makeRng('sc-dlk'), 'd1', Date.now());
  const full = E.fullState(fresh); full.sc = JSON.parse(JSON.stringify(fresh.state.sc));
  full.squares = Array.from({ length: 9 }, (_, i) => ({ owner: null, mini: hilo(10 + i), mv: { X: 0, O: 0 } }));
  await host.write(`rooms/${code}/status`, 'playing');
  await host.write(`rooms/${code}/match`, E.packMatch(E.matchRecord(full)));
  for (const c of [host, guest]) await until(() => c.rec() && c.rec().state.sc.round === 1 && c.rec().state.sc.deadline != null, 10000, 'round 1 on both');
  // ---- round 1: X's move goes in; O's phone makes its move and sends it on a dead line (the client offline: the send waits, the record never sees it); O's phone shows "Waiting for…", so does X's ----
  assert.deepEqual(await submit(host, code, 'X', moveOf(host.rec(), 'X', 0, [10])), { committed: true, reason: null });
  await until(() => guest.rec() && guest.rec().state.sc.moves && guest.rec().state.sc.moves.X, 10000, "the guest sees X's move is in");
  const mo = moveOf(guest.rec(), 'O', 1, [11]);
  D.goOffline(guest.db);
  const late = submit(guest, code, 'O', mo).catch(e => ({ committed: false, reason: String(e.message) }));   // (pending, on the dead line)
  await wait(700);
  assert.deepEqual(Object.keys(host.rec().state.sc.moves), ['X'], "O's move never reached the record");
  // O's phone, waiting 5 s: the record read afresh past the dead line (here: another connection of O's own); its move is not there: sent again
  const guest2 = client(guest.uid);
  guest2.follow(code);
  await until(() => guest2.rec() && guest2.rec().state.sc.moves && guest2.rec().state.sc.moves.X, 10000, 'the fresh read');
  const loc = { online: true, round: 1, me: { square: 1 }, sent: 1 };
  assert.deepEqual(E.scResyncPlan(loc, 'O', guest.rec(), guest2.rec()), { apply: false, resend: true }, 'the fresh record: nothing newer than the listener holds, and no move of O\'s on it: send it again');
  assert.deepEqual(await submit(guest2, code, 'O', mo), { committed: true, reason: null }, 'sent again on the live connection: in, and the round settles');
  await until(() => guest2.rec() && guest2.rec().state.sc.recap && guest2.rec().state.sc.recap.round === 1, 10000, 'the round settled on the fresh connection');
  assert.deepEqual(E.scResyncPlan(loc, 'O', guest.rec(), guest2.rec()), { apply: true, resend: false }, 'the dead listener is behind the record now: the fresh record is handed over');
  // the dead line comes back: the first copy of the move arrives at a settled round and is refused (one move a round, never two); the listener catches up
  D.goOnline(guest.db);
  assert.deepEqual(await late, { committed: false, reason: 'round' }, 'the late copy: refused, the record untouched');
  for (const c of [host, guest, guest2]) await until(() => c.rec() && c.rec().state.sc.recap && c.rec().state.sc.recap.round === 1, 10000, 'every client sees round 1 settled');
  const rc1 = host.rec().state.sc.recap;
  assert.deepEqual([rc1.mv.X.square, rc1.mv.O.square, rc1.missed], [0, 1, []], 'both moves counted, once each');
  assert.equal(JSON.stringify(guest.rec().state), JSON.stringify(host.rec().state), 'the same record on both phones');
  // ---- round 2: both through the recap; X moves; O's phone goes dead for good (both phones show "Waiting for…"); nobody settles the round, so the server does, at its deadline ----
  assert.deepEqual(await guest2.txn(code, rec => E.applyChaosBegin(rec, Date.now(), 'O')), { committed: true, reason: null });
  await until(() => host.rec() && host.rec().state.sc.ready && host.rec().state.sc.ready.O, 10000, 'the host sees O through');
  assert.deepEqual(await host.txn(code, rec => E.applyChaosBegin(rec, Date.now(), 'X')), { committed: true, reason: null });
  for (const c of [host, guest]) await until(() => c.rec() && c.rec().state.sc.round === 2 && c.rec().state.sc.deadline != null, 10000, 'round 2 begun on both');
  assert.deepEqual(await submit(host, code, 'X', moveOf(host.rec(), 'X', 2, [12])), { committed: true, reason: null });
  await until(() => host.rec() && host.rec().state.sc.moves && host.rec().state.sc.moves.X, 10000, "X's move on the record");
  D.goOffline(guest.db); await deleteApp(guest2.app);
  const dl = host.rec().state.sc.deadline;
  assert.equal(E.roomDue(host.rec()), dl + E.SC_ONLINE.graceMs, "the room's due moment: the round's deadline and the grace for a move finished in time");
  assert.deepEqual(await host.txn(code, rec => E.applyRoomSweep(rec, dl + E.SC_ONLINE.graceMs - 1, E.makeRng('t'))), { committed: false, reason: 'early' }, "the server's look before then: nothing");
  assert.deepEqual(await host.txn(code, rec => E.applyRoomSweep(rec, dl + E.SC_ONLINE.graceMs, E.makeRng('t'))), { committed: true, reason: null }, "at the due moment: the round settled, O's move missed");
  await until(() => host.rec() && host.rec().state.sc.recap && host.rec().state.sc.recap.round === 2, 10000, 'X sees round 2 settled');
  assert.deepEqual([host.rec().state.sc.recap.mv.O, host.rec().state.sc.recap.missed, host.rec().state.sc.miss], [null, ['O'], { X: 0, O: 1 }]);
  D.goOnline(guest.db);
  await until(() => guest.rec() && guest.rec().state.sc.recap && guest.rec().state.sc.recap.round === 2, 10000, 'O, back, sees round 2 settled');
  assert.equal(JSON.stringify(guest.rec().state), JSON.stringify(host.rec().state), 'the same record on both phones');
});
