// Snakes and Ladders: the screen, the miniature, the move's words and sounds, and the inputs.
import { SNL } from './rules.js';
import { PLAY } from '../../core/timer.js';
import { tune } from '../../core/tune.js';
import { hopAt } from '../shared/hops.js';
import { N, esc, mv } from '../../ui/app.js';
import { dieFace } from '../../ui/art.js';
import { SLIDE_MS, SNL_SPEC, bezierAt, snakeCurve, trackSvg, trailAt } from '../../ui/track.js';
export { trackSounds as sounds } from '../../ui/track.js';

// The ladders and the snakes, drawn over the track: a ladder is two rails and its rungs, wood with an ink outline; a
// snake is an S-curve from its head (on the space that sends a piece down) to the thin tip of its tail, each snake
// its own colour, with eyes and a forked tongue. Both cast a soft shadow on the board (the light from above).
// hot: the one a move is on right now ('l0', 's1' ...), at: its moment (ms into the move).
function snlArt(spec, mini, small, hot, at) {
  let out = '';
  const fx = k => (hot === k ? ` hot" style="--d:${Math.round(at)}ms` : '');
  mini.ladders.forEach(([a, b], i) => {
    const [x1, y1] = spec.at(a - 1), [x2, y2] = spec.at(b - 1), len = Math.hypot(x2 - x1, y2 - y1);
    const ux = (x2 - x1) / len, uy = (y2 - y1) / len, w = small ? 2.2 : 2, nx = -uy * w, ny = ux * w;
    const ax = x1 - ux * 1.2, ay = y1 - uy * 1.2, bx = x2 + ux * 1.2, by = y2 + uy * 1.2;        // the rails run a little past the two spaces
    const rails = `M${ax + nx},${ay + ny}L${bx + nx},${by + ny}M${ax - nx},${ay - ny}L${bx - nx},${by - ny}`;
    let rungs = '';
    const n = Math.max(2, Math.round(len / 3.6));
    for (let k = 0; k <= n; k++) { const t = k / n, cx = x1 + (x2 - x1) * t, cy = y1 + (y2 - y1) * t; rungs += `M${cx + nx},${cy + ny}L${cx - nx},${cy - ny}`; }
    out += `<g class="ladder${fx('l' + i)}"><path class="lsh" transform="translate(.5,1)" d="${rails}"/><path class="lo" d="${rails}${rungs}"/><path class="lw" d="${rails}${rungs}"/></g>`;
  });
  mini.snakes.forEach(([a, b], i) => {
    const P = snakeCurve(spec, a, b), pt = t => bezierAt(P, t), line = (t0, t1, n) => Array.from({ length: n + 1 }, (_, k) => pt(t0 + (t1 - t0) * k / n)).map(([x, y], k) => `${k ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)}`).join('');
    const body = line(0, .7, 16), W = small ? 3.1 : 2.7, tail = [[.7, .78, .8], [.78, .85, .6], [.85, .9, .4], [.9, .94, .22]];   // the tail thins out to its tip, just short of the middle of its space (the number there stays clear)
    const [hx, hy] = P[0], [tx, ty] = pt(.07), ang = Math.atan2(hy - ty, hx - tx) * 180 / Math.PI;
    out += `<g class="snake s${i % 3}${fx('s' + i)}"><path class="ssh" transform="translate(.5,1.1)" d="${line(0, .86, 18)}" style="stroke-width:${W + 1}"/>
      <path class="so" d="${body}" style="stroke-width:${W + 1.5}"/>${tail.map(([t0, t1, k]) => `<path class="so" d="${line(t0, t1, 3)}" style="stroke-width:${W * k + 1.5}"/>`).join('')}
      <path class="sb" d="${body}" style="stroke-width:${W}"/>${tail.map(([t0, t1, k]) => `<path class="sb" d="${line(t0, t1, 3)}" style="stroke-width:${W * k}"/>`).join('')}<path class="ss" d="${line(.1, .76, 14)}"/>
      <g transform="translate(${hx},${hy}) rotate(${ang})"><path class="st" d="M2.6,0 L5,0 M5,0 L6.1,-.9 M5,0 L6.1,.9"/><ellipse class="sh" cx=".3" rx="3.5" ry="2.9"/><circle class="sw" cx="1.2" cy="-1.35" r=".95"/><circle class="sw" cx="1.2" cy="1.35" r=".95"/><circle class="se" cx="1.5" cy="-1.35" r=".48"/><circle class="se" cx="1.5" cy="1.35" r=".48"/></g></g>`;
  });
  return out;
}
// The spaces where something happens: a ladder's foot (up from here) and a snake's head (down from here), tinted.
const snlMarks = mini => Object.assign({}, ...mini.ladders.map(([a]) => ({ [a - 1]: 'lad' })), ...mini.snakes.map(([a], i) => ({ [a - 1]: `snk s${i % 3}` })));
export function miniature(mini, final) {
  return trackSvg(SNL_SPEC, { tokens: { X: mini.pos.X - 1, O: mini.pos.O - 1 }, finish: 'none', goal: true, mini: true, cls: 'snl', marks: snlMarks(mini), overlay: snlArt(SNL_SPEC, mini, true) });
}
// The die as it rolls: it tumbles through other faces and lands on the number rolled (styles.css .die.rr, as Risky
// Rolls'). The faces on the way follow from the result, so a redraw shows the same ones.
const FLICK = [3, 1, 4, 2, 5];
const tumble = (n, sides) => FLICK.map((k, i) => `<span class="rface fl f${i}" aria-hidden="true">${dieFace(((n - 1 + k) % sides) + 1)}</span>`).join('') + `<span class="rface fin">${dieFace(n)}</span>`;
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  // The board winds up from the bottom left; the die rolls, the piece hops, then climbs or slides.
  // Super Chaos's round end (a.scr): both rolled here; both pieces hop together, the die shows this player's own
  // roll and the label both.
  const joint = a && a.scr && a.scr.moves ? a.scr.moves : null, own = joint ? joint[a.by] || joint.X : null;
  const L = own || (a && !joint && a.roll ? { by: a.by, roll: a.roll, from: a.from, land: a.land, to: a.to, via: a.via } : mini.last), ok = !!L;   // (the move's own roll: an opponent's replay shows theirs, never the square's last result, which may be the other player's)
  const one = a && !joint && a.roll ? L : null, hops = one ? Math.max(1, one.land - one.from) : 0, landAt = PLAY.die + hopAt(hops);   // (one move playing: its trail, its ladder or snake, its words at their moments)
  const viaWords = l => (l.via === 'ladder' ? `<b class="snlv lad">Ladder!</b> Up to ${l.to}` : l.via === 'snake' ? `<b class="snlv snk">Snake!</b> Down to ${l.to}` : l.to >= SNL.n ? 'The top!' : `space ${l.to}`);
  const tailOf = l => ` <span class="rl2"${one ? ` style="--d:${landAt}ms"` : ''}>· ${viaWords(l)}</span>`;
  const lab = joint ? ['X', 'O'].filter(p => joint[p]).map(p => `<b class="${p}">${N(p)}</b> rolled ${joint[p].roll}${joint[p].via ? ` (${esc(joint[p].via)})` : ''}`).join(' · ')
    : ok ? `<b class="${L.by}">${N(L.by)}</b> rolled ${L.roll}${tailOf(L)}` : 'No rolls yet';
  const idx = (list, at) => list.findIndex(x => x[0] === at), hot = one && one.via ? (one.via === 'ladder' ? 'l' + idx(mini.ladders, one.land) : 's' + idx(mini.snakes, one.land)) : null;
  const T = !joint && L && L.from != null && L.land != null && (one || !view) ? L : null;                 // the last roll's spaces, traced in its colour
  const trail = T ? { by: T.by, slots: Array.from({ length: Math.max(0, T.land - T.from) }, (_, k) => T.from - 1 + k), at: one ? trailAt(PLAY.die) : null } : null;
  const top = SNL_SPEC.at(SNL.n - 1), pow = one && fresh ? { x: top[0], y: top[1], d: landAt + (one.via ? SLIDE_MS : 0), cls: 'win' } : null;
  const sides = tune(mini).die || SNL.die;
  g = `<div class="g-snakes">${trackSvg(SNL_SPEC, { tokens: { X: mini.pos.X - 1, O: mini.pos.O - 1 }, moved: joint ? ['X', 'O'] : a ? a.by : null, finish: 'none', goal: true, cls: 'snl', marks: snlMarks(mini), trail, pow, turn: !a && !view && !sq.owner ? turn : null, overlay: snlArt(SNL_SPEC, mini, false, hot, landAt) })}
        <div class="dieWrap"><div class="die${a ? ' roll rr' : ''}">${ok ? (a ? tumble(L.roll, sides) : dieFace(L.roll)) : '<span class="q">?</span>'}</div>
          <div class="dielab${a ? ' late' : ''}">${lab}</div></div>
        <button class="big ${turn}" data-act="move" ${mv('roll')}${locked ? ' disabled' : ''}>Roll for <span class="bnm">${N(turn)}</span></button></div>`;
  return g;
}
export function moveText(f, who) {
  if (f.scr && f.scr.moves) return ['X', 'O'].filter(p => f.scr.moves[p]).map(p => { const l = f.scr.moves[p]; return `<b class="${p}">${N(p)}</b> rolled ${l.roll}${l.via === 'ladder' ? ' · up the ladder' : l.via === 'snake' ? ' · down the snake' : ''}`; }).join(' · ');
  return `${who} rolled ${f.roll}${f.via === 'ladder' ? ` · up the ladder to ${f.to}` : f.via === 'snake' ? ` · down the snake to ${f.to}` : ` · space ${f.to}`}`;
}
