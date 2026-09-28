// Lecture de la file de migration et selection d'une entree.
//
// Utilise par .github/workflows/factory-migrate.yml via require(), et teste
// directement par node (voir .github/scripts/queue.test.cjs).
//
// Volontairement sans dependance : les pull requests ne doivent pas pouvoir
// installer de paquet depuis le depot pour influencer la selection.

/**
 * Parse le bloc `queue:` de factory/queue.yaml.
 *
 * Le fichier est genere par nos soins et suit une forme fixe, un petit parseur
 * ligne a ligne suffit et evite d'embarquer un parseur YAML complet.
 *
 * @param {string} text contenu de factory/queue.yaml
 * @returns {{total: number|null, max_attempts: number, entries: Array}}
 */
function parseQueue(text) {
  const lines = String(text).split('\n');
  const entries = [];
  let current = null;
  let inQueue = false;
  let total = null;
  let maxAttempts = 3;

  for (const raw of lines) {
    // Retire les commentaires de fin de ligne, mais pas les # d'un scalaire.
    const line = raw.replace(/\s+#.*$/, '').trimEnd();

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
    if (attempts) { current.attempts = Number(attempts[1]); }
  }

  return { total, max_attempts: maxAttempts, entries };
}

/**
 * Choisit l'entree a migrer.
 *
 * Regles, dans cet ordre :
 *  - statut `pending` uniquement (jamais `done` ni `blocked`) ;
 *  - si `wanted` est fourni, cet identifiant-la precisement ;
 *  - jamais une entree deja couverte par une pull request ouverte ;
 *  - jamais au-dela de `max` tentatives.
 *
 * @returns {{skipped: true, reason: string}|{skipped: false, entry: object, max: number}}
 */
function selectEntry(entries, { claimed = [], wanted = '', max = 3 } = {}) {
  const has = new Set(claimed);
  const candidates = entries.filter(e => e.status === 'pending');

  if (wanted) {
    const exact = candidates.find(e => e.id === wanted);
    if (!exact) return { skipped: true, reason: `introuvable ou non pending : ${wanted}` };
    if (has.has(exact.id)) return { skipped: true, reason: `${wanted} a deja une pull request ouverte` };
    if (exact.attempts >= max) return { skipped: true, reason: `${wanted} : ${exact.attempts} tentatives` };
    return { skipped: false, entry: exact, max };
  }

  for (const e of candidates) {
    if (has.has(e.id)) continue;
    if (e.attempts >= max) continue;
    return { skipped: false, entry: e, max };
  }
  return { skipped: true, reason: candidates.length ? 'toutes les entrees disponibles sont deja couvertes ou bloquees' : 'aucune entree pending' };
}

/** Ids deja couverts par une pull request ouverte, a partir du prefixe de branche. */
function claimedIds(pulls, prefix) {
  return pulls.map(p => p.head.ref).filter(r => r.startsWith(prefix)).map(r => r.slice(prefix.length));
}

module.exports = { parseQueue, selectEntry, claimedIds };
