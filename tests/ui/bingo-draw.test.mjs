// Bingo's draw (src/games/bingo/view.js): the square opens on the cards and Pick numbers, never a number; the draw's
// replay rolls the drawn balls out of the cage from its recorded flash (never the square's own offer); the drawn balls
// are the call's controls; a call's replay lifts the ball called. Rendered in Node with the browser's names stubbed.
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
const V = await import('../../src/games/bingo/view.js');
const R = await import('../../src/games/bingo/rules.js');
const { repOf } = await import('../../src/core/replay.js');
const { state } = await import('../../src/ui/app.js');
state.setup = Object.assign({}, state.setup, { names: { X: 'Xena', O: 'Olaf' } });

const clone = v => JSON.parse(JSON.stringify(v));
function play(mini, p, move, rng) {
  const m = clone(mini), res = E.applyMove(m, p, move, rng);
  assert.equal(res.ok, true, `${move} refused (${res.reason})`);
  const flash = { kind: res.again ? 'again' : 'move', by: p, next: p, square: 0, type: 'bingo', note: res.note || null, pass: null, timeout: false };
  GAMES.bingo.rules.moveFlash(move, p, null, 0, m, flash);
  return { mini: m, flash };
}
const screen = (mini, flash, locked, turn) => V.screen({ owner: null, mini }, flash, null, mini, false, !!locked, flash, null, false, () => -1, false, turn || 'X', '');
const balls = html => [...html.matchAll(/class="bgball [abc][^"]*"[^>]*data-m='(\d+)'[^>]*aria-label="Call (\d+)"/g)].map(m => Number(m[2]));

test('the square opens on the cards and Pick numbers (the move "draw", the control the replay presses), never a number of the offer', () => {
  const m = E.newMini('bingo', E.makeRng('bgv'));
  const html = screen(m, null, false);
  assert.ok(html.includes(`data-act="move" data-m='"draw"'`), 'Pick numbers is the draw\'s control');
  assert.equal(repOf('draw'), 'm="draw"', 'as the replay log writes it');
  assert.match(html, />Pick numbers</);
  assert.deepEqual(balls(html), [], 'no balls');
  assert.doesNotMatch(html, /Call \d/);
  assert.match(screen(m, null, true), /class="bgdraw"[^>]*disabled/, 'not this phone\'s turn: Pick numbers is shown but off');
});

test('a draw plays from its flash: the cage turns and the flash\'s balls roll out one by one, timed from the move; then the drawn balls are the call\'s controls', () => {
  const m0 = E.newMini('bingo', E.makeRng('bgv2')), d = play(m0, 'O', 'draw', E.makeRng('bgv-d'));
  const T = R.bingoDrawTimes(d.flash.bingo);
  // the replay on the other phone: the square as it was (nothing drawn), the draw's flash playing
  const html = screen(m0, d.flash, true, 'O');
  assert.match(html, /class="bgcage spin"/);
  assert.deepEqual(balls(html), d.flash.bingo.offer, 'the balls are the draw\'s');
  T.balls.forEach((ms, k) => assert.ok(html.includes(`--k:${k};--t:${ms}ms`), `ball ${k} rolls out at ${ms} ms`));
  assert.deepEqual([T.balls[2] < T.balls[1], T.balls[1] < T.balls[0], T.end > T.balls[0]], [true, true, true]);
  assert.doesNotMatch(html, /bgdraw/, 'Pick numbers gone as the cage turns');
  // a square whose own offer differs (another phone's state): still the flash's numbers
  const other = clone(d.mini); other.offer = [1, 2, 3].filter(v => !d.flash.bingo.offer.includes(v)).concat([4, 5, 6]).slice(0, 3);
  assert.deepEqual(balls(screen(other, d.flash, true, 'O')), d.flash.bingo.offer);
  // its sounds: the cage, a ball each
  const snd = []; V.sounds(d.flash, (n, ms) => snd.push([n, ms]));
  assert.deepEqual(snd, [['bgCage', T.spin], ...T.balls.flatMap((ms, k) => [['bgBall', ms], ['diceTap', T.lands[k]]])], 'the cage, then each ball\'s clack out of the spout and its click into place');
  T.lands.forEach((ms, k) => { assert.ok(ms > T.balls[k] && ms <= T.end, 'in its place before the draw ends'); assert.ok(html.includes(`--t:${T.balls[k]}ms;--d:${ms - T.balls[k]}ms`), 'its roll lasts until it lands'); });
  const src = fs.readFileSync(new URL('../../src/audio/sound.js', import.meta.url), 'utf8');
  for (const n of ['bgCage', 'bgBall', 'diceTap']) assert.match(src, new RegExp(`^def\\('${n}',`, 'm'), n + ' is a sound');
  // drawn, the result gone: the balls, each its index as the move, open to the mover only
  const open = screen(d.mini, null, false, 'O');
  assert.deepEqual(balls(open), d.mini.offer);
  assert.equal((open.match(/class="bgball[^"]*"[^>]*disabled/g) || []).length, 0);
  assert.equal((screen(d.mini, null, true, 'O').match(/class="bgball[^"]*"[^>]*disabled/g) || []).length, 3);
  assert.match(open, /Olaf<\/b>'s call/);
});

test('a call\'s replay: the ball called lifts away, the others fade; the offer is spent and the next turn starts on Pick numbers', () => {
  const m0 = E.newMini('bingo', E.makeRng('bgv3')), d = play(m0, 'X', 'draw', E.makeRng('bgv-d3')), c = play(d.mini, 'X', 2, E.makeRng('x'));
  const html = screen(d.mini, c.flash, true, 'X');
  assert.match(html, new RegExp(`class="bgball [abc] bgpick"[^>]*data-m='2'`));
  assert.equal((html.match(/bgdim/g) || []).length, 2);
  assert.deepEqual(c.mini.offer, []);
  if (!c.mini.win) assert.match(screen(c.mini, null, false, 'O'), />Pick numbers</);
});

test('the miniature: the two cards and each owner\'s drawn mark, no text', () => {
  const m = E.newMini('bingo', E.makeRng('bgv4')); E.applyMove(m, 'X', 'draw', E.makeRng('a')); E.applyMove(m, 'X', 0, E.makeRng('b'));
  const svg = V.miniature(m);
  assert.doesNotMatch(svg, /<text/);
  assert.match(svg, /class="tbgl X"/); assert.match(svg, /class="tbgl O"/);
});

test('the number tracker: every number of the range in a compact grid, each called one filled in its caller\'s colour, the latest ringed; a call under replay lands in it with its mark', () => {
  const m = E.newMini('bingo', E.makeRng('bgtk')), rng = E.makeRng('bgtk2');
  const d = play(m, 'X', 'draw', rng);
  const c1 = play(d.mini, 'X', 0, rng);                                // X calls the first ball
  const html = screen(c1.mini, null, false, 'O');
  assert.equal((html.match(/class="bgtk[ "]/g) || []).length, m.range, 'every number of the range');
  assert.equal((html.match(/class="bgtk on X last"/g) || []).length, 1, 'the one called: X\'s colour, ringed');
  assert.equal((html.match(/class="bgtk"/g) || []).length, m.range - 1, 'the rest uncalled');
  const d2 = play(c1.mini, 'O', 'draw', rng), c2 = play(d2.mini, 'O', 0, rng);
  const h2 = screen(c2.mini, null, false, 'X');
  assert.equal((h2.match(/class="bgtk on [XO]"/g) || []).length, 1, 'the earlier call stays marked, no ring'); assert.equal((h2.match(/bgtk on O last/g) || []).length, 1, 'the latest ringed');
  const rep = screen(c2.mini, c2.flash, true, 'X');                    // O's call played back: its number lands with the mark
  assert.match(rep, /class="bgtk new O last" style="--t:\d+ms"/); assert.doesNotMatch(rep, /bgtk on O/, 'not filled before it lands');
});

// ----- the polish pass (November 2026): the call flies to the tracker, each card's mark lands with it (the second card a
// beat after the first), the squares a call would mark and the squares one call from a line are shown, and a line is
// struck through on its owner's card, whoever called it -----
const fixed = (x, o, called, by, offer) => ({ type: 'bingo', n: 3, range: 26, diag: true, cards: { X: x, O: o }, called, callBy: by, offer, calls: { X: 0, O: 0 }, last: null });
const X9 = [1, 2, 3, 4, 5, 6, 7, 8, 9], O9 = [3, 11, 12, 13, 14, 15, 16, 17, 18];
const cardOf = (html, p) => html.split(`<div class="bgcard ${p}`)[1].split('<div class="bgcard ')[0];
const cell = (html, p, v) => (cardOf(html, p).match(new RegExp(`<span class="(bgc[^"]*)"[^>]*aria-label="${v}[",]`)) || [])[1] || '';

test('before the call: the drawn balls can be tapped (ringed: go) only by the mover, the squares a ball would mark are ringed and the squares one call from a line dashed, on both cards', () => {
  const m = fixed(X9, O9, [1, 2, 11], ['X', 'O', 'X'], [3, 20, 12]);
  const html = screen(m, null, false, 'X');
  assert.equal((html.match(/class="bgball [abc] go"/g) || []).length, 3); assert.match(html, /g-bingo pc-X/);
  assert.equal((screen(m, null, true, 'X').match(/class="bgball [abc] go"/g) || []).length, 0, 'not the mover\'s phone: no ring');
  assert.match(cell(html, 'X', 3), /bgoff/); assert.match(cell(html, 'O', 3), /bgoff/); assert.match(cell(html, 'O', 12), /bgoff/);
  assert.match(cell(html, 'X', 3), /bgneed/, 'X has 1 and 2: 3 would make the row');
  assert.doesNotMatch(cell(html, 'O', 12), /bgneed/); assert.doesNotMatch(cell(html, 'X', 4), /bgoff|bgneed/);
  assert.match(screen(m, null, false, 'O'), /g-bingo pc-O/, 'the mover\'s colour on Pick numbers, the knob and the rings');
});

test('a call on both cards: the ball flies from its place to its number on the tracker, X\'s mark lands with it and O\'s a beat after, each ringed in the caller\'s colour, a plop each; the words name the cards', () => {
  const m0 = fixed(X9, O9, [1, 11], ['X', 'O'], [20, 3, 12]), c = play(m0, 'O', 1, E.makeRng('x'));
  const T = R.bingoTimes(c.flash.bingo), B = R.BINGOT, html = screen(c.mini, c.flash, true, 'X');
  assert.deepEqual(T.daub, { X: B.land, O: B.land + B.gap });
  assert.match(html, new RegExp(`class="bgfly [abc]"[^>]*data-cf="bgball:1" data-cfat="${B.press}" data-cfgo="" data-cfd="${B.fly}"`), 'the flyer: from the ball called, gone as it lands');
  assert.match(html, /class="bgball [abc] bgpick"[^>]*data-anchor="bgball:1"/);
  assert.match(cardOf(html, 'X'), new RegExp(`class="bgc on bgnew byO[^"]*" style="--t:${T.daub.X}ms"`));
  assert.match(cardOf(html, 'O'), new RegExp(`class="bgc on bgnew byO[^"]*" style="--t:${T.daub.O}ms"`));
  assert.match(html, />3: both cards</);
  const snd = []; V.sounds(c.flash, (n, ms) => snd.push([n, ms]));
  assert.deepEqual(snd, [['pop', 0], ['plop', T.daub.X], ['plop', T.daub.O]]);
  const one = play(fixed(X9, O9, [], [], [5, 20, 21]), 'X', 0, E.makeRng('x'));
  assert.match(screen(one.mini, one.flash, false, 'O'), />5: <b class="X">X<\/b>'s card</);
  const none = play(fixed(X9, O9, [], [], [20, 21, 22]), 'X', 0, E.makeRng('x')), ns = []; V.sounds(none.flash, (n, ms) => ns.push([n, ms]));
  assert.deepEqual(ns, [['pop', 0], ['thud', B.land]]); assert.match(screen(none.mini, none.flash, false, 'O'), />20: no card</);
});

test('a line is its card owner\'s, whoever called it: struck through on that card, which takes the gold frame while the other steps back, and the words name the card', () => {
  const m0 = fixed(X9, O9, [1, 2, 11], ['X', 'O', 'X'], [3, 20, 21]);
  for (const caller of ['X', 'O']) {                                   // X's own line, and O handing it to X
    const c = play(m0, caller, 0, E.makeRng('x')), T = R.bingoTimes(c.flash.bingo), html = screen(c.mini, c.flash, true, 'X');
    assert.deepEqual(c.flash.bingo.won, { X: [0, 1, 2], O: null });
    assert.match(html, new RegExp(`<div class="bgcard X bgwon" style="--t3:${T.strike}ms"`)); assert.match(html, new RegExp(`<div class="bgcard O bglost" style="--t3:${T.strike}ms"`));
    assert.match(cardOf(html, 'X'), new RegExp(`<svg class="bgstrike" viewBox="0 0 3 3"[^>]*style="--t3:${T.strike}ms"><path class="bgsl o" pathLength="1" d="M0.5 0.5L2.5 0.5"/>`), 'the top row, struck from its first square to its last');
    assert.doesNotMatch(cardOf(html, 'O'), /bgstrike/); assert.equal((html.match(/class="bgstar"/g) || []).length, 6);
    assert.match(html, new RegExp(`class="arcres line appear" style="--t:${T.line}ms" role="status">Line on <b class="X">X</b>'s card!<`));
    assert.ok(T.strike > T.line && T.end > T.strike + R.BINGOT.strike);
    const snd = []; V.sounds(c.flash, (n, ms, r) => snd.push([n, ms, r]));
    assert.deepEqual(snd.filter(s => s[0] === 'point').map(s => s[1]), [0, 1, 2].map(k => T.line + k * R.BINGOT.step)); assert.ok(snd[snd.length - 2][2] < snd[snd.length - 1][2] || snd[snd.length - 1][0] === 'sparkle');
    assert.deepEqual(snd[snd.length - 1].slice(0, 2), ['sparkle', T.strike]);
    // the finished square: the line stays struck, the cards as they ended
    const fin = Object.assign(clone(c.mini), { win: 'X', winCells: [0, 1, 2] }), rev = V.screen({ owner: 'X', mini: fin }, null, null, fin, true, true, null, null, false, () => -1, false, 'O', '');
    assert.match(rev, /<div class="bgcard X bgwon set">/); assert.match(rev, /<div class="bgcard O bglost set">/); assert.match(rev, /<svg class="bgstrike set"/);
    assert.match(V.miniature(fin), /class="tbgk X won"/); assert.match(V.miniature(fin), /class="tbgs o"/); assert.match(V.miniature(fin), /class="tbgk O lost"/);
  }
  // both lines on the one call: both struck, neither card framed or dimmed
  const tie = play(fixed(X9, [20, 21, 22, 23, 24, 25, 3, 16, 17], [1, 2, 16, 17], ['X', 'O', 'X', 'O'], [3, 8, 9]), 'X', 0, E.makeRng('x')), th = screen(tie.mini, tie.flash, false, 'O');
  assert.equal((th.match(/<svg class="bgstrike"/g) || []).length, 2); assert.doesNotMatch(th, /bgwon|bglost|bgstar/); assert.match(th, />Both lines!</);
});

test('the tracker is three rows of nine for 1 to 26 (wider grids for longer ranges), and the stylesheet carries the move\'s classes', () => {
  const m = E.newMini('bingo', E.makeRng('bgtk3'));
  assert.match(screen(m, null, false), /class="bgtks" style="--c:9"/);
  const css = fs.readFileSync(new URL('../../src/ui/styles.css', import.meta.url), 'utf8');
  for (const c of ['.bgfly', '.bgc.bgneed', '.bgc.bgoff', '.bgstrike', '.bgcard.bgwon', '.bgcard.bglost', '.bgball.go', '@keyframes bgroll', '@keyframes bgstamp', '@keyframes bgburst', '.tbingo .tbgd']) assert.ok(css.includes(c), c);
});
