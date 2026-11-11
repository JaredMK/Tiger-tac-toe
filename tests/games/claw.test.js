'use strict';
// Claw Machine (November 2026): its rules, its computer and the aim (npm test).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const R = require('../../src/games/claw/rules.js');
const A = require('../../src/games/claw/ai.js');
const at = (...v) => { let k = 0; return () => v[Math.min(k++, v.length - 1)]; };   // a rng giving these numbers in turn
const C = () => Object.assign({}, R.CLAW_DEF);
const fresh = seed => E.newMini('claw', E.makeRng('claw-t' + (seed || '')));
const one = (k, x) => ({ id: 0, k, c: 0, x, w: R.CLAW_KINDS[k].w });

test('claw: each player their own case of prizes inside the floor, none overlapping, nothing hidden; first to 3', () => {
  for (let s = 0; s < 40; s++) {
    const m = fresh(s);
    for (const p of ['X', 'O']) {
      const cs = m.case[p];
      assert.equal(cs.length, 6);
      for (let i = 0; i < cs.length; i++) {
        assert.ok(cs[i].x - cs[i].w >= R.CLAW.lo - 1e-6 && cs[i].x + cs[i].w <= R.CLAW.hi + 1e-6, 'on the floor');
        if (i) assert.ok(cs[i].x - cs[i].w >= cs[i - 1].x + cs[i - 1].w - 0.11, 'never overlapping');
      }
    }
  }
  const m = fresh();
  assert.deepEqual(m.won, { X: 0, O: 0 }); assert.equal(R.clawCfg(m).goal, 3);
  assert.deepEqual(E.publicMini(m).case, m.case, 'the cases are public');
});

test('claw: the grip falls from the centre to the edge and is nothing beyond; a slip is likelier at the edge and for a heavy prize', () => {
  const c = C();
  assert.equal(R.clawGrip(c, 0), 0.85); assert.equal(R.clawGrip(c, 1), 0.15); assert.equal(R.clawGrip(c, 1.01), 0);
  assert.ok(R.clawGrip(c, 0.5) > R.clawGrip(c, 0.8));
  assert.ok(R.clawSlip(c, 0.9, 'blob') > R.clawSlip(c, 0, 'blob'));
  assert.ok(R.clawSlip(c, 0.3, 'box') > R.clawSlip(c, 0.3, 'ball'));
  // the target: of the prizes the claw is over, the one it is best centred on
  const cs = [one('ball', 30), one('box', 40)];
  assert.equal(R.clawTarget(cs, 30).i, 0); assert.equal(R.clawTarget(cs, 39).i, 1); assert.equal(R.clawTarget(cs, 60), null);
});

test('claw: a grab: won (the prize leaves the case, counted), slipped (back in the case where the claw was), missed (nothing)', () => {
  const m = fresh(); m.case.X = [one('blob', 50), Object.assign(one('ball', 80), { id: 1 })];
  let r = E.applyMove(m, 'X', { x: 50 }, at(0.1, 0.9, 0.5));          // gripped, held
  assert.deepEqual([r.ok, r.outcome, r.note, m.won.X, m.case.X.length, m.got.X.length], [true, 'continue', 'win', 1, 1, 1]);
  assert.equal(m.last.pz.id, 0);
  r = E.applyMove(m, 'X', { x: 80 }, at(0.1, 0.01, 0.5));             // gripped, slipped half way to the chute
  assert.deepEqual([r.note, m.won.X, m.case.X.length], ['slip', 1, 1]);
  assert.equal(m.case.X[0].x, Math.round((80 + (R.CLAW.rest - 80) * 0.45) * 10) / 10, 'it lands where the claw was');
  assert.ok(m.case.X[0].x - m.case.X[0].w >= R.CLAW.lo, 'kept inside the case');
  r = E.applyMove(m, 'X', { x: 5 }, at(0.1, 0.1, 0.5));               // over the chute: nothing under the claw
  assert.deepEqual([r.note, m.last.pz], ['miss', null]);
  r = E.applyMove(m, 'X', { x: m.case.X[0].x }, at(0.99, 0.1, 0.5)); // on a prize, no grip
  assert.equal(r.note, 'miss'); assert.ok(m.last.pz);
  for (const bad of [null, 3, {}, { x: 'a' }, { x: NaN }]) assert.equal(E.applyMove(m, 'X', bad, at(0.5)).ok, false);
  // first to the goal; the flash and its moments
  const w = fresh('w'); w.won.O = 2; const z = w.case.O[0];
  r = E.applyMove(w, 'O', { x: z.x }, at(0, 0.99, 0.5));
  assert.deepEqual([r.outcome, w.won.O], ['win', 3]);
  const st = E.newMatch(E.makeRng('cm'), { games: ['claw'] });
  assert.ok(E.playMove(st, 4, { x: st.squares[4].mini.case[st.turn][0].x }, E.makeRng('cm2')).ok);
  assert.ok(st.flash.claw && 'res' in st.flash.claw && 'x' in st.flash.claw);
  const T = R.clawTimes(st.flash.claw, false);
  assert.ok(E.playMs(st.flash) >= T.end && T.down > 0 && R.clawTimes(st.flash.claw, true).down === 0, 'this phone\'s own grab: no slide out');
});

test('claw: Go again on success: a prize won keeps the turn', () => {
  E.setTune('claw', { again: 'on' });
  try { const m = fresh('a'); const r = E.applyMove(m, 'X', { x: m.case.X[0].x }, at(0, 0.99, 0.5)); assert.equal(r.again, true); } finally { E.setTune('claw', null); }
});

test('claw: the computer aims at a prize: Hard at the likeliest to win, its error by level; the drag moves the claw by the finger\'s travel', () => {
  const m = fresh('ai'); m.case.X = [one('box', 30), Object.assign(one('ball', 60), { id: 1 })];
  const pm = E.publicMini(m), c = R.clawCfg(m);
  assert.ok(A.clawOdds(pm.case.X, 1, 2.4, c) > A.clawOdds(pm.case.X, 0, 2.4, c), 'a ball slips least');
  const xs = Array.from({ length: 40 }, (_, k) => E.localBest(pm, 'X', E.makeRng('h' + k), {}, { level: 'hard' }).move.x);
  assert.ok(xs.filter(x => Math.abs(x - 60) < 10).length >= 36, 'Hard goes for the ball');
  const sd = lv => { const v = Array.from({ length: 300 }, (_, k) => E.localBest(pm, 'X', E.makeRng(lv + k), {}, { level: lv }).move.x); const t = v.filter(x => Math.abs(x - 30) < 25).map(x => x - 30); return Math.sqrt(t.reduce((a, b) => a + b * b, 0) / t.length); };
  assert.ok(sd('easy') > sd('normal'), 'Easy aims worse than Normal');
  assert.ok(A.needs(pm, 'X') > 1);
  assert.equal(R.clawAim(50, 30, 3), 60); assert.equal(R.clawAim(50, -300, 3), 0); assert.equal(R.clawAim(50, 600, 3), 100);
});

test('claw: whole squares between the computers end with a winner', () => {
  for (let g = 0; g < 200; g++) {
    const rng = E.makeRng('cw' + g), m = fresh('w' + g); let p = 'X', done = false;
    for (let k = 0; k < 200 && !done; k++) {
      const r = E.applyMove(m, p, E.localBest(E.publicMini(m), p, rng, {}, { level: 'normal' }).move, rng);
      assert.ok(r.ok); if (r.outcome === 'win') done = true; else p = p === 'X' ? 'O' : 'X';
    }
    assert.ok(done);
  }
});
