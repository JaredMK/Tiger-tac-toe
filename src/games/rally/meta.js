// Road Race: its names, its "?" explainer, its icon, its release default and its settings.

export const info = { name: 'Road Race', hint: 'Steer round the bends. Off the road is a crash. First to 2 laps wins' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.25.0';   // the oldest client version that has this game (core/client.js)
export const category = 'skill';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const placeholder = false;   // never on a new state's placeholder board (games/index.js PLACE_TYPES): the seeded deals stay as they were
export const realTime = true;   // its move is a timed attempt (core/timer.js moveRate)
export const explainer = { name: 'Road Race', play: 'A turn is one lap attempt. Drag left and right to steer: the car follows your finger. Leave the road and you crash: the attempt is over. Every attempt is a new road.', win: 'First to finish {laps} laps.' };
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 21c0-6 4-6 4-10s-3-4-3-8M17 21c0-6 4-6 4-10s-3-4-3-8"/><path d="M12.500 20v-2M14 14v-2M13 8V6"/></svg>';
// Its settings (the admin's Games page; core/tune.js): the laps to win, the car's speed up the road and how fast it
// steers across it (units a second; the road is 100 wide and a lap 540 long: 9 seconds at 60), the road's width, the
// track set (how far the road swings: gentle, twisty, or a mix), and the computer's lapses of attention (a hundred
// seconds' worth, by level).
export const TUNE = [
  { k: 'laps', label: 'Laps to take the square', def: 2, min: 1, max: 5, step: 1, group: 'Rules' },
  { k: 'speed', label: 'Car speed (units a second: a lap is 540)', def: 60, min: 35, max: 110, step: 5, group: 'Timing' },
  { k: 'steer', label: 'Steering speed (units a second across)', def: 62, min: 30, max: 120, step: 2, group: 'Timing' },
  { k: 'width', label: 'Road width (the screen is 100 wide)', def: 34, min: 20, max: 50, step: 1, group: 'Board' },
  { k: 'tracks', label: 'Track set', def: 'mixed', opts: ['mixed', 'gentle', 'twisty'], group: 'Board' },
  { k: 'aiLapse', label: 'Normal computer: lapses of attention (in 100 s)', def: 170, min: 0, max: 600, step: 5, group: 'Computer' },
  { k: 'aiLapseHard', label: 'Hard computer: lapses (in 100 s)', def: 70, min: 0, max: 600, step: 5, group: 'Computer' },
  { k: 'aiLapseEasy', label: 'Easy computer: lapses (in 100 s)', def: 300, min: 0, max: 600, step: 5, group: 'Computer' },
];
