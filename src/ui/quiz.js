// The pick-an-answer games' shared pieces (Trivia, Patterns, Odd One Out): a pick is pressed in at once, its verdict
// lands QUIZ.beat later (the tick or the cross over its letter, the glow or the shake, the sound and the buzz), and a
// right one's point flies from the pick to the scorer's pip, which fills as it lands (ui/cardfly.js: the pick is the
// anchor 'qpick'). All of it is timed from the move's event, live and in replays (the view passes `t`, the verdict's
// moment into the move); with reduced motion nothing flies and the views draw the settled state alone.
import { cfAnchor, cfFrom } from './cardfly.js';
import { REDUCED } from './app.js';

export const QUIZ = { beat: 250, fly: 300, wave: 70 };   // ms: the verdict after the pick; the point's flight to its pip; a won square's pips hop this far apart
const TICK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 12.6l4.4 4.3 8.6-9.4"/></svg>';
const CROSS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17"/></svg>';
// The badge over an option's letter: 'ok' (the tick, green) or 'no' (the cross, red); fresh: it pops in at its button's --t.
export const qMark = (kind, fresh) => `<i class="qmk ${kind}${fresh && !REDUCED ? ' appear' : ''}">${kind === 'ok' ? TICK : CROSS}</i>`;
export const qPick = () => cfAnchor('qpick');                 // on the picked option's letter (or tile): where a point flies from
// A tally's pips. `fresh`: this move's right pick filled the last one: its point leaves the pick at `t` (ms into the
// move) and the pip fills as it lands; `won`: that pick took the square: the pips hop in a wave after it.
export function quizPips(p, n, goal, fresh, t, won) {
  const late = !!fresh && t != null, fly = late && !REDUCED, land = late ? Math.round(t + (fly ? QUIZ.fly : 0)) : null, wave = fly && won;
  return `<span class="pips qpips${wave ? ' qwon' : ''}" aria-label="${n} of ${goal}"${wave ? ` style="--w:${land + 260}ms"` : ''}>${Array.from({ length: goal }, (_, k) => {
    const last = late && k === n - 1;
    return `<i class="${k < n ? 'on' : ''}${last ? ' fillin' : ''}"${last ? ` style="--t:${land}ms;--k:${k}"` : wave ? ` style="--k:${k}"` : ''}>${last && fly ? `<b class="qtok"${cfFrom('qpick', t, { d: QUIZ.fly, go: true })}></b>` : ''}</i>`;
  }).join('')}</span>`;
}
// The point's sound as it lands on the pip (a view's `sounds` adds it after the verdict's own): [name, ms]. A soft pop,
// not one of the result sounds (ui/haptics.js RESULT_SOUNDS): the move's buzz stays with the verdict's ding.
export const quizPoint = t => ['pop', t + QUIZ.fly];
