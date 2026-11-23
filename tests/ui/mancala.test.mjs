// Mancala Race's screen (ui: games/mancala/view.js), rendered in Node with the browser's names stubbed. The end by an
// empty side plays from the move's flash alone (rules.js mancTimes): the swept pits keep their seeds until the sweep's
// hand (in their side's colour) takes them, pit by pit; the seeds pour into their bank; both banks count up from 0 at
// one pace; the winner's bank is ringed and the verdict lands in the reserved line; every moment and sound of it, and
// the won chime, inside flashMs. A move that does not end the square draws as it did.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const R = await import('../../src/games/mancala/rules.js');
const V = await import('../../src/games/mancala/view.js');
const { state } = await import('../../src/ui/app.js');

const count = (html, re) => (html.match(re) || []).length;
// A square after one move by `p` from pit `pit`, with the move's flash as the page holds it.
function played(X, O, bx, bo, p, pit) {
  const mini = { type: 'mancala', v: 2, pits: { X: X.slice(), O: O.slice() }, bank: { X: bx, O: bo }, last: null };
  const r = E.applyMove(mini, p, pit, E.makeRng('u'));
  assert.ok(r.ok, r.reason);
  const flash = { by: p, type: 'mancala', kind: r.outcome === 'win' ? 'claim' : r.outcome === 'draw' ? 'draw' : r.again ? 'again' : 'move' };
  if (r.outcome === 'win') flash.winner = r.winner || p;
  R.moveFlash(pit, p, null, null, mini, flash);
  return { mini, flash, r };
}
const draw = (mini, o = {}) => {
  Object.assign(state, { screen: 'mini', zoom: 4, flash: o.a || null, done: null, online: null, cpu: null, setup: Object.assign({}, state.setup, { names: { X: 'Ann', O: 'Bea' } }) });
  return V.screen(4, o.a || null, o.d || null, mini, !!o.view, !!o.locked, o.a || null, null, false, null, false, o.turn || 'X');
};
const cell = (html, key) => { const at = html.indexOf(`data-mcp="${key}"`); assert.ok(at > 0, key); const from = html.lastIndexOf('<', at), to = html.indexOf(key.endsWith('bank') ? '</div>' : (html.slice(from, at).startsWith('<button') ? '</button>' : '</div>'), at); return html.slice(from, to); };
const sumOf = a => a.reduce((s, v) => s + v, 0);

