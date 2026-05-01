# Plan: Update UV Index Automation for Kitchen Window Check

## Objective
Modify the UV index automation to check if the kitchen window is open before closing the kitchen cover (`cover.cuisine`). If the window is open, wait for it to close before closing the cover.

## File to Modify
- `automations/to_split.yaml` (lines 1765-1820)

## Current Automation
- **ID**: `'1751181585095'`
- **Alias**: `Global - météo - Changement dans l'indice UV`
- **Triggers**: UV index changes from moderate→high (id: `high_uv`) or moderate→low (id: `low_uv`)
- **Current high_uv action**: Notify + close `cover.salle_a_manger_petit` and `cover.cuisine` together

## Kitchen Window Sensor
- **Entity**: `binary_sensor.capteur_de_fenetre_open`
- **Location**: Cuisine area
- **States**: `'on'` = window open, `'off'` = window closed

## Proposed Changes

### Modified `high_uv` sequence:
1. Send notification (unchanged)
2. Close `cover.salle_a_manger_petit` immediately (independent of window state)
3. Check `binary_sensor.capteur_de_fenetre` state:
   - If `'off'` (closed): Close `cover.cuisine` immediately
   - If `'on'` (open): Wait for window to close using `wait_for_trigger` with 10 minute timeout, then close `cover.cuisine`

### Implementation Approach
Use a `choose` block after closing salle_a_manger_petit:
- First choice: Window is closed → close cover.cuisine
- Second choice: Window is open → wait_for_trigger + close cover.cuisine

### Modified YAML Structure
```yaml
- id: '1751181585095'
  alias: Global - météo - Changement dans l'indice UV
  description: |
    Ferme les volets du 1er étage quand l'indice UV passe de modéré à haut.
    Vérifie si la fenêtre de la cuisine est fermée avant de fermer le volet cuisine.
    (Migré le 2026-05-01)
  triggers:
    - trigger: state
      entity_id:
        - sensor.openuv_niveau_uv_actuel
      from: moderate
      to: high
      id: high_uv
    - trigger: state
      entity_id:
        - sensor.openuv_niveau_uv_actuel
      from: moderate
      to: low
      id: low_uv
  conditions: []
  actions:
    - choose:
        - conditions:
            - condition: trigger
              id:
                - high_uv
          sequence:
            - action: notify.mobile_app_iphone_pro_de_tanguy
              metadata: {}
              data:
                title: Indice UV haut !
                message: 'Attention indice uv important penser à ce protéger '
            - action: cover.close_cover
              metadata: {}
              data: {}
              target:
                entity_id: cover.salle_a_manger_petit
            - choose:
                - conditions:
                    - condition: state
                      entity_id: binary_sensor.capteur_de_fenetre_open
                      state: 'off'
                  sequence:
                    - action: cover.close_cover
                      metadata: {}
                      data: {}
                      target:
                        entity_id: cover.cuisine
                - conditions:
                    - condition: state
                      entity_id: binary_sensor.capteur_de_fenetre_open
                      state: 'on'
                  sequence:
                    - wait_for_trigger:
                        - platform: state
                          entity_id: binary_sensor.capteur_de_fenetre_open
                          to: 'off'
                      timeout:
                        minutes: 10
                      continue_on_timeout: false
                    - action: cover.close_cover
                      metadata: {}
                      data: {}
                      target:
                        entity_id: cover.cuisine
        - conditions:
            - condition: trigger
              id:
                - low_uv
          sequence:
            - action: notify.mobile_app_iphone_pro_de_tanguy
              metadata: {}
              data:
                title: Indice UV bas !
                message: Indice UV réduit
            - action: cover.open_cover
              metadata: {}
              data: {}
              target:
                floor_id: 1er_etage
                entity_id:
                  - cover.salle_a_manger_petit
                  - cover.cuisine
  mode: single
```

## Verification
1. Run `mise run validate` to check YAML syntax
2. Run `mise run ha-check` to validate Home Assistant configuration
3. Test by changing `sensor.openuv_niveau_uv_actuel` state manually in HA developer tools
4. Verify `binary_sensor.capteur_de_fenetre` state is checked before closing `cover.cuisine`
