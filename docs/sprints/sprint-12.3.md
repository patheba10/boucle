# Sprint 12.3

**Objectif** : plusieurs défis par leçon, du niveau de la leçon au niveau entretien (audit #2).

| Story | Points | Statut |
|-------|--------|--------|
| #129 B-3 Défis gradués | 13 | En cours |

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
