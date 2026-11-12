// Star Swarm's view in Node (the browser's names stubbed): the square's table (both totals, the sky's canvas, the
// words, Start), the result's words after a run and for someone else's, the miniature (a picture, each total readable),
// the move's words and the replay hook (nothing pressed before the move: the run is the move).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const plain = stub();                                               // (a window whose reduced-motion query says no: otherwise every replay is skipped, as it is for a player who asked for less motion)
Object.defineProperty(globalThis, 'window', { value: new Proxy(function () {}, { get: (t, k) => (k === 'matchMedia' ? () => ({ matches: false, addEventListener() {}, addListener() {} }) : plain[k]), apply: () => stub(), construct: () => stub(), set: () => true }), configurable: true, writable: true });
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const R = require('../../src/games/swarm/rules.js');
const { GAMES, TYPES } = await import('../../src/games/index.js');
for (const t of TYPES) GAMES[t].view = await import(`../../src/games/${t}/view.js`);
const V = GAMES.swarm.view;
const { state } = await import('../../src/ui/app.js');
const square = () => {
  const rng = E.makeRng('sw-ui'), st = E.newMatch(rng, { games: ['swarm'], names: { X: 'Ann', O: 'Bo' } });
  Object.assign(state, st, { screen: 'mini', zoom: 0, online: null, cpu: null, sc: null, flash: null, done: null, winner: null });
  state.setup.names = { X: 'Ann', O: 'Bo' };
  const sq = state.squares[0]; sq.mini = E.newMini('swarm', rng); sq.owner = null; state.turn = 'X';
  return sq;
};
const G = () => R.swarmGoal(state.squares[0].mini);
const screen = (sq, f, d, view) => V.screen(sq, f || null, d || null, sq.mini, !!view, !!f || !!d || !!view, f && f.type === 'swarm' ? f : null, null, () => false, () => -1, false, state.turn, '');

