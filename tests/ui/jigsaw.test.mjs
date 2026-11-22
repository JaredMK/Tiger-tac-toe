// Puzzle Build's screen (src/games/jigsaw/view.js): the board shows only the pieces in place, never the whole picture
// before the square is decided; the square opens on Draw a piece with no piece on show; a draw plays from its flash; a
// placement's piece travels to the cell chosen and clicks in or goes back, timed from the move; the square decided, the
// pile drops in and the picture comes whole; a replay shows the committed steps alone. Rendered in Node with the
// browser's names stubbed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const { GAMES } = await import('../../src/games/index.js');
const V = await import('../../src/games/jigsaw/view.js');
const R = await import('../../src/games/jigsaw/rules.js');
const P = await import('../../src/games/jigsaw/picture.js');
const RP = await import('../../src/ui/replay.js');
const { state } = await import('../../src/ui/app.js');
GAMES.jigsaw.view = V;
state.setup = Object.assign({}, state.setup, { names: { X: 'Xena', O: 'Olaf' } });

const clone = v => JSON.parse(JSON.stringify(v));
function play(mini, p, move, rng) {
  const m = clone(mini), res = E.applyMove(m, p, move, rng || E.makeRng('x'));
  assert.equal(res.ok, true, `${JSON.stringify(move)} refused (${res.reason})`);
  const flash = { kind: res.outcome === 'win' ? 'claim' : res.outcome === 'draw' ? 'draw' : res.again ? 'again' : 'move', by: p, next: p, square: 0, type: 'jigsaw', note: res.note || null, pass: null, timeout: false };
  GAMES.jigsaw.rules.moveFlash(move, p, null, 0, m, flash);
  return { mini: m, flash };
}
// The screen as the page draws it: the square in the match (so this phone's step shows live), or only looked at.
function screen(mini, flash, o = {}) {
  state.squares = Array.from({ length: 9 }, () => ({ owner: null, mini })); state.zoom = 0; state.screen = 'mini'; state.online = null; state.cpu = null; state.turn = o.turn || 'X'; state.flash = flash || null; state.done = null;
  return V.screen({ owner: o.view ? 'X' : null, mini }, flash, null, mini, !!o.view, !!o.locked || !!flash, flash, null, false, () => -1, false, o.turn || 'X', '');
}
const uses = html => (html.match(/<use href="#jgs\d+"\/>/g) || []).length;                       // how many pieces of the picture are drawn (and the whole picture, were it there)
const fixed = (placed, offer, by) => { const m = E.newMini('jigsaw', E.makeRng('jgv')); m.placed = placed; m.got = { X: [...placed].filter(v => v === 'X').length, O: [...placed].filter(v => v === 'O').length }; m.offer = offer == null ? null : offer; m.by = offer == null ? null : by || 'X'; return m; };

