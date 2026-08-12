# AGENTS.md – Coding Agent Guidelines for Home Assistant Configurations

> **Entry point.** The full documentation lives in [`docs/`](docs/README.md) and is organized with the Diataxis method. This file keeps only the essential rules an agent must always follow, plus links to the details.

---

## 1. Repository Overview

This repository manages a Home Assistant installation entirely via YAML files. Configuration, automation, scene, script, and template logic all use the standard Home Assistant YAML schemas. There is no Python or Node.js code.

**Language:** All user-facing text (aliases, descriptions) and entity IDs are in **French** (e.g. `lumieres`, `commutateur`, `consommation`).

See [docs/explanation/repository-overview.md](docs/explanation/repository-overview.md) for the full overview.

## 2. Must-Know Rules (Always)

- **French naming** — entity IDs and user-facing text are in French. Entity IDs are strict `snake_case`; smart plugs are `prise_*_commutateur`, power sensors `sensor.prise_*_puissance`.
- **Every automation has 5 fields** — `id`, `alias`, `description`, `trigger`, `condition` (empty `[]` if none), `action`, and ends with an explicit `mode:`.
- **Secrets policy** — never hardcode tokens, keys, URLs, or passwords. Always use `!secret` referencing `secrets.yaml`.
- **Validate after every edit** — run `mise run validate && mise run ha-check`.
- **Verify entities exist** — use `mise run ha-entity-exists -- <entity_id>` before referencing an entity.
- **Defensive templates** — check for `unavailable`/`unknown` states and missing attributes in Jinja2 templates.

## 3. Validate, Lint, and Test

```bash
mise run validate                                      # yamllint strict
mise run ha-check                                      # HA config check (Docker)
mise run ha-entity-exists -- <entity_id>               # verify an entity
mise run ha-entity-list -- <pattern>                   # list matching entities
mise run ha-status                                     # check entity states
mise run ha-logs                                       # stream HA logs
```

Environment setup: copy `mise.local.toml.example` to `mise.local.toml` and add `HASS_TOKEN`.

See [docs/how-to/validate-and-test.md](docs/how-to/validate-and-test.md) for the full toolchain.

## 4. Key Conventions (summary)

| Topic | Rule |
| ----- | ---- |
| Automation IDs | Semantic like `'auto_bureau_prise_agnes_off_when_unused'` (legacy timestamps acceptable) |
| Automation aliases | `"[Category] - [Subcategory] - [Action/Description]"` in French |
| Automation files | `snake_case.yaml` in `automations/<area>/` |
| Blueprints | Use when a pattern appears 2+ times; store custom ones in `blueprints/automation/` (French `dash-case`) |
| Modes | `single` (default), `restart`, `queued`, `parallel` — always set explicitly |
| Migration notes | Add `(Migré le YYYY-MM-DD)` to the automation `description` |

See [docs/reference/yaml-style-guide.md](docs/reference/yaml-style-guide.md) for the complete style guide.

## 5. Documentation Index

- **Tutorials** — [docs/tutorials/getting-started.md](docs/tutorials/getting-started.md)
- **How-to guides**
  - [Validate, lint, and test](docs/how-to/validate-and-test.md)
  - [Write automations](docs/how-to/automation-best-practices.md)
  - [Refactor and review safely](docs/how-to/refactoring-and-safety.md)
  - [Manage secrets](docs/how-to/manage-secrets.md)
- **Explanation**
  - [Repository overview](docs/explanation/repository-overview.md)
  - [EDF Tempo energy tracking](docs/explanation/tempo-energy-tracking.md)
  - [Canicule cover strategy](docs/explanation/canicule-cover-strategy.md)
- **Reference**
  - [YAML & style guide](docs/reference/yaml-style-guide.md)
  - [Integration patterns](docs/reference/integration-patterns.md)
  - [Tooling & editor](docs/reference/tooling.md)
  - [External resources](docs/reference/external-resources.md)

> This file is maintained for all agentic coding support. Keep the summaries here in sync with the detailed pages in `docs/`.
