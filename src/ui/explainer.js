// The "?" explainer pop-up and How to Play (each game's meta.js: explainer).
import { dealOpts, startPractice } from '../core/match.js';
import { isRace, raceDealt } from '../core/race.js';
import { shipWords } from '../games/bs/meta.js';
import { other } from '../core/util.js';
import { acct, loggedIn } from '../net/accounts.js';
import { closeIntro, showSides } from '../net/matchmaking.js';
import { pigConfig, pigGoal } from '../games/pig/rules.js';
import { wheelsConfig } from '../games/wheels/rules.js';
import { tune, tuneLive } from '../core/tune.js';
import { PHYS_TYPES } from '../games/shared/physics.js';
import { GAMES, SC_ONLY } from '../games/index.js';
import { SUPER_CHAOS_ENABLED } from '../core/config.js';
import { privacyUrl } from '../net/platform.js';
import { testBadge, visibleTypes } from '../net/releases.js';
import { RNG, app, commit, flashTimer, holdTimer, setFlashTimer, setHoldTimer, setMenuOpen, setMenuStep, setSpotTimer, spotTimer, state } from './app.js';
import { CHEV, ICONS, toon } from './art.js';
import { hashSvg } from './hash.js';
import { burstSvg, fxAt, fxAttr, startFx } from './fx.js';
import { render } from './render.js';
import { repStop } from './replay.js';
import { cutHaptics } from './haptics.js';
import { SND } from '../audio/sound.js';
import { chaosSetup } from './screens/setup.js';
import { renderWin } from './screens/win.js';
import { CICON, smallPanel } from './comic.js';
import { cpuStop, scheduleCpu } from './turns.js';

