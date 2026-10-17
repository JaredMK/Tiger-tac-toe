// Small helpers shared by the engine and the games.

export function other(p) { return p === 'X' ? 'O' : 'X'; }
export const r3 = x => Math.round(x * 1000) / 1000 + 0;
export const clamp01 = x => (x < 0 ? 0 : x > 1 ? 1 : x);
export const r2 = x => Math.round(x * 100) / 100 + 0;                   // (+ 0: never a -0, which is not plain JSON)
