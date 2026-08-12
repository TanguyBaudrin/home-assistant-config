# How to Refactor and Review Safely

## Refactoring workflow

When refactoring or splitting files, always:

1. Validate with `mise run validate && mise run ha-check` after every atomic edit.
2. Be careful about entity or automation duplications; Home Assistant will ignore or all-or-nothing parse on error.
3. Add a comment and a `description:` field explaining any new or changed logic.
4. Include a migration date in the description: `(Migré le YYYY-MM-DD)`.
5. Use version control and commit single-purpose, atomic commits.

## Pitfalls checklist for agents

- [ ] **Verify entity IDs exist** — always use `mise run ha-entity-exists -- <entity_id>` to verify entities exist before using them in automations. Entity naming patterns can vary (e.g., `_puissance` vs `_power`). Alternatively use Developer Tools > States in the HA UI.
- [ ] **Check Home Assistant documentation** — verify trigger/condition/action syntax from the official docs when implementing new patterns.
- [ ] Check entity name uniqueness in all config files before addition.
- [ ] Always update/reload the configuration and check the logs after syntax changes.
- [ ] Avoid including secrets or credentials in discussion, code, or PRs.
- [ ] Verify all automation logic is reachable (triggers are configured correctly and all referenced entities exist).
- [ ] Use French for all aliases, descriptions, and entity IDs.
- [ ] Include all 5 required fields in automations (id, alias, description, trigger, action).
- [ ] Set `mode:` explicitly at the end of each automation.
- [ ] Add entity availability checks in templates (`unavailable`, `unknown`).

## Related

- [How to validate the configuration](validate-and-test.md)
- [How to write automations](automation-best-practices.md)
