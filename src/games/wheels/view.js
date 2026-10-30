// Risky Spins: the screen, the miniature, the move's words and sounds, and the inputs.
import { WHEELS, WHEELT, isSkull, pushYourLuck, setWheelsConfig } from './rules.js';
import { FIREBASE_CONFIG, configured } from '../../net/connect.js';
import { N, mv, state } from '../../ui/app.js';
import { KEY } from '../../ui/config.js';
import { arcTally, lateAt } from '../../ui/progress.js';

// Risky Spins' points, odds and target (config/wheels, the admin's dashboard): likewise.
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
// Risky Spins: the square's three wheels side by side (no names, no averages): ten equal segments each, each
// wheel in its own colour, a segment's shade set by its points (the same on every wheel: 1 palest, 10 darkest),
// a skull's segment dark with a skull on it, so the risk reads at a glance. Above them the turn's pot (+N), under
// them the result line and Bank (its row always reserved). A tap on a wheel spins it: a few turns, slowing,
// stopping with the pointer on the segment the server's spin landed in; its points join the pot as it stops (a
// skull: the pot struck out). Bank moves the pot onto the tally. Between spins each wheel rests where it stopped.
// A square dealt before the skulls (no v) plays by its old rule: each spin's points straight onto the tally.
const WHEEL_LOOK = { high: { say: 'purple', hue: 268, sat: 58 }, mid: { say: 'blue', hue: 212, sat: 72 }, low: { say: 'green', hue: 140, sat: 52 } };
const wheelLight = v => 93 - 6.6 * v;                         // a segment's lightness (%) by its points: 93 for 0 down to 27 for 10
const wheelShade = (w, v) => `hsl(${WHEEL_LOOK[w].hue} ${WHEEL_LOOK[w].sat}% ${wheelLight(v).toFixed(1)}%)`;
const SKULL_G = '<path class="wsk" d="M-5.2 .4a5.2 5.2 0 1 1 10.4 0v2.3h-1.7v2h-7v-2h-1.7z"/><circle class="wske" cx="-2.1" cy="-.2" r="1.45"/><circle class="wske" cx="2.1" cy="-.2" r="1.45"/><path class="wske" d="M0 1.6l-.9 1.5h1.8z"/>';
function wheelSvg(vals, w) {
  const R = 46, n = vals.length;
  const pt = (f, r) => { const t = (f * 360 - 90) * Math.PI / 180; return [(50 + r * Math.cos(t)).toFixed(2), (50 + r * Math.sin(t)).toFixed(2)]; };
  const seg = (k, v) => { const [x0, y0] = pt(k / n, R), [x1, y1] = pt((k + 1) / n, R); return `<path d="M50 50 L${x0} ${y0} A${R} ${R} 0 0 1 ${x1} ${y1} Z"${isSkull(v) ? ' class="wseg sk"' : ` fill="${wheelShade(w, v)}" class="wseg"`}/>`; };
  const lab = (k, v) => {
    const [x, y] = pt((k + 0.5) / n, 33);
    if (isSkull(v)) return `<g transform="translate(${x} ${y})">${SKULL_G}</g>`;
    return `<text x="${x}" y="${(Number(y) + 4.5).toFixed(2)}" class="wv${wheelLight(v) < 50 ? ' dk' : ''}${v === 10 ? ' ten' : ''}">${v}</text>`;
  };
  return vals.map((v, k) => seg(k, v)).join('') + `<circle cx="50" cy="50" r="${R}" class="wrim"/>` + vals.map((v, k) => lab(k, v)).join('') + '<circle cx="50" cy="50" r="5" class="whub"/>';
}
const say = v => (isSkull(v) ? 'skull' : String(v));
function wheelTable(mini, a, o) {
  const s = a && a.wheel ? a.wheel : null, l = mini.last, turn = o.turn, wh = mini.wheels, T = mini.target, rest = mini.rest || {}, py = pushYourLuck(mini);
  const kind = s ? s.kind : null, by = a ? a.by : null, landed = WHEELT.spin;
  const pct = v => (100 * Math.min(1, v / T)).toFixed(1) + '%';
  const tal = p => {                                          // the bar and the points; they grow as the points land (a spin's stop, or a bank)
    const now = mini.pts[p], add = s && by === p ? (kind === 'bank' ? s.pot : !py && s.v > 0 ? s.v : 0) : 0, was = now - add, at = kind === 'bank' ? 250 : landed;
    return arcTally(p, o, `<span class="wtal"><span class="wbar" aria-hidden="true"><i${add ? ' class="grow"' : ''} style="--w0:${pct(was)};--w1:${pct(now)};--t:${at}ms"></i></span><small aria-label="${now} of ${T}">${add ? `<i class="pins" style="--t:${at}ms"><b class="was">${was}</b><b class="now">${now}</b></i>` : now}/${T}</small></span>`);
  };
  // The turn's pot: the spinner's +N (before this spin's points have landed, the old one; a skull strikes it out; a bank sends it over).
  const t = mini.turn, potBy = s && by ? by : t ? t.by : null;
  const pot = kind === 'spin' ? s.pot : kind === 'bust' || kind === 'bank' ? s.pot : t ? t.pot : 0, was = kind === 'spin' ? s.pot - s.v : pot;
  const potCls = kind === 'bust' ? ' lost' : kind === 'bank' ? ' bank' : kind === 'spin' ? (was ? ' grow' : ' grow first') : '';
  const potHtml = py && pot && potBy ? `<span class="risk wpot ${potBy}${potCls}" style="--t:${landed}ms">+${kind === 'spin' && was ? `<b class="cnt" data-from="${was}" data-delay="${landed}" data-ms="350">${pot}</b>` : pot}</span>` : '';
  const enough = !!(py && t && t.by === turn && mini.pts[turn] + t.pot >= T);   // Bank wins it: no more spinning
  const wheels = WHEELS.map(w => {
    const spun = s && s.w === w && kind !== 'bank', at = spun ? s.at : rest[w] || 0, end = (spun ? 1800 : 0) - at * 360, from = spun ? -(s.from || 0) * 360 : end;
    const dis = o.locked || !!s || enough;
    return `<button class="rwheel ${w}${spun ? ' spun' : ''}" data-act="move" ${mv(w)}${dis ? ' disabled' : ''} aria-label="The ${WHEEL_LOOK[w].say} wheel: ${wh[w].map(say).join(', ')}">
      <span class="wbox"><i class="wptr" aria-hidden="true"></i><svg viewBox="0 0 100 100" aria-hidden="true"><g class="wspin${spun ? ' go' : ''}" style="transform:rotate(${end.toFixed(1)}deg)${spun ? `;--from:${from.toFixed(1)}deg;--end:${end.toFixed(1)}deg;--d:${WHEELT.spin}ms` : ''}">${wheelSvg(wh[w], w)}</g></svg></span></button>`;
  }).join('');
  const lost = n => `Skull!${n ? ` ${n} point${n === 1 ? '' : 's'} lost` : ''}`;
  const res = s ? (kind === 'bank' ? `<p class="arcres ok" role="status">Banked ${s.pot}</p>`
      : kind === 'bust' ? `<p ${lateAt('arcres no', landed)} role="status">${lost(s.pot)}</p>`
      : `<p ${lateAt('arcres ' + (s.v > 0 ? 'ok' : 'no'), landed)} role="status">${s.v > 0 ? `+${s.v}!` : 'Nothing this time'}</p>`)
    : (o.view || o.done) && l ? `<p class="arcres ${l.kind === 'bust' || !(l.v > 0 || l.kind === 'bank') ? 'no' : 'ok'}"><b class="${l.by}">${N(l.by)}</b> ${l.kind === 'bank' ? `banked ${l.pot}` : l.kind === 'bust' ? `hit a skull${l.pot ? ': ' + l.pot + ' lost' : ''}` : `spun the ${WHEEL_LOOK[l.w].say} wheel: ${l.v > 0 ? '+' + l.v : 'nothing'}`}</p>`
    : `<p class="arcnote">${o.view ? '' : o.locked ? `Waiting for <b class="${turn}">${N(turn)}</b>…` : ''}</p>`;
  const bankPot = kind === 'spin' ? (was ? `<b class="cnt" data-from="${was}" data-delay="${landed}" data-ms="350">${pot}</b>` : `<b class="bpot" style="--t:${landed}ms">${pot}</b>`) : t && t.pot && !s ? String(t.pot) : '';
  const bank = py ? `<div class="wbank"><button class="big bank" data-act="move" ${mv('bank')}${o.locked || o.view || !(t && t.pot && t.by === turn) || (s && kind !== 'spin') ? ' disabled' : ''}>Bank${bankPot ? ' +' + bankPot : ''}</button></div>` : '';
  return `<div class="g-arc g-wheels"><div class="ctals">${tal('X')}${tal('O')}</div><div class="wheels">${py ? `<div class="wpotrow" aria-live="polite">${potHtml}</div>` : ''}<div class="rwrow">${wheels}</div>${res}${bank}</div></div>`;
}
export function miniature(mini, final) {
  return `<div class="trun" aria-label="X has ${mini.pts.X}, O has ${mini.pts.O} of ${mini.target}">${['X', 'O'].map(p => `<div class="tr ${p}"><b class="${p}">${p}</b><i style="--w:${(100 * Math.min(1, mini.pts[p] / mini.target)).toFixed(1)}%"></i></div>`).join('')}</div>`;   // both players' points to the target
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = wheelTable(mini, a, { view, locked, turn, zoom: state.zoom, done: !!d }); return g;
}
export function moveText(f, who) {
  const w = f.wheel;
  if (!w) return `${who} spun`;
  if (w.kind === 'bank') return `${who} banked ${w.pot}`;
  if (w.kind === 'bust') return `${who} hit a skull on the ${WHEEL_LOOK[w.w].say} wheel${w.pot ? `: ${w.pot} lost` : ''}`;
  return `${who} spun the ${WHEEL_LOOK[w.w].say} wheel: ${w.v > 0 ? '+' + w.v : 'nothing'}`;
}
export function sounds(f, add, won, mini, last) {   // the wheel turns, ticking slower and slower; it stops: the points, or a skull; a bank: the pot over
  if (f.wheel && f.wheel.kind === 'bank') { add('bank', 250); return; }
  add('rlSpin', 0);
  const ticks = 16;
  for (let k = 1; k <= ticks; k++) add('wheelTick', Math.round(WHEELT.spin * (1 - Math.pow(1 - k / ticks, 2.2))));
  if (!f.wheel) return;
  if (f.wheel.kind === 'bust') { add('thud', WHEELT.spin); add('bust', WHEELT.spin + 60); return; }
  add(f.wheel.v > 0 ? 'ding' : 'thud', WHEELT.spin); if (f.wheel.w === 'high' && f.wheel.v > 0) add('sparkle', WHEELT.spin + 120);
}
