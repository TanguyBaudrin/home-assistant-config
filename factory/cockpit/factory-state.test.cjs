// Tests de factory-state.js avec un faux client REST.
//
// Meme style que les autres tests de scripts du depot (queue.test.cjs) : aucun
// cadre de test, chaque assertion affiche son nom et l'echec est detaille.
'use strict';

const assert = require('assert');
const state = require('./factory-state.js');

let failures = 0;

// Test synchrone.
function check(name, fn) {
  try {
    fn();
    console.log(`  ok   ${name}`);
  } catch (error) {
    failures += 1;
    console.log(`  FAIL ${name}\n       ${error.message}`);
  }
}

const QUEUE = [
  '# File generee, ne pas editer a la main.',
  'schema_version: 1',
  'source: automations/to_split.yaml',
  'total: 4',
  'max_attempts: 3',
  'queue:',
  "  - id: 'camera_disconnected'",
  '    status: pending',
  '    attempts: 0',
  "  - id: '1735821043121'",
  '    status: done',
  '    attempts: 1  # fusionnee',
  "  - id: '1736019595242'",
  '    status: blocked',
  '    attempts: 3',
  "  - id: '1736333581558'",
  '    status: pending',
  '    attempts: 2',
  '',
].join('\n');

// --- File de migration ----------------------------------------------------

const queue = state.parseQueue(QUEUE);

check('parseQueue lit total et max_attempts', () => {
  assert.strictEqual(queue.total, 4);
  assert.strictEqual(queue.max_attempts, 3);
});

check('parseQueue lit chaque entree, statut et tentatives', () => {
  assert.strictEqual(queue.entries.length, 4);
  assert.deepStrictEqual(queue.entries[0], { id: 'camera_disconnected', status: 'pending', attempts: 0 });
  assert.deepStrictEqual(queue.entries[1], { id: '1735821043121', status: 'done', attempts: 1 });
  assert.deepStrictEqual(queue.entries[2], { id: '1736019595242', status: 'blocked', attempts: 3 });
  assert.strictEqual(queue.entries[3].attempts, 2);
});

check('parseQueue ignore le commentaire de fin de ligne', () => {
  assert.strictEqual(queue.entries[1].status, 'done');
});

check('queueCounts compte done/pending/blocked', () => {
  const counts = state.queueCounts(queue);
  assert.deepStrictEqual(counts, { done: 1, pending: 2, blocked: 1, total: 4 });
});

check('queueCounts retombe sur le nombre d entrees sans total', () => {
  const counts = state.queueCounts({ entries: [{ status: 'pending' }, { status: 'pending' }] });
  assert.strictEqual(counts.total, 2);
  assert.strictEqual(counts.pending, 2);
});

// --- Etiquettes -----------------------------------------------------------

check('labelNames accepte les chaines et les objets', () => {
  assert.deepStrictEqual(
    state.labelNames({ labels: ['bug', { name: 'factory/needs-fix' }] }),
    ['bug', 'factory/needs-fix'],
  );
});

check('attemptCount compte les etiquettes factory/attempt-N', () => {
  assert.strictEqual(state.attemptCount({ labels: ['factory/attempt-1', 'factory/attempt-2'] }), 2);
  assert.strictEqual(state.attemptCount({ labels: ['factory/needs-fix'] }), 0);
});

check('factoryLabels ne garde que les etiquettes de l usine', () => {
  assert.deepStrictEqual(
    state.factoryLabels({ labels: ['bug', 'to-implement', 'docs'] }),
    ['to-implement'],
  );
});

// --- Verdict --------------------------------------------------------------

check('lastVerdict garde le dernier verdict de la conversation', () => {
  const verdict = state.lastVerdict([
    { body: 'Une revue.\n\nVERDICT: BLOQUANT' },
    { body: 'Merci, corrige.' },
    { body: 'Relecture.\n\nVERDICT: OK' },
  ]);
  assert.strictEqual(verdict, 'OK');
});

check('lastVerdict vaut null sans verdict', () => {
  assert.strictEqual(state.lastVerdict([{ body: 'rien' }]), null);
  assert.strictEqual(state.lastVerdict([]), null);
});

// --- Classement -----------------------------------------------------------

check('classifyIssue suit le cycle de vie', () => {
  assert.strictEqual(state.classifyIssue({ state: 'open', labels: [] }), 'a-specifier');
  assert.strictEqual(state.classifyIssue({ state: 'open', labels: ['to-implement'] }), 'a-implementer');
  assert.strictEqual(state.classifyIssue({ state: 'open', labels: ['factory/no-spec'] }), 'sans-spec');
  assert.strictEqual(state.classifyIssue({ state: 'closed', labels: [] }), 'fermee');
});

check('classifyPull ordonne escalade, correction, revue', () => {
  assert.strictEqual(state.classifyPull({ state: 'open', labels: ['factory/escalade'] }), 'escalade');
  assert.strictEqual(state.classifyPull({ state: 'open', labels: ['factory/needs-fix', 'factory/escalade'] }), 'escalade');
  assert.strictEqual(state.classifyPull({ state: 'open', labels: ['factory/needs-fix'] }), 'a-corriger');
  assert.strictEqual(state.classifyPull({ state: 'open', labels: ['factory/no-review'] }), 'hors-revue');
  assert.strictEqual(state.classifyPull({ state: 'open', labels: [] }, 'BLOQUANT'), 'a-corriger');
  assert.strictEqual(state.classifyPull({ state: 'open', labels: [] }, 'OK'), 'en-revue');
  assert.strictEqual(state.classifyPull({ state: 'closed', merged_at: '2026-01-01T00:00:00Z', labels: [] }), 'fusionnee');
  assert.strictEqual(state.classifyPull({ state: 'closed', labels: [] }), 'fermee');
});

