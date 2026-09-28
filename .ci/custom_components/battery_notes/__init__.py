"""Bouchon Battery Notes pour la validation de configuration en CI.

Meme principe que le bouchon RFLink : l'integration reelle est installee via
HACS sur l'instance, absente du depot. La configuration du depot ne declare
qu'une section `battery_notes:` vide.

Voir .ci/custom_components/rflink/__init__.py pour pourquoi CONFIG_SCHEMA doit
rester vide : declarer des cles qui sont aussi des domaines de premier niveau
casse la validation globale.
"""

import voluptuous as vol

CONFIG_SCHEMA = vol.Schema({}, extra=vol.ALLOW_EXTRA)
