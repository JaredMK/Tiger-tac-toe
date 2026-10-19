// The physics helpers on screen (Mini Golf, Pool, Bowling): Matter.js loaded on demand, the drag-back
// aim, the recording replayed, the tables.
import { other } from '../core/util.js';
import { PHYSICS, PHYS_TYPES, physShot, physicsReady, setPhysics } from '../games/shared/physics.js';
import { BOWLG } from '../games/bowling/rules.js';
import { bowlDraft, bowlKeep, drawBowl, drawBowlAim } from '../games/bowling/view.js';
import { drawGolf } from '../games/golf/view.js';
import { POOLG, poolIds } from '../games/pool/rules.js';
import { POOL_RAIL, drawPool } from '../games/pool/view.js';
import { INFO } from '../games/index.js';
import { ownPress } from '../audio/sound.js';
import { attemptMove } from '../net/moves.js';
import { blocked, presentingSeq } from '../net/room.js';
import { N, REDUCED, app, state } from './app.js';
import { ICONS } from './art.js';
import { fxAt } from './fx.js';
import { scShown } from './chaos.js';
import { arcTally, lateAt, pips } from './progress.js';
import { render } from './render.js';
import { repNote, repOn } from './replay.js';
import { outlined, rr, runCanvas, runColours } from './runner.js';

