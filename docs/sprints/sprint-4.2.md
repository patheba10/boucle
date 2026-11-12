# Sprint 4.2

**Objectif** : terminer le cours Linux et Bash, jusqu'aux mises en situation et aux questions d'entretien.

| Story | Points | Statut |
|-------|--------|--------|
| #29 US-4.0 Terminal Linux simulé : processus, services, réseau, SSH | 3 | Terminé |
| #30 US-4a Cours Linux et Bash, chapitres 6 à 10 | 6 | Terminé |

**Capacité** : 9 points.

## Livré

- Cours Linux et Bash complet : 21 leçons. Ce sprint ajoute 11 leçons, 10 défis (dont trois scripts testés avec des arguments) et 20 questions de quiz.
- Chapitres : processus et ressources, systemd et journaux, variables et environnement, scripts Bash, réseau, SSH, cron, incident nginx, sauvegarde avec rotation, entretien.
- Terminal : services et processus décrits dans la mise en place (une API en échec parce qu'un serveur de test occupe son port), unités systemd écrites par l'élève, `nginx -t` plus strict, options à la POSIX pour `xargs`. 11 tests unitaires pour le terminal, 44 en tout.

## Rétrospective

**Ce qui a marché**
- Lire la sortie de chaque solution, pas seulement le verdict du validateur. Elle a montré deux défauts que les tests ne voyaient pas : un journal systemd dans le désordre (le démarrage daté après l'erreur) et une configuration nginx « cassée » que le vrai nginx accepte.
- Le validateur a attrapé `ls -1` refusé et `xargs` qui prenait le `-f` de `rm` pour le sien.

**Ce qui a coincé**
- Un incident réaliste demande que la panne soit vraiment une panne. Un `;` oublié après `index` ne casse rien chez nginx : la directive suivante devient un argument. L'incident repose maintenant sur `root`, qui n'accepte qu'un argument, comme dans le vrai nginx.

**On change**
- Pour chaque mise en situation, vérifier que la panne existe sur une vraie machine avant de l'écrire, et lire la transcription complète de la solution.
