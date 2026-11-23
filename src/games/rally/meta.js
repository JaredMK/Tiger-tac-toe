// Road Race: its names, its "?" explainer, its icon, its release default and its settings.

export const info = { name: 'Road Race', hint: 'Turn the wheel and keep the car on the road. First to 3 laps wins' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.31.0';   // (1.31.0: a crash keeps the lap's progress, v 3; 1.30.0: a closed circuit from above and a steering wheel)   // the oldest client version that has this game (core/client.js)
export const category = 'skill';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const placeholder = false;   // never on a new state's placeholder board (games/index.js PLACE_TYPES): the seeded deals stay as they were
export const realTime = true;   // its move is a timed attempt (core/timer.js moveRate)
export const explainer = { name: 'Road Race', play: 'Press GO and the car drives itself round the circuit: drag the steering wheel left and right to steer, and let go to straighten up. Leave the road and you crash: your turn is over, and your next one starts from there. Both players race the same circuit.', win: 'First to finish {laps} laps.' };
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.500"/><path d="M12 14.500V21M9.700 11 3.500 9.500M14.300 11l6.200-1.500"/></svg>';
// Its settings (the admin's Games page; core/tune.js): the laps to win (3: a crash keeps the lap's progress, so a lap
// takes fewer turns than when every attempt began at the line), the car's speed and its sharpest turn (the
// circuit's frame is 100 wide and 110 tall, a lap about 290 round: 11 seconds at 26), the road's width,
// the track set (how far the loop swings in and out: gentle, twisty, or a mix), how far a finger travels to turn the
// wheel to full lock, and the computer's lapses of attention (a hundred seconds' worth, by level).
export const TUNE = [
  { k: 'laps', label: 'Laps to take the square', def: 3, min: 1, max: 5, step: 1, group: 'Rules' },
  { k: 'speed', label: 'Car speed (units a second: the circuit\'s frame is 100 wide)', def: 26, min: 15, max: 60, step: 1, group: 'Timing' },
  { k: 'turn', label: 'Sharpest turn, at full lock (degrees a second)', def: 170, min: 90, max: 300, step: 5, group: 'Timing' },
  { k: 'width', label: 'Road width (the frame is 100 wide)', def: 12, min: 8, max: 18, step: 0.5, group: 'Board' },
  { k: 'tracks', label: 'Track set', def: 'mixed', opts: ['mixed', 'gentle', 'twisty'], group: 'Board' },
  { k: 'travel', label: 'Steering wheel: finger travel to full lock (% of the screen\'s width)', def: 20, min: 8, max: 40, step: 1, group: 'Board' },
  { k: 'aiLapse', label: 'Normal computer: lapses of attention (in 100 s)', def: 85, min: 0, max: 600, step: 1, group: 'Computer' },
  { k: 'aiLapseHard', label: 'Hard computer: lapses (in 100 s)', def: 40, min: 0, max: 600, step: 1, group: 'Computer' },
  { k: 'aiLapseEasy', label: 'Easy computer: lapses (in 100 s)', def: 115, min: 0, max: 600, step: 1, group: 'Computer' },
];
