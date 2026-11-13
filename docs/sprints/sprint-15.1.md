# Sprint 15.1

**Objectif** : traiter les suites de l'audit de sécurité du 13 novembre.

| Story | Points | Statut |
|-------|--------|--------|
| #148 D-1 Durcir le dépôt et la chaîne d'approvisionnement | 5 | Terminé |

## Conception

- Constat de l'audit : pas de secret dans l'historique, CI bien verrouillée (actions épinglées, droits minimaux), site sans injection trouvée. Les manques : réglages GitHub (protection de `main`, alertes), dépendances jamais auditées en CI, deux bibliothèques chargées depuis un CDN tiers, pas de `SECURITY.md`.
- **Audit des dépendances en CI** (`scripts/audit.mjs`, job dédié, requis avant publication) : `npm audit` et `pip-audit`. Chaque exception est écrite dans le script avec sa justification, et le script signale celles devenues inutiles.
- **Copies locales** : JSCPP et js-yaml sont servis par le site, copies exactes des paquets npm. Un test compare leurs empreintes, et le repli sur unpkg disparaît. Pyodide reste sur le CDN (trop volumineux), risque écrit dans `SECURITY.md`.
- **CodeQL** (JavaScript, Python, workflows) à chaque PR et chaque semaine ; **Dependabot** étendu à npm et aux outils de test Python ; **`SECURITY.md`** (signalement privé, périmètre, mesures, exceptions).
- **Figures** : seule une chaîne base64 valide devient une image dans la console.

## Journal

- 13 nov. : en relançant `npm audit` sans filtre, trois failles apparaissent, que l'audit initial avait manquées (j'avais lancé `npm audit --omit=dev`, or toutes les dépendances sont de développement). js-yaml 4.1.0 (pollution de prototype et dénis de service, aussi présent dans le navigateur) passe en 4.3.2. printf, embarqué dans JSCPP 2.0.6, reste : JSCPP 2.0.9 n'a plus de version navigateur, et la faille ne permet à l'élève que de ralentir son propre worker, arrêté au bout de 6 s. Exception justifiée.
- 13 nov. : pytest reste en 8.3.5, la version de Pyodide : le mettre à jour en CI ferait diverger la validation des exercices pytest du navigateur. La faille concerne les machines partagées ; la CI tourne sur un runner jetable.
- 13 nov. : 124 tests unitaires, 1 303 vérifications, e2e complets verts.
- 13 nov. : PR #149 : CI (dont le nouveau job d'audit) et CodeQL (JavaScript, Python, workflows) verts. Fusionnée ; version 0.44.0.

## Revue de sprint

| Story | Points | Livré |
|-------|--------|-------|
| #148 Durcir le dépôt et la chaîne d'approvisionnement | 5 | Oui (PR #149) |

Restent à faire par le propriétaire du dépôt, dans les réglages GitHub : protéger `main` (règle : PR et CI obligatoires, pas de push forcé) et activer les alertes Dependabot, le secret scanning avec protection des pushs, et le signalement privé de failles.

## Rétrospective

**Ce qui a marché.** Un audit en CI avec des exceptions écrites et justifiées : la prochaine faille bloque la publication au lieu de passer inaperçue.

**Ce qui a coincé.** Mon premier audit a lancé `npm audit --omit=dev` et conclu « 0 faille » à tort : toutes les dépendances du projet sont de développement. Un outil de sécurité doit tourner sans filtre, puis on écarte explicitement ce qui ne s'applique pas.

**À essayer.** Relire l'onglet Security après la première analyse CodeQL complète sur `main`.
