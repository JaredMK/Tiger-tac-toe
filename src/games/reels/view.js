// Fruit Reels: the screen, the miniature, the move's words and sounds.
// The machine: three reels in a cabinet, each showing three pictures (a 3x3 window), a pay strip under them (what three
// alike on a line score), a reserved result line and the big Spin. A spin: each reel runs its strip down and stops left
// to right (REELS.stop); then the verdict (REELS.judge): each winning line is drawn across the window one after the
// other (REELS.line), its pictures lit, the words say what was made, the score counts on. The five lines: the three rows
// and the two diagonals. The pictures are original drawings (a pair of cherries, a lemon, a bell, a star). Timed from
// the move (rules.js REELS).
import { LINES, REELS, reelsCfg, reelsShowMs } from './rules.js';
import { mv } from '../../ui/app.js';
import { lateAt } from '../../ui/progress.js';
import { thumbArt } from '../../ui/thumbs.js';
import { barRows, ptsTally } from '../../ui/tok.js';

export const ownLine = true;
export const hold = f => (f.rl3 && f.rl3.wins ? Math.max(0, f.rl3.wins.length - 1) * REELS.line : 0);
const ART = [
  '<path d="M20 5c-2 6-7 9-9 16M20 5c1 6 5 10 9 15" fill="none" stroke="#2e7d32" stroke-width="2.6" stroke-linecap="round"/><path d="M20 5c4-3 9-2 11 1-4 2-8 2-11-1z" fill="#43a047" stroke="#161210" stroke-width="1.6"/><circle cx="11" cy="27" r="8" fill="#e53935" stroke="#161210" stroke-width="2.4"/><circle cx="29" cy="26" r="8" fill="#e53935" stroke="#161210" stroke-width="2.4"/><path d="M7 24c1-2 3-3 5-3M25 23c1-2 3-3 5-3" stroke="#fff" stroke-width="2" stroke-linecap="round" fill="none"/>',
  '<path d="M4 21c1-9 9-15 17-14 5 0 8-3 11-2 3 2 4 6 3 10-1 9-8 17-18 17-5 0-8 2-11 0-3-3-3-7-2-11z" fill="#fdd835" stroke="#161210" stroke-width="2.4" stroke-linejoin="round"/><path d="M11 20c1-4 5-7 9-7" stroke="#fff" stroke-width="2.2" stroke-linecap="round" fill="none"/>',
  '<path d="M20 5c-7 0-11 5-11 13 0 6-3 8-5 11h32c-2-3-5-5-5-11 0-8-4-13-11-13z" fill="#ffb300" stroke="#161210" stroke-width="2.4" stroke-linejoin="round"/><circle cx="20" cy="33" r="3.4" fill="#8d6e63" stroke="#161210" stroke-width="2"/><path d="M14 14c1-3 3-5 6-5" stroke="#fff" stroke-width="2.2" stroke-linecap="round" fill="none"/><path d="M6 25h28" stroke="#161210" stroke-width="2"/>',
  '<path d="M20 3l4.9 10.6 11.6 1.3-8.6 7.9 2.4 11.4L20 28.400 9.700 34.200l2.400-11.400-8.600-7.900 11.600-1.300z" fill="#4fc3f7" stroke="#161210" stroke-width="2.4" stroke-linejoin="round"/><path d="M15 15l5-5" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>',
];
export const reelSvg = (k, cls) => `<svg class="frsym${cls ? ' ' + cls : ''}" viewBox="0 0 40 40" aria-hidden="true">${k == null || k < 0 ? '<text x="20" y="29" text-anchor="middle" class="frq">?</text>' : ART[k]}</svg>`;
const SPINS = 9;                                                  // the pictures a spinning reel runs past before its own three
const LINE_XY = [[[6, 50], [294, 50]], [[6, 150], [294, 150]], [[6, 250], [294, 250]], [[18, 18], [282, 282]], [[282, 18], [18, 282]]];   // each line across the window (a 300 by 300 box)
function words(s) {
  if (s.stars) return 'Three stars!';
  if (!s.wins.length) return 'No line';
  if (s.wins.length === 1) { const w = s.wins[0]; return `Three ${REELS.plural[w.sym]}! +${w.pts}`; }
  return `${s.wins.length} lines! +${s.pts}`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  const c = reelsCfg(mini), s = a && a.rl3 ? a.rl3 : null, o = { view, locked, turn }, by = s ? a.by : turn;
  if (mini.v !== 2) return '<div class="g-fr"><p class="frline">This square is from an older version.</p></div>';
  const rest = !s && (view || d) && mini.last ? mini.last : null;   // (the last spin on show once played: its lines stay lit)
  const shown = s ? s.g : rest ? rest.g : mini.grid[turn];
  const tal = p => ptsTally(p, o, c.target, mini.score[p], s && a.by === p ? s.from : null, s ? reelsShowMs(s) : 0);
  const lit = (s || rest) ? (s || rest).wins : [], litAt = new Map();   // each cell of a winning line: lit as its first line is drawn
  lit.forEach((w, k) => LINES[w.line].forEach(cell => { if (!litAt.has(cell)) litAt.set(cell, REELS.judge + k * REELS.line); }));
  const reel = col => {
    const cells = [0, 1, 2].map(r => r * 3 + col), hit = cells.map(i => litAt.has(i));
    const pic = (i, k) => `<span class="frcell${hit[k] ? (s ? ' hit late' : ' hit') : ''}"${hit[k] && s ? ` style="--th:${litAt.get(i)}ms"` : ''}>${reelSvg(shown ? shown[i] : null)}</span>`;
    if (!s) return `<div class="frreel">${cells.map(pic).join('')}</div>`;
    const before = s.was ? cells.map(i => s.was[i]) : [null, null, null];
    const run = Array.from({ length: SPINS }, (_, j) => (s.g[cells[2]] + 1 + j * 3 + col) % REELS.n);
    const n = 3 + SPINS + 3;
    return `<div class="frreel spin"><div class="frstrip" style="--n:${n};--t:${REELS.stop[col]}ms">${cells.map(pic).join('')}${run.map(k => `<span class="frcell">${reelSvg(k)}</span>`).join('')}${before.map(k => `<span class="frcell">${reelSvg(k)}</span>`).join('')}</div></div>`;
  };
  const lines = lit.length ? `<svg class="frlines" viewBox="0 0 300 300" preserveAspectRatio="none" aria-hidden="true">${lit.map((w, k) => { const [[x1, y1], [x2, y2]] = LINE_XY[w.line]; return `<line class="frln${s ? ' late' : ''}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" pathLength="1"${s ? ` style="--th:${REELS.judge + k * REELS.line}ms"` : ''}/>`; }).join('')}</svg>` : '';
  const pay = `<div class="frpay" role="img" aria-label="Three alike on a line: cherries ${c.tri[0]}, lemons ${c.tri[1]}, bells ${c.tri[2]}, stars ${c.stars ? 'win' : c.tri[3]}. Five lines: three rows and two diagonals."><span class="frl5"><b>5</b><i>lines</i></span>${[0, 1, 2].map(k => `<span>${reelSvg(k)}<b>×3</b><i>+${c.tri[k]}</i></span>`).join('')}<span>${reelSvg(3)}<b>×3</b><i>${c.stars ? 'WIN' : '+' + c.tri[3]}</i></span></div>`;
  const line = s ? `<p ${lateAt('frline ' + (s.wins.length ? 'ok' : 'no'), REELS.judge)} role="status">${words(s)}</p>` : `<p class="frline${rest ? (rest.wins.length ? ' ok' : ' no') : ''}">${rest ? words(rest) : ''}</p>`;
  const spin = view ? '' : `<button class="big ${turn} frspin" data-act="move" ${mv('spin')}${locked ? ' disabled' : ''}>Spin</button>`;
  return `<div class="g-fr pc-${by}" style="--tj:${REELS.judge}ms"><div class="ctals two">${tal('X')}${tal('O')}</div>
    <div class="frcab"><div class="frwin">${reel(0)}${reel(1)}${reel(2)}${lines}</div>${pay}</div>${line}${spin}</div>`;
}
// The miniature: the machine's 3x3 window with the last spin's pictures, over each player's points as a bar.
export function miniature(mini, final) {
  const c = reelsCfg(mini), g = mini.v === 2 && mini.last ? mini.last.g : null;
  const art = `<div class="tfr">${Array.from({ length: 9 }, (_, i) => `<i>${reelSvg(g ? g[i] : [0, 1, 2, 2, 3, 0, 1, 0, 2][i])}</i>`).join('')}</div>`;
  return thumbArt(art, barRows(mini.score, c.target), 'tfrw col', `Fruit Reels: X ${mini.score.X}, O ${mini.score.O} of ${c.target} points`);
}
export function moveText(f, who) {
  const s = f.rl3; if (!s || !s.wins) return `${who} spun`;
  return s.stars ? `${who} spun a line of stars` : !s.wins.length ? `${who} spun no line` : `${who} spun ${s.wins.length} line${s.wins.length === 1 ? '' : 's'} for ${s.pts}`;
}
// The reels' whirr, a clack as each one stops, then the verdict: a ding and a sparkle for each line as it is drawn
// (the stars: the sparkle first), a soft thud for nothing.
export function sounds(f, add, won, mini, last) {
  const s = f.rl3; if (!s || !s.wins) return;
  add('frSpin', 0);
  [0, 1, 2].forEach(k => add('frStop', REELS.stop[k], 0.9 + k * 0.08));
  if (!s.wins.length) add('thud', REELS.judge);
  else s.wins.forEach((w, k) => { add('ding', REELS.judge + k * REELS.line, 1 + k * 0.08); if (k === 0) add('sparkle', REELS.judge + 140); });
}
