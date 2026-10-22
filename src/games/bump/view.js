// Bump: the screen, the miniature, the move's words and sounds, and the inputs.
import { other } from '../../core/util.js';
import { bumpHops, bumpLead } from './rules.js';
import { HOP_MS, N, mv } from '../../ui/app.js';
import { BUMP_SPEC, SPIN3_MS, trackSvg } from '../../ui/track.js';

export function miniature(mini, final) {
  return trackSvg(BUMP_SPEC, { tokens: { X: mini.pos.X - 1, O: mini.pos.O - 1 }, finish: 'flag', mini: true });
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  // A 1-2-3 spinner; the piece hops; landing on the other piece knocks it back Home.
  // Super Chaos: a spin locked in waits for the round's end (L.locked); there (a.scr) the spins play: one
  // spinner's spin turns the wheel and hops the piece; two spin together (both pieces hop at once, no wheel);
  // then any knock back Home.
  const L = mini.last, scr = a && a.scr ? a.scr : null, scMv = scr && scr.moves ? Object.keys(scr.moves) : [], one = scMv.length === 1 ? scr.moves[scMv[0]] : null;
  const resting = !!((a && a.locked) || (L && L.locked && !scr)), shown = resting ? 0 : one ? one.spin : L && L.spin ? L.spin : 0,   // (a spin locked in waits for the round's end: the wheel stays at rest, between 3 and 1, as it was)
     k = shown ? shown - 1 : -1, angle = k < 0 ? 0 : 360 - (k * 120 + 60);   // puts that number under the pointer
  const kn = L && L.knocked ? L.knocked : null, spinning = !!a && !a.locked && (!scr || !!one);
  const W = p => `<b class="${p}">${N(p)}</b>`, spun = mv0 => ['X', 'O'].filter(p => mv0[p]).map(p => `${W(p)} spun ${mv0[p].spin}`).join(' · ');
  const lab = a && a.locked ? `${W(a.by)} locked in a spin`
    : scr ? (scMv.length ? spun(scr.moves) + (scr.knocked.length === 2 ? ' · both go home!' : scr.knocked.length ? ` · ${W(other(scr.knocked[0]))} bumped ${W(scr.knocked[0])} home!` : '') : scr.knocked.length === 2 ? 'Same space: both go home!' : `${W(a.by)} bumped ${W(scr.knocked[0])} home!`)
    : L && L.locked ? `${W(L.by)} locked in a spin`
    : !L ? 'No spins yet' : L.moves && Object.keys(L.moves).length === 2 ? spun(L.moves) + (kn ? ' · both went home!' : '')
    : kn ? (kn.length === 2 ? 'Same space: both went home!' : `<b class="${L.by}">${N(L.by)}</b> bumped <b class="${kn[0]}">${N(kn[0])}</b> home!`)
    : `<b class="${L.by}">${N(L.by)}</b> spun ${L.spin}${L.bumped ? ` · bumped <b class="${other(L.by)}">${N(other(L.by))}</b> home!` : ''}`;
  g = `<div class="g-bump">${trackSvg(BUMP_SPEC, { tokens: { X: mini.pos.X - 1, O: mini.pos.O - 1 }, moved: a && !scr && !a.locked ? a.by : null, knocked: scr ? scr.knocked : a && a.bumped ? other(a.by) : null, finish: 'flag', startLabel: 'HOME' })}
        <div class="wheelwrap"><div class="pointer"></div><div class="wheel w3${spinning ? ' spin' : ''}" style="--to:${(spinning ? 720 : 0) + angle}deg" aria-hidden="true"><b style="--a:60deg">1</b><b style="--a:180deg">2</b><b style="--a:300deg">3</b></div>
          <div class="dielab${spinning ? ' late' : ''}">${lab}</div></div>
        <button class="big ${turn}" data-act="move" ${mv('spin')}${locked ? ' disabled' : ''}>Spin for ${N(turn)}</button></div>`;
  return g;
}
export function moveText(f, who) {
  if (f.locked) return `${who} locked in a spin`;
  if (f.scr && f.scr.moves) return ['X', 'O'].filter(p => f.scr.moves[p]).map(p => `<b class="${p}">${N(p)}</b> spun ${f.scr.moves[p].spin}`).join(' · ') + (f.scr.knocked.length === 2 ? ' · both go home!' : f.scr.knocked.length ? ` · bumped <b class="${f.scr.knocked[0]}">${N(f.scr.knocked[0])}</b> home!` : '');
  if (f.scr) return f.scr.knocked.length === 2 ? 'Same space: both go home!' : `${who} bumped <b class="${f.scr.knocked[0]}">${N(f.scr.knocked[0])}</b> home!`;
  return `${who} spun ${f.spin}${f.bumped ? ` · bumped <b class="${other(f.by)}">${N(other(f.by))}</b> home!` : ''}`;
}
export function sounds(f, add, won, mini, last) {
  if (f.locked) { add('clack', 0); return; }                     // Super Chaos: the spin locked in (it plays at the round's end)
  if (f.scr) {                                                   // Super Chaos's round end: the spin (one spinner), the hops (both pieces' at once), then the knock
    const hops = bumpHops(f.scr), lead = bumpLead(f.scr);
    if (f.scr.moves && Object.keys(f.scr.moves).length === 1) add('spin', 0);
    for (let k = 0; k < hops; k++) add('hop', lead + k * HOP_MS);
    if (f.scr.knocked.length) add('boing', lead + hops * HOP_MS);
    return;
  }
  add('spin', 0); const steps = Math.max(1, f.to - f.from); for (let k = 0; k < steps; k++) add('hop', SPIN3_MS + k * HOP_MS); if (f.bumped) add('boing', SPIN3_MS + steps * HOP_MS); return;
}
