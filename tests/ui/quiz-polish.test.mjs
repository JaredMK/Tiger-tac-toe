// The pick-an-answer games' polish (Trivia, Patterns, Odd One Out; ui/quiz.js): the controls are the ones they always
// were (Reveal, then one tap on an answer, an option or a tile: the same buttons, in the same order, sending the same
// move); a pick is pressed in at once and its verdict lands QUIZ.beat later (a tick or a cross over its letter); a right
// one's point flies from the pick to the scorer's pip, which fills as it lands; Patterns' right picture flies into the
// gap; a wrong pick never marks the right answer; the sounds and the buzz come from the move, at those moments.
// Rendered in Node with the browser's names stubbed (motion allowed: matchMedia says no reduced motion).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : k === 'matchMedia' ? () => ({ matches: false }) : k === 'getItem' ? () => null : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const { state, REDUCED } = await import('../../src/ui/app.js');
const { renderMini } = await import('../../src/ui/mini.js');
const { GAMES } = await import('../../src/games/index.js');
const { moveSounds } = await import('../../src/audio/sound.js');
const { movePlan } = await import('../../src/ui/haptics.js');
const { QUIZ } = await import('../../src/ui/quiz.js');
const VT = await import('../../src/games/trivia/view.js');
const VP = await import('../../src/games/patterns/view.js');
const VO = await import('../../src/games/oddone/view.js');
GAMES.trivia.view = VT; GAMES.patterns.view = VP; GAMES.oddone.view = VO;   // (the page registers the views in main.js; here by hand)
E.setTriviaBank({ questions: Array.from({ length: 30 }, (_, i) => ({ id: 'q' + i, cat: 'Science', q: `Question ${i}?`, a: 'Right ' + i, wrong: ['Wrong a' + i, 'Wrong b' + i, 'Wrong c' + i] })) });

function match(type) {
  Object.assign(state, E.newMatch(E.makeRng('quiz-' + type), { games: [type], vs: 'cpu' }), { screen: 'mini', zoom: 0, cpu: 'O', sc: null, flash: null, done: null, spot: null, winner: null, online: null, turn: 'X', lock: null });
  state.setup.vs = 'cpu'; state.setup.names = { X: 'Xena', O: 'Computer' };
  return state.squares[0].mini;
}
const acts = html => [...html.matchAll(/<button class="([^"]*)"[^>]*? data-act="(move|trivia-reveal|odd-reveal)"(?: data-m='(\d+)')?/g)].map(m => [m[2], m[3] == null ? null : Number(m[3])]);
const names = f => moveSounds(f).map(s => [s[0], s[1]]);
const wrongOf = (answer, n = 4) => Array.from({ length: n }, (_, k) => k).find(k => k !== answer);

test('motion is on here', () => { assert.equal(REDUCED, false); assert.equal(QUIZ.beat, 250); });

test('Trivia: the same controls (Reveal, then four answers in order); the answers to tap carry the mover\'s colour', () => {
  const m = match('trivia');
  let html = renderMini(state.squares[0]);
  assert.deepEqual(acts(html), [['trivia-reveal', null]], 'face down: Reveal alone');
  assert.match(html, /<button class="big X" data-act="trivia-reveal">Reveal<\/button>/, 'the same button, in the mover\'s colour');
  assert.ok(!html.includes(m.ask.q), 'the question stays face down');
  assert.equal(E.triviaReveal(state, 0, 'X').ok, true);
  html = renderMini(state.squares[0]);
  assert.deepEqual(acts(html), [['move', 0], ['move', 1], ['move', 2], ['move', 3]], 'four answers, the same moves in the same order');
  assert.equal((html.match(/<button class="topt" data-act="move"/g) || []).length, 4);
  assert.match(html, /class="g-arc g-quiz qX"/, 'this phone\'s pick to make: the letters in X\'s colour');
  assert.match(html, /class="tqcard tqface[^"]*"><small>Science<\/small><p>Question \d+\?<\/p>/, 'the card: its category, its question');
  assert.doesNotMatch(html, /topt right|qmk ok/, 'the right answer is not marked');
});

