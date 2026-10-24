// What the server holds a phone's move to beyond the game's own rules (security review F3): the same checks
// for every online match, Classic (functions/index.js move) and Super Chaos (core/scgame.js applyScMove).
// A phone never plays a timeout ('auto' is the server's to make at the deadline: a missed turn plays nothing,
// a move under way ends as it stands; Odd One Out's own pick timer is the one 'auto' a phone sends, and it
// only counts against the sender). A run carries its input log (the engine plays it through again, step for
// step: runner.js runCheck) and is no longer than the turn or round has lasted. An attempt (Sky Hop, Scoop
// Stack: played through again from its inputs; Pinball: re-simulated from its inputs, finger.js fingCheck)
// comes after Start, with its log, and is no longer than the time since Start. An attention game's answer
// comes after Start (the round is the server's until then) and within the round's own time plus the answer
// window, or counts as out of time (the move becomes 'auto': a wrong answer, "ran out of time").
import { ATT, ATT_TYPES, attMs } from '../games/shared/attention.js';
import { FING, FINGER_TYPES } from '../games/shared/finger.js';
import { RUN, RUN_TYPES } from '../games/shared/runner.js';
import { PHYSICS } from '../games/shared/physics.js';

export const AUTO_FROM_PHONE = ['oddone'];
const pinHz = () => (PHYSICS.lib && PHYSICS.lib.PIN ? PHYSICS.lib.PIN.hz : 480);
// mini: the square's mini-game (the full one); p: the side; m: the move as sent; now: server time; since: when
// the turn or round began (null: no clock, friend rooms without a timer). Returns null (fine), { why } (refused:
// 'auto', 'log', 'start', 'fast', 'bad') or { why: null, move } (the move to play instead: a late answer).
export function onlineCheck(mini, p, m, now, since) {
  if (!mini) return { why: 'bad' };
  const type = mini.type, started = mini.started && mini.started[p] != null ? mini.started[p] : null;
  if (m === 'auto') return AUTO_FROM_PHONE.includes(type) ? null : { why: 'auto' };
  if (RUN_TYPES.includes(type)) {
    if (!m || typeof m !== 'object') return { why: 'bad' };
    if (typeof m.log !== 'string') return { why: 'log' };
    if (since != null && Number(m.ms) > now - since + RUN.clockSlackMs) return { why: 'fast' };
    return null;
  }
  if (FINGER_TYPES.includes(type)) {
    if (!m || typeof m !== 'object' || m.fing) return { why: 'bad' };
    if (started == null) return { why: 'start' };
    if (type === 'pinball' && typeof m.log !== 'string') return { why: 'log' };
    const ms = type === 'pinball' ? (Number(m.steps) / pinHz()) * 1000 : Number(m.steps) * FING.step * 1000;
    if (!(ms <= now - started + FING.slackMs)) return { why: 'fast' };
    return null;
  }
  if (ATT_TYPES.includes(type)) {
    if (started == null) return { why: 'start' };
    const r = mini.round && mini.round[p];
    if (r && now > started + attMs(type, r) + (ATT.answerMs[type] || 15000) + ATT.slackMs) return { why: null, move: 'auto' };
    return null;
  }
  return null;
}
