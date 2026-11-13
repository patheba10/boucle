# Sprint 14.3

**Objectif** : refaire en exercices, dans le bloc DevOps, ce qui vient d'être fait sur Boucle (hors ligne et CSP).

| Story | Points | Statut |
|-------|--------|--------|
| #141 C-3 Exercices DevOps : hors ligne et en-têtes de sécurité | 8 | En cours |

## Conception

- Deux leçons dans le cours CI/CD, nouveau chapitre « Mettre un site en production », juste après « Déployer » :
  - **ci-23 Un site qui marche hors ligne** : manifeste, cycle de vie du service worker, les trois stratégies de cache et quand utiliser chacune, le piège du « cache d'abord » sur la page, le versionnage du précache par empreinte ;
  - **ci-24 En-têtes de sécurité et CSP** : CSP, HSTS, nosniff, frame-ancestors, Referrer-Policy ; les directives et leur repli sur `default-src`, nonce et hash, balise meta contre en-tête, déploiement en Report-Only.
- Les leçons sont en Python : le navigateur vérifie le code de l'élève. Le défi principal simule le cache d'un service worker (ci-23) ou évalue une politique CSP (ci-24) ; le défi d'entretien écrit le script de précache de la CI (ci-23) ou audite les en-têtes d'un site (ci-24). Chaque leçon a aussi un quiz et trois exercices courts.
- Le cas concret de chaque leçon est Boucle lui-même : ses sprints 14.1 et 14.2 servent d'exemple (réponse opaque d'`importScripts`, JSCPP déplacé dans un worker pour éviter `'unsafe-eval'`).
- Un projet guidé dans la roadmap DevOps, **pj-site-durci**, à faire sur son propre site : installable, hors ligne, CSP sans exception pour les scripts, note A aux audits d'en-têtes, chaque garantie vérifiée par un test en CI. Les deux leçons sont rattachées aux étapes CI/CD et DevSecOps de la roadmap.

## Journal

- 13 nov. : leçons ci-23 et ci-24 ; sorties attendues des défis calculées en exécutant les solutions, puis relues ; projet pj-site-durci (4 jalons). 1 303 vérifications, e2e complets verts.
