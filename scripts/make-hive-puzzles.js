// Letter Hive's puzzles (src/games/hive/puzzles.js), written from ENABLE (public domain: the Enhanced North American
// Benchmark Lexicon, e.g. https://raw.githubusercontent.com/dolph/dictionary/master/enable1.txt):
//   node scripts/make-hive-puzzles.js path/to/enable1.txt
// A puzzle is seven different letters, one of them the centre, and every word of the list that can be made of them:
// 4 to 15 letters, only those seven (a letter as often as wanted), the centre letter in every word. The offensive
// words are left out exactly as Word Tiles' script leaves them out (the username profanity list, core/badwords.js,
// and the roots below at a word's start). The puzzles are our own: PICKS is the curated list, each entry an everyday
// word of seven different letters, which names its letter set (the "full hive" word a player can look for); the
// script works the rest out and holds every puzzle to the rules of the curation:
//   - no S (plurals would swamp the list), at most one of J Q X Z;
//   - at least one word that uses all seven letters;
//   - the centre is the letter whose list is nearest WANT words, among those with LO to HI words and TOTAL points or
//     more (4 letters 1 point, longer its length, 7 more for a full-hive word: the game's defaults; TOTAL is 4 times the
//     highest target the puzzles are meant for, so a square never runs out of words);
//   - no two puzzles on the same seven letters.
//   - EVERYDAY everyday words at least (COMMON, below), worth EVERYDAY_PTS points or more between them.
// A pick that breaks a rule stops the script. Each puzzle is written as its letters (the centre first, the rest in
// alphabetical order), a colon, and its words sorted, each as the count of letters it shares with the word before
// (one digit) and the rest, the rest's first letter a capital for an everyday word (src/games/hive/rules.js
// hivePuzzle decodes one on first use).
const fs = require('fs');
const path = require('path');

const PICKS = ('continue auction hideout petunia curtain cabinet machine thunder fountain delight phantom rethink foliage although ' +
  'monarch courage minority kitchen archive century dolphin function payment pigment bathroom compute volcanic wildcat ' +
  'thimble chimney mixture rainbow younger journal formula vampire graphic drawing climber poultry poverty wrinkle banquet ' +
  'joyride country harmony network novelty liberty empathy carnival factory midnight blanket product butcher trilogy wealthy').split(' ');
