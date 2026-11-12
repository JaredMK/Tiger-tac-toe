// Poker Hands' screen (src/games/poker/view.js; the polish sweep, November 2026), rendered in Node with the browser's
// names stubbed: the felt with the muck and the deck, five cards dealt from the deck turning up as they come, the marks
// (this phone's draft: a tap on a card, then Draw N / Keep all), and the payoff: the hand's name and points popping as the
// last card lands, the cards that made the hand ringed and hopping one after the other, the rest dimmed, the total
// counting on. The controls are as they were: Deal, a tap on a card to mark it, Draw N / Keep all.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
Object.defineProperty(globalThis, 'window', { value: new Proxy(function () {}, { get: (t, k) => (k === 'matchMedia' ? () => ({ matches: false, addEventListener() {}, addListener() {} }) : k === Symbol.toPrimitive ? () => '' : stub()), apply: () => stub(), construct: () => stub(), set: () => true }), configurable: true, writable: true });
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const R = require('../../src/games/poker/rules.js');
const { GAMES } = await import('../../src/games/index.js');
const V = await import('../../src/games/poker/view.js');
const { state } = await import('../../src/ui/app.js');
GAMES.poker.view = V;
state.setup = Object.assign({}, state.setup, { names: { X: 'Xena', O: 'Olaf' } });

const clone = v => JSON.parse(JSON.stringify(v));
function fresh() {
  Object.assign(state, E.newMatch(E.makeRng('pok-ui'), { games: ['poker'] }), { screen: 'mini', zoom: 0, online: null, cpu: 'O', flash: null, done: null, spot: null, turn: 'X' });
  state.squares[0] = { owner: null, mini: E.newMini('poker', E.makeRng('pok-deal')) };
  return state.squares[0].mini;
}
const flashOf = (mini, p, mv, res) => { const f = { kind: res.outcome === 'win' ? 'claim' : res.again ? 'again' : 'move', by: p, square: 0, type: 'poker', note: res.note || null, m: mv }; GAMES.poker.rules.moveFlash(mv, p, null, 0, mini, f); return f; };
const screen = (mini, f, turn, o = {}) => V.screen(state.squares[0], f, null, mini, !!o.view, !!o.locked, f, null, false, () => -1, false, turn, '');
const cards = html => [...html.matchAll(/<(button|span) class="(pokc[^"]*)"([^>]*)>/g)].map(m => ({ tag: m[1], cls: m[2].split(' '), attrs: m[3] }));

test('the cards that make a hand: a pair\'s two, two pair\'s four, the three or four of a kind, all five of a straight, a flush or a full house', () => {
  const made = (h, want) => { const hand = h.split(' '); assert.deepEqual(V.pokMade(hand, R.handRank(hand)).join(''), want, h); };
  made('2S 9H 2D KC 4S', '10100'); made('2S 9H 2D 9C 4S', '11110'); made('2S 2H 2D KC 4S', '11100'); made('2S 2H 2D 2C 4S', '11110');
  made('3H 9H JH KH AH', '11111'); made('5S 6H 7D 8C 9S', '11111'); made('2S 2H 2D KC KS', '11111'); made('2S 9H 3D KC 4S', '00000');
  assert.deepEqual(V.pokMade(null, 'pair'), [0, 0, 0, 0, 0]);
});

