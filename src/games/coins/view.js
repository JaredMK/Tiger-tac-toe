// Coin Flip: the screen, the miniature, the move's words and sounds, and the inputs.
import { other } from '../../core/util.js';
import { COINS } from './rules.js';
import { mv, state } from '../../ui/app.js';

export function miniature(mini, final) {
  return `<div class="tcoin">${mini.coins.map(c => `<i class="${c === COINS.mystery ? 'm' : c}">${c}</i>`).join('')}</div>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  // Five coins: two each and a mystery coin (?) that belongs to nobody until it is flipped.
  const flipped = a && mini.last ? mini.last.flipped : [], was = a && mini.last && mini.last.was ? mini.last.was : [];
  // "Flip N" stays what the player on the move started with while their flip plays and its result is up;
  // it is worked out again only when the next player comes into the square.
  const held = (a || (d && d.square === state.zoom)) && mini.last && Array.isArray(mini.last.flipped);
  const before = held ? mini.coins.map((c, i) => { const k = mini.last.flipped.indexOf(i); return k >= 0 && mini.last.was ? mini.last.was[k] : c; }) : mini.coins;
  const n = Math.min(COINS.max, before.filter(c => c !== (held ? mini.last.by : turn)).length);
  const marked = !view && !a && !d && mini.marks && mini.marks.by === turn ? mini.marks.coins : [];   // the coins this turn's flip will turn, picked as the turn started
  g = `<div class="g-coins"><div class="coins">${mini.coins.map((c, i) => {
        const flip = flipped.includes(i), m = c === COINS.mystery, from = was[flipped.indexOf(i)], mk = marked.includes(i);
        const c0 = from === COINS.mystery ? '#fff' : `var(--${(from || other(a ? a.by : turn)).toLowerCase()})`;
        return `<span class="coin ${m ? 'm' : c}${flip ? ' flip' : ''}${mk ? ` mk mk${turn}` : ''}"${flip ? ` style="--k:${flipped.indexOf(i)};--c0:${c0}"` : ''} aria-label="Coin ${i + 1}, ${m ? 'mystery' : c}${mk ? ', flips next' : ''}"><b>${c}</b></span>`;
      }).join('')}</div>
        ${view ? `<div class="dielab">All five show ${sq.owner}</div>` : ''}
        <button class="big ${turn}" data-act="move" ${mv('flip')}${locked ? ' disabled' : ''}>Flip${view ? '' : ' ' + n}</button></div>`;
  return g;
}
export function moveText(f, who) {
  return `${who} flipped ${f.n}`;
}
export function sounds(f, add, won, mini, last) {
  add('coinSpin', 0); for (let k = 0; k < (f.n || 0); k++) add('clink', 1000 + k * 80); return;
}
