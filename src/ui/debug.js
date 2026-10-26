// The page's names on window, as when the page was one script: the browser tests and the console read
// them (and the tests replace a few). Nothing in the game itself uses this.
import { endFlash, leaveSquare, mainResult, playMove } from '../core/board.js';
import { newMatch, startMatch } from '../core/match.js';
import { newMini, randomLegalMove } from '../core/minis.js';
import { makeRng } from '../core/random.js';
import { applyOnlineMove, fullState, hideMini, matchRecord, newOnlineMatch, packMatch, secretOf } from '../core/records.js';
import { armClock, newTimer } from '../core/timer.js';
import { other, r2, r3 } from '../core/util.js';
import { attMs } from '../games/shared/attention.js';
import { cardName } from '../games/shared/cards.js';
import { fingMs, fingRaw } from '../games/shared/finger.js';
import { PHYSICS, physicsReady } from '../games/shared/physics.js';
import { runSecs, runSpeed } from '../games/shared/runner.js';
import { bowlDraft, bowlNow, bowlTap, setBowlDraft, setBowlNow } from '../games/bowling/view.js';
import { BULLS } from '../games/bullseye/rules.js';
import { bullDraft, bullsLinePos, setBullDraft } from '../games/bullseye/view.js';
import { markCoins } from '../games/coins/rules.js';
import { diceSlot } from '../games/dice/rules.js';
import { echoSeq } from '../games/echo/rules.js';
import { echoDraft } from '../games/echo/view.js';
import { flArt } from '../games/flash/view.js';
import { floodGain } from '../games/flood/rules.js';
import { headAt, headAxis, headU } from '../games/headcount/rules.js';
import { hopPlan } from '../games/skyhop/rules.js';
import { sniffDirs, sniffStep } from '../games/sniff/rules.js';
import { setTriviaBank, triviaDeal, triviaReady } from '../games/trivia/rules.js';
import { triviaPre } from '../games/trivia/view.js';
import { VALID5 } from '../games/wordle/words.js';
import { INFO, TYPES } from '../games/index.js';
import { SFX, SND } from '../audio/sound.js';
import { acct, afterAccount, afterLogin, loginBusy, loginMsg, setAcct } from '../net/accounts.js';
import { FIREBASE_CDN, call, connectFirebase, connected, fb, serverNow, setCall, setConnected } from '../net/connect.js';
import { enterMatched, search } from '../net/matchmaking.js';
import { attemptMove, dbMove, moveRejected, predicted, setMoveRejected } from '../net/moves.js';
import { reactKey } from '../net/reactions.js';
import { releases, visibleTypes } from '../net/releases.js';
import { applyMatch, assignNet, blocked, isHost, leaveRoom, moveWait, net, online, pinned, presence, presentingSeq, room, roomRef } from '../net/room.js';
import { devIdAny, devLast, devPulse, pendingLocal, setDevLast, testerTag, track, trackStart } from '../net/tracking.js';
import { RNG, app, commit, cpuPlan, cpuTimer, flashReady, menuOpen, mv, save, setCpuPlan, setCpuTimer, setMenuOpen, spotTimer, state } from './app.js';
import { attDraft, attPre } from './attention.js';
import { pcard } from './cards.js';
import { clockLeft, tick } from './clock.js';
import { KEY } from './config.js';
import { EXPLAIN, explainT } from './explainer.js';
import { fingDraft, fingDraw, fingFinish, fingFrame, fingPre, fingRep, setFingDraw, setFingFrame } from './finger.js';
import { BURSTS, animMs, burstPick, fxAt } from './fx.js';
import { physDraft, physPull, physRaf, physRepOn, physStill } from './physics.js';
import { render, setRender } from './render.js';
import { rep, repActive, repSkip, repTake } from './replay.js';
import { runDraft, runPre, runShow } from './runner.js';
import { hist, prof, record, signed } from './screens/profile.js';
import { setGames } from './screens/setup.js';
import { BUMP_SPEC, CANDY_SPEC, DICE_SPEC, SNL_SPEC } from './track.js';
import { dismissFlash, playFlash } from './turns.js';
import { thinkInfo } from './think.js';
import { chaosNext, chaosResolve, chaosTimeout, scCpu, scTypes, startChaos } from '../core/chaos.js';
import { cpuMove } from '../core/ai.js';
import { scClockLeft, scUi, setScUi } from './chaos.js';
import { cardData, paintCard, renderCard, shareResult } from './sharecard.js';

