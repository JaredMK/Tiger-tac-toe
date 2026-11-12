// Snake's screen (src/games/snake/view.js): the garden in a square scene with the totals above and Start below,
// the result line in its reserved row, the words of a run (both totals: the other colour's food is the other
// player's), the miniature (a small garden, each player's snake and food, their totals big), and the replay's chunks played through to the same run. Rendered in Node with the browser's names stubbed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const R = require('../../src/games/snake/rules.js');
const { GAMES } = await import('../../src/games/index.js');
const V = await import('../../src/games/snake/view.js');
GAMES.snake.view = V;   // (the page registers the views in main.js; here by hand, for the header's line)
const { flashLine } = await import('../../src/ui/mini.js');
const { state } = await import('../../src/ui/app.js');
state.setup = Object.assign({}, state.setup, { names: { X: 'Xena', O: 'Olaf' } });

const clone = v => JSON.parse(JSON.stringify(v));
function square(score) { const st = E.newMatch(E.makeRng('sv'), { games: ['snake'] }); Object.assign(state, st, { screen: 'mini', zoom: 0, online: null, cpu: null, sc: null, flash: null, done: null }); state.setup = Object.assign({}, state.setup, { names: { X: 'Xena', O: 'Olaf' } }); state.names = state.setup.names; const sq = state.squares[0]; sq.mini = E.newMini('snake', E.makeRng('sv-sq')); sq.mini.score = Object.assign({ X: 0, O: 0 }, score || {}); sq.owner = null; state.turn = 'X'; return sq; }
const still = (sq, turn) => V.screen(sq, null, null, sq.mini, false, false, null, null, () => false, () => -1, false, turn || 'X', '');
function played(sq, p, cpu) {   // a run played in the square: the square after it and the move's flash
  const m = R.snakeAi(sq.mini, p, E.makeRng('run-' + p)).move;
  if (cpu) m.ai = true;
  const r = E.playMove(state, 0, m, E.makeRng('pm'));
  assert.equal(r.ok, true, r.reason);
  return r.flash;
}

