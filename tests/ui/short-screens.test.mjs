// Short screens (December 2026): iOS Safari's visible area with its toolbars up is about 390x660, shorter than 100vh. Every
// size a menu screen takes from the viewport's height comes from --u (the small viewport's unit, 1svh; 1vh where unknown),
// never a raw vh, so the setup screens fit without scrolling; the ahead pip has its own strip in the square's label row;
// a game's name in the Mini-games list keeps the overhang of its last letter. (The real fit is measured in a browser at
// 390x660 and 360x640: CLAUDE.md, layout checks.)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = f => readFileSync(new URL(`../../src/ui/${f}`, import.meta.url), 'utf8');
const comic = read('comic.css'), styles = read('styles.css'), board = read('board.js');

test('--u is the small viewport unit, and comic.css sizes from it (a raw vh only in the confetti keyframes)', () => {
  assert.match(styles, /:root \{ --u: 1vh; \}\s*@supports \(height: 1svh\) \{ :root \{ --u: 1svh; \} \}/);
  const raw = comic.split('\n').filter(l => /(?<![\w.])\d+(\.\d+)?vh\b/.test(l) && !/ccfall/.test(l));
  assert.deepEqual(raw, [], 'no raw vh sizes outside the confetti');
  assert.match(comic, /height: clamp\(66px, calc\(13 \* var\(--u\)\), 104px\)/, 'Start');
});
test('the setup screens tighten under 700px tall', () => {
  assert.match(comic, /@media \(max-height: 700px\) \{\s*:is\(\.hostset, \.sameset, \.join-scr\) \.setup-box \{ gap: 8px; \}/);
});
test('the ahead pip sits in the label row\'s reserved strip, not over the miniature', () => {
  assert.match(board, /info\.name\.replace\('\/', '\/<wbr>'\)\}<\/span>\$\{lead \? `<i class="leadp/, 'a name with a slash may break after it (Higher/Lower) so the narrower label never spills');
  assert.match(board, /<\/span>\$\{lead \? `<i class="leadp \$\{lead\}" aria-hidden="true"><\/i>` : ''\}<\/div><div class="thumb/, 'the pip is the label row\'s last child');
  assert.doesNotMatch(board, /\+ \(lead \? `<i class="leadp/, 'no pip laid over the square');
  assert.match(comic, /\.board-scr:not\(\.review-scr\) \.board \.sq \.lab \{ position: relative; padding-right: 15px; \}/, 'the strip is reserved on every square');
  assert.match(comic, /\.board \.sq \.lab \.leadp \{ position: absolute; top: 0; right: 0;/);
});
test('the Mini-games list names keep their last letter\'s overhang', () => {
  assert.match(comic, /\.cc \.chk span \{ padding-right: \.25em; padding-bottom: 2px; margin-right: -\.25em; \}/);
});

test('How to Play: the WIN! burst sits in the panel\'s top band, above the grid, not over a mark or the text', () => {
  assert.match(comic, /\.cc \.cpanel\.half \{ padding-top: 46px; \}\n\.cc \.hwinb \{ position: absolute; right: -4px; top: -42px; width: 64px;/);
});

test('Play Computer says "Computer difficulty" (not "Level"), in both of its setups', () => {
  const setup = readFileSync(new URL('../../src/ui/screens/setup.js', import.meta.url), 'utf8');
  assert.match(setup, /cap\('computer difficulty'\)/);
  assert.match(setup, /<span>Computer difficulty<\/span>/);
  assert.doesNotMatch(setup, /cap\('level'\)/);
});
