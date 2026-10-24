// Districts: the screen, the miniature, the move's words and sounds, and the inputs.
import { other } from '../../core/util.js';
import { PLACE_MS } from '../shared/placement.js';
import { distTally } from './rules.js';
import { N, esc, mv, state } from '../../ui/app.js';
import { arcTally, lateAt } from '../../ui/progress.js';

// Districts: the map's five regions, each shaded in its leader's colour, and its spots; a spot on a
// border counts for every region it touches. A tap on an empty spot is the move: the piece pops in, then
// any region whose lead changed takes its new shade, and a grey piece drops onto a random empty spot. Above
// the map, who a tie goes to: the player who moved second here (before the first move, whoever is not on turn).
const distPath = poly => 'M' + poly.map(p => p.join(' ')).join('L') + 'Z';
function distTable(mini, a, o) {
  const ds = a && a.dist ? a.dist : null, map = mini.map, turn = o.turn, t = distTally(map, mini.who);
  const led = p => t.lead.filter(l => l === p).length;
  const second = other(mini.first || turn), tie = a && a.note === 'tiebreak';
  let before = null;
  if (ds) { const w = mini.who.slice(); w[ds.spot] = null; if (ds.grey != null) w[ds.grey] = null; before = distTally(map, w).lead; }
  // each player's regions as a big number by their name (the move's change turning over as the regions shift)
  const big = p => { const n = led(p), n0 = before ? before.filter(l => l === p).length : n; return `<b class="dbig" aria-label="${n} region${n === 1 ? '' : 's'}">${n0 !== n ? `<span class="tu" style="--u:${PLACE_MS.mark}ms">${n0}</span><span class="tf" style="--f:${PLACE_MS.mark}ms">${n}</span>` : `<span>${n}</span>`}</b>`; };
  const tal = p => arcTally(p, o, big(p));
  const regs = map.regions.map((poly, r) => {
    const l = t.lead[r], was = before ? before[r] : l, moved = before && was !== l;
    return `<path class="dreg${l ? ' ' + l : ''}${moved ? ' shift' + (was ? ' from' + was : ' fromnone') : ''}"${moved ? ` style="--t:${PLACE_MS.mark}ms"` : ''} d="${distPath(poly)}"/>`;
  }).join('');
  const spots = map.spots.map((s, k) => {
    const w = mini.who[k], open = !w && !o.locked, pop = ds && ds.spot === k, drop = ds && ds.grey === k;
    const label = `Spot ${k + 1}, region${s.r.length > 1 ? 's' : ''} ${s.r.map(r => r + 1).join(' and ')}${w === 'G' ? ', grey' : w ? ', ' + esc(w) : ''}`;
    return `<g class="dspot${w ? ' ' + w : ''}${s.r.length > 1 ? ' edge' : ''}${pop ? ' pop' : ''}${drop ? ' drop' : ''}${open ? ' open' : ''}" ${open ? `data-act="move" ${mv(k)} role="button" tabindex="0"` : ''} aria-label="${label}" transform="translate(${s.x} ${s.y})"><g class="pp"${drop ? ` style="--t:${PLACE_MS.mark}ms"` : ''}><circle class="dhit" r="5.5"/><circle class="dpc" r="4.3"/>${w && w !== 'G' ? `<text y="1.75">${esc(w)}</text>` : ''}</g></g>`;
  }).join('');
  const res = ds ? `<p ${lateAt('arcres ok', PLACE_MS.mark)} role="status">${tie ? `${led('X')} each · the tie goes to ${N(a.winner)}` : `${N(a.by)} leads ${led(a.by)} of ${map.regions.length}`}</p>`
    : `<p class="arcnote">${o.view ? '' : o.locked ? `Waiting for <b class="${turn}">${N(turn)}</b>…` : ''}</p>`;
  const ties = mini.grey ? `<p class="dties">Ties go to <b class="${second}">${N(second)}</b></p>` : '';   // (a square from before the grey pieces has no ties)
  return `<div class="g-arc"><div class="ctals">${tal('X')}${tal('O')}</div><div class="districts">${ties}<svg class="dmap" viewBox="-2 -2 104 124" role="group" aria-label="The map">${regs}${spots}</svg>${res}</div></div>`;
}
export function miniature(mini, final) {
  const t = distTally(mini.map, mini.who); return `<svg class="tdist" viewBox="-2 -2 104 124" aria-hidden="true">${mini.map.regions.map((poly, r) => `<path class="dreg${t.lead[r] ? ' ' + t.lead[r] : ''}" d="${distPath(poly)}"/>`).join('')}${mini.map.spots.map((sp, k) => `<circle class="${mini.who[k] || ''}" cx="${sp.x}" cy="${sp.y}" r="4.6"/>`).join('')}</svg>`;
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
