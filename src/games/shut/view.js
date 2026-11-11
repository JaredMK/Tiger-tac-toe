// Shut the Box: the screen, the miniature, the move's words and sounds, and the inputs.
import { SHUT, shutN, shutSum, shutTimes, shutWays } from './rules.js';
import { SND } from '../../audio/sound.js';
import { attemptMove } from '../../net/moves.js';
import { N, REDUCED, mv, state, waitLine, zoomedType } from '../../ui/app.js';
import { dieFace } from '../../ui/art.js';
import { arcTally, lateAt, pips } from '../../ui/progress.js';
import { render } from '../../ui/render.js';
import { markSvgG } from '../../ui/thumbs.js';

// Both boxes on show, one above the other (each player's own tiles, the one on the move lit), the felt with the dice
// between them and the controls below: Roll, then a tap on each tile to flip (they light as picked; the move goes in
// the moment the picked tiles add up to the roll, so a pick never needs a second button). A roll tumbles in from its
// flash and lands; a flip turns its tiles down one after the other. Everything has its room from the start: nothing moves.
let draft = null;                                                  // this phone's pick: { sq, key, sel: [tile numbers] }
const keyOf = (mini, sq) => `${sq}:${mini.roll ? mini.roll.by + mini.rolls[mini.roll.by] : '-'}`;
const picked = (mini, sq) => (draft && draft.sq === sq && draft.key === keyOf(mini, sq) ? draft.sel : []);
function box(mini, p, o, s, sel, mine) {
  const up = mini.up[p], flipNow = s && s.kind === 'flip' && o.by === p ? s.tiles : [];
  const tiles = up.map((u, k) => {
    const n = k + 1, fl = flipNow.indexOf(n), on = sel.includes(n), can = mine && u;
    const t = fl >= 0 && !REDUCED ? shutTimes(s).flipAt(fl) : null;
    const cls = `shtile${u ? ' up' : ' dn'}${fl >= 0 && t != null ? ' flip' : ''}${on ? ' sel' : ''}`;
    return `<button class="${cls}" data-act="shtile" data-v="${n}"${t != null ? ` style="--t:${t}ms"` : ''} aria-label="Tile ${n}${u ? '' : ', down'}"${can ? '' : ' disabled tabindex="-1"'}><span>${n}</span></button>`;
  }).join('');
  return `<div class="shbox ${p}${!o.view && o.turn === p ? ' now' : ''}" style="--n:${up.length}"><svg class="shmk ${p}" viewBox="-10 -10 20 20" aria-label="${p}'s box">${markSvgG(p, 6.5)}</svg><div class="shrow">${tiles}</div></div>`;
}
function shutTable(mini, a, o) {
  const s = a && a.shut ? a.shut : null, by = a ? a.by : null, sq = o.zoom, n = shutN(mini), turn = o.turn;
  const roll = mini.roll, mineRoll = roll && roll.by === turn && !o.view && !o.locked;
  const sel = mineRoll ? picked(mini, sq) : [];
  const tim = shutTimes(s), tEnd = s && !REDUCED ? tim.end - SHUT.hold : 0;
  const down = p => mini.up[p].filter(u => !u).length;
  const tal = p => arcTally(p, o, pips(p, down(p), n, !!(s && s.kind === 'flip' && by === p), tEnd));
  // the dice: the roll of this flash tumbling in, else the roll waiting, else the last one, still
  const d = s ? s.d : roll ? roll.d : mini.last && mini.last.d ? mini.last.d : null, tumble = s && s.kind === 'roll' && !REDUCED;
  const dice = d ? `<div class="cpair${tumble ? ' tumble' : ''}" style="--t:0ms"><div class="cdice">${d.map((v, k) => `<span class="die cdie${k ? ' b' : ''}">${dieFace(v)}</span>`).join('')}</div></div>` : '';
  const W = p => `<b class="${p}">${N(p)}</b>`;
  let line;
  if (s && s.kind === 'roll') line = `<p ${lateAt('arcres ' + (s.none ? 'no' : ''), tumble ? SHUT.land : null)} role="status">${s.none ? `No tiles make ${shutSum(s.d)}` : `Make ${shutSum(s.d)}`}</p>`;
  else if (s && s.kind === 'flip') line = `<p ${lateAt('arcres ok', REDUCED ? null : tEnd)} role="status">Flipped ${s.tiles.join(' + ')}</p>`;
  else if (s && s.kind === 'drop') line = `<p class="arcres no" role="status">Time ran out</p>`;
  else if (roll && !o.view) line = `<p class="arcres">${roll.by === turn ? `Make ${shutSum(roll.d)}${sel.length ? ` · ${shutSum(sel)} so far` : ''}` : waitLine(roll.by)}</p>`;
  else line = `<p class="arcnote">${o.view ? '' : o.locked ? waitLine(turn) : ''}</p>`;
  const can = !o.view && !o.locked && !roll;
  const btn = o.view ? '' : `<div class="cbtns one"><button class="big ${turn}" data-act="move" ${mv('roll')}${can ? '' : ' disabled'}>Roll</button></div>`;
  const tap = p => mineRoll && p === turn;
  return `<div class="g-arc shut"><div class="ctals">${tal('X')}${tal('O')}</div><div class="shbody">${box(mini, 'X', { ...o, by }, s, tap('X') ? sel : [], tap('X'))}<div class="cfelt shfelt">${dice || '<p class="arcnote"></p>'}</div>${box(mini, 'O', { ...o, by }, s, tap('O') ? sel : [], tap('O'))}${line}</div>${btn}</div>`;
}
// The miniature: both boxes drawn as they stand (a wooden tray each, its tiles: an open tile light, a tile down filled in
// the player's colour), each with its owner's drawn mark at the left; the last roll's dice under them.
export function miniature(mini, final) {
  const n = shutN(mini), l = mini.roll || mini.last, d = l && l.d ? l.d : null, W = 100, tw = (W - 22) / n;
  const tray = (p, y) => `<g class="tshb ${p}"><rect class="tshw" x="16" y="${y}" width="${W - 16}" height="22" rx="4"/>${mini.up[p].map((u, k) => `<rect class="tsht${u ? '' : ' on'}" x="${(19 + k * tw).toFixed(2)}" y="${y + 3}" width="${(tw - 2).toFixed(2)}" height="16" rx="2"/>`).join('')}<g transform="translate(7 ${y + 11})">${markSvgG(p, 5.5)}</g></g>`;
  const PIPS = { 1: [[5, 5]], 2: [[3, 3], [7, 7]], 3: [[3, 3], [5, 5], [7, 7]], 4: [[3, 3], [7, 3], [3, 7], [7, 7]], 5: [[3, 3], [7, 3], [5, 5], [3, 7], [7, 7]], 6: [[3, 2.6], [7, 2.6], [3, 5], [7, 5], [3, 7.4], [7, 7.4]] };
  const dice = (d || [0, 0]).map((v, k, a) => { const x = W / 2 - a.length * 7 + k * 14 + 2; return `<g transform="translate(${x} 51)"><rect class="tshd" width="10" height="10" rx="2.2"/>${(PIPS[v] || []).map(([px, py]) => `<circle cx="${px}" cy="${py}" r="1.15"/>`).join('')}</g>`; }).join('');
  const dn = p => mini.up[p].filter(u => !u).length;
  return `<svg class="tshut" viewBox="0 0 ${W} 63" aria-label="Shut the Box: X ${dn('X')}, O ${dn('O')} of ${n} tiles down">${tray('X', 1)}${tray('O', 26)}${dice}</svg>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = shutTable(mini, a, { view, locked, turn, zoom: state.zoom, done: !!d }); return g;
}
export function moveText(f, who) {
  const s = f.shut;
  if (!s) return `${who} rolled`;
  if (s.kind === 'roll') return s.none ? `${who} rolled ${shutSum(s.d)}: no tiles make it` : `${who} rolled ${shutSum(s.d)}`;
  if (s.kind === 'flip') return `${who} flipped ${s.tiles.join(' + ')}`;
  return `${who} ran out of time`;
}
// A roll: the rattle and the dice landing (a buzz), and a slump when no tiles make it; a flip: a wooden click for each
// tile going down (a buzz each, thinned by the haptics), and a sparkle when the box is shut.
export function sounds(f, add, won, mini, last) {
  const s = f.shut;
  if (!s) return;
  if (s.kind === 'roll') { add('rattle', 0); add('thunk', SHUT.land - 60); if (s.none) add('diceLose', SHUT.land + 120); return; }
  if (s.kind === 'flip') { const t = shutTimes(s); s.tiles.forEach((x, k) => add('domClick', t.flipAt(k) + SHUT.flipMs / 2)); if (won) add('sparkle', t.end - SHUT.hold); }
}
// A tile tapped: picked or put back; the pick goes in the moment it adds up to the roll (more than the roll: refused).
function tileAct(el) {
  if (zoomedType() !== 'shut' || state.flash || state.done) return;
  const sq = state.squares[state.zoom], mini = sq && sq.mini;
  if (!mini || !mini.roll || mini.roll.by !== state.turn) return;
  const k = keyOf(mini, state.zoom);
  if (!draft || draft.sq !== state.zoom || draft.key !== k) draft = { sq: state.zoom, key: k, sel: [] };
  const n = Number(el.dataset.v), target = shutSum(mini.roll.d);
  if (!mini.up[state.turn][n - 1]) return;
  if (draft.sel.includes(n)) { draft.sel = draft.sel.filter(x => x !== n); SND.play('deselect'); render(); return; }
  if (shutSum(draft.sel) + n > target) { SND.play('error'); return; }
  draft.sel = draft.sel.concat(n);
  if (shutSum(draft.sel) === target) { const m = draft.sel.slice().sort((x, y) => x - y); draft = null; attemptMove(m); return; }
  SND.play('select'); render();
}
// Someone else's pick replayed (ui/replay.js): their tiles light as they picked them, then the flip.
function replayInput(act, val, r) {
  if (act !== 'shtile' || !/^v=\d$/.test(val || '')) return false;
  const sq = state.squares && state.squares[r.sq], mini = sq && sq.mini;
  if (!mini || !mini.roll) return false;
  const k = keyOf(mini, r.sq);
  if (!draft || draft.sq !== r.sq || draft.key !== k) draft = { sq: r.sq, key: k, sel: [] };
  const n = Number(val.slice(2));
  if (!draft.sel.includes(n)) draft.sel = draft.sel.concat(n);
  SND.play('select');
  return true;
}
// The computer's moves (and a log that did not come): a roll is one press; a flip, its tiles picked one by one.
const replaySynth = m => (Array.isArray(m) ? m.map((n, k) => [k * 300, 'shtile', 'v=' + n]) : null);
export const replay = { input: replayInput, synth: replaySynth };
export const actions = { shtile: tileAct };
// The square's line while the turn is held to it (ui/mini.js): the roll waiting for its tiles, or a flip with "Go again
// on success" on (a new roll to come).
export function heldSub(mini, turn, f) {
  if (f) return '';
  return mini.roll && mini.roll.by === turn ? `<b class="${turn}">${N(turn)}</b> rolled ${shutSum(mini.roll.d)}` : `<b class="${turn}">${N(turn)}</b> flipped · goes again`;
}
