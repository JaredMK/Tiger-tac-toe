// A zoomed mini-game: its screen (each game's view.js: screen), the pause menu, the result card.
import { playerName } from '../core/match.js';
import { ATT_TYPES } from '../games/shared/attention.js';
import { FINGER_TYPES } from '../games/shared/finger.js';
import { BS } from '../games/bs/rules.js';
import { huntSize } from '../games/hunt/rules.js';
import { INFO, viewOf } from '../games/index.js';
import { soundBtn } from '../audio/sound.js';
import { isMM } from '../net/matchmaking.js';
import { rx } from '../net/reactions.js';
import { blocked, leaveLoses, lockMine, moveWait, mySide, pinned, remoteTurn } from '../net/room.js';
import { N, esc, menuOpen, menuStep, state } from './app.js';
import { CHEV } from './art.js';
import { attPinned } from './attention.js';
import { scCpu, scWaiting } from './chaos.js';
import { qBtn } from './explainer.js';
import { fingPinned } from './finger.js';
import { animMs, fx, fxAt, fxAttr } from './fx.js';
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
  const turn = popup && rep ? rep.by : state.turn;   // (the pop-up: the computer's move, so its screen is the computer's)
  let g = '';
  const game = viewOf(mini.type);
  if (game.screen) g = game.screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g);
  const lock = state.lock != null && mini.type !== 'trivia' && !ATT_TYPES.includes(mini.type) && !FINGER_TYPES.includes(mini.type);   // a bonus move (a Trivia reveal, an attention game's or a finger game's Start holds the player too: not a bonus)
  let sub = lock ? (mini.type === 'pig' ? `<b class="${turn}">${N(turn)}</b>'s turn in progress`   // (turn info only: how to play is in the ? explainer)
    : mini.type === 'bj' ? `<b class="${turn}">${N(turn)}</b>'s hand`
    : mini.type === 'bus' ? (a ? '' : `<b class="${turn}">${N(turn)}</b>'s run`) : mini.type === 'bs' ? `<b class="${turn}">${N(turn)}</b> hit · goes again` : mini.type === 'pool' ? `<b class="${turn}">${N(turn)}</b> sank one · goes again` : `<b class="${turn}">${N(turn)}</b> guessed right · goes again`) : '';
  if (popup) sub = '2× speed';
  else if (f && f.scr) sub = 'Both moves together';   // Super Chaos's round end: what both moves add up to here (a Bump knock, the Roulette spin)
  else if (!view && !f && !d && remoteTurn()) sub = `Waiting for <b class="${turn}">${N(turn)}</b>…`;
  else if (!view && !f && !d && scWaiting()) sub = `Waiting for <b class="${scCpu()}">${N(scCpu())}</b>…`;   // Super Chaos: the move is in; the computer is still at its own
  else if (!view && !f && !d && moveWait) sub = 'Sending your move…';
  let secret = '';
  if (view) {
    secret = mini.type === 'wordle' || mini.type === 'hangman' ? `The word was ${mini.word}`
      : mini.type === 'hilo' ? `The number was ${mini.target}`
      : mini.type === 'bs' ? `${sq.owner ? 'Sank' : 'It was'} the ${BS.names[mini.len] || 'ship'}`
      : mini.type === 'memory' ? 'Every card shown'
      : mini.type === 'coins' ? `All five show ${sq.owner}`
      : mini.type === 'hunt' ? `The treasure was at row ${Math.floor(mini.treasure / huntSize(mini)) + 1}, column ${mini.treasure % huntSize(mini) + 1}`
      : mini.type === 'pig' ? `${mini.bank.X} to ${mini.bank.O}`
      : mini.type === 'bj' ? `${mini.wins.X} to ${mini.wins.O}`
      : mini.type === 'bus' ? `X ${mini.prog.X.length} of 4 · O ${mini.prog.O.length} of 4`
      : mini.type === 'rl' ? `${mini.hits.X} hit${mini.hits.X === 1 ? '' : 's'} to ${mini.hits.O}` : '';
    sub = sq.owner ? `<b class="${sq.owner}">Won by ${N(sq.owner)}</b>${secret ? ' · ' + secret : ''}` : `Not won by anyone${secret ? ' · ' + secret : ''}`;
  }
  if (d && !f) {                                    // the result held a moment longer (Memory's cards turning back): the board follows by itself
    const head = d.kind === 'draw' ? `${d.note === 'stuck' ? 'Stuck' : d.note === 'tie' ? 'Tie' : 'Draw'} · resets to ${INFO[d.newType].name}` : summary(d);
    const next = d.pass ? `<b class="${d.pass}">${N(d.pass)}</b> has no move · <b class="${d.next}">${N(d.next)}</b> again` : `<b class="${d.next}">${N(d.next)}</b> next`;
    sub = `${head} · ${next}${secret ? ' · ' + secret : ''}`;
  }
  const back = popup ? `<span class="back rtag ${turn}" aria-hidden="true">${REPLAY_ICON}</span>`
    : review ? `<button class="back" data-act="${reviewCtx.mback}" aria-label="Back to the final board">${CHEV}Board</button>`
    : `<button class="back${!f && !d && ((mini.type === 'trivia' && lockMine()) || attPinned() || fingPinned() || (FINGER_TYPES.includes(mini.type) && lockMine())) ? ' gone' : ''}" data-act="back" aria-label="Back to the board"${f || d || lockMine() || cpuTurn() || pinned() || repActive() ? ' disabled' : ''}>${CHEV}Board</button>`;
  const banner = popup ? `<div class="repban ${turn}" role="status">${REPLAY_ICON}<span><b>${N(turn)}</b>'s move — replay</span></div>` : '';   // Super Chaos's replay: whose move it is, in their colour, on the pop-up's edge (the whole pop-up: a tap skips to its end)
  return `<main class="scr mini${fx.enter && performance.now() - fx.enter.at < 400 ? ' enter' : ''}${popup ? ` screplay rep-${turn}` : ''}"${popup ? ` role="dialog" aria-label="${esc(playerName(state, turn))}'s move — replay"` : ''}>${popup ? banner : netBar()}
    <div class="bar${view && sq.owner ? ' won won-' + sq.owner : ''}" role="${view ? 'status' : 'presentation'}">${back}
      <div class="ttl"><b${info.name.length > 14 ? ' class="long"' : ''}>${info.name}</b><small${view ? ' class="won"' : ''}>${sub}</small></div>${qBtn(mini.type)}</div>
    <div class="gwrap"${fxAttr(f ? fxAt('move', f) : d && !f ? fxAt('back', d) : null)}>${g}</div>${f ? renderFlash(f) : ''}${repSkipBtn()}${popup ? '' : pauseMenu()}</main>`;   // the move's animations count from the move
}
const REPLAY_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.6-5.9"/><path d="M4 4v5h5"/></svg>';
// The in-game menu: a pause card with Resume and Main menu (which asks first).
export function pauseMenu() {
  if (!menuOpen) return '';
  if (menuStep === 'confirm') {
    const note = state.online && !isMM() ? ' Your friend is told you left and sent back to the main menu.' : '';
    const text = state.winner ? 'The match is over.' : leaveLoses() ? `<b>It will count as a loss.</b>${note}` : `The match ends here.${note}`;
    return `<div class="flash pause" role="dialog" aria-label="Leave this match?"${fxAttr(fxAt('menu', menuStep))}><div class="card"><h2>Leave this match?</h2><p>${text}</p>
      <div class="row"><button class="btn" data-act="pause-back">No</button><button class="btn go" data-act="pause-leave">Yes</button></div></div></div>`;
  }
  return `<div class="flash pause" role="dialog" aria-label="Menu"${fxAttr(fxAt('menu', menuStep))}><div class="card"><h2>Paused</h2><p>${state.online && state.timer.limit ? 'The turn clock keeps running.' : state.cpu ? 'The computer waits.' : 'Take your time.'}</p>
    <div class="row"><button class="btn go" data-act="pause-resume">Resume</button><button class="btn" data-act="pause-main">Main menu</button></div>${state.online && mySide() ? `<button class="btn react-mute" data-act="react-mute" aria-pressed="${rx.mute}">Mute opponent's reactions: ${rx.mute ? 'On' : 'Off'}</button>` : ''}${soundBtn('pause')}</div></div>`;
}
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
  const open = `<div class="flash lite late" style="--late:${animMs(f)}ms"${fxAttr(at)} data-act="dismiss">`;
  return `${f.type === 'memory' && f.kind === 'move' ? open.replace(' data-act="dismiss"', '') : open}</div>`;   // (Memory: the two cards stay up for the full 2 seconds)
}
const LINE_TYPES = ['bj', 'bus', 'rl', 'bullseye', 'echo', 'plinko', 'pong', 'trivia', 'oddone', 'dash', 'lane', 'golf', 'pool', 'bowling', 'craps', 'takeover', 'flood', 'seating', 'districts', 'shelves', 'roads', 'flap', 'chopper', 'patterns', 'wheels', 'sniff', 'clash', 'headcount', 'flash', 'snapshot', 'skyhop', 'scoop', 'pinball'];
// The result's words for the header line (HTML), or '' when the game's own screen says it all: a square won (its
// winning moment), the games that show their result in their own reserved line, a Risky Rolls roll or bank.
export function flashLine(f) {
  if (!f) return '';
  const who = `<b class="${f.by}">${N(f.by)}</b>`;
  const note = f.timeout ? `${who} ran out of time — random move` : '';
  let say = '';
  if (f.kind === 'claim' || f.kind === 'match') say = '';
  else if (f.type === 'pig' && f.note === 'bust') say = `Bust! ${who} rolled ${f.roll} again · ${f.pot} point${f.pot === 1 ? '' : 's'} lost`;
  else if (LINE_TYPES.includes(f.type) || (f.type === 'pig' && (f.note === 'bank' || f.kind === 'again'))) say = '';
  else if (f.kind === 'draw') {
    const TIE = { seating: 'the same number of tables each', shelves: 'on as many shelves each', roads: 'roads the same length' };
    const head = f.note === 'stuck' ? 'Stuck! No legal moves' : f.note === 'blocked' ? 'Draw! Nobody can win it' : f.note === 'tie' ? `Tie! ${TIE[f.type] || 'level at the end'}` : 'Draw! Full board';
    say = `${head} · now ${INFO[f.newType].name}`;
  } else if (f.kind === 'again') say = f.type === 'bs' ? `${who} hit! · fire again` : `${who} found ${f.letter} · guess again`;
  else say = summary(f);
  return [note, say].filter(Boolean).join(' · ');
}
