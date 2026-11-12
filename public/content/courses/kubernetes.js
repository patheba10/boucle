/* Cours « Kubernetes » (étape 4, US-4c #34). Exercices dans le terminal Linux simulé avec un cluster
   kind d'un nœud (lib/k8s/) ; chaque chapitre se refait sur une vraie machine avec kind. */
import bases from "./kubernetes/bases.js";
import exploiter from "./kubernetes/exploiter.js";
import production from "./kubernetes/production.js";
import avance from "./kubernetes/avance.js";

export default {
  id: "kubernetes", route: "kubernetes", badge: "K8", name: "Kubernetes", tag: "kubectl", lang: "sh",
  blurb: "Faire tourner des conteneurs en production : Pods, Deployments, Services, configuration et secrets, sondes, mises à jour sans coupure et dépannage, avec kubectl.",
  note: "Le terminal est relié à un cluster kind simulé d'un nœud (Kubernetes 1.31) : kubectl valide les manifests comme l'API server, les contrôleurs réconcilient l'état, et les pannes (CrashLoopBackOff, ImagePullBackOff, Pending) se produisent pour de vrai. Chaque défi vérifie l'état du cluster.",
  snippetSetup: { docker: { images: ["nginx:1.27-alpine", "alpine:3.20"] }, k8s: { images: ["nginx:1.27-alpine", "alpine:3.20"] } },
  lessons: [...bases, ...exploiter, ...production, ...avance]
};
