'use strict';
// Bin Shot (the second December 2026 batch: its Paper Toss): its rules and computer (npm test).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const R = require('../../src/games/toss/rules.js');
const M = require('../../src/games/toss/meta.js');

// no spread (gauss 0 twice), then the next fan: strength from `s` (0..1), blowing right when `right`
const still = (s = 0.5, right = true) => { const v = [0.9, 0.25, 0.9, 0.25, s, right ? 0.9 : 0.1]; let k = 0; return () => v[k++ % v.length]; };
test('toss: Admin only, skill, a name of its own; its settings; the deal: a fan for each player within its range', () => {
  assert.deepEqual([M.release, M.category, M.minVersion, M.placeholder, M.info.name], ['admin', 'skill', '1.29.0', false, 'Bin Shot']);
  assert.deepEqual(E.gameFields('toss').map(f => f.k), ['goal', 'dist', 'bin', 'windMin', 'windMax', 'rim', 'rimIn', 'spread', 'flickMin', 'flickMax', 'aiErr', 'aiErrHard', 'aiErrEasy']);
  for (let g = 0; g < 80; g++) { const m = E.newMini('toss', E.makeRng('d' + g)); for (const p of ['X', 'O']) assert.ok(Math.abs(m.wind[p]) >= 4 && Math.abs(m.wind[p]) <= 26, `fan ${m.wind[p]}`); assert.deepEqual([m.v, m.dist, m.bin, m.rim, m.rimIn], [2, 80, 8, 3.5, 40]); }
  assert.equal(E.secretOf(E.newMini('toss', E.makeRng('s'))), null, 'the fan is on show');
});

test('toss: the fan carries a throw sideways; aimed into the wind it drops in the bin; the fan changes after every throw', () => {
  const m = E.newMini('toss', E.makeRng('a')); m.wind.X = 12; m.wind.O = -20; m.bin = 10; m.rimIn = 0;
  let r = E.applyMove(m, 'X', R.tossFlickAt(50, 80), still());
  assert.deepEqual([r.note, m.last.in, m.last.rim, m.last.x, m.last.wind, m.in.X], ['miss', false, true, 62, 12, 0], 'straight at the bin: carried 12 to the right, onto the rim');
  assert.equal(m.wind.X, m.last.next); assert.notEqual(m.wind.X, 12); assert.equal(m.wind.O, -20, 'the other player\'s fan is their own');
  r = E.applyMove(m, 'O', R.tossFlickAt(70, 80), still(0, false));
  assert.deepEqual([r.outcome, r.note, !!r.again, m.last.in, m.in.O, m.wind.O], ['continue', 'in', false, true, 1, -4], 'aimed 20 to the right of the bin, into the wind');
  m.wind.X = 0; r = E.applyMove(m, 'X', R.tossFlickAt(50, 40), still()); assert.deepEqual([m.last.in, m.last.rim], [false, false], 'short');
  m.in.O = 2; m.wind.O = 0; r = E.applyMove(m, 'O', R.tossFlickAt(50, 80), still()); assert.deepEqual([r.outcome, m.in.O], ['win', 3]);
  for (const bad of [null, {}, { a: 2, p: 0.5 }, 'x']) assert.equal(E.applyMove(m, 'X', bad, still()).ok, false);
  const far = E.newMini('toss', E.makeRng('f')); far.bin = 10; far.wind.X = 20; E.applyMove(far, 'X', R.tossFlickAt(50, 40), still()); assert.equal(far.last.x, 60, 'half the way: half the push');
});

test('toss: the computer allows for the fan, with an error by level; the flash; whole squares end with a winner', () => {
  const rate = level => { let h = 0; for (let k = 0; k < 900; k++) { const rng = E.makeRng(level + k), t = E.newMini('toss', rng); if (E.applyMove(t, 'X', E.localBest(E.publicMini(t), 'X', rng, {}, { level }).move, rng).note === 'in') h++; } return h / 900; };
  const e = rate('easy'), n = rate('normal'), h = rate('hard');
  assert.ok(e < n && n < h, `baskets a throw: easy ${e.toFixed(2)} < normal ${n.toFixed(2)} < hard ${h.toFixed(2)}`); assert.ok(n > 0.35 && n < 0.7, `Normal ${n.toFixed(2)}`);
  const st = E.newMatch(E.makeRng('i'), { games: ['toss'] }), p = st.turn;
  assert.ok(E.playMove(st, 4, { a: 0, p: 0.5 }, E.makeRng('s')).ok);
  assert.deepEqual(Object.keys(st.flash.ts).sort(), ['a', 'ax', 'ay', 'bx', 'by', 'by2', 'from', 'in', 'kind', 'next', 'p', 'rim', 'to', 'wind', 'x', 'y']);
  assert.ok(E.playMs(st.flash) >= R.TOSS.fly); assert.equal(R.timeoutClose(st.squares[4].mini, p), null);
  let wins = 0;
  for (let g = 0; g < 120; g++) { const rng = E.makeRng('w' + g), t = E.newMini('toss', rng); let q = 'X'; for (let k = 0; k < 900; k++) { const r = E.applyMove(t, q, E.localBest(E.publicMini(t), q, rng, {}, { level: ['easy', 'normal', 'hard'][g % 3] }).move, rng); assert.ok(r.ok); if (r.outcome === 'win') { wins++; break; } q = q === 'X' ? 'O' : 'X'; } }
  assert.equal(wins, 120);
});

test('toss: the rim (v 2): a ball within `rim` of the edge drops in `rimIn` per cent of the time, else bounces out onto the floor; a square from before never drops in', () => {
  const shot = (rimIn, v, u) => { const m = E.newMini('toss', E.makeRng('r')); m.wind.X = 0; m.bin = 8; m.rim = 3.5; m.rimIn = rimIn; if (!v) delete m.v; const vals = [0.9, 0.25, 0.9, 0.25, u, 0.5, 0.9]; let k = 0; E.applyMove(m, 'X', R.tossFlickAt(59.5, 80), () => vals[k++ % vals.length]); return m.last; };
  let l = shot(40, 2, 0.1); assert.deepEqual([l.kind, l.in, l.rim, l.to], ['rimin', true, true, 1]);
  l = shot(40, 2, 0.9); assert.deepEqual([l.kind, l.in, l.to], ['rimout', false, 0]); assert.ok(l.bx > 59.5 && Math.abs(l.by2 - 80) < 1, `out to ${l.bx},${l.by2}`);
  l = shot(100, 0, 0.1); assert.deepEqual([l.kind, l.in], ['rimout', false], 'a square from before: off the rim, never in');
  assert.deepEqual(E.gameFields('toss').filter(f => f.k === 'rim' || f.k === 'rimIn').map(f => [f.k, f.def]), [['rim', 3.5], ['rimIn', 40]]);
});
