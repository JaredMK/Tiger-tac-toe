// Treasure Hunt: the screen, the miniature, the move's words and sounds, and the inputs.
import { huntClue, huntGrid, huntSize, huntTreasure } from './rules.js';
import { raceSide } from '../../core/race.js';
import { N, mv } from '../../ui/app.js';
import { raceBoards, raceMe, raceThem, raceThumb } from '../../ui/race.js';

// Treasure hunt: a dug cell shows its band (Hot 1 step, Warm 2-3, Cool 4-5, Cold 6+), never the distance.
// Race mode (core/race.js, `rv: 2`): a treasure each, both grids open (ui/race.js raceBoards): this phone's own grid large
// (its digs against its own treasure, the controls), the other player's smaller under it, their digs in their bands, their
// newest dig opening there as it lands (from the move's flash). A finished square reviewed shows both treasures.
const BAND = [{ name: 'Found!', bg: '#ffd166', fg: '#1a1a1a' }, { name: 'Hot', bg: '#ff4d4d', fg: '#fff', steps: '1 step' }, { name: 'Warm', bg: '#ffb627', fg: '#1a1a1a', steps: '2–3 steps' },
  { name: 'Cool', bg: '#4cc9c0', fg: '#1a1a1a', steps: '4–5 steps' }, { name: 'Cold', bg: '#3b6fd6', fg: '#fff', steps: '6+ steps' }];
