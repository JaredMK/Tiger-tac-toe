// The abandonment data (December 2026): a match given up part way carries its quit facts (src/core/quit.js quitFacts) on its
// row. A local match: left through the menu (the end report's q, r 'menu'), sent to the background (a provisional `quit`
// report with r 'bg', once a stretch of play), and a page closed or reloaded part way (ended as 'closed' when the device
// next opens it: net/tracking.js quitOnBoot, r 'reload' / 'bg' / 'closed'). The server keeps only facts that hold together
// (functions/statsRules.js checkQuit) and the admin's view counts them (src/admin/metrics.js abandonRows, abandonReport).
// Rendered in Node with the browser's names stubbed, a real localStorage and a stand-in SDK whose calls are recorded.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const store = new Map();
const storage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
for (const k of ['localStorage', 'sessionStorage']) Object.defineProperty(globalThis, k, { value: storage, configurable: true, writable: true });
Object.defineProperty(globalThis, 'window', { value: { TTT_FIREBASE: { config: { apiKey: 'k', databaseURL: 'https://stand-in.example' } }, addEventListener() {} }, configurable: true, writable: true });

const require = createRequire(import.meta.url);
const S = require('../../functions/statsRules.js');
const E = require('../engine.js');
const X = require('../../src/admin/metrics.js');
const C = await import('../../src/net/connect.js');
const T = await import('../../src/net/tracking.js');
const { state } = await import('../../src/ui/app.js');
const { newMatch } = await import('../../src/core/match.js');
const { playMove, endFlash } = await import('../../src/core/board.js');
const { cpuMove } = await import('../../src/core/ai.js');
const { makeRng } = await import('../../src/core/random.js');

let sent = [];
C.setFb({ fns: {}, uid: 'u1', fnM: {} });
C.setCall(async (name, data) => { sent.push({ name, data: JSON.parse(JSON.stringify(data)) }); return { ok: true }; });
const settle = async () => { for (let k = 0; k < 50; k++) await new Promise(r => setTimeout(r, 0)); };
// A local match against the computer, a few moves in (the computer playing both sides), not over.
function partWay(seed, moves) {
  const rng = makeRng('quit:' + seed);
  Object.assign(state, newMatch(rng, { games: ['ttt', 'coins', 'hilo', 'rps'] }), { online: null, cpu: 'O', sc: null, stats: null, practice: null, screen: 'board', zoom: null, winner: null });
  T.trackStart();
  let t = 1000;
  for (let k = 0; k < moves && !state.winner; k++) { const m = cpuMove(state, rng, null, { level: 'easy' }); playMove(state, m.square, m.move, rng, { at: (t += 5000) }); endFlash(state); }
  return t;
}

test('quitFacts: the reason, the side, the board position, the other side at match point, the mini-game in front and its state, the moves, the idle time', () => {
  const st = newMatch(makeRng('q1'), { games: ['ttt'] });
  st.squares[0].owner = 'O'; st.squares[1].owner = 'O'; st.squares[4].owner = 'X'; st.moves = 7; st.lastAt = 10000; st.lastSquare = 5;
  const q = E.quitFacts(st, 'X', 'menu', 25000, -1);
  assert.deepEqual([q.r, q.s, q.d, q.mp, q.g, q.i, q.n, q.idle], ['menu', 'X', -1, 1, 'ttt', 5, 7, 15000]);
  assert.ok(Array.isArray(q.st) && q.st.length === 2, 'each side\'s moves still needed there');
  assert.equal(E.quitFacts(st, 'X', 'menu', 25000, 8).i, 8, 'the square on screen first');
  assert.equal(E.quitFacts(st, 'Z', 'menu', 1), null); assert.equal(E.quitFacts(st, 'X', 'nope', 1), null);
  S.quitTypes(E.TYPES.concat(E.OLD_TYPES));                       // (as functions/index.js sets them at load)
  assert.deepEqual(S.checkQuit(q), q, 'the server keeps what holds together');
  assert.equal(S.checkQuit(Object.assign({}, q, { g: 'nosuchgame' })).g, undefined, 'an unknown game is dropped (the server loads the registry\'s types)');
  const sum = S.checkEnd({ squares: [], winner: null, reason: 'closed', q }, E.TYPES);
  assert.equal(sum.reason, 'closed'); assert.deepEqual(S.factEnd(sum, 1000, 2000).q, S.checkQuit(q), 'on the row\'s end');
  assert.ok(S.ABANDONED.includes('closed') && X.ABANDONED.includes('closed'), 'a match closed part way is abandoned, on both sides');
});

