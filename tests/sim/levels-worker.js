'use strict';
// One slice of a pairing for tests/sim/levels.js's command line (a worker thread).
const { parentPort, workerData } = require('worker_threads');
const { chunk } = require('./levels.js');
const { job, tune, budget } = workerData;
try { parentPort.postMessage({ r: chunk(job.t, job.hi, job.lo, job.from, job.to, tune, { budget }) }); }
catch (e) { parentPort.postMessage({ err: String(e && e.stack || e).split('\n').slice(0, 3).join(' | ') }); }
