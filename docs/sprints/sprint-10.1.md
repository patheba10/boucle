# Sprint 10.1

**Objectif** : ouvrir l'étape 9 avec un format de projet capstone et les premiers projets DevOps.

| Story | Points | Statut |
|-------|--------|--------|
| #106 US-10a Page Projets et capstones DevOps | 8 | Terminé |

## Conception

- Étape découpée en trois stories (#106 à #108, milestone 9) : le format et les projets DevOps, puis Cloud et ML, puis Embarqué et la progression des roadmaps reliée aux leçons.
- Un projet capstone est une donnée (`public/content/projets/`) : contexte, exigences, architecture cible en schéma texte, jalons avec livrables, critères de réussite mesurables, extensions, leçons et ressources liées. La vue (`lib/projets.js`) affiche la liste par roadmap, la page d'un projet, et des jalons cochables sauvegardés dans la progression (`S.projets`). Chaque roadmap affiche ses projets en bas de page ; la barre de navigation gagne « Projets ».
- `npm run validate` vérifie les projets : identifiants et routes, roadmap, champs obligatoires, jalons, leçons liées, liens https, et l'absence d'accents graves (le code s'écrit entre @@ @@, comme dans les leçons).
- Deux projets DevOps : une plateforme de déploiement d'API complète (5 jalons) et un laboratoire d'incidents et d'astreinte (4 jalons), pensé pour nourrir les histoires STAR des entretiens.

## Journal

- 12 nov. : vue, données, validation et test de bout en bout (un jalon coché survit au rechargement et apparaît dans la liste). Une capture d'écran a montré des accents graves affichés tels quels : remplacés par @@ @@ et interdits par la validation. 1 112 vérifications, 102 tests unitaires, 16 tests de bout en bout.
- 12 nov. : PR #109, les trois jobs verts. Fusionnée ; version 0.30.0.

## Revue de sprint

| Story | Points | Livré |
|-------|--------|-------|
| #106 Page Projets et capstones DevOps | 8 | Oui (PR #109) |

Vélocité : 8 points sur 8. Version 0.30.0.

## Rétrospective

**Ce qui a marché.** Regarder la page rendue : le défaut des accents graves ne se voyait ni dans le code ni dans les tests.

**Ce qui a coincé.** Une case à cocher masquée par le style : le test clique sur l'étiquette, comme l'utilisateur.

**À essayer.** Pour #107, des critères de réussite chiffrés pour chaque projet Cloud et ML (coût mensuel, latence, métrique du modèle).
