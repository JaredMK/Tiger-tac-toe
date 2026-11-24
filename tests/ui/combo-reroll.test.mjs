// Dice Combo's re-roll (December 2026): the held dice slide to the left, the rest roll on the right, then all five slide
// into order, each die one element carrying its own held mark; and the last roll's one combo claimed by itself after a
// short highlight. Rendered in Node with the browser's names stubbed (the order of moments the browser check confirmed).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
// (motion on: the page's reduced-motion question answered no, so the views give every moment of a move)
const noMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
Object.defineProperty(globalThis, 'matchMedia', { value: noMedia, configurable: true, writable: true });
Object.defineProperty(globalThis, 'window', { value: new Proxy(function () {}, { get: (t, k) => (k === 'matchMedia' ? noMedia : k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true }), configurable: true, writable: true });
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const { GAMES } = await import('../../src/games/index.js');
const CR = await import('../../src/games/combo/rules.js');
const CV = await import('../../src/games/combo/view.js');
const { state } = await import('../../src/ui/app.js');
const css = readFileSync(new URL('../../src/ui/styles.css', import.meta.url), 'utf8');
state.setup = Object.assign({}, state.setup, { names: { X: 'Xena', O: 'Olaf' } });

const clone = v => JSON.parse(JSON.stringify(v));
const faces = (...f) => { let i = 0; return () => (f[i++ % f.length] - 1 + 0.5) / 6; };   // a rng that rolls these faces in order
function play(mini, p, m, rng) {
  const c = clone(mini), res = E.applyMove(c, p, m, rng);
  assert.equal(res.ok, true, JSON.stringify(m));
  const flash = { kind: res.outcome === 'win' ? 'claim' : 'move', by: p, next: p, square: 4, type: 'combo', note: res.note || null, pass: null, timeout: false, m };
  GAMES.combo.rules.moveFlash(m, p, null, 0, c, flash);
  return { mini: c, flash, res };
}
const screen = (mini, flash, turn, o = {}) => CV.screen({ owner: null, mini }, flash, null, mini, !!o.view, !!flash || !!o.locked, flash, null, false, () => -1, false, turn, '');
const sounds = f => { const out = []; CV.sounds(f, (n, ms) => out.push([n, ms]), false); return out; };
const here = mini => { state.screen = 'mini'; state.zoom = 4; state.squares = Array.from({ length: 9 }, (_, i) => ({ owner: null, mini: i === 4 ? mini : { type: 'ttt' } })); state.flash = null; state.done = null; state.lock = null; state.winner = null; state.online = null; state.cpu = null; state.turn = 'X'; };
// Each die of a tray as drawn: its slot's classes, the sort's slide (from where it was rolled), the gather's slide (from
// where it lay before the move) and its pad's element's classes, and its own tumble (thrown, its length, its start).
function dice(h) {
  const tray = h.slice(h.indexOf('<div class="cmbtray'));
  return [...tray.matchAll(/<(?:span|button) class="cmbd([^"]*)"[^>]*aria-label="Die (\d)[^"]*"><span class="cmbs( mv)?"(?: style="--dx:(-?\d+);--tq:(\d+)ms")?><span class="cmbg([^"]*)"(?: style="--gx:(-?\d+);--gd:(\d+)ms")?><span class="d3 d3cube( roll)? v\d"(?: style="--dur:(\d+)ms(?:;--t:(\d+)ms)?")?/g)]
    .map(d => ({ cls: d[1].trim(), dx: d[3] ? Number(d[4]) : 0, tq: d[5] ? Number(d[5]) : null, g: d[6].trim(), gx: d[7] ? Number(d[7]) : 0, gd: d[8] ? Number(d[8]) : null, roll: !!d[9], dur: Number(d[10] || 0), t: Number(d[11] || 0) }));
}
// Where die i (its slot in the markup) stands at each phase, in places: before the move, rolled, at the end.
const places = ds => ds.map((d, i) => [i + d.dx + d.gx, i + d.dx, i]);

