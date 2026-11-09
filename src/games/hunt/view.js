// Treasure Hunt: the screen, the miniature, the move's words and sounds, and the inputs.
import { HUNT, huntClue, huntGrid, huntSize, raceShape } from './rules.js';
import { raceSide } from '../../core/race.js';
import { N, mv, viewer } from '../../ui/app.js';

// Treasure hunt: a dug cell shows its band (Hot 1 step, Warm 2-3, Cool 4-5, Cold 6+), never the distance.
// Race mode (core/race.js): the grid this view gets holds this phone's own digs alone (its part) and both players' shapes
// (digs used, the band of their last dig: the race row over the grid); the other side's move arrives redacted
// (`a.race`: their shape after it) and only their chip changes. A finished square reviewed shows both players' digs.
const BAND = [{ name: 'Found!', bg: '#ffd166', fg: '#1a1a1a' }, { name: 'Hot', bg: '#ff4d4d', fg: '#fff', steps: '1 step' }, { name: 'Warm', bg: '#ffb627', fg: '#1a1a1a', steps: '2–3 steps' },
  { name: 'Cool', bg: '#4cc9c0', fg: '#1a1a1a', steps: '4–5 steps' }, { name: 'Cold', bg: '#3b6fd6', fg: '#fff', steps: '6+ steps' }];
