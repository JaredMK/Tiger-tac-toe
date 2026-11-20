'use strict';
// Road Race (the second December 2026 batch): its rules and computer (npm test).
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../engine.js');
const R = require('../../src/games/rally/rules.js');
const M = require('../../src/games/rally/meta.js');

test('rally: Admin only, skill, real time, held out of Find Match; its settings', () => {
  assert.deepEqual([M.release, M.category, M.minVersion, M.placeholder, M.realTime], ['admin', 'skill', '1.25.0', false, true]);
  assert.ok(E.FIND_MATCH_HOLD.includes('rally'), 'how fast the steps were played is the phone\'s word');
  assert.deepEqual(E.tuneFields('rally').map(f => f.k), ['laps', 'speed', 'steer', 'width', 'tracks', 'aiLapse', 'aiLapseHard', 'aiLapseEasy']);
  const c = R.rallyCfg(E.newMini('rally', E.makeRng('a')));
  assert.deepEqual([c.laps, c.speed, c.steer, c.half, c.set, R.rallySteps(c)], [2, 60, 62, 17, 'mixed', 542]);
});

test('rally: an attempt\'s road: the same wherever worked out, new each attempt, straight at both ends, always on the screen, never too sharp to follow', () => {
  for (const tracks of ['mixed', 'gentle', 'twisty']) {
    E.setTune('rally', { tracks });
    try {
      for (let g = 0; g < 25; g++) {
        const m = E.newMini('rally', E.makeRng('r' + g)), c = R.rallyCfg(m), tr = R.rallyTrack(m, 'X');
        assert.deepEqual(tr, R.rallyTrack(JSON.parse(JSON.stringify(m)), 'X')); assert.notDeepEqual(tr, R.rallyTrack(m, 'O'));
        assert.equal(R.rallyCentre(tr, 0), 50); assert.ok(Math.abs(R.rallyCentre(tr, R.RALLY.len) - 50) < 1e-9);
        for (let s = 0; s <= R.RALLY.len; s += 2) { const x = R.rallyCentre(tr, s); assert.ok(x - c.half >= 0 && x + c.half <= 100, `${tracks}: the road stays on the screen at ${s} (${x.toFixed(1)})`); }
        const perfect = R.rallyRun(c, tr, null, null, (k, x, s) => Math.round(R.rallyCentre(tr, Math.min(R.RALLY.len, s + c.speed * 0.2))));
        assert.equal(perfect.done, true, `${tracks}: a steady hand gets round (road ${g})`);
        const before = JSON.stringify(tr); E.applyMove(m, 'X', { log: [], steps: 5 }, E.makeRng('x')); assert.notEqual(JSON.stringify(R.rallyTrack(m, 'X')), before);
      }
    } finally { E.setTune('rally', null); }
  }
});

test('rally: the attempt is driven again from its steering: off the road is a crash, the lap\'s end a lap; first to 2 laps', () => {
  const m = E.newMini('rally', E.makeRng('b')), c = R.rallyCfg(m), tr = R.rallyTrack(m, 'X'), d = R.rallyDrive(c, tr, E.makeRng('steady'), 0);
  assert.deepEqual([d.run.done, d.steps], [true, 540]); assert.ok(d.log.length > 5 && R.rallyLogOk(d.log, d.steps));
  assert.deepEqual(R.rallyRun(c, tr, d.log, d.steps), d.run, 'the same steering, the same lap');
  const off = R.rallyRun(c, tr, [[0, 100]], 400);
  assert.deepEqual([off.done, off.crash, off.step], [false, true, 14], 'hard right from the start: off the road in 14 steps (62 a second across, 13.6 to the kerb)');
  const short = R.rallyRun(c, tr, d.log, 120); assert.deepEqual([short.done, short.crash, short.s], [false, false, 120], 'an attempt left early: as far as it got');
  let r = E.applyMove(m, 'X', { log: [[0, 100]], steps: 400 }, E.makeRng('x'));
  assert.deepEqual([r.outcome, r.note, !!r.again, m.laps.X, m.last.crash, m.last.pct, m.n.X], ['continue', 'crash', false, 0, true, 3, 1]);
  for (const bad of [null, {}, { log: [], steps: -1 }, { log: [[0, 2]], steps: 1.5 }, { log: [[5, 50], [3, 40]], steps: 9 }, { log: [[0, 101]], steps: 9 }, { log: [[0, 50.5]], steps: 9 }, { log: 'x', steps: 9 }, { log: [[0]], steps: 9 }]) assert.equal(E.applyMove(m, 'O', bad, E.makeRng('x')).ok, false, JSON.stringify(bad));
  const lap = () => { const dd = R.rallyDrive(c, R.rallyTrack(m, 'X'), E.makeRng('steady'), 0); return E.applyMove(m, 'X', { log: dd.log, steps: dd.steps }, E.makeRng('x')); };
  r = lap(); assert.deepEqual([r.outcome, r.note, m.laps.X, m.last.done, m.last.pct], ['continue', 'lap', 1, true, 100]);
  r = lap(); assert.deepEqual([r.outcome, m.laps.X], ['win', 2]);
});

test('rally: the computer by level; the flash; a timeout plays nothing; whole squares end with a winner', () => {
  const rate = level => { let ok = 0; for (let k = 0; k < 500; k++) { const t = E.newMini('rally', E.makeRng('q' + k)), rng = E.makeRng(level + k); E.applyMove(t, 'X', E.localBest(E.publicMini(t), 'X', rng, {}, { level }).move, rng); if (t.last.done) ok++; } return ok / 500; };
  const e = rate('easy'), n = rate('normal'), h = rate('hard');
  assert.ok(e < n && n < h, `laps finished: easy ${e.toFixed(2)} < normal ${n.toFixed(2)} < hard ${h.toFixed(2)}`);
  const st = E.newMatch(E.makeRng('i'), { games: ['rally'] }), p = st.turn;
  assert.ok(E.playMove(st, 4, { log: [], steps: 60 }, E.makeRng('s')).ok);
  assert.deepEqual(Object.keys(st.flash.rr).sort(), ['by', 'crash', 'done', 'from', 'pct', 'to']);
  assert.ok(E.playMs(st.flash) >= R.rallyShowMs()); assert.equal(R.timeoutClose(st.squares[4].mini, p), null);
  let wins = 0;
  for (let g = 0; g < 90; g++) { const rng = E.makeRng('w' + g), t = E.newMini('rally', rng); let q = 'X'; for (let k = 0; k < 900; k++) { const r = E.applyMove(t, q, E.localBest(E.publicMini(t), q, rng, {}, { level: ['easy', 'normal', 'hard'][g % 3] }).move, rng); assert.ok(r.ok); if (r.outcome === 'win') { wins++; break; } q = q === 'X' ? 'O' : 'X'; } }
  assert.equal(wins, 90);
});
