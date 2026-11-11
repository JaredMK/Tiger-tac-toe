'use strict';
// Hook-a-Duck: its rules and computer, test by test (npm test). The engine is the one the page and the server run.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const R = require('../../src/games/duck/rules.js');
const A = require('../../src/games/duck/ai.js');

const fresh = s => E.newMini('duck', E.makeRng('duck-t:' + s));
const sum = a => a.reduce((x, v) => x + v, 0);

test('duck: one pond both players fish in (v 2), 12 ducks, the mix as set (one each of 1 to 4, three 5s, five boots), shuffled; the settings are the admin\'s', () => {
  const m = fresh(1);
  assert.equal(m.v, 2); assert.equal(m.vals.length, 12); assert.deepEqual(m.vals.slice().sort(), [0, 0, 0, 0, 0, 1, 2, 3, 4, 5, 5, 5]); assert.ok(m.left.every(Boolean));
  assert.deepEqual([R.duckCfg(m).target, E.tuneLive('duck').again], [12, 'off']);
  E.setTune('duck', { ducks: 6, v1: 0, v2: 0, v3: 0, v4: 0, v5: 2, boots: 1, target: 8 });
  try { const t = fresh(2); assert.deepEqual(t.vals.slice().sort(), [0, 0, 0, 0, 5, 5], 'a mix short of the pond: boots'); assert.equal(R.duckCfg(t).target, 8); } finally { E.setTune('duck', null); }
});

test('duck: the values in the water never reach the public view or the record; a hooked duck\'s does', () => {
  const st = E.newMatch(E.makeRng('d-rec'), { games: ['duck'] });
  const k = st.squares.findIndex(q => q.mini.type === 'duck'), m = st.squares[k].mini;
  const pub = E.publicMini(m);
  assert.ok(!('vals' in pub)); assert.ok(!JSON.stringify(pub).includes('vals'));
  st.id = 'd1'; st.seq = 0; st.recent = [];
  const rec = E.matchRecord(st);
  assert.ok(rec.secrets[k] && rec.secrets[k].vals, 'kept apart'); assert.ok(!('vals' in rec.state.squares[k].mini));
  const back = E.fullState(rec);
  assert.deepEqual(back.squares[k].mini.vals, m.vals, 'put back for a move');
  const p = st.turn, v = m.vals[3];
  const r = E.playMove(st, k, 3, E.makeRng('h'));
  assert.ok(r.ok, r.reason);
  assert.equal(st.flash.duck.v, v, 'the hooked value rides the move'); assert.equal(st.flash.duck.i, 3);
  assert.deepEqual(Object.keys(st.flash.duck).sort(), ['from', 'i', 'n', 'refill', 'score', 'to', 'v']);
});

test('duck: a hook takes the duck out of the one pond, gone for both, and adds its value to the hooker (a boot nothing); never a duck already hooked; the pond fills again when fished out; first to the target wins', () => {
  const m = fresh(3);
  const boot = m.vals.indexOf(0), five = m.vals.indexOf(5);
  let r = E.applyMove(m, 'X', five, E.makeRng('a'));
  assert.deepEqual([r.ok, r.outcome, r.note, m.score.X, m.left[five]], [true, 'continue', 'duck', 5, false]);
  assert.equal(E.applyMove(m, 'O', five, E.makeRng('a')).ok, false, 'that duck is gone for the other player too');
  for (const bad of [-1, 12, 'a', null, 1.5]) assert.equal(E.applyMove(m, 'O', bad, E.makeRng('a')).ok, false);
  r = E.applyMove(m, 'O', boot, E.makeRng('b'));
  assert.deepEqual([r.note, m.score.O, m.score.X], ['boot', 0, 5]);
  assert.deepEqual([m.out, m.outBy], [[5, 0], ['X', 'O']], 'what came out of the pond and who hooked it: public');
  for (const p of ['X', 'O']) assert.deepEqual(A.duckRest(E.publicMini(m), p).sort(), [0, 0, 0, 0, 1, 2, 3, 4, 5, 5], 'what is left of the mix, the same for both');
  // fish the rest out with the target out of reach: the pond fills again
  E.setTune('duck', { target: 30 });
  try {
    const t = fresh(4);
    for (let i = 0; i < 12; i++) { const rr = E.applyMove(t, i % 2 ? 'O' : 'X', i, E.makeRng('f' + i)); assert.ok(rr.ok); }
    assert.equal(t.score.X + t.score.O, 25); assert.ok(t.left.every(Boolean), 'a fresh pond'); assert.equal(t.ponds, 2); assert.equal(t.last.refill, true); assert.deepEqual(t.out, []);
    assert.deepEqual(t.vals.slice().sort(), [0, 0, 0, 0, 0, 1, 2, 3, 4, 5, 5, 5]);
  } finally { E.setTune('duck', null); }
  // the target
  const w = fresh(5); w.score.X = 9;
  const r2 = E.applyMove(w, 'X', w.vals.indexOf(5), E.makeRng('w'));
  assert.deepEqual([r2.outcome, w.score.X], ['win', 12]);
});

