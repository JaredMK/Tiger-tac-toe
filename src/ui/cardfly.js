// Card motion (November 2026): every card or tile a move moves travels on screen from where it was to where it goes.
// A view draws each card where it ends up and marks it with where it came from (`cfFrom`: an anchor's name, the moment
// into the move it leaves, ms) and names the places a card can come from (`cfAnchor`: 'deck', 'pile', 'card:QS', ...).
// After each render, `cardFly` measures the two and plays the card's flight on the card itself (Web Animations,
// transform and opacity only): it waits at its source (hidden there, or shown with `wait`: a card still in the hand),
// leaves at its moment and lands in place; `go` fades it out on landing (a card gathered into the deck, a card
// thrown). The flight belongs to the move's event like every other animation of the move (its nearest [data-fx]
// host; ui/fx.js anchorFx sets its time and rate: Normal, Speed, a replay's speed, a redraw mid-flight), so it plays
// once, from the move, the same live and in replays; a card whose source can't be found falls back to the card's own
// CSS (pcard's slide), and with reduced motion nothing flies (the card is simply there). A source gone from the
// screen (a card thrown from the hand) is found where it was last drawn (each anchor's place is kept from the redraw
// before, on this screen). Nothing is added to the page: the card is the view's own, face or back as the view drew
// it, so a face this phone mustn't see is never in the page.
import { app, REDUCED, state } from './app.js';
import { zoomBusy } from './fx.js';

export const CF = { fly: 280, fade: 140, ease: 'cubic-bezier(.4,0,.2,1)', minScale: 0.3, maxScale: 3 };
const num = v => Math.round(Number(v) || 0);
// The markup: the card's source and moment (with `wait`, shown at its source until it leaves; `go`, gone as it lands;
// `d`, its own flight time).
export function cfFrom(from, at = 0, o = {}) {
  if (!from) return '';
  return ` data-cf="${String(from).replace(/"/g, '')}" data-cfat="${Math.max(0, num(at))}"${o.wait ? ' data-cfwait=""' : ''}${o.go ? ' data-cfgo=""' : ''}${o.d ? ` data-cfd="${num(o.d)}"` : ''}`;
}
export const cfAnchor = name => ` data-anchor="${String(name).replace(/"/g, '')}"`;
// A flight's offset (pure): the source's middle against the destination's, in the destination's own units (k: the
// screen's scale over it, mid-zoom), and the size it starts at.
export function cfPlan(src, dst, k = 1) {
  if (!src || !dst || !(dst.width > 0) || !(dst.height > 0)) return null;
  const sc = k > 0 ? k : 1, cx = r => r.left + r.width / 2, cy = r => r.top + r.height / 2;
  const s = Math.min(CF.maxScale, Math.max(CF.minScale, src.width > 0 && src.height > 0 ? Math.sqrt((src.width * src.height) / (dst.width * dst.height)) : 1));   // (by area: a tile from the hand, lengthwise, to a crosswise place on the table)
  return { dx: (cx(src) - cx(dst)) / sc, dy: (cy(src) - cy(dst)) / sc, s };
}
// The flight's keyframes and timing (pure): from the source (hidden, or waiting there) until `at`, then into place by
// `at + d`; with `go`, faded out after landing (and kept so).
export function cfFrames(plan, at, d = CF.fly, o = {}) {
  if (!plan) return null;
  const T0 = `translate(${plan.dx.toFixed(1)}px, ${plan.dy.toFixed(1)}px) scale(${plan.s.toFixed(3)})`;
  const fade = o.go ? CF.fade : 0, total = Math.max(1, at + d + fade), p = at / total, q = (at + d) / total;
  const frames = [];
  if (p > 0) {
    frames.push({ offset: 0, transform: T0, opacity: o.wait ? 1 : 0 });
    if (!o.wait) frames.push({ offset: Math.max(0, p - 1e-4), transform: T0, opacity: 0 });
  }
  frames.push({ offset: p, transform: T0, opacity: 1, easing: CF.ease });
  frames.push({ offset: q, transform: 'none', opacity: 1 });
  if (o.go) frames.push({ offset: 1, transform: 'none', opacity: 0 });
  return { frames, timing: { duration: total, fill: o.go ? 'forwards' : 'none' } };
}
// ----- on the page -----
const seen = new Map();      // anchor -> its last place on this screen (viewport rect), from a redraw with no zoom running
const plans = new Map();     // a flight already measured -> its plan (a redraw mid-flight keeps it, the source perhaps gone)
let screenKey = null;
const rectOf = el => { const r = el.getBoundingClientRect(); return { left: r.left, top: r.top, width: r.width, height: r.height }; };
export function cardFly(root = app) {
  if (!root || typeof root.querySelectorAll !== 'function') return;
  const key = `${state.screen}:${state.zoom}`;
  if (key !== screenKey) { seen.clear(); plans.clear(); screenKey = key; }
  if (plans.size > 300) plans.clear();
  const zooming = zoomBusy() > 0;
  const named = new Map();
  for (const el of root.querySelectorAll('[data-anchor]')) if (!named.has(el.dataset.anchor)) named.set(el.dataset.anchor, el);
  const fly = REDUCED ? [] : [...root.querySelectorAll('[data-cf]')];
  fly.forEach((el, i) => {
    if (typeof el.animate !== 'function') return;
    const host = el.closest('[data-fx]'), at = num(el.dataset.cfat), d = el.dataset.cfd ? num(el.dataset.cfd) : CF.fly;
    const id = `${host ? host.dataset.fx : ''}|${el.dataset.cf}|${at}|${i}`;
    let plan = plans.get(id);
    if (!plan) {
      const s = named.get(el.dataset.cf);
      let src = s && s !== el && !s.contains(el) && !el.contains(s) ? rectOf(s) : null;
      if (!src && !zooming) src = seen.get(el.dataset.cf) || null;
      if (!src || !(src.width > 0)) return;                         // (nowhere to come from: the card's own CSS, if any)
      el.style.animation = 'none';                                  // (its CSS slide gives way to the flight: measured in place)
      const dst = rectOf(el), k = el.offsetWidth > 0 ? dst.width / el.offsetWidth : 1;
      plan = cfPlan(src, dst, k);
      if (!plan) return;
      plans.set(id, plan);
    } else el.style.animation = 'none';
    const f = cfFrames(plan, at, d, { wait: 'cfwait' in el.dataset, go: 'cfgo' in el.dataset });
    try { el.animate(f.frames, f.timing); } catch (e) { /* (an old engine: the card is simply there) */ }
  });
  if (zooming) return;
  for (const [name, el] of named) if (!el.closest('[data-cf]')) { const r = rectOf(el); if (r.width > 0) seen.set(name, r); }
}
