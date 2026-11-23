// Barrel Launch's screen (games/barrel/view.js): the screen before and after a shot (the Fire button, the scene's
// layers, the result's own reserved line, the pips filling in after the landing), the sounds (someone else's boom first;
// this phone's own heard as it fired), a shot's picture (the flight, the catch, the miss: no jumps), the one aid (the
// arrow along the aim: no lane, sight or ring), the scene's clock and camera through a shot and the redraws round it
// (never a step), and the miniature. Rendered in Node with the browser's names stubbed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : k === 'matchMedia' ? () => ({ matches: false }) : k === 'getItem' ? () => null : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const { state } = await import('../../src/ui/app.js');
const { renderMini } = await import('../../src/ui/mini.js');
const { GAMES } = await import('../../src/games/index.js');
const { moveSounds } = await import('../../src/audio/sound.js');
const { RESULT_SOUNDS, BAD_SOUNDS } = await import('../../src/ui/haptics.js');
const { startFx } = await import('../../src/ui/fx.js');
const { runColours } = await import('../../src/ui/runner.js');
const V = await import('../../src/games/barrel/view.js');
const R = await import('../../src/games/barrel/rules.js');
const A = await import('../../src/games/barrel/ai.js');
GAMES.barrel.view = V;
const { BARREL } = R, { BRV } = V;

function match(turn = 'X') {
  Object.assign(state, E.newMatch(E.makeRng('barrel-ui'), { games: ['barrel'], vs: 'cpu' }), { screen: 'mini', zoom: 0, cpu: 'O', sc: null, flash: null, done: null, spot: null, winner: null, online: null, turn, lock: null });
  state.setup.vs = 'cpu'; state.setup.names = { X: 'Xena', O: 'Computer' };
  return state.squares[0].mini;
}
const names = f => moveSounds(f).map(s => [s[0], Math.round(s[1])]);
const deadOn = (m, p) => { const c = R.barrelCfg(m), i = m.at[p]; return Math.round(A.barrelCross(m, c, i, R.barrelTarget(m, c, i).phi, m.c[p], 300)); };
// A drawing context that keeps what was asked of it.
function recorder() {
  const calls = [], sets = [];
  const g = new Proxy({ canvas: { parentNode: null } }, { get: (t, k) => (k in t ? t[k] : (...a) => { calls.push([k, ...a]); return { addColorStop() {} }; }), set: (t, k, v) => { sets.push([k, v]); return true; } });
  return { g, calls, sets };
}

test('before a shot: the Fire button in the mover\'s colour, the scene (the sky, two painted layers and the canvas, each the view\'s own), an empty reserved line, both tallies; nothing to press on the other side\'s turn', () => {
  match();
  let html = renderMini(state.squares[0]);
  assert.match(html, /<div class="g-brl pc-X">/);
  assert.match(html, /<div class="brlfield live" role="img" aria-label="X's column of barrels: 0 of 7 up"><i class="brlsky" data-own><\/i><canvas class="brlbg" data-own><\/canvas><canvas class="brlbg" data-own><\/canvas><canvas class="brlcv" data-own><\/canvas><\/div>/);
  assert.match(html, /<p class="brlline"><\/p>/);
  assert.match(html, /<button class="big X brlbtn" data-act="brl-fire" aria-label="Fire into the barrel above">/);
  assert.equal((html.match(/class="pips" aria-label="0 of 7"/g) || []).length, 2);
  state.turn = 'O'; html = renderMini(state.squares[0]);
  assert.match(html, /<div class="g-brl pc-O">/); assert.match(html, /<div class="brlfield" role="img"/); assert.match(html, /class="big O brlbtn" data-act="brl-fire"[^>]* disabled>/);
});

