// A local match's stats (src/net/tracking.js): every square that ended in it reaches the admin's mini-game counts, the
// match-winning square included: completed (claimed by X or O) + resets (ended level, its board reset) + left open
// add up to every square played, as the server counts them (functions/statsRules.js checkEnd, endUpdates). The
// reports go through an outbox kept on the phone: a report the server could not take (offline, refused for now) is
// kept and sent again, the match's end included; one refused as malformed is dropped. Rendered in Node with the
// browser's names stubbed, a real localStorage and a stand-in SDK whose calls are recorded.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const store = new Map();
const storage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
for (const k of ['localStorage', 'sessionStorage']) Object.defineProperty(globalThis, k, { value: storage, configurable: true, writable: true });
Object.defineProperty(globalThis, 'window', { value: { TTT_FIREBASE: { config: { apiKey: 'k', databaseURL: 'https://stand-in.example' } }, addEventListener() {} }, configurable: true, writable: true });

const require = createRequire(import.meta.url);
const S = require('../../functions/statsRules.js');
const E = require('../engine.js');
const C = await import('../../src/net/connect.js');
const T = await import('../../src/net/tracking.js');
const { state } = await import('../../src/ui/app.js');
const { newMatch } = await import('../../src/core/match.js');
const { playMove, endFlash } = await import('../../src/core/board.js');
const { cpuMove } = await import('../../src/core/ai.js');
const { makeRng } = await import('../../src/core/random.js');

let sent = [], fail = null;                                        // fail(name, data): an error to throw, or nothing
C.setFb({ fns: {}, uid: 'u1', fnM: {} });
C.setCall(async (name, data) => { const e = fail && fail(name, data); if (e) throw e; sent.push({ name, data: JSON.parse(JSON.stringify(data)) }); return { ok: true }; });
const settle = async () => { for (let k = 0; k < 50; k++) await new Promise(r => setTimeout(r, 0)); };
const SLOW = ['golf', 'pool', 'bowling', 'pinball'];

// One whole local match on the page's own state: moves by the computer for both sides (as Play Computer plays its own
// side), after each move what the page does on every change (ui/app.js commit: trackEnd, reportLocal).
function playLocal(seed, cpu) {
  const rng = makeRng('track:' + seed);
  Object.assign(state, newMatch(rng, { games: E.TYPES.filter(t => !E.SC_ONLY.includes(t) && !SLOW.includes(t)) }), { online: null, cpu, sc: null, stats: null, screen: 'board', zoom: null });
  T.trackStart();
  for (let k = 0; k < 600 && !state.winner; k++) {
    const m = cpuMove(state, rng, null, { level: 'easy' });
    if (!m) break;
    assert.ok(playMove(state, m.square, m.move, rng).ok);
    T.trackEnd(); T.reportLocal();
    endFlash(state);
  }
  assert.ok(state.winner || state.winReason, `match ${seed} played to its end`);
}
// What the server makes of the reports: the mini-game counts they add (mini/{mode}/{type}/...).
function counted(mode) {
  const ends = sent.filter(c => c.name === 'track' && c.data.ev === 'end' && c.data.mode === mode);
  const tot = { won: 0, draw: 0, open: 0, played: 0 }, won = [];
  for (const c of ends) {
    const sum = S.checkEnd(c.data, E.TYPES.concat(E.OLD_TYPES));
    assert.ok(sum, 'the server takes the report');
    for (const [k, v] of Object.entries(S.endUpdates(mode, sum, 1000, Date.now(), false, []))) {
      const m = k.match(/^mini\/[^/]+\/([^/]+)\/(won|draw|open|played)$/);
      if (m) tot[m[2]] += v;
    }
    for (const e of sum.squares) if (e.end === 'won') won.push(`${e.t}:${e.w}`);
  }
  return { tot, won: won.sort(), ends: ends.length };
}

test('a full local match records every completed square, the match-winning one included, and the counts reconcile', async () => {
  for (const [seed, cpu, mode] of [[1, 'O', 'cpu'], [2, 'X', 'cpu'], [3, 'O', 'cpu'], [4, null, 'local'], [5, 'O', 'cpu']]) {
    sent = []; fail = null; T.outbox([]);
    playLocal(seed, cpu);
    await settle();
    const claimed = state.squares.filter(q => q.owner).map(q => `${q.mini.type}:${q.owner}`).sort();
    const resets = state.sqlog.filter(e => e.end === 'draw').length, open = state.squares.filter(q => !q.owner && q.mv && q.mv.X + q.mv.O).length;
    const c = counted(mode);
    assert.equal(c.ends, 1, `match ${seed}: its end reported once`);
    assert.equal(sent.filter(x => x.data.ev === 'start').length, 1, `match ${seed}: its start reported once`);
    assert.deepEqual(c.won, claimed, `match ${seed}: every claimed square counted as completed, the winning one included`);
    assert.equal(c.tot.won, claimed.length);
    assert.equal(c.tot.draw, resets, `match ${seed}: every reset counted`);
    assert.equal(c.tot.open, open);
    assert.equal(c.tot.played, c.tot.won + c.tot.draw + c.tot.open, `match ${seed}: completed + resets + left open = played`);
    assert.deepEqual(T.outbox(), [], 'nothing left waiting');
  }
});

test('the match\'s end is kept when the server cannot take it, sent again later (no double count), and a malformed one is dropped', async () => {
  sent = []; T.outbox([]);
  let down = true;
  fail = () => (down ? Object.assign(new Error('offline'), { code: 'unavailable' }) : null);
  playLocal(7, 'O');
  await settle();
  assert.equal(sent.length, 0, 'nothing reached the server');
  const waiting = T.outbox().map(r => r.data.ev);
  assert.deepEqual(waiting, ['start', 'end'], 'the start and the end kept, in order');
  assert.ok(storage.getItem(Object.keys(Object.fromEntries(store)).find(k => k.endsWith('.outbox'))), 'kept in storage: a reload or the next visit sends them');
  await T.flushOutbox();                                          // a retry while still offline: still kept
  assert.equal(T.outbox().length, 2);
  down = false;
  await T.flushOutbox();                                          // back online (a return to the page, the network, the retry timer)
  assert.deepEqual(sent.map(x => x.data.ev), ['start', 'end']);
  assert.deepEqual(T.outbox(), []);
  const claimed = state.squares.filter(q => q.owner).length;
  assert.equal(counted('cpu').tot.won, claimed, 'every claimed square, once');
  // the server refusing a report for now (too many reports, not signed in yet): kept; refused as malformed: dropped
  sent = [];
  fail = (n, d) => (d.ev === 'end' ? Object.assign(new Error('bad'), { code: 'invalid-argument' }) : Object.assign(new Error('slow down'), { code: 'resource-exhausted' }));
  T.track({ ev: 'end', mode: 'cpu', id: 'malformed1', squares: 'x' });
  await settle();
  assert.deepEqual(T.outbox(), [], 'a malformed report is not kept');
  T.track({ ev: 'start', mode: 'cpu', id: 'later01' });
  await settle();
  assert.equal(T.outbox().length, 1, 'refused for now: kept');
  fail = null;
  await T.flushOutbox();
  assert.deepEqual(T.outbox(), []); assert.equal(sent.length, 1);
});
