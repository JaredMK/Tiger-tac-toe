// The haptics (net/platform.js haptic, ui/haptics.js, ui/turns.js turnAlert), with a Capacitor shell faked on `window`:
// each kind its own Haptics style, the turn a double pulse, rapid play thinned, nothing with Vibration off; a move made
// here buzzes (a tap, its result, the mini-game's end), the other side's never; a square lost is the error pattern; the
// turn coming to this player plays the chime and the pulse once, never on a first look (a reload, a reconnect).
import test from 'node:test';
import assert from 'node:assert/strict';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
globalThis.document.visibilityState = 'visible';
const buzz = [];
globalThis.window = { Capacitor: { isNativePlatform: () => true, getPlatform: () => 'ios', Plugins: {
  Haptics: { impact: async o => { buzz.push(['impact', o.style]); }, notification: async o => { buzz.push(['note', o.type]); } },
} } };
const P = await import('../../src/net/platform.js');
const H = await import('../../src/ui/haptics.js');
const { turnAlert } = await import('../../src/ui/turns.js');
const { SND } = await import('../../src/audio/sound.js');
const { state } = await import('../../src/ui/app.js');
const wait = ms => new Promise(ok => setTimeout(ok, ms));
const fresh = async () => { await wait(P.HAPTIC_GAP_MS + 10); buzz.length = 0; };

test('each kind its own style: light, medium, success, heavy then success, error; the turn two pulses', async () => {
  P.setVibOn(true);
  for (const [kind, want] of [['tap', [['impact', 'LIGHT']]], ['medium', [['impact', 'MEDIUM']]], ['success', [['note', 'SUCCESS']]], ['error', [['note', 'ERROR']]]]) {
    await fresh(); assert.equal(P.haptic(kind), true); assert.deepEqual(buzz, want, kind);
  }
  await fresh(); P.haptic('win'); await wait(150); assert.deepEqual(buzz, [['impact', 'HEAVY'], ['note', 'SUCCESS']]);
  await fresh(); P.haptic('turn'); assert.deepEqual(buzz, [['impact', 'MEDIUM']]); await wait(150); assert.deepEqual(buzz, [['impact', 'MEDIUM'], ['impact', 'MEDIUM']], 'a double pulse');
});
test('rapid play is thinned (a second tap at once: none; a stronger buzz still comes), and Vibration off is silent', async () => {
  await fresh();
  P.haptic('tap'); P.haptic('tap'); P.haptic('tap');
  assert.deepEqual(buzz, [['impact', 'LIGHT']]);
  P.haptic('error');
  assert.deepEqual(buzz, [['impact', 'LIGHT'], ['note', 'ERROR']]);
  await fresh(); P.setVibOn(false);
  assert.equal(P.haptic('win'), false); assert.equal(buzz.length, 0);
  P.setVibOn(true);
});
test("a move's buzzes from its sounds: the tap, its result, the end of the mini-game", () => {
  state.online = null; state.cpu = 'O';                               // (against the computer: this player is X)
  assert.deepEqual(H.movePlan({ by: 'X' }, [['mark', 0]]), [['tap', 0]], 'a mark: a light tap');
  assert.deepEqual(H.movePlan({ by: 'X' }, [['rattle', 0], ['thunk', 600]]), [['tap', 0], ['medium', 600]], 'a die: the tap, then medium as it lands');
  assert.deepEqual(H.movePlan({ by: 'X' }, [['rattle', 0], ['thunk', 600], ['bust', 700]]), [['tap', 0], ['error', 700]], 'a bust: the error pattern');
  assert.deepEqual(H.movePlan({ by: 'X', winner: 'X' }, [['mark', 0], ['won', 500]]), [['tap', 0], ['success', 500]], 'won: success');
  assert.deepEqual(H.movePlan({ by: 'X', winner: 'O' }, [['mark', 0], ['won', 500]]), [['tap', 0], ['error', 500]], 'a move that hands the square over: lost');
  assert.equal(H.ownMove({ by: 'X' }), true); assert.equal(H.ownMove({ by: 'O' }), false, "the computer's move: no buzz");
  assert.equal(H.ownMove({ by: 'X', timeout: true }), false, 'a missed turn: nothing done here');
  state.online = { me: 'O' }; state.cpu = null;
  assert.equal(H.ownMove({ by: 'O' }), true); assert.equal(H.ownMove({ by: 'X' }), false, "the opponent's replay: no buzz");
  state.online = null; state.cpu = null;
  assert.equal(H.ownMove({ by: 'X' }), true, 'two people on one phone: every move is the one holding it');
});
test('a square stamped: claimed medium, lost to the other side the error pattern', async () => {
  state.online = { me: 'X' }; state.cpu = null;
  await fresh(); H.claimHaptic('X'); assert.deepEqual(buzz, [['impact', 'MEDIUM']]);
  await fresh(); H.claimHaptic('O'); assert.deepEqual(buzz, [['note', 'ERROR']]);
});
test('your turn: the chime and the double pulse once, after the other side moved; never on a first look or a bonus move', async () => {
  const plays = [], play = SND.play; SND.play = n => plays.push(n);
  try {
    state.flash = null; state.spot = null; state.winner = null;
    state.online = { me: 'X', game: 'g1' }; state.cpu = null;
    await fresh(); state.turn = 'X'; turnAlert(); assert.deepEqual(plays, [], 'the first look at a match (a reload, a reconnect): nothing');
    state.turn = 'O'; turnAlert(); assert.deepEqual(plays, [], 'the turn going to the other side: nothing');
    state.turn = 'X'; turnAlert(); assert.deepEqual(plays, ['yourTurn']); assert.deepEqual(buzz, [['impact', 'MEDIUM']]);
    turnAlert(); assert.deepEqual(plays, ['yourTurn'], 'once per turn');
    state.online = null; state.cpu = 'O'; state.id = 'm2'; plays.length = 0; await fresh();
    state.turn = 'X'; turnAlert('O'); assert.deepEqual(plays, ['yourTurn'], "against the computer: after its move");
    turnAlert('X'); assert.deepEqual(plays, ['yourTurn'], 'a bonus move: no second alert');
    state.cpu = null; state.id = 'm3'; plays.length = 0;
    state.turn = 'O'; turnAlert('X'); assert.deepEqual(plays, [], 'two people on one phone: no alert');
  } finally { SND.play = play; }
});
