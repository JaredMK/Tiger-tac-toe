// The main board: the nine squares and their miniatures (each game's view.js: miniature).
import { hashSvg } from './hash.js';
import { playerName } from '../core/match.js';
import { fullState } from '../core/records.js';
import { ANIM } from '../core/timer.js';
import { INFO, viewOf } from '../games/index.js';
import { isMM } from '../net/matchmaking.js';
import { parseMatch, remoteTurn, room } from '../net/room.js';
import { N, cpuPlays, esc, state } from './app.js';
import { CHEV, CPU_ICON, ICONS, toon } from './art.js';
import { scHeld, scHint, scLastPlayed, scRecapStage, scShown, scVerdict } from './chaos.js';
import { clockLeft, fmtClock } from './clock.js';
import { scHuman } from '../core/chaos.js';
import { other } from '../core/util.js';
import { BURST_MS, burstPick, burstSvg, drawOld, fxAt, fxAttr } from './fx.js';
import { pauseMenu } from './mini.js';
import { reviewCtx } from './screens/profile.js';
import { netBar } from './turnbar.js';
import { cpuTurn } from './turns.js';

/* ----- main board ----- */
// Whose move it is, at a glance. Waiting (the other phone is on the move; Super Chaos: this side's move is in and the
// other's is not): Classic shows a small bar under the board, in the foot's own room (the other side's character
// bouncing gently, "[name] is playing…" and the turn's countdown where there is one: clock.js keeps it ticking); Super
// Chaos a translucent band across the board's middle ("Waiting for [name]…"), the board dimmed a little. Either fades in
// when the wait starts and out when it ends, timed from that moment so a redraw does not restart it. Super Chaos shows
// the same band over a mini-game where the player waits in their square (a Mini Golf shot or a Bump spin locked in:
// ui/mini.js).
let band = null;                                   // { key, side, txt, at, out }: the band on show, or fading out
export function waitBand(spot) {
  const sc = state.sc, live = !state.winner && !state.flash && !state.done;
  let side = null, txt = '';
  if (sc) {
    const st = sc.recap ? scRecapStage() : null, waits = sc.recap ? !st || st === 'wait' : (sc.me && !sc.oppIn) || sc.missed === sc.round || scHeld();   // (until the other player's replay is ready to play: the recap's start; online, the other phone still in its recap)
    if (live && waits) { side = other(scHuman(state)); txt = `Waiting for ${esc(playerName(state, side))}…`; }
  } else if (live && remoteTurn()) { side = state.turn; txt = `${esc(playerName(state, side))} is playing…`; }   // (online only; Classic shows it as a small bar under the board, November 2026: never across it; the computer moves at once, shown by its square lighting up and its replay: no band)
  const now = performance.now(), key = side ? `${state.id || 'm'}:${sc ? 'r' + sc.round : state.moves}:${side}` : null;
  if (key && (!band || band.key !== key || band.out)) band = { key, side, txt, at: now, out: false };
  else if (key) band.txt = txt;
  else if (band && !band.out) { band.out = true; band.at = now; }
  if (!band || (band.out && now - band.at > 400)) return { on: false, html: '' };
  const left = !band.out ? clockLeft() : null;
  const html = `<div class="wband ${band.side}${band.out ? ' out' : ''}" role="status" aria-live="polite"${fxAttr(band.at)}><span class="wtoon">${toon(band.side)}</span><span class="wtxt">${band.txt}</span>${left != null ? `<span class="wleft">${fmtClock(left)}</span>` : ''}</div>`;
  return { on: !band.out, html };
}
// The squares as they ended, every secret included (online, the unclaimed squares' secrets come from the room).
export function reviewSquares() {
  if (isMM() && room && room.pub && room.pub.final) { try { return JSON.parse(room.pub.final).squares; } catch (e) { /* not yet: the public board */ } }   // a server game: its final state, everything revealed
  if (state.online && !isMM() && room && room.match) { const rec = parseMatch(room.match); if (rec) return fullState(rec).squares; }
  return state.squares;
}
export const STAMP_MS = 1000;                    // the stamp (.8 s) is over by then
export const BOARD_BURST = [320, 500];           // when the two bursts on the board pop in, in ms after the stamp starts
// A square drawn and reset (state.drawStamp, keyed by state.drawId: drawFx starts it once, back on the board): a
// "Draw" stamp slams down over the old game (to about .38 s) and holds; then the shuffle: the stamp and the old game's
// tile flick away to one side as the new game's label and miniature deal in from the other (DRAW_SHUFFLE), all over by
// DRAW_MS. In base time, like the stamp: it plays at the game's pace (Speed's too). The old game is drawn from the
// move's own record of it (drawOld: the flash's `drawn`); without it (none kept), the stamp and the deal alone.
const HASH_SVG = hashSvg('hash', 7);   // the board's #: drawn over the spaces, never taking a tap (each space is its whole button)
export const DRAW_MS = 1150;
export const DRAW_SHUFFLE = [620, 760];          // the old game flicks away, the new one deals in (ms after the stamp starts)
export function renderBoard(review) {
  const spot = review ? null : state.spot;
  // A fresh claim stamps in once, from the moment it landed on the board (stampFx). A re-render while it
  // plays carries it on from there; after that the owner's mark simply sits there. Nothing replays it.
  const stampAt = !review && state.stamp != null && state.squares[state.stamp] && state.squares[state.stamp].owner ? fxAt('stamp', state.stampId) : null;
  const el = stampAt == null ? Infinity : (performance.now() - stampAt) * ANIM.speed;   // (in the stylesheet's base time: the stamp plays at the game's pace)
  const stampOn = el < STAMP_MS;
  const stamped = i => state.stamp === i || (!!state.sc && Array.isArray(state.stamps) && state.stamps.includes(i));   // (Super Chaos: both players may claim a square in the same round)
  const drawAt = !review && state.drawStamp != null && state.drawId != null && state.squares[state.drawStamp] && !state.squares[state.drawStamp].owner ? fxAt('draw', state.drawId) : null;
  const drawI = drawAt != null && (performance.now() - drawAt) * ANIM.speed < DRAW_MS ? state.drawStamp : null;   // (after it, the new game simply sits there: nothing replays it)
  const lastP = review ? null : scLastPlayed();                       // Super Chaos: the square each player played last, a badge in their colour on it
  const rc = !review && state.sc && state.sc.recap;
  const sqs = state.squares.map((sq, i) => {
    const cls = ['sq'];
    if (spot && spot.square === i && spot.before) sq = spot.before;     // a move about to be played back: the square as it was until then
    if (!review) sq = scShown(i) || sq;                                  // Super Chaos's recap: both moves in, nothing claimed yet
    const vd = review ? null : scVerdict(i);                          // Super Chaos's results: this square's, now playing
    if (vd) cls.push(...vd.cls);
    if (sq.owner) cls.push('own-' + sq.owner);
    else if (!lastP && i === state.lastSquare && state.lastBy && !(spot && spot.square === i)) cls.push('last-' + state.lastBy);
    if (spot && spot.square === i) cls.push('spot', 'spot-' + spot.by);
    const info = INFO[sq.mini.type];
    const drew = i === drawI && !sq.owner && !vd && !(spot && spot.square === i);   // just drawn and reset: its Draw stamp and shuffle (not under a glow: the next move's square)
    if (drew) cls.push('drawfx');
    const dn = drew ? ` dnew"${fxAttr(drawAt)}` : '"';
    // a claimed square keeps its label and final state, with the owner's mark laid over them
    const body = `<div class="lab${info.name.length > 14 ? ' long' : ''}${dn}>${ICONS[sq.mini.type]}<span>${info.name}</span></div><div class="thumb${dn}>${thumb(sq.mini, !!sq.owner)}</div>`
      + (drew ? drawOver(drawAt) : '')
      + (sq.owner ? `<div class="own-ov${stampOn && stamped(i) ? ' stamp' : ''}"${stampOn && stamped(i) ? fxAttr(stampAt) : ''} aria-hidden="true">${toon(sq.owner)}<b class="sr">${esc(sq.owner)}</b></div>` : '')   // a fresh claim stamps in
      + (lastP && (lastP.X === i || lastP.O === i) ? `<div class="lpbs" aria-hidden="true">${['X', 'O'].filter(p => lastP[p] === i).map(p => `<i class="lpb ${p}">${p}</i>`).join('')}</div>` : '')   // (both players' badges at once, in a fixed corner: nothing moves)
      + (vd ? vd.html : '')
      + (spot && spot.square === i ? `<div class="spot-lab ${spot.by}${spot.html ? ' sc' : ''}" role="status">${spot.html ? spot.html : `${cpuPlays(spot.by) ? CPU_ICON : ''}${esc(spot.label)}`}</div>` : '');
    const lastTxt = lastP ? ['X', 'O'].filter(p => lastP[p] === i).map(p => `, ${esc(playerName(state, p))} played here last`).join('') : '';
    const label = (sq.owner ? `Square ${i + 1}: ${info.name}, won by ${esc(playerName(state, sq.owner))}. Tap to view` : `Square ${i + 1}: ${info.name}${drew ? ', a draw: a new game' : ''}`) + lastTxt;
    if (review) return `<button class="${cls.join(' ')}" data-act="${reviewCtx.sq}" data-i="${i}" aria-label="${label}. Tap to see it">${body}</button>`;
    return `<button class="${cls.join(' ')}" data-act="zoom" data-i="${i}" aria-label="${label}"${spot && spot.square === i ? fxAttr(fxAt('spot', spot)) : vd && vd.at != null ? fxAttr(vd.at) : ''}${cpuTurn() || rc ? ' disabled' : ''}>${body}</button>`;
  }).join('');
  if (review) return `<main class="scr board-scr review-scr"><div class="revhead"><button class="back" data-act="${reviewCtx.back}" aria-label="${reviewCtx.backAria}">${CHEV}${reviewCtx.backLabel}</button>
      <div class="ttl"><b>${reviewCtx.title}</b><small>Tap any square to see how it ended</small></div></div><div class="board">${sqs}${HASH_SVG}</div>
    <div class="foot"><span class="hint">Every hidden word, number, card and ship is shown</span></div>${pauseMenu()}</main>`;
  const hint = state.sc && !state.winner ? scHint() : spot ? (cpuPlays(spot.by) ? CPU_ICON : '') + esc(spot.label) : cpuTurn() ? `${N(state.turn)} is thinking…` : remoteTurn() ? `Waiting for ${N(state.turn)}…`
    : state.moves ? 'Tap any open square to make a move' : `${N(state.turn)}: tap a square to start`;
  const st = el < BOARD_BURST[1] + BURST_MS ? state.stamp : null;    // a fresh claim: two bursts around it, gone after about a second
  const bw = st == null ? null : burstPick('board:' + state.stampId), bend = k => Math.round(stampAt + (BOARD_BURST[k] + BURST_MS) / ANIM.speed);
  const pow = st == null ? '' : `<div class="pow-b c${st % 3}" style="grid-row:${Math.floor(st / 3) + 1} / span 1;grid-column:${st % 3 + 1} / span 1"${fxAttr(stampAt)} aria-hidden="true">${el < BOARD_BURST[0] + BURST_MS ? `<span class="b1" data-bend="${bend(0)}">${burstSvg(bw.words[0], 'y', 150, 110, 34)}</span>` : ''}<span class="b2" data-bend="${bend(1)}">${burstSvg(bw.words[1], 'r', 160, 104, 28)}</span></div>`;
  const w = waitBand(spot);
  // Classic: whose move it is as a small bar under the board, in the foot's own room (the hint's place: nothing moves);
  // Super Chaos keeps its band across the board.
  const sc = !!state.sc, under = !sc && w.html;
  return `<main class="scr board-scr${sc && w.on ? ' waiting' : ''}">${netBar()}<div class="board">${sqs}${HASH_SVG}${pow}${sc ? w.html : ''}</div>
    <div class="foot${under ? ' fwait' : ''}">${under ? w.html : `<span class="hint">${hint}</span>`}</div>${pauseMenu()}</main>`;
}
// A drawn square's overlay on the board: the old game's tile (its label and miniature as the draw left them), and the
// Draw stamp over it. Each goes off the page once the shuffle is over (data-bend: sweepBursts), animations or none.
function drawOver(at) {
  const end = Math.round(at + DRAW_MS / ANIM.speed), was = drawOld && drawOld.id === state.drawId && INFO[drawOld.type] ? drawOld : null;
  const old = was ? `<div class="drawold"${fxAttr(at)} data-bend="${end}" aria-hidden="true"><div class="lab${INFO[was.type].name.length > 14 ? ' long' : ''}">${ICONS[was.type]}<span>${INFO[was.type].name}</span></div><div class="thumb">${was.mini ? thumb(was.mini, false) : ''}</div></div>` : '';
  return `${old}<div class="drawst"${fxAttr(at)} data-bend="${end}" aria-hidden="true"><b>Draw</b></div>`;
}
// Miniatures: public information only. Hidden words, numbers, cards and the ship never appear here,
// except that a claimed Find the Pair square shows the pair that won it.
function thumb(mini, final) {
  const game = viewOf(mini.type);
  if (game.miniature) return game.miniature(mini, final);
  return '';
}
