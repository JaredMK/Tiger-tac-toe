// The computer's thinking off the page's thread (ui/think.js posts here): the Hard computer's searches and
// playouts, inside their time budget, on a copy of the match. A module worker: the same engine as the page,
// its own instance (the weights and settings come with every request). Nothing hidden is used: cpuMove reads
// each square's public view, as on the page.
import { cpuMove } from '../core/ai.js';
import { setAiWeights } from '../core/aiw.js';
import { makeRng } from '../core/random.js';
import { setTunes } from '../core/tune.js';

const scope = typeof self !== 'undefined' ? self : null;   // (the module check in the tests loads this in Node: no worker there)
if (scope) scope.onmessage = e => {
  const d = e.data || {};
  try {
    setAiWeights(d.ai || null);
    setTunes(d.tune || null);
    const plan = cpuMove(d.state, makeRng(d.seed), d.style || null, { level: d.level, clock: () => performance.now(), budget: d.budget, pre: d.pre || {}, noFing: true });
    scope.postMessage({ id: d.id, plan });
  } catch (err) {
    scope.postMessage({ id: d.id, error: String((err && err.message) || err) });
  }
};
