#!/usr/bin/env bash
# Teste le rendu de prompt de factory-build.yml sur des entrees hostiles.
#
# Le awk est extrait du workflow a chaque execution : on teste le vrai code,
# pas une recopie. Chaque cas est lance via run_timeout, parce qu un defaut de
# ce genre se manifeste par un plantage (boucle infinie) et non par une
# assertion. Aucune dependance hors python3 : le workflow est lu comme du
# texte, pas avec PyYAML, pour que ce test tourne partout.
set -uo pipefail
cd "$(dirname "$0")/../.." || exit 1

PY=${PY:-python3}
command -v "$PY" >/dev/null 2>&1 || { echo "python3 introuvable"; exit 1; }
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
fails=0

# Timeout portable : `timeout` n existe pas sur macOS.
run_timeout() { # run_timeout <secondes> <cmd...>
  local secs=$1; shift
  "$@" & local pid=$!
  local ticks=0 limit=$((secs * 10))
  while kill -0 "$pid" 2>/dev/null; do
    if [ "$ticks" -ge "$limit" ]; then kill -9 "$pid" 2>/dev/null; wait "$pid" 2>/dev/null; return 124; fi
    sleep 0.1; ticks=$((ticks + 1))
  done
  wait "$pid"
}

# Extrait le programme awk du workflow dans un script de rendu reutilisable.
#   render.sh <repertoire-de-variables> <template> <sortie>
# On ne recupere que le programme awk, entoure de ses apostrophes : c est la
# ou se trouvent les bugs (apostrophe parasite, boucle infinie sur un
# placeholder cite). Le reste du step est du plumbing shell.
"$PY" - > "$WORK/render.sh" <<'PYEOF'
import pathlib, sys
text = pathlib.Path('.github/workflows/factory-build.yml').read_text()
start = text.index("awk -v dir=")
tpl = text.index(".github/prompts/build.md", start)
open_q = text.index("'", start)
close_q = text.rindex("'", open_q, tpl)
program = text[open_q + 1:close_q]
if "'" in program:
    sys.exit("apostrophe dans le programme awk : le quoting shell du workflow est casse")
print('#!/usr/bin/env bash')
print('set -euo pipefail')
print('awk -v dir="$1" \'')
print(program)
print('\' "$2" > "$3"')
PYEOF
if [ $? -ne 0 ]; then
  echo "  FAIL extraction du programme awk depuis le workflow"
  exit 1
fi
chmod +x "$WORK/render.sh"
# Un render.sh vide ferait reussir tous les cas sans rien tester.
if [ ! -s "$WORK/render.sh" ] || ! grep -q 'awk' "$WORK/render.sh"; then
  echo "  FAIL extraction du programme awk depuis le workflow"
  exit 1
fi
TPL=.github/prompts/build.md

render() { # render <var-dir> <sortie>
  run_timeout 20 bash "$WORK/render.sh" "$1" "$TPL" "$2"
}

# Fabrique un repertoire de variables de rendu.
# Chaque placeholder du prompt a sa variable ici. Il en a deja manque deux —
# PLAN puis APPROVED_BY — et les tests ont echoue chaque fois avant le commit :
# un test qui n'alimente pas toutes les variables du prompt ne teste pas la
# production. Apres ajout d'un placeholder ici, verifier les deux cas « complet »
# et « corps vide ».
newcase() { # newcase <nom> <numero> <titre> <corps> [plan]
  local d="$WORK/$1"; rm -rf "$d"; mkdir -p "$d"
  printf '%s' "$2" > "$d/ISSUE_NUMBER"
  printf '%s' "$3" > "$d/ISSUE_TITLE"
  printf '%s' "$4" > "$d/ISSUE_BODY"
  printf '%s' "${5-}" > "$d/PLAN"
  printf '%s' 'TanguyBaudrin' > "$d/APPROVED_BY"
  echo "$d"
}

ok()   { echo "  ok   $1"; }
bad()  { echo "  FAIL $1"; fails=$((fails+1)); }

expect() { # expect <nom> <true|false> <var-dir>
  local name=$1 want=$2 dir=$3
  if render "$dir" "$dir.rendered" 2>"$WORK/err"; then got=true; else got=false; fi
  if [ "$got" = "$want" ]; then ok "$name"; else bad "$name (success=$got, attendu $want)"; sed 's/^/         /' "$WORK/err" | head -3; fi
}

echo "rendu du prompt de factory-build"

