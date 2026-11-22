// Road Race's page (December 2026: the circuit from above and the steering wheel), rendered in Node with the browser's
// names stubbed: the wheel under the circuit with GO on its hub only while an attempt may begin; someone else's
// attempt said and counted only once it has been driven again; its sounds from the steering on its flash (the engine
// all the way, the tyres at each hard lock, the crash or the lap at its end, never from this phone's own attempt);
// the miniature the square's own circuit beside each player's laps.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const R = require('../../src/games/rally/rules.js');
const { state } = await import('../../src/ui/app.js');
const V = await import('../../src/games/rally/view.js');

const fresh = seed => { const st = E.newMatch(E.makeRng(seed), { games: ['rally'] }); Object.assign(state, st, { screen: 'mini', zoom: 4, online: null, cpu: 'O', flash: null }); return st; };
const draw = (st, o = {}) => V.screen(st.squares[4], o.a || null, null, st.squares[4].mini, !!o.view, !!o.locked, o.a || null, null, null, null, false, o.turn || st.turn, null);

test('rally: the circuit\'s canvas over the wheel; GO on the hub only while an attempt may begin', () => {
  const st = fresh('ui1'); st.turn = state.turn = 'X';
  const mine = draw(st);
  assert.match(mine, /<canvas class="rrcv"/); assert.match(mine, /class="rrstrip"/); assert.match(mine, /class="rrwheel" style="transform:rotate\(0\.0deg\)"/);
  assert.match(mine, /<button class="rrgo X" data-act="rr-go" aria-label="Go">GO<\/button>/);
  assert.equal((mine.match(/data-act=/g) || []).length, 1, 'one control: the rest is the drag');
  assert.ok(mine.indexOf('rrcv') < mine.indexOf('rrline') && mine.indexOf('rrline') < mine.indexOf('rrstrip'), 'the circuit, the result\'s line, the wheel');
  for (const o of [{ locked: true }, { view: true }]) assert.doesNotMatch(draw(st, o), /rrgo/, JSON.stringify(o));
  assert.match(draw(st, { locked: true }), /class="rrwheel"/, 'the wheel is always there: nothing moves when GO goes');
  assert.match(mine, /<p class="rrline"><\/p>/, 'the result\'s line is kept empty');
});

test('rally: someone else\'s attempt: said and counted once it has been driven; its sounds from its steering', () => {
  const st = fresh('ui2'), mini = st.squares[4].mini, c = R.rallyCfg(mini), tr = R.rallyTrack(mini), d = R.rallyDrive(c, tr, E.makeRng('steady'), 0);
  st.turn = state.turn = 'O';
  assert.ok(E.playMove(st, 4, { log: d.log, steps: d.steps }, E.makeRng('s')).ok); Object.assign(state, st, { cpu: 'O' });
  const f = st.flash, run = d.steps * 1000 / R.RALLY.hz, html = draw(st, { a: f, turn: 'X' });
  assert.equal(f.rr.done, true); assert.doesNotMatch(html, /rrgo/);
  assert.match(html, new RegExp(`class="rrline ok appear" style="--t:${Math.round(R.RALLY.pre + run)}ms" role="status">Lap done!`), 'the words come as the car reaches the line');
  assert.match(html, new RegExp(`class="on fillin" style="--t:${Math.round(R.RALLY.pre + run)}ms"`), 'and the lap\'s pip with them');
  const got = []; V.sounds(f, (n, t, r) => got.push([n, Math.round(t)]), false, mini, null);
  const purr = got.filter(g => g[0] === 'rrPurr'), sq = got.filter(g => g[0] === 'rrSqueal'), hard = d.log.filter(e => Math.abs(e[1]) >= V.RRV.hard * R.RALLY.lock);
  assert.equal(purr.length, Math.ceil(run / V.RRV.purr)); assert.ok(purr.every(g => g[1] >= R.RALLY.pre && g[1] < R.RALLY.pre + run));
  assert.ok(sq.length <= hard.length && (hard.length === 0) === (sq.length === 0)); for (let i = 1; i < sq.length; i++) assert.ok(sq[i][1] - sq[i - 1][1] > V.RRV.squeal, 'the tyres never squeal twice at once');
  assert.deepEqual(got[got.length - 1], ['rrLap', Math.round(R.RALLY.pre + run)]);
  assert.match(V.moveText(f, 'Sam'), /finished a lap/);
  // a crash: the crash's own sound at the place it left the road; this phone's own attempt is silent here (it was heard live)
  const st2 = fresh('ui3'); st2.turn = state.turn = 'O';
  assert.ok(E.playMove(st2, 4, { log: [[0, R.RALLY.lock]], steps: 900 }, E.makeRng('s')).ok); Object.assign(state, st2, { cpu: 'O' });
  const g2 = []; V.sounds(st2.flash, (n, t) => g2.push(n), false, st2.squares[4].mini, null);
  assert.equal(g2[g2.length - 1], 'crash'); assert.ok(g2.includes('rrSqueal')); assert.match(draw(st2, { a: st2.flash, turn: 'X' }), /class="rrline no appear"[^>]*>Crashed at \d+%/);
  state.cpu = null; const own = []; V.sounds(st2.flash, n => own.push(n), false, st2.squares[4].mini, null); assert.deepEqual(own, [], 'an attempt driven here');
  assert.deepEqual(V.replay.synth(), [], 'a replay presses nothing: the attempt is driven again from the flash');
});

test('rally: the miniature: the square\'s own circuit, a car on its line, each player\'s laps', () => {
  const m = E.newMini('rally', E.makeRng('mini')), tr = R.rallyTrack(m); m.laps.X = 1;
  const html = V.miniature(m, false);
  assert.match(html, /class="tart trcw" aria-label="Road Race: X 1, O 0 of 2 laps"/); assert.match(html, new RegExp(`<svg class="trc" viewBox="0 0 ${R.RALLY.W} ${R.RALLY.H}">`));
  const dp = html.match(/class="trct" d="([^"]+)"/)[1], pts = dp.slice(1, -1).split('L').map(s => s.split(' ').map(Number));
  assert.ok(pts.length > 30 && pts.every(([x, y]) => x > 0 && x < R.RALLY.W && y > 0 && y < R.RALLY.H)); assert.deepEqual(pts[0], [Math.round(tr.x[0] * 10) / 10, Math.round(tr.y[0] * 10) / 10]);
  assert.equal((html.match(/<i class=" on">/g) || []).length, 1); assert.doesNotMatch(html.replace(/aria-label="[^"]*"/, ''), />[^<]*\d[^<]*</, 'a picture and pips: no numbers');
  assert.notEqual(V.miniature(E.newMini('rally', E.makeRng('other')), false), V.miniature(E.newMini('rally', E.makeRng('mini')), false).replace(' on', ''), 'another square, another circuit');
});
