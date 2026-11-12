// Treasure Hunt: the screen, the miniature, the move's words and sounds, and the inputs.
import { HUNTT, huntClue, huntGrid, huntSize, huntTreasure } from './rules.js';
import { raceSide } from '../../core/race.js';
import { N, mv } from '../../ui/app.js';
import { raceBoards, raceMe, raceThem, raceThumb } from '../../ui/race.js';

// Treasure hunt: a dug cell shows its band (Hot 1 step, Warm 2-3, Cool 4-5, Cold 6+), never the distance.
// Race mode (core/race.js, `rv: 2`): a treasure each, both grids open (ui/race.js raceBoards): this phone's own grid large
// (its digs against its own treasure, the controls), the other player's smaller under it, their digs in their bands, their
// newest dig opening there as it lands (from the move's flash). A finished square reviewed shows both treasures.
const BAND = [{ name: 'Found!', bg: '#ffd166', fg: '#1a1a1a' }, { name: 'Hot', bg: '#ff4d4d', fg: '#fff', steps: '1 step' }, { name: 'Warm', bg: '#ffb627', fg: '#1a1a1a', steps: '2–3 steps' },
  { name: 'Cool', bg: '#4cc9c0', fg: '#1a1a1a', steps: '4–5 steps' }, { name: 'Cold', bg: '#3b6fd6', fg: '#fff', steps: '6+ steps' }];
// The key under the grid: each band a pill in its colour, hottest first, with how many steps it means (always there: nothing moves).
const HKEY = `<div class="hkey" aria-label="Key: ${BAND.slice(1).map(b => `${b.name} ${b.steps}`).join(', ')}">${BAND.slice(1).map((b, k) => `<span style="background:${b.bg};color:${b.fg}"><b>${b.name}</b>${k ? b.steps.replace(' steps', '') : b.steps}</span>`).join('')}</div>`;
const GEM = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 3h12l4 6-10 12L2 9z"/><path d="M2 9h20" stroke="rgba(0,0,0,.25)" stroke-width="1.5"/></svg>';
// The treasure dug up: a chest, its lid thrown back, a gem coming up out of it with three glints (the stylesheet opens it
// from the dig's event: closed as it comes up out of the hole, then the lid, the gem, the glints; at rest it stands open).
const CHEST = '<svg class="hchest" viewBox="0 0 48 48" aria-hidden="true"><g class="hlid"><path class="hwood" d="M7 25V20q0-9 9-9h16q9 0 9 9v5z"/><path class="hgold" d="M21 11h6v14h-6z"/></g><path class="hin" d="M8 25h33L36.5 8.5z"/>'
  + '<path class="hgem" d="M17.5 9h13l5 6.5L24 29 12.5 15.5z"/><path class="hwood hbox" d="M6 25h36v15q0 4-4 4H10q-4 0-4-4z"/><path class="hgold" d="M21 25h6v19h-6z"/><circle class="hlock" cx="24" cy="32" r="3.2"/>'
  + '<path class="hsp" d="M41 3l1.4 3.6L46 8l-3.6 1.4L41 13l-1.4-3.6L36 8l3.6-1.4z"/><path class="hsp s2" d="M6 4l1 2.6L9.6 7.6 7 8.6 6 11.2 5 8.6 2.4 7.6 5 6.6z"/><path class="hsp s3" d="M44 22l.9 2.2 2.2.9-2.2.9-.9 2.2-.9-2.2-2.2-.9 2.2-.9z"/></svg>';
