/* Point d'entrée du contenu : ajouter un cours = l'importer ici. */
import python from "./courses/python.js";
import cpp from "./courses/cpp.js";
import data from "./courses/data.js";
import git from "./courses/git.js";
import cicd from "./courses/cicd.js";
import linux from "./courses/linux.js";
import docker from "./courses/docker.js";
import kubernetes from "./courses/kubernetes.js";
import exploitation from "./courses/exploitation.js";
import terraform from "./courses/terraform.js";
import aws from "./courses/aws.js";
import sql from "./courses/sql.js";
import api from "./courses/api.js";
import dl from "./courses/dl.js";
import elec from "./courses/elec.js";
import logique from "./courses/logique.js";
import embarque from "./courses/embarque.js";
import algo from "./courses/algo.js";
import sysdesign from "./courses/sysdesign.js";
import entretiens from "./courses/entretiens.js";
import roadmaps from "./roadmaps.js";
import installer from "./guides/installer.js";
import { CERTS as certs } from "./certifs/index.js";
import { PROJETS as projets } from "./projets/index.js";
import { EXERCICES } from "./exercices/index.js";

export const COURSES = [python, data, git, cicd, linux, docker, kubernetes, exploitation, terraform, aws, sql, api, dl, elec, logique, embarque, algo, sysdesign, entretiens, cpp];
for (const c of COURSES) for (const l of c.lessons) if (EXERCICES[l.id]) l.exercices = [...(l.exercices || []), ...EXERCICES[l.id]];
/** Ids de leçon cités par les fichiers d'exercices (npm run validate vérifie qu'ils existent). */
export const EXERCICES_IDS = Object.keys(EXERCICES);
export const ROADMAPS = roadmaps;
/* Regroupement des cours par domaine, pour la page Cours et l'accueil (chaque cours dans un seul groupe). */
export const GROUPES = [
  { titre: "Programmer", desc: "Les langages et les bases de l'informatique.", cours: ["py", "cpp", "algo", "api"] },
  { titre: "Données et IA", desc: "Analyser des données, les interroger, entraîner et déployer des modèles.", cours: ["data", "sql", "dl"] },
  { titre: "DevOps et SRE", desc: "Livrer et exploiter : Git, Linux, conteneurs, pipelines, fiabilité.", cours: ["git", "linux", "docker", "kubernetes", "cicd", "exploitation"] },
  { titre: "Cloud et architecture", desc: "L'infrastructure par le code, AWS et la conception de systèmes.", cours: ["terraform", "aws", "sysdesign"] },
  { titre: "Hardware et embarqué", desc: "Du transistor au microcontrôleur.", cours: ["elec", "logique", "embarque"] },
  { titre: "Carrière", desc: "Préparer les entretiens et décrocher le poste.", cours: ["entretiens"] }
];
export const INSTALL = installer;
export const CERTS = certs;
export const PROJETS = projets;
