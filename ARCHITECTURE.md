# Architecture de Boucle

Boucle est un **site statique** : pas de serveur applicatif ni de base de données. Tout le code de l'élève s'exécute **dans son navigateur**. Ce choix garde l'hébergement gratuit (GitHub Pages, Vercel), supprime toute surface d'attaque côté serveur et fonctionne même sur un réseau filtré.

## Vue d'ensemble

```
Navigateur de l'élève
├── Interface        public/assets/js/main.js       routeur (#route) et pages
├── Contenu          public/content/                 cours, leçons, roadmaps (données pures)
├── Progression      localStorage                    XP, série, code en cours
├── Worker Python    assets/js/workers/python-worker.js + assets/py/harness.py
│                    Pyodide (CPython 3.13 en WebAssembly), paquets à la demande
└── Interpréteur C++ JSCPP, exécuté pas à pas sur le fil principal

CDN jsDelivr         Pyodide, ses paquets (numpy, pandas…), JSCPP

GitHub (dépôt boucle)
├── main             code + contenu
├── CI Actions       npm run validate → 87+ vérifications (CPython, g++, JSCPP)
└── Publication      GitHub Pages (patheba10.github.io/boucle) et Vercel
```

## Les couches

### 1. Contenu (`public/content/`)

Des modules JavaScript qui n'exportent que des **données** : aucune logique. Un fichier par cours, plus `roadmaps.js`, et `index.js` qui assemble le tout.

Schéma d'une leçon :

| Champ | Rôle |
|-------|------|
| `id`, `title`, `xp` | Identité et récompense |
| `theory` | HTML. `@@code@@` pour le code en ligne ; blocs `~~~py` / `~~~cpp` exécutables (options : `norun`, `stdin:…`) |
| `quiz` | `[{ q, options, answer, explain }]` |
| `challenge` | `{ prompt, starter, solution, hint, expected, tests }` |
| `theoryOnly` | Leçon sans défi exécutable |

La séparation contenu / moteur permet d'ajouter un cours sans toucher au code de l'application.

### 2. Application (`public/assets/js/`)

ES modules natifs, sans framework ni étape de build.

| Module | Responsabilité |
|--------|----------------|
| `main.js` | Routeur par hash (`#py-04`, `#devops`…), rendu des pages, liaison des événements |
| `lib/state.js` | Progression : XP, niveaux, série de jours, code sauvegardé (localStorage) |
| `lib/editor.js` | Éditeur : `<textarea>` transparente sur un `<pre>` coloré, indentation auto |
| `lib/highlight.js` | Coloration syntaxique Python et C++ |
| `lib/engines.js` | Façade unique `run(lang, code, stdin)` vers les moteurs |
| `lib/checker.js` | Vérification des défis, messages d'erreur pédagogiques, rendu console et figures |

### 3. Moteurs d'exécution

**Python.** Un Web Worker charge Pyodide et exécute le code de l'élève hors du fil principal : l'interface ne gèle jamais. `harness.py` capture la sortie, traduit les erreurs (type, ligne) et renvoie les figures Matplotlib en PNG. Les paquets importés sont chargés automatiquement. Une boucle infinie est coupée après 20 s (le temps d'importer scikit-learn et d'entraîner un petit modèle en WebAssembly) : le worker est détruit puis recréé. Après chaque exécution, le harnais démonte les objets créés par l'élève (il les garde tous en vie, vide leurs attributs, puis les relâche) : dans Pyodide, dont la pile C est petite, libérer d'un coup une longue chaîne d'objets liés (une liste chaînée de 100 000 nœuds) est récursif et bloquait le worker lors d'une exécution suivante.

**C++.** JSCPP interprète un sous-ensemble du C++ (iostream, types de base, fonctions, tableaux, pointeurs). Il s'exécute par tranches de 2 500 pas, ce qui permet de l'arrêter au bout de 6 s.

**Même code en CI et dans le navigateur.** `scripts/run_py.py` utilise le même `harness.py` que le worker : un exercice validé en CI se comporte de la même façon pour l'élève.

**Git.** `lib/gitsim.js` est un simulateur Git écrit en JavaScript pur, sans DOM. Il gère la copie de travail, l'index, les commits, les branches, la fusion à trois voies avec conflits, le rebase interruptible, reset, revert, stash, cherry-pick, les tags et un dépôt distant `origin`. Le navigateur (`lib/gitterm.js` : terminal, graphe des commits, état des fichiers) et la CI (validateur, tests unitaires `node:test`) exécutent le même code. Les hachages dépendent seulement du contenu et d'une horloge logique : un exercice donne toujours les mêmes identifiants.

