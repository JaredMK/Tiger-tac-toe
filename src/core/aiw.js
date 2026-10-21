// The computer's difficulty levels and the Hard computer's strategy weights (config/ai: what `npm run tune-ai`
// tunes by self-play and saves; the page reads it at start, the server every 20 s). Normal plays the code's
// own numbers (STYLE0 in ai.js) whatever is saved here: the weights shape the Hard computer only, its square
// choice (the playouts in mc.js) and its style inside the squares.
import { cfgKit } from './config.js';

export const LEVELS = ['easy', 'normal', 'hard'];
export const LEVEL_NAME = { easy: 'Easy', normal: 'Normal', hard: 'Hard' };
export const levelOf = v => (LEVELS.includes(v) ? v : 'normal');
export const AI_DEFAULTS = {
  attack: 1,        // lines still open for itself (the square's worth on the board)
  defend: 1,        // lines still open for the other side, and how hard it blocks one about to close
  rollRisk: 0,      // points added to the score it banks at in Risky Rolls (bolder above zero)
  explore: 0.25,    // in a playout, how often a side plays any open square by its worth instead of the best one
  prog: 0.8,        // in a playout, the chance a move makes the progress the game's tactics reckon (else none)
  fresh: 3.5,       // in a playout, the moves each side needs in a square that has just reset
  playouts: 300,    // playouts per candidate square (fewer when the time runs out)
};
export const AI_LIMITS = { attack: [0.2, 3, 0.05], defend: [0.2, 3, 0.05], rollRisk: [-6, 8, 1], explore: [0, 0.8, 0.05], prog: [0.3, 1, 0.05], fresh: [1.5, 6, 0.25], playouts: [50, 1000, 10] };
const kit = cfgKit(AI_DEFAULTS, AI_LIMITS, out => { for (const k of Object.keys(out)) out[k] = Number(out[k].toFixed(4)); return out; });
export const AI_CFG = kit.box;
export const aiNorm = kit.norm;
export const setAiWeights = kit.set;
export const aiWeights = kit.get;
