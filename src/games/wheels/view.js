// Risk Wheels: the screen, the miniature, the move's words and sounds, and the inputs.
import { WHEELS, WHEELT, setWheelsConfig } from './rules.js';
import { FIREBASE_CONFIG, configured } from '../../net/connect.js';
import { N, mv, state } from '../../ui/app.js';
import { KEY } from '../../ui/config.js';
import { arcTally, lateAt } from '../../ui/progress.js';

// Risk Wheels' points, odds and target (config/wheels, the admin's dashboard): likewise.
const WHEELS_KEY = KEY + '.wheelscfg';
export function fetchWheelsConfig() {
  try { const v = JSON.parse(localStorage.getItem(WHEELS_KEY) || 'null'); if (v && typeof v === 'object') setWheelsConfig(v); } catch (e) { /* none kept */ }
  if (!configured()) return;
  const hook = window.TTT_FIREBASE, c = (hook && hook.config) || FIREBASE_CONFIG;
  const url = hook && hook.emulator ? `http://${hook.emulator.host}:${hook.emulator.port}/config/wheels.json?ns=${c.projectId}-default-rtdb` : `${c.databaseURL}/config/wheels.json`;
  try {
    fetch(url).then(r => (r.ok ? r.json() : null)).then(v => {
      if (!v || typeof v !== 'object') return;
      setWheelsConfig(v);
      try { localStorage.setItem(WHEELS_KEY, JSON.stringify(v)); } catch (e) { /* no storage: read again next visit */ }
    }).catch(() => {});
  } catch (e) { /* offline: as last known */ }
}
// Risk Wheels: the square's three wheels side by side and nothing else (no names, no averages): ten equal
// segments each with its points on it, each wheel in its own colour, a segment's shade set by its points
// (the same on every wheel: 0 palest, 10 darkest), so the risk reads at a glance. A tap on a wheel spins it:
// a few turns, slowing, stopping with the pointer on the segment the server's spin landed in; the points
// pop up and go onto the spinner's tally. Between spins each wheel rests where it last stopped.
const WHEEL_LOOK = { high: { say: 'purple', hue: 268, sat: 58 }, mid: { say: 'blue', hue: 212, sat: 72 }, low: { say: 'green', hue: 140, sat: 52 } };
const wheelLight = v => 93 - 6.6 * v;                         // a segment's lightness (%) by its points: 93 for 0 down to 27 for 10
const wheelShade = (w, v) => `hsl(${WHEEL_LOOK[w].hue} ${WHEEL_LOOK[w].sat}% ${wheelLight(v).toFixed(1)}%)`;
function wheelSvg(vals, w) {
  const R = 46, n = vals.length;
  const pt = (f, r) => { const t = (f * 360 - 90) * Math.PI / 180; return [(50 + r * Math.cos(t)).toFixed(2), (50 + r * Math.sin(t)).toFixed(2)]; };
  const seg = (k, col) => { const [x0, y0] = pt(k / n, R), [x1, y1] = pt((k + 1) / n, R); return `<path d="M50 50 L${x0} ${y0} A${R} ${R} 0 0 1 ${x1} ${y1} Z" fill="${col}" class="wseg"/>`; };
  const lab = (k, v, dark) => { const [x, y] = pt((k + 0.5) / n, 33); return `<text x="${x}" y="${(Number(y) + 4.5).toFixed(2)}" class="wv${dark ? ' dk' : ''}${v === 10 ? ' ten' : ''}">${v}</text>`; };
  return vals.map((v, k) => seg(k, wheelShade(w, v))).join('') + `<circle cx="50" cy="50" r="${R}" class="wrim"/>` + vals.map((v, k) => lab(k, v, wheelLight(v) < 50)).join('') + '<circle cx="50" cy="50" r="5" class="whub"/>';
}
function wheelTable(mini, a, o) {
  const s = a && a.wheel ? a.wheel : null, l = mini.last, turn = o.turn, wh = mini.wheels, T = mini.target, rest = mini.rest || {};
  const pct = v => (100 * Math.min(1, v / T)).toFixed(1) + '%';
  const tal = p => {                                          // the bar and the points; the spinner's grow as the wheel stops
    const now = mini.pts[p], fresh = !!(s && a.by === p && s.v), was = fresh ? now - s.v : now;
    return arcTally(p, o, `<span class="wtal"><span class="wbar" aria-hidden="true"><i${fresh ? ' class="grow"' : ''} style="--w0:${pct(was)};--w1:${pct(now)};--t:${WHEELT.spin}ms"></i></span><small aria-label="${now} of ${T}">${fresh ? `<i class="pins" style="--t:${WHEELT.spin}ms"><b class="was">${was}</b><b class="now">${now}</b></i>` : now}/${T}</small></span>`);
  };
  const wheels = WHEELS.map(w => {
    const spun = s && s.w === w, at = spun ? s.at : rest[w] || 0, end = (spun ? 1800 : 0) - at * 360, from = spun ? -(s.from || 0) * 360 : end;
    const dis = o.locked || !!s;
    return `<button class="rwheel ${w}${spun ? ' spun' : ''}" data-act="move" ${mv(w)}${dis ? ' disabled' : ''} aria-label="The ${WHEEL_LOOK[w].say} wheel: ${wh[w].join(', ')}">
      <span class="wbox"><i class="wptr" aria-hidden="true"></i><svg viewBox="0 0 100 100" aria-hidden="true"><g class="wspin${spun ? ' go' : ''}" style="transform:rotate(${end.toFixed(1)}deg)${spun ? `;--from:${from.toFixed(1)}deg;--end:${end.toFixed(1)}deg;--d:${WHEELT.spin}ms` : ''}">${wheelSvg(wh[w], w)}</g></svg></span></button>`;
  }).join('');
  const res = s ? `<p ${lateAt('arcres ' + (s.v ? 'ok' : 'no'), WHEELT.spin)} role="status">${s.v ? `+${s.v}!` : 'Nothing this time'}</p>`
    : (o.view || o.done) && l ? `<p class="arcres ${l.v ? 'ok' : 'no'}"><b class="${l.by}">${N(l.by)}</b> spun the ${WHEEL_LOOK[l.w].say} wheel: ${l.v ? '+' + l.v : 'nothing'}</p>`
    : `<p class="arcnote">${o.view ? '' : o.locked ? `Waiting for <b class="${turn}">${N(turn)}</b>…` : ''}</p>`;
  return `<div class="g-arc"><div class="ctals">${tal('X')}${tal('O')}</div><div class="wheels"><div class="rwrow">${wheels}</div>${res}</div></div>`;
}
export function miniature(mini, final) {
  return `<div class="trun" aria-label="X has ${mini.pts.X}, O has ${mini.pts.O} of ${mini.target}">${['X', 'O'].map(p => `<div class="tr ${p}"><b class="${p}">${p}</b><i style="--w:${(100 * Math.min(1, mini.pts[p] / mini.target)).toFixed(1)}%"></i></div>`).join('')}</div>`;   // both players' points to the target
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = wheelTable(mini, a, { view, locked, turn, zoom: state.zoom, done: !!d }); return g;
}
export function moveText(f, who) {
  return f.wheel ? `${who} spun the ${WHEEL_LOOK[f.wheel.w].say} wheel: ${f.wheel.v ? '+' + f.wheel.v : 'nothing'}` : `${who} spun`;
}
export function sounds(f, add, won, mini, last) {   // the wheel turns, ticking slower and slower; it stops: the points, or nothing
  add('rlSpin', 0);
  const ticks = 16;
  for (let k = 1; k <= ticks; k++) add('wheelTick', Math.round(WHEELT.spin * (1 - Math.pow(1 - k / ticks, 2.2))));
  if (f.wheel) { add(f.wheel.v ? 'ding' : 'thud', WHEELT.spin); if (f.wheel.w === 'high' && f.wheel.v) add('sparkle', WHEELT.spin + 120); }
  return;
}
