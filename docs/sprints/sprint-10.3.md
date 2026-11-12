# Sprint 10.3

**Objectif** : les projets de la roadmap Embarqué et IoT, et des roadmaps qui suivent la progression réelle ; clore l'étape 9.

| Story | Points | Statut |
|-------|--------|--------|
| #108 US-10c Capstones Embarqué et progression des roadmaps | 5 | Terminé |

## Conception

- Deux projets Embarqué et IoT : une station de mesure connectée sur batterie (pilote I2C écrit depuis la datasheet, veille profonde, MQTT, autonomie calculée puis mesurée, Wokwi et KiCad) et une reconnaissance de gestes TinyML (collecte, Keras, int8, LiteRT for Microcontrollers, acquisition par interruption et tampon circulaire).
- Progression des roadmaps (audit #9) : une étape est acquise si l'élève la coche, ou si toutes ses leçons liées sont terminées ; dans ce cas la case est cochée et verrouillée, et l'étape affiche « k / n leçons terminées ». Les leçons terminées sont marquées d'une coche dans la liste des liens. Le compteur de la roadmap et celui de l'accueil suivent la même règle.

## Journal

- 12 nov. : projets, règle de progression et test de bout en bout (une leçon terminée coche l'étape « Conception de cartes » de la roadmap Embarqué). Une apostrophe non échappée dans une chaîne JavaScript a été vue tout de suite par `node --check` (test ajouté au sprint 9.4). 1 118 vérifications, 102 tests unitaires, 17 tests de bout en bout.
- 12 nov. : PR #113, les trois jobs verts. Fusionnée ; version 0.32.0, milestone 9 fermé.

## Revue de sprint

| Story | Points | Livré |
|-------|--------|-------|
| #108 Capstones Embarqué et progression des roadmaps | 5 | Oui (PR #113) |

Vélocité : 5 points sur 5. Version 0.32.0. L'étape 9 est terminée : 8 projets capstone, 2 par roadmap, et des roadmaps reliées aux leçons.

## Rétrospective de l'étape 9

**Ce qui a marché.** Un format de projet en données, validé comme le reste du contenu ; des critères de réussite chiffrés, que l'élève peut citer en entretien.

**Ce qui a coincé.** Rien de bloquant ; le test de syntaxe a rentabilisé sa mise en place dès le sprint suivant.

**À essayer.** Les améliorations de l'audit restantes, par priorité : navigation trop longue (#27), révision espacée des quiz (#3), indices progressifs (#7), export et import de la progression (#16).