**Workflows GitHub Actions.** `lib/workflow.js` lit le YAML avec js-yaml 4.1.0 (schéma YAML 1.2, comme GitHub : `on` reste une clé), copié dans `assets/js/vendor/` pour que la CI et le navigateur exécutent le même octet (un test unitaire compare la copie au paquet npm épinglé). Il fournit :

- un **lint** inspiré d'actionlint : clés et événements inconnus avec suggestion (« run-on » → « runs-on »), `runs-on` ou `steps` manquants, `needs` vers un job absent ou circulaire, action sans version, permissions invalides, expressions `${{ }}` mal formées, contextes inconnus ou indisponibles (`env` dans le `if` d'un job), nombres qui perdent leur zéro (`3.10` lu 3.1), injection de valeurs non fiables dans `run` ;
- un **évaluateur d'expressions** (opérateurs, comparaisons sans casse, `startsWith`, `contains`, `format`, `success()`, `failure()`, `always()`…) ;
- une **simulation** : pour un événement (push sur une branche ou un tag, pull request, lancement manuel…), il applique les filtres `branches`, `tags`, `paths` et `types`, puis calcule quels jobs tournent, dans quel ordre (niveaux de `needs`) et quelles étapes s'exécutent, y compris quand on simule l'échec d'un job ;
- des **critères déclaratifs**, comme pour Git.

`lib/wfview.js` affiche les problèmes avec leur ligne, les onglets d'événements et le graphe des jobs. Il n'y a pas de vrai runner : on vérifie la structure et le comportement attendu du pipeline, ce qu'on fait aussi en revue de code.

**Linux.** `lib/shell/` simule une machine Ubuntu 24.04 (voir l'[ADR 0001](docs/adr/0001-simulateurs-devops.md)) :

- `fs.js` : système de fichiers en mémoire avec utilisateurs, groupes, droits Unix et liens symboliques ;
- `parse.js` : analyseur Bash (listes, pipelines, redirections, here-docs, `if`, `for`, `while`, `case`, fonctions, `[[ ]]`, `(( ))`), qui signale une commande incomplète pour la saisie sur plusieurs lignes ;
- `shell.js` : interpréteur (expansions, globbing, découpage des mots, `set -euo pipefail`, scripts avec shebang et droit d'exécution, codes de sortie) et critères déclaratifs ;
- `commands.js` : une centaine de commandes (fichiers, texte, `sed` et `awk`, utilisateurs et `sudo`, processus, `systemctl` et `journalctl`, `apt`, `cron`, réseau simulé, `tar`, `jq`) avec les messages des outils GNU ;
- `text.js` : regex POSIX, `sed` et `awk` (sous-ensembles).

`lib/shterm.js` affiche le terminal, le dossier courant et les services ; il exécute aussi les extraits de théorie et les tests des défis de scripts. Une commande non simulée le dit clairement.

**Docker.** `lib/docker/` se branche sur le terminal Linux (`docker` et `hadolint` sont des commandes comme les autres ; `curl`, `cat` et l'éditeur de fichiers restent ceux du terminal) :

- `catalog.js` : images de base avec leurs tailles réelles, tailles des paquets apt, apk, pip et npm ;
- `dockerfile.js` : analyse du Dockerfile, règles de hadolint (codes et messages réels) et avertissements de BuildKit (`JSONArgsRecommended`, `SecretsUsedInArgOrEnv`…) ;
- `engine.js` : construction avec cache de couches, contexte et `.dockerignore`, multi-étapes, conteneurs, ports publiés, réseaux et DNS, volumes et montages, politiques de redémarrage, registre ;
- `compose.js` : Compose v2 (interpolation et `.env`, `depends_on` avec `service_healthy`, réseau et volumes du projet, `down -v`, validation du fichier) ;
- `cli.js` : sorties au format de Docker 27 et critères déclaratifs (`images`, `containers`, `volumes`, `networks`, `pushed`, `http`, `dockerfile`).

Le comportement d'une application (modules Python requis, routes, variables d'environnement, base de données) est décrit dans la mise en place du défi et rattaché au fichier source copié dans l'image. L'élève doit donc vraiment copier le bon fichier, installer les dépendances, écouter sur `0.0.0.0`, publier le bon port et mettre les conteneurs sur le même réseau.

**Kubernetes.** `lib/k8s/` ajoute un cluster d'un nœud (comme kind) et `kubectl` au terminal :

- `cluster.js` : validation des manifests comme l'API server (champs requis, champs inconnus, types, sélecteur et labels), objets et valeurs par défaut, réconciliation Deployment → ReplicaSet → Pods avec déploiement progressif (`maxSurge`, `maxUnavailable`), ordonnancement selon les ressources demandées, kubelet (tirage d'image, ConfigMaps et Secrets, démarrage, sondes, `CrashLoopBackOff`), Services et Endpoints, DNS du cluster, HPA ;
- `kubectl.js` : `apply`, `get` (`-o wide|yaml|json|jsonpath|name`, `-l`, `-A`), `describe` avec événements, `logs` (`--previous`), `exec`, `delete`, `scale`, `set image|env`, `rollout status|history|undo|restart`, `expose`, `port-forward`, `run`, `create`, `auth can-i`, au format de kubectl 1.31, et les critères `k8s` et `pods`.

Les conteneurs des Pods tournent dans un moteur Docker propre au nœud : mêmes images (celles du catalogue et celles poussées avec `docker push`), mêmes comportements d'application. Une variable manquante donne donc le même `KeyError` dans `kubectl logs` que dans `docker logs`.

**Exploitation.** Deux simulateurs de plus, branchés de la même façon :

- `lib/prom/` : séries temporelles déterministes d'une boutique en ligne (deux instances d'API, des nœuds, un incident sur `/panier` depuis 10 minutes, un nœud tombé depuis 7 minutes) et un évaluateur PromQL (sélecteurs, plages, `rate`, `increase`, `*_over_time`, agrégations `by`/`without`, opérateurs avec correspondance de labels, `histogram_quantile`, `topk`, `absent`). Prometheus écoute sur le port 9090 : règles de `/etc/prometheus/rules`, rechargement, alertes `pending` puis `firing` selon `for`, `promtool query instant` et `promtool check rules|config` ;
- `lib/ansible/` : `ansible-playbook` et `ansible` en connexion locale sur la machine du terminal. Inventaires INI et YAML, modules `apt`, `copy`, `template` (Jinja2 : expressions, filtres courants, `for`, `if`), `file`, `lineinfile`, `user`, `group`, `service`, `command`, `debug` ; `become`, `vars`, `loop`, `when`, `register`, `notify` et handlers, `--check` et `--diff`. Sorties d'ansible-core 2.17 ; les modules travaillent sur l'état réel, donc un second passage ne change rien.

