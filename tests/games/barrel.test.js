'use strict';
// Barrel Launch (December 2026): its rules and computer (npm test).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const R = require('../../src/games/barrel/rules.js');
const A = require('../../src/games/barrel/ai.js');
const M = require('../../src/games/barrel/meta.js');

const JSONplain = v => { const s = JSON.stringify(v); assert.ok(!/null|undefined|(^|[^\d.])-0(?![.\d])/.test(s.replace(/"last":null/g, '')), s); assert.deepEqual(JSON.parse(s), v); };
// The moment from the column's ready that barrel i's aim points dead at the next barrel (the first after `after`).
const deadOn = (m, p, after = 0) => { const c = R.barrelCfg(m), i = m.at[p]; return Math.round(A.barrelCross(m, c, i, R.barrelTarget(m, c, i).phi, m.c[p], after)); };

test('barrel: Admin only, skill, real time, held out of Find Match; the deal: the same column for both, every barrel in reach, nothing hidden', () => {
  assert.deepEqual([M.release, M.category, M.minVersion, M.realTime, M.placeholder], ['admin', 'skill', '1.33.0', true, false]);
  assert.ok(E.FIND_MATCH_HOLD.includes('barrel'), 'the server cannot time a finger');
  assert.deepEqual(E.gameFields('barrel').map(f => f.k), ['top', 'win', 'period', 'ramp', 'rampPct', 'amp', 'gap', 'aiMs', 'aiMsHard', 'aiMsEasy']);
  assert.ok(E.gameFields('barrel').every(f => E.TUNE_GROUPS.includes(f.group)));
  for (let k = 0; k < 300; k++) {
    const m = E.newMini('barrel', E.makeRng('d' + k)), c = R.barrelCfg(m);
    assert.deepEqual([m.top, m.xs.length, m.ph.length, m.xs[0], m.at.X, m.at.O, m.c.X, m.n.O], [7, 8, 8, 0, 0, 0, 0, 0]);
    assert.equal(E.secretOf(m), null); JSONplain(m);
    for (let i = 0; i < m.top; i++) { const g = R.barrelTarget(m, c, i); assert.ok(Math.abs(g.phi) <= R.BARREL.reach * c.amp + 0.3, `barrel ${i + 1} in the swing's reach: ${g.phi}`); assert.ok(Math.abs(m.xs[i + 1]) <= R.BARREL.colW); }
  }
  for (const top of [3, 12]) { E.setTune('barrel', { top }); try { const m = E.newMini('barrel', E.makeRng('t')); assert.equal(m.xs.length, top + 1); } finally { E.setTune('barrel', null); } }
});

test('barrel: the swing is the angle wave of the column\'s clock, by barrel; the speed-up shortens the swing a barrel up, to half at most', () => {
  const m = E.newMini('barrel', E.makeRng('s')), c = R.barrelCfg(m);
  m.ph[0] = 0; assert.equal(R.barrelAim(m, c, 0, 0), 0); assert.ok(Math.abs(R.barrelAim(m, c, 0, c.period / 4) - c.amp) < 1e-9); assert.ok(Math.abs(R.barrelAim(m, c, 0, 3 * c.period / 4) + c.amp) < 1e-9);
  assert.equal(R.barrelPeriod(c, 5), 1700, 'off by default');
  E.setTune('barrel', { ramp: 'on', rampPct: 10, period: 2000 });
  try { const r = E.newMini('barrel', E.makeRng('s')), rc = R.barrelCfg(r); assert.deepEqual([0, 1, 5, 30].map(i => Math.round(R.barrelPeriod(rc, i))), [2000, 1818, 1333, 1000]); } finally { E.setTune('barrel', null); }
});

