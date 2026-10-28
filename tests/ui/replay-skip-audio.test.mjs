// Skipping a replay silences it: every sound the replay started or scheduled ahead on the audio clock (dice,
// spins, effects, a loop) stops at once (audio/sound.js SND.scope, SND.cut; ui/replay.js repSkip), for every
// game's move as the replay plays it (its moveSounds through playFlash); the interface's own taps are not
// the replay's. Rendered in Node with the browser's names stubbed and a fake AudioContext.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const { GAMES, TYPES } = await import('../../src/games/index.js');
for (const t of TYPES) GAMES[t].view = await import(`../../src/games/${t}/view.js`);
const { SND, SFX } = await import('../../src/audio/sound.js');
const { state } = await import('../../src/ui/app.js');
const REP = await import('../../src/ui/replay.js'), { repStart, repSkip, repStop } = REP;
const { playFlash } = await import('../../src/ui/turns.js');

// The fake audio: a clock, gains and buffer sources that remember what was done to them.
const nodes = [];
const param = v => ({ value: v, cancelScheduledValues() {}, setValueAtTime(x) { this.value = x; }, linearRampToValueAtTime(x) { this.value = x; }, exponentialRampToValueAtTime() {}, setTargetAtTime(x) { this.value = x; } });
const ctx = {
  state: 'running', currentTime: 10, sampleRate: 44100,
  createGain() { const g = { gain: param(1), connect() {}, disconnect() { g.off = true; } }; return g; },
  createBufferSource() { const s = { buffer: null, playbackRate: param(1), connect() {}, start(at) { s.at = at; }, stop(at) { s.stopAt = at; }, loop: false }; nodes.push(s); return s; },
  createOscillator() { const o = { type: '', frequency: param(440), connect() {}, start() {}, stop() {} }; return o; },
};
SND.ctx = ctx; SND.out = ctx.createGain(); SND.muted = false; SND.loaded = true;
SND.ensure = () => true;
for (const name of Object.keys(SFX)) SND.bufs[name] = { duration: SFX[name].dur };
const reset = () => { nodes.length = 0; SND.cut(); SND.cut(null); SND.scope = null; };
const live = () => nodes.filter(s => s.stopAt == null || s.stopAt > ctx.currentTime + 0.05);

test('SND.cut stops a scope\'s sounds, the ones scheduled ahead too, and nothing else', () => {
  reset();
  const tag = {};
  SND.play('tap', { ui: true });                                  // (no scope: a plain sound)
  SND.scope = tag;
  SND.play('rattle'); SND.play('thunk', { at: 1.5 }); SND.play('bank', { at: 3 }); SND.play('tap', { ui: true });
  const loop = SND.loop('rotor');
  SND.scope = null;
  assert.equal(SND.heldCount(tag), 4);
  SND.cut(tag);
  assert.equal(SND.heldCount(tag), 0);
  const [plain, a, b, c, ui, r] = nodes;
  for (const s of [a, b, c, r]) assert.ok(s.stopAt != null && s.stopAt <= ctx.currentTime + 0.05, 'the replay\'s sound stops at once');
  assert.equal(plain.stopAt, undefined, 'a sound outside the replay plays on');
  assert.equal(ui.stopAt, undefined, 'the tap of the Skip itself plays on');
  loop.stop();
});

test('Skip during a replay\'s inputs and during its move: every sound of it stops', () => {
  reset();
  state.screen = 'mini'; state.zoom = 0;
  repStart({ cpu: true, sq: 0, by: 'O', type: 'pig', mini: { type: 'pig' }, move: 'roll', list: [[0, 'move', 'roll'], [400, 'move', 'roll']], onMove: () => { SND.play('rattle'); SND.play('thunk', { at: 0.6 }); SND.play('point', { at: 1.1 }); } });
  SND.play('peg');                                                // (an input's press, while the replay plays)
  assert.equal(SND.scope, REP.rep);
  repSkip();
  assert.equal(live().length, 0, 'nothing of the replay sounds after Skip');
  repStop();
  assert.equal(SND.scope, null, 'the scope ends with the replay');
});

// Every game: a computer's move replayed (its sounds from moveSounds through playFlash), then skipped.
test('every game\'s replay: its move\'s sounds stop on Skip', async () => {
  const quietTypes = [];
  for (const type of TYPES) {
    reset();
    const rng = E.makeRng('snd-' + type), st = E.newMatch(rng, { names: { X: 'Xena', O: 'Olaf' } }), mini = E.newMini(type, rng);
    st.squares[0] = { owner: null, mini }; st.turn = 'O';
    let mv = null;
    try { mv = E.randomLegalMove(mini, 'O', rng); } catch (e) { mv = null; }
    if (mv == null) { quietTypes.push(type + ' (no move)'); continue; }
    Object.assign(state, st, { screen: 'mini', zoom: 0, flash: null, spot: null, winner: null });
    const r = E.playMove(state, 0, mv, rng);
    if (!r.ok || !state.flash) { quietTypes.push(`${type} (refused: ${r.reason})`); continue; }
    const f = state.flash;
    state.flash = null;
    repStart({ cpu: true, sq: 0, by: 'O', type, mini, move: mv, elapsed: 1e7, onMove: () => { state.flash = f; playFlash(); } });   // (joined long after: its inputs press at once)
    for (let k = 0; k < 200 && REP.rep && REP.rep.stage !== 'move'; k++) await new Promise(r => setTimeout(r, 0));
    assert.ok(REP.rep && REP.rep.stage === 'move', `${type}: the replay reached its move`);
    if (!nodes.length) { quietTypes.push(type); repStop(); continue; }
    assert.ok(SND.heldCount() > 0, `${type}: its sounds are the replay's`);
    repSkip();
    assert.equal(live().length, 0, `${type}: a sound of the replay plays on after Skip`);
    repStop();
  }
  assert.ok(quietTypes.length < TYPES.length / 4, `most games' moves make sounds (silent: ${quietTypes.join(', ')})`);
});
