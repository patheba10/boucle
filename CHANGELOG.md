# Changelog

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/). Versions [SemVer](https://semver.org/lang/fr/).

## [Non publié]

## [0.17.0] — 2026-11-12

Sprint 6.1 : cours **SQL** (16 leçons), exécuté dans un vrai SQLite.

### Ajouté
- Cours **SQL** en 16 leçons sur la base d'une boutique en ligne : SELECT, WHERE, tri et limites, NULL, jointures internes et externes, GROUP BY et HAVING, sous-requêtes et CTE, fonctions fenêtres, CASE et dates, auto-jointures et CTE récursives, INSERT, UPDATE, DELETE et transactions, schéma et contraintes, index et plan d'exécution, dix questions d'entretien (#67).
- Moteur SQL : les requêtes tournent dans un vrai SQLite au navigateur, avec erreurs expliquées et comparaison au résultat de référence ; coloration SQL.

## [0.16.0] — 2026-11-12

Sprint 5.3 : moteur d'examens blancs et préparation aux certifications AWS. L'étape 5 (cloud) est terminée : Terraform, AWS, certifications.

### Ajouté
- Préparation aux certifications AWS : 69 questions pour Cloud Practitioner (CLF-C02) et 68 pour Solutions Architect Associate (SAA-C03), originales et classées par domaine officiel, avec explications ; entraînement par domaine et examens blancs complets ou courts (#56).
- Moteur d'examens blancs : tirage pondéré par domaine, chronomètre, marques pour revoir, reprise après rechargement, score et détail par domaine, revue des erreurs (#63).

## [0.15.0] — 2026-11-12

Sprint 5.2 : CLI `aws` simulée, cours **AWS** (12 leçons).

### Ajouté
- Cours **AWS** en 12 leçons : régions et responsabilité partagée, IAM et moindre privilège, diagnostic d'un AccessDenied, VPC et routage, security groups, EC2, ECS, EKS et Lambda, S3 et sa protection, RDS, DynamoDB et disques, CloudWatch et architectures résilientes, coûts, douze questions d'entretien. Chaque leçon propose aussi un lab sur un vrai compte (#55).
- CLI `aws` v2 dans le terminal, sur le même compte simulé que Terraform : `sts`, `s3`, `s3api`, `ec2`, `iam`, `rds`, sorties JSON, `--query` (JMESPath), `--output text|table`, profils, refus d'accès décidés par une évaluation IAM fidèle, joignabilité réseau d'une instance vérifiée par `curl` (#54).
- Coloration JSON dans l'éditeur et la théorie.

## [0.14.0] — 2026-11-12

Sprint 5.1 : Terraform et compte AWS simulés, cours **Terraform** (11 leçons).

### Ajouté
- Cours **Terraform** en 11 leçons : infrastructure as code, providers et ressources AWS, lire un plan (modification ou remplacement), variables, locals et outputs, réseau et dépendances, `count` et `for_each`, modules, état distant S3 et verrou, import et dérive, Terraform en équipe et en CI, dix questions d'entretien (#53).
- Terraform 1.9 et un compte AWS simulés dans le terminal : HCL, `init`, `validate`, `fmt`, `plan`, `apply`, `destroy`, `output`, `state`, `import`, backend S3 avec verrou, dérive (#52).

## [0.13.0] — 2026-11-12

Sprint 4.5 : simulateurs Prometheus et Ansible, cours **Exploitation et SRE** (11 leçons). L'étape 4 (DevOps) est terminée : Linux, Docker, Kubernetes, exploitation.

### Ajouté
- Cours **Exploitation et SRE** en 11 leçons : métriques, journaux et traces, PromQL (sélecteurs, `rate`, agrégations, taux d'erreurs, p95), alertes Prometheus, tableaux de bord et saturation, SLI, SLO et budget d'erreur (en Python), incidents et post-mortems, Ansible (inventaire, ad hoc, playbooks, gabarits et handlers), dix questions d'entretien (#35).
- Simulateurs Prometheus (PromQL, règles, alertes, `promtool`) et Ansible (`ansible-playbook`, `ansible`, idempotence, `--check --diff`) dans le terminal (#48).

## [0.12.0] — 2026-11-12

Sprint 4.4 : cluster Kubernetes simulé et cours **Kubernetes** (12 leçons).

### Ajouté
- Cours **Kubernetes** en 12 leçons : architecture et Pods, Deployments, Services et DNS, mises à jour et retours arrière, ConfigMaps et Secrets, sondes et ressources, dépannage (ImagePullBackOff, CrashLoopBackOff, CreateContainerConfigError, Pending), Ingress, base de données avec PVC, autoscaling, RBAC et Helm, dix questions d'entretien (#34).
- Cluster Kubernetes simulé et `kubectl` dans le terminal : validation des manifests, réconciliation, déploiements progressifs, pannes réalistes, Services, DNS, `port-forward`, Ingress, HPA, RBAC, panneau des Pods (#33).
- Terminal : `base64`, `kubectl top`, `kubectl autoscale`, noms en `.localhost`.

## [0.11.0] — 2026-11-12

Sprint 4.3 : simulateur Docker et cours **Docker et Compose** (12 leçons).

### Ajouté
- Cours **Docker et Compose** en 12 leçons : conteneurs et cycle de vie, images et couches, Dockerfile, cache et `.dockerignore`, images légères et sûres (non root, sans secret, hadolint, multi-étapes), réseaux, volumes et montages, Compose avec `healthcheck`, registres et CI, un incident à trois pannes et dix questions d'entretien (#32).
- Simulateur Docker dans le terminal Linux : construction avec cache, BuildKit et hadolint, conteneurs, ports, réseaux et DNS, volumes, registre, Compose v2, panneau des conteneurs (#31).
- Défis « fichier » : un Dockerfile ou un `compose.yaml` écrit dans l'éditeur, testé par une suite de commandes ; coloration des Dockerfile ; extraits de théorie avec une mise en place (`snippetSetup`).

## [0.10.0] — 2026-11-11

Sprint 4.2 : le cours **Linux et Bash** est complet (21 leçons en 10 chapitres, avec des mises en situation et des questions d'entretien).

### Ajouté
- Cours **Linux et Bash**, chapitres 6 à 10 : processus et signaux, services systemd et journaux, variables et environnement, scripts Bash testés avec des arguments, réseau (ports, DNS, HTTP), SSH par clés et durcissement, cron, un incident nginx à résoudre, un script de sauvegarde avec rotation et dix questions d'entretien avec réponses modèles. Le cours compte 21 leçons (#30).
- Terminal Linux : `find -mtime`, `ps --sort`, unités systemd écrites à la main, `trap`, `mktemp`, `ssh-keygen`, services et processus de mise en place (port occupé, service en échec et son journal), `nginx -t` qui contrôle le nombre d'arguments de `root`, `proxy_pass` et `include` (#29).

### Corrigé
- `ls -1` et les options faites de chiffres ; `xargs` laisse ses options à la commande qu'il lance (`xargs -r rm -f`).

## [0.9.0] — 2026-11-11

Sprint 4.1, début de l'étape DevOps : un terminal Linux dans le navigateur et les cinq premiers chapitres du cours **Linux et Bash** (10 leçons).

### Ajouté
- **Terminal Linux simulé** (Ubuntu 24.04) : système de fichiers avec utilisateurs, groupes et droits ; Bash avec pipes, redirections, here-docs, boucles, conditions, fonctions et `set -euo pipefail` ; une centaine de commandes aux messages GNU, dont `sed`, `awk`, `sudo`, `systemctl`, `journalctl`, `apt`, `cron` et un réseau simulé. Saisie sur plusieurs lignes comme dans bash, défis vérifiés sur l'état de la machine ou sur la sortie, défis de scripts testés avec des arguments (#29).
- Plan des étapes 4 (DevOps) et 5 (AWS et Terraform), ADR 0001 sur le choix des simulateurs.
- Cours **Linux et Bash**, chapitres 1 à 5 : se repérer, fichiers, liens, recherche et archives, droits, utilisateurs et sudo, grep, tri et comptage, sed et awk, redirections, pipes et codes de sortie, avec une mise en situation sur un journal nginx (#30).

### Modifié
- CI de Boucle : actions mises à jour par Dependabot (checkout v7, setup-node v7, setup-python v7, configure-pages v6, upload-pages-artifact v5, deploy-pages v5), toujours épinglées par SHA. Le déploiement est passé avec ces versions.

## [0.8.0] — 2026-11-11

Sprint 3.3 : le cours **CI/CD avec GitHub Actions** est complet (22 leçons en 12 chapitres, dont un projet et des questions d'entretien). La CI de Boucle applique ce qu'il enseigne : actions épinglées par SHA et Dependabot.

### Ajouté
- Cours **CI/CD avec GitHub Actions**, chapitres 4 à 12 : tests dans le pipeline (services, étude de cas de la CI de Boucle), matrices, cache, artefacts et concurrence, secrets et permissions du `GITHUB_TOKEN`, OIDC et chaîne d'approvisionnement, images Docker et registres, releases automatiques, environnements et approbations, stratégies de déploiement et rollback, Terraform plan/apply, lecture de logs d'échec, débogage et tests instables, panorama GitLab CI / Jenkins / Azure DevOps, projet de pipeline complet et questions d'entretien avec réponses modèles (#12).
- Moteur des workflows : critères `services`, `environment`, `cache`, `matrixSize`, `failFast`, `jobConcurrency`, `dispatchInputs`, `contains`, `lacks` ; avertissement « pwn request » ; environnement affiché dans le graphe ; blocs `~~~log` colorés.
- Les roadmaps DevOps et Cloud renvoient aux leçons CI/CD concernées.

### Modifié
- CI de Boucle : chaque action est épinglée sur un SHA complet, sans changement de version ; Dependabot propose chaque mois une PR groupée pour les mettre à jour.

### Corrigé
- Sur mobile, les titres longs des boutons « leçon précédente / suivante » débordaient de l'écran.

## [0.7.0] — 2026-11-11

Sprint 3.2 : collaborer sur GitHub, et premiers workflows GitHub Actions vérifiés dans le navigateur. Nouveau cours **CI/CD avec GitHub Actions** (6 leçons, chapitres 1 à 3 sur 12) ; le cours Git passe à 14 leçons.

### Ajouté
- **Exercices de workflows GitHub Actions** : éditeur YAML, erreurs en direct avec leur ligne (lint inspiré d'actionlint), simulation d'événements (PR, push sur une branche ou un tag, lancement manuel, échec d'un job) et graphe du pipeline ; critères déclaratifs et extraits « Analyser » dans la théorie (#22).
- Cours **CI/CD avec GitHub Actions**, chapitres 1 à 3 sur 12 : pourquoi la CI/CD et les métriques DORA, workflows, jobs, étapes et runners, événements et filtres, jobs parallèles et `needs`, YAML sans pièges, expressions, contextes et conditions (#12).
- Cours Git, chapitre « Collaborer sur GitHub » : pull requests et GitHub Flow, revue de code (mise à jour d'une PR par rebase et `--force-with-lease`), issues, milestones et modèles, protection de main et flux de travail, releases, SemVer et sécurité du compte ; mises en situation tirées du dépôt de Boucle et guide pour une première PR sur un dépôt d'entraînement (#11).
- Panneau « Pratique » pour les leçons sans défi, et langage d'exercice réglable par leçon.

## [0.6.0] — 2026-11-11

Sprint 3.1 : Git en ligne de commande, dans un terminal simulé. Le cours **Git et GitHub** compte 9 leçons en 3 chapitres.

### Ajouté
- **Terminal Git simulé** : simulateur Git en JavaScript pur (fusion à trois voies, conflits, rebase interruptible, reset, revert, stash, cherry-pick, tags, dépôt distant), terminal avec historique, graphe des commits et état des fichiers ; vérification par l'état du dépôt (#18).
- Cours **Git et GitHub**, chapitre « Les bases » : modèle de Git et premier commit, historique et diff, .gitignore et restore (#18).
- 16 tests unitaires du simulateur en CI (`npm run test:unit`) (#18).
- Cours Git, chapitre « Branches » : branches, fusion et résolution de conflit, rebase et historique linéaire (#10).
- Cours Git, chapitre « Réparer et collaborer » : reset, revert et stash, dépôt distant et push refusé, défi hotfix en production avec cherry-pick et tags SemVer (#10).

### Corrigé
- pd-08 : le piège `groupby().max()` passait par hasard avec pandas 3 ; le test vérifie maintenant aussi la longueur du bec, différente d'une colonne à l'autre.
- Test de parité navigateur : il nomme la leçon fautive au lieu d'échouer sur un simple délai dépassé.
- CI : le job e2e utilise le Chrome du runner ; il ne dépend plus des miroirs apt d'Ubuntu, tombés pendant le sprint (AUDIT #25).

## [0.5.0] — 2026-11-11

Fin de l'étape 2 : le cours **Data** compte 37 leçons (NumPy, pandas, visualisation, SciPy, scikit-learn, projet guidé).

### Modifié
- Limite d'exécution Python portée de 10 à 20 s, pour importer scikit-learn et entraîner un modèle en WebAssembly (#6).

### Corrigé
- Test e2e instable : le helper concluait pendant l'installation de seaborn (#5).

### Ajouté
- **Projet guidé** en 5 étapes vérifiées : prédire le sexe d'un manchot (cadrage, exploration, baseline et validation mélangée, pipeline, évaluation finale et prédiction des inconnus), avec un guide pour le publier comme projet portfolio sur GitHub (#7).
- Chapitre **scikit-learn** (7 leçons) : fit/predict et évaluation sur données non vues, classification et matrice de confusion, précision/rappel/F1 codés à la main, prétraitement et Pipeline, validation croisée et surapprentissage, forêts aléatoires et GridSearchCV, fuite de données (#6).
- Chapitre **SciPy** (4 leçons) : lois de probabilité, tests d'hypothèse (Welch, intervalles de confiance, comparaisons multiples), corrélation et paradoxe de Simpson sur les manchots, optimisation et ajustement de courbe (#5).

## [0.4.0] — 2026-11-11

### Ajouté
- Chapitre **pandas** (8 leçons) : Series et DataFrame, lecture et exploration de CSV, sélection et filtres, nettoyage, groupby, jointures, dates et séries temporelles, maximum par groupe (#3).
- Jeux de données réels : manchots de Palmer (CC0), météo de Seattle 2012-2015 (NOAA, domaine public), plus deux tables fictives clients et commandes (#3).
- Chapitre **Visualisation** (5 leçons) : figure et axes, choisir le bon graphique, sous-graphiques, pandas.plot et seaborn, graphique honnête. Les défis vérifient les propriétés des figures, pas l'image (#4).
- seaborn 0.13.2 installé à la demande dans le navigateur avec micropip (absent de Pyodide) (#4).
- Backlog de l'étape 3, dont un cours complet CI/CD (#10, #11, #12).

## [0.3.0] — 2026-11-11

### Ajouté
- Processus agile : backlog GitHub Issues, Definition of Ready / Done, modèles de PR et d'issue.
- Jeux de données lisibles via `data/<fichier>` dans le navigateur et en CI (#1).
- Chapitres dans les cours, panneau « Sur ta machine », page Installer (Python, venv, VS Code, Jupyter, Git, WSL) (#1).
- Préchargement de Python à l'ouverture d'une leçon (#1).
- Tests e2e Playwright en CI ; la publication attend la validation et les tests (#1).
- `requirements.txt` aligné sur les versions de Pyodide 0.29.5 (#1).

- Cours **Python data**, module NumPy : 8 leçons (ndarray, vectorisation, indexation et vues, broadcasting, axes, algèbre linéaire et régression par équations normales, aléatoire reproductible, moyenne mobile en O(n)) (#2).
- Test e2e de parité : chaque solution doit aussi passer dans le navigateur (Pyodide 32 bits, JSCPP) (#2).

### Modifié
- Les cours déclarent leur route et leur badge : le routeur n'a plus de cours codé en dur (#1).

## [0.2.0] — 2026-11-11

### Ajouté
- Site modulaire : un fichier de contenu par cours.
- Python réel dans le navigateur (Pyodide 0.29.5) dans un Web Worker : paquets à la demande, figures Matplotlib, arrêt des boucles infinies.
- Validation automatique de tout le contenu (CPython, g++, interpréteur du navigateur) et CI GitHub Actions.
- Publication sur GitHub Pages et Vercel.
- Documentation : README, ARCHITECTURE, AUDIT, PLAN.

## [0.1.0] — 2026-11-11

### Ajouté
- Prototype : 13 leçons Python, 11 leçons C++, roadmaps DevOps, Cloud et ML.
