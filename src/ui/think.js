// The computer's move, worked out off the page's thread when it is the Hard computer: a worker
// (core/ai.worker.js) runs cpuMove on a copy of the match inside its time budget (BUDGET_MS), so the page
// never stalls; the answer comes back through cpuThink's callback. Normal and Easy decide at once, on the
// thread, as ever (the callback runs before cpuThink returns). The physics games' and Pinball's tactics need
// the physics library, which the worker has not: they are worked out here first and handed over (pre).
import { BUDGET_MS, STYLE0, cpuMove, localBest, squareValue } from '../core/ai.js';
import { aiWeights } from '../core/aiw.js';
import { publicMini } from '../core/minis.js';
import { tuneAll } from '../core/tune.js';
import { other } from '../core/util.js';
import { fingPlay } from '../games/shared/finger.js';
import { PHYS_TYPES } from '../games/shared/physics.js';
import { RNG, state } from './app.js';

const WAIT_MS = 2500;                                        // a worker that never answers (a crash, a blocked thread): the thread decides instead
let worker = null, seq = 0, waiting = null, broken = false, answered = 0;
export const thinkInfo = () => ({ worker: !!worker, broken, answered });   // (the browser tests)
function get() {
  if (worker || broken) return worker;
  try {
    worker = new Worker(new URL('./ai.worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = e => answer(e.data);
    worker.onerror = () => { broken = true; try { worker.terminate(); } catch (err) { /* (gone) */ } worker = null; if (waiting) settle(waiting, null); };
  } catch (e) { broken = true; worker = null; }
  return worker;
}
function answer(m) {
  if (!waiting || !m || m.id !== waiting.id) return;
  if (m.plan) answered++;
  settle(waiting, m.error ? null : m.plan);
}
function settle(w, plan) {
  clearTimeout(w.timer); waiting = null;
  if (plan && plan.move && plan.move.fing) fingPlay(w.state, plan, w.state.turn, RNG);   // a finger game's attempt: made here, with the physics
  w.cb(plan || cpuMove(w.state, RNG, null, { budget: 60, clock: () => performance.now() }));   // (no answer: a quick decision on the thread)
}
// The computer's move for the match as it stands: cb(plan) (plan null when it has no move).
export function cpuThink(st, cb) {
  if (st.cpuLevel !== 'hard' || !get()) { cb(cpuMove(st, RNG, null, { clock: () => performance.now() })); return; }
  if (waiting) settle(waiting, null);                           // (a second question before the first answer: the first is decided now)
  const me = st.turn, pre = {}, s0 = STYLE0;
  const owned = p => st.squares.filter(s => s.owner === p).length, behind = owned(other(me)) - owned(me);
  st.squares.forEach((sq, i) => { if (!sq.owner && (PHYS_TYPES.includes(sq.mini.type) || sq.mini.type === 'pinball')) pre[i] = localBest(publicMini(sq.mini), me, RNG, s0, { value: squareValue(st.squares, i, me, s0), behind, level: 'hard', until: null }); });
  const id = ++seq;
  waiting = { id, cb, state: st, timer: setTimeout(() => { if (waiting && waiting.id === id) settle(waiting, null); }, WAIT_MS) };
  try {
    worker.postMessage({ id, state: st, seed: String(RNG()), level: 'hard', budget: BUDGET_MS, pre, ai: aiWeights(), tune: tuneAll() });
  } catch (e) { settle(waiting, null); }
}
