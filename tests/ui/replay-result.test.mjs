// An opponent's replay shows the mover's own result (src/games/*/view.js): the wheel, the die and the words of a spin
// or a roll come from the move being replayed (its recorded flash), never from the square's last result, which may be
// the viewer's own (a replay finds the square as it was before the move; a recap's square carries the other's last).
// Rendered in Node with the browser's names stubbed (no page needed).
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
const VIEWS = {};
for (const t of ['candy', 'bump', 'snakes', 'pig', 'rl', 'wheels', 'craps', 'apple']) VIEWS[t] = await import(`../../src/games/${t}/view.js`);
const { state } = await import('../../src/ui/app.js');
state.setup = Object.assign({}, state.setup, { names: { X: 'Xena', O: 'Olaf' } });

const fixed = v => () => v;
const seq = (...vals) => { let i = 0; return () => vals[i++ % vals.length]; };
const clone = v => JSON.parse(JSON.stringify(v));
// A move made on a copy of the mini: the square after it and the move's flash (what a replay carries).
function play(mini, p, move, rng) {
  const m = clone(mini), res = E.applyMove(m, p, move, rng);
  assert.equal(res.ok, true, `${mini.type}: ${move} refused (${res.reason})`);
  const flash = { kind: 'move', by: p, next: p, square: 0, type: m.type, note: res.note || null, pass: null, timeout: false };
  GAMES[m.type].rules.moveFlash(move, p, null, 0, m, flash);
  return { mini: m, flash };
}
// The screen of an opponent's replay on the viewer's phone (X): the square as it stood with X's own result as its
// last, the opponent's (O) recorded move playing.
const replay = (type, shown, flash) => VIEWS[type].screen({ owner: null, mini: shown }, flash, null, shown, false, true, flash, null, false, () => -1, false, 'O', '');

