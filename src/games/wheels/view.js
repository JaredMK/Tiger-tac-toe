// Risky Spins: the screen, the miniature, the move's words and sounds, and the inputs.
import { WHEELT, isSkull, pushYourLuck, setWheelsConfig, wheelsOf } from './rules.js';
import { FIREBASE_CONFIG, configured } from '../../net/connect.js';
import { N, mv, state, waitLine } from '../../ui/app.js';
import { KEY } from '../../ui/config.js';
import { arcTally, lateAt } from '../../ui/progress.js';
import { spinTicks } from '../../ui/spin.js';

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
// Risky Spins: the square's wheels side by side, two (the safe one and the risky one; a square dealt before November 2026 has three, and
// is drawn with its three: wheelsOf), no names, no averages: ten equal segments each, each
// wheel in its own colour, a segment's shade set by its points (the same on every wheel: 1 palest, 10 darkest),
// a skull's segment near black with a skull on it (no value's shade comes near it: the darkest value, 9, keeps
// about half its lightness), the 10 gold (never a dark shade that could pass for a skull), so the risk reads at a glance. Above them the turn's pot (+N), under
// them the result line and Bank (its row always reserved). A tap on a wheel spins it: a few turns, slowing,
// stopping with the pointer on the segment the server's spin landed in; its points join the pot as it stops (a
// skull: the pot struck out). Bank moves the pot onto the tally. Between spins each wheel rests where it stopped.
// A square dealt before the skulls (no v) plays by its old rule: each spin's points straight onto the tally.
const WHEEL_LOOK = { high: { say: 'purple', hue: 268, sat: 58 }, mid: { say: 'blue', hue: 212, sat: 72 }, low: { say: 'green', hue: 140, sat: 52 } };
const wheelLight = v => 90 - 4.8 * v;                         // a segment's lightness (%) by its points: 85 for 1 down to 47 for 9 (the 10 is gold: styles.css .wseg.ten)
const wheelShade = (w, v) => `hsl(${WHEEL_LOOK[w].hue} ${WHEEL_LOOK[w].sat}% ${wheelLight(v).toFixed(1)}%)`;
const SKULL_G = '<path class="wsk" d="M-5.2 .4a5.2 5.2 0 1 1 10.4 0v2.3h-1.7v2h-7v-2h-1.7z"/><circle class="wske" cx="-2.1" cy="-.2" r="1.45"/><circle class="wske" cx="2.1" cy="-.2" r="1.45"/><path class="wske" d="M0 1.6l-.9 1.5h1.8z"/>';
const SKULL_I = `<svg class="wlsk" viewBox="-7 -7 14 14" aria-hidden="true">${SKULL_G}</svg>`;   // the skull alone, for a wheel's label and a skull's moment
function wheelSvg(vals, w) {
  const R = 46, n = vals.length;
  const pt = (f, r) => { const t = (f * 360 - 90) * Math.PI / 180; return [(50 + r * Math.cos(t)).toFixed(2), (50 + r * Math.sin(t)).toFixed(2)]; };
  const seg = (k, v) => { const [x0, y0] = pt(k / n, R), [x1, y1] = pt((k + 1) / n, R); return `<path d="M50 50 L${x0} ${y0} A${R} ${R} 0 0 1 ${x1} ${y1} Z"${isSkull(v) ? ' class="wseg sk"' : v === 10 ? ' class="wseg ten"' : ` fill="${wheelShade(w, v)}" class="wseg"`}/>`; };
  const lab = (k, v) => {
    const [x, y] = pt((k + 0.5) / n, 33);
    if (isSkull(v)) return `<g transform="translate(${x} ${y})">${SKULL_G}</g>`;
    return `<text x="${x}" y="${(Number(y) + 4.5).toFixed(2)}" class="wv${wheelLight(v) < 50 ? ' dk' : ''}${v === 10 ? ' ten' : ''}">${v}</text>`;
  };
  const peg = k => { const [x, y] = pt(k / n, R - 0.4); return `<circle class="wpeg" cx="${x}" cy="${y}" r="2"/>`; };   // a peg between every two segments: the pointer ticks over them
  return vals.map((v, k) => seg(k, v)).join('') + `<circle cx="50" cy="50" r="${R}" class="wrim"/>` + vals.map((v, k) => lab(k, v)).join('') + vals.map((v, k) => peg(k)).join('') + '<circle cx="50" cy="50" r="6" class="whub"/><circle cx="48.6" cy="48.6" r="1.7" class="whubl"/>';
}
const say = v => (isSkull(v) ? 'skull' : String(v));
// A spin's turn of the wheel (degrees: from where it rested, five turns on to its stop) and the moments its pegs pass
// the pointer (ui/spin.js: the curve the stylesheet plays), for the pointer's flicks and the tick sounds alike.
const SPIN_TURNS = 1800;
const spinEnds = s => ({ from: -(s.from || 0) * 360, end: SPIN_TURNS - (s.at || 0) * 360 });
const wheelTicks = (s, n) => { const e = spinEnds(s); return spinTicks(e.from, e.end, 360 / (n || 10), WHEELT.spin); };
function wheelTable(mini, a, o) {
  const s = a && a.wheel ? a.wheel : null, l = mini.last, turn = o.turn, wh = mini.wheels, T = mini.target, rest = mini.rest || {}, py = pushYourLuck(mini);
  const kind = s ? s.kind : null, by = a ? a.by : null, landed = WHEELT.spin, mover = s && by ? by : turn;
  const pct = v => (100 * Math.min(1, v / T)).toFixed(1) + '%';
  const tal = p => {                                          // the gauge and the points; both fill to the new total together as the points land (a spin's stop, or a bank), timed from the move (a winning bank's "Won by" waits for it: rules.js flashMs)
    const now = mini.pts[p], add = s && by === p ? (kind === 'bank' ? s.pot : !py && s.v > 0 ? s.v : 0) : 0, was = now - add, at = kind === 'bank' ? WHEELT.bank : landed;
    return arcTally(p, o, `<span class="wtal"><span class="wbar" aria-hidden="true"><i${add ? ' class="grow"' : ''} style="--w0:${pct(was)};--w1:${pct(now)};--t:${at}ms;--d:${WHEELT.fill}ms"></i></span><small aria-label="${now} of ${T}">${add ? `<b class="cnt" data-from="${was}" data-delay="${at}" data-ms="${WHEELT.fill}">${now}</b>` : now}/${T}</small></span>`);
  };
  // The turn's pot: the spinner's +N (before this spin's points have landed, the old one; a skull strikes it out; a bank sends it over).
  // A spin's points pop out at the pointer as the wheel stops and fly into the pot (.wfly), which takes them as they arrive (WHEELT.fly).
  const t = mini.turn, potBy = s && by ? by : t ? t.by : null, inPot = landed + WHEELT.fly;
  const pot = kind === 'spin' ? s.pot : kind === 'bust' || kind === 'bank' ? s.pot : t ? t.pot : 0, was = kind === 'spin' ? s.pot - s.v : pot;
  const potCls = kind === 'bust' ? ' lost' : kind === 'bank' ? ' bank' : kind === 'spin' ? (was ? ' grow' : ' grow first') : '';
  const potHtml = py && pot && potBy ? `<span class="risk wpot ${potBy}${potCls}" style="--t:${kind === 'spin' ? inPot : landed}ms;--bk:${WHEELT.bank}ms">+${kind === 'spin' && was ? `<b class="cnt" data-from="${was}" data-delay="${inPot}" data-ms="200">${pot}</b>` : pot}</span>` : '';
  const enough = !!(py && t && t.by === turn && mini.pts[turn] + t.pot >= T);   // Bank wins it: no more spinning
  const ws = wheelsOf(mini), side = k => (ws.length === 2 ? 'lr'[k] : 'lcr'[k]) || 'c';
  const fly = py && kind === 'spin' && s.v > 0 && by ? `<span class="wfly ${by} ${side(ws.indexOf(s.w))}${s.v === 10 ? ' ten' : ''}" style="--t:${landed}ms;--d:${WHEELT.fly}ms" aria-hidden="true">+${s.v}</span>` : '';
  const wheels = ws.map(w => {
    const spun = s && s.w === w && kind !== 'bank', at = spun ? s.at : rest[w] || 0, e = spun ? spinEnds(s) : null, end = spun ? e.end : -at * 360, from = spun ? e.from : end;
    const dis = o.locked || !!s || enough, vals = wh[w], pts = vals.filter(v => !isSkull(v)), sk = vals.length - pts.length;
    // the pointer flicks as each peg passes it (the tick sounds are at the same moments: sounds below); the wheel's box jolts on a skull, swells on points
    const flick = spun ? ` style="animation:${wheelTicks(s, vals.length).map(ms => `wflick 110ms ${ms}ms`).join(',') || 'none'}"` : '';
    const hit = spun ? (kind === 'bust' ? ' bust' : s.v > 0 ? ' pay' : '') : '';
    const leg = `<span class="wleg" aria-hidden="true"><span class="wlk">${SKULL_I}<b>×${sk}</b></span><span class="wlv">${pts.length ? `${Math.min(...pts)}–${Math.max(...pts)}` : ''}</span></span>`;   // the wheel at a glance: its skulls, its values
    return `<button class="rwheel ${w}${spun ? ' spun' : ''}" data-act="move" ${mv(w)}${dis ? ' disabled' : ''} aria-label="The ${WHEEL_LOOK[w].say} wheel: ${vals.map(say).join(', ')}">
      <span class="wbox${hit}"${spun ? ` style="--t:${landed}ms"` : ''}><i class="wptr" aria-hidden="true"${flick}></i><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="52.6" r="46" class="wshd"/><g class="wspin${spun ? ' go' : ''}" style="transform:rotate(${end.toFixed(1)}deg)${spun ? `;--from:${from.toFixed(1)}deg;--end:${end.toFixed(1)}deg;--d:${WHEELT.spin}ms` : ''}">${wheelSvg(vals, w)}</g></svg>${spun && kind === 'bust' ? `<i class="wboo" style="--t:${landed}ms" aria-hidden="true">${SKULL_I}</i>` : ''}</span>${leg}</button>`;
  }).join('');
  const lost = n => `Skull!${n ? ` ${n} point${n === 1 ? '' : 's'} lost` : ''}`;
  const res = s ? (kind === 'bank' ? `<p class="arcres ok" role="status">Banked ${s.pot}</p>`
      : kind === 'bust' ? `<p ${lateAt('arcres no', landed)} role="status">${lost(s.pot)}</p>`
      : `<p ${lateAt('arcres ' + (s.v === 10 ? 'ok ten' : s.v > 0 ? 'ok' : 'no'), landed)} role="status">${s.v > 0 ? `+${s.v}!` : 'Nothing this time'}</p>`)
    : (o.view || o.done) && l ? `<p class="arcres ${l.kind === 'bust' || !(l.v > 0 || l.kind === 'bank') ? 'no' : 'ok'}"><b class="${l.by}">${N(l.by)}</b> ${l.kind === 'bank' ? `banked ${l.pot}` : l.kind === 'bust' ? `hit a skull${l.pot ? ': ' + l.pot + ' lost' : ''}` : `spun the ${WHEEL_LOOK[l.w].say} wheel: ${l.v > 0 ? '+' + l.v : 'nothing'}`}</p>`
    : `<p class="arcnote">${o.view ? '' : o.locked ? waitLine(turn) : ''}</p>`;
  const bankPot = kind === 'spin' ? (was ? ` +<b class="cnt" data-from="${was}" data-delay="${inPot}" data-ms="200">${pot}</b>` : ` <b class="bpot" style="--t:${inPot}ms">+${pot}</b>`) : t && t.pot && !s ? ' +' + t.pot : '';   // (a turn's first points: the "+N" comes onto the button whole, as they reach the pot)
  const bank = py ? `<div class="wbank"><button class="big bank" data-act="move" ${mv('bank')}${o.locked || o.view || !(t && t.pot && t.by === turn) || (s && kind !== 'spin') ? ' disabled' : ''}>Bank${bankPot}</button></div>` : '';
  return `<div class="g-arc g-wheels pc-${mover === 'O' ? 'O' : 'X'}${enough && !s ? ' enough' : ''}"><div class="ctals">${tal('X')}${tal('O')}</div><div class="wheels">${py ? `<div class="wpotrow" aria-live="polite">${potHtml}${fly}</div>` : ''}<div class="rwrow n${ws.length}">${wheels}</div>${res}${bank}</div></div>`;
}
// The miniature: the square's wheels small (two, or an old square's three) (each segment as on the table: shaded by its points, a skull's segment
// near black, the 10 gold; no skulls drawn and no numbers on them at this size), each player's score under them: their mark,
// a bar to the target and the points.
function wheelMini(vals, w) {
  const R = 46, n = vals.length;
  const pt = (f, r) => { const t = (f * 360 - 90) * Math.PI / 180; return [(50 + r * Math.cos(t)).toFixed(1), (50 + r * Math.sin(t)).toFixed(1)]; };
  const seg = (k, v) => { const [x0, y0] = pt(k / n, R), [x1, y1] = pt((k + 1) / n, R); return `<path d="M50 50L${x0} ${y0}A${R} ${R} 0 0 1 ${x1} ${y1}Z"${isSkull(v) ? ' class="wseg sk"' : v === 10 ? ' class="wseg ten"' : ` fill="${wheelShade(w, v)}" class="wseg"`}/>`; };
  return `<svg viewBox="-3 -9 106 112" aria-hidden="true">${vals.map((v, k) => seg(k, v)).join('')}<circle cx="50" cy="50" r="${R}" class="wrim"/><circle cx="50" cy="50" r="7" class="whub"/><path class="wptr" d="M42 -8h16l-8 13z"/></svg>`;
}
export function miniature(mini, final) {
  const wh = mini.wheels || {}, bars = ['X', 'O'].map(p => `<div class="tr ${p}"><b class="${p}">${p}</b><i style="--w:${(100 * Math.min(1, mini.pts[p] / mini.target)).toFixed(1)}%"></i><span>${mini.pts[p]}</span></div>`).join('');   // both players' points, and to the target
  return `<div class="twh n${wheelsOf(mini).length}" aria-label="X has ${mini.pts.X}, O has ${mini.pts.O} of ${mini.target}"><div class="twrow">${wheelsOf(mini).map(w => wheelMini(wh[w], w)).join('')}</div><div class="trun">${bars}</div></div>`;
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
export function sounds(f, add, won, mini, last) {   // the wheel turns, its pointer ticking over the pegs, slower and slower (each tick as a peg passes: wheelTicks), the last ones lower; it stops: the points (into the pot), or a skull; a bank: the pot over
  if (f.wheel && f.wheel.kind === 'bank') { add('bank', WHEELT.bank); return; }
  add('rlSpin', 0);
  if (!f.wheel) return;
  const ticks = wheelTicks(f.wheel, 10), n = ticks.length;
  ticks.forEach((ms, k) => add('wheelTick', ms, n - k <= 3 ? 1 - 0.07 * (4 - (n - k)) : undefined));
  if (f.wheel.kind === 'bust') { add('thud', WHEELT.spin); add('bust', WHEELT.spin + 60); return; }
  add(f.wheel.v > 0 ? 'ding' : 'thud', WHEELT.spin); if (f.wheel.w === 'high' && f.wheel.v > 0) add('sparkle', WHEELT.spin + 120);
  if (f.wheel.v > 0 && f.wheel.py) add('marker', WHEELT.spin + WHEELT.fly);   // (the points into the pot: a soft click, not a result of its own)
}
