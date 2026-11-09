// Five Letters: the screen, the miniature, the move's words and sounds, and the inputs.
import { noticeSeq } from '../../net/moves.js';
import { N, esc, state } from '../../ui/app.js';
import { toon } from '../../ui/art.js';
import { fxAt, fxAttr } from '../../ui/fx.js';
import { keyboard } from '../../ui/keyboard.js';
import { raceBoards, raceMe, raceThumb } from '../../ui/race.js';
import { wordleBest, wordleGuesses, wordleLeft, wordleLimit, wordlePart, wordleTarget } from './rules.js';

// Race mode (core/race.js, `rv: 2`): each player their own word; both players' rows are open, so the square is two
// boards (ui/race.js): this phone's own rows, the row being typed and the keyboard, large; the other player's rows,
// letters and colours, smaller under it, their new row turning there as it lands.
// Each player's guesses left, as dots (filled: left; hollow: used), as Higher/Lower's. A square from before the limit: none.
const pips = (mini, p) => { const k = wordleLimit(mini), left = wordleLeft(mini, p); return `<i class="hpips ${p}" aria-label="${p}: ${left} guess${left === 1 ? '' : 'es'} left">${Array.from({ length: k }, (_, j) => `<i class="${j < left ? 'on' : ''}"></i>`).join('')}</i>`; };
const MARK = { g: 'green', y: 'yellow', x: 'grey' };

// The miniature: the latest guess in its coloured tiles, its letters as large as the board's other text, the guesses
// before it (two, or three without the dots) as thin strips of their colours above it, and each player's guesses left.
// A race: each player's best row so far (most greens, then yellows) as coloured tiles, side by side.
export function miniature(mini, final) {
  const lim = wordleLimit(mini);
  if (mini.race) {
    const row = p => { const b = mini.rv === 2 ? wordleBest(mini, p) : null; return `<span class="twb">${(b ? b.marks : [0, 0, 0, 0, 0]).map(m => `<i${m ? ` class="${m}"` : ''}></i>`).join('')}</span>`; };
    return raceThumb(row, 'tw2', `Race: ${['X', 'O'].map(p => { const b = mini.rv === 2 ? wordleBest(mini, p) : null; return `${p} ${b ? b.marks.map(m => MARK[m]).join(' ') : 'no guess yet'}`; }).join(', ')}`);
  }
  const gs = mini.guesses, last = gs[gs.length - 1], before = gs.slice(lim ? -3 : -4, -1);
  const rows = last
    ? before.map(g => `<div class="twr tws">${g.marks.map(m => `<i class="${m}"></i>`).join('')}</div>`).join('') + `<div class="twr">${last.word.split('').map((ch, k) => `<i class="${last.marks[k]}">${esc(ch)}</i>`).join('')}</div>`
    : `<div class="twr">${'<i></i>'.repeat(5)}</div><div class="twr">${'<i></i>'.repeat(5)}</div>`;
  return `<div class="tw">${rows}${lim ? `<span class="twp">${['X', 'O'].map(p => `<b class="${p}">${p}</b>${pips(mini, p)}`).join('')}</span>` : ''}</div>`;
}
const rank = { x: 1, y: 2, g: 3 };
const bestOf = list => { const b = {}; for (const gs of list) gs.word.split('').forEach((ch, k) => { if ((rank[gs.marks[k]] || 0) > (rank[b[ch]] || 0)) b[ch] = gs.marks[k]; }); return b; };
// A list of guessed rows, each with its guesser's mark; `fresh`: the newest turns its tiles.
const rowsHtml = (list, fresh) => list.map((gs, r) => `<div class="wrow"><span class="wby ${gs.by}">${toon(gs.by)}</span>${gs.word.split('').map((ch, k) =>
  `<i class="wt ${gs.marks[k]}${fresh && r === list.length - 1 ? ' reveal' : ''}"${fresh && r === list.length - 1 ? ` style="--k:${k}"` : ''}>${esc(ch)}</i>`).join('')}</div>`).join('');
