# Sprint 4.1

**Objectif** : un terminal Linux dans le navigateur, et les premiers chapitres du cours Linux et Bash.

| Story | Points | Statut |
|-------|--------|--------|
| #29 US-4.0 Terminal Linux simulé (enabler) | 8 | Terminé |
| #30 US-4a Cours Linux et Bash, chapitres 1 à 5 | 6 | Terminé (story ouverte jusqu'au chapitre 10) |

**Capacité** : 14 points.

**Choix techniques** : voir l'[ADR 0001](../adr/0001-simulateurs-devops.md). Le terminal est un simulateur en JavaScript, comme celui de Git : démarrage instantané, critères déclaratifs, mêmes octets en CI et dans le navigateur. Chaque chapitre propose de refaire l'exercice pour de vrai sous WSL ou Ubuntu.

## Livré

- Terminal Linux simulé : environ 3 000 lignes, une centaine de commandes, 9 tests unitaires ; saisie sur plusieurs lignes comme dans bash.
- Cours Linux et Bash, chapitres 1 à 5 : 10 leçons, 10 défis, 30 extraits exécutables.
- Première PR de Dependabot relue et fusionnée : six actions mises à jour, déploiement vérifié.

## Rétrospective

**Ce qui a marché**
- Écrire les tests unitaires sur des scénarios réels (journal nginx, script avec `set -euo pipefail`, configuration nginx cassée) a révélé les bugs avant le contenu : `sort -k` mal déclaré, `bash` absent, `ln -sf` qui suivait le lien.
- Le validateur a attrapé des erreurs de contenu : des totaux calculés à la main faux (8 226 au lieu de 8 336 octets, 8 réponses 200 au lieu de 7), un extrait qui cherchait « port » en minuscules, des dossiers de mise en place qui appartenaient à root.

**Ce qui a coincé**
- Le simulateur est gros. Chaque commande ajoutée doit imiter les messages GNU : on s'en tient aux commandes dont les leçons ont besoin, et une commande non simulée le dit.
- `ls` affiche une seule ligne dans un terminal et une ligne par fichier dans un pipe, comme le vrai : le critère « sortie exacte » est désormais tolérant aux espaces.

**On change**
- Ne jamais écrire un résultat attendu à la main : le calculer dans le fichier de contenu (comme pour lx-07) ou le faire confirmer par le simulateur.
- Les PR de Dependabot se relisent et se fusionnent pendant le sprint où elles arrivent.
