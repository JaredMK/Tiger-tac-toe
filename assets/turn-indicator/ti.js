// The your-turn indicator comparison (turn-indicator.html, staging only): a sample board per option, a Simulate button
// that ends the other player's move and plays the real moment, a tap counter, the chime and the buzz.
const HASH = [[[100.5, 8], [98, 92], [102.5, 206], [99.5, 292]], [[200, 9], [202.5, 96], [197.5, 196], [200.5, 291]], [[8, 100], [96, 102], [206, 97.5], [292, 100.5]], [[9, 199.5], [101, 198], [194, 202.5], [291, 200]]];
const HASH_D = HASH.map(([a, b, c, d]) => `M${a[0]} ${a[1]}C${b[0]} ${b[1]} ${c[0]} ${c[1]} ${d[0]} ${d[1]}`).join('');
const face = (y, mx) => `<g class="eyes"><ellipse class="eye" cx="${50 - mx}" cy="${y}" rx="6.5" ry="9"/><ellipse class="eye" cx="${50 + mx}" cy="${y}" rx="6.5" ry="9"/><ellipse class="pup" cx="${51.5 - mx}" cy="${y + 2}" rx="3.4" ry="5.6"/><ellipse class="pup" cx="${51.5 + mx}" cy="${y + 2}" rx="3.4" ry="5.6"/></g>`;
const toon = p => `<svg class="pc p${p}" viewBox="0 0 100 100" aria-hidden="true">${p === 'X'
  ? `<path class="ol" d="M22 20 L78 80 M78 20 L22 80"/><path class="fl" d="M22 20 L78 80 M78 20 L22 80"/>${face(44, 8)}<path class="mouth" d="M42 60 Q50 67 58 60"/>`
  : `<circle class="ol" cx="50" cy="50" r="32"/><circle class="fl" cx="50" cy="50" r="32"/>${face(46, 7)}<path class="mouth" d="M43 59 Q50 65 57 59"/>`}</svg>`;

// The sample board: two squares won, seven open with a game's name and a small picture of it.
const SQ = [
  { own: 'O' }, { name: 'Risky Rolls', art: 'dice' }, { name: 'Five Letters', art: 'word' },
  { name: 'Four in a Row', art: 'c4' }, { own: 'X' }, { name: 'Sea Battle', art: 'sea' },
  { name: 'Pool', art: 'pool' }, { name: 'Bingo', art: 'bingo' }, { name: 'Mini Golf', art: 'golf' },
];
const ART = {
  dice: '<i class="a-die"></i><i class="a-die b"></i>',
  word: '<i class="a-tiles"><b></b><b class="g"></b><b></b><b class="y"></b><b></b></i>',
  c4: '<i class="a-grid"></i>',
  sea: '<i class="a-sea"></i>',
  pool: '<i class="a-felt"><b></b><b class="o"></b><b class="w"></b></i>',
  bingo: '<i class="a-card"></i>',
  golf: '<i class="a-green"><b></b></i>',
};

const OPTS = [
  { k: 'now', n: 'Now', name: 'The live burst (for reference)', how: 'A "YOUR TURN!" burst over the middle of the board for about a second, your character hopping on it.', pro: 'Impossible to miss.', con: 'Covers the board every turn; you wait for it before you can read your squares.', ref: true },
  { k: 'lines', n: 1, name: 'The # lines light up', how: 'The board\'s four lines flash in your colour once, then keep a soft tint for as long as it\'s your turn.', pro: 'Right where you look; nothing new on screen; the tint says "still yours" all turn.', con: 'Quieter than a word: someone glancing from across a table might miss the flash.' },
  { k: 'banner', n: 2, name: 'Banner across the top bar', how: 'A comic "YOUR MOVE!" banner sweeps across the top bar and tucks into the turn bubble, which then stays in your colour.', pro: 'The most Comic Chaos of the five, and it lands where whose turn it is lives.', con: 'Above the board, so a player staring at a square catches it from the corner of their eye.' },
  { k: 'toon', n: 3, name: 'Your character pops', how: 'Your character in the top bar jumps up with a small "My go!" bubble beside the bar, which stays until you move.', pro: 'Warm and personal; tiny, and only ever on your side of the bar.', con: 'Small: easy to miss on a big phone or in a bright room.' },
  { k: 'ripple', n: 4, name: 'Open squares shimmer', how: 'A shine ripples out across the squares you can play, from the centre, then they rest with a faint ring in your colour.', pro: 'Says "your turn" and "these are yours to tap" in one.', con: 'Late in a match, with few open squares, it is a much smaller signal.' },
  { k: 'edge', n: 5, name: 'Screen edge glows', how: 'The screen\'s edge pulses once in your colour, then keeps a thin glow round the edge while it\'s your turn.', pro: 'Seen even out of the corner of your eye, and on any screen, in a square or on the board.', con: 'Edges are already busy (the notch, "Connection lost"): it can read as an alert rather than a turn.' },
];

let ctx = null, sound = true;
function chime() {
  if (!sound) return;
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    const t = ctx.currentTime + 0.02;
    for (const [f, at] of [[659.25, 0], [987.77, 0.12]]) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'triangle'; o.frequency.value = f;
      g.gain.setValueAtTime(0, t + at); g.gain.linearRampToValueAtTime(0.16, t + at + 0.015); g.gain.exponentialRampToValueAtTime(0.001, t + at + 0.28);
      o.connect(g).connect(ctx.destination); o.start(t + at); o.stop(t + at + 0.3);
    }
  } catch (e) { /* (no audio: the note still shows) */ }
}
function buzz() { try { if (navigator.vibrate) navigator.vibrate([22, 80, 22]); } catch (e) { /* none */ } }

