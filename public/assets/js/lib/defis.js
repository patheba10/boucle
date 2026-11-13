/* Défis gradués (audit #2) : en plus du défi principal, une leçon peut proposer `defis`, des défis supplémentaires
   au même format, chacun avec un `niveau` (facile, moyen, entretien ; un seul défi par niveau). Ils s'affichent en
   onglets, ont leur propre code sauvegardé et leur propre progression (L.defis[niveau] : la clé reste stable si
   l'on ajoute un défi), et rapportent des XP selon leur niveau. Ils restent
   facultatifs : la leçon est terminée avec son quiz et son défi principal. Fonctions pures, testées dans
   tests/unit/defis.test.mjs. */

export const NIVEAUX = {
  facile: { nom: "Facile", xp: 10 },
  moyen: { nom: "Moyen", xp: 20 },
  entretien: { nom: "Entretien", xp: 30 }
};
/** Langages dont les défis supplémentaires sont gérés (éditeur, exécution, vérification par sortie). */
export const LANGS_DEFIS = ["py", "c", "cpp", "sql"];

/** Le défi principal (indice 0) suivi des défis supplémentaires, du plus facile au plus difficile. */
export function defisDe(l) {
  if (!l.challenge) return [];
  const ordre = Object.keys(NIVEAUX);
  const extra = (l.defis || []).map((d, i) => ({ d, i })).sort((a, b) => ordre.indexOf(a.d.niveau) - ordre.indexOf(b.d.niveau) || a.i - b.i).map((x) => x.d);
  return [l.challenge, ...extra];
}

/* Le défi principal n'a pas de niveau : il garde ses champs d'origine (L.ch, L.sol, S.code[l.id]). */
export const defiFait = (L, ch) => (ch.niveau ? !!(L.defis && L.defis[ch.niveau]) : !!L.ch);
export const solutionVue = (L, ch) => (ch.niveau ? !!(L.solD && L.solD[ch.niveau]) : !!L.sol);
/** Clé du code sauvegardé (S.code). */
export const cleCode = (l, ch) => (ch.niveau ? l.id + "~" + ch.niveau : l.id);

/** XP d'un défi réussi : 60 % de la leçon pour le principal, selon le niveau pour les autres ; moitié si la solution a été vue. */
export function xpDefi(l, ch, solVue) {
  const base = ch.niveau ? NIVEAUX[ch.niveau].xp : Math.round(l.xp * 0.6);
  return Math.round(base * (solVue ? 0.5 : 1));
}

/** Marque le défi réussi ; renvoie true si c'est la première fois. */
export function marquerFait(L, ch) {
  if (defiFait(L, ch)) return false;
  if (ch.niveau) (L.defis = L.defis || {})[ch.niveau] = true;
  else L.ch = true;
  return true;
}
export function marquerSolution(L, ch) {
  if (ch.niveau) (L.solD = L.solD || {})[ch.niveau] = true;
  else L.sol = true;
}

export const libelleDefi = (ch) => (ch.niveau ? NIVEAUX[ch.niveau].nom : "Défi");

/** Onglets (seulement s'il y a des défis supplémentaires). */
export function ongletsHTML(defis, L, actif, coche) {
  if (defis.length < 2) return "";
  return '<div class="onglets" role="tablist" aria-label="Défis de la leçon">' + defis.map((ch, k) =>
    '<button type="button" role="tab" class="onglet' + (k === actif ? " actif" : "") + (defiFait(L, ch) ? " fait" : "") + '" data-defi="' + k + '" aria-selected="' + (k === actif) + '">' +
      (defiFait(L, ch) ? coche : "") + libelleDefi(ch) + "</button>").join("") + "</div>";
}
