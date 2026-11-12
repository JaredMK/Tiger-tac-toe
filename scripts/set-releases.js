'use strict';
// Release switches set by a request rather than on the dashboard (releases/{type}): each set below is applied
// once (its mark in meta/releases), after the deploy, so the dashboard's later taps are never undone. The
// deploy workflow runs it; it prints only what it set.
//
//   node scripts/set-releases.js        (GOOGLE_APPLICATION_CREDENTIALS: a service-account key)
const path = require('node:path');
const admin = require(path.join(__dirname, '..', 'functions', 'node_modules', 'firebase-admin'));

const PROJECT = process.env.TTC_PROJECT || 'tic-tac-chaos';
const SETS = [
  { id: 'rel1', set: { craps: true, wheels: true, flap: false, chopper: false } },   // Craps and Risky Spins released; Flap and Chopper admin only
  { id: 'rel2', set: { superchaos: false } },   // Super Chaos off (Classic only; core/config.js SUPER_CHAOS_ENABLED keeps it off for the admin too)
  { id: 'rel3', set: { shelves: false, hex: false } },   // Shelves admin only (a tie is a draw now, and its first mover wins nearly every other square); Hex admin only (5x5 with the swap rule, the first mover still over 60%)
];
// Game settings set by a request (config/tune/{type}/{key}, the admin's Mini-game Settings): each set once, like the releases.
const TUNE_SETS = [
  { id: 'tune1', type: 'bowling', set: { target: 35 } },   // Bowling's pins to win: 35 (the game reads it: bowlTarget)
  { id: 't31v2', type: 't31', set: { target: 30 } },       // Thirty-One's rework (one deck of 32, three suits dealt): 30 to win; a target saved for the old 52-card game (26) would end a square in two turns
];
// Database values set by a request, each once (its mark in meta/config): the value, or a function giving it at that moment.
const CONFIG_SETS = [
  { id: 'verify1', path: 'config/verify/since', value: () => Date.now() },   // email verification's cutoff: accounts made before this deploy are grandfathered (production: the release that brings verification in)
  { id: 'wheels2', path: 'config/wheels', value: { target: 30, lowSkulls: 2, midSkulls: 4, highSkulls: 5, lowLo: 1, lowHi: 4, midLo: 4, midHi: 7, highLo: 6, tensMin: 1, tensMax: 1, gap: 0.4, evSpread: 10 } },   // Risky Spins balanced (November 2026): the whole of config/wheels set to the new defaults (meta.js WHEEL_DEFAULTS), the three wheels' turns within 10%; squares dealt before keep their wheels
  { id: 'wheels3', path: 'config/wheels', value: { target: 30, lowSkulls: 2, highSkulls: 5, lowLo: 1, lowHi: 4, highLo: 6, tensMin: 1, tensMax: 1, gap: 0.4, evSpread: 10 } },   // Risky Spins deals two wheels, low and high (November 2026): the whole of config/wheels set to the defaults (meta.js WHEEL_DEFAULTS: the same numbers as wheels2, without the medium wheel's midSkulls, midLo and midHi); squares dealt with three wheels play on with them
  { id: 'stagingOpen1', path: 'config/staging/mode', value: 'open', env: 'staging' },   // staging open to anyone with the link (the admin's Staging access switch; Allowlist puts the gate back)
];
const ENV = process.env.TARGET || (PROJECT === 'tic-tac-chaos' ? 'production' : 'staging');   // (a set with env: that environment alone)
(async () => {
  admin.initializeApp({ projectId: PROJECT, databaseURL: `https://${PROJECT}-default-rtdb.firebaseio.com` });
  const db = admin.database();
  for (const { id, set } of SETS) {
    const mark = `meta/releases/${id}`;
    if ((await db.ref(mark).get()).val()) { console.log(`Release set ${id}: applied already.`); continue; }
    await db.ref().update(Object.assign(Object.fromEntries(Object.entries(set).map(([t, on]) => [`releases/${t}`, on])), { [mark]: { at: Date.now() } }));
    console.log(`Release set ${id}: ${Object.entries(set).map(([t, on]) => `${t} ${on ? 'released' : 'admin only'}`).join(', ')}.`);
  }
  for (const { id, type, set } of TUNE_SETS) {
    const mark = `meta/tune/${id}`;
    if ((await db.ref(mark).get()).val()) { console.log(`Settings set ${id}: applied already.`); continue; }
    await db.ref().update(Object.assign(Object.fromEntries(Object.entries(set).map(([k, v]) => [`config/tune/${type}/${k}`, v])), { [mark]: { at: Date.now() } }));
    console.log(`Settings set ${id}: ${type} ${Object.entries(set).map(([k, v]) => `${k} ${v}`).join(', ')}.`);
  }
  for (const { id, path: at, value, env } of CONFIG_SETS) {
    if (env && env !== ENV) continue;
    const mark = `meta/config/${id}`;
    if ((await db.ref(mark).get()).val()) { console.log(`Config set ${id}: applied already.`); continue; }
    const v = typeof value === 'function' ? value() : value;
    await db.ref().update({ [at]: v, [mark]: { at: Date.now() } });
    console.log(`Config set ${id}: ${at} = ${JSON.stringify(v)}.`);
  }
  await admin.app().delete();
})().catch(e => { console.log('::error::' + e.message); process.exit(1); });
