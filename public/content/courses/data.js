/* Cours « Python data » : NumPy, puis pandas, visualisation, SciPy, scikit-learn (étape 2). */
import numpy from "./data/numpy.js";
import pandas from "./data/pandas.js";
import viz from "./data/viz.js";

export default {
  id: "data", route: "data", badge: "np", name: "Python data", tag: "import numpy as np", lang: "py",
  blurb: "NumPy, pandas, Matplotlib, SciPy et scikit-learn : les outils de la data science et du ML, avec les vraies bibliothèques dans ton navigateur.",
  note: "Ce cours suppose les bases du cours Python (fonctions, listes, dictionnaires). Le premier lancement charge NumPy (quelques Mo) : compte quelques secondes.",
  lessons: [...numpy, ...pandas, ...viz]
};
