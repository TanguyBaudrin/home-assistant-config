# YAML & Style Guide Reference

## Imports & includes

- Use `!include`, `!include_dir_merge_list` and `!include_dir_merge_named` for modular YAML (see [`configuration.yaml`](../../configuration.yaml)).
- Example:

  ```yaml
  automation: !include_dir_merge_list automations/
  script: !include scripts.yaml
  template: !include templates.yaml
  input_number: !include input_numbers.yaml
  ```

- Organize automations by **room/functional area** in subdirectories:
  - `automations/bureau/` (office), `automations/energy/`, `automations/garage/`
  - `automations/global/` (house-wide), `automations/grenier/`, `automations/kitchen/`, `automations/salon/`, `automations/tech/`
- Do not duplicate entity definitions.

## Formatting

- 2-space indentation everywhere, no tabs.
- Sort entity keys and fields logically for readability (i.e. `id`, `alias`, `description`, `trigger`, `condition`, `action`, `mode`).
- Prefer block (`|` or `>-`) YAML style for multi-line Jinja2 templates. Always try to wrap at 100 characters.
- Always comment non-obvious logic (use `#` for short comments above blocks, avoid inline unless needed).

## Naming conventions

### Entity IDs

Strict `snake_case` in **French**:

- Examples: `input_boolean.lumieres_automatiques`, `switch.prise_bureau_agnes_commutateur`
- Smart plugs: `prise_*_commutateur`
- Power sensors: `sensor.prise_*_puissance` or `sensor.prise_*_power`
- Input helpers: `tarif_edf_*`, `heure_de_*`

### Automation IDs

- New automations: use semantic IDs like `'auto_bureau_prise_agnes_off_when_unused'`
- Legacy: timestamps like `'1699817277063'` (acceptable but prefer semantic)

### Automation aliases

Use the structured format in **French**:

```text
[Category] - [Subcategory] - [Action/Description]
```

Examples:

- `"Global - Lumières - Activation/désactivation centralisée"`
- `"Bureau - Prise Agnès - Extinction automatique quand non utilisée"`
- `"Energy - Tempo Rouge - Séquence d'allumage serveurs"`

### File naming

- Automation files: `snake_case.yaml` by function (e.g., `select_tariffs.yaml`, `lights.yaml`)
- Blueprint files: keep the original author's naming (`dash-case` for custom blueprints in French)

## Templates & typing

- Write robust Jinja2 templates: always check for attributes and handle missing states.
- Use `is defined`, `default` and type tests (`is_number`, `is_string`) where ambiguity is possible.
- Avoid magic values; use helpers/entities for magic numbers where possible, or document them.

### Defensive templating pattern (from `templates.yaml`)

```yaml
availability: >
  {{ not 'unavailable' in [states('sensor.entity1'), states('sensor.entity2')]
     and not 'unknown' in [states('sensor.entity1'), states('sensor.entity2')] }}
state: >
  {% if is_state('sensor.entity', 'value') %}
    {{ states('input_number.helper') | float | round(4) }}
  {% endif %}
```

### Variables in actions (from `automations/bureau/prise_agnes.yaml`)

```yaml
action:
  - variables:
      current_power: >-
        {% if power not in ['unknown', 'unavailable', None] %}
          {{ power | float(999) }}
        {% endif %}
  - choose:
      - conditions:
          - condition: template
            value_template: "{{ current_power > 180 }}"
```

### Wait templates with timeout (from `automations/energy/tempo_rouge_power_on.yaml`)

```yaml
- wait_template: >
    {{ is_state('sensor.borne_du_bureau_state', 'Connected') or
       is_state('sensor.borne_du_salon_state', 'Connected') }}
  continue_on_timeout: false
  timeout:
    minutes: 10
```

## Error handling

- Defensive templates: check that all entities/attributes used are available.
- Use the `logger` integration (`logger:` in YAML) to adjust logging. Prefer `error` for default, use `warning` during active troubleshooting.
- Use `persistent_notification`, `logbook`, or notification services for critical faults or unexpected states.

## Related

- [Tooling reference](tooling.md)
- [How to write automations](../how-to/automation-best-practices.md)
