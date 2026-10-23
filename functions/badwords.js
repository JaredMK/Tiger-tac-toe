'use strict';
// The profanity list lives with the engine (src/core/badwords.js), where the client's Wordle refuses the same words;
// the server reads its synced copy (functions/src, scripts/sync-functions.js), the tests the repository's own.
let m;
try { m = require('./src/core/badwords.js'); } catch (e) { m = require('../src/core/badwords.js'); }
module.exports = { BADWORDS: m.BADWORDS, BAD_EXTRA: m.BAD_EXTRA, BAD_EXTRA_TOKENS: m.BAD_EXTRA_TOKENS };
