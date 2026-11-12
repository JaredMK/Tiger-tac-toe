// Sniff's look and walk (the polish sweep, November 2026; sniff/view.js): the meadow, the dog a drawing in the walker's
// colour that trots over its step (its prints timed from the move), its word landing with a badge as it arrives, the
// cells it may step to lit in the mover's colour; nothing of a step left once it is over (the shared game's rule); the
// find (the dig, then the chest); the treasure never in an open square's markup; the miniature a meadow with the dog.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const { state } = await import('../../src/ui/app.js');
const { renderMini } = await import('../../src/ui/mini.js');
const V = await import('../../src/games/sniff/view.js');
const { GAMES } = await import('../../src/games/index.js');
GAMES.sniff.view = V;   // (the page registers the views in main.js; here by hand)

function match(seed) {
  Object.assign(state, E.newMatch(E.makeRng(seed || 'sniff-polish'), { games: ['sniff'], vs: 'cpu' }), { screen: 'mini', zoom: 0, cpu: 'O', sc: null, flash: null, done: null, spot: null, winner: null, online: null, turn: 'X', stamp: null, lock: null });
  state.setup.vs = 'cpu'; state.setup.names = { X: 'Xena', O: 'Computer' };
  return state.squares[0].mini;
}
const stepOf = (m, res) => E.sniffDirs(m.dog).find(d => E.sniffStep(m.dog, d) !== m.treasure && E.sniffRes(m.dog, E.sniffStep(m.dog, d), m.treasure) === res);
const field = html => html.slice(html.indexOf('<svg class="sfield"'), html.indexOf('</svg>', html.indexOf('<svg class="sfield"')));

test('an open square: the meadow, the dog in the mover\'s colour, the steps lit in it; nothing of the treasure, no trail', () => {
  const m = match(), html = renderMini(state.squares[0]), f = field(html);
  assert.equal((f.match(/class="scell/g) || []).length, 49); assert.match(f, /class="sdecor"/);
  assert.match(f, /class="sdw c-X"/, 'the neckerchief: the player on the move'); assert.match(f, /class="smoves X"/);
  assert.equal((f.match(/class="smove"/g) || []).length, E.sniffDirs(m.dog).length); assert.equal((f.match(/class="sstep"/g) || []).length, E.sniffDirs(m.dog).length);
  assert.doesNotMatch(f, /schest|sbox|spaw|sbadge|strail/, 'no chest, no prints, no badge');
  const [tx, ty] = [(m.treasure % 7) * 20 + 10, Math.floor(m.treasure / 7) * 20 + 10];
  assert.doesNotMatch(f.replace(/class="scell[^>]*>/g, '').replace(/<g class="smove"[\s\S]*?<\/g>/g, ''), new RegExp(`translate\\(${tx} ${ty}\\)`), 'nothing drawn on the treasure\'s cell');
  state.turn = 'O'; assert.match(field(renderMini(state.squares[0])), /class="sdw c-O"/, 'the other player on the move: their colour');
});

test('a step: the dog trots from its cell, its prints timed from the move, the word and its badge at the arrival; all gone after', () => {
  for (const res of ['hot', 'cold']) {
    let k = 0, m = match('sniff-polish-' + res); while (!stepOf(m, res)) m = match('sniff-polish-' + res + ++k);   // (a deal with such a step: in steps, not every start has one each way)
    const from = m.dog, d = stepOf(m, res);
    assert.ok(E.playMove(state, 0, d, E.makeRng('s')).ok);
    const html = renderMini(state.squares[0]), f = field(html);
    assert.match(f, /class="sdog walk" style="--dx:[-\d.]+px;--dy:[-\d.]+px;--d:420ms;--t:420ms/, 'it walks from where it was');
    assert.match(f, new RegExp(`class="sdw c-X r-${res} late"`), 'its word lands as it arrives');
    const paws = [...f.matchAll(/class="spaw X fresh" style="--t:(\d+)ms"/g)].map(x => Number(x[1]));
    assert.deepEqual(paws, V.SNIFFT.paws.map(k => Math.round(E.SNIFF.step * k)), 'a print at a time, each before the dog arrives'); assert.ok(paws.every(t => t < E.SNIFF.step));
    assert.match(f, new RegExp(`class="sbin ${res} appear" style="--t:${E.SNIFF.step}ms"`), 'the badge with the word');
    assert.match(html, new RegExp(`class="arcres ${res} appear" style="--t:${E.SNIFF.step}ms" role="status">${res === 'hot' ? 'Hotter!' : 'Colder!'}<`));
    assert.doesNotMatch(f, /class="smove"/, 'no steps to tap while it plays');
    const snd = []; V.sounds(state.flash, (n, t) => snd.push([n, t]));
    assert.deepEqual(snd.filter(x => x[0] === 'hop').map(x => x[1]), paws, 'a paw\'s sound with each print');
    assert.deepEqual(snd[snd.length - 1], [res === 'hot' ? 'higher' : 'lower', E.SNIFF.step], 'the word\'s sound as it lands');
    assert.ok(Math.max(...snd.map(x => x[1])) < E.playMs(state.flash));
    state.flash = null; state.done = null;
    const after = field(renderMini(state.squares[0]));
    assert.doesNotMatch(after, /spaw|sbadge|r-hot|r-cold|walk/, 'nothing of the step stays (the shared game)');
    assert.ok(from !== m.dog);
  }
});

test('the find: the dog digs, then the chest comes up beside it and the line says so; inside the move\'s time', () => {
  const m = match('sniff-polish-find');
  const t = m.treasure; m.dog = t % 7 > 0 ? t - 1 : t + 1;
  const d = E.sniffDirs(m.dog).find(k => E.sniffStep(m.dog, k) === t);
  assert.ok(E.playMove(state, 0, d, E.makeRng('f')).ok);
  const html = renderMini(state.squares[0]), f = field(html), rise = E.SNIFF.step + V.SNIFFT.dig;
  assert.match(f, /class="sdw c-X r-found late"/); assert.equal((f.match(/class="sdirt"/g) || []).length, 5);
  assert.match(f, new RegExp(`class="schest srise" style="--t:${rise}ms"`)); assert.match(f, /class="sbox"/);
  assert.match(html, new RegExp(`class="arcres hot appear" style="--t:${rise}ms" role="status">Found it!<`), 'the words with the chest');
  assert.ok(rise + V.SNIFFT.rise + 600 < E.playMs(state.flash), 'the dig and the chest inside the move');
  const snd = []; V.sounds(state.flash, (n, t) => snd.push([n, t]));
  assert.deepEqual(snd.filter(x => x[0] === 'dig').map(x => x[1]), [E.SNIFF.step, E.SNIFF.step + Math.round(V.SNIFFT.dig / 2)]); assert.ok(snd.some(x => x[0] === 'sparkle' && x[1] > rise));
  const x = f.match(/class="schestw" transform="translate\(([\d.]+) ([\d.]+)\)/);
  assert.ok(Number(x[1]) > 6 && Number(x[1]) < 134, 'the chest inside the field');
});

test('the miniature: a meadow with the dog\'s head, nothing else', () => {
  const m = match('sniff-polish-mini'), mini = V.miniature(E.publicMini ? E.publicMini(m) : m);
  assert.match(mini, /class="tsniff"/); assert.match(mini, /class="tsnbg"/); assert.match(mini, /class="tsd"/);
  assert.doesNotMatch(mini, /sbox|schest|<text/);
});
