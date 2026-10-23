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
  { id: 'rel1', set: { craps: true, wheels: true, flap: false, chopper: false } },   // Craps and Risk Wheels released; Flap and Chopper admin only
];
// Game settings set by a request (config/tune/{type}/{key}, the admin's Mini-game Settings): each set once, like the releases.
const TUNE_SETS = [
  { id: 'tune1', type: 'bowling', set: { target: 35 } },   // Bowling's pins to win: 35 (the game reads it: bowlTarget)
];
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
  await admin.app().delete();
})().catch(e => { console.log('::error::' + e.message); process.exit(1); });
