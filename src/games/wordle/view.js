// Five Letters: the screen, the miniature, the move's words and sounds, and the inputs.
import { noticeSeq } from '../../net/moves.js';
import { playerName } from '../../core/match.js';
import { isRace, raceFlashHide, raceShape } from '../../core/race.js';
import { N, esc, state, viewer } from '../../ui/app.js';
import { toon } from '../../ui/art.js';
import { fxAt, fxAttr } from '../../ui/fx.js';
import { keyboard } from '../../ui/keyboard.js';
import { wordleGuesses, wordleLeft, wordleLimit, wordlePart } from './rules.js';

// Race mode (core/race.js): the square this view gets holds this phone's own part alone (its guesses and their colours) and
// both players' shapes (their rows of colours, no letters); the other side's move arrives redacted (`a.race`: their shape
// after it, the new row's colours as `row`).
// Each player's guesses left, as dots (filled: left; hollow: used), as Higher/Lower's. A square from before the limit: none.
const pips = (mini, p) => { const k = wordleLimit(mini), left = wordleLeft(mini, p); return `<i class="hpips ${p}" aria-label="${p}: ${left} guess${left === 1 ? '' : 'es'} left">${Array.from({ length: k }, (_, j) => `<i class="${j < left ? 'on' : ''}"></i>`).join('')}</i>`; };
const shapeOf = (mini, p) => raceShape(mini, p) || (mini.shape && mini.shape[p]) || {};
const rowsOf = (mini, p) => { const sh = shapeOf(mini, p); return Array.isArray(sh.rows) ? sh.rows : []; };
// A row of colours alone (no letters): a player's guess as the other side may see it. `fresh`: the one just made (its tiles turn).
const strip = (row, cls, fresh) => `<i class="${cls}${fresh ? ' wnew' : ''}">${row.split('').map((m, k) => `<i class="${m}"${fresh ? ` style="--k:${k}"` : ''}></i>`).join('')}</i>`;
const rowWords = row => { const g = (row.match(/g/g) || []).length, y = (row.match(/y/g) || []).length; return row === 'ggggg' ? 'got the word' : g || y ? [g ? `${g} green` : '', y ? `${y} yellow` : ''].filter(Boolean).join(', ') : 'nothing right'; };

