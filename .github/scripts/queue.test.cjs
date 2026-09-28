// Test de .github/scripts/queue.cjs contre la vraie file du depot.
//   node .github/scripts/queue.test.cjs
const assert = require('assert');
const fs = require('fs');
const { parseQueue, selectEntry, claimedIds } = require('./queue.cjs');

const PREFIX = 'factory/migrate/';
let failures = 0;
function check(name, fn) {
  try { fn(); console.log(`  ok   ${name}`); }
  catch (e) { failures++; console.log(`  FAIL ${name}\n       ${e.message}`); }
}

const q = parseQueue(fs.readFileSync('factory/queue.yaml', 'utf8'));

console.log('parse de factory/queue.yaml');
check('34 entrees', () => assert.strictEqual(q.entries.length, 34));
check('total = 34', () => assert.strictEqual(q.total, 34));
check('max_attempts = 3', () => assert.strictEqual(q.max_attempts, 3));
check('toutes pending a attempts 0', () => {
  for (const e of q.entries) {
    assert.strictEqual(e.status, 'pending', `${e.id} statut ${e.status}`);
    assert.strictEqual(e.attempts, 0, `${e.id} attempts ${e.attempts}`);
  }
});
check('ids uniques', () => assert.strictEqual(new Set(q.entries.map(e => e.id)).size, 34));
check('ids sans guillemets residuels', () => {
  for (const e of q.entries) assert.ok(!/['"]/.test(e.id), `guillemets dans ${e.id}`);
});
check('contient camera_disconnected (id non numerique)', () =>
  assert.ok(q.entries.some(e => e.id === 'camera_disconnected')));

console.log('selection');
check('sans PR ouverte : prend la premiere', () => {
  const r = selectEntry(q.entries, { max: 3 });
  assert.strictEqual(r.skipped, false);
  assert.strictEqual(r.entry.id, q.entries[0].id);
});
check('claimedIds extrait les ids des branches', () =>
  assert.deepStrictEqual(
    claimedIds([{ head: { ref: PREFIX + 'camera_disconnected' } },
                { head: { ref: 'feature/autre' } }], PREFIX),
    ['camera_disconnected']));
check('une entree claimed est pas reprise', () => {
  const first = q.entries[0].id;
  const r = selectEntry(q.entries, { claimed: [first], max: 3 });
  assert.strictEqual(r.skipped, false);
  assert.notStrictEqual(r.entry.id, first);
  assert.strictEqual(r.entry.id, q.entries[1].id);
});
check('toutes claimed : rien a faire', () => {
  const r = selectEntry(q.entries, { claimed: q.entries.map(e => e.id), max: 3 });
  assert.strictEqual(r.skipped, true);
});
check('max attempts respecte', () => {
  const entries = [{ id: 'x', status: 'pending', attempts: 3 }];
  assert.strictEqual(selectEntry(entries, { max: 3 }).skipped, true);
  assert.strictEqual(selectEntry([{ id: 'x', status: 'pending', attempts: 2 }], { max: 3 }).skipped, false);
});
check('done et blocked ignores', () => {
  const entries = [{ id: 'a', status: 'done', attempts: 0 },
                   { id: 'b', status: 'blocked', attempts: 0 },
                   { id: 'c', status: 'pending', attempts: 0 }];
  assert.strictEqual(selectEntry(entries, { max: 3 }).entry.id, 'c');
});
check('wanted respecte', () => {
  const r = selectEntry(q.entries, { wanted: '1700051716580', max: 3 });
  assert.strictEqual(r.entry.id, '1700051716580');
});
check('wanted inconnu : skip explicite', () => {
  const r = selectEntry(q.entries, { wanted: 'nexiste_pas', max: 3 });
  assert.strictEqual(r.skipped, true);
  assert.match(r.reason, /introuvable/);
});
check('commentaires de queue ignores', () => {
  const t = fs.readFileSync('factory/queue.yaml', 'utf8')
    .replace('status: pending', 'status: done # commentaire');
  const p = parseQueue(t);
  assert.strictEqual(p.entries[0].status, 'done');
});

console.log(failures ? `\n${failures} ECHEC(S)` : '\nTous les tests passent.');
process.exit(failures ? 1 : 0);
