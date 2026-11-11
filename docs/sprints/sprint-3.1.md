# Sprint 3.1

**Objectif** : apprendre Git en ligne de commande dans un terminal simulé, avec le graphe des commits sous les yeux.

| Story | Points | Statut |
|-------|--------|--------|
| #18 US-3.0 Terminal Git simulé (enabler) | 8 | Terminé |
| #10 US-3a Git en ligne de commande | 8 | Terminé |

**Capacité** : 16 points.

**Choix techniques**
- Simulateur en JavaScript pur, sans DOM : le navigateur et la CI exécutent le même code.
- On vérifie l'**état** du dépôt, pas les commandes tapées : plusieurs chemins mènent au bon résultat, comme en vrai.
- Sorties en anglais, identiques au vrai Git, pour que tu les reconnaisses sur ta machine ; explications en français.

## Livré

- Simulateur Git (16 tests unitaires), terminal, graphe des commits et état des fichiers.
- Cours Git en 9 leçons et 3 chapitres : « Les bases », « Branches », « Réparer et collaborer ». Le dernier défi reproduit un hotfix en production (cherry-pick, tag SemVer, push des tags).

## Rétrospective

**Ce qui a marché**
- Vérifier l'état du dépôt plutôt que les commandes : les six nouveaux défis ont passé la validation du premier coup, parce que les critères décrivent un résultat et pas un chemin.
- Le même simulateur en CI et dans le navigateur : aucune différence de comportement à traquer.

**Ce qui a coincé**
- Un job e2e a échoué pour une raison extérieure (miroir apt d'Ubuntu injoignable sur le runner). La relance a échoué de la même façon : la CI dépendait d'un réseau qu'on ne contrôle pas.
- pd-08 : le code piège passait avec pandas 3, installé par erreur en local. Un test qui repose sur une erreur de la bibliothèque est fragile ; il repose maintenant sur une différence de valeurs.
- Le test de parité n'indiquait pas quelle leçon bloquait.

**On change**
- Un défi doit échouer à cause de son résultat, jamais à cause d'une exception propre à une version.
- Les tests nomment toujours l'élément fautif.
- Le job e2e utilise maintenant le Chrome déjà présent sur le runner : plus d'apt (AUDIT #25).
