// Echo's console (src/games/echo/view.js, the polish pass of November 2026): four pads, each its own shape, corner and
// note; the hub and the plate's ring say whether the pattern is being watched or the pads are the mover's; the step pips
// count the pattern as it plays and the taps as they come back; a pattern beaten runs up the pads, a slip marks the wrong
// pad and shows the right one. The pattern's own timings (rules.js ECHO.step, flash, gap, tap) are the game and are not
// touched. Rendered in Node with the browser's names stubbed (motion allowed: matchMedia says no reduced motion).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : k === 'matchMedia' ? () => ({ matches: false }) : k === 'getItem' ? () => null : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
for (const k of ['document', 'window', 'localStorage', 'sessionStorage', 'navigator', 'location', 'history', 'requestAnimationFrame', 'cancelAnimationFrame', 'Element', 'HTMLElement', 'CSS', 'AudioContext', 'Image', 'getComputedStyle']) {
  try { Object.defineProperty(globalThis, k, { value: stub(), configurable: true, writable: true }); } catch (e) { /* (kept) */ }
}
const require = createRequire(import.meta.url);
const E = require('../engine.js');
const { GAMES } = await import('../../src/games/index.js');
const V = await import('../../src/games/echo/view.js');
const R = await import('../../src/games/echo/rules.js');
const { state, REDUCED } = await import('../../src/ui/app.js');
state.setup = Object.assign({}, state.setup, { names: { X: 'Xena', O: 'Olaf' } });

const clone = v => JSON.parse(JSON.stringify(v));
const mini0 = () => E.newMini('echo', E.makeRng('echo-ui'));
function play(mini, p, move, kind) {
  const m = clone(mini), res = E.applyMove(m, p, move, E.makeRng('x'));
  assert.equal(res.ok, true);
  const flash = { kind: kind || 'move', by: p, next: p, square: 0, type: 'echo', note: res.note || null, pass: null, timeout: false };
  GAMES.echo.rules.moveFlash(move, p, null, 0, m, flash);
  return { mini: m, flash };
}
// the screen as this phone sees it: X is the person here, O the computer
const screen = (mini, flash, locked, turn) => { state.cpu = 'O'; state.online = null; state.squares = [{ owner: null, mini }]; state.zoom = 0; state.moves = 1; return V.screen(state.squares[0], flash, null, mini, false, !!locked, flash, null, false, () => -1, false, turn || 'X', ''); };
const pads = html => [...html.matchAll(/<button class="(epad k\d[^"]*)"([^>]*)>/g)].map(m => ({ cls: m[1], attrs: m[2] }));
const sounds = f => { const out = []; V.sounds(f, (n, ms, r) => out.push([n, ms, r])); return out; };

