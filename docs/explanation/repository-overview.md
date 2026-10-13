# About the Repository Overview

This repository manages a Home Assistant installation entirely through YAML files. Configuration, automation, scene, script, and template logic are all specified using the standard Home Assistant YAML schemas. Nearly all automation is declarative; some advanced logic uses Jinja2 templating.

## What this repository is

There is no custom component or package manager here, and no Python or Node.js code. The whole installation is expressed as:

- `configuration.yaml` and its includes (`templates.yaml`, `input_numbers.yaml`, `input_booleans.yaml`, `input_datetime.yaml`, `utility_meters.yaml`, `scripts.yaml`, `scenes.yaml`)
- `automations/` split by room or functional area (`bureau/`, `energy/`, `garage/`, `global/`, `grenier/`, `kitchen/`, `salon/`, `tech/`)
- `blueprints/` for reusable automation patterns

## The language policy

All user-facing text — aliases, descriptions, and entity IDs — is in **French**. Entity IDs use French words like `lumieres`, `commutateur`, and `consommation`. Keep this convention when adding or modifying anything in the repository.

## The audience

This documentation exists for the humans and the coding agents that maintain the configuration. It is organized with the [Diataxis method](https://diataxis.fr/): [tutorials](../tutorials/getting-started.md) teach, [how-to guides](../how-to/validate-and-test.md) direct, [reference](../reference/yaml-style-guide.md) documents facts, and this explanation section provides context and design rationale.

## Further reading

- [EDF Tempo energy tracking](tempo-energy-tracking.md) — how the tariff system works
- [Canicule cover strategy](canicule-cover-strategy.md) — how the heatwave mode protects the house
- [Automation best practices](../how-to/automation-best-practices.md) — how automations are written