const HEAT_BAND = { found: 0, hot: 1, warm: 2, cool: 3, cold: 4 };
// The key under the grid: each band's colour and how many steps it means (always there: nothing moves).
const HKEY = `<div class="hkey" aria-label="Key: ${BAND.slice(1).map(b => `${b.name} ${b.steps}`).join(', ')}">${BAND.slice(1).map(b => `<span><i style="background:${b.bg}"></i><b>${b.name}</b>&nbsp;=&nbsp;${b.steps.replace(' steps', '')}</span>`).join('')}</div>`;
const GEM = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 3h12l4 6-10 12L2 9z"/><path d="M2 9h20" stroke="rgba(0,0,0,.25)" stroke-width="1.5"/></svg>';
// a dug cell's distance: from the treasure here, or from the clues the host sent (the treasure itself stays with the host)
function clueAt(mini, i) { return mini.clues ? mini.clues[i] : huntClue(mini, i); }   // a band, 1 to 4
// Race: a side's shape (digs used, the band of its last dig): from the view's shapes, or from its part where this copy has it (a review).
const shapeOf = (mini, p) => (mini.shape && mini.shape[p]) || raceShape(mini, p) || {};
// Race: a side's heat chip, always there (the row never moves): the band of its last dig, or a dash before any.
function heatChip(sh, fresh) {
  const k = sh.heat != null ? HEAT_BAND[sh.heat] : null, b = k != null ? BAND[k] : null;
  return `<em class="hrh${b ? '' : ' none'}${fresh ? ' fresh' : ''}"${b ? ` style="background:${b.bg};color:${b.fg}"` : ''}>${b ? b.name : '–'}</em>`;
}
// Race: both grids as one, for a finished square's review: who dug each cell (X, O or both) and its band.
function gridBoth(mini) {
  const n = huntSize(mini), dug = new Array(n * n).fill(null), clues = new Array(n * n).fill(null);
  for (const p of ['X', 'O']) { const part = raceSide(mini, p); if (part) for (const d of part.dug) { dug[d.i] = dug[d.i] && dug[d.i] !== p ? 'XO' : p; clues[d.i] = d.k; } }
  return { n, dug, clues };
}
// The miniature: the grid with its dug cells' bands; a race square: a small empty grid and each player's digs and heat
// (the cells are theirs alone).
export function miniature(mini, final) {
  const n = huntSize(mini);
  if (mini.race && !final) {
    const grid = `<svg viewBox="0 0 ${n * 10} ${n * 10}" aria-hidden="true">${Array.from({ length: n * n }, (_, i) => `<rect x="${(i % n) * 10 + 0.8}" y="${Math.floor(i / n) * 10 + 0.8}" width="8.4" height="8.4" rx="1.6"/>`).join('')}</svg>`;
    const rows = ['X', 'O'].map(p => { const sh = shapeOf(mini, p); return `<div class="tr ${p}"><b class="${p}">${p}</b><span class="tdn">${sh.n || 0}</span>${heatChip(sh)}</div>`; }).join('');
    return `<div class="tart thunt trace" aria-label="Race: ${['X', 'O'].map(p => { const sh = shapeOf(mini, p); return `${p} ${sh.n || 0} dig${sh.n === 1 ? '' : 's'}${sh.heat ? ', ' + BAND[HEAT_BAND[sh.heat]].name.toLowerCase() : ''}`; }).join(', ')}"><div class="tpic" aria-hidden="true">${grid}</div><div class="tpip">${rows}</div></div>`;
  }
  const g = mini.race ? gridBoth(mini) : { dug: mini.dug, clues: null };
  return `<div class="tg g5x5" style="--hn:${n}">${g.dug.map((d, i) => {
      if (!d) return '<i></i>';
      const k = mini.race ? g.clues[i] : clueAt(mini, i), b = BAND[k] || BAND[4];
      return `<i style="background:${b.bg};color:${b.fg}">${k ? '' : GEM}</i>`;
    }).join('')}</div>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  const race = !!mini.race, me = race ? (viewer() || turn) : null;
  const grid = race ? (view ? gridBoth(mini) : huntGrid(mini, me) || huntGrid(mini, 'X') || { n: huntSize(mini), dug: new Array(huntSize(mini) ** 2).fill(null), clues: [] }) : huntGrid(mini);   // (a race: this side's own grid; a finished square reviewed: both players' digs)
  const part = race && !view ? raceSide(mini, me) : null;
  const theirs = race && a && a.race && a.by !== me ? a : null;   // the other side's move in a race: its shape alone (their chip changes, no cell here)
  const hn = grid.n, both = a && a.scr && a.scr.digs ? Object.values(a.scr.digs) : [];   // (Super Chaos's round end: both players' digs open together)
  const mine = race ? (a && !theirs && part ? part.last : null) : anim;                    // the cell opening: this move's (a race: this side's own last dig, when the move is theirs)
  const opens = i => mine === i || both.includes(i);
  const found = i => i === mini.treasure && (grid.dug[i] || view);
  const row = race ? `<div class="hrace">${['X', 'O'].map(p => { const sh = shapeOf(mini, p), fr = !!(theirs && theirs.by === p); return `<span class="${p}${fr ? ' fresh' : ''}"><b class="${p} hrn">${N(p)}</b><small>${sh.n || 0} dig${sh.n === 1 ? '' : 's'}</small>${heatChip(sh, fr)}</span>`; }).join('')}</div>` : '';   // a race: each player's digs and heat (always there: the grid never moves)
  g = `<div class="g-hunt${race ? ' race' : ''}">${row}<div class="hgrid" style="--hn:${hn}">${grid.dug.map((dg, i) => {
        const k = dg ? grid.clues[i] : -1;
        const b = dg ? BAND[k] || BAND[4] : view && found(i) ? BAND[0] : null;
        const style = b ? ` style="--dbg:${b.bg};--dfg:${b.fg};background:var(--dbg);color:var(--dfg)"` : '';
        const r = Math.floor(i / hn) + 1, c = i % hn + 1;
        const by = race && view && dg ? ` data-by="${dg}"` : '';
        return `<button class="dig${found(i) ? ' found' : ''}${opens(i) ? ' open' : ''}" data-act="move" ${mv(i)}${style}${by} aria-label="Row ${r} column ${c}${found(i) ? ', treasure' : dg ? `, ${b.name.toLowerCase()}` : ''}"${dg || locked ? ' disabled' : ''}>${found(i) ? GEM : dg ? `<span>${b.name}</span>` : ''}</button>`;
      }).join('')}</div>${HKEY}</div>`;   // the colour key under the grid, in every mode

  return g;
}
export function moveText(f, who) {
  if (f.scr && f.scr.digs) return ['X', 'O'].filter(p => f.scr.digs[p] != null).map(p => `<b class="${p}">${N(p)}</b> dug · ${(BAND[f.scr.bands[p]] || BAND[4]).name}`).join(' · ');
  if (f.race && f.band === undefined) return `${who} dug · ${f.race.heat ? BAND[HEAT_BAND[f.race.heat]].name : ''}${f.race.n ? ` · dig ${f.race.n}` : ''}`;   // the other side's dig in a race: its shape alone
  return `${who} dug · ${(BAND[f.band] || BAND[4]).name}`;
}
export function sounds(f, add, won, mini, last) {
  if (f.scr && f.scr.digs) {                                     // Super Chaos's round end: both digs, a beat apart, each with its band (the treasure's sparkle once)
    const bands = ['X', 'O'].filter(p => f.scr.digs[p] != null).map(p => f.scr.bands[p]);
    bands.forEach((b, k) => { add('dig', k * 300); if (b !== 0) add('band', 380 + k * 300, [0, 1100, 880, 660, 440][b] / 880); });
    if (bands.includes(0) || won) add('sparkle', 1100);
    return;
  }
  const band = f.band !== undefined ? f.band : f.race && f.race.heat ? HEAT_BAND[f.race.heat] : 4;   // (the other side's dig in a race: its shape's band)
  add('dig', 0); if (band === 0 || won) add('sparkle', 800); else add('band', 380, [0, 1100, 880, 660, 440][band] / 880); return;
}
