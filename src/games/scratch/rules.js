// Scratch & Match: the rules (pure: no page, no clock; the server runs the same code).
import { randInt, shuffle } from '../../core/random.js';
import { tune, tuneLive } from '../../core/tune.js';

// ---------- Scratch & Match ----------
// Each player has their own 3x3 card of frosted panels, a picture under every one (individual progress: no shared
// board). A move scratches one panel of your own card and shows its picture; the first to show three of the same
// picture on their card takes the square. The cards are dealt from the admin's settings (meta.js TUNE, scrLayout): the
// pictures on a card come from `kinds` different ones; `lines` of them appear three times, each along one line of the
// card (a row, a column or a diagonal: three of a kind always sit in a line, so two matching pictures in a line say
// where the third is), and the other panels hold decoys that never reach three (`pairs` pictures twice, the rest once).
// Where the pictures lie is the server's secret until scratched (secret/hide: `cards`); the scratched panels are
// public (`open`). Nothing is random in a move: the card was dealt when the square was.
export const SCR = { n: 9, need: 3, rub: 650, pop: 240, pair: 300, won: 700 };   // the move's moments (ms): the frost rubbed away, the picture's pop, a pair's or the triple's glow
export const SCR_PICS = 8;                                       // the pictures the view can draw (view.js PICS): a square deals `kinds` of them
export const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
// The ways `lines` lines fit on a card without crossing: one is any line; two are two rows or two columns.
export const LINE_SETS = { 1: LINES.map(l => [l]), 2: [[0, 1], [0, 2], [1, 2], [3, 4], [3, 5], [4, 5]].map(([a, b]) => [LINES[a], LINES[b]]) };
// The layout from the settings, held to what fits on nine panels: kinds 4 to SCR_PICS, lines 1 or 2, and the decoy panels
// (9 less three a line) as pairs and singles: never more pairs than fit, never fewer than the kinds left can hold (each
// decoy picture at most twice).
export function scrLayout(t) {
  t = t || {};
  const num = (k, def) => (t[k] == null || t[k] === '' || !Number.isFinite(Number(t[k])) ? def : Math.round(Number(t[k])));   // (the TUNE defaults where a setting is missing)
  const kinds = Math.max(4, Math.min(SCR_PICS, num('kinds', 6)));
  const lines = Math.max(1, Math.min(2, num('lines', 1)));
  const decoys = SCR.n - SCR.need * lines, free = kinds - lines;
  const maxPairs = Math.floor(decoys / 2), minPairs = Math.max(0, decoys - free);
  const pairs = Math.max(minPairs, Math.min(maxPairs, num('pairs', 2)));
  return { kinds, lines, pairs, singles: decoys - 2 * pairs, decoys };
}
// One card: the lines' pictures along them, the decoys shuffled over the rest. Pictures are numbers 0 to kinds - 1.
export function scrCard(rng, lay) {
  const set = LINE_SETS[lay.lines][randInt(rng, LINE_SETS[lay.lines].length)];
  const syms = shuffle(Array.from({ length: lay.kinds }, (_, k) => k), rng);
  const card = new Array(SCR.n).fill(null);
  set.forEach((ln, j) => ln.forEach(i => { card[i] = syms[j]; }));
  const bag = [];
  for (let k = 0; k < lay.pairs; k++) bag.push(syms[lay.lines + k], syms[lay.lines + k]);
  for (let k = 0; k < lay.singles; k++) bag.push(syms[lay.lines + lay.pairs + k]);
  const spots = shuffle(card.map((v, i) => (v == null ? i : -1)).filter(i => i >= 0), rng);
  spots.forEach((i, k) => { card[i] = bag[k]; });
  return card;
}
// How many of each picture a player has shown (by picture), and the most of any one (0 to 3).
export function scrCounts(open) {
  const c = {};
  for (const v of open || []) if (v != null) c[v] = (c[v] || 0) + 1;
  return c;
}
export function scrBest(open) { let b = 0; for (const n of Object.values(scrCounts(open))) if (n > b) b = n; return Math.min(SCR.need, b); }
export const scrOpen = (mini, p) => (mini && mini.open && Array.isArray(mini.open[p]) ? mini.open[p] : new Array(SCR.n).fill(null));
export function create(type, rng) {
  const lay = scrLayout(tuneLive(type));                        // (the admin's settings: the pictures and the layout)
  const pics = shuffle(Array.from({ length: SCR_PICS }, (_, k) => k), rng).slice(0, lay.kinds);   // which of the view's pictures this square shows (public: the same set on both cards)
  return { type, pics, cards: { X: scrCard(rng, lay), O: scrCard(rng, lay) }, open: { X: new Array(SCR.n).fill(null), O: new Array(SCR.n).fill(null) }, last: null };
}
export function apply(mini, p, m, rng, idx) {
  // One panel of the mover's own card scratched: its picture shows. Three of a kind on show takes the square (the
  // three panels, which lie in a line, are its cells); two of a kind is a pair (said, nothing more).
  if (!idx(SCR.n)) return { ok: false, reason: 'bad' };
  const open = scrOpen(mini, p), card = mini.cards && mini.cards[p];
  if (!Array.isArray(card)) return { ok: false, reason: 'bad' };
  if (open[m] != null) return { ok: false, reason: 'taken' };
  if (!mini.open) mini.open = { X: new Array(SCR.n).fill(null), O: new Array(SCR.n).fill(null) };
  mini.open[p] = open;
  const sym = card[m];
  open[m] = sym;
  const cells = open.map((v, i) => (v === sym ? i : -1)).filter(i => i >= 0), c = cells.length;
  mini.last = { by: p, spot: m, sym, c };
  if (c >= SCR.need) return { ok: true, outcome: 'win', cells, note: 'three' };
  return { ok: true, outcome: 'continue', note: c === 2 ? 'pair' : 'one' };
}
export function publicView(mini) {
  return { type: 'scratch', pics: (mini.pics || []).slice(), open: { X: scrOpen(mini, 'X').slice(), O: scrOpen(mini, 'O').slice() }, last: mini.last ? Object.assign({}, mini.last) : null };
}
export function randomMove(mini, p, rng, from, empties) {
  return from(empties(scrOpen(mini, p), v => v == null));
}
export function moveFlash(m, p, range, bjFrom, mini, flash) {
  const l = mini.last, open = scrOpen(mini, p);
  flash.scratch = { by: p, spot: m, sym: l ? l.sym : open[m], c: l ? l.c : 1, pic: mini.pics ? mini.pics[l ? l.sym : open[m]] : null, same: open.map((v, i) => (v === (l ? l.sym : open[m]) && i !== m ? i : -1)).filter(i => i >= 0) };
}
export function secret(mini) {
  return { cards: { X: (mini.cards.X || []).slice(), O: (mini.cards.O || []).slice() } };
}
export function hide(m, k, st) {
  delete m.cards; return;
}
// The move's animation: the frost rubbed away, the picture's pop, then a pair's glow where there is one; a square won
// holds the three's glow a while longer. The hold comes after (ui/turns.js).
export function flashMs(f, winLen, won) {
  const s = f.scratch;
  return SCR.rub + SCR.pop + (won ? SCR.won : s && s.c >= 2 ? SCR.pair : 0);
}
