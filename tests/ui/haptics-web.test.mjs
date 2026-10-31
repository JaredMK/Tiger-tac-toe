// The web page's haptics (net/platform.js haptic without the app): navigator.vibrate where the browser has it, each kind
// its own length or pattern, the turn a double pulse; nothing at all (and no error) where it has not, as Safari.
import test from 'node:test';
import assert from 'node:assert/strict';

const calls = [];
globalThis.window = {};
globalThis.localStorage = { getItem: () => null, setItem() {} };
Object.defineProperty(globalThis, 'navigator', { value: { vibrate: p => { calls.push(p); return true; } }, configurable: true, writable: true });
const P = await import('../../src/net/platform.js');
const wait = ms => new Promise(ok => setTimeout(ok, ms));

test('a browser with vibration: each kind its own buzz, the turn two pulses', async () => {
  assert.equal(P.NATIVE, false);
  assert.equal(P.canVibrate(), true);
  for (const k of ['tap', 'medium', 'success', 'error', 'turn']) { await wait(P.HAPTIC_GAP_MS + 10); assert.equal(P.haptic(k), true, k); }
  assert.deepEqual(calls, [8, 18, [20, 50, 30], [45, 40, 45], [22, 80, 22]]);
});
test('a browser without it (Safari): nothing, and no error', async () => {
  navigator.vibrate = undefined;
  await wait(P.HAPTIC_GAP_MS + 10);
  assert.equal(P.canVibrate(), false);
  assert.equal(P.haptic('turn'), false);
});
