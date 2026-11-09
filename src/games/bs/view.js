// Sea Battle: the screen, the miniature, the move's words and sounds, and the inputs.
import { BS, bsMerged, bsN, bsPart } from './rules.js';
import { N, esc, mv, state, viewer } from '../../ui/app.js';
import { playerName } from '../../core/match.js';
import { raceShape } from '../../core/race.js';

// Race mode (core/race.js): the square this view gets holds this phone's own sea alone (its shots and hits) and both
// players' shapes (hits and misses as counts); the other side's move arrives redacted (`a.race`: hit or miss, their
// counts after it), so nothing lands on this sea for it: their ship row under the sea fills in instead.
// Sea Battle: the burst on a hit, a ship's part in its cell, and the card naming the ship being hunted.
const HITFX = (() => {
  const star = (n, R, r, j) => Array.from({ length: n * 2 }, (_, k) => { const a = k * Math.PI / n - Math.PI / 2, d = k % 2 ? r : R * (1 - (k % 4 === 0 ? 0 : j)); return `${(50 + Math.cos(a) * d).toFixed(1)},${(50 + Math.sin(a) * d).toFixed(1)}`; }).join(' ');
  return `<svg class="fx" viewBox="0 0 100 100" aria-hidden="true"><polygon class="f1" points="${star(9, 46, 25, .14)}"/><polygon class="f2" points="${star(7, 24, 12, .1)}"/></svg>`;
})();
// One part of a ship as drawn across (stern on the left, bow pointing right), on a 100 x 100 cell.
const SHIP_PART = {
  one: '<path class="hull" d="M16,32 H66 L90,50 L66,68 H16 Q8,50 16,32 Z"/><circle class="port" cx="42" cy="50" r="7"/>',
  stern: '<path class="hull" d="M106,30 H34 Q12,30 12,50 Q12,70 34,70 H106 Z"/><path class="deck" d="M40,40 H64"/><circle class="port" cx="74" cy="50" r="7"/>',
  mid: '<path class="hull" d="M-6,30 H106 V70 H-6 Z"/><circle class="port" cx="50" cy="50" r="7"/>',
  bow: '<path class="hull" d="M-6,30 H56 L90,50 L56,70 H-6 Z"/><circle class="port" cx="28" cy="50" r="7"/>',
};
const shipPart = (len, k) => (len === 1 ? 'one' : k === 0 ? 'stern' : k === len - 1 ? 'bow' : 'mid');
function shipSeg(ship, i, n) {
  const cells = ship.slice().sort((a, b) => a - b), k = cells.indexOf(i), down = cells.length > 1 && cells[1] - cells[0] === n;
  return `<svg class="bseg" viewBox="0 0 100 100" aria-hidden="true"><g${down ? ' transform="rotate(90 50 50)"' : ''}>${SHIP_PART[shipPart(cells.length, k)]}</g></svg>`;
}
// The ship's parts in a row, the first `hits` of them hit.
const shipSil = (len, hits, cls, h) => `<svg class="${cls}" viewBox="0 20 ${len * 100} 60" style="height:${h}px" aria-hidden="true">${Array.from({ length: len }, (_, k) => `<g transform="translate(${k * 100} 0)">${SHIP_PART[shipPart(len, k)].replace('class="hull"', `class="hull${k < hits ? ' hit' : ''}"`)}</g>`).join('')}</svg>`;
// Under the sea: the ship being hunted, its name and its parts (as many filled in as have been hit).
function bsShipCard(mini, hits, sunkBy, fresh) {
  const len = mini.len || 1;
  const what = sunkBy ? 'Sunk!' : `Hunting · ${len} part${len === 1 ? '' : 's'}${hits ? `, ${hits} hit` : ''}`;
  return `<div class="bsship${sunkBy ? ' sunk ' + sunkBy : ''}${fresh ? ' fresh' : ''}" aria-label="${BS.names[len]}, ${len} part${len === 1 ? '' : 's'}"><div class="nm"><small>${what}</small><b>${BS.names[len]}</b></div>${shipSil(len, hits, 'sil', 30)}</div>`;
}
// Race: each player's hunt as its shape: their ship with the parts they have hit filled in, and their misses as a
// count (where they fired is theirs alone). The other side's move (theirs) lights their row and says hit or miss.
const shapeOf = (mini, p) => (mini.shape && mini.shape[p]) || raceShape(mini, p) || {};   // (the shapes the record carries; a full square, reviewed: from each side's part)
function bsRaceCard(mini, theirs, sunkBy, fresh) {
  const len = mini.len || 1;
  const rows = ['X', 'O'].map(p => {
    const sh = shapeOf(mini, p), hits = Math.min(len, sh.hits || 0), miss = sh.miss || 0, live = theirs && theirs.by === p;
    const said = live ? (theirs.race.hit ? (sh.sunk || sunkBy === p ? 'Sunk!' : 'Hit!') : 'Miss!') : '';
    return `<div class="bsrr ${p}${live ? ' live' : ''}${sunkBy === p ? ' sunk' : ''}" aria-label="${esc(playerName(state, p))}: ${hits} hit${hits === 1 ? '' : 's'}, ${miss} miss${miss === 1 ? '' : 'es'}"><b class="${p} hn">${N(p)}</b>${shipSil(len, hits, 'sil', 22)}<span class="bsmiss"><i></i>${miss}</span><em class="bssay">${said}</em></div>`;
  }).join('');
  return `<div class="bsship bsrace${sunkBy ? ' sunk ' + sunkBy : ''}${fresh ? ' fresh' : ''}" aria-label="${BS.names[len]}, ${len} part${len === 1 ? '' : 's'}">${rows}</div>`;
}
export function miniature(mini, final) {
  if (mini.race && !final) {                                                                      // a race: each player's hits as the ship's parts and their misses as a count; where they fired is theirs alone
    const len = mini.len || 1;
    const rows = ['X', 'O'].map(p => { const sh = shapeOf(mini, p), h = Math.min(len, sh.hits || 0); return `<div class="tr ${p}" style="--n:${len}"><b class="${p}">${p}</b>${Array.from({ length: len }, (_, k) => `<i class="psq${k < h ? ' on' : ''}"></i>`).join('')}<span class="tbm">${sh.miss || 0}</span></div>`; }).join('');
    return `<div class="tbs tbrace" aria-label="Race: ${['X', 'O'].map(p => `${p} ${shapeOf(mini, p).hits || 0} hits, ${shapeOf(mini, p).miss || 0} misses`).join(', ')}"><div class="tship"><svg viewBox="0 20 ${len * 100} 60" aria-hidden="true">${Array.from({ length: len }, (_, k) => `<g transform="translate(${k * 100} 0)">${SHIP_PART[shipPart(len, k)]}</g>`).join('')}</svg></div><div class="tpip">${rows}</div></div>`;
  }
  mini = bsMerged(mini);                                                                          // (a race square won: both players' shots on the one sea)
  const sunk = mini.winCells || [], hits = mini.hits || [], len = mini.len || 1;
  const parts = Array.from({ length: len }, (_, k) => `<g transform="translate(${k * 100} 0)">${SHIP_PART[shipPart(len, k)].replace('class="hull"', `class="hull${k < hits.length ? ' hit' : ''}"`)}</g>`).join('');
  return `<div class="tbs"><div class="tg g4 sea${bsN(mini) !== BS.n ? ' n' + bsN(mini) : ''}">${mini.revealed.map((r, i) => `<i class="${sunk.includes(i) ? 'ship ' + (r === 'XO' ? '' : r || '') : hits.includes(i) ? 'hit' : r ? 'miss' : ''}${(r === 'X' || r === 'O') && !sunk.includes(i) ? ' by' + r : ''}"></i>`).join('')}</div>
        <div class="tship" aria-label="${BS.names[len]}, ${len} part${len === 1 ? '' : 's'}"><svg viewBox="0 20 ${len * 100} 60" aria-hidden="true">${parts}</svg></div></div>`;   // (the ship drawn, its name in the label alone: too long a word for the board's floor size)
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  // One hidden ship on a 4x4 sea (Super Chaos: a Submarine on 5x5). A shot shows a hit (a burst) or a miss (a splash), never which
  // way the ship lies; the shot that sinks it reveals the whole ship, which then goes under.
  const race = !!mini.race, me = race ? (viewer() || turn) : null;
  const theirs = race && a && a.race && a.by !== me ? a : null;                                   // the other side's shot, as its shape
  const n = bsN(mini);
  const sea = race ? (view ? bsMerged(mini) : bsPart(mini, me) || { revealed: new Array(n * n).fill(null), hits: [], last: null }) : mini;   // (a race: this side's own sea; a finished square reviewed: both players' shots)
  if (race && !theirs) anim = a && Number.isInteger(sea.last) ? sea.last : null;                 // (the cell just fired at, on this sea)
  const hits = sea.hits || [], ship = mini.ship || null, sunk = !!sq.owner && !!ship;
  const shown = ship && (sunk || view) ? ship : [];             // the ship's cells, once it may be seen (Super Chaos: only once the round's end has judged it)
  const sinking = sunk && fresh;
  g = `<div class="g-bs${race ? ' bsrmode' : ''}"><div class="bsgrid${n !== BS.n ? ' n' + n : ''}">${sea.revealed.map((r, i) => {
        const r0 = Math.floor(i / n) + 1, c0 = i % n + 1;
        if (shown.includes(i)) {
          const cls = `cell sea ship ${sunk ? sq.owner : 'ghost'}${sinking ? ' sink' : ''}${anim === i ? ' flipin' : ''}`;
          return `<button class="${cls}" data-act="move" ${mv(i)} aria-label="Row ${r0} column ${c0}, ship" disabled>${shipSeg(ship, i, n)}${sinking ? HITFX : ''}</button>`;   // while sinking: the hit bursts give way to the ship
        }
        const hit = hits.includes(i), by = r === 'X' || r === 'O' ? [r] : r === 'XO' ? ['X', 'O'] : [];   // (who fired the shot: its centre dot in their colour; a race reviewed, both: two dots)
        const cls = hit ? ' bshit' : r ? ' miss' : '';
        return `<button class="cell sea${cls}${anim === i ? ' flipin' : ''}" data-act="move" ${mv(i)} aria-label="Row ${r0} column ${c0}${hit ? ', hit' : r ? ', miss' : ''}${by.length ? ` (${by.map(p => esc(playerName(state, p))).join(', ')})` : ''}"${r || locked ? ' disabled' : ''}>${hit ? HITFX : ''}${by.map(p => `<i class="bsby ${p}${by.length > 1 ? ' two' : ''}"></i>`).join('')}</button>`;
      }).join('')}</div>${race ? bsRaceCard(mini, theirs, sunk ? sq.owner : null, sinking) : bsShipCard(mini, hits.length, sunk ? sq.owner : null, sinking)}</div>`;
  return g;
}
export function moveText(f, who) {
  const hit = f.hit !== undefined ? f.hit : !!(f.race && f.race.hit);   // (a race, the other side's shot: hit or miss, never where)
  return hit ? `${who} hit!` : 'Miss!';
}
export function sounds(f, add, won, mini, last) {
  const hit = f.hit !== undefined ? f.hit : !!(f.race && f.race.hit);
  add('fire', 0); if (hit) { add('boom', 430); if (won) add('sink', 700); } else add('splash', 450); return;
}
