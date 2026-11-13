# Boucle

Plateforme d'apprentissage façon Coddy : théorie, quiz et défis corrigés automatiquement, avec du code qui s'exécute directement dans le navigateur. Cours Python, data, Git et GitHub, CI/CD avec GitHub Actions, Linux, Docker, Kubernetes, exploitation, Terraform, AWS et C++, roadmaps DevOps, Cloud et ML. Le plan complet est dans [PLAN.md](PLAN.md), l'architecture dans [ARCHITECTURE.md](ARCHITECTURE.md) et l'auto-évaluation dans [AUDIT.md](AUDIT.md).

## Lancer en local

```bash
npm install
npm run dev        # http://localhost:5173
```

Le site est statique : `public/` est servi tel quel, sans étape de build.

## Tests

```bash
npm run validate            # contenu : tout
npm run validate -- py-04   # une seule leçon
pip install -r requirements.txt -r requirements-dev.txt
python -m playwright install chromium
npm run test:e2e            # parcours élève dans un vrai navigateur
npm run test:unit           # simulateurs Git et Linux, moteur des workflows
npm run precache            # après toute modification de public/ : liste du service worker (hors ligne)
npm run audit               # failles connues des dépendances npm et Python (pip-audit requis)
```

## Valider le contenu

```bash
npm run validate           # tout
npm run validate -- py-04  # une seule leçon
```

Pour chaque leçon, le script vérifie que les extraits de théorie s'exécutent, que la solution du défi passe les tests et que le code de départ échoue. Python tourne avec CPython et le même harnais que le navigateur. Le C++ est vérifié avec g++ et avec l'interpréteur du navigateur. La CI GitHub Actions lance ce script à chaque push.

Prérequis : Node 20+, Python 3.13, g++.

## Organisation

```
public/
  index.html
  assets/css/style.css
  assets/js/main.js            routeur et pages
  assets/js/lib/               état, éditeur, coloration, moteurs, vérification
  assets/js/workers/           Web Worker Python (Pyodide)
  assets/py/harness.py         exécution du code élève (navigateur et CI)
  content/index.js             liste des cours et roadmaps
  content/courses/*.js         un fichier par cours
  content/roadmaps.js
scripts/validate.mjs           validation du contenu
```

## Ajouter une leçon

Une leçon est un objet dans `public/content/courses/<cours>.js` :

- `id`, `title`, `xp`
- `theory` : HTML. `@@code@@` donne du code en ligne. Un bloc `~~~py` ... `~~~` est exécutable. Options du bloc : `norun`, `tf` (code qui demande le vrai TensorFlow, comme la conversion LiteRT : affiché sans bouton, ignoré par `npm run validate`, exécuté par `scripts/verifier_tf.mjs`), ou `stdin:…` pour fournir une entrée.
- `section` (facultatif) : nom du chapitre affiché sur la page du cours
- `setup` (facultatif) : panneau « Sur ta machine », même syntaxe que `theory`. Blocs `~~~ps` (PowerShell) et `~~~bash` affichés sans exécution
- `quiz` : liste de `{ q, options, answer, explain }`
- `challenge` : `{ prompt, starter, solution, hint, ... }` ; `hint` est révélé phrase par phrase, ou `hints` (liste du plus général au plus précis) le remplace
  - Python : `expected` (sortie exacte), plus `tests` optionnel, du code ajouté après celui de l'élève.
  - C++ : `tests`, une liste de `{ input, expected }`.
  - C (cours dont `lang` vaut `"c"`) : `starter` et `solution` ne contiennent que des fonctions ; `tests` est du C avec le `main` qui les appelle, et `expected` la sortie exacte. Le programme peut inclure `"mcu.h"` (microcontrôleur simulé). `npm run validate` l'exécute avec minic (l'interpréteur du navigateur) et le compile avec gcc (`-Wall -Wextra -Werror -fwrapv`) : les deux sorties doivent être identiques. Les blocs `~~~c` de la théorie suivent la même règle ; `norun` pour du code qui ne peut pas tourner (adresses physiques, boucle infinie), `avertissement` pour un extrait qui montre exprès un piège signalé par gcc.
  - Python avec Keras : le code s'écrit comme pour le vrai Keras 3 (`import keras`, `from tensorflow import keras`). Dans le navigateur et pour `npm run validate`, il tourne avec minikeras ; `PYTHON=… node scripts/verifier_tf.mjs` le relance avec le vrai TensorFlow (`requirements-tf.txt`). Les tests doivent donc vérifier des seuils, des formes et des nombres de paramètres, pas des décimales qui dépendent de l'initialisation.
  - Python, défi de tests : le code de l'élève est un fichier pytest. `runWith` (ajouté pour « Exécuter ») et `tests` commencent par la ligne `#@boucle` ; seule la suite est exécutée, avec l'objet `boucle` : `boucle.pytest(modules)` lance pytest sur le fichier de l'élève, `boucle.mutants(modules, [(description, modules fautifs)])` vérifie que ses tests réussissent sur le bon code et échouent sur chaque version fautive. `fastapi.testclient.TestClient` fonctionne aussi dans le navigateur (voir ARCHITECTURE).
  - SQL (cours dont `lang` vaut `"sql"`) : la base est le script `db` du défi, de la leçon ou du cours ; le résultat de la dernière requête de l'élève est comparé à celui de `solution` (ordre exigé si la solution contient `ORDER BY`, ou selon `ordered`). `columns: true` exige aussi les noms de colonnes ; `check` donne une requête de contrôle relancée sur les deux bases, pour un exercice qui modifie les données. Les blocs `~~~sql` de la théorie sont exécutables ; l'option `erreur` marque un extrait qui doit échouer.
  - Git (cours dont `lang` vaut `"git"`) : `setup` (commandes de mise en place, silencieuses), `checks` (état attendu, critères listés dans `evaluate` de `lib/gitsim.js`), `solution` (une suite de commandes possible).
  - Workflow GitHub Actions (`lang` vaut `"yaml"`) : `starter` et `solution` (fichiers YAML), `checks` (critères listés dans `evaluate` de `lib/workflow.js`, dont `scenarios` : un événement simulé et les jobs qui doivent tourner ou être sautés), `events` facultatif (onglets de simulation ; par défaut, ceux des scénarios), `file` facultatif (nom affiché).
