Vérifie que la documentation du dépôt reflète la configuration actuelle.

Périmètre : `docs/**`, `AGENTS.md`, `README.md`, `factory/policy.md`. Ne modifie
aucun autre fichier.

Méthode :

- compare les entités et automatisations réellement présentes dans le dépôt avec
  ce qui est documenté ;
- corrige ce qui est faux ou manquant ;
- si une correction demanderait de modifier la configuration plutôt que la
  documentation, ne le fais pas : signale-le dans ton rapport.

Si la documentation est déjà correcte, ne modifie rien et dis-le explicitement :
c'est un résultat acceptable et préférable à une pull request vide.

Termine par ton rapport Markdown.
