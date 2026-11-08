// The # of every board picture (November 2026): four bold, slightly wavering strokes with round ends, in a 300x300
// box (the lines near a third and two thirds, stopping short of the edges), and no boxes or outer frame. One drawing
// for the main board, the result screen's final board, the history snapshot, the share card and the link-preview
// image (scripts/make-share-images.js). Pure: no page, no imports.
export const HASH = [   // each stroke a cubic: start, two controls, end (a gentle waver: within 3 of its line, so the
                        // spaces keep their room; ui/styles.css pads each space by half the band the stroke can take)
  [[100.5, 8], [98, 92], [102.5, 206], [99.5, 292]],
  [[200, 9], [202.5, 96], [197.5, 196], [200.5, 291]],
  [[8, 100], [96, 102], [206, 97.5], [292, 100.5]],
  [[9, 199.5], [101, 198], [194, 202.5], [291, 200]],
];
const f = v => +v.toFixed(2);
// The path's d, scaled to a box of `size` (300: the viewBox).
export function hashD(size = 300) {
  const k = size / 300;
  return HASH.map(([a, b, c, d]) => `M${f(a[0] * k)} ${f(a[1] * k)}C${[b, c, d].map(p => `${f(p[0] * k)} ${f(p[1] * k)}`).join(' ')}`).join('');
}
// The # as inline SVG over its box (a board's own child, absolutely placed by its class). `width`: the stroke in
// viewBox units (the box is 300 across), coloured by currentColor.
export function hashSvg(cls, width = 8) {
  return `<svg class="${cls}" viewBox="0 0 300 300" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="${hashD()}" fill="none" stroke="currentColor" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
// The same strokes on a 2d canvas context, for the box at (x, y) of `size` (the caller strokes).
export function hashPath(ctx, x, y, size) {
  const k = size / 300;
  ctx.beginPath();
  for (const [a, b, c, d] of HASH) { ctx.moveTo(x + a[0] * k, y + a[1] * k); ctx.bezierCurveTo(x + b[0] * k, y + b[1] * k, x + c[0] * k, y + c[1] * k, x + d[0] * k, y + d[1] * k); }
}
