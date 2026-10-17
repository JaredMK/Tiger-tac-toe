// Cup Pong: the screen, the miniature, the move's words and sounds, and the inputs.
import { PONG } from './rules.js';
import { ownPress } from '../../audio/sound.js';
import { attemptMove } from '../../net/moves.js';
import { blocked } from '../../net/room.js';
import { N, app, state } from '../../ui/app.js';
import { arcTally, lateAt } from '../../ui/progress.js';

let pongDrag = null;                           // Echo: { id, sq, level, taps, at } the attempt (at: when Play pattern was tapped); Cup Pong: the swipe under way
// Cup Pong: the table from above, the thrower's rack of cups at the far end (three cups touching in a tight
// triangle), the ball at this end. Opened, the rack is the player to move's own (during a throw, the
// thrower's; a decided square, the last thrower's). A swipe up from the ball throws it: the direction aims,
// the speed sets the distance. The ball flies (and grows, then shrinks) to where the throw landed, timed
// from the move; then it sinks, rims or misses.
function pongTable(mini, a, o) {
  const g = a && a.pong ? a.pong : null, l = mini.last, turn = o.turn, mover = g ? a.by : o.view && l ? l.by : turn;
  const T = PONG.fly;
  const cups = p => `<span class="pcups" aria-label="${mini.cups[p].filter(Boolean).length} cups left">${mini.cups[p].map((up, k) => `<i ${lateAt(up ? 'on' : '', g && g.sunk && a.by === p && g.cup === k ? T : null, 'fillin')}></i>`).join('')}</span>`;
  const tal = p => arcTally(p, o, cups(p));
  const rack = mover, up = g ? g.cups[rack].map((c, k) => c || (g.sunk && g.cup === k)) : mini.cups[rack];   // during the throw the cup it sank still stands until it sinks
  const px = x => ((x + 0.5) * 100).toFixed(1), py = y => ((1 - y) * 100).toFixed(1);
  const cupEls = PONG.cups.map(([cx, cy], k) => `<div class="pcup ${rack}${up[k] ? '' : ' gone'}${g && g.sunk && g.cup === k ? ' sink' : ''}" style="left:${px(cx)}%;top:${py(cy)}%;--t:${T}ms"></div>`).join('');
  let ball = '', style = '';
  const mine = !o.view && !g && !o.locked;
  if (g) {                                                      // the flight: transforms only (smooth at 60 fps): a layer the size of the table moves the ball across it, the ball swells and shrinks for the arc
    const lx = Math.max(-0.48, Math.min(0.48, g.x)), ly = Math.max(0.05, Math.min(1.08, g.y));
    ball = `<div class="pfly" style="--tx:${(lx * 100).toFixed(2)}%;--ty:${((0.08 - ly) * 100).toFixed(2)}%;--d:${T}ms"><div class="parc"><div class="pball ${g.sunk ? 'in' : g.rim ? 'rim off' : 'off'}" style="--t:${T}ms;--f:${g.rim ? T + 400 : T}ms"></div></div></div>`;
  } else if (!o.view) ball = `<div class="pball${mine ? ' ready' : ''}" style="left:50%;top:92%" data-pong="ball"></div>`;
  const table = `<div class="ptable" data-pong="table" aria-label="The table">${style}${cupEls}${ball}</div>`;   // (no aim guides: the ball and the cups, nothing else)
  const res = g ? `<p ${lateAt('arcres ' + (g.sunk ? 'ok' : 'no'), T + (g.rim ? 400 : 0))} role="status">${g.sunk ? (g.rim ? 'Off the rim and in!' : 'Sunk!') : g.rim ? 'Rimmed out' : 'Miss'}</p>` : l && !mine ? `<p class="arcres ${l.sunk ? 'ok' : 'no'}"><b class="${l.by}">${N(l.by)}</b> ${l.sunk ? 'sank a cup' : l.rim ? 'rimmed out' : 'missed'}</p>` : `<p class="arcnote">${mine || o.view ? '' : `Waiting for <b class="${turn}">${N(turn)}</b>…`}</p>`;
  return `<div class="g-arc"><div class="ctals">${tal('X')}${tal('O')}</div><div class="pong${mine ? ' live' : ''}" data-pong="area">${table}${res}</div></div>`;
}
// The throw a swipe makes: its direction from the start, its power from the finger's speed over its last
// tenth of a second (a flick, not the whole drag). The same reading for the preview and for the throw.
function pongRead(d, x, y, now) {
  while (d.pts.length > 1 && now - d.pts[1][0] > 110) d.pts.shift();   // the oldest sample kept is the last one at least 110 ms back
  const [t0, x0, y0] = d.pts[0], dt = Math.max(16, now - t0), v = Math.hypot(x - x0, y - y0) / dt;   // px per ms: a flick is about 2, a slow push about 0.4; held still, it falls away
  const dx = x - d.x0, dy = d.y0 - y;
  return { dx, dy, aim: Math.max(-1, Math.min(1, Math.atan2(dx, Math.max(1, dy)) / PONG.angle)), power: Math.max(0, Math.min(1, (v - 0.25) / 1.75)) };
}
function pongRelease(e) {
  if (!pongDrag || e.pointerId !== pongDrag.id) return;
  const d = pongDrag; pongDrag = null;
  const r = pongRead(d, e.clientX, e.clientY, performance.now());
  if (r.dy < 24 || Math.abs(r.dx) > r.dy * 1.6) return;   // too short, or sideways: not a throw
  const ball = app.querySelector('.pong .pball.ready'); if (ball) ball.classList.add('launch');   // at once, on this phone, while the move goes in
  attemptMove({ aim: Math.round(r.aim * 1000) / 1000, power: Math.round(r.power * 1000) / 1000 });
}
export function miniature(mini, final) {
  return `<div class="tpip">${['X', 'O'].map(p => `<div class="tr ${p}"><b class="${p}">${p}</b>${mini.cups[p].map(up => `<i class="${up ? 'on' : ''}"></i>`).join('')}</div>`).join('')}</div>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = pongTable(mini, a, { view, locked, turn, zoom: state.zoom }); return g;
}
export function moveText(f, who) {
  return f.pong ? `${who} ${f.pong.sunk ? 'sank a cup' : f.pong.rim ? 'rimmed out' : 'missed'}` : `${who} threw`;
}
export function sounds(f, add, won, mini, last) {
  add('whoosh', 0); if (f.pong) { if (f.pong.rim) add('clink', PONG.fly); add(f.pong.sunk ? 'splash' : 'thud', PONG.fly + (f.pong.rim ? 400 : 0)); } return;
}

// Its listeners: main.js calls this once, in the page's original order of listeners.
export function init() {
  // Cup Pong: a flick up from anywhere on the game area (the table and the line under it), not only the
  // ball. The swipe's direction aims, its speed sets the distance; nothing is drawn while it is under way
  // (no aim line, no target). Letting go throws at once (a short or sideways swipe is nothing).
  app.addEventListener('pointerdown', e => {
    const area = e.target.closest && e.target.closest('.pong.live[data-pong="area"]');
    if (!area || pongDrag || state.screen !== 'mini' || state.flash || state.done || blocked() || !area.querySelector('.pball.ready')) return;
    ownPress();
    const table = area.querySelector('.ptable');
    pongDrag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, t0: performance.now(), x: e.clientX, y: e.clientY, table, pts: [[performance.now(), e.clientX, e.clientY]] };
    try { area.setPointerCapture(e.pointerId); } catch (err) { /* no capture: the move and up still reach the page */ }
    e.preventDefault();
  });
  app.addEventListener('pointermove', e => {
    if (!pongDrag || e.pointerId !== pongDrag.id) return;
    const d = pongDrag;
    d.x = e.clientX; d.y = e.clientY; d.pts.push([performance.now(), e.clientX, e.clientY]);
  });
  app.addEventListener('pointerup', pongRelease);
  app.addEventListener('pointercancel', e => { if (pongDrag && e.pointerId === pongDrag.id) pongDrag = null; });
}
