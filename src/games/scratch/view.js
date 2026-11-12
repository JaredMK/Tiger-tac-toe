// Scratch & Match: the screen, the miniature, the move's words and sounds, and the inputs.
import { SCR, scrBest, scrCounts, scrOpen } from './rules.js';
import { REDUCED, mv, state, viewer } from '../../ui/app.js';
import { toon } from '../../ui/art.js';
import { arcTally, lateAt, pips } from '../../ui/progress.js';

// The pictures (original drawings, each in its own colour, on a 24 x 24 box): a square deals `kinds` of them (mini.pics
// names which, by index here; a picture on a card is an index into that list). The names are for the result line and
// the labels.
export const PICS = [
  { id: 'apple', name: 'an apple', pl: 'apples', c: '#d64545', g: '<path class="pf" d="M12 7.6c-1.5-1.3-3.7-1.4-5.1 0-2.1 2-2.1 5.5-.3 8.4 1.2 2 2.8 3.2 4 3h2.8c1.2.2 2.8-1 4-3 1.8-2.9 1.8-6.4-.3-8.4-1.4-1.4-3.6-1.3-5.1 0z"/><path class="pk" d="M12 7.6V4.8"/><path class="pl" d="M12.3 4.9c.4-1.6 1.6-2.5 3.4-2.4-.2 1.7-1.5 2.6-3.4 2.4z"/>' },
  { id: 'pear', name: 'a pear', pl: 'pears', c: '#a9cc3a', g: '<path class="pf" d="M12 5c-1.6 0-2.5 1.5-2.8 3.4-.3 1.9-2.7 3-2.7 5.9 0 3.3 2.5 5.4 5.5 5.4s5.5-2.1 5.5-5.4c0-2.9-2.4-4-2.7-5.9C14.5 6.5 13.6 5 12 5z"/><path class="pk" d="M12 5V2.6"/>' },
  { id: 'star', name: 'a star', pl: 'stars', c: '#f5b400', g: '<path class="pf" d="M12 2.8l2.7 5.8 6.3.7-4.7 4.3 1.3 6.2L12 16.6l-5.6 3.2 1.3-6.2L3 9.3l6.3-.7z"/>' },
  { id: 'heart', name: 'a heart', pl: 'hearts', c: '#ef5fa0', g: '<path class="pf" d="M12 20.4s-7.6-4.7-7.6-10.2A4.3 4.3 0 0 1 12 7.9a4.3 4.3 0 0 1 7.6 2.3c0 5.5-7.6 10.2-7.6 10.2z"/>' },
  { id: 'moon', name: 'a moon', pl: 'moons', c: '#9b87e6', g: '<path class="pf" d="M14.5 3a8.6 8.6 0 1 0 6.2 15.6A7.4 7.4 0 0 1 14.5 3z"/>' },
  { id: 'fish', name: 'a fish', pl: 'fish', c: '#3f8fbf', g: '<path class="pf" d="M2.8 12c2.4-3.6 5.4-5.6 8.8-5.6 2.9 0 5.3 2.2 6.9 5.6-1.6 3.4-4 5.6-6.9 5.6-3.4 0-6.4-2-8.8-5.6z"/><path class="pf" d="M18.3 12l3.4-4.2v8.4z"/><circle class="pe" cx="7.2" cy="11" r="1.1"/>' },
  { id: 'carrot', name: 'a carrot', pl: 'carrots', c: '#f08a24', g: '<path class="pf" d="M6.5 20.8L13.2 8.6l3.6 2.1-8.5 11z"/><path class="pk pg" d="M13.4 8.4l-1.4-4.2M14.9 9.2l2.6-3.4M16 10.3l3.8-1.2"/>' },
  { id: 'clover', name: 'a clover', pl: 'clovers', c: '#3f9d4a', g: '<circle class="pf" cx="8.8" cy="9.2" r="3.7"/><circle class="pf" cx="15.2" cy="9.2" r="3.7"/><circle class="pf" cx="12" cy="14.6" r="3.7"/><path class="pk" d="M12 15.5v5.7"/>' },
];
export const picOf = (mini, sym) => PICS[(mini && Array.isArray(mini.pics) && mini.pics[sym] != null ? mini.pics[sym] : sym) % PICS.length] || PICS[0];
const picSvg = pic => `<svg class="spic" viewBox="0 0 24 24" style="--pc:${pic.c}" aria-hidden="true">${pic.g}</svg>`;
// The foil over a picture: five bands, rubbed away one after the other when the panel is scratched (a coin rubbing
// along each, flecks of foil flying off).
const FOIL = '<span class="sfrost" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span>';
const FLECKS = [[40, -.5, -.8], [110, .7, -.6], [170, -.9, .1], [240, .6, .5], [300, -.3, .9], [370, 1, -.1], [440, -.7, -.5], [500, .3, -1], [560, -.8, .6], [620, .8, .3]];   // each fleck: its moment (ms into the rub) and its way off the panel (in panels, x and y)
const fleck = ([t, x, y]) => {   // it leaves from where the coin is then (the band being rubbed, along it)
  const k = Math.min(4, Math.floor(t / 130)), fr = (t % 130) / 130, at = k % 2 ? 1 - fr : fr;
  return `<i class="sflk" style="left:${Math.round(at * 100)}%;top:${10 + k * 20}%;--fx:${x};--fy:${y};--fd:${t}ms" aria-hidden="true"></i>`;
};
const rubFx = `<span class="scoin" aria-hidden="true"></span>${FLECKS.map(fleck).join('')}`;
// What a scratch came to, for the result line: the picture and, once it matters, the count.
const FOUND = { 2: 'Pair!', 3: 'Three!' };
const foundSay = (pic, c) => FOUND[Math.min(SCR.need, c)] || pic.name.replace(/^an? /, '').replace(/^./, ch => ch.toUpperCase());

