'use strict';
// Match logs (functions/matchLogRules.js): the events a friend room's record shows, a phone's own events, the
// summary in the index (its cap, the report), and the device log's report and mlog events (statsRules.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const ML = require('../../functions/matchLogRules.js');
const S = require('../../functions/statsRules.js');
const E = require('../engine.js');

const clone = v => JSON.parse(JSON.stringify(v));
const T = 1700000000000;
const wordle = word => ({ type: 'wordle', word, guesses: [] }), hilo = target => ({ type: 'hilo', target, lo: 1, hi: 30, guesses: [] });
function chaosRoom() {
  const games = Object.fromEntries(E.TYPES.map(t => [t, t === 'wordle' || t === 'hilo']));
  const rec = E.newOnlineMatch({ names: { X: 'Ann', O: 'Bo' }, games, timer: 0, chaos: true }, E.makeRng('ml'), 'm1', T);
  const full = E.fullState(rec); full.sc = clone(rec.state.sc);
  full.squares = [wordle('CRANE'), hilo(20)].concat(Array.from({ length: 7 }, (_, k) => hilo(10 + k))).map(mini => ({ owner: null, mini, mv: { X: 0, O: 0 } }));
  return E.matchRecord(full);
}
function moveOf(rec, me, i, moves) {
  const st = E.fullState(rec);
  st.online = { role: 'host', code: 'ABCDE', me };
  st.sc = Object.assign(clone(rec.state.sc), { me: null, moved: null, start: null, steps: null, recap: null });
  st.turn = me; st.lock = null;
  for (const m of moves) { assert.ok(E.playMove(st, i, m, E.makeRng('p')).ok); st.flash = null; }
  return E.scMoveOf(st, me);
}

test('match log: a friend room\'s Super Chaos record, write by write: the start and round 1, each move in, the round settled, the next round begun', () => {
  const r0 = chaosRoom();
  const start = ML.friendEvents(null, r0.state, T);
  assert.deepEqual(start.map(e => e.k), ['start', 'round']);
  assert.equal(start[0].mode, 'friend-sc'); assert.equal(start[1].r, 1);
  const r1 = E.applyChaosSubmit(r0, 'X', moveOf(r0, 'X', 0, ['CRANE']), E.makeRng('s'), T + 1000).rec;
  assert.deepEqual(ML.friendEvents(r0.state, r1.state, T + 1000), [{ t: T + 1000, k: 'move', s: 'X', r: 1, q: 0, g: 'wordle', win: true, src: 'srv' }]);
  const r2 = E.applyChaosSubmit(r1, 'O', moveOf(r1, 'O', 1, [10]), E.makeRng('s'), T + 2000).rec;
  const settle = ML.friendEvents(r1.state, r2.state, T + 2000);
  assert.deepEqual(settle.map(e => e.k), ['move', 'resolve'], 'the second move came in with the round settled');
  assert.deepEqual([settle[0].s, settle[0].q, settle[0].g], ['O', 1, 'hilo']);
  assert.equal(settle[1].claims, '0X'); assert.equal(settle[1].r, 1);
  const r2b = E.applyChaosBegin(r2, T + 8000, 'X').rec;
  assert.deepEqual(ML.friendEvents(r2.state, r2b.state, T + 8000), [], 'one phone through the recap: nothing to log yet');
  const r3 = E.applyChaosBegin(r2b, T + 9000, 'O').rec;
  assert.deepEqual(ML.friendEvents(r2b.state, r3.state, T + 9000).map(e => [e.k, e.r]), [['round', 2]]);
  // a timeout round: the deadline settles it; the side not in missed it
  const r4 = E.applyChaosSubmit(r3, 'X', moveOf(r3, 'X', 1, [25]), E.makeRng('s'), T + 10000).rec;
  const r5 = E.applyChaosDeadline(r4, r4.state.sc.deadline + E.SC_ONLINE.graceMs + 1, E.makeRng('d')).rec;
  const to = ML.friendEvents(r4.state, r5.state, T + 99000);
  assert.deepEqual(to.map(e => [e.k, e.s]), [['timeout', 'O'], ['resolve', undefined]]);
  assert.equal(to[0].missed, true);
  assert.deepEqual(ML.friendEvents(r5.state, r5.state, T), [], 'no change: nothing logged');
});