test('the square opens on the board and Draw a piece: the centre piece alone is drawn, no piece is on show, no timer runs and the whole picture is nowhere', () => {
  const m = E.newMini('jigsaw', E.makeRng('jgv')), html = screen(m);
  assert.match(html, /<button class="big X jgdraw" data-act="jig-draw">Draw a piece<\/button>/);
  assert.equal(uses(html), 1, 'one piece drawn: the centre');
  assert.doesNotMatch(html, /jgwhole/); assert.doesNotMatch(html, /jgtime on/); assert.doesNotMatch(html, /data-act="jig-cell"/, 'no cell is a target before the draw');
  assert.equal((html.match(/class="jgcell"/g) || []).length, 8, 'eight empty slots');
  assert.match(html, new RegExp(`<g id="jgs${m.seed}">`), 'the sheet is in the page once, for the pieces to be cut from');
  assert.match(screen(m, null, { locked: true }), /jgdraw" data-act="jig-draw" disabled/, 'not this phone\'s turn: shown but off');
  assert.match(screen(m, null, { turn: 'O' }), /g-jig pc-O/, 'the mover\'s colour');
  assert.doesNotMatch(html, /Draw a piece to|Tap |tap /, 'no help text in the game');
});

test('a draw plays from its flash: the flash\'s piece slides out of the pile onto the tray; then every empty cell is a target, the piece can be dragged and the timer runs', () => {
  const m0 = E.newMini('jigsaw', E.makeRng('jgv2')), d = play(m0, 'O', 'draw', E.makeRng('jgv-d'));
  assert.deepEqual(d.flash.jig, { draw: true, by: 'O', c: d.mini.offer, k: 1 });
  let html = screen(d.mini, d.flash, { turn: 'O' });
  assert.match(html, /class="jgslot"><i class="jgbx" data-anchor="jgoffer"><\/i><span class="jgpw"><span class="jgfl" data-cf="jgpile" data-cfat="0" data-cfd="420">/, 'from the pile, timed from the move');
  assert.match(html, new RegExp(`viewBox="${P.jigPieceBox(3, d.mini.offer).map(v => Math.round(v * 10) / 10).join(' ')}"`), 'the piece is the flash\'s');
  const other = clone(d.mini); other.offer = [1, 3, 5, 7].find(c => c !== d.mini.offer);
  assert.match(screen(other, d.flash, { turn: 'O' }), new RegExp(`viewBox="${P.jigPieceBox(3, d.flash.jig.c).map(v => Math.round(v * 10) / 10).join(' ')}"`), 'never the square\'s own, while the draw plays');
  assert.doesNotMatch(html, /data-act="jig-cell"|jgtime on|jgdraw/, 'nothing to press while it comes out');
  assert.equal(V.hold(d.flash), 0, 'the piece can be placed the moment it is on the tray'); assert.equal(R.flashMs(d.flash), 500);
  html = screen(d.mini, null, { turn: 'O' });
  assert.equal((html.match(/<button class="jgcell open" data-act="jig-cell" data-c="\d"/g) || []).length, 8, 'every empty cell is a target');
  assert.match(html, /class="jgslot live"/); assert.match(html, /class="jgtime on"[^>]*data-fxk="rt"[^>]*style="--d:8000ms"/, 'the timer, in real time');
  assert.equal(uses(html), 2, 'the centre and the piece on show'); assert.doesNotMatch(html, /jgwhole|jgdraw/);
  assert.match(V.heldSub(d.mini, 'O', null, null), /Olaf<\/b>'s piece/);
  // someone else's piece: on show, but no targets, no timer and no drag here
  html = screen(d.mini, null, { turn: 'O', locked: true });
  assert.doesNotMatch(html, /data-act="jig-cell"|jgtime on|jgslot live/); assert.equal(uses(html), 2);
});

test('a placement plays from its flash: the piece travels from the tray to the cell chosen; in its own cell it clicks in with its layer\'s mark and the pip; anywhere else it shakes and flies back to the pile; out of time it goes back from the tray', () => {
  const m0 = fixed('....C....', 3, 'X');
  const ok = play(m0, 'X', { c: 3 }), T = R.jigTimes(ok.flash.jig);
  let html = screen(ok.mini, ok.flash);
  assert.match(html, new RegExp(`<div class="jgcell on byX"><i class="jgbx" data-anchor="jgcell:3"></i><span class="jgpw ok" style="--t:${T.land}ms"><span class="jgfl" data-cf="jgoffer" data-cfat="0" data-cfd="360">`));
  assert.match(html, new RegExp(`<span class="jgbd appear" style="--t:${T.land}ms"><i class="jgby X">`), 'whose piece it is, as it lands');
  assert.match(html, new RegExp(`<p class="jgline ok appear" style="--t:${T.land}ms" role="status">Fits!</p>`));
  assert.match(html, new RegExp(`class="on fillin" style="--t:${T.land}ms"`), 'the pip fills as it clicks in');
  assert.doesNotMatch(html, /jgwhole|jgslot live|jig-cell/);
  const no = play(m0, 'X', { c: 1 }), U = R.jigTimes(no.flash.jig);
  html = screen(no.mini, no.flash);
  assert.match(html, new RegExp(`data-anchor="jgcell:1"></i><span class="jgpw no" style="--t:${U.land}ms;--b:${U.back}ms"><span class="jgfl" data-cf="jgoffer" data-cfat="0" data-cfd="360">`), 'to the cell they chose');
  assert.match(html, new RegExp(`<span class="jgpw home"><span class="jgfl" data-cf="jgcell:1" data-cfat="${U.back}" data-cfgo="" data-cfd="380">`), 'and back to the pile');
  assert.match(html, />Not there<\/p>/); assert.doesNotMatch(html, /jgcell on by/, 'nothing laid');
  assert.match(html, new RegExp(`<b class="jgleft cnt" data-from="7" data-delay="${U.home}"`), 'the pile counts it once it is home');
  const out = play(m0, 'X', 'out'), W = R.jigTimes(out.flash.jig);
  html = screen(out.mini, out.flash);
  assert.match(html, new RegExp(`<span class="jgpw slow" style="--b:${W.back}ms">`)); assert.match(html, new RegExp(`data-cf="jgoffer" data-cfat="${W.back}" data-cfgo=""`)); assert.match(html, />Too slow<\/p>/);
  // what plays is the move's, never the square's last result
  const later = clone(ok.mini); later.last = { by: 'O', c: 5, at: 7, ok: false, was: { X: 1, O: 0 }, end: null };
  assert.match(screen(later, ok.flash), />Fits!<\/p>/);
  assert.deepEqual([V.moveText(ok.flash, 'A'), V.moveText(no.flash, 'A'), V.moveText(out.flash, 'A'), V.moveText(play(E.newMini('jigsaw', E.makeRng('q')), 'X', 'draw').flash, 'A')], ['A fitted a piece', 'A missed the place', 'A was too slow', 'A drew a piece']);
});

test('the square decided: the pieces left in the pile drop into place one after another, then the cuts fade and the whole picture shows, inside the move\'s time; before that the whole picture is never in the page', () => {
  const m0 = fixed('XXXXC.O..', 5, 'X'), w = play(m0, 'X', { c: 5 }), T = R.jigTimes(w.flash.jig);
  assert.doesNotMatch(screen(m0), /jgwhole/, 'one piece from the end: still only the pieces in place');
  assert.equal(uses(screen(m0)), 7);
  const html = screen(w.mini, w.flash);
  assert.equal((html.match(/class="jgpw fill"/g) || []).length, 2, 'the two pieces left drop in');
  assert.match(html, new RegExp(`class="jgpw fill" style="--t:${T.fill}ms"`)); assert.match(html, new RegExp(`class="jgpw fill" style="--t:${T.fill + R.JIG.fill}ms"`));
  assert.match(html, new RegExp(`<svg class="jgwhole late" viewBox="0 0 300 300" style="--t:${T.whole}ms;--d:${R.JIG.whole}ms"`));
  assert.ok(T.whole >= T.fill + 2 * R.JIG.fill && R.flashMs(w.flash) >= T.whole + R.JIG.whole, 'all inside the move');
  assert.doesNotMatch(html, /Won by|claim|stamp/i, 'no claim in the game: the board\'s');
  // looked at again once it is won: the whole picture, who laid which piece, no tray
  const look = screen(w.mini, null, { view: true });
  assert.match(look, /<svg class="jgwhole" viewBox="0 0 300 300" aria-hidden="true">/); assert.equal(uses(look), 1, 'the picture once, no piece under it');
  assert.equal((look.match(/class="jgby X"/g) || []).length, 5); assert.equal((look.match(/class="jgby O"/g) || []).length, 1);
  assert.doesNotMatch(look, /jgtray|jgdraw|jig-cell/);
  // a square only looked at before it is decided: the board as it stands
  assert.doesNotMatch(screen(m0, null, { view: true }), /jgwhole/);
});

test('a replay shows the committed steps alone: Draw a piece pressed, then the placement from the move', () => {
  const m = E.newMini('jigsaw', E.makeRng('jgr'));
  const list = (move, log) => { state.squares = Array.from({ length: 9 }, () => ({ owner: null, mini: m })); RP.repStart({ sq: 4, by: 'O', type: 'jigsaw', mini: m, move, list: log, onMove: () => {} }); const l = RP.rep ? RP.rep.list.map(e => [e[1], e[2]]) : []; RP.repStop(); return l; };
  assert.deepEqual(list('draw', [[0, 'jig-draw', null]]), [['jig-draw', null]]);
  assert.deepEqual(list({ c: 3 }, [[0, 'jig-cell', 'c=1'], [300, 'jig-cell', 'c=3']]), [], 'the piece travels from the move: nothing is pressed');
  assert.deepEqual(list('out', []), []);
});

test('the miniature: the board cut as the puzzle is, a piece tinted by whoever laid it, each player\'s pieces as pips; never the picture', () => {
  const m = fixed('XO..C..X.', null), html = V.miniature(m, false);
  assert.equal((html.match(/class="tjgp X"/g) || []).length, 2); assert.equal((html.match(/class="tjgp O"/g) || []).length, 1); assert.equal((html.match(/class="tjgp N"/g) || []).length, 1); assert.equal((html.match(/class="tjgs"/g) || []).length, 5);
  assert.doesNotMatch(html, /<use|jgs\d/); assert.match(html, /aria-label="Puzzle Build: X 2, O 1 of 5 pieces to win"/);
  assert.equal(html, V.miniature(Object.assign(clone(m), { offer: 3, by: 'X' }), false), 'the piece on show changes nothing in it');
});

test('a seed that is not a number never reaches the markup', () => {
  const m = fixed('....C....', 3, 'X'); m.seed = '"><img src=x onerror=alert(1)>';
  const html = screen(m) + V.miniature(m, false);
  assert.doesNotMatch(html, /onerror|<img/); assert.match(html, /<g id="jgs0">/);
});
