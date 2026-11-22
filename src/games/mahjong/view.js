// Mahjong: the screen, the miniature, the move's words and sounds, and the inputs (December 2026: the hand-building game).
// The table: the other player's hand at the top as tile backs (theirs alone; a tile they took off the pile was on show
// and stays face up while it is the one in hand), the wall (face down, its count on it) and the discard pile (its top
// tile up, the one under it peeking) in the middle, each a tap to take (the pile only in Shared; in a race the wall and
// pile of whoever is on the move), the move's line, and this phone's own hand at the bottom: the sets it holds first,
// each on a soft tint in the player's colour, then the pair on a dotted one, then the loose tiles; a tap on a tile with
// one taken throws it. A take flies the tile into the hand (a wall tile of one's own turning up as it lands); a throw
// flies it onto the pile. A winning take lights the whole hand. The tiles are one size whatever the hand holds.
// The faces are original: Dots (red rings), Bars (green sticks), Stars (blue stars) with their number in the corner, and
// the honours Sun, Moon and Cloud.
import { mjCfg, mjName, mjSets, mjSort, mjTimes } from './rules.js';
import { N, REDUCED, mv, state, waitLine } from '../../ui/app.js';
import { cfAnchor, cfFrom } from '../../ui/cardfly.js';
import { arcTally, lateAt } from '../../ui/progress.js';
import { pipRows, thumbArt, markSvgG } from '../../ui/thumbs.js';
import { mySide } from '../../net/room.js';

const W = p => `<b class="${p}">${N(p)}</b>`;
const other = p => (p === 'X' ? 'O' : 'X');
const keyOf = (mini, p) => (mini.mode === 'shared' ? 'S' : p);
// A tile's face, in a 20 x 28 box: the pips of its number, its number in the corner; an honour its picture.
const SPOTS = {
  1: [[10, 15]], 2: [[10, 9], [10, 21]], 3: [[5.5, 8], [10, 15], [14.5, 22]], 4: [[6, 9], [14, 9], [6, 21], [14, 21]],
  5: [[6, 9], [14, 9], [10, 15], [6, 21], [14, 21]], 6: [[6, 8], [14, 8], [6, 15], [14, 15], [6, 22], [14, 22]],
  7: [[6, 8], [14, 8], [6, 15], [10, 15], [14, 15], [6, 22], [14, 22]], 8: [[6, 7], [14, 7], [6, 12], [14, 12], [6, 18], [14, 18], [6, 23], [14, 23]],
  9: [[5, 8], [10, 8], [15, 8], [5, 15], [10, 15], [15, 15], [5, 22], [10, 22], [15, 22]],
};
const star = (x, y, r) => { let d = ''; for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, q = k % 2 ? r * 0.45 : r; d += `${k ? 'L' : 'M'}${(x + q * Math.cos(a)).toFixed(2)} ${(y + q * Math.sin(a)).toFixed(2)}`; } return `<path class="mjs" d="${d}Z"/>`; };
function face(t) {
  const s = t[0], n = Number(t.slice(1));
  if (s === 'h') {
    if (n === 1) return `<g class="mjsun"><circle cx="10" cy="15" r="4.6"/>${Array.from({ length: 8 }, (_, k) => { const a = k * Math.PI / 4; return `<path d="M${(10 + 6.2 * Math.cos(a)).toFixed(2)} ${(15 + 6.2 * Math.sin(a)).toFixed(2)}L${(10 + 8.4 * Math.cos(a)).toFixed(2)} ${(15 + 8.4 * Math.sin(a)).toFixed(2)}"/>`; }).join('')}</g>`;
    if (n === 2) return '<path class="mjmoon" d="M12.5 7.5a7.6 7.6 0 1 0 0 15a6 6 0 1 1 0-15z"/>';
    return '<path class="mjcloud" d="M5 19.5a3.4 3.4 0 0 1 .6-6.7a4.6 4.6 0 0 1 8.8-.8a3.8 3.8 0 0 1 .6 7.5z"/>';
  }
  const at = SPOTS[n] || SPOTS[1], big = n <= 4, r = n === 1 ? 4.2 : big ? 3 : n <= 6 ? 2.5 : 2.1;
  const pip = ([x, y]) => (s === 'd' ? `<circle class="mjd" cx="${x}" cy="${y}" r="${r}"/>` : s === 'b' ? `<rect class="mjb" x="${(x - r * 0.42).toFixed(2)}" y="${(y - r * 1.05).toFixed(2)}" width="${(r * 0.84).toFixed(2)}" height="${(r * 2.1).toFixed(2)}" rx="${(r * 0.3).toFixed(2)}"/>` : star(x, y, r * 1.15));
  return at.map(pip).join('') + `<text class="mjn" x="2.4" y="6.3">${n}</text>`;
}
export const mjTile = (t, cls = '', extra = '') => (t
  ? `<span class="mjt su-${t[0]}${cls ? ' ' + cls : ''}"${extra} title="${mjName(t)}"><svg viewBox="0 0 20 28" aria-hidden="true">${face(t)}</svg></span>`
  : `<span class="mjt bk${cls ? ' ' + cls : ''}"${extra}><svg viewBox="0 0 20 28" aria-hidden="true"><rect class="mjbk" x="4" y="5" width="12" height="18" rx="4"/></svg></span>`);
