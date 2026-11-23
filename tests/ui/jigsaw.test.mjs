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
const E = require('../engine.js'); E.setTune('jigsaw', { centre: 'on' });   // (these views were written for the 3 by 3 with its centre piece in place: the setting's other value, the default being off)
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

// ---- the two options (both off by default) ----
const withTune = (t, fn) => { E.setTune('jigsaw', Object.assign({ centre: 'on' }, t)); try { return fn(); } finally { E.setTune('jigsaw', { centre: 'on' }); } };
const piecesOf = html => html.match(/<svg class="jgp"[\s\S]*?<\/svg>/g) || [];
// The square as a real match on this phone (so its own controls go through the page's own flow: attemptMove, playMove).
async function liveMatch(mini, turn = 'X') {
  Object.assign(state, E.newMatch(E.makeRng('jg-live'), { games: ['ttt', 'jigsaw'] }));
  state.squares[0] = { owner: null, mini }; state.zoom = 0; state.screen = 'mini'; state.online = null; state.cpu = null; state.turn = turn; state.flash = null; state.done = null; state.lock = 0; state.spot = null;
}
const own = (turn = 'X') => { const sq = state.squares[0]; return V.screen(sq, state.flash, null, sq.mini, false, !!state.flash, state.flash, null, false, () => -1, false, turn, ''); };

test('with both options off nothing of them is in the page: no flat sides, no turned piece, no Rotate', () => {
  const d = play(E.newMini('jigsaw', E.makeRng('off')), 'X', 'draw', E.makeRng('jgv-d'));
  for (const html of [screen(d.mini, d.flash), screen(d.mini, null), screen(d.mini, null, { locked: true })]) assert.doesNotMatch(html, /jgeg|jgek|jgflag|jgrt|jgq|jgrot|jgstage rot/);
});

