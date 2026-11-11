/* Cours CI/CD — chapitre 3 : YAML, expressions et contextes. */
import { Y } from "./tag.js";

export default [
  {
    id: "ci-05", section: "YAML, expressions et contextes", title: "YAML sans pièges", xp: 75,
    theory: Y`<p>YAML décrit des données avec trois briques : des <strong>dictionnaires</strong> (@@clé: valeur@@), des <strong>listes</strong> (lignes qui commencent par @@- @@, ou @@[a, b]@@ sur une ligne) et des valeurs simples. La structure vient de l'<strong>indentation</strong>, en espaces uniquement : une tabulation est une erreur.</p>
~~~yaml
name: Exemple
on:
  push:
    branches:
      - main
      - "release/**"
jobs:
  tests:
    runs-on: ubuntu-latest
    env:
      MESSAGE: "Bonjour : avec deux-points, les guillemets sont prudents"
    steps:
      - name: Script sur plusieurs lignes
        run: |
          echo "$MESSAGE"
          python --version
~~~
<p>Les pièges qui cassent un pipeline :</p>
<ul><li><strong>Indentation décalée</strong> : une clé avec un espace de trop change de parent, ou rend le fichier illisible ;</li><li><strong>Les nombres</strong> : @@python-version: 3.10@@ est lu comme le nombre <em>3.1</em>, et le runner installe Python 3.1 ou plante. Écris @@"3.10"@@. Même risque avec @@1.20@@ ou @@22.10@@ ;</li><li><strong>Les deux-points et les @@#@@</strong> dans une valeur : @@run: echo a: b@@ est ambigu, et @@# commentaire@@ coupe la ligne. Les guillemets lèvent le doute ;</li><li><strong>Le multi-ligne</strong> : @@|@@ garde les retours à la ligne (scripts), @@>@@ les replie en espaces (texte long) ;</li><li><strong>Les clés mal orthographiées</strong> : @@run-on@@ au lieu de @@runs-on@@ ou @@step@@ au lieu de @@steps@@ donnent un YAML valide, mais un workflow faux. GitHub le refuse à l'exécution ; un linter comme <em>actionlint</em> le voit avant.</li></ul>
<p>Le moteur de Boucle fait le même travail : il signale ces erreurs avec leur numéro de ligne. Analyse cet extrait volontairement faux :</p>
~~~yaml erreurs
name: Faux
on: push
jobs:
  tests:
    run-on: ubuntu-latest
    steps:
      - uses: actions/setup-python@v7
        with:
          python-version: 3.10
~~~`,
    quiz: [
      { q: Y`Pourquoi écrire @@python-version: "3.10"@@ avec des guillemets ?`, options: ["Par convention, sans effet", "Sans guillemets, YAML lit le nombre 3.1 et le zéro final disparaît", "Les guillemets accélèrent l'installation", "GitHub exige des guillemets autour de toutes les valeurs"], answer: 1, explain: "3.10 est un nombre décimal valide, égal à 3.1. Entre guillemets, c'est le texte « 3.10 », que setup-python comprend." },
      { q: "Quelle différence entre run: | et run: > ?", options: ["Aucune", "| garde chaque ligne (une commande par ligne), > replie les lignes en une seule séparée par des espaces", "> est réservé aux commentaires", "| exécute les lignes en parallèle"], answer: 1, explain: "Pour un script shell, on veut presque toujours | : chaque ligne reste une commande." }
    ],
    challenge: {
      prompt: Y`<p>Un collègue a écrit ce workflow, qui échoue. Le panneau sous l'éditeur liste les problèmes. Corrige-les tous :</p><ul><li>le job @@tests@@ doit tourner sur @@ubuntu-latest@@ ;</li><li>chaque action doit avoir une version ;</li><li>la matrice doit tester exactement les versions @@3.10@@, @@3.12@@ et @@3.14@@ de Python ;</li><li>@@deploy@@ doit attendre la fin de @@tests@@ ;</li><li>plus aucune erreur ni aucun avertissement.</li></ul>`,
      starter: Y`name: CI
on:
  push:
    branches: [main]
jobs:
  tests:
    run-on: ubuntu-latest
    strategy:
      matrix:
        python-version: [3.10, 3.12, 3.14]
    steps:
      - uses: actions/checkout
      - uses: actions/setup-python@v7
        with:
          python-version: \${{ matrix.python-version }}
      - run: pytest -q
  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - run: ./deploy.sh
`,
      solution: Y`name: CI
on:
  push:
    branches: [main]
jobs:
  tests:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        python-version: ["3.10", "3.12", "3.14"]
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-python@v7
        with:
          python-version: \${{ matrix.python-version }}
      - run: pytest -q
  deploy:
    needs: tests
    runs-on: ubuntu-latest
    steps:
      - run: ./deploy.sh
`,
      checks: {
        runsOn: { tests: "ubuntu-latest" }, pinned: "major", matrix: { tests: { "python-version": ["3.10", "3.12", "3.14"] } },
        needs: { deploy: ["tests"] }, noWarnings: true,
        scenarios: [{ event: { name: "push", branch: "main" }, run: ["tests", "deploy"] }]
      },
      hint: "Quatre corrections : run-on → runs-on, actions/checkout → actions/checkout@v7, les versions de la matrice entre guillemets, et needs: test → needs: tests."
    }
  },
  {
    id: "ci-06", section: "YAML, expressions et contextes", title: "Expressions, contextes et conditions", xp: 80,
    theory: Y`<p>Entre @@\${{ }}@@, GitHub évalue une <strong>expression</strong> au moment de l'exécution. Elle lit des <strong>contextes</strong> :</p>
<ul><li>@@github@@ : l'événement et le dépôt (@@github.event_name@@, @@github.ref@@ comme @@refs/heads/main@@, @@github.ref_name@@, @@github.sha@@, @@github.actor@@…) ;</li><li>@@env@@, @@vars@@ (variables du dépôt), @@secrets@@ ;</li><li>@@matrix@@, @@needs@@ (résultats des jobs attendus), @@steps@@ (sorties des étapes précédentes), @@runner@@, @@inputs@@.</li></ul>
<p>Opérateurs : @@==@@, @@!=@@, @@&&@@, @@||@@, @@!@@, @@<@@, @@>@@. Les chaînes s'écrivent entre <strong>apostrophes</strong> : @@'main'@@. Les comparaisons de texte ignorent la casse. Fonctions utiles : @@startsWith@@, @@endsWith@@, @@contains@@, @@format@@, @@toJSON@@.</p>
<p><strong>Conditions.</strong> @@if:@@ sur un job ou une étape décide s'il s'exécute. Les accolades y sont facultatives. Sans fonction de statut, GitHub ajoute implicitement @@success()@@ : on ne s'exécute que si tout ce qui précède a réussi. Les fonctions de statut changent cette règle :</p>
<ul><li>@@failure()@@ : seulement si une étape précédente (ou un job attendu) a échoué. Idéal pour garder les logs ou prévenir l'équipe ;</li><li>@@always()@@ : dans tous les cas, même après une annulation ;</li><li>@@!cancelled()@@ : dans tous les cas sauf l'annulation. On le préfère souvent à @@always()@@.</li></ul>
~~~yaml
name: CI
on: [push, pull_request]
jobs:
  tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - run: pytest -q
      - name: Résumé
        if: always()
        run: echo "Tests terminés pour \${{ github.ref_name }}"
  publier:
    needs: tests
    if: startsWith(github.ref, 'refs/tags/v')
    runs-on: ubuntu-latest
    steps:
      - run: echo "Publication de \${{ github.ref_name }}"
~~~
<p>Le @@if@@ d'un job ne connaît que @@github@@, @@needs@@, @@vars@@ et @@inputs@@ : @@env@@ ou @@secrets@@ n'y existent pas encore. Et une expression placée dans @@run@@ est collée dans le script <em>avant</em> son exécution : avec une valeur fournie par un inconnu, comme le titre d'une PR, c'est une porte ouverte à l'injection de commandes (chapitre 6).</p>`,
    quiz: [
      { q: Y`Sur une pull request, que vaut @@github.ref@@ ?`, options: ["refs/heads/main", "La branche de la PR, refs/heads/feature/x", "refs/pull/<numéro>/merge", "Une chaîne vide"], answer: 2, explain: "La CI d'une PR tourne sur le commit de fusion simulé : github.ref vaut refs/pull/N/merge. La branche de la PR est dans github.head_ref, la cible dans github.base_ref." },
      { q: "Une étape doit envoyer les logs seulement quand les tests ont échoué. Quel if ?", options: ["if: success()", "if: failure()", "if: always()", "if: github.event_name == 'failure'"], answer: 1, explain: "failure() est vrai dès qu'une étape précédente du job a échoué. Sans lui, l'étape serait sautée, comme toute la suite après un échec." },
      { q: Y`Que vaut @@'Main' == 'main'@@ dans une expression GitHub ?`, options: ["false", "true : les comparaisons de chaînes ignorent la casse", "Une erreur", "null"], answer: 1, explain: "GitHub compare les chaînes sans tenir compte des majuscules. Différent de bash ou de Python." }
    ],
    challenge: {
      prompt: Y`<p>Ce workflow déploie à chaque push et sur chaque pull request : n'importe quelle branche finit en production. Corrige-le :</p><ol><li>@@deploy@@ ne doit tourner que pour un <strong>push sur main</strong> (jamais sur une PR ni sur une autre branche) ;</li><li>dans @@tests@@, l'étape « Archiver les logs » ne doit tourner <strong>que si les tests ont échoué</strong>.</li></ol><p>Les boutons sous l'éditeur simulent chaque cas. Le dernier simule un échec des tests.</p>`,
      starter: Y`name: CI
on: [push, pull_request]
jobs:
  tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - run: pytest -q --junitxml=rapport.xml
      - name: Archiver les logs
        run: tar czf logs.tgz logs/
  deploy:
    needs: tests
    runs-on: ubuntu-latest
    steps:
      - run: ./deploy.sh
`,
      solution: Y`name: CI
on: [push, pull_request]
jobs:
  tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - run: pytest -q --junitxml=rapport.xml
      - name: Archiver les logs
        if: failure()
        run: tar czf logs.tgz logs/
  deploy:
    needs: tests
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - run: ./deploy.sh
`,
      checks: {
        scenarios: [
          { event: { name: "pull_request", head: "feature/recherche", base: "main" }, run: ["tests"], skip: ["deploy"] },
          { event: { name: "push", branch: "feature/recherche" }, run: ["tests"], skip: ["deploy"] },
          { event: { name: "push", branch: "main" }, run: ["tests", "deploy"], stepsSkipped: { tests: ["Archiver les logs"] } },
          { event: { name: "push", branch: "main" }, fail: ["tests"], skip: ["deploy"], stepsRun: { tests: ["Archiver les logs"] } }
        ]
      },
      hint: "Sur deploy : « if: github.event_name == 'push' && github.ref == 'refs/heads/main' » (apostrophes, pas de guillemets). Sur l'étape d'archive : « if: failure() »."
    }
  }
];
