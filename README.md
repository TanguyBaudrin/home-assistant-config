# Home Assistant Configuration

YAML-based configuration for a personal Home Assistant installation, managed entirely through configuration files and version control.

## What this repository contains

- **Configuration** — `configuration.yaml` and its modular includes (`templates.yaml`, `input_numbers.yaml`, `input_booleans.yaml`, `input_datetime.yaml`, `utility_meters.yaml`, `scripts.yaml`, `scenes.yaml`)
- **Automations** — split by room or functional area under `automations/` (`bureau/`, `energy/`, `garage/`, `global/`, `kitchen/`, `tech/`)
- **Blueprints** — reusable automation patterns under `blueprints/`

All user-facing text (aliases, descriptions) and entity IDs are in **French**.

## Documentation

The repository documentation follows the [Diataxis](https://diataxis.fr/) method:

- [Tutorials](docs/tutorials/getting-started.md) — learn by doing
- [How-to guides](docs/how-to/validate-and-test.md) — accomplish specific tasks
- [Explanation](docs/explanation/repository-overview.md) — understand the design
- [Reference](docs/reference/yaml-style-guide.md) — look up the rules

Agents and contributors should start with [`AGENTS.md`](AGENTS.md), which summarizes the essential rules and points to the detailed documentation.

## Getting started

1. Install `mise` and the project tools: `mise install`
2. Copy `mise.local.toml.example` to `mise.local.toml` and add your `HASS_TOKEN`
3. Validate the configuration: `mise run validate` and `mise run ha-check`