test('duck: "Go again on success": off by default, a hook a turn; on, a duck with points keeps the turn, a boot ends it', () => {
  const m = fresh(6);
  assert.equal(E.applyMove(m, 'X', m.vals.indexOf(3), E.makeRng('a')).again, undefined);
  E.setTune('duck', { again: 'on' });
  try {
    const t = fresh(7);
    assert.equal(E.applyMove(t, 'X', t.vals.indexOf(3), E.makeRng('a')).again, true);
    assert.equal(E.applyMove(t, 'X', t.vals.indexOf(0), E.makeRng('b')).again, undefined);
  } finally { E.setTune('duck', null); }
});

test('duck: the computer hooks any duck still swimming at every level (all look alike); needs and q follow what is left of its pond', () => {
  const m = fresh(8);
  E.applyMove(m, 'X', 0, E.makeRng('a'));
  for (const level of ['easy', 'normal', 'hard']) for (let k = 0; k < 20; k++) {
    const b = E.localBest(E.publicMini(m, 'X'), 'X', E.makeRng(level + k), {}, { level, until: null });
    assert.ok(Number.isInteger(b.move) && m.left[b.move], `${level}: a duck still in the pond`);
  }
  const pm = E.publicMini(m);
  assert.ok(A.needs(pm, 'X') > 1 && A.needs(pm, 'O') > A.needs(pm, 'X') - 0.01 - 5);
  const near = fresh(9); near.score.X = 10;   // 2 to go: every duck worth 2 or more takes it
  const q = E.localBest(E.publicMini(near, 'X'), 'X', E.makeRng('q'), {}, { level: 'normal' }).q;
  assert.ok(Math.abs(q - 6 / 12) < 1e-9, 'six ducks of 2 or more in 12: ' + q);
});

test('duck: a timeout plays nothing; the flash covers the hook and the reveal; whole squares between the computers end with a winner', () => {
  assert.equal(R.timeoutClose(fresh(10), 'X'), null);
  const st = E.newMatch(E.makeRng('d-flash'), { games: ['duck'] }), k = st.squares.findIndex(q => q.mini.type === 'duck');
  E.playMove(st, k, 0, E.makeRng('x'));
  assert.ok(E.playMs(st.flash) >= R.duckTimes(st.flash.duck).end);
  let wins = 0;
  for (let g = 0; g < 100; g++) {
    const rng = E.makeRng('w' + g), m = E.newMini('duck', rng); let p = 'X';
    for (let n = 0; n < 200; n++) { const r = E.applyMove(m, p, E.localBest(E.publicMini(m, p), p, rng, {}, { level: 'normal' }).move, rng); assert.ok(r.ok); if (r.outcome !== 'continue') { wins++; break; } p = p === 'X' ? 'O' : 'X'; }
  }
  assert.equal(wins, 100);
});

test('duck: a square dealt before the shared pond (no v: a pond each) plays on under its old rules', () => {
  const old = { type: 'duck', score: { X: 0, O: 0 }, vals: { X: [5, 0, 1], O: [2, 3, 4] }, left: { X: [true, true, true], O: [true, true, true] }, got: { X: [], O: [] }, out: { X: [], O: [] }, ponds: { X: 1, O: 1 }, last: null };
  assert.ok(E.applyMove(old, 'X', 0, E.makeRng('o')).ok);
  assert.deepEqual([old.score.X, old.left.X[0], old.left.O[0]], [5, false, true], "X's own pond only");
  const pub = E.publicMini(old);
  assert.ok(!('vals' in pub)); assert.deepEqual(pub.out.X, [5]);
  assert.ok(old.left.O[E.localBest(E.publicMini(old, 'O'), 'O', E.makeRng('b'), {}, { level: 'normal' }).move], "O hooks from O's own pond");
  const sec = R.secret(old); assert.deepEqual(sec.vals.O, [2, 3, 4]);
});
