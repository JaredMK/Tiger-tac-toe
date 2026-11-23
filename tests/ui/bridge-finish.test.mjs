// Glass Bridge's finish (games/bridge/view.js), rendered in Node with the browser's names stubbed: the far bank is
// there from the start (its flag, nothing on it); the winning hop lands on the last row, then the token leaps off onto
// the far bank and dances there (one jump wrapper measured from the platform it left through the last row's glass, the
// dance after it); a player across stands on the far bank from then on, arms up; the move's timings (flashMs grows by
// the leap off and the dance, a won move only) and its sounds, each at its moment, the won chime with the dance's pose;
// the stylesheet's dance at the rules' moments.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : k === 'matchMedia' ? () => ({ matches: false }) : k === 'getItem' ? () => null : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const { state } = await import('../../src/ui/app.js');
const { renderMini } = await import('../../src/ui/mini.js');
const { GAMES } = await import('../../src/games/index.js');
const { moveSounds, SFX } = await import('../../src/audio/sound.js');
const { RESULT_SOUNDS, BAD_SOUNDS } = await import('../../src/ui/haptics.js');
const { startFx } = await import('../../src/ui/fx.js');
const V = await import('../../src/games/bridge/view.js');
const R = await import('../../src/games/bridge/rules.js');
GAMES.bridge.view = V;   // (the page registers the views in main.js; here by hand)
const B = R.BRIDGE;

// A match of Glass Bridge alone, its centre square with `mover` one hop from across (on safe glass of the row before
// the last) and the other side on row 1.
function match(mover = 'X', tune = null) {
  E.setTune('bridge', tune);
  Object.assign(state, E.newMatch(E.makeRng('gb-finish'), { games: ['bridge'], vs: 'cpu' }), { screen: 'mini', zoom: 4, cpu: 'O', sc: null, flash: null, done: null, spot: null, winner: null, online: null, turn: mover, lock: null });
  state.setup.vs = 'cpu'; state.setup.names = { X: 'Xena', O: 'Computer' };
  const m = state.squares[4].mini, n = m.n.length, other = mover === 'X' ? 'O' : 'X';
  const bad = p => (m.sep ? m.bad[p] : m.bad), safe = (p, r) => Array.from({ length: m.n[r] }, (_, i) => i).find(i => !bad(p)[r].includes(i));
  m.at[mover] = n - 2; m.pos[mover] = safe(mover, n - 2); m.at[other] = 1; m.pos[other] = safe(other, 1);
  return { m, n, win: safe(mover, n - 1), from: m.pos[mover], lose: bad(mover)[n - 1][0], safe };
}
const game = html => html.slice(html.indexOf('class="g-gb'));
const farOf = html => { const g = game(html), a = g.indexOf('<div class="gbend far">'); return g.slice(a, g.indexOf('<div class="gbrow"', a)); };

test('Glass Bridge: the far bank is drawn from the start: solid ground past the finish line, its flag, nobody on it', () => {
  match('X');
  const html = renderMini(state.squares[4]), far = farOf(html);
  assert.match(far, /^<div class="gbend far"><svg class="gbflag" viewBox="0 0 24 40" aria-hidden="true">/);
  assert.ok(!far.includes('ntok') && !far.includes('gbwin'), 'nobody across yet');
  assert.equal((game(html).match(/class="gbend far"/g) || []).length, 1);
  assert.match(game(html), new RegExp(`--dc:${R.bridgeBankAt()}ms;--dn:${B.dance}ms`), 'the dance\'s moments on the game, from the rules');
  assert.ok(!/<text|undefined|NaN/.test(game(html)));
  match('X', { boards: 'separate' });
  assert.equal((game(renderMini(state.squares[4])).match(/<div class="gbend far"><svg class="gbflag"/g) || []).length, 2, 'separate bridges: a far bank each');
  E.setTune('bridge', null);
});

test('Glass Bridge: the winning hop lands on the last row, then leaps off onto the far bank and dances; the line says Across! as it lands there', () => {
  const { n, win, from } = match('X');
  assert.ok(E.playMove(state, 4, win, E.makeRng('w')).ok);
  const f = state.flash; startFx('move', f);
  assert.ok(f.kind === 'claim' || f.kind === 'match'); assert.deepEqual(f.gb, { r: n - 1, i: win, fall: false, from });
  const html = renderMini(state.squares[4]), far = farOf(html);
  assert.ok(far.includes(`<span class="gbj across" data-gbj="${n - 2}:${from}" data-gbm="${n - 1}:${win}"><span class="gbwin X dance"><i class="gbarm l">`), 'one jump: from the platform it left, through the last row\'s glass, onto the bank');
  assert.equal((far.match(/<i class="gbarm [lr]">/g) || []).length, 2); assert.ok(far.includes('class="gbsp"'), 'the pose\'s sparkles');
  assert.ok(!game(html).slice(game(html).indexOf('<div class="gbrow"')).includes('ntok X'), 'never drawn on the last row\'s glass');
  assert.ok(game(html).includes(`<p class="gbline ok appear" style="--t:${R.bridgeBankAt()}ms" role="status">Across!</p>`), 'the words as it lands on the far bank');
  // the square's own end: it takes the whole dance (and the pose held a moment) before the frame says who won it
  assert.equal(E.playMs(f), R.bridgeBankAt() + B.dance + B.rest);
  assert.equal(R.bridgeBankAt(), 2 * B.hop + B.off, 'the hop onto the last row, a beat there, the leap off');
  // the review once it is won: on the far bank, arms up, no dance
  state.flash = null; state.done = null;
  const rev = farOf(renderMini(state.squares[4]));
  assert.ok(rev.includes('<span class="gbwin X"><i class="gbarm l">') && !rev.includes('gbj') && !rev.includes('gbsp'), 'across: on the far bank, arms up, still');
  // separate bridges: onto the far bank of their own bridge alone
  const sp = match('O', { boards: 'separate' });
  assert.ok(E.playMove(state, 4, sp.win, E.makeRng('w3')).ok); startFx('move', state.flash);
  const [bx, bo] = game(renderMini(state.squares[4])).split('<div class="gbb own ').slice(1).map(h => h.slice(0, h.indexOf('<div class="gbrow"')));
  assert.ok(bx.startsWith('X"') && bo.startsWith('O"'));
  assert.ok(bo.includes(`<span class="gbj across" data-gbj="${sp.n - 2}:${sp.from}" data-gbm="${sp.n - 1}:${sp.win}"><span class="gbwin O dance">`) && !bx.includes('gbwin'), 'O\'s own far bank');
  E.setTune('bridge', null);
});

