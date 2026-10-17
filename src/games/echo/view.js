// Echo: the screen, the miniature, the move's words and sounds, and the inputs.
import { ECHO, echoAim, echoSeq } from './rules.js';
import { SND, ownPress } from '../../audio/sound.js';
import { attemptMove } from '../../net/moves.js';
import { blocked } from '../../net/room.js';
import { N, REDUCED, app, cpuPlays, state } from '../../ui/app.js';
import { fxAttr, startFx } from '../../ui/fx.js';
import { arcTally, lateAt } from '../../ui/progress.js';
import { render } from '../../ui/render.js';

export let echoDraft = null;
// Echo: one 10-step pattern per square, the same for both players (each level its first 4, 6, 8 or 10
// steps). The square opens on a Play pattern button: nothing plays until it is tapped, and from then the
// player stays in the square (no Board button) until the attempt goes in. The pattern plays once (each step a
// flash and a tone, from the tap); then the pads come alive, and each tap lights its pad and sounds. The taps
// go in as one move when complete or at the first slip. Someone else's attempt (the computer's, the other
// phone's) plays as their screen did: the pattern, a beat, their taps, then the result.
const ECHO_PADS = ['◆', '●', '▲', '■'], ECHO_RATES = [1, 1.26, 1.5, 2], ECHO_TONE = 300;   // (a pad's tone lasts up to 0.3 s: the result's sound follows it)
const ECHO_KEY = 'ttt-echo-played';                             // the attempt whose pattern has played: a reload does not play it again
const echoId = (sq, p, lvl) => `${state.online ? state.online.matchId || state.online.code || 'on' : 'local'}:${state.moves}:${sq}:${p}:${lvl}:${(state.squares[sq].mini.base || []).join('')}`;
export function echoPre(f) { return f && f.type === 'echo' && f.echo && !f.timeout && !REDUCED && (state.online ? f.by !== state.online.me : cpuPlays(f.by)) ? echoAim(f.echo).end : 0; }   // someone else's attempt: it plays first
export const echoPinned = () => !!(echoDraft && echoDraft.at != null && state.screen === 'mini' && state.zoom === echoDraft.sq && !state.flash);
function echoTable(mini, a, o) {
  const e = a && a.echo ? a.echo : null, l = mini.last, turn = o.turn, mover = e ? a.by : turn;
  const levels = p => `<span class="elev" aria-label="${mini.level[p]} of 4 patterns">${ECHO.lengths.map((n, k) => `<i ${lateAt(k < mini.level[p] ? 'on' : '', e && e.pass && a.by === p && k === mini.level[p] - 1 ? echoPre(a) : null, 'fillin')} title="${n} steps"></i>`).join('')}</span>`;
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
  const started = mine && echoDraft.at != null, fresh = started && echoDraft.at >= 0, playEnd = seq.length * ECHO.step;
  const pre = e ? echoPre(a) : 0, A = pre ? echoAim(e) : null;
  const anims = k => {                                           // each pad's flashes, timed from the Play tap (or from the move)
    const out = [];
    if (fresh || pre) seq.forEach((x, i) => { if (x === k) out.push(`padlit ${ECHO.flash}ms ${i * ECHO.step}ms`); });   // (shorter than a step: the same pad twice in a row flashes twice, dark between)
    if (pre) e.taps.forEach((x, i) => { if (x === k) out.push(`padlit .3s ${A.tap(i)}ms`); });
    if (e && e.pass) out.push(`padpass .65s ${pre}ms`);   // (no fill: an animation held early would cover the flashes listed before it)
    if (e && !e.pass && e.failAt >= 0) {
      if (e.taps[e.failAt] === k) out.push(`cardshake .45s ${pre ? A.tap(e.failAt) : 0}ms`, `padon 1ms ${pre ? A.tap(e.failAt) : 0}ms forwards`);
      else if (seq[e.failAt] === k) out.push(`padhint .6s ${pre}ms`);
    }
    return out.join(', ');
  };
  const live = started;
  const pad = k => {
    const an = anims(k);
    let cls = 'epad k' + k + (an ? ' play' : '') + (live ? ' live' : '') + (mine && !started ? ' idle' : '');
    return `<button class="${cls}"${an ? ` style="--lit:${an}"` : ''} data-act="echo-tap" data-k="${k}" aria-label="Pad ${k + 1}"${live ? '' : ' disabled'}>${ECHO_PADS[k]}</button>`;
  };
  const lock = fresh ? `<div class="elock tu" style="--u:${playEnd}ms" aria-hidden="true"></div>` : '';
  const pads = `<div class="epads"${fxAttr(fresh ? echoDraft.at : null)}>${[0, 1, 2, 3].map(pad).join('')}${lock}</div>`;
  const taps = started ? echoDraft.taps : [];
  const steps = mine ? `<div class="esteps" aria-label="${taps.length} of ${seq.length} tapped">${seq.map((_, i) => `<i class="${i < taps.length ? 'on' : ''}"></i>`).join('')}</div>`
    : pre ? `<div class="esteps">${seq.map((_, i) => `<i ${lateAt('', i < e.taps.length && (e.pass || i < e.failAt) ? A.tap(i) : null, 'tapin')}></i>`).join('')}</div>` : '<div class="esteps"></div>';
  const who = p => `<b class="${p}">${N(p)}</b>`;
  const note = !mine ? (pre ? `<p class="arcnote">${who(mover)} · pattern ${lvl + 1}</p>`
      : e ? '<p class="arcnote"></p>' : o.view ? `<p class="arcnote">Patterns beaten: X ${mini.level.X}, O ${mini.level.O}</p>` : `<p class="arcnote">${who(turn)} is on pattern ${lvl + 1}</p>`)
    : '<p class="arcnote"></p>';   // (how to play is in the ? explainer)
  const res = e ? `<p ${lateAt('arcres ' + (e.pass ? 'ok' : 'no'), pre)} role="status">${e.pass ? (pre ? `${who(mover)} beat pattern ${e.level + 1}` : `Pattern ${e.level + 1} beaten!`) : `${pre ? who(mover) + ' slipped' : 'Slipped'} at step ${e.failAt + 1} of ${e.len}`}</p>`
    : l && !mine ? `<p class="arcres ${l.pass ? 'ok' : 'no'}">${l.pass ? `${who(l.by)} beat pattern ${l.level + 1}` : `${who(l.by)} slipped at step ${l.failAt + 1}`}</p>` : '<p class="arcres"></p>';
  const go = mine && !started;
  const play = o.view ? '' : `<div class="cbtns one${go ? '' : ' hold'}"><button class="big" data-act="echo-play"${go ? '' : ' disabled tabindex="-1" aria-hidden="true"'}>Play pattern</button></div>`;   // the row stays (hidden) so the pads never move
  return `<div class="g-arc"><div class="ctals">${tal('X')}${tal('O')}</div><div class="echo">${note}${pads}${steps}${res}</div>${play}</div>`;
}
// Echo: a pad tapped back (from the press itself: no waiting for the click). It lights and sounds; the
// attempt goes in when it is complete, or at the first slip.
function echoTap(el) {
  if (!echoDraft || echoDraft.at == null || echoDraft.sq !== state.zoom || state.flash || state.done || blocked()) return;
  const k = Number(el.dataset.k), seq = echoSeq(state.squares[state.zoom].mini, state.turn, echoDraft.level);
  SND.play('tone', { rate: ECHO_RATES[k] });
  el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
  clearTimeout(el.offTimer); el.offTimer = setTimeout(() => el.classList.remove('on'), 220);
  echoDraft.taps.push(k);
  const n = echoDraft.taps.length;
  if (seq[n - 1] !== k || n === seq.length) {
    const taps = echoDraft.taps.slice(); echoDraft = null;
    try { localStorage.removeItem(ECHO_KEY); } catch (err) { /* no storage */ }
    attemptMove(taps); return;
  }
  const dots = app.querySelectorAll('.esteps i'); if (dots[n - 1]) dots[n - 1].classList.add('on');   // (in place: the pads keep their place and their animations)
}
export function miniature(mini, final) {
  return `<div class="tpip">${['X', 'O'].map(p => `<div class="tr ${p}"><b class="${p}">${p}</b>${ECHO.lengths.map((_, k) => `<i class="sq${k < mini.level[p] ? ' on' : ''}"></i>`).join('')}</div>`).join('')}</div>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = echoTable(mini, a, { view, locked, turn, zoom: state.zoom }); return g;
}
export function moveText(f, who) {
  return f.echo ? (f.echo.pass ? `${who} beat pattern ${f.echo.level + 1}` : `${who} slipped at step ${f.echo.failAt + 1}`) : `${who} tried`;
}
export function sounds(f, add, won, mini, last) {
  const pre = echoPre(f); if (pre) { const A = echoAim(f.echo); f.echo.seq.forEach((k, i) => add('tone', i * ECHO.step, ECHO_RATES[k])); f.echo.taps.forEach((k, i) => add('tone', A.tap(i), ECHO_RATES[k])); } if (f.echo) add(f.echo.pass ? 'ding' : 'thud', pre || ECHO_TONE); return;
}
// Echo: the taps come from the press itself (pointerdown, echoTap); the click after it does nothing
export function echoTapAct(el, e, act) {
  return;
}
// Echo: the pattern plays, once; from now the player stays in the square until the attempt goes in
export function echoPlayAct(el, e, act) {
  if (!echoDraft || echoDraft.at != null || echoDraft.sq !== state.zoom || state.flash || state.done || blocked()) return;
  const seq = echoSeq(state.squares[state.zoom].mini, state.turn, echoDraft.level), at = performance.now();
  echoDraft.at = at; startFx('echo', echoDraft.id, at);
  seq.forEach((k, i) => SND.play('tone', { at: i * ECHO.step / 1000, rate: ECHO_RATES[k] }));
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
