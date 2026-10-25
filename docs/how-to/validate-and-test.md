# How to Validate, Lint, and Test the Configuration

## Recommended: use mise tasks

The repository uses [`mise.toml`](../../mise.toml) for task automation.

**First time setup** — install all required tools:

```bash
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

**Environment setup:** copy [`mise.local.toml.example`](../../mise.local.toml.example) to `mise.local.toml` and add your `HASS_TOKEN`.

> Note: `mise run ha-check` ne passe pas `-it` au conteneur Docker, car la
> commande doit fonctionner aussi bien en interactif qu'en CI (où aucun TTY
> n'est disponible).

## Traditional methods

- Via the HA CLI (in the config directory):

  ```bash
  hass --script check_config
  ```

- Via the Home Assistant UI: Configuration → Server Controls → Check Configuration.

## Testing automations and templates

- Use **Developer Tools > Template** to interactively validate Jinja2 templates.
- To test a single automation or script, trigger it from Developer Tools > Services, or reload with:

  ```bash
  ha core reload
  ```

## Linting

- Run `yamllint --strict .` (configured via mise).
- Recommended settings:
  - Indent: 2 spaces
  - Colons with a space
  - No trailing spaces
  - Block literals (`|` or `>-`) for multi-line text

## Related

- [Automation best practices](automation-best-practices.md)
- [Refactoring and safety](refactoring-and-safety.md)
