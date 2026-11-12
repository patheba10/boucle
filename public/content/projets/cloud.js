/* Projets capstone de la roadmap Cloud (US-10b #107). */
export default [
  {
    id: "pj-web-ha", roadmap: "cloud", titre: "Application web hautement disponible sur AWS", niveau: "Intermédiaire", duree: "3 à 5 semaines",
    resume: "Une application web à trois tiers sur plusieurs zones de disponibilité, entièrement en Terraform, avec un budget mensuel maîtrisé et une reprise après sinistre testée.",
    technos: ["Terraform", "VPC", "ALB", "Auto Scaling", "RDS Multi-AZ", "S3", "CloudFront", "CloudWatch"],
    contexte: `<p>Une PME veut sortir son application d'un unique serveur loué, qui tombe deux fois par an. Elle demande une architecture qui survive à la perte d'une zone de disponibilité, monte en charge seule, coûte un montant prévisible et puisse être recréée dans une autre région en cas de sinistre. C'est l'architecture type de l'examen Solutions Architect, construite pour de vrai.</p>`,
    exigences: [
      "Un VPC sur deux zones de disponibilité : sous-réseaux publics (répartiteur, NAT) et privés (instances, base), tables de routage explicites.",
      "Un Application Load Balancer devant un groupe Auto Scaling (au moins 2 instances, mise à l'échelle sur l'utilisation CPU ou le nombre de requêtes).",
      "Une base RDS PostgreSQL Multi-AZ, chiffrée, dans les sous-réseaux privés, sauvegardes automatiques sur 7 jours.",
      "Les fichiers statiques sur S3 derrière CloudFront, le bucket non public (accès par l'origine CloudFront seulement).",
      "Des security groups en chaîne : Internet → ALB → instances → base, rien d'autre ouvert ; aucun accès SSH (Session Manager à la place).",
      "Tout en Terraform (modules réseau, calcul, données), state distant verrouillé, @@plan@@ relu avant chaque @@apply@@.",
      "Des tableaux de bord et alarmes CloudWatch, et un budget AWS avec alerte.",
      "Un plan de reprise : RTO et RPO écrits, restauration de la base testée dans une autre région."
    ],
    architecture: `            Route 53 ──▶ CloudFront ──▶ S3 (statique, privé)
                │
                ▼
     ALB (sous-réseaux publics, zones a et b)
                │
     Auto Scaling : instances dans les sous-réseaux privés a et b  ──▶ NAT (sortie)
                │
     RDS PostgreSQL Multi-AZ (principale en a, secours en b)
   CloudWatch : tableaux, alarmes ── Budgets : alerte de coût ── Terraform : tout le reste`,
    jalons: [
      { id: "reseau", titre: "Réseau", livrables: ["Module VPC : sous-réseaux, routes, passerelle Internet, NAT", "Schéma réseau dans le README"] },
      { id: "calcul", titre: "Calcul et répartition", livrables: ["ALB, groupe Auto Scaling, modèle de lancement, sondes de santé", "Test de charge qui déclenche la montée en charge"] },
      { id: "donnees", titre: "Données et statique", livrables: ["RDS Multi-AZ chiffrée, sauvegardes", "S3 privé derrière CloudFront"] },
      { id: "securite", titre: "Sécurité et exploitation", livrables: ["Security groups en chaîne, rôles IAM au moindre privilège, Session Manager", "Alarmes CloudWatch et budget avec alerte"] },
      { id: "reprise", titre: "Pannes et reprise", livrables: ["Arrêt d'une instance et bascule de la base testés pendant un test de charge", "Restauration dans une autre région chronométrée, comparée au RTO et au RPO"] }
    ],
    criteres: [
      "L'arrêt d'une instance ou la bascule Multi-AZ ne provoque pas plus de 60 secondes d'erreurs.",
      "Le coût mensuel estimé (AWS Pricing Calculator) est écrit dans le README et le budget alerte à 80 %.",
      "Aucun port ouvert vers Internet en dehors de l'ALB (80 et 443).",
      "@@terraform destroy@@ puis @@terraform apply@@ recrée l'environnement à l'identique."
    ],
    extensions: ["Conteneurs sur ECS Fargate à la place des instances.", "Déploiement bleu-vert avec deux groupes cibles.", "WAF devant CloudFront et l'ALB."],
    lecons: ["aws-04", "aws-08", "aws-12", "tf-08"],
    liens: [["AWS Well-Architected", "https://aws.amazon.com/architecture/well-architected/"], ["AWS Pricing Calculator", "https://calculator.aws/"]]
  },
  {
    id: "pj-serverless", roadmap: "cloud", titre: "Traitement de fichiers événementiel et serverless", niveau: "Intermédiaire", duree: "2 à 3 semaines",
    resume: "Une chaîne sans serveur : un fichier déposé dans S3 déclenche un traitement asynchrone, fiable et idempotent, avec file de messages, réessais et file des messages morts.",
    technos: ["S3", "SQS", "Lambda", "DynamoDB", "API Gateway", "Terraform", "CloudWatch"],
    contexte: `<p>Un service reçoit des milliers de factures PDF ou CSV par jour, à des heures imprévisibles. Il faut les analyser, extraire les montants et exposer le résultat par une API, sans payer de serveurs qui attendent. Le projet met en pratique le découplage par file de messages, l'idempotence et le coût à l'usage.</p>`,
    exigences: [
      "Un dépôt dans un bucket S3 publie un événement dans une file SQS (pas d'appel direct de la fonction).",
      "Une fonction Lambda consomme la file par lots, traite chaque fichier et écrit le résultat dans DynamoDB.",
      "Le traitement est idempotent : retraiter le même fichier ne crée pas de doublon (clé dérivée du contenu ou de l'identifiant d'objet).",
      "Réessais automatiques, puis file des messages morts (DLQ) après 3 échecs, avec alarme CloudWatch sur sa profondeur.",
      "Une API (API Gateway et Lambda) pour consulter le résultat d'un fichier.",
      "Rôles IAM séparés et minimaux pour chaque fonction ; tout en Terraform.",
      "Un test de charge qui dépose 1 000 fichiers et mesure le temps de traitement et le coût."
    ],
    architecture: `client ──▶ S3 (dépôts) ──événement──▶ SQS ──lots──▶ Lambda « analyser » ──▶ DynamoDB
                                        │ 3 échecs
                                        ▼
                                   DLQ ──▶ alarme CloudWatch
   client ──▶ API Gateway ──▶ Lambda « lire » ──▶ DynamoDB`,
    jalons: [
      { id: "chaine", titre: "Chaîne de base", livrables: ["S3 → SQS → Lambda → DynamoDB en Terraform", "Un fichier d'exemple traité de bout en bout"] },
      { id: "fiabilite", titre: "Fiabilité", livrables: ["Idempotence démontrée (même fichier deux fois, un seul résultat)", "DLQ, réessais et alarme ; un fichier corrompu finit dans la DLQ"] },
      { id: "api", titre: "API", livrables: ["Route GET /fichiers/{id}", "Tests automatisés de l'API"] },
      { id: "mesure", titre: "Charge et coût", livrables: ["Test avec 1 000 fichiers : durée totale, erreurs", "Coût mesuré et extrapolé à un mois, dans le README"] }
    ],
    criteres: [
      "1 000 fichiers traités sans perte ni doublon.",
      "Un fichier invalide ne bloque jamais les autres et déclenche une alarme.",
      "Le coût mensuel extrapolé est documenté, avec son calcul.",
      "Aucune fonction n'a de permission au-delà de ce qu'elle utilise."
    ],
    extensions: ["Orchestration des étapes avec Step Functions.", "Extraction de texte par un service d'IA et comparaison des coûts."],
    lecons: ["aws-08", "sd-05", "tf-08"],
    liens: [["AWS Lambda", "https://docs.aws.amazon.com/lambda/"], ["Amazon SQS", "https://docs.aws.amazon.com/sqs/"]]
  }
];
