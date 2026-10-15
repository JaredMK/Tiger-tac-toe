'use strict';
// Downloads the Trivia questions once from the Open Trivia Database (opentdb.com, CC BY-SA 4.0) and
// writes them to trivia.json in the repo. The game never calls the API: this runs by hand, or from the
// "Fetch trivia questions" workflow, which commits the file. One request every 5 seconds (the API's
// limit), with a session token so no question comes twice.
//
//   node scripts/fetch-trivia.js [--out trivia.json] [--per 60] [--quick]
//
// Kept: multiple-choice questions, easy or medium, from a balanced set of categories (at most --per
// each), with HTML entities decoded. Dropped: anything time-sensitive (current officeholders, records,
// "as of" facts, prices, recent years), adult or crude, from the niche-fandom categories (anime and
// manga, comics, video games, cartoons) or about internet personalities, and anything too long for a
// phone screen. --quick fetches a few categories only (a dry run).
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const API = 'https://opentdb.com';
const GAP_MS = 5200;                                                   // the API allows one call per 5 seconds per IP
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const OUT = path.resolve(opt('--out', path.join(__dirname, '..', 'trivia.json')));
const PER_CATEGORY = Math.max(10, Number(opt('--per', 60)) || 60);
const QUICK = args.includes('--quick');

// Categories left out: niche fandom knowledge, or ones that date quickly.
const SKIP_CATEGORIES = [/anime|manga/i, /comics/i, /video games/i, /cartoon/i, /celebrities/i, /politics/i];

// ---------- HTML entities (the API's default encoding) ----------
const NAMED = { quot: '"', amp: '&', apos: "'", lt: '<', gt: '>', nbsp: ' ', hellip: '…', ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', deg: '°', eacute: 'é', egrave: 'è', ecirc: 'ê', agrave: 'à', aacute: 'á', acirc: 'â', auml: 'ä', aring: 'å', ccedil: 'ç', iacute: 'í', icirc: 'î', iuml: 'ï', oacute: 'ó', ocirc: 'ô', ouml: 'ö', oslash: 'ø', uacute: 'ú', ucirc: 'û', uuml: 'ü', ntilde: 'ñ', szlig: 'ß', Eacute: 'É', Aacute: 'Á', Ouml: 'Ö', Uuml: 'Ü', Auml: 'Ä', pound: '£', euro: '€', yen: '¥', cent: '¢', copy: '©', reg: '®', trade: '™', times: '×', divide: '÷', frac12: '½', frac14: '¼', frac34: '¾', pi: 'π', micro: 'µ', middot: '·', bull: '•', shy: '' };
function decode(s) {
  return String(s).replace(/&(#x[0-9a-f]+|#\d+|[a-z0-9]+);/gi, (m, e) => {
    if (e[0] === '#') { const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) ? String.fromCodePoint(n) : m; }
    return e in NAMED ? NAMED[e] : m;
  }).replace(/\s+/g, ' ').trim();
}

