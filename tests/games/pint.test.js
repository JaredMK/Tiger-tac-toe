'use strict';
// Split It (December 2026): its rules and computer (npm test).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const R = require('../../src/games/pint/rules.js');
const M = require('../../src/games/pint/meta.js');

const close = (a, b, e = 1e-6) => Math.abs(a - b) <= e;
test('pint: Admin only, skill, real time, held out of Find Match; the deal: a mark each within the settings\' range, nothing hidden', () => {
  assert.deepEqual([M.release, M.category, M.minVersion, M.realTime, M.placeholder], ['admin', 'skill', '1.30.0', true, false]);
  assert.ok(E.FIND_MATCH_HOLD.includes('pint'), 'the server cannot time a finger letting go');
  assert.deepEqual(E.tuneFields('pint').map(f => f.k), ['goal', 'tol', 'perfect', 'again', 'rate', 'markLo', 'markHi', 'aiMs', 'aiMsHard', 'aiMsEasy']);
  const m = E.newMini('pint', E.makeRng('d')), c = R.pintCfg(m);
  assert.deepEqual([c.goal, c.tol, c.perfect, c.rate, c.lo, c.hi], [3, 0.035, 0.01, 0.5, 0.35, 0.7]);
  assert.deepEqual([m.pts, m.n, m.last], [{ X: 0, O: 0 }, { X: 0, O: 0 }, null]); assert.equal(E.secretOf(m), null);
  for (let k = 0; k < 300; k++) { const t = E.newMini('pint', E.makeRng('deal' + k)); for (const p of ['X', 'O']) { assert.ok(t.mark[p] >= 0.35 && t.mark[p] <= 0.7, `mark ${t.mark[p]}`); assert.equal(Math.round(t.mark[p] * 1000) / 1000, t.mark[p], 'kept to 3 places'); } }
  E.setTune('pint', { markLo: 80, markHi: 40, perfect: 6, tol: 2 });   // (the range the wrong way round, a perfect wider than a split: both put right)
  try { const t = E.newMini('pint', E.makeRng('w')), tc = R.pintCfg(t); assert.deepEqual([tc.lo, tc.hi, tc.tol, tc.perfect], [0.4, 0.8, 0.02, 0.02]); assert.ok(t.mark.X >= 0.4 && t.mark.X <= 0.8); } finally { E.setTune('pint', null); }
});

test('pint: the level falls gently at first, then steadily and a little faster; the hold that leaves a level is its inverse; an empty glass stays empty', () => {
  const c = R.pintCfg(E.newMini('pint', E.makeRng('a')));
  assert.equal(R.pintLevel(c, 0), 1); assert.equal(R.pintLevel(c, -50), 1);
  let prev = 1, prevFall = 0;
  for (let t = 20; t <= 1800; t += 20) { const lv = R.pintLevel(c, t), fall = prev - lv; assert.ok(lv < prev, `falling at ${t}`); assert.ok(fall >= prevFall - 1e-9, `never slowing at ${t}`); prev = lv; prevFall = fall; }
  assert.ok(1 - R.pintLevel(c, 100) < 0.01, 'a gentle start: under 1% in the first tenth of a second');
  assert.ok(close(R.pintSpeed(c, R.PINT.ease), c.rate, 1e-3), 'the full rate once the glass has tipped'); assert.ok(R.pintSpeed(c, 1500) > c.rate * 1.15, 'a little faster as it goes');
  for (const lv of [1, 0.97, 0.9, 0.7, 0.5, 0.35, 0.1, 0]) assert.ok(close(R.pintLevel(c, R.pintTime(c, lv)), lv, 1e-9), `the hold for ${lv}`);
  const empty = R.pintTime(c, 0); assert.ok(empty > 1500 && empty < 2600, `a whole pint in about two seconds: ${empty}`); assert.equal(R.pintLevel(c, empty + 500), 0);
  E.setTune('pint', { rate: 25 }); try { const s = R.pintCfg(E.newMini('pint', E.makeRng('a'))); assert.ok(R.pintTime(s, 0.5) > R.pintTime(c, 0.5) * 1.7, 'a slower drink takes longer'); } finally { E.setTune('pint', null); }
});

