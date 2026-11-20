// Number Target: the screen, the miniature, the move's words and sounds, and this phone's attempt.
// The card: the target on a burst, the numbers as tiles (the puzzle's own, then each result as it is made), a line for
// the sum being built, the four signs with Undo, and Start. This phone's attempt runs from Start for the attempt's
// seconds (a bar across the card, real time whatever the Animation setting): tap a number, a sign, another number: the
// result becomes a new tile, ready to go on from. The target made, the attempt goes in at once; the time up (or Give
// up), it goes in as it stands. Only the attempt is sent, never the fiddling before it. Anyone's attempt then plays
// from the move: its sums written out one by one, then a tick or a cross.
import { NUMS, numbersCfg, numbersEval, numbersOp, numbersShowMs } from './rules.js';
import { SND, ownPress } from '../../audio/sound.js';
import { attemptMove } from '../../net/moves.js';
import { haptic } from '../../net/platform.js';
import { blocked } from '../../net/room.js';
import { state } from '../../ui/app.js';
import { CROSS, TICK } from '../../ui/art.js';
import { clockLeft } from '../../ui/clock.js';
import { fxAttr } from '../../ui/fx.js';
import { arcTally, lateAt, pips } from '../../ui/progress.js';
import { render } from '../../ui/render.js';
import { pipRows, thumbArt } from '../../ui/thumbs.js';