test('a shot: the words and the pip at the landing; this phone\'s own starts at the shot, someone else\'s swing first; the sounds; a catch\'s short hold', () => {
  const m = match();
  assert.ok(E.playMove(state, 0, { t: deadOn(m, 'X') }, E.makeRng('s')).ok);
  const f = state.flash, own = renderMini(state.squares[0]);
  assert.equal(f.br.hit, true);
  assert.match(own, new RegExp(`<p class="brlline ok appear" style="--t:${BARREL.fly}ms" role="status">Caught!</p>`));
  assert.match(own, new RegExp(`<i class="on fillin" style="--t:${BARREL.fly}ms"></i>`));
  assert.deepEqual(names(f), [['blWhoosh', 20], ['blCatch', BARREL.fly], ['blPeek', BARREL.fly + BRV.sink + 60]], 'its boom was heard as it fired');
  assert.equal(V.hold(f), 150, 'a catch: the next shot follows'); assert.equal(E.playMs(f), BARREL.pre + BARREL.fly + BARREL.land, 'the flash is the lead-in, the flight and the landing');
  match('O'); const mo = state.squares[0].mini;
  assert.ok(E.playMove(state, 0, { t: deadOn(mo, 'O') + 400 }, E.makeRng('s')).ok);
  const g = state.flash, pre = BARREL.pre, html = renderMini(state.squares[0]);
  assert.equal(g.br.hit, false); assert.equal(V.hold(g), null);
  assert.match(html, new RegExp(`<p class="brlline no appear" style="--t:${pre + BARREL.fly + BARREL.fall - 120}ms" role="status">Missed!</p>`)); assert.doesNotMatch(html, /fillin/);
  assert.deepEqual(names(g), [['blFire', pre], ['blWhoosh', pre + 20], ['blMiss', pre + BARREL.fly - 30], ['blBump', pre + BARREL.fly + BARREL.fall - 20]]);
  // a shot that only just misses knocks the barrel on its way past
  match('O'); const mn = state.squares[0].mini, c = R.barrelCfg(mn); let t = deadOn(mn, 'O');
  while (R.barrelJudge(mn, c, 0, R.barrelAim(mn, c, 0, t)).hit) t++;
  assert.ok(E.playMove(state, 0, { t: t + 3 }, E.makeRng('s')).ok); assert.equal(state.flash.br.hit, false);
  assert.deepEqual(names(state.flash).map(x => x[0]), ['blFire', 'blWhoosh', 'blClonk', 'blMiss', 'blBump']);
  assert.ok(RESULT_SOUNDS.has('blCatch') && BAD_SOUNDS.has('blBump'), 'a catch and a bump buzz');
  assert.equal(V.moveText({ br: { hit: true } }, 'Xena'), 'Xena landed in the next barrel'); assert.equal(V.moveText({ br: { hit: false } }, 'Xena'), 'Xena fell back');
});

test('a shot\'s picture: out of its barrel\'s mouth along the aim, into the mouth of the barrel above (or past it, and back into its own), never a jump', () => {
  const m = match(), c = R.barrelCfg(m), HL = BRV.bl / 2, pre = BARREL.pre;
  const run = (s, to) => { const tAt = T => s.c + s.t - pre + T, P = []; for (let T = pre; T < to; T += 4) P.push(V.brlPose(m, c, s, T, tAt)); return P; };
  const th = R.barrelAim(m, c, 0, deadOn(m, 'X')), hit = { by: 'X', n: 0, from: 0, t: deadOn(m, 'X'), c: 0, th, hit: true };
  assert.deepEqual(V.brlPose(m, c, hit, pre - 1, () => 0), { sit: 0, since: 1e6 }, 'someone else\'s lead-in: still in its barrel');
  let P = run(hit, pre + BARREL.fly + BARREL.land);
  const d0 = { x: Math.sin(th * Math.PI / 180), y: Math.cos(th * Math.PI / 180) };
  assert.ok(Math.hypot(P[0].x - (m.xs[0] + d0.x * (HL + BRV.peek)), P[0].y - d0.y * (HL + BRV.peek)) < 0.01, 'it leaves from where it sat'); assert.equal(P[0].in, 0);
  const air = P.filter(p => p.x != null); assert.ok(air.length >= BARREL.fly / 4 - 1);
  for (let k = 1; k < air.length; k++) assert.ok(Math.hypot(air[k].x - air[k - 1].x, air[k].y - air[k - 1].y) < 2.6, `a smooth flight: step ${k}`);
  const last = air[air.length - 1], b = { x: m.xs[1], y: c.gap }; assert.ok(Math.hypot(last.x - b.x, last.y - b.y) < HL + 3, 'at the mouth of the barrel above'); assert.equal(last.in, 1, 'dropping in behind its near side');
  assert.ok(air[0].sp > 0.9 && Math.min(...air.slice(air.length >> 1).map(p => p.sp)) < 0.35 && air.every(p => p.sp > 0.1), 'fast off the barrel, slow over the rim, never still');
  const sat = P.filter(p => p.sit != null); assert.ok(sat.every(p => p.sit === 1)); assert.ok(sat[0].since < 8 && sat[sat.length - 1].since > BARREL.land - 8);
  const miss = Object.assign({}, hit, { th: th + 14, hit: false, off: 12 });
  P = run(miss, pre + BARREL.fly + BARREL.fall + 40);
  const fall = P.filter(p => p.x != null);
  for (let k = 1; k < fall.length; k++) assert.ok(Math.hypot(fall[k].x - fall[k - 1].x, fall[k].y - fall[k - 1].y) < 2.6, `a smooth fall: step ${k}`);
  assert.ok(Math.max(...fall.map(p => p.y)) > c.gap, 'past the barrel above'); assert.ok(fall.some(p => p.fall && p.spin > 1), 'tumbling back');
  const back = P[P.length - 1]; assert.deepEqual([back.sit, back.back], [0, true], 'back in the barrel it came from');
});

