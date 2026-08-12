# How to Manage Secrets

## The policy

_Never_ hardcode tokens, keys, URLs, or passwords in YAML. Use `secrets.yaml` with `!secret` everywhere possible.

## What goes in secrets

Examples of values referenced via `!secret` (from [`configuration.yaml`](../../configuration.yaml)):

| Secret | Used for |
| ------ | -------- |
| `bravia_psk` | Sony TV pre-shared key |
| `recorder_db_url` | PostgreSQL connection string |
| `hass_token` | Home Assistant API token (also in `mise.local.toml`) |
| `ssh_command_asustor_shutdown` | SSH command with credentials |

## When onboarding a new integration or helper

1. Reference every sensitive value via `!secret some_key`.
2. Add the corresponding entry to `secrets.yaml`.
3. Instruct other users to update their `secrets.yaml`.

Sensitive shell/environment credentials must be kept in `/config/.ssh/` or similar secured paths.

## Related

- [Tooling reference](../reference/tooling.md)
- [Refactoring and safety](refactoring-and-safety.md)
