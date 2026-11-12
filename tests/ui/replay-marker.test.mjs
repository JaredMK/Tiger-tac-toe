// A computer's (or another player's) input replayed in Bowling and Bullseye: what the replay shows is exactly what they
// did. Bowling, a flick now: the streak along their recorded aim, as long as their recorded power, then that very roll.
// Bullseye, two taps again, sweeps each line straight to where it was stopped and lands the dart exactly where the move
// did. Rendered in Node with the browser's names stubbed (no page needed).
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

test('Bowling: a replayed flick — the replay\'s one input is the flick itself, their aim and power exactly; nothing else is taken', () => {
  for (const [aim, power] of [[0.055, 0.714], [-0.19, 0.7], [0, 1], [0.3, 0.85], [-0.07, 0.946]]) {
    const r = { sq: 4, by: 'O', list: [[0, 'bowl', `aim=${aim}|power=${power}`]], k: 1, speed: 1.5 };
    assert.equal(B.replay.input('bowl', `aim=${aim}|power=${power}`, r), true, 'taken (no press sound of the shared replay\'s)');
    const st = B.bowlRepOn();
    assert.deepEqual([st.sq, st.p, st.aim, st.power, st.speed], [4, 'O', aim, power, 1.5], 'the streak is their flick: its line their aim, its length their power');
    assert.deepEqual(B.replay.synth({ aim, power }), [[0, 'bowl', `aim=${aim}|power=${power}`]], 'the computer\'s: made from its move, the same input');
  }
  assert.equal(B.replay.input('bowl', 'aim=0.1', { sq: 4, by: 'O' }), false, 'an old client\'s tap (aim alone) is not a flick');
  assert.equal(B.replay.input('drag', 'a=0.1,p=0.5', { sq: 4, by: 'O' }), false);
  assert.equal(B.replay.synth('auto'), null);
});

// Bullseye is two taps again (a sideways line, then an up-down one: the dart lands where they cross): someone else's
// throw shows each line sweeping from its edge straight to where it was stopped (never past it and back), a beat
// each, then the dart flies from the hand and sticks exactly where the move landed it. The view plays it from the
// move's own flash (ui/replay.js OWN), so it has no replay hooks of its own.
test('Bullseye: a replayed throw — each line goes straight to where it stopped, and the dart flies from the hand to exactly where it landed', async () => {
  const V = await import('../../src/games/bullseye/view.js');
  const hand = E.BULLS.hand;
  assert.equal(V.replay, undefined, 'no input stage: the throw plays from its flash');
  for (const [x, y] of [[0.5, 0.45], [0.12, 0.8], [0.93, 0.07], [0.02, 0.98], [1, 0]]) {
    const m = E.newMini('bullseye', E.makeRng('rm')); E.applyMove(m, 'O', { x, y }, E.makeRng('rm' + x));
    const g = { fx: m.last.fx, fy: m.last.fy, x: m.last.x, y: m.last.y, zone: m.last.zone, pts: m.last.pts, per: m.last.per }, A = E.bullsAim(g), P = E.bullsPlan(A.fly);
    assert.ok(A.vx.it <= 1 && A.vy.it <= 1 && (Math.abs(A.vx.it - x) < 0.002 || x < 0.05) && (Math.abs(A.vy.it - y) < 0.002 || y < 0.05), 'each line sweeps straight to where it stopped');
    assert.ok(A.t1 > 0 && A.h0 > A.t1 && A.t2 > A.h0 && A.fly > A.t2 && P.pre === A.fly, 'the first line stops, then the second sweeps and stops, then the dart');
    const d0 = V.dartAt(g, P, 0), d1 = V.dartAt(g, P, P.pre), mid = V.dartAt(g, P, (P.pre + P.hit) / 2), hit = V.dartAt(g, P, P.hit), end = V.dartAt(g, P, P.end + 500);
    assert.deepEqual([d0.x, d0.y, d0.w, d1.x, d1.y, d1.w], [hand[0], hand[1], 0, hand[0], hand[1], 0], 'in the hand while the lines sweep, and as the flight begins');
    assert.ok(mid.w > 0.3 && mid.w < 0.7 && !mid.stuck, 'half way to the wall half way through');
    assert.deepEqual([hit.x, hit.y, hit.w, hit.stuck], [g.x, g.y, 1, true], 'it sticks exactly where the move landed it');
    assert.deepEqual([end.x, end.y, end.wob], [g.x, g.y, 0], 'and stays there, still');
    let prev = -1;
    for (let t = P.pre; t <= P.hit; t += 10) { const d = V.dartAt(g, P, t); assert.ok(d.w >= prev, 'always away towards the wall, never back'); prev = d.w; }
  }
});

// The computer's roll (and an online opponent's, from their log) replayed through ui/replay.js: the inputs stage holds
// one input, the flick, pressed once its lead is over (the streak grows from the ball along the recorded line); the
// roll follows a press later. Normal and Speed, the computer's and a logged one.
test('Bowling: a replayed roll — one input, the flick, at its moment; then the move', async () => {
  const R = await import('../../src/ui/replay.js');
  const { GAMES } = await import('../../src/games/index.js');
  GAMES.bowling.view = B;                                        // (as main.js registers it: the replay finds Bowling's hooks)
  for (const c of [{ aim: 0.055, power: 0.714, lead: 300, speed: 1 }, { aim: -0.19, power: 1, lead: 150, speed: 1.5 }, { aim: 0.12, power: 0.8, lead: 0, speed: 1.5, list: [[0, 'bowl', 'aim=0.12|power=0.8']] }]) {
    let moved = 0;
    R.repStart({ cpu: !c.list, sq: 4, by: 'O', type: 'bowling', mini: { type: 'bowling' }, move: { aim: c.aim, power: c.power }, list: c.list || null, lead: c.lead, speed: c.speed, onMove: () => { moved++; } });
    const r = R.rep;
    assert.ok(r && r.stage === 'inputs', 'the replay is on, its inputs first');
    assert.deepEqual(r.list, [[0, 'bowl', `aim=${c.aim}|power=${c.power}`]], 'one input: the flick');
    assert.ok(Math.abs(R.repDue(r, r.list[0]) - (r.at + c.lead)) < 1e-6, 'due once the lead is over');
    clearTimeout(r.timer);
    r.k = 1; assert.equal(B.replay.input(r.list[0][1], r.list[0][2], r), true);
    assert.deepEqual([B.bowlRepOn().aim, B.bowlRepOn().power, B.bowlRepOn().p], [c.aim, c.power, 'O']);
    assert.equal(moved, 0, 'the roll is not made by the input: it follows');
    R.repSkip();
    assert.equal(moved, 1, 'Skip (or the press\'s end): the move');
    R.repStop();
  }
});
