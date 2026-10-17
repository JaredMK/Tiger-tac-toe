// Risky Rolls: its names, its "?" explainer, its icon and its release default.

export const info = { name: 'Risky Rolls',  hint: "Roll and bank. A repeated number loses this turn's points. First to 21 wins" };   // ('pig': its id in saved games, records and stats, from when it was called Pig)
export const release = 'released';   // the default (the admin's dashboard can change it)
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds
export const explainer = { name: 'Risky Rolls', play: 'Roll as many times as you dare, then bank your points. Roll a number you already rolled this turn and you lose them.', win: 'Bank 21 first.' };   // ('pig': its id from when it was called Pig)
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M3 10h18v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M12 3v7M8.5 6.5 12 3l3.5 3.5" stroke-linecap="round"/></svg>';
