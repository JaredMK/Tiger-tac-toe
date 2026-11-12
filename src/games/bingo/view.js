// Bingo: the screen, the miniature, the move's words and sounds. The inputs are Pick numbers (data-act="move", the move
// 'draw') and then the drawn balls (data-act="move", the ball's index as the move): the page's click handler and the shared
// replay press them (an opponent's or the computer's turn replays as two moves: Pick numbers pressed, the cage turning and
// its balls rolling out from the draw's recorded flash, then the chosen ball pressed and called).
import { BINGOT, BINGO_DRAW, bingoBest, bingoDrawTimes, bingoDrawn, bingoMarks, bingoPool, bingoSize, bingoTimes, linesOf } from './rules.js';
import { N, mv, state, waitLine } from '../../ui/app.js';
import { cfAnchor, cfFrom } from '../../ui/cardfly.js';
import { arcTally, lateAt, pips } from '../../ui/progress.js';
import { markSvgG } from '../../ui/thumbs.js';

// The screen: both players' tallies up top (name, the best line's marks as pips of the card's size), the two cards side by
// side under them (X's then O's: a header band in the owner's colour with their drawn mark, a grid of its numbers; a called
// number is daubed in the card owner's colour, the latest call ringed, a square one call from a line dashed in the
// owner's colour, a square whose number is on a drawn ball ringed in ink), the number tracker, the tray under it (the cage,
// a rail, and the drawn numbers as balls, each with dots for the cards it is on: X's, O's, both or none; before the draw,
// Pick numbers over their empty places, in the mover's colour) and the result line (its row always reserved). A draw plays
// from its flash (rules.js bingoDrawTimes): the cage turns and the balls roll down the rail one by one. A call plays as it
// was made, timed from the move (rules.js bingoTimes): the ball pressed pops and flies to its number on the tracker
// (ui/cardfly.js: the flyer .bgfly is drawn on the tracker's number and comes from the ball, `bgball:k`), the mark stamps
// onto every card the number is on as it lands (a ring in the caller's colour round each, the second card a beat after
// the first), and a complete line lights cell by cell, is struck through, and its card hops in a gold frame while the
// other card dims (the game's own winning moment, and whose line it is; the claim is the board's). What animates comes
// from the move being replayed (a: its recorded flash), never from the square's last result, which may be the viewer's own.
const sizeOf = m => bingoSize(m);
const STARS = [[-4, 10], [50, -9], [104, 14], [-5, 82], [103, 76], [48, 104]];   // the sparkles round a card whose line is complete (% of the card)
function card(mini, p, s, t, win, offer) {
  const n = sizeOf(mini), nums = mini.cards[p] || [], marks = bingoMarks(mini, p), lines = linesOf(mini), q = p === 'X' ? 'O' : 'X';
  const hit = s ? s.hit[p] : -1, line = s && s.won[p] ? s.won[p] : null, held = !s && win && mini.win === p ? win : null;   // the mark landing now; the line lit now; a finished square's line, lit for good
  const lost = s ? !!s.won[q] && !s.won[p] : !!mini.win && mini.win !== p;   // the other card's line: this one steps back
  const last = !s && mini.last && !mini.win ? mini.cards[p].indexOf(mini.last.n) : -1;   // (the latest call, ringed until the next)
  const need = new Set();   // the squares one call from a line (as the card stood before the mark now landing)
  if (!mini.win && !line) for (const l of lines) { const open = l.filter(i => !marks[i] || i === hit); if (open.length === 1) need.add(open[0]); }
  const cells = nums.map((v, i) => {
    const cls = ['bgc'];
    let style = '';
    if (marks[i]) {
      if (i === hit) { cls.push('on', 'bgnew', 'by' + s.by); style = `--t:${t.daub[p]}ms`; } else cls.push('on');
      if (line && line.includes(i)) { cls.push('bgwin'); style += `${style ? ';' : ''}--t2:${t.line + line.indexOf(i) * BINGOT.step}ms`; }
      else if (held && held.includes(i)) cls.push('bgwin', 'set');
      if (i === last) cls.push('bglast');
    } else if (offer.includes(v)) cls.push('bgoff');
    if (need.has(i)) cls.push('bgneed');
    return `<span class="${cls.join(' ')}"${style ? ` style="${style}"` : ''} aria-label="${v}${marks[i] ? ', called' : ''}"><b>${v}</b></span>`;
  });
  // a complete line, struck through from its first square to its last (each whole line the winning squares hold)
  const done = line || held, at = i => `${(i % n) + 0.5} ${Math.floor(i / n) + 0.5}`;
  const strike = done ? `<svg class="bgstrike${held ? ' set' : ''}" viewBox="0 0 ${n} ${n}" aria-hidden="true"${line ? ` style="--t3:${t.strike}ms"` : ''}>${lines.filter(l => l.every(i => done.includes(i))).map(l => { const d = `M${at(l[0])}L${at(l[n - 1])}`; return `<path class="bgsl o" pathLength="1" d="${d}"/><path class="bgsl i" pathLength="1" d="${d}"/>`; }).join('')}</svg>` : '';
  const stars = line && !lost && !s.won[q] ? STARS.map(([x, y], k) => `<i class="bgstar" style="left:${x}%;top:${y}%;--t3:${t.strike + 60 + k * 70}ms"></i>`).join('') : '';
  const cls = `bgcard ${p}${line && !s.won[q] ? ' bgwon' : held ? ' bgwon set' : ''}${lost ? ' bglost' + (s ? '' : ' set') : ''}`;
  return `<div class="${cls}"${s && (line || lost) ? ` style="--t3:${t.strike}ms"` : ''}><div class="bghd"><svg viewBox="-10 -10 20 20" aria-label="${p}">${markSvgG(p, 6.2)}</svg></div><div class="bggrid" style="--n:${n}">${cells.join('')}${strike}</div>${stars}</div>`;
}
// The number tracker (November 2026): every number of the range in a compact grid, a called one filled in the colour of the
// player who called it, the latest call ringed. Kept in view between the cards and the tray; a call under replay lands
// in it with its mark (`s`: the move playing, timed from the move), never before: the ball called flies to its number
// (the flyer drawn on it, from the tray's ball) and the number fills as it lands.
const BALL_TONE = ['a', 'b', 'c'];
const trackCols = range => (range <= 27 ? 9 : range <= 40 ? 10 : range <= 48 ? 12 : 15);
function tracker(mini, s, t) {
  const range = mini.range || 26, cols = trackCols(range), by = {};
  (mini.called || []).forEach((v, i) => { by[v] = (mini.callBy || [])[i] || ''; });
  const last = s ? s.n : mini.last && !mini.win ? mini.last.n : mini.last ? mini.last.n : -1;
  const cells = [];
  for (let v = 1; v <= range; v++) {
    const called = v in by, fresh = !!s && v === s.n, cls = ['bgtk'];
    if (called && !fresh) cls.push('on', by[v] || 'X');
    if (fresh) cls.push('new', s.by || 'X');
    if (v === last && (called || fresh)) cls.push('last');
    const fly = fresh ? `<span class="bgfly ${BALL_TONE[v % 3]}" aria-hidden="true"${cfFrom('bgball:' + s.k, BINGOT.press, { go: true, d: BINGOT.fly })}><span class="bgflyb" style="--t:${BINGOT.press}ms;--d:${BINGOT.fly}ms"><b>${v}</b></span></span>` : '';
    cells.push(`<i class="${cls.join(' ')}"${fresh ? ` style="--t:${t.land}ms"` : ''} aria-label="${v}${called ? ', called' : ''}">${v}${fly}</i>`);
  }
  return `<div class="bgtk-w" role="group" aria-label="Numbers called"><div class="bgtks" style="--c:${cols}">${cells.join('')}</div></div>`;
}
// The cage (original art, drawn here): a wire drum on a wooden stand with its crank (the knob in the mover's colour), a
// few balls tumbling inside and a spout at its foot where the drawn balls roll out onto the rail. `spin`: the draw under
// way (the drum and crank turn from the move).
const CAGE_BALLS = [[-9, -6, 'a'], [6, -10, 'b'], [10, 5, 'c'], [-4, 9, 'a'], [-12, 6, 'b'], [2, -1, 'c']];
function cage(spin, t) {
  const cx = 34, cy = 30, R = 24, spokes = Array.from({ length: 6 }, (_, k) => { const a = (k * Math.PI) / 3, x = (R * Math.cos(a)).toFixed(1), y = (R * Math.sin(a)).toFixed(1); return `M${cx} ${cy}L${(cx + +x).toFixed(1)} ${(cy + +y).toFixed(1)}`; }).join('');
  const hex = Array.from({ length: 6 }, (_, k) => { const a = (k * Math.PI) / 3 + Math.PI / 6; return `${(cx + R * Math.cos(a)).toFixed(1)},${(cy + R * Math.sin(a)).toFixed(1)}`; }).join(' ');
  const balls = CAGE_BALLS.map(([x, y, c], k) => `<circle class="bgcb ${c}" cx="${cx + x}" cy="${cy + y}" r="4.6" style="--j:${k}"/>`).join('');
  return `<div class="bgcage${spin ? ' spin' : ''}" aria-hidden="true"${spin ? ` style="--t:${t.spin}ms;--d:${t.stop - t.spin}ms"` : ''}><svg viewBox="0 0 76 70">
    <ellipse class="bgshade" cx="36" cy="67.5" rx="33" ry="3.2"/>
    <path class="bgstand" d="M14 66L26 40M54 66L42 40"/><rect class="bgbase" x="6" y="61" width="58" height="7" rx="3"/>
    <path class="bgspout" d="M50 46l14 9v8l-16-8z"/>
    <g class="bgdrum"><g class="bgin">${balls}</g><polygon class="bgwire" points="${hex}"/><path class="bgspk" d="${spokes}"/><path class="bgshine" d="M18.5 17.5a20 20 0 0 1 7 -6.5"/>
      <path class="bgcrank" d="M${cx} ${cy}L${cx + 30} ${cy - 4}"/><circle class="bgknob" cx="${cx + 30}" cy="${cy - 4}" r="4.4"/></g>
    <circle class="bghub" cx="${cx}" cy="${cy}" r="4"/></svg></div>`;
}
// A ball in the tray: its number on a white disc, and the cards it is on (dots in their colours). k: its place in
// the tray; cls: how it moves now (rolling out of the cage, called, let go); on: it can be tapped (the call).
function ball(mini, v, k, cls, on, style) {
  const dots = ['X', 'O'].filter(p => (mini.cards[p] || []).includes(v)).map(p => `<i class="bgdot ${p}"></i>`).join('');
  return `<span class="bgslot"><button class="bgball ${BALL_TONE[v % 3]}${cls ? ' ' + cls : ''}" data-act="move" ${mv(k)}${on ? '' : ' disabled'} style="--k:${k}${style || ''}" aria-label="Call ${v}"${cfAnchor('bgball:' + k)}><span class="bgface"><b>${v}</b><span class="bgdots" aria-hidden="true">${dots}</span></span></button></span>`;
}
const cardOf = p => `<b class="${p}">${p}</b>'s card`;
export function bingoWords(a, who) {   // the result line's words for a call (a: its flash's bingo, or the square's last): which card it marked, whose line it made
  if (a.won && a.won.X && a.won.O) return 'Both lines!';
  if (a.won && (a.won.X || a.won.O)) return `Line on ${cardOf(a.won.X ? 'X' : 'O')}!`;
  const x = a.hit.X >= 0, o = a.hit.O >= 0;
  if (x && o) return `${a.n}: both cards`;
  if (x || o) return `${a.n}: ${cardOf(x ? 'X' : 'O')}`;
  return `${a.n}: no card`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  const fb = a && a.bingo ? a.bingo : null, s = fb && !fb.draw ? fb : null, dr = fb && fb.draw ? fb : null;   // the move playing: a call (s), or a draw (dr)
  const l = mini.last, n = sizeOf(mini), t = s ? bingoTimes(s) : null, td = dr ? bingoDrawTimes(dr) : null, o = { view, locked, turn, zoom: state.zoom };
  const tal = p => {   // the best line's marks: the pip fills as the mark lands, timed from the move
    const now = bingoBest(mini, p), was = s ? s.was[p] : now, moved = now !== was;
    return arcTally(p, o, pips(p, now, n, moved, moved ? t.daub[p] : null));
  };
  const win = mini.win ? (mini.winCells || null) : null;
  // The tray: the cage at its left, three places for the balls on their rail. Nothing drawn: Pick numbers over the empty
  // places (the move 'draw'); a draw playing: the cage turns and its balls roll out one by one into their places; drawn:
  // the balls, a tap calls one (ringed in the mover's colour while they can be tapped); a call playing: the one called
  // pops and flies to the tracker, the others drop away.
  const offer = s ? s.offer : dr ? dr.offer : view ? [] : (mini.offer || []);
  const open = !fb && !locked && !view;
  const cards = `<div class="bgwrap"><div class="bgcards">${card(mini, 'X', s, t, win, fb ? [] : offer)}${card(mini, 'O', s, t, win, fb ? [] : offer)}</div></div>`;
  const balls = offer.map((v, k) => (dr ? ball(mini, v, k, 'bgout', false, `;--t:${td.balls[k]}ms;--d:${td.lands[k] - td.balls[k]}ms`) : ball(mini, v, k, s ? (k === s.k ? 'bgpick' : 'bgdim') : open ? 'go' : '', open)));
  while (balls.length < 3) balls.push('<span class="bgslot"></span>');   // (the tray keeps its shape when fewer numbers are left)
  const pick = !offer.length && !view ? `<button class="bgdraw" data-act="move" ${mv(BINGO_DRAW)}${open && bingoPool(mini).length ? '' : ' disabled'}>Pick numbers</button>` : '';
  const left = bingoPool(mini).length, drawn = bingoDrawn(mini), by = fb ? fb.by : turn;
  const res = s ? `<p ${lateAt('arcres ' + (s.won.X || s.won.O ? 'line' : s.hit.X >= 0 || s.hit.O >= 0 ? '' : 'no'), s.won.X || s.won.O ? t.line : t.land)} role="status">${bingoWords(s)}</p>`
    : dr ? `<p class="arcnote"><b class="${dr.by}">${N(dr.by)}</b> picks numbers</p>`
    : (view || d) && l ? `<p class="arcnote"><b class="${l.by}">${N(l.by)}</b> called ${l.n}</p>`
    : `<p class="arcnote">${view ? '' : locked ? waitLine(turn) : `<b class="${turn}">${N(turn)}</b>'s ${drawn ? 'call' : 'turn'} · ${left} number${left === 1 ? '' : 's'} left`}</p>`;
  g = `<div class="g-arc g-bingo pc-${by === 'O' ? 'O' : 'X'}"><div class="ctals">${tal('X')}${tal('O')}</div>
      ${cards}
      ${tracker(mini, s, t)}
      <div class="bgtray${s ? ' playing' : ''}"${s ? ` style="--p:${BINGOT.press}ms"` : ''}>${cage(!!dr, td)}<div class="bgballs">${balls.join('')}${pick}</div></div>
      ${res}</div>`;
  return g;
}
export function moveText(f, who) {
  const a = f.bingo;
  if (!a) return `${who} called`;
  if (a.draw) return `${who} picked numbers`;
  return `${who} called ${a.n}`;
}
// A call: the ball pops as it is pressed; the mark plops onto each card the number is on as it lands, the second card a
// beat after the first (a thud where it is on none); a complete line lights cell by cell, each a note higher, and
// sparkles as it is struck through (a tie: both lines, then a thud).
// A draw: the cage rattles as it turns, each ball clacks out of the spout as it leaves and clicks into its place.
const RISE = [1, 1.12, 1.26, 1.41, 1.5];
export function sounds(f, add, won, mini, last) {
  const a = f.bingo;
  if (a && a.draw) { const td = bingoDrawTimes(a); add('bgCage', td.spin); td.balls.forEach((ms, k) => { add('bgBall', ms); add('diceTap', td.lands[k]); }); return; }
  add('pop', 0);
  if (!a) return;
  const t = bingoTimes(a);
  if (t.daub.X == null && t.daub.O == null) { add('thud', t.land); return; }
  for (const p of ['X', 'O']) if (t.daub[p] != null) add('plop', t.daub[p]);
  const lined = a.won.X || a.won.O;
  if (!lined) return;
  for (let k = 0; k < a.size; k++) add('point', t.line + k * BINGOT.step, RISE[Math.min(k, RISE.length - 1)]);
  add(a.won.X && a.won.O ? 'thud' : 'sparkle', t.strike);
}
// The miniature: the two cards side by side, tiny, as they are on the screen: a header band in the owner's colour with
// their drawn mark (an X or an O, no text: both cards are public), the grid under it with each called number daubed in
// its owner's colour; a complete line ringed in gold and struck through, the other card stepping back.
export function miniature(mini, final) {
  const n = sizeOf(mini), c = 10, gap = 1.6, w = n * c + (n - 1) * gap, f = 2.4, hd = 8, cw = w + 2 * f, ch = hd + w + 2 * f, W = 2 * cw + 6, H = ch + 2;
  const win = mini.win ? (mini.winCells || []) : null, lines = linesOf(mini);
  const cardSvg = (p, x0) => {
    const marks = bingoMarks(mini, p), won = !!win && mini.win === p, cells = [], gx = x0 + f, gy = 1 + hd + f, mid = i => [gx + (i % n) * (c + gap) + c / 2, gy + Math.floor(i / n) * (c + gap) + c / 2];
    for (let i = 0; i < n * n; i++) {
      const [x, y] = mid(i);
      cells.push(`<rect class="tbgc${won && win.includes(i) ? ' win' : ''}" x="${(x - c / 2).toFixed(1)}" y="${(y - c / 2).toFixed(1)}" width="${c}" height="${c}" rx="2.2"/>${marks[i] ? `<circle class="tbgd" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.7"/>` : ''}`);
    }
    const strike = won ? lines.filter(l => l.every(i => win.includes(i))).map(l => { const [x1, y1] = mid(l[0]), [x2, y2] = mid(l[n - 1]), d = `M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`; return `<path class="tbgs o" d="${d}"/><path class="tbgs i" d="${d}"/>`; }).join('') : '';
    return `<g class="tbgk ${p}${won ? ' won' : win ? ' lost' : ''}"><rect class="tbgf" x="${x0}" y="1" width="${cw.toFixed(1)}" height="${ch.toFixed(1)}" rx="3.4"/><path class="tbgb" d="M${x0} ${1 + hd}h${cw.toFixed(1)}v${(ch - hd - 3.4).toFixed(1)}a3.4 3.4 0 0 1 -3.4 3.4h${(-(cw - 6.8)).toFixed(1)}a3.4 3.4 0 0 1 -3.4 -3.4z"/>
      <g class="tbgl ${p}" transform="translate(${(x0 + cw / 2).toFixed(1)} ${1 + hd / 2})">${markSvgG(p, 2.7)}</g>${cells.join('')}${strike}</g>`;
  };
  const best = p => bingoBest(mini, p);
  return `<svg class="tbingo" viewBox="0 0 ${W.toFixed(1)} ${H.toFixed(1)}" aria-label="Bingo: X's best line ${best('X')} of ${n}, O's ${best('O')} of ${n}">${cardSvg('X', 1)}${cardSvg('O', cw + 5)}</svg>`;
}
