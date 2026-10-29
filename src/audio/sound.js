// The sound manager (SND): one AudioContext, every sound synthesised at load, the mute switch, the tap
// sounds of the controls, and each move's sounds (each game's view.js: sounds).
import { playMs } from '../core/timer.js';
import { viewOf } from '../games/index.js';
import { search } from '../net/matchmaking.js';
import { state } from '../ui/app.js';
import { KEY } from '../ui/config.js';
import { shownSq } from '../ui/chaos.js';
import { hexLen } from '../ui/fx.js';
import { endKind } from '../ui/screens/win.js';

/* ===================== sound =====================
 * One sound manager for every effect. Nothing is an audio file: each sound is synthesised here with the
 * Web Audio API (oscillators and filtered noise), so no audio is downloaded and no licence is involved
 * (SOUNDS.md lists them all). Each sound is rendered once when the page loads, so a play starts at once.
 * The first tap unlocks audio (iPhone needs a gesture). On iPhone the audio session is 'ambient': the
 * silent switch mutes the game, and music the player already has playing carries on.
 * Keeping it alive: iPhone takes a page's audio away (the page backgrounded, the phone locked, a call or a
 * notification's sound, Bluetooth headphones connecting) and leaves the context 'interrupted' or
 * 'suspended', or, worse, 'running' with its clock stopped, and a resume() often never brings it back. So
 * the context is checked before every sound (SND.ensure), and any tap anywhere brings it back silently: the
 * tap's press resumes it, and if it is still down by the tap's end (or its clock has stopped, or it is
 * closed) a new one is made inside the same tap (iPhone starts one only inside a gesture); once, too, when
 * the page comes back. Only if a tap could not bring it back does a small "Tap to restore sound" chip show,
 * and it stays until sound is actually running again. Every change
 * of state, and every failure, goes to the device's log and the match's (SND.report: net/tracking.js).
 * Echo's pads are played live, by oscillators (`live`), not from a rendered buffer.
 * Sounds start from the events they belong to (playFlash, stampFx, backSounds, showRemoteMove, ...),
 * never from drawing the screen, and each event starts its sounds once.
 */
