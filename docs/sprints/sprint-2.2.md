# Sprint 2.2

**Objectif** : manipuler et visualiser de vraies données avec pandas, Matplotlib et seaborn.

| Story | Points | Statut |
|-------|--------|--------|
| #3 US-2b pandas | 8 | Terminé (PR #13) |
| #4 US-2c Visualisation | 5 | Terminé (PR #14) |

**Capacité** : 13 points.

**Contexte** : sprint mené en autonomie pendant que le Product Owner est absent ; Claude fusionne les PR dès que la CI est verte (autorisation donnée le 11 novembre).

**Vélocité** : 13 points livrés sur 13.

## Rétrospective

- **Ce qui a marché** : calculer les sorties de référence avant d'écrire les énoncés a évité les cas de test ambigus (17 ex aequo sur les masses, conversions int → float). Le validateur a encore attrapé une hypothèse fausse : seaborn ordonne les catégories par apparition, pas alphabétiquement. Le test de parité a confirmé que matplotlib 3.8 (navigateur) et 3.9 (CI) donnent les mêmes propriétés de figures.
- **Ce qui a coincé** : seaborn absent de Pyodide, contourné par une installation micropip épinglée ; `stocks.csv` écarté faute de provenance documentée.
- **Ce qu'on change** : pour les chapitres suivants (SciPy, scikit-learn), fixer systématiquement les graines aléatoires et tester des seuils de score plutôt que des valeurs exactes, pour rester robustes entre plateformes.
