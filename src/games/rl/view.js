// Roulette: the screen, the miniature, the move's words and sounds, and the inputs.
import { tune } from '../../core/tune.js';
import { RL, RLT, rlCovers, rlRed } from './rules.js';
import { N, REDUCED, WAAPI, app, mv, state, zoomedType } from '../../ui/app.js';
import { lateAt } from '../../ui/progress.js';
import { render } from '../../ui/render.js';

export let rlDraft = null;                                              // Roulette: { sq, nums, bet } the bet being put together on this phone                                                // { sq, k, at }: the peg just placed pops in
// Roulette: the wheel (the pocket that came up turns to the top, under the pointer, and the ball rests in
// it), each player's hits, and the betting board: 8 numbers, a row of 8, or green 0, then Spin.
const RL_STEP = 360 / RL.wheel.length;
const rlPt = (r, deg) => { const t = (deg - 90) * Math.PI / 180; return `${(r * Math.cos(t)).toFixed(2)} ${(r * Math.sin(t)).toFixed(2)}`; };
const RL_FACE = RL.wheel.map((n, i) => {
  const a0 = i * RL_STEP - RL_STEP / 2, a1 = a0 + RL_STEP, cls = n === 0 ? 'g' : rlRed(n) ? 'r' : 'b';
  return `<path class="${cls}" d="M${rlPt(58, a0)}L${rlPt(92, a0)}A92 92 0 0 1 ${rlPt(92, a1)}L${rlPt(58, a1)}A58 58 0 0 0 ${rlPt(58, a0)}Z"/><text transform="rotate(${(i * RL_STEP).toFixed(1)}) translate(0 -81)">${n}</text>`;
}).join('');
function rlWheel(n, anim, t0) {
  const k = n == null ? 0 : RL.wheel.indexOf(n), w = -k * RL_STEP;
  return `<svg class="rlwheel${anim ? ' spin' : ''}" viewBox="-100 -104 200 208" role="img" aria-label="${n == null ? 'The wheel' : `The wheel: ${n}${n === 0 ? ', green' : rlRed(n) ? ', red' : ', black'}`}">
    <circle class="rim" r="99"/><g class="rlw" style="--w:${w.toFixed(1)}deg">${RL_FACE}<circle class="hub" r="56"/><path class="spoke" d="M0 -40V40M-40 0H40"/><circle class="cap" r="12"/></g>
    ${n == null ? '' : `<g class="rlb"><circle r="99" fill="none"/><circle class="ball" cy="-67" r="6"/></g>`}<path class="ptr" d="M-8 -104H8L0 -92Z"/></svg>`;
}
const rlBetText = bet => (bet === 'zero' ? 'green 0' : RL.groups[bet] ? `${RL.groups[bet][0]}–${RL.groups[bet][1]}` : '8 numbers');
function rlTable(mini, a, o) {
  // (pending and shared: a bet put down and one spin settling both at the round's end, from Super Chaos matches
  // saved before each round drew its spin up front; a bet now always spins at once, on the round's number.)
  const b = a && a.rl ? a.rl : null, l = mini.last, turn = o.turn, tEnd = RLT.spin + RLT.settle;
  const spin = b && !b.pending ? b : null, shared = spin ? !!spin.shared : !!(l && l.shared && !b);
  const pend = b ? (b.pending ? { by: a.by, bet: b.bet } : null) : l && l.pending ? { by: l.by, bet: l.bet } : null;
  const prev = (mini.spins || []).filter(x => x != null).slice(-1)[0], prevN = prev == null ? null : typeof prev === 'number' ? prev : prev.n;
  const n = spin ? spin.n : l && !l.pending && l.n != null ? l.n : prevN;
  const hitBy = p => (spin ? (spin.shared ? !!spin.hit[p] && spin.bets[p] !== 'zero' : spin.hit && a.by === p && spin.bet !== 'zero') : false);
  const goal = tune(mini).goal, hits = p => {
    const h = Math.min(goal, mini.hits[p]), fresh = hitBy(p);
    const pips = Array.from({ length: goal }, (_, k) => `<i ${lateAt(k < h ? 'on' : '', fresh && k === h - 1 ? tEnd : null, 'fillin')}></i>`).join('');
    return `<div class="ctal ${p}${!o.view && turn === p ? ' now' : ''}"><b class="${p}">${N(p)}</b><span class="pips" aria-label="${mini.hits[p]} of ${goal} hits">${pips}</span></div>`;
  };
  const W = p => `<b class="${p}">${N(p)}</b>`, num = k => `<span class="rlnum ${k === 0 ? 'g' : rlRed(k) ? 'r' : 'b'}">${k}</span>`;
  const one = (bet, hit) => (hit ? (bet === 'zero' ? 'green 0!' : 'hit!') : 'miss');
  const sh = spin && spin.shared ? spin : shared ? l : null;   // the shared spin, playing or as it ended
  const res = sh ? `<p ${lateAt('rlres', spin ? tEnd : null)}>${num(sh.n)}<span>${['X', 'O'].filter(p => sh.bets[p]).map(p => `${W(p)} ${one(sh.bets[p], sh.hit[p])}`).join(' · ')}</span></p>`
    : pend ? `<p class="rlres"><span>${W(pend.by)} bet ${rlBetText(pend.bet)} · waiting for the spin</span></p>`
    : spin || l ? `<p ${lateAt('rlres', spin ? tEnd : null)}>${num(n)}<span>${W(spin ? a.by : l.by)} bet ${rlBetText((spin || l).bet)} · ${one((spin || l).bet, (spin || l).hit)}</span></p>` : '<p class="rlres">&nbsp;</p>';
  // The bet on the board: the move playing out (both players' in a shared spin, each in their colour), a bet
  // waiting for its spin, else the one being put together on this phone.
  if (!rlDraft || rlDraft.sq !== o.zoom || o.moved) rlDraft = { sq: o.zoom, nums: [], bet: null };   // a fresh bet after every spin
  const marks = spin ? (spin.shared ? spin.bets : { [a.by]: spin.bet }) : pend ? { [pend.by]: pend.bet } : null;
  const dr = o.view || marks ? { nums: [], bet: null } : rlDraft;
  const covers = (bet, k) => !!bet && (Array.isArray(bet) ? bet.includes(k) : bet !== 'zero' && rlCovers(bet, k));
  const tint = !(spin && !spin.shared);                          // a bet waiting for its spin, or the shared spin: each in its player's colour
  const mk = k => (!marks ? '' : !tint ? (covers(marks[a.by], k) ? ' on' : '') : ['X', 'O'].filter(p => covers(marks[p], k)).map(p => ' on m' + p).join(''));
  const on = k => dr.nums.includes(k) || (dr.bet && dr.bet !== 'zero' && rlCovers(dr.bet, k));
  const gOn = g => (marks ? (!tint ? (marks[a.by] === g ? ' on' : '') : ['X', 'O'].filter(p => marks[p] === g).map(p => ' on m' + p).join('')) : dr.bet === g ? ' on' : '');
  const zOn = marks ? (!tint ? (marks[a.by] === 'zero' ? ' on' : '') : ['X', 'O'].filter(p => marks[p] === 'zero').map(p => ' on m' + p).join('')) : dr.bet === 'zero' ? ' on' : '';
  const dis = o.locked || marks ? ' disabled' : '';
  // The marker on the number that came up: it moves there from the wheel as the ball lands (rlMarker), and
  // stays on it until the next spin, so a bet that covers it is plain to see.
  const land = k => (spin && spin.n === k ? ' landing' : ''), landT = k => (spin && spin.n === k ? ` style="--t:${tEnd}ms"` : '');
  const dolly = k => (spin && spin.n === k ? `<i class="dolly fly" style="--t:${tEnd}ms" aria-hidden="true"></i>` : !spin && n === k && n != null && !pend ? '<i class="dolly" aria-hidden="true"></i>' : '');
  const grid = ['g1', 'g2', 'g3'].map(g => {
    const [lo, hi] = RL.groups[g], cells = [];
    for (let k = lo; k <= hi; k++) { const c = marks ? mk(k) : on(k) ? ' on' : ''; cells.push(`<button class="rln ${rlRed(k) ? 'r' : 'b'}${c}${n === k && !spin ? ' last' : ''}${land(k)}"${landT(k)} data-act="rlnum" data-n="${k}" aria-pressed="${!!c}" aria-label="${k}, ${rlRed(k) ? 'red' : 'black'}"${dis}>${k}${dolly(k)}</button>`); }
    return `<div class="rlrow">${cells.join('')}<button class="rlg${gOn(g)}" data-act="rlgrp" data-g="${g}" aria-pressed="${!!gOn(g)}" aria-label="Group ${lo} to ${hi}"${dis}>${lo}–${hi}</button></div>`;
  }).join('');
  const bet = dr.bet || (dr.nums.length === RL.pick ? dr.nums : null);
  const say = marks ? ['X', 'O'].filter(p => marks[p]).map(p => `${W(p)}: ${rlBetText(marks[p])}`).join(' · ')
    : dr.bet === 'zero' ? 'Betting green 0'
    : dr.bet ? `Betting the group ${rlBetText(dr.bet)}` : dr.nums.length === RL.pick ? 'Betting your 8 numbers'
    : dr.nums.length ? `${RL.pick - dr.nums.length} more number${RL.pick - dr.nums.length === 1 ? '' : 's'} to pick` : '&nbsp;';
  const board = o.view ? '' : `<div class="rlboard"><div class="rlrow top"><button class="rlz${zOn}${land(0)}"${landT(0)} data-act="rlzero" aria-pressed="${!!zOn}" aria-label="Green 0"${dis}>0${dolly(0)}</button><p class="rlsay">${say}</p></div>${grid}</div>
    <div class="cbtns one"><button class="big ${turn} rlspin" data-act="move" ${mv(bet || [])}${!bet || o.locked || marks ? ' disabled' : ''}>Spin</button></div>`;
  // Once the ball lands: HIT!, MISS or GREEN 0!, big in its own slot under the wheel (never over it), held a second before the game moves on.
  const anyHit = spin ? (spin.shared ? ['X', 'O'].some(p => spin.hit[p]) : spin.hit) : false;
  const zeroHit = spin ? (spin.shared ? ['X', 'O'].some(p => spin.hit[p] && spin.bets[p] === 'zero') : spin.hit && spin.bet === 'zero') : false;
  const bigTxt = !spin ? '' : zeroHit ? 'Green 0!' : spin.shared && spin.hit.X && spin.hit.O ? 'Both hit!' : anyHit ? 'Hit!' : 'Miss';
  const bigCls = !spin ? '' : zeroHit ? 'zero' : anyHit ? 'hit' + (spin.shared && !(spin.hit.X && spin.hit.O) ? ' ' + (spin.hit.X ? 'X' : 'O') : '') : 'miss';
  const big = spin ? `<b ${lateAt('rlbig ' + bigCls, tEnd)} role="status">${bigTxt}</b>` : '';
  // Under the wheel: the recent spins, as on the miniature (a hit in the spinner's colour, a miss plain). While
  // a spin plays, the row before it stays; the new one takes its place as the ball lands.
  const chips = list => (list.length ? list.map(x => `<i class="sp ${x.n === 0 ? 'g' : rlRed(x.n) ? 'r' : 'b'}${x.hit ? ' hit ' + (x.by || '') : ''}" title="${x.n}${x.hit ? ': a hit' : ''}">${x.n}</i>`).join('') : '<small>No spins yet</small>');
  const all = (mini.spins || []).map(x => (typeof x === 'number' ? { n: x, hit: false } : x)).filter(x => x && Number.isInteger(x.n));
  const spins = spin && !REDUCED ? `<span class="tu" style="--u:${tEnd}ms">${chips(all.slice(0, -1))}</span><span class="tf" style="--f:${tEnd}ms">${chips(all)}</span>` : `<span>${chips(all)}</span>`;
  const hist = `<div class="rlspins" aria-label="Recent spins: ${all.map(x => x.n + (x.hit ? ' (hit)' : '')).join(', ') || 'none'}">${spins}</div>`;
  return `<div class="g-rl"><div class="rltop"><div class="ctals col">${hits('X')}${hits('O')}${res}</div><div class="rlside"><div class="rlwrap">${rlWheel(n, !!spin)}</div><div class="rlbigslot">${big}</div>${hist}</div></div>${board}</div>`;
}
// The marker's move from the wheel to its number as the ball lands (anchored to the move by its [data-fx]).
export function rlMarker() {
  const f = state.flash;
  if (!f || f.type !== 'rl' || !f.rl || f.rl.pending || !WAAPI || REDUCED) return;
  const el = app.querySelector('.g-rl .dolly.fly'), ptr = app.querySelector('.g-rl .rlwheel .ptr');
  if (!el || !ptr) return;
  const a = ptr.getBoundingClientRect(), b = el.getBoundingClientRect();
  const dx = a.left + a.width / 2 - (b.left + b.width / 2), dy = a.bottom + 14 - (b.top + b.height / 2), t = RLT.spin + RLT.settle;
  el.style.animation = 'none';
  el.animate([
    { transform: `translate(${dx}px, ${dy}px) scale(.7)`, opacity: 0, offset: 0 },
    { transform: `translate(${dx}px, ${dy}px) scale(.7)`, opacity: 1, offset: .12 },
    { transform: `translate(${dx * .5}px, ${dy * .5 - 40}px) scale(1.5)`, opacity: 1, offset: .6, easing: 'ease-in' },
    { transform: 'translate(0, 0) scale(1)', opacity: 1, offset: 1 },
  ], { duration: 650, delay: t, fill: 'both', easing: 'ease-out' });
}
// A small wheel for the miniature: the pockets in their colours (green zero, then red and black around), a hub.
function rlMiniWheel() {
  const n = 12, seg = Array.from({ length: n }, (_, k) => { const a0 = k / n * Math.PI * 2 - Math.PI / 2, a1 = (k + 1) / n * Math.PI * 2 - Math.PI / 2, f = a => `${(50 + 46 * Math.cos(a)).toFixed(1)} ${(50 + 46 * Math.sin(a)).toFixed(1)}`;
    return `<path d="M50 50 L${f(a0)} A46 46 0 0 1 ${f(a1)}Z" fill="${k === 0 ? '#2f8a3c' : k % 2 ? '#d6301e' : '#2b2b2b'}"/>`; }).join('');
  return `<svg class="tmwheel" viewBox="0 0 100 100" aria-hidden="true">${seg}<circle cx="50" cy="50" r="46" fill="none" stroke="var(--ink)" stroke-width="5"/><circle cx="50" cy="50" r="17" fill="var(--paper)" stroke="var(--ink)" stroke-width="4"/><circle cx="50" cy="50" r="5" fill="var(--ink)"/></svg>`;
}
export function miniature(mini, final) {   // the hits so far, and the recent spins: every one, a hit in the spinner's colour, a miss plain
  const spins = (mini.spins || []).map(x => (typeof x === 'number' ? { n: x, hit: false } : x)).filter(x => x && Number.isInteger(x.n));
  const chip = x => `<i class="sp ${x.n === 0 ? 'g' : rlRed(x.n) ? 'r' : 'b'}${x.hit ? ' hit ' + (x.by || '') : ''}" title="${x.n}${x.hit ? ': a hit' : ''}">${x.n}</i>`;
  return `<div class="tpip rlmini"><div class="rlrow"><div class="rlcol">${['X', 'O'].map(p => `<div class="tr ${p}"><b class="${p}">${p}</b>${Array.from({ length: tune(mini).goal }, (_, k) => `<i class="${k < mini.hits[p] ? 'on' : ''}"></i>`).join('')}</div>`).join('')}</div>${rlMiniWheel()}</div>${spins.length ? `<div class="tspins" aria-label="Recent spins: ${spins.map(x => x.n + (x.hit ? ' (hit)' : '')).join(', ')}">${spins.map(chip).join('')}</div>` : ''}</div>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = rlTable(mini, a, { view, locked, turn, zoom: state.zoom, moved: !!(f || d) }); return g;
}
export function moveText(f, who) {
  if (f.rl && f.rl.pending) return `${who} bet ${rlBetText(f.rl.bet)}`;
  if (f.rl && f.rl.shared) return `${f.rl.n}${f.rl.n === 0 ? ' green' : rlRed(f.rl.n) ? ' red' : ' black'} · ${['X', 'O'].filter(p => f.rl.bets[p]).map(p => `${N(p)} ${f.rl.hit[p] ? 'hit' : 'missed'}`).join(', ')}`;
  return f.rl ? `${f.rl.n}${f.rl.n === 0 ? ' green' : rlRed(f.rl.n) ? ' red' : ' black'} · ${f.rl.hit ? 'a hit' : 'a miss'}` : `${who} spun`;
}
export function sounds(f, add, won, mini, last) {
  if (f.rl && f.rl.pending) { add('chips', 0); return; }         // Super Chaos: the bet put down
  const ticks = 14;                                              // the ball clicks over the pockets, slower and slower
  add('rlSpin', 0);
  for (let k = 1; k <= ticks; k++) add('ballTick', Math.round(RLT.spin * Math.pow(k / ticks, 0.6)));
  add('ballDrop', RLT.spin);
  if (f.rl && f.rl.shared) { const h = ['X', 'O'].filter(p => f.rl.hit[p]); add(!h.length ? 'thud' : h.some(p => f.rl.bets[p] === 'zero') ? 'sparkle' : 'ding', RLT.spin + RLT.settle); }
  else if (f.rl) add(f.rl.hit ? (f.rl.bet === 'zero' ? 'sparkle' : 'ding') : 'thud', RLT.spin + RLT.settle);
  return;
}
// Roulette: put the bet together (numbers, a group, or green 0 alone)
export function rlnumAct(el, e, act) {
  if (zoomedType() !== 'rl') return;
  if (!rlDraft || rlDraft.sq !== state.zoom) rlDraft = { sq: state.zoom, nums: [], bet: null };
  const dr = rlDraft;
  if (act === 'rlnum') {
    const n = Number(el.dataset.n);
    if (dr.bet) { dr.bet = null; dr.nums = []; }               // a group or 0 gives way to numbers
    if (dr.nums.includes(n)) dr.nums = dr.nums.filter(k => k !== n);
    else { if (dr.nums.length >= RL.pick) dr.nums.shift(); dr.nums.push(n); }   // a ninth number takes the place of the first
  } else {
    const bet = act === 'rlzero' ? 'zero' : el.dataset.g;
    dr.bet = dr.bet === bet ? null : bet; dr.nums = [];
  }
  render();
}
// Someone else's bet replayed (ui/replay.js): their numbers, group or 0 go onto the board as theirs did, then Spin.
function replayInput(act, val, r) {
  if (!rlDraft || rlDraft.sq !== r.sq) rlDraft = { sq: r.sq, nums: [], bet: null };
  const dr = rlDraft;
  if (act === 'rlnum' && /^n=\d+$/.test(val || '')) { const n = Number(val.slice(2)); if (dr.bet) { dr.bet = null; dr.nums = []; } if (!dr.nums.includes(n)) { if (dr.nums.length >= RL.pick) dr.nums.shift(); dr.nums.push(n); } }
  else if (act === 'rlgrp' && /^g=g[123]$/.test(val || '')) { dr.bet = val.slice(2); dr.nums = []; }
  else if (act === 'rlzero') { dr.bet = 'zero'; dr.nums = []; }
  return false;
}
const replaySynth = m => (Array.isArray(m) ? m.map((n, k) => [k * 260, 'rlnum', 'n=' + n]).concat([[m.length * 260 + 300, 'move', 'm=' + JSON.stringify(m)]])
  : m === 'zero' ? [[0, 'rlzero'], [700, 'move', 'm="zero"']] : typeof m === 'string' ? [[0, 'rlgrp', 'g=' + m], [700, 'move', 'm=' + JSON.stringify(m)]] : null);
export const replay = { input: replayInput, synth: replaySynth };
// Its own controls (data-act): the page's click handler hands them here.
export const actions = { rlnum: rlnumAct, rlgrp: rlnumAct, rlzero: rlnumAct };

// Setters for the names other modules reassign (an imported name is read-only there).
export function setRlDraft(v) { rlDraft = v; }
