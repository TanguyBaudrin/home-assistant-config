// Test de .github/scripts/queue.cjs.
//   node .github/scripts/queue.test.cjs
//
// Les invariants structurels sont verifies sur la vraie file du depot. La
// logique de selection tourne sur des entrees synthetiques : la file avance
// (des entrees passent a `done`), donc s'appuyer sur son etat courant ferait
// rougir la CI a chaque migration terminee.
const assert = require('assert');
const fs = require('fs');
const { parseQueue, selectEntry, claimedIds } = require('./queue.cjs');

const PREFIX = 'factory/migrate/';
const STATUSES = ['pending', 'done', 'blocked'];
let failures = 0;
function check(name, fn) {
  try { fn(); console.log(`  ok   ${name}`); }
  catch (e) { failures++; console.log(`  FAIL ${name}\n       ${e.message}`); }
}

const q = parseQueue(fs.readFileSync('factory/queue.yaml', 'utf8'));

console.log('parse de factory/queue.yaml');
check('total coherent avec les entrees', () => assert.strictEqual(q.total, q.entries.length));
check('max_attempts = 3', () => assert.strictEqual(q.max_attempts, 3));
check('statuts valides', () => {
  for (const e of q.entries) assert.ok(STATUSES.includes(e.status), `${e.id} statut ${e.status}`);
});
check('attempts entiers positifs', () => {
  for (const e of q.entries) {
    assert.ok(Number.isInteger(e.attempts) && e.attempts >= 0, `${e.id} attempts ${e.attempts}`);
  }
});
check('ids uniques', () => assert.strictEqual(new Set(q.entries.map(e => e.id)).size, q.entries.length));
check('ids sans guillemets residuels', () => {
  for (const e of q.entries) assert.ok(!/['"]/.test(e.id), `guillemets dans ${e.id}`);
});
check('contient camera_disconnected (id non numerique)', () =>
  assert.ok(q.entries.some(e => e.id === 'camera_disconnected')));

console.log('selection');
// Entrees synthetiques : la selection ne doit dependre que de leurs champs.
const entries = [
  { id: 'a', status: 'pending', attempts: 0 },
  { id: 'b', status: 'pending', attempts: 1 },
  { id: 'c', status: 'done', attempts: 1 },
  { id: 'd', status: 'blocked', attempts: 0 },
];
check('sans PR ouverte : prend la premiere pending', () => {
  const r = selectEntry(entries, { max: 3 });
  assert.strictEqual(r.skipped, false);
  assert.strictEqual(r.entry.id, 'a');
});
check('claimedIds extrait les ids des branches', () =>
  assert.deepStrictEqual(
    claimedIds([{ head: { ref: PREFIX + 'camera_disconnected' } },
                { head: { ref: 'feature/autre' } }], PREFIX),
    ['camera_disconnected']));
check('une entree claimed est pas reprise', () => {
  const r = selectEntry(entries, { claimed: ['a'], max: 3 });
  assert.strictEqual(r.skipped, false);
  assert.strictEqual(r.entry.id, 'b');
});
check('toutes claimed : rien a faire', () => {
  const r = selectEntry(entries, { claimed: entries.map(e => e.id), max: 3 });
  assert.strictEqual(r.skipped, true);
});
check('max attempts respecte', () => {
  assert.strictEqual(selectEntry([{ id: 'x', status: 'pending', attempts: 3 }], { max: 3 }).skipped, true);
  assert.strictEqual(selectEntry([{ id: 'x', status: 'pending', attempts: 2 }], { max: 3 }).skipped, false);
});
check('done et blocked ignores', () => {
  const ids = entries.filter(e => e.status !== 'pending').map(e => e.id);
  const r = selectEntry(entries, { max: 3 });
  assert.ok(!ids.includes(r.entry.id), `selection ${r.entry.id}`);
});
check('wanted respecte', () => {
  const r = selectEntry(entries, { wanted: 'b', max: 3 });
  assert.strictEqual(r.skipped, false);
  assert.strictEqual(r.entry.id, 'b');
});
check('wanted non pending : skip explicite', () => {
  const r = selectEntry(entries, { wanted: 'c', max: 3 });
  assert.strictEqual(r.skipped, true);
  assert.match(r.reason, /introuvable/);
});
check('wanted deja claimed : skip explicite', () => {
  const r = selectEntry(entries, { wanted: 'a', claimed: ['a'], max: 3 });
  assert.strictEqual(r.skipped, true);
  assert.match(r.reason, /pull request ouverte/);
});
check('wanted inconnu : skip explicite', () => {
  const r = selectEntry(entries, { wanted: 'nexiste_pas', max: 3 });
  assert.strictEqual(r.skipped, true);
  assert.match(r.reason, /introuvable/);
});
check('commentaires de queue ignores', () => {
  const t = [
    'schema_version: 1',
    'total: 1',
    'max_attempts: 3',
    'queue:',
    '  - id: "abc"',
    '    status: done # commentaire',
    '    attempts: 2',
  ].join('\n');
  const p = parseQueue(t);
  assert.strictEqual(p.entries[0].id, 'abc');
  assert.strictEqual(p.entries[0].status, 'done');
  assert.strictEqual(p.entries[0].attempts, 2);
});
check('vraie file : la selection ne renvoie jamais done/blocked', () => {
  const r = selectEntry(q.entries, { max: 3 });
  if (!r.skipped) assert.strictEqual(r.entry.status, 'pending', r.entry.id);
});

console.log(failures ? `\n${failures} ECHEC(S)` : '\nTous les tests passent.');
process.exit(failures ? 1 : 0);
