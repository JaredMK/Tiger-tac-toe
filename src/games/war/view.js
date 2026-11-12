// War: the screen, the miniature, the move's words and sounds, and the inputs.
import { tune } from '../../core/tune.js';
import { WAR, WART, warPips, warPlan } from './rules.js';
import { N, REDUCED, mv, state } from '../../ui/app.js';
import { toon } from '../../ui/art.js';
import { pcard } from '../../ui/cards.js';
import { cfAnchor, cfFrom } from '../../ui/cardfly.js';
import { arcTally, lateAt } from '../../ui/progress.js';
import { pipRows, thumbArt, tinyCard } from '../../ui/thumbs.js';

// War: one tap of Flip a move, and the round flips itself out (drawn where the move is made: the server
// online). The page plays it back card by card from the move's flash (warPlan in the engine: the turn clock
// and the sounds use it too): the round before is swept off, the player's card and the dealer's fly in from
// their decks and turn face up together, they clash, and the higher one is lifted and ringed (the player's in
// their colour) while the other dims, the verdict between the rows; a round won sends a token from the verdict
// to each pip it fills. On a tie "War!" bursts in (with the pips the war is worth), three cards go down each
// side to the drum, and the next pair turns. The table keeps the last round's cards once the move is over.
// One button, always there, so nothing moves.
function warSay(w) {
  if (!w) return '';
  if (w.result === 'win') return w.wars ? `War won! +${w.gain}` : `Round won! +${w.gain}`;
  return w.wars ? 'War lost' : "Dealer's round";
}
// The felt's emblem (two crossed swords: an original drawing), under the verdict.
const EMBLEM = '<svg class="wremb" viewBox="0 0 40 40" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 31L30 8l2.6-.6-.6 2.6L11 33z"/><path d="M6.5 25.5l8 8M8 36l3.4-3.4"/><path d="M31 31L10 8l-2.6-.6.6 2.6L29 33z"/><path d="M33.5 25.5l-8 8M32 36l-3.4-3.4"/></g></svg>';
// A side's cards on the table: every battle's card in its turn, three down after a tie. `t`: the plan while the
// move plays (each card flying in from its deck at its moment), else the cards as they lie. The last battle's
// winner is lifted and ringed, its loser dimmed (as the verdict shows, or at once when settled).
function warCards(r, s, plan, tEnd, cls) {
  const n = r.battles.length, e = 2 * n - 1, units = n + (n - 1) * 1.28, ov = e > 1 ? Math.max(0.45, (units - 2.4) / (e - 1)) : 0;   // (a war's cards lie as a pile, each over the one before's edge; a war on a war: tucked in further so the row still fits)
  const won = (r.result === 'win') === (s === 'p'), sh = (units - ov * (e - 1)) / 2 - 0.5;   // (sh: how far left of the mat's middle the pile's first card lies, in cards)
  const out = r.battles.map((b, k) => {
    const t = plan ? plan.battles[k] : null, last = k === n - 1;
    const card = pcard(b[s], t ? { slide: s === 'p' ? t.pAt : t.dAt, flip: s === 'p' ? t.pFlip : t.dFlip, from: 'deck:' + s } : {});
    const kind = last ? (won ? 'wrwon' : 'wrlost') : 'wrtie';
    const first = !!t && k === 0 && n > 1;   // (a war's first pair lands in the middle of the mat like any pair, and steps aside for the pile as "War!" lands: where it lands gives nothing away)
    const style = t ? ` style="--c:${t.up}ms;--t:${t.judge}ms${first ? `;--sh:${sh.toFixed(3)}` : ''}"` : '';
    const slot = `<span class="wrc ${kind}${t ? ' go' : ''}${first ? ' wrsh' : ''}"${style}>${card}</span>`;
    if (last) return slot;
    const downs = Array.from({ length: WAR.down }, (_, i) => pcard(null, { down: true, slide: t ? t.downAt + i * WART.down : undefined, cls: 'wrdn', from: t ? 'deck:' + s : null })).join('');
    return slot + `<span class="wrdowns" aria-label="Three cards face down">${downs}</span>`;
  });
  return `<div class="wrcards${cls ? ' ' + cls : ''}"${ov ? ` style="--ov:${ov.toFixed(3)}"` : ''}${cls ? ' aria-hidden="true"' : ''}>${out.join('')}</div>`;
}
let warSeen = null;   // the round last drawn at rest (which square, how many flips in, its cards): the next flip sweeps it off the felt
function warTable(mini, a, o) {
  const w = a && a.war && Array.isArray(a.war.battles) ? a.war : null, l = mini.last, turn = o.turn;
  const shown = w || (l && Array.isArray(l.battles) && l.battles.length ? l : null);
  const anim = !!w && !REDUCED, plan = w ? warPlan(w) : null, tEnd = anim ? plan.end : 0;
  const by = w ? a.by : shown ? shown.by : turn, goal = tune(mini).goal, worth = tune(mini).warWorth;
  const flips = (mini.flips ? mini.flips.X + mini.flips.O : 0);
  // the tallies: a round won fills its pips (one, or a war's two) as its tokens land, flown over from the verdict
  const tal = p => {
    const n = Math.min(goal, mini.wins[p]), fresh = w && w.gain && a.by === p ? Math.min(n, w.gain) : 0, at = anim ? warPips(tEnd, fresh) : [];
    const pips = Array.from({ length: goal }, (_, k) => {
      const j = k - (n - fresh), mine = j >= 0 && j < fresh;
      const tok = mine && anim ? `<span class="wrtok ${p}"${cfFrom('wr:res', at[j] - WART.tok, { d: WART.tok, go: true })}></span>` : '';
      return `<i ${lateAt(k < n ? 'on' : '', mine && anim ? at[j] : null, 'fillin')}></i>${tok}`;   // (the token lies over its pip, beside it in the markup: a pip filling in is a layer of its own)
    }).join('');
    return arcTally(p, o, `<span class="pips" aria-label="${mini.wins[p]} of ${goal} rounds">${pips}</span>`);
  };
  const side = s => {
    if (!shown) return '<div class="wrcards"><span class="wrc wrempty"></span></div>';
    const old = anim && warSeen && warSeen.sq === state.zoom && warSeen.n === flips - 1 ? warCards(warSeen.last, s, null, 0, 'wrgone') : '';   // (the round before: swept off as this one's first card leaves the deck)
    return old + warCards(shown, s, anim ? plan : null, tEnd, '');
  };
  if (!w) warSeen = shown ? { sq: state.zoom, n: flips, last: { battles: shown.battles.map(b => ({ p: b.p, d: b.d })), result: shown.result } } : null;
  // each side's deck (card motion: its cards fly from it)
  const deck = s => `<span class="wrdeck"${cfAnchor('deck:' + s)} aria-hidden="true">${pcard(null, { down: true })}</span>`;
  // the verdict between the rows: "War!" at each tie (gone as the next pair is judged), the result at the end
  const stake = worth > 1 ? `<span class="wrstake" aria-label="worth ${worth}">${'<i></i>'.repeat(worth)}</span>` : '';
  const res = (r, p) => `wrres ${r.result === 'win' ? 'ok ' + p : 'no'}`;   // (a round won carries its winner's face and colour; the dealer's has neither)
  let mid = '';
  if (w) {
    if (anim) mid = plan.battles.slice(0, -1).map((t, k) => `<div class="wrres war" style="--f:${t.judge}ms;--u:${plan.battles[k + 1].judge}ms" role="status"><span>War!</span>${stake}</div>`).join('');
    mid += `<div ${lateAt(res(w, by), anim ? tEnd : null)} role="status">${w.result === 'win' ? toon(by) : ''}<span>${warSay(w)}</span></div>`;
  } else if (shown && (o.done || o.view)) mid = `<div class="${res(shown, shown.by)}">${shown.result === 'win' ? toon(shown.by) : ''}<span>${warSay(shown)}</span></div>`;
  const live = !!w, btn = o.view ? '' : `<div class="cbtns one"><button class="big ${live ? `chosen ${by}` : turn}" data-act="move" ${mv('flip')}${o.locked ? ' disabled' : ''}>Flip</button></div>`;
  return `<div class="g-war pc-${by}"><div class="ctals">${tal('X')}${tal('O')}</div>
    <div class="wrfelt"><div class="wrrow wrdealer"><div class="wrside"><span class="wrlab">Dealer</span>${deck('d')}</div>${side('d')}</div><div class="wrmid">${EMBLEM}<span class="wrsrc"${cfAnchor('wr:res')}></span>${mid}</div><div class="wrrow wrplayer"><div class="wrside"><span class="wrlab wrwho ${by}" aria-label="${by}'s cards">${toon(by)}</span>${deck('p')}</div>${side('p')}</div></div>
    ${btn}</div>`;
}
// The miniature: the last flip's two cards face to face (the player's, ringed in their colour, against the dealer's;
// two backs before any), and each player's rounds won as pips. (The cards turned are public; the decks never show.)
export function miniature(mini, final) {
  const l = mini.last, b = l && Array.isArray(l.battles) && l.battles.length ? l.battles[l.battles.length - 1] : null, goal = tune(mini).goal;
  const art = `<div class="twar">${b ? tinyCard(b.p, l.by) : tinyCard(null)}${b ? tinyCard(b.d) : tinyCard(null)}</div>`;   // (face to face, tilted apart: no "v" between, too small a word to read)
  return thumbArt(art, pipRows(mini.wins, goal), 'twarm', `War: X ${mini.wins.X}, O ${mini.wins.O} of ${goal} rounds`);
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = warTable(mini, a, { view, locked, turn, done: !!d }); return g;
}
// "Go again on success": the turn held to the square after a round won (said once its result has played).
export function heldSub(mini, turn, f, a) {
  return f ? '' : `<b class="${turn}">${N(turn)}</b> won the round · flips again`;
}
export function moveText(f, who) {
  const w = f.war;
  if (!w) return `${who} flipped`;
  if (w.result === 'win') return w.wars ? `${who} won the war` : `${who} won the round`;
  return w.wars ? `${who} lost the war` : `${who}: the dealer's round`;
}
export function sounds(f, add, won, mini, last) {   // each card flies in as warPlan has it, the pair turns together; a drum roll at a tie, the down cards; then the result, and a ding as each pip's token lands
  const w = f.war;
  if (!w) return;
  const plan = warPlan(w), n = plan.battles.length;
  plan.battles.forEach((t, k) => {
    add('cardSlide', t.pAt); add('cardSlide', t.dAt); add('cardFlip', t.dFlip);
    if (k < n - 1) { add('warDrum', t.judge); for (let i = 0; i < WAR.down; i++) add('cardSlide', t.downAt + i * WART.down); }
  });
  if (w.result === 'win') { add('point', plan.end); warPips(plan.end, w.gain).forEach((t, i) => add('ding', t, 1 + i * .12)); }
  else { add('nopair', plan.end); add('thud', plan.end); }
  return;
}
