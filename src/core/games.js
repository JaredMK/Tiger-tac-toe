// Release control: which games a player may be dealt (released, or admin only until released).
import { INFO, SC_ONLY, TEST_TYPES, TYPES } from '../games/index.js';

export function isReleased(t, releases) { return releases && typeof releases[t] === 'boolean' ? releases[t] : !TEST_TYPES.includes(t); }
export function releasedTypes(releases) { return TYPES.filter(t => isReleased(t, releases)); }
// The games a setup may deal (admin: every game; anyone else: the released ones), and the setup's
// games list cut down to them (in place), so a match never draws a game its players may not see.
export function allowedTypes(releases, admin) { return admin ? TYPES.slice() : releasedTypes(releases); }
// Find Match deals only games whose result the server can verify (security review F3). A game is held
// back here while its result still rests on what the phone says: it stays in local play and friend rooms
// (where the players know each other) until its family is hardened (a run re-simulated from its inputs,
// an attempt played through again, a round dealt and timed by the server) and tested; then it comes off.
// Hardened and back in Find Match: the runners (a run is its input log, played through again, no longer than the
// round: runner.js runCheck, core/verify.js), Sky Hop and Scoop Stack (an attempt is its inputs, after Start, no
// longer than the time since: finger.js fingCheck), Pinball (its inputs re-simulated on the server, which keeps its own
// ball: pinball/rules.js pinReplayCheck), the attention games (the round is the server's until Start, the answer timed:
// attention.js attentionHide, verify.js). Bullseye was held while a throw was where two sweeping lines were stopped
// (the server cannot time a tap to better than a connection's slack); it is allowed again, the cheating risk accepted
// (a phone can claim a better stop than it made: bullseye/rules.js). Held now: Shell Game (December 2026): its
// round goes to the phone at Start with the ball's place and the shuffle's seed, so a changed page could work the
// answer out; the server times the answer (verify.js) but cannot tell a watched pick from a computed one.
export const FIND_MATCH_HOLD = ['shell', 'homer', 'target', 'cricket', 'slice', 'rhythm'];   // (Home Run Heroes and Target Practice, December 2026: a swing's moment and a throw's three stops are the phone's word alone; Darts Cricket, the second batch: its two stops, as Bullseye's, which the owner chose to allow: Cricket is held until they say the same of it; Fruit Slice and Rhythm Tap: what a round sliced, and when each note was tapped, are the phone's word)
export const findMatchTypes = types => types.filter(t => !FIND_MATCH_HOLD.includes(t));
export function restrictGames(games, allowed) {
  if (!games || typeof games !== 'object') return games;
  for (const t of Object.keys(games)) if (games[t] && !allowed.includes(t)) games[t] = false;
  return games;
}
// The Game lineup (the main menu's card, ui/lineup.js): what is in rotation on a platform and what is coming soon.
// Released on a platform: released at all (releases/{type}) and not switched off there (releases/platform/{p}/{type}).
// Coming soon: the admin's flag (releases/soon/{type}: true, or a plain release date 'YYYY-MM-DD', display only: releasing
// stays the release switches' job), shown only where the game is not released on that platform, so a game is never both
// on one platform (released on the web but off on iOS: coming soon on iOS alone).
export const SOON_DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
export function releasedOn(t, releases, p) {
  const pl = releases && releases.platform && typeof releases.platform === 'object' ? releases.platform[p] : null;
  return isReleased(t, releases) && !(pl && typeof pl === 'object' && pl[t] === false);
}
const soonVal = (t, releases) => { const s = releases && releases.soon; return s && typeof s === 'object' ? s[t] : undefined; };
export function soonFlag(t, releases) { const v = soonVal(t, releases); return v === true || (typeof v === 'string' && SOON_DATE.test(v)); }
export function soonDate(t, releases) { const v = soonVal(t, releases); return typeof v === 'string' && SOON_DATE.test(v) ? v : null; }
export function soonOn(t, releases, p) { return soonFlag(t, releases) && !releasedOn(t, releases, p); }
// { now, soon }: the games in rotation and coming soon on platform p (has(t): this client has the game); in rotation by
// shown name, coming soon by date (the soonest first, undated and past dates last), then name.
// (today: the viewer's 'YYYY-MM-DD'; a date before it sorts with the undated, as its sticker reads "Coming soon")
export function lineup(releases, p, has = () => true, today = '') {
  const nm = t => String((INFO[t] || {}).name || t), by = (a, b) => nm(a).localeCompare(nm(b), undefined, { numeric: true, sensitivity: 'base' });
  const dt = t => { const d = soonDate(t, releases); return d && d >= today ? d : '9999-99-99'; };
  const ok = TYPES.filter(t => !SC_ONLY.includes(t));
  return { now: ok.filter(t => releasedOn(t, releases, p) && has(t)).sort(by), soon: ok.filter(t => soonOn(t, releases, p)).sort((a, b) => (dt(a) < dt(b) ? -1 : dt(a) > dt(b) ? 1 : by(a, b))) };
}
// The release sticker, from the viewer's own local date (`now`): a date today "Out today!", tomorrow "Coming tomorrow",
// 2 to 6 days on "Coming Wednesday", 7 or more "Coming Dec 3"; no date, or a date already past (the game still not
// released): "Coming soon" (never a past date).
export function soonSticker(date, now = new Date()) {
  if (typeof date !== 'string' || !SOON_DATE.test(date)) return 'Coming soon';
  const [y, m, d] = date.split('-').map(Number), when = new Date(y, m - 1, d), today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (when.getMonth() !== m - 1) return 'Coming soon';                       // (no such day: 2026-02-30)
  const days = Math.round((when - today) / 86400000);                        // (whole local days: a clock change is an hour either way)
  if (days < 0) return 'Coming soon';
  if (days === 0) return 'Out today!';
  if (days === 1) return 'Coming tomorrow';
  if (days < 7) return 'Coming ' + when.toLocaleDateString('en-US', { weekday: 'long' });
  return 'Coming ' + when.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
// A date already past while the game is still not released on some platform (the admin's warning).
export function soonLate(t, releases, today) {
  const d = soonDate(t, releases);
  return !!d && d < today && soonFlag(t, releases) && (!releasedOn(t, releases, 'web') || !releasedOn(t, releases, 'ios'));
}