test('the controls: Deal; a tap on a card marks it (data-act pokmark, data-k 0 to 4); Draw N / Keep all carries the marks', () => {
  const mini = fresh();
  let html = screen(mini, null, 'X');
  assert.match(html, /<button class="big X" data-act="move" data-m='"deal"'>Deal<\/button>/);
  assert.equal(cards(html).filter(c => c.tag === 'button').length, 0, 'no card to tap before the deal');
  assert.equal((html.match(/class="pokslot"/g) || []).length, 5, 'five places on the felt');
  const res = E.applyMove(mini, 'X', 'deal', E.makeRng('d1'));
  assert.ok(res.ok && res.again);
  html = screen(mini, null, 'X');
  const cs = cards(html);
  assert.deepEqual(cs.map(c => [c.tag, /data-act="pokmark" data-k="(\d)"/.exec(c.attrs)[1], /aria-pressed="false"/.test(c.attrs)]), [0, 1, 2, 3, 4].map(k => ['button', String(k), true]));
  assert.match(html, /data-m='"draw:00000"'>Keep all<\/button>/);
  V.actions.pokmark({ dataset: { k: '1' } }); V.actions.pokmark({ dataset: { k: '4' } });
  html = screen(mini, null, 'X');
  assert.deepEqual(cards(html).map(c => c.cls.includes('out')), [false, true, false, false, true]);
  assert.match(html, /data-m='"draw:01001"'>Draw 2<\/button>/);
  V.actions.pokmark({ dataset: { k: '1' } });                        // tapped again: kept
  assert.match(screen(mini, null, 'X'), /data-m='"draw:00001"'>Draw 1<\/button>/);
  // the other side's turn, or a move playing: nothing to tap
  assert.equal(cards(screen(mini, null, 'X', { locked: true })).filter(c => c.tag === 'button').length, 0);
  // someone else's marks replayed: card by card, then the move
  assert.deepEqual(V.replay.synth('draw:01001', mini), [[300, 'pokmark', 'k=1'], [620, 'pokmark', 'k=4'], [1190, 'move', 'm="draw:01001"']]);
  assert.equal(/pokmark: null/.test(fs.readFileSync(new URL('../../src/audio/sound.js', import.meta.url), 'utf8')), true, 'a mark plays the card\'s own sound, never the interface\'s click');
});