// A dig's own motion, drawn only in the cell being dug while its move plays (CSS, timed from the move's event; unseen at
// rest): the shovel in the digger's colour, the clods it throws up, and the band's colour blooming from the hole.
const SHOVEL = p => `<svg class="hshov ${p}" viewBox="0 0 40 40" aria-hidden="true"><path class="hso" d="M30 4L17 21"/><path class="hsh" d="M30 4L17 21"/><path class="hsg" d="M26.5 2.5l6 5"/><path class="hsb" d="M19.5 17.5l5 4.2q1.6 7-6.6 12.6-3.4-9.6 1.6-16.8z"/></svg>`;
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
      return `<i class="dug" style="background:${b.bg};color:${b.fg}">${k ? '' : GEM}</i>`;
    }).join('')}</div>`;
}
// Race: the other player's grid, small and read-only: their digs in their bands, their newest opening as it lands.
function oppGrid(mini, p, a, view) {
  const g = raceGrid(mini, p), part = raceSide(mini, p), gem = raceGem(mini, p, view);
  const fresh = a && a.by === p && part ? part.last : null, last = part && !view ? part.last : null;
  return `<div class="hopp ${p}" style="--hn:${g.n}" role="img" aria-label="${(part && part.dug.length) || 0} digs">${g.dug.map((dg, i) => {
    const k = dg ? g.clues[i] : null, b = k != null ? BAND[k] || BAND[4] : gem === i ? BAND[0] : null;
    return `<i class="hoc${fresh === i ? ' open' : ''}${k === 0 || gem === i ? ' found' : ''}${b ? ' dug' : ''}${last === i ? ' last' : ''}"${b ? ` style="--dbg:${b.bg};background:${b.bg};color:${b.fg}"` : ''}>${k === 0 || gem === i ? GEM : ''}</i>`;
  }).join('')}</div>`;
}
// One cell of a grid to play on. o: dg (dug), k (its band), found (the treasure, shown), open (its dig is playing now),
// by (who dug it: the shovel's colour, and in a Shared grid the corner dot), dot (draw that dot), last (the newest dig).
function digCell(i, hn, o, locked) {
  const b = o.dg ? BAND[o.k] || BAND[4] : o.found ? BAND[0] : null;
  const style = b ? ` style="--dbg:${b.bg};--dfg:${b.fg};background:var(--dbg);color:var(--dfg)"` : '';
  const r = Math.floor(i / hn) + 1, c = i % hn + 1;
  const cls = `dig${o.found ? ' found' : ''}${b ? ' dug' : ''}${o.open ? ' open' : ''}${o.last && o.by ? ' last by' + o.by : ''}`;
  return `<button class="${cls}" data-act="move" ${mv(i)}${style} aria-label="Row ${r} column ${c}${o.found ? ', treasure' : o.dg ? `, ${b.name.toLowerCase()}` : ''}"${o.dg || locked ? ' disabled' : ''}>${o.open && o.by ? '<i class="hfill"></i>' : ''}${o.found ? CHEST : o.dg ? `<span>${b.name}</span>` : ''}${o.dot && o.dg && o.by ? `<i class="hby ${o.by}"></i>` : ''}${o.open && o.by ? `<i class="hdirt"></i>${SHOVEL(o.by)}` : ''}</button>`;
}
function raceScreen(mini, view, locked, a) {
  const me = raceMe(), them = raceThem(), g = raceGrid(mini, me), part = raceSide(mini, me), gem = raceGem(mini, me, view), hn = g.n;
  const opening = a && a.by === me && part ? part.last : null;    // the cell opening: this phone's own newest dig, while its move plays
  const mine = `<div class="g-hunt hr2">${'<div class="hgrid" style="--hn:' + hn + '">'}${g.dug.map((dg, i) => {
      const k = dg ? g.clues[i] : -1;
      return digCell(i, hn, { dg, k, found: k === 0 || gem === i, open: opening === i, by: me, last: !view && part && part.last === i }, locked);
    }).join('')}</div>${HKEY}</div>`;
  const n = (raceSide(mini, them) || { dug: [] }).dug.length, say = k => `${k} dig${k === 1 ? '' : 's'}`;
  const note = a && a.by === them && n > 0 ? `<span class="tu" style="--u:${HUNTT.bloom}ms">${say(n - 1)}</span><span class="tf" style="--f:${HUNTT.bloom}ms">${say(n)}</span>` : say(n);   // (their dig now playing: the count changes as its band shows, in the note's own room)
  return raceBoards(mine, oppGrid(mini, them, a, view), note, { cls: 'hrb' });
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  if (mini.race) return raceScreen(mini, view, locked, a);
  const grid = huntGrid(mini);
  const hn = grid.n, both = a && a.scr && a.scr.digs ? Object.values(a.scr.digs) : [];   // (Super Chaos's round end: both players' digs open together)
  const opens = i => anim === i || both.includes(i);
  const found = i => i === mini.treasure && (grid.dug[i] || view);
  const by = i => (grid.dug[i] === 'X' || grid.dug[i] === 'O' ? grid.dug[i] : null);   // (who dug the cell: public, the grid's own record)
  g = `<div class="g-hunt"><div class="hgrid" style="--hn:${hn}">${grid.dug.map((dg, i) => digCell(i, hn, { dg, k: dg ? grid.clues[i] : -1, found: !!found(i), open: opens(i), by: by(i), dot: true, last: !view && mini.last === i }, locked)).join('')}</div>${HKEY}</div>`;   // the colour key under the grid, in every mode

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
  add('dig', 0); if (band === 0 || won) { add('thunk', HUNTT.bloom); add('sparkle', HUNTT.gem); } else add('band', HUNTT.bloom, [0, 1100, 880, 660, 440][band] / 880); return;   // (the shovel, then the band's note as its colour blooms; the treasure: the shovel strikes the chest, then the gem's glints)
}
