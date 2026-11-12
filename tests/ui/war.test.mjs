// War's screen and miniature (src/games/war/view.js), rendered in Node with the browser's names stubbed: a fresh table,
// a move playing card by card from its flash (the cards from their decks, turned together, "War!" at a tie, the winner
// ringed at the verdict, a token to each pip), the table after it, and an opponent's replay showing the opponent's cards, never the viewer's own last
// flip (CLAUDE.md: what a replay animates comes from the recorded flash). Nothing of the decks ever reaches the markup.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
Object.defineProperty(globalThis, 'window', { value: new Proxy(function () {}, { get: (t, k) => (k === 'matchMedia' ? () => ({ matches: false, addEventListener() {}, addListener() {} }) : k === Symbol.toPrimitive ? () => '' : stub()), apply: () => stub(), construct: () => stub(), set: () => true }), configurable: true, writable: true });   // (no reduced motion here: the move's moments are what is tested)
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const R = require('../../src/games/war/rules.js');
const { GAMES } = await import('../../src/games/index.js');
const V = await import('../../src/games/war/view.js');
const { hideMini } = await import('../../src/core/records.js');
const { state } = await import('../../src/ui/app.js');
state.setup = Object.assign({}, state.setup, { names: { X: 'Xena', O: 'Olaf' } });

const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const clone = v => JSON.parse(JSON.stringify(v));
const DOWN = ['2D', '3D', '4D', '5D', '6D', '7D'];
const rig = (m, p, ...top) => { m.deck[p] = ['2C', '3C', '4C', '5C', '6C', '7C', '8C', '9C', 'TC', 'JC', 'QC', 'KC'].concat(top.slice().reverse()); };
// A move made on a copy of the mini: the square after it and the move's flash (what a replay carries).
function play(mini, p, ...top) {
  const m = clone(mini); rig(m, p, ...top);
  const res = E.applyMove(m, p, 'flip', lcg(1));
  assert.equal(res.ok, true);
  const flash = { kind: res.outcome === 'win' ? 'claim' : 'move', by: p, next: p, square: 0, type: 'war', note: res.note || null, pass: null, timeout: false };
  GAMES.war.rules.moveFlash('flip', p, null, 0, m, flash);
  return { mini: m, flash };
}
const screen = (mini, flash, turn, o = {}) => V.screen({ owner: null, mini }, flash, o.d || null, mini, !!o.view, !!flash || !!o.view, flash, null, false, () => -1, false, turn, '');
const count = (html, re) => (html.match(re) || []).length;

test('a fresh table: an empty slot on each side\'s mat, a deck each, the Flip button in the mover\'s colour, empty pips; nothing of the decks', () => {
  const m = E.newMini('war', E.makeRng('w-ui'));
  const html = screen(m, null, 'X');
  assert.equal(count(html, /class="wrc wrempty"/g), 2);
  assert.equal(count(html, /class="wrdeck" data-anchor="deck:[dp]"/g), 2, 'the two decks the cards fly from');
  assert.match(html, /class="g-war pc-X"/); assert.match(html, /<button class="big X" data-act="move" data-m='"flip"'>Flip<\/button>/);
  assert.match(html, /class="wrlab wrwho X"/, 'whose side of the felt it is');
  assert.doesNotMatch(html, /wrres/, 'no verdict yet: the emblem alone'); assert.match(html, /class="wremb"/);
  assert.equal(count(html, /<i class="on"/g), 0); assert.equal(count(html, /<i class=""/g), 6, 'three pips each');
  for (const c of m.deck.X.slice(-6)) assert.doesNotMatch(html, new RegExp(c));
  assert.doesNotMatch(html, /undefined|NaN/);
  const v = screen(m, null, 'X', { view: true });
  assert.doesNotMatch(v, /<button/);
  assert.match(screen(m, null, 'O'), /class="g-war pc-O"[\s\S]*<button class="big O"/);
});

