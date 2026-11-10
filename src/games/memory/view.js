// Find the Pair: the screen, the miniature, the move's words and sounds, and the inputs.
import { playMove } from '../../core/board.js';
import { SND } from '../../audio/sound.js';
import { attemptMove, dbPick } from '../../net/moves.js';
import { blocked } from '../../net/room.js';
import { RNG, commit, pickKey, state } from '../../ui/app.js';
import { raceSide } from '../../core/race.js';
import { memoryKnownPairs, memoryLayout } from './rules.js';
import { mark, raceBoards, raceMe, raceThem, raceThumb } from '../../ui/race.js';
import { fxAt, fxAttr, startFx } from '../../ui/fx.js';
import { repTake } from '../../ui/replay.js';
import { playFlash } from '../../ui/turns.js';

const CARD_COLORS = { green: '#5be37a', yellow: '#ffd54a', purple: '#c084fc', orange: '#ff9e4a' };
const SHAPES = {
  circle: '<circle cx="12" cy="12" r="9"/>',
  square: '<rect x="3.5" y="3.5" width="17" height="17" rx="2.5"/>',
  triangle: '<path d="M12 3 21.5 20h-19z"/>',
  diamond: '<path d="M12 2.5 21.5 12 12 21.5 2.5 12z"/>',
};
function shapeSvg(card) { return `<svg viewBox="0 0 24 24" fill="${CARD_COLORS[card.c]}">${SHAPES[card.s]}</svg>`; }
// Race mode (core/race.js, `rv: 2`): each player their own shuffle of the deck (ui/race.js raceBoards): this phone's own
// cards large (they turn back down after a flip: it is a memory game), the other player's smaller under it with every card
// they have turned up face up (their faces are open, their layout is not), their newest two flipping up as they land. A
// card's face comes from the flips (its part's `faces`), the first card picked online (`up`), or here, playing the
// computer, the layout itself. A finished square reviewed shows both layouts.
// A small drawn X or O in the corner of a card its player has turned up (race: both boards), so whose flip it was reads at a glance.
const badge = p => `<span class="mbd ${p}">${mark(p, 6)}</span>`;
const cardsOf = mini => (Array.isArray(mini.cards) && mini.cards.length === 9 ? mini.cards : new Array(9).fill(null));   // (a deck this copy has not got: backs)
const faceIn = (mini, p, i) => { const part = raceSide(mini, p), L = memoryLayout(mini, p); return (part && part.faces && part.faces[i]) || (mini.up && mini.up.i === i && state.turn === p ? mini.up : null) || (L && L[i]) || null; };
const picked = p => (state.pick != null && state.pickSq === state.zoom && state.turn === p ? state.pick : null);
// A race miniature's half: p's nine cards as a little grid: those turned up in their colour, both cards of a pair seen solid.
function memMini(mini, p) {
  const part = raceSide(mini, p), faces = (part && part.faces) || [], key = f => f.s + f.c, cnt = {};
  for (const f of faces) if (f) cnt[key(f)] = (cnt[key(f)] || 0) + 1;
  const tot = Math.max(1, Math.min(3, Number(((mini.tune || {}).pairs)) || 1)), got = Object.values(cnt).filter(v => v >= 2).length;
  const cells = Array.from({ length: 9 }, (_, i) => { const f = faces[i], cls = f ? (cnt[key(f)] >= 2 ? 'pr' : 'sn') : ''; return `<rect class="${cls}" x="${(i % 3) * 11 + 1}" y="${Math.floor(i / 3) * 11 + 1}" width="9" height="9" rx="2"/>`; }).join('');
  const pips = Array.from({ length: tot }, (_, k) => `<circle class="${k < got ? 'on' : ''}" cx="${17 - (tot - 1) * 4 + k * 8}" cy="39" r="2.8"/>`).join('');
  return `<svg class="tmem2 ${p}" viewBox="0 0 34 44" aria-hidden="true">${cells}${pips}</svg>`;
}
// The miniature: the nine cards face down (a drawn back, no "?": too small a figure to read), the winning pair face up;
// a race: each player's cards turned and pairs seen.
export function miniature(mini, final) {
  if (mini.race) return raceThumb(p => memMini(mini, p), 'tmemr2', `Race: ${['X', 'O'].map(p => { const part = raceSide(mini, p); return `${p} ${(part && part.seen ? part.seen.length : 0)} cards seen, ${memoryKnownPairs(part)} pair${memoryKnownPairs(part) === 1 ? '' : 's'}`; }).join(', ')}`);
  const shown = final && mini.winCells ? mini.winCells : [], cards = cardsOf(mini);
  return `<div class="tg g3 tmem">${cards.map((card, i) => (shown.includes(i) && card ? `<i class="up">${shapeSvg(card)}</i>` : '<i></i>')).join('')}</div>`;
}
// Race: the other player's cards, small and read-only: every card they have turned up face up, the newest two flipping in.
function oppCards(mini, p, a, view, sq) {
  const part = raceSide(mini, p), seen = new Set((part && part.seen) || []), fresh = a && a.by === p && a.reveal ? a.reveal : [], pk = picked(p);
  const winner = sq.owner === p && mini.winCells ? mini.winCells : [];
  return `<div class="mopp" role="img" aria-label="${seen.size} cards turned">${Array.from({ length: 9 }, (_, i) => {
    const face = faceIn(mini, p, i), up = (view || seen.has(i) || fresh.includes(i) || pk === i) && face;
    return `<i class="${up ? 'up' : 'dn'}${fresh.includes(i) || pk === i ? ' fl' : ''}${winner.includes(i) ? ' win' : ''}">${up ? shapeSvg(face) + badge(p) : ''}</i>`;
  }).join('')}</div>`;
}
function raceScreen(sq, f, d, mini, view, locked, a, won, fresh) {
  const me = raceMe(), them = raceThem(), mine = a && a.by === me ? a : null, pk = !f && !d ? picked(me) : null;
  const up = new Set();
  if (pk != null) up.add(pk);
  if (mine && mine.reveal) mine.reveal.forEach(k => up.add(k));
  if (view) for (let k = 0; k < 9; k++) up.add(k);
  const flipped = mine && mine.reveal ? mine.reveal : [];
  const back = !f && d && d.by === me && d.reveal && !sq.owner ? d.reveal : [];
  const win = i => sq.owner === me && won(i);
  const grid = `<div class="g-mem pc-${me}">${Array.from({ length: 9 }, (_, i) => {
      const isUp = up.has(i), picking = pk === i, face = faceIn(mini, me, i);
      const cls = `mc ${isUp ? 'up' : 'down'}${picking ? ' pick' : ''}${win(i) ? ' win' : ''}${win(i) && fresh ? ' glow' : ''}${picking || flipped[1] === i ? ' flipup' : ''}${back.includes(i) ? ' flipdown' : ''}`;
      return `<button class="${cls}" data-act="pick" data-i="${i}" aria-label="Card ${i + 1}${isUp ? ', face up' : ''}"${picking ? fxAttr(fxAt('pick', pickKey())) : ''}${locked ? ' disabled' : ''}><span class="in"><span class="bk">?</span><span class="ft">${(isUp || back.includes(i)) && face ? shapeSvg(face) + badge(me) : ''}</span></span></button>`;
    }).join('')}</div>`;
  const tp = raceSide(mini, them), n = (tp && tp.flips) || 0, pr = memoryKnownPairs(tp);
  return raceBoards(`<div class="g-memr2">${grid}</div>`, oppCards(mini, them, a, view, sq), `${n} flip${n === 1 ? '' : 's'}${pr ? ` · ${pr} pair${pr === 1 ? '' : 's'} seen` : ''}`, { cls: 'mrb' });
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  if (mini.race) return raceScreen(sq, f, d, mini, view, locked, a, won, fresh);
  const cards = cardsOf(mini);
  const up = new Set();
  if (state.pick != null && state.pickSq === state.zoom && !f && !d) up.add(state.pick);
  if (f && f.reveal) f.reveal.forEach(k => up.add(k));
  if (view) cards.forEach((_, k) => up.add(k));           // the whole deck, once the square is won
  const flipped = f && f.reveal ? f.reveal : [];
  const back = !f && d && d.reveal && !sq.owner ? d.reveal : [];   // the two cards just seen, turning face down again
  g = `<div class="g-mem">${cards.map((card, i) => {
        const isUp = up.has(i), picking = state.pick === i && state.pickSq === state.zoom && !f && !d;
        const cls = `mc ${isUp ? 'up' : 'down'}${picking ? ' pick' : ''}${won(i) ? ' win' : ''}${won(i) && fresh ? ' glow' : ''}${picking || flipped[1] === i ? ' flipup' : ''}${back.includes(i) ? ' flipdown' : ''}`;
        // a card's face is only in the page while it is (or was just) on show
        return `<button class="${cls}" data-act="pick" data-i="${i}" aria-label="Card ${i + 1}${isUp ? ', face up' : ''}"${picking ? fxAttr(fxAt('pick', pickKey())) : ''}${locked ? ' disabled' : ''}><span class="in"><span class="bk">?</span><span class="ft">${(isUp || back.includes(i)) && card ? shapeSvg(card) : ''}</span></span></button>`;
      }).join('')}</div>`;
  return g;
}
export function moveText(f, who) {
  return 'No match';
}
export function sounds(f, add, won, mini, last) {
  add('flipUp', 0); add(won ? 'pair' : 'nopair', 380); return;
}
export function pickAct(el, e, act) {
  const i = Number(el.dataset.i);
  const first = state.pick != null && state.pickSq === state.zoom ? state.pick : null;
  if (state.online) {                          // the first card is turned up in the room, for both to see; two cards make the move
    if (blocked()) return;
    if (first == null || first === i) dbPick(state.zoom, first === i ? null : i);
    else attemptMove([first, i]);
    return;
  }
  if (first == null) { state.pick = i; state.pickSq = state.zoom; startFx('pick', pickKey()); SND.play('flipUp'); }   // the card turns up: its own event
  else if (first === i) { state.pick = null; state.pickSq = null; }
  else if (!playMove(state, state.zoom, [first, i], RNG, { rep: repTake() }).ok) { state.pick = null; state.pickSq = null; }
  else playFlash();
  commit();
}
// Someone else's move replayed (ui/replay.js): their first card turns up as it did for them; the second is the move.
function replayInput(act, val, r) {
  if (act !== 'pick' || !/^i=\d$/.test(val || '')) return false;
  const i = Number(val.slice(2));
  if (state.pick == null || state.pickSq !== r.sq) { state.pick = i; state.pickSq = r.sq; startFx('pick', pickKey()); SND.play('flipUp'); }
  return true;
}
const replaySynth = m => (Array.isArray(m) && m.length === 2 ? [[0, 'pick', 'i=' + m[0]], [800, 'pick', 'i=' + m[1]]] : null);
export const replay = { input: replayInput, synth: replaySynth };
// Its own controls (data-act): the page's click handler hands them here.
export const actions = { pick: pickAct };
