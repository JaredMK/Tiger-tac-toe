// Snakes and Ladders: the screen, the miniature, the move's words and sounds, and the inputs.
import { N, mv } from '../../ui/app.js';
import { dieFace } from '../../ui/art.js';
import { SNL_SPEC, bezierAt, snakeCurve, trackSvg } from '../../ui/track.js';
export { trackSounds as sounds } from '../../ui/track.js';

function snlArt(spec, mini, small) {
  let out = '';
  for (const [a, b] of mini.ladders) {
    const [x1, y1] = spec.at(a - 1), [x2, y2] = spec.at(b - 1), len = Math.hypot(x2 - x1, y2 - y1);
    const ux = (x2 - x1) / len, uy = (y2 - y1) / len, w = small ? 2 : 1.8, nx = -uy * w, ny = ux * w;
    const rails = `M${x1 + nx},${y1 + ny}L${x2 + nx},${y2 + ny}M${x1 - nx},${y1 - ny}L${x2 - nx},${y2 - ny}`;
    let rungs = '';
    const n = Math.max(2, Math.round(len / 3.4));
    for (let k = 1; k < n; k++) { const t = k / n, cx = x1 + (x2 - x1) * t, cy = y1 + (y2 - y1) * t; rungs += `M${cx + nx},${cy + ny}L${cx - nx},${cy - ny}`; }
    out += `<g class="ladder"><path class="lo" d="${rails}${rungs}"/><path class="lw" d="${rails}${rungs}"/></g>`;
  }
  for (const [a, b] of mini.snakes) {
    const P = snakeCurve(spec, a, b), d = `M${P[0][0]},${P[0][1]}C${P[1][0]},${P[1][1]} ${P[2][0]},${P[2][1]} ${P[3][0]},${P[3][1]}`;
    const [hx, hy] = P[0], [tx, ty] = bezierAt(P, .08), ang = Math.atan2(hy - ty, hx - tx) * 180 / Math.PI;
    out += `<g class="snake"><path class="so" d="${d}"/><path class="sb" d="${d}"/><path class="ss" d="${d}"/>
      <g transform="translate(${hx},${hy}) rotate(${ang})"><ellipse class="sh" rx="2.9" ry="2.3"/><circle class="se" cx=".9" cy="-1" r=".55"/><circle class="se" cx=".9" cy="1" r=".55"/></g></g>`;
  }
  return out;
}
export function miniature(mini, final) {
  return trackSvg(SNL_SPEC, { tokens: { X: mini.pos.X - 1, O: mini.pos.O - 1 }, finish: 'none', goal: true, mini: true, cls: 'snl', overlay: snlArt(SNL_SPEC, mini, true) });
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  // The board winds up from the bottom left; the die rolls, the piece hops, then climbs or slides.
  // Super Chaos's round end (a.scr): both rolled here; both pieces hop together, the die shows this player's own
  // roll and the label both.
  const joint = a && a.scr && a.scr.moves ? a.scr.moves : null, own = joint ? joint[a.by] || joint.X : null;
  const L = own || mini.last, ok = !!L;
  const tailOf = l => (l.via === 'ladder' ? ` · up the ladder to ${l.to}` : l.via === 'snake' ? ` · down the snake to ${l.to}` : ` · space ${l.to}`);
  const lab = joint ? ['X', 'O'].filter(p => joint[p]).map(p => `<b class="${p}">${N(p)}</b> rolled ${joint[p].roll}${joint[p].via ? ` (${joint[p].via})` : ''}`).join(' · ')
    : ok ? `<b class="${L.by}">${N(L.by)}</b> rolled ${L.roll}${tailOf(L)}` : 'No rolls yet';
  g = `<div class="g-snakes">${trackSvg(SNL_SPEC, { tokens: { X: mini.pos.X - 1, O: mini.pos.O - 1 }, moved: joint ? ['X', 'O'] : a ? a.by : null, finish: 'none', goal: true, cls: 'snl', overlay: snlArt(SNL_SPEC, mini) })}
        <div class="dieWrap"><div class="die${a ? ' roll' : ''}">${ok ? dieFace(L.roll) : '<span class="q">?</span>'}</div>
          <div class="dielab${a ? ' late' : ''}">${lab}</div></div>
        <button class="big ${turn}" data-act="move" ${mv('roll')}${locked ? ' disabled' : ''}>Roll for ${N(turn)}</button></div>`;
  return g;
}
export function moveText(f, who) {
  if (f.scr && f.scr.moves) return ['X', 'O'].filter(p => f.scr.moves[p]).map(p => { const l = f.scr.moves[p]; return `<b class="${p}">${N(p)}</b> rolled ${l.roll}${l.via === 'ladder' ? ' · up the ladder' : l.via === 'snake' ? ' · down the snake' : ''}`; }).join(' · ');
  return `${who} rolled ${f.roll}${f.via === 'ladder' ? ` · up the ladder to ${f.to}` : f.via === 'snake' ? ` · down the snake to ${f.to}` : ` · space ${f.to}`}`;
}
