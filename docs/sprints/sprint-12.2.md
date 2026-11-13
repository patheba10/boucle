# Sprint 12.2

**Objectif** : remplir les cours Python, Algorithmique et C embarqué avec les nouveaux exercices (audit #6).

| Story | Points | Statut |
|-------|--------|--------|
| #128 B-2 Exercices dans les cours | 5 | En cours |

## Conception

- Les exercices vivent dans `public/content/exercices/<cours>.js`, rangés par id de leçon, et sont rattachés aux leçons au chargement du contenu. Les fichiers de leçons restent lisibles, et `npm run validate` signale un id de leçon inconnu.
- Deux exercices au moins par leçon à défi : une prédiction de sortie (lire du code), puis un code à trous ou des lignes à remettre dans l'ordre, sur la notion exacte de la leçon.
- C embarqué : des programmes complets en C standard, compilés par gcc avec `-Werror` et exécutés par minic. Les calculs reprennent les vrais cas du cours (fréquence d'un timer, rapport cyclique, millivolts d'un ADC, octet d'adresse I2C, champs d'un registre de datasheet, quantification int8).
- « Remettre dans l'ordre » accepte du code fixe autour des lignes (`avant`, `apres`), pour ne faire ordonner que la partie intéressante. On évite les lignes qu'on pourrait échanger sans changer le programme, puisque seul l'ordre donné est accepté.

## Journal

- 12 nov. : 94 exercices sur 46 leçons (13 Python, 18 Algorithmique, 15 C embarqué). Chaque réponse est vérifiée par exécution ; aucune prédiction écrite à la main n'était fausse.
- 12 nov. : le délimiteur de trou `[[ ]]` créait de faux trous dans du Python valide (`[[] for _ in range(n)]`, listes de listes). Remplacé par `⟦ ⟧`, qui n'apparaît dans aucun langage du site ; test unitaire ajouté.
- 12 nov. : sur téléphone, l'indentation des lignes à ordonner est réduite de moitié pour que le code reste lisible.
