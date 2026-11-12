// Peg Drop's board (src/games/plinko/view.js; the November 2026 polish pass): the chip falls from the slot it was dropped
// from, peg to peg along the path the move was given, and ends in the move's bin; every peg it touches lights at the
// moment it is touched, and the click sounds at that same moment; the bin lights, its points pop and the mover's total
// counts up as it lands, all from the move's flash (never the square's last drop, which may be the viewer's own). The
// slots hold a chip each while open. Rendered in Node with the browser's names stubbed.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const { GAMES } = await import('../../src/games/index.js');
const V = await import('../../src/games/plinko/view.js');
const R = await import('../../src/games/plinko/rules.js');
const { state } = await import('../../src/ui/app.js');
state.setup = Object.assign({}, state.setup, { names: { X: 'Xena', O: 'Olaf' } });
const CSS = fs.readFileSync(new URL('../../src/ui/styles.css', import.meta.url), 'utf8');

const P = R.PLINKO, clone = v => JSON.parse(JSON.stringify(v));
const count = (html, re) => (html.match(re) || []).length;
function play(mini, p, slot, seed) {   // a drop: the square after it and the move's flash (what a replay carries)
  const m = clone(mini), res = E.applyMove(m, p, slot, E.makeRng(seed));
  assert.equal(res.ok, true);
  const flash = { kind: res.outcome === 'win' ? 'claim' : 'move', by: p, next: p, square: 0, type: 'plinko', note: res.note || null };
  GAMES.plinko.rules.moveFlash(slot, p, null, 0, m, flash);
  return { mini: m, flash };
}
const fresh = () => E.newMini('plinko', E.makeRng('pk-view'));
const still = (mini, turn = 'X', locked = false) => V.screen({ owner: null, mini }, null, null, mini, false, locked, null, null, false, () => -1, false, turn, '');
const replay = (shown, flash, turn = 'O') => V.screen({ owner: null, mini: shown }, flash, null, shown, false, true, flash, null, false, () => -1, false, turn, '');
const soundsOf = f => { const out = []; V.sounds(f, (n, at, rate) => out.push([n, at, rate]), false, null, null); return out; };
const hitDrop = () => { for (let k = 0; k < 400; k++) { const m = fresh(), slot = k % 7, r = play(m, 'X', slot, 'h' + k); if (r.flash.plinko.hit) return { m, r, slot }; } throw new Error('no drop touched the bonus peg'); };

