/* Cours « Algorithmique » (étape 8, préparation aux entretiens). Chapitre 1 (US-9a #94) : complexité et structures de
   données, implémentées en Python pur ; chapitre 2 (US-9b #95) : patterns d'algorithmes. */
import structures from "./algo/structures.js";
import patterns from "./algo/patterns.js";

export default {
  id: "algo", route: "algo", badge: "ALG", name: "Algorithmique", tag: "Structures · patterns", lang: "py",
  blurb: "Préparer les entretiens techniques : complexité, tableaux dynamiques, tables de hachage, piles et files, listes chaînées, arbres, tas et graphes, puis les patterns d'algorithmes (hachage, deux pointeurs, fenêtre glissante, recherche binaire, pile monotone, DFS et tri topologique, intervalles, retour sur trace, programmation dynamique).",
  note: "Chaque structure est implémentée par toi, puis éprouvée sur des entrées de 100 000 éléments : une solution de mauvaise complexité dépasse le temps alloué. Annonce toujours la complexité avant de coder, comme en entretien.",
  lessons: [...structures, ...patterns]
};