test('match log: a friend room\'s normal match: each move the record took (a timeout marked), and the end', () => {
  const rec = E.newOnlineMatch({ names: { X: 'Ann', O: 'Bo' }, games: Object.fromEntries(E.TYPES.map(t => [t, t === 'hilo'])), timer: 0 }, E.makeRng('n'), 'm2', T);
  assert.deepEqual(ML.friendEvents(null, rec.state, T).map(e => [e.k, e.mode]), [['start', 'friend']]);
  let r = rec;
  for (const i of [0, 1, 2]) { r.state.turn = 'O'; const before = clone(r.state); r = E.applyOnlineMove(r, 'O', i, r.secrets[i].target, E.makeRng(i)).rec; const ev = ML.friendEvents(before, r.state, T + i); assert.equal(ev[0].k, 'move'); assert.equal(ev[0].s, 'O'); assert.equal(ev[0].q, i); assert.equal(ev[0].w, 'O'); if (i === 2) assert.deepEqual(ev.slice(-1).map(e => [e.k, e.w]), [['end', 'O']]); }
  assert.deepEqual(ML.entryEvent({ by: 'X', square: 4, type: 'hilo', kind: 'move', timeout: true, seq: 7 }, T), { t: T, k: 'timeout', s: 'X', q: 4, g: 'hilo', seq: 7, src: 'srv' });
});

test('match log: a phone\'s own events kept in a known shape only, short; the index summary, its players, versions, devices, report, and its cap', () => {
  assert.deepEqual(ML.clientEvent({ k: 'resolve', r: 3, me: 4, mg: 'wordle', claims: '4X', junk_key: 1, 'bad key': 2, obj: { a: 1 } }, T), { t: T, k: 'resolve', src: 'cli', r: 3, me: 4, mg: 'wordle', claims: '4X' });
  assert.equal(ML.clientEvent({ k: 'start' }, T), null, 'only the kinds a phone may send');
  assert.equal(ML.clientEvent(null, T), null);
  assert.equal(ML.clientEvent({ k: 'note', a: 'x'.repeat(500) }, T).a.length, 80);
  let x = ML.indexMerge(null, { srv: true, mode: 'friend-sc', room: 'ABCDE', players: { X: { name: 'Ann', uid: 'u1' }, O: { name: 'Bo', uid: 'u2' } } }, 2, T);
  assert.deepEqual([x.mode, x.n, x.started, x.last, x.room, x.players.X.name], ['friend-sc', 2, T, T, 'ABCDE', 'Ann']);
  x = ML.indexMerge(x, { mode: 'friend', dev: 'abc123', ver: 'a1b2c3d' }, 1, T + 5);
  assert.equal(x.mode, 'friend-sc', "a phone's mode never over the server's");
  assert.deepEqual([x.devs, x.vers, x.last], ['abc123', 'a1b2c3d', T + 5]);
  assert.ok(x.who.includes('ann') && x.who.includes('u2') && x.who.includes('abc123') && x.who.includes('abcde'), 'searchable by player, uid, device and room');
  x = ML.indexMerge(x, { report: { t: T + 9, note: '  It froze\nafter my move  ' } }, 1, T + 9);
  assert.deepEqual([x.reported, x.reports, x.note], [T + 9, 1, 'It froze after my move']);
  assert.equal(ML.indexMerge({ n: ML.LOG_CAP }, null, 1, T), undefined, 'a full log takes no more');
  assert.equal(ML.indexMerge(null, { mode: 'nope' }, 1, T).mode, undefined);
  assert.ok(ML.keyOk('fABCDE_kq3f9a1lo5x') && ML.keyOk('mGAME1234') && ML.keyOk('l0123abcd') && !ML.keyOk('x123') && !ML.keyOk('f../a') && !ML.keyOk(undefined));
  assert.equal(ML.LOG_KEEP_MS, 30 * 24 * 3600 * 1000);
});

test('device log: a report (its note, at most 140 characters) and an mlog event, each with its match; the app version and side carried', () => {
  const dev = 'd0123456789abcdef0123456';
  const r = S.checkDev({ dev, ev: 'report', o: 'r12345678', g: 'fABCDE_m1', mode: 'friend', note: '  ' + 'é'.repeat(200), v: 'a1b2c3d', s: 'O' }, T);
  assert.equal(r.k, 'rr12345678'); assert.equal(r.note.length, 140); assert.equal(r.ev.note.length, 140);
  assert.deepEqual([r.v, r.s, r.ev.g, r.ev.m], ['a1b2c3d', 'O', 'fABCDE_m1', 'friend']);
  assert.equal(S.checkDev({ dev, ev: 'report', o: 'r12345678', note: 'x' }, T), null, 'a report needs its match');
  const m = S.checkDev({ dev, ev: 'mlog', o: 'l12345678', g: 'labcdef12', mode: 'chaos', e: { k: 'resolve', r: 2 }, v: 'bad version!' }, T);
  assert.deepEqual([m.k, m.e.k, m.v], ['ll12345678', 'resolve', undefined]);
  assert.equal(S.checkDev({ dev, ev: 'mlog', o: 'l12345678', g: 'labcdef12', mode: 'chaos' }, T), null, 'an mlog needs its event');
  assert.equal(S.checkDev({ dev, ev: 'start', mode: 'friend', g: 'fABCDE_m1', s: 'Z' }, T).s, undefined);
});