const LO = 36, HI = 66, WANT = 48, TOTAL = 200, MAXLEN = 15, RARE = 'jqxz', EVERYDAY = 15, EVERYDAY_PTS = 60;
// The everyday words among the puzzles' words, marked by hand (the rest of ENABLE's are fair to enter but few would
// think of them: "ketene", "kabab"): the computer leans to these, so what it finds looks like what a person would
// (ai.js), and every puzzle is held to EVERYDAY of them at least. A word here that no puzzle holds is reported.
const COMMON = new Set((
  'abet abut ache acid afar ahem ahoy ajar ally ammo anon aqua arch aria army atom aunt aura auto away babe bait bake balk bane bank beak bean beat beau ' +
  'been beer beet bent beta bile bill bite bomb boom bunt burr byte call cart cell cent char chia chic chin chip chub clad claw coat coca coco comp coop ' +
  'cope corn coup crib croc crop cube cuff curb cure curt cute dawn ding dodo doer dojo doll door dory dote doth draw drop each eave emit euro ever fact ' +
  'fail fall farm fife file fill foal foam foil font fool foot form foul four from full furl gaga gala gall gill gilt gimp girl glug glut gnaw goal goat ' +
  'gory gout grip grit grog guru hair hare harm have hear heck heed heel heir held hell herb herd here hick hide high hike hill hilt hire hive hold hood ' +
  'hoop hoot horn hued hunt hurt hymn hype idol inch info into iota iron item kale keel keen kick kink kite kiwi knee knew knit knot know kook lake lank ' +
  'lava leak leek lent lice life lilt lily limb lime lion lite loaf loan logo loin loll loon loop loot luau lyre mama many mart math matt mayo meet mice ' +
  'mile mill mime mine mini mint mite mitt moan moat mono moon moor moot mope moth muff mute mutt myth naan nana neck nice nick nigh nine noir nook noon ' +
  'norm note noun nova odor omit onto oral orca oval over pair pave peep pimp plod plop ploy poem poet poll polo poly pomp pond pooh pool poop poor pope ' +
  'port pour pout prod prop pump punt pupa purr putt racy rain rave redo reek rely rice rich rink roam roar rode roof rook room rove rube ruff ruin rune ' +
  'rung runt taco tact take talc talk tamp tank taut teak teem teen tell temp tent thee then they thou thru thud thug tick tiki tile till tilt time toed ' +
  'tofu toga toke toll tomb tone took tool toon toot tote tout tram trek trim troy true tuba tube tuft tuna tune turn tutu type typo tyre unit unto updo ' +
  'urea urge vain vamp veer vent very veto vial vino viva volt vote wand ward warn week well were whey wile will wind wine wing wink wino wire woke wonk ' +
  'work wren yarn yeah yell yeti yogi yore your yurt abate actor afoot afoul agile aioli allay alley aloof ankle annoy annul anvil argue armor aroma ' +
  'array attic auger augur aural avail avian award beaut beech belie belly beret berry berth bible billy bitty blank bleak brain briar broom brute butch ' +
  'butte cabin cacao cache cacti carat carry catty celeb chain chair charm check cheek cheer chick chime china chirp chive cigar cinch circa civic civil ' +
  'climb clime coach cocoa conch corny count coupe court craft creme crier crime croft crony croon croup curry cuter cutie cynic digit diode ditto doted ' +
  'drawn droop eight elite emcee empty enemy ennui erect erode error ether event every flail floor flora flour fluff folio forum fount furor futon gauge ' +
  'ghoul girly gloat glory golly gouge grill gulag hammy happy harry heave hedge hence henna hiker hippo hoary honor hooch icier idiot igloo incur input ' +
  'kebab ketch kneel knell knelt known krone larva latke laugh leery libel liege light lilac limit lithe llano lolly loopy lorry lotto lunar macho mamba ' +
  'mambo mamma mammy manna manta march marry matey mayor meany meaty might mimic mince minim minor minty mocha momma mommy month mooch moray moron motor ' +
  'motto myrrh nacho nanny nappy natty naval newer niche niece night ninny occur odder offal onion oomph order ought ounce outdo overt patty paver payee ' +
  'peaty peeve penny peppy petty polio polyp poppy potty pouty proud prove pulpy puppy putty queen queue rabbi ranch raver rayon reach rebut recur relic ' +
  'renew rerun retry rigor rival river roach robin rodeo rogue roomy rouge rover runic runny rural tacit taken tally tatty taunt taupe teeny teeth telly ' +
  'tempo tempt tenet tenth tepee terry there thick thigh thing think three thyme tibia tight tithe title token tommy tonne tooth tough tract trike troop ' +
  'trove truce truer truly truth tuber tunic tutee tutti ulnar uncut unfit union unite unpin untie utter verve vicar villa viola viper viral vocal voila ' +
  'voter wally welly wring yahoo young acacia accrue acidic addict anchor anklet annual anoint apathy archer armful armory arrive attune auntie aurora ' +
  'awning bamboo banana barrio batten beanie beaten better billet bitten blithe bobbin bottom breech butane butter cabana cabbie carrot caviar center ' +
  'centre chance cherub cicada circle cleric cocoon concur cotton cougar county crafty creche cutoff cutout cutter dining dollop dotted eerily eighth ' +
  'equate eroded eyelet factor filial floral formal giggle giggly gigolo goalie googly gritty groggy grotto grunge grungy gunner gurney hearer hedged ' +
  'heeded heeled height herded herder hiding hilled honcho hooded hoodie hoodoo hoorah hooray hooted horror hubbub hunted hunter icicle imbibe inborn ' +
  'inning intuit inward iodide italic keener kennel ketone kettle kitten kowtow lactic larval lately leeway little mayhem millet miming mining minion ' +
  'mirror mitten moppet mortar motion mummer murmur mutter nation nether nettle neuron nonfat notion opioid outcry outdid outfit outhit output panama ' +
  'papaya pariah peanut pinion pompom poorly poplin portly puppet putout recent rehire revamp revere revert revive rewire rework ribbon richer rococo ' +
  'rubber runner tactic tampon tattoo taught teepee teethe tether though ticket timing tinker titbit tithed tomato tooted toucan toupee touted truant ' +
  'tryout tuneup turret tycoon unbent unhurt uproot velvet violin wading waging waning waylay weenie wiener wiring winner winnow worker account achieve ' +
  'alfalfa annular archaic archive arrival attract auction auroral banquet barroom bathmat blanket bribery butcher cabinet caravan catcall cattail ' +
  'caution century ceviche chicane chicken chimney circuit climber coconut compete compote compute concoct contort contour corrupt country courage ' +
  'crouton currant current curtain dawning delight digging dimming dolphin drawing dropout earache eminent empathy enhance factory falloff foliage ' +
  'formula gnawing graphic gunnery hairier hallway harmony harrier healthy heavier hideout hinting hitting homonym hundred illegal illicit impinge ' +
  'inkwell journal joyride kinetic kinkier kitchen knitter layaway liberty lighted machine mammary mammoth meeting minding minting mixture monarch ' +
  'monitor necktie network nirvana novelty nunnery opinion ordered ottoman outcrop payment pervert petunia phantom pigment popover poultry poverty ' +
  'proctor product purport rainbow reorder reprove rethink reverie riviera roguery roomful teeming teethed teether texture thicken thicket thimble ' +
  'thinker thought thudded thunder tinting tithing toothed tractor trekker trilogy trinket tritely tuition unction uneaten untruth utterer vampire ' +
  'vanilla velvety villain volcano wadding wagging walleye warding warning warring warrior wealthy wildcat winding winning wrinkle younger accountant ' +
  'achiever alleyway although anchorman annotation attenuate awarding bankable barbarian bathroom belittle bitterly carnival cataract civilian coachman ' +
  'continue continuation convivial currency delighted didactic eightieth eminence emitting fountain function henchman henchmen hierarch highchair ' +
  'highlight highlighted hitchhike honorary imbecile imminent impinging infatuation initiation intonation intuition kitchenette lethally lollipop ' +
  'mechanic midnight minority monotony motorboat notation nonunion nonevent novelette recurrence recurrent reprieve tactical taciturn teakettle tempting ' +
  'tenement terribly tethered thinning thundered tinkerer unbeaten unheeded untether unitarian velveteen volcanic windward workweek wringing'
).split(' '));