test('a move plays from its flash: the two cards fly from their decks and turn together, "War!" at the tie with what it is worth, the down cards, the winner ringed and the loser dimmed at the verdict, a token to each pip', () => {
  const m0 = E.newMini('war', E.makeRng('w-ui2')), x = play(m0, 'X', 'QD', 'QC', ...DOWN, '9S', '5H');
  const plan = R.warPlan(x.flash.war), html = screen(x.mini, x.flash, 'X');
  const b0 = plan.battles[0], b1 = plan.battles[1];
  assert.match(html, new RegExp(`aria-label="Queen of diamonds"`)); assert.match(html, /Queen of clubs/); assert.match(html, /9 of spades/); assert.match(html, /5 of hearts/);
  assert.equal(b0.pFlip, b0.dFlip, 'the pair turns together');
  assert.ok(html.includes(`--d:0ms;--f:${b0.pFlip}ms" data-cf="deck:p" data-cfat="0"`), 'the player\'s first card leaves its deck at once');
  assert.ok(html.includes(`--d:${b0.dAt}ms;--f:${b0.dFlip}ms" data-cf="deck:d" data-cfat="${b0.dAt}"`), 'the dealer\'s after the gap, from the dealer\'s deck');
  assert.ok(html.includes(`--d:${b1.pAt}ms;--f:${b1.pFlip}ms`) && html.includes(`--d:${b1.dAt}ms;--f:${b1.dFlip}ms`), 'the second pair after the war');
  assert.equal(count(html, /plc down slide wrdn/g), 6, 'three down each side');
  for (let i = 0; i < 3; i++) assert.ok(html.includes(`style="--d:${b0.downAt + i * R.WART.down}ms"`), `down card ${i} in its turn`);
  // the clash once both are up, then the verdict: the tied pair shakes, the last pair's winner is ringed and its loser dims
  assert.equal(count(html, new RegExp(`class="wrc wrtie go wrsh" style="--c:${b0.up}ms;--t:${b0.judge}ms;--sh:0\\.690"`, 'g')), 2, 'the tied pair lands mid-mat like any pair and steps aside for the pile at "War!"');
  assert.equal(count(html, new RegExp(`class="wrc wrwon go" style="--c:${b1.up}ms;--t:${b1.judge}ms"`, 'g')), 1);
  assert.equal(count(html, new RegExp(`class="wrc wrlost go" style="--c:${b1.up}ms;--t:${b1.judge}ms"`, 'g')), 1);
  const [dealer, player] = html.split('class="wrrow wrplayer"');
  assert.match(player, /wrc wrwon go[^>]*>[^]*?9 of spades/); assert.match(dealer, /wrc wrlost go[^>]*>[^]*?5 of hearts/);
  assert.match(html, new RegExp(`<div class="wrres war" style="--f:${b0.judge}ms;--u:${b1.judge}ms" role="status"><span>War!</span><span class="wrstake" aria-label="worth 2"><i></i><i></i></span></div>`));
  assert.match(html, new RegExp(`class="wrres ok X appear" style="--t:${plan.end}ms" role="status">.*War won! \\+2`));
  // the pips: each fills as its token, flown from the verdict, lands
  const pips = R.warPips(plan.end, 2);
  pips.forEach(t => {
    assert.equal(count(html, new RegExp(`<i class="on fillin" style="--t:${t}ms"></i><span class="wrtok X" data-cf="wr:res" data-cfat="${t - R.WART.tok}" data-cfgo="" data-cfd="${R.WART.tok}"></span>`, 'g')), 1);
  });
  assert.match(html, /class="wrsrc" data-anchor="wr:res"/);
  assert.match(html, /wrcards" style="--ov:0\.450"/, 'a war\'s cards lie as a pile');
  assert.match(html, /<button class="big chosen X" data-act="move"[^>]* disabled>Flip/, 'the button stays as pressed while the round plays');
  assert.doesNotMatch(html, /undefined|NaN/);
  // a plain loss: the dealer's round (its card ringed, the player's dimmed), no pip, no face on the verdict
  const o = play(x.mini, 'O', '3S', 'AH'), h2 = screen(o.mini, o.flash, 'O');
  assert.match(h2, /class="wrres no appear"[^>]*><span>Dealer's round/); assert.doesNotMatch(h2, /fillin|wrtok/); assert.doesNotMatch(h2, /War!/);
  assert.equal(count(h2, /plc(?: red)? slide flip/g), 2, 'two cards'); assert.doesNotMatch(h2, /wrsh|--ov/, 'a plain round: nothing aside');
  const [d2, p2] = h2.split('class="wrrow wrplayer"');
  assert.match(d2, /wrc wrwon go[^>]*>[^]*?Ace of hearts/); assert.match(p2, /wrc wrlost go[^>]*>[^]*?3 of spades/);
  // the words and sounds of the move
  assert.equal(V.moveText(x.flash, 'Xena'), 'Xena won the war'); assert.equal(V.moveText(o.flash, 'Olaf'), "Olaf: the dealer's round");
  const got = []; V.sounds(x.flash, (n, t) => got.push([n, t]), false, x.mini, null);
  assert.deepEqual(got.filter(s => s[0] === 'warDrum'), [['warDrum', b0.judge]]);
  assert.deepEqual(got.filter(s => s[0] === 'point'), [['point', plan.end]], 'the verdict');
  assert.deepEqual(got.filter(s => s[0] === 'ding'), pips.map(t => ['ding', t]), 'a ding as each pip lands');
  assert.equal(got.filter(s => s[0] === 'cardSlide').length, 4 + 3, 'a slide for each card, and for each pair of down cards'); assert.equal(got.filter(s => s[0] === 'cardFlip').length, 2, 'one turn a pair');
  const lost = []; V.sounds(o.flash, (n, t) => lost.push(n), false, o.mini, null);
  assert.deepEqual(lost, ['cardSlide', 'cardSlide', 'cardFlip', 'nopair', 'thud']);
  assert.ok(got.every(s => s[1] <= R.flashMs(x.flash, 0, false)), 'every sound within the move');
});

test('after the move the table keeps the round\'s cards face up, still, the winner ringed; a held result says the verdict; the next flip sweeps them off', () => {
  const m0 = E.newMini('war', E.makeRng('w-ui3')), x = play(m0, 'X', 'KH', '7S');
  const html = screen(x.mini, null, 'O');
  assert.match(html, /King of hearts/); assert.match(html, /7 of spades/); assert.doesNotMatch(html, /--d:|--f:|--t:|fillin|appear|wrtok|data-cf=| go"/);
  assert.match(html, /class="wrc wrwon">[^]*?King of hearts/); assert.match(html, /class="wrc wrlost">[^]*?7 of spades/);
  assert.match(html, /class="g-war pc-X"/); assert.match(html, /class="wrlab wrwho X"/, 'whose cards they are');
  assert.match(html, /<button class="big O" data-act="move"/, 'the button is the next mover\'s');
  assert.doesNotMatch(html, /wrres/);
  assert.equal(count(html, /<i class="on"/g), 1);
  const held = screen(x.mini, null, 'X', { d: { kind: 'move', by: 'X' } });
  assert.match(held, /wrres ok X".*Round won! \+1/);
  // the next flip (the table above was the last one drawn at rest): the old round swept off, never read by a screen reader
  const o = play(x.mini, 'O', '4C', 'JD'), next = screen(o.mini, o.flash, 'O');
  assert.equal(count(next, /class="wrcards wrgone" aria-hidden="true"/g), 2);
  assert.match(next, /wrgone[^]*?King of hearts/); assert.match(next, /4 of clubs/);
  // with "Go again on success" on, the held turn is named in the header
  assert.equal(V.heldSub(x.mini, 'X', null, null), '<b class="X">Xena</b> won the round · flips again'); assert.equal(V.heldSub(x.mini, 'X', x.flash, x.flash), '');
});

test('an opponent\'s replay shows the opponent\'s cards and verdict, never the viewer\'s own last flip', () => {
  const m0 = E.newMini('war', E.makeRng('w-ui4')), x = play(m0, 'X', 'KH', '7S'), o = play(x.mini, 'O', '4C', 'JD');
  screen(m0, null, 'O');   // (nothing drawn at rest for this square: nothing to sweep)
  const html = screen(x.mini, o.flash, 'O');   // the square as X left it (X's king), O's recorded move playing
  assert.match(html, /4 of clubs/); assert.match(html, /Jack of diamonds/);
  assert.doesNotMatch(html, /King of hearts|7 of spades/);
  assert.match(html, /Dealer's round/); assert.match(html, /class="g-war pc-O"/); assert.match(html, /class="wrlab wrwho O"/);
});

test('the miniature: the last flip\'s two cards face to face (the player\'s ringed in their colour) and the pips; the same from the hidden square', () => {
  const m0 = E.newMini('war', E.makeRng('w-ui5'));
  const fresh = V.miniature(m0, false);
  assert.equal(count(fresh, /tcd cdb/g), 2, 'two backs before any flip'); assert.match(fresh, /class="twar"/);
  const x = play(m0, 'X', 'QD', 'QC', ...DOWN, '9S', '5H');
  const html = V.miniature(x.mini, false);
  assert.match(html, /<i class="tcd X suS"><b>9<\/b>/); assert.match(html, /<i class="tcd red suH"><b>5<\/b>/);   // (su<S|H|D|C>: the four-colour deck)
  assert.doesNotMatch(html, /<b>Q<\/b>/, 'the last pair alone');
  assert.equal(count(html, /<i class=" on">/g), 2);
  const hidden = clone(x.mini); hideMini(hidden, 0, state);
  assert.equal(hidden.deck, undefined); assert.equal(V.miniature(hidden, false), html);
  for (const c of x.mini.deck.X.slice(-4)) assert.doesNotMatch(html, new RegExp(`<b>${c[0]}</b><svg[^>]*><path d="${c[1] === 'S' ? 'M12 2.2' : 'zzz'}`));
});
