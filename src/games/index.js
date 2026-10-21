// Every mini-game, one line each: its rules, its AI and its meta (the page adds its view.js). The order is
// the menus' order and the random deal's; the retired games come last (older matches still play them).
// Adding a game: its folder (rules.js, ai.js, meta.js, view.js) and its line here.

export const GAMES = Object.create(null);   // type -> { type, rules, ai, meta, view }
const NONE = Object.freeze({});
export const rulesOf = t => (GAMES[t] ? GAMES[t].rules : NONE);
export const aiOf = t => (GAMES[t] ? GAMES[t].ai : NONE);
export const viewOf = t => (GAMES[t] && GAMES[t].view) || NONE;
import { registerTunes } from '../core/tune.js';
const add = (type, rules, ai, meta) => { GAMES[type] = { type, rules, ai, meta, view: null }; };
import * as tttR from './ttt/rules.js'; import * as tttA from './ttt/ai.js'; import * as tttM from './ttt/meta.js'; add('ttt', tttR, tttA, tttM);
import * as c4R from './c4/rules.js'; import * as c4A from './c4/ai.js'; import * as c4M from './c4/meta.js'; add('c4', c4R, c4A, c4M);
import * as bsR from './bs/rules.js'; import * as bsA from './bs/ai.js'; import * as bsM from './bs/meta.js'; add('bs', bsR, bsA, bsM);
import * as wordleR from './wordle/rules.js'; import * as wordleA from './wordle/ai.js'; import * as wordleM from './wordle/meta.js'; add('wordle', wordleR, wordleA, wordleM);
import * as hangmanR from './hangman/rules.js'; import * as hangmanA from './hangman/ai.js'; import * as hangmanM from './hangman/meta.js'; add('hangman', hangmanR, hangmanA, hangmanM);
import * as hexR from './hex/rules.js'; import * as hexA from './hex/ai.js'; import * as hexM from './hex/meta.js'; add('hex', hexR, hexA, hexM);
import * as hiloR from './hilo/rules.js'; import * as hiloA from './hilo/ai.js'; import * as hiloM from './hilo/meta.js'; add('hilo', hiloR, hiloA, hiloM);
import * as snakesR from './snakes/rules.js'; import * as snakesA from './snakes/ai.js'; import * as snakesM from './snakes/meta.js'; add('snakes', snakesR, snakesA, snakesM);
import * as memoryR from './memory/rules.js'; import * as memoryA from './memory/ai.js'; import * as memoryM from './memory/meta.js'; add('memory', memoryR, memoryA, memoryM);
import * as candyR from './candy/rules.js'; import * as candyA from './candy/ai.js'; import * as candyM from './candy/meta.js'; add('candy', candyR, candyA, candyM);
import * as bumpR from './bump/rules.js'; import * as bumpA from './bump/ai.js'; import * as bumpM from './bump/meta.js'; add('bump', bumpR, bumpA, bumpM);
import * as coinsR from './coins/rules.js'; import * as coinsA from './coins/ai.js'; import * as coinsM from './coins/meta.js'; add('coins', coinsR, coinsA, coinsM);
import * as pigR from './pig/rules.js'; import * as pigA from './pig/ai.js'; import * as pigM from './pig/meta.js'; add('pig', pigR, pigA, pigM);
import * as huntR from './hunt/rules.js'; import * as huntA from './hunt/ai.js'; import * as huntM from './hunt/meta.js'; add('hunt', huntR, huntA, huntM);
import * as mastermindR from './mastermind/rules.js'; import * as mastermindA from './mastermind/ai.js'; import * as mastermindM from './mastermind/meta.js'; add('mastermind', mastermindR, mastermindA, mastermindM);
import * as bjR from './bj/rules.js'; import * as bjA from './bj/ai.js'; import * as bjM from './bj/meta.js'; add('bj', bjR, bjA, bjM);
import * as busR from './bus/rules.js'; import * as busA from './bus/ai.js'; import * as busM from './bus/meta.js'; add('bus', busR, busA, busM);
import * as rlR from './rl/rules.js'; import * as rlA from './rl/ai.js'; import * as rlM from './rl/meta.js'; add('rl', rlR, rlA, rlM);
import * as bullseyeR from './bullseye/rules.js'; import * as bullseyeA from './bullseye/ai.js'; import * as bullseyeM from './bullseye/meta.js'; add('bullseye', bullseyeR, bullseyeA, bullseyeM);
import * as echoR from './echo/rules.js'; import * as echoA from './echo/ai.js'; import * as echoM from './echo/meta.js'; add('echo', echoR, echoA, echoM);
import * as plinkoR from './plinko/rules.js'; import * as plinkoA from './plinko/ai.js'; import * as plinkoM from './plinko/meta.js'; add('plinko', plinkoR, plinkoA, plinkoM);
import * as pongR from './pong/rules.js'; import * as pongA from './pong/ai.js'; import * as pongM from './pong/meta.js'; add('pong', pongR, pongA, pongM);
import * as triviaR from './trivia/rules.js'; import * as triviaA from './trivia/ai.js'; import * as triviaM from './trivia/meta.js'; add('trivia', triviaR, triviaA, triviaM);
import * as oddoneR from './oddone/rules.js'; import * as oddoneA from './oddone/ai.js'; import * as oddoneM from './oddone/meta.js'; add('oddone', oddoneR, oddoneA, oddoneM);
import * as dashR from './dash/rules.js'; import * as dashA from './dash/ai.js'; import * as dashM from './dash/meta.js'; add('dash', dashR, dashA, dashM);
import * as laneR from './lane/rules.js'; import * as laneA from './lane/ai.js'; import * as laneM from './lane/meta.js'; add('lane', laneR, laneA, laneM);
import * as golfR from './golf/rules.js'; import * as golfA from './golf/ai.js'; import * as golfM from './golf/meta.js'; add('golf', golfR, golfA, golfM);
import * as poolR from './pool/rules.js'; import * as poolA from './pool/ai.js'; import * as poolM from './pool/meta.js'; add('pool', poolR, poolA, poolM);
import * as bowlingR from './bowling/rules.js'; import * as bowlingA from './bowling/ai.js'; import * as bowlingM from './bowling/meta.js'; add('bowling', bowlingR, bowlingA, bowlingM);
import * as crapsR from './craps/rules.js'; import * as crapsA from './craps/ai.js'; import * as crapsM from './craps/meta.js'; add('craps', crapsR, crapsA, crapsM);
import * as takeoverR from './takeover/rules.js'; import * as takeoverA from './takeover/ai.js'; import * as takeoverM from './takeover/meta.js'; add('takeover', takeoverR, takeoverA, takeoverM);
import * as floodR from './flood/rules.js'; import * as floodA from './flood/ai.js'; import * as floodM from './flood/meta.js'; add('flood', floodR, floodA, floodM);
import * as seatingR from './seating/rules.js'; import * as seatingA from './seating/ai.js'; import * as seatingM from './seating/meta.js'; add('seating', seatingR, seatingA, seatingM);
import * as districtsR from './districts/rules.js'; import * as districtsA from './districts/ai.js'; import * as districtsM from './districts/meta.js'; add('districts', districtsR, districtsA, districtsM);
import * as shelvesR from './shelves/rules.js'; import * as shelvesA from './shelves/ai.js'; import * as shelvesM from './shelves/meta.js'; add('shelves', shelvesR, shelvesA, shelvesM);
import * as roadsR from './roads/rules.js'; import * as roadsA from './roads/ai.js'; import * as roadsM from './roads/meta.js'; add('roads', roadsR, roadsA, roadsM);
import * as flapR from './flap/rules.js'; import * as flapA from './flap/ai.js'; import * as flapM from './flap/meta.js'; add('flap', flapR, flapA, flapM);
import * as chopperR from './chopper/rules.js'; import * as chopperA from './chopper/ai.js'; import * as chopperM from './chopper/meta.js'; add('chopper', chopperR, chopperA, chopperM);
import * as patternsR from './patterns/rules.js'; import * as patternsA from './patterns/ai.js'; import * as patternsM from './patterns/meta.js'; add('patterns', patternsR, patternsA, patternsM);
import * as wheelsR from './wheels/rules.js'; import * as wheelsA from './wheels/ai.js'; import * as wheelsM from './wheels/meta.js'; add('wheels', wheelsR, wheelsA, wheelsM);
import * as sniffR from './sniff/rules.js'; import * as sniffA from './sniff/ai.js'; import * as sniffM from './sniff/meta.js'; add('sniff', sniffR, sniffA, sniffM);
import * as headcountR from './headcount/rules.js'; import * as headcountA from './headcount/ai.js'; import * as headcountM from './headcount/meta.js'; add('headcount', headcountR, headcountA, headcountM);
import * as flashR from './flash/rules.js'; import * as flashA from './flash/ai.js'; import * as flashM from './flash/meta.js'; add('flash', flashR, flashA, flashM);
import * as snapshotR from './snapshot/rules.js'; import * as snapshotA from './snapshot/ai.js'; import * as snapshotM from './snapshot/meta.js'; add('snapshot', snapshotR, snapshotA, snapshotM);
import * as skyhopR from './skyhop/rules.js'; import * as skyhopA from './skyhop/ai.js'; import * as skyhopM from './skyhop/meta.js'; add('skyhop', skyhopR, skyhopA, skyhopM);
import * as scoopR from './scoop/rules.js'; import * as scoopA from './scoop/ai.js'; import * as scoopM from './scoop/meta.js'; add('scoop', scoopR, scoopA, scoopM);
import * as pinballR from './pinball/rules.js'; import * as pinballA from './pinball/ai.js'; import * as pinballM from './pinball/meta.js'; add('pinball', pinballR, pinballA, pinballM);
import * as clashR from './clash/rules.js'; import * as clashA from './clash/ai.js'; import * as clashM from './clash/meta.js'; add('clash', clashR, clashA, clashM);
import * as diceR from './dice/rules.js'; import * as diceA from './dice/ai.js'; import * as diceM from './dice/meta.js'; add('dice', diceR, diceA, diceM);
import * as hexapawnR from './hexapawn/rules.js'; import * as hexapawnA from './hexapawn/ai.js'; import * as hexapawnM from './hexapawn/meta.js'; add('hexapawn', hexapawnR, hexapawnA, hexapawnM);
/* ===================== Game logic (pure, no DOM) =====================
 * Everything about a match lives in one plain object (see newMatch); the UI
 * only ever calls playMove / endFlash and re-renders from that object.
 */
