// Release control: which games a player may be dealt (released, or admin only until released).
import { TEST_TYPES, TYPES } from '../games/index.js';

export function isReleased(t, releases) { return releases && typeof releases[t] === 'boolean' ? releases[t] : !TEST_TYPES.includes(t); }
export function releasedTypes(releases) { return TYPES.filter(t => isReleased(t, releases)); }
// The games a setup may deal (admin: every game; anyone else: the released ones), and the setup's
// games list cut down to them (in place), so a match never draws a game its players may not see.
export function allowedTypes(releases, admin) { return admin ? TYPES.slice() : releasedTypes(releases); }
export function restrictGames(games, allowed) {
  if (!games || typeof games !== 'object') return games;
  for (const t of Object.keys(games)) if (games[t] && !allowed.includes(t)) games[t] = false;
  return games;
}