test('a local match left through the menu: its end report carries the quit facts (r menu), the board as it was left', async () => {
  partWay('menu', 6); sent = [];
  state.screen = 'mini'; state.zoom = 4;
  T.noteLeave(); T.trackLeft(); await settle();
  const end = sent.find(c => c.name === 'track' && c.data.ev === 'end');
  assert.ok(end, 'the end went'); assert.equal(end.data.reason, 'left');
  assert.equal(end.data.q.r, 'menu'); assert.equal(end.data.q.s, 'X', 'against the computer: its player'); assert.equal(end.data.q.i, 4, 'the square on screen');
  assert.equal(end.data.q.n, state.moves);
});

test('sent to the background: a provisional quit report (r bg) once a stretch of play; back in front, the mark goes; a match then finished has no quit facts', async () => {
  partWay('bg', 4); sent = [];
  T.quitHide(); T.quitHide(); await settle();
  const quits = sent.filter(c => c.name === 'track' && c.data.ev === 'quit');
  assert.equal(quits.length, 1, 'once while nothing has moved'); assert.equal(quits[0].data.q.r, 'bg'); assert.equal(quits[0].data.id, state.stats.id);
  assert.ok(state.stats.hid > 0);
  T.quitShow(); assert.equal(state.stats.hid, undefined);
});

test('the next open: a match left behind by a reload, a close or a time in the background is held for Continue match, and ended as closed with its facts only once something else starts; nothing for a finished or practice match', async () => {
  const at = partWay('boot', 5); sent = [];
  assert.equal(T.quitOnBoot('reload'), null); await settle();
  assert.ok(T.holdingLocal(), 'held for the menu\'s Continue match');
  assert.equal(sent.filter(c => c.name === 'track' && c.data.ev === 'end').length, 0, 'nothing reported yet');
  T.abandonHeld(); await settle();                          // another match started instead
  let end = sent.find(c => c.name === 'track' && c.data.ev === 'end');
  assert.equal(end.data.reason, 'closed'); assert.equal(end.data.q.r, 'reload'); assert.equal(state.stats.sent, true);
  assert.ok(!T.holdingLocal());
  assert.equal(T.quitOnBoot('reload'), null); assert.ok(!T.holdingLocal(), 'once: an ended match is not held');
  partWay('boot1', 5); sent = []; T.quitOnBoot('reload');
  assert.ok(T.continueHeld(), 'continued'); assert.ok(!T.holdingLocal()); assert.equal(state.stats.sent, false, 'still under way: nothing reported');
  T.abandonHeld(); await settle(); assert.equal(sent.filter(c => c.name === 'track' && c.data.ev === 'end').length, 0, 'a continued match is not given up by the next start');
  const held = async (reason, set) => { set(); T.quitOnBoot(reason); sent = []; T.abandonHeld(); await settle(); return sent.find(c => c.name === 'track' && c.data.ev === 'end'); };
  partWay('boot2', 5);
  assert.equal((await held('navigate', () => { state.stats.hid = 50000; state.stats.ph = 50500; })).data.q.r, 'closed', 'hidden and gone together: closed');
  partWay('boot3', 5);
  assert.equal((await held('navigate', () => { state.stats.hid = 50000; state.stats.ph = 900000; })).data.q.r, 'bg', 'gone long after it went to the background');
  partWay('boot4', 5);
  const e4 = await held('navigate', () => { state.stats.hid = 50000; delete state.stats.ph; });
  assert.equal(e4.data.q.r, 'bg', 'never came back to the front (an app killed in the background)'); assert.equal(e4.data.q.idle, 50000 - state.lastAt);
  partWay('boot5', 3); state.practice = { type: 'ttt' };
  assert.equal(T.quitOnBoot('reload'), null); assert.ok(!T.holdingLocal(), 'practice: nothing');
  assert.ok(at > 0);
});

