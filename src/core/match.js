// Setting up a match: the setup screen's choices, names and sides, the nine squares, a new match.
import { newMini } from './minis.js';
import { needRng, randInt } from './random.js';
import { newTimer, normTimer } from './timer.js';
import { other } from './util.js';
import { levelOf } from './aiw.js';
import { PHYSICS, PHYS_TYPES, physicsReady } from '../games/shared/physics.js';
import { markCoins } from '../games/coins/rules.js';
import { triviaDeal, triviaReady } from '../games/trivia/rules.js';
import { SC_ONLY, TYPES } from '../games/index.js';

export const NAME_MAX = 12;
export function pickType(games, rng) { return games[randInt(rng, games.length)]; }
export function newSquare(games, rng) { return { owner: null, mini: newMini(pickType(games, rng), rng) }; }
// The nine starting squares: nine different games when the match has nine or more to deal from (fewer:
// each square any of them, as ever).
export function dealNine(games, rng) {
  if (games.length < 9) return Array.from({ length: 9 }, () => newSquare(games, rng));
  const bag = games.slice();
  return Array.from({ length: 9 }, () => ({ owner: null, mini: newMini(bag.splice(randInt(rng, bag.length), 1)[0], rng) }));
}
// A reset square's new game, from the match's list (pool): first one not yet used this match (dealt at
// the start, played, or on the board now), then one not on the board now (the open squares and the one
// resetting), then one not on the other open squares, then any.
export function pickReset(state, pool, rng, at) {
  const sqs = state.squares || [], old = sqs[at] && sqs[at].mini ? sqs[at].mini.type : null;
  const open = new Set(sqs.filter((q, k) => k !== at && q && !q.owner && q.mini).map(q => q.mini.type));
  const used = new Set((state.sqlog || []).map(e => e.t).concat(sqs.filter(q => q && q.mini).map(q => q.mini.type)));
  const tiers = [pool.filter(t => !used.has(t)), pool.filter(t => !open.has(t) && t !== old), pool.filter(t => !open.has(t)), pool];
  return pickType(tiers.find(x => x.length), rng);
}
export const CPU_NAME = 'Computer';
export function defaultSetup() {
  const games = {};
  for (const t of TYPES) games[t] = true;
  return { names: { X: 'X', O: 'O' }, games, mode: 'two', human: 'X', timer: 0, players: { X: 'human', O: 'human' } };   // players: who plays each side locally   // mode: 'two' players, 'cpu' or 'online'; human: the side a person plays; timer: seconds per online turn, 0 = no limit
}
// The side(s) the computer plays in a local match: 'X', 'O', 'XO' (it plays both and a person watches) or null.
export function cpuSide(setup) {
  if (!setup || setup.mode === 'online') return null;
  if (setup.players) return ['X', 'O'].filter(p => setup.players[p] === 'cpu').join('') || null;
  return setup.mode === 'cpu' ? other(setup.human === 'O' ? 'O' : 'X') : null;   // a setup from before the Human/Computer slots
}
// Older setups said "vs Computer, you play X"; now each side is a Human or Computer slot.
export function normSetup(setup) {
  if (!setup.players || typeof setup.players !== 'object') {
    const cpu = setup.mode === 'cpu' ? other(setup.human === 'O' ? 'O' : 'X') : null;
    setup.players = { X: cpu === 'X' ? 'cpu' : 'human', O: cpu === 'O' ? 'cpu' : 'human' };
  }
  for (const p of ['X', 'O']) if (setup.players[p] !== 'cpu') setup.players[p] = 'human';
  if (setup.mode === 'cpu') setup.mode = 'two';
  return setup;
}
// Keep the computer's default name in step with the mode and side: the computer's side is called
// "Computer" unless someone typed a name for it, and a side that stops being the computer drops it.
export function syncNames(setup) {
  const cpu = cpuSide(setup) || '';
  for (const p of ['X', 'O']) {
    const n = String(setup.names[p] || '').trim();
    if (cpu.includes(p)) { if (!n || n === p) setup.names[p] = CPU_NAME; }
    else if (n === CPU_NAME) setup.names[p] = p;
  }
}
// Play Local: player 1 is always a person, who picks X, O or Random; player 2 is a person or the
// computer and takes the other side, at a level (Easy, Normal or Hard). Kept as setup.local { pick, p2, n1, n2, level }; an older setup (a
// Human or Computer on each side) is read into it, with the computer, if any, as player 2.
export function normLocal(setup) {
  let L = setup.local;
  if (!L || typeof L !== 'object') {
    const pl = setup.players || {}, nm = setup.names || {};
    const s1 = pl.X === 'cpu' && pl.O !== 'cpu' ? 'O' : 'X', s2 = other(s1);
    const keep = (n, p) => { n = String(n || '').trim(); return n === p || n === CPU_NAME ? '' : n.slice(0, NAME_MAX); };
    L = { pick: s1, p2: pl[s2] === 'cpu' ? 'cpu' : 'human', n1: keep(nm[s1], s1), n2: keep(nm[s2], s2) };
  }
  setup.local = {
    pick: ['X', 'O', 'random'].includes(L.pick) ? L.pick : 'X', p2: L.p2 === 'cpu' ? 'cpu' : 'human',
    n1: String(L.n1 || '').slice(0, NAME_MAX), n2: String(L.n2 || '').slice(0, NAME_MAX), level: levelOf(L.level),
  };
  return setup.local;
}
// Seat the two players for the next local match (Random is drawn again every time): the sides, who
// plays them and their names (a blank name is the side's letter; the computer's is Computer).
export function seatLocal(setup, rng) {
  const L = normLocal(setup);
  const s1 = L.pick === 'random' ? (randInt(needRng(rng), 2) ? 'O' : 'X') : L.pick, s2 = other(s1);
  setup.mode = 'two'; setup.human = s1;
  setup.players = { X: 'human', O: 'human' }; setup.players[s2] = L.p2;
  setup.names = { X: 'X', O: 'O' };
  setup.names[s1] = L.n1.trim() || s1;
  setup.names[s2] = L.n2.trim() || (L.p2 === 'cpu' ? CPU_NAME : s2);
  setup.level = L.level;
  return s1;
}
export function enabledGames(setup) { return TYPES.filter(t => setup && setup.games && setup.games[t]); }
export function playerName(state, p) { return (state.setup && state.setup.names && state.setup.names[p]) || p; }
// The whole app state. It opens on the setup screen; startMatch turns it into a match.
export function newState(rng) {
  rng = needRng(rng);
  return {
    v: 4,
    screen: 'menu',           // 'menu' | 'setup' | 'board' | 'mini' | 'win'
    setup: defaultSetup(),    // player names and the mini-games allowed; kept from match to match
    games: TYPES.slice(),     // the mini-games the current match draws from (squares and resets)
    turn: 'X',
    cpu: null,                // the side(s) the computer plays in this match: 'X', 'O', 'XO', or null for two people
    cpuLevel: null,           // ...and how well: 'easy', 'normal' or 'hard' (core/aiw.js)
    endPick: null,            // the match-end message picked for this match (so it does not change on screen)
    online: null,             // { role: 'host' | 'guest', code, me, name, joined } while playing over the network
    timer: newTimer(0),       // the online turn clock: limit in seconds (0 = none), deadline, timeouts per player
    spot: null,               // { square, by, label }: the square the other player is about to play in, shown before the zoom
    squares: dealNine(TYPES.filter(t => !SC_ONLY.includes(t)), rng),
    zoom: null,               // index of the mini-game being viewed
    flash: null,              // the move just made: its result, while the animation and toast play
    done: null,               // the move just made, kept on show until the player heads back to the board (that is when the turn passes)
    stamp: null,              // square whose owner's mark stamps in on the board (just claimed)
    lock: null,               // square the current player must keep playing (Hangman bonus guess, Risky Rolls turn)
    draft: '',                // letters typed so far (Wordle)
    pick: null,               // first card chosen (Memory)
    pickSq: null,             // ...and the square it belongs to
    sel: [],                  // coins chosen so far (Coin flip)
    confirm: null,            // 'new' while the "abandon this match?" card is up
    notice: null,             // short message over the Wordle keyboard ("Not a word")
    winner: null, winLine: null, winReason: null, counts: null,
    lastSquare: null, lastBy: null, moves: 0,
    sqlog: [],                // every mini-game that ended this match: { t: type, end: 'won' | 'draw', w: winner, X, O: turns each side spent in it }
  };
}
// Start a match from the setup screen: tidy the names, draw nine squares from the ticked games.
// Returns false (and changes nothing) when no mini-game is ticked.
// A game that can be dealt right now (sc: in a Super Chaos match; a Super Chaos only game never in another): Trivia only once its questions are in (trivia.json: the page
// fetches it, the server has it as a file); without them a Trivia square could never be played.
export const dealable = (t, sc) => (!sc && SC_ONLY.includes(t) ? false : t === 'trivia' ? triviaReady() : PHYS_TYPES.includes(t) || t === 'pinball' ? physicsReady() && !!PHYSICS.lib.PIN : true);
export function startMatch(state, rng, only) {   // only: the games this kind of match may deal (Super Chaos's)
  rng = needRng(rng);
  const games = enabledGames(state.setup).filter(t => dealable(t, !!only)).filter(t => !only || only.includes(t));
  if (!games.length) return false;
  syncNames(state.setup);
  for (const p of ['X', 'O']) {
    const n = String(state.setup.names[p] || '').trim().slice(0, NAME_MAX);
    state.setup.names[p] = n || p;
  }
  state.games = games;
  normSetup(state.setup);
  state.cpu = cpuSide(state.setup);
  state.cpuLevel = state.cpu ? levelOf(state.setup.level) : null;
  state.endPick = null;                                       // the match-end message is picked afresh
  state.timer = newTimer(state.setup.mode === 'online' ? normTimer(state.setup.timer) : 0);
  state.spot = null;
  state.squares = dealNine(games, rng);
  for (const sq of state.squares) if (sq.mini.type === 'trivia') triviaDeal(state, sq, rng);   // a question each, no two squares alike
  state.screen = 'board'; state.turn = 'X';
  state.zoom = null; state.flash = null; state.done = null; state.stamp = null; state.lock = null;
  state.draft = ''; state.pick = null; state.pickSq = null; state.sel = []; state.confirm = null; state.notice = null;
  state.winner = null; state.winLine = null; state.winReason = null; state.counts = null;
  state.lastSquare = null; state.lastBy = null; state.moves = 0; state.sqlog = [];
  state.sc = null;                                            // (a Super Chaos match: core/chaos.js, startChaos)
  markCoins(state, 'X', rng);
  return true;
}
// A started match in one call. setup may carry names and games (a map, or an array of the ticked types).
export function newMatch(rng, setup) {
  const st = newState(rng);
  if (setup && setup.names) Object.assign(st.setup.names, setup.names);
  if (setup && setup.mode) st.setup.mode = setup.mode;
  if (setup && setup.human) st.setup.human = setup.human;
  if (setup && setup.players) st.setup.players = Object.assign({}, setup.players);
  else if (setup && setup.mode === 'cpu') st.setup.players = null;   // the older "vs Computer" form: normSetup reads it
  normSetup(st.setup);
  if (setup && setup.timer != null) st.setup.timer = setup.timer;
  if (setup && setup.level) st.setup.level = setup.level;
  if (setup && Array.isArray(setup.games)) for (const t of TYPES) st.setup.games[t] = setup.games.includes(t);
  else if (setup && setup.games) Object.assign(st.setup.games, setup.games);
  startMatch(st, rng);
  return st;
}
