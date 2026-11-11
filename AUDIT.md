# Audit de Boucle

Auto-évaluation de la version 1 (prototype publié en artifact), faite au moment de passer sur GitHub et Vercel.
Priorités : **P0** bloquant pour l'objectif, **P1** fort impact, **P2** confort, **P3** plus tard.

## Ce qui marche déjà

- Boucle d'apprentissage claire : théorie avec exemples exécutables, quiz, défi corrigé automatiquement.
- Chaque défi est vérifié par des tests, pas seulement par la sortie : impossible de tricher en affichant le résultat attendu sur la plupart des exercices.
- Progression motivante : XP, niveaux, série de jours, défi du jour.
- Interface lisible sur téléphone et en mode sombre.

## Pédagogie

| # | Constat | Priorité | Statut |
|---|---------|----------|--------|
| 1 | Aucun contenu sur la data (NumPy, pandas, Matplotlib, scikit-learn), Git, SQL, cloud, TensorFlow ou hardware. | P0 | Étapes 2 à 8 |
| 2 | Un seul défi par leçon : pas assez de répétition pour ancrer une notion. Viser 3 défis gradués (facile, moyen, entretien). | P1 | À faire |
| 3 | Aucune révision : une erreur de quiz n'est jamais reproposée. Ajouter une file de révision espacée (J+1, J+3, J+7). | P1 | À faire |
| 4 | Pas de projet guidé en plusieurs étapes, alors que les recruteurs regardent des projets. | P1 | Étape 9 |
| 5 | Rien pour préparer les entretiens : structures de données, patterns d'algorithmes, system design, questions comportementales. | P1 | Étape 8 |
| 6 | Un seul format d'exercice (QCM). Ajouter « prédire la sortie », « compléter le code », « remettre les lignes dans l'ordre ». | P2 | À faire |
| 7 | Un seul indice, révélé d'un coup. Passer à des indices progressifs. | P2 | À faire |
| 8 | Théorie parfois courte, sans schéma. Ajouter des diagrammes (mémoire, pointeurs, Git, circuits). | P2 | En continu |
| 9 | Les roadmaps ne reflètent pas la progression réelle dans les cours. | P2 | À faire |

## Technique

| # | Constat | Priorité | Statut |
|---|---------|----------|--------|
| 10 | Python via Skulpt : implémentation partielle, pas de NumPy ni pandas. | P0 | **Fait** : Pyodide (vrai CPython en WebAssembly) dans un Web Worker |
| 11 | Code monolithique dans un seul fichier HTML. | P0 | **Fait** : modules ES, un fichier de contenu par cours |
| 12 | Aucun test : une solution fausse ou un énoncé incohérent passe inaperçu. | P0 | **Fait** : `npm run validate` (CPython, g++, interpréteur navigateur) + CI GitHub Actions |
| 13 | Hébergement en artifact : interdit les téléchargements à l'exécution, donc pas de paquets Python. | P0 | **Fait** : dépôt GitHub privé + Vercel |
| 14 | Boucle infinie Python : impossible à arrêter. | P1 | **Fait** : arrêt à 10 s, redémarrage du worker |
| 15 | C++ limité à un sous-ensemble (pas de `string`, `vector`, classes). Brancher un vrai compilateur (API de compilation ou clang en WebAssembly). | P1 | À faire |
| 16 | Progression uniquement dans le navigateur : perdue si les données du site sont effacées, pas de multi-appareil. Ajouter export/import, puis synchronisation de compte. | P1 | À faire |
| 17 | Premier lancement de Python lent (environ 10 Mo). Précharger en arrière-plan dès l'ouverture d'une leçon Python. | P2 | À faire |
| 18 | Éditeur minimal : pas d'autocomplétion, pas de touche Tab sur mobile. Évaluer CodeMirror 6, ou ajouter une barre de symboles sur mobile. | P2 | À faire |
| 19 | Pas de mode hors-ligne. En faire une PWA (manifest + service worker). | P2 | À faire |
| 20 | Pas de tests de l'interface. Ajouter des tests Playwright en CI. | P2 | À faire |
| 21 | En-têtes de sécurité de base seulement. Ajouter une Content-Security-Policy. | P2 | À faire |
| 22 | Le C++ tourne sur le fil principal (par tranches, donc l'interface reste réactive, mais pas isolée). | P3 | À faire |
| 23 | Aucune mesure d'usage. Vercel Web Analytics suffirait. | P3 | À faire |

## Ordre de traitement

Le contenu manquant (#1) passe avant les améliorations de confort : chaque étape de contenu embarque une ou deux améliorations techniques quand elles servent ce contenu. Par exemple, les leçons pandas profitent du préchargement (#17), et l'étape Git apporte un nouveau format d'exercice (#6).
