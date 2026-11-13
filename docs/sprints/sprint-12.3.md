# Sprint 12.3

**Objectif** : plusieurs défis par leçon, du niveau de la leçon au niveau entretien (audit #2).

| Story | Points | Statut |
|-------|--------|--------|
| #129 B-3 Défis gradués | 13 | Terminé |

## Conception

- Un champ `defis` sur la leçon, rempli depuis `public/content/defis/<cours>.js`. Chaque défi reprend le format du défi principal et ajoute un `niveau`. Un seul défi par niveau : la progression est rangée par niveau (`L.defis.entretien`), elle ne se décale donc pas si l'on ajoute un défi plus tard.
- Le défi principal ne change pas : il garde `L.ch`, `L.sol` et son code sauvegardé. Les progressions déjà enregistrées restent valides, et la leçon reste terminée avec son quiz et son défi principal.
- Onglets au-dessus de l'énoncé (« Défi », « Facile », « Moyen », « Entretien ») ; changer d'onglet redessine l'énoncé et l'éditeur, avec le code propre à ce défi. La logique (ordre, progression, XP) tient dans `lib/defis.js`, testé seul.
- Limité aux défis à éditeur (Python, SQL, C, C++) : ceux qui se vérifient par la sortie. Les terminaux Git et Linux gardent un défi unique.
- La complexité demandée en entretien est vérifiée sans chronomètre : la liste passée à la fonction compte ses lectures. Un parcours complet est refusé quel que soit l'ordinateur.

## Journal

- 12 nov. : module `lib/defis.js` et rendu en onglets. La partie « défi à éditeur » de la page de leçon devient une fonction réutilisée par chaque onglet.
- 12 nov. : contenu : un problème d'entretien classique pour chacune des dix leçons de patterns d'algorithmique (suite consécutive, 3-sum, fenêtre à k caractères, minimum d'une liste tournée, histogramme, cycle de dépendances, médiane d'un flux, insertion d'intervalle, N reines, distance d'édition), et un défi « moyen » pour les leçons 4 à 13 de Python. Sorties attendues calculées en exécutant la solution, puis relues.
- 12 nov. : `npm run validate` vérifie chaque défi gradué (solution et code de départ) ; le test de parité du navigateur les rejoue tous, onglet par onglet. 1 252 vérifications.
- 12 nov. : PR #134, les trois jobs verts. Fusionnée ; version 0.39.0, milestone 11 fermé.

## Revue de sprint

| Story | Points | Livré |
|-------|--------|-------|
| #129 Défis gradués | 13 | Oui (PR #134) |

Vélocité : 13 points sur 13. Version 0.39.0. Milestone « Formats d'exercice et défis gradués » : 26 points sur 26.

## Rétrospective du milestone

**Ce qui a marché.** Garder le défi principal intact (mêmes champs, même code sauvegardé) : aucune migration de la progression. Calculer les sorties attendues avec la solution, puis les relire, plutôt que de les écrire à la main.

**Ce qui a coincé.** Un commit fait sur main au lieu de la branche de la story, rattrapé avant le push. Un code de départ trop lent (recherche linéaire répétée) aurait fait attendre la validation une minute : les codes de départ doivent échouer vite.

**À essayer.** Ajouter des défis gradués au C embarqué et au SQL, qui ont déjà le moteur ; restent dans l'audit la PWA hors ligne (#19) et la Content-Security-Policy (#21).
