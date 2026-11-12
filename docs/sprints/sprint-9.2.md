# Sprint 9.2

**Objectif** : les patterns d'algorithmes qui reviennent en entretien.

| Story | Points | Statut |
|-------|--------|--------|
| #95 US-9b Patterns d'algorithmes | 8 | Terminé |

## Conception

- Chapitre 2 du cours « Algorithmique » : une leçon par pattern (hachage, deux pointeurs, fenêtre glissante, recherche binaire, pile monotone, DFS et tri topologique, tas, intervalles, retour sur trace, programmation dynamique), puis une leçon de méthode : mener un entretien de code en sept étapes.
- Chaque leçon donne le signe qui fait reconnaître le pattern, le schéma de code, et un défi type entretien avec une entrée de 100 000 à 200 000 éléments.
- Des exemples tirés du métier visé : ordre des jobs d'un pipeline par tri topologique, ordre d'installation de paquets, fusion de journaux de serveurs, dimensionnement au pic de charge (salles de réunion).

## Journal

- 12 nov. : 11 leçons, 10 défis. Trois codes de départ quadratiques rendaient la validation trop lente : remplacés par des codes de départ qui échouent vite (règle notée au sprint 9.1). Cinq sorties attendues écrites de tête étaient fausses (par exemple « kubernetes » a 6 lettres distinctes de suite, pas 5) : recalculées par script. Les dix défis passent dans Pyodide en moins de 1,5 s chacun. 1 078 vérifications.

## Revue de sprint

| Story | Points | Livré |
|-------|--------|-------|
| #95 Patterns d'algorithmes | 8 | Oui |

Vélocité : 8 points sur 8. Version 0.27.0.

## Rétrospective

**Ce qui a marché.** Calculer chaque sortie attendue avec la solution, puis la relire : les erreurs de tête sont systématiques sur ce type de contenu.

**Ce qui a coincé.** Écrire les sorties attendues à la main en premier jet fait perdre un aller-retour.

**À essayer.** Pour le system design (#96), des défis qui modélisent des composants réels (cache LRU, seau à jetons, hachage cohérent) plutôt que de la théorie seule.