test('Trivia: a right pick is pressed in, then ticked; its point flies to the pip, which fills as it lands; tap, ding and pop from the move', () => {
  const m = match('trivia'); E.triviaReveal(state, 0, 'X');
  const k = m.answer;
  assert.equal(E.playMove(state, 0, k, E.makeRng('a')).ok, true);
  const html = renderMini(state.squares[0]);
  assert.match(html, new RegExp(`<button class="topt right late" style="--t:250ms" data-act="move" data-m='${k}' disabled[^>]*><b data-anchor="qpick">[A-D]<i class="qmk ok appear">`), 'pressed in until 250 ms, then the tick; the point flies from its letter');
  assert.match(html, /<i class="on fillin" style="--t:550ms;--k:0"><b class="qtok" data-cf="qpick" data-cfat="250" data-cfgo="" data-cfd="300"><\/b><\/i>/, 'the point lands on the pip at 550 ms');
  assert.doesNotMatch(html, /g-quiz q[XO]/, 'no answer left to tap: the letters go plain');
  assert.match(html, /class="arcres ok appear" style="--t:250ms"[^>]*>Right!</);
  assert.deepEqual(names(state.flash), [['tap', 0], ['ding', 250], ['pop', 550]]);
  assert.deepEqual(movePlan(state.flash, moveSounds(state.flash)), [['tap', 0], ['medium', 250]], 'a light tap, then the result\'s buzz with the ding');
  assert.equal(E.playMs(state.flash), E.TRIVIA.flip + E.TRIVIA.pause + E.TRIVIA.reveal, 'the playback another phone sees: the card turned up (it was turned up in this turn), a pause, the pick');
});

test('Trivia: a wrong pick shakes under a cross and is struck; the right answer is never marked; no point', () => {
  const m = match('trivia'); E.triviaReveal(state, 0, 'X');
  const k = wrongOf(m.answer);
  assert.equal(E.playMove(state, 0, k, E.makeRng('a')).ok, true);
  const html = renderMini(state.squares[0]);
  assert.match(html, new RegExp(`<button class="topt wrong out fresh late" style="--t:250ms" data-act="move" data-m='${k}' disabled[^>]*><b>[A-D]<i class="qmk no appear">`));
  assert.doesNotMatch(html, /topt right|qmk ok|qtok|data-anchor="qpick"/, 'nothing of the right answer, nothing flies');
  assert.deepEqual(names(state.flash), [['tap', 0], ['thud', 250]]);
  E.endFlash(state); state.done = null; state.turn = 'X';
  const h2 = renderMini(state.squares[0]);
  assert.match(h2, new RegExp(`<button class="topt out" data-act="move" data-m='${k}' disabled[^>]*><b>[A-D]<i class="qmk no">`), 'crossed out from now on, its cross kept');
  assert.equal((h2.match(/<button class="topt" data-act="move"/g) || []).length, 3, 'three left to tap');
});

