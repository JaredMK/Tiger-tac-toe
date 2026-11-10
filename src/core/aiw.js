// The computer's difficulty levels and its settings (config/ai: the admin's Bot Settings, and what `npm run tune-ai`
// tunes by self-play; the page reads it at start, the server every 20 s). One engine plays all three levels
// (docs/ai.md): a level is how hard it searches the match (its playouts: 0 weighs the squares one step ahead, no
// search), how often it plays a square with its strongest tactics (sharp; else the plain ones), how often it makes
// a careless move (mistake), and its appetite for risk in the push-your-luck games (risk).
import { cfgKit } from './config.js';

export const LEVELS = ['easy', 'normal', 'hard'];
export const LEVEL_NAME = { easy: 'Easy', normal: 'Normal', hard: 'Hard' };
export const levelOf = v => (LEVELS.includes(v) ? v : 'normal');
export const AI_DEFAULTS = {
  attack: 1,        // lines still open for itself (the square's worth on the board)
  defend: 1,        // lines still open for the other side, and how hard it blocks one about to close
  explore: 0.25,    // in a playout, how often a side plays any open square by its worth instead of the best one
  prog: 0.8,        // in a playout, the chance a move makes the progress the game's tactics reckon (else none)
  fresh: 3.5,       // in a playout, the turns each side needs in a square that has just reset
  drop: 2.5,        // the search lets go of a candidate this many standard errors behind the leader
  margin: 2,        // tempo play: a lead safe enough to leave a square for now (turns the other side needs beyond the computer's)
  budget: 300,      // ms a decision may take where there is a clock (the page's worker, the server's bots)
  hardSearch: 1200, hardSharp: 100, hardMistake: 0, hardRisk: 0,      // Hard: the full search, always its strongest tactics
  normalSearch: 300, normalSharp: 85, normalMistake: 0, normalRisk: 0,   // Normal: a lighter search, its strongest tactics most of the time (about the old Hard's strength)
  easySearch: 0, easySharp: 0, easyMistake: 30, easyRisk: 0,          // Easy
};
const LV = { Search: [0, 4000, 10], Sharp: [0, 100, 1], Mistake: [0, 80, 1], Risk: [-6, 8, 1] };
export const AI_LIMITS = Object.assign({ attack: [0.2, 3, 0.05], defend: [0.2, 3, 0.05], explore: [0, 0.8, 0.05], prog: [0.3, 1, 0.05], fresh: [1.5, 6, 0.25], drop: [0, 6, 0.25], margin: [1, 5, 0.5], budget: [50, 1000, 10] },
  ...LEVELS.flatMap(l => Object.keys(LV).map(k => ({ [l + k]: LV[k] }))));
const kit = cfgKit(AI_DEFAULTS, AI_LIMITS, out => { for (const k of Object.keys(out)) out[k] = Number(out[k].toFixed(4)); return out; });
export const AI_CFG = kit.box;
export const aiNorm = kit.norm;
export const setAiWeights = kit.set;
export const aiWeights = kit.get;
// A level's own settings, from the config: { search, sharp (0..1), mistake (0..1), risk }.
export function levelCfg(level, w) {
  const l = levelOf(level); w = w || aiWeights();
  return { search: w[l + 'Search'], sharp: w[l + 'Sharp'] / 100, mistake: w[l + 'Mistake'] / 100, risk: w[l + 'Risk'] };
}