test('Mancala: the end by an empty side: the swept pits keep their seeds until the hand takes them, the seeds pour into their bank, both banks count from 0, the verdict last', () => {
  const { mini, flash } = played([0, 0, 0, 0, 0, 1], [1, 2, 0, 0, 3, 1], 3, 2, 'X', 5), l = flash.mc, T = R.mancTimes(l);
  assert.deepEqual([flash.kind, flash.winner, l.fin, T.side, T.ks], ['claim', 'O', { X: 4, O: 9 }, 'O', [0, 1, 4, 5]]);
  const html = draw(mini, { a: flash, locked: true });
  assert.ok(!/undefined|NaN|\[object/.test(html)); assert.equal(count(html, /<button/g), 0, 'nothing to tap while it plays');
  T.ks.forEach((i, k) => {                                       // each swept pit: its seeds and its number, gone as the hand takes them
    const c = cell(html, 'O:' + i), v = l.sw.O[i];
    assert.equal(count(c, new RegExp(`class="mcs gone" style="[^"]*--u:${T.scoop[k]}ms"`, 'g')), v, `pit ${i}: its ${v} seeds go at ${T.scoop[k]}`);
    assert.ok(c.includes(`<b class="mcn out" style="--u:${T.scoop[k]}ms">${v}</b>`), `pit ${i}: its number with them`);
  });
  assert.ok(cell(html, 'O:2').includes('<b class="mcn"></b>') && cell(html, 'X:5').includes('<b class="mcn"></b>'), 'the empty pits stay empty');
  const hands = html.match(/<span class="mchand[^"]*"[^>]*>.*?<\/span>/g) || [];
  assert.deepEqual(hands.map(h => h.match(/class="(mchand[^"]*)"/)[1]), ['mchand X', 'mchand mcsw O'], 'the sowing\'s hand, then the sweep\'s in the colour of the side it sweeps');
  const sw = hands[1];
  assert.equal(count(sw, /class="mcj"/g), 7); assert.equal(count(sw, new RegExp(`--u:${T.drop}ms`, 'g')), 7, 'the seeds leave the hand as they pour into the bank');
  assert.deepEqual((sw.match(/--t:(\d+)ms/g) || []).map(x => Number(x.slice(4, -2))), [T.scoop[0], T.scoop[1], T.scoop[1], T.scoop[2], T.scoop[2], T.scoop[2], T.scoop[3]], 'each joins the hand at its pit\'s scoop');
  const bo = cell(html, 'O:bank'), bx = cell(html, 'X:bank');
  assert.equal(count(bo, /class="mcs"/g), 2); assert.equal(count(bo, new RegExp(`class="mcs appear" style="[^"]*--t:${T.drop}ms"`, 'g')), 7, 'the bank\'s own two, then the seven poured in');
  assert.ok(bo.includes(`<i class="mcq a" style="--u:${T.count}ms">2</i>`), 'its number as the move left it until the count');
  assert.ok(bo.includes(`<i class="mcq b" style="--t:${T.count}ms;--d:1120ms"><b class="cnt" data-from="0" data-delay="${T.count}" data-ms="1000">9</b></i>`), 'then counted from 0, the higher over MANC.count');
  assert.ok(bx.includes(`data-from="3" data-delay="${R.MANC.lift + R.MANC.sow}"`) && bx.includes(`<b class="cnt" data-from="0" data-delay="${T.count}" data-ms="${Math.round(1000 * 4 / 9)}">4</b>`), 'the mover\'s bank counts its sowing on, then joins the count at its own share of the time');
  assert.ok(/class="mcbank O gain top"/.test(bo) && bo.includes(`--w:${T.say}ms`) && !/top/.test(bx.slice(0, 60)), 'the winner\'s bank ringed with the verdict');
  assert.ok(html.includes(`<span class="mcl1" aria-hidden="true" style="--t:${T.sow}ms;--u:${T.say}ms">Out of seeds!</span>`));
  assert.ok(html.includes(`<span class="mcl2" style="--t:${T.say}ms"><b class="O hn">Bea</b> wins 9–4</span>`), 'the verdict: the winner and the count');
  assert.equal(count(html, /data-delay="\d+"[^>]*>\d+<\/b><small>/g), 2, 'both tallies');
  assert.ok(html.includes(`<b class="cnt" data-from="2" data-delay="${T.say}">9</b>`) && html.includes(`<b class="cnt" data-from="3" data-delay="${T.say}">4</b>`), 'the tallies settle with the verdict');
  const after = draw(mini, { locked: true });                    // (the result held: the board as the move left it)
  assert.equal(count(after, /class="mcs/g), 13); assert.ok(!after.includes('mchand') && !after.includes('mcq'));
});

test('Mancala: a capture that takes the other side\'s last seeds: the mover\'s own are swept into its bank; the line says the capture, then the verdict', () => {
  const { mini, flash } = played([1, 0, 2, 0], [0, 0, 4, 0], 2, 3, 'X', 0), l = flash.mc, T = R.mancTimes(l);
  assert.deepEqual([flash.winner, l.fin, T.side, T.ks, l.cap], ['X', { X: 9, O: 3 }, 'X', [2], { i: 1, n: 5 }]);
  const html = draw(mini, { a: flash, locked: true });
  assert.ok(/<span class="mchand mcsw X"/.test(html));
  assert.ok(html.includes(`<span class="mcl1 ok" aria-hidden="true" style="--t:${T.sow}ms;--u:${T.say}ms">Captured 5!</span>`));
  assert.ok(html.includes('<b class="X hn">Ann</b> wins 9–3'));
  const bx = cell(html, 'X:bank');                               // 2 there; 5 from the capture; 2 swept
  assert.equal(count(bx, /class="mcs"/g), 2);
  const cap = R.MANC.lift + R.MANC.sow + R.MANC.cap - 120;
  assert.equal(count(bx, new RegExp(`--t:${cap}ms`, 'g')), 5 + 1, 'the capture lands (and the bank pulses with it)');
  assert.equal(count(bx, new RegExp(`class="mcs appear" style="[^"]*--t:${T.drop}ms"`, 'g')), 2);
  assert.ok(bx.includes(`<i class="mcq a" style="--u:${T.count}ms"><b class="cnt" data-from="2" data-delay="${cap}" data-ms="${R.MANC.cap}">7</b></i>`));
});

test('Mancala: level banks: a draw, said with the count; no bank ringed', async () => {
  const { mini, flash, r } = played([0, 0, 0, 1], [1, 0, 0, 0], 3, 3, 'X', 3), T = R.mancTimes(flash.mc);
  assert.deepEqual([r.outcome, flash.kind, flash.mc.fin], ['draw', 'draw', { X: 4, O: 4 }]);
  const html = draw(mini, { a: flash, locked: true });
  assert.ok(html.includes(`<span class="mcl2 lvl" style="--t:${T.say}ms">Level 4–4: a draw</span>`));
  assert.ok(!/class="mcbank [XO][^"]*top/.test(html));
  assert.deepEqual(T.cms, { X: 1000, O: 1000 }, 'both count the whole time');
  const { moveSounds } = await import('../../src/audio/sound.js'), { GAMES } = await import('../../src/games/index.js');
  GAMES.mancala.view = V;   // (the page registers the views in main.js; here by hand)
  const reset = moveSounds(flash).filter(x => x[0] === 'reset');
  assert.deepEqual(reset.map(x => x[1]), [T.say], 'the square\'s reset sound with the verdict, never during the sowing');
});

test('Mancala: "You" wins in the first person; a square found already over (no deal makes one) counts up with no sowing', () => {
  const { mini, flash } = played([0, 0, 0, 1], [2, 1, 0, 3], 4, 4, 'X', 3);
  Object.assign(state, { setup: Object.assign({}, state.setup, { names: { X: 'Ann', O: 'You' } }) });
  const html = V.screen(4, flash, null, mini, false, true, flash, null, false, null, false, 'X');
  assert.ok(html.includes('<b class="O hn">You</b> win 10–5'));
  const odd = { type: 'mancala', v: 2, pits: { X: [0, 0, 0, 0], O: [2, 0, 1, 0] }, bank: { X: 4, O: 2 }, last: null };
  const r = E.applyMove(odd, 'O', 'end', E.makeRng('x')), f = { by: 'O', type: 'mancala', kind: 'claim', winner: r.winner };
  R.moveFlash('end', 'O', null, null, odd, f);
  const T = R.mancTimes(f.mc), h2 = draw(odd, { a: f, locked: true });
  assert.equal(T.sow, 0); assert.ok(T.scoop[0] === R.MANC.beat && h2.includes('mchand mcsw O') && !h2.includes('mchand O"') && h2.includes('Out of seeds!'));
  assert.equal(V.moveText(f, 'Bea'), 'Out of seeds');
});

test('Mancala: a move that does not end the square draws as it did (no sweep, no count); a win by the target never says go again', () => {
  const m = E.newMini('mancala', E.makeRng('v')), live = draw(m, { turn: 'X' });
  assert.equal(count(live, /<button class="mcp X can"/g), 6); assert.ok(!live.includes('mchand') && !live.includes('mcq') && !/mcl[12]/.test(live));
  const { mini, flash } = played(m.pits.X, m.pits.O, 0, 0, 'X', 0), html = draw(mini, { a: flash, locked: true });
  assert.equal(flash.kind, 'move'); assert.ok(!html.includes('mcsw') && !html.includes('mcq') && !/mcl[12]/.test(html), 'no sweep, no count, no verdict');
  const win = played([0, 0, 0, 1], [3, 3, 3, 3], 9, 0, 'X', 3), wh = draw(win.mini, { a: win.flash, locked: true });
  assert.equal(win.flash.kind, 'claim'); assert.ok(!wh.includes('go again') && wh.includes('<p class="mcline"></p>'), 'its line stays clear (the header says who won)');
  const again = played([0, 0, 2, 1], [2, 0, 3, 3], 0, 0, 'X', 3), ah = draw(again.mini, { a: again.flash, locked: true });
  assert.equal(again.flash.kind, 'again'); assert.ok(ah.includes('In the bank: go again'));
});

test('Mancala: the sweep\'s sounds come from its moments, every one inside flashMs; the count clicks thinned and climbing; the won chime with the verdict', () => {
  const { flash } = played([0, 0, 0, 0, 0, 1], [1, 2, 0, 0, 3, 1], 3, 2, 'X', 5), T = R.mancTimes(flash.mc), out = [];
  V.sounds(flash, (n, ms, rate) => out.push([n, ms, rate]));
  const ms = R.flashMs(flash, 4, true);
  assert.ok(out.every(([, t]) => t >= 0 && t <= ms), 'all inside the move\'s time');
  assert.deepEqual(out.filter(([n, t]) => n === 'mcScoop' && t >= T.scoop[0]).map(x => x[1]), T.scoop, 'a scoop as the hand takes each pit');
  const drop = out.filter(([n, t]) => n === 'mcClick' && t >= T.drop && t < T.count);
  assert.equal(drop.length, 6, 'the seeds clicking into the bank (six at most)');
  const ticks = out.filter(([n, t]) => n === 'mcClick' && t >= T.count);
  assert.ok(ticks.length >= 6 && ticks.every(([, t], k) => !k || t - ticks[k - 1][1] >= 45), 'the count: a click a number, never closer than 45 ms');
  assert.ok(ticks[ticks.length - 1][1] < T.say && ticks[ticks.length - 1][2] > ticks[0][2], 'done before the verdict, climbing in pitch');
  assert.equal(V.wonAt(flash, ms), T.say, 'the square\'s chime with the verdict');
  const plain = played([1, 1, 1, 1, 1, 1], [1, 1, 1, 1, 1, 1], 0, 0, 'X', 0).flash;
  assert.equal(V.wonAt(plain, 1000), 400, 'any other move: the usual moment');
  assert.ok(sumOf(flash.mc.sw.O) === 7 && ms >= T.say + R.MANC.hold);
});
