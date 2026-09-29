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
| `factory-spec.yml` | `issues: opened`, or a human comment | self-hosted | Drafts an implementation plan as an issue comment |
| `factory-review.yml` | `pull_request` | self-hosted | Read-only review, posts a verdict |
| `factory-fix.yml` | label `factory/needs-fix` | self-hosted | Applies the blocking fixes, pushes to the PR branch |
| `factory-build.yml` | label `to-implement` on an issue | self-hosted | Turns a validated plan into a pull request |
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
- **Issue and PR text is data, not instruction.** The reviewer and spec agents
  have no write or bash permission, so a malicious issue or pull request cannot
  drive them. The
  writing agents additionally cannot touch `secrets.yaml`, `.github/`,
  `.opencode/`, `factory/`, `mise.toml` or the devcontainer, and both
  `factory-build.yml` and `factory-docs.yml` re-check that file scope before
  pushing. Triggering the build job requires a maintainer to apply a label.

Secrets come from `/etc/ha-factory/runner.env` via systemd `EnvironmentFile=`
on the runner, not from GitHub secrets. Only `GITHUB_TOKEN` is passed through.

That file must define `OMNIROUTER_BASE_URL` and `OMNIROUTER_API_KEY`, which
`opencode.json` resolves as `{env:OMNIROUTER_BASE_URL}`. If either is missing,
`baseURL` becomes an empty string and the agent dies with an opaque
`/chat/completions cannot be parsed as a URL`. Every writing workflow now
checks both variables before invoking the agent and names the missing one, so
the failure points at `/etc/ha-factory/runner.env` instead of at OpenCode. After
editing that file, reload the runner service so the environment is re-read:

```bash
sudo systemctl restart "actions.runner.<runner-name>"
```

### Version pinning

Everything the factory executes is pinned, because an unpinned CLI that
resolves to "latest" can break agent frontmatter without any diff in the repo:

- the action is pinned to the commit SHA of `github-v1.2.25`
  (`a3b97d9`), not to `@latest`;
- the CLI is installed with `opencode install --version 1.18.33` via
  `OPENCODE_VERSION`, in all four jobs that install it.

Verify the pins locally:

```bash
~/.opencode/bin/opencode --version          # doit afficher 1.18.33
~/.opencode/bin/opencode agent list         # les 5 agents factory-*
```

Note the action's composite step installs its own CLI at run time. Since the
reviewer is the only job using the action, its CLI version is the one thing
not controlled by `OPENCODE_VERSION`; that is the reason the reviewer needs no
write access and therefore cannot be harmed by a version change.

### Labels must exist before any agent runs

`issues.addLabels` returns 422 for a label that does not exist, which would make
`factory-review` fail while applying its verdict and would make
`factory-build` impossible to trigger. `factory/labels.yml` declares them and
`.github/workflows/factory-labels.yml` creates them on push; it is idempotent
and never deletes a label, since deleting one would discard triage history.

Labels are the human gate: applying `to-implement` to an issue is what authorises
the agent to execute it. That is deliberate on a public repository, where anyone
can open an issue but only someone with write access can label it.

### The issue lifecycle

```
issue opened
  -> factory-spec.yml   drafts a plan as a comment
  -> human comment      a new plan is drafted from the feedback
  -> to-implement       the plan is approved
  -> factory-build.yml  the pull request is opened
```

The plan phase exists because `factory-build` never asks a question: on an
ambiguous issue it guesses, and a wrong guess surfaces as a pull request that has
to be read, corrected by a fix loop, and closed. Issue #1 produced an automation
that opened the same covers as an existing one at the same hour; the conflict
only became visible at review, after all the work. Making the issue unambiguous
first costs one comment.

Iteration is driven by comments. The workflow skips bot comments, and skips an
issue that already has a plan with no human reply, so the plan the agent posts
cannot trigger another plan.

### Why the reviewer uses the action and the fixer uses the CLI

`anomalyco/opencode/github` ignores its `agent` input — the published CLI never
reads that variable — and `default_agent` is a single global value. A read-only
reviewer and a writing fixer therefore need two separate invocations: the action
for the reviewer, `opencode run --agent factory-fix` for the fixer.

This is confirmed, not assumed: `opencode agent list` shows the five
`factory-*` agents as `mode: all`, and `opencode run --help` lists `--agent`.
`opencode agent list` also confirms the permission model actually took effect —
`factory-review` reports `edit: deny` and `bash: deny`, the four writing agents
report `edit: allow` with a bash allowlist.


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
