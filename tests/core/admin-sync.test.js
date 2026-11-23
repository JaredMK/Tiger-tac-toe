'use strict';
// Run with:  node --test
// The admin page keeps its own copies of a few of the engine's lists (it does not load engine.js): they
// must say the same, or its switches and tuning cards show the wrong thing.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const E = require('../engine.js');

const admin = fs.readFileSync(path.join(__dirname, '..', '..', 'admin.js'), 'utf8');   // (the admin page's script, admin.html loads it)
const literal = name => { const m = admin.match(new RegExp(`^const ${name} = (.*?);(?:\\s*//.*)?$`, 'm')); assert.ok(m, `admin.html has ${name}`); return new Function(`return (${m[1]});`)(); };

test('admin page: the admin-only games are the engine\'s TEST_TYPES', () => {
  assert.deepEqual(literal('TEST_TYPES').slice().sort(), E.TEST_TYPES.slice().sort());
});
test('admin page: every game in the pool has a name', () => {
  const games = literal('GAMES');
  for (const t of E.TYPES) assert.equal(typeof games[t], 'string', `${t} has no name on the admin page`);
});
test('admin page: the runners and their default tuning are the engine\'s', () => {
  assert.deepEqual(literal('RUN_TYPES'), E.RUN_TYPES);
  assert.deepEqual(literal('RUN_DEFAULTS'), E.RUN_DEFAULTS);
  const mix = literal('RUN_MIX');
  for (const t of E.RUN_TYPES) assert.deepEqual(mix[t].map(([k]) => k).sort(), Object.keys(E.RUN_DEFAULTS[t].mix).sort(), `${t}: a field for each kind`);
  const extra = literal('RUN_EXTRA');
  for (const t of E.RUN_TYPES) for (const [k, [lo, hi]] of Object.entries(E.RUN_EXTRA[t] || {})) {
    const f = (extra[t] || []).find(([x]) => x === k);
    assert.ok(f, `${t}: a field for ${k}`); assert.deepEqual([f[2], f[3]], [lo, hi], `${t}.${k}: the engine's range`);
  }
});
test('admin page: Risky Spins\' and Peg Drop\'s default tuning are the engine\'s', () => {
  assert.deepEqual(literal('WHEEL_DEFAULTS'), E.WHEEL_DEFAULTS);
  const fields = literal('WHEEL_FIELDS');
  assert.deepEqual(fields.map(([k]) => k).sort(), Object.keys(E.WHEEL_DEFAULTS).sort(), 'a field for each setting');
  for (const [k, , lo, hi] of fields) assert.deepEqual([lo, hi], E.WHEEL_LIMITS[k], `${k}: the engine's range`);
  assert.deepEqual(literal('PLINKO_DEFAULTS'), E.PLINKO_DEFAULTS);
  assert.deepEqual(literal('PIG_DEFAULTS'), E.PIG_DEFAULTS);
  assert.deepEqual(literal('ROADS_DEFAULTS'), E.ROADS_DEFAULTS);
  assert.deepEqual(literal('ODD_DEFAULTS'), E.ODD_DEFAULTS);
  assert.deepEqual(literal('HEAD_DEFAULTS'), E.HEAD_DEFAULTS); assert.deepEqual(literal('FLASH_DEFAULTS'), E.FLASH_DEFAULTS); assert.deepEqual(literal('SNAP_DEFAULTS'), E.SNAP_DEFAULTS);
});
test('admin page: the finger games\' tuning cards are the engine\'s settings and ranges', () => {
  assert.deepEqual(literal('BOWL_CARDS'), [], 'Bowling: no card of its own since the flick (its settings are in its TUNE)');
  assert.deepEqual(literal('HOP_DEFAULTS'), E.HOP_DEFAULTS); assert.deepEqual(literal('SCOOP_DEFAULTS'), E.SCOOP_DEFAULTS); assert.deepEqual(literal('PINB_DEFAULTS'), E.PINB_DEFAULTS);
  const at = admin.indexOf('const FING_CARDS = ['), end = admin.indexOf('];\nfunction fingCard');
  assert.ok(at > 0 && end > at, 'admin.html has FING_CARDS');
  const cards = new Function('HOP_DEFAULTS', 'SCOOP_DEFAULTS', 'PINB_DEFAULTS', `return ${admin.slice(at + 'const FING_CARDS = '.length, end + 1)};`)(E.HOP_DEFAULTS, E.SCOOP_DEFAULTS, E.PINB_DEFAULTS);
  const LIMITS = { skyhop: E.HOP_LIMITS, scoop: E.SCOOP_LIMITS, pinball: E.PINB_LIMITS };
  assert.deepEqual(cards.map(c => c.id), E.FINGER_TYPES);
  for (const c of cards) {
    assert.deepEqual(c.fields.map(([k]) => k).sort(), Object.keys(LIMITS[c.id]).sort(), `${c.id}: a field for each setting`);
    for (const [k, , lo, hi, step] of c.fields) assert.deepEqual([lo, hi, step], LIMITS[c.id][k], `${c.id}.${k}: the engine's range`);
  }
});