export const SFX = {};                                             // name -> { dur, level, vary, make(c, out, t) }
export const SND = { ctx: null, out: null, bufs: {}, muted: false, loaded: false, log: [], down: false, ever: false, made: 0, events: [], report: null };
// One tone: a sine, triangle or square, optionally gliding from f to o.to over its length.
function sfxTone(c, d, t, f, dur, o = {}) {
  const n = c.createOscillator(), g = c.createGain(), v = o.vol == null ? 0.5 : o.vol;
  n.type = o.type || 'sine';
  n.frequency.setValueAtTime(f, t);
  if (o.to) n.frequency.exponentialRampToValueAtTime(o.to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + (o.att || 0.005));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  n.connect(g); g.connect(d); n.start(t); n.stop(t + dur + 0.05);
}
// Filtered noise (the same noise every time: seeded): whooshes, clacks, splashes, thuds.
function sfxNoise(c, d, t, dur, o = {}) {
  const len = Math.max(1, Math.ceil(c.sampleRate * dur)), b = c.createBuffer(1, len, c.sampleRate), x = b.getChannelData(0);
  let s = 12345;
  for (let i = 0; i < len; i++) { s = (s * 16807) % 2147483647; x[i] = s / 1073741823 - 1; }
  const src = c.createBufferSource(), flt = c.createBiquadFilter(), g = c.createGain(), v = o.vol == null ? 0.5 : o.vol;
  src.buffer = b; flt.type = o.filter || 'bandpass'; flt.Q.value = o.q == null ? 1 : o.q;
  flt.frequency.setValueAtTime(o.f || 1500, t);
  if (o.to) flt.frequency.exponentialRampToValueAtTime(o.to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(v, t + (o.att || 0.003));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(flt); flt.connect(g); g.connect(d); src.start(t); src.stop(t + dur + 0.05);
}
// name, length in seconds, loudness (the peak it is normalised to), and whether its pitch varies a little
// each time (for the sounds that repeat: taps, hops, ticks), so they do not feel mechanical.
// live: made by oscillators each time it plays (make(c, out, t, rate)), never rendered.
const def = (name, dur, make, o = {}) => { SFX[name] = { dur, level: o.level == null ? 0.6 : o.level, vary: !!o.vary, live: !!o.live, make }; };
// ---- interface
def('tap', 0.09, (c, d, t) => { sfxTone(c, d, t, 640, .07, { to: 430, vol: .5, type: 'triangle' }); sfxNoise(c, d, t, .02, { f: 2600, vol: .25 }); }, { level: .4, vary: true });
def('key', 0.06, (c, d, t) => sfxTone(c, d, t, 1400, .04, { to: 1100, vol: .5, type: 'triangle' }), { level: .3, vary: true });
def('toggle', 0.16, (c, d, t) => { sfxTone(c, d, t, 660, .07, { vol: .5, type: 'triangle' }); sfxTone(c, d, t + .06, 880, .09, { vol: .5, type: 'triangle' }); }, { level: .45 });
def('pop', 0.14, (c, d, t) => { sfxTone(c, d, t, 620, .13, { to: 980, vol: .4, att: .006 }); sfxTone(c, d, t + .03, 1240, .06, { vol: .12 }); }, { level: .4, vary: true });   // a reaction, sent or received
def('select', 0.26, (c, d, t) => [523, 659, 784].forEach((f, i) => sfxTone(c, d, t + i * .06, f, .14, { vol: .4, type: 'triangle' })), { level: .45 });
def('deselect', 0.26, (c, d, t) => [784, 659, 523].forEach((f, i) => sfxTone(c, d, t + i * .06, f, .14, { vol: .4, type: 'triangle' })), { level: .45 });
def('back', 0.22, (c, d, t) => { sfxTone(c, d, t, 620, .18, { to: 330, vol: .4 }); sfxNoise(c, d, t, .16, { f: 900, to: 500, filter: 'lowpass', vol: .2 }); }, { level: .45 });
def('open', 0.22, (c, d, t) => sfxTone(c, d, t, 330, .18, { to: 660, vol: .4 }), { level: .45 });
def('close', 0.2, (c, d, t) => sfxTone(c, d, t, 660, .16, { to: 330, vol: .4 }), { level: .45 });
def('error', 0.3, (c, d, t) => { sfxTone(c, d, t, 150, .26, { type: 'square', to: 120, vol: .3 }); sfxTone(c, d, t, 156, .26, { type: 'square', to: 124, vol: .25 }); }, { level: .45 });
def('copy', 0.2, (c, d, t) => { sfxNoise(c, d, t, .02, { f: 3000, vol: .6 }); sfxTone(c, d, t + .01, 1500, .07, { vol: .4, type: 'triangle' }); sfxTone(c, d, t + .08, 1900, .08, { vol: .4, type: 'triangle' }); }, { level: .5 });
def('join', 0.36, (c, d, t) => { sfxTone(c, d, t, 523, .15, { vol: .4, type: 'triangle' }); sfxTone(c, d, t + .1, 784, .24, { vol: .45, type: 'triangle' }); }, { level: .55 });
def('found', 0.55, (c, d, t) => [523, 659, 784, 1046].forEach((f, i) => sfxTone(c, d, t + i * .07, f, .22, { vol: .35, type: 'triangle' })), { level: .6 });
// ---- the board
def('spot', 0.4, (c, d, t) => { sfxTone(c, d, t, 880, .36, { vol: .25, att: .12 }); sfxTone(c, d, t, 1320, .28, { vol: .1, att: .12 }); }, { level: .4 });
def('turn', 0.42, (c, d, t) => { sfxTone(c, d, t, 260, .24, { to: 620, vol: .5, att: .01 }); sfxTone(c, d, t + .18, 900, .2, { vol: .2, type: 'triangle' }); }, { level: .5 });
def('stamp', 0.32, (c, d, t) => { sfxTone(c, d, t, 150, .28, { to: 55, vol: .9, att: .002 }); sfxNoise(c, d, t, .09, { f: 650, filter: 'lowpass', vol: .7, att: .002 }); }, { level: .9 });
def('burst', 0.1, (c, d, t) => { sfxNoise(c, d, t, .07, { f: 1600, q: .7, vol: .5 }); sfxTone(c, d, t, 900, .1, { to: 1800, vol: .35, type: 'triangle' }); }, { level: .5, vary: true });
def('reset', 0.4, (c, d, t) => { sfxTone(c, d, t, 560, .28, { to: 240, vol: .5, type: 'triangle' }); sfxNoise(c, d, t + .06, .16, { f: 600, to: 300, filter: 'lowpass', vol: .2 }); }, { level: .5 });
def('swish', 0.28, (c, d, t) => { sfxNoise(c, d, t, .22, { f: 700, to: 3600, q: 1.5, vol: .5 }); sfxTone(c, d, t + .06, 760, .14, { to: 1500, vol: .15, type: 'triangle' }); }, { level: .55 });
def('won', 0.38, (c, d, t) => [659, 784, 988].forEach((f, i) => sfxTone(c, d, t + i * .055, f, .2, { vol: .35, type: 'triangle' })), { level: .6 });
def('winFanfare', 1.0, (c, d, t) => { [523, 659, 784, 1046].forEach((f, i) => sfxTone(c, d, t + i * .08, f, .2, { vol: .4, type: 'triangle' })); [523, 659, 784].forEach(f => sfxTone(c, d, t + .34, f, .6, { vol: .22 })); }, { level: .65 });
def('loss', 0.85, (c, d, t) => { sfxTone(c, d, t, 392, .3, { to: 294, vol: .4, type: 'triangle' }); sfxTone(c, d, t + .25, 330, .55, { to: 247, vol: .4, type: 'triangle' }); }, { level: .55 });
def('tie', 0.9, (c, d, t) => [392, 494, 587].forEach(f => sfxTone(c, d, t, f, .8, { vol: .2, att: .02 })), { level: .5 });
// ---- the clock
def('tickSoft', 0.06, (c, d, t) => sfxTone(c, d, t, 1000, .03, { vol: .4 }), { level: .3, vary: true });
def('tickLoud', 0.08, (c, d, t) => sfxTone(c, d, t, 1400, .05, { vol: .6 }), { level: .55, vary: true });
def('buzz', 0.5, (c, d, t) => { sfxTone(c, d, t, 220, .42, { type: 'sawtooth', to: 170, vol: .3 }); sfxNoise(c, d, t, .3, { f: 800, filter: 'lowpass', vol: .2 }); }, { level: .6 });
def('randomMove', 0.36, (c, d, t) => [0, .1, .2].forEach(o => sfxTone(c, d, t + o, 900, .05, { vol: .4, type: 'triangle' })), { level: .45 });
// ---- the mini-games
def('mark', 0.14, (c, d, t) => { sfxNoise(c, d, t, .12, { f: 2600, q: 3, vol: .55 }); sfxTone(c, d, t, 320, .1, { to: 260, vol: .2, type: 'triangle' }); }, { level: .5, vary: true });
def('whoosh', 0.34, (c, d, t) => sfxNoise(c, d, t, .3, { f: 3000, to: 500, q: .8, vol: .4 }), { level: .45 });
def('clack', 0.1, (c, d, t) => { sfxNoise(c, d, t, .05, { f: 1800, q: 5, vol: .7, att: .001 }); sfxTone(c, d, t, 800, .05, { vol: .4, type: 'triangle' }); }, { level: .6 });
def('fire', 0.2, (c, d, t) => { sfxTone(c, d, t, 900, .16, { to: 300, vol: .4, type: 'triangle' }); sfxNoise(c, d, t, .16, { f: 2000, to: 600, vol: .25 }); }, { level: .5 });
def('splash', 0.6, (c, d, t) => { sfxNoise(c, d, t, .4, { f: 1800, to: 400, q: .6, filter: 'lowpass', vol: .6 }); sfxTone(c, d, t + .15, 700, .06, { to: 1200, vol: .2 }); sfxTone(c, d, t + .25, 900, .05, { to: 1500, vol: .15 }); }, { level: .55 });
def('boom', 0.5, (c, d, t) => { sfxNoise(c, d, t, .4, { f: 1000, to: 200, q: .7, filter: 'lowpass', vol: .8 }); sfxTone(c, d, t, 160, .4, { to: 50, vol: .7 }); }, { level: .8 });
def('sink', 1.2, (c, d, t) => { sfxNoise(c, d, t, 1.1, { f: 300, to: 80, q: .5, filter: 'lowpass', vol: .8, att: .05 }); sfxTone(c, d, t, 110, 1, { to: 40, vol: .4 }); }, { level: .7 });
def('tileG', 0.18, (c, d, t) => { sfxTone(c, d, t, 660, .14, { vol: .5, type: 'triangle' }); sfxTone(c, d, t, 990, .1, { vol: .2, type: 'triangle' }); }, { level: .5 });
def('tileY', 0.16, (c, d, t) => sfxTone(c, d, t, 520, .14, { vol: .5, type: 'triangle' }), { level: .5 });
def('tileX', 0.12, (c, d, t) => sfxTone(c, d, t, 330, .1, { to: 280, vol: .4, type: 'triangle' }), { level: .45 });
def('solve', 0.6, (c, d, t) => [784, 988, 1175].forEach((f, i) => sfxTone(c, d, t + i * .09, f, .3, { vol: .35, type: 'triangle' })), { level: .6 });
def('ding', 0.5, (c, d, t) => { sfxTone(c, d, t, 1046, .5, { vol: .4 }); sfxTone(c, d, t, 1568, .35, { vol: .15 }); }, { level: .55 });
def('diceWin', 0.9, (c, d, t) => { [523, 659, 784, 1047].forEach((f, i) => sfxTone(c, d, t + i * .1, f, .22, { vol: .4, type: 'triangle' })); [2093, 2637, 3136].forEach((f, i) => sfxTone(c, d, t + .45 + i * .08, f, .12, { vol: .18 })); }, { level: .6 });   // Craps: the point made (a hop-and-spin arpeggio, then sparkles)
def('diceLose', 0.9, (c, d, t) => { sfxTone(c, d, t, 392, .7, { to: 130, vol: .45, type: 'sawtooth' }); sfxNoise(c, d, t + .55, .3, { f: 500, to: 150, filter: 'lowpass', vol: .3 }); }, { level: .5 });   // Craps: a crap-out (a deflating slide down, a sigh)
def('thud', 0.22, (c, d, t) => { sfxTone(c, d, t, 120, .2, { to: 70, vol: .6 }); sfxNoise(c, d, t, .1, { f: 400, filter: 'lowpass', vol: .4 }); }, { level: .55 });
def('cushion', 0.16, (c, d, t) => { sfxTone(c, d, t, 220, .12, { to: 140, vol: .5, type: 'triangle' }); sfxNoise(c, d, t, .08, { f: 700, filter: 'lowpass', vol: .3 }); }, { level: .45, vary: true });
def('pinHit', 0.14, (c, d, t) => { sfxNoise(c, d, t, .09, { f: 1500, q: 2.5, vol: .6, att: .001 }); sfxTone(c, d, t, 520, .08, { to: 380, vol: .35, type: 'triangle' }); }, { level: .5, vary: true });
def('strike', 0.9, (c, d, t) => { [659, 784, 988, 1319].forEach((f, i) => sfxTone(c, d, t + i * .09, f, .3, { vol: .35, type: 'triangle' })); sfxNoise(c, d, t, .5, { f: 2500, to: 600, q: .8, vol: .25 }); }, { level: .65 });
def('hexPlace', 0.08, (c, d, t) => { sfxTone(c, d, t, 500, .06, { vol: .5, type: 'triangle' }); sfxNoise(c, d, t, .05, { f: 1200, q: 4, vol: .4 }); }, { level: .5, vary: true });
def('pathNote', 0.3, (c, d, t) => sfxTone(c, d, t, 523, .25, { vol: .4, type: 'triangle' }), { level: .5 });
def('hiloBlip', 0.1, (c, d, t) => sfxTone(c, d, t, 880, .08, { vol: .4 }), { level: .4, vary: true });
def('higher', 0.34, (c, d, t) => sfxTone(c, d, t, 500, .3, { to: 900, vol: .4, type: 'triangle' }), { level: .5 });
def('lower', 0.34, (c, d, t) => sfxTone(c, d, t, 900, .3, { to: 500, vol: .4, type: 'triangle' }), { level: .5 });
def('rattle', 0.5, (c, d, t) => { for (let k = 0; k < 9; k++) sfxNoise(c, d, t + k * .05, .04, { f: 2500, q: 2, vol: .5 }); }, { level: .5 });
def('thunk', 0.2, (c, d, t) => { sfxTone(c, d, t, 220, .15, { to: 110, vol: .6, type: 'triangle' }); sfxNoise(c, d, t, .06, { f: 700, filter: 'lowpass', vol: .5 }); }, { level: .6 });
def('hop', 0.1, (c, d, t) => sfxTone(c, d, t, 520, .07, { to: 760, vol: .35, type: 'triangle' }), { level: .35, vary: true });
def('climb', 0.8, (c, d, t) => [0, 1, 2, 3, 4].forEach(i => sfxTone(c, d, t + i * .13, 420 + i * 110, .14, { vol: .3, type: 'triangle' })), { level: .5 });
def('slide', 0.8, (c, d, t) => { sfxTone(c, d, t, 1000, .72, { to: 260, vol: .4 }); sfxNoise(c, d, t, .7, { f: 2200, to: 700, vol: .12 }); }, { level: .5 });
def('flipUp', 0.16, (c, d, t) => { sfxNoise(c, d, t, .12, { f: 1200, to: 2400, q: 1.2, vol: .4 }); sfxTone(c, d, t + .1, 1400, .04, { vol: .2 }); }, { level: .45 });
def('flipDown', 0.16, (c, d, t) => sfxNoise(c, d, t, .12, { f: 2400, to: 1000, q: 1.2, vol: .35 }), { level: .45 });
def('pair', 0.55, (c, d, t) => [880, 1175, 1568].forEach((f, i) => sfxTone(c, d, t + i * .07, f, .3, { vol: .35, type: 'triangle' })), { level: .6 });
def('nopair', 0.36, (c, d, t) => { sfxTone(c, d, t, 260, .2, { to: 200, vol: .3, type: 'triangle' }); sfxTone(c, d, t + .12, 220, .2, { vol: .3, type: 'triangle' }); }, { level: .45 });
def('wheelTick', 0.04, (c, d, t) => sfxTone(c, d, t, 2200, .025, { vol: .4 }), { level: .3, vary: true });
def('spin', 0.8, (c, d, t) => sfxNoise(c, d, t, .7, { f: 2500, to: 1200, q: 2, vol: .25 }), { level: .45 });
def('clink', 0.24, (c, d, t) => { sfxTone(c, d, t, 2400, .2, { vol: .4 }); sfxTone(c, d, t, 3600, .12, { vol: .2 }); }, { level: .45, vary: true });
def('coinSpin', 1.0, (c, d, t) => { sfxTone(c, d, t, 1200, .9, { to: 2000, vol: .25 }); sfxTone(c, d, t, 2400, .8, { to: 3200, vol: .1 }); }, { level: .45 });
def('point', 0.14, (c, d, t) => sfxTone(c, d, t, 700, .08, { to: 1000, vol: .35, type: 'triangle' }), { level: .4, vary: true });
def('bank', 0.45, (c, d, t) => [1500, 1900, 2400, 1900].forEach((f, i) => sfxTone(c, d, t + i * .06, f, .1, { vol: .3, type: 'triangle' })), { level: .55 });
def('bust', 0.75, (c, d, t) => { sfxNoise(c, d, t, .3, { f: 1500, to: 200, q: .5, filter: 'lowpass', vol: .9 }); sfxTone(c, d, t, 400, .6, { to: 60, vol: .5, type: 'sawtooth' }); }, { level: .7 });
def('dig', 0.32, (c, d, t) => { sfxNoise(c, d, t, .25, { f: 900, to: 300, q: .8, filter: 'lowpass', vol: .6 }); sfxTone(c, d, t + .2, 120, .1, { to: 80, vol: .4 }); }, { level: .55 });
def('band', 0.28, (c, d, t) => sfxTone(c, d, t, 880, .25, { vol: .35, type: 'triangle' }), { level: .5 });
def('sparkle', 0.55, (c, d, t) => [1319, 1760, 2093, 2637].forEach((f, i) => sfxTone(c, d, t + i * .07, f, .25, { vol: .25 })), { level: .55 });
def('pieceSlide', 0.24, (c, d, t) => sfxNoise(c, d, t, .2, { f: 1200, to: 600, q: .8, filter: 'lowpass', vol: .35 }), { level: .45 });
def('knock', 0.32, (c, d, t) => { sfxTone(c, d, t, 260, .12, { to: 220, vol: .6, type: 'triangle' }); sfxTone(c, d, t + .12, 240, .12, { vol: .5, type: 'triangle' }); }, { level: .6 });
def('peg', 0.07, (c, d, t) => sfxTone(c, d, t, 900, .05, { vol: .5, type: 'triangle' }), { level: .4, vary: true });
def('marker', 0.06, (c, d, t) => sfxTone(c, d, t, 1500, .04, { vol: .4 }), { level: .3, vary: true });
def('reveal', 0.65, (c, d, t) => { sfxTone(c, d, t, 300, .5, { to: 900, vol: .4, type: 'triangle' }); [1046, 1318].forEach((f, i) => sfxTone(c, d, t + .45 + i * .08, f, .25, { vol: .35 })); }, { level: .6 });
def('boing', 0.6, (c, d, t) => { sfxTone(c, d, t, 200, .5, { to: 700, vol: .5 }); sfxTone(c, d, t, 700, .4, { to: 350, vol: .2 }); }, { level: .6 });
// ---- the card games and the wheel
def('cardSlide', 0.14, (c, d, t) => sfxNoise(c, d, t, .12, { f: 2600, to: 1100, q: .9, vol: .4 }), { level: .4, vary: true });
def('cardFlip', 0.07, (c, d, t) => { sfxNoise(c, d, t, .035, { f: 3400, q: 1.6, vol: .6, att: .001 }); sfxTone(c, d, t, 1700, .03, { vol: .15, type: 'triangle' }); }, { level: .4, vary: true });
def('chips', 0.42, (c, d, t) => [0, .07, .16].forEach((dt, i) => { sfxTone(c, d, t + dt, 2500 + i * 320, .12, { vol: .3 }); sfxNoise(c, d, t + dt, .03, { f: 5200, q: 2, vol: .3, att: .001 }); }), { level: .5 });
def('push', 0.32, (c, d, t) => { sfxTone(c, d, t, 523, .12, { vol: .3, type: 'triangle' }); sfxTone(c, d, t + .13, 523, .15, { vol: .3, type: 'triangle' }); }, { level: .4 });
def('rlSpin', 1.3, (c, d, t) => { sfxNoise(c, d, t, 1.25, { f: 1100, to: 300, q: .6, filter: 'lowpass', vol: .3, att: .12 }); sfxTone(c, d, t, 90, 1.2, { to: 55, vol: .12, att: .15 }); }, { level: .35 });   // (fades as the wheel slows; the ball's clicks carry on to the drop)
def('ballTick', 0.04, (c, d, t) => sfxTone(c, d, t, 3100, .025, { vol: .35, type: 'triangle' }), { level: .28, vary: true });
// ---- the arcade games
def('tone', 0.3, (c, d, t, rate) => sfxTone(c, d, t, 392 * (rate || 1), .28, { vol: .5, type: 'triangle', att: .01 }), { level: .5, live: true });   // an Echo pad, live (its rate sets the pad's note: G, C, E, G)
def('dartHit', 0.22, (c, d, t) => { sfxNoise(c, d, t, .05, { f: 900, q: 1.2, vol: .5 }); sfxTone(c, d, t, 180, .18, { to: 120, vol: .5, type: 'triangle' }); }, { level: .6 });   // a dart in the board: a thunk
def('dartMiss', 0.3, (c, d, t) => { sfxTone(c, d, t, 1500, .22, { to: 900, vol: .3, type: 'square', att: .003 }); sfxNoise(c, d, t, .04, { f: 3200, q: 2, vol: .3 }); }, { level: .45 });   // off the board: a clank
def('beep', 0.12, (c, d, t) => sfxTone(c, d, t, 880, .1, { vol: .35, type: 'square', att: .003 }), { level: .45 });   // the runners' countdown: 3, 2, 1
def('go', 0.3, (c, d, t) => { sfxTone(c, d, t, 1320, .12, { vol: .4, type: 'square', att: .003 }); sfxTone(c, d, t + .1, 1760, .18, { vol: .4, type: 'square', att: .003 }); }, { level: .5 });   // ...go!
def('jump', 0.16, (c, d, t) => sfxTone(c, d, t, 420, .14, { to: 900, vol: .4, type: 'triangle' }), { level: .4 });   // Dash: a spring up
def('crash', 0.5, (c, d, t) => { sfxNoise(c, d, t, .3, { f: 900, to: 150, q: 1, vol: .6 }); sfxTone(c, d, t, 160, .35, { to: 50, vol: .6 }); }, { level: .6 });   // a tumble or a spin-out
def('skid', 0.3, (c, d, t) => sfxNoise(c, d, t, .28, { f: 2200, to: 900, q: 2, vol: .45 }), { level: .4 });   // Lane Rush: tyres on a lane change
def('flap', 0.12, (c, d, t) => { sfxNoise(c, d, t, .09, { f: 1500, to: 600, q: 1.2, vol: .5 }); sfxTone(c, d, t, 300, .06, { to: 420, vol: .15, type: 'triangle' }); }, { level: .4, vary: true });   // Flap: a wing beat
def('rotor', 0.3, (c, d, t) => { for (let k = 0; k < 4; k++) sfxNoise(c, d, t + k * .065, .045, { f: 420, q: 1.5, filter: 'lowpass', vol: .7 }); }, { level: .45 });   // Chopper: the rotor biting as it climbs
def('plop', 0.16, (c, d, t) => sfxTone(c, d, t, 520, .14, { to: 260, vol: .5, type: 'sine' }), { level: .5 });   // the chip drops into its bin
def('spring', 0.14, (c, d, t) => { sfxTone(c, d, t, 330, .12, { to: 760, vol: .4 }); sfxTone(c, d, t + .02, 660, .07, { to: 1100, vol: .12, type: 'triangle' }); }, { level: .35, vary: true });   // Sky Hop: a bounce off a platform
def('crumble', 0.22, (c, d, t) => { for (let k = 0; k < 3; k++) sfxNoise(c, d, t + k * .05, .06, { f: 900 - k * 200, q: 1.2, filter: 'lowpass', vol: .55 }); }, { level: .45 });   // Sky Hop: a biscuit platform breaking
def('scoop', 0.16, (c, d, t) => { sfxTone(c, d, t, 420, .13, { to: 230, vol: .45 }); sfxNoise(c, d, t, .06, { f: 900, filter: 'lowpass', vol: .25 }); }, { level: .45, vary: true });   // Scoop Stack: a scoop lands on the stack
def('flipper', 0.08, (c, d, t) => { sfxNoise(c, d, t, .03, { f: 2600, q: 3, vol: .6, att: .001 }); sfxTone(c, d, t, 190, .06, { to: 120, vol: .45, type: 'triangle' }); }, { level: .5, vary: true });   // Pinball: a flipper going up
def('plunger', 0.3, (c, d, t) => { sfxNoise(c, d, t, .22, { f: 600, to: 2600, q: 1.5, vol: .4 }); sfxTone(c, d, t, 180, .2, { to: 520, vol: .35, type: 'triangle' }); }, { level: .5 });   // Pinball: the launch
def('bumper', 0.12, (c, d, t) => { sfxTone(c, d, t, 1100, .07, { to: 700, vol: .4, type: 'square', att: .002 }); sfxTone(c, d, t, 1650, .05, { vol: .15 }); }, { level: .45, vary: true });   // Pinball: a pop bumper
def('ballDrop', 0.3, (c, d, t) => { sfxTone(c, d, t, 1900, .05, { vol: .45, type: 'triangle' }); sfxTone(c, d, t + .1, 1650, .05, { vol: .3, type: 'triangle' }); sfxNoise(c, d, t + .18, .07, { f: 2600, q: 1.5, vol: .35 }); }, { level: .5 });

// Renders every sound into a buffer, one after another (quick, and gentle on a phone). Runs at page load.
SND.load = function () {
  const OC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!OC) return Promise.resolve();
  return Object.keys(SFX).filter(name => !SFX[name].live).reduce((p, name) => p.then(() => new Promise(done => {
    const s = SFX[name], oc = new OC(1, Math.ceil(s.dur * 44100), 44100);
    oc.oncomplete = e => {
      const buf = e.renderedBuffer, x = buf.getChannelData(0);
      let peak = 0; for (let i = 0; i < x.length; i++) peak = Math.max(peak, Math.abs(x[i]));
      if (peak > 0) for (let i = 0; i < x.length; i++) x[i] *= s.level / peak;   // balanced: each sound peaks at its own level
      SND.bufs[name] = buf; done();
    };
    s.make(oc, oc.destination, 0);
    oc.startRendering();
  })), Promise.resolve()).then(() => { SND.loaded = true; });
};
// ----- keeping audio alive (see the top) -----
const AUDIO_CHECK_MS = 1500;                                       // while the page shows: is audio still up?
let probe = null, madeTap = false, ran = false, triedAway = false, lastSaid = '', resumedAt = -1e9, failCheck = 0, failed = false;
const TAP_FAIL_MS = 1600;                                           // a tap's attempt not up by then: it failed (the chip)
const nowMs = () => performance.now();
const hidden = () => document.visibilityState === 'hidden';
function say(msg) {                                                // a line for the logs (the same line twice in a row: once)
  SND.events.push({ t: Date.now(), msg }); if (SND.events.length > 60) SND.events.splice(0, 30);
  if (msg === lastSaid) return;
  lastSaid = msg;
  try { if (SND.report) SND.report(msg); } catch (e) { /* the log is never worth an error */ }
}
const errText = e => String((e && (e.name || e.message)) || e).slice(0, 60);
// Its clock stopped while it says 'running' (iPhone after an interruption): the audio clock has not moved
// in half a second and more of the page's.
function stalled(c) {
  const w = nowMs();
  if (!probe || probe.c !== c) { probe = { c, w, ct: c.currentTime, st: false }; return false; }
  if (w - probe.w < 500) return probe.st;
  const st = c.currentTime - probe.ct < 0.05;
  probe = { c, w, ct: c.currentTime, st };
  return st;
}
// Up: running with its clock moving, or made inside a tap a moment ago and not yet started (iPhone starts
// it a beat later; what is scheduled now plays then).
function up() {
  const c = SND.ctx;
  if (!c) return false;
  if (c.state === 'running') return !stalled(c);
  return c.state === 'suspended' && madeTap && !ran && nowMs() - SND.made < 1500;
}
function makeCtx(why, tap) {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  let c;
  try { c = new AC(); } catch (e) { say(`create failed (${why}): ${errText(e)}`); return false; }
  const old = SND.ctx;
  if (old) { old.onstatechange = null; try { old.close().catch(() => {}); } catch (e) { /* gone already */ } }
  SND.ctx = c; SND.made = nowMs(); madeTap = !!tap; ran = c.state === 'running'; probe = null;
  SND.out = c.createGain(); SND.out.gain.value = 0.9; SND.out.connect(c.destination);
  let started = false;
  c.onstatechange = () => {
    if (SND.ctx !== c) return;
    const first = c.state === 'running' && !started;
    if (c.state === 'running') { ran = true; started = true; }
    if (!(first && !SND.down)) say(`state ${c.state}${hidden() ? ' (hidden)' : ''}`);   // (a context starting as it should is not news)
    refresh();
  };
  if (old) say(`new context (${why}): ${c.state}`);
  return true;
}
function kick(c) {
  try { const r = c.resume(); if (r && r.catch) r.catch(e => say('resume failed: ' + errText(e))); } catch (e) { say('resume failed: ' + errText(e)); }
  try {                                                            // a silent sound inside the gesture: the rest of iPhone's unlock
    const b = c.createBuffer(1, 1, 22050), s = c.createBufferSource();
    s.buffer = b; s.connect(c.destination); s.start(0);
  } catch (e) { say('unlock failed: ' + errText(e)); }
}
// Is audio up? If not, a new context: always on a tap (gesture: true), once when the page is back.
// Checked before every sound. Returns whether sounds can play now.
SND.ensure = function (gesture) {
  if (!SND.ctx) {
    if (!gesture) return false;                                    // (before the first tap: nothing yet, and nothing down)
    if (!makeCtx('first tap', true)) return false;
    kick(SND.ctx);
  } else if (!up() && !hidden()) {
    const c = SND.ctx, was = `${c.state}${c.state === 'running' ? ', clock stopped' : ''}`;
    if (gesture) {                                                   // a tap: resume first; still down by the tap's next event (or past resuming), a new one
      if (c.state === 'running' || c.state === 'closed' || nowMs() - resumedAt < 1000) { if (makeCtx(`tap, was ${was}`, true)) kick(SND.ctx); }
      else { resumedAt = nowMs(); say(`resume (tap, was ${was})`); kick(c); }
      clearTimeout(failCheck);
      failCheck = setTimeout(() => { if (!up() && !hidden() && !SND.muted && SND.ever) { failed = true; say('a tap did not restore it'); refresh(false); } }, TAP_FAIL_MS);
    } else if (!triedAway) { triedAway = true; if (makeCtx(`check, was ${was}`)) kick(SND.ctx); }
  }
  const ok = up();
  if (ok) { triedAway = false; failed = false; if (!SND.ever) SND.ever = true; }
  refresh(ok);
  return ok;
};
// The first tap (or key) unlocks audio, and every tap after it brings it back if it is down.
SND.unlock = function () { SND.ensure(true); };
// The "Tap to restore sound" chip: shown only once a tap has failed to bring audio back (after it has once
// been up, sound on, the page showing), until it is running again. Fixed over the page: nothing moves when it
// comes and goes. Its tap is another gesture to try with.
let chip = null, chipOff = 0;
function refresh(ok) {
  if (ok === undefined) ok = up();
  if (ok) failed = false;
  const down = failed && !ok && SND.ever && !SND.muted && !hidden();
  if (down !== SND.down) { SND.down = down; say(down ? `down (${SND.ctx ? SND.ctx.state : 'none'})` : 'restored'); }
  if (!chip) return;
  clearTimeout(chipOff);
  if (down) chip.hidden = false;
  else if (!chip.hidden) chipOff = setTimeout(() => { chip.hidden = true; }, 450);   // (gone once the tap that brought sound back has ended: its click lands on the chip, not on what is under it)
}
// A sound played over and over until stopped (the chopper's rotor while the press is held): { stop() }.
// A replay's sounds (an opponent's or the computer's move as it plays back): every sound started while a
// replay is the scope (SND.scope, set by ui/replay.js and the Super Chaos recap) is kept with its tag, the
// ones scheduled ahead on the audio clock too, so Skip can silence them all at once (SND.cut). Interface
// sounds (o.ui: the taps of the controls) are never a replay's.
SND.scope = null;
let held = [];                                                     // { tag, g, src, end } (end: the audio clock's time it is over by)
function keep(tag, g, src, end) {
  const c = SND.ctx, now = c ? c.currentTime : 0;
  held = held.filter(h => h.end > now);
  const h = { tag, g, src, end };
  held.push(h);
  return h;
}
// Silences every sound of a replay: `tag` its scope (none: every replay's), playing or still to come.
SND.cut = function (tag) {
  const c = SND.ctx, now = c ? c.currentTime : 0;
  held = held.filter(h => {
    if (tag !== undefined ? h.tag !== tag : h.tag == null) return h.end > now;
    try { h.g.gain.cancelScheduledValues(now); h.g.gain.setValueAtTime(h.g.gain.value, now); h.g.gain.linearRampToValueAtTime(0, now + 0.015); } catch (e) { /* gone already */ }
    try { if (h.src) h.src.stop(now + 0.02); } catch (e) { /* not started, or stopped already */ }
    try { setTimeout(() => { try { h.g.disconnect(); } catch (e) { /* gone */ } }, 40); } catch (e) { /* gone */ }
    return false;
  });
};
SND.heldCount = (tag) => held.filter(h => (tag !== undefined ? h.tag === tag : h.tag != null)).length;   // (the tests)
SND.loop = function (name) {
  const b = SND.bufs[name], none = { stop() {} };
  SND.log.push(name);
  if (!b || SND.muted || !SND.ensure(false)) return none;
  const c = SND.ctx;
  try {
    const src = c.createBufferSource(), g = c.createGain();
    src.buffer = b; src.loop = true; g.gain.value = 1;
    src.connect(g); g.connect(SND.out); src.start();
    const h = SND.scope != null ? keep(SND.scope, g, src, Infinity) : null;
    return { stop() { if (h) h.end = 0; try { const t = c.currentTime; g.gain.setTargetAtTime(0, t, 0.02); src.stop(t + 0.1); } catch (e) { /* already stopped */ } } };   // a short fade, no click
  } catch (e) { say(`play failed (${name}): ${errText(e)}`); return none; }
};
// Starts a sound now (or `o.at` seconds later). Nothing plays while muted, or before audio is unlocked.
SND.play = function (name, o = {}) {
  const s = SFX[name], b = SND.bufs[name];
  if (!s || (!b && !s.live) || SND.muted || !SND.ensure(false)) return;
  const c = SND.ctx, at = c.currentTime + (o.at || 0);
  try {
    const g = c.createGain();
    g.gain.value = o.vol == null ? 1 : o.vol;
    g.connect(SND.out);
    if (s.live) s.make(c, g, at, o.rate || 1);                     // (Echo's pads: oscillators, made now)
    else {
      const src = c.createBufferSource();
      src.buffer = b;
      src.playbackRate.value = o.rate || (s.vary ? 0.94 + Math.random() * 0.12 : 1);
      src.connect(g); src.start(at);
      if (SND.scope != null && !o.ui) keep(SND.scope, g, src, at + b.duration / src.playbackRate.value + 0.05);
    }
    if (s.live && SND.scope != null && !o.ui) keep(SND.scope, g, null, at + s.dur + 0.1);
  } catch (e) { say(`play failed (${name}): ${errText(e)}`); return; }
  SND.log.push(name); if (SND.log.length > 400) SND.log.splice(0, 200);   // (what has played, for the tests)
};
SND.setMuted = function (m) {
  SND.muted = !!m;
  refresh();
  try { localStorage.setItem(KEY + '.sound', SND.muted ? 'off' : 'on'); } catch (e) { /* no storage: the choice lasts this visit */ }
};
try { SND.muted = localStorage.getItem(KEY + '.sound') === 'off'; } catch (e) { /* no storage: sound on */ }
try { if (navigator.audioSession) navigator.audioSession.type = 'ambient'; } catch (e) { /* not here: the silent switch is the phone's own */ }
// A press a game takes itself, on pointerdown (Echo's pads, Bullseye, Bowling, the drags and the runs): the
// click that ends it plays no tap, whatever is under the finger by then (the result coming up, say).
let ownDown = false, ownUp = -1e9;
export function ownPress() { ownDown = true; }
// Every control plays its tap sound when pressed (whether or not the game takes the press). The moves
// and card turns play their own sounds, from their events. A press on a disabled control is an error.
const TAP_SOUND = { explain: 'open', 'explain-close': 'close', pause: 'open', 'pause-resume': 'close', zoom: null, move: null, pick: null,
  'echo-tap': null, 'echo-play': null, bulls: null, bowl: null, 'run-go': null, 'fing-start': null, 'odd-reveal': null, 'trivia-reveal': null, 'att-start': null, 'hc-key': null, 'snap-cell': null, 'snap-submit': null, hpsel: 'select',   // a game's own inputs: each plays its own sound (from its handler or its move), never the click as well
  mmcol: 'peg', mmslot: 'peg', rlnum: 'peg', rlgrp: 'peg', rlzero: 'peg', key: 'key', bksp: 'key', enter: 'key', side: 'toggle', kind: 'toggle', lside: 'toggle', timer: 'toggle', adv: 'toggle',
  sound: 'toggle', 'games-all': 'select', 'games-none': 'deselect', share: 'copy', back: 'tap' };   // (back: the Board button in a square, a plain tap)
