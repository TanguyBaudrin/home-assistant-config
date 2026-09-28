# Tooling & Editor Conventions Reference

## Editor

- Use VSCode with the Home Assistant extension for YAML syntax and context help.

## Mise

Install `mise` for task automation: `brew install mise` (macOS) or see <https://mise.jdx.dev>.

Tools managed by mise, pinned in `mise.toml`:

- `yamllint` 1.38.0 — YAML linting
- `homeassistant-cli` 1.0.0 (via pipx) — HA instance control
- `pre-commit` — Git hooks
- `uv` 0.12.10 — the backend that installs the Python tools above

`uv` is pinned in the repository rather than globally. A global-only pin makes
`mise run validate` fail with `No version is set for shim: uv` on any machine
that has not set a default, which is the most common setup failure here.

First run in a new clone:

```bash
mise trust          # required once per machine, or mise ignores mise.toml
mise run ci         # yamllint + Home Assistant check_config
```

`mise run ci` genuinely runs both checks. A `depends` entry runs its
dependencies before the task body, so the sub-second "All CI checks passed"
line at the end is not the whole job.

See [How to validate, lint, and test](../how-to/validate-and-test.md) for the full task list.

## Extensions & rules

- No `.cursor` or Copilot/manual extension rules are present in this repo as of this revision.
- If you add test tooling, docs, or CI, document it here and add appropriate rule files in `.github/` or the repo root.

## CI

Two GitHub Actions run on `ubuntu-latest` for every push and pull request:

- **CI** (`.github/workflows/ci.yml`) — yamllint `--strict`, plus JSON validity
  for `opencode.json` and the devcontainer config.
- **HA Check** (`.github/workflows/ha-check.yml`) — runs `check_config` inside
  `ghcr.io/home-assistant/home-assistant:2026.9.4` (pinned, not `latest`),
  with dummy secrets and CI-only integration stubs mounted read-only.

Expected output, not a failure: `check_config` reports
`Unknown device '<id>'` because device registries live in `.storage/`, which is
not versioned. The job still exits 0. The `purge_interval` deprecation warning
in `configuration.yaml` is tracked in the migration queue.

Integration stubs in `.ci/custom_components/` exist so validation does not fail
on `rflink`, `battery_notes` and `circadian_lighting`. They declare an empty
root schema with `ALLOW_EXTRA`: declaring top-level keys such as `switch` or
`cover` collides with Home Assistant's own platform registries and breaks
loading. They are stubs, not reimplementations.

## Agent factory

`.github/workflows/` also contains an agent factory. It opens and updates pull
requests and **never merges anything**: a human merges, always.

| Workflow | Trigger | Runner | What it does |
| --- | --- | --- | --- |
| `factory-review.yml` | `pull_request` | self-hosted | Read-only review, posts a verdict |
| `factory-fix.yml` | label `factory/needs-fix` | self-hosted | Applies the blocking fixes, pushes to the PR branch |
| `factory-build.yml` | label `factory/build` on an issue | self-hosted | Turns a triaged issue into a pull request |
| `factory-migrate.yml` | nightly 03:17 UTC | self-hosted | Migrates one legacy automation per night |
| `factory-docs.yml` | weekly, Sunday 04:23 UTC | self-hosted | Documentation refresh, only if config changed |

Agents are defined in `.opencode/agents/`, prompts in `.github/prompts/`, and
the accepted-deviation policy in `factory/policy.md`.

### Security model

The self-hosted runner inherits `HASS_TOKEN`, which controls the house, and
`OMNIROUTER_*`. Two rules follow:

- **Agent jobs refuse fork pull requests.** `factory-review.yml` and
  `factory-fix.yml` check `head.repo.full_name == github.repository`. Forks get
  the inert CI only. The scheduled jobs cannot be triggered by a fork.
- **Issue and PR text is data, not instruction.** The reviewer agent has no
  write or bash permission, so a malicious pull request cannot drive it. The
  writing agents additionally cannot touch `secrets.yaml`, `.github/`,
  `.opencode/`, `factory/`, `mise.toml` or the devcontainer, and both
  `factory-build.yml` and `factory-docs.yml` re-check that file scope before
  pushing. Triggering the build job requires a maintainer to apply a label.

Secrets come from `/etc/ha-factory/runner.env` via systemd `EnvironmentFile=`
on the runner, not from GitHub secrets. Only `GITHUB_TOKEN` is passed through.

### Why the reviewer uses the action and the fixer uses the CLI

`anomalyco/opencode/github` ignores its `agent` input — the published CLI never
reads that variable — and `default_agent` is a single global value. A read-only
reviewer and a writing fixer therefore need two separate invocations: the action
for the reviewer, `opencode run --agent factory-fix` for the fixer. The action's
composite step installs the latest CLI at run time, so pinning the action alone
does not pin the CLI.

### Cost and retry bounds

- The review/fix loop is bounded: `factory-fix` increments
  `factory/attempt-N`, and the reviewer stops labelling after 2 attempts and
  adds `factory/escalade` instead.
- Migration is bounded by `max_attempts` in `factory/queue.yaml`, and an entry
  with an open pull request is never selected again.
- Per-PR concurrency uses `cancel-in-progress: true`; a new push supersedes an
  in-flight review.

### Local checks before trusting a workflow change

Workflow YAML is easy to get syntactically valid and still wrong. Two lints
catch the common failure classes, both re-runnable locally:

```bash
# every github-script block is valid JS under github-script's async wrapper,
# and every process.env.X it reads is actually declared on the step
python3 - <<'EOF'
import pathlib, yaml, re, subprocess, tempfile, os
for w in sorted(pathlib.Path('.github/workflows').glob('*.yml')):
    d = yaml.safe_load(w.read_text()); wf_env = set((d.get('env') or {}).keys())
    for j in (d.get('jobs') or {}).values():
        for st in j.get('steps', []):
            s = (st.get('with') or {}).get('script')
            if not s: continue
            src = s.replace('${{', '${A_').replace('}}', '}')
            missing = set(re.findall(r'process\.env\.([A-Z_]+)', s)) \
                - set((st.get('env') or {}).keys()) - wf_env
            with tempfile.NamedTemporaryFile('w', suffix='.cjs', delete=False) as f:
                f.write("(async () => {\n" + src + "\n})();"); p = f.name
            r = subprocess.run(['node', '--check', p], capture_output=True, text=True)
            os.unlink(p)
            if r.returncode: print('JS FAIL', w.name, st.get('name'))
            if missing: print('ENV FAIL', w.name, st.get('name'), sorted(missing))
EOF

# the migration queue selection logic
node .github/scripts/queue.test.cjs
```

`queue.cjs` is a standalone module with no dependencies specifically so its
logic can be unit-tested; a pull request must not be able to install packages
to influence which backlog entry gets migrated.

`docker` is a mise shim on this machine. If `mise run ha-check` fails with a
`mise` error rather than a Home Assistant error, re-run `mise trust` — editing
`mise.toml` revokes the trust.

## Blueprints

- Custom blueprints live in `blueprints/automation/` with French `dash-case` naming.
- See [`blueprints/automation/README.md`](../../blueprints/automation/README.md) for the blueprint conventions.

## Related

- [YAML & style guide](yaml-style-guide.md)
- [How to manage secrets](../how-to/manage-secrets.md)
