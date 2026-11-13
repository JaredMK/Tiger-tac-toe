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
import { CICON, bubble, burstBadge, panel, rays, smallPanel } from '../comic.js';

/* ----- win screen ----- */
// The match-end message: one picked at random per match, from the winner's, the loser's or the tie list,
// as this phone sees it; kept in the state so it does not change while the screen is up.
const END_MSGS = {
  win: ['KAPOW!', 'WINNER!', 'CHAMPION!', 'UNSTOPPABLE!', 'TOTAL DOMINATION!', 'MASTER OF CHAOS!'],
  loss: ['OOF!', 'SO CLOSE…', 'OUTPLAYED!', 'NEXT TIME!', 'CHAOS WON THIS ONE', 'REMATCH?'],
  tie: ["IT'S A TIE!", 'DEAD EVEN!', 'STALEMATE!', 'NOBODY BLINKS!', 'EVENLY MATCHED!', 'CALL IT A DRAW'],
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
// A matchmaking game's results, as fact badges (information): both records after the game (the rating change too,
// with ratings on); the opponent's profile is a small panel (tappable).
function mmResult() {
  if (!isMM() || state.online.room || !room || !room.pub) return '';   // (a friend room's match: the friends record is on the profile, not here)
  const pub = room.pub, me = state.online.me, opp = pub.players[other(me)];
  const recs = pub.result && pub.result.records;
  let r = '';
  if (RATINGS_ENABLED && pub.mode === 'ranked') {
    const x = pub.result && pub.result.ratings && pub.result.ratings[me];
    r = x ? burstBadge(`<b class="rchg ${x.delta >= 0 ? 'up' : 'down'}">${signed(x.delta)}</b> rating ${x.after}`, 'w', 7) : burstBadge('updating ratings…', 'w wait', 7);
  }
  const mine = recs ? burstBadge(`you're ${record(recs[me])}`, 'w rrec', 8) : pub.recorded && pub.recorded.done ? '' : burstBadge('updating records…', 'w wait', 8);   // (a game that ended before records: nothing to wait for)
  return `${r}${mine}<span class="endvs">${smallPanel('profile', '', `vs ${esc(opp.name)}`, { cls: 'w fr opp', k: 9, attrs: ` data-uid="${esc(opp.uid)}"`, aria: `${opp.name}'s profile` })}${recs ? `<small class="orec">${record(recs[other(me)])}</small>` : ''}</span>`;
}
// The one big action (Comic Chaos's results: Rematch dominant): Find Match again after a matchmaking game; a friend
// room's Rematch, which both players have to tap (the requester waits, and can cancel); a local match's Rematch.
const BIG = (act, b, sm, extra = '') => panel(act, b, { tag: 'again?', sub: sm, cls: `y big${extra}`, k: 6 });
function againBtns() {
  if (isMM() && !state.online.room) return findAgainBtn();
  if (!state.online) return BIG('rematch', 'Rematch!', 'same again?');
  if (!lobby || lobby.status === 'over' || lobby.left) return '';   // the room closed (a forfeit), or the other player left: no rematch
  const me = state.online.me, rm = lobby.rematch || {};
  if (rm[me]) return `<span class="rmwrap"><button class="pn y big rmbtn" disabled style="--k:6"><b>Waiting for ${esc(N(other(me)))}…</b><small>they tap Rematch too</small></button></span>`;   // (the same size as Rematch: .rmbtn)
  return `<span class="rmwrap">${panel('rematch', 'Rematch!', { tag: 'again?', sub: 'same again?', cls: 'y big rmbtn', k: 6, attrs: !connected ? ' disabled' : '' })}</span>`;
}
// Under the big action, in a friend room, a line always there (so nothing moves): Cancel while this side waits, or the
// other side's request in a speech bubble.
function rematchNote() {
  if (!state.online || !state.online.room || !lobby || lobby.status === 'over' || lobby.left) return '';
  const me = state.online.me, rm = lobby.rematch || {};
  const inner = rm[me] ? smallPanel('rematch-cancel', '', 'Cancel', { cls: 'w rmcancel' })
    : rm[other(me)] ? `<span class="rmbub" aria-live="polite">${bubble(`${esc(N(other(me)))} wants a rematch!`, 'l')}</span>` : '';
  return `<div class="rmline">${inner}</div>`;
}
// A Find Match game's next: another one, or a small flat "soon" tag while Find Match is switched off.
function findAgainBtn() { return findOn ? BIG('find-again', 'Find Match', 'another rival') : '<button class="soon" disabled aria-label="Find Match: coming soon">Find Match<small>soon</small></button>'; }
// The small panels under it: the board, the main menu, Share result.
function smallRow() {
  return `<div class="ccsmall endsmall">${smallPanel('review', CICON.board, 'Board', { k: 7, aria: 'View board' })}${smallPanel(state.online ? 'leave' : 'menu', CICON.home, 'Menu', { cls: 'w fr', k: 8, aria: 'Main menu' })}${shareBtn()}</div>${shareLine()}`;
}
// The celebration, never still while the screen is up (each loop endless, in real time): the rays turning and, for a
// win or a draw, confetti falling behind everything (CSS alone: comic.css .cel).
function celebrate(list) {
  const bits = list === 'loss' ? '' : Array.from({ length: 16 }, (_, k) => `<i class="bit c${k % 4}" style="left:${(k * 6.7 + 2) % 100}%;animation-delay:${(-k * 0.47).toFixed(2)}s;animation-duration:${(3.6 + (k % 5) * 0.5).toFixed(2)}s"></i>`).join('');
  return `${rays()}<div class="cel ${list}" aria-hidden="true">${bits}</div>`;
}
// The board as it ended, on a flat white card (information), the line it was won by lit.
function boardCard(lineCells) {
  const final = state.squares.map((s, i) => `<i class="${s.owner || ''}${lineCells && lineCells.includes(i) ? ' hl' : ''}">${s.owner ? toonT(s.owner) : ''}</i>`).join('');
  return `<div class="endboard ccpunch"><div class="final" aria-hidden="true">${final}${hashSvg('hash', 10)}</div></div>`;
}
// How many squares each side ended with, from the winner's side (a draw: X first).
function squaresFact(w) {
  const n = p => state.squares.filter(s => s.owner === p).length, a = w === 'O' ? 'O' : 'X', b = other(a);
  const sq = k => `${k} square${k === 1 ? '' : 's'}`;
  return n(a) === n(b) ? `${sq(n(a))} each` : `${sq(n(a))} to ${n(b)}`;
}
// The results screen (Comic Chaos at full volume): the burst with the winner beside it, the headline in a speech bubble,
// the board beside the match's facts as burst badges, then the one big action and the small panels. `acts` replaces
// the actions (Practice's, Test play's). `why` is markup (a name from N(): already escaped, the computer's icon included).
function endScreen(w, title, why, acts) {
  const m = endMessage(), hero = w === 'draw' ? `<span class="big-g both">${toonT('X')}${toonT('O')}</span>` : `<span class="big-g ${w}">${toonT(w)}</span>`;
  const facts = `${burstBadge(why, 'y why', 4)}${burstBadge(squaresFact(w), 'w fsq', 5)}${mmResult()}`;
  return `<main class="scr win-scr cc loud ${m.list}">${netBar()}${celebrate(m.list)}<div class="win-card${isMM() ? ' mm' : ''}">
    <div class="endhero"><div class="winburst ccpunch">${endBurst(m)}</div>${hero}</div>
    <h1 class="endttl">${bubble(title, '', 'ccpunch')}</h1>
    <div class="endmid">${boardCard(w === 'draw' ? null : state.winLine)}<div class="facts">${facts}</div></div>
    ${acts == null ? `<div class="endgo">${againBtns()}</div>${rematchNote()}${smallRow()}` : acts}</div></main>`;
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
  const why = state.winReason === 'both' ? 'Two lines at once' : state.winReason === 'timeout' ? 'Both sat out twice' : 'No line left';
  return endScreen('draw', "It's a draw!", why, acts);
}
