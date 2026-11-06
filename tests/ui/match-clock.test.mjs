// The match clock on screen: both players' clocks in the top bar (mm:ss) beside the names, the one on the move
// highlighted, red and pulsing under 30 s (ui/turnbar.js .pclk, ui/clock.js matchLeft); a per-turn match shows the
// one countdown as before. The host's lobby: a player sees No limit and the admin's default, the admin every timer
// (ui/screens/setup.js timerRows); a clock run out says "[name] ran out of time" (ui/screens/win.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const { renderHeader } = await import('../../src/ui/turnbar.js');
const { renderSetup } = await import('../../src/ui/screens/setup.js');
const { renderWin } = await import('../../src/ui/screens/win.js');
const { acct } = await import('../../src/net/accounts.js');
const { setTimerDefault } = await import('../../src/net/releases.js');
const { state } = await import('../../src/ui/app.js');

function online(spec, side = 'X') {                               // a phone in an online match with this timer, as the record gives it
  const rec = E.newOnlineMatch({ names: { X: 'Ann', O: 'Bo' }, games: Object.fromEntries(E.TYPES.map(t => [t, t === 'ttt'])), timer: spec }, E.makeRng('mc'), 'g1');
  E.armClock(rec.state, [], Date.now());
  Object.assign(state, E.fullState(rec), { screen: 'board', online: { kind: 'mm', game: 'g1', me: side, joined: true } });
  state.setup = Object.assign({}, state.setup, { names: { X: 'Ann', O: 'Bo' }, mode: 'online' });
  return state.timer;
}
const clocks = html => Object.fromEntries([...html.matchAll(/<b class="pclk([^"]*)" id="pclk-([XO])"[^>]*>([^<]*)<\/b>/g)].map(m => [m[2], { cls: m[1].trim(), text: m[3] }]));

test('top bar: a match clock shows both players\' times, the one on the move highlighted', () => {
  const t = online('m5+2'), p = state.turn, q = E.other(p);
  const c = clocks(renderHeader());
  assert.deepEqual(Object.keys(c).sort(), ['O', 'X'], 'both clocks');
  assert.match(c[p].text, /^(5:00|4:59)$/); assert.equal(c[q].text, '5:00');
  assert.equal(c[p].cls, 'on', 'the one on the move'); assert.equal(c[q].cls, '', 'the other stands');
  t.bank[q] = 83000;
  assert.equal(clocks(renderHeader())[q].text, '1:23', 'mm:ss');
  assert.match(renderHeader(), /<header class="hdr[^"]* mclock/);
});
test('top bar: under 30 seconds the clock on the move turns red and pulses (low); the other one never does', () => {
  const t = online('m3+0'), p = state.turn, q = E.other(p);
  t.bank[p] = 20000; t.deadline = Date.now() + 20000; t.bank[q] = 10000;
  const c = clocks(renderHeader());
  assert.equal(c[p].cls, 'on low'); assert.match(c[p].text, /^0:(19|20)$/);
  assert.equal(c[q].cls, '', 'a low clock not on the move stays plain'); assert.equal(c[q].text, '0:10');
});
test('top bar: a per-turn match keeps its one countdown, no player clocks', () => {
  online('t30');
  const html = renderHeader();
  assert.deepEqual(clocks(html), {});
  assert.match(html, /id="clock"[^>]*>0:(29|30)</);
});
test('lobby: a player host sees No limit and a match clock of 3, 5 or 10 minutes (+5 s a move) with its "?"; the admin every timer, per turn included', () => {
  Object.assign(state, E.newMatch(E.makeRng('cm'), { games: ['ttt'] }), { screen: 'setup', online: { role: 'host', code: 'ABCDE', me: 'X', joined: false } });
  acct.profile = { username: 'hosty' }; acct.user = { uid: 'h' }; acct.admin = false;
  setTimerDefault('t30'); state.setup.clock = 'm5+5';
  let html = renderSetup();
  assert.deepEqual([...html.matchAll(/data-act="clock" data-v="([^"]+)"/g)].map(m => m[1]), ['off', 'm3+5', 'm5+5', 'm10+5'], 'no per-turn option for players, whatever the admin set');
  assert.match(html, /aria-pressed="true">5</);
  assert.match(html, /<span>Minutes<button class="qbtn sm" data-act="explain" data-t="timer"/, 'the "?" beside the minutes');
  assert.doesNotMatch(html, /Per turn|30 ?s/);
  acct.admin = true; state.setup.clock = 'm10+5';
  html = renderSetup();
  const vs = [...html.matchAll(/data-act="clock" data-v="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(vs.slice(0, 3), ['off', 'm10+5', 't30'], 'type: No limit, Match clock, Per turn (admin only)');
  assert.deepEqual(vs.slice(3), ['m3+5', 'm5+5', 'm10+5', 'm10+0', 'm10+2', 'm10+5'], 'its minutes and increments');
  state.setup.clock = 't60';
  assert.deepEqual([...renderSetup().matchAll(/data-act="clock" data-v="([^"]+)"/g)].map(m => m[1]), ['off', 'm5+5', 't60', 't30', 't60'], 'per turn: 30 or 60 seconds');
  assert.match(renderSetup(), />30s\/turn</, 'labelled 30s/turn'); assert.match(renderSetup(), />60s\/turn</);
  acct.admin = false; setTimerDefault('m5+5');
});
test('the timer "?": minutes for the whole game, +5 s a move, run out and you lose', async () => {
  const { explainOf } = await import('../../src/ui/explainer.js');
  assert.equal(explainOf('timer').text, 'Minutes each player has for the whole game. +5s is added after each move. Run out of time and you lose.');
  assert.deepEqual(E.PLAYER_TIMERS, ['off', 'm3+5', 'm5+5', 'm10+5']); assert.equal(E.TIMER_DEFAULT, 'm5+5');
});
test('the increment shows as a brief "+5" on the mover\'s clock, once, when the clock hands over', async () => {
  const C = await import('../../src/ui/clock.js');
  const t = online('m5+5'), p = state.turn, q = E.other(p);
  C.tick();                                                         // (the first look: nothing)
  assert.equal(C.incShow, null);
  t.for = q; t.bank[p] += 5000; state.moves++;
  C.tick();
  assert.deepEqual([C.incShow.side, C.incShow.n], [p, 5]);
  assert.match(renderHeader(), new RegExp(`id="pclk-${p}"[^>]*>[^<]*</b><i class="pinc"[^>]*>\\+5</i>`));
  const key = C.incShow.key; C.tick();
  assert.equal(C.incShow.key, key, 'once a move: a later tick shows nothing new');
});
test('the end: a clock run out says who ran out of time', () => {
  online('m3+0', 'X');
  Object.assign(state, { winner: 'O', winReason: 'clock', screen: 'win', counts: null, winLine: null });
  const html = renderWin();
  assert.match(html, /Ann ran out of time/);
  assert.doesNotMatch(html, /forfeited/);
});
