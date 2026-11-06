'use strict';
// The match clock (core/timer.js): chess style, minutes each for the whole match, the increment added after every
// move. Only the player on the move's clock runs, from when they can act (after the replay of the move before
// theirs, and standing still while a move of theirs that keeps the turn plays out); a clock at zero loses the match
// ('clock'). The server holds both clocks in server time, the same on both phones.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
E.setPhysics(require('../physics.js'));

const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const T0 = 1700000000000, MIN = 60000;
function match(spec, types = ['ttt']) {                          // an online match with this timer, its squares dealt from these games
  const games = Object.fromEntries(E.TYPES.map(g => [g, types.includes(g)]));
  const rec = E.newOnlineMatch({ names: { X: 'A', O: 'B' }, games, timer: spec }, lcg(3), 'mc');
  E.armClock(rec.state, [], T0);
  return rec;
}
// A move as the server makes it (functions/index.js changeGame): the clock re-armed on a turn change, held on a bonus move.
function serverMove(rec, side, i, m, now) {
  const turn0 = rec.state.turn, r = E.applyOnlineMove(rec, side, i, m, lcg(9));
  assert.equal(r.ok, true, `the move is played (${r.reason})`);
  if (r.rec.state.turn !== turn0 || r.rec.state.winner) E.armClock(r.rec.state, r.entries, now);
  else if (r.entries && r.entries.length) E.holdClock(r.rec.state, r.entries);
  return r;
}
const tttSquare = st => st.squares.findIndex(s => s.mini.type === 'ttt' && !s.owner);

test('match clock: the timer codes, their parts and labels', () => {
  assert.deepEqual(E.TIMER_SPECS, ['off', 't30', 't60', 'm3+0', 'm3+2', 'm3+5', 'm5+0', 'm5+2', 'm5+5', 'm10+0', 'm10+2', 'm10+5']);
  for (const s of E.TIMER_SPECS) assert.equal(E.timerSpec(s), s, s);
  for (const bad of ['m4+0', 'm5+3', 't45', 'x', '', null, undefined, {}, 'm5+2; drop']) assert.equal(E.timerSpec(bad), 'off', String(bad));
  assert.equal(E.timerSpec(30), 't30'); assert.equal(E.timerSpec(0), 'off');
  assert.deepEqual(E.specParts('m5+2'), { kind: 'match', mins: 5, inc: 2 });
  assert.deepEqual(E.specParts('t60'), { kind: 'turn', secs: 60 });
  assert.equal(E.timerLabel('m10+5'), '10 min each + 5s/move');
  assert.equal(E.timerLabel('m3+0'), '3 min each');
  assert.equal(E.timerLabel('t30'), '30s/turn');
  assert.equal(E.timerLabel('t60'), '60s/turn');
  assert.equal(E.timerLabel('off'), 'No limit');
  assert.equal(E.setupSpec({ clock: 'm5+2', timer: 30 }), 'm5+2', 'a room\'s clock code wins over its old number');
  assert.equal(E.setupSpec({ timer: 30 }), 't30');
  const t = E.newTimer('m5+2');
  assert.deepEqual([t.kind, t.spec, t.inc, t.bank, t.limit], ['match', 'm5+2', 2, { X: 5 * MIN, O: 5 * MIN }, 0]);
  assert.ok(E.matchClock(t) && E.clockOn(t));
  assert.ok(!E.matchClock(E.newTimer('t30')) && E.clockOn(E.newTimer('t30')));
  assert.ok(!E.clockOn(E.newTimer('off')));
});