/* ----- explainers: the rules in short, from the "?" in a mini-game, the game list, or How to Play ----- */
const RULES_CORE = [
  'Tic-tac-toe, where every square is its own mini-game. Win it to claim the square.',
  'On your turn, make one move in any square.',
  'Three squares in a row wins the match. No line left for anyone? A draw.',
];
export const EXPLAIN = Object.fromEntries(Object.keys(GAMES).map(t => [t, GAMES[t].meta.explainer]));
// Super Chaos: the mode's own explainer (its switch on the setup screen), and a game's Super Chaos rules where they differ.
const SC_EXPLAIN = { name: 'Super Chaos', play: "Both players move at the same time. Each round, pick any square and make one move. When you're both done (or time runs out), you'll see what your opponent did. If both players win the same square in the same round, it resets. Run out of time and you miss the round; miss two in a row and you lose.", win: 'Three in a row wins.' };   // (against the computer and online alike)
// The Mode selector's "?": the two modes, one plain line each.
const MODE_EXPLAIN = { name: 'Mode', lines: [['Super Chaos', 'X and O move at the same time.'], ['Classic', 'X goes first, then you take turns.']] };
// The host's Timer "?" (ui/screens/setup.js timerRows): the match clock, one plain paragraph.
const TIMER_EXPLAIN = { name: 'Timer', text: 'Minutes each player has for the whole game. +5s is added after each move. Run out of time and you lose.' };
const CLOCK_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/></svg>';
const SC_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linejoin="round"><path d="M13.5 2 5 13.5h6L9.5 22 19 9.5h-6z"/></svg>';
const scNow = () => !!(state.sc && ['board', 'mini'].includes(state.screen)) || (state.screen === 'setup' && chaosSetup());
// Race mode (core/race.js): the open square's own mode, else the mode the game would be dealt in now (never on a shared phone).
const raceNow = t => { const sq = state.screen === 'mini' && state.squares && state.squares[state.zoom]; if (sq && sq.mini && sq.mini.type === t) return isRace(sq.mini); return raceDealt(t, dealOpts(state)); };
export function explainOf(t) {
  if (t === 'superchaos') return SC_EXPLAIN;
  if (t === 'mode') return MODE_EXPLAIN;
  if (t === 'timer') return TIMER_EXPLAIN;
  return fillTune(t, (scNow() && GAMES[t] && GAMES[t].meta.scExplainer) || (GAMES[t] && GAMES[t].meta.raceExplainer && raceNow(t) && GAMES[t].meta.raceExplainer) || EXPLAIN[t]);
}
// A setting in the text ({k}: meta.js TUNE, or a game's own config named in its EXPLAIN_KEYS): the square's own
// value when it is open, else the one dealt now.
const CFG_KEYS = { bs: (mini) => ({ shipLen: shipWords(mini && mini.len ? mini.len : tuneLive('bs').len) }), pig: (mini) => ({ target: mini ? pigGoal(mini) : pigConfig().target }), wheels: (mini) => ({ target: mini ? mini.target : wheelsConfig().target }) };   // Risky Rolls' target (config/pig), Risky Spins' (config/wheels)
function fillTune(t, x) {
  if (!x || !x.play || !/\{\w+\}/.test(x.play + x.win)) return x;
  const sq = state.screen === 'mini' && state.squares && state.squares[state.zoom], open = sq && sq.mini && sq.mini.type === t ? sq.mini : null;
  const v = Object.assign({}, CFG_KEYS[t] ? CFG_KEYS[t](open) : {}, open ? tune(open) : tuneLive(t));
  const ga = GAMES[t] && GAMES[t].meta.goAgainText;   // {goAgain}: the game's words for "Go again on success" on or off (core/tune.js AGAIN_TUNE)
  if (ga) v.goAgain = v.again === 'on' ? ga.on : ga.off;
  const ev = GAMES[t] && GAMES[t].meta.evenText;      // {evenText}: Bowling's words for "Equal rolls" on or off (its TUNE `even`)
  if (ev) v.evenText = v.even === 'on' ? ev.on : ev.off;
  const f = s => s.replace(/\{(\w+)\}/g, (m, k) => (v[k] != null ? String(v[k]) : m));
  return { name: x.name, play: f(x.play), win: f(x.win) };
}
// A game's list under Play and Win (meta.js explainerList: { key: 'Label: meaning' }, e.g. Dice Combo's combos).
const exList = t => { const l = GAMES[t] && GAMES[t].meta.explainerList; if (!l) return ''; return `<ul class="exlist">${Object.values(l).map(v => { const i = v.indexOf(': '); return `<li>${i > 0 ? `<b>${v.slice(0, i)}</b> ${v.slice(i + 2)}` : v}</li>`; }).join('')}</ul>`; };
export let explainT = null;                          // the mini-game whose explainer is open
export const qBtn = (t, cls) => `<button class="qbtn${cls ? ' ' + cls : ''}" data-act="explain" data-t="${t}" aria-label="How to play ${explainOf(t).name}">${cls === 'sm' ? '<i>?</i>' : '?'}</button>`;   // the small one: a 26px sticker in a 40px tap target
const CAT_LABEL = { luck: 'More luck', skill: 'More skill', brain: 'More brain' };   // a game's kind (meta.js category), at the top of its "?"
export function renderExplain() {
  const x = explainT && explainOf(explainT);
  if (!x) return '';
  return `<div class="explain" data-act="explain-close" role="dialog" aria-modal="true" aria-label="How to play ${x.name}"${fxAttr(fxAt('explain', explainT))}><div class="excard">
    <p class="excat">${GAMES[explainT] && CAT_LABEL[GAMES[explainT].meta.category] || '&nbsp;'}</p>
    <h2>${explainT === 'timer' ? CLOCK_ICON : explainT === 'superchaos' || explainT === 'mode' ? SC_ICON : ICONS[explainT]}<span>${x.name}</span></h2>
    ${x.text ? `<p class="exline wide"><span>${x.text}</span></p>` : x.lines ? x.lines.map(([k, v]) => `<p class="exline wide"><b>${k}</b><span>${v}</span></p>`).join('') : `<p class="exline play"><b>Play</b><span>${x.play}</span></p>
    <p class="exline win"><b>Win</b><span>${x.win}</span></p>${exList(explainT)}`}
    ${practiceOffered(explainT) ? `<button class="btn practice" data-act="practice" data-t="${explainT}">Practice</button>` : ''}
    <small>Tap anywhere to close</small></div></div>`;
}
/* ----- Practice (How to Play): one mini-game alone against the computer on Easy -----
 * Each game's explainer opened from How to Play (and the practice match's own end screen) has a Practice button: a Play
 * Computer match of that mini-game alone, every square that game, the player's side drawn, the computer on Easy
 * (core/match.js startPractice: state.practice = { type }), with the side reveal as every match. While it runs, a Back to
 * How to Play stands where Menu does on the board and in the square (ui/turnbar.js, practiceBack); tapping it ends the
 * match with nothing recorded (no loss, no stats, no history: net/tracking.js skips a practice match) and opens How to
 * Play at that game's explainer. The match's end shows the usual result screen with Practice again and Back to How to
 * Play alone (renderPracticeEnd, ui/render.js). A practice match is never restored (ui/app.js load, freshVisit). */