**Cloud.** `lib/aws/account.js` simule un compte AWS (`123456789012`, région `ca-central-1`, VPC par défaut) : ressources avec identifiants et ARN réalistes, schémas des ressources (arguments, types, arguments qui forcent le remplacement, attributs calculés) et vérifications de l'API (plages CIDR, sous-réseaux qui se chevauchent, AMI et types d'instance inconnus, noms de buckets pris, documents IAM invalides), avec les erreurs du SDK. `lib/terraform/` s'appuie dessus :

- `hcl.js` : analyseur HCL (blocs, expressions, interpolation, heredoc, `for`, splat, conditions) et fonctions courantes (`cidrsubnet`, `merge`, `format`, `lookup`…), erreurs au format de Terraform avec l'extrait de code ;
- `terraform.js` : `init`, `validate` (avec suggestions « Did you mean »), `fmt`, `plan` (graphe de dépendances, `count`, `for_each`, modules locaux, valeurs « known after apply », remplacement forcé), `apply` (confirmation, erreurs d'API, état partiel), `destroy` dans l'ordre inverse, `output`, `state`, `import`, dérive détectée au rafraîchissement, backend `s3` avec migration et verrou. L'état est un vrai `terraform.tfstate` dans le dossier.

`lib/aws/` complète le compte pour la CLI :

- `iam.js` : évaluation des politiques dans l'ordre d'AWS (refus explicite, puis autorisation, sinon refus implicite), jokers dans les actions et les ARN, conditions courantes (`StringEquals`, `StringLike`, `Bool`, `IpAddress`, `…IfExists`), politiques d'identité et politiques de bucket, politiques gérées par AWS les plus utilisées ;
- `cli.js` : `aws` v2 (`sts`, `s3`, `s3api`, `ec2` dont la construction d'un VPC, `iam` dont les versions de politiques, `rds`, `configure`) avec les sorties JSON d'AWS, `--output text|table`, `--query` (sous-ensemble de JMESPath : projections, aplatissement, filtres, multisélection, fonctions), profils (`--profile`, `AWS_PROFILE`), refus `AccessDenied` ou `UnauthorizedOperation` décidés par IAM. La joignabilité d'une instance depuis Internet suit le vrai chemin : état, IP publique, table de routage du sous-réseau (association ou table principale), passerelle Internet attachée au VPC, règles d'entrée des security groups ; `curl` vers l'IP publique répond seulement si tout est en place. Critères `iam`, `reach` et `s3`.

**FastAPI et pytest.** Pyodide n'a pas de threads : FastAPI exécute ses fonctions synchrones dans un pool de threads, et le `TestClient` de Starlette lance un thread. Le harnais (`public/assets/py/harness.py`) exécute donc ces fonctions directement et remplace `TestClient` par un client synchrone qui pilote l'application ASGI sans boucle d'événements ; même chose en CI, pour que les deux se comportent pareil. Pour les défis de tests, le harnais écrit le fichier de l'élève et les modules testés dans un dossier temporaire et lance le vrai pytest, sur le bon code puis sur chaque mutant.

**C dans le navigateur.** Le cours de C embarqué a besoin de `struct`, `enum`, `volatile`, des types de `<stdint.h>` et de l'arithmétique modulaire des non signés, que JSCPP (l'interpréteur du cours C++) ne gère pas. `public/assets/py/minic.py` est un interpréteur C écrit en Python : un préprocesseur (`#include`, `#define` avec paramètres, `#if`), l'analyseur pycparser 2.22 (le même dans Pyodide et en CI), puis une compilation de l'arbre en fermetures Python. La mémoire est un `bytearray` adressé octet par octet, avec le modèle LP64 de gcc sur x86-64 (int 32 bits, long et pointeurs 64 bits, petit-boutiste, alignements naturels) : `sizeof`, débordements, promotions entières, comparaisons signé/non signé et `printf` donnent la même chose qu'avec gcc. Les erreurs (pointeur NULL, accès hors limites, division par zéro, boucle infinie au-delà de 2 millions d'étapes) sont signalées en français avec leur ligne. `public/assets/py/mcu.h` décrit un microcontrôleur inspiré des STM32 : des structures de registres façon CMSIS (GPIO, TIM, ADC, USART) et des fonctions `sim_…` qui jouent le matériel (appliquer BSRR, faire avancer un timer et appeler l'ISR, terminer une conversion). Le même fichier sert à minic et à gcc. `npm run validate` exécute chaque défi et extrait C avec les deux et exige des sorties identiques.

**Keras sans TensorFlow.** TensorFlow n'existe pas dans Pyodide. `public/assets/py/minikeras.py` réimplémente en NumPy la partie de Keras 3 utilisée par le cours (Sequential, Dense, Dropout, Flatten, Conv2D, MaxPooling2D, SGD, Adam, RMSprop, pertes et métriques courantes, EarlyStopping, régularisation L2, summary), avec les mêmes noms de couches et les mêmes nombres de paramètres. Le harnais l'installe sous les noms `keras` et `tensorflow` quand le vrai TensorFlow est absent. Le job CI « Vérifier le code Keras avec TensorFlow » (`scripts/verifier_tf.mjs`) exécute chaque défi et extrait Keras avec le vrai TensorFlow : le code appris est du vrai Keras, et les résultats attendus (seuils d'exactitude, formes, nombres de paramètres) valent pour les deux. Ce que minikeras ne peut pas imiter (le convertisseur LiteRT, l'interpréteur `ai_edge_litert`) s'écrit en extrait `~~~py tf` : affiché sans bouton Exécuter, avec la mention « sur ta machine ou dans Colab », et exécuté seulement par ce job. La quantification, elle, se calcule en NumPy et reste un défi du navigateur.

**SQL.** `lib/sql.js` fabrique un petit programme Python qui crée la base en mémoire avec `sqlite3`, exécute les instructions de l'élève une à une (erreurs de SQLite avec leur numéro d'instruction) et affiche chaque résultat en tableau. Pour un défi, le programme exécute aussi la solution sur une seconde base neuve et compare les deux derniers résultats (valeurs numériques normalisées, ordre selon `ORDER BY`). Le même programme tourne dans Pyodide au navigateur et dans CPython pour `npm run validate` : une requête validée en CI se comporte pareil chez l'élève.

