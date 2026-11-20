// The flick games' shared arithmetic (Marble Toss, Shuffleboard, Bin Shot; pure): a swipe's angle and the finger's
// speed become a move { a, p }: `a` the launch angle in radians (0 straight up the table, positive to the right, never
// past FLICK.max), `p` the power, 0 to 1, from the speed (CSS px a ms over the swipe's last 80 ms: `flickMin` is power
// 0, `flickMax` power 1). The same settings in each game's TUNE (FLICK_TUNE).
export const FLICK = { max: 0.75, minLen: 14, wide: 1.8 };
const r3 = v => Math.round(v * 1000) / 1000 + 0;
export function flickMove(ang, v, t) {
  const lo = t && t.flickMin != null ? t.flickMin : 0.3, hi = t && t.flickMax != null ? t.flickMax : 1.6;
  return { a: r3(Math.max(-FLICK.max, Math.min(FLICK.max, ang))), p: r3(Math.max(0, Math.min(1, (v - lo) / Math.max(0.05, hi - lo)))) };
}
export const flickOk = m => !!m && typeof m === 'object' && typeof m.a === 'number' && typeof m.p === 'number' && Number.isFinite(m.a) && Number.isFinite(m.p) && Math.abs(m.a) <= FLICK.max + 1e-6 && m.p >= 0 && m.p <= 1;
export const FLICK_TUNE = [
  { k: 'flickMin', label: 'Flick: finger speed for the softest throw (px/ms)', def: 0.3, min: 0.1, max: 1.5, step: 0.05, group: 'Timing' },
  { k: 'flickMax', label: 'Flick: finger speed for the hardest throw (px/ms)', def: 1.6, min: 0.6, max: 4, step: 0.05, group: 'Timing' },
];
