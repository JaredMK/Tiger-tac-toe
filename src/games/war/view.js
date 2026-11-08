// War: the screen, the miniature, the move's words and sounds, and the inputs.
import { tune } from '../../core/tune.js';
import { WAR, WART, warPlan } from './rules.js';
import { N, REDUCED, mv } from '../../ui/app.js';
import { toon } from '../../ui/art.js';
import { pcard } from '../../ui/cards.js';
import { arcTally, lateAt } from '../../ui/progress.js';
import { pipRows, thumbArt, tinyCard } from '../../ui/thumbs.js';

// War: one tap of Flip a move, and the round flips itself out (drawn where the move is made: the server
// online). The page plays it back card by card from the move's flash (warPlan in the engine: the turn clock
// and the sounds use it too): the player's card slides in and turns, the dealer's after it, the verdict
// between the rows; on a tie "War!" pops up, three cards go down each side, and the next pair turns. The
// table keeps the last round's cards once the move is over. One button, always there, so nothing moves.
function warSay(w) {
  if (!w) return '';
  if (w.result === 'win') return w.wars ? `War won! +${w.gain}` : `+${w.gain}`;
  return w.wars ? 'War lost' : "Dealer's round";
}
function warTable(mini, a, o) {
  const w = a && a.war && Array.isArray(a.war.battles) ? a.war : null, l = mini.last, turn = o.turn;
  const shown = w || (l && Array.isArray(l.battles) && l.battles.length ? l : null);
  const anim = !!w && !REDUCED, plan = w ? warPlan(w) : null, tEnd = anim ? plan.end : 0;
  const by = w ? a.by : shown ? shown.by : turn, goal = tune(mini).goal;
  // the tallies: a round won fills its pips (one, or a war's two) as the result shows
  const tal = p => {
    const n = Math.min(goal, mini.wins[p]), fresh = w && w.gain && a.by === p ? w.gain : 0;
    const pips = Array.from({ length: goal }, (_, k) => `<i ${lateAt(k < n ? 'on' : '', anim && k < n && k >= n - fresh ? tEnd : null, 'fillin')}></i>`).join('');
    return arcTally(p, o, `<span class="pips" aria-label="${mini.wins[p]} of ${goal} rounds">${pips}</span>`);
  };
  // the cards of each side: every battle's card in its turn, three down after a tie
  const n = shown ? shown.battles.length : 0;
  const side = s => {
    if (!shown) return `<div class="wrcards">${pcard(null, { down: true, cls: 'ghost' })}</div>`;
    const out = shown.battles.map((b, k) => {
      const t = anim ? plan.battles[k] : null;
      const card = pcard(b[s], anim ? { slide: s === 'p' ? t.pAt : t.dAt, flip: s === 'p' ? t.pFlip : t.dFlip } : {});
      if (k === n - 1) return card;
      const downs = Array.from({ length: WAR.down }, (_, i) => pcard(null, { down: true, slide: anim ? t.downAt + i * WART.down : undefined, cls: 'wrdn' })).join('');
      return card + `<span class="wrdowns" aria-label="Three cards face down">${downs}</span>`;
    });
    return `<div class="wrcards${n >= 3 ? ' wrn3' : n === 2 ? ' wrn2' : ''}">${out.join('')}</div>`;
  };
  // the verdict between the rows: "War!" at each tie (gone as the next pair turns), the result at the end
  let mid = '';
  if (w) {
    if (anim) mid = plan.battles.slice(0, -1).map((t, k) => `<div class="wrres war" style="--f:${t.judge}ms;--u:${plan.battles[k + 1].judge}ms" role="status">War!</div>`).join('');
    mid += `<div ${lateAt('wrres ' + (w.result === 'win' ? 'ok' : 'no'), anim ? tEnd : null)} role="status">${toon(by)}<span>${warSay(w)}</span></div>`;
  } else if (shown && (o.done || o.view)) mid = `<div class="wrres ${shown.result === 'win' ? 'ok' : 'no'}">${toon(shown.by)}<span>${warSay(shown)}</span></div>`;
  else if (o.view) mid = '<div class="wrres none">&nbsp;</div>';
  else mid = `<div class="wrres none"><b class="${turn}">${N(turn)}</b>'s turn</div>`;
  const btn = o.view ? '' : `<div class="cbtns one"><button class="big ${turn}" data-act="move" ${mv('flip')}${o.locked ? ' disabled' : ''}>Flip</button></div>`;
  return `<div class="g-war"><div class="ctals">${tal('X')}${tal('O')}</div>
    <div class="wrfelt"><div class="wrrow wrdealer"><span class="wrlab">Dealer</span>${side('d')}</div><div class="wrmid">${mid}</div><div class="wrrow wrplayer"><span class="wrlab"><b class="${by}">${N(by)}</b></span>${side('p')}</div></div>
    ${btn}</div>`;
}
// The miniature: the last flip's two cards face to face (the player's, ringed in their colour, against the dealer's;
// two backs before any), and each player's rounds won as pips. (The cards turned are public; the decks never show.)
export function miniature(mini, final) {
  const l = mini.last, b = l && Array.isArray(l.battles) && l.battles.length ? l.battles[l.battles.length - 1] : null, goal = tune(mini).goal;
  const art = `<div class="twar">${b ? tinyCard(b.p, l.by) : tinyCard(null)}<i class="twvs">v</i>${b ? tinyCard(b.d) : tinyCard(null)}</div>`;
  return thumbArt(art, pipRows(mini.wins, goal), '', `War: X ${mini.wins.X}, O ${mini.wins.O} of ${goal} rounds`);
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  g = warTable(mini, a, { view, locked, turn, done: !!d }); return g;
}
export function moveText(f, who) {
  const w = f.war;
  if (!w) return `${who} flipped`;
  if (w.result === 'win') return w.wars ? `${who} won the war` : `${who} won the round`;
  return w.wars ? `${who} lost the war` : `${who}: the dealer's round`;
}
export function sounds(f, add, won, mini, last) {   // each card slides and turns as warPlan has it; a drum roll at a tie, the down cards; then the result
  const w = f.war;
  if (!w) return;
  const plan = warPlan(w), n = plan.battles.length;
  plan.battles.forEach((t, k) => {
    add('cardSlide', t.pAt); add('cardFlip', t.pFlip); add('cardSlide', t.dAt); add('cardFlip', t.dFlip);
    if (k < n - 1) { add('warDrum', t.judge); for (let i = 0; i < WAR.down; i++) add('cardSlide', t.downAt + i * WART.down); }
  });
  if (w.result === 'win') { add('ding', plan.end); if (w.gain > 1) add('ding', plan.end + 170); }
  else add('nopair', plan.end);
  return;
}
