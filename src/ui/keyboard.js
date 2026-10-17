// The on-screen keyboard (Wordle, Hangman).
import { attemptMove, showNotice } from '../net/moves.js';
import { app, commit, mv, state, zoomedType } from './app.js';

const BKSP = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 5H8l-5 7 5 7h13a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1z"/><path d="m18 9-6 6M12 9l6 6"/></svg>';

// The text field being typed in, to give it back its focus after a re-render (a room update, a sign-in).
export function typingIn() {
  const el = document.activeElement;
  if (!el || el.tagName !== 'INPUT' || !app.contains(el)) return null;
  const sel = el.id ? '#' + el.id : el.dataset.p ? `input[data-p="${el.dataset.p}"]` : el.dataset.ln ? `input[data-ln="${el.dataset.ln}"]` : null;
  if (!sel) return null;
  let start = null, end = null;
  try { start = el.selectionStart; end = el.selectionEnd; } catch (e) { /* (email fields have no selection) */ }
  return { sel, start, end };
}
export function refocus(f) {
  const el = app.querySelector(f.sel);
  if (!el) return;
  el.focus({ preventScroll: true });
  try { if (f.start != null) el.setSelectionRange(f.start, f.end); } catch (e) { /* (email fields) */ }
}
// QWERTY keyboard. With `extra` the keys type into the Wordle draft; without it each key is a Hangman move.
export function keyboard(cls, disabled, extra) {
  const rows = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
  return `<div class="kb">${rows.map((row, ri) => `<div class="krow">${ri === 2 && extra ? `<button class="key wide" data-act="enter"${extra.enter ? ' disabled' : ''}>Enter</button>` : ''}${row.split('').map(k =>
    `<button class="key ${cls(k)}" data-act="${extra ? 'key' : 'move'}" ${extra ? `data-k="${k}"` : mv(k)} aria-label="${k}"${disabled(k) ? ' disabled' : ''}>${k}</button>`
  ).join('')}${ri === 2 && extra ? `<button class="key wide" data-act="bksp" aria-label="Backspace"${extra.bksp ? ' disabled' : ''}>${BKSP}</button>` : ''}</div>`).join('')}</div>`;
}
export function typeLetter(k) {
  if (zoomedType() !== 'wordle' || (state.draft || '').length >= 5) return;
  state.draft = (state.draft || '') + k; commit();
}
export function backspace() {
  if (zoomedType() !== 'wordle' || !(state.draft || '').length) return;
  state.draft = state.draft.slice(0, -1); commit();
}
export function submitWord() {
  if (zoomedType() !== 'wordle' || (state.draft || '').length !== 5) return;
  const r = attemptMove(state.draft);
  if (r === true || r.ok) return;
  if (r.reason === 'notword') showNotice('Not a word', 1200);   // the guess stays typed and the turn is still theirs
}
