// The end of a match: the win, loss and draw screens.
import { hashSvg } from '../hash.js';
import { playerName } from '../../core/match.js';
import { other } from '../../core/util.js';
import { connected } from '../../net/connect.js';
import { findOn, isMM } from '../../net/matchmaking.js';
import { lobby, room } from '../../net/room.js';
import { N, esc, save, state, isYou } from '../app.js';
import { toonT } from '../art.js';
import { RATINGS_ENABLED } from '../config.js';
import { record, signed } from './profile.js';
import { netBar } from '../turnbar.js';
import { shareBtn, shareLine } from '../sharecard.js';
import { ICON, roundStk, tape } from '../stickers.js';

/* ----- win screen ----- */
// The match-end message: one picked at random per match, from the winner's, the loser's or the tie list,
// as this phone sees it; kept in the state so it does not change while the screen is up.
const END_MSGS = {
  win: ['WINNER!', 'CHAMPION!', 'UNSTOPPABLE!', 'VICTORY!', 'TOTAL DOMINATION!', 'MASTER OF CHAOS!'],
  loss: ['BETTER LUCK NEXT TIME', 'SO CLOSE…', 'OUTPLAYED', 'DEFEATED', 'CHAOS WON THIS ONE', 'REMATCH?'],
  tie: ["IT'S A TIE!", 'STALEMATE', 'DEAD EVEN', 'NOBODY WINS', 'EVENLY MATCHED', 'CALL IT A DRAW'],
};
export function endKind() {                                         // { list, name }: whose perspective, and whether to name the winner
  const w = state.winner;
  if (w !== 'X' && w !== 'O') return { list: 'tie', name: null };
  if (state.online) return { list: w === state.online.me ? 'win' : 'loss', name: null };
  if (state.cpu && state.cpu.length === 1) return { list: state.cpu === w ? 'loss' : 'win', name: null };   // a person against the computer
  return { list: 'win', name: playerName(state, w) };      // two people on one phone, or the computer against itself: name the winner
}
function endMessage() {
  const k = endKind(), msgs = END_MSGS[k.list];
  if (!(state.endPick && state.endPick.list === k.list && Number.isInteger(state.endPick.i) && state.endPick.i < msgs.length)) {
    state.endPick = { list: k.list, i: Math.floor(Math.random() * msgs.length) };
    save();
  }
  return { list: k.list, text: msgs[state.endPick.i], name: k.name };
}
// The message in a burst: a line for the name, the message wrapped to short lines, the type sized to fit.
function endBurst(m) {
  const words = m.text.split(' '), lines = [];
  for (const wd of words) { const last = lines[lines.length - 1]; if (last && (last + ' ' + wd).length <= 11) lines[lines.length - 1] = last + ' ' + wd; else lines.push(wd); }
  if (m.name) lines.unshift(m.name.toUpperCase() + ' —');
  const W = 300, H = 150 + (lines.length - 1) * 34;
  const longest = Math.max(...lines.map(l => l.length));
  const size = Math.round(Math.min(50, (W * 0.6) / (longest * 0.62), (H * 0.6) / (lines.length * 1.05)));
  let seed = m.text.length * 31 + lines.length;
  const r = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const pts = [];
  for (let k = 0; k < 28; k++) {
    const a = k * Math.PI / 14 - Math.PI / 2, f = k % 2 === 0 ? 0.88 + r() * 0.12 : 0.66 + r() * 0.08;
    pts.push(`${(W / 2 + Math.cos(a) * (W / 2 - 3) * f).toFixed(1)},${(H / 2 + Math.sin(a) * (H / 2 - 3) * f).toFixed(1)}`);
  }
  const top = H / 2 - (lines.length - 1) * size * 0.525 + size * 0.36;
  const cls = m.list === 'loss' ? 's' : m.list === 'tie' ? 'r' : 'y';
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(lines.join(' '))}"><polygon class="bst ${cls}" points="${pts.join(' ')}"/><text class="bursttxt" font-size="${size}" text-anchor="middle">${lines.map((l, i) => `<tspan x="${W / 2}" y="${(top + i * size * 1.05).toFixed(1)}">${esc(l)}</tspan>`).join('')}</text></svg>`;
}
// A matchmaking game's results, as fact stickers: both records after the game (the rating change too, with ratings on)
// and a way to the opponent's profile.
function mmResult() {
  if (!isMM() || state.online.room || !room || !room.pub) return '';   // (a friend room's match: the friends record is on the profile, not here)
  const pub = room.pub, me = state.online.me, opp = pub.players[other(me)];
  const recs = pub.result && pub.result.records;
  let r = '';
  if (RATINGS_ENABLED && pub.mode === 'ranked') {
    const x = pub.result && pub.result.ratings && pub.result.ratings[me];
    r = x ? `<p class="fact rchg ${x.delta >= 0 ? 'up' : 'down'}"><b>${signed(x.delta)}</b> rating ${x.after}</p>` : '<p class="fact rchg wait">updating ratings…</p>';
  }
  const mine = recs ? `<p class="fact rchg rrec">you're <b>${record(recs[me])}</b></p>` : pub.recorded && pub.recorded.done ? '' : '<p class="fact rchg wait">updating records…</p>';   // (a game that ended before records: nothing to wait for)
  return `${r}${mine}<p class="fact vs">vs <button class="link opp" data-act="profile" data-uid="${esc(opp.uid)}">${esc(opp.name)}</button>${recs ? ` <small class="orec">${record(recs[other(me)])}</small>` : ''}</p>`;
}
// The one big action (the Sticker book's results: Rematch dominant): Find Match again after a matchmaking game; a
// friend room's Rematch, which both players have to tap (the requester waits, and can cancel); a local match's Rematch.
const BIG = (act, b, sm, extra = '') => `<button class="stk mode m-again${extra}" data-act="${act}" style="--k:6"><b>${b}</b><small>${sm}</small></button>`;
function againBtns() {
  if (isMM() && !state.online.room) return findAgainBtn();
  if (!state.online) return BIG('rematch', 'Rematch', 'same again?');
  if (!lobby || lobby.status === 'over' || lobby.left) return '';   // the room closed (a forfeit), or the other player left: no rematch
  const me = state.online.me, rm = lobby.rematch || {};
  if (rm[me]) return `<span class="rmwrap"><button class="stk mode m-again rmbtn" disabled style="--k:6"><b>Waiting for ${esc(N(other(me)))}…</b><small>they tap Rematch too</small></button></span>`;   // (the same size as Rematch: .rmbtn)
  return `<span class="rmwrap"><button class="stk mode m-again rmbtn" data-act="rematch"${!connected ? ' disabled' : ''} style="--k:6"><b>Rematch</b><small>same again?</small></button></span>`;
}
// Under the big action, in a friend room, a line always there (so nothing moves): Cancel while this side waits, or the
// other side's request in a bubble.
function rematchNote() {
  if (!state.online || !state.online.room || !lobby || lobby.status === 'over' || lobby.left) return '';
  const me = state.online.me, rm = lobby.rematch || {};
  const inner = rm[me] ? '<button class="stk rmcancel" data-act="rematch-cancel" style="--r:-2deg">Cancel</button>'
    : rm[other(me)] ? `<span class="rmbub" aria-live="polite">${esc(N(other(me)))} wants a rematch</span>` : '';
  return `<div class="rmline">${inner}</div>`;
}
// A Find Match game's next: another one, or a small "soon" tag while Find Match is switched off.
function findAgainBtn() { return findOn ? BIG('find-again', 'Find Match', 'another rival') : '<button class="stk soon slap" disabled style="--k:6" aria-label="Find Match: coming soon">Find Match<small>soon</small></button>'; }
// The round stickers under it: the board, the main menu, Share result.
function roundsRow() {
  return `<div class="menu-rounds endrounds">${roundStk('review', ICON.board, 'the board', { r: 4, k: 7, label: 'View board' })}${roundStk(state.online ? 'leave' : 'menu', ICON.home, 'menu', { r: -3, k: 8, label: 'Main menu' })}${shareBtn()}</div>${shareLine()}`;
}
// The scene's celebration, never still while the screen is up (each loop endless, in real time): stars twinkling round
// the burst and, for a win or a draw, scraps of paper drifting down behind everything (CSS alone: stickers.css .cel).
function celebrate(list) {
  const stars = [[6, 10, 30, 0], [84, 18, 22, .6], [14, 64, 18, 1.1], [90, 66, 26, .3], [70, 2, 16, 1.5]].map(([x, y, w, d]) => `<i class="twk" style="left:${x}%;top:${y}%;width:${w}px;animation-delay:${d}s">${ICON.star}</i>`).join('');
  const bits = list === 'loss' ? '' : Array.from({ length: 14 }, (_, k) => `<i class="bit c${k % 4}" style="left:${(k * 7.3 + 3) % 100}%;animation-delay:${(-k * 0.53).toFixed(2)}s;animation-duration:${(4.2 + (k % 5) * 0.55).toFixed(2)}s"></i>`).join('');
  return `<div class="cel ${list}" aria-hidden="true">${bits}${stars}</div>`;
}
// The board as it ended, on a white sticker taped down, the way it was won under it.
function boardStk(lineCells) {
  const final = state.squares.map((s, i) => `<i class="${s.owner || ''}${lineCells && lineCells.includes(i) ? ' hl' : ''}">${s.owner ? toonT(s.owner) : ''}</i>`).join('');
  return `<div class="stk endboard slap" style="--k:4">${tape('r')}<div class="final" aria-hidden="true">${final}${hashSvg('hash', 10)}</div></div>`;
}
// How many squares each side ended with, from the winner's side (a draw: X first).
function squaresFact(w) {
  const n = p => state.squares.filter(s => s.owner === p).length, a = w === 'O' ? 'O' : 'X', b = other(a);
  const sq = k => `${k} square${k === 1 ? '' : 's'}`;
  return n(a) === n(b) ? `${sq(n(a))} each` : `${sq(n(a))} to ${n(b)}`;
}
// The results screen (the Sticker book): the burst with the winner stuck on it, the headline, the board beside the
// match's facts, then the one big action and the round stickers. `acts` replaces the actions (Practice's, Test play's).
function endScreen(w, title, why, acts) {
  const m = endMessage(), hero = w === 'draw' ? `<span class="stk rd big-g both slap" style="--k:2">${toonT('X')}${toonT('O')}</span>` : `<span class="stk rd big-g ${w} slap" style="--k:2">${toonT(w)}</span>`;
  const facts = `<p class="fact why" style="--k:5">${esc(why)}</p><p class="fact fsq" style="--k:6">${squaresFact(w)}</p>${mmResult()}`;
  return `<main class="scr win-scr sb ${m.list}">${netBar()}${celebrate(m.list)}<div class="win-card${isMM() ? ' mm' : ''}">
    <div class="endhero"><div class="winburst slap" style="--r:-3deg">${endBurst(m)}</div>${hero}</div>
    <h1 class="endttl slap" style="--k:3"><span class="hl">${title}</span></h1>
    <div class="endmid">${boardStk(w === 'draw' ? null : state.winLine)}<div class="facts">${facts}</div></div>
    ${acts == null ? `<div class="endgo">${againBtns()}</div>${rematchNote()}${roundsRow()}` : acts}</div></main>`;
}
export function renderWin(acts) {
  const w = state.winner;
  if (w === 'draw') return renderDraw(acts);
  // The match's result, one line (November 2026): three in a row, the other ran out of time, or the other resigned
  // (leaving through the menu, two missed turns, or 2 minutes disconnected all resign).
  const why = state.winReason === 'line' ? 'Three in a row'
    : state.winReason === 'practice' ? (state.practice && state.practice.test ? 'Won the test game' : 'Won the practice game')
    : state.winReason === 'clock' ? `${N(other(w))} ran out of time`
    : state.winReason === 'resign' || state.winReason === 'timeout' ? `${N(other(w))} resigned`
    : 'Most squares';
  return endScreen(w, `${isYou(w) ? 'You win' : `${N(w)} wins`} the match!`, why, acts);
}
// A draw: once neither player could still make three in a row, the match ended there.
function renderDraw(acts) {
  const why = state.winReason === 'both' ? 'Both made three in a row at once' : state.winReason === 'timeout' ? 'Both missed two rounds in a row' : 'Nobody can make three in a row now';
  return endScreen('draw', "It's a draw!", why, acts);
}
