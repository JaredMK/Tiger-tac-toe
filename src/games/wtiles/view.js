// Word Tiles: the screen, the miniature, the move's words and sounds, and the inputs.
import { WT, WT_CENTRE, WT_PREM, WT_VAL, wtCfg, wtCheck, wtTimes } from './rules.js';
import { SND } from '../../audio/sound.js';
import { N, REDUCED, mv, state, waitLine, zoomedType } from '../../ui/app.js';
import { arcTally, lateAt } from '../../ui/progress.js';
import { render } from '../../ui/render.js';
import { markSvgG } from '../../ui/thumbs.js';
import { mySide } from '../../net/room.js';

// The shared board (v 2: the premium squares tinted and named, the tiles laid so far, each tinted in the colour of whoever
// laid it), this phone's own rack under it (its side alone: online from its side's node, net/room.js; against the computer
// the player's) and the controls: Clear, Swap and Play (with the word's points once it is a word). A tap
// on a rack tile picks it, a tap on an empty square lays it there; a tap on a tile laid this turn takes it back. The
// line between the board and the rack says what the draft makes ("CAT +7", or why it isn't a word yet). A word played
// drops its tiles onto the board one after the other and the score counts on as the last lands; the rack refills.
let draft = null;                                                  // this phone's tiles in hand: { key, sel: rack index | null, put: [[cell, rack index]] }
const keyOf = (mini, sq, p) => `${sq}:${p}:${mini.plays[p]}`;
const draftOf = (mini, sq, p) => (draft && draft.key === keyOf(mini, sq, p) ? draft : null);
const PREM_NAME = { T: 'TW', D: 'DW', t: 'TL', d: 'DL' };
const PREM_LONG = { T: 'triple word', D: 'double word', t: 'triple letter', d: 'double letter' };
const WHY = { line: 'Keep to one row or column', gap: 'No gaps in a word', centre: 'The first word goes through the centre', connect: 'Join your word to the tiles on the board', short: 'Two letters at least', bad: '' };
const tile = (l, cls, extra) => `<span class="wtt${cls ? ' ' + cls : ''}"${extra || ''}><b>${l}</b><i>${WT_VAL[l] || ''}</i></span>`;
function wtTable(mini, a, o) {
  const s = a && a.wt ? a.wt : null, sq = o.zoom, turn = o.turn, c = wtCfg(mini);
  const fp = s ? a.by : turn;                                       // who is playing: the mover, during their move; else the player on the move
  const me = mySide() || turn, rack = mini.rack && Array.isArray(mini.rack[me]) ? mini.rack[me] : null;   // this phone's own rack (the other side's is never here)
  const mine = !o.view && !o.locked && !s && turn === me && !!rack;
  const d = rack && (mine || (o.locked && !s && turn === me)) ? draftOf(mini, sq, me) : null;
  const board = mini.board, own = mini.own || [];
  const put = d ? d.put : [], putAt = new Map(put.map(([cell, k]) => [cell, k])), used = new Set(put.map(([, k]) => k));
  const tim = wtTimes(s), fresh = s && s.kind === 'word' && !REDUCED ? new Map(s.t.map(([cell], k) => [cell, tim.dropAt(k)])) : new Map();
  const cells = board.map((l, i) => {
    const pr = WT_PREM[i], pk = putAt.get(i);
    let inner = '', cls = 'wtc' + (pr !== '.' ? ' p' + (pr === pr.toUpperCase() ? 'w' : 'l') + (pr === 'T' || pr === 't' ? '3' : '2') : '') + (i === WT_CENTRE ? ' ctr' : '');
    if (l) inner = tile(l, (own[i] ? 'o' + own[i] : '') + (fresh.has(i) ? ' drop' : ''), fresh.has(i) ? ` style="--t:${fresh.get(i)}ms"` : '');
    else if (pk != null) { inner = tile(rack[pk], 'dr'); cls += ' hasdr'; }
    else if (pr !== '.') inner = `<em>${PREM_NAME[pr]}</em>`;
    const can = mine && !l && (pk != null || (d && d.sel != null));
    return `<button class="${cls}" data-act="wtc" data-v="${i}" aria-label="Square ${i + 1}${pr !== '.' ? ', ' + PREM_LONG[pr] : ''}${l ? ', ' + l : pk != null ? ', ' + rack[pk] + ' (yours, this turn)' : ''}"${can ? '' : ' disabled tabindex="-1"'}>${inner}</button>`;
  }).join('');
  const rackHtml = Array.from({ length: c.rack }, (_, k) => {
    const l = rack ? rack[k] : null;
    if (!l) return '<span class="wtr none"></span>';
    const on = d && d.sel === k, gone = used.has(k), can = mine && !gone;
    return `<button class="wtr${on ? ' sel' : ''}${gone ? ' used' : ''}" data-act="wtr" data-v="${k}" aria-label="Tile ${l}, ${WT_VAL[l]} point${WT_VAL[l] === 1 ? '' : 's'}"${can ? '' : ' disabled tabindex="-1"'}>${gone ? '' : tile(l)}</button>`;
  }).join('');
  // the draft as it stands, checked
  const t = d ? put.map(([cell, k]) => [cell, rack[k]]) : [];
  const ch = t.length ? wtCheck(board, rack, t, c) : null;
  const W = p => `<b class="${p}">${N(p)}</b>`;
  let line;
  if (s && s.kind === 'word') { const main = s.words[0] ? s.words[0].w : ''; line = `<p ${lateAt('arcres ok', REDUCED ? null : tim.count)} role="status">+${s.pts} · ${main}${s.words.length > 1 ? ` and ${s.words.length - 1} more` : ''}${s.all ? ' · all seven!' : ''}</p>`; }
  else if (s && s.kind === 'swap') line = `<p class="arcres" role="status">${s.stuck ? 'No room for a word: the higher score wins' : `${W(a.by)} swapped tiles`}</p>`;
  else if (mine && ch) line = ch.ok ? `<p class="arcres ok">${ch.words[0].w} +${ch.score}</p>` : `<p class="arcres no">${ch.reason === 'word' ? `${ch.w}: not in the list` : WHY[ch.reason] || ''}</p>`;
  else line = `<p class="arcnote">${o.view ? '' : o.locked && !mine ? waitLine(turn) : ''}</p>`;
  const sc = p => { const moved = s && s.kind === 'word' && a.by === p; return `<span class="wtsc" aria-label="${mini.score[p]} of ${c.target} points">${moved ? `<b class="cnt" data-from="${s.from}" data-delay="${REDUCED ? 0 : tim.count}">${mini.score[p]}</b>` : `<b>${mini.score[p]}</b>`}<small>/${c.target}</small></span>`; };
  const tal = p => arcTally(p, o, sc(p));
  const ok = mine && ch && ch.ok;
  const btns = o.view ? '' : `<div class="cbtns three${mine ? '' : ' hold'}"><button class="big" data-act="wtclr"${mine && put.length ? '' : ' disabled'}>Clear</button><button class="big" data-act="move" ${mv('swap')}${mine && !put.length ? '' : ' disabled'}>Swap</button><button class="big ${turn}" data-act="move" ${mv(ok ? t : null)}${ok ? '' : ' disabled'}>Play${ok ? ` +${ch.score}` : ''}</button></div>`;
  return `<div class="g-arc wt"><div class="ctals">${tal('X')}${tal('O')}</div><div class="wtwho"><svg class="wtmk ${fp}" viewBox="-10 -10 20 20" aria-hidden="true">${markSvgG(fp, 6.5)}</svg><span>${N(fp)}</span></div><div class="wtbw"><div class="wtboard ${fp}">${cells}</div></div>${line}<div class="wtrack">${rackHtml}</div>${btns}</div>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = wtTable(mini, a, { view, locked, turn, zoom: state.zoom, done: !!d }); return g;
}
// The miniature: the shared board as it stands (the tiles laid as blocks tinted by whoever laid them, the premium squares
// faintly tinted), and beside it each player's drawn mark over a bar of their points toward the target.
export function miniature(mini, final) {
  const c = wtCfg(mini), cs = 6.2, bw = cs * 7, own = mini.own || [], board = Array.isArray(mini.board) ? mini.board : [];
  const cells = board.map((l, i) => { const pr = WT_PREM[i], cx = (i % 7) * cs, cy = 1 + Math.floor(i / 7) * cs; return `<rect class="twc${l ? ' on' + (own[i] ? ' o' + own[i] : '') : pr !== '.' ? ' p' + (pr === pr.toUpperCase() ? 'w' : 'l') : ''}" x="${cx.toFixed(1)}" y="${cy.toFixed(1)}" width="${(cs - 0.8).toFixed(1)}" height="${(cs - 0.8).toFixed(1)}" rx="0.9"/>`; }).join('');
  const bar = (p, k) => {
    const f = Math.max(0, Math.min(1, (mini.score ? mini.score[p] : 0) / c.target)), x = bw + 5, y = 4 + k * 21, h = 14;
    return `<g class="twb ${p}"><g transform="translate(${x + 4} ${y + 4})">${markSvgG(p, 4)}</g><rect class="twbar" x="${x + 11}" y="${y}" width="5" height="${h}" rx="2"/><rect class="twfill" x="${x + 11}" y="${(y + h * (1 - f)).toFixed(2)}" width="5" height="${(h * f).toFixed(2)}" rx="2"/></g>`;
  };
  return `<svg class="twt" viewBox="0 0 ${bw + 22} ${bw + 2}" aria-label="Word Tiles: X ${mini.score.X}, O ${mini.score.O} of ${c.target} points"><rect class="twbg" x="-0.9" y="0.1" width="${bw + 1}" height="${bw + 1}" rx="1.6"/>${cells}${bar('X', 0)}${bar('O', 1)}</svg>`;
}
export function moveText(f, who) {
  const s = f.wt;
  if (!s) return `${who} played`;
  if (s.kind === 'swap') return `${who} swapped tiles`;
  return `${who} played ${s.words && s.words[0] ? s.words[0].w : 'a word'} for ${s.pts}`;
}
// A word: a click as each tile drops onto the board (a light buzz each, thinned), a ding as the points count on; a
// swap: the tiles sliding back and out again.
export function sounds(f, add, won, mini, last) {
  const s = f.wt;
  if (!s) return;
  if (s.kind === 'swap') { add('cardSlide', 0); add('cardSlide', 220); return; }
  const t = wtTimes(s);
  s.t.forEach((x, k) => add('domClick', t.dropAt(k) + WT.dropMs - 80));
  add(won ? 'sparkle' : 'ding', t.count);
}
// The rack and the board's taps: pick a tile, lay it, take it back.
function draftHere(mini, sq, p) {
  const k = keyOf(mini, sq, p);
  if (!draft || draft.key !== k) draft = { key: k, sel: null, put: [] };
  return draft;
}
function rackTap(mini, sq, p, k, quiet) {
  const d = draftHere(mini, sq, p);
  if (!mini.rack || !mini.rack[p] || !mini.rack[p][k] || d.put.some(([, j]) => j === k)) return false;
  d.sel = d.sel === k ? null : k;
  if (!quiet) SND.play(d.sel == null ? 'deselect' : 'select');
  return true;
}
function cellTap(mini, sq, p, cell, quiet) {
  const d = draftHere(mini, sq, p);
  if (mini.board[cell]) return false;
  const at = d.put.findIndex(([c]) => c === cell);
  if (at >= 0) { d.put.splice(at, 1); if (!quiet) SND.play('deselect'); return true; }
  if (d.sel == null) { if (!quiet) SND.play('error'); return false; }
  d.put.push([cell, d.sel]); d.sel = null;
  if (!quiet) SND.play('domClick');
  return true;
}
function here() {
  if (zoomedType() !== 'wtiles' || state.flash || state.done) return null;
  const sq = state.squares[state.zoom];
  return sq && sq.mini ? { mini: sq.mini, sq: state.zoom, p: state.turn } : null;
}
export const actions = {
  wtr: el => { const h = here(); if (h && rackTap(h.mini, h.sq, h.p, Number(el.dataset.v))) render(); },
  wtc: el => { const h = here(); if (h && cellTap(h.mini, h.sq, h.p, Number(el.dataset.v))) render(); },
  wtclr: () => { const h = here(); if (!h) return; const d = draftHere(h.mini, h.sq, h.p); d.put = []; d.sel = null; SND.play('deselect'); render(); },
};
// Someone else's word replayed (ui/replay.js): their rack is theirs alone (never on this phone), so their picks and lays
// are not pressed here: the inputs are let pass, and the word plays from the move itself (its tiles dropping onto the
// board one after the other, then the points). The computer's word: no inputs (an empty list), the same.
function replayInput(act, val, r) { return act === 'wtr' || act === 'wtc' || act === 'wtclr' || act === 'move'; }
function replaySynth(m, mini, o) { return []; }
export const replay = { input: replayInput, synth: replaySynth };
