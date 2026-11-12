// Echo: the screen, the miniature, the move's words and sounds, and the inputs.
import { ECHO, echoAim, echoLens, echoSeq } from './rules.js';
import { tune } from '../../core/tune.js';
import { SND, ownPress } from '../../audio/sound.js';
import { attemptMove } from '../../net/moves.js';
import { haptic } from '../../net/platform.js';
import { blocked } from '../../net/room.js';
import { N, REDUCED, app, cpuPlays, state } from '../../ui/app.js';
import { fxAttr, startFx } from '../../ui/fx.js';
import { pipRows, thumbArt } from '../../ui/thumbs.js';
import { arcTally, lateAt } from '../../ui/progress.js';
import { render } from '../../ui/render.js';

export let echoDraft = null;
// Echo: one 10-step pattern per square, the same for both players (each level its first 4, 6, 8 or 10
// steps). The square opens on a Play pattern button: nothing plays until it is tapped, and from then the
// player stays in the square (no Board button) until the attempt goes in. The pattern plays once (each step a
// flash and a tone, from the tap); then the pads come alive, and each tap lights its pad and sounds. The taps
// go in as one move when complete or at the first slip. Someone else's attempt (the computer's, the other
// phone's) plays as their screen did: the pattern, a beat, their taps, then the result.
const ECHO_RATES = [1, 1.26, 1.5, 2];   // each pad's note (a pad's tone lasts up to 0.3 s: the result's run of notes starts as the last tap's dies away, ECHO_FX.wave)
// The pads' shapes (original, drawn here): a diamond, a disc, a triangle, a square; each pad has its own colour, shape,
// corner of the console and note, so none is told from another by colour alone.
const ECHO_SHAPES = ['<path d="M12 2.4L21.6 12 12 21.6 2.4 12z"/>', '<circle cx="12" cy="12" r="8.8"/>', '<path d="M12 3L21.8 20.2H2.2z"/>', '<rect x="3.6" y="3.6" width="16.8" height="16.8" rx="2.8"/>'];
const shape = k => `<svg viewBox="0 0 24 24" aria-hidden="true">${ECHO_SHAPES[k]}</svg>`;
const EYE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="l" d="M2.2 12c2.6-4.3 5.9-6.4 9.8-6.4s7.2 2.1 9.8 6.4c-2.6 4.3-5.9 6.4-9.8 6.4S4.8 16.3 2.2 12z"/><circle class="p" cx="12" cy="12" r="3.3"/></svg>';
const HAND = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.2 12.6V4.7a1.7 1.7 0 0 1 3.4 0v5.5l5 1.1c1.200.3 2 1.300 2 2.500v1.700c0 3-2.400 5.400-5.400 5.400h-1.900c-1.600 0-3.100-.8-4-2.100l-3.300-4.600c-.5-.7-.4-1.700.3-2.300.7-.6 1.700-.5 2.300.1z"/></svg>';   // the mover's go: a finger on the hub, in their colour
const TICK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.8l4.600 4.600L19.200 7"/></svg>', CROSS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
// The moments of an attempt's result on the screen (ms from the move; pre: someone else's attempt played first, else 0).
// A pattern beaten: the pads light in a rising run (wave + j x step, a note each), the ding, the level's pip and the words at `ding`.
// A slip: the wrong pad shakes and buzzes at `slip` (the tap itself), the right pad shows, with its note, at `hint`.
export const ECHO_FX = { wave: 260, step: 80, lit: 240, ding: 320, hint: 380 };
export function echoFx(e, pre) {
  const A = pre ? echoAim(e) : null, w0 = pre || ECHO_FX.wave, slip = pre && e.failAt >= 0 && e.failAt < e.taps.length ? A.tap(e.failAt) : pre;
  return { wave: w0, ding: w0 + ECHO_FX.ding, slip, hint: slip + ECHO_FX.hint };
}
const ECHO_KEY = 'ttt-echo-played';                             // the attempt whose pattern has played: a reload does not play it again
const echoId = (sq, p, lvl) => `${state.online ? state.online.matchId || state.online.code || 'on' : 'local'}:${state.moves}:${sq}:${p}:${lvl}:${(state.squares[sq].mini.base || []).join('')}`;
export function echoPre(f) { return f && f.type === 'echo' && f.echo && !f.timeout && !REDUCED && (state.online ? f.by !== state.online.me : cpuPlays(f.by)) ? echoAim(f.echo).end : 0; }   // someone else's attempt: it plays first
export const echoPinned = () => !!(echoDraft && echoDraft.at != null && state.screen === 'mini' && state.zoom === echoDraft.sq && !state.flash);
// The screen: the tallies (each player's patterns beaten as square pips), the console (four chunky pads round a hub on a
// dark plate), the step pips under it and the result line. What state it is in shows without a word:
//   watching (the pattern playing): the hub is an eye, the plate plain, a step pip fills in ink as each step lights;
//   your go (the pads alive): the hub is a finger on the mover's colour, the plate ringed in it, the pips empty again,
//     the next one ringed, each filling in the mover's colour as its pad is tapped;
//   the result: a tick or a cross on the hub; a pattern beaten lights the pads in a rising run; a slip shakes the wrong
//     pad under a cross and shows the right one in a green ring.
function echoTable(mini, a, o) {
  const e = a && a.echo ? a.echo : null, l = mini.last, turn = o.turn, mover = e ? a.by : turn, S = tune(mini).step || ECHO.step;   // (the admin's settings: the pattern's pace)
  const pre = e ? echoPre(a) : 0, A = pre ? echoAim(e) : null, F = e ? echoFx(e, pre) : null, won = !!e && (a.kind === 'claim' || a.kind === 'match');
  const levels = p => `<span class="elev" aria-label="${mini.level[p]} of 4 patterns">${(mini.base ? echoLens(tune(mini)) : ECHO.lengths).map((n, k) => `<i ${lateAt(k < mini.level[p] ? 'on' : '', e && e.pass && a.by === p && k === mini.level[p] - 1 ? F.ding : null, 'fillin')} title="${n} steps"></i>`).join('')}</span>`;
  const tal = p => arcTally(p, o, levels(p));
  const lvl = e ? e.level : Math.min(mini.level[mover], ECHO.lengths.length - 1);
  const seq = e && e.seq && e.seq.length ? e.seq : echoSeq(mini, mover, lvl);
  const mine = !o.view && !e && !o.locked;                      // this phone's attempt
  if (!mine) echoDraft = null;
  else {
    const id = echoId(o.zoom, mover, lvl);
    if (!echoDraft || echoDraft.id !== id) {                     // a fresh attempt: waiting for Play pattern (or, after a reload mid-attempt, straight to the pads)
      let played = false; try { played = localStorage.getItem(ECHO_KEY) === id; } catch (err) { /* no storage */ }
      echoDraft = { id, sq: o.zoom, level: lvl, taps: [], at: played ? -1 : null };
    }
  }
  const started = mine && echoDraft.at != null, fresh = started && echoDraft.at >= 0, playEnd = seq.length * S;
  const bad = e && !e.pass && e.failAt >= 0 ? e.taps[e.failAt] : -1, right = e && !e.pass && e.failAt >= 0 ? seq[e.failAt] : -1;   // a slip: the pad tapped, the pad it should have been
  const anims = k => {                                           // each pad's flashes, timed from the Play tap (or from the move)
    const out = [];
    if (fresh || pre) seq.forEach((x, i) => { if (x === k) out.push(`padlit ${ECHO.flash}ms ${i * S}ms`); });   // (shorter than a step: the same pad twice in a row flashes twice, dark between)
    if (pre) e.taps.forEach((x, i) => { if (x === k && !(i === e.failAt && !e.pass)) out.push(`padlit .3s ${A.tap(i)}ms`); });
    if (e && e.pass) out.push(`padlit ${ECHO_FX.lit}ms ${F.wave + k * ECHO_FX.step}ms`);   // a pattern beaten: the pads light in a rising run (no fill: an animation held early would cover the flashes listed before it)
    if (e && e.pass && won) out.push(`padlit 200ms ${F.ding + 80}ms`, `padlit 280ms ${F.ding + 340}ms`);   // the last pattern: all four together, twice (the game's own winning moment)
    if (bad === k) out.push(`cardshake .45s ${F.slip}ms`, `padbad 1ms ${F.slip}ms forwards`);
    else if (right === k) out.push(`padhint .7s ${F.hint}ms`);
    return out.join(', ');
  };
  const live = started;
  const pad = k => {
    const an = anims(k);
    const cls = 'epad k' + k + (an ? ' play' : '') + (live ? ' live' : '');
    return `<button class="${cls}"${an ? ` style="--lit:${an}"` : ''} data-act="echo-tap" data-k="${k}" aria-label="Pad ${k + 1}"${live ? '' : ' disabled'}>${shape(k)}${bad === k ? `<i class="ebad tf" style="--f:${F.slip}ms">${CROSS}</i>` : ''}</button>`;
  };
  // the hub and the plate's ring: an eye while the pattern plays (until `u`), then a finger on the mover's colour (from it)
  const u = fresh ? playEnd : pre ? A.play : null, go = started || !!e;
  const hub = `<div class="ehub" aria-hidden="true">${go && u == null ? '' : `<span class="ehw${u != null ? ' tu' : ''}"${u != null ? ` style="--u:${u}ms"` : ''}>${EYE}</span>`}${go ? `<span class="ehg ${mover}${u != null ? ' tf' : ''}"${u != null ? ` style="--f:${u}ms"` : ''}>${HAND}</span>` : ''}${e && e.pass ? `<span class="ehr tf" style="--f:${F.ding}ms">${TICK}</span>` : ''}</div>`;
  const ring = go ? `<i class="ering ${mover}${u != null ? ' tf' : ''}"${u != null ? ` style="--f:${u}ms"` : ''}></i>` : '';
  const lock = fresh ? `<div class="elock tu" style="--u:${playEnd}ms" aria-hidden="true"></div>` : '';
  const pads = `<div class="epads${mine && !started ? ' idle' : ''}">${ring}${[0, 1, 2, 3].map(pad).join('')}${hub}${lock}</div>`;
  // the step pips: each fills in ink as its step of the pattern lights (and all clear as the pattern ends), then in
  // the mover's colour as its pad is tapped back, the next one ringed
  const taps = started ? echoDraft.taps : [];
  const seen = i => `eseen ${(u - i * S).toFixed(0)}ms ${(i * S).toFixed(0)}ms`;
  const steps = mine ? `<div class="esteps ${mover}" aria-label="${taps.length} of ${seq.length} tapped">${seq.map((_, i) => `<i class="${i < taps.length ? 'on' : started && i === taps.length ? 'nx' + (fresh ? ' late' : '') : ''}"${fresh ? ` style="--f:${playEnd}ms;--an:${seen(i)}"` : ''}></i>`).join('')}</div>`
    : pre ? `<div class="esteps ${mover}">${seq.map((_, i) => { const hit = i < e.taps.length && (e.pass || i < e.failAt); return `<i style="--an:${seen(i)}${hit ? `, etap 1ms ${A.tap(i)}ms forwards` : i === e.failAt && !e.pass && i < e.taps.length ? `, eslip 1ms ${A.tap(i)}ms forwards` : ''}"></i>`; }).join('')}</div>`
    : e ? `<div class="esteps ${mover}">${seq.map((_, i) => `<i class="${i < e.taps.length && (e.pass || i < e.failAt) ? 'on' : i === e.failAt && !e.pass && i < e.taps.length ? 'no' : ''}"></i>`).join('')}</div>` : '<div class="esteps"></div>';
  const who = p => `<b class="${p}">${N(p)}</b>`;
  const note = !mine ? (pre ? `<p class="arcnote">${who(mover)} · pattern ${lvl + 1}</p>`
      : e ? '<p class="arcnote"></p>' : o.view ? `<p class="arcnote">Patterns beaten: X ${mini.level.X}, O ${mini.level.O}</p>` : `<p class="arcnote">${who(turn)} is on pattern ${lvl + 1}</p>`)
    : '<p class="arcnote"></p>';   // (how to play is in the ? explainer)
  const res = e ? `<p ${lateAt('arcres ' + (e.pass ? 'ok' : 'no'), e.pass ? F.ding : pre)} role="status">${e.pass ? (pre ? `${who(mover)} beat pattern ${e.level + 1}` : `Pattern ${e.level + 1} beaten!`) : `${pre ? who(mover) + ' slipped' : 'Slipped'} at step ${e.failAt + 1} of ${e.len}`}</p>`
    : l && !mine ? `<p class="arcres ${l.pass ? 'ok' : 'no'}">${l.pass ? `${who(l.by)} beat pattern ${l.level + 1}` : `${who(l.by)} slipped at step ${l.failAt + 1}`}</p>` : '<p class="arcres"></p>';
  const goBtn = mine && !started;
  const play = o.view ? '' : `<div class="cbtns one${goBtn ? '' : ' hold'}"><button class="big eplay ${mover}" data-act="echo-play"${goBtn ? '' : ' disabled tabindex="-1" aria-hidden="true"'}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l12.5-7.5z"/></svg>Play pattern</button></div>`;   // the row stays (hidden) so the pads never move
  return `<div class="g-arc g-echo"><div class="ctals">${tal('X')}${tal('O')}</div><div class="echo"${fxAttr(fresh ? echoDraft.at : null, 'rt')}>${note}${pads}${steps}${res}</div>${play}</div>`;
}
// Echo: a pad tapped back (from the press itself: no waiting for the click). It lights and sounds; the
// attempt goes in when it is complete, or at the first slip.
function echoTap(el) {
  if (!echoDraft || echoDraft.at == null || echoDraft.sq !== state.zoom || state.flash || state.done || blocked()) return;
  const k = Number(el.dataset.k), seq = echoSeq(state.squares[state.zoom].mini, state.turn, echoDraft.level);
  SND.play('tone', { rate: ECHO_RATES[k] }); haptic('tap');
  el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
  clearTimeout(el.offTimer); el.offTimer = setTimeout(() => el.classList.remove('on'), 220);
  echoDraft.taps.push(k);
  const n = echoDraft.taps.length;
  if (seq[n - 1] !== k || n === seq.length) {
    const taps = echoDraft.taps.slice(); echoDraft = null;
    try { localStorage.removeItem(ECHO_KEY); } catch (err) { /* no storage */ }
    attemptMove(taps); return;
  }
  const dots = app.querySelectorAll('.esteps i');   // (in place: the pads keep their place and their animations)
  if (dots[n - 1]) { dots[n - 1].classList.remove('nx', 'late'); dots[n - 1].classList.add('on'); }
  if (dots[n]) dots[n].classList.add('nx');
}
const ECHO_MINI = `<div class="tepads">${[0, 1, 2, 3].map(k => `<i class="k${k}">${shape(k)}</i>`).join('')}</div>`;   // the console, small: the four pads on their plate
export function miniature(mini, final) {   // the pads, and each player's levels passed as square pips
  return thumbArt(ECHO_MINI, pipRows(mini.level, ECHO.lengths.length, true), '', `Echo: X at level ${mini.level.X}, O at ${mini.level.O} of ${ECHO.lengths.length}`);
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = echoTable(mini, a, { view, locked, turn, zoom: state.zoom }); return g;
}
export function moveText(f, who) {
  return f.echo ? (f.echo.pass ? `${who} beat pattern ${f.echo.level + 1}` : `${who} slipped at step ${f.echo.failAt + 1}`) : `${who} tried`;
}
// Someone else's attempt: their pattern's notes, then their taps'. The result: a pattern beaten runs up the four pads' notes
// and dings; a slip buzzes with the wrong tap (a missed turn has the page's own buzz) and the right pad's note follows.
export function sounds(f, add, won, mini, last) {
  const e = f.echo; if (!e) return;
  const pre = echoPre(f), F = echoFx(e, pre);
  if (pre) { const A = echoAim(e); e.seq.forEach((k, i) => add('tone', i * (e.step || ECHO.step), ECHO_RATES[k])); e.taps.forEach((k, i) => add('tone', A.tap(i), ECHO_RATES[k])); }
  if (e.pass) { ECHO_RATES.forEach((r, k) => add('tone', F.wave + k * ECHO_FX.step, r)); add('ding', F.ding); return; }
  if (!f.timeout) add('buzz', F.slip);
  if (e.failAt >= 0 && e.seq && e.seq[e.failAt] != null) add('tone', F.hint, ECHO_RATES[e.seq[e.failAt]]);
}
// Echo: the taps come from the press itself (pointerdown, echoTap); the click after it does nothing
export function echoTapAct(el, e, act) {
  return;
}
// Echo: the pattern plays, once; from now the player stays in the square until the attempt goes in
export function echoPlayAct(el, e, act) {
  if (!echoDraft || echoDraft.at != null || echoDraft.sq !== state.zoom || state.flash || state.done || blocked()) return;
  const mini = state.squares[state.zoom].mini, seq = echoSeq(mini, state.turn, echoDraft.level), S = tune(mini).step || ECHO.step, at = performance.now();
  echoDraft.at = at; startFx('echo', echoDraft.id, at);
  seq.forEach((k, i) => SND.play('tone', { at: i * S / 1000, rate: ECHO_RATES[k] }));
  try { localStorage.setItem(ECHO_KEY, echoDraft.id); } catch (err) { /* no storage */ }
  render();
}
// Its own controls (data-act): the page's click handler hands them here.
export const actions = { 'echo-tap': echoTapAct, 'echo-play': echoPlayAct };

// Its listeners: main.js calls this once, in the page's original order of listeners.
export function init() {
  app.addEventListener('pointerdown', e => {
    const pad = e.target.closest && e.target.closest('.epad.live:not(:disabled)');
    if (!pad || state.screen !== 'mini') return;
    e.preventDefault(); ownPress();
    echoTap(pad);
  });
}
