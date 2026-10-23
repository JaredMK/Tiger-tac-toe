'use strict';
// Staging's database rules: production's (database.rules.json) with one gate added to every grant, so only a
// tester on the allowlist (the `staging` flag, functions/index.js stagingAccess) or the admin reads or writes
// anything that needs a login there. What production lets anyone read without a login (`.read: true`: the
// release switches, the games' settings) stays open, as the page reads it before anyone logs in. `.validate`
// and `.indexOn` are unchanged.
//   node scripts/staging-rules.js [in] [out]      (default: database.rules.json, written over in place: CI only)
const fs = require('node:fs');
const GATE = "(auth != null && (auth.token.staging === true || auth.token.admin === true))";
function gate(node) {
  if (!node || typeof node !== 'object') return node;
  const out = Array.isArray(node) ? [] : {};
  for (const [k, v] of Object.entries(node)) {
    if ((k === '.read' || k === '.write') && v !== false && !(k === '.read' && v === true)) out[k] = v === true ? GATE : `${GATE} && (${v})`;
    else out[k] = gate(v);
  }
  return out;
}
module.exports = { gate, GATE };
if (require.main === module) {
  const src = process.argv[2] || 'database.rules.json', dst = process.argv[3] || src;
  const rules = JSON.parse(fs.readFileSync(src, 'utf8'));
  fs.writeFileSync(dst, JSON.stringify(gate(rules), null, 2) + '\n');
  console.log(`Staging rules written to ${dst} (every grant gated to testers on the allowlist).`);
}
