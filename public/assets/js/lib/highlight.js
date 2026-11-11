/* Coloration syntaxique légère pour Python, C++ et YAML (sortie HTML échappée). */
import { esc } from "./util.js";

const KW = {
  py: "False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield",
  cpp: "auto break case catch class const continue default delete do else enum false for friend if inline namespace new nullptr operator private protected public return sizeof static struct switch template this throw true try typedef typename using virtual void while"
};
const BUILTIN = {
  py: "print len range int float str bool list dict set tuple sum min max sorted abs round input type enumerate zip map filter isinstance open self np pd plt",
  cpp: "int double float char bool long short unsigned signed string vector cout cin endl std main printf size_t"
};
const kw = {}, bi = {};
for (const l of ["py", "cpp"]) { kw[l] = new Set(KW[l].split(" ")); bi[l] = new Set(BUILTIN[l].split(" ")); }

const RX = {
  py: /(#[^\n]*)|([rRbBfF]{0,2}"""[\s\S]*?(?:"""|$)|[rRbBfF]{0,2}'''[\s\S]*?(?:'''|$)|[rRbBfF]{0,2}"(?:\\.|[^"\\\n])*"?|[rRbBfF]{0,2}'(?:\\.|[^'\\\n])*'?)|(\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b)|([A-Za-z_]\w*)/g,
  cpp: /(\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$))|(^[ \t]*#[^\n]*)|("(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?)|(\b\d+(?:\.\d+)?[fFlLuU]?\b)|([A-Za-z_]\w*)/gm
};

/* YAML : commentaires, expressions ${{ }}, chaînes, clés, booléens et nombres. */
const YAML = /((?:^|(?<=\s))#[^\n]*)|(\$\{\{[\s\S]*?\}\})|("(?:\\.|[^"\\\n])*"?|'(?:''|[^'\n])*'?)|((?<=^[ \t]*(?:- +)*)[\w.\-/"']+(?=[ \t]*:(?:[ \t]|$)))|(\b(?:true|false|null)\b|(?<![\w.])\d+(?:\.\d+)?(?![\w.]))/gm;
const YAML_CLS = [null, "com", "pre", "str", "kw", "num"];
function highlightYaml(code) {
  YAML.lastIndex = 0;
  let out = "", last = 0, m;
  while ((m = YAML.exec(code))) {
    if (m[0] === "") { YAML.lastIndex++; continue; }
    out += esc(code.slice(last, m.index)); last = YAML.lastIndex;
    const g = m.findIndex((x, i) => i > 0 && x !== undefined);
    out += '<span class="tk-' + YAML_CLS[g] + '">' + esc(m[0]) + "</span>";
  }
  return out + esc(code.slice(last));
}

export function highlight(code, lang) {
  if (lang === "yaml") return highlightYaml(code);
  const rx = RX[lang];
  if (!rx) return esc(code);
  rx.lastIndex = 0;
  let out = "", last = 0, m;
  while ((m = rx.exec(code))) {
    if (m[0] === "") { rx.lastIndex++; continue; }
    out += esc(code.slice(last, m.index));
    last = rx.lastIndex;
    const t = m[0];
    let cls = null;
    const ident = lang === "py" ? m[4] : m[5];
    if (m[1]) cls = "com";
    else if (lang === "py" && m[2]) cls = "str";
    else if (lang === "py" && m[3]) cls = "num";
    else if (lang === "cpp" && m[2]) cls = "pre";
    else if (lang === "cpp" && m[3]) cls = "str";
    else if (lang === "cpp" && m[4]) cls = "num";
    else if (ident) {
      if (kw[lang].has(t)) cls = "kw";
      else if (bi[lang].has(t) || code[rx.lastIndex] === "(") cls = "fn";
    }
    out += cls ? '<span class="tk-' + cls + '">' + esc(t) + "</span>" : esc(t);
  }
  return out + esc(code.slice(last));
}
