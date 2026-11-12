// Bump: the screen, the miniature, the move's words and sounds, and the inputs.
import { other } from '../../core/util.js';
import { BUMP, BUMP_KNOCK, bumpHops } from './rules.js';
import { hopAt } from '../shared/hops.js';
import { N, mv } from '../../ui/app.js';
import { BUMP_MINI, BUMP_SPEC, KNOCK_MS, SPIN3_MS, hopSounds, trackSvg, trailAt } from '../../ui/track.js';

export function miniature(mini, final) {
  return trackSvg(BUMP_MINI, { tokens: { X: mini.pos.X - 1, O: mini.pos.O - 1 }, finish: 'flag', home: true, mini: true, cls: 'bmp' });
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  // A 1-2-3 spinner; the piece hops; landing on the other piece knocks it back Home.
  // Super Chaos's round end (a.scr): no spin; both pieces hop together from where the round began when both
  // spun here, then any knock back Home.
  // The spin shown is the move's own (a: the recorded move, the mover's spin: an opponent's replay shows theirs),
  // never the square's last result, which may be the other player's.
  const scr = a && a.scr ? a.scr : null, L = a && !scr && a.spin ? { by: a.by, spin: a.spin, from: a.from, to: a.to, bumped: a.bumped } : mini.last, k = L && L.spin ? L.spin - 1 : -1, angle = k < 0 ? 0 : 360 - (k * 120 + 60);   // puts that number under the pointer
  const kn = L && L.knocked ? L.knocked : null, spinning = !!a && !scr, one = spinning && a.spin ? L : null;
  const landAt = one ? SPIN3_MS + hopAt(Math.max(1, one.to - one.from)) : 0;                     // (one move playing: the moment its piece comes down)
  const W = p => `<b class="${p}">${N(p)}</b>`, spun = mv0 => ['X', 'O'].filter(p => mv0[p]).map(p => `${W(p)} spun ${mv0[p].spin}`).join(' · ');
  const bumpWords = l => ` <span class="rl2 bmpw"${one ? ` style="--d:${landAt}ms"` : ''}>· bumped ${W(other(l.by))} home!</span>`;
  const lab = scr ? (scr.moves ? spun(scr.moves) + (scr.knocked.length ? ' · both go home!' : '') : scr.knocked.length === 2 ? 'Same space: both go home!' : `${W(a.by)} bumped ${W(scr.knocked[0])} home!`)
    : !L ? 'No spins yet' : L.moves && !a ? spun(L.moves) + (kn ? ' · both went home!' : '')
    : kn ? (kn.length === 2 ? 'Same space: both went home!' : `${W(L.by)} bumped ${W(kn[0])} home!`)
    : `${W(L.by)} spun ${L.spin}${L.bumped ? bumpWords(L) : ''}`;
  // the spaces a spin can reach from where the mover's piece stands (1, 2 or 3 on), outlined in its colour while a spin is awaited
  const marks = {}, pos = mini.pos[turn];
  if (!a && !view && !taken(sq)) for (let s = 1; s <= BUMP.max; s++) if (pos + s <= BUMP.n) marks[pos + s - 1] = `reach ${turn}`;
  const T = !scr && L && L.from != null && L.to != null && !L.moves && (one || !view) ? L : null;   // the last spin's spaces, traced in its colour
  const trail = T ? { by: T.by, slots: Array.from({ length: Math.max(0, T.to - T.from) }, (_, i) => T.from - 1 + i), at: one ? trailAt(SPIN3_MS) : null } : null;
  const hit = one ? BUMP_SPEC.at(one.to - 1) : null;
  const pow = one && one.bumped ? { x: hit[0], y: hit[1], d: landAt, cls: 'hit' } : one && fresh ? { x: hit[0], y: hit[1], d: landAt, cls: 'win' } : null;
  g = `<div class="g-bump">${trackSvg(BUMP_SPEC, { tokens: { X: mini.pos.X - 1, O: mini.pos.O - 1 }, moved: spinning ? a.by : null, knocked: scr ? scr.knocked : a && a.bumped ? other(a.by) : null, finish: 'flag', startLabel: 'HOME', home: true, cls: 'bmp', marks, trail, pow, turn: !a && !view && !sq.owner ? turn : null })}
        <div class="wheelwrap"><div class="pointer${spinning ? ' tick t3' : ''}"></div><div class="wheelbox${spinning ? ' pop' : ''}"><div class="wheel w3${spinning ? ' spin' : ''}" style="--to:${(spinning ? 720 : 0) + angle}deg" aria-hidden="true"><b style="--a:60deg">1</b><b style="--a:180deg">2</b><b style="--a:300deg">3</b><i class="whub"></i></div></div>
          <div class="dielab${spinning ? ' late' : ''}">${lab}</div></div>
        <button class="big ${turn}" data-act="move" ${mv('spin')}${locked ? ' disabled' : ''}>Spin for <span class="bnm">${N(turn)}</span></button></div>`;
  return g;
}
const taken = sq => !!(sq && sq.owner);                     // (a square already won: nothing left to reach)
export function moveText(f, who) {
  if (f.scr && f.scr.moves) return ['X', 'O'].map(p => `<b class="${p}">${N(p)}</b> spun ${f.scr.moves[p].spin}`).join(' · ') + (f.scr.knocked.length ? ' · both go home!' : '');
  if (f.scr) return f.scr.knocked.length === 2 ? 'Same space: both go home!' : `${who} bumped <b class="${f.scr.knocked[0]}">${N(f.scr.knocked[0])}</b> home!`;
  return `${who} spun ${f.spin}${f.bumped ? ` · bumped <b class="${other(f.by)}">${N(other(f.by))}</b> home!` : ''}`;
}
export function sounds(f, add, won, mini, last) {
  if (f.scr) {                                                   // Super Chaos's round end: both pieces' hops at once, then the knock
    const hops = bumpHops(f.scr);
    hopSounds(add, BUMP_KNOCK.lead, hops);
    if (f.scr.knocked.length) { add('boing', BUMP_KNOCK.lead + hopAt(hops)); add('hop', BUMP_KNOCK.lead + hopAt(hops) + KNOCK_MS * .88, .6); }
    return;
  }
  // the spinner whirrs and ticks to a stop; a hop on each space on the way; the piece set down (the result: its buzz);
  // a bump: the spring as the other piece is sent flying, and its plop as it comes down at Home
  add('spin', 0);
  for (let k = 1; k <= 8; k++) add('wheelTick', SPIN3_MS * (1 - Math.pow(1 - k / 8, 2)));
  const steps = Math.max(1, f.to - f.from), land = SPIN3_MS + hopAt(steps);
  hopSounds(add, SPIN3_MS, steps);
  add('c4drop', land);
  if (f.bumped) { add('boing', land); add('hop', land + KNOCK_MS * .88, .6); }
  return;
}
