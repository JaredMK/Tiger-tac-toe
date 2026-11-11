'use strict';
// Claw Machine (November 2026; one shared machine from v 2): its rules, its computer and the sweep (npm test).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const R = require('../../src/games/claw/rules.js');
const A = require('../../src/games/claw/ai.js');
const at = (...v) => { let k = 0; return () => v[Math.min(k++, v.length - 1)]; };   // a rng giving these numbers in turn
const C = () => Object.assign({}, R.CLAW_DEF);
const fresh = seed => E.newMini('claw', E.makeRng('claw-t' + (seed || '')));
const one = (k, x, id) => ({ id: id || 0, k, c: 0, x, w: R.CLAW_KINDS[k].w });
// The step of this turn's sweep when the claw is closest to x (within its first sweeps).
const stepAt = (m, x) => { const c = R.clawCfg(m), xs = R.clawPath(c, m.ph, R.CLAW.hz * 8); let b = 0; xs.forEach((v, k) => { if (Math.abs(v - x) < Math.abs(xs[b] - x)) b = k; }); return b; };

test('claw: one shared case of prizes inside the floor, none overlapping, nothing hidden; first to 3', () => {
  for (let s = 0; s < 40; s++) {
    const m = fresh(s), cs = m.case;
    assert.equal(m.v, 2); assert.ok(Array.isArray(cs)); assert.equal(cs.length, 6);
    for (let i = 0; i < cs.length; i++) {
      assert.ok(cs[i].x - cs[i].w >= R.CLAW.lo - 1e-6 && cs[i].x + cs[i].w <= R.CLAW.hi + 1e-6, 'on the floor');
      if (i) assert.ok(cs[i].x - cs[i].w >= cs[i - 1].x + cs[i - 1].w - 0.11, 'never overlapping');
    }
    assert.ok(m.ph >= 0 && m.ph <= 1);
  }
  const m = fresh();
  assert.deepEqual(m.won, { X: 0, O: 0 }); assert.equal(R.clawCfg(m).goal, 3);
  assert.deepEqual(E.publicMini(m).case, m.case, 'the case is public');
});

test('claw: the carriage sweeps the rail and back; the claw hangs from it as a pendulum, lagging behind it and swinging past where it turns; the same path every time', () => {
  const c = C(), xs = R.clawPath(c, 0, R.CLAW.hz * 10);
  const xc = k => R.clawCarriage(0, c.speed, k / R.CLAW.hz);
  for (let k = 0; k <= R.CLAW.hz * 10; k++) assert.ok(xc(k) >= R.CLAW.sweepLo - 1e-9 && xc(k) <= R.CLAW.sweepHi + 1e-9);
  const lag = []; for (let k = R.CLAW.hz * 4; k < R.CLAW.hz * 9; k++) lag.push(Math.abs(xs[k] - xc(k)));
  assert.ok(Math.max(...lag) > 1, 'the claw is not glued under its carriage');
  assert.ok(Math.max(...xs.slice(R.CLAW.hz * 3)) > R.CLAW.sweepHi - 0.5, 'it swings out to the end');
  assert.deepEqual(R.clawPath(c, 0, 50).slice(0, 50), xs.slice(0, 50), 'the same numbers every time');
});

test('claw: the grip falls from the centre to the edge and is nothing beyond; a slip is likelier at the edge and for a heavy prize', () => {
  const c = C();
  assert.equal(R.clawGrip(c, 0), c.gripMax / 100); assert.equal(R.clawGrip(c, 1), c.gripEdge / 100); assert.equal(R.clawGrip(c, 1.01), 0);
  assert.ok(R.clawGrip(c, 0.5) > R.clawGrip(c, 0.8));
  assert.ok(R.clawSlip(c, 0.9, 'blob') > R.clawSlip(c, 0, 'blob'));
  assert.ok(R.clawSlip(c, 0.3, 'box') > R.clawSlip(c, 0.3, 'ball'));
  const cs = [one('ball', 30), one('box', 40, 1)];
  assert.equal(R.clawTarget(cs, 30).i, 0); assert.equal(R.clawTarget(cs, 39).i, 1); assert.equal(R.clawTarget(cs, 60), null);
});

