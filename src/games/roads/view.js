// Roads: the screen, the miniature, the move's words and sounds, and the inputs.
import { PLACE_MS } from '../shared/placement.js';
import { roadGeom, roadLongest, setRoadsConfig } from './rules.js';
import { FIREBASE_CONFIG, configured } from '../../net/connect.js';
import { KEY } from '../../ui/config.js';
import { N, mv, state } from '../../ui/app.js';
import { arcTally, lateAt } from '../../ui/progress.js';

// The honeycomb's size for new squares (config/roads, the admin's dashboard): read at every start, kept for the next visit.
const ROADS_KEY = KEY + '.roadscfg';
export function fetchRoadsConfig() {
  try { const v = JSON.parse(localStorage.getItem(ROADS_KEY) || 'null'); if (v && typeof v === 'object') setRoadsConfig(v); } catch (e) { /* none kept */ }
  if (!configured()) return;
  const hook = window.TTT_FIREBASE, c = (hook && hook.config) || FIREBASE_CONFIG;
  const url = hook && hook.emulator ? `http://${hook.emulator.host}:${hook.emulator.port}/config/roads.json?ns=${c.projectId}-default-rtdb` : `${c.databaseURL}/config/roads.json`;
  try {
    fetch(url).then(r => (r.ok ? r.json() : null)).then(v => {
      if (!v || typeof v !== 'object') return;
      setRoadsConfig(v);
      try { localStorage.setItem(ROADS_KEY, JSON.stringify(v)); } catch (e) { /* no storage: read again next visit */ }
    }).catch(() => {});
  } catch (e) { /* offline: as last known */ }
}
// Roads: a honeycomb (7 hexagons, or the admin's smaller 4), its corners and the edges between them (an older
// square: 4x4 dots and their 24 lines). A tap on an open edge is the move: it draws in, then a random open
// edge is blocked. Each player's longest road glows.
function roadTable(mini, a, o) {
  const rd = a && a.road ? a.road : null, turn = o.turn, segs = mini.segs, G = roadGeom(segs), ROAD_SEGS = G.segs, ROAD_PT = v => G.pts[v];
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
  const hits = o.locked ? '' : segs.map((w, k) => (w ? '' : line(k, 'rhit', ` data-act="move" ${mv(k)} role="button" tabindex="0" aria-label="Edge ${k + 1}"`))).join('');
  const dots = G.pts.map(([x, y]) => `<circle class="rdot" cx="${x}" cy="${y}" r="${G.cells.length ? 2.2 : 2.6}"/>`).join('');
  const comb = G.cells.map(c => `<polygon class="rcell" points="${c.map(v => G.pts[v].join(',')).join(' ')}"/>`).join('');   // the hexagons' faces, under everything
  const res = rd ? `<p ${lateAt('arcres ok', PLACE_MS.mark)} role="status">${N(a.by)}'s road: ${best[a.by].len}</p>`
    : `<p class="arcnote">${o.view ? '' : o.locked ? `Waiting for <b class="${turn}">${N(turn)}</b>…` : ''}</p>`;
  return `<div class="g-arc"><div class="ctals">${tal('X')}${tal('O')}</div><div class="roads"><svg class="rmap${G.cells.length ? ' comb' : ''}" viewBox="0 0 100 100" role="group" aria-label="The roads">${comb}${glow}${lines}${dots}${hits}</svg>${res}</div></div>`;
}
export function miniature(mini, final) {
  const G = roadGeom(mini.segs), order = mini.segs.map((w, k) => k).sort((j, k) => (mini.segs[j] === 'X' || mini.segs[j] === 'O') - (mini.segs[k] === 'X' || mini.segs[k] === 'O'));   // (the roads drawn last: never under a blocked edge)
  return `<svg class="troad${G.cells.length ? ' comb' : ''}" viewBox="0 0 100 100" aria-hidden="true">${order.map(k => { const w = mini.segs[k], [p, q] = G.segs[k].map(v => G.pts[v]); return `<line class="${w || ''}" x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}"/>`; }).join('')}</svg>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = roadTable(mini, a, { view, locked, turn, zoom: state.zoom, done: !!d }); return g;
}
export function moveText(f, who) {
  return `${who} claimed an edge`;
}
export function sounds(f, add, won, mini, last) {
  if (f.road) { add('pieceSlide', 0); if (f.road.block != null) add('knock', PLACE_MS.mark + PLACE_MS.drop - 150); } return;
}
