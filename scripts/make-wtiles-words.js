// Word Tiles' word list (src/games/wtiles/words.js), written from ENABLE (public domain: the Enhanced North American
// Benchmark Lexicon, e.g. https://raw.githubusercontent.com/dolph/dictionary/master/enable1.txt):
//   node scripts/make-wtiles-words.js path/to/enable1.txt
// The words of 2 to 7 letters (a 7x7 board, a rack of 7), lowercase a-z only, without the offensive ones (the
// username profanity list, core/badwords.js, as Five Letters keeps them out, and the roots below at the start of a
// word), sorted, then each written as the letters it shares with the word before (one digit) and the rest: about half
// the size, rebuilt into a Set on first use (src/games/wtiles/rules.js wtDict).
const fs = require('fs');
const path = require('path');

const src = process.argv[2];
if (!src || !fs.existsSync(src)) { console.error('usage: node scripts/make-wtiles-words.js enable1.txt'); process.exit(1); }
(async () => {
  const { BADWORDS, BAD_EXTRA, BAD_EXTRA_TOKENS } = await import(path.join(__dirname, '..', 'src', 'core', 'badwords.js'));
  const bad = new Set(BADWORDS.concat(BAD_EXTRA, BAD_EXTRA_TOKENS).map(w => String(w).toLowerCase().replace(/[^a-z]/g, '')).filter(Boolean));
  // roots no word of the list may start with (slurs and the strongest swearing; kept short of ordinary words)
  const ROOTS = ['nigg', 'nigr', 'fuck', 'cunt', 'shit', 'fagg', 'fagot', 'twat', 'whore', 'slut', 'kike', 'dyke', 'wank', 'jizz', 'bitch', 'bastard', 'retard', 'chink', 'gook', 'wetback', 'piss', 'dildo', 'orgasm', 'penis', 'vagin', 'pussy', 'cocksuck', 'porn', 'rapist', 'tranny', 'spic', 'coon', 'darkie', 'negro', 'beaner', 'nazi'];   // (the ordinary words they would take are kept: KEEP)
  const KEEP = new Set(['niggle', 'niggled', 'niggler', 'niggles', 'spica', 'spicae', 'spicas', 'spicate', 'spice', 'spiced', 'spicer', 'spicers', 'spicery', 'spices', 'spicey', 'spicier', 'spicily', 'spicing', 'spicula', 'spicule', 'spicy', 'cooncan', 'coontie', 'negroni', 'beanery']);   // (ordinary words a root above would take)
  const words = fs.readFileSync(src, 'utf8').split(/\r?\n/).map(w => w.trim().toLowerCase())
    .filter(w => /^[a-z]{2,7}$/.test(w) && !bad.has(w) && (KEEP.has(w) || !ROOTS.some(r => w.startsWith(r))));
  const list = [...new Set(words)].sort();
  let prev = '', out = '';
  for (const w of list) {
    let k = 0; while (k < 6 && k < prev.length && k < w.length - 1 && prev[k] === w[k]) k++;
    out += k + w.slice(k); prev = w;
  }
  const file = path.join(__dirname, '..', 'src', 'games', 'wtiles', 'words.js');
  fs.writeFileSync(file, `// Word Tiles' word list: ENABLE (public domain), 2 to 7 letters, the offensive words left out (written by\n// scripts/make-wtiles-words.js; do not edit by hand). Each word is the count of letters it shares with the one before\n// (a digit) and the rest (rules.js wtDict decodes it). ${list.length} words.\nexport const WT_WORDS = '${out}';\nexport const WT_COUNT = ${list.length};\n`);
  console.log(`${list.length} words, ${out.length} characters`);
})();