test('claw: a Drop at a moment of the sweep grabs where the claw was then: won (gone for both), slipped (back in the case), missed; the next turn sweeps from somewhere new', () => {
  const m = fresh(); m.case = [one('blob', 50), one('ball', 80, 1)];
  let k = stepAt(m, 50), x = R.clawX(m, k);
  let r = E.applyMove(m, 'X', { k }, at(0.01, 0.99, 0.5, 0.3));
  assert.equal(m.last.x, x); assert.equal(m.last.k, k);
  assert.deepEqual([r.ok, r.note, m.won.X, m.case.length, m.got.X.length], [true, 'win', 1, 1, 1], 'won: gone from the shared case');
  assert.equal(m.ph, 0.3, 'a fresh sweep for the next turn');
  k = stepAt(m, 80);
  r = E.applyMove(m, 'O', { k }, at(0.01, 0.01, 0.5, 0.7));
  assert.deepEqual([r.note, m.won.O, m.case.length], ['slip', 0, 1]);
  assert.ok(m.case[0].x - m.case[0].w >= R.CLAW.lo, 'kept inside the case');
  m.case = [one('box', 90)]; k = stepAt(m, 25);
  r = E.applyMove(m, 'X', { k }, at(0.01, 0.1, 0.5, 0.2));
  assert.deepEqual([r.note, m.last.pz], ['miss', null], 'nothing under the claw');
  for (const bad of [null, 3, {}, { x: 50 }, { k: -1 }, { k: 1.5 }, { k: R.CLAW.kMax + 1 }]) assert.equal(E.applyMove(m, 'X', bad, at(0.5)).ok, false);
  // first to the goal; the flash and its moments
  const w = fresh('w'); w.won.O = 2; w.case = [one('ball', 55)];
  r = E.applyMove(w, 'O', { k: stepAt(w, 55) }, at(0, 0.99, 0.5));
  assert.deepEqual([r.outcome, w.won.O], ['win', 3]);
  const st = E.newMatch(E.makeRng('cm'), { games: ['claw'] }), sm = st.squares[4].mini;
  assert.ok(E.playMove(st, 4, { k: stepAt(sm, sm.case[0].x) }, E.makeRng('cm2')).ok);
  assert.ok(st.flash.claw && 'res' in st.flash.claw && 'x' in st.flash.claw && 'k' in st.flash.claw && 'ph' in st.flash.claw);
  const T = R.clawTimes(st.flash.claw, false);
  assert.ok(E.playMs(st.flash) >= T.end && T.pre > 0 && R.clawTimes(st.flash.claw, true).pre === 0, 'someone else\'s grab shows the sweep up to the tap first; this phone\'s own does not');
});

test('claw: a square dealt before (a case each, v 1) takes the mover\'s case as the shared one', () => {
  const m = { type: 'claw', won: { X: 1, O: 0 }, got: { X: [{ k: 'ball', c: 0 }], O: [] }, case: { X: [one('ball', 40)], O: [one('box', 70)] }, next: 6, last: null };
  const r = E.applyMove(m, 'O', { k: 10 }, at(0.99, 0.5, 0.5, 0.4));
  assert.ok(r.ok); assert.equal(m.v, 2); assert.ok(Array.isArray(m.case)); assert.equal(m.case[0].k, 'box');
});

test('claw: Go again on success: a prize won keeps the turn', () => {
  E.setTune('claw', { again: 'on' });
  try { const m = fresh('a'); m.case = [one('ball', 55)]; m.case.push(one('box', 85, 1)); const r = E.applyMove(m, 'X', { k: stepAt(m, 55) }, at(0, 0.99, 0.5)); assert.equal(r.again, true); } finally { E.setTune('claw', null); }
});

test('claw: the computer taps when the swinging claw is over a prize: Hard at the likeliest win, its timing error by level', () => {
  const m = fresh('ai'); m.case = [one('box', 30), one('ball', 60, 1)];
  const pm = E.publicMini(m), c = R.clawCfg(m);
  const kb = stepAt(m, 60), kx = stepAt(m, 30);
  assert.ok(A.clawOddsAt(c, m.ph, pm.case, kb, 40) > 0 && A.clawOddsAt(c, m.ph, pm.case, kx, 40) > 0);
  const near = lv => Array.from({ length: 200 }, (_, i) => E.localBest(pm, 'X', E.makeRng(lv + i), {}, { level: lv }).move.k).map(k => R.clawX(m, k)).filter(x => pm.case.some(p => Math.abs(x - p.x) <= p.w)).length;
  assert.ok(near('hard') >= near('easy'), 'Hard lands on a prize at least as often as Easy');
  assert.ok(near('normal') > 100, 'Normal mostly lands on a prize');
  for (let i = 0; i < 20; i++) { const mv = E.localBest(pm, 'X', E.makeRng('k' + i), {}, { level: 'normal' }).move; assert.ok(Number.isInteger(mv.k) && mv.k >= 0 && mv.k <= R.CLAW.kMax); }
  assert.ok(A.needs(pm, 'X') > 1);
});

test('claw: whole squares between the computers end with a winner', () => {
  for (let g = 0; g < 150; g++) {
    const rng = E.makeRng('cw' + g), m = fresh('w' + g); let p = 'X', done = false;
    for (let k = 0; k < 200 && !done; k++) {
      const r = E.applyMove(m, p, E.localBest(E.publicMini(m), p, rng, {}, { level: 'normal' }).move, rng);
      assert.ok(r.ok, r.reason); if (r.outcome === 'win') done = true; else p = p === 'X' ? 'O' : 'X';
    }
    assert.ok(done);
  }
});
