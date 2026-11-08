// Bingo: the screen, the miniature, the move's words and sounds. The inputs are Pick numbers (data-act="move", the move
// 'draw') and then the drawn balls (data-act="move", the ball's index as the move): the page's click handler and the shared
// replay press them (an opponent's or the computer's turn replays as two moves: Pick numbers pressed, the cage turning and
// its balls rolling out from the draw's recorded flash, then the chosen ball pressed and called).
import { BINGOT, BINGO_DRAW, bingoBest, bingoDrawTimes, bingoDrawn, bingoMarks, bingoPool, bingoSize, bingoTimes, isCalled, linesOf } from './rules.js';
import { N, mv, state, waitLine } from '../../ui/app.js';
import { arcTally, lateAt, pips } from '../../ui/progress.js';
import { markSvgG } from '../../ui/thumbs.js';

// The screen: both players' tallies up top (name, the best line's marks as pips of the card's size), the two cards side by
// side (X's then O's, each a grid of its numbers; a called number is marked in the card owner's colour, the latest call
// ringed), the tray under them (the cage, and the drawn numbers as balls, each with tiny dots for the cards it is on: X's,
// O's, both or none; before the draw, Pick numbers over their empty places) and the result line (its row always
// reserved). A draw plays from its flash (rules.js bingoDrawTimes): the cage turns and the balls roll out one by one. A
// call plays as it was made, timed from the move (rules.js bingoTimes): the ball pressed lifts and flies to the cards, the mark stamps onto every card the number is on as it lands, and a complete line lights
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
// The cage (original art, drawn here): a wire drum on a wooden stand with its crank, a few balls tumbling inside and a
// spout at its foot where the drawn balls roll out. `spin`: the draw under way (the drum and crank turn from the move).
const CAGE_BALLS = [[-9, -6, 'a'], [6, -10, 'b'], [10, 5, 'c'], [-4, 9, 'a'], [-12, 6, 'b'], [2, -1, 'c']];
function cage(spin, t) {
  const cx = 34, cy = 30, R = 24, spokes = Array.from({ length: 6 }, (_, k) => { const a = (k * Math.PI) / 3, x = (R * Math.cos(a)).toFixed(1), y = (R * Math.sin(a)).toFixed(1); return `M${cx} ${cy}L${(cx + +x).toFixed(1)} ${(cy + +y).toFixed(1)}`; }).join('');
  const hex = Array.from({ length: 6 }, (_, k) => { const a = (k * Math.PI) / 3 + Math.PI / 6; return `${(cx + R * Math.cos(a)).toFixed(1)},${(cy + R * Math.sin(a)).toFixed(1)}`; }).join(' ');
  const balls = CAGE_BALLS.map(([x, y, c], k) => `<circle class="bgcb ${c}" cx="${cx + x}" cy="${cy + y}" r="4.6" style="--j:${k}"/>`).join('');
  return `<div class="bgcage${spin ? ' spin' : ''}" aria-hidden="true"${spin ? ` style="--t:${t.spin}ms;--d:${t.stop - t.spin}ms"` : ''}><svg viewBox="0 0 76 70">
    <path class="bgstand" d="M14 66L26 40M54 66L42 40"/><rect class="bgbase" x="6" y="62" width="58" height="7" rx="3"/>
    <path class="bgspout" d="M50 46l12 8v7l-14-6z"/>
    <g class="bgdrum"><g class="bgin">${balls}</g><polygon class="bgwire" points="${hex}"/><path class="bgspk" d="${spokes}"/>
      <path class="bgcrank" d="M${cx} ${cy}L${cx + 30} ${cy - 4}"/><circle class="bgknob" cx="${cx + 30}" cy="${cy - 4}" r="4"/></g>
    <circle class="bghub" cx="${cx}" cy="${cy}" r="4"/></svg></div>`;
}
// A ball in the tray: its number on a white disc, and the cards it is on (tiny dots in their colours). k: its place in
// the tray; cls: how it moves now (rolling out of the cage, called, dimmed); on: it can be tapped (the call).
const BALL_TONE = ['a', 'b', 'c'];
function ball(mini, v, k, cls, on, style) {
  const dots = ['X', 'O'].filter(p => (mini.cards[p] || []).includes(v)).map(p => `<i class="bgdot ${p}"></i>`).join('');
  return `<span class="bgslot"><button class="bgball ${BALL_TONE[v % 3]}${cls ? ' ' + cls : ''}" data-act="move" ${mv(k)}${on ? '' : ' disabled'} style="--k:${k}${style || ''}" aria-label="Call ${v}"><span class="bgface"><b>${v}</b><span class="bgdots" aria-hidden="true">${dots}</span></span></button></span>`;
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
  const fb = a && a.bingo ? a.bingo : null, s = fb && !fb.draw ? fb : null, dr = fb && fb.draw ? fb : null;   // the move playing: a call (s), or a draw (dr)
  const l = mini.last, n = sizeOf(mini), t = s ? bingoTimes(s) : null, td = dr ? bingoDrawTimes(dr) : null, o = { view, locked, turn, zoom: state.zoom };
  const tal = p => {   // the best line's marks: the pip fills as the mark lands, timed from the move
    const now = bingoBest(mini, p), was = s ? s.was[p] : now, moved = now !== was;
    return arcTally(p, o, pips(p, now, n, moved, moved ? t.land : null));
  };
  const win = mini.win ? (mini.winCells || null) : null;
  const cards = `<div class="bgwrap"><div class="bgcards">${card(mini, 'X', s, t, view, win)}${card(mini, 'O', s, t, view, win)}</div></div>`;
  // The tray: the cage at its left, three places for the balls. Nothing drawn: Pick numbers over the empty places (the
  // move 'draw'); a draw playing: the cage turns and its balls roll out one by one into their places; drawn: the balls,
  // a tap calls one; a call playing: the one called lifts away to the cards, the others fade back.
  const offer = s ? s.offer : dr ? dr.offer : view ? [] : (mini.offer || []);
  const open = !fb && !locked && !view;
  const balls = offer.map((v, k) => (dr ? ball(mini, v, k, 'bgout', false, `;--t:${td.balls[k]}ms`) : ball(mini, v, k, s ? (k === s.k ? 'bgpick' : 'bgdim') : '', open)));
  while (balls.length < 3) balls.push('<span class="bgslot"></span>');   // (the tray keeps its shape when fewer numbers are left)
  const pick = !offer.length && !view ? `<button class="bgdraw" data-act="move" ${mv(BINGO_DRAW)}${open && bingoPool(mini).length ? '' : ' disabled'}>Pick numbers</button>` : '';
  const left = bingoPool(mini).length, drawn = bingoDrawn(mini);
  const res = s ? `<p ${lateAt('arcres ' + (s.won.X || s.won.O ? 'ok' : s.hit.X >= 0 || s.hit.O >= 0 ? '' : 'no'), t.land)} role="status">${bingoWords(s)}</p>`
    : dr ? `<p class="arcnote"><b class="${dr.by}">${N(dr.by)}</b> picks numbers</p>`
    : (view || d) && l ? `<p class="arcnote"><b class="${l.by}">${N(l.by)}</b> called ${l.n}</p>`
    : `<p class="arcnote">${view ? '' : locked ? waitLine(turn) : `<b class="${turn}">${N(turn)}</b>'s ${drawn ? 'call' : 'turn'} · ${left} number${left === 1 ? '' : 's'} left`}</p>`;
  g = `<div class="g-arc g-bingo"><div class="ctals">${tal('X')}${tal('O')}</div>
      ${cards}
      <div class="bgtray${s ? ' playing' : ''}"${s ? ` style="--t:${t.land}ms"` : ''}>${cage(!!dr, td)}<div class="bgballs">${balls.join('')}${pick}</div></div>
      ${res}</div>`;
  return g;
}
export function moveText(f, who) {
  const a = f.bingo;
  if (!a) return `${who} called`;
  if (a.draw) return `${who} picked numbers`;
  return `${who} called ${a.n}`;
}
// A call: the ball pops as it is pressed; the mark stamps onto each card the number is on as it lands (a thud where it is on none);
// a complete line lights cell by cell, each a point, and sparkles at its end (a tie: both lines, then a thud).
// A draw: the cage rattles as it turns, and each ball clacks out of the spout as it leaves.
export function sounds(f, add, won, mini, last) {
  const a = f.bingo;
  if (a && a.draw) { const td = bingoDrawTimes(a); add('bgCage', td.spin); td.balls.forEach(ms => add('bgBall', ms)); return; }
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
// complete line lit; the owner's mark drawn over each (an X or an O, no text: both cards are public).
export function miniature(mini, final) {
  const n = sizeOf(mini), c = 10, gap = 1.6, w = n * c + (n - 1) * gap, pad = 4, W = 2 * w + 3 * pad, H = w + 15;
  const win = mini.win ? new Set(mini.winCells || []) : null;
  const cardSvg = (p, x0) => {
    const marks = bingoMarks(mini, p), cells = [];
    for (let i = 0; i < n * n; i++) {
      const r = Math.floor(i / n), col = i % n, x = x0 + col * (c + gap), y = 14 + r * (c + gap);
      cells.push(`<rect class="tbgc${marks[i] ? ' on ' + p : ''}${win && mini.win === p && win.has(i) ? ' win' : ''}" x="${x}" y="${y}" width="${c}" height="${c}" rx="1.6"/>`);
    }
    return `<g class="tbgl ${p}" transform="translate(${x0 + w / 2} 6.5)">${markSvgG(p, 4.4)}</g>${cells.join('')}`;
  };
  const best = p => bingoBest(mini, p);
  return `<svg class="tbingo" viewBox="0 0 ${W} ${H}" aria-label="Bingo: X's best line ${best('X')} of ${n}, O's ${best('O')} of ${n}">${cardSvg('X', pad)}${cardSvg('O', 2 * pad + w)}</svg>`;
}
