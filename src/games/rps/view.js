// Rock Paper Scissors: the screen, the miniature, the move's words and sounds, and the inputs.
import { RPS, RPS_NAME, RPST, rpsCfg, rpsTimes } from './rules.js';
import { N, REDUCED, mv } from '../../ui/app.js';
import { arcTally, lateAt } from '../../ui/progress.js';
import { pipRows, thumbArt } from '../../ui/thumbs.js';

// The table: the house's hand above and the player's below, a reserved result line between, and three big buttons.
// A tap on a throw is the move; both fists shake (RPST.shake), then open to their throws (the house's at random), then
// the verdict. Everything timed from the move's flash.
// Original drawings (40x40): a fist (rock), a sheet with a folded corner (paper), a pair of scissors.
const ART = {
  r: '<path class="rpk" d="M8 17c0-4 2.6-6.4 6-6.4h11c3.6 0 6.4 2.6 6.4 6.2v6.6c0 6.6-5 10.8-11.4 10.8h-1.8C12.6 34.2 8 30 8 24.2z"/><path class="rpl" d="M13.4 10.8v4.6M19.2 10.6v5M25 10.8v4.8M8.4 19.6c2.6-.6 5.2.2 6.4 2.6"/>',
  p: '<path class="rpp" d="M9.5 5.5h15.5l6.5 6.5v22.5h-22z"/><path class="rpl" d="M25 5.5v6.5h6.5M13.5 17h13M13.5 21.5h13M13.5 26h9"/>',
  s: '<path class="rpb" d="M17.6 21.2 30.8 5.8l1.4 1.4-11.8 15.6M22.4 21.2 9.2 5.8 7.8 7.2l11.8 15.6"/><circle class="rph" cx="14.2" cy="28.4" r="5"/><circle class="rph" cx="25.8" cy="28.4" r="5"/><circle class="rpc" cx="20" cy="21.6" r="1.3"/>',
};
export const rpsSvg = (k, cls) => `<svg class="rpsv ${k}${cls ? ' ' + cls : ''}" viewBox="0 0 40 40" aria-hidden="true">${ART[k]}</svg>`;
const SAY = { win: 'wins', lose: 'loses', tie: 'Tie' };
function rpsTable(mini, a, o) {
  const f = a && a.rps ? a.rps : null, anim = !!f && !REDUCED, T = f ? rpsTimes(f) : null;
  const by = f ? a.by : mini.last && (o.done || o.view) ? mini.last.by : o.turn, goal = rpsCfg(mini).goal;
  const shown = f || (mini.last && mini.last.by === by && (o.done || o.view || mini.tie === by) ? mini.last : null);
  const tal = p => {
    const n = Math.min(goal, mini.score[p]), fresh = f && f.res === 'win' && a.by === p;
    const pip = Array.from({ length: goal }, (_, k) => `<i ${lateAt(k < n ? 'on' : '', anim && fresh && k === n - 1 ? T.judge : null, 'fillin')}></i>`).join('');
    return arcTally(p, o, `<span class="pips" aria-label="${mini.score[p]} of ${goal} wins">${pip}</span>`);
  };
  // a hand: a fist shaking, then its throw (or the throw as it lies once over; a fist at rest before any)
  const hand = (who, k, side) => {
    if (f && anim) return `<div class="rpshand ${side}"><span class="rpsfist" style="--t:${T.show}ms">${rpsSvg('r', 'fist')}</span><span ${lateAt('rpsthrow', T.show)}>${rpsSvg(k)}</span></div>`;
    if (shown) return `<div class="rpshand ${side}"><span class="rpsthrow">${rpsSvg(side === 'me' ? shown.t : shown.h)}</span></div>`;
    return `<div class="rpshand ${side} idle"><span class="rpsthrow">${rpsSvg('r', 'fist')}</span></div>`;
  };
  const line = s => (s.res === 'tie' ? 'Tie! Throw again' : s.res === 'win' ? `<b class="${by}">${N(by)}</b> wins: ${RPS_NAME[s.t]} beats ${RPS_NAME[s.h]}` : `House wins: ${RPS_NAME[s.h]} beats ${RPS_NAME[s.t]}`);
  const res = f ? `<p ${lateAt('rpsres ' + f.res, anim ? T.judge : null)} role="status">${line(f)}</p>`
    : `<p class="rpsres ${shown ? shown.res : 'none'}">${shown ? line(shown) : '&nbsp;'}</p>`;
  const btn = k => `<button class="rpsbtn ${o.turn}" data-act="move" ${mv(k)} aria-label="${RPS_NAME[k]}"${o.locked ? ' disabled' : ''}>${rpsSvg(k)}<span>${RPS_NAME[k][0].toUpperCase() + RPS_NAME[k].slice(1)}</span></button>`;
  const btns = o.view ? '<div class="rpsbtns none"></div>' : `<div class="rpsbtns">${RPS.kinds.map(btn).join('')}</div>`;
  return `<div class="g-rps"><div class="ctals">${tal('X')}${tal('O')}</div>
    <div class="rpsarena"><span class="rpswho">House</span>${hand('house', f ? f.h : null, 'house')}${res}${hand(by, f ? f.t : null, 'me')}<span class="rpswho"><b class="${by}">${N(by)}</b></span></div>${btns}</div>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = rpsTable(mini, a, { view, locked, turn, done: !!d }); return g;
}
// The line under the game's name while a tie holds the turn (ui/mini.js heldSub).
export function heldSub(mini, turn, f, a) {
  const who = `<b class="${turn}">${N(turn)}</b>`;
  if (f) return '';                                               // (a throw still showing: never its verdict before the hands open)
  return mini.tie === turn ? `${who} tied · throw again` : `${who} won · goes again`;
}
// The miniature: the last throw's two hands face to face (the house's above, upside down; the thrower's below, ringed in
// their colour; two fists before any throw), beside each player's wins as pips.
export function miniature(mini, final) {
  const goal = rpsCfg(mini).goal, l = mini.last;
  const hand = (k, cls) => `<span class="trpsh ${cls}">${rpsSvg(k)}</span>`;
  const art = `<div class="trps">${hand(l ? l.h : 'r', 'h')}${hand(l ? l.t : 'r', 'm' + (l ? ' ' + l.by : ''))}</div>`;
  return thumbArt(art, pipRows(mini.score, goal), 'trpsw', `Rock Paper Scissors: X ${mini.score.X}, O ${mini.score.O} of ${goal} wins`);
}
export function moveText(f, who) {
  const s = f.rps;
  if (!s) return `${who} threw`;
  return s.res === 'tie' ? `${who} tied with ${RPS_NAME[s.t]}` : s.res === 'win' ? `${who} won with ${RPS_NAME[s.t]}` : `${who} lost to the house's ${RPS_NAME[s.h]}`;
}
// The shake (a rattle each bounce), the clap as the hands open, then the verdict: a ding, a thud, a boing on a tie.
export function sounds(f, add, won, mini, last) {
  const s = f.rps;
  if (!s) return;
  const T = rpsTimes(s);
  for (let k = 0; k < 3; k++) add('rattle', k * (RPST.shake / 3));
  add('clack', T.show);
  add(s.res === 'win' ? 'ding' : s.res === 'tie' ? 'boing' : 'thud', T.judge);
}
