/* Cours « Docker et Compose » (étape 4, US-4b #32). Exercices dans le terminal Linux simulé,
   avec le simulateur Docker (lib/docker/) ; chaque chapitre se refait sur une vraie machine. */
import { SNIPPETS } from "./docker/commun.js";
import bases from "./docker/bases.js";
import images from "./docker/images.js";
import reseau from "./docker/reseau.js";
import compose from "./docker/compose.js";
import situations from "./docker/situations.js";

export default {
  id: "docker", route: "docker", badge: "DK", name: "Docker et Compose", tag: "FROM", lang: "sh",
  blurb: "Empaqueter une application dans une image, la lancer, la relier à une base de données et la livrer : Dockerfile, conteneurs, réseaux, volumes, Compose et registres.",
  note: "Le terminal simule une machine Ubuntu avec Docker 27 : les sorties de docker build, docker ps et docker compose sont celles d'une vraie machine, et chaque défi vérifie l'état réel des images et des conteneurs (et répond à curl). Les commandes non simulées le disent clairement.",
  snippetSetup: SNIPPETS,
  lessons: [...bases, ...images, ...reseau, ...compose, ...situations]
};
