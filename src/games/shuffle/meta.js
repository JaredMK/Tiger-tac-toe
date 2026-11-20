// Shuffleboard: its names, its "?" explainer, its icon, its release default and its settings.
import { FLICK_TUNE } from '../shared/flick.js';

export const info = { name: 'Shuffleboard', hint: 'Flick a puck up the lane. The far zones score most. First to 10 wins' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.25.0';   // the oldest client version that has this game (core/client.js)
export const category = 'skill';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const placeholder = false;   // never on a new state's placeholder board (games/index.js PLACE_TYPES): the seeded deals stay as they were
export const explainer = { name: 'Shuffleboard', play: 'Flick up the lane to slide your puck: a faster flick slides further. It scores the zone it stops in: {z1}, {z2} or {z3}. Too short, off the end or off a side scores nothing.{sharedText}', win: 'First to {target} points.' };
export const explainVars = v => ({ lossText: v.knockLoss >= 100 ? 'all' : v.knockLoss === 50 ? 'half' : `${v.knockLoss}% of`, sharedText: v.boards === 'shared' ? ' The pucks stay on the lane: knock one into a new zone and it scores again for its owner, knock it off and its owner loses {lossText} its points.' : '' });
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="6.500" y="2.500" width="11" height="19" rx="1.500"/><path d="M6.500 7h11M6.500 11h11"/><circle cx="12" cy="16.500" r="2.300"/></svg>';
// Its settings (the admin's Games page; core/tune.js): the target, each zone's points and length (the lane is 100
// long: three zones of 10 fill its last 30), the friction (100: a full flick goes 125; more friction, less far), the
// lane's own spread (percent of the distance), a lane each or one shared lane (and how much of its way a puck passes
// on to one it strikes), the flick's speeds and the computer's aim.
export const TUNE = [
  { k: 'target', label: 'Points to take the square', def: 10, min: 3, max: 40, step: 1, group: 'Rules' },
  { k: 'boards', label: 'Lanes', def: 'separate', opts: ['separate', 'shared'], group: 'Rules' },
  { k: 'z1', label: 'Points: the near zone', def: 1, min: 0, max: 10, step: 1, group: 'Board' },
  { k: 'z2', label: 'Points: the middle zone', def: 2, min: 0, max: 10, step: 1, group: 'Board' },
  { k: 'z3', label: 'Points: the far zone', def: 4, min: 0, max: 10, step: 1, group: 'Board' },
  { k: 'zoneLen', label: 'Zone length (the lane is 100 long)', def: 10, min: 8, max: 25, step: 1, group: 'Board' },
  { k: 'friction', label: 'Friction (%: more slides less far)', def: 100, min: 60, max: 160, step: 5, group: 'Board' },
  { k: 'spread', label: 'Spread: how far off its aim a puck may stop (% of the distance)', def: 3, min: 0, max: 15, step: 0.5, group: 'Board' },
  { k: 'knock', label: 'Shared lane: a struck puck goes on this much of the way left (%)', def: 70, min: 20, max: 100, step: 5, group: 'Board' },
  { k: 'knockLoss', label: 'Shared lane: a puck knocked off costs its owner this much of its points (%)', def: 50, min: 0, max: 100, step: 10, group: 'Board' },
  ...FLICK_TUNE,
  { k: 'aiErr', label: 'Normal computer: distance error (%)', def: 16, min: 0, max: 40, step: 0.5, group: 'Computer' },
  { k: 'aiErrHard', label: 'Hard computer: distance error (%)', def: 9, min: 0, max: 40, step: 0.5, group: 'Computer' },
  { k: 'aiErrEasy', label: 'Easy computer: distance error (%)', def: 24, min: 0, max: 40, step: 0.5, group: 'Computer' },
];
