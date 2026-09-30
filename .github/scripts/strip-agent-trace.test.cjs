// Test du nettoyage de la sortie d'agent avant publication en commentaire.
//
// La CLI opencode melange le rapport de l'agent et la trace d'execution sur la
// meme sortie standard. Au run 36673827000, la trace faisait 1189 caracteres
// sur 3066, soit 38% du commentaire publie sur la PR #8, et la revue arrivait
// seulement en troisieme.
//
// `factory-review.yml` reproduit l'algorithme ci-dessous dans son etape
// « Publier la revue ». Le test le rejoue sur des entrees construites, parce
// que le rapport lui-meme est produit par un modele et n'est pas fige : ce qui
// doit etre verifie ici, c'est la separation trace/rapport, pas le contenu.
//
// Les cas qui ont casse une premiere version sont explicites :
//   - une puce Markdown `* point` ne doit pas etre prise pour une ligne de
//     trace, meme si elle nomme un outil ;
//   - une ligne de trace sans nom d'outil (le titre `> factory-review · modele`)
//     doit disparaitre malgre cela ;
//   - le VERDICT est la derniere ligne du rapport : tronquer dessus perdrait tout.

const fs = require("fs");
const path = require("path");

const ANSI = String.fromCharCode(27);
const ansiRe = new RegExp(`${ANSI}\\[[0-9;]*[A-Za-z]`, "g");
const stripAnsi = (s) => s.replace(ansiRe, "");
const TOOL = /\b(?:Read|Write|Edit|Glob|Grep|List|Bash|WebFetch|Task)\b/;

// Copie de l'algorithme du workflow.
function stripTrace(raw) {
  const lines = raw.split("\n");
  let i = 0;
  while (i < lines.length) {
    const bare = stripAnsi(lines[i]);
    if (!bare.trim()) {
      i += 1;
      continue;
    }
    if (/^\s*(?:#{1,6}\s|\*\*VERDICT)/.test(bare)) break;
    if (/^\s*[*+-]\s/.test(bare)) break;
    if (TOOL.test(bare)) {
      i += 1;
      continue;
    }
    if (/^\s*(?:>|→|⇒|✱|✔|✖|·)\s*\S/.test(bare)) {
      i += 1;
      continue;
    }
    break;
  }
  return stripAnsi(lines.slice(i).join("\n")).replace(/^\n+/, "").trim();
}

const TRACE = [
  `${ANSI}[0m`,
  "> factory-review · agnes/agnes-2.5-flash",
  `${ANSI}[0m`,
  `${ANSI}[0m→ ${ANSI}[0mRead automations/global/day_night.yaml`,
  `${ANSI}[0m✱ ${ANSI}[0mGlob "automations/**/*.yaml"${ANSI}[90m in . · 20 matches${ANSI}[0m`,
  `${ANSI}[0m→ ${ANSI}[0mGrep "cover\\.open_cover"${ANSI}[90m in automations · 6 matches${ANSI}[0m`,
].join("\n");

const REPORT = [
  "## Rapport de revue",
  "",
  "* Point sur `automations/global/day_night.yaml:12` —bloquant ou mineur.",
  "* Un second point, qui ne nomme aucun outil.",
  "",
  "**VERDICT: OK**",
].join("\n");

const cases = [
  {
    name: "la trace seule ne produit aucun rapport",
    raw: TRACE,
    expect: "",
  },
  {
    name: "un rapport seul est rendu tel quel",
    raw: REPORT,
    expect: REPORT,
  },
  {
    name: "trace puis rapport : le rapport est rendu intact",
    raw: `${TRACE}\n${REPORT}`,
    expect: REPORT,
  },
  {
    name: "une puce nommant un outil reste dans le rapport",
    raw: "* Read automations/x.yaml est intact\n\n**VERDICT: OK**",
    expect: "* Read automations/x.yaml est intact\n\n**VERDICT: OK**",
  },
  {
    name: "un rapport sans titre Markdown est conserve",
    raw: "Voici mon avis.\n\n* point un\n\n**VERDICT: BLOQUANT**",
    expect: "Voici mon avis.\n\n* point un\n\n**VERDICT: BLOQUANT**",
  },
  {
    name: "des lignes vides en tete ne suppriment pas le rapport",
    raw: `\n\n\n${REPORT}`,
    expect: REPORT,
  },
  {
    name: "les codes ANSI sont retires du rapport",
    raw: `${ANSI}[36;1m${REPORT}${ANSI}[0m`,
    expect: REPORT,
  },
  {
    name: "une sortie vide ne produit rien",
    raw: "",
    expect: "",
  },
];

let failures = 0;
for (const { name, raw, expect } of cases) {
  const got = stripTrace(raw);
  if (got === expect) {
    console.log(`  ok   ${name}`);
  } else {
    failures += 1;
    console.error(`  FAIL ${name}`);
    console.error(`       attendu : ${JSON.stringify(expect.slice(0, 90))}`);
    console.error(`       obtenu  : ${JSON.stringify(got.slice(0, 90))}`);
  }
}

// Le workflow doit contenir le meme algorithme : une divergence silencieuse
// laisserait le test vert sur un workflow qui, lui, ne nettoie plus rien.
const workflow = fs.readFileSync(
  path.join(__dirname, "..", "workflows", "factory-review.yml"),
  "utf8",
);
for (const marker of ["stripAnsi", "TOOL.test(bare)", "lines.slice(i).join"]) {
  if (workflow.includes(marker)) {
    console.log(`  ok   le workflow reprend bien « ${marker} »`);
  } else {
    failures += 1;
    console.error(`  FAIL le workflow ne contient plus « ${marker} »`);
  }
}

if (failures) {
  console.error(`\n${failures} ECHEC(S)`);
  process.exit(1);
}
console.log("\n✓ Nettoyage de la trace d'agent : tous les tests passent");