// The miniature: both cards side by side (X's left, O's right, each framed in its player's colour), every panel
// foil until scratched, then its picture; the three of a kind, once shown, tinted and struck through.
export function miniature(mini, final) {
  const card = (p, x0) => {
    const open = scrOpen(mini, p), cells = Array.isArray(mini.winCells) && scrBest(open) >= SCR.need ? mini.winCells : [];
    const at = i => [x0 + 3.5 + (i % 3) * 11, 3.5 + Math.floor(i / 3) * 11];
    const cell = (v, i) => {
      const [cx, cy] = at(i);
      if (v == null) return `<rect class="tsf" x="${cx}" y="${cy}" width="9.5" height="9.5" rx="2"/>`;
      const pic = picOf(mini, v);
      return `<rect class="tsp${cells.includes(i) ? ' tsw' : ''}" x="${cx}" y="${cy}" width="9.5" height="9.5" rx="2"/><g class="tspic" transform="translate(${(cx + .55).toFixed(2)} ${(cy + .55).toFixed(2)}) scale(.35)" style="--pc:${pic.c}">${pic.g}</g>`;
    };
    const line = cells.length >= SCR.need ? (() => { const [x1, y1] = at(cells[0]), [x2, y2] = at(cells[cells.length - 1]); return `<path class="tsl" d="M${x1 + 4.75} ${y1 + 4.75}L${x2 + 4.75} ${y2 + 4.75}"/>`; })() : '';
    return `<g class="tsc ${p}"><rect class="tsb" x="${x0}" y="0" width="39" height="39" rx="5"/><rect class="tsg" x="${x0 + 2}" y="2" width="35" height="35" rx="3"/>${open.map(cell).join('')}${line}</g>`;
  };
  const best = p => scrBest(scrOpen(mini, p));
  return `<svg class="tscr" viewBox="-1 -1 86 41" aria-label="X has ${best('X')} of a kind, O has ${best('O')} of a kind">${card('X', 0)}${card('O', 45)}</svg>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  // Both players' tallies up top (name, three pips for the most of any picture on show). Under them this phone's own
  // card, large (two on one phone: the mover's), and the other player's small beside the result line: each a ticket
  // framed in its player's colour with their face on its tab, the one on the move lit. A card is nine foil panels; a
  // scratched one shows its picture, and two of a kind on show are ringed in the player's colour. The move just made
  // (a: its recorded flash, never the square's last) is scratched off its panel: a coin rubs the foil away band by
  // band, flecks flying, the picture pops, a pair's two panels ring together, and three of a kind are struck through
  // along their line and hop in turn (the game's own winning moment; the claim is the board's). The result line says
  // what the scratch came to (the last one stays on show).
  const s = a && a.scratch ? a.scratch : null, o = { view, locked, turn, zoom: state.zoom }, land = SCR.rub + SCR.pop, live = !!s && !REDUCED;
  // (the large card's class is `slg`, never `big`: `.big` is the app's big button, and its :active squash once pressed the whole card in)
  const big = viewer() || (s ? s.by : view && sq.owner ? sq.owner : turn) || 'X';
  const tal = p => {
    const open = scrOpen(mini, p), best = scrBest(open), moved = !!(s && s.by === p && s.c === best && s.c !== scrBest(open.map((v, i) => (i === s.spot ? null : v))));
    return arcTally(p, o, pips(p, best, SCR.need, moved, land));
  };
  const card = p => {
    const open = scrOpen(mini, p), mine = !view && turn === p, cells = sq.owner === p && Array.isArray(mini.winCells) ? mini.winCells : [];
    const counts = scrCounts(open), l = mini.last && mini.last.by === p ? mini.last.spot : null;
    const spots = open.map((v, i) => {
      const r = Math.floor(i / 3) + 1, c = (i % 3) + 1, rub = !!(s && s.by === p && s.spot === i), pic = v != null ? picOf(mini, v) : null;
      const win = cells.includes(i), hit = !!(s && s.by === p && s.c === 2 && !win && (rub || (s.same || []).includes(i)));
      const pair = v != null && !win && counts[v] === 2;   // two of a kind on show: ringed (once this move's own ring has played)
      const cls = `sspot${v != null ? ' open' : ''}${rub ? ' rub' : ''}${hit ? ' hit' : ''}${pair && !hit ? ' pr' : ''}${win ? ' wn' : ''}${win && fresh ? ' glow' : ''}${!rub && !s && l === i ? ' lst' : ''}`;
      const label = `Row ${r} column ${c}${pic && !rub ? `, ${pic.name.replace(/^an? /, '')}` : rub ? '' : ', foil'}`;
      if (v == null || rub) return `<button class="${cls}"${mine ? ` data-act="move" ${mv(i)}` : ''}${win ? ` style="--k:${wk(i)}"` : ''} aria-label="${label}"${locked || !mine || rub ? ' disabled' : ''}>${pic ? picSvg(pic) : ''}${FOIL}${rub && live ? rubFx : ''}</button>`;
      return `<button class="${cls}"${win ? ` style="--k:${wk(i)}"` : ''} aria-label="${label}" disabled>${picSvg(pic)}</button>`;
    }).join('');
    // three of a kind: the line through them, drawn as the picture lands
    const line = cells.length >= SCR.need ? (() => { const at = i => [(i % 3) + .5, Math.floor(i / 3) + .5], [x1, y1] = at(cells[0]), [x2, y2] = at(cells[cells.length - 1]); const d = `M${x1} ${y1}L${x2} ${y2}`; return `<svg class="swline${fresh && live ? ' draw' : ''}" viewBox="0 0 3 3" aria-hidden="true"><path class="swo" d="${d}" pathLength="1"/><path class="swi" d="${d}" pathLength="1"/></svg>`; })() : '';
    return `<div class="scard ${p}${p === big ? ' slg' : ' sml'}${mine ? ' on' : ''}${cells.length ? ' won' : ''}" role="group" aria-label="${p}'s card"><span class="stab" aria-hidden="true">${toon(p)}</span><div class="sgrid">${spots}${line}</div></div>`;
  };
  // the result line: what the scratch came to, popping in as the picture lands; at rest, the last scratch's
  const r = s ? { by: s.by, pic: PICS[(s.pic != null ? s.pic : s.sym) % PICS.length] || PICS[0], c: s.c } : mini.last && mini.last.sym != null ? { by: mini.last.by, pic: picOf(mini, mini.last.sym), c: mini.last.c } : null;
  const found = r ? `<div ${lateAt(`sfound ${r.by} c${Math.min(SCR.need, r.c)}`, live ? SCR.rub : null)} role="status">${toon(r.by)}${picSvg(r.pic)}<b>${foundSay(r.pic, r.c)}</b></div>` : '<div class="sfound none">&nbsp;</div>';
  const small = big === 'X' ? 'O' : 'X';
  g = `<div class="g-scratch"><div class="ctals">${tal('X')}${tal('O')}</div><div class="smain">${card(big)}</div><div class="sbot"><div class="ssml">${card(small)}</div><div class="sline">${found}</div></div></div>`;
  return g;
}
export function moveText(f, who) {
  const s = f.scratch;
  if (!s) return `${who} scratched`;
  const pic = PICS[(s.pic != null ? s.pic : s.sym) % PICS.length] || PICS[0];
  if (s.c >= SCR.need) return `${who} found three ${pic.pl}!`;
  if (s.c === 2) return `${who} found a pair of ${pic.pl}`;
  return `${who} found ${pic.name}`;
}
// The foil rasps away under the coin, the picture plops in; a pair rings once, three of a kind sparkle.
export function sounds(f, add, won, mini, last) {
  add('scratch', 0); add('scratch', 200, 1.1); add('scratch', 400, .94); add('scratch', 520, 1.04);
  add('plop', SCR.rub);
  const s = f.scratch;
  if (won) add('sparkle', SCR.rub + SCR.pop);
  else if (s && s.c === 2) add('ding', SCR.rub + SCR.pop);
}
