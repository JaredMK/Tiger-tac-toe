// Word Tiles: the screen, the miniature, the move's words and sounds, and the inputs.
import { WT, WT_CENTRE, WT_PREM, WT_VAL, wtCfg, wtCheck, wtTimes } from './rules.js';
import { SND } from '../../audio/sound.js';
import { N, REDUCED, mv, state, waitLine, zoomedType } from '../../ui/app.js';
import { cfAnchor, cfFrom } from '../../ui/cardfly.js';
import { fxAttr } from '../../ui/fx.js';
import { arcTally, lateAt } from '../../ui/progress.js';
import { render } from '../../ui/render.js';
import { markSvgG } from '../../ui/thumbs.js';
import { mySide } from '../../net/room.js';

// The shared board (v 2: the premium squares tinted and named, the tiles laid so far, each in the colour of whoever
// laid it, the last word played ringed), the reserved line and the bag (its count) under it, this phone's own rack (its
// side alone: online from its side's node, net/room.js; against the computer the player's) and the controls: Clear, Swap
// and Play (with the word's points once it is a word). A tap on a rack tile lifts it, a tap on an empty square flies it
// there; a tap on a tile laid this turn flies it back. The line says what the draft makes ("CAT +7", or why it isn't a
// word yet) and a chip on the word's last tile carries its points.
// A word played (rules.js wtTimes): this phone's own tiles are stamped down where they lie, one after the other (anyone
// else's fly in from their score, as many and as timed); then each word it made is counted in turn (ringed on the board,
// named with its points in the line, the score counting on; the winning word's ring stays, in gold); then the rack's new tiles fly in from the bag (the other
// side's as blank tiles to their score: their letters are theirs). A swap: the rack's tiles fly into the bag one after
// the other and the new ones fly back.
let draft = null;                                                  // this phone's tiles in hand: { key, sel: rack index | null, put: [[cell, rack index]] }
let pop = null;                                                    // the draft's last tap, for its motion: { key, at, lay: cell | null, back: { rack index: cell } | null, sel: rack index | null }
let shown = null;                                                  // this phone's own rack as last drawn before a move: { key, rack } (a swap's tiles fly from it, the tiles kept close up)
const POP_MS = 420;
const keyOf = (mini, sq, p) => `${sq}:${p}:${mini.plays[p]}`;
const draftOf = (mini, sq, p) => (draft && draft.key === keyOf(mini, sq, p) ? draft : null);
const popOf = key => (pop && pop.key === key && performance.now() - pop.at < POP_MS ? pop : null);
const PREM_NAME = { T: 'TW', D: 'DW', t: 'TL', d: 'DL' };
const PREM_LONG = { T: 'triple word', D: 'double word', t: 'triple letter', d: 'double letter' };
const WHY = { line: 'Keep to one row or column', gap: 'No gaps in a word', centre: 'The first word goes through the centre', connect: 'Join your word to the tiles on the board', short: 'Two letters at least', bad: '' };
const STAR = '<svg class="wtstar" viewBox="-10 -10 20 20" aria-hidden="true"><path d="M0 -8 L2.3 -2.6 L8 -2.4 L3.6 1.2 L5.2 7 L0 3.8 L-5.2 7 L-3.6 1.2 L-8 -2.4 L-2.3 -2.6 Z"/></svg>';
const BAG = '<svg viewBox="0 0 40 36" aria-hidden="true"><path class="wtbg1" d="M9 12 C3 18 2 27 6 31 C9 34 31 34 34 31 C38 27 37 18 31 12 Z"/><path class="wtbg2" d="M10 12 L7.5 5.5 C12 7.5 16 4 20 6 C24 4 28 7.5 32.5 5.5 L30 12 Z"/><path class="wtbg3" d="M8.5 12 H31.5"/></svg>';
const tile = (l, cls, extra) => `<span class="wtt${cls ? ' ' + cls : ''}"${extra || ''}><b>${l}</b><i>${WT_VAL[l] || ''}</i></span>`;
const blank = extra => `<span class="wtt bk"${extra || ''}></span>`;
// The words a placement made, as the rules count them (the main one along the line, then each one across a new tile):
// their cells on the board as it stands after the move.
function wordCells(board, t) {
  const n = WT.n, row = i => Math.floor(i / n), step = (i, d, s) => { const j = i + d * s; return j < 0 || j >= n * n || (d === 1 && row(j) !== row(i)) ? -1 : j; };
  const at = (i, d) => { let a = i; for (let j = step(a, d, -1); j >= 0 && board[j]; j = step(a, d, -1)) a = j; const cs = []; for (let j = a; j >= 0 && board[j]; j = step(j, d, 1)) cs.push(j); return cs; };
  if (!t || !t.length) return [];
  const cells = t.map(x => x[0]), rows = new Set(cells.map(row));
  const side = c => (step(c, 1, -1) >= 0 && board[step(c, 1, -1)]) || (step(c, 1, 1) >= 0 && board[step(c, 1, 1)]);
  const d = cells.length === 1 ? (side(cells[0]) ? 1 : n) : rows.size === 1 ? 1 : n, out = [];
  const main = at(cells[0], d); if (main.length >= 2) out.push(main);
  for (const c of cells) { const x = at(c, d === 1 ? n : 1); if (x.length >= 2) out.push(x); }
  return out;
}
// A box over a run of cells on the board (a word being counted): where it lies, in cells.
const boxAt = cells => { const n = WT.n, a = cells[0], z = cells[cells.length - 1]; return `--c:${a % n};--r:${Math.floor(a / n)};--w:${(z % n) - (a % n) + 1};--h:${Math.floor(z / n) - Math.floor(a / n) + 1}`; };
// The tiles this phone's rack kept through its own word, each with the slot it stood in before (old: the rack before,
// used: the slots the word's tiles came from): new index -> old index.
function keptFrom(old, used, now) {
  const free = old.map((l, k) => (used.has(k) ? null : l)), map = new Map();
  now.forEach((l, k) => { const j = free.indexOf(l); if (j >= 0) { free[j] = null; map.set(k, j); } });
  return map;
}
function wtTable(mini, a, o) {
  const s = a && a.wt ? a.wt : null, sq = o.zoom, turn = o.turn, c = wtCfg(mini);
  const fp = s ? a.by : turn;                                       // who is playing: the mover, during their move; else the player on the move
  const me = mySide() || turn, rack = mini.rack && Array.isArray(mini.rack[me]) ? mini.rack[me] : null;   // this phone's own rack (the other side's is never here)
  const mine = !o.view && !o.locked && !s && turn === me && !!rack;
  const d = rack && (mine || (o.locked && !s && turn === me)) ? draftOf(mini, sq, me) : null;
  const pp = d ? popOf(d.key) : null;
  const board = mini.board, own = mini.own || [], fly = !REDUCED;
  const put = d ? d.put : [], putAt = new Map(put.map(([cell, k]) => [cell, k])), used = new Set(put.map(([, k]) => k));
  const tim = wtTimes(s), word = s && s.kind === 'word', swap = s && s.kind === 'swap', myMove = !!s && a.by === me && !!rack;
  // this phone's own word, laid from its draft: stamped where it lies; anyone else's (or one with no draft here): flown in from the mover's score
  const was = myMove && draft && draft.key === `${sq}:${me}:${mini.plays[me] - 1}` ? draft : null;
  const stamped = word && was && was.put.length === s.t.length && s.t.every(([cell]) => was.put.some(([x]) => x === cell));
  const fresh = word ? new Map(s.t.map(([cell], k) => [cell, k])) : new Map();
  const lastW = !s && mini.last && mini.last.kind === 'word' && Array.isArray(mini.last.t) ? new Set(mini.last.t.map(x => x[0])) : word ? new Set(s.t.map(x => x[0])) : new Set();
  const cells = board.map((l, i) => {
    const pr = WT_PREM[i], pk = putAt.get(i);
    let inner = '', cls = 'wtc' + (pr !== '.' ? ' p' + (pr === pr.toUpperCase() ? 'w' : 'l') + (pr === 'T' || pr === 't' ? '3' : '2') : '') + (i === WT_CENTRE ? ' ctr' : ''), host = '';
    if (l) {
      const k = fresh.get(i), tc = (own[i] ? 'o' + own[i] : '') + (lastW.has(i) ? ' last' : '');
      inner = k == null || !fly ? tile(l, tc) : stamped ? tile(l, tc + ' stamp', ` style="--t:${tim.dropAt(k)}ms"`) : tile(l, tc, cfFrom('wtp:' + a.by, tim.dropAt(k), { d: WT.dropMs - 80 }));
    } else if (pk != null) { const laid = pp && pp.lay === i && fly; inner = tile(rack[pk], 'dr o' + me, laid ? cfFrom('wts:' + pk, 0, { d: 220 }) : ''); cls += ' hasdr'; if (laid) host = fxAttr(pp.at); }
    else if (i === WT_CENTRE) inner = STAR;
    else if (pr !== '.') inner = `<em>${PREM_NAME[pr]}</em>`;
    const can = mine && !l && (pk != null || (d && d.sel != null));
    if (can && pk == null) cls += ' can';
    return `<button class="${cls}" data-act="wtc" data-v="${i}"${cfAnchor('wtc:' + i)}${host} aria-label="Square ${i + 1}${pr !== '.' ? ', ' + PREM_LONG[pr] : ''}${l ? ', ' + l : pk != null ? ', ' + rack[pk] + ' (yours, this turn)' : ''}"${can ? '' : ' disabled tabindex="-1"'}>${inner}</button>`;
  }).join('');
  // the draft as it stands, checked
  const t = d ? put.map(([cell, k]) => [cell, rack[k]]) : [];
  const ch = t.length ? wtCheck(board, rack, t, c) : null;
  // over the board: the draft's points on its word's last tile; a word played: each word it made ringed in turn with its points
  let over = '';
  if (mine && ch && ch.ok) { const z = ch.words[0].cells[ch.words[0].cells.length - 1]; over = `<span class="wtchip ok" style="${boxAt([z])}">+${ch.score}</span>`; }
  if (word) {
    const b2 = s.board || board, wc = wordCells(b2, s.t);
    over = (s.words || []).map((w, k, ws) => (wc[k] ? `<span class="wtwb${o.won && k === ws.length - 1 ? ' win' : ''}" style="${boxAt(wc[k])};--t:${fly ? tim.wordAt(k) : 0}ms"><b>+${w.s}</b></span>` : '')).join('');
  }
  // this phone's rack: the tiles in hand (the picked one lifted, a laid one's slot empty); after its own word the tiles kept close up and the new ones fly in from the bag; after its own swap all of them do
  const old = myMove && shown && shown.key === `${sq}:${me}` ? shown.rack : null;
  const kept = word && myMove && stamped && old && fly ? keptFrom(old, new Set(was.put.map(([, k]) => k)), rack) : null;
  let nNew = 0;
  const rackHtml = Array.from({ length: c.rack }, (_, k) => {
    const l = rack ? rack[k] : null;
    if (!l) return `<span class="wtr none"${cfAnchor('wts:' + k)}></span>`;
    const on = d && d.sel === k, gone = used.has(k), can = mine && !gone;
    let cf = '', host = '';
    if (fly && myMove && word) { if (kept && kept.has(k)) { if (kept.get(k) !== k) cf = cfFrom('wts:' + kept.get(k), 0, { wait: true, d: 240 }); } else if (!kept ? k >= rack.length - s.t.length : true) cf = cfFrom('wtbag', tim.fillAt(nNew++)); }
    else if (fly && myMove && swap) cf = cfFrom('wtbag', tim.inAt(k));
    else if (pp && fly && pp.back && pp.back[k] != null) { cf = cfFrom('wtc:' + pp.back[k], 0, { d: 220 }); host = fxAttr(pp.at); }
    else if (pp && pp.sel === k && on) host = fxAttr(pp.at);
    return `<button class="wtr${on ? ' sel' : ''}${gone ? ' used' : ''}" data-act="wtr" data-v="${k}"${cfAnchor('wts:' + k)}${host} aria-label="Tile ${l}, ${WT_VAL[l]} point${WT_VAL[l] === 1 ? '' : 's'}"${can ? '' : ' disabled tabindex="-1"'}>${gone ? '' : tile(l, 'o' + me, cf)}</button>`;
  }).join('');
  if (!s && rack) shown = { key: `${sq}:${me}`, rack: rack.slice() };
  // the bag: its count; tiles on their way in (this phone's own swap: its old tiles; another's: blank ones)
  const nBag = Number.isInteger(mini.bagN) ? mini.bagN : 0;
  let inBag = '';
  if (swap && fly) inBag = myMove && old ? old.map((l, k) => tile(l, 'o' + me + ' gh', cfFrom('wts:' + k, tim.outAt(k), { wait: true, go: true }))).join('') : myMove ? '' : Array.from({ length: c.rack }, (_, k) => blank(cfFrom('wtp:' + a.by, tim.outAt(k), { go: true }))).join('');
  const filled = word && fly && nBag + s.t.length <= 53;
  const bag = `<span class="wtbag"${cfAnchor('wtbag')} aria-label="${nBag} tile${nBag === 1 ? '' : 's'} in the bag">${BAG}${filled ? `<b class="cnt" data-from="${nBag + s.t.length}" data-delay="${tim.fillAt(0)}" data-ms="${Math.max(120, (s.t.length - 1) * WT.gap + WT.fly)}">${nBag}</b>` : `<b>${nBag}</b>`}${inBag}</span>`;
  // the other side's tiles to and from their score: blank (their letters are theirs)
  const theirs = p => (!s || !fly || a.by !== p || myMove ? '' : word ? s.t.map((x, k) => blank(cfFrom('wtbag', tim.fillAt(k), { go: true }))).join('') : Array.from({ length: c.rack }, (_, k) => blank(cfFrom('wtbag', tim.inAt(k), { go: true }))).join(''));
  const W = p => `<b class="${p}">${N(p)}</b>`;
  let line;
  if (word) {
    const steps = (s.words || []).map(w => `${w.w} +${w.s}`);
    if (s.all) steps.push(`All seven! +${s.pts - (s.words || []).reduce((n, w) => n + w.s, 0)}`);
    if (steps.length > 1) steps[steps.length - 1] += ` <small>= ${s.pts}</small>`;   // (several words: the move's points with the last)
    line = `<p class="arcres ok wtsteps" role="status">${steps.map((x, k) => `<span class="wtstep${k < steps.length - 1 ? ' on' : ''}" style="--t:${fly ? tim.wordAt(k) : 0}ms;--u:${fly ? tim.wordAt(k + 1) : 0}ms">${x}</span>`).join('')}</p>`;
  } else if (swap) line = `<p class="arcres sm" role="status">${s.stuck ? 'No room for a word: the higher score wins' : `${W(a.by)} swapped tiles`}</p>`;
  else if (mine && ch) line = ch.ok ? `<p class="arcres ok"><span class="wttick" aria-hidden="true"></span>${ch.words[0].w} +${ch.score}</p>` : `<p class="arcres no sm">${ch.reason === 'word' ? `${ch.w}: not in the list` : WHY[ch.reason] || ''}</p>`;
  else line = `<p class="arcnote">${o.view ? '' : o.locked && !mine ? waitLine(turn) : ''}</p>`;
  const sc = p => { const moved = word && a.by === p; return `<span class="wtsc"${cfAnchor('wtp:' + p)} aria-label="${mini.score[p]} of ${c.target} points">${moved ? `<b class="cnt" data-from="${s.from}" data-delay="${REDUCED ? 0 : tim.count}" data-ms="${Math.max(400, tim.words * WT.per - 120)}">${mini.score[p]}</b>` : `<b>${mini.score[p]}</b>`}<small>/${c.target}</small>${theirs(p)}</span>`; };
  const tal = p => arcTally(p, o, sc(p));
  const ok = mine && ch && ch.ok;
  const btns = o.view ? '' : `<div class="cbtns three"><button class="big" data-act="wtclr"${mine && put.length ? '' : ' disabled'}>Clear</button><button class="big" data-act="move" ${mv('swap')}${mine && !put.length ? '' : ' disabled'}>Swap</button><button class="big wtplay ${turn}${ok ? ' go' : ''}" data-act="move" ${mv(ok ? t : null)}${ok ? '' : ' disabled'}>Play${ok ? ` <b>+${ch.score}</b>` : ''}</button></div>`;
  return `<div class="g-arc wtg"><div class="ctals">${tal('X')}${tal('O')}</div><div class="wtbw"><div class="wtboard ${fp}${d && d.sel != null ? ' aim' : ''}">${cells}${over}</div></div><div class="wtmid">${line}${bag}</div><div class="wtrack ${me}">${rackHtml}</div>${btns}</div>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = wtTable(mini, a, { view, locked, turn, zoom: state.zoom, done: !!d, won: !!a && (a.kind === 'claim' || a.kind === 'match') }); return g;
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
// A word: a click as each tile lands on the board (a light buzz each, thinned), a rising blip as each word it made is
// counted and a ding on the last (the points in); the new tiles sliding out of the bag. A swap: the tiles sliding into
// the bag, its rattle, the new ones sliding out.
export function sounds(f, add, won, mini, last) {
  const s = f.wt;
  if (!s) return;
  const t = wtTimes(s);
  if (s.kind === 'swap') { add('cardSlide', 0); add('tileBag', t.out - 60); add('cardSlide', WT.back); add('cardSlide', WT.back + 160); return; }
  s.t.forEach((x, k) => add('domClick', t.landAt(k)));
  for (let k = 0; k < t.words - 1; k++) add('point', t.wordAt(k), 1 + k * 0.12);
  add(won ? 'sparkle' : 'ding', t.wordAt(t.words - 1));
  if (!won) add('cardSlide', t.fillAt(0));
}
// The rack and the board's taps: pick a tile, lay it, take it back.
function draftHere(mini, sq, p) {
  const k = keyOf(mini, sq, p);
  if (!draft || draft.key !== k) draft = { key: k, sel: null, put: [] };
  return draft;
}
const popAt = (d, o) => { pop = Object.assign({ key: d.key, at: performance.now(), lay: null, back: null, sel: null }, o); };
function rackTap(mini, sq, p, k, quiet) {
  const d = draftHere(mini, sq, p);
  if (!mini.rack || !mini.rack[p] || !mini.rack[p][k] || d.put.some(([, j]) => j === k)) return false;
  d.sel = d.sel === k ? null : k;
  popAt(d, { sel: d.sel });
  if (!quiet) SND.play('key');
  return true;
}
function cellTap(mini, sq, p, cell, quiet) {
  const d = draftHere(mini, sq, p);
  if (mini.board[cell]) return false;
  const at = d.put.findIndex(([c]) => c === cell);
  if (at >= 0) { const k = d.put[at][1]; d.put.splice(at, 1); popAt(d, { back: { [k]: cell } }); if (!quiet) SND.play('cardSlide'); return true; }
  if (d.sel == null) { if (!quiet) SND.play('error'); return false; }
  d.put.push([cell, d.sel]); d.sel = null;
  popAt(d, { lay: cell });
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
  wtclr: () => { const h = here(); if (!h) return; const d = draftHere(h.mini, h.sq, h.p); popAt(d, { back: Object.fromEntries(d.put.map(([cell, k]) => [k, cell])) }); d.put = []; d.sel = null; SND.play('cardSlide'); render(); },
};
// Someone else's word replayed (ui/replay.js): their rack is theirs alone (never on this phone), so their picks and lays
// are not pressed here: the inputs are let pass, and the word plays from the move itself (its tiles flying onto the
// board one after the other, then the points). The computer's word: no inputs (an empty list), the same.
function replayInput(act, val, r) { return act === 'wtr' || act === 'wtc' || act === 'wtclr' || act === 'move'; }
function replaySynth(m, mini, o) { return []; }
export const replay = { input: replayInput, synth: replaySynth };
