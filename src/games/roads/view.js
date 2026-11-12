// Roads: the screen, the miniature, the move's words and sounds, and the inputs.
import { PLACE_MS } from '../shared/placement.js';
import { roadGeom, roadLongest, setRoadsConfig } from './rules.js';
import { FIREBASE_CONFIG, configured } from '../../net/connect.js';
import { KEY } from '../../ui/config.js';
import { N, isYou, mv, state, waitLine } from '../../ui/app.js';
import { arcTally, lateAt } from '../../ui/progress.js';
import { thumbArt } from '../../ui/thumbs.js';

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
// square: 4x4 dots and their 24 lines). A tap on an open edge is the move: the road is laid from the end that joins
// the mover's roads (land: its click, the count by the name turning over, the longest road's glow reaching it), then
// a barrier drops across a random open edge (block: its knock). Each player's longest road glows; the last road laid
// carries a centre line, the last barrier stands bright (the older ones greyed). A square won: a light runs along the winner's road,
// an edge every `step` (`run` after the move's last piece is down), each with its note.
// The move's moments (ms from the move, at the game's pace; the stylesheet's Roads figures are the same ones), inside rules.js flashMs.
export const ROAD_T = { land: PLACE_MS.mark, block: PLACE_MS.mark + PLACE_MS.drop - 150, run: 120, step: 70, span: 560 };
const runFrom = blocked => (blocked ? ROAD_T.block : ROAD_T.land) + ROAD_T.run;   // the light sets off once the last piece of the move is down
const runStep = n => Math.min(ROAD_T.step, ROAD_T.span / Math.max(1, n));   // (a long road: the light keeps to the same span)
// The longest roads before the move (the mover's without the edge just laid; the other's as it is: a barrier takes only open edges).
function roadBefore(segs, rd, by, best) {
  if (!rd || (by !== 'X' && by !== 'O')) return best;
  const s0 = segs.slice(); s0[rd.seg] = null;
  return Object.assign({}, best, { [by]: roadLongest(s0, by) });
}
function roadTable(mini, a, o) {
  const rd = a && a.road ? a.road : null, turn = o.turn, segs = mini.segs, G = roadGeom(segs), ROAD_SEGS = G.segs, ROAD_PT = v => G.pts[v];
  const best = { X: roadLongest(segs, 'X'), O: roadLongest(segs, 'O') }, was = roadBefore(segs, rd, a && a.by, best);
  const other = p => (p === 'X' ? 'O' : 'X'), lead = (b, p) => b[p].len > b[other(p)].len;
  const winner = rd && o.fresh && a.winner ? a.winner : null, blocks = rd ? [rd.block].concat(rd.more || []).filter(k => k != null) : [];
  const runAt = runFrom(blocks.length);
  // each player's longest road by their name, on the leader's colour (the move's change turning over as the road lands)
  const chip = (p, b, cls = '', st = '') => `<b class="rlen${lead(b, p) ? ' lead' : ''}${cls}"${st}>${b[p].len}</b>`;
  const tal = p => arcTally(p, o, `<span class="rtl" aria-label="longest road ${best[p].len}"><small>road</small><span class="rlenw">${rd && (was[p].len !== best[p].len || lead(was, p) !== lead(best, p)) ? chip(p, was, ' tu', ` style="--u:${ROAD_T.land}ms"`) + chip(p, best, ' tf', ` style="--f:${ROAD_T.land}ms"`) : chip(p, best)}</span></span>`);
  const line = (k, cls, extra = '', flip = false) => { const e = ROAD_SEGS[k].map(ROAD_PT), [p, q] = flip ? [e[1], e[0]] : e; return `<line class="${cls}" x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}"${extra}/>`; };
  const glow = ['X', 'O'].map(p => best[p].segs.map(k => { const fresh = rd && !was[p].segs.includes(k); return line(k, `rglow ${p}${fresh ? ' in' : ''}`, fresh ? ` style="--t:${ROAD_T.land}ms"` : ''); }).join('')).join('');
  // the edge just laid is drawn from the end that touches the mover's other roads (else from its first corner)
  const joins = (k, v) => ROAD_SEGS.some((e, j) => j !== k && segs[j] === segs[k] && e.includes(v));
  const flip = rd && segs[rd.seg] && !joins(rd.seg, ROAD_SEGS[rd.seg][0]) && joins(rd.seg, ROAD_SEGS[rd.seg][1]);
  // In layers, whatever the order of the lines: open ones at the bottom, then the blocked ones and their barriers,
  // then the roads' outlines, then the roads themselves, so a barrier never covers red or yellow, even where they meet.
  const open = [], blocked = [], cases = [], roads = [];
  const lastSeg = mini.last ? mini.last.seg : null, lastBlocks = mini.last ? [mini.last.block].concat(mini.last.more || []) : [];
  segs.forEach((w, k) => {
    if (!w) { open.push(line(k, 'rseg open')); return; }
    if (w === 'B') {
      const [p, q] = ROAD_SEGS[k].map(ROAD_PT), mx = +((p[0] + q[0]) / 2).toFixed(2), my = +((p[1] + q[1]) / 2).toFixed(2), ang = +(Math.atan2(q[1] - p[1], q[0] - p[0]) * 180 / Math.PI).toFixed(1), n = blocks.indexOf(k), drop = n >= 0;
      blocked.push(`<g class="rblk${drop ? ' drop' : ''}${lastBlocks.includes(k) ? ' last' : ''}"${drop ? ` style="--t:${ROAD_T.land + n * 60}ms"` : ''}>${line(k, 'rseg B')}<g transform="translate(${mx} ${my}) rotate(${ang})"><g class="rgate"><rect x="-1.7" y="-4.3" width="3.4" height="8.6" rx="1"/><path d="M-1.7 -2.5L1.7 -.9M-1.7 .4L1.7 2"/></g></g></g>`);
      return;
    }
    const dr = rd && rd.seg === k, f = dr && flip;
    cases.push(line(k, `rcase${dr ? ' draw' : ''}`, dr ? ' pathLength="1"' : '', f)); roads.push(line(k, `rseg ${w}${dr ? ' draw' : ''}`, dr ? ' pathLength="1"' : '', f));
    if (k === lastSeg) roads.push(line(k, `rnew${dr ? ' in' : ''}`, dr ? ` style="--t:${ROAD_T.land}ms"` : ''));
  });
  const lines = open.join('') + blocked.join('') + cases.join('') + roads.join('');
  const hits = o.locked ? '' : segs.map((w, k) => (w ? '' : line(k, 'rhit', ` data-act="move" ${mv(k)} role="button" tabindex="0" aria-label="Edge ${k + 1}"`))).join('');
  const ends = rd && segs[rd.seg] ? (flip ? ROAD_SEGS[rd.seg].slice().reverse() : ROAD_SEGS[rd.seg]) : [];   // the new road's corners: each pops as the road leaves or reaches it
  const dots = G.pts.map(([x, y], v) => { const e = ends.indexOf(v); return `<circle class="rdot${e >= 0 ? ' pop' : ''}"${e >= 0 ? ` style="--t:${e ? ROAD_T.land - 60 : 0}ms"` : ''} cx="${x}" cy="${y}" r="${G.cells.length ? 2.2 : 2.6}"/>`; }).join('');
  const comb = G.cells.map(c => `<polygon class="rcell" points="${c.map(v => G.pts[v].join(',')).join(' ')}"/>`).join('');   // the hexagons' faces, under everything
  const shine = winner ? best[winner].segs.map((k, j, all) => line(k, 'rshine', ` style="--t:${Math.round(runAt + j * runStep(all.length))}ms"`)).join('') : '';
  const say = !rd ? '' : a.note === 'tie' ? `${best.X.len} each` : winner ? `${N(winner)} ${isYou(winner) ? 'have' : 'has'} the longest road` : `${isYou(a.by) ? 'Your' : `${N(a.by)}'s`} road: ${best[a.by].len}`;
  const res = rd ? `<p ${lateAt('arcres ok', ROAD_T.land)} role="status">${say}</p>`
    : `<p class="arcnote">${o.view ? '' : o.locked ? waitLine(turn) : ''}</p>`;
  return `<div class="g-arc"><div class="ctals">${tal('X')}${tal('O')}</div><div class="roads"><svg class="rmap${G.cells.length ? ' comb' : ''}${o.locked ? '' : ' go t' + turn}" viewBox="0 0 100 100" role="group" aria-label="The roads">${comb}${glow}${lines}${dots}${shine}${hits}</svg>${res}</div></div>`;
}
// The miniature: the honeycomb with both players' roads (each one's longest the widest) and the barriers' edges
// faint, and beside it each player's longest road as a number by their mark.
export function miniature(mini, final) {
  const G = roadGeom(mini.segs), best = { X: roadLongest(mini.segs, 'X'), O: roadLongest(mini.segs, 'O') };
  const order = mini.segs.map((w, k) => k).sort((j, k) => (mini.segs[j] === 'X' || mini.segs[j] === 'O') - (mini.segs[k] === 'X' || mini.segs[k] === 'O'));   // (the roads drawn last: never under a blocked edge)
  const art = `<svg class="troad${G.cells.length ? ' comb' : ''}" viewBox="0 0 100 100" aria-hidden="true">${G.cells.map(c => `<polygon points="${c.map(v => G.pts[v].join(',')).join(' ')}"/>`).join('')}${order.map(k => { const w = mini.segs[k], [p, q] = G.segs[k].map(v => G.pts[v]); return `<line class="${w || ''}${(w === 'X' || w === 'O') && best[w].segs.includes(k) ? ' top' : ''}" x1="${p[0]}" y1="${p[1]}" x2="${q[0]}" y2="${q[1]}"/>`; }).join('')}</svg>`;
  const rows = ['X', 'O'].map(p => `<div class="tr ${p}"><b class="${p}">${p}</b><span class="trdn">${best[p].len}</span></div>`).join('');
  return thumbArt(art, rows, 'troadw', `Roads: X's longest road ${best.X.len}, O's ${best.O.len}`);
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = roadTable(mini, a, { view, locked, turn, zoom: state.zoom, done: !!d, fresh }); return g;
}
export function moveText(f, who) {
  return `${who} claimed an edge`;
}
// The road sliding out and its click as it reaches the far corner (the result, so the buzz: listed last, the one
// ui/haptics.js takes), a rising blip when it made the mover's longest road longer, each barrier's knock, and on a
// square won a note an edge as the light runs along the road.
export function sounds(f, add, won, mini, last) {
  if (!f.road) return;
  add('pieceSlide', 0);
  const segs = mini && mini.type === 'roads' && Array.isArray(mini.segs) ? mini.segs : null, by = f.by;
  const blocks = [f.road.block].concat(f.road.more || []).filter(k => k != null);
  blocks.forEach((_, n) => add('knock', ROAD_T.block + n * 60));
  if (won && segs && f.winner) { const n = roadLongest(segs, f.winner).len, t0 = runFrom(blocks.length); for (let j = 0; j < n; j++) add('pathNote', Math.round(t0 + j * runStep(n)), Math.pow(2, Math.min(j, 12) / 12)); }
  const best = segs && (by === 'X' || by === 'O') ? roadLongest(segs, by) : null;
  if (best && best.len > roadBefore(segs, f.road, by, { [by]: best })[by].len) add('point', ROAD_T.land + 70);
  add('domClick', ROAD_T.land);
}
