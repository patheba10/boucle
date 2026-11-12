# Sprint 11.3

**Objectif** : des indices progressifs (audit #7).

| Story | Points | Statut |
|-------|--------|--------|
| #117 A-3 Indices progressifs | 3 | Terminé |

## Conception

- Réécrire plus de 200 indices aurait été long et risqué. Les indices existants sont déjà écrits du plus général au plus précis : `lib/indices.js` les découpe en phrases, révélées une par une (« Indice (1 / 3) », « Indice suivant (2 / 3) »…). Les extraits de code entre @@ @@ sont protégés pendant le découpage, et une phrase très courte s'accroche à la suivante.
- Un défi peut aussi fournir `hints`, une liste explicite, qui remplace le découpage.
- Un test unitaire passe sur tous les indices du site : aucun texte perdu, aucun @@ coupé ; plus d'un tiers des indices se découpent en plusieurs étapes.

## Journal

- 12 nov. : module, branchement sur les quatre types de défis (Python, C++, C, SQL ; terminal ; script ; YAML), tests unitaires et de bout en bout. 1 118 vérifications, 107 tests unitaires, 19 tests de bout en bout.
- 12 nov. : PR #123, les trois jobs verts. Fusionnée ; version 0.35.0.

## Revue de sprint

| Story | Points | Livré |
|-------|--------|-------|
| #117 Indices progressifs | 3 | Oui (PR #123) |

Vélocité : 3 points sur 3. Version 0.35.0.

## Rétrospective

**Ce qui a marché.** Tirer parti du contenu existant plutôt que le réécrire, et le vérifier entièrement par un test.

**Ce qui a coincé.** Rien.

**À essayer.** #118 : export et import de la progression, avec validation du fichier.