**Certifications.** `lib/exam.js` tire un examen selon les poids officiels des domaines (plus fort reste, bornés par la banque), mélange les options avec un générateur déterministe et corrige sans point partiel ; le score suit une échelle linéaire de 100 à 1000. `lib/examview.js` affiche l'entraînement par domaine et l'examen blanc chronométré, dont l'état (réponses, marques, échéance) est dans la progression locale : un rechargement reprend l'examen, et l'échéance passée le termine.

### 4. Vérification d'un défi

1. **Python.** Le code de l'élève est exécuté, suivi d'un marqueur puis du code de test caché. Seule la sortie produite après le marqueur est comparée à `expected`, après normalisation des espaces. On teste donc le comportement d'une fonction, et pas seulement ce qui est affiché.
2. **Git.** On vérifie l'**état** du dépôt simulé après les commandes de l'élève, avec des critères déclaratifs : branche courante, messages, contenu des fichiers, propreté, commit de fusion, historique linéaire, branche poussée… Chaque critère s'affiche en français. Plusieurs suites de commandes peuvent mener au bon état, comme en vrai.
3. **Workflow YAML.** Le fichier est analysé, puis chaque scénario simule un événement : « sur une PR vers main, lint et tests tournent, deploy est sauté ». Les critères portent aussi sur la structure (déclencheurs, `needs`, actions et versions, matrice, permissions minimales).
4. **C++.** Le programme est exécuté une fois par test, chaque test ayant sa propre entrée standard. Une sortie codée en dur ne passe donc pas.

