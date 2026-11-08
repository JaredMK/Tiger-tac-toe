// Classic online never waits on your own move (November 2026): from the tap, through its play here (a physics shot's
// own simulation, a run, an attempt), until the server's record of it lands and the turn passes, the mover's phone
// shows no "Waiting for…", no "Sending your move…", no waiting band and no dimmed board; the server confirms in the
// background. Two phones, each a worker thread with the page's own modules (the browser's names stubbed, its timers on
// a mock clock), play every mini-game's online match through the Find Match path a friend room uses (net/moves.js
// dbMove, net/room.js applyMatch); this thread is the server (the engine's applyOnlineMove on the full record, as the
// move function runs it). Every render of the mover's phone during its own move is read.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const clone = v => JSON.parse(JSON.stringify(v));
const lcg = seed => () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const bank = n => ({ questions: Array.from({ length: n }, (_, i) => ({ id: 'q' + i, cat: 'Test', q: `Question ${i}?`, a: 'Right ' + i, wrong: ['Wrong a' + i, 'Wrong b' + i, 'Wrong c' + i] })) });
const WAIT = /Waiting for|Sending your|class="wband|board-scr waiting/;

if (isMainThread) {
  // ---------- the server, and the test ----------
  const E = require('../engine.js');
  const { makePhysics } = require('../../src/games/shared/physics-sim.js');
  E.setPhysics(makePhysics(require('matter-js')));
  E.setTriviaBank(bank(40));

  function phone(name) {
    const w = new Worker(new URL(import.meta.url), { workerData: { name } });
    const waiters = new Map();
    let seq = 0, onCall = null;
    w.on('message', msg => {
      if (msg.call) { onCall(msg); return; }
      const r = waiters.get(msg.id); waiters.delete(msg.id);
      if (r) r(msg);
    });
    const ask = (cmd, data) => new Promise(ok => { const id = ++seq; waiters.set(id, ok); w.postMessage(Object.assign({ id, cmd }, data)); });
    return { w, ask, set onCall(f) { onCall = f; } };
  }

  test('two phones, every mini-game: the mover never sees a waiting state during its own move (Classic online)', { timeout: 240000 }, async () => {
    const phones = { X: phone('X'), O: phone('O') };
    const report = [], checked = {}, shots = {}, skipped = [];
    try {
      for (const type of E.TYPES) {
        const games = Object.fromEntries(E.TYPES.map(g => [g, g === type]));
        let rec = null;
        try { rec = E.newOnlineMatch({ names: { X: 'Ann', O: 'Bo' }, games, timer: 0 }, lcg(7), 'm-' + type); } catch (e) { /* not dealt */ }
        if (!rec || !rec.state.squares.every(q => q.mini.type === type)) { skipped.push(type); continue; }   // (a game never dealt in a Classic match: Super Chaos's own)
        rec = clone(rec);
        const pub = () => JSON.stringify(rec.state);
        for (const s of ['X', 'O']) await phones[s].ask('init', { type, me: s, state: pub() });
        const rng = lcg(31);
        let pending = null;                                           // the mover's move call, until the server answers it
        for (const s of ['X', 'O']) phones[s].onCall = msg => { pending = { side: s, msg }; };
        const broadcast = async () => { for (const s of ['X', 'O']) await phones[s].ask('record', { state: pub() }); };
        const settle = async () => { for (const s of ['X', 'O']) { const r = await phones[s].ask('settle'); if (r.bad.length) report.push(...r.bad.map(b => `${type} ${s}: ${b}`)); checked[type] = (checked[type] || 0) + r.own; shots[type] = (shots[type] || 0) + r.shots; } };
        for (let k = 0; k < 3 && !rec.state.winner; k++) {
          const side = rec.state.turn, st = rec.state;
          const i = st.lock != null ? st.lock : st.squares.findIndex(q => !q.owner);
          if (i < 0) break;
          const mini = E.fullState(rec).squares[i].mini;
          if (E.ATT_TYPES.includes(type) || E.FINGER_TYPES.includes(type)) {   // Start first (the server's: the attempt or the round timed from it)
            const r = E.applyOnlineStart(rec, side, i, Date.now());
            if (r.ok) { rec = clone(r.rec); await broadcast(); await settle(); }
          }
          const m = E.randomLegalMove(E.fullState(rec).squares[i].mini, side, rng) ?? E.randomLegalMove(mini, side, rng);
          if (m == null) { skipped.push(type + ' (no move)'); break; }
          const go = await phones[side].ask('move', { i, m });          // the tap: the move goes to the server, and plays here at once where it can
          if (!go.sent) { report.push(`${type} ${side}: the move was not sent (${go.why})`); break; }
          assert.ok(pending && pending.side === side, `${type}: the move reached the server`);
          const r = E.applyOnlineMove(rec, side, i, pending.msg.data.move, lcg(100 + k), { rep: pending.msg.data.rep });
          const call = pending; pending = null;
          if (!r.ok) { await phones[side].ask('answer', { cid: call.msg.cid, result: { ok: false, reason: r.reason } }); await settle(); skipped.push(`${type} (refused: ${r.reason})`); break; }
          rec = clone(r.rec);
          if (k % 2) { await phones[side].ask('answer', { cid: call.msg.cid, result: { ok: true } }); await broadcast(); }   // (the call's answer first, then the listener's record; the other way round the next time)
          else { await broadcast(); await phones[side].ask('answer', { cid: call.msg.cid, result: { ok: true } }); }
          await settle();
        }
      }
    } finally { for (const s of ['X', 'O']) await phones[s].w.terminate(); }
    assert.deepEqual(report, [], 'no waiting state on the mover\'s phone during its own move');
    for (const t of ['golf', 'pool', 'bowling']) assert.ok(shots[t] > 0, `${t}: the shot played here at once, before the server's record (net/moves.js shotPredict)`);
    const none = E.TYPES.filter(t => !skipped.includes(t) && !checked[t]);
    assert.deepEqual(none, [], 'every dealt game had its own moves looked at');
    assert.ok(Object.keys(checked).length >= 45, `games checked: ${Object.keys(checked).length} (skipped: ${skipped.join(', ')})`);
    for (const fam of ['golf', 'pool', 'bowling', 'pinball', 'dash', 'skyhop', 'headcount', 'muncher', 'swarm', 'bricks', 'ttt', 'bingo', 'snake', 'takeover', 'wheels']) assert.ok(checked[fam] > 0, `${fam}: own-move renders checked`);
  });
} else {
  // ---------- a phone: the page's modules in this thread, its renders read ----------
  const { mock } = await import('node:test');
  const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
  let html = '';
  const appEl = new Proxy(function () {}, {
    get: (t, k) => (k === 'innerHTML' ? html : k === 'querySelector' ? () => null : k === 'querySelectorAll' ? () => [] : k === Symbol.toPrimitive ? () => '' : stub()),
    set: (t, k, v) => { if (k === 'innerHTML') { html = String(v); seen(html); } return true; },
  });
  const doc = new Proxy(function () {}, { get: (t, k) => (k === 'getElementById' ? id => (id === 'app' ? appEl : null) : k === 'visibilityState' ? 'visible' : k === 'hidden' ? false : k === Symbol.toPrimitive ? () => '' : stub()) });
  for (const k of ['window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
    try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
  }
  Object.defineProperty(globalThis, 'document', { value: doc, configurable: true, writable: true });
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'], now: 1.7e12 });
  Object.defineProperty(globalThis, 'performance', { value: { now: () => Date.now() - 1.7e12 + 1e5 }, configurable: true, writable: true });

  const { state } = await import('../../src/ui/app.js');            // (first: the page's own deal on load has no physics game in it)
  const G = await import('../../src/games/index.js');
  for (const t of G.TYPES) G.GAMES[t].view = await import(`../../src/games/${t}/view.js`);   // (the page registers the views in main.js)
  const E = await import('../../src/core/engine.js');
  const { makePhysics } = require('../../src/games/shared/physics-sim.js');
  E.setPhysics(makePhysics(require('matter-js/build/matter.min.js')));   // (the page's own Matter.js)
  E.setTriviaBank(bank(40));
  const C = await import('../../src/net/connect.js');
  const M = await import('../../src/net/moves.js');
  const R = await import('../../src/net/room.js');
  const P = await import('../../src/ui/physics.js');
  const RP = await import('../../src/ui/replay.js');
  const { render } = await import('../../src/ui/render.js');
  const MM = await import('../../src/net/matchmaking.js');
  const me = () => state.online && state.online.me;
  let own = false, ownN = 0, shotN = 0, bad = [];
  // The mover's own move: from the tap until the turn has passed (back on the board, the other side on the move), or the match is over.
  function seen(h) {
    if (!own || (state.turn !== me() && state.screen !== 'mini')) return;   // (the turn has passed: back on the board, the other side on the move, as it should say)
    ownN++; if (P.physPendOn()) shotN++;                              // (a physics shot of this phone's playing here, the server's record still to come)
    const m = h.match(WAIT);
    if (m) bad.push(`${state.screen}${state.zoom != null ? ' ' + state.zoom : ''} flash=${!!state.flash} wait=${!!R.moveWait} shot=${!!P.physPendOn()}: …${h.slice(Math.max(0, m.index - 60), m.index + 60).replace(/\s+/g, ' ')}…`);
  }
  const flush = async () => { for (let k = 0; k < 4; k++) await new Promise(r => setImmediate(r)); };
  const busy = () => !!(R.presenting() || R.pendingRoom || RP.repActive() || P.physPendOn());   // (a result, a replay, a stamp still playing here, or a record held for after it)
  async function run(ms) { for (let t = 0; t < ms; t += 20) { mock.timers.tick(20); await flush(); } }
  const calls = new Map();
  const pubOf = json => ({ players: { X: { name: 'Ann' }, O: { name: 'Bo' } }, state: json, timer: 0, mode: 'friend', status: 'playing' });   // (games/{id}/pub, as the listener reads it)
  let cid = 0;
  C.setFb({ fns: {}, uid: 'u-' + workerData.name, fnM: {}, db: {}, m: new Proxy({}, { get: () => () => Promise.resolve({ val: () => null }) }) });
  C.setConnected(true);
  C.setCall((name, data) => {
    if (name !== 'move') return Promise.resolve({ ok: true });
    return new Promise(ok => { const id = ++cid; calls.set(id, ok); parentPort.postMessage({ call: name, cid: id, data: clone(data) }); });
  });
  const ownOver = () => !own || !!state.winner || (!busy() && !R.moveWait && !calls.size);   // (its result played and the server's answer in)
  parentPort.on('message', async msg => {
    const reply = o => parentPort.postMessage(Object.assign({ id: msg.id }, o));
    try {
      if (msg.cmd === 'init') {
        own = false; await run(30000);                                  // (anything left of the last match plays out: one clock for the whole run, as a page has)
        P.physDrop(true); RP.repStop(); M.setPredicted(null);
        const st = JSON.parse(msg.state);
        state.online = { kind: 'mm', game: 'g-' + msg.type, me: msg.me, joined: true, matchId: null, shownSeq: null, room: 'ABCDE', code: 'ABCDE', role: msg.me === 'X' ? 'host' : 'guest', introFor: 'g-' + msg.type };
        Object.assign(state, { sc: null, cpu: null, flash: null, done: null, spot: null, winner: null, stats: null, lock: null, stamp: null, drawStamp: null, screen: 'board', zoom: null });
        state.setup.names = { X: 'Ann', O: 'Bo' };
        R.setPresentingSeq(null); R.setMoveWait(null); R.setPendingRoom(null);
        MM.onGameValue(pubOf(msg.state));
        own = false; bad = []; ownN = 0;
        reply({ ok: true, turn: st.turn });
      } else if (msg.cmd === 'record') {                               // the listener: the server's record (as onGameValue hands it on)
        MM.onGameValue(pubOf(msg.state));
        await flush();
        reply({ ok: true });
      } else if (msg.cmd === 'move') {                                // the tap (this phone's turn, the square open)
        for (let t = 0; t < 60000 && busy(); t += 20) await run(20);   // (anything still playing here first)
        state.screen = 'mini'; state.zoom = msg.i; render();
        own = true;
        const going = M.dbMove(msg.i, msg.m, null);
        await flush();
        if (!calls.size) { own = false; reply({ sent: false, why: `blocked=${R.blocked()} turn=${state.turn} me=${me()} lock=${state.lock} scr=${state.screen} seq=${JSON.parse(R.room.match.state).seq} shown=${state.online.shownSeq} pres=${R.presentingSeq} flash=${!!state.flash} spot=${!!state.spot} rep=${RP.repActive()} conn=${C.connected} done=${!!state.done} stamp=${state.stamp} pend=${!!R.pendingRoom} pz=${R.presenting()}` }); return; }
        going.catch(() => {});
        reply({ sent: true });
      } else if (msg.cmd === 'answer') {
        const ok = calls.get(msg.cid); calls.delete(msg.cid);
        if (ok) ok(msg.result);
        await flush();
        reply({ ok: true });
      } else if (msg.cmd === 'settle') {                              // time passes: the move plays out here (the mover's result, the other side's replay)
        for (let t = 0; t < 90000; t += 20) {
          await run(20);
          if (own && ownOver()) own = false;
          if (!own && !busy() && !R.moveWait) break;
        }
        const out = { bad: bad.slice(0, 5), own: ownN, shots: shotN };
        bad = []; ownN = 0; shotN = 0;
        reply(out);
      }
    } catch (e) { reply({ bad: [`threw: ${e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e}`], own: 0, sent: false, why: String(e) }); }
  });
}