test('Dice Combo re-roll: the held dice slide to the left in the order they lay, the rest close up to their right, roll there, then all five slide into order', () => {
  const T = CR.COMBO, m0 = E.newMini('combo', E.makeRng('c')), r1 = play(m0, 'X', 'roll', faces(5, 1, 6, 3, 2));
  assert.deepEqual(r1.mini.cur.dice, [1, 2, 3, 5, 6]);
  // hold the 3 and the 6 (places 2 and 4); the 1, 2 and 5 rolled again: 4, 5, 2
  const r2 = play(r1.mini, 'X', 'roll:00101', faces(4, 5, 2)), c = r2.flash.combo, tm = CR.comboTimes(c);
  assert.deepEqual([c.raw, c.dice], [[4, 5, 3, 2, 6], [2, 3, 4, 5, 6]]);
  assert.deepEqual(CR.comboGather(c.held), [2, 3, 0, 4, 1], 'the held 3 and 6 to places 0 and 1, the others closed up after them');
  assert.deepEqual([tm.gather, tm.toss, tm.sortAt], [T.gather, T.gather, T.gather + T.land]);
  here(r1.mini);
  const ds = dice(screen(r1.mini, r2.flash, 'X'));
  assert.equal(ds.length, 5);
  // each die: from its place before the move, to its place while rolled, to its sorted place
  assert.deepEqual(places(ds), [[3, 4, 0], [2, 0, 1], [0, 2, 2], [1, 3, 3], [4, 1, 4]]);
  assert.deepEqual(ds.map(d => d.cls), ['', 'held', '', '', 'held'], 'the held mark on the held dice themselves (the 3 and the 6, now in places 1 and 4)');
  for (const d of ds) {
    if (d.dx) assert.equal(d.tq, tm.sortAt, 'the sort after the last die lands');
    if (d.gx) assert.equal(d.gd, T.gather);
    if (d.cls === 'held') assert.equal(d.roll, false, 'a held die is never thrown');
    else { assert.equal(d.roll, true); assert.equal(d.t, T.gather, 'thrown once the held ones are across'); assert.match(d.g, /\bfr\b/, 'thrown in from the right'); }
  }
  // the dice thrown land in the right part, inside the move
  assert.ok(ds.filter(d => d.roll).every((d, k) => d.t + d.dur <= tm.sortAt));
  assert.ok(tm.sortAt + T.sort <= tm.land && tm.end <= CR.flashMs(r2.flash));
  // the pad is the die's own wrapper's, never a slot's, and a die with no held class shows none
  assert.match(css, /\.cmbd\.held \.cmbg::before \{ opacity: 1;/); assert.doesNotMatch(css, /\.cmbd(\.held)?::before/);
  assert.match(css, /\.cmbg\.mv \{ animation: cmbsort/); assert.match(css, /\.cmbs\.mv \{ animation: cmbsort/);
  // the sounds: the slide, then the throw's, all moved on by the gather
  assert.deepEqual(sounds(r2.flash).map(s => s[0]), ['pieceSlide', 'rattle', 'diceTap', 'diceTap', 'thunk']);
  assert.deepEqual(sounds(r2.flash).filter(s => s[0] === 'rattle' || s[0] === 'thunk').map(s => s[1]), [T.gather, T.gather + T.land]);
});

test('Dice Combo re-roll: held dice already at the left need no gather; the first roll has none; nothing re-tilts when the move is over', () => {
  const T = CR.COMBO, m0 = E.newMini('combo', E.makeRng('c')), r1 = play(m0, 'X', 'roll', faces(5, 1, 6, 3, 2));
  assert.equal(CR.comboTimes(r1.flash.combo).gather, 0, 'the first roll: straight in');
  here(m0);
  const d1 = dice(screen(m0, r1.flash, 'X'));
  assert.ok(d1.every(d => !d.gx && d.roll && d.t === 0 && !/\bfr\b/.test(d.g)));
  const r2 = play(r1.mini, 'X', 'roll:11000', faces(6, 6, 6)), tm = CR.comboTimes(r2.flash.combo);
  assert.deepEqual([tm.gather, tm.toss], [0, 0], 'the held 1 and 2 are at the left already');
  here(r1.mini);
  assert.ok(dice(screen(r1.mini, r2.flash, 'X')).every(d => !d.gx));
  // a die's resting tilt is by its number: the same while the move plays and after it (no snap as it ends)
  const tilt = h => [...h.slice(h.indexOf('<div class="cmbtray')).matchAll(/<span class="d3 d3cube(?: roll)? (v\d)"/g)].map(x => x[1]);
  here(r2.mini);
  assert.deepEqual(tilt(screen(r1.mini, r2.flash, 'X')), tilt(screen(r2.mini, null, 'X')));
  // the old shake after the sort is gone
  assert.doesNotMatch(css, /cmbno/);
});

test('Dice Combo re-roll: the held mark is on the held dice in their final places, never on one thrown', () => {
  const m0 = E.newMini('combo', E.makeRng('c')), r1 = play(m0, 'X', 'roll', faces(5, 1, 6, 3, 2)), r2 = play(r1.mini, 'X', 'roll:00101', faces(4, 4, 2));
  here(r1.mini);
  const ds = dice(screen(r1.mini, r2.flash, 'X'));
  assert.deepEqual(ds.map(d => [d.cls, d.roll]), [['', true], ['held', false], ['', true], ['', true], ['held', false]]);
  assert.ok(ds.every(d => !(d.cls === 'held' && d.roll)));
});

// ---------- the last roll's one combo ----------
function lastRoll(dice, claimed) {
  const m = E.newMini('combo', E.makeRng('c'));
  m.claimed.X = claimed || [];
  m.cur = { by: 'X', dice, rolls: 2 };
  return m;
}
test('Dice Combo: after the last roll, one combo the dice make claims itself after a short highlight; none or several: the player chooses', () => {
  // one: 2 2 2 4 5 makes three of a kind alone
  let m = lastRoll([2, 2, 2, 4, 5]); here(m); state.cpu = 'O';
  let h = screen(m, null, 'X');
  assert.equal((h.match(/class="cmbc can auto"/g) || []).length, 1, 'lit for a beat');
  assert.match(h, /<button class="cmbc can auto" data-act="move" data-m='"c:3k"' data-fx="\d+" aria-label="Three of a kind: claim it">/);
  const a = CV.autoArmed();
  assert.equal(a.k, '3k'); assert.equal(a.sent, false);
  h = screen(m, null, 'X');
  assert.equal(CV.autoArmed(), a, 'a second render arms nothing new');
  // when the beat is over the claim goes, once
  const r = CV.fireAuto(a);
  assert.equal(r, true); assert.equal(a.sent, true);
  assert.deepEqual(state.squares[4].mini.claimed.X, ['3k'], 'claimed: the move played here');
  assert.equal(CV.fireAuto(a), false, 'never twice');
  // the player tapped it first, or a timeout ended the move: the beat sends nothing
  m = lastRoll([2, 2, 2, 4, 5], []); here(m); state.cpu = 'O'; screen(m, null, 'X');
  const b = CV.autoArmed(); m.cur = null;
  assert.equal(CV.fireAuto(b), false);
  // the player left the square: nothing
  m = lastRoll([3, 3, 3, 4, 5]); here(m); state.cpu = 'O'; screen(m, null, 'X');
  const c2 = CV.autoArmed(); state.screen = 'board'; state.zoom = null;
  assert.equal(CV.fireAuto(c2), false); assert.deepEqual(m.claimed.X, []);
  // none: a last roll that makes nothing ends the move in the rules; nothing to arm here
  // several: 2 2 2 3 3 makes three of a kind and a full house: the player chooses
  m = lastRoll([2, 2, 2, 3, 3]); here(m); state.cpu = 'O';
  const before = CV.autoArmed();
  h = screen(m, null, 'X');
  assert.equal((h.match(/class="cmbc can"/g) || []).length, 2); assert.doesNotMatch(h, /cmbc[^"]*auto/); assert.equal(CV.autoArmed(), before, 'nothing armed');
  // three of a kind claimed already: the full house alone is left: it claims itself
  m = lastRoll([2, 2, 2, 3, 3], ['3k']); here(m); state.cpu = 'O';
  h = screen(m, null, 'X'); assert.match(h, /data-m='"c:fh"'[^>]*data-fx/);
  // not the last roll: nothing
  m = lastRoll([2, 2, 2, 4, 5]); m.cur.rolls = 1; here(m); state.cpu = 'O';
  assert.doesNotMatch(screen(m, null, 'X'), /cmbc[^"]*auto/);
  // the computer's turn, the other side online, a replay or a finished square: nothing
  m = lastRoll([2, 2, 2, 4, 5]); m.cur.by = 'O'; here(m); state.cpu = 'O'; state.turn = 'O';
  assert.doesNotMatch(screen(m, null, 'O'), /cmbc[^"]*auto/);
  m = lastRoll([2, 2, 2, 4, 5]); here(m); state.online = { me: 'O' };
  assert.doesNotMatch(screen(m, null, 'X'), /cmbc[^"]*auto/); state.online = null;
  assert.doesNotMatch(screen(m, null, 'X', { locked: true }), /cmbc[^"]*auto/);
  assert.doesNotMatch(screen(m, null, 'X', { view: true }), /cmbc[^"]*auto/);
  // the beat's length: COMBO.auto, its look in the stylesheet
  assert.equal(CR.COMBO.auto, 600); assert.match(css, /\.cmbc\.can\.auto \{[^}]*animation: cmbauto 600ms/);
});