// --- Metriques et sante ---------------------------------------------------

function sampleState() {
  const pulls = [
    { state: 'open', status: 'escalade', labels: ['factory/escalade'] },
    { state: 'open', status: 'en-revue', labels: [] },
    { state: 'closed', status: 'fusionnee', labels: [] },
  ];
  const issues = [
    { state: 'open', stage: 'a-implementer' },
    { state: 'open', stage: 'a-specifier' },
    { state: 'closed', stage: 'fermee' },
  ];
  const built = { queue, pulls, issues };
  built.metrics = state.deriveMetrics(built);
  return built;
}

check('deriveMetrics compte les PR et issues pertinentes', () => {
  const metrics = sampleState().metrics;
  assert.strictEqual(metrics.pr_open, 2);
  assert.strictEqual(metrics.pr_escalated, 1);
  assert.strictEqual(metrics.issues_open, 2);
  assert.strictEqual(metrics.issues_to_implement, 1);
  assert.strictEqual(metrics.queue_blocked, 1);
});

check('health est critique des qu une escalade existe', () => {
  const verdict = state.health(sampleState());
  assert.strictEqual(verdict.level, 'critique');
  assert.ok(verdict.problems.some((line) => /escalade/.test(line)));
});

check('health est ok sans escalade ni blocage', () => {
  const built = { queue: { total: 2, entries: [{ status: 'done' }, { status: 'pending' }] }, pulls: [], issues: [] };
  built.metrics = state.deriveMetrics(built);
  assert.strictEqual(state.health(built).level, 'ok');
});

// --- Collecte (faux client REST) ------------------------------------------

// Fabrique un client REST servant les reponses fixees, et enregistre les appels.
function fakeRequest() {
  const calls = [];
  const data = {
    '/repos/acme/demo': { html_url: 'https://github.com/acme/demo', default_branch: 'main' },
    '/repos/acme/demo/issues?state=all&per_page=100&sort=updated&direction=desc': [
      { number: 2, title: 'Une issue', state: 'open', labels: ['to-implement'], html_url: 'u2', created_at: 'a', updated_at: 'b' },
      { number: 3, title: 'Une PR vue par l API issues', state: 'open', labels: [], pull_request: {}, html_url: 'u3' },
    ],
    '/repos/acme/demo/pulls?state=all&per_page=100&sort=updated&direction=desc': [
      { number: 4, title: 'Migration', state: 'open', labels: ['factory/attempt-1'], head: { ref: 'factory/migrate/1' }, html_url: 'p4', created_at: 'a', updated_at: 'b', merged_at: null },
      { number: 5, title: 'Fusionnee', state: 'closed', labels: [], head: { ref: 'factory/migrate/2' }, html_url: 'p5', created_at: 'a', updated_at: 'b', merged_at: '2026-01-01T00:00:00Z' },
    ],
    '/repos/acme/demo/issues/4/comments?per_page=100': [
      { body: 'VERDICT: BLOQUANT' },
    ],
    '/repos/acme/demo/actions/runs?per_page=50': {
      workflow_runs: [
        { name: 'Factory Migrate', path: '.github/workflows/factory-migrate.yml', status: 'completed', conclusion: 'success', event: 'schedule', head_branch: 'main', created_at: 'c', html_url: 'r1' },
        { name: 'CI', path: '.github/workflows/ci.yml', status: 'completed', conclusion: 'success', event: 'push', head_branch: 'main', created_at: 'c', html_url: 'r2' },
      ],
    },
  };
  const fn = async (endpoint) => {
    calls.push(endpoint);
    if (!(endpoint in data)) throw new Error(`endpoint inattendu : ${endpoint}`);
    return data[endpoint];
  };
  fn.calls = calls;
  return fn;
}

(async () => {
  let collected = null;
  try {
    collected = await state.collect(fakeRequest(), { owner: 'acme', repo: 'demo', queueText: QUEUE });
    console.log('  ok   collect construit l etat complet');
  } catch (error) {
    failures += 1;
    console.log(`  FAIL collect construit l etat complet\n       ${error.message}`);
  }

  if (collected) {
    check('collect exclut les pull requests de la liste des issues', () => {
      assert.deepStrictEqual(collected.issues.map((issue) => issue.number), [2]);
      assert.strictEqual(collected.issues[0].stage, 'a-implementer');
    });

    check('collect lit le verdict et classe la pull request', () => {
      const pull = collected.pulls.find((item) => item.number === 4);
      assert.strictEqual(pull.verdict, 'BLOQUANT');
      assert.strictEqual(pull.status, 'a-corriger');
      assert.strictEqual(pull.attempts, 1);
    });

    check('collect ne lit pas les commentaires des PR fermees', () => {
      const pull = collected.pulls.find((item) => item.number === 5);
      assert.strictEqual(pull.status, 'fusionnee');
    });

    check('collect ne garde que les executions de la factory', () => {
      assert.deepStrictEqual(collected.runs.map((run) => run.workflow), ['Factory Migrate']);
    });

    check('collect expose des metriques et une sante coherentes', () => {
      assert.strictEqual(collected.metrics.pr_open, 1);
      assert.strictEqual(collected.metrics.pr_needs_fix, 1);
      assert.strictEqual(collected.metrics.queue_total, 4);
      assert.strictEqual(collected.health.level, 'critique');
    });
  }

  console.log(failures ? `\n${failures} ECHEC(S)` : '\nTous les tests passent.');
  process.exit(failures ? 1 : 0);
})();
