// A computer's (or another player's) taps replayed in Bowling and Bullseye: the marker stops exactly where it tapped and
// stays there (Bowling's meter is timed to be at the recorded power when the tap comes; Bullseye's lines sweep straight
// to the recorded spot, never past it and back). Rendered in Node with the browser's names stubbed (no page needed).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const B = await import('../../src/games/bowling/view.js');

test('Bowling: a replayed power tap — the meter rises and falls at its own speed, is exactly at the recorded power at the moment of the tap, and stays there', () => {
  const per = E.bowlConfig().meterMs;
  for (const [power, gap] of [[0.646, 900], [0.1, 900], [0.97, 900], [0.5, 350], [0.3, 2300], [1, 900], [0, 900]]) {
    const log = [[0, 'bowl', 'aim=-0.038'], [gap, 'bowl', `power=${power}`]];
    const r = { sq: 4, by: 'O', list: log, k: 1, speed: 1 };           // (the driver has taken the aim input: k is the next one)
    B.replay.input('bowl', 'aim=-0.038', r);
    const dr = B.bowlDraft;
    assert.ok(dr && dr.rep && dr.step === 2 && dr.to, 'the meter is under way');
    const t0 = dr.t0;
    let prev = -1, passed = false;
    for (let ms = 0; ms <= gap + 3000; ms += 7) {
      const v = B.bowlNow(dr, t0 + ms).power;
      if (ms >= gap) assert.equal(v, power, `${power}: at and after the tap (${ms} ms) the meter is at the recorded power`);
      if (ms < gap) assert.ok(v >= 0 && v <= 1, 'within the meter');
      if (ms >= gap) passed = true;
      prev = v;
    }
    assert.ok(passed && prev === power);
    B.replay.input('bowl', `power=${power}`, Object.assign({}, r, { k: 2 }));   // the tap itself: locked at the recorded power
    assert.deepEqual([B.bowlDraft.step, B.bowlDraft.power], [3, power]);
    assert.equal(B.bowlNow(B.bowlDraft, t0 + gap).power, power);
  }
  // no power in the log after the aim: the meter just runs (nothing to land on)
  B.replay.input('bowl', 'aim=0.1', { sq: 4, by: 'O', list: [[0, 'bowl', 'aim=0.1']], k: 1, speed: 1 });
  assert.equal(B.bowlDraft.to, null);
});

test('Bullseye: a replayed throw sweeps each line straight to where it stopped (never past it and back), for any stop', () => {
  for (const x of [0, 0.02, 0.2, 0.39, 0.4, 0.5, 0.93, 1]) for (const y of [0.01, 0.3, 0.41, 0.77, 1]) {
    const A = E.bullsAim({ x, y, per: 1040 });
    assert.ok(A.vx.it <= 1 && A.vy.it <= 1, `(${x}, ${y}) at most one pass`);
    assert.ok(Math.abs(A.vx.it - Math.max(0.05, x)) < 0.002 && Math.abs(A.vy.it - Math.max(0.05, y)) < 0.002, 'ends where it stopped');
  }
});