test('star swarm: the square\'s table: both totals as bars, the sky, a reserved line of words, Start for the player on the move', () => {
  const sq = square(), html = screen(sq);
  assert.match(html, /class="g-arc"><div class="swarm">/);
  assert.match(html, /class="rprog swprog X now"/); assert.match(html, /class="rprog swprog O"/);
  assert.match(html, new RegExp(`role="progressbar" aria-valuenow="0" aria-valuemax="${G()}"`));
  assert.match(html, new RegExp(`<div class="swscene" data-sw="scene"[^>]*><canvas data-sw="cv"><\\/canvas><div class="rhud" data-sw="hud">0 \/ ${G()}<\/div>`));
  assert.match(html, /<p class="atwords swwords"><span><\/span><\/p>/, 'no help text in the square');
  assert.match(html, /<div class="cbtns one"><button class="big X" data-act="swarm-start">Start<\/button>/);
  assert.equal(typeof V.actions['swarm-start'], 'function');
  assert.deepEqual(V.replay.synth({ log: 'x', steps: 1 }, sq.mini), [], 'the run is the move: nothing pressed before it');
  sq.owner = 'X';
  const done = screen(sq, null, null, true);
  assert.doesNotMatch(done, /swarm-start/, 'a finished square: no Start'); assert.match(done, /class="rprog swprog X"/, 'nobody underlined');
});
test('star swarm: after a run on this phone, the result\'s words at once; someone else\'s run says who is flying, then the result', () => {
  const sq = square(), r = R.swarmAi(sq.mini, 'X', E.makeRng('r'), 'normal');
  const res = E.playMove(state, 0, r.move, E.makeRng('p'));
  assert.equal(res.ok, true);
  const f = state.flash, own = screen(sq, f);
  assert.match(own, /<span class="arcres (ok|no)" role="status"><b class="X">Ann<\/b> (was hit|ran out of time|reached)/);
  assert.match(own, /class="cbtns one hold"/, 'Start kept for its room, hidden');
  state.cpu = 'X';                                                    // the same run as the computer's: it plays here first
  const theirs = screen(sq, f);
  assert.match(theirs, new RegExp(`<span class="tu" style="--u:${R.swarmMs(f.swarm)}ms"><b class="X">`));
  assert.match(theirs, /is flying…<\/span><span class="arcres (ok|no) appear"/);
  assert.match(theirs, /<i class="grow" style="--w0:0.0%;--w1:/, 'the bar grows to the new total after the replay');
  state.cpu = null;
  assert.match(V.moveText(f, 'Ann'), new RegExp(`^Ann (scored \\d+ · \\d+ \\/ ${G()}|was hit · still at 0)$`));
  assert.equal(V.moveText({ swarm: { auto: true } }, 'Bo'), 'Bo ran out of time');
  const sounds = []; V.sounds(f, (n, ms) => sounds.push([n, ms]), false, sq.mini, null);
  assert.deepEqual(sounds, [], 'a run flown here had its sounds live: none from the flash');
  state.cpu = 'X';
  const theirSounds = []; V.sounds(f, (n, ms) => theirSounds.push([n, ms]), false, sq.mini, null);
  state.cpu = null;
  assert.equal(theirSounds[0][0], 'go'); assert.ok(theirSounds.some(([n]) => n === 'swPew'), 'its shots'); assert.ok(theirSounds.every(([, ms]) => Number.isInteger(ms) && ms >= 0));
  assert.deepEqual(theirSounds[theirSounds.length - 1], [f.swarm.to > f.swarm.from ? 'ding' : 'thud', R.swarmMs(f.swarm) + 250], 'then the result');
});
test('star swarm: the miniature is a picture (the sky, the swarm, both ships) with each total readable, from public information', () => {
  const sq = square(); sq.mini.score = { X: 27, O: 4 };
  const html = V.miniature(sq.mini, false);
  assert.match(html, new RegExp(`^<div class="tswarm" aria-label="X at 27, O at 4 of ${G()}"><svg viewBox="0 0 100 47"`));
  assert.match(html, /class="tswship X"/); assert.match(html, /class="tswship O"/);
  assert.match(html, new RegExp(`class="tswfill X" x="8" y="37" width="${(36 * 27 / G() - 2).toFixed(1).replace(".", "\\.")}"`));
  assert.match(html, /<div class="tswn" aria-hidden="true"><span class="X">27<\/span><span class="O">4<\/span><\/div>/, 'each total as a number under the sky, at the board\'s text size');
  assert.doesNotMatch(html, /<text/, 'no figures inside the drawing (they would shrink with it)');
  assert.doesNotMatch(html, /class="tswfill O"/, 'a total too small for a fill draws the empty bar alone');
  for (const c of ['back', 'btn', 'big', 'seg', 'key', 'sq', 'chip', 'bird']) assert.doesNotMatch(html, new RegExp(`class="[^"]*\\b${c}\\b`), `never the interface's .${c}`);
});
// The polish sweep (November 2026): a run's sounds are thinned and varied, the same live and in a replay (one voice).
test('star swarm: a run\'s voice: a burst sounds by what burst, the shots are two notes in turn, and a shot right after a burst is silent', () => {
  const sq = square(), r = R.swarmAi(sq.mini, 'X', E.makeRng('voice'), 'hard');
  const log = require('../../src/games/shared/finger.js').fingUnlog(r.move.log, r.move.steps, Math.ceil(R.SW.w * R.SW.q));
  const sim = R.swarmStart(sq.mini, 'X'), voice = V.swVoice(), heard = [];
  let k = 0, shots = 0, kills = 0, lastPop = -1;
  while (sim.n < r.move.steps && !sim.end) {
    let tx = null;
    if (k < log.length && log[k][0] === sim.n) tx = log[k++][1] / R.SW.q;
    R.swarmStep(sim, tx);
    const s = sim.last ? voice(sim) : null;
    if (sim.last === 'pew') { shots++; if (s) { assert.equal(s[0], 'swPew'); assert.equal(s[1], shots % 2 ? 1 : 0.84, 'two notes in turn, by the shot\'s number'); assert.ok(sim.t - lastPop >= 0.13, 'never right after a burst'); } else assert.ok(sim.t - lastPop < 0.13, 'a silent shot only right after a burst'); }
    if (sim.last === 'kill') { kills++; lastPop = sim.t; const e = sim.ev[sim.ev.length - 1]; assert.equal(s[0], 'swPop'); assert.equal(s[1], e.k === 'swoop' ? 1.2 : e.k === 'shooter' ? 0.78 : undefined, 'a dart higher, a saucer lower, a jelly as it comes'); }
    if (s) heard.push(s[0]);
  }
  assert.ok(kills > 3 && shots > 6, 'a run with bursts and shots');
  assert.equal(heard.filter(n => n === 'swPop').length, kills, 'every burst is heard');
  assert.ok(heard.filter(n => n === 'swPew').length < shots, 'some shots are not');
  state.cpu = 'X';
  const res = E.playMove(state, 0, r.move, E.makeRng('p')), got = [];
  assert.equal(res.ok, true);
  V.sounds(state.flash, (n, ms, rate) => got.push([n, ms, rate]), false, sq.mini, null);
  state.cpu = null;
  assert.deepEqual(got.slice(1, -2).map(g => g[0]).filter(n => n !== 'swBlast' && n !== 'sparkle' && n !== 'buzz'), heard.slice(0, 220), 'the replay sounds the same voice, from the move\'s inputs');
  assert.ok(got.some(([n, , rate]) => n === 'swPew' && rate === 0.84), 'the replay carries each sound\'s rate');
});
test('star swarm: the miniature draws the swarm as itself (jellies with eyes, darts, a saucer) and each ship in its player\'s colour with its shot', () => {
  const sq = square(), html = V.miniature(sq.mini, false);
  assert.equal((html.match(/class="tsweye"/g) || []).length, 4, 'two jellies, two eyes each');
  assert.equal((html.match(/class="tswfoe b"/g) || []).length, 2); assert.match(html, /class="tswfoe c"/); assert.match(html, /class="tswdome"/);
  for (const p of ['X', 'O']) assert.match(html, new RegExp(`<g class="tswship ${p}"><rect class="tswshot"[^>]*/><path class="tswfl"[^>]*/><path class="tswfin"[^>]*/><path class="tswhull"`));
});
