// Roads: the screen, the miniature, the move's words and sounds, and the inputs.
import { PLACE_MS } from '../shared/placement.js';
import { ROAD_SEGS, roadLongest } from './rules.js';
import { N, mv, state } from '../../ui/app.js';
import { arcTally, lateAt } from '../../ui/progress.js';

// Roads: 4x4 dots and the 24 lines between them. A tap on an open line is the move: it draws in, then a
// random open line is blocked. Each player's longest road glows.
const ROAD_PT = v => [10 + (v % 4) * 80 / 3, 10 + Math.floor(v / 4) * 80 / 3].map(n => +n.toFixed(2));
function roadTable(mini, a, o) {
  const rd = a && a.road ? a.road : null, turn = o.turn, segs = mini.segs;
  const best = { X: roadLongest(segs, 'X'), O: roadLongest(segs, 'O') };
  const tal = p => arcTally(p, o, `<small>road ${best[p].len}</small>`);
  const line = (k, cls, extra = '') => { const [p, q] = ROAD_SEGS[k].map(ROAD_PT); return `<line class="${cls}" x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}"${extra}/>`; };
  const glow = ['X', 'O'].map(p => best[p].segs.map(k => line(k, 'rglow ' + p, rd ? ` style="--t:${PLACE_MS.mark}ms"` : '')).join('')).join('');
  // In layers, whatever the order of the lines: open ones at the bottom, then the blocked (grey) ones, then the
  // roads' outlines, then the roads themselves, so grey never covers red or yellow, even where they meet.
  const open = [], blocked = [], cases = [], roads = [];
  segs.forEach((w, k) => {
    if (!w) { open.push(line(k, 'rseg open')); return; }
    if (w === 'B') { const [p, q] = ROAD_SEGS[k].map(ROAD_PT), mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2, drop = rd && rd.block === k; blocked.push(`<g class="rblk${drop ? ' drop' : ''}"${drop ? ` style="--t:${PLACE_MS.mark}ms"` : ''}>${line(k, 'rseg B')}<g transform="translate(${mx} ${my})"><path class="rx" d="M-3 -3L3 3M3 -3L-3 3"/></g></g>`); return; }
    const dr = rd && rd.seg === k;
    cases.push(line(k, `rcase${dr ? ' draw' : ''}`, dr ? ' pathLength="1"' : '')); roads.push(line(k, `rseg ${w}${dr ? ' draw' : ''}`, dr ? ' pathLength="1"' : ''));
  });
  const lines = open.join('') + blocked.join('') + cases.join('') + roads.join('');
  const hits = o.locked ? '' : segs.map((w, k) => (w ? '' : line(k, 'rhit', ` data-act="move" ${mv(k)} role="button" tabindex="0" aria-label="Line ${k + 1}"`))).join('');
  const dots = Array.from({ length: 16 }, (_, v) => { const [x, y] = ROAD_PT(v); return `<circle class="rdot" cx="${x}" cy="${y}" r="2.6"/>`; }).join('');
  const res = rd ? `<p ${lateAt('arcres ok', PLACE_MS.mark)} role="status">${N(a.by)}'s road: ${best[a.by].len}</p>`
    : `<p class="arcnote">${o.view ? '' : o.locked ? `Waiting for <b class="${turn}">${N(turn)}</b>…` : ''}</p>`;
  return `<div class="g-arc"><div class="ctals">${tal('X')}${tal('O')}</div><div class="roads"><svg class="rmap" viewBox="0 0 100 100" role="group" aria-label="The roads">${glow}${lines}${dots}${hits}</svg>${res}</div></div>`;
}
export function miniature(mini, final) {
  return `<svg class="troad" viewBox="0 0 100 100" aria-hidden="true">${mini.segs.map((w, k) => { const [p, q] = ROAD_SEGS[k].map(ROAD_PT); return `<line class="${w || ''}" x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}"/>`; }).join('')}</svg>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = roadTable(mini, a, { view, locked, turn, zoom: state.zoom, done: !!d }); return g;
}
export function moveText(f, who) {
  return `${who} claimed a line`;
}
export function sounds(f, add, won, mini, last) {
  if (f.road) { add('pieceSlide', 0); if (f.road.block != null) add('knock', PLACE_MS.mark + PLACE_MS.drop - 150); } return;
}