// The sound switch: a speaker with waves when sound is on, crossed out when it is off. Its label says which.
const soundLabel = () => (SND.muted ? 'Sound off' : 'Sound on');
const soundIcon = () => `<svg class="snd-ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 9.5h3.6L12 5.5v13l-4.9-4H3.5z" fill="currentColor"/>${SND.muted ? '<path d="M16 9.5l5 5M21 9.5l-5 5"/>' : '<path d="M15.5 9a4.2 4.2 0 0 1 0 6"/><path d="M18.3 6.4a8 8 0 0 1 0 11.2"/>'}</svg>`;
export const soundBtn = (cls) => `<button class="btn snd ${cls}" data-act="sound" aria-label="${soundLabel()}" title="${soundLabel()}" aria-pressed="${!SND.muted}">${soundIcon()}</button>`;
// The sounds of one move, from its result: [name, ms after the move starts, playback rate], in order.
// Each is timed to the animation it stands for (the same timings the animation uses).
export function moveSounds(f) {
  const out = [], add = (n, ms, rate) => out.push([n, ms, rate]);
  const won = f.kind === 'claim' || f.kind === 'match', total = playMs(f, hexLen(f));
  const sq = shownSq(f.square), mini = sq ? sq.mini : {}, last = mini.guesses ? mini.guesses[mini.guesses.length - 1] : null;
  if (f.timeout) { add('buzz', 0); add('randomMove', 380); }
  const game = viewOf(f.type);
  if (game.sounds) game.sounds(f, add, won, mini, last);
  const CASINO = ['bj', 'bus', 'rl', 'bullseye', 'echo', 'plinko', 'pong', 'trivia', 'oddone', 'dash', 'lane', 'golf', 'pool', 'bowling', 'craps', 'takeover', 'flood', 'seating', 'districts', 'shelves', 'roads', 'flap', 'chopper', 'patterns', 'wheels', 'sniff', 'clash', 'headcount', 'flash', 'snapshot', 'skyhop', 'scoop', 'pinball'];
  if (won && CASINO.includes(f.type)) add('won', total - 600);   // the card games and the wheel: the chime once the result shows
  else if (won && f.type !== 'ttt' && f.type !== 'wordle' && f.type !== 'hangman') add('won', Math.round(total * .5));   // the game is won: a chime (the square's stamp, and a match's end, follow on the board)
  if (f.kind === 'draw') add('reset', 420);                          // the square resets with a new mini-game
  return out;
}
// The end of the match, as this phone sees it: a win fanfare, a loss sting, or the tie chord.
export function matchEndSound() { const k = endKind().list; return k === 'win' ? 'winFanfare' : k === 'loss' ? 'loss' : 'tie'; }
// The board comes back after a move: the turn passed to the other player (no whoosh out of the square).
export function backSounds(from) {
  if (!state.winner && state.turn !== from.turn) SND.play('turn');
}

