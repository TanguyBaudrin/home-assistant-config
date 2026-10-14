#!/usr/bin/env node
// Collecte l'etat de l'usine et ecrit un instantane JSON, publie ensuite sur
// GitHub Pages par .github/workflows/factory-cockpit.yml.
//
// Le jeton vient de GITHUB_TOKEN (fourni par le workflow) : le depot est prive,
// donc l'API exige une authentification meme en lecture. Rien n'est ecrit hors
// du fichier de sortie.
//
// Usage : GITHUB_TOKEN=... GITHUB_REPOSITORY=owner/repo node collect.cjs [sortie.json]

'use strict';

const fs = require('fs');
const path = require('path');
const { collect } = require('./factory-state.js');

const API = process.env.GITHUB_API_URL || 'https://api.github.com';
const TOKEN = process.env.GITHUB_TOKEN || '';
const SLUG = process.env.GITHUB_REPOSITORY || 'TanguyBaudrin/home-assistant-config';

const [owner, repo] = SLUG.split('/');
if (!owner || !repo) {
  console.error(`GITHUB_REPOSITORY invalide : ${SLUG}`);
  process.exit(1);
}

const output = process.argv[2] || path.join(__dirname, 'data.json');
const queuePath = path.join(__dirname, '..', 'queue.yaml');

/** Lecture d'un endpoint REST GitHub, avec le jeton du workflow. */
async function request(endpoint) {
  const res = await fetch(`${API}${endpoint}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'factory-cockpit',
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
    },
  });
  if (!res.ok) {
    throw new Error(`${endpoint} -> ${res.status} ${res.statusText}`);
  }
  return res.json();
}

(async () => {
  const queueText = fs.existsSync(queuePath) ? fs.readFileSync(queuePath, 'utf8') : '';
  const state = await collect(request, { owner, repo, queueText });
  fs.writeFileSync(output, `${JSON.stringify(state, null, 2)}\n`);

  const metrics = state.metrics;
  console.log(
    `Cockpit genere : ${output} `
    + `(${metrics.queue_done}/${metrics.queue_total} migrations, `
    + `${metrics.pr_open} PR ouvertes, ${metrics.issues_open} issues ouvertes).`,
  );
})().catch((error) => {
  console.error(`Collecte impossible : ${error.message}`);
  process.exit(1);
});
