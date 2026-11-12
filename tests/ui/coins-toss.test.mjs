// Coin Flip on the page, the polish pass: a flip is a toss the markup spells out for the stylesheet. Every coin has its
// drawn side; a coin in the air has both (the side it lands on in front, the other behind, the mystery coin's question
// mark over the back), starts on the side it showed (--r0: whole turns when it lands as it was, a half more when it
// changes) and bursts when it changes sides; the toss comes from the move being played (its flash: flipped, was,
// results), never the square's last flip; each tally's pip fills or empties as the coin that changed it lands; the
// clinks fall on the landings and the move's time covers the last coin's bounce. Rendered in Node, the browser stubbed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const { state } = await import('../../src/ui/app.js');
const V = await import('../../src/games/coins/view.js');
const R = await import('../../src/games/coins/rules.js');
state.setup = Object.assign({}, state.setup, { names: { X: 'Xena', O: 'Olaf' } });

const seq = (...vals) => { let i = 0; return () => vals[i++ % vals.length]; };
const clone = v => JSON.parse(JSON.stringify(v));
// A flip by p on a copy of the square, its results drawn in order (0: X, 1: O): the square after and the move's flash.
function flip(mini, p, lands) {
  const m = clone(mini); m.marks = null;
  const theirs = m.coins.map((c, k) => (c !== p ? k : -1)).filter(k => k >= 0);
  assert.ok(theirs.length <= 3, 'three or fewer: every one of them turns, no pick to draw');
  const res = E.applyMove(m, p, 'flip', seq(...lands.map(v => (v === 'O' ? 0.75 : 0.25))));
  assert.equal(res.ok, true);
  const flash = { kind: res.outcome === 'win' ? 'claim' : 'move', by: p, next: p, square: 0, type: 'coins', note: res.note || null };
  R.moveFlash('flip', p, null, 0, m, flash);
  if (res.outcome === 'win') { m.winCells = res.cells; flash.winner = res.winner; }
  return { mini: m, flash, res };
}
const screen = (mini, flash, turn, owner) => V.screen({ owner: owner || null, mini }, flash, null, mini, false, true, flash, null, () => false, () => -1, !!(flash && flash.kind === 'claim'), turn, '');
const coins = html => [...html.matchAll(/<span class="(coin [^"]*)" style="([^"]*)"/g)].map(x => ({ cls: x[1].split(' '), st: x[2], }));
const tallies = html => ['X', 'O'].map(p => { const t = html.slice(html.indexOf(`class="ctal ${p}`)); return [...t.slice(0, t.indexOf('</div>')).matchAll(/<i class="([^"]*)"(?: style="--t:(\d+)ms")?>/g)].map(x => [x[1], x[2] ? Number(x[2]) : null]); });
const start = { type: 'coins', coins: ['O', 'X', '?', 'X', 'O'], last: null };

test('at rest: every coin its drawn side, the coins the next flip turns ringed in the mover\'s colour, a pip a coin in each tally', () => {
  const m = clone(start); m.marks = { by: 'X', coins: [0, 2, 4] };
  const html = screen(m, null, 'X'), cs = coins(html);
  assert.deepEqual(cs.map(c => c.cls[1]), ['O', 'X', 'm', 'X', 'O']);
  assert.deepEqual(cs.map(c => c.cls.includes('mkX')), [true, false, true, false, true]);
  assert.ok(cs.every(c => !c.cls.includes('flip')));
  assert.equal((html.match(/class="cf /g) || []).length, 5); assert.doesNotMatch(html, /class="cb /);
  assert.deepEqual(tallies(html).map(t => t.filter(p => p[0] === 'on').length), [2, 2]);
  assert.match(html, />Flip 3</); assert.doesNotMatch(html, /<b>[XO?]<\/b>/, 'no letters: drawn marks');
});

test('a toss: both sides on a coin in the air, from the side it showed to the side it landed on', () => {
  const { mini, flash } = flip(start, 'X', ['X', 'O', 'O']);         // coin 0: O to X; the mystery coin to O; coin 4 stays O
  assert.deepEqual([flash.flipped, flash.was, flash.results], [[0, 2, 4], ['O', '?', 'O'], ['X', 'O', 'O']]);
  const html = screen(mini, flash, 'X'), cs = coins(html);
  assert.deepEqual(cs.map(c => c.cls.includes('flip')), [true, false, true, false, true]);
  assert.ok(cs[0].cls.includes('byX') && cs[0].cls.includes('chg') && cs[0].cls.includes('X'));
  assert.match(cs[0].st, /--k:0;--r0:-1260deg/, 'changed sides: it starts on its other side');
  assert.ok(cs[2].cls.includes('chg') && /--k:1;--r0:-1260deg/.test(cs[2].st), 'the mystery coin: from its question mark');
  assert.ok(!cs[4].cls.includes('chg') && /--k:2;--r0:-1440deg/.test(cs[4].st), 'landed as it was: whole turns, no burst');
  const air = html.split('<span class="coin ').slice(1);
  assert.match(air[0], /class="cf X".*class="cb O"/s); assert.doesNotMatch(air[0], /class="cq/);
  assert.match(air[2], /class="cf O".*class="cb X".*class="cq m"/s);
  assert.doesNotMatch(air[1], /class="cb/);
});

test('the toss is the replayed move\'s own (its flash), not the square\'s last flip', () => {
  const x = flip(start, 'X', ['X', 'O', 'O']);                       // X's own flip is the square's last...
  const o = flip({ type: 'coins', coins: ['X', 'O', 'O', 'X', 'O'], last: null }, 'O', ['O', 'X']);   // ...and O's move replays: coins 0 and 3
  const shown = clone(o.mini); shown.last = clone(x.mini.last);      // (a square carrying the viewer's last)
  const cs = coins(screen(shown, o.flash, 'O'));
  assert.deepEqual(cs.map(c => c.cls.includes('flip')), [true, false, false, true, false], 'the coins O\'s move tossed');
  assert.ok(cs[0].cls.includes('byO') && cs[0].cls.includes('O') && cs[3].cls.includes('X'));
});

test('the tallies: a pip fills as the coin that won it lands, one empties as the coin that lost it lands', () => {
  const { mini, flash } = flip(start, 'X', ['X', 'O', 'O']);         // X: 2 to 3 (coin 0, down first); O: loses coin 0, wins the mystery coin (down second)
  const [x, o] = tallies(screen(mini, flash, 'X'));
  assert.deepEqual(x, [['on', null], ['on', null], ['on fillin', V.COIN_T.land], ['', null], ['', null]]);
  assert.deepEqual(o, [['on', null], ['on', null], ['', null], ['', null], ['', null]], 'one lost and one won in the same flip: the pip stays');
  const two = flip({ type: 'coins', coins: ['X', 'O', 'O', 'X', 'X'], last: null }, 'X', ['X', 'X']);
  const [x2, o2] = tallies(screen(two.mini, two.flash, 'X', 'X'));
  assert.deepEqual(x2.slice(3), [['on fillin', V.COIN_T.land], ['on fillin', V.COIN_T.land + V.COIN_T.gap]]);
  assert.deepEqual(o2.slice(0, 2), [[' cdrain', V.COIN_T.land + V.COIN_T.gap], [' cdrain', V.COIN_T.land]]);
  assert.match(screen(two.mini, two.flash, 'X', 'X'), /class="coins all" style="--w:\d+ms;"/, 'all one side: the row\'s wave once the last coin is down');
});

test('sounds and time: a clink on each landing; the move lasts to the last coin\'s bounce, a win to its wave', () => {
  for (const n of [1, 2, 3, 4]) {
    const got = []; V.sounds({ n }, (name, at) => got.push([name, at]), false);
    assert.deepEqual(got.filter(s => s[0] === 'clink').map(s => s[1]), Array.from({ length: n }, (_, k) => V.COIN_T.land + k * V.COIN_T.gap));
    assert.deepEqual(got[0], ['coinFlick', 0]);
    assert.ok(R.flashMs({ n }, 4, false) >= V.COIN_T.len + (n - 1) * V.COIN_T.gap, `${n} coins: the last one's bounce is in the move's time`);
    assert.ok(R.flashMs({ n }, 4, true) * 0.5 >= V.COIN_T.land + (n - 1) * V.COIN_T.gap, `${n} coins, a win: its chime (half way) not before the last coin is down`);
  }
});
