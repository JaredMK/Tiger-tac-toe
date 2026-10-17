// Playing cards (Blackjack and Ride the Bus): the deck, ranks and names.

// ---------- playing cards (Blackjack and Ride the Bus) ----------
// A card is two characters: the rank (2-9, T for 10, J, Q, K, A) and the suit (S spades, H hearts,
// D diamonds, C clubs). Hearts and diamonds are red.
export const CARD = { ranks: '23456789TJQKA', suits: 'SHDC', names: { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' } };
export function cardDeck() { const d = []; for (const s of CARD.suits) for (const r of CARD.ranks) d.push(r + s); return d; }
export function isCard(c) { return typeof c === 'string' && c.length === 2 && CARD.ranks.includes(c[0]) && CARD.suits.includes(c[1]); }
export function cardName(c) { const r = c[0]; return `${{ T: '10', J: 'Jack', Q: 'Queen', K: 'King', A: 'Ace' }[r] || r} of ${CARD.names[c[1]]}`; }