- `defis` (facultatif) : défis gradués, en plus du défi principal, pour les leçons Python, SQL, C et C++. Ils s'écrivent dans `public/content/defis/<cours>.js`, rangés par id de leçon. Chacun a le format du défi principal plus un `niveau` (`facile`, `moyen` ou `entretien`, un seul défi par niveau) ; ils s'affichent en onglets, ont leur code sauvegardé et leur progression, et rapportent 10, 20 ou 30 XP. `npm run validate` vérifie que leur solution passe et que leur code de départ échoue. Pour exiger une complexité, compter les lectures d'une liste (classe `Espion` dans les défis d'algorithmique) est plus fiable qu'une mesure de temps.
- `exercices` (facultatif) : exercices courts affichés après le quiz, en Python ou en C. Ils s'écrivent dans `public/content/exercices/<cours>.js`, rangés par id de leçon (ou dans un champ `exercices` de la leçon). Chacun a un `type`, une `consigne` facultative et une explication `explain` (montrée quand c'est juste) :
  - `{ type: "sortie", code, reponse }` : l'élève écrit ce que le code affiche ;
  - `{ type: "trous", code }` : chaque `⟦réponse⟧` du code devient un champ ; plusieurs réponses acceptées s'écrivent `⟦a§b⟧` ;
  - `{ type: "ordre", lignes }` : les lignes, dans le bon ordre (indentation comprise), présentées mélangées ; `avant` et `apres` (facultatifs) donnent le code fixe affiché autour. À éviter : des lignes qu'on pourrait échanger sans changer le programme, car seul l'ordre donné est accepté.
  `attendu` (facultatif, pour `trous` et `ordre`) donne la sortie du code complet. `npm run validate` exécute chaque code (Python, ou C avec gcc et l'interpréteur du navigateur) et vérifie la sortie. Réussir un exercice rapporte 5 XP ; les exercices ne comptent pas pour terminer la leçon.
- `lang` (facultatif) sur une leçon : remplace le langage du cours pour cette leçon.
- `practice` (facultatif, leçons sans défi) : `{ title, body }`, panneau de pratique à droite.
- Blocs `~~~git` : exécutés dans un dépôt simulé neuf ; une ligne préfixée par `!` doit échouer.
  - Linux (`lang` vaut `"sh"`) : terminal avec `setup` (`{ files, services, procs, commands, cwd }` ; une commande préfixée par `#` tourne en root), `checks` (critères listés dans `evaluate` de `lib/shell/shell.js`) et `solution` (liste de commandes) ; ou script avec `kind: "script"`, `file`, `starter`, `solution` et `tests` (`{ args, stdin, out, outHas, code, checks }`). Pour un fichier qui ne s'exécute pas (Dockerfile, `compose.yaml`), `run` donne la suite de commandes lancée à chaque test, `editorLang` la coloration (`docker`, `yaml`, `json`). Avec `setup.docker` (`{ images, apps }`), le terminal a Docker ; avec `setup.k8s` (`{ images, apply }`), un cluster Kubernetes et `kubectl` ; avec `setup.prom` (`{}`), Prometheus sur le port 9090. `ansible-core` s'installe avec apt ; avec `setup.terraform` (`{ lock }`) et `setup.aws` (`{ resources, s3, profiles, buckets }`), Terraform et la CLI `aws` sur un compte AWS simulé. Dans `resources`, `as: "nom"` nomme une ressource et `"@nom"` (ou `"@nom.arn"`) y renvoie ; `profiles` donne à chaque profil un utilisateur ou un rôle et ses politiques (ARN gérés ou documents). Critères AWS : `aws` (ressources), `iam` (décisions attendues pour un profil ou un rôle), `reach` (ports joignables depuis Internet ou depuis une adresse) et `s3` (objets, versionnement, Block Public Access).
- Blocs `~~~sh` : exécutés dans un terminal Linux neuf, préparé par `snippetSetup` de la leçon ou du cours s'il existe (Docker installé, fichiers) ; une commande préfixée par `!` doit échouer. Dans les fichiers du cours Linux, le gabarit `R` permet d'écrire `\${…}`.
- Blocs `~~~yaml` : bouton « Analyser » (problèmes et simulation). Ils doivent passer le lint, sauf avec l'option `erreurs` (extrait volontairement faux). Dans les fichiers du cours CI/CD, le gabarit `Y` permet d'écrire `\${{ … }}`.

Pour lire un jeu de données dans un exercice, place le fichier dans `public/datasets/` (et complète son README), puis lis-le via `"data/<fichier>"`.

Lance ensuite `npm run validate`.

Une certification se déclare dans `public/content/certifs/` : `{ id, code, name, price, minutes, count, passing, intro, about, tips, domains: [{ id, name, weight }], bank }`, chaque question valant `{ id, d, q, options, answer, explain }` (`answer` est un indice, ou une liste d'indices pour une question à réponses multiples dont l'énoncé finit par « Choisis-en deux. »). `npm run validate` vérifie la banque et qu'un examen complet peut être tiré selon les poids.

Un projet capstone est un objet de `public/content/projets/<roadmap>.js` : `id` (sa route, préfixe `pj-`), `roadmap`, `titre`, `niveau`, `duree`, `resume`, `technos`, `contexte` (HTML), `exigences`, `architecture` (schéma texte), `jalons` (`{ id, titre, livrables }`, cochables), `criteres`, `extensions`, `lecons` (identifiants de leçons), `liens`. `npm run validate` vérifie les références.

Un nouveau cours se déclare avec `route` (son adresse, ex. `data`) et `badge` (2 ou 3 caractères), puis s'importe dans `public/content/index.js`.

## Moteurs d'exécution

- Python : [Pyodide](https://pyodide.org) 0.29.5, chargé depuis jsDelivr. Les paquets (numpy, pandas, scikit-learn, matplotlib…) se chargent à la demande selon les `import`.
- C++ : [JSCPP](https://github.com/felixhao28/JSCPP) 2.0.6 (servi par le site, dans un Web Worker), un interpréteur pédagogique (iostream, types de base, fonctions, tableaux, pointeurs).
- Git : simulateur maison (`lib/gitsim.js`).
- GitHub Actions : moteur maison (`lib/workflow.js`) qui lit le YAML avec [js-yaml](https://github.com/nodeca/js-yaml) 4.1.0 (copié dans `assets/js/vendor/`, licence MIT), signale les erreurs et simule les événements.

## Comptes

Connexion avec GitHub, Google ou une adresse e-mail, progression synchronisée entre appareils, profil et tableau de bord. Le tout repose sur Supabase, et les règles de sécurité par ligne de la base sont testées en CI (`supabase/tests`). Sans configuration, le site marche sans comptes. Mise en service : [docs/comptes.md](docs/comptes.md).

```bash
supabase db start && supabase test db   # tests pgTAP des droits (Docker et Supabase CLI requis)
```

## Déploiement

- **Vercel** : chaque push sur `main` redéploie automatiquement.
- **GitHub Pages** : après la validation, la CI publie `public/` sur https://patheba10.github.io/boucle/ (Settings → Pages → Source : GitHub Actions).

Les chemins du site sont relatifs pour fonctionner aussi sous `https://patheba10.github.io/boucle/`.