function board() {
  return `<div class="board">${SQ.map((s, i) => s.own
    ? `<button class="sq own own-${s.own}" data-i="${i}" aria-label="Square ${i + 1}, won by ${s.own}">${toon(s.own)}</button>`
    : `<button class="sq open" data-i="${i}" aria-label="Square ${i + 1}: ${s.name}"><span class="lab">${s.name}</span><span class="art">${ART[s.art]}</span></button>`).join('')}
    <svg class="hash" viewBox="0 0 300 300" preserveAspectRatio="none" aria-hidden="true"><path d="${HASH_D}"/></svg></div>`;
}
function phone(o) {
  return `<div class="ph o-${o.k} theirs" data-k="${o.k}">
    <div class="hdr"><div class="tbar"><span class="menu">Menu</span>
      <div class="vs"><span class="side me">${toon('X')}<b>You</b><i class="clk">4:52</i></span><b class="vsw">VS</b><span class="side them"><i class="clk">4:40</i><b>Sam</b>${toon('O')}</span></div></div>
      <div class="turnrow"><span class="bub"><span class="t-them">Sam's move</span><span class="t-me">Your move!</span></span>${o.k === 'toon' ? '<span class="say" aria-hidden="true">My go!</span>' : ''}</div>
      ${o.k === 'banner' ? '<div class="banner" aria-hidden="true"><b>YOUR MOVE!</b></div>' : ''}</div>
    ${board()}
    <div class="foot"><span class="wait">Sam is playing… 0:12</span></div>
    ${o.k === 'edge' ? '<i class="edge" aria-hidden="true"></i>' : ''}
    ${o.k === 'now' ? `<div class="burst" aria-hidden="true"><svg viewBox="0 0 300 190"><polygon points="150,8 172,40 214,22 212,62 262,58 232,92 280,120 228,128 238,172 192,150 168,184 146,152 112,180 104,140 58,160 72,120 24,100 70,82 44,44 96,54 108,14 132,44"/><text x="150" y="112" text-anchor="middle">YOUR TURN!</text></svg><span class="bt">${toon('X')}</span></div>` : ''}
  </div>`;
}
function card(o) {
  return `<article class="card${o.ref ? ' ref' : ''}" id="opt-${o.k}">
    <h2><span class="num">${o.n}</span>${o.name}</h2>
    <div class="stage">${phone(o)}</div>
    <div class="row"><button class="pn ${o.ref ? 'w' : 'y'} sim" data-k="${o.k}"><b>Simulate turn change</b></button></div>
    <p class="note"><span class="cue" data-k="${o.k}">♪ chime · bzz-bzz</span><span class="taps" data-k="${o.k}">Taps counted: 0</span></p>
    <p class="how">${o.how}</p>
    <p class="pc2"><b class="plus">+</b> ${o.pro}</p><p class="pc2"><b class="minus">−</b> ${o.con}</p>
  </article>`;
}

const grid = document.getElementById('opts');
grid.innerHTML = OPTS.map(card).join('');
const taps = {};
const timers = {};
function simulate(k) {
  const ph = grid.querySelector(`.ph[data-k="${k}"]`), cue = grid.querySelector(`.cue[data-k="${k}"]`);
  if (!ph) return;
  clearTimeout(timers[k]);
  ph.classList.remove('mine', 'go'); ph.classList.add('theirs');
  void ph.offsetWidth;                                                  // (the animations start afresh)
  timers[k] = setTimeout(() => {                                         // the other player's move ends: it is yours
    ph.classList.remove('theirs'); ph.classList.add('mine', 'go');
    chime(); buzz();
    cue.classList.remove('on'); void cue.offsetWidth; cue.classList.add('on');
  }, 450);
}
grid.addEventListener('click', e => {
  const sim = e.target.closest('.sim');
  if (sim) { simulate(sim.dataset.k); return; }
  const sq = e.target.closest('.sq');
  if (sq) {
    const ph = sq.closest('.ph'), k = ph.dataset.k;
    taps[k] = (taps[k] || 0) + 1;
    grid.querySelector(`.taps[data-k="${k}"]`).textContent = `Taps counted: ${taps[k]}`;
    sq.classList.remove('hit'); void sq.offsetWidth; sq.classList.add('hit');
  }
});
// Back to back: each option in turn, its card lit, about 2.6 s apart.
let all = null;
const allBtn = document.querySelector('[data-act="all"]');
allBtn.addEventListener('click', () => {
  if (all) { clearTimeout(all.t); document.querySelectorAll('.card.lit').forEach(c => c.classList.remove('lit')); all = null; allBtn.setAttribute('aria-pressed', 'false'); allBtn.querySelector('b').textContent = 'Play all, back to back'; return; }
  const ks = OPTS.filter(o => !o.ref).map(o => o.k);
  all = { i: 0 };
  allBtn.setAttribute('aria-pressed', 'true'); allBtn.querySelector('b').textContent = 'Stop';
  const step = () => {
    document.querySelectorAll('.card.lit').forEach(c => c.classList.remove('lit'));
    const k = ks[all.i % ks.length];
    document.getElementById('opt-' + k).classList.add('lit');
    simulate(k);
    all.i++;
    all.t = setTimeout(step, 2600);
  };
  step();
});
const sBtn = document.querySelector('[data-act="sound"]');
sBtn.addEventListener('click', () => { sound = !sound; sBtn.setAttribute('aria-pressed', String(sound)); sBtn.querySelector('b').textContent = `Sound: ${sound ? 'on' : 'off'}`; });
