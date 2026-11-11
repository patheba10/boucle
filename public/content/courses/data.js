/* Cours « Python data » : NumPy, puis pandas, visualisation, SciPy, scikit-learn (étape 2). */
import numpy from "./data/numpy.js";
import pandas from "./data/pandas.js";
import viz from "./data/viz.js";
import scipy from "./data/scipy.js";
import sklearn from "./data/sklearn.js";
import projet from "./data/projet.js";

export default {
  id: "data", route: "data", badge: "np", name: "Python data", tag: "import numpy as np", lang: "py",
  blurb: "NumPy, pandas, Matplotlib, SciPy et scikit-learn, puis un projet complet pour ton portfolio : les outils de la data science et du ML, avec les vraies bibliothèques dans ton navigateur.",
  note: "Ce cours suppose les bases du cours Python (fonctions, listes, dictionnaires). Le premier lancement charge NumPy (quelques Mo) : compte quelques secondes.",
  lessons: [...numpy, ...pandas, ...viz, ...scipy, ...sklearn, ...projet]
};