### 5. Qualité et déploiement

`npm run validate` vérifie, pour chaque leçon :

- la structure : ids uniques, quiz cohérents, liens internes des roadmaps ;
- que chaque extrait de théorie s'exécute ;
- que la solution passe, avec g++ **et** l'interpréteur du navigateur pour le C++ ;
- que le code de départ échoue.

La CI GitHub Actions lance cette validation à chaque push, puis publie `public/` sur GitHub Pages. Vercel publie le même dossier en parallèle.

## Décisions et compromis

| Décision | Pourquoi | Coût accepté |
|----------|----------|--------------|
| Site statique, pas de backend | Gratuit, sûr, rapide, déployable partout | Progression locale au navigateur (export/import prévu) |
| Pyodide plutôt que Skulpt | Vrai CPython, vraies bibliothèques data | Premier chargement d'environ 10 Mo |
| Pas de framework (React…) | Zéro build, code lisible pour apprendre | Plus de code manuel pour le rendu |
| JSCPP pour le C++ | Tourne sans serveur | Sous-ensemble du langage ; à remplacer (voir AUDIT #15) |
| Hash routing | Fonctionne sur tout hébergeur statique | URLs moins jolies |

## Données, chapitres et installation locale (sprint 2.1)

- **Jeux de données** : fichiers dans `public/datasets/` (catalogue et licences dans son README). Tout chemin `"data/<fichier>"` cité dans le code est récupéré par `engines.js`, puis copié dans le système de fichiers de Pyodide avant l'exécution. En CI, `run_py.py` exécute le code dans un dossier temporaire où `data/` pointe vers `public/datasets/`. Le même code marche donc partout, y compris sur ta machine si tu recrées un dossier `data/`.
- **Versions alignées** : `requirements.txt` épingle numpy, pandas, scipy et scikit-learn aux versions de Pyodide 0.29.5. Exception : matplotlib, dont la 3.8.4 n'existe pas pour CPython 3.13 (la CI prend la 3.9.4).
- **Chapitres** : un champ `section` sur les leçons regroupe le parcours en chapitres.
- **Installation locale** : champ `setup` par leçon (panneau « Sur ta machine ») et page `#installer`, alimentée par `content/guides/installer.js`.
- **Paquets hors Pyodide** : le worker installe depuis PyPI, avec micropip, les paquets d'une liste blanche épinglée (`MICROPIP` dans `python-worker.js`, aujourd'hui seaborn 0.13.2). La CI installe les mêmes versions via `requirements.txt`.
- **Préchargement** : à l'ouverture d'une leçon Python, le worker démarre et charge les paquets importés par la leçon avant le premier clic.
- **Routes de cours** : chaque cours déclare sa `route` (`#python`, `#data`…) et son `badge`. Ajouter un cours ne demande aucune modification du routeur.

## Tests

