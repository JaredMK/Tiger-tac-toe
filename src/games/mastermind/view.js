// Codebreaker: the screen, the miniature, the move's words and sounds, and the inputs.
import { MM, mmBestRow, mmCodeOf, mmGuesses } from './rules.js';
import { mv, state, zoomedType } from '../../ui/app.js';
import { raceBoards, raceMe, raceThem, raceThumb } from '../../ui/race.js';
import { tune } from '../../core/tune.js';
import { toon } from '../../ui/art.js';
import { fxAttr } from '../../ui/fx.js';
import { render } from '../../ui/render.js';

// Codebreaker pegs: six colours, each with a symbol of its own (so colour is never the only cue).
const MM_NAMES = ['Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Pink'];
const MM_SYM = [
  '<circle cx="12" cy="12" r="5.6"/>',
  '<rect x="6.6" y="6.6" width="10.8" height="10.8" rx="1"/>',
  '<path d="M12 5.2 18.6 17.6H5.4z" stroke-linejoin="round"/>',
  '<path d="M12 4.6 19.4 12 12 19.4 4.6 12z" stroke-linejoin="round"/>',
  '<path d="m12 4.4 2.2 4.8 5.2.6-3.9 3.5 1.1 5.1L12 15.8l-4.6 2.6 1.1-5.1-3.9-3.5 5.2-.6z" stroke-linejoin="round"/>',
  '<path d="M9.6 4.8h4.8v4.8h4.8v4.8h-4.8v4.8H9.6v-4.8H4.8V9.6h4.8z" stroke-linejoin="round"/>',
];
const mmPeg = (c, cls = '', style = '') => `<i class="peg c${c}${cls ? ' ' + cls : ''}"${style} role="img" aria-label="${MM_NAMES[c]}"><svg viewBox="0 0 24 24" aria-hidden="true">${MM_SYM[c]}</svg></i>`;
// The feedback: solid markers first, then hollow ones, then empty places, always in that order.
const mmMarks = (g, cls = '', fresh = false) => `<span class="mmfb${cls ? ' ' + cls : ''}" role="img" aria-label="${g.solid} solid, ${g.hollow} hollow">${Array.from({ length: MM.pegs }, (_, k) =>
  `<i class="${k < g.solid ? 'sd' : k < g.solid + g.hollow ? 'hw' : ''}${fresh ? ' rv' : ''}"${fresh ? ` style="--k:${k}"` : ''}></i>`).join('')}</span>`;