// The miniature: the latest guess in its coloured tiles, its letters as large as the board's other text, the guesses
// before it (two, or three without the dots) as thin strips of their colours above it, and each player's guesses left.
// A race (shapes alone): each player's rows of colours, no letters, and their guesses left.
export function miniature(mini, final) {
  const lim = wordleLimit(mini);
  if (mini.race && !final) {
    return `<div class="tw trace" aria-label="Race: ${['X', 'O'].map(p => `${p} ${rowsOf(mini, p).length} guess${rowsOf(mini, p).length === 1 ? '' : 'es'}${lim ? `, ${wordleLeft(mini, p)} left` : ''}`).join(', ')}">${['X', 'O'].map(p => {
      const rows = rowsOf(mini, p), show = rows.slice(-3);
      return `<div class="twq"><b class="${p}">${p}</b><span class="twqs">${(show.length ? show : ['']).map(r => `<div class="twr tws">${r ? r.split('').map(m => `<i class="${m}"></i>`).join('') : '<i></i>'.repeat(5)}</div>`).join('')}</span>${lim ? pips(mini, p) : ''}</div>`;
    }).join('')}</div>`;
  }
  const gs = mini.race ? [].concat(wordleGuesses(mini, 'X'), wordleGuesses(mini, 'O')) : mini.guesses, last = gs[gs.length - 1], before = gs.slice(lim ? -3 : -4, -1);   // (a finished race square: both players' rows revealed)
  const rows = last
    ? before.map(g => `<div class="twr tws">${g.marks.map(m => `<i class="${m}"></i>`).join('')}</div>`).join('') + `<div class="twr">${last.word.split('').map((ch, k) => `<i class="${last.marks[k]}">${esc(ch)}</i>`).join('')}</div>`
    : `<div class="twr">${'<i></i>'.repeat(5)}</div><div class="twr">${'<i></i>'.repeat(5)}</div>`;
  return `<div class="tw">${rows}${lim ? `<span class="twp">${['X', 'O'].map(p => `<b class="${p}">${p}</b>${pips(mini, p)}`).join('')}</span>` : ''}</div>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  const race = !!mini.race, me = race ? (viewer() || turn) : null, them = me === 'X' ? 'O' : 'X';
  const theirs = race && a && a.race && a.by !== me ? a : race && d && d.race && d.by !== me ? d : null;   // the other side's move, as its shape (held in `d` once its result has played)
  const mine = race ? (view ? [].concat(wordleGuesses(mini, me), wordleGuesses(mini, them)) : wordleGuesses(mini, me)) : mini.guesses;   // (a race: this side's own guesses; a finished square reviewed: both players', revealed)
  const n = mine.length, ownFresh = a && !theirs;
  const rows = mine.map((gs, r) => `<div class="wrow"><span class="wby ${gs.by}">${toon(gs.by)}</span>${gs.word.split('').map((ch, k) =>
        `<i class="wt ${gs.marks[k]}${ownFresh && r === n - 1 ? ' reveal' : ''}"${ownFresh && r === n - 1 ? ` style="--k:${k}"` : ''}>${esc(ch)}</i>`).join('')}</div>`).join('');
  const dr = state.draft || '';
  const cur = Array.from({ length: 5 }, (_, k) => `<i class="wt${dr[k] ? ' typed' : ''}">${esc(dr[k] || '')}</i>`).join('');
  const rank = { x: 1, y: 2, g: 3 };
  const bestOf = list => { const b = {}; for (const gs of list) gs.word.split('').forEach((ch, k) => { if ((rank[gs.marks[k]] || 0) > (rank[b[ch]] || 0)) b[ch] = gs.marks[k]; }); return b; };
  const own = race ? wordleGuesses(mini, me) : mini.guesses;
  const best = bestOf(own), before = ownFresh ? bestOf(own.slice(0, -1)) : best;   // keys recolour once the tiles have flipped (a race: this side's own letters alone)
  const left = wordleLimit(mini) ? `<div class="hleft">${['X', 'O'].map(p => `<span class="${p}"><b class="${p}">${N(p)}</b>${pips(mini, p)}</span>`).join('')}</div>` : '';   // each player's guesses left (always there: nothing moves)
  let opp = '';
  if (race && !view) {                                                                       // the other player's rows as colours alone, in their own reserved line (always there, empty strips for the guesses they have left)
    const rows2 = rowsOf(mini, them), lim = wordleLimit(mini), slots = Math.max(rows2.length, lim || 0);
    const strips = Array.from({ length: slots }, (_, k) => (rows2[k] ? strip(rows2[k], 'wrs', !!(theirs && a && k === rows2.length - 1)) : `<i class="wrs off">${'<i></i>'.repeat(5)}</i>`)).join('');   // (the new row turns once, with the move)
    const said = who => (theirs ? `${who} guessed · ${rowWords(theirs.race.row || '')}${theirs.race.left === 0 && theirs.race.row !== 'ggggg' ? ' · out of guesses' : ''}` : rows2.length ? `${who}'s rows · colours only` : `${who} has not guessed yet`);   // (the label in plain text, the line with the name's markup: never N in an attribute)
    opp = `<div class="wopp${theirs && a ? ' fresh' : ''}" aria-label="${said(esc(playerName(state, them)))}"><span class="wby ${them}">${toon(them)}</span><span class="wrss">${strips}</span></div><div class="wsaid">${said(N(them))}</div>`;
  }
  g = `<div class="g-wordle${race ? ' race' : ''}">${left}${opp}<div class="wlist" id="wlist">${rows || `<div class="empty">${view ? 'No guesses were made.' : race ? 'Your guesses are yours alone' : 'No guesses yet'}</div>`}</div>
        ${state.notice ? `<div class="notice" role="alert"${fxAttr(fxAt('notice', noticeSeq))}>${esc(state.notice)}</div>` : ''}
        ${view ? '' : `<div class="wrow cur${state.notice ? ' shake' : ''}" aria-label="Your guess"${state.notice ? fxAttr(fxAt('notice', noticeSeq)) : ''}><span class="wby"></span>${cur}</div>`}
        ${keyboard(k => (best[k] || '') + (best[k] && best[k] !== before[k] ? ' kc' : ''), () => locked || dr.length >= 5, { enter: locked || dr.length !== 5, bksp: locked || !dr.length })}</div>`;
  return g;
}
// The other side's move in a race square, as this phone may say it: the header's line gets the move as made (ui/turnbar.js
// flashLine reads state.flash itself), so a flash not yet redacted is redacted here from the square (core/race.js).
function seen(f) {
  if (f.race || f.word === undefined || f.by === viewer()) return f;
  const sq = state.squares && state.squares[f.square];
  return sq && isRace(sq.mini) && sq.mini.type === 'wordle' ? raceFlashHide(f, sq.mini) : f;
}
export function moveText(f, who) {
  f = seen(f);
  if (f.race && f.word === undefined) return `${who} guessed · ${rowWords(f.race.row || '')}${f.race.left === 0 && f.race.row !== 'ggggg' ? ' · out of guesses' : ''}`;   // the other side's guess in a race: its colours alone
  return f.note === 'out' ? `${who} tried ${esc(f.word)} · out of guesses` : `${who} tried ${esc(f.word)}`;
}
export function sounds(f, add, won, mini, last) {
  if (!last && mini && mini.race) { const part = wordlePart(mini, f.by); last = part && part.guesses.length ? part.guesses[part.guesses.length - 1] : f.race && f.race.row ? { marks: f.race.row.split('') } : null; }   // (a race: this side's own last guess; the other side's, its row of colours)
  const out = f.note === 'out' || !!(f.race && f.word === undefined && f.race.left === 0 && f.race.row !== 'ggggg');   // (the other side's last guess gone, from its shape: the note is theirs alone)
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
