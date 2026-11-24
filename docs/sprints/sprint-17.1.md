# Sprint 17.1

**Objectif** : qu'un élève bloqué sur un exercice puisse s'en sortir seul : savoir ce qui cloche, avoir des indices, voir la réponse.

| Story | Points | Statut |
|-------|--------|--------|
| #164 E-1 Diagnostic précis d'une réponse fausse | 3 | Terminé |
| #165 E-2 Indices progressifs sur les exercices | 3 | Terminé |
| #166 E-3 Voir la réponse d'un exercice | 2 | Terminé |

## Conception

- **Origine** : retour d'usage sur py-01. La réponse était juste à une majuscule près, et le message « Pas encore » ne disait pas pourquoi. Sans indice ni réponse, il fallait demander de l'aide ailleurs.
- **Diagnostic** (`diagnostic(ex, reponse, lang)`, fonction pure) : il dit ce qui cloche sans donner la réponse.
  - Sortie : nombre de lignes, ligne fautive, casse seule, espaces seuls, guillemets.
  - Trous : trous faux, casse, trous vides.
  - Ordre : nombre de lignes déjà à leur place.
- **Saisie plus tolérante** : les guillemets typographiques (correcteur du clavier) et les espaces insécables comptent comme leur forme simple. La casse reste exigée, car un programme affiche exactement ce qu'on lui donne, mais elle est signalée.
- **Indices** (`indicesExercice(ex)`) :
  - d'abord ceux de l'auteur (champ `indices`, vérifié par `validate.mjs`) ;
  - puis des indices calculés à partir de la réponse : nombre de lignes et première ligne, taille et premier caractère des trous, première et dernière ligne du programme.
  - Un test parcourt les 100 exercices du site : les indices ne donnent jamais toute la réponse.
- **Voir la réponse** : deux clics, comme la solution des défis. Le premier prévient que l'exercice comptera sans XP.
  - La réponse est remplie dans l'exercice, avec son explication.
  - `L.exVu` garde la trace et la synchronisation le fusionne.
  - Après rechargement, le bouton affiche « Réponse vue ».

## Journal

- 23 nov. : retour d'usage, milestone « Aide aux exercices » et trois stories.
- 23 nov. : PR #167 (diagnostic), CI verte, fusionnée.
- 23 nov. : PR #168 (indices) et PR #169 (voir la réponse), CI verte, fusionnées ; publiées en 0.46.0.
- 23 nov. : 145 tests unitaires, 39 e2e.

## Revue de sprint

8 points livrés sur 8 (PR #167, #168, #169). Milestone « Aide aux exercices » terminé, version 0.46.0.

## Rétrospective

**Ce qui a marché.** Un retour d'usage précis (une majuscule) a fait apparaître un manque plus large : un message d'échec doit dire quoi corriger. Les indices calculés couvrent les 100 exercices sans en réécrire un seul.

**Ce qui a coincé.** Rien de bloquant. Les indices calculés restent génériques : ils aident à démarrer, pas à comprendre une notion.

**À essayer.** Écrire des indices d'auteur pour les exercices où les élèves échouent le plus.
