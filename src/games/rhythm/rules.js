// Rhythm Tap: the rules (pure: no page, no clock; the server runs the same code).
// Each player their own score. A move is one round of `secs` seconds played on the mover's phone: a beat at `tempo`,
// and notes coming down three lanes to reach the line on the beat (some between two beats). A tap in a note's lane as
// it reaches the line plays it: within 40% of the timing window a Perfect (2 points), within the window a Good (1),
// else a miss. `lives` misses end the round there (0: never). The round's notes are the same wherever they are
// worked out (`rhythmChart`: from the square's public seed, the player and the number of their round). The move is
// each note's tap, `{ d: [ms from its beat, early negative, or null for none] }`. The round's points add to the
// score; first to the target takes the square. The taps are the phone's word (the server cannot time one), so the
// game is held out of Find Match (core/games.js FIND_MATCH_HOLD).
import { makeRng, needRng } from '../../core/random.js';
import { tune } from '../../core/tune.js';

export const RHYTHM = { lanes: 3, fall: 1150, count: 2, tail: 350, perfect: 0.4, pp: 2, gp: 1, out: 600, pre: 300, show: 420, hold: 650, scale: [0, 2, 4, 7, 9, 12, 14] };   // (fall: a note's time down its lane, ms; count: the beats counted in; scale: the notes' pitches, semitones)
// The computer's notes let go by were `aiMiss`/`aiMissHard`/`aiMissEasy` until the AI levels pass (November 2026), whose
// common mistake rates are named aiMiss<Level>: they are `aiLetGo`/`aiLetGoHard`/`aiLetGoEasy` now, and a square dealt
// before keeps the value it was dealt with under the old name (`letGo`).
const LETGO = { aiLetGo: 'aiMiss', aiLetGoHard: 'aiMissHard', aiLetGoEasy: 'aiMissEasy' };
function letGo(mini, t, k) { const raw = mini && mini.tune && typeof mini.tune === 'object' ? mini.tune : null; return raw && raw[k] == null && Number.isFinite(Number(raw[LETGO[k]])) && raw[LETGO[k]] !== null && raw[LETGO[k]] !== '' ? Math.max(0, Math.min(60, Number(raw[LETGO[k]]))) : t[k]; }
export function rhythmCfg(mini) { const t = tune(mini); return { target: t.target, secs: t.secs, beat: 60000 / t.tempo, win: t.window, lives: t.lives, dense: t.dense / 100, ai: { easy: [t.aiMsEasy, letGo(mini, t, 'aiLetGoEasy')], normal: [t.aiMs, letGo(mini, t, 'aiLetGo')], hard: [t.aiMsHard, letGo(mini, t, 'aiLetGoHard')] } }; }
export function create(type, rng) { return { type, seed: Math.floor(needRng(rng)() * 1e9), score: { X: 0, O: 0 }, n: { X: 0, O: 0 }, last: null }; }
// A round's notes in order: { t (ms from the round's start: when it reaches the line), lane, tone (its place in the scale) }.
export function rhythmChart(mini, p) {
  const c = rhythmCfg(mini), r = makeRng(`rhythm:${mini.seed}:${p}:${mini.n[p]}`), T = c.secs * 1000, notes = [];
  let last = -1, run = 0, tone = 2;
  const add = t => { let lane = Math.floor(r() * RHYTHM.lanes); if (lane === last && run >= 2) lane = (lane + 1 + Math.floor(r() * 2)) % RHYTHM.lanes; run = lane === last ? run + 1 : 1; last = lane; tone = Math.max(0, Math.min(RHYTHM.scale.length - 1, tone + Math.floor(r() * 3) - 1)); notes.push({ t: Math.round(t), lane, tone }); };
  for (let b = RHYTHM.count; b * c.beat <= T - RHYTHM.tail; b++) {
    if (b === RHYTHM.count || r() < 0.88) add(b * c.beat);
    if (r() < c.dense && (b + 0.5) * c.beat <= T - RHYTHM.tail) add((b + 0.5) * c.beat);
  }
  return notes;
}
export const rhythmJudge = (c, dt) => (dt == null || Math.abs(dt) > c.win ? 'miss' : Math.abs(dt) <= c.win * RHYTHM.perfect ? 'perfect' : 'good');
// What a round's taps are worth: each note judged in turn, the round over at the miss that takes the last life.
export function rhythmScore(c, notes, d) {
  const s = { perf: 0, good: 0, miss: 0, out: false, pts: 0, res: [] };
  for (let i = 0; i < notes.length; i++) {
    const j = rhythmJudge(c, d[i]); s.res.push(j);
    if (j === 'perfect') { s.perf++; s.pts += RHYTHM.pp; } else if (j === 'good') { s.good++; s.pts += RHYTHM.gp; } else if (++s.miss >= c.lives && c.lives > 0) { s.out = true; break; }
  }
  return s;
}
export function apply(mini, p, m, rng, idx) {
  const c = rhythmCfg(mini), notes = rhythmChart(mini, p);
  if (!m || typeof m !== 'object' || !Array.isArray(m.d) || m.d.length !== notes.length || m.d.some(v => v !== null && !(typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 2000))) return { ok: false, reason: 'bad' };
  const s = rhythmScore(c, notes, m.d), from = mini.score[p];
  mini.score[p] = Math.min(c.target, from + s.pts); mini.n[p]++;
  mini.last = { by: p, perf: s.perf, good: s.good, miss: s.miss, out: s.out, of: notes.length, pts: s.pts, from, to: mini.score[p] };
  if (mini.score[p] >= c.target) return { ok: true, outcome: 'win', note: 'won' };
  return { ok: true, outcome: 'continue', note: s.out ? 'out' : 'round' };
}
export function timeoutClose(mini, p) { return null; }
export function publicView(mini) { return JSON.parse(JSON.stringify(mini)); }
export function randomMove(mini, p, rng, from, empties) { const r = needRng(rng), c = rhythmCfg(mini); return { d: rhythmChart(mini, p).map(() => (r() < 0.15 ? null : Math.round((r() - 0.5) * 2 * c.win))) }; }
export function moveFlash(m, p, range, bjFrom, mini, flash) { flash.rt = JSON.parse(JSON.stringify(mini.last)); }
export const rhythmShowMs = () => RHYTHM.pre + 3 * RHYTHM.show + 250;   // someone else's round, as its result is laid out
export function flashMs(f, winLen, won) { return f.rt ? rhythmShowMs() + RHYTHM.hold + (won ? 500 : 0) : 0; }
