/* Indices progressifs (audit #7) : un défi peut fournir `hints` (une liste, du plus général au plus précis) ;
   sinon son `hint` est découpé en phrases, révélées une par une. Le code entre @@ @@ n'est jamais coupé. */

export function indicesDe(ch) {
  if (Array.isArray(ch.hints) && ch.hints.length) return ch.hints.slice();
  if (!ch.hint) return [];
  const codes = [];
  const protege = ch.hint.replace(/@@[\s\S]+?@@/g, (m) => "\u0000" + (codes.push(m) - 1) + "\u0000");
  const phrases = protege.split(/(?<=[.!?:])\s+(?=[A-ZÀÂÉÈÊÎÔÙÛÇ«"(\u0000])/u)
    .map((p) => p.replace(/\u0000(\d+)\u0000/g, (_, i) => codes[+i]).trim()).filter(Boolean);
  // Une phrase très courte (« Pour la racine : ») s'accroche à la suivante.
  const out = [];
  for (const p of phrases) {
    if (out.length && out[out.length - 1].length < 25) out[out.length - 1] += " " + p;
    else out.push(p);
  }
  return out;
}

/** HTML des k premiers indices. */
export function indicesHTML(indices, k, inl, esc) {
  return '<div class="hint-box">' + indices.slice(0, k).map((t, i) => "<p><b>Indice " + (i + 1) + (indices.length > 1 ? " / " + indices.length : "") + ".</b> " + inl(esc(t)) + "</p>").join("") + "</div>";
}

/** Libellé du bouton après k indices révélés. */
export function libelleIndice(indices, k) {
  if (indices.length <= 1) return "Indice";
  return k < indices.length ? (k ? "Indice suivant (" + (k + 1) + " / " + indices.length + ")" : "Indice (1 / " + indices.length + ")") : "Indices (" + indices.length + " / " + indices.length + ")";
}