test('Trivia: the computer\'s turn replays as its screen did: the card turns up, the answers are dealt, its tap, the verdict', () => {
  const m = match('trivia'); state.turn = 'O';
  const q = m.ask.q;
  assert.equal(E.triviaReveal(state, 0, 'O').ok, true);
  assert.equal(E.playMove(state, 0, m.answer, E.makeRng('a')).ok, true);
  const html = renderMini(state.squares[0]), pre = VT.triviaPre(state.flash);
  assert.equal(pre, E.TRIVIA.flip + E.TRIVIA.pause);
  assert.match(html, /<div class="tqstack tqflip" style="--f0:150ms"><div class="tqcard tqface/, 'the card turns up');
  assert.match(html, /<div class="topts deal" style="--f0:150ms">/, 'the answers are dealt in under it');
  assert.ok(html.includes(q));
  assert.match(html, new RegExp(`class="topt right late" style="--t:${pre + 250}ms"`), 'their pick, when it comes');
  assert.deepEqual(names(state.flash), [['reveal', 150], ['tap', pre], ['ding', pre + 250], ['pop', pre + 550]]);
  assert.deepEqual(movePlan(state.flash, moveSounds(state.flash)).length > 0, true);
});

test('Patterns: the same controls (four options in order); a right pick\'s picture flies into the gap and the sequence waves; its point flies to the pip', () => {
  const m = match('patterns');
  let html = renderMini(state.squares[0]);
  assert.deepEqual(acts(html), [['move', 0], ['move', 1], ['move', 2], ['move', 3]]);
  assert.equal((html.match(/<button class="popt" data-act="move"/g) || []).length, 4);
  assert.match(html, /class="g-arc g-quiz qX"/); assert.match(html, /<span class="patit gap"><b>\?<\/b><\/span>/);
  const k = m.answer;
  assert.equal(E.playMove(state, 0, k, E.makeRng('a')).ok, true);
  html = renderMini(state.squares[0]);
  assert.match(html, new RegExp(`<button class="popt right late" style="--t:250ms" data-act="move" data-m='${k}' disabled[^>]*><b data-anchor="qpick">[A-D]<i class="qmk ok appear">.*?</i></b><svg viewBox="0 0 100 100" aria-hidden="true" data-anchor="ppick">`), 'the pick: ticked; its letter and its picture are where the point and the copy fly from');
  assert.match(html, /<div class="pseq wave" style="--n:\d+;--w:610ms"/);
  assert.match(html, /<span class="patit gap filled late" style="--k:\d+;--t:550ms"><b class="tu" style="--u:550ms">\?<\/b><span class="pfly" data-cf="ppick" data-cfat="250" data-cfd="300">/, 'the gap keeps its ? until the picture lands in it');
  assert.match(html, /<i class="on fillin" style="--t:550ms;--k:0"><b class="qtok" data-cf="qpick" data-cfat="250"/);
  assert.deepEqual(names(state.flash), [['tap', 0], ['ding', 250], ['pop', 550]]);
  assert.equal(E.playMs(state.flash), E.PATTERNS.reveal);
  assert.ok(E.PATTERNS.reveal >= 250 + 300 + 60 + 7 * 32 + 340 - 150, 'the wave is all but over as the move ends');
});

test('Patterns: a wrong pick shakes under a cross and is struck; the right option is never marked; the computer\'s pick is named', () => {
  const m = match('patterns');
  const k = wrongOf(m.answer);
  assert.equal(E.playMove(state, 0, k, E.makeRng('a')).ok, true);
  let html = renderMini(state.squares[0]);
  assert.match(html, new RegExp(`<button class="popt wrong out fresh late" style="--t:250ms" data-act="move" data-m='${k}' disabled[^>]*><b>[A-D]<i class="qmk no appear">`));
  assert.doesNotMatch(html, /popt right|qmk ok|qtok|pfly|pseq wave|patit gap filled/);
  assert.match(html, />Wrong: crossed out</);
  assert.deepEqual(names(state.flash), [['tap', 0], ['thud', 250]]);
  E.endFlash(state); state.done = null; state.flash = null; state.turn = 'O';
  assert.equal(E.playMove(state, 0, m.answer, E.makeRng('b')).ok, true);
  html = renderMini(state.squares[0]);
  assert.match(html, /<b class="O">.*?Computer<\/b> got it right</, 'someone else\'s pick: the line names them');
});

test('Odd One Out: the same controls (Reveal, then one tile); found: the tile ringed under a tick, its point to the pip; missed: a cross on the pick, the odd tile ringed', () => {
  let m = match('oddone');
  let html = renderMini(state.squares[0]);
  const n = m.grid.X.n * m.grid.X.n;
  assert.deepEqual(acts(html).map(a => a[0]), Array(n).fill('move').concat(['odd-reveal']), 'the tiles, then Reveal under them');
  assert.deepEqual(acts(html).slice(0, n).map(a => a[1]), Array.from({ length: n }, (_, k) => k));
  assert.match(html, /<button class="big X" data-act="odd-reveal">Reveal<\/button>/);
  assert.equal((html.match(/<button class="otile"[^>]*disabled/g) || []).length, n, 'no tile to tap before Reveal');
  const pos = m.pos.X;
  assert.equal(E.playMove(state, 0, pos, E.makeRng('a')).ok, true);
  html = renderMini(state.squares[0]);
  assert.match(html, new RegExp(`<button class="otile odd found picked" style="[^"]*--t:250ms;--p:0ms" data-act="move" data-m='${pos}'[^>]* disabled data-anchor="qpick"><i class="qmk ok appear">`));
  assert.match(html, /<i class="on fillin" style="--t:550ms;--k:0"><b class="qtok" data-cf="qpick" data-cfat="250"/);
  assert.deepEqual(names(state.flash), [['tap', 0], ['ding', 250], ['pop', 550]]);
  m = match('oddone');
  const miss = (m.pos.X + 1) % n;
  assert.equal(E.playMove(state, 0, miss, E.makeRng('a')).ok, true);
  html = renderMini(state.squares[0]);
  assert.match(html, new RegExp(`<button class="otile wrong picked" [^>]*data-m='${miss}'[^>]*><i class="qmk no appear">`));
  assert.match(html, new RegExp(`<button class="otile odd" [^>]*data-m='${m.last.pos}'`), 'the odd tile, ringed');
  assert.doesNotMatch(html, /qtok|qmk ok|data-anchor="qpick"/);
  assert.deepEqual(names(state.flash), [['tap', 0], ['thud', 250]]);
  assert.equal(E.playMs(state.flash), E.ODD.show + E.ODD.pause + E.ODD.reveal, 'the playback another phone sees: their reveal, a pause, the pick');
});

test('the square won: the pips hop in a wave as the point lands, and the chime comes with it on the mover\'s own phone too (wonAt)', () => {
  let m = match('trivia'); E.triviaReveal(state, 0, 'X'); m.right.X = 2;
  assert.equal(E.playMove(state, 0, m.answer, E.makeRng('a')).ok, true);
  assert.equal(state.flash.kind, 'claim');
  let html = renderMini(state.squares[0]);
  assert.match(html, /<span class="pips qpips qwon" aria-label="3 of 3" style="--w:810ms">/, 'the winner\'s pips hop once the point has landed');
  assert.deepEqual(names(state.flash), [['tap', 0], ['ding', 250], ['pop', 550], ['won', E.TRIVIA.reveal]], 'the chime as this phone\'s own pick ends, not a reveal and a pause later');
  m = match('trivia'); state.turn = 'O'; E.triviaReveal(state, 0, 'O'); m.right.O = 2;
  assert.equal(E.playMove(state, 0, m.answer, E.makeRng('a')).ok, true);
  const pre = VT.triviaPre(state.flash);
  assert.deepEqual(names(state.flash).pop(), ['won', pre + E.TRIVIA.reveal], 'the computer\'s: after its reveal and its pause, as before');
  m = match('oddone'); m.finds.X = 2;
  assert.equal(E.playMove(state, 0, m.pos.X, E.makeRng('a')).ok, true);
  assert.deepEqual(names(state.flash), [['tap', 0], ['ding', 250], ['pop', 550], ['won', E.ODD.reveal]]);
  m = match('patterns'); m.right.X = 2;
  assert.equal(E.playMove(state, 0, m.answer, E.makeRng('a')).ok, true);
  assert.deepEqual(names(state.flash), [['tap', 0], ['ding', 250], ['pop', 550], ['won', E.PATTERNS.reveal]]);
});
