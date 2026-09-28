"""Bouchon Circadian Lighting pour la validation de configuration en CI.

L'integration reelle est installee via HACS sur l'instance. La configuration du
depot declare une section racine `circadian_lighting:` (min_colortemp,
max_colortemp) et l'utilise comme plateforme `switch`.

Voir .ci/custom_components/rflink/__init__.py pour pourquoi CONFIG_SCHEMA doit
rester vide : declarer des cles qui sont aussi des domaines de premier niveau
casse la validation globale.
"""

import voluptuous as vol

CONFIG_SCHEMA = vol.Schema({}, extra=vol.ALLOW_EXTRA)
