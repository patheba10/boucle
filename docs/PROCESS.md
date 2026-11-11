# Processus de travail

Scrum allégé, adapté à une équipe de deux : Demba (Product Owner et relecteur) et Claude (développement).

## Artefacts

| Artefact | Où |
|----------|----|
| Product backlog | GitHub Issues : une issue par user story (`user-story`) ou travail technique (`enabler`) |
| Release | Un milestone par étape du [PLAN](../PLAN.md) |
| Sprint backlog | Les issues d'un sprint, listées dans `docs/sprints/` |
| Incrément | Le site publié après chaque fusion sur `main` |
| Historique | [CHANGELOG](../CHANGELOG.md) et tags `v0.x.0` |

## Cycle d'un sprint

1. **Planification** : choisir les stories, vérifier qu'elles sont prêtes (DoR), estimer en points (suite de Fibonacci).
2. **Développement** : une branche par story, nommée `us-<n>/<slug>`, avec des commits [conventionnels](https://www.conventionalcommits.org/fr/) qui référencent l'issue (`Refs #2`).
3. **Revue** : une pull request par story. La CI la valide et Vercel publie un aperçu. Demba relit sur l'aperçu, puis fusionne ou demande des changements.
4. **Rétrospective** : trois lignes dans le fichier du sprint (ce qui a marché, ce qui a coincé, ce qu'on change).

## Definition of Ready (DoR)

Une story entre dans un sprint quand elle a :

- un énoncé « En tant que… je veux… afin de… » ;
- des critères d'acceptation vérifiables ;
- une estimation ;
- des dépendances identifiées.

## Definition of Done (DoD)

Une story est terminée quand :

- tous ses critères d'acceptation sont cochés ;
- `npm run validate` passe : chaque solution réussit, chaque code de départ échoue ;
- les tests e2e passent (`npm run test:e2e`) ;
- elle a été vérifiée à la main dans le navigateur, sur ordinateur et sur mobile ;
- la documentation est à jour (README, ARCHITECTURE, guides d'installation) ;
- la PR est relue et fusionnée, et le site est publié ;
- l'issue est fermée et le CHANGELOG mis à jour.

## Règles de code

- Le contenu reste des données, la logique reste dans `assets/js`.
- Pas de nouvelle dépendance sans justification dans la PR.
- Toute version de bibliothèque est épinglée (CDN, `package.json`, `requirements.txt`).
- Un défi doit tester le comportement (valeurs, types, formes), jamais seulement le texte affiché quand c'est évitable.
