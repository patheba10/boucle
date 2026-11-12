# Plan de Boucle

Objectif : un parcours complet pour devenir un ingénieur solide et passer les entretiens, en DevOps / Cloud, en ML, ou en embarqué.
On avance étape par étape : chaque étape se termine par un commit, une CI verte et un déploiement.

## Étape 1 — Fondations ✅

- Projet modulaire (`public/` servi tel quel, contenu dans `public/content/`).
- Python réel dans le navigateur (Pyodide 0.29, Python 3.13) dans un Web Worker : paquets chargés à la demande, figures Matplotlib affichées, arrêt des boucles infinies.
- Validation automatique de tout le contenu (`npm run validate`) en local et en CI.
- Audit (`AUDIT.md`) et ce plan.

## Étape 2 — Python pour la data ✅

Livrée en 3 sprints (v0.3.0 à v0.5.0) : 32 leçons dans le cours **Data**, 4 jeux de données réels, un projet portfolio.

Exécutable dans le navigateur avec les vrais paquets.

1. NumPy : tableaux, vectorisation, broadcasting, indexation booléenne, algèbre linéaire, aléatoire reproductible.
2. pandas : Series et DataFrame, lecture CSV, sélection (`loc`, `iloc`), filtres, `groupby`, jointures, dates, valeurs manquantes.
3. Matplotlib : figure et axes, courbes, barres, histogrammes, sous-graphiques, bonnes pratiques de lisibilité.
4. seaborn : graphiques statistiques en une ligne.
5. SciPy : statistiques et tests d'hypothèse, optimisation.
6. scikit-learn : séparation train/test, pipelines, régression, classification, validation croisée, métriques, recherche d'hyperparamètres.
7. Projet guidé : de données brutes à un modèle évalué honnêtement.

Amélioration technique jointe : préchargement de Python, jeux de données embarqués.

## Étape 3 — Git, GitHub et CI/CD ✅

Terminée au sprint 3.3 (version 0.8.0) : cours Git et GitHub en 14 leçons, cours CI/CD en 22 leçons.

Backlog : issues #10, #11 et #12 (milestone « Étape 3 »).

