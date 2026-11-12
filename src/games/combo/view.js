// Dice Combo: the screen, the miniature, the move's words and sounds, and the inputs (November 2026).
import { tune } from '../../core/tune.js';
import { COMBO, COMBO_NAMES, COMBO_SHORT, comboCounts, comboOpen, comboTimes } from './rules.js';
import { N, mv, state, waitLine } from '../../ui/app.js';
import { DIE_BOUNCE, die3d } from '../../ui/dice.js';
import { arcTally, lateAt, pips } from '../../ui/progress.js';
import { markSvgG } from '../../ui/thumbs.js';
import { render } from '../../ui/render.js';

// The table: both players' combo cards side by side (a band in the player's colour with their mark, then the six
// combos, each a little picture of its dice over its name; a claimed one filled in its player's colour and stamped
// with their mark, the newest one ringed), the tray where the five dice are thrown (the shared 3-D die, ui/dice.js),
// one result line and Roll. Between rolls a tap on a die holds it (lifted onto a pad in the mover's colour); Roll
// throws the rest in, landing one after the other. As the last die lands the combos on the mover's own card that the
// dice make light up, and a tap on one claims it: the dice that make it are ringed in gold and hop, the mover's mark
// stamps onto the cell and the tally's pip fills as it hits. A last roll that makes nothing greys the dice. The
// square won: the winner's card hops. Everything is timed from the move (rules.js comboTimes; `a.combo`, the move's
// own flash, never the square's last) and has its room from the start: nothing moves when a line or a die comes.
// (Reduced motion: the stylesheet plays none of it, each thing shown as it ends up.)
let draft = null;                                                    // this phone's holds between rolls: { sq, by, rolls, held: [0/1 x5] }
const holdsFor = (sq, cur) => {
  if (!cur || !cur.rolls) return [0, 0, 0, 0, 0];
  if (!draft || draft.sq !== sq || draft.by !== cur.by || draft.rolls !== cur.rolls) draft = { sq, by: cur.by, rolls: cur.rolls, held: [0, 0, 0, 0, 0] };
  return draft.held;
};
const markSvg = p => `<svg class="cmbmk ${p}" viewBox="-10 -10 20 20" aria-hidden="true">${markSvgG(p, 6)}</svg>`;
// A combo's picture: five little dice in a row: the ones alike filled (a full house's pair in a second colour), a
// straight's climbing as steps; the dice it does not need left faint.
function comboPic(k) {
  const sq = (i, y, cls) => `<rect class="${cls}" x="${1 + i * 10}" y="${y}" width="8" height="8" rx="2.2"/>`;
  let s = '';
  for (let i = 0; i < 5; i++) {
    if (k === 'fh') s += sq(i, 3, i < 3 ? 'a' : 'b');
    else if (k === 'ss' || k === 'ls') s += sq(i, 6 - i * 1.5, i < (k === 'ss' ? 4 : 5) ? 'a' : 'e');
    else s += sq(i, 3, i < Number(k[0]) ? 'a' : 'e');
  }
  return `<svg class="cmbpic" viewBox="0 0 50 14" aria-hidden="true">${s}</svg>`;
}
// The dice (their places, 0 to 4) that make a combo: the ones alike, a small straight's four, all five of the rest.
export function comboDice(dice, kind) {
  if (!dice || dice.length !== 5) return [];
  const c = comboCounts(dice), at = v => dice.map((d, i) => (d === v ? i : -1)).filter(i => i >= 0);
  const alike = n => { for (let v = 6; v >= 1; v--) if (c[v] >= n) return at(v).slice(0, n); return []; };
  if (kind === '3k' || kind === '4k' || kind === '5k') return alike(Number(kind[0]));
  if (kind === 'ss') { for (const lo of [3, 2, 1]) if ([0, 1, 2, 3].every(j => c[lo + j])) return [0, 1, 2, 3].map(j => dice.indexOf(lo + j)).sort(); return []; }
  return [0, 1, 2, 3, 4];
}
// When die i of a roll lands (ms into the move): the last one thrown at COMBO.land, each one before it a little sooner.
export const comboLand = (i, held) => { const thrown = [0, 1, 2, 3, 4].filter(j => !held[j]), k = thrown.indexOf(i); return k < 0 ? 0 : COMBO.land - (thrown.length - 1 - k) * COMBO.stag; };
function card(mini, p, o, open, tap, f, tim) {
  const mine = mini.claimed[p] || [], newest = mine[mine.length - 1];
  const stampNow = f && f.kind === 'claim' && f.by === p ? f.combo : null;
  const litAt = f && f.kind === 'roll' ? COMBO.land + 40 : null;      // (a roll playing: the combos it makes light up as its last die lands, never before)
  const cells = COMBO.kinds.map(k => {
    const got = mine.includes(k), can = open.includes(k) && !got, stamp = stampNow === k;
    const cls = `cmbc${got ? ' got ' + p : ''}${got && k === newest ? ' new' : ''}${can ? ' can' : ''}${can && litAt != null ? ' soon' : ''}${stamp ? ' stamp' : ''}`;
    const inner = `${comboPic(k)}<span class="cmbn">${COMBO_SHORT[k]}</span>${got ? markSvg(p) : ''}`;
    const label = `${COMBO_NAMES[k]}${got ? ', claimed' : can ? ': claim it' : ''}`;
    const st = stamp ? ` style="--t:${tim.mark}ms"` : can && litAt != null ? ` style="--t:${litAt}ms"` : '';
    return can && tap ? `<button class="${cls}" data-act="move" ${mv('c:' + k)} aria-label="${label}">${inner}</button>`
      : `<span class="${cls}"${st} aria-label="${label}">${inner}</span>`;
  }).join('');
  const cheer = o.won && stampNow;                                   // (the square won: the card hops once its last stamp is down)
  return `<div class="cmbcard ${p}${!o.view && o.turn === p ? ' now' : ''}${cheer ? ' cheer' : ''}"${cheer ? ` style="--tw:${tim.hit + 180}ms"` : ''} aria-label="${p}'s combo card"><span class="cmbwho">${markSvg(p)}</span><div class="cmbgrid">${cells}</div></div>`;   // (the names are in the tallies above: the card carries the mark)
}
function comboTable(mini, a, o) {
  const t = tune(mini), R = Math.max(1, t.rolls | 0), turn = o.turn, f = a && a.combo ? a.combo : null;
  const kept = !f && o.done && o.done.type === 'combo' && o.done.combo ? o.done.combo : null;   // the move made here, still on show
  const cur = mini.cur && mini.cur.by === turn ? mini.cur : null;
  const mover = !o.view && !o.locked;
  const held = mover && cur && !f ? holdsFor(o.zoom, cur) : f && f.kind === 'roll' ? f.held : [0, 0, 0, 0, 0];
  // the dice on show: the flash's (this move), else the move under way, else the move just made here (or, looking at a finished square, its last)
  const seen = f || kept || (o.view && mini.last && mini.last.dice ? mini.last : null);
  const dice = seen && seen.dice && seen.dice.length ? seen.dice : cur ? cur.dice : null;
  const tim = comboTimes(f), rolling = !!(f && f.kind === 'roll');
  const open = cur && !f ? comboOpen(mini, turn, cur.dice) : rolling && f.open ? (f.by === turn && !f.none ? f.open : []) : [];
  const canHold = mover && cur && cur.rolls && cur.rolls < R && !f;
  const made = seen && seen.kind === 'claim' && !cur ? comboDice(seen.dice, seen.combo) : [];   // the dice that made the combo just claimed
  const dull = !!(seen && !cur && (seen.none || seen.kind === 'end'));                           // a move that ended with nothing: its dice greyed
  const pc = f ? f.by : turn;
  const die = i => {
    const v = dice ? dice[i] : null, cls = ['cmbd'], st = [];
    if (held[i]) cls.push('held');
    if (made.includes(i)) { cls.push('mk'); if (f) { cls.push('late'); st.push(`--t:${made.indexOf(i) * 45}ms`); } }
    if (dull && v) { cls.push('dull'); if (f) { cls.push('late'); st.push(`--t:${tim.land}ms`); } }
    const body = die3d(v, { roll: rolling && !held[i] ? comboLand(i, held) : 0, v: i });
    const lab = v ? `Die ${i + 1}: ${v}${held[i] ? ', held' : ''}` : `Die ${i + 1}`;
    return canHold ? `<button class="${cls.join(' ')}" data-act="cmbhold" data-k="${i}" aria-pressed="${!!held[i]}" aria-label="${lab}">${body}</button>`
      : `<span class="${cls.join(' ')}"${st.length ? ` style="${st.join(';')}"` : ''} role="img" aria-label="${lab}">${body}</span>`;
  };
  const W = p => `<b class="${p}">${N(p)}</b>`;
  const tal = p => arcTally(p, o, pips(p, Math.min(t.goal, mini.claimed[p].length), t.goal, !!(f && f.kind === 'claim' && f.by === p), tim.hit));
  const say = c => (c.kind === 'claim' ? `${W(c.by)} claimed ${COMBO_NAMES[c.combo]}` : c.kind === 'end' ? `${W(c.by)}: nothing claimed` : c.none ? 'No combo: nothing claimed' : '');
  const resTxt = f ? say(f) : '';
  const res = resTxt ? `<p ${lateAt('arcres ' + (f.kind === 'claim' ? 'ok' : 'no'), f.kind === 'roll' ? tim.land : f.kind === 'claim' ? tim.hit : 0)} role="status">${resTxt}</p>`
    : o.view ? '<p class="arcnote"></p>'
    : o.locked ? `<p class="arcnote">${waitLine(turn)}</p>`
    : `<p class="arcnote">${cur ? '' : `${W(turn)} to play`}</p>`;   // (no help text in the game: the lit combos and Roll say it; the roll count is in the header, heldSub)
  const rollsLeft = cur ? R - cur.rolls : R, rollM = !cur || !cur.rolls ? 'roll' : 'roll:' + held.join('');
  const canRoll = mover && !f && rollsLeft > 0 && !(cur && held.every(Boolean));
  const btn = o.view ? '' : `<div class="cbtns one"><button class="big ${turn}" data-act="move" ${mv(rollM)}${canRoll ? '' : ' disabled'}>${cur && cur.rolls ? `Roll again (${rollsLeft} left)` : 'Roll'}</button></div>`;
  const tray = `<div class="cmbtray${dice ? '' : ' idle'}${canHold ? ' pick' : ''}" aria-label="The dice"><div class="cmbdice">${[0, 1, 2, 3, 4].map(die).join('')}</div></div>`;
  const C = p => card(mini, p, o, turn === p ? open : [], mover && !f, f, tim);
  return `<div class="g-arc g-cmb pc-${pc}"><div class="ctals">${tal('X')}${tal('O')}</div><div class="cmb"><div class="cmbcards">${C('X')}${C('O')}</div>${tray}${res}</div>${btn}</div>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = comboTable(mini, a, { view, locked: locked || (!!f && !view), turn, zoom: state.zoom, done: a ? null : d, won: !!fresh }); return g;
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
// The miniature: five little dice over the two combo cards (each a band in its player's colour with their mark and
// its six cells, a claimed one filled in their colour), X's on the left, O's on the right.
const MINI_PIPS = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };
export function miniature(mini, final) {
  const goal = tune(mini).goal;
  const shown = mini.cur && mini.cur.dice && mini.cur.dice.length === 5 ? mini.cur.dice : [1, 2, 3, 4, 5];   // (the dice of the move under way; else a row of dice as the game's picture)
  const dice = shown.map((v, i) => { const x = 12 + i * 19; return `<rect class="tcmbd" x="${x - 7}" y="2" width="14" height="14" rx="3.4"/>${(MINI_PIPS[v] || []).map(([dx, dy]) => `<circle class="tcmbp" cx="${x + dx * 3.6}" cy="${9 + dy * 3.6}" r="1.45"/>`).join('')}`; }).join('');
  const cardOf = (p, x) => {
    const cells = COMBO.kinds.map((k, i) => `<rect class="tcmbc${mini.claimed[p].includes(k) ? ' on' : ''}" x="${x + 3.5 + (i % 3) * 13.4}" y="${39 + Math.floor(i / 3) * 12.5}" width="10.6" height="9.6" rx="2"/>`).join('');
    return `<g class="tcmbk ${p}"><rect class="tcmbb" x="${x}" y="22" width="45" height="44" rx="5"/><path class="tcmbh" d="M${x} 36V27a5 5 0 0 1 5-5h35a5 5 0 0 1 5 5v9z"/><g transform="translate(${x + 22.5} 29)">${markSvgG(p, 4.3)}</g>${cells}</g>`;
  };
  return `<div class="tcmb" aria-label="Dice Combo: X ${mini.claimed.X.length}, O ${mini.claimed.O.length} of ${goal} combos"><svg viewBox="0 0 100 68" aria-hidden="true">${dice}${cardOf('X', 2)}${cardOf('O', 53)}</svg></div>`;
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
// A roll: the rattle, a light click as the first die touches down and one part way, the thunk of the last (a thud for a
// last roll that makes nothing); a claim: the stamp as the mark hits the card and a ding with the tally's pip.
export function sounds(f, add, won, mini, last) {
  const c = f.combo;
  if (!c) return;
  if (c.kind === 'roll') {
    const thrown = [0, 1, 2, 3, 4].filter(i => !c.held[i]);
    add('rattle', 0);
    add('diceTap', Math.round(comboLand(thrown[0], c.held) * DIE_BOUNCE));
    if (thrown.length > 2) add('diceTap', comboLand(thrown[Math.floor(thrown.length / 2) - 1], c.held));
    add('thunk', COMBO.land);
    if (c.none) add('thud', COMBO.roll + 100);
    return;
  }
  if (c.kind === 'claim') { const t = comboTimes(c); add('stamp', t.hit - 30); add('ding', t.hit + 120); }
}
