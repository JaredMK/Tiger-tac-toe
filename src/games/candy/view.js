// Candy Race: the screen, the miniature, the move's words and sounds, and the inputs.
import { CANDY } from './rules.js';
import { HOP_MS, N, SPIN_MS, esc, mv } from '../../ui/app.js';
import { CANDY_SPEC, trackSvg } from '../../ui/track.js';

export function miniature(mini, final) {
  return trackSvg(CANDY_SPEC, { colors: mini.track, tokens: { X: mini.pos.X, O: mini.pos.O }, finish: 'colours', mini: true });
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  // Super Chaos's round end (a.scr): both spun here; both pieces hop together, the wheel shows this player's own
  // colour and the label both spins.
  const joint = a && a.scr && a.scr.moves ? a.scr.moves : null, own = joint ? joint[a.by] || joint.X : null;
  const k = own ? CANDY.colors.indexOf(own.color) : mini.last ? CANDY.colors.indexOf(mini.last.color) : -1;
  const angle = k < 0 ? 0 : 360 - (k * 90 + 45);        // puts that colour under the pointer
  const W = p => `<b class="${p}">${N(p)}</b>`;
  const lab = joint ? ['X', 'O'].filter(p => joint[p]).map(p => `${W(p)} spun ${esc(joint[p].color)}`).join(' · ') : mini.last ? `${W(mini.last.by)} spun ${esc(mini.last.color)}` : 'No spins yet';
  g = `<div class="g-candy">${trackSvg(CANDY_SPEC, { colors: mini.track, tokens: { X: mini.pos.X, O: mini.pos.O }, moved: joint ? ['X', 'O'] : a ? a.by : null, finish: 'colours' })}
        <div class="wheelwrap"><div class="pointer"></div><div class="wheel${a ? ' spin' : ''}" style="--to:${(a ? 1080 : 0) + angle}deg" aria-hidden="true"></div>
          <div class="dielab${a ? ' late' : ''}">${lab}</div></div>
        <button class="big ${turn}" data-act="move" ${mv(1)}${locked ? ' disabled' : ''}>Spin for ${N(turn)}</button></div>`;
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
  for (let k = 0; k < steps; k++) add('hop', SPIN_MS + k * HOP_MS);
  return;
}