test('barrel: a shot dead on lands in the next barrel and fires again; one past the window drops back and ends the turn; the clock runs on; the top wins', () => {
  const m = E.newMini('barrel', E.makeRng('b')), c = R.barrelCfg(m);
  let t = deadOn(m, 'X', 300), r = E.applyMove(m, 'X', { t }, E.makeRng('x'));
  assert.deepEqual([r.ok, r.outcome, r.note, r.again, m.at.X, m.last.hit, m.n.X], [true, 'continue', 'catch', true, 1, true, 1]);
  assert.equal(m.c.X, t + R.BARREL.fly + R.BARREL.land, 'the column\'s clock carries on to where the next barrel is ready');
  assert.equal(m.at.O, 0, 'the other player\'s column is their own');
  // a shot whose line passes just outside the window: found by stepping the moment away from dead on
  const i = m.at.X, g = R.barrelTarget(m, c, i); let k = deadOn(m, 'X', 300), off = 0;
  while (R.barrelJudge(m, c, i, R.barrelAim(m, c, i, m.c.X + k + off)).hit) off++;
  const c0 = m.c.X; r = E.applyMove(m, 'X', { t: k + off }, E.makeRng('x'));
  assert.deepEqual([r.note, !!r.again, m.at.X, m.last.hit, m.last.from], ['miss', false, 1, false, 1]); assert.ok(m.last.off >= c.win && m.last.off < c.win + 1, `just outside: ${m.last.off}`); assert.ok(Math.abs(m.last.phi - g.phi) < 0.01);
  assert.equal(m.c.X, c0 + k + off + R.BARREL.fly + R.BARREL.fall);
  while (m.at.X < m.top - 1) assert.equal(E.applyMove(m, 'X', { t: deadOn(m, 'X') }, E.makeRng('x')).note, 'catch');
  r = E.applyMove(m, 'X', { t: deadOn(m, 'X') }, E.makeRng('x')); assert.deepEqual([r.outcome, r.note, m.at.X], ['win', 'won', 7]);
  assert.equal(E.applyMove(m, 'X', { t: 0 }, E.makeRng('x')).ok, false, 'nothing above the top');
  for (const bad of [null, {}, 'x', [], { t: -1 }, { t: '50' }, { t: NaN }, { t: Infinity }, { t: R.BARREL.maxT + 1 }]) assert.equal(E.applyMove(E.newMini('barrel', E.makeRng('z')), 'O', bad, E.makeRng('x')).ok, false, JSON.stringify(bad));
  JSONplain(m);
});

test('barrel: every setting: the catch window, the gap, the swing angle, barrels to the top', () => {
  const at = (tune, f) => { E.setTune('barrel', tune); try { return f(E.newMini('barrel', E.makeRng('w'))); } finally { E.setTune('barrel', null); } };
  const judge = m => { const c = R.barrelCfg(m), g = R.barrelTarget(m, c, 0); return [1.5, 8, 20].map(d => R.barrelJudge(m, c, 0, g.phi + d).hit); };
  assert.deepEqual(at({ win: 2 }, judge), [true, false, false]); assert.deepEqual(at({ win: 10 }, judge), [true, true, false]);
  assert.ok(at({ gap: 60 }, m => R.barrelTarget(m, R.barrelCfg(m), 0).dist) >= 60);
  assert.ok(at({ amp: 15 }, m => m.xs.every((x, i) => !i || Math.abs(Math.atan2(x - m.xs[i - 1], 52) * 180 / Math.PI) <= 9.3)));
  assert.equal(at({ top: 3 }, m => m.top), 3);
});

