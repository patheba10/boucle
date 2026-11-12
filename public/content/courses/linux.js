/* Cours « Linux et Bash » (étape 4, US-4a #30). Exercices dans un terminal Linux simulé
   (lib/shell/) ; chaque chapitre se refait aussi sur une vraie machine (WSL ou Ubuntu). */
import bases from "./linux/bases.js";
import droits from "./linux/droits.js";
import texte from "./linux/texte.js";
import systeme from "./linux/systeme.js";
import scripts from "./linux/scripts.js";
import reseau from "./linux/reseau.js";
import situations from "./linux/situations.js";

export default {
  id: "linux", route: "linux", badge: "SH", name: "Linux et Bash", tag: "$ _", lang: "sh",
  blurb: "Administrer un serveur au clavier : fichiers, droits, utilisateurs, traitement de texte, pipes, services et scripts Bash, dans un terminal Linux simulé.",
  note: "Le terminal simule une machine Ubuntu 24.04 : les commandes et leurs messages sont ceux d'un vrai serveur, et chaque défi vérifie l'état de la machine (fichiers, droits, services) ou ce que ta dernière commande affiche. Les commandes qui ne sont pas simulées le disent clairement.",
  lessons: [...bases, ...droits, ...texte, ...systeme, ...scripts, ...reseau, ...situations]
};
