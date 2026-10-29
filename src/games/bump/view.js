// Bump: the screen, the miniature, the move's words and sounds, and the inputs.
import { other } from '../../core/util.js';
import { BUMP_KNOCK, bumpHops } from './rules.js';
import { HOP_MS, N, mv } from '../../ui/app.js';
import { BUMP_SPEC, SPIN3_MS, trackSvg } from '../../ui/track.js';

export function miniature(mini, final) {
  return trackSvg(BUMP_SPEC, { tokens: { X: mini.pos.X - 1, O: mini.pos.O - 1 }, finish: 'flag', mini: true });
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  // A 1-2-3 spinner; the piece hops; landing on the other piece knocks it back Home.
  // Super Chaos's round end (a.scr): no spin; both pieces hop together from where the round began when both
  // spun here, then any knock back Home.
  // The spin shown is the move's own (a: the recorded move, the mover's spin: an opponent's replay shows theirs),
  // never the square's last result, which may be the other player's.
  const scr = a && a.scr ? a.scr : null, L = a && !scr && a.spin ? { by: a.by, spin: a.spin, from: a.from, to: a.to, bumped: a.bumped } : mini.last, k = L && L.spin ? L.spin - 1 : -1, angle = k < 0 ? 0 : 360 - (k * 120 + 60);   // puts that number under the pointer
  const kn = L && L.knocked ? L.knocked : null, spinning = !!a && !scr;
  const W = p => `<b class="${p}">${N(p)}</b>`, spun = mv0 => ['X', 'O'].filter(p => mv0[p]).map(p => `${W(p)} spun ${mv0[p].spin}`).join(' · ');
  const lab = scr ? (scr.moves ? spun(scr.moves) + (scr.knocked.length ? ' · both go home!' : '') : scr.knocked.length === 2 ? 'Same space: both go home!' : `${W(a.by)} bumped ${W(scr.knocked[0])} home!`)
    : !L ? 'No spins yet' : L.moves && !a ? spun(L.moves) + (kn ? ' · both went home!' : '')
    : kn ? (kn.length === 2 ? 'Same space: both went home!' : `${W(L.by)} bumped ${W(kn[0])} home!`)
    : `${W(L.by)} spun ${L.spin}${L.bumped ? ` · bumped ${W(other(L.by))} home!` : ''}`;
  g = `<div class="g-bump">${trackSvg(BUMP_SPEC, { tokens: { X: mini.pos.X - 1, O: mini.pos.O - 1 }, moved: spinning ? a.by : null, knocked: scr ? scr.knocked : a && a.bumped ? other(a.by) : null, finish: 'flag', startLabel: 'HOME' })}
        <div class="wheelwrap"><div class="pointer"></div><div class="wheel w3${spinning ? ' spin' : ''}" style="--to:${(spinning ? 720 : 0) + angle}deg" aria-hidden="true"><b style="--a:60deg">1</b><b style="--a:180deg">2</b><b style="--a:300deg">3</b></div>
          <div class="dielab${spinning ? ' late' : ''}">${lab}</div></div>
        <button class="big ${turn}" data-act="move" ${mv('spin')}${locked ? ' disabled' : ''}>Spin for <span class="bnm">${N(turn)}</span></button></div>`;
  return g;
}
export function moveText(f, who) {
  if (f.scr && f.scr.moves) return ['X', 'O'].map(p => `<b class="${p}">${N(p)}</b> spun ${f.scr.moves[p].spin}`).join(' · ') + (f.scr.knocked.length ? ' · both go home!' : '');
  if (f.scr) return f.scr.knocked.length === 2 ? 'Same space: both go home!' : `${who} bumped <b class="${f.scr.knocked[0]}">${N(f.scr.knocked[0])}</b> home!`;
  return `${who} spun ${f.spin}${f.bumped ? ` · bumped <b class="${other(f.by)}">${N(other(f.by))}</b> home!` : ''}`;
}
export function sounds(f, add, won, mini, last) {
  if (f.scr) {                                                   // Super Chaos's round end: both pieces' hops at once, then the knock
    const hops = bumpHops(f.scr);
    for (let k = 0; k < hops; k++) add('hop', BUMP_KNOCK.lead + k * HOP_MS);
    if (f.scr.knocked.length) add('boing', BUMP_KNOCK.lead + hops * HOP_MS);
    return;
  }
  add('spin', 0); const steps = Math.max(1, f.to - f.from); for (let k = 0; k < steps; k++) add('hop', SPIN3_MS + k * HOP_MS); if (f.bumped) add('boing', SPIN3_MS + steps * HOP_MS); return;
}
