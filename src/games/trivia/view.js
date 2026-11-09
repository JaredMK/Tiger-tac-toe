// Trivia: the screen, the miniature, the move's words and sounds, and the inputs.
import { TRIVIA, setTriviaBank, triviaReady, triviaReveal } from './rules.js';
import { SND } from '../../audio/sound.js';
import { dbReveal } from '../../net/moves.js';
import { blocked } from '../../net/room.js';
import { N, REDUCED, commit, cpuPlays, esc, mv, state } from '../../ui/app.js';
import { KEY } from '../../ui/config.js';
import { fxAttr } from '../../ui/fx.js';
import { arcTally, lateAt, pips } from '../../ui/progress.js';
import { pipRows } from '../../ui/thumbs.js';
import { tune } from '../../core/tune.js';
import { raceOld } from '../../core/race.js';
import { raceBoards, raceMe, raceThem, raceThumb } from '../../ui/race.js';
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
export function triviaPre(f) { const t = f && f.type === 'trivia' ? f.trivia : null; return t && !REDUCED && (state.online ? f.by !== state.online.me : cpuPlays(f.by)) ? (t.fresh ? TRIVIA.flip : 0) + TRIVIA.pause : 0; }   // someone else's pick: the reveal and the pause first 
const triviaUp = mini => !!(mini.shown && mini.ask && mini.ask.q);
const TQBACK = `<div class="tqcard tqback" aria-label="The question, face down"><span aria-hidden="true">?</span><small>Trivia</small></div>`;
function triviaTable(mini, a, o) {
  if (mini.race) return raceOld(mini) ? `<div class="g-arc"><div class="trivia"><p class="arcnote">This square is being dealt again.</p></div></div>` : triviaRace(mini, a, o);
  const turn = o.turn, part = mini;
  const t = a && a.trivia ? a.trivia : null, l = part.last;
  const pre = t ? triviaPre(a) : 0, flipT = t && t.fresh && pre ? TRIVIA.flip : 0;
  const goal = tune(mini).goal;   // (its settings: TUNE)
  const ask = triviaUp(mini) ? mini.ask : null, down = !!(mini.ask && !mini.shown);
  const tal = p => arcTally(p, o, pips(p, Math.min(goal, mini.right[p]), goal, t && t.correct && a.by === p, pre + 250));
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
  const crossed = new Set(pick ? (pick.crossed || []) : part.crossed || []);
  const letters = 'ABCD', late = pre ? ' late' : '';
  const opts = shown.opts.map((text, k) => {
    let cls = 'topt';
    if (crossed.has(k)) cls += ' out';                       // crossed out before: struck through, not to be picked again
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
// Race mode (core/race.js, `rv: 2`): each player their own questions. This phone's board large (its own question:
// Reveal, the options, its cross-outs, its score to the goal), the other player's small under it (their score as pips,
// their question face down or turned up, the question small with their cross-outs; never the right answer while it is
// open). Their move plays on their board from its flash (the card turned up if it was turned up then, a pause, the pick
// glowing or struck), the result in this board's reserved line. A finished square: both boards, every right answer shown.
const TQBACK_S = `<div class="trqback" aria-label="Face down"><span aria-hidden="true">?</span></div>`;
// p's question as this board shows it: { ask (turned up, or null), down, crossed, pick (a pick to draw), right (the right place, a finished square) }.
function racePart(mini, p, a, o) {
  const part = (mini.side && mini.side[p]) || {}, t = a && a.trivia && a.by === p ? a.trivia : null;
  if (t) return { ask: t, crossed: t.crossed || [], pick: t, flash: true };
  if (o.view) {                                                  // a finished square: their last question (turned up now), the right answer shown
    const ask = part.ask && part.ask.q ? part.ask : mini.tq && mini.tq[p] ? mini.tq[p] : part.last;
    const right = part.last && part.last.correct && ask && part.last.id === ask.id ? part.last.right : mini.tg && Number.isInteger(mini.tg[p]) ? mini.tg[p] : null;
    return { ask: ask && ask.q ? ask : null, crossed: part.last && ask && part.last.id === ask.id && part.last.correct ? part.last.crossed || [] : part.crossed || [], right };
  }
  if (o.done && o.dby === p && part.last) return { ask: part.last, crossed: part.last.crossed || [], pick: part.last };   // this phone's own pick, held until Board
  return { ask: part.shown && part.ask && part.ask.q ? part.ask : null, down: !!(part.ask && !part.shown), crossed: part.crossed || [] };
}
function triviaRace(mini, a, o) {
  const me = raceMe(), them = raceThem(), goal = tune(mini).goal, turn = o.turn;
  const t = a && a.trivia ? a.trivia : null, pre = t ? triviaPre(a) : 0, flipT = t && t.fresh && pre ? TRIVIA.flip : 0;
  const W = p => `<b class="${p}">${N(p)}</b>`, letters = 'ABCD';
  const tally = p => pips(p, Math.min(goal, mini.right[p]), goal, !!(t && t.correct && a.by === p), (a && a.by === p ? pre : 0) + 250);
  // this phone's board
  const mp = racePart(mini, me, a, o), myTurn = !o.view && turn === me;
  let body;
  if (!mp.ask && mp.down) {
    const can = myTurn && !o.locked;
    body = `<div class="trivia">${TQBACK}</div><div class="cbtns one${can ? '' : ' hold'}"><button class="big" data-act="trivia-reveal"${can ? '' : ' disabled tabindex="-1" aria-hidden="true"'}>Reveal</button></div>`;
  } else if (!mp.ask) body = `<div class="trivia"><p class="arcnote">No question here: the questions are still loading.</p></div>`;
  else {
    const crossed = new Set(mp.crossed), pick = mp.pick;
    const opts = mp.ask.opts.map((text, k) => {
      let cls = 'topt';
      if (crossed.has(k)) cls += ' out';
      else if (pick && k === pick.picked) cls += pick.correct ? ' right' : ' wrong out fresh';
      else if (mp.right === k) cls += ' right';
      const st = pick && mp.flash && k === pick.picked ? ' style="--t:250ms"' : '';
      const dis = !!pick || o.locked || !myTurn || crossed.has(k);
      return `<button class="${cls}"${st} data-act="move" ${mv(k)}${dis ? ' disabled' : ''} aria-label="${letters[k]}: ${esc(text)}${crossed.has(k) || (pick && !pick.correct && k === pick.picked) ? ' (crossed out)' : ''}"><b>${letters[k]}</b><span>${esc(text)}</span></button>`;
    }).join('');
    const fl = !t && triviaFlip && triviaFlip.sq === o.zoom && performance.now() - triviaFlip.at < TRIVIA.flip + 200 ? triviaFlip.at : null;   // this phone's own reveal: the card turns up
    body = `<div class="trivia"><div class="tqcard${fl != null ? ' tqturn' : ''}"${fl != null ? fxAttr(fl) : ''}><small>${esc(mp.ask.cat || 'Trivia')}</small><p>${esc(mp.ask.q)}</p></div><div class="topts">${opts}</div></div>`;
  }
  const left = mp.ask ? mp.ask.opts.length - new Set(mp.crossed).size : 0;
  const res = t && a.by === me ? `<p ${lateAt('arcres ' + (t.correct ? 'ok' : 'no'), 250)} role="status">${t.correct ? 'Right!' : t.picked < 0 ? 'Time\'s up' : t.auto ? 'Time\'s up: one crossed out' : 'Wrong: crossed out'}</p>`
    : t ? `<p ${lateAt('arcres ' + (t.correct ? 'ok' : 'no'), pre + 250)} role="status">${W(a.by)} ${t.correct ? 'got it right' : t.picked < 0 || t.auto ? 'ran out of time' : 'got it wrong'}</p>`
    : mp.pick ? `<p class="arcres ${mp.pick.correct ? 'ok' : 'no'}">${mp.pick.correct ? 'Right!' : 'Wrong: crossed out'}</p>`
    : `<p class="arcnote">${o.view ? '' : turn === me ? (mp.ask ? `Your turn · ${left} option${left === 1 ? '' : 's'} left` : 'Your turn') : `${W(turn)}'s turn`}</p>`;
  const mine = `<div class="g-arc trq"><div class="ctals col">${arcTally(me, o, tally(me))}</div>${body}${res}</div>`;
  // the other player's board
  const tp = racePart(mini, them, a, o), late = t && a.by === them;
  let theirs;
  if (!tp.ask) theirs = `<div class="trqopp">${TQBACK_S}<p class="trqq">${tp.down ? 'Not turned up yet' : ''}</p></div>`;
  else {
    const crossed = new Set(tp.crossed), pick = tp.pick, at = pre + 250;
    const chips = tp.ask.opts.map((text, k) => {
      let cls = 'trqo';
      if (crossed.has(k)) cls += ' out';
      else if (pick && k === pick.picked) cls += (pick.correct ? ' right' : ' wrong') + (late ? ' late' : '');
      else if (tp.right === k) cls += ' right';
      return `<i class="${cls}"${pick && late && k === pick.picked ? ` style="--t:${at}ms"` : ''}><b>${letters[k]}</b><span>${esc(text)}</span></i>`;
    }).join('');
    const q = `<div class="trqcard${flipT && late ? ' tqturn' : ''}"${flipT && late ? ` style="--t:${flipT - 350}ms"` : ''}><p class="trqq">${esc(tp.ask.q)}</p></div>`;
    const card = flipT && late ? `<div class="tqstack"><span class="tu" style="--u:${flipT - 350}ms">${TQBACK_S}</span><span class="tf" style="--f:${flipT - 350}ms">${q}</span></div>` : q;
    theirs = `<div class="trqopp up">${card}<div class="trqos${flipT && late ? ' tf' : ''}"${flipT && late ? ` style="--f:${flipT}ms"` : ''}>${chips}</div></div>`;
  }
  return raceBoards(mine, theirs, tally(them), { cls: 'trqb' });
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
// A race miniature: each player's progress, side by side: their right answers as pips to the goal, their question card
// (striped while face down) and its wrong tries as red marks (public: never a pick's place or the right answer).
function raceArt(mini, p, goal) {
  const part = (mini.side && mini.side[p]) || {}, n = part.ask ? (Array.isArray(part.ask.opts) ? part.ask.opts.length : part.ask.n || tune(mini).opts) : tune(mini).opts;
  const right = Math.min(goal, mini.right[p] || 0), wrong = (part.crossed || []).length, down = !!(part.ask && !part.shown), done = right >= goal;
  const gx = k => 20 + (k - (goal - 1) / 2) * 9, tx = k => 20 + (k - (n - 2) / 2) * 8;
  return `<svg class="trqm ${p}" viewBox="0 0 40 46" aria-hidden="true">${Array.from({ length: goal }, (_, k) => `<circle class="${k < right ? 'tqon' : ''}" cx="${gx(k)}" cy="5" r="3.6"/>`).join('')}`
    + `<rect class="tqc${down ? ' tqd' : ''}${done ? ' tqw' : ''}" x="8" y="13" width="24" height="18" rx="3"/>${done ? '<path class="tqk" d="M14 22.5l4 4 8-8.5"/>' : down ? '' : '<path class="tqq" d="M16.7 19.4a3.3 3.3 0 1 1 4.7 3c-.9.5-1.4 1.1-1.4 2"/><circle class="tqqd" cx="20" cy="27.4" r="1.1"/>'}`
    + `${done ? '' : Array.from({ length: n - 1 }, (_, k) => `<rect class="tqt${k < wrong ? ' tqno' : ''}" x="${tx(k) - 3}" y="36" width="6" height="6" rx="1.5"/>`).join('')}</svg>`;
}
export function miniature(mini, final) {   // the question card, both players' progress, and the question's options: those still standing, the crossed-out ones dimmed and struck
  const t = tune(mini), n = mini.ask ? (Array.isArray(mini.ask.opts) ? mini.ask.opts.length : mini.ask.n || t.opts) : t.opts, out = new Set(mini.crossed || []);
  if (mini.race) {                                                                     // a race: each player's score to the goal, their card and its wrong tries
    if (raceOld(mini)) return `<div class="tart trv" aria-label="Trivia"><div class="tpic" aria-hidden="true">${TRIVIA_CARD}</div></div>`;
    return raceThumb(p => raceArt(mini, p, t.goal), 'trqt', `Trivia race: ${['X', 'O'].map(p => `${p} ${mini.right[p]} of ${t.goal}`).join(', ')}`);
  }
  return `<div class="tart trv" aria-label="Trivia: X ${mini.right.X}, O ${mini.right.O} of ${t.goal}"><div class="tpic" aria-hidden="true">${TRIVIA_CARD}</div><div class="tpip">${pipRows(mini.right, t.goal)}</div><div class="topts" aria-label="${n - out.size} of ${n} answers left">${Array.from({ length: n }, (_, k) => `<i class="${out.has(k) ? 'out' : ''}"></i>`).join('')}</div></div>`;
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = triviaTable(mini, a, { view, locked, turn, zoom: state.zoom, done: !!d, dby: d ? d.by : null }); return g;
}
export function moveText(f, who) {
  return f.trivia ? (f.trivia.correct ? `${who} answered right` : `${who} answered wrong · crossed out`) : `${who} answered`;
}
export function sounds(f, add, won, mini, last) {
  const t = f.trivia; if (!t) return;
  const pre = triviaPre(f); if (pre && t.fresh) add('reveal', TRIVIA.flip - 350); if (pre && !t.auto && (f.trivia ? f.trivia.picked >= 0 : true)) add('tap', pre); add(t.correct ? 'ding' : 'thud', pre + 250); return;
}
// Trivia: the question turned up for both; from now the player answers it this turn
export function triviaRevealAct(el, e, act) {
  const i = state.zoom, sq = state.squares[i];
  const up = sq && (sq.mini.race ? !sq.mini.side || !sq.mini.side[state.turn] || sq.mini.side[state.turn].shown : sq.mini.shown);   // (a race: the player to move's own question)
  if (!sq || sq.mini.type !== 'trivia' || sq.owner || up || state.flash || state.done || blocked()) return;
  if (state.online && !state.sc) { dbReveal(i); return; }
  if (!triviaReveal(state, i, state.turn).ok) return;
  triviaFlip = { sq: i, at: performance.now() }; SND.play('reveal');
  commit();
}
// Its own controls (data-act): the page's click handler hands them here.
export const actions = { 'trivia-reveal': triviaRevealAct };

// Setters for the names other modules reassign (an imported name is read-only there).
export function setTriviaFlip(v) { triviaFlip = v; }
