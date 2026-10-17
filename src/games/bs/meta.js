// Battleship: its names, its "?" explainer, its icon and its release default.

export const info = { name: 'Battleship',   hint: 'Sink the hidden ship. A hit fires again' };
export const release = 'released';   // the default (the admin's dashboard can change it)
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds
export const explainer = { name: 'Battleship', play: "Fire at a square. Hit? Fire again. The ship's size is shown below.", win: 'Sink the ship.' };
export const scExplainer = { name: 'Battleship', play: 'Fire at one square of the 5×5 sea. The ship is a single square.', win: 'Hit the ship.' };   // in Super Chaos
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="7.5"/><circle cx="12" cy="12" r="2.5"/><path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4"/></svg>';