test('pint: within the tolerance of the mark\'s middle is a split (1), very close a perfect split (2); too little and too much score nothing; a fresh mark after each attempt; first to 3', () => {
  const m = E.newMini('pint', E.makeRng('b')); m.mark.X = 0.5; m.mark.O = 0.6;
  let r = E.applyMove(m, 'X', { lv: 0.535 }, E.makeRng('x'));
  assert.deepEqual([r.outcome, r.note, !!r.again, m.pts.X, m.n.X, m.last.pts, m.last.mark, m.last.d, m.last.next], ['continue', 'split', false, 1, 1, 1, 0.5, 0.035, 'O'], 'on the edge of the tolerance, above');
  assert.ok(m.mark.X >= 0.35 && m.mark.X <= 0.7 && m.mark.X !== 0.5, 'a fresh pint, a fresh mark'); assert.equal(m.mark.O, 0.6, 'the other player\'s pint is their own');
  r = E.applyMove(m, 'O', { lv: 0.636 }, E.makeRng('x')); assert.deepEqual([r.note, m.pts.O, m.last.pts], ['soon', 0, 0], 'just outside, too little drunk');
  m.mark.O = 0.6; r = E.applyMove(m, 'O', { lv: 0.564 }, E.makeRng('x')); assert.deepEqual([r.note, m.pts.O, m.last.d], ['far', 0, -0.036], 'just outside, gone too far');
  m.mark.O = 0.6; r = E.applyMove(m, 'O', { lv: 0.59 }, E.makeRng('x')); assert.deepEqual([r.note, m.pts.O, m.last.from, m.last.to], ['perfect', 2, 0, 2], 'within the perfect tolerance');
  m.mark.O = 0.6; r = E.applyMove(m, 'O', { lv: 0.589 }, E.makeRng('x')); assert.deepEqual([r.outcome, r.note, m.pts.O], ['win', 'won', 3], 'a split takes the third point');
  const e = E.newMini('pint', E.makeRng('e')); e.mark.X = 0.36;
  E.setTune('pint', null); r = E.applyMove(e, 'X', { lv: 0 }, E.makeRng('x')); assert.deepEqual([r.note, e.pts.X, e.last.pts], ['empty', 0, 0], 'a glass drunk empty is a miss');
  r = E.applyMove(e, 'O', { lv: 1 }, E.makeRng('x')); assert.equal(r.note, 'soon', 'let go at once: nothing drunk');
  const k = E.newMini('pint', E.makeRng('k')); k.mark.X = 0.4444; r = E.applyMove(k, 'X', { lv: 0.44449 }, E.makeRng('x')); assert.equal(k.last.lv, 0.444, 'the level is kept to 3 places');
  const two = E.newMini('pint', E.makeRng('t')); two.pts.X = 2; two.mark.X = 0.5; r = E.applyMove(two, 'X', { lv: 0.5 }, E.makeRng('x')); assert.deepEqual([r.outcome, two.pts.X], ['win', 3], 'the points never pass the goal');
});

test('pint: a move is held to its shape and range', () => {
  for (const bad of [null, undefined, {}, 'x', 0.5, [0.5], { lv: '0.5' }, { lv: NaN }, { lv: Infinity }, { lv: -0.001 }, { lv: 1.001 }, { lv: null }, { level: 0.5 }]) {
    const m = E.newMini('pint', E.makeRng('z')), before = JSON.stringify(m);
    assert.equal(E.applyMove(m, 'O', bad, E.makeRng('x')).ok, false, JSON.stringify(bad)); assert.equal(JSON.stringify(m), before, 'a refused move changes nothing');
  }
});

test('pint: Go again on success: off, every attempt ends the turn; on, any split keeps it (a miss ends it, the winning one wins)', () => {
  const f = E.tuneFields('pint').find(x => x.k === 'again'); assert.deepEqual([f.label, f.def, f.opts], ['Go again on success', 'off', ['off', 'on']]);
  assert.equal(E.newMini('pint', E.makeRng('g')).tune, undefined, 'nothing kept for the default');
  E.setTune('pint', { again: 'on' });
  try {
    const m = E.newMini('pint', E.makeRng('g')); m.mark.X = 0.5;
    let r = E.applyMove(m, 'X', { lv: 0.52 }, E.makeRng('x')); assert.deepEqual([r.note, r.again, m.last.next], ['split', true, 'X']);
    m.mark.X = 0.5; r = E.applyMove(m, 'X', { lv: 0.6 }, E.makeRng('x')); assert.deepEqual([r.note, !!r.again, m.last.next], ['soon', false, 'O']);
    m.mark.X = 0.5; r = E.applyMove(m, 'X', { lv: 0.5 }, E.makeRng('x')); assert.deepEqual([r.outcome, !!r.again], ['win', false]);
  } finally { E.setTune('pint', null); }
  assert.match(M.goAgainText.on, /Go again/); assert.equal(M.goAgainText.off, '');
});

