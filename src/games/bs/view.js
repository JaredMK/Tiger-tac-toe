// Sea Battle: the screen, the miniature, the move's words and sounds, and the inputs.
import { BS, BST, bsN, bsSea, bsShipOf } from './rules.js';
import { N, esc, mv, state } from '../../ui/app.js';
import { playerName } from '../../core/match.js';
import { raceBoards, raceMe, raceThem, raceThumb } from '../../ui/race.js';

// Race mode (core/race.js, `rv: 2`): this phone's own sea large (its shots at its own ship), the other player's sea
// small under it (ui/race.js raceBoards), live: their shot lands there, its splash or burst from the move's flash. Each
// ship stays hidden until the square ends (only its hit cells show); then both are drawn, the winner's going under.
// Sea Battle: the burst on a hit, a ship's part in its cell, and the card naming the ship being hunted.
const HITFX = (() => {
  const star = (n, R, r, j) => Array.from({ length: n * 2 }, (_, k) => { const a = k * Math.PI / n - Math.PI / 2, d = k % 2 ? r : R * (1 - (k % 4 === 0 ? 0 : j)); return `${(50 + Math.cos(a) * d).toFixed(1)},${(50 + Math.sin(a) * d).toFixed(1)}`; }).join(' ');
  return `<svg class="fx" viewBox="0 0 100 100" aria-hidden="true"><polygon class="f1" points="${star(9, 46, 25, .14)}"/><polygon class="f2" points="${star(7, 24, 12, .1)}"/></svg>`;
})();
// A shot's own motion, drawn only while its move plays (CSS, timed from the move's event; unseen at rest). Over the sea
// (the grid's last child, so nothing clips it): the shell lobbed in from the foot of the sea in the firer's colour, its
// shadow under it, and the spray it throws up where it lands (--fx, --fy: the cell's middle as a part of the sea's
// width and height). In the cell itself: a miss's two ripples. A hit's smoke stays, drifting, while the ship is afloat.
const shot = (i, n, p, hit) => `<i class="bsshot ${p} ${hit ? 'hit' : 'miss'}" style="--fx:${((i % n + 0.5) / n).toFixed(3)};--fy:${((Math.floor(i / n) + 0.5) / n).toFixed(3)}"><i class="bsfly"><s></s><b></b></i><u></u></i>`;
const RIPPLES = '<i class="bsrip"></i><i class="bsrip r2"></i>', SMOKE = '<i class="bssmoke"></i>', BUBBLES = '<i class="bsbub"></i>';
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
// The ship's parts in a row, the first `hits` of them hit (hits: a count, or who made each hit in order: each part
// filled in its hitter's colour; never which part was hit: the parts fill from the stern).
const hitCls = (hits, k) => (Array.isArray(hits) ? (k < hits.length ? ` hit${hits[k] === 'X' || hits[k] === 'O' ? ' ' + hits[k] : ''}` : '') : k < hits ? ' hit' : '');
const hitN = hits => (Array.isArray(hits) ? hits.length : hits);
// (fresh: the newest hit is the move now playing: its part fills as the shell lands, not before)
const silParts = (len, hits, fresh) => Array.from({ length: len }, (_, k) => `<g transform="translate(${k * 100} 0)">${SHIP_PART[shipPart(len, k)].replace('class="hull"', `class="hull${hitCls(hits, k)}${fresh && k === hitN(hits) - 1 ? ' new' : ''}"`)}</g>`).join('');
const shipSil = (len, hits, cls, fresh) => `<svg class="${cls}" viewBox="0 20 ${len * 100} 60" style="--len:${len}" aria-hidden="true">${silParts(len, hits, fresh)}</svg>`;
// Who made each hit on a Shared sea, in order (public: the sea's own record of who fired at each cell).
const hitters = sea => (sea.hits || []).map(i => sea.revealed[i]);
// Under the sea: the ship being hunted, its name and its parts (as many filled in as have been hit).
// (fresh: the square was won just now; newHit: the move now playing hit: the card's words and the part's fill change
// as the shell lands, the words one line at a time in their own room.)
function bsShipCard(mini, hits, sunkBy, fresh, newHit) {
  const len = mini.len || 1, nh = hitN(hits);
  const say = n => `Hunting · ${len} part${len === 1 ? '' : 's'}${n ? `, ${n} hit` : ''}`;
  const what = sunkBy ? 'Sunk!' : say(nh), was = newHit && nh > 0 ? say(nh - 1) : null;
  const line = was && was !== what ? `<span class="tu" style="--u:${BST.land}ms">${was}</span><span class="tf" style="--f:${BST.land}ms">${what}</span>` : `<span>${what}</span>`;
  return `<div class="bsship${sunkBy ? ' sunk ' + sunkBy : ''}${fresh ? ' fresh' : ''}" aria-label="${BS.names[len]}, ${len} part${len === 1 ? '' : 's'}"><div class="nm"><small>${line}</small><b>${BS.names[len]}</b></div>${shipSil(len, hits, 'sil', newHit)}</div>`;
}
// Race: one player's sea as a grid. o.live: this phone's own (its cells the buttons to fire with); else read-only
// spans. o.anim: the cell just fired at; o.ship: the ship's cells once the square has ended (null before);
// o.sunk: that sea's ship went under (the winner's); o.sinking: just now.
function raceSea(mini, p, o) {
  const n = bsN(mini), sea = bsSea(mini, p), hits = sea.hits, ship = o.ship || [];
  const cells = sea.revealed.map((r, i) => {
    const r0 = Math.floor(i / n) + 1, c0 = i % n + 1, hit = hits.includes(i), at = o.anim === i ? ' flipin' : '', k = ship.indexOf(i);
    const tag = o.live ? 'button' : 'span', act = o.live ? ` data-act="move" ${mv(i)}` : '';
    if (k >= 0) {
      const cls = `cell sea ship ${o.sunk ? p : 'ghost'}${o.sinking ? ' sink' : ''}${at}`;
      return `<${tag} class="${cls}"${act} style="--k:${k}" aria-label="Row ${r0} column ${c0}, ship${hit ? ', hit' : ''}"${o.live ? ' disabled' : ''}>${shipSeg(ship, i, n)}${o.sinking || (hit && !o.sunk) ? HITFX : ''}${o.sinking ? BUBBLES : ''}</${tag}>`;
    }
    const cls = hit ? ' bshit' : r ? ' miss' : '', last = r && sea.last === i && !ship.length ? ' last' : '';
    return `<${tag} class="cell sea${cls}${at}${r ? ' by' + p : ''}${last}"${act} aria-label="Row ${r0} column ${c0}${hit ? ', hit' : r ? ', miss' : ''}"${o.live && (r || o.locked) ? ' disabled' : ''}>${hit ? HITFX + SMOKE : ''}${r ? `<i class="bsby ${p}"></i>` : ''}${at && !hit ? RIPPLES : ''}</${tag}>`;
  }).join('');
  return `<div class="bsgrid${o.live ? '' : ' bsog'}${n !== BS.n ? ' n' + n : ''}">${cells}${Number.isInteger(o.anim) ? shot(o.anim, n, p, hits.includes(o.anim)) : ''}</div>`;
}
// Race: a square's two seas (ui/race.js raceBoards): this phone's own with its hunt's card under it, the other's small
// with their ship's parts filled in as they hit them; their counts in the note.
function bsRaceScreen(sq, mini, view, locked, a, fresh) {
  const me = raceMe(), them = raceThem(), len = mini.len || 1, end = !!sq.owner || !!view;
  const one = p => ({ ship: end ? bsShipOf(mini, p) : null, sunk: sq.owner === p, sinking: sq.owner === p && !!fresh, anim: a && a.by === p && Number.isInteger(a.m) ? a.m : null });
  const mine = bsSea(mini, me), theirs = bsSea(mini, them), th = Math.min(len, theirs.hits.length), tm = theirs.revealed.filter(Boolean).length - theirs.hits.length;
  const say = (h, m) => `${h}/${len} hit · ${m} miss${m === 1 ? '' : 'es'}`, shot = a && a.by === them && Number.isInteger(a.m);   // (their shot now playing: the count changes as its shell lands, in the note's own room)
  const note = shot ? `<span class="tu" style="--u:${BST.land}ms">${a.hit ? say(Math.max(0, th - 1), tm) : say(th, Math.max(0, tm - 1))}</span><span class="tf" style="--f:${BST.land}ms">${say(th, tm)}</span>` : say(th, tm);
  const myBoard = `<div class="g-bs bsr2 ${me}">${raceSea(mini, me, Object.assign(one(me), { live: true, locked: locked || end }))}${bsShipCard(mini, mine.hits.slice(0, len).map(() => me), sq.owner === me ? me : null, sq.owner === me && fresh, !!(a && a.by === me && a.hit))}</div>`;
  const theirBoard = `<div class="bsopp${sq.owner === them ? ' sunk' : ''}">${raceSea(mini, them, one(them))}${shipSil(len, th, 'sil bsosil' + (a && a.by === them ? ' live' : ''), !!(a && a.by === them && a.hit))}</div>`;
  return raceBoards(myBoard, theirBoard, note, { cls: 'bsrb' });
}
// A race miniature's ship: upright, chunky, one part a cell (the stern rounded at the top, the bow pointed at the
// foot), the first `hits` parts filled in the hunter's colour (CSS), the others open.
function bsVert(len, hits) {
  return Array.from({ length: len }, (_, k) => {
    const y = k * 100, top = k === 0, bow = k === len - 1;
    const d = `M14,${y + (top ? 30 : 2)}${top ? ` Q14,${y + 6} 50,${y + 6} Q86,${y + 6} 86,${y + 30}` : ` H86`} V${y + (bow ? 62 : 98)}${bow ? ` L50,${y + 96} L14,${y + 62}` : ' H14'} Z`;
    return `<path class="hull${k < hits ? ' hit' : ''}" d="${d}"/><circle class="port" cx="50" cy="${y + (bow ? 42 : 52)}" r="11"/>`;
  }).join('');
}
export function miniature(mini, final) {
  if (mini.race) {                                                                                // a race: each player's ship, the parts they have hit filled in their colour (where they fired: their own sea, open, but too small to draw here)
    const len = mini.len || 1;
    const art = p => { const h = Math.min(len, bsSea(mini, p).hits.length); return `<svg class="bsv" viewBox="0 0 100 ${len * 100}" style="--len:${len}" aria-hidden="true">${bsVert(len, h)}</svg>`; };
    return raceThumb(art, 'tbsr', `Race: ${['X', 'O'].map(p => `${p} ${Math.min(len, bsSea(mini, p).hits.length)} of ${len} hit`).join(', ')}`);
  }
  const sunk = mini.winCells || [], hits = mini.hits || [], len = mini.len || 1;
  const parts = silParts(len, hitters(mini));                     // (each hit part in its hitter's colour)
  return `<div class="tbs"><div class="tg g4 sea${bsN(mini) !== BS.n ? ' n' + bsN(mini) : ''}">${mini.revealed.map((r, i) => `<i class="${sunk.includes(i) ? 'ship ' + (r === 'XO' ? '' : r || '') : hits.includes(i) ? 'hit' : r ? 'miss' : ''}${(r === 'X' || r === 'O') && !sunk.includes(i) ? ' by' + r : ''}"></i>`).join('')}</div>
        <div class="tship" aria-label="${BS.names[len]}, ${len} part${len === 1 ? '' : 's'}"><svg viewBox="0 20 ${len * 100} 60" aria-hidden="true">${parts}</svg></div></div>`;   // (the ship drawn, its name in the label alone: too long a word for the board's floor size)
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  // One hidden ship on a 4x4 sea (Super Chaos: a Submarine on 5x5). A shot shows a hit (a burst) or a miss (a splash), never which
  // way the ship lies; the shot that sinks it reveals the whole ship, which then goes under.
  if (mini.race) return bsRaceScreen(sq, mini, view, locked, a, fresh);
  const n = bsN(mini), sea = mini;
  const hits = sea.hits || [], ship = mini.ship || null, sunk = !!sq.owner && !!ship;
  const shown = ship && (sunk || view) ? ship : [];             // the ship's cells, once it may be seen (Super Chaos: only once the round's end has judged it)
  const sinking = sunk && fresh;
  g = `<div class="g-bs"><div class="bsgrid${n !== BS.n ? ' n' + n : ''}">${sea.revealed.map((r, i) => {
        const r0 = Math.floor(i / n) + 1, c0 = i % n + 1, fire = anim === i, by1 = r === 'X' || r === 'O' ? r : null;
        if (shown.includes(i)) {
          const cls = `cell sea ship ${sunk ? sq.owner : 'ghost'}${sinking ? ' sink' : ''}${fire ? ' flipin' : ''}`;
          return `<button class="${cls}" data-act="move" ${mv(i)} style="--k:${shown.indexOf(i)}" aria-label="Row ${r0} column ${c0}, ship" disabled>${shipSeg(ship, i, n)}${sinking ? HITFX + BUBBLES : ''}</button>`;   // while sinking: the hit bursts give way to the ship
        }
        const hit = hits.includes(i), by = by1 ? [r] : r === 'XO' ? ['X', 'O'] : [];   // (who fired the shot: its mark in their colour; a race reviewed, both: two dots)
        const cls = hit ? ' bshit' : r ? ' miss' : '', last = r && sea.last === i && !view ? ' last' : '';
        return `<button class="cell sea${cls}${fire ? ' flipin' : ''}${by1 ? ' by' + by1 : ''}${last}" data-act="move" ${mv(i)} aria-label="Row ${r0} column ${c0}${hit ? ', hit' : r ? ', miss' : ''}${by.length ? ` (${by.map(p => esc(playerName(state, p))).join(', ')})` : ''}"${r || locked ? ' disabled' : ''}>${hit ? HITFX + SMOKE : ''}${by.map(p => `<i class="bsby ${p}${by.length > 1 ? ' two' : ''}"></i>`).join('')}${fire && !hit ? RIPPLES : ''}</button>`;
      }).join('')}${a && Number.isInteger(anim) && (sea.revealed[anim] === 'X' || sea.revealed[anim] === 'O') ? shot(anim, n, sea.revealed[anim], hits.includes(anim)) : ''}</div>${bsShipCard(mini, hitters(sea), sunk ? sq.owner : null, sinking, !!(a && a.hit))}</div>`;
  return g;
}
export function moveText(f, who) {
  const hit = f.hit !== undefined ? f.hit : !!(f.race && f.race.hit);   // (f.race: a race square from before the rework, its shot redacted)
  return hit ? `${who} hit!` : 'Miss!';
}
export function sounds(f, add, won, mini, last) {
  const hit = f.hit !== undefined ? f.hit : !!(f.race && f.race.hit);
  add('fire', 0); if (hit) { add('boom', BST.land); if (won) add('sink', BST.under - 250); } else add('splash', BST.land); return;   // (the whistle of the shell, then its landing: rules.js BST)
}
