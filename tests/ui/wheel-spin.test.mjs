// The wheels' spin (Risky Spins, Little Wheel; the November 2026 polish pass): a wheel turns with weight (a wind-up,
// a long run that slows, a settle), and what the turning wheel does is timed from that very curve: the pointer's
// flicks and the tick sounds at the moments its pegs pass, slower and slower; the ball's clicks as the pockets pass
// under it. The curve lives twice, in the stylesheet (the keyframes that play it) and in ui/spin.js and rl/view.js
// (the figures the views time from): held together here. And each game's move as its view draws it: the stop from
// the move's flash, the points flying to the pot, a skull's moment, the picks on Little Wheel's wheel and board in
// the picker's colour. Rendered in Node with the browser's names stubbed.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const S = await import('../../src/ui/spin.js');
const WV = await import('../../src/games/wheels/view.js');
const WR = await import('../../src/games/wheels/rules.js');
const RV = await import('../../src/games/rl/view.js');
const RR = await import('../../src/games/rl/rules.js');
const { state } = await import('../../src/ui/app.js');
state.setup = Object.assign({}, state.setup, { names: { X: 'Xena', O: 'Olaf' } });
const CSS = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'ui', 'styles.css'), 'utf8');
const frames = name => { const at = CSS.indexOf(`@keyframes ${name} {`); assert.ok(at >= 0, `@keyframes ${name}`); return CSS.slice(at, CSS.indexOf('\n', at)); };
const bezCss = e => `cubic-bezier(${e.map(x => String(x).replace(/^0\./, '.')).join(', ')})`;
const pct = x => `${Math.round(x * 100)}%`;
const gaps = t => t.slice(1).map((x, k) => x - t[k]);
const soundsOf = (V, f) => { const out = []; V.sounds(f, (n, at, rate) => out.push([n, at, rate]), false, null, null); return out; };
const fixed = v => () => v;

test('the spin\'s curve: a wind-up, the long run, a crawl past the stop and the settle; the stylesheet plays the same figures', () => {
  const P = S.SPIN, from = -72, end = 1650;
  assert.equal(S.spinAt(from, end, 0), from); assert.equal(S.spinAt(from, end, 1), end);
  assert.ok(Math.abs(S.spinAt(from, end, P.wind) - (from - P.back)) < 0.01, 'wound back at the wind-up\'s end');
  assert.ok(Math.abs(S.spinAt(from, end, P.stop) - (end + P.over)) < 0.01, 'just past the stop as the run ends');
  for (let k = 1, was = S.spinAt(from, end, P.wind); k <= 100; k++) { const a = S.spinAt(from, end, P.wind + (P.stop - P.wind) * k / 100); assert.ok(a >= was, 'the run only goes on'); was = a; }
  assert.ok(S.spinAt(from, end, 0.5) - from > 0.85 * (end - from), 'most of the way by half time: the rest is the slow part');
  const w = frames('wspinw');
  for (const part of [`${pct(P.wind)} {`, `- ${P.back}deg`, `${pct(P.stop)} {`, `+ ${P.over}deg`, bezCss(P.e0), bezCss(P.e1), bezCss(P.e2)]) assert.ok(w.includes(part), `wspinw has ${part}`);
  // a cubic-bezier as the stylesheet means it
  const ease = S.bez(0.42, 0, 0.58, 1);
  assert.ok(Math.abs(ease(0.5) - 0.5) < 1e-6); assert.ok(ease(0.25) < 0.25 && ease(0.75) > 0.75); assert.equal(ease(0), 0); assert.equal(ease(1), 1);
});