test('pint: the public view is the whole square (nothing hidden) and a copy; the flash carries the attempt; a timeout plays nothing', () => {
  const m = E.newMini('pint', E.makeRng('p')), pv = E.publicMini(m, 'O');
  assert.deepEqual(pv, JSON.parse(JSON.stringify(m))); pv.mark.X = 9; pv.pts.O = 9; assert.notEqual(m.mark.X, 9); assert.equal(m.pts.O, 0);
  const st = E.newMatch(E.makeRng('i'), { games: ['pint'] }), p = st.turn, mark = st.squares[4].mini.mark[p];
  assert.ok(E.playMove(st, 4, { lv: mark }, E.makeRng('s')).ok);
  assert.deepEqual(Object.keys(st.flash.pn).sort(), ['by', 'd', 'from', 'lv', 'mark', 'ms', 'n', 'next', 'pts', 'to']); assert.deepEqual([st.flash.pn.by, st.flash.pn.pts, st.flash.pn.mark], [p, 2, mark]);
  const c = R.pintCfg(st.squares[4].mini); assert.ok(Math.abs(st.flash.pn.ms - R.pintTime(c, mark)) <= 0.5, 'the hold the level took, for the replay');
  assert.ok(E.playMs(st.flash) >= R.pintMs(st.flash.pn, false), 'the flash covers the hold, the settle, the verdict and the fresh pint'); assert.equal(R.pintMs({ ms: 900 }, false), 900 + R.PINT.settle + R.PINT.say + R.PINT.hold + R.PINT.next);
  assert.equal(R.timeoutClose(st.squares[4].mini, p), null);
});

test('pint: the computer lets go early or late by its level\'s timing error, never perfectly; every move legal; whole squares end; a player alone still wins', () => {
  const rate = level => { let pts = 0, split = 0, exact = 0; const N = 3000; for (let k = 0; k < N; k++) { const rng = E.makeRng(level + k), t = E.newMini('pint', rng), mk = t.mark.X, mv = E.localBest(E.publicMini(t, 'X'), 'X', rng, {}, { level }).move; assert.ok(mv && typeof mv.lv === 'number' && mv.lv >= 0 && mv.lv <= 1, JSON.stringify(mv)); if (mv.lv === mk) exact++; const r = E.applyMove(t, 'X', mv, rng); assert.ok(r.ok); pts += t.last.pts; if (t.last.pts) split++; } return { pts: pts / N, split: split / N, exact: exact / N }; };
  const e = rate('easy'), n = rate('normal'), h = rate('hard');
  assert.ok(e.pts < n.pts && n.pts < h.pts, `points an attempt: easy ${e.pts.toFixed(2)} < normal ${n.pts.toFixed(2)} < hard ${h.pts.toFixed(2)}`);
  assert.ok(n.split > 0.35 && n.split < 0.6, `Normal splits about two pints in five: ${n.split.toFixed(2)}`); assert.ok(h.split < 0.75 && h.exact < 0.05, `Hard is no perfect release: ${h.split.toFixed(2)}, dead on ${h.exact.toFixed(3)}`);
  for (const again of [null, { again: 'on' }]) {
    E.setTune('pint', again);
    try {
      let wins = 0, agains = 0;
      for (let g = 0; g < 200; g++) { const rng = E.makeRng('w' + g), t = E.newMini('pint', rng); let p = 'X'; for (let k = 0; k < 400; k++) { const r = E.applyMove(t, p, g % 2 ? E.randomLegalMove(t, p, rng) : E.localBest(E.publicMini(t, p), p, rng, {}, { level: ['easy', 'normal', 'hard'][g % 3] }).move, rng); assert.ok(r.ok, r.reason); if (r.outcome === 'win') { wins++; break; } assert.equal(r.outcome, 'continue'); if (r.again) agains++; else p = p === 'X' ? 'O' : 'X'; } }
      assert.equal(wins, 200); assert.equal(agains > 0, !!again);
    } finally { E.setTune('pint', null); }
  }
  for (let g = 0; g < 60; g++) {                                    // one side misses every turn (an empty glass); the other still wins, alone
    const rng = E.makeRng('solo' + g), t = E.newMini('pint', rng); let p = 'X', won = null;
    for (let k = 0; k < 600 && !won; k++) { const r = E.applyMove(t, p, p === 'O' ? { lv: 0 } : E.localBest(E.publicMini(t, 'X'), 'X', rng, {}, { level: 'easy' }).move, rng); assert.ok(r.ok); if (r.outcome === 'win') won = p; p = p === 'X' ? 'O' : 'X'; }
    assert.equal(won, 'X'); assert.equal(t.pts.O, 0);
  }
});

test('pint: the help text follows the settings and names no drink', () => {
  assert.match(M.explainer.win, /\{goal\}/); assert.match(M.explainer.play, /\{goAgain\}/);
  assert.doesNotMatch(JSON.stringify([M.info, M.explainer, M.goAgainText, M.TUNE.map(f => f.label)]), /beer|stout|ale\b|lager|guinness|alcohol|booze|drunk\b|bet\b|jackpot/i);
});
