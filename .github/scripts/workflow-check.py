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

3. Frontmatter des agents opencode : une valeur refusee par le schema invalide
   la configuration du depot entier et plus aucune commande opencode ne demarre.
"""
from __future__ import annotations

import json
import pathlib
import re
import subprocess
import sys
import tempfile

import yaml

# Palette acceptee par le schema d opencode pour le champ `color` d un agent,
# en plus d une couleur hexadecimale. Voir AGENT_COLORS plus bas.
AGENT_COLORS = (
    "primary", "secondary", "accent", "success", "warning", "error", "info",
)

# Agent nomme par un workflow, soit dans une invocation de CLI, soit dans un
# appel a l action opencode.
AGENT_REFERENCE = re.compile(r"--agent[= ]+([\w-]+)")

# Modele nomme par un workflow, soit par `--model`, soit par l entree `model:`
# de l action opencode. La premiere composante est le nom du provider, et c est
# elle que l on compare a opencode.json.
MODEL_REFERENCE = re.compile(
    r"--model[= ]+([\w.-]+/[\w./-]+)|^model:\s*([\w.-]+/[\w./-]+)\s*$",
    re.MULTILINE,
)

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


def check_shadowed_globals(workflow: pathlib.Path) -> list[str]:
    """Refuse de redeclarer un global fourni par actions/github-script.

    github-script execute le script dans un contexte ou `github`, `context`,
    `core`, `exec`, `io` et `require` sont deja definis. Les redeclarer avec
    `const`/`let` ne donne pas une variable locale : c'est un `SyntaxError`
    « Identifier 'exec' has already been declared », et le script n'a jamais
    tourne. C'est arrive sur `const { exec } = require('@actions/exec')`
    (run 36673497099), et l'echec n'apparait qu'a l'execution, sur le runner :
    le YAML est valide, la revue demarre, puis meurt a la premiere ligne.
    """
    failures = []
    shadow = re.compile(
        r"^\s*(?:const|let|var)\s+(?:\{\s*)?(github|context|core|exec|io|require)\b",
        re.M,
    )
    for kind, _job, label, script in inline_scripts(workflow):
        if kind != "js":
            continue
        for match in shadow.finditer(script):
            name = match.group(1)
            failures.append(f"{workflow.name} / {label}")
            print(
                f"  FAIL global {workflow.name} / {label} : `{name}` est deja "
                f"fourni par github-script, le redeclarer est un SyntaxError"
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


def check_guarded_commit(workflow: pathlib.Path) -> list[str]:
    """Un `git commit` doit passer par `must`, jamais par `run` directement.

    Le runner n a aucune identite git, et le commit echouait donc sur
    « Author identity unknown » sans que l etape le remarque : le code de
    retour n etait pas lu, le script continuait, et l echec remontait trois
    lignes plus loin sous la forme d un push qui n a rien pousser.
    """
    failures = []
    for kind, _job, label, script in inline_scripts(workflow):
        if kind != "js":
            continue
        for statement in script.split(";"):
            flat = " ".join(statement.split())
            # `must` appelle aussi run('git', args), mais avec une variable :
            # seul un tableau litteral ou un gitAs(...) inline est un appel
            # direct dont le retour disparait.
            if re.search(r"\brun\('git'", flat) and "'commit'" in flat:
                failures.append(f"{workflow.name} / {label}")
                print(
                    f"  FAIL garde {workflow.name} / {label} : "
                    f"`{flat[:60]}...` ignore le code de retour du commit, "
                    "passer par must(gitAs(...))"
                )
                break
    return failures


def check_agents(agents_dir: pathlib.Path) -> list[str]:
    """Verifie le frontmatter de chaque agent, et que le nom existe la ou on l'appelle.

    Le schema d opencode n autorise qu une palette nommee, ou une couleur
    hexadecimale. Un nom hors palette, `cyan` par exemple, invalide la
    configuration **du depot entier** : plus aucune commande opencode ne
    demarre, donc la revue, la construction, la correction et la
    specification tombent d un coup. C est ce que le premier run de
    factory-spec a montre, et le nom du fichier ne dit rien du sous-agent
    concerne.

    On verifie aussi que chaque nom appele par un workflow existe. Un agent
    renomme laisse `--agent factory-spec` echouer sur le runner, apres le
    checkout, l installation de la CLI et la construction du prompt.
    """
    failures: list[str] = []
    known: set[str] = set()

    for path in sorted(agents_dir.glob("*.md")):
        text = path.read_text(encoding="utf-8")
        match = re.match(r"^---\n(.*?)\n---\n", text, re.DOTALL)
        if not match:
            failures.append(f"{path}: pas de frontmatter YAML delimite par ---")
            continue
        known.add(path.stem)
        try:
            meta = yaml.safe_load(match.group(1)) or {}
        except yaml.YAMLError as exc:
            failures.append(f"{path}: frontmatter illisible ({exc})")
            continue
        if not isinstance(meta, dict):
            failures.append(f"{path}: frontmatter pas une table")
            continue
        if not str(meta.get("description") or "").strip():
            failures.append(f"{path}: description vide, l agent n est pas listable")
        colour = meta.get("color")
        if colour is not None and not re.fullmatch(
            r"#[0-9a-fA-F]{6}", str(colour)
        ) and colour not in AGENT_COLORS:
            failures.append(
                f"{path}: color={colour!r} hors palette "
                f"({' | '.join(AGENT_COLORS)} ou #rrggbb)"
            )
        permissions = meta.get("permission")
        if permissions is not None and not isinstance(permissions, dict):
            failures.append(f"{path}: permission doit etre une table d outils")

    if not known:
        return failures + [f"Aucun agent trouve dans {agents_dir}"]

    root = agents_dir.parent.parent
    config = root / "opencode.json"
    if config.exists():
        try:
            default = (json.loads(config.read_text(encoding="utf-8"))
                       .get("default_agent"))
        except json.JSONDecodeError as exc:
            failures.append(f"{config}: illisible ({exc})")
            default = None
        if default and default not in known:
            failures.append(
                f"{config}: default_agent={default!r} n existe pas "
                f"(agents: {', '.join(sorted(known))})"
            )

    for workflow in sorted((root / ".github/workflows").glob("*.yml")):
        text = workflow.read_text(encoding="utf-8")
        for name in AGENT_REFERENCE.findall(text):
            if name not in known:
                failures.append(
                    f"{workflow}: appelle l'agent {name!r}, absent de "
                    f"{agents_dir} (agents: {', '.join(sorted(known))})"
                )
    return failures


def check_prompt_placeholders(root: pathlib.Path) -> list[str]:
    """Verifie que chaque placeholder d un prompt recoit une valeur.

    Les deux rendus sont differents — awk pour le build, JavaScript pour la
    spec — et un placeholder oublie d un seul cote ne casse rien localement :
    le prompt part, l'agent recoit la chaine `{{PLAN}}` litterale, et ne le
    remarque pas. Le garde-fou du build voit bien le `{{` residuel et echoue
    tard, sur le runner, apres le checkout et l installation de la CLI.

    On verifie donc, pour chaque prompt, que chaque placeholder trouve est bien
    alimente : par un `printf` vers prompt-vars pour le build, par une cle du
    tableau `vars` pour la spec.
    """
    failures: list[str] = []
    placeholders = re.compile(r"\{\{([A-Z_][A-Z0-9_]*)\}\}")

    prompts = root / ".github/prompts"
    if not prompts.is_dir():
        return [f"{prompts} absent"]

    for prompt in sorted(prompts.glob("*.md")):
        keys = set(placeholders.findall(prompt.read_text(encoding="utf-8")))
        if not keys:
            continue
        # Le workflow qui rend ce prompt : celui dont le nom correspond, ou le
        # seul qui cite le prompt.
        candidates = [
            w for w in sorted((root / ".github/workflows").glob("*.yml"))
            if prompt.name in w.read_text(encoding="utf-8")
        ]
        if not candidates:
            failures.append(f"{prompt.name}: aucun workflow ne le rend")
            continue
        if len(candidates) > 1:
            failures.append(
                f"{prompt.name}: rendu par {len(candidates)} workflows "
                f"({', '.join(w.name for w in candidates)}), ambigu"
            )
            continue
        text = candidates[0].read_text(encoding="utf-8")
        for key in sorted(keys):
            # Les trois rendus ne se ressemblent pas, et on ne cherche pas a
            # les unifier : le build ecrit un fichier par variable et laisse awk
            # le lire (`prompt-vars/ISSUE_TITLE`), la spec passe par un tableau
            # JavaScript, la correction et la migration font un remplacement
            # sed ou String.replace. Ce que le controle verifie, c'est la chose
            # simple qui compte : le workflow parle-t-il de ce placeholder.
            # Un `{{PLAN}}` ajoute au prompt et oublie dans le workflow est
            # aujourd hui invisible, et part tel quel a l agent.
            token = "{{" + key + "}}"
            if token not in text and "prompt-vars/" + key not in text:
                failures.append(
                    f"{prompt.name}: placeholder {key} jamais alimente par "
                    f"{candidates[0].name}"
                )
    return failures


def check_models(root: pathlib.Path) -> list[str]:
    """Verifie que le provider de chaque modeleappele existe dans opencode.json.

    Le nom du provider est la premiere composante de `provider/modele`. Un
    provider mal orthographie est le pire genre d'erreur ici : opencode ne
    leve aucune erreur explicite sur le nom, il echoue plus tard avec un
    « Unexpected server error » et une reference opaque, indistinguishable d
    une panne du fournisseur. C est ce qu a fait `omnirouter` dans
    factory-spec.yml, un `o` de trop : la sonde de sante d OmniRoute, elle,
    repondait 200 pendant que l agent ne pouvait pas demarrer.

    On compare aussi `model` et `small_model` d opencode.json, pour que la
    config ne cite pas un provider absent d elle-meme.
    """
    config = root / "opencode.json"
    if not config.exists():
        return [f"{config} absent : impossible de verifier les modeles"]
    try:
        data = json.loads(config.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        return [f"{config}: illisible ({exc})"]

    declared = set((data.get("provider") or {}))
    if not declared:
        return [f"{config}: aucun provider declare"]

    failures: list[str] = []

    def check(reference: str, origin: str) -> None:
        provider = reference.split("/", 1)[0]
        if provider not in declared:
            failures.append(
                f"{origin}: provider {provider!r} inconnu, le modele cite "
                f"{reference!r} (declarés : {', '.join(sorted(declared))})"
            )

    for key in ("model", "small_model"):
        value = data.get(key)
        if isinstance(value, str) and "/" in value:
            check(value, f"{config}: {key}")

    for workflow in sorted((root / ".github/workflows").glob("*.yml")):
        text = workflow.read_text(encoding="utf-8")
        for cli, action in MODEL_REFERENCE.findall(text):
            reference = (cli or action).strip()
            if reference:
                check(reference, workflow.name)
    return failures


def check_agent_invocations(root: pathlib.Path) -> list[str]:
    """Verifie que chaque agent factory-* est invoque d une seule maniere.

    Deux facon d'appeler un agent se disputent le meme poste : l'action
    `anomalyco/opencode/github` avec son entree `agent:`, et la CLI
    `opencode run --agent`. Elles ne se comportent pas pareil, et l'action
    ajoute un controle que la CLI n'a pas.

    L'action appelle `assertPermissions()`, qui interroge le niveau de
    collaborateur de `github.actor` — l'utilisateur qui a declenche l'evenement,
    pas le jeton qu'elle utilise ensuite. Toutes les pull requests de ce depot
    etant ouvertes par `factory-build`, `github.actor` vaut
    `github-actions[bot]`, qui n'est pas collaborateur : la revue echouait sur
    `permission: none` (runs 36621537561 et 36672422851) alors que le run
    ouvert par un humain passait avec `permission: admin` (36621085953). La
    boucle revue/correction etait donc inerte sur toutes les pull requests
    produites par l'usine.

    L'echec etait de surcroit muet : l'action poste son message d'erreur en
    commentaire de revue, l'etape de verdict saute, aucune etiquette n'est
    posee, et le correcteur ne part jamais. Le run seemed succes au regard des
    etapes, et la revue n'avait en fait jamais eu lieu.

    On refuse donc l'action pour tout agent factory-*, et on verifie que la
    forme CLI est bien presente : c'est elle qui porte le verdict.
    """
    failures: list[str] = []
    action_use = re.compile(r"uses:\s*anomalyco/opencode/github")

    for workflow in sorted((root / ".github/workflows").glob("*.yml")):
        text = workflow.read_text(encoding="utf-8")
        if action_use.search(text):
            failures.append(
                f"{workflow.name}: utilise anomalyco/opencode/github. Cette action "
                f"refuse les evenements dont github.actor n'est pas collaborateur "
                f"write/admin, donc toute pull request ouverte par l'usine. "
                f"Utiliser `opencode run --agent`."
            )

        for agent in sorted(set(re.findall(r"--agent\s+(factory-[a-z]+)", text))):
            # L'invocation est étalée sur plusieurs lignes (`opencode run \` puis
            # `--agent x \`), d'où le DOTALL : sans lui, la forme réelle ne
            # ressemblerait jamais au motif.
            if not re.search(rf"opencode run.*?--agent {agent}", text, re.S):
                failures.append(
                    f"{workflow.name}: cite --agent {agent} sans invocation "
                    f"`opencode run --agent {agent}`"
                )

    # Un agent factory-* defini mais jamais invoque par un workflow est soit
    # mort, soit invoque par l'action ci-dessus, et dans les deux cas il
    # ne fait rien.
    invoked = set()
    for workflow in (root / ".github/workflows").glob("*.yml"):
        invoked.update(re.findall(r"--agent\s+(factory-[a-z]+)",
                                  workflow.read_text(encoding="utf-8")))
    agents_dir = root / ".opencode/agents"
    if agents_dir.is_dir():
        for agent_file in sorted(agents_dir.glob("*.md")):
            name = agent_file.stem
            if name.startswith("factory-") and name not in invoked:
                failures.append(
                    f"{agents_dir.name}/{agent_file.name}: agent {name} jamais "
                    f"invoque par un workflow (attendu : `opencode run --agent {name}`)"
                )
    return failures


def check_human_review_trigger(root: pathlib.Path) -> list[str]:
    """Verifie que le declencheur « revue humaine » ne part pas sur une approbation.

    Un `pull_request_review` est livre pour les trois boutons de la revue :
    « Request changes », « Approve » et « Comment ». Les trois produisent le
    meme evenement, et le seul ce qui les distingue est `review.state` dans le
    `if` du job.

    L'oubli du filtre n'a rien de spectaculaire : le run demarre, l'agent
    corrige ce qu'il peut, pousse, et le commit dit « corrections des retours
    de revue humaine » alors que personne n'en a demande. Le reviewer qui
    approuvait se retrouve avec une pull request modifiee sous les yeux, et
    l'historique accuse une demande qui n'existe pas. C'est le genre d'erreur
    qu'on ne voit qu'apres avoir ecrit dans l'historique de quelqu'un.

    Le controle ne lit QUE le `if:` du job, et non le fichier entier. C'est la
    distinction qui fait tout : le workflow explique dans ses commentaires
    pourquoi `approved` est ecarte, alors `approved` apparait dans le texte.
    Chercher dans tout le fichier rendrait ce controle vert meme si la
    condition ne le mentionnait plus — c'est-a-dire exactement le cas
    d'usage pour lequel on l'ecrit.
    """
    failures: list[str] = []
    # Les trois etats doivent figurer dans la condition : deux pour agir,
    # `approved` pour que son exclusion soit un choix lisible.
    states = ("changes_requested", "commented", "approved")

    for workflow in sorted((root / ".github/workflows").glob("*.yml")):
        text = workflow.read_text(encoding="utf-8")
        if "pull_request_review" not in text:
            continue

        conditions = job_conditions(text)
        if not conditions:
            failures.append(
                f"{workflow.name}: ecoute `pull_request_review` mais aucun job "
                f"n'a de `if:` — toute revue declenche, approbation comprise."
            )
            continue

        condition = "\n".join(conditions)
        for state in states:
            if state not in condition:
                failures.append(
                    f"{workflow.name}: ecoute `pull_request_review` mais son `if:` "
                    f"ne nomme pas l'etat `{state}`. Les trois boutons doivent y "
                    f"figurer : deux pour agir, `approved` pour l'ecarter "
                    f"explicitement."
                )
    return failures


def job_conditions(text: str) -> list[str]:
    """Retourne le corps des `if:` de JOB, indentation du bloc comprise.

    Un `if:` de job est un scalaire plie (`if: >-`) dont la condition continue
    sur les lignes suivantes, plus-indentees. Lire la seule premiere ligne
    donnerait un predicat tronque — et donc un controle qui passe sur une
    condition incomplete.

    Distinguer un `if:` de job d'un `if:` d'etape par l'indentation est
    fragile : ici le premier est a 4 et le second a 8, mais rien n'oblige un
    workflow a garder cette mise en page. On remonte donc jusqu'a la ligne
    mere moins-indentee : si c'est une cle (`fix:`), le `if:` est bien un
    enfant direct du job ; si c'est une puce (`- name:`), c'est une etape.
    """
    lines = text.split("\n")
    blocks: list[str] = []
    for index, line in enumerate(lines):
        match = re.match(r"^(\s*)if:\s*(.*)$", line)
        if not match:
            continue
        indent, rest = len(match.group(1)), match.group(2)
        if rest not in (">-", "|", ">- ", "| "):
            continue

        # Remontee vers la cle mere.
        parent = None
        for back in range(index - 1, -1, -1):
            candidate = lines[back]
            if not candidate.strip():
                continue
            if len(candidate) - len(candidate.lstrip()) < indent:
                parent = candidate.strip()
                break
        if parent is None or parent.startswith("-") or ":" not in parent:
            continue

        body = [line]
        for follow in lines[index + 1:]:
            if not follow.strip():
                body.append(follow)
                continue
            if len(follow) - len(follow.lstrip()) <= indent:
                break
            body.append(follow)
        blocks.append("\n".join(body))
    return blocks


def main(argv: list[str]) -> int:
    root = pathlib.Path(argv[1]) if len(argv) > 1 else pathlib.Path(".github/workflows")
    workflows = sorted(root.glob("*.yml")) + sorted(root.glob("*.yaml"))
    if not workflows:
        print(f"Aucun workflow trouve dans {root}", file=sys.stderr)
        return 1

    shell = [f for w in workflows for f in check_shell(w)]
    api = [f for w in workflows for f in check_exec_api(w)]
    shadowed = [f for w in workflows for f in check_shadowed_globals(w)]
    order = [f for w in workflows for f in check_commit_order(w)]
    guarded = [f for w in workflows for f in check_guarded_commit(w)]
    repo_root = pathlib.Path.cwd()
    agents = check_agents(repo_root / ".opencode/agents")
    models = check_models(repo_root)
    prompts = check_prompt_placeholders(repo_root)
    invocations = check_agent_invocations(repo_root)
    human_review = check_human_review_trigger(repo_root)

    total = sum(len(inline_scripts(w)) for w in workflows)
    if (shell or api or shadowed or order or guarded or agents or models
            or prompts or invocations or human_review):
        for line in (shell + api + shadowed + order + guarded + agents + models
                     + prompts + invocations + human_review):
            print(f"  ✗    {line}", file=sys.stderr)
        print(
            f"\n{len(shell)} bloc(s) shell invalide(s), "
            f"{len(api)} appel(s) exec invalide(s), "
            f"{len(shadowed)} global(s) github-script redeclare(s), "
            f"{len(order)} ordre(s) de commit invalide(s), "
            f"{len(guarded)} commit(s) non garde(s), "
            f"{len(agents)} agent(s) invalide(s), "
            f"{len(models)} modele(s) invalide(s), "
            f"{len(prompts)} placeholder(s) de prompt non alimente(s), "
            f"{len(invocations)} invocation(s) d'agent invalide(s), "
            f"{len(human_review)} declencheur(s) de revue humaine invalide(s)",
            file=sys.stderr,
        )
        return 1
    print(f"  ok   {total} blocs inlines : shell, API exec et commits valides")
    print("  ok   agents opencode : frontmatter dans la palette, noms resolus")
    print("  ok   modeles : provider declare dans opencode.json")
    print("  ok   prompts : chaque placeholder recoit une valeur")
    print("  ok   invocations : chaque agent factory-* passe par opencode run")
    print("  ok   revue humaine : approbation explicitement ecartee")
    print("  ok   github-script : aucun global fourni par l action redeclare")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
