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
| `factory-fix.yml` | label `factory/needs-fix`, or a human review | self-hosted | Applies the blocking fixes, pushes to the PR branch |
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

- the CLI is installed with `opencode install --version 1.18.33` via
  `OPENCODE_VERSION`, in every job that runs an agent. The reviewer included:
  while it used the action, its CLI came from the action's composite step and
  was the one version not controlled by `OPENCODE_VERSION`.

Verify the pins locally:

```bash
~/.opencode/bin/opencode --version          # doit afficher 1.18.33
~/.opencode/bin/opencode agent list         # les 5 agents factory-*
```

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
  -> to-implement       a human approves the plan
  -> factory-build.yml  implements the plan, and opens a pull request
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

### The plan is the spec, not the issue


`factory-build` receives the approved plan and the original issue, and the
prompt states which one wins: **the plan**. An issue title is a draft written
before the need was understood, and nobody rereads it; the plan is the part that
was corrected and approved.

The pull request body opens with `Close #N`, so merging it closes the issue.
The wording is English on purpose: `close`, `fix` and `resolve` are the only
words GitHub recognises, in English only, and there is no error and no warning
when it ignores something else. `Cloture #N` sat in that spot from the first
commit of the factory and did nothing at all — the failure is invisible, which
is why `check_issue_closure` now fails the build when a pull request cites an
issue number without a closing keyword.

Issue #3 showed the cost of not doing this. The plan revised "garage" to "salon"
window and dropped a door condition, and the human said so in a comment. The
build, receiving only the title, wrote `automations/garage/door.yaml` — a garage
door. With the plan wired in, the same issue produced
`automations/salon/volet_nuit.yaml`.

So the build fails rather than guesses when the gate is incomplete:

- `to-implement` absent — nothing authorises writing;
- no plan comment — an approval that points at nothing is not an approval;
- the approval event's actor is a bot — the plan is written by a bot by design,
  the *authorisation* is what must be human, and the journal is where that is
  proven;
- the plan is newer than the approval — nobody read it.

The prompt tells the agent not to "cover both versions" when the plan and the
title disagree. An automation that does more than the plan is unverifiable, and
was never what was asked for.

### Both agents use the CLI, and why the reviewer used to be an exception

`anomalyco/opencode/github` ignores its `agent` input — the published CLI never
reads that variable — and `default_agent` is a single global value. A read-only
reviewer and a writing fixer therefore need two separate invocations, and the
fixer is invoked as `opencode run --agent factory-fix`. The reviewer now uses
the same form, `opencode run --agent factory-review`, for a second reason.

The action gates every run on `assertPermissions()`, which asks the API for the
**collaborator permission of `github.actor`** — the user who triggered the event,
not the token the action is about to use:

```ts
const { actor } = useContext()
octoRest.repos.getCollaboratorPermissionLevel({ ..., username: actor })
if (!["admin", "write"].includes(permission)) throw new Error(...)
```

Every PR in this repository is opened by `factory-build`, so `github.actor` is
`github-actions[bot]`, which is not a collaborator: the API answers
`permission: none` and the review throws. This is deterministic, not flaky — the
human-opened run `36621085953` passed with `permission: admin`, and the
factory-opened runs `36621537561` and `36672422851` failed with `permission:
none`. The reviewer had therefore never once reviewed a machine-built PR.

The failure was also quiet. The action posts its own error text as a review
comment, the verdict step is then skipped, no label is applied, and the fixer
never starts. The review/fix loop was inert on every factory-built PR while every
run still reported "a review happened".

Setting `TOKEN` did not help, and the note in the workflow claiming it did was
wrong. `useEnvGithubToken()` reads `process.env["TOKEN"]`, but the action's
`action.yml` does not forward `TOKEN` in its own `env:` block, so the
`skipped (using github token)` line never appeared in any run and the API check
always ran.

The CLI has no such gate, and the reviewer no longer needs the `GIT_CONFIG_*`
authorisation header that existed only to serve the action's `git fetch` — the
review pushes nothing.

This is confirmed, not assumed: `opencode agent list` shows the five
`factory-*` agents as `mode: all`, and `opencode run --help` lists `--agent`.
`opencode agent list` also confirms the permission model actually took effect —
`factory-review` reports `edit: deny` and `bash: deny`, the four writing agents
report `edit: allow` with a bash allowlist.

Because the reviewer has `bash: deny`, it cannot run `git diff`, and neither the
action nor the CLI provides a diff tool. `review.md` used to tell the agent to
"use "the diff search tool", which does not exist; the reviewer could only read
whatever happened to be in the working tree. The workflow now resolves the diff
itself and passes it in the prompt, and the workflow checks reject a prompt that
promises a tool the agent cannot have.


### Cost and retry bounds

- The review/fix loop is bounded: `factory-fix` increments
  `factory/attempt-N`, and the reviewer stops labelling after 2 attempts and
  adds `factory/escalade` instead.
- A human review is bounded by the same counter. The automatic loop has a
  dispatcher that checks the count before starting; a human review has none,
  because GitHub delivers the event directly, so `factory-fix` applies the
  ceiling itself. Past the limit it adds `factory/escalade` and leaves the pull
  request alone.
- Migration is bounded by `max_attempts` in `factory/queue.yaml`, and an entry
  with an open pull request is never selected again.
- Per-PR concurrency uses `cancel-in-progress: true`; a new push supersedes an
  in-flight review.

### Human review feedback

`factory-fix.yml` has three triggers, and the third is the one that carries a
person rather than the factory:

| Trigger | Feedback source | How it is read |
| --- | --- | --- |
| label `factory/needs-fix` | automatic verdict | last comment containing `VERDICT: BLOQUANT` |
| `workflow_dispatch` | automatic verdict | same |
| `pull_request_review` | human review | the review body, plus `listReviewComments` for the inline comments |

The inline comments matter more than they look. A reviewer working line by
line leaves a review whose body is often empty or one line long, with the
actual points attached to specific lines — so reading only the body would
hand the agent "fix these points" with no points. The body is also allowed to
be empty without that being an error, which is the common case.

`changes_requested` and `commented` both act. `approved` is excluded, and
excluded *by name* rather than by omission: `check_human_review_trigger` in
`workflow-check.py` requires all three states to appear in the job's `if:`, so
a future edit that swaps the whitelist for a blacklist without mentioning
`approved` fails the check instead of quietly rewriting a pull request someone
had just approved.

Two things differ from the automatic path, deliberately:

- The prompt is `address.md`, not `fix.md`. Human feedback is not a defect
  report. "This is too long" and "I prefer the old wording" are requests the
  agent must obey even though the code was correct, while a request that
  looks like a misreading of the file must be reported rather than satisfied
  by inventing a problem.
- The push is answered with a comment summarising what was done. The automatic
  path has the reviewer re-read the next commit; a human asking for a change
  would otherwise just see a commit appear.

The review text is untrusted input: it comes from a pull request conversation,
where anyone can write. `address.md` marks it as data and states that
instructions outside the scope of a configuration change are reported, not
followed.

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
