// "Report a problem" (the in-game menu): an optional short note, at most 140 characters; sending it flags the
// match for the admin's match inspector and stamps the moment in its log (net/tracking.js reportProblem). A
// dialog of its own over the menu, outside #app: the page's redraws never touch what is being typed.
import { SND } from '../audio/sound.js';
import { canReport, reportProblem } from '../net/tracking.js';

let dlg = null;
const MAX = 140;
export const reportOpen = () => !!dlg;
export function openReport() {
  if (dlg || !canReport()) return;
  dlg = document.createElement('div');
  dlg.className = 'flash pause repdlg';
  dlg.setAttribute('role', 'dialog'); dlg.setAttribute('aria-label', 'Report a problem');
  dlg.innerHTML = `<div class="card"><h2>Report a problem</h2><p>What went wrong? (optional)</p>
    <textarea id="repnote" maxlength="${MAX}" rows="3" placeholder="A short note"></textarea><div class="repleft" aria-live="polite">${MAX} left</div>
    <div class="row"><button class="btn" data-rep="cancel">Cancel</button><button class="btn go" data-rep="send">Send</button></div></div>`;
  document.body.appendChild(dlg);
  const ta = dlg.querySelector('textarea'), left = dlg.querySelector('.repleft');
  ta.addEventListener('input', () => { if (ta.value.length > MAX) ta.value = ta.value.slice(0, MAX); left.textContent = `${MAX - ta.value.length} left`; });
  dlg.addEventListener('click', e => {
    const b = e.target.closest('[data-rep]');
    if (!b) return;
    SND.play('click');
    if (b.dataset.rep === 'send') {
      const ok = reportProblem(ta.value);
      dlg.querySelector('.card').innerHTML = `<h2>${ok ? 'Thanks' : 'Not sent'}</h2><p>${ok ? 'The match is flagged for a look.' : 'There is no match to report here.'}</p><div class="row"><button class="btn go" data-rep="cancel">Close</button></div>`;
      return;
    }
    closeReport();
  });
}
export function closeReport() { if (dlg) { dlg.remove(); dlg = null; } }
