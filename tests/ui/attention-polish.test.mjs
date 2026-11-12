// The attention games' polish (Headcount, Flash, Snapshot; ui/attention.js): the controls are the ones they always were
// (Start; then Headcount's number pad and OK, Flash's four options, Snapshot's cells and Submit: the same buttons, in the
// same order, sending the same move); nothing of a round is on the page before Start; an answer is pressed in at once
// and its verdict lands QUIZ.beat later (the tick or the cross, the result's words, the ding or the thud); a right one's
// point flies from the answer to the scorer's pip; someone else's round plays first, then their answer goes in as they
// put it in (the digits typed, the option pressed, the cells picked), then the verdict; the square's chime comes with the
// winning point on the mover's own phone too. Rendered in Node with the browser's names stubbed (motion allowed).
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
const { animMs } = await import('../../src/ui/fx.js');
const { QUIZ } = await import('../../src/ui/quiz.js');
const { ATT_T, attCellAt, attPre } = await import('../../src/ui/attention.js');
const VIEWS = { headcount: await import('../../src/games/headcount/view.js'), flash: await import('../../src/games/flash/view.js'), snapshot: await import('../../src/games/snapshot/view.js') };
for (const t of E.ATT_TYPES) GAMES[t].view = VIEWS[t];   // (the page registers the views in main.js; here by hand)

