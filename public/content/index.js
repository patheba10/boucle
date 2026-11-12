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
import roadmaps from "./roadmaps.js";
import installer from "./guides/installer.js";

export const COURSES = [python, data, git, cicd, linux, docker, kubernetes, exploitation, terraform, aws, cpp];
export const ROADMAPS = roadmaps;
export const INSTALL = installer;
