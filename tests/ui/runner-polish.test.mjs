// The runners' polish (Dash, Lane Rush, Flap, Chopper) in Node, the browser's names stubbed: the square's table keeps its
// one control (Start: the same label, act and place in the markup) and says nothing inside the game; the miniature is a
// picture with a bar for each player (its own classes); someone else's run schedules its own events' sounds from its log
// (a landing, a post cleared, traffic passed), each inside the run and never for a run this phone made; the scenes draw
// a run under way, a crash, the time limit's end and the finish without a slip.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const plain = stub();                                               // (a window whose reduced-motion query says no: otherwise no replay plays)
Object.defineProperty(globalThis, 'window', { value: new Proxy(function () {}, { get: (t, k) => (k === 'matchMedia' ? () => ({ matches: false, addEventListener() {}, addListener() {} }) : plain[k]), apply: () => stub(), construct: () => stub(), set: () => true }), configurable: true, writable: true });
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const R = require('../../src/games/shared/runner.js');
const { GAMES, TYPES } = await import('../../src/games/index.js');
for (const t of TYPES) GAMES[t].view = await import(`../../src/games/${t}/view.js`);
const { state } = await import('../../src/ui/app.js');
const FX = await import('../../src/ui/runfx.js');
const RUNNERS = ['dash', 'lane', 'flap', 'chopper'], GO = { dash: 'Run', lane: 'Run', flap: 'Fly', chopper: 'Fly' };
const square = t => {
  const rng = E.makeRng('run-ui-' + t), st = E.newMatch(rng, { games: [t], names: { X: 'Ann', O: 'Bo' } });
  Object.assign(state, st, { screen: 'mini', zoom: 0, online: null, cpu: null, sc: null, flash: null, done: null, winner: null });
  state.setup.names = { X: 'Ann', O: 'Bo' };
  const sq = state.squares[0]; sq.mini = E.newMini(t, rng); sq.owner = null; state.turn = 'X';
  return sq;
};
const screen = (sq, f, view) => GAMES[sq.mini.type].view.screen(sq, f || null, null, sq.mini, !!view, !!f || !!view, f || null, null, () => false, () => -1, false, state.turn, '');

