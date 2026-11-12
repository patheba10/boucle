/* Cours CI/CD — chapitres 4 (tests dans le pipeline) et 5 (matrices, cache, artefacts, concurrence). */
import { Y } from "./tag.js";

export default [
  {
    id: "ci-07", section: "Tester dans le pipeline", title: "La pyramide des tests dans la CI", xp: 80,
    theory: Y`<p>Un pipeline enchaîne des vérifications de la plus rapide à la plus lente : l'erreur la plus bête doit sortir en premier.</p>
<ol><li><strong>Lint et formatage</strong> (ruff, eslint, terraform fmt) : quelques secondes, aucun code exécuté ;</li><li><strong>Tests unitaires</strong> : une fonction à la fois, sans réseau ni base de données. Des centaines par seconde ;</li><li><strong>Tests d'intégration</strong> : plusieurs morceaux ensemble, avec une vraie base de données ou une vraie file de messages ;</li><li><strong>Tests de bout en bout (e2e)</strong> : l'application entière, pilotée comme un utilisateur (Playwright, Cypress). Lents et plus fragiles, donc peu nombreux.</li></ol>
<p>C'est la <strong>pyramide des tests</strong> : beaucoup de tests unitaires à la base, peu d'e2e au sommet. Dans la CI, les jobs rapides passent devant, et les lents ne démarrent que s'ils ont une chance de servir.</p>
<p><strong>Une vraie base de données dans la CI.</strong> La clé @@services@@ démarre des conteneurs à côté du job : PostgreSQL, Redis… Le runner les expose sur @@localhost@@. L'option @@--health-cmd@@ fait attendre le job jusqu'à ce que la base soit prête.</p>
~~~yaml
name: Intégration
on: pull_request
jobs:
  integration:
    runs-on: ubuntu-latest
    services:
      redis:
        image: redis:7
        ports: ["6379:6379"]
        options: --health-cmd "redis-cli ping" --health-interval 5s --health-retries 10
    env:
      REDIS_URL: redis://localhost:6379
    steps:
      - uses: actions/checkout@v7
      - run: pytest tests/integration -q
~~~
<p><strong>Seuils de qualité.</strong> Un pipeline peut aussi échouer quand la couverture baisse (@@pytest --cov --cov-fail-under=80@@) ou qu'une dépendance a une faille connue (@@pip-audit@@, @@npm audit@@). Un seuil trop haut pousse à écrire des tests inutiles : on vise les parties critiques plutôt qu'un chiffre.</p>`,
    quiz: [
      { q: "Pourquoi lancer le lint avant les tests e2e ?", options: ["Le lint est plus important", "Il échoue en quelques secondes sur des erreurs bêtes : inutile de payer 10 minutes d'e2e pour une faute de frappe", "Les e2e ont besoin du lint pour démarrer", "GitHub l'impose"], answer: 1, explain: "On ordonne les vérifications par coût : le retour le plus rapide d'abord." },
      { q: "Ton test d'intégration échoue avec « connection refused » sur localhost:5432 alors que le service postgres est déclaré. Piste la plus probable ?", options: ["PostgreSQL n'existe pas sur Ubuntu", "Le port n'est pas publié (ports: [\"5432:5432\"]) ou le job démarre avant que la base soit prête (options --health-cmd)", "Il faut un runner Windows", "Les services ne marchent que sur push"], answer: 1, explain: "Sans ports, le conteneur n'est pas joignable depuis le runner ; sans health check, le job peut se connecter trop tôt." }
    ],
    challenge: {
      prompt: Y`<p>Ajoute un job @@integration@@ à ce workflow :</p><ol><li>il attend que @@unitaires@@ réussisse ;</li><li>il démarre un service nommé @@postgres@@ (image @@postgres:17@@, mot de passe @@test@@ via @@POSTGRES_PASSWORD@@, port @@5432@@ publié, avec un health check @@pg_isready@@) ;</li><li>il définit la variable @@DATABASE_URL@@ à @@postgresql://postgres:test@localhost:5432/postgres@@ ;</li><li>il récupère le code, installe les dépendances et lance @@pytest tests/integration -q@@.</li></ol>`,
      starter: Y`name: Tests
on: [push, pull_request]
jobs:
  unitaires:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-python@v7
        with:
          python-version: "3.13"
      - run: pip install -r requirements.txt
      - run: pytest tests/unit -q
`,
      solution: Y`name: Tests
on: [push, pull_request]
jobs:
  unitaires:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-python@v7
        with:
          python-version: "3.13"
      - run: pip install -r requirements.txt
      - run: pytest tests/unit -q
  integration:
    needs: unitaires
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:17
        env:
          POSTGRES_PASSWORD: test
        ports: ["5432:5432"]
        options: --health-cmd pg_isready --health-interval 5s --health-retries 10
    env:
      DATABASE_URL: postgresql://postgres:test@localhost:5432/postgres
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-python@v7
        with:
          python-version: "3.13"
      - run: pip install -r requirements.txt
      - run: pytest tests/integration -q
`,
      checks: {
        needs: { integration: ["unitaires"] }, services: { integration: ["postgres"] }, contains: ["postgres:17", "pg_isready", "5432:5432"],
        env: { integration: { DATABASE_URL: "postgresql://postgres:test@localhost:5432/postgres" } },
        order: { integration: ["actions/checkout", "pip install", "pytest tests/integration"] },
        scenarios: [
          { event: { name: "pull_request", head: "feature/panier", base: "main" }, run: ["unitaires", "integration"] },
          { event: { name: "pull_request", head: "feature/panier", base: "main" }, fail: ["unitaires"], skip: ["integration"] }
        ]
      },
      hint: "Sous le job integration : needs, runs-on, puis « services: » avec une clé postgres (image, env, ports, options), « env: » pour DATABASE_URL, et enfin les steps."
    }
  },
  {
    id: "ci-08", section: "Tester dans le pipeline", title: "Étude de cas : la CI de Boucle", xp: 90,
    theory: Y`<p>Boucle se teste avec sa propre CI, à chaque PR. Voici sa structure, simplifiée :</p>
~~~yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
permissions:
  contents: read
concurrency:
  group: ci-\${{ github.ref }}
  cancel-in-progress: true
jobs:
  validate-content:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run test:unit
      - run: npm run validate
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pip install -r requirements-dev.txt
      - run: python -m pytest -q tests/e2e
  deploy-github-pages:
    needs: [validate-content, e2e]
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
    steps:
      - uses: actions/checkout@v4
      - uses: actions/upload-pages-artifact@v3
        with:
          path: ./public
      - uses: actions/deploy-pages@v4
~~~
<p>Ce qu'il faut remarquer :</p>
<ul><li><strong>Deux jobs de test en parallèle.</strong> @@validate-content@@ lance les tests unitaires des moteurs (simulateur Git, moteur des workflows), puis vérifie chaque exercice avec CPython, g++ et l'interpréteur C++ : chaque solution doit passer, chaque code de départ doit échouer. @@e2e@@ ouvre le site dans Chromium et refait le parcours d'un élève, y compris chaque solution dans le vrai navigateur.</li><li><strong>Un déploiement conditionnel.</strong> La publication sur GitHub Pages attend les deux jobs et ne tourne que pour un push sur @@main@@ : une PR est testée, jamais publiée.</li><li><strong>Des permissions au plus juste.</strong> Le workflow n'a que @@contents: read@@ ; seul le job de déploiement reçoit @@pages: write@@ et @@id-token: write@@.</li><li><strong>La concurrence.</strong> Si tu pousses deux fois de suite sur une PR, l'exécution précédente est annulée.</li></ul>
<p><strong>Ce que l'historique de Boucle a appris.</strong> Au sprint 3.1, le job e2e échouait avant tout test : les miroirs apt d'Ubuntu étaient injoignables. Le correctif a été d'utiliser le Chrome déjà installé sur le runner. Une CI dépend de services extérieurs : on réduit ces dépendances, et on rend les échecs lisibles.</p>`,
    quiz: [
      { q: "Pourquoi la CI de Boucle ne publie-t-elle pas le site sur une pull request ?", options: ["GitHub Pages ne marche pas sur les PR", "Une PR n'est pas encore relue ni fusionnée : on la teste, mais seul main représente ce qui doit être en ligne", "Pour économiser des minutes", "Les PR n'ont pas accès au code"], answer: 1, explain: "Le if du job de déploiement exige un push sur main : tester sur chaque PR, publier seulement ce qui a été accepté." },
      { q: "Que fait concurrency avec cancel-in-progress: true et le groupe ci-${{ github.ref }} ?", options: ["Il lance chaque job deux fois", "Une nouvelle exécution sur la même branche ou PR annule celle qui tourne encore", "Il empêche deux PR différentes de tourner en même temps", "Il met les jobs en file d'attente pour toujours"], answer: 1, explain: "Le groupe dépend de la ref : deux pushes sur la même PR partagent le groupe, deux PR différentes non." }
    ],
    challenge: {
      prompt: Y`<p>Reconstruis un pipeline sur le modèle de celui de Boucle :</p><ol><li>@@validate@@ (@@npm ci@@ puis @@npm run validate@@) et @@e2e@@ (@@npm run test:e2e@@) tournent en parallèle sur chaque push et chaque PR ;</li><li>si les tests e2e échouent, @@e2e@@ conserve les captures d'écran : étape @@actions/upload-artifact@v7@@ avec @@name: captures@@ et @@path: test-results/@@, <strong>seulement en cas d'échec</strong> ;</li><li>@@deploy@@ attend les deux, ne tourne que pour un push sur @@main@@, dans l'environnement @@github-pages@@ ;</li><li>le workflow n'a que @@contents: read@@ ; seul @@deploy@@ reçoit @@pages: write@@ et @@id-token: write@@.</li></ol>`,
      starter: Y`name: CI
on:
  push:
    branches: [main]
  pull_request:
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - run: npm ci
      - run: npm run validate
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - run: npm ci
      - run: npm run test:e2e
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/upload-pages-artifact@v5
        with:
          path: ./public
      - uses: actions/deploy-pages@v5
`,
      solution: Y`name: CI
on:
  push:
    branches: [main]
  pull_request:
permissions:
  contents: read
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - run: npm ci
      - run: npm run validate
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - run: npm ci
      - run: npm run test:e2e
      - name: Garder les captures
        if: failure()
        uses: actions/upload-artifact@v7
        with:
          name: captures
          path: test-results/
  deploy:
    needs: [validate, e2e]
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    environment: github-pages
    steps:
      - uses: actions/checkout@v7
      - uses: actions/upload-pages-artifact@v5
        with:
          path: ./public
      - uses: actions/deploy-pages@v5
`,
      checks: {
        needs: { validate: [], e2e: [], deploy: ["validate", "e2e"] }, environment: { deploy: "github-pages" },
        permissions: { workflow: { contents: "read" }, deploy: { pages: "write", "id-token": "write" } },
        with: { e2e: { "actions/upload-artifact": { name: "captures", path: "test-results/" } } },
        scenarios: [
          { event: { name: "pull_request", head: "feature/quiz", base: "main" }, run: ["validate", "e2e"], skip: ["deploy"] },
          { event: { name: "push", branch: "main" }, run: ["validate", "e2e", "deploy"], stepsSkipped: { e2e: ["Garder les captures"] } },
          { event: { name: "push", branch: "main" }, fail: ["e2e"], skip: ["deploy"], stepsRun: { e2e: ["Garder les captures"] } }
        ]
      },
      hint: "L'étape d'upload a un name « Garder les captures » (pour qu'on la reconnaisse), « if: failure() », uses et with. Pour deploy : needs, if, permissions et « environment: github-pages »."
    }
  },
  {
    id: "ci-09", section: "Matrices, cache, artefacts", title: "Matrices et cache des dépendances", xp: 80,
    theory: Y`<p><strong>Matrice.</strong> @@strategy.matrix@@ lance le même job pour chaque combinaison de valeurs : plusieurs versions de Python, plusieurs systèmes. Chaque combinaison est un job à part, en parallèle.</p>
~~~yaml
name: Matrice
on: push
jobs:
  tests:
    runs-on: \${{ matrix.os }}
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, macos-latest]
        python: ["3.13", "3.14"]
        include:
          - os: ubuntu-latest
            python: "3.15-dev"
            experimental: true
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-python@v7
        with:
          python-version: \${{ matrix.python }}
      - run: pytest -q
~~~
<ul><li>@@exclude@@ retire des combinaisons, @@include@@ en ajoute (ou ajoute une variable à une combinaison existante) ;</li><li>par défaut, @@fail-fast: true@@ annule toute la matrice au premier échec. Avec @@false@@, on voit toutes les combinaisons qui cassent ;</li><li>@@max-parallel@@ limite le nombre de jobs simultanés.</li></ul>
<p><strong>Cache.</strong> Chaque job démarre sur une machine vide : réinstaller les dépendances à chaque fois coûte des minutes. Les actions @@setup-python@@ et @@setup-node@@ ont une option @@cache@@ (@@pip@@, @@npm@@…). Sinon, @@actions/cache@@ sauvegarde un dossier sous une <strong>clé</strong>, en général calculée avec @@hashFiles('requirements.txt')@@ : quand le fichier change, la clé change et le cache est reconstruit.</p>
~~~yaml
name: Cache
on: push
jobs:
  tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/cache@v6
        with:
          path: ~/.cache/pip
          key: pip-\${{ runner.os }}-\${{ hashFiles('requirements.txt') }}
          restore-keys: pip-\${{ runner.os }}-
      - run: pip install -r requirements.txt
~~~
<p>Le cache accélère, il ne doit jamais être nécessaire pour réussir : un pipeline doit passer avec un cache vide.</p>`,
    quiz: [
      { q: "os: [ubuntu-latest, windows-latest, macos-latest] et python: [\"3.12\", \"3.13\"], avec une exclusion. Combien de jobs ?", options: ["6", "5", "3", "2"], answer: 1, explain: "3 × 2 = 6 combinaisons, moins 1 exclue." },
      { q: "Une combinaison de la matrice échoue et toutes les autres sont annulées. Pourquoi ?", options: ["C'est un bug de GitHub", "fail-fast vaut true par défaut", "La matrice ne tolère aucun échec", "Le cache est corrompu"], answer: 1, explain: "Avec fail-fast: false, les autres combinaisons continuent : utile pour savoir précisément où ça casse." },
      { q: "Pourquoi mettre hashFiles('requirements.txt') dans la clé du cache ?", options: ["Pour chiffrer le cache", "Pour que le cache soit reconstruit quand les dépendances changent", "C'est obligatoire", "Pour accélérer hashFiles"], answer: 1, explain: "Une clé fixe garderait des dépendances périmées indéfiniment." }
    ],
    challenge: {
      prompt: Y`<p>Ta bibliothèque doit marcher sous Linux et Windows, avec Python 3.12, 3.13 et 3.14. Transforme ce job :</p><ol><li>une matrice @@os@@ (@@ubuntu-latest@@, @@windows-latest@@) × @@python@@ (@@"3.12"@@, @@"3.13"@@, @@"3.14"@@), <strong>sans</strong> la combinaison Windows + 3.12 (5 combinaisons) ;</li><li>@@runs-on@@ et @@python-version@@ lisent la matrice ;</li><li>un échec n'arrête pas les autres combinaisons ;</li><li>le cache pip de @@setup-python@@ est activé.</li></ol>`,
      starter: Y`name: Tests
on: [push, pull_request]
jobs:
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
      solution: Y`name: Tests
on: [push, pull_request]
jobs:
  tests:
    runs-on: \${{ matrix.os }}
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, windows-latest]
        python: ["3.12", "3.13", "3.14"]
        exclude:
          - os: windows-latest
            python: "3.12"
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-python@v7
        with:
          python-version: \${{ matrix.python }}
          cache: pip
      - run: pip install -r requirements.txt
      - run: pytest -q
`,
      checks: {
        matrix: { tests: { os: ["ubuntu-latest", "windows-latest"], python: ["3.12", "3.13", "3.14"] } }, matrixSize: { tests: 5 }, failFast: { tests: false },
        runsOn: { tests: "${{ matrix.os }}" }, with: { tests: { "actions/setup-python": { "python-version": "${{ matrix.python }}" } } }, cache: { tests: "pip" },
        scenarios: [{ event: { name: "pull_request", head: "feature/x", base: "main" }, run: ["tests"] }]
      },
      hint: "Sous strategy : fail-fast: false et matrix avec os, python et une liste exclude contenant { os: windows-latest, python: \"3.12\" }. Puis runs-on: ${{ matrix.os }} et, dans with, python-version: ${{ matrix.python }} et cache: pip."
    }
  },
  {
    id: "ci-10", section: "Matrices, cache, artefacts", title: "Artefacts et concurrence", xp: 80,
    theory: Y`<p><strong>Artefacts.</strong> Deux jobs ne partagent pas de disque. Pour transmettre un fichier (un paquet construit, un rapport de tests, des captures), un job le dépose avec @@actions/upload-artifact@@, un autre le récupère avec @@actions/download-artifact@@ sous le même @@name@@. Les artefacts restent aussi téléchargeables depuis la page de l'exécution, 90 jours par défaut (@@retention-days@@ pour réduire).</p>
<p><strong>Cache ou artefact ?</strong> Le cache accélère (des dépendances qu'on pourrait retélécharger) ; l'artefact transmet un résultat du pipeline. On construit <strong>une seule fois</strong>, puis on teste et on déploie ce même paquet : c'est la garantie que ce qui part en production est exactement ce qui a été testé.</p>
<p><strong>Concurrence.</strong> @@concurrency@@ regroupe des exécutions sous un nom. Dans un groupe, une seule tourne à la fois :</p>
<ul><li>avec @@cancel-in-progress: true@@, la nouvelle annule l'ancienne : idéal pour la CI d'une PR, où seul le dernier commit compte ;</li><li>sans, la nouvelle attend : indispensable pour un déploiement, qu'on ne coupe jamais au milieu.</li></ul>
~~~yaml
name: Paquet
on: [push, pull_request]
concurrency:
  group: \${{ github.workflow }}-\${{ github.ref }}
  cancel-in-progress: true
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - run: python -m build
      - uses: actions/upload-artifact@v7
        with:
          name: dist
          path: dist/
          retention-days: 7
~~~`,
    quiz: [
      { q: "Le job deploy fait ls dist/ et ne trouve rien, alors que le job build a bien créé dist/. Pourquoi ?", options: ["build a échoué en silence", "Chaque job a sa propre machine : il faut upload-artifact dans build et download-artifact dans deploy", "dist/ est dans .gitignore", "Il faut un runner plus gros"], answer: 1, explain: "Rien ne passe d'un job à l'autre sans artefact (ou cache, ou registre)." },
      { q: "Pour un workflow de déploiement en production, cancel-in-progress: true est-il une bonne idée ?", options: ["Oui, toujours", "Non : un déploiement interrompu au milieu peut laisser la production dans un état incohérent ; on préfère que le suivant attende", "Oui, mais seulement le vendredi", "Ça n'a aucun effet sur un déploiement"], answer: 1, explain: "Pour une PR, annuler est sans risque. Pour un déploiement, on sérialise sans annuler." }
    ],
    challenge: {
      prompt: Y`<p>Construis le paquet une seule fois, puis vérifie-le dans un autre job :</p><ol><li>@@build@@ lance @@python -m build@@ et dépose @@dist/@@ en artefact nommé @@paquet@@ ;</li><li>@@verifier@@ attend @@build@@, récupère l'artefact @@paquet@@ dans @@dist/@@, puis lance @@pip install dist/*.whl@@ ;</li><li>sur une même branche ou PR, une nouvelle exécution annule la précédente.</li></ol>`,
      starter: Y`name: Paquet
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - run: python -m build
  verifier:
    runs-on: ubuntu-latest
    steps:
      - run: pip install dist/*.whl
`,
      solution: Y`name: Paquet
on: [push, pull_request]
concurrency:
  group: \${{ github.workflow }}-\${{ github.ref }}
  cancel-in-progress: true
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - run: python -m build
      - uses: actions/upload-artifact@v7
        with:
          name: paquet
          path: dist/
  verifier:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v8
        with:
          name: paquet
          path: dist/
      - run: pip install dist/*.whl
`,
      checks: {
        needs: { verifier: ["build"] }, with: { build: { "actions/upload-artifact": { name: "paquet", path: "dist/" } }, verifier: { "actions/download-artifact": { name: "paquet", path: "dist/" } } },
        order: { build: ["python -m build", "actions/upload-artifact"], verifier: ["actions/download-artifact", "pip install"] }, concurrency: { cancel: true },
        scenarios: [{ event: { name: "push", branch: "main" }, run: ["build", "verifier"] }]
      },
      hint: "Ajoute upload-artifact@v7 après le build, needs: build et download-artifact@v8 avant pip install dans verifier, et un bloc concurrency au premier niveau avec cancel-in-progress: true."
    }
  }
];

