# AGENTS.md – Coding Agent Guidelines for Home Assistant Configurations

---

## 1. Repository Overview

This repository manages a Home Assistant installation entirely via YAML files. Configuration, automation, scene, script, and template logic are all specified using the standard Home Assistant YAML schemas. Nearly all automation is declarative; some advanced logic uses Jinja2 templating.

No custom components or package managers are detected. There is no Python or NodeJS code – only YAML and Home Assistant-native configuration. There are also no .cursor, .copilot, or other rule/config files as of this version.

## 2. How to Validate, Lint, and Test the Configuration

### Home Assistant Config Validation
- Use the Home Assistant CLI or the UI to run a configuration check:
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
- For partial YAML validation (ex: automations), use:
    ```bash
    hass --script check_config --files automations/to_split.yaml
    ```

### Linting
- Best: Use `yamllint` locally or via VSCode with a YAML linter extension.
- Recommended `.yamllint` rules:
    - Indent: 2 spaces
    - Key order: alphabetical (where possible)
    - Colons with a space
    - No trailing spaces
    - Block literals for multi-line text
- There is no `prettier` or `eslint` config: preserve human readability and HA compatibility.

## 3. YAML & Code Style Guidelines

### Imports & Includes
- Use `!include`, `!include_dir_merge_list` and `!include_dir_merge_named` for modular YAML (see `configuration.yaml`).
- Organize automations, scripts, and templates into separate files/folders.
- Use clear, consistent file/dir names (ie: `automations/`, `scripts.yaml`, `templates.yaml`).
- Do not duplicate entity definitions.

### Formatting
- 2-space indentation everywhere, no tabs.
- Sort entity keys and fields logically for readability (ie: id, alias, description, trigger, condition, action, mode).
- Prefer block (`|` or `>-`) YAML style for multi-line Jinja2 templates. Always try to wrap at 100 characters.
- Always comment non-obvious logic (use `#` for short comments above blocks, avoid inline unless needed).
- Document each automation/script with an `alias:` and a `description:` field.

### Naming Conventions
- Entities: `snake_case` (ex: `input_boolean.lumieres_automatiques`)
- Boolean helpers: `input_boolean.*`, scenes: `scene.*`, scripts: `script.*`, sensors: `sensor.*`, etc.
- Use verbose `alias:` (for display/UI), but reference internal entities by exact name.
- Constants (templates, field names): `SCREAMING_SNAKE_CASE` only in macros, never entity IDs.

### Templates & Typing
- Write robust Jinja2 templates: always check for attributes and handle missing states.
- Use `is defined`, `default` and test types (`is_number`, `is_string`) where ambiguity is possible.
- Avoid using magic values; use helpers/entities for magic numbers where possible, or document them.

### Error Handling
- Defensive templates: check that all entities/attributes used are available, e.g., `{% if value_json is defined %}`.
- Use `logger` integration (`logger:` in YAML) to adjust logging. Prefer `error` for default, use `warning` during active troubleshooting.
- Use `persistent_notification`, `logbook`, or notification services for critical faults or unexpected states.

## 4. Sensitive Data Policy
- _Never_ hardcode tokens, keys, URLs, or passwords in YAML. Use secrets.yaml with `!secret` everywhere possible.
- When onboarding a new integration or helper, always reference sensitive values via `!secret some_key` and instruct users to update `secrets.yaml`.
- Sensitive shell/environment credentials must be kept in `/config/.ssh/` or similar secured paths.

## 5. Automation & Script Best Practices
- Compose large automations as multiple smaller, focused automations/scripts if logic is complex.
- Use blueprints for shareable or parameterized logic.
- Assign 
   - `id:` – unique string or UUID for each automation.
   - `alias:` – human-friendly name, describe the behavior/action.
   - `description:` – short explanation for maintainers/agents; always fill out.
- Always document the intent of complex triggers, conditions, or actions.
- Prefer explicit over implicit logic. (E.g., set `mode:` at bottom: use `single`/`queued`/`restart` according to concurrency needs.)

## 6. Refactoring, Review, and Safety
- When refactoring or splitting files, always:
    - Validate with `hass --script check_config` after every atomic edit.
    - Be careful about entity or automation duplications; Home Assistant will ignore or all-or-nothing parse on error.
    - Add a comment and `description:` field explaining any new or changed logic.
    - Use version control and commit single-purpose, atomic commits.

### Pitfalls Checklist For Agents
- [ ] Check entity name uniqueness in all config files before addition.
- [ ] Always update/reload configuration and check the logs after syntax changes.
- [ ] Avoid including secrets or credentials in discussion, code, or PRs.
- [ ] Verify all automation logic is reachable (triggers are configured correctly and all referenced entities exist).

## 7. Editor/Tooling Conventions
- Use VSCode + Home Assistant extension for YAML syntax/context help.
- No .cursor or Copilot/manual extension rules are present in this repo as of this revision.
- If adding test tooling, docs, or CI, document it here and add appropriate rule files in .github/ or root.

## 8. Useful References
- [Home Assistant YAML Style Guide (official)](https://www.home-assistant.io/docs/configuration/yaml_style_guide/)
- [Automations and Templates](https://www.home-assistant.io/docs/automation/)
- [Jinja2 Templating Tips](https://www.home-assistant.io/docs/configuration/templating/)
- [Yamllint rules reference](https://yamllint.readthedocs.io/en/stable/rules.html)
- [hass-cli tool](https://github.com/home-assistant-ecosystem/command_line)

---

> This file is maintained for all agentic coding support. Update it after any rule, tooling, or repo structure change!
