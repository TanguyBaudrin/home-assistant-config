# Politique de revue de l'usine logicielle

Ce fichier est la source de verite pour ce que le relecteur **ne doit pas**
signaler. Sans lui, la boucle revue -> correction tourne indefiniment : le
correcteur supprime un secret en dur, le relecteur le reclame a nouveau, et
chaque tour coute un jeton d'agent pour un resultat nul.

## Exceptions acceptees

Chaque exception doit etre la plus courte possible : fichier, cle,
justification. Une exception sans justification est un bug, pas une politique.

| Fichier | Element | Justification |
| --- | --- | --- |
| `configuration.yaml` | `bravia_videourl` | URL de description du service web de la TV, non sensible. |
| `configuration.yaml` | `bravia_psk` | Cle de pairing du service web de la TV, non sensitive en soi. |

Ces deux valeurs restent donc **en dur** et le relecteur doit les ignorer.

> L'exception porte sur ces deux cles, pas sur les secrets en general. Tout
> autre secret en clair reste bloquant.

## Dette connue et deja classee

Ces ecarts sont acceptes aujourd'hui. Ils sont listes ici pour que le relecteur
ne les signale pas, et pour qu'ils restent visibles : chacun doit disparaitre un
jour, pas etre eternalise.

| Fichier | Ecart | Commentaire |
| --- | --- | --- |
| `automations/grenier/vmc.yaml` | indentation de sequences melee | Sequences indentees dans la premiere automatisation, non indentees ensuite. A normaliser. |
| `automations/global/heatwave.yaml` | indentation de sequences melee | Idem, deux styles dans le meme fichier. |
| `automations/tech/alarm.yaml` | `description` sur une seule ligne > 160 caracteres | Le retour a la ligne ajouterait des sauts de ligne dans le texte affiche par Home Assistant. |
| `automations/global/misc.yaml` | `description` > 160 caracteres | Idem. |
| `automations/global/lights.yaml` | `description` > 160 caracteres | Idem. |

Ces cinq ecarts sont neutralises par des directives `# yamllint disable` en tete
de fichier, ce qui les rend invisibles a la CI. Une directive `# yamllint disable`
est donc, dans ce depot, un marqueur de dette : elle doit disparaitre avec la
normalisation qu'elle signale.

## Messages attendus de `check_config`

Ces messages ne sont pas des defauts du depot et ne doivent jamais etre
signales comme tels :

- `Automation with alias '...' failed to setup triggers: Unknown device '<id>'`
  Les automatisations a declencheur `device` ne peuvent pas etre resolues dans un
  depot propre : le registre des appareils vit dans `.storage`, sur l'instance
  reelle, et n'est pas versionne. `check_config` retourne 0 malgre tout.
- `The 'purge_interval' option ... is deprecated`
  Avertissement de Home Assistant, a traiter dans la file de migration.

## Tolerance retiree

Une revue a classe « double ouverture des volets par deux automatisations » en
point mineur, au motif que l'effet final etait identique. **C'est retracte.**

Deux automatisations qui visent les memes entites sous des conditions qui se
recouvrent rendent le comportement de la maison indetermine : laquelle gagne ?
La surcouche peut masquer un bug de l'une des deux, empecher une exclusion
prevue, et n'apporte rien de neuf. Une PR qui ajoute la seconde doit soit
remplacer proprement la premiere, soit s'y substituer explicitement. C'est un
conflit fonctionnel, donc bloquant.

## Regles de decision du relecteur

1. Un point est `BLOQUANT` s'il **empeche la configuration de fonctionner**, si
   son absence **changerait le comportement de la maison**, ou s'il **introduit
   un conflit fonctionnel** avec une automatisation existante (meme entite ciblee,
   meme action, conditions qui se recouvrent).
2. Une preference de style, un nom d'alias, une reformulation de description ne
   sont jamais bloquants.
3. En cas de doute, classer en `MINEUR`. Le cout d'un faux positif (une boucle
   de correction qui tourne pour rien) depasse celui d'un faux negatif. Mais un
   conflit fonctionnel **identifie** — une automatisation existante fait deja le
   meme travail sur les memes entites — n'est pas un doute : c'est un defaut
   constate, et il est bloquant.
4. Ne jamais signaler deux fois la meme chose dans deux pull requests
   consecutives sans que le depot ait change.
