// Trivia: the screen, the miniature, the move's words and sounds, and the inputs.
import { TRIVIA, setTriviaBank, triviaReady, triviaReveal } from './rules.js';
import { SND } from '../../audio/sound.js';
import { dbReveal } from '../../net/moves.js';
import { blocked } from '../../net/room.js';
import { N, REDUCED, commit, cpuPlays, esc, mv, state } from '../../ui/app.js';
import { KEY } from '../../ui/config.js';
import { fxAttr } from '../../ui/fx.js';
import { arcTally, lateAt, pips } from '../../ui/progress.js';
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
export function triviaPre(f) { return f && f.type === 'trivia' && f.trivia && !REDUCED && (state.online ? f.by !== state.online.me : cpuPlays(f.by)) ? (f.trivia.fresh ? TRIVIA.flip : 0) + TRIVIA.pause : 0; }   // someone else's pick: the reveal and the pause first
const triviaUp = mini => !!(mini.shown && mini.ask && mini.ask.q);
const TQBACK = `<div class="tqcard tqback" aria-label="The question, face down"><span aria-hidden="true">?</span><small>Trivia</small></div>`;
function triviaTable(mini, a, o) {
  const t = a && a.trivia ? a.trivia : null, l = mini.last, turn = o.turn, pre = t ? triviaPre(a) : 0, flipT = t && t.fresh && pre ? TRIVIA.flip : 0;
  const tal = p => arcTally(p, o, pips(p, Math.min(TRIVIA.goal, mini.right[p]), TRIVIA.goal, t && t.correct && a.by === p, pre + 250));
  const ask = triviaUp(mini) ? mini.ask : null, down = !!(mini.ask && !mini.shown);
  // what shows: the pick just made (fresh), else the one on show until heading back or when looking back, else the open question
  const pick = t || ((o.done || o.view) && l ? l : null);
  const shown = pick || ask;
  const W = p => `<b class="${p}">${N(p)}</b>`;
  if (!shown && down) {                                        // face down: Reveal (the player to move), or waiting
    const mine = !o.view && !o.locked;
    const note = mine ? '<p class="arcnote"></p>' : `<p class="arcnote">${o.view ? '' : `${W(turn)}'s turn · the question is face down`}</p>`;
    const btn = o.view ? '' : `<div class="cbtns one${mine ? '' : ' hold'}"><button class="big" data-act="trivia-reveal"${mine ? '' : ' disabled tabindex="-1" aria-hidden="true"'}>Reveal</button></div>`;
    return `<div class="g-arc"><div class="ctals">${tal('X')}${tal('O')}</div><div class="trivia">${TQBACK}${note}</div>${btn}</div>`;
  }
  if (!shown) return `<div class="g-arc"><div class="ctals">${tal('X')}${tal('O')}</div><div class="trivia"><p class="arcnote">No question here: the questions are still loading.</p></div></div>`;
  const crossed = new Set(pick ? (pick.crossed || []) : (mini.crossed || []));
  const letters = 'ABCD', late = pre ? ' late' : '';
  const opts = shown.opts.map((text, k) => {
    let cls = 'topt';
    if (crossed.has(k)) cls += ' out';                                    // crossed out before: struck through, not to be picked again
    else if (pick && k === pick.picked) cls += (pick.correct ? ' right' : ' wrong out fresh') + (t ? late : '');   // the pick: right glows; wrong shakes and is struck through (someone else's: when their pick comes)
    const st = pick && t && k === pick.picked ? ` style="--t:${pre + 250}ms"` : '';
    const dis = !!pick || o.locked || crossed.has(k);
    return `<button class="${cls}"${st} data-act="move" ${mv(k)}${dis ? ' disabled' : ''} aria-label="${letters[k]}: ${esc(text)}${crossed.has(k) || (pick && !pick.correct && k === pick.picked) ? ' (crossed out)' : ''}"><b>${letters[k]}</b><span>${esc(text)}</span></button>`;
  }).join('');
  const who = pick ? pick.by || (t && a.by) : turn, left = shown.opts.length - crossed.size;
  const res = t ? `<p ${lateAt('arcres ' + (t.correct ? 'ok' : 'no'), pre + 250)} role="status">${pre ? `${W(a.by)} ${t.correct ? 'got it right' : t.picked < 0 || t.auto ? 'ran out of time' : 'got it wrong'}` : t.correct ? 'Right!' : t.picked < 0 ? 'Time\'s up' : t.auto ? 'Time\'s up: one crossed out' : 'Wrong: crossed out'}</p>`
    : pick ? `<p class="arcres ${pick.correct ? 'ok' : 'no'}">${W(who)} ${pick.correct ? 'got it right' : 'got it wrong'}</p>`
    : `<p class="arcnote">${o.view ? '' : `${W(turn)}'s turn · ${left} option${left === 1 ? '' : 's'} left`}</p>`;
  const fl = !t && triviaFlip && triviaFlip.sq === o.zoom && performance.now() - triviaFlip.at < TRIVIA.flip + 200 ? triviaFlip.at : null;   // this phone's own reveal: the card turns up
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
export function miniature(mini, final) {   // both players' progress, and the question's options: those still standing, the crossed-out ones dimmed and struck
  const n = mini.ask ? (Array.isArray(mini.ask.opts) ? mini.ask.opts.length : mini.ask.n || TRIVIA.options) : TRIVIA.options, out = new Set(mini.crossed || []);
  return `<div class="tpip">${['X', 'O'].map(p => `<div class="tr ${p}"><b class="${p}">${p}</b>${Array.from({ length: TRIVIA.goal }, (_, k) => `<i class="${k < mini.right[p] ? 'on' : ''}"></i>`).join('')}</div>`).join('')}<div class="topts" aria-label="${n - out.size} of ${n} answers left">${Array.from({ length: n }, (_, k) => `<i class="${out.has(k) ? 'out' : ''}"></i>`).join('')}</div></div>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = triviaTable(mini, a, { view, locked, turn, zoom: state.zoom, done: !!d }); return g;
}
export function moveText(f, who) {
  return f.trivia ? (f.trivia.correct ? `${who} answered right` : `${who} answered wrong · crossed out`) : `${who} answered`;
}
export function sounds(f, add, won, mini, last) {
  const pre = triviaPre(f); if (pre && f.trivia && f.trivia.fresh) add('reveal', TRIVIA.flip - 350); if (pre && f.trivia && f.trivia.picked >= 0 && !f.trivia.auto) add('tap', pre); if (f.trivia) add(f.trivia.correct ? 'ding' : 'thud', pre + 250); return;
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
