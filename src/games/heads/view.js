// Heads or Tails: the screen, the miniature, the move's words and sounds.
// A big two-sided coin over a table: Heads (a crowned face) and Tails (a curled tail), original drawings. The two call
// buttons under it. A call tosses the coin: it rises, turns over and over and lands on its side of the flip
// (HEADS.flip), then the verdict (HEADS.judge): the words, the caller's call chip ticked or crossed, the point's pip.
import { HEADS, headsCfg } from './rules.js';
import { mv } from '../../ui/app.js';
import { arcTally, lateAt, pips } from '../../ui/progress.js';
import { pipRows, thumbArt } from '../../ui/thumbs.js';

export const ownLine = true;
const FACE = {
  h: '<circle cx="30" cy="30" r="27" fill="#ffd23f" stroke="#161210" stroke-width="3"/><circle cx="30" cy="30" r="21" fill="none" stroke="#b8860b" stroke-width="1.6" stroke-dasharray="2 3"/><path d="M19 22l4 5 7-8 7 8 4-5v9H19z" fill="#e5432a" stroke="#161210" stroke-width="2" stroke-linejoin="round"/><circle cx="24" cy="36" r="2.200" fill="#161210"/><circle cx="36" cy="36" r="2.200" fill="#161210"/><path d="M23 42c4 4 10 4 14 0" fill="none" stroke="#161210" stroke-width="2.400" stroke-linecap="round"/>',
  t: '<circle cx="30" cy="30" r="27" fill="#f2b632" stroke="#161210" stroke-width="3"/><circle cx="30" cy="30" r="21" fill="none" stroke="#b8860b" stroke-width="1.6" stroke-dasharray="2 3"/><path d="M17 43c10 3 24-2 24-13 0-8-11-10-12-3-1 5 6 6 6 2" fill="none" stroke="#161210" stroke-width="6" stroke-linecap="round"/><path d="M17 43c10 3 24-2 24-13 0-8-11-10-12-3-1 5 6 6 6 2" fill="none" stroke="#4fc3f7" stroke-width="2.600" stroke-linecap="round"/>',
};
export const coinSvg = (side, cls) => `<svg class="htface${cls ? ' ' + cls : ''}" viewBox="0 0 60 60" aria-hidden="true">${FACE[side]}</svg>`;
const NAME = { h: 'Heads', t: 'Tails' };
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  const c = headsCfg(mini), s = a && a.ht ? a.ht : null, o = { view, locked, turn }, rest = !s && (view || d) && mini.last ? mini.last : null, l = s || rest;
  const by = s ? a.by : rest ? rest.by : turn, many = c.wins > 5;
  const tal = p => arcTally(p, o, pips(p, mini.n[p], c.wins, !!(s && s.to === p), HEADS.judge));
  const coin = `<div class="htcoin${s ? ' toss ' + s.side : l ? ' ' + l.side : ''}">${coinSvg('h', 'fh')}${coinSvg('t', 'ft')}</div>`;
  const words = l ? `${NAME[l.side]}! ${l.right ? 'Right call' : 'Wrong call'}` : '';
  const line = s ? `<p ${lateAt('htline ' + (s.right ? 'ok' : 'no'), HEADS.judge)} role="status">${words}</p>` : `<p class="htline${l ? (l.right ? ' ok' : ' no') : ''}">${words}</p>`;
  const btn = k => `<button class="big ${turn} htbtn${l && l.call === k && l.by === by && (s || rest) ? ' called' : ''}" data-act="move" ${mv(k)}${locked ? ' disabled' : ''}>${coinSvg(k)}<span>${NAME[k]}</span></button>`;
  return `<div class="g-ht pc-${by}"><div class="ctals${many ? ' two' : ''}">${tal('X')}${tal('O')}</div><div class="httable"><div class="htshadow${s ? ' toss' : ''}"></div>${coin}</div>${line}${view ? '' : `<div class="htbtns">${btn('h')}${btn('t')}</div>`}</div>`;
}
// The miniature: the coin on the side it last landed, beside each player's right calls as pips.
export function miniature(mini, final) {
  const c = headsCfg(mini);
  return thumbArt(`<svg class="tht" viewBox="0 0 60 60">${FACE[mini.last ? mini.last.side : 'h']}</svg>`, pipRows(mini.n, c.wins), 'thtw', `Heads or Tails: X ${mini.n.X}, O ${mini.n.O} of ${c.wins}`);
}
export function moveText(f, who) { const s = f.ht; return s ? `${who} called ${NAME[s.call].toLowerCase()}: ${s.right ? 'right' : 'wrong'}` : `${who} called`; }
// The flick of the thumb, the coin ringing as it turns, its landing, then the verdict: a ding for a right call, a soft thud for a wrong one.
export function sounds(f, add, won, mini, last) {
  const s = f.ht; if (!s) return;
  add('coinFlick', 0); add('coinSpin', 60); add('htLand', HEADS.flip - 60);
  add(s.right ? 'ding' : 'thud', HEADS.judge);
}