// Mini Golf, Pool and Bowling: the physics games. The table is drawn on a canvas. In Golf and Pool a shot
// is a drag back from anywhere on the table (a slingshot: pull away from where the ball should go, further
// for more power; the aim line and the power meter show it), let go to shoot. In Bowling it is two taps,
// as in Darts: the aim arrow sweeps across the lane (a tap locks it), then the power meter rises and
// falls (a tap locks it and rolls). The shot plays out in physics.js
// (Matter.js) wherever the move is made (this phone in a local match, the server in Find Match); the
// recording (every ball, 30 times a second) comes with the result, and this phone replays it from the
// move's event (fxAt), so both phones see the same shot. Matter.js comes from cdnjs as the page starts
// (a copy beside the page as the fallback); until it and physics.js are in, the three are not dealt
// (engine.js: dealable) and the checklist says so.
const MATTER_URLS = ['https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.20.0/matter.min.js', 'matter.min.js'];
let physLoading = false;
export function loadPhysics() {
  if (physicsReady() || physLoading) return;
  physLoading = true;
  const load = src => new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.async = true; s.onload = () => ok(); s.onerror = () => { s.remove(); no(new Error(src)); }; document.head.appendChild(s); });
  const matter = window.Matter ? Promise.resolve() : load(MATTER_URLS[0]).catch(() => load(MATTER_URLS[1]));
  matter.then(() => (window.PHYS ? Promise.resolve() : import('../games/shared/physics-sim.js').then(m => { window.PHYS = m.makePhysics(window.Matter); }))).then(() => {
    setPhysics(window.PHYS);
    physLoading = false;
    // Redraw only what waited on it (the checklist's Loading badge, a table or a miniature of one of the
    // three), and never while a result plays or a square stamps in: the next render will do.
    const shown = state.screen === 'setup' || (['board', 'mini', 'review', 'review-mini'].includes(state.screen) && (state.squares || []).some(sq => sq && sq.mini && (PHYS_TYPES.includes(sq.mini.type) || sq.mini.type === 'pinball')));
    if (shown && !state.flash && !state.spot && state.stamp == null && presentingSeq == null) render();
  }).catch(() => { physLoading = false; });                    // offline with no copy kept: the three are not dealt this visit
}
const PHYS_S = t => PHYSICS.lib[t === 'golf' ? 'GOLF' : t === 'pool' ? 'POOL' : 'BOWL'];
const PHYS_PULL = 0.42;                                        // a full-power pull: this much of the table's height on the screen
// The drag under way on this phone: the square, the player, the pointer, where it went down and where it is.
export let physDraft = null, physRaf = 0;
export const physRepOn = () => physRep;   // (the browser tests look)
let physRep = null;                                            // someone else's shot being lined up in a replay: { sq, p, shot: { aim, power } } (ui/replay.js)
// What a shot did, in words, for the result line (and the board's label for a move seen from the other side).
export function physResult(f, long) {
  const ph = f.phys, by = f.by, o = other(by), who = `<b class="${by}">${N(by)}</b>`, them = `<b class="${o}">${N(o)}</b>`;
  if (!ph) return { text: long ? `${who} shot` : 'Shot', ok: false };
  if (f.type === 'golf' && ph.locked) return { text: long ? `${who} locked in a shot` : 'Shot locked in', ok: false };   // Super Chaos: it plays when the round ends
  if (f.type === 'golf' && ph.both) {                                     // Super Chaos: the round's shots, played together
    const sank = ['X', 'O'].filter(p => ph.holed && ph.holed[p]), nm = p => `<b class="${p}">${N(p)}</b>`;
    if (sank.length === 2) return { text: 'Both in the cup!', ok: false };
    if (sank.length === 1) return { text: `${nm(sank[0])} sank it!`, ok: true };
    return { text: ph.lip ? 'Lipped out!' : 'Not yet', ok: false };
  }
  if (f.type === 'golf') {
    if (ph.first === by) return { text: long ? `${who} sank it!` : 'In the cup!', ok: true };
    if (ph.first) return { text: long ? `${who} knocked ${them}'s ball in!` : `Knocked in — ${them} takes it`, ok: false };
    if (ph.lip) return { text: long ? `${who} lipped out` : 'Lipped out!', ok: false };
    return { text: long ? `${who} putted` : 'Not yet', ok: false };
  }
  if (f.type === 'pool') {
    if (ph.black) return { text: long ? `${who} sank the black!` : `The black! ${them} takes it`, ok: false };
    if (ph.pocketedNow && ph.pocketedNow[by] >= POOLG.goal) return { text: long ? `${who} sank two!` : 'Two down!', ok: true };
    if (ph.pocketedNow && ph.pocketedNow[o] >= POOLG.goal) return { text: long ? `${who} sank ${them}'s last ball` : `${them}'s last ball — ${them} takes it`, ok: false };
    if (ph.scratch) return { text: long ? `${who} scratched: ${them} gets a ball more` : `Scratch! ${them} gets a ball more`, ok: false };
    if (ph.own && !ph.theirs) return { text: long ? `${who} sank a ball — and shoots again` : 'Sank one — shoot again!', ok: true };
    if (ph.own) return { text: long ? `${who} sank a ball, and ${them}'s` : `Sank one, and ${them}'s`, ok: false };
    if (ph.theirs) return { text: long ? `${who} sank ${them}'s ball` : `Sank ${them}'s ball`, ok: false };
    return { text: long ? `${who} shot` : 'Nothing down', ok: false };
  }
  if (ph.strike) return { text: long ? `${who} bowled a strike!` : 'STRIKE!', ok: true };
  if (ph.gutter) return { text: long ? `${who} rolled a gutter ball` : 'Gutter ball', ok: false };
  return { text: long ? `${who} knocked ${ph.knocked} pin${ph.knocked === 1 ? '' : 's'}` : `${ph.knocked} pin${ph.knocked === 1 ? '' : 's'}`, ok: ph.knocked >= 6 };
}
export function physTable(mini, a, o) {
  const type = mini.type, turn = o.turn;
  if (!physicsReady()) return `<div class="g-arc"><div class="phys"><div class="pscene ${type} wait"><p class="arcnote">Loading the table… (needs a connection the first time)</p></div></div></div>`;
  const ph = a && a.phys ? a.phys : null, l = mini.last, mover = ph ? a.by : turn;
  const fresh = p => !!(ph && a.by === p);
  const tal = type === 'golf' ? p => arcTally(p, o, `<small>${mini.holed[p] ? 'in the cup' : `${mini.shots[p]} shot${mini.shots[p] === 1 ? '' : 's'}`}</small>`)
    : type === 'pool' ? p => arcTally(p, o, pips(p, Math.min(POOLG.goal, mini.pocketed[p]), POOLG.goal, fresh(p) && ph.own > 0, ph ? ph.ms : 0))
    : p => arcTally(p, o, `<small>${fresh(p) && ph.knocked ? `<i class="pins" style="--t:${ph.rec && !REDUCED ? ph.ms : 0}ms"><b class="was">${mini.pins[p] - ph.knocked}</b><b class="now">${mini.pins[p]}</b></i>` : mini.pins[p]} / ${BOWLG.goal} pins</small>`);   // the total before the roll, then the new one as the pins settle
  const mine = !o.view && !ph && !o.locked;
  const bowl = type === 'bowling' ? bowlKeep(o, mine) : null;   // Bowling's two taps: 1 the arrow sweeps, 2 the meter, 3 both locked (the roll on its way)
  const t = ph ? (ph.rec && !REDUCED ? ph.ms : 0) : null;
  const res = ph ? (r => `<p ${lateAt('arcres ' + (r.ok ? 'ok' : 'no'), t)} role="status">${r.text}</p>`)(physResult(a))
    : o.view ? `<p class="arcnote">${l ? physResult({ type, by: l.by, phys: l }, true).text : ''}</p>`
    : bowl && bowl.step === 3 ? `<p class="arcnote">Rolling…</p>`
    : state.sc && mini.aim && mini.aim[turn] ? '<p class="arcnote">Shot locked in</p>'
    : mine ? '<p class="arcnote"></p>'
    : `<p class="arcnote">Waiting for <b class="${turn}">${N(turn)}</b>…</p>`;
  const strike = ph && type === 'bowling' && ph.strike ? `<div ${lateAt('pstrike', t)} aria-hidden="true">STRIKE!</div>` : '';
  const label = type === 'golf' ? `Mini golf hole: ${PHYSICS.lib.HOLES[mini.hole].name}` : type === 'pool' ? 'The pool table' : 'The bowling lane';
  const scene = `<div class="pscene ${type}" data-phys="scene"${mine ? ' data-live="1"' : ''} aria-label="${label}"><canvas data-phys="cv"></canvas>${strike}</div>`;
  const btn = type !== 'bowling' || o.view ? '' : `<div class="cbtns one"><button class="big ${ph ? a.by : turn}" data-act="bowl"${mine && bowl && bowl.step < 3 ? '' : ' disabled'}>${bowl && bowl.step >= 2 ? 'Roll!' : 'Stop'}</button></div>`;
  return `<div class="g-arc"><div class="ctals">${tal('X')}${tal('O')}</div><div class="phys">${scene}${res}</div>${btn}</div>`;
}
// The move's recording at this moment: every body's place, and whether the recording has ended.
function physFrame(ph, now, at) {
  const rec = ph && ph.rec;
  if (!rec || !rec.frames || !rec.frames.length) return null;
  const n = rec.frames.length, f = REDUCED ? n - 1 : Math.max(0, Math.min(n - 1, (now - at) / 1000 * rec.fps)), k = Math.floor(f), u = f - k;
  const fr = rec.frames[k], nx = rec.frames[Math.min(n - 1, k + 1)], pos = {};
  rec.ids.forEach((id, i) => { const x = fr[2 * i], y = fr[2 * i + 1], x2 = nx[2 * i], y2 = nx[2 * i + 1]; pos[id] = x == null ? null : x2 == null ? [x, y] : [x + (x2 - x) * u, y + (y2 - y) * u]; });   // (between two frames: part way from one to the next, so the balls glide at any screen rate)
  return { pos, done: k >= n - 1 };
}
// Where everything is when nothing is playing: the square as it stands (a bowling square shows the last
// roll's rack while its result is on show, else a fresh rack).
export function physStill(mini, showLast) {
  const L = PHYSICS.lib, out = {};
  if (mini.type === 'golf') for (const p of ['X', 'O']) out[p] = mini.holed[p] ? null : mini.balls[p];
  else if (mini.type === 'pool') for (const id of poolIds(mini)) out[id] = mini.down[id] ? null : mini.balls[id];
  else {
    const l = showLast && mini.last ? mini.last : null;
    out.ball = l ? null : L.BOWL.start;
    L.BOWL.pins.forEach((pt, k) => { out['p' + k] = l && l.down[k] ? null : pt; });
  }
  return out;
}
// After every render (and every frame while a shot plays or a drag is on): the table as it is now.
export function physPaint() {
  if (physRaf) { cancelAnimationFrame(physRaf); physRaf = 0; }
  const cv = app.querySelector('canvas[data-phys="cv"]');
  if (!cv) { physDraft = null; return; }
  if (physDrawNow(cv, performance.now())) physRaf = requestAnimationFrame(physLoop);
}
function physLoop(now) {
  physRaf = 0;
  const cv = app.querySelector('canvas[data-phys="cv"]');
  if (cv && physDrawNow(cv, now)) physRaf = requestAnimationFrame(physLoop);
}
const BUMP_LIT = 0.22;                                           // a Mini Golf bumper's flash, in s
// One drawing of the zoomed square's table; true when another frame is wanted (a replay or a drag under way).
function physDrawNow(cv, now) {
  const sq = state.squares && (scShown(state.zoom) || state.squares[state.zoom]);   // (Super Chaos's recap: the square before its claim or reset)
  if (!sq || !PHYS_TYPES.includes(sq.mini.type) || !physicsReady()) return false;
  const mini = sq.mini, f = state.flash, d = state.done;
  const ph = f && f.square === state.zoom && f.phys ? f.phys : null;
  const at = ph ? fxAt('move', f) : null;
  const fr = ph && at != null ? physFrame(ph, now, at) : null;
  const pos = fr ? fr.pos : physStill(mini, !!(ph || d || sq.owner || state.winner));
  if (physRep && (ph || !repOn(state.zoom))) physRep = null;   // the shot has played, or the replay is over
  const dr = physDraft && physDraft.sq === state.zoom && !ph ? physDraft : physRep && physRep.sq === state.zoom && !ph ? physRep : null;
  const { c, W, H } = runCanvas(cv);
  if (W < 2 || H < 2) return false;
  const S = PHYS_S(mini.type), M = mini.type === 'pool' ? POOL_RAIL : 0, k = Math.min(W / (S.w + 2 * M), H / (S.h + 2 * M)), ox = (W - S.w * k) / 2, oy = (H - S.h * k) / 2;   // the pool table keeps a rail of one width all round
  const g = { c, W, H, k, M, X: x => ox + x * k, Y: y => oy + y * k };
  const el = ph && at != null ? (now - at) / 1000 : null, lit = el != null && mini.type === 'golf' ? new Set((ph.events || []).filter(e => e.k === 'bump' && el >= e.t && el < e.t + BUMP_LIT).map(e => e.b)) : null;   // (Mini Golf: a bumper flashes as it kicks)
  if (mini.type === 'golf') drawGolf(g, mini, pos, lit); else if (mini.type === 'pool') drawPool(g, mini, pos); else drawBowl(g, mini, pos);
  if (dr) drawAim(g, mini, pos, dr);
  else if (mini.type === 'golf' && mini.aim && state.sc && !ph) for (const p of Object.keys(mini.aim)) if (pos[p]) drawLocked(g, pos[p], mini.aim[p]);   // Super Chaos: a shot locked in, waiting for the round's end
  const bd = mini.type === 'bowling' && !ph && bowlDraft && bowlDraft.sq === state.zoom ? bowlDraft : null;
  if (bd) drawBowlAim(g, pos, bd, now);
  return !!(dr || (bd && bd.step < 3) || (fr && !fr.done));
}
// Super Chaos: a golf shot locked in, as a still arrow from the ball (its length the power).
function drawLocked(g, from, shot) {
  const c = g.c, S = PHYS_S('golf'), X = g.X(from[0]), Y = g.Y(from[1]), len = (0.12 + 0.3 * shot.power) * S.h * g.k;
  const hx = X + Math.sin(shot.aim) * len, hy = Y - Math.cos(shot.aim) * len;
  c.save(); c.lineWidth = 3; c.strokeStyle = 'rgba(255,255,255,.9)';
  c.beginPath(); c.moveTo(X, Y); c.lineTo(hx, hy); c.stroke();
  c.beginPath(); c.moveTo(hx, hy); c.lineTo(hx - Math.sin(shot.aim + 2.6) * 10, hy + Math.cos(shot.aim + 2.6) * 10); c.lineTo(hx - Math.sin(shot.aim - 2.6) * 10, hy + Math.cos(shot.aim - 2.6) * 10); c.closePath(); c.fillStyle = '#fff'; c.fill();
  c.restore();
}
// ---- the drawing: bold ink outlines and flat colours, like the rest of the game ----
export function physBall(g, x, y, r, fill, label, ink) {
  const c = g.c, X = g.X(x), Y = g.Y(y), R = r * g.k;
  c.beginPath(); c.arc(X, Y, R, 0, Math.PI * 2); c.fillStyle = fill; c.fill(); c.lineWidth = Math.max(1.5, R * 0.2); c.strokeStyle = ink; c.stroke();
  c.beginPath(); c.arc(X - R * 0.36, Y - R * 0.36, R * 0.22, 0, Math.PI * 2); c.fillStyle = 'rgba(255,255,255,.6)'; c.fill();
  if (label) { c.fillStyle = ink; c.font = `800 ${Math.max(7, Math.round(R * 1.15))}px Nunito, Arial, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(label, X, Y + R * 0.1); }
}
export function physSkull(g, x, y, r) {                                 // the black ball's mark: a little skull
  const c = g.c, X = g.X(x), Y = g.Y(y), R = r * g.k;
  c.fillStyle = '#fff'; c.beginPath(); c.arc(X, Y - R * 0.12, R * 0.42, 0, Math.PI * 2); c.fill();
  c.fillRect(X - R * 0.26, Y + R * 0.1, R * 0.52, R * 0.3);
  c.fillStyle = '#111'; c.beginPath(); c.arc(X - R * 0.16, Y - R * 0.16, R * 0.11, 0, Math.PI * 2); c.arc(X + R * 0.16, Y - R * 0.16, R * 0.11, 0, Math.PI * 2); c.fill();
}
// The shot being lined up: the pull (a band from the ball to the finger), the aim line the other way,
// longer with the power, and the power meter up the side.
function drawAim(g, mini, pos, dr) {
  const c = g.c, P = runColours(), S = PHYS_S(mini.type), from = physFrom(mini, dr.p, pos);
  if (!from) return;
  const shot = dr.shot ? Object.assign({ px: dr.shot.power * PHYS_PULL * g.H }, dr.shot) : physPull(dr);   // (a replay: the shot as the other side had it lined up)
  const X = g.X(from[0]), Y = g.Y(from[1]), len = (0.12 + 0.3 * shot.power) * S.h * g.k;
  c.save();
  c.setLineDash([6, 6]); c.lineWidth = 3; c.strokeStyle = 'rgba(255,255,255,.9)';
  c.beginPath(); c.moveTo(X, Y); c.lineTo(X + Math.sin(shot.aim) * len, Y - Math.cos(shot.aim) * len); c.stroke();
  c.setLineDash([]);
  c.beginPath(); c.moveTo(X, Y); c.lineTo(X - Math.sin(shot.aim) * shot.px, Y + Math.cos(shot.aim) * shot.px); c.lineWidth = 2; c.strokeStyle = 'rgba(0,0,0,.35)'; c.stroke();   // the band
  const hx = X + Math.sin(shot.aim) * len, hy = Y - Math.cos(shot.aim) * len;             // the arrow head
  c.beginPath(); c.moveTo(hx, hy); c.lineTo(hx - Math.sin(shot.aim + 2.6) * 10, hy + Math.cos(shot.aim + 2.6) * 10); c.lineTo(hx - Math.sin(shot.aim - 2.6) * 10, hy + Math.cos(shot.aim - 2.6) * 10); c.closePath(); c.fillStyle = '#fff'; c.fill();
  const mw = 12, mh = Math.min(g.H * 0.5, 160), mx = g.W - mw - 10, my = (g.H - mh) / 2;   // the meter
  rr(c, mx, my, mw, mh, 6); outlined(c, 'rgba(255,255,255,.5)', P.ink, 2);
  const fill = mh * shot.power, hue = 120 - 120 * shot.power;
  if (fill > 2) { rr(c, mx + 2, my + mh - fill + 1, mw - 4, fill - 2, 4); c.fillStyle = `hsl(${hue} 80% 48%)`; c.fill(); }
  c.restore();
}
function physFrom(mini, p, pos) { return mini.type === 'golf' ? pos[p] : mini.type === 'pool' ? pos.cue : pos.ball || PHYSICS.lib.BOWL.start; }
// The pull as a shot: the aim away from the finger (0 straight up the table), the power from the length.
export function physPull(dr) {
  const dx = dr.x0 - dr.x, dy = dr.y0 - dr.y, px = Math.hypot(dx, dy), box = dr.scene.getBoundingClientRect();
  return { aim: px < 1 ? 0 : Math.atan2(dx, -dy), power: Math.min(1, px / (PHYS_PULL * box.height)), px };
}
// The miniature: the table as it stands (both balls and the cup; the balls left and the pockets; the
// rack, with each player's pins so far as a bar).
export function physThumb(mini) {
  const L = PHYSICS.lib;
  if (!L) return `<div class="tphys wait" aria-label="${INFO[mini.type].name}">${ICONS[mini.type]}</div>`;
  const ball = (x, y, r, cls, label) => `<circle cx="${x}" cy="${y}" r="${r}" class="${cls}"/>${label ? `<text x="${x}" y="${y + r * 0.45}" font-size="${r * 1.3}" class="${cls}">${label}</text>` : ''}`;
  if (mini.type === 'golf') {
    const S = L.GOLF, h = L.HOLES[mini.hole];
    return `<svg class="tphys" viewBox="0 0 ${S.w} ${S.h}" aria-label="Mini golf: ${h.name}${['X', 'O'].map(p => mini.holed[p] ? `, ${p} in the cup` : '').join('')}">
      <rect x="0" y="0" width="${S.w}" height="${S.h}" class="grass"/>
      ${h.walls.map(([x, y, w, hh, a]) => `<rect x="${x - w / 2}" y="${y - hh / 2}" width="${w}" height="${hh}" rx="2" transform="rotate(${((a || 0) * 180 / Math.PI).toFixed(1)} ${x} ${y})" class="wall"/>`).join('')}
      ${h.bumpers.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" class="bump"/>`).join('')}
      <circle cx="${h.cup[0]}" cy="${h.cup[1]}" r="${S.cupR}" class="cup"/>
      ${['X', 'O'].map(p => (mini.holed[p] ? '' : ball(mini.balls[p][0], mini.balls[p][1], S.ballR * 1.5, p, p))).join('')}</svg>`;
  }
  if (mini.type === 'pool') {
    const S = L.POOL;
    return `<svg class="tphys" viewBox="-4 -4 ${S.w + 8} ${S.h + 8}" aria-label="Pool: X has ${mini.pocketed.X} down, O has ${mini.pocketed.O} down">
      <rect x="-4" y="-4" width="${S.w + 8}" height="${S.h + 8}" rx="4" class="rail"/><rect x="0" y="0" width="${S.w}" height="${S.h}" class="cloth"/>
      ${S.pockets.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" class="pocket"/>`).join('')}
      ${poolIds(mini).map(id => (mini.down[id] ? '' : ball(mini.balls[id][0], mini.balls[id][1], S.ballR * 1.5, id === 'cue' ? 'cue' : id === 'black' ? 'black' : id[0].toUpperCase(), id === 'cue' || id === 'black' ? '' : id[0].toUpperCase()))).join('')}</svg>`;
  }
  const S = L.BOWL, l = mini.last;
  return `<div class="tbowl" aria-label="Bowling: X has ${mini.pins.X} pins, O has ${mini.pins.O} of ${BOWLG.goal}"><svg viewBox="30 6 40 52">
    ${S.pins.map(([x, y], k) => `<circle cx="${x}" cy="${y}" r="${S.pinR * 1.6}" class="pin${l && l.down[k] ? ' down' : ''}"/>`).join('')}</svg>
    <div class="trun bscore">${['X', 'O'].map(p => `<div class="tr ${p}"><b class="${p}">${p}</b><i style="--w:${(100 * Math.min(1, mini.pins[p] / BOWLG.goal)).toFixed(1)}%"></i><span>${Math.min(BOWLG.goal, mini.pins[p])}<small>/${BOWLG.goal}</small></span></div>`).join('')}</div></div>`;   // (a line each: the player's mark, their pins as a bar, and the count)
}
// Someone else's shot replayed (ui/replay.js): their pull shown as it grew (the drag's readings logged on
// their phone, or a few made up for the computer), then the shot.
function physReplayInput(act, val, r) {
  const m = /^a=(-?[\d.]+),p=([\d.]+)$/.exec(val || '');
  if ((act !== 'drag' && act !== 'aim') || !m) return false;
  physRep = { sq: r.sq, p: r.by, shot: { aim: Number(m[1]), power: Number(m[2]) } };
  physPaint();
  return true;
}
const physReplaySynth = m => (m && typeof m === 'object' && Number.isFinite(m.aim) ? [0.2, 0.5, 0.8].map((k, i) => [i * 280, 'drag', `a=${m.aim},p=${(m.power * k).toFixed(3)}`]).concat([[900, 'aim', `a=${m.aim},p=${m.power}`]]) : null);
export const physReplay = { input: physReplayInput, synth: physReplaySynth };
export function physicsSounds(f, add, won, mini, last) {   // the recording's events, as they come round in the replay; then the result
  const ph = f.phys; if (!ph) return;
  if (ph.locked) { add('clack', 0); return; }                              // Super Chaos: the putt locked in (it plays at the round's end)
  const live = ph.rec && !REDUCED, end = live ? ph.ms : 0;
  if (live) for (const e of ph.events || []) { const t = e.t * 1000; if (e.k === 'balls') add('clack', t); else if (e.k === 'wall') add('cushion', t); else if (e.k === 'bump') add('bumper', t); else if (e.k === 'pin') add('pinHit', t); else if (e.k === 'hole') add('plop', t); else if (e.k === 'pocket') add(e.id === 'cue' ? 'thud' : 'plop', t); else if (e.k === 'lip') add('clink', t); else if (e.k === 'gutter') add('thud', t); else if (e.k === 'pit' || e.k === 'end') add('thud', t); }
  if (f.type === 'bowling') add(ph.strike ? 'strike' : ph.gutter ? 'thud' : 'ding', end);
  else if (f.type === 'pool') add(ph.black ? 'buzz' : ph.scratch ? 'thud' : ph.own && !ph.theirs ? 'ding' : 'thud', end);
  else if (ph.both) { if (!(ph.holed && (ph.holed.X || ph.holed.O))) add(ph.lip ? 'thud' : 'ding', end); }
  else if (!ph.first) add(ph.lip ? 'thud' : 'ding', end);
  return;
}

// Its listeners: main.js calls this once, in the page's original order of listeners.
export function init() {
  app.addEventListener('pointerdown', e => {
    const scene = e.target.closest && e.target.closest('[data-phys="scene"]');
    if (!scene || !scene.dataset.live || scene.classList.contains('bowling') || physDraft || blocked() || state.flash || state.done) return;
    e.preventDefault(); ownPress();
    physDraft = { sq: state.zoom, p: state.turn, pointer: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, scene };
    try { scene.setPointerCapture(e.pointerId); } catch (err) { /* no capture: the move and up still reach the page */ }
    physPaint();
  });
  app.addEventListener('pointermove', e => {
    const dr = physDraft;
    if (!dr || dr.pointer !== e.pointerId) return;
    dr.x = e.clientX; dr.y = e.clientY;
    if (!dr.noted || performance.now() - dr.noted > 150) { const s = physPull(dr); dr.noted = performance.now(); repNote('drag', `a=${s.aim.toFixed(3)},p=${s.power.toFixed(3)}`); }   // the pull as it grows, for the other side's replay
  });
  app.addEventListener('pointerup', e => {
    const dr = physDraft;
    if (!dr || dr.pointer !== e.pointerId) return;
    dr.x = e.clientX; dr.y = e.clientY;
    const shot = physPull(dr);
    physDraft = null;
    if (shot.power < 0.05 || dr.sq !== state.zoom) { physPaint(); return; }           // a tap, or a pull too short to count: nothing
    const m = physShot({ aim: shot.aim, power: shot.power });
    repNote('aim', `a=${m.aim},p=${m.power}`);
    attemptMove(m);
  });
  app.addEventListener('pointercancel', e => { if (physDraft && physDraft.pointer === e.pointerId) { physDraft = null; physPaint(); } });
}
