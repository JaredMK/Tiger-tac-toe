// Cup Pong: the screen, the miniature, the move's words and sounds, and the inputs.
import { PONG, pongPlan } from './rules.js';
import { ownPress } from '../../audio/sound.js';
import { attemptMove } from '../../net/moves.js';
import { blocked } from '../../net/room.js';
import { N, REDUCED, app, state } from '../../ui/app.js';
import { arcTally, lateAt } from '../../ui/progress.js';

let pongDrag = null;                           // Echo: { id, sq, level, taps, at } the attempt (at: when Play pattern was tapped); Cup Pong: the swipe under way
// Cup Pong: the table from above, the thrower's rack of cups at the far end (three cups touching in a tight
// triangle), the ball at this end. Opened, the rack is the player to move's own (during a throw, the
// thrower's; a decided square, the last thrower's). A swipe up from the ball throws it: the direction aims,
// the speed sets the distance. The ball flies (and grows, then shrinks) to where it comes down, timed from
// the move (the flash: rules.js pongPath and pongPlan); then what the throw did plays out: a make drops into
// the cup, splashes, and the cup is lifted off the table; a rim ball clinks on the rim (the cup wobbles),
// pops up and comes down off it (in the cup, or on the table and rolls off it); a miss lands and rolls off
// the table. Transforms only (smooth at 60 fps): layers the size of the table carry the ball, leg by leg.
const RIMV = 0.075;                                  // the rim as drawn, in table widths from a cup's centre (the cup is 0.17 across)
const px = x => ((x + 0.5) * 100).toFixed(1), py = y => ((1 - y) * 100).toFixed(1);
const leg = (x0, y0, x1, y1) => `--tx:${((x1 - x0) * 100).toFixed(2)}%;--ty:${((y0 - y1) * 100).toFixed(2)}%`;   // a layer's move, table x/y to table x/y
export const pongWord = g => (g.sunk ? 'In!' : g.rim ? 'Rim out' : 'Miss');
function pongBall(g) {
  const P = pongPlan(g), T = PONG.fly;
  let hx = g.x, hy = g.y;                            // where it comes down first: in the cup, on the table, or on the rim (drawn on the rim's line)
  if (g.rim) {
    const [cx, cy] = PONG.cups[g.cup], vx = Math.sin(g.ra), vy = Math.cos(g.ra) * 1.4, n = Math.hypot(vx, vy) || 1;   // (the table is drawn 1.4 times as long as it is wide)
    hx = cx + vx / n * RIMV; hy = cy + vy / n * RIMV / 1.4;
  }
  const lx = Math.max(-0.9, Math.min(0.9, hx)), ly = Math.max(-0.2, Math.min(1.3, hy));
  let l2 = '', l3 = '', hop;
  if (g.sunk) {                                      // into the cup's middle, smaller as it goes down, gone at the splash
    const [cx, cy] = PONG.cups[g.cup], dd = P.splash - T;
    l2 = `${leg(lx, ly, cx, cy)};--t:${T}ms;--d:${dd}ms`;
    hop = `${g.rim ? 'rimin' : 'drop'}" style="--t:${T}ms;--d:${dd}ms;--s:${P.splash}ms`;
  } else {
    let fx = lx, fy = ly;
    if (g.rim) { l2 = `${leg(lx, ly, g.bx, g.by)};--t:${T}ms;--d:${P.bounce - T}ms`; fx = g.bx; fy = g.by; }
    if (g.ox != null) l3 = `${leg(fx, fy, g.ox, g.oy)};--t:${P.bounce}ms;--d:${P.roll}ms`;
    hop = `${g.rim ? 'rimout' : 'land'}" style="--t:${T}ms;--d:${P.bounce - T}ms;--b:${P.bounce}ms`;
  }
  return `<div class="pfly" style="${leg(0, 0.08, lx, ly)};--d:${T}ms"><div class="pleg${l2 ? ' go' : ''}" style="${l2}"><div class="pleg roll${l3 ? ' go' : ''}" style="${l3}"><div class="parc" style="--d:${T}ms"><div class="phop ${hop}"><div class="pball"></div></div></div></div></div></div>`;
}
function pongTable(mini, a, o) {
  const g = a && a.pong ? a.pong : null, l = mini.last, turn = o.turn, mover = g ? a.by : o.view && l ? l.by : turn;
  const P = g ? pongPlan(g) : null, still = REDUCED;   // (reduced motion: the throw's end, drawn at once)
  const cups = p => `<span class="pcups" aria-label="${mini.cups[p].filter(Boolean).length} cups left">${mini.cups[p].map((up, k) => `<i ${g && g.sunk && a.by === p && g.cup === k && !still ? lateAt('on', P.splash, 'out') : `class="${up ? 'on' : ''}"`}></i>`).join('')}</span>`;   // (the cup made empties at the splash, not before)
  const tal = p => arcTally(p, o, cups(p));
  const rack = mover, up = g && !still ? g.cups[rack].map((c, k) => c || (g.sunk && g.cup === k)) : g ? g.cups[rack] : mini.cups[rack];   // during the throw the cup it sinks stands until it is lifted off
  const cupEls = PONG.cups.map(([cx, cy], k) => {
    const hit = g && !still && g.cup === k, cls = hit && g.sunk ? ' lift' : '', wob = hit && g.rim ? ' rimhit' : '';
    return `<div class="pcup ${rack}${up[k] ? '' : ' gone'}${cls}${wob}" style="left:${px(cx)}%;top:${py(cy)}%;--t:${g ? P.hit : 0}ms;--l:${g && g.sunk ? P.lift : 0}ms;--lift:${PONG.lift}ms;--lx:${cx < 0 ? -1 : 1}"></div>`;
  }).join('');
  const splash = g && g.sunk && !still ? `<div class="psplash" style="left:${px(PONG.cups[g.cup][0])}%;top:${py(PONG.cups[g.cup][1])}%;--t:${P.splash}ms"><b></b>${'<i></i>'.repeat(6)}</div>` : '';
  let ball = '';
  const mine = !o.view && !g && !o.locked;
  if (g && !still) ball = pongBall(g);
  else if (!o.view && !g) ball = `<div class="pball${mine ? ' ready' : ''}" style="left:50%;top:92%" data-pong="ball"></div>`;
  const table = `<div class="ptable" data-pong="table" aria-label="The table">${cupEls}${splash}${ball}</div>`;   // (no aim guides: the ball and the cups, nothing else)
  const res = g ? `<p ${lateAt('arcres ' + (g.sunk ? 'ok' : 'no'), still ? null : P.res)} role="status">${pongWord(g)}</p>` : l && !mine ? `<p class="arcres ${l.sunk ? 'ok' : 'no'}">${pongWord(l)}</p>` : `<p class="arcnote">${mine || o.view ? '' : `Waiting for <b class="${turn}">${N(turn)}</b>…`}</p>`;
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
// The miniature: a tiny table, each player's three cups as a small triangle at their end (X on the left, O
// on the right, the front cup towards the middle); a cup they have sunk is filled in their colour, so the
// fuller a triangle, the closer that player is to the square.
const TPONG = { X: [[25, 29], [15, 22], [15, 36]], O: [[75, 29], [85, 22], [85, 36]] };
export function miniature(mini, final) {
  const cups = p => mini.cups[p].map((up, k) => `<circle class="c ${p}${up ? '' : ' in'}" cx="${TPONG[p][k][0]}" cy="${TPONG[p][k][1]}" r="5.6"/>`).join('');
  const n = p => mini.cups[p].filter(up => !up).length;
  return `<div class="tpong" aria-label="Cup Pong: X has sunk ${n('X')}, O ${n('O')} of 3"><svg viewBox="0 0 100 58" aria-hidden="true"><rect class="tbl" x="3" y="11" width="94" height="36" rx="6"/><path class="mid" d="M50 13v32"/>${cups('X')}${cups('O')}<text x="15" y="56">X</text><text x="85" y="56">O</text></svg></div>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = pongTable(mini, a, { view, locked, turn, zoom: state.zoom }); return g;
}
export function moveText(f, who) {
  return f.pong ? `${who} ${f.pong.sunk ? 'sank a cup' : f.pong.rim ? 'rimmed out' : 'missed'}` : `${who} threw`;
}
export function sounds(f, add, won, mini, last) {
  add('whoosh', 0); if (f.pong) { const P = pongPlan(f.pong); if (f.pong.rim) add('clink', P.hit); add(f.pong.sunk ? 'splash' : 'thud', f.pong.sunk ? P.splash : P.bounce); } return;
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
