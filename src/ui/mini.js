// A zoomed mini-game: its screen (each game's view.js: screen), the pause menu, the result card.
import { playerName } from '../core/match.js';
import { ATT_TYPES } from '../games/shared/attention.js';
import { FINGER_TYPES } from '../games/shared/finger.js';
import { TIMED_RUN_TYPES } from '../core/verify.js';
import { INFO, viewOf } from '../games/index.js';
import { settingsBody } from './settings.js';
import { isMM } from '../net/matchmaking.js';
import { rx } from '../net/reactions.js';
import { canReport } from '../net/tracking.js';
import { blocked, leaveLoses, lockMine, mySide, pinned, remoteTurn } from '../net/room.js';
import { N, esc, menuOpen, menuStep, state, waitsOn } from './app.js';
import { CHEV, toon } from './art.js';
import { attPinned } from './attention.js';
import { scJointFrame, scWaiting } from './chaos.js';
import { waitBand } from './board.js';
import { qBtn } from './explainer.js';
import { fingPinned } from './finger.js';
import { animMs, fxAt, fxAttr } from './fx.js';
import { rep, repActive, repSkipBtn } from './replay.js';
import { reviewCtx } from './screens/profile.js';
import { netBar } from './turnbar.js';
import { cpuTurn } from './turns.js';