test('the screen: both totals in their bars, a square garden scene with its count, the words row and Start, nothing else', () => {
  const html = still(square({ X: 7, O: 3 }));
  assert.match(html, /class="g-arc g-snake"/);
  assert.match(html, /class="rprog snk-prog X now"[\s\S]*aria-valuenow="7"[\s\S]*<small>7 \/ 30<\/small>/);
  assert.match(html, /class="rprog snk-prog O"[\s\S]*aria-valuenow="3"[\s\S]*<small>3 \/ 30<\/small>/);
  assert.match(html, /<div class="snk-wrap"><div class="snk-scene" data-snk="scene"[^>]*><canvas data-snk="cv"><\/canvas><div class="rhud snk-hud" data-snk="hud">7 \/ 30<\/div>/);
  assert.match(html, /data-snk="hud">7 \/ 30<\/div><\/div><p class="atwords snk-words"><span><\/span><\/p><\/div>/, 'the words row reserved right under the scene (outside it), empty on your own turn (how to play is in the ? explainer)');
  assert.match(html, /<button class="big X" data-act="snk-start">Start<\/button>/);
  assert.doesNotMatch(html, /Swipe|swipe|Tap Start/, 'no help text inside the game');
});
test('waiting on the other side: Start kept for its room but hidden, the words say who', () => {
  const sq = square();
  state.cpu = 'O'; state.turn = 'O';
  const html = still(sq, 'O');
  assert.match(html, /class="cbtns one hold"/);
  assert.match(html, /Waiting for <b class="O">/);
  state.cpu = null;
});
test('a run just played here: the totals take the new figure at once, the result line says how it ended, the header line names the apples', () => {
  const sq = square({ X: 10, O: 0 }), f = played(sq, 'X');
  const s = f.snake;
  assert.equal(R.snakeShown(f), false);
  const html = V.screen(sq, f, null, sq.mini, false, true, f, null, () => false, () => -1, false, 'X', '');
  const gain = s.to - s.from;
  assert.match(html, new RegExp(`aria-valuenow="${s.to}"`));
  if (gain > 0) assert.match(html, /class="rprog snk-prog X[^"]*"[\s\S]*<i class="grow" style="--w0:33\.3%;--w1:[\d.]+%;--d:900ms;--t:0ms"/, 'the bar grows from the move, no run to wait for: it was seen here');
  assert.match(html, /<span class="arcres (ok|no)" role="status"><b class="X">Xena<\/b> (hit the wall|bit its own tail|reached 30!|ran out of time)/);
  assert.doesNotMatch(html, /Won by/);
  const line = flashLine(f);
  if (f.kind === 'move') assert.equal(line, '', 'the header line says nothing of a run: the result line under the scene does (ui/mini.js LINE_TYPES)'); else assert.match(line, /Won by/);
  assert.match(V.moveText(f, '<b class="X">Xena</b>'), gain > 0 ? new RegExp(`Xena</b> scored ${gain} · ${s.to} of 30`) : /scored nothing/, 'the move\'s words (history, the match log) name the points');
});
test('someone else\'s run with no whole replay log (a bot\'s online): it plays in the flash first (the run\'s time), then the result', () => {
  const sq = square({ X: 0, O: 4 }); state.turn = 'O'; state.cpu = 'O';
  const f = played(sq, 'O'), s = f.snake;
  assert.equal(R.snakeShown(f), false);
  assert.equal(R.flashMs(f, 4, false), s.ms + R.SNAKE.hold);
  const html = V.screen(sq, f, null, sq.mini, false, true, f, null, () => false, () => -1, false, 'O', '');
  assert.match(html, new RegExp(`<span class="tu" style="--u:${s.ms}ms"><b class="O">`), 'having a go… until the run has played');
  assert.match(html, new RegExp(`class="arcres (ok|no) appear" style="--t:${s.ms}ms"`), 'the result as it lands');
  if (s.to > s.from) assert.match(html, new RegExp(`--t:${s.ms}ms"></i>`), 'the bar grows once the run has played');
  // its sounds: the run's as it plays, then the result; the computer's run here (shown before the move) sounds only its result
  const got = []; V.sounds(f, (n, ms) => got.push([n, ms]), false, sq.mini, null);
  assert.equal(got[0][0], 'go'); assert.ok(got.some(([n]) => n === 'snkCrunch') === s.n > 0); assert.deepEqual(got[got.length - 1], [s.to > s.from ? 'ding' : 'thud', s.ms + 150]);
  if (s.end === 'wall' || s.end === 'self') assert.ok(got.some(([n, ms]) => n === 'snkBonk' && ms === s.ms));
  state.cpu = null;
  const sq2 = square({ X: 0, O: 4 }); state.turn = 'O'; state.cpu = 'O';
  const f2 = played(sq2, 'O', true);
  assert.equal(R.snakeShown(f2), true); assert.equal(R.flashMs(f2, 4, false), R.SNAKE.hold);
  const got2 = []; V.sounds(f2, (n, ms) => got2.push([n, ms]), false, sq2.mini, null);
  assert.deepEqual(got2, [[f2.snake.to > f2.snake.from ? 'ding' : 'thud', 150]]);
  state.cpu = null;
});
test('the replay\'s chunks (replay.synth for the computer, replay.input on the other phone): the run played through from them is the recorded run', () => {
  const sq = square({ X: 0, O: 6 }), m = R.snakeAi(sq.mini, 'O', E.makeRng('syn')).move;
  const list = V.replay.synth(m, clone(sq.mini), { by: 'O' });
  assert.ok(Array.isArray(list) && list[0][2] === 'go' && /^end=/.test(list[list.length - 1][2]));
  assert.equal(m.ai, true, 'the move is marked: its run shown here before it');
  // fed to the other phone's hook, as the replay would at its times (the loop then steps the sim as the chunks allow)
  const r = { sq: 0, by: 'O', speed: 1 };
  for (const [, act, val] of list) assert.equal(V.replay.input(act, val, r), true);
  assert.equal(V.replay.input('snk-start', null, r), false, 'the Start press shows on the button');
  assert.equal(V.replay.input('move', 'm=1', r), false);
});
test('the miniature: a small garden with each player\'s snake and food of both colours, each total big, public information only, its own classes', () => {
  const sq = square({ X: 20, O: 5 }), html = V.miniature(sq.mini, false);
  assert.match(html, /^<div class="tsnk" aria-label="X has 20, O has 5 of 30 points"><svg/);
  assert.match(html, /class="tsnk-s X"/); assert.match(html, /class="tsnk-s O"/); assert.match(html, /class="tsnk-f X"/); assert.match(html, /class="tsnk-f O"/);
  assert.match(html, /<b class="X">X<\/b><span>20<\/span><\/div>/); assert.match(html, /<b class="O">O<\/b><span>5<\/span><\/div>/);
  assert.doesNotMatch(html, /<small>/, 'no small target text: the two totals alone');
  const xs = (html.match(/class="tsnk-s X" points="([^"]*)"/) || [])[1].split(' ').length, os = (html.match(/class="tsnk-s O" points="([^"]*)"/) || [])[1].split(' ').length;
  assert.ok(xs > os, 'the snake ahead is the longer');
  for (const c of ['back', 'btn', 'big', 'seg', 'key', 'sq', 'chip', 'bird']) assert.ok(!new RegExp(`class="[^"]*\\b${c}\\b`).test(html), c);
  const hidden = clone(sq.mini); E.hideMini(hidden, 0, state);
  assert.equal(V.miniature(hidden, false), html);
});
test('the words of a run: the end, the gain and the total, the points given; a timeout; the target', () => {
  const who = '<b class="X">Xena</b>';
  const f = (s, kind) => ({ kind: kind || 'move', by: 'X', type: 'snake', snake: Object.assign({ by: 'X', goal: 30, ofrom: 2, oto: 2 }, s) });
  assert.equal(V.moveText(f({ from: 3, to: 8 }), who), `${who} scored 5 · 8 of 30`);
  assert.equal(V.moveText(f({ from: 3, to: 3 }), who), `${who} scored nothing · 3 of 30`);
  assert.equal(V.moveText(f({ from: 3, to: 5, oto: 4 }), who), `${who} scored 2 · 5 of 30 · gave O 2`);
  assert.equal(V.moveText(f({ auto: true, from: 3, to: 3 }), who), `${who} ran out of time`);
});
test('a run that feeds the other player: both bars move (the mover\'s and theirs), the result line says so, and a gift of the square says whose it is', () => {
  const sq = square({ X: 4, O: 6 });
  const s = { by: 'X', from: 4, to: 7, ofrom: 6, oto: 8, n: 3, g: 2, end: 'wall', ms: 9000, ticks: 50, log: '', try: 0, goal: 30, at: { X: 7, O: 8 }, ai: false };
  sq.mini.score = { X: 7, O: 8 };
  const f = { kind: 'move', by: 'X', type: 'snake', square: 0, snake: s };
  const html = V.screen(sq, f, null, sq.mini, false, true, f, null, () => false, () => -1, false, 'X', '');
  assert.match(html, /class="rprog snk-prog X[^"]*"[\s\S]*aria-valuenow="7"/); assert.match(html, /class="rprog snk-prog O[^"]*"[\s\S]*aria-valuenow="8"[\s\S]*<i class="grow" style="--w0:20\.0%;--w1:26\.7%/);
  assert.match(html, /<b class="X">Xena<\/b> hit the wall · \+3 · <b class="O">Olaf<\/b> \+2/);
  const g = Object.assign({}, f, { kind: 'claim', winner: 'O', snake: Object.assign({}, s, { oto: 30, end: 'gift' }) });
  const h2 = V.screen(sq, g, null, sq.mini, false, true, g, null, () => false, () => -1, false, 'X', '');
  assert.match(h2, /<b class="X">Xena<\/b> fed <b class="O">Olaf<\/b> the last point/);
  const got = []; V.sounds(Object.assign({}, f, { snake: Object.assign({}, s, { ai: true }) }), (n, ms) => got.push([n, ms]), false, sq.mini, null);
  assert.deepEqual(got, [['ding', 150]]);
});

test('polish: the garden under a fence rail (the count and the time bar on it, never over a food or a bomb): the scene\'s shape in the stylesheet is the view\'s', async () => {
  const fs = await import('node:fs');
  assert.equal(V.SNKV.band, 0.95);
  const css = fs.readFileSync(new URL('../../src/ui/styles.css', import.meta.url), 'utf8');
  assert.match(css, /\.snk-scene \{[^}]*aspect-ratio: 11 \/ 11\.95;/, '11 cells and the rail\'s .95');
  assert.match(css, /\.snk-scene \{[^}]*width: min\(100cqw, \(100cqh - 48px\) \* 11 \/ 11\.95\)/);
  assert.match(css, /\.snk-scene \.snk-hud \{[^}]*height: calc\(100% \* \.95 \/ 11\.95\)/, 'the count stands on the rail');
  assert.equal(R.SNAKE.n + V.SNKV.band, 11.95);
});
test('polish: the controls are as they were: Start, a swipe of 14 px, a tap across the snake\'s way, the arrows or WASD, every turn through the rules\' queue', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../../src/games/snake/view.js', import.meta.url), 'utf8');
  assert.match(src, /const READY_MS = 600;/); assert.match(src, /const EARLY_MS = 700;/); assert.match(src, /const SWIPE_PX = 14;/);
  assert.match(src, /const KEYS = \{ ArrowRight: 0, ArrowDown: 1, ArrowLeft: 2, ArrowUp: 3, d: 0, s: 1, a: 2, w: 3, D: 0, S: 1, A: 2, W: 3 \};/);
  assert.match(src, /if \(Math\.hypot\(dx, dy\) < SWIPE_PX\) return;\n    queueTurn\(fd, Math\.abs\(dx\) >= Math\.abs\(dy\) \? \(dx > 0 \? 0 : 2\) : \(dy > 0 \? 1 : 3\)\);/, 'the swipe: the same reading of its way');
  assert.match(src, /if \(cur === 0 \|\| cur === 2\) return y < sy \? 3 : 1;\n  return x < sx \? 2 : 0;/, 'the tap: across the way it heads');
  assert.match(src, /if \(snakeQueue\(fd\.sim, dir\)\) haptic\('tap'\);/, 'a turn goes into the rules\' queue as before; taken in, it buzzes lightly');
  assert.match(src, /tickEvents\(rr, sim, now, loud, false\);/, 'someone else\'s run sounds here but never buzzes this phone');
  assert.match(src, /tickEvents\(fd, fd\.sim, now, true, true\);/);
  assert.deepEqual(Object.keys(V.actions), ['snk-start']);
});
test('polish: the miniature\'s snakes have eyes and a shadow, the garden its outline over the checks', () => {
  const sq = square({ X: 9, O: 14 }), html = V.miniature(sq.mini, false);
  assert.equal((html.match(/class="tsnk-e"/g) || []).length, 4); assert.equal((html.match(/class="tsnk-sh"/g) || []).length, 2);
  assert.match(html, /<rect class="tsnk-r" /);
});
