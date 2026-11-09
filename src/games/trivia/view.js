// Trivia: the screen, the miniature, the move's words and sounds, and the inputs.
import { TRIVIA, setTriviaBank, triviaReady, triviaReveal, triviaShape } from './rules.js';
import { SND } from '../../audio/sound.js';
import { dbReveal } from '../../net/moves.js';
import { blocked } from '../../net/room.js';
import { N, REDUCED, commit, cpuPlays, esc, mv, state, viewer } from '../../ui/app.js';
import { KEY } from '../../ui/config.js';
import { fxAttr } from '../../ui/fx.js';
import { arcTally, lateAt, pips } from '../../ui/progress.js';
import { pipRows } from '../../ui/thumbs.js';
import { tune } from '../../core/tune.js';
import { render } from '../../ui/render.js';

// Trivia: the player's question and four answers. After a tap the right one glows (and a wrong pick
// shakes); the next question waits for the square to be opened again.
// Trivia: the square's one question, shared. An option picked wrong is crossed out (for both players)
// and stays crossed out; the right answer is never shown until someone picks it. A turn there, either
// player's, carries on with what is left. Right: a point, and the next turn gets a new question.
// Trivia: a new question waits face down, with a Reveal button (and Board to leave without acting). Reveal
// turns it up for both phones and holds the player to the square (no Board button) until they answer,
// timer and all; once up it stays up whenever the square is opened, until it is answered right and a new
// one comes, face down again. Someone else's pick (the computer's, the other phone's) plays as their
// screen did: the card turned up (if it was turned up in that turn), a pause, their pick.
export let triviaFlip = null;                                          // { sq, at }: this phone's reveal, for the card's turn
export function triviaPre(f) { const t = f && f.type === 'trivia' ? f.trivia || f.race : null; return t && !REDUCED && (state.online ? f.by !== state.online.me : cpuPlays(f.by)) ? (t.fresh ? TRIVIA.flip : 0) + TRIVIA.pause : 0; }   // someone else's pick: the reveal and the pause first (a race: their move is its shape alone, f.race)
const triviaUp = mini => !!(mini.shown && mini.ask && mini.ask.q);
const TQBACK = `<div class="tqcard tqback" aria-label="The question, face down"><span aria-hidden="true">?</span><small>Trivia</small></div>`;
// Race mode (core/race.js): the square this view gets holds this phone's own card alone (mini.side[me]: its cross-outs and
// its last pick) and both players' shapes (wrong tries made, right or not); the other side's move arrives redacted
// (a.race: right or wrong, the reveal to show, a timeout), never the option they picked. A finished square (view) is full.
const TICK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12.5l5.5 5.5L20 7" fill="none" stroke="currentColor" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const shapeOf = (mini, p) => (mini.shape && mini.shape[p]) || triviaShape(mini.side && mini.side[p]);   // a side's progress: the shape the record carries, or from its card (a finished square)
// A player's race tally: a pip for each wrong try they could make (filled red for each made) and a tick once they are right.
export function raceTally(sh, slots, fresh, t) {
  const n = sh.n || 0;
  return `<span class="pips tqr" aria-label="${n} wrong${sh.right ? ', got it' : ''}">${Array.from({ length: slots }, (_, k) => `<i ${lateAt(k < n ? 'no' : '', fresh && !sh.right && k === n - 1 ? t : null, 'fillin')}></i>`).join('')}<em ${lateAt('tqok' + (sh.right ? ' on' : ''), fresh && sh.right ? t : null)}>${TICK}</em></span>`;
}
function triviaTable(mini, a, o) {
  const race = !!mini.race, me = race ? (viewer() || o.turn) : null, turn = o.turn;
  const part = race ? (mini.side && mini.side[me]) || null : mini;                          // this side's own card (a race: may be absent on a phone with no side), or the square
  const theirs = race && a && a.race && a.by !== me ? a : null;                              // the other side's move in a race: its shape alone
  const t = a && a.trivia ? a.trivia : null, fr = t || (theirs && theirs.race), l = part ? part.last : null;
  const pre = fr ? triviaPre(a) : 0, flipT = fr && fr.fresh && pre ? TRIVIA.flip : 0;
  const goal = tune(mini).goal;   // (its settings: TUNE)
  const ask = triviaUp(mini) ? mini.ask : null, down = !!(mini.ask && !mini.shown);
  const nOpts = ask ? ask.opts.length : mini.ask && mini.ask.n ? mini.ask.n : tune(mini).opts;
  const tal = p => arcTally(p, o, race ? raceTally(shapeOf(mini, p), nOpts - 1, !!(fr && a.by === p), pre + 250) : pips(p, Math.min(goal, mini.right[p]), goal, t && t.correct && a.by === p, pre + 250));
  // what shows: the pick just made (fresh), else the one on show until heading back or when looking back, else the open question
  const winL = race && o.view ? ['X', 'O'].map(p => mini.side && mini.side[p] && mini.side[p].last).find(x => x && x.correct) || null : null;   // a finished race square: the winning pick
  const held = o.done && (!race || o.dby === me);                                            // this phone's own move, held until Board (never the other side's)
  const pick = t || (race && o.view ? winL : (held || o.view) && l ? l : null);
  const shown = pick || ask;
  const W = p => `<b class="${p}">${N(p)}</b>`;
  if (!shown && down) {                                        // face down: Reveal (the player to move), or waiting
    const mine = !o.view && !o.locked;
    const note = mine ? '<p class="arcnote"></p>' : `<p class="arcnote">${o.view ? '' : `${W(turn)}'s turn · the question is face down`}</p>`;
    const btn = o.view ? '' : `<div class="cbtns one${mine ? '' : ' hold'}"><button class="big" data-act="trivia-reveal"${mine ? '' : ' disabled tabindex="-1" aria-hidden="true"'}>Reveal</button></div>`;
    return `<div class="g-arc"><div class="ctals">${tal('X')}${tal('O')}</div><div class="trivia">${TQBACK}${note}</div>${btn}</div>`;
  }
  if (!shown) return `<div class="g-arc"><div class="ctals">${tal('X')}${tal('O')}</div><div class="trivia"><p class="arcnote">No question here: the questions are still loading.</p></div></div>`;
  const crossed = new Set(pick && !winL ? (pick.crossed || []) : part ? (part.crossed || []) : []);   // this phone's own cross-outs (a race), or the square's
  const outBy = k => (winL ? ['X', 'O'].filter(p => mini.side && mini.side[p] && (mini.side[p].crossed || []).includes(k)) : []);   // a finished race square: who crossed an option out
  const letters = 'ABCD', late = pre ? ' late' : '';
  const opts = shown.opts.map((text, k) => {
    let cls = 'topt';
    const by = outBy(k);
    if (crossed.has(k) || by.length) cls += ' out';                       // crossed out before: struck through, not to be picked again
    else if (pick && k === pick.picked) cls += (pick.correct ? ' right' : ' wrong out fresh') + (t ? late : '');   // the pick: right glows; wrong shakes and is struck through (someone else's: when their pick comes)
    const st = pick && t && k === pick.picked ? ` style="--t:${pre + 250}ms"` : '';
    const dis = !!pick || !!theirs || o.locked || crossed.has(k);
    const who = by.length ? `<small class="tqwho" aria-hidden="true">${by.map(p => `<b class="${p}">${p}</b>`).join('')}</small>` : '';
    return `<button class="${cls}"${st} data-act="move" ${mv(k)}${dis ? ' disabled' : ''} aria-label="${letters[k]}: ${esc(text)}${crossed.has(k) || by.length || (pick && !pick.correct && k === pick.picked) ? ' (crossed out)' : ''}"><b>${letters[k]}</b><span>${esc(text)}</span>${who}</button>`;
  }).join('');
  const who = pick ? pick.by || (t && a.by) : turn, left = shown.opts.length - crossed.size;
  const res = theirs                                                      // the other side's pick in a race: right or wrong, never which
    ? `<p ${lateAt('arcres ' + (theirs.race.correct ? 'ok' : 'no'), pre + 250)} role="status">${W(a.by)} ${theirs.race.correct ? 'got it right' : theirs.race.auto ? 'ran out of time' : 'got it wrong'}</p>`
    : t ? `<p ${lateAt('arcres ' + (t.correct ? 'ok' : 'no'), pre + 250)} role="status">${pre ? `${W(a.by)} ${t.correct ? 'got it right' : t.picked < 0 || t.auto ? 'ran out of time' : 'got it wrong'}` : t.correct ? 'Right!' : t.picked < 0 ? 'Time\'s up' : t.auto ? 'Time\'s up: one crossed out' : 'Wrong: crossed out'}</p>`
    : pick ? `<p class="arcres ${pick.correct ? 'ok' : 'no'}">${W(who)} ${pick.correct ? 'got it right' : 'got it wrong'}</p>`
    : `<p class="arcnote">${o.view ? '' : `${W(turn)}'s turn · ${left} option${left === 1 ? '' : 's'} left${race ? ' for you' : ''}`}</p>`;
  const fl = !fr && triviaFlip && triviaFlip.sq === o.zoom && performance.now() - triviaFlip.at < TRIVIA.flip + 200 ? triviaFlip.at : null;   // this phone's own reveal: the card turns up
  const front = `<div class="tqcard${fl != null || flipT ? ' tqturn' : ''}"${flipT ? ` style="--t:${flipT - 350}ms"` : ''}${fl != null ? fxAttr(fl) : ''}><small>${esc(shown.cat || 'Trivia')}</small><p>${esc(shown.q)}</p></div>`;
  const card = flipT ? `<div class="tqstack"><span class="tu" style="--u:${flipT - 350}ms">${TQBACK}</span><span class="tf" style="--f:${flipT - 350}ms">${front}</span></div>` : front;   // someone else's reveal: face down, then turned up
  const optsBox = flipT ? `<div class="topts tf" style="--f:${flipT}ms">${opts}</div>` : `<div class="topts">${opts}</div>`;
  return `<div class="g-arc"><div class="ctals">${tal('X')}${tal('O')}</div><div class="trivia">${card}${optsBox}${res}</div></div>`;
}
// The Trivia questions: trivia.json beside this page (from the Open Trivia Database, CC BY-SA 4.0),
// fetched at every start and kept for the next visit (offline, the last copy); until they are in,
// Trivia is not dealt (engine.js: dealable) and the checklist says so.
const TRIVIA_KEY = KEY + '.trivia';
export function loadTrivia() {
  try { const v = JSON.parse(localStorage.getItem(TRIVIA_KEY) || 'null'); if (v && Array.isArray(v.questions) && v.questions.length) setTriviaBank(v); } catch (e) { /* no copy kept */ }
  const url = (window.TTT_FIREBASE && window.TTT_FIREBASE.triviaUrl) || 'trivia.json';
  try {
    fetch(url, { cache: 'no-cache' }).then(r => (r.ok ? r.json() : null)).then(v => {
      if (!v || !Array.isArray(v.questions) || !v.questions.length) return;
      const had = triviaReady();
      setTriviaBank(v);
      try { localStorage.setItem(TRIVIA_KEY, JSON.stringify(v)); } catch (e) { /* too big for this browser's storage: fetched again next visit */ }
      if (!had && state.screen === 'setup') render();
    }).catch(() => {});
  } catch (e) { /* offline: as last kept */ }
}
const TRIVIA_CARD = '<div class="tqc"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 9a3.5 3.5 0 1 1 5 3.2c-1 .5-1.5 1.3-1.5 2.3" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/><circle cx="12" cy="18.5" r="1.5" fill="currentColor"/></svg></div>';   // the question card
export function miniature(mini, final) {   // the question card, both players' progress, and the question's options: those still standing, the crossed-out ones dimmed and struck
  const t = tune(mini), n = mini.ask ? (Array.isArray(mini.ask.opts) ? mini.ask.opts.length : mini.ask.n || t.opts) : t.opts, out = new Set(mini.crossed || []);
  if (mini.race) {                                                                     // a race: each player's wrong tries and a tick once they are right (their shapes; nobody's picks)
    const row = p => { const sh = shapeOf(mini, p), k = sh.n || 0; return `<div class="tr ${p}" style="--n:${n - 1}"><b class="${p}">${p}</b>${Array.from({ length: n - 1 }, (_, j) => `<i class="${j < k ? 'no' : ''}"></i>`).join('')}<em class="tqok${sh.right ? ' on' : ''}">${TICK}</em></div>`; };
    return `<div class="tart trv tqrm" aria-label="Trivia race: ${['X', 'O'].map(p => `${p} ${shapeOf(mini, p).right ? 'got it' : `${shapeOf(mini, p).n || 0} wrong`}`).join(', ')}"><div class="tpic" aria-hidden="true">${TRIVIA_CARD}</div><div class="tpip">${row('X')}${row('O')}</div></div>`;
  }
  return `<div class="tart trv" aria-label="Trivia: X ${mini.right.X}, O ${mini.right.O} of ${t.goal}"><div class="tpic" aria-hidden="true">${TRIVIA_CARD}</div><div class="tpip">${pipRows(mini.right, t.goal)}</div><div class="topts" aria-label="${n - out.size} of ${n} answers left">${Array.from({ length: n }, (_, k) => `<i class="${out.has(k) ? 'out' : ''}"></i>`).join('')}</div></div>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = triviaTable(mini, a, { view, locked, turn, zoom: state.zoom, done: !!d, dby: d ? d.by : null }); return g;
}
export function moveText(f, who) {
  if (f.race && !f.trivia) return f.race.correct ? `${who} answered right` : `${who} answered wrong${f.race.auto ? ' (out of time)' : ''}${f.race.n ? ` · ${f.race.n} wrong so far` : ''}`;   // the other side's pick in a race: right or wrong alone
  return f.trivia ? (f.trivia.correct ? `${who} answered right` : `${who} answered wrong · crossed out`) : `${who} answered`;
}
export function sounds(f, add, won, mini, last) {
  const t = f.trivia || f.race; if (!t) return;                             // (a race: the other side's move is its shape alone, right or wrong)
  const pre = triviaPre(f); if (pre && t.fresh) add('reveal', TRIVIA.flip - 350); if (pre && !t.auto && (f.trivia ? f.trivia.picked >= 0 : true)) add('tap', pre); add(t.correct ? 'ding' : 'thud', pre + 250); return;
}
// Trivia: the question turned up for both; from now the player answers it this turn
export function triviaRevealAct(el, e, act) {
  const i = state.zoom, sq = state.squares[i];
  if (!sq || sq.mini.type !== 'trivia' || sq.owner || sq.mini.shown || state.flash || state.done || blocked()) return;
  if (state.online && !state.sc) { dbReveal(i); return; }
  if (!triviaReveal(state, i, state.turn).ok) return;
  triviaFlip = { sq: i, at: performance.now() }; SND.play('reveal');
  commit();
}
// Its own controls (data-act): the page's click handler hands them here.
export const actions = { 'trivia-reveal': triviaRevealAct };

// Setters for the names other modules reassign (an imported name is read-only there).
export function setTriviaFlip(v) { triviaFlip = v; }
