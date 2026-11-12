// Candy Race: the screen, the miniature, the move's words and sounds, and the inputs.
import { CANDY } from './rules.js';
import { hopAt } from '../shared/hops.js';
import { N, SPIN_MS, esc, mv } from '../../ui/app.js';
import { CANDY_MINI, CANDY_SPEC, CANDY_SYM, hopSounds, trackSvg, trailAt } from '../../ui/track.js';

export function miniature(mini, final) {
  return trackSvg(CANDY_MINI, { colors: mini.track, tokens: { X: mini.pos.X, O: mini.pos.O }, finish: 'colours', sym: true, mini: true, cls: 'cdy' });
}
// The wheel's face: each colour's quarter with its shape (the same one as on its spaces), ink spokes and a hub.
const WHEEL = `<svg viewBox="-50 -50 100 100" aria-hidden="true">${CANDY.colors.map((c, k) => `<g transform="rotate(${k * 90 + 45}) translate(0,-27) scale(5.2)">${CANDY_SYM[c]}</g>`).join('')}<path class="wsp" d="M0,-50V50M-50,0H50"/><circle class="whub" r="7.5"/></svg>`;
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  // Super Chaos's round end (a.scr): both spun here; both pieces hop together, the wheel shows this player's own
  // colour and the label both spins.
  // The spin shown is the move's own (a: the recorded move, the mover's spin: an opponent's replay shows theirs),
  // never the square's last result, which may be the other player's (a replay found the square as it was before).
  const joint = a && a.scr && a.scr.moves ? a.scr.moves : null, own = joint ? joint[a.by] || joint.X : null;
  const one = a && !joint && a.color ? { by: a.by, color: a.color, from: a.from, to: a.to } : null, spun = one || mini.last;
  const k = own ? CANDY.colors.indexOf(own.color) : spun ? CANDY.colors.indexOf(spun.color) : -1;
  const angle = k < 0 ? 0 : 360 - (k * 90 + 45);        // puts that colour under the pointer
  const W = p => `<b class="${p}">${N(p)}</b>`, chip = c => `<i class="cchip ${esc(c)}" aria-hidden="true"></i>`;
  const lab = joint ? ['X', 'O'].filter(p => joint[p]).map(p => `${W(p)} spun ${esc(joint[p].color)}`).join(' · ') : spun ? `${W(spun.by)} spun ${esc(spun.color)}${chip(spun.color)}` : 'No spins yet';
  // one move playing: the space it goes to lights up as the wheel stops, the spaces it leaves are traced in its colour
  const T = !joint && spun && spun.from != null && spun.to != null && (one || !view) ? spun : null;
  const trail = T ? { by: T.by, slots: Array.from({ length: Math.max(0, T.to - T.from) }, (_, i) => T.from + i), at: one ? trailAt(SPIN_MS) : null } : null;
  const marks = one && one.to < CANDY.len ? { [one.to]: 'hit' } : null, fin = CANDY_SPEC.at(CANDY.len);
  const pow = one && fresh ? { x: fin[0], y: fin[1], d: SPIN_MS + hopAt(Math.max(1, one.to - one.from)), cls: 'win' } : null;
  g = `<div class="g-candy">${trackSvg(CANDY_SPEC, { colors: mini.track, tokens: { X: mini.pos.X, O: mini.pos.O }, moved: joint ? ['X', 'O'] : a ? a.by : null, finish: 'colours', sym: true, cls: 'cdy', marks, trail, pow, turn: !a && !view && !sq.owner ? turn : null })}
        <div class="wheelwrap"><div class="pointer${a ? ' tick' : ''}"></div><div class="wheelbox${a ? ' pop' : ''}"><div class="wheel cw${a ? ' spin' : ''}" style="--to:${(a ? 1080 : 0) + angle}deg" aria-hidden="true">${WHEEL}</div></div>
          <div class="dielab${a ? ' late' : ''}">${lab}</div></div>
        <button class="big ${turn}" data-act="move" ${mv(1)}${locked ? ' disabled' : ''}>Spin for <span class="bnm">${N(turn)}</span></button></div>`;
  return g;
}
export function moveText(f, who) {
  if (f.scr && f.scr.moves) return ['X', 'O'].filter(p => f.scr.moves[p]).map(p => `<b class="${p}">${N(p)}</b> spun ${esc(f.scr.moves[p].color)}`).join(' · ');
  return `${who} spun ${esc(f.color)}`;
}
export function sounds(f, add, won, mini, last) {
  const ticks = 12;                                              // the wheel ticks, slower and slower as it stops
  for (let k = 1; k <= ticks; k++) add('wheelTick', SPIN_MS * (1 - Math.pow(1 - k / ticks, 2)));
  const steps = f.scr && f.scr.moves ? Math.max(...Object.values(f.scr.moves).map(mv => Math.max(1, mv.to - mv.from))) : Math.max(1, f.to - f.from);   // (Super Chaos's round end: both pieces hop at once)
  hopSounds(add, SPIN_MS, steps);                                // a hop on each space on the way, quicker and higher on a long move
  add('c4drop', SPIN_MS + hopAt(steps));                         // the piece set down on its space (the result: its buzz)
  return;
}
