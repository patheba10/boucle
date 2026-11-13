/* Cours « CI/CD avec GitHub Actions » (étape 3, US-3c #12). Exercices : workflows YAML
   analysés et simulés dans le navigateur (lib/workflow.js). */
import fondamentaux from "./cicd/fondamentaux.js";
import yaml from "./cicd/yaml.js";
import qualite from "./cicd/qualite.js";
import securite from "./cicd/securite.js";
import livrer from "./cicd/livrer.js";
import pro from "./cicd/pro.js";
import web from "./cicd/web.js";

export default {
  id: "cicd", route: "cicd", badge: "CI", name: "CI/CD avec GitHub Actions", tag: "on: push", lang: "yaml",
  blurb: "Concevoir, sécuriser et dépanner des pipelines : intégration continue, livraison et déploiement continus, avec de vrais workflows GitHub Actions vérifiés dans ton navigateur.",
  note: "Les défis analysent ton workflow et simulent des événements (pull request, push sur main, tag, échec d'un job) : tu vois quels jobs tournent, sans compte ni runner. Pour exécuter pour de vrai, chaque chapitre propose une pratique sur ton dépôt d'entraînement.",
  lessons: [...fondamentaux, ...yaml, ...qualite, ...securite, ...livrer, ...web, ...pro]
};
