# Plan d'implementation d'une issue

Redige le plan d'implementation de l'issue ci-dessous. Tu ne modifies aucun
fichier : tu produis un plan, que l'agent de construction executera plus tard,
une fois qu'un humain l aura valide.

## Issue {{ISSUE_NUMBER}}

Titre : {{ISSUE_TITLE}}

Corps :

```
{{ISSUE_BODY}}
```

## Discussion

{{DISCUSSION}}

## Ce que tu rends

Un commentaire Markdown, et rien d'autre. Pas de prelude, pas de compte rendu
de ce que tu as fait, pas de formule d'introduction. Commence directement par
`## Plan`.

Structure attendue, dans cet ordre :

### `## Plan`

Une phrase : l'objectif, en francais, dans les mots de la personne qui a
ouvert l'issue. Si l'issue demande deux choses sans rapport, dis-le ici et
propose de les scinder.

### `### Ce qui existe deja`

Les automatisations, sensors, templates et blueprints qui touchent deja les
entites concernees, avec `fichier:ligne` pour chacun. Ecris explicitement
« aucun » si tu n'as rien trouve : c'est une information, pas une absence.

### `### Points ambigus`

Ce que tu as du deviner. Deux formes possibles, et seulement deux :

- **Hypothese retenue** : ce que tu as decide, et pourquoi. Ecris
  « Hypothese : ... — Raison : ... ».
- **Question** : une question precise, closed, a laquelle on peut repondre en
  une ligne. « Faut-il ouvrir aussi le week-end ? » et non « des
  precisions ? ».

Si l'issue est deja parfaitement claire, ecris « Aucun : l'issue ne laisse pas
de place a l'interpretation. » C'est un resultat legitime.

### `### Perimetre`

Une liste des fichiers a creer, puis des fichiers a modifier, avec pour
chacun ce qui change. Une entite par ligne, si le plan en introduit. Et une
ligne « Hors perimetre : ... » qui rappelle ce que tu ne toucheras pas.

### `### Etapes`

Une liste de taches Markdown a cocher, `- [ ]`, dans l'ordre d'execution. Une
tache = une verification ou une ecriture concrete, verifiable. « Ajouter
l'automatisation `auto_xxx` dans `automations/<zone>/<nom>.yaml` avec
declencheur ... » est une tache. « S'occuper de la partie volet » n'en est pas
une.

Termine par une ligne `Inconnu : ...` si tu dois lister ce qui ne pourra pas
etre verifie avant l'ecriture, typiquement l'existence d'une entite sur
l'instance. Omet cette ligne s'il n'y a rien.

## Ce que tu ne fais pas

- Tu n'ecris aucun fichier, aucun YAML complet, aucun code.
- Tu ne poses pas d'etiquette, tu n'ouvres pas d'issue, tu ne pousses rien.
- Tu ne rediges pas le message de la pull request : c'est plus tard.
