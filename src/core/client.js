// The client: which version of the game a phone runs, and on what (the web page, the iOS app). Every server call and
// device event carries it ({ v, p }: net/connect.js call, net/tracking.js). Shared with the server: a match deals only
// the mini-games both players' clients have (a game's meta.js minVersion) and that are on for both their platforms
// (the admin's per-platform release switch, releases/platform/{p}/{type} false), and a client older than the admin's
// minimum for its platform (config/clients { web, ios }) is told to update instead of playing.
import { GAMES } from '../games/index.js';

// This code's version. The web page is always the latest (it is served from this commit); the app carries the version
// it was built with, so bump this (major.minor.patch) whenever a change needs a newer client: a new mini-game (its
// meta.js minVersion is then this), or a change to a game's moves or records an older client could not play.
export const CLIENT_VERSION = '1.2.0';
export const PLATFORMS = ['web', 'ios'];
// A client that says nothing (a page from before versions) is the web page at the first version.
export const BASE_CLIENT = Object.freeze({ v: '1.0.0', p: 'web' });

const VER = /^\d{1,4}(\.\d{1,4}){0,2}$/;
export const versionOk = v => typeof v === 'string' && VER.test(v);
// -1, 0 or 1: a before, the same as, or after b (missing parts are 0: '1.2' is '1.2.0').
export function cmpVersion(a, b) {
  const pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) { const x = pa[i] || 0, y = pb[i] || 0; if (x !== y) return x < y ? -1 : 1; }
  return 0;
}
// A client as reported, checked: an unknown platform is the web, a version that is not one is the first.
export function normClient(c) {
  const o = c && typeof c === 'object' ? c : {};
  return { v: versionOk(o.v) ? o.v : BASE_CLIENT.v, p: PLATFORMS.includes(o.p) ? o.p : BASE_CLIENT.p };
}
export const minVersionOf = t => (GAMES[t] && versionOk(GAMES[t].meta.minVersion) ? GAMES[t].meta.minVersion : BASE_CLIENT.v);
export const clientHas = (client, t) => cmpVersion(normClient(client).v, minVersionOf(t)) >= 0;
// The mini-games of a match (its squares' and its list's, which a reset deals from) this client lacks: unknown to it
// altogether, or newer than it (meta.js minVersion). Never for a match dealt for this client (makeGame deals only what both
// clients have), but a client can be older than it was (the app reinstalled older, an old page from a cache) and resume
// a match dealt for the newer one: the page then shows the stale screen instead of the match (ui/screens/stale.js).
export function lackedTypes(client, st) {
  const types = new Set();
  for (const q of (st && Array.isArray(st.squares) ? st.squares : [])) if (q && q.mini && typeof q.mini.type === 'string') types.add(q.mini.type);
  for (const t of (st && Array.isArray(st.games) ? st.games : [])) if (typeof t === 'string') types.add(t);
  return [...types].filter(t => !GAMES[t] || !clientHas(client, t));
}
// The admin's per-platform switch: a game the admin has turned off for a platform (only ever off: a game is on for a
// platform while it is released at all and its switch there is not false).
export function platformOff(t, releases, p) {
  const pl = releases && releases.platform && typeof releases.platform === 'object' ? releases.platform[p] : null;
  return !!(pl && typeof pl === 'object' && pl[t] === false);
}
// The games of `types` every one of these clients may be dealt (a bot is no client: leave it out).
export function clientTypes(types, clients, releases) {
  const cs = (clients || []).map(normClient);
  return types.filter(t => cs.every(c => clientHas(c, t) && !platformOff(t, releases, c.p)));
}
// The admin's minimum version per platform (config/clients), checked: { web, ios }, each a version or null (none).
export function normMins(raw) {
  const o = raw && typeof raw === 'object' ? raw : {}, out = {};
  for (const p of PLATFORMS) out[p] = versionOk(o[p]) ? o[p] : null;
  return out;
}
// Too old to play: below the admin's minimum for its platform.
export function needsUpdate(client, mins) {
  const c = normClient(client), m = normMins(mins)[c.p];
  return !!m && cmpVersion(c.v, m) < 0;
}
