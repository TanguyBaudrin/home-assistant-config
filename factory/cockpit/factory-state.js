// Etat de l'usine logicielle, calcule a partir de l'API GitHub et de la file
// de migration.
//
// Meme fichier des deux cotes : le collecteur Node
// (factory/cockpit/collect.cjs) l'utilise pour publier un instantane sur
// GitHub Pages, et la page (factory/cockpit/index.html) l'utilise pour un
// rafraichissement en direct quand l'utilisateur fournit un jeton. La logique
// est donc ecrite une fois, et testee une fois (factory-state.test.cjs).
//
// Module UMD, sans dependance : `require()` en Node, `window.FactoryState`
// dans le navigateur. Aucun paquet a installer, donc une pull request ne peut
// pas influencer ce qui est publie.
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.FactoryState = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  // --- File de migration (factory/queue.yaml) -----------------------------
  //
  // Meme forme fixe et meme lecture ligne a ligne que .github/scripts/queue.cjs :
  // un petit parseur suffit et evite d'embarquer un parseur YAML complet dans le
  // navigateur.

  /** Retire un commentaire de fin de ligne. Les scalaires de la file (un id,
   *  un statut) n'en contiennent jamais. */
  function stripInlineComment(line) {
    return line.replace(/\s+#.*$/, '').trimEnd();
  }

  /**
   * @param {string} text contenu de factory/queue.yaml
   * @returns {{total: (number|null), max_attempts: number, entries: Array}}
   */
  function parseQueue(text) {
    const lines = String(text).split('\n');
    const entries = [];
    let current = null;
    let inQueue = false;
    let total = null;
    let maxAttempts = 3;

    for (const raw of lines) {
      const line = stripInlineComment(raw);

      if (/^schema_version:/.test(line)) continue;
      if (/^total:/.test(line)) { total = Number(line.split(':')[1].trim()); continue; }
      if (/^max_attempts:/.test(line)) { maxAttempts = Number(line.split(':')[1].trim()); continue; }
      if (/^queue:\s*$/.test(line)) { inQueue = true; continue; }
      if (!inQueue) continue;

      const id = /^(\s*)-\s+id:\s*(.+)$/.exec(line);
      if (id) {
        current = {
          id: id[2].trim().replace(/^['"]|['"]$/g, ''),
          status: 'pending',
          attempts: 0,
        };
        entries.push(current);
        continue;
      }
      if (!current) continue;

      const status = /^\s+status:\s*(.+)$/.exec(line);
      if (status) { current.status = status[1].trim().replace(/^['"]|['"]$/g, ''); continue; }
      const attempts = /^\s+attempts:\s*(\d+)/.exec(line);
      if (attempts) current.attempts = Number(attempts[1]);
    }

    return { total, max_attempts: maxAttempts, entries };
  }

  /** Compte les statuts de la file. `total` vient du fichier s'il est present,
   *  sinon du nombre d'entrees reellement lues. */
  function queueCounts(queue) {
    const entries = (queue && queue.entries) || [];
    const counts = { done: 0, pending: 0, blocked: 0, total: entries.length };
    for (const entry of entries) {
      if (counts[entry.status] === undefined) counts[entry.status] = 0;
      counts[entry.status] += 1;
    }
    if (queue && queue.total != null) counts.total = queue.total;
    return counts;
  }

  // --- Etiquettes ---------------------------------------------------------

  /** Noms d'etiquettes, que l'API renvoie des chaines ou des objets. */
  function labelNames(entity) {
    return ((entity && entity.labels) || [])
      .map((label) => (typeof label === 'string' ? label : label && label.name))
      .filter(Boolean);
  }

  function hasLabel(entity, name) {
    return labelNames(entity).includes(name);
  }

  /** Nombre de corrections automatiques deja tentees sur une pull request. */
  function attemptCount(entity) {
    return labelNames(entity).filter((name) => /^factory\/attempt-\d+$/.test(name)).length;
  }

  // Etiquettes de l'usine, telles que declarees par factory/labels.yml.
  const FACTORY_LABELS = [
    'to-implement',
    'factory/no-spec',
    'factory/needs-fix',
    'factory/escalade',
    'factory/docs',
    'factory/migrate',
    'factory/no-review',
    'factory/attempt-1',
    'factory/attempt-2',
    'factory/attempt-3',
  ];

  function factoryLabels(entity) {
    const names = labelNames(entity);
    return FACTORY_LABELS.filter((name) => names.includes(name));
  }

  // --- Verdict de revue ---------------------------------------------------
  //
  // factory-review.yml termine sa revue par `VERDICT: OK` ou
  // `VERDICT: BLOQUANT`. On ne regarde que le dernier commentaire qui en porte
  // un, car la boucle revue/correction en empile plusieurs.

  const VERDICT = /VERDICT:\s*(OK|BLOQUANT)/;

  function lastVerdict(comments) {
    let verdict = null;
    for (const comment of comments || []) {
      const match = VERDICT.exec((comment && comment.body) || '');
      if (match) verdict = match[1];
    }
    return verdict;
  }

  // --- Classement ---------------------------------------------------------

  // Etapes du cycle d'une issue (voir docs/reference/tooling.md) :
  //   ouverte -> plan poste -> `to-implement` -> pull request.
  function classifyIssue(issue) {
    if (!issue) return 'inconnue';
    if (issue.state === 'closed') return 'fermee';
    const labels = labelNames(issue);
    if (labels.includes('to-implement')) return 'a-implementer';
    if (labels.includes('factory/no-spec')) return 'sans-spec';
    return 'a-specifier';
  }

  // Etat d'une pull request. L'ordre compte : une escalade prime sur
  // `needs-fix`, qui prime sur un verdict de revue lu dans les commentaires.
  function classifyPull(pull, verdict) {
    if (!pull) return 'inconnue';
    if (pull.merged_at) return 'fusionnee';
    if (pull.state === 'closed') return 'fermee';
    const labels = labelNames(pull);
    if (labels.includes('factory/escalade')) return 'escalade';
    if (labels.includes('factory/needs-fix')) return 'a-corriger';
    if (labels.includes('factory/no-review')) return 'hors-revue';
    if (verdict === 'BLOQUANT') return 'a-corriger';
    return 'en-revue';
  }

  // --- Metriques et sante -------------------------------------------------

  function deriveMetrics(state) {
    const counts = queueCounts(state.queue);
    const pulls = state.pulls || [];
    const issues = state.issues || [];
    const openPulls = pulls.filter((pull) => pull.state === 'open');
    const openIssues = issues.filter((issue) => issue.state === 'open');
    const byStatus = (status) => openPulls.filter((pull) => pull.status === status).length;

    return {
      queue_total: counts.total,
      queue_done: counts.done,
      queue_pending: counts.pending,
      queue_blocked: counts.blocked,
      pr_open: openPulls.length,
      pr_escalated: byStatus('escalade'),
      pr_needs_fix: byStatus('a-corriger'),
      pr_awaiting: byStatus('en-revue'),
      issues_open: openIssues.length,
      issues_to_implement: openIssues.filter((issue) => issue.stage === 'a-implementer').length,
    };
  }

  /**
   * Etat de sante global, du point de vue de qui doit arbitrer.
   * `critique` : quelque chose est arrete et attend un humain (escalade, file bloquee).
   * `attention` : la boucle automatique tourne encore (corrections en cours).
   * `ok` : rien a arbitrer.
   */
  function health(state) {
    const metrics = state.metrics || deriveMetrics(state);
    const problems = [];
    if (metrics.queue_blocked > 0) problems.push(`${metrics.queue_blocked} migration(s) bloquee(s)`);
    if (metrics.pr_escalated > 0) problems.push(`${metrics.pr_escalated} pull request(s) en escalade`);
    if (metrics.pr_needs_fix > 0) problems.push(`${metrics.pr_needs_fix} pull request(s) a corriger`);

    let level = 'ok';
    if (metrics.queue_blocked > 0 || metrics.pr_escalated > 0) level = 'critique';
    else if (metrics.pr_needs_fix > 0) level = 'attention';
    return { level, problems };
  }

  // --- Collecte -----------------------------------------------------------

  /**
   * Construit l'etat complet de l'usine.
   *
   * @param {(endpoint: string) => Promise<any>} request lit un endpoint REST
   *   GitHub et renvoie le JSON. Injectable : le test passe un faux client, et
   *   le navigateur passe `fetch` muni du jeton de l'utilisateur.
   * @param {{owner: string, repo: string, queueText?: string, branch?: string}} options
   */
  async function collect(request, options) {
    const owner = options.owner;
    const repo = options.repo;
    const branch = options.branch || 'main';
    const base = `/repos/${owner}/${repo}`;

    const [repoInfo, issuesRaw, pullsRaw, runsRaw] = await Promise.all([
      request(base),
      request(`${base}/issues?state=all&per_page=100&sort=updated&direction=desc`),
      request(`${base}/pulls?state=all&per_page=100&sort=updated&direction=desc`),
      request(`${base}/actions/runs?per_page=50`),
    ]);

    const issues = (issuesRaw || [])
      .filter((issue) => !issue.pull_request)
      .map((issue) => ({
        number: issue.number,
        title: issue.title,
        state: issue.state,
        labels: labelNames(issue),
        factory_labels: factoryLabels(issue),
        created_at: issue.created_at,
        updated_at: issue.updated_at,
        url: issue.html_url,
        stage: classifyIssue(issue),
      }));

    const pulls = [];
    for (const raw of pullsRaw || []) {
      const pull = {
        number: raw.number,
        title: raw.title,
        state: raw.state,
        draft: !!raw.draft,
        head_ref: (raw.head && raw.head.ref) || '',
        labels: labelNames(raw),
        factory_labels: factoryLabels(raw),
        attempts: attemptCount(raw),
        verdict: null,
        created_at: raw.created_at,
        updated_at: raw.updated_at,
        merged_at: raw.merged_at,
        url: raw.html_url,
      };

      // Le verdict vit dans les commentaires, et on ne paie l'appel que pour
      // les pull requests encore ouvertes : une PR fusionnee ne se relira pas.
      let comments = [];
      if (raw.state === 'open') {
        try {
          comments = await request(`${base}/issues/${raw.number}/comments?per_page=100`);
        } catch (error) {
          comments = [];
        }
        pull.verdict = lastVerdict(comments);
      }
      pull.status = classifyPull(raw, pull.verdict);
      pulls.push(pull);
    }

    const runs = ((runsRaw && runsRaw.workflow_runs) || [])
      .filter((run) => /factory/i.test(run.name || '') || /factory-/.test(run.path || ''))
      .map((run) => ({
        workflow: run.name,
        status: run.status,
        conclusion: run.conclusion,
        event: run.event,
        branch: run.head_branch,
        created_at: run.created_at,
        url: run.html_url,
      }));

    const state = {
      generated_at: new Date().toISOString(),
      repo: {
        owner,
        name: repo,
        url: (repoInfo && repoInfo.html_url) || `https://github.com/${owner}/${repo}`,
      },
      default_branch: (repoInfo && repoInfo.default_branch) || branch,
      queue: parseQueue(options.queueText || ''),
      issues,
      pulls,
      runs,
    };
    state.metrics = deriveMetrics(state);
    state.health = health(state);
    return state;
  }

  return {
    parseQueue,
    queueCounts,
    labelNames,
    hasLabel,
    attemptCount,
    factoryLabels,
    lastVerdict,
    classifyIssue,
    classifyPull,
    deriveMetrics,
    health,
    collect,
    FACTORY_LABELS,
  };
});