test('match clock: an online match takes the code; only the player on the move\'s clock runs, and the clocks switch on every move', () => {
  const rec = match('m3+0'), st = rec.state, p = st.turn, q = E.other(p);
  assert.equal(st.timer.kind, 'match');
  assert.equal(E.clockDeadline(st.timer), T0 + 3 * MIN, 'the first turn: the full three minutes');
  assert.deepEqual(E.clockLeft(st.timer, T0 + 20000), { [p]: 3 * MIN - 20000, [q]: 3 * MIN }, 'the one on the move counts down, the other stands');
  const r = serverMove(rec, p, tttSquare(E.fullState(rec)), 4, T0 + 20000);
  const t = r.rec.state.timer;
  assert.equal(t.bank[p], 3 * MIN - 20000, '20 s used off their clock');
  assert.equal(t.for, q, 'now the other player\'s clock');
  assert.equal(t.deadline, null, 'which waits for the replay of the move');
  const play = E.replayMs(r.entries);
  assert.equal(t.startBy, T0 + 20000 + play + E.CLOCK.startSlackMs);
  assert.deepEqual(E.clockLeft(t, T0 + 21000), { [p]: 3 * MIN - 20000, [q]: 3 * MIN }, 'during the replay: both clocks stand');
  assert.equal(E.clockDeadline(t), t.startBy + 3 * MIN);
  const startAt = t.startBy;
  assert.deepEqual(E.clockLeft(t, startAt + 10000), { [p]: 3 * MIN - 20000, [q]: 3 * MIN - 10000 }, 'then theirs runs');
});

test('match clock: paused during the replay: a reply made the moment the replay ends uses nothing', () => {
  const rec = match('m5+0'), p = rec.state.turn, q = E.other(p);
  const r1 = serverMove(rec, p, tttSquare(E.fullState(rec)), 0, T0 + 1000);
  const t1 = r1.rec.state.timer, start = t1.startBy;
  const r2 = serverMove(r1.rec, q, E.fullState(r1.rec).lock != null ? E.fullState(r1.rec).lock : tttSquare(E.fullState(r1.rec)), 1, start);
  assert.equal(r2.rec.state.timer.bank[q], 5 * MIN, 'the replay\'s time is never theirs');
  assert.equal(r2.rec.state.timer.bank[p], 5 * MIN - 1000);
});

test('match clock: the increment goes on after every move made in time', () => {
  const rec = match('m3+5'), p = rec.state.turn, q = E.other(p);
  const r1 = serverMove(rec, p, tttSquare(E.fullState(rec)), 4, T0 + 12000);
  assert.equal(r1.rec.state.timer.bank[p], 3 * MIN - 12000 + 5000, '12 s used, 5 s back');
  const start = r1.rec.state.timer.startBy, full = E.fullState(r1.rec);
  const r2 = serverMove(r1.rec, q, full.lock != null ? full.lock : tttSquare(full), 0, start + 2000);
  assert.equal(r2.rec.state.timer.bank[q], 3 * MIN - 2000 + 5000, 'a quick move gains time');
  const two = match('m3+2'), a = two.state.turn;
  const r3 = serverMove(two, a, tttSquare(E.fullState(two)), 4, T0 + 1000);
  assert.equal(r3.rec.state.timer.bank[a], 3 * MIN - 1000 + 2000);
  const none = match('m3+0'), b = none.state.turn;
  assert.equal(serverMove(none, b, tttSquare(E.fullState(none)), 4, T0 + 1000).rec.state.timer.bank[b], 3 * MIN - 1000, 'no increment: nothing back');
});

test('match clock: a move that keeps the turn holds the clock while it plays out (Risky Rolls rolls)', () => {
  const rec = match('m5+0', ['pig']), p = rec.state.turn, sq = 0;
  const dl0 = E.clockDeadline(rec.state.timer);
  const r = serverMove(rec, p, sq, 'roll', T0 + 3000);
  if (r.rec.state.turn === p && !r.rec.state.winner) {
    const t = r.rec.state.timer, play = E.replayMs(r.entries);
    assert.ok(play > 0);
    assert.equal(t.deadline, dl0 + play, 'the roll\'s animation is not on their clock');
    assert.equal(t.bank[p], 5 * MIN, 'nothing settled until the turn passes');
    const r2 = E.applyOnlineMove(r.rec, p, sq, 'bank', lcg(2));
    assert.equal(r2.ok, true);
    E.armClock(r2.rec.state, r2.entries, T0 + 3000 + play + 4000);
    assert.equal(r2.rec.state.timer.bank[p], 5 * MIN - 7000, '3 s before the roll, 4 s after it: 7 s used, the roll\'s replay not');
  } else assert.equal(r.rec.state.timer.bank[p], 5 * MIN - 3000, '(a bust: the turn passed, 3 s used)');
  assert.equal(E.turnOpen(E.fullState(match('m5+0', ['pig'])), 0), false, 'a match clock has no 60 s games: opening a square changes nothing');
});

