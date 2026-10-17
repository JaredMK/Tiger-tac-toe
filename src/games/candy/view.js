// Candy Race: the screen, the miniature, the move's words and sounds, and the inputs.
import { CANDY } from './rules.js';
import { HOP_MS, N, SPIN_MS, mv } from '../../ui/app.js';
import { CANDY_SPEC, trackSvg } from '../../ui/track.js';

export function miniature(mini, final) {
  return trackSvg(CANDY_SPEC, { colors: mini.track, tokens: { X: mini.pos.X, O: mini.pos.O }, finish: 'colours', mini: true });
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  const k = mini.last ? CANDY.colors.indexOf(mini.last.color) : -1;
  const angle = k < 0 ? 0 : 360 - (k * 90 + 45);        // puts that colour under the pointer
  g = `<div class="g-candy">${trackSvg(CANDY_SPEC, { colors: mini.track, tokens: { X: mini.pos.X, O: mini.pos.O }, moved: a ? a.by : null, finish: 'colours' })}
        <div class="wheelwrap"><div class="pointer"></div><div class="wheel${a ? ' spin' : ''}" style="--to:${(a ? 1080 : 0) + angle}deg" aria-hidden="true"></div>
          <div class="dielab${a ? ' late' : ''}">${mini.last ? `<b class="${mini.last.by}">${N(mini.last.by)}</b> spun ${mini.last.color}` : 'No spins yet'}</div></div>
        <button class="big ${turn}" data-act="move" ${mv(1)}${locked ? ' disabled' : ''}>Spin for ${N(turn)}</button></div>`;
  return g;
}
export function moveText(f, who) {
  return `${who} spun ${f.color}`;
}
export function sounds(f, add, won, mini, last) {
  const ticks = 12;                                              // the wheel ticks, slower and slower as it stops
  for (let k = 1; k <= ticks; k++) add('wheelTick', SPIN_MS * (1 - Math.pow(1 - k / ticks, 2)));
  const steps = Math.max(1, f.to - f.from);
  for (let k = 0; k < steps; k++) add('hop', SPIN_MS + k * HOP_MS);
  return;
}
