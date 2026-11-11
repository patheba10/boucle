/* Cours « Git et GitHub » (étape 3). Exercices dans un terminal Git simulé. */
import bases from "./git/bases.js";
import branches from "./git/branches.js";
import collaborer from "./git/collaborer.js";
import github from "./git/github.js";

export default {
  id: "git", route: "git", badge: "git", name: "Git et GitHub", tag: "$ git", lang: "git",
  blurb: "Versionner, brancher, fusionner, puis collaborer sur GitHub : Git en ligne de commande dans un terminal simulé, avec le graphe des commits sous les yeux.",
  note: "Les exercices tournent dans un terminal Git simulé : tu ne peux rien casser. On vérifie l'état final du dépôt, pas les commandes exactes : plusieurs chemins mènent au bon résultat, comme en vrai.",
  lessons: [...bases, ...branches, ...collaborer, ...github]
};