const src = process.argv[2];
if (!src || !fs.existsSync(src)) { console.error('usage: node scripts/make-hive-puzzles.js enable1.txt'); process.exit(1); }
(async () => {
  const { BADWORDS, BAD_EXTRA, BAD_EXTRA_TOKENS } = await import(path.join(__dirname, '..', 'src', 'core', 'badwords.js'));
  const bad = new Set(BADWORDS.concat(BAD_EXTRA, BAD_EXTRA_TOKENS).map(w => String(w).toLowerCase().replace(/[^a-z]/g, '')).filter(Boolean));
  // roots no word of the list may start with, and the ordinary words they would take (as scripts/make-wtiles-words.js)
  const ROOTS = ['nigg', 'nigr', 'fuck', 'cunt', 'shit', 'fagg', 'fagot', 'twat', 'whore', 'slut', 'kike', 'dyke', 'wank', 'jizz', 'bitch', 'bastard', 'retard', 'chink', 'gook', 'wetback', 'piss', 'dildo', 'orgasm', 'penis', 'vagin', 'pussy', 'cocksuck', 'porn', 'rapist', 'tranny', 'spic', 'coon', 'darkie', 'negro', 'beaner', 'nazi'];
  const KEEP = new Set(['niggle', 'niggled', 'niggler', 'niggles', 'spica', 'spicae', 'spicas', 'spicate', 'spice', 'spiced', 'spicer', 'spicers', 'spicery', 'spices', 'spicey', 'spicier', 'spicily', 'spicing', 'spicula', 'spicule', 'spicy', 'cooncan', 'coontie', 'negroni', 'beanery']);
  const shape = new RegExp(`^[a-z]{4,${MAXLEN}}$`);
  const words = [...new Set(fs.readFileSync(src, 'utf8').split(/\r?\n/).map(w => w.trim().toLowerCase())
    .filter(w => shape.test(w) && !w.includes('s') && !bad.has(w) && (KEEP.has(w) || !ROOTS.some(r => w.startsWith(r)))))].sort();
  const distinct = w => [...new Set(w)].sort().join('');
  const pts = (w, full) => (w.length === 4 ? 1 : w.length) + (full ? 7 : 0);
  const fail = msg => { console.error('make-hive-puzzles: ' + msg); process.exit(1); };
  const seen = new Set(), used = new Set(), out = [];
  let count = 0, chars = 0;
  for (const pick of PICKS) {
    const letters = distinct(pick);
    if (letters.length !== 7) fail(`${pick}: not seven different letters`);
    if (!words.includes(pick)) fail(`${pick}: not in the word list`);
    if (letters.includes('s')) fail(`${pick}: an S`);
    if ([...letters].filter(ch => RARE.includes(ch)).length > 1) fail(`${pick}: more than one of J Q X Z`);
    if (seen.has(letters)) fail(`${pick}: its seven letters are another puzzle's`);
    seen.add(letters);
    const only = new RegExp(`^[${letters}]+$`), sub = words.filter(w => only.test(w));
    const opts = [...letters].map(ch => { const list = sub.filter(w => w.includes(ch)); return { ch, list, total: list.reduce((a, w) => a + pts(w, distinct(w) === letters), 0) }; })
      .filter(o => o.list.length >= LO && o.list.length <= HI && o.total >= TOTAL)
      .sort((a, b) => Math.abs(a.list.length - WANT) - Math.abs(b.list.length - WANT) || b.total - a.total);
    if (!opts.length) fail(`${pick}: no centre letter gives ${LO} to ${HI} words worth ${TOTAL} points`);
    const { ch, list, total } = opts[0];
    const plain = list.filter(w => COMMON.has(w)), plainPts = plain.reduce((a, w) => a + pts(w, distinct(w) === letters), 0);
    if (plain.length < EVERYDAY || plainPts < EVERYDAY_PTS) fail(`${pick}: only ${plain.length} everyday words (${plainPts} points)`);
    plain.forEach(w => used.add(w));
    let prev = '', code = '';
    for (const w of list) { let k = 0; while (k < 9 && k < prev.length && k < w.length - 1 && prev[k] === w[k]) k++; const rest = w.slice(k); code += k + (COMMON.has(w) ? rest[0].toUpperCase() + rest.slice(1) : rest); prev = w; }
    out.push(`  '${ch}${letters.replace(ch, '')}:${code}',`);
    count += list.length; chars += code.length;
    console.log(`${pick.padEnd(10)} ${ch.toUpperCase()} ${letters.replace(ch, '')}  ${String(list.length).padStart(2)} words, ${total} points, ${plain.length} everyday (${plainPts} points), longest ${list.reduce((a, w) => Math.max(a, w.length), 0)}`);
  }
  const stray = [...COMMON].filter(w => !used.has(w));
  if (stray.length) console.log(`everyday words in no puzzle: ${stray.join(' ')}`);
  const file = path.join(__dirname, '..', 'src', 'games', 'hive', 'puzzles.js');
  fs.writeFileSync(file, `// Letter Hive's puzzles: our own, worked out from ENABLE (public domain), the offensive words left out (written by\n// scripts/make-hive-puzzles.js; do not edit by hand). Each is its seven letters (the centre first), a colon, and its\n// words in order, each as the count of letters it shares with the word before (a digit) and the rest, the rest's\n// first letter a capital for an everyday word (rules.js hivePuzzle decodes it). ${out.length} puzzles, ${count} words.\nexport const HIVE_PUZZLES = [\n${out.join('\n')}\n];\n`);
  console.log(`${out.length} puzzles, ${count} words, ${chars} characters`);
})();
