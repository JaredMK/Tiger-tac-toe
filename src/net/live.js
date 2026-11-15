// The live layer (December 2026): the other player's turn as it happens, in a Classic online match. Each phone writes
// its own node, `glive/{game}/{side}` (no server call: a database write, read by the two players alone,
// database.rules.json): `sq` the square it has open on its turn (-1 on the board), and while a long real-time attempt
// is under way there (LIVE_TYPES: the runs and attempts a player is locked into once they start), `mv` the attempt as
// it stands (the very move it would send if it ended now: its inputs so far), `t0` its moment, `n` the match's move
// count it belongs to. The other phone (ui/board.js) lights the square the mover has open and offers Watch; watching,
// it shows that square read-only, every committed action playing in it as it lands (net/room.js), and a streamed
// attempt played as it goes: the engine works the partial move out on the record as this phone has it (the same rules
// the server runs, as net/moves.js shotPredict does for a shot), and the square shows it a little behind the stream
// (LIVE.lag), so the drawing never runs out of inputs. When the real move lands, it carries on from where the live
// one was (liveElapsed), so a turn watched whole is never replayed.
import { applyOnlineMove } from '../core/records.js';
import { makeRng } from '../core/random.js';
import { fb } from './connect.js';
import { isMM } from './matchmaking.js';
import { parseMatch, room } from './room.js';
import { state } from '../ui/app.js';
import { startFx, fx } from '../ui/fx.js';
import { render } from '../ui/render.js';

export const LIVE_TYPES = ['dash', 'lane', 'flap', 'chopper', 'snake', 'muncher', 'swarm', 'bricks', 'skyhop', 'scoop', 'pinball'];
export const LIVE = { every: 400, lag: 900, stale: 6000 };   // ms: a streamed attempt written at most this often; shown this far behind the stream; let go once nothing has come for this long
export let live = { X: null, O: null };                      // both sides' nodes as last read
let unsub = null, gameId = null;
let mine = { sq: null, at: 0, last: 0, mvAt: 0 };            // what this phone last wrote
let shown = null;                                            // the other side's streamed attempt shown here: { sq, by, n, base, f, at }
export let watch = null;                                     // watching the other side's turn: { sq } (the square followed), or null

const other = p => (p === 'X' ? 'O' : 'X');
const on = () => !!(fb && state.online && isMM() && !state.sc && state.online.game);

export function liveListen(id) {
  liveStop();
  if (!fb || !fb.m) return;
  gameId = id;
  unsub = fb.m.onValue(fb.m.ref(fb.db, `glive/${id}`), s => {
    const v = s.val() || {};
    live = { X: v.X || null, O: v.O || null };
    liveSeen();
  }, () => {});
}
export function liveStop() {
  if (unsub) unsub();
  unsub = null; gameId = null; live = { X: null, O: null }; mine = { sq: null, at: 0, last: 0, mvAt: 0 }; shown = null; watch = null;
}
const ref = () => fb.m.ref(fb.db, `glive/${gameId}/${state.online.me}`);

// ---- this phone: the square it has open on its turn (from every render: a write only when it changes) ----
export function liveNote() {
  if (!on() || !unsub || gameId !== state.online.game) return;
  const me = state.online.me, sqs = state.squares || [];
  let sq = -1;
  if (!state.winner && state.turn === me && state.screen === 'mini' && state.zoom != null && sqs[state.zoom] && !sqs[state.zoom].owner) sq = state.zoom;
  if (sq === mine.sq) return;
  mine = { sq, at: Date.now(), last: 0, mvAt: 0 };
  fb.m.set(ref(), { sq, at: Date.now() }).catch(() => {});
}
// This phone's attempt under way (a family's frame loop calls it with the move as it stands): written at most every
// LIVE.every ms, while the square is open on this phone's turn.
// build: () => the move as it stands (called only when a write is due).
export function liveRun(sq, build, t0) {
  if (!on() || !unsub || state.turn !== state.online.me || sq !== state.zoom) return;
  const now = Date.now();
  if (now - mine.mvAt < LIVE.every) return;
  mine.mvAt = now; mine.sq = sq;
  let s = null;
  try { s = JSON.stringify(build()); } catch (e) { return; }
  if (!s || s.length > 60000) return;
  fb.m.set(ref(), { sq, at: now, n: state.moves || 0, mv: s, t0: t0 || now }).catch(() => {});
}

