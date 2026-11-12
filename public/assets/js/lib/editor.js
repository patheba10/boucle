/* Éditeur de code : <textarea> transparente posée sur un <pre> coloré. */
import { esc, $ } from "./util.js";
import { highlight } from "./highlight.js";

export function editorHTML(id, lang, code) {
  return '<div class="ed" data-ed="' + id + '" data-lang="' + lang + '"><div class="ed-gutter" aria-hidden="true"></div>' +
    '<div class="ed-scroll"><div class="ed-stack"><pre class="ed-hl" aria-hidden="true"></pre>' +
    '<textarea id="' + id + '" aria-label="Éditeur de code ' + ({ py: "Python", cpp: "C++", yaml: "YAML", sh: "Bash" }[lang] || lang) +
    '" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" wrap="off">' + esc(code) + "</textarea></div></div></div>";
}

export function mountEditor(root, onChange, onRun) {
  const ta = $("textarea", root), hl = $(".ed-hl", root), gutter = $(".ed-gutter", root), lang = root.dataset.lang;
  const paint = () => {
    const v = ta.value;
    hl.innerHTML = highlight(v, lang) + "\n ";
    const n = Math.max(v.split("\n").length, 1);
    let g = "";
    for (let i = 1; i <= n; i++) g += i + "\n";
    gutter.textContent = g;
  };
  const insert = (text) => {
    ta.focus();
    if (!document.execCommand || !document.execCommand("insertText", false, text)) {
      ta.setRangeText(text, ta.selectionStart, ta.selectionEnd, "end");
      ta.dispatchEvent(new Event("input"));
    }
  };
  ta.addEventListener("input", () => { paint(); if (onChange) onChange(ta.value); });
  ta.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); if (onRun) onRun(); return; }
    if (e.key === "Tab" && !e.shiftKey) { e.preventDefault(); insert(lang === "yaml" || lang === "sh" ? "  " : "    "); return; }
    if (e.key === "Enter" && !e.shiftKey && !e.altKey) {
      const before = ta.value.slice(0, ta.selectionStart);
      const line = before.slice(before.lastIndexOf("\n") + 1);
      let indent = (/^[ \t]*/.exec(line) || [""])[0];
      const trimmed = line.replace(/\s+$/, "");
      if ((lang === "py" && trimmed.endsWith(":")) || (lang === "cpp" && trimmed.endsWith("{"))) indent += "    ";
      // YAML : on rentre de 2 après « clé: », et on s'aligne sur les clés d'un élément « - ».
      if (lang === "sh" && /(\bthen|\bdo|\{|\belse|\)\s*$)$/.test(trimmed) && !/^\s*#/.test(line)) indent += "  ";
      if (lang === "yaml") { if (/^\s*-\s/.test(line)) indent += "  "; if (/:$/.test(trimmed) || /:\s*[|>][-+]?$/.test(trimmed)) indent += "  "; }
      e.preventDefault();
      insert("\n" + indent);
    }
  });
  paint();
  return { get: () => ta.value, set: (v) => { ta.value = v; paint(); if (onChange) onChange(v); }, el: ta };
}
