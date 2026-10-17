'use strict';
// What the finger games (Sky Hop, Scoop Stack, Pinball) share, tested once for all of them (npm test).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const P = require('../physics.js');
E.setPhysics(P);

const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const hopMini = (seed, h0) => ({ type: 'skyhop', cfg: E.hopConfig(), seed: { X: seed, O: seed + 1 }, height: { X: h0 || 0, O: 0 }, tries: { X: 0, O: 0 }, last: null });
const scoopMini = (seed, n0, tries) => ({ type: 'scoop', cfg: E.scoopConfig(), seed: { X: seed, O: seed + 1 }, stack: { X: Array.from({ length: n0 || 0 }, (_, k) => k % 5), O: [] }, tries: { X: tries || 0, O: 0 }, last: null });

/* ===================================== the checks, the computer, timeouts, matches ===================================== */
test('the checks: a phone\'s Sky Hop or Scoop Stack attempt passes only as played (its height, its end, its length), within the longest allowed', () => {
  const mini = hopMini(11, 40), r = E.hopAi(mini, 'X', E.makeRng('c1')).move;
  assert.equal(E.fingCheck(mini, 'X', r).why, null);
  assert.equal(E.fingCheck(mini, 'X', Object.assign({}, r, { h: r.h + 10 })).why, 'replay', 'more height than the inputs give');
  assert.equal(E.fingCheck(mini, 'X', Object.assign({}, r, { end: r.end === 'fall' ? 'hazard' : 'fall' })).why, 'replay');
  assert.equal(E.fingCheck(mini, 'X', Object.assign({}, r, { steps: r.steps + 500 })).why, 'replay', 'it ended sooner than said');
  assert.equal(E.fingCheck(mini, 'X', Object.assign({}, r, { steps: E.FING.maxSecs / E.FING.step + 1 })).why, 'bad', 'longer than any attempt');
  assert.equal(E.fingCheck(mini, 'X', Object.assign({}, r, { log: 'not:a:log' })).why, 'bad');
  const sm = scoopMini(12, 3, 1), s = E.scoopAi(sm, 'X', E.makeRng('c2')).move;
  assert.equal(E.fingCheck(sm, 'X', s).why, null);
  assert.equal(E.fingCheck(sm, 'X', Object.assign({}, s, { n: s.n + 1 })).why, 'replay');
  // an attempt cut short (the time ran out): as it stood, gains kept
  const cut = E.hopStart(hopMini(13, 0), 'X'), rec = E.fingRecorder();
  for (let k = 0; k < 1500 && !cut.end; k++) E.hopStep(cut, rec.at(cut.n, 4.5 + Math.sin(k / 90) * 2));
  const out = Object.assign({ log: E.fingLog(rec.pairs) }, E.hopResult(cut));
  if (!cut.end) assert.equal(out.end, 'out');
  const m2 = hopMini(13, 0), st = { squares: [{ owner: null, mini: m2 }] };
  assert.equal(E.fingCheck(m2, 'X', out).why, null, 'an attempt that ended where it stood passes too');
  void st;
});
test('timeouts: a timed-out turn makes no attempt and changes nothing; an attempt cut off by the clock keeps its gains; the replay takes the attempt\'s time (faster past the cap)', () => {
  const st = E.newMatch(lcg(8), { games: ['skyhop'] });
  st.timer = E.newTimer(60); st.timer.deadline = 1;
  const before = JSON.stringify(st.squares.map(q => q.mini.height));
  const r = E.timeoutMove(st, lcg(9));
  assert.equal(r.ok, true);
  assert.equal(r.move, 'auto');
  assert.equal(JSON.stringify(st.squares.map(q => q.mini.height)), before, 'no height gained or lost');
  assert.equal(st.flash.fing.auto, true);
  assert.equal(E.fingMs(st.flash.fing), 0, 'nothing to replay');
  assert.equal(E.fingMs({ type: 'skyhop', steps: 1200 }), 10000); assert.equal(E.fingMs({ type: 'pinball', ms: 95000 }), E.FING.replayMax);
  assert.equal(E.fingRaw({ type: 'pinball', ms: 95000 }), 95000);
});
test('the start: Start holds the player to the square (here and online), and is no bonus move; the computer\'s view of a square leaves out inputs and recordings', () => {
  const st = E.newMatch(lcg(10), { games: ['scoop'] });
  assert.equal(E.attStart(st, 2, 'X').ok, true); assert.equal(st.lock, 2);
  assert.equal(E.attStart(st, 3, 'X').ok, false, 'not another square');
  const r = E.scoopAi(st.squares[2].mini, 'X', E.makeRng('b')).move;
  assert.equal(E.playMove(st, 2, r, lcg(1)).ok, true);
  E.endFlash(st);
  assert.equal(st.turn, 'O', 'the turn passes'); assert.equal(st.lock, null);
  const pub = E.publicMini(st.squares[2].mini);
  assert.equal(pub.last.log, undefined); assert.equal(st.squares[2].mini.last.log, r.log);
});
