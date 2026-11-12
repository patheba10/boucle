# Sprint 9.3

**Objectif** : le system design, à la fois méthode d'entretien et compréhension des briques.

| Story | Points | Statut |
|-------|--------|--------|
| #96 US-9c System design | 8 | Terminé |

## Conception

- Nouveau cours « System design » (`sysdesign`, route `#system-design`), Python pur. La théorie suit la méthode d'entretien (exigences, estimations, API, données, architecture, approfondissements, compromis).
- Comme prévu à la rétrospective 9.2, chaque brique devient un composant codé et testé : estimation de charge, répartiteurs (tourniquet et moins de connexions), cache LRU avec expiration et horloge injectée, anneau de hachage cohérent avec nœuds virtuels, consommateur idempotent et délais exponentiels, seau à jetons par client, disponibilité en série et en parallèle, encodage base 62 du raccourcisseur d'URL.
- Les tests mesurent ce qui compte en architecture : la part de clés déplacées en ajoutant un serveur (environ 1/N), le taux de succès d'un cache dans son pire cas, les rafales acceptées par le limiteur.

## Journal

- 12 nov. : 9 leçons, 8 défis, sorties calculées par script puis relues. Un test du cache montre volontairement le pire cas du LRU (un balayage de 1 500 clés pour 1 000 places : 0 succès), commenté dans le test. Les 8 défis passent dans Pyodide (hashlib compris). 1 101 vérifications, tests de bout en bout.

## Revue de sprint

| Story | Points | Livré |
|-------|--------|-------|
| #96 System design | 8 | Oui |

Vélocité : 8 points sur 8. Version 0.28.0.

## Rétrospective

**Ce qui a marché.** Coder les briques rend la théorie vérifiable : l'anneau de hachage cohérent affiche réellement 20 % de clés déplacées pour un cinquième serveur.

**Ce qui a coincé.** Rien de bloquant.

**À essayer.** Pour #97 (entretiens par métier), regrouper les questions d'entretien déjà écrites dans chaque cours et les rendre entraînables avec le moteur d'examen blanc.
