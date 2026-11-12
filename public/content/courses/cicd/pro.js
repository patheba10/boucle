/* Cours CI/CD — chapitres 10 (dépanner), 11 (panorama) et 12 (projet final, entretien). */
import { Y } from "./tag.js";

export default [
  {
    id: "ci-18", section: "Dépanner un pipeline", title: "Lire un log d'échec", xp: 85,
    theory: Y`<p>Un pipeline rouge se diagnostique dans l'ordre :</p>
<ol><li><strong>Quel job, quelle étape ?</strong> L'onglet <em>Actions</em> marque l'étape en échec d'une croix. Les étapes suivantes sont grisées : elles ont été sautées ;</li><li><strong>La première erreur, pas la dernière.</strong> La dernière ligne dit souvent @@Process completed with exit code 1@@ : c'est la conséquence. La cause est plus haut, sur les lignes marquées @@##[error]@@ ou dans la trace Python ;</li><li><strong>Le code de sortie</strong> donne un indice : @@1@@ pour un échec générique (tests rouges), @@127@@ pour une commande introuvable, @@137@@ pour un processus tué (souvent par manque de mémoire) ;</li><li><strong>Qu'est-ce qui a changé ?</strong> Ton commit, une dépendance qui a publié une version, l'image du runner, une action qui a bougé de version.</li></ol>
<p>Trois logs typiques :</p>
~~~log
Run pytest -q
==================================== ERRORS ====================================
_____________________ ERROR collecting tests/test_api.py ______________________
ImportError while importing test module '/home/runner/work/api/api/tests/test_api.py'.
E   ModuleNotFoundError: No module named 'fastapi'
=========================== short test summary info ============================
ERROR tests/test_api.py
!!!!!!!!!!!!!!!!!!!! Interrupted: 1 error during collection !!!!!!!!!!!!!!!!!!!!!
1 error in 0.31s
##[error]Process completed with exit code 2.
~~~
<p>Les tests n'ont même pas démarré : la dépendance n'est pas installée sur le runner. Il manque une étape @@pip install -r requirements.txt@@, ou @@fastapi@@ manque dans ce fichier (ça marchait « chez moi » parce que le paquet était installé globalement).</p>
~~~log
Run gh pr comment 42 --body "Couverture : 87 %"
GraphQL: Resource not accessible by integration (addComment)
##[error]Process completed with exit code 1.
~~~
<p>« Resource not accessible by integration » : le @@GITHUB_TOKEN@@ n'a pas le droit demandé. Ici, il manque @@pull-requests: write@@ dans les @@permissions@@ du job.</p>
~~~log
Run docker build -t api .
#9 [4/5] RUN pip install --no-cache-dir -r requirements.txt
#9 41.27 Killed
##[error]Process completed with exit code 137.
~~~
<p>Code 137 et « Killed » : le processus a été tué, le plus souvent par manque de mémoire. Pistes : une installation trop gourmande, des builds en parallèle, ou un runner plus grand.</p>`,
    quiz: [
      { q: "Un log se termine par « ##[error]Process completed with exit code 127. ». Que s'est-il passé ?", options: ["Les tests ont échoué", "Une commande est introuvable sur le runner (pas installée, ou mal orthographiée)", "Le runner a manqué de mémoire", "Le jeton a expiré"], answer: 1, explain: "127 est le code du shell pour « command not found »." },
      { q: "Le pipeline échoue depuis ce matin sans que personne n'ait poussé de code. Hypothèse la plus probable ?", options: ["Un bug aléatoire, il faut relancer jusqu'à ce que ça passe", "Une dépendance non épinglée a publié une nouvelle version, ou l'image du runner a changé", "Le dépôt est corrompu", "GitHub a supprimé le workflow"], answer: 1, explain: "Sans changement de code, cherche ce qui bouge tout seul : versions flottantes (latest, >=), ubuntu-latest, actions sur un tag mobile." }
    ],
    challenge: {
      prompt: Y`<p>Deux jobs sont rouges. Voici leurs logs :</p>
<pre class="log-inline">Run actions/setup-python@v7
  with:
    python-version: 3.1
##[error]The version '3.1' with architecture 'x64' was not found for Ubuntu 24.04.
The list of all available versions can be found here: https://raw.githubusercontent.com/actions/python-versions/main/versions-manifest.json</pre>
<pre class="log-inline">Run ruff check .
/home/runner/work/_temp/7f3c2a.sh: line 1: ruff: command not found
##[error]Process completed with exit code 127.</pre>
<p>Corrige le workflow pour que les deux jobs passent : le job @@tests@@ doit utiliser Python @@3.10@@, et le job @@lint@@ doit installer @@ruff@@ (@@pip install ruff@@) avant de l'appeler. Plus aucun avertissement.</p>`,
      starter: Y`name: CI
on: [push, pull_request]
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - run: ruff check .
  tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-python@v7
        with:
          python-version: 3.10
      - run: pip install -r requirements.txt
      - run: pytest -q
`,
      solution: Y`name: CI
on: [push, pull_request]
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - run: pip install ruff
      - run: ruff check .
  tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-python@v7
        with:
          python-version: "3.10"
      - run: pip install -r requirements.txt
      - run: pytest -q
`,
      checks: {
        with: { tests: { "actions/setup-python": { "python-version": "3.10" } } }, order: { lint: ["pip install ruff", "ruff check"] }, noWarnings: true,
        scenarios: [{ event: { name: "pull_request", head: "fix/ci", base: "main" }, run: ["lint", "tests"] }]
      },
      hint: "Le premier log est le piège du chapitre 3 : 3.10 sans guillemets devient 3.1. Le second : exit code 127, ruff n'est pas installé sur le runner."
    }
  },
  {
    id: "ci-19", section: "Dépanner un pipeline", title: "Reproduire, déboguer et traquer les tests instables", xp: 80,
    theory: Y`<p><strong>Obtenir plus d'informations.</strong></p>
<ul><li>« Re-run failed jobs » avec la case <em>Enable debug logging</em> : GitHub affiche alors les détails internes du runner et des actions. Pour l'activer en permanence, crée la variable de dépôt @@ACTIONS_STEP_DEBUG@@ à @@true@@ ;</li><li>une étape qui affiche l'état : @@env | sort@@, @@ls -la@@, @@pip freeze@@ ;</li><li>conserver les preuves avec @@upload-artifact@@ et @@if: failure()@@ : logs, captures d'écran, traces Playwright.</li></ul>
<p><strong>Reproduire en local.</strong> L'outil <em>act</em> exécute un workflow sur ta machine dans Docker (@@act pull_request -j tests@@), ce qui suffit pour la plupart des erreurs de commandes. Sinon, lance l'image du runner ou ton propre conteneur et rejoue les commandes du log une par une. Le but est de réduire la boucle : modifier, pousser, attendre 8 minutes, recommencer coûte très cher.</p>
<p><strong>Les tests instables (« flaky »)</strong> passent ou échouent sans changement de code. Causes fréquentes : un test qui dépend de l'heure ou du fuseau, de l'ordre d'exécution, d'un état partagé entre tests, d'un service réseau externe, ou d'une attente fixe (@@sleep 2@@) au lieu d'une attente sur une condition. Relancer jusqu'au vert cache le problème et apprend à l'équipe à ignorer le rouge. On isole le test (quarantaine, ticket), on trouve la cause, et on mesure le taux d'échec.</p>
<p><strong>Les garde-fous.</strong> Un job bloqué consomme jusqu'à 6 heures par défaut : fixe @@timeout-minutes@@. Dans Boucle, les tests e2e attendent une <em>condition</em> (le bouton redevient cliquable, plus aucun texte de progression) plutôt qu'un délai fixe : c'est ce qui a supprimé l'instabilité du test seaborn au sprint 2.2.</p>`,
    quiz: [
      { q: "Un test e2e échoue une fois sur dix, sans changement de code. Bonne réaction ?", options: ["Ajouter une relance automatique et oublier", "Le traiter comme un bug : reproduire, chercher la cause (attente fixe, ordre, état partagé), le mettre en quarantaine en attendant", "Supprimer le test", "Augmenter tous les timeouts à 10 minutes"], answer: 1, explain: "Un test instable détruit la confiance dans le pipeline : on finit par ignorer les vrais échecs." },
      { q: "Pourquoi fixer timeout-minutes sur un job ?", options: ["Pour qu'il aille plus vite", "Un job bloqué (attente réseau, boucle infinie) tournerait sinon jusqu'à 6 heures, en consommant des minutes et en bloquant la file", "C'est obligatoire", "Pour activer le cache"], answer: 1, explain: "Mieux vaut un échec rapide et clair qu'un pipeline figé." }
    ],
    challenge: {
      prompt: Y`<p>Les tests e2e sont parfois bloqués pendant des heures, et quand ils échouent, on n'a aucune trace. Rends le job @@e2e@@ débogable :</p><ol><li>il s'arrête au bout de @@15@@ minutes au plus ;</li><li>en cas d'échec <strong>seulement</strong>, il conserve le dossier @@playwright-report/@@ dans un artefact @@rapport-e2e@@ (@@actions/upload-artifact@v7@@), gardé @@7@@ jours (@@retention-days@@).</li></ol>`,
      starter: Y`name: E2E
on: [push, pull_request]
jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - run: npm ci
      - run: npx playwright test
`,
      solution: Y`name: E2E
on: [push, pull_request]
jobs:
  e2e:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v7
      - run: npm ci
      - run: npx playwright test
      - name: Garder le rapport
        if: failure()
        uses: actions/upload-artifact@v7
        with:
          name: rapport-e2e
          path: playwright-report/
          retention-days: 7
`,
      checks: {
        timeout: { e2e: 15 }, with: { e2e: { "actions/upload-artifact": { name: "rapport-e2e", path: "playwright-report/", "retention-days": 7 } } },
        scenarios: [
          { event: { name: "push", branch: "main" }, fail: ["e2e"], run: ["e2e"], stepsRun: { e2e: ["actions/upload-artifact"] } },
          { event: { name: "push", branch: "main" }, run: ["e2e"], stepsSkipped: { e2e: ["actions/upload-artifact"] } }
        ]
      },
      hint: "timeout-minutes: 15 se place au niveau du job, à côté de runs-on. L'étape d'upload porte « if: failure() » et un bloc with avec name, path et retention-days: 7 (un nombre, sans guillemets)."
    }
  },
  {
    id: "ci-20", section: "Panorama des outils", title: "GitLab CI, Jenkins, Azure DevOps", xp: 80,
    theory: Y`<p>Les concepts sont les mêmes partout : un fichier versionné décrit des étapes, des agents les exécutent, des conditions et des dépendances les ordonnent. Seule la syntaxe change.</p>
<div class="table-wrap"><table><thead><tr><th>Concept</th><th>GitHub Actions</th><th>GitLab CI</th><th>Jenkins</th><th>Azure DevOps</th></tr></thead><tbody>
<tr><td>Fichier</td><td>@@.github/workflows/*.yml@@</td><td>@@.gitlab-ci.yml@@</td><td>@@Jenkinsfile@@ (Groovy)</td><td>@@azure-pipelines.yml@@</td></tr>
<tr><td>Machine</td><td>runner</td><td>runner</td><td>agent / nœud</td><td>agent (pool)</td></tr>
<tr><td>Étapes groupées</td><td>job</td><td>job, dans un stage</td><td>stage</td><td>stage → job</td></tr>
<tr><td>Ordre</td><td>@@needs@@</td><td>@@stages@@ ou @@needs@@</td><td>ordre des stages</td><td>@@dependsOn@@</td></tr>
<tr><td>Condition</td><td>@@if@@</td><td>@@rules@@</td><td>@@when@@</td><td>@@condition@@</td></tr>
<tr><td>Secrets</td><td>@@secrets.X@@</td><td>variables CI/CD masquées</td><td>credentials</td><td>variable groups, Key Vault</td></tr></tbody></table></div>
<p><strong>GitLab CI</strong> : les jobs appartiennent à des stages qui s'enchaînent, chaque job tourne par défaut dans une image Docker.</p>
~~~yaml norun
stages: [test, deploy]
tests:
  stage: test
  image: python:3.13
  script:
    - pip install -r requirements.txt
    - pytest -q
deploy:
  stage: deploy
  script: ./deploy.sh
  rules:
    - if: $CI_COMMIT_BRANCH == "main"
~~~
<p><strong>Jenkins</strong> : serveur autohébergé, très répandu dans les grandes entreprises, extensible par plugins. Le pipeline déclaratif s'écrit en Groovy :</p>
~~~groovy
pipeline {
  agent any
  stages {
    stage('Tests') {
      steps { sh 'pip install -r requirements.txt && pytest -q' }
    }
    stage('Déployer') {
      when { branch 'main' }
      steps { sh './deploy.sh' }
    }
  }
}
~~~
<p><strong>Azure DevOps</strong> (@@stages@@, @@jobs@@, @@steps@@, @@dependsOn@@) est courant dans les entreprises Microsoft, et <strong>CircleCI</strong> s'organise en @@jobs@@ et @@workflows@@ avec des modules partagés (« orbs »). En entretien, montrer que tu raisonnes en concepts (déclencheur, isolation, ordre, secrets, artefacts) compte plus que connaître chaque syntaxe.</p>`,
    quiz: [
      { q: "Dans GitLab CI, qu'est-ce qui remplace le if d'un job GitHub Actions ?", options: ["stage", "rules", "image", "script"], answer: 1, explain: "rules décide si le job est ajouté au pipeline, selon la branche, les fichiers modifiés, des variables…" },
      { q: "Ton futur employeur utilise Jenkins et tu connais GitHub Actions. Quel argument tient en entretien ?", options: ["Jenkins est dépassé, il faut migrer", "Les concepts se transposent (étapes, agents, conditions, secrets, artefacts) ; seule la syntaxe change, et je l'apprends vite", "Je ne travaillerai qu'avec GitHub Actions", "Jenkins ne fait pas de CI"], answer: 1, explain: "Les recruteurs cherchent la compréhension des principes, pas un outil précis." }
    ],
    challenge: {
      prompt: Y`<p>Ton équipe migre de GitLab vers GitHub. Traduis ce @@.gitlab-ci.yml@@ en workflow GitHub Actions :</p>
<pre class="log-inline">stages: [test, build, deploy]
tests:
  stage: test
  image: python:3.13
  script:
    - pip install -r requirements.txt
    - pytest -q
build:
  stage: build
  script:
    - docker build -t api .
deploy:
  stage: deploy
  script:
    - ./deploy.sh
  rules:
    - if: $CI_COMMIT_BRANCH == "main"</pre>
<p>Garde les mêmes noms de jobs (@@tests@@, @@build@@, @@deploy@@), le même ordre (@@needs@@), les mêmes commandes, et le même déclenchement : sur chaque push et chaque PR, @@deploy@@ seulement pour un push sur @@main@@. Pour Python 3.13, utilise @@actions/setup-python@@ ou @@container: python:3.13@@.</p>`,
      starter: Y`name: CI
on: [push, pull_request]
# Traduis les trois jobs GitLab ici.
`,
      solution: Y`name: CI
on: [push, pull_request]
jobs:
  tests:
    runs-on: ubuntu-latest
    container: python:3.13
    steps:
      - uses: actions/checkout@v7
      - run: pip install -r requirements.txt
      - run: pytest -q
  build:
    needs: tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - run: docker build -t api .
  deploy:
    needs: build
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - run: ./deploy.sh
`,
      checks: {
        jobs: ["tests", "build", "deploy"], needs: { tests: [], build: ["tests"], deploy: ["build"] },
        run: { tests: ["pip install -r requirements.txt", "pytest -q"], build: ["docker build -t api ."], deploy: ["./deploy.sh"] },
        uses: { tests: ["actions/checkout"], build: ["actions/checkout"], deploy: ["actions/checkout"] },
        scenarios: [
          { event: { name: "pull_request", head: "feature/x", base: "main" }, run: ["tests", "build"], skip: ["deploy"] },
          { event: { name: "push", branch: "main" }, run: ["tests", "build", "deploy"] },
          { event: { name: "push", branch: "develop" }, run: ["tests", "build"], skip: ["deploy"] }
        ]
      },
      hint: "Chaque stage GitLab devient un job, et l'ordre des stages devient des needs. Le rules de deploy devient un if. N'oublie pas actions/checkout : GitLab récupère le code automatiquement, GitHub Actions non."
    }
  },
  {
    id: "ci-21", section: "Projet et entretien", title: "Projet : le pipeline complet d'une API", xp: 150,
    theory: Y`<p>Ce projet rassemble tout le cours. L'API Python (FastAPI) d'une petite équipe a besoin d'un pipeline de production :</p>
<ul><li><strong>Qualité</strong> : lint et tests en parallèle, tests sur deux versions de Python avec cache ;</li><li><strong>Artefact</strong> : une image Docker construite une fois, poussée sur @@ghcr.io@@ seulement depuis @@main@@ ;</li><li><strong>Livraison</strong> : préproduction automatique, production derrière un environnement protégé, jamais deux déploiements en même temps ;</li><li><strong>Sécurité</strong> : @@contents: read@@ par défaut, chaque droit supplémentaire dans le seul job qui en a besoin ;</li><li><strong>Efficacité</strong> : sur une PR, un nouveau push annule l'exécution précédente.</li></ul>
<p>Le schéma attendu :</p>
~~~text
           ┌─ lint ──┐
PR, push ──┤         ├─► image ─► deploy-staging ─► deploy-production
           └─ tests ─┘            (push sur main)    (environnement protégé)
             ×2 Python
~~~
<p>Prends le temps : écris d'abord la structure (jobs et @@needs@@), regarde le graphe, puis ajoute les détails un par un en vérifiant à chaque étape. Quand tu as fini, mets-le en vrai dans ton dépôt d'entraînement, avec une petite API FastAPI et son Dockerfile : c'est un projet à montrer en entretien.</p>`,
    setup: Y`<p><strong>Pour le faire tourner pour de vrai</strong> dans ton dépôt d'entraînement :</p>
<ol><li>une API minimale : @@api/main.py@@ avec FastAPI et une route @@/health@@, un test @@tests/test_health.py@@ avec @@TestClient@@, un @@requirements.txt@@ et un @@Dockerfile@@ (chapitre 7) ;</li><li>dans <em>Settings → Environments</em>, crée @@staging@@ et @@production@@, et ajoute-toi comme <em>required reviewer</em> sur @@production@@ ;</li><li>remplace @@./deploy.sh@@ par un vrai déploiement plus tard (parcours Cloud), ou par @@echo@@ pour l'instant ;</li><li>pousse, ouvre une PR, puis fusionne : regarde la production attendre ton approbation dans l'onglet <em>Actions</em>.</li></ol>`,
    quiz: [
      { q: "Pourquoi construire l'image une seule fois (job image) plutôt que dans chaque job de déploiement ?", options: ["Pour économiser de la place", "Pour que la production reçoive exactement l'image testée et déployée en préproduction", "Parce que Docker l'impose", "Pour éviter les tags"], answer: 1, explain: "Reconstruire, c'est risquer une différence (dépendance qui a bougé) entre ce qui a été validé et ce qui part en production." }
    ],
    challenge: {
      prompt: Y`<p>Complète ce pipeline. Il doit :</p><ol><li>se déclencher sur les PR vers @@main@@ et les pushes sur @@main@@ ; avoir @@contents: read@@ au niveau du workflow ; annuler l'exécution précédente sur la même branche ou PR (@@concurrency@@ avec @@cancel-in-progress: true@@) ;</li><li>@@lint@@ (@@ruff check .@@) et @@tests@@ (@@pytest -q@@) en parallèle ; @@tests@@ en matrice @@python@@ : @@"3.13"@@ et @@"3.14"@@, avec le cache pip de @@setup-python@@ ;</li><li>@@image@@ attend @@lint@@ et @@tests@@, a @@contents: read@@ et @@packages: write@@, construit avec @@docker/build-push-action@v7@@ et ne se connecte à @@ghcr.io@@ (@@docker/login-action@v4@@) que hors PR ;</li><li>@@deploy-staging@@ (environnement @@staging@@) attend @@image@@, seulement pour un push sur @@main@@ ;</li><li>@@deploy-production@@ (environnement @@production@@) attend @@deploy-staging@@, sans jamais tourner deux fois en même temps ni être annulé.</li></ol>`,
      starter: Y`name: API
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - run: pip install ruff
      - run: ruff check .
  tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-python@v7
        with:
          python-version: "3.13"
      - run: pip install -r requirements.txt
      - run: pytest -q
`,
      solution: Y`name: API
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]
permissions:
  contents: read
concurrency:
  group: \${{ github.workflow }}-\${{ github.ref }}
  cancel-in-progress: true
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - run: pip install ruff
      - run: ruff check .
  tests:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python: ["3.13", "3.14"]
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-python@v7
        with:
          python-version: \${{ matrix.python }}
          cache: pip
      - run: pip install -r requirements.txt
      - run: pytest -q
  image:
    needs: [lint, tests]
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v7
      - uses: docker/setup-buildx-action@v4
      - if: github.event_name != 'pull_request'
        uses: docker/login-action@v4
        with:
          registry: ghcr.io
          username: \${{ github.actor }}
          password: \${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v7
        with:
          push: \${{ github.event_name != 'pull_request' }}
          tags: ghcr.io/\${{ github.repository }}:\${{ github.sha }}
  deploy-staging:
    needs: image
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - run: ./deploy.sh staging \${{ github.sha }}
  deploy-production:
    needs: deploy-staging
    runs-on: ubuntu-latest
    environment: production
    concurrency:
      group: production
      cancel-in-progress: false
    steps:
      - run: ./deploy.sh production \${{ github.sha }}
`,
      checks: {
        branches: { pull_request: ["main"], push: ["main"] }, permissions: { workflow: { contents: "read" }, image: { contents: "read", packages: "write" } },
        maxPermissions: { contents: "read", packages: "write" }, concurrency: { cancel: true },
        needs: { lint: [], tests: [], image: ["lint", "tests"], "deploy-staging": ["image"], "deploy-production": ["deploy-staging"] },
        matrix: { tests: { python: ["3.13", "3.14"] } }, cache: { tests: "pip" },
        uses: { image: ["docker/login-action", "docker/build-push-action"] }, with: { image: { "docker/login-action": { registry: "ghcr.io" } } },
        environment: { "deploy-staging": "staging", "deploy-production": "production" }, jobConcurrency: { "deploy-production": { cancel: false } },
        scenarios: [
          { event: { name: "pull_request", head: "feature/x", base: "main" }, run: ["lint", "tests", "image"], skip: ["deploy-staging", "deploy-production"], stepsSkipped: { image: ["docker/login-action"] } },
          { event: { name: "push", branch: "main" }, run: ["lint", "tests", "image", "deploy-staging", "deploy-production"], stepsRun: { image: ["docker/login-action"] } },
          { event: { name: "push", branch: "main" }, fail: ["tests"], run: ["lint"], skip: ["image", "deploy-staging", "deploy-production"] }
        ]
      },
      hint: "Avance par étapes et vérifie entre chacune. 1. permissions et concurrency au premier niveau. 2. La matrice dans tests. 3. Le job image (chapitre 7). 4. Les deux déploiements (chapitre 8). Le panneau sous l'éditeur montre quels critères manquent."
    }
  },
  {
    id: "ci-22", section: "Projet et entretien", title: "Questions d'entretien CI/CD", xp: 60, theoryOnly: true,
    theory: Y`<p>Les questions qui reviennent en entretien DevOps ou cloud, avec une réponse modèle. Essaie de répondre à voix haute avant d'ouvrir chacune : en entretien, on évalue la clarté autant que le contenu.</p>
<div class="qa">
<details><summary>Quelle différence entre intégration continue, livraison continue et déploiement continu ?</summary><p>L'intégration continue fusionne souvent dans la branche principale, et chaque changement est construit et testé automatiquement. La livraison continue garantit que chaque version qui passe le pipeline est prête à partir en production, sur décision humaine. Le déploiement continu supprime ce clic : tout ce qui passe le pipeline part en production. Le choix dépend du risque métier et de la confiance dans les tests.</p></details>
<details><summary>Décris un pipeline que tu as construit.</summary><p>Structure STAR, avec du concret. Par exemple Boucle : deux jobs de test en parallèle (validation de chaque exercice avec CPython, g++ et l'interpréteur du navigateur ; tests e2e Playwright), publication sur GitHub Pages seulement pour main, permissions minimales, actions épinglées par SHA avec Dependabot. Parle d'un problème rencontré et de ce que tu as changé : la panne des miroirs apt réglée en utilisant le Chrome du runner.</p></details>
<details><summary>Comment gères-tu les secrets dans un pipeline ?</summary><p>Jamais dans le code ni dans les logs. Des secrets chiffrés au niveau de l'environnement de déploiement, avec le moins de portée possible. Mieux : pas de secret longue durée du tout, grâce à OIDC qui échange un jeton signé contre des identifiants temporaires. Permissions du jeton du pipeline au minimum, rotation régulière, et révocation immédiate en cas de fuite.</p></details>
<details><summary>Le pipeline est devenu lent (25 minutes). Que fais-tu ?</summary><p>Mesurer d'abord : quel job, quelle étape. Puis paralléliser les jobs indépendants, mettre en cache les dépendances, ne lancer que ce qui est concerné (filtres de chemins), découper les tests e2e en plusieurs machines, construire l'image une seule fois et la réutiliser, annuler les exécutions dépassées sur les PR. Enfin, vérifier que la pyramide des tests n'est pas inversée.</p></details>
<details><summary>Un test échoue une fois sur dix. Que fais-tu ?</summary><p>C'est un bug, pas du bruit. Je reproduis (relances en boucle, même graine aléatoire), je cherche les causes classiques : attente fixe, dépendance à l'heure ou à l'ordre, état partagé, service externe. En attendant, quarantaine avec un ticket, pour que l'équipe continue de faire confiance au rouge.</p></details>
<details><summary>Blue/green, canary, rolling : lequel choisir ?</summary><p>Rolling est le défaut simple, sans coupure. Blue/green donne un retour arrière instantané au prix d'une infrastructure doublée pendant la bascule. Canary limite l'exposition d'une nouvelle version à une fraction du trafic, avec une surveillance des métriques : idéal pour les changements risqués à fort trafic. Dans tous les cas, des migrations de base de données compatibles avec la version précédente.</p></details>
<details><summary>Une mise en production casse. Rollback ou roll forward ?</summary><p>Si la cause n'est pas évidente, rollback immédiat vers l'image précédente (taguée par version) pour rétablir le service, puis analyse sans pression. Roll forward seulement si le correctif est trivial et que le pipeline est rapide. Ensuite, un post-mortem sans recherche de coupable, et un test qui aurait détecté le problème.</p></details>
<details><summary>Comment sécuriser la chaîne d'approvisionnement du pipeline ?</summary><p>Épingler les actions et les images sur un SHA ou un digest, mettre à jour via des PR relues (Dependabot), permissions minimales, pas de pull_request_target avec le code d'un fork, analyse des dépendances (pip-audit, npm audit), et idéalement des artefacts signés avec leur provenance (attestations, SLSA).</p></details>
<details><summary>Que sont les métriques DORA ?</summary><p>Cinq mesures de la performance de livraison : délai de mise en production d'un changement, fréquence de déploiement, temps de rétablissement après un déploiement raté (débit), taux d'échec des changements et taux de reprise (instabilité). Les équipes les plus performantes sont rapides et stables en même temps, grâce à de petits changements fréquents.</p></details>
<details><summary>Terraform dans un pipeline : comment éviter les catastrophes ?</summary><p>Plan sur chaque PR, publié en commentaire et relu ; apply seulement après fusion, dans un environnement protégé ; state distant avec verrou ; identifiants OIDC distincts pour plan (lecture) et apply (écriture) ; détection de dérive planifiée.</p></details>
</div>`,
    practice: { title: "S'entraîner", body: Y`<p>Choisis trois questions et enregistre-toi en y répondant en deux minutes chacune. Réécoute : as-tu donné un exemple concret ? Une limite ou un compromis ?</p><p>Prépare aussi ton histoire de pipeline : le projet de la leçon précédente, déployé dans ton dépôt d'entraînement, avec le lien vers l'onglet <em>Actions</em>. Un recruteur peut le parcourir avant l'entretien.</p>` },
    quiz: [
      { q: "En entretien, on te demande « Comment accélérer un pipeline de 25 minutes ? ». Quelle réponse commence le mieux ?", options: ["« J'ajoute un runner plus puissant »", "« Je mesure d'abord quelles étapes coûtent le plus, puis je parallélise, mets en cache et ne lance que ce qui est concerné »", "« Je supprime les tests e2e »", "« Je lance le pipeline une fois par jour »"], answer: 1, explain: "Mesurer avant d'optimiser montre une démarche d'ingénieur ; les solutions viennent ensuite, ciblées." },
      { q: "Quelle réponse montre le mieux la compréhension d'OIDC ?", options: ["« C'est un type de secret »", "« Le pipeline prouve son identité avec un jeton signé par GitHub, et le cloud lui donne des identifiants temporaires limités à ce dépôt et cette branche »", "« C'est le nouveau nom de SSH »", "« C'est un plugin Jenkins »"], answer: 1, explain: "Identité vérifiable, identifiants temporaires, portée limitée : les trois idées à placer." }
    ]
  }
];