const names = {
  state: () => state,
  cpuMove: () => cpuMove, thinkInfo: () => thinkInfo, startChaos: () => startChaos, chaosResolve: () => chaosResolve, chaosNext: () => chaosNext, chaosTimeout: () => chaosTimeout, scCpu: () => scCpu, scTypes: () => scTypes, scUi: () => scUi, scClockLeft: () => scClockLeft,
  KEY: () => KEY,
  commit: () => commit,
  online: () => online,
  render: () => render,
  SND: () => SND,
  presentingSeq: () => presentingSeq,
  moveWait: () => moveWait,
  call: () => call,
  app: () => app,
  physicsReady: () => physicsReady,
  playMove: () => playMove,
  newMini: () => newMini,
  physDraft: () => physDraft,
  physPull: () => physPull,
  room: () => room,
  applyMatch: () => applyMatch,
  connected: () => connected,
  net: () => net,
  randomLegalMove: () => randomLegalMove,
  makeRng: () => makeRng,
  runDraft: () => runDraft,
  dbMove: () => dbMove,
  RNG: () => RNG,
  signed: () => signed,
  FIREBASE_CDN: () => FIREBASE_CDN,
  acct: () => acct,
  fb: () => fb,
  playFlash: () => playFlash,
  rep: () => rep, repActive: () => repActive, repSkip: () => repSkip, repTake: () => repTake,
  TYPES: () => TYPES,
  explainT: () => explainT,
  triviaReady: () => triviaReady,
  blocked: () => blocked,
  enterMatched: () => enterMatched, connectFirebase: () => connectFirebase, newOnlineMatch: () => newOnlineMatch, packMatch: () => packMatch,
  r3: () => r3,
  runSpeed: () => runSpeed,
  runSecs: () => runSecs,
  serverNow: () => serverNow,
  isHost: () => isHost,
  fullState: () => fullState,
  other: () => other,
  matchRecord: () => matchRecord,
  menuOpen: () => menuOpen,
  bullsLinePos: () => bullsLinePos,
  bullDraft: () => bullDraft,
  BULLS: () => BULLS,
  attemptMove: () => attemptMove,
  echoSeq: () => echoSeq,
  endFlash: () => endFlash,
  floodGain: () => floodGain,
  VALID5: () => VALID5,
  afterLogin: () => afterLogin,
  afterAccount: () => afterAccount,
  search: () => search,
  record: () => record,
  pinned: () => pinned,
  track: () => track,
  setTriviaBank: () => setTriviaBank,
  triviaDeal: () => triviaDeal,
  secretOf: () => secretOf,
  hideMini: () => hideMini,
  visibleTypes: () => visibleTypes,
  presence: () => presence,
  roomRef: () => roomRef,
  physRaf: () => physRaf,
  physStill: () => physStill, physRepOn: () => physRepOn,
  loginMsg: () => loginMsg,
  cpuTimer: () => cpuTimer,
  EXPLAIN: () => EXPLAIN,
  sniffDirs: () => sniffDirs,
  sniffStep: () => sniffStep,
  dismissFlash: () => dismissFlash,
  prof: () => prof,
  hist: () => hist,
  pcard: () => pcard,
  save: () => save,
  pendingLocal: () => pendingLocal,
  triviaPre: () => triviaPre,
  headU: () => headU,
  headAxis: () => headAxis,
  headAt: () => headAt,
  attDraft: () => attDraft,
  attPre: () => attPre,
  attMs: () => attMs,
  cardName: () => cardName,
  DICE_SPEC: () => DICE_SPEC,
  diceSlot: () => diceSlot,
  CANDY_SPEC: () => CANDY_SPEC,
  burstPick: () => burstPick,
  SNL_SPEC: () => SNL_SPEC,
  BUMP_SPEC: () => BUMP_SPEC,
  echoDraft: () => echoDraft,
  fingDraw: () => fingDraw,
  moveRejected: () => moveRejected,
  fingFrame: () => fingFrame,
  fingDraft: () => fingDraft,
  fingFinish: () => fingFinish,
  fxAt: () => fxAt, animMs: () => animMs, flashReady: () => flashReady,
  fingPre: () => fingPre,
  fingMs: () => fingMs,
  fingRaw: () => fingRaw,
  fingRep: () => fingRep,
  hopPlan: () => hopPlan,
  clockLeft: () => clockLeft,
  predicted: () => predicted,
  runPre: () => runPre,
  runShow: () => runShow,
  newTimer: () => newTimer,
  bowlDraft: () => bowlDraft,
  bowlTap: () => bowlTap,
  BURSTS: () => BURSTS,
  loginBusy: () => loginBusy,
  newMatch: () => newMatch,
  cpuPlan: () => cpuPlan,
  spotTimer: () => spotTimer,
  reactKey: () => reactKey,
  releases: () => releases,
  setGames: () => setGames,
  leaveRoom: () => leaveRoom,
  leaveSquare: () => leaveSquare,
  markCoins: () => markCoins,
  bowlNow: () => bowlNow,
  startMatch: () => startMatch,
  trackStart: () => trackStart,
  mv: () => mv,
  devLast: () => devLast,
  devPulse: () => devPulse,
  devIdAny: () => devIdAny,
  testerTag: () => testerTag,
  INFO: () => INFO,
  applyOnlineMove: () => applyOnlineMove,
  r2: () => r2,
  armClock: () => armClock,
  mainResult: () => mainResult,
  SFX: () => SFX,
  tick: () => tick,
  PHYSICS: () => PHYSICS,
  flArt: () => flArt,
  cardData: () => cardData, paintCard: () => paintCard, renderCard: () => renderCard, shareResult: () => shareResult,
};
const setters = { scUi: setScUi, render: setRender, bullDraft: setBullDraft, connected: setConnected, fingDraw: setFingDraw, moveRejected: setMoveRejected, fingFrame: setFingFrame, call: setCall, net: assignNet, acct: setAcct, bowlDraft: setBowlDraft, cpuTimer: setCpuTimer, cpuPlan: setCpuPlan, bowlNow: setBowlNow, devLast: setDevLast, menuOpen: setMenuOpen };
export function init() {
  for (const [name, get] of Object.entries(names)) Object.defineProperty(window, name, { get, set: setters[name], configurable: true });
}
