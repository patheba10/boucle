# Sprint 12.2

**Objectif** : remplir les cours Python, Algorithmique et C embarqué avec les nouveaux exercices (audit #6).

| Story | Points | Statut |
|-------|--------|--------|
| #128 B-2 Exercices dans les cours | 5 | Terminé |

## Conception

- Les exercices vivent dans `public/content/exercices/<cours>.js`, rangés par id de leçon, et sont rattachés aux leçons au chargement du contenu. Les fichiers de leçons restent lisibles, et `npm run validate` signale un id de leçon inconnu.
- Deux exercices au moins par leçon à défi : une prédiction de sortie (lire du code), puis un code à trous ou des lignes à remettre dans l'ordre, sur la notion exacte de la leçon.
- C embarqué : des programmes complets en C standard, compilés par gcc avec `-Werror` et exécutés par minic. Les calculs reprennent les vrais cas du cours (fréquence d'un timer, rapport cyclique, millivolts d'un ADC, octet d'adresse I2C, champs d'un registre de datasheet, quantification int8).
- « Remettre dans l'ordre » accepte du code fixe autour des lignes (`avant`, `apres`), pour ne faire ordonner que la partie intéressante. On évite les lignes qu'on pourrait échanger sans changer le programme, puisque seul l'ordre donné est accepté.

## Journal

- 12 nov. : 94 exercices sur 46 leçons (13 Python, 18 Algorithmique, 15 C embarqué). Chaque réponse est vérifiée par exécution ; aucune prédiction écrite à la main n'était fausse.
- 12 nov. : le délimiteur de trou `[[ ]]` créait de faux trous dans du Python valide (`[[] for _ in range(n)]`, listes de listes). Remplacé par `⟦ ⟧`, qui n'apparaît dans aucun langage du site ; test unitaire ajouté.
- 12 nov. : sur téléphone, l'indentation des lignes à ordonner est réduite de moitié pour que le code reste lisible.
- 12 nov. : PR #132, les trois jobs verts. Fusionnée ; version 0.38.0.

## Revue de sprint

| Story | Points | Livré |
|-------|--------|-------|
| #128 Exercices dans les cours | 5 | Oui (PR #132) |

Vélocité : 5 points sur 5. Version 0.38.0. 1 212 vérifications, 114 tests unitaires.

## Rétrospective

**Ce qui a marché.** Écrire la réponse attendue avant d'exécuter : la validation sert de relecture, et elle a confirmé les 94 prédictions.

**Ce qui a coincé.** Un format de trou choisi pour être facile à taper entrait en collision avec du code ordinaire. Il faut tester un format sur de vrais exemples avant de le figer.

**À essayer.** Défis gradués (B-3) : plusieurs défis par leçon, du plus simple au niveau entretien.
