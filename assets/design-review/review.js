// Design review (staging only): the mock-ups' sound cues (synthesised, one voice a direction) and "Replay motion".
// Nothing here is loaded by the game.
(() => {
  let ac = null;
  const ctx = () => { if (!ac) { const C = window.AudioContext || window.webkitAudioContext; if (C) ac = new C(); } if (ac && ac.state === 'suspended') ac.resume(); return ac; };
  const PENTA = [0, 2, 4, 7, 9, 12, 14];                                  // a note a button: a pentatonic run
  const hz = n => 262 * Math.pow(2, PENTA[n % PENTA.length] / 12);
  function tone(a, type, f0, f1, t, dur, gain) {
    const o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(a, t, dur, gain, freq, q) {
    const n = Math.floor(a.sampleRate * dur), b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.2);
    const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    s.buffer = b; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q; g.gain.value = gain;
    s.connect(f).connect(g).connect(a.destination); s.start(t);
  }
  const VOICE = {
    // A, Patchwork: a soft pitched thump, a different note a patch; the last note (Start, Rematch) runs up
    A(a, n, t) { const f = hz(n); tone(a, 'sine', f * 1.5, f, t, 0.16, 0.22); tone(a, 'triangle', f * 2, f * 2, t, 0.07, 0.05); if (n === 6) [0, 2, 4].forEach((k, i) => tone(a, 'sine', hz(k + 3) * 1.5, hz(k + 3), t + 0.07 * (i + 1), 0.14, 0.16)); },
    // B, Sticker book: a paper slap and a pencil tick
    B(a, n, t) { noise(a, t, 0.09, 0.5, 1400 + n * 160, 0.8); tone(a, 'triangle', 190 + n * 14, 120, t, 0.07, 0.12); if (n === 6) noise(a, t + 0.09, 0.14, 0.4, 3200, 1.6); },
    // C, Comic chaos: a punchy blip; Start and Rematch get a "bam"
    C(a, n, t) { const f = hz(n) * 0.75; tone(a, 'square', f, f * 1.9, t, 0.09, 0.09); if (n === 6) { tone(a, 'sawtooth', 220, 60, t + 0.05, 0.28, 0.16); noise(a, t + 0.05, 0.2, 0.45, 700, 0.6); } },
  };
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-snd]');
    if (b) { const a = ctx(); if (a) VOICE[b.dataset.snd](a, Number(b.dataset.n) || 0, a.currentTime + 0.005); return; }
    const r = e.target.closest('[data-replay]');
    if (r) {                                                              // the row's mock-ups, built again: every entrance plays from its start
      const row = document.querySelector(`[data-row="${r.dataset.replay}"]`);
      if (row) row.querySelectorAll('.phw').forEach(w => { const p = w.firstElementChild; if (p && !p.classList.contains('now')) w.replaceChild(p.cloneNode(true), p); });
    }
  });
})();
