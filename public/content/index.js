/* Point d'entrée du contenu : ajouter un cours = l'importer ici. */
import python from "./courses/python.js";
import cpp from "./courses/cpp.js";
import data from "./courses/data.js";
import roadmaps from "./roadmaps.js";
import installer from "./guides/installer.js";

export const COURSES = [python, data, cpp];
export const ROADMAPS = roadmaps;
export const INSTALL = installer;
