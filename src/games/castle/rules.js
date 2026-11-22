// Castle Smash: the rules (pure: no page, no clock; the server runs the same code).
// Each player has a castle, a pile of stone and timber blocks around a core (a crystal on a stone perch), and a
// catapult standing before it. The two castles of a square are dealt as one and the same (sim.js castleDeal: a plan and
// its details from the rng, `layers` high), each kept as its attacker sees it: `c[p]` is the castle p DEFENDS, a list
// of blocks [kind, x, h, angle] (tenths of a unit, thousandths of a radian). A move is one shot, `{ aim, power }`: the
// elevation (radians) and the power (0..1) of the throw (castleMove). The shot is played out by the rules themselves
// (sim.js castleShot on Matter.js: the server's online, this phone's in local play) against the OTHER player's castle
// as it lies, and that castle is saved as it came to rest: blocks knocked about stay where they fell, timber struck
// hard enough is broken and gone (`woodTough`), a block knocked out of the castle's yard is gone. The core ends when
// the boulder touches it, when a block strikes it hard enough (`coreTough`), or when it drops off its perch: the first
// to end the other's core takes the square. A castle only ever gets weaker, so a player shooting alone always gets
// there. "Go again on success" (off by default): a shot that breaks a timber or knocks a block clean out of the yard
// shoots again. Nothing is hidden and nothing is by chance: the same shot at the same castle is the same shot.
// The move's recording (the boulder's and the blocks' motion, sim.js) never rides the square: `last` keeps the shot and
// what came of it, and the flash carries the recording (`phys.rec`: core/records.js keeps only the latest move's).
import { goAgain, tune, tuneLive } from '../../core/tune.js';
import { needRng } from '../../core/random.js';
import { other } from '../../core/util.js';
import { CS, castleAimAt, castleCore, castleDeal, castleLib, castleMove, castleShot } from './sim.js';
export { CS, KINDS, K, castleMove, castleArc, castleAimAt, castleSpeed, castleShot, castleDeal, castleCore, castleShield, castleBox, castleLib, pack, unpack } from './sim.js';

// The move's moments on the screen (ms; view.js): someone else's catapult is drawn back first (`pull`), the arm
// swings (`swing`) and the boulder leaves; the recording plays; the result is held (`hold`), a win a little longer.
export const CST = { pull: 520, swing: 140, hold: 450, win: 700, burst: 620 };
// A square's own numbers (meta.js TUNE): the top speed (units a tick), the boulder's and the stone's density, the
// punch that breaks timber and the punch that ends the core, and the computer's hand by level.
export function castleCfg(mini) {
  const t = tune(mini);
  return {
    vMax: t.power / 60, ball: 0.006 * t.weight / 100, stone: 0.002 * t.stone / 100, woodTough: t.woodTough / 10, stoneTough: t.stoneTough / 10, stoneHits: t.stoneHits, coreTough: t.coreTough / 10,
    ai: { easy: [t.aiAimEasy / 1000, t.aiPowEasy / 100], normal: [t.aiAim / 1000, t.aiPow / 100], hard: [t.aiAimHard / 1000, t.aiPowHard / 100] }, tries: t.aiTries, t,
  };
}
export function create(type, rng) {
  const blocks = castleDeal(needRng(rng), tuneLive(type));
  return { type, v: 1, c: { X: blocks, O: blocks.map(b => b.slice()) }, n: { X: 0, O: 0 }, last: null };
}
const RECS = new WeakMap();                                       // a move's recording, kept beside its `last` until the flash takes it (never on the square)
export function apply(mini, p, m, rng, idx) {
  const shot = castleMove(m);
  if (!shot) return { ok: false, reason: 'bad' };
  const M = castleLib();
  if (!M) return { ok: false, reason: 'nophys' };
  const o = other(p), was = mini.c[o];
  if (!castleCore(was)) return { ok: false, reason: 'over' };
  const r = castleShot(M, was, shot, castleCfg(mini));
  mini.c[o] = r.blocks; mini.n[p]++;
  mini.last = { by: p, aim: shot.aim, power: shot.power, kind: r.kind, core: r.core, broke: r.broke, off: r.off, cracked: r.cracked, moved: r.moved, ms: r.ms };
  RECS.set(mini.last, { rec: r.rec, ev: r.events, was });
  if (r.core) return { ok: true, outcome: 'win', note: 'smashed' };
  const again = goAgain(mini) && r.broke + r.off > 0;
  return Object.assign({ ok: true, outcome: 'continue', note: again ? 'again' : r.kind !== 'hit' ? 'miss' : r.broke ? 'broke' : r.moved || r.cracked ? 'hit' : 'knock' }, again ? { again: true } : {});
}
export function timeoutClose(mini, p) { return null; }             // (a shot is one move: nothing is ever under way)
export function publicView(mini) { return JSON.parse(JSON.stringify(mini)); }
// A random throw somewhere at the castle (the tests' and a careless hand's).
export function randomMove(mini, p, rng, from, empties) {
  const r = needRng(rng), c = castleCfg(mini);
  for (let k = 0; k < 12; k++) { const s = castleAimAt(CS.foot[0] + r() * (CS.foot[1] - CS.foot[0]), 6 + r() * 80, 0.3 + r() * 1, c.vMax); if (s) return s; }
  return { aim: 0.8, power: 0.7 };
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  const l = mini.last, x = RECS.get(l) || {};
  flash.phys = Object.assign(JSON.parse(JSON.stringify(l)), { rec: x.rec || null, ev: x.ev || [], was: x.was ? JSON.parse(JSON.stringify(x.was)) : null, n: { X: mini.n.X, O: mini.n.O } });
}
export function flashMs(f, winLen, won) {
  const ph = f.phys;
  return CST.pull + CST.swing + (ph ? ph.ms : 1500) + CST.hold + (won ? CST.win : 0);
}
