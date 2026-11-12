/* Cours « Logique numérique » (étape 7, US-8b #83) : des portes au processeur, simulés en Python pur. */
import combinatoire from "./logique/combinatoire.js";
import sequentielle from "./logique/sequentielle.js";

export default {
  id: "logique", route: "logique", badge: "LN", name: "Logique numérique", tag: "Portes · bascules · ALU", lang: "py",
  blurb: "Ce qui se passe sous le microcontrôleur : bits et portes, algèbre de Boole, Karnaugh, additionneurs et complément à deux, multiplexeurs, bascules, registres, compteurs, machines à états et ALU avec ses drapeaux.",
  note: "Chaque circuit est simulé porte par porte en Python. Pour le câbler à la souris, Logisim-evolution ou CircuitVerse ; pour aller jusqu'à l'ordinateur complet, le cours gratuit Nand to Tetris.",
  lessons: [...combinatoire, ...sequentielle]
};
