// Separation entre la trace d'execution de la CLI opencode et le rapport de
// l'agent. Partage par factory-review.yml et factory-spec.yml.
//
// La CLI ecrit les deux sur la meme sortie standard : un titre
// `> factory-review · modele`, puis une ligne par appel d'outil
// (`Read automations/...`, `Glob ... 20 matches`), puis le rapport. Au run
// 36673827000 la trace faisait 1189 caracteres sur 3066, soit 38% du commentaire
// publie sur la PR #8.
//
// Cette separation ne peut pas se faire en tronquant sur une taille maximale :
//   - une troncature par la fin coupe le debut d'un plan long, en plein milieu
//     d'une section — c'est ce que faisait `output.slice(-6000)` dans
//     factory-spec.yml, et ce qui a laisse passer la trace sur l'issue #9, la
//     sortie faisant moins de 6000 caracteres et le slice n'etant donc qu'un
//     no-op ;
//   - une troncature par le VERDICT perdrait tout le rapport, le VERDICT etant
//     sa derniere ligne.
//
// On retire donc la trace en tete de sortie, tant qu'on la reconnait, et on
// s'arrete au premier signe de rapport. L'ordre des tests compte : une puce
// Markdown est reconnue AVANT le nom d'outil, sinon une puce de rapport citant
// `Read automations/x.yaml` — ce que fait un relecteur, puisque le rapport cite
// `fichier:ligne` — est supprimee comme si c'etait de la trace.
const ANSI = String.fromCharCode(27);
const ansiRe = new RegExp(`${ANSI}\\[[0-9;]*[A-Za-z]`, "g");

const stripAnsi = (s) => s.replace(ansiRe, "");

const TOOL = /\b(?:Read|Write|Edit|Glob|Grep|List|Bash|WebFetch|Task)\b/;

// Une ligne de trace peut avoir ete coupee en son debut — c'est ce qu'a produit
// `slice(-6000)` sur l'issue #9, ou il ne restait que `. · 100 matches`,
// le nom de l'outil etant tombe avant. Le suffixe `· N matches` suffit alors a
// reconnaitre la ligne : un rapport ne se termine pas par un compte de
// correspondances.
const DANGLING = /·\s*\d+\s+matches?\s*$/;

// Un tool call que la CLI refuse ou ne trouve pas laisse une trace `Error:`
// au milieu du bloc, pas seulement en tete. Ce n'est pas une coupure de ligne
// mais un refus ou un echec de la CLI, qui n'a pas arrete l'agent : sur l'issue
// #9, un `Read` hors perimetre a produit une ligne `Error:` suivie du JSON des
// permissions, et un `Read` de fichier inexistant une ligne `Error: File not
// found:`. L'agent a continue dans les deux cas et a rendu un plan. Un rapport
// ne commence pas par `Error:`, donc le motif se suffit a lui-meme.
const TOOL_ERROR = /^\s*(?:\^)?Error:\s/;

// Un appel d'outil refuse est rendu sur deux lignes : un titre `✗ Invalid
// Tool`, puis le motif sur la ligne suivante, sans glyphe. La seconde ligne
// echapperait donc au test de glyphe et arreterait la lecture. C'est la seule
// ligne de trace qui ne commence pas par un glyphe, et elle est en anglais
// contrairement au rapport, qui est en francais.
const TOOL_REFUSED = /^The arguments provided to the tool are invalid:/;

// Retourne le rapport seul : ni trace, ni refus d'outil, ni codes
// d'echappement, ni lignes vides en tete. Renvoie une chaine vide si la sortie
// ne contenait que de la trace.
function stripTrace(raw) {
  const lines = String(raw ?? "").split("\n");
  let i = 0;
  // `while` et non `for` : la boucle doit pouvoir reconnaitre plusieurs lignes
  // de trace consecutives, y compris les lignes vides qui les separent. Un
  // `for` avec son `i++`double le saut des lignes vides — `i += 1; continue;`
  // avance alors de deux, et le titre du rapport se retrouve saute.
  while (i < lines.length) {
    const bare = stripAnsi(lines[i]);
    if (!bare.trim()) {
      i += 1;
      continue;
    }
    if (/^\s*(?:#{1,6}\s|\*\*VERDICT)/.test(bare)) break;
    if (/^\s*[*+-]\s/.test(bare)) break;
    if (TOOL_ERROR.test(bare) || TOOL_REFUSED.test(bare) || TOOL.test(bare) || DANGLING.test(bare)) {
      i += 1;
      continue;
    }
    if (/^\s*(?:>|→|⇒|✱|✔|✖|✗|·)\s*\S/.test(bare)) {
      i += 1;
      continue;
    }
    break;
  }
  return stripAnsi(lines.slice(i).join("\n")).replace(/^\n+/, "").trim();
}

module.exports = { stripTrace, stripAnsi };
