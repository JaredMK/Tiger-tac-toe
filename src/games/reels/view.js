// Fruit Reels: the screen, the miniature, the move's words and sounds.
// The machine: three reel windows in a cabinet, a pay strip under them (what each match scores), a reserved result
// line, a Hold button under each reel (hold that reel of your last spin and spin the other two) and the big Spin. A
// spin: each spun reel runs its strip down and stops left to right (REELS.stop), a held one stands under its HELD tag;
// then the verdict (REELS.judge): the matched reels light up, the words say the match alone, the score counts on.
// The pictures are original drawings (a pair of cherries, a lemon, a bell, a star). Timed from the move (rules.js REELS).
import { MOVES, REELS, reelsCfg } from './rules.js';
import { mv } from '../../ui/app.js';
import { lateAt } from '../../ui/progress.js';
import { thumbArt } from '../../ui/thumbs.js';
import { barRows, ptsTally } from '../../ui/tok.js';

export const ownLine = true;
const ART = [
  '<path d="M20 5c-2 6-7 9-9 16M20 5c1 6 5 10 9 15" fill="none" stroke="#2e7d32" stroke-width="2.6" stroke-linecap="round"/><path d="M20 5c4-3 9-2 11 1-4 2-8 2-11-1z" fill="#43a047" stroke="#161210" stroke-width="1.6"/><circle cx="11" cy="27" r="8" fill="#e53935" stroke="#161210" stroke-width="2.4"/><circle cx="29" cy="26" r="8" fill="#e53935" stroke="#161210" stroke-width="2.4"/><path d="M7 24c1-2 3-3 5-3M25 23c1-2 3-3 5-3" stroke="#fff" stroke-width="2" stroke-linecap="round" fill="none"/>',
  '<path d="M4 21c1-9 9-15 17-14 5 0 8-3 11-2 3 2 4 6 3 10-1 9-8 17-18 17-5 0-8 2-11 0-3-3-3-7-2-11z" fill="#fdd835" stroke="#161210" stroke-width="2.4" stroke-linejoin="round"/><path d="M11 20c1-4 5-7 9-7" stroke="#fff" stroke-width="2.2" stroke-linecap="round" fill="none"/>',
  '<path d="M20 5c-7 0-11 5-11 13 0 6-3 8-5 11h32c-2-3-5-5-5-11 0-8-4-13-11-13z" fill="#ffb300" stroke="#161210" stroke-width="2.4" stroke-linejoin="round"/><circle cx="20" cy="33" r="3.4" fill="#8d6e63" stroke="#161210" stroke-width="2"/><path d="M14 14c1-3 3-5 6-5" stroke="#fff" stroke-width="2.2" stroke-linecap="round" fill="none"/><path d="M6 25h28" stroke="#161210" stroke-width="2"/>',
  '<path d="M20 3l4.9 10.6 11.6 1.3-8.6 7.9 2.4 11.4L20 28.400 9.700 34.200l2.400-11.400-8.600-7.900 11.600-1.300z" fill="#4fc3f7" stroke="#161210" stroke-width="2.4" stroke-linejoin="round"/><path d="M15 15l5-5" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/>',
];
export const reelSvg = (k, cls) => `<svg class="frsym${cls ? ' ' + cls : ''}" viewBox="0 0 40 40" aria-hidden="true">${k == null || k < 0 ? '<text x="20" y="29" text-anchor="middle" class="frq">?</text>' : ART[k]}</svg>`;
const SPINS = 9;                                                  // the pictures a spinning reel runs past before its own
function words(c, s) {
  if (s.kind === 'stars') return 'Three stars!';
  if (s.kind === 'tri') return `Three ${REELS.plural[s.sym]}! +${s.pts}`;
  if (s.kind === 'pair') return `Two ${REELS.plural[s.sym]}! +${s.pts}`;
  return 'No match';
}
export function screen(sq, f, d, mini, view, locked, a, anim, won, wk, fresh, turn, g) {
  const c = reelsCfg(mini), s = a && a.rl3 ? a.rl3 : null, o = { view, locked, turn }, by = s ? a.by : turn;
  const shown = s ? s.v : (view || d) && mini.last ? mini.last.v : mini.reels[turn];
  const rest = !s && (view || d) && mini.last ? mini.last : null;   // (the last spin on show once played: its match stays lit)
  const tal = p => ptsTally(p, o, c.target, mini.score[p], s && a.by === p ? s.from : null, REELS.judge);
  const reel = k => {
    const spun = s && s.h !== k, hit = (s || rest) && (s || rest).cells.includes(k);
    const strip = spun ? `<div class="frstrip" style="--n:${SPINS + 2};--t:${REELS.stop[k]}ms">${reelSvg(s.v[k])}${Array.from({ length: SPINS }, (_, j) => reelSvg((s.v[k] + 1 + j * 3 + k) % REELS.n)).join('')}${reelSvg(s.was ? s.was[k] : null)}</div>` : reelSvg(shown ? shown[k] : null);
    return `<div class="frreel${spun ? ' spin' : ''}${s && s.h === k ? ' held' : ''}${hit ? (s ? ' hit late' : ' hit') : ''}">${strip}${s && s.h === k ? '<b class="frheld">Held</b>' : ''}</div>`;
  };
  const pay = `<div class="frpay" role="img" aria-label="Two alike ${c.pair}. Three cherries ${c.tri[0]}, lemons ${c.tri[1]}, bells ${c.tri[2]}. Three stars ${c.stars ? 'win' : c.tri[3]}."><span><b>2×</b><i>+${c.pair}</i></span>${[0, 1, 2].map(k => `<span>${reelSvg(k)}<b>×3</b><i>+${c.tri[k]}</i></span>`).join('')}<span>${reelSvg(3)}<b>×3</b><i>${c.stars ? 'WIN' : '+' + c.tri[3]}</i></span></div>`;
  const line = s ? `<p ${lateAt('frline ' + (s.kind === 'none' ? 'no' : 'ok'), REELS.judge)} role="status">${words(c, s)}</p>` : `<p class="frline${rest ? (rest.kind === 'none' ? ' no' : ' ok') : ''}">${rest ? words(c, rest) : ''}</p>`;
  const can = !view && !locked && !!mini.reels[turn];
  const holds = view ? '' : `<div class="frholds">${[0, 1, 2].map(k => `<button class="btn frhold" data-act="move" ${mv(MOVES[k + 1])}${can ? '' : ' disabled'} aria-label="Hold reel ${k + 1} and spin the others">Hold</button>`).join('')}</div>`;
  const spin = view ? '' : `<button class="big ${turn} frspin" data-act="move" ${mv('spin')}${locked ? ' disabled' : ''}>Spin</button>`;
  return `<div class="g-fr pc-${by}" style="--tj:${REELS.judge}ms"><div class="ctals two">${tal('X')}${tal('O')}</div>
    <div class="frcab"><div class="frwin">${reel(0)}${reel(1)}${reel(2)}</div>${holds}${pay}</div>${line}${spin}</div>`;
}
// The miniature: the machine's three windows with the last spin's pictures, over each player's points as a bar.
export function miniature(mini, final) {
  const c = reelsCfg(mini), v = mini.last ? mini.last.v : null;
  const art = `<div class="tfr">${[0, 1, 2].map(k => `<i>${reelSvg(v ? v[k] : k)}</i>`).join('')}</div>`;
  return thumbArt(art, barRows(mini.score, c.target), 'tfrw col', `Fruit Reels: X ${mini.score.X}, O ${mini.score.O} of ${c.target} points`);
}
export function moveText(f, who) {
  const s = f.rl3; if (!s) return `${who} spun`;
  return s.kind === 'stars' ? `${who} spun three stars` : s.kind === 'none' ? `${who} spun no match` : `${who} spun ${s.kind === 'tri' ? 'three' : 'two'} ${REELS.plural[s.sym]} for ${s.pts}`;
}
// The reels' whirr, a clack as each one stops, then the verdict: a ding for a pair, a ding and a sparkle for three alike
// (the stars: the sparkle first), a soft thud for nothing.
export function sounds(f, add, won, mini, last) {
  const s = f.rl3; if (!s) return;
  add('frSpin', 0);
  [0, 1, 2].forEach(k => { if (s.h !== k) add('frStop', REELS.stop[k], 0.9 + k * 0.08); });
  if (s.kind === 'none') add('thud', REELS.judge);
  else { add('ding', REELS.judge); if (s.kind !== 'pair') add('sparkle', REELS.judge + 140); }
}