// Its listeners: main.js calls this once, in the page's original order of listeners.
export function init() {
  ['pointerdown', 'touchend', 'click', 'keydown'].forEach(ev => document.addEventListener(ev, SND.unlock, { capture: true, passive: true }));
  chip = document.createElement('button');
  chip.className = 'snd-chip'; chip.type = 'button'; chip.hidden = true; chip.textContent = 'Tap to restore sound';
  chip.addEventListener('click', e => { e.stopPropagation(); if (SND.ensure(true)) SND.play('toggle'); });   // (its pointerdown already made the new context)
  document.body.appendChild(chip);
  const back = () => {                                             // back on the page: checked afresh; still down a moment later, a new context
    if (hidden()) { refresh(); return; }
    probe = null; triedAway = false;
    if (SND.ctx && !up()) { kick(SND.ctx); setTimeout(() => SND.ensure(false), 700); }   // (the old one's own resume first: it may come back by itself)
    else SND.ensure(false);
  };
  document.addEventListener('visibilitychange', () => { if (SND.ctx) say(`page ${document.visibilityState}, ${SND.ctx.state}`); back(); });
  window.addEventListener('pageshow', back);
  window.addEventListener('focus', back);
  setInterval(() => { if (SND.ctx && !hidden()) SND.ensure(false); }, AUDIO_CHECK_MS);
  document.addEventListener('pointerup', () => { if (ownDown) { ownDown = false; ownUp = performance.now(); } }, true);
  document.addEventListener('pointercancel', () => { ownDown = false; }, true);
  document.addEventListener('click', e => {
    if (search.on) return;                                           // the searching screen is silent (even its Cancel)
    if (performance.now() - ownUp < 350) return;                     // the click that ends a press a game took itself (its own sound came with it), wherever it lands
    const el = e.target.closest && e.target.closest('[data-act], label.chk');
    if (!el || el.classList.contains('chk')) return;                 // (a box: its change plays the toggle)
    const act = el.dataset.act;
    let name = act && act in TAP_SOUND ? TAP_SOUND[act] : (el.classList.contains('back') ? 'back' : 'tap');
    if (name) SND.play(name, { ui: true });
  }, true);
  document.addEventListener('pointerdown', e => { if (e.target.closest && e.target.closest('button:disabled, input:disabled')) SND.play('error', { ui: true }); }, true);
  document.addEventListener('change', e => { if (e.target.type === 'checkbox') SND.play('toggle', { ui: true }); }, true);
}
