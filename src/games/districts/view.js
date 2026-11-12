// Districts: the screen, the miniature, the move's words and sounds, and the inputs.
import { PLACE_MS } from '../shared/placement.js';
import { distTally, distTo } from './rules.js';
import { N, esc, isYou, mv, state, waitLine } from '../../ui/app.js';
import { arcTally, lateAt } from '../../ui/progress.js';
import { pipRows, thumbArt } from '../../ui/thumbs.js';

// Districts: the map's regions on a sheet, each shaded in its leader's colour (darker and sealed with a heavy outline
// once locked: the spots left cannot change its leader), and its spots; a spot on a border counts for every region it
// touches. Each region carries a small plate at a free place in it (distLabels): X's pieces touching it against
// O's, and a padlock once it is locked. A tap on an empty spot is the move: the piece drops onto its spot (land), the
// regions it touches take their new counts, shades and locks (tally), then a grey piece drops onto a random empty
// spot (grey: its landing, when a region it shuts locks). By each name, the regions they have locked (more than half wins).
// The move's moments (ms from the move, at the game's pace; the stylesheet's Districts figures are the same ones), all
// inside rules.js flashMs: lock is the padlock's stamp, win the gap between the winner's regions lighting up.
export const DIST_T = { land: 200, tally: PLACE_MS.mark, grey: PLACE_MS.mark + Math.round(PLACE_MS.drop * 0.65), lock: 300, win: 140 };
const distPath = poly => 'M' + poly.map(p => p.join(' ')).join('L') + 'Z';
const shade = (lead, lock) => (lock ? lock + 'L' : lead || 'n');   // a region's look: locked, led, or nobody's
// The position before the move's piece, with it, and with its grey too (now), from the board and the move: each
// region's look at the three, and when it changes (tally: the piece; grey: the grey piece shutting a region).
export function distMoments(map, who, ds) {
  const now = distTally(map, who);
  if (!ds) return { now, mid: now, before: now, moved: false };
  const w1 = who.slice(); if (ds.grey != null) w1[ds.grey] = null;
  const w0 = w1.slice(); w0[ds.spot] = null;
  const before = distTally(map, w0), mid = distTally(map, w1);
  const lockAt = now.lock.map((l, r) => (!l || before.lock[r] === l ? null : mid.lock[r] === l ? DIST_T.tally : DIST_T.grey));   // a region locked by this move: when
  const times = [...new Set(lockAt.filter(t => t != null))].sort((a, b) => a - b);
  return { now, mid, before, moved: true, lockAt, times, leadMoved: now.lead.some((l, r) => l !== before.lead[r]) };
}
// A free place in each region for its plate: the point where a box of the plate's size (half 5 by 4.3) lies in the
// region furthest from its borders and from every spot. { x, y, k } (k: the plate's scale; null: no room at all).
const LABELS = new Map();
const segDist = (p, poly) => { let d = Infinity; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const a = poly[j], b = poly[i], dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy, t = L ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L)) : 0; d = Math.min(d, Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy)); } return d; };
const BOX = [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]];
export function distLabels(map) {
  const key = JSON.stringify(map.spots.map(s => [s.x, s.y])) + map.regions.length;
  if (LABELS.has(key)) return LABELS.get(key);
  const find = (poly, k) => {
    const hw = 5 * k, hh = 4.3 * k, xs = poly.map(p => p[0]), ys = poly.map(p => p[1]);
    let best = null;
    for (let y = Math.min(...ys) + 1; y < Math.max(...ys); y += 1.5) for (let x = Math.min(...xs) + 1; x < Math.max(...xs); x += 1.5) {
      let m = Infinity;
      for (const [dx, dy] of BOX) { const q = [x + dx * hw, y + dy * hh]; if (distTo(q, poly) > 0) { m = -1; break; } m = Math.min(m, segDist(q, poly)); }
      if (m < 0) continue;
      for (const s of map.spots) m = Math.min(m, Math.hypot(Math.max(Math.abs(s.x - x) - hw, 0), Math.max(Math.abs(s.y - y) - hh, 0)) - 5.5);
      if (!best || m > best.m) best = { x, y, m };
    }
    return best && best.m >= 0.4 ? { x: best.x, y: best.y, k } : null;
  };
  const out = map.regions.map(poly => find(poly, 1) || find(poly, 0.8) || find(poly, 0.62));
  if (LABELS.size > 40) LABELS.clear();
  LABELS.set(key, out);
  return out;
}
// A piece's face: the mover's drawn mark (a grey: a pebble's shine).
const face = w => (w === 'X' ? '<path class="dmk" d="M-1.7 -1.7L1.7 1.7M1.7 -1.7L-1.7 1.7"/>' : w === 'O' ? '<circle class="dmk" r="1.8"/>' : '<path class="dmk" d="M-2.3 -.9A2.6 2.6 0 0 1 -.4 -2.4"/>');
// A region's plate: X's count on the left, O's on the right (a side with none: pale), the padlock over it once locked.
const HALF = { X: 'M0 -1.3H-3.5A1.5 1.5 0 0 0 -5 .2V2.8A1.5 1.5 0 0 0 -3.5 4.3H0Z', O: 'M0 -1.3H3.5A1.5 1.5 0 0 1 5 .2V2.8A1.5 1.5 0 0 1 3.5 4.3H0Z' };
const half = (p, n, cls = '', st = '') => `<g class="dch ${p}${n ? '' : ' nil'}${cls}"${st}><path d="${HALF[p]}"/><text x="${p === 'X' ? -2.5 : 2.5}" y="3.15">${n}</text></g>`;
const PADLOCK = '<path class="dps" d="M-1.15 -2.9V-3.75A1.15 1.15 0 0 1 1.15 -3.75V-2.9"/><rect class="dpb" x="-2" y="-3.05" width="4" height="2.9" rx=".7"/><circle class="dpk" cy="-1.6" r=".55"/>';
function distTable(mini, a, o) {
  const ds = a && a.dist ? a.dist : null, map = mini.map, M = distMoments(map, mini.who, ds), t = M.now, before = M.before, mid = M.mid;
  const led = p => t.lead.filter(l => l === p).length, tie = a && a.note === 'tie', R = map.regions.length;
  const lockT = ds && M.times.length ? M.times[M.times.length - 1] : null;                  // the move's last lock
  const winner = ds && o.fresh && a.winner ? a.winner : null, winAt = (lockT != null ? lockT + DIST_T.lock : DIST_T.tally + 200);
  const winReg = r => winner && (a.note === 'locked' ? t.lock[r] === winner : t.lead[r] === winner);
  // each player's locked regions as a big number by their name (the move's change turning over as the padlock lands)
  const big = p => {
    const n = t.locks[p], n0 = before.locks[p], at = mid.locks[p] !== n0 && mid.locks[p] === n ? DIST_T.tally : DIST_T.grey;
    return `<b class="dbig" aria-label="${n} region${n === 1 ? '' : 's'} locked of ${t.need} to win">${n0 !== n ? `<span class="tu" style="--u:${at}ms">${n0}</span><span class="tf" style="--f:${at}ms">${n}</span>` : `<span>${n}</span>`}<small>/${t.need}</small></b>`;
  };
  const tal = p => arcTally(p, o, big(p));
  let wn = 0;
  const regs = map.regions.map((poly, r) => {
    const s0 = shade(before.lead[r], before.lock[r]), s1 = shade(mid.lead[r], mid.lock[r]), s2 = shade(t.lead[r], t.lock[r]), d = distPath(poly);
    const one = s0 !== s1 && s1 === s2 ? DIST_T.tally : s0 === s1 && s1 !== s2 ? DIST_T.grey : null, two = s0 !== s1 && s1 !== s2;
    const st = two ? ` style="--f0:var(--d${s0});--f1:var(--d${s1});--t:${DIST_T.tally}ms;--t2:${DIST_T.grey}ms"` : one != null ? ` style="--f0:var(--d${s0});--t:${one}ms"` : '';
    const seal = t.lock[r] ? `<path class="dseal${ds && M.lockAt[r] != null ? ' in' : ''}"${ds && M.lockAt[r] != null ? ` style="--t:${M.lockAt[r]}ms"` : ''} d="${d}"/>` : '';
    const win = winReg(r) ? `<path class="dwin" style="--t:${winAt + DIST_T.win * wn++}ms" d="${d}"/>` : '';
    return [`<path class="dreg${t.lead[r] ? ' ' + t.lead[r] : ''}${t.lock[r] ? ' lock' : ''}${two ? ' shift2' : one != null ? ' shift' : ''}"${st} d="${d}"/>`, win, `<path class="dline" d="${d}"/>${seal}`];   // (in layers: the shades, a win's light over them, then every border and seal on top)
  });
  const L = distLabels(map);
  const plates = map.regions.map((poly, r) => {
    const at = L[r]; if (!at) return '';
    const moved = ds && (before.X[r] !== t.X[r] || before.O[r] !== t.O[r]), fresh = ds && M.lockAt[r] != null;
    const side = p => (ds && before[p][r] !== t[p][r] ? half(p, before[p][r], ' tu', ` style="--u:${DIST_T.tally}ms"`) + half(p, t[p][r], ' tf', ` style="--f:${DIST_T.tally}ms"`) : half(p, t[p][r]));
    const pad = t.lock[r] ? `<g class="dpad ${t.lock[r]}${fresh ? ' stamp' : ''}"${fresh ? ` style="--t:${M.lockAt[r]}ms"` : ''}>${PADLOCK}</g>` : '';
    return `<g class="dplate${t.lock[r] ? ' lock' : ''}" transform="translate(${at.x} ${at.y})${at.k !== 1 ? ` scale(${at.k})` : ''}"><g class="dpi${moved ? ' bump' : ''}"${moved ? ` style="--t:${DIST_T.tally}ms"` : ''}>${side('X')}${side('O')}<rect class="dcf" x="-5" y="-1.3" width="10" height="5.6" rx="1.5"/><path class="dcd" d="M0 -1.3V4.3"/></g>${pad}</g>`;
  }).join('');
  const last = mini.last || null;   // the last move's piece and its grey, ringed
  const spots = map.spots.map((s, k) => {
    const w = mini.who[k], open = !w && !o.locked, pop = ds && ds.spot === k, drop = ds && ds.grey === k;
    const mark = last && (last.spot === k || last.grey === k) && w, late = pop ? DIST_T.land : drop ? DIST_T.grey : null;
    const label = `Spot ${k + 1}, region${s.r.length > 1 ? 's' : ''} ${s.r.map(r => r + 1).join(' and ')}${w === 'G' ? ', grey' : w ? ', ' + esc(w) : ''}`;
    return `<g transform="translate(${s.x} ${s.y})"><g class="dspot${w ? ' ' + w : ''}${s.r.length > 1 ? ' edge' : ''}${pop ? ' pop' : ''}${drop ? ' drop' : ''}${open ? ' open' : ''}" ${open ? `data-act="move" ${mv(k)} role="button" tabindex="0"` : ''} aria-label="${label}">`
      + `${mark ? `<circle class="dlast${late != null ? ' in' : ''}"${late != null ? ` style="--t:${late}ms"` : ''} r="6.2"/>` : ''}${late != null ? `<circle class="dring" style="--t:${late}ms" r="4.3"/><circle class="dun" r="4.3"/>` : ''}`
      + `<g class="pp"${drop ? ` style="--t:${DIST_T.tally}ms"` : ''}><circle class="dhit" r="5.5"/>${w ? '<circle class="dsd" cy="1.2" r="4.3"/>' : ''}<circle class="dpc" r="4.3"/>${w ? face(w) : '<circle class="dho" r="2.2"/>'}</g></g></g>`;
  }).join('');
  const newLock = ds ? ['X', 'O'].find(p => t.locks[p] > before.locks[p]) : null;
  const who = a && a.note === 'full' && a.winner ? a.winner : a && a.by;   // (a full map: the square's winner leads more)
  const say = !ds ? '' : tie ? `${led('X')} each` : a.note === 'locked' ? `${N(a.winner)} locked ${t.locks[a.winner]} of ${R}` : newLock ? `${N(newLock)} locked a region` : `${N(who)} ${isYou(who) ? 'lead' : 'leads'} ${led(who)} of ${R}`;
  const res = ds ? `<p ${lateAt('arcres ok', newLock && lockT != null ? lockT : DIST_T.tally)} role="status">${say}</p>`
    : `<p class="arcnote">${o.view ? '' : o.locked ? waitLine(o.turn) : ''}</p>`;
  return `<div class="g-arc"><div class="ctals">${tal('X')}${tal('O')}</div><div class="districts"><svg class="dmap${o.locked ? '' : ' go t' + o.turn}" viewBox="-3 -3 106 129" role="group" aria-label="The map"><defs><clipPath id="dmclip"><rect width="${DMAP.w}" height="${DMAP.h}" rx="5"/></clipPath></defs>`
    + `<rect class="dslab" y="2.4" width="${DMAP.w}" height="${DMAP.h}" rx="5"/><g clip-path="url(#dmclip)">${regs.map(x => x[0]).join('')}${regs.map(x => x[1]).join('')}${regs.map(x => x[2]).join('')}</g><rect class="dframe" width="${DMAP.w}" height="${DMAP.h}" rx="5"/>${plates}${spots}</svg>${res}</div></div>`;
}
const DMAP = { w: 100, h: 120 };
// The miniature: the map as it stands (each region in its leader's shade, darker once locked, and the pieces) and
// beside it each player's locked regions as pips, of the locks that take the square.
export function miniature(mini, final) {
  const t = distTally(mini.map, mini.who);
  const art = `<svg class="tdist" viewBox="-3 -3 106 126" aria-hidden="true"><defs><clipPath id="tdclip"><rect width="${DMAP.w}" height="${DMAP.h}" rx="7"/></clipPath></defs><g clip-path="url(#tdclip)">${mini.map.regions.map((poly, r) => `<path class="dreg${t.lead[r] ? ' ' + t.lead[r] : ''}${t.lock[r] ? ' lock' : ''}" d="${distPath(poly)}"/>`).join('')}</g><rect class="tdfr" width="${DMAP.w}" height="${DMAP.h}" rx="7"/>${mini.map.spots.map((sp, k) => `<circle class="${mini.who[k] || ''}" cx="${sp.x}" cy="${sp.y}" r="4.8"/>`).join('')}</svg>`;
  return thumbArt(art, pipRows(t.locks, t.need), 'tdistw', `Districts: X has locked ${t.locks.X} of ${t.need}, O ${t.locks.O}`);
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = distTable(mini, a, { view, locked, turn, zoom: state.zoom, done: !!d, fresh }); return g;
}
export function moveText(f, who) {
  return `${who} placed a piece`;
}
// The piece's tick as it is picked and its click as it lands (Hex's and Takeover's), the swish of a region changing
// hands, the grey piece's thud, and a padlock's snap for each moment a region locks (the result: its buzz).
export function sounds(f, add, won, mini, last) {
  if (!f.dist) return;
  add('marker', 0); add('hexPlace', DIST_T.land);
  const M = mini && mini.type === 'districts' && mini.map && mini.who ? distMoments(mini.map, mini.who, f.dist) : null;
  if (!M || M.leadMoved) add('flipUp', DIST_T.tally);
  if (f.dist.grey != null) add('thud', DIST_T.grey);
  if (M) for (const t of M.times) add('distLock', t);
}
