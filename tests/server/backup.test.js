// The daily backup (scripts/backup-db.js): the backups past 30 days are the ones deleted, only under daily/; the workflow
// runs it every day, for production, with the reset's credentials; a restore takes a daily backup's name.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const B = require('../../scripts/backup-db.js');

test('past 30 days and under daily/ alone: deleted', () => {
  const now = Date.parse('2026-12-31T03:17:00Z'), day = 86400000;
  const files = [{ name: 'daily/a', time: now - 31 * day }, { name: 'daily/b', time: now - 29 * day }, { name: 'backups/c', time: now - 400 * day }, { name: 'daily/d', time: NaN }];
  assert.deepEqual(B.expired(files, now), ['daily/a']);
  assert.equal(B.KEEP_DAYS, 30);
});
test('the workflow: daily, production, the backup script', () => {
  const y = fs.readFileSync(path.join(__dirname, '..', '..', '.github', 'workflows', 'backup-production.yml'), 'utf8');
  assert.match(y, /cron: '17 3 \* \* \*'/);
  assert.match(y, /environment: production/);
  assert.match(y, /node scripts\/backup-db\.js/);
  assert.match(fs.readFileSync(path.join(__dirname, '..', '..', 'scripts', 'restore-backup.js'), 'utf8'), /\(backups\|daily\)/);
});
