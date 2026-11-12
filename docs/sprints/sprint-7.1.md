# Sprint 7.1

**Objectif** : ouvrir l'étape 6 (deep learning) par les réseaux de neurones écrits à la main avec NumPy, dans le navigateur.

| Story | Points | Statut |
|-------|--------|--------|
| #73 US-7a Réseaux de neurones à la main (NumPy) | 8 | En cours |

## Conception

- Pas de nouvelle mécanique : NumPy et scikit-learn (pour le jeu de chiffres) sont déjà dans Pyodide et validés en CI avec les mêmes versions.
- Reproductibilité : graines fixées (`np.random.default_rng`), sorties arrondies ou exprimées en seuils (« exactitude > 95 % ») pour ne pas dépendre des derniers bits des calculs flottants, qui peuvent différer entre CPython et WebAssembly.
- Progression : chaque défi construit une pièce de la boucle d'entraînement (perceptron, activations, perte, gradient, rétropropagation), puis on assemble (XOR, puis chiffres par mini-lots), puis on régularise.

## Journal

- 12 nov. : cours « Deep learning », chapitres 1 et 2 (9 leçons). Les sorties attendues sont calculées en exécutant les solutions, pas écrites à la main. Découverte en route : avec la graine 0, le réseau XOR reste coincé dans un minimum local (2 cas sur 4 faux) ; la graine 1 converge, et la leçon explique pourquoi on relance avec plusieurs graines. 893 vérifications ; e2e local vert (NumPy dans Pyodide vérifié en CI).
