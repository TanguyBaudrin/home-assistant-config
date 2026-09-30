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

const { stripTrace } = require("./strip-agent-trace.cjs");
const ANSI = String.fromCharCode(27);

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
    // Le cas reel de l'issue #9 : `slice(-6000)` avait coupe le debut de la
    // ligne, laissant `. · 100 matches` sans nom d'outil. Sans ce cas, la trace
    // survivait en tete du plan publie.
    name: "une ligne de trace amputee de son debut est retiree",
    raw: ". · 100 matches\n## Plan\n\n**Termine.**",
    expect: "## Plan\n\n**Termine.**",
  },
  {
    // Cas reel de l'issue #9 : un `Read` hors perimetre a laisse une ligne
    // `Error:` suivie du JSON des permissions, au milieu du bloc de trace.
    name: "un refus d'outil est retire",
    raw: [
      "\u001b[0m> factory-review \u00b7 m",
      "Error: The user has specified a rule which prevents you from using this specific tool call. Here are some of the relevant rules [{\"permission\":\"*\"}]",
      "## Plan",
      "",
      "**Termine.**",
    ].join("\n"),
    expect: "## Plan\n\n**Termine.**",
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
for (const workflowName of ["factory-review.yml", "factory-spec.yml"]) {
  const workflow = fs.readFileSync(
    path.join(__dirname, "..", "workflows", workflowName),
    "utf8",
  );
  // Ni trace inline, ni troncature par la fin : les deux ont produit un
  // commentaire illisible sur les runs 36673827000 et 36674475291.
  if (!workflow.includes("stripTrace(")) {
    failures += 1;
    console.error(`  FAIL ${workflowName} n'appelle pas stripTrace()`);
  } else {
    console.log(`  ok   ${workflowName} appelle stripTrace()`);
  }
  // Ni trace inline, ni troncature par la fin. La recherche porte sur le code
  // seul : un `slice(-6000)` cite dans un commentaire n'a rien de suspect, et
  // le confondre avec un vrai troncement rendrait le test bruyant.
  const code = workflow
    .split("\n")
    .filter((l) => !/^\s*(?:#|\/\/)/.test(l))
    .join("\n");
  for (const banned of ["slice(-", "lastIndexOf"]) {
    if (code.includes(banned)) {
      failures += 1;
      console.error(`  FAIL ${workflowName} tronque encore en \`${banned}\``);
    } else {
      console.log(`  ok   ${workflowName} ne tronque pas en \`${banned}\``);
    }
  }
}

if (failures) {
  console.error(`\n${failures} ECHEC(S)`);
  process.exit(1);
}
console.log("\n✓ Nettoyage de la trace d'agent : tous les tests passent");