test('match clock: a clock at zero loses the match ("ran out of time"), a forfeit-free finish with the other player the winner', () => {
  const rec = match('m3+2'), p = rec.state.turn, q = E.other(p);
  const dl = E.clockDeadline(rec.state.timer);
  assert.equal(dl, T0 + 3 * MIN);
  const r = E.applyOnlineTimeout(rec, lcg(1));
  assert.equal(r.ok, true);
  assert.equal(r.lost, p);
  E.armClock(r.rec.state, r.entries, dl + 10);
  const st = E.fullState(r.rec);
  assert.deepEqual([st.winner, st.winReason, st.resigned], [q, 'clock', null]);
  assert.equal(st.timer.bank[p], 0, 'their clock reads zero');
  assert.equal(st.timer.bank[q], 3 * MIN, 'the other\'s untouched');
  assert.equal(E.clockDeadline(st.timer), null, 'no clock once the match is over');
  assert.equal(E.matchStats(st).reason, 'clock');
  const S = require('../../functions/statsRules.js');
  assert.deepEqual(S.timerEndUpdates('m3+2', E.matchStats(st), 200000), { 'timers/m3+2/finished': 1, 'timers/m3+2/clockOuts': 1, 'timers/m3+2/ms': 200000, 'timers/m3+2/timed': 1, 'timers/m3+2/done': 1, 'timers/m3+2/doneMs': 200000, 'timers/m3+2/doneTimed': 1 }, 'a clock run out is a finish');
  assert.deepEqual(S.timerStartUpdates('m3+2'), { 'timers/m3+2/started': 1 });
  assert.deepEqual(S.timerStartUpdates('../x'), {}, 'nothing but a code');
  assert.equal(S.timerEndUpdates('t30', { squares: [], reason: 'timeout' }, 1000)['timers/t30/timeouts'], 1);
  assert.equal(S.timerEndUpdates('t30', { squares: [], reason: 'timeout' }, 1000)['timers/t30/done'], undefined, 'two missed turns: abandoned');
});

test('match clock: per turn stays as it was: 30 s, two missed turns lose (timeout), and no banks', () => {
  const rec = match('t30'), p = rec.state.turn;
  assert.equal(rec.state.timer.limit, 30); assert.equal(rec.state.timer.kind, undefined);
  assert.equal(E.clockLeft(rec.state.timer, T0), null);
  let r = E.applyOnlineTimeout(rec, lcg(1));
  assert.equal(r.ok, true); assert.ok(!r.lost, 'one miss: the turn passes');
  const t60 = match('t60');
  assert.equal(E.clockDeadline(t60.state.timer), T0 + 60000, '60 s a turn');
});

test('match clock: both phones read the same clocks from the record (a reconnect, a second phone): server time only', () => {
  const rec = match('m5+2'), p = rec.state.turn;
  const r = serverMove(rec, p, tttSquare(E.fullState(rec)), 4, T0 + 30000);
  const packed = E.packMatch(r.rec);
  const a = E.parseMatch(JSON.parse(JSON.stringify(packed))), b = E.parseMatch(JSON.parse(JSON.stringify(packed)));
  const now = r.rec.state.timer.startBy + 42000;
  assert.deepEqual(E.clockLeft(a.state.timer, now), E.clockLeft(b.state.timer, now), 'one record, one reading');
  assert.deepEqual(E.clockLeft(a.state.timer, now), { [p]: 5 * MIN - 30000 + 2000, [E.other(p)]: 5 * MIN - 42000 });
  assert.equal(a.state.timer.kind, 'match', 'the clock survives the record\'s shape check');
});
