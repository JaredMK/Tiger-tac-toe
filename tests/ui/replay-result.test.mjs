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
for (const t of ['candy', 'bump', 'snakes', 'pig', 'rl', 'wheels', 'craps']) VIEWS[t] = await import(`../../src/games/${t}/view.js`);
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
  assert.match(rh, /Olaf<\/b> bet green 0/); assert.doesNotMatch(rh, /Xena<\/b> bet/);
  const w0 = E.newMini('wheels', E.makeRng('wh')), wx = play(w0, 'X', 'high', E.makeRng('a')), wo = play(wx.mini, 'O', 'low', E.makeRng('b'));
  const wh = replay('wheels', wx.mini, wo.flash);
  assert.equal(wo.flash.wheel.w, 'low');
  assert.match(wh, /class="rwheel low spun"/, 'the wheel the opponent spun'); assert.doesNotMatch(wh, /class="rwheel high spun"/, 'not the viewer\'s');
  const die = n => (n - 1) / 6 + 0.01, dice = (...pairs) => seq(...pairs.flatMap(([a, b]) => [die(a), die(b)]));
  const c0 = E.newMini('craps', E.makeRng('cr')), cx = play(c0, 'X', 'roll', dice([1, 1])), co = play(cx.mini, 'O', 'roll', dice([3, 4]));
  assert.deepEqual([cx.mini.last.result, co.flash.craps.result], ['lose', 'win']);
  const ch = replay('craps', cx.mini, co.flash);
  assert.doesNotMatch(ch, /Xena<\/b>: /);
});

test('Risky Rolls: the Bank button keeps its points until the die has landed, then takes the new total (the move\'s own event times it); the Roll button stays as it was', () => {
  const m0 = E.newMini('pig', E.makeRng('bank')), first = play(m0, 'X', 'roll', fixed(0.2)), second = play(first.mini, 'X', 'roll', fixed(0.7));
  const r1 = first.flash.roll, r2 = second.flash.roll, pot = r1 + r2;
  assert.ok(r1 !== r2);
  const render = (mini, a) => VIEWS.pig.screen({ owner: null, mini }, a, null, mini, false, false, a, null, false, () => -1, false, 'X', '');
  const bank = html => (/<button class="big bank"[^>]*>(.*?)<\/button>/.exec(html) || [])[1];
  // a later roll: the old points show, counting up to the new total after the die lands (data-delay = the tumble)
  const h2 = render(second.mini, second.flash);
  assert.match(bank(h2), new RegExp(`^Bank <b class="cnt" data-from="${r1}" data-delay="600" data-ms="400">${pot}</b>$`));
  // the turn's first roll: no points on the button until the die lands, then they appear (the same moment as the +N)
  const h1 = render(first.mini, first.flash);
  assert.match(bank(h1), new RegExp(`^Bank <b class="bpot">${r1}</b>$`));
  // nothing playing: the points as they stand
  assert.equal(bank(render(second.mini, null)), `Bank ${pot}`);
  // a roll that takes the player to the target: the Roll button is there until the die lands, then goes (Bank wins it)
  const big = clone(first.mini); big.bank.X = 51 - r1 - 1; const win = play(big, 'X', 'roll', fixed(0.7)), g = clone(win.mini);
  const land = html => html.includes('data-act="move" data-v="roll"') || /data-act="move"[^>]*>(Roll|Roll again)</.test(html);
  assert.ok(g.bank.X + g.turn.pot >= 51, 'enough to win after this roll');
  assert.ok(land(render(g, win.flash)), 'Roll still offered while the die is rolling');
  assert.ok(!land(render(g, null)), 'and gone once it has landed');
});