// The Games page (November 2026: Mini-game Settings and Releases in one): its tuning cards write the paths the copy to
// production carries, its race list is the engine's own (imported, not copied), and the old pages' hashes are aliased.
test('admin page: the games\' own tuning cards are exactly the paths copy-settings carries, and the old pages\' hashes open the Games page', () => {
  const m = admin.match(/^const legacyPath = (t => \(.*?\));$/m);
  assert.ok(m, 'admin.js has legacyPath');
  const legacyPath = new Function('RUN_TYPES', `return (${m[1]});`)(E.RUN_TYPES);
  const cards = new Set(E.TYPES.map(legacyPath).filter(Boolean).map(p => p.replace(/^config\/run\/.*/, 'config/run')));
  const copy = fs.readFileSync(path.join(__dirname, '..', '..', 'scripts', 'copy-settings.js'), 'utf8').match(/^const PATHS = (\[[\s\S]*?\]);$/m);
  assert.ok(copy, 'copy-settings.js lists its PATHS');
  const shared = ['releases', 'features', 'config/tune', 'config/ai', 'config/anim', 'config/timer', 'config/lineup', 'admin/config'];   // (config/lineup: the Lineup card on every game's page, not a tuning card)
  assert.deepEqual([...cards].sort(), new Function(`return ${copy[1]};`)().filter(p => !shared.includes(p)).sort(), 'every game card the copy carries has a page here, and nothing else writes a config node');
  assert.match(admin, /import\('\.\/src\/core\/race\.js'\)/, 'the race games come from the engine');
  assert.doesNotMatch(admin, /^const RACE_TYPES/m, 'no copy of the race list');
  assert.deepEqual(literal('ALIAS'), { playtest: 'players', devices: 'settings', stats: 'games', balance: 'games', bots: 'settings', access: 'settings', releases: 'games' }, 'every page from before opens where its content went');
  assert.deepEqual(literal('NAV').map(x => x[0]), ['overview', 'players', 'matches', 'games', 'growth', 'health', 'settings'], 'the seven sections');
  assert.doesNotMatch(admin, /data-(runsave|bullsave|wheelsave|plinkosave|pigsave|roadssave|oddsave|attsave|fingsave|tunesave)=/, 'no Save of a card\'s own: the page\'s Save covers it');
  assert.equal((admin.match(/<button class="btn go" data-gamesave=/g) || []).length, 1, 'one Save button template'); assert.equal((admin.match(/<button class="btn" data-tunereset=/g) || []).length, 1, 'one Reset');
});

test('admin page: the computer\'s difficulty card keeps the engine\'s defaults and ranges (config/ai)', () => {
  assert.deepEqual(literal('AI_DEF'), E.AI_DEFAULTS);
  const levels = literal('AI_LEVELS').map(x => x[0]), lv = literal('AI_LV'), w = literal('AI_W');
  assert.deepEqual(levels.slice().sort(), E.LEVELS.slice().sort());
  const fields = levels.flatMap(l => lv.map(([k, , lo, hi, step]) => [l + k, lo, hi, step])).concat(w.map(([k, , lo, hi, step]) => [k, lo, hi, step]));
  assert.deepEqual(fields.map(f => f[0]).sort(), Object.keys(E.AI_DEFAULTS).sort(), 'a field for every setting');
  for (const [k, lo, hi, step] of fields) assert.deepEqual([lo, hi, step], E.AI_LIMITS[k], `${k}: the engine's range`);
  const rules = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'database.rules.json'), 'utf8')).rules.config.ai.$k['.validate'];
  const re = new RegExp(rules.match(/\$k\.matches\(\/(.+?)\/\)/)[1]);
  for (const k of Object.keys(E.AI_DEFAULTS)) assert.ok(re.test(k), `the rules take ${k}`);
});

// The Game lineup's card backs as the admin edits them (admin.js lineupCard): public read, the admin's write, its shape held.
test('config/lineup: public read, the admin\'s write, a line of at most 120 characters, luck or skill 1 to 5, race or shared, nothing else', () => {
  const rules = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'database.rules.json'), 'utf8')).rules;
  assert.equal(rules.config['.read'], true);
  const r = rules.config.lineup.$type;
  assert.match(r['.write'], /auth\.token\.admin === true/);
  assert.match(r.blurb['.validate'], /length <= 120/);
  for (const k of [1, 2, 3, 4, 5]) assert.ok(r.luckSkill['.validate'].includes(`=== ${k}`));
  assert.match(r.format['.validate'], /'race'.*'shared'/);
  assert.equal(r.$other['.validate'], false);
  const staging = require(path.join(__dirname, '..', '..', 'scripts', 'staging-rules.js')).gate(rules);
  assert.equal(staging.config['.read'], true, 'staging: still read before a login');
  assert.match(staging.config.lineup.$type['.write'], /auth\.token\.admin === true/);
});
