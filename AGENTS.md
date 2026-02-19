# AGENTS.md – Coding Agent Guidelines for Home Assistant Configurations

---

## 1. Repository Overview

This repository manages a Home Assistant installation entirely via YAML files. Configuration, automation, scene, script, and template logic are all specified using the standard Home Assistant YAML schemas. Nearly all automation is declarative; some advanced logic uses Jinja2 templating.

**Language:** All user-facing text (aliases, descriptions) and entity IDs are in **French**. Entity IDs use French words like `lumieres`, `commutateur`, `consommation`.

No custom components or package managers are detected. There is no Python or NodeJS code – only YAML and Home Assistant-native configuration.

## 2. How to Validate, Lint, and Test the Configuration

### Recommended: Use Mise Tasks

The repository uses [mise.toml](mise.toml) for task automation:

**First time setup:**
```bash
# Install all required tools (run this first)
mise install
```

**Available tasks:**
```bash
# Validate YAML syntax (strict mode)
mise run validate

# Check HA configuration (Docker-based, doesn't require running instance)
mise run ha-check

# Get HA instance info (requires HASS_TOKEN in mise.local.toml)
mise run ha-info

# Check entity states
mise run ha-status

# Stream HA logs
mise run ha-logs

# Check if a specific entity exists (usage: mise run ha-entity-exists -- <entity_id>)
mise run ha-entity-exists -- sensor.prise_bureau_agnes_puissance

# List all entities matching a pattern (usage: mise run ha-entity-list -- <pattern>)
mise run ha-entity-list -- prise_bureau
```

**Environment Setup:** Copy [mise.local.toml.example](mise.local.toml.example) to `mise.local.toml` and add your `HASS_TOKEN`.

### Traditional Methods

- Via HA CLI (in the config directory):

  ```bash
  hass --script check_config
  ```

- Via Home Assistant UI: Configuration → Server Controls → Check Configuration.

### Automation/Template Testing

- Use Developer Tools > Template to interactively validate Jinja2 templates.
- To test a single automation/script, trigger it from Developer Tools > Services or use:

    ```bash
    ha core reload # to reload
    ```

### Linting

- Run `yamllint --strict .` (configured via mise)
- Recommended settings:
  - Indent: 2 spaces
  - Colons with a space
  - No trailing spaces
  - Block literals (`|` or `>-`) for multi-line text

## 3. YAML & Code Style Guidelines

### Imports & Includes

- Use `!include`, `!include_dir_merge_list` and `!include_dir_merge_named` for modular YAML (see [configuration.yaml](configuration.yaml)).
- Example from [configuration.yaml](configuration.yaml):

  ```yaml
  automation: !include_dir_merge_list automations/
  script: !include scripts.yaml
  template: !include templates.yaml
  input_number: !include input_numbers.yaml
  ```

- Organize automations by **room/functional area** in subdirectories:
  - `automations/bureau/` (office), `automations/energy/`, `automations/garage/`
  - `automations/global/` (house-wide), `automations/kitchen/`, `automations/tech/`
- Do not duplicate entity definitions.

### Formatting

- 2-space indentation everywhere, no tabs.
- Sort entity keys and fields logically for readability (ie: id, alias, description, trigger, condition, action, mode).
- Prefer block (`|` or `>-`) YAML style for multi-line Jinja2 templates. Always try to wrap at 100 characters.
- Always comment non-obvious logic (use `#` for short comments above blocks, avoid inline unless needed).

### Naming Conventions

**Entity IDs:** Strict `snake_case` in **French**

- Examples: `input_boolean.lumieres_automatiques`, `switch.prise_bureau_agnes_commutateur`
- Smart plugs: `prise_*_commutateur`
- Power sensors: `sensor.prise_*_puissance` or `sensor.prise_*_power`
- Input helpers: `tarif_edf_*`, `heure_de_*`

**Automation IDs:**

- New automations: Use semantic IDs like `'auto_bureau_prise_agnes_off_when_unused'`
- Legacy: Timestamps like `'1699817277063'` (acceptable but prefer semantic)

**Automation Aliases:** Use structured format in **French**

```text
[Category] - [Subcategory] - [Action/Description]
```