export let mmDraft = null;                                              // Codebreaker: { sq, slots, at } the guess being put together on this phone
let mmPop = null;
// Race mode (core/race.js, `rv: 2`): this phone's own code, guesses and controls large; the other player's code
// (hidden until the square ends) and their latest rows, pegs and markers, small under it (ui/race.js raceBoards),
// live: their new row pops in there from the move's flash. A finished square reviewed: both codes open.
const OPP_ROWS = 3;                                                     // the other player's rows on show (their newest), under their code
function mmOppBoard(mini, o, end, a) {
  const gs = mmGuesses(mini, o), shown = gs.slice(-OPP_ROWS), code = mmCodeOf(mini, o), live = !!(a && a.by === o);
  const codeRow = `<div class="mmor mmocode${end ? ' cracked' : ''}">${Array.from({ length: MM.pegs }, (_, k) => (end && code ? mmPeg(code[k]) : '<i class="peg hid" aria-label="Hidden">?</i>')).join('')}</div>`;
  const rows = shown.map((g, r) => { const nw = live && r === shown.length - 1; return `<div class="mmor${nw ? ' fresh' : ''}">${g.code.map((c, k) => mmPeg(c, nw ? 'in' : '', nw ? ` style="--k:${k}"` : '')).join('')}${mmMarks(g, '', nw)}</div>`; }).join('');
  const blanks = '<div class="mmor none"></div>'.repeat(OPP_ROWS - shown.length);
  return `<div class="mmopp" aria-label="${gs.length} guess${gs.length === 1 ? '' : 'es'}">${codeRow}${rows}${blanks}</div>`;
}
// A race miniature: each player's best row so far as its markers (solid, hollow, open), a 2x2 block in their colour's frame.
const mmBestArt = (mini, p) => {
  const b = mmBestRow(mmGuesses(mini, p)) || { solid: 0, hollow: 0 };
  const dots = [[11, 11], [29, 11], [11, 29], [29, 29]].map(([x, y], k) => `<circle class="${k < b.solid ? 'sd' : k < b.solid + b.hollow ? 'hw' : 'no'}" cx="${x}" cy="${y}" r="6.4"/>`).join('');
  return `<svg class="mmbest ${p}${b.solid === MM.pegs ? ' done' : ''}" viewBox="0 0 40 40" aria-hidden="true"><rect class="fr" x="1.5" y="1.5" width="37" height="37" rx="9"/>${dots}</svg>`;
};
export function miniature(mini, final) {
  if (mini.race) return raceThumb(p => mmBestArt(mini, p), 'tmmr', `Race: ${['X', 'O'].map(p => { const b = mmBestRow(mmGuesses(mini, p)) || { solid: 0, hollow: 0 }; return `${p} best ${b.solid} solid ${b.hollow} hollow`; }).join(', ')}`);
  const all = mini.guesses || [], last = all.slice(-4), more = all.length - last.length;
  const rows = last.length ? last.map(g => `<div class="tmr">${g.code.map(c => `<i class="c${c}"></i>`).join('')}${mmMarks(g, 'tiny')}</div>`).join('')
    : `<div class="tmr">${'<i></i>'.repeat(4)}</div><div class="tmr">${'<i></i>'.repeat(4)}</div>`;
  return `<div class="tmm">${rows}${more > 0 ? `<small>+${more} earlier</small>` : ''}</div>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, _won, wk, fresh, turn, g) {
  // The hidden code under its shells (open once cracked, or when looking back), every guess with its
  // markers, then the guess being made: tap a slot, then a colour; tap a filled slot to clear it.
  const won = !!sq.owner || (a && (a.kind === 'claim' || a.kind === 'match'));
  const open = view || (fresh && a);
  const race = !!mini.race, me = race ? raceMe() : null, end = race && (!!sq.owner || !!view);
  const mine = !race || (a && a.by === me);                           // (a race: the move to animate on this board is this phone's own; theirs lands on their board)
  const guesses = race ? mmGuesses(mini, me) : mini.guesses || [];   // (a race: this side's own)
  const n = guesses.length, myCode = race ? mmCodeOf(mini, me) : mini.code;
  const code = Array.from({ length: MM.pegs }, (_, k) => (race ? end : open) && myCode
    ? `<span class="shell open${fresh && sq.owner === (race ? me : sq.owner) ? ' flip' : ''}" style="--k:${k}">${mmPeg(myCode[k])}</span>`
    : `<span class="shell"><i class="peg hid" aria-label="Hidden">?</i></span>`).join('');
  const rows = guesses.map((gs, r) => {
    const last = a && mine && r === n - 1;
    return `<div class="mmrow${last ? ' fresh' : ''}"><span class="mmby ${gs.by}">${toon(gs.by)}</span>${gs.code.map((c, k) => mmPeg(c, last ? 'in' : '', last ? ` style="--k:${k}"` : '')).join('')}${mmMarks(gs, '', last)}</div>`;
  }).join('');
  if (!mmDraft || mmDraft.sq !== state.zoom || view || f || d) mmDraft = { sq: state.zoom, slots: [null, null, null, null], at: 0 };
  const dr = mmDraft.slots, full = dr.every(c => c != null);
  const pop = mmPop && mmPop.sq === state.zoom && performance.now() - mmPop.at < 300 ? mmPop.k : -1;
  const slots = dr.map((c, k) => `<button class="mmslot${k === mmDraft.at && !locked ? ' at' : ''}" data-act="mmslot" data-k="${k}" aria-label="Slot ${k + 1}${c != null ? ', ' + MM_NAMES[c] + ' (tap to clear)' : ', empty'}"${k === pop ? fxAttr(mmPop.at) : ''}${locked ? ' disabled' : ''}>${c != null ? mmPeg(c, k === pop ? 'pop' : '') : ''}</button>`).join('');
  const nc = tune(mini).colors;                                       // (the colours this square was dealt with: TUNE)
  const pal = Array.from({ length: nc }, (_, c) => `<button class="mmcol c${c}" data-act="mmcol" data-c="${c}" aria-label="${MM_NAMES[c]}"${locked || dr.includes(c) ? ' disabled' : ''}>${mmPeg(c)}</button>`).join('');
  const cracked = race ? sq.owner === me : won;
  g = `<div class="g-mm${race ? ' mmr2' : ''}"><div class="mmcode small${cracked ? ' cracked' : ''}" aria-label="${race ? 'Your hidden code' : 'The hidden code'}">${code}</div>
        <div class="mmlist" id="mmlist">${rows || `<div class="empty">${view ? 'No guesses were made.' : 'No guesses yet'}</div>`}</div>
        ${view ? '' : `<div class="mmcur" aria-label="Your guess">${slots}</div><div class="mmpal"${nc !== MM.colors ? ` style="grid-template-columns: repeat(${nc}, calc((100% - 20px) / 6)); justify-content: center"` : ''}>${pal}</div>
        <button class="big mmgo" data-act="move" ${mv(full ? dr : [])}${!full || locked ? ' disabled' : ''}>Submit guess</button>`}</div>`;
  if (race) {
    const them = raceThem(), tn = mmGuesses(mini, them).length;
    return raceBoards(g, mmOppBoard(mini, them, end, a), `${tn} guess${tn === 1 ? '' : 'es'}`, { cls: 'mmrb' });
  }
  return g;
}
const marksOf = f => (f.solid !== undefined ? f : f.race && f.race.solid !== undefined ? f.race : { solid: 0, hollow: 0 });   // (f.race: a race square from before the rework, its guess redacted)
export function moveText(f, who) {
  const m = marksOf(f); return `${who}: ${m.solid} solid · ${m.hollow} hollow`;
}
export function sounds(f, add, won, mini, last) {
  const m = marksOf(f), n = (m.solid || 0) + (m.hollow || 0); for (let k = 0; k < n; k++) add('marker', 450 + k * 250); if (won) add('reveal', 1450); return;
}
// Codebreaker: pick a slot; a filled one is cleared
export function mmslotAct(el, e, act) {
  if (zoomedType() !== 'mastermind' || !mmDraft) return;
  const k = Number(el.dataset.k);
  if (mmDraft.slots[k] != null) mmDraft.slots[k] = null;
  mmDraft.at = k;
  render();
}
// ...then a colour goes into it, and the next empty slot is picked
export function mmcolAct(el, e, act) {
  if (zoomedType() !== 'mastermind' || !mmDraft) return;
  const c = Number(el.dataset.c);
  if (mmDraft.slots.includes(c)) return;
  const k = mmDraft.slots[mmDraft.at] == null ? mmDraft.at : mmDraft.slots.indexOf(null);
  if (k < 0) return;
  mmDraft.slots[k] = c; mmPop = { sq: state.zoom, k, at: performance.now() };
  const nxt = mmDraft.slots.findIndex((x, j) => x == null && j > k);
  mmDraft.at = nxt >= 0 ? nxt : Math.max(0, mmDraft.slots.indexOf(null));
  render();
}
// Someone else's guess replayed (ui/replay.js): the pegs go into the slots as theirs did, then Submit.
function replayInput(act, val, r) {
  if (!mmDraft || mmDraft.sq !== r.sq) mmDraft = { sq: r.sq, slots: [null, null, null, null], at: 0 };
  if (act === 'mmcol' && /^c=\d$/.test(val || '')) {
    const c = Number(val.slice(2)), k = mmDraft.slots[mmDraft.at] == null ? mmDraft.at : mmDraft.slots.indexOf(null);
    if (k >= 0 && !mmDraft.slots.includes(c)) { mmDraft.slots[k] = c; mmPop = { sq: r.sq, k, at: performance.now() }; const nxt = mmDraft.slots.findIndex((x, j) => x == null && j > k); mmDraft.at = nxt >= 0 ? nxt : Math.max(0, mmDraft.slots.indexOf(null)); }
  } else if (act === 'mmslot' && /^k=\d$/.test(val || '')) { const k = Number(val.slice(2)); if (mmDraft.slots[k] != null) mmDraft.slots[k] = null; mmDraft.at = k; }
  return false;
}
const replaySynth = m => (Array.isArray(m) && m.length === MM.pegs ? m.map((c, k) => [k * 380, 'mmcol', 'c=' + c]).concat([[MM.pegs * 380 + 250, 'move', 'm=' + JSON.stringify(m)]]) : null);
export const replay = { input: replayInput, synth: replaySynth };
// Its own controls (data-act): the page's click handler hands them here.
export const actions = { mmslot: mmslotAct, mmcol: mmcolAct };

// Setters for the names other modules reassign (an imported name is read-only there).
export function setMmDraft(v) { mmDraft = v; }
