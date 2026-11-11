# Sprint 2.3

**Objectif** : statistiques et machine learning avec SciPy et scikit-learn, puis un projet guidé de bout en bout. Fin de l'étape 2.

| Story | Points | Statut |
|-------|--------|--------|
| #5 US-2d SciPy | 3 | Terminé (PR #15) |
| #6 US-2e scikit-learn | 8 | Terminé (PR #16) |
| #7 US-2f Projet guidé | 5 | Terminé (PR #17) |

**Capacité** : 16 points.

**Règle du sprint** (issue de la rétrospective 2.2) : graines aléatoires fixées, et seuils de score plutôt que valeurs exactes dans les tests ML, car le navigateur est en 32 bits et la CI en 64 bits.

**Vélocité** : 16 points livrés sur 16. Étape 2 terminée en trois sprints (34 points).

## Rétrospective

- **Ce qui a marché** : la règle « seuils de score et graines fixées » a rendu tous les tests ML justes dans le navigateur (32 bits) comme en CI (64 bits), sans aucune retouche. Calculer les références avant d'écrire a fait découvrir deux excellents cas pédagogiques : le paradoxe de Simpson sur les becs, et le piège de la validation croisée non mélangée sur des données triées (0,77 contre 0,92).
- **Ce qui a coincé** : un test e2e instable (le helper concluait pendant l'installation de seaborn), corrigé en attendant un état final explicite. L'import de scikit-learn en WebAssembly a obligé à relever la limite d'exécution à 20 s.
- **Ce qu'on change** : `npm run validate` prend maintenant environ 1 minute (AUDIT #24) ; à optimiser avant d'ajouter TensorFlow. Pour l'étape 3 (Git et CI/CD), il faut de nouveaux formats d'exercice (terminal simulé, workflow YAML) : prévoir une story « enabler » en début de sprint.
