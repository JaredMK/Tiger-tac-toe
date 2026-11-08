// The # of every board picture (November 2026): four bold, slightly wavering strokes with round ends, in a 300x300
// box (the lines near a third and two thirds, stopping short of the edges), and no boxes or outer frame. One drawing
// for the main board, the result screen's final board, the history snapshot, the share card and the link-preview
// image (scripts/make-share-images.js). Pure: no page, no imports.
export const HASH = [   // each stroke a cubic: start, two controls, end
  [[101, 9], [96, 92], [105, 206], [99, 291]],
  [[200, 10], [204, 96], [195, 196], [201, 290]],
  [[9, 100], [96, 104], [206, 95], [291, 101]],
  [[10, 199], [101, 196], [194, 205], [290, 200]],
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