| Niveau | Outil | Ce qui est vérifié |
|--------|-------|--------------------|
| Simulateur Git | `npm run test:unit` (node:test) | 16 scénarios : commits, .gitignore, diff, branches, fusions et conflits, rebase interrompu, reset, revert, stash, cherry-pick, tags, push rejeté puis pull |
| Terminal Linux | `npm run test:unit` (node:test) | 11 tests : navigation et messages GNU, redirections et pipes, expansions, droits et sudo, services et journal, processus et cron, unités systemd, scripts, défis de scripts, options POSIX, configuration nginx, critères |
| Simulateur Docker | `npm run test:unit` (node:test) | 12 tests : étapes et cache de construction, `.dockerignore`, erreurs de BuildKit, hadolint, multi-étapes et non root, ports et `127.0.0.1`, plantages, réseaux et DNS, volumes, redémarrage, montages, registre, Compose, droits, défi de type fichier |
| Cluster Kubernetes | `npm run test:unit` (node:test) | 7 tests : apply idempotent, validation, ImagePullBackOff, CrashLoopBackOff, CreateContainerConfigError, Pending, targetPort, DNS, sondes, base de données, rollouts et retour arrière, ConfigMap, namespaces, expose, RBAC |
| Exploitation | `npm run test:unit` (node:test) | 5 tests : PromQL (valeurs et erreurs), promtool, règles et alertes, rechargement, critère `promql`, playbook avec handlers, boucles et gabarits, idempotence, `--check --diff`, erreurs d'Ansible |
| Terraform | `npm run test:unit` (node:test) | 5 tests : validate et suggestions, plan et apply avec count et outputs, confirmation, idempotence, destroy ordonné, mise à jour sur place, remplacement forcé, erreurs d'API, variables et validation, tfvars, for_each, modules, import, dérive, backend S3 et verrou, fmt |
| CLI AWS | `npm run test:unit` (node:test) | 9 tests : construction d'un réseau à la CLI, sortie en tableau, versions de politiques, évaluation IAM et conditions, JMESPath, identité, buckets et objets, erreurs de l'API, profil restreint et `AccessDenied`, rôle de service et politiques attachées, instance lancée puis ouverte au web, sous-réseau privé et table de routage |
| Examens blancs | `npm run test:unit` (node:test) | 4 tests : quotas par domaine, tirage déterministe et options mélangées, entraînement par domaine, réponses multiples, score et détail par domaine, contrôle des banques |
| Moteur SQL | `npm run test:unit` (node:test, CPython) | 4 tests : découpage des instructions et commentaires, tableaux et lignes modifiées, erreurs SQLite et conseils, ordre exigé, colonnes, normalisation des nombres, requête de contrôle et transactions |
| Harnais Python | `npm run test:unit` (node:test, CPython) | 2 tests : FastAPI et son client de test sans thread ni boucle d'événements (dépendances, en-têtes, validation, routes asynchrones), pytest et test par mutation (mutant détecté ou non, tests en échec sur le bon code, aucun test) |
| Syntaxe JS | `npm run test:unit` | `node --check` sur tout le JavaScript de `public/` : une erreur de syntaxe dans une vue casse tout le site |
| minic | `npm run test:unit` (node:test, CPython et gcc) | Parité avec gcc sur trois programmes qui couvrent le langage et mcu.h ; messages d'erreur et ligne ; préprocesseur ; sortie conservée avant une erreur |
| minikeras | `npm run test:unit` (node:test, CPython) | 2 tests : gradients de Dense, Conv2D, MaxPooling2D et de la régularisation L2 comparés aux différences finies ; API de Keras 3 (noms, paramètres, formes, compile obligatoire, historique, arrêt précoce et restauration, affichage de fit) |
| Keras réel | `scripts/verifier_tf.mjs` (job CI TensorFlow) | Chaque défi et extrait Keras exécuté avec TensorFlow 2.21, plus les extraits `tf` (conversion et interpréteur LiteRT avec `ai-edge-litert`) : mêmes sorties attendues qu'avec minikeras |
| Moteur des workflows | `npm run test:unit` (node:test) | 17 tests, dont un qui passe la vraie CI de Boucle au lint : erreurs YAML traduites, lint, expressions, filtres de branches et de chemins, simulation (PR, push, tag, échec en cascade, étape `if: failure()`), critères, numéros de ligne |
| Contenu | `npm run validate` | Chaque extrait, chaque solution (doit passer) et chaque code de départ (doit échouer), avec CPython, g++ et JSCPP |
| Bout en bout | `npm run test:e2e` (pytest + Playwright) | Accueil, pages principales sans erreur JS, chaque solution de défi dans le vrai navigateur, jeux de données, boucle infinie, NumPy + figure, terminal Git, défi et extrait YAML, absence de débordement sur mobile |

La publication n'a lieu que si les deux niveaux passent.