test('a deal flies five cards from the deck, each turning up as it comes; a draw sends the thrown cards to the muck and brings new ones; then the payoff', () => {
  const mini = fresh();
  let res = E.applyMove(mini, 'X', 'deal', E.makeRng('d2')), f = flashOf(mini, 'X', 'deal', res), html = screen(mini, f, 'X', { locked: true });
  const dealt = [...html.matchAll(/class="plc[^"]* slide flip[^"]*" style="--d:(\d+)ms;--f:(\d+)ms" data-cf="deck" data-cfat="(\d+)"/g)].map(m => m.slice(1).map(Number));
  assert.deepEqual(dealt, [0, 1, 2, 3, 4].map(k => [k * R.POK.deal, k * R.POK.deal + R.POK.turn, k * R.POK.deal]));
  assert.match(html, /class="pokdeck" data-anchor="deck"><span class="pokstk">/, 'the deck: a stack');
  assert.ok(R.flashMs({ poker: f.poker }) >= 4 * R.POK.deal + R.POK.turn + 300, 'the deal lasts until the last card has turned');
  // a made hand kept: a pair of kings out of K K 7 4 2
  mini.cur = { by: 'X', hand: ['KS', '7D', 'KH', '4C', '2S'] }; mini.score.X = 3;
  res = E.applyMove(mini, 'X', 'draw:00000', E.makeRng('k')); f = flashOf(mini, 'X', 'draw:00000', res); html = screen(mini, f, 'O', { locked: true });
  const say = R.pokTimes(f.poker).say;
  const cs = cards(html);
  assert.deepEqual(cs.map(c => c.cls.includes('win')), [true, false, true, false, false], 'the kings are ringed');
  assert.deepEqual(cs.map(c => c.cls.includes('dull')), [false, true, false, true, true], 'the rest dimmed');
  assert.deepEqual(cs.filter(c => c.cls.includes('win')).map(c => /--t:(\d+)ms/.exec(c.attrs)[1]).map(Number), [say, say + 60], 'hopping one after the other as the name shows');
  assert.match(html, new RegExp(`class="arcres pokres ok appear" style="--t:${say}ms" role="status"><span class="pokname">Pair</span><span class="pokpts X">\\+1</span>`));
  assert.match(html, new RegExp(`<i class="on fillin" style="--t:${say}ms"></i>`), 'the total\'s new pip fills as the name shows');
  assert.equal((html.match(/class="on/g) || []).length, 4);
  // a draw of two: the thrown cards fly to the muck, the new ones from the deck into their places
  mini.cur = { by: 'O', hand: ['KS', '7D', 'KH', '4C', '2S'] };
  res = E.applyMove(mini, 'O', 'draw:01010', E.makeRng('k2')); f = flashOf(mini, 'O', 'draw:01010', res); html = screen(mini, f, 'X', { locked: true });
  assert.equal((html.match(/data-cf="pk:[13]" data-cfat="0" data-cfwait="" data-cfgo=""/g) || []).length, 2, 'the two thrown cards go from their places');
  assert.deepEqual([...html.matchAll(/data-cf="deck" data-cfat="(\d+)"/g)].map(m => Number(m[1])), [R.POK.out, R.POK.out + R.POK.deal]);
  assert.deepEqual(cards(html).map(c => c.cls.includes('new')), [false, true, false, true, false]);
  // nothing: said so, nothing ringed or dimmed
  mini.cur = { by: 'X', hand: ['KS', '7D', 'QH', '4C', '2S'] };
  res = E.applyMove(mini, 'X', 'draw:00000', E.makeRng('k3')); f = flashOf(mini, 'X', 'draw:00000', res); html = screen(mini, f, 'O', { locked: true });
  assert.match(html, /class="arcres pokres no appear"[^>]*><span class="pokname">Nothing<\/span><small class="poknil"> · no points<\/small>/);
  assert.ok(!cards(html).some(c => c.cls.includes('win') || c.cls.includes('dull')));
  // looked back at: the last hand scored, lit without a hop
  mini.cur = { by: 'O', hand: ['3H', '9H', 'JH', 'KH', 'AH'] };
  res = E.applyMove(mini, 'O', 'draw:00000', E.makeRng('k4')); html = screen(mini, null, 'X', { view: true });
  assert.equal(cards(html).filter(c => c.cls.includes('win') && !c.cls.includes('late')).length, 5);
  assert.match(html, /class="arcres pokres ok"><span class="pokname">Flush<\/span><span class="pokpts O">\+5<\/span>/);
  assert.ok(!/<button/.test(html.replace(/<div class="ctals">.*?<\/div><div class="pok/, '')), 'no button on a square looked back at');
});

test('the sounds: a slide and a turn for every card that comes, the hand\'s own sound as its name shows', () => {
  const snd = f => { const out = []; V.sounds({ poker: f }, (n, ms) => out.push([n, ms]), false, {}, null); return out; };
  const deal = snd({ kind: 'deal', hand: ['KS', '7D', 'KH', '4C', '2S'] });
  assert.equal(deal.filter(s => s[0] === 'cardSlide').length, 5); assert.equal(deal.filter(s => s[0] === 'cardFlip').length, 5);
  const d = { kind: 'draw', thrown: [0, 1, 0, 1, 0], pts: 1, rank: 'pair' }, say = R.pokTimes(d).say;
  assert.deepEqual(snd(d).pop(), ['ding', say]);
  assert.equal(snd(d).filter(s => s[0] === 'cardSlide').length, 3, 'the thrown cards\' slide, then one for each new card');
  assert.deepEqual(snd({ kind: 'draw', thrown: [0, 0, 0, 0, 0], pts: 5, rank: 'flush' }), [['sparkle', R.pokTimes({ kind: 'draw', thrown: [0, 0, 0, 0, 0] }).say]]);
  assert.deepEqual(snd({ kind: 'draw', thrown: [0, 0, 0, 0, 0], pts: 0, rank: 'none' }).map(s => s[0]), ['nopair', 'thud']);
});
