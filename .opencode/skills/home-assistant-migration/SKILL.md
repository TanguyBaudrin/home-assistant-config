---
name: migrate-automations
description: Migration automatisée et normalisée des automatisations Home Assistant selon conventions (structure, nommage, documentation). Alias et descriptions en français; fichiers et dossiers en anglais; rapport détaillé de migration inclus.
---

# Home Assistant Automation Migration SKILL (opencode.ai)

## Objectif
Automatiser et fiabiliser la migration des automatisations Home Assistant depuis `automations/to_split.yaml` vers une structure de fichiers organisée par zone (room/area) et par type d'entité, avec conventions de nommage, documentation stricte en français, et validation de leur bon fonctionnement.

### Application
- Pour chaque automatisation à migrer, cette procédure sera suivie strictement.
- RAPPEL : Les nouveaux dossiers/fichiers utilisent les noms anglais (`kitchen`, `garage`, `loft`, `lights.yaml`, etc.), seul le contenu alias/description est 100% français.

## Étapes du process

### 1. Analyse & Attribution de zone
- Détecte la "room" principalement à partir des entités, par exemple :
  - `light.kitchen_*` → `kitchen`, `cover.garage_*` → `garage`, etc.
- Utiliser les zones spéciales si pertinents :
  - `Global` (maison toute entière ou logique système)
  - `Shared` (entre plusieurs rooms)
  - `Tech` (technique/infra, diagnostic, ping...)
  - `Energy` (gestion Tempo EDF, ou scénarios liés énergie)
- S'il y a ambiguïté non résolue, ne migre PAS : signale l'automatisation dans un rapport pour traitement manuel.

### 2. Détection du type ("kind")
- Classe automatiquement selon le domaine principal : `lights.yaml`, `covers.yaml`, `climate.yaml`, `vmc.yaml`, `alarm.yaml`, `energy.yaml`, `notif.yaml`, `misc.yaml` (par défaut si indétectable).
- Noms de fichiers toujours en anglais (un fichier par type/room).

### 3. Destination
- Structure :
  ```
  automations/<room|special>/<kind>.yaml
  ```
  (Créer le fichier s'il n'existe pas, append sinon)

### 4. Génération de l'alias & description
- Format alias :
  `<Pièce ou rubrique> - <Type> - <Phrase concise en français décrivant l’automatisation>`
  - ex : `Cuisine - Lumières - Allumage automatique le matin`
- Champ `description` obligatoire, écrit en français, expliquant succinctement :
  - Le but de l’automatisation
  - Les déclencheurs
  - Les actions principales
  - La date de migration (facultatif)

### 5. Standardisation YAML
- Indentation stricte : 2 espaces
- Block YAML (`|`, `>-`) pour les templates multiline/Jinja2
- Ordre des clés : `id`, `alias`, `description`, `trigger`, `condition`, `action`, `mode`
- Pas de commentaire hérité du YAML source. Zero "legacy comment".
- Uniquement des références `!secret` pour secrets.

### 6. Validation & rapport
- Chaque fichier généré doit passer la validation YAML.
- À chaque migration : compilera
  - Un rapport Markdown (directement dans l’opencode conversation)
  - Rapportera toutes les migrations, les réussites, les automations ambigües/non migrées, et toute anomalie détectée (permet audit et intervention rapide).

---

## EXEMPLES

### Cas courant : Lumières cuisine
**Avant (to_split.yaml) :**
```yaml
- id: '1699796906579'
  alias: Auto - Cuisine - Lumières - Allumer les lumières en cas de mouvement
  description: Cette automatisation allume automatiquement les lumières de la cuisine lorsque le capteur de mouvement détecte une présence et les éteint après 15 minutes d'inactivité, assurant un éclairage adapté à la présence dans cette pièce.
  use_blueprint:
    path: homeassistant/motion_light.yaml
    input:
      motion_entity: binary_sensor.motion_sensor_motion_detection
      light_target:
        area_id: cuisine
      no_motion_wait: 900
```

**Après (kitchen/lights.yaml)**
```yaml
- id: '1699796906579'
  alias: Cuisine - Lumières - Allumage automatique en cas de mouvement
  description: Cette automatisation allume la lumière de la cuisine lors d’une détection de mouvement et l’éteint automatique après 15 minutes d’inactivité pour optimiser le confort et l’économie d’énergie.
  use_blueprint:
    path: homeassistant/motion_light.yaml
    input:
      motion_entity: binary_sensor.motion_sensor_motion_detection
      light_target:
        area_id: cuisine
      no_motion_wait: 900
```

### Cas technique : Gestion de mode alarme (spécial Tech)
**Avant :**
```yaml
- id: '1699818890314'
  alias: Auto - Maison - Arlo - Gestion des modes arlo
  ...
```
**Après (tech/alarm.yaml) :**
```yaml
- id: '1699818890314'
  alias: Tech - Alarme - Gestion dynamique des modes Arlo
  description: Cette automatisation change dynamiquement le mode Arlo selon l’heure, la présence et la position du soleil pour ajuster la sécurité du domicile.
  ...
```


### Cas energy
**Avant :**
```yaml
- id: '1734358965089'
  alias: '[Maison] Changement condition RTE tempo'
  ...
```
**Après (energy/energy.yaml) :**
```yaml
- id: '1734358965089'
  alias: Energy - Tempo - Adaptation des options RTE Tempo
  description: Cette automatisation adapte les options de consommation Tempo selon l’état des contacts EDF et la couleur du jour Tempo pour piloter la consommation énergétique.
  ...
```

### Cas non classifiable (misc)
**Avant :**
```yaml
- id: 'xxxx'
  alias: ???
  ...
```
**Après (garage/misc.yaml ou global/misc.yaml) :**
```yaml
- id: 'xxxx'
  alias: Garage - Divers - ...
  description: (...)
  ...
```


---

## Edge Cases

- **Ambiguïté area/kind :** Ignorer/marque rapport, intervention manuelle requise ensuite.
- **Automatisation non reconnue/non migrable** : listée à part dans le rapport de migration (jamais perdue sans signalement)
- **Fichier destination inexistant** : Toujours créer le fichier, jamais écraser sans merge.
- **Conflit d’ID** : garder ID original, signaler conflit éventuel dans le rapport.


---
## Rapport de migration attendu (format Markdown, affiché conversation)

```
# Rapport de migration

- Automatisations migrées :
    - kitchen/lights.yaml
        - id: 1699796906579 → Ok
    - tech/alarm.yaml
        - id: 1699818890314 → Ok

- Ambiguës/non migrées :
    - id: 12345 — Impossible de détecter la zone, signalé pour action humaine.

- Statistiques générales :
    - 18 automatisations traitées
    - 2 ambiguës/non migrées
    - 0 erreurs de validation YAML
```

---
## Post-Migration
- Les automatismes migrés sont ensuite supprimés de `to_split.yaml` (après validation OK par l’utilisateur)
- Un reload Home Assistant conseillé après toute migration complète.
- Toute validation finale humaine reste requise sur les cas ambigus signalés.

---

**FIN du SKILL**
