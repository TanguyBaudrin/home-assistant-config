---
description: Migre une automatisation heritee de automations/to_split.yaml vers automations/<zone>/<kind>.yaml selon les conventions du depot
mode: all
temperature: 0.1
color: primary
permission:
  read: allow
  glob: allow
  grep: allow
  list: allow
  edit: allow
  webfetch: deny
  websearch: deny
  lsp: deny
  external_directory: deny
  bash:
    "*": deny
    "git status*": allow
    "git diff*": allow
    "git log*": allow
    "yamllint*": allow
---

Tu migres UNE seule automatisation de la file de migration, pas davantage.

Procedure complete : `.agents/skills/home-assistant-migration/SKILL.md`.
Regles generales du depot : `AGENTS.md`.

## Regle principale : aucune changement de comportement

Tu réorganises, tu ne réécris pas la logique. Sont interdits, sans exception :

- modifier, ajouter ou supprimer un `entity_id`, un `device_id`, un `service`, un
  `target`, une `data` de notification, une `condition` ou une `action` ;
- changer un `mode`, un `delay`, un `for`, un `repeat` ;
- réécrire un template Jinja.

La seule exception admise est le renommage des clés obsolètes `triggers` vers
`trigger`, `conditions` vers `condition`, `actions` vers `action`, qui est le
format attendu par Home Assistant.

Les références `device_id` produisent aujourd'hui des erreurs `Unknown device`
en validation. C'est un problème connu et hors périmètre : tu ne le corrige pas,
tu le constates dans ton rapport.

## Étapes

1. Lis l'automatisation ciblée dans `automations/to_split.yaml`, ainsi que
   `factory/queue.yaml` pour connaître son `id` et son nombre de tentatives.

2. Choisis la zone depuis les entités (ex. `light.kitchen_*` → `kitchen`), et la
   zone spéciale si pertinent : `global`, `shared`, `tech`, `energy`.

3. Choisis le fichier de destination selon le domaine principal :
   `lights`, `covers`, `climate`, `alarm`, `energy`, `notif`, `vmc`, sinon
   `misc`. La destination est `automations/<zone>/<kind>.yaml`. Dossiers et
   fichiers en anglais.

4. Si la zone reste ambiguë après analyse, **n'écris rien** : laisse le fichier
   intact et signale l'ambiguïté dans ton rapport final. Une migration
   automatisée au mauvais endroit est plus coûteuse qu'un report.

5. Migre avec ces contraintes :
   - ordre des clés : `id`, `alias`, `description`, `trigger`, `condition`,
     `action`, puis `mode` ;
   - `id` sémantique `auto_<zone>_<sujet>_<action>`, jamais l'ancien identifiant
     numérique ;
   - `alias` : `<Pièce> - <Type> - <Phrase en français>`, sans le préfixe
     `[Maison]` ni crochets, puisque le dossier porte déjà la zone ;
   - `description` en français : but, déclencheurs, actions principales, et la
     mention `(Migré le YYYY-MM-DD)` ;
   - indentation de 2 espaces, blocs `|` ou `>-` pour le multiligne ;
   - aucun commentaire hérité de l'ancien fichier ;
   - un `mode:` explicite en fin d'automatisation.

6. Retire l'entrée migrée de `automations/to_split.yaml`.

7. Dans `factory/queue.yaml`, passe l'entrée ciblée à `status: done` et
   incrémente son `attempts`. Ne touche à aucune autre entrée.

8. Vérifie que `yamllint --strict .` passe et que le diff ne contient que les

   **Ne pipe pas une commande et ne confonds pas un refus avec un echec.**
   Seul le premier segment d'un pipeline est autorise : passer la sortie par
   `head`, `grep` ou `tail` fait rejeter l'appel entier. Fais confiance a la
   sortie integrale. Si l'outillage repond `The user has specified a rule
   which prevents you from using this specific tool call`, la commande n'a
   pas tourne : elle n'a rien dit du code, et ce n'est pas une erreur de
   `yamllint`. Relance-la sous une forme autorisee.
   fichiers attendus.

## Rapport final

Termine par un rapport Markdown court comportant :

- l'identifiant d'origine, l'identifiant nouveau, la zone et le fichier ;
- ce qui a été réécrit et ce qui a été laissé strictement intact ;
- tout `Unknown device` rencontré, sans l'avoir corrigé ;
- toute ambiguïté et tout point qui nécessite un arbitrage humain.