test('Flat edge pieces: every piece is drawn with its sides on the picture\'s border cut straight, wherever it is drawn (the tray, in place, flying in, dropping in at the end, turned, the miniature); off, the classic cut', () => {
  const sdOf = m => Math.abs(Math.floor(Number(m.seed))), outlines = html => [...html.matchAll(/<path class="jgpo" d="([^"]+)"/g)].map(t => t[1]);
  const cutOf = (m, flat) => Array.from({ length: 9 }, (_, i) => P.jigPiecePath(sdOf(m), 3, i, flat));
  const check = (html, m, flat, what) => { const want = new Set(cutOf(m, flat)), other = new Set(cutOf(m, !flat)); const os = outlines(html); assert.ok(os.length > 0, what); for (const d of os) { assert.ok(want.has(d), `${what}: ${flat ? 'flat' : 'classic'} cut`); if (d !== P.jigPiecePath(sdOf(m), 3, 4)) assert.ok(!other.has(d), what); } };
  // off: the classic cut, nothing else of the option in the page
  const m0 = fixed('X...C...O', 1, 'O');
  check(screen(m0, null, { turn: 'O' }), m0, false, 'off');
  withTune({ edges: 'on' }, () => {
    const m = fixed('X...C...O', 1, 'O'), html = screen(m, null, { turn: 'O' }), ps = piecesOf(html);
    assert.equal(ps.length, 4, 'the three in place and the one on show');
    check(html, m, true, 'the tray and the board');
    assert.doesNotMatch(html, /jgeg|jgek|jgflag/, 'the flat side is the tell: no stripe, no flag');
    // the clip and the outline are one shape, so the picture is cut straight too
    for (const p of ps) { const clip = p.match(/<clipPath id="[^"]+"><path d="([^"]+)"/)[1]; assert.ok(p.includes(`class="jgpo" d="${clip}"`)); }
    // a placement's flight and the pile's pieces dropping in at the end
    const w = play(fixed('XXXXC.O..', 5, 'X'), 'X', { c: 5 });
    check(screen(w.mini, w.flash), w.mini, true, 'the end');
    assert.equal(outlines(screen(w.mini, w.flash)).length, 9, 'every piece drops in flat-sided');
    // the miniature's board is cut the same way
    const mini = V.miniature(m, false), laid = [...mini.matchAll(/class="tjgp [^"]+" d="([^"]+)"/g)].map(t => t[1]);
    assert.deepEqual(laid, [0, 4, 8].map(i => P.jigPiecePath(sdOf(m), 3, i, true)));
  });
  // turned (`rotate` on): the same flat-sided piece, turned as a whole, so its flat side turns with it
  withTune({ edges: 'on', rotate: 'on' }, () => {
    const d = play(E.newMini('jigsaw', E.makeRng('jgr1')), 'X', 'draw', E.makeRng('jgr-d')), html = screen(d.mini, d.flash);
    assert.match(html, /class="jgrt" style="--jr:[123]"/);
    check(html, d.mini, true, 'a turned piece');
  });
});

test('Pieces drawn rotated: the piece comes out turned as it was drawn; on this phone\'s turn Rotate (or a tap on the piece) turns it a quarter turn clockwise on this phone alone, and the placement carries how it was left: right way up, it fits', async () => withTune({ rotate: 'on' }, async () => {
  const m0 = E.newMini('jigsaw', E.makeRng('jgr1')), d = play(m0, 'X', 'draw', E.makeRng('jgr-d')), rot = d.mini.rot;
  assert.ok([1, 2, 3].includes(rot));
  let html = screen(d.mini, d.flash);
  assert.match(html, new RegExp(`data-cf="jgpile" data-cfat="0" data-cfd="420"><span class="jgrt" style="--jr:${rot}">`), 'it slides out of the pile turned');
  assert.match(html, /<div class="jgstage rot">/); assert.match(html, /<button class="jgrot off" data-act="jig-rot" aria-label="Rotate the piece" disabled>/, 'nothing to turn while it comes out');
  // someone else's piece on show: as it was drawn, and no Rotate here
  html = screen(d.mini, null, { locked: true });
  assert.match(html, new RegExp(`<span class="jgrt" style="--jr:${rot}">`)); assert.match(html, /jgrot off/);
  // this phone's own: Rotate live; each press a quarter turn, written on the page (the next drawing shows the draft)
  await liveMatch(d.mini);
  html = own();
  assert.match(html, /<button class="jgrot" data-act="jig-rot" aria-label="Rotate the piece">/);
  assert.match(html, new RegExp(`class="jgslot live"><i class="jgbx" data-anchor="jgoffer"></i><span class="jgpw"><span class="jgfl"><span class="jgrt" style="--jr:${rot}">`));
  for (let k = 1; k <= 4; k++) { V.actions['jig-rot'](); assert.match(own(), new RegExp(`<span class="jgrt" style="--jr:${(rot + k) % 4}">`), `after ${k} presses`); }
  assert.equal(d.mini.rot, rot, 'the square is untouched: the turn is this phone\'s draft');
  while (!own().includes('--jr:0"')) V.actions['jig-rot']();
  V.actions['jig-cell']({ dataset: { c: String(d.mini.offer) } });
  const sq = state.squares[0].mini;
  assert.deepEqual([sq.last.at, sq.last.r, sq.last.rot, sq.last.ok, state.flash.note], [sq.last.c, 0, rot, true, 'fits'], 'placed upright in its own cell: it fits');
  // this phone's own placement goes at once: no turning first, the flight from the move's start
  html = own();
  assert.doesNotMatch(html, /jgpw turn|class="jgq"/); assert.match(html, /<span class="jgpw ok" style="--t:360ms"><span class="jgfl"(?: data-cf="jgoffer" data-cfat="0" data-cfd="360")?>/);
  const heard = []; V.sounds(state.flash, (n, at) => heard.push([n, at])); assert.deepEqual(heard.filter(([n]) => n === 'jgTurn'), [], 'no turning to hear');
  const pre = R.jigTimes(state.flash.jig).pre;
  assert.equal(pre, ((4 - rot) % 4) * R.JIG.turn, 'the move\'s time keeps the other phone\'s turning');
  assert.equal(V.hold(state.flash), Math.max(0, 600 - pre), 'and this phone\'s hold gives it back');
}));

test('Pieces drawn rotated: someone else\'s placement first turns their piece on the tray from how it was drawn to how they placed it, a quarter at a time with a click each, then it travels; their own cell turned wrong lands turned, shakes and goes back: "Turn it"', () => withTune({ rotate: 'on' }, () => {
  const at = (rot, by) => { const m = fixed('....C....', 3, by || 'X'); m.rot = rot; return m; };
  const ok = play(at(1), 'X', { c: 3, r: 0 }), T = R.jigTimes(ok.flash.jig);
  assert.deepEqual([ok.flash.jig.rot, ok.flash.jig.r, T.pre], [1, 0, 3 * R.JIG.turn]);
  let html = screen(ok.mini, ok.flash);
  assert.match(html, new RegExp(`<span class="jgpw turn" style="--b:${T.pre}ms"><span class="jgfl"><span class="jgrt" style="--jr:1"><span class="jgq" style="--t:0ms"><span class="jgq" style="--t:190ms"><span class="jgq" style="--t:380ms"><svg class="jgp"`), 'three quarter turns from a quarter turn: upright');
  assert.match(html, new RegExp(`<span class="jgpw ok" style="--t:${T.land}ms"><span class="jgfl" data-cf="jgoffer" data-cfat="${T.pre}" data-cfd="360">`), 'then it travels, upright');
  assert.match(html, new RegExp(`<p class="jgline ok appear" style="--t:${T.land}ms" role="status">Fits!</p>`));
  const heard = []; V.sounds(ok.flash, (n, t) => heard.push([n, t]));
  assert.deepEqual(heard.slice(0, 5), [['jgTurn', 0], ['jgTurn', 190], ['jgTurn', 380], ['jgSlide', T.pre], ['jgSnap', T.land]], 'a click a quarter turn, then the slide and the click in');
  assert.ok(R.flashMs(ok.flash) >= T.land + R.JIG.snap, 'all inside the move'); assert.equal(V.hold(ok.flash), null, 'the usual hold after it');
  // left as it was drawn: nothing to turn, it travels at once
  const left = play(at(2), 'X', { c: 3, r: 2 });
  assert.equal(R.jigTimes(left.flash.jig).pre, 0); assert.doesNotMatch(screen(left.mini, left.flash), /jgpw turn/);
  // its own cell, turned the wrong way: it lands turned, shakes, goes back; the line says why
  const no = play(at(3, 'O'), 'O', { c: 3, r: 1 }), U = R.jigTimes(no.flash.jig);
  assert.equal(no.flash.note, 'turn'); assert.equal(U.pre, 2 * R.JIG.turn);
  html = screen(no.mini, no.flash, { turn: 'O' });
  assert.match(html, new RegExp(`data-anchor="jgcell:3"></i><span class="jgpw no" style="--t:${U.land}ms;--b:${U.back}ms"><span class="jgfl" data-cf="jgoffer" data-cfat="${U.pre}" data-cfd="360"><span class="jgrt" style="--jr:1">`), 'to its own cell, turned');
  assert.match(html, new RegExp(`<span class="jgpw home"><span class="jgfl" data-cf="jgcell:3" data-cfat="${U.back}" data-cfgo="" data-cfd="380"><span class="jgrt" style="--jr:1">`), 'and back to the pile as it was');
  assert.match(html, />Turn it<\/p>/); assert.doesNotMatch(html, /jgcell on by/, 'nothing laid');
  assert.equal(V.moveText(no.flash, 'A'), 'A had the piece turned wrong');
  // its result held once the move has played (the square's own last move): the same words
  assert.match(V.screen({ owner: null, mini: no.mini }, null, { kind: 'move' }, no.mini, false, true, null, null, false, () => -1, false, 'O', ''), /<p class="jgline askew">Turn it<\/p>/);
  // out of time: it wobbles on the tray as it was drawn, and goes back
  const out = play(at(2), 'X', 'out');
  assert.match(screen(out.mini, out.flash), /<span class="jgpw slow" style="--b:\d+ms"><span class="jgfl"><span class="jgrt" style="--jr:2">/);
  // a replay presses nothing for a placement, turned or not: it plays from the move
  assert.deepEqual(V.replay.synth({ c: 3, r: 0 }), []); assert.deepEqual(V.replay.synth('draw'), [[0, 'jig-draw', null]]);
}));