// ---------- the filters ----------
const TIME_SENSITIVE = [
  /\b(current(ly)?|as of|latest|most recent(ly)?|newest|recently|present(ly)?|incumbent|reigning|right now|to date|so far|this year|last year|today|nowadays|at the moment)\b/i,
  /\b(record|records|record-holder|holds? the (title|record)|oldest living|youngest ever|longest-running|longest running|still (alive|running|active|in office))\b/i,
  // a superlative is fine as a settled fact (the largest ocean); not as a standing record (the tallest building in the world)
  /\b(tallest|largest|biggest|highest|longest|smallest|richest|wealthiest|fastest|oldest|youngest|most [a-z-]+|best[- ]selling|highest[- ]grossing|top[- ]selling)\b[^?]*\b(in the world|on earth|ever|of all time|alive|living|in history|to date|currently|today|right now|record)\b/i,
  /\b(most (popular|expensive|followed|subscribed|watched|streamed|played|sold|valuable|visited|populous|spoken|common|successful)|number one|#1)\b/i,
  /\b(population|how many (people|users|subscribers|members|countries|states|players|teams|episodes|seasons|films|movies|albums|songs|species))\b/i,
  /\b(price|prices|costs?|worth|net worth|salary|market (cap|value)|gdp|valued at|\$\s?\d)/i,
  /\b(is|are) (the )?(current |present )?(president|prime minister|ceo|chairman|leader|king|queen|monarch|chancellor|mayor|governor|pope|secretary[- ]general|head of state|champion|holder|owner|host|manager|coach|captain)\b/i,
  /\b(20(1[5-9]|2\d|3\d))\b/,                                         // a recent year: likely a passing fact
  /\b(latest|newest|upcoming|next) (version|release|album|film|movie|game|model|iphone|season)\b/i,
  /\bwhat is the (name of the )?(current|newest|latest)\b/i,
];
const ADULT = /\b(sex|sexual|sexy|porn|pornograph\w*|nude|nudity|naked|genital\w*|penis|vagina|breasts?|boobs?|orgasm|erotic|erotica|condom|cocaine|heroin|meth|marijuana|cannabis|weed|rape|rapist|stripper|strip club|prostitut\w*|brothel|fetish|bdsm|playboy|hentai|lingerie|dildo|vibrator|masturbat\w*|suicide|fuck\w*|shit|arse|asshole|dick|cock|bitch|slut|whore|cunt|bastard|pussy|boner|hooker|pimp|orgy|threesome|incest|molest\w*|paedophil\w*|pedophil\w*|viagra|lube)\b/i;
const NICHE = /\b(anime|manga|pokémon|pokemon|minecraft|fortnite|overwatch|league of legends|dota|warcraft|runescape|roblox|undertale|homestuck|my little pony|rwby|yu-gi-oh|digimon|skyrim|fallout|team fortress|counter-strike|csgo|youtuber|youtube|twitch|streamer|pewdiepie|markiplier|jacksepticeye|vine|tiktok|reddit|4chan|tumblr|discord|fnaf|five nights|wiki|fandom|fanfic|cosplay|vtuber|hololive|osu!|touhou|vocaloid|hatsune miku|furry|brony|webcomic|smash bros|kirby|metroid|xbox|playstation|nintendo|sega|steam)\b/i;
const MAX_Q = 150, MAX_A = 40;                                        // fits a phone screen
function keep(q) {
  const text = [q.question, q.correct_answer, ...q.incorrect_answers].join(' ');
  if (q.type !== 'multiple' || !['easy', 'medium'].includes(q.difficulty)) return 'type';
  if (q.incorrect_answers.length !== 3) return 'answers';
  if (q.question.length > MAX_Q || [q.correct_answer, ...q.incorrect_answers].some(a => a.length > MAX_A || !a)) return 'long';
  const all = [q.correct_answer, ...q.incorrect_answers].map(a => a.toLowerCase());
  if (new Set(all).size !== 4) return 'duplicate';
  if (TIME_SENSITIVE.some(re => re.test(text))) return 'time';
  if (ADULT.test(text)) return 'adult';
  if (NICHE.test(text)) return 'niche';
  if (/which of (these|the following) is not\b/i.test(q.question) && q.question.length > 110) return 'long';
  return null;
}

// ---------- the API, one call at a time ----------
let lastCall = 0;
async function api(url) {
  const waitMs = lastCall + GAP_MS - Date.now();
  if (waitMs > 0) await new Promise(r => setTimeout(r, waitMs));
  lastCall = Date.now();
  const r = await fetch(url, { headers: { 'User-Agent': 'tic-tac-chaos trivia fetch (github.com/JaredMK/Tiger-tac-toe)' } });
  if (r.status === 429) { lastCall = Date.now() + 5000; return api(url); }   // asked too soon: once more after the gap
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.json();
}
const id = q => crypto.createHash('sha1').update(q.question + '|' + q.correct_answer).digest('hex').slice(0, 10);

(async () => {
  const token = (await api(`${API}/api_token.php?command=request`)).token;
  const cats = (await api(`${API}/api_category.php`)).trivia_categories.filter(c => !SKIP_CATEGORIES.some(re => re.test(c.name)));
  const use = QUICK ? cats.slice(0, 3) : cats;
  const out = [], dropped = {}, seen = new Set();
  const note = (why) => { dropped[why] = (dropped[why] || 0) + 1; };
  for (const cat of use) {
    const got = [];
    for (const diff of ['easy', 'medium']) {
      let want = Math.ceil(PER_CATEGORY * 0.9);                          // more than the cap: some are dropped
      while (want >= 10 && got.length < PER_CATEGORY * 2) {
        const amount = Math.min(50, want);
        const res = await api(`${API}/api.php?amount=${amount}&category=${cat.id}&difficulty=${diff}&type=multiple&token=${token}&encode=base64`);
        if (res.response_code === 1) { want = Math.floor(amount / 2); continue; }   // not that many left: ask for fewer
        if (res.response_code === 4) break;                                        // the token has had every question of this kind
        if (res.response_code === 5) { lastCall = Date.now() + 5000; continue; }   // too soon
        if (res.response_code !== 0) throw new Error(`category ${cat.name} ${diff}: response_code ${res.response_code}`);
        for (const raw of res.results) {
          const b64 = v => Buffer.from(String(v), 'base64').toString('utf8');   // (every field comes base64-encoded: the type and difficulty too)
          const q = { type: b64(raw.type), difficulty: b64(raw.difficulty), category: b64(raw.category), question: decode(b64(raw.question)),
            correct_answer: decode(b64(raw.correct_answer)), incorrect_answers: raw.incorrect_answers.map(a => decode(b64(a))) };
          const why = keep(q);
          if (why) { note(why); continue; }
          const k = id(q);
          if (seen.has(k)) { note('repeat'); continue; }
          seen.add(k);
          got.push({ id: k, cat: q.category, diff: q.difficulty, q: q.question, a: q.correct_answer, wrong: q.incorrect_answers });
        }
        break;
      }
    }
    // the cap per category, easy and medium mixed
    const easy = got.filter(x => x.diff === 'easy'), medium = got.filter(x => x.diff === 'medium');
    const take = [];
    for (let i = 0; take.length < PER_CATEGORY && (i < easy.length || i < medium.length); i++) { if (i < easy.length) take.push(easy[i]); if (take.length < PER_CATEGORY && i < medium.length) take.push(medium[i]); }
    out.push(...take);
    console.log(`${cat.name}: ${take.length} kept (${got.length} passed the filters)`);
  }
  out.sort((a, b) => a.cat.localeCompare(b.cat) || a.id.localeCompare(b.id));
  const file = { source: 'Open Trivia Database (opentdb.com)', licence: 'CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/)', fetched: new Date().toISOString(), count: out.length, questions: out };
  fs.writeFileSync(OUT, JSON.stringify(file, null, 1) + '\n');
  const byCat = {};
  for (const q of out) byCat[q.cat] = (byCat[q.cat] || 0) + 1;
  console.log(`\nSaved ${out.length} questions to ${OUT} from ${Object.keys(byCat).length} categories.`);
  console.log('Dropped:', JSON.stringify(dropped));
  if (!QUICK && out.length < 500) { console.log('::warning::Fewer than 500 questions: raise --per or loosen the filters.'); }
})().catch(e => { console.log('::error::' + e.message); process.exit(1); });
