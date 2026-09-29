#!/usr/bin/env python3
"""Controles statiques sur les scripts shell et JS inlines des workflows.

Ces deux controles ont tous les deux attrape des bugs qui n ont ete vus qu au
premier vrai run de l usine, apres le push, parce que ni yamllint ni HA ne
touchent au code des workflows :

1. `bash -n` sur chaque bloc `run` : verifie le quoting sans executer. C est
   ce qui revele une apostrophe glissee dans un programme awk entre apostrophes
   simples, ce qui cassait le programme entier.

2. Contrat de l API @actions/exec : getExecOutput renvoie { exitCode, stdout,
   stderr }. Lire `.output` donne `undefined` et provoque un TypeError au
   moment ou l on fait `.trim()`. La propriete s appelait `output` dans quatre
   workflows, jamais execute jusqu au premier build reel.
"""
from __future__ import annotations

import pathlib
import re
import subprocess
import sys
import tempfile

import yaml

# Lecture d une propriete inexistante sur le retour de getExecOutput.
# `getExecOutput` renvoie {exitCode, stdout, stderr}. Deux fautes se paient cher
# et silencieusement : `.output` renvoie undefined, et surtout `.exit_code`
# aussi, donc `result.exit_code !== 0` est toujours vrai et fait echouer l etape
# meme quand la commande a reussi. Le second motif est donc `*_code`, pas
# seulement `.output`.
EXEC_RESULT_PROPS = re.compile(
    r"\b(?:status|lint|push|out|result|res)\.output\b"
    r"|\b\w+\.(?:exit_code|return_code|returncode)\b"
)
EXEC_PROPS = ("exitCode", "stdout", "stderr")


def inline_scripts(path: pathlib.Path) -> list[tuple[str, str, str, str]]:
    """Renvoie (genre, job, etape, code) pour chaque bloc run ou script inline.

    genre vaut "sh" pour un bloc `run` et "js" pour le `script` d un
    actions/github-script : les deux ne se valident pas de la meme facon.
    """
    doc = yaml.safe_load(path.read_text())
    found: list[tuple[str, str, str, str]] = []
    for job, config in (doc.get("jobs") or {}).items():
        for index, step in enumerate(config.get("steps") or []):
            label = f"{job} / {step.get('name', index)}"
            if step.get("run"):
                found.append(("sh", job, label, step["run"]))
            elif step.get("with", {}).get("script"):
                found.append(("js", job, label, step["with"]["script"]))
    return found


def check_shell(workflow: pathlib.Path) -> list[str]:
    failures = []
    for kind, _job, label, script in inline_scripts(workflow):
        if kind != "sh":
            continue
        with tempfile.NamedTemporaryFile("w", suffix=".sh", delete=False) as handle:
            handle.write(script)
            path = handle.name
        result = subprocess.run(["bash", "-n", path], capture_output=True, text=True, check=False)
        pathlib.Path(path).unlink()
        if result.returncode:
            failures.append(f"{workflow.name} / {label}")
            print(f"  FAIL shell {workflow.name} / {label}")
            first = result.stderr.strip().splitlines()
            if first:
                print(f"       {first[0]}")
    return failures


def check_exec_api(workflow: pathlib.Path) -> list[str]:
    failures = []
    for kind, _job, label, script in inline_scripts(workflow):
        if kind != "js" or "getExecOutput" not in script:
            continue
        for match in EXEC_RESULT_PROPS.finditer(script):
            failures.append(f"{workflow.name} / {label}")
            print(
                f"  FAIL exec {workflow.name} / {label} : `{match.group(0)}` n existe pas, "
                f"utiliser {'/'.join(EXEC_PROPS)}"
            )
            break
    return failures


def check_commit_order(workflow: pathlib.Path) -> list[str]:
    """`git reset agent-output.log` doit precéder `git commit`.

    Le journal de l agent est cree dans l arbre de travail par le `| tee`. Il
    est retire du commit pour ne jamais partir dans une pull request, mais
    seulement si le reset precede le commit : apres, c trop tard, le fichier
    est deja dans le commit.(factory-fix ne l'excluait pas du tout.)
    """
    failures = []
    for kind, _job, label, script in inline_scripts(workflow):
        if kind != "js" or "agent-output.log" not in script:
            continue
        commit = script.find("'commit'")
        reset = script.find("'reset'")
        if commit == -1:
            continue
        if reset == -1 or reset > commit:
            failures.append(f"{workflow.name} / {label}")
            print(
                f"  FAIL commit {workflow.name} / {label} : "
                "agent-output.log n est retire qu'apres le commit"
            )
    return failures


def main(argv: list[str]) -> int:
    root = pathlib.Path(argv[1]) if len(argv) > 1 else pathlib.Path(".github/workflows")
    workflows = sorted(root.glob("*.yml")) + sorted(root.glob("*.yaml"))
    if not workflows:
        print(f"Aucun workflow trouve dans {root}", file=sys.stderr)
        return 1

    shell = [f for w in workflows for f in check_shell(w)]
    api = [f for w in workflows for f in check_exec_api(w)]
    order = [f for w in workflows for f in check_commit_order(w)]

    total = sum(len(inline_scripts(w)) for w in workflows)
    if shell or api or order:
        print(
            f"\n{len(shell)} bloc(s) shell invalide(s), "
            f"{len(api)} appel(s) exec invalide(s), "
            f"{len(order)} ordre(s) de commit invalide(s)"
        )
        return 1
    print(f"  ok   {total} blocs inlines : shell, API exec et commits valides")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