export const ownLine = true;
export const replay = { synth: () => [] };                         // only the attempt is sent: it plays from the flash
let att = null, src = null;                                        // this phone's attempt under way: { sq, p, pn, n, t0, steps, a, op, timer }
const SIGN = { '+': '+', '-': '−', '*': '×', '/': '÷' };
const live = () => { const sq = state.squares && state.squares[state.zoom], mini = sq && sq.mini; return att && mini && mini.type === 'numbers' && att.sq === state.zoom && !state.flash && !state.done ? mini : null; };
function send() { const A = att; if (!A) return; att = null; clearTimeout(A.timer); attemptMove({ steps: A.steps }); render(); }
function start() {
  const sq = state.squares && state.squares[state.zoom], mini = sq && sq.mini;
  if (att || !mini || mini.type !== 'numbers' || sq.owner || state.flash || state.done || state.winner || blocked() || !src || !src.mine) return;
  const c = numbersCfg(mini), left = clockLeft(), ms = Math.max(1000, Math.min(c.secs * 1000, left == null ? Infinity : left - 1200));
  att = { sq: state.zoom, p: state.turn, pn: mini.pn, t0: performance.now(), ms, steps: [], a: null, op: null };
  att.timer = setTimeout(() => { if (att && att.timer) { SND.play('thud'); send(); } }, ms);
  SND.play('fsGo'); render();
}
export const actions = {
  'nt-go': () => { ownPress(); if (att) send(); else start(); },
  'nt-num': b => {
    const mini = live(); if (!mini) return; ownPress();
    const i = Number(b.dataset.i), ev = numbersEval(mini.pz, att.steps), work = mini.pz.nums.concat(ev.out.map(q => q[3]));
    if (att.a != null && att.op && i !== att.a) {
      const v = numbersOp(work[att.a], att.op, work[i]);
      if (v == null) { SND.play('error'); haptic('error'); return; }
      att.steps.push([att.a, att.op, i]); att.a = work.length; att.op = null; SND.play('pop'); haptic('tap');
      if (v === mini.pz.target) { send(); return; }
    } else { att.a = att.a === i && !att.op ? null : i; SND.play('rtTick'); haptic('tap'); }
    render();
  },
  'nt-op': b => { const mini = live(); if (!mini || att.a == null) return; ownPress(); att.op = att.op === b.dataset.o ? null : b.dataset.o; SND.play('bdTurn'); haptic('tap'); render(); },
  'nt-undo': () => { const mini = live(); if (!mini) return; ownPress(); if (att.op) att.op = null; else if (att.steps.length) { att.steps.pop(); att.a = null; } else att.a = null; SND.play('rtTick'); render(); },
};
const sum = q => `<span class="ntsum"><b>${q[0]}</b><i>${SIGN[q[1]]}</i><b>${q[2]}</b><i>=</i><b class="r">${q[3]}</b></span>`;
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  const c = numbersCfg(mini), s = a && a.nt ? a.nt : null, o = { view, locked, turn }, rest = !s && (view || d) && mini.last && !mini.last.fresh ? mini.last : null, l = s || rest;
  if (att && (att.sq !== state.zoom || att.p !== turn || att.pn !== mini.pn || s || d || view || locked)) { clearTimeout(att.timer); att = null; }
  const by = s ? a.by : rest ? rest.by : turn, mine = !view && !locked && !s && !d, on = !!att, end = s ? numbersShowMs(s) : 0;
  src = { mine };
  const tal = p => arcTally(p, o, pips(p, s && s.fresh ? (a.by === p ? s.tries : c.attempts) : Math.min(c.attempts, mini.tries[p]), c.attempts, !!(s && a.by === p), end));
  const pz = l ? { nums: l.nums, target: l.target } : mini.pz;       // (a move on show: the puzzle it was made at, a new one dealt or not)
  let tiles, work;
  if (l) {
    tiles = pz.nums.map(v => `<span class="nttile">${v}</span>`).join('');
    work = `<div class="ntsteps">${l.steps.length ? l.steps.map((q, k) => `<span ${lateAt('ntrow', s ? NUMS.pre + k * NUMS.step : null)}>${sum(q)}</span>`).join('') : `<span ${lateAt('ntrow none', s ? NUMS.pre : null)}>No sum made</span>`}<b ${lateAt('ntmark ' + (l.hit ? 'ok' : 'no'), s ? end : null)}>${l.hit ? TICK : CROSS}</b></div>`;
  } else {
    const ev = on ? numbersEval(pz, att.steps) : { out: [] }, all = pz.nums.concat(ev.out.map(q => q[3])), used = new Set(); if (on) att.steps.forEach(q => { used.add(q[0]); used.add(q[2]); });
    tiles = all.map((v, i) => `<button class="nttile${i >= pz.nums.length ? ' made' : ''}${on && att.a === i ? ' sel' : ''}${used.has(i) ? ' used' : ''}" data-act="nt-num" data-i="${i}"${on && !used.has(i) ? '' : ' disabled'}>${v}</button>`).join('');
    const cur = on && att.a != null ? `<span class="ntsum"><b>${all[att.a]}</b>${att.op ? `<i>${SIGN[att.op]}</i><b class="q">?</b>` : ''}</span>` : '';
    work = `<div class="ntsteps live">${ev.out.slice(-2).map(q => `<span class="ntrow">${sum(q)}</span>`).join('')}<span class="ntrow cur">${cur}</span></div>`;
  }
  const bar = on ? `<span class="obar ntbar" style="--d:${att.ms}ms"><i></i></span>` : '<span class="ntbar"></span>';
  const ops = view ? '' : `<div class="ntops">${NUMS.ops.map(k => `<button class="btn ntop${on && att.op === k ? ' sel' : ''}" data-act="nt-op" data-o="${k}"${on && att.a != null ? '' : ' disabled'} aria-label="${{ '+': 'plus', '-': 'minus', '*': 'times', '/': 'divided by' }[k]}">${SIGN[k]}</button>`).join('')}<button class="btn ntop undo" data-act="nt-undo"${on ? '' : ' disabled'} aria-label="Undo"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 7 4 12l5 5"/><path d="M4 12h10a6 6 0 0 1 0 12"/></svg></button></div>`;
  const txt = l ? (l.hit ? `${l.target}! Spot on` : l.value == null ? 'No answer' : `${l.value}: not ${l.target}`) + (s && s.fresh ? ' · New puzzle' : '') : `Puzzle ${mini.pn}`;
  const line = s ? `<p ${lateAt('ntline ' + (s.hit ? 'ok' : 'no'), end)} role="status">${txt}</p>` : `<p class="ntline${l ? (l.hit ? ' ok' : ' no') : ''}">${txt}</p>`;
  const btn = view ? '' : `<button class="big ${turn} ntbtn" data-act="nt-go"${mine ? '' : ' disabled'}>${on ? 'Give up' : 'Start'}</button>`;
  return `<div class="g-nt pc-${by}"><div class="ctals">${tal('X')}${tal('O')}</div><div class="ntcard"${on ? fxAttr(att.t0, 'rt') : ''}><div class="nttarget" aria-label="Target ${pz.target}"><small>Make</small><b>${pz.target}</b></div>${bar}<div class="nttiles n${pz.nums.length}">${tiles}</div>${work}</div>${ops}${line}${btn}</div>`;
}
// The miniature: a little pad of the four signs, beside each player's attempts at this puzzle as pips.
export function miniature(mini, final) {
  const c = numbersCfg(mini);
  const art = '<svg class="tnt" viewBox="0 0 60 60"><rect class="tntb" x="2" y="2" width="56" height="56" rx="9"/><rect class="tntk" x="8" y="8" width="20" height="20" rx="4"/><rect class="tntk" x="32" y="8" width="20" height="20" rx="4"/><rect class="tntk" x="8" y="32" width="20" height="20" rx="4"/><rect class="tntk" x="32" y="32" width="20" height="20" rx="4"/><path class="tnts" d="M13 18h10M18 13v10M37 18h10M14 38l8 8M22 38l-8 8M37 42h10M42 37.500v.010M42 46.500v.010"/></svg>';
  return thumbArt(art, pipRows({ X: Math.min(c.attempts, mini.tries.X), O: Math.min(c.attempts, mini.tries.O) }, c.attempts), 'tntw', `Number Target: puzzle ${mini.pn}; X has tried ${mini.tries.X} times, O ${mini.tries.O}`);
}
export function moveText(f, who) { const s = f.nt; return !s ? `${who} tried` : s.hit ? `${who} made ${s.target}` : `${who} missed ${s.target}`; }
// A pop as each sum is written out, then the chime of the target made or a thud for a miss.
export function sounds(f, add, won, mini, last) {
  const s = f.nt; if (!s) return;
  s.steps.forEach((q, k) => add('pop', NUMS.pre + k * NUMS.step, 1 + k * 0.06));
  add(s.hit ? 'solve' : 'thud', numbersShowMs(s));
}