function match(type, turn = 'X') {
  Object.assign(state, E.newMatch(E.makeRng('att-' + type), { games: [type], vs: 'cpu' }), { screen: 'mini', zoom: 0, cpu: 'O', sc: null, flash: null, done: null, spot: null, winner: null, online: null, turn, lock: null });
  state.setup.vs = 'cpu'; state.setup.names = { X: 'Xena', O: 'Computer' };
  return state.squares[0].mini;
}
const acts = html => [...html.slice(html.indexOf('class="gwrap"')).matchAll(/<button class="[^"]*"(?: style="[^"]*")? data-act="([a-z-]+)"(?: data-(?:k|i|m)='?"?([^'" ]*)"?'?)?[^>]*?( disabled)?>/g)].map(m => [m[1], m[2] == null ? null : m[2], !m[3]]);
const names = f => moveSounds(f).map(s => [s[0], s[1]]);
const BEAT = QUIZ.beat;

test('motion is on here; someone else\'s answer goes in inside the pause before its verdict', () => {
  assert.equal(REDUCED, false); assert.equal(BEAT, 250);
  assert.ok(ATT_T.send < E.ATT.pause && ATT_T.pick < E.ATT.pause && ATT_T.type + ATT_T.step < ATT_T.send && ATT_T.cells + ATT_T.cellSpan < ATT_T.send);
  for (const n of [1, 2, 7, 12, 30]) for (let i = 0; i < n; i++) assert.ok(attCellAt(i, n) >= ATT_T.cells && attCellAt(i, n) <= ATT_T.cells + ATT_T.cellSpan, 'every cell picked before Submit');
});

test('before Start: Start alone, in the mover\'s colour; nothing of the round on the page', () => {
  for (const type of E.ATT_TYPES) {
    const m = match(type), html = renderMini(state.squares[0]);
    assert.deepEqual(acts(html).filter(a => a[2]), [['att-start', null, true]], `${type}: Start is the one control`);
    assert.match(html, /<button class="big X" data-act="att-start">Start<\/button>/, 'the same button, in the mover\'s colour');
    assert.match(html, new RegExp(`class="att att-${type} pc-X ph-ready"`));
    assert.match(html, />Level 1 of 3/);
    if (type === 'headcount') { assert.doesNotMatch(html, /class="hcr /, 'no creature before Start'); assert.match(html, /class="hcturf"/, 'the meadow'); }
    if (type === 'flash') { assert.doesNotMatch(html, /class="fit"/, 'no card before Start'); assert.ok(!html.includes(m.round.X.q.text), 'nor the question'); assert.match(html, /<div class="flback"><span><svg/, 'the card, face down'); }
    if (type === 'snapshot') assert.doesNotMatch(html, /class="snc (on|sel)/, 'no cell filled before Start');
    state.turn = 'O';
    assert.match(renderMini(state.squares[0]), new RegExp(`class="att att-${type} pc-O ph-idle"`), 'the other side\'s turn: its colour, nothing to press');
    assert.deepEqual(acts(renderMini(state.squares[0])).filter(a => a[2]), []);
  }
});

test('Headcount: this phone\'s answer: the same pad; OK pressed in, then the display ticked and the point flies from it; wrong: struck, the right count beside it', () => {
  let m = match('headcount');
  const truth = E.attTruth('headcount', m.round.X);
  assert.equal(E.playMove(state, 0, truth, E.makeRng('a')).ok, true);
  let html = renderMini(state.squares[0]);
  assert.deepEqual(acts(html).map(a => a[1]), ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'], 'the pad: the same keys in the same order');
  assert.ok(acts(html).every(a => a[0] === 'hc-key' && !a[2]), 'none to press while the result shows');
  assert.match(html, new RegExp(`<div class="hcdisp ok late" style="--t:${BEAT}ms" data-anchor="qpick" aria-label="Your answer"><span class="hcans">${String(truth).split('').map(d => `<b>${d}</b>`).join('')}</span><span class="hcmk"><i class="qmk ok appear">`));
  assert.match(html, /<button class="hckey ok hit" style="--t:0ms" data-act="hc-key" data-k="ok"/, 'OK goes down at once');
  assert.match(html, new RegExp(`<i class="on fillin" style="--t:${BEAT + QUIZ.fly}ms;--k:0"><b class="qtok" data-cf="qpick" data-cfat="${BEAT}"`), 'the point lands on the pip');
  assert.match(html, new RegExp(`class="arcres ok appear" style="--t:${BEAT}ms"[^>]*><span class="atr">Right!</span> <span class="atr">${truth} `));
  assert.deepEqual(names(state.flash), [['tap', 0], ['ding', BEAT], ['pop', BEAT + QUIZ.fly]]);
  assert.deepEqual(movePlan(state.flash, moveSounds(state.flash)), [['tap', 0], ['medium', BEAT]], 'a light tap, then the result\'s buzz with the ding');
  assert.equal(animMs(state.flash), E.ATT.show, 'this phone skips the round it has just played');
  m = match('headcount');
  const t2 = E.attTruth('headcount', m.round.X);
  assert.equal(E.playMove(state, 0, t2 + 1, E.makeRng('a')).ok, true);
  html = renderMini(state.squares[0]);
  assert.match(html, new RegExp(`<div class="hcdisp no late" style="--t:${BEAT}ms" aria-label="Your answer"><span class="hcans no">.*?</span><span class="hcmk"><i class="qmk no appear">.*?</i></span><span class="hctruth appear" style="--t:${BEAT + 160}ms">${t2}</span>`));
  assert.doesNotMatch(html, /qtok|data-anchor="qpick"/, 'nothing flies');
  assert.match(html, /class="arcres no appear"[^>]*><span class="atr">Not quite ·<\/span> <span class="atr">it was /);
  assert.deepEqual(names(state.flash), [['tap', 0], ['thud', BEAT]]);
});

test('Flash: this phone\'s pick is pressed in, then ticked on the option and on the card; a wrong one is crossed and the right one lights up', () => {
  let m = match('flash');
  const r = m.round.X, k = r.ans;
  assert.equal(E.playMove(state, 0, k, E.makeRng('a')).ok, true);
  let html = renderMini(state.squares[0]);
  assert.deepEqual(acts(html).map(a => [a[0], a[1]]), [['move', '0'], ['move', '1'], ['move', '2'], ['move', '3']], 'four options, the same moves in the same order');
  assert.match(html, new RegExp(`<button class="flopt right pick late" style="--t:${BEAT}ms" data-act="move" data-m='${k}' aria-label="[^"]*" disabled data-anchor="qpick">.*?<i class="qmk ok appear">`));
  assert.equal((html.match(/<button class="flopt off late"/g) || []).length, 3, 'the others fade back with the verdict, not before');
  assert.match(html, new RegExp(`<span class="flver" style="--t:${BEAT}ms"><i class="qmk ok appear">`), 'the verdict on the card');
  assert.match(html, new RegExp(`<div class="flback ask tu" style="--u:${BEAT}ms">`), 'face down until it lands');
  assert.doesNotMatch(html, /class="fit"/, 'the round is not played again on the phone that played it');
  assert.deepEqual(names(state.flash), [['tap', 0], ['ding', BEAT], ['pop', BEAT + QUIZ.fly]]);
  m = match('flash');
  const r2 = m.round.X, w = (r2.ans + 1) % 4;
  assert.equal(E.playMove(state, 0, w, E.makeRng('a')).ok, true);
  html = renderMini(state.squares[0]);
  assert.match(html, new RegExp(`<button class="flopt wrong pick late" style="--t:${BEAT}ms" data-act="move" data-m='${w}'[^>]*>.*?<i class="qmk no appear">`));
  assert.match(html, new RegExp(`<button class="flopt right late" style="--t:${BEAT}ms" data-act="move" data-m='${r2.ans}'[^>]*>.*?<i class="qmk ok appear">`), 'the right answer shown');
  assert.doesNotMatch(html, /qtok|data-anchor="qpick"/);
  assert.deepEqual(names(state.flash), [['tap', 0], ['thud', BEAT]]);
});

test('Snapshot: this phone\'s cells stay as picked until the verdict; right cells pop one after the other, a wrong one is crossed, a missed one shown', () => {
  let m = match('snapshot');
  const r = m.round.X, cells = E.attTruth('snapshot', r);
  assert.equal(E.playMove(state, 0, cells, E.makeRng('a')).ok, true);
  let html = renderMini(state.squares[0]);
  assert.equal((html.match(/<button class="snc hit late sel0"/g) || []).length, cells.length);
  assert.match(html, new RegExp(`<div class="sngrid v-ok late" style="[^"]*;--t:${BEAT}ms">`));
  assert.match(html, new RegExp(`<span class="snmk" style="--t:${BEAT}ms" data-anchor="qpick"><i class="qmk ok appear">`), 'the tick on the tray\'s corner: where the point flies from');
  assert.deepEqual(names(state.flash), [['tap', 0], ['ding', BEAT], ['pop', BEAT + QUIZ.fly]]);
  m = match('snapshot');
  const r2 = m.round.X, t2 = E.attTruth('snapshot', r2), off = Array.from({ length: r2.c * r2.r }, (_, i) => i).find(i => !t2.includes(i));
  assert.equal(E.playMove(state, 0, t2.slice(1).concat(off), E.makeRng('a')).ok, true);
  html = renderMini(state.squares[0]);
  assert.equal((html.match(/<button class="snc hit late sel0"/g) || []).length, t2.length - 1);
  assert.equal((html.match(/<button class="snc miss late"/g) || []).length, 1, 'the cell that was missed');
  assert.equal((html.match(/<button class="snc extra late sel0"/g) || []).length, 1, 'the cell that was not there');
  assert.match(html, /<div class="sngrid v-no late"/); assert.match(html, /<i class="qmk no appear">/);
  assert.deepEqual(names(state.flash), [['tap', 0], ['thud', BEAT]]);
});

test('someone else\'s round plays first, then their answer goes in as they put it in, then the verdict', () => {
  for (const type of E.ATT_TYPES) {
    const m = match(type, 'O'), r = m.round.O, len = E.attMs(type, r), truth = E.attTruth(type, r);
    assert.equal(E.playMove(state, 0, truth, E.makeRng('a')).ok, true);
    const f = state.flash, pre = attPre(f), T = pre + BEAT, html = renderMini(state.squares[0]);
    assert.equal(pre, len + E.ATT.pause);
    assert.equal(animMs(f), pre + E.ATT.show);
    assert.match(html, new RegExp(`class="att att-${type} pc-O ph-res"`), 'the mover\'s colour');
    assert.match(html, new RegExp(`class="arcres ok appear" style="--t:${T}ms"[^>]*>(<span class="atr">)?<b class="O">.*?Computer</b> got it right`), 'the line names them, with the verdict');
    assert.match(html, new RegExp(`<span class="tu" style="--u:${len}ms"><i class="atph eye"`), 'the eye while their round plays');
    assert.match(html, new RegExp(`<span class="tf tu2" style="--f:${len}ms;--u:${T}ms"><i class="atph ask"`), 'then the question, until the verdict');
    assert.match(html, new RegExp(`<i class="on fillin" style="--t:${T + QUIZ.fly}ms;--k:0"><b class="qtok" data-cf="qpick" data-cfat="${T}"`));
    const snd = names(f);
    assert.deepEqual(snd.slice(-2), [['ding', T], ['pop', T + QUIZ.fly]]);
    assert.deepEqual(movePlan(f, moveSounds(f)).length > 0, true);
    if (type === 'headcount') {
      const ds = String(truth).split('');
      assert.match(html, /class="hcr /, 'the creatures cross');
      ds.forEach((d, i) => assert.ok(html.includes(`<b class="appear" style="--t:${len + ATT_T.type + i * ATT_T.step}ms">${d}</b>`), 'each digit typed in'));
      assert.match(html, new RegExp(`<button class="hckey ok hit" style="--t:${len + ATT_T.send}ms"`), 'then OK');
      assert.deepEqual(snd.slice(0, -2), [['go', 0], ...ds.map((_, i) => ['key', len + ATT_T.type + i * ATT_T.step]), ['tap', len + ATT_T.send]]);
    } else if (type === 'flash') {
      assert.equal((html.match(/class="fit"/g) || []).length, r.items.length, 'the cards flash');
      assert.match(html, new RegExp(`<button class="flopt right pick late" style="--t:${T}ms;--p:${len + ATT_T.pick}ms"`), 'their pick goes down, then its verdict');
      assert.match(html, new RegExp(`<div class="flback ask tf tu2" style="--f:${len}ms;--u:${T}ms">`));
      assert.deepEqual(snd.slice(0, -2), [['go', 0], ...r.items.map((_, i) => ['tickSoft', i * r.ms]), ['tap', len + ATT_T.pick]]);
    } else {
      assert.equal((html.match(/<button class="snc hit late pk"/g) || []).length, truth.length, 'their cells picked one after the other');
      truth.forEach((_, i) => assert.ok(html.includes(`--p:${len + attCellAt(i, truth.length)}ms`)));
      assert.match(html, new RegExp(`<div class="sncount tu" style="--u:${len}ms">`), 'the timer goes with the round');
      assert.deepEqual(snd.filter(s => s[0] === 'mark').map(s => s[1]), truth.map((_, i) => len + attCellAt(i, truth.length)));
      assert.deepEqual(snd.slice(-3)[0], ['tap', len + ATT_T.send]);
    }
  }
});

test('the winning answer: the pips hop once the point has landed, and the chime comes then on the mover\'s own phone too', () => {
  for (const type of E.ATT_TYPES) {
    const m = match(type); m.right.X = 2;
    assert.equal(E.playMove(state, 0, E.attTruth(type, m.round.X), E.makeRng('a')).ok, true);
    const f = state.flash, html = renderMini(state.squares[0]);
    assert.equal(f.kind === 'claim' || f.kind === 'match', true);
    assert.match(html, new RegExp(`<span class="pips qpips qwon" aria-label="3 of 3" style="--w:${BEAT + QUIZ.fly + 260}ms">`));
    const won = names(f).find(s => s[0] === 'won');
    assert.equal(won[1], animMs(f) - 600, `${type}: the chime inside the move as this phone plays it`);
    assert.ok(won[1] > BEAT + QUIZ.fly);
  }
});

test('a finished square, looked at later: the settled result, nothing animated', () => {
  for (const type of E.ATT_TYPES) {
    const m = match(type); m.right.X = 2;
    assert.equal(E.playMove(state, 0, E.attTruth(type, m.round.X), E.makeRng('a')).ok, true);
    E.endFlash(state); state.flash = null; state.done = null;
    const html = renderMini(state.squares[0]);
    assert.doesNotMatch(html, / late|appear|qtok|data-act="att-start"/, `${type}: settled`);
    assert.match(html, /<i class="qmk ok">/);
  }
});

test('a missed turn: no answer pressed, the right one shown', () => {
  for (const type of E.ATT_TYPES) {
    match(type); state.timer = E.newTimer(60);
    assert.equal(E.attStart(state, 0, 'X').ok, true);
    assert.equal(E.timeoutMove(state, E.makeRng('t')).ok, true);
    const html = renderMini(state.squares[0]), snd = names(state.flash);
    assert.ok(!snd.some(s => s[0] === 'tap'), 'nothing was pressed');
    assert.deepEqual(snd.slice(-1), [['thud', BEAT]]);
    assert.match(html, /class="arcres no appear"/);
    assert.doesNotMatch(html, /hckey ok hit| pick| sel0| pk/);
  }
});
