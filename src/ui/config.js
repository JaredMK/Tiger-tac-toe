// The page's fixed settings: its storage key and its switches (no imports, so any module may read them
// while the page loads).

/* ===================== UI: render everything from state ===================== */
export const KEY = 'tiger-tac-toe.v4';

/* ===================== Accounts, matchmaking, the leaderboard, history =====================
 * Logging in (Google, or an email and a password) gives a player a username, a rating and a game
 * history. Find Match pairs strangers through the server (Cloud Functions), and for those games the
 * server is the only authority: a move goes to the `move` function, which checks it with the same
 * engine and makes every random choice. The phones read the public game (games/{id}/pub) and play
 * it back exactly like a friend game; hidden values stay on the server until the game reveals them.
 */
// Ratings and the leaderboard are switched off for now (the Cloud Functions have the same flag): no
// rating is shown anywhere and the Leaderboard is off the menu. Their code stays, behind this flag.
export const RATINGS_ENABLED = false;
