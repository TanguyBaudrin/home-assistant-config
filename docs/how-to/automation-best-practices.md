# How to Write Home Assistant Automations

This guide describes how automations are written in this repository, from required fields to reusable patterns.

## Required fields — always include all five

Every automation MUST contain:

```yaml
- id: 'unique_id_or_timestamp'
  alias: "Category - Subcategory - Clear description"  # In French
  description: |
    Multi-line detailed description in French.
    Explain triggers, conditions, actions.
    Include migration history if refactored: (Migré le 2026-01-25)
  trigger:
    # ...
  condition: []  # Empty if none, but include the key
  action:
    # ...
  mode: single  # See mode selection below
```

## Choosing a mode

Set `mode:` explicitly at the end of each automation:

- `mode: single` – Default. Ignore new triggers while running. (Most common, use when order doesn't matter)
- `mode: restart` – Cancel current run and start over. (Used in `automations/energy/select_tariffs.yaml`)
- `mode: queued` – Queue up triggers and run sequentially
- `mode: parallel` – Allow multiple simultaneous runs

## Using trigger IDs for complex logic

Use `id:` on triggers to reference them in `choose` conditions (see `automations/tech/alarm.yaml`):

```yaml
trigger:
  - id: trigger_name_1
    platform: state
    entity_id: input_boolean.something
  - id: trigger_name_2
    platform: event
    event_type: mobile_app_notification_action
action:
  - choose:
      - conditions:
          - condition: trigger
            id: trigger_name_1
        sequence:
          # ...
```

## Blueprints vs. raw automations

- **Use blueprints** when the pattern is used 2+ times (e.g., motion lights in multiple rooms).
- Example from `automations/kitchen/lights.yaml`:

  ```yaml
  - id: '1699796906579'
    alias: Cuisine - Lumières - Allumage automatique
    description: Cette automatisation allume la lumière...
    use_blueprint:
      path: homeassistant/motion_light.yaml
      input:
        motion_entity: binary_sensor.motion_sensor_motion_detection
        light_target:
          area_id: cuisine
        no_motion_wait: 900
  ```

- **Custom blueprints:** store them in `blueprints/automation/` with French `dash-case` naming. See the [blueprint conventions](../reference/tooling.md) and [`blueprints/automation/README.md`](../../blueprints/automation/README.md).

## Notifications with user response

For confirmable actions (from `automations/bureau/prise_agnes.yaml`):

```yaml
- service: notify.mobile_app_iphone_tanguy
  data:
    message: "Question?"
    data:
      actions:
        - action: "{{ 'CONFIRM_PLUG_' ~ context.id }}"
          title: "Confirmer"
- wait_for_trigger:
    - platform: event
      event_type: mobile_app_notification_action
      event_data:
        action: "{{ 'CONFIRM_PLUG_' ~ context.id }}"
  timeout:
    minutes: 5
```

## File organization

- Organize automations by **room/functional area**, not by type.
- Current structure: `bureau/`, `chambre_des_parents/`, `energy/`, `garage/`, `global/`, `grenier/`, `kitchen/`, `salon/`, `tech/`.
- Each subdirectory contains related automations (e.g., `bureau/prise_agnes.yaml`, `bureau/prise_tanguy.yaml`).
- **Legacy:** `automations/to_split.yaml` (1489 lines) still needs splitting into the appropriate directories.

## Related

- [How to validate the configuration](validate-and-test.md)
- [YAML style guide reference](../reference/yaml-style-guide.md)
