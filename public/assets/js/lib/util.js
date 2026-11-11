/* Petits utilitaires partagés. */
export const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export const $ = (s, r) => (r || document).querySelector(s);
export const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

/** Code en ligne dans le contenu : @@code@@ → <code>code</code> (échappé). */
export const inl = (html) => html.replace(/@@([\s\S]+?)@@/g, (_, c) => "<code>" + esc(c) + "</code>");

/** Normalise une sortie console pour la comparer : fins de ligne, espaces de fin, lignes vides finales. */
export const norm = (s) => String(s).replace(/\r/g, "").split("\n").map((l) => l.replace(/\s+$/, "")).join("\n").replace(/\n+$/, "");

export const color = (id) => "var(--" + id + ")";

export function dayKey(d) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
export const today = () => dayKey(new Date());

let toastTimer;
export function toast(msg, icon) {
  const t = $("#toast");
  t.innerHTML = (icon || "") + esc(msg);
  t.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("on"), 2200);
}
