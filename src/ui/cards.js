// Playing cards on screen (Blackjack, Ride the Bus).
import { cardName } from '../games/shared/cards.js';
import { cardRed } from '../games/bus/rules.js';
import { esc } from './app.js';

/* ----- the card games and the wheel: Blackjack, Ride the Bus, Roulette ----- */
// Playing cards: each suit drawn as a shape (the same on every phone), the rank big in the corner so it
// reads at phone size. A card in play slides in (.slide, at --d) and turns face up (.flip, at --f), each
// from its own moment in the move (ms after it); a face-down card shows its back.
export const SUIT_PATH = {
  S: 'M12 2.2C9.4 5.9 3.2 9 3.2 13.7c0 2.9 2.2 4.5 4.4 4.5 1.5 0 2.8-.7 3.6-1.8-.3 2.2-1.3 3.7-2.9 4.8h7.4c-1.6-1.1-2.6-2.6-2.9-4.8.8 1.1 2.1 1.8 3.6 1.8 2.2 0 4.4-1.6 4.4-4.5C20.8 9 14.6 5.9 12 2.2z',
  H: 'M12 21.2S2.6 15.4 2.6 9.1C2.6 6.1 4.9 3.8 7.7 3.8c1.9 0 3.4 1 4.3 2.6.9-1.6 2.4-2.6 4.3-2.6 2.8 0 5.1 2.3 5.1 5.3 0 6.3-9.4 12.1-9.4 12.1z',
  D: 'M12 1.8 20.4 12 12 22.2 3.6 12z',
  C: 'M12 2.4a4.3 4.3 0 0 0-4.1 5.7 4.3 4.3 0 1 0 2.7 7.7c-.3 2.1-1.3 3.6-2.8 4.8h8.4c-1.5-1.2-2.5-2.7-2.8-4.8a4.3 4.3 0 1 0 2.7-7.7A4.3 4.3 0 0 0 12 2.4z',
};
export const suitSvg = (s, cls) => `<svg class="suit${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true"><path d="${SUIT_PATH[s]}"/></svg>`;
const RANK_NAME = { T: '10', J: 'Jack', Q: 'Queen', K: 'King', A: 'Ace' };
const rankText = c => (c[0] === 'T' ? '10' : c[0]);
const rankName = c => RANK_NAME[c[0]] || c[0];
export function pcard(c, o = {}) {
  const down = o.down || !c;
  const cls = `plc${down ? ' down' : ''}${c && cardRed(c) ? ' red' : ''}${o.slide != null ? ' slide' : ''}${o.flip != null ? ' flip' : ''}${o.cls ? ' ' + o.cls : ''}`;
  const style = [o.slide != null ? `--d:${o.slide}ms` : '', o.flip != null ? `--f:${o.flip}ms` : '', o.style || ''].filter(Boolean).join(';');
  const face = c ? `<span class="pcf fc"><b class="rk">${esc(rankText(c))}</b>${suitSvg(c[1], 'sm')}${suitSvg(c[1], 'lg')}</span>` : '';
  return `<span class="${cls}"${style ? ` style="${style}"` : ''} role="img" aria-label="${down ? 'Face-down card' : esc(cardName(c))}"><span class="pcin">${face}<span class="pcf rev"></span></span></span>`;
}
export const cardShort = c => `<span class="cshort${cardRed(c) ? ' red' : ''}">${esc(rankText(c))}${suitSvg(c[1], 'inl')}</span>`;
