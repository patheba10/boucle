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

export const COURSES = [python, data, git, cicd, linux, docker, kubernetes, exploitation, terraform, aws, sql, api, dl, elec, logique, embarque, algo, sysdesign, entretiens, cpp];
export const ROADMAPS = roadmaps;
export const INSTALL = installer;
export const CERTS = certs;
