// Dice Combo: the screen, the miniature, the move's words and sounds, and the inputs (November 2026).
import { DIE_MORE } from '../../core/config.js';
import { tune } from '../../core/tune.js';
import { COMBO, COMBO_NAMES, COMBO_SHORT, comboOpen, comboTimes } from './rules.js';
import { N, REDUCED, mv, state, waitLine } from '../../ui/app.js';
import { dieFace } from '../../ui/art.js';
import { arcTally, lateAt, pips } from '../../ui/progress.js';
import { markSvgG } from '../../ui/thumbs.js';
import { render } from '../../ui/render.js';
const COMBO_TUM = 520 + DIE_MORE;   // a die's tumble (styles.css .cmbd.tum, --dur): its face shows as it lands; COMBO.roll holds the result after it

// The table: both players' combo cards side by side (the six combos, each claimed one filled in its player's colour
// with their mark), the five dice under them and Roll. Between rolls a tap on a die holds it (lifted, ringed in the
// mover's colour); Roll rolls the rest. After a roll, the combos on the mover's own card the dice make light up, and a
// tap on one claims it. A roll tumbles the dice not held (from the move's flash: `a.combo`, never the square's last),
// a claim stamps the card's cell. Everything has its own room: the cards, the dice, one result line and the button.
let draft = null;                                                    // this phone's holds between rolls: { sq, by, rolls, held: [0/1 x5] }
const holdsFor = (sq, cur) => {
  if (!cur || !cur.rolls) return [0, 0, 0, 0, 0];
  if (!draft || draft.sq !== sq || draft.by !== cur.by || draft.rolls !== cur.rolls) draft = { sq, by: cur.by, rolls: cur.rolls, held: [0, 0, 0, 0, 0] };
  return draft.held;
};
const markSvg = p => `<svg class="cmbmk ${p}" viewBox="-10 -10 20 20" aria-hidden="true">${markSvgG(p, 6)}</svg>`;
function card(mini, p, o, open, tap, fresh) {
  const mine = mini.claimed[p] || [];
  const cells = COMBO.kinds.map(k => {
    const got = mine.includes(k), can = open.includes(k) && !got, stamp = fresh && fresh.by === p && fresh.combo === k;
    const cls = `cmbc${got ? ' got ' + p : ''}${can ? ' can' : ''}${stamp ? ' stamp' : ''}`;
    const inner = `<span class="cmbn">${COMBO_SHORT[k]}</span>${got ? markSvg(p) : ''}`;
    const label = `${COMBO_NAMES[k]}${got ? ', claimed' : can ? ': claim it' : ''}`;
    return can && tap ? `<button class="${cls}" data-act="move" ${mv('c:' + k)} aria-label="${label}">${inner}</button>`
      : `<span class="${cls}"${stamp ? ` style="--t:${COMBO.claim * 0.1}ms"` : ''} aria-label="${label}">${inner}</span>`;
  }).join('');
  return `<div class="cmbcard ${p}${!o.view && o.turn === p ? ' now' : ''}" aria-label="${p}'s combo card"><span class="cmbwho">${markSvg(p)}</span><div class="cmbgrid">${cells}</div></div>`;   // (the names are in the tallies above: the card carries the mark)
}
function comboTable(mini, a, o) {
  const t = tune(mini), R = Math.max(1, t.rolls | 0), turn = o.turn, f = a && a.combo ? a.combo : null;
  const cur = mini.cur && mini.cur.by === turn ? mini.cur : null;
  const mover = !o.view && !o.locked;
  const held = mover && cur && !f ? holdsFor(o.zoom, cur) : f && f.kind === 'roll' ? f.held : [0, 0, 0, 0, 0];
  // the dice on show: the flash's roll (this move), else the move under way, else the last move's
  const dice = f && f.dice && f.dice.length ? f.dice : cur ? cur.dice : [];
  const tum = f && f.kind === 'roll' && !REDUCED ? f.held : null, tim = comboTimes(f);
  const open = cur && !f ? comboOpen(mini, turn, cur.dice) : f && f.kind === 'roll' && f.open ? (f.by === turn && !f.none ? f.open : []) : [];
  const canHold = mover && cur && cur.rolls && cur.rolls < R && !f;
  const die = i => {
    const v = dice[i], h = held[i] ? ' held ' + turn : '', roll = tum && !tum[i] ? ' tum' : '';
    const face = v ? (roll ? `<span ${lateAt('cmbf', COMBO_TUM)}>${dieFace(v)}</span>` : dieFace(v)) : '';
    const lab = v ? `Die ${i + 1}: ${v}${held[i] ? ', held' : ''}` : `Die ${i + 1}`;
    return canHold ? `<button class="die cmbd${h}" data-act="cmbhold" data-k="${i}" aria-pressed="${!!held[i]}" aria-label="${lab}">${face}</button>`
      : `<span class="die cmbd${h}${roll}${v ? '' : ' blank'}" style="--t:0ms;--dur:${COMBO_TUM}ms" aria-label="${lab}">${face}</span>`;
  };
  const W = p => `<b class="${p}">${N(p)}</b>`;
  const tal = p => arcTally(p, o, pips(p, Math.min(t.goal, mini.claimed[p].length), t.goal, !!(f && f.kind === 'claim' && f.by === p), tim.mark));
  const say = c => (c.kind === 'claim' ? `${W(c.by)} claimed ${COMBO_NAMES[c.combo]}` : c.kind === 'end' ? `${W(c.by)}: nothing claimed` : c.none ? 'No combo: nothing claimed' : '');
  const resTxt = f ? say(f) : '';
  const res = resTxt ? `<p ${lateAt('arcres ' + (f.kind === 'claim' ? 'ok' : 'no'), f.kind === 'roll' ? tim.land : 0)} role="status">${resTxt}</p>`
    : o.view ? '<p class="arcnote"></p>'
    : o.locked ? `<p class="arcnote">${waitLine(turn)}</p>`
    : `<p class="arcnote">${cur ? '' : `${W(turn)} to play`}</p>`;   // (no help text in the game: the lit combos and Roll say it; the roll count is in the header, heldSub)
  const rollsLeft = cur ? R - cur.rolls : R, rollM = !cur || !cur.rolls ? 'roll' : 'roll:' + held.join('');
  const canRoll = mover && !f && rollsLeft > 0 && !(cur && held.every(Boolean));
  const btn = o.view ? '' : `<div class="cbtns one"><button class="big ${turn}" data-act="move" ${mv(rollM)}${canRoll ? '' : ' disabled'}>${cur && cur.rolls ? `Roll again (${rollsLeft} left)` : 'Roll'}</button></div>`;
  const fresh = f && f.kind === 'claim' ? f : null;
  return `<div class="g-arc"><div class="ctals">${tal('X')}${tal('O')}</div><div class="cmb"><div class="cmbcards">${card(mini, 'X', o, turn === 'X' ? open : [], mover && !f, fresh)}${card(mini, 'O', o, turn === 'O' ? open : [], mover && !f, fresh)}</div><div class="cmbdice">${[0, 1, 2, 3, 4].map(die).join('')}</div>${res}</div>${btn}</div>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = comboTable(mini, a, { view, locked: locked || (!!f && !view), turn, zoom: state.zoom, done: !!d }); return g;
}
// A tap on a die between rolls: held or let go (this phone's draft; the Roll button carries the holds).
function holdAct(el) {
  const sq = state.squares && state.squares[state.zoom], m = sq && sq.mini;
  if (!m || m.type !== 'combo' || !m.cur || m.cur.by !== state.turn) return;
  const h = holdsFor(state.zoom, m.cur), k = Number(el.dataset.k);
  if (!(k >= 0 && k < 5)) return;
  h[k] = h[k] ? 0 : 1;
  render();
}
export const actions = { cmbhold: holdAct };
// Someone else's move replayed (ui/replay.js): their holds go on die by die, then the roll or the claim.
function replayInput(act, val, r) {
  if (act !== 'cmbhold' || !/^k=[0-4]$/.test(val || '')) return false;
  const sq = state.squares && state.squares[r.sq], m = sq && sq.mini;
  if (!m || !m.cur) return false;
  const h = holdsFor(r.sq, m.cur), k = Number(val.slice(2)); h[k] = h[k] ? 0 : 1;
  return false;
}
const replaySynth = m => {
  if (typeof m !== 'string' || !/^roll:[01]{5}$/.test(m)) return null;
  const out = []; let t = 0;
  m.slice(5).split('').forEach((h, k) => { if (h === '1') { out.push([t, 'cmbhold', 'k=' + k]); t += 320; } });
  out.push([t + 250, 'move', 'm=' + JSON.stringify(m)]);
  return out;
};
export const replay = { input: replayInput, synth: replaySynth };
// The miniature: each player's combo card as a little 3x2 grid of cells (a claimed one filled in their colour with
// their mark), X's over O's, beside their mark.
export function miniature(mini, final) {
  const goal = tune(mini).goal;
  const row = p => `<div class="tcmbr ${p}">${markSvg(p)}<div class="tcmbg">${COMBO.kinds.map(k => `<i class="${mini.claimed[p].includes(k) ? 'on ' + p : ''}"></i>`).join('')}</div></div>`;
  return `<div class="tcmb" aria-label="Dice Combo: X ${mini.claimed.X.length}, O ${mini.claimed.O.length} of ${goal} combos">${row('X')}${row('O')}</div>`;
}
// The header's line while the move holds the turn (ui/mini.js heldSub): the roll it is on, or a claim that goes again.
export function heldSub(mini, turn, f, a) {
  if (f) return '';
  const R = Math.max(1, tune(mini).rolls | 0), cur = mini.cur && mini.cur.by === turn ? mini.cur : null, W = `<b class="${turn}">${N(turn)}</b>`;
  return cur && cur.rolls ? `${W}: roll ${cur.rolls} of ${R}` : `${W} claimed one · goes again`;
}
export function moveText(f, who) {
  const c = f.combo;
  if (!c) return `${who} rolled`;
  if (c.kind === 'claim') return `${who} claimed ${COMBO_NAMES[c.combo]}`;
  if (c.kind === 'end' || c.none) return `${who} claimed nothing`;
  return `${who} rolled`;
}
// A roll: the rattle and the dice landing; a claim: the stamp and a ding; nothing to claim: a thud.
export function sounds(f, add, won, mini, last) {
  const c = f.combo;
  if (!c) return;
  if (c.kind === 'roll') { add('rattle', 0); add('thunk', COMBO.roll - 200); if (c.none) add('thud', COMBO.roll + 100); return; }
  if (c.kind === 'claim') { add('stamp', 0); add('ding', 200); }
}
