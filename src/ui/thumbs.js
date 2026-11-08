import { SUIT_PATH } from './cards.js';
import { cardRed } from '../games/bus/rules.js';
import { esc } from './app.js';
// The board's miniatures: what several games' pictures share (ui/board.js thumb draws each game's view.js
// miniature in a .sq .thumb, about 60-90px wide on a phone; everything sized in cqw). Pure strings, nothing
// from the page: a miniature is drawn at every board render, so each stays a few elements.
// Each player's progress as pips, a row each (filled in their colour; sq: square pips, Echo's levels).
export const pipRows = (n, goal, sq) => ['X', 'O'].map(p => `<div class="tr ${p}" style="--n:${goal}"><b class="${p}">${p}</b>${Array.from({ length: goal }, (_, k) => `<i class="${sq ? 'psq' : ''}${k < n[p] ? ' on' : ''}"></i>`).join('')}</div>`).join('');
// A picture on the left, the players' rows on the right.
export const thumbArt = (art, rows, cls, label) => `<div class="tart${cls ? ' ' + cls : ''}"${label ? ` aria-label="${label}"` : ''}><div class="tpic" aria-hidden="true">${art}</div><div class="tpip">${rows}</div></div>`;
// A player's token in an SVG scene (a runner, a hopper): a disc in their colour with their letter.
// (No letter in it: at a miniature's size a letter is too small to read, so the disc carries a drawn X or O instead.)
export const tokSvg = (p, x, y, r) => `<g class="ttok ${p}" transform="translate(${x} ${y})"><circle r="${r}"/>${markSvgG(p, r * 0.5)}</g>`;
// A drawn X or O mark (no text) of half-size h, centred on 0,0: for a miniature's tokens and rows.
export const markSvgG = (p, h) => (p === 'X'
  ? `<path class="tmk" d="M${-h} ${-h}L${h} ${h}M${h} ${-h}L${-h} ${h}" stroke-width="${(h * 0.55).toFixed(2)}" stroke-linecap="round" fill="none"/>`
  : `<circle class="tmk" r="${(h * 0.8).toFixed(2)}" stroke-width="${(h * 0.5).toFixed(2)}" fill="none"/>`);
// A chequered finish pole.
export const finishSvg = (x, y0, y1, w) => { const n = 6, h = (y1 - y0) / n; return `<g class="tfin">${Array.from({ length: n }, (_, k) => `<rect x="${x}" y="${(y0 + k * h).toFixed(1)}" width="${w}" height="${h.toFixed(1)}" class="${k % 2 ? 'b' : 'a'}"/>`).join('')}</g>`; };
// A tiny playing card (the rank and suit shape, red or black; or its back). bare: the suit alone, for a card too small
// for its rank to be read (the board's floor for text, npm run check:minitext).
export const tinyCard = (c, cls, bare) => (c ? `<i class="tcd${cardRed(c) ? ' red' : ''}${bare ? ' tsuit' : ''}${cls ? ' ' + cls : ''}">${bare ? '' : `<b>${esc(c[0] === 'T' ? '10' : c[0])}</b>`}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${SUIT_PATH[c[1]] || ''}"/></svg></i>` : `<i class="tcd cdb${cls ? ' ' + cls : ''}"></i>`);
