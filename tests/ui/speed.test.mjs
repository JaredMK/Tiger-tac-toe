// Speed (the player's Animation setting) and the admin's multipliers reach every duration (December 2026): one timing
// function, core/timer.js dur(ms, kind, type, rs), takes each base figure to the screen. Real moves of several games
// (their own animations, a replay of them, the result's hold), the interface's own moments (the computer's pauses,
// the board's glow, the zoom) are measured in Normal and in Speed; and no page code reads the pace past it.
// Rendered in Node with the browser's names stubbed (no page needed).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'matchMedia', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const require = createRequire(import.meta.url);
const E = require('../engine.js');
E.setPhysics(require('../physics.js'));
const T = await import('../../src/core/timer.js');
const { CPU_MS, spotMs } = await import('../../src/ui/app.js');
const { ZOOM, zoomMs } = await import('../../src/ui/fx.js');
const { holdOf } = await import('../../src/ui/turns.js');
const ROOT = new URL('../../', import.meta.url);

// A real move of game t: a match of that game alone, a legal move played on its centre square: its flash.
function realFlash(t) {
  const st = E.newMatch(E.makeRng('spd-' + t), { games: [t] }); st.turn = 'X';
  for (let k = 0; k < 6; k++) {
    const m = E.randomLegalMove(st.squares[4].mini, 'X', E.makeRng('m' + t + k));
    if (m != null && E.playMove(st, 4, m, E.makeRng('p' + k)).ok && st.flash) return st.flash;
  }
  return null;
}
// What this phone shows of it at the setting in force: the mover's own move, a replay of it, the result's hold.
const shown = f => ({ own: T.dur(T.playMs(f), 'move', f.type, 1), replay: T.dur(T.playMs(f), 'move', f.type, T.replaySpeed()), hold: T.dur(holdOf(f), 'hold', f.type, 1) });
const GAMES = ['ttt', 'c4', 'wordle', 'hilo', 'memory', 'pig', 'bglite', 'coins', 'candy', 'bj', 'hangman', 'bowling', 'pusher', 'golf'];

test('Speed shortens real durations across games: a move\'s animation (a real-time game\'s own attempt alone stays as it was played), its replay, its hold', () => {
  try {
    let n = 0;
    for (const t of GAMES) {
      const f = realFlash(t);
      if (!f) continue;
      n++;
      T.setAnimMode('normal'); const a = shown(f);
      T.setAnimMode('speed'); const b = shown(f);
      const rt = !!require('../../src/games/' + t + '/meta.js').realTime;
      assert.ok(a.own > 0, `${t}: a real duration`);
      if (rt) assert.equal(b.own, a.own, `${t}: the mover's own attempt plays as it was played`);
      else assert.ok(b.own <= a.own * 0.55, `${t}: its animation halves (${a.own} -> ${b.own})`);
      assert.ok(b.replay <= a.replay * 0.55, `${t}: a replay of it halves too, real-time games included (${a.replay} -> ${b.replay})`);
      assert.ok(a.hold === 0 ? b.hold === 0 : b.hold < a.hold, `${t}: its hold is shorter (${a.hold} -> ${b.hold}; none: a step that keeps the turn)`);
    }
    assert.ok(n >= 10, `moves played in ${n} games`);
  } finally { T.setAnimMode('normal'); }
});

test('Speed shortens the interface\'s own moments: the computer\'s pauses, the board\'s glow, the zoom', () => {
  const off = ZOOM.off; ZOOM.off = false;
  try {
    T.setAnimMode('normal'); const a = { think: CPU_MS.think, spot: CPU_MS.spot, glow: spotMs(), zoom: zoomMs(), ui: T.dur(1000) };
    T.setAnimMode('speed'); const b = { think: CPU_MS.think, spot: CPU_MS.spot, glow: spotMs(), zoom: zoomMs(), ui: T.dur(1000) };
    for (const k of Object.keys(a)) assert.ok(b[k] < a[k], `${k}: ${a[k]} -> ${b[k]}`);
    assert.equal(T.dur(1000, 'real'), 1000, 'a game\'s own clock never changes');
  } finally { T.setAnimMode('normal'); ZOOM.off = off; }
});

test('the admin\'s multipliers reach the same durations: the Animation speed for everyone, Speed\'s own for Speed', () => {
  const f = realFlash('ttt');
  try {
    T.setAnimMode('normal'); const base = shown(f).own;
    T.setAnimSpeed(2); assert.equal(shown(f).own, base / 2, 'the admin\'s speed 2: everything twice as fast');
    T.setAnimSpeed(1); T.setAnimMode('speed'); T.setAnimFast(3); assert.equal(shown(f).own, base / 3, 'Speed at 3x');
    assert.equal(CPU_MS.spot, 400 / 3);
  } finally { T.setAnimSpeed(1); T.setAnimFast(2); T.setAnimMode('normal'); }
});

test('one timing function: no page code reads the pace (ANIM.speed) past core/timer.js dur / durRate', () => {
  const files = [];
  const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = d + '/' + e.name; if (e.isDirectory()) walk(p); else if (p.endsWith('.js')) files.push(p); } };
  walk(new URL('src', ROOT).pathname);
  const bad = [];
  for (const p of files) {
    if (p.endsWith('/core/timer.js')) continue;
    fs.readFileSync(p, 'utf8').split('\n').forEach((l, i) => { const code = l.replace(/\/\/.*$/, ''); if (/ANIM\.speed\b/.test(code)) bad.push(`${p.replace(/.*\/src\//, 'src/')}:${i + 1}`); });
  }
  assert.deepEqual(bad, [], 'read the pace through dur()/durRate()');
});
