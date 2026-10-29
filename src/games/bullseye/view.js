// Bullseye: the screen, the miniature, the move's words and sounds, and the inputs.
import { r3 } from '../../core/util.js';
import { BULL_DEFAULTS } from './meta.js';
import { BULLS, BULLT, bullIs, bullsAim, bullsPeriod, setBullsConfig } from './rules.js';
import { tune } from '../../core/tune.js';
import { SND, ownPress } from '../../audio/sound.js';
import { FIREBASE_CONFIG, configured } from '../../net/connect.js';
import { attemptMove } from '../../net/moves.js';
import { blocked } from '../../net/room.js';
import { N, REDUCED, app, cpuPlays, state } from '../../ui/app.js';
import { KEY } from '../../ui/config.js';
import { fx, fxAttr } from '../../ui/fx.js';
import { arcTally, lateAt, pips } from '../../ui/progress.js';
import { render } from '../../ui/render.js';

// Someone else's guess (the computer's, the other phone's, or a timed-out one) shows first: the chosen
// answer lights up in their colour for a moment (BUST.pre), then the card turns. Your own goes straight on.
export function bullsPre(f) { return f && f.type === 'bullseye' && f.bull && !REDUCED && (f.timeout || (state.online ? f.by !== state.online.me : cpuPlays(f.by))) ? bullsAim(f.bull).fly : 0; }   // someone else's throw: their aim plays first
// ---------- the arcade games ----------
const DART = '<svg viewBox="0 0 26 66" aria-hidden="true"><path d="M13 2v40" stroke="var(--ink)" stroke-width="4" stroke-linecap="round"/><path d="M13 62l-5-14h10z" fill="var(--ink)"/><path d="M6 4h14l-7 14z" fill="var(--x)" stroke="var(--ink)" stroke-width="2"/></svg>';
// Bullseye: the field with the small board where it now is; aiming is two taps. First a vertical line
// sweeps left and right (a tap stops it), then a horizontal line sweeps up and down (a tap stops it);
// the throw goes in as where they stopped ({ x, y }, fractions of the field) and the dart flies to the
// crossing. The board glides to its new spot as the next throw is lined up. The sweeps run on CSS
// animations timed from their own events (the square opening, the first line stopping), so a redraw
// never moves them; a tap reads where the animation has the line that instant.
export let bullDraft = null;                                          // { sq, p, x, at }: the first line stopped (x), and when
const BOARD_SVG = (bull, board) => `<svg viewBox="-50 -50 100 100" aria-hidden="true"><circle r="48" class="bring"/>${Array.from({ length: 12 }, (_, k) => { const a0 = (k / 12) * Math.PI * 2, a1 = ((k + 1) / 12) * Math.PI * 2, r = 44; return `<path d="M0 0L${(Math.cos(a0) * r).toFixed(2)} ${(Math.sin(a0) * r).toFixed(2)}A${r} ${r} 0 0 1 ${(Math.cos(a1) * r).toFixed(2)} ${(Math.sin(a1) * r).toFixed(2)}Z" class="${k % 2 ? 'bsa' : 'bsb'}"/>`; }).join('')}<circle r="${(48 * Math.max(0.08, bull / board) + 3).toFixed(2)}" class="bbulo"/><circle r="${(48 * Math.max(0.08, bull / board)).toFixed(2)}" class="bbul"/></svg>`;
function bullsTable(mini, a, o) {
  const b = a && a.bull ? a.bull : null, l = mini.last, turn = o.turn, cfg = mini.cfg || BULL_DEFAULTS, B = BULLS, goal = tune(mini).goal;
  const pre = b ? bullsPre(a) : 0, A = pre ? bullsAim(b) : null;   // someone else's throw: their two lines sweep and stop first, as their screen showed it
  const tEnd = REDUCED ? 0 : pre + BULLT.fly;
  const tal = p => arcTally(p, o, pips(p, Math.min(goal, mini.pts[p]), goal, !!(b && b.pts && a.by === p), tEnd));   // the points as five pips
  const shown = b || (o.done && l ? l : null);                 // a throw on show: the board where it was, the lines and the dart where they stopped
  const live = !o.view && !b && !o.locked;
  if (bullDraft && (bullDraft.sq !== o.zoom || !live || bullDraft.p !== turn)) bullDraft = null;
  const pos = shown ? shown.pos : mini.pos, dia = (2 * cfg.board / B.w) * 100;
  const prev = !shown && l && l.pos ? l.pos : null;             // the board glides in from its last spot as this throw is lined up
  const slide = prev && live && !REDUCED && fx.enter ? `;--sx:${(((prev[0] - pos[0]) / (2 * cfg.board)) * 100).toFixed(1)}%;--sy:${(((prev[1] - pos[1]) / (2 * cfg.board)) * 100).toFixed(1)}%` : '';
  const board = `<div class="bdboard${slide ? ' slide' : ''}${b && b.pts ? ' hit' + b.pts : ''}" style="left:${(pos[0] / B.w * 100).toFixed(2)}%;top:${(pos[1] / B.h * 100).toFixed(2)}%;width:${dia.toFixed(2)}%${slide};--t:${tEnd}ms"${slide ? fxAttr(fx.enter.at, 'rt') : ''}>${BOARD_SVG(cfg.bull, cfg.board)}</div>`;
  const per = Math.round(bullsPeriod(cfg, mini.speed[turn] || 1)), perY = Math.round(per * B.h / B.w), delay = slide ? BULLT.slide : 0;
  let lines = '';
  if (shown && A) {                                              // the aim replayed: each line sweeps from its edge and stops at its spot, then the dart
    const X = (shown.x * 100).toFixed(2) + '%', Y = (shown.y * 100).toFixed(2) + '%';
    lines = `<span class="blayer tu" style="--u:${A.t1}ms"><i class="bvline rep" style="--p:${A.per}ms;--it:${A.vx.it};--t:0ms"></i></span>`
      + `<span class="blayer tf" style="--f:${A.t1}ms"><i class="bvline set" style="left:${X}"></i></span>`
      + `<span class="blayer tf" style="--f:${A.h0}ms"><span class="blayer tu" style="--u:${A.t2}ms"><i class="bhline rep" style="--p:${A.perY}ms;--it:${A.vy.it};--t:${A.h0}ms"></i></span></span>`
      + `<span class="blayer tf" style="--f:${A.t2}ms"><i class="bhline set" style="top:${Y}"></i></span>`
      + `<div class="bdart fly" style="left:${X};top:${Y};--t:${A.fly}ms">${DART}</div>`;
  } else if (shown) {
    lines = `<i class="bvline set" style="left:${(shown.x * 100).toFixed(2)}%"></i><i class="bhline set" style="top:${(shown.y * 100).toFixed(2)}%"></i>`
      + `<div class="bdart${b ? ' fly' : ''}" style="left:${(shown.x * 100).toFixed(2)}%;top:${(shown.y * 100).toFixed(2)}%;--t:0ms">${DART}</div>`;
  } else if (live) {
    const d = bullDraft && bullDraft.sq === o.zoom ? bullDraft : null;
    lines = d ? `<i class="bvline set" style="left:${(d.x * 100).toFixed(2)}%"></i><i class="bhline sweep" data-per="${perY}" data-delay="0" style="--p:${perY}ms;--dl:0ms"${fxAttr(d.at)}></i>`
      : `<i class="bvline sweep" data-per="${per}" data-delay="${delay}" style="--p:${per}ms;--dl:${delay}ms"${fx.enter ? fxAttr(fx.enter.at) : ''}></i>`;
  }
  const field = `<div class="bfield" data-bulls="field"${live ? ' data-live="1"' : ''} aria-label="The dartboard field">${board}${lines}</div>`;
  const step = live ? (bullDraft && bullDraft.sq === o.zoom ? 2 : 1) : 0;
  const say = pts => (bullIs(pts) ? `BULLSEYE! +${pts}` : pts ? 'On the board +1' : 'Missed the board');
  const res = b ? `<p ${lateAt('arcres ' + (b.pts ? 'ok' : 'no'), tEnd)} role="status">${say(b.pts)}</p>`
    : o.done && l ? `<p class="arcres ${l.pts ? 'ok' : 'no'}"><b class="${l.by}">${N(l.by)}</b>: ${say(l.pts)}</p>`
    : o.view ? `<p class="arcnote">${l ? `<b class="${l.by}">${N(l.by)}</b>'s last throw: ${say(l.pts)}` : ''}</p>`
    : live ? '<p class="arcnote"></p>'
    : `<p class="arcnote">Waiting for <b class="${turn}">${N(turn)}</b>…</p>`;
  const label = A ? `<span class="bswap"><span class="tu" style="--u:${A.t1}ms">Stop</span><span class="tf" style="--f:${A.t1}ms">Throw!</span></span>` : step === 2 ? 'Throw!' : 'Stop';   // someone else's throw: the button as theirs read
  const btn = o.view ? '' : `<div class="cbtns one"><button class="big ${b ? b && a.by : turn}" data-act="bulls"${o.locked || !live ? ' disabled' : ''}>${label}</button></div>`;
  return `<div class="g-arc"><div class="ctals">${tal('X')}${tal('O')}</div><div class="bulls">${field}${res}</div>${btn}</div>`;
}
// Where a sweeping line is this instant, 0 to 1: its animation's time (from its event, past the delay),
// back and forth once per period.
export function bullsLinePos(el) {
  const anim = el && typeof el.getAnimations === 'function' ? el.getAnimations()[0] : null;
  const per = Number(el.dataset.per) || 1000, delay = Number(el.dataset.delay) || 0;
  if (!anim || anim.currentTime == null) return REDUCED ? 0.5 : Math.random();
  const t = Math.max(0, anim.currentTime - delay), k = Math.floor(t / per), f = (t % per) / per;
  return Math.max(0, Math.min(1, k % 2 ? 1 - f : f));
}
// A tap (on the field or the button, from the press itself): the first stops the vertical line, the second the horizontal one and throws.
function bullsTap() {
  const sq = state.squares && state.squares[state.zoom];
  if (!sq || sq.mini.type !== 'bullseye' || sq.owner || state.flash || state.done || blocked()) return false;
  if (!bullDraft || bullDraft.sq !== state.zoom) {
    const el = app.querySelector('.bvline.sweep');
    if (!el) return false;
    bullDraft = { sq: state.zoom, p: state.turn, x: r3(bullsLinePos(el)), at: performance.now() };
    SND.play('mark');
    render();
    return true;
  }
  const el = app.querySelector('.bhline.sweep');
  if (!el) return false;
  const move = { x: bullDraft.x, y: r3(bullsLinePos(el)) };
  bullDraft = null;
  attemptMove(move);
  return true;
}
// The miniature: both players' points and the board's spot on the field.
function bullsThumb(mini) {
  const c = mini.cfg || BULL_DEFAULTS, pos = mini.pos || [BULLS.w / 2, BULLS.h / 2], pts = mini.pts || { X: 0, O: 0 }, goal = tune(mini).goal;
  return `<div class="tbull" aria-label="Bullseye: X ${pts.X}, O ${pts.O} of ${goal} points"><svg viewBox="0 0 ${BULLS.w} ${BULLS.h}"><rect x="1.5" y="1.5" width="${BULLS.w - 3}" height="${BULLS.h - 3}" rx="6" class="tbf"/><circle cx="${pos[0]}" cy="${pos[1]}" r="${Math.max(12, c.board)}" class="tbb"/><circle cx="${pos[0]}" cy="${pos[1]}" r="${Math.max(4, c.bull * Math.max(12, c.board) / c.board)}" class="tbu"/></svg>`
    + `<div class="tbpts">${['X', 'O'].map(p => `<div class="tr ${p}"><b class="${p}">${p}</b><span>${Math.min(goal, pts[p])}</span><small>/${goal}</small></div>`).join('')}</div></div>`;
}
// The difficulty (config/bulls, the admin's dashboard): fetched at every start and kept for the next visit.
const BULLS_KEY = KEY + '.bullscfg';
export function fetchBullsConfig() {
  try { const v = JSON.parse(localStorage.getItem(BULLS_KEY) || 'null'); if (v && typeof v === 'object') setBullsConfig(v); } catch (e) { /* none kept */ }
  if (!configured()) return;
  const hook = window.TTT_FIREBASE, c = (hook && hook.config) || FIREBASE_CONFIG;
  const url = hook && hook.emulator ? `http://${hook.emulator.host}:${hook.emulator.port}/config/bulls.json?ns=${c.projectId}-default-rtdb` : `${c.databaseURL}/config/bulls.json`;
  try {
    fetch(url).then(r => (r.ok ? r.json() : null)).then(v => {
      if (!v || typeof v !== 'object') return;
      setBullsConfig(v);
      try { localStorage.setItem(BULLS_KEY, JSON.stringify(v)); } catch (e) { /* no storage: read again next visit */ }
    }).catch(() => {});
  } catch (e) { /* offline: as last known */ }
}
export function miniature(mini, final) {
  return bullsThumb(mini);
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = bullsTable(mini, a, { view, locked, turn, zoom: state.zoom, done: !!d }); return g;
}
export function moveText(f, who) {
  return f.bull ? `${who} threw: ${bullIs(f.bull.pts) ? `a bullseye, +${f.bull.pts}` : f.bull.pts ? 'on the board, +1' : 'off the board'}` : `${who} threw`;
}
export function sounds(f, add, won, mini, last) {
  const pre = bullsPre(f); if (pre) { const A = bullsAim(f.bull); add('mark', A.t1); add('mark', A.t2); } add('whoosh', pre); add(f.bull && f.bull.pts ? 'dartHit' : 'dartMiss', pre + BULLT.fly); if (f.bull && bullIs(f.bull.pts)) add('sparkle', pre + BULLT.fly + 120); return;
}
// Bullseye: the taps come from the press itself (pointerdown, bullsTap); the click after it does nothing
export function bullsAct(el, e, act) {
  return;
}
// Its own controls (data-act): the page's click handler hands them here.
export const actions = { bulls: bullsAct };

// Its listeners: main.js calls this once, in the page's original order of listeners.
export function init() {
  app.addEventListener('pointerdown', e => {
    const t = e.target.closest && e.target.closest('.bfield[data-live], button[data-act="bulls"]:not(:disabled)');
    if (!t || state.screen !== 'mini') return;
    e.preventDefault(); ownPress();
    bullsTap();
  });
}

// Setters for the names other modules reassign (an imported name is read-only there).
export function setBullDraft(v) { bullDraft = v; }