# 1. l'issue reelle qui a casse la premiere version du workflow (multiligne)
d=$(newcase reel 12345 'Sunrise triggers the cover at 7am all days' 'It seems that cover are opened all days at 7am.

It should be the last occurence of sunrise/7am.

So if sunrise is at 8am, it should open at 8am.

This rule is only available on workdays')
expect "issue reelle, corps multiligne" true "$d"
if grep -q 'This rule is only available on workdays' "$WORK/reel.rendered" 2>/dev/null; then
  ok "corps complet rendu"; else bad "corps incomplet"; fi
if grep -q 'Sunrise triggers the cover' "$WORK/reel.rendered" 2>/dev/null; then
  ok "titre rendu"; else bad "titre non rendu"; fi

# 2. un corps qui cite un placeholder : boucle infinie avant le correctif
d=$(newcase cite 7 T 'voici {{ISSUE_BODY}} puis {{ISSUE_TITLE}} dans le corps')
expect "placeholder cite dans le corps (etait une boucle infinie)" true "$d"

# 3. metacaracteres de sed dans le titre et le corps
d=$(newcase meta 9 'pipe | esperluette & dollar $HOME antislash \ quote " simple '"'"' tick ` $(whoami)' 'sed s/THIS/THAT/ and & and $& and %s and * and .')
expect "metacaracteres de sed" true "$d"
if grep -q 'sed s/THIS/THAT/' "$WORK/meta.rendered" 2>/dev/null; then
  ok "corps a metacaracteres rendu litteralement"; else bad "corps a metacaracteres altere"; fi
if grep -q 'pipe | esperluette &' "$WORK/meta.rendered" 2>/dev/null; then
  ok "titre a metacaracteres rendu litteralement"; else bad "titre a metacaracteres altere"; fi

# 4. corps vide et valeurs absentes
d=$(newcase vide '' '' '')
expect "valeurs vides" true "$d"

# 5. toutes variables fournies : plus aucun placeholder ne doit subsister
d=$(newcase complet 1 T B '## Plan

P.')
if render "$d" "$WORK/complet.rendered" 2>/dev/null; then
  if grep -q '{{[A-Z_]' "$WORK/complet.rendered"; then
    bad "des placeholders subsistent malgre des variables fournies"
    grep -n '{{[A-Z_]' "$WORK/complet.rendered" | head -3 | sed 's/^/         /'
  else ok "toutes variables fournies : aucun placeholder residuel"; fi
else bad "cas complet : rendu en echec"; fi

# 5 bis. le plan valide prime sur l'issue, et les deux sont bien presents.
# C est la raison d etre du changement : sur l'issue #3, le plan corrigeait le
# titre, et un agent qui n'avait recu que le titre a ecrit une porte de garage.
d=$(newcase plan 3 'Ferme le volet du garage la nuit' \
  'Ce serait bien que le garage se ferme tout seul la nuit.' \
  '## Plan

Fermer le volet du SALON la nuit, sans condition de porte.')
expect "plan valide et issue rendus ensemble" true "$d"
if grep -q 'Fermer le volet du SALON la nuit' "$d.rendered" 2>/dev/null; then
  ok "plan valide rendu dans le prompt"; else bad "plan valide absent du prompt"; fi
if grep -q 'Ferme le volet du garage la nuit' "$d.rendered" 2>/dev/null; then
  ok "issue conservee comme contexte"; else bad "issue d origine absente du prompt"; fi
# Un plan qui cite lui-meme un placeholder ne doit pas rescanne.
d=$(newcase plancite 3 T 'corps' '## Plan

Voir {{ISSUE_BODY}} et {{ value_template }}.')
expect "plan citant un placeholder" true "$d"
if grep -q 'Voir {{ISSUE_BODY}} et {{ value_template }}' "$d.rendered" 2>/dev/null; then
  ok "plan citant un placeholder reste du texte"
else bad "plan rescane : un placeholder du plan a ete resolu"; fi

# 5 ter. un corps d'issue vide ne doit pas laisser de placeholder : le programme
# awk confondait fichier absent et fichier vide, et le garde-fou echouait alors
# sur une issue sans corps.
d=$(newcase corpsvide 3 'Titre seul' '' '## Plan

P.')
expect "corps d issue vide" true "$d"
if grep -q '{{[A-Z_]' "$d.rendered" 2>/dev/null; then
  bad "corps d issue vide : placeholder laisse dans le rendu"
else ok "corps d issue vide : aucun placeholder residuel"; fi

# 6. variable manquante : le placeholder doit rester visible pour que le
#    garde-fou du workflow echoue, au lieu d'un prompt silencieusement tronque
d="$WORK/absente"; rm -rf "$d"; mkdir -p "$d"
printf 'x' > "$d/ISSUE_BODY"
if render "$d" "$WORK/absente.rendered" 2>/dev/null; then
  if grep -q '{{ISSUE_NUMBER}}\|{{ISSUE_TITLE}}\|{{PLAN}}' "$WORK/absente.rendered"; then
    ok "variable manquante : placeholder conserve (garde-fou declenche)"
  else bad "variable manquante : placeholder remplace par du vide en silence"; fi
else bad "variable manquante : rendu en echec"; fi

echo
[ "$fails" -eq 0 ] && { echo "Tous les tests passent."; exit 0; }
echo "$fails ECHEC(S)"; exit 1
