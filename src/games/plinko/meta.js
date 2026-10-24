// Peg Drop: its names, its "?" explainer, its icon and its release default, and its default settings.

export const info = { name: 'Peg Drop',       hint: 'Drop from an open slot. Race to the target' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const category = 'luck';   // the game's kind, shown in its "?" explainer: 'luck', 'skill' or 'brain'
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds
export const explainer = { name: 'Peg Drop', play: 'Drop the chip from an open slot. Score points based on the bin\'s value plus the gold bonus peg.', win: 'First to the target score wins.' };
export const scExplainer = { name: 'Peg Drop', play: 'Drop the chip from an open slot. The gold bonus peg adds points.', win: 'First to the target score.' };   // in Super Chaos
export const icon = '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="3.5" r="2.2"/><circle cx="7" cy="9" r="1.5"/><circle cx="12" cy="9" r="1.5"/><circle cx="17" cy="9" r="1.5"/><circle cx="9.5" cy="14" r="1.5"/><circle cx="14.5" cy="14" r="1.5"/><path d="M3 18.5h18v3H3z"/><path d="M11 18.5h2v3h-2z" fill="var(--paper)"/></svg>';
export const PLINKO_DEFAULTS = { target: 12 };
// Its settings besides the target (the admin's Mini-game Settings; core/tune.js): read with tune(mini).
export const TUNE = [
  { k: 'bonus', label: 'Bonus peg points', def: 2, min: 1, max: 5, step: 1, group: 'Rules' },
  { k: 'miss', label: 'Computer mistake rate (%)', def: 0, min: 0, max: 100, step: 5, group: 'Computer' },
];
