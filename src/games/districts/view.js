// Districts: the screen, the miniature, the move's words and sounds, and the inputs.
import { PLACE_MS } from '../shared/placement.js';
import { distTally } from './rules.js';
import { N, esc, mv, state } from '../../ui/app.js';
import { arcTally, lateAt } from '../../ui/progress.js';

// Districts: the map's five regions, each shaded in its leader's colour (darker once locked: the spots left
// cannot change its leader), and its spots; a spot on a border counts for every region it touches. A tap on an
// empty spot is the move: the piece pops in, then any region whose lead or lock changed takes its new shade, and
// a grey piece drops onto a random empty spot. By each name, the regions they have locked (more than half wins).
const distPath = poly => 'M' + poly.map(p => p.join(' ')).join('L') + 'Z';
const shade = (lead, lock) => (lock ? lock + 'L' : lead || 'none');   // a region's look: locked, led, or nobody's
function distTable(mini, a, o) {
  const ds = a && a.dist ? a.dist : null, map = mini.map, t = distTally(map, mini.who);
  const led = p => t.lead.filter(l => l === p).length, tie = a && a.note === 'tie';
  let before = null;
  if (ds) { const w = mini.who.slice(); w[ds.spot] = null; if (ds.grey != null) w[ds.grey] = null; before = distTally(map, w); }
  // each player's locked regions as a big number by their name (the move's change turning over as the regions lock)
  const big = p => { const n = t.locks[p], n0 = before ? before.locks[p] : n; return `<b class="dbig" aria-label="${n} region${n === 1 ? '' : 's'} locked of ${t.need} to win">${n0 !== n ? `<span class="tu" style="--u:${PLACE_MS.mark}ms">${n0}</span><span class="tf" style="--f:${PLACE_MS.mark}ms">${n}</span>` : `<span>${n}</span>`}<small>/${t.need}</small></b>`; };
  const tal = p => arcTally(p, o, big(p));
  const regs = map.regions.map((poly, r) => {
    const now = shade(t.lead[r], t.lock[r]), was = before ? shade(before.lead[r], before.lock[r]) : now, moved = was !== now;
    return `<path class="dreg${t.lead[r] ? ' ' + t.lead[r] : ''}${t.lock[r] ? ' lock' : ''}${moved ? ' shift from' + was : ''}"${moved ? ` style="--t:${PLACE_MS.mark}ms"` : ''} d="${distPath(poly)}"/>`;
  }).join('');
  const spots = map.spots.map((s, k) => {
    const w = mini.who[k], open = !w && !o.locked, pop = ds && ds.spot === k, drop = ds && ds.grey === k;
    const label = `Spot ${k + 1}, region${s.r.length > 1 ? 's' : ''} ${s.r.map(r => r + 1).join(' and ')}${w === 'G' ? ', grey' : w ? ', ' + esc(w) : ''}`;
    return `<g class="dspot${w ? ' ' + w : ''}${s.r.length > 1 ? ' edge' : ''}${pop ? ' pop' : ''}${drop ? ' drop' : ''}${open ? ' open' : ''}" ${open ? `data-act="move" ${mv(k)} role="button" tabindex="0"` : ''} aria-label="${label}" transform="translate(${s.x} ${s.y})"><g class="pp"${drop ? ` style="--t:${PLACE_MS.mark}ms"` : ''}><circle class="dhit" r="5.5"/><circle class="dpc" r="4.3"/>${w && w !== 'G' ? `<text y="1.75">${esc(w)}</text>` : ''}</g></g>`;
  }).join('');
  const res = ds ? `<p ${lateAt('arcres ok', PLACE_MS.mark)} role="status">${tie ? `${led('X')} each · a draw` : a.note === 'locked' ? `${N(a.winner)} locked ${t.locks[a.winner]} of ${map.regions.length}` : `${N(a.by)} leads ${led(a.by)} of ${map.regions.length}`}</p>`
    : `<p class="arcnote">${o.view ? '' : o.locked ? `Waiting for <b class="${o.turn}">${N(o.turn)}</b>…` : ''}</p>`;
  return `<div class="g-arc"><div class="ctals">${tal('X')}${tal('O')}</div><div class="districts"><svg class="dmap" viewBox="-2 -2 104 124" role="group" aria-label="The map">${regs}${spots}</svg>${res}</div></div>`;
}
export function miniature(mini, final) {
  const t = distTally(mini.map, mini.who); return `<svg class="tdist" viewBox="-2 -2 104 124" aria-hidden="true">${mini.map.regions.map((poly, r) => `<path class="dreg${t.lead[r] ? ' ' + t.lead[r] : ''}${t.lock[r] ? ' lock' : ''}" d="${distPath(poly)}"/>`).join('')}${mini.map.spots.map((sp, k) => `<circle class="${mini.who[k] || ''}" cx="${sp.x}" cy="${sp.y}" r="4.6"/>`).join('')}</svg>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = distTable(mini, a, { view, locked, turn, zoom: state.zoom, done: !!d }); return g;
}
export function moveText(f, who) {
  return `${who} placed a piece`;
}
export function sounds(f, add, won, mini, last) {
  if (f.dist) { add('marker', 0); add('flipUp', PLACE_MS.mark); if (f.dist.grey != null) add('thud', PLACE_MS.mark + PLACE_MS.drop - 150); } return;
}
