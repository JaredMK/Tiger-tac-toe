// Roulette: the screen, the miniature, the move's words and sounds, and the inputs.
import { RL, RLT, rlCovers, rlRed } from './rules.js';
import { N, REDUCED, mv, state, zoomedType } from '../../ui/app.js';
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
  const b = a && a.rl ? a.rl : null, l = mini.last, turn = o.turn, tEnd = RLT.spin + RLT.settle;
  const n = b ? b.n : l ? l.n : null;
  const hits = p => {
    const h = Math.min(RL.goal, mini.hits[p]), fresh = b && b.hit && a.by === p && b.bet !== 'zero';
    const pips = Array.from({ length: RL.goal }, (_, k) => `<i ${lateAt(k < h ? 'on' : '', fresh && k === h - 1 ? tEnd : null, 'fillin')}></i>`).join('');
    return `<div class="ctal ${p}${!o.view && turn === p ? ' now' : ''}"><b class="${p}">${N(p)}</b><span class="pips" aria-label="${mini.hits[p]} of ${RL.goal} hits">${pips}</span></div>`;
  };
  const shown = b || l;
  const res = shown ? `<p ${lateAt('rlres', b ? tEnd : null)}><span class="rlnum ${n === 0 ? 'g' : rlRed(n) ? 'r' : 'b'}">${n}</span><span><b class="${b ? a.by : l.by}">${N(b ? a.by : l.by)}</b> bet ${rlBetText(shown.bet)} · ${shown.hit ? (shown.bet === 'zero' ? 'green 0!' : 'hit!') : 'miss'}</span></p>` : '<p class="rlres">&nbsp;</p>';
  // The bet on the board: the move playing out, else the one being put together on this phone.
  if (!rlDraft || rlDraft.sq !== o.zoom || o.moved) rlDraft = { sq: o.zoom, nums: [], bet: null };   // a fresh bet after every spin
  const dr = b ? { nums: Array.isArray(b.bet) ? b.bet : [], bet: Array.isArray(b.bet) ? null : b.bet } : o.view ? { nums: [], bet: null } : rlDraft;
  const on = k => dr.nums.includes(k) || (dr.bet && dr.bet !== 'zero' && rlCovers(dr.bet, k));
  const dis = o.locked ? ' disabled' : '';
  const grid = ['g1', 'g2', 'g3'].map(g => {
    const [lo, hi] = RL.groups[g], cells = [];
    for (let k = lo; k <= hi; k++) cells.push(`<button class="rln ${rlRed(k) ? 'r' : 'b'}${on(k) ? ' on' : ''}${n === k && !b ? ' last' : ''}" data-act="rlnum" data-n="${k}" aria-pressed="${on(k)}" aria-label="${k}, ${rlRed(k) ? 'red' : 'black'}"${dis}>${k}</button>`);
    return `<div class="rlrow">${cells.join('')}<button class="rlg${dr.bet === g ? ' on' : ''}" data-act="rlgrp" data-g="${g}" aria-pressed="${dr.bet === g}" aria-label="Group ${lo} to ${hi}"${dis}>${lo}–${hi}</button></div>`;
  }).join('');
  const bet = dr.bet || (dr.nums.length === RL.pick ? dr.nums : null);
  const say = dr.bet === 'zero' ? 'Betting green 0'
    : dr.bet ? `Betting the group ${rlBetText(dr.bet)}` : dr.nums.length === RL.pick ? 'Betting your 8 numbers'
    : dr.nums.length ? `${RL.pick - dr.nums.length} more number${RL.pick - dr.nums.length === 1 ? '' : 's'} to pick` : '&nbsp;';
  const board = o.view ? '' : `<div class="rlboard"><div class="rlrow top"><button class="rlz${dr.bet === 'zero' ? ' on' : ''}" data-act="rlzero" aria-pressed="${dr.bet === 'zero'}" aria-label="Green 0"${dis}>0</button><p class="rlsay">${say}</p></div>${grid}</div>
    <div class="cbtns one"><button class="big ${turn} rlspin" data-act="move" ${mv(bet || [])}${!bet || o.locked ? ' disabled' : ''}>Spin</button></div>`;
  // Once the ball lands: HIT!, MISS or GREEN 0!, big on the wheel, held a second before the game moves on.
  const big = b ? `<b ${lateAt('rlbig ' + (b.hit ? (b.bet === 'zero' ? 'zero' : 'hit') : 'miss'), tEnd)} role="status">${b.hit ? (b.bet === 'zero' ? 'Green 0!' : 'Hit!') : 'Miss'}</b>` : '';
  // Under the wheel: the recent spins, as on the miniature (a hit in the spinner's colour, a miss plain). While
  // a spin plays, the row before it stays; the new one takes its place as the ball lands.
  const chips = list => (list.length ? list.map(x => `<i class="sp ${x.n === 0 ? 'g' : rlRed(x.n) ? 'r' : 'b'}${x.hit ? ' hit ' + (x.by || '') : ''}" title="${x.n}${x.hit ? ': a hit' : ''}">${x.n}</i>`).join('') : '<small>No spins yet</small>');
  const all = (mini.spins || []).map(x => (typeof x === 'number' ? { n: x, hit: false } : x)).filter(x => x && Number.isInteger(x.n));
  const spins = b && !REDUCED ? `<span class="tu" style="--u:${tEnd}ms">${chips(all.slice(0, -1))}</span><span class="tf" style="--f:${tEnd}ms">${chips(all)}</span>` : `<span>${chips(all)}</span>`;
  const hist = `<div class="rlspins" aria-label="Recent spins: ${all.map(x => x.n + (x.hit ? ' (hit)' : '')).join(', ') || 'none'}">${spins}</div>`;
  return `<div class="g-rl"><div class="rltop"><div class="ctals col">${hits('X')}${hits('O')}${res}</div><div class="rlside"><div class="rlwrap">${rlWheel(n, !!b)}${big}</div>${hist}</div></div>${board}</div>`;
}
export function miniature(mini, final) {   // the hits so far, and the recent spins: every one, a hit in the spinner's colour, a miss plain
  const spins = (mini.spins || []).map(x => (typeof x === 'number' ? { n: x, hit: false } : x)).filter(x => x && Number.isInteger(x.n));
  const chip = x => `<i class="sp ${x.n === 0 ? 'g' : rlRed(x.n) ? 'r' : 'b'}${x.hit ? ' hit ' + (x.by || '') : ''}" title="${x.n}${x.hit ? ': a hit' : ''}">${x.n}</i>`;
  return `<div class="tpip">${['X', 'O'].map(p => `<div class="tr ${p}"><b class="${p}">${p}</b>${Array.from({ length: RL.goal }, (_, k) => `<i class="${k < mini.hits[p] ? 'on' : ''}"></i>`).join('')}</div>`).join('')}${spins.length ? `<div class="tspins" aria-label="Recent spins: ${spins.map(x => x.n + (x.hit ? ' (hit)' : '')).join(', ')}">${spins.map(chip).join('')}</div>` : ''}</div>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = rlTable(mini, a, { view, locked, turn, zoom: state.zoom, moved: !!(f || d) }); return g;
}
export function moveText(f, who) {
  return f.rl ? `${f.rl.n}${f.rl.n === 0 ? ' green' : rlRed(f.rl.n) ? ' red' : ' black'} · ${f.rl.hit ? 'a hit' : 'a miss'}` : `${who} spun`;
}
export function sounds(f, add, won, mini, last) {
  const ticks = 14;                                              // the ball clicks over the pockets, slower and slower
  add('rlSpin', 0);
  for (let k = 1; k <= ticks; k++) add('ballTick', Math.round(RLT.spin * Math.pow(k / ticks, 0.6)));
  add('ballDrop', RLT.spin);
  if (f.rl) add(f.rl.hit ? (f.rl.bet === 'zero' ? 'sparkle' : 'ding') : 'thud', RLT.spin + RLT.settle);
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
// Its own controls (data-act): the page's click handler hands them here.
export const actions = { rlnum: rlnumAct, rlgrp: rlnumAct, rlzero: rlnumAct };

// Setters for the names other modules reassign (an imported name is read-only there).
export function setRlDraft(v) { rlDraft = v; }