test('Glass Bridge: a hop that does not win is as it was: the jump onto its glass, no one on the far bank, its timings unchanged', () => {
  let { n, safe } = match('X');
  state.squares[4].mini.at.X = 0; state.squares[4].mini.pos.X = safe('X', 0);
  const r1 = safe('X', 1);
  assert.ok(E.playMove(state, 4, r1, E.makeRng('h')).ok);
  let f = state.flash; startFx('move', f);
  let html = renderMini(state.squares[4]);
  assert.equal(f.kind, 'again'); assert.equal(E.playMs(f), B.hop + B.land);
  assert.ok(game(html).includes('<span class="gbj" data-gbj="0:'), 'the jump on its platform'); assert.ok(!farOf(html).includes('ntok'));
  assert.ok(game(html).includes(`<p class="gbline ok appear" style="--t:${B.hop}ms" role="status">Safe!</p>`));
  ({ n } = match('X'));
  const lose = state.squares[4].mini.bad[n - 1][0];
  assert.ok(E.playMove(state, 4, lose, E.makeRng('f')).ok);
  f = state.flash; startFx('move', f); html = renderMini(state.squares[4]);
  assert.equal(E.playMs(f), B.hop + B.crack + B.drop + B.back, 'a break on the last row: the fall as ever');
  assert.ok(!farOf(html).includes('ntok')); assert.ok(game(html).includes('class="gbj fallin"'));
  E.setTune('bridge', null);
});

test('Glass Bridge: the winning hop\'s sounds, each once at its moment: the jump, the tink, the leap off, the landing, the dance\'s two hops and twirl; the won chime with the pose', () => {
  const { win } = match('O');
  assert.ok(E.playMove(state, 4, win, E.makeRng('w2')).ok);
  const f = state.flash, D = R.bridgeBankAt();
  const s = moveSounds(f).filter(x => /^gb|won/.test(x[0]));
  assert.deepEqual(s, [['gbJump', 0, undefined], ['gbTink', B.hop, undefined], ['gbJump', B.hop + B.off, undefined], ['gbLand', D, undefined], ['gbHop', D + B.hop1, undefined], ['gbHop', D + B.hop2, 1.12], ['gbTwirl', D + B.twirl, undefined], ['won', D + B.pose, undefined]]);
  assert.ok(D + B.pose < E.playMs(f), 'the chime before the frame\'s own result');
  for (const k of ['gbLand', 'gbHop', 'gbTwirl']) { assert.ok(SFX[k], k); assert.ok(!RESULT_SOUNDS.has(k) && !BAD_SOUNDS.has(k), `${k}: the dance's motion, no buzz of its own`); }
  // a hop that holds and does not win: the jump and the tink alone
  const g = match('O');
  state.squares[4].mini.at.O = 0; state.squares[4].mini.pos.O = g.safe('O', 0);
  assert.ok(E.playMove(state, 4, g.safe('O', 1), E.makeRng('h2')).ok);
  assert.deepEqual(moveSounds(state.flash).filter(x => /^gb|won/.test(x[0])).map(x => x[0]), ['gbJump', 'gbTink']);
  E.setTune('bridge', null);
});

test('Glass Bridge: the stylesheet\'s dance keeps the rules\' moments (the hops, the twirl, the pose)', () => {
  const css = readFileSync(new URL('../../src/ui/styles.css', import.meta.url), 'utf8');
  const kf = css.slice(css.indexOf('@keyframes gbdance'), css.indexOf('@keyframes gbarml'));
  const at = k => Math.round((100 * B[k]) / B.dance);
  for (const k of ['hop1', 'hop2', 'twirl', 'pose']) assert.ok(kf.includes(`\n  ${at(k)}% {`), `${k} at ${at(k)}%`);
  assert.ok(css.includes('.gbwin.dance { animation: gbdance var(--dn) var(--dc) linear both; }'));
  assert.ok(css.includes(`.gbwin.dance .gbsp { animation: gbspark calc(var(--dn) * .34) calc(var(--dc) + var(--dn) * .${at('pose')}) ease-out both; }`), 'the sparkles at the pose');
});
