// Bump: the screen, the miniature, the move's words and sounds, and the inputs.
import { other } from '../../core/util.js';
import { BUMP_KNOCK } from './rules.js';
import { HOP_MS, N, mv } from '../../ui/app.js';
import { BUMP_SPEC, SPIN3_MS, trackSvg } from '../../ui/track.js';

export function miniature(mini, final) {
  return trackSvg(BUMP_SPEC, { tokens: { X: mini.pos.X - 1, O: mini.pos.O - 1 }, finish: 'flag', mini: true });
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  // A 1-2-3 spinner; the piece hops; landing on the other piece knocks it back Home.
  // Super Chaos's round end (a.scr): no spin; the pieces where they landed, then the knock back Home.
  const L = mini.last, scr = a && a.scr ? a.scr : null, k = L && L.spin ? L.spin - 1 : -1, angle = k < 0 ? 0 : 360 - (k * 120 + 60);   // puts that number under the pointer
  const kn = L && L.knocked ? L.knocked : null;
  const lab = scr ? (scr.knocked.length === 2 ? 'Same space: both go home!' : `<b class="${a.by}">${N(a.by)}</b> bumped <b class="${scr.knocked[0]}">${N(scr.knocked[0])}</b> home!`)
    : !L ? 'No spins yet' : kn ? (kn.length === 2 ? 'Same space: both went home!' : `<b class="${L.by}">${N(L.by)}</b> bumped <b class="${kn[0]}">${N(kn[0])}</b> home!`)
    : `<b class="${L.by}">${N(L.by)}</b> spun ${L.spin}${L.bumped ? ` · bumped <b class="${other(L.by)}">${N(other(L.by))}</b> home!` : ''}`;
  g = `<div class="g-bump">${trackSvg(BUMP_SPEC, { tokens: { X: mini.pos.X - 1, O: mini.pos.O - 1 }, moved: a && !scr ? a.by : null, knocked: scr ? scr.knocked : a && a.bumped ? other(a.by) : null, finish: 'flag', startLabel: 'HOME' })}
        <div class="wheelwrap"><div class="pointer"></div><div class="wheel w3${a && !scr ? ' spin' : ''}" style="--to:${(a && !scr ? 720 : 0) + angle}deg" aria-hidden="true"><b style="--a:60deg">1</b><b style="--a:180deg">2</b><b style="--a:300deg">3</b></div>
          <div class="dielab${a && !scr ? ' late' : ''}">${lab}</div></div>
        <button class="big ${turn}" data-act="move" ${mv('spin')}${locked ? ' disabled' : ''}>Spin for ${N(turn)}</button></div>`;
  return g;
}
export function moveText(f, who) {
  if (f.scr) return f.scr.knocked.length === 2 ? 'Same space: both go home!' : `${who} bumped <b class="${f.scr.knocked[0]}">${N(f.scr.knocked[0])}</b> home!`;
  return `${who} spun ${f.spin}${f.bumped ? ` · bumped <b class="${other(f.by)}">${N(other(f.by))}</b> home!` : ''}`;
}
export function sounds(f, add, won, mini, last) {
  if (f.scr) { add('boing', BUMP_KNOCK.lead); return; }          // Super Chaos's round end: the knock
  add('spin', 0); const steps = Math.max(1, f.to - f.from); for (let k = 0; k < steps; k++) add('hop', SPIN3_MS + k * HOP_MS); if (f.bumped) add('boing', SPIN3_MS + steps * HOP_MS); return;
}