test('the admin\'s view: quits by reason, mode, mini-game (against how often it is played), board position and stage; a quit from before read from its device\'s events', () => {
  const now = Date.UTC(2026, 11, 10, 15), t = now - 2 * 86400000, day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date(t));
  const H = 'abcdefabcdefabcdef12';
  const mf = {
    l_a: { t0: t, m: 'cpu', who: [{ h: H }] },                                                                // never finished, no facts: its device says what came next
    l_b: { t0: t + 1, m: 'cpu', t1: t + 60000, end: 'closed', q: { r: 'reload', s: 'X', d: -1, n: 9, g: 'ttt', i: 4, st: [2, 1], idle: 4000, mp: 1 } },
    l_c: { t0: t + 2, m: 'local', t1: t + 60000, end: 'left', q: { r: 'menu', s: 'O', d: 1, n: 20, g: 'rps', i: 2, idle: 9000 } },
    m1: { t0: t + 3, m: 'match', t1: t + 90000, end: 'resign', q: { r: 'drop', s: 'X', d: 0, n: 3, g: 'ttt', i: 1 } },
    m3: { t0: t + 5, m: 'friend', t1: t + 90000, end: 'resign', w: 'X', ab: 3, who: [{ s: 'X', u: 'a' }, { s: 'O', u: 'b' }], sq: JSON.stringify([{ t: 'ttt', end: 'won', w: 'X', X: 2, O: 1, i: 0, k: 1 }, { t: 'rps', end: 'open', X: 1, O: 1, i: 3, k: 2 }]) },   // from before: read from its row
    m2: { t0: t + 4, m: 'match', t1: t + 90000, end: 'line', n: 12, sq: JSON.stringify([{ t: 'ttt', end: 'won', w: 'X', X: 3, O: 2 }, { t: 'coins', end: 'won', w: 'O', X: 1, O: 2 }]) },
  };
  const M = X.build({ matches: { [day]: mf }, devices: { [H]: { first: t } }, logs: { [H]: { a: { t, ev: 'start', g: 'la' }, b: { t: t + 30000, ev: 'error', g: 'la' }, c: { t: t + 40000, ev: 'open' } } } }, now);
  const R = X.abandonReport(X.abandonRows(X.scope(M, { mine: true })));
  assert.deepEqual([R.started, R.quits, R.abandoned, R.unfinished, R.detail, R.withPos], [6, 5, 4, 1, 3, 4]);
  const why = Object.fromEntries(R.byWhy.map(r => [r.why, r.quits]));
  assert.deepEqual(why, { unknown: 2, reload: 1, menu: 1, drop: 1 }, 'an online resignation from before: no way to tell the menu from a drop');
  assert.deepEqual(R.byAfter.map(r => [r.after, r.quits, r.err]), [['reopened', 1, 1]], 'opened again 10 s later, an error logged in it first');
  const g = Object.fromEntries(R.byGame.map(r => [r.t, [r.played, r.quits]]));
  assert.deepEqual(g.ttt, [4, 2]); assert.deepEqual(g.coins, [1, 0]); assert.deepEqual(g.rps, [2, 2], 'the old resignation\'s game: the one on the leaver\'s screen');
  assert.deepEqual(R.byPos.map(r => [r.pos, r.quits, r.derived, r.mp]), [['behind', 2, 1, 1], ['level', 1, 0, 0], ['ahead', 1, 0, 0]], 'O resigned a square down');
  assert.deepEqual(Object.fromEntries(R.byStage.map(r => [r.stage, r.quits])), { 0: 0, '1-5': 2, '6-15': 1, '16-30': 1, '31+': 0 }, 'the never-finished one has no stage; the old resignation\'s from its plays');
  assert.equal(Object.fromEntries(R.byStage.map(r => [r.stage, r.finishedAt]))['6-15'], 1, 'the finished match of 12 moves');
  assert.equal(R.byMode.find(r => r.mode === 'cpu').quits, 2);
});

test('online: a resignation from a phone offline 2 minutes is marked as a drop on the record (quitBy), and the server\'s facts follow it', () => {
  const rec = E.newOnlineMatch({ names: { X: 'A', O: 'B' }, games: { ttt: true, coins: true }, timer: 0 }, makeRng('qo'), 'g1');
  const r = E.applyOnlineResign(rec, 'O', 'drop');
  assert.ok(r.ok); assert.equal(r.rec.state.quitBy, 'drop'); assert.equal(r.rec.state.resigned, 'O');
  assert.equal(JSON.parse(JSON.stringify(r.rec.state)).quitBy, 'drop', 'kept through the record (MATCH_FIELDS), as the server stores it');
  const st = r.rec.state, q = E.quitFacts(st, st.resigned, st.quitBy === 'drop' ? 'drop' : 'menu', Date.now());
  assert.deepEqual([q.r, q.s], ['drop', 'O']);
  assert.equal(E.applyOnlineResign(E.newOnlineMatch({ names: { X: 'A', O: 'B' }, games: { ttt: true }, timer: 0 }, makeRng('qo2'), 'g2'), 'X').rec.state.quitBy, undefined, 'a resignation from the menu: none');
});
