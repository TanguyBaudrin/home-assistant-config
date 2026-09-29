#!/usr/bin/env python3
"""Verifie la syntaxe shell de chaque bloc `run` des workflows.

`bash -n` n execute rien : il verifie uniquement le quoting, ce qui suffit a
attraper un apostrophe glissee dans un programme awk entre apostrophes simples.
Ce defaut n avait pas ete vu avant, parce que yamllint ne valide que le YAML et
que rien n execute le shell des workflows en local. Le premier vrai run de
l usine a echoue dessus, apres le push.

Usage : python3 .github/scripts/shell-syntax.py [repertoire-des-workflows]
"""
from __future__ import annotations

import pathlib
import subprocess
import sys
import tempfile

import yaml


def main(argv: list[str]) -> int:
    root = pathlib.Path(argv[1]) if len(argv) > 1 else pathlib.Path(".github/workflows")
    workflows = sorted(root.glob("*.yml")) + sorted(root.glob("*.yaml"))
    if not workflows:
        print(f"Aucun workflow trouve dans {root}", file=sys.stderr)
        return 1

    checked = 0
    failures: list[str] = []
    for workflow in workflows:
        doc = yaml.safe_load(workflow.read_text())
        for job, config in (doc.get("jobs") or {}).items():
            for index, step in enumerate(config.get("steps") or []):
                script = step.get("run")
                if not script:
                    continue
                checked += 1
                with tempfile.NamedTemporaryFile("w", suffix=".sh", delete=False) as handle:
                    handle.write(script)
                    path = handle.name
                result = subprocess.run(
                    ["bash", "-n", path], capture_output=True, text=True, check=False
                )
                pathlib.Path(path).unlink()
                if result.returncode:
                    label = f"{workflow.name} / {job} / {step.get('name', index)}"
                    failures.append(label)
                    first = result.stderr.strip().splitlines()
                    print(f"  FAIL {label}")
                    if first:
                        print(f"       {first[0]}")

    if failures:
        print(f"\n{len(failures)} bloc(s) run invalide(s) sur {checked} verifies")
        return 1
    print(f"  ok   {checked} blocs run syntaxiquement valides")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