export const TYPES = Object.keys(GAMES).filter(t => !GAMES[t].meta.retired);
// Release control: every mini-game is Released or Admin only. A game in TEST_TYPES is admin only until the
// admin's dashboard releases it (releases/{type} true in the database; false puts one back to admin only);
// everything else is released unless the database says otherwise. Admin-only games exist only for the
// admin: in their local matches and in friend games they host (their guest plays them in that match
// only); never in Find Match, nor anywhere for anyone else.
export const TEST_TYPES = TYPES.filter(t => GAMES[t].meta.release === 'admin');
// No longer dealt, still played to the end in older matches and shown in their history: the Dice race
// (Snakes and Ladders replaced it) and Hexapawn (taken out: with nobody obliged to move in a square,
// the best play was often not to move at all).
// Super Chaos only (meta.scOnly): a game made for simultaneous rounds (Clash Grid's collisions), never dealt in a normal match.
export const SC_ONLY = TYPES.filter(t => GAMES[t].meta.scOnly);
export const OLD_TYPES = Object.keys(GAMES).filter(t => GAMES[t].meta.retired);
export const INFO = Object.fromEntries(Object.keys(GAMES).map(t => [t, GAMES[t].meta.info]));
registerTunes(Object.fromEntries(Object.keys(GAMES).map(t => [t, GAMES[t].meta.TUNE])));   // each game's settings (meta.js TUNE; core/tune.js)
