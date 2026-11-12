// A wheel's spin with weight, shared by the wheel games' views (Risky Spins, Little Wheel): the same curve the
// stylesheet plays (styles.css @keyframes wspinw, rlwheel, rlball: the figures below are theirs, held together by
// tests/ui/wheel-spin.test.mjs), worked out here so a view can time what the turning wheel does: its pointer
// ticking over the pegs and the tick sounds, each at the moment a peg passes, slower and slower with the wheel.
// Pure: no page, no clock.

// A CSS cubic-bezier(x1, y1, x2, y2) as a function of the time's fraction (0 to 1).
export function bez(x1, y1, x2, y2) {
  const f = (a, b, s) => 3 * a * s * (1 - s) * (1 - s) + 3 * b * s * s * (1 - s) + s * s * s;
  return x => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0, hi = 1;
    for (let k = 0; k < 40; k++) { const s = (lo + hi) / 2; if (f(x1, x2, s) < x) lo = s; else hi = s; }
    return f(y1, y2, (lo + hi) / 2);
  };
}
// The spin of a pointer wheel: a quick wind-up the other way (`back` degrees, the first `wind` of its time), the
// long run that slows to a crawl `over` degrees past its stop (at `stop` of its time), and the settle back onto it.
export const SPIN = { wind: 0.07, back: 12, stop: 0.88, over: 3, e0: [0.45, 0, 0.55, 1], e1: [0.14, 0.55, 0.2, 1], e2: [0.4, 0, 0.6, 1] };
const E0 = bez(...SPIN.e0), E1 = bez(...SPIN.e1), E2 = bez(...SPIN.e2);
// The wheel's angle (degrees) at fraction u of its spin from `from` to `end`.
export function spinAt(from, end, u) {
  const a = from - SPIN.back, b = end + SPIN.over;
  if (u <= 0) return from;
  if (u >= 1) return end;
  if (u < SPIN.wind) return from + (a - from) * E0(u / SPIN.wind);
  if (u < SPIN.stop) return a + (b - a) * E1((u - SPIN.wind) / (SPIN.stop - SPIN.wind));
  return b + (end - b) * E2((u - SPIN.stop) / (1 - SPIN.stop));
}
// The moments (ms into a move) something that turns passes a mark: `angle(u)` the angle at fraction u of `ms`,
// a mark every `step` degrees; between u0 and u1 only; never two within `gap` ms (a fast wheel rattles, it does
// not buzz), so they thin out to single ticks as it slows.
export function passTimes(angle, step, ms, o = {}) {
  const u0 = o.u0 || 0, u1 = o.u1 == null ? 1 : o.u1, gap = o.gap == null ? 50 : o.gap, n = Math.max(200, Math.round(ms / 2)), out = [];
  let was = Math.floor(angle(u0) / step), last = -Infinity;
  for (let k = 1; k <= n; k++) {
    const u = u0 + (u1 - u0) * k / n, now = Math.floor(angle(u) / step);
    if (now === was) continue;
    was = now;
    const t = Math.round(u * ms);
    if (t - last >= gap) { out.push(t); last = t; }
  }
  return out;
}
// A pointer wheel's ticks: its pegs (every `step` degrees) passing the pointer during the long run.
export const spinTicks = (from, end, step, ms, gap) => passTimes(u => spinAt(from, end, u), step, ms, { u0: SPIN.wind, u1: SPIN.stop, gap });
