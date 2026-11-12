// Hex: the screen, the miniature, the move's words and sounds, and the inputs.
import { hexNeighbors, hexSize } from './rules.js';
import { esc, mv } from '../../ui/app.js';

// The move's moments (ms from the move, at the game's pace; the stylesheet's .hxart figures are the same ones): the
// stone comes down onto its cell and lands with its click (land), squashes and settles (settle); a win: the line is
// drawn along the chain from one goal edge to the other, a cell every `step`, each stone hopping and sounding its
// note as the line reaches it. All of it inside rules.js flashMs (450, a win 900 + 90 a cell).
export const HEX_T = { land: 150, settle: 220, line: 400, step: 90 };

// ---- the board's drawing: one unit is a cell's width; rows are shifted half a cell to the right ----
const HH = 2 / Math.sqrt(3);                                        // a cell's height
const BAND = 0.28, INK = 0.07, PAD = BAND + INK + 0.04, SLAB = 0.12, CELL = 0.93, SMALL = 1.4;   // the goal edges' width, an ink line, the room round the board, the slab's depth, a cell inside its grid lines, the miniature's wider edges
const VERT = [[0, -0.5], [0.5, -0.25], [0.5, 0.25], [0, 0.5], [-0.5, 0.25], [-0.5, -0.25]];   // top, upper right, lower right, bottom, lower left, upper left
const num = v => String(+v.toFixed(3));
const seq = n => Array.from({ length: n }, (_, k) => k);
const ctr = (i, n) => { const r = Math.floor(i / n); return [i % n + r / 2 + 0.5, HH / 2 + 0.75 * HH * r]; };
const vert = (i, n, k) => { const [x, y] = ctr(i, n); return [x + VERT[k][0], y + VERT[k][1] * HH]; };
const poly = s => VERT.map(([x, y]) => `${num(x * s)},${num(y * HH * s)}`).join(' ');   // a cell's hexagon about its middle, scaled
const line = pts => 'M' + pts.map(([x, y]) => `${num(x)} ${num(y)}`).join('L');
const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
export const hexBox = n => ({ w: 1.5 * n - 0.5 + 2 * PAD, h: HH * (0.75 * n + 0.25) + 2 * PAD + SLAB, pad: PAD });
// The board's outline as its four goal edges: O's along the top and bottom rows, X's down the left and right columns.
// The side the two share at each sharp corner is split in the middle.
const FRAMES = {};
function frame(n) {
  if (FRAMES[n]) return FRAMES[n];
  const tr = n - 1, bl = (n - 1) * n, br = n * n - 1;
  const mT = mid(vert(tr, n, 0), vert(tr, n, 1)), mB = mid(vert(bl, n, 3), vert(bl, n, 4));
  const top = [vert(0, n, 5)]; for (let c = 0; c < n; c++) top.push(vert(c, n, 0), c < n - 1 ? vert(c, n, 1) : mT);
  const right = [mT]; for (let r = 0; r < n; r++) right.push(vert(r * n + tr, n, 1), vert(r * n + tr, n, 2));
  const bottom = [vert(br, n, 2)]; for (let c = n - 1; c >= 0; c--) bottom.push(vert(bl + c, n, 3), c ? vert(bl + c, n, 4) : mB);
  const left = [mB]; for (let r = n - 1; r >= 0; r--) left.push(vert(r * n, n, 4), vert(r * n, n, 5));
  const loop = line([...top, ...right.slice(1), ...bottom.slice(1), ...left.slice(1)]) + 'Z';
  const tick = (m, dx, dy) => line([m, [m[0] + dx * (BAND + INK), m[1] + dy * (BAND + INK)]]);
  // the two blunt corners (top left, bottom right), where an X edge turns into an O edge: each colour's wedge up to the mitre, on an ink one
  const wedge = (v, sx, w) => [v, [v[0] - sx * w, v[1]], [v[0] - sx * w, v[1] - sx * w / Math.sqrt(3)], [v[0] - sx * w / 2, v[1] - sx * w * 0.866]];
  const corner = (v, sx, k) => { const a = wedge(v, sx, (BAND + INK) * k), b = wedge(v, sx, BAND * k); return { ink: line(a) + 'Z', X: line([b[0], b[1], b[2]]) + 'Z', O: line([b[0], b[2], b[3]]) + 'Z' }; };
  const H = HH * (0.75 * n + 0.25), r0 = Math.ceil((n - 1) / 2), c0 = Math.floor((n - 1) / 2), cy = r => HH / 2 + 0.75 * HH * r;
  const chips = [['O', c0 + 0.5, -BAND / 2], ['O', n - 1 - c0 + (n - 1) / 2 + 0.5, H + BAND / 2], ['X', r0 / 2 - BAND / 2, cy(r0)], ['X', n + (n - 1 - r0) / 2 + BAND / 2, cy(n - 1 - r0)]];
  return (FRAMES[n] = { loop, O: [line(top), line(bottom)], X: [line(left), line(right)], ticks: tick(mT, 0.5, -0.866) + tick(mB, -0.5, 0.866), corners: k => [corner(vert(0, n, 5), 1, k), corner(vert(br, n, 2), -1, k)], chips });
}
// The chains (public: the stones on the board alone). Every pair of touching stones of one colour, and each side's
// best chain: the one reaching furthest across towards its own two edges (X columns, O rows; then the bigger), as a
// path from its near end to its far end. Purely for the eye: the rules know nothing of it.
export function hexChains(cells) {
  const n = hexSize(cells), links = [], best = {};
  for (let i = 0; i < cells.length; i++) if (cells[i]) for (const j of hexNeighbors(i, n)) if (j > i && cells[j] === cells[i]) links.push([i, j]);
  const seen = new Set();
  for (let s = 0; s < cells.length; s++) {
    const p = cells[s];
    if (!p || seen.has(s)) continue;
    const comp = [s]; seen.add(s);
    for (let q = 0; q < comp.length; q++) for (const j of hexNeighbors(comp[q], n)) if (cells[j] === p && !seen.has(j)) { seen.add(j); comp.push(j); }
    const along = i => (p === 'X' ? i % n : Math.floor(i / n));
    const lo = comp.reduce((a, b) => (along(b) < along(a) ? b : a)), hi = comp.reduce((a, b) => (along(b) > along(a) ? b : a));
    const span = along(hi) - along(lo) + 1;
    if (comp.length < 2 || (best[p] && (best[p].span > span || (best[p].span === span && best[p].size >= comp.length)))) continue;
    const from = new Map([[lo, -1]]), queue = [lo];               // the shortest way through the chain from its near end to its far end
    for (let q = 0; q < queue.length && !from.has(hi); q++) for (const j of hexNeighbors(queue[q], n)) if (cells[j] === p && !from.has(j)) { from.set(j, queue[q]); queue.push(j); }
    const path = []; for (let k = hi; k !== -1; k = from.get(k)) path.unshift(k);
    best[p] = { span, size: comp.length, cells: comp, path };
  }
  return { links, best };
}
const MARK = { X: '<path class="hxm" d="M-.15 -.15 .15 .15M.15 -.15 -.15 .15"/>', O: '<circle class="hxm" r=".135"/>' };
const LIP = `<polyline class="hxhi" points="${[5, 0, 1].map(k => `${num(VERT[k][0] * 0.78)},${num(VERT[k][1] * HH * 0.78)}`).join(' ')}"/><polyline class="hxlo" points="${[2, 3, 4].map(k => `${num(VERT[k][0] * 0.78)},${num(VERT[k][1] * HH * 0.78)}`).join(' ')}"/>`;
// The picture: the slab, the four goal edges in their players' colours with a chip of the mark on each, the cells, the
// stones (touching ones of a colour joined), the best chains' threads and the winning line. o: { anim (the cell just
// played, dropping in), last (ringed), win (the winning cells from edge to edge), fresh (the win just made), turn, small }.
function hexArt(cells, o) {
  const n = hexSize(cells), F = frame(n), B = hexBox(n), ch = hexChains(cells), at = i => { const [x, y] = ctr(i, n); return `translate(${num(x)} ${num(y)})`; };
  const win = o.win || [], wk = i => win.indexOf(i), isNew = i => o.anim === i;
  const stone = (i, inner, extra) => `<g transform="${at(i)}"><g class="hxs ${cells[i]}${isNew(i) ? ' drop' : ''}${wk(i) >= 0 ? ' win' + (o.fresh ? ' lit' : '') : ''}${extra || ''}"${wk(i) >= 0 && o.fresh ? ` style="--k:${wk(i)}"` : ''}>${inner}</g></g>`;
  const empty = seq(n * n).filter(i => !cells[i] || isNew(i)).map(i => `<g transform="${at(i)}"><polygon class="hxc" points="${poly(CELL)}"/>${o.small ? '' : `<polyline class="hxsk" points="${[5, 0, 1].map(k => `${num(VERT[k][0] * 0.8)},${num(VERT[k][1] * HH * 0.8)}`).join(' ')}"/>`}</g>`).join('');
  const links = ch.links.map(([i, j]) => `<path class="hxl ${cells[i]}${isNew(i) || isNew(j) ? ' new' : ''}" d="${line([ctr(i, n), ctr(j, n)])}"/>`).join('');
  const bodies = seq(n * n).filter(i => cells[i]).map(i => stone(i, `<polygon class="hxb" points="${poly(CELL)}"/>${o.small ? '' : i === o.last ? `<polygon class="hxring" points="${poly(0.76)}"/>` : LIP}`)).join('');
  const threads = o.small || win.length ? '' : ['X', 'O'].filter(p => ch.best[p]).map(p => `<path class="hxth ${p}${ch.best[p].cells.includes(o.anim) ? ' new' : ''}" d="${line(ch.best[p].path.map(i => ctr(i, n)))}"/>`).join('');
  const marks = o.small ? '' : seq(n * n).filter(i => cells[i]).map(i => stone(i, MARK[cells[i]], ' mk')).join('');
  const ring = Number.isInteger(o.anim) && cells[o.anim] ? `<g transform="${at(o.anim)}"><polygon class="hxwave ${cells[o.anim]}" points="${poly(CELL)}"/></g>` : '';
  let wline = '';
  if (win.length) {                                                 // the winning line: from the goal edge it starts at, through each stone's middle, out to the other edge
    const p = cells[win[0]], pts = win.map(i => ctr(i, n)), a = pts[0], z = pts[pts.length - 1], out = 0.5 + BAND * 0.55;
    const ends = p === 'X' ? [[a[0] - out, a[1]], [z[0] + out, z[1]]] : [[a[0], a[1] - out * HH], [z[0], z[1] + out * HH]];
    const d = `d="${line([ends[0], ...pts, ends[1]])}" pathLength="1"`;
    wline = `<g class="hxwl${o.fresh ? ' draw' : ''}" style="--n:${win.length}"><path class="hxwo" ${d}/><path class="hxwc" ${d}/></g>`;
  }
  const chips = o.small ? '' : F.chips.map(([p, x, y]) => `<g transform="translate(${num(x)} ${num(y)})"><g class="hxchip ${p}${o.turn === p ? ' turn' : ''}"><circle r=".2"/>${MARK[p]}</g></g>`).join('');
  const edge = (p, k) => `<path class="hxe ${p}" d="${F[p][k]}"/>`, corners = F.corners(o.small ? SMALL : 1), ink = corners.map(c => c.ink).join('');
  return `<svg class="hxart${o.small ? ' small' : ''}${Number.isInteger(o.anim) ? ' drop' : ''}" viewBox="${num(-PAD)} ${num(-PAD)} ${num(B.w)} ${num(B.h)}" aria-hidden="true">
<g class="hxslab" transform="translate(0 ${SLAB})"><path class="hxrim" d="${F.loop}"/><path class="hxwi" d="${ink}"/></g><path class="hxrim" d="${F.loop}"/><path class="hxwi" d="${ink}"/>${edge('O', 0)}${edge('O', 1)}${edge('X', 0)}${edge('X', 1)}${corners.map(c => `<path class="hxw X" d="${c.X}"/><path class="hxw O" d="${c.O}"/>`).join('')}<path class="hxtick" d="${F.ticks}"/><path class="hxbed" d="${F.loop}"/>
${empty}${links}${bodies}${threads}${wline}${marks}${ring}${chips}</svg>`;
}
export function miniature(mini, final) {
  return `<div class="thex">${hexArt(mini.cells, { small: true })}</div>`;
}
// The board (4x4; a square from before 5x5): the picture, and over it a button a cell (the mover's stone shows faintly
// under the finger).
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  const n = hexSize(mini.cells), B = hexBox(n), t = turn === 'O' ? 'O' : 'X';
  const win = mini.winCells ? mini.winCells.slice().reverse() : null;   // (the path as found runs from the far edge back: lit from the near one)
  const drop = Number.isInteger(anim) && mini.cells[anim] ? anim : null;
  const last = !view && !win && drop == null && Number.isInteger(mini.last) ? mini.last : -1;   // the stone played last (a finished square shows its line instead)
  const cells = seq(n * n).map(i => {
    const r = Math.floor(i / n), c = i % n, v = mini.cells[i];
    return `<button class="hexc ${v || ''}" style="--hx:${num(c + r / 2)};--hy:${num(0.75 * HH * r)}" data-act="move" ${mv(i)} aria-label="Row ${r + 1} cell ${c + 1}${v ? ', ' + esc(v) : ''}"${v || locked ? ' disabled' : ''}></button>`;
  }).join('');
  g = `<div class="g-hex t${t}${locked ? '' : ' open'}" style="--bw:${num(B.w)};--bh:${num(B.h)};--bp:${num(B.pad)}"><div class="hexstage${drop != null ? ' drop' : ''}">${hexArt(mini.cells, { anim: drop, last, win, fresh: !!fresh, turn: view || a ? null : t })}<div class="hexboard">${cells}</div></div></div>`;
  return g;
}
export function moveText(f, who) {
  return `${who} claimed a hex`;
}
export function sounds(f, add, won, mini, last) {
  add('hexPlace', HEX_T.land);                                      // the stone's click as it lands
  if (won) { const n = mini.winCells ? mini.winCells.length : 4; for (let k = 0; k < n; k++) add('pathNote', HEX_T.line + k * HEX_T.step, Math.pow(2, k / 12)); }   // a note a stone as the line runs along the chain
  return;
}
