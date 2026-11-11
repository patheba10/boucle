/* Cours CI/CD — chapitres 1 et 2 : pourquoi la CI/CD, puis l'essentiel de GitHub Actions. */
import { Y } from "./tag.js";

export default [
  {
    id: "ci-01", section: "Pourquoi la CI/CD", title: "Intégrer, livrer, déployer en continu", xp: 60,
    theory: Y`<p>Sans automatisation, chaque développeur travaille des semaines sur sa branche, puis tout le monde fusionne la veille de la livraison : conflits, bugs qui n'apparaissent qu'ensemble, mise en production manuelle et stressante. La CI/CD remplace ce grand saut par une multitude de petits pas vérifiés.</p>
<ul><li><strong>Intégration continue (CI)</strong> : chaque push et chaque pull request déclenchent automatiquement le build et les tests. Une erreur est connue en quelques minutes, par la personne qui vient de l'introduire.</li><li><strong>Livraison continue (Continuous Delivery)</strong> : chaque version qui passe la CI est <em>prête</em> à partir en production ; un humain appuie sur le bouton.</li><li><strong>Déploiement continu (Continuous Deployment)</strong> : même chose, sans bouton. Tout ce qui passe le pipeline part en production.</li></ul>
<p>Un <strong>pipeline</strong> enchaîne des étapes : récupérer le code, installer les dépendances, analyser (lint), tester, construire un artefact (paquet, image Docker), le publier, déployer. Si une étape échoue, la suite ne s'exécute pas.</p>
<p><strong>Mesurer.</strong> Le programme de recherche DORA (Google Cloud) suit cinq métriques depuis son rapport 2025 :</p>
<ul><li>débit : <em>délai de mise en production</em> d'un changement, <em>fréquence de déploiement</em>, <em>temps de rétablissement</em> après un déploiement raté ;</li><li>instabilité : <em>taux d'échec des changements</em> et <em>taux de reprise</em> (part des déploiements imprévus, faits pour corriger la production).</li></ul>
<p>Les équipes les plus performantes déploient plusieurs fois par jour avec peu d'échecs : vitesse et stabilité vont ensemble, parce que de petits changements sont plus faciles à vérifier et à annuler. C'est une question classique d'entretien DevOps.</p>
<p>Un workflow GitHub Actions minimal tient en quelques lignes. Clique sur « Analyser » pour voir ce qu'il ferait :</p>
~~~yaml
name: Bonjour
on: push
jobs:
  saluer:
    runs-on: ubuntu-latest
    steps:
      - run: echo "Le pipeline tourne sur la branche $GITHUB_REF_NAME"
~~~`,
    quiz: [
      { q: "Livraison continue ou déploiement continu : quelle est la différence ?", options: ["Aucune, ce sont deux noms du même processus", "En livraison continue, une personne décide de la mise en production ; en déploiement continu, tout ce qui passe le pipeline part automatiquement", "La livraison continue ne fait pas de tests", "Le déploiement continu n'existe que sur AWS"], answer: 1, explain: "Les deux produisent en continu des versions prêtes. Seul le déclenchement de la mise en production diffère." },
      { q: "Une équipe déploie une fois par trimestre, avec 40 % de déploiements ratés. Quelle piste DORA ?", options: ["Déployer encore moins souvent pour être prudent", "Des changements plus petits et plus fréquents, vérifiés automatiquement par un pipeline", "Supprimer les tests pour aller plus vite", "Ajouter une réunion d'approbation de plus"], answer: 1, explain: "Les données DORA montrent que débit et stabilité progressent ensemble : un petit changement est plus facile à tester, à relire et à annuler." }
    ],
    challenge: {
      prompt: Y`<p>Écris ton premier workflow :</p><ol><li>il s'appelle @@Bonjour@@ et se déclenche à chaque <strong>push</strong>, sur n'importe quelle branche ;</li><li>il contient un job @@bonjour@@ qui tourne sur @@ubuntu-latest@@ ;</li><li>ce job a une étape qui affiche un message avec @@echo@@.</li></ol><p>Sous l'éditeur, le graphe montre en direct quels jobs tourneraient.</p>`,
      starter: Y`name: Bonjour
# 1. Déclencheur : à chaque push
# 2. Un job « bonjour » sur ubuntu-latest
# 3. Une étape qui lance echo
`,
      solution: Y`name: Bonjour
on: push
jobs:
  bonjour:
    runs-on: ubuntu-latest
    steps:
      - run: echo "Bonjour depuis GitHub Actions"
`,
      checks: {
        name: "Bonjour", triggers: ["push"], jobs: ["bonjour"], runsOn: { bonjour: "ubuntu-latest" }, run: { bonjour: ["echo"] },
        scenarios: [{ event: { name: "push", branch: "main" }, run: ["bonjour"] }, { event: { name: "push", branch: "feature/essai" }, run: ["bonjour"] }]
      },
      hint: "Trois clés au premier niveau : name, on, jobs. Sous jobs, le job bonjour a runs-on et steps ; chaque étape commence par un tiret, ici « - run: echo … »."
    }
  },
  {
    id: "ci-02", section: "GitHub Actions : l'essentiel", title: "Workflows, jobs, étapes et runners", xp: 70,
    theory: Y`<p>Un <strong>workflow</strong> est un fichier YAML dans @@.github/workflows/@@. GitHub le lit à chaque événement du dépôt.</p>
<ul><li><strong>on</strong> : les événements qui le déclenchent ;</li><li><strong>jobs</strong> : des blocs de travail. Chaque job tourne sur sa propre machine neuve, un <strong>runner</strong> (@@ubuntu-latest@@, @@windows-latest@@, @@macos-latest@@ ou une machine à toi, dite <em>self-hosted</em>) ;</li><li><strong>steps</strong> : les étapes d'un job, exécutées dans l'ordre sur la même machine. Une étape fait soit @@run@@ (des commandes shell), soit @@uses@@ (une <strong>action</strong> : un module réutilisable, souvent pris sur le Marketplace).</li></ul>
<p>Le runner démarre vide : la première étape est presque toujours @@actions/checkout@@, qui récupère le code du dépôt. Sans elle, @@pytest@@ ne trouve aucun fichier. Les actions se citent avec une version : @@actions/setup-python@v7@@. Le paramètre @@with@@ leur passe des options.</p>
~~~yaml
name: Tests
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
      - name: Lancer les tests
        run: pytest -q
~~~
<p><strong>Dans Boucle.</strong> Le fichier @@.github/workflows/ci.yml@@ a trois jobs : @@validate-content@@ (tests unitaires et validation de chaque exercice), @@e2e@@ (parcours élève dans un vrai navigateur) et @@deploy-github-pages@@, qui ne démarre que si les deux premiers ont réussi. Tu peux voir chaque exécution dans l'onglet <em>Actions</em> du dépôt.</p>`,
    setup: Y`<p><strong>Ton premier workflow sur GitHub</strong>, dans ton dépôt d'entraînement :</p>
~~~bash
mkdir -p .github/workflows
cat > .github/workflows/ci.yml <<'EOF'
name: Bonjour
on: [push, workflow_dispatch]
jobs:
  bonjour:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - run: ls -la
      - run: echo "Commit $GITHUB_SHA sur $GITHUB_REF_NAME"
EOF
git add .github/workflows/ci.yml
git commit -m "ci: premier workflow"
git push
~~~
<p>Ouvre l'onglet <em>Actions</em> du dépôt : clique sur l'exécution, puis sur le job, et déplie chaque étape pour lire les logs. Grâce à @@workflow_dispatch@@, un bouton « Run workflow » permet aussi de le relancer à la main. Les dépôts publics ont des minutes de runner gratuites et illimitées ; les privés ont un quota mensuel.</p>`,
    quiz: [
      { q: "Ton job lance pytest mais affiche « no tests ran ». Les tests existent dans le dépôt. Cause la plus probable ?", options: ["pytest n'est pas installé sur Ubuntu", "Il manque l'étape actions/checkout : le runner démarre sans le code du dépôt", "Il faut un runner Windows", "Les tests ne marchent que sur pull_request"], answer: 1, explain: "Chaque job démarre sur une machine vide. actions/checkout clone le dépôt dans le dossier de travail." },
      { q: "Deux jobs d'un même workflow partagent-ils leurs fichiers ?", options: ["Oui, ils tournent dans le même dossier", "Non, chaque job a sa propre machine : il faut passer par des artefacts ou un cache", "Seulement sur ubuntu-latest", "Oui, si les jobs ont le même nom"], answer: 1, explain: "C'est une source de bugs classique. On verra les artefacts et le cache au chapitre 5." }
    ],
    challenge: {
      prompt: Y`<p>Ce workflow lance les tests, mais il échouerait sur GitHub. Complète le job @@tests@@ pour qu'il :</p><ol><li>récupère le code avec @@actions/checkout@@ ;</li><li>installe Python @@3.13@@ avec @@actions/setup-python@@ (paramètre @@python-version@@) ;</li><li>puis seulement installe les dépendances et lance @@pytest@@.</li></ol><p>Cite chaque action avec une version, comme @@@v7@@.</p>`,
      starter: Y`name: Tests
on: [push, pull_request]
jobs:
  tests:
    runs-on: ubuntu-latest
    steps:
      - run: pip install -r requirements.txt
      - run: pytest -q
`,
      solution: Y`name: Tests
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
      checks: {
        uses: { tests: ["actions/checkout", "actions/setup-python"] }, with: { tests: { "actions/setup-python": { "python-version": "3.13" } } },
        order: { tests: ["actions/checkout", "actions/setup-python", "pip install", "pytest"] }, pinned: "major",
        scenarios: [{ event: { name: "pull_request", head: "feature/recherche", base: "main" }, run: ["tests"] }]
      },
      hint: "Ajoute deux étapes avant les « run » : « - uses: actions/checkout@v7 », puis « - uses: actions/setup-python@v7 » avec un bloc « with: » indenté sous l'étape. Mets 3.13 entre guillemets."
    }
  },
  {
    id: "ci-03", section: "GitHub Actions : l'essentiel", title: "Événements et filtres", xp: 70,
    theory: Y`<p>La clé @@on@@ décide <strong>quand</strong> le workflow démarre. Les événements les plus courants :</p>
<ul><li>@@push@@ : un commit ou un tag arrive sur le dépôt ;</li><li>@@pull_request@@ : une PR est ouverte, mise à jour ou rouverte. La CI teste alors le résultat de la fusion de la PR dans sa branche cible ;</li><li>@@workflow_dispatch@@ : bouton « Run workflow » (lancement manuel, avec des paramètres si besoin) ;</li><li>@@schedule@@ : planification façon cron, en heure UTC (@@cron: "0 6 * * 1"@@ = le lundi à 6 h UTC) ;</li><li>@@release@@, @@workflow_call@@ (workflow réutilisable), @@issues@@ et bien d'autres.</li></ul>
<p>Des <strong>filtres</strong> affinent chaque événement :</p>
<ul><li>@@branches@@ / @@branches-ignore@@ : pour @@push@@, la branche poussée ; pour @@pull_request@@, la branche <strong>cible</strong> de la PR ;</li><li>@@tags@@ : déclencher sur un tag, par exemple @@v*@@ pour publier une release ;</li><li>@@paths@@ / @@paths-ignore@@ : ne lancer la CI que si certains fichiers changent ;</li><li>@@types@@ : quelles actions de la PR ou de la release comptent.</li></ul>
<p>Dans un motif, @@*@@ remplace n'importe quoi sauf @@/@@, et @@**@@ remplace n'importe quoi. Un motif qui commence par @@!@@ exclut. Attention : si tu filtres seulement les @@branches@@ d'un push, un push de tag ne déclenche plus rien.</p>
~~~yaml
name: CI
on:
  push:
    branches: [main, "release/**"]
    tags: ["v*"]
  pull_request:
    branches: [main]
  schedule:
    - cron: "0 6 * * 1"
  workflow_dispatch:
jobs:
  tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - run: make test
~~~
<p>Clique sur « Analyser », puis sur les différents événements pour voir lesquels démarrent le workflow.</p>`,
    quiz: [
      { q: Y`Avec @@on: pull_request: branches: [main]@@, que filtre « main » ?`, options: ["La branche de la PR (celle où tu as codé)", "La branche cible de la PR, celle dans laquelle on veut fusionner", "La branche par défaut du runner", "Les deux branches doivent s'appeler main"], answer: 1, explain: "Pour pull_request, branches porte sur la branche de base (cible). Une PR de feature/x vers main déclenche donc le workflow." },
      { q: Y`Le workflow a @@on: push: branches: [main]@@. Tu pousses le tag @@v1.2.0@@. Que se passe-t-il ?`, options: ["Le workflow tourne", "Rien : quand seules des branches sont filtrées, les pushes de tags ne déclenchent pas", "Le workflow tourne deux fois", "GitHub refuse le tag"], answer: 1, explain: "Il faut ajouter un filtre tags (par exemple [\"v*\"]) pour que les tags déclenchent aussi le workflow." },
      { q: Y`Que signifie @@cron: "30 2 * * *"@@ ?`, options: ["Toutes les 30 minutes", "Tous les jours à 2 h 30 UTC", "Le 30 février", "À 2 h 30, heure de Montréal"], answer: 1, explain: "Minute 30, heure 2, tous les jours, tous les mois. GitHub interprète les crons en UTC." }
    ],
    challenge: {
      prompt: Y`<p>Ce workflow tourne à chaque push, sur toutes les branches, même pour une faute de frappe dans la doc. Règle ses déclencheurs pour qu'il :</p><ol><li>tourne sur un push dans @@main@@ uniquement ;</li><li>tourne sur les pull requests qui visent @@main@@ ;</li><li>puisse être lancé à la main ;</li><li>ne tourne <strong>pas</strong>, sur push comme sur PR, quand les seuls fichiers modifiés sont dans @@docs/@@ ou sont des fichiers Markdown (@@*.md@@ partout dans le dépôt).</li></ol><p>Teste tes déclencheurs avec les boutons d'événements sous l'éditeur.</p>`,
      starter: Y`name: CI
on: push
jobs:
  tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - run: make test
`,
      solution: Y`name: CI
on:
  push:
    branches: [main]
    paths-ignore: ["docs/**", "**.md"]
  pull_request:
    branches: [main]
    paths-ignore: ["docs/**", "**.md"]
  workflow_dispatch:
jobs:
  tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - run: make test
`,
      checks: {
        onlyTriggers: ["push", "pull_request", "workflow_dispatch"], branches: { push: ["main"], pull_request: ["main"] },
        scenarios: [
          { event: { name: "push", branch: "feature/recherche" }, triggered: false },
          { event: { name: "pull_request", head: "feature/recherche", base: "main", paths: ["src/app.py"] }, run: ["tests"] },
          { event: { name: "push", branch: "main", paths: ["src/app.py", "README.md"] }, run: ["tests"] },
          { event: { name: "push", branch: "main", paths: ["README.md", "docs/installation.md"] }, triggered: false },
          { event: { name: "pull_request", head: "docs/typo", base: "main", paths: ["docs/guide.md"] }, triggered: false },
          { event: { name: "workflow_dispatch" }, run: ["tests"] }
        ]
      },
      hint: "Transforme « on: push » en dictionnaire : push et pull_request avec chacun « branches: [main] » et « paths-ignore: [\"docs/**\", \"**.md\"] », plus « workflow_dispatch: » sans valeur."
    }
  },
  {
    id: "ci-04", section: "GitHub Actions : l'essentiel", title: "Plusieurs jobs : parallèle et needs", xp: 75,
    theory: Y`<p>Par défaut, les jobs d'un workflow démarrent <strong>en même temps</strong>, chacun sur sa machine. C'est voulu : le lint et les tests n'ont pas besoin de s'attendre, le pipeline finit plus vite.</p>
<p>@@needs@@ crée un ordre : un job qui a @@needs: [lint, tests]@@ attend que les deux aient <strong>réussi</strong>. Si l'un échoue, il est sauté, tout comme les jobs qui dépendent de lui. On obtient un graphe : construire seulement si tout est vert, déployer seulement si la construction a marché.</p>
~~~yaml
name: CI
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
      - run: pytest -q
  build:
    needs: [lint, tests]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - run: python -m build
~~~
<p>Découper a un coût : chaque job réinstalle son environnement (d'où le cache, au chapitre 5). On sépare ce qui gagne à tourner en parallèle, ou ce qui a besoin de droits différents, comme un déploiement.</p>
<p><strong>Dans Boucle.</strong> @@deploy-github-pages@@ a @@needs: [validate-content, e2e]@@ : le site n'est publié que si le contenu est valide et que les tests dans le navigateur passent.</p>`,
    quiz: [
      { q: "Trois jobs sans needs : lint (1 min), tests (4 min), build (2 min). Durée totale du workflow ?", options: ["7 minutes", "Environ 4 minutes : ils tournent en parallèle", "1 minute", "Impossible à dire"], answer: 1, explain: "Sans needs, les trois démarrent ensemble. La durée est celle du plus long, plus le temps de démarrage des machines." },
      { q: "deploy a needs: build, et build a needs: tests. Les tests échouent. Que fait deploy ?", options: ["Il tourne quand même", "Il est sauté, comme build", "Il attend indéfiniment", "Il relance les tests"], answer: 1, explain: "Un job sauté ou en échec fait sauter tous ceux qui en dépendent, sauf condition spéciale comme if: always()." }
    ],
    challenge: {
      prompt: Y`<p>Tout est dans un seul job : le lint attend les tests, et la construction tourne même quand rien n'a été vérifié. Découpe-le en trois jobs :</p><ol><li>@@lint@@ (@@ruff check .@@) et @@tests@@ (@@pytest -q@@), qui tournent <strong>en parallèle</strong> ;</li><li>@@build@@ (@@python -m build@@), qui attend que les deux réussissent ;</li><li>chaque job récupère le code avec @@actions/checkout@v7@@.</li></ol><p>Sous l'éditeur, compare le graphe avant et après.</p>`,
      starter: Y`name: CI
on: [push, pull_request]
jobs:
  tout:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - run: pytest -q
      - run: ruff check .
      - run: python -m build
`,
      solution: Y`name: CI
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
      - run: pytest -q
  build:
    needs: [lint, tests]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - run: python -m build
`,
      checks: {
        jobs: ["lint", "tests", "build"], needs: { lint: [], tests: [], build: ["lint", "tests"] },
        uses: { lint: ["actions/checkout"], tests: ["actions/checkout"], build: ["actions/checkout"] },
        run: { lint: ["ruff check"], tests: ["pytest"], build: ["python -m build"] },
        scenarios: [
          { event: { name: "push", branch: "main" }, run: ["lint", "tests", "build"] },
          { event: { name: "push", branch: "main" }, fail: ["tests"], run: ["lint"], skip: ["build"] }
        ]
      },
      hint: "Trois clés sous jobs : lint, tests, build. Chacune a runs-on et ses steps (checkout puis la commande). Seul build reçoit « needs: [lint, tests] »."
    }
  }
];
