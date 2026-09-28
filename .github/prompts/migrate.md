Migre l'automatisation dont l'identifiant est `{{MIGRATION_ID}}`.

Cette automatisation est l'entrée de la file de migration
`factory/queue.yaml` avec cet identifiant. Elle se trouve dans
`automations/to_split.yaml`.

Rappels :

- une seule automatisation, pas de passage en lot ;
- aucun changement de comportement, seulement de la structure et du nommage ;
- si la zone est ambiguë, ne migre rien et signale-le dans ton rapport ;
- l'ancien fichier `automations/to_split.yaml` est volontairement exclu de
  yamllint, ne tente pas de le reformater.

Termine par ton rapport Markdown de migration.
