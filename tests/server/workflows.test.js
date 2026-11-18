'use strict';
// The workflow files must parse: a step's name written plain (no quotes) cannot hold ": " or " #", or GitHub refuses the
// whole file and nothing runs (December 2026: a name with "once: …" stopped a staging deploy before it began).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const DIR = path.join(__dirname, '..', '..', '.github', 'workflows');

test('workflows: every plain name is one YAML scalar (no ": ", no " #", no leading special character)', () => {
  const files = fs.readdirSync(DIR).filter(f => /\.ya?ml$/.test(f));
  assert.ok(files.includes('deploy.yml'));
  for (const f of files) {
    fs.readFileSync(path.join(DIR, f), 'utf8').split('\n').forEach((line, i) => {
      const m = /^\s*(?:- )?name:\s+(.*)$/.exec(line);
      if (!m || /^["']/.test(m[1])) return;
      assert.doesNotMatch(m[1], /: | #|:$/, `${f}:${i + 1} a plain name with a colon or a comment mark: ${m[1]}`);
      assert.doesNotMatch(m[1], /^[&*!|>%@`{[]/, `${f}:${i + 1}: ${m[1]}`);
    });
  }
});
