// Mastermind: its names, its "?" explainer, its icon and its release default.

export const info = { name: 'Mastermind',   hint: 'Crack the hidden 4-colour code' };
export const release = 'released';   // the default (the admin's dashboard can change it)
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds
export const explainer = { name: 'Mastermind', play: 'Guess the 4-colour code. Black marker means right colour and spot; white marker means right colour, wrong spot.', win: 'Crack the code.' };
export const scExplainer = { name: 'Mastermind', play: "Guess the 4-colour code. Black marker means right colour and spot; white marker means right colour, wrong spot. Both players' guesses join the board when the round ends.", win: 'Crack the code.' };   // in Super Chaos
export const icon = '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="8" r="3"/><circle cx="12" cy="8" r="3"/><circle cx="19" cy="8" r="3"/><circle cx="8.5" cy="17" r="2.2"/><circle cx="15.5" cy="17" r="2.2" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
