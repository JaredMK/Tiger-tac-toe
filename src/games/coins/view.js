// Coin Flip: the screen, the miniature, the move's words and sounds, and the inputs.
import { other } from '../../core/util.js';
import { COINS, coinMax } from './rules.js';
import { esc, mv, state } from '../../ui/app.js';
import { markSvgG } from '../../ui/thumbs.js';
import { arcTally, lateAt } from '../../ui/progress.js';

// A toss, in the move's time (the stylesheet's coinfly/coinspin/coinsq run 1 s a coin, each coin `gap` after the one
// before: down at 78%, a small bounce after; rules.js flashMs covers the last one's bounce, and a win's wave after it).
export const COIN_T = { land: 780, gap: 80, len: 1000 };
// The miniature: the row of coins, each in its side's colour with its mark drawn (no letters: too small to read), the
// mystery coin white with a drawn question mark; sized to fill the width (styles.css .tcoin, --n).
const COIN_Q = '<path d="M8.6 9a3.6 3.6 0 1 1 5.2 3.2c-1.2.6-1.8 1.4-1.8 2.6" stroke-width="2.8" stroke-linecap="round" fill="none"/><circle cx="12" cy="18.6" r="1.7"/>';
export function miniature(mini, final) {
  const face = c => (c === COINS.mystery ? COIN_Q : markSvgG(c, 6));
  return `<div class="tcoin" style="--n:${mini.coins.length}" aria-label="Coins: ${mini.coins.map(c => (c === COINS.mystery ? 'mystery' : c)).join(', ')}">${mini.coins.map(c => `<i class="${c === COINS.mystery ? 'm' : esc(c)}"><svg viewBox="${c === COINS.mystery ? '0 0 24 24' : '-12 -12 24 24'}" aria-hidden="true">${face(c)}</svg></i>`).join('')}</div>`;
}
// A coin's face: its side's drawn mark (the mystery coin's question mark) inside a milled rim.
const side = c => (c === 'X' || c === 'O' ? c : 'm');
const faceSvg = c => `<svg viewBox="-12 -12 24 24" aria-hidden="true"><circle class="rim" r="9.2"/>${side(c) === 'm' ? `<g class="q" transform="translate(-12 -12)">${COIN_Q}</g>` : markSvgG(c, 5.2)}</svg>`;
const face = (cls, c) => `<span class="${cls} ${side(c)}">${faceSvg(c)}</span>`;
// The move on show: what it flipped, what each coin was and what it landed as. From the move itself (its flash: the
// replayed move's own), a flash from before it carried them falling back on the square's last flip.
function tossOf(a, mini) {
  const src = a && Array.isArray(a.flipped) && Array.isArray(a.results) ? a : a && mini.last && Array.isArray(mini.last.flipped) ? mini.last : null;
  return src ? { flipped: src.flipped, was: src.was || [], res: src.results || [] } : { flipped: [], was: [], res: [] };
}
// A player's tally: one pip a coin, lit for each coin showing their side. While a flip plays, a pip fills as the coin that
// won it lands and empties as the coin that lost it lands (a pip that would do both in one flip just stays).
function tally(p, o, cn, now, toss) {
  const ev = [];                                                   // [time, +1 | -1] for p, in the order the coins land
  toss.flipped.forEach((i, j) => { const from = toss.was[j], to = toss.res[j]; if (from !== to && (from === p || to === p)) ev.push([COIN_T.land + j * COIN_T.gap, to === p ? 1 : -1]); });
  let c = now - ev.reduce((s, e) => s + e[1], 0);                  // their coins before the flip
  const at = {};                                                   // pip -> [time, 'fillin' | 'cdrain'] (null: both in one flip)
  for (const [t, dir] of ev) { const k = dir > 0 ? c : c - 1; at[k] = k in at ? null : [t, dir > 0 ? 'fillin' : 'cdrain']; c += dir; }
  const pips = Array.from({ length: cn }, (_, k) => { const e = at[k]; return `<i ${lateAt(k < now ? 'on' : '', e ? e[0] : null, e ? e[1] : undefined)}></i>`; }).join('');
  return arcTally(p, o, `<span class="pips${cn > 5 ? ' many' : ''}" aria-label="${now} of ${cn}">${pips}</span>`);
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  // Five coins: two each and a mystery coin (?) that belongs to nobody until it is flipped. Each is a real coin, an X on
  // one side and an O on the other: a flip tosses it up spinning and it lands on the side the move drew.
  const toss = tossOf(a, mini), flipped = toss.flipped;
  // "Flip N" stays what the player on the move started with while their flip plays and its result is up;
  // it is worked out again only when the next player comes into the square.
  const held = (a || (d && d.square === state.zoom)) && mini.last && Array.isArray(mini.last.flipped);
  const before = held ? mini.coins.map((c, i) => { const k = mini.last.flipped.indexOf(i); return k >= 0 && mini.last.was ? mini.last.was[k] : c; }) : mini.coins;
  const n = Math.min(coinMax(mini), before.filter(c => c !== (held ? mini.last.by : turn)).length);
  const marked = !view && !a && !d && mini.marks && mini.marks.by === turn ? mini.marks.coins : [];   // the coins this turn's flip will turn, picked as the turn started
  const cn = mini.coins.length, cols = Math.max(5, cn);           // (fewer than five: centred in the five columns)
  const by = a ? a.by : turn, all = fresh && sq.owner ? sq.owner : '';   // (all: the flip that made them all one side: its wave, in that side's colour)
  const count = p => mini.coins.filter(c => c === p).length, o = { view, turn };
  const row = (cn !== 5 ? `grid-template-columns:repeat(${cols},1fr);${cn > 5 ? 'gap:5px;padding:0 6px;' : ''}` : '') + (all ? `--w:${COIN_T.len + Math.max(0, flipped.length - 1) * COIN_T.gap}ms;` : '');   // (--w: the last coin down, the wave's start)
  g = `<div class="g-coins"><div class="coins${all ? ' all' : ''}"${row ? ` style="${row}"` : ''}>${mini.coins.map((c, i) => {
        const j = flipped.indexOf(i), flip = j >= 0, from = flip ? toss.was[j] : null, to = flip && toss.res[j] ? toss.res[j] : c, mk = marked.includes(i);
        // a coin in the air: its two sides (the one it lands on, and the other), turning from the side it showed (the
        // mystery coin from its question mark, on the back until it is first edge on)
        const faces = flip ? face('cf', to) + face('cb', other(to)).replace('</span>', `${side(from) === 'm' ? face('cq', from) : ''}</span>`) : face('cf', c);
        const st = (flip ? `--k:${j};--r0:${side(from) !== 'm' && from === to ? -1440 : -1260}deg;` : '') + `--i:${i};` + (i === 0 && cn < 5 ? `grid-column-start:${1 + (5 - cn) / 2};` : '');
        return `<span class="coin ${side(to)}${flip ? ` flip by${by}${from !== to ? ' chg' : ''}` : ''}${mk ? ` mk mk${turn}` : ''}" style="${st}" aria-label="Coin ${i + 1}, ${side(to) === 'm' ? 'mystery' : esc(to)}${mk ? ', flips next' : ''}"><i class="csh"></i><span class="cj"><span class="ci">${faces}</span></span></span>`;
      }).join('')}</div>
        <div class="ctals">${tally('X', o, cn, count('X'), toss)}${tally('O', o, cn, count('O'), toss)}</div>
        <button class="big ${turn}" data-act="move" ${mv('flip')}${locked ? ' disabled' : ''}${view ? ' style="visibility:hidden" aria-hidden="true"' : ''}>Flip${view ? '' : ' ' + n}</button></div>`;   // (a finished square: nothing left to flip; its room kept, so the row stands where it stood)
  return g;
}
export function moveText(f, who) {
  return `${who} flipped ${f.n}`;
}
// The thumb's flick and the coins' ring as they go up; a clink as each one lands.
export function sounds(f, add, won, mini, last) {
  add('coinFlick', 0); add('coinSpin', 30); for (let k = 0; k < (f.n || 0); k++) add('clink', COIN_T.land + k * COIN_T.gap); return;
}
