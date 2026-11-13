# Sprint 13.1

**Objectif** : finir l'audit #2 avec des défis d'entretien en C embarqué et en SQL.

| Story | Points | Statut |
|-------|--------|--------|
| #136 B-4 Défis d'entretien en C embarqué et en SQL | 5 | Terminé |

## Conception

- Aucun changement de moteur : les défis gradués gèrent déjà le C et le SQL depuis 0.39.0. Seul le contenu s'ajoute, dans `public/content/defis/embarque.js` et `sql.js`.
- SQL : une requête d'entretien par leçon 5 à 12, sur la base du cours. Chacune vise le piège que pose la question en entretien : la condition d'un LEFT JOIN placée dans le WHERE, le montant pris au prix catalogue au lieu du prix payé, la moyenne de lignes au lieu de la moyenne de commandes, la fonction fenêtre appelée dans le WHERE.
- C embarqué : six questions qu'on pose en entretien embarqué. Addition sans débordement signé, bits à 1 et puissance de deux avec @@x & (x − 1)@@, inversion de chaîne sur place, lecture gros-boutiste indépendante du processeur, moyenne glissante en O(1), CRC-8 (valeur de contrôle 0xF4 sur « 123456789 »).
- Un défi SQL n'a pas de sortie attendue écrite : le résultat de l'élève est comparé à celui de la solution. La validation n'exige donc `expected` que pour Python, C et C++.

## Journal

- 13 nov. : 8 défis SQL et 6 défis C. Résultats SQL relus dans SQLite (aucun résultat vide ni trivial) ; sorties C calculées par gcc, relues, puis identiques dans minic.
- 13 nov. : PR #137, les trois jobs verts (dont la parité navigateur en ligne, qui rejoue les défis SQL et C). Fusionnée ; version 0.40.0.

## Revue de sprint

| Story | Points | Livré |
|-------|--------|-------|
| #136 Défis d'entretien en C embarqué et en SQL | 5 | Oui (PR #137) |

Vélocité : 5 points sur 5. Version 0.40.0. Audit #2 terminé : 34 défis gradués en Python, Algorithmique, SQL et C embarqué.

## Rétrospective

**Ce qui a marché.** Un moteur générique dès B-3 : ce sprint n'a été que du contenu, sans toucher au code du site.

**Ce qui a coincé.** Un défi SQL sur la base du cours a donné un résultat vide (aucun employé mieux payé que son manager) : il a été remplacé. Il faut relire le résultat de chaque solution SQL, pas seulement vérifier qu'elle s'exécute.

**À essayer.** Ajouter le contrôle « résultat non vide » à la validation des défis SQL.
