/* Vérification des défis et affichage des résultats. */
import { esc, norm } from "./util.js";
import { runPy, runCpp } from "./engines.js";

export const MARK = "<<<BOUCLE-TESTS>>>";

/** Python : sortie exacte, ou code de test ajouté après le code de l'élève (séparé par un marqueur).
    C++ : chaque test fournit une entrée standard et une sortie attendue. */
export async function check(lang, ch, code, onStatus) {
  if (lang === "py") {
    const userLines = code.split("\n").length;
    if (ch.tests) {
      const r = await runPy(code + "\nprint(" + JSON.stringify(MARK) + ")\n" + ch.tests, "", onStatus);
      const parts = r.out.split(MARK + "\n");
      const got = parts.length > 1 ? parts[1] : "";
      return { ok: !r.err && norm(got) === norm(ch.expected), cases: [{ expected: ch.expected, got }], err: r.err, line: r.line, figs: r.figs, pre: parts[0], userLines };
    }
    const r = await runPy(code, "", onStatus);
    return { ok: !r.err && norm(r.out) === norm(ch.expected), cases: [{ expected: ch.expected, got: r.out }], err: r.err, line: r.line, figs: r.figs, pre: r.out, userLines };
  }
  const cases = [];
  let ok = true, err = null;
  for (const t of ch.tests) {
    const r = await runCpp(code, t.input, onStatus);
    const c = { input: t.input, expected: t.expected, got: r.out, ok: !r.err && norm(r.out) === norm(t.expected) };
    cases.push(c);
    if (!c.ok) ok = false;
    if (r.err) { err = r.err; break; }
  }
  return { ok, cases, err, pre: cases.length ? cases[cases.length - 1].got : "" };
}

export function explainErr(lang, err, line, userLines) {
  if (err === "TimeLimit") {
    return { msg: "Arrêt après " + (lang === "py" ? "20" : "6") + " secondes.", tip: "Boucle infinie ? Vérifie que la condition de ta boucle finit par devenir fausse." };
  }
  if (lang === "py") {
    let where = "";
    if (line && userLines && line > userLines) where = " (pendant les tests : ta fonction a planté)";
    else if (line) where = " (ligne " + line + ")";
    const type = (/^(\w+)/.exec(err) || [])[1] || "";
    const tips = {
      SyntaxError: "Syntaxe : vérifie les deux-points après if/for/def, les parenthèses et les guillemets.",
      IndentationError: "Indentation : chaque bloc doit être décalé de 4 espaces, de façon cohérente.",
      NameError: "Un nom inconnu : faute de frappe, ou variable utilisée avant d'être définie ?",
      TypeError: "Types incompatibles : par exemple additionner un texte et un nombre. str() ou int() peuvent aider.",
      ZeroDivisionError: "Division par zéro.",
      IndexError: "Indice hors de la liste : les indices vont de 0 à len - 1.",
      KeyError: "Clé absente du dictionnaire : .get(cle, defaut) donne une valeur de secours.",
      AttributeError: "Cet objet n'a pas cet attribut ou cette méthode : vérifie le nom et le type de l'objet.",
      ModuleNotFoundError: "Ce module n'est pas disponible dans le navigateur, ou son nom est mal écrit.",
      ValueError: "La valeur n'a pas la bonne forme pour cette opération."
    };
    return { msg: err + where, tip: tips[type] || "" };
  }
  let tip = "";
  if (/cannot find library/.test(err)) tip = "Cette bibliothèque n'est pas disponible dans l'interpréteur du navigateur. Utilise <iostream> (et <cstdio>), ou compile avec g++ sur ta machine.";
  else if (/Parsing Failure/i.test(err)) tip = "Erreur de syntaxe : un point-virgule, une parenthèse ou une accolade manquant près de la position indiquée ?";
  else if (/not defined|undefined/i.test(err)) tip = "Un nom inconnu, ou une fonctionnalité que l'interpréteur pédagogique ne gère pas.";
  return { msg: err, tip };
}

export function consoleHTML(r, lang, userLines) {
  let h = "";
  if (r.out) h += esc(r.out);
  if (r.err) {
    const e = explainErr(lang, r.err, r.line, userLines);
    h += (h && !h.endsWith("\n") ? "\n" : "") + '<span class="err">' + esc(e.msg) + "</span>" + (e.tip ? '\n<span class="dim">→ ' + esc(e.tip) + "</span>" : "");
  }
  for (const f of r.figs || []) h += '<img class="fig" alt="Figure produite par le programme" src="data:image/png;base64,' + f + '">';
  if (!r.out && !r.err && !(r.figs && r.figs.length)) h += '<span class="dim">(aucune sortie)</span>';
  return h;
}

export const statusHTML = (text) => '<span class="dim">' + esc(text) + "</span>";
export const loadFailHTML = (lang, e) =>
  '<span class="err">Impossible de charger l\'interpréteur ' + (lang === "py" ? "Python" : "C++") + ".</span>\n" +
  '<span class="dim">→ Vérifie ta connexion puis réessaie.' + (e && e.message ? " (" + esc(e.message) + ")" : "") + "</span>";