const handN = (mini, p) => (mini.hn && Number.isInteger(mini.hn[p]) ? mini.hn[p] : Array.isArray(mini.hand && mini.hand[p]) ? mini.hand[p].length : mjCfg(mini).hand);
// p's hand as this page holds it, in step with the public record (its node can be a moment behind it); null: not this page's.
export function mjHand(mini, p) {
  if (!mini.hand || !Array.isArray(mini.hand[p])) return null;
  let h = mini.hand[p].slice();
  const n = handN(mini, p), l = mini.last, held = mini.held;
  if (h.length === n + 1 && l && l.kind === 'discard' && l.by === p && h.includes(l.d)) h.splice(h.indexOf(l.d), 1);
  if (h.length === n - 1 && held && held.by === p && held.t) h = mjSort(h.concat(held.t));
  return h;
}
// A hand laid out: the sets, the pair, the loose tiles (each a group).
function laid(h) {
  const { sets, pair } = mjSets(h), left = h.slice();
  const take = g => g.forEach(t => left.splice(left.indexOf(t), 1));
  sets.forEach(take); if (pair) take(pair);
  return { sets, pair, left };
}
let kept = null;
function table(sq, mini, a, o) {
  const s = a && a.mj ? a.mj : null, turn = o.turn, cfg = mjCfg(mini), m = cfg.sets, anim = !!s && !REDUCED;
  const held = mini.held, by = s ? a.by : held ? held.by : turn;
  const me = mySide() || by, opp = other(me), open = o.view || !!(sq && sq.owner);
  const mine = !o.view && !o.locked && by === turn && by === me, canTake = mine && !held, canThrow = mine && !!held && held.by === me;
  const hand = { [me]: mjHand(mini, me), [opp]: open ? mjHand(mini, opp) : null };
  const key = `${state.online ? state.online.game || state.online.code || '' : ''}:${state.zoom}:${me}`;
  if (hand[me]) kept = { key, hand: hand[me].slice() };
  else if (state.online && kept && kept.key === key && kept.hand.length === handN(mini, me)) hand[me] = kept.hand.slice();
  const tim = mjTimes(s), takeNow = anim && s.kind === 'take', throwNow = anim && s.kind === 'discard', winNow = anim && s.kind === 'take' && s.win;
  // the tallies: the sets each hand holds, as pips (public: how many, never which)
  const tal = p => { const n = Math.min(m, (mini.sc && mini.sc[p]) || 0); return arcTally(p, o, `<span class="pips" aria-label="${n} of ${m} sets">${Array.from({ length: m }, (_, k) => `<i class="${k < n ? 'on' : ''}"></i>`).join('')}</span>`); };
  // the wall and the pile: the shared ones, or in a race the mover's
  const wk = keyOf(mini, by), pile = (mini.pile && mini.pile[wk]) || [], top = pile.length ? pile[pile.length - 1] : null, under = pile.length > 1 ? pile[pile.length - 2] : null;
  const left = mini.left && Number.isInteger(mini.left[wk]) ? mini.left[wk] : 0, shared = mini.mode === 'shared', pileTake = canTake && shared && !!top;
  const wallBtn = `<button class="mjwall${canTake ? ' can' : ''}"${cfAnchor('wall')} data-act="move" ${mv('wall')}${canTake ? '' : ' disabled tabindex="-1"'} aria-label="Take from the wall (${left} left)"><span class="mjstk" aria-hidden="true">${mjTile(null)}${mjTile(null)}${mjTile(null)}</span><span class="mjcnt">${left}</span>${shared ? '' : `<svg class="mjwho ${by}" viewBox="-10 -10 20 20" aria-hidden="true">${markSvgG(by, 5.5)}</svg>`}</button>`;
  const thrown = throwNow ? cfFrom(a.by === me ? 'mjh:' + s.d : 'opp', 0) : '';
  const pileBtn = `<button class="mjpile${pileTake ? ' can' : ''}"${cfAnchor('pile')} data-act="move" ${mv('pile')}${pileTake ? '' : ' disabled tabindex="-1"'} aria-label="${top ? (shared ? `Take the ${mjName(top)}` : `Discards: ${mjName(top)} on top`) : 'No discards yet'}">${under ? mjTile(under, 'mjun') : ''}${top ? mjTile(top, 'mjtop', thrown) : '<span class="mjt mje" aria-hidden="true"></span>'}</button>`;
  // this phone's hand: the sets on a soft tint, the pair dotted, the tile just taken marked
  const mineRow = () => {
    const h = hand[me] || [], n = handN(mini, me), L = laid(h), myTake = takeNow && a.by === me;
    const fresh = held && held.by === me && held.t ? held.t : null;
    let freshUsed = false;
    const tileEl = t => {
      const isNew = !freshUsed && t === fresh; if (isNew) freshUsed = true;
      const fly = isNew && myTake ? cfFrom(s.from, tim.at) : '';
      const cls = `${isNew ? 'new' : ''}${canThrow ? ' can' : ''}`;
      const inner = mjTile(t, isNew && myTake && s.from === 'wall' ? 'flipin' : '', isNew && myTake ? ` style="--t:${Math.round(tim.land)}ms"` : '');
      return canThrow ? `<button class="mjh ${cls}"${cfAnchor('mjh:' + t)}${fly} data-act="move" ${mv({ d: t })} aria-label="Throw the ${mjName(t)}">${inner}</button>`
        : `<span class="mjh ${cls}"${cfAnchor('mjh:' + t)}${fly}>${inner}</span>`;
    };
    const lit = winNow && a.by === me ? ` style="--t:${Math.round(tim.win)}ms"` : '';
    const grp = (g, c) => `<span class="mjgrp ${c}${lit ? ' won' : ''}"${lit}>${g.map(tileEl).join('')}</span>`;
    const body = L.sets.map(g => grp(g, 'set')).join('') + (L.pair ? grp(L.pair, 'pair') : '') + (L.left.length ? `<span class="mjgrp loose">${L.left.map(tileEl).join('')}</span>` : '');
    const waits = Array.from({ length: Math.max(0, n - h.length) }, () => `<span class="mjh">${mjTile(null)}</span>`).join('');
    return `<div class="mjhand ${me}" aria-label="Your hand">${body}${waits}</div>`;
  };
  // the other hand: backs (a tile off the pile face up while it is the one in hand); a square won: turned up and laid out
  const oppRow = () => {
    const n = handN(mini, opp), h = hand[opp], shown = !h && held && held.by === opp && held.from === 'pile' && held.t ? held.t : null;
    const oppTake = takeNow && a.by === opp;
    let tiles;
    if (h) { const L = laid(h); tiles = [...L.sets.map(g => ({ g, c: 'set' })), ...(L.pair ? [{ g: L.pair, c: 'pair' }] : []), ...(L.left.length ? [{ g: L.left, c: 'loose' }] : [])].map(x => `<span class="mjgrp ${x.c}">${x.g.map(t => mjTile(t)).join('')}</span>`).join(''); }
    else tiles = Array.from({ length: n }, (_, k) => { const last = k === n - 1 && n > cfg.hand; return mjTile(last ? shown : null, '', (k === n - 1 ? cfAnchor('opp') : '') + (oppTake && last ? cfFrom(s.from, tim.at) : '')); }).join('');
    return `<div class="mjopp ${opp}"><svg class="mjmk ${opp}" viewBox="-10 -10 20 20" aria-label="${opp}'s hand">${markSvgG(opp, 5.5)}</svg><div class="mjoh">${tiles}</div></div>`;
  };
  let line;
  const shuf = s && s.reshuf ? '<small class="mjsh">Wall shuffled</small>' : '';
  if (s && s.kind === 'take') {
    if (s.win) line = `<p ${lateAt('arcres ok', anim ? tim.win : null)} role="status">Mahjong!</p>`;
    else { const t = a.by === me && held && held.by === me ? held.t : s.t; line = `<p ${lateAt('arcres', anim ? tim.land : null)} role="status">${a.by === me && t ? `Took the ${mjName(t)}` : s.t ? `${W(a.by)} took the ${mjName(s.t)}` : `${W(a.by)} drew a tile`}${shuf}</p>`; }
  } else if (s && s.kind === 'discard') line = `<p ${lateAt('arcres', anim ? tim.land : null)} role="status">${W(a.by)} threw the ${mjName(s.d)}</p>`;
  else line = `<p class="arcnote">${o.view ? '' : o.locked || by !== turn || by !== me ? waitLine(by) : ''}</p>`;
  return `<div class="g-arc mj2 pc-${by}" style="--n:${cfg.hand + 1}"><div class="ctals">${tal('X')}${tal('O')}</div>
    <div class="mjfelt${throwNow ? ' cfup' : ''}">${oppRow()}<div class="mjmid">${wallBtn}${pileBtn}</div>${line}${mineRow()}</div></div>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  if (mini.v !== 2) return '<div class="g-arc mj2"><p class="arcnote">This square is from an older version.</p></div>';
  return table(sq, mini, a, { view, locked, turn, done: !!d });
}
// The miniature (public alone): the felt with the wall and the pile's top tile, and the sets each player holds as pips.
export function miniature(mini, final) {
  if (mini.v !== 2) return '<div class="tart tmj"></div>';
  const m = mjCfg(mini).sets, n = p => Math.min(m, (mini.sc && mini.sc[p]) || 0), k = mini.mode === 'shared' ? 'S' : 'X';
  const pile = (mini.pile && mini.pile[k]) || [], top = pile.length ? pile[pile.length - 1] : null;
  const art = `<div class="tmjf">${mjTile(null, 'tmjt')}${top ? mjTile(top, 'tmjt') : '<span class="mjt mje tmjt"></span>'}</div>`;
  return thumbArt(art, pipRows({ X: n('X'), O: n('O') }, m), 'tmjw', `Mahjong: X ${n('X')}, O ${n('O')} of ${m} sets`);
}
export function moveText(f, who) {
  const r = f.mj;
  if (!r) return `${who} played`;
  if (r.kind === 'take') return r.win ? `${who} made Mahjong` : `${who} took ${r.from === 'pile' ? 'the discard' : 'from the wall'}`;
  return `${who} threw the ${mjName(r.d)}`;
}
// A take: the tile sliding in (a tap as it turns up); a throw: the slide and the clack onto the pile; a win: a sparkle.
export function sounds(f, add, won, mini, last) {
  const r = f.mj; if (!r) return;
  const t = mjTimes(r);
  if (r.kind === 'take') {
    if (r.reshuf) { add('cardSlide', 0, 1.2); add('cardSlide', 120, 1.3); }
    add('cardSlide', t.at); add('mjTap', t.land);
    if (r.win) add('sparkle', t.win);
    return;
  }
  add('cardSlide', 0); add('mjClack', t.land);
}
export function heldSub(mini, turn, f) { return f ? '' : `${W(turn)}: throw a tile`; }