// The key under the grid: each band's colour and how many steps it means (always there: nothing moves).
const HKEY = `<div class="hkey" aria-label="Key: ${BAND.slice(1).map(b => `${b.name} ${b.steps}`).join(', ')}">${BAND.slice(1).map(b => `<span><i style="background:${b.bg}"></i><b>${b.name}</b>&nbsp;=&nbsp;${b.steps.replace(' steps', '')}</span>`).join('')}</div>`;
const GEM = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 3h12l4 6-10 12L2 9z"/><path d="M2 9h20" stroke="rgba(0,0,0,.25)" stroke-width="1.5"/></svg>';
// a dug cell's distance: from the treasure here, or from the clues the host sent (the treasure itself stays with the host)
function clueAt(mini, i) { return mini.clues ? mini.clues[i] : huntClue(mini, i); }   // a band, 1 to 4
// Race: p's grid (their own digs and bands), and where their treasure lies once it may be shown (a finished square).
const raceGrid = (mini, p) => huntGrid(mini, p) || { n: huntSize(mini), dug: new Array(huntSize(mini) ** 2).fill(null), clues: [] };
const raceGem = (mini, p, view) => (view ? huntTreasure(mini, p) : null);
// Race: how near p has come, as a thermometer's fill: their best band so far (nothing dug: a drop in the bulb).
const HEAT_FILL = [1, 0.86, 0.64, 0.42, 0.22];
function heatFill(mini, p) { const part = raceSide(mini, p), dug = part && Array.isArray(part.dug) ? part.dug : []; return dug.length ? HEAT_FILL[Math.min(...dug.map(d => d.k))] : 0.06; }
const thermo = (p, f) => `<svg class="thth ${p}" viewBox="0 0 24 56" aria-hidden="true"><rect class="thtube" x="7" y="2" width="10" height="40" rx="5"/><rect class="thfill" x="9.5" y="${(4 + 38 * (1 - f)).toFixed(1)}" width="5" height="${(38 * f + 2).toFixed(1)}" rx="2.5"/><circle class="thbulb" cx="12" cy="46" r="8"/>${f >= 1 ? '<path class="thgem" d="M7 2.5h10l3.5 4.6L12 16 3.5 7.1z"/>' : ''}</svg>`;
// The miniature: the grid with its dug cells' bands; a race square: each player's thermometer (how near their best dig came).
export function miniature(mini, final) {
  const n = huntSize(mini);
  if (mini.race) return raceThumb(p => thermo(p, heatFill(mini, p)), 'thunt2', `Race: ${['X', 'O'].map(p => { const part = raceSide(mini, p), k = part && part.dug && part.dug.length ? Math.min(...part.dug.map(d => d.k)) : null; return `${p} ${k == null ? 'no digs' : BAND[k].name.toLowerCase()}`; }).join(', ')}`);
  return `<div class="tg g5x5" style="--hn:${n}">${mini.dug.map((d, i) => {
      if (!d) return '<i></i>';
      const k = clueAt(mini, i), b = BAND[k] || BAND[4];
      return `<i style="background:${b.bg};color:${b.fg}">${k ? '' : GEM}</i>`;
    }).join('')}</div>`;
}
// Race: the other player's grid, small and read-only: their digs in their bands, their newest opening as it lands.
function oppGrid(mini, p, a, view) {
  const g = raceGrid(mini, p), part = raceSide(mini, p), gem = raceGem(mini, p, view);
  const fresh = a && a.by === p && part ? part.last : null;
  return `<div class="hopp" style="--hn:${g.n}" role="img" aria-label="${(part && part.dug.length) || 0} digs">${g.dug.map((dg, i) => {
    const k = dg ? g.clues[i] : null, b = k != null ? BAND[k] || BAND[4] : gem === i ? BAND[0] : null;
    return `<i class="hoc${fresh === i ? ' open' : ''}${k === 0 || gem === i ? ' found' : ''}"${b ? ` style="background:${b.bg};color:${b.fg}"` : ''}>${k === 0 || gem === i ? GEM : ''}</i>`;
  }).join('')}</div>`;
}
function raceScreen(mini, view, locked, a) {
  const me = raceMe(), them = raceThem(), g = raceGrid(mini, me), part = raceSide(mini, me), gem = raceGem(mini, me, view), hn = g.n;
  const opening = a && a.by === me && part ? part.last : null;    // the cell opening: this phone's own newest dig, while its move plays
  const mine = `<div class="g-hunt hr2">${'<div class="hgrid" style="--hn:' + hn + '">'}${g.dug.map((dg, i) => {
      const k = dg ? g.clues[i] : -1, found = k === 0 || gem === i;
      const b = dg ? BAND[k] || BAND[4] : found ? BAND[0] : null;
      const style = b ? ` style="--dbg:${b.bg};--dfg:${b.fg};background:var(--dbg);color:var(--dfg)"` : '';
      const r = Math.floor(i / hn) + 1, c = i % hn + 1;
      return `<button class="dig${found ? ' found' : ''}${opening === i ? ' open' : ''}" data-act="move" ${mv(i)}${style} aria-label="Row ${r} column ${c}${found ? ', treasure' : dg ? `, ${b.name.toLowerCase()}` : ''}"${dg || locked ? ' disabled' : ''}>${found ? GEM : dg ? `<span>${b.name}</span>` : ''}</button>`;
    }).join('')}</div>${HKEY}</div>`;
  const n = (raceSide(mini, them) || { dug: [] }).dug.length;
  return raceBoards(mine, oppGrid(mini, them, a, view), `${n} dig${n === 1 ? '' : 's'}`, { cls: 'hrb' });
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  if (mini.race) return raceScreen(mini, view, locked, a);
  const grid = huntGrid(mini);
  const hn = grid.n, both = a && a.scr && a.scr.digs ? Object.values(a.scr.digs) : [];   // (Super Chaos's round end: both players' digs open together)
  const opens = i => anim === i || both.includes(i);
  const found = i => i === mini.treasure && (grid.dug[i] || view);
  g = `<div class="g-hunt"><div class="hgrid" style="--hn:${hn}">${grid.dug.map((dg, i) => {
        const k = dg ? grid.clues[i] : -1;
        const b = dg ? BAND[k] || BAND[4] : view && found(i) ? BAND[0] : null;
        const style = b ? ` style="--dbg:${b.bg};--dfg:${b.fg};background:var(--dbg);color:var(--dfg)"` : '';
        const r = Math.floor(i / hn) + 1, c = i % hn + 1;
        return `<button class="dig${found(i) ? ' found' : ''}${opens(i) ? ' open' : ''}" data-act="move" ${mv(i)}${style} aria-label="Row ${r} column ${c}${found(i) ? ', treasure' : dg ? `, ${b.name.toLowerCase()}` : ''}"${dg || locked ? ' disabled' : ''}>${found(i) ? GEM : dg ? `<span>${b.name}</span>` : ''}</button>`;
      }).join('')}</div>${HKEY}</div>`;   // the colour key under the grid, in every mode

  return g;
}
export function moveText(f, who) {
  if (f.scr && f.scr.digs) return ['X', 'O'].filter(p => f.scr.digs[p] != null).map(p => `<b class="${p}">${N(p)}</b> dug · ${(BAND[f.scr.bands[p]] || BAND[4]).name}`).join(' · ');
  return `${who} dug · ${(BAND[f.band] || BAND[4]).name}`;
}
export function sounds(f, add, won, mini, last) {
  if (f.scr && f.scr.digs) {                                     // Super Chaos's round end: both digs, a beat apart, each with its band (the treasure's sparkle once)
    const bands = ['X', 'O'].filter(p => f.scr.digs[p] != null).map(p => f.scr.bands[p]);
    bands.forEach((b, k) => { add('dig', k * 300); if (b !== 0) add('band', 380 + k * 300, [0, 1100, 880, 660, 440][b] / 880); });
    if (bands.includes(0) || won) add('sparkle', 1100);
    return;
  }
  const band = f.band !== undefined ? f.band : 4;
  add('dig', 0); if (band === 0 || won) add('sparkle', 800); else add('band', 380, [0, 1100, 880, 660, 440][band] / 880); return;
}
