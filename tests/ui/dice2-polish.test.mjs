// Dice Combo, Backgammon Lite and Rock Paper Scissors as their views play them (the polish sweep, round 2): every
// control as it was (its data-act, its move, its order, its label), and every die, stamp, slide, burst, word and sound
// from the move being played, at the moments the rules' own times give. Rendered in Node with the browser's names
// stubbed (no page needed).
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
const { DIE_BOUNCE } = await import('../../src/ui/dice.js');
const CR = await import('../../src/games/combo/rules.js');
const CV = await import('../../src/games/combo/view.js');
const BR = await import('../../src/games/bglite/rules.js');
const BV = await import('../../src/games/bglite/view.js');
const RR = await import('../../src/games/rps/rules.js');
const RV = await import('../../src/games/rps/view.js');
const { state } = await import('../../src/ui/app.js');
const { SFX } = await import('../../src/audio/sound.js');
const { RESULT_SOUNDS } = await import('../../src/ui/haptics.js');
const css = readFileSync(new URL('../../src/ui/styles.css', import.meta.url), 'utf8');
state.setup = Object.assign({}, state.setup, { names: { X: 'Xena', O: 'Olaf' } });

const clone = v => JSON.parse(JSON.stringify(v));
const faces = (...f) => { let i = 0; return () => (f[i++ % f.length] - 1 + 0.5) / 6; };   // a rng that rolls these faces in order
// A move played on a copy of the square: the square after it and the move's flash, as the page makes it.
function play(type, mini, p, m, rng, kind) {
  const c = clone(mini), res = E.applyMove(c, p, m, rng);
  assert.equal(res.ok, true, JSON.stringify(m));
  const flash = { kind: kind || (res.outcome === 'win' ? 'claim' : 'move'), by: p, next: p, square: 4, type, note: res.note || null, pass: null, timeout: false, m };
  GAMES[type].rules.moveFlash(m, p, null, 0, c, flash);
  return { mini: c, flash, res };
}
// A view's screen: the square as shown, the flash playing (or none), the move made here still on show (or none), whose turn.
const screen = (V, mini, flash, turn, o = {}) => V.screen({ owner: null, mini }, flash, o.done || null, mini, !!o.view, !!flash || !!o.locked, flash, null, false, () => -1, !!(flash && flash.kind === 'claim'), turn, '');
const sounds = (V, f, won) => { const out = []; V.sounds(f, (n, ms, rate) => out.push([n, ms, rate]), !!won); return out; };
const count = (s, re) => (s.match(re) || []).length;
const here = mini => { state.screen = 'mini'; state.zoom = 4; state.squares = Array.from({ length: 9 }, (_, i) => ({ owner: null, mini: i === 4 ? mini : { type: 'ttt' } })); state.flash = null; state.done = null; state.lock = null; state.winner = null; state.online = null; state.cpu = null; };