// A word shown whole once the square is over (a race's targets): its tiles plain, under the rows.
const answer = (w, p) => (typeof w === 'string' ? `<div class="wrow wans" aria-label="The word was ${esc(w)}"><span class="wby ${p}">${toon(p)}</span>${w.split('').map(ch => `<i class="wt">${esc(ch)}</i>`).join('')}</div>` : '');
// This phone's own board: its rows, the row being typed (or, in a finished square, nothing to type) and the keyboard.
function board(own, locked, a, view, race, extra) {
  const n = own.length, ownFresh = !!a;
  const dr = state.draft || '';
  const cur = Array.from({ length: 5 }, (_, k) => `<i class="wt${dr[k] ? ' typed' : ''}">${esc(dr[k] || '')}</i>`).join('');
  const best = bestOf(own), before = ownFresh ? bestOf(own.slice(0, -1)) : best;   // keys recolour once the tiles have flipped
  const rows = rowsHtml(own, ownFresh);
  return `<div class="g-wordle${race ? ' race' : ''}">${extra.left || ''}<div class="wlist" id="wlist">${rows || (n ? '' : `<div class="empty">${view ? 'No guesses were made.' : 'No guesses yet'}</div>`)}${extra.ans || ''}</div>
        ${state.notice ? `<div class="notice" role="alert"${fxAttr(fxAt('notice', noticeSeq))}>${esc(state.notice)}</div>` : ''}
        ${view ? '' : `<div class="wrow cur${state.notice ? ' shake' : ''}" aria-label="Your guess"${state.notice ? fxAttr(fxAt('notice', noticeSeq)) : ''}><span class="wby"></span>${cur}</div>`}
        ${keyboard(k => (best[k] || '') + (best[k] && best[k] !== before[k] ? ' kc' : ''), () => locked || dr.length >= 5, { enter: locked || dr.length !== 5, bksp: locked || !dr.length })}</div>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  if (!mini.race) {
    const left = wordleLimit(mini) ? `<div class="hleft">${['X', 'O'].map(p => `<span class="${p}"><b class="${p}">${N(p)}</b>${pips(mini, p)}</span>`).join('')}</div>` : '';   // each player's guesses left (always there: nothing moves)
    return board(mini.guesses, locked, a, view, false, { left });
  }
  const me = raceMe(), them = me === 'X' ? 'O' : 'X';
  const mine = wordleGuesses(mini, me), theirs = wordleGuesses(mini, them);              // (both parts open; a square from before the rework: what this copy has)
  const mineA = a && a.by === me ? a : null, theirA = a && a.by === them ? a : null;      // the move to animate, on the board of the side that made it
  const opp = `<div class="wopp2"><div class="wol">${rowsHtml(theirs, !!theirA) || '<div class="empty">No guesses yet</div>'}${view ? answer(wordleTarget(mini, them), them) : ''}</div></div>`;
  return raceBoards(board(mine, locked, mineA, view, true, { ans: view ? answer(wordleTarget(mini, me), me) : '' }), opp, `${theirs.length} guess${theirs.length === 1 ? '' : 'es'}`, { cls: 'rb-wordle' });
}
export function moveText(f, who) {
  if (f.word === undefined) return `${who} guessed`;            // (a redacted move from before the race rework: nothing to say)
  return f.note === 'out' ? `${who} tried ${esc(f.word)} · out of guesses` : `${who} tried ${esc(f.word)}`;
}
export function sounds(f, add, won, mini, last) {
  if (!last && mini && mini.race) { const part = wordlePart(mini, f.by); last = part && part.guesses.length ? part.guesses[part.guesses.length - 1] : null; }   // (a race: the mover's own last guess, open to both)
  const out = f.note === 'out';
  if (last) last.marks.forEach((m, k) => add(m === 'g' ? 'tileG' : m === 'y' ? 'tileY' : 'tileX', 200 + k * 180)); if (won && !out) add('solve', 1100); if (out) add('thud', 1100); return;   // the last guess gone: the square goes to the other player
}
// Someone else's guess replayed (ui/replay.js): the letters typed into the row as theirs were, then Enter.
function replayInput(act, val) {
  if (act === 'key' && /^k=[A-Z]$/.test(val || '')) { if ((state.draft || '').length < 5) state.draft = (state.draft || '') + val.slice(2); }
  else if (act === 'bksp') state.draft = (state.draft || '').slice(0, -1);
  return false;   // (the key's own sound plays)
}
const replaySynth = m => (typeof m === 'string' ? m.split('').map((ch, k) => [k * 300, 'key', 'k=' + ch]).concat([[m.length * 300 + 200, 'enter']]) : null);
export const replay = { input: replayInput, synth: replaySynth };
