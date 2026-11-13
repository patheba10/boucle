# Sprint 12.1

**Objectif** : varier la pratique avec des exercices courts (audit #6).

| Story | Points | Statut |
|-------|--------|--------|
| #127 B-1 Moteur des exercices courts | 8 | En cours |

## Conception

- Trois formats, choisis parce qu'ils entraînent ce que l'éditeur ne travaille pas : lire du code (prédire la sortie), retrouver un élément précis (compléter les trous) et comprendre les dépendances entre lignes (remettre dans l'ordre).
- Un champ `exercices` facultatif sur la leçon. La correction tient dans `lib/exercices.js`, en fonctions pures testées seules : comparaison de sortie aux espaces de fin près, trous comparés sans tenir compte des espaces autour des opérateurs, réponses multiples séparées par `§` (le `|` sert en C et en Python).
- Le mélange des lignes est déterministe (graine = leçon et numéro de l'exercice) : l'élève retrouve le même ordre en revenant, et il n'est jamais déjà juste. Les lignes se déplacent avec des boutons ↑ ↓, utilisables au clavier et au doigt, plutôt qu'en glisser-déposer.
- La justesse de chaque exercice est prouvée par exécution : `npm run validate` lance le code (Python, ou C avec gcc et minic, sorties identiques exigées) et compare avec la réponse ou la sortie `attendu`.
- 5 XP par exercice, gagnés une seule fois ; les exercices restent facultatifs pour terminer la leçon, pour ne pas changer la progression déjà enregistrée.

## Journal

- 12 nov. : module, rendu dans la leçon (section « Exercices » après le quiz), validation par exécution, trois exercices d'exemple en Python (py-03) et en C (em-03), tests unitaires et test de bout en bout des trois formats.
