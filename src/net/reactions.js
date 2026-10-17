// Reactions: six fixed emoji between the two players of an online match, never a move.
import { other } from '../core/util.js';
import { SND } from '../audio/sound.js';
import { fb } from './connect.js';
import { isMM } from './matchmaking.js';
import { mySide } from './room.js';
import { state } from '../ui/app.js';
import { render } from '../ui/render.js';

/* ----- reactions: six fixed emoji between the two players of an online match, never a move. Each side
 * writes only its own node (reacts/{room code or game id}/{side}, see database.rules.json), which the rules
 * accept only as { e: 0 to 5, t: server time }, one every 2 seconds. A new one shows as a bubble by the
 * sender's character, for 2.5 seconds, and pops; it is never saved, and local games have none. ----- */
export const REACTS = [['👋', 'Wave'], ['😂', 'Laugh'], ['😮', 'Wow'], ['😤', 'Huff'], ['👏', 'Clap'], ['🔥', 'Fire']];
const RX_COOL_MS = 2000, RX_SHOW_MS = 2500;
export let reactUnsub = null, rx = freshRx();
function freshRx() { return { tray: false, card: null, seen: null, ready: false, pending: false, until: 0, mute: false, hide: null, cool: null }; }
export const reactOn = () => !!state.online && !!mySide() && ['board', 'mini'].includes(state.screen);
export const reactKey = () => (isMM() ? state.online.game : state.online.code);
export const reactCooling = () => rx.pending || Date.now() < rx.until;
export function listenReacts(key) {
  stopReacts();
  reactUnsub = fb.m.onValue(fb.m.ref(fb.db, 'reacts/' + key), s => onReacts(s.val()), () => {});
}
export function stopReacts() {
  if (reactUnsub) reactUnsub();
  reactUnsub = null; clearTimeout(rx.hide); clearTimeout(rx.cool);
  rx = freshRx();                                    // (the mute lasts this match only)
}
// The other player's latest emoji. Each send carries its own server time, so a new one is known from the
// last; the first reading only notes what is there, so an old one does not pop up again on a reload.
function onReacts(v) {
  const me = mySide();
  if (!me) return;
  const opp = other(me), r = v && v[opp], t = r && r.t ? r.t : null;
  const first = !rx.ready, prev = rx.seen;
  rx.ready = true; rx.seen = t;
  if (first || !t || t === prev || rx.mute || !REACTS[r.e]) return;
  showReact(opp, Number(r.e));
  SND.play('pop');
}
// One bubble at a time: a new reaction replaces the one on show. It is hidden after RX_SHOW_MS.
function showReact(side, e) {
  clearTimeout(rx.hide);
  const at = performance.now();
  rx.card = { side, e: REACTS[e][0], at };
  rx.hide = setTimeout(() => { if (rx.card && rx.card.at === at) { rx.card = null; render(); } }, RX_SHOW_MS);
  render();
}
// Our own: shown at once (the pop is ours to play), then written. The button stays greyed until the write is
// in and the cooldown is over, so the rules never see two inside the two seconds.
export function sendReact(i) {
  const me = mySide(), key = reactKey(), mine = rx;
  if (!reactOn() || !REACTS[i] || reactCooling()) return;
  mine.tray = false; mine.pending = true;
  showReact(me, i);
  SND.play('pop');
  fb.m.set(fb.m.ref(fb.db, `reacts/${key}/${me}`), { e: i, t: fb.m.serverTimestamp() }).then(
    () => { mine.until = Date.now() + RX_COOL_MS; },
    () => { if (mine.card && mine.card.side === me) { mine.card = null; clearTimeout(mine.hide); } mine.until = 0; }   // refused or lost: not shown as sent
  ).finally(() => {
    mine.pending = false;
    if (rx !== mine) return;                          // the match changed meanwhile
    clearTimeout(mine.cool);
    mine.cool = setTimeout(() => { if (state.online) render(); }, Math.max(0, mine.until - Date.now()) + 30);
    render();
  });
}
