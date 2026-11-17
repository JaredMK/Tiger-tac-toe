// Shell Game's screen (games/shell/view.js, on the attention framework: ui/attention.js): Start alone before a round
// and nothing of the round on the page; a button over each cup's place, live only once the cups have settled on this
// phone's own round; what the table shows at each moment (shellScene: the ball on show, the shuffle, the pick's ring,
// the tension, the cup lifting, the ball's own cup after a wrong pick, the burst); someone else's round played first,
// then their pick, then the verdict; the sounds (a whoosh a step, faster as the tempo rises) and the buzzes; the
// miniature (cups filling in by level); and the explainer following the settings. Rendered in Node with the browser's
// names stubbed (motion allowed).
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
const { ATT_T, attPre } = await import('../../src/ui/attention.js');
const V = await import('../../src/games/shell/view.js');
const { explainOf } = await import('../../src/ui/explainer.js');
GAMES.shell.view = V;   // (the page registers the views in main.js; here by hand)
const SHELL = E.SHELL;

function match(turn = 'X', tune) {
  E.setTune('shell', tune || null);
  try { Object.assign(state, E.newMatch(E.makeRng('shell-ui'), { games: ['shell'], vs: 'cpu' }), { screen: 'mini', zoom: 0, cpu: 'O', sc: null, flash: null, done: null, spot: null, winner: null, online: null, turn, lock: null }); }
  finally { E.setTune('shell', null); }
  state.setup.vs = 'cpu'; state.setup.names = { X: 'Xena', O: 'Computer' };
  return state.squares[0].mini;
}
const acts = html => [...html.slice(html.indexOf('class="gwrap"')).matchAll(/<button class="[^"]*"(?: style="[^"]*")? data-act="([a-z-]+)"(?: data-(?:k|i|m)='?"?([^'" ]*)"?'?)?[^>]*?( disabled)?>/g)].map(m => [m[1], m[2] == null ? null : m[2], !m[3]]);
const names = f => moveSounds(f).map(s => [s[0], s[1]]);

test('before Start: Start alone, in the mover\'s colour; a cup\'s button for each place, none live; nothing of the round on the page', () => {
  assert.equal(REDUCED, false);
  const m = match(), html = renderMini(state.squares[0]);
  assert.deepEqual(acts(html).filter(a => a[2]), [['att-start', null, true]], 'Start is the one control');
  assert.match(html, /<button class="big X" data-act="att-start">Start<\/button>/);
  assert.match(html, /class="att att-shell pc-X ph-ready"/);
  assert.match(html, />Level 1 of 3</);
  assert.match(html, /<div class="shbox" style="--n:3"><canvas class="shcv" data-shell="cv" aria-label="3 cups on the table"><\/canvas><div class="shtaps">/);
  assert.equal((html.match(/<button class="shtap" data-act="move"[^>]* disabled>/g) || []).length, 3, 'three cups, none to press yet');
  assert.ok(!html.includes(String(m.round.X.seed)), 'not the seed');
  state.turn = 'O';
  assert.match(renderMini(state.squares[0]), /class="att att-shell pc-O ph-idle"/);
  assert.deepEqual(acts(renderMini(state.squares[0])).filter(a => a[2]), []);
  const m5 = match('X', { levels: 5, c1: 7 });
  assert.match(renderMini(state.squares[0]), />Level 1 of 5</, 'the levels are the square\'s settings');
  assert.equal(m5.round.X.n, 7); assert.match(renderMini(state.squares[0]), /style="--n:7"/);
});

test('the table at each moment of this phone\'s round: the ball on show under its lifted cup, covered, the cups sliding, then still where the shuffle left them', () => {
  const r = E.shellRound(1, E.makeRng('scene'), E.tuneDefaults('shell')), plan = E.shellPlan(r), base = { r, n: r.n, pre: 0, T: null, pick: null, correct: false };
  let sc = V.shellScene(Object.assign({ mode: 'idle' }, base));
  assert.deepEqual(sc.cups.map(q => [q.x, q.z, q.lift]), Array.from({ length: r.n }, (_, i) => [i, 0, 0])); assert.equal(sc.ball, null, 'before Start: the cups down, no ball');
  sc = V.shellScene(Object.assign({ mode: 'live', t: SHELL.lift + 50 }, base));
  assert.deepEqual(sc.ball, { cup: r.ball, show: 1 }); assert.equal(sc.cups[r.ball].lift, 1); assert.ok(sc.cups.every((q, i) => i === r.ball || q.lift === 0)); assert.equal(sc.more, true);
  sc = V.shellScene(Object.assign({ mode: 'live', t: r.show + 60 }, base));
  assert.equal(sc.ball, null, 'covered: the ball is never drawn again until a cup lifts'); assert.ok(sc.cups.every(q => q.lift === 0));
  const mid = plan.steps[0];
  sc = V.shellScene(Object.assign({ mode: 'live', t: mid.t0 + mid.d / 2 }, base));
  const [a, b, front] = mid.sw[0], mv = sc.cups.filter(q => q.u > 0);
  assert.equal(mv.length, mid.sw.length * 2, 'the step\'s cups on their way');
  assert.ok(Math.abs(sc.cups[a].x - (a + b) / 2) < 1e-9 && Math.abs(sc.cups[b].x - (a + b) / 2) < 1e-9, 'half way: the two cross');
  assert.equal(Math.sign(sc.cups[a].z), front ? 1 : -1); assert.ok(Math.abs(sc.cups[a].z - sc.cups[b].z) >= 0.85, 'one round the front, one round the back, most of a cup apart');
  for (const mode of ['ans']) { sc = V.shellScene(Object.assign({ mode }, base)); assert.deepEqual(sc.cups.map(q => q.x), plan.at); assert.equal(sc.ball, null); assert.equal(sc.pick, null); assert.equal(sc.more, false); }
});

test('the pick: a ring at once, the cup trembling for the beat, then it lifts: the ball and its burst, or nothing and the ball\'s own cup after it', () => {
  const r = E.shellRound(0, E.makeRng('pick'), E.tuneDefaults('shell')), plan = E.shellPlan(r), T = SHELL.tense;
  const right = { r, n: 3, mode: 'res', pre: 0, T, pick: plan.ballAt, correct: true }, pc = plan.at.indexOf(plan.ballAt);
  assert.equal(pc, r.ball, 'the cup at the ball\'s place is the ball\'s cup');
  let sc = V.shellScene(Object.assign({ tm: 200 }, right));
  assert.equal(sc.pick.cup, pc); assert.equal(sc.pick.ring, 1); assert.equal(sc.ball, null, 'not yet'); assert.ok(sc.cups[pc].lift < 0.05 && sc.burst == null && sc.more);
  sc = V.shellScene(Object.assign({ tm: T + SHELL.open }, right));
  assert.equal(sc.cups[pc].lift, 1); assert.deepEqual(sc.ball, { cup: pc, show: 1 }); assert.ok(sc.burst > 0, 'the burst pops behind the ball');
  sc = V.shellScene(Object.assign({ tm: T + SHELL.open + 3000 }, right)); assert.equal(sc.more, false, 'and the animation ends');
  const wrongAt = (plan.ballAt + 1) % 3, wrong = { r, n: 3, mode: 'res', pre: 0, T, pick: wrongAt, correct: false }, wc = plan.at.indexOf(wrongAt);
  sc = V.shellScene(Object.assign({ tm: T + SHELL.open }, wrong));
  assert.equal(sc.cups[wc].lift, 1); assert.equal(sc.ball, null, 'the wrong cup is up, nothing under it; the ball\'s cup still down'); assert.equal(sc.cups[r.ball].lift, 0); assert.equal(sc.burst, null);
  sc = V.shellScene(Object.assign({ tm: T + V.SHELLV.other + SHELL.open }, wrong));
  assert.deepEqual(sc.ball, { cup: r.ball, show: 1 }, 'then where it was');
  sc = V.shellScene({ r, n: 3, mode: 'done', pre: 0, T: null, pick: wrongAt, correct: false });
  assert.deepEqual([sc.cups[wc].lift, sc.cups[r.ball].lift, sc.ball.cup, sc.more], [1, 1, r.ball, false], 'looked at later: both up, still');
  const pre = plan.ms + E.ATT.pause, theirs = { r, n: 3, mode: 'res', pre, T: pre + T, pick: plan.ballAt, correct: true };   // someone else's: their round first
  sc = V.shellScene(Object.assign({ tm: SHELL.lift + 20 }, theirs)); assert.deepEqual(sc.ball, { cup: r.ball, show: 1 }, 'their round from its start: the ball on show');
  sc = V.shellScene(Object.assign({ tm: plan.ms + ATT_T.pick - 20 }, theirs)); assert.equal(sc.pick, null);
  sc = V.shellScene(Object.assign({ tm: plan.ms + ATT_T.pick + 150 }, theirs)); assert.equal(sc.pick.cup, pc, 'their pick goes in after their round');
  sc = V.shellScene(Object.assign({ tm: pre + T + SHELL.open }, theirs)); assert.equal(sc.cups[pc].lift, 1);
});

test('this phone\'s own pick: pressed in at once, the verdict after the cup\'s beat; the round it has just played is not played again', () => {
  const m = match(), truth = E.attTruth('shell', m.round.X);
  assert.equal(E.playMove(state, 0, truth, E.makeRng('a')).ok, true);
  const f = state.flash, html = renderMini(state.squares[0]), T = SHELL.tense;
  assert.equal(attPre(f), 0); assert.equal(animMs(f), E.attShow('shell'));
  assert.match(html, /class="att att-shell pc-X ph-res"/);
  assert.match(html, new RegExp(`class="arcres ok appear" style="--t:${T}ms"[^>]*>Right!<`), 'the words land with the cup');
  assert.equal((html.match(/data-anchor="qpick"/g) || []).length, 1, 'the point flies from the right cup');
  assert.match(html, new RegExp(`<i class="on fillin" style="--t:${T + QUIZ.fly}ms;--k:0"><b class="qtok" data-cf="qpick" data-cfat="${T}"`));
  assert.deepEqual(acts(html).filter(a => a[2]), [], 'nothing to press while the result shows');
  assert.deepEqual(names(f), [['tap', 0], ['shTense', 0], ['shLift', T], ['sparkle', T + SHELL.open - 80], ['ding', T + SHELL.open - 120], ['pop', T + QUIZ.fly]]);
  const plan = movePlan(f, moveSounds(f));
  assert.deepEqual(plan[0], ['tap', 0]); assert.ok(plan.some(p => p[0] === 'medium'), 'the result\'s buzz');
  const m2 = match(), wrong = (E.attTruth('shell', m2.round.X) + 1) % 3;
  assert.equal(E.playMove(state, 0, wrong, E.makeRng('b')).ok, true);
  const h2 = renderMini(state.squares[0]);
  assert.match(h2, new RegExp(`class="arcres no appear" style="--t:${T}ms"[^>]*>Not quite<`), 'no words for where it was: the cup shows it');
  assert.deepEqual(names(state.flash).slice(-2), [['shLift', T], ['thud', T + SHELL.open - 120]]);
  assert.doesNotMatch(h2, /data-anchor="qpick"/);
});

test('someone else\'s round plays first (each step\'s whoosh faster as the tempo rises), then their pick, then the verdict', () => {
  const m = match('O'), r = m.round.O, plan = E.shellPlan(r), len = plan.ms, truth = E.attTruth('shell', r);
  assert.equal(E.playMove(state, 0, truth, E.makeRng('a')).ok, true);
  const f = state.flash, pre = attPre(f), T = pre + SHELL.tense, html = renderMini(state.squares[0]);
  assert.equal(pre, len + E.ATT.pause); assert.equal(animMs(f), pre + E.attShow('shell'));
  assert.match(html, /class="att att-shell pc-O ph-res"/);
  assert.match(html, new RegExp(`class="arcres ok appear" style="--t:${T}ms"[^>]*><b class="O">.*?Computer</b> got it right`));
  assert.match(html, new RegExp(`<span class="tu" style="--u:${len}ms"><i class="atph eye"`), 'the eye while their round plays');
  const snd = moveSounds(f), slides = snd.filter(s => s[0] === 'shSlide');
  assert.deepEqual(snd.slice(0, 2).map(s => [s[0], s[1]]), [['shLift', 0], ['shDown', Math.max(0, r.show - SHELL.drop * 0.4)]]);
  assert.deepEqual(slides.map(s => s[1]), plan.steps.map(s => s.t0), 'a whoosh at each step');
  for (let i = 1; i < slides.length; i++) assert.ok(slides[i][2] >= slides[i - 1][2], 'played faster as the swaps get faster');
  assert.ok(slides[slides.length - 1][2] > slides[0][2]);
  assert.ok(snd.some(s => s[0] === 'shSet' && s[1] === plan.end) && snd.some(s => s[0] === 'tap' && s[1] === len + ATT_T.pick));
  assert.deepEqual(names(f).slice(-5), [['shTense', pre], ['shLift', T], ['sparkle', T + SHELL.open - 80], ['ding', T + SHELL.open - 120], ['pop', T + QUIZ.fly]]);
});

test('the last level: the square is won; a finished square looked at later is still; a missed turn shows where the ball was, nothing pressed', () => {
  let m = match(); m.right.X = 2; m.round.X = E.shellRound(2, E.makeRng('w'), E.tune(m));
  assert.equal(E.playMove(state, 0, E.attTruth('shell', m.round.X), E.makeRng('a')).ok, true);
  assert.ok(state.flash.kind === 'claim' || state.flash.kind === 'match');
  assert.match(renderMini(state.squares[0]), /<span class="pips qpips qwon" aria-label="3 of 3"/);
  const won = names(state.flash).find(s => s[0] === 'won');
  assert.equal(won[1], animMs(state.flash) - 600, 'the chime inside the move as this phone plays it');
  E.endFlash(state); state.flash = null; state.done = null;
  assert.doesNotMatch(renderMini(state.squares[0]), / late|appear|qtok|data-act="att-start"/, 'settled');
  m = match(); state.timer = E.newTimer(60);
  assert.equal(E.attStart(state, 0, 'X').ok, true);
  assert.equal(E.timeoutMove(state, E.makeRng('t')).ok, true);
  const snd = names(state.flash);
  assert.ok(!snd.some(s => s[0] === 'tap' || s[0] === 'shTense'), 'nothing was pressed');
  assert.deepEqual(snd.slice(-2), [['shLift', SHELL.tense], ['thud', SHELL.tense + SHELL.open - 120]]);
  assert.match(renderMini(state.squares[0]), /class="arcres no appear"[^>]*>(Out of time|<b class="X">.*?<\/b> ran out of time)</);
});

test('the miniature: the cups and the ball, and each player\'s level as cups filling in; the words of a move; the explainer follows the settings', () => {
  const m = match(); m.right = { X: 2, O: 1 };
  const html = V.miniature(m);
  assert.match(html, /^<div class="tart tshellw" aria-label="X level 2 and O level 1 of 3">/);
  assert.match(html, /<svg viewBox="0 0 52 40"/, 'a picture');
  const row = p => html.slice(html.indexOf(`<div class="tr ${p}"`)).split('</div>')[0];
  assert.deepEqual([(row('X').match(/class="shmc on"/g) || []).length, (row('X').match(/class="shmc"/g) || []).length], [2, 1]);
  assert.deepEqual([(row('O').match(/class="shmc on"/g) || []).length, (row('O').match(/class="shmc"/g) || []).length], [1, 2]);
  assert.ok(!/ball|seed/.test(html.replace(/aria-label="[^"]*"/g, '')), 'nothing of a round');
  const m5 = match('X', { levels: 5 });
  assert.equal((V.miniature(m5).match(/<u class="shmc/g) || []).length, 10, 'five cups a row for five levels');
  assert.equal(V.moveText({ att: { correct: true, answer: 1 } }, 'Sam'), 'Sam found the ball');
  assert.equal(V.moveText({ att: { correct: false, answer: 1 } }, 'Sam'), 'Sam picked the wrong cup');
  assert.equal(V.moveText({ att: { correct: false, answer: null } }, 'Sam'), 'Sam ran out of time');
  state.screen = 'menu';
  assert.deepEqual(explainOf('shell'), { name: 'Shell Game', play: 'Watch the ball, then follow its cup as they shuffle. More cups each level.', win: 'Pick right 3 times.' });
  E.setTune('shell', { levels: 5, again: 'on' });
  try { assert.deepEqual(explainOf('shell'), { name: 'Shell Game', play: 'Watch the ball, then follow its cup as they shuffle. More cups each level. Right? Go again.', win: 'Pick right 5 times.' }); }
  finally { E.setTune('shell', null); }
});

test('the canvas\'s geometry: the same cup size at rest and through the shuffle, every arc and the lift inside the canvas, at every count of cups and phone width', () => {
  for (const n of [2, 3, 4, 5, 6, 7]) for (const [W, H] of [[296, 150], [328, 250], [358, 300], [398, 300], [560, 300]]) {
    const G = V.shellGeom(W, H, n), arc = E.shellArc(Math.max(1, Math.min(SHELL.span, n - 1)));
    assert.ok(G.cw > 14 && G.cw <= G.S * 0.85, `${n} cups at ${W}: a cup ${G.cw.toFixed(0)} px wide, no wider than its place`);
    assert.ok(G.x(0) - G.cw * 0.6 >= 0 && G.x(n - 1) + G.cw * 0.6 <= W, 'the row inside the canvas');
    assert.ok(G.y0 - G.ch * (1 + Math.max(arc, V.SHELLV.lift)) >= 0, 'the furthest arc behind and the lifted cup inside the top');
    assert.ok(G.y0 + G.ch * arc * 1.07 <= H, 'the furthest arc in front inside the bottom');
  }
});
