"""Bouchon RFLink pour la validation de configuration en CI.

L'integration reelle est installee a la main (HACS) sur l'instance et n'est pas
versionnee dans ce depot. Sans ce bouchon, `check_config` echouerait sur
"Integration rflink not found" alors que la configuration du depot est valide.

ATTENTION - pourquoi ce schema est volontairement vide :

Declarer ici les cles `light`, `switch` et `cover` fait echouer la validation
globale. En effet, `check_config` construit le schema de premier niveau a partir
de ce CONFIG_SCHEMA, et `switch:` / `cover:` sont aussi des domaines de
plateformes de premier niveau. Toute cle partagee entre les deux se retrouve
alors validee deux fois, et la liste de plateformes (`- platform: group`)
est rejetee la ou un dictionnaire est attendu :

    Invalid config for 'rflink' at configuration.yaml, line 79:
    expected dict for dictionary value 'switch', got [{'platform': ...}]

Ce schema n'a donc qu'un role : faire exister le domaine. Il ne valide rien.
"""

import voluptuous as vol

CONFIG_SCHEMA = vol.Schema({}, extra=vol.ALLOW_EXTRA)
