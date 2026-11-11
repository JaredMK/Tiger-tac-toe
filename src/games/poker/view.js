// Poker Hands: the screen, the miniature, the move's words and sounds, and the inputs (November 2026).
import { tune } from '../../core/tune.js';
import { HAND_NAMES, POK, pokSlideAt, pokTimes } from './rules.js';
import { N, mv, state, waitLine } from '../../ui/app.js';
import { SUIT_PATH, pcard } from '../../ui/cards.js';
import { arcTally, lateAt } from '../../ui/progress.js';
import { render } from '../../ui/render.js';
import { pipRows, thumbArt } from '../../ui/thumbs.js';

// The table: both players' totals toward the target at the top, the mover's five cards in a row, one result line and
// one button. Deal slides five cards in; a tap on a card marks it to throw away (it drops a little, dims and is struck
// through in the mover's colour); Draw sends the marked ones away and slides new ones in their places, then the hand's
// name and its points show in the result line and the total counts up. Everything is played from the move's flash
// (`a.poker`), never the square's last; the cards keep their places, so nothing moves when text comes or goes.
let draft = null;                                                    // this phone's marks on the hand dealt: { sq, key, thrown: [0/1 x5] }
const marksFor = (sq, cur) => {
  const key = cur ? cur.by + cur.hand.join('') : '';
  if (!draft || draft.sq !== sq || draft.key !== key) draft = { sq, key, thrown: [0, 0, 0, 0, 0] };
  return draft.thrown;
};
// A total toward the target: pips (up to 12), else the figure; the points a move adds fill in as its hand shows.
function total(p, mini, f, goal, tim) {
  const n = Math.min(goal, mini.score[p]), fresh = f && f.kind === 'draw' && f.by === p, from = fresh ? Math.min(goal, f.from) : n;
  if (goal > 12) return `<span class="pokn" aria-label="${n} of ${goal} points">${fresh && from !== n ? `<b class="cnt" data-from="${from}" data-delay="${tim.say}">${n}</b>` : `<b>${n}</b>`}<small>/${goal}</small></span>`;
  return `<span class="pips" aria-label="${n} of ${goal} points">${Array.from({ length: goal }, (_, k) => `<i ${lateAt(k < n ? 'on' : '', fresh && k >= from && k < n ? tim.say + (k - from) * 70 : null, 'fillin')}></i>`).join('')}</span>`;
}
function pokTable(mini, a, o) {
  const t = tune(mini), goal = t.target, turn = o.turn, f = a && a.poker ? a.poker : null, tim = pokTimes(f);
  const cur = mini.cur && mini.cur.by === turn ? mini.cur : null, mover = !o.view && !o.locked;
  const marks = mover && cur && !f ? marksFor(o.zoom, cur) : f && f.kind === 'draw' ? f.thrown : [0, 0, 0, 0, 0];
  const hand = f && f.hand ? f.hand : cur ? cur.hand : null;
  const canMark = mover && cur && !f;
  const cardAt = k => {
    const c = hand ? hand[k] : null, at = pokSlideAt(f, k), m = marks[k] && !(f && f.kind === 'draw');
    const inner = c ? pcard(c, at != null ? { slide: at } : {}) : pcard(null, { down: true, cls: 'ghost' });
    const cls = `pokc${m ? ' out ' + turn : ''}${f && f.kind === 'draw' && f.thrown[k] ? ' new' : ''}`;
    const lab = c ? `${c}${m ? ', to throw away' : ''}` : 'No card yet';
    return canMark ? `<button class="${cls}" data-act="pokmark" data-k="${k}" aria-pressed="${!!marks[k]}" aria-label="Card ${k + 1}: ${lab}">${inner}</button>`
      : `<span class="${cls}" aria-label="Card ${k + 1}: ${lab}">${inner}</span>`;
  };
  const W = p => `<b class="${p}">${N(p)}</b>`;
  const tal = p => arcTally(p, o, total(p, mini, f, goal, tim));
  const res = f && f.kind === 'draw'
    ? `<p ${lateAt('arcres ' + (f.pts > 0 ? 'ok' : 'no'), tim.say)} role="status">${HAND_NAMES[f.rank]} · ${f.pts > 0 ? `+${f.pts}` : 'no points'}</p>`
    : f ? '<p class="arcnote"></p>'
    : o.view ? '<p class="arcnote"></p>'
    : o.locked ? `<p class="arcnote">${waitLine(turn)}</p>`
    : `<p class="arcnote">${cur ? '' : `${W(turn)} to play`}</p>`;
  const n = marks.reduce((x, y) => x + y, 0), drawM = 'draw:' + marks.join('');
  const btn = o.view ? '' : cur || (f && f.kind === 'deal')
    ? `<div class="cbtns one"><button class="big ${turn}" data-act="move" ${mv(drawM)}${mover && cur && !f ? '' : ' disabled'}>${n ? `Draw ${n}` : 'Keep all'}</button></div>`
    : `<div class="cbtns one"><button class="big ${turn}" data-act="move" ${mv('deal')}${mover && !f ? '' : ' disabled'}>Deal</button></div>`;
  return `<div class="g-arc"><div class="ctals">${tal('X')}${tal('O')}</div><div class="pok"><div class="pokhand ${turn}">${[0, 1, 2, 3, 4].map(cardAt).join('')}</div>${res}</div>${btn}</div>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = pokTable(mini, a, { view, locked: locked || (!!f && !view), turn, zoom: state.zoom, done: !!d }); return g;
}
// A tap on a card of the hand dealt: marked to throw away, or kept again (this phone's draft; Draw carries the marks).
function markAct(el) {
  const sq = state.squares && state.squares[state.zoom], m = sq && sq.mini;
  if (!m || m.type !== 'poker' || !m.cur || m.cur.by !== state.turn) return;
  const k = Number(el.dataset.k);
  if (!(k >= 0 && k < 5)) return;
  const t = marksFor(state.zoom, m.cur); t[k] = t[k] ? 0 : 1;
  render();
}
export const actions = { pokmark: markAct };
// Someone else's move replayed (ui/replay.js): their marks go on card by card, then the draw.
function replayInput(act, val, r) {
  if (act !== 'pokmark' || !/^k=[0-4]$/.test(val || '')) return false;
  const sq = state.squares && state.squares[r.sq], m = sq && sq.mini;
  if (!m || !m.cur) return false;
  const t = marksFor(r.sq, m.cur), k = Number(val.slice(2)); t[k] = t[k] ? 0 : 1;
  return false;
}
const replaySynth = m => {
  if (typeof m !== 'string' || !/^draw:[01]{5}$/.test(m)) return null;
  const out = []; let t = 300;
  m.slice(5).split('').forEach((h, k) => { if (h === '1') { out.push([t, 'pokmark', 'k=' + k]); t += 320; } });
  out.push([t + 250, 'move', 'm=' + JSON.stringify(m)]);
  return out;
};
export const replay = { input: replayInput, synth: replaySynth };
// The miniature: each player's last scored hand as five little cards (each suit drawn in its colour, no figures), X's
// over O's, beside their totals as pips.
export function miniature(mini, final) {
  const goal = tune(mini).target, S = 7 / 24;
  const row = (p, y) => Array.from({ length: 5 }, (_, k) => {
    const c = mini.hands[p] ? mini.hands[p][k] : null, x = k * 12 + 1;
    const suit = c ? `<path class="tpoks${'HD'.includes(c[1]) ? ' red' : ''}" transform="translate(${x + 1.5} ${y + 3.5}) scale(${S})" d="${SUIT_PATH[c[1]]}"/>` : '';
    return `<rect class="tpokc${c ? '' : ' none'}" x="${x}" y="${y}" width="10" height="14" rx="1.6"/>${suit}`;
  }).join('');
  const art = `<svg class="tpok" viewBox="0 0 60 32" aria-hidden="true">${row('X', 0)}${row('O', 17)}</svg>`;
  return thumbArt(art, pipRows({ X: Math.min(goal, mini.score.X), O: Math.min(goal, mini.score.O) }, Math.min(goal, 12)), 'tcol tpokw', `Poker Hands: X ${mini.score.X}, O ${mini.score.O} of ${goal} points`);
}
// The header's line while the move holds the turn (ui/mini.js heldSub): the hand dealt, or a scoring hand that goes again.
export function heldSub(mini, turn, f, a) {
  if (f) return '';
  const cur = mini.cur && mini.cur.by === turn ? mini.cur : null, W = `<b class="${turn}">${N(turn)}</b>`;
  return cur ? `${W}: hand dealt` : `${W} scored · goes again`;
}
export function moveText(f, who) {
  const c = f.poker;
  if (!c || c.kind === 'deal') return `${who} dealt a hand`;
  return c.pts > 0 ? `${who} made ${HAND_NAMES[c.rank].toLowerCase()}: +${c.pts}` : `${who} made nothing`;
}
// A deal: a card slide for each card; a draw: a slide for each new card, then a ding for points or a thud for none.
export function sounds(f, add, won, mini, last) {
  const c = f.poker;
  if (!c) return;
  if (c.kind === 'deal') { for (let k = 0; k < 5; k++) add('cardSlide', k * POK.deal); return; }
  for (let k = 0; k < 5; k++) { const at = pokSlideAt(c, k); if (at != null) add('cardSlide', at); }
  const tim = pokTimes(c);
  add(c.pts > 0 ? 'ding' : 'thud', tim.say);
}
