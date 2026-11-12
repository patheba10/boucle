/* Projets capstone de la roadmap DevOps (US-10a #106). */
export default [
  {
    id: "pj-plateforme", roadmap: "devops", titre: "Plateforme de déploiement d'une API", niveau: "Intermédiaire", duree: "4 à 6 semaines",
    resume: "Une API conteneurisée, testée et déployée automatiquement sur Kubernetes, avec infrastructure en Terraform et tableau de bord de supervision.",
    technos: ["FastAPI", "Docker", "GitHub Actions", "Kubernetes", "Helm", "Terraform", "Prometheus", "Grafana"],
    contexte: `<p>Une petite équipe produit veut livrer son API plusieurs fois par jour sans incident. Tu construis toute la chaîne : du commit à la production, avec la possibilité de revenir en arrière en une commande et de voir immédiatement si une version se comporte mal. C'est le projet qui montre en une fois Linux, conteneurs, CI/CD, IaC, Kubernetes et observabilité.</p>`,
    exigences: [
      "Une API REST (FastAPI) avec au moins trois routes, une base PostgreSQL et des tests pytest (couverture d'au moins 80 %).",
      "Une image Docker multi-étapes, non root, de moins de 200 Mo, scannée (Trivy) sans vulnérabilité critique.",
      "Un pipeline GitHub Actions : lint, tests, construction de l'image étiquetée par le SHA du commit, scan, publication, déploiement.",
      "Un cluster Kubernetes (kind ou minikube en local, ou EKS), l'application déployée par un chart Helm avec sondes de vivacité et de disponibilité, requêtes et limites de ressources.",
      "L'infrastructure (registre, cluster ou machines, base) décrite en Terraform, state distant verrouillé.",
      "Des métriques Prometheus exposées par l'API (/metrics) et un tableau Grafana : trafic, erreurs, latence au 95e centile.",
      "Une alerte sur un SLO (par exemple 99 % des requêtes en moins de 300 ms sur 30 jours) et un runbook d'incident.",
      "Un retour arrière documenté et testé (helm rollback ou redéploiement de l'image précédente)."
    ],
    architecture: `développeur ──push──▶ GitHub ──▶ Actions : lint → tests → build → scan → push image (tag = SHA)
                                                                 │
                                                                 ▼ helm upgrade
   utilisateurs ──▶ Ingress ──▶ Service ──▶ Deployment api (3 réplicas, sondes, limites)
                                                 │                 │
                                                 ▼                 ▼ /metrics
                                            PostgreSQL        Prometheus ──▶ Grafana, alertes
   Terraform : réseau, cluster, base, registre (state distant + verrou)`,
    jalons: [
      { id: "api", titre: "API et tests", livrables: ["Routes, modèle de données et migrations", "Tests pytest et couverture ≥ 80 % dans la CI", "README : lancer le projet en une commande (@@docker compose up@@)"] },
      { id: "image", titre: "Image et pipeline", livrables: ["Dockerfile multi-étapes, utilisateur non root", "Workflow : lint, tests, build, scan Trivy, push sur le registre", "Image étiquetée par le SHA du commit, jamais @@latest@@ en production"] },
      { id: "k8s", titre: "Déploiement Kubernetes", livrables: ["Chart Helm : Deployment, Service, Ingress, ConfigMap, Secret", "Sondes et ressources réglées, 3 réplicas, mise à jour progressive sans coupure", "Déploiement automatique depuis la branche principale"] },
      { id: "iac", titre: "Infrastructure as code", livrables: ["Modules Terraform, variables par environnement", "State distant avec verrou ; @@terraform plan@@ publié dans les pull requests", "Tout se détruit et se recrée en une commande"] },
      { id: "obs", titre: "Observabilité et fiabilité", livrables: ["/metrics, tableau Grafana des quatre signaux d'or", "Une alerte sur le SLO, un runbook, un postmortem d'un incident provoqué volontairement", "Retour arrière testé et chronométré"] }
    ],
    criteres: [
      "Un commit sur la branche principale arrive en production en moins de 15 minutes, sans intervention manuelle.",
      "Un retour arrière prend moins de 5 minutes et est décrit dans le README.",
      "Le pipeline échoue si les tests, le lint ou le scan échouent.",
      "Aucun secret dans le dépôt ; les secrets viennent du gestionnaire de secrets ou de variables chiffrées.",
      "Un inconnu peut cloner le dépôt et tout reproduire en suivant le README."
    ],
    extensions: ["GitOps avec Argo CD au lieu d'un déploiement poussé par la CI.", "Déploiement canary avec analyse automatique des métriques.", "Environnements de prévisualisation par pull request."],
    lecons: ["dk-06", "ci-11", "k8s-07", "tf-08", "ex-06"],
    liens: [["Documentation Helm", "https://helm.sh/docs/"], ["Prometheus", "https://prometheus.io/docs/introduction/overview/"]]
  },
  {
    id: "pj-incidents", roadmap: "devops", titre: "Laboratoire d'incidents et d'astreinte", niveau: "Avancé", duree: "3 à 4 semaines",
    resume: "Un système volontairement fragile, des pannes injectées, et toute la boucle SRE : détection, astreinte, diagnostic, postmortem, correction durable.",
    technos: ["Docker Compose", "Prometheus", "Alertmanager", "Grafana", "Loki", "k6", "chaos"],
    contexte: `<p>Les recruteurs SRE demandent « raconte-moi un incident ». Ce projet t'en donne cinq, documentés. Tu montes un petit système à plusieurs services, tu le mets sous charge, puis tu provoques des pannes réalistes et tu les traites comme en production : alerte, diagnostic, rétablissement, postmortem, correctif.</p>`,
    exigences: [
      "Trois services au moins (une API, un worker, une base ou un cache) orchestrés par Docker Compose ou Kubernetes.",
      "Des métriques (Prometheus), des journaux centralisés (Loki ou équivalent) et un tableau de bord par service.",
      "Des SLO écrits pour deux parcours utilisateurs, et des alertes sur la consommation du budget d'erreur (Alertmanager).",
      "Un générateur de charge (k6 ou Locust) qui reproduit un trafic réaliste avec pics.",
      "Cinq scénarios de panne injectés et reproductibles : base saturée, fuite mémoire, disque plein, dépendance lente, mauvaise configuration déployée.",
      "Pour chaque scénario : chronologie, détection, diagnostic, rétablissement, postmortem sans blâme et action corrective livrée."
    ],
    architecture: `k6 (charge) ──▶ API ──▶ worker ──▶ file ──▶ base / cache
                 │         │                 │
                 └── métriques, journaux ────┴──▶ Prometheus, Loki ──▶ Grafana
                                                   │
                                          Alertmanager ──▶ notification (e-mail, webhook)
   scripts/chaos/ : un script par panne, reproductible`,
    jalons: [
      { id: "systeme", titre: "Système et charge", livrables: ["Services et Compose (ou manifestes Kubernetes)", "Scénario de charge k6 avec pics, résultats de référence"] },
      { id: "observer", titre: "Observer", livrables: ["Métriques, journaux et tableaux de bord", "SLO écrits et alertes sur le budget d'erreur"] },
      { id: "pannes", titre: "Injecter les pannes", livrables: ["Cinq scripts de panne reproductibles", "Pour chacun, l'alerte qui doit se déclencher"] },
      { id: "postmortems", titre: "Postmortems et correctifs", livrables: ["Cinq postmortems sans blâme (chronologie, impact, causes, actions)", "Les actions correctives livrées, et la panne rejouée pour prouver qu'elle est corrigée"] }
    ],
    criteres: [
      "Chaque panne déclenche une alerte en moins de 5 minutes, sans faux positif sous charge normale.",
      "Chaque postmortem a au moins une action corrective livrée et vérifiée.",
      "Le README permet de rejouer n'importe quel incident en une commande.",
      "Tu peux raconter chaque incident en méthode STAR en deux minutes."
    ],
    extensions: ["Automatiser une partie de la remédiation (redémarrage, bascule) et en mesurer l'effet.", "Ajouter le traçage distribué avec OpenTelemetry."],
    lecons: ["ex-02", "ex-06", "ex-10", "ex-11"],
    liens: [["Google SRE Book", "https://sre.google/sre-book/table-of-contents/"], ["k6", "https://grafana.com/docs/k6/latest/"]]
  }
];
