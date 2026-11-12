# Sprint 11.4

**Objectif** : ne plus perdre sa progression (audit #16).

| Story | Points | Statut |
|-------|--------|--------|
| #118 A-4 Exporter et importer sa progression | 3 | Terminé |

## Conception

- `lib/sauvegarde.js`, fonctions pures : l'export produit un fichier JSON daté (format `boucle-progression`, version 1) ; l'import vérifie le format, la version, le type de chaque champ et le format des jours, et renvoie un message clair au lieu de lever une exception. Rien n'est remplacé si le fichier est refusé.
- Pied de page : « Exporter » télécharge `boucle-progression-AAAA-MM-JJ.json`, « Importer » recharge un fichier et remplace la progression (`remplacer` dans `lib/state.js`).
- La synchronisation de compte reste hors de portée d'un site statique sans serveur : noté dans l'audit.

## Journal

- 12 nov. : module, interface, tests unitaires (aller-retour exact, sept fichiers invalides) et test de bout en bout (exporter, tout effacer, refuser un mauvais fichier, réimporter). 1 118 vérifications, 109 tests unitaires, 20 tests de bout en bout.
- 12 nov. : PR #125, les trois jobs verts. Fusionnée ; version 0.36.0, milestone 10 fermé.

## Revue de sprint

| Story | Points | Livré |
|-------|--------|-------|
| #118 Exporter et importer sa progression | 3 | Oui (PR #125) |

Vélocité : 3 points sur 3. Version 0.36.0. Le milestone « Améliorations de l'audit » est terminé : 16 points sur 16.

## Rétrospective du milestone

**Ce qui a marché.** Chaque amélioration isolée dans un petit module pur, testé seul, puis branché sur l'interface avec un test de bout en bout du parcours.

**Ce qui a coincé.** Rien de bloquant.

**À essayer.** Restent dans l'audit : plusieurs défis gradués par leçon (#2), d'autres formats d'exercice (#6), une PWA hors ligne (#19), une Content-Security-Policy (#21).