test('the one aid is the arrow from the barrel\'s mouth along its aim: no lane, no dotted sight, no ring', () => {
  const m = match(), c = R.barrelCfg(m);
  for (const tau of [0, 300, 911]) {
    const a = V.brlArrow(m, c, 0, tau), th = R.barrelAim(m, c, 0, tau) * Math.PI / 180, dx = a.to.x - a.from.x, dy = a.to.y - a.from.y;
    assert.ok(Math.abs(Math.hypot(dx, dy) - BRV.arrow.len) < 1e-9); assert.ok(Math.abs(Math.atan2(dx, dy) - th) < 1e-9, 'along the aim');
    assert.ok(Math.abs(Math.hypot(a.from.x - m.xs[0], a.from.y) - BRV.arrow.from) < 1e-9, 'from beyond the mouth'); assert.ok(BRV.arrow.from + BRV.arrow.len < c.gap - BRV.bl / 2, 'short of the barrel above');
  }
  assert.notDeepEqual(V.brlArrow(m, c, 0, 0).to, V.brlArrow(m, c, 0, 300).to, 'it swings with the barrel');
  renderMini(state.squares[0]);
  const { g, calls, sets } = recorder(); assert.equal(V.brlPaint(g, 345, 345, performance.now()), true);
  assert.equal(calls.filter(x => x[0] === 'setLineDash').length, 0, 'nothing dashed or dotted');
  assert.equal(sets.filter(x => x[0] === 'fillStyle' && x[1] === runColours().X).length, 1, 'one shape in the mover\'s colour: the arrow');
  assert.equal(sets.filter(x => x[0] === 'globalAlpha' && x[1] > 0 && x[1] < 0.5).length, 0, 'no shaded lane');
  assert.ok(calls.filter(x => x[0] === 'drawImage').length >= 6, 'the mast, the barrels and the player from their sprites');
});

test('the scene keeps one clock a column and one camera through a shot and every redraw round it: the swing never steps, the camera climbs one barrel smoothly', () => {
  const real = performance.now.bind(performance); let now = real() + 1000; performance.now = () => now;
  try {
    const m = match('O'), c = R.barrelCfg(m), dt = 1000 / 60, { g } = recorder(), seen = [];
    const frame = () => { V.brlPaint(g, 345, 345, now); const s = V.brlScene(); seen.push([now, s.tau, s.cam]); now += dt; };
    renderMini(state.squares[0]); for (let k = 0; k < 30; k++) frame();                        // the computer about to play: its barrels swinging
    const cam0 = V.brlScene().cam, t = deadOn(m, 'O') + 800;
    assert.ok(E.playMove(state, 0, { t: deadOn(m, 'O') }, E.makeRng('s')).ok); assert.equal(state.flash.br.hit, true);
    startFx('move', state.flash, now); renderMini(state.squares[0]);                            // its move: the flash, a redraw
    const lead = seen.length; for (let k = 0; k < Math.ceil((BARREL.pre + BARREL.fly + BARREL.land + 150) / dt); k++) { if (k % 20 === 7) renderMini(state.squares[0]); frame(); }
    E.endFlash(state); renderMini(state.squares[0]);                                            // its result cleared: another redraw
    const after = seen.length; for (let k = 0; k < 40; k++) frame();
    const P = R.barrelPeriod(c, 0), wrap = d => ((d + P / 2) % P + P) % P - P / 2;
    for (let k = 1; k < seen.length; k++) {
      const d = wrap((seen[k][1] - seen[k - 1][1]) - (seen[k][0] - seen[k - 1][0])), inLead = k >= lead && seen[k][0] - seen[lead][0] <= BARREL.pre + dt;
      assert.ok(Math.abs(d) <= (inLead ? dt * 1.1 : 0.001), `the swing at frame ${k}: ${d.toFixed(2)} ms off its clock`);
      assert.ok(Math.abs(seen[k][2] - seen[k - 1][2]) < 3, `the camera at frame ${k}`); assert.ok(seen[k][2] >= seen[k - 1][2] - 1e-9, 'never back down');
    }
    assert.ok(Math.abs(seen[after - 1][2] - cam0 - c.gap) < 0.01, 'one barrel up as the result clears'); assert.equal(seen[seen.length - 1][2], seen[after - 1][2], 'and it stays there');
    const flight = seen.findIndex(x => x[0] - seen[lead][0] >= BARREL.pre + BARREL.fly); assert.ok(Math.abs(seen[flight - 1][2] - cam0) < 0.01, 'the camera waits for the catch');
    assert.equal(t > 0, true);
  } finally { performance.now = real; }
});

test('the miniature: two little columns of barrels, each player\'s mark at their height, beside their climb as a bar', () => {
  const m = match();
  let html = V.miniature(m, false);
  assert.match(html, /class="tart tbrlw" aria-label="Barrel Launch: X 0, O 0 of 7 barrels up"/); assert.match(html, /<svg class="tbrl"/);
  assert.equal((html.match(/<i class="nb" style="--w:0\.0%"><\/i>/g) || []).length, 2, 'a bar each, empty');
  m.at.X = 7; html = V.miniature(m, false);
  assert.match(html, /<circle class="tbrt X" cx="15" cy="7"/); assert.match(html, /<i class="nb" style="--w:100\.0%"><\/i>/);
  assert.doesNotMatch(html, /class="[^"]*\b(back|sq|btn|big)\b/);
});
