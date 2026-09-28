"""Plateforme `switch` du bouchon Circadian Lighting.

La configuration du depot utilise `switch:` / `- platform: circadian_lighting`
avec une cle `lights_brightness:`. Home Assistant exige que le module de
plateforme expose PLATFORM_SCHEMA pour valider cette section ; sans ce fichier,
check_config signale une plateforme inconnue :

    Platform error 'switch' from integration 'circadian_lighting'

Comme pour le reste des bouchons, rien n'est execute : uniquement un schema
permissif. Ici les cles ne sont pas en conflit, car ce schema s'applique a la
configuration de la plateforme et non au schema de premier niveau.
"""

import voluptuous as vol

PLATFORM_SCHEMA = vol.Schema(
    {
        vol.Optional("lights_brightness"): list,
        vol.Optional("lights_rgbww"): list,
        vol.Optional("switch_name"): str,
        vol.Optional("exclude"): list,
        vol.Optional("globals"): dict,
    },
    extra=vol.ALLOW_EXTRA,
)
