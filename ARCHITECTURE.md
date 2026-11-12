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

**Python.** Un Web Worker charge Pyodide et exécute le code de l'élève hors du fil principal : l'interface ne gèle jamais. `harness.py` capture la sortie, traduit les erreurs (type, ligne) et renvoie les figures Matplotlib en PNG. Les paquets importés sont chargés automatiquement. Une boucle infinie est coupée après 20 s (le temps d'importer scikit-learn et d'entraîner un petit modèle en WebAssembly) : le worker est détruit puis recréé.

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

Le comportement d'une application (modules Python requis, routes, variables d'environnement, base de données) est décrit dans la mise en place du défi et rattaché au fichier source copié dans l'image.

**Kubernetes.** `lib/k8s/` ajoute un cluster d'un nœud (comme kind) et `kubectl` au terminal :

- `cluster.js` : validation des manifests comme l'API server (champs requis, champs inconnus, types, sélecteur et labels), objets et valeurs par défaut, réconciliation Deployment → ReplicaSet → Pods avec déploiement progressif (`maxSurge`, `maxUnavailable`), ordonnancement selon les ressources demandées, kubelet (tirage d'image, ConfigMaps et Secrets, démarrage, sondes, `CrashLoopBackOff`), Services et Endpoints, DNS du cluster, HPA ;
- `kubectl.js` : `apply`, `get` (`-o wide|yaml|json|jsonpath|name`, `-l`, `-A`), `describe` avec événements, `logs` (`--previous`), `exec`, `delete`, `scale`, `set image|env`, `rollout status|history|undo|restart`, `expose`, `port-forward`, `run`, `create`, `auth can-i`, au format de kubectl 1.31, et les critères `k8s` et `pods`.

Les conteneurs des Pods tournent dans un moteur Docker propre au nœud : mêmes images (celles du catalogue et celles poussées avec `docker push`), mêmes comportements d'application. Une variable manquante donne donc le même `KeyError` dans `kubectl logs` que dans `docker logs`.

**Exploitation.** Deux simulateurs de plus, branchés de la même façon :

- `lib/prom/` : séries temporelles déterministes d'une boutique en ligne (deux instances d'API, des nœuds, un incident sur `/panier` depuis 10 minutes, un nœud tombé depuis 7 minutes) et un évaluateur PromQL (sélecteurs, plages, `rate`, `increase`, `*_over_time`, agrégations `by`/`without`, opérateurs avec correspondance de labels, `histogram_quantile`, `topk`, `absent`). Prometheus écoute sur le port 9090 : règles de `/etc/prometheus/rules`, rechargement, alertes `pending` puis `firing` selon `for`, `promtool query instant` et `promtool check rules|config` ;
- `lib/ansible/` : `ansible-playbook` et `ansible` en connexion locale sur la machine du terminal. Inventaires INI et YAML, modules `apt`, `copy`, `template` (Jinja2 : expressions, filtres courants, `for`, `if`), `file`, `lineinfile`, `user`, `group`, `service`, `command`, `debug` ; `become`, `vars`, `loop`, `when`, `register`, `notify` et handlers, `--check` et `--diff`. Sorties d'ansible-core 2.17 ; les modules travaillent sur l'état réel, donc un second passage ne change rien.

**Cloud.** `lib/aws/account.js` simule un compte AWS (`123456789012`, région `ca-central-1`, VPC par défaut) : ressources avec identifiants et ARN réalistes, schémas des ressources (arguments, types, arguments qui forcent le remplacement, attributs calculés) et vérifications de l'API (plages CIDR, sous-réseaux qui se chevauchent, AMI et types d'instance inconnus, noms de buckets pris, documents IAM invalides), avec les erreurs du SDK. `lib/terraform/` s'appuie dessus :

- `hcl.js` : analyseur HCL (blocs, expressions, interpolation, heredoc, `for`, splat, conditions) et fonctions courantes (`cidrsubnet`, `merge`, `format`, `lookup`…), erreurs au format de Terraform avec l'extrait de code ;
- `terraform.js` : `init`, `validate` (avec suggestions « Did you mean »), `fmt`, `plan` (graphe de dépendances, `count`, `for_each`, modules locaux, valeurs « known after apply », remplacement forcé), `apply` (confirmation, erreurs d'API, état partiel), `destroy` dans l'ordre inverse, `output`, `state`, `import`, dérive détectée au rafraîchissement, backend `s3` avec migration et verrou. L'état est un vrai `terraform.tfstate` dans le dossier. L'élève doit donc vraiment copier le bon fichier, installer les dépendances, écouter sur `0.0.0.0`, publier le bon port et mettre les conteneurs sur le même réseau.

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
| Moteur des workflows | `npm run test:unit` (node:test) | 17 tests, dont un qui passe la vraie CI de Boucle au lint : erreurs YAML traduites, lint, expressions, filtres de branches et de chemins, simulation (PR, push, tag, échec en cascade, étape `if: failure()`), critères, numéros de ligne |
| Contenu | `npm run validate` | Chaque extrait, chaque solution (doit passer) et chaque code de départ (doit échouer), avec CPython, g++ et JSCPP |
| Bout en bout | `npm run test:e2e` (pytest + Playwright) | Accueil, pages principales sans erreur JS, chaque solution de défi dans le vrai navigateur, jeux de données, boucle infinie, NumPy + figure, terminal Git, défi et extrait YAML, absence de débordement sur mobile |

La publication n'a lieu que si les deux niveaux passent.