test('the drop\'s moments: a touch a row, never quite on the beat, the same every time; the bin after the last peg; all inside the move', () => {
  const { flash } = play(fresh(), 'X', 3, 'a'), pl = flash.plinko, t = V.plinkoTimes(pl);
  assert.equal(t.touch.length, P.rows);
  assert.deepEqual(V.plinkoTimes(clone(pl)).touch, t.touch, 'drawn from the drop itself: every phone and every redraw the same');
  t.touch.forEach((ms, k) => { assert.ok(Math.abs(ms - (k + 1) * P.step) <= 0.16 * P.step, `row ${k + 1} near its beat`); if (k) assert.ok(ms - t.touch[k - 1] >= 0.6 * P.step, 'a hop takes its time'); });
  assert.equal(t.touch[P.rows - 1], P.rows * P.step, 'the last peg on the beat (the landing follows from it)');
  assert.ok(t.touch.some((ms, k) => ms !== (k + 1) * P.step), 'not a metronome');
  assert.ok(t.bin > t.touch[P.rows - 1] && t.end === P.rows * P.step + P.land && t.bin < t.end);
  assert.ok(R.flashMs(flash, 4, false) >= t.end && R.flashMs(flash, 4, false) >= t.bin + 400, 'the move lasts until the chip rests and its points have popped');
  assert.ok(R.flashMs(flash, 4, false) - t.bin <= 500, 'and no longer: no dead time after the landing');
});
test('the chip\'s way down: from its slot, onto each peg of the move\'s path at its touch, into the move\'s bin; turning the way it goes', () => {
  for (const [slot, seed] of [[0, 'b'], [3, 'c'], [6, 'd'], [2, 'e']]) {
    const pl = play(fresh(), 'O', slot, seed).flash.plinko, t = V.plinkoTimes(pl), fr = V.plinkoFrames(pl), xs = R.plinkoTouches(pl.slot, pl.path);
    const X = x => 7.5 + x / 12 * 85;
    assert.ok(Math.abs(fr[0].x - X(slot * 2)) < 0.01 && fr[0].ms === 0, 'it starts in its slot');
    for (let k = 1; k < fr.length; k++) assert.ok(fr[k].ms >= fr[k - 1].ms, 'in time order');
    xs.forEach((x, r) => { const f = fr.find(q => q.ms === t.touch[r] && q.sy < 1); assert.ok(f, `a contact on row ${r + 1}`); assert.ok(Math.abs(f.x - X(x)) < 0.01, `on the path's peg (row ${r + 1})`); });
    const end = fr[fr.length - 1];
    assert.ok(Math.abs(end.x - X(pl.bin * 2)) < 0.01, 'it rests in the move\'s bin'); assert.equal(end.ms, t.end); assert.deepEqual([end.sx, end.sy], [1, 1]);
    for (let k = 1; k < fr.length; k++) assert.ok(Math.abs(fr[k].x - fr[k - 1].x) <= 1.2 && Math.abs(fr[k].y - fr[k - 1].y) <= 7 && fr[k].ms - fr[k - 1].ms <= 110, 'no jump between two frames: a smooth way down');
    assert.equal(end.a, pl.path.reduce((sum, right, k) => sum + (right ? 1 : -1) * (k === P.rows - 1 ? 70 : 88), 0) + 10, 'it turns the way it goes, a quarter turn a hop');
  }
});
test('a replay plays the mover\'s drop from its flash: their chip, the pegs it touched lighting at their touches, its bin lighting as it lands, their total counting up', () => {
  const x = play(fresh(), 'X', 1, 'mine'), o = play(x.mini, 'O', 5, 'theirs'), pl = o.flash.plinko, t = V.plinkoTimes(pl);   // X dropped first; O's drop is replayed over the square as X left it
  const shown = clone(o.mini); shown.last = clone(x.mini.last);   // (the square's last result as the viewer's own: nothing of the replay may be read from it)
  const html = replay(shown, o.flash);
  assert.match(html, /<g class="pkchip O drop"/); assert.doesNotMatch(html, /class="pkchip X/);
  const hits = [...html.matchAll(/<g class="pkpeg hit" transform="translate\(([\d.]+) [\d.]+\)" style="--t:(\d+)ms"/g)].map(m => [Number(m[1]), Number(m[2])]);
  assert.deepEqual(hits.map(h => h[1]).sort((a, b) => a - b), t.touch, 'a peg a row lights, each at its touch');
  assert.deepEqual(hits.map(h => h[0]), R.plinkoTouches(pl.slot, pl.path).map(q => Number((7.5 + q / 12 * 85).toFixed(1))), 'the pegs of the move\'s path');
  const lit = [...html.matchAll(/<g class="pkbin v(\d) lit O" style="--t:(\d+)ms">/g)];
  assert.equal(lit.length, 1); assert.equal(Number(lit[0][2]), t.bin);
  assert.equal(count(html.slice(0, html.indexOf('lit O')), /<g class="pkbin /g) - 1, pl.bin, 'the bin the move landed in');
  assert.match(html, new RegExp(`<b class="cnt" data-from="${o.mini.pts.O - pl.pts}" data-delay="${t.bin}" data-ms="350">${o.mini.pts.O}</b>`), 'the total counts up as it lands');
  assert.match(html, new RegExp(`class="arcres[^"]* appear" style="--t:${t.bin}ms"`), 'the words in the reserved line, as it lands');
  assert.match(html, /class="pboard pc-O"/, 'the mover\'s colour on the board (a touched peg, the lit column and plate)');
  const snd = soundsOf(o.flash);
  assert.deepEqual(snd.filter(s => s[0] === 'peg').map(s => s[1]), t.touch, 'a click as each peg is touched');
  assert.ok(new Set(snd.filter(s => s[0] === 'peg').map(s => s[2].toFixed(3))).size >= 4, 'never the same click six times');
  assert.deepEqual(snd.filter(s => s[0] === 'thunk').map(s => s[1]), [t.bin], 'the thunk into the bin');
  assert.equal(snd[snd.length - 1][0] === 'thunk' || snd[snd.length - 2][0] === 'thunk', true);
  assert.ok(snd.find(s => s[0] === 'point')[1] > t.bin && snd.find(s => s[0] === 'point')[1] < R.flashMs(o.flash, 4, false));
});
test('the bonus peg: gold with its points over it; touched, it bursts at its touch (a ding) and stays spent for the move', () => {
  const { m, r } = hitDrop(), pl = r.flash.plinko, t = V.plinkoTimes(pl), at = t.touch[pl.bonus.r - 1];
  assert.match(still(m), /<g class="pkbonus" [^>]*aria-label="Bonus peg: \+2">/);
  const html = replay(m, r.flash, 'X');
  assert.match(html, new RegExp(`<g class="pkbonus hit" [^>]*style="--t:${at}ms" aria-label="Bonus peg: hit">`));
  assert.equal(count(html, /class="pkbonus/g), 1, 'the next bonus peg waits for the next turn');
  assert.deepEqual(soundsOf(r.flash).filter(s => s[0] === 'ding').map(s => s[1]), [at]);
  assert.match(html, /\(bonus \+2\)/);
});
test('the slots: a chip in the mover\'s colour in every open one, a used one empty and off; the slot just dropped from is empty while its chip falls', () => {
  const m = fresh(); m.used = [true, false, false, true, false, false, false];
  const html = still(m, 'O'), btns = [...html.matchAll(/<button class="([^"]*)" data-act="move" data-m=["'&quot;]*(\d)[^>]*>/g)];
  assert.equal(btns.length, 7);
  assert.deepEqual(btns.map(b => b[1]), ['O used', 'O', 'O', 'O used', 'O', 'O', 'O']);
  assert.deepEqual(btns.map(b => / disabled/.test(b[0])), [true, false, false, true, false, false, false]);
  assert.equal(count(html, /<i class="pkgh"/g), 7, 'a chip\'s place in every slot');
  const o = play(m, 'O', 2, 'slot'), rep = replay(m, o.flash), cls = [...rep.matchAll(/<button class="([^"]*)" data-act="move"/g)].map(b => b[1]);
  assert.equal(cls[2], 'O used', 'its chip has left');
  assert.equal(count(rep, / disabled/g), 7, 'nothing to tap while a move plays');
  assert.doesNotMatch(still(m, 'X', true), /class="pkchip/, 'no chip on a board at rest');
});
test('all seven used: the others fill again as the chip lands (never with the interface\'s .back)', () => {
  const m = fresh(); m.used = [true, true, true, false, true, true, true];
  const o = play(m, 'X', 3, 'last'), html = replay(m, o.flash, 'X');
  assert.equal(o.flash.plinko.reset, true);
  assert.equal(count(html, /<i class="pkgh pkre" style="--t:\d+ms"/g), 6);
  assert.doesNotMatch(html, /class="[^"]*\bback\b/);
  assert.match(html, /All seven used/);
});
test('the winning drop bursts from its bin; the miniature shows the board, the last chip in its bin and both players\' bars and points', () => {
  const m = fresh(); m.pts.X = m.target - 1;
  const w = play(m, 'X', 0, 'win'), html = replay(m, w.flash, 'X');
  assert.equal(w.flash.kind, 'claim'); assert.match(html, /<g class="pkstars" style="--t:\d+ms"/); assert.doesNotMatch(replay(fresh(), play(fresh(), 'O', 2, 'x').flash), /pkstars/);
  const mini = V.miniature(w.mini, false);
  assert.match(mini, /<svg class="tpkbd"/); assert.equal(count(mini, /class="tpkb v\d"/g), 7, 'the seven bins, shaded by their points');
  assert.match(mini, /<circle class="tpkc X"/, 'the last chip, in the dropper\'s colour');
  assert.match(mini, new RegExp(`<div class="tr X"><b class="X">X</b><i style="--w:100.0%"></i><span>${m.target}</span></div>`)); assert.match(mini, /<div class="tr O"><b class="O">O<\/b><i style="--w:0.0%"><\/i><span>0<\/span><\/div>/);
  assert.doesNotMatch(V.miniature(fresh(), false), /tpkc/);
});
test('the stylesheet plays the chip by the view\'s keyframes and keeps the board its shape', () => {
  assert.match(CSS, /\.pkchip\.drop, \.pkchip\.drop \.pkroll \{ animation: var\(--path\) var\(--d, 1800ms\) linear both; \}/);
  assert.match(CSS, /\.pboard \{[^}]*aspect-ratio: 100 \/ 115;/);
  const html = replay(fresh(), play(fresh(), 'X', 4, 'kf').flash, 'X'), name = html.match(/--path:(pk\d[01]+);/)[1];
  assert.ok(html.includes(`@keyframes ${name} {`) && html.includes(`@keyframes ${name}r {`), 'the way down and the turn');
  assert.match(html, /<svg viewBox="0 0 100 115"/);
});
