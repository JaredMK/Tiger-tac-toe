// Seeded randomness: every random choice comes from an rng passed in (makeRng(seed) for a seeded one).
import { TYPES } from '../games/index.js';

// ---------- randomness: every random choice comes from an rng passed in, never from Math.random ----------
// A small seeded generator (sfc32): the same seed gives the same sequence on every device and on the server.
export function makeRng(seed) {
  let h = 1779033703 ^ String(seed).length, a, b, c, d;
  for (const ch of String(seed)) { h = Math.imul(h ^ ch.charCodeAt(0), 3432918353); h = (h << 13) | (h >>> 19); }
  const next = () => { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return (h ^= h >>> 16) >>> 0; };
  a = next(); b = next(); c = next(); d = next();
  return () => {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9); b = (c + (c << 3)) | 0; c = (c << 21) | (c >>> 11); d = (d + 1) | 0; t = (t + d) | 0; c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}
export function needRng(rng) {
  if (typeof rng !== 'function') throw new Error('the engine needs an rng: pass makeRng(seed)');
  return rng;
}
export function randInt(rng, n) { return Math.floor(rng() * n); }
export function randomType(rng) { return TYPES[randInt(rng, TYPES.length)]; }
export function shuffle(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) { const j = randInt(rng, i + 1); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
  return arr;
}
// The computer: no run in real time; its crash distance is drawn to finish in about RUN.aiRuns runs
// (log-normal around a mean that shrinks a little as the course speeds up), then put at the obstacle
// there, like any crash.
export const gaussOf = rng => { const u = Math.max(1e-9, rng()), v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