const practiceOffered = t => !!(GAMES[t] && !SC_ONLY.includes(t) && visibleTypes().includes(t) && (state.screen === 'howto' || (state.screen === 'win' && state.practice)));
export const practiceName = () => (loggedIn() && acct.profile.username) || 'You';
export function practiceStart(t) {
  if (!GAMES[t] || !visibleTypes().includes(t)) return false;
  closeExplain(true);
  closeIntro();
  const human = startPractice(state, RNG, t, practiceName());
  if (!human) return false;
  const n = p => { const v = state.setup.names[p]; return v && v !== p ? v : p; };
  showSides({ X: { name: n('X') }, O: { name: n('O') } }, human);   // the side reveal, as every match opens (net/matchmaking.js)
  commit();
  return true;
}
// The header's top-left in a practice match (ui/turnbar.js, in Menu's place): Back to How to Play, always there.
export function practiceBack() {
  if (!state.practice || !['board', 'mini'].includes(state.screen)) return '';
  if (state.practice.test) return `<button class="menubtn pback" data-act="test-back" aria-label="Back to the admin page">${CHEV}<span>Back to admin</span></button>`;   // (the admin's Test play: ui/sandbox.js)
  return `<button class="menubtn pback" data-act="practice-back" aria-label="Back to How to Play">${CHEV}<span>Back to How to Play</span></button>`;
}
// Back to How to Play: the practice match ends here, whatever its state, with nothing recorded, and How to Play opens at
// the game's explainer (the entry brought into view).
export function practiceEnd() {
  const p = state.practice;
  if (!p) { state.screen = 'howto'; commit(); return; }
  cpuStop();                                                    // everything of the match stops at once: the computer (its timer and its thinking),
  clearTimeout(spotTimer); setSpotTimer(null);                  // the glow, the move and its hold, a replay, the side reveal,
  clearTimeout(flashTimer); setFlashTimer(null);
  clearTimeout(holdTimer); setHoldTimer(null); repStop(); closeIntro();
  SND.cut(); cutHaptics();                                      // every sound of a move or replay still playing or to come, and the buzzes
  setMenuOpen(false); setMenuStep('main');
  state.flash = null; state.done = null; state.spot = null; state.lock = null; state.confirm = null; state.notice = null; state.stamp = null; state.drawStamp = null;
  state.practice = null; state.quick = false; state.stats = null;   // (left part way: the match simply stops, no result of anyone's; nothing is sent anywhere, net/tracking.js)
  state.screen = 'howto'; state.zoom = null;
  commit();
  openExplain(p.type);
  const row = app.querySelector && app.querySelector(`.howlist [data-act="explain"][data-t="${p.type}"]`);
  if (row && typeof row.scrollIntoView === 'function') try { row.scrollIntoView({ block: 'center' }); } catch (e) { /* (an old browser: the explainer is open anyway) */ }
}
// The practice match's end: the result screen as every match's (ui/screens/win.js), its buttons Practice again and Back
// to How to Play alone (no rematch, no main menu, no share).
export function renderPracticeEnd() {
  const t = state.practice && state.practice.type;
  if (state.practice && state.practice.test) {                   // the admin's Test play (ui/sandbox.js): the result, then back to the admin page by itself
    const tr = `<div class="endgo"><button class="pn y big" data-act="test-again" style="--k:6"><b>Play again</b><small>same game, same settings</small></button></div><div class="ccsmall endsmall">${smallPanel('test-back', CICON.home, 'Back to admin', { k: 7 })}</div>`;
    return renderWin(tr);
  }
  const row = `<div class="endgo"><button class="pn y big" data-act="practice" data-t="${t}" style="--k:6"><b>Practice again</b><small>another go</small></button></div><div class="ccsmall endsmall">${smallPanel('practice-back', CICON.help, 'How to play', { k: 7, aria: 'Back to How to Play' })}</div>`;
  return renderWin(row);
}
// Opened and closed in place: the screen underneath is not drawn again (no scroll jump, no move used).
export function openExplain(t) {
  if (!explainOf(t)) return;
  closeExplain(true);
  explainT = t;
  startFx('explain', t);
  app.insertAdjacentHTML('beforeend', renderExplain());
  scheduleCpu();
}
export function closeExplain(quiet) {
  const el = app.querySelector('.explain');
  if (el) el.remove();
  if (!explainT) return;
  explainT = null;
  if (!quiet) scheduleCpu();
}
// How to Play (Comic Chaos, calm): the three core rules as three drawn comic panels (information: flat frames, no
// shadow or skew), then every mini-game as a tappable tile (a panel: its "?" rules), then the credits.
const HOW_PICS = ['ttt', 'c4', 'pig', 'bs', 'memory', 'hilo', 'coins', 'snakes', 'wordle'];
function howPanels() {
  const sq = (inner, cls = '') => `<i class="hsq${cls ? ' ' + cls : ''}">${inner}</i>`;
  const p1 = `<div class="hwgrid" aria-hidden="true">${HOW_PICS.map((t, i) => sq(ICONS[t] || '', i === 4 ? 'lit' : '')).join('')}${hashSvg('hash', 9)}</div>`;
  const p2 = `<div class="hduo" aria-hidden="true"><span class="hme">${toon('X')}</span><div class="hwgrid sm">${Array.from({ length: 9 }, (_, i) => sq('', i === 2 ? 'tap' : '')).join('')}${hashSvg('hash', 9)}</div></div>`;
  const p3 = `<div class="hwgrid sm win" aria-hidden="true">${Array.from({ length: 9 }, (_, i) => sq([0, 4, 8].includes(i) ? toon('X') : i === 2 || i === 3 ? toon('O') : '')).join('')}${hashSvg('hash', 9)}<span class="hwinb">${burstSvg('WIN!', 'w', 120, 70, 30)}</span></div>`;
  const panel = (n, pic, text, cls) => `<figure class="cpanel ${cls}" style="--k:${n}"><figcaption class="cap">${n}</figcaption>${pic}<p>${text}</p></figure>`;
  return `<div class="cpanels">${panel(1, p1, RULES_CORE[0], 'wide')}${panel(2, p2, RULES_CORE[1], 'half')}${panel(3, p3, RULES_CORE[2], 'half')}</div>`;
}
export function renderHowTo() {
  return `<main class="scr setup howto-scr cc calm">
    <div class="bar"><button class="back" data-act="menu" aria-label="Back to the main menu">${CHEV}Menu</button>
      <div class="ttl"><b>How to Play</b></div></div>
    <div class="setup-box" data-keep-scroll="howto">
      ${howPanels()}
      ${SUPER_CHAOS_ENABLED ? `<div class="games-h"><span>Modes</span><small>Tap for its rules</small></div>
      <div class="games howlist"><button class="pn gt w" data-act="explain" data-t="superchaos" aria-label="How to play Super Chaos"><i class="gic">${SC_ICON}</i><b>Super Chaos</b></button></div>` : ''}
      <div class="games-h"><span>Mini-games</span><small>Tap one for its rules</small></div>
      <div class="games howlist">${visibleTypes().filter(t => SUPER_CHAOS_ENABLED || !SC_ONLY.includes(t)).map(t => `<button class="pn gt w" data-act="explain" data-t="${t}" aria-label="How to play ${EXPLAIN[t].name}"><i class="gic">${ICONS[t]}</i><b>${EXPLAIN[t].name.replace(/\//g, '/<wbr>')}</b>${testBadge(t)}</button>`).join('')}</div>
      <div class="games-h"><span>Credits</span></div><div class="rulecard credits">${visibleTypes().includes('trivia') ? '<p>Trivia questions from the <a href="https://opentdb.com" target="_blank" rel="noopener noreferrer">Open Trivia Database</a>, opentdb.com, <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a>.</p>' : ''}${visibleTypes().some(t => PHYS_TYPES.includes(t) || t === 'pinball') ? '<p>Mini Golf, Pool, Bowling and Pinball run on <a href="https://brm.io/matter-js" target="_blank" rel="noopener noreferrer">Matter.js</a> (MIT licence).</p>' : ''}${visibleTypes().includes('wtiles') ? '<p>Word Tiles checks its words against the ENABLE word list (public domain).</p>' : ''}<p>Fonts: Luckiest Guy, Patrick Hand, Bangers and Comic Neue (SIL Open Font License).</p><p class="priv">What the game keeps about you, and how to delete your account: <a href="${privacyUrl()}" target="_blank" rel="noopener noreferrer">Privacy policy</a></p></div>
    </div></main>`;
}