// ---------- Dice Combo ----------
test('Dice Combo: the controls are as they were: Roll; a die is a button that holds it; Roll again carries the holds; a lit combo is the claim', () => {
  const m0 = E.newMini('combo', E.makeRng('c')); here(m0); state.turn = 'X';
  let h = screen(CV, m0, null, 'X');
  assert.match(h, /<div class="cbtns one"><button class="big X" data-act="move" data-m='"roll"'>Roll<\/button><\/div>/);
  assert.equal(count(h, /data-act="cmbhold"/g), 0, 'nothing to hold before a roll'); assert.equal(count(h, /class="d3q"/g) >= 5, true, 'five dice not rolled yet');
  const r1 = play('combo', m0, 'X', 'roll', faces(4, 4, 2, 4, 6)); here(r1.mini); state.turn = 'X';
  h = screen(CV, r1.mini, null, 'X');
  const dice = [...h.matchAll(/<button class="cmbd[^"]*" data-act="cmbhold" data-k="(\d)" aria-pressed="(true|false)" aria-label="Die (\d): (\d)[^"]*">/g)];
  assert.deepEqual(dice.map(d => [d[1], d[2], d[3], d[4]]), [['0', 'false', '1', '4'], ['1', 'false', '2', '4'], ['2', 'false', '3', '2'], ['3', 'false', '4', '4'], ['4', 'false', '5', '6']], 'five dice, in order, each its own button');
  assert.match(h, /<button class="big X" data-act="move" data-m='"roll:00000"'>Roll again \(1 left\)<\/button>/);
  assert.match(h, /<button class="cmbc can" data-act="move" data-m='"c:3k"' aria-label="Three of a kind: claim it">/); assert.equal(count(h, /<button class="cmbc/g), 1, 'only what the dice make can be claimed');
  // two dice held (as a replayed tap does it: the same draft)
  CV.replay.input('cmbhold', 'k=0', { sq: 4 }); CV.replay.input('cmbhold', 'k=3', { sq: 4 });
  h = screen(CV, r1.mini, null, 'X');
  assert.match(h, /<button class="cmbd held" data-act="cmbhold" data-k="0" aria-pressed="true" aria-label="Die 1: 4, held">/); assert.match(h, /data-m='"roll:10010"'>Roll again \(1 left\)/);
  assert.deepEqual(CV.replay.synth('roll:10010').map(x => x.slice(1)), [['cmbhold', 'k=0'], ['cmbhold', 'k=3'], ['move', 'm="roll:10010"']]);
  // the other side looking on, or a finished square: no control at all
  assert.equal(count(screen(CV, r1.mini, null, 'X', { locked: true }), /data-act="cmbhold"|<button class="cmbc/g), 0);
  assert.doesNotMatch(screen(CV, r1.mini, null, 'X', { view: true }), /<button/);
});

test('Dice Combo: a roll throws the dice not held (the shared die), landing one after the other; what it makes lights up as the last one lands, never before', () => {
  const T = CR.COMBO, m0 = E.newMini('combo', E.makeRng('c')), r1 = play('combo', m0, 'X', 'roll', faces(4, 4, 2, 4, 6)), r2 = play('combo', r1.mini, 'X', 'roll:11010', faces(4, 1));
  assert.deepEqual(r2.flash.combo.dice, [4, 4, 4, 4, 1]); here(r1.mini); state.turn = 'X';
  const h = screen(CV, r1.mini, r2.flash, 'X');
  const cells = [...h.matchAll(/<span class="cmbd([^"]*)"[^>]*aria-label="Die (\d): \d[^"]*"><span class="d3 d3cube([^"]*)"(?: style="--dur:(\d+)ms")?/g)].map(d => [d[1].trim(), /roll/.test(d[3]), Number(d[4] || 0)]);
  assert.deepEqual(cells, [['held', false, 0], ['held', false, 0], ['', true, T.land - T.stag], ['held', false, 0], ['', true, T.land]], 'the held dice stay; the others are thrown, the last down at COMBO.land');
  assert.equal(CV.comboLand(2, [1, 1, 0, 1, 0]), T.land - T.stag); assert.equal(CV.comboLand(0, [0, 0, 0, 0, 0]), T.land - 4 * T.stag);
  assert.doesNotMatch(h, /cmbd[^>]*style="[^"]*--t:/, 'never --t on a die: the shared die reads it as its own start');
  assert.match(h, new RegExp(`<span class="cmbc can soon" style="--t:${T.land + 40}ms" aria-label="Four of a kind: claim it">`)); assert.equal(count(h, /<button class="cmbc/g), 0, 'no claim while it plays');
  assert.match(h, /data-m='"roll:11010"' disabled>Roll again \(1 left\)</, 'the button reads as it did when pressed');
  const snd = sounds(CV, r2.flash);
  assert.deepEqual(snd.map(s => s.slice(0, 2)), [['rattle', 0], ['diceTap', Math.round((T.land - T.stag) * DIE_BOUNCE)], ['thunk', T.land]]);
  assert.ok(T.land + 40 + 240 <= CR.flashMs(r2.flash), 'inside the move\'s time');
  // a last roll that makes nothing: the dice grey as the words come, a thud
  const none = play('combo', r1.mini, 'X', 'roll:00000', faces(1, 3, 5, 6, 6)); assert.equal(none.flash.combo.none, true);
  const hn = screen(CV, none.mini, none.flash, 'X'), tn = CR.comboTimes(none.flash.combo);
  assert.equal(count(hn, new RegExp(`class="cmbd dull late" style="--tz:${tn.land}ms"`, 'g')), 5); assert.match(hn, new RegExp(`<p class="arcres no appear" style="--t:${tn.land}ms" role="status">No combo: nothing claimed</p>`));
  assert.deepEqual(sounds(CV, none.flash).at(-1).slice(0, 2), ['thud', T.roll + 100]); assert.ok(T.roll + 100 + 420 <= CR.flashMs(none.flash));
});

test('Dice Combo: a claim rings the dice that make it, stamps the card and fills the pip as the stamp hits; the square won: the card hops', () => {
  const T = CR.COMBO, m0 = E.newMini('combo', E.makeRng('c')), r1 = play('combo', m0, 'X', 'roll', faces(4, 4, 4, 4, 2)), c = play('combo', r1.mini, 'X', 'c:4k', E.makeRng('z')), tm = CR.comboTimes(c.flash.combo);
  assert.deepEqual([tm.mark, tm.hit, tm.end], [120, 120 + T.stamp, T.claim]); here(c.mini); state.turn = 'X';
  const h = screen(CV, c.mini, c.flash, 'X');
  assert.match(h, new RegExp(`<span class="cmbc got X new stamp" style="--t:${tm.mark}ms" aria-label="Four of a kind, claimed"><svg class="cmbmk X"`));
  assert.deepEqual([...h.matchAll(/class="cmbd mk late" style="--tk:(\d+)ms"/g)].map(x => Number(x[1])), [0, 45, 90, 135], 'the four alike, ringed one after the other');
  assert.match(h, new RegExp(`<i class="on fillin" style="--t:${tm.hit}ms"></i>`), 'the pip fills as the stamp hits');
  assert.match(h, new RegExp(`<p class="arcres ok appear" style="--t:${tm.hit}ms" role="status">Four of a kind!</p>`));
  assert.deepEqual(sounds(CV, c.flash).map(s => s.slice(0, 2)), [['stamp', tm.hit - 30], ['ding', tm.hit + 120]]); assert.ok(RESULT_SOUNDS.has('ding'));
  assert.match(css, /\.cmbc\.stamp \{ animation: cmbfill \.26s calc\(var\(--t, 0ms\) \+ 170ms\)/); assert.equal(T.stamp, 170, 'the stylesheet\'s stamp hits when the rules say');
  // which dice make a combo
  assert.deepEqual(CV.comboDice([2, 5, 5, 3, 5], '3k'), [1, 2, 4]); assert.deepEqual(CV.comboDice([6, 6, 6, 6, 6], '4k'), [0, 1, 2, 3]);
  assert.deepEqual(CV.comboDice([3, 6, 4, 5, 3], 'ss'), [0, 1, 2, 3]); assert.deepEqual(CV.comboDice([1, 2, 3, 4, 6], 'ss'), [0, 1, 2, 3]); assert.deepEqual(CV.comboDice([3, 3, 5, 5, 5], 'fh'), [0, 1, 2, 3, 4]);
  // the winning claim
  const near = clone(r1.mini); near.claimed.X = ['3k', 'fh'];
  const w = play('combo', near, 'X', 'c:4k', E.makeRng('z')); assert.equal(w.res.outcome, 'win');
  const hw = screen(CV, w.mini, w.flash, 'X');
  assert.match(hw, new RegExp(`<div class="cmbcard X now cheer" style="--tw:${tm.hit + 180}ms"`)); assert.ok(tm.hit + 180 + 520 <= CR.flashMs(w.flash, 0, true), 'the hop is over within the won move\'s time');
  // nothing playing: the cards as they stand, each one's newest claim ringed, nothing timed
  const still = screen(CV, w.mini, null, 'O', { view: true });
  assert.doesNotMatch(still, /stamp|cheer|late|soon|--t/); assert.equal(count(still, /class="cmbc got X/g), 3); assert.equal(count(still, /class="cmbc got X new"/g), 1);
});

test('Dice Combo: the miniature is five dice over the two cards, a claimed cell filled', () => {
  const m = E.newMini('combo', E.makeRng('c')); m.claimed = { X: ['3k', 'ls'], O: ['fh'] };
  const t = CV.miniature(m);
  assert.match(t, /^<div class="tcmb" aria-label="Dice Combo: X 2, O 1 of 3 combos"><svg /); assert.equal(count(t, /class="tcmbd"/g), 5);
  assert.equal(count(t.split('tcmbk O')[0], /class="tcmbc on"/g), 2); assert.equal(count(t.split('tcmbk O')[1], /class="tcmbc on"/g), 1); assert.doesNotMatch(t, /<text|<b[ >]/);
});

// ---------- Rock Paper Scissors ----------
const rpsRng = h => () => ({ r: 0.1, p: 0.5, s: 0.9 })[h];   // the house throws h
test('Rock Paper Scissors: the three throws are the buttons they were, in order; nothing else takes a tap', () => {
  const m0 = E.newMini('rps', E.makeRng('r')), h = screen(RV, m0, null, 'O');
  const btns = [...h.matchAll(/<button class="rpsbtn O" data-act="move" data-m='"([rps])"' aria-label="(\w+)"><svg class="rpsv [rps]"[^>]*>.*?<\/svg><span>(\w+)<\/span><\/button>/g)];
  assert.deepEqual(btns.map(b => [b[1], b[2], b[3]]), [['r', 'rock', 'Rock'], ['p', 'paper', 'Paper'], ['s', 'scissors', 'Scissors']]); assert.equal(count(h, /<button/g), 3);
  assert.equal(count(screen(RV, m0, null, 'X', { locked: true }), /<button class="rpsbtn X"[^>]* disabled>/g), 3); assert.doesNotMatch(screen(RV, m0, null, 'X', { view: true }), /<button/);
  assert.equal(new Set(['r', 'p', 's'].map(k => RV.rpsSvg(k))).size, 3, 'three drawings');
});

test('Rock Paper Scissors: both fists pump, open at the show, and the verdict strikes: the winner forward over a burst, the loser back; the pip fills as it lands', () => {
  const T = RR.RPST, m0 = E.newMini('rps', E.makeRng('r'));
  const w = play('rps', m0, 'X', 'r', rpsRng('s'), 'move'), tm = RR.rpsTimes(w.flash.rps), hit = tm.judge + T.strike;
  assert.deepEqual([tm.show, tm.judge, tm.end], [T.shake, T.shake + T.judge, T.shake + T.judge + T.hold]);
  const h = screen(RV, w.mini, w.flash, 'X');
  const arms = [...h.matchAll(/<div class="rpsarm (house|me) (win|lose|tie) play" style="--t:(\d+)ms;--tj:(\d+)ms"><i class="rpssl"><\/i><span class="rpshd">(<i class="rpsbang"><\/i>)?<span class="rpsfist"><svg class="rpsv r"[^>]*>.*?<\/svg><\/span><span class="rpsthrow pop"><svg class="rpsv ([rps])"/g)];
  assert.deepEqual(arms.map(a => [a[1], a[2], Number(a[3]), Number(a[4]), !!a[5], a[6]]), [['house', 'lose', tm.show, tm.judge, false, 's'], ['me', 'win', tm.show, tm.judge, true, 'r']]);
  assert.match(h, new RegExp(`<p class="rpsres win appear" style="--t:${tm.judge}ms" role="status">Rock beats scissors!</p>`));
  assert.match(h, new RegExp(`<i class="on fillin" style="--t:${hit}ms"></i>`)); assert.match(h, /<div class="g-rps pc-X">/);
  assert.deepEqual(sounds(RV, w.flash).map(s => s.slice(0, 2)), [['peg', T.shake / 3], ['peg', 2 * T.shake / 3], ['pop', tm.show], ['thunk', hit], ['ding', hit + 110]]);
  assert.ok(hit + 110 < RR.flashMs(w.flash) && hit + 340 <= RR.flashMs(w.flash), 'the strike and its burst are over within the move');
  // lost: the house's hand wins; a tie: both bump, the words say to throw again
  const l = play('rps', m0, 'O', 's', rpsRng('r'), 'move'), hl = screen(RV, l.mini, l.flash, 'O');
  assert.match(hl, /<div class="rpsarm house win play"[^>]*><i class="rpssl"><\/i><span class="rpshd"><i class="rpsbang">/); assert.match(hl, /<div class="rpsarm me lose play"/); assert.match(hl, />Rock beats scissors<\/p>/); assert.doesNotMatch(hl, /fillin/);
  assert.deepEqual(sounds(RV, l.flash).at(-1).slice(0, 2), ['thud', RR.rpsTimes(l.flash.rps).judge + T.strike]);
  const t = play('rps', m0, 'X', 'p', rpsRng('p'), 'move'), ht = screen(RV, t.mini, t.flash, 'X');
  assert.equal(count(ht, /<div class="rpsarm (house|me) tie play"/g), 2); assert.match(ht, />Tie! Throw again<\/p>/); assert.deepEqual(sounds(RV, t.flash).at(-1)[0], 'boing');
  assert.match(screen(RV, m0, { ...l.flash, rps: { ...l.flash.rps, t: 's', h: 'p', res: 'win' } }, 'O'), />Scissors beat paper!<\/p>/);
  for (const s of sounds(RV, w.flash).concat(sounds(RV, l.flash), sounds(RV, t.flash))) assert.ok(SFX[s[0]], s[0]);
  // once played: the hands as they ended, nothing timed; before any throw: two fists at rest
  const after = screen(RV, w.mini, null, 'O', { done: w.flash });
  assert.match(after, /<div class="rpsarm house lose"><i class="rpssl"><\/i><span class="rpshd"><span class="rpsthrow"><svg class="rpsv s"/); assert.match(after, /<div class="rpsarm me win">/); assert.doesNotMatch(after, /play|--t|appear|fillin/);
  assert.equal(count(screen(RV, m0, null, 'X'), /<div class="rpsarm (house|me) idle">/g), 2);
  // the stylesheet's strike lands when the rules say
  assert.match(css, /\.rpsarm\.play \.rpsbang \{ animation: rpsbang \.34s calc\(var\(--tj, 0ms\) \+ 130ms\)/); assert.equal(T.strike, 130);
});

// ---------- Backgammon Lite ----------
const bgl = (pos, dice, last) => { const m = E.newMini('bglite', E.makeRng('b')); m.rolled = true; m.pos = clone(pos); m.dice = dice ? { by: dice.by, v: dice.v, used: dice.v.map(() => false), off: 0 } : null; m.last = last || null; return m; };
test('Backgammon Lite: the controls are as they were: Roll; a piece that can move is its button; the picked piece\'s rings carry die.piece; Undo in Roll\'s place', () => {
  assert.deepEqual(BV.BGLV, { auto: 400, commit: 450 }, 'the forced step\'s beat and the turn\'s beat before it goes in');
  const m0 = E.newMini('bglite', E.makeRng('b')); here(m0); state.turn = 'X';
  let h = screen(BV, m0, null, 'X');
  assert.match(h, /<div class="cbtns one"><button class="big X" data-act="move" data-m='"roll"'>Roll<\/button><\/div>/); assert.equal(count(h, /<button/g), 1);
  const m = bgl({ X: [1, 3, 6], O: [1, 3, 4] }, { by: 'X', v: [2, 3] }); here(m); state.turn = 'X';
  h = screen(BV, m, null, 'X');
  assert.deepEqual([...h.matchAll(/<button class="bglp X[^"]* can[^"]*" style="[^"]*" data-act="bglpk" data-k="(\d)" aria-label="Pick this piece">/g)].map(x => x[1]), ['0', '1', '2'], 'each piece that can move');
  assert.equal(count(h, /data-act="bglto"/g), 0, 'no rings before a piece is picked (three can move)');
  assert.match(h, /<div class="cbtns one"><button class="big bglundo" data-act="bglundo" disabled>Undo<\/button><\/div>/); assert.doesNotMatch(h, /data-m='"roll"'/);
  BV.bglDraft.pick = 1; h = screen(BV, m, null, 'X');
  assert.match(h, /<button class="bglp X can pick" style="[^"]*" data-act="bglpk" data-k="1" aria-label="Picked">/);
  assert.deepEqual([...h.matchAll(/<button class="bglg X" style="[^"]*" data-act="bglto" data-n="(\d\.\d)" aria-label="Move with the (\d)">/g)].map(x => [x[1], x[2]]), [['0.1', '2'], ['1.1', '3']], 'a ring a die, labelled die.piece');
  assert.equal(count(h, /class="bgldie sel"/g), 2, 'the dice the picked piece can use, ringed');
  // looking on (the other side's dice out): pieces and rings are not buttons
  assert.equal(count(screen(BV, m, null, 'X', { locked: true }), /data-act="bglpk"|data-act="bglto"/g), 0);
  // the replay presses the same taps
  assert.deepEqual(BV.replay.synth({ steps: [[1, 1], [0, 0]] }, m).map(x => x.slice(1)), [['bglpk', 'k=1'], ['bglto', 'n=1.1'], ['bglpk', 'k=0'], ['bglto', 'n=0.0']]);
});

test('Backgammon Lite: the roll throws the shared die; a turn played from its flash slides each piece in turn, a hit bursts where it lands and its words are one line', () => {
  const T = BR.BGLT, m0 = E.newMini('bglite', E.makeRng('b')); here(m0); state.turn = 'X';
  const r = play('bglite', m0, 'X', 'roll', faces(4, 2)); assert.equal(r.flash.bgl.one, true, 'the opening roll: one die');
  let h = screen(BV, m0, r.flash, 'X');
  assert.deepEqual([...h.matchAll(/<span class="bgldie" role="img" aria-label="(\d)"><span class="d3 d3cube roll v0" style="--dur:(\d+)ms"/g)].map(x => [x[1], Number(x[2])]), [['4', T.land]]);
  assert.match(h, new RegExp(`<p class="arcres  appear" style="--t:${T.roll}ms" role="status">Opening roll: 4</p>`));
  assert.deepEqual(sounds(BV, r.flash).map(s => s.slice(0, 2)), [['rattle', 0], ['diceTap', Math.round(T.land * DIE_BOUNCE)], ['thunk', T.land]]); assert.ok(T.land < BR.flashMs(r.flash));
  const two = play('bglite', r.mini, 'X', { steps: [[0, 0]] }, E.makeRng('z')), d = play('bglite', two.mini, 'O', 'roll', faces(3, 3));
  assert.deepEqual([...screen(BV, two.mini, d.flash, 'O').matchAll(/class="d3 d3cube roll v(\d)" style="--dur:(\d+)ms"/g)].map(x => Number(x[2])), [0, 1, 2, 3].map(k => BV.bglLand(k, 4)), 'a double: four dice, landing one after the other');
  assert.equal(BV.bglLand(3, 4), T.land); assert.equal(BV.bglLand(0, 2), T.land - T.stag);
  // a turn with a hit, played from the flash alone (no draft has shown it)
  const m = bgl({ X: [1, 3, 6], O: [1, 3, 4] }, { by: 'X', v: [2, 3] }); here(m); state.turn = 'O';
  const t = play('bglite', m, 'X', { steps: [[1, 1], [0, 0]] }, E.makeRng('z')), tm = BR.bglTimes(t.flash.bgl);
  assert.equal(t.flash.bgl.steps[0].hit.k, 1);
  h = screen(BV, t.mini, t.flash, 'O');
  assert.match(h, new RegExp(`<i class="bglbam" style="[^"]*;--t:${tm.steps[0].hitAt}ms" aria-hidden="true"></i>`), 'the burst as the piece lands on the other\'s');
  assert.ok(count(h, /class="bglh slide"/g) >= 2, 'each step slides (and a piece it lands under moves up)'); assert.equal(count(h, /class="bglh fly"/g), 1, 'the hit piece flies home');
  assert.match(h, new RegExp(`<p class="arcres ok appear" style="--t:${tm.steps[0].hitAt}ms" role="status">Hit! Back to the start</p>`));
  assert.deepEqual([...h.matchAll(/<span class="bgldie spend" style="--ts:(\d+)ms"/g)].map(x => Number(x[1])).sort((a, b) => a - b), [tm.steps[0].land, tm.steps[1].land], 'each die dims as its step lands');
  assert.doesNotMatch(h, /bgldie[^>]*style="[^"]*--t:/, 'never --t on a die');
  const snd = sounds(BV, t.flash); assert.deepEqual(snd.map(s => s[0]), ['pieceSlide', 'clack', 'thud', 'pieceSlide', 'clack']); assert.ok(snd.every(s => SFX[s[0]] && s[1] < BR.flashMs(t.flash)));
  assert.match(css, /\.bgl \.arcres, \.bgl \.arcnote \{[^}]*white-space: nowrap/);
});

test('Backgammon Lite: the turn before is marked while nothing is under way; the trays carry their owners\' marks and sockets; a square from before keeps its plain trays', () => {
  const m = bgl({ X: [1, 3, 6], O: [1, 3, 4] }, { by: 'X', v: [2, 3] }), t = play('bglite', m, 'X', { steps: [[1, 1], [0, 0]] }, E.makeRng('z')); here(t.mini); state.turn = 'O';
  const h = screen(BV, t.mini, null, 'O');
  assert.equal(count(h, /class="bglp X last"/g), 2, 'the two pieces it moved'); assert.equal(count(h, /class="bglp O[^"]*last/g), 0);
  assert.equal(count(h, /<i class="bgltr X"/g), 1, 'a ghost where a piece came from (the other place has a piece on it again)');
  assert.match(h, /<i class="bglz l O" style="[^"]*"><svg class="bglmk O"/); assert.match(h, /<i class="bglz r X" style="[^"]*"><svg class="bglmk X"/); assert.equal(count(h, /<i class="bglso"/g), 6);
  assert.equal(count(h, /<i class="bglhm [XO]"/g), 2);
  // once the next roll is out the marks are gone (the draft's own turn)
  const r = play('bglite', t.mini, 'O', 'roll', faces(1, 2)); here(r.mini); state.turn = 'O';
  assert.doesNotMatch(screen(BV, r.mini, null, 'O'), /bgltr| last"/);
  // every piece off: the tray framed, the pieces in it marked as the winner's
  const w = bgl({ X: [9, 9, 9], O: [4, 6, 2] }, null); here(w);
  const hw = screen(BV, w, null, 'O', { view: true });
  assert.match(hw, /<i class="bglz r X full"/); assert.equal(count(hw, /class="bglp X won"/g), 3); assert.doesNotMatch(hw, /<button/);
  // a square dealt before the rework (v 1): no marks, no sockets, no home bands
  const old = E.newMini('bglite', E.makeRng('b')); old.v = 1; old.pos = { X: [0, 0, 0], O: [0, 0, 0] }; here(old);
  const ho = screen(BV, old, null, 'X');
  assert.doesNotMatch(ho, /bglso|bglhm|<i class="bglz [lr] [XO]"[^>]*><svg/);
  // the miniature: the board in its frame, every piece on it, the pips under it
  const mm = BV.miniature(bgl({ X: [9, 7, 4], O: [9, 6, 2] }, null));
  assert.match(mm, /^<div class="tbglm" aria-label="Backgammon Lite: X has 1 of 3 off, O has 1 of 3 off"><svg class="tbgl"/); assert.equal(count(mm, /class="ttok [XO]"/g), 6); assert.equal(count(mm, /class="tbglpt/g), 8); assert.equal(count(mm, /class="tbglh [XO]"/g), 2);
});
