// Rock Paper Scissors: the screen, the miniature, the move's words and sounds, and the inputs.
import { RPS, RPS_NAME, RPST, rpsCfg, rpsTimes } from './rules.js';
import { N, mv } from '../../ui/app.js';
import { arcTally, lateAt } from '../../ui/progress.js';
import { pipRows, thumbArt } from '../../ui/thumbs.js';

// The table: a felt with two arms reaching in, the house's from the top (a dark sleeve) and the player's from the
// bottom (a sleeve and cuff in their colour), a reserved result line between them, and the three throw buttons under it.
// A tap on a throw is the move: both fists pump three times (RPST.shake), open to their throws with a pop (the
// house's at random), then the verdict (RPST.judge later): the winner's hand strikes forward over a burst while the
// loser's is knocked back and greys; a tie bumps the two together and apart. The tally's pip fills as the strike
// lands. Everything is timed from the move's flash (rules.js rpsTimes) and the hands stay as they ended while the
// result is on show; nothing moves when a line comes or goes.
// (Reduced motion: the stylesheet plays none of it, each thing shown as it ends up.)
// Original drawings (64x78, fingers up): a gloved hand making each throw, a fist (rock), an open hand (paper), two
// fingers (scissors), over a cuff that takes its owner's colour.
const CUFF = '<path class="rpcf" d="M17 60h30v14a3 3 0 0 1-3 3H20a3 3 0 0 1-3-3z"/><path class="rpl" d="M17 66h30"/>';
const ART = {
  r: '<path class="rpg" d="M12 37c0-8 5-13 12-13h16c7 0 12 5 12 13v13c0 8-6 13-14 13H26c-8 0-14-5-14-13z"/><path class="rpl" d="M22 25v9M32 24v10M42 25v9"/><path class="rpg" d="M12 43c6-4 15-3 19 3 2 4-1 8-5 8-5 0-9-1-14-3z"/>',
  p: '<rect class="rpg" x="10.5" y="31" width="9" height="25" rx="4.5" transform="rotate(-40 15 54)"/><rect class="rpg" x="14" y="12" width="9" height="33" rx="4.5"/><rect class="rpg" x="24" y="5" width="9" height="40" rx="4.5"/><rect class="rpg" x="34" y="7" width="9" height="38" rx="4.5"/><rect class="rpg" x="44" y="15" width="8.5" height="30" rx="4.25"/><path class="rpg" d="M12 40h40.5v10c0 8-6 13-14.5 13H26c-8 0-14-5-14-13z"/><rect class="rpf" x="13.6" y="36.5" width="37.3" height="6.5"/>',
  s: '<rect class="rpg" x="17.5" y="5" width="9.5" height="38" rx="4.75" transform="rotate(-13 22.25 43)"/><rect class="rpg" x="33" y="5" width="9.5" height="38" rx="4.75" transform="rotate(13 37.75 43)"/><path class="rpg" d="M12 44c0-7 5-12 12-12h16c7 0 12 5 12 12v6c0 8-6 13-14 13H26c-8 0-14-5-14-13z"/><path class="rpl" d="M42.5 33v8"/><path class="rpg" d="M13 49c6-4 14-3 18 2 2 4-1 7-5 7-5 0-8-1-13-3z"/>',
};
export const rpsSvg = (k, cls) => `<svg class="rpsv ${k}${cls ? ' ' + cls : ''}" viewBox="0 0 64 78" aria-hidden="true">${ART[k]}${CUFF}</svg>`;
const beats = k => `${RPS_NAME[k][0].toUpperCase() + RPS_NAME[k].slice(1)} ${k === 's' ? 'beat' : 'beats'} ${RPS_NAME[RPS.beats[k]]}`;
function rpsTable(mini, a, o) {
  const f = a && a.rps ? a.rps : null, T = f ? rpsTimes(f) : null;
  const by = f ? a.by : mini.last && (o.done || o.view) ? mini.last.by : o.turn, goal = rpsCfg(mini).goal;
  const shown = f || (mini.last && mini.last.by === by && (o.done || o.view || mini.tie === by) ? mini.last : null);
  const hitAt = T ? T.judge + RPST.strike : null;
  const tal = p => {
    const n = Math.min(goal, mini.score[p]), fresh = f && f.res === 'win' && a.by === p;
    const pip = Array.from({ length: goal }, (_, k) => `<i ${lateAt(k < n ? 'on' : '', fresh && k === n - 1 ? hitAt : null, 'fillin')}></i>`).join('');
    return arcTally(p, o, `<span class="pips" aria-label="${mini.score[p]} of ${goal} wins">${pip}</span>`);
  };
  // an arm: its sleeve, then its hand: a fist pumping, then its throw (or the throw as it lies once over; a fist at rest before any)
  const arm = side => {
    const mine = side === 'me', k = shown ? (mine ? shown.t : shown.h) : 'r';
    const how = !shown ? 'idle' : shown.res === 'tie' ? 'tie' : (shown.res === 'win') === mine ? 'win' : 'lose';
    const hand = f ? `<span class="rpsfist">${rpsSvg('r')}</span><span class="rpsthrow pop">${rpsSvg(k)}</span>` : `<span class="rpsthrow">${rpsSvg(k)}</span>`;
    const st = f ? ` style="--t:${T.show}ms;--tj:${T.judge}ms"` : '';
    return `<div class="rpsarm ${side} ${how}${f ? ' play' : ''}"${st}><i class="rpssl"></i><span class="rpshd">${how === 'win' ? '<i class="rpsbang"></i>' : ''}${hand}</span></div>`;
  };
  const line = s => (s.res === 'tie' ? 'Tie! Throw again' : s.res === 'win' ? `${beats(s.t)}!` : beats(s.h));   // (the move alone: whose hand won, the strike and the tally say)
  const res = f ? `<p ${lateAt('rpsres ' + f.res, T.judge)} role="status">${line(f)}</p>`
    : `<p class="rpsres ${shown ? shown.res : 'none'}">${shown ? line(shown) : '&nbsp;'}</p>`;
  const btn = k => `<button class="rpsbtn ${o.turn}" data-act="move" ${mv(k)} aria-label="${RPS_NAME[k]}"${o.locked ? ' disabled' : ''}>${rpsSvg(k)}<span>${RPS_NAME[k][0].toUpperCase() + RPS_NAME[k].slice(1)}</span></button>`;
  const btns = o.view ? '<div class="rpsbtns none"></div>' : `<div class="rpsbtns">${RPS.kinds.map(btn).join('')}</div>`;
  return `<div class="g-rps pc-${by}"><div class="ctals">${tal('X')}${tal('O')}</div>
    <div class="rpsarena${shown ? ' res-' + shown.res : ''}"><span class="rpswho h">House</span>${arm('house')}${res}${arm('me')}<span class="rpswho m"><b class="${by}">${N(by)}</b></span></div>${btns}</div>`;
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
// The miniature: the last throw's two hands face to face (the house's above, pointing down, its cuff dark; the
// thrower's below, its cuff in their colour; two fists before any throw), beside each player's wins as pips.
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
// The three pumps (a soft knock on the first two beats, rising), a pop as the hands open on the third, then the verdict as the strike lands: the
// winner's thunk and a ding for a throw won, a thud for one lost, a boing as a tie's hands bump.
export function sounds(f, add, won, mini, last) {
  const s = f.rps;
  if (!s) return;
  const T = rpsTimes(s), hit = T.judge + RPST.strike;
  for (let k = 1; k < 3; k++) add('peg', Math.round(k * RPST.shake / 3), 0.65 + k * 0.15);   // (the fists come down on each beat; on the third they open)
  add('pop', T.show);
  if (s.res === 'win') { add('thunk', hit); add('ding', hit + 110); } else add(s.res === 'tie' ? 'boing' : 'thud', hit);
}
