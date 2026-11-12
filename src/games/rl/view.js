// Roulette: the screen, the miniature, the move's words and sounds, and the inputs.
import { tune } from '../../core/tune.js';
import { RL, RLT, rlCovers, rlRed } from './rules.js';
import { N, REDUCED, WAAPI, app, mv, state, zoomedType } from '../../ui/app.js';
import { fxAttr } from '../../ui/fx.js';
import { lateAt } from '../../ui/progress.js';
import { render } from '../../ui/render.js';
import { bez, passTimes } from '../../ui/spin.js';

export let rlDraft = null;                                              // Roulette: { sq, nums, bet, pop } the bet being put together on this phone (pop: { k, at } the number, group or 'zero' just picked, and when: it pops once, from that moment)
// Roulette: the wheel (the pocket that came up turns to the top, under the pointer, and the ball rests in
// it), each player's hits, and the betting board: 8 numbers, a row of 8, or green 0, then Spin.
const RL_STEP = 360 / RL.wheel.length;
const rlPt = (r, deg) => { const t = (deg - 90) * Math.PI / 180; return `${(r * Math.cos(t)).toFixed(2)} ${(r * Math.sin(t)).toFixed(2)}`; };
const rlWedge = (a0, a1, r0 = 58, r1 = 92) => `M${rlPt(r0, a0)}L${rlPt(r1, a0)}A${r1} ${r1} 0 0 1 ${rlPt(r1, a1)}L${rlPt(r0, a1)}A${r0} ${r0} 0 0 0 ${rlPt(r0, a0)}Z`;
const RL_FACE = RL.wheel.map((n, i) => {
  const a0 = i * RL_STEP - RL_STEP / 2, a1 = a0 + RL_STEP, cls = n === 0 ? 'g' : rlRed(n) ? 'r' : 'b';
  return `<path class="${cls}" d="${rlWedge(a0, a1)}"/><text transform="rotate(${(i * RL_STEP).toFixed(1)}) translate(0 -81)">${n}</text>`;
}).join('');
// The spin (the stylesheet's rlwheel, rlball and rldrop play these same figures: tests/ui/wheel-spin.test.mjs): the
// wheel winds back a touch, then turns on from the pocket it rested on to the new one under the pointer (a turn and
// a half at least), slowing all the way; the ball runs the other way round the track, drops into the pocket as the
// wheel stops (drop to land, of the spin and its settle), hops once and lies still (RLT.spin + RLT.settle: the result).
export const RLV = { wind: 0.06, back: 10, turns: 540, e0: [0.45, 0, 0.55, 1], e1: [0.16, 0.6, 0.25, 1], ball: 1080, eb: [0.15, 0.55, 0.25, 1], drop: 0.78, land: 0.88 };
const RL_E0 = bez(...RLV.e0), RL_E1 = bez(...RLV.e1), RL_EB = bez(...RLV.eb);
// Where the wheel turns from and to (degrees) for a spin that lands on n: from the pocket it showed (`from`: the
// spin before, in the move's flash; none, a fresh wheel or an older record: a turn and a half before its stop).
export function rlTurn(n, from) {
  const k = Math.max(0, RL.wheel.indexOf(n)), base = -k * RL_STEP, j = from == null ? -1 : RL.wheel.indexOf(from);
  if (j < 0) return { w0: base - RLV.turns, w: base };
  const w0 = -j * RL_STEP, d = (((base - w0) % 360) + 360) % 360;
  return { w0, w: w0 + d + (d + 360 < RLV.turns ? 720 : 360) };   // (whole turns on top of the way round to it: a turn and a half at least)
}
// The ball's clicks: each time a pocket's edge passes under it (the wheel one way, the ball the other), until it drops.
export function rlTicks(n, from) {
  const t = rlTurn(n, from), a = t.w0 - RLV.back;
  const wheel = u => (u < RLV.wind ? t.w0 + (a - t.w0) * RL_E0(u / RLV.wind) : a + (t.w - a) * RL_E1((u - RLV.wind) / (1 - RLV.wind)));
  const dropAt = RLV.drop * (RLT.spin + RLT.settle) / RLT.spin;
  return passTimes(u => wheel(u) - RLV.ball * (1 - RL_EB(u)) - RL_STEP / 2, RL_STEP, RLT.spin, { u0: RLV.wind, u1: Math.min(1, dropAt), gap: 58 });   // (the ball over the wheel: a pocket's edge every step, half a step from its middle)
}
// picks: { X: bet, O: bet } to show on the wheel (each covered pocket's stretch of the rim in its picker's colour;
// with `full`, a whole pick, the pockets nobody covers are dimmed, so a ball that lands in a lit one is a hit at a glance);
// spin: { n, from, hit: 'X' | 'O' | 'XO' | '' } the move playing.
function rlWheel(n, spin, picks, full) {
  const k = n == null ? 0 : RL.wheel.indexOf(n), t = spin ? rlTurn(n, spin.from) : null, w = t ? t.w : -k * RL_STEP;
  const covers = (bet, x) => !!bet && (Array.isArray(bet) ? bet.includes(x) : rlCovers(bet, x));
  const marks = picks ? RL.wheel.map((x, i) => {
    const by = ['X', 'O'].filter(p => covers(picks[p], x)), a0 = i * RL_STEP - RL_STEP / 2, a1 = a0 + RL_STEP;
    if (!by.length) return full ? `<path class="rloff" d="${rlWedge(a0, a1)}"/>` : '';
    return by.map((p, j) => { const b0 = a0 + (by.length > 1 ? j * RL_STEP / 2 : 0) + 0.9, b1 = (by.length > 1 ? a0 + (j + 1) * RL_STEP / 2 : a1) - 0.9; return `<path class="rlpk ${p}" d="M${rlPt(95.6, b0)}A95.6 95.6 0 0 1 ${rlPt(95.6, b1)}"/>`; }).join('');
  }).join('') : '';
  const tEnd = RLT.spin + RLT.settle;
  const glow = spin && spin.hit ? `<path class="rlhit ${spin.hit} appear" style="--t:${tEnd}ms" d="${rlWedge(-RL_STEP / 2, RL_STEP / 2, 57, 93)}"/>` : '';   // the pocket that came up, under the pointer: ringed in the colour of whoever it is a hit for, as the ball settles
  const style = t ? `--w0:${t.w0.toFixed(1)}deg;--w:${w.toFixed(1)}deg;--sp:${RLT.spin}ms;--st:${tEnd}ms` : `--w:${w.toFixed(1)}deg`;
  return `<svg class="rlwheel${spin ? ' spin' : ''}${spin && spin.from == null ? ' fresh' : ''}" style="${style}" viewBox="-100 -104 200 208" role="img" aria-label="${n == null ? 'The wheel' : `The wheel: ${n}${n === 0 ? ', green' : rlRed(n) ? ', red' : ', black'}`}">
    <circle class="shd" cy="4.5" r="99"/><circle class="rim" r="99"/><g class="rlw">${RL_FACE}${marks}<circle class="rin" r="92"/><circle class="hub" r="56"/><circle class="cone" r="38"/><path class="spoke" d="M0 -40V40M-40 0H40"/><circle class="cap" r="12"/><circle class="caph" cx="-3.5" cy="-3.5" r="3"/></g>${glow}
    ${n == null ? '' : `<g class="rlb"><circle r="99" fill="none"/><g class="ball"><circle class="bsh" cx="1.5" cy="-65" r="6"/><circle class="bb" cy="-67" r="6"/><circle class="bhl" cx="1.9" cy="-65.1" r="2.3"/></g></g>`}<path class="ptr" d="M-8 -104H8L0 -92Z"/></svg>`;
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
    return `<div class="ctal ${p}${!o.view && turn === p ? ' now' : ''}"><b class="${p} tnm">${N(p)}</b><span class="pips" aria-label="${mini.hits[p]} of ${goal} hits">${pips}</span></div>`;
  };
  const W = p => `<b class="${p}">${N(p)}</b>`, num = k => `<span class="rlnum ${k === 0 ? 'g' : rlRed(k) ? 'r' : 'b'}">${k}</span>`;
  const one = (bet, hit) => (hit ? 'Hit' : 'Miss');                 // (the result in a word: nothing about the pick)
  const sh = spin && spin.shared ? spin : shared ? l : null;   // the shared spin, playing or as it ended
  const cur = spin || l, curBy = spin ? a.by : l ? l.by : null;   // the result on show: the move playing, else the square's last
  const res = sh ? `<p ${lateAt('rlres', spin ? tEnd : null)}>${num(sh.n)}<span>${['X', 'O'].filter(p => sh.bets[p]).map(p => `${W(p)} ${one(sh.bets[p], sh.hit[p])}`).join(' · ')}</span></p>`
    : pend ? `<p class="rlres"><span>${W(pend.by)} picked ${rlBetText(pend.bet)} · waiting for the spin</span></p>`
    : cur ? `<p ${lateAt('rlres ' + (cur.hit ? 'hit ' + (curBy || '') : 'miss'), spin ? tEnd : null)}>${num(n)}<span>${one(cur.bet, cur.hit)}</span></p>` : '<p class="rlres">&nbsp;</p>';
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
  const pop = !marks && !o.view && dr.pop ? dr.pop : null, popOf = k => (pop && (pop.k === k || (RL.groups[pop.k] && Number.isInteger(k) && rlCovers(pop.k, k))) ? ' pop' : ''), popFx = k => (popOf(k) ? fxAttr(pop.at) : '');   // the pick just made pops, timed from its tap (a group: its button and its numbers)
  // The marker on the number that came up: it moves there from the wheel as the ball lands (rlMarker), and
  // stays on it until the next spin, so a bet that covers it is plain to see.
  const land = k => (spin && spin.n === k ? ' landing' : ''), landT = k => (spin && spin.n === k ? ` style="--t:${tEnd}ms"` : '');
  const dolly = k => (spin && spin.n === k ? `<i class="dolly fly" style="--t:${tEnd}ms" aria-hidden="true"></i>` : !spin && n === k && n != null && !pend ? '<i class="dolly" aria-hidden="true"></i>' : '');
  const grid = ['g1', 'g2', 'g3'].map(g => {
    const [lo, hi] = RL.groups[g], cells = [];
    for (let k = lo; k <= hi; k++) { const c = marks ? mk(k) : on(k) ? ' on' : ''; cells.push(`<button class="rln ${rlRed(k) ? 'r' : 'b'}${c}${n === k && !spin ? ' last' : ''}${land(k)}${c ? popOf(k) : ''}"${landT(k)}${c ? popFx(k) : ''} data-act="rlnum" data-n="${k}" aria-pressed="${!!c}" aria-label="${k}, ${rlRed(k) ? 'red' : 'black'}"${dis}>${k}${dolly(k)}</button>`); }
    return `<div class="rlrow">${cells.join('')}<button class="rlg${gOn(g)}${gOn(g) ? popOf(g) : ''}"${gOn(g) ? popFx(g) : ''} data-act="rlgrp" data-g="${g}" aria-pressed="${!!gOn(g)}" aria-label="Group ${lo} to ${hi}"${dis}>${lo}–${hi}</button></div>`;
  }).join('');
  const bet = dr.bet || (dr.nums.length === RL.pick ? dr.nums : null);
  const say = marks ? ['X', 'O'].filter(p => marks[p]).map(p => `${W(p)}: ${rlBetText(marks[p])}`).join(' · ')
    : dr.bet === 'zero' ? 'Picked green 0'
    : dr.bet ? `Picked the group ${rlBetText(dr.bet)}` : dr.nums.length === RL.pick ? 'Picked your 8 numbers'
    : dr.nums.length ? `${RL.pick - dr.nums.length} more number${RL.pick - dr.nums.length === 1 ? '' : 's'} to pick` : '&nbsp;';
  const board = o.view ? '' : `<div class="rlboard"><div class="rlrow top"><button class="rlz${zOn}${land(0)}${zOn ? popOf('zero') : ''}"${landT(0)}${zOn ? popFx('zero') : ''} data-act="rlzero" aria-pressed="${!!zOn}" aria-label="Green 0"${dis}>0${dolly(0)}</button><p class="rlsay">${say}</p></div>${grid}</div>
    <div class="cbtns one"><button class="big ${turn} rlspin" data-act="move" ${mv(bet || [])}${!bet || o.locked || marks ? ' disabled' : ''}>Spin</button></div>`;
  // Once the ball lands: HIT!, MISS or GREEN 0!, big in its own slot under the wheel (never over it), held a second before the game moves on.
  const anyHit = spin ? (spin.shared ? ['X', 'O'].some(p => spin.hit[p]) : spin.hit) : false;
  const zeroHit = spin ? (spin.shared ? ['X', 'O'].some(p => spin.hit[p] && spin.bets[p] === 'zero') : spin.hit && spin.bet === 'zero') : false;
  const hitter = !spin || !anyHit ? '' : spin.shared ? ['X', 'O'].filter(p => spin.hit[p]).join('') : a.by || '';   // whose hit it is: 'X', 'O', or 'XO' (a shared spin both picked)
  const bigTxt = !spin ? '' : anyHit ? 'Hit' : 'Miss';
  const bigCls = !spin ? '' : zeroHit ? 'zero' : anyHit ? 'hit' + (hitter.length === 1 ? ' ' + hitter : '') : 'miss';
  const big = spin ? `<b ${lateAt('rlbig ' + bigCls, tEnd)} role="status">${bigTxt}</b>` : '';
  // Beside the wheel, under the result: the recent spins, as on the miniature (a hit in the spinner's colour, a miss
  // plain). While a spin plays, the row before it stays; the new one takes its place as the ball lands.
  const chips = list => (list.length ? list.map(x => `<i class="sp ${x.n === 0 ? 'g' : rlRed(x.n) ? 'r' : 'b'}${x.hit ? ' hit ' + (x.by || '') : ''}" title="${x.n}${x.hit ? ': a hit' : ''}">${x.n}</i>`).join('') : '<small>No spins yet</small>');
  const all = (mini.spins || []).map(x => (typeof x === 'number' ? { n: x, hit: false } : x)).filter(x => x && Number.isInteger(x.n)), HIST = 4;
  const spins = spin && !REDUCED ? `<span class="tu" style="--u:${tEnd}ms">${chips(all.slice(0, -1).slice(-HIST))}</span><span class="tf" style="--f:${tEnd}ms">${chips(all.slice(-HIST))}</span>` : `<span>${chips(all.slice(-HIST))}</span>`;
  const hist = `<div class="rlspins" aria-label="Recent spins: ${all.map(x => x.n + (x.hit ? ' (hit)' : '')).join(', ') || 'none'}">${spins}</div>`;
  // The wheel: the picks on it (the move's, a pick waiting for its spin, else this phone's draft as it is put together),
  // the pockets nobody picked dimmed once a pick is whole; the spin from the pocket it rested on (the move's `from`).
  const whole = bt => bt === 'zero' || !!RL.groups[bt] || (Array.isArray(bt) && bt.length === RL.pick);
  const picks = marks || (o.view ? null : dr.bet ? { [turn]: dr.bet } : dr.nums.length ? { [turn]: dr.nums } : null);
  const full = !!picks && ['X', 'O'].some(p => whole(picks[p]));
  const wheel = rlWheel(n, spin ? { n: spin.n, from: spin.from, hit: hitter } : null, picks, full);
  const pc = spin && !spin.shared ? a.by : pend ? pend.by : turn;   // whose picks the board shows (a shared spin: each number in its picker's own, .mX / .mO)
  return `<div class="g-rl pc-${pc === 'O' ? 'O' : 'X'}${full || o.locked ? ' dim' : ''}"><div class="rltop"><div class="ctals col">${hits('X')}${hits('O')}${res}${hist}</div><div class="rlside"><div class="rlwrap">${wheel}</div><div class="rlbigslot">${big}</div></div></div>${board}</div>`;
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
  ], { duration: 480, delay: t, fill: 'both', easing: 'cubic-bezier(.4, 0, .2, 1)' });
}
// A small wheel for the miniature: the pockets in their colours (green zero, then red and black around), the hub,
// the pointer and, once a spin has been made, the ball lying in the pocket under it.
function rlMiniWheel(ball) {
  const n = 12, seg = Array.from({ length: n }, (_, k) => { const a0 = (k - 0.5) / n * Math.PI * 2 - Math.PI / 2, a1 = (k + 0.5) / n * Math.PI * 2 - Math.PI / 2, f = a => `${(50 + 43 * Math.cos(a)).toFixed(1)} ${(50 + 43 * Math.sin(a)).toFixed(1)}`;
    return `<path d="M50 50 L${f(a0)} A43 43 0 0 1 ${f(a1)}Z" fill="${k === 0 ? '#2f8a3c' : k % 2 ? '#d6301e' : '#2b2b2b'}"/>`; }).join('');
  return `<svg class="tmwheel" viewBox="0 -6 100 108" aria-hidden="true"><circle cx="50" cy="50" r="47" fill="#7a4a2a" stroke="var(--ink)" stroke-width="5"/>${seg}<circle cx="50" cy="50" r="20" fill="#a8703f" stroke="var(--ink)" stroke-width="4"/><circle cx="50" cy="50" r="6" fill="#f0e2bd" stroke="var(--ink)" stroke-width="2.5"/>${ball ? '<circle cx="50" cy="18" r="6.5" fill="#fff" stroke="var(--ink)" stroke-width="3"/>' : ''}<path d="M41 -5h18l-9 13z" fill="#f0e2bd" stroke="var(--ink)" stroke-width="3" stroke-linejoin="round"/></svg>`;
}
export function miniature(mini, final) {   // the wheel, each player's hits so far beside it, and the last three spins (their numbers as large as the board's other text): a hit in the spinner's colour, a miss plain
  const spins = (mini.spins || []).map(x => (typeof x === 'number' ? { n: x, hit: false } : x)).filter(x => x && Number.isInteger(x.n)).slice(-3);
  const chip = x => `<i class="sp ${x.n === 0 ? 'g' : rlRed(x.n) ? 'r' : 'b'}${x.hit ? ' hit ' + (x.by || '') : ''}" title="${x.n}${x.hit ? ': a hit' : ''}">${x.n}</i>`;
  return `<div class="tpip rlmini"><div class="rlmrow">${rlMiniWheel(spins.length > 0)}<div class="rlmcol">${['X', 'O'].map(p => `<div class="tr ${p}"><b class="${p}">${p}</b>${Array.from({ length: tune(mini).goal }, (_, k) => `<i class="${k < mini.hits[p] ? 'on' : ''}"></i>`).join('')}</div>`).join('')}</div></div>${spins.length ? `<div class="tspins" aria-label="Recent spins: ${spins.map(x => x.n + (x.hit ? ' (hit)' : '')).join(', ')}">${spins.map(chip).join('')}</div>` : ''}</div>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = rlTable(mini, a, { view, locked, turn, zoom: state.zoom, moved: !!(f || d) }); return g;
}
export function moveText(f, who) {
  if (f.rl && f.rl.pending) return `${who} picked ${rlBetText(f.rl.bet)}`;
  if (f.rl && f.rl.shared) return `${f.rl.n}${f.rl.n === 0 ? ' green' : rlRed(f.rl.n) ? ' red' : ' black'} · ${['X', 'O'].filter(p => f.rl.bets[p]).map(p => `${N(p)} ${f.rl.hit[p] ? 'hit' : 'missed'}`).join(', ')}`;
  return f.rl ? (f.rl.hit ? 'Hit' : 'Miss') : `${who} spun`;
}
export function sounds(f, add, won, mini, last) {
  if (f.rl && f.rl.pending) { add('chips', 0); return; }         // Super Chaos: the bet put down
  add('rlSpin', 0);                                              // the ball clicks over the pockets as each passes under it, slower and slower (rlTicks: the wheel's own turn), the last ones lower
  const ticks = f.rl ? rlTicks(f.rl.n, f.rl.from) : [], nt = ticks.length;
  ticks.forEach((ms, k) => add('ballTick', ms, nt - k <= 3 ? 1 - 0.06 * (4 - (nt - k)) : undefined));
  add('ballDrop', Math.round(RLV.land * (RLT.spin + RLT.settle)));   // into its pocket
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
    if (dr.nums.includes(n)) { dr.nums = dr.nums.filter(k => k !== n); dr.pop = null; }
    else { if (dr.nums.length >= RL.pick) dr.nums.shift(); dr.nums.push(n); dr.pop = { k: n, at: performance.now() }; }   // a ninth number takes the place of the first
  } else {
    const bet = act === 'rlzero' ? 'zero' : el.dataset.g;
    dr.bet = dr.bet === bet ? null : bet; dr.nums = [];
    dr.pop = dr.bet ? { k: bet, at: performance.now() } : null;
  }
  render();
}
// Someone else's bet replayed (ui/replay.js): their numbers, group or 0 go onto the board as theirs did, then Spin.
function replayInput(act, val, r) {
  if (!rlDraft || rlDraft.sq !== r.sq) rlDraft = { sq: r.sq, nums: [], bet: null };
  const dr = rlDraft;
  const now = typeof performance !== 'undefined' ? performance.now() : 0;
  if (act === 'rlnum' && /^n=\d+$/.test(val || '')) { const n = Number(val.slice(2)); if (dr.bet) { dr.bet = null; dr.nums = []; } if (!dr.nums.includes(n)) { if (dr.nums.length >= RL.pick) dr.nums.shift(); dr.nums.push(n); dr.pop = { k: n, at: now }; } }
  else if (act === 'rlgrp' && /^g=g[123]$/.test(val || '')) { dr.bet = val.slice(2); dr.nums = []; dr.pop = { k: dr.bet, at: now }; }
  else if (act === 'rlzero') { dr.bet = 'zero'; dr.nums = []; dr.pop = { k: 'zero', at: now }; }
  return false;
}
const replaySynth = m => (Array.isArray(m) ? m.map((n, k) => [k * 260, 'rlnum', 'n=' + n]).concat([[m.length * 260 + 300, 'move', 'm=' + JSON.stringify(m)]])
  : m === 'zero' ? [[0, 'rlzero'], [700, 'move', 'm="zero"']] : typeof m === 'string' ? [[0, 'rlgrp', 'g=' + m], [700, 'move', 'm=' + JSON.stringify(m)]] : null);
export const replay = { input: replayInput, synth: replaySynth };
// Its own controls (data-act): the page's click handler hands them here.
export const actions = { rlnum: rlnumAct, rlgrp: rlnumAct, rlzero: rlnumAct };

// Setters for the names other modules reassign (an imported name is read-only there).
export function setRlDraft(v) { rlDraft = v; }