// `popup`: Super Chaos's recap replaying the computer's move, as a card over the board (ui/chaos.js).
export function renderMini(sq, review, popup) {
  const f = state.flash;                            // the move just made: its animation and result are playing
  const d = state.done;                             // the move made here, on show until the player heads back to the board
  const mini = d && d.drawn ? d.drawn : sq.mini;    // after a draw, keep showing the full board that drew
  const info = INFO[mini.type];
  const view = (!!sq.owner || !!review) && !f;     // a claimed square (or any square once the match is over and being reviewed): final state, read-only, secrets revealed
  const locked = !!f || !!d || view || (blocked() && !repActive());   // no input while the result plays, once the move is made, when just looking, or while it is not this phone's move (an opponent's inputs replaying: the screen as the mover had it, its controls open; the page takes no tap meanwhile, ui/input.js)
  const a = f && f.type === mini.type ? f : null;   // the move to animate (only while its result is fresh)
  const anim = a ? (Number.isInteger(mini.last) ? mini.last : null) : null;   // the cell just played, for grid games
  const won = i => !!(mini.winCells && mini.winCells.includes(i));
  const wk = i => (mini.winCells ? mini.winCells.indexOf(i) : -1);           // place in the winning run, for staggered highlights
  const fresh = a && (a.kind === 'claim' || a.kind === 'match');             // the square was just won
  const joint = popup ? scJointFrame() : null;   // (both moved in this square: the recap plays both, framed as the opponent's replay)
  const turn = joint || (popup && rep ? rep.by : state.turn);   // (the pop-up: the computer's move, so its screen is the computer's)
  let g = '';
  const game = viewOf(mini.type);
  if (game.screen) g = noOwnWait(game.screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g));
  const lock = state.lock != null && mini.type !== 'trivia' && mini.type !== 'bingo' && mini.type !== 'dominoes' && !ATT_TYPES.includes(mini.type) && !FINGER_TYPES.includes(mini.type) && !TIMED_RUN_TYPES.includes(mini.type);   // a bonus move (a Trivia reveal, an attention game's or a finger game's Start holds the player too, and a timed run's square opened online: not a bonus; Bingo's call after its draw: its own status line says whose call it is)
  let sub = lock ? (mini.type === 'pig' || mini.type === 'wheels' ? `<b class="${turn}">${N(turn)}</b>'s turn in progress`   // (turn info only: how to play is in the ? explainer)
    : mini.type === 'bj' ? (mini.hand || f ? `<b class="${turn}">${N(turn)}</b>'s hand` : `<b class="${turn}">${N(turn)}</b> won the hand · goes again`)   // (a hand won, a hot streak: said once its result has played, never ahead of it)
    : mini.type === 'craps' || mini.type === 'rl' ? (f ? '' : `<b class="${turn}">${N(turn)}</b> ${mini.type === 'rl' ? 'hit' : 'won the round'} · goes again`)   // (Krabs, Little Wheel: a hot streak, once the result has played)
    : mini.type === 'bus' ? (a ? '' : `<b class="${turn}">${N(turn)}</b>'s run`) : mini.type === 'bs' ? `<b class="${turn}">${N(turn)}</b> hit · goes again` : mini.type === 'pool' ? `<b class="${turn}">${N(turn)}</b> sank one · goes again` : `<b class="${turn}">${N(turn)}</b> guessed right · goes again`) : '';
  if (popup) sub = joint ? 'Both moves' : '2× speed';
  else if (f && f.scr) sub = 'Both moves together';   // Super Chaos's round end: what both moves add up to here (a Bump knock, the Roulette spin)
  else if (!view && !f && !d && remoteTurn()) sub = `Waiting for <b class="${turn}">${N(turn)}</b>…`;
  else if (!view && !f && !d && scWaiting() && state.sc.online && state.sc.fail) sub = '<span class="scfail">Move not saved · trying again…</span>';   // Super Chaos in a friend room: the record would not take the move yet
  else if (!view && !f && !d && scWaiting()) sub = '';            // Super Chaos: the move is in, the other's not ready to play yet: the waiting band says so (below)
  if (view) sub = sq.owner ? wonBy(sq.owner) : 'Not won by anyone';   // (a finished square: who won it, nothing more)
  if (d && !f) {                                    // the result held a moment longer (Find the Pair's cards turning back): the board follows by itself
    if (d.kind === 'claim' || d.kind === 'match' || d.kind === 'draw') sub = squareEnd(d);
    else {
      const next = d.pass ? `<b class="${d.pass}">${N(d.pass)}</b> has no move · <b class="${d.next}">${N(d.next)}</b> again` : `<b class="${d.next}">${N(d.next)}</b> next`;
      sub = `${summary(d)} · ${next}`;
    }
  }
  const back = popup ? `<span class="back rtag ${turn}" aria-hidden="true">${REPLAY_ICON}</span>`
    : review ? `<button class="back" data-act="${reviewCtx.mback}" aria-label="Back to the final board">${CHEV}Board</button>`
    : `<button class="back${!f && !d && ((mini.type === 'trivia' && lockMine()) || attPinned() || fingPinned() || (FINGER_TYPES.includes(mini.type) && lockMine())) ? ' gone' : ''}" data-act="back" aria-label="Back to the board"${f || d || lockMine() || cpuTurn() || pinned() || repActive() ? ' disabled' : ''}>${CHEV}Board</button>`;
  const wb = state.sc && !popup && !review && !view && !f && !d ? waitBand(null) : { on: false, html: '' };   // Super Chaos: waiting in the square (a shot or a spin locked in), the board's own band over the game
  const banner = popup ? `<div class="repban ${turn}" role="status">${REPLAY_ICON}<span>${joint ? 'Both moves' : `<b>${N(turn)}</b>'s move`} — replay</span></div>` : '';   // Super Chaos's replay: whose move it is, in their colour, on the pop-up's edge (the whole pop-up: a tap skips to its end)
  return `<main class="scr mini${popup ? ` screplay rep-${turn}` : ''}"${popup ? ` role="dialog" aria-label="${esc(playerName(state, turn))}'s move — replay"` : ''}>${popup ? banner : netBar()}
    <div class="bar${view && sq.owner ? ' won won-' + sq.owner : ''}" role="${view ? 'status' : 'presentation'}">${back}
      <div class="ttl"><b${info.name.length > 14 ? ' class="long"' : ''}>${info.name}</b><small${view ? ' class="won"' : ''}>${sub}</small></div>${qBtn(mini.type)}</div>
    <div class="gwrap"${f ? fxAttr(fxAt('move', f), 'm') : fxAttr(d ? fxAt('back', d) : null)}>${g}</div>${wb.html}${f ? renderFlash(f) : ''}${repSkipBtn() || (joint ? '<button class="rskip late" data-act="rep-skip" aria-label="Skip the replay">Skip</button>' : '')}${popup ? '' : pauseMenu()}</main>`;   // the move's animations count from the move
}
// Classic online never waits on this phone's own move: from the tap, through its play here (a physics shot's local
// simulation, a run, an attempt), until the server's record of it lands, nothing says "Waiting for" this phone's own
// side or "Sending your move" (the header neither: the pressed control shows the press, ui/input.js). The views say who
// is awaited through waitLine (ui/app.js: the other side alone); a view that still words it itself is held to it here.
const OWN_WAIT = /Waiting for <b class="([XO])">(?:(?!<\/b>)[\s\S])*<\/b>…|Sending your (?:move|run|go|attempt)…/g;
export const noOwnWait = html => (html ? html.replace(OWN_WAIT, (m, p) => (p && waitsOn(p) ? m : '')) : html);
const REPLAY_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.6-5.9"/><path d="M4 4v5h5"/></svg>';
// The in-game menu: a pause card with Resume and Main menu (which asks first).
export function pauseMenu() {
  if (!menuOpen) return '';
  if (menuStep === 'confirm') {
    const note = '';
    const text = state.winner ? 'The match is over.' : leaveLoses() ? `<b>It will count as a loss.</b>${note}` : `The match ends here.${note}`;
    return `<div class="flash pause" role="dialog" aria-label="Leave this match?"${fxAttr(fxAt('menu', menuStep))}><div class="card"><h2>Leave this match?</h2><p>${text}</p>
      <div class="row"><button class="btn" data-act="pause-back">No</button><button class="btn go" data-act="pause-leave">Yes</button></div></div></div>`;
  }
  if (menuStep === 'settings') return `<div class="flash pause" role="dialog" aria-label="Settings"${fxAttr(fxAt('menu', menuStep))}><div class="card"><h2>Settings</h2>${settingsBody()}
    <div class="row"><button class="btn go" data-act="pause-back">Back</button></div></div></div>`;
  return `<div class="flash pause" role="dialog" aria-label="Menu"${fxAttr(fxAt('menu', menuStep))}><div class="card"><h2>Menu</h2>${state.online && state.timer.limit ? '<p>The turn clock keeps running.</p>' : state.cpu ? '<p>The computer waits.</p>' : ''}
    <div class="row"><button class="btn go" data-act="pause-resume">Resume</button><button class="btn" data-act="pause-main">Main menu</button></div><button class="btn setbtn" data-act="pause-settings">Settings</button>${canReport() ? '<button class="btn repbtn" data-act="pause-report">Report a problem</button>' : ''}${state.online && mySide() ? `<button class="btn react-mute" data-act="react-mute" aria-pressed="${rx.mute}">Mute opponent's reactions: ${rx.mute ? 'On' : 'Off'}</button>` : ''}</div></div>`;
}
// The end of a square in words, wherever it is said (the result line live and in replays, the held result, a
// finished square's review): "Won by" and the winner's mark, or "Draw". Nothing more (no word, no score, no reset).
export const wonBy = p => `<span class="wonby">Won by <i class="wbm" aria-hidden="true">${toon(p)}</i><b class="sr">${p === 'X' ? 'X' : 'O'}</b></span>`;
export const squareEnd = f => (f.kind === 'draw' ? 'Draw' : wonBy(f.winner || f.by));
// One line about a move, for the result toast and the handoff bar.
function summary(f) {
  const who = `<b class="${f.by}">${N(f.by)}</b>`;
  const game = viewOf(f.type);
  if (game.moveText) return game.moveText(f, who);
  return `${who} placed`;
}
// The move's result: the game's own animation on its screen, and its words (if any) in the header's turn line, the
// reserved place every game screen has (flashLine): nothing is laid over the game. The overlay is clear, a tap
// on it dismisses the result.
function renderFlash(f) {
  const at = fxAt('move', f);
  const open = `<div class="flash lite late" style="--late:${animMs(f)}ms"${fxAttr(at, 'm')} data-act="dismiss">`;
  return `${f.type === 'memory' && f.kind === 'move' ? open.replace(' data-act="dismiss"', '') : open}</div>`;   // (Find the Pair: the two cards stay up for the full 2 seconds)
}
const LINE_TYPES = ['bj', 'bus', 'rl', 'bullseye', 'echo', 'plinko', 'pong', 'trivia', 'oddone', 'dash', 'lane', 'golf', 'pool', 'bowling', 'craps', 'takeover', 'flood', 'seating', 'districts', 'shelves', 'roads', 'flap', 'chopper', 'patterns', 'wheels', 'sniff', 'clash', 'headcount', 'flash', 'snapshot', 'skyhop', 'scoop', 'pinball', 'apple', 'muncher', 'swarm', 'bricks', 'snake', 'dominoes', 'war', 'bingo'];   // (Scratch & Match has no result row: its header line says what was found)
// The result's words for the header line (HTML): a square's end ("Won by" and the mark, or "Draw": squareEnd); else
// '' where the game's own screen says it all (the games with their own reserved result line, a Risky Rolls roll or bank).
export function flashLine(f) {
  if (!f) return '';
  const who = `<b class="${f.by}">${N(f.by)}</b>`;
  if (f.kind === 'claim' || f.kind === 'match' || f.kind === 'draw') return squareEnd(f);   // the square's end: "Won by" and the mark, or "Draw"
  const note = f.timeout ? `${who} ran out of time` : '';
  let say = '';
  if (f.type === 'pig' && f.note === 'bust') say = `Bust! ${who} rolled ${f.roll} again · ${f.pot} point${f.pot === 1 ? '' : 's'} lost`;
  else if (LINE_TYPES.includes(f.type) || (f.type === 'pig' && (f.note === 'bank' || f.kind === 'again'))) say = '';
  else if (f.kind === 'again') say = f.type === 'bs' ? `${who} hit! · fire again` : `${who} found ${esc(f.letter)} · guess again`;
  else say = summary(f);
  return [note, say].filter(Boolean).join(' · ');
}
