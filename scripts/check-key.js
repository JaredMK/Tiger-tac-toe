'use strict';
// The service-account key in GOOGLE_APPLICATION_CREDENTIALS is a usable JSON key (repaired if it was
// pasted without its opening brace, or as base64). Prints only what identifies it, never the key.
const fs = require('node:fs');
const file = process.env.GOOGLE_APPLICATION_CREDENTIALS, raw = fs.readFileSync(file, 'utf8').replace(/^﻿/, '').trim();
let k = null;
try { k = JSON.parse(raw); } catch (e) {
  try { k = JSON.parse(Buffer.from(raw, 'base64').toString('utf8')); console.log('(the secret is base64: decoded)'); } catch (e2) { /* not base64 */ }
  if (!k && raw.startsWith('"') && raw.endsWith('}')) { try { k = JSON.parse('{' + raw); console.log('::warning::FIREBASE_SERVICE_ACCOUNT is missing its opening { (added here).'); } catch (e3) { /* still not */ } }
}
if (!k) { console.log('::error::FIREBASE_SERVICE_ACCOUNT is not a JSON key: paste the whole key file, from { to }.'); process.exit(1); }
fs.writeFileSync(file, JSON.stringify(k));
console.log('type:', k.type, '| project:', k.project_id);
if (k.type !== 'service_account') { console.log('::error::FIREBASE_SERVICE_ACCOUNT is not a service-account key.'); process.exit(1); }
