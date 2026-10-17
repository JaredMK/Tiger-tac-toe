// Craps: its names, its "?" explainer, its icon and its release default.

export const info = { name: 'Craps',        hint: '7 or 11 wins, 2, 3 or 12 loses. Win 3 rounds' };
export const release = 'admin';   // the default (the admin's dashboard can change it)
export const superChaos = true;   // Super Chaos: dealt in simultaneous rounds
export const explainer = { name: 'Craps', play: 'Roll. On the first roll of a round, 7 or 11 wins it and 2, 3 or 12 loses it. Anything else is the point: then choose Roll again (the point wins, a 7 loses) or Stop. Stop ends your turn with the point still on, and whoever rolls here next carries on that round: the point wins it for them, a 7 loses it.', win: 'Win 3 rounds.' };
export const scExplainer = { name: 'Craps', play: 'Roll. On the first roll of your round, 7 or 11 wins it and 2, 3 or 12 loses it. Anything else is your point: Roll again (the point wins, a 7 loses) or Stop, which keeps your point for your next roll here.', win: 'Win 3 rounds.' };   // in Super Chaos
export const icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linejoin="round"><rect x="2.5" y="8" width="10.5" height="10.5" rx="2.2" transform="rotate(-12 7.7 13.2)"/><rect x="11.5" y="4.5" width="10" height="10" rx="2.2" transform="rotate(10 16.5 9.5)"/><circle cx="5.6" cy="11.2" r="1.1" fill="currentColor" stroke="none"/><circle cx="9.6" cy="15.6" r="1.1" fill="currentColor" stroke="none"/><circle cx="16.5" cy="9.5" r="1.1" fill="currentColor" stroke="none"/></svg>';
