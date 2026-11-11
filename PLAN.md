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

## Étape 3 — Git, GitHub et CI/CD

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

## Étape 4 — Socle entreprise : SQL, Linux et Bash, API

1. SQL : `SELECT`, filtres, jointures, agrégations, sous-requêtes, fonctions fenêtres, index, transactions. Exécuté pour de vrai (SQLite via Python).
2. Linux et Bash : fichiers, permissions, processus, redirections, pipes, scripts, cron, SSH.
3. API REST : HTTP, JSON, codes de statut, authentification, FastAPI.
4. Tests : pytest, tests unitaires vs intégration.

## Étape 5 — Cloud et DevOps en pratique

1. Docker : images, Dockerfile multi-étapes, Compose.
2. CI/CD : GitHub Actions de bout en bout.
3. Terraform : syntaxe HCL, providers, ressources, variables, state, modules, `plan` / `apply`.
4. AWS : IAM, EC2, S3, VPC, Lambda, RDS, DynamoDB, CloudWatch, ECS et EKS. Exercices de conception, plus des labs guidés sur le niveau gratuit d'AWS.
5. Kubernetes : Pods, Deployments, Services, Ingress, ConfigMaps, Secrets, Helm.
6. Observabilité et sécurité : Prometheus, Grafana, logs, gestion des secrets, moindre privilège.

## Étape 6 — Deep learning : TensorFlow et TensorFlow Lite

1. Réseaux de neurones : neurones, activation, perte, descente de gradient (codés à la main avec NumPy pour comprendre).
2. TensorFlow et Keras : modèles séquentiels, entraînement, callbacks, CNN, transfert d'apprentissage.
3. TensorFlow Lite : conversion, quantification, inférence sur téléphone et Raspberry Pi, TFLite Micro sur microcontrôleur.

TensorFlow ne tourne pas dans Pyodide : les exercices TensorFlow sont validés en CI avec le vrai TensorFlow, et chaque leçon s'ouvre aussi dans Google Colab.

## Étape 7 — Hardware et embarqué

1. Électronique : tension, courant, loi d'Ohm, Kirchhoff, puissance, résistances, diviseurs, condensateurs et circuits RC, inductances, diodes et LED, transistors BJT et MOSFET (commutation), ampli-op, alimentation et régulateurs. Calculateurs interactifs.
2. Logique numérique : portes, algèbre de Boole, bascules, compteurs, machines à états.
3. Embarqué : C pour microcontrôleur, registres, GPIO, PWM, ADC, interruptions, timers, UART, I2C, SPI, gestion de l'énergie, FreeRTOS.
4. Outils : multimètre, oscilloscope, datasheets, KiCad, simulateur Wokwi (Arduino, ESP32).
5. TinyML : un modèle TensorFlow Lite Micro sur ESP32, le pont entre ML et embarqué.

## Étape 8 — Préparation aux entretiens

1. Structures de données et complexité.
2. Patterns d'algorithmes : deux pointeurs, fenêtre glissante, hachage, piles, BFS et DFS, tas, programmation dynamique, recherche binaire.
3. System design : load balancer, cache, base SQL vs NoSQL, files de messages (Kafka, SQS), scalabilité.
4. Entretiens spécifiques : DevOps / SRE, ML, embarqué.
5. Comportemental : méthode STAR, préparer ses histoires de projets.

## Étape 9 — Roadmaps et projets capstone

- Nouvelle roadmap Embarqué.
- Pour chaque roadmap, 2 ou 3 projets capstone de niveau portfolio, avec cahier des charges, jalons et critères de réussite.

## En continu

Les améliorations de `AUDIT.md`, intégrées étape par étape.
