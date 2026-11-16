// "Report a problem" (the in-game menu, and Settings anywhere: December 2026): an optional short note, at most 140
// characters. Sending it goes to the server (net/tracking.js sendReport: kept, the match flagged in its log when there
// is one, the admin alerted); the dialog says "Sending…" and only says "Thanks" once the server has it, else "Not sent"
// with the note kept to try again. A dialog of its own outside #app: the page's redraws never touch what is being typed.
import { SND } from '../audio/sound.js';
import { reportWhere, sendReport } from '../net/tracking.js';

let dlg = null, busy = false;
const MAX = 140;
export const reportOpen = () => !!dlg;
const form = (note, why) => `<h2>Report a problem</h2><p>What went wrong? (optional)</p>
    <textarea id="repnote" maxlength="${MAX}" rows="3" placeholder="A short note"></textarea><div class="repleft" aria-live="polite">${MAX - note.length} left</div>
    ${why ? `<div class="repwhy" role="alert">${why}</div>` : ''}
    <div class="row"><button class="btn" data-rep="cancel">Cancel</button><button class="btn go" data-rep="send">${why ? 'Try again' : 'Send'}</button></div>`;
export function openReport(where) {
  if (dlg) return;
  const at = where || reportWhere();
  dlg = document.createElement('div');
  dlg.className = 'flash pause repdlg';
  dlg.setAttribute('role', 'dialog'); dlg.setAttribute('aria-label', 'Report a problem');
  const card = document.createElement('div');
  card.className = 'card';
  dlg.appendChild(card);
  document.body.appendChild(dlg);
  let note = '';
  const show = why => {
    card.innerHTML = form(note, why);
    const ta = card.querySelector('textarea'), left = card.querySelector('.repleft');
    ta.value = note;
    ta.addEventListener('input', () => { if (ta.value.length > MAX) ta.value = ta.value.slice(0, MAX); note = ta.value; left.textContent = `${MAX - ta.value.length} left`; });
  };
  show('');
  dlg.addEventListener('click', async e => {
    const b = e.target.closest('[data-rep]');
    if (!b || busy) return;
    SND.play('click');
    if (b.dataset.rep !== 'send') { closeReport(); return; }
    const ta = card.querySelector('textarea');
    if (ta) note = ta.value;
    busy = true;
    card.innerHTML = '<h2>Report a problem</h2><p class="repbusy" aria-live="polite">Sending…</p>';
    const ok = await sendReport(note, at);
    busy = false;
    if (!dlg) return;                                             // (closed while it went)
    if (ok) card.innerHTML = '<h2>Thanks</h2><p>Your report is in. We\'ll take a look.</p><div class="row"><button class="btn go" data-rep="cancel">Close</button></div>';
    else show('Not sent. Check your connection and try again.');
  });
}
export function closeReport() { if (dlg) { dlg.remove(); dlg = null; } busy = false; }