// ---- the other phone: what the mover has open, and watching it ----
// The square the other side has open on their turn (their node, while it is their turn in this match), or null.
export function liveSquare() {
  if (!on() || state.winner || state.turn === state.online.me) return null;
  const v = live[state.turn];
  return v && Number.isInteger(v.sq) && v.sq >= 0 && v.sq <= 8 ? v.sq : null;
}
// Watch: this phone opens the square the other side has open, read-only, and follows them until their turn ends.
export function liveWatch() {
  const sq = liveSquare();
  if (sq == null) return false;
  watch = { sq };
  state.screen = 'mini'; state.zoom = sq; state.draft = ''; state.notice = null;
  return true;
}
export function liveUnwatch() { watch = null; if (shown) dropShown(); }
// Their node changed (or the record did): follow their square while watching, and show a streamed attempt.
export function liveSeen() {
  if (!on()) { render(); return; }
  const by = state.turn, v = live[by];
  if (watch) {
    if (by === state.online.me || state.winner) watch = null;   // (their turn is over: watching ends with it)
    else {
      const sq = liveSquare();
      if (sq != null && sq !== watch.sq && !state.flash && !state.spot) { watch.sq = sq; state.screen = 'mini'; state.zoom = sq; }   // they opened another square: followed
    }
  }
  showStream(by, v);
  render();
}
// The attempt the other side is streaming, worked out on the record as this phone has it, shown in their square while
// watching it (state.flash, marked live: never a result, never dismissed, never what holds a record back).
function showStream(by, v) {
  const want = watch && v && typeof v.mv === 'string' && Number.isInteger(v.sq) && v.sq === watch.sq && state.screen === 'mini' && state.zoom === v.sq && by !== state.online.me && (state.moves || 0) === (v.n || 0);
  if (!want) { if (shown && !(state.flash && !state.flash.live)) dropShown(); return; }
  if (state.flash && !state.flash.live) return;                 // (a committed action playing here: the stream waits behind it)
  const sq = state.squares && state.squares[v.sq];
  if (!sq || sq.owner || !LIVE_TYPES.includes(sq.mini.type)) return;
  let mv = null; try { mv = JSON.parse(v.mv); } catch (e) { return; }
  const rec = parseMatch(room && room.match);
  if (!rec) return;
  let r = null;
  try { r = applyOnlineMove(Object.assign({}, rec, { secrets: {} }), by, v.sq, mv, makeRng('live'), {}); } catch (e) { r = null; }
  const e = r && r.ok && r.entries && r.entries.find(x => x.square === v.sq && x.by === by);
  if (!e) return;
  const f = Object.assign({}, e); delete f.after; delete f.seq; delete f.moves; delete f.before;
  f.live = true; f.kind = 'again';                              // (never a result: the attempt is still going)
  const now = performance.now();
  if (!shown || shown.sq !== v.sq || shown.by !== by || shown.n !== (v.n || 0)) shown = { sq: v.sq, by, n: v.n || 0, base: now + LIVE.lag };   // its clock: the stream's first look, a little behind
  shown.f = f; shown.at = now;
  state.flash = f;
  startFx('move', f, shown.base); fx.move.rate = 1; fx.move.quiet = true; fx.move.end = Infinity;
}
function dropShown() {
  if (state.flash && state.flash.live) state.flash = null;
  shown = null;
}
// How far into the other side's attempt this phone already showed it live (ms on the move's own clock), for the move
// that has now landed: the replay carries on from there. 0 when it was not shown live.
export function liveElapsed(e) {
  if (!shown || !e || shown.sq !== e.square || shown.by !== e.by) return 0;
  const el = Math.max(0, performance.now() - shown.base);
  shown = null;
  return el;
}
// A streamed attempt left on show with nothing new for a while (their phone gone quiet): let go.
export function liveTick() {
  if (shown && performance.now() - shown.at > LIVE.stale) { dropShown(); render(); }
}
export const liveShown = () => !!shown;
export function setWatch(v) { watch = v; }
