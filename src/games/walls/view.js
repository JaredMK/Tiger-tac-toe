// Wall Race: the screen, the miniature, the move's words and sounds.
// The board is a grid of squares with a gap between them for the walls. X's far side is the top (a band in X's colour
// there), O's the bottom. On your turn the squares your pawn can step to carry a dot (a button each), and, while you
// have walls, every gap between two squares is a button: a wall goes down there, two squares long, running on to the
// right or downwards (back the other way at the board's edge); a gap where no wall may go is not a button. A step:
// the pawn slides (WALLS.step); a wall drops in (WALLS.wall). Pawns may share a square, side by side.
import { WALLS, wallFits, wallGoal, wallSteps } from './rules.js';
import { mv } from '../../ui/app.js';
import { arcTally } from '../../ui/progress.js';
import { tok } from '../../ui/tok.js';

export const ownLine = true;
const wallPips = (p, n, total) => `<span class="wlpips" aria-label="${n} walls left">${Array.from({ length: total }, (_, k) => `<i class="${k < n ? 'on' : ''}"></i>`).join('')}</span>`;
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  const n = mini.n, s = a && a.wr ? a.wr : null, o = { view, locked, turn }, live = !view && !locked;
  const total = Math.max(mini.left.X + mini.walls.length, mini.left.O + mini.walls.length, 1), each = Math.max(mini.left.X, mini.left.O, Math.ceil(mini.walls.length / 2) + Math.min(mini.left.X, mini.left.O));
  const tal = p => arcTally(p, o, wallPips(p, mini.left[p], Math.min(6, Math.max(each, mini.left[p]))));
  const steps = live ? wallSteps(mini, turn) : [], canWall = live && mini.left[turn] > 0;
  let out = '';
  const gp = (r, c) => `grid-row:${r};grid-column:${c}`;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const who = ['X', 'O'].filter(p => mini.at[p][0] === r && mini.at[p][1] === c), step = steps.some(q => q[0] === r && q[1] === c);
    const toks = who.map(p => { const moved = s && !s.wall && a.by === p; return `<i class="wlmv${moved ? ' slide' : ''}"${moved ? ` style="--dx:${s.from[1] - c};--dy:${s.from[0] - r}"` : ''}>${tok(p)}</i>`; }).join('');
    const cls = `wlc${r === 0 ? ' gx' : ''}${r === n - 1 ? ' go' : ''}${who.length > 1 ? ' two' : ''}`;
    out += step ? `<button class="${cls} way ${turn}" style="${gp(2 * r + 1, 2 * c + 1)}" data-act="move" ${mv({ s: [r, c] })} aria-label="Step to row ${r + 1}, column ${c + 1}">${toks}<i class="wldot"></i></button>` : `<div class="${cls}" style="${gp(2 * r + 1, 2 * c + 1)}">${toks}</div>`;
  }
  // the gaps: a wall goes down from the gap tapped (on along the row or down the column; at the last one, back)
  if (canWall) {
    for (let r = 0; r < n - 1; r++) for (let c = 0; c < n; c++) { const wc = Math.min(c, n - 2); if (wallFits(mini, 'h', r, wc)) out += `<button class="wlg h ${turn}" style="${gp(2 * r + 2, 2 * c + 1)}" data-act="move" ${mv({ w: ['h', r, wc] })} aria-label="Wall under row ${r + 1}, column ${c + 1}"></button>`; }
    for (let r = 0; r < n; r++) for (let c = 0; c < n - 1; c++) { const wr = Math.min(r, n - 2); if (wallFits(mini, 'v', wr, c)) out += `<button class="wlg v ${turn}" style="${gp(2 * r + 1, 2 * c + 2)}" data-act="move" ${mv({ w: ['v', wr, c] })} aria-label="Wall right of row ${r + 1}, column ${c + 1}"></button>`; }
  }
  for (const [o2, r, c] of mini.walls) { const fresh1 = s && s.wall && s.wall[0] === o2 && s.wall[1] === r && s.wall[2] === c; out += `<i class="wlw ${o2}${fresh1 ? ' new' : ''}" style="${o2 === 'h' ? `grid-row:${2 * r + 2};grid-column:${2 * c + 1} / span 3` : `grid-column:${2 * c + 2};grid-row:${2 * r + 1} / span 3`}"></i>`; }
  const line = `<p class="wlline"></p>`;
  return `<div class="g-wl pc-${s ? a.by : turn}" style="--ts:${WALLS.step}ms;--tw:${WALLS.wall}ms"><div class="ctals">${tal('X')}${tal('O')}</div><div class="wlbox"><div class="wlgrid" style="--n:${n}">${out}</div></div>${line}</div>`;
}
// The miniature: the board from above with its walls and the two pawns.
export function miniature(mini, final) {
  const n = mini.n, u = 60 / n; let out = `<rect class="twlb" x="1" y="1" width="58" height="58" rx="5"/><rect class="twlx" x="3" y="3" width="54" height="${(u * 0.3).toFixed(1)}"/><rect class="twlo" x="3" y="${(57 - u * 0.3).toFixed(1)}" width="54" height="${(u * 0.3).toFixed(1)}"/>`;
  for (let k = 1; k < n; k++) out += `<path class="twll" d="M${(k * u).toFixed(1)} 3V57M3 ${(k * u).toFixed(1)}H57"/>`;
  for (const [o, r, c] of mini.walls) out += o === 'h' ? `<path class="twlw" d="M${(c * u + 2).toFixed(1)} ${((r + 1) * u).toFixed(1)}H${((c + 2) * u - 2).toFixed(1)}"/>` : `<path class="twlw" d="M${((c + 1) * u).toFixed(1)} ${(r * u + 2).toFixed(1)}V${((r + 2) * u - 2).toFixed(1)}"/>`;
  const same = mini.at.X[0] === mini.at.O[0] && mini.at.X[1] === mini.at.O[1];
  for (const p of ['X', 'O']) out += `<circle class="twlp ${p}" cx="${((mini.at[p][1] + 0.5) * u + (same ? (p === 'X' ? -u * 0.18 : u * 0.18) : 0)).toFixed(1)}" cy="${((mini.at[p][0] + 0.5) * u).toFixed(1)}" r="${(u * 0.3).toFixed(1)}"/>`;
  return `<div class="twl" aria-label="Wall Race: X ${mini.at.X[0] - wallGoal(n, 'X')} rows from home, O ${wallGoal(n, 'O') - mini.at.O[0]}"><svg viewBox="0 0 60 60" aria-hidden="true">${out}</svg></div>`;
}
export function moveText(f, who) { const l = f.wr; return l && l.wall ? `${who} placed a wall` : `${who} stepped`; }
// A step's tap as the pawn lands; a wall's block dropping in.
export function sounds(f, add, won, mini, last) { const l = f.wr; if (!l) return; if (l.wall) add('wlWall', WALLS.wall * 0.6); else add('wlStep', WALLS.step); }
