// Snapshot: the rules (pure: no page, no clock; the server runs the same code).
import { cfgKit } from '../../core/config.js';
import { shuffle } from '../../core/random.js';
import { SNAP_DEFAULTS } from './meta.js';
export { attentionCreate as create } from '../shared/attention.js';
export { attentionApply as apply } from '../shared/attention.js';
export { attentionMoveFlash as moveFlash } from '../shared/attention.js';
export { attentionFlashMs as flashMs } from '../shared/attention.js';
export { attentionHide as hide, attentionSecret as secret } from '../shared/attention.js';   // online: a round is the server's until its Start (security review F3)

export const SNAP_LIMITS = { c1: [3, 7, 1], r1: [3, 7, 1], k1: [2, 30, 1], c2: [3, 7, 1], r2: [3, 7, 1], k2: [2, 30, 1], c3: [3, 7, 1], r3: [3, 7, 1], k3: [2, 30, 1], show: [1000, 15000, 100], wait: [0, 15000, 100] };
export const SNAP_KIT = cfgKit(SNAP_DEFAULTS, SNAP_LIMITS, out => { for (const L of [1, 2, 3]) out['k' + L] = Math.min(out['k' + L], out['c' + L] * out['r' + L] - 2); return out; });
export const setSnapConfig = SNAP_KIT.set, snapConfig = SNAP_KIT.get;
export function snapTrivial(cells, c, r) {
  const on = new Set(cells), at = (x, y) => on.has(y * c + x);
  for (let y = 0; y < r; y++) if (Array.from({ length: c }, (_, x) => at(x, y)).every(Boolean)) return 'row';
  for (let x = 0; x < c; x++) if (Array.from({ length: r }, (_, y) => at(x, y)).every(Boolean)) return 'column';
  const xs = cells.map(i => i % c), ys = cells.map(i => Math.floor(i / c));
  if ((Math.max(...xs) - Math.min(...xs) + 1) * (Math.max(...ys) - Math.min(...ys) + 1) === cells.length) return 'block';
  for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) for (let y = 0; y < r; y++) for (let x = 0; x < c; x++) { let k = 0; while (k < 4 && x + dx * k >= 0 && x + dx * k < c && y + dy * k >= 0 && y + dy * k < r && at(x + dx * k, y + dy * k)) k++; if (k >= 4) return 'line'; }
  const sym = f => cells.every(i => { const [x, y] = f(i % c, Math.floor(i / c)); return at(x, y); });
  if (sym((x, y) => [c - 1 - x, y]) || sym((x, y) => [x, r - 1 - y]) || sym((x, y) => [c - 1 - x, r - 1 - y])) return 'symmetric';
  return null;
}
export function snapRound(level, rng, cfg) {
  cfg = cfg || snapConfig();
  const L = Math.min(level, 2) + 1, c = cfg['c' + L], r = cfg['r' + L], k = cfg['k' + L];
  for (let tries = 0; tries < 500; tries++) {
    const cells = shuffle(Array.from({ length: c * r }, (_, i) => i), rng).slice(0, k).sort((a, b) => a - b);
    if (!snapTrivial(cells, c, r)) return { level: L - 1, c, r, cells, show: cfg.show, wait: cfg.wait };
  }
  return { level: L - 1, c, r, cells: shuffle(Array.from({ length: c * r }, (_, i) => i), rng).slice(0, k).sort((a, b) => a - b), show: cfg.show, wait: cfg.wait };   // (settings that leave no other choice)
}
export function publicView(mini) {
  return { type: mini.type, right: { X: mini.right.X, O: mini.right.O }, round: JSON.parse(JSON.stringify(mini.round)) };
}
export function randomMove(mini, p, rng, from, empties) {
  return 'auto';   // counts as wrong
}