test('the console: four pads, each with its own shape; before Play pattern the hub is an eye, the plate plain, the pads off and one empty pip a step', () => {
  assert.equal(REDUCED, false);
  const m = mini0(), html = screen(m, null, false, 'X');
  const p = pads(html);
  assert.deepEqual(p.map(x => x.cls), ['epad k0', 'epad k1', 'epad k2', 'epad k3']); assert.ok(p.every(x => / disabled/.test(x.attrs)), 'nothing to tap before the pattern has played');
  assert.equal(new Set([...html.matchAll(/<button class="epad k\d[^>]*><svg viewBox="0 0 24 24" aria-hidden="true">(<[^>]+>)<\/svg>/g)].map(x => x[1])).size, 4, 'four different shapes');
  assert.match(html, /class="epads idle"/); assert.match(html, /<span class="ehw">/); assert.doesNotMatch(html, /ehg|ering/);
  assert.equal((html.match(/<div class="esteps X"[^>]*>(.*?)<\/div>/)[1].match(/<i class=""><\/i>/g) || []).length, 4);
  assert.match(html, /<button class="big eplay X" data-act="echo-play">/);
  assert.doesNotMatch(screen(m, null, true, 'O'), /cbtns one"/, 'not this phone\'s go: Play pattern kept for its room, hidden');
  for (const k of [0, 1, 2, 3]) assert.match(V.miniature(m), new RegExp(`<i class="k${k}"><svg`));
});

test('someone else\'s attempt: watched as their screen showed it (eye and ink pips while their pattern plays, then their colour, a finger and their taps), at the pattern\'s own timings', () => {
  const m0 = mini0(), seq = R.echoSeq(m0, 'O', 0), c = play(m0, 'O', seq.slice()), e = c.flash.echo, A = R.echoAim(e), S = R.ECHO.step;
  const html = screen(c.mini, c.flash, true, 'O');
  assert.equal(V.echoPre(c.flash), A.end);
  assert.match(html, new RegExp(`<span class="ehw tu" style="--u:${A.play}ms">`)); assert.match(html, new RegExp(`<span class="ehg O tf" style="--f:${A.play}ms">`)); assert.match(html, new RegExp(`<i class="ering O tf" style="--f:${A.play}ms">`));
  const p = pads(html);
  seq.forEach((k, i) => { assert.ok(p[k].attrs.includes(`padlit ${R.ECHO.flash}ms ${i * S}ms`), `step ${i}: its pad lit at ${i * S} ms for ${R.ECHO.flash}`); assert.ok(p[k].attrs.includes(`padlit .3s ${A.tap(i)}ms`), `tap ${i}`); });
  const pips = html.match(/<div class="esteps O">(.*?)<\/div>/)[1];
  seq.forEach((_, i) => assert.ok(pips.includes(`--an:eseen ${A.play - i * S}ms ${i * S}ms, etap 1ms ${A.tap(i)}ms forwards`), 'a pip: in ink from its step to the pattern\'s end, then filled as its tap lands'));
  // the result after it: the pads in a rising run, the tick, the pip and the words with the ding
  const F = V.echoFx(e, A.end);
  assert.deepEqual(F, { wave: A.end, ding: A.end + V.ECHO_FX.ding, slip: A.end, hint: A.end + V.ECHO_FX.hint });
  [0, 1, 2, 3].forEach(k => assert.ok(p[k].attrs.includes(`padlit ${V.ECHO_FX.lit}ms ${F.wave + k * V.ECHO_FX.step}ms`)));
  assert.match(html, new RegExp(`<span class="ehr tf" style="--f:${F.ding}ms">`)); assert.match(html, new RegExp(`class="arcres ok appear" style="--t:${F.ding}ms"`));
  const snd = sounds(c.flash), tones = snd.filter(s => s[0] === 'tone');
  assert.deepEqual(tones.slice(0, 4).map(s => s[1]), seq.map((_, i) => i * S)); assert.deepEqual(tones.slice(4, 8).map(s => s[1]), seq.map((_, i) => A.tap(i)));
  assert.deepEqual(tones.slice(8).map(s => [s[1], s[2]]), [0, 1, 2, 3].map(k => [F.wave + k * V.ECHO_FX.step, [1, 1.26, 1.5, 2][k]]), 'the run: the four pads\' notes, rising');
  assert.deepEqual(snd[snd.length - 1].slice(0, 2), ['ding', F.ding]);
  assert.equal(R.flashMs(c.flash, 4, false), A.end + R.ECHO.result); assert.ok(R.ECHO.result >= V.ECHO_FX.wave + 3 * V.ECHO_FX.step + V.ECHO_FX.lit, 'the result\'s time holds the run');
});

test('this phone\'s own result: a pattern beaten runs up the pads from the last tap\'s note; the last pattern lights all four twice more; a slip marks the pad tapped, buzzes at once and shows the right pad with its note', () => {
  const m0 = mini0(), seq = R.echoSeq(m0, 'X', 0), ok = play(m0, 'X', seq.slice());
  assert.equal(V.echoPre(ok.flash), 0, 'made here: nothing replayed first');
  const html = screen(ok.mini, ok.flash, true, 'X'), p = pads(html), F = V.echoFx(ok.flash.echo, 0);
  assert.deepEqual(F, { wave: V.ECHO_FX.wave, ding: V.ECHO_FX.wave + V.ECHO_FX.ding, slip: 0, hint: V.ECHO_FX.hint });
  [0, 1, 2, 3].forEach(k => assert.equal(p[k].attrs.match(/--lit:([^"]*)"/)[1], `padlit ${V.ECHO_FX.lit}ms ${F.wave + k * V.ECHO_FX.step}ms`));
  assert.match(html, /<span class="ehg X">/); assert.match(html, /<i class="ering X">/); assert.match(html, />Pattern 1 beaten!</);
  assert.equal((html.match(/<div class="esteps X">(.*?)<\/div>/)[1].match(/<i class="on">/g) || []).length, seq.length);
  assert.deepEqual(sounds(ok.flash).map(s => s[0]), ['tone', 'tone', 'tone', 'tone', 'ding']);
  const last = play(Object.assign(clone(m0), { level: { X: 3, O: 0 } }), 'X', R.echoSeq(m0, 'X', 3), 'claim');
  assert.ok(pads(screen(last.mini, last.flash, true, 'X')).every(x => (x.attrs.match(/padlit/g) || []).length === 3), 'the square won: the run, then all four pads together, twice');
  // a slip at the second step
  const wrong = (seq[1] + 1) % 4, no = play(m0, 'X', [seq[0], wrong]), h2 = screen(no.mini, no.flash, true, 'X'), q = pads(h2), G = V.echoFx(no.flash.echo, 0);
  assert.equal(no.flash.echo.failAt, 1);
  assert.ok(q[wrong].attrs.includes('cardshake .45s 0ms, padbad 1ms 0ms forwards')); assert.match(h2, new RegExp(`data-k="${wrong}"[^>]*>.*?<i class="ebad tf" style="--f:0ms">`));
  assert.ok(q[seq[1]].attrs.includes(`padhint .7s ${G.hint}ms`), 'the pad it should have been');
  assert.match(h2, /<div class="esteps X"><i class="on"><\/i><i class="no"><\/i><i class=""><\/i><i class=""><\/i><\/div>/); assert.match(h2, />Slipped at step 2 of 4</); assert.doesNotMatch(h2, /class="ehr/);
  assert.deepEqual(sounds(no.flash), [['buzz', 0, undefined], ['tone', G.hint, [1, 1.26, 1.5, 2][seq[1]]]]);
  const out = Object.assign({}, play(m0, 'X', 'auto').flash, { timeout: true });
  assert.deepEqual(sounds(out).map(s => s[0]), ['tone'], 'a missed turn: the page\'s own buzz, then the pad it began with');
});

test('the stylesheet carries the console (pads in colours that are no player\'s) and sound.js the voices', () => {
  const css = fs.readFileSync(new URL('../../src/ui/styles.css', import.meta.url), 'utf8');
  for (const c of ['.epad.on', '@keyframes padlit', '@keyframes padbad', '@keyframes padhint', '.ehub', '.ering', '.esteps i.nx', '@keyframes eseen', '.tepads i.k3']) assert.ok(css.includes(c), c);
  const padCss = css.split('\n').find(l => l.startsWith('.epad.k0 {'));
  assert.doesNotMatch(padCss, /--x\b|--o\b|--cr\b|--cy\b|#e5432a|#f6c21b/, 'no pad in X\'s red or O\'s yellow');
  const src = fs.readFileSync(new URL('../../src/audio/sound.js', import.meta.url), 'utf8');
  for (const n of ['tone', 'ding', 'buzz']) assert.match(src, new RegExp(`^def\\('${n}',`, 'm'));
});
