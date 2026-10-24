// Release control: which games a player may be dealt (released, or admin only until released).
import { TEST_TYPES, TYPES } from '../games/index.js';

export function isReleased(t, releases) { return releases && typeof releases[t] === 'boolean' ? releases[t] : !TEST_TYPES.includes(t); }
export function releasedTypes(releases) { return TYPES.filter(t => isReleased(t, releases)); }
// The games a setup may deal (admin: every game; anyone else: the released ones), and the setup's
// games list cut down to them (in place), so a match never draws a game its players may not see.
export function allowedTypes(releases, admin) { return admin ? TYPES.slice() : releasedTypes(releases); }
// Find Match deals only games whose result the server can verify (security review F3). A game is held
// back here while its result still rests on what the phone says: it stays in local play and friend rooms
// (where the players know each other) until its family is hardened (a run re-simulated from its inputs,
// an attempt played through again, a round dealt and timed by the server) and tested; then it comes off.
export const FIND_MATCH_HOLD = ['dash', 'lane', 'flap', 'chopper', 'skyhop', 'scoop', 'pinball', 'bullseye', 'headcount', 'flash', 'snapshot'];
export const findMatchTypes = types => types.filter(t => !FIND_MATCH_HOLD.includes(t));
export function restrictGames(games, allowed) {
  if (!games || typeof games !== 'object') return games;
  for (const t of Object.keys(games)) if (games[t] && !allowed.includes(t)) games[t] = false;
  return games;
}
