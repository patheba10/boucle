/* Roadmaps métier */
export default [
{
  id: "devops", name: "DevOps", kicker: "Livrer vite, sans casser",
  intro: "Du terminal Linux à Kubernetes en production : le parcours d'un ingénieur DevOps / plateforme.",
  stages: [
    { title: "Fondations", nodes: [
      { id: "do-linux", title: "Linux et le shell", desc: "Navigation, permissions, processus, services systemd, journaux, SSH. La majorité des serveurs et conteneurs tournent sous Linux.",
        skills: ["bash", "chmod / chown", "ps, top, kill", "systemctl, journalctl", "ssh, scp"], project: "Écrire un script bash qui sauvegarde un dossier, compresse l'archive et supprime celles de plus de 7 jours (avec cron).",
        links: [["Linux Journey", "https://linuxjourney.com/"]] },
      { id: "do-git", title: "Git et collaboration", desc: "Branches, merge vs rebase, résolution de conflits, pull requests, revue de code, conventions de commit.",
        skills: ["branch, merge, rebase", "pull requests", "git log / bisect", ".gitignore"], project: "Publier un dépôt avec une branche protégée et une PR revue avant fusion.",
        links: [["Pro Git (fr)", "https://git-scm.com/book/fr/v2"]] },
      { id: "do-net", title: "Réseau", desc: "Modèle TCP/IP, DNS, HTTP(S), TLS, ports, pare-feu, load balancing. Indispensable pour déboguer une app qui « ne répond pas ».",
        skills: ["TCP/IP, sous-réseaux CIDR", "DNS", "HTTP, codes de statut", "TLS / certificats", "curl, dig, ss"], project: "Diagnostiquer avec curl -v et dig pourquoi un domaine ne répond pas en HTTPS.",
        links: [["MDN : aperçu HTTP", "https://developer.mozilla.org/fr/docs/Web/HTTP/Overview"]] },
      { id: "do-script", title: "Scripting Python", desc: "Automatiser ce qui se répète : appels d'API, parsing de JSON et de logs, petits outils en ligne de commande.",
        skills: ["fonctions", "dictionnaires / JSON", "gestion d'erreurs", "argparse, subprocess"], project: "Un script qui interroge une API, filtre le JSON et écrit un rapport CSV.",
        lessons: ["py-08", "py-09", "py-11"], links: [["Tutoriel Python officiel", "https://docs.python.org/fr/3/tutorial/"]] }
    ]},
    { title: "Construire et livrer", nodes: [
      { id: "do-docker", title: "Conteneurs Docker", desc: "Images, couches, Dockerfile multi-stage, volumes, réseaux, Docker Compose. Images légères et non-root.",
        skills: ["Dockerfile", "multi-stage builds", "docker compose", "registres d'images"], project: "Conteneuriser une API FastAPI + PostgreSQL avec Compose, image finale < 150 Mo.",
        links: [["Docker : bien démarrer", "https://docs.docker.com/get-started/"]] },
      { id: "do-cicd", title: "CI/CD", desc: "Pipelines qui testent, construisent et déploient à chaque push. Cache, matrices, secrets, environnements, déploiement continu.",
        skills: ["GitHub Actions / GitLab CI", "tests automatisés", "build et push d'images", "gestion des secrets"], project: "Pipeline GitHub Actions : lint → tests → build Docker → push vers un registre → déploiement.",
        links: [["GitHub Actions", "https://docs.github.com/fr/actions"]] }
    ]},
    { title: "Infrastructure", nodes: [
      { id: "do-iac", title: "Infrastructure as Code", desc: "Décrire l'infrastructure dans du code versionné : plan, apply, state distant, modules réutilisables.",
        skills: ["Terraform / OpenTofu", "state distant et verrouillage", "modules", "variables et outputs"], project: "Un module Terraform qui crée réseau + VM + bucket, avec state dans un backend distant.",
        links: [["Tutoriels Terraform", "https://developer.hashicorp.com/terraform/tutorials"]] },
      { id: "do-ansible", title: "Gestion de configuration", desc: "Configurer des serveurs de façon reproductible et idempotente.",
        skills: ["Ansible playbooks", "inventaires", "rôles", "idempotence"], project: "Un playbook qui installe Nginx, déploie une config et redémarre le service seulement si elle change.",
        links: [["Documentation Ansible", "https://docs.ansible.com/"]] },
      { id: "do-k8s", title: "Kubernetes", desc: "Orchestration de conteneurs : Pods, Deployments, Services, Ingress, ConfigMaps, Secrets, probes, autoscaling, Helm.",
        skills: ["kubectl", "Deployments, Services", "Ingress", "Helm", "probes et ressources"], project: "Déployer ton API sur un cluster local (kind ou k3s) avec Helm, readiness probe et HPA.",
        links: [["Bases de Kubernetes", "https://kubernetes.io/docs/tutorials/kubernetes-basics/"], ["Helm", "https://helm.sh/docs/"]] }
    ]},
    { title: "Exploitation", nodes: [
      { id: "do-obs", title: "Observabilité", desc: "Métriques, logs et traces pour comprendre un système en production, et des alertes utiles plutôt que bruyantes.",
        skills: ["Prometheus", "Grafana", "logs structurés", "OpenTelemetry"], project: "Instrumenter l'API, exposer /metrics, un tableau Grafana et une alerte sur le taux d'erreurs.",
        links: [["Prometheus", "https://prometheus.io/docs/introduction/overview/"], ["OpenTelemetry", "https://opentelemetry.io/docs/"]] },
      { id: "do-sec", title: "DevSecOps", desc: "Sécurité intégrée au pipeline : scans de dépendances et d'images, secrets hors du code, moindre privilège.",
        skills: ["scan d'images (Trivy)", "gestion des secrets", "moindre privilège", "OWASP Top 10"], project: "Ajouter un scan Trivy au pipeline qui bloque les vulnérabilités critiques.",
        links: [["Trivy", "https://trivy.dev/"], ["OWASP Top 10", "https://owasp.org/www-project-top-ten/"]] },
      { id: "do-sre", title: "Fiabilité (SRE)", desc: "SLI, SLO et budget d'erreur, gestion d'incidents, postmortems sans blâme, réduction du travail manuel.",
        skills: ["SLI / SLO", "budget d'erreur", "runbooks", "postmortems"], project: "Définir 2 SLO pour ton API et un runbook d'incident.",
        links: [["Google SRE Book", "https://sre.google/sre-book/table-of-contents/"]] }
    ]}
  ],
  certs: ["Certified Kubernetes Administrator (CKA)", "HashiCorp Terraform Associate", "AWS Certified DevOps Engineer – Professional"],
  portfolio: "Une app conteneurisée, déployée sur Kubernetes par un pipeline CI/CD, infra en Terraform, avec tableau de bord Grafana. Un README qui explique l'architecture vaut autant que le code."
},
{
  id: "cloud", name: "Cloud", kicker: "Concevoir pour l'échelle",
  intro: "Les services cœur d'un fournisseur cloud, puis l'architecture, la sécurité et les coûts. Exemples AWS, avec les équivalents Azure et GCP.",
  stages: [
    { title: "Concepts", nodes: [
      { id: "cl-concepts", title: "Modèles et vocabulaire", desc: "IaaS, PaaS, SaaS, régions et zones de disponibilité, élasticité, modèle de responsabilité partagée, paiement à l'usage.",
        skills: ["IaaS / PaaS / SaaS", "régions et AZ", "responsabilité partagée", "CapEx vs OpEx"], project: "Comparer sur une page le coût d'une VM 24/7 et d'une fonction serverless pour la même charge.",
        links: [["AWS Skill Builder", "https://skillbuilder.aws/"], ["Microsoft Learn Azure", "https://learn.microsoft.com/fr-fr/training/azure/"]] },
      { id: "cl-iam", title: "Identités et accès (IAM)", desc: "Utilisateurs, rôles, politiques, MFA, moindre privilège. La première chose à bien configurer sur un compte.",
        skills: ["rôles vs utilisateurs", "politiques JSON", "MFA", "moindre privilège"], project: "Un rôle IAM qui ne peut lire qu'un seul bucket, testé avec un accès refusé ailleurs.",
        links: [["AWS IAM", "https://docs.aws.amazon.com/IAM/latest/UserGuide/introduction.html"]] }
    ]},
    { title: "Services cœur", nodes: [
      { id: "cl-compute", title: "Calcul", desc: "Machines virtuelles, conteneurs managés, fonctions serverless. Choisir selon la charge, le démarrage et le coût.",
        skills: ["EC2 / Azure VM / Compute Engine", "Lambda / Azure Functions / Cloud Run", "auto-scaling"], project: "Une fonction serverless déclenchée par l'arrivée d'un fichier dans un bucket.",
        links: [["AWS Lambda", "https://docs.aws.amazon.com/lambda/latest/dg/welcome.html"]] },
      { id: "cl-storage", title: "Stockage et bases de données", desc: "Stockage objet, bloc et fichier ; bases relationnelles managées et NoSQL ; sauvegardes et cycles de vie.",
        skills: ["S3 / Blob Storage / Cloud Storage", "RDS / Cloud SQL", "DynamoDB / Cosmos DB", "politiques de cycle de vie"], project: "Héberger un site statique sur stockage objet derrière un CDN.",
        links: [["Amazon S3", "https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html"]] },
      { id: "cl-network", title: "Réseau cloud", desc: "VPC, sous-réseaux publics et privés, tables de routage, NAT, security groups, load balancers, DNS managé.",
        skills: ["VPC et CIDR", "sous-réseaux public / privé", "security groups", "load balancer"], project: "Un VPC à deux AZ : app en sous-réseau privé, load balancer en public.",
        links: [["Amazon VPC", "https://docs.aws.amazon.com/vpc/latest/userguide/what-is-amazon-vpc.html"]] }
    ]},
    { title: "Architecture", nodes: [
      { id: "cl-archi", title: "Architectures résilientes", desc: "Haute disponibilité multi-AZ, découplage par files de messages, cache, reprise après sinistre (RTO / RPO).",
        skills: ["multi-AZ", "files (SQS, Pub/Sub)", "cache", "RTO / RPO"], project: "Schéma d'architecture d'une app qui survit à la perte d'une zone, avec justification de chaque choix.",
        links: [["AWS Well-Architected", "https://docs.aws.amazon.com/wellarchitected/latest/framework/welcome.html"]] },
      { id: "cl-iac", title: "Déployer par le code", desc: "Toute l'infrastructure cloud décrite en Terraform ou CloudFormation, déployée par pipeline.",
        skills: ["Terraform", "CloudFormation / Bicep", "environnements dev / prod"], project: "Recréer tout ton environnement de zéro avec une seule commande.",
        links: [["Tutoriels Terraform", "https://developer.hashicorp.com/terraform/tutorials"]] }
    ]},
    { title: "Avancé", nodes: [
      { id: "cl-containers", title: "Conteneurs managés", desc: "ECS, EKS, AKS, GKE : faire tourner des conteneurs sans gérer les nœuds soi-même, ou presque.",
        skills: ["EKS / AKS / GKE", "registres (ECR, ACR)", "IAM pour pods"], project: "Déployer la même image sur un service managé et comparer coût et effort avec une VM.",
        links: [["Amazon EKS", "https://docs.aws.amazon.com/eks/latest/userguide/what-is-eks.html"]] },
      { id: "cl-sec", title: "Sécurité cloud", desc: "Chiffrement au repos et en transit, gestion des clés et des secrets, journaux d'audit, détection des menaces.",
        skills: ["KMS", "Secrets Manager / Key Vault", "CloudTrail", "chiffrement"], project: "Activer les journaux d'audit et une alerte sur une connexion root.",
        links: [["AWS Security", "https://docs.aws.amazon.com/security/"]] },
      { id: "cl-finops", title: "FinOps", desc: "Visibilité et maîtrise des coûts : tags, budgets, alertes, instances réservées, arrêt automatique des environnements de dev.",
        skills: ["tags de coûts", "budgets et alertes", "rightsizing", "Savings Plans"], project: "Un budget avec alerte à 80 % et un script qui arrête les VM de dev la nuit.",
        links: [["FinOps Foundation", "https://www.finops.org/introduction/what-is-finops/"]] }
    ]}
  ],
  certs: ["AWS Certified Cloud Practitioner", "AWS Certified Solutions Architect – Associate", "Microsoft Azure Fundamentals (AZ-900)", "Microsoft Azure Administrator (AZ-104)"],
  portfolio: "Une architecture trois tiers déployée en Terraform sur deux zones, avec CDN, base managée, alertes de coûts et un schéma d'architecture dans le README."
},
{
  id: "ml", name: "ML", kicker: "Des données au modèle en production",
  intro: "Les maths utiles, le ML classique, le deep learning, puis le MLOps et les applications LLM.",
  stages: [
    { title: "Maths et outils", nodes: [
      { id: "ml-python", title: "Python pour la data", desc: "Python solide, puis NumPy (calcul vectorisé), pandas (tableaux), matplotlib (graphiques), notebooks Jupyter.",
        skills: ["NumPy", "pandas", "matplotlib", "Jupyter"], project: "Explorer un jeu de données public : nettoyage, statistiques descriptives et 3 graphiques commentés.",
        lessons: ["py-07", "py-08", "py-10"], links: [["NumPy : apprendre", "https://numpy.org/learn/"], ["pandas : démarrer", "https://pandas.pydata.org/docs/getting_started/index.html"]] },
      { id: "ml-maths", title: "Les maths utiles", desc: "Algèbre linéaire (vecteurs, matrices, produit), probabilités et statistiques, dérivées et gradient.",
        skills: ["algèbre linéaire", "probabilités", "statistiques", "gradient"], project: "Coder une régression linéaire par descente de gradient avec NumPy seulement.",
        links: [["3Blue1Brown : algèbre linéaire", "https://www.3blue1brown.com/topics/linear-algebra"]] }
    ]},
    { title: "ML classique", nodes: [
      { id: "ml-supervised", title: "Apprentissage supervisé", desc: "Régression et classification : régression linéaire et logistique, arbres, forêts aléatoires, gradient boosting.",
        skills: ["scikit-learn", "régression / classification", "forêts aléatoires", "XGBoost / LightGBM"], project: "Prédire le défaut de paiement sur un jeu de données de crédit public, comparer 3 modèles.",
        links: [["Guide scikit-learn", "https://scikit-learn.org/stable/user_guide.html"], ["Google ML Crash Course", "https://developers.google.com/machine-learning/crash-course"]] },
      { id: "ml-eval", title: "Évaluation et validation", desc: "Séparation train / test, validation croisée, surapprentissage, métriques adaptées (précision, rappel, F1, AUC), fuite de données.",
        skills: ["validation croisée", "précision / rappel / F1", "ROC AUC", "fuites de données"], project: "Montrer sur un jeu déséquilibré pourquoi l'exactitude seule est trompeuse.",
        links: [["Kaggle Learn", "https://www.kaggle.com/learn"]] },
      { id: "ml-features", title: "Préparation des données", desc: "Valeurs manquantes, encodage, normalisation, pipelines scikit-learn, sélection de variables.",
        skills: ["pipelines", "encodage", "normalisation", "valeurs manquantes"], project: "Un Pipeline scikit-learn qui va des données brutes à la prédiction, sans fuite.",
        links: [["Prétraitement scikit-learn", "https://scikit-learn.org/stable/modules/preprocessing.html"]] }
    ]},
    { title: "Deep learning", nodes: [
      { id: "ml-nn", title: "Réseaux de neurones", desc: "Neurones, couches, fonctions d'activation, rétropropagation, optimiseurs, régularisation.",
        skills: ["PyTorch", "rétropropagation", "optimiseurs", "dropout"], project: "Classer des chiffres manuscrits avec un réseau entraîné en PyTorch.",
        links: [["Tutoriels PyTorch", "https://pytorch.org/tutorials/"]] },
      { id: "ml-arch", title: "CNN et transformers", desc: "Convolutions pour l'image, attention et transformers pour le texte, transfert d'apprentissage et fine-tuning.",
        skills: ["CNN", "attention", "transformers", "fine-tuning"], project: "Fine-tuner un petit modèle pré-entraîné sur une tâche de classification de texte.",
        links: [["Hugging Face Learn", "https://huggingface.co/learn"]] }
    ]},
    { title: "MLOps et LLM", nodes: [
      { id: "ml-ops", title: "MLOps", desc: "Suivi d'expériences, versionnage des données et des modèles, déploiement en API, surveillance de la dérive.",
        skills: ["MLflow", "FastAPI", "Docker", "dérive des données"], project: "Servir ton modèle de crédit derrière une API FastAPI conteneurisée, suivie dans MLflow.",
        links: [["MLflow", "https://mlflow.org/docs/latest/index.html"], ["FastAPI (fr)", "https://fastapi.tiangolo.com/fr/"]] },
      { id: "ml-llm", title: "Applications LLM", desc: "Appels d'API de modèles, RAG (recherche + génération), embeddings, évaluation, agents et outils.",
        skills: ["embeddings", "RAG", "bases vectorielles", "évaluation"], project: "Un assistant RAG qui répond sur une base de documents, avec un jeu de questions d'évaluation.",
        links: [["Hugging Face Learn", "https://huggingface.co/learn"]] }
    ]}
  ],
  certs: ["AWS Certified Machine Learning Engineer – Associate", "Google Cloud Professional Machine Learning Engineer", "Microsoft Azure AI Engineer Associate"],
  portfolio: "Un projet de bout en bout : données brutes → modèle évalué honnêtement → API déployée → suivi en production. Un notebook clair et une démo en ligne comptent beaucoup."
}
];
