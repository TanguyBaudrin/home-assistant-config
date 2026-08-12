# Tooling & Editor Conventions Reference

## Editor

- Use VSCode with the Home Assistant extension for YAML syntax and context help.

## Mise

Install `mise` for task automation: `brew install mise` (macOS) or see <https://mise.jdx.dev>.

Tools managed by mise (auto-installed):

- `yamllint` — YAML linting
- `homeassistant-cli` (via pipx) — HA instance control
- `pre-commit` — Git hooks (if configured)

See [How to validate, lint, and test](../how-to/validate-and-test.md) for the full task list.

## Extensions & rules

- No `.cursor` or Copilot/manual extension rules are present in this repo as of this revision.
- If you add test tooling, docs, or CI, document it here and add appropriate rule files in `.github/` or the repo root.

## Blueprints

- Custom blueprints live in `blueprints/automation/` with French `dash-case` naming.
- See [`blueprints/automation/README.md`](../../blueprints/automation/README.md) for the blueprint conventions.

## Related

- [YAML & style guide](yaml-style-guide.md)
- [How to manage secrets](../how-to/manage-secrets.md)
