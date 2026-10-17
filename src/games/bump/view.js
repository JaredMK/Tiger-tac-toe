// Bump: the screen, the miniature, the move's words and sounds, and the inputs.
import { other } from '../../core/util.js';
import { HOP_MS, N, mv } from '../../ui/app.js';
import { BUMP_SPEC, SPIN3_MS, trackSvg } from '../../ui/track.js';

export function miniature(mini, final) {
  return trackSvg(BUMP_SPEC, { tokens: { X: mini.pos.X - 1, O: mini.pos.O - 1 }, finish: 'flag', mini: true });
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  // A 1-2-3 spinner; the piece hops; landing on the other piece knocks it back Home.
  const L = mini.last, k = L ? L.spin - 1 : -1, angle = k < 0 ? 0 : 360 - (k * 120 + 60);   // puts that number under the pointer
  const lab = L ? `<b class="${L.by}">${N(L.by)}</b> spun ${L.spin}${L.bumped ? ` · bumped <b class="${other(L.by)}">${N(other(L.by))}</b> home!` : ''}` : 'No spins yet';
  g = `<div class="g-bump">${trackSvg(BUMP_SPEC, { tokens: { X: mini.pos.X - 1, O: mini.pos.O - 1 }, moved: a ? a.by : null, knocked: a && a.bumped ? other(a.by) : null, finish: 'flag', startLabel: 'HOME' })}
        <div class="wheelwrap"><div class="pointer"></div><div class="wheel w3${a ? ' spin' : ''}" style="--to:${(a ? 720 : 0) + angle}deg" aria-hidden="true"><b style="--a:60deg">1</b><b style="--a:180deg">2</b><b style="--a:300deg">3</b></div>
          <div class="dielab${a ? ' late' : ''}">${lab}</div></div>
        <button class="big ${turn}" data-act="move" ${mv('spin')}${locked ? ' disabled' : ''}>Spin for ${N(turn)}</button></div>`;
  return g;
}
export function moveText(f, who) {
  return `${who} spun ${f.spin}${f.bumped ? ` · bumped <b class="${other(f.by)}">${N(other(f.by))}</b> home!` : ''}`;
}
export function sounds(f, add, won, mini, last) {
  add('spin', 0); const steps = Math.max(1, f.to - f.from); for (let k = 0; k < steps; k++) add('hop', SPIN3_MS + k * HOP_MS); if (f.bumped) add('boing', SPIN3_MS + steps * HOP_MS); return;
}