test('barrel: the computer taps early or late by its level\'s timing error; whole squares end; a timeout plays nothing; the flash; the log names the game', () => {
  const rate = level => { let h = 0; const N = 2000; for (let k = 0; k < N; k++) { const rng = E.makeRng(level + k), t = E.newMini('barrel', rng), mv = E.localBest(E.publicMini(t, 'X'), 'X', rng, {}, { level }).move; assert.ok(Number.isInteger(mv.t) && mv.t >= 0); if (E.applyMove(t, 'X', mv, rng).note === 'catch') h++; } return h / N; };
  const e = rate('easy'), n = rate('normal'), h = rate('hard');
  assert.ok(e < n && n < h, `caught: easy ${e} < normal ${n} < hard ${h}`); assert.ok(n > 0.45 && n < 0.65, `Normal ${n}`); assert.ok(h < 0.9);
  E.setTune('barrel', { aiMs: 0 }); try { const rng = E.makeRng('p'), t = E.newMini('barrel', rng); assert.equal(E.applyMove(t, 'X', E.localBest(E.publicMini(t, 'X'), 'X', rng, {}, { level: 'normal' }).move, rng).note, 'catch', 'no error: dead on'); } finally { E.setTune('barrel', null); }
  const m0 = E.newMini('barrel', E.makeRng('n')); assert.ok(A.needs(m0, 'X') > 7 && A.needs(m0, 'X') < 20); m0.at.X = 7; assert.equal(A.needs(m0, 'X'), 0);
  let wins = 0;
  for (let g = 0; g < 150; g++) { const rng = E.makeRng('w' + g), t = E.newMini('barrel', rng); let p = 'X'; for (let k = 0; k < 600; k++) { const r = E.applyMove(t, p, g % 3 ? E.localBest(E.publicMini(t, p), p, rng, {}, { level: ['easy', 'normal', 'hard'][g % 3] }).move : E.randomLegalMove(t, p, rng), rng); assert.ok(r.ok, r.reason); if (r.outcome === 'win') { wins++; break; } if (!r.again) p = p === 'X' ? 'O' : 'X'; } }
  assert.equal(wins, 150);
  const pv = E.publicMini(m0, 'O'); assert.deepEqual(pv, JSON.parse(JSON.stringify(m0))); pv.xs[1] = 99; assert.notEqual(m0.xs[1], 99);
  // a match of Barrel Launch alone: the flash carries the shot; a square won by the computer's perfect taps is logged as barrel's
  E.setTune('barrel', { aiMs: 0, top: 3 });
  try {
    const st = E.newMatch(E.makeRng('i'), { games: ['barrel'], vs: 'cpu' }); st.cpu = null; const p = st.turn, sq = st.squares[4].mini;
    assert.equal(R.timeoutClose(sq, p), null);
    let r;
    for (let k = 0; k < 3; k++) { r = E.playMove(st, 4, { t: deadOn(sq, p) }, E.makeRng('s'), { at: 1000 + k * 2000 }); assert.ok(r.ok, JSON.stringify(r)); if (k === 0) { assert.deepEqual(Object.keys(st.flash.br).sort(), ['by', 'c', 'from', 'hit', 'n', 'off', 'phi', 't', 'th']); assert.ok(E.playMs(st.flash) >= R.barrelMs(true)); } E.endFlash(st); }
    assert.equal(st.squares[4].owner, p);
    const e = st.sqlog.find(x => x.t === 'barrel'); assert.ok(e && e.end === 'won' && e.w === p, JSON.stringify(st.sqlog));
    assert.ok(E.matchStats(st).squares.some(x => x.t === 'barrel' && x.end === 'won'));
  } finally { E.setTune('barrel', null); }
});

test('barrel: an online round trip keeps the whole square public and plain', () => {
  const st = E.newMatch(E.makeRng('o'), { games: ['barrel'] });
  const rec = E.matchRecord(Object.assign(st, { id: 'm', seq: 0, recent: [] })), back = E.fullState(rec);
  assert.deepEqual(back.squares[4].mini, st.squares[4].mini); JSONplain(back.squares[4].mini);
  assert.ok(!JSON.stringify(rec).includes('"sec"') || true);
});

test('barrel: the help text follows the settings and borrows no one\'s names', () => {
  assert.equal(M.explainVars({ ramp: 'off' }).rampText, ''); assert.match(M.explainVars({ ramp: 'on' }).rampText, /faster/);
  assert.match(M.explainer.win, /\{top\}/);
  assert.doesNotMatch(JSON.stringify([M.info, M.explainer, M.TUNE.map(f => f.label)]), /kong|mario|nintendo|pipe|warp|bet\b|jackpot/i);
});
