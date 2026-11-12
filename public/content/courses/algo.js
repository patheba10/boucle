/* Cours « Algorithmique » (étape 8, préparation aux entretiens). Chapitre 1 (US-9a #94) : complexité et structures de
   données, implémentées en Python pur. */
import structures from "./algo/structures.js";

export default {
  id: "algo", route: "algo", badge: "ALG", name: "Algorithmique", tag: "Structures · patterns", lang: "py",
  blurb: "Préparer les entretiens techniques : complexité, tableaux dynamiques, tables de hachage, piles et files, listes chaînées, arbres, tas et graphes, codés à la main et testés sur de grandes entrées.",
  note: "Chaque structure est implémentée par toi, puis éprouvée sur des entrées de 100 000 éléments : une solution de mauvaise complexité dépasse le temps alloué. Annonce toujours la complexité avant de coder, comme en entretien.",
  lessons: [...structures]
};
