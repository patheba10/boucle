# Sprint 11.1

**Objectif** : la navigation, devenue trop longue avec 20 cours (audit #27 et #28).

| Story | Points | Statut |
|-------|--------|--------|
| #115 A-1 Navigation regroupée par étapes | 5 | Terminé |

## Conception

- Milestone 10 « Améliorations de l'audit » : quatre stories (#115 à #118), par priorité.
- La barre passe de 21 liens à 7 : Accueil, Cours, Roadmaps, Projets, Certifs, Atelier, Installer. Une page Cours regroupe les 20 cours en 6 domaines (Programmer, Données et IA, DevOps et SRE, Cloud et architecture, Hardware et embarqué, Carrière) ; l'accueil affiche les mêmes groupes. « Cours » reste surligné sur une page de cours ou de leçon, « Certifs » sur une certification, « Projets » sur un projet.
- Les groupes sont des données (`GROUPES` dans `content/index.js`) ; `npm run validate` exige que chaque cours soit dans exactement un groupe.
- Audit #28 traité au passage : la capture de la page Cours montrait des badges vides. Chaque cours prend la couleur de sa famille (`color` dans `lib/util.js`).

## Journal

- 12 nov. : navigation, page Cours, validation des groupes, couleurs. Vérifié par captures d'écran à 1 200 px et à 400 px. 1 118 vérifications, 102 tests unitaires, 17 tests de bout en bout.

## Revue de sprint

| Story | Points | Livré |
|-------|--------|-------|
| #115 Navigation regroupée par étapes | 5 | Oui |

Vélocité : 5 points sur 5. Version 0.33.0.

## Rétrospective

**Ce qui a marché.** La capture d'écran a révélé un deuxième défaut (#28) qu'aucun test ne voyait.

**Ce qui a coincé.** L'identifiant du cours Python est `py`, sa route `python` : la validation l'a signalé.

**À essayer.** #116, révision espacée : stocker la date de prochaine révision par question, et une file sur l'accueil.