1. **Git en ligne de commande** (#10) : terminal Git simulé dans le navigateur, avec exercices vérifiés sur l'état du dépôt. Au programme : `init`, `add`, `commit`, `log`, `diff`, branches, `merge`, conflits, `rebase`, `stash`, `reset` vs `revert`, remotes et tags.
2. **Collaborer sur GitHub** (#11) : pull requests, revue de code, issues, protections de branche, GitHub Flow vs trunk-based, releases et SemVer, sécurité du compte.
3. **Cours complet CI/CD** (#12), en 12 chapitres :
   - pourquoi la CI/CD et les métriques DORA ;
   - GitHub Actions : workflows, jobs, runners, YAML, expressions et contextes ;
   - tests dans le pipeline ;
   - matrices, cache, artefacts et `needs` ;
   - secrets, permissions, OIDC et sécurité de la chaîne d'approvisionnement ;
   - images Docker et releases ;
   - déploiements : environnements, blue/green, canary, rollback ;
   - Terraform dans le pipeline ;
   - dépannage ;
   - panorama GitLab CI, Jenkins et Azure DevOps ;
   - projet final : pipeline complet pour une API.

Amélioration technique jointe : nouveaux formats d'exercice, « commandes à taper » et « écrire un workflow YAML ».

## Étape 4 — DevOps

Ordre choisi avec Demba : DevOps, puis Cloud (AWS), puis le reste du socle entreprise. Décision d'architecture : [docs/adr/0001-simulateurs-devops.md](docs/adr/0001-simulateurs-devops.md).

1. **Linux et Bash** (#30, terminé au sprint 4.2, version 0.10.0, 21 leçons) : arborescence, fichiers, permissions et utilisateurs, processus et services (systemd, journaux), traitement de texte (grep, sort, cut, sed, awk), pipes et redirections, variables et scripts Bash, réseau (curl, ss, dig), SSH et cron. Terminal Linux simulé (#29) et défis de scripts testés.
2. **Docker et Compose** (#32, terminé au sprint 4.3, version 0.11.0, 12 leçons) : images et couches, Dockerfile (cache, multi-étapes, utilisateur non root), conteneurs, ports, volumes, réseaux, Compose, registres, sécurité des images. Simulateur Docker (#31) et lint de Dockerfile.
3. **Kubernetes** (#34, terminé au sprint 4.4, version 0.12.0, 12 leçons) : architecture, Pods, Deployments et rollouts, Services et Ingress, ConfigMaps et Secrets, sondes, ressources et autoscaling, stockage, RBAC, Helm, dépannage (CrashLoopBackOff, ImagePullBackOff, Pending). Cluster simulé et `kubectl` (#33).
4. **Exploitation** (#35, terminé au sprint 4.5, version 0.13.0, 11 leçons) : observabilité (métriques, logs, traces, Prometheus et PromQL, Grafana, alertes), SRE (SLI, SLO, budget d'erreur, incidents, post-mortems), gestion de configuration avec Ansible.

## Étape 5 — Cloud : AWS et Terraform

1. Terraform (#53, terminé au sprint 5.1, version 0.14.0, 11 leçons) : HCL, providers, ressources, variables et outputs, state distant et verrou, modules, `plan` / `apply`, simulés dans le navigateur.
2. AWS (#55, terminé au sprint 5.2, version 0.15.0, 12 leçons ; CLI `aws`, IAM et joignabilité réseau simulés, #54) : modèle de responsabilité partagée, IAM (évaluateur de politiques JSON), réseau (VPC, sous-réseaux, routage, security groups), calcul (EC2, ECS, EKS, Lambda), stockage et bases (S3, EBS, RDS, DynamoDB), CloudWatch, architectures résilientes, coûts. Exercices de conception, et labs guidés sur le niveau gratuit d'AWS.
3. Préparation aux certifications AWS (#56, terminé au sprint 5.3, version 0.16.0) : banques de questions originales par domaine officiel pour Cloud Practitioner (CLF-C02) et Solutions Architect Associate (SAA-C03), entraînement par domaine et examens blancs chronométrés (moteur réutilisable, #63).

## Étape 5 bis — Socle entreprise : SQL et API

1. SQL (#67, sprint 6.1, 16 leçons) : `SELECT`, filtres, jointures, agrégations, sous-requêtes, fonctions fenêtres, index, transactions. Exécuté pour de vrai (SQLite via Python, dans Pyodide).
2. API REST : HTTP, JSON, codes de statut, authentification, FastAPI.
3. Tests : pytest, tests unitaires vs intégration.
   Points 2 et 3 : cours « API et tests » (#68, sprint 6.2, 11 leçons), FastAPI et pytest exécutés dans le navigateur, défis de tests vérifiés par mutation.

## Étape 6 — Deep learning : TensorFlow et TensorFlow Lite

1. Réseaux de neurones : neurones, activation, perte, descente de gradient (codés à la main avec NumPy pour comprendre). Fait au sprint 7.1 (#73) : cours « Deep learning », chapitres 1 et 2, 9 leçons.
2. TensorFlow et Keras : modèles séquentiels, entraînement, callbacks, CNN, transfert d'apprentissage. Fait au sprint 7.2 (#74) : chapitre « Keras », 6 leçons, exécutées dans le navigateur par minikeras et vérifiées en CI avec le vrai TensorFlow.
3. TensorFlow Lite : conversion, quantification, inférence sur téléphone et Raspberry Pi, TFLite Micro sur microcontrôleur. Fait au sprint 7.3 (#75) : chapitre « TensorFlow Lite », 5 leçons ; la quantification se code en NumPy dans le navigateur, la conversion et l'interpréteur LiteRT sont vérifiés en CI.

TensorFlow ne tourne pas dans Pyodide : les exercices TensorFlow sont validés en CI avec le vrai TensorFlow, et chaque leçon s'ouvre aussi dans Google Colab.

## Étape 7 — Hardware et embarqué

1. Électronique : tension, courant, loi d'Ohm, Kirchhoff, puissance, résistances, diviseurs, condensateurs et circuits RC, inductances, diodes et LED, transistors BJT et MOSFET (commutation), ampli-op, alimentation et régulateurs. Calculateurs interactifs. Fait au sprint 8.1 (#82) : cours « Électronique », 12 leçons ; les calculateurs prennent la forme de défis qui dimensionnent de vrais circuits (valeurs E12, puissances, autonomie), à refaire dans le simulateur Falstad.
2. Logique numérique : portes, algèbre de Boole, bascules, compteurs, machines à états. Fait au sprint 8.2 (#83) : cours « Logique numérique », 10 leçons, des portes à l'ALU et ses drapeaux, simulées en Python pur.
3. Embarqué : C pour microcontrôleur, registres, GPIO, PWM, ADC, interruptions, timers, UART, I2C, SPI, gestion de l'énergie, FreeRTOS. Fait au sprint 8.3 (#84) : cours « C embarqué », 13 leçons, exécutées dans le navigateur par minic (un interpréteur C écrit pour Boucle) sur un microcontrôleur simulé, et compilées par gcc en CI.
4. Outils : multimètre, oscilloscope, datasheets, KiCad, simulateur Wokwi (Arduino, ESP32). Fait au sprint 8.4 (#85) : chapitre « Outils et TinyML » du cours C embarqué (datasheet du BME280, décodage UART d'une capture d'analyseur logique, KiCad et Wokwi).
5. TinyML : un modèle TensorFlow Lite Micro sur ESP32, le pont entre ML et embarqué. Fait au sprint 8.4 (#85) : une couche dense int8 écrite en C comme dans LiteRT for Microcontrollers, reliée au chapitre de quantification du cours de deep learning.

## Étape 8 — Préparation aux entretiens

1. Structures de données et complexité. Fait au sprint 9.1 (#94) : cours « Algorithmique », chapitre 1, 9 leçons ; chaque structure codée à la main et éprouvée sur de grandes entrées.
2. Patterns d'algorithmes : deux pointeurs, fenêtre glissante, hachage, piles, BFS et DFS, tas, programmation dynamique, recherche binaire. Fait au sprint 9.2 (#95) : chapitre 2 du cours « Algorithmique », 11 leçons dont la méthode d'entretien de code.
3. System design : load balancer, cache, base SQL vs NoSQL, files de messages (Kafka, SQS), scalabilité.
4. Entretiens spécifiques : DevOps / SRE, ML, embarqué.
5. Comportemental : méthode STAR, préparer ses histoires de projets.

## Étape 9 — Roadmaps et projets capstone

- Nouvelle roadmap Embarqué. Faite au sprint 8.4 (#85) : roadmap « Embarqué et IoT », 9 étapes reliées aux leçons d'électronique, de logique, de C embarqué et de TinyML.
- Pour chaque roadmap, 2 ou 3 projets capstone de niveau portfolio, avec cahier des charges, jalons et critères de réussite.

## En continu

Les améliorations de `AUDIT.md`, intégrées étape par étape.