// The computer's roll (and an online opponent's, from their log) replayed through ui/replay.js: from the replay's
// start the arrow sweeps at its own speed, timed to be at the recorded aim exactly when the aim tap comes, and holds
// there through the lock (no sweep of this phone's that jumps to theirs); then the meter lands on the recorded power at
// the power tap and holds. Normal and Speed (the computer's lead and the replay's speed), a replay begun after the
// zoom in has landed, a late join, a timer that fires late, and the next replay in the same square.
test('Bowling: a replayed roll — the arrow and the meter are at the recorded aim and power at and after each tap, with no jump', async () => {
  const R = await import('../../src/ui/replay.js');
  const { GAMES } = await import('../../src/games/index.js');
  GAMES.bowling.view = B;                                        // (as main.js registers it: the replay finds Bowling's hooks)
  const { aimMs, meterMs } = E.bowlConfig(), MAX = 0.2, step = 7;
  let T = 0;
  const realPerf = globalThis.performance;
  Object.defineProperty(globalThis, 'performance', { value: { now: () => T }, configurable: true, writable: true });
  try {
    const cases = [];
    for (const [aim, power] of [[0.055, 0.714], [-0.19, 0.3], [0, 1], [0.2, 0.05], [-0.07, 0.646]])
      for (const [lead, speed, label] of [[300, 1, 'Normal'], [150, 1.5, 'Speed 1.5x'], [150, 2, 'Speed 2x']])
        for (const late of [0, 45]) cases.push({ aim, power, lead, speed, label, late });
    cases.push({ aim: 0.12, power: 0.8, lead: 0, speed: 1.5, label: 'online, from the log', late: 0, list: [[0, 'bowl', 'aim=0.12'], [640, 'bowl', 'power=0.8']] });
    cases.push({ aim: -0.12, power: 0.4, lead: 300, speed: 1, label: 'joined late', late: 0, elapsed: 120 });
    for (const c of cases) {
      const tag = `${c.label} aim ${c.aim} power ${c.power}${c.late ? ' (timer late)' : ''}`;
      T += 10000;
      B.setBowlDraft(null);
      assert.equal(B.bowlKeep({ zoom: 4, turn: 'O' }, false), null, `${tag}: no arrow while the zoom in lands (the square locked)`);
      T += 300;                                                    // (the replay starts once the zoom in has landed)
      R.repStart({ cpu: !c.list, sq: 4, by: 'O', type: 'bowling', mini: { type: 'bowling' }, move: { aim: c.aim, power: c.power }, list: c.list || null, lead: c.lead, speed: c.speed, elapsed: c.elapsed || 0, onMove: () => {} });
      const r = R.rep;
      assert.ok(r && r.stage === 'inputs', `${tag}: the replay is on`);
      clearTimeout(r.timer);                                       // (its inputs applied here, at their moments on a fake clock)
      const dr = B.bowlKeep({ zoom: 4, turn: 'O' }, true);
      assert.ok(dr && dr.rep === r && dr.step === 1, `${tag}: the replay's own arrow from its start`);
      assert.equal(B.bowlKeep({ zoom: 4, turn: 'O' }, true), dr, `${tag}: kept on every render`);
      const aimDue = R.repDue(r, r.list[0]), powDue = R.repDue(r, r.list[1]);
      let prev = null;
      for (let t = T; t <= aimDue + c.late; t += step) {
        const v = B.bowlNow(dr, t).aim;
        assert.ok(v >= -MAX - 1e-9 && v <= MAX + 1e-9, `${tag}: on the lane`);
        if (t >= aimDue) assert.equal(v, c.aim, `${tag}: the arrow at the recorded aim at and after the tap (${Math.round(t - aimDue)} ms)`);
        if (prev != null) assert.ok(Math.abs(v - prev) <= 2 * MAX * step / aimMs + 0.002, `${tag}: the arrow sweeps, never jumps (${prev} -> ${v})`);
        prev = v;
      }
      T = Math.max(T, aimDue + c.late);                            // the aim tap
      r.k = 1; B.replay.input('bowl', r.list[0][2], r);
      const d2 = B.bowlDraft;
      assert.ok(d2.step === 2 && d2.rep === r, `${tag}: the meter under way`);
      assert.equal(B.bowlNow(d2, T).aim, c.aim, `${tag}: locked where it stopped`);
      assert.equal(B.bowlKeep({ zoom: 4, turn: 'O' }, true), d2, `${tag}: kept after the lock`);
      prev = null;
      for (let t = T; t <= powDue + 2000; t += step) {
        const v = B.bowlNow(d2, t);
        assert.equal(v.aim, c.aim, `${tag}: the arrow stays locked`);
        if (t >= powDue) assert.equal(v.power, c.power, `${tag}: the meter at the recorded power at and after the tap (${Math.round(t - powDue)} ms)`);
        if (prev != null) assert.ok(Math.abs(v.power - prev) <= step / meterMs + 0.002, `${tag}: the meter moves, never jumps (${prev} -> ${v.power})`);
        prev = v.power;
      }
      T = Math.max(T, powDue + c.late);                            // the power tap
      r.k = 2; B.replay.input('bowl', r.list[1][2], r);
      assert.deepEqual([B.bowlDraft.step, B.bowlNow(B.bowlDraft, T).aim, B.bowlNow(B.bowlDraft, T).power], [3, c.aim, c.power], `${tag}: both locked for the roll`);
      R.repStop();
    }
    // the next replay in the same square: its own arrow, never the last roll's locked one
    T += 10000;
    R.repStart({ cpu: true, sq: 4, by: 'O', type: 'bowling', mini: { type: 'bowling' }, move: { aim: -0.1, power: 0.5 }, lead: 300, speed: 1, onMove: () => {} });
    clearTimeout(R.rep.timer);
    const nx = B.bowlKeep({ zoom: 4, turn: 'O' }, true);
    assert.ok(nx.step === 1 && nx.rep === R.rep && nx.to && nx.to.aim === -0.1, 'a fresh arrow for the new replay');
    R.repStop();
  } finally {
    Object.defineProperty(globalThis, 'performance', { value: realPerf, configurable: true, writable: true });
    B.setBowlDraft(null);
  }
});
