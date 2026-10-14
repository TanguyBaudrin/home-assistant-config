# Cockpit de l'usine logicielle

Vue en lecture seule de l'usine d'agents : avancement de la file de migration,
pull requests ouvertes et leur état (revue, corrections, escalades), issues en
attente, et dernières exécutions des workflows `factory-*`.

```
factory/cockpit/
├── index.html              # la page, autonome (aucune ressource externe)
├── factory-state.js        # logique partagée : collecte + classement (UMD)
├── collect.cjs             # écrit data.json depuis l'API GitHub (côté workflow)
├── factory-state.test.cjs  # tests unitaires de factory-state.js
├── data.json               # instantané généré, NON versionné
└── README.md
```

## Comment les données arrivent

1. `.github/workflows/factory-cockpit.yml` lance `collect.cjs` avec
   `GITHUB_TOKEN` (fourni par GitHub Actions). Il lit `issues`, `pulls`,
   `actions/runs` et `factory/queue.yaml`, et écrit `factory/cockpit/data.json`.
2. Le workflow publie ensuite `index.html`, `factory-state.js` et `data.json`
   sur **GitHub Pages**.

**Aucun jeton n'est demandé à la personne qui consulte la page.** La page ne fait
que lire l'instantané.

## Fréquence de mise à jour

Le snapshot est régénéré :
- toutes les heures (planifié) ;
- à chaque activité sur les issues ou PRs (ouverture, clôture, renommage,
  ajout/retrait d'étiquette) ;
- quand un workflow `factory-*` se termine ;
- à chaque push sur `main` touchant le cockpit ou `factory/queue.yaml` ;
- à la demande (`workflow_dispatch`).

## En local

Les navigateurs bloquent `fetch('data.json')` en `file://`. Pour visualiser en
local :

```bash
GITHUB_TOKEN="$(gh auth token)" GITHUB_REPOSITORY="TanguyBaudrin/home-assistant-config" \
  node factory/cockpit/collect.cjs factory/cockpit/data.json
python3 -m http.server -d factory/cockpit 8080
# http://localhost:8080/
```

Tests :

```bash
node factory/cockpit/factory-state.test.cjs   # inclus dans `mise run factory-tests`
```

## Publication

Le dépôt est **public** : GitHub Pages y est gratuit. Le workflow publie sur
l'environnement `github-pages`. Les Pages doivent être activées une fois dans
*Settings → Pages* avec **Source : GitHub Actions** ; sans cela, le job
`deploy` échoue et la page reste utilisable en local.

Le site ne contient aucune donnée sensible au-delà des numéros, titres,
branches et états de l'usine ; il est en lecture seule.

## Développement local / Jeton PAT

Si tu veux collecter en local hors contexte GitHub Actions, un **fine-grained**
PAT suffit. Permissions requises sur ce dépôt :

- **Issues** → Read
- **Pull requests** → Read
- **Contents** → Read (pour lire `factory/queue.yaml`)
- **Actions** → Read (pour lister les exécutions `factory-*`)

Classic token : `repo` suffit. Si tu obtenais un 404 avec un fine-grained, c'est
généralement qu'il manque `Contents: Read` ou que le dépôt n'est pas sélectionné
dans le périmètre du jeton.
