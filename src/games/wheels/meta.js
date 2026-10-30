// Risky Spins: its names, its "?" explainer, its icon and its release default, and its default settings.

export const info = { name: 'Risky Spins',  hint: 'Spin and bank. A skull loses this turn\'s points. First to 30' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const minVersion = '1.2.0';   // the oldest client version that has this game (core/client.js: Find Match and friend rooms deal it only when both players' clients do)
export const turnSecs = 60;   // an online turn's time in this game (core/timer.js turnSecs): 60 seconds, against the match's 30
export const category = 'luck';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds
export const explainer = { name: 'Risky Spins', play: 'Pick a wheel and spin. Keep spinning to build your points, then bank. Land on a skull and you lose them. Riskier wheels pay more but have more skulls.', win: 'Reach {target} first.' };
export const EXPLAIN_KEYS = ['target'];   // {target} in the explainer: the admin's target (config/wheels, ui/explainer.js fillTune), not a TUNE setting
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13.5" r="8.5"/><path d="M12 13.5V5M12 13.5l7.4 4.3M12 13.5l-7.4 4.3"/><path d="M12 13.5V5a8.5 8.5 0 0 1 7.4 12.8z" fill="currentColor" fill-opacity=".35"/><path d="M9.8 1.2h4.4L12 4.4z" fill="currentColor"/></svg>';
// Its settings besides those below (the admin's Mini-game Settings; core/tune.js): the computer's mistakes.
export const TUNE = [
  { k: 'miss', label: 'Computer mistake rate (%)', def: 0, min: 0, max: 100, step: 5, group: 'Computer' },
];
// The target, each wheel's skulls (of 10 segments) and its values (the admin's config/wheels): low 1-4 with 1 skull,
// medium 2-7 with 3, high 3-10 with 4 and the only 10 (one of them); the averages at least 0.4 apart.
export const WHEEL_DEFAULTS = { target: 30, lowSkulls: 1, midSkulls: 3, highSkulls: 4, lowLo: 1, lowHi: 4, midLo: 2, midHi: 7, highLo: 3, tensMin: 1, tensMax: 1, gap: 0.4 };