Examples:

- `"Global - Lumières - Activation/désactivation centralisée"`
- `"Bureau - Prise Agnès - Extinction automatique quand non utilisée"`
- `"Energy - Tempo Rouge - Séquence d'allumage serveurs"`

**File Naming:**

- Automation files: `snake_case.yaml` by function (e.g., `select_tariffs.yaml`, `lights.yaml`)
- Blueprint files: Keep original author's naming (`dash-case` for custom blueprints in French)

### Templates & Typing

- Write robust Jinja2 templates: always check for attributes and handle missing states.
- Use `is defined`, `default` and test types (`is_number`, `is_string`) where ambiguity is possible.
- Avoid using magic values; use helpers/entities for magic numbers where possible, or document them.

**Defensive Templating Pattern** (from [templates.yaml](templates.yaml)):

```yaml
availability: >
  {{ not 'unavailable' in [states('sensor.entity1'), states('sensor.entity2')] 
     and not 'unknown' in [states('sensor.entity1'), states('sensor.entity2')] }}
state: >
  {% if is_state('sensor.entity', 'value') %}
    {{ states('input_number.helper') | float | round(4) }}
  {% endif %}
```

**Variables in Actions** (from [automations/bureau/prise_agnes.yaml](automations/bureau/prise_agnes.yaml)):

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

**Wait Templates with Timeout** (from [automations/energy/tempo_rouge_power_on.yaml](automations/energy/tempo_rouge_power_on.yaml)):

```yaml
- wait_template: >
    {{ is_state('sensor.borne_du_bureau_state', 'Connected') or
       is_state('sensor.borne_du_salon_state', 'Connected') }}
  continue_on_timeout: false
  timeout:
    minutes: 10
```

### Error Handling

- Defensive templates: check that all entities/attributes used are available.
- Use `logger` integration (`logger:` in YAML) to adjust logging. Prefer `error` for default, use `warning` during active troubleshooting.
- Use `persistent_notification`, `logbook`, or notification services for critical faults or unexpected states.

## 4. Sensitive Data Policy

- _Never_ hardcode tokens, keys, URLs, or passwords in YAML. Use `secrets.yaml` with `!secret` everywhere possible.
- Examples of what goes in secrets (from [configuration.yaml](configuration.yaml)):
  - `!secret bravia_psk` – Sony TV pre-shared key
  - `!secret recorder_db_url` – PostgreSQL connection string
  - `!secret hass_token` – Home Assistant API token (also in `mise.local.toml`)
  - `!secret ssh_command_asustor_shutdown` – SSH command with credentials
- When onboarding a new integration or helper, always reference sensitive values via `!secret some_key` and instruct users to update `secrets.yaml`.
- Sensitive shell/environment credentials must be kept in `/config/.ssh/` or similar secured paths.

## 5. Automation & Script Best Practices

### Required Fields - Always Include All Five

Every automation MUST contain (example from [automations/global/lights.yaml](automations/global/lights.yaml)):

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

### Mode Selection

Set `mode:` explicitly at the end of each automation:

- `mode: single` – Default. Ignore new triggers while running. (Most common, use when order doesn't matter)
- `mode: restart` – Cancel current run and start over. (Used in [automations/energy/select_tariffs.yaml](automations/energy/select_tariffs.yaml))
- `mode: queued` – Queue up triggers and run sequentially
- `mode: parallel` – Allow multiple simultaneous runs

### Trigger IDs for Complex Logic

Use `id:` on triggers to reference them in `choose` conditions (from [automations/tech/alarm.yaml](automations/tech/alarm.yaml)):

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

### Blueprints vs. Raw Automations

- **Use blueprints** when the pattern is used 2+ times (e.g., motion lights in multiple rooms)
- Example from [automations/kitchen/lights.yaml](automations/kitchen/lights.yaml):

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

- **Custom blueprints:** Store in `blueprints/automation/` with French `dash-case` naming
- See [blueprints/automation/README.md](blueprints/automation/README.md) for blueprint conventions

### Notification Patterns with User Response

For confirmable actions (from [automations/bureau/prise_agnes.yaml](automations/bureau/prise_agnes.yaml)):

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

### File Organization Strategy

- Organize automations by **room/functional area**, not by type
- Current structure: `bureau/`, `energy/`, `garage/`, `global/`, `kitchen/`, `tech/`
- Each subdirectory contains related automations (e.g., `bureau/prise_agnes.yaml`, `bureau/prise_tanguy.yaml`)
- **Legacy:** [automations/to_split.yaml](automations/to_split.yaml) (2277 lines) needs splitting into appropriate directories

## 6. Integration-Specific Patterns

### RFLink (RF433MHz Devices)

- Serial port: `/dev/serial/by-id/usb-Arduino_...`
- Device types: Chacon plugs (`newkaku_*`), RTS covers, RF switches
- See [configuration.yaml](configuration.yaml) for light platform configuration

### ZHA (Zigbee)

- Device-specific configs with MAC addresses for buttons, switches, lights
- See [configuration.yaml](configuration.yaml) for device_config examples

### Arlo Cameras

- Separate config file: [aarlo.yaml](aarlo.yaml)
- Uses SSE backend

### Utility Meters (EDF Tempo Energy Tracking)

- All meters use same 6 tariffs: `bleu_hc`, `bleu_hp`, `blanc_hc`, `blanc_hp`, `rouge_hc`, `rouge_hp`
- Consistent structure in [utility_meters.yaml](utility_meters.yaml)
- Input helpers for prices in [input_numbers.yaml](input_numbers.yaml)
- Tariff selection automated via [automations/energy/select_tariffs.yaml](automations/energy/select_tariffs.yaml)

## 7. Refactoring, Review, and Safety

- When refactoring or splitting files, always:
  - Validate with `mise run validate && mise run ha-check` after every atomic edit.
  - Be careful about entity or automation duplications; Home Assistant will ignore or all-or-nothing parse on error.
  - Add a comment and `description:` field explaining any new or changed logic.
  - Include migration date in description: `(Migré le YYYY-MM-DD)`
  - Use version control and commit single-purpose, atomic commits.

### Pitfalls Checklist For Agents

- [ ] **Verify entity IDs exist** - Always use `mise run ha-entity-exists -- <entity_id>` to verify entities exist before using them in automations. Entity naming patterns can vary (e.g., `_puissance` vs `_power`). Alternatively use Developer Tools > States in the HA UI.
- [ ] **Check Home Assistant documentation** - Verify trigger/condition/action syntax from official docs when implementing new patterns.
- [ ] Check entity name uniqueness in all config files before addition.
- [ ] Always update/reload configuration and check the logs after syntax changes.
- [ ] Avoid including secrets or credentials in discussion, code, or PRs.
- [ ] Verify all automation logic is reachable (triggers are configured correctly and all referenced entities exist).
- [ ] Use French for all aliases, descriptions, and entity IDs.
- [ ] Include all 5 required fields in automations (id, alias, description, trigger, action).
- [ ] Set `mode:` explicitly at the end of each automation.
- [ ] Add entity availability checks in templates (`unavailable`, `unknown`).

## 8. Editor/Tooling Conventions

- Use VSCode + Home Assistant extension for YAML syntax/context help.
- Install mise for task automation: `brew install mise` (macOS) or see <https://mise.jdx.dev>
- Tools managed by mise (auto-installed):
  - `yamllint` - YAML linting
  - `homeassistant-cli` (via pipx) - HA instance control
  - `pre-commit` - Git hooks (if configured)
- No .cursor or Copilot/manual extension rules are present in this repo as of this revision.
- If adding test tooling, docs, or CI, document it here and add appropriate rule files in .github/ or root.

## 9. Useful References

- [Home Assistant YAML Style Guide (official)](https://www.home-assistant.io/docs/configuration/yaml_style_guide/)
- [Automations and Templates](https://www.home-assistant.io/docs/automation/)
- [Jinja2 Templating Tips](https://www.home-assistant.io/docs/configuration/templating/)
- [Yamllint rules reference](https://yamllint.readthedocs.io/en/stable/rules.html)
- [hass-cli tool](https://github.com/home-assistant-ecosystem/command_line)

---

> This file is maintained for all agentic coding support. Update it after any rule, tooling, or repo structure change!
