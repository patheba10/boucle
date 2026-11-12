# Sprint 7.1

**Objectif** : ouvrir l'étape 6 (deep learning) par les réseaux de neurones écrits à la main avec NumPy, dans le navigateur.

| Story | Points | Statut |
|-------|--------|--------|
| #73 US-7a Réseaux de neurones à la main (NumPy) | 8 | Terminé |

## Conception

- Pas de nouvelle mécanique : NumPy et scikit-learn (pour le jeu de chiffres) sont déjà dans Pyodide et validés en CI avec les mêmes versions.
- Reproductibilité : graines fixées (`np.random.default_rng`), sorties arrondies ou exprimées en seuils (« exactitude > 95 % ») pour ne pas dépendre des derniers bits des calculs flottants, qui peuvent différer entre CPython et WebAssembly.
- Progression : chaque défi construit une pièce de la boucle d'entraînement (perceptron, activations, perte, gradient, rétropropagation), puis on assemble (XOR, puis chiffres par mini-lots), puis on régularise.

## Journal

- 12 nov. : cours « Deep learning », chapitres 1 et 2 (9 leçons). Les sorties attendues sont calculées en exécutant les solutions, pas écrites à la main. Découverte en route : avec la graine 0, le réseau XOR reste coincé dans un minimum local (2 cas sur 4 faux) ; la graine 1 converge, et la leçon explique pourquoi on relance avec plusieurs graines. 893 vérifications ; e2e local vert (NumPy dans Pyodide vérifié en CI).
- 12 nov. : PR #76 fusionnée ; CI verte du premier coup, 19 tests de bout en bout dont la parité NumPy dans Pyodide.

## Revue de sprint

| Story | Points | Livré |
|-------|--------|-------|
| #73 Réseaux de neurones à la main | 8 | Oui (PR #76) |

Vélocité : 8 points sur 8. Version 0.19.0.

## Rétrospective

**Ce qui a marché.** Calculer les sorties attendues en exécutant les solutions (petit script) au lieu de les écrire à la main : deux valeurs fausses corrigées avant la validation, et un minimum local découvert, devenu un point du cours.

**Ce qui a coincé.** Rien de bloquant ; le parcours dans Pyodide ne se vérifie toujours qu'en CI.

**À essayer.** Pour TensorFlow (#74), absent de Pyodide : un essai court sur les options (exécution en CI et Colab, couche compatible Keras en NumPy, TensorFlow.js) avant d'écrire, comme pour FastAPI.
