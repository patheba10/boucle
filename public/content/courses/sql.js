/* Cours « SQL » (étape 5 bis, US-6a #67). Les requêtes tournent dans un vrai SQLite (module sqlite3 de Python,
   dans Pyodide au navigateur, dans CPython pour npm run validate), sur la base « boutique » recréée à chaque exécution. */
import { BOUTIQUE } from "./sql/base.js";
import bases from "./sql/bases.js";
import combiner from "./sql/combiner.js";
import analyser from "./sql/analyser.js";
import ecrire from "./sql/ecrire.js";

export default {
  id: "sql", route: "sql", badge: "SQL", name: "SQL", tag: "SQLite", lang: "sql",
  blurb: "Interroger et modifier une base relationnelle : SELECT et filtres, jointures, agrégats, sous-requêtes, fonctions fenêtres, transactions, schéma, index et questions d'entretien.",
  note: "Chaque requête tourne dans un vrai SQLite, sur la base d'une boutique en ligne recréée à chaque exécution : tu peux tout modifier sans rien casser. Un défi compare ton résultat à celui de la requête de référence.",
  db: BOUTIQUE,
  lessons: [...bases, ...combiner, ...analyser, ...ecrire]
};
