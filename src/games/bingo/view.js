// Bingo: the screen, the miniature, the move's words and sounds. The inputs are the offered numbers' chips (data-act="move",
// the chip's index as the move: the page's click handler and the shared replay press them).
import { BINGOT, bingoBest, bingoMarks, bingoPool, bingoSize, bingoTimes, isCalled, linesOf } from './rules.js';
import { N, mv, state } from '../../ui/app.js';
import { arcTally, lateAt, pips } from '../../ui/progress.js';

// The screen: both players' tallies up top (name, the best line's marks as pips of the card's size), the two cards side by
// side (X's then O's, each a grid of its numbers; a called number is marked in the card owner's colour, the latest call
// ringed), the offered numbers as big chips (each with tiny dots for the cards it is on: X's, O's, both or none) and the
// result line (its row always reserved). A call plays as it was made, timed from the move (rules.js bingoTimes): the
// chip pressed lifts and fades, the mark stamps onto every card the number is on as it lands, and a complete line lights
// cell by cell (the game's own winning moment; the claim is the board's). What animates comes from the move being
// replayed (a: its recorded flash), never from the square's last result, which may be the viewer's own.
const sizeOf = m => bingoSize(m);
function card(mini, p, s, t, view, win) {
  const n = sizeOf(mini), nums = mini.cards[p] || [], marks = bingoMarks(mini, p);
  const hit = s ? s.hit[p] : -1, line = s && s.won[p] ? s.won[p] : null, held = !s && win && mini.win === p ? win : null;   // the mark landing now; the line lit now; a finished square's line, lit for good
  const last = !s && mini.last && !mini.win ? mini.cards[p].indexOf(mini.last.n) : -1;   // (the latest call, ringed until the next)
  const cells = nums.map((v, i) => {
    const cls = ['bgc'];
    let style = '';
    if (marks[i]) {
      if (i === hit) { cls.push('on', 'bgnew'); style = `--t:${t.land}ms`; } else cls.push('on');
      if (line && line.includes(i)) { cls.push('bgwin'); style += `${style ? ';' : ''}--t2:${t.line + line.indexOf(i) * BINGOT.step}ms`; }
      else if (held && held.includes(i)) cls.push('bgwin', 'set');
      if (i === last) cls.push('bglast');
    }
    return `<span class="${cls.join(' ')}"${style ? ` style="${style}"` : ''} aria-label="${v}${marks[i] ? ', called' : ''}"><b>${v}</b></span>`;
  });
  return `<div class="bgcard ${p}"><div class="bghd"><b class="${p}">${p}</b></div><div class="bggrid" style="--n:${n}">${cells.join('')}</div></div>`;
}
// A chip: the number and the cards it is on (tiny dots in their colours).
function chip(mini, v, k, cls, on) {
  const dots = ['X', 'O'].filter(p => (mini.cards[p] || []).includes(v)).map(p => `<i class="bgdot ${p}"></i>`).join('');
  return `<button class="bgchip${cls ? ' ' + cls : ''}" data-act="move" ${mv(k)}${on ? '' : ' disabled'} aria-label="Call ${v}"><b>${v}</b><span class="bgdots" aria-hidden="true">${dots}</span></button>`;
}
export function bingoWords(a, who) {   // the result line's words for a call (a: its flash's bingo, or the square's last)
  if (a.won && a.won.X && a.won.O) return 'Both lines!';
  if (a.won && (a.won.X || a.won.O)) return 'Line!';
  const x = a.hit.X >= 0, o = a.hit.O >= 0;
  if (x && o) return `${a.n}: both cards`;
  if (x || o) return `${a.n}: ${x ? 'X' : 'O'}'s card`;
  return `${a.n}: no card`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  const s = a && a.bingo ? a.bingo : null, l = mini.last, n = sizeOf(mini), t = s ? bingoTimes(s) : null, o = { view, locked, turn, zoom: state.zoom };
  const tal = p => {   // the best line's marks: the pip fills as the mark lands, timed from the move
    const now = bingoBest(mini, p), was = s ? s.was[p] : now, moved = now !== was;
    return arcTally(p, o, pips(p, now, n, moved, moved ? t.land : null));
  };
  const win = mini.win ? (mini.winCells || null) : null;
  const cards = `<div class="bgwrap"><div class="bgcards">${card(mini, 'X', s, t, view, win)}${card(mini, 'O', s, t, view, win)}</div></div>`;
  const offer = s ? s.offer : (mini.offer || []);
  const open = !s && !locked && !view;
  const chips = offer.map((v, k) => chip(mini, v, k, s ? (k === s.k ? 'bgpick' : 'bgdim') : '', open));
  while (chips.length < 3) chips.push('<span class="bgchip bgnone" aria-hidden="true"></span>');   // (the row keeps its shape when fewer numbers are left)
  const left = bingoPool(mini).length;
  const res = s ? `<p ${lateAt('arcres ' + (s.won.X || s.won.O ? 'ok' : s.hit.X >= 0 || s.hit.O >= 0 ? '' : 'no'), t.land)} role="status">${bingoWords(s)}</p>`
    : (view || d) && l ? `<p class="arcnote"><b class="${l.by}">${N(l.by)}</b> called ${l.n}</p>`
    : `<p class="arcnote">${view ? '' : locked ? `Waiting for <b class="${turn}">${N(turn)}</b>…` : `<b class="${turn}">${N(turn)}</b>'s call · ${left} number${left === 1 ? '' : 's'} left`}</p>`;
  g = `<div class="g-arc g-bingo"><div class="ctals">${tal('X')}${tal('O')}</div>
      ${cards}
      <div class="bgoffer${s ? ' playing' : ''}"${s ? ` style="--t:${t.land}ms"` : ''}>${chips.join('')}</div>
      ${res}</div>`;
  return g;
}
export function moveText(f, who) {
  const a = f.bingo;
  if (!a) return `${who} called`;
  return `${who} called ${a.n}`;
}
// The chip pops as it is pressed; the mark stamps onto each card the number is on as it lands (a thud where it is on none);
// a complete line lights cell by cell, each a point, and sparkles at its end (a tie: both lines, then a thud).
export function sounds(f, add, won, mini, last) {
  const a = f.bingo;
  add('pop', 0);
  if (!a) return;
  const t = bingoTimes(a), hits = (a.hit.X >= 0 ? 1 : 0) + (a.hit.O >= 0 ? 1 : 0);
  if (!hits) { add('thud', t.land); return; }
  for (let k = 0; k < hits; k++) add('thunk', t.land + k * 70);
  const lined = a.won.X || a.won.O;
  if (!lined) return;
  for (let k = 0; k < a.size; k++) add('point', t.line + k * BINGOT.step);
  add(a.won.X && a.won.O ? 'thud' : 'sparkle', t.line + (a.size - 1) * BINGOT.step + 140);
}
// The miniature: the two cards side by side, tiny, each a grid with its called numbers filled in its owner's colour and a
// complete line lit; the owner's letter over each (both cards are public).
export function miniature(mini, final) {
  const n = sizeOf(mini), c = 10, gap = 1.6, w = n * c + (n - 1) * gap, pad = 4, W = 2 * w + 3 * pad, H = w + 13;
  const win = mini.win ? new Set(mini.winCells || []) : null;
  const cardSvg = (p, x0) => {
    const marks = bingoMarks(mini, p), cells = [];
    for (let i = 0; i < n * n; i++) {
      const r = Math.floor(i / n), col = i % n, x = x0 + col * (c + gap), y = 12 + r * (c + gap);
      cells.push(`<rect class="tbgc${marks[i] ? ' on ' + p : ''}${win && mini.win === p && win.has(i) ? ' win' : ''}" x="${x}" y="${y}" width="${c}" height="${c}" rx="1.6"/>`);
    }
    return `<text class="tbgl ${p}" x="${x0 + w / 2}" y="9">${p}</text>${cells.join('')}`;
  };
  const best = p => bingoBest(mini, p);
  return `<svg class="tbingo" viewBox="0 0 ${W} ${H}" aria-label="Bingo: X's best line ${best('X')} of ${n}, O's ${best('O')} of ${n}">${cardSvg('X', pad)}${cardSvg('O', 2 * pad + w)}</svg>`;
}
