# Cockpit de l'usine logicielle

Vue en lecture seule de l'usine d'agents décrite dans
[`docs/reference/tooling.md`](../../docs/reference/tooling.md) : avancement de la
file de migration, pull requests ouvertes et leur état (revue, corrections,
escalades), issues en attente, et dernières exécutions des workflows
`factory-*`.

```
factory/cockpit/
├── index.html              # la page, autonome (aucune ressource externe)
├── factory-state.js        # logique partagée : collecte + classement (UMD)
├── collect.cjs             # écrit data.json depuis l'API GitHub
├── factory-state.test.cjs  # tests unitaires de factory-state.js
├── data.json               # instantané généré, NON versionné (voir .gitignore)
└── README.md
```

## Comment les données arrivent

1. `collect.cjs` interroge l'API GitHub (`issues`, `pulls`, `actions/runs`) et
   lit `factory/queue.yaml`, puis écrit `data.json`.
2. La page lit `data.json` et affiche l'état. **Aucun jeton n'est nécessaire
   pour consulter l'instantané.**

Le dépôt est privé : l'API exige une authentification même en lecture, donc la
collecte se fait côté serveur, dans le workflow, avec le `GITHUB_TOKEN` fourni
par GitHub Actions. La page publiée ne contient donc aucun secret.

## Rafraîchissement en direct (optionnel)

Le dépôt étant privé, l'instantané publié a l'âge de la dernière exécution du
workflow. Pour forcer une lecture fraîche, la page accepte un **jeton GitHub en
lecture seule** :

- il reste dans le navigateur (`localStorage`, clé `factory-cockpit-token`) ;
- il n'est envoyé qu'à `https://api.github.com` ;
- « Oublier le jeton » le supprime.

Un jeton *fine-grained* limité à ce dépôt avec le seul accès `Contents: Read` et
`Pull requests: Read` suffit (`issues: read` et `actions: read` pour les issues
et les exécutions).

## En local

Les navigateurs bloquent `fetch('data.json')` en `file://`. Pour visualiser la
page en local, servez le dossier :

```bash
GITHUB_TOKEN="$(gh auth token)" GITHUB_REPOSITORY="TanguyBaudrin/home-assistant-config" \
  node factory/cockpit/collect.cjs factory/cockpit/data.json
python3 -m http.server -d factory/cockpit 8080
# puis http://localhost:8080/
```

Tests :

```bash
node factory/cockpit/factory-state.test.cjs   # inclus dans `mise run factory-tests`
```

## Publication (GitHub Pages)

Le workflow [`.github/workflows/factory-cockpit.yml`](../../.github/workflows/factory-cockpit.yml)
collecte l'instantané puis publie `index.html`, `factory-state.js` et
`data.json` sur GitHub Pages. Il tourne toutes les 3 heures, à chaque
modification de `factory/queue.yaml` ou du cockpit, et à la demande
(`workflow_dispatch`).

**Prérequis, une seule fois** : dans *Settings → Pages*, régler **Source** sur
**GitHub Actions**. Les Pages d'un dépôt privé nécessitent un plan payant
(Pro/Team/Enterprise Cloud) ; sans cela, le job `deploy` échoue — la page reste
utilisable en local comme ci-dessus.

Le site publié ne contient aucune donnée sensible (uniquement des numéros,
titres, branches et états, servis à qui connaît l'URL). Il ne peut rien modifier :
toutes les requêtes sont en lecture.