test('runners: the table keeps its one control (Start: the same words, act and markup place) and no words inside the game', () => {
  for (const t of RUNNERS) {
    const sq = square(t), html = screen(sq);
    assert.match(html, new RegExp(`<div class="cbtns one"><button class="big X" data-act="run-go">${GO[t]}</button></div></div>$`), `${t}: Start, last in the square, under the scene`);
    assert.equal((html.match(/<button/g) || []).length, 1, `${t}: one button`);
    assert.match(html, new RegExp(`<div class="rscene ${t}" data-run="scene"[^>]*><canvas data-run="cv"></canvas><div class="rhud" data-run="hud">0 m</div></div>`), `${t}: the scene and its counter`);
    assert.match(html, /<p class="arcnote"><\/p>/, `${t}: the reserved line empty before a run (how to play is in the ? alone)`);
    assert.doesNotMatch(html, /rhint|Tap to|Swipe|Hold to/, `${t}: no help text`);
    sq.mini.dist.X = 120;
    assert.match(screen(sq), new RegExp(`${GO[t]} on from 120 m</button>`), `${t}: Start names where the run goes on from`);
  }
});
test('runners: the miniature is the scene\'s picture over a bar for each player, in classes of its own', () => {
  for (const t of RUNNERS) {
    const sq = square(t), V = GAMES[t].view, T = sq.mini.cfg.target;
    const fresh = V.miniature(sq.mini, false);
    assert.match(fresh, /^<div class="tscene" aria-label="X at 0 m, O at 0 m of \d+"><svg viewBox="0 0 100 77"/);
    assert.match(fresh, /class="rmframe"/); assert.equal((fresh.match(/class="rmbar o"/g) || []).length, 2, `${t}: two bars`);
    assert.doesNotMatch(fresh, /rmfill/, `${t}: nothing filled at the start`);
    assert.equal((fresh.match(/class="ttok [XO]"/g) || []).length, 2, `${t}: both marks, drawn`);
    assert.doesNotMatch(fresh, /<text|class="(bar|win|back|sq|big|road|lane|hero|frame|fill)[ "]/, `${t}: no type, no interface class`);
    sq.mini.dist.X = T / 2; sq.mini.dist.O = T;
    const mid = V.miniature(sq.mini, false);
    assert.match(mid, /class="rmfill X" x="17" y="[\d.]+" width="37\.5"/, `${t}: X's bar half full`);
    assert.match(mid, /class="rmfill O" x="17" y="[\d.]+" width="75\.0"/, `${t}: O's bar full`);
    assert.doesNotMatch(mid, /undefined|NaN/);
  }
});
test('runners: someone else\'s run sounds its own events from the log, inside the run; a run made here does not', () => {
  for (const t of RUNNERS) {
    const sq = square(t), V = GAMES[t].view;
    let res = null, f = null;
    for (let k = 0; k < 12 && !(f && f.run && f.run.steps > 600 && !f.run.done); k++) {   // a run of some length that ends in a crash
      const s2 = square(t), r = R.runAi(s2.mini, 'X', E.makeRng(`r${k}`));
      res = E.playMove(state, 0, r.move, E.makeRng('p')); assert.equal(res.ok, true, `${t}: the computer's run is a move`);
      f = state.flash; sq.mini = s2.mini;
    }
    const drive = Math.round(f.run.steps * R.runStepOf(t) * 1000), log = R.runUnlog(f.run.log, f.run.steps);
    const own = []; state.cpu = null; V.sounds(f, (n, ms) => own.push([n, ms]), false, sq.mini, null);
    assert.deepEqual(own.map(s => s[0]), ['thud', 'ding'], `${t}: a run this phone made: its result's sounds alone`);
    const theirs = []; state.cpu = 'X'; V.sounds(f, (n, ms) => theirs.push([n, ms]), false, sq.mini, null); state.cpu = null;
    const names = theirs.map(s => s[0]), count = n => names.filter(x => x === n).length;
    assert.equal(names[names.length - 1], 'ding'); assert.equal(count('crash'), 1, `${t}: the crash once`);
    for (const [n, ms] of theirs) if (/^run/.test(n)) assert.ok(ms > 0 && ms <= drive, `${t}: ${n} at ${ms} inside the run (${drive})`);
    if (t === 'dash') {
      const jumps = log.filter(([, c]) => c === 'j').length;
      assert.ok(count('runLand') >= jumps - 1 && count('runLand') <= jumps, 'dash: a landing for every jump (but one cut short by the crash)');
      assert.equal(count('jump'), jumps);
    } else {
      const snd = FX.RUN_EVENT_SND.pass[t], m = Object.assign({}, sq.mini, { dist: Object.assign({}, sq.mini.dist, { X: f.run.from }) });
      const cleared = R.runStart(m, 'X').course.filter(o => FX.clearAt(t, o) <= f.run.to).length;
      assert.equal(count(snd), Math.min(cleared, 240), `${t}: one ${snd} for each obstacle cleared`);
      if (t !== 'chopper') assert.ok(cleared > 0, `${t}: the run cleared something`);
    }
    const again = []; state.cpu = 'X'; V.sounds(f, (n, ms) => again.push([n, ms]), false, sq.mini, null); state.cpu = null;
    assert.deepEqual(again, theirs, `${t}: the same every time (from the log alone)`);
  }
});
test('runners: a run\'s events are read once each, however the steps are grouped', () => {
  const sq = square('flap'), r = R.runAi(sq.mini, 'X', E.makeRng('ev')).move, log = R.runUnlog(r.log, r.steps);
  const tally = by => { const rep = R.runReplayer(sq.mini, 'X', log, r.steps), st = {}; let n = 0; for (let k = by; ; k += by) { R.runReplayTo(rep, k); n += FX.runEvents(rep.sim, st).length; if (rep.sim.crash || rep.sim.done || rep.sim.n >= r.steps) break; } return n; };
  assert.ok(tally(1) > 0); assert.equal(tally(1), tally(4)); assert.equal(tally(4), tally(3));
});
test('runners: every scene draws a run under way, a crash as it plays and at rest, the time limit\'s end and the finish', () => {
  const D = { dash: GAMES.dash.view.drawDash, lane: GAMES.lane.view.drawLane, flap: GAMES.flap.view.drawFlap, chopper: GAMES.chopper.view.drawCave };
  for (const t of RUNNERS) {
    const sq = square(t), c = stub(), P = { ink: '#000', paper: '#fff', X: '#e00', O: '#fc0' };
    const sim = Object.assign(R.runStart(sq.mini, 'X'), { p: 'X' });
    let now = 1000;
    const hand = { dash: () => { if (sim.n % 150 === 0) R.runJump(sim); if (sim.n % 150 === 20) R.runRelease(sim); }, flap: () => { if (sim.n % 90 === 0) R.runJump(sim); }, chopper: () => { if (sim.n % 120 === 0) R.runJump(sim); if (sim.n % 120 === 60) R.runRelease(sim); }, lane: () => { if (sim.n % 200 === 0) R.runLane(sim, sim.n % 400 ? 1 : -1); } }[t];
    for (let k = 0; k < 2400 && !sim.crash && !sim.done; k++) { hand(); R.runTick(sim); if (k % 4 === 0) { now += 16.7; assert.doesNotThrow(() => D[t](c, 336, 231, sim, null, now), `${t}: a frame of the run`); } }
    if (!sim.crash) sim.crash = { at: sim.d, ob: { k: 'time' } };
    for (const dt of [0, 100, 400, 900]) assert.doesNotThrow(() => { D[t](c, 336, 231, sim, { at: now }, now + dt); FX.runOverlay(c, 336, 231, sim, { at: now }, now + dt, P); FX.jolt(c, 336, 231, sim, { at: now }, now + dt); }, `${t}: the crash, ${dt} ms in`);
    assert.doesNotThrow(() => D[t](c, 336, 231, sim, null, now + 5000), `${t}: the crash at rest`);
    const done = Object.assign(R.runStart(sq.mini, 'X'), { p: 'O', d: sq.mini.cfg.target, done: true });
    for (const dt of [0, 200, 600]) assert.doesNotThrow(() => { D[t](c, 336, 231, done, { at: now }, now + dt); FX.runOverlay(c, 336, 231, done, { at: now }, now + dt, P); }, `${t}: the finish, ${dt} ms in`);
  }
  assert.equal(FX.hitNow({ crash: { ob: { k: 'time' } } }), false, 'the time limit: no burst'); assert.equal(FX.hitNow({ crash: { ob: null } }), true);
});