test('Candy Race: the wheel and the words are the opponent\'s spin, not the viewer\'s', () => {
  const m0 = E.newMini('candy', E.makeRng('cd')), x = play(m0, 'X', 1, fixed(0.1)), o = play(x.mini, 'O', 1, fixed(0.6));
  assert.notEqual(x.mini.last.color, o.flash.color);
  const k = ['red', 'yellow', 'green', 'blue'].indexOf(o.flash.color), html = replay('candy', x.mini, o.flash);
  assert.match(html, new RegExp(`Olaf</b> spun ${o.flash.color}`));
  assert.doesNotMatch(html, new RegExp(`spun ${x.mini.last.color}`));
  assert.ok(html.includes(`--to:${1080 + 360 - (k * 90 + 45)}deg`), 'the wheel stops on the opponent\'s colour');
});
test('Bump: the wheel and the words are the opponent\'s spin, not the viewer\'s', () => {
  const m0 = E.newMini('bump', E.makeRng('bp')), x = play(m0, 'X', 'spin', fixed(0.0)), o = play(x.mini, 'O', 'spin', fixed(0.99));
  assert.deepEqual([x.mini.last.spin, o.flash.spin], [1, 3]);
  const html = replay('bump', x.mini, o.flash);
  assert.match(html, /Olaf<\/b> spun 3/); assert.doesNotMatch(html, /spun 1\b/);
  assert.ok(html.includes(`--to:${720 + 360 - (2 * 120 + 60)}deg`), 'the wheel stops on the opponent\'s number');
});
test('Snakes and Ladders: the die and the words are the opponent\'s roll, not the viewer\'s', () => {
  const m0 = E.newMini('snakes', E.makeRng('sn')), x = play(m0, 'X', 'roll', fixed(0.0)), o = play(x.mini, 'O', 'roll', fixed(0.99));
  assert.deepEqual([x.mini.last.roll, o.flash.roll], [1, 6]);
  const html = replay('snakes', x.mini, o.flash);
  assert.match(html, /Olaf<\/b> rolled 6/); assert.doesNotMatch(html, /rolled 1\b/);
});
test('Risky Rolls: the die shows the opponent\'s roll, not the viewer\'s', () => {
  const m0 = E.newMini('pig', E.makeRng('pg')), x1 = play(m0, 'X', 'roll', fixed(0.0)), x = play(x1.mini, 'X', 'bank', fixed(0.5)), o = play(x.mini, 'O', 'roll', fixed(0.99));
  assert.deepEqual([x.mini.last.roll, o.flash.roll], [1, 8]);
  const html = replay('pig', x.mini, o.flash);
  assert.match(html, /Eight-sided die: 8"/); assert.doesNotMatch(html, /Eight-sided die: 1"/);
});
test('Roulette, Risky Spins, Craps: what they show comes from the opponent\'s recorded move', () => {
  const at = n => () => (E.RL.wheel.indexOf(n) + 0.5) / 25;
  const r0 = E.newMini('rl', E.makeRng('rl')), rx = play(r0, 'X', 'g2', at(13)), ro = play(rx.mini, 'O', 'zero', at(5));
  const rh = replay('rl', rx.mini, ro.flash);
  assert.match(rh, /Olaf<\/b>: green 0/); assert.doesNotMatch(rh, /Xena<\/b>:/); assert.match(rh, /<span>Miss<\/span>/, 'the result in a word');
  const w0 = E.newMini('wheels', E.makeRng('wh')), wx = play(w0, 'X', 'high', E.makeRng('a4')), wo = play(wx.mini, 'O', 'low', E.makeRng('b'));   // (X's skull passes the turn to O)
  const wh = replay('wheels', wx.mini, wo.flash);
  assert.equal(wo.flash.wheel.w, 'low');
  assert.match(wh, /class="rwheel low spun"/, 'the wheel the opponent spun'); assert.doesNotMatch(wh, /class="rwheel high spun"/, 'not the viewer\'s');
  // an old square with its three wheels: the opponent's spin of the medium one
  const o3 = { type: 'wheels', v: 2, target: 30, wheels: { high: w0.wheels.high, mid: [5, 6, E.SKULL, 4, 7, 5, 6, 4, E.SKULL, 5], low: w0.wheels.low }, pts: { X: 0, O: 0 }, spins: { X: 0, O: 0 }, turn: null, rest: { high: 0, mid: 0, low: 0 }, last: null };
  const m3 = play(o3, 'O', 'mid', fixed(0.05)), h3 = replay('wheels', o3, m3.flash);
  assert.equal(m3.flash.wheel.w, 'mid'); assert.match(h3, /class="rwheel mid spun"/); assert.equal((h3.match(/class="rwheel /g) || []).length, 3);
  const die = n => (n - 1) / 6 + 0.01, dice = (...pairs) => seq(...pairs.flatMap(([a, b]) => [die(a), die(b)]));
  const c0 = E.newMini('craps', E.makeRng('cr')), cx = play(c0, 'X', 'roll', dice([1, 1])), co = play(cx.mini, 'O', 'roll', dice([3, 4]));
  assert.deepEqual([cx.mini.last.result, co.flash.craps.result], ['lose', 'win']);
  const ch = replay('craps', cx.mini, co.flash);
  assert.doesNotMatch(ch, /Xena<\/b>: /);
});

test('Apple Pick: the spinner, the apples and the words are the opponent\'s spin, not the viewer\'s', () => {
  const land = (k, n = 10) => seq((k + 0.5) / n, 0.5);
  const m0 = E.newMini('apple', E.makeRng('ap')), x = play(m0, 'X', 'spin', land(1)), o = play(x.mini, 'O', 'spin', land(2));   // X picked 3; O spun the bird
  assert.deepEqual([x.mini.last.kind, o.flash.apple.kind, o.flash.apple.by], ['pick', 'bird', 'O']);
  const html = replay('apple', x.mini, o.flash);
  assert.match(html, /class="bird"/, 'the bird swoops'); assert.doesNotMatch(html, /class="apl [XO] drop"/, 'no apple drops: that was the viewer\'s');
  assert.match(html, /Bird! Nothing to take/); assert.doesNotMatch(html, /\+3 apples/);
  assert.ok(html.includes(`--end:${(1800 - o.flash.apple.at * 360).toFixed(1)}deg`), 'the wheel stops on the opponent\'s segment');
  assert.match(html, /--gx:178px;[^"]*--dir:-1/, 'the bird comes for the opponent\'s bucket (O\'s, on the right), not the viewer\'s');
});
test('Risky Rolls: the Bank button and the pot keep their points until the roll\'s points are in the pot, then take the new total (the move\'s own event times it); the buttons\' small lines stay as they were', () => {
  const m0 = E.newMini('pig', E.makeRng('bank')), first = play(m0, 'X', 'roll', fixed(0.2)), second = play(first.mini, 'X', 'roll', fixed(0.7));
  const r1 = first.flash.roll, r2 = second.flash.roll, pot = r1 + r2, T = VIEWS.pig.PIG_T;
  assert.ok(r1 !== r2);
  const render = (mini, a) => VIEWS.pig.screen({ owner: null, mini }, a, null, mini, false, false, a, null, false, () => -1, false, 'X', '');
  const btn = (html, cls) => (new RegExp(`<button class="big ${cls} rrb"[^>]*>(.*?)<small>(.*?)</small></button>`).exec(html) || []).slice(1);
  const bank = html => btn(html, 'bank')[0];
  const cnt = `<b class="cnt" data-from="${r1}" data-delay="${T.pot}" data-ms="${T.count}">${pot}</b>`;
  // a later roll: the old points show, counting up to the new total as the roll's points reach the pot (data-delay: after the tumble and the flight)
  const h2 = render(second.mini, second.flash);
  assert.ok(T.pot > T.land, 'the points reach the pot after the die has landed');
  assert.equal(bank(h2), `Bank ${cnt}`);
  assert.ok(h2.includes(`<div class="rrpot bump"><span>+${cnt}</span></div>`), 'the pot counts on at the same moment');
  assert.deepEqual([btn(h2, 'X')[1], btn(h2, 'bank')[1]], [`1 in 8 loses ${r1}`, `makes ${r1} of 51`], 'what a roll risks and what a bank makes: as before this roll, until it is over');
  assert.match(h2, new RegExp(`class="d3 d3octa roll v0" style="--dur:${T.land}ms"`), 'the die is thrown in and lands on the number at T.land');
  assert.match(h2, new RegExp(`<i class="d3t u k0 on"><svg[^>]*><path[^>]*/><text[^>]*>${r2}</text>`), 'the face towards the player is the number rolled');
  assert.ok(h2.includes(`<i class="on new">${r2}</i>`) && h2.includes(`<i class="on">${r1}</i>`), 'the number is taken as its die lands; the one before stays taken');
  assert.ok(h2.includes(`<b class="rrfly" aria-hidden="true">+${r2}</b>`), 'its points fly to the pot');
  // the turn's first roll: no points on the button until they are in the pot, then they appear (the pot too)
  const h1 = render(first.mini, first.flash);
  assert.equal(bank(h1), `Bank <b class="bpot">${r1}</b>`);
  assert.equal(btn(h1, 'X')[0], 'Roll', 'the Roll button stays as it was while the first roll plays');
  assert.match(h1, /<div class="rrpot first"><span>\+<b class="cnt" data-from="0"/);
  // nothing playing: the points as they stand
  const h0 = render(second.mini, null);
  assert.equal(bank(h0), `Bank ${pot}`); assert.deepEqual([btn(h0, 'X')[0], btn(h0, 'X')[1], btn(h0, 'bank')[1]], ['Roll again', `2 in 8 loses ${pot}`, `makes ${pot} of 51`]);
  assert.ok(h0.includes(`<div class="rrpot"><span>+${pot}</span></div>`) && !h0.includes(' roll v0'), 'the pot as it stands, the die at rest');
  // a roll that takes the player to the target: the Roll button is there until the die lands, then goes (Bank wins it)
  const big = clone(first.mini); big.bank.X = 51 - r1 - 1; const win = play(big, 'X', 'roll', fixed(0.7)), g = clone(win.mini);
  const land = html => html.includes('data-act="move" data-v="roll"') || /data-act="move"[^>]*>(Roll|Roll again)</.test(html);
  assert.ok(g.bank.X + g.turn.pot >= 51, 'enough to win after this roll');
  assert.ok(land(render(g, win.flash)), 'Roll still offered while the die is rolling');
  assert.ok(!land(render(g, null)), 'and gone once it has landed');
  // the winning bank: one button all through (nothing moves), the pot on its way to the banker's score, which counts on
  const wb = play(g, 'X', 'bank', fixed(0.5)), hw = render(wb.mini, Object.assign({}, wb.flash, { kind: 'claim' }));
  assert.ok(!land(hw) && hw.includes('class="rrbtns one"'), 'only Bank while the winning bank plays');
  assert.match(hw, /<div class="rrpot bank toX">/); assert.ok(hw.includes(`data-delay="${T.bank}" data-ms="500">${wb.mini.bank.X}</b>`));
  assert.match(hw, new RegExp(`class="rrline ok appear" style="--t:${T.bank}ms" role="status">Banked ${wb.flash.pot}<`));
});
test('Risky Rolls: a bust is the move\'s own (the number rolled twice, the pot it had, its words in the game\'s line as the die lands), never the square\'s', () => {
  const T = VIEWS.pig.PIG_T, m0 = E.newMini('pig', E.makeRng('bust')), a = play(m0, 'O', 'roll', fixed(0.3)), b = play(a.mini, 'O', 'roll', fixed(0.3));
  assert.equal(b.flash.note, 'bust');
  const shown = clone(b.mini); shown.last = { by: 'X', kind: 'bank', pot: 4, rolls: [4], roll: 4 };   // (the viewer's own last result on the square)
  const html = VIEWS.pig.screen({ owner: null, mini: shown }, b.flash, null, shown, false, true, b.flash, null, false, () => -1, false, 'O', '');
  assert.match(html, new RegExp(`Eight-sided die: ${b.flash.roll}"`)); assert.ok(html.includes(`<i class="on dup">${b.flash.roll}</i>`));
  assert.match(html, new RegExp(`class="rrline no appear" style="--t:${T.land}ms" role="status">Bust! ${b.flash.pot} lost<`));
  assert.match(html, /<div class="rrpot lost">/); assert.equal((html.match(/class="rrsh [lr]"/g) || []).length, 2, 'the pot breaks in two');
  assert.match(html, /class="rrgh lost"/, 'the points at risk come off the roller\'s bar');
  const snd = []; VIEWS.pig.sounds(b.flash, (n, ms) => snd.push([n, ms]));
  assert.deepEqual(snd.map(x => x[0]), ['rattle', 'diceTap', 'thunk', 'bust']); assert.deepEqual([snd[2][1], snd[3][1]], [T.land, T.lose]);
});
