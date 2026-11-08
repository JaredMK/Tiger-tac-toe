// Muncher: the square's screen (ui/games/muncher/view.js) rendered in Node with the browser's names stubbed: the two
// players' dots as bars, the maze's canvas with its count, the words line and Start, all in reserved room (nothing
// moves when a run starts or a result shows); the computer's move as a replay (its words, its sounds from the
// recorded run); the miniature a picture of the maze with both players' progress.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const V = await import('../../src/games/muncher/view.js');
const R = await import('../../src/games/muncher/rules.js');
const A = await import('../../src/games/muncher/ai.js');
const { GAMES } = await import('../../src/games/index.js');
GAMES.muncher.view = V;   // (the page registers the views in main.js; here by hand, for the header's line)
const { state } = await import('../../src/ui/app.js');
const { flashLine } = await import('../../src/ui/mini.js');

function square(seed) {
  const st = E.newMatch(E.makeRng(seed), { names: { X: 'Xena', O: 'Olaf' } });
  Object.assign(state, st, { screen: 'mini', zoom: 4, online: null, cpu: 'O', sc: null, flash: null, done: null, lock: null });
  const sq = state.squares[4]; sq.mini = E.newMini('muncher', E.makeRng(seed + '-sq')); sq.owner = null; state.turn = 'X';
  return sq;
}
const screenOf = (sq, f, o = {}) => V.screen(sq, f, o.done || null, sq.mini, !!o.view, !!o.locked, f, null, () => false, () => -1, false, o.turn || 'X', '');
const SHAPE = /^<div class="g-arc"><div class="mun"><div class="rprogs">.*<\/div><div class="munscene" data-mun="scene"[^>]*><canvas data-mun="cv"><\/canvas><div class="rhud munhud" data-mun="hud">[^<]*<\/div><\/div><p class="atwords munwords">.*<\/p><\/div><div class="cbtns one( hold)?"><button class="big [XO]" data-act="mun-start"[^>]*>Start<\/button><\/div><\/div>$/;

test('Muncher: the square opens on both players\' bars, the maze and Start; the same frame while a result shows (Start kept, hidden)', () => {
  const sq = square('ui');
  const html = screenOf(sq, null);
  assert.match(html, SHAPE, 'the rows, the scene, the words, Start');
  assert.match(html, /class="rprog munprog X now"><b class="X">Xena<\/b>/); assert.match(html, /<small>0 \/ 18<\/small>/);
  assert.match(html, /data-mun="hud">0 \/ 18</); assert.doesNotMatch(html, /cbtns one hold/, 'Start can be tapped');
  assert.ok(!/swipe|Swipe|drag/.test(html), 'no help text inside the game');
  const r = R.munPilot(sq.mini, 'X', E.makeRng('own'), R.munHand(sq.mini, 'normal'));
  const pr = E.playMove(state, 4, r.move, E.makeRng('pm'));
  assert.equal(pr.ok, true);
  const h2 = screenOf(sq, pr.flash, { locked: true, done: state.done });
  assert.match(h2, SHAPE); assert.match(h2, /cbtns one hold/, 'Start kept for its room, hidden');
  assert.match(h2, new RegExp(`<small>${r.move.ate} / 18</small>`));
  assert.match(h2, /class="arcres (ok|no)" role="status">/, 'the result\'s words in the reserved line');
  if (pr.flash.kind === 'move') assert.equal(flashLine(pr.flash), '', 'the header line says nothing of a run: the game\'s own words line does (ui/mini.js LINE_TYPES)'); else assert.match(flashLine(pr.flash), /Won by/); assert.match(V.moveText(pr.flash, '<b class="X">Xena</b>'), /ate \d+ dots?|was caught|ate nothing/, 'the move\'s words say what the run came to');
  assert.match(V.moveText(pr.flash, 'Xena'), r.move.ate > 0 ? new RegExp(`^Xena ate ${r.move.ate} dots? · ${r.move.ate} of 18$`) : /^Xena (was caught|ate nothing) · 0 of 18$/);
});
test('Muncher: the computer\'s run is a replay from its recorded inputs: its words first, its chomps and end in the sounds, then the result\'s ding or thud', () => {
  const sq = square('rep'); state.turn = 'O';
  const b = A.best(E.publicMini(sq.mini), 'O', E.makeRng('cpu'), {}, { level: 'hard', until: null });
  const pr = E.playMove(state, 4, b.move, E.makeRng('pm'));
  assert.equal(pr.ok, true);
  const f = pr.flash, snd = [];
  // (in Node the reduced-motion query reads as on, so the replay's part is skipped: the sounds and words as with reduced motion)
  V.sounds(f, (n, ms) => snd.push([n, ms]), false, sq.mini, null);
  assert.deepEqual(snd[snd.length - 1], [b.move.ate > 0 ? 'ding' : 'thud', 250], 'the result for everyone');
  const html = screenOf(sq, f, { locked: true, turn: 'O' });
  assert.match(html, /class="rprog munprog O now"><b class="O">/); assert.match(html, SHAPE);
  // a replay's own sim from the flash: the same run, step for step, from the square as it was
  const g = f.mun, log = R.munUnlog(g.log, g.steps), before = JSON.parse(JSON.stringify(sq.mini));
  before.ate.O = before.ate.O.filter(c => !g.ate.includes(c)); before.tries.O = g.try;
  const sim = R.munReplay(before, 'O', log, g.steps);
  assert.equal(sim.ate.length, g.ate.length); assert.equal(sim.end || 'out', g.end);
  assert.equal(R.flashMs(f, 4, false), R.MUN.hold + (R.MUN_VIEW.own(f) ? 0 : R.munMs(g)), 'the view decides whose the run is');
});
test('Muncher: the miniature is the maze with each player\'s dots as a bar and count, public information only, its classes its own', () => {
  const sq = square('mini');
  sq.mini.ate = { X: [0, 2, 4], O: [60] };
  const html = V.miniature(sq.mini, false);
  assert.match(html, /^<div class="tmun" aria-label="Muncher: X has eaten 3, O 1 of 18">/);
  assert.match(html, /<svg viewBox="0 0 99 77">/); assert.match(html, /<path class="w" d="M/); assert.match(html, /<path class="dots" d="M/);
  assert.match(html, /<div class="mr X"><b class="X">X<\/b><i><s style="--w:16\.7%"><\/s><\/i><span>3<\/span><\/div>/);
  assert.match(html, /<div class="mr O"><b class="O">O<\/b><i><s style="--w:5\.6%"><\/s><\/i><span>1<\/span><\/div>/);
  for (const c of ['back', 'btn', 'big', 'seg', 'key', 'sq', 'chip', 'bird']) assert.ok(!new RegExp(`class="[^"]*\\b${c}\\b`).test(html), c);
  assert.equal(V.miniature(E.publicMini(sq.mini), false), html, 'the same from the public square');
});