test('the ticks: one as each peg passes the pointer, never two on top of each other, slower and slower to the stop', () => {
  for (const at of [0.05, 0.31, 0.423, 0.68, 0.97]) {
    const end = 1800 - at * 360, t = S.spinTicks(0, end, 36, 1900), g = gaps(t);
    assert.ok(t.length >= 10 && t.length <= 40, `${t.length} ticks`);
    assert.ok(t[0] >= S.SPIN.wind * 1900 && t[t.length - 1] <= S.SPIN.stop * 1900, 'all in the run');
    assert.ok(g.every(x => x >= 50), 'no two within 50 ms');
    assert.ok(g[g.length - 1] >= 1.5 * g[0], `the last gap (${g[g.length - 1]} ms) well over the first (${g[0]} ms)`);
    for (const ms of t.slice(-3)) {   // a late tick is a peg under the pointer: the wheel's angle there is a segment's edge
      const a = S.spinAt(0, end, ms / 1900) / 36; assert.ok(Math.abs(a - Math.round(a)) < 0.2, `a peg at ${ms} ms (${a.toFixed(2)})`);
    }
  }
});

test('Risky Spins: the wheel turns from where it rested to the flash\'s stop; the pointer flicks at the ticks the sounds play', () => {
  const m0 = E.newMini('wheels', E.makeRng('spin-a'));
  let mini = null, f = null;
  for (let k = 0; k < 200 && !f; k++) {   // a spin of the low wheel that lands on points
    const c = JSON.parse(JSON.stringify(m0)); c.rest.low = 0.37;
    const r = E.applyMove(c, 'O', 'low', E.makeRng('s' + k));
    if (r.ok && c.last.kind === 'spin') { mini = c; f = { by: 'O', type: 'wheels', wheel: {} }; WR.moveFlash('low', 'O', null, null, c, f); }
  }
  assert.ok(f, 'a spin with points'); assert.equal(f.wheel.from, 0.37);
  const html = WV.screen({ owner: null, mini }, f, null, mini, false, true, f, null, () => false, () => -1, false, 'O', '');
  const from = -0.37 * 360, end = 1800 - f.wheel.at * 360;
  assert.ok(html.includes(`--from:${from.toFixed(1)}deg;--end:${end.toFixed(1)}deg;--d:${WR.WHEELT.spin}ms`), 'from its rest to the stop the move landed on');
  assert.match(html, /class="g-arc g-wheels pc-O"/, 'the mover\'s colour (the pointers, the pot)');
  const ticks = S.spinTicks(from, end, 36, WR.WHEELT.spin), snd = soundsOf(WV, f);
  assert.deepEqual(snd.filter(x => x[0] === 'wheelTick').map(x => x[1]), ticks, 'a tick sound as each peg passes');
  const flicks = [...html.matchAll(/wflick 110ms (\d+)ms/g)].map(x => Number(x[1]));
  assert.deepEqual(flicks, ticks, 'and the pointer flicks at the same moments');
  assert.equal((html.match(/class="wptr"[^>]*style="animation:/g) || []).length, 1, 'only the spun wheel\'s pointer');
  assert.ok(snd.some(x => x[0] === 'ding' && x[1] === WR.WHEELT.spin), 'the result as the wheel comes to rest');
  // the points: out at the pointer as it stops, into the pot (which takes them as they arrive)
  const side = WR.wheelsOf(mini).indexOf('low') === 0 ? 'l' : 'r', inPot = WR.WHEELT.spin + WR.WHEELT.fly;
  assert.ok(html.includes(`<span class="wfly O ${side}" style="--t:${WR.WHEELT.spin}ms;--d:${WR.WHEELT.fly}ms" aria-hidden="true">+${f.wheel.v}</span>`), 'the +N flies from its wheel');
  assert.ok(html.includes(`class="risk wpot O grow first" style="--t:${inPot}ms`), 'the pot shows as they land in it');
  assert.ok(html.includes(`<b class="bpot" style="--t:${inPot}ms">+${f.wheel.pot}</b>`), 'and Bank takes its figure then');
  assert.ok(WR.flashMs(f, 0, false) >= inPot + 150, 'the move lasts until the pot has them');
  assert.match(html, /class="wbox pay"/); assert.doesNotMatch(html, /wboo|wbox bust/);
  // a skull: the wheel jolts, its badge pops, the pot is struck out; no points fly
  const b = JSON.parse(JSON.stringify(m0)); b.turn = { by: 'X', pot: 9, n: 2 };
  let bf = null;
  for (let k = 0; k < 200 && !bf; k++) { const c = JSON.parse(JSON.stringify(b)); E.applyMove(c, 'X', 'high', E.makeRng('b' + k)); if (c.last.kind === 'bust') { bf = { by: 'X', type: 'wheels', wheel: {}, mini: c }; WR.moveFlash('high', 'X', null, null, c, bf); } }
  const bh = WV.screen({ owner: null, mini: bf.mini }, bf, null, bf.mini, false, true, bf, null, () => false, () => -1, false, 'O', '');
  assert.match(bh, /class="g-arc g-wheels pc-X"/); assert.match(bh, /class="wbox bust"/); assert.match(bh, /class="wboo"/); assert.match(bh, /class="risk wpot X lost"/); assert.doesNotMatch(bh, /wfly/);
  assert.ok(soundsOf(WV, bf).some(x => x[0] === 'bust'), 'the bust sound (the error buzz)');
  // each wheel at a glance: its skulls, its values
  const idle = WV.screen({ owner: null, mini: m0 }, null, null, m0, false, false, null, null, () => false, () => -1, false, 'X', '');
  for (const w of WR.wheelsOf(m0)) { const v = m0.wheels[w].filter(x => x !== WR.SKULL); assert.ok(idle.includes(`<b>×${10 - v.length}</b>`)); assert.ok(idle.includes(`<span class="wlv">${Math.min(...v)}–${Math.max(...v)}</span>`)); }
  assert.doesNotMatch(idle, /wflick|wfly|wboo/, 'nothing moves in a wheel at rest');
});

test('Little Wheel: the wheel turns on from the pocket it rested on (the flash\'s `from`), the ball clicks slower and slower, drops, then the result', () => {
  const at = n => fixed((E.RL.wheel.indexOf(n) + 0.5) / 25), STEP = 360 / 25, V = RV.RLV;
  const m = E.newMini('rl', E.makeRng('rl-spin'));
  const fl = (mini, p, bet) => { const f = { by: p, type: 'rl' }; RR.moveFlash(bet, p, null, null, mini, f); return f; };
  E.applyMove(m, 'X', 'g1', at(13)); const f1 = fl(m, 'X', 'g1');
  assert.equal(f1.rl.from, null, 'the first spin: no pocket before it');
  E.applyMove(m, 'O', 'g2', at(10)); const f2 = fl(m, 'O', 'g2');
  assert.deepEqual([f2.rl.from, f2.rl.n, f2.rl.hit], [13, 10, true]);
  // the turn: from 13's pocket, a turn and a half at least, to 10's under the pointer
  const t = RV.rlTurn(10, 13);
  assert.ok(Math.abs(t.w0 - -E.RL.wheel.indexOf(13) * STEP) < 1e-9); assert.ok(t.w - t.w0 >= V.turns && t.w - t.w0 < V.turns + 360);
  const off = (((t.w + E.RL.wheel.indexOf(10) * STEP) % 360) + 360) % 360;
  assert.ok(Math.min(off, 360 - off) < 1e-6, '10 ends under the pointer');
  assert.deepEqual(RV.rlTurn(10, null), { w0: -E.RL.wheel.indexOf(10) * STEP - V.turns, w: -E.RL.wheel.indexOf(10) * STEP }, 'no pocket before (or an older record): a turn and a half in');
  const html = RV.screen({ owner: null, mini: m }, f2, null, m, false, true, f2, null, () => false, () => -1, false, 'X', '');
  assert.ok(html.includes(`--w0:${t.w0.toFixed(1)}deg;--w:${t.w.toFixed(1)}deg;--sp:${E.RLT.spin}ms;--st:${E.RLT.spin + E.RLT.settle}ms`));
  assert.match(html, /class="rlwheel spin"/); assert.doesNotMatch(html, /rlwheel spin fresh/);
  assert.match(RV.screen({ owner: null, mini: m }, f1, null, m, false, true, f1, null, () => false, () => -1, false, 'X', ''), /class="rlwheel spin fresh"/, 'the first spin: the ball comes onto the track');
  // the picks: on the board and on the wheel in the picker's colour (O's), the rest dimmed; the pocket ringed for the hit
  assert.match(html, /class="g-rl pc-O dim"/);
  assert.equal((html.match(/class="rlpk O"/g) || []).length, 8, 'the group\'s eight pockets on the rim'); assert.equal((html.match(/class="rloff"/g) || []).length, 17, 'the others washed out');
  assert.equal((html.match(/class="rln [rb] on/g) || []).length, 8); assert.match(html, /class="rlhit O appear"/); assert.match(html, /class="rlres hit O appear"/); assert.match(html, /<span>Hit<\/span>/);
  assert.match(html, /class="rlbig hit O appear"/);
  // the sounds: the ball's clicks from the two turning (never bunched, slower and slower, none once it has dropped), the drop, then the result
  const snd = soundsOf(RV, f2), ticks = snd.filter(x => x[0] === 'ballTick').map(x => x[1]), g = gaps(ticks), end = E.RLT.spin + E.RLT.settle;
  assert.deepEqual(ticks, RV.rlTicks(10, 13));
  assert.ok(ticks.length >= 12 && g.every(x => x >= 58) && g[g.length - 1] >= 1.5 * g[0], `${ticks.length} clicks, the gaps ${g[0]} to ${g[g.length - 1]} ms`);
  assert.ok(ticks[ticks.length - 1] <= V.drop * end, 'the last click before the ball leaves the track');
  const drop = snd.find(x => x[0] === 'ballDrop')[1], res = snd.find(x => x[0] === 'ding')[1];
  assert.equal(drop, Math.round(V.land * end)); assert.equal(res, end); assert.ok(drop < res);
  // the stylesheet plays the same figures
  const w = frames('rlwheel'), b = frames('rldrop'), ball = CSS.slice(CSS.indexOf('.rlwheel.spin .rlb {'), CSS.indexOf('\n', CSS.indexOf('.rlwheel.spin .rlb {')));
  for (const part of [`${pct(V.wind)} {`, `- ${V.back}deg`, bezCss(V.e0), bezCss(V.e1)]) assert.ok(w.includes(part), `rlwheel has ${part}`);
  assert.ok(frames('rlball').includes(`rotate(${V.ball}deg)`)); assert.ok(ball.includes(bezCss(V.eb)));
  assert.ok(b.includes(`${pct(V.drop)} {`) && b.includes(`${pct(V.land)} {`), 'the drop and the landing'); assert.ok(frames('rldrop0').includes(`${pct(V.drop)} {`));
});

test('Little Wheel: a pick being put together shows in the mover\'s colour, on the board and on the wheel; a whole pick dims the rest', () => {
  const m = E.newMini('rl', E.makeRng('rl-draft'));
  const draw = turn => RV.screen({ owner: null, mini: m }, null, null, m, false, false, null, null, () => false, () => -1, false, turn, '');
  state.zoom = 4;
  RV.setRlDraft({ sq: 4, nums: [3, 7, 12], bet: null });
  let h = draw('X');
  assert.match(h, /class="g-rl pc-X"/); assert.equal((h.match(/class="rlpk X"/g) || []).length, 3); assert.doesNotMatch(h, /rloff/, 'not whole yet: nothing dimmed');
  assert.match(h, /class="big X rlspin"[^>]*disabled/, 'no whole pick yet: Spin is off');
  RV.setRlDraft({ sq: 4, nums: [], bet: 'zero' });
  h = draw('O');
  assert.match(h, /class="g-rl pc-O dim"/); assert.equal((h.match(/class="rlpk O"/g) || []).length, 1); assert.equal((h.match(/class="rloff"/g) || []).length, 24); assert.match(h, /class="rlz on"/);
  assert.doesNotMatch(h, /class="big O rlspin"[^>]*disabled/, 'a whole pick: Spin is on');
  // the miniature keeps to its own classes (the board's row of numbers is .rlrow)
  const mini = RV.miniature(m, false);
  assert.doesNotMatch(mini, /class="rlrow"|class="rlcol"/); assert.match(mini, /class="rlmrow"/); assert.match(mini, /class="tmwheel"/);
  RV.setRlDraft(null);
});
