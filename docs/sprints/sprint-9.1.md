# Sprint 9.1

**Objectif** : ouvrir l'étape 8 (entretiens) avec les structures de données et la complexité.

| Story | Points | Statut |
|-------|--------|--------|
| #94 US-9a Structures de données et complexité | 8 | Terminé |

## Conception

- Étape découpée en quatre stories (#94 à #97, milestone 8) : structures, patterns d'algorithmes, system design, entretiens par métier et comportemental.
- Nouveau cours « Algorithmique » (`algo`), Python pur : chaque structure est codée à la main (tableau dynamique, table de hachage à chaînage, file à deux piles, liste chaînée, ABR itératif, tas, BFS), puis éprouvée sur des entrées de 20 000 à 200 000 éléments. Une solution de mauvaise complexité dépasse le temps alloué ; les tests comptent aussi ce qui se mesure (recopies du tableau dynamique, longueur des chaînes de la table de hachage, hauteur de l'arbre).
- Le chapitre 2 (patterns, #95) s'ajoutera au même cours.

## Journal

- 12 nov. : 9 leçons, 8 défis. Un code de départ quadratique sur 200 000 éléments rendait la validation très lente (8 min) : les codes de départ doivent échouer vite, pas lentement. Un test lisait le milieu d'une liste après l'avoir inversée en place : corrigé.
- 12 nov. : en CI, le test de l'examen blanc a échoué : la première question d'entraînement est tirée au hasard, et une question à plusieurs réponses demande de valider. Test corrigé (audit #29).
- 12 nov. : le test de parité a révélé un vrai bogue de la plateforme : après le défi de l'arbre dégénéré (3 000 nœuds), le défi suivant restait bloqué 20 s. Cause : dans Pyodide, libérer d'un coup une longue chaîne d'objets liés est récursif et dépasse la petite pile C ; la libération arrivait plus tard, au passage du ramasse-miettes. Correctif dans le harnais : après chaque exécution, les objets de l'élève sont démontés un par un (test unitaire ajouté). 1 048 vérifications, 101 tests unitaires, tests de bout en bout.

## Revue de sprint

| Story | Points | Livré |
|-------|--------|-------|
| #94 Structures de données et complexité | 8 | Oui |

Vélocité : 8 points sur 8. Version 0.26.0.

## Rétrospective

**Ce qui a marché.** Le test de parité dans le vrai Pyodide : il a trouvé un bogue que ni CPython ni la relecture ne pouvaient montrer, et qui aurait touché tout élève écrivant une longue liste chaînée.

**Ce qui a coincé.** Un bogue qui se manifeste dans l'exécution suivante, pas dans la fautive : il a fallu bissecter la séquence des défis pour le trouver.

**À essayer.** Garder les entrées des tests de performance sous ~1 s dans Pyodide, et toujours lancer la parité sur toute la séquence d'un cours, pas défi par défi.
